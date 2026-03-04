/**
 * Gemini AI Service
 *
 * Powers the store chat widget with:
 * - Full product catalog context
 * - Store policies (shipping, returns, contact info)
 * - Action capabilities: product search, cart recommendations, event planning
 * - Safety guardrails to keep conversations on-topic
 */

import { GoogleGenerativeAI, GenerativeModel, ChatSession } from '@google/generative-ai';
import { config } from '../config';
import { prisma } from '../db';
import { logger } from '../utils/logger';

let genAI: GoogleGenerativeAI | null = null;

const promptCache = new Map<string, { prompt: string; expiresAt: number }>();

function getGenAI(apiKey?: string): GoogleGenerativeAI {
  const key = apiKey || config.gemini.apiKey;
  if (!key) throw new Error('Gemini API key not configured');
  // Create new instance if using per-store key
  if (apiKey && apiKey !== config.gemini.apiKey) {
    return new GoogleGenerativeAI(apiKey);
  }
  if (!genAI) genAI = new GoogleGenerativeAI(key);
  return genAI;
}

/**
 * Build the system prompt with full store context.
 */
async function buildSystemPrompt(storeId: string): Promise<string> {
  const cached = promptCache.get(storeId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.prompt;
  }

  const [store, products] = await Promise.all([
    prisma.store.findUnique({
      where: { id: storeId },
      include: { settings: true },
    }),
    prisma.product.findMany({
      where: { storeId, active: true },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        comparePrice: true,
        stock: true,
        category: true,
        tags: true,
      },
      take: 200, // Cap context size
    }),
  ]);

  if (!store) throw new Error('Store not found');

  const productList = products
    .map(
      (p) =>
        `- ${p.name} (ID: ${p.id}): $${Number(p.price)} | ${p.stock > 0 ? `In stock (${p.stock})` : 'Out of stock'} | ${p.category ?? 'Uncategorized'} | Tags: ${p.tags.join(', ')}`
    )
    .join('\n');

  const prompt = `You are a knowledgeable, friendly shopping assistant for ${store.name}.

## About This Store
${store.description ?? 'A wonderful online store.'}

## Store Policies
- **Shipping**: ${store.settings?.shippingPolicy ?? 'Standard shipping available. Contact us for details.'}
- **Returns**: ${store.settings?.returnPolicy ?? '30-day returns on most items.'}
- **Contact**: ${store.settings?.contactEmail ?? 'Contact us via the Contact page.'}
- **Currency**: ${store.settings?.currency ?? 'USD'}

## Available Products (${products.length} items)
${productList}

## Your Capabilities
You can help customers:
1. **Find products** - Search by name, category, price range, or occasion
2. **Event planning** - When a customer asks "What do I need for X event?", curate a complete product list with reasoning
3. **Product details** - Answer questions about any product in the catalog
4. **Cart guidance** - Suggest add-to-cart actions with product IDs
5. **Policies** - Explain shipping, returns, and store policies
6. **Support** - Help troubleshoot orders or direct to contact page

## Action Format
When you want to trigger a frontend action, include a JSON block at the END of your message (not inline):
\`\`\`action
{"type": "SHOW_PRODUCTS", "productIds": ["id1", "id2", "id3"]}
\`\`\`

Available action types:
- \`SHOW_PRODUCTS\` - Display product cards: \`{"type": "SHOW_PRODUCTS", "productIds": [...]}\`
- \`ADD_TO_CART\` - Add a product: \`{"type": "ADD_TO_CART", "productId": "...", "quantity": 1}\`
- \`GO_TO_PAGE\` - Navigate: \`{"type": "GO_TO_PAGE", "page": "products|cart|contact"}\`
- \`SHOW_CATEGORY\` - Filter category: \`{"type": "SHOW_CATEGORY", "category": "..."}\`

## Guidelines
- Always be helpful, accurate, and concise
- Only recommend products that exist in the catalog
- If a product is out of stock, say so and suggest alternatives
- For event planning ("I need supplies for a birthday party"), think holistically about all relevant products
- Don't discuss competitors or topics unrelated to this store
- If you can't help with something, direct them to the contact page
- Keep responses under 300 words unless giving a detailed product list`;

  promptCache.set(storeId, { prompt, expiresAt: Date.now() + 5 * 60 * 1000 });
  return prompt;
}

