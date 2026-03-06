'use client';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth';
import { discountsApi } from '@/lib/api';
import { PromotionBuilder } from '@/components/offers/PromotionBuilder';
import { ChevronLeft, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'react-hot-toast';

export default function NewPromotionPage() {
    const router = useRouter();
    const { store } = useAuthStore();
    const queryClient = useQueryClient();

    const { mutate: createPromotion, isPending } = useMutation({
        mutationFn: (data: any) => discountsApi.create(store!.id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['discounts', store?.id] });
            toast.success('Promotion created successfully!', {
                icon: '🎉',
                style: { borderRadius: '24px', background: '#ecfdf5', color: '#065f46', fontWeight: 'bold' }
            });
            router.push('/offers');
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.error || 'Failed to create promotion');
        }
    });

    return (
        <div className="p-8 max-w-5xl mx-auto space-y-12 pb-32">
            <div className="flex justify-between items-end animate-in fade-in duration-700">
                <div>
                    <Link href="/offers" className="flex items-center gap-2 text-gray-400 hover:text-gray-900 mb-6 font-bold transition-colors">
                        <ChevronLeft size={20} /> Back to Offers
                    </Link>
                    <h1 className="text-4xl font-black text-gray-900 tracking-tight flex items-center gap-4">
                        Design New Offer <Sparkles className="text-primary-400 animate-pulse" size={32} />
                    </h1>
                    <p className="text-gray-500 font-medium text-lg mt-2">Construct your discount logic visually in three easy steps.</p>
                </div>
            </div>

            <PromotionBuilder
                onSave={(data) => createPromotion(data)}
                isSaving={isPending}
            />
        </div>
    );
}
