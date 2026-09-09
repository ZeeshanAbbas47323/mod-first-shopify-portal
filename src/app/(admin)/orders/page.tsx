"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { format, subDays } from "date-fns";
import { type ColumnDef } from "@tanstack/react-table";
import { ChevronDown, Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, type ColumnFilterDef } from "@/components/data-table";
import { ExportMenu } from "@/components/export-menu";
import { MultiSelectFilter } from "@/components/multi-select-filter";
import { SummaryStatStrip, type SummaryTile } from "@/components/summary-stat-strip";
import {
  CustomerPreviewPopover,
  FulfillmentPreviewPopover,
  pickupOrDeliveryBlurb,
} from "@/components/orders/order-popovers";
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
  listOrders, getOrdersSummary, bulkUpdateOrderStatus,
  ORDER_STATUSES, PAYMENT_STATUSES, DELIVERY_TYPES, ORDER_CHANNELS,
  type OrderRow, type OrdersSummary,
} from "@/lib/admin-api";
import type { DateRange } from "react-day-picker";

const DEFAULT_PAGE_SIZE = 20;
const EXPORT_CAP = 5000;

const fmt$ = (n?: number | string | null) =>
  n != null ? `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—";

const humanize = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const orderCustomerPreview = (order: OrderRow) => ({
  user_id: order.user_id,
  name:
    (typeof order.customer === "object" && order.customer?.full_name) ||
    order.full_name ||
    "Guest",
  email:
    order.email ??
    (typeof order.customer === "object" ? order.customer?.email : undefined),
  city: order.shippingAddr?.city,
  country: order.shippingAddr?.country,
});

const orderFulfillmentPreview = (order: OrderRow) => ({
  items: (order.items ?? []).map((item) => ({
    id: item.id,
    name: item.product_name ?? item.product?.title ?? "Product",
    variant: item.variant_name,
    quantity: item.quantity ?? 1,
    image: item.product?.images?.[0]?.image_url,
  })),
  deliveryBlurb: pickupOrDeliveryBlurb({
    delivery_type: order.delivery_type,
    pickupLocationName: order.pickupLoc?.name,
    estimatedDeliveryDate: order.estimated_delivery_date,
  }),
});

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
    accessorKey: "order_date",
    header: "Date",
    cell: ({ row }) => {
      // order_date is when the order was placed; created_at is the fallback.
      const v = row.original.order_date ?? row.original.created_at;
      if (!v) return "—";
      const d = new Date(v);
      if (isNaN(d.getTime())) return "—";
      return (
        <div className="whitespace-nowrap">
          <p>{format(d, "MMM d, yyyy")}</p>
          <p className="text-xs text-muted-foreground">{format(d, "h:mm a")}</p>
        </div>
      );
    },
  },
  {
    id: "customer",
    header: "Customer",
    cell: ({ row }) => (
      <div onClick={(e) => e.stopPropagation()}>
        <CustomerPreviewPopover customer={orderCustomerPreview(row.original)} />
        <p className="text-xs text-muted-foreground">
          {row.original.email ??
            (typeof row.original.customer === "object" ? row.original.customer?.email : "")}
        </p>
      </div>
    ),
  },
  {
    accessorKey: "channel",
    header: "Channel",
    cell: ({ row }) => {
      const v = row.getValue<string>("channel");
      return <span className="text-sm text-muted-foreground">{v ? humanize(v) : "—"}</span>;
    },
  },
  {
    // Real Prisma field is total_amount — "total" doesn't exist on the row,
    // which is why this column used to render "—" for every order.
    accessorKey: "total_amount",
    header: () => <div className="text-right">Total</div>,
    cell: ({ row }) => (
      <div className="text-right font-medium">{fmt$(row.getValue("total_amount"))}</div>
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
    // Real field is the `items` array — "items_count" doesn't exist, so this
    // used to render "—" too. Now also doubles as the fulfillment preview.
    id: "items",
    header: "Items",
    cell: ({ row }) => <FulfillmentPreviewPopover {...orderFulfillmentPreview(row.original)} />,
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

const EMPTY_SUMMARY: OrdersSummary = {
  orders: { current: 0, previous: 0, change_percent: null },
  items_ordered: { current: 0, previous: 0, change_percent: null },
  orders_fulfilled: { current: 0, previous: 0, change_percent: null },
  sales_reversals: { current: 0, previous: 0, change_percent: null },
  trend: [],
};

/** Filter controls rendered under each column header. */
const COLUMN_FILTERS: Record<string, ColumnFilterDef> = {
  order_number: { type: "text", placeholder: "Order #" },
  customer: { type: "text", placeholder: "Name or email" },
  channel: { type: "select", options: ORDER_CHANNELS, placeholder: "Any" },
  payment_status: { type: "select", options: PAYMENT_STATUSES, placeholder: "Any" },
  status: { type: "select", options: ORDER_STATUSES, placeholder: "Any" },
  delivery_type: { type: "select", options: DELIVERY_TYPES, placeholder: "Any" },
};

const exportColumns = [
  { key: "order_number", label: "Order", value: (r: OrderRow) => r.order_number ?? `#${r.id}` },
  { key: "date", label: "Date", value: (r: OrderRow) => r.order_date ?? r.created_at ?? "" },
  { key: "customer", label: "Customer", value: (r: OrderRow) => r.full_name ?? "" },
  { key: "email", label: "Email", value: (r: OrderRow) => r.email ?? "" },
  { key: "channel", label: "Channel", value: (r: OrderRow) => (r.channel ? humanize(r.channel) : "") },
  { key: "total", label: "Total", value: (r: OrderRow) => r.total_amount ?? "" },
  { key: "payment_status", label: "Payment status", value: (r: OrderRow) => r.payment_status ?? "" },
  { key: "status", label: "Status", value: (r: OrderRow) => r.status ?? "" },
  { key: "delivery_type", label: "Delivery", value: (r: OrderRow) => r.delivery_type ?? "" },
  { key: "items", label: "Items", value: (r: OrderRow) => r.items?.length ?? "" },
];

