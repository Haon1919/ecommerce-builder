'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth';
import { ordersApi } from '@/lib/api';
import type { Order } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { Package, Truck, CheckCircle, XCircle } from 'lucide-react';

const STATUS_FLOW = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'];
const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  PROCESSING: 'bg-violet-100 text-violet-700',
  SHIPPED: 'bg-cyan-100 text-cyan-700',
  DELIVERED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
  REFUNDED: 'bg-gray-100 text-gray-600',
};

export default function OrdersPage() {
  const store = useAuthStore((s) => s.store);
  const qc = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['orders', store?.id],
    queryFn: () => ordersApi.list(store!.id),
    enabled: !!store?.id,
    refetchInterval: 60000,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: string }) =>
      ordersApi.updateStatus(store!.id, orderId, status, status === 'SHIPPED' ? trackingNumber : undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders', store?.id] });
      setTrackingNumber('');
    },
  });

  const orders: Order[] = data?.orders ?? [];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        <p className="text-gray-500 mt-1">{data?.total ?? 0} total orders</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order list */}
        <div className="lg:col-span-2">
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-3 font-semibold text-gray-600">Order</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Customer</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Total</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Status</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {isLoading ? (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400">Loading...</td></tr>
                ) : orders.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400">No orders yet</td></tr>
                ) : (
                  orders.map((order) => (
                    <tr key={order.id} onClick={() => setSelectedOrder(order)} className={`cursor-pointer hover:bg-gray-50 transition-colors ${selectedOrder?.id === order.id ? 'bg-primary-50' : ''}`}>
                      <td className="px-6 py-4 font-medium text-gray-900">{order.orderNumber}</td>
                      <td className="px-4 py-4 text-gray-500">{order.customerName}</td>
                      <td className="px-4 py-4 text-right font-semibold">${Number(order.total).toFixed(2)}</td>
                      <td className="px-4 py-4 text-center">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[order.status]}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right text-gray-400 text-xs">
                        {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Order detail */}
        <div className="card p-6">
          {!selectedOrder ? (
            <div className="text-center text-gray-400 py-8">
              <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Select an order</p>
            </div>
          ) : (
            <div>
              <div className="mb-4">
                <h3 className="font-bold text-gray-900">{selectedOrder.orderNumber}</h3>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[selectedOrder.status]}`}>
                  {selectedOrder.status}
                </span>
              </div>

              <div className="space-y-3 text-sm mb-4">
                <div><span className="text-gray-500">Customer:</span> <span className="font-medium">{selectedOrder.customerName}</span></div>
                <div><span className="text-gray-500">Email:</span> <span>{selectedOrder.customerEmail}</span></div>
                {selectedOrder.shippingAddress && (
                  <div>
                    <span className="text-gray-500">Ship to:</span>
                    <p className="mt-0.5 text-gray-700">
                      {selectedOrder.shippingAddress.line1}, {selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.state} {selectedOrder.shippingAddress.zip}
                    </p>
                  </div>
                )}
              </div>

              {/* Items */}
              <div className="border-t border-gray-100 pt-3 mb-4">
                {selectedOrder.items?.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm py-1.5">
                    <span className="text-gray-700">{item.productName} × {item.quantity}</span>
                    <span className="font-medium">${(Number(item.price) * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
                <div className="border-t border-gray-100 pt-2 mt-2 space-y-1 text-sm">
                  <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>${Number(selectedOrder.subtotal).toFixed(2)}</span></div>
                  <div className="flex justify-between text-gray-500"><span>Tax</span><span>${Number(selectedOrder.tax).toFixed(2)}</span></div>
                  <div className="flex justify-between text-gray-500"><span>Shipping</span><span>${Number(selectedOrder.shipping).toFixed(2)}</span></div>
                  <div className="flex justify-between font-bold text-gray-900"><span>Total</span><span>${Number(selectedOrder.total).toFixed(2)}</span></div>
                </div>
              </div>

              {/* Status actions */}
              {!['CANCELLED', 'REFUNDED', 'DELIVERED'].includes(selectedOrder.status) && (
                <div className="space-y-2">
                  {selectedOrder.status === 'PROCESSING' && (
                    <div>
                      <label className="label text-xs">Tracking Number (optional)</label>
                      <input className="input text-sm" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="USPS, FedEx, UPS..." />
                    </div>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    {STATUS_FLOW.indexOf(selectedOrder.status) >= 0 && STATUS_FLOW.indexOf(selectedOrder.status) < STATUS_FLOW.length - 1 && (
                      <button
                        onClick={() => updateStatusMutation.mutate({ orderId: selectedOrder.id, status: STATUS_FLOW[STATUS_FLOW.indexOf(selectedOrder.status) + 1] })}
                        className="btn-primary text-xs flex-1 flex items-center justify-center gap-1"
                      >
                        <Truck className="w-3.5 h-3.5" />
                        Mark as {STATUS_FLOW[STATUS_FLOW.indexOf(selectedOrder.status) + 1]}
                      </button>
                    )}
                    <button
                      onClick={() => updateStatusMutation.mutate({ orderId: selectedOrder.id, status: 'CANCELLED' })}
                      className="btn-secondary text-xs px-3 text-red-600 hover:bg-red-50 hover:border-red-200"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
