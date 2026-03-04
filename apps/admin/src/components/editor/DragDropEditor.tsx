'use client';
import { useState, useCallback } from 'react';
import {
  DndContext, DragEndEvent, DragOverEvent, DragStartEvent,
  PointerSensor, useSensor, useSensors, DragOverlay, closestCenter
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { v4 as uuidv4 } from 'uuid';
import { ComponentPalette } from './ComponentPalette';
import { Canvas } from './Canvas';
import { PropertyPanel } from './PropertyPanel';
import type { PageComponent } from '@/types';
import { Save, Eye, Globe, RotateCcw, RotateCw, ChevronDown } from 'lucide-react';

interface Props {
  pageId: string;
  pageTitle: string;
  initialLayout: PageComponent[];
  theme: string;
  primaryColor: string;
  onSave: (layout: PageComponent[], published?: boolean) => Promise<void>;
}

type HistoryEntry = PageComponent[];

export function DragDropEditor({ pageId, pageTitle, initialLayout, theme, primaryColor, onSave }: Props) {
  const [components, setComponents] = useState<PageComponent[]>(initialLayout);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeDragType, setActiveDragType] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [viewMode, setViewMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [history, setHistory] = useState<HistoryEntry[]>([initialLayout]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const selectedComponent = components.find((c) => c.id === selectedId);

  const pushHistory = useCallback((newComponents: PageComponent[]) => {
    setHistory((h) => {
      const newHistory = h.slice(0, historyIndex + 1);
      newHistory.push(newComponents);
      return newHistory.slice(-50); // Keep last 50 states
    });
    setHistoryIndex((i) => Math.min(i + 1, 49));
  }, [historyIndex]);

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setComponents(history[historyIndex - 1]);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setComponents(history[historyIndex + 1]);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragType(event.active.data.current?.type ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragType(null);

    if (!over) return;

    // From palette → canvas
    if (active.data.current?.fromPalette) {
      const { type, defaultProps } = active.data.current;
      const newComponent: PageComponent = {
        id: uuidv4(),
        type,
        order: components.length,
        props: defaultProps ?? {},
      };

      let newComponents: PageComponent[];
      if (over.id === 'canvas') {
        newComponents = [...components, newComponent];
      } else {
        const overIndex = components.findIndex((c) => c.id === over.id);
        newComponents = [...components];
        newComponents.splice(overIndex + 1, 0, newComponent);
      }

      newComponents = newComponents.map((c, i) => ({ ...c, order: i }));
      setComponents(newComponents);
      pushHistory(newComponents);
      setSelectedId(newComponent.id);
      return;
    }

    // Reorder within canvas
    if (active.id !== over.id) {
      const oldIndex = components.findIndex((c) => c.id === active.id);
      const newIndex = components.findIndex((c) => c.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        const newComponents = arrayMove(components, oldIndex, newIndex).map((c, i) => ({ ...c, order: i }));
        setComponents(newComponents);
        pushHistory(newComponents);
      }
    }
  };

  const handlePropChange = (id: string, props: Record<string, unknown>) => {
    const newComponents = components.map((c) => c.id === id ? { ...c, props } : c);
    setComponents(newComponents);
    // Debounce history push
    pushHistory(newComponents);
  };

  const handleDelete = (id: string) => {
    const newComponents = components.filter((c) => c.id !== id).map((c, i) => ({ ...c, order: i }));
    setComponents(newComponents);
    pushHistory(newComponents);
    setSelectedId(null);
  };

  const handleSave = async (publish?: boolean) => {
    setIsSaving(true);
    try {
      await onSave(components, publish);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const viewWidths: Record<string, string> = {
    desktop: '100%',
    tablet: '768px',
    mobile: '390px',
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex flex-col h-screen bg-gray-100">
        {/* Toolbar */}
        <div className="h-14 bg-white border-b border-gray-200 px-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-gray-900 text-sm">{pageTitle}</h2>
            <span className="text-gray-300">|</span>
            {/* Undo/Redo */}
            <button
              onClick={undo}
              disabled={historyIndex === 0}
              aria-label="Undo"
              className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded disabled:opacity-40"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={redo}
              disabled={historyIndex >= history.length - 1}
              aria-label="Redo"
              className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded disabled:opacity-40"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>

          {/* Viewport toggles */}
          <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
            {(['desktop', 'tablet', 'mobile'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  viewMode === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {v[0].toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {saveStatus !== 'idle' && (
              <span className={`text-xs font-medium ${saveStatus === 'saved' ? 'text-green-600' : 'text-red-600'}`}>
                {saveStatus === 'saved' ? '✓ Saved' : '✗ Error saving'}
              </span>
            )}
            <button
              onClick={() => handleSave(false)}
              disabled={isSaving}
              className="btn-secondary text-sm py-1.5"
            >
              <Save className="w-3.5 h-3.5 inline mr-1.5" />
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={isSaving}
              className="btn-primary text-sm py-1.5"
            >
              <Globe className="w-3.5 h-3.5 inline mr-1.5" />
              Publish
            </button>
          </div>
        </div>

        {/* Editor body */}
        <div className="flex flex-1 overflow-hidden">
          <ComponentPalette />

          {/* Canvas area */}
          <div className="flex-1 overflow-auto bg-gray-200 flex flex-col items-center py-6 px-6">
            <div
              className="bg-white shadow-xl overflow-auto min-h-full transition-all duration-300"
              style={{ width: viewWidths[viewMode], maxWidth: '100%' }}
            >
              <Canvas
                components={components}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </div>
          </div>

          {/* Property panel */}
          {selectedComponent ? (
            <PropertyPanel
              component={selectedComponent}
              onChange={handlePropChange}
              onDelete={handleDelete}
              onClose={() => setSelectedId(null)}
            />
          ) : (
            <div className="w-72 bg-white border-l border-gray-200 flex flex-col items-center justify-center text-gray-400 flex-shrink-0">
              <div className="text-4xl mb-3">⚙️</div>
              <p className="text-sm font-medium">Select a component</p>
              <p className="text-xs mt-1">to edit its properties</p>
            </div>
          )}
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeDragType && (
          <div className="bg-white border-2 border-primary-400 rounded-xl p-3 shadow-2xl text-sm font-medium text-primary-600 flex items-center gap-2">
            <span>Dropping {activeDragType}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
