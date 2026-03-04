import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ProductActions } from './ProductActions';
import { useCartStore } from '@/lib/cart';
import { useRouter } from 'next/navigation';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/lib/cart');
const mockedUseCartStore = useCartStore as unknown as jest.Mock;
const mockedUseRouter = useRouter as jest.Mock;

const sampleProduct = {
  id: 'prod-1',
  name: 'Blue Widget',
  price: 29.99,
  stock: 10,
  storeSlug: 'test-store',
  image: 'https://example.com/img.jpg',
};

describe('ProductActions', () => {
  let mockAddItem: jest.Mock;
  let mockPush: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAddItem = jest.fn();
    mockPush = jest.fn();
    mockedUseCartStore.mockImplementation((selector: any) =>
      selector({ addItem: mockAddItem })
    );
    mockedUseRouter.mockReturnValue({ push: mockPush });
  });

  it('shows an initial quantity of 1', () => {
    render(<ProductActions product={sampleProduct} />);
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('increments quantity when the + button is clicked', () => {
    render(<ProductActions product={sampleProduct} />);
    fireEvent.click(screen.getByText('+'));
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('decrements quantity when the − button is clicked', () => {
    render(<ProductActions product={sampleProduct} />);
    fireEvent.click(screen.getByText('+'));
    fireEvent.click(screen.getByText('+'));
    fireEvent.click(screen.getByText('−'));
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('does not decrement quantity below 1', () => {
    render(<ProductActions product={sampleProduct} />);
    fireEvent.click(screen.getByText('−'));
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('does not increment quantity above the available stock', () => {
    const product = { ...sampleProduct, stock: 3 };
    render(<ProductActions product={product} />);
    fireEvent.click(screen.getByText('+'));
    fireEvent.click(screen.getByText('+'));
    fireEvent.click(screen.getByText('+'));
    fireEvent.click(screen.getByText('+'));
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('calls addItem with the correct data when Add to Cart is clicked', () => {
    render(<ProductActions product={sampleProduct} />);
    fireEvent.click(screen.getByRole('button', { name: /add to cart/i }));

    expect(mockAddItem).toHaveBeenCalledWith({
      productId: 'prod-1',
      name: 'Blue Widget',
      price: 29.99,
      quantity: 1,
      image: 'https://example.com/img.jpg',
    });
  });

  it('shows "Added!" confirmation text after adding to cart', async () => {
    jest.useFakeTimers();
    render(<ProductActions product={sampleProduct} />);
    fireEvent.click(screen.getByRole('button', { name: /add to cart/i }));

    expect(screen.getByText('Added!')).toBeInTheDocument();

    act(() => { jest.advanceTimersByTime(2000); });
    expect(screen.queryByText('Added!')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add to cart/i })).toBeInTheDocument();

    jest.useRealTimers();
  });

  it('disables the Add to Cart button when stock is 0', () => {
    const product = { ...sampleProduct, stock: 0 };
    render(<ProductActions product={product} />);
    expect(screen.getByRole('button', { name: /add to cart/i })).toBeDisabled();
  });

  it('disables the Buy Now button when stock is 0', () => {
    const product = { ...sampleProduct, stock: 0 };
    render(<ProductActions product={product} />);
    expect(screen.getByRole('button', { name: /buy now/i })).toBeDisabled();
  });

  it('adds item and navigates to cart when Buy Now is clicked', () => {
    render(<ProductActions product={sampleProduct} />);
    fireEvent.click(screen.getByRole('button', { name: /buy now/i }));

    expect(mockAddItem).toHaveBeenCalledWith(
      expect.objectContaining({ productId: 'prod-1' })
    );
    expect(mockPush).toHaveBeenCalledWith('/test-store/cart');
  });

  it('adds the correct quantity to the cart when quantity is changed before adding', () => {
    render(<ProductActions product={sampleProduct} />);
    fireEvent.click(screen.getByText('+'));
    fireEvent.click(screen.getByText('+'));
    fireEvent.click(screen.getByRole('button', { name: /add to cart/i }));

    expect(mockAddItem).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 3 })
    );
  });
});
