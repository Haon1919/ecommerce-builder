'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SuperAdminSidebar } from '@/components/SuperAdminSidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('super_admin_token');
    if (!token) router.replace('/login');
  }, [router]);

  return (
    <div className="flex min-h-screen bg-gray-950">
      <SuperAdminSidebar />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
