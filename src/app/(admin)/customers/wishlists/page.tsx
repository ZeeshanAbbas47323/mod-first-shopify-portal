"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Heart, Search } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/data-table";
import { DateRangePicker } from "@/components/date-range-picker";
import { StatusBadge } from "@/components/status-badge";
import { apiErrorMessage } from "@/lib/auth-api";
import { imgUrl } from "@/lib/utils";
import { listWishlists, type WishlistRow } from "@/lib/admin-api";

const PAGE_SIZE = 20;

const STATUS_ITEMS: Record<string, string> = {
  all: "All saves",
  active: "Active",
  inactive: "Removed",
};

const money = (v?: number | string | null) =>
  v != null
    ? Number(v).toLocaleString("en-US", { style: "currency", currency: "USD" })
    : "—";

const productName = (row: WishlistRow) =>
  row.product?.title ?? row.product?.name ?? `Product #${row.product_id}`;

const customerName = (row: WishlistRow) =>
  row.user?.full_name ?? row.user?.name ?? (row.user_id != null ? `User #${row.user_id}` : "—");

function SummaryCard({
  label,
  value,
  loading,
}: {
  label: string;
  value: string;
  loading: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 p-4">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {loading ? (
        <Skeleton className="mt-1 h-6 w-20" />
      ) : (
        <span className="text-xl font-bold tracking-tight">{value}</span>
      )}
    </div>
  );
}

export default function WishlistsPage() {
  const [rows, setRows] = React.useState<WishlistRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(0);
  const [pageCount, setPageCount] = React.useState(1);
  const [total, setTotal] = React.useState(0);

  const [productId, setProductId] = React.useState("");
  const [debouncedProduct, setDebouncedProduct] = React.useState("");
  const [status, setStatus] = React.useState("active");
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedProduct(productId), 400);
    return () => clearTimeout(t);
  }, [productId]);

  React.useEffect(() => {
    setPage(0);
  }, [debouncedProduct, status, dateRange]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listWishlists({
      page: page + 1,
      limit: PAGE_SIZE,
      dateRange,
      filters: {
        product_id: debouncedProduct ? Number(debouncedProduct) : undefined,
        is_active: status === "all" ? undefined : status === "active",
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
        toast.error(apiErrorMessage(error, "Couldn't load wishlists."));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, debouncedProduct, status, dateRange]);

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

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold">Wishlists</h1>
        <p className="text-sm text-muted-foreground">
          Products customers have saved — what they want but haven&apos;t bought yet.
        </p>
      </div>

      <Card className="py-0 shadow-none">
        <CardContent className="grid grid-cols-2 divide-y p-0 lg:grid-cols-4 lg:divide-x lg:divide-y-0">
          <SummaryCard
            label="Total saves"
            value={total.toLocaleString("en-US")}
            loading={loading}
          />
          {topProducts.map((p, i) => (
            <SummaryCard
              key={p.name}
              label={`Most saved${i > 0 ? ` #${i + 1}` : ""}`}
              value={`${p.name} · ${p.count}`}
              loading={loading}
            />
          ))}
        </CardContent>
      </Card>

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
        <Select items={STATUS_ITEMS} value={status} onValueChange={(v) => setStatus(v as string)}>
          <SelectTrigger className="min-w-32 bg-card">
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
        columns={columns}
        data={rows}
        loading={loading}
        serverPagination={{
          pageIndex: page,
          pageCount,
          total,
          onPageChange: setPage,
        }}
      />
    </div>
  );
}
