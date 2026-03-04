import { render, screen, fireEvent } from '@testing-library/react';
import { PropertyPanel } from './PropertyPanel';
import type { PageComponent } from '@/types';

// Mock props
const mockOnChange = jest.fn();
const mockOnDelete = jest.fn();
const mockOnClose = jest.fn();

const headingComponent: PageComponent = {
  id: 'comp-heading-1',
  type: 'Heading',
  order: 0,
  props: { text: 'Initial Heading', level: 'h2', align: 'left', color: '#000000' },
};

const imageComponent: PageComponent = {
    id: 'comp-image-1',
    type: 'Image',
    order: 1,
    props: { src: 'https://example.com/img.png', alt: 'Test Image' },
};

const noFieldsComponent: PageComponent = {
    id: 'comp-no-fields-1',
    type: 'TwoColumns', // A component type with no fields defined in COMPONENT_FIELDS
    order: 2,
    props: {},
}

describe('PropertyPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the component type and title', () => {
    render(<PropertyPanel component={headingComponent} onChange={mockOnChange} onDelete={mockOnDelete} onClose={mockOnClose} />);
    expect(screen.getByText('Heading')).toBeInTheDocument();
    expect(screen.getByText('Edit properties')).toBeInTheDocument();
  });

  it('should render the correct fields for a Heading component', () => {
    render(<PropertyPanel component={headingComponent} onChange={mockOnChange} onDelete={mockOnDelete} onClose={mockOnClose} />);
    expect(screen.getByLabelText('Text')).toBeInTheDocument();
    expect(screen.getByLabelText('Heading Level')).toBeInTheDocument();
    expect(screen.getByLabelText('Alignment')).toBeInTheDocument();
    expect(screen.getByLabelText('Color')).toBeInTheDocument();
  });

  it('should render the correct fields for an Image component', () => {
    render(<PropertyPanel component={imageComponent} onChange={mockOnChange} onDelete={mockOnDelete} onClose={mockOnClose} />);
    expect(screen.getByLabelText('Image URL')).toBeInTheDocument();
    expect(screen.getByLabelText('Alt Text')).toBeInTheDocument();
  });

  it('should show a message if a component has no editable properties', () => {
    render(<PropertyPanel component={noFieldsComponent} onChange={mockOnChange} onDelete={mockOnDelete} onClose={mockOnClose} />);
    expect(screen.getByText('No editable properties for this component.')).toBeInTheDocument();
  });

  it('should call onChange with the full updated props object when a text input changes', () => {
    render(<PropertyPanel component={headingComponent} onChange={mockOnChange} onDelete={mockOnDelete} onClose={mockOnClose} />);
    
    const textInput = screen.getByLabelText('Text');
    fireEvent.change(textInput, { target: { value: 'New Heading Text' } });

    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange).toHaveBeenCalledWith('comp-heading-1', {
      ...headingComponent.props,
      text: 'New Heading Text',
    });
  });

  it('should call onChange when a select input changes', () => {
    render(<PropertyPanel component={headingComponent} onChange={mockOnChange} onDelete={mockOnDelete} onClose={mockOnClose} />);
    
    const alignSelect = screen.getByLabelText('Alignment');
    fireEvent.change(alignSelect, { target: { value: 'center' } });

    expect(mockOnChange).toHaveBeenCalledWith('comp-heading-1', {
      ...headingComponent.props,
      align: 'center',
    });
  });

  it('should call onDelete with the component ID when delete button is clicked', () => {
    render(<PropertyPanel component={headingComponent} onChange={mockOnChange} onDelete={mockOnDelete} onClose={mockOnClose} />);
    
    const deleteButton = screen.getByTitle('Delete component');
    fireEvent.click(deleteButton);

    expect(mockOnDelete).toHaveBeenCalledTimes(1);
    expect(mockOnDelete).toHaveBeenCalledWith('comp-heading-1');
  });

  it('should call onClose when the close button is clicked', () => {
    render(<PropertyPanel component={headingComponent} onChange={mockOnChange} onDelete={mockOnDelete} onClose={mockOnClose} />);
    
    const closeButton = screen.getByRole('button', { name: /close properties panel/i });
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
