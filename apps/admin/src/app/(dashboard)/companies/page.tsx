'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth';
import { companiesApi, pricelistsApi } from '@/lib/api';
import type { Company, PriceList } from '@/types';
import { Plus, Edit, Trash2, Building } from 'lucide-react';

function CompanyForm({ company, priceLists, onSave, onCancel }: {
    company?: Company | null;
    priceLists: PriceList[];
    onSave: (data: Partial<Company>) => void;
    onCancel: () => void;
}) {
    const [form, setForm] = useState({
        name: company?.name ?? '',
        taxId: company?.taxId ?? '',
        creditLimit: company?.creditLimit ?? 0,
        priceListId: company?.priceListId ?? '',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            ...form,
            priceListId: form.priceListId || null,
        });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="label">Company Name *</label>
                    <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div>
                    <label className="label">Tax ID</label>
                    <input className="input" value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} placeholder="Optional" />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="label">Credit Limit ($)</label>
                    <input className="input" type="number" step="0.01" min="0" value={form.creditLimit} onChange={(e) => setForm({ ...form, creditLimit: parseFloat(e.target.value) })} required />
                </div>
                <div>
                    <label className="label">Assigned Price List</label>
                    <select className="input" value={form.priceListId} onChange={(e) => setForm({ ...form, priceListId: e.target.value })}>
                        <option value="">None (Standard Retail)</option>
                        {priceLists.map(pl => (
                            <option key={pl.id} value={pl.id}>{pl.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">Save Company</button>
                <button type="button" onClick={onCancel} className="btn-secondary px-6">Cancel</button>
            </div>
        </form>
    );
}

export default function CompaniesPage() {
    const store = useAuthStore((s) => s.store);
    const qc = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [editCompany, setEditCompany] = useState<Company | null>(null);

    const { data: companies = [], isLoading } = useQuery({
        queryKey: ['companies', store?.id],
        queryFn: () => companiesApi.list(store!.id),
        enabled: !!store?.id,
    });

    const { data: priceLists = [] } = useQuery({
        queryKey: ['pricelists', store?.id],
        queryFn: () => pricelistsApi.list(store!.id),
        enabled: !!store?.id,
    });

    const createMutation = useMutation({
        mutationFn: (data: Partial<Company>) => companiesApi.create(store!.id, data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['companies', store?.id] }); setShowForm(false); },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<Company> }) => companiesApi.update(store!.id, id, data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['companies', store?.id] }); setEditCompany(null); },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => companiesApi.delete(store!.id, id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['companies', store?.id] }),
    });

    return (
        <div className="p-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Companies</h1>
                    <p className="text-gray-500 mt-1">Manage B2B wholesale partners ({companies.length})</p>
                </div>
                <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 text-sm">
                    <Plus className="w-4 h-4" /> Add Company
                </button>
            </div>

            {(showForm || editCompany) && (
                <div className="card p-6 mb-6">
                    <h2 className="font-semibold text-gray-900 mb-4">{editCompany ? 'Edit Company' : 'Add New Company'}</h2>
                    <CompanyForm
                        company={editCompany}
                        priceLists={priceLists}
                        onSave={(data) => editCompany ? updateMutation.mutate({ id: editCompany.id, data }) : createMutation.mutate(data)}
                        onCancel={() => { setShowForm(false); setEditCompany(null); }}
                    />
                </div>
            )}

            <div className="card overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="text-left px-6 py-3 font-semibold text-gray-600">Company Name</th>
                            <th className="text-left px-4 py-3 font-semibold text-gray-600">Tax ID</th>
                            <th className="text-right px-4 py-3 font-semibold text-gray-600">Credit Limit</th>
                            <th className="text-left px-4 py-3 font-semibold text-gray-600">Price List</th>
                            <th className="px-4 py-3" />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {isLoading ? (
                            <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400">Loading...</td></tr>
                        ) : companies.length === 0 ? (
                            <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400">No companies found. Create one above!</td></tr>
                        ) : (
                            companies.map((company: Company) => (
                                <tr key={company.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                                <Building className="w-4 h-4" />
                                            </div>
                                            <p className="font-medium text-gray-900">{company.name}</p>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-gray-500">{company.taxId || '—'}</td>
                                    <td className="px-4 py-4 text-right font-medium">
                                        ${Number(company.creditLimit).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-4">
                                        {company.priceList ? (
                                            <span className="inline-block px-2.5 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                                                {company.priceList.name}
                                            </span>
                                        ) : (
                                            <span className="text-gray-400 italic">Standard</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-center justify-end gap-1">
                                            <button onClick={() => setEditCompany(company)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => deleteMutation.mutate(company.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
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
