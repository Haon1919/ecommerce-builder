'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useCartStore } from '@/lib/cart';
import { storeApi, ordersApi } from '@/lib/api';
import { Lock, CreditCard } from 'lucide-react';

interface CheckoutForm {
  email: string;
  name: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

const STEPS = ['Contact', 'Shipping', 'Payment'];

export default function CheckoutPage() {
  const params = useParams<{ storeSlug: string }>();
  const router = useRouter();
  const { items, subtotal, clearCart } = useCartStore();
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<CheckoutForm>({
    email: '', name: '', phone: '',
    line1: '', line2: '', city: '', state: '', zip: '', country: 'US',
  });

  const { data: store } = useQuery({
    queryKey: ['store', params.storeSlug],
    queryFn: () => storeApi.getBySlug(params.storeSlug),
  });

  const tax = subtotal() * ((store?.settings?.taxRate ?? 0) / 100);
  const shipping = store?.settings?.freeShippingAbove && subtotal() >= store.settings.freeShippingAbove
    ? 0 : (store?.settings?.flatShippingRate ?? 0);
  const total = subtotal() + tax + shipping;

  const [isSuccess, setIsSuccess] = useState(false);

  if (items.length === 0 && !isSubmitting && !isSuccess) {
    router.push(`/${params.storeSlug}/cart`);
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 2) { setStep(step + 1); return; }

    setIsSubmitting(true);
    try {
      const order = await ordersApi.create({
        storeId: store?.id,
        customerEmail: form.email,
        customerName: form.name,
        customerPhone: form.phone,
        shippingAddress: { line1: form.line1, line2: form.line2, city: form.city, state: form.state, zip: form.zip, country: form.country },
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      });
      setIsSuccess(true);
      clearCart();
      router.push(`/${params.storeSlug}/cart/confirmation?order=${order.orderNumber}`);
    } catch (err: unknown) {
      alert((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Order failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const update = (key: keyof CheckoutForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [key]: e.target.value });

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Checkout</h1>

      {/* Steps */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${i <= step ? 'text-white' : 'bg-gray-100 text-gray-400'
              }`} style={i <= step ? { backgroundColor: 'var(--primary)' } : {}}>
              {i + 1}
            </div>
            <span className={`text-sm font-medium ${i === step ? 'text-gray-900' : 'text-gray-400'}`}>{s}</span>
            {i < STEPS.length - 1 && <div className="h-0.5 w-8 bg-gray-200 mx-1" />}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-4">
          {/* Step 0: Contact */}
          {step === 0 && (
            <>
              <h2 className="font-semibold text-gray-900 text-lg">Contact Information</h2>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input id="email" type="email" className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2" value={form.email} onChange={update('email')} required />
              </div>
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input id="name" className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2" value={form.name} onChange={update('name')} required />
              </div>
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input id="phone" type="tel" className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2" value={form.phone} onChange={update('phone')} />
              </div>
            </>
          )}

          {/* Step 1: Shipping */}
          {step === 1 && (
            <>
              <h2 className="font-semibold text-gray-900 text-lg">Shipping Address</h2>
              <div>
                <label htmlFor="line1" className="block text-sm font-medium text-gray-700 mb-1">Address Line 1 *</label>
                <input id="line1" className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2" value={form.line1} onChange={update('line1')} required />
              </div>
              <div>
                <label htmlFor="line2" className="block text-sm font-medium text-gray-700 mb-1">Apartment, suite, etc. (optional)</label>
                <input id="line2" className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2" value={form.line2} onChange={update('line2')} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                  <input id="city" className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2" value={form.city} onChange={update('city')} required />
                </div>
                <div>
                  <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-1">State *</label>
                  <input id="state" className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2" value={form.state} onChange={update('state')} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="zip" className="block text-sm font-medium text-gray-700 mb-1">ZIP Code *</label>
                  <input id="zip" className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2" value={form.zip} onChange={update('zip')} required />
                </div>
                <div>
                  <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                  <select id="country" className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 bg-white" value={form.country} onChange={update('country')}>
                    <option value="US">United States</option>
                    <option value="CA">Canada</option>
                    <option value="GB">United Kingdom</option>
                    <option value="AU">Australia</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {/* Step 2: Payment */}
          {step === 2 && (
            <>
              <h2 className="font-semibold text-gray-900 text-lg">Payment</h2>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                <Lock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900">Secure checkout</p>
                  <p className="text-xs text-blue-700 mt-0.5">Your payment is encrypted and secure. This is a demo — no real payment will be charged.</p>
                </div>
              </div>
              {/* In production: Stripe Elements would go here */}
              <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                  <CreditCard className="w-4 h-4" />
                  <span>Card Details (Demo)</span>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Card Number</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm" placeholder="4242 4242 4242 4242" readOnly />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Expiry</label>
                    <input className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm" placeholder="12/28" readOnly />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">CVC</label>
                    <input className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm" placeholder="123" readOnly />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Navigation buttons */}
          <div className="flex gap-3 pt-4">
            {step > 0 && (
              <button type="button" onClick={() => setStep(step - 1)} className="btn-secondary">
                ← Back
              </button>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary flex-1"
              style={{ '--tw-bg-opacity': '1' } as React.CSSProperties}
            >
              {isSubmitting ? 'Processing...' : step < 2 ? 'Continue →' : `Place Order — $${total.toFixed(2)}`}
            </button>
          </div>
        </form>

        {/* Order summary */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 h-fit">
          <h3 className="font-semibold text-gray-900 mb-4">Order Summary</h3>
          <div className="space-y-3 mb-4">
            {items.map((item) => (
              <div key={item.productId} className="flex justify-between text-sm">
                <div className="flex gap-2 items-center">
                  {item.image && <img src={item.image} alt={item.name} className="w-10 h-10 rounded-lg object-cover" />}
                  <span className="text-gray-700">{item.name} × {item.quantity}</span>
                </div>
                <span className="font-medium">${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-100 pt-3 space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>${subtotal().toFixed(2)}</span></div>
            <div className="flex justify-between text-gray-500"><span>Tax</span><span>${tax.toFixed(2)}</span></div>
            <div className="flex justify-between text-gray-500"><span>Shipping</span><span>{shipping === 0 ? 'Free' : `$${shipping.toFixed(2)}`}</span></div>
            <div className="flex justify-between font-bold text-base pt-2 border-t border-gray-100"><span>Total</span><span>${total.toFixed(2)}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
