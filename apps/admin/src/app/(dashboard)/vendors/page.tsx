'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth';
import { vendorsApi } from '@/lib/api';
import { Plus, Pencil } from 'lucide-react';

type Vendor = {
    id: string;
    name: string;
    description: string;
    logoUrl: string | null;
    stripeAccountId: string | null;
    payoutEnabled: boolean;
    active: boolean;
};

export default function VendorsPage() {
    const { store } = useAuthStore();
    const qc = useQueryClient();
    const [editing, setEditing] = useState<Vendor | null>(null);
    const [isNew, setIsNew] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        stripeAccountId: '',
        payoutEnabled: false,
        active: true,
    });

    const { data: vendors, isLoading } = useQuery({
        queryKey: ['vendors', store?.id],
        queryFn: () => vendorsApi.list(store!.id),
        enabled: !!store?.id,
    });

    const saveMutation = useMutation({
        mutationFn: (data: any) =>
            isNew
                ? vendorsApi.create(store!.id, data)
                : vendorsApi.update(store!.id, editing!.id, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['vendors', store?.id] });
            setEditing(null);
            setIsNew(false);
        },
    });

    const handleEdit = (v: Vendor) => {
        setEditing(v);
        setIsNew(false);
        setFormData({
            name: v.name,
            description: v.description || '',
            stripeAccountId: v.stripeAccountId || '',
            payoutEnabled: v.payoutEnabled,
            active: v.active,
        });
    };

    const handleCreate = () => {
        setIsNew(true);
        setEditing(null);
        setFormData({
            name: '',
            description: '',
            stripeAccountId: '',
            payoutEnabled: false,
            active: true,
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        saveMutation.mutate(formData);
    };

    if (store?.tier !== 'ENTERPRISE') {
        return (
            <div className="p-8">
                <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-6">
                    <h2 className="text-lg font-bold mb-2">Enterprise Feature</h2>
                    <p>Multi-vendor marketplace features are only available on the ENTERPRISE tier.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Vendors</h1>
                <button onClick={handleCreate} className="btn-primary flex items-center gap-2">
                    <Plus className="w-5 h-5" /> New Vendor
                </button>
            </div>

            {(isNew || editing) && (
                <div className="card p-6 mb-8 transform transition-all duration-300 translate-y-0 opacity-100">
                    <h2 className="font-bold text-lg mb-6">{isNew ? 'Create Vendor' : 'Edit Vendor'}</h2>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="label">Name</label>
                                <input required className="input" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                            </div>
                            <div className="row-span-2">
                                <label className="label">Description</label>
                                <textarea className="input h-32" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                            </div>
                            <div>
                                <label className="label">Stripe Account ID (or API Key)</label>
                                <input
                                    type="password"
                                    className="input font-mono"
                                    placeholder="acct_123456789 (stored securely)"
                                    value={formData.stripeAccountId}
                                    onChange={(e) => setFormData({ ...formData, stripeAccountId: e.target.value })}
                                />
                                <p className="text-xs text-gray-500 mt-1">Leave blank to keep current value if editing. ID is encrypted in the database.</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-6 p-4 bg-gray-50 rounded-lg border border-gray-100">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" className="w-5 h-5 text-primary-600 rounded" checked={formData.payoutEnabled} onChange={(e) => setFormData({ ...formData, payoutEnabled: e.target.checked })} />
                                <span className="font-medium text-gray-900">Enable Payouts via Stripe Connect</span>
                            </label>

                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" className="w-5 h-5 text-primary-600 rounded" checked={formData.active} onChange={(e) => setFormData({ ...formData, active: e.target.checked })} />
                                <span className="font-medium text-gray-900">Active</span>
                            </label>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                            <button type="button" onClick={() => { setIsNew(false); setEditing(null); }} className="btn-secondary">Cancel</button>
                            <button type="submit" disabled={saveMutation.isPending} className="btn-primary">
                                {saveMutation.isPending ? 'Saving...' : 'Save Vendor'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {isLoading ? (
                <div className="animate-pulse space-y-4">
                    <div className="h-16 bg-gray-200 rounded-lg"></div>
                    <div className="h-16 bg-gray-200 rounded-lg"></div>
                </div>
            ) : (vendors?.length === 0) ? (
                <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-200 rounded-xl">
                    <p>No vendors found. Create your first vendor to enable split cart checkout.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {vendors?.map((v: Vendor) => (
                        <div key={v.id} className="card p-5 flex items-center justify-between hover:border-primary-200 transition-colors">
                            <div>
                                <div className="flex items-center gap-3 mb-1">
                                    <h3 className="font-bold text-gray-900">{v.name}</h3>
                                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${v.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                                        {v.active ? 'Active' : 'Inactive'}
                                    </span>
                                    {v.payoutEnabled && (
                                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-100 text-indigo-700">Payouts Ready</span>
                                    )}
                                </div>
                                <div className="text-sm text-gray-500 flex items-center gap-4">
                                    {v.stripeAccountId ? (
                                        <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">💳 {v.stripeAccountId}</span>
                                    ) : (
                                        <span className="text-amber-600 text-xs flex items-center gap-1">⚠️ Missing Stripe Info</span>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={() => handleEdit(v)}
                                className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                                title="Edit Vendor"
                            >
                                <Pencil className="w-5 h-5" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
