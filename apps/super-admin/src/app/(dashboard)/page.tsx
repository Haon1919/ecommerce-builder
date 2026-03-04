'use client';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/lib/api';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts';
import { Building2, ShoppingCart, DollarSign, AlertTriangle, Ticket, TrendingUp } from 'lucide-react';

function StatCard({ icon: Icon, label, value, sub, color = 'violet', alert = false }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string; alert?: boolean;
}) {
  const colors: Record<string, string> = { violet: '#8b5cf6', blue: '#3b82f6', green: '#10b981', red: '#ef4444', amber: '#f59e0b' };
  return (
    <div className={`card-dark p-6 ${alert ? 'ring-1 ring-red-500/50' : ''}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-400 font-medium">{label}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
        </div>
        <div className="p-2.5 rounded-xl" style={{ backgroundColor: `${colors[color]}20` }}>
          <Icon className="w-5 h-5" style={{ color: colors[color] }} />
        </div>
      </div>
    </div>
  );
}

export default function SuperAdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['super-overview'],
    queryFn: analyticsApi.overview,
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <div className="p-8 grid grid-cols-2 md:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="card-dark p-6 animate-pulse">
            <div className="h-4 bg-gray-800 rounded w-1/2 mb-3" />
            <div className="h-8 bg-gray-700 rounded w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  const { overview, storeGrowth, topStoresByRevenue, recentAlerts, systemHealth } = data ?? {};

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Platform Overview</h1>
        <p className="text-gray-400 mt-1">Real-time platform metrics — no customer PII shown</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard icon={Building2} label="Total Stores" value={overview?.totalStores ?? 0} sub={`${overview?.activeStores ?? 0} active`} color="violet" />
        <StatCard icon={ShoppingCart} label="Orders (30d)" value={overview?.totalOrders ?? 0} color="blue" />
        <StatCard icon={DollarSign} label="Revenue (30d)" value={`$${(overview?.totalRevenue ?? 0).toLocaleString()}`} color="green" />
        <StatCard icon={Ticket} label="Open Tickets" value={overview?.openTickets ?? 0} color="amber" alert={(overview?.openTickets ?? 0) > 5} />
        <StatCard icon={AlertTriangle} label="Critical Alerts" value={overview?.criticalAlerts ?? 0} color="red" alert={(overview?.criticalAlerts ?? 0) > 0} />
        <StatCard icon={TrendingUp} label="Store Growth" value={storeGrowth?.length ?? 0} sub="new stores (30d)" color="violet" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Store growth */}
        <div className="card-dark p-6">
          <h2 className="font-semibold text-white mb-4">New Store Registrations</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={storeGrowth ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={(d) => d?.slice(5)} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }} />
              <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* System error rate */}
        <div className="card-dark p-6">
          <h2 className="font-semibold text-white mb-4">Error Rate (24h)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={systemHealth?.errorRate ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="timestamp" tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={(d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }} />
              <Line type="monotone" dataKey="value" stroke="#ef4444" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top stores by revenue */}
      <div className="card-dark">
        <div className="px-6 py-4 border-b border-gray-800">
          <h2 className="font-semibold text-white">Top Stores by Revenue (30d)</h2>
          <p className="text-xs text-gray-500 mt-0.5">Aggregated totals only — no customer data</p>
        </div>
        <div className="divide-y divide-gray-800">
          {(topStoresByRevenue ?? []).map((store: { store_name: string; revenue: number; order_count: number }, i: number) => (
            <div key={i} className="px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-gray-600 text-sm font-mono w-5">{i + 1}</span>
                <span className="font-medium text-white">{store.store_name}</span>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <span className="text-gray-400">{store.order_count} orders</span>
                <span className="font-bold text-green-400">${store.revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent alerts */}
      {recentAlerts?.length > 0 && (
        <div className="card-dark">
          <div className="px-6 py-4 border-b border-gray-800">
            <h2 className="font-semibold text-white">Recent Alerts</h2>
          </div>
          <div className="divide-y divide-gray-800">
            {recentAlerts.map((alert: { id: string; severity: string; metric: string; message: string; klDivergence?: number; acknowledged: boolean }) => (
              <div key={alert.id} className="px-6 py-3 flex items-start gap-3">
                <span className={alert.severity === 'CRITICAL' ? 'badge-critical' : 'badge-warning'}>{alert.severity}</span>
                <div className="flex-1">
                  <p className="text-sm text-gray-300">{alert.message}</p>
                  {alert.klDivergence && (
                    <p className="text-xs text-gray-500 mt-0.5">KL divergence: {alert.klDivergence.toFixed(4)}</p>
                  )}
                </div>
                {alert.acknowledged && <span className="text-xs text-gray-600">ACK</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
