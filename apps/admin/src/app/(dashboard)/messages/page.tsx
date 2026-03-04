'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth';
import { messagesApi } from '@/lib/api';
import type { ContactMessage } from '@/types';
import { Mail, Reply, Circle, Send } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function MessagesPage() {
  const store = useAuthStore((s) => s.store);
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['messages', store?.id],
    queryFn: () => messagesApi.list(store!.id),
    enabled: !!store?.id,
    refetchInterval: 30000, // Poll every 30s
  });

  const { data: selected } = useQuery<ContactMessage>({
    queryKey: ['message', store?.id, selectedId],
    queryFn: () => messagesApi.get(store!.id, selectedId!),
    enabled: !!store?.id && !!selectedId,
  });

  const replyMutation = useMutation({
    mutationFn: () => messagesApi.reply(store!.id, selectedId!, replyText),
    onSuccess: () => {
      setReplyText('');
      qc.invalidateQueries({ queryKey: ['message', store?.id, selectedId] });
      qc.invalidateQueries({ queryKey: ['messages', store?.id] });
    },
  });

  const messages: ContactMessage[] = data?.messages ?? [];

  return (
    <div className="flex h-[calc(100vh-0px)]">
      {/* Message list */}
      <div className="w-80 border-r border-gray-200 flex flex-col bg-white flex-shrink-0">
        <div className="px-6 py-5 border-b border-gray-100">
          <h1 className="text-xl font-bold text-gray-900">Messages</h1>
          {data?.unreadCount > 0 && (
            <p className="text-sm text-primary-600 mt-1">{data.unreadCount} unread</p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-gray-400 text-sm">Loading...</div>
          ) : messages.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <Mail className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No messages yet</p>
            </div>
          ) : (
            messages.map((msg) => (
              <button
                key={msg.id}
                onClick={() => setSelectedId(msg.id)}
                className={`w-full text-left px-6 py-4 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                  selectedId === msg.id ? 'bg-primary-50 border-l-2 border-l-primary-500' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {!msg.read && <Circle className="w-2 h-2 text-primary-500 fill-current flex-shrink-0" />}
                      <p className={`text-sm truncate ${!msg.read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                        {msg.name}
                      </p>
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{msg.subject}</p>
                    <p className="text-xs text-gray-400 truncate mt-1">{msg.message.substring(0, 60)}...</p>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Message thread */}
      <div className="flex-1 flex flex-col bg-gray-50">
        {!selectedId ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <Mail className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Select a message</p>
              <p className="text-sm mt-1">to read and reply</p>
            </div>
          </div>
        ) : !selected ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-8 py-5">
              <h2 className="font-semibold text-gray-900">{selected.subject}</h2>
              <p className="text-sm text-gray-500 mt-1">
                From <strong>{selected.name}</strong> &lt;{selected.email}&gt;
              </p>
            </div>

            {/* Thread */}
            <div className="flex-1 overflow-y-auto p-8 space-y-4">
              {/* Original message */}
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-sm font-medium">
                    {selected.name?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-sm text-gray-900">{selected.name}</p>
                    <p className="text-xs text-gray-400">{formatDistanceToNow(new Date(selected.createdAt), { addSuffix: true })}</p>
                  </div>
                </div>
                <p className="text-gray-700 text-sm whitespace-pre-wrap">{selected.message}</p>
              </div>

              {/* Replies */}
              {selected.replies?.map((reply) => (
                <div key={reply.id} className="bg-primary-50 rounded-xl p-6 ml-8 border border-primary-100">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center text-sm font-medium text-white">
                      {reply.user?.name?.[0]?.toUpperCase() ?? 'A'}
                    </div>
                    <div>
                      <p className="font-medium text-sm text-gray-900">{reply.user?.name ?? 'Admin'}</p>
                      <p className="text-xs text-gray-400">{formatDistanceToNow(new Date(reply.sentAt), { addSuffix: true })}</p>
                    </div>
                  </div>
                  <p className="text-gray-700 text-sm whitespace-pre-wrap">{reply.body}</p>
                </div>
              ))}
            </div>

            {/* Reply box */}
            <div className="bg-white border-t border-gray-200 p-6">
              <div className="flex gap-3">
                <textarea
                  className="input flex-1 resize-none"
                  rows={3}
                  placeholder="Type your reply..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.metaKey && replyText.trim()) {
                      replyMutation.mutate();
                    }
                  }}
                />
                <button
                  onClick={() => replyMutation.mutate()}
                  disabled={!replyText.trim() || replyMutation.isPending}
                  className="btn-primary px-4 flex-shrink-0 flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  {replyMutation.isPending ? 'Sending...' : 'Send'}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">⌘ + Enter to send</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
