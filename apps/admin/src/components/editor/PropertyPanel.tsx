'use client';
import { useState, useEffect } from 'react';
import type { PageComponent } from '@/types';
import {
  X, Trash2, Copy, Palette, Type as TypeIcon,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Link as LinkIcon, Image as ImageIcon, Hash,
  Sparkles, Flag, MessageSquareQuote, HelpCircle,
  ShoppingBag, Star, GalleryHorizontalEnd,
  MousePointerClick, Mail, Newspaper,
  Layout, Columns2, Columns3, Minus, MoveVertical, PlayCircle,
} from 'lucide-react';

interface Props {
  component: PageComponent;
  onChange: (id: string, props: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

type FieldDef = {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'color' | 'number' | 'select' | 'boolean' | 'url' | 'alignment';
  options?: string[];
  tab?: 'content' | 'style';
  placeholder?: string;
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  HeroSection: <Sparkles className="w-4 h-4" />,
  Heading: <TypeIcon className="w-4 h-4" />,
  Text: <AlignLeft className="w-4 h-4" />,
  Image: <ImageIcon className="w-4 h-4" />,
  Video: <PlayCircle className="w-4 h-4" />,
  Button: <MousePointerClick className="w-4 h-4" />,
  Banner: <Flag className="w-4 h-4" />,
  Testimonial: <MessageSquareQuote className="w-4 h-4" />,
  FAQ: <HelpCircle className="w-4 h-4" />,
  ProductGrid: <ShoppingBag className="w-4 h-4" />,
  FeaturedProducts: <Star className="w-4 h-4" />,
  ProductCarousel: <GalleryHorizontalEnd className="w-4 h-4" />,
  ContactForm: <Mail className="w-4 h-4" />,
  NewsletterForm: <Newspaper className="w-4 h-4" />,
  Section: <Layout className="w-4 h-4" />,
  TwoColumns: <Columns2 className="w-4 h-4" />,
  ThreeColumns: <Columns3 className="w-4 h-4" />,
  Spacer: <MoveVertical className="w-4 h-4" />,
  Divider: <Minus className="w-4 h-4" />,
};

const TYPE_COLORS: Record<string, string> = {
  HeroSection: 'from-indigo-500 to-purple-500',
  Heading: 'from-emerald-500 to-teal-500',
  Text: 'from-teal-500 to-cyan-500',
  Image: 'from-cyan-500 to-sky-500',
  Video: 'from-sky-500 to-blue-500',
  Button: 'from-rose-500 to-pink-500',
  Banner: 'from-amber-500 to-orange-500',
  Testimonial: 'from-orange-500 to-red-400',
  FAQ: 'from-yellow-500 to-amber-500',
  ProductGrid: 'from-violet-500 to-purple-500',
  FeaturedProducts: 'from-purple-500 to-fuchsia-500',
  ProductCarousel: 'from-fuchsia-500 to-pink-500',
  ContactForm: 'from-pink-500 to-rose-500',
  NewsletterForm: 'from-red-400 to-orange-400',
  Section: 'from-blue-500 to-indigo-500',
  TwoColumns: 'from-blue-400 to-cyan-400',
  ThreeColumns: 'from-blue-300 to-sky-400',
  Spacer: 'from-gray-400 to-gray-500',
  Divider: 'from-gray-500 to-gray-600',
};

const TYPE_DESCRIPTIONS: Record<string, string> = {
  HeroSection: 'Full-width hero banner with background, CTA button, and overlay support.',
  Heading: 'Title text block with adjustable heading level and alignment.',
  Text: 'Body text paragraph with rich alignment and color options.',
  Image: 'Display an image with optional border radius and sizing.',
  Video: 'Embedded video player supporting external URLs.',
  Button: 'Call-to-action button with multiple visual styles.',
  Banner: 'Thin promotional bar ideal for announcements and sales.',
  Testimonial: 'Customer quote with star rating and author attribution.',
  FAQ: 'Expandable accordion for frequently asked questions.',
  ProductGrid: 'Dynamic grid of product cards from your catalog.',
  FeaturedProducts: 'Curated showcase of highlighted products.',
  ProductCarousel: 'Horizontally scrolling product strip.',
  ContactForm: 'Pre-built contact form with name, email, and message fields.',
  NewsletterForm: 'Email subscription opt-in with customizable CTA.',
  Section: 'Container wrapper with background color and padding.',
  TwoColumns: 'Two-column side-by-side layout.',
  ThreeColumns: 'Three-column grid layout.',
  Spacer: 'Adjustable vertical blank space.',
  Divider: 'Horizontal line separator.',
};

const COMPONENT_FIELDS: Record<string, FieldDef[]> = {
  HeroSection: [
    { key: 'title', label: 'Title', type: 'text', tab: 'content' },
    { key: 'subtitle', label: 'Subtitle', type: 'text', tab: 'content' },
    { key: 'ctaText', label: 'Button Text', type: 'text', tab: 'content' },
    { key: 'ctaLink', label: 'Button Link', type: 'url', tab: 'content', placeholder: '/products' },
    { key: 'backgroundColor', label: 'Background', type: 'color', tab: 'style' },
    { key: 'backgroundImage', label: 'Background Image', type: 'url', tab: 'style', placeholder: 'https://...' },
    { key: 'textColor', label: 'Text Color', type: 'color', tab: 'style' },
  ],
  Heading: [
    { key: 'text', label: 'Text', type: 'text', tab: 'content' },
    { key: 'level', label: 'Heading Level', type: 'select', options: ['h1', 'h2', 'h3', 'h4'], tab: 'content' },
    { key: 'align', label: 'Alignment', type: 'alignment', options: ['left', 'center', 'right'], tab: 'style' },
    { key: 'color', label: 'Color', type: 'color', tab: 'style' },
  ],
  Text: [
    { key: 'text', label: 'Content', type: 'textarea', tab: 'content' },
    { key: 'align', label: 'Alignment', type: 'alignment', options: ['left', 'center', 'right', 'justify'], tab: 'style' },
    { key: 'color', label: 'Color', type: 'color', tab: 'style' },
  ],
  Image: [
    { key: 'src', label: 'Image URL', type: 'url', tab: 'content', placeholder: 'https://...' },
    { key: 'alt', label: 'Alt Text', type: 'text', tab: 'content' },
    { key: 'width', label: 'Width', type: 'text', tab: 'style', placeholder: '100% or 400px' },
    { key: 'borderRadius', label: 'Corner Radius', type: 'number', tab: 'style' },
  ],
  Button: [
    { key: 'text', label: 'Label', type: 'text', tab: 'content' },
    { key: 'link', label: 'Link URL', type: 'url', tab: 'content', placeholder: '/products' },
    { key: 'variant', label: 'Style', type: 'select', options: ['primary', 'secondary', 'outline', 'ghost'], tab: 'style' },
    { key: 'size', label: 'Size', type: 'select', options: ['sm', 'md', 'lg'], tab: 'style' },
  ],
  Banner: [
    { key: 'text', label: 'Banner Text', type: 'text', tab: 'content' },
    { key: 'link', label: 'Link (optional)', type: 'url', tab: 'content' },
    { key: 'backgroundColor', label: 'Background', type: 'color', tab: 'style' },
    { key: 'textColor', label: 'Text Color', type: 'color', tab: 'style' },
  ],
  ProductGrid: [
    { key: 'columns', label: 'Columns', type: 'select', options: ['2', '3', '4'], tab: 'style' },
    { key: 'limit', label: 'Max Products', type: 'number', tab: 'content' },
    { key: 'showFilters', label: 'Show Filters', type: 'boolean', tab: 'content' },
    { key: 'category', label: 'Filter by Category', type: 'text', tab: 'content' },
  ],
  FeaturedProducts: [
    { key: 'title', label: 'Section Title', type: 'text', tab: 'content' },
    { key: 'count', label: 'Number of Products', type: 'number', tab: 'content' },
  ],
  Spacer: [
    { key: 'height', label: 'Height (px)', type: 'number', tab: 'style' },
  ],
  Divider: [
    { key: 'color', label: 'Color', type: 'color', tab: 'style' },
    { key: 'thickness', label: 'Thickness (px)', type: 'number', tab: 'style' },
  ],
  Testimonial: [
    { key: 'quote', label: 'Quote', type: 'textarea', tab: 'content' },
    { key: 'author', label: 'Author Name', type: 'text', tab: 'content' },
    { key: 'rating', label: 'Rating (1–5)', type: 'number', tab: 'content' },
    { key: 'avatar', label: 'Avatar URL', type: 'url', tab: 'style', placeholder: 'https://...' },
  ],
  Section: [
    { key: 'backgroundColor', label: 'Background', type: 'color', tab: 'style' },
    { key: 'paddingY', label: 'Padding', type: 'select', options: ['sm', 'md', 'lg', 'xl'], tab: 'style' },
  ],
  ContactForm: [
    { key: 'title', label: 'Title', type: 'text', tab: 'content' },
    { key: 'subtitle', label: 'Subtitle', type: 'text', tab: 'content' },
  ],
  NewsletterForm: [
    { key: 'title', label: 'Title', type: 'text', tab: 'content' },
    { key: 'placeholder', label: 'Input Placeholder', type: 'text', tab: 'content' },
  ],
};

const ALIGNMENT_ICONS: Record<string, React.ReactNode> = {
  left: <AlignLeft className="w-4 h-4" />,
  center: <AlignCenter className="w-4 h-4" />,
  right: <AlignRight className="w-4 h-4" />,
  justify: <AlignJustify className="w-4 h-4" />,
};

export function PropertyPanel({ component, onChange, onDelete, onClose }: Props) {
  const [props, setProps] = useState<Record<string, unknown>>(component.props);
  const [activeTab, setActiveTab] = useState<'content' | 'style'>('content');

  // Reset when component changes
  useEffect(() => {
    setProps(component.props);
    setActiveTab('content');
  }, [component.id, component.props]);

  const fields = COMPONENT_FIELDS[component.type] ?? [];
  const contentFields = fields.filter((f) => (f.tab ?? 'content') === 'content');
  const styleFields = fields.filter((f) => f.tab === 'style');
  const hasStyleTab = styleFields.length > 0;

  const handleChange = (key: string, value: unknown) => {
    const updated = { ...props, [key]: value };
    setProps(updated);
    onChange(component.id, updated);
  };

  const gradient = TYPE_COLORS[component.type] ?? 'from-gray-400 to-gray-500';

  const renderField = (field: FieldDef) => {
    const inputId = `prop-${component.id}-${field.key}`;

    if (field.type === 'alignment' && field.options) {
      return (
        <div key={field.key}>
          <label className="text-xs font-medium text-gray-500 mb-1.5 block">{field.label}</label>
          <div className="flex bg-gray-100 rounded-lg p-1 gap-0.5">
            {field.options.map((opt) => (
              <button
                key={opt}
                onClick={() => handleChange(field.key, opt)}
                className={`flex-1 flex items-center justify-center py-1.5 rounded-md transition-all ${
                  (props[field.key] ?? 'left') === opt
                    ? 'bg-white text-primary-600 shadow-sm'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
                title={opt.charAt(0).toUpperCase() + opt.slice(1)}
              >
                {ALIGNMENT_ICONS[opt] ?? opt}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (field.type === 'textarea') {
      return (
        <div key={field.key}>
          <label htmlFor={inputId} className="text-xs font-medium text-gray-500 mb-1.5 block">{field.label}</label>
          <textarea
            id={inputId}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-300 resize-none transition-all bg-gray-50 focus:bg-white"
            rows={4}
            value={(props[field.key] as string) ?? ''}
            onChange={(e) => handleChange(field.key, e.target.value)}
          />
        </div>
      );
    }

    if (field.type === 'color') {
      return (
        <div key={field.key}>
          <label htmlFor={inputId} className="text-xs font-medium text-gray-500 mb-1.5 block">{field.label}</label>
          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                id={inputId}
                type="color"
                className="w-9 h-9 rounded-lg border-2 border-gray-200 cursor-pointer appearance-none bg-transparent"
                value={(props[field.key] as string) ?? '#000000'}
                onChange={(e) => handleChange(field.key, e.target.value)}
              />
              <div
                className="absolute inset-0.5 rounded-md pointer-events-none"
                style={{ backgroundColor: (props[field.key] as string) ?? '#000000' }}
              />
            </div>
            <input
              type="text"
              aria-label={`${field.label} hex value`}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-300 bg-gray-50 focus:bg-white transition-all"
              value={(props[field.key] as string) ?? ''}
              onChange={(e) => handleChange(field.key, e.target.value)}
            />
          </div>
        </div>
      );
    }

    if (field.type === 'boolean') {
      return (
        <div key={field.key}>
          <label htmlFor={inputId} className="flex items-center justify-between cursor-pointer group py-1">
            <span className="text-xs font-medium text-gray-500">{field.label}</span>
            <div className="relative">
              <input
                id={inputId}
                type="checkbox"
                className="sr-only peer"
                checked={(props[field.key] as boolean) ?? false}
                onChange={(e) => handleChange(field.key, e.target.checked)}
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:ring-2 peer-focus:ring-primary-500/30 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-500 transition-colors" />
            </div>
          </label>
        </div>
      );
    }

    if (field.type === 'number') {
      return (
        <div key={field.key}>
          <label htmlFor={inputId} className="text-xs font-medium text-gray-500 mb-1.5 block">{field.label}</label>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleChange(field.key, Math.max(0, ((props[field.key] as number) ?? 0) - 1))}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors text-sm font-medium"
            >
              −
            </button>
            <input
              id={inputId}
              type="number"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-300 bg-gray-50 focus:bg-white transition-all"
              value={(props[field.key] as number) ?? 0}
              onChange={(e) => handleChange(field.key, parseFloat(e.target.value) || 0)}
            />
            <button
              onClick={() => handleChange(field.key, ((props[field.key] as number) ?? 0) + 1)}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors text-sm font-medium"
            >
              +
            </button>
          </div>
        </div>
      );
    }

    if (field.type === 'select' && field.options) {
      return (
        <div key={field.key}>
          <label htmlFor={inputId} className="text-xs font-medium text-gray-500 mb-1.5 block">{field.label}</label>
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.min(field.options.length, 4)}, 1fr)` }}>
            {field.options.map((opt) => (
              <button
                key={opt}
                onClick={() => handleChange(field.key, opt)}
                className={`px-2 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  (props[field.key] as string) === opt || (!props[field.key] && opt === field.options![0])
                    ? 'border-primary-300 bg-primary-50 text-primary-700 shadow-sm'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      );
    }

    // Text and URL fields
    return (
      <div key={field.key}>
        <label htmlFor={inputId} className="text-xs font-medium text-gray-500 mb-1.5 block">{field.label}</label>
        <div className="relative">
          {field.type === 'url' && (
            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          )}
          <input
            id={inputId}
            type="text"
            className={`w-full border border-gray-200 rounded-lg py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-300 bg-gray-50 focus:bg-white transition-all ${
              field.type === 'url' ? 'pl-9 pr-3' : 'px-3'
            }`}
            value={(props[field.key] as string) ?? ''}
            onChange={(e) => handleChange(field.key, e.target.value)}
            placeholder={field.placeholder ?? (field.type === 'url' ? 'https://...' : '')}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col flex-shrink-0 animate-fade-in">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${gradient} text-white flex items-center justify-center shadow-sm`}>
              {TYPE_ICONS[component.type] ?? <Layout className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">{component.type}</h3>
              <p className="text-[11px] text-gray-400">Properties</p>
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => onDelete(component.id)}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
              title="Delete component"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
              aria-label="Close properties panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Description */}
        {TYPE_DESCRIPTIONS[component.type] && (
          <p className="text-[11px] text-gray-400 leading-relaxed mb-3">{TYPE_DESCRIPTIONS[component.type]}</p>
        )}

        {/* Tabs */}
        {hasStyleTab && (
          <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
            <button
              onClick={() => setActiveTab('content')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeTab === 'content'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <TypeIcon className="w-3.5 h-3.5" />
              Content
            </button>
            <button
              onClick={() => setActiveTab('style')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeTab === 'style'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Palette className="w-3.5 h-3.5" />
              Style
            </button>
          </div>
        )}
      </div>

      {/* Fields */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {fields.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Layout className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-xs font-medium">No editable properties</p>
            <p className="text-[11px] mt-0.5">This component uses default settings</p>
          </div>
        ) : (
          (hasStyleTab
            ? (activeTab === 'content' ? contentFields : styleFields)
            : fields
          ).map(renderField)
        )}
      </div>

      {/* Footer with component ID */}
      <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/50">
        <p className="text-[10px] text-gray-400 font-mono truncate" title={component.id}>
          ID: {component.id.slice(0, 8)}…
        </p>
      </div>
    </div>
  );
}