'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth';
import { productsApi } from '@/lib/api';
import type { Product } from '@/types';
import { Plus, Edit, Trash2, Package, AlertTriangle, Search, Upload, Box } from 'lucide-react';

function ProductForm({ product, onSave, onCancel, onGenerate3D, isGenerating3D }: {
  product?: Product | null;
  onSave: (data: Partial<Product>) => void;
  onCancel: () => void;
  onGenerate3D?: (id: string) => void;
  isGenerating3D?: boolean;
}) {
  const [form, setForm] = useState({
    name: product?.name ?? '',
    description: product?.description ?? '',
    price: product?.price ?? 0,
    comparePrice: product?.comparePrice ?? undefined as number | undefined,
    stock: product?.stock ?? 0,
    category: product?.category ?? '',
    tags: product?.tags?.join(', ') ?? '',
    images: product?.images?.join('\n') ?? '',
    featured: product?.featured ?? false,
    active: product?.active ?? true,
    sku: product?.sku ?? '',
    arEnabled: product?.arEnabled ?? false,
    modelUrl: product?.modelUrl ?? '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...form,
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      images: form.images.split('\n').map((u) => u.trim()).filter(Boolean),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Product Name *</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div>
          <label className="label">SKU</label>
          <input className="input" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="Optional" />
        </div>
      </div>
      <div>
        <label className="label">Description</label>
        <textarea className="input resize-none" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="label">Price ($) *</label>
          <input className="input" type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) })} required />
        </div>
        <div>
          <label className="label">Compare Price ($)</label>
          <input className="input" type="number" step="0.01" min="0" value={form.comparePrice ?? ''} onChange={(e) => setForm({ ...form, comparePrice: e.target.value ? parseFloat(e.target.value) : undefined })} placeholder="Optional" />
        </div>
        <div>
          <label className="label">Stock</label>
          <input className="input" type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: parseInt(e.target.value) })} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Category</label>
          <input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
        </div>
        <div>
          <label className="label">Tags (comma-separated)</label>
          <input className="input" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="tag1, tag2, tag3" />
        </div>
      </div>
      <div>
        <label className="label">Image URLs (one per line)</label>
        <textarea className="input resize-none" rows={3} value={form.images} onChange={(e) => setForm({ ...form, images: e.target.value })} placeholder="https://example.com/image.jpg" />
      </div>

      {/* 3D AR Settings */}
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-4">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <Box className="w-4 h-4" /> 3D & AR Configuration
        </h3>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" className="rounded" checked={form.arEnabled} onChange={(e) => setForm({ ...form, arEnabled: e.target.checked })} />
          <span className="text-sm text-gray-700">Enable AR & 3D Viewer</span>
        </label>
        {form.arEnabled && (
          <div>
            <label className="label">3D Model URL (.glb or .usdz)</label>
            <div className="flex gap-2">
              <input className="input" value={form.modelUrl} onChange={(e) => setForm({ ...form, modelUrl: e.target.value })} placeholder="https://..." />
              {product?.id && (
                <button
                  type="button"
                  onClick={() => onGenerate3D?.(product.id)}
                  className="btn-secondary whitespace-nowrap"
                  disabled={isGenerating3D}
                >
                  {isGenerating3D ? 'Generating...' : 'Auto-Generate AI Model'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" className="rounded" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} />
          <span className="text-sm text-gray-700">Featured product</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" className="rounded" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
          <span className="text-sm text-gray-700">Active</span>
        </label>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="submit" className="btn-primary flex-1">Save Product</button>
        <button type="button" onClick={onCancel} className="btn-secondary px-6">Cancel</button>
      </div>
    </form>
  );
}

export default function InventoryPage() {
  const store = useAuthStore((s) => s.store);
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['products', store?.id, search],
    queryFn: () => productsApi.list(store!.id, search ? { search } : {}),
    enabled: !!store?.id,
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Product>) => productsApi.create(store!.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products', store?.id] }); setShowForm(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Product> }) => productsApi.update(store!.id, id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products', store?.id] }); setEditProduct(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => productsApi.delete(store!.id, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products', store?.id] }),
  });

  const generate3DMutation = useMutation({
    mutationFn: (id: string) => productsApi.generate3D(store!.id, id),
    onSuccess: () => {
      alert("3D model generation started! This will complete asynchronously.");
      setTimeout(() => qc.invalidateQueries({ queryKey: ['products', store?.id] }), 5500);
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || "Failed to generate 3D model");
    }
  });

  const products: Product[] = data?.products ?? [];
  const lowStock = products.filter((p) => p.stock <= 5 && p.stock > 0);
  const outOfStock = products.filter((p) => p.stock === 0);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-gray-500 mt-1">{products.length} products</p>
        </div>
        <div className="flex gap-3">
          <button className="btn-secondary text-sm flex items-center gap-2">
            <Upload className="w-4 h-4" /> Import CSV
          </button>
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Add Product
          </button>
        </div>
      </div>

      {/* Alerts */}
      {(lowStock.length > 0 || outOfStock.length > 0) && (
        <div className="flex gap-4 mb-6">
          {outOfStock.length > 0 && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span><strong>{outOfStock.length}</strong> products out of stock</span>
            </div>
          )}
          {lowStock.length > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
              <Package className="w-4 h-4 flex-shrink-0" />
              <span><strong>{lowStock.length}</strong> products low on stock (≤5)</span>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Form */}
      {(showForm || editProduct) && (
        <div className="card p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">{editProduct ? 'Edit Product' : 'Add New Product'}</h2>
          <ProductForm
            product={editProduct}
            onSave={(data) => editProduct ? updateMutation.mutate({ id: editProduct.id, data }) : createMutation.mutate(data)}
            onCancel={() => { setShowForm(false); setEditProduct(null); }}
            onGenerate3D={editProduct ? (id) => generate3DMutation.mutate(id) : undefined}
            isGenerating3D={generate3DMutation.isPending}
          />
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input className="input pl-9" placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Products Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-6 py-3 font-semibold text-gray-600">Product</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Category</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Price</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Stock</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400">Loading...</td></tr>
            ) : products.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400">No products yet. Add your first product!</td></tr>
            ) : (
              products.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {product.images?.[0] ? (
                        <img src={product.images[0]} alt={product.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex-shrink-0" />
                      )}
                      <div>
                        <p className="font-medium text-gray-900">{product.name}</p>
                        {product.sku && <p className="text-xs text-gray-400">SKU: {product.sku}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-gray-500">{product.category ?? '—'}</td>
                  <td className="px-4 py-4 text-right font-medium">
                    ${Number(product.price).toFixed(2)}
                    {product.comparePrice && (
                      <span className="ml-1 text-xs text-gray-400 line-through">${Number(product.comparePrice).toFixed(2)}</span>
                    )}
                  </td>
                  <td className={`px-4 py-4 text-right font-medium ${product.stock === 0 ? 'text-red-600' : product.stock <= 5 ? 'text-amber-600' : 'text-green-600'}`}>
                    {product.stock}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className={`inline-block text-xs px-2.5 py-1 rounded-full font-medium ${!product.active ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700'
                      }`}>
                      {product.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setEditProduct(product)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteMutation.mutate(product.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
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
