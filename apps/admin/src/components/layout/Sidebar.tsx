'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/auth';
import { ThemeToggle } from '../theme-toggle';
import {
  LayoutDashboard, Layers, Package, MessageSquare, Ticket, Settings,
  ShoppingCart, LogOut, ExternalLink, ChevronRight, Building, Banknote, Video, Store
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/builder', icon: Layers, label: 'Page Builder' },
  { href: '/inventory', icon: Package, label: 'Inventory' },
  { href: '/orders', icon: ShoppingCart, label: 'Orders' },
  { href: '/messages', icon: MessageSquare, label: 'Messages', badge: 'unread' },
  { href: '/tickets', icon: Ticket, label: 'Support Tickets' },
  { href: '/companies', icon: Building, label: 'Companies' },
  { href: '/pricelists', icon: Banknote, label: 'Price Lists' },
  { href: '/vendors', icon: Store, label: 'Vendors' },
  { href: '/experiments', icon: Layers, label: 'A/B Tests' },
  { href: '/live-commerce', icon: Video, label: 'Live Commerce' },
  { href: '/settings', icon: Settings, label: 'Settings' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, store, logout } = useAuthStore();

  const storeUrl = `${process.env.NEXT_PUBLIC_STORE_URL}/${store?.slug}`;

  return (
    <aside className="w-64 min-h-screen bg-gray-900 dark:bg-gray-950 text-white flex flex-col transition-colors border-r border-gray-800">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 relative">
            <Image
              src="/logo.png"
              alt="Store Logo"
              fill
              className="object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{store?.name ?? 'My Store'}</p>
            <p className="text-gray-400 text-xs truncate">/{store?.slug}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive
                ? 'bg-primary-600 text-white'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}

        {/* View Store link */}
        <a
          href={storeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <ExternalLink className="w-4 h-4 flex-shrink-0" />
          View Store
          <ChevronRight className="w-3 h-3 ml-auto" />
        </a>
      </nav>

      {/* User info */}
      <div className="px-4 py-4 border-t border-gray-800">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium">{user?.name?.[0]?.toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-gray-400 truncate">{user?.email}</p>
          </div>
          <ThemeToggle />
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
