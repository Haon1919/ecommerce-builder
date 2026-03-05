import { notFound } from 'next/navigation';
import Script from 'next/script';
import Image from 'next/image';
import { storeApi } from '@/lib/api';
import type { StoreInfo } from '@/types';
import { StoreNav } from '@/components/StoreNav';
import { ChatWidget } from '@/components/ChatWidget';

const isStaticExport = process.env.STATIC_EXPORT === 'true';

async function getStore(slug: string): Promise<StoreInfo | null> {
  if (isStaticExport) return null;
  try {
    return await storeApi.getBySlug(slug);
  } catch {
    return null;
  }
}

export default async function StoreLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ storeSlug: string }>;
}) {
  const { storeSlug } = await params;
  const store = await getStore(storeSlug);
  if (!store && !isStaticExport) notFound();

  // During static export, render a minimal wrapper (the demo page will provide its own content)
  if (!store) {
    return <>{children}</>;
  }

  return (
    <>
      {/* Dynamic CSS variable for primary color */}
      <style>{`:root { --primary: ${store.primaryColor}; }`}</style>

      {/* Load CSS framework based on store theme */}
      {store.theme === 'BOOTSTRAP' && (
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css"
        />
      )}
      {store.theme === 'BULMA' && (
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bulma@0.9.4/css/bulma.min.css" />
      )}
      {store.theme === 'PICO' && (
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@1/css/pico.min.css" />
      )}

      {/* Google Analytics */}
      {store.gaId && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${store.gaId}`} strategy="afterInteractive" />
          <Script id="ga-init" strategy="afterInteractive">{`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${store.gaId}', { page_path: window.location.pathname });
          `}</Script>
        </>
      )}

      <div className="min-h-screen flex flex-col">
        <StoreNav store={store} />
        <main className="flex-1">{children}</main>
        <footer className="bg-gray-900 text-white py-12 px-8">
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="font-bold text-lg mb-4">{store.name}</h3>
              <p className="text-gray-400 text-sm">{store.description ?? ''}</p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href={`/${storeSlug}/products`} className="hover:text-white">Products</a></li>
                <li><a href={`/${storeSlug}/contact`} className="hover:text-white">Contact Us</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Contact</h4>
              {store.settings?.contactEmail && (
                <p className="text-gray-400 text-sm">{store.settings.contactEmail}</p>
              )}
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-800 flex flex-col items-center justify-center space-y-4">
            <div className="text-gray-500 text-sm">
              © {new Date().getFullYear()} {store.name}. All rights reserved.
            </div>
            <a href="#" className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-800 hover:bg-gray-700 transition-colors">
              <span className="text-xs text-gray-400">Powered by</span>
              <Image src="/logo.png" alt="Ecommerce Builder Logo" width={20} height={20} className="object-contain" />
              <span className="text-sm font-semibold text-white tracking-wide">Ecommerce Builder</span>
            </a>
          </div>
        </footer>
      </div>

      {/* AI Chat Widget */}
      <ChatWidget storeId={store.id} storeName={store.name} storeSlug={storeSlug} />
    </>
  );
}
export function generateStaticParams() {
  return [{ storeSlug: 'demo' }];
}
