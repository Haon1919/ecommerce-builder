'use client';
/**
 * PageRenderer: converts page builder JSON layout into real React components.
 * This is the "runtime" counterpart to the editor canvas.
 */
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { PageComponent } from '../types';

interface Props {
  layout: PageComponent[];
  storeSlug: string;
  products?: Product[];
}

interface Product {
  id: string;
  name: string;
  price: number;
  comparePrice?: number;
  images: string[];
  stock: number;
  category?: string;
}

function ProductCard({ product, storeSlug }: { product: Product; storeSlug: string }) {
  return (
    <Link href={`/${storeSlug}/products/${product.id}`} className="group">
      <div className="bg-white rounded-xl overflow-hidden border border-gray-100 hover:shadow-md transition-shadow">
        <div className="aspect-square overflow-hidden bg-gray-100">
          {product.images?.[0] ? (
            <img
              src={product.images[0]}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300 text-4xl">🛍</div>
          )}
        </div>
        <div className="p-4">
          <h3 className="font-medium text-gray-900 line-clamp-2 group-hover:text-primary transition-colors">{product.name}</h3>
          <div className="flex items-center gap-2 mt-2">
            <span className="font-bold text-gray-900">${Number(product.price).toFixed(2)}</span>
            {product.comparePrice && (
              <span className="text-sm text-gray-400 line-through">${Number(product.comparePrice).toFixed(2)}</span>
            )}
          </div>
          {product.stock === 0 && (
            <span className="text-xs text-red-500 mt-1 block">Out of stock</span>
          )}
        </div>
      </div>
    </Link>
  );
}

