import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { requireStoreAdmin } from '../middleware/auth';
import { encrypt, decrypt } from '../services/encryption';

const router = Router();

const messageSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  subject: z.string().min(1).max(200),
  message: z.string().min(10).max(5000),
});

// POST /stores/:storeId/messages - public contact form
router.post('/:storeId/messages', async (req: Request, res: Response): Promise<void> => {
  const storeId = req.params.storeId as string;
  const parsed = messageSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
    return;
  }

  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) {
    res.status(404).json({ error: 'Store not found' });
    return;
  }

  await prisma.contactMessage.create({
    data: {
      storeId,
      nameEnc: encrypt(parsed.data.name),
      emailEnc: encrypt(parsed.data.email),
      subject: parsed.data.subject,
      message: parsed.data.message,
    },
  });

  res.status(201).json({ success: true, message: 'Your message has been received. We will respond shortly.' });
});

// GET /stores/:storeId/messages - admin list messages
router.get('/:storeId/messages', requireStoreAdmin, async (req: Request, res: Response): Promise<void> => {
  const storeId = req.params.storeId as string;
  const { unread, limit = '20', offset = '0' } = req.query;

  const where: Record<string, unknown> = { storeId };
  if (unread === 'true') where.read = false;

  const [messages, total, unreadCount] = await Promise.all([
    prisma.contactMessage.findMany({
      where: where as any,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
      include: {
        replies: { include: { user: { select: { name: true, avatarUrl: true } } } },
      },
    }),
    prisma.contactMessage.count({ where: where as any }),
    prisma.contactMessage.count({ where: { storeId, read: false } }),
  ]);

  // Decrypt PII for store admin
  const decrypted = messages.map((m: any) => ({
    ...m,
    name: decrypt(m.nameEnc),
    email: decrypt(m.emailEnc),
    nameEnc: undefined,
    emailEnc: undefined,
  }));

  res.json({ messages: decrypted, total, unreadCount });
});

// GET /stores/:storeId/messages/:messageId
router.get('/:storeId/messages/:messageId', requireStoreAdmin, async (req: Request, res: Response): Promise<void> => {
  const storeId = req.params.storeId as string;
  const messageId = req.params.messageId as string;

  const message = await prisma.contactMessage.findFirst({
    where: { id: messageId, storeId },
    include: {
      replies: { include: { user: { select: { id: true, name: true, avatarUrl: true } } }, orderBy: { sentAt: 'asc' } },
    },
  });

  if (!message) {
    res.status(404).json({ error: 'Message not found' });
    return;
  }

  // Mark as read
  if (!message.read) {
    await prisma.contactMessage.update({ where: { id: messageId }, data: { read: true } });
  }

  res.json({
    ...message,
    name: decrypt(message.nameEnc),
    email: decrypt(message.emailEnc),
    nameEnc: undefined,
    emailEnc: undefined,
    read: true,
  });
});

// POST /stores/:storeId/messages/:messageId/reply
router.post('/:storeId/messages/:messageId/reply', requireStoreAdmin, async (req: Request, res: Response): Promise<void> => {
  const storeId = req.params.storeId as string;
  const messageId = req.params.messageId as string;
  const { body } = req.body as { body: string };

  if (!body?.trim()) {
    res.status(400).json({ error: 'Reply body required' });
    return;
  }

  const message = await prisma.contactMessage.findFirst({ where: { id: messageId, storeId } });
  if (!message) {
    res.status(404).json({ error: 'Message not found' });
    return;
  }

  const reply = await prisma.messageReply.create({
    data: {
      messageId,
      userId: req.user!.sub,
      body: body.trim(),
    },
    include: { user: { select: { name: true, avatarUrl: true } } },
  });

  res.status(201).json(reply);
});

export default router;
