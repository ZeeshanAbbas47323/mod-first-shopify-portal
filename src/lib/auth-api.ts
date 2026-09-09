import { isAxiosError } from "axios";
import { api } from "@/lib/api";
import type { AuthUser } from "@/stores/auth-store";


// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;

export interface AuthResult {
  token: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  message: string;
  raw: Json;
}

function unwrap(payload: Json): Json {
  return (payload?.payload ?? payload?.data ?? payload?.result ?? payload) as Json;
}

function tokenSource(payload: Json): Json {
  const d = unwrap(payload);
  return (d?.tokens ?? d?.token_data ?? d) as Json;
}

function pickToken(payload: Json): string | null {
  const t = tokenSource(payload);
  return (
    t?.accessToken ??
    t?.access_token ??
    t?.token ??
    payload?.token ??
    payload?.accessToken ??
    null
  );
}

function pickRefreshToken(payload: Json): string | null {
  const t = tokenSource(payload);
  return t?.refreshToken ?? t?.refresh_token ?? payload?.refreshToken ?? null;
}

function pickUser(payload: Json, fallbackEmail: string): AuthUser | null {
  const d = unwrap(payload);
  const u = d?.user ?? d?.profile ?? null;
  if (!u && !fallbackEmail) return null;
  const email: string = u?.email ?? fallbackEmail;
  const candidates = [
    u?.full_name,
    u?.fullName,
    u?.name,
    [u?.first_name ?? u?.firstName, u?.last_name ?? u?.lastName].filter(Boolean).join(" "),
  ];
  const name = candidates.map((c) => (typeof c === "string" ? c.trim() : "")).find(Boolean);
  return { name: name || email.split("@")[0], email };
}

function toResult(payload: Json, email: string): AuthResult {
  return {
    token: pickToken(payload),
    refreshToken: pickRefreshToken(payload),
    user: pickUser(payload, email),
    message: payload?.message ?? "",
    raw: payload,
  };
}

export function apiErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as Json | undefined;
    return (
      data?.message ??
      data?.error ??
      (typeof data === "string" ? data : undefined) ??
      (error.code === "ERR_NETWORK"
        ? "Can't reach the server. Check that the API is running."
        : undefined) ??
      fallback
    );
  }
  return fallback;
}

export async function login(values: {
  email: string;
  password: string;
  rememberMe?: boolean;
}): Promise<AuthResult> {
  const { data } = await api.post("auth/login", values);
  return toResult(data, values.email);
}

export async function sendOtp(email: string): Promise<string> {
  const { data } = await api.post("auth/send-otp", { email });
  return data?.message ?? "Code sent to your email.";
}

export async function verifyOtp(email: string, otp: string): Promise<AuthResult> {
  const { data } = await api.post("auth/verify-otp", { email, otp });
  return toResult(data, email);
}

export async function forgotPassword(email: string): Promise<string> {
  const { data } = await api.post("auth/forgot-password", { email });
  return data?.message ?? "Password reset code sent to your email.";
}

export async function resetPassword(values: {
  email: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<string> {
  const { data } = await api.post("auth/reset-password", values);
  return data?.message ?? "Password reset successfully.";
}

export async function changePassword(values: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<string> {
  const { data } = await api.post("auth/change-password", values);
  return data?.message ?? "Password changed successfully.";
}

export async function getProfile(): Promise<Json> {
  const { data } = await api.get("auth/profile");
  return (data?.payload ?? data?.data ?? data) as Json;
}

export async function updateProfile(body: {
  full_name?: string;
  phone?: string;
  image?: string | null;
}): Promise<string> {
  const { data } = await api.patch("auth/profile", body);
  return data?.message ?? "Profile updated.";
}

export async function logoutServer(): Promise<void> {
  try {
    await api.post("auth/logout");
  } catch {
  }
}
