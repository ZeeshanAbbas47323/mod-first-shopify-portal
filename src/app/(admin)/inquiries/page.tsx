"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Loader2, Mail, Phone, Search } from "lucide-react";
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MultiSelectFilter } from "@/components/multi-select-filter";
import { SummaryStatStrip, type SummaryTile } from "@/components/summary-stat-strip";
import { DataTable, type ColumnFilterDef } from "@/components/data-table";
import { ExportMenu } from "@/components/export-menu";
import { DateRangePicker } from "@/components/date-range-picker";
import { StatusBadge, type BadgeTone } from "@/components/status-badge";
import { apiErrorMessage } from "@/lib/auth-api";
import {
  HELP_TOPIC_LABELS,
  INQUIRY_STATUSES,
  INQUIRY_STATUS_LABELS,
  listContactSubmissions,
  getContactSubmissionsSummary,
  updateContactSubmission,
  type ContactSubmissionRow,
  type ContactSubmissionsSummary,
  type InquiryStatus,
} from "@/lib/admin-api";

const DEFAULT_PAGE_SIZE = 15;
const EXPORT_CAP = 5000;
const HELP_TOPICS = Object.keys(HELP_TOPIC_LABELS);
const EMPTY_SUMMARY: ContactSubmissionsSummary = { total: 0, new: 0, in_progress: 0, resolved: 0 };

/** Filter controls rendered under each column header. */
const COLUMN_FILTERS: Record<string, ColumnFilterDef> = {
  help_topic: { type: "select", options: HELP_TOPICS, placeholder: "Any" },
  status: { type: "select", options: INQUIRY_STATUSES, placeholder: "Any" },
};

const exportColumns = [
  { key: "name", label: "From", value: (r: ContactSubmissionRow) => `${r.first_name} ${r.last_name}` },
  { key: "email", label: "Email", value: (r: ContactSubmissionRow) => r.email },
  { key: "phone", label: "Phone", value: (r: ContactSubmissionRow) => r.phone ?? "" },
  { key: "help_topic", label: "Topic", value: (r: ContactSubmissionRow) => HELP_TOPIC_LABELS[r.help_topic ?? "other"] ?? r.help_topic ?? "" },
  { key: "message", label: "Message", value: (r: ContactSubmissionRow) => r.message },
  { key: "status", label: "Status", value: (r: ContactSubmissionRow) => INQUIRY_STATUS_LABELS[r.status ?? "new"] ?? r.status ?? "" },
  { key: "created_at", label: "Received", value: (r: ContactSubmissionRow) => r.created_at ?? "" },
];

export const STATUS_TONES: Record<string, BadgeTone> = {
  new: "attention",
  in_progress: "info",
  resolved: "success",
  archived: "neutral",
};

const fmtWhen = (v?: string) => {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "—" : format(d, "MMM d, yyyy · h:mm a");
};

