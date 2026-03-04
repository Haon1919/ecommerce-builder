import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { PageRenderer } from './PageRenderer';
import type { PageComponent } from '../types';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

const makeComponent = (overrides: Partial<PageComponent>): PageComponent => ({
  id: 'comp-1',
  type: 'Heading',
  order: 0,
  props: {},
  ...overrides,
});

describe('PageRenderer', () => {
  it('renders an empty div when layout is empty', () => {
    const { container } = render(<PageRenderer layout={[]} storeSlug="test-store" />);
    expect(container.firstChild).toBeEmptyDOMElement();
  });

  it('renders a HeroSection with title and subtitle', () => {
    const layout = [
      makeComponent({
        type: 'HeroSection',
        props: { title: 'Welcome Hero', subtitle: 'Best store ever' },
      }),
    ];
    render(<PageRenderer layout={layout} storeSlug="test-store" />);

    expect(screen.getByText('Welcome Hero')).toBeInTheDocument();
    expect(screen.getByText('Best store ever')).toBeInTheDocument();
  });

  it('renders a HeroSection CTA link when ctaText is provided', () => {
    const layout = [
      makeComponent({
        type: 'HeroSection',
        props: { title: 'Hero', ctaText: 'Shop Now', ctaLink: '/products' },
      }),
    ];
    render(<PageRenderer layout={layout} storeSlug="test-store" />);

    expect(screen.getByRole('link', { name: 'Shop Now' })).toBeInTheDocument();
  });

  it('renders a Heading with the correct text and tag', () => {
    const layout = [
      makeComponent({
        type: 'Heading',
        props: { text: 'My Section Heading', level: 'h2' },
      }),
    ];
    render(<PageRenderer layout={layout} storeSlug="test-store" />);

    const heading = screen.getByRole('heading', { name: 'My Section Heading' });
    expect(heading.tagName).toBe('H2');
  });

  it('renders a Text component with the provided text', () => {
    const layout = [
      makeComponent({ type: 'Text', props: { text: 'Some descriptive paragraph text' } }),
    ];
    render(<PageRenderer layout={layout} storeSlug="test-store" />);

    expect(screen.getByText('Some descriptive paragraph text')).toBeInTheDocument();
  });

  it('renders a Button with the correct link and label', () => {
    const layout = [
      makeComponent({
        type: 'Button',
        props: { text: 'Click Me', link: '/sale', variant: 'primary' },
      }),
    ];
    render(<PageRenderer layout={layout} storeSlug="test-store" />);

    const link = screen.getByRole('link', { name: 'Click Me' });
    expect(link).toHaveAttribute('href', '/sale');
  });

  it('renders an Image when src is provided', () => {
    const layout = [
      makeComponent({
        type: 'Image',
        props: { src: 'https://example.com/photo.jpg', alt: 'A photo' },
      }),
    ];
    render(<PageRenderer layout={layout} storeSlug="test-store" />);

    expect(screen.getByRole('img', { name: 'A photo' })).toBeInTheDocument();
  });

  it('renders nothing for an Image with no src', () => {
    const layout = [makeComponent({ type: 'Image', props: {} })];
    const { container } = render(<PageRenderer layout={layout} storeSlug="test-store" />);
    expect(container.querySelector('img')).toBeNull();
  });

  it('renders a Banner with the correct text', () => {
    const layout = [
      makeComponent({
        type: 'Banner',
        props: { text: 'Free shipping on orders over $50!', backgroundColor: '#fef3c7' },
      }),
    ];
    render(<PageRenderer layout={layout} storeSlug="test-store" />);

    expect(screen.getByText('Free shipping on orders over $50!')).toBeInTheDocument();
  });

  it('renders a Banner with a link when link is provided', () => {
    const layout = [
      makeComponent({
        type: 'Banner',
        props: { text: 'Sale ends soon', link: '/sale' },
      }),
    ];
    render(<PageRenderer layout={layout} storeSlug="test-store" />);

    expect(screen.getByRole('link', { name: 'Sale ends soon' })).toHaveAttribute('href', '/sale');
  });

  it('renders a Testimonial with quote, author, and stars', () => {
    const layout = [
      makeComponent({
        type: 'Testimonial',
        props: { quote: 'Amazing products!', author: 'Alice', rating: 5 },
      }),
    ];
    render(<PageRenderer layout={layout} storeSlug="test-store" />);

    expect(screen.getByText(/Amazing products!/)).toBeInTheDocument();
    expect(screen.getByText(/— Alice/)).toBeInTheDocument();
    expect(screen.getByText('★★★★★')).toBeInTheDocument();
  });

  it('renders FAQ items as details/summary elements', () => {
    const layout = [
      makeComponent({
        type: 'FAQ',
        props: {
          items: [
            { question: 'What is your return policy?', answer: '30 days, no questions asked.' },
            { question: 'Do you ship internationally?', answer: 'Yes, we ship worldwide.' },
          ],
        },
      }),
    ];
    render(<PageRenderer layout={layout} storeSlug="test-store" />);

    expect(screen.getByText('What is your return policy?')).toBeInTheDocument();
    expect(screen.getByText('30 days, no questions asked.')).toBeInTheDocument();
    expect(screen.getByText('Do you ship internationally?')).toBeInTheDocument();
  });

  it('renders a Spacer with the correct height', () => {
    const layout = [makeComponent({ type: 'Spacer', props: { height: 80 } })];
    const { container } = render(<PageRenderer layout={layout} storeSlug="test-store" />);

    const spacer = container.querySelector('div[style*="height"]') as HTMLElement;
    expect(spacer).toBeInTheDocument();
    expect(spacer.style.height).toBe('80px');
  });

  it('renders a Divider element', () => {
    const layout = [makeComponent({ type: 'Divider', props: {} })];
    const { container } = render(<PageRenderer layout={layout} storeSlug="test-store" />);
    expect(container.querySelector('hr')).toBeInTheDocument();
  });

  it('renders a ProductGrid with the provided products', () => {
    const layout = [
      makeComponent({ type: 'ProductGrid', props: { columns: '3', limit: 10 } }),
    ];
    const products = [
      { id: 'p1', name: 'Widget A', price: 9.99, images: [], stock: 5 },
      { id: 'p2', name: 'Widget B', price: 19.99, images: [], stock: 0 },
    ];
    render(<PageRenderer layout={layout} storeSlug="test-store" products={products} />);

    expect(screen.getByText('Widget A')).toBeInTheDocument();
    expect(screen.getByText('Widget B')).toBeInTheDocument();
  });

  it('shows "Out of stock" label for zero-stock products in the grid', () => {
    const layout = [makeComponent({ type: 'ProductGrid', props: {} })];
    const products = [{ id: 'p1', name: 'Sold Out Widget', price: 9.99, images: [], stock: 0 }];
    render(<PageRenderer layout={layout} storeSlug="test-store" products={products} />);

    expect(screen.getByText('Out of stock')).toBeInTheDocument();
  });

  it('filters ProductGrid products by category', () => {
    const layout = [
      makeComponent({ type: 'ProductGrid', props: { category: 'Electronics' } }),
    ];
    const products = [
      { id: 'p1', name: 'Phone', price: 499, images: [], stock: 10, category: 'Electronics' },
      { id: 'p2', name: 'Shirt', price: 29, images: [], stock: 10, category: 'Clothing' },
    ];
    render(<PageRenderer layout={layout} storeSlug="test-store" products={products} />);

    expect(screen.getByText('Phone')).toBeInTheDocument();
    expect(screen.queryByText('Shirt')).not.toBeInTheDocument();
  });

  it('respects the limit prop in ProductGrid', () => {
    const layout = [makeComponent({ type: 'ProductGrid', props: { limit: 2 } })];
    const products = [
      { id: 'p1', name: 'Product 1', price: 10, images: [], stock: 1 },
      { id: 'p2', name: 'Product 2', price: 20, images: [], stock: 1 },
      { id: 'p3', name: 'Product 3', price: 30, images: [], stock: 1 },
    ];
    render(<PageRenderer layout={layout} storeSlug="test-store" products={products} />);

    expect(screen.getByText('Product 1')).toBeInTheDocument();
    expect(screen.getByText('Product 2')).toBeInTheDocument();
    expect(screen.queryByText('Product 3')).not.toBeInTheDocument();
  });

  it('sorts components by their order field before rendering', () => {
    const layout = [
      makeComponent({ id: 'c2', type: 'Heading', order: 2, props: { text: 'Second' } }),
      makeComponent({ id: 'c1', type: 'Text', order: 1, props: { text: 'First' } }),
    ];
    const { container } = render(<PageRenderer layout={layout} storeSlug="test-store" />);
    const children = Array.from(container.firstChild!.childNodes);
    expect(children[0].textContent).toContain('First');
    expect(children[1].textContent).toContain('Second');
  });

  it('renders null for unknown component types', () => {
    const layout = [makeComponent({ type: 'NonExistentComponent', props: {} })];
    const { container } = render(<PageRenderer layout={layout} storeSlug="test-store" />);
    // The wrapper div should be in the DOM but the component renders nothing
    expect(container.firstChild).toBeEmptyDOMElement();
  });

  it('renders a ContactForm section', () => {
    const layout = [
      makeComponent({ type: 'ContactForm', props: { title: 'Get in Touch' } }),
    ];
    render(<PageRenderer layout={layout} storeSlug="test-store" />);

    expect(screen.getByText('Get in Touch')).toBeInTheDocument();
  });

  it('renders a NewsletterForm section', () => {
    const layout = [
      makeComponent({ type: 'NewsletterForm', props: { title: 'Stay Updated' } }),
    ];
    render(<PageRenderer layout={layout} storeSlug="test-store" />);

    expect(screen.getByText('Stay Updated')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /subscribe/i })).toBeInTheDocument();
  });

  it('shows a compare price when product has one', () => {
    const layout = [makeComponent({ type: 'ProductGrid', props: {} })];
    const products = [
      { id: 'p1', name: 'Widget', price: 7.99, comparePrice: 12.99, images: [], stock: 5 },
    ];
    render(<PageRenderer layout={layout} storeSlug="test-store" products={products} />);

    expect(screen.getByText('$7.99')).toBeInTheDocument();
    expect(screen.getByText('$12.99')).toBeInTheDocument();
  });
});
