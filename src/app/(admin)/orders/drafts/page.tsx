"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/data-table";
import { StatusBadge, type BadgeTone } from "@/components/status-badge";
import { apiErrorMessage } from "@/lib/auth-api";
import {
  DRAFT_STATUS_LABELS,
  listDraftOrders,
  type DraftOrderRow,
} from "@/lib/admin-api";

const PAGE_SIZE = 20;

export const DRAFT_TONES: Record<string, BadgeTone> = {
  open: "attention",
  invoice_sent: "info",
  completed: "success",
  cancelled: "neutral",
};

const STATUS_FILTER_ITEMS: Record<string, string> = {
  all: "All statuses",
  ...DRAFT_STATUS_LABELS,
};

const CHANNEL_ITEMS: Record<string, string> = {
  all: "All channels",
  point_of_sale: "Point of sale",
  online_store: "Online store",
};

const money = (v?: number | string | null) =>
  Number(v ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD" });

const customerName = (row: DraftOrderRow) =>
  row.customer?.full_name ?? row.full_name ?? row.email ?? "No customer";

export default function DraftOrdersPage() {
  const router = useRouter();

  const [rows, setRows] = React.useState<DraftOrderRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(0);
  const [pageCount, setPageCount] = React.useState(1);
  const [total, setTotal] = React.useState(0);

  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [channel, setChannel] = React.useState("all");

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  React.useEffect(() => {
    setPage(0);
  }, [debounced, status, channel]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listDraftOrders({
      page: page + 1,
      limit: PAGE_SIZE,
      search: debounced || undefined,
      sortBy: "created_at",
      sortOrder: "desc",
      filters: {
        status: status === "all" ? undefined : status,
        channel: channel === "all" ? undefined : channel,
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
        toast.error(apiErrorMessage(error, "Couldn't load draft orders."));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, debounced, status, channel]);

  const columns = React.useMemo<ColumnDef<DraftOrderRow>[]>(
    () => [
      {
        accessorKey: "draft_number",
        header: "Draft",
        cell: ({ row }) => (
          <span className="font-mono font-medium">
            {row.original.draft_number ?? `#${row.original.id}`}
          </span>
        ),
      },
      {
        accessorKey: "created_at",
        header: "Date",
        cell: ({ row }) => {
          const v = row.original.created_at;
          if (!v) return "—";
          const d = new Date(v);
          if (isNaN(d.getTime())) return "—";
          return (
            <div className="whitespace-nowrap">
              <p>{format(d, "MMM d, yyyy")}</p>
              <p className="text-xs text-muted-foreground">{format(d, "h:mm a")}</p>
            </div>
          );
        },
      },
      {
        accessorKey: "full_name",
        header: "Customer",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate">{customerName(row.original)}</p>
            {row.original.email && (
              <p className="truncate text-xs text-muted-foreground">
                {row.original.email}
              </p>
            )}
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const s = row.original.status ?? "open";
          return (
            <StatusBadge
              status={DRAFT_STATUS_LABELS[s] ?? s}
              tone={DRAFT_TONES[s] ?? "neutral"}
            />
          );
        },
      },
      {
        accessorKey: "channel",
        header: "Channel",
        cell: ({ row }) =>
          CHANNEL_ITEMS[row.original.channel ?? ""] ?? row.original.channel ?? "—",
      },
      {
        accessorKey: "items",
        header: () => <div className="text-right">Items</div>,
        cell: ({ row }) => (
          <div className="text-right tabular-nums">
            {row.original.items?.length ?? 0}
          </div>
        ),
      },
      {
        accessorKey: "total_amount",
        header: () => <div className="text-right">Total</div>,
        cell: ({ row }) => (
          <div className="text-right font-medium tabular-nums">
            {money(row.original.total_amount)}
          </div>
        ),
      },
    ],
    []
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Drafts</h1>
          <p className="text-sm text-muted-foreground">
            Orders you build for a customer — no stock or payment is taken until
            you complete them.
          </p>
        </div>
        <Button render={<Link href="/orders/drafts/new" />}>
          <Plus className="size-4" />
          Create draft order
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-44 flex-1 sm:max-w-64">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search draft, name, email or phone"
            className="bg-card pl-8"
          />
        </div>
        <Select items={STATUS_FILTER_ITEMS} value={status} onValueChange={(v) => setStatus(v as string)}>
          <SelectTrigger className="min-w-32 bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_FILTER_ITEMS).map(([v, label]) => (
              <SelectItem key={v} value={v}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select items={CHANNEL_ITEMS} value={channel} onValueChange={(v) => setChannel(v as string)}>
          <SelectTrigger className="min-w-36 bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(CHANNEL_ITEMS).map(([v, label]) => (
              <SelectItem key={v} value={v}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        onRowClick={(row) => router.push(`/orders/drafts/${row.id}`)}
        serverPagination={{ pageIndex: page, pageCount, total, onPageChange: setPage }}
      />
    </div>
  );
}
