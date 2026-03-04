'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth';
import { pagesApi, experimentsApi } from '@/lib/api';
import { DragDropEditor } from '@/components/editor/DragDropEditor';
import type { Page, PageComponent } from '@/types';

export default function BuilderPage() {
  const searchParams = useSearchParams();
  const store = useAuthStore((s) => s.store);
  const qc = useQueryClient();
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);

  const experimentId = searchParams.get('experimentId');
  const variantId = searchParams.get('variantId');

  // List all pages
  const { data: pages } = useQuery<Page[]>({
    queryKey: ['pages', store?.id],
    queryFn: () => pagesApi.list(store!.id),
    enabled: !!store?.id,
  });

  // Auto-select page from URL param or first page
  useEffect(() => {
    if (!pages?.length) return;
    const slug = searchParams.get('page') ?? '';
    const match = pages.find((p) => p.slug === slug) ?? pages[0];
    if (match && !selectedPageId) setSelectedPageId(match.id);
  }, [pages, searchParams, selectedPageId]);

  // Get full page with layout
  const { data: page, isLoading: isLoadingPage } = useQuery<Page>({
    queryKey: ['page', store?.id, selectedPageId],
    queryFn: () => pagesApi.get(store!.id, pages!.find((p) => p.id === selectedPageId)!.slug),
    enabled: !!store?.id && !!selectedPageId && !!pages?.length,
  });

  // Get experiment if editing a variant
  const { data: experiment, isLoading: isLoadingExperiment } = useQuery({
    queryKey: ['experiment', store?.id, experimentId],
    queryFn: () => experimentsApi.get(store!.id, experimentId!),
    enabled: !!store?.id && !!experimentId,
  });

  const savePageMutation = useMutation({
    mutationFn: ({ layout, published }: { layout: PageComponent[]; published?: boolean }) =>
      pagesApi.update(store!.id, selectedPageId!, { layout, ...(published !== undefined ? { published } : {}) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['page', store?.id, selectedPageId] });
      qc.invalidateQueries({ queryKey: ['pages', store?.id] });
    },
  });

  const saveVariantMutation = useMutation({
    mutationFn: async ({ layout }: { layout: PageComponent[] }) => {
      if (!experiment) return;
      // We need to pass the whole experiment data to update it, keeping other variants intact
      const updatedVariants = experiment.variants.map((v: any) =>
        v.id === variantId ? { ...v, layout } : v
      );
      return experimentsApi.update(store!.id, experimentId!, {
        name: experiment.name,
        status: experiment.status,
        variants: updatedVariants,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['experiment', store?.id, experimentId] });
    },
  });

  if (!store) return null;

  if (!pages?.length || !selectedPageId) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <div className="text-center text-gray-400">
          <div className="text-5xl mb-4">📄</div>
          <p className="font-medium">No pages yet</p>
          <p className="text-sm">Pages are created automatically when you set up your store.</p>
        </div>
      </div>
    );
  }

  const isLoading = isLoadingPage || (!!experimentId && isLoadingExperiment);
  const isEditingVariant = !!experiment && !!variantId;
  const variant = isEditingVariant ? experiment.variants.find((v: any) => v.id === variantId) : null;

  const currentLayout = isEditingVariant
    ? (Array.isArray(variant?.layout) ? variant.layout : [])
    : (Array.isArray(page?.layout) ? page?.layout : []);

  const pageTitle = isEditingVariant
    ? `${page?.title} - ${variant.name} (${experiment.name})`
    : page?.title;

  return (
    <div className="flex h-screen">
      {/* Page selector sidebar */}
      <div className="w-48 bg-gray-900 text-white flex-shrink-0 flex flex-col">
        <div className="px-4 py-3 border-b border-gray-700">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Pages</p>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {pages.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                if (isEditingVariant) {
                  // Usually shouldn't allow switching pages while editing a variant,
                  // or we can drop the query params. Let's redirect to drop query params.
                  window.location.href = `/builder?page=${p.slug}`;
                } else {
                  setSelectedPageId(p.id);
                  window.history.replaceState(null, '', `?page=${p.slug}`);
                }
              }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${selectedPageId === p.id && !isEditingVariant
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
            >
              <div className="font-medium">{p.title}</div>
              <div className="text-xs mt-0.5 flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${p.published ? 'bg-green-400' : 'bg-gray-500'}`} />
                {p.published ? 'Published' : 'Draft'}
              </div>
            </button>
          ))}
        </div>
        {isEditingVariant && (
          <div className="px-4 py-4 border-t border-gray-700">
            <div className="text-xs font-medium text-amber-400 mb-2">Editing Variant</div>
            <div className="text-sm text-white mb-3">{variant.name}</div>
            <button
              onClick={() => window.location.href = `/experiments`}
              className="text-xs text-gray-400 hover:text-white transition-colors"
            >
              &larr; Back to Experiments
            </button>
          </div>
        )}
      </div>

      {/* Editor */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
        </div>
      ) : pageTitle && currentLayout !== undefined ? (
        <div className="flex-1">
          <DragDropEditor
            pageId={isEditingVariant ? variantId! : page!.id}
            pageTitle={pageTitle}
            initialLayout={currentLayout}
            theme={store.theme}
            primaryColor={store.primaryColor}
            onSave={(layout, published) => {
              if (isEditingVariant) {
                return saveVariantMutation.mutateAsync({ layout });
              } else {
                return savePageMutation.mutateAsync({ layout, published });
              }
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
