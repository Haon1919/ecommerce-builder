'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingCart, Check } from 'lucide-react';
import { useCartStore } from '@/lib/cart';

interface Props {
  product: {
    id: string;
    name: string;
    price: number;
    stock: number;
    storeSlug: string;
    image?: string;
  };
}

export function ProductActions({ product }: Props) {
  const router = useRouter();
  const addItem = useCartStore((s) => s.addItem);
  const [quantity, setQuantity] = useState(1);
  const [addedToCart, setAddedToCart] = useState(false);

  const handleAddToCart = () => {
    addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity,
      image: product.image,
    });
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center border border-gray-300 rounded-xl overflow-hidden">
          <button
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            className="px-4 py-3 text-gray-600 hover:bg-gray-50 font-medium"
          >
            −
          </button>
          <span className="px-4 py-3 font-medium min-w-[50px] text-center">{quantity}</span>
          <button
            onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
            className="px-4 py-3 text-gray-600 hover:bg-gray-50 font-medium"
          >
            +
          </button>
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
        onClick={() => { handleAddToCart(); router.push(`/${product.storeSlug}/cart`); }}
        disabled={product.stock === 0}
        className="w-full py-3 rounded-xl border-2 font-semibold text-gray-700 hover:bg-gray-50 transition-colors mb-6"
        style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}
      >
        Buy Now
      </button>
    </>
  );
}
