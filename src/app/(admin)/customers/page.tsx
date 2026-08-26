"use client";

import * as React from "react";
import { format } from "date-fns";
import { type ColumnDef } from "@tanstack/react-table";
import { Download, Search, X } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/data-table";
import { DateRangePicker } from "@/components/date-range-picker";
import { StatusBadge } from "@/components/status-badge";
import { apiErrorMessage } from "@/lib/auth-api";
import { listUsers, USER_ROLES, type UserRow } from "@/lib/admin-api";
import type { DateRange } from "react-day-picker";

const PAGE_LIMIT = 20;

const fmt$ = (n?: number | null) =>
  n != null ? `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—";

const initials = (name: string) =>
  name.split(/\s+/).map((p) => p[0] ?? "").join("").slice(0, 2).toUpperCase() || "??";

const columns: ColumnDef<UserRow>[] = [
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
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "full_name",
    header: "Customer",
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
    accessorKey: "role",
    header: "Role",
    cell: ({ row }) => {
      const r = row.getValue<string>("role") ?? "";
      return <span className="capitalize text-sm">{r.replace(/_/g, " ")}</span>;
    },
  },
  {
    accessorKey: "phone",
    header: "Phone",
    cell: ({ row }) => row.getValue("phone") ?? "—",
  },
  {
    accessorKey: "is_active",
    header: "Status",
    cell: ({ row }) => (
      <StatusBadge
        status={row.getValue("is_active") ? "Active" : "Inactive"}
        tone={row.getValue("is_active") ? "success" : "neutral"}
      />
    ),
  },
  {
    accessorKey: "is_locked",
    header: "Locked",
    cell: ({ row }) =>
      row.getValue("is_locked") ? (
        <StatusBadge status="Locked" tone="critical" />
      ) : null,
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
  {
    accessorKey: "created_at",
    header: "Joined",
    cell: ({ row }) => {
      const v = row.getValue<string>("created_at");
      return v ? format(new Date(v), "MMM d, yyyy") : "—";
    },
  },
];

export default function CustomersPage() {
  const [page, setPage] = React.useState(1);
  const [rows, setRows] = React.useState<UserRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(false);

  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
  // This page lists store customers; the dropdown can widen it to other roles.
  const [role, setRole] = React.useState("customer");
  const [isActive, setIsActive] = React.useState("all");
  const [searchInput, setSearchInput] = React.useState("");
  const [search, setSearch] = React.useState("");

  React.useEffect(() => { setPage(1); }, [dateRange, role, isActive, search]);

  const load = React.useCallback(() => {
    setLoading(true);
    const filters: Record<string, unknown> = {};
    if (role !== "all") filters.role = role;
    if (isActive !== "all") filters.is_active = isActive === "active";
    if (search) filters.full_name = search;

    listUsers({ page, limit: PAGE_LIMIT, dateRange, filters })
      .then(({ rows: r, total: t, totalPages: tp }) => {
        setRows(r); setTotal(t); setTotalPages(tp);
      })
      .catch((e) => toast.error(apiErrorMessage(e, "Couldn't load customers.")))
      .finally(() => setLoading(false));
  }, [page, dateRange, role, isActive, search]);

  React.useEffect(() => { load(); }, [load]);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Customers</h1>
        <Button variant="outline">
          <Download className="size-4" /> Export
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <DateRangePicker value={dateRange} onChange={setDateRange} />

        <Select value={role} onValueChange={(v) => setRole(v ?? "all")}>
          <SelectTrigger className="h-9 w-44 bg-card">
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {USER_ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {r.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={isActive} onValueChange={(v) => setIsActive(v ?? "all")}>
          <SelectTrigger className="h-9 w-36 bg-card">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>

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

      {/* Table */}
      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        serverPagination={{
          pageIndex: page - 1,
          pageCount: totalPages,
          total,
          onPageChange: (idx) => setPage(idx + 1),
        }}
      />
    </div>
  );
}
