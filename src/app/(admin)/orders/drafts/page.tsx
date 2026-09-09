"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Download, Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/data-table";
import { MultiSelectFilter } from "@/components/multi-select-filter";
import { SummaryStatStrip, type SummaryTile } from "@/components/summary-stat-strip";
import {
  CustomerPreviewPopover,
  FulfillmentPreviewPopover,
  pickupOrDeliveryBlurb,
} from "@/components/orders/order-popovers";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DateRangePicker } from "@/components/date-range-picker";
import { StatusBadge, type BadgeTone } from "@/components/status-badge";
import { apiErrorMessage } from "@/lib/auth-api";
import { usePermissions } from "@/stores/menu-store";
import { exportRowsToCsv } from "@/lib/utils";
import {
  DRAFT_STATUSES,
  DRAFT_STATUS_LABELS,
  ORDER_CHANNELS,
  listDraftOrders,
  getDraftOrdersSummary,
  type DraftOrderRow,
  type DraftOrdersSummary,
} from "@/lib/admin-api";

const DEFAULT_PAGE_SIZE = 20;
const EXPORT_CAP = 5000;

export const DRAFT_TONES: Record<string, BadgeTone> = {
  open: "attention",
  invoice_sent: "info",
  completed: "success",
  cancelled: "neutral",
};

