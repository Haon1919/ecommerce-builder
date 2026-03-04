import Link from 'next/link';
import Script from 'next/script';
import { notFound } from 'next/navigation';
import { Check } from 'lucide-react';
import { ProductGallery } from './ProductGallery';
import { ProductActions } from './ProductActions';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function getStore(storeSlug: string) {
  try {
    const res = await fetch(`${API}/api/stores/slug/${storeSlug}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) throw new Error('Failed to fetch');
    return await res.json();
  } catch (err) {
    // Return dummy data for static export
    return {
      id: 'demo-store-id',
      name: 'Demo Export Store',
      slug: storeSlug,
      theme: 'TAILWIND',
      primaryColor: '#6366f1',
    };
  }
}

async function getProduct(storeId: string, productId: string) {
  try {
    const res = await fetch(`${API}/api/stores/${storeId}/products/${productId}`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) throw new Error('Failed to fetch');
    return await res.json();
  } catch (err) {
    // Return dummy product for static export
    return {
      id: productId,
      name: 'Demo Product',
      price: 29.99,
      comparePrice: 39.99,
      description: 'This is a demo product for the statically exported storefront.',
      images: ['https://images.unsplash.com/photo-1523275335684-37898b6baf30'],
      stock: 10,
      category: 'Demo',
      tags: ['demo', 'static'],
    };
  }
}

interface Props {
  params: Promise<{ storeSlug: string; id: string }>;
}

export default async function ProductDetailPage({ params }: Props) {
  const { storeSlug, id } = await params;

  const store = await getStore(storeSlug);
  if (!store) notFound();

  const product = await getProduct(store.id, id);
  if (!product) notFound();

  const discount = product.comparePrice
    ? Math.round((1 - Number(product.price) / Number(product.comparePrice)) * 100)
    : null;

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <Script
        type="module"
        src="https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js"
        strategy="lazyOnload"
      />

      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-8">
        <Link href={`/${storeSlug}`} className="hover:text-gray-900">Home</Link>
        <span>/</span>
        <Link href={`/${storeSlug}/products`} className="hover:text-gray-900">Products</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* Gallery — client island */}
        <ProductGallery
          images={product.images ?? []}
          modelUrl={product.modelUrl ?? null}
          arEnabled={product.arEnabled ?? false}
          productName={product.name}
        />

        {/* Details */}
        <div>
          {product.category && (
            <span className="text-sm font-medium px-3 py-1 bg-gray-100 text-gray-600 rounded-full">
              {product.category}
            </span>
          )}

          <h1 className="text-3xl font-bold text-gray-900 mt-3 mb-2">{product.name}</h1>

          {/* Price */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl font-bold text-gray-900">${Number(product.price).toFixed(2)}</span>
            {product.comparePrice && (
              <span className="text-xl text-gray-400 line-through">
                ${Number(product.comparePrice).toFixed(2)}
              </span>
            )}
            {discount && (
              <span className="bg-green-100 text-green-700 text-sm font-bold px-2.5 py-1 rounded-full">
                -{discount}%
              </span>
            )}
          </div>

          {product.description && (
            <p className="text-gray-600 leading-relaxed mb-6">{product.description}</p>
          )}

          {/* Tags */}
          {product.tags?.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {product.tags.map((tag: string) => (
                <span key={tag} className="text-xs px-3 py-1 bg-gray-100 text-gray-600 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Stock status */}
          <div className="flex items-center gap-2 mb-6 text-sm">
            {product.stock > 0 ? (
              <>
                <Check className="w-4 h-4 text-green-500" />
                <span className="text-green-600 font-medium">
                  {product.stock <= 5 ? `Only ${product.stock} left` : 'In Stock'}
                </span>
              </>
            ) : (
              <span className="text-red-500 font-medium">Out of Stock</span>
            )}
          </div>

          {/* Actions — client island */}
          <ProductActions
            product={{
              id: product.id,
              name: product.name,
              price: Number(product.price),
              stock: product.stock,
              storeSlug,
              image: product.images?.[0],
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function generateStaticParams() {
  return [{ storeSlug: 'demo', id: '1' }];
}
