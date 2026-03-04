import { render, screen } from '@testing-library/react';
import { ComponentPalette, PALETTE_ITEMS } from './ComponentPalette';

// Mock the @dnd-kit/core hook
jest.mock('@dnd-kit/core', () => ({
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: jest.fn(),
    transform: null,
    isDragging: false,
  }),
}));

describe('ComponentPalette', () => {
  it('should render the main title and subtitle', () => {
    render(<ComponentPalette />);
    expect(screen.getByText('Components')).toBeInTheDocument();
    expect(screen.getByText('Drag & drop onto canvas')).toBeInTheDocument();
  });

  it('should render all component categories', () => {
    render(<ComponentPalette />);
    expect(screen.getByText('Layout')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
    expect(screen.getByText('Marketing')).toBeInTheDocument();
    expect(screen.getByText('Commerce')).toBeInTheDocument();
    expect(screen.getByText('Interactive')).toBeInTheDocument();
  });

  it('should render all palette items', () => {
    render(<ComponentPalette />);
    
    PALETTE_ITEMS.forEach(item => {
      expect(screen.getByText(item.label)).toBeInTheDocument();
    });
  });

  it('should render the correct number of items', () => {
    render(<ComponentPalette />);
    // Find all elements with the 'cursor-grab' class, which is on each draggable item
    const draggableItems = screen.getAllByRole('generic', { name: '' }).filter(
        el => el.classList.contains('cursor-grab')
    );
    expect(draggableItems.length).toBe(PALETTE_ITEMS.length);
  });
});
