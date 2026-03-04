'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Root() {
  const router = useRouter();
  useEffect(() => {
    const token = localStorage.getItem('super_admin_token');
    router.replace(token ? '/dashboard' : '/login');
  }, [router]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-500" />
    </div>
  );
}
