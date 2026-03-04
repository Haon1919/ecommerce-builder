import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { KanbanBoard } from './KanbanBoard';
import { ticketsApi } from '@/lib/api';

// --- Mocks ---
jest.mock('@/lib/api');
jest.mock('date-fns', () => ({
  formatDistanceToNow: () => '2 days ago',
}));

const mockedTicketsApi = ticketsApi as jest.Mocked<typeof ticketsApi>;

const queryClient = new QueryClient({
    defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
    }
});
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

const sampleTicket = {
  id: 'ticket-1',
  ticketNumber: 'TKT-001',
  title: 'My computer is on fire',
  description: 'Help, it is very hot.',
  status: 'OPEN' as const,
  priority: 'CRITICAL' as const,
  createdAt: new Date().toISOString(),
  store: { name: 'Test Store', slug: 'test-store' },
  comments: [],
};

const kanbanData = {
    OPEN: [sampleTicket],
    IN_PROGRESS: [],
    WAITING_FOR_INFO: [],
    RESOLVED: [],
    CLOSED: [],
};

describe('KanbanBoard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
  });

  it('renders columns and basic ticket information', () => {
    render(<KanbanBoard kanban={kanbanData} />, { wrapper });
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    // Check that the ticket is rendered in the "Open" column
    expect(screen.getByText('My computer is on fire')).toBeInTheDocument();
    expect(screen.getByText('TKT-001')).toBeInTheDocument();
  });

  it('expands a ticket to show details and comment form', () => {
    render(<KanbanBoard kanban={kanbanData} />, { wrapper });
    
    // Description is initially hidden
    expect(screen.queryByText('Help, it is very hot.')).not.toBeInTheDocument();

    // Find the expand button within the card
    const ticketCard = screen.getByText('My computer is on fire').closest('div');
    const expandButton = ticketCard?.querySelector('button');
    expect(expandButton).not.toBeNull();
    fireEvent.click(expandButton!);

    // Now description and comment form should be visible
    expect(screen.getByText('Help, it is very hot.')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Add a note...')).toBeInTheDocument();
  });

  it('calls the move mutation when a move button is clicked', async () => {
    mockedTicketsApi.updateStatus.mockResolvedValue({} as any);
    render(<KanbanBoard kanban={kanbanData} />, { wrapper });

    const ticketCard = screen.getByText('My computer is on fire').closest('div');
    const expandButton = ticketCard?.querySelector('button');
    fireEvent.click(expandButton!);

    const moveButton = screen.getByRole('button', { name: /→ In Progress/i });
    fireEvent.click(moveButton);

    await waitFor(() => {
      expect(mockedTicketsApi.updateStatus).toHaveBeenCalledWith('ticket-1', 'IN_PROGRESS');
    });
  });

  it('calls the addComment mutation when a comment is saved', async () => {
    mockedTicketsApi.addComment.mockResolvedValue({} as any);
    render(<KanbanBoard kanban={kanbanData} />, { wrapper });

    const ticketCard = screen.getByText('My computer is on fire').closest('div');
    const expandButton = ticketCard?.querySelector('button');
    fireEvent.click(expandButton!);

    const textarea = screen.getByPlaceholderText('Add a note...');
    fireEvent.change(textarea, { target: { value: 'Test comment' } });

    const saveButton = screen.getByRole('button', { name: 'Save' });
    fireEvent.click(saveButton);

    await waitFor(() => {
        expect(mockedTicketsApi.addComment).toHaveBeenCalledWith('ticket-1', 'Test comment', false);
    });
  });
});