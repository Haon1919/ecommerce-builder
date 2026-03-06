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
});
