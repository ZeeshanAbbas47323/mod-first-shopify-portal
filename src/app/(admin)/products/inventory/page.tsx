"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { AlertTriangle, ArrowDown, ArrowUp, PackageX, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/data-table";
import { StatusBadge, type BadgeTone } from "@/components/status-badge";
import { StockDialog } from "@/components/products/stock-dialog";
import { apiErrorMessage } from "@/lib/auth-api";
import { cn } from "@/lib/utils";
import {
  fetchAllProductCategories,
  getInventoryReport,
  listInventoryLogs,
  type InventoryLogRow,
  type InventoryReportRow,
  type InventoryReportSummary,
  type ProductCategoryRow,
} from "@/lib/admin-api";

const LOGS_PAGE_SIZE = 20;
const DEFAULT_THRESHOLD = 5;

const fmtN = (n?: number | null) =>
  n != null ? Number(n).toLocaleString("en-US") : "—";

const fmt$ = (n?: number | null) =>
  n != null
    ? `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "—";

const REASON_LABELS: Record<string, string> = {
  STOCK_IN: "Stock in",
  STOCK_OUT: "Stock out",
  MANUAL_ADJUSTMENT: "Manual adjustment",
  ORDER_PLACED: "Order placed",
  ORDER_CANCELLED: "Order cancelled",
  RETURNED: "Returned",
  DAMAGED: "Damaged",
};

const REASON_TONES: Record<string, BadgeTone> = {
  STOCK_IN: "success",
  STOCK_OUT: "warning",
  MANUAL_ADJUSTMENT: "info",
  ORDER_PLACED: "info",
  ORDER_CANCELLED: "neutral",
  RETURNED: "attention",
  DAMAGED: "critical",
};

/** The report may not label status, so derive it from the quantity. */
function stockStatus(row: InventoryReportRow, threshold: number) {
  if (row.status) return row.status;
  const qty = Number(row.quantity ?? 0);
  if (qty <= 0) return "out_of_stock";
  return qty <= threshold ? "low_stock" : "in_stock";
}

const STATUS_META: Record<string, { label: string; tone: BadgeTone }> = {
  in_stock: { label: "In stock", tone: "success" },
  low_stock: { label: "Low stock", tone: "warning" },
  out_of_stock: { label: "Out of stock", tone: "critical" },
};

// ─── Summary cards ────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  loading,
  tone,
  icon,
}: {
  label: string;
  value: string;
  loading: boolean;
  tone?: "warning" | "critical";
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      {loading ? (
        <Skeleton className="mt-1 h-6 w-20" />
      ) : (
        <span
          className={cn(
            "text-xl font-bold tracking-tight",
            tone === "warning" && "text-[#b98900]",
            tone === "critical" && "text-[#e51c00]"
          )}
        >
          {value}
        </span>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const [tab, setTab] = React.useState<"stock" | "activity">("stock");

  // Stock levels
  const [rows, setRows] = React.useState<InventoryReportRow[]>([]);
  const [summary, setSummary] = React.useState<InventoryReportSummary>({});
  const [loading, setLoading] = React.useState(true);
  const [categories, setCategories] = React.useState<ProductCategoryRow[]>([]);
  const [categoryId, setCategoryId] = React.useState("all");
  const [lowOnly, setLowOnly] = React.useState(false);
  const [threshold, setThreshold] = React.useState(DEFAULT_THRESHOLD);
  const [thresholdInput, setThresholdInput] = React.useState(String(DEFAULT_THRESHOLD));
  const [search, setSearch] = React.useState("");
  const [refreshKey, setRefreshKey] = React.useState(0);

  // Adjust dialog
  const [stockTarget, setStockTarget] = React.useState<InventoryReportRow | null>(null);

  // Activity log
  const [logs, setLogs] = React.useState<InventoryLogRow[]>([]);
  const [logsLoading, setLogsLoading] = React.useState(false);
  const [logPage, setLogPage] = React.useState(0);
  const [logPageCount, setLogPageCount] = React.useState(1);
  const [logTotal, setLogTotal] = React.useState(0);

  React.useEffect(() => {
    fetchAllProductCategories()
      .then(setCategories)
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getInventoryReport({
      category_id: categoryId === "all" ? undefined : Number(categoryId),
      low_stock_only: lowOnly || undefined,
      threshold,
    })
      .then((res) => {
        if (cancelled) return;
        setRows(res.rows);
        setSummary(res.summary ?? {});
      })
      .catch((error) => {
        if (cancelled) return;
        setRows([]);
        setSummary({});
        toast.error(apiErrorMessage(error, "Couldn't load inventory."));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [categoryId, lowOnly, threshold, refreshKey]);

  React.useEffect(() => {
    if (tab !== "activity") return;
    let cancelled = false;
    setLogsLoading(true);
    listInventoryLogs({ page: logPage + 1, limit: LOGS_PAGE_SIZE })
      .then((res) => {
        if (cancelled) return;
        setLogs(res.rows);
        setLogTotal(res.total);
        setLogPageCount(res.totalPages);
      })
      .catch((error) => {
        if (cancelled) return;
        setLogs([]);
        toast.error(apiErrorMessage(error, "Couldn't load stock activity."));
      })
      .finally(() => !cancelled && setLogsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [tab, logPage, refreshKey]);

  const visibleRows = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) =>
      `${r.name ?? r.title ?? ""} ${r.sku ?? ""}`.toLowerCase().includes(term)
    );
  }, [rows, search]);

  // The report may omit the summary — derive the headline numbers from the rows.
  const stats = React.useMemo(() => {
    const derived = rows.reduce(
      (acc, r) => {
        const qty = Number(r.quantity ?? 0);
        const status = stockStatus(r, threshold);
        acc.units += qty;
        acc.value += Number(r.stock_value ?? (r.cost_price ?? 0) * qty);
        if (status === "low_stock") acc.low += 1;
        if (status === "out_of_stock") acc.out += 1;
        return acc;
      },
      { units: 0, value: 0, low: 0, out: 0 }
    );
    return {
      skus: summary.total_skus ?? rows.length,
      units: summary.total_units ?? derived.units,
      value: summary.total_stock_value ?? derived.value,
      low: summary.low_stock_count ?? derived.low,
      out: summary.out_of_stock_count ?? derived.out,
    };
  }, [rows, summary, threshold]);

  const stockColumns = React.useMemo<ColumnDef<InventoryReportRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Product",
        cell: ({ row }) => (
          <div className="min-w-0 max-w-72">
            <p className="truncate font-medium">
              {row.original.name ?? row.original.title ?? "—"}
            </p>
            <p className="truncate font-mono text-xs text-muted-foreground">
              {row.original.sku || "No SKU"}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "category",
        header: "Category",
        cell: ({ row }) => row.original.category || "—",
      },
      {
        accessorKey: "quantity",
        header: () => <div className="text-right">On hand</div>,
        cell: ({ row }) => (
          <div className="text-right font-medium tabular-nums">
            {fmtN(row.original.quantity)}
          </div>
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => {
          const meta = STATUS_META[stockStatus(row.original, threshold)];
          return <StatusBadge status={meta.label} tone={meta.tone} />;
        },
      },
      {
        accessorKey: "cost_price",
        header: () => <div className="text-right">Cost</div>,
        cell: ({ row }) => (
          <div className="text-right tabular-nums">{fmt$(row.original.cost_price)}</div>
        ),
      },
      {
        accessorKey: "stock_value",
        header: () => <div className="text-right">Stock value</div>,
        cell: ({ row }) => {
          const value =
            row.original.stock_value ??
            (row.original.cost_price != null
              ? Number(row.original.cost_price) * Number(row.original.quantity ?? 0)
              : null);
          return <div className="text-right font-medium tabular-nums">{fmt$(value)}</div>;
        },
      },
      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => (
          <div className="text-right">
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                setStockTarget(row.original);
              }}
            >
              Adjust
            </Button>
          </div>
        ),
      },
    ],
    [threshold]
  );

  const logColumns = React.useMemo<ColumnDef<InventoryLogRow>[]>(
    () => [
      {
        accessorKey: "created_at",
        header: "When",
        cell: ({ row }) => {
          const d = row.original.created_at;
          if (!d) return "—";
          const date = new Date(d);
          return isNaN(date.getTime()) ? "—" : format(date, "MMM d, yyyy · h:mm a");
        },
      },
      {
        accessorKey: "product_id",
        header: "Product",
        cell: ({ row }) => {
          const p = row.original as Record<string, unknown>;
          const product = p.product as { name?: string; title?: string } | undefined;
          const name = product?.name ?? product?.title;
          return (
            <div className="min-w-0 max-w-56">
              <p className="truncate font-medium">
                {name ?? `Product #${row.original.product_id ?? "—"}`}
              </p>
              {row.original.variant_id != null && (
                <p className="truncate text-xs text-muted-foreground">
                  Variant #{row.original.variant_id}
                </p>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "reason",
        header: "Reason",
        cell: ({ row }) => {
          const reason = row.original.reason ?? "";
          return reason ? (
            <StatusBadge
              status={REASON_LABELS[reason] ?? reason}
              tone={REASON_TONES[reason] ?? "neutral"}
            />
          ) : (
            "—"
          );
        },
      },
      {
        accessorKey: "quantity_change",
        header: () => <div className="text-right">Change</div>,
        cell: ({ row }) => {
          const delta = Number(row.original.quantity_change ?? 0);
          if (!delta) return <div className="text-right text-muted-foreground">—</div>;
          const up = delta > 0;
          return (
            <div
              className={cn(
                "flex items-center justify-end gap-0.5 font-medium tabular-nums",
                up ? "text-[#29845a]" : "text-[#e51c00]"
              )}
            >
              {up ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />}
              {Math.abs(delta).toLocaleString("en-US")}
            </div>
          );
        },
      },
      {
        id: "balance",
        header: () => <div className="text-right">Before → after</div>,
        cell: ({ row }) => (
          <div className="text-right text-xs text-muted-foreground tabular-nums">
            {fmtN(row.original.quantity_before)} → {fmtN(row.original.quantity_after)}
          </div>
        ),
      },
      {
        accessorKey: "performed_by",
        header: "By",
        cell: ({ row }) =>
          row.original.performer?.full_name ??
          (row.original.performed_by != null ? `User #${row.original.performed_by}` : "—"),
      },
      {
        accessorKey: "notes",
        header: "Notes",
        cell: ({ row }) => (
          <span className="block max-w-56 truncate text-xs text-muted-foreground">
            {row.original.notes || "—"}
          </span>
        ),
      },
    ],
    []
  );

  const applyThreshold = () => {
    const n = Number(thresholdInput);
    if (isNaN(n) || n < 0) {
      setThresholdInput(String(threshold));
      return;
    }
    setThreshold(n);
  };

  const categoryItems = React.useMemo<Record<string, string>>(
    () => ({
      all: "All categories",
      ...Object.fromEntries(categories.map((c) => [String(c.id), c.name])),
    }),
    [categories]
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Inventory</h1>
          <p className="text-sm text-muted-foreground">
            Stock on hand, low-stock alerts and every movement.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={loading || logsLoading}
          >
            <RefreshCw className={cn("size-4", (loading || logsLoading) && "animate-spin")} />
            Refresh
          </Button>
          <Tabs value={tab} onValueChange={(v) => setTab(v as "stock" | "activity")}>
            <TabsList>
              <TabsTrigger value="stock">Stock levels</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Summary */}
      <Card className="py-0 shadow-none">
        <CardContent className="grid grid-cols-2 divide-y p-0 lg:grid-cols-5 lg:divide-x lg:divide-y-0">
          <SummaryCard label="SKUs tracked" value={fmtN(stats.skus)} loading={loading} />
          <SummaryCard label="Units on hand" value={fmtN(stats.units)} loading={loading} />
          <SummaryCard label="Stock value" value={fmt$(stats.value)} loading={loading} />
          <SummaryCard
            label={`Low stock (≤ ${threshold})`}
            value={fmtN(stats.low)}
            loading={loading}
            tone={stats.low > 0 ? "warning" : undefined}
            icon={<AlertTriangle className="size-3.5" />}
          />
          <SummaryCard
            label="Out of stock"
            value={fmtN(stats.out)}
            loading={loading}
            tone={stats.out > 0 ? "critical" : undefined}
            icon={<PackageX className="size-3.5" />}
          />
        </CardContent>
      </Card>

      {tab === "stock" ? (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-44 flex-1 sm:max-w-56">
              <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or SKU"
                className="bg-card pl-8"
              />
            </div>

            <Select
              items={categoryItems}
              value={categoryId}
              onValueChange={(v) => setCategoryId(v as string)}
            >
              <SelectTrigger className="min-w-40 bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-input bg-card px-3 py-2 text-sm">
              <input
                type="checkbox"
                className="accent-primary"
                checked={lowOnly}
                onChange={(e) => setLowOnly(e.target.checked)}
              />
              Low stock only
            </label>

            <div className="flex items-center gap-1.5">
              <span className="text-sm text-muted-foreground">Threshold</span>
              <Input
                type="number"
                min={0}
                value={thresholdInput}
                onChange={(e) => setThresholdInput(e.target.value)}
                onBlur={applyThreshold}
                onKeyDown={(e) => e.key === "Enter" && applyThreshold()}
                className="w-20 bg-card"
              />
            </div>
          </div>

          <DataTable
            columns={stockColumns}
            data={visibleRows}
            loading={loading}
            onRowClick={(row) => setStockTarget(row)}
          />
        </>
      ) : (
        <DataTable
          columns={logColumns}
          data={logs}
          loading={logsLoading}
          serverPagination={{
            pageIndex: logPage,
            pageCount: logPageCount,
            total: logTotal,
            onPageChange: setLogPage,
          }}
        />
      )}

      {stockTarget && (
        <StockDialog
          open={!!stockTarget}
          onOpenChange={(next) => {
            if (!next) {
              setStockTarget(null);
              // Pull fresh quantities after an adjustment.
              setRefreshKey((k) => k + 1);
            }
          }}
          productId={stockTarget.id}
          productName={stockTarget.name ?? stockTarget.title}
        />
      )}
    </div>
  );
}
