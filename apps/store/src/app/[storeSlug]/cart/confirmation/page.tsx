'use client';
import { useSearchParams, useParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, Package, Mail } from 'lucide-react';

export default function ConfirmationPage() {
  const params = useParams<{ storeSlug: string }>();
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get('order');

  return (
    <div className="max-w-2xl mx-auto px-6 py-20 text-center">
      <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 15%, white)' }}>
        <CheckCircle className="w-10 h-10" style={{ color: 'var(--primary)' }} />
      </div>

      <h1 className="text-4xl font-bold text-gray-900 mb-3">Order Confirmed!</h1>
      <p className="text-gray-500 text-lg mb-2">Thank you for your purchase.</p>

      {orderNumber && (
        <div className="inline-block bg-gray-50 border border-gray-200 rounded-xl px-6 py-3 mb-8">
          <p className="text-sm text-gray-500">Order number</p>
          <p className="font-bold text-xl text-gray-900">{orderNumber}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
        <div className="bg-gray-50 rounded-2xl p-6">
          <Mail className="w-6 h-6 text-gray-400 mb-3 mx-auto" />
          <p className="font-medium text-gray-900">Confirmation Email</p>
          <p className="text-sm text-gray-500 mt-1">A receipt has been sent to your email address.</p>
        </div>
        <div className="bg-gray-50 rounded-2xl p-6">
          <Package className="w-6 h-6 text-gray-400 mb-3 mx-auto" />
          <p className="font-medium text-gray-900">Shipping Update</p>
          <p className="text-sm text-gray-500 mt-1">You&apos;ll receive a tracking number when your order ships.</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Link href={`/${params.storeSlug}/products`} className="btn-primary inline-flex items-center justify-center">
          Continue Shopping
        </Link>
        <Link href={`/${params.storeSlug}/contact`} className="btn-secondary inline-flex items-center justify-center">
          Contact Support
        </Link>
      </div>
    </div>
  );
}
