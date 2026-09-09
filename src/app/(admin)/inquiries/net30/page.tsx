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
import { apiErrorMessage } from "@/lib/auth-api";
import { fileUrl } from "@/lib/utils";
import {
  INQUIRY_STATUSES,
  INQUIRY_STATUS_LABELS,
  listNet30Applications,
  getNet30ApplicationsSummary,
  updateNet30Application,
  type InquiryStatus,
  type Net30ApplicationRow,
  type Net30ApplicationsSummary,
} from "@/lib/admin-api";
import { STATUS_TONES } from "@/app/(admin)/inquiries/page";

const DEFAULT_PAGE_SIZE = 15;
const EXPORT_CAP = 5000;
const EMPTY_SUMMARY: Net30ApplicationsSummary = { total: 0, new: 0, in_progress: 0, resolved: 0, total_requested_credit: 0 };

const money = (v?: number | string | null) =>
  v != null
    ? Number(v).toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      })
    : "—";

const fmtWhen = (v?: string) => {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "—" : format(d, "MMM d, yyyy · h:mm a");
};

const COLUMN_FILTERS: Record<string, ColumnFilterDef> = {
  company_name: { type: "text", placeholder: "Search companies" },
  status: { type: "select", options: INQUIRY_STATUSES, placeholder: "Any" },
};

const exportColumns = [
  { key: "company_name", label: "Company", value: (r: Net30ApplicationRow) => r.company_name },
  { key: "company_tax_id", label: "Tax ID", value: (r: Net30ApplicationRow) => r.company_tax_id ?? "" },
  { key: "contact", label: "Contact", value: (r: Net30ApplicationRow) => `${r.first_name} ${r.last_name}` },
  { key: "email", label: "Email", value: (r: Net30ApplicationRow) => r.email },
  { key: "years_in_business", label: "Years", value: (r: Net30ApplicationRow) => r.years_in_business ?? "" },
  { key: "requested_credit_amount", label: "Requested", value: (r: Net30ApplicationRow) => r.requested_credit_amount ?? "" },
  { key: "status", label: "Status", value: (r: Net30ApplicationRow) => INQUIRY_STATUS_LABELS[r.status ?? "new"] ?? r.status ?? "" },
  { key: "created_at", label: "Applied", value: (r: Net30ApplicationRow) => r.created_at ?? "" },
];

export default function Net30ApplicationsPage() {
  const [rows, setRows] = React.useState<Net30ApplicationRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(0);
  const [pageSize, setPageSize] = React.useState<number>(DEFAULT_PAGE_SIZE);
  const [pageCount, setPageCount] = React.useState(1);
  const [total, setTotal] = React.useState(0);

  const [selected, setSelected] = React.useState<Net30ApplicationRow[]>([]);
  const [clearKey, setClearKey] = React.useState(0);
  const [summary, setSummary] = React.useState<Net30ApplicationsSummary>(EMPTY_SUMMARY);
  const [summaryLoading, setSummaryLoading] = React.useState(true);

  const [company, setCompany] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [statuses, setStatuses] = React.useState<string[]>([]);
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
  const [refreshKey, setRefreshKey] = React.useState(0);

  const [detail, setDetail] = React.useState<Net30ApplicationRow | null>(null);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(company), 400);
    return () => clearTimeout(t);
  }, [company]);

  React.useEffect(() => {
    setPage(0);
  }, [debounced, statuses, dateRange]);

  const activeFilters = React.useMemo(
    () => ({
      dateRange,
      company_name: debounced ? { contains: debounced } : undefined,
      status: statuses.length ? statuses : undefined,
    }),
    [dateRange, debounced, statuses]
  );

  const columnFilterValues = React.useMemo(() => {
    const values: Record<string, string[]> = {};
    if (company) values.company_name = [company];
    if (statuses.length) values.status = statuses;
    return values;
  }, [company, statuses]);

  const applyColumnFilters = React.useCallback(
    (next: Record<string, string[]>) => {
      setCompany(next.company_name?.[0] ?? "");
      setStatuses(next.status ?? []);
    },
    []
  );

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listNet30Applications({
      page: page + 1,
      limit: pageSize,
      dateRange: activeFilters.dateRange,
      filters: { company_name: activeFilters.company_name, status: activeFilters.status },
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
        toast.error(apiErrorMessage(error, "Couldn't load applications."));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, activeFilters, refreshKey]);

  React.useEffect(() => {
    let cancelled = false;
    setSummaryLoading(true);
    getNet30ApplicationsSummary(activeFilters)
      .then((s) => !cancelled && setSummary(s))
      .catch(() => !cancelled && setSummary(EMPTY_SUMMARY))
      .finally(() => !cancelled && setSummaryLoading(false));
    return () => { cancelled = true; };
  }, [activeFilters]);

  const fetchAllForExport = async () =>
    fetchAllPages((page, limit) => listNet30Applications({
                page, limit, dateRange: activeFilters.dateRange,
                filters: { company_name: activeFilters.company_name, status: activeFilters.status },
              }), EXPORT_CAP);

  const columns = React.useMemo<ColumnDef<Net30ApplicationRow>[]>(
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
        accessorKey: "company_name",
        header: "Company",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{row.original.company_name}</p>
            <p className="truncate text-xs text-muted-foreground">
              Tax ID {row.original.company_tax_id ?? "—"}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "first_name",
        header: "Contact",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate">
              {row.original.first_name} {row.original.last_name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {row.original.email}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "years_in_business",
        header: () => <div className="text-right">Years</div>,
        cell: ({ row }) => (
          <div className="text-right tabular-nums">
            {row.original.years_in_business ?? "—"}
          </div>
        ),
      },
      {
        accessorKey: "requested_credit_amount",
        header: () => <div className="text-right">Requested</div>,
        cell: ({ row }) => (
          <div className="text-right font-medium tabular-nums">
            {money(row.original.requested_credit_amount)}
          </div>
        ),
      },
      {
        id: "docs",
        header: "Documents",
        cell: ({ row }) => {
          const count =
            (row.original.resale_certificate_url ? 1 : 0) +
            (row.original.business_license_url ? 1 : 0);
          return count ? (
            <StatusBadge status={`${count} attached`} tone="info" />
          ) : (
            <StatusBadge status="None" tone="neutral" />
          );
        },
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
        header: "Applied",
        cell: ({ row }) => fmtWhen(row.original.created_at),
      },
    ],
    []
  );

  const tiles: SummaryTile[] = [
    { label: "Total", value: summary.total.toLocaleString("en-US") },
    { label: "New", value: summary.new.toLocaleString("en-US") },
    { label: "In progress", value: summary.in_progress.toLocaleString("en-US") },
    { label: "Requested credit", value: money(summary.total_requested_credit) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Net 30 applications</h1>
          <p className="text-sm text-muted-foreground">
            Business credit applications from the Net 30 club form.
          </p>
        </div>
        <ExportMenu
          filename="net30-applications"
          columns={exportColumns}
          selected={selected}
          fetchAll={fetchAllForExport}
          total={total}
          noun="application"
        />
      </div>

      <SummaryStatStrip tiles={tiles} loading={summaryLoading} />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-44 flex-1 sm:max-w-56">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Search by company"
            className="bg-card pl-8"
          />
        </div>
        <MultiSelectFilter label="Status" options={INQUIRY_STATUSES} value={statuses} onChange={setStatuses} />
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-3 py-2">
          <span className="text-sm font-medium">
            {selected.length} application{selected.length === 1 ? "" : "s"} selected
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

      <ApplicationDialog
        application={detail}
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
      <p className="font-medium">{value}</p>
    </div>
  );
}

