import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { encrypt, decrypt, encryptJson, decryptJson } from './encryption';
import { logger } from '../utils/logger';
import { recordMetric } from './anomaly';
import { NotFoundError, InsufficientStockError } from '../errors';
import { JwtPayload } from '../middleware/auth';

interface OrderItem {
  productId: string;
  quantity: number;
  variantInfo?: unknown;
}

interface CreateOrderData {
  storeId: string;
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
  shippingAddress: Record<string, unknown>;
  items: OrderItem[];
  notes?: string;
  paymentTerms?: string;
}

export const OrderService = {
    async createOrder(storeId: string, data: CreateOrderData, user: JwtPayload | undefined) {
        let companyId: string | null = null;
        let pricesOverride: Record<string, string | number> = {};

        if (user && user.type === 'USER') {
            const dbUser = await prisma.user.findUnique({
                where: { id: user.sub },
                include: { company: { include: { priceList: true } } },
            });
            if (dbUser?.companyId) {
                companyId = dbUser.companyId;
                if (dbUser.company?.priceList) {
                    pricesOverride = (dbUser.company.priceList.prices as Record<string, string | number>) || {};
                }
            }
        }

        // Validate all products exist and have sufficient stock
        const products = await prisma.product.findMany({
            where: {
                id: { in: data.items.map((i: any) => i.productId) },
                storeId: storeId,
                active: true,
            },
        });

        const productMap = new Map((products as any[]).map((p) => [p.id, p]));
        for (const item of data.items) {
            const product = productMap.get(item.productId);
            if (!product) {
                throw new NotFoundError(`Product ${item.productId} not found`);
            }
            if (product.trackStock && product.stock < item.quantity) {
                throw new InsufficientStockError(`Insufficient stock for ${product.name}`);
            }
        }

        // Calculate totals
        const settings = await prisma.storeSettings.findUnique({ where: { storeId: storeId } });
        const taxRate = settings?.taxRate ?? 0;
        const flatShipping = settings?.flatShippingRate ?? 0;
        const freeShippingAbove = settings?.freeShippingAbove;

        let subtotal = 0;
        for (const item of data.items) {
            const product = productMap.get(item.productId)!;
            const override = pricesOverride[item.productId];
            const effectivePrice = override ? Number(override) : Number(product.price);
            subtotal += effectivePrice * item.quantity;
        }

        const tax = subtotal * (taxRate / 100);
        const shipping = freeShippingAbove && subtotal >= freeShippingAbove ? 0 : flatShipping;
        const total = subtotal + tax + shipping;

        // Encrypt PII — create order first, then derive unique order number from its CUID
        const order = await prisma.order.create({
            data: {
                storeId: storeId,
                orderNumber: 'PENDING',
                customerEmailEnc: encrypt(data.customerEmail),
                customerNameEnc: encrypt(data.customerName),
                customerPhoneEnc: data.customerPhone ? encrypt(data.customerPhone) : null,
                shippingAddrEnc: encryptJson(data.shippingAddress as Record<string, unknown>),
                subtotal,
                tax,
                shipping,
                total,
                notes: data.notes,
                companyId,
                paymentTerms: companyId ? data.paymentTerms : null,
                items: {
                    create: data.items.map((item: any) => {
                        const product = productMap.get(item.productId)!;
                        const override = pricesOverride[item.productId];
                        const effectivePrice = override ? Number(override) : Number(product.price);
                        return {
                            product: { connect: { id: item.productId } },
                            productName: product.name,
                            quantity: item.quantity,
                            price: effectivePrice,
                            variantInfo: item.variantInfo ?? null,
                        };
                    }),
                },
            },
            include: { items: { include: { product: { select: { name: true, images: true } } } } },
        });

        // Derive collision-free order number from the order's own CUID
        const orderNumber = `ORD-${new Date().getFullYear()}-${order.id.slice(-6).toUpperCase()}`;
        await prisma.order.update({ where: { id: order.id }, data: { orderNumber } });

        // Decrement stock
        await Promise.all(
            data.items.map((item: any) => {
                const product = productMap.get(item.productId)!;
                if (!product.trackStock) return Promise.resolve();
                return prisma.product.update({
                    where: { id: item.productId },
                    data: { stock: { decrement: item.quantity } },
                });
            })
        );

        // Record metric
        await recordMetric('order_count', 1, storeId);

        // Return order WITHOUT PII (only orderNumber and total for confirmation)
        const orderToReturn = order as any;
        return {
            id: orderToReturn.id,
            orderNumber,
            status: orderToReturn.status,
            subtotal: orderToReturn.subtotal,
            tax: orderToReturn.tax,
            shipping: orderToReturn.shipping,
            total: orderToReturn.total,
            items: orderToReturn.items,
        };
    },

    async listOrders(storeId: string, status?: string, limit: string = '20', offset: string = '0') {
        const where: Record<string, unknown> = { storeId };
        if (status) where.status = status;

        const [orders, total] = await Promise.all([
            prisma.order.findMany({
                where: where as any,
                orderBy: { createdAt: 'desc' },
                take: parseInt(limit as string),
                skip: parseInt(offset as string),
                include: { items: true },
            }),
            prisma.order.count({ where: where as any }),
        ]);

        // Decrypt PII for store admin
        const decrypted = (orders as any[]).map((o) => ({
            ...o,
            customerEmail: decrypt(o.customerEmailEnc),
            customerName: decrypt(o.customerNameEnc),
            customerPhone: o.customerPhoneEnc ? decrypt(o.customerPhoneEnc) : null,
            shippingAddress: decryptJson(o.shippingAddrEnc),
            // Remove encrypted fields from response
            customerEmailEnc: undefined,
            customerNameEnc: undefined,
            customerPhoneEnc: undefined,
            shippingAddrEnc: undefined,
        }));

        return { orders: decrypted, total };
    },

    async getOrderById(storeId: string, orderId: string) {
        const order = await prisma.order.findFirst({
            where: { id: orderId, storeId },
            include: { items: { include: { product: { select: { name: true, images: true, sku: true } } } } },
        });

        if (!order) {
            throw new NotFoundError('Order not found');
        }

        return {
            ...order,
            customerEmail: decrypt((order as any).customerEmailEnc),
            customerName: decrypt((order as any).customerNameEnc),
            customerPhone: (order as any).customerPhoneEnc ? decrypt((order as any).customerPhoneEnc) : null,
            shippingAddress: decryptJson((order as any).shippingAddrEnc),
            customerEmailEnc: undefined,
            customerNameEnc: undefined,
            customerPhoneEnc: undefined,
            shippingAddrEnc: undefined,
        };
    },

    async updateOrderStatus(storeId: string, orderId: string, status: string, trackingNumber?: string) {
        const order = await prisma.order.findFirst({ where: { id: orderId, storeId } });
        if (!order) {
            throw new NotFoundError('Order not found');
        }

        const updates: Record<string, unknown> = { status };
        if (trackingNumber) updates.trackingNumber = trackingNumber;
        if (status === 'SHIPPED') updates.shippedAt = new Date();
        if (status === 'DELIVERED') updates.deliveredAt = new Date();

        const updated = await prisma.order.update({ where: { id: orderId }, data: updates });
        return { id: updated.id, status: updated.status, trackingNumber: updated.trackingNumber };
    }
};