const money = (v?: number | string | null) =>
  Number(v ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD" });

const humanize = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const customerName = (row: DraftOrderRow) =>
  row.customer?.full_name ?? row.full_name ?? row.email ?? "No customer";

const draftCustomerPreview = (row: DraftOrderRow) => ({
  user_id: row.user_id,
  name: customerName(row),
  email: row.email ?? row.customer?.email,
  city: row.shippingAddr?.city,
  country: row.shippingAddr?.country,
});

const draftFulfillmentPreview = (row: DraftOrderRow) => ({
  items: (row.items ?? []).map((item, i) => ({
    id: item.id ?? item.product_id ?? i,
    name: item.product?.name ?? item.product?.title ?? "Product",
    variant: item.variant?.sku ? `SKU: ${item.variant.sku}` : null,
    quantity: item.quantity ?? 1,
    image: item.product?.images?.[0]?.image_url,
  })),
  deliveryBlurb: pickupOrDeliveryBlurb({
    delivery_type: row.delivery_type,
    pickupLocationName: row.pickupLoc?.name,
  }),
});

const EMPTY_SUMMARY: DraftOrdersSummary = {
  drafts: { current: 0, previous: 0, change_percent: null },
  open_value: { current: 0, previous: 0, change_percent: null },
  invoice_sent: { current: 0, previous: 0, change_percent: null },
  completed: { current: 0, previous: 0, change_percent: null },
};

const exportColumns = [
  { key: "draft_number", label: "Draft", value: (r: DraftOrderRow) => r.draft_number ?? `#${r.id}` },
  { key: "date", label: "Date", value: (r: DraftOrderRow) => r.created_at ?? "" },
  { key: "customer", label: "Customer", value: (r: DraftOrderRow) => customerName(r) },
  { key: "email", label: "Email", value: (r: DraftOrderRow) => r.email ?? "" },
  { key: "status", label: "Status", value: (r: DraftOrderRow) => (r.status ? DRAFT_STATUS_LABELS[r.status] ?? r.status : "") },
  { key: "channel", label: "Channel", value: (r: DraftOrderRow) => (r.channel ? humanize(r.channel) : "") },
  { key: "items", label: "Items", value: (r: DraftOrderRow) => r.items?.length ?? 0 },
  { key: "total", label: "Total", value: (r: DraftOrderRow) => r.total_amount ?? "" },
];

export default function DraftOrdersPage() {
  const permissions = usePermissions("/orders/drafts");
  const router = useRouter();

  const [rows, setRows] = React.useState<DraftOrderRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(0);
  const [pageSize, setPageSize] = React.useState<number>(DEFAULT_PAGE_SIZE);
  const [pageCount, setPageCount] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [selected, setSelected] = React.useState<DraftOrderRow[]>([]);
  const [clearKey, setClearKey] = React.useState(0);
  const [exportBusy, setExportBusy] = React.useState(false);

  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [statuses, setStatuses] = React.useState<string[]>([]);
  const [channels, setChannels] = React.useState<string[]>([]);
  // Unset by default — drafts can sit open far longer than an order, so
  // scoping to "last 30 days" the way Orders does would hide most of them.
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();

  const [summary, setSummary] = React.useState<DraftOrdersSummary>(EMPTY_SUMMARY);
  const [summaryLoading, setSummaryLoading] = React.useState(true);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  React.useEffect(() => {
    setPage(0);
  }, [debounced, statuses, channels, dateRange]);

  const activeFilters = React.useMemo(
    () => ({
      search: debounced || undefined,
      dateRange,
      status: statuses,
      channel: channels,
    }),
    [debounced, dateRange, statuses, channels]
  );

  const load = React.useCallback(() => {
    setLoading(true);
    listDraftOrders({
      page: page + 1,
      limit: pageSize,
      search: activeFilters.search,
      dateRange: activeFilters.dateRange,
      sortBy: "created_at",
      sortOrder: "desc",
      filters: {
        status: activeFilters.status.length ? activeFilters.status : undefined,
        channel: activeFilters.channel.length ? activeFilters.channel : undefined,
      },
    })
      .then((res) => {
        setRows(res.rows);
        setTotal(res.total);
        setPageCount(res.totalPages);
      })
      .catch((error) => {
        setRows([]);
        toast.error(apiErrorMessage(error, "Couldn't load draft orders."));
      })
      .finally(() => setLoading(false));
  }, [page, pageSize, activeFilters]);

  React.useEffect(() => { load(); }, [load]);

  React.useEffect(() => {
    let cancelled = false;
    setSummaryLoading(true);
    getDraftOrdersSummary(activeFilters)
      .then((s) => !cancelled && setSummary(s))
      .catch(() => !cancelled && setSummary(EMPTY_SUMMARY))
      .finally(() => !cancelled && setSummaryLoading(false));
    return () => { cancelled = true; };
  }, [activeFilters]);

  const runExport = async (scope: "selected" | "all") => {
    setExportBusy(true);
    try {
      const exportRows =
        scope === "selected"
          ? selected
          : (
              await listDraftOrders({
                page: 1,
                limit: EXPORT_CAP,
                search: activeFilters.search,
                dateRange: activeFilters.dateRange,
                filters: {
                  status: activeFilters.status.length ? activeFilters.status : undefined,
                  channel: activeFilters.channel.length ? activeFilters.channel : undefined,
                },
              })
            ).rows;
      if (!exportRows.length) {
        toast.error("Nothing to export.");
        return;
      }
      exportRowsToCsv(`drafts-${format(new Date(), "yyyy-MM-dd")}`, exportColumns, exportRows);
      toast.success(`Exported ${exportRows.length} draft${exportRows.length === 1 ? "" : "s"}.`);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't export drafts."));
    } finally {
      setExportBusy(false);
    }
  };

  const tiles: SummaryTile[] = [
    { label: "Drafts", value: summary.drafts.current.toLocaleString("en-US"), changePercent: summary.drafts.change_percent },
    { label: "Open value", value: money(summary.open_value.current), changePercent: summary.open_value.change_percent },
    { label: "Invoice sent", value: summary.invoice_sent.current.toLocaleString("en-US"), changePercent: summary.invoice_sent.change_percent },
    { label: "Completed", value: summary.completed.current.toLocaleString("en-US"), changePercent: summary.completed.change_percent },
  ];

  const columns = React.useMemo<ColumnDef<DraftOrderRow>[]>(
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
        accessorKey: "draft_number",
        header: "Draft",
        cell: ({ row }) => (
          <span className="font-mono font-medium">
            {row.original.draft_number ?? `#${row.original.id}`}
          </span>
        ),
      },
      {
        accessorKey: "created_at",
        header: "Date",
        cell: ({ row }) => {
          const v = row.original.created_at;
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
        accessorKey: "full_name",
        header: "Customer",
        cell: ({ row }) => (
          <div className="min-w-0" onClick={(e) => e.stopPropagation()}>
            <CustomerPreviewPopover customer={draftCustomerPreview(row.original)} />
            {row.original.email && (
              <p className="truncate text-xs text-muted-foreground">
                {row.original.email}
              </p>
            )}
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
              status={DRAFT_STATUS_LABELS[s] ?? s}
              tone={DRAFT_TONES[s] ?? "neutral"}
            />
          );
        },
      },
      {
        accessorKey: "channel",
        header: "Channel",
        cell: ({ row }) =>
          row.original.channel ? humanize(row.original.channel) : "—",
      },
      {
        accessorKey: "items",
        header: "Items",
        cell: ({ row }) => <FulfillmentPreviewPopover {...draftFulfillmentPreview(row.original)} />,
      },
      {
        accessorKey: "total_amount",
        header: () => <div className="text-right">Total</div>,
        cell: ({ row }) => (
          <div className="text-right font-medium tabular-nums">
            {money(row.original.total_amount)}
          </div>
        ),
      },
    ],
    []
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Drafts</h1>
          <p className="text-sm text-muted-foreground">
            Orders you build for a customer — no stock or payment is taken until
            you complete them.
          </p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={exportBusy}
              render={
                <Button variant="outline">
                  {exportBusy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                  Export
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuItem disabled={!selected.length} onClick={() => runExport("selected")}>
                Export {selected.length || ""} selected draft{selected.length === 1 ? "" : "s"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => runExport("all")}>
                Export all drafts matching filters ({total})
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {permissions.can_create && (
            <Button render={<Link href="/orders/drafts/new" />}>
              <Plus className="size-4" />
              Create draft order
            </Button>
          )}
        </div>
      </div>

      <SummaryStatStrip tiles={tiles} loading={summaryLoading} />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-44 flex-1 sm:max-w-64">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search draft, name, email or phone"
            className="bg-card pl-8"
          />
        </div>
        <MultiSelectFilter label="Status" options={DRAFT_STATUSES} value={statuses} onChange={setStatuses} />
        <MultiSelectFilter label="Channel" options={ORDER_CHANNELS} value={channels} onChange={setChannels} />
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-3 py-2">
          <span className="text-sm font-medium">
            {selected.length} draft{selected.length === 1 ? "" : "s"} selected
          </span>
          <Button size="sm" variant="outline" disabled={exportBusy} onClick={() => runExport("selected")}>
            {exportBusy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            Export selected
          </Button>
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
        onRowClick={(row) => router.push(`/orders/drafts/${row.id}`)}
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
