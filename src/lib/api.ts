import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "@/stores/auth-store";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

// ── Request: attach access token ──
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response: silent refresh on 401 ──
const AUTH_PATHS = [
  "auth/login", "auth/send-otp", "auth/verify-otp",
  "auth/forgot-password", "auth/reset-password",
];

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken } = useAuthStore.getState();
  if (!refreshToken) return null;
  try {
    const { data } = await axios.post(
      `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh-token`,
      { refreshToken },
      { headers: { "Content-Type": "application/json" }, timeout: 10000 }
    );
    const payload = data?.payload ?? data?.data ?? data;
    const newToken: string | null =
      payload?.token ?? payload?.accessToken ?? payload?.access_token ?? null;
    const newRefresh: string | null =
      payload?.refreshToken ?? payload?.refresh_token ?? null;

    if (newToken) {
      useAuthStore.getState().login(
        useAuthStore.getState().user!,
        newToken,
        newRefresh ?? refreshToken,
      );
      return newToken;
    }
    return null;
  } catch {
    return null;
  }
}

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

      // Deduplicate concurrent refresh calls
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }

      const newToken = await refreshPromise;

      if (newToken) {
        config.headers.Authorization = `Bearer ${newToken}`;
        return api(config);
      }

      // Refresh failed — log out
      useAuthStore.getState().logout();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }

    if (error.response?.status === 401 && isAuthRoute) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && config?._retry) {
      useAuthStore.getState().logout();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);
