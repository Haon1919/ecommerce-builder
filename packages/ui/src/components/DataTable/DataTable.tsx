import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from './../Modal/Modal'; // Using the utility we created

export interface Column<T> {
    header: string;
    accessorKey: keyof T | string;
    cell?: (item: T) => React.ReactNode;
    sortable?: boolean;
}

export interface DataTableProps<T> {
    data: T[];
    columns: Column<T>[];
    className?: string;
    defaultSortKey?: keyof T | string;
    defaultSortDirection?: 'asc' | 'desc';
    onRowClick?: (item: T) => void;
    rowsPerPage?: number;
}

export function DataTable<T>({
    data,
    columns,
    className,
    defaultSortKey,
    defaultSortDirection = 'asc',
    onRowClick,
    rowsPerPage = 10,
}: DataTableProps<T>) {
    const [sortKey, setSortKey] = useState<keyof T | string | undefined>(defaultSortKey);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(defaultSortDirection);
    const [currentPage, setCurrentPage] = useState(1);

    const handleSort = (key: keyof T | string) => {
        if (sortKey === key) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDirection('asc');
        }
    };

    const sortedData = useMemo(() => {
        if (!sortKey) return data;

        return [...data].sort((a, b) => {
            // @ts-ignore
            const valA = a[sortKey];
            // @ts-ignore
            const valB = b[sortKey];

            if (valA === valB) return 0;

            const comparison = valA > valB ? 1 : -1;
            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }, [data, sortKey, sortDirection]);

    const totalPages = Math.ceil(data.length / rowsPerPage);
    const paginatedData = sortedData.slice(
        (currentPage - 1) * rowsPerPage,
        currentPage * rowsPerPage
    );

    return (
        <div className={cn("w-full overflow-hidden rounded-md border text-sm", className)}>
            <div className="overflow-x-auto">
                <table className="w-full text-left bg-card text-card-foreground">
                    <thead className="border-b bg-muted/50 text-muted-foreground">
                        <tr>
                            {columns.map((col, idx) => (
                                <th
                                    key={idx}
                                    className={cn(
                                        "px-4 py-3 font-medium transition-colors hover:text-foreground/80",
                                        col.sortable !== false && "cursor-pointer"
                                    )}
                                    onClick={() => col.sortable !== false && handleSort(col.accessorKey)}
                                >
                                    <div className="flex items-center space-x-1">
                                        <span>{col.header}</span>
                                        {col.sortable !== false && sortKey === col.accessorKey && (
                                            <span className="text-foreground">
                                                {sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                            </span>
                                        )}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedData.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} className="px-4 py-6 text-center text-muted-foreground">
                                    No data available.
                                </td>
                            </tr>
                        ) : (
                            paginatedData.map((item, rowIdx) => (
                                <tr
                                    key={rowIdx}
                                    onClick={() => onRowClick && onRowClick(item)}
                                    className={cn(
                                        "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
                                        onRowClick && "cursor-pointer"
                                    )}
                                    data-testid="data-table-row"
                                >
                                    {columns.map((col, colIdx) => (
                                        <td key={colIdx} className="px-4 py-3 align-middle">
                                            {col.cell ? col.cell(item) : String((item as any)[col.accessorKey] || '')}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t bg-card">
                    <div className="text-sm text-muted-foreground">
                        Showing {(currentPage - 1) * rowsPerPage + 1} to {Math.min(currentPage * rowsPerPage, data.length)} of {data.length} entries
                    </div>
                    <div className="flex space-x-2">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1 text-sm border rounded-md disabled:opacity-50 hover:bg-muted"
                        >
                            Previous
                        </button>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="px-3 py-1 text-sm border rounded-md disabled:opacity-50 hover:bg-muted"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
