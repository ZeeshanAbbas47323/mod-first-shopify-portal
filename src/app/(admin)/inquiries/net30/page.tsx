"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { FileText, Loader2, Mail, Phone, Search } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { DataTable } from "@/components/data-table";
import { DateRangePicker } from "@/components/date-range-picker";
import { StatusBadge } from "@/components/status-badge";
import { apiErrorMessage } from "@/lib/auth-api";
import {
  INQUIRY_STATUSES,
  INQUIRY_STATUS_LABELS,
  listNet30Applications,
  updateNet30Application,
  type InquiryStatus,
  type Net30ApplicationRow,
} from "@/lib/admin-api";
import { STATUS_TONES } from "@/app/(admin)/inquiries/page";

const PAGE_SIZE = 15;

const STATUS_FILTER_ITEMS: Record<string, string> = {
  all: "All statuses",
  ...INQUIRY_STATUS_LABELS,
};

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

export default function Net30ApplicationsPage() {
  const [rows, setRows] = React.useState<Net30ApplicationRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(0);
  const [pageCount, setPageCount] = React.useState(1);
  const [total, setTotal] = React.useState(0);

  const [company, setCompany] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
  const [refreshKey, setRefreshKey] = React.useState(0);

  const [detail, setDetail] = React.useState<Net30ApplicationRow | null>(null);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(company), 400);
    return () => clearTimeout(t);
  }, [company]);

  React.useEffect(() => {
    setPage(0);
  }, [debounced, status, dateRange]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listNet30Applications({
      page: page + 1,
      limit: PAGE_SIZE,
      dateRange,
      filters: {
        company_name: debounced || undefined,
        status: status === "all" ? undefined : status,
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
        toast.error(apiErrorMessage(error, "Couldn't load applications."));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, debounced, status, dateRange, refreshKey]);

  const columns = React.useMemo<ColumnDef<Net30ApplicationRow>[]>(
    () => [
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

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold">Net 30 applications</h1>
        <p className="text-sm text-muted-foreground">
          Business credit applications from the Net 30 club form.
        </p>
      </div>

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
        <Select items={STATUS_FILTER_ITEMS} value={status} onValueChange={(v) => setStatus(v as string)}>
          <SelectTrigger className="min-w-32 bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_FILTER_ITEMS).map(([v, label]) => (
              <SelectItem key={v} value={v}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        onRowClick={setDetail}
        serverPagination={{ pageIndex: page, pageCount, total, onPageChange: setPage }}
      />

      <ApplicationDialog
        application={detail}
        onClose={() => setDetail(null)}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}

// ─── Detail ───────────────────────────────────────────────────────────────────

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
                          href={application.resale_certificate_url}
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
                          href={application.business_license_url}
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
