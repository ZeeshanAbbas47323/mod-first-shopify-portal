"use client";

import * as React from "react";
import { format as formatDate } from "date-fns";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiErrorMessage } from "@/lib/auth-api";
import { exportRows, type ExportColumn, type ExportFormat } from "@/lib/export";

const FORMATS: { format: ExportFormat; label: string; Icon: typeof FileText }[] = [
  { format: "xlsx", label: "Excel (.xlsx)", Icon: FileSpreadsheet },
  { format: "csv", label: "CSV (.csv)", Icon: FileText },
];

/**
 * Format picker for tables that build their own rows — an export that depends
 * on the visible tab, say. The caller keeps its own export function and just
 * learns which format was picked.
 */
export function ExportFormatMenu({
  onSelect,
  busy = false,
  disabled = false,
  label = "Export",
  variant = "outline",
  size,
  className,
}: {
  onSelect: (format: ExportFormat) => void;
  busy?: boolean;
  disabled?: boolean;
  label?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={busy || disabled}
        render={
          <Button variant={variant} size={size} className={className}>
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            {label}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-48">
        {FORMATS.map(({ format, label: formatLabel, Icon }) => (
          <DropdownMenuItem key={format} onClick={() => onSelect(format)}>
            <Icon className="size-4" />
            {formatLabel}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface ExportMenuProps<T> {
  /** Base file name; the current date is appended automatically. */
  filename: string;
  columns: ExportColumn<T>[];
  /** Rows the user has ticked. Omit on tables without selection. */
  selected?: T[];
  /** Fetches every row matching the active filters, ignoring pagination. */
  fetchAll: () => Promise<T[]>;
  /** Total matching rows, shown alongside the format choices. */
  total?: number;
  /** Singular noun for messages, e.g. "customer" → "3 customers exported". */
  noun?: string;
  /** Plural form, for the nouns an "s" doesn't fit ("category" → "categories"). */
  nounPlural?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
}

/**
 * Exports every row matching the current filters, not just the loaded page —
 * so what the table is filtered to is what lands in the file.
 */
export function ExportMenu<T>({
  filename,
  columns,
  selected = [],
  fetchAll,
  total,
  noun = "row",
  nounPlural,
  variant = "outline",
  size,
  className,
}: ExportMenuProps<T>) {
  const [busy, setBusy] = React.useState(false);
  const plural = nounPlural ?? `${noun}s`;

  const run = async (format: ExportFormat, scope: "all" | "selected" = "all") => {
    setBusy(true);
    try {
      const rows = scope === "selected" ? selected : await fetchAll();
      if (!rows.length) {
        toast.error("Nothing to export.");
        return;
      }
      await exportRows(
        format,
        `${filename}-${formatDate(new Date(), "yyyy-MM-dd")}`,
        columns,
        rows
      );
      toast.success(`Exported ${rows.length} ${rows.length === 1 ? noun : plural}.`);
    } catch (error) {
      toast.error(apiErrorMessage(error, `Couldn't export ${plural}.`));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={busy}
        render={
          <Button variant={variant} size={size} className={className}>
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Export
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-60">
        {selected.length > 0 && (
          <>
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              {selected.length} selected
            </DropdownMenuLabel>
            {FORMATS.map(({ format, label, Icon }) => (
              <DropdownMenuItem
                key={`selected-${format}`}
                onClick={() => run(format, "selected")}
              >
                <Icon className="size-4" />
                {label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          All {plural}
          {total != null ? ` (${total})` : ""}
        </DropdownMenuLabel>
        {FORMATS.map(({ format, label, Icon }) => (
          <DropdownMenuItem key={`all-${format}`} onClick={() => run(format)}>
            <Icon className="size-4" />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
