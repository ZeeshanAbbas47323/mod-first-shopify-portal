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
  filename: string;
  columns: ExportColumn<T>[];
  selected?: T[];
  fetchAll: () => Promise<T[]>;
  total?: number;
  noun?: string;
  nounPlural?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
}

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
