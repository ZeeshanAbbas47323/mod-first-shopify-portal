"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Search } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/data-table";
import { DateRangePicker } from "@/components/date-range-picker";
import { StatusBadge, type BadgeTone } from "@/components/status-badge";
import { apiErrorMessage } from "@/lib/auth-api";
import { listActivityLogs, type ActivityLogRow } from "@/lib/admin-api";

const PAGE_SIZE = 25;

/** Colour the verb so create/update/delete are scannable. */
const ACTION_TONES: Record<string, BadgeTone> = {
  create: "success",
  created: "success",
  update: "info",
  updated: "info",
  delete: "critical",
  deleted: "critical",
  login: "neutral",
  logout: "neutral",
  cancel: "warning",
  cancelled: "warning",
};

const humanize = (v?: string) =>
  v ? v.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "—";

const actorName = (row: ActivityLogRow) =>
  row.performer?.full_name ??
  row.performer?.name ??
  row.user?.full_name ??
  row.user?.name ??
  (row.performed_by != null ? `User #${row.performed_by}` : "System");

export function ActivityLogSection() {
  const [rows, setRows] = React.useState<ActivityLogRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(0);
  const [pageCount, setPageCount] = React.useState(1);
  const [total, setTotal] = React.useState(0);

  const [entityType, setEntityType] = React.useState("");
  const [action, setAction] = React.useState("");
  const [debounced, setDebounced] = React.useState({ entityType: "", action: "" });
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced({ entityType, action }), 400);
    return () => clearTimeout(t);
  }, [entityType, action]);

  React.useEffect(() => {
    setPage(0);
  }, [debounced, dateRange]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listActivityLogs({
      page: page + 1,
      limit: PAGE_SIZE,
      dateRange,
      filters: {
        entity_type: debounced.entityType || undefined,
        action: debounced.action || undefined,
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
        toast.error(apiErrorMessage(error, "Couldn't load the activity log."));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, debounced, dateRange]);

  const columns = React.useMemo<ColumnDef<ActivityLogRow>[]>(
    () => [
      {
        accessorKey: "created_at",
        header: "When",
        cell: ({ row }) => {
          const d = row.original.created_at;
          if (!d) return "—";
          const date = new Date(d);
          return isNaN(date.getTime()) ? "—" : format(date, "MMM d, yyyy · h:mm a");
        },
      },
      {
        accessorKey: "action",
        header: "Action",
        cell: ({ row }) => {
          const a = String(row.original.action ?? "").toLowerCase();
          return (
            <StatusBadge
              status={humanize(row.original.action)}
              tone={ACTION_TONES[a] ?? "neutral"}
            />
          );
        },
      },
      {
        accessorKey: "entity_type",
        header: "Record",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate">{humanize(row.original.entity_type)}</p>
            {row.original.entity_id != null && (
              <p className="truncate font-mono text-xs text-muted-foreground">
                #{row.original.entity_id}
              </p>
            )}
          </div>
        ),
      },
      {
        accessorKey: "performed_by",
        header: "By",
        cell: ({ row }) => actorName(row.original),
      },
      {
        accessorKey: "notes",
        header: "Notes",
        cell: ({ row }) => (
          <span className="block max-w-96 truncate text-xs text-muted-foreground">
            {row.original.notes || "—"}
          </span>
        ),
      },
    ],
    []
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Every change recorded across the store — who did what, and when.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-44 sm:max-w-48">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            placeholder="Record type e.g. order"
            className="bg-card pl-8"
          />
        </div>
        <Input
          value={action}
          onChange={(e) => setAction(e.target.value)}
          placeholder="Action e.g. update"
          className="w-44 bg-card"
        />
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        serverPagination={{
          pageIndex: page,
          pageCount,
          total,
          onPageChange: setPage,
        }}
      />
    </div>
  );
}
