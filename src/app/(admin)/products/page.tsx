"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Boxes, Package, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { fetchAllPages } from "@/lib/export";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { MultiSelectFilter } from "@/components/multi-select-filter";
import { DataTable, type ColumnFilterDef } from "@/components/data-table";
import { ExportMenu } from "@/components/export-menu";
import { DateRangePicker } from "@/components/date-range-picker";
import { StatusBadge } from "@/components/status-badge";
import { apiErrorMessage } from "@/lib/auth-api";
import { usePermissions } from "@/stores/menu-store";
import { StockDialog } from "@/components/products/stock-dialog";
import { listProducts, type ProductRow } from "@/lib/admin-api";
import { cn, imgUrl } from "@/lib/utils";

const DEFAULT_PAGE_SIZE = 20;
const EXPORT_CAP = 5000;
const PRODUCT_STATUSES = ["active", "draft", "archived"] as const;

const PRODUCT_SORT_MAP = {
  title: { asc: "a_z", desc: "z_a" },
  price: { asc: "price_low_high", desc: "price_high_low" },
  created_at: { asc: "oldest", desc: "newest" },
} as const;

const LOW_STOCK = 5;

const statusTone = (s?: string) =>
  s === "active" ? "success" : s === "archived" ? "neutral" : "warning";

const currency = (n?: number | null) =>
  n != null ? `$${n.toFixed(2)}` : "—";

const catName = (row: ProductRow) => {
  const cat = row.category;
  if (!cat) return "";
  if (typeof cat === "object") return (cat as { name?: string }).name ?? "";
  return String(cat);
};

const vendorName = (row: ProductRow) => {
  const v = row.vendor;
  if (!v) return "";
  if (typeof v === "object") {
    const o = v as { vendor_name?: string; name?: string };
    return o.vendor_name ?? o.name ?? "";
  }
  return String(v);
};

const COLUMN_FILTERS: Record<string, ColumnFilterDef> = {
  title: { type: "text", placeholder: "Search products" },
  status: { type: "select", options: PRODUCT_STATUSES, placeholder: "Any" },
};

const exportColumns = [
  { key: "title", label: "Product", value: (r: ProductRow) => r.title },
  { key: "slug", label: "Slug", value: (r: ProductRow) => r.slug ?? "" },
  { key: "status", label: "Status", value: (r: ProductRow) => r.status ?? "" },
  { key: "quantity", label: "Inventory", value: (r: ProductRow) => r.quantity ?? "" },
  { key: "category", label: "Category", value: (r: ProductRow) => catName(r) },
  { key: "vendor", label: "Vendor", value: (r: ProductRow) => vendorName(r) },
  { key: "price", label: "Price", value: (r: ProductRow) => r.price ?? "" },
  { key: "created_at", label: "Added", value: (r: ProductRow) => r.created_at ?? "" },
];

const columns: ColumnDef<ProductRow>[] = [
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
    accessorKey: "title",
    header: "Product",
    size: 320,
    cell: ({ row }) => {
      const r = row.original;
      return (
        <div className="flex items-center gap-3 min-w-0 max-w-xs">
          {r.featured_image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imgUrl(r.featured_image)}
              alt={r.title}
              className="size-10 shrink-0 rounded-lg border border-border object-cover"
            />
          ) : (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
              <Package className="size-4 text-muted-foreground" />
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate font-medium">{r.title}</p>
            {r.slug && (
              <p className="truncate font-mono text-xs text-muted-foreground">
                /products/{r.slug}
              </p>
            )}
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const s = row.original.status ?? "draft";
      return (
        <StatusBadge
          status={s.charAt(0).toUpperCase() + s.slice(1)}
          tone={statusTone(s)}
        />
      );
    },
  },
  {
    accessorKey: "quantity",
    header: "Inventory",
    cell: ({ row }) => {
      const r = row.original;
      const qty = r.quantity;
      const vc = r.variants_count;

      if (qty == null) {
        return <span className="text-sm text-muted-foreground">—</span>;
      }
      const suffix =
        vc && vc > 0 ? ` across ${vc} variant${vc > 1 ? "s" : ""}` : "";
      return (
        <span
          className={cn(
            "text-sm",
            qty === 0 && "text-destructive",
            qty > 0 && qty <= LOW_STOCK && "text-[#b98900]"
          )}
        >
          {qty === 0 ? `Out of stock${suffix}` : `${qty} in stock${suffix}`}
        </span>
      );
    },
  },
  {
    accessorKey: "category",
    header: "Category",
    cell: ({ row }) => {
      const cat = row.original.category;
      if (!cat) return "—";
      if (typeof cat === "object" && cat !== null) return (cat as { name?: string }).name ?? "—";
      return String(cat);
    },
  },
  {
    accessorKey: "vendor",
    header: "Vendor",
    cell: ({ row }) => {
      const v = row.original.vendor;
      if (!v) return "—";
      if (typeof v === "object" && v !== null) {
        const o = v as { vendor_name?: string; name?: string };
        return o.vendor_name ?? o.name ?? "—";
      }
      return String(v);
    },
  },
  {
    accessorKey: "price",
    header: () => <div className="text-right">Price</div>,
    cell: ({ row }) => (
      <div className="text-right font-medium">{currency(row.original.price)}</div>
    ),
  },
  {
    accessorKey: "created_at",
    header: "Added",
    cell: ({ row }) => {
      const d = row.original.created_at;
      if (!d) return "—";
      const date = new Date(d);
      return isNaN(date.getTime()) ? "—" : format(date, "MMM d, yyyy");
    },
  },
];

