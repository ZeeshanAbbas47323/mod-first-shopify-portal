import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AuthUser {
  name: string;
  email: string;
}

interface AuthState {
  user: AuthUser | null;
  /** Access token — lives in memory only, never written to localStorage. */
  token: string | null;
  isAuthenticated: boolean;
  login: (user: AuthUser, accessToken: string, refreshToken?: string | null) => void;
  /** Called by the token-refresh flow to update the in-memory access token only. */
  setToken: (accessToken: string) => void;
  logout: () => void;
}

// ── Refresh token helpers ──────────────────────────────────────────────────
// The refresh token lives in localStorage under its own key, completely
// outside the Zustand persist snapshot so it never sits next to the access token.

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

// ── Store ──────────────────────────────────────────────────────────────────

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
      // Access token is intentionally excluded — it only lives in memory.
      // On page refresh, AuthGuard will do a silent re-exchange using the RT.
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
