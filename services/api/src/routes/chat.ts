import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { processChat, getEventRecommendations, ChatTurn } from '../services/gemini';
import { OrderService } from '../services/order.service';
import { decrypt } from '../services/encryption';
import { logger } from '../utils/logger';
import { recordMetric } from '../services/anomaly';

const router = Router();

const chatSchema = z.object({
  sessionId: z.string().optional(),
  message: z.string().max(2000).optional(),
  audio: z.object({
    data: z.string(),
    mimeType: z.string(),
  }).optional(),
}).refine(data => data.message || data.audio, {
  message: "Either message or audio must be provided",
});

// POST /stores/:storeId/chat - send a chat message
router.post('/:storeId/chat', async (req: Request, res: Response): Promise<void> => {
  const { storeId } = req.params;
  const parsed = chatSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
    return;
  }

  const { message, audio } = parsed.data;
  let { sessionId } = parsed.data;

  try {
    const store = await prisma.store.findUnique({
      where: { id: storeId as string },
      include: { settings: true },
    });

    if (!store || !store.active) {
      res.status(404).json({ error: 'Store not found' });
      return;
    }

    // Create or get session
    let session: any;
    if (sessionId) {
      session = await prisma.chatSession.findUnique({
        where: { id: sessionId },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            take: 40, // Last 40 messages for context
          },
        },
      });
    }

    if (!session) {
      const visitorId = (req.headers['x-visitor-id'] as string) || crypto.randomUUID();
      session = await prisma.chatSession.create({
        data: { storeId: storeId as string, visitorId },
        include: { messages: true },
      });
      sessionId = session.id;
    }

    // Build history for Gemini
    const history: ChatTurn[] = session.messages
      .filter((m: any) => m.role !== 'SYSTEM')
      .map((m: any) => ({
        role: m.role === 'USER' ? 'user' : 'model',
        parts: [{ text: m.content }],
      }));

    // Decrypt store's Gemini key if they have their own
    const storeGeminiKey = store.settings?.geminiApiKeyEnc
      ? decrypt(store.settings.geminiApiKeyEnc)
      : undefined;

    // Off-topic filter check
    if (message) {
      const offTopicPattern = /\b(poem|code|math|capital of|president|who is|joke|song|weather|recipe|news|translate|politics|write a)\b/i;
      if (offTopicPattern.test(message) || message.length > 500) {
        const cannedResponse = "I am a shopping assistant for this store. I'm afraid I can't help with that. How can I help you find products today?";

        // Save to DB
        await prisma.chatMessage.createMany({
          data: [
            { sessionId: session.id, role: 'USER', content: message },
            {
              sessionId: session.id,
              role: 'ASSISTANT',
              content: cannedResponse,
              actionType: null,
            },
          ],
        });

        // Record metric
        await recordMetric('chat_sessions', 1, storeId as string);

        res.json({
          sessionId: session.id,
          message: cannedResponse,
        });
        return;
      }
    }

    // Process with Gemini
    const result = await processChat(
      storeId as string,
      message || '',
      history,
      storeGeminiKey || undefined,
      audio
    );

    let actionResponse = result.action;
    let textResponse = result.text;

    if (result.action && result.action.type === 'PROCESS_CHECKOUT' && (store as any).tier === 'ENTERPRISE') {
      try {
        const items = (result.action.items as any[]) || [];
        const orderData = {
          storeId: storeId as string,
          customerEmail: 'agent@' + ((store as any).customDomain || `${(store as any).slug}.com`),
          customerName: 'AI Agent',
          shippingAddress: {
            street: '123 Smart Way',
            city: 'AI City',
            state: 'CA',
            zip: '94043',
            country: 'US',
          },
          items: items.map((i: any) => ({ productId: i.productId, quantity: i.quantity || 1 })),
          notes: 'Agentic Checkout Order',
        };

        const order = await OrderService.createOrder(storeId as string, orderData, undefined);

        actionResponse = {
          type: 'PROCESS_CHECKOUT',
          orderNumber: order.orderNumber,
          total: order.total,
        };
        textResponse = `I have completed the checkout for you. Your order number is ${order.orderNumber}.`;
      } catch (err: any) {
        logger.error('Agentic checkout failed', { error: err });
        textResponse = `I'm sorry, I wasn't able to complete the checkout: ${err.message}`;
        actionResponse = null;
      }
    } else if (result.action && result.action.type === 'PROCESS_CHECKOUT') {
      actionResponse = null;
    }

    // Save to DB
    await prisma.chatMessage.createMany({
      data: [
        { sessionId: session.id, role: 'USER', content: message || '[Audio Message]' },
        {
          sessionId: session.id,
          role: 'ASSISTANT',
          content: textResponse,
          actionType: actionResponse ? (actionResponse.type as string) : null,
          actionPayload: actionResponse ? (actionResponse as any) : undefined,
        },
      ],
    });

    // Record metric
    await recordMetric('chat_sessions', 1, storeId as string);

    res.json({
      sessionId: session.id,
      message: textResponse,
      action: actionResponse,
    });
  } catch (err) {
    logger.error('Chat error', { error: err, storeId });
    res.status(500).json({ error: 'Chat service unavailable' });
  }
});

// POST /stores/:storeId/chat/event-recommendations
router.post('/:storeId/chat/event-recommendations', async (req: Request, res: Response): Promise<void> => {
  const { storeId } = req.params;
  const { event, budget } = req.body as { event: string; budget?: number };

  if (!event?.trim()) {
    res.status(400).json({ error: 'Event description required' });
    return;
  }

  try {
    const store = await prisma.store.findUnique({
      where: { id: storeId as string },
      include: { settings: true },
    });

    if (!store) {
      res.status(404).json({ error: 'Store not found' });
      return;
    }

    const storeGeminiKey = store.settings?.geminiApiKeyEnc
      ? decrypt(store.settings.geminiApiKeyEnc)
      : undefined;

    const recommendations = await getEventRecommendations(
      storeId as string,
      event,
      budget,
      storeGeminiKey || undefined
    );

    // Enrich with full product data
    const productIds = recommendations.products.map((p) => p.id);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, storeId: storeId as string, active: true },
      select: { id: true, name: true, price: true, images: true, stock: true },
    });

    const enriched = recommendations.products
      .map((rec) => ({
        ...rec,
        product: products.find((p: any) => p.id === rec.id),
      }))
      .filter((r) => r.product);

    res.json({ ...recommendations, products: enriched });
  } catch (err) {
    logger.error('Event recommendations error', { error: err });
    res.status(500).json({ error: 'Recommendation service unavailable' });
  }
});

// GET /stores/:storeId/chat/history/:sessionId
router.get('/:storeId/chat/history/:sessionId', async (req: Request, res: Response): Promise<void> => {
  const { storeId, sessionId } = req.params;

  const session = await prisma.chatSession.findFirst({
    where: { id: sessionId as string, storeId: storeId as string },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  res.json({
    sessionId: session.id,
    messages: session.messages.map((m: any) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      action: m.actionPayload,
      createdAt: m.createdAt,
    })),
  });
});

export default router;
