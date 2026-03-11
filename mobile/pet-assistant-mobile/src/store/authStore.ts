import { create } from 'zustand';
import type { User } from '../types/auth';
import { authApi } from '../api/authApi';
import { userApi } from '../api/userApi';
import { setStoredToken, getStoredToken, removeStoredToken } from '../api/client';

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  loadSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email, password) => {
    try {
      const { data } = await authApi.login(email, password);
      if (!data.success || !data.token) {
        return { success: false, error: 'Email y contraseña requeridos' };
      }
      setStoredToken(data.token);
      set({
        token: data.token,
        user: data.user ?? null,
        isAuthenticated: true,
      });
      return { success: true };
    } catch (e: unknown) {
      const message = e && typeof e === 'object' && 'message' in e ? String((e as Error).message) : 'Error al iniciar sesión';
      return { success: false, error: message };
    }
  },

  signup: async (name, email, password) => {
    try {
      await authApi.signup(name, email, password);
      return { success: true };
    } catch (e: unknown) {
      const message = e && typeof e === 'object' && 'message' in e ? String((e as Error).message) : 'Error al registrarse';
      return { success: false, error: message };
    }
  },

  logout: async () => {
    removeStoredToken();
    set({ token: null, user: null, isAuthenticated: false });
  },

  loadSession: async () => {
    set({ isLoading: true });
    try {
      const token = await getStoredToken();
      if (!token) {
        set({ isLoading: false });
        return;
      }
      const { data } = await userApi.getProfile();
      set({
        token,
        user: { id: data.id, name: data.name, email: data.email },
        isAuthenticated: true,
        isLoading: false,
      });
    } catch {
      removeStoredToken();
      set({ token: null, user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
