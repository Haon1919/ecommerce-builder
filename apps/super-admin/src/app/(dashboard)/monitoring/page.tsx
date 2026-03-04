'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { analyticsApi } from '@/lib/api';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { AlertTriangle, CheckCircle, Activity, Bell } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const METRICS = [
  { key: 'error_rate', label: 'Error Rate', color: '#ef4444', unit: '' },
  { key: 'response_time_ms', label: 'Response Time (ms)', color: '#3b82f6', unit: 'ms' },
  { key: 'order_count', label: 'Orders/minute', color: '#10b981', unit: '' },
  { key: 'chat_sessions', label: 'Chat Sessions/minute', color: '#8b5cf6', unit: '' },
];

function MetricChart({ metric, hours }: { metric: typeof METRICS[0]; hours: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['metric', metric.key, hours],
    queryFn: () => analyticsApi.metrics(metric.key, hours),
    refetchInterval: 60000,
  });

  return (
    <div className="card-dark p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-white text-sm">{metric.label}</h3>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: metric.color }} />
          <span className="text-xs text-gray-500">Live</span>
        </div>
      </div>
      {isLoading ? (
        <div className="h-40 bg-gray-800 animate-pulse rounded-lg" />
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={data ?? []}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis
              dataKey="timestamp"
              tick={{ fontSize: 10, fill: '#6b7280' }}
              tickFormatter={(d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            />
            <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} tickFormatter={(v) => `${v}${metric.unit}`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px', fontSize: '11px' }}
              formatter={(v) => [`${v}${metric.unit}`, metric.label]}
            />
            <Line type="monotone" dataKey="value" stroke={metric.color} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default function MonitoringPage() {
  const qc = useQueryClient();
  const [hours, setHours] = useState(24);

  const { data: alerts } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => analyticsApi.alerts(false),
    refetchInterval: 30000,
  });

  const ackMutation = useMutation({
    mutationFn: (alertId: string) => analyticsApi.acknowledgeAlert(alertId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });

  const unacknowledged = (alerts ?? []).filter((a: { acknowledged: boolean }) => !a.acknowledged);

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Anomaly Detection</h1>
          <p className="text-gray-400 mt-1 text-sm">
            KL Divergence monitors deviations from 7-day baseline distributions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Time window:</span>
          {[1, 6, 24, 168].map((h) => (
            <button
              key={h}
              onClick={() => setHours(h)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                hours === h ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {h === 168 ? '7d' : h === 24 ? '24h' : h === 6 ? '6h' : '1h'}
            </button>
          ))}
        </div>
      </div>

      {/* Unacknowledged alerts banner */}
      {unacknowledged.length > 0 && (
        <div className="bg-red-900/20 border border-red-700 rounded-xl p-4 flex items-start gap-3">
          <Bell className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-red-300">{unacknowledged.length} unacknowledged alerts</p>
            <p className="text-red-400 text-sm mt-0.5">Review and acknowledge anomalies below</p>
          </div>
        </div>
      )}

      {/* Metric charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {METRICS.map((metric) => (
          <MetricChart key={metric.key} metric={metric} hours={hours} />
        ))}
      </div>

      {/* KL Divergence explanation */}
      <div className="card-dark p-6">
        <div className="flex items-start gap-3 mb-4">
          <Activity className="w-5 h-5 text-violet-400 flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="font-semibold text-white">How Anomaly Detection Works</h2>
            <p className="text-gray-400 text-sm mt-1">
              KL Divergence (Kullback-Leibler) measures how the current metric distribution
              diverges from the 7-day baseline. KL(P||Q) = Σ P(x) log(P(x)/Q(x))
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-green-400 font-semibold mb-1">KL &lt; 0.3</p>
            <p className="text-gray-400">Normal — distributions closely match baseline</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-amber-400 font-semibold mb-1">0.3 ≤ KL &lt; 0.5</p>
            <p className="text-gray-400">Warning — moderate deviation detected</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-red-400 font-semibold mb-1">KL ≥ 0.5</p>
            <p className="text-gray-400">Critical — significant anomaly, action required</p>
          </div>
        </div>
      </div>

      {/* Alerts list */}
      <div className="card-dark">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="font-semibold text-white">Alert History</h2>
          <span className="text-xs text-gray-500">{(alerts ?? []).length} total alerts</span>
        </div>
        <div className="divide-y divide-gray-800 max-h-96 overflow-y-auto">
          {(alerts ?? []).length === 0 ? (
            <div className="flex items-center justify-center py-12 text-gray-600 gap-2">
              <CheckCircle className="w-5 h-5" />
              <span>No alerts — all systems normal</span>
            </div>
          ) : (
            (alerts ?? []).map((alert: {
              id: string; severity: string; metric: string; message: string;
              klDivergence?: number; acknowledged: boolean; createdAt: string; storeId?: string
            }) => (
              <div key={alert.id} className={`px-6 py-4 flex items-start gap-4 ${alert.acknowledged ? 'opacity-50' : ''}`}>
                <AlertTriangle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                  alert.severity === 'CRITICAL' ? 'text-red-400' : 'text-amber-400'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={alert.severity === 'CRITICAL' ? 'badge-critical' : 'badge-warning'}>
                      {alert.severity}
                    </span>
                    <span className="text-xs text-gray-500 font-mono">{alert.metric}</span>
                    {alert.klDivergence && (
                      <span className="text-xs text-gray-600">KL={alert.klDivergence.toFixed(3)}</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-300 line-clamp-2">{alert.message}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
                  </p>
                </div>
                {!alert.acknowledged && (
                  <button
                    onClick={() => ackMutation.mutate(alert.id)}
                    className="flex-shrink-0 text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
                  >
                    Acknowledge
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
