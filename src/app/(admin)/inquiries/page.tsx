"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Loader2, Mail, Phone, Search } from "lucide-react";
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
import { StatusBadge, type BadgeTone } from "@/components/status-badge";
import { apiErrorMessage } from "@/lib/auth-api";
import {
  HELP_TOPIC_LABELS,
  INQUIRY_STATUSES,
  INQUIRY_STATUS_LABELS,
  listContactSubmissions,
  updateContactSubmission,
  type ContactSubmissionRow,
  type InquiryStatus,
} from "@/lib/admin-api";

const PAGE_SIZE = 15;

export const STATUS_TONES: Record<string, BadgeTone> = {
  new: "attention",
  in_progress: "info",
  resolved: "success",
  archived: "neutral",
};

const STATUS_FILTER_ITEMS: Record<string, string> = {
  all: "All statuses",
  ...INQUIRY_STATUS_LABELS,
};

const TOPIC_FILTER_ITEMS: Record<string, string> = {
  all: "All topics",
  ...HELP_TOPIC_LABELS,
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
  const [pageCount, setPageCount] = React.useState(1);
  const [total, setTotal] = React.useState(0);

  const [email, setEmail] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [topic, setTopic] = React.useState("all");
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
  const [refreshKey, setRefreshKey] = React.useState(0);

  const [detail, setDetail] = React.useState<ContactSubmissionRow | null>(null);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(email), 400);
    return () => clearTimeout(t);
  }, [email]);

  React.useEffect(() => {
    setPage(0);
  }, [debounced, status, topic, dateRange]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listContactSubmissions({
      page: page + 1,
      limit: PAGE_SIZE,
      dateRange,
      filters: {
        email: debounced || undefined,
        status: status === "all" ? undefined : status,
        help_topic: topic === "all" ? undefined : topic,
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
        toast.error(apiErrorMessage(error, "Couldn't load submissions."));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, debounced, status, topic, dateRange, refreshKey]);

  const columns = React.useMemo<ColumnDef<ContactSubmissionRow>[]>(
    () => [
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

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold">Contact submissions</h1>
        <p className="text-sm text-muted-foreground">
          Messages sent through the website contact form.
        </p>
      </div>

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
        <Select items={TOPIC_FILTER_ITEMS} value={topic} onValueChange={(v) => setTopic(v as string)}>
          <SelectTrigger className="min-w-36 bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(TOPIC_FILTER_ITEMS).map(([v, label]) => (
              <SelectItem key={v} value={v}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
