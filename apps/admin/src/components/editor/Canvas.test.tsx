import { render, screen, fireEvent } from '@testing-library/react';
import { Canvas } from './Canvas';
import type { PageComponent } from '@/types';

// --- Mocks ---
jest.mock('@dnd-kit/core', () => ({
  ...jest.requireActual('@dnd-kit/core'),
  useDroppable: () => ({
    setNodeRef: jest.fn(),
    isOver: false,
  }),
}));

jest.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: jest.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));

const mockOnSelect = jest.fn();

const sampleComponents: PageComponent[] = [
  { id: 'comp-1', type: 'Heading', order: 0, props: { text: 'My Awesome Heading' } },
  { id: 'comp-2', type: 'Text', order: 1, props: { text: 'Some paragraph text.' } },
];

describe('Canvas', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the empty state message when no components are provided', () => {
    render(<Canvas components={[]} selectedId={null} onSelect={mockOnSelect} />);
    expect(screen.getByText('Start building your page')).toBeInTheDocument();
  });

  it('should render the provided components', () => {
    render(<Canvas components={sampleComponents} selectedId={null} onSelect={mockOnSelect} />);
    expect(screen.getByText('My Awesome Heading')).toBeInTheDocument();
    expect(screen.getByText('Some paragraph text.')).toBeInTheDocument();
  });

  it('should call onSelect with the component ID when a component is clicked', () => {
    render(<Canvas components={sampleComponents} selectedId={null} onSelect={mockOnSelect} />);
    // The component preview is what gets clicked
    fireEvent.click(screen.getByText('My Awesome Heading'));
    expect(mockOnSelect).toHaveBeenCalledWith('comp-1');
  });

  it('should call onSelect with null when the canvas background is clicked', () => {
    const { container } = render(<Canvas components={sampleComponents} selectedId={'comp-1'} onSelect={mockOnSelect} />);
    // The first child of the container is the main div with the onClick handler
    if (container.firstChild) {
      fireEvent.click(container.firstChild);
    }
    expect(mockOnSelect).toHaveBeenCalledWith(null);
  });

  it('should apply selected styles to the selected component', () => {
    render(<Canvas components={sampleComponents} selectedId={'comp-1'} onSelect={mockOnSelect} />);

    const headingElement = screen.getByText('My Awesome Heading');
    // Find the sortable wrapper div, which is a couple of levels up and has the ring class
    const wrapperDiv = headingElement.closest('.relative');

    expect(wrapperDiv).toHaveClass('ring-2');
    expect(wrapperDiv).toHaveClass('ring-primary-500');
  });

  it('should not apply selected styles to unselected components', () => {
    render(<Canvas components={sampleComponents} selectedId={'comp-1'} onSelect={mockOnSelect} />);

    const textElement = screen.getByText('Some paragraph text.');
    const wrapperDiv = textElement.closest('.relative');

    expect(wrapperDiv).not.toHaveClass('ring-2');
    expect(wrapperDiv).not.toHaveClass('ring-primary-500');
  });

  it('should render various component types correctly', () => {
    // Array covering different switch branches in ComponentPreview
    const diverseComponents: PageComponent[] = [
      { id: 'c-hero', type: 'HeroSection', order: 0, props: { title: 'Welcome', subtitle: 'To our store', ctaText: 'Shop Now' } },
      { id: 'c-img', type: 'Image', order: 1, props: { src: 'fake.jpg', alt: 'Fake image' } },
      { id: 'c-btn', type: 'Button', order: 2, props: { text: 'Click Me', variant: 'primary', size: 'md' } },
      { id: 'c-banner', type: 'Banner', order: 3, props: { text: 'Sale!' } },
      { id: 'c-spacer', type: 'Spacer', order: 4, props: { height: 50 } },
      { id: 'c-divider', type: 'Divider', order: 5, props: {} },
      { id: 'c-grid', type: 'ProductGrid', order: 6, props: { columns: 3 } },
      { id: 'c-featured', type: 'FeaturedProducts', order: 7, props: { title: 'Hot items' } },
      { id: 'c-testi', type: 'Testimonial', order: 8, props: { quote: 'Amazing!', author: 'Bob', rating: 5 } },
      { id: 'c-contact', type: 'ContactForm', order: 9, props: { title: 'Reach out' } },
      { id: 'c-news', type: 'NewsletterForm', order: 10, props: { title: 'Subscribe' } },
      { id: 'c-unknown', type: 'UnknownType', order: 11, props: {} }, // Default fallback
    ];

    render(<Canvas components={diverseComponents} selectedId={null} onSelect={mockOnSelect} />);

    expect(screen.getByText('Welcome')).toBeInTheDocument();
    expect(screen.getByText('To our store')).toBeInTheDocument();
    expect(screen.getByText('Click Me')).toBeInTheDocument();
    expect(screen.getByText('Sale!')).toBeInTheDocument();
    expect(screen.getByText('Hot items')).toBeInTheDocument();
    expect(screen.getByText('"Amazing!"')).toBeInTheDocument();
    expect(screen.getByText('Reach out')).toBeInTheDocument();
    expect(screen.getAllByText('Subscribe')[0]).toBeInTheDocument();
    expect(screen.getByText('[UnknownType component]')).toBeInTheDocument();
  });

  it('should trigger control buttons inside a selected SortableComponent', () => {
    const mockOnDuplicate = jest.fn();
    const mockOnMoveUp = jest.fn();
    const mockOnMoveDown = jest.fn();
    const mockOnDelete = jest.fn();

    const threeComps: PageComponent[] = [
      { id: 'comp-1', type: 'HeroSection', order: 0, props: {} },
      { id: 'comp-2', type: 'Text', order: 1, props: {} },
      { id: 'comp-3', type: 'Image', order: 2, props: {} },
    ];

    render(
      <Canvas
        components={threeComps}
        selectedId={'comp-2'}
        onSelect={mockOnSelect}
        onDuplicate={mockOnDuplicate}
        onMoveUp={mockOnMoveUp}
        onMoveDown={mockOnMoveDown}
        onDelete={mockOnDelete}
      />
    );

    // Because three components are rendered, there are 3 toolbars.
    // The second component (index 1) is the one we passed as selectedId.
    // However, the components array has comp-2 at index 1.
    const dupButtons = screen.getAllByRole('button', { name: 'Duplicate' });
    fireEvent.click(dupButtons[1]);
    expect(mockOnDuplicate).toHaveBeenCalledWith('comp-2');

    const upButtons = screen.getAllByRole('button', { name: 'Move up' });
    fireEvent.click(upButtons[1]);
    expect(mockOnMoveUp).toHaveBeenCalledWith('comp-2');

    const downButtons = screen.getAllByRole('button', { name: 'Move down' });
    fireEvent.click(downButtons[1]);
    expect(mockOnMoveDown).toHaveBeenCalledWith('comp-2');

    const delButtons = screen.getAllByRole('button', { name: 'Delete' });
    fireEvent.click(delButtons[1]);
    expect(mockOnDelete).toHaveBeenCalledWith('comp-2');

    const editButtons = screen.getAllByRole('button', { name: 'Edit properties' });
    fireEvent.click(editButtons[1]);
    // Depending on propagation, clicking edit properties also selects the component
    // we just want to ensure it doesn't crash here.
  });
});
