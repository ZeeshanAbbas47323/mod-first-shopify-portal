"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { format, subDays } from "date-fns";
import { type ColumnDef } from "@tanstack/react-table";
import { ChevronDown, Download, Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DateRangePicker } from "@/components/date-range-picker";
import { StatusBadge } from "@/components/status-badge";
import { apiErrorMessage } from "@/lib/auth-api";
import {
  listOrders, bulkUpdateOrderStatus,
  ORDER_STATUSES, PAYMENT_STATUSES, DELIVERY_TYPES,
  type OrderRow,
} from "@/lib/admin-api";
import type { DateRange } from "react-day-picker";

const PAGE_LIMIT = 20;

const fmt$ = (n?: number | null) =>
  n != null ? `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—";

const custName = (c: OrderRow["customer"]) => {
  if (!c) return "Guest";
  if (typeof c === "string") return c;
  return (c as { full_name?: string }).full_name ?? "Guest";
};

const custEmail = (row: OrderRow) => {
  if (row.email) return row.email;
  const c = row.customer;
  if (c && typeof c === "object") return (c as { email?: string }).email ?? "";
  return "";
};

const columns: ColumnDef<OrderRow>[] = [
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
    accessorKey: "order_number",
    header: "Order",
    cell: ({ row }) => (
      <span className="font-mono text-sm font-medium">
        {row.getValue("order_number") ?? `#${row.original.id}`}
      </span>
    ),
  },
  {
    accessorKey: "created_at",
    header: "Date",
    cell: ({ row }) => {
      const v = row.getValue<string>("created_at");
      return v ? format(new Date(v), "MMM d, yyyy") : "—";
    },
  },
  {
    id: "customer",
    header: "Customer",
    cell: ({ row }) => (
      <div>
        <p className="font-medium">{custName(row.original)}</p>
        <p className="text-xs text-muted-foreground">{custEmail(row.original)}</p>
      </div>
    ),
  },
  {
    accessorKey: "total",
    header: () => <div className="text-right">Total</div>,
    cell: ({ row }) => (
      <div className="text-right font-medium">{fmt$(row.getValue("total"))}</div>
    ),
  },
  {
    accessorKey: "payment_status",
    header: "Payment",
    cell: ({ row }) => <StatusBadge status={row.getValue("payment_status") ?? "—"} />,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.getValue("status") ?? "—"} />,
  },
  {
    accessorKey: "delivery_type",
    header: "Delivery",
    cell: ({ row }) => {
      const v = row.getValue<string>("delivery_type") ?? "";
      return <span className="text-sm capitalize">{v.replace(/_/g, " ")}</span>;
    },
  },
  {
    accessorKey: "items_count",
    header: "Items",
    cell: ({ row }) => {
      const n = row.getValue<number>("items_count");
      return n != null ? `${n} item${n !== 1 ? "s" : ""}` : "—";
    },
  },
];

// Tab → status filter mapping
const TAB_STATUS: Record<string, string | undefined> = {
  all: undefined,
  pending: "booked",
  in_progress: "preparing",
  shipped: "shipped",
  completed: "completed",
  cancelled: "cancelled",
};

const TABS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In progress" },
  { value: "shipped", label: "Shipped" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];


