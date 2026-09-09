import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AuthUser {
  name: string;
  email: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: AuthUser, accessToken: string, refreshToken?: string | null) => void;
  setToken: (accessToken: string) => void;
  logout: () => void;
}


const RT_KEY = "modefirst-rt";

export const getStoredRefreshToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(RT_KEY);
};

export const setStoredRefreshToken = (token: string | null): void => {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(RT_KEY, token);
  else localStorage.removeItem(RT_KEY);
};


export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: (user, accessToken, refreshToken = null) => {
        setStoredRefreshToken(refreshToken);
        set({ user, token: accessToken, isAuthenticated: true });
      },

      setToken: (accessToken) => set({ token: accessToken }),

      logout: () => {
        setStoredRefreshToken(null);
        set({ user: null, token: null, isAuthenticated: false });
      },
    }),
    {
      name: "modefirst-auth",
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
