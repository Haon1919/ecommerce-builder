'use client';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { AnalyticsDashboard } from '@/components/dashboard/AnalyticsDashboard';

export default function DashboardPage() {
  const store = useAuthStore((s) => s.store);

  const { data, isLoading } = useQuery({
    queryKey: ['analytics', store?.id],
    queryFn: () => analyticsApi.dashboard(store!.id, 30),
    enabled: !!store?.id,
    refetchInterval: 5 * 60 * 1000, // 5 min auto-refresh
  });

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Overview of your store performance</p>
      </div>
      <AnalyticsDashboard data={data} isLoading={isLoading} />
    </div>
  );
}
