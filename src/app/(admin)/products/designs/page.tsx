"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Download, FileImage, Loader2, Search } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { MultiSelectFilter } from "@/components/multi-select-filter";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DataTable, type ColumnFilterDef } from "@/components/data-table";
import { ExportMenu } from "@/components/export-menu";
import { DateRangePicker } from "@/components/date-range-picker";
import { StatusBadge, type BadgeTone } from "@/components/status-badge";
import { apiErrorMessage } from "@/lib/auth-api";
import { fileUrl, imgUrl } from "@/lib/utils";
import {
  listDesignUploads,
  updateDesignUpload,
  type DesignUploadRow,
} from "@/lib/admin-api";
import { PRINT_METHODS } from "@/lib/pos-api";

const DEFAULT_PAGE_SIZE = 20;
const EXPORT_CAP = 5000;

const DESIGN_STATUSES = ["pending", "approved", "rejected"] as const;

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
};

const STATUS_TONES: Record<string, BadgeTone> = {
  pending: "attention",
  approved: "success",
  rejected: "critical",
};

const isImage = (row: DesignUploadRow) =>
  /\.(png|jpe?g|webp|gif|svg)$/i.test(row.file_url ?? "") ||
  (row.file_type ?? "").startsWith("image/");

const designCustomerName = (row: DesignUploadRow) =>
  row.user?.full_name ?? row.user?.name ?? (row.user_id != null ? `User #${row.user_id}` : "—");

/** Filter controls rendered under each column header. */
const COLUMN_FILTERS: Record<string, ColumnFilterDef> = {
  order_id: { type: "text", placeholder: "Order ID" },
  print_method: { type: "select", options: PRINT_METHODS, placeholder: "Any" },
  status: { type: "select", options: DESIGN_STATUSES, placeholder: "Any" },
};

const exportColumns = [
  { key: "file_name", label: "Artwork", value: (r: DesignUploadRow) => r.file_name ?? `Design #${r.id}` },
  { key: "customer", label: "Customer", value: (r: DesignUploadRow) => designCustomerName(r) },
  { key: "order_id", label: "Order", value: (r: DesignUploadRow) => (r.order_id != null ? `#${r.order_id}` : "") },
  { key: "print_method", label: "Method", value: (r: DesignUploadRow) => r.print_method ?? "" },
  { key: "status", label: "Status", value: (r: DesignUploadRow) => (r.status ? STATUS_LABELS[r.status] ?? r.status : "") },
  { key: "created_at", label: "Uploaded", value: (r: DesignUploadRow) => r.created_at ?? "" },
];

