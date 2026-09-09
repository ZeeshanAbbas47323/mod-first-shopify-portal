"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Mail, Phone } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";

import { Checkbox } from "@/components/ui/checkbox";
import { fetchAllPages } from "@/lib/export";
import { DataTable } from "@/components/data-table";
import { ExportMenu } from "@/components/export-menu";
import { SummaryStatStrip, type SummaryTile } from "@/components/summary-stat-strip";
import { DateRangePicker } from "@/components/date-range-picker";
import { apiErrorMessage } from "@/lib/auth-api";
import {
  listAbandonedCarts, getAbandonedCartsSummary,
  type AbandonedCartRow, type AbandonedCartsSummary,
} from "@/lib/admin-api";

const DEFAULT_PAGE_SIZE = 20;
const EXPORT_CAP = 5000;

const money = (n?: number | null) =>
  n != null ? `$${Number(n).toFixed(2)}` : "—";

const when = (d?: string | null) =>
  d && !isNaN(new Date(d).getTime())
    ? format(new Date(d), "MMM d, yyyy 'at' h:mm a")
    : "—";

const EMPTY_SUMMARY: AbandonedCartsSummary = {
  abandoned_carts: 0, recoverable_value: 0, items_abandoned: 0, average_cart_value: 0,
};

const exportColumns = [
  { key: "customer", label: "Customer", value: (r: AbandonedCartRow) => r.user?.full_name?.trim() || `Customer #${r.user_id}` },
  { key: "email", label: "Email", value: (r: AbandonedCartRow) => r.user?.email ?? "" },
  { key: "phone", label: "Phone", value: (r: AbandonedCartRow) => r.user?.phone ?? "" },
  { key: "lines", label: "Lines", value: (r: AbandonedCartRow) => r.item_count },
  { key: "items", label: "Items", value: (r: AbandonedCartRow) => r.total_quantity },
  { key: "cart_value", label: "Cart value", value: (r: AbandonedCartRow) => r.cart_value },
  { key: "last_activity", label: "Last activity", value: (r: AbandonedCartRow) => r.last_activity_at ?? "" },
];

const columns: ColumnDef<AbandonedCartRow>[] = [
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
    accessorKey: "user",
    header: "Customer",
    cell: ({ row }) => {
      const u = row.original.user;
      return (
        <div className="min-w-0 max-w-64">
          <p className="truncate font-medium">
            {u?.full_name?.trim() || `Customer #${row.original.user_id}`}
          </p>
          {u?.email && (
            <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              <Mail className="size-3" />
              {u.email}
            </p>
          )}
          {u?.phone && (
            <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              <Phone className="size-3" />
              {u.phone}
            </p>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "item_count",
    header: () => <div className="text-right">Lines</div>,
    size: 90,
    cell: ({ row }) => <div className="text-right tabular-nums">{row.original.item_count}</div>,
  },
  {
    accessorKey: "total_quantity",
    header: () => <div className="text-right">Items</div>,
    size: 90,
    cell: ({ row }) => <div className="text-right tabular-nums">{row.original.total_quantity}</div>,
  },
  {
    accessorKey: "cart_value",
    header: () => <div className="text-right">Cart value</div>,
    cell: ({ row }) => (
      <div className="text-right font-medium">{money(row.original.cart_value)}</div>
    ),
  },
  {
    accessorKey: "last_activity_at",
    header: "Last activity",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {when(row.original.last_activity_at)}
      </span>
    ),
  },
];

export default function AbandonedCheckoutsPage() {
  const [rows, setRows] = React.useState<AbandonedCartRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(0);
  const [pageSize, setPageSize] = React.useState<number>(DEFAULT_PAGE_SIZE);
  const [pageCount, setPageCount] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
  const [selected, setSelected] = React.useState<AbandonedCartRow[]>([]);
  const [clearKey, setClearKey] = React.useState(0);
  const [summary, setSummary] = React.useState<AbandonedCartsSummary>(EMPTY_SUMMARY);
  const [summaryLoading, setSummaryLoading] = React.useState(true);

  React.useEffect(() => {
    setPage(0);
  }, [dateRange, pageSize]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listAbandonedCarts({ page: page + 1, limit: pageSize, dateRange })
      .then((res) => {
        if (cancelled) return;
        setRows(res.rows);
        setTotal(res.total);
        setPageCount(res.totalPages);
      })
      .catch((error) => {
        if (cancelled) return;
        setRows([]);
        toast.error(apiErrorMessage(error, "Couldn't load abandoned checkouts."));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, dateRange]);

  React.useEffect(() => {
    let cancelled = false;
    setSummaryLoading(true);
    getAbandonedCartsSummary(dateRange)
      .then((s) => !cancelled && setSummary(s))
      .catch(() => !cancelled && setSummary(EMPTY_SUMMARY))
      .finally(() => !cancelled && setSummaryLoading(false));
    return () => { cancelled = true; };
  }, [dateRange]);

  const fetchAllForExport = async () =>
    fetchAllPages((page, limit) => listAbandonedCarts({ page, limit, dateRange }), EXPORT_CAP);

  const tiles: SummaryTile[] = [
    { label: "Abandoned checkouts", value: summary.abandoned_carts.toLocaleString("en-US") },
    { label: "Recoverable value", value: money(summary.recoverable_value) },
    { label: "Items abandoned", value: summary.items_abandoned.toLocaleString("en-US") },
    { label: "Avg. cart value", value: money(summary.average_cart_value) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Abandoned checkouts</h1>
          <p className="text-sm text-muted-foreground">
            Customers who filled a cart and haven&apos;t ordered since.
          </p>
        </div>
        <ExportMenu
          filename="abandoned-checkouts"
          columns={exportColumns}
          selected={selected}
          fetchAll={fetchAllForExport}
          total={total}
          noun="checkout"
        />
      </div>

      <SummaryStatStrip tiles={tiles} loading={summaryLoading} />

      <div className="flex flex-wrap items-center gap-2">
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-3 py-2">
          <span className="text-sm font-medium">
            {selected.length} checkout{selected.length === 1 ? "" : "s"} selected
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
        serverPagination={{
          pageIndex: page,
          pageCount,
          total,
          onPageChange: setPage,
          pageSize,
          onPageSizeChange: setPageSize,
        }}
      />
    </div>
  );
}
