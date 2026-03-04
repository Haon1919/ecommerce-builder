'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth';
import { pricelistsApi, productsApi } from '@/lib/api';
import type { PriceList, Product } from '@/types';
import { Plus, Edit, Trash2, Banknote } from 'lucide-react';

function PriceListForm({ priceList, products, onSave, onCancel }: {
    priceList?: PriceList | null;
    products: Product[];
    onSave: (data: Partial<PriceList>) => void;
    onCancel: () => void;
}) {
    const [form, setForm] = useState({
        name: priceList?.name ?? '',
        description: priceList?.description ?? '',
        prices: priceList?.prices ?? {} as Record<string, number>,
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(form);
    };

    const handlePriceChange = (productId: string, value: string) => {
        setForm(prev => {
            const newPrices = { ...prev.prices };
            if (!value) {
                delete newPrices[productId];
            } else {
                newPrices[productId] = parseFloat(value);
            }
            return { ...prev, prices: newPrices };
        });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
                <div>
                    <label className="label">Price List Name *</label>
                    <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div>
                    <label className="label">Description</label>
                    <textarea className="input resize-none" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional" />
                </div>
            </div>

            <div>
                <h3 className="text-sm border-b pb-2 mb-4 font-semibold text-gray-700">Override Product Prices</h3>
                <div className="max-h-80 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100">
                    {products.map(product => {
                        const currentOverride = form.prices[product.id];
                        return (
                            <div key={product.id} className="flex items-center justify-between p-3 flex-wrap gap-4 hover:bg-gray-50">
                                <div className="min-w-0 flex-1">
                                    <p className="font-medium text-sm text-gray-900 truncate">{product.name}</p>
                                    <p className="text-xs text-gray-500">Retail: ${Number(product.price).toFixed(2)}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-500">$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        placeholder="Auto (Retail)"
                                        className="input py-1 px-2 text-sm w-32"
                                        value={currentOverride ?? ''}
                                        onChange={(e) => handlePriceChange(product.id, e.target.value)}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">Save Price List</button>
                <button type="button" onClick={onCancel} className="btn-secondary px-6">Cancel</button>
            </div>
        </form>
    );
}

export default function PriceListsPage() {
    const store = useAuthStore((s) => s.store);
    const qc = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [editList, setEditList] = useState<PriceList | null>(null);

    const { data: priceLists = [], isLoading } = useQuery({
        queryKey: ['pricelists', store?.id],
        queryFn: () => pricelistsApi.list(store!.id),
        enabled: !!store?.id,
    });

    const { data: productsData } = useQuery({
        queryKey: ['products', store?.id],
        queryFn: () => productsApi.list(store!.id),
        enabled: !!store?.id,
    });

    const products: Product[] = productsData?.products || [];

    const createMutation = useMutation({
        mutationFn: (data: Partial<PriceList>) => pricelistsApi.create(store!.id, data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['pricelists', store?.id] }); setShowForm(false); },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<PriceList> }) => pricelistsApi.update(store!.id, id, data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['pricelists', store?.id] }); setEditList(null); },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => pricelistsApi.delete(store!.id, id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['pricelists', store?.id] }),
    });

    return (
        <div className="p-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Price Lists</h1>
                    <p className="text-gray-500 mt-1">Manage B2B pricing overrides ({priceLists.length})</p>
                </div>
                <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 text-sm">
                    <Plus className="w-4 h-4" /> Add Price List
                </button>
            </div>

            {(showForm || editList) && (
                <div className="card p-6 mb-6">
                    <h2 className="font-semibold text-gray-900 mb-4">{editList ? 'Edit Price List' : 'Add New Price List'}</h2>
                    <PriceListForm
                        priceList={editList}
                        products={products}
                        onSave={(data) => editList ? updateMutation.mutate({ id: editList.id, data }) : createMutation.mutate(data)}
                        onCancel={() => { setShowForm(false); setEditList(null); }}
                    />
                </div>
            )}

            <div className="card overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="text-left px-6 py-3 font-semibold text-gray-600">Price List Name</th>
                            <th className="text-left px-4 py-3 font-semibold text-gray-600">Description</th>
                            <th className="text-right px-4 py-3 font-semibold text-gray-600">Overrides</th>
                            <th className="px-4 py-3" />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {isLoading ? (
                            <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-400">Loading...</td></tr>
                        ) : priceLists.length === 0 ? (
                            <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-400">No price lists found. Create one above!</td></tr>
                        ) : (
                            priceLists.map((list: PriceList) => (
                                <tr key={list.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-green-100 text-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                                <Banknote className="w-4 h-4" />
                                            </div>
                                            <p className="font-medium text-gray-900">{list.name}</p>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-gray-500">{list.description || '—'}</td>
                                    <td className="px-4 py-4 text-right">
                                        <span className="inline-block px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">
                                            {Object.keys(list.prices || {}).length} items
                                        </span>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-center justify-end gap-1">
                                            <button onClick={() => setEditList(list)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => deleteMutation.mutate(list.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
