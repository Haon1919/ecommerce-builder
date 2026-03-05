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
    const demoLayout: PageComponent[] = [
      {
        id: 'hero-1', type: 'HeroSection', order: 0,
        props: {
          title: 'Welcome to the Demo Store',
          subtitle: 'This is a static preview of an e-commerce storefront built with the page builder. Deploy the API to see live data.',
          backgroundColor: '#6366f1',
          textColor: '#ffffff',
          ctaText: 'Browse Products',
          ctaLink: `/${storeSlug}/products`,
        }
      },
      {
        id: 'heading-1', type: 'Heading', order: 1,
        props: { text: 'Featured Products', level: 'h2', align: 'center' }
      },
      {
        id: 'grid-1', type: 'ProductGrid', order: 2,
        props: { columns: '3', limit: 6 }
      },
      {
        id: 'spacer-1', type: 'Spacer', order: 3,
        props: { height: 40 }
      },
      {
        id: 'newsletter-1', type: 'NewsletterForm', order: 4,
        props: { title: 'Stay Updated', placeholder: 'Enter your email' }
      },
    ];
    return <PageRenderer layout={demoLayout} storeSlug={storeSlug} products={[]} />;
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
