'use client';
import { useQuery } from '@tanstack/react-query';
import { ticketsApi } from '@/lib/api';
import { KanbanBoard } from '@/components/KanbanBoard';

export default function KanbanPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['tickets-kanban'],
    queryFn: () => ticketsApi.all(),
    refetchInterval: 30000,
  });

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Support Tickets</h1>
        <p className="text-gray-400 mt-1">Manage all tenant support requests in a Kanban view</p>
      </div>

      {isLoading ? (
        <div className="flex gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex-shrink-0 w-72 h-64 card-dark animate-pulse" />
          ))}
        </div>
      ) : data?.kanban ? (
        <KanbanBoard kanban={data.kanban} />
      ) : null}
    </div>
  );
}
