'use client';
/**
 * Kanban board for support tickets.
 * Super admin can drag tickets between columns, add internal comments,
 * and see all tenants' tickets without seeing customer PII.
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ticketsApi } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, AlertTriangle, ChevronDown, Send } from 'lucide-react';

type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_FOR_INFO' | 'RESOLVED' | 'CLOSED';

interface Ticket {
  id: string;
  ticketNumber: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  createdAt: string;
  store?: { name: string; slug: string };
  comments?: Array<{ id: string; body: string; internal: boolean; user?: { name: string }; createdAt: string }>;
}

interface KanbanData {
  OPEN: Ticket[];
  IN_PROGRESS: Ticket[];
  WAITING_FOR_INFO: Ticket[];
  RESOLVED: Ticket[];
  CLOSED: Ticket[];
}

const COLUMNS: Array<{ status: TicketStatus; label: string; color: string }> = [
  { status: 'OPEN', label: 'Open', color: 'border-red-500' },
  { status: 'IN_PROGRESS', label: 'In Progress', color: 'border-blue-500' },
  { status: 'WAITING_FOR_INFO', label: 'Waiting', color: 'border-amber-500' },
  { status: 'RESOLVED', label: 'Resolved', color: 'border-green-500' },
  { status: 'CLOSED', label: 'Closed', color: 'border-gray-600' },
];

const PRIORITY_COLORS = {
  LOW: 'text-gray-400 bg-gray-800',
  MEDIUM: 'text-blue-300 bg-blue-900/30',
  HIGH: 'text-amber-300 bg-amber-900/30',
  CRITICAL: 'text-red-300 bg-red-900/30',
};

function TicketCard({ ticket, onMoveNext, onMovePrev }: {
  ticket: Ticket;
  onMoveNext: () => void;
  onMovePrev: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [comment, setComment] = useState('');
  const [internal, setInternal] = useState(false);
  const qc = useQueryClient();

  const commentMutation = useMutation({
    mutationFn: () => ticketsApi.addComment(ticket.id, comment, internal),
    onSuccess: () => { setComment(''); qc.invalidateQueries({ queryKey: ['tickets-kanban'] }); },
  });

  const statusIndex = COLUMNS.findIndex((c) => c.status === ticket.status);

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 hover:border-gray-600 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-mono text-gray-500">{ticket.ticketNumber}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${PRIORITY_COLORS[ticket.priority]}`}>
            {ticket.priority}
          </span>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="text-gray-500 hover:text-gray-300">
          <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      <p className="text-sm font-medium text-white line-clamp-2 mb-1">{ticket.title}</p>
      {ticket.store && (
        <p className="text-xs text-violet-400 mb-2">📦 {ticket.store.name}</p>
      )}
      <p className="text-xs text-gray-500">{formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}</p>

      {expanded && (
        <div className="mt-3 border-t border-gray-700 pt-3 space-y-3">
          <p className="text-xs text-gray-400 leading-relaxed">{ticket.description}</p>

          {/* Comments */}
          {ticket.comments && ticket.comments.length > 0 && (
            <div className="space-y-2">
              {ticket.comments.map((c) => (
                <div key={c.id} className={`rounded-lg p-2 text-xs ${c.internal ? 'bg-violet-900/30 border border-violet-700' : 'bg-gray-700'}`}>
                  <div className="flex items-center gap-1 mb-1">
                    <span className="font-medium text-gray-300">{c.user?.name ?? 'Support'}</span>
                    {c.internal && <span className="text-violet-400">(internal)</span>}
                  </div>
                  <p className="text-gray-400">{c.body}</p>
                </div>
              ))}
            </div>
          )}

          {/* Add comment */}
          <div className="space-y-2">
            <textarea
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-violet-500 resize-none"
              rows={2}
              placeholder="Add a note..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-400">
                <input type="checkbox" className="rounded" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
                Internal note
              </label>
              <button
                onClick={() => commentMutation.mutate()}
                disabled={!comment.trim()}
                className="ml-auto flex items-center gap-1 px-2.5 py-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium"
              >
                <Send className="w-3 h-3" /> Save
              </button>
            </div>
          </div>

          {/* Move buttons */}
          <div className="flex gap-2">
            {statusIndex > 0 && (
              <button onClick={onMovePrev} className="flex-1 text-xs text-gray-400 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-lg py-1.5 transition-colors">
                ← {COLUMNS[statusIndex - 1].label}
              </button>
            )}
            {statusIndex < COLUMNS.length - 1 && (
              <button onClick={onMoveNext} className="flex-1 text-xs text-white bg-violet-600 hover:bg-violet-700 rounded-lg py-1.5 transition-colors">
                → {COLUMNS[statusIndex + 1].label}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function KanbanBoard({ kanban }: { kanban: KanbanData }) {
  const qc = useQueryClient();

  const moveMutation = useMutation({
    mutationFn: ({ ticketId, status }: { ticketId: string; status: string }) =>
      ticketsApi.updateStatus(ticketId, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tickets-kanban'] }),
  });

  const getStatusAt = (statusIndex: number) => COLUMNS[statusIndex]?.status;

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {COLUMNS.map((col, colIndex) => {
        const tickets = kanban[col.status] ?? [];
        return (
          <div key={col.status} className="flex-shrink-0 w-72">
            <div className={`border-t-2 ${col.color} bg-gray-900/50 rounded-xl overflow-hidden`}>
              <div className="px-4 py-3 flex items-center justify-between border-b border-gray-800">
                <h3 className="font-semibold text-sm text-white">{col.label}</h3>
                <span className="bg-gray-800 text-gray-300 text-xs px-2 py-0.5 rounded-full font-medium">
                  {tickets.length}
                </span>
              </div>
              <div className="p-3 space-y-3 max-h-[calc(100vh-250px)] overflow-y-auto">
                {tickets.length === 0 ? (
                  <p className="text-xs text-gray-600 text-center py-4">No tickets</p>
                ) : (
                  tickets.map((ticket) => (
                    <TicketCard
                      key={ticket.id}
                      ticket={ticket}
                      onMoveNext={() => moveMutation.mutate({ ticketId: ticket.id, status: getStatusAt(colIndex + 1) })}
                      onMovePrev={() => moveMutation.mutate({ ticketId: ticket.id, status: getStatusAt(colIndex - 1) })}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
