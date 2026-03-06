'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { storesApi } from '@/lib/api';
import { Building2, ToggleLeft, ToggleRight, ExternalLink, Package, ShoppingCart, Users, Plus, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function TenantsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [formData, setFormData] = useState({
    storeName: '', storeSlug: '', ownerName: '', ownerEmail: '', ownerPassword: ''
  });

  const { data, isLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => storesApi.list(),
    refetchInterval: 60000,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ storeId, active }: { storeId: string; active: boolean }) =>
      storesApi.toggleActive(storeId, active),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tenants'] }),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => storesApi.createStore(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenants'] });
      setIsModalOpen(false);
      setFormData({ storeName: '', storeSlug: '', ownerName: '', ownerEmail: '', ownerPassword: '' });
      setErrorMsg('');
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.error || 'Failed to create store');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    createMutation.mutate(formData);
  };

  const stores = (data?.stores ?? []).filter((s: { name: string; slug: string }) =>
    !filter || s.name.toLowerCase().includes(filter.toLowerCase()) || s.slug.includes(filter.toLowerCase())
  );

  const STORE_URL = process.env.NEXT_PUBLIC_STORE_URL || 'http://localhost:3003';
  const ADMIN_URL = process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:3002';

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Tenants</h1>
          <p className="text-gray-400 mt-1 text-sm">{data?.total ?? 0} registered stores</p>
        </div>
        <div className="flex items-center gap-4">
          <input
            className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500 w-64"
            placeholder="Search stores..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Store
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="card-dark p-5 animate-pulse h-24" />)}
        </div>
      ) : stores.length === 0 ? (
        <div className="card-dark p-12 text-center text-gray-600">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>No stores found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {stores.map((store: {
            id: string; slug: string; name: string; active: boolean; configured: boolean;
            theme: string; createdAt: string;
            _count: { products: number; orders: number; users: number };
          }) => (
            <div key={store.id} className="card-dark p-5 flex items-center gap-5">
              <div className="w-10 h-10 rounded-xl bg-violet-900/50 flex items-center justify-center flex-shrink-0">
                <span className="text-violet-300 font-bold">{store.name[0].toUpperCase()}</span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-white truncate">{store.name}</h3>
                  <span className="text-xs text-gray-500 font-mono">/{store.slug}</span>
                  {!store.configured && (
                    <span className="text-xs text-amber-400 bg-amber-900/30 px-2 py-0.5 rounded-full">Unconfigured</span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><Package className="w-3 h-3" />{store._count.products} products</span>
                  <span className="flex items-center gap-1"><ShoppingCart className="w-3 h-3" />{store._count.orders} orders</span>
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" />{store._count.users} users</span>
                  <span>Theme: {store.theme}</span>
                  <span>Since {formatDistanceToNow(new Date(store.createdAt), { addSuffix: true })}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <a href={`${STORE_URL}/${store.slug}`} target="_blank" rel="noopener noreferrer"
                  className="p-2 text-gray-500 hover:text-gray-300 hover:bg-gray-700 rounded-lg transition-colors">
                  <ExternalLink className="w-4 h-4" />
                </a>

                <button
                  onClick={() => toggleMutation.mutate({ storeId: store.id, active: !store.active })}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${store.active ? 'bg-green-900/30 text-green-400 hover:bg-red-900/30 hover:text-red-400' : 'bg-red-900/30 text-red-400 hover:bg-green-900/30 hover:text-green-400'
                    }`}
                >
                  {store.active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                  {store.active ? 'Active' : 'Disabled'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-md shadow-2xl relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold text-white mb-6">Create New Store</h2>

            {errorMsg && (
              <div className="mb-4 p-3 bg-red-900/30 border border-red-900/50 rounded-lg text-sm text-red-400">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-left">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Store Name</label>
                <input
                  required
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  value={formData.storeName}
                  onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Store Slug</label>
                <input
                  required
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  value={formData.storeSlug}
                  onChange={(e) => setFormData({ ...formData, storeSlug: e.target.value })}
                />
              </div>
              <div className="border-t border-gray-800 pt-4 mt-4">
                <h3 className="text-sm font-semibold text-gray-400 mb-3">Owner Details</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Owner Name</label>
                    <input
                      required
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                      value={formData.ownerName}
                      onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Owner Email</label>
                    <input
                      required type="email"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                      value={formData.ownerEmail}
                      onChange={(e) => setFormData({ ...formData, ownerEmail: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Owner Password</label>
                    <input
                      required type="password" minLength={8}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                      value={formData.ownerPassword}
                      onChange={(e) => setFormData({ ...formData, ownerPassword: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Creating...' : 'Create Store'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
