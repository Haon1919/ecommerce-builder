'use client';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { PageComponent } from '@/types';
import {
  GripVertical, Settings, Copy, ArrowUp, ArrowDown, Trash2,
  Sparkles, Flag, MessageSquareQuote, HelpCircle,
  ShoppingBag, Star, GalleryHorizontalEnd,
  MousePointerClick, Mail, Newspaper,
  Type, AlignLeft, ImageIcon, PlayCircle,
  Layout, Columns2, Columns3, Minus, MoveVertical, MousePointer,
} from 'lucide-react';

const TYPE_COLORS: Record<string, string> = {
  HeroSection: 'bg-indigo-500',
  Heading: 'bg-emerald-500',
  Text: 'bg-teal-500',
  Image: 'bg-cyan-500',
  Video: 'bg-sky-500',
  Button: 'bg-rose-500',
  Banner: 'bg-amber-500',
  Testimonial: 'bg-orange-500',
  FAQ: 'bg-yellow-600',
  ProductGrid: 'bg-violet-500',
  FeaturedProducts: 'bg-purple-500',
  ProductCarousel: 'bg-fuchsia-500',
  ContactForm: 'bg-pink-500',
  NewsletterForm: 'bg-red-400',
  Section: 'bg-blue-500',
  TwoColumns: 'bg-blue-400',
  ThreeColumns: 'bg-blue-300',
  Spacer: 'bg-gray-400',
  Divider: 'bg-gray-500',
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  HeroSection: <Sparkles className="w-3 h-3" />,
  Heading: <Type className="w-3 h-3" />,
  Text: <AlignLeft className="w-3 h-3" />,
  Image: <ImageIcon className="w-3 h-3" />,
  Video: <PlayCircle className="w-3 h-3" />,
  Button: <MousePointerClick className="w-3 h-3" />,
  Banner: <Flag className="w-3 h-3" />,
  Testimonial: <MessageSquareQuote className="w-3 h-3" />,
  FAQ: <HelpCircle className="w-3 h-3" />,
  ProductGrid: <ShoppingBag className="w-3 h-3" />,
  FeaturedProducts: <Star className="w-3 h-3" />,
  ProductCarousel: <GalleryHorizontalEnd className="w-3 h-3" />,
  ContactForm: <Mail className="w-3 h-3" />,
  NewsletterForm: <Newspaper className="w-3 h-3" />,
  Section: <Layout className="w-3 h-3" />,
  TwoColumns: <Columns2 className="w-3 h-3" />,
  ThreeColumns: <Columns3 className="w-3 h-3" />,
  Spacer: <MoveVertical className="w-3 h-3" />,
  Divider: <Minus className="w-3 h-3" />,
};

