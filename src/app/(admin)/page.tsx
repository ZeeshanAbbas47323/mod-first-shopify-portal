"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  ArrowDownRight, ArrowUpRight, ChevronRight,
  AlertTriangle, Package, ShoppingCart, TrendingUp, Users,
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/status-badge";
import { DateRangePicker } from "@/components/date-range-picker";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";
import { apiErrorMessage } from "@/lib/auth-api";
import type { DateRange } from "react-day-picker";
import {
  DASHBOARD_PERIODS,
  getDashboardOverview, getRevenueTrend, getCustomerGrowthTrend,
  getOrderStatusBreakdown, getOrderChannelBreakdown, getPaymentMethodBreakdown,
  getTopProducts, getRecentOrders, getLowStockAlerts, getPendingActions,
  type DashboardPeriod, type DashboardBody, type DashboardOverview, type OverviewMetric, type TrendPoint,
  type BreakdownItem, type TopProduct, type RecentOrder,
  type LowStockItem, type PendingActions,
} from "@/lib/admin-api";

// ─── Type helpers ─────────────────────────────────────────────────────────────
const metricVal = (m?: OverviewMetric | unknown): number | undefined =>
  m != null && typeof m === "object" && "value" in (m as object)
    ? (m as OverviewMetric).value
    : typeof m === "number" ? m : undefined;

const metricPct = (m?: OverviewMetric | unknown): number | undefined =>
  m != null && typeof m === "object" && "change_pct" in (m as object)
    ? ((m as OverviewMetric).change_pct ?? undefined)
    : undefined;

// ─── Palette ──────────────────────────────────────────────────────────────────

