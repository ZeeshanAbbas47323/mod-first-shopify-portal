"use client";

import * as React from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  ArrowDownRight, Download, Loader2,
  Package, ShoppingCart, Tag, TrendingUp, Wallet,
} from "lucide-react";
import { format, subDays } from "date-fns";
import { toast } from "sonner";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangePicker } from "@/components/date-range-picker";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { apiErrorMessage } from "@/lib/auth-api";
import {
  getSalesReport, getOrderReport, getInventoryReport,
  getCustomerReport, getProductPerformanceReport,
  getFinancialReport, getCouponUsageReport,
  getDurationReport, exportDurationReport,
  SALES_GROUP_BY,
  type DurationReport,
  type SalesGroupBy, type SalesDataRow, type SalesSummary,
  type OrderReportRow, type OrderReportSummary,
  type InventoryReportRow, type InventoryReportSummary,
  type CustomerReportRow, type ProductPerfRow,
  type FinancialBreakdownRow, type CouponUsageRow,
} from "@/lib/admin-api";
import { cn } from "@/lib/utils";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CHART_BLUE = "#005bd3";
const CHART_COLORS = ["#005bd3","#1a9ba1","#8456cd","#b98900","#29845a","#e51c00","#637381"];

const defaultRange = (): DateRange => ({
  from: subDays(new Date(), 29),
  to: new Date(),
});

