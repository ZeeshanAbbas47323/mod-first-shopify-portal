"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import { Loader2, Lock, LockOpen, Search, X } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { MultiSelectFilter } from "@/components/multi-select-filter";
import { SummaryStatStrip, type SummaryTile } from "@/components/summary-stat-strip";
import { DataTable, type ColumnFilterDef } from "@/components/data-table";
import { ExportMenu } from "@/components/export-menu";
import { DateRangePicker } from "@/components/date-range-picker";
import { StatusBadge } from "@/components/status-badge";
import { apiErrorMessage } from "@/lib/auth-api";
import { usePermissions } from "@/stores/menu-store";
import { listUsers, getUsersSummary, unlockUser, type UserRow, type UsersSummary } from "@/lib/admin-api";
import type { DateRange } from "react-day-picker";

const DEFAULT_PAGE_SIZE = 20;
const EXPORT_CAP = 5000;

const STATUS_OPTIONS = ["active", "inactive"] as const;
const SUBSCRIPTION_OPTIONS = ["subscribed", "not_subscribed"] as const;

const fmt$ = (n?: number | null) =>
  n != null ? `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—";

const initials = (name: string) =>
  name.split(/\s+/).map((p) => p[0] ?? "").join("").slice(0, 2).toUpperCase() || "??";

const EMPTY_SUMMARY: UsersSummary = {
  total_customers: 0,
  new_customers: { current: 0, previous: 0, change_percent: null },
  subscribed: 0,
  locked: 0,
};

const COLUMN_FILTERS: Record<string, ColumnFilterDef> = {
  full_name: { type: "text", placeholder: "Name or email" },
  email_subscription: {
    type: "select",
    options: SUBSCRIPTION_OPTIONS,
    placeholder: "Any",
  },
  is_locked: {
    type: "select",
    options: [
      { value: "yes", label: "Locked" },
      { value: "no", label: "Not locked" },
    ],
    placeholder: "Any",
  },
};

const exportColumns = [
  { key: "full_name", label: "Customer", value: (r: UserRow) => r.full_name },
  { key: "email", label: "Email", value: (r: UserRow) => r.email },
  { key: "phone", label: "Phone", value: (r: UserRow) => r.phone ?? "" },
  { key: "email_subscribed", label: "Email subscription", value: (r: UserRow) => (r.email_subscribed ? "Subscribed" : "Not subscribed") },
  { key: "is_locked", label: "Locked", value: (r: UserRow) => (r.is_locked ? "Yes" : "No") },
  { key: "total_orders", label: "Orders", value: (r: UserRow) => r.total_orders ?? 0 },
  { key: "total_spent", label: "Amount spent", value: (r: UserRow) => r.total_spent ?? 0 },
  { key: "created_at", label: "Joined", value: (r: UserRow) => r.created_at ?? "" },
];

function buildColumns(
  canEdit: boolean,
  unlockingId: string | number | null,
  onUnlock: (row: UserRow) => void
): ColumnDef<UserRow>[] {
  return [
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
    accessorKey: "full_name",
    header: "Customer name",
    cell: ({ row }) => {
      const name = row.getValue<string>("full_name") ?? "";
      return (
        <div className="flex items-center gap-3">
          <Avatar className="size-8">
            <AvatarFallback className="bg-[#e0f0ff] text-xs font-semibold text-[#00527c]">
              {initials(name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{name || "—"}</p>
            <p className="text-xs text-muted-foreground">{row.original.email}</p>
          </div>
        </div>
      );
    },
  },
  {
    id: "email_subscription",
    header: "Email subscription",
    cell: ({ row }) => (
      <StatusBadge
        status={row.original.email_subscribed ? "Subscribed" : "Not subscribed"}
        tone={row.original.email_subscribed ? "success" : "neutral"}
      />
    ),
  },
  {
    accessorKey: "is_locked",
    header: () => <div className="text-center">Locked</div>,
    cell: ({ row }) => {
      const isLocked = !!row.getValue("is_locked");
      const busy = unlockingId === row.original.id;

      if (!isLocked) {
        return (
          <div className="flex justify-center text-muted-foreground/50" title="Not locked">
            <LockOpen className="size-4" />
          </div>
        );
      }

      return (
        <div className="flex justify-center">
          <button
            type="button"
            disabled={!canEdit || busy}
            onClick={(e) => {
              e.stopPropagation();
              onUnlock(row.original);
            }}
            title={canEdit ? "Locked — click to unlock" : "Locked"}
            className="text-destructive hover:text-destructive/70 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
          </button>
        </div>
      );
    },
  },
  {
    accessorKey: "total_orders",
    header: () => <div className="text-right">Orders</div>,
    cell: ({ row }) => {
      const n = row.getValue<number>("total_orders");
      return <div className="text-right">{n != null ? n : "—"}</div>;
    },
  },
  {
    accessorKey: "total_spent",
    header: () => <div className="text-right">Amount spent</div>,
    cell: ({ row }) => (
      <div className="text-right font-medium">{fmt$(row.getValue("total_spent"))}</div>
    ),
  },
  ];
}

export default function CustomersPage() {
  const router = useRouter();
  const permissions = usePermissions("/customers");
  const [unlockingId, setUnlockingId] = React.useState<string | number | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState<number>(DEFAULT_PAGE_SIZE);
  const [rows, setRows] = React.useState<UserRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(false);
  const [selected, setSelected] = React.useState<UserRow[]>([]);
  const [clearKey, setClearKey] = React.useState(0);
  const [summary, setSummary] = React.useState<UsersSummary>(EMPTY_SUMMARY);
  const [summaryLoading, setSummaryLoading] = React.useState(true);

  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
  const [statuses, setStatuses] = React.useState<string[]>(["active"]);
  const [subscriptions, setSubscriptions] = React.useState<string[]>([]);
  const [searchInput, setSearchInput] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [columnFilters, setColumnFilters] = React.useState<Record<string, string[]>>({});

  React.useEffect(() => { setPage(1); }, [dateRange, statuses, subscriptions, search, columnFilters]);

  const buildFilters = React.useCallback((): Record<string, unknown> => {
    const filters: Record<string, unknown> = { role: "customer" };
    if (statuses.length === 1) filters.is_active = statuses[0] === "active";
    if (subscriptions.length === 1) filters.email_subscribed = subscriptions[0] === "subscribed";
    if (search) filters.full_name = { contains: search };

    const name = columnFilters.full_name?.[0];
    if (name) filters.full_name = { contains: name };
    if (columnFilters.email_subscription?.length === 1) {
      filters.email_subscribed = columnFilters.email_subscription[0] === "subscribed";
    }
    if (columnFilters.is_locked?.length === 1) {
      filters.is_locked = columnFilters.is_locked[0] === "yes";
    }
    return filters;
  }, [statuses, subscriptions, search, columnFilters]);

  const load = React.useCallback(() => {
    setLoading(true);
    listUsers({ page, limit: pageSize, dateRange, filters: buildFilters() })
      .then(({ rows: r, total: t, totalPages: tp }) => {
        setRows(r);
        setTotal(t); setTotalPages(tp);
      })
      .catch((e) => toast.error(apiErrorMessage(e, "Couldn't load customers.")))
      .finally(() => setLoading(false));
  }, [page, pageSize, dateRange, buildFilters]);

  React.useEffect(() => { load(); }, [load]);

  React.useEffect(() => {
    let cancelled = false;
    setSummaryLoading(true);
    getUsersSummary({ dateRange, filters: buildFilters() })
      .then((s) => !cancelled && setSummary(s))
      .catch(() => !cancelled && setSummary(EMPTY_SUMMARY))
      .finally(() => !cancelled && setSummaryLoading(false));
    return () => { cancelled = true; };
  }, [dateRange, buildFilters]);

  const handleUnlock = async (row: UserRow) => {
    setUnlockingId(row.id);
    try {
      toast.success(await unlockUser(row.id));
      load();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't unlock the customer."));
    } finally {
      setUnlockingId(null);
    }
  };

  const fetchAllForExport = React.useCallback(
    async () =>
      (await listUsers({ page: 1, limit: EXPORT_CAP, dateRange, filters: buildFilters() })).rows,
    [dateRange, buildFilters]
  );

  const columns = React.useMemo(
    () => buildColumns(!!permissions.can_edit, unlockingId, handleUnlock),
    [permissions.can_edit, unlockingId]
  );

  const tiles: SummaryTile[] = [
    { label: "Total customers", value: summary.total_customers.toLocaleString("en-US") },
    {
      label: "New customers",
      value: summary.new_customers.current.toLocaleString("en-US"),
      changePercent: summary.new_customers.change_percent,
    },
    { label: "Subscribed to email", value: summary.subscribed.toLocaleString("en-US") },
    { label: "Locked accounts", value: summary.locked.toLocaleString("en-US") },
  ];

  return (
    <div className="flex flex-col gap-4">
      {}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Customers</h1>
        <ExportMenu
          filename="customers"
          columns={exportColumns}
          selected={selected}
          fetchAll={fetchAllForExport}
          total={total}
          noun="customer"
        />
      </div>

      {}
      <SummaryStatStrip tiles={tiles} loading={summaryLoading} />

      {}
      <div className="flex flex-wrap items-center gap-2">
        <DateRangePicker value={dateRange} onChange={setDateRange} />

        <MultiSelectFilter label="Status" options={STATUS_OPTIONS} value={statuses} onChange={setStatuses} />
        <MultiSelectFilter
          label="Email subscription"
          options={SUBSCRIPTION_OPTIONS}
          value={subscriptions}
          onChange={setSubscriptions}
        />

        <div className="flex items-center gap-1">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setSearch(searchInput)}
              className="h-9 w-48 rounded-lg border border-input bg-card pl-8 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
          <Button size="sm" variant="outline" onClick={() => setSearch(searchInput)}>Go</Button>
        </div>
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-3 py-2">
          <span className="text-sm font-medium">
            {selected.length} customer{selected.length === 1 ? "" : "s"} selected
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
        columns={columns}
        data={rows}
        loading={loading}
        onSelectionChange={setSelected}
        clearSelectionKey={clearKey}
        onRowClick={(row) => router.push(`/customers/${row.id}`)}
        columnFilterDefs={COLUMN_FILTERS}
        serverColumnFilters={{ value: columnFilters, onChange: setColumnFilters }}
        serverPagination={{
          pageIndex: page - 1,
          pageCount: totalPages,
          total,
          onPageChange: (idx) => setPage(idx + 1),
          pageSize,
          onPageSizeChange: setPageSize,
        }}
      />
    </div>
  );
}
