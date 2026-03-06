'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ShoppingCart, Menu, X, Video } from 'lucide-react';
import { useState } from 'react';
import { useCartStore } from '@/lib/cart';
import type { StoreInfo } from '@/types';
import { ThemeToggle } from './theme-toggle';

export function StoreNav({ store }: { store: StoreInfo }) {
  const params = useParams<{ storeSlug: string }>();
  const slug = params.storeSlug;
  const totalItems = useCartStore((s) => s.totalItems());
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 sticky top-0 z-40 shadow-sm transition-colors">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href={`/${slug}`} className="flex items-center gap-3">
          {store.logoUrl ? (
            <img src={store.logoUrl} alt={store.name} className="h-8 w-auto" />
          ) : (
            <span className="text-xl font-bold" style={{ color: store.primaryColor }}>{store.name}</span>
          )}
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          <Link href={`/${slug}`} className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium">Home</Link>
          <Link href={`/${slug}/products`} className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium">Products</Link>
          <Link href={`/${slug}/feed`} className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium flex items-center gap-1.5"><Video className="w-4 h-4" /> Feed</Link>
          <Link href={`/${slug}/contact`} className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium">Contact</Link>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link href={`/${slug}/cart`} className="relative p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors" aria-label="View shopping cart">
            <ShoppingCart className="w-5 h-5" />
            {totalItems > 0 && (
              <span
                className="absolute -top-1 -right-1 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center"
                style={{ backgroundColor: store.primaryColor }}
              >
                {totalItems > 9 ? '9+' : totalItems}
              </span>
            )}
          </Link>
          <button className="md:hidden p-2 text-gray-600 dark:text-gray-300 dark:hover:text-white" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-4 space-y-3">
          <Link href={`/${slug}`} className="block text-sm text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white font-medium py-2" onClick={() => setMenuOpen(false)}>Home</Link>
          <Link href={`/${slug}/products`} className="block text-sm text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white font-medium py-2" onClick={() => setMenuOpen(false)}>Products</Link>
          <Link href={`/${slug}/feed`} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white font-medium py-2" onClick={() => setMenuOpen(false)}><Video className="w-4 h-4" /> Feed</Link>
          <Link href={`/${slug}/contact`} className="block text-sm text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white font-medium py-2" onClick={() => setMenuOpen(false)}>Contact</Link>
        </div>
      )}
    </nav>
  );
}
