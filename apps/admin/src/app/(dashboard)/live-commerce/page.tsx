'use client';
import { useAuthStore } from '@/lib/auth';
import { VideoUploadForm } from '@/components/live-commerce/VideoUploadForm';

export default function LiveCommercePage() {
    const { store } = useAuthStore();

    if (!store) return null;
    if (store.tier === 'STARTER') {
        return (
            <div className="p-8 max-w-4xl mx-auto">
                <div className="bg-yellow-50 p-4 border border-yellow-200 rounded-lg text-yellow-800">
                    <h2 className="font-semibold mb-2">Upgrade Required</h2>
                    <p className="text-sm">Live Commerce features (video uploads and shoppable feeds) are only available on the GROWTH tier and above. Please upgrade your store plan to access these features.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Live Commerce</h1>
                <p className="text-gray-600">Upload and manage shoppable videos for your storefront&apos;s interactive feed.</p>
            </div>

            <VideoUploadForm storeId={store.id} />
        </div>
    );
}
