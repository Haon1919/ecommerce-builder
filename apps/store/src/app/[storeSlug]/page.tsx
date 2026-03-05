import { notFound } from 'next/navigation';
import { storeApi, productsApi, experimentsApi } from '@/lib/api';
import { PageRenderer } from '@/components/PageRenderer';
import type { StoreInfo, PageComponent } from '@/types';

const isStaticExport = process.env.STATIC_EXPORT === 'true';

export default async function StoreLanding({ params }: { params: Promise<{ storeSlug: string }> }) {
  const { storeSlug } = await params;

  // During static export (GitHub Pages), render a demo storefront
  // without making any API calls
  if (isStaticExport) {
    return <PageRenderer layout={[]} storeSlug={storeSlug} products={[]} />;
  }

  let store: StoreInfo, page: { layout: PageComponent[] };
  let activeExperiments = [];

  try {
    [store, page] = await Promise.all([
      storeApi.getBySlug(storeSlug),
      storeApi.getPage((await storeApi.getBySlug(storeSlug)).id, ''),
    ]);
    try {
      activeExperiments = await experimentsApi.getActive(store.id);
    } catch { }
  } catch {
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

  let products = [];
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
