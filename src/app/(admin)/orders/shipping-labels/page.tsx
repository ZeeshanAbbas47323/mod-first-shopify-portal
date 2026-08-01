"use client";

import * as React from "react";
import { format } from "date-fns";
import { type ColumnDef } from "@tanstack/react-table";
import { Search, X, Eye, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { apiErrorMessage } from "@/lib/auth-api";
import {
  listShipments,
  type ShipmentRow,
} from "@/lib/admin-api";

const PAGE_LIMIT = 20;

const columns: ColumnDef<ShipmentRow>[] = [
  {
    accessorKey: "shipment_number",
    header: "Shipment",
    cell: ({ row }) => (
      <span className="font-mono text-sm font-medium">
        {row.getValue("shipment_number") ?? `#${row.original.id}`}
      </span>
    ),
  },
  {
    accessorKey: "order_id",
    header: "Order",
    cell: ({ row }) => {
      const v = row.getValue<string | number>("order_id");
      return v ? <span className="text-sm">#{String(v)}</span> : "—";
    },
  },
  {
    accessorKey: "service_name",
    header: "Service",
    cell: ({ row }) => (
      <span className="text-sm">{row.getValue("service_name") ?? "—"}</span>
    ),
  },
  {
    accessorKey: "tracking_number",
    header: "Tracking #",
    cell: ({ row }) => {
      const v = row.getValue<string>("tracking_number");
      return v ? <span className="font-mono text-sm">{v}</span> : "—";
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.getValue("status") ?? "—"} />,
  },
  {
    accessorKey: "created_at",
    header: "Created",
    cell: ({ row }) => {
      const v = row.getValue<string>("created_at");
      return v ? format(new Date(v), "MMM d, yyyy") : "—";
    },
  },
  {
    id: "actions",
    header: "",
    cell: () => (
      <Button variant="ghost" size="icon" className="size-8">
        <Eye className="size-4" />
      </Button>
    ),
  },
];

export default function ShippingLabelsPage() {
  const [page, setPage] = React.useState(1);
  const [rows, setRows] = React.useState<ShipmentRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [searchInput, setSearchInput] = React.useState("");

  React.useEffect(() => { setPage(1); }, [search]);

  const load = React.useCallback(() => {
    setLoading(true);
    listShipments({ page, limit: PAGE_LIMIT, search: search || undefined })
      .then(({ rows: r, total: t, totalPages: tp }) => {
        setRows(r); setTotal(t); setTotalPages(tp);
      })
      .catch((e) => toast.error(apiErrorMessage(e, "Couldn't load shipments.")))
      .finally(() => setLoading(false));
  }, [page, search]);

  React.useEffect(() => { load(); }, [load]);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Shipping & Delivery</h1>
        <Button>
          <Plus className="size-4" /> Create shipment
        </Button>
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by tracking #"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setSearch(searchInput)}
            className="h-9 rounded-lg border border-input bg-card pl-8 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-ring w-64"
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
        <Button size="sm" variant="outline" onClick={() => setSearch(searchInput)}>
          Go
        </Button>
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
