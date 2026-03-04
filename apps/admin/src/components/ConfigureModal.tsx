'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { storeApi, pagesApi } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';

const REQUIRED_PAGES = [
  { type: 'LANDING', slug: '', label: 'Landing Page', desc: 'Your store homepage — first impression matters!' },
  { type: 'PRODUCTS', slug: 'products', label: 'Products Page', desc: 'Where customers browse your inventory.' },
  { type: 'CART', slug: 'cart', label: 'Cart Page', desc: 'Shopping cart where customers review their selection.' },
  { type: 'CHECKOUT', slug: 'cart/checkout', label: 'Checkout Page', desc: 'Payment and shipping information.' },
  { type: 'CONTACT', slug: 'contact', label: 'Contact Page', desc: 'Let customers reach you easily.' },
];

export function ConfigureModal({ storeId }: { storeId: string }) {
  const router = useRouter();
  const store = useAuthStore((s) => s.store);
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'welcome' | 'pages'>('welcome');

  const handleAccept = async () => {
    setLoading(true);
    try {
      await storeApi.configure(storeId);
      useAuthStore.setState((s) => ({
        store: s.store ? { ...s.store, configured: true } : s.store,
      }));
      setAccepted(true);
    } finally {
      setLoading(false);
    }
  };

  const goToBuilder = (slug: string) => {
    router.push(`/builder?page=${encodeURIComponent(slug)}`);
  };

  if (accepted) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-auto animate-slide-in">
        {step === 'welcome' ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-primary-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Welcome to {store?.name ?? 'Your Store'}!
            </h2>
            <p className="text-gray-500 mb-6">
              Before your store goes live, you&apos;ll need to configure a few key pages.
              Each page can be customized using our drag-and-drop editor.
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-left">
              <p className="text-amber-800 text-sm font-medium">Pages that need configuration:</p>
              <ul className="mt-2 space-y-1">
                {REQUIRED_PAGES.map((p) => (
                  <li key={p.type} className="text-amber-700 text-sm flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    {p.label}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setStep('pages')}
                className="btn-primary px-6 py-2.5 flex items-center gap-2"
              >
                Configure Pages <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={handleAccept}
                disabled={loading}
                className="btn-secondary px-6 py-2.5"
              >
                {loading ? 'Saving...' : 'Use Defaults & Continue'}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Configure Your Pages</h2>
            <p className="text-gray-500 text-sm mb-6">
              Click a page to open the builder, or accept the defaults and customize later.
            </p>

            <div className="space-y-3 mb-8">
              {REQUIRED_PAGES.map((page) => (
                <button
                  key={page.type}
                  onClick={() => goToBuilder(page.slug)}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-all text-left group"
                >
                  <div className="w-10 h-10 bg-gray-100 group-hover:bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors">
                    <CheckCircle className="w-5 h-5 text-gray-400 group-hover:text-primary-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{page.label}</p>
                    <p className="text-sm text-gray-500">{page.desc}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-primary-500 flex-shrink-0 transition-colors" />
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleAccept}
                disabled={loading}
                className="btn-primary flex-1 py-2.5"
              >
                {loading ? 'Saving...' : 'Accept Defaults & Continue'}
              </button>
              <button onClick={() => setStep('welcome')} className="btn-secondary px-6">
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
