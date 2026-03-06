'use client';
import { useState, useEffect, useRef } from 'react';
import { useCartStore } from '@/lib/cart';
import { ShoppingCart, X, Volume2, VolumeX, Play } from 'lucide-react';

interface Product {
    id: string;
    name: string;
    price: number;
    images: string[];
}

interface VideoClip {
    id: string;
    url: string;
    title: string;
    products: Product[];
}

export function TikTokFeed({ storeId, initialVideos }: { storeId: string, initialVideos: VideoClip[] }) {
    const [videos] = useState<VideoClip[]>(initialVideos);
    const [activeVideoIndex, setActiveVideoIndex] = useState(0);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);
    const addToCart = useCartStore(s => s.addItem);
    const [showCartSuccess, setShowCartSuccess] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const [isPaused, setIsPaused] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const index = Number(entry.target.getAttribute('data-index'));
                    setActiveVideoIndex(index);
                    const video = videoRefs.current[index];
                    if (video) {
                        setIsPaused(false);
                        video.currentTime = 0;
                        video.play().catch(() => {
                            // Browser might block autoplay without user interaction
                            setIsPaused(true);
                        });
                    }
                } else {
                    const index = Number(entry.target.getAttribute('data-index'));
                    const video = videoRefs.current[index];
                    if (video) {
                        video.pause();
                    }
                }
            });
        }, {
            threshold: 0.6
        });

        videoRefs.current.forEach(ref => {
            if (ref) observer.observe(ref);
        });

        return () => observer.disconnect();
    }, [videos]);

    const togglePlayPause = (index: number) => {
        const video = videoRefs.current[index];
        if (!video) return;

        if (video.paused) {
            video.play().catch(console.error);
            setIsPaused(false);
        } else {
            video.pause();
            setIsPaused(true);
        }
    };

    const toggleMute = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsMuted(!isMuted);
        videoRefs.current.forEach(video => {
            if (video) video.muted = !isMuted;
        });
    };

    const handleAddToCart = (product: Product) => {
        addToCart({
            productId: product.id,
            name: product.name,
            price: Number(product.price),
            quantity: 1,
            image: product.images?.[0]
        });
        setSelectedProduct(null);
        setShowCartSuccess(true);
        setTimeout(() => setShowCartSuccess(false), 2000);
    };

    if (videos.length === 0) {
        return (
            <div className="flex h-[calc(100vh-64px)] items-center justify-center bg-black">
                <div className="text-center p-8 bg-gray-900 rounded-2xl max-w-sm w-full mx-4 border border-gray-800">
                    <Video className="w-12 h-12 mx-auto mb-4 text-gray-500" />
                    <p className="text-white text-lg font-medium">No videos available.</p>
                    <p className="text-gray-400 text-sm mt-2">Check back later for new content!</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-black flex justify-center w-full min-h-[calc(100vh-64px)]">
            <div
                ref={containerRef}
                className="h-[calc(100vh-64px)] w-full max-w-md bg-black overflow-y-scroll snap-y snap-mandatory hide-scrollbar relative shadow-2xl"
                style={{ scrollBehavior: 'smooth' }}
            >
                {showCartSuccess && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-white dark:bg-gray-800 text-black dark:text-white px-5 py-3 rounded-full shadow-2xl font-bold flex items-center gap-2 animate-fade-in-down border border-gray-200 dark:border-gray-700">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        Added to cart
                    </div>
                )}

                {videos.map((video, index) => (
                    <div
                        key={video.id}
                        className="relative h-full w-full snap-start snap-always flex items-center justify-center bg-black cursor-pointer group"
                        onClick={() => togglePlayPause(index)}
                    >
                        <video
                            ref={el => { videoRefs.current[index] = el }}
                            data-index={index}
                            className="h-full w-full object-cover transition-opacity duration-300"
                            src={video.url}
                            loop
                            muted={isMuted}
                            playsInline
                            autoPlay={index === 0}
                        />

                        {/* Play/Pause overlay icon */}
                        {isPaused && activeVideoIndex === index && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-20">
                                <div className="w-16 h-16 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white border border-white/20">
                                    <Play className="w-8 h-8 ml-1" />
                                </div>
                            </div>
                        )}

                        {/* Audio Toggle */}
                        <button
                            onClick={toggleMute}
                            className="absolute top-4 right-4 z-30 p-2.5 rounded-full bg-black/40 backdrop-blur-md text-white hover:bg-black/60 transition-colors border border-white/10"
                        >
                            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                        </button>

                        {/* Overlay UI */}
                        <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-32 pb-8 z-30 pointer-events-none">
                            <h2 className="text-white text-xl font-bold mb-4 drop-shadow-md leading-tight">{video.title}</h2>

                            {/* Tagged Products carousel */}
                            {video.products && video.products.length > 0 && (
                                <div className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar pointer-events-auto snap-x">
                                    {video.products.map(product => (
                                        <button
                                            key={product.id}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedProduct(product);
                                            }}
                                            className="flex-shrink-0 snap-center bg-white/10 backdrop-blur-xl rounded-xl p-2.5 flex items-center gap-3 border border-white/20 hover:bg-white/20 active:scale-95 transition-all w-56 text-left shadow-lg overflow-hidden group/card"
                                        >
                                            {product.images?.[0] ? (
                                                <img src={product.images[0]} alt={product.name} className="w-12 h-12 rounded-lg object-cover shadow-sm bg-white" />
                                            ) : (
                                                <div className="w-12 h-12 rounded-lg bg-white/20 flex items-center justify-center text-white/60 text-[10px] text-center font-bold tracking-wider uppercase">No Img</div>
                                            )}
                                            <div className="flex-1 min-w-0 pr-1">
                                                <p className="text-white text-sm font-semibold truncate leading-tight mb-1 group-hover/card:text-blue-100 transition-colors">{product.name}</p>
                                                <div className="flex items-center gap-1.5 line-clamp-1">
                                                    <span className="text-white font-bold tracking-tight">${Number(product.price).toFixed(2)}</span>
                                                    <span className="text-xs text-white/80 bg-white/20 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Shop</span>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {/* Product Modal */}
                {selectedProduct && (
                    <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
                        <div className="bg-white dark:bg-gray-900 w-full rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl transform transition-transform animate-slide-up sm:max-w-sm">
                            <div className="flex justify-between items-start mb-5">
                                <h3 className="font-bold text-xl dark:text-white line-clamp-2 pr-4 leading-tight">{selectedProduct.name}</h3>
                                <button onClick={() => setSelectedProduct(null)} className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 dark:text-gray-300 transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="flex gap-5 mb-8">
                                <div className="relative">
                                    {selectedProduct.images?.[0] ? (
                                        <img src={selectedProduct.images[0]} alt={selectedProduct.name} className="w-28 h-28 rounded-2xl object-cover shadow-md border border-gray-100 dark:border-gray-800" />
                                    ) : (
                                        <div className="w-28 h-28 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 font-medium">No Image</div>
                                    )}
                                </div>
                                <div className="flex flex-col justify-center">
                                    <p className="text-3xl font-black dark:text-white tracking-tight">${Number(selectedProduct.price).toFixed(2)}</p>
                                    <p className="text-sm text-green-600 dark:text-green-400 font-semibold mt-1">In Stock</p>
                                </div>
                            </div>

                            <button
                                onClick={() => handleAddToCart(selectedProduct)}
                                className="w-full py-3.5 bg-primary-600 hover:bg-primary-700 text-white font-bold flex items-center justify-center gap-2 rounded-xl text-lg shadow-lg shadow-primary-500/30 transition-all active:scale-[0.98]"
                            >
                                <ShoppingCart className="w-5 h-5" />
                                Add to Bag
                            </button>
                        </div>
                    </div>
                )}

                {/* CSS for hiding scrollbar and animations */}
                <style dangerouslySetInnerHTML={{
                    __html: `
          .hide-scrollbar::-webkit-scrollbar {
            display: none;
          }
          .hide-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
          @keyframes fade-in-down {
            0% { opacity: 0; transform: translate(-50%, -10px) scale(0.9); }
            100% { opacity: 1; transform: translate(-50%, 0) scale(1); }
          }
          .animate-fade-in-down {
            animation: fade-in-down 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
          }
          @keyframes slide-up {
             0% { opacity: 0; transform: translateY(100%); }
             100% { opacity: 1; transform: translateY(0); }
          }
          .animate-slide-up {
             animation: slide-up 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
        `}} />
            </div>
        </div>
    );
}

function Video({ className }: { className?: string }) {
    // Fallback icon for empty state
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="m22 8-6 4 6 4V8Z" />
            <rect x="2" y="6" width="14" height="12" rx="2" ry="2" />
        </svg>
    );
}
