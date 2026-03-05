'use client';

import { useEffect, useState } from 'react';
import { PageRenderer } from '@/components/PageRenderer';
import type { PageComponent } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function DemoStorePage() {
    const [layout, setLayout] = useState<PageComponent[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [apiAvailable, setApiAvailable] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const storeRes = await fetch(`${API_URL}/api/stores/slug/demo`);
                if (!storeRes.ok) throw new Error('API unavailable');
                const store = await storeRes.json();
                setApiAvailable(true);

                const [pageRes, productsRes] = await Promise.all([
                    fetch(`${API_URL}/api/stores/${store.id}/pages/`),
                    fetch(`${API_URL}/api/stores/${store.id}/products?limit=50`),
                ]);

                if (pageRes.ok) {
                    const pageData = await pageRes.json();
                    if (Array.isArray(pageData.layout)) setLayout(pageData.layout);
                }
                if (productsRes.ok) {
                    const prodData = await productsRes.json();
                    if (Array.isArray(prodData.products)) setProducts(prodData.products);
                }
            } catch {
                // API not available — show static demo
            }
            setLoaded(true);
        };
        fetchData();
    }, []);

    if (!loaded) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white">
                <div className="text-gray-400 text-lg">Loading storefront...</div>
            </div>
        );
    }

    if (apiAvailable && layout.length > 0) {
        return <PageRenderer layout={layout} storeSlug="demo" products={products} />;
    }

    // Static demo fallback
    return (
        <div className="min-h-screen bg-white">
            <section className="relative py-24 px-8 text-center" style={{ backgroundColor: '#6366f1', color: '#ffffff' }}>
                <div className="max-w-3xl mx-auto">
                    <h1 className="text-5xl font-bold mb-4 leading-tight">Welcome to the Demo Store</h1>
                    <p className="text-xl opacity-90 mb-8">This is a static preview of the e-commerce storefront. Connect to the API to see live data.</p>
                </div>
            </section>
            <section className="px-8 py-12 max-w-4xl mx-auto">
                <h2 className="text-3xl font-bold text-center mb-8 text-gray-900">Features</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="text-center p-6 rounded-xl border border-gray-100">
                        <div className="text-4xl mb-4">🛍️</div>
                        <h3 className="font-semibold text-lg mb-2">Product Catalog</h3>
                        <p className="text-gray-500 text-sm">Browse and search through a full product catalog with categories and filtering.</p>
                    </div>
                    <div className="text-center p-6 rounded-xl border border-gray-100">
                        <div className="text-4xl mb-4">🛒</div>
                        <h3 className="font-semibold text-lg mb-2">Shopping Cart</h3>
                        <p className="text-gray-500 text-sm">Add items to your cart and proceed through a streamlined checkout flow.</p>
                    </div>
                    <div className="text-center p-6 rounded-xl border border-gray-100">
                        <div className="text-4xl mb-4">💬</div>
                        <h3 className="font-semibold text-lg mb-2">Live Chat</h3>
                        <p className="text-gray-500 text-sm">AI-powered customer support chat widget built into every store page.</p>
                    </div>
                </div>
            </section>
            <section className="px-8 py-12 bg-gray-50 text-center">
                <h2 className="text-2xl font-bold mb-2 text-gray-900">Want to see this live?</h2>
                <p className="text-gray-500 mb-6">Deploy the API server and create your own store to see the full experience.</p>
            </section>
        </div>
    );
}
