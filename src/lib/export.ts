
import type { Cell, SheetData } from "write-excel-file/browser";

export interface ExportColumn<T> {
  key: string;
  label: string;
  value: (row: T) => unknown;
}

export type ExportFormat = "csv" | "xlsx";

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function withExtension(filename: string, ext: string): string {
  return filename.endsWith(`.${ext}`) ? filename : `${filename}.${ext}`;
}

export function exportRowsToCsv<T>(
  filename: string,
  columns: ExportColumn<T>[],
  rows: T[]
): void {
  const header = columns.map((c) => csvCell(c.label)).join(",");
  const lines = rows.map((row) =>
    columns.map((c) => csvCell(c.value(row))).join(",")
  );
  const csv = [header, ...lines].join("\r\n");
  triggerDownload(
    new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }),
    withExtension(filename, "csv")
  );
}

function excelCell(v: unknown): Cell {
  if (v === null || v === undefined || v === "") return { value: undefined };
  if (typeof v === "number") {
    return Number.isFinite(v) ? { type: Number, value: v } : { value: String(v) };
  }
  if (typeof v === "boolean") return { type: Boolean, value: v };
  if (v instanceof Date) {
    return isNaN(v.getTime())
      ? { value: undefined }
      : { type: Date, value: v, format: "yyyy-mm-dd hh:mm" };
  }
  return { type: String, value: String(v) };
}

export async function exportRowsToExcel<T>(
  filename: string,
  columns: ExportColumn<T>[],
  rows: T[]
): Promise<void> {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");

  const header: Cell[] = columns.map((c) => ({
    value: c.label,
    fontWeight: "bold",
  }));
  const body = rows.map((row) => columns.map((c) => excelCell(c.value(row))));
  const sheet: SheetData = [header, ...body];

  const blob = await writeXlsxFile(sheet, {
    columns: columns.map((c) => ({
      width: Math.min(Math.max(c.label.length + 6, 14), 40),
    })),
  }).toBlob();

  triggerDownload(blob, withExtension(filename, "xlsx"));
}

export async function exportRows<T>(
  format: ExportFormat,
  filename: string,
  columns: ExportColumn<T>[],
  rows: T[]
): Promise<void> {
  if (format === "xlsx") await exportRowsToExcel(filename, columns, rows);
  else exportRowsToCsv(filename, columns, rows);
}
