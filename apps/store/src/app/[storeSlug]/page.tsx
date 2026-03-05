import { storeApi, productsApi, experimentsApi } from '@/lib/api';
import { PageRenderer } from '@/components/PageRenderer';
import type { StoreInfo, PageComponent } from '@/types';

const isStaticExport = process.env.STATIC_EXPORT === 'true';

export default async function StoreLanding({ params }: { params: Promise<{ storeSlug: string }> }) {
  const { storeSlug } = await params;

  // During static export (GitHub Pages), skip all API calls entirely
  // and render a static demo page instead
  if (isStaticExport) {
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

  let store: StoreInfo = {} as StoreInfo;
  let page: { layout: PageComponent[] } = { layout: [] };
  let activeExperiments = [];
  let products: any[] = [];

  try {
    [store, page] = await Promise.all([
      storeApi.getBySlug(storeSlug),
      storeApi.getPage((await storeApi.getBySlug(storeSlug)).id, ''),
    ]);
    try {
      activeExperiments = await experimentsApi.getActive(store.id);
    } catch { }
  } catch {
    const { notFound } = await import('next/navigation');
    notFound();
  }

  // A/B Testing
  const expMatch = activeExperiments.find((e: any) => e.name === '' || e.name === 'landing');
  if (expMatch && expMatch.variants?.length) {
    const roll = Math.random() * 100;
    let curr = 0;
    let chosenVar = expMatch.variants[0];
    for (const v of expMatch.variants) {
      curr += v.weight;
      if (roll <= curr) {
        chosenVar = v;
        break;
      }
    }
    if (chosenVar && Array.isArray(chosenVar.layout)) {
      page.layout = chosenVar.layout;
      experimentsApi.trackView(store.id, expMatch.id, chosenVar.id).catch(() => { });
    }
  }

  try {
    const data = await productsApi.list(store.id, { limit: '50' });
    products = data.products;
  } catch { }

  return (
    <PageRenderer
      layout={Array.isArray(page.layout) ? page.layout : []}
      storeSlug={storeSlug}
      products={products}
    />
  );
}

export function generateStaticParams() {
  return [{ storeSlug: 'demo' }];
}