// Visual preview of each component type
function ComponentPreview({ component }: { component: PageComponent }) {
  const p = component.props;
  switch (component.type) {
    case 'HeroSection':
      return (
        <div
          className="w-full py-16 px-8 text-center"
          style={{ backgroundColor: (p.backgroundColor as string) ?? '#6366f1', color: (p.textColor as string) ?? '#fff' }}
        >
          <h2 className="text-3xl font-bold mb-3">{(p.title as string) ?? 'Hero Title'}</h2>
          <p className="text-lg opacity-90 mb-6">{(p.subtitle as string) ?? 'Subtitle text'}</p>
          {Boolean(p.ctaText) && (
            <span className="bg-white text-primary-600 px-6 py-2.5 rounded-full font-medium text-sm inline-block">
              {p.ctaText as string}
            </span>
          )}
        </div>
      );
    case 'Heading':
      const Tag = ((p.level as string) ?? 'h2') as keyof React.JSX.IntrinsicElements;
      const sizes: Record<string, string> = { h1: 'text-4xl', h2: 'text-3xl', h3: 'text-2xl', h4: 'text-xl' };
      return (
        <Tag
          className={`font-bold ${sizes[(p.level as string) ?? 'h2'] ?? 'text-2xl'} py-4 px-4`}
          style={{ textAlign: (p.align as 'left' | 'center' | 'right') ?? 'left', color: (p.color as string) ?? '#111827' }}
        >
          {(p.text as string) ?? 'Heading Text'}
        </Tag>
      );
    case 'Text':
      return (
        <p
          className="px-4 py-4 text-base leading-relaxed"
          style={{ textAlign: (p.align as 'left' | 'center' | 'right') ?? 'left', color: (p.color as string) ?? '#374151' }}
        >
          {(p.text as string) ?? 'Text content goes here...'}
        </p>
      );
    case 'Image':
      return (
        <div className="px-4 py-4 flex justify-center">
          {Boolean(p.src) ? (
            <img
              src={p.src as string}
              alt={(p.alt as string) ?? ''}
              style={{ width: (p.width as string) ?? '100%', borderRadius: `${(p.borderRadius as number) ?? 0}px` }}
              className="max-h-64 object-cover"
            />
          ) : (
            <div className="w-full h-48 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl flex flex-col items-center justify-center text-gray-400 text-sm border-2 border-dashed border-gray-200">
              <ImageIcon className="w-8 h-8 mb-2 text-gray-300" />
              <span className="text-xs">Add image URL in properties</span>
            </div>
          )}
        </div>
      );
    case 'Button':
      const btnStyles: Record<string, string> = {
        primary: 'bg-primary-500 text-white hover:bg-primary-600',
        secondary: 'bg-gray-100 text-gray-800',
        outline: 'border-2 border-primary-500 text-primary-600',
        ghost: 'text-primary-600 underline',
      };
      const sizePadding: Record<string, string> = { sm: 'px-4 py-1.5 text-sm', md: 'px-6 py-2.5', lg: 'px-8 py-3 text-lg' };
      return (
        <div className="px-4 py-4 flex">
          <span className={`rounded-lg font-medium cursor-pointer ${btnStyles[(p.variant as string) ?? 'primary']} ${sizePadding[(p.size as string) ?? 'md']}`}>
            {(p.text as string) ?? 'Button'}
          </span>
        </div>
      );
    case 'Banner':
      return (
        <div
          className="w-full py-3 px-8 text-center text-sm font-medium"
          style={{ backgroundColor: (p.backgroundColor as string) ?? '#fef3c7', color: (p.textColor as string) ?? '#92400e' }}
        >
          {(p.text as string) ?? 'Banner text here'}
        </div>
      );
    case 'Spacer':
      return (
        <div style={{ height: `${(p.height as number) ?? 40}px` }} className="bg-transparent relative">
          <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-gray-200" />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] text-gray-400 bg-white px-2">{(p.height as number) ?? 40}px</span>
        </div>
      );
    case 'Divider':
      return (
        <div className="px-4 py-2">
          <hr style={{ borderColor: (p.color as string) ?? '#e5e7eb', borderTopWidth: `${(p.thickness as number) ?? 1}px` }} />
        </div>
      );
    case 'ProductGrid':
      return (
        <div className="px-4 py-8 bg-gradient-to-b from-gray-50/50 to-white">
          <div className={`grid grid-cols-${(p.columns as number) ?? 3} gap-4`}>
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                <div className="h-32 bg-gradient-to-br from-gray-100 to-gray-50 rounded-lg mb-3 flex items-center justify-center">
                  <ShoppingBag className="w-8 h-8 text-gray-200" />
                </div>
                <div className="h-4 bg-gray-200 rounded-full mb-2 animate-pulse" />
                <div className="h-4 bg-gray-100 rounded-full w-2/3 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      );
    case 'FeaturedProducts':
      return (
        <div className="px-4 py-8">
          <h3 className="text-2xl font-bold text-gray-900 text-center mb-6">{(p.title as string) ?? 'Featured Products'}</h3>
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                <div className="h-24 bg-gradient-to-br from-gray-100 to-gray-50 rounded-lg mb-2 flex items-center justify-center">
                  <Star className="w-6 h-6 text-gray-200" />
                </div>
                <div className="h-3 bg-gray-200 rounded-full mb-1 animate-pulse" />
                <div className="h-3 bg-primary-100 rounded-full w-1/2 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      );
    case 'Testimonial':
      return (
        <div className="px-8 py-8 text-center bg-gradient-to-b from-gray-50 to-white">
          <div className="text-yellow-400 text-xl mb-3">{'★'.repeat((p.rating as number) ?? 5)}</div>
          <p className="text-lg text-gray-700 italic mb-4">&quot;{(p.quote as string) ?? 'Great product!'}&quot;</p>
          <p className="font-semibold text-gray-900">— {(p.author as string) ?? 'Customer'}</p>
        </div>
      );
    case 'ContactForm':
      return (
        <div className="px-8 py-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-2">{(p.title as string) ?? 'Contact Us'}</h3>
          <p className="text-gray-500 mb-4">{(p.subtitle as string) ?? ''}</p>
          <div className="space-y-3">
            {['Name', 'Email', 'Message'].map((f) => (
              <div key={f} className="bg-gray-50 rounded-lg h-10 px-3 flex items-center text-sm text-gray-400 border border-gray-100">{f}</div>
            ))}
            <div className="bg-primary-500 text-white rounded-lg py-2.5 text-center text-sm font-medium">Send Message</div>
          </div>
        </div>
      );
    case 'NewsletterForm':
      return (
        <div className="px-8 py-8 text-center bg-gradient-to-b from-gray-50 to-white">
          <h3 className="text-xl font-bold text-gray-900 mb-2">{(p.title as string) ?? 'Subscribe to Our Newsletter'}</h3>
          <div className="flex gap-2 max-w-md mx-auto mt-4">
            <div className="flex-1 bg-gray-50 rounded-lg h-10 px-3 flex items-center text-sm text-gray-400 border border-gray-100">
              {(p.placeholder as string) ?? 'Enter your email'}
            </div>
            <div className="bg-primary-500 text-white rounded-lg px-4 flex items-center text-sm font-medium">Subscribe</div>
          </div>
        </div>
      );
    default:
      return (
        <div className="px-4 py-6 text-center text-gray-400 text-sm bg-gray-50">
          [{component.type} component]
        </div>
      );
  }
}

function SortableComponent({
  component, isSelected, onSelect, onDuplicate, onMoveUp, onMoveDown, onDelete, isFirst, isLast,
}: {
  component: PageComponent;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onMoveUp?: (id: string) => void;
  onMoveDown?: (id: string) => void;
  onDelete?: (id: string) => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: component.id,
    data: { type: 'canvas-component', component },
  });

  const colorClass = TYPE_COLORS[component.type] ?? 'bg-gray-400';

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative group transition-all duration-200 ${isSelected
          ? 'ring-2 ring-primary-500 ring-offset-2 shadow-lg shadow-primary-100/50 z-20'
          : 'hover:ring-1 hover:ring-gray-300 hover:ring-offset-1'
        } ${isDragging ? 'opacity-40 shadow-2xl z-50 scale-[1.02]' : ''}`}
    >
      {/* Component content */}
      <div onClick={() => onSelect(component.id)} className="cursor-pointer">
        <ComponentPreview component={component} />
      </div>

      {/* Floating toolbar — appears on hover/select */}
      <div className={`absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-0.5 bg-white border border-gray-200 rounded-lg px-1 py-0.5 shadow-lg transition-all duration-200 ${
        isSelected ? 'opacity-100 scale-100' : 'opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100'
      }`}>
        {/* Drag handle */}
        <span {...attributes} {...listeners} className="cursor-grab p-1 hover:bg-gray-100 rounded" title="Drag to reorder">
          <GripVertical className="w-3.5 h-3.5 text-gray-400" />
        </span>

        {/* Type badge */}
        <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold text-white ${colorClass}`}>
          {TYPE_ICONS[component.type]}
          {component.type}
        </span>

        <div className="w-px h-4 bg-gray-200 mx-0.5" />

        {/* Quick actions */}
        {onMoveUp && (
          <button
            onClick={(e) => { e.stopPropagation(); onMoveUp(component.id); }}
            disabled={isFirst}
            className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:hover:bg-transparent"
            title="Move up"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
        )}
        {onMoveDown && (
          <button
            onClick={(e) => { e.stopPropagation(); onMoveDown(component.id); }}
            disabled={isLast}
            className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:hover:bg-transparent"
            title="Move down"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
        )}
        {onDuplicate && (
          <button
            onClick={(e) => { e.stopPropagation(); onDuplicate(component.id); }}
            className="p-1 hover:bg-blue-50 rounded text-gray-500 hover:text-blue-600"
            title="Duplicate"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        )}
        {onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(component.id); }}
            className="p-1 hover:bg-red-50 rounded text-gray-500 hover:text-red-600"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Settings */}
        <button
          onClick={(e) => { e.stopPropagation(); onSelect(component.id); }}
          className="p-1 hover:bg-primary-50 rounded text-gray-500 hover:text-primary-600"
          title="Edit properties"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Order indicator — left edge */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 transition-colors duration-200 ${
        isSelected ? `${colorClass.replace('bg-', 'bg-')}` : 'bg-transparent group-hover:bg-gray-200'
      }`} />
    </div>
  );
}

interface CanvasProps {
  components: PageComponent[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onDuplicate?: (id: string) => void;
  onMoveUp?: (id: string) => void;
  onMoveDown?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function Canvas({ components, selectedId, onSelect, onDuplicate, onMoveUp, onMoveDown, onDelete }: CanvasProps) {
  const { setNodeRef, isOver } = useDroppable({ id: 'canvas' });

  return (
    <div
      ref={setNodeRef}
      onClick={(e) => { if (e.target === e.currentTarget) onSelect(null); }}
      className={`flex-1 min-h-full overflow-y-auto transition-all duration-300 ${isOver
          ? 'bg-primary-50/50 ring-2 ring-primary-400/40 ring-inset'
          : 'bg-white'
        }`}
    >
      {components.length === 0 ? (
        <div className={`flex flex-col items-center justify-center h-full min-h-[500px] text-center transition-colors ${
          isOver ? 'text-primary-600' : 'text-gray-400'
        }`}>
          <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-6 transition-all duration-300 ${
            isOver
              ? 'bg-primary-100 scale-110 shadow-lg shadow-primary-200/50'
              : 'bg-gray-100'
          }`}>
            <MousePointer className={`w-8 h-8 transition-colors ${isOver ? 'text-primary-500' : 'text-gray-300'}`} />
          </div>
          <p className="text-lg font-semibold mb-1">
            {isOver ? 'Drop it here!' : 'Start building your page'}
          </p>
          <p className="text-sm max-w-xs mx-auto">
            {isOver
              ? 'Release to add this component'
              : 'Drag components from the left panel, or browse the palette to get started'
            }
          </p>
          {!isOver && (
            <div className="flex items-center gap-3 mt-6 text-xs text-gray-400">
              <kbd className="px-2 py-1 bg-gray-100 rounded border border-gray-200 font-mono">⌘Z</kbd>
              <span>undo</span>
              <kbd className="px-2 py-1 bg-gray-100 rounded border border-gray-200 font-mono">⌘⇧Z</kbd>
              <span>redo</span>
            </div>
          )}
        </div>
      ) : (
        <SortableContext items={components.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <div className="divide-y divide-gray-50 py-2">
            {components.map((comp, index) => (
              <SortableComponent
                key={comp.id}
                component={comp}
                isSelected={selectedId === comp.id}
                onSelect={onSelect}
                onDuplicate={onDuplicate}
                onMoveUp={onMoveUp}
                onMoveDown={onMoveDown}
                onDelete={onDelete}
                isFirst={index === 0}
                isLast={index === components.length - 1}
              />
            ))}
          </div>
          {/* Drop zone at bottom */}
          {isOver && (
            <div className="h-20 border-2 border-dashed border-primary-300 rounded-xl mx-4 my-4 flex items-center justify-center text-primary-500 bg-primary-50/50 transition-all animate-pulse">
              <span className="text-sm font-medium">Drop component here</span>
            </div>
          )}
        </SortableContext>
      )}
    </div>
  );
}
