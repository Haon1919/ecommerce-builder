'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useCartStore } from '@/lib/cart';
import { storeApi, ordersApi, cartApi, checkoutApi } from '@/lib/api';
import { Lock, CreditCard, Tag, Truck } from 'lucide-react';

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

  const [discountCode, setDiscountCode] = useState('');
  const [appliedCodes, setAppliedCodes] = useState<string[]>([]);

  const { data: calculation, isLoading: isCalculating } = useQuery({
    queryKey: ['cart-calculation', store?.id, items, appliedCodes],
    queryFn: () => cartApi.calculate(store!.id, items.map(i => ({ productId: i.productId, quantity: i.quantity })), [], appliedCodes),
    enabled: !!store?.id && items.length > 0,
  });

  const [selectedRate, setSelectedRate] = useState<any>(null);

  const { data: shippingRates, isLoading: isLoadingRates } = useQuery({
    queryKey: ['shipping-rates', store?.id, items, form.zip, form.city],
    queryFn: () => checkoutApi.getShippingRates(store!.id, items.map(i => ({ productId: i.productId, quantity: i.quantity })), {
      line1: form.line1,
      city: form.city,
      state: form.state,
      zip: form.zip,
      country: form.country
    }),
    enabled: !!store?.id && items.length > 0 && !!form.zip && !!form.city && step >= 1,
  });

  const totals = {
    subtotal: subtotal(),
    totalDiscount: calculation?.totalDiscount ?? 0,
    discountedSubtotal: calculation?.discountedSubtotal ?? subtotal(),
    tax: calculation?.tax ?? (subtotal() * ((store?.settings?.taxRate ?? 0) / 100)),
    shipping: selectedRate ? selectedRate.rate : (calculation?.shipping ?? (store?.settings?.freeShippingAbove && subtotal() >= store.settings.freeShippingAbove ? 0 : (store?.settings?.flatShippingRate ?? 0))),
    total: (calculation?.discountedSubtotal ?? subtotal()) +
      (calculation?.tax ?? (subtotal() * ((store?.settings?.taxRate ?? 0) / 100))) +
      (selectedRate ? selectedRate.rate : (calculation?.shipping ?? (store?.settings?.freeShippingAbove && subtotal() >= store.settings.freeShippingAbove ? 0 : (store?.settings?.flatShippingRate ?? 0)))),
    appliedDiscounts: calculation?.appliedDiscounts || []
  };

  const handleApplyDiscount = (e: React.MouseEvent) => {
    e.preventDefault();
    if (discountCode && !appliedCodes.includes(discountCode)) {
      setAppliedCodes([...appliedCodes, discountCode]);
      setDiscountCode('');
    }
  };

  const [isSuccess, setIsSuccess] = useState(false);

  if (items.length === 0 && !isSubmitting && !isSuccess) {
    router.push(`/${params.storeSlug}/cart`);
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 2) {
      if (step === 1 && !selectedRate && shippingRates?.length > 0) {
        alert('Please select a shipping method');
        return;
      }
      setStep(step + 1);
      return;
    }

    setIsSubmitting(true);
    try {
      const order = await ordersApi.create({
        storeId: store?.id,
        customerEmail: form.email,
        customerName: form.name,
        customerPhone: form.phone,
        shippingAddress: { line1: form.line1, line2: form.line2, city: form.city, state: form.state, zip: form.zip, country: form.country },
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        providedCodes: appliedCodes,
        shippingCost: totals.shipping,
        carrier: selectedRate?.carrier,
        shippingService: selectedRate?.service,
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

              {/* Shipping Rates */}
              <div className="mt-8">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Truck className="w-4 h-4" />
                  Delivery Options
                </h3>
                {isLoadingRates ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-50 animate-pulse rounded-xl" />)}
                  </div>
                ) : shippingRates?.length > 0 ? (
                  <div className="space-y-3">
                    {shippingRates.map((rate: any) => (
                      <label key={`${rate.carrier}-${rate.service}`} className={`flex items-center justify-between p-4 border rounded-xl cursor-pointer transition-all ${selectedRate?.service === rate.service && selectedRate?.carrier === rate.carrier
                        ? 'border-gray-900 bg-gray-50 ring-1 ring-gray-900'
                        : 'border-gray-200 hover:border-gray-300'
                        }`}>
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="shippingRate"
                            className="w-4 h-4 text-gray-900 focus:ring-gray-900"
                            checked={selectedRate?.service === rate.service && selectedRate?.carrier === rate.carrier}
                            onChange={() => setSelectedRate(rate)}
                          />
                          <div>
                            <p className="font-semibold text-sm text-gray-900">{rate.carrier} {rate.service}</p>
                            <p className="text-xs text-gray-500">Estimated {rate.estimatedDays} business days</p>
                          </div>
                        </div>
                        <span className="font-bold text-sm">${rate.rate.toFixed(2)}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center border-2 border-dashed border-gray-100 rounded-2xl">
                    <p className="text-sm text-gray-400">Enter your address to see shipping rates</p>
                  </div>
                )}
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
              disabled={isSubmitting || isCalculating}
              className="btn-primary flex-1"
              style={{ '--tw-bg-opacity': '1' } as React.CSSProperties}
            >
              {isSubmitting ? 'Processing...' : step < 2 ? 'Continue →' : `Place Order — $${totals.total.toFixed(2)}`}
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

          <div className="mb-4 text-sm">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter discount code"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                value={discountCode}
                onChange={(e) => setDiscountCode(e.target.value)}
              />
              <button
                type="button"
                onClick={handleApplyDiscount}
                className="px-4 py-2 bg-gray-900 text-white hover:bg-gray-800 rounded-lg text-sm font-medium transition-colors"
              >
                Apply
              </button>
            </div>
            {appliedCodes.length > 0 && (
              <div className="mt-3 space-y-2">
                {appliedCodes.map(code => (
                  <div key={code} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-gray-700 font-medium">
                      <Tag className="w-4 h-4 text-gray-400" />
                      <span>{code}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAppliedCodes(appliedCodes.filter(c => c !== code))}
                      className="text-gray-400 hover:text-red-500 font-bold"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 pt-3 space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>${totals.subtotal.toFixed(2)}</span></div>
            {totals.totalDiscount > 0 && (
              <div className="flex justify-between text-green-600 font-medium">
                <span>Discount</span>
                <span>-${totals.totalDiscount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-500"><span>Tax</span><span>${totals.tax.toFixed(2)}</span></div>
            <div className="flex justify-between text-gray-500"><span>Shipping</span><span>{totals.shipping === 0 ? 'Free' : `$${totals.shipping.toFixed(2)}`}</span></div>
            <div className="flex justify-between font-bold text-base pt-2 border-t border-gray-100"><span>Total</span><span>${totals.total.toFixed(2)}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
