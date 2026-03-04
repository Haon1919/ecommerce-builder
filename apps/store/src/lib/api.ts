import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
});

export const storeApi = {
  getBySlug: (slug: string) => api.get(`/stores/slug/${slug}`).then((r) => r.data),
  getPage: (storeId: string, slug: string) => api.get(`/stores/${storeId}/pages/${slug || ''}`).then((r) => r.data),
};

export const productsApi = {
  list: (storeId: string, params?: Record<string, string>) =>
    api.get(`/stores/${storeId}/products`, { params }).then((r) => r.data),
  get: (storeId: string, productId: string) =>
    api.get(`/stores/${storeId}/products/${productId}`).then((r) => r.data),
  batch: (storeId: string, ids: string[]) =>
    api.get(`/stores/${storeId}/products/batch`, { params: { ids: ids.join(',') } }).then((r) => r.data),
};

export const ordersApi = {
  create: (data: Record<string, unknown>) => api.post('/orders', data).then((r) => r.data),
};

export const messagesApi = {
  send: (storeId: string, data: Record<string, string>) =>
    api.post(`/stores/${storeId}/messages`, data).then((r) => r.data),
};

export const chatApi = {
  sendMessage: (storeId: string, message?: string, audio?: { data: string, mimeType: string }, sessionId?: string) =>
    api.post(`/stores/${storeId}/chat`, { message, audio, sessionId }).then((r) => r.data),
  getHistory: (storeId: string, sessionId: string) =>
    api.get(`/stores/${storeId}/chat/history/${sessionId}`).then((r) => r.data),
  getEventRecommendations: (storeId: string, event: string, budget?: number) =>
    api.post(`/stores/${storeId}/chat/event-recommendations`, { event, budget }).then((r) => r.data),
};

export const experimentsApi = {
  getActive: (storeId: string) => api.get(`/stores/${storeId}/experiments/active`).then((r) => r.data),
  trackView: (storeId: string, experimentId: string, variantId: string) =>
    api.post(`/stores/${storeId}/experiments/${experimentId}/variants/${variantId}/view`).then((r) => r.data),
};
