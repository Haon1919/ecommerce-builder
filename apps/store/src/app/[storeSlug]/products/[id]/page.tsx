'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import Script from 'next/script';
import { storeApi, productsApi } from '@/lib/api';
import { useCartStore } from '@/lib/cart';
import { ShoppingCart, ArrowLeft, Star, Check, Box } from 'lucide-react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': any;
    }
  }
}

export default function ProductDetailPage() {
  const params = useParams<{ storeSlug: string; id: string }>();
  const router = useRouter();
  const addItem = useCartStore((s) => s.addItem);
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [addedToCart, setAddedToCart] = useState(false);
  const [show3D, setShow3D] = useState(false);

  const { data: store } = useQuery({
    queryKey: ['store', params.storeSlug],
    queryFn: () => storeApi.getBySlug(params.storeSlug),
  });

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', store?.id, params.id],
    queryFn: () => productsApi.get(store!.id, params.id),
    enabled: !!store?.id,
  });

  const handleAddToCart = () => {
    if (!product) return;
    addItem({
      productId: product.id,
      name: product.name,
      price: Number(product.price),
      quantity,
      image: product.images?.[0],
    });
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-2 gap-12 animate-pulse">
        <div className="aspect-square bg-gray-200 rounded-2xl" />
        <div className="space-y-4">
          <div className="h-8 bg-gray-200 rounded w-3/4" />
          <div className="h-6 bg-gray-100 rounded w-1/4" />
          <div className="h-4 bg-gray-100 rounded" />
          <div className="h-4 bg-gray-100 rounded w-5/6" />
        </div>
      </div>
    );
  }

  if (!product) return null;

  const discount = product.comparePrice
    ? Math.round((1 - Number(product.price) / Number(product.comparePrice)) * 100)
    : null;

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <Script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js" strategy="lazyOnload" />
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-8">
        <Link href={`/${params.storeSlug}`} className="hover:text-gray-900">Home</Link>
        <span>/</span>
        <Link href={`/${params.storeSlug}/products`} className="hover:text-gray-900">Products</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* Images */}
        <div>
          <div className="aspect-square rounded-2xl overflow-hidden bg-gray-100 mb-4 border border-gray-100 relative">
            {show3D && product.modelUrl ? (
              <model-viewer
                src={product.modelUrl}
                ar
                auto-rotate
                camera-controls
                style={{ width: '100%', height: '100%', backgroundColor: '#f3f4f6' }}
              />
            ) : product.images?.[selectedImage] ? (
              <img
                src={product.images[selectedImage]}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300 text-8xl">🛍</div>
            )}
          </div>

          {/* Media Controls */}
          <div className="flex flex-col gap-4">
            {product.arEnabled && product.modelUrl && (
              <div className="flex gap-2 bg-gray-50 p-1 rounded-xl">
                <button
                  onClick={() => setShow3D(false)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${!show3D ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  2D Images
                </button>
                <button
                  onClick={() => setShow3D(true)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all ${show3D ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  <Box className="w-4 h-4" /> 3D & AR
                </button>
              </div>
            )}

            {!show3D && product.images?.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {product.images.map((img: string, i: number) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 ${selectedImage === i ? 'border-primary shadow-md' : 'border-gray-200 opacity-70 hover:opacity-100'
                      }`}
                    style={{ '--tw-border-opacity': '1' } as React.CSSProperties}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

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
              <span className="text-xl text-gray-400 line-through">${Number(product.comparePrice).toFixed(2)}</span>
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
                <span key={tag} className="text-xs px-3 py-1 bg-gray-100 text-gray-600 rounded-full">{tag}</span>
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

          {/* Quantity & Add to Cart */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center border border-gray-300 rounded-xl overflow-hidden">
              <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="px-4 py-3 text-gray-600 hover:bg-gray-50 font-medium">−</button>
              <span className="px-4 py-3 font-medium min-w-[50px] text-center">{quantity}</span>
              <button onClick={() => setQuantity(Math.min(product.stock, quantity + 1))} className="px-4 py-3 text-gray-600 hover:bg-gray-50 font-medium">+</button>
            </div>
            <button
              onClick={handleAddToCart}
              disabled={product.stock === 0}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-xl text-white font-semibold transition-all disabled:opacity-50"
              style={{ backgroundColor: product.stock === 0 ? '#9ca3af' : 'var(--primary)' }}
            >
              {addedToCart ? (
                <><Check className="w-5 h-5" /> Added!</>
              ) : (
                <><ShoppingCart className="w-5 h-5" /> Add to Cart</>
              )}
            </button>
          </div>

          <button
            onClick={() => { handleAddToCart(); router.push(`/${params.storeSlug}/cart`); }}
            disabled={product.stock === 0}
            className="w-full py-3 rounded-xl border-2 font-semibold text-gray-700 hover:bg-gray-50 transition-colors mb-6"
            style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}
          >
            Buy Now
          </button>
        </div>
      </div>
    </div>
  );
}
