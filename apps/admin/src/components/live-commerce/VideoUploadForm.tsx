'use client';
import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/auth';

interface Product {
    id: string;
    name: string;
    price: number;
}

export function VideoUploadForm({ storeId }: { storeId: string }) {
    const { token } = useAuthStore();
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [title, setTitle] = useState('');
    const [products, setProducts] = useState<Product[]>([]);
    const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        // Fetch products to allow tagging
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/stores/${storeId}/products?limit=100`, {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(data => {
                if (data.products) {
                    setProducts(data.products);
                }
            })
            .catch(console.error);
    }, [storeId, token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!videoFile || !title) return;

        setIsUploading(true);
        setMessage(null);

        const formData = new FormData();
        formData.append('video', videoFile);
        formData.append('title', title);
        if (selectedProductIds.length > 0) {
            formData.append('productIds', JSON.stringify(selectedProductIds));
        }

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/stores/${storeId}/videos`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`
                },
                body: formData,
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Upload failed');
            }

            setMessage({ type: 'success', text: 'Video uploaded successfully!' });
            setVideoFile(null);
            setTitle('');
            setSelectedProductIds([]);
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'An error occurred' });
        } finally {
            setIsUploading(false);
        }
    };

    const toggleProduct = (productId: string) => {
        setSelectedProductIds(prev =>
            prev.includes(productId)
                ? prev.filter(id => id !== productId)
                : [...prev, productId]
        );
    };

    return (
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <h2 className="text-lg font-semibold mb-4 text-gray-900">Upload New Video</h2>

            {message && (
                <div className={`p-4 mb-4 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                    {message.text}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Video Title</label>
                    <input
                        type="text"
                        required
                        className="w-full px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-gray-900"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g., Summer Collection Highlights"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Video File (Max 50MB)</label>
                    <div className="flex items-center justify-center w-full">
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                                <p className="text-xs text-gray-500">{videoFile ? videoFile.name : 'MP4, WebM (MAX. 50MB)'}</p>
                            </div>
                            <input
                                type="file"
                                className="hidden"
                                accept="video/*"
                                onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                                required={!videoFile}
                            />
                        </label>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tag Shoppable Products</label>
                    <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-md p-2 space-y-1 bg-gray-50">
                        {products.length === 0 ? (
                            <p className="text-sm text-gray-500 p-2 text-center">No products available to tag. Add some products to inventory first.</p>
                        ) : (
                            products.map(product => (
                                <label key={product.id} className="flex items-center p-3 bg-white hover:bg-gray-50 border border-gray-100 rounded cursor-pointer transition-colors shadow-sm">
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                                        checked={selectedProductIds.includes(product.id)}
                                        onChange={() => toggleProduct(product.id)}
                                    />
                                    <span className="ml-3 flex-1 text-sm font-medium text-gray-700">{product.name}</span>
                                    <span className="text-sm text-gray-500">${product.price.toString()}</span>
                                </label>
                            ))
                        )}
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={isUploading}
                    className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 transition-colors"
                >
                    {isUploading ? 'Uploading...' : 'Upload Video'}
                </button>
            </form>
        </div>
    );
}
