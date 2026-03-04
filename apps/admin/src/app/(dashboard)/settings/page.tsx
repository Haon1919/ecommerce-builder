'use client';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth';
import { storeApi } from '@/lib/api';

type ThemeType = 'TAILWIND' | 'BOOTSTRAP' | 'BULMA' | 'PICO';
const THEMES: { value: ThemeType, label: string, desc: string, preview: string }[] = [
  { value: 'TAILWIND', label: 'Tailwind CSS', desc: 'Modern utility-first styling', preview: 'bg-gradient-to-r from-blue-500 to-indigo-600' },
  { value: 'BOOTSTRAP', label: 'Bootstrap', desc: 'Classic, component-based design', preview: 'bg-gradient-to-r from-purple-600 to-purple-800' },
  { value: 'BULMA', label: 'Bulma', desc: 'Modern, flexbox-based framework', preview: 'bg-gradient-to-r from-teal-500 to-cyan-600' },
  { value: 'PICO', label: 'Pico CSS', desc: 'Minimal & elegant pure CSS', preview: 'bg-gradient-to-r from-gray-600 to-gray-800' },
];

export default function SettingsPage() {
  const { store } = useAuthStore();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: store?.name ?? '',
    description: '',
    theme: store?.theme ?? 'TAILWIND',
    primaryColor: store?.primaryColor ?? '#6366f1',
    gaId: store?.gaId ?? '',
    contactEmail: store?.settings?.contactEmail ?? '',
    currency: store?.settings?.currency ?? 'USD',
    taxRate: store?.settings?.taxRate ?? 0,
    flatShippingRate: store?.settings?.flatShippingRate ?? 0,
    freeShippingAbove: store?.settings?.freeShippingAbove ?? '',
    shippingPolicy: store?.settings?.shippingPolicy ?? '',
    returnPolicy: store?.settings?.returnPolicy ?? '',
    stripePublicKey: '',
    stripeSecretKey: '',
    geminiApiKey: '',
  });
  const [saved, setSaved] = useState(false);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await storeApi.update(store!.id, { name: form.name, description: form.description, theme: form.theme, primaryColor: form.primaryColor, gaId: form.gaId });
      await storeApi.updateSettings(store!.id, {
        contactEmail: form.contactEmail,
        currency: form.currency,
        taxRate: form.taxRate,
        flatShippingRate: form.flatShippingRate,
        freeShippingAbove: form.freeShippingAbove ? parseFloat(String(form.freeShippingAbove)) : null,
        shippingPolicy: form.shippingPolicy,
        returnPolicy: form.returnPolicy,
        ...(form.stripeSecretKey ? { stripeSecretKey: form.stripeSecretKey } : {}),
        ...(form.stripePublicKey ? { stripePublicKey: form.stripePublicKey } : {}),
        ...(form.geminiApiKey ? { geminiApiKey: form.geminiApiKey } : {}),
      });
    },
    onSuccess: () => {
      setSaved(true);
      qc.invalidateQueries({ queryKey: ['store'] });
      setTimeout(() => setSaved(false), 3000);
    },
  });

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Store Settings</h1>

      <div className="space-y-8">
        {/* General */}
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4">General</h2>
          <div className="space-y-4">
            <div>
              <label className="label">Store Name</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea className="input resize-none" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <label className="label">Contact Email</label>
              <input type="email" className="input" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
            </div>
          </div>
        </div>

        {/* Theme */}
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Storefront Theme</h2>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {THEMES.map((t) => (
              <button
                key={t.value}
                onClick={() => setForm({ ...form, theme: t.value })}
                className={`p-4 rounded-xl border-2 text-left transition-all ${form.theme === t.value ? 'border-primary-500 ring-1 ring-primary-300' : 'border-gray-200 hover:border-gray-300'
                  }`}
              >
                <div className={`h-8 rounded-md mb-2 ${t.preview}`} />
                <p className="font-medium text-sm text-gray-900">{t.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{t.desc}</p>
              </button>
            ))}
          </div>
          <div>
            <label className="label">Primary Color</label>
            <div className="flex items-center gap-3">
              <input type="color" className="w-12 h-10 rounded-lg border border-gray-300 cursor-pointer" value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} />
              <input className="input flex-1" value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} />
            </div>
          </div>
        </div>

        {/* Commerce */}
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Commerce</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="label">Currency</label>
                <select className="input" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                  {['USD', 'EUR', 'GBP', 'CAD', 'AUD'].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Tax Rate (%)</label>
                <input type="number" className="input" min="0" max="100" step="0.1" value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: parseFloat(e.target.value) })} />
              </div>
              <div>
                <label className="label">Flat Shipping ($)</label>
                <input type="number" className="input" min="0" step="0.01" value={form.flatShippingRate} onChange={(e) => setForm({ ...form, flatShippingRate: parseFloat(e.target.value) })} />
              </div>
            </div>
            <div>
              <label className="label">Free Shipping Above ($, leave blank to disable)</label>
              <input type="number" className="input" min="0" step="0.01" value={form.freeShippingAbove} onChange={(e) => setForm({ ...form, freeShippingAbove: e.target.value })} placeholder="e.g. 50.00" />
            </div>
            <div>
              <label className="label">Stripe Publishable Key</label>
              <input className="input" value={form.stripePublicKey} onChange={(e) => setForm({ ...form, stripePublicKey: e.target.value })} placeholder="pk_..." />
            </div>
            <div>
              <label className="label">Stripe Secret Key</label>
              <input type="password" className="input" value={form.stripeSecretKey} onChange={(e) => setForm({ ...form, stripeSecretKey: e.target.value })} placeholder="sk_... (stored encrypted)" />
            </div>
          </div>
        </div>

        {/* Analytics & AI */}
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Analytics & AI</h2>
          <div className="space-y-4">
            <div>
              <label className="label">Google Analytics 4 ID</label>
              <input className="input" value={form.gaId} onChange={(e) => setForm({ ...form, gaId: e.target.value })} placeholder="G-XXXXXXXXXX" />
              <p className="text-xs text-gray-400 mt-1">Your store frontend will automatically include this tracking code</p>
            </div>
            <div>
              <label className="label">Custom Gemini API Key (optional)</label>
              <input type="password" className="input" value={form.geminiApiKey} onChange={(e) => setForm({ ...form, geminiApiKey: e.target.value })} placeholder="Leave blank to use platform default" />
              <p className="text-xs text-gray-400 mt-1">Stored encrypted. Used for your store&apos;s AI chat assistant.</p>
            </div>
          </div>
        </div>

        {/* Policies */}
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Policies</h2>
          <div className="space-y-4">
            <div>
              <label className="label">Shipping Policy</label>
              <textarea className="input resize-none" rows={3} value={form.shippingPolicy} onChange={(e) => setForm({ ...form, shippingPolicy: e.target.value })} />
            </div>
            <div>
              <label className="label">Return Policy</label>
              <textarea className="input resize-none" rows={3} value={form.returnPolicy} onChange={(e) => setForm({ ...form, returnPolicy: e.target.value })} />
            </div>
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center gap-4">
          <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="btn-primary px-8">
            {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
          {saved && <span className="text-green-600 text-sm font-medium">✓ Settings saved</span>}
        </div>
      </div>
    </div>
  );
}
