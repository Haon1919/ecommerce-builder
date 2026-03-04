import { ProductService } from './product.service';
import { prisma } from '../db';
import { NotFoundError } from '../errors';

jest.mock('../db', () => ({
  prisma: {
    product: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      createMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const mockPrisma = prisma as any;

describe('ProductService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listProducts', () => {
    it('returns products, total, and categories with default params', async () => {
      const mockProducts = [{ id: 'p1', name: 'Widget', price: 9.99 }];
      mockPrisma.product.findMany
        .mockResolvedValueOnce(mockProducts)
        .mockResolvedValueOnce([{ category: 'Electronics' }]);
      mockPrisma.product.count.mockResolvedValue(1);

      const result = await ProductService.listProducts({ storeId: 'store1' });

      expect(result.products).toEqual(mockProducts);
      expect(result.total).toBe(1);
      expect(result.categories).toEqual(['Electronics']);
    });

    it('applies category filter to the query', async () => {
      mockPrisma.product.findMany.mockResolvedValue([]).mockResolvedValue([]);
      mockPrisma.product.count.mockResolvedValue(0);

      await ProductService.listProducts({ storeId: 'store1', category: 'Electronics' });

      const findManyCall = mockPrisma.product.findMany.mock.calls[0][0];
      expect(findManyCall.where.category).toBe('Electronics');
    });

    it('applies featured filter when featured=true', async () => {
      mockPrisma.product.findMany.mockResolvedValue([]).mockResolvedValue([]);
      mockPrisma.product.count.mockResolvedValue(0);

      await ProductService.listProducts({ storeId: 'store1', featured: 'true' });

      const findManyCall = mockPrisma.product.findMany.mock.calls[0][0];
      expect(findManyCall.where.featured).toBe(true);
    });

    it('builds OR search filter across name, description, and tags', async () => {
      mockPrisma.product.findMany.mockResolvedValue([]).mockResolvedValue([]);
      mockPrisma.product.count.mockResolvedValue(0);

      await ProductService.listProducts({ storeId: 'store1', search: 'laptop' });

      const findManyCall = mockPrisma.product.findMany.mock.calls[0][0];
      expect(findManyCall.where.OR).toBeDefined();
      expect(findManyCall.where.OR[0].name.contains).toBe('laptop');
      expect(findManyCall.where.OR[1].description.contains).toBe('laptop');
      expect(findManyCall.where.OR[2].tags.has).toBe('laptop');
    });

    it('applies B2B price override for authenticated users with a company price list', async () => {
      const mockProducts = [{ id: 'p1', name: 'Widget', price: 9.99 }];
      mockPrisma.product.findMany
        .mockResolvedValueOnce(mockProducts)
        .mockResolvedValueOnce([]);
      mockPrisma.product.count.mockResolvedValue(1);
      mockPrisma.user.findUnique.mockResolvedValue({
        company: { priceList: { prices: { p1: 7.99 } } },
      });

      const user = { sub: 'u1', email: 'test@test.com', role: 'USER', type: 'USER' as const };
      const result = await ProductService.listProducts({ storeId: 'store1', user });

      expect(result.products[0].price).toBe(7.99);
    });

    it('does not apply price override when user has no company', async () => {
      const mockProducts = [{ id: 'p1', name: 'Widget', price: 9.99 }];
      mockPrisma.product.findMany
        .mockResolvedValueOnce(mockProducts)
        .mockResolvedValueOnce([]);
      mockPrisma.product.count.mockResolvedValue(1);
      mockPrisma.user.findUnique.mockResolvedValue({ company: null });

      const user = { sub: 'u1', email: 'test@test.com', role: 'USER', type: 'USER' as const };
      const result = await ProductService.listProducts({ storeId: 'store1', user });

      expect(result.products[0].price).toBe(9.99);
    });

    it('filters out null categories from the categories list', async () => {
      mockPrisma.product.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ category: 'Clothing' }, { category: null }]);
      mockPrisma.product.count.mockResolvedValue(0);

      const result = await ProductService.listProducts({ storeId: 'store1' });

      expect(result.categories).toEqual(['Clothing']);
    });
  });

  describe('getProductById', () => {
    it('returns the product when found', async () => {
      const mockProduct = { id: 'p1', name: 'Widget', price: 9.99 };
      mockPrisma.product.findFirst.mockResolvedValue(mockProduct);

      const result = await ProductService.getProductById('store1', 'p1');

      expect(result).toEqual(mockProduct);
      expect(mockPrisma.product.findFirst).toHaveBeenCalledWith({
        where: { id: 'p1', storeId: 'store1', active: true },
      });
    });

    it('throws NotFoundError when the product does not exist', async () => {
      mockPrisma.product.findFirst.mockResolvedValue(null);

      await expect(ProductService.getProductById('store1', 'p-missing')).rejects.toThrow(NotFoundError);
    });

    it('applies price override for authenticated USER with a company price list', async () => {
      const mockProduct = { id: 'p1', name: 'Widget', price: 9.99 };
      mockPrisma.product.findFirst.mockResolvedValue(mockProduct);
      mockPrisma.user.findUnique.mockResolvedValue({
        company: { priceList: { prices: { p1: 6.5 } } },
      });

      const user = { sub: 'u1', email: 'test@test.com', role: 'USER', type: 'USER' as const };
      const result = await ProductService.getProductById('store1', 'p1', user);

      expect((result as any).price).toBe(6.5);
    });

    it('does not apply price override when product not in price list', async () => {
      const mockProduct = { id: 'p1', name: 'Widget', price: 9.99 };
      mockPrisma.product.findFirst.mockResolvedValue(mockProduct);
      mockPrisma.user.findUnique.mockResolvedValue({
        company: { priceList: { prices: { 'p-other': 5.0 } } },
      });

      const user = { sub: 'u1', email: 'test@test.com', role: 'USER', type: 'USER' as const };
      const result = await ProductService.getProductById('store1', 'p1', user);

      expect((result as any).price).toBe(9.99);
    });
  });

  describe('createProduct', () => {
    it('creates a product with the storeId attached', async () => {
      const data = { name: 'New Widget', price: 19.99, sku: 'W001' };
      const created = { id: 'p-new', storeId: 'store1', ...data };
      mockPrisma.product.create.mockResolvedValue(created);

      const result = await ProductService.createProduct('store1', data);

      expect(mockPrisma.product.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ storeId: 'store1', name: 'New Widget' }),
      });
      expect(result).toEqual(created);
    });
  });

  describe('updateProduct', () => {
    it('updates and returns the product when found', async () => {
      const existing = { id: 'p1', storeId: 'store1', name: 'Old Name' };
      const updated = { id: 'p1', storeId: 'store1', name: 'New Name' };
      mockPrisma.product.findFirst.mockResolvedValue(existing);
      mockPrisma.product.update.mockResolvedValue(updated);

      const result = await ProductService.updateProduct('store1', 'p1', { name: 'New Name' });

      expect(result).toEqual(updated);
    });

    it('throws NotFoundError when the product does not exist', async () => {
      mockPrisma.product.findFirst.mockResolvedValue(null);

      await expect(
        ProductService.updateProduct('store1', 'p-missing', { name: 'X' })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('deleteProduct', () => {
    it('soft-deletes the product by setting active to false', async () => {
      const existing = { id: 'p1', storeId: 'store1' };
      mockPrisma.product.findFirst.mockResolvedValue(existing);
      mockPrisma.product.update.mockResolvedValue({});

      const result = await ProductService.deleteProduct('store1', 'p1');

      expect(mockPrisma.product.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { active: false },
      });
      expect(result).toEqual({ success: true });
    });

    it('throws NotFoundError when the product does not exist', async () => {
      mockPrisma.product.findFirst.mockResolvedValue(null);

      await expect(ProductService.deleteProduct('store1', 'p-missing')).rejects.toThrow(NotFoundError);
    });
  });

  describe('generate3dModel', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    it('throws NotFoundError when product is not found', async () => {
      mockPrisma.product.findFirst.mockResolvedValue(null);

      await expect(ProductService.generate3dModel('store1', 'p-missing')).rejects.toThrow(NotFoundError);
    });

    it('throws an error when product has no images', async () => {
      mockPrisma.product.findFirst.mockResolvedValue({ id: 'p1', images: [] });

      await expect(ProductService.generate3dModel('store1', 'p1')).rejects.toThrow(
        'Product must have at least one image'
      );
    });

    it('returns a started message when product has images', async () => {
      mockPrisma.product.findFirst.mockResolvedValue({
        id: 'p1',
        images: ['https://example.com/img.jpg'],
      });

      const result = await ProductService.generate3dModel('store1', 'p1');

      expect(result).toEqual({ message: '3D generation started' });
    });
  });

  describe('batchGetProducts', () => {
    it('returns the matching products for the given IDs', async () => {
      const mockProducts = [
        { id: 'p1', name: 'Widget A' },
        { id: 'p2', name: 'Widget B' },
      ];
      mockPrisma.product.findMany.mockResolvedValue(mockProducts);

      const result = await ProductService.batchGetProducts('store1', ['p1', 'p2']);

      expect(result).toEqual(mockProducts);
      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: { in: ['p1', 'p2'] }, storeId: 'store1', active: true }),
        })
      );
    });

    it('applies price override for authenticated USER with a company price list', async () => {
      const mockProducts = [{ id: 'p1', name: 'Widget', price: 10 }];
      mockPrisma.product.findMany.mockResolvedValue(mockProducts);
      mockPrisma.user.findUnique.mockResolvedValue({
        company: { priceList: { prices: { p1: 8.0 } } },
      });

      const user = { sub: 'u1', email: 'test@test.com', role: 'USER', type: 'USER' as const };
      const result = await ProductService.batchGetProducts('store1', ['p1'], user);

      expect((result as any)[0].price).toBe(8.0);
    });
  });

  describe('bulkImportProducts', () => {
    it('creates multiple products and returns the count', async () => {
      mockPrisma.product.createMany.mockResolvedValue({ count: 3 });

      const products = [
        { name: 'A', price: 1 },
        { name: 'B', price: 2 },
        { name: 'C', price: 3 },
      ];
      const result = await ProductService.bulkImportProducts('store1', products);

      expect(result).toEqual({ created: 3 });
      expect(mockPrisma.product.createMany).toHaveBeenCalledWith({
        data: products.map((p) => ({ ...p, storeId: 'store1' })),
      });
    });
  });
});
