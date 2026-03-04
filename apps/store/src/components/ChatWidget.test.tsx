import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ChatWidget } from './ChatWidget';
import { useCartStore } from '@/lib/cart';
import { chatApi } from '@/lib/api';

// jsdom does not implement scrollIntoView
window.HTMLElement.prototype.scrollIntoView = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('next/image', () => ({
  default: ({ src, alt, ...props }: any) => <img src={src} alt={alt} {...props} />,
}));

jest.mock('@/lib/cart');
const mockedUseCartStore = useCartStore as unknown as jest.Mock;

jest.mock('@/lib/api', () => ({
  chatApi: {
    sendMessage: jest.fn(),
  },
  productsApi: {
    batch: jest.fn().mockResolvedValue({ products: [] }),
  },
}));

const mockChatSendMessage = chatApi.sendMessage as jest.Mock;

const defaultProps = {
  storeId: 'store-1',
  storeName: 'Test Store',
  storeSlug: 'test-store',
};

describe('ChatWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseCartStore.mockImplementation((selector: any) =>
      selector({ addItem: jest.fn() })
    );
  });

  it('renders the floating open button when closed', () => {
    render(<ChatWidget {...defaultProps} />);
    expect(screen.getByRole('button', { name: /open ai chat assistant/i })).toBeInTheDocument();
  });

  it('does not show the chat window initially', () => {
    render(<ChatWidget {...defaultProps} />);
    expect(screen.queryByText(/ai-powered/i)).not.toBeInTheDocument();
  });

  it('opens the chat window when the floating button is clicked', () => {
    render(<ChatWidget {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /open ai chat assistant/i }));
    expect(screen.getByText('Test Store Assistant')).toBeInTheDocument();
  });

  it('shows the greeting message after opening', () => {
    render(<ChatWidget {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /open ai chat assistant/i }));
    expect(screen.getByText(/personal shopping assistant for Test Store/i)).toBeInTheDocument();
  });

  it('shows suggestion buttons when only the greeting is present', () => {
    render(<ChatWidget {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /open ai chat assistant/i }));
    expect(screen.getByRole('button', { name: /what's on sale/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /help me find a gift/i })).toBeInTheDocument();
  });

  it('closes the chat window when the close button is clicked', () => {
    render(<ChatWidget {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /open ai chat assistant/i }));
    expect(screen.getByText('Test Store Assistant')).toBeInTheDocument();

    // When the chat is open, buttons in DOM order are:
    // [0] Minimize, [1] Close (X), then suggestion/mic/send buttons
    const allButtons = screen.getAllByRole('button');
    fireEvent.click(allButtons[1]); // close (X) button is second

    expect(screen.queryByText('Test Store Assistant')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open ai chat assistant/i })).toBeInTheDocument();
  });

  it('updates the input field as the user types', () => {
    render(<ChatWidget {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /open ai chat assistant/i }));

    const input = screen.getByPlaceholderText(/ask me anything/i);
    fireEvent.change(input, { target: { value: 'Do you have blue shoes?' } });
    expect(input).toHaveValue('Do you have blue shoes?');
  });

  it('sends a message and displays the user message in the chat', async () => {
    mockChatSendMessage.mockResolvedValue({
      sessionId: 'sess-1',
      message: 'Yes, we have blue shoes!',
      action: null,
    });

    render(<ChatWidget {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /open ai chat assistant/i }));

    const input = screen.getByPlaceholderText(/ask me anything/i);
    fireEvent.change(input, { target: { value: 'Do you have blue shoes?' } });

    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    });

    expect(screen.getByText('Do you have blue shoes?')).toBeInTheDocument();
  });

  it('displays the assistant reply after sending a message', async () => {
    mockChatSendMessage.mockResolvedValue({
      sessionId: 'sess-1',
      message: 'Yes, we have blue shoes in size 10!',
      action: null,
    });

    render(<ChatWidget {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /open ai chat assistant/i }));

    const input = screen.getByPlaceholderText(/ask me anything/i);
    fireEvent.change(input, { target: { value: 'Blue shoes?' } });

    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    });

    await waitFor(() => {
      expect(screen.getByText('Yes, we have blue shoes in size 10!')).toBeInTheDocument();
    });
  });

  it('clears the input after sending a message', async () => {
    mockChatSendMessage.mockResolvedValue({
      sessionId: 'sess-1',
      message: 'Reply here.',
      action: null,
    });

    render(<ChatWidget {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /open ai chat assistant/i }));

    const input = screen.getByPlaceholderText(/ask me anything/i);
    fireEvent.change(input, { target: { value: 'Test message' } });

    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    });

    await waitFor(() => {
      expect(input).toHaveValue('');
    });
  });

  it('shows a loading indicator while waiting for the API response', async () => {
    let resolveMessage: (v: any) => void;
    const pendingPromise = new Promise((res) => { resolveMessage = res; });
    mockChatSendMessage.mockReturnValue(pendingPromise);

    render(<ChatWidget {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /open ai chat assistant/i }));

    const input = screen.getByPlaceholderText(/ask me anything/i);
    fireEvent.change(input, { target: { value: 'Hello?' } });

    act(() => {
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    });

    // Loading dots should appear (3 animated divs in the loading bubble)
    await waitFor(() => {
      const loadingBubble = document.querySelector('.animate-bounce');
      expect(loadingBubble).toBeInTheDocument();
    });

    // Resolve so we don't have dangling promises
    await act(async () => {
      resolveMessage!({ sessionId: 'sess-1', message: 'Hi!', action: null });
    });
  });

  it('shows an error message when the API call fails', async () => {
    mockChatSendMessage.mockRejectedValue(new Error('Network error'));

    render(<ChatWidget {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /open ai chat assistant/i }));

    const input = screen.getByPlaceholderText(/ask me anything/i);
    fireEvent.change(input, { target: { value: 'Hello?' } });

    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    });

    await waitFor(() => {
      expect(
        screen.getByText(/having trouble connecting/i)
      ).toBeInTheDocument();
    });
  });

  it('sends a message when a suggestion button is clicked', async () => {
    mockChatSendMessage.mockResolvedValue({
      sessionId: 'sess-1',
      message: 'Here are our sale items.',
      action: null,
    });

    render(<ChatWidget {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /open ai chat assistant/i }));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /what's on sale/i }));
    });

    expect(mockChatSendMessage).toHaveBeenCalledWith(
      'store-1',
      "What's on sale?",
      undefined,
      undefined
    );
  });

  it('does not send an empty message', async () => {
    render(<ChatWidget {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /open ai chat assistant/i }));

    const input = screen.getByPlaceholderText(/ask me anything/i);
    // Input is empty, press Enter
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(mockChatSendMessage).not.toHaveBeenCalled();
  });
});
