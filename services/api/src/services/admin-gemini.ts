import { GoogleGenerativeAI, GenerativeModel, ChatSession } from '@google/generative-ai';
import { prisma } from '../db';
import { config } from '../config';
import { logger } from '../utils/logger';

let genAI: GoogleGenerativeAI | null = null;

function getGenAI(apiKey?: string): GoogleGenerativeAI {
    const key = apiKey || config.gemini.apiKey;
    if (!key) throw new Error('Gemini API key not configured');
    if (apiKey && apiKey !== config.gemini.apiKey) {
        return new GoogleGenerativeAI(apiKey);
    }
    if (!genAI) genAI = new GoogleGenerativeAI(key);
    return genAI;
}

export interface AdminChatTurn {
    role: 'user' | 'model';
    parts: Array<{ text: string }>;
}

export interface AdminChatResult {
    text: string;
    action: Record<string, unknown> | null;
}

/**
 * Build the system prompt with full admin store context.
 */
async function buildAdminSystemPrompt(storeId: string): Promise<string> {
    // Fetch store and settings
    const store = await prisma.store.findUnique({
        where: { id: storeId },
        include: { settings: true },
    });

    if (!store) {
        throw new Error('Store not found');
    }

    // Fetch total revenue (exclude cancelled/refunded)
    const revenueResult = await prisma.order.aggregate({
        where: {
            storeId,
            status: { notIn: ['CANCELLED', 'REFUNDED'] },
        },
        _sum: { total: true },
    });
    const totalRevenue = revenueResult._sum.total?.toNumber() || 0;

    // Fetch recent 5 orders
    const recentOrders = await prisma.order.findMany({
        where: { storeId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
            orderNumber: true,
            status: true,
            total: true,
            currency: true,
            createdAt: true,
        },
    });

    // Fetch low-stock products (stock < 5)
    const lowStockProducts = await prisma.product.findMany({
        where: {
            storeId,
            trackStock: true,
            stock: { lt: 5 },
            active: true,
        },
        select: {
            id: true,
            name: true,
            stock: true,
            price: true,
            category: true,
        },
        take: 20, // Limit to 20 for prompt size safety
    });

    const currency = store.settings?.currency ?? 'USD';

    const ordersText = recentOrders.length > 0
        ? recentOrders.map((o) => `- ${o.orderNumber}: ${Number(o.total)} ${o.currency} (${o.status}) on ${o.createdAt.toLocaleDateString()}`).join('\n')
        : 'No recent orders.';

    const lowStockText = lowStockProducts.length > 0
        ? lowStockProducts.map((p) => `- ${p.name} (ID: ${p.id}): ${p.stock} left | ${p.category ?? 'Uncategorized'}`).join('\n')
        : 'No low-stock products.';

    const prompt = `You are an expert "Store Co-Pilot", an administrative AI assistant for the owner of the store "${store.name}".
Your job is to assist the store owner with managing their store, analyzing data, and navigating the admin dashboard.

## Store Context
- Store Name: ${store.name}
- Total Revenue: $${totalRevenue.toFixed(2)} ${currency}
- Currency: ${currency}

## Recent Operations
### 5 Most Recent Orders
${ordersText}

### Low-Stock Products (Action Required)
${lowStockText}

## Your Capabilities
You can answer questions about the store's performance, orders, and inventory.
You can also perform actions in the admin dashboard on behalf of the user by outputting a JSON block.

## Action Format
When you want to trigger a frontend action in the admin dashboard, include a JSON block at the END of your message ONLY, formatted like this:
\`\`\`action
{"type": "NAVIGATE", "path": "/products"}
\`\`\`
Or like this for suggesting descriptions:
\`\`\`action
{"type": "SUGGEST_DESCRIPTION", "newText": "..."}
\`\`\`

Available action types:
- \`NAVIGATE\` - Navigate to an admin page: \`{"type": "NAVIGATE", "path": "/orders|/products|/settings"}\`
- \`SUGGEST_DESCRIPTION\` - Suggest a description for a product or store: \`{"type": "SUGGEST_DESCRIPTION", "newText": "..."}\`
- \`SHOW_ORDER\` - Open an order's details: \`{"type": "SHOW_ORDER", "orderNumber": "..."}\`
- \`EDIT_PRODUCT\` - Open a product to edit: \`{"type": "EDIT_PRODUCT", "productId": "..."}\`

## Guidelines
- Be concise, professional, and helpful.
- Direct the user to actionable insights based on the context provided.
- If the owner asks to navigate somewhere, use the \`NAVIGATE\` action.
- Only output ONE action block per response, at the very end.
- Use the data provided above to answer questions. If asked about something not covered above, indicate that you don't have access to that specific data.`;

    return prompt;
}

/**
 * Process an admin chat message.
 */
export async function processAdminChat(
    storeId: string,
    userMessage: string,
    history: AdminChatTurn[],
    storeGeminiKey?: string
): Promise<AdminChatResult> {
    try {
        const ai = getGenAI(storeGeminiKey);
        const systemPrompt = await buildAdminSystemPrompt(storeId);

        const model: GenerativeModel = ai.getGenerativeModel({
            model: config.gemini.model,
            systemInstruction: systemPrompt,
            generationConfig: {
                temperature: 0.4, // slightly lower temp for admin tasks to be more precise
                topP: 0.8,
                maxOutputTokens: 1024,
            },
        });

        const chat: ChatSession = model.startChat({
            history: history.slice(-20),
        });

        const result = await chat.sendMessage(userMessage);
        const responseText = result.response.text();

        // Parse action block if present
        let action: Record<string, unknown> | null = null;
        const actionMatch = responseText.match(/```action\n([\s\S]*?)\n```/);
        if (actionMatch) {
            try {
                action = JSON.parse(actionMatch[1]);
            } catch {
                logger.warn('Failed to parse admin chat action block', { raw: actionMatch[1] });
            }
        }

        // Clean action block from displayed text
        const cleanText = responseText.replace(/```action\n[\s\S]*?\n```/g, '').trim();

        return { text: cleanText, action };
    } catch (err) {
        logger.error('Gemini admin chat error', { error: err, storeId });
        return {
            text: "I'm sorry, I'm having trouble retrieving store data right now. Please try again later.",
            action: null,
        };
    }
}
