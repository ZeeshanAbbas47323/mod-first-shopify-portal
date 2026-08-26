import { isAxiosError } from "axios";
import { api } from "@/lib/api";
import type { AuthUser } from "@/stores/auth-store";

/**
 * Auth endpoints from "ModFirst APIS" Postman collection.
 * The exact response envelope isn't documented, so parsing is tolerant:
 * tokens/users are looked up under the common shapes
 * ({ token }, { data: { accessToken } }, etc.).
 */

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
  // ModFirst API envelope: { success, status, message, payload: {...} }
  return (payload?.payload ?? payload?.data ?? payload?.result ?? payload) as Json;
}

/** Tokens may sit directly on the payload or inside a `tokens` container. */
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
  const name: string =
    u?.name ??
    [u?.first_name ?? u?.firstName, u?.last_name ?? u?.lastName]
      .filter(Boolean)
      .join(" ") ??
    email.split("@")[0];
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

/** Human-readable message out of an axios error. */
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
