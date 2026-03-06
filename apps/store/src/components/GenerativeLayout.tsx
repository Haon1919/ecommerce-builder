'use client';

import { useEffect, useState } from 'react';
import { PageRenderer } from './PageRenderer';
import { storeApi } from '@/lib/api';
import type { StoreInfo, PageComponent } from '@/types';

interface Product {
    id: string;
    name: string;
    price: number;
    comparePrice?: number;
    images: string[];
    stock: number;
    category?: string;
}

interface Props {
    store: StoreInfo;
    storeSlug: string;
    fallbackLayout: PageComponent[];
    products: Product[];
}

export function GenerativeLayout({ store, storeSlug, fallbackLayout, products }: Props) {
    const [layout, setLayout] = useState<PageComponent[]>(fallbackLayout);
    const [loading, setLoading] = useState(store.tier === 'ENTERPRISE');

    useEffect(() => {
        if (store.tier !== 'ENTERPRISE') {
            return;
        }

        async function fetchLayout() {
            try {
                const data = await storeApi.generateLayout(store.id);
                if (data && Array.isArray(data.layout)) {
                    setLayout(data.layout);
                }
            } catch (err) {
                console.error('Failed to generate layout, falling back to default', err);
            } finally {
                setLoading(false);
            }
        }

        fetchLayout();
    }, [store.id, store.tier]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-gray-500 font-medium animate-pulse">Generating personalized store experience...</p>
                </div>
            </div>
        );
    }

    return <PageRenderer layout={layout} storeSlug={storeSlug} products={products} />;
}
