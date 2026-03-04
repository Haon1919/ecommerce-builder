'use client';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell
} from 'recharts';
import { ShoppingCart, DollarSign, Package, MessageSquare, AlertTriangle, Users } from 'lucide-react';
import type { AnalyticsDashboard as DashboardData } from '@/types';

interface Props {
  data?: DashboardData;
  isLoading: boolean;
}

const MetricCard = ({
  icon: Icon, label, value, sub, color = 'indigo', urgent = false
}: {
  icon: React.ElementType; label: string; value: string | number; sub?: string;
  color?: string; urgent?: boolean;
}) => (
  <div className={`card p-6 ${urgent ? 'ring-2 ring-amber-400' : ''}`}>
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-gray-500 font-medium">{label}</p>
        <p className={`text-2xl font-bold mt-1 text-${color}-600`}>{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      </div>
      <div className={`p-3 bg-${color}-100 rounded-xl`}>
        <Icon className={`w-5 h-5 text-${color}-600`} />
      </div>
    </div>
  </div>
);

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#f59e0b', CONFIRMED: '#3b82f6', PROCESSING: '#8b5cf6',
  SHIPPED: '#06b6d4', DELIVERED: '#10b981', CANCELLED: '#ef4444', REFUNDED: '#6b7280',
};

export function AnalyticsDashboard({ data, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="card p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-3" />
            <div className="h-8 bg-gray-200 rounded w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  if (!data) return null;

  const { overview, revenueByDay, ordersByStatus } = data;

  const pieData = Object.entries(ordersByStatus ?? {}).map(([status, count]) => ({
    name: status, value: count, color: STATUS_COLORS[status] ?? '#6b7280',
  }));

  return (
    <div className="space-y-8">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          icon={DollarSign} label="Total Revenue" color="emerald"
          value={`$${overview.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          sub="Last 30 days"
        />
        <MetricCard
          icon={ShoppingCart} label="Total Orders"
          value={overview.totalOrders}
          sub={`${overview.pendingOrders} pending`}
          color="blue"
          urgent={overview.pendingOrders > 10}
        />
        <MetricCard
          icon={Package} label="Products"
          value={overview.totalProducts}
          sub={overview.lowStockProducts > 0 ? `${overview.lowStockProducts} low stock` : 'All stocked'}
          color="violet"
          urgent={overview.lowStockProducts > 0}
        />
        <MetricCard
          icon={MessageSquare} label="Unread Messages"
          value={overview.unreadMessages}
          sub={`${overview.chatSessions} chat sessions`}
          color="amber"
          urgent={overview.unreadMessages > 0}
        />
      </div>

      {/* Revenue Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-6 lg:col-span-2">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Revenue Over Time</h2>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={revenueByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => d.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(v) => [`$${Number(v).toFixed(2)}`, 'Revenue']} />
              <Line type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Orders by Status</h2>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-gray-400 text-sm">No orders yet</div>
          )}
        </div>
      </div>

      {/* Orders per day bar chart */}
      <div className="card p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Orders Per Day</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={revenueByDay}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => d.slice(5)} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="orders" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Recent Orders */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Recent Orders</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {data.recentOrders?.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">No orders yet</div>
          ) : (
            data.recentOrders?.map((order) => (
              <div key={order.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                <div>
                  <p className="font-medium text-sm text-gray-900">{order.orderNumber}</p>
                  <p className="text-xs text-gray-500">{order.items?.map((i) => i.productName).join(', ')}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-sm">${Number(order.total).toFixed(2)}</p>
                  <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                    order.status === 'DELIVERED' ? 'bg-green-100 text-green-700' :
                    order.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {order.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
