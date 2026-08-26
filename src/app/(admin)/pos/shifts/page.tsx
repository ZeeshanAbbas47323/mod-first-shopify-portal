"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Printer, Search } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/data-table";
import { DateRangePicker } from "@/components/date-range-picker";
import { StatusBadge, type BadgeTone } from "@/components/status-badge";
import { apiErrorMessage } from "@/lib/auth-api";
import { cn } from "@/lib/utils";
import { ShiftBar, money, openPrintOutput } from "@/components/pos/shift-bar";
import {
  SHIFT_STATUSES,
  getCurrentShift,
  getShiftById,
  listShifts,
  printShiftReport,
  type ShiftRow,
} from "@/lib/pos-api";

const PAGE_SIZE = 15;

const STATUS_ITEMS: Record<string, string> = {
  all: "All statuses",
  open: "Open",
  paused: "Paused",
  closed: "Closed",
  ended: "Ended",
};

const TONES: Record<string, BadgeTone> = {
  open: "success",
  paused: "attention",
  closed: "neutral",
  ended: "neutral",
};

const fmtWhen = (v?: string | null) => {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "—" : format(d, "MMM d, yyyy · h:mm a");
};

/** Difference between counted and expected cash, when the shift is closed. */
const cashDiff = (s: ShiftRow): number | null => {
  if (s.cash_difference != null) return Number(s.cash_difference);
  if (s.counted_cash == null) return null;
  const expected =
    s.expected_cash != null
      ? Number(s.expected_cash)
      : Number(s.opening_float ?? 0) + Number(s.cash_sales ?? 0);
  return Number(s.counted_cash) - expected;
};