function ComponentRenderer({ component, storeSlug, products = [] }: { component: PageComponent; storeSlug: string; products: Product[] }) {
  const p = component.props;

  switch (component.type) {
    case 'HeroSection':
      return (
        <section
          className="relative py-24 px-8 text-center"
          style={{
            backgroundColor: (p.backgroundColor as string) ?? '#6366f1',
            backgroundImage: p.backgroundImage ? `url(${p.backgroundImage})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            color: (p.textColor as string) ?? '#ffffff',
          }}
        >
          {Boolean(p.backgroundImage) && <div className="absolute inset-0 bg-black/40" />}
          <div className="relative z-10 max-w-3xl mx-auto">
            <h1 className="text-5xl font-bold mb-4 leading-tight">{(p.title as string) ?? 'Welcome'}</h1>
            <p className="text-xl opacity-90 mb-8">{(p.subtitle as string) ?? ''}</p>
            {Boolean(p.ctaText) && (
              <Link href={(p.ctaLink as string) ?? '/products'} className="inline-block bg-white text-gray-900 font-semibold px-8 py-3.5 rounded-full hover:bg-gray-100 transition-colors text-lg">
                {p.ctaText as string}
              </Link>
            )}
          </div>
        </section>
      );

    case 'Heading': {
      const Tag = ((p.level as string) ?? 'h2') as keyof React.JSX.IntrinsicElements;
      const sizes: Record<string, string> = { h1: 'text-4xl', h2: 'text-3xl', h3: 'text-2xl', h4: 'text-xl' };
      return (
        <Tag
          className={`font-bold ${sizes[(p.level as string) ?? 'h2']} py-6 px-4`}
          style={{ textAlign: (p.align as 'left' | 'center' | 'right') ?? 'left', color: (p.color as string) ?? '#111827' }}
        >
          {(p.text as string) ?? ''}
        </Tag>
      );
    }

    case 'Text':
      return (
        <p
          className="text-lg leading-relaxed px-4 py-4 max-w-3xl"
          style={{ textAlign: (p.align as 'left' | 'center' | 'right') ?? 'left', color: (p.color as string) ?? '#374151' }}
        >
          {(p.text as string) ?? ''}
        </p>
      );

    case 'Image':
      return p.src ? (
        <div className="px-4 py-4">
          <img
            src={p.src as string}
            alt={(p.alt as string) ?? ''}
            style={{ width: (p.width as string) ?? '100%', borderRadius: `${(p.borderRadius as number) ?? 0}px` }}
            className="object-cover"
          />
        </div>
      ) : null;

    case 'Button': {
      const btnStyles: Record<string, string> = {
        primary: 'bg-primary text-white hover:opacity-90',
        secondary: 'bg-gray-100 text-gray-800 hover:bg-gray-200',
        outline: 'border-2 border-current text-primary',
        ghost: 'text-primary underline',
      };
      const sizePadding: Record<string, string> = { sm: 'px-4 py-2 text-sm', md: 'px-6 py-3', lg: 'px-8 py-4 text-lg' };
      return (
        <div className="px-4 py-4">
          <Link
            href={(p.link as string) ?? '#'}
            className={`inline-block rounded-lg font-semibold transition-all ${btnStyles[(p.variant as string) ?? 'primary']} ${sizePadding[(p.size as string) ?? 'md']}`}
          >
            {(p.text as string) ?? 'Button'}
          </Link>
        </div>
      );
    }

    case 'Banner':
      return (
        <div
          className="w-full py-3 px-8 text-center text-sm font-semibold"
          style={{ backgroundColor: (p.backgroundColor as string) ?? '#fef3c7', color: (p.textColor as string) ?? '#92400e' }}
        >
          {p.link ? (
            <Link href={p.link as string} className="hover:underline">{(p.text as string) ?? ''}</Link>
          ) : (
            <span>{(p.text as string) ?? ''}</span>
          )}
        </div>
      );

    case 'ProductGrid':
      const gridCols: Record<string, string> = { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' };
      const limit = (p.limit as number) ?? 12;
      const categoryFilter = p.category as string | undefined;
      const filteredProducts = products
        .filter((prod) => !categoryFilter || prod.category === categoryFilter)
        .slice(0, limit);
      return (
        <section className="px-4 py-8">
          <div className={`grid ${gridCols[(p.columns as string) ?? '3'] ?? 'grid-cols-3'} gap-6`}>
            {filteredProducts.map((prod) => (
              <ProductCard key={prod.id} product={prod} storeSlug={storeSlug} />
            ))}
          </div>
        </section>
      );

    case 'FeaturedProducts': {
      const featuredProds = products.filter((p) => (p as unknown as { featured?: boolean }).featured ?? false).slice(0, (p.count as number) ?? 4);
      const showProds = featuredProds.length > 0 ? featuredProds : products.slice(0, (p.count as number) ?? 4);
      return (
        <section className="px-4 py-12">
          <h2 className="text-3xl font-bold text-center mb-8">{(p.title as string) ?? 'Featured Products'}</h2>
          <div className={`grid grid-cols-${Math.min(showProds.length, 4)} gap-6`}>
            {showProds.map((prod) => <ProductCard key={prod.id} product={prod} storeSlug={storeSlug} />)}
          </div>
        </section>
      );
    }

    case 'Testimonial':
      return (
        <section className="px-8 py-12 bg-gray-50 text-center">
          <div className="max-w-2xl mx-auto">
            <div className="text-yellow-400 text-2xl mb-4">{'★'.repeat((p.rating as number) ?? 5)}</div>
            <blockquote className="text-2xl text-gray-700 italic mb-6">&ldquo;{(p.quote as string) ?? ''}&rdquo;</blockquote>
            <p className="font-semibold text-gray-900">— {(p.author as string) ?? ''}</p>
          </div>
        </section>
      );

    case 'FAQ': {
      const items = (p.items as Array<{ question: string; answer: string }>) ?? [];
      return (
        <section className="px-4 py-12 max-w-2xl mx-auto">
          <div className="space-y-4">
            {items.map((item, i) => (
              <details key={i} className="border border-gray-200 rounded-xl overflow-hidden">
                <summary className="px-6 py-4 font-medium text-gray-900 cursor-pointer hover:bg-gray-50">{item.question}</summary>
                <div className="px-6 pb-4 text-gray-600">{item.answer}</div>
              </details>
            ))}
          </div>
        </section>
      );
    }

    case 'Spacer':
      return <div style={{ height: `${(p.height as number) ?? 40}px` }} />;

    case 'Divider':
      return (
        <div className="px-4 py-2">
          <hr style={{ borderColor: (p.color as string) ?? '#e5e7eb', borderTopWidth: `${(p.thickness as number) ?? 1}px` }} />
        </div>
      );

    case 'ContactForm':
      return (
        <section className="px-4 py-12 max-w-lg mx-auto">
          <h2 className="text-3xl font-bold mb-2">{(p.title as string) ?? 'Contact Us'}</h2>
          {Boolean(p.subtitle) && <p className="text-gray-500 mb-6">{p.subtitle as string}</p>}
          <Link href={`/${storeSlug}/contact`} className="btn-primary inline-block">
            Send us a message
          </Link>
        </section>
      );

    case 'NewsletterForm':
      return (
        <section className="px-4 py-12 bg-gray-50 text-center">
          <h2 className="text-2xl font-bold mb-2">{(p.title as string) ?? 'Stay Updated'}</h2>
          <div className="flex gap-2 max-w-md mx-auto mt-4">
            <input type="email" placeholder={(p.placeholder as string) ?? 'Enter your email'} className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            <button className="bg-primary text-white px-6 py-2.5 rounded-lg text-sm font-medium">Subscribe</button>
          </div>
        </section>
      );

    default:
      return null;
  }
}

export function PageRenderer({ layout, storeSlug, products = [] }: Props) {
  const sorted = [...layout].sort((a, b) => a.order - b.order);
  return (
    <div>
      {sorted.map((component) => (
        <ComponentRenderer key={component.id} component={component} storeSlug={storeSlug} products={products} />
      ))}
    </div>
  );
}
