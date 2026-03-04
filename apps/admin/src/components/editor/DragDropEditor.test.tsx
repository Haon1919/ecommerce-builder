import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react';
import { DragDropEditor } from './DragDropEditor';

// --- Mocks ---
jest.mock('./ComponentPalette', () => ({
  ComponentPalette: () => <div data-testid="palette" />,
}));

jest.mock('./Canvas', () => ({
  Canvas: ({ onSelect }: { onSelect: (id: string) => void }) => (
    <div data-testid="canvas" onClick={() => onSelect('comp-1')} />
  ),
}));

jest.mock('./PropertyPanel', () => ({
  PropertyPanel: ({ onChange, onDelete, onClose }: {
    onChange: (id: string, props: any) => void;
    onDelete: (id: string) => void;
    onClose: () => void;
  }) => (
    <div data-testid="property-panel">
      <button onClick={() => onChange('comp-1', { text: 'new text' })}>Change</button>
      <button onClick={() => onDelete('comp-1')}>Delete</button>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

jest.mock('uuid', () => ({
  v4: () => 'mock-uuid-123',
}));

const mockOnSave = jest.fn().mockResolvedValue(undefined);

const initialLayout = [
  { id: 'comp-1', type: 'Text', order: 0, props: { text: 'Hello' } },
];

const renderEditor = (props = {}) => {
  const defaultProps = {
    pageId: 'page-1',
    pageTitle: 'Test Page',
    initialLayout: initialLayout,
    theme: 'TAILWIND',
    primaryColor: '#000000',
    onSave: mockOnSave,
  };
  return render(<DragDropEditor {...defaultProps} {...props} />);
};

describe('DragDropEditor', () => {
  beforeAll(() => {
    jest.useFakeTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('should render the main layout elements', () => {
    renderEditor();
    expect(screen.getByText('Test Page')).toBeInTheDocument();
    expect(screen.getByTestId('palette')).toBeInTheDocument();
    expect(screen.getByTestId('canvas')).toBeInTheDocument();
    expect(screen.queryByTestId('property-panel')).not.toBeInTheDocument();
    expect(screen.getByText('Select a component')).toBeInTheDocument();
  });

  it('should show the property panel when a component is selected', async () => {
    renderEditor();
    await act(async () => {
      fireEvent.click(screen.getByTestId('canvas'));
    });
    expect(screen.getByTestId('property-panel')).toBeInTheDocument();
  });

  it('should call onSave and show status when save button is clicked', async () => {
    renderEditor();
    await act(async () => {
      fireEvent.click(screen.getByText('Save'));
    });
    
    expect(mockOnSave).toHaveBeenCalledWith(initialLayout, false);
    await waitFor(() => expect(screen.getByText('✓ Saved')).toBeInTheDocument());

    act(() => {
      jest.runAllTimers();
    });
    await waitFor(() => expect(screen.queryByText('✓ Saved')).not.toBeInTheDocument());
  });
  
  it('should call onSave with publish flag when publish button is clicked', async () => {
    renderEditor();
    await act(async () => {
      fireEvent.click(screen.getByText('Publish'));
    });
    expect(mockOnSave).toHaveBeenCalledWith(initialLayout, true);
  });

  it('should update component props when PropertyPanel calls onChange', async () => {
    renderEditor();
    
    await act(async () => {
      fireEvent.click(screen.getByTestId('canvas'));
    });
    expect(screen.getByTestId('property-panel')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText('Change'));
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Save'));
    });
    
    const expectedLayout = [
      { id: 'comp-1', type: 'Text', order: 0, props: { text: 'new text' } },
    ];
    expect(mockOnSave).toHaveBeenCalledWith(expectedLayout, false);
  });

  it('should delete a component when PropertyPanel calls onDelete', async () => {
    renderEditor();
    
    await act(async () => {
      fireEvent.click(screen.getByTestId('canvas'));
    });
    
    await act(async () => {
      fireEvent.click(screen.getByText('Delete'));
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Save'));
    });
    expect(mockOnSave).toHaveBeenCalledWith([], false);
  });

  it('should undo and redo actions', async () => {
    renderEditor();
    const undoButton = screen.getByRole('button', { name: 'Undo' });
    const redoButton = screen.getByRole('button', { name: 'Redo' });

    expect(undoButton).toBeDisabled();
    expect(redoButton).toBeDisabled();

    await act(async () => {
      fireEvent.click(screen.getByTestId('canvas'));
    });
    await act(async () => {
      fireEvent.click(screen.getByText('Delete'));
    });

    expect(undoButton).not.toBeDisabled();
    
    await act(async () => {
      fireEvent.click(undoButton);
    });
    
    expect(undoButton).toBeDisabled();
    expect(redoButton).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(screen.getByText('Save'));
    });
    expect(mockOnSave).toHaveBeenCalledWith(initialLayout, false);

    await act(async () => {
      fireEvent.click(redoButton);
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Save'));
    });
    expect(mockOnSave).toHaveBeenCalledWith([], false);
  });
});