import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { DataTable } from './DataTable';

const meta: Meta<typeof DataTable> = {
    title: 'UI/DataTable',
    component: DataTable,
    tags: ['autodocs'],
    args: {
        onRowClick: fn(),
    },
};

export default meta;
type Story = StoryObj<typeof DataTable>;

const sampleData = [
    { id: '1', name: 'MacBook Pro 16"', status: 'In Stock', price: '$2499', vendor: 'Apple' },
    { id: '2', name: 'Dell XPS 15', status: 'Out of Stock', price: '$1899', vendor: 'Dell' },
    { id: '3', name: 'ThinkPad X1', status: 'In Stock', price: '$1699', vendor: 'Lenovo' },
    { id: '4', name: 'Surface Laptop 5', status: 'Low Stock', price: '$1299', vendor: 'Microsoft' },
    { id: '5', name: 'Razer Blade 15', status: 'In Stock', price: '$2299', vendor: 'Razer' },
    { id: '6', name: 'LG Gram 17', status: 'In Stock', price: '$1599', vendor: 'LG' },
];

const mockColumns = [
    { header: 'Product ID', accessorKey: 'id' },
    { header: 'Name', accessorKey: 'name' },
    {
        header: 'Vendor',
        accessorKey: 'vendor',
        cell: (item: any) => <span className="font-semibold text-primary">{item.vendor}</span>
    },
    {
        header: 'Status',
        accessorKey: 'status',
        cell: (item: any) => (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${item.status === 'In Stock' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' :
                    item.status === 'Low Stock' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' :
                        'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                }`}>
                {item.status}
            </span>
        )
    },
    { header: 'Price', accessorKey: 'price' },
];

export const Default: Story = {
    args: {
        data: sampleData,
        // @ts-ignore
        columns: mockColumns,
        defaultSortKey: 'name',
    },
};

export const Pagination: Story = {
    args: {
        data: [
            ...sampleData,
            { id: '7', name: 'Asus ROG', status: 'In Stock', price: '$1999', vendor: 'Asus' },
            { id: '8', name: 'HP Spectre x360', status: 'In Stock', price: '$1499', vendor: 'HP' },
            { id: '9', name: 'Samsung Galaxy Book3', status: 'Low Stock', price: '$1399', vendor: 'Samsung' },
            { id: '10', name: 'Alienware m16', status: 'In Stock', price: '$2199', vendor: 'Dell' },
            { id: '11', name: 'Acer Predator Helios', status: 'Out of Stock', price: '$1799', vendor: 'Acer' },
        ],
        // @ts-ignore
        columns: mockColumns,
        rowsPerPage: 5,
    },
};

export const EmptyState: Story = {
    args: {
        data: [],
        // @ts-ignore
        columns: mockColumns,
    },
};