export default function OrdersPage() {
  const router = useRouter();
  const [tab, setTab] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState<number>(DEFAULT_PAGE_SIZE);
  const [selected, setSelected] = React.useState<OrderRow[]>([]);
  const [clearKey, setClearKey] = React.useState(0);
  const [bulkBusy, setBulkBusy] = React.useState(false);
  const [rows, setRows] = React.useState<OrderRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(false);
  const [summary, setSummary] = React.useState<OrdersSummary>(EMPTY_SUMMARY);
  const [summaryLoading, setSummaryLoading] = React.useState(true);

  // Filters
  const [dateRange, setDateRange] = React.useState<DateRange>({
    from: subDays(new Date(), 29),
    to: new Date(),
  });
  const [payStatuses, setPayStatuses] = React.useState<string[]>([]);
  const [deliveryTypes, setDeliveryTypes] = React.useState<string[]>([]);
  const [channels, setChannels] = React.useState<string[]>([]);
  const [search, setSearch] = React.useState("");
  const [searchInput, setSearchInput] = React.useState("");
  const [statuses, setStatuses] = React.useState<string[]>([]);
  const [orderNumber, setOrderNumber] = React.useState("");

  // Reset page when filters/tab change
  React.useEffect(() => {
    setPage(1);
  }, [tab, dateRange, payStatuses, deliveryTypes, channels, search, statuses, orderNumber]);

  const activeFilters = React.useMemo(
    () => ({
      dateRange,
      // An explicit status filter is a narrower statement than the tab, so it wins.
      status: statuses.length ? statuses : TAB_STATUS[tab],
      payment_status: payStatuses,
      delivery_type: deliveryTypes,
      channel: channels,
      search: search || undefined,
      order_number: orderNumber || undefined,
    }),
    [dateRange, tab, payStatuses, deliveryTypes, channels, search, statuses, orderNumber]
  );

  /**
   * The header filter row and the filter bar above it edit the same state, so
   * a pick in one shows up in the other instead of silently competing.
   */
  const columnFilterValues = React.useMemo(() => {
    const values: Record<string, string[]> = {};
    if (orderNumber) values.order_number = [orderNumber];
    if (search) values.customer = [search];
    if (channels.length) values.channel = channels;
    if (payStatuses.length) values.payment_status = payStatuses;
    if (statuses.length) values.status = statuses;
    if (deliveryTypes.length) values.delivery_type = deliveryTypes;
    return values;
  }, [orderNumber, search, channels, payStatuses, statuses, deliveryTypes]);

  const applyColumnFilters = React.useCallback((next: Record<string, string[]>) => {
    setOrderNumber(next.order_number?.[0] ?? "");
    setSearch(next.customer?.[0] ?? "");
    setSearchInput(next.customer?.[0] ?? "");
    setChannels(next.channel ?? []);
    setPayStatuses(next.payment_status ?? []);
    setStatuses(next.status ?? []);
    setDeliveryTypes(next.delivery_type ?? []);
  }, []);

  const load = React.useCallback(() => {
    setLoading(true);
    listOrders({ page, limit: pageSize, ...activeFilters })
      .then(({ rows: r, total: t, totalPages: tp }) => {
        setRows(r); setTotal(t); setTotalPages(tp);
      })
      .catch((e) => toast.error(apiErrorMessage(e, "Couldn't load orders.")))
      .finally(() => setLoading(false));
  }, [page, pageSize, activeFilters]);

  React.useEffect(() => { load(); }, [load]);

  React.useEffect(() => {
    let cancelled = false;
    setSummaryLoading(true);
    getOrdersSummary(activeFilters)
      .then((s) => !cancelled && setSummary(s))
      .catch(() => !cancelled && setSummary(EMPTY_SUMMARY))
      .finally(() => !cancelled && setSummaryLoading(false));
    return () => { cancelled = true; };
  }, [activeFilters]);

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

  const fetchAllForExport = React.useCallback(
    async () => (await listOrders({ page: 1, limit: EXPORT_CAP, ...activeFilters })).rows,
    [activeFilters]
  );

  const tiles: SummaryTile[] = [
    {
      label: "Orders",
      value: summary.orders.current.toLocaleString("en-US"),
      changePercent: summary.orders.change_percent,
      sparkline: summary.trend.map((t) => t.count),
    },
    {
      label: "Items ordered",
      value: summary.items_ordered.current.toLocaleString("en-US"),
      changePercent: summary.items_ordered.change_percent,
    },
    {
      label: "Sales reversals",
      value: fmt$(summary.sales_reversals.current),
      changePercent: summary.sales_reversals.change_percent,
    },
    {
      label: "Orders fulfilled",
      value: summary.orders_fulfilled.current.toLocaleString("en-US"),
      changePercent: summary.orders_fulfilled.change_percent,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Orders</h1>
        <div className="flex gap-2">
          <ExportMenu
            filename="orders"
            columns={exportColumns}
          selected={selected}
            fetchAll={fetchAllForExport}
            total={total}
            noun="order"
          />
        </div>
      </div>

      {/* Summary stat strip */}
      <SummaryStatStrip tiles={tiles} loading={summaryLoading} />

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

        {/* Payment status — multi-select */}
        <MultiSelectFilter
          label="Payment status"
          options={PAYMENT_STATUSES}
          value={payStatuses}
          onChange={setPayStatuses}
        />

        {/* Delivery type — multi-select */}
        <MultiSelectFilter
          label="Delivery type"
          options={DELIVERY_TYPES}
          value={deliveryTypes}
          onChange={setDeliveryTypes}
        />

        {/* Channel — multi-select */}
        <MultiSelectFilter
          label="Channel"
          options={ORDER_CHANNELS}
          value={channels}
          onChange={setChannels}
        />

        {/* Order/customer search */}
        <div className="flex items-center gap-1">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search orders or customers"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setSearch(searchInput)}
              className="h-9 rounded-lg border border-input bg-card pl-8 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-ring w-56"
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
        columnFilterDefs={COLUMN_FILTERS}
        serverColumnFilters={{ value: columnFilterValues, onChange: applyColumnFilters }}
        serverPagination={{
          pageIndex: page - 1,
          pageCount: totalPages,
          total,
          onPageChange: (idx) => setPage(idx + 1),
          pageSize,
          onPageSizeChange: setPageSize,
        }}
      />
    </div>
  );
}
