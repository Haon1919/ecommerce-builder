import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CheckoutPage from './page';
import { useCartStore } from '@/lib/cart';
import { storeApi, ordersApi } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useParams } from 'next/navigation';

// Mock dependencies
jest.mock('next/navigation', () => ({
    useRouter: jest.fn(),
    useParams: jest.fn(),
}));

jest.mock('@tanstack/react-query', () => ({
    useQuery: jest.fn(),
}));

jest.mock('@/lib/cart', () => ({
    useCartStore: jest.fn(),
}));

jest.mock('@/lib/api', () => ({
    storeApi: {
        getBySlug: jest.fn(),
    },
    ordersApi: {
        create: jest.fn(),
    },
}));

const mockPush = jest.fn();

const mockCartStore = {
    items: [
        { productId: 'prod-1', name: 'Product 1', price: 10, quantity: 2 },
    ],
    subtotal: jest.fn(() => 20),
    clearCart: jest.fn(),
};

const mockStoreData = {
    id: 'store-1',
    slug: 'test-store',
    settings: {
        taxRate: 10, // 10%
        flatShippingRate: 5,
        freeShippingAbove: 50,
    },
};

describe('CheckoutPage', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
        (useParams as jest.Mock).mockReturnValue({ storeSlug: 'test-store' });

        (useCartStore as unknown as jest.Mock).mockReturnValue(mockCartStore);

        (useQuery as jest.Mock).mockReturnValue({
            data: mockStoreData,
        });
    });

    it('should redirect back to cart if the cart is empty', () => {
        (useCartStore as unknown as jest.Mock).mockReturnValue({
            items: [],
            subtotal: jest.fn(() => 0),
            clearCart: jest.fn(),
        });

        render(<CheckoutPage />);
        expect(mockPush).toHaveBeenCalledWith('/test-store/cart');
    });

    it('should render contact information step initially', () => {
        render(<CheckoutPage />);

        expect(screen.getByText('Checkout')).toBeInTheDocument();
        expect(screen.getByText('Contact Information')).toBeInTheDocument();

        // Order summary checks
        expect(screen.getByText('Product 1 × 2')).toBeInTheDocument();
        // subtotal 20 + tax 2 + shipping 5 = 27
        expect(screen.getByText('$27.00')).toBeInTheDocument();
    });

    it('should allow progressing through the form to shipping and payment', async () => {
        const { container } = render(<CheckoutPage />);

        // --- Step 1: Contact ---
        fireEvent.change(container.querySelector('#email') as HTMLInputElement, { target: { value: 'test@example.com' } });
        fireEvent.change(container.querySelector('#name') as HTMLInputElement, { target: { value: 'John Doe' } });

        fireEvent.click(screen.getByRole('button', { name: /Continue/i }));

        // --- Step 2: Shipping ---
        await waitFor(() => {
            expect(screen.getByRole('heading', { level: 2, name: 'Shipping Address' })).toBeInTheDocument();
        });

        fireEvent.change(container.querySelector('#line1') as HTMLInputElement, { target: { value: '123 Main St' } });
        fireEvent.change(container.querySelector('#city') as HTMLInputElement, { target: { value: 'Anytown' } });
        fireEvent.change(container.querySelector('#state') as HTMLInputElement, { target: { value: 'NY' } });
        fireEvent.change(container.querySelector('#zip') as HTMLInputElement, { target: { value: '10001' } });

        fireEvent.click(screen.getByRole('button', { name: /Continue/i }));

        // --- Step 3: Payment ---
        await waitFor(() => {
            expect(screen.getByRole('heading', { level: 2, name: 'Payment' })).toBeInTheDocument();
        });

        expect(screen.getByText('Place Order — $27.00')).toBeInTheDocument();
    });

    it('should submit the order successfully and redirect to confirmation', async () => {
        (ordersApi.create as jest.Mock).mockResolvedValue({ orderNumber: 'ORD-123' });

        const { container } = render(<CheckoutPage />);

        // Fast-forward filling the form...
        fireEvent.change(container.querySelector('#email') as HTMLInputElement, { target: { value: 'test@example.com' } });
        fireEvent.change(container.querySelector('#name') as HTMLInputElement, { target: { value: 'John Doe' } });
        fireEvent.click(screen.getByRole('button', { name: /Continue/i }));

        await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: 'Shipping Address' })).toBeInTheDocument());

        fireEvent.change(container.querySelector('#line1') as HTMLInputElement, { target: { value: '123 Main St' } });
        fireEvent.change(container.querySelector('#city') as HTMLInputElement, { target: { value: 'Anytown' } });
        fireEvent.change(container.querySelector('#state') as HTMLInputElement, { target: { value: 'NY' } });
        fireEvent.change(container.querySelector('#zip') as HTMLInputElement, { target: { value: '10001' } });
        fireEvent.click(screen.getByRole('button', { name: /Continue/i }));

        await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: 'Payment' })).toBeInTheDocument());

        // Submit order
        fireEvent.click(screen.getByRole('button', { name: /Place Order/i }));

        await waitFor(() => {
            expect(ordersApi.create).toHaveBeenCalledWith({
                storeId: 'store-1',
                customerEmail: 'test@example.com',
                customerName: 'John Doe',
                customerPhone: '',
                shippingAddress: {
                    line1: '123 Main St',
                    line2: '',
                    city: 'Anytown',
                    state: 'NY',
                    zip: '10001',
                    country: 'US', // default
                },
                items: [{ productId: 'prod-1', quantity: 2 }],
            });

            expect(mockCartStore.clearCart).toHaveBeenCalled();
            expect(mockPush).toHaveBeenCalledWith('/test-store/cart/confirmation?order=ORD-123');
        });
    });

    it('should show an alert on order failure', async () => {
        const alertMock = jest.spyOn(window, 'alert').mockImplementation(() => { });
        (ordersApi.create as jest.Mock).mockRejectedValue({
            response: { data: { error: 'Payment declined' } }
        });

        const { container } = render(<CheckoutPage />);

        // Fast-forward
        fireEvent.change(container.querySelector('#email') as HTMLInputElement, { target: { value: 'test@example.com' } });
        fireEvent.change(container.querySelector('#name') as HTMLInputElement, { target: { value: 'John Doe' } });
        fireEvent.click(screen.getByRole('button', { name: /Continue/i }));

        await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: 'Shipping Address' })).toBeInTheDocument());
        fireEvent.change(container.querySelector('#line1') as HTMLInputElement, { target: { value: '123 Main St' } });
        fireEvent.change(container.querySelector('#city') as HTMLInputElement, { target: { value: 'Anytown' } });
        fireEvent.change(container.querySelector('#state') as HTMLInputElement, { target: { value: 'NY' } });
        fireEvent.change(container.querySelector('#zip') as HTMLInputElement, { target: { value: '10001' } });
        fireEvent.click(screen.getByRole('button', { name: /Continue/i }));

        await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: 'Payment' })).toBeInTheDocument());

        // Submit order
        fireEvent.click(screen.getByRole('button', { name: /Place Order/i }));

        await waitFor(() => {
            expect(alertMock).toHaveBeenCalledWith('Payment declined');
        });

        alertMock.mockRestore();
    });
});
