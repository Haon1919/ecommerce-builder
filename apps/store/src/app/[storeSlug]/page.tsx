import { notFound } from 'next/navigation';
import { storeApi, productsApi, experimentsApi } from '@/lib/api';
import { PageRenderer } from '@/components/PageRenderer';
import type { StoreInfo, PageComponent } from '@/types';

export default async function StoreLanding({ params }: { params: Promise<{ storeSlug: string }> }) {
  const { storeSlug } = await params;
  let store: StoreInfo, page: { layout: PageComponent[] };
  let activeExperiments = [];

  try {
    [store, page] = await Promise.all([
      storeApi.getBySlug(storeSlug),
      storeApi.getPage((await storeApi.getBySlug(storeSlug)).id, ''),
    ]);
    // Fetch experiments independently so it doesn't fail the whole page if it errors
    try {
      activeExperiments = await experimentsApi.getActive(store.id);
    } catch { }
  } catch {
    notFound();
  }

  // A/B Testing: Override page layout if an active experiment targets this page
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
