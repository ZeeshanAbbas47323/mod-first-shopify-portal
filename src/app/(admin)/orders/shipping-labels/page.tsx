"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { type ColumnDef } from "@tanstack/react-table";
import { Loader2, Package, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { fetchAllPages } from "@/lib/export";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, type ColumnFilterDef } from "@/components/data-table";
import { ExportMenu } from "@/components/export-menu";
import { MultiSelectFilter } from "@/components/multi-select-filter";
import { SummaryStatStrip, type SummaryTile } from "@/components/summary-stat-strip";
import { DateRangePicker } from "@/components/date-range-picker";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { apiErrorMessage } from "@/lib/auth-api";
import {
  createShipmentRate,
  listCouriers,
  listOrders,
  listShipments,
  getShipmentsSummary,
  SHIPMENT_STATUSES,
  type CourierRow,
  type OrderRow,
  type ShipmentRow,
  type ShipmentsSummary,
} from "@/lib/admin-api";

const DEFAULT_PAGE_SIZE = 20;
const EXPORT_CAP = 5000;

const EMPTY_SUMMARY: ShipmentsSummary = {
  shipments: { current: 0, previous: 0, change_percent: null },
  delivered: { current: 0, previous: 0, change_percent: null },
  in_transit: { current: 0, previous: 0, change_percent: null },
  issues: { current: 0, previous: 0, change_percent: null },
};

const COLUMN_FILTERS: Record<string, ColumnFilterDef> = {
  shipment_number: { type: "text", placeholder: "Search shipments" },
  status: { type: "select", options: SHIPMENT_STATUSES, placeholder: "Any" },
};

const exportColumns = [
  { key: "shipment_number", label: "Shipment", value: (r: ShipmentRow) => r.shipment_number ?? `#${r.id}` },
  { key: "order_id", label: "Order", value: (r: ShipmentRow) => (r.order_id ? `#${r.order_id}` : "") },
  { key: "service_name", label: "Service", value: (r: ShipmentRow) => r.service_name ?? "" },
  { key: "tracking_number", label: "Tracking #", value: (r: ShipmentRow) => r.tracking_number ?? "" },
  { key: "status", label: "Status", value: (r: ShipmentRow) => r.status ?? "" },
  { key: "created_at", label: "Created", value: (r: ShipmentRow) => r.created_at ?? "" },
];

const columns: ColumnDef<ShipmentRow>[] = [
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
    accessorKey: "shipment_number",
    header: "Shipment",
    cell: ({ row }) => (
      <span className="font-mono text-sm font-medium">
        {row.getValue("shipment_number") ?? `#${row.original.id}`}
      </span>
    ),
  },
  {
    accessorKey: "order_id",
    header: "Order",
    cell: ({ row }) => {
      const v = row.getValue<string | number>("order_id");
      return v ? <span className="text-sm">#{String(v)}</span> : "—";
    },
  },
  {
    accessorKey: "service_name",
    header: "Service",
    cell: ({ row }) => (
      <span className="text-sm">{row.getValue("service_name") ?? "—"}</span>
    ),
  },
  {
    accessorKey: "tracking_number",
    header: "Tracking #",
    cell: ({ row }) => {
      const v = row.getValue<string>("tracking_number");
      return v ? <span className="font-mono text-sm">{v}</span> : "—";
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.getValue("status") ?? "—"} />,
  },
  {
    accessorKey: "created_at",
    header: "Created",
    cell: ({ row }) => {
      const v = row.getValue<string>("created_at");
      return v ? format(new Date(v), "MMM d, yyyy") : "—";
    },
  },
];

