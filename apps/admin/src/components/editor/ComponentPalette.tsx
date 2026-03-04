'use client';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { ComponentType } from '@/types';

interface PaletteItem {
  type: ComponentType;
  label: string;
  icon: string;
  category: string;
  defaultProps: Record<string, unknown>;
}

export const PALETTE_ITEMS: PaletteItem[] = [
  // Layout
  { type: 'Section', label: 'Section', icon: '▭', category: 'Layout', defaultProps: { backgroundColor: '#ffffff', paddingY: 'lg' } },
  { type: 'TwoColumns', label: '2 Columns', icon: '⚏', category: 'Layout', defaultProps: { gap: 'md' } },
  { type: 'ThreeColumns', label: '3 Columns', icon: '⁞', category: 'Layout', defaultProps: { gap: 'md' } },
  { type: 'Divider', label: 'Divider', icon: '─', category: 'Layout', defaultProps: { color: '#e5e7eb', thickness: 1 } },
  { type: 'Spacer', label: 'Spacer', icon: '↕', category: 'Layout', defaultProps: { height: 40 } },
  // Content
  { type: 'Heading', label: 'Heading', icon: 'H', category: 'Content', defaultProps: { text: 'Your Heading Here', level: 'h2', align: 'left', color: '#111827' } },
  { type: 'Text', label: 'Text Block', icon: 'P', category: 'Content', defaultProps: { text: 'Add your text content here. Click to edit.', align: 'left', color: '#374151' } },
  { type: 'Image', label: 'Image', icon: '🖼', category: 'Content', defaultProps: { src: '', alt: 'Image', width: '100%', borderRadius: 0 } },
  { type: 'Video', label: 'Video', icon: '▶', category: 'Content', defaultProps: { url: '', autoplay: false } },
  // Marketing
  { type: 'HeroSection', label: 'Hero Section', icon: '⊞', category: 'Marketing', defaultProps: { title: 'Welcome to Our Store', subtitle: 'Discover amazing products', ctaText: 'Shop Now', ctaLink: '/products', backgroundColor: '#6366f1', textColor: '#ffffff' } },
  { type: 'Banner', label: 'Banner', icon: '📢', category: 'Marketing', defaultProps: { text: 'Sale! Up to 50% off — Limited time offer', backgroundColor: '#fef3c7', textColor: '#92400e', link: '/products' } },
  { type: 'Testimonial', label: 'Testimonial', icon: '💬', category: 'Marketing', defaultProps: { quote: 'This product is amazing!', author: 'Happy Customer', rating: 5 } },
  { type: 'FAQ', label: 'FAQ', icon: '❓', category: 'Marketing', defaultProps: { items: [{ question: 'What is your return policy?', answer: '30 days, hassle-free returns.' }] } },
  // Commerce
  { type: 'ProductGrid', label: 'Product Grid', icon: '🛍', category: 'Commerce', defaultProps: { columns: 3, showFilters: true, limit: 12 } },
  { type: 'FeaturedProducts', label: 'Featured Products', icon: '⭐', category: 'Commerce', defaultProps: { title: 'Featured Products', count: 4 } },
  { type: 'ProductCarousel', label: 'Product Carousel', icon: '🎠', category: 'Commerce', defaultProps: { title: 'You Might Also Like', count: 6 } },
  // Interactive
  { type: 'Button', label: 'Button', icon: '○', category: 'Interactive', defaultProps: { text: 'Click Me', link: '#', variant: 'primary', size: 'md' } },
  { type: 'ContactForm', label: 'Contact Form', icon: '📋', category: 'Interactive', defaultProps: { title: 'Get in Touch', subtitle: 'We\'d love to hear from you' } },
  { type: 'NewsletterForm', label: 'Newsletter', icon: '📧', category: 'Interactive', defaultProps: { title: 'Subscribe to Our Newsletter', placeholder: 'Enter your email' } },
];

const categories = ['Layout', 'Content', 'Marketing', 'Commerce', 'Interactive'];

function DraggablePaletteItem({ item }: { item: PaletteItem }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `palette-${item.type}`,
    data: { fromPalette: true, type: item.type, defaultProps: item.defaultProps },
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`flex items-center gap-2 p-2.5 rounded-lg border border-gray-200 bg-white cursor-grab text-sm hover:border-primary-400 hover:bg-primary-50 transition-all select-none ${
        isDragging ? 'opacity-50 shadow-lg scale-105' : ''
      }`}
      style={{ transform: CSS.Translate.toString(transform) }}
    >
      <span className="text-base w-5 text-center flex-shrink-0">{item.icon}</span>
      <span className="text-gray-700 font-medium truncate">{item.label}</span>
    </div>
  );
}

export function ComponentPalette() {
  return (
    <div className="w-64 bg-gray-50 border-r border-gray-200 overflow-y-auto flex-shrink-0">
      <div className="px-4 py-3 border-b border-gray-200 bg-white sticky top-0">
        <h3 className="font-semibold text-gray-900 text-sm">Components</h3>
        <p className="text-xs text-gray-500 mt-0.5">Drag & drop onto canvas</p>
      </div>

      <div className="p-3 space-y-4">
        {categories.map((cat) => {
          const items = PALETTE_ITEMS.filter((i) => i.category === cat);
          return (
            <div key={cat}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">{cat}</p>
              <div className="grid grid-cols-1 gap-1.5">
                {items.map((item) => (
                  <DraggablePaletteItem key={item.type} item={item} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
