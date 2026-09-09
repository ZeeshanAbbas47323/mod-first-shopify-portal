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

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});


const AUTH_PATHS = [
  "auth/login", "auth/send-otp", "auth/verify-otp",
  "auth/forgot-password", "auth/reset-password", "auth/refresh-token",
];

let refreshPromise: Promise<string | null> | null = null;

function syncUserFromToken(accessToken: string): void {
  try {
    const [, body] = accessToken.split(".");
    if (!body) return;
    const json = JSON.parse(
      decodeURIComponent(
        atob(body.replace(/-/g, "+").replace(/_/g, "/"))
          .split("")
          .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
          .join("")
      )
    );
    const name: string = (json.fullName ?? json.full_name ?? "").trim();
    const email: string = (json.email ?? "").trim();
    if (!name) return;

    const store = useAuthStore.getState();
    const current = store.user;
    if (current && current.name === name) return;
    store.login(
      { name, email: email || current?.email || "" },
      accessToken,
      getStoredRefreshToken()
    );
  } catch {
  }
}

export async function silentRefresh(): Promise<string | null> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return null;

  try {
    const { data } = await axios.patch(
      `${process.env.NEXT_PUBLIC_API_URL}auth/refresh-token`,
      { refreshToken },
      { headers: { "Content-Type": "application/json" }, timeout: 10000 }
    );

    const payload = data?.payload ?? data?.data ?? data;
    const tokens = payload?.tokens ?? payload?.token_data ?? payload;
    const newAccessToken: string | null =
      tokens?.accessToken ?? tokens?.access_token ?? tokens?.token ?? null;
    const newRefreshToken: string | null =
      tokens?.refreshToken ?? tokens?.refresh_token ?? null;

    if (!newAccessToken) return null;

    useAuthStore.getState().setToken(newAccessToken);

    syncUserFromToken(newAccessToken);

    if (newRefreshToken) setStoredRefreshToken(newRefreshToken);

    return newAccessToken;
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

      useAuthStore.getState().logout();
      if (typeof window !== "undefined") window.location.href = "/login";
      return Promise.reject(error);
    }

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
