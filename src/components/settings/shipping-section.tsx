"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Eye, Loader2, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { apiErrorMessage } from "@/lib/auth-api";
import {
  listShipments,
  getShipmentById,
  trackShipment,
  voidShipment,
  cancelPickup,
  type ShipmentRow,
} from "@/lib/admin-api";

const PAGE_SIZE = 10;

function statusTone(s?: string) {
  if (!s) return "neutral" as const;
  if (s === "delivered" || s === "completed") return "success" as const;
  if (s === "cancelled" || s === "voided") return "neutral" as const;
  return "warning" as const;
}

export function ShippingSection() {
  const [rows, setRows] = React.useState<ShipmentRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(0);
  const [pageCount, setPageCount] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [refreshKey, setRefreshKey] = React.useState(0);

  const [detailOpen, setDetailOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<ShipmentRow | null>(null);
  const [trackData, setTrackData] = React.useState<Record<string, unknown> | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  React.useEffect(() => { setPage(0); }, [debounced]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listShipments({ page: page + 1, limit: PAGE_SIZE, filters: { order_number: debounced || undefined } })
      .then((res) => {
        if (cancelled) return;
        setRows(res.rows);
        setTotal(res.total);
        setPageCount(res.totalPages);
      })
      .catch((err) => { if (!cancelled) toast.error(apiErrorMessage(err, "Couldn't load shipments.")); })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [page, debounced, refreshKey]);

  const openDetail = async (row: ShipmentRow) => {
    setSelected(row);
    setTrackData(null);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const [detail, track] = await Promise.allSettled([
        getShipmentById(row.id),
        trackShipment(row.id),
      ]);
      if (detail.status === "fulfilled") setSelected(detail.value);
      if (track.status === "fulfilled") setTrackData(track.value as Record<string, unknown>);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleVoid = async (id: number | string) => {
    if (!confirm("Void / cancel this shipment?")) return;
    try {
      const msg = await voidShipment(id);
      toast.success(msg);
      setDetailOpen(false);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't void shipment."));
    }
  };

  const handleCancelPickup = async (id: number | string) => {
    if (!confirm("Cancel the pickup for this shipment?")) return;
    try {
      const msg = await cancelPickup(id);
      toast.success(msg);
      setDetailOpen(false);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't cancel pickup."));
    }
  };

  const columns: ColumnDef<ShipmentRow>[] = [
    {
      accessorKey: "order_number",
      header: "Order",
      cell: ({ row }) => (
        <span className="font-mono text-sm font-medium">
          {row.original.order_number ?? `#${row.original.order_id ?? row.original.id}`}
        </span>
      ),
    },
    {
      accessorKey: "carrier",
      header: "Carrier",
      cell: ({ row }) => row.original.carrier ?? "—",
    },
    {
      accessorKey: "tracking_number",
      header: "Tracking #",
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.tracking_number ?? "—"}</span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const s = row.original.status ?? "unknown";
        return <StatusBadge status={s.replace(/_/g, " ")} tone={statusTone(s)} />;
      },
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
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="ghost"
          className="size-8 p-0"
          onClick={(e) => { e.stopPropagation(); openDetail(row.original); }}
        >
          <Eye className="size-4" />
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-44 flex-1 sm:max-w-64">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by order or tracking #"
            className="bg-card pl-8"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        onRowClick={openDetail}
        serverPagination={{ pageIndex: page, pageCount, total, onPageChange: setPage }}
      />

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Shipment {selected?.order_number ?? `#${selected?.id}`}
            </DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : selected ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <DetailRow label="Carrier" value={selected.carrier} />
                <DetailRow label="Tracking #" value={selected.tracking_number} mono />
                <DetailRow label="Status">
                  <StatusBadge
                    status={(selected.status ?? "unknown").replace(/_/g, " ")}
                    tone={statusTone(selected.status)}
                  />
                </DetailRow>
                <DetailRow label="Shipped at" value={
                  selected.shipped_at
                    ? format(new Date(selected.shipped_at), "MMM d, yyyy")
                    : undefined
                } />
                <DetailRow label="Est. delivery" value={
                  selected.estimated_delivery
                    ? format(new Date(selected.estimated_delivery), "MMM d, yyyy")
                    : undefined
                } />
              </div>

              {selected.delivery_address && (
                <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Delivery address</p>
                  <p>{selected.delivery_address as string}</p>
                </div>
              )}

              {/* Tracking events */}
              {trackData && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tracking events</p>
                  {Array.isArray((trackData as Record<string, unknown>).events)
                    ? ((trackData as Record<string, unknown[]>).events as Record<string, unknown>[]).map((ev, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <Badge variant="outline" className="shrink-0 text-[10px]">
                            {ev.status as string ?? "update"}
                          </Badge>
                          <span className="text-muted-foreground">{ev.description as string ?? JSON.stringify(ev)}</span>
                        </div>
                      ))
                    : <p className="text-sm text-muted-foreground">{JSON.stringify(trackData)}</p>
                  }
                </div>
              )}

              <div className="flex gap-2 pt-2 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive border-destructive/40 hover:bg-destructive/10"
                  onClick={() => handleVoid(selected.id)}
                >
                  <Trash2 className="size-3.5" />
                  Void shipment
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive border-destructive/40 hover:bg-destructive/10"
                  onClick={() => handleCancelPickup(selected.id)}
                >
                  <X className="size-3.5" />
                  Cancel pickup
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono,
  children,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      {children ?? (
        <p className={mono ? "font-mono text-xs" : "font-medium"}>
          {value ?? "—"}
        </p>
      )}
    </div>
  );
}
