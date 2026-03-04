'use client';
import { useState } from 'react';
import type { PageComponent } from '@/types';
import { X, Trash2 } from 'lucide-react';

interface Props {
  component: PageComponent;
  onChange: (id: string, props: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

type FieldDef = { key: string; label: string; type: 'text' | 'textarea' | 'color' | 'number' | 'select' | 'boolean' | 'url'; options?: string[] };

const COMPONENT_FIELDS: Record<string, FieldDef[]> = {
  HeroSection: [
    { key: 'title', label: 'Title', type: 'text' },
    { key: 'subtitle', label: 'Subtitle', type: 'text' },
    { key: 'ctaText', label: 'Button Text', type: 'text' },
    { key: 'ctaLink', label: 'Button Link', type: 'text' },
    { key: 'backgroundColor', label: 'Background Color', type: 'color' },
    { key: 'backgroundImage', label: 'Background Image URL', type: 'url' },
    { key: 'textColor', label: 'Text Color', type: 'color' },
  ],
  Heading: [
    { key: 'text', label: 'Text', type: 'text' },
    { key: 'level', label: 'Heading Level', type: 'select', options: ['h1', 'h2', 'h3', 'h4'] },
    { key: 'align', label: 'Alignment', type: 'select', options: ['left', 'center', 'right'] },
    { key: 'color', label: 'Color', type: 'color' },
  ],
  Text: [
    { key: 'text', label: 'Content', type: 'textarea' },
    { key: 'align', label: 'Alignment', type: 'select', options: ['left', 'center', 'right', 'justify'] },
    { key: 'color', label: 'Color', type: 'color' },
  ],
  Image: [
    { key: 'src', label: 'Image URL', type: 'url' },
    { key: 'alt', label: 'Alt Text', type: 'text' },
    { key: 'width', label: 'Width (px or %)', type: 'text' },
    { key: 'borderRadius', label: 'Border Radius (px)', type: 'number' },
  ],
  Button: [
    { key: 'text', label: 'Button Text', type: 'text' },
    { key: 'link', label: 'Link URL', type: 'text' },
    { key: 'variant', label: 'Style', type: 'select', options: ['primary', 'secondary', 'outline', 'ghost'] },
    { key: 'size', label: 'Size', type: 'select', options: ['sm', 'md', 'lg'] },
  ],
  Banner: [
    { key: 'text', label: 'Banner Text', type: 'text' },
    { key: 'link', label: 'Link (optional)', type: 'text' },
    { key: 'backgroundColor', label: 'Background Color', type: 'color' },
    { key: 'textColor', label: 'Text Color', type: 'color' },
  ],
  ProductGrid: [
    { key: 'columns', label: 'Columns', type: 'select', options: ['2', '3', '4'] },
    { key: 'limit', label: 'Max Products', type: 'number' },
    { key: 'showFilters', label: 'Show Filters', type: 'boolean' },
    { key: 'category', label: 'Filter by Category', type: 'text' },
  ],
  FeaturedProducts: [
    { key: 'title', label: 'Section Title', type: 'text' },
    { key: 'count', label: 'Number of Products', type: 'number' },
  ],
  Spacer: [
    { key: 'height', label: 'Height (px)', type: 'number' },
  ],
  Divider: [
    { key: 'color', label: 'Color', type: 'color' },
    { key: 'thickness', label: 'Thickness (px)', type: 'number' },
  ],
  Testimonial: [
    { key: 'quote', label: 'Quote', type: 'textarea' },
    { key: 'author', label: 'Author Name', type: 'text' },
    { key: 'rating', label: 'Rating (1-5)', type: 'number' },
    { key: 'avatar', label: 'Avatar URL', type: 'url' },
  ],
  Section: [
    { key: 'backgroundColor', label: 'Background Color', type: 'color' },
    { key: 'paddingY', label: 'Padding', type: 'select', options: ['sm', 'md', 'lg', 'xl'] },
  ],
  ContactForm: [
    { key: 'title', label: 'Title', type: 'text' },
    { key: 'subtitle', label: 'Subtitle', type: 'text' },
  ],
  NewsletterForm: [
    { key: 'title', label: 'Title', type: 'text' },
    { key: 'placeholder', label: 'Input Placeholder', type: 'text' },
  ],
};

export function PropertyPanel({ component, onChange, onDelete, onClose }: Props) {
  const [props, setProps] = useState<Record<string, unknown>>(component.props);

  const fields = COMPONENT_FIELDS[component.type] ?? [];

  const handleChange = (key: string, value: unknown) => {
    const updated = { ...props, [key]: value };
    setProps(updated);
    onChange(component.id, updated);
  };

  return (
    <div className="w-72 bg-white border-l border-gray-200 flex flex-col flex-shrink-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900 text-sm">{component.type}</h3>
          <p className="text-xs text-gray-400">Edit properties</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onDelete(component.id)}
            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete component"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close properties panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Fields */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {fields.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">
            No editable properties for this component.
          </p>
        ) : (
          fields.map((field) => {
            const inputId = `prop-${component.id}-${field.key}`;
            return (
              <div key={field.key}>
                <label htmlFor={inputId} className="label">{field.label}</label>
                {field.type === 'textarea' ? (
                  <textarea
                    id={inputId}
                    className="input resize-none"
                    rows={4}
                    value={(props[field.key] as string) ?? ''}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                  />
                ) : field.type === 'color' ? (
                  <div className="flex items-center gap-2">
                    <input
                      id={inputId}
                      type="color"
                      className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer"
                      value={(props[field.key] as string) ?? '#000000'}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                    />
                    <input
                      type="text"
                      aria-label={`${field.label} hex value`}
                      className="input flex-1"
                      value={(props[field.key] as string) ?? ''}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                    />
                  </div>
                ) : field.type === 'boolean' ? (
                  <label htmlFor={inputId} className="flex items-center gap-2 cursor-pointer">
                    <input
                      id={inputId}
                      type="checkbox"
                      className="w-4 h-4 rounded text-primary-600"
                      checked={(props[field.key] as boolean) ?? false}
                      onChange={(e) => handleChange(field.key, e.target.checked)}
                    />
                    <span className="text-sm text-gray-600">Enabled</span>
                  </label>
                ) : field.type === 'number' ? (
                  <input
                    id={inputId}
                    type="number"
                    className="input"
                    value={(props[field.key] as number) ?? 0}
                    onChange={(e) => handleChange(field.key, parseFloat(e.target.value))}
                  />
                ) : field.type === 'select' && field.options ? (
                  <select
                    id={inputId}
                    className="input"
                    value={(props[field.key] as string) ?? field.options[0]}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                  >
                    {field.options.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={inputId}
                    type="text"
                    className="input"
                    value={(props[field.key] as string) ?? ''}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    placeholder={field.type === 'url' ? 'https://...' : ''}
                  />
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  );
}