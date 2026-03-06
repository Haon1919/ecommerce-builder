import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from './Modal';

describe('Modal Component', () => {
    const mockOnClose = jest.fn();

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('renders nothing when isOpen is false', () => {
        render(<Modal isOpen={false} onClose={mockOnClose} title="Test Title">Content</Modal>);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders the modal when isOpen is true', () => {
        render(<Modal isOpen={true} onClose={mockOnClose} title="My Modal">Modal Content</Modal>);
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('My Modal')).toBeInTheDocument();
        expect(screen.getByText('Modal Content')).toBeInTheDocument();
    });

    it('calls onClose when the close button is clicked', async () => {
        const user = userEvent.setup();
        render(<Modal isOpen={true} onClose={mockOnClose} title="Test">Content</Modal>);

        const closeBtn = screen.getByLabelText('Close');
        await user.click(closeBtn);
        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when clicking the backdrop', async () => {
        const user = userEvent.setup();
        render(<Modal isOpen={true} onClose={mockOnClose} title="Test">Content</Modal>);

        const backdrop = screen.getByTestId('modal-backdrop');
        await user.click(backdrop);
        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when the Escape key is pressed', async () => {
        const user = userEvent.setup();
        render(<Modal isOpen={true} onClose={mockOnClose} title="Test">Content</Modal>);

        await user.keyboard('{Escape}');
        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('does not render close button if hideCloseButton is true', () => {
        render(<Modal isOpen={true} onClose={mockOnClose} title="Test" hideCloseButton>Content</Modal>);
        expect(screen.queryByLabelText('Close')).not.toBeInTheDocument();
    });

    it('adds and removes overflow-hidden class on body', () => {
        const { unmount } = render(<Modal isOpen={true} onClose={mockOnClose} title="Test">Content</Modal>);
        expect(document.body.style.overflow).toBe('hidden');

        unmount();
        expect(document.body.style.overflow).toBe('');
    });
});
