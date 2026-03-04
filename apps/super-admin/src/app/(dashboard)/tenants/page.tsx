'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { storesApi } from '@/lib/api';
import { Building2, ToggleLeft, ToggleRight, ExternalLink, Package, ShoppingCart, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function TenantsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState('');

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
        <input
          className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500 w-64"
          placeholder="Search stores..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
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
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    store.active ? 'bg-green-900/30 text-green-400 hover:bg-red-900/30 hover:text-red-400' : 'bg-red-900/30 text-red-400 hover:bg-green-900/30 hover:text-green-400'
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
    </div>
  );
}
