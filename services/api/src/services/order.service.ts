import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { encrypt, decrypt, encryptJson, decryptJson } from './encryption';
import { logger } from '../utils/logger';
import { recordMetric } from './anomaly';
import { NotFoundError, InsufficientStockError } from '../errors';
import { JwtPayload } from '../middleware/auth';
import { PaymentService } from './payment';
import { discountService, Cart } from './discount';
import { webhookDispatcher } from './webhook.dispatcher';
import { taxService } from './tax';
import { Address } from './shipping';
interface OrderItemInput {
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
    items: OrderItemInput[];
    notes?: string;
    paymentTerms?: string;
    providedCodes?: string[];
    shippingCost?: number;
    carrier?: string;
    shippingService?: string;
}

export const OrderService = {
    async createOrder(storeId: string, data: CreateOrderData, user: JwtPayload | undefined) {
        let companyId: string | null = null;
        let pricesOverride: Record<string, string | number> = {};

        let userTags: string[] = [];
        if (user && user.type === 'USER') {
            const dbUser = await prisma.user.findUnique({
                where: { id: user.sub || (user as any).userId },
                include: { company: { include: { priceList: true } } },
            });
            if (dbUser?.companyId) {
                companyId = dbUser.companyId;
                if (dbUser.company?.priceList) {
                    pricesOverride = (dbUser.company.priceList.prices as Record<string, string | number>) || {};
                }
            }
            if (dbUser?.tags) {
                userTags = dbUser.tags;
            }
        }

        // Validate all products exist
        const products = await prisma.product.findMany({
            where: {
                id: { in: data.items.map((i) => i.productId) },
                storeId: storeId,
                active: true,
            },
        });

        const productMap = new Map((products as any[]).map((p) => [p.id, p]));

        // Determine fulfillment plan based on priority and availability
        const fulfillmentPlan: { productId: string; locationId: string | null; quantity: number }[] = [];

        for (const item of data.items) {
            const product = productMap.get(item.productId);
            if (!product) {
                throw new NotFoundError(`Product ${item.productId} not found`);
            }

            if (!product.trackStock) {
                fulfillmentPlan.push({ productId: item.productId, locationId: null, quantity: item.quantity });
                continue;
            }

            // Fetch active locations for this store ordered by priority DESC
            const locations = await prisma.location.findMany({
                where: { storeId, active: true },
                include: { stocks: { where: { productId: product.id } } },
                orderBy: { priority: 'desc' },
            });

            let remaining = item.quantity;
            for (const loc of locations) {
                if (remaining <= 0) break;
                const available = loc.stocks[0]?.quantity || 0;
                if (available > 0) {
                    const take = Math.min(remaining, available);
                    fulfillmentPlan.push({ productId: item.productId, locationId: loc.id, quantity: take });
                    remaining -= take;
                }
            }

            if (remaining > 0) {
                const totalStock = locations.reduce((sum: number, l: any) => sum + (l.stocks[0]?.quantity || 0), 0);
                throw new InsufficientStockError(
                    `Insufficient stock for ${product.name}. Requested ${item.quantity}, but only ${totalStock} available across all locations.`
                );
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

        // Calculate discounts
        const cart: Cart = {
            items: data.items.map((item) => {
                const product = productMap.get(item.productId)!;
                const override = pricesOverride[item.productId];
                const price = override ? Number(override) : Number(product.price);
                return { productId: item.productId, quantity: item.quantity, price };
            }),
            subtotal,
        };

        const providedCodes = data.providedCodes || [];
        const appliedDiscounts = await discountService.calculateBestDiscounts(storeId, cart, userTags, providedCodes);
        const totalDiscount = appliedDiscounts.reduce((sum, d) => sum + d.amount, 0);
        const discountedSubtotal = Math.max(0, subtotal - totalDiscount);

        const taxResult = await taxService.calculateTax(
            storeId,
            data.shippingAddress as unknown as Address,
            discountedSubtotal
        );
        const tax = taxResult.amount;

        let shipping = freeShippingAbove && discountedSubtotal >= freeShippingAbove ? 0 : flatShipping;
        if (data.shippingCost !== undefined && data.shippingCost !== null) {
            shipping = data.shippingCost;
        }

        const total = discountedSubtotal + tax + shipping;

        // Group fulfillment units by vendor (one unit per location split)
        const vendorGroups = new Map<string | null, any[]>();
        for (const unit of fulfillmentPlan) {
            const product = productMap.get(unit.productId)!;
            const vId = product.vendorId || null;
            if (!vendorGroups.has(vId)) vendorGroups.set(vId, []);
            vendorGroups.get(vId)!.push(unit);
        }

        const isSplit = vendorGroups.size > 1;

        // Wrap order creation and stock deduction in a transaction
        return await prisma.$transaction(async (tx) => {
            // Create parent order
            const order = await tx.order.create({
                data: {
                    storeId: storeId,
                    orderNumber: 'PENDING',
                    customerEmailEnc: encrypt(data.customerEmail),
                    customerNameEnc: encrypt(data.customerName),
                    customerPhoneEnc: data.customerPhone ? encrypt(data.customerPhone) : null,
                    shippingAddrEnc: encryptJson(data.shippingAddress as Record<string, unknown>),
                    subtotal,
                    totalDiscount,
                    appliedDiscounts: appliedDiscounts as any,
                    tax,
                    shipping,
                    carrier: data.carrier || null,
                    shippingService: data.shippingService || null,
                    total,
                    notes: data.notes,
                    companyId,
                    paymentTerms: companyId ? data.paymentTerms : null,
                    items: {
                        create: fulfillmentPlan.map((unit) => {
                            const product = productMap.get(unit.productId)!;
                            const override = pricesOverride[unit.productId];
                            const effectivePrice = override ? Number(override) : Number(product.price);

                            // Pro-rate discount if item is split across locations
                            const originalItem = data.items.find((i) => i.productId === unit.productId)!;
                            const lineDiscount = appliedDiscounts.find((d) => d.affectedProductId === unit.productId);
                            const unitDiscount = lineDiscount
                                ? (Number(lineDiscount.amount) * unit.quantity) / originalItem.quantity
                                : 0;

                            return {
                                product: { connect: { id: unit.productId } },
                                productName: product.name,
                                quantity: unit.quantity,
                                price: effectivePrice,
                                discountAmount: unitDiscount,
                                discountRuleId: lineDiscount ? lineDiscount.ruleId : null,
                                variantInfo: (originalItem.variantInfo as any) ?? null,
                                vendorId: product.vendorId || null,
                                locationId: unit.locationId,
                            };
                        }),
                    },
                },
                include: { items: { include: { product: { select: { name: true, images: true } } } } },
            });

            const orderNumber = `ORD-${new Date().getFullYear()}-${order.id.slice(-6).toUpperCase()}`;
            await tx.order.update({ where: { id: order.id }, data: { orderNumber } });

            // Create sub-orders if split
            if (isSplit) {
                const payoutItems = [];
                const vendorIds = Array.from(vendorGroups.keys()).filter(Boolean) as string[];
                const vendors = await tx.vendor.findMany({ where: { id: { in: vendorIds } } });
                const vendorMap = new Map(vendors.map((v) => [v.id, v]));

                for (const [vId, groupUnits] of vendorGroups.entries()) {
                    let groupSubtotal = 0;
                    for (const unit of groupUnits) {
                        const product = productMap.get(unit.productId)!;
                        const override = pricesOverride[unit.productId];
                        const effPrice = override ? Number(override) : Number(product.price);
                        groupSubtotal += effPrice * unit.quantity;
                    }
                    const groupTax = groupSubtotal * (taxRate / 100);
                    const groupShipping = 0;
                    const groupTotal = groupSubtotal + groupTax + groupShipping;

                    const subOrder = await tx.order.create({
                        data: {
                            storeId,
                            parentOrderId: order.id,
                            vendorId: vId,
                            orderNumber: 'PENDING',
                            customerEmailEnc: order.customerEmailEnc,
                            customerNameEnc: order.customerNameEnc,
                            customerPhoneEnc: order.customerPhoneEnc,
                            shippingAddrEnc: order.shippingAddrEnc,
                            subtotal: groupSubtotal,
                            tax: groupTax,
                            shipping: groupShipping,
                            carrier: data.carrier || null,
                            shippingService: data.shippingService || null,
                            total: groupTotal,
                            notes: data.notes,
                            companyId,
                            paymentTerms: companyId ? data.paymentTerms : null,
                            items: {
                                create: groupUnits.map((unit: any) => {
                                    const product = productMap.get(unit.productId)!;
                                    const override = pricesOverride[unit.productId];
                                    const effPrice = override ? Number(override) : Number(product.price);
                                    return {
                                        product: { connect: { id: unit.productId } },
                                        productName: product.name,
                                        quantity: unit.quantity,
                                        price: effPrice,
                                        variantInfo: (data.items.find((i) => i.productId === unit.productId)?.variantInfo as any) ?? null,
                                        vendorId: vId,
                                        locationId: unit.locationId,
                                    };
                                }),
                            },
                        },
                    });

                    const subOrderNumber = `ORD-${new Date().getFullYear()}-${subOrder.id.slice(-6).toUpperCase()}`;
                    await tx.order.update({ where: { id: subOrder.id }, data: { orderNumber: subOrderNumber } });

                    if (vId) {
                        const vendor = vendorMap.get(vId);
                        if (vendor && vendor.payoutEnabled && vendor.stripeAccountIdEnc) {
                            payoutItems.push({
                                vendorStripeAccountId: decrypt(vendor.stripeAccountIdEnc),
                                amount: Math.round(groupTotal * 100),
                                currency: settings?.currency || 'usd',
                            });
                        }
                    }
                }

                if (payoutItems.length > 0) {
                    await PaymentService.processSplitPayout(payoutItems);
                }
            } else {
                // single vendor update
                const vId = Array.from(vendorGroups.keys())[0];
                if (vId) {
                    await tx.order.update({ where: { id: order.id }, data: { vendorId: vId } });
                    const vendor = await tx.vendor.findUnique({ where: { id: vId } });
                    if (vendor && vendor.payoutEnabled && vendor.stripeAccountIdEnc) {
                        await PaymentService.processSplitPayout([
                            {
                                vendorStripeAccountId: decrypt(vendor.stripeAccountIdEnc),
                                amount: Math.round(total * 100),
                                currency: settings?.currency || 'usd',
                            },
                        ]);
                    }
                }
            }

            // Deduct stock from locations and update product summary
            for (const unit of fulfillmentPlan) {
                const product = productMap.get(unit.productId)!;
                if (!product.trackStock || !unit.locationId) continue;

                await tx.stock.update({
                    where: { productId_locationId: { productId: unit.productId, locationId: unit.locationId } },
                    data: { quantity: { decrement: unit.quantity } },
                });

                await tx.product.update({
                    where: { id: unit.productId },
                    data: { stock: { decrement: unit.quantity } },
                });
            }

            // Record metrics
            for (const item of data.items) {
                await recordMetric(`product_sales:${item.productId}`, item.quantity, storeId, {
                    productId: item.productId,
                });
            }
            await recordMetric('order_count', 1, storeId);

            const finalOrder = {
                id: order.id,
                orderNumber,
                status: order.status,
                subtotal: order.subtotal,
                tax: order.tax,
                shipping: order.shipping,
                total: order.total,
                items: order.items,
            };

            webhookDispatcher.dispatch({ topic: 'order.created', storeId, payload: finalOrder });

            return finalOrder;
        });
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
        const result = { id: updated.id, status: updated.status, trackingNumber: updated.trackingNumber };

        webhookDispatcher.dispatch({ topic: 'order.updated', storeId, payload: result });

        return result;
    }
};
