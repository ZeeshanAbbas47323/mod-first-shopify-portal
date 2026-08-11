"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { LayoutGrid, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/data-table";
import { StatusToggle } from "@/components/status-badge";
import { apiErrorMessage } from "@/lib/auth-api";
import { listProductCategories, updateRecordStatus, type ProductCategoryRow } from "@/lib/admin-api";
import { imgUrl } from "@/lib/utils";

const PAGE_SIZE = 20;

const imgSrc = (row: ProductCategoryRow) =>
  imgUrl(row.image_url ?? row.image ?? row.banner ?? row.icon ?? null) || null;

function getColumns(
  onToggleStatus: (row: ProductCategoryRow, next: boolean) => Promise<void>
): ColumnDef<ProductCategoryRow>[] {
  return [
  {
    accessorKey: "name",
    header: "Category",
    cell: ({ row }) => {
      const r = row.original;
      const src = imgSrc(r);
      return (
        <div className="flex items-center gap-3 min-w-0">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={r.name}
              className="size-10 shrink-0 rounded-lg border border-border object-cover"
            />
          ) : (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
              <LayoutGrid className="size-4 text-muted-foreground" />
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate font-medium">{r.name}</p>
            <p className="truncate font-mono text-xs text-muted-foreground">/{r.slug}</p>
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "parent",
    header: "Parent",
    cell: ({ row }) => row.original.parent?.name ?? "—",
  },
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ row }) => (
      <span className="block max-w-56 truncate text-sm text-muted-foreground">
        {row.original.description ?? "—"}
      </span>
    ),
  },
  {
    accessorKey: "products_count",
    header: "Products",
    cell: ({ row }) => {
      const n = row.original.products_count;
      return n != null ? <span className="text-sm">{n}</span> : "—";
    },
  },
  {
    accessorKey: "is_active",
    header: "Status",
    cell: ({ row }) => (
      <StatusToggle
        isActive={row.original.is_active !== false}
        onToggle={(next) => onToggleStatus(row.original, next)}
      />
    ),
  },
  {
    accessorKey: "created_at",
    header: "Created",
    cell: ({ row }) => {
      const d = row.original.created_at;
      if (!d) return "—";
      const date = new Date(d);
      return isNaN(date.getTime()) ? "—" : format(date, "MMM d, yyyy");
    },
  },
  ];
}

export default function ProductCategoriesPage() {
  const router = useRouter();
  const [rows, setRows] = React.useState<ProductCategoryRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(0);
  const [pageCount, setPageCount] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [refreshKey, setRefreshKey] = React.useState(0);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  React.useEffect(() => { setPage(0); }, [debounced]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listProductCategories({
      page: page + 1,
      limit: PAGE_SIZE,
      filters: { name: debounced || undefined },
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
        toast.error(apiErrorMessage(err, "Couldn't load categories."));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, debounced, refreshKey]);

  const handleToggleStatus = async (row: ProductCategoryRow, next: boolean) => {
    try {
      await updateRecordStatus("productCategory", row.id, next);
      toast.success(next ? "Category activated." : "Category deactivated.");
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't update status."));
    }
  };

  const columns = React.useMemo(() => getColumns(handleToggleStatus), []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Product Categories</h1>
        <Button onClick={() => router.push("/products/categories/new")}>
          <Plus className="size-4" />
          Add category
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative min-w-44 flex-1 sm:max-w-64">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search categories"
            className="bg-card pl-8"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        onRowClick={(row) => router.push(`/products/categories/${row.id}`)}
        serverPagination={{ pageIndex: page, pageCount, total, onPageChange: setPage }}
      />
    </div>
  );
}