function ApplicationDialog({
  application,
  onClose,
  onSaved,
}: {
  application: Net30ApplicationRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [status, setStatus] = React.useState<InquiryStatus>("new");
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!application) return;
    setStatus((application.status ?? "new") as InquiryStatus);
    setNotes(application.admin_notes ?? "");
  }, [application]);

  const submit = async () => {
    if (!application) return;
    setSaving(true);
    try {
      toast.success(
        await updateNet30Application(application.id, {
          status,
          admin_notes: notes.trim() || undefined,
        })
      );
      onClose();
      onSaved();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't update the application."));
    } finally {
      setSaving(false);
    }
  };

  const phone = application
    ? `${application.phone_country_code ?? ""}${application.phone ?? ""}`.trim()
    : "";

  return (
    <Dialog open={!!application} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{application?.company_name ?? "Application"}</DialogTitle>
          <DialogDescription>
            {application ? fmtWhen(application.created_at) : ""}
          </DialogDescription>
        </DialogHeader>

        {application && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-border p-3 text-sm">
              <Field
                label="Contact"
                value={`${application.first_name} ${application.last_name}`}
              />
              <Field label="Tax ID" value={application.company_tax_id ?? "—"} />
              <Field
                label="Years in business"
                value={application.years_in_business ?? "—"}
              />
              <Field
                label="Requested credit"
                value={money(application.requested_credit_amount)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm">
              <a
                href={`mailto:${application.email}`}
                className="flex items-center gap-1.5 text-[#005bd3] hover:underline"
              >
                <Mail className="size-3.5" />
                {application.email}
              </a>
              {phone && (
                <a
                  href={`tel:${phone}`}
                  className="flex items-center gap-1.5 text-[#005bd3] hover:underline"
                >
                  <Phone className="size-3.5" />
                  {phone}
                </a>
              )}
            </div>

            {(application.resale_certificate_url || application.business_license_url) && (
              <div className="space-y-1.5">
                <Label>Documents</Label>
                <div className="flex flex-wrap gap-2">
                  {application.resale_certificate_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      render={
                        <a
                          href={fileUrl(application.resale_certificate_url)}
                          target="_blank"
                          rel="noreferrer"
                        />
                      }
                    >
                      <FileText className="size-3.5" />
                      Resale certificate
                    </Button>
                  )}
                  {application.business_license_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      render={
                        <a
                          href={fileUrl(application.business_license_url)}
                          target="_blank"
                          rel="noreferrer"
                        />
                      }
                    >
                      <FileText className="size-3.5" />
                      Business license
                    </Button>
                  )}
                </div>
              </div>
            )}

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
              <Label htmlFor="net30-notes">Internal notes</Label>
              <Textarea
                id="net30-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Approved $5000 credit line"
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
