'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Ticket, ScrollText, Activity, Building2, LogOut, Shield, Bell
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Overview' },
  { href: '/monitoring', icon: Activity, label: 'Anomaly Detection' },
  { href: '/logs', icon: ScrollText, label: 'Live Logs' },
  { href: '/tickets', icon: Ticket, label: 'Support Kanban' },
  { href: '/tenants', icon: Building2, label: 'Tenants' },
];

export function SuperAdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 min-h-screen bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="px-5 py-5 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 relative">
            <Image
              src="/logo.png"
              alt="Super Admin Logo"
              fill
              className="object-cover"
            />
          </div>
          <div>
            <p className="font-bold text-white">Super Admin</p>
            <p className="text-xs text-gray-400">Platform Control</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-gray-800">
        <button
          onClick={() => { localStorage.removeItem('super_admin_token'); window.location.href = '/login'; }}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
