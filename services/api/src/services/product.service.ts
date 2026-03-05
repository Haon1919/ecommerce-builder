import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { logger } from '../utils/logger';
import { NotFoundError } from '../errors';
import { JwtPayload } from '../middleware/auth';

export const ProductService = {
    async listProducts(params: { storeId: string, category?: any, search?: any, featured?: any, limit?: string, offset?: string, sort?: string, user?: any }) {
        const { storeId, category, search, featured, limit = '20', offset = '0', sort = 'createdAt', user } = params;
        const where: Record<string, unknown> = {
            storeId,
            active: true,
        };

        if (category) where.category = category;
        if (featured === 'true') where.featured = true;
        if (search) {
            where.OR = [
                { name: { contains: search as string, mode: 'insensitive' } },
                { description: { contains: search as string, mode: 'insensitive' } },
                { tags: { has: search as string } },
            ];
        }

        const [products, total] = await Promise.all([
            prisma.product.findMany({
                where: where as any,
                orderBy: { [sort as string]: 'desc' },
                take: Math.min(parseInt(limit as string), 100),
                skip: parseInt(offset as string),
                select: {
                    id: true, name: true, description: true, price: true, comparePrice: true,
                    stock: true, category: true, tags: true, images: true, variants: true,
                    modelUrl: true, arEnabled: true,
                    featured: true, trackStock: true,
                },
            }),
            prisma.product.count({ where: where as any }),
        ]);

        // Get categories
        const categories = await prisma.product.findMany({
            where: { storeId, active: true, category: { not: null } },
            select: { category: true },
            distinct: ['category'],
        });

        let modifiedProducts = products;
        if (user && user.type === 'USER') {
            const dbUser = await prisma.user.findUnique({
                where: { id: user.sub },
                include: { company: { include: { priceList: true } } },
            });
            if (dbUser?.company?.priceList) {
                const pricesOverride = (dbUser.company.priceList.prices as Record<string, string | number>) || {};
                modifiedProducts = products.map((p: any) => {
                    const override = pricesOverride[p.id];
                    if (override !== undefined) {
                        return { ...p, price: Number(override) as any };
                    }
                    return p;
                });
            }
        }

        return {
            products: modifiedProducts,
            total,
            categories: categories.map((c: { category: string | null }) => c.category).filter(Boolean),
        };
    },

    async getProductById(storeId: string, productId: string, user?: JwtPayload) {
        const product = await prisma.product.findFirst({
            where: { id: productId, storeId, active: true },
        });

        if (!product) {
            throw new NotFoundError('Product not found');
        }

        let modifiedProduct = product;
        if (user && user.type === 'USER') {
            const dbUser = await prisma.user.findUnique({
                where: { id: user.sub },
                include: { company: { include: { priceList: true } } },
            });
            if (dbUser?.company?.priceList) {
                const pricesOverride = (dbUser.company.priceList.prices as Record<string, string | number>) || {};
                const override = pricesOverride[product.id];
                if (override !== undefined) {
                    modifiedProduct = { ...product, price: Number(override) } as any;
                }
            }
        }

        return modifiedProduct;
    },

    async createProduct(storeId: string, data: any) {
        return await prisma.product.create({
            data: { ...data, storeId, price: data.price, comparePrice: data.comparePrice },
        });
    },

    async updateProduct(storeId: string, productId: string, data: any) {
        const existing = await prisma.product.findFirst({ where: { id: productId, storeId } });
        if (!existing) {
            throw new NotFoundError('Product not found');
        }

        return await prisma.product.update({
            where: { id: productId },
            data,
        });
    },

    async deleteProduct(storeId: string, productId: string) {
        const existing = await prisma.product.findFirst({ where: { id: productId, storeId } });
        if (!existing) {
            throw new NotFoundError('Product not found');
        }

        await prisma.product.update({ where: { id: productId }, data: { active: false } });
        return { success: true };
    },

    async generate3dModel(storeId: string, productId: string) {
        const product = await prisma.product.findFirst({ where: { id: productId, storeId } });
        if (!product) {
            throw new NotFoundError('Product not found');
        }

        if (!product.images || product.images.length === 0) {
            throw new Error('Product must have at least one image to generate a 3D model');
        }

        logger.info(`Starting 3D generation for product ${productId}`);

        setTimeout(async () => {
            try {
                const mockModelUrl = 'https://modelviewer.dev/shared-assets/models/Astronaut.glb';
                await prisma.product.update({
                    where: { id: productId },
                    data: {
                        modelUrl: mockModelUrl,
                        arEnabled: true,
                    },
                });
                logger.info(`Completed 3D generation for product ${productId}`);
            } catch (err) {
                logger.error(`Failed to generate 3D model for product ${productId}`, { error: err });
            }
        }, 5000);

        return { message: '3D generation started' };
    },

    async batchGetProducts(storeId: string, ids: string[], user?: JwtPayload) {
        const products = await prisma.product.findMany({
            where: { id: { in: ids }, storeId, active: true },
            select: {
                id: true, name: true, description: true, price: true, comparePrice: true,
                stock: true, category: true, tags: true, images: true,
                modelUrl: true, arEnabled: true, featured: true, trackStock: true,
            },
        });

        if (user && user.type === 'USER') {
            const dbUser = await prisma.user.findUnique({
                where: { id: user.sub },
                include: { company: { include: { priceList: true } } },
            });
            if (dbUser?.company?.priceList) {
                const pricesOverride = (dbUser.company.priceList.prices as Record<string, string | number>) || {};
                return products.map((p: any) => {
                    const override = pricesOverride[p.id];
                    if (override !== undefined) return { ...p, price: Number(override) as any };
                    return p;
                });
            }
        }

        return products;
    },

    async bulkImportProducts(storeId: string, validatedProducts: any[]) {
        const created = await prisma.product.createMany({
            data: validatedProducts.map((p) => ({ ...p, storeId })),
        });

        return {
            created: created.count,
        };
    }
};