export default function ContactSubmissionsPage() {
  const [rows, setRows] = React.useState<ContactSubmissionRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(0);
  const [pageSize, setPageSize] = React.useState<number>(DEFAULT_PAGE_SIZE);
  const [pageCount, setPageCount] = React.useState(1);
  const [total, setTotal] = React.useState(0);

  const [selected, setSelected] = React.useState<ContactSubmissionRow[]>([]);
  const [clearKey, setClearKey] = React.useState(0);
  const [summary, setSummary] = React.useState<ContactSubmissionsSummary>(EMPTY_SUMMARY);
  const [summaryLoading, setSummaryLoading] = React.useState(true);

  const [email, setEmail] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [statuses, setStatuses] = React.useState<string[]>([]);
  const [topics, setTopics] = React.useState<string[]>([]);
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
  const [refreshKey, setRefreshKey] = React.useState(0);

  const [detail, setDetail] = React.useState<ContactSubmissionRow | null>(null);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(email), 400);
    return () => clearTimeout(t);
  }, [email]);

  React.useEffect(() => {
    setPage(0);
  }, [debounced, statuses, topics, dateRange]);

  const activeFilters = React.useMemo(
    () => ({
      dateRange,
      email: debounced ? { contains: debounced } : undefined,
      status: statuses.length ? statuses : undefined,
      help_topic: topics.length ? topics : undefined,
    }),
    [dateRange, debounced, statuses, topics]
  );

  /**
   * The header filter row edits the same state as the filter bar above it,
   * so a pick in one shows up in the other instead of silently competing.
   */
  const columnFilterValues = React.useMemo(() => {
    const values: Record<string, string[]> = {};
    if (topics.length) values.help_topic = topics;
    if (statuses.length) values.status = statuses;
    return values;
  }, [topics, statuses]);

  const applyColumnFilters = React.useCallback(
    (next: Record<string, string[]>) => {
      setTopics(next.help_topic ?? []);
      setStatuses(next.status ?? []);
    },
    []
  );

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listContactSubmissions({
      page: page + 1,
      limit: pageSize,
      dateRange: activeFilters.dateRange,
      filters: { email: activeFilters.email, status: activeFilters.status, help_topic: activeFilters.help_topic },
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
        toast.error(apiErrorMessage(error, "Couldn't load submissions."));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, activeFilters, refreshKey]);

  React.useEffect(() => {
    let cancelled = false;
    setSummaryLoading(true);
    getContactSubmissionsSummary(activeFilters)
      .then((s) => !cancelled && setSummary(s))
      .catch(() => !cancelled && setSummary(EMPTY_SUMMARY))
      .finally(() => !cancelled && setSummaryLoading(false));
    return () => { cancelled = true; };
  }, [activeFilters]);

  const fetchAllForExport = async () =>
    (
              await listContactSubmissions({
                page: 1, limit: EXPORT_CAP, dateRange: activeFilters.dateRange,
                filters: { email: activeFilters.email, status: activeFilters.status, help_topic: activeFilters.help_topic },
              })
            ).rows;

  const columns = React.useMemo<ColumnDef<ContactSubmissionRow>[]>(
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
        accessorKey: "first_name",
        header: "From",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium">
              {row.original.first_name} {row.original.last_name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {row.original.email}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "help_topic",
        header: "Topic",
        cell: ({ row }) =>
          HELP_TOPIC_LABELS[row.original.help_topic ?? "other"] ??
          row.original.help_topic ??
          "—",
      },
      {
        accessorKey: "message",
        header: "Message",
        cell: ({ row }) => (
          <span className="block max-w-80 truncate text-xs text-muted-foreground">
            {row.original.message}
          </span>
        ),
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
        header: "Received",
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
          <h1 className="text-lg font-semibold">Contact submissions</h1>
          <p className="text-sm text-muted-foreground">
            Messages sent through the website contact form.
          </p>
        </div>
        <ExportMenu
          filename="inquiries"
          columns={exportColumns}
          selected={selected}
          fetchAll={fetchAllForExport}
          total={total}
          noun="inquirie"
        />
      </div>

      <SummaryStatStrip tiles={tiles} loading={summaryLoading} />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-44 flex-1 sm:max-w-56">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Filter by email"
            className="bg-card pl-8"
          />
        </div>
        <MultiSelectFilter label="Topic" options={HELP_TOPICS} value={topics} onChange={setTopics} />
        <MultiSelectFilter label="Status" options={INQUIRY_STATUSES} value={statuses} onChange={setStatuses} />
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-3 py-2">
          <span className="text-sm font-medium">
            {selected.length} submission{selected.length === 1 ? "" : "s"} selected
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

      <SubmissionDialog
        submission={detail}
        onClose={() => setDetail(null)}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}

// ─── Detail ───────────────────────────────────────────────────────────────────

function SubmissionDialog({
  submission,
  onClose,
  onSaved,
}: {
  submission: ContactSubmissionRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [status, setStatus] = React.useState<InquiryStatus>("new");
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!submission) return;
    setStatus((submission.status ?? "new") as InquiryStatus);
    setNotes(submission.admin_notes ?? "");
  }, [submission]);

  const submit = async () => {
    if (!submission) return;
    setSaving(true);
    try {
      toast.success(
        await updateContactSubmission(submission.id, {
          status,
          admin_notes: notes.trim() || undefined,
        })
      );
      onClose();
      onSaved();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't update the submission."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!submission} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {submission
              ? `${submission.first_name} ${submission.last_name}`
              : "Submission"}
          </DialogTitle>
          <DialogDescription>
            {submission ? fmtWhen(submission.created_at) : ""}
          </DialogDescription>
        </DialogHeader>

        {submission && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <a
                href={`mailto:${submission.email}`}
                className="flex items-center gap-1.5 text-[#005bd3] hover:underline"
              >
                <Mail className="size-3.5" />
                {submission.email}
              </a>
              {submission.phone && (
                <a
                  href={`tel:${submission.phone}`}
                  className="flex items-center gap-1.5 text-[#005bd3] hover:underline"
                >
                  <Phone className="size-3.5" />
                  {submission.phone}
                </a>
              )}
              <StatusBadge
                status={
                  HELP_TOPIC_LABELS[submission.help_topic ?? "other"] ??
                  submission.help_topic ??
                  "Other"
                }
                tone="info"
              />
            </div>

            <div className="rounded-xl border border-border bg-muted/30 p-3">
              <p className="text-sm whitespace-pre-wrap">{submission.message}</p>
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
              <Label htmlFor="admin-notes">Internal notes</Label>
              <Textarea
                id="admin-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Called the customer back…"
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