export default function PosShiftsPage() {
  const [current, setCurrent] = React.useState<ShiftRow | null>(null);
  const [currentLoading, setCurrentLoading] = React.useState(true);

  const [rows, setRows] = React.useState<ShiftRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(0);
  const [pageCount, setPageCount] = React.useState(1);
  const [total, setTotal] = React.useState(0);

  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
  const [refreshKey, setRefreshKey] = React.useState(0);

  const [detail, setDetail] = React.useState<ShiftRow | null>(null);

  React.useEffect(() => {
    setCurrentLoading(true);
    getCurrentShift()
      .then(setCurrent)
      .catch(() => setCurrent(null))
      .finally(() => setCurrentLoading(false));
  }, [refreshKey]);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  React.useEffect(() => {
    setPage(0);
  }, [debounced, status, dateRange]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listShifts({
      page: page + 1,
      limit: PAGE_SIZE,
      dateRange,
      filters: {
        shift_code: debounced || undefined,
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
        toast.error(apiErrorMessage(error, "Couldn't load shifts."));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, debounced, status, dateRange, refreshKey]);

  const print = async (shift: ShiftRow) => {
    try {
      await openPrintOutput(await printShiftReport(shift.id, { format: "pdf" }));
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't print the shift report."));
    }
  };

  const columns = React.useMemo<ColumnDef<ShiftRow>[]>(
    () => [
      {
        accessorKey: "shift_code",
        header: "Shift",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-mono font-medium">
              {row.original.shift_code ?? `#${row.original.id}`}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {row.original.user?.full_name ?? row.original.user?.name ?? "—"}
              {row.original.posDevice?.name ? ` · ${row.original.posDevice.name}` : ""}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const s = row.original.status ?? "open";
          return (
            <StatusBadge
              status={s.replace(/\b\w/g, (c) => c.toUpperCase())}
              tone={TONES[s] ?? "neutral"}
            />
          );
        },
      },
      {
        accessorKey: "opened_at",
        header: "Opened",
        cell: ({ row }) => fmtWhen(row.original.opened_at),
      },
      {
        accessorKey: "closed_at",
        header: "Closed",
        cell: ({ row }) => fmtWhen(row.original.closed_at),
      },
      {
        accessorKey: "total_orders",
        header: () => <div className="text-right">Orders</div>,
        cell: ({ row }) => (
          <div className="text-right tabular-nums">{row.original.total_orders ?? 0}</div>
        ),
      },
      {
        accessorKey: "total_sales",
        header: () => <div className="text-right">Sales</div>,
        cell: ({ row }) => (
          <div className="text-right font-medium tabular-nums">
            {money(row.original.total_sales)}
          </div>
        ),
      },
      {
        id: "diff",
        header: () => <div className="text-right">Cash diff</div>,
        cell: ({ row }) => {
          const d = cashDiff(row.original);
          if (d == null) return <div className="text-right text-muted-foreground">—</div>;
          const balanced = Math.abs(d) < 0.005;
          return (
            <div
              className={cn(
                "text-right font-medium tabular-nums",
                balanced ? "text-[#29845a]" : d > 0 ? "text-[#b98900]" : "text-[#e51c00]"
              )}
            >
              {balanced ? "Balanced" : `${d > 0 ? "+" : "−"}${money(Math.abs(d))}`}
            </div>
          );
        },
      },
      {
        id: "actions",
        header: () => <div className="text-right">Report</div>,
        cell: ({ row }) => (
          <div className="text-right">
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                print(row.original);
              }}
            >
              <Printer className="size-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    []
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold">Shifts</h1>
        <p className="text-sm text-muted-foreground">
          Cash drawer sessions, totals and closing reports.
        </p>
      </div>

      <ShiftBar
        shift={current}
        loading={currentLoading}
        onChanged={() => setRefreshKey((k) => k + 1)}
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-44 flex-1 sm:max-w-56">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by shift code"
            className="bg-card pl-8 font-mono"
          />
        </div>
        <Select items={STATUS_ITEMS} value={status} onValueChange={(v) => setStatus(v as string)}>
          <SelectTrigger className="min-w-32 bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {SHIFT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_ITEMS[s]}
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
        onRowClick={(row) => {
          setDetail(row);
          getShiftById(row.id)
            .then(setDetail)
            .catch(() => {});
        }}
        serverPagination={{
          pageIndex: page,
          pageCount,
          total,
          onPageChange: setPage,
        }}
      />

      <ShiftDetailDialog shift={detail} onOpenChange={() => setDetail(null)} />
    </div>
  );
}

function ShiftDetailDialog({
  shift,
  onOpenChange,
}: {
  shift: ShiftRow | null;
  onOpenChange: (v: boolean) => void;
}) {
  const diff = shift ? cashDiff(shift) : null;
  return (
    <Dialog open={!!shift} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-mono">
            {shift?.shift_code ?? `Shift #${shift?.id ?? ""}`}
          </DialogTitle>
        </DialogHeader>

        {shift && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-border p-3">
              <Row label="Cashier" value={shift.user?.full_name ?? shift.user?.name ?? "—"} />
              <Row label="Device" value={shift.posDevice?.name ?? "—"} />
              <Row label="Opened" value={fmtWhen(shift.opened_at)} />
              <Row label="Closed" value={fmtWhen(shift.closed_at)} />
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-xl border border-border p-3">
              <Row label="Opening float" value={money(shift.opening_float)} />
              <Row label="Orders" value={String(shift.total_orders ?? 0)} />
              <Row label="Total sales" value={money(shift.total_sales)} />
              <Row label="Cash sales" value={money(shift.cash_sales)} />
              <Row label="Card sales" value={money(shift.card_sales)} />
              <Row label="Counted cash" value={money(shift.counted_cash)} />
              {diff != null && (
                <Row
                  label="Difference"
                  value={
                    Math.abs(diff) < 0.005
                      ? "Balanced"
                      : `${diff > 0 ? "Over" : "Short"} ${money(Math.abs(diff))}`
                  }
                />
              )}
            </div>

            {(shift.opening_notes || shift.closing_notes) && (
              <div className="space-y-2 rounded-xl border border-border p-3">
                {shift.opening_notes && (
                  <p>
                    <span className="text-muted-foreground">Opening notes: </span>
                    {shift.opening_notes}
                  </p>
                )}
                {shift.closing_notes && (
                  <p>
                    <span className="text-muted-foreground">Closing notes: </span>
                    {shift.closing_notes}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium tabular-nums">{value}</p>
    </div>
  );
}
