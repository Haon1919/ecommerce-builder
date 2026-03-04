'use client';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { PageComponent } from '@/types';
import { GripVertical, Settings } from 'lucide-react';

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
            <div className="w-full h-48 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 text-sm border-2 border-dashed border-gray-300">
              🖼 No image set — add URL in properties
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
      return <div style={{ height: `${(p.height as number) ?? 40}px` }} className="bg-transparent" />;
    case 'Divider':
      return (
        <div className="px-4 py-2">
          <hr style={{ borderColor: (p.color as string) ?? '#e5e7eb', borderTopWidth: `${(p.thickness as number) ?? 1}px` }} />
        </div>
      );
    case 'ProductGrid':
      return (
        <div className="px-4 py-8 bg-gray-50">
          <div className={`grid grid-cols-${(p.columns as number) ?? 3} gap-4`}>
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl p-4 border border-gray-200">
                <div className="h-32 bg-gray-100 rounded-lg mb-3" />
                <div className="h-4 bg-gray-200 rounded mb-2" />
                <div className="h-4 bg-gray-100 rounded w-2/3" />
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
              <div key={i} className="bg-white rounded-xl p-3 border border-gray-200">
                <div className="h-24 bg-gray-100 rounded-lg mb-2" />
                <div className="h-3 bg-gray-200 rounded mb-1" />
                <div className="h-3 bg-primary-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        </div>
      );
    case 'Testimonial':
      return (
        <div className="px-8 py-8 text-center bg-gray-50">
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
              <div key={f} className="bg-gray-100 rounded-lg h-10 px-3 flex items-center text-sm text-gray-400">{f}</div>
            ))}
            <div className="bg-primary-500 text-white rounded-lg py-2.5 text-center text-sm font-medium">Send Message</div>
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
  component, isSelected, onSelect
}: {
  component: PageComponent;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: component.id,
    data: { type: 'canvas-component', component },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative group border-2 transition-all ${isSelected
          ? 'border-primary-500 shadow-md'
          : 'border-transparent hover:border-gray-300'
        } ${isDragging ? 'opacity-50 shadow-xl z-50' : ''}`}
    >
      {/* Component content */}
      <div onClick={() => onSelect(component.id)} className="cursor-pointer">
        <ComponentPreview component={component} />
      </div>

      {/* Drag handle + type label (shown on hover/select) */}
      <div className={`absolute top-2 left-2 flex items-center gap-1 bg-white border border-gray-200 rounded-md px-2 py-0.5 shadow-sm text-xs text-gray-600 font-medium transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}>
        <span {...attributes} {...listeners} className="cursor-grab">
          <GripVertical className="w-3 h-3 text-gray-400" />
        </span>
        {component.type}
      </div>

      {/* Settings button */}
      <button
        onClick={(e) => { e.stopPropagation(); onSelect(component.id); }}
        className={`absolute top-2 right-2 p-1.5 bg-white border border-gray-200 rounded-md shadow-sm transition-opacity hover:bg-primary-50 hover:border-primary-300 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
      >
        <Settings className="w-3.5 h-3.5 text-gray-500" />
      </button>
    </div>
  );
}

interface CanvasProps {
  components: PageComponent[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function Canvas({ components, selectedId, onSelect }: CanvasProps) {
  const { setNodeRef, isOver } = useDroppable({ id: 'canvas' });

  return (
    <div
      ref={setNodeRef}
      onClick={(e) => { if (e.target === e.currentTarget) onSelect(null); }}
      className={`flex-1 min-h-full overflow-y-auto transition-colors ${isOver ? 'bg-primary-50 ring-2 ring-primary-300 ring-inset' : 'bg-white'
        }`}
    >
      {components.length === 0 ? (
        <div className={`flex flex-col items-center justify-center h-full min-h-[400px] text-center transition-colors ${isOver ? 'text-primary-600' : 'text-gray-400'
          }`}>
          <div className="text-6xl mb-4">⊞</div>
          <p className="text-lg font-medium">Drag components here</p>
          <p className="text-sm mt-1">or drag from the palette on the left</p>
        </div>
      ) : (
        <SortableContext items={components.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <div className="divide-y divide-gray-100">
            {components.map((comp) => (
              <SortableComponent
                key={comp.id}
                component={comp}
                isSelected={selectedId === comp.id}
                onSelect={onSelect}
              />
            ))}
          </div>
          {/* Drop zone at bottom */}
          {isOver && (
            <div className="h-16 border-2 border-dashed border-primary-400 rounded-lg mx-4 my-4 flex items-center justify-center text-primary-500 text-sm font-medium">
              Drop here
            </div>
          )}
        </SortableContext>
      )}
    </div>
  );
}
