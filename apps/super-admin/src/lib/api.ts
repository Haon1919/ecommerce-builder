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

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('super_admin_token');
    if (token) {
      if (isTokenExpiringSoon(token)) {
        localStorage.removeItem('super_admin_token');
        window.location.href = '/login';
        return Promise.reject(new Error('Token expired, please log in again.'));
      }
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('super_admin_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }).then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
};

export const analyticsApi = {
  overview: () => api.get('/analytics/super/overview').then((r) => r.data),
  metrics: (metric: string, hours = 24) =>
    api.get(`/analytics/metrics/${metric}`, { params: { hours } }).then((r) => r.data),
  alerts: (unacknowledged = false) =>
    api.get('/analytics/alerts', { params: { unacknowledged, limit: 100 } }).then((r) => r.data),
  acknowledgeAlert: (alertId: string) =>
    api.patch(`/analytics/alerts/${alertId}/acknowledge`).then((r) => r.data),
};

export const logsApi = {
  list: (params?: Record<string, string>) =>
    api.get('/logs', { params }).then((r) => r.data),
  stats: (hours = 1) =>
    api.get('/logs/stats', { params: { hours } }).then((r) => r.data),
};

export const ticketsApi = {
  all: (params?: Record<string, string>) =>
    api.get('/tickets', { params }).then((r) => r.data),
  updateStatus: (ticketId: string, status: string) =>
    api.patch(`/tickets/${ticketId}/status`, { status }).then((r) => r.data),
  addComment: (ticketId: string, body: string, internal = false) =>
    api.post(`/tickets/${ticketId}/comments`, { body, internal }).then((r) => r.data),
};

export const storesApi = {
  list: (params?: Record<string, string>) =>
    api.get('/stores', { params }).then((r) => r.data),
  toggleActive: (storeId: string, active: boolean) =>
    api.patch(`/stores/${storeId}/active`, { active }).then((r) => r.data),
  createStore: (data: Record<string, any>) =>
    api.post('/stores', data).then((r) => r.data),
};
