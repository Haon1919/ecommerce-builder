import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { StoreNav } from './StoreNav';
import { useCartStore } from '@/lib/cart';
import type { StoreInfo } from '@/types';

// --- Mocks ---
jest.mock('next/navigation', () => ({
  useParams: () => ({
    storeSlug: 'test-store',
  }),
}));

// Mock the Zustand store
jest.mock('@/lib/cart');
const mockedUseCartStore = useCartStore as unknown as jest.Mock;

const sampleStore: StoreInfo = {
  id: 'store-1',
  name: 'Test Store',
  slug: 'test-store',
  primaryColor: '#6366f1',
  theme: 'BOOTSTRAP',
  tier: 'STARTER',
  logoUrl: undefined,
};

describe('StoreNav', () => {
  beforeEach(() => {
    // Reset mocks before each test
    mockedUseCartStore.mockClear();
  });

  it('should render the store name and navigation links', () => {
    mockedUseCartStore.mockImplementation((selector) => selector({ totalItems: () => 0 }));
    render(<StoreNav store={sampleStore} />);

    expect(screen.getByText('Test Store')).toBeInTheDocument();
    // Check for desktop links
    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Products' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contact' })).toBeInTheDocument();
  });

  it('should not display a cart count when the cart is empty', () => {
    mockedUseCartStore.mockImplementation((selector) => selector({ totalItems: () => 0 }));
    render(<StoreNav store={sampleStore} />);

    // The count span should not be in the document
    const cartLink = screen.getByRole('link', { name: /view shopping cart/i });
    expect(cartLink.querySelector('span')).toBeNull();
  });

  it('should display the correct cart count when cart has items', () => {
    mockedUseCartStore.mockImplementation((selector) => selector({ totalItems: () => 3 }));
    render(<StoreNav store={sampleStore} />);

    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('should display "9+" when cart has more than 9 items', () => {
    mockedUseCartStore.mockImplementation((selector) => selector({ totalItems: () => 12 }));
    render(<StoreNav store={sampleStore} />);

    expect(screen.getByText('9+')).toBeInTheDocument();
  });

  it('should toggle the mobile menu on button click', () => {
    mockedUseCartStore.mockImplementation((selector) => selector({ totalItems: () => 0 }));
    render(<StoreNav store={sampleStore} />);

    const menuButton = screen.getByRole('button', { name: /toggle menu/i });

    // Initially, mobile menu is closed
    expect(screen.queryByText('Home', { selector: 'a.block' })).not.toBeInTheDocument();

    // Open mobile menu
    fireEvent.click(menuButton);
    expect(screen.getByText('Home', { selector: 'a.block' })).toBeInTheDocument();
    expect(screen.getByText('Products', { selector: 'a.block' })).toBeInTheDocument();

    // Close mobile menu
    fireEvent.click(menuButton);
    expect(screen.queryByText('Home', { selector: 'a.block' })).not.toBeInTheDocument();
  });
});