const BLUE   = "#005bd3";
const TEAL   = "#1a9ba1";
const PIE_COLORS = ["#005bd3","#1a9ba1","#8456cd","#b98900","#29845a","#e51c00","#637381"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

const fmt$ = (n?: number | null) =>
  n != null ? `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—";
const fmtN = (n?: number | null) => (n != null ? n.toLocaleString("en-US") : "—");
const fmtPct = (n?: number | null) =>
  n != null ? `${n > 0 ? "+" : ""}${n.toFixed(1)}%` : null;

function ChartTip({ active, payload, label, currency = false }: {
  active?: boolean; payload?: { value?: number; color?: string; name?: string }[];
  label?: string; currency?: boolean;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-md text-sm">
      {label && <p className="mb-1 text-muted-foreground">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="font-semibold" style={{ color: p.color ?? BLUE }}>
          {p.name && <span className="mr-1 text-xs text-muted-foreground">{p.name}:</span>}
          {currency ? fmt$(p.value) : fmtN(p.value)}
        </p>
      ))}
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, delta, icon, loading,
}: {
  label: string; value: string; delta?: number | null; icon: React.ReactNode; loading: boolean;
}) {
  const positive = delta != null && delta >= 0;
  return (
    <div className="flex flex-col gap-1 p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      {loading ? (
        <>
          <Skeleton className="mt-1 h-6 w-24" />
          <Skeleton className="h-4 w-14" />
        </>
      ) : (
        <>
          <span className="text-xl font-bold tracking-tight">{value}</span>
          {delta != null && (
            <span className={cn("flex items-center text-xs font-medium", positive ? "text-[#29845a]" : "text-[#e51c00]")}>
              {positive ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
              {fmtPct(delta)}
            </span>
          )}
        </>
      )}
    </div>
  );
}

// ─── Donut Chart ──────────────────────────────────────────────────────────────

const bVal = (d: BreakdownItem) => Number(d.count ?? (d as Record<string,unknown>).value ?? 0);

function DonutChart({ data, title, loading }: { data: BreakdownItem[]; title: string; loading: boolean }) {
  const total = data.reduce((s, d) => s + bVal(d), 0);
  return (
    <Card className="shadow-none flex-1 min-w-0">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {loading ? <Skeleton className="h-36 w-full" /> : data.length === 0 ? (
          <div className="flex h-36 items-center justify-center text-xs text-muted-foreground">No data</div>
        ) : (
          <div className="flex items-center gap-3">
            <ResponsiveContainer width={100} height={100}>
              <PieChart>
                <Pie data={data} dataKey={data[0]?.count != null ? "count" : "value"} cx="50%" cy="50%" innerRadius={30} outerRadius={46} strokeWidth={0}>
                  {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as BreakdownItem;
                  const v = bVal(d);
                  return (
                    <div className="rounded-lg border border-border bg-popover px-2.5 py-1.5 shadow-md text-xs">
                      <p className="font-medium">{d.label ?? d.name ?? d.status}</p>
                      <p className="text-muted-foreground">{fmtN(v)} ({total ? `${((v / total) * 100).toFixed(0)}%` : "—"})</p>
                    </div>
                  );
                }} />
              </PieChart>
            </ResponsiveContainer>
            <ul className="flex-1 space-y-1 min-w-0">
              {data.slice(0, 5).map((d, i) => {
                const v = bVal(d);
                return (
                  <li key={i} className="flex items-center gap-1.5 text-xs">
                    <span className="size-2 shrink-0 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="truncate text-muted-foreground">{d.label ?? d.name ?? d.status}</span>
                    <span className="ml-auto font-medium">{total ? `${((v / total) * 100).toFixed(0)}%` : "—"}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Greeting ─────────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function HomePage() {
  const user = useAuthStore((s) => s.user);
  const [period, setPeriod] = React.useState<DashboardPeriod>("last_7_days");
  const [customRange, setCustomRange] = React.useState<DateRange | undefined>();

  // KPIs
  const [overview, setOverview] = React.useState<DashboardOverview>({});
  const [kpiLoading, setKpiLoading] = React.useState(true);

  // Charts
  const [revTrend, setRevTrend] = React.useState<TrendPoint[]>([]);
  const [custTrend, setCustTrend] = React.useState<TrendPoint[]>([]);
  const [orderStatus, setOrderStatus] = React.useState<BreakdownItem[]>([]);
  const [orderChannel, setOrderChannel] = React.useState<BreakdownItem[]>([]);
  const [payMethod, setPayMethod] = React.useState<BreakdownItem[]>([]);
  const [topProducts, setTopProducts] = React.useState<TopProduct[]>([]);
  const [chartsLoading, setChartsLoading] = React.useState(true);

  // Widgets
  const [recentOrders, setRecentOrders] = React.useState<RecentOrder[]>([]);
  const [lowStock, setLowStock] = React.useState<LowStockItem[]>([]);
  const [pending, setPending] = React.useState<PendingActions>({});
  const [widgetsLoading, setWidgetsLoading] = React.useState(true);

  React.useEffect(() => {
    // Don't fetch when custom is selected but range not yet picked
    if (period === "custom" && (!customRange?.from || !customRange?.to)) return;

    let cancelled = false;
    const body: DashboardBody = { period };
    if (period === "custom" && customRange?.from && customRange?.to) {
      body.startDate = format(customRange.from, "yyyy-MM-dd");
      body.endDate = format(customRange.to, "yyyy-MM-dd");
    }

    setKpiLoading(true);
    setChartsLoading(true);

    getDashboardOverview(body)
      .then((ov) => { if (!cancelled) { setOverview(ov); setKpiLoading(false); } })
      .catch((e) => {
        if (!cancelled) {
          setOverview({});
          toast.error(apiErrorMessage(e, "Couldn't load the overview."));
          setKpiLoading(false);
        }
      });

    Promise.all([
      getRevenueTrend(body), getCustomerGrowthTrend(body),
      getOrderStatusBreakdown(body), getOrderChannelBreakdown(body),
      getPaymentMethodBreakdown(body), getTopProducts(body),
    ])
      .then(([rev, cust, oSt, oCh, pay, top]) => {
        if (!cancelled) {
          setRevTrend(rev); setCustTrend(cust);
          setOrderStatus(oSt); setOrderChannel(oCh);
          setPayMethod(pay); setTopProducts(top);
          setChartsLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          toast.error(apiErrorMessage(e, "Couldn't load chart data."));
          setChartsLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [period, customRange]);

  React.useEffect(() => {
    let cancelled = false;
    setWidgetsLoading(true);
    Promise.all([getRecentOrders(6), getLowStockAlerts(6), getPendingActions()])
      .then(([ro, ls, pa]) => {
        if (!cancelled) {
          setRecentOrders(ro); setLowStock(ls); setPending(pa);
          setWidgetsLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          toast.error(apiErrorMessage(e, "Couldn't load dashboard widgets."));
          setWidgetsLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  // Pending actions banner count
  const pendingOrders = (pending.booked_orders ?? (pending as Record<string,unknown>).pending_orders ?? 0) as number;
  const lowStockCount = (overview.low_stock_count ?? (pending as Record<string,unknown>).low_stock_products ?? 0) as number;
  const pendingReviews = (pending.pending_reviews ?? 0) as number;
  const pendingCount = pendingOrders + lowStockCount + pendingReviews;

  const revData = revTrend.map((p) => ({
    date: String(p.date ?? p.label ?? (p as Record<string,unknown>).period ?? ""),
    value: Number(p.value ?? p.revenue ?? 0),
  }));
  const custData = custTrend.map((p) => ({
    date: String(p.date ?? p.label ?? (p as Record<string,unknown>).period ?? ""),
    value: Number(p.value ?? p.customers ?? 0),
  }));
  const topProdData = topProducts.slice(0, 8).map((p) => ({
    name: String(p.name ?? p.title ?? "Product").slice(0, 20),
    revenue: Number(p.revenue ?? 0),
  }));

  const ov = overview;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold capitalize">
            {greeting()}, {user?.name ?? "there"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Here&apos;s what&apos;s happening with your store today.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {period === "custom" && (
            <DateRangePicker
              value={customRange}
              onChange={(r) => setCustomRange(r)}
            />
          )}
          <Select items={Object.fromEntries(DASHBOARD_PERIODS.map((p) => [p, p.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())]))} value={period} onValueChange={(v) => { if (v) { setPeriod(v as DashboardPeriod); if (v !== "custom") setCustomRange(undefined); } }}>
            <SelectTrigger className="w-44 bg-card">
              <SelectValue>
                {period.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {DASHBOARD_PERIODS.map((p) => (
                <SelectItem key={p} value={p}>
                  {p.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Pending actions banner */}
      {pendingCount > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/30">
          <AlertTriangle className="size-4 shrink-0 text-amber-600" />
          <p className="text-sm font-medium text-amber-800 dark:text-amber-400">
            {pendingCount} action{pendingCount > 1 ? "s" : ""} need your attention
          </p>
          <div className="flex flex-wrap gap-3 text-xs text-amber-700 dark:text-amber-500">
            {pendingOrders > 0 && (
              <Link href="/orders" className="underline underline-offset-2 hover:opacity-80">
                {pendingOrders} pending order{pendingOrders > 1 ? "s" : ""}
              </Link>
            )}
            {lowStockCount > 0 && (
              <Link href="/products" className="underline underline-offset-2 hover:opacity-80">
                {lowStockCount} low stock item{lowStockCount > 1 ? "s" : ""}
              </Link>
            )}
            {pendingReviews > 0 && (
              <Link href="/reviews" className="underline underline-offset-2 hover:opacity-80">
                {pendingReviews} pending review{pendingReviews > 1 ? "s" : ""}
              </Link>
            )}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <Card className="py-0 shadow-none">
        <CardContent className="grid grid-cols-2 p-0 lg:grid-cols-4 lg:divide-x divide-y lg:divide-y-0">
          <KpiCard
            label="Total revenue" icon={<TrendingUp className="size-3.5" />}
            value={fmt$(metricVal(ov.revenue))}
            delta={metricPct(ov.revenue)}
            loading={kpiLoading}
          />
          <KpiCard
            label="Total orders" icon={<ShoppingCart className="size-3.5" />}
            value={fmtN(metricVal(ov.orders))}
            delta={metricPct(ov.orders)}
            loading={kpiLoading}
          />
          <KpiCard
            label="New customers" icon={<Users className="size-3.5" />}
            value={fmtN(metricVal(ov.new_customers))}
            delta={metricPct(ov.new_customers)}
            loading={kpiLoading}
          />
          <KpiCard
            label="Avg order value" icon={<TrendingUp className="size-3.5" />}
            value={fmt$(metricVal(ov.aov))}
            delta={metricPct(ov.aov)}
            loading={kpiLoading}
          />
        </CardContent>
      </Card>

      {/* Revenue Chart */}
      <Card className="shadow-none">
        <CardHeader className="pb-1 pt-4 px-4">
          <CardTitle className="text-sm">Revenue</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {chartsLoading ? <Skeleton className="h-52 w-full" /> : revData.length === 0 ? (
            <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={208}>
              <AreaChart data={revData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={BLUE} stopOpacity={0.14} />
                    <stop offset="95%" stopColor={BLUE} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} width={44} />
                <Tooltip content={<ChartTip currency />} />
                <Area type="monotone" dataKey="value" name="Revenue" stroke={BLUE} strokeWidth={2}
                  fill="url(#revGrad)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Customer Growth + Top Products */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="shadow-none">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-sm">Customer growth</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {chartsLoading ? <Skeleton className="h-44 w-full" /> : custData.length === 0 ? (
              <div className="flex h-44 items-center justify-center text-xs text-muted-foreground">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={176}>
                <AreaChart data={custData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="custGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={TEAL} stopOpacity={0.14} />
                      <stop offset="95%" stopColor={TEAL} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip content={<ChartTip />} />
                  <Area type="monotone" dataKey="value" name="Customers" stroke={TEAL} strokeWidth={2}
                    fill="url(#custGrad)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-sm">Top products by revenue</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {chartsLoading ? <Skeleton className="h-44 w-full" /> : topProdData.length === 0 ? (
              <div className="flex h-44 items-center justify-center text-xs text-muted-foreground">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={176}>
                <BarChart data={topProdData} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={100} />
                  <Tooltip content={<ChartTip currency />} />
                  <Bar dataKey="revenue" fill={BLUE} radius={[0, 3, 3, 0]} maxBarSize={14} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Breakdown Donuts */}
      <div className="flex flex-wrap gap-4">
        <DonutChart title="Order status" data={orderStatus} loading={chartsLoading} />
        <DonutChart title="Sales channel" data={orderChannel} loading={chartsLoading} />
        <DonutChart title="Payment method" data={payMethod} loading={chartsLoading} />
      </div>

      {/* Recent Orders + Low Stock */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Recent Orders */}
        <Card className="gap-0 py-0 shadow-none">
          <div className="flex items-center justify-between px-4 py-3">
            <h2 className="text-sm font-semibold">Recent orders</h2>
            <Link href="/orders" className="flex items-center text-sm font-medium text-[#005bd3] hover:underline">
              View all <ChevronRight className="size-4" />
            </Link>
          </div>
          <Separator />
          <CardContent className="p-0">
            {widgetsLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : recentOrders.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">No orders yet</div>
            ) : (
              <ul className="divide-y">
                {recentOrders.map((order, i) => {
                  const custName =
                    typeof order.customer === "string"
                      ? order.customer
                      : (order.customer as { full_name?: string; name?: string } | undefined)?.full_name
                      ?? (order.customer as { name?: string } | undefined)?.name
                      ?? "Guest";
                  const dateStr = order.created_at
                    ? format(new Date(order.created_at), "MMM d")
                    : String((order as Record<string,unknown>).date ?? "");
                  return (
                    <li key={order.id ?? i}>
                      <Link
                        href="/orders"
                        className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 transition-colors hover:bg-muted/60"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {order.order_number ?? `#${order.id}`} · {custName}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{dateStr}</p>
                        </div>
                        <StatusBadge status={order.status ?? order.payment_status ?? "pending"} />
                        <span className="text-sm font-medium">{fmt$(order.total)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Low Stock */}
        <Card className="gap-0 py-0 shadow-none">
          <div className="flex items-center justify-between px-4 py-3">
            <h2 className="text-sm font-semibold">Low stock alerts</h2>
            <Link href="/products" className="flex items-center text-sm font-medium text-[#005bd3] hover:underline">
              View all <ChevronRight className="size-4" />
            </Link>
          </div>
          <Separator />
          <CardContent className="p-0">
            {widgetsLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : lowStock.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                <Package className="mr-2 size-4" /> All items well stocked
              </div>
            ) : (
              <ul className="divide-y">
                {lowStock.map((item, i) => (
                  <li key={item.id ?? i} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.name ?? item.title}</p>
                      {item.sku && <p className="text-xs text-muted-foreground font-mono">{item.sku}</p>}
                    </div>
                    <span className={cn(
                      "shrink-0 text-sm font-semibold",
                      (item.quantity ?? 0) === 0 ? "text-destructive" : "text-amber-600",
                    )}>
                      {fmtN(item.quantity)} left
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
