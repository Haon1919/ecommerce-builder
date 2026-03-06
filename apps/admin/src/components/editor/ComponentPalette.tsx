'use client';
import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { ComponentType } from '@/types';
import {
  Search, ChevronDown, ChevronRight,
  Layout, Columns2, Columns3, Minus, MoveVertical,
  Type, AlignLeft, ImageIcon, PlayCircle,
  Sparkles, Flag, MessageSquareQuote, HelpCircle,
  ShoppingBag, Star, GalleryHorizontalEnd,
  MousePointerClick, Mail, Newspaper,
} from 'lucide-react';

interface PaletteItem {
  type: ComponentType;
  label: string;
  icon: React.ReactNode;
  description: string;
  category: string;
  defaultProps: Record<string, unknown>;
}

export const PALETTE_ITEMS: PaletteItem[] = [
  // Layout
  { type: 'Section', label: 'Section', icon: <Layout className="w-4 h-4" />, description: 'Container with background', category: 'Layout', defaultProps: { backgroundColor: '#ffffff', paddingY: 'lg' } },
  { type: 'TwoColumns', label: '2 Columns', icon: <Columns2 className="w-4 h-4" />, description: 'Side-by-side layout', category: 'Layout', defaultProps: { gap: 'md' } },
  { type: 'ThreeColumns', label: '3 Columns', icon: <Columns3 className="w-4 h-4" />, description: 'Three-column grid', category: 'Layout', defaultProps: { gap: 'md' } },
  { type: 'Divider', label: 'Divider', icon: <Minus className="w-4 h-4" />, description: 'Horizontal line separator', category: 'Layout', defaultProps: { color: '#e5e7eb', thickness: 1 } },
  { type: 'Spacer', label: 'Spacer', icon: <MoveVertical className="w-4 h-4" />, description: 'Adjustable blank space', category: 'Layout', defaultProps: { height: 40 } },
  // Content
  { type: 'Heading', label: 'Heading', icon: <Type className="w-4 h-4" />, description: 'H1–H4 title text', category: 'Content', defaultProps: { text: 'Your Heading Here', level: 'h2', align: 'left', color: '#111827' } },
  { type: 'Text', label: 'Text Block', icon: <AlignLeft className="w-4 h-4" />, description: 'Paragraph or rich text', category: 'Content', defaultProps: { text: 'Add your text content here. Click to edit.', align: 'left', color: '#374151' } },
  { type: 'Image', label: 'Image', icon: <ImageIcon className="w-4 h-4" />, description: 'Photo or graphic', category: 'Content', defaultProps: { src: '', alt: 'Image', width: '100%', borderRadius: 0 } },
  { type: 'Video', label: 'Video', icon: <PlayCircle className="w-4 h-4" />, description: 'Embedded video player', category: 'Content', defaultProps: { url: '', autoplay: false } },
  // Marketing
  { type: 'HeroSection', label: 'Hero Section', icon: <Sparkles className="w-4 h-4" />, description: 'Full-width hero banner', category: 'Marketing', defaultProps: { title: 'Welcome to Our Store', subtitle: 'Discover amazing products', ctaText: 'Shop Now', ctaLink: '/products', backgroundColor: '#6366f1', textColor: '#ffffff' } },
  { type: 'Banner', label: 'Banner', icon: <Flag className="w-4 h-4" />, description: 'Promotional announcement', category: 'Marketing', defaultProps: { text: 'Sale! Up to 50% off — Limited time offer', backgroundColor: '#fef3c7', textColor: '#92400e', link: '/products' } },
  { type: 'Testimonial', label: 'Testimonial', icon: <MessageSquareQuote className="w-4 h-4" />, description: 'Customer review quote', category: 'Marketing', defaultProps: { quote: 'This product is amazing!', author: 'Happy Customer', rating: 5 } },
  { type: 'FAQ', label: 'FAQ', icon: <HelpCircle className="w-4 h-4" />, description: 'Accordion Q&A section', category: 'Marketing', defaultProps: { items: [{ question: 'What is your return policy?', answer: '30 days, hassle-free returns.' }] } },
  // Commerce
  { type: 'ProductGrid', label: 'Product Grid', icon: <ShoppingBag className="w-4 h-4" />, description: 'Multi-column product cards', category: 'Commerce', defaultProps: { columns: 3, showFilters: true, limit: 12 } },
  { type: 'FeaturedProducts', label: 'Featured Products', icon: <Star className="w-4 h-4" />, description: 'Curated product showcase', category: 'Commerce', defaultProps: { title: 'Featured Products', count: 4 } },
  { type: 'ProductCarousel', label: 'Product Carousel', icon: <GalleryHorizontalEnd className="w-4 h-4" />, description: 'Scrolling product strip', category: 'Commerce', defaultProps: { title: 'You Might Also Like', count: 6 } },
  // Interactive
  { type: 'Button', label: 'Button', icon: <MousePointerClick className="w-4 h-4" />, description: 'Call-to-action button', category: 'Interactive', defaultProps: { text: 'Click Me', link: '#', variant: 'primary', size: 'md' } },
  { type: 'ContactForm', label: 'Contact Form', icon: <Mail className="w-4 h-4" />, description: 'Email contact fields', category: 'Interactive', defaultProps: { title: 'Get in Touch', subtitle: 'We\'d love to hear from you' } },
  { type: 'NewsletterForm', label: 'Newsletter', icon: <Newspaper className="w-4 h-4" />, description: 'Email opt-in capture', category: 'Interactive', defaultProps: { title: 'Subscribe to Our Newsletter', placeholder: 'Enter your email' } },
];

