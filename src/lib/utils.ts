import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Origin of the API itself, e.g. https://command.modfirst.com */
export function apiOrigin(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? "")
    .replace(/\/api\/.*$/, "")
    .replace(/\/$/, "");
}

/**
 * Where uploaded files are actually served from. The API stores only the path
 * (e.g. /products/shirt.png) so the public origin has to come from somewhere:
 *   1. NEXT_PUBLIC_IMAGE_URL — the CDN the API uploads to
 *   2. the origin learned from the last upload's `absolute_url`
 *   3. the API host, as a last resort if neither is known
 */
const UPLOAD_BASE_KEY = "modefirst-upload-base";
let learnedUploadBase: string | null = null;

/** Called after an upload so later page loads can resolve stored paths. */
export function rememberUploadBase(absoluteUrl?: string | null): void {
  if (!absoluteUrl) return;
  try {
    const origin = new URL(absoluteUrl).origin;
    if (origin === learnedUploadBase) return;
    learnedUploadBase = origin;
    if (typeof window !== "undefined") {
      localStorage.setItem(UPLOAD_BASE_KEY, origin);
    }
  } catch {
    // not an absolute URL — nothing to learn
  }
}

export function uploadBase(): string {
  const configured = (process.env.NEXT_PUBLIC_IMAGE_URL ?? "").trim().replace(/\/$/, "");
  if (configured) return configured;
  if (learnedUploadBase) return learnedUploadBase;
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(UPLOAD_BASE_KEY);
      if (stored) {
        learnedUploadBase = stored;
        return stored;
      }
    } catch {
      // private mode — fall through to the API host
    }
  }
  return apiOrigin();
}

/** Absolute public link for a stored file — images, anchors and downloads. */
export function fileUrl(src?: string | null): string {
  if (!src) return "";
  if (/^(https?:|data:|blob:)/.test(src)) return src;
  const base = uploadBase();
  return `${base}${src.startsWith("/") ? "" : "/"}${src}`;
}

/** Resolve a stored image path to a public CDN URL. */
export function imgUrl(src?: string | null): string {
  return fileUrl(src);
}

/**
 * Parse a server-supplied date string as a Date pinned to LOCAL time.
 * Handles both date-only strings ("2024-01-15") and ISO timestamps.
 * Prevents the "one day off" bug from `new Date("2024-01-15")` being UTC-midnight.
 */
export function parseServerDate(value?: string | null): Date | null {
  if (!value) return null;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    // eslint-disable-next-line prefer-const
    let [, y, m, d] = dateOnly;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  const dt = new Date(value);
  return isNaN(dt.getTime()) ? null : dt;
}

/** Format any Date/string as a local yyyy-MM-dd, suitable for <input type="date">. */
export function toLocalDateInput(value?: string | Date | null): string {
  if (!value) return "";
  const dt = typeof value === "string" ? parseServerDate(value) : value;
  if (!dt || isNaN(dt.getTime())) return "";
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Coerce an RHF text/number input value to a number, or `undefined` if blank/NaN. */
export function parseNum(v?: unknown): number | undefined {
  if (v === "" || v === null || v === undefined) return undefined;
  const n = typeof v === "number" ? v : parseFloat(String(v).trim());
  return isNaN(n) ? undefined : n;
}
