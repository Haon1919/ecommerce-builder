import { renderHook, act } from '@testing-library/react';
import { useCartStore } from './cart';

// Mock localStorage to test persistence if needed (Zustand uses localStorage by default for persist)
const localStorageMock = (function () {
    let store: Record<string, string> = {};
    return {
        getItem: function (key: string) {
            return store[key] || null;
        },
        setItem: function (key: string, value: string) {
            store[key] = value.toString();
        },
        removeItem: function (key: string) {
            delete store[key];
        },
        clear: function () {
            store = {};
        },
    };
})();

Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
});

describe('useCartStore', () => {
    beforeEach(() => {
        // Clear the store before each test
        localStorage.clear();
        const { result } = renderHook(() => useCartStore());
        act(() => {
            result.current.clearCart();
        });
    });

    it('should initialize with empty cart', () => {
        const { result } = renderHook(() => useCartStore());
        expect(result.current.items).toEqual([]);
        expect(result.current.storeId).toBeNull();
        expect(result.current.totalItems()).toBe(0);
        expect(result.current.subtotal()).toBe(0);
    });

    it('should add a new item to the cart', () => {
        const { result } = renderHook(() => useCartStore());

        act(() => {
            result.current.addItem({
                productId: 'prod-1',
                name: 'Product 1',
                price: 10,
                quantity: 1,
            });
        });

        expect(result.current.items).toHaveLength(1);
        expect(result.current.items[0].productId).toBe('prod-1');
        expect(result.current.items[0].quantity).toBe(1);
        expect(result.current.totalItems()).toBe(1);
        expect(result.current.subtotal()).toBe(10);
    });

    it('should increment quantity when adding an existing item', () => {
        const { result } = renderHook(() => useCartStore());

        act(() => {
            result.current.addItem({
                productId: 'prod-1',
                name: 'Product 1',
                price: 10,
                quantity: 1,
            });
        });

        act(() => {
            result.current.addItem({
                productId: 'prod-1',
                name: 'Product 1',
                price: 10,
                quantity: 2,
            });
        });

        expect(result.current.items).toHaveLength(1);
        expect(result.current.items[0].quantity).toBe(3);
        expect(result.current.totalItems()).toBe(3);
        expect(result.current.subtotal()).toBe(30);
    });

    it('should remove an item from the cart', () => {
        const { result } = renderHook(() => useCartStore());

        act(() => {
            result.current.addItem({
                productId: 'prod-1',
                name: 'Product 1',
                price: 10,
                quantity: 1,
            });
            result.current.addItem({
                productId: 'prod-2',
                name: 'Product 2',
                price: 20,
                quantity: 1,
            });
        });

        expect(result.current.items).toHaveLength(2);

        act(() => {
            result.current.removeItem('prod-1');
        });

        expect(result.current.items).toHaveLength(1);
        expect(result.current.items[0].productId).toBe('prod-2');
        expect(result.current.totalItems()).toBe(1);
        expect(result.current.subtotal()).toBe(20);
    });

    it('should update quantity of an existing item', () => {
        const { result } = renderHook(() => useCartStore());

        act(() => {
            result.current.addItem({
                productId: 'prod-1',
                name: 'Product 1',
                price: 10,
                quantity: 1,
            });
        });

        act(() => {
            result.current.updateQuantity('prod-1', 5);
        });

        expect(result.current.items[0].quantity).toBe(5);
        expect(result.current.totalItems()).toBe(5);
        expect(result.current.subtotal()).toBe(50);
    });

    it('should remove item when quantity is updated to 0', () => {
        const { result } = renderHook(() => useCartStore());

        act(() => {
            result.current.addItem({
                productId: 'prod-1',
                name: 'Product 1',
                price: 10,
                quantity: 1,
            });
        });

        act(() => {
            result.current.updateQuantity('prod-1', 0);
        });

        expect(result.current.items).toHaveLength(0);
        expect(result.current.totalItems()).toBe(0);
    });

    it('should remove item when quantity is updated to a negative value', () => {
        const { result } = renderHook(() => useCartStore());

        act(() => {
            result.current.addItem({
                productId: 'prod-1',
                name: 'Product 1',
                price: 10,
                quantity: 1,
            });
        });

        act(() => {
            result.current.updateQuantity('prod-1', -5);
        });

        expect(result.current.items).toHaveLength(0);
        expect(result.current.totalItems()).toBe(0);
    });

    it('should clear all items from the cart', () => {
        const { result } = renderHook(() => useCartStore());

        act(() => {
            result.current.addItem({
                productId: 'prod-1',
                name: 'Product 1',
                price: 10,
                quantity: 1,
            });
            result.current.addItem({
                productId: 'prod-2',
                name: 'Product 2',
                price: 20,
                quantity: 1,
            });
        });

        expect(result.current.items).toHaveLength(2);

        act(() => {
            result.current.clearCart();
        });

        expect(result.current.items).toHaveLength(0);
        expect(result.current.totalItems()).toBe(0);
        expect(result.current.subtotal()).toBe(0);
    });

    it('should set storeId', () => {
        const { result } = renderHook(() => useCartStore());

        act(() => {
            result.current.setStoreId('my-store');
        });

        expect(result.current.storeId).toBe('my-store');
    });
});
