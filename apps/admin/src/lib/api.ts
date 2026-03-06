import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
});

// Helper to proactively check if token is expiring within 5 minutes
const isTokenExpiringSoon = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (!payload.exp) return false;
    const timeToExpiry = payload.exp * 1000 - Date.now();
    return timeToExpiry < 5 * 60 * 1000; // 5 minutes
  } catch (e) {
    return true; // Treat unparseable tokens as expired
  }
};

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('admin_token');
    if (token) {
      if (isTokenExpiringSoon(token)) {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        window.location.href = '/login';
        return Promise.reject(new Error('Token expired, please log in again.'));
      }
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ==================== AUTH ====================
export const authApi = {
  login: (email: string, password: string, storeSlug: string) =>
    api.post('/auth/login', { email, password, storeSlug }).then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
};

// ==================== STORE ====================
export const storeApi = {
  get: (storeId: string) => api.get(`/stores/${storeId}`).then((r) => r.data),
  update: (storeId: string, data: unknown) => api.put(`/stores/${storeId}`, data).then((r) => r.data),
  updateSettings: (storeId: string, data: unknown) => api.put(`/stores/${storeId}/settings`, data).then((r) => r.data),
  configure: (storeId: string) => api.post(`/stores/${storeId}/configure`).then((r) => r.data),
  adminChat: (storeId: string, payload: { message: string; history?: any[] }) =>
    api.post(`/stores/${storeId}/admin-chat`, payload).then((r) => r.data),
  apiKeys: {
    list: (storeId: string) => api.get(`/stores/${storeId}/api-keys`).then((r) => r.data),
    create: (storeId: string, name: string) => api.post(`/stores/${storeId}/api-keys`, { name }).then((r) => r.data),
    revoke: (storeId: string, keyId: string) => api.delete(`/stores/${storeId}/api-keys/${keyId}`).then((r) => r.data),
  },
};

// ==================== PAGES ====================
export const pagesApi = {
  list: (storeId: string) => api.get(`/stores/${storeId}/pages`).then((r) => r.data),
  get: (storeId: string, slug: string) => api.get(`/stores/${storeId}/pages/${slug}`).then((r) => r.data),
  create: (storeId: string, data: unknown) => api.post(`/stores/${storeId}/pages`, data).then((r) => r.data),
  update: (storeId: string, pageId: string, data: unknown) =>
    api.put(`/stores/${storeId}/pages/${pageId}`, data).then((r) => r.data),
  publish: (storeId: string, pageId: string, published: boolean) =>
    api.post(`/stores/${storeId}/pages/${pageId}/publish`, { published }).then((r) => r.data),
};

// ==================== PRODUCTS ====================
export const productsApi = {
  list: (storeId: string, params?: Record<string, string>) =>
    api.get(`/stores/${storeId}/products`, { params }).then((r) => r.data),
  get: (storeId: string, productId: string) =>
    api.get(`/stores/${storeId}/products/${productId}`).then((r) => r.data),
  create: (storeId: string, data: unknown) =>
    api.post(`/stores/${storeId}/products`, data).then((r) => r.data),
  update: (storeId: string, productId: string, data: unknown) =>
    api.put(`/stores/${storeId}/products/${productId}`, data).then((r) => r.data),
  delete: (storeId: string, productId: string) =>
    api.delete(`/stores/${storeId}/products/${productId}`).then((r) => r.data),
  bulkImport: (storeId: string, products: unknown[]) =>
    api.post(`/stores/${storeId}/products/bulk-import`, { products }).then((r) => r.data),
  generate3D: (storeId: string, productId: string) =>
    api.post(`/stores/${storeId}/products/${productId}/generate-3d`).then((r) => r.data),
};

// ==================== ORDERS ====================
export const ordersApi = {
  list: (storeId: string, params?: Record<string, string>) =>
    api.get(`/stores/${storeId}/orders`, { params }).then((r) => r.data),
  get: (storeId: string, orderId: string) =>
    api.get(`/stores/${storeId}/orders/${orderId}`).then((r) => r.data),
  updateStatus: (storeId: string, orderId: string, status: string, trackingNumber?: string) =>
    api.patch(`/stores/${storeId}/orders/${orderId}/status`, { status, trackingNumber }).then((r) => r.data),
};

// ==================== MESSAGES ====================
export const messagesApi = {
  list: (storeId: string, params?: Record<string, string>) =>
    api.get(`/stores/${storeId}/messages`, { params }).then((r) => r.data),
  get: (storeId: string, messageId: string) =>
    api.get(`/stores/${storeId}/messages/${messageId}`).then((r) => r.data),
  reply: (storeId: string, messageId: string, body: string) =>
    api.post(`/stores/${storeId}/messages/${messageId}/reply`, { body }).then((r) => r.data),
};

// ==================== TICKETS ====================
export const ticketsApi = {
  list: (storeId: string) => api.get(`/stores/${storeId}/tickets`).then((r) => r.data),
  create: (storeId: string, data: unknown) =>
    api.post(`/stores/${storeId}/tickets`, data).then((r) => r.data),
  addComment: (ticketId: string, body: string) =>
    api.post(`/tickets/${ticketId}/comments`, { body }).then((r) => r.data),
};

// ==================== ANALYTICS ====================
export const analyticsApi = {
  dashboard: (storeId: string, days = 30) =>
    api.get(`/stores/${storeId}/analytics/dashboard`, { params: { days } }).then((r) => r.data),
};

// ==================== EXPERIMENTS ====================
export const experimentsApi = {
  list: (storeId: string) => api.get(`/stores/${storeId}/experiments`).then((r) => r.data),
  get: (storeId: string, experimentId: string) => api.get(`/stores/${storeId}/experiments/${experimentId}`).then((r) => r.data),
  create: (storeId: string, data: unknown) => api.post(`/stores/${storeId}/experiments`, data).then((r) => r.data),
  update: (storeId: string, experimentId: string, data: unknown) => api.put(`/stores/${storeId}/experiments/${experimentId}`, data).then((r) => r.data),
  delete: (storeId: string, experimentId: string) => api.delete(`/stores/${storeId}/experiments/${experimentId}`).then((r) => r.data),
};

// ==================== COMPANIES ====================
export const companiesApi = {
  list: (storeId: string) => api.get(`/stores/${storeId}/companies`).then((r) => r.data),
  get: (storeId: string, companyId: string) => api.get(`/stores/${storeId}/companies/${companyId}`).then((r) => r.data),
  create: (storeId: string, data: unknown) => api.post(`/stores/${storeId}/companies`, data).then((r) => r.data),
  update: (storeId: string, companyId: string, data: unknown) => api.put(`/stores/${storeId}/companies/${companyId}`, data).then((r) => r.data),
  delete: (storeId: string, companyId: string) => api.delete(`/stores/${storeId}/companies/${companyId}`).then((r) => r.data),
};

// ==================== PRICELISTS ====================
export const pricelistsApi = {
  list: (storeId: string) => api.get(`/stores/${storeId}/pricelists`).then((r) => r.data),
  get: (storeId: string, priceListId: string) => api.get(`/stores/${storeId}/pricelists/${priceListId}`).then((r) => r.data),
  create: (storeId: string, data: unknown) => api.post(`/stores/${storeId}/pricelists`, data).then((r) => r.data),
  update: (storeId: string, priceListId: string, data: unknown) => api.put(`/stores/${storeId}/pricelists/${priceListId}`, data).then((r) => r.data),
  delete: (storeId: string, priceListId: string) => api.delete(`/stores/${storeId}/pricelists/${priceListId}`).then((r) => r.data),
};

// ==================== VENDORS ====================
export const vendorsApi = {
  list: (storeId: string) => api.get(`/stores/${storeId}/vendors`).then((r) => r.data),
  get: (storeId: string, vendorId: string) => api.get(`/stores/${storeId}/vendors/${vendorId}`).then((r) => r.data),
  create: (storeId: string, data: unknown) => api.post(`/stores/${storeId}/vendors`, data).then((r) => r.data),
  update: (storeId: string, vendorId: string, data: unknown) => api.put(`/stores/${storeId}/vendors/${vendorId}`, data).then((r) => r.data),
};
