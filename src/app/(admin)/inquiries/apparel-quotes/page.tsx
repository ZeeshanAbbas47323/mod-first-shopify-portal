"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { FileText, Loader2, Mail, Phone, Search } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { fetchAllPages } from "@/lib/export";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MultiSelectFilter } from "@/components/multi-select-filter";
import { SummaryStatStrip, type SummaryTile } from "@/components/summary-stat-strip";
import { DataTable, type ColumnFilterDef } from "@/components/data-table";
import { ExportMenu } from "@/components/export-menu";
import { DateRangePicker } from "@/components/date-range-picker";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { apiErrorMessage } from "@/lib/auth-api";
import { fileUrl } from "@/lib/utils";
import {
  INQUIRY_STATUSES,
  INQUIRY_STATUS_LABELS,
  listApparelQuoteRequests,
  getApparelQuoteRequestsSummary,
  updateApparelQuoteRequest,
  type InquiryStatus,
  type ApparelQuoteRequestRow,
  type ApparelQuoteRequestsSummary,
} from "@/lib/admin-api";
import { STATUS_TONES } from "@/app/(admin)/inquiries/page";

const DEFAULT_PAGE_SIZE = 15;
const EXPORT_CAP = 5000;
const EMPTY_SUMMARY: ApparelQuoteRequestsSummary = {
  total: 0, new: 0, in_progress: 0, resolved: 0,
};

const fmtWhen = (v?: string | null) => {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "—" : format(d, "MMM d, yyyy · h:mm a");
};

const fmtDate = (v?: string | null) => {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "—" : format(d, "MMM d, yyyy");
};

/** Checkbox groups arrive as JSON arrays; render them as a readable list. */
const list = (value?: string[] | null) =>
  Array.isArray(value) && value.length ? value.join(", ") : "";

const COLUMN_FILTERS: Record<string, ColumnFilterDef> = {
  full_name: { type: "text", placeholder: "Search names" },
  status: { type: "select", options: INQUIRY_STATUSES, placeholder: "Any" },
};

const exportColumns = [
  { key: "full_name", label: "Name", value: (r: ApparelQuoteRequestRow) => r.full_name },
  { key: "business_name", label: "Business", value: (r: ApparelQuoteRequestRow) => r.business_name ?? "" },
  { key: "email", label: "Email", value: (r: ApparelQuoteRequestRow) => r.email },
  { key: "phone", label: "Phone", value: (r: ApparelQuoteRequestRow) => `${r.phone_country_code ?? ""}${r.phone ?? ""}` },
  { key: "order_types", label: "Order type", value: (r: ApparelQuoteRequestRow) => list(r.order_types) },
  { key: "garment_types", label: "Garments", value: (r: ApparelQuoteRequestRow) => list(r.garment_types) },
  { key: "quantity", label: "Quantity", value: (r: ApparelQuoteRequestRow) => r.quantity ?? "" },
  { key: "print_locations", label: "Print locations", value: (r: ApparelQuoteRequestRow) => list(r.print_locations) },
  { key: "personalization", label: "Personalization", value: (r: ApparelQuoteRequestRow) => r.personalization ?? "" },
  { key: "date_needed", label: "Date needed", value: (r: ApparelQuoteRequestRow) => r.date_needed ?? "" },
  { key: "delivery_method", label: "Delivery", value: (r: ApparelQuoteRequestRow) => r.delivery_method ?? "" },
  { key: "status", label: "Status", value: (r: ApparelQuoteRequestRow) => INQUIRY_STATUS_LABELS[r.status ?? "new"] ?? r.status ?? "" },
  { key: "created_at", label: "Requested", value: (r: ApparelQuoteRequestRow) => r.created_at ?? "" },
];

