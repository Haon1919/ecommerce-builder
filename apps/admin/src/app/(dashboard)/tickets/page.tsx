'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth';
import { ticketsApi } from '@/lib/api';
import type { SupportTicket } from '@/types';
import { Plus, Ticket, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-600',
  MEDIUM: 'bg-blue-100 text-blue-700',
  HIGH: 'bg-amber-100 text-amber-700',
  CRITICAL: 'bg-red-100 text-red-700',
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  WAITING_FOR_INFO: 'Waiting',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

export default function TicketsPage() {
  const store = useAuthStore((s) => s.store);
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [comment, setComment] = useState('');
  const [form, setForm] = useState({ title: '', description: '', priority: 'MEDIUM' as const, category: '' });

  const { data: tickets = [], isLoading } = useQuery<SupportTicket[]>({
    queryKey: ['tickets', store?.id],
    queryFn: () => ticketsApi.list(store!.id),
    enabled: !!store?.id,
  });

  const createMutation = useMutation({
    mutationFn: () => ticketsApi.create(store!.id, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets', store?.id] });
      setShowForm(false);
      setForm({ title: '', description: '', priority: 'MEDIUM', category: '' });
    },
  });

  const commentMutation = useMutation({
    mutationFn: () => ticketsApi.addComment(selectedTicket!.id, comment),
    onSuccess: () => {
      setComment('');
      qc.invalidateQueries({ queryKey: ['tickets', store?.id] });
    },
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Support Tickets</h1>
          <p className="text-gray-500 mt-1">Report issues to the platform team</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> New Ticket
        </button>
      </div>

      {/* New ticket form */}
      {showForm && (
        <div className="card p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">New Support Ticket</h2>
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
            <div>
              <label className="label">Title *</label>
              <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </div>
            <div>
              <label className="label">Description *</label>
              <textarea className="input resize-none" rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Priority</label>
                <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as typeof form.priority })}>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>
              <div>
                <label className="label">Category</label>
                <input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g., Billing, Technical" />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={createMutation.isPending} className="btn-primary">
                {createMutation.isPending ? 'Submitting...' : 'Submit Ticket'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ticket list */}
        <div className="lg:col-span-2 space-y-3">
          {isLoading ? (
            <div className="card p-8 text-center text-gray-400">Loading tickets...</div>
          ) : tickets.length === 0 ? (
            <div className="card p-12 text-center text-gray-400">
              <Ticket className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No tickets yet</p>
              <p className="text-sm mt-1">Create a ticket to get help from the platform team</p>
            </div>
          ) : (
            tickets.map((ticket) => (
              <button
                key={ticket.id}
                onClick={() => setSelectedTicket(ticket)}
                className={`card p-5 w-full text-left hover:shadow-md transition-shadow ${
                  selectedTicket?.id === ticket.id ? 'ring-2 ring-primary-500' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gray-400 font-mono">{ticket.ticketNumber}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PRIORITY_COLORS[ticket.priority]}`}>
                        {ticket.priority}
                      </span>
                    </div>
                    <p className="font-semibold text-gray-900 truncate">{ticket.title}</p>
                    <p className="text-sm text-gray-500 truncate mt-0.5">{ticket.description.substring(0, 80)}</p>
                    <p className="text-xs text-gray-400 mt-2">{formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}</p>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${
                    ticket.status === 'RESOLVED' || ticket.status === 'CLOSED' ? 'bg-green-100 text-green-700' :
                    ticket.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {STATUS_LABELS[ticket.status]}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Ticket detail */}
        <div className="card">
          {!selectedTicket ? (
            <div className="p-8 text-center text-gray-400">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Select a ticket to view details</p>
            </div>
          ) : (
            <div className="p-5">
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-gray-400 font-mono">{selectedTicket.ticketNumber}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[selectedTicket.priority]}`}>
                    {selectedTicket.priority}
                  </span>
                </div>
                <h3 className="font-semibold text-gray-900">{selectedTicket.title}</h3>
                <p className="text-sm text-gray-500 mt-2">{selectedTicket.description}</p>
              </div>

              {/* Comments */}
              <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
                {selectedTicket.comments?.filter((c) => !c.internal).map((c) => (
                  <div key={c.id} className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs font-medium text-gray-600">{c.user?.name ?? 'Support Team'}</p>
                    <p className="text-sm text-gray-700 mt-1">{c.body}</p>
                  </div>
                ))}
              </div>

              {/* Add comment */}
              {!['RESOLVED', 'CLOSED'].includes(selectedTicket.status) && (
                <div className="space-y-2">
                  <textarea
                    className="input resize-none text-sm"
                    rows={3}
                    placeholder="Add a comment..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                  <button
                    onClick={() => commentMutation.mutate()}
                    disabled={!comment.trim() || commentMutation.isPending}
                    className="btn-primary text-sm w-full"
                  >
                    Post Comment
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
