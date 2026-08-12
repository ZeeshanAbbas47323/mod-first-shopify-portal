import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import {
  useAuthStore,
  getStoredRefreshToken,
  setStoredRefreshToken,
} from "@/stores/auth-store";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

// ── Request: attach in-memory access token ────────────────────────────────
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Refresh logic ─────────────────────────────────────────────────────────

const AUTH_PATHS = [
  "auth/login", "auth/send-otp", "auth/verify-otp",
  "auth/forgot-password", "auth/reset-password", "auth/refresh-token",
];

let refreshPromise: Promise<string | null> | null = null;

/**
 * Exchange the stored refresh token for a new access token.
 * Updates the in-memory access token in the store.
 * If the server rotates the refresh token, persists the new one.
 * Returns the new access token, or null if the refresh failed.
 */
export async function silentRefresh(): Promise<string | null> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return null;

  try {
    const { data } = await axios.post(
      `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh-token`,
      { refreshToken },
      { headers: { "Content-Type": "application/json" }, timeout: 10000 }
    );

    const payload = data?.payload ?? data?.data ?? data;
    const newAccessToken: string | null =
      payload?.token ?? payload?.accessToken ?? payload?.access_token ?? null;
    const newRefreshToken: string | null =
      payload?.refreshToken ?? payload?.refresh_token ?? null;

    if (!newAccessToken) return null;

    // Update in-memory access token only
    useAuthStore.getState().setToken(newAccessToken);

    // Rotate refresh token if the server issued a new one
    if (newRefreshToken) setStoredRefreshToken(newRefreshToken);

    return newAccessToken;
  } catch {
    return null;
  }
}

// ── Response: auto-retry on 401 ───────────────────────────────────────────

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetryableConfig | undefined;
    const url: string = config?.url ?? "";
    const isAuthRoute = AUTH_PATHS.some((p) => url.includes(p));

    if (error.response?.status === 401 && !isAuthRoute && config && !config._retry) {
      config._retry = true;

      // Deduplicate: if a refresh is already in flight, wait for it
      if (!refreshPromise) {
        refreshPromise = silentRefresh().finally(() => {
          refreshPromise = null;
        });
      }

      const newToken = await refreshPromise;

      if (newToken) {
        config.headers.Authorization = `Bearer ${newToken}`;
        return api(config);
      }

      // Refresh failed — clear session and send to login
      useAuthStore.getState().logout();
      if (typeof window !== "undefined") window.location.href = "/login";
      return Promise.reject(error);
    }

    // 401 on an auth route or a retried request that still fails — just reject
    if (error.response?.status === 401 && (isAuthRoute || config?._retry)) {
      if (config?._retry) {
        useAuthStore.getState().logout();
        if (typeof window !== "undefined") window.location.href = "/login";
      }
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);