export default function ApparelQuoteRequestsPage() {
  const [rows, setRows] = React.useState<ApparelQuoteRequestRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(0);
  const [pageSize, setPageSize] = React.useState<number>(DEFAULT_PAGE_SIZE);
  const [pageCount, setPageCount] = React.useState(1);
  const [total, setTotal] = React.useState(0);

  const [selected, setSelected] = React.useState<ApparelQuoteRequestRow[]>([]);
  const [clearKey, setClearKey] = React.useState(0);
  const [summary, setSummary] = React.useState<ApparelQuoteRequestsSummary>(EMPTY_SUMMARY);
  const [summaryLoading, setSummaryLoading] = React.useState(true);

  const [name, setName] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [statuses, setStatuses] = React.useState<string[]>([]);
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
  const [refreshKey, setRefreshKey] = React.useState(0);

  const [detail, setDetail] = React.useState<ApparelQuoteRequestRow | null>(null);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(name), 400);
    return () => clearTimeout(t);
  }, [name]);

  React.useEffect(() => {
    setPage(0);
  }, [debounced, statuses, dateRange]);

  const activeFilters = React.useMemo(
    () => ({
      dateRange,
      full_name: debounced ? { contains: debounced } : undefined,
      status: statuses.length ? statuses : undefined,
    }),
    [dateRange, debounced, statuses]
  );

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listApparelQuoteRequests({
      page: page + 1,
      limit: pageSize,
      dateRange: activeFilters.dateRange,
      filters: { full_name: activeFilters.full_name, status: activeFilters.status },
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
        toast.error(apiErrorMessage(error, "Couldn't load quote requests."));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, activeFilters, refreshKey]);

  React.useEffect(() => {
    let cancelled = false;
    setSummaryLoading(true);
    getApparelQuoteRequestsSummary(activeFilters)
      .then((s) => !cancelled && setSummary(s))
      .catch(() => !cancelled && setSummary(EMPTY_SUMMARY))
      .finally(() => !cancelled && setSummaryLoading(false));
    return () => { cancelled = true; };
  }, [activeFilters]);

  const fetchAllForExport = async () =>
    fetchAllPages((page, limit) => listApparelQuoteRequests({
      page, limit, dateRange: activeFilters.dateRange,
      filters: { full_name: activeFilters.full_name, status: activeFilters.status },
    }), EXPORT_CAP);

  const columns = React.useMemo<ColumnDef<ApparelQuoteRequestRow>[]>(
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
        accessorKey: "full_name",
        header: "Customer",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{row.original.full_name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {row.original.business_name || row.original.email}
            </p>
          </div>
        ),
      },
      {
        id: "garments",
        header: "Garments",
        cell: ({ row }) => (
          <p className="max-w-64 truncate text-sm">
            {list(row.original.garment_types) || "—"}
          </p>
        ),
      },
      {
        accessorKey: "quantity",
        header: () => <div className="text-right">Qty</div>,
        cell: ({ row }) => (
          <div className="text-right tabular-nums">
            {row.original.quantity || "—"}
          </div>
        ),
      },
      {
        id: "artwork",
        header: "Artwork",
        cell: ({ row }) =>
          row.original.artwork_url ? (
            <StatusBadge status="Attached" tone="info" />
          ) : (
            <StatusBadge status="None" tone="neutral" />
          ),
      },
      {
        accessorKey: "date_needed",
        header: "Needed by",
        cell: ({ row }) => fmtDate(row.original.date_needed),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const s = row.original.status ?? "new";
          return (
            <StatusBadge
              status={INQUIRY_STATUS_LABELS[s] ?? s}
              tone={STATUS_TONES[s] ?? "neutral"}
            />
          );
        },
      },
      {
        accessorKey: "created_at",
        header: "Requested",
        cell: ({ row }) => fmtWhen(row.original.created_at),
      },
    ],
    []
  );

  const tiles: SummaryTile[] = [
    { label: "Total", value: summary.total.toLocaleString("en-US") },
    { label: "New", value: summary.new.toLocaleString("en-US") },
    { label: "In progress", value: summary.in_progress.toLocaleString("en-US") },
    { label: "Resolved", value: summary.resolved.toLocaleString("en-US") },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Apparel quotes</h1>
          <p className="text-sm text-muted-foreground">
            Custom apparel quote requests from the storefront form.
          </p>
        </div>
        <ExportMenu
          filename="apparel-quote-requests"
          columns={exportColumns}
          selected={selected}
          fetchAll={fetchAllForExport}
          total={total}
          noun="request"
        />
      </div>

      <SummaryStatStrip tiles={tiles} loading={summaryLoading} />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-44 flex-1 sm:max-w-56">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Search by name"
            className="bg-card pl-8"
          />
        </div>
        <MultiSelectFilter label="Status" options={INQUIRY_STATUSES} value={statuses} onChange={setStatuses} />
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-3 py-2">
          <span className="text-sm font-medium">
            {selected.length} request{selected.length === 1 ? "" : "s"} selected
          </span>
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
        onRefresh={() => setRefreshKey((k) => k + 1)}
        columns={columns}
        data={rows}
        loading={loading}
        onSelectionChange={setSelected}
        clearSelectionKey={clearKey}
        onRowClick={setDetail}
        columnFilterDefs={COLUMN_FILTERS}
        serverPagination={{
          pageIndex: page,
          pageCount,
          total,
          onPageChange: setPage,
          pageSize,
          onPageSizeChange: setPageSize,
        }}
      />

      <RequestDialog
        request={detail}
        onClose={() => setDetail(null)}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium break-words">{value || "—"}</p>
    </div>
  );
}

