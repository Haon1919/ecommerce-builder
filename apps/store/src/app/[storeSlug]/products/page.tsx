'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { storeApi, productsApi } from '@/lib/api';
import { Search, Filter } from 'lucide-react';
import { useCartStore } from '@/lib/cart';

export default function ProductsPage() {
  const params = useParams<{ storeSlug: string }>();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const addItem = useCartStore((s) => s.addItem);

  const { data: storeData } = useQuery({
    queryKey: ['store', params.storeSlug],
    queryFn: () => storeApi.getBySlug(params.storeSlug),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['products', storeData?.id, search, category],
    queryFn: () => {
      const p: Record<string, string> = { limit: '50' };
      if (search) p.search = search;
      if (category) p.category = category;
      return productsApi.list(storeData!.id, p);
    },
    enabled: !!storeData?.id,
  });

  const products = data?.products ?? [];
  const categories: string[] = data?.categories ?? [];

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <h1 className="text-4xl font-bold text-gray-900 mb-8">All Products</h1>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            className="w-full border border-gray-300 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:border-transparent"
            style={{ '--tw-ring-color': 'var(--primary)' } as React.CSSProperties}
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {categories.length > 0 && (
          <select
            className="border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 bg-white min-w-[180px]"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-square bg-gray-200 rounded-xl mb-3" />
              <div className="h-4 bg-gray-200 rounded mb-2" />
              <div className="h-4 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <div className="text-6xl mb-4">🛍</div>
          <p className="text-xl font-medium">No products found</p>
          {search && <p className="mt-2">Try a different search term</p>}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {products.map((product: Record<string, unknown>) => (
            <div key={product.id as string} className="group">
              <Link href={`/${params.storeSlug}/products/${product.id}`}>
                <div className="aspect-square overflow-hidden bg-gray-100 rounded-xl mb-3 border border-gray-100">
                  {(product.images as string[])?.[0] ? (
                    <img
                      src={(product.images as string[])[0]}
                      alt={product.name as string}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-5xl">🛍</div>
                  )}
                </div>
                <h3 className="font-medium text-gray-900 line-clamp-2 mb-1 group-hover:text-primary transition-colors" style={{ '--tw-text-opacity': '1' } as React.CSSProperties}>
                  {product.name as string}
                </h3>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-900">${Number(product.price).toFixed(2)}</span>
                  {(product.comparePrice as number) && (
                    <span className="text-sm text-gray-400 line-through">${Number(product.comparePrice).toFixed(2)}</span>
                  )}
                </div>
              </Link>
              <button
                onClick={() => addItem({
                  productId: product.id as string,
                  name: product.name as string,
                  price: Number(product.price),
                  quantity: 1,
                  image: (product.images as string[])?.[0],
                })}
                disabled={(product.stock as number) === 0}
                className="mt-2 w-full py-2 text-sm font-medium rounded-xl border transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white"
                style={{ backgroundColor: (product.stock as number) === 0 ? '#9ca3af' : 'var(--primary)' }}
              >
                {(product.stock as number) === 0 ? 'Out of Stock' : 'Add to Cart'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
