'use client';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth';
import { discountsApi } from '@/lib/api';
import Link from 'next/link';
import { Plus, Tag, Calendar, BadgePercent, Settings2, Trash2, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';

export default function OffersPage() {
    const { store } = useAuthStore();

    const { data: discounts, isLoading } = useQuery({
        queryKey: ['discounts', store?.id],
        queryFn: () => discountsApi.list(store!.id),
        enabled: !!store?.id,
    });

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 border-b-4 border-primary-500 pb-2 inline-block">
                        Promotions & Offers
                    </h1>
                    <p className="text-gray-500 mt-2">Manage customer rewards, coupon codes and rule-based discounts.</p>
                </div>
                <Link
                    href="/offers/new"
                    className="btn-primary flex items-center gap-2 hover:scale-105 transition-transform"
                >
                    <Plus size={18} /> New Promotion
                </Link>
            </div>

            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-48 bg-gray-100 rounded-2xl" />
                    ))}
                </div>
            ) : discounts?.length === 0 ? (
                <div className="bg-white rounded-3xl border-2 border-dashed border-gray-200 p-20 text-center shadow-sm">
                    <div className="bg-primary-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Tag className="text-primary-600" size={40} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">No active promotions</h2>
                    <p className="text-gray-500 max-w-sm mx-auto mb-8">
                        Create your first offer to drive more sales and reward your loyal customers.
                    </p>
                    <Link href="/offers/new" className="btn-primary inline-flex items-center gap-2">
                        <Plus size={18} /> Create Early Bird Special
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {discounts?.map((discount: any) => (
                        <Link
                            key={discount.id}
                            href={`/offers/${discount.id}`}
                            className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-xl hover:-translate-y-1 transition-all group"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className={`p-3 rounded-xl ${discount.active ? 'bg-primary-50 text-primary-600' : 'bg-gray-50 text-gray-400'}`}>
                                    {discount.type === 'PERCENTAGE' ? <BadgePercent size={24} /> : <Tag size={24} />}
                                </div>
                                <div className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${discount.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                                    }`}>
                                    {discount.active ? 'Active' : 'Inactive'}
                                </div>
                            </div>

                            <h3 className="text-lg font-bold text-gray-900 group-hover:text-primary-600 transition-colors">
                                {discount.code ? (
                                    <span className="font-mono bg-gray-900 text-white px-2 py-0.5 rounded text-sm mr-2 uppercase">
                                        {discount.code}
                                    </span>
                                ) : 'Auto-Applied Discount'}
                            </h3>
                            <p className="text-gray-500 text-sm mt-2 line-clamp-2 min-h-[40px]">
                                {discount.description || 'No description provided.'}
                            </p>

                            <div className="mt-6 pt-6 border-t border-gray-50 flex items-center justify-between">
                                <div className="flex items-center gap-2 text-xs text-gray-400">
                                    <Calendar size={14} />
                                    <span>
                                        {discount.startDate ? format(new Date(discount.startDate), 'MMM d') : 'Now'}
                                        {' → '}
                                        {discount.endDate ? format(new Date(discount.endDate), 'MMM d, yyyy') : 'Forev'}
                                    </span>
                                </div>
                                <ArrowRight className="text-gray-300 group-hover:text-primary-500 group-hover:translate-x-1 transition-all" size={18} />
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