function RequestDialog({
  request,
  onClose,
  onSaved,
}: {
  request: ApparelQuoteRequestRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [status, setStatus] = React.useState<InquiryStatus>("new");
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!request) return;
    setStatus((request.status ?? "new") as InquiryStatus);
    setNotes(request.admin_notes ?? "");
  }, [request]);

  const submit = async () => {
    if (!request) return;
    setSaving(true);
    try {
      toast.success(
        await updateApparelQuoteRequest(request.id, {
          status,
          admin_notes: notes.trim() || undefined,
        })
      );
      onClose();
      onSaved();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't update the request."));
    } finally {
      setSaving(false);
    }
  };

  const phone = request
    ? `${request.phone_country_code ?? ""}${request.phone ?? ""}`.trim()
    : "";

  return (
    <Dialog open={!!request} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{request?.full_name ?? "Quote request"}</DialogTitle>
          <DialogDescription>
            {request ? fmtWhen(request.created_at) : ""}
          </DialogDescription>
        </DialogHeader>

        {request && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <a
                href={`mailto:${request.email}`}
                className="flex items-center gap-1.5 text-link hover:underline"
              >
                <Mail className="size-3.5" />
                {request.email}
              </a>
              {phone && (
                <a
                  href={`tel:${phone}`}
                  className="flex items-center gap-1.5 text-link hover:underline"
                >
                  <Phone className="size-3.5" />
                  {phone}
                </a>
              )}
            </div>

            <div className="grid gap-3 rounded-xl border border-border p-3 text-sm sm:grid-cols-2">
              <Field label="Business" value={request.business_name} />
              <Field label="Quantity" value={request.quantity} />
              <Field label="Order type" value={list(request.order_types)} />
              <Field label="Garment type(s)" value={list(request.garment_types)} />
              <Field label="Garment colour(s)" value={request.garment_colors} />
              <Field label="Size breakdown" value={request.size_breakdown} />
              <Field label="Print locations" value={list(request.print_locations)} />
              <Field label="Personalization" value={request.personalization} />
              <Field label="Artwork status" value={list(request.artwork_status)} />
              <Field label="Date needed" value={fmtDate(request.date_needed)} />
              <Field label="Delivery method" value={request.delivery_method} />
            </div>

            {request.project_details ? (
              <div className="space-y-1.5">
                <Label>Project details</Label>
                <p className="whitespace-pre-wrap rounded-xl border border-border p-3 text-sm">
                  {request.project_details}
                </p>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label>Artwork</Label>
              {request.artwork_url ? (
                <Button
                  variant="outline"
                  size="sm"
                  render={
                    <a
                      href={fileUrl(request.artwork_url)}
                      target="_blank"
                      rel="noreferrer"
                    />
                  }
                >
                  <FileText className="size-3.5" />
                  Open uploaded file
                </Button>
              ) : (
                <EmptyState
                  title="No artwork attached"
                  hint="The customer did not upload a file with this request."
                  className="rounded-xl border border-border py-6"
                />
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                items={INQUIRY_STATUS_LABELS}
                value={status}
                onValueChange={(v) => setStatus(v as InquiryStatus)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INQUIRY_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {INQUIRY_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="apparel-quote-notes">Internal notes</Label>
              <Textarea
                id="apparel-quote-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Quoted $1,240 — awaiting artwork approval"
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