export interface ChatTurn {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

export interface ChatResult {
  text: string;
  action: Record<string, unknown> | null;
}

export interface AudioPayload {
  data: string;
  mimeType: string;
}

/**
 * Process a chat message and return AI response.
 */
export async function processChat(
  storeId: string,
  userMessage: string,
  history: ChatTurn[],
  storeGeminiKey?: string,
  audioPayload?: AudioPayload
): Promise<ChatResult> {
  try {
    const ai = getGenAI(storeGeminiKey);
    const systemPrompt = await buildSystemPrompt(storeId);

    const model: GenerativeModel = ai.getGenerativeModel({
      model: config.gemini.model,
      systemInstruction: systemPrompt,
      generationConfig: {
        temperature: 0.7,
        topP: 0.8,
        maxOutputTokens: 1024,
      },
    });

    const chat: ChatSession = model.startChat({
      history: history.slice(-20), // Keep last 20 turns for context
    });

    const requestParts: any[] = [];
    if (userMessage) {
      requestParts.push(userMessage);
    } else if (audioPayload) {
      requestParts.push("Please listen to this audio message from the user and respond accordingly as the shopping assistant.");
    }

    if (audioPayload) {
      requestParts.push({
        inlineData: {
          data: audioPayload.data,
          mimeType: audioPayload.mimeType,
        },
      });
    }

    const result = await chat.sendMessage(requestParts);
    const responseText = result.response.text();

    // Parse action block if present
    let action: Record<string, unknown> | null = null;
    const actionMatch = responseText.match(/```action\n([\s\S]*?)\n```/);
    if (actionMatch) {
      try {
        action = JSON.parse(actionMatch[1]);
      } catch {
        logger.warn('Failed to parse chat action block', { raw: actionMatch[1] });
      }
    }

    // Clean action block from displayed text
    const cleanText = responseText.replace(/```action\n[\s\S]*?\n```/g, '').trim();

    return { text: cleanText, action };
  } catch (err) {
    logger.error('Gemini chat error', { error: err, storeId });
    return {
      text: "I'm sorry, I'm having trouble connecting right now. Please try again in a moment or contact our support team.",
      action: null,
    };
  }
}

/**
 * Generate product recommendations for an event.
 * Returns structured recommendations with reasoning.
 */
export async function getEventRecommendations(
  storeId: string,
  event: string,
  budget?: number,
  storeGeminiKey?: string
): Promise<{
  products: Array<{ id: string; name: string; reason: string }>;
  summary: string;
}> {
  const products = await prisma.product.findMany({
    where: { storeId, active: true, stock: { gt: 0 } },
    select: { id: true, name: true, description: true, price: true, category: true, tags: true },
    take: 200,
  });

  const ai = getGenAI(storeGeminiKey);
  const model = ai.getGenerativeModel({ model: config.gemini.model });

  const prompt = `You are a shopping assistant. A customer is planning: "${event}"${budget ? ` with a budget of $${budget}` : ''}.

Available products:
${products.map(
    (p) => `ID: ${p.id} | ${p.name} | ${Number(p.price)} | ${p.category} | ${p.tags.join(', ')}`).join('\n')}

Select the most relevant products for this event. Return ONLY valid JSON:
{
  "products": [
    {"id": "product_id", "name": "product name", "reason": "why this is needed for the event"}
  ],
  "summary": "Brief overview of the selection"
}

Guidelines:
- Only include products that are genuinely useful for the event
- Aim for 3-8 products
- Consider variety (don't pick 5 similar items)
${budget ? `- Stay within the $${budget} total budget` : ''}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (err) {
    logger.error('Event recommendation error', { error: err });
  }

  return {
    products: [],
    summary: "I couldn't generate recommendations. Please browse our products directly.",
  };
}
