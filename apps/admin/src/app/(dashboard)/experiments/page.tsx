'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth';
import { experimentsApi } from '@/lib/api';
import Link from 'next/link';
import { Plus, Trash2, Edit2, Play, Pause, Activity } from 'lucide-react';

export default function ExperimentsPage() {
    const store = useAuthStore((s) => s.store);
    const qc = useQueryClient();
    const [isCreating, setIsCreating] = useState(false);
    const [newExpName, setNewExpName] = useState('');

    const { data: experiments, isLoading } = useQuery({
        queryKey: ['experiments', store?.id],
        queryFn: () => experimentsApi.list(store!.id),
        enabled: !!store?.id,
    });

    const createMutation = useMutation({
        mutationFn: (name: string) =>
            experimentsApi.create(store!.id, {
                name,
                status: 'DRAFT',
                variants: [
                    { name: 'Control', weight: 50, layout: [] },
                    { name: 'Variant A', weight: 50, layout: [] },
                ],
            }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['experiments', store?.id] });
            setIsCreating(false);
            setNewExpName('');
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => experimentsApi.delete(store!.id, id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['experiments', store?.id] }),
    });

    const updateStatusMutation = useMutation({
        mutationFn: ({ id, status }: { id: string; status: string }) =>
            experimentsApi.update(store!.id, id, { ...experiments?.find((e: any) => e.id === id), status }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['experiments', store?.id] }),
    });

    if (!store) return null;

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">A/B Tests</h1>
                    <p className="text-gray-500 mt-1">Experiment with landing page layouts to optimize conversion.</p>
                </div>
                <button
                    onClick={() => setIsCreating(true)}
                    className="btn-primary"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    New Experiment
                </button>
            </div>

            {isCreating && (
                <div className="bg-white p-6 rounded-xl border border-gray-200 mb-6 shadow-sm">
                    <h2 className="text-lg font-medium mb-4">Create New Experiment</h2>
                    <div className="flex gap-4">
                        <input
                            type="text"
                            placeholder="e.g. landing-page-hero-test"
                            className="input-field flex-1"
                            value={newExpName}
                            onChange={(e) => setNewExpName(e.target.value)}
                            autoFocus
                        />
                        <button
                            onClick={() => createMutation.mutate(newExpName)}
                            disabled={!newExpName.trim() || createMutation.isPending}
                            className="btn-primary"
                        >
                            Create
                        </button>
                        <button onClick={() => setIsCreating(false)} className="btn-secondary">
                            Cancel
                        </button>
                    </div>
                    <p className="text-sm text-gray-500 mt-2">
                        The exact name of the experiment should match the specific page slug you want to target (e.g. `landing`).
                    </p>
                </div>
            )}

            {isLoading ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
                </div>
            ) : experiments?.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl border border-gray-200 border-dashed">
                    <Activity className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900">No experiments yet</h3>
                    <p className="text-gray-500 mt-1">Create your first A/B test to start optimizing.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {experiments?.map((exp: any) => (
                        <div key={exp.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <h3 className="font-semibold text-lg text-gray-900">{exp.name}</h3>
                                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${exp.status === 'RUNNING' ? 'bg-green-100 text-green-700' :
                                            exp.status === 'DRAFT' ? 'bg-gray-100 text-gray-700' :
                                                exp.status === 'PAUSED' ? 'bg-amber-100 text-amber-700' :
                                                    'bg-blue-100 text-blue-700'
                                        }`}>
                                        {exp.status}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {exp.status === 'RUNNING' ? (
                                        <button onClick={() => updateStatusMutation.mutate({ id: exp.id, status: 'PAUSED' })} className="btn-secondary text-amber-600 border-amber-200 hover:bg-amber-50">
                                            <Pause className="w-4 h-4 mr-1.5" /> Pause
                                        </button>
                                    ) : (
                                        <button onClick={() => updateStatusMutation.mutate({ id: exp.id, status: 'RUNNING' })} className="btn-secondary text-green-600 border-green-200 hover:bg-green-50">
                                            <Play className="w-4 h-4 mr-1.5" /> Start
                                        </button>
                                    )}
                                    <button
                                        onClick={() => deleteMutation.mutate(exp.id)}
                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded bg-white transition-colors border border-gray-200"
                                        title="Delete Experiment"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <div className="px-6 py-4">
                                <h4 className="text-sm font-medium text-gray-900 mb-3 block">Variants ({exp.variants?.length})</h4>
                                <div className="grid gap-3">
                                    {exp.variants?.map((v: any) => (
                                        <div key={v.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                            <div>
                                                <div className="font-medium text-gray-900 text-sm">{v.name}</div>
                                                <div className="text-xs text-gray-500 mt-0.5">Traffic: {v.weight}%</div>
                                            </div>
                                            <Link
                                                href={`/builder?page=${exp.name}&experimentId=${exp.id}&variantId=${v.id}`}
                                                className="btn-secondary py-1.5 text-xs bg-white"
                                            >
                                                <Edit2 className="w-3.5 h-3.5 mr-1.5" />
                                                Edit Layout
                                            </Link>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
