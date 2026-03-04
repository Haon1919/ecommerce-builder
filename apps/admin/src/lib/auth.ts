import { create } from 'zustand';
import { authApi } from './api';
import type { User, Store } from '../types';

interface AuthStore {
  token: string | null;
  user: User | null;
  store: Store | null;
  isLoading: boolean;
  login: (email: string, password: string, storeSlug: string) => Promise<void>;
  logout: () => void;
  loadFromStorage: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  token: null,
  user: null,
  store: null,
  isLoading: true,

  login: async (email, password, storeSlug) => {
    const data = await authApi.login(email, password, storeSlug);
    localStorage.setItem('admin_token', data.token);
    set({ token: data.token, user: data.user, store: data.store, isLoading: false });
  },

  logout: () => {
    localStorage.removeItem('admin_token');
    set({ token: null, user: null, store: null });
  },

  loadFromStorage: async () => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      set({ isLoading: false });
      return;
    }
    try {
      const data = await authApi.me();
      set({ token, user: data.user, store: data.user?.store, isLoading: false });
    } catch {
      localStorage.removeItem('admin_token');
      set({ isLoading: false });
    }
  },
}));
