'use client';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PromotionBuilder } from './PromotionBuilder';
import '@testing-library/jest-dom';

describe('PromotionBuilder', () => {
    const mockOnSave = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should render correctly with default values', () => {
        render(<PromotionBuilder onSave={mockOnSave} isSaving={false} />);
        expect(screen.getByText('Basic Information')).toBeInTheDocument();
        expect(screen.getByText('Promotion Logic')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('e.g. SUMMER25')).toBeInTheDocument();
    });

    it('should allow adding and removing conditions', async () => {
        render(<PromotionBuilder onSave={mockOnSave} isSaving={false} />);

        const addButton = screen.getByRole('button', { name: /Add Requirement/i });
        fireEvent.click(addButton);

        expect(screen.getByText('Subtotal is at least')).toBeInTheDocument();


        const trashButtons = screen.getAllByRole('button');
        const trashButton = trashButtons.find(b => b.innerHTML.includes('svg')); // Lukewarm way to find it
        if (trashButton) fireEvent.click(trashButton);

        await waitFor(() => {
            expect(screen.queryByText('Subtotal is at least')).not.toBeInTheDocument();
        });
    });

    it('should update promotion data and call onSave', async () => {
        render(<PromotionBuilder onSave={mockOnSave} isSaving={false} />);

        // Update code
        const codeInput = screen.getByPlaceholderText('e.g. SUMMER25');
        fireEvent.change(codeInput, { target: { value: 'NEWCODE' } });

        // Save
        const saveButton = screen.getByRole('button', { name: /Save Promotion/i });
        fireEvent.click(saveButton);

        expect(mockOnSave).toHaveBeenCalledWith(expect.objectContaining({
            code: 'NEWCODE'
        }));
    });
});
