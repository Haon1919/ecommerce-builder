import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Select } from './Select';

const mockOptions = [
    { label: 'Option 1', value: 'opt1' },
    { label: 'Option 2', value: 'opt2' },
    { label: 'Option 3', value: 'opt3' },
];

describe('Select Component', () => {
    it('renders the placeholder when no value is selected', () => {
        const handleChange = jest.fn();
        render(<Select options={mockOptions} onChange={handleChange} placeholder="Choose something" />);
        expect(screen.getByText('Choose something')).toBeInTheDocument();
    });

    it('renders the selected option label when value matches', () => {
        const handleChange = jest.fn();
        render(<Select options={mockOptions} onChange={handleChange} value="opt2" />);
        expect(screen.getByText('Option 2')).toBeInTheDocument();
    });

    it('opens the dropdown on click', async () => {
        const user = userEvent.setup();
        const handleChange = jest.fn();
        render(<Select options={mockOptions} onChange={handleChange} />);

        // Dropdown should be closed initially
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

        // Click button
        const button = screen.getByRole('button');
        await user.click(button);

        // Dropdown opens
        expect(screen.getByRole('listbox')).toBeInTheDocument();
        expect(screen.getByText('Option 1')).toBeInTheDocument();
    });

    it('calls onChange when an option is selected and closes dropdown', async () => {
        const user = userEvent.setup();
        const handleChange = jest.fn();
        render(<Select options={mockOptions} onChange={handleChange} />);

        // Open dropdown
        const button = screen.getByRole('button');
        await user.click(button);

        // Select option 3
        const option3 = screen.getByTestId('select-option-opt3');
        await user.click(option3);

        expect(handleChange).toHaveBeenCalledWith('opt3');
        // Dropdown closes
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('handles keyboard enter to open dropdown', async () => {
        const user = userEvent.setup();
        const handleChange = jest.fn();
        render(<Select options={mockOptions} onChange={handleChange} />);

        const button = screen.getByRole('button');
        button.focus();

        await user.keyboard('{Enter}');
        expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('closes when escape key is pressed', async () => {
        const user = userEvent.setup();
        const handleChange = jest.fn();
        render(<Select options={mockOptions} onChange={handleChange} />);

        // Open
        const button = screen.getByRole('button');
        await user.click(button);
        expect(screen.getByRole('listbox')).toBeInTheDocument();

        // Escape
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('closes when clicking outside', async () => {
        const user = userEvent.setup();
        const handleChange = jest.fn();
        render(
            <div>
                <div data-testid="outside">Outside</div>
                <Select options={mockOptions} onChange={handleChange} />
            </div>
        );

        // Open
        const button = screen.getByRole('button');
        await user.click(button);
        expect(screen.getByRole('listbox')).toBeInTheDocument();

        // Click outside
        const outside = screen.getByTestId('outside');
        await user.click(outside);

        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('is disabled properly', async () => {
        const user = userEvent.setup();
        const handleChange = jest.fn();
        render(<Select options={mockOptions} onChange={handleChange} disabled />);

        const button = screen.getByRole('button');
        expect(button).toBeDisabled();

        await user.click(button);
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
});