export default function OrdersPage() {
  const router = useRouter();
  const [tab, setTab] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const [selected, setSelected] = React.useState<OrderRow[]>([]);
  const [clearKey, setClearKey] = React.useState(0);
  const [bulkBusy, setBulkBusy] = React.useState(false);
  const [rows, setRows] = React.useState<OrderRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(false);

  // Filters
  const [dateRange, setDateRange] = React.useState<DateRange>({
    from: subDays(new Date(), 29),
    to: new Date(),
  });
  const [payStatus, setPayStatus] = React.useState("all");
  const [deliveryType, setDeliveryType] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [searchInput, setSearchInput] = React.useState("");

  // Reset page when filters/tab change
  React.useEffect(() => { setPage(1); }, [tab, dateRange, payStatus, deliveryType, search]);

  const load = React.useCallback(() => {
    setLoading(true);
    listOrders({
      page,
      limit: PAGE_LIMIT,
      dateRange,
      status: TAB_STATUS[tab],
      payment_status: payStatus === "all" ? undefined : payStatus,
      delivery_type: deliveryType === "all" ? undefined : deliveryType,
      order_number: search || undefined,
    })
      .then(({ rows: r, total: t, totalPages: tp }) => {
        setRows(r); setTotal(t); setTotalPages(tp);
      })
      .catch((e) => toast.error(apiErrorMessage(e, "Couldn't load orders.")))
      .finally(() => setLoading(false));
  }, [page, tab, dateRange, payStatus, deliveryType, search]);

  React.useEffect(() => { load(); }, [load]);

  // Illegal transitions come back in `failed`, so report both halves.
  const runBulkStatus = async (status: string) => {
    if (!selected.length) return;
    setBulkBusy(true);
    try {
      const result = await bulkUpdateOrderStatus({
        order_ids: selected.map((o) => o.id),
        status,
      });
      if (result.updated.length) {
        toast.success(
          `${result.updated.length} order${result.updated.length === 1 ? "" : "s"} moved to "${status.replace(/_/g, " ")}".`
        );
      }
      result.failed.forEach((f) =>
        toast.error(`Order #${f.id}: ${f.reason ?? "couldn't be updated."}`)
      );
      if (!result.updated.length && !result.failed.length) toast.success(result.message);
      setClearKey((k) => k + 1);
      load();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't update the orders."));
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Orders</h1>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="size-4" /> Export
          </Button>
        </div>
      </div>

      {/* Status tabs */}
      <Tabs value={tab} onValueChange={(v) => v && setTab(v)}>
        <TabsList className="bg-transparent p-0">
          {TABS.map((t) => (
            <TabsTrigger
              key={t.value}
              value={t.value}
              className="cursor-pointer rounded-lg px-3 data-active:bg-[#e3e3e3] data-active:shadow-none"
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Date range */}
        <DateRangePicker
          value={dateRange}
          onChange={(r) => r && setDateRange(r)}
        />

        {/* Payment status */}
        <Select value={payStatus} onValueChange={(v) => setPayStatus(v ?? "all")}>
          <SelectTrigger className="h-9 w-40 bg-card">
            <SelectValue placeholder="Payment status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All payments</SelectItem>
            {PAYMENT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Delivery type */}
        <Select value={deliveryType} onValueChange={(v) => setDeliveryType(v ?? "all")}>
          <SelectTrigger className="h-9 w-44 bg-card">
            <SelectValue placeholder="Delivery type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All delivery types</SelectItem>
            {DELIVERY_TYPES.map((d) => (
              <SelectItem key={d} value={d}>{d.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Order number search */}
        <div className="flex items-center gap-1">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search order #"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setSearch(searchInput)}
              className="h-9 rounded-lg border border-input bg-card pl-8 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-ring w-44"
            />
            {searchInput && (
              <button onClick={() => { setSearchInput(""); setSearch(""); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="size-3.5" />
              </button>
            )}
          </div>
          <Button size="sm" variant="outline" onClick={() => setSearch(searchInput)}>Go</Button>
        </div>
      </div>

      {/* Bulk actions */}
      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-3 py-2">
          <span className="text-sm font-medium">
            {selected.length} order{selected.length === 1 ? "" : "s"} selected
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={bulkBusy}
              render={
                <Button size="sm" variant="outline">
                  {bulkBusy && <Loader2 className="size-4 animate-spin" />}
                  Set status
                  <ChevronDown className="size-3.5" />
                </Button>
              }
            />
            <DropdownMenuContent align="start" className="w-52">
              {ORDER_STATUSES.map((s) => (
                <DropdownMenuItem
                  key={s}
                  className="capitalize"
                  onClick={() => runBulkStatus(s)}
                >
                  {s.replace(/_/g, " ")}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            type="button"
            onClick={() => setClearKey((k) => k + 1)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Table */}
      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        onSelectionChange={setSelected}
        clearSelectionKey={clearKey}
        onRowClick={(row) => router.push(`/orders/${row.id}`)}
        serverPagination={{
          pageIndex: page - 1,
          pageCount: totalPages,
          total,
          onPageChange: (idx) => setPage(idx + 1),
        }}
      />
    </div>
  );
}
