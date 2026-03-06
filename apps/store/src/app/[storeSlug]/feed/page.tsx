import { storeApi } from '@/lib/api';
import { notFound } from 'next/navigation';
import { TikTokFeed } from '@/components/live-commerce/TikTokFeed';

export const metadata = {
    title: 'Live Commerce Feed',
    description: 'Interactive shoppable video feed',
};

async function getVideos(storeId: string) {
    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/stores/${storeId}/videos?limit=20`, {
            next: { revalidate: 60 }
        });
        if (!res.ok) return [];
        const videos = await res.json();
        return Array.isArray(videos) ? videos : [];
    } catch {
        return [];
    }
}

export default async function FeedPage({ params }: { params: Promise<{ storeSlug: string }> }) {
    const { storeSlug } = await params;

    let store;
    try {
        store = await storeApi.getBySlug(storeSlug);
    } catch {
        notFound();
    }

    if (!store) notFound();

    const videos = await getVideos(store.id);

    return (
        <div>
            <TikTokFeed storeId={store.id} initialVideos={videos} />
        </div>
    );
}
