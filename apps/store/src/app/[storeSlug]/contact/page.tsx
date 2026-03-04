'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { storeApi, messagesApi } from '@/lib/api';
import { Send, Mail, CheckCircle, MapPin, Clock } from 'lucide-react';

export default function ContactPage() {
  const params = useParams<{ storeSlug: string }>();
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { data: store } = useQuery({
    queryKey: ['store', params.storeSlug],
    queryFn: () => storeApi.getBySlug(params.storeSlug),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.message.trim() || form.message.length < 10) {
      setError('Please write a message of at least 10 characters.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await messagesApi.send(store?.id!, form);
      setSubmitted(true);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to send message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-16">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">Contact Us</h1>
        <p className="text-gray-500 text-lg">We&apos;d love to hear from you. Send us a message and we&apos;ll get back to you soon.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
        {/* Contact info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 15%, white)' }}>
              <Mail className="w-5 h-5" style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Email</p>
              <p className="text-gray-500 text-sm">{store?.settings?.contactEmail ?? 'Contact form below'}</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 15%, white)' }}>
              <Clock className="w-5 h-5" style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Response Time</p>
              <p className="text-gray-500 text-sm">Usually within 24 hours on business days</p>
            </div>
          </div>

          {store?.settings?.shippingPolicy && (
            <div className="bg-gray-50 rounded-2xl p-5">
              <h3 className="font-semibold text-gray-900 mb-2">Shipping Policy</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{store.settings.shippingPolicy}</p>
            </div>
          )}

          {store?.settings?.returnPolicy && (
            <div className="bg-gray-50 rounded-2xl p-5">
              <h3 className="font-semibold text-gray-900 mb-2">Return Policy</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{store.settings.returnPolicy}</p>
            </div>
          )}
        </div>

        {/* Contact form */}
        <div className="lg:col-span-3">
          {submitted ? (
            <div className="text-center py-16">
              <CheckCircle className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--primary)' }} />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Message Sent!</h2>
              <p className="text-gray-500 mb-6">Thank you for reaching out. We&apos;ll get back to you as soon as possible.</p>
              <button onClick={() => { setSubmitted(false); setForm({ name: '', email: '', subject: '', message: '' }); }} className="btn-secondary">Send Another Message</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 transition-shadow"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                    placeholder="John Smith"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input
                    type="email"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 transition-shadow"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                    placeholder="john@example.com"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
                <input
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 transition-shadow"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  required
                  placeholder="How can we help you?"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message *</label>
                <textarea
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 transition-shadow resize-none"
                  rows={6}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  required
                  placeholder="Tell us more..."
                  minLength={10}
                />
              </div>
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary flex items-center justify-center gap-2 py-3.5"
              >
                <Send className="w-4 h-4" />
                {loading ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
