import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTable, Column } from './DataTable';

interface User {
    id: number;
    name: string;
    role: string;
}

const mockData: User[] = [
    { id: 1, name: 'Alice', role: 'Admin' },
    { id: 2, name: 'Bob', role: 'User' },
    { id: 3, name: 'Charlie', role: 'Manager' },
];

const mockColumns: Column<User>[] = [
    { header: 'ID', accessorKey: 'id' },
    { header: 'Name', accessorKey: 'name' },
    { header: 'Role', accessorKey: 'role' },
];

describe('DataTable Component', () => {
    it('renders table headers correctly', () => {
        render(<DataTable data={mockData} columns={mockColumns} />);
        expect(screen.getByText('ID')).toBeInTheDocument();
        expect(screen.getByText('Name')).toBeInTheDocument();
        expect(screen.getByText('Role')).toBeInTheDocument();
    });

    it('renders data rows correctly', () => {
        render(<DataTable data={mockData} columns={mockColumns} />);
        expect(screen.getByText('Alice')).toBeInTheDocument();
        expect(screen.getByText('Admin')).toBeInTheDocument();
    });

    it('handles empty state', () => {
        render(<DataTable data={[]} columns={mockColumns} />);
        expect(screen.getByText('No data available.')).toBeInTheDocument();
    });

    it('sorts data when header is clicked', async () => {
        const user = userEvent.setup();
        render(<DataTable data={mockData} columns={mockColumns} />);

        // Initial order should be Alice (1), Bob (2), Charlie (3)
        const rowsBefore = screen.getAllByTestId('data-table-row');
        expect(rowsBefore[0]).toHaveTextContent('Alice');

        // Click 'Name' to sort Ascending
        const nameHeader = screen.getByText('Name');
        await user.click(nameHeader);

        // Second click to sort Descending
        await user.click(nameHeader);

        const rowsAfterDesc = screen.getAllByTestId('data-table-row');
        expect(rowsAfterDesc[0]).toHaveTextContent('Charlie');
    });

    it('supports pagination', async () => {
        const user = userEvent.setup();
        const largeData = Array.from({ length: 15 }).map((_, i) => ({ id: i, name: `User ${i}`, role: 'User' }));

        render(<DataTable data={largeData} columns={mockColumns} rowsPerPage={10} />);

        // Should see exactly 10 rows
        expect(screen.getAllByTestId('data-table-row')).toHaveLength(10);
        expect(screen.getByText('User 0')).toBeInTheDocument();
        expect(screen.queryByText('User 10')).not.toBeInTheDocument();

        // Go to next page
        const nextBtn = screen.getByRole('button', { name: 'Next' });
        await user.click(nextBtn);

        // Should see 5 rows
        expect(screen.getAllByTestId('data-table-row')).toHaveLength(5);
        expect(screen.getByText('User 10')).toBeInTheDocument();
    });

    it('calls onRowClick when a row is clicked', async () => {
        const user = userEvent.setup();
        const handleRowClick = jest.fn();
        render(<DataTable data={mockData} columns={mockColumns} onRowClick={handleRowClick} />);

        const firstRow = screen.getAllByTestId('data-table-row')[0];
        await user.click(firstRow);

        expect(handleRowClick).toHaveBeenCalledWith(mockData[0]);
    });
});