export default function ShippingLabelsPage() {
  const router = useRouter();
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState<number>(DEFAULT_PAGE_SIZE);
  const [rows, setRows] = React.useState<ShipmentRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [searchInput, setSearchInput] = React.useState("");
  const [statuses, setStatuses] = React.useState<string[]>([]);
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<ShipmentRow[]>([]);
  const [clearKey, setClearKey] = React.useState(0);
  const [summary, setSummary] = React.useState<ShipmentsSummary>(EMPTY_SUMMARY);
  const [summaryLoading, setSummaryLoading] = React.useState(true);

  React.useEffect(() => { setPage(1); }, [search, dateRange, statuses]);

  const activeFilters = React.useMemo(
    () => ({ dateRange, status: statuses, search: search || undefined }),
    [dateRange, statuses, search]
  );

  const load = React.useCallback(() => {
    setLoading(true);
    listShipments({
      page, limit: pageSize, search: activeFilters.search, dateRange: activeFilters.dateRange,
      filters: activeFilters.status.length ? { status: activeFilters.status } : undefined,
    })
      .then(({ rows: r, total: t, totalPages: tp }) => {
        setRows(r); setTotal(t); setTotalPages(tp);
      })
      .catch((e) => toast.error(apiErrorMessage(e, "Couldn't load shipments.")))
      .finally(() => setLoading(false));
  }, [page, pageSize, activeFilters]);

  React.useEffect(() => { load(); }, [load]);

  React.useEffect(() => {
    let cancelled = false;
    setSummaryLoading(true);
    getShipmentsSummary(activeFilters)
      .then((s) => !cancelled && setSummary(s))
      .catch(() => !cancelled && setSummary(EMPTY_SUMMARY))
      .finally(() => !cancelled && setSummaryLoading(false));
    return () => { cancelled = true; };
  }, [activeFilters]);

  const fetchAllForExport = async () =>
    fetchAllPages((page, limit) => listShipments({
                page, limit, search: activeFilters.search, dateRange: activeFilters.dateRange,
                filters: activeFilters.status.length ? { status: activeFilters.status } : undefined,
              }), EXPORT_CAP);

  const tiles: SummaryTile[] = [
    { label: "Shipments", value: summary.shipments.current.toLocaleString("en-US"), changePercent: summary.shipments.change_percent },
    { label: "Delivered", value: summary.delivered.current.toLocaleString("en-US"), changePercent: summary.delivered.change_percent },
    { label: "In transit", value: summary.in_transit.current.toLocaleString("en-US"), changePercent: summary.in_transit.change_percent },
    { label: "Issues", value: summary.issues.current.toLocaleString("en-US"), changePercent: summary.issues.change_percent },
  ];

  return (
    <div className="flex flex-col gap-4">
      {}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Shipping & Delivery</h1>
        <div className="flex gap-2">
          <ExportMenu
            filename="shipments"
            columns={exportColumns}
          selected={selected}
            fetchAll={fetchAllForExport}
            total={total}
            noun="shipment"
          />
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> Create shipment
          </Button>
        </div>
      </div>

      <SummaryStatStrip tiles={tiles} loading={summaryLoading} />

      {}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by tracking #"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setSearch(searchInput)}
            className="h-9 rounded-lg border border-input bg-card pl-8 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-ring w-64"
          />
          {searchInput && (
            <button
              onClick={() => { setSearchInput(""); setSearch(""); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={() => setSearch(searchInput)}>
          Go
        </Button>
        <MultiSelectFilter label="Status" options={SHIPMENT_STATUSES} value={statuses} onChange={setStatuses} />
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-3 py-2">
          <span className="text-sm font-medium">
            {selected.length} shipment{selected.length === 1 ? "" : "s"} selected
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

      {}
      <DataTable
        onRefresh={load}
        columns={columns}
        data={rows}
        loading={loading}
        onSelectionChange={setSelected}
        clearSelectionKey={clearKey}
        onRowClick={(row) => router.push(`/orders/${row.order_id}`)}
        columnFilterDefs={COLUMN_FILTERS}
        serverPagination={{
          pageIndex: page - 1,
          pageCount: totalPages,
          total,
          onPageChange: (idx) => setPage(idx + 1),
          pageSize,
          onPageSizeChange: setPageSize,
        }}
      />

      <CreateShipmentDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={load}
      />
    </div>
  );
}


function CreateShipmentDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [order, setOrder] = React.useState<OrderRow | null>(null);
  const [couriers, setCouriers] = React.useState<CourierRow[]>([]);
  const [courierId, setCourierId] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setOrder(null);
    listCouriers({ page: 1, limit: 100, filters: { is_active: true } })
      .then((res) => {
        setCouriers(res.rows);
        setCourierId(res.rows[0] ? String(res.rows[0].id) : "");
      })
      .catch(() => setCouriers([]));
  }, [open]);

  const submit = async () => {
    if (!order || !courierId) return;
    setSaving(true);
    try {
      toast.success(await createShipmentRate({ courier_id: Number(courierId), order_id: order.id }));
      onOpenChange(false);
      onCreated();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't create the shipment."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create shipment</DialogTitle>
          <DialogDescription>
            Rates and a label are requested from the courier using the order&apos;s
            own shipping address and items.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Order</Label>
            {order ? (
              <div className="flex items-center justify-between rounded-lg border border-border p-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {order.order_number ?? `#${order.id}`}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {typeof order.customer === "string"
                      ? order.customer
                      : order.customer?.full_name ?? order.email ?? "—"}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Change order"
                  onClick={() => setOrder(null)}
                  className="rounded p-1 text-muted-foreground hover:bg-muted"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <OrderSearch onPick={setOrder} />
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Courier</Label>
            <Select
              items={Object.fromEntries(couriers.map((c) => [String(c.id), c.name]))}
              value={courierId}
              onValueChange={(v) => setCourierId(v as string)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a courier" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {couriers.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                    {c.code ? ` · ${c.code}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {couriers.length === 0 && (
              <p className="text-xs text-destructive">
                No active couriers — add one under Settings → Couriers.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!order || !courierId || saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {saving ? "Creating…" : "Create shipment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OrderSearch({ onPick }: { onPick: (o: OrderRow) => void }) {
  const [search, setSearch] = React.useState("");
  const [results, setResults] = React.useState<OrderRow[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const term = search.trim();
    if (!term) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      listOrders({ page: 1, limit: 8, search: term })
        .then((res) => setResults(res.rows))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <div className="relative">
      <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search by order number, name, email or phone"
        className="pl-8"
      />
      {open && search.trim() !== "" && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-md">
          {searching ? (
            <p className="flex items-center gap-2 px-3 py-2.5 text-sm text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Searching…
            </p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2.5 text-sm text-muted-foreground">
              No order matches “{search.trim()}”.
            </p>
          ) : (
            results.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  onPick(o);
                  setOpen(false);
                  setSearch("");
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
              >
                <Package className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{o.order_number ?? `#${o.id}`}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {typeof o.customer === "string"
                      ? o.customer
                      : o.customer?.full_name ?? o.email ?? "—"}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
