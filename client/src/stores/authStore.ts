import { create } from 'zustand';
import type { User } from '../types';
import api from '../lib/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,

  login: async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { token, user } = res.data;
    sessionStorage.setItem('hippo_token', token);
    sessionStorage.setItem('hippo_user', JSON.stringify(user));
    set({ token, user, isAuthenticated: true });
  },

  logout: () => {
    sessionStorage.removeItem('hippo_token');
    sessionStorage.removeItem('hippo_user');
    set({ token: null, user: null, isAuthenticated: false });
  },

  hydrate: () => {
    const token = sessionStorage.getItem('hippo_token');
    const userStr = sessionStorage.getItem('hippo_user');
    if (token && userStr) {
      set({ token, user: JSON.parse(userStr), isAuthenticated: true });
    }
  },
}));
