import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function apiOrigin(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? "")
    .replace(/\/api\/.*$/, "")
    .replace(/\/$/, "");
}

const UPLOAD_BASE_KEY = "modefirst-upload-base";
let learnedUploadBase: string | null = null;

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
    }
  }
  return apiOrigin();
}

export function fileUrl(src?: string | null): string {
  if (!src) return "";
  if (/^(https?:|data:|blob:)/.test(src)) return src;
  const base = uploadBase();
  return `${base}${src.startsWith("/") ? "" : "/"}${src}`;
}

export function imgUrl(src?: string | null): string {
  return fileUrl(src);
}

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

export function toLocalDateInput(value?: string | Date | null): string {
  if (!value) return "";
  const dt = typeof value === "string" ? parseServerDate(value) : value;
  if (!dt || isNaN(dt.getTime())) return "";
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseNum(v?: unknown): number | undefined {
  if (v === "" || v === null || v === undefined) return undefined;
  const n = typeof v === "number" ? v : parseFloat(String(v).trim());
  return isNaN(n) ? undefined : n;
}

export {
  exportRows,
  exportRowsToCsv,
  exportRowsToExcel,
  type ExportColumn,
  type ExportFormat,
} from "./export";