const toDate = (d?: Date) => (d ? format(d, "yyyy-MM-dd") : "");
const fmt$ = (n?: number | null) =>
  n != null ? `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—";
const fmtN = (n?: number | null) =>
  n != null ? n.toLocaleString("en-US") : "—";
const fmtPct = (n?: number | null) =>
  n != null ? `${n.toFixed(1)}%` : "—";

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({
  label, value, icon, tone = "default",
}: {
  label: string; value: string; icon: React.ReactNode; tone?: "green" | "red" | "default";
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
      <span className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-lg",
        tone === "green" && "bg-[#ccf2e0] text-[#1a6644] dark:bg-[#1a6644]/20 dark:text-[#4ade80]",
        tone === "red" && "bg-[#ffe5e5] text-[#b91c1c] dark:bg-[#b91c1c]/20 dark:text-[#f87171]",
        tone === "default" && "bg-muted text-muted-foreground",
      )}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-lg font-semibold">{value}</p>
      </div>
    </div>
  );
}

// ─── Shared Chart Tooltip ─────────────────────────────────────────────────────

function ChartTip({ active, payload, label, currency = false }: {
  active?: boolean; payload?: { value?: number; color?: string }[];
  label?: string; currency?: boolean;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-md text-sm">
      <p className="mb-1 text-muted-foreground">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="font-semibold" style={{ color: p.color ?? CHART_BLUE }}>
          {currency ? fmt$(p.value) : fmtN(p.value)}
        </p>
      ))}
    </div>
  );
}

// ─── Date Controls ────────────────────────────────────────────────────────────

function DateControls({
  range, onRange, children,
}: {
  range: DateRange; onRange: (r: DateRange) => void; children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <DateRangePicker
        value={range}
        onChange={(r) => r && onRange(r)}
      />
      {children}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function Empty({ text = "No data for the selected period" }: { text?: string }) {
  return (
    <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

// ─── Tab wrapper ──────────────────────────────────────────────────────────────

function TabBar({ tabs, active, onChange }: {
  tabs: { value: string; label: string }[];
  active: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex overflow-x-auto border-b border-border">
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            "shrink-0 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
            active === t.value
              ? "border-[#005bd3] text-[#005bd3]"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. SALES REPORT
// ═══════════════════════════════════════════════════════════════════════════════

function SalesTab() {
  const [range, setRange] = React.useState<DateRange>(defaultRange);
  const [groupBy, setGroupBy] = React.useState<SalesGroupBy>("day");
  const [rows, setRows] = React.useState<SalesDataRow[]>([]);
  const [summary, setSummary] = React.useState<SalesSummary>({});
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(() => {
    if (!range.from || !range.to) return;
    setLoading(true);
    getSalesReport({ startDate: toDate(range.from), endDate: toDate(range.to), groupBy })
      .then(({ data, summary: s }) => { setRows(data); setSummary(s ?? {}); })
      .catch((e) => toast.error(apiErrorMessage(e, "Couldn't load sales report.")))
      .finally(() => setLoading(false));
  }, [range, groupBy]);

  React.useEffect(() => { load(); }, [load]);

  const isTimeSeries = ["day", "week", "month"].includes(groupBy);
  const labelKey = (r: SalesDataRow) => r.label ?? r.date ?? r.period ?? "";
  const chartData = rows.map((r) => ({ label: labelKey(r), revenue: r.revenue ?? 0, orders: r.orders ?? 0 }));

  return (
    <div className="flex flex-col gap-5">
      <DateControls range={range} onRange={setRange}>
        <Select value={groupBy} onValueChange={(v) => setGroupBy(v as SalesGroupBy)}>
          <SelectTrigger className="w-36 bg-card"><SelectValue /></SelectTrigger>
          <SelectContent>
            {SALES_GROUP_BY.map((g) => (
              <SelectItem key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1).replace("_", " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </DateControls>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard label="Total revenue" value={fmt$(summary.revenue)} icon={<TrendingUp className="size-4" />} tone="green" />
        <SummaryCard label="Orders" value={fmtN(summary.orders)} icon={<ShoppingCart className="size-4" />} />
        <SummaryCard label="Discounts given" value={fmt$(summary.discount)} icon={<Tag className="size-4" />} tone="red" />
        <SummaryCard label="Tax collected" value={fmt$(summary.tax)} icon={<Wallet className="size-4" />} />
      </div>

      <Card className="shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{isTimeSeries ? "Revenue over time" : `Revenue by ${groupBy}`}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-56 w-full" /> : rows.length === 0 ? <Empty /> : (
            isTimeSeries ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="saleGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_BLUE} stopOpacity={0.14} />
                      <stop offset="95%" stopColor={CHART_BLUE} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} width={44} />
                  <Tooltip content={<ChartTip currency />} />
                  <Area type="monotone" dataKey="revenue" stroke={CHART_BLUE} strokeWidth={2} fill="url(#saleGrad)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} width={44} />
                  <Tooltip content={<ChartTip currency />} />
                  <Bar dataKey="revenue" fill={CHART_BLUE} radius={[3, 3, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            )
          )}
        </CardContent>
      </Card>

      {!loading && rows.length > 0 && (
        <Card className="shadow-none">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Breakdown</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    {["Period","Orders","Subtotal","Discount","Tax","Shipping","Revenue"].map((h) => (
                      <th key={h} className={cn("px-4 py-2.5 font-medium text-muted-foreground", h !== "Period" ? "text-right" : "text-left")}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5 font-medium">{labelKey(r)}</td>
                      <td className="px-4 py-2.5 text-right">{fmtN(r.orders)}</td>
                      <td className="px-4 py-2.5 text-right">{fmt$(r.subtotal)}</td>
                      <td className="px-4 py-2.5 text-right text-destructive">{fmt$(r.discount)}</td>
                      <td className="px-4 py-2.5 text-right">{fmt$(r.tax)}</td>
                      <td className="px-4 py-2.5 text-right">{fmt$(r.shipping)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold">{fmt$(r.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
                {summary.revenue != null && (
                  <tfoot>
                    <tr className="border-t-2 border-border bg-muted/20 font-semibold">
                      <td className="px-4 py-2.5">Total</td>
                      <td className="px-4 py-2.5 text-right">{fmtN(summary.orders)}</td>
                      <td className="px-4 py-2.5 text-right">{fmt$(summary.subtotal)}</td>
                      <td className="px-4 py-2.5 text-right text-destructive">{fmt$(summary.discount)}</td>
                      <td className="px-4 py-2.5 text-right">{fmt$(summary.tax)}</td>
                      <td className="px-4 py-2.5 text-right">{fmt$(summary.shipping)}</td>
                      <td className="px-4 py-2.5 text-right">{fmt$(summary.revenue)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. ORDERS REPORT
// ═══════════════════════════════════════════════════════════════════════════════

const ORDER_STATUSES_LIST = ["booked","accepted","design_review","preparing","label_create","shipped","ready_for_pickup","completed","cancelled"];
const PAYMENT_STATUSES_LIST = ["pending","paid","partially_paid","refunded","failed"];

function OrdersTab() {
  const [range, setRange] = React.useState<DateRange>(defaultRange);
  const [status, setStatus] = React.useState("all");
  const [payStatus, setPayStatus] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const [rows, setRows] = React.useState<OrderReportRow[]>([]);
  const [summary, setSummary] = React.useState<OrderReportSummary>({});
  const [totalPages, setTotalPages] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const LIMIT = 20;

  React.useEffect(() => { setPage(1); }, [range, status, payStatus]);

  const load = React.useCallback(() => {
    if (!range.from || !range.to) return;
    setLoading(true);
    getOrderReport({
      startDate: toDate(range.from), endDate: toDate(range.to), page, limit: LIMIT,
      status: status === "all" ? undefined : status,
      payment_status: payStatus === "all" ? undefined : payStatus,
    })
      .then(({ rows: r, summary: s, total: t, totalPages: tp }) => {
        setRows(r); setSummary(s ?? {}); setTotal(t); setTotalPages(tp);
      })
      .catch((e) => toast.error(apiErrorMessage(e, "Couldn't load order report.")))
      .finally(() => setLoading(false));
  }, [range, status, payStatus, page]);

  React.useEffect(() => { load(); }, [load]);

  const custName = (c: OrderReportRow["customer"]) =>
    !c ? "Guest" : typeof c === "string" ? c : (c as { full_name?: string; name?: string }).full_name ?? (c as { name?: string }).name ?? "Guest";

  return (
    <div className="flex flex-col gap-5">
      <DateControls range={range} onRange={setRange}>
        <Select value={status} onValueChange={(v) => setStatus(v ?? "all")}>
          <SelectTrigger className="w-40 bg-card"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {ORDER_STATUSES_LIST.map((s) => (
              <SelectItem key={s} value={s}>{s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={payStatus} onValueChange={(v) => setPayStatus(v ?? "all")}>
          <SelectTrigger className="w-40 bg-card"><SelectValue placeholder="All payments" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All payments</SelectItem>
            {PAYMENT_STATUSES_LIST.map((s) => (
              <SelectItem key={s} value={s}>{s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </DateControls>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <SummaryCard label="Total orders" value={fmtN(summary.total_orders)} icon={<ShoppingCart className="size-4" />} />
        <SummaryCard label="Total revenue" value={fmt$(summary.total_revenue)} icon={<TrendingUp className="size-4" />} tone="green" />
        <SummaryCard label="Discounts" value={fmt$(summary.total_discount)} icon={<Tag className="size-4" />} tone="red" />
        <SummaryCard label="Tax" value={fmt$(summary.total_tax)} icon={<Wallet className="size-4" />} />
        <SummaryCard label="Shipping" value={fmt$(summary.total_shipping)} icon={<Package className="size-4" />} />
      </div>

      <Card className="shadow-none">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : rows.length === 0 ? <Empty /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    {["Order","Customer","Date","Status","Payment","Discount","Tax","Shipping","Total"].map((h) => (
                      <th key={h} className={cn("px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap", ["Discount","Tax","Shipping","Total"].includes(h) ? "text-right" : "text-left")}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5 font-medium font-mono text-xs whitespace-nowrap">{r.order_number ?? `#${r.id}`}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">{custName(r.customer)}</td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs whitespace-nowrap">
                        {r.created_at ? format(new Date(r.created_at), "MMM d, yyyy") : "—"}
                      </td>
                      <td className="px-4 py-2.5"><StatusBadge status={r.status ?? "—"} /></td>
                      <td className="px-4 py-2.5"><StatusBadge status={r.payment_status ?? "—"} /></td>
                      <td className="px-4 py-2.5 text-right text-destructive">{fmt$(r.discount)}</td>
                      <td className="px-4 py-2.5 text-right">{fmt$(r.tax)}</td>
                      <td className="px-4 py-2.5 text-right">{fmt$(r.shipping)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold">{fmt$(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <p className="text-xs text-muted-foreground">{total} orders</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. INVENTORY REPORT
// ═══════════════════════════════════════════════════════════════════════════════

function InventoryTab() {
  const [lowStockOnly, setLowStockOnly] = React.useState(false);
  const [threshold, setThreshold] = React.useState("10");
  const [rows, setRows] = React.useState<InventoryReportRow[]>([]);
  const [summary, setSummary] = React.useState<InventoryReportSummary>({});
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(() => {
    setLoading(true);
    getInventoryReport({ low_stock_only: lowStockOnly, threshold: parseInt(threshold) || 10 })
      .then(({ rows: r, summary: s }) => { setRows(r); setSummary(s ?? {}); })
      .catch((e) => toast.error(apiErrorMessage(e, "Couldn't load inventory report.")))
      .finally(() => setLoading(false));
  }, [lowStockOnly, threshold]);

  React.useEffect(() => { load(); }, [load]);

  const statusTone = (s?: string): "success" | "warning" | "critical" =>
    s === "in_stock" ? "success" : s === "low_stock" ? "warning" : "critical";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
          <input type="checkbox" className="accent-primary" checked={lowStockOnly}
            onChange={(e) => setLowStockOnly(e.target.checked)} />
          Low stock only
        </label>
        {lowStockOnly && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Threshold:</span>
            <input type="number" min="0" value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className="w-20 rounded-lg border border-input bg-card px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <SummaryCard label="Total SKUs" value={fmtN(summary.total_skus)} icon={<Package className="size-4" />} />
        <SummaryCard label="Total units" value={fmtN(summary.total_units)} icon={<Package className="size-4" />} />
        <SummaryCard label="Stock value" value={fmt$(summary.total_stock_value)} icon={<Wallet className="size-4" />} tone="green" />
        <SummaryCard label="Out of stock" value={fmtN(summary.out_of_stock_count)} icon={<Package className="size-4" />} tone="red" />
        <SummaryCard label="Low stock" value={fmtN(summary.low_stock_count)} icon={<Package className="size-4" />} tone="red" />
      </div>

      <Card className="shadow-none">
        <CardContent className="p-0">
          {loading ? <div className="p-4"><Skeleton className="h-48 w-full" /></div> : rows.length === 0 ? <Empty /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    {["Product","SKU","Category","Qty","Cost Price","Stock Value","Status"].map((h) => (
                      <th key={h} className={cn("px-4 py-2.5 font-medium text-muted-foreground", ["Qty","Cost Price","Stock Value"].includes(h) ? "text-right" : "text-left")}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5 font-medium max-w-48 truncate">{r.name ?? r.title}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{r.sku ?? "—"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{r.category ?? "—"}</td>
                      <td className={cn("px-4 py-2.5 text-right font-semibold", (r.quantity ?? 0) === 0 && "text-destructive")}>
                        {fmtN(r.quantity)}
                      </td>
                      <td className="px-4 py-2.5 text-right">{fmt$(r.cost_price)}</td>
                      <td className="px-4 py-2.5 text-right font-medium">{fmt$(r.stock_value)}</td>
                      <td className="px-4 py-2.5">
                        <StatusBadge
                          status={r.status === "in_stock" ? "In Stock" : r.status === "low_stock" ? "Low Stock" : "Out of Stock"}
                          tone={statusTone(r.status)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. CUSTOMERS REPORT
// ═══════════════════════════════════════════════════════════════════════════════

function CustomersTab() {
  const [range, setRange] = React.useState<DateRange>(defaultRange);
  const [rows, setRows] = React.useState<CustomerReportRow[]>([]);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(() => {
    setLoading(true);
    getCustomerReport({ startDate: toDate(range.from), endDate: toDate(range.to), limit: 50 })
      .then(setRows)
      .catch((e) => toast.error(apiErrorMessage(e, "Couldn't load customer report.")))
      .finally(() => setLoading(false));
  }, [range]);

  React.useEffect(() => { load(); }, [load]);

  const chartData = rows.slice(0, 10).map((r) => ({
    name: ((r.full_name ?? r.name ?? r.email ?? "Customer") as string).slice(0, 16),
    spent: r.total_spent ?? 0,
  }));

  return (
    <div className="flex flex-col gap-5">
      <DateControls range={range} onRange={setRange} />

      {!loading && chartData.length > 0 && (
        <Card className="shadow-none">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Top 10 customers by spend</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={100} />
                <Tooltip content={<ChartTip currency />} />
                <Bar dataKey="spent" radius={[0, 3, 3, 0]} maxBarSize={16}>
                  {chartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-none">
        <CardContent className="p-0">
          {loading ? <div className="p-4"><Skeleton className="h-48 w-full" /></div> : rows.length === 0 ? <Empty /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    {["#","Customer","Email","Orders","Total Spent","Avg Order Value","Last Order"].map((h) => (
                      <th key={h} className={cn("px-4 py-2.5 font-medium text-muted-foreground", ["Orders","Total Spent","Avg Order Value"].includes(h) ? "text-right" : "text-left")}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5 text-muted-foreground text-xs font-mono">{i + 1}</td>
                      <td className="px-4 py-2.5 font-medium whitespace-nowrap">{r.full_name ?? r.name ?? "—"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{r.email ?? "—"}</td>
                      <td className="px-4 py-2.5 text-right">{fmtN(r.total_orders)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-[#29845a]">{fmt$(r.total_spent)}</td>
                      <td className="px-4 py-2.5 text-right">{fmt$(r.avg_order_value)}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        {r.last_order_at ? format(new Date(r.last_order_at), "MMM d, yyyy") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. PRODUCT PERFORMANCE
// ═══════════════════════════════════════════════════════════════════════════════

function ProductPerfTab() {
  const [range, setRange] = React.useState<DateRange>(defaultRange);
  const [sortBy, setSortBy] = React.useState<"revenue" | "units_sold">("revenue");
  const [rows, setRows] = React.useState<ProductPerfRow[]>([]);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(() => {
    if (!range.from || !range.to) return;
    setLoading(true);
    getProductPerformanceReport({ startDate: toDate(range.from), endDate: toDate(range.to), sortBy, limit: 50 })
      .then(setRows)
      .catch((e) => toast.error(apiErrorMessage(e, "Couldn't load product performance.")))
      .finally(() => setLoading(false));
  }, [range, sortBy]);

  React.useEffect(() => { load(); }, [load]);

  const chartData = rows.slice(0, 10).map((r) => ({
    name: ((r.name ?? r.title ?? "Product") as string).slice(0, 20),
    revenue: r.revenue ?? 0,
    profit: r.profit ?? 0,
  }));

  return (
    <div className="flex flex-col gap-5">
      <DateControls range={range} onRange={setRange}>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as "revenue" | "units_sold")}>
          <SelectTrigger className="w-44 bg-card"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="revenue">Sort by Revenue</SelectItem>
            <SelectItem value="units_sold">Sort by Units Sold</SelectItem>
          </SelectContent>
        </Select>
      </DateControls>

      {!loading && chartData.length > 0 && (
        <Card className="shadow-none">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Top 10 products — Revenue vs Profit</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={110} />
                <Tooltip content={<ChartTip currency />} />
                <Bar dataKey="revenue" fill={CHART_BLUE} radius={[0, 3, 3, 0]} maxBarSize={12} name="Revenue" />
                <Bar dataKey="profit" fill="#29845a" radius={[0, 3, 3, 0]} maxBarSize={12} name="Profit" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-none">
        <CardContent className="p-0">
          {loading ? <div className="p-4"><Skeleton className="h-48 w-full" /></div> : rows.length === 0 ? <Empty /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    {["#","Product","Category","Units Sold","Revenue","Cost","Profit","Margin"].map((h, i) => (
                      <th key={h} className={cn("px-4 py-2.5 font-medium text-muted-foreground", i > 2 ? "text-right" : "text-left")}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5 text-xs font-mono text-muted-foreground">{i + 1}</td>
                      <td className="px-4 py-2.5 font-medium max-w-48 truncate">{r.name ?? r.title}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{r.category ?? "—"}</td>
                      <td className="px-4 py-2.5 text-right">{fmtN(r.units_sold)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold">{fmt$(r.revenue)}</td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">{fmt$(r.cost)}</td>
                      <td className={cn("px-4 py-2.5 text-right font-medium", (r.profit ?? 0) >= 0 ? "text-[#29845a]" : "text-destructive")}>{fmt$(r.profit)}</td>
                      <td className={cn("px-4 py-2.5 text-right font-medium", (r.margin ?? 0) >= 0 ? "text-[#29845a]" : "text-destructive")}>{fmtPct(r.margin)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. FINANCIAL REPORT
// ═══════════════════════════════════════════════════════════════════════════════

function FinancialTab() {
  const [range, setRange] = React.useState<DateRange>(defaultRange);
  const [breakdown, setBreakdown] = React.useState<FinancialBreakdownRow[]>([]);
  const [totals, setTotals] = React.useState<FinancialBreakdownRow | undefined>();
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(() => {
    if (!range.from || !range.to) return;
    setLoading(true);
    getFinancialReport({ startDate: toDate(range.from), endDate: toDate(range.to) })
      .then(({ breakdown: b, totals: t }) => { setBreakdown(b); setTotals(t); })
      .catch((e) => toast.error(apiErrorMessage(e, "Couldn't load financial report.")))
      .finally(() => setLoading(false));
  }, [range]);

  React.useEffect(() => { load(); }, [load]);

  const t = totals ?? {};
  const netRev = (t.net_revenue as number | undefined) ?? ((t.revenue ?? 0) - (t.refunds ?? 0) - (t.fees ?? 0));

  return (
    <div className="flex flex-col gap-5">
      <DateControls range={range} onRange={setRange} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard label="Gross Revenue" value={fmt$(t.revenue as number | undefined)} icon={<TrendingUp className="size-4" />} tone="green" />
        <SummaryCard label="Discounts" value={fmt$(t.discounts as number | undefined)} icon={<Tag className="size-4" />} tone="red" />
        <SummaryCard label="Refunds" value={fmt$(t.refunds as number | undefined)} icon={<ArrowDownRight className="size-4" />} tone="red" />
        <SummaryCard label="Net Revenue" value={fmt$(netRev)} icon={<Wallet className="size-4" />} tone="green" />
      </div>

      <Card className="shadow-none">
        <CardHeader className="pb-2"><CardTitle className="text-sm">P&amp;L by Payment Method</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? <div className="p-4"><Skeleton className="h-48 w-full" /></div> : breakdown.length === 0 ? <Empty /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    {["Method","Revenue","Discounts","Tax","Shipping","Gateway Fees","Refunds","Net Revenue"].map((h) => (
                      <th key={h} className={cn("px-4 py-2.5 font-medium text-muted-foreground", h !== "Method" ? "text-right" : "text-left")}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {breakdown.map((r, i) => {
                    const nr = (r.net_revenue as number | undefined) ?? ((r.revenue ?? 0) - (r.refunds ?? 0) - (r.fees ?? 0));
                    return (
                      <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2.5 font-medium capitalize">{r.method ?? r.payment_method ?? "—"}</td>
                        <td className="px-4 py-2.5 text-right">{fmt$(r.revenue as number | undefined)}</td>
                        <td className="px-4 py-2.5 text-right text-destructive">{fmt$(r.discounts as number | undefined)}</td>
                        <td className="px-4 py-2.5 text-right">{fmt$(r.tax as number | undefined)}</td>
                        <td className="px-4 py-2.5 text-right">{fmt$(r.shipping as number | undefined)}</td>
                        <td className="px-4 py-2.5 text-right text-destructive">{fmt$(r.fees as number | undefined)}</td>
                        <td className="px-4 py-2.5 text-right text-destructive">{fmt$(r.refunds as number | undefined)}</td>
                        <td className={cn("px-4 py-2.5 text-right font-semibold", nr >= 0 ? "text-[#29845a]" : "text-destructive")}>{fmt$(nr)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                {totals && (
                  <tfoot>
                    <tr className="border-t-2 border-border bg-muted/20 font-semibold">
                      <td className="px-4 py-2.5">Total</td>
                      <td className="px-4 py-2.5 text-right">{fmt$(t.revenue as number | undefined)}</td>
                      <td className="px-4 py-2.5 text-right text-destructive">{fmt$(t.discounts as number | undefined)}</td>
                      <td className="px-4 py-2.5 text-right">{fmt$(t.tax as number | undefined)}</td>
                      <td className="px-4 py-2.5 text-right">{fmt$(t.shipping as number | undefined)}</td>
                      <td className="px-4 py-2.5 text-right text-destructive">{fmt$(t.fees as number | undefined)}</td>
                      <td className="px-4 py-2.5 text-right text-destructive">{fmt$(t.refunds as number | undefined)}</td>
                      <td className={cn("px-4 py-2.5 text-right", netRev >= 0 ? "text-[#29845a]" : "text-destructive")}>{fmt$(netRev)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. COUPON USAGE
// ═══════════════════════════════════════════════════════════════════════════════

function CouponTab() {
  const [range, setRange] = React.useState<DateRange>({ from: undefined, to: undefined });
  const [rows, setRows] = React.useState<CouponUsageRow[]>([]);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(() => {
    setLoading(true);
    getCouponUsageReport({
      startDate: range.from ? toDate(range.from) : undefined,
      endDate: range.to ? toDate(range.to) : undefined,
    })
      .then(setRows)
      .catch((e) => toast.error(apiErrorMessage(e, "Couldn't load coupon report.")))
      .finally(() => setLoading(false));
  }, [range]);

  React.useEffect(() => { load(); }, [load]);

  const chartData = rows.slice(0, 10).map((r) => ({
    name: r.code ?? r.name ?? `#${r.coupon_id ?? r.id}`,
    uses: r.times_used ?? 0,
    discount: r.total_discount ?? 0,
  }));

  return (
    <div className="flex flex-col gap-5">
      <DateControls range={range} onRange={setRange} />

      {!loading && chartData.length > 0 && (
        <Card className="shadow-none">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Top coupons by usage</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={32} />
                <Tooltip />
                <Bar dataKey="uses" fill={CHART_BLUE} radius={[3, 3, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-none">
        <CardContent className="p-0">
          {loading ? <div className="p-4"><Skeleton className="h-48 w-full" /></div> : rows.length === 0 ? <Empty text="No coupon usage data" /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    {["Coupon Code","Times Used","Total Discount"].map((h) => (
                      <th key={h} className={cn("px-4 py-2.5 font-medium text-muted-foreground", h !== "Coupon Code" ? "text-right" : "text-left")}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5">
                        <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs font-semibold">
                          {r.code ?? r.name ?? `#${r.coupon_id ?? r.id}`}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold">{fmtN(r.times_used)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-destructive">{fmt$(r.total_discount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT PAGE
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Duration report ──────────────────────────────────────────────────────────

function DurationTab() {
  const [range, setRange] = React.useState<DateRange>(defaultRange());
  const [report, setReport] = React.useState<DurationReport | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [exporting, setExporting] = React.useState(false);
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    setPage(1);
  }, [range]);

  React.useEffect(() => {
    if (!range.from || !range.to) return;
    let cancelled = false;
    setLoading(true);
    getDurationReport({
      period: "custom",
      startDate: toDate(range.from),
      endDate: toDate(range.to),
      include_orders: true,
      page,
      limit: 25,
    })
      .then((r) => !cancelled && setReport(r))
      .catch((e) => {
        if (cancelled) return;
        setReport(null);
        toast.error(apiErrorMessage(e, "Couldn't load the duration report."));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [range, page]);

  const exportExcel = async () => {
    if (!range.from || !range.to) return;
    setExporting(true);
    try {
      const blob = await exportDurationReport({
        period: "custom",
        startDate: toDate(range.from),
        endDate: toDate(range.to),
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `orders-${toDate(range.from)}-to-${toDate(range.to)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      toast.success("Export downloaded.");
    } catch (e) {
      toast.error(apiErrorMessage(e, "Couldn't export the report."));
    } finally {
      setExporting(false);
    }
  };

  const summary = (report?.summary ?? {}) as Record<string, unknown>;
  const num = (k: string) => Number(summary[k] ?? 0);
  const orders = report?.orders ?? [];
  const totalPages = Number(
    (report?.pagination as Record<string, unknown> | undefined)?.totalPages ?? 1
  );

  return (
    <div className="flex flex-col gap-4">
      <DateControls range={range} onRange={setRange}>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={exportExcel}
          disabled={exporting}
        >
          {exporting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          Export Excel
        </Button>
      </DateControls>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Orders" value={num("total_orders").toLocaleString("en-US")} icon={<ShoppingCart className="size-4" />} />
        <SummaryCard label="Revenue" value={fmt$(num("total_amount") || num("total_revenue"))} icon={<Wallet className="size-4" />} />
        <SummaryCard label="Paid" value={fmt$(num("paid_amount"))} icon={<Wallet className="size-4" />} />
        <SummaryCard label="Discounts" value={fmt$(num("discount_amount"))} icon={<Tag className="size-4" />} tone="red" />
      </div>

      <Card className="shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Orders in period</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <Skeleton className="m-4 h-56" />
          ) : orders.length === 0 ? (
            <Empty />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left">Order</th>
                    <th className="px-4 py-2 text-left">Date</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-right">Total</th>
                    <th className="px-4 py-2 text-right">Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o, i) => {
                    const row = o as Record<string, unknown>;
                    return (
                      <tr key={String(row.id ?? i)} className="border-b border-border last:border-b-0">
                        <td className="px-4 py-2 font-mono text-xs">
                          {String(row.order_number ?? row.order_code ?? row.id ?? "—")}
                        </td>
                        <td className="px-4 py-2">
                          {row.order_date || row.created_at
                            ? format(new Date(String(row.order_date ?? row.created_at)), "MMM d, yyyy")
                            : "—"}
                        </td>
                        <td className="px-4 py-2 capitalize">
                          {String(row.status ?? "—").replace(/_/g, " ")}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {fmt$(Number(row.total_amount ?? 0))}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {fmt$(Number(row.paid_amount ?? 0))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

const REPORT_TABS = [
  { value: "sales",      label: "Sales" },
  { value: "orders",     label: "Orders" },
  { value: "inventory",  label: "Inventory" },
  { value: "customers",  label: "Customers" },
  { value: "products",   label: "Products" },
  { value: "financial",  label: "Financial" },
  { value: "coupons",    label: "Coupons" },
  { value: "duration",   label: "Duration" },
];

export default function AnalyticsPage() {
  const [tab, setTab] = React.useState("sales");

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-bold">Reports</h1>

      <TabBar tabs={REPORT_TABS} active={tab} onChange={setTab} />

      <div>
        {tab === "sales"     && <SalesTab />}
        {tab === "orders"    && <OrdersTab />}
        {tab === "inventory" && <InventoryTab />}
        {tab === "customers" && <CustomersTab />}
        {tab === "products"  && <ProductPerfTab />}
        {tab === "financial" && <FinancialTab />}
        {tab === "coupons"   && <CouponTab />}
        {tab === "duration"  && <DurationTab />}
      </div>
    </div>
  );
}
