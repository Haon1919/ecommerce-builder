'use client';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth';
import { discountsApi } from '@/lib/api';
import { PromotionBuilder } from '@/components/offers/PromotionBuilder';
import { ChevronLeft, Trash2, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'react-hot-toast';

export default function EditPromotionPage() {
    const { id } = useParams() as { id: string };
    const router = useRouter();
    const { store } = useAuthStore();
    const queryClient = useQueryClient();

    const { data: promo, isLoading } = useQuery({
        queryKey: ['discount', store?.id, id],
        queryFn: () => discountsApi.get(store!.id, id),
        enabled: !!store?.id && !!id
    });

    const { mutate: updatePromo, isPending } = useMutation({
        mutationFn: (data: any) => discountsApi.update(store!.id, id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['discounts', store?.id] });
            toast.success('Updated successfully!', {
                icon: '✏️',
                style: { borderRadius: '24px', background: '#eff6ff', color: '#1e40af', fontWeight: 'bold' }
            });
            router.push('/offers');
        }
    });

    const { mutate: deletePromo, isPending: isDeleting } = useMutation({
        mutationFn: () => discountsApi.delete(store!.id, id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['discounts', store?.id] });
            toast.success('Promotion deleted.');
            router.push('/offers');
        }
    });

    if (isLoading) return <div className="p-20 text-center text-gray-400 font-bold animate-pulse">Loading Design Details...</div>;

    return (
        <div className="p-8 max-w-5xl mx-auto space-y-12 pb-32">
            <div className="flex justify-between items-end">
                <div>
                    <Link href="/offers" className="flex items-center gap-2 text-gray-400 hover:text-gray-900 mb-6 font-bold transition-colors">
                        <ChevronLeft size={20} /> Back to Offers
                    </Link>
                    <h1 className="text-4xl font-black text-gray-900 tracking-tight flex items-center gap-4">
                        Refine Offer Logic <ShieldCheck className="text-green-500" size={32} />
                    </h1>
                    <p className="text-gray-500 font-medium text-lg mt-2">Adjust your rule parameters and re-publish the offer instantly.</p>
                </div>

                <button
                    onClick={() => { if (confirm('Permanently delete this promotion?')) deletePromo(); }}
                    disabled={isDeleting}
                    className="p-4 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-3xl transition-all"
                >
                    <Trash2 size={24} />
                </button>
            </div>

            <PromotionBuilder
                initialData={promo}
                onSave={(data) => updatePromo(data)}
                isSaving={isPending}
            />
        </div>
    );
}
