"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Download, Heart, Loader2, Search } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { MultiSelectFilter } from "@/components/multi-select-filter";
import { SummaryStatStrip, type SummaryTile } from "@/components/summary-stat-strip";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTable } from "@/components/data-table";
import { DateRangePicker } from "@/components/date-range-picker";
import { StatusBadge } from "@/components/status-badge";
import { apiErrorMessage } from "@/lib/auth-api";
import { exportRowsToCsv, imgUrl } from "@/lib/utils";
import { listWishlists, type WishlistRow } from "@/lib/admin-api";

const DEFAULT_PAGE_SIZE = 20;
const EXPORT_CAP = 5000;

const STATUS_OPTIONS = ["active", "inactive"] as const;

const money = (v?: number | string | null) =>
  v != null
    ? Number(v).toLocaleString("en-US", { style: "currency", currency: "USD" })
    : "—";

const productName = (row: WishlistRow) =>
  row.product?.title ?? row.product?.name ?? `Product #${row.product_id}`;

const customerName = (row: WishlistRow) =>
  row.user?.full_name ?? row.user?.name ?? (row.user_id != null ? `User #${row.user_id}` : "—");

const exportColumns = [
  { key: "product", label: "Product", value: (r: WishlistRow) => productName(r) },
  { key: "customer", label: "Customer", value: (r: WishlistRow) => customerName(r) },
  { key: "email", label: "Email", value: (r: WishlistRow) => r.user?.email ?? "" },
  { key: "stock", label: "Stock", value: (r: WishlistRow) => r.product?.quantity ?? "" },
  { key: "status", label: "Status", value: (r: WishlistRow) => (r.is_active === false ? "Removed" : "Saved") },
  { key: "created_at", label: "Saved on", value: (r: WishlistRow) => r.created_at ?? "" },
];

export default function WishlistsPage() {
  const [rows, setRows] = React.useState<WishlistRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(0);
  const [pageSize, setPageSize] = React.useState<number>(DEFAULT_PAGE_SIZE);
  const [pageCount, setPageCount] = React.useState(1);
  const [total, setTotal] = React.useState(0);

  const [selected, setSelected] = React.useState<WishlistRow[]>([]);
  const [clearKey, setClearKey] = React.useState(0);
  const [exportBusy, setExportBusy] = React.useState(false);

  const [productId, setProductId] = React.useState("");
  const [debouncedProduct, setDebouncedProduct] = React.useState("");
  const [statuses, setStatuses] = React.useState<string[]>(["active"]);
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedProduct(productId), 400);
    return () => clearTimeout(t);
  }, [productId]);

  React.useEffect(() => {
    setPage(0);
  }, [debouncedProduct, statuses, dateRange]);

  const activeFilters = React.useMemo(
    () => ({
      dateRange,
      product_id: debouncedProduct ? Number(debouncedProduct) : undefined,
      // Both picked (or neither) means no opinion; one pick narrows it.
      is_active: statuses.length === 1 ? statuses[0] === "active" : undefined,
    }),
    [dateRange, debouncedProduct, statuses]
  );

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listWishlists({
      page: page + 1,
      limit: pageSize,
      dateRange: activeFilters.dateRange,
      filters: { product_id: activeFilters.product_id, is_active: activeFilters.is_active },
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
        toast.error(apiErrorMessage(error, "Couldn't load wishlists."));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, activeFilters]);

  const runExport = async (scope: "selected" | "all") => {
    setExportBusy(true);
    try {
      const exportRows =
        scope === "selected"
          ? selected
          : (
              await listWishlists({
                page: 1, limit: EXPORT_CAP, dateRange: activeFilters.dateRange,
                filters: { product_id: activeFilters.product_id, is_active: activeFilters.is_active },
              })
            ).rows;
      if (!exportRows.length) {
        toast.error("Nothing to export.");
        return;
      }
      exportRowsToCsv(`wishlists-${format(new Date(), "yyyy-MM-dd")}`, exportColumns, exportRows);
      toast.success(`Exported ${exportRows.length} save${exportRows.length === 1 ? "" : "s"}.`);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't export wishlists."));
    } finally {
      setExportBusy(false);
    }
  };

  // Most-saved products on the current page — a quick demand signal.
  const topProducts = React.useMemo(() => {
    const counts = new Map<string, { name: string; count: number }>();
    rows.forEach((r) => {
      const key = String(r.product_id);
      const entry = counts.get(key) ?? { name: productName(r), count: 0 };
      entry.count += 1;
      counts.set(key, entry);
    });
    return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 3);
  }, [rows]);

  const columns = React.useMemo<ColumnDef<WishlistRow>[]>(
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
        accessorKey: "product_id",
        header: "Product",
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-2.5">
            {row.original.product?.featured_image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imgUrl(row.original.product.featured_image)}
                alt=""
                className="size-9 rounded-lg border border-border object-cover"
              />
            ) : (
              <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-muted">
                <Heart className="size-4 text-muted-foreground" />
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate font-medium">{productName(row.original)}</p>
              <p className="truncate text-xs text-muted-foreground">
                {money(row.original.product?.price)}
              </p>
            </div>
          </div>
        ),
      },
      {
        accessorKey: "user_id",
        header: "Customer",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate">{customerName(row.original)}</p>
            {row.original.user?.email && (
              <p className="truncate text-xs text-muted-foreground">
                {row.original.user.email}
              </p>
            )}
          </div>
        ),
      },
      {
        id: "stock",
        header: "Stock",
        cell: ({ row }) => {
          const qty = row.original.product?.quantity;
          if (qty == null) return <span className="text-muted-foreground">—</span>;
          return (
            <StatusBadge
              status={qty > 0 ? `${qty} in stock` : "Out of stock"}
              tone={qty > 0 ? "success" : "critical"}
            />
          );
        },
      },
      {
        accessorKey: "is_active",
        header: "Status",
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.is_active === false ? "Removed" : "Saved"}
            tone={row.original.is_active === false ? "neutral" : "info"}
          />
        ),
      },
      {
        accessorKey: "created_at",
        header: "Saved on",
        cell: ({ row }) => {
          const d = row.original.created_at;
          if (!d) return "—";
          const date = new Date(d);
          return isNaN(date.getTime()) ? "—" : format(date, "MMM d, yyyy");
        },
      },
    ],
    []
  );

  const tiles: SummaryTile[] = [
    { label: "Total saves", value: total.toLocaleString("en-US") },
    ...topProducts.map((p, i) => ({
      label: `Most saved${i > 0 ? ` #${i + 1}` : ""}`,
      value: `${p.name} · ${p.count}`,
    })),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Wishlists</h1>
          <p className="text-sm text-muted-foreground">
            Products customers have saved — what they want but haven&apos;t bought yet.
          </p>
        </div>
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
              Export {selected.length || ""} selected save{selected.length === 1 ? "" : "s"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => runExport("all")}>
              Export all matching filters ({total})
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <SummaryStatStrip tiles={tiles} loading={loading} />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-44 sm:max-w-48">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={productId}
            onChange={(e) => setProductId(e.target.value.replace(/\D/g, ""))}
            placeholder="Filter by product ID"
            inputMode="numeric"
            className="bg-card pl-8"
          />
        </div>
        <MultiSelectFilter label="Status" options={STATUS_OPTIONS} value={statuses} onChange={setStatuses} />
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-3 py-2">
          <span className="text-sm font-medium">
            {selected.length} save{selected.length === 1 ? "" : "s"} selected
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