export default function ProductsPage() {
  const permissions = usePermissions("/products");
  const [stockTarget, setStockTarget] = React.useState<ProductRow | null>(null);
  const columnsWithStock = React.useMemo<ColumnDef<ProductRow>[]>(() => [
    ...columns,
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const hasVariants = (row.original.variants_count ?? 0) > 0;
        if (hasVariants) return null;
        return (
          <Button
            size="sm"
            variant="ghost"
            className="size-8 p-0"
            onClick={(e) => { e.stopPropagation(); setStockTarget(row.original); }}
            aria-label="Manage stock"
          >
            <Boxes className="size-4" />
          </Button>
        );
      },
    },
  ], []);
  const router = useRouter();
  const [rows, setRows] = React.useState<ProductRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(0);
  const [pageCount, setPageCount] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [selected, setSelected] = React.useState<ProductRow[]>([]);
  const [clearKey, setClearKey] = React.useState(0);

  const [pageSize, setPageSize] = React.useState<number>(DEFAULT_PAGE_SIZE);
  const [sortBy, setSortBy] = React.useState<string | undefined>();
  const [order, setOrder] = React.useState<"asc" | "desc">("desc");

  const [search, setSearch] = React.useState("");
  const [statuses, setStatuses] = React.useState<string[]>([]);
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
  const [refreshKey] = React.useState(0);

  const [debounced, setDebounced] = React.useState("");
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  React.useEffect(() => {
    setPage(0);
  }, [debounced, statuses, dateRange, pageSize, sortBy, order]);

  const activeFilters = React.useMemo(
    () => ({
      dateRange,
      search: debounced || undefined,
      status: statuses.length ? statuses : undefined,
    }),
    [dateRange, debounced, statuses]
  );

  const columnFilterValues = React.useMemo(() => {
    const values: Record<string, string[]> = {};
    if (search) values.title = [search];
    if (statuses.length) values.status = statuses;
    return values;
  }, [search, statuses]);

  const applyColumnFilters = React.useCallback((next: Record<string, string[]>) => {
    setSearch(next.title?.[0] ?? "");
    setStatuses(next.status ?? []);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listProducts({
      page: page + 1,
      limit: pageSize,
      dateRange: activeFilters.dateRange,
      search: activeFilters.search,
      sortBy,
      order,
      filters: { status: activeFilters.status },
    })
      .then((res) => {
        if (cancelled) return;
        setRows(res.rows);
        setTotal(res.total);
        setPageCount(res.totalPages);
      })
      .catch((err) => {
        if (cancelled) return;
        setRows([]);
        toast.error(apiErrorMessage(err, "Couldn't load products."));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, sortBy, order, activeFilters, refreshKey]);

  const fetchAllForExport = React.useCallback(
    async () =>
      fetchAllPages((page, limit) => listProducts({
          page, limit,
          dateRange: activeFilters.dateRange, search: activeFilters.search,
          filters: { status: activeFilters.status },
        }), EXPORT_CAP),
    [activeFilters]
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Products</h1>
        <div className="flex gap-2">
          <ExportMenu
            filename="products"
            columns={exportColumns}
          selected={selected}
            fetchAll={fetchAllForExport}
            total={total}
            noun="product"
          />
          {permissions.can_create && (
            <Button onClick={() => router.push("/products/new")}>
              <Plus className="size-4" />
              Add product
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-44 flex-1 sm:max-w-64">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products"
            className="bg-card pl-8"
          />
        </div>
        <MultiSelectFilter label="Status" options={PRODUCT_STATUSES} value={statuses} onChange={setStatuses} />
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-3 py-2">
          <span className="text-sm font-medium">
            {selected.length} product{selected.length === 1 ? "" : "s"} selected
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
        columns={columnsWithStock}
        data={rows}
        loading={loading}
        onSelectionChange={setSelected}
        clearSelectionKey={clearKey}
        onRowClick={(row) => router.push(`/products/${row.id}`)}
        columnFilterDefs={COLUMN_FILTERS}
        serverColumnFilters={{ value: columnFilterValues, onChange: applyColumnFilters }}
        serverPagination={{
          pageIndex: page,
          pageCount,
          total,
          onPageChange: setPage,
          pageSize,
          onPageSizeChange: setPageSize,
        }}
        serverSort={{
          sortBy,
          order,
          columnMap: PRODUCT_SORT_MAP,
          onSortChange: (by, dir) => {
            setSortBy(by);
            setOrder(dir);
          },
        }}
      />

      {stockTarget && (
        <StockDialog
          open={!!stockTarget}
          onOpenChange={(v) => !v && setStockTarget(null)}
          productId={stockTarget.id}
          productName={stockTarget.title}
        />
      )}
    </div>
  );
}