const CATEGORY_META: Record<string, { icon: React.ReactNode; gradient: string }> = {
  Layout: { icon: <Layout className="w-3.5 h-3.5" />, gradient: 'from-blue-500 to-cyan-500' },
  Content: { icon: <Type className="w-3.5 h-3.5" />, gradient: 'from-emerald-500 to-teal-500' },
  Marketing: { icon: <Sparkles className="w-3.5 h-3.5" />, gradient: 'from-amber-500 to-orange-500' },
  Commerce: { icon: <ShoppingBag className="w-3.5 h-3.5" />, gradient: 'from-violet-500 to-purple-500' },
  Interactive: { icon: <MousePointerClick className="w-3.5 h-3.5" />, gradient: 'from-rose-500 to-pink-500' },
};

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
      className={`group/item flex items-center gap-3 p-2.5 rounded-xl border border-gray-100 bg-white cursor-grab text-sm
        hover:border-primary-300 hover:shadow-md hover:shadow-primary-100/50 hover:-translate-y-0.5
        active:scale-[0.98] active:shadow-sm
        transition-all duration-200 select-none ${
        isDragging ? 'opacity-40 shadow-xl scale-105 ring-2 ring-primary-400' : ''
      }`}
      style={{ transform: CSS.Translate.toString(transform) }}
    >
      <div className={`flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br ${CATEGORY_META[item.category]?.gradient ?? 'from-gray-400 to-gray-500'} text-white flex items-center justify-center shadow-sm`}>
        {item.icon}
      </div>
      <div className="min-w-0 flex-1">
        <span className="text-gray-800 font-medium text-[13px] block truncate">{item.label}</span>
        <span className="text-[11px] text-gray-400 block truncate group-hover/item:text-gray-500 transition-colors">{item.description}</span>
      </div>
    </div>
  );
}

export function ComponentPalette() {
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const filteredItems = search.trim()
    ? PALETTE_ITEMS.filter((i) =>
        i.label.toLowerCase().includes(search.toLowerCase()) ||
        i.description.toLowerCase().includes(search.toLowerCase()) ||
        i.type.toLowerCase().includes(search.toLowerCase())
      )
    : PALETTE_ITEMS;

  const toggleCategory = (cat: string) => {
    setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  return (
    <div className="w-72 bg-gradient-to-b from-gray-50 to-white border-r border-gray-200 overflow-y-auto flex-shrink-0 flex flex-col">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 bg-white/80 backdrop-blur-sm sticky top-0 z-10 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">Components</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">{PALETTE_ITEMS.length} elements available</p>
          </div>
        </div>
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search components…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-xs bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:bg-white transition-all placeholder:text-gray-400"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Component List */}
      <div className="flex-1 p-3 space-y-1">
        {search.trim() ? (
          // Flat search results
          filteredItems.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-xs font-medium">No components found</p>
              <p className="text-[11px] mt-0.5">Try a different search term</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {filteredItems.map((item) => (
                <DraggablePaletteItem key={item.type} item={item} />
              ))}
            </div>
          )
        ) : (
          // Grouped by category
          categories.map((cat) => {
            const items = filteredItems.filter((i) => i.category === cat);
            if (items.length === 0) return null;
            const isCollapsed = collapsed[cat] ?? false;
            const meta = CATEGORY_META[cat];
            return (
              <div key={cat} className="mb-2">
                <button
                  onClick={() => toggleCategory(cat)}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-100/80 transition-colors group/cat"
                >
                  <div className={`w-5 h-5 rounded-md bg-gradient-to-br ${meta?.gradient ?? 'from-gray-400 to-gray-500'} text-white flex items-center justify-center`}>
                    {meta?.icon}
                  </div>
                  <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider flex-1 text-left">{cat}</span>
                  <span className="text-[10px] text-gray-400 tabular-nums mr-1">{items.length}</span>
                  {isCollapsed ? (
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400 transition-transform" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-gray-400 transition-transform" />
                  )}
                </button>
                {!isCollapsed && (
                  <div className="mt-1 ml-1 space-y-1.5 animate-fade-in">
                    {items.map((item) => (
                      <DraggablePaletteItem key={item.type} item={item} />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer hint */}
      <div className="px-4 py-3 border-t border-gray-100 bg-gradient-to-t from-gray-50 to-transparent">
        <p className="text-[10px] text-gray-400 text-center">
          Drag any component onto the canvas
        </p>
      </div>
    </div>
  );
}
