"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Boxes, Package, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/data-table";
import { DateRangePicker } from "@/components/date-range-picker";
import { StatusBadge } from "@/components/status-badge";
import { apiErrorMessage } from "@/lib/auth-api";
import { StockDialog } from "@/components/products/stock-dialog";
import { listProducts, type ProductRow } from "@/lib/admin-api";
import { cn, imgUrl } from "@/lib/utils";

const PAGE_SIZE = 20;

/** Quantity at or below this is flagged amber in the inventory column. */
const LOW_STOCK = 5;

const STATUS_ITEMS: Record<string, string> = {
  all: "All statuses",
  active: "Active",
  draft: "Draft",
  archived: "Archived",
};

const statusTone = (s?: string) =>
  s === "active" ? "success" : s === "archived" ? "neutral" : "warning";

const currency = (n?: number | null) =>
  n != null ? `$${n.toFixed(2)}` : "—";

const columns: ColumnDef<ProductRow>[] = [
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

      // The API omits stock on some products; that isn't the same as zero.
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
      if (typeof v === "object" && v !== null) return (v as { name?: string }).name ?? "—";
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
  const [stockTarget, setStockTarget] = React.useState<ProductRow | null>(null);
  const columnsWithStock = React.useMemo<ColumnDef<ProductRow>[]>(() => [
    ...columns,
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        // Products with variants track stock per variant; the row-level shortcut
        // would target a phantom product-level bucket, so hide it. Users can
        // adjust per-variant stock from the product's edit page.
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

  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
  const [refreshKey] = React.useState(0);

  const [debounced, setDebounced] = React.useState("");
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
    listProducts({
      page: page + 1,
      limit: PAGE_SIZE,
      dateRange,
      filters: {
        search: debounced || undefined,
        status: status === "all" ? undefined : status,
      },
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
  }, [page, debounced, status, dateRange, refreshKey]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Products</h1>
        <Button onClick={() => router.push("/products/new")}>
          <Plus className="size-4" />
          Add product
        </Button>
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
        <Select
          items={STATUS_ITEMS}
          value={status}
          onValueChange={(v) => setStatus(v as string)}
        >
          <SelectTrigger className="min-w-36 bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_ITEMS).map(([v, label]) => (
              <SelectItem key={v} value={v}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      <DataTable
        columns={columnsWithStock}
        data={rows}
        loading={loading}
        onRowClick={(row) => router.push(`/products/${row.id}`)}
        serverPagination={{ pageIndex: page, pageCount, total, onPageChange: setPage }}
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
