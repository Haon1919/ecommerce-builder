'use client';
import { useState } from 'react';
import { Box } from 'lucide-react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': any;
    }
  }
}

interface Props {
  images: string[];
  modelUrl: string | null;
  arEnabled: boolean;
  productName: string;
}

export function ProductGallery({ images, modelUrl, arEnabled, productName }: Props) {
  const [selectedImage, setSelectedImage] = useState(0);
  const [show3D, setShow3D] = useState(false);

  return (
    <div>
      <div className="aspect-square rounded-2xl overflow-hidden bg-gray-100 mb-4 border border-gray-100 relative">
        {show3D && modelUrl ? (
          <model-viewer
            src={modelUrl}
            ar
            auto-rotate
            camera-controls
            style={{ width: '100%', height: '100%', backgroundColor: '#f3f4f6' }}
          />
        ) : images?.[selectedImage] ? (
          <img
            src={images[selectedImage]}
            alt={productName}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-8xl">🛍</div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {arEnabled && modelUrl && (
          <div className="flex gap-2 bg-gray-50 p-1 rounded-xl">
            <button
              onClick={() => setShow3D(false)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                !show3D ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              2D Images
            </button>
            <button
              onClick={() => setShow3D(true)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                show3D ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Box className="w-4 h-4" /> 3D & AR
            </button>
          </div>
        )}

        {!show3D && images?.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => setSelectedImage(i)}
                className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 ${
                  selectedImage === i ? 'border-primary shadow-md' : 'border-gray-200 opacity-70 hover:opacity-100'
                }`}
              >
                <img src={img} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
