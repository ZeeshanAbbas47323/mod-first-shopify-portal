import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Prepend the API base origin to relative image paths, proxied to avoid CORP blocks. */
export function imgUrl(src?: string | null): string {
  if (!src) return "";
  if (src.startsWith("data:") || src.startsWith("blob:")) return src;
  const base = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/api\/.*$/, "").replace(/\/$/, "");
  const absolute = src.startsWith("http://") || src.startsWith("https://")
    ? src
    : `${base}${src.startsWith("/") ? "" : "/"}${src}`;
  // Proxy through Next.js to bypass Cross-Origin-Resource-Policy: same-origin
  return `/api/img?url=${encodeURIComponent(absolute)}`;
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
