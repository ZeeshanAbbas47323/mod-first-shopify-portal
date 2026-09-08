"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Mail, Phone } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table";
import { DateRangePicker } from "@/components/date-range-picker";
import { apiErrorMessage } from "@/lib/auth-api";
import { listAbandonedCarts, type AbandonedCartRow } from "@/lib/admin-api";

const DEFAULT_PAGE_SIZE = 20;

const money = (n?: number | null) =>
  n != null ? `$${Number(n).toFixed(2)}` : "—";

const when = (d?: string | null) =>
  d && !isNaN(new Date(d).getTime())
    ? format(new Date(d), "MMM d, yyyy 'at' h:mm a")
    : "—";

const columns: ColumnDef<AbandonedCartRow>[] = [
  {
    accessorKey: "user",
    header: "Customer",
    cell: ({ row }) => {
      const u = row.original.user;
      return (
        <div className="min-w-0">
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
    header: "Lines",
    cell: ({ row }) => row.original.item_count,
  },
  {
    accessorKey: "total_quantity",
    header: "Items",
    cell: ({ row }) => row.original.total_quantity,
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

  const recoverable = rows.reduce((sum, r) => sum + (r.cart_value ?? 0), 0);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold">Abandoned checkouts</h1>
        <p className="text-sm text-muted-foreground">
          Customers who filled a cart and haven&apos;t ordered since.
          {rows.length > 0 && ` ${money(recoverable)} sitting on this page.`}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
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
          pageSize,
          onPageSizeChange: setPageSize,
        }}
      />
    </div>
  );
}