export default function DesignUploadsPage() {
  const [rows, setRows] = React.useState<DesignUploadRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(0);
  const [pageSize, setPageSize] = React.useState<number>(DEFAULT_PAGE_SIZE);
  const [pageCount, setPageCount] = React.useState(1);
  const [total, setTotal] = React.useState(0);

  const [selected, setSelected] = React.useState<DesignUploadRow[]>([]);
  const [clearKey, setClearKey] = React.useState(0);

  const [orderId, setOrderId] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [statuses, setStatuses] = React.useState<string[]>([]);
  const [methods, setMethods] = React.useState<string[]>([]);
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
  const [refreshKey, setRefreshKey] = React.useState(0);

  const [detail, setDetail] = React.useState<DesignUploadRow | null>(null);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(orderId), 400);
    return () => clearTimeout(t);
  }, [orderId]);

  React.useEffect(() => {
    setPage(0);
  }, [debounced, statuses, methods, dateRange]);

  const activeFilters = React.useMemo(
    () => ({
      dateRange,
      order_id: debounced ? Number(debounced) : undefined,
      status: statuses.length ? statuses : undefined,
      print_method: methods.length ? methods : undefined,
    }),
    [dateRange, debounced, statuses, methods]
  );

  /**
   * The header filter row edits the same state as the filter bar above it,
   * so a pick in one shows up in the other instead of silently competing.
   */
  const columnFilterValues = React.useMemo(() => {
    const values: Record<string, string[]> = {};
    if (orderId) values.order_id = [orderId];
    if (methods.length) values.print_method = methods;
    if (statuses.length) values.status = statuses;
    return values;
  }, [orderId, methods, statuses]);

  const applyColumnFilters = React.useCallback(
    (next: Record<string, string[]>) => {
      setOrderId(next.order_id?.[0] ?? "");
      setMethods(next.print_method ?? []);
      setStatuses(next.status ?? []);
    },
    []
  );

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listDesignUploads({
      page: page + 1,
      limit: pageSize,
      dateRange: activeFilters.dateRange,
      // order_id resolves through the OrderItemDesign join, so it's a
      // top-level input rather than a column filter.
      order_id: activeFilters.order_id,
      filters: {
        status: activeFilters.status,
        print_method: activeFilters.print_method,
      },
    })
      .then((res) => {
        if (cancelled) return;
        setRows(res.rows);
        setTotal(res.total);
        setPageCount(res.totalPages);
      })
      .catch((error) => {
        if (cancelled) return;
        setRows([]);
        toast.error(apiErrorMessage(error, "Couldn't load design uploads."));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, activeFilters, refreshKey]);

  const fetchAllForExport = async () =>
    (
              await listDesignUploads({
                page: 1, limit: EXPORT_CAP,
                dateRange: activeFilters.dateRange,
                order_id: activeFilters.order_id,
                filters: { status: activeFilters.status, print_method: activeFilters.print_method },
              })
            ).rows;

  const columns = React.useMemo<ColumnDef<DesignUploadRow>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(!!v)}
            onClick={(e) => e.stopPropagation()}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "file_name",
        header: "Artwork",
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-2.5">
            {isImage(row.original) && row.original.file_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imgUrl(row.original.file_url)}
                alt=""
                className="size-10 rounded-lg border border-border object-cover"
              />
            ) : (
              <span className="flex size-10 items-center justify-center rounded-lg border border-border bg-muted">
                <FileImage className="size-4 text-muted-foreground" />
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate font-medium">
                {row.original.file_name ?? `Design #${row.original.id}`}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {row.original.file_type ?? "—"}
              </p>
            </div>
          </div>
        ),
      },
      {
        accessorKey: "user_id",
        header: "Customer",
        cell: ({ row }) =>
          row.original.user?.full_name ??
          row.original.user?.name ??
          (row.original.user_id != null ? `User #${row.original.user_id}` : "—"),
      },
      {
        accessorKey: "order_id",
        header: "Order",
        cell: ({ row }) =>
          row.original.order_id != null ? (
            <span className="font-mono text-xs">#{row.original.order_id}</span>
          ) : (
            "—"
          ),
      },
      {
        accessorKey: "print_method",
        header: "Method",
        cell: ({ row }) =>
          row.original.print_method
            ? row.original.print_method.replace(/_/g, " ").toUpperCase()
            : "—",
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const s = row.original.status ?? "approved";
          return (
            <StatusBadge
              status={STATUS_LABELS[s] ?? s}
              tone={STATUS_TONES[s] ?? "neutral"}
            />
          );
        },
      },
      {
        accessorKey: "created_at",
        header: "Uploaded",
        cell: ({ row }) => {
          const d = row.original.created_at;
          if (!d) return "—";
          const date = new Date(d);
          return isNaN(date.getTime()) ? "—" : format(date, "MMM d, yyyy");
        },
      },
    ],
    []
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Design uploads</h1>
          <p className="text-sm text-muted-foreground">
            Artwork customers sent in — review it before it goes to production.
          </p>
        </div>
        <ExportMenu
          filename="design-uploads"
          columns={exportColumns}
          selected={selected}
          fetchAll={fetchAllForExport}
          total={total}
          noun="upload"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-40 sm:max-w-44">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={orderId}
            onChange={(e) => setOrderId(e.target.value.replace(/\D/g, ""))}
            placeholder="Order ID"
            inputMode="numeric"
            className="bg-card pl-8"
          />
        </div>
        <MultiSelectFilter label="Method" options={PRINT_METHODS} value={methods} onChange={setMethods} />
        <MultiSelectFilter label="Status" options={DESIGN_STATUSES} value={statuses} onChange={setStatuses} />
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-3 py-2">
          <span className="text-sm font-medium">
            {selected.length} design{selected.length === 1 ? "" : "s"} selected
          </span>
          <ExportMenu
            filename="design-uploads"
            columns={exportColumns}
            selected={selected}
            fetchAll={fetchAllForExport}
            total={total}
            noun="upload"
            size="sm"
          />
          <button
            type="button"
            onClick={() => setClearKey((k) => k + 1)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear selection
          </button>
        </div>
      )}

      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        onSelectionChange={setSelected}
        clearSelectionKey={clearKey}
        onRowClick={setDetail}
        columnFilterDefs={COLUMN_FILTERS}
        serverColumnFilters={{ value: columnFilterValues, onChange: applyColumnFilters }}
        serverPagination={{
          pageIndex: page,
          pageCount,
          total,
          onPageChange: setPage,
          pageSize,
          onPageSizeChange: setPageSize,
        }}
      />

      <DesignDialog
        design={detail}
        onClose={() => setDetail(null)}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}

// ─── Review dialog ────────────────────────────────────────────────────────────

function DesignDialog({
  design,
  onClose,
  onSaved,
}: {
  design: DesignUploadRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [status, setStatus] = React.useState("approved");
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!design) return;
    setStatus(design.status ?? "approved");
    setNotes(design.notes ?? "");
  }, [design]);

  const submit = async () => {
    if (!design) return;
    setSaving(true);
    try {
      toast.success(
        await updateDesignUpload(design.id, {
          status,
          notes: notes.trim() || undefined,
        })
      );
      onClose();
      onSaved();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't update the design."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!design} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{design?.file_name ?? "Design"}</DialogTitle>
          <DialogDescription>
            {design?.user?.full_name ?? design?.user?.name ?? "Customer artwork"}
            {design?.order_id != null ? ` · order #${design.order_id}` : ""}
          </DialogDescription>
        </DialogHeader>

        {design && (
          <div className="space-y-4">
            {design.file_url && (
              <div className="overflow-hidden rounded-xl border border-border bg-muted/30">
                {isImage(design) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imgUrl(design.file_url)}
                    alt=""
                    className="max-h-72 w-full object-contain"
                  />
                ) : (
                  <p className="p-6 text-center text-sm text-muted-foreground">
                    Preview isn&apos;t available for this file type.
                  </p>
                )}
              </div>
            )}

            {design.file_url && (
              <Button
                variant="outline"
                size="sm"
                render={
                  <a href={fileUrl(design.file_url)} target="_blank" rel="noreferrer" download />
                }
              >
                <Download className="size-3.5" />
                Open original
              </Button>
            )}

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                items={STATUS_LABELS}
                value={status}
                onValueChange={(v) => setStatus(v as string)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DESIGN_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="design-notes">Notes</Label>
              <Textarea
                id="design-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Resolution too low — asked the customer for a 300 DPI file."
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
