'use client';
import { useState, useCallback, useEffect } from 'react';
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
import {
  Save, Globe, RotateCcw, RotateCw,
  Monitor, Tablet, Smartphone,
  Layers, ZoomIn, ZoomOut, Settings,
  Keyboard, Check, AlertCircle, Loader2,
} from 'lucide-react';

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
  const [zoom, setZoom] = useState(100);
  const [showLayers, setShowLayers] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const selectedComponent = components.find((c) => c.id === selectedId);

  const pushHistory = useCallback((newComponents: PageComponent[]) => {
    setHistory((h) => {
      const newHistory = h.slice(0, historyIndex + 1);
      newHistory.push(newComponents);
      return newHistory.slice(-50);
    });
    setHistoryIndex((i) => Math.min(i + 1, 49));
  }, [historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setComponents(history[historyIndex - 1]);
    }
  }, [historyIndex, history]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setComponents(history[historyIndex + 1]);
    }
  }, [historyIndex, history]);

  const handlePropChange = useCallback((id: string, props: Record<string, unknown>) => {
    setComponents((prev) => {
      const newComponents = prev.map((c) => c.id === id ? { ...c, props } : c);
      pushHistory(newComponents);
      return newComponents;
    });
  }, [pushHistory]);

  const handleDelete = useCallback((id: string) => {
    setComponents((prev) => {
      const newComponents = prev.filter((c) => c.id !== id).map((c, i) => ({ ...c, order: i }));
      pushHistory(newComponents);
      return newComponents;
    });
    setSelectedId(null);
  }, [pushHistory]);

  const handleSave = useCallback(async (publish?: boolean) => {
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
  }, [components, onSave]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;
      if (isMeta && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if (isMeta && e.key === 'z' && e.shiftKey) { e.preventDefault(); redo(); }
      if (isMeta && e.key === 's') { e.preventDefault(); handleSave(false); }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId && document.activeElement === document.body) {
          e.preventDefault();
          handleDelete(selectedId);
        }
      }
      if (e.key === 'Escape') { setSelectedId(null); setShowShortcuts(false); }
      if (e.key === '?') { setShowShortcuts((s) => !s); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, selectedId, handleSave, handleDelete]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragType(event.active.data.current?.type ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragType(null);
    if (!over) return;

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

  const handleDuplicate = (id: string) => {
    const sourceIndex = components.findIndex((c) => c.id === id);
    if (sourceIndex === -1) return;
    const source = components[sourceIndex];
    const duplicate: PageComponent = {
      ...source,
      id: uuidv4(),
      order: sourceIndex + 1,
      props: { ...source.props },
    };
    const newComponents = [...components];
    newComponents.splice(sourceIndex + 1, 0, duplicate);
    const reordered = newComponents.map((c, i) => ({ ...c, order: i }));
    setComponents(reordered);
    pushHistory(reordered);
    setSelectedId(duplicate.id);
  };

  const handleMoveUp = (id: string) => {
    const index = components.findIndex((c) => c.id === id);
    if (index <= 0) return;
    const newComponents = arrayMove(components, index, index - 1).map((c, i) => ({ ...c, order: i }));
    setComponents(newComponents);
    pushHistory(newComponents);
  };

  const handleMoveDown = (id: string) => {
    const index = components.findIndex((c) => c.id === id);
    if (index === -1 || index >= components.length - 1) return;
    const newComponents = arrayMove(components, index, index + 1).map((c, i) => ({ ...c, order: i }));
    setComponents(newComponents);
    pushHistory(newComponents);
  };

  const viewWidths: Record<string, string> = {
    desktop: '100%',
    tablet: '768px',
    mobile: '390px',
  };

  const viewIcons = {
    desktop: <Monitor className="w-4 h-4" />,
    tablet: <Tablet className="w-4 h-4" />,
    mobile: <Smartphone className="w-4 h-4" />,
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex flex-col h-screen bg-gray-100">
        {/* ─── Toolbar ─── */}
        <div className="h-14 bg-white border-b border-gray-200 px-4 flex items-center justify-between flex-shrink-0 relative z-30">
          {/* Left: Title + undo/redo + component count */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
              <h2 className="font-semibold text-gray-900 text-sm">{pageTitle}</h2>
            </div>
            <div className="h-5 w-px bg-gray-200" />
            <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={undo}
                disabled={historyIndex === 0}
                aria-label="Undo"
                className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-white rounded-md disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                title="Undo (⌘Z)"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={redo}
                disabled={historyIndex >= history.length - 1}
                aria-label="Redo"
                className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-white rounded-md disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                title="Redo (⌘⇧Z)"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            </div>
            <span className="text-[11px] text-gray-400 tabular-nums">{components.length} element{components.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Center: Viewport toggles */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1">
            <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
              {(['desktop', 'tablet', 'mobile'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setViewMode(v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    viewMode === v
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                  title={v.charAt(0).toUpperCase() + v.slice(1)}
                >
                  {viewIcons[v]}
                  <span className="hidden lg:inline">{v.charAt(0).toUpperCase() + v.slice(1)}</span>
                </button>
              ))}
            </div>

            <div className="h-5 w-px bg-gray-200 mx-1" />

            {/* Zoom controls */}
            <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setZoom((z) => Math.max(50, z - 10))}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-white rounded-md transition-all"
                title="Zoom out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setZoom(100)}
                className="px-2 py-1 text-[11px] font-medium text-gray-500 hover:text-gray-700 hover:bg-white rounded-md transition-all tabular-nums min-w-[3rem] text-center"
                title="Reset zoom"
              >
                {zoom}%
              </button>
              <button
                onClick={() => setZoom((z) => Math.min(150, z + 10))}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-white rounded-md transition-all"
                title="Zoom in"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            {/* Layers toggle */}
            <button
              onClick={() => setShowLayers((s) => !s)}
              className={`p-2 rounded-lg transition-all ${
                showLayers ? 'bg-primary-100 text-primary-600' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
              }`}
              title="Toggle layers panel"
            >
              <Layers className="w-4 h-4" />
            </button>

            {/* Keyboard shortcut hint */}
            <button
              onClick={() => setShowShortcuts((s) => !s)}
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all"
              title="Keyboard shortcuts (?)"
            >
              <Keyboard className="w-4 h-4" />
            </button>

            <div className="h-5 w-px bg-gray-200" />

            {/* Save status */}
            {saveStatus !== 'idle' && (
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                saveStatus === 'saved'
                  ? 'bg-green-50 text-green-600'
                  : 'bg-red-50 text-red-600'
              }`}>
                {saveStatus === 'saved' ? <Check className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                {saveStatus === 'saved' ? 'Saved' : 'Error'}
              </div>
            )}

            <button
              onClick={() => handleSave(false)}
              disabled={isSaving}
              className="btn-secondary text-sm py-1.5 flex items-center gap-1.5"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {isSaving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={isSaving}
              className="btn-primary text-sm py-1.5 flex items-center gap-1.5"
            >
              <Globe className="w-3.5 h-3.5" />
              Publish
            </button>
          </div>
        </div>

        {/* ─── Editor body ─── */}
        <div className="flex flex-1 overflow-hidden">
          <ComponentPalette />

          {/* ─── Canvas area ─── */}
          <div className="flex-1 overflow-auto bg-gradient-to-br from-gray-100 via-gray-150 to-gray-200 flex flex-col items-center py-6 px-6 relative">
            {/* Canvas artboard */}
            <div
              className="bg-white rounded-lg shadow-xl overflow-auto min-h-full transition-all duration-300 ring-1 ring-black/5"
              style={{
                width: viewWidths[viewMode],
                maxWidth: '100%',
                transform: `scale(${zoom / 100})`,
                transformOrigin: 'top center',
              }}
            >
              <Canvas
                components={components}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onDuplicate={handleDuplicate}
                onMoveUp={handleMoveUp}
                onMoveDown={handleMoveDown}
                onDelete={handleDelete}
              />
            </div>

            {/* Canvas bottom label */}
            <div className="mt-4 text-[11px] text-gray-400 flex items-center gap-2">
              {viewMode === 'desktop' && <Monitor className="w-3 h-3" />}
              {viewMode === 'tablet' && <Tablet className="w-3 h-3" />}
              {viewMode === 'mobile' && <Smartphone className="w-3 h-3" />}
              {viewMode.charAt(0).toUpperCase() + viewMode.slice(1)} — {viewMode === 'desktop' ? 'Full width' : viewWidths[viewMode]}
            </div>
          </div>

          {/* ─── Layer panel (slide-in) ─── */}
          {showLayers && (
            <div className="w-56 bg-white border-l border-gray-200 flex flex-col flex-shrink-0 animate-fade-in">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-gray-500" />
                  <h3 className="font-semibold text-gray-900 text-sm">Layers</h3>
                </div>
                <span className="text-[10px] text-gray-400 tabular-nums">{components.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto py-1">
                {components.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <Layers className="w-6 h-6 mx-auto mb-2 opacity-30" />
                    <p className="text-xs">No layers yet</p>
                  </div>
                ) : (
                  components.map((comp, index) => (
                    <button
                      key={comp.id}
                      onClick={() => setSelectedId(comp.id)}
                      className={`w-full flex items-center gap-2 px-4 py-2 text-left text-xs transition-all ${
                        selectedId === comp.id
                          ? 'bg-primary-50 text-primary-700 border-l-2 border-primary-500'
                          : 'text-gray-600 hover:bg-gray-50 border-l-2 border-transparent'
                      }`}
                    >
                      <span className="tabular-nums text-[10px] text-gray-400 w-4 text-right">{index + 1}</span>
                      <span className="font-medium truncate">{comp.type}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ─── Property panel ─── */}
          {selectedComponent ? (
            <PropertyPanel
              component={selectedComponent}
              onChange={handlePropChange}
              onDelete={handleDelete}
              onClose={() => setSelectedId(null)}
            />
          ) : (
            <div className="w-80 bg-white border-l border-gray-200 flex flex-col items-center justify-center text-gray-400 flex-shrink-0">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                <Settings className="w-7 h-7 text-gray-300" />
              </div>
              <p className="text-sm font-medium text-gray-500">Select a component</p>
              <p className="text-xs mt-1 text-gray-400">to edit its properties</p>
              <div className="flex items-center gap-2 mt-4 text-[11px] text-gray-400">
                <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-mono border border-gray-200">Click</kbd>
                <span>or</span>
                <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-mono border border-gray-200">Layers</kbd>
              </div>
            </div>
          )}
        </div>

        {/* ─── Keyboard shortcuts modal ─── */}
        {showShortcuts && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setShowShortcuts(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-96 p-6 animate-slide-in" onClick={(e) => e.stopPropagation()}>
              <h3 className="font-bold text-gray-900 text-lg mb-4 flex items-center gap-2">
                <Keyboard className="w-5 h-5 text-primary-500" /> Keyboard Shortcuts
              </h3>
              <div className="space-y-2.5">
                {[
                  ['⌘ Z', 'Undo'],
                  ['⌘ ⇧ Z', 'Redo'],
                  ['⌘ S', 'Save'],
                  ['Delete / ⌫', 'Delete selected'],
                  ['Escape', 'Deselect'],
                  ['?', 'Toggle this panel'],
                ].map(([key, action]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{action}</span>
                    <kbd className="px-2 py-1 bg-gray-100 rounded-lg text-xs font-mono text-gray-500 border border-gray-200">{key}</kbd>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setShowShortcuts(false)}
                className="mt-5 w-full btn-secondary text-sm py-2"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Drag overlay ─── */}
      <DragOverlay>
        {activeDragType && (
          <div className="bg-white border-2 border-primary-400 rounded-xl px-4 py-3 shadow-2xl text-sm font-medium text-primary-600 flex items-center gap-2.5 backdrop-blur-sm">
            <div className="w-6 h-6 rounded-md bg-primary-100 flex items-center justify-center">
              <span className="text-primary-500 text-xs">+</span>
            </div>
            <span>{activeDragType}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
