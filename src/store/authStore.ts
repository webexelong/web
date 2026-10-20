import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  username: string;
  fullName: string;
  role: string;
  tenantId: number;
  storeId?: number;
  storeName?: string;
  brandName?: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  setAuth: (data: { token: string; user: User }) => void;
  logout: () => void;
  hasRole: (roles: string[]) => boolean;
}

export const isTokenExpired = (token: string | null): boolean => {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const decoded = JSON.parse(jsonPayload);
    if (!decoded.exp) return false;
    return decoded.exp * 1000 < Date.now();
  } catch {
    return true;
  }
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,

      setAuth: (data) => {
        localStorage.setItem('token', data.token);
        set({
          token: data.token,
          user: data.user,
          isAuthenticated: true,
        });
      },

      logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        set({
          token: null,
          user: null,
          isAuthenticated: false,
        });
      },

      hasRole: (roles: string[]) => {
        const { user } = get();
        return user ? roles.includes(user.role) : false;
      },
    }),
    {
      name: 'auth-storage',
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Tự động dọn dẹp nếu token đã hết hạn hoặc không hợp lệ khi tải lại trang
          if (!state.token || isTokenExpired(state.token)) {
            state.logout();
          }
        }
      },
    }
  )
);

