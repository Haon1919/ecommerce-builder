'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCartStore } from '@/lib/cart';
import { Trash2, ShoppingBag, ArrowRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { storeApi } from '@/lib/api';

export default function CartPage() {
  const params = useParams<{ storeSlug: string }>();
  const { items, removeItem, updateQuantity, subtotal } = useCartStore();

  const { data: store } = useQuery({
    queryKey: ['store', params.storeSlug],
    queryFn: () => storeApi.getBySlug(params.storeSlug),
  });

  const tax = subtotal() * ((store?.settings?.taxRate ?? 0) / 100);
  const shipping = (store?.settings?.freeShippingAbove && subtotal() >= store.settings.freeShippingAbove)
    ? 0
    : (store?.settings?.flatShippingRate ?? 0);
  const total = subtotal() + tax + shipping;

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-20 text-center">
        <ShoppingBag className="w-20 h-20 text-gray-200 mx-auto mb-6" />
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Your cart is empty</h1>
        <p className="text-gray-500 mb-8">Looks like you haven&apos;t added anything yet.</p>
        <Link href={`/${params.storeSlug}/products`} className="btn-primary inline-flex items-center gap-2">
          <ShoppingBag className="w-4 h-4" /> Start Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Shopping Cart ({items.length} items)</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Items */}
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => (
            <div key={item.productId} className="bg-white rounded-2xl border border-gray-100 p-4 flex gap-4">
              <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                {item.image ? (
                  <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300 text-2xl">🛍</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-900 truncate">{item.name}</h3>
                <p className="text-gray-500 text-sm mt-0.5">${item.price.toFixed(2)} each</p>
                <div className="flex items-center gap-3 mt-3">
                  <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                    <button onClick={() => updateQuantity(item.productId, item.quantity - 1)} className="px-3 py-1.5 hover:bg-gray-50">−</button>
                    <span className="px-3 py-1.5 font-medium min-w-[40px] text-center text-sm">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.productId, item.quantity + 1)} className="px-3 py-1.5 hover:bg-gray-50">+</button>
                  </div>
                  <button onClick={() => removeItem(item.productId)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-bold text-gray-900">${(item.price * item.quantity).toFixed(2)}</p>
              </div>
            </div>
          ))}

          <Link href={`/${params.storeSlug}/products`} className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1">
            ← Continue Shopping
          </Link>
        </div>

        {/* Summary */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 h-fit">
          <h2 className="font-bold text-gray-900 mb-4">Order Summary</h2>
          <div className="space-y-2 text-sm mb-4">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>${subtotal().toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Tax ({store?.settings?.taxRate ?? 0}%)</span>
              <span>${tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Shipping</span>
              <span>{shipping === 0 ? <span className="text-green-600 font-medium">Free</span> : `$${shipping.toFixed(2)}`}</span>
            </div>
            {store?.settings?.freeShippingAbove && subtotal() < store.settings.freeShippingAbove && (
              <p className="text-xs text-green-600">
                Add ${(store.settings.freeShippingAbove - subtotal()).toFixed(2)} more for free shipping!
              </p>
            )}
          </div>
          <div className="border-t border-gray-100 pt-4 mb-6">
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>
          <Link
            href={`/${params.storeSlug}/cart/checkout`}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            Checkout <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
