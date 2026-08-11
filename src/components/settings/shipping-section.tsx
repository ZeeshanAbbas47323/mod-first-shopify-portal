"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { CalendarClock, Eye, Loader2, Plus, Search, Trash2, X } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/data-table";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { StatusBadge } from "@/components/status-badge";
import { apiErrorMessage } from "@/lib/auth-api";
import {
  listShipments,
  getShipmentById,
  trackShipment,
  voidShipment,
  cancelPickup,
  createShipmentRate,
  schedulePickup,
  listCouriers,
  type ShipmentRow,
  type CourierRow,
} from "@/lib/admin-api";

const PAGE_SIZE = 10;

function statusTone(s?: string) {
  const v = (s ?? "").toUpperCase();
  if (!v) return "neutral" as const;
  if (v === "DELIVERED") return "success" as const;
  if (v === "CANCELLED" || v === "RETURNED") return "neutral" as const;
  if (v === "FAILED") return "critical" as const;
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
  const [createOpen, setCreateOpen] = React.useState(false);
  const [pickupOpen, setPickupOpen] = React.useState(false);

  const [detailOpen, setDetailOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<ShipmentRow | null>(null);
  const [trackData, setTrackData] = React.useState<Record<string, unknown> | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [confirmAction, setConfirmAction] = React.useState<{ type: "void" | "cancel_pickup"; id: number | string } | null>(null);
  const [confirmLoading, setConfirmLoading] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  React.useEffect(() => { setPage(0); }, [debounced]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listShipments({ page: page + 1, limit: PAGE_SIZE, filters: { tracking_number: debounced || undefined } })
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

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    setConfirmLoading(true);
    try {
      const msg = confirmAction.type === "void"
        ? await voidShipment(confirmAction.id)
        : await cancelPickup(confirmAction.id);
      toast.success(msg);
      setConfirmAction(null);
      setDetailOpen(false);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.error(apiErrorMessage(err, confirmAction.type === "void" ? "Couldn't void shipment." : "Couldn't cancel pickup."));
    } finally {
      setConfirmLoading(false);
    }
  };

  const columns: ColumnDef<ShipmentRow>[] = [
    {
      accessorKey: "shipment_number",
      header: "Shipment",
      cell: ({ row }) => (
        <span className="font-mono text-sm font-medium">
          {row.original.shipment_number ?? `#${row.original.id}`}
        </span>
      ),
    },
    {
      accessorKey: "order_id",
      header: "Order",
      cell: ({ row }) => row.original.order_id ? `#${row.original.order_id}` : "—",
    },
    {
      accessorKey: "service_name",
      header: "Service",
      cell: ({ row }) => row.original.service_name ?? "—",
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
        const s = row.original.status ?? "UNKNOWN";
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
          onClick={(e: React.MouseEvent) => { e.stopPropagation(); openDetail(row.original); }}
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
            placeholder="Search by tracking #"
            className="bg-card pl-8"
          />
        </div>
        <Button className="ml-auto" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" /> Create shipment
        </Button>
      </div>

      <CreateShipmentDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => setRefreshKey((k) => k + 1)}
      />

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
              Shipment {selected?.shipment_number ?? `#${selected?.id}`}
            </DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : selected ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <DetailRow label="Order" value={selected.order_id ? `#${selected.order_id}` : undefined} />
                <DetailRow label="Service" value={selected.service_name} />
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
                <DetailRow label="Delivered at" value={
                  selected.delivered_at
                    ? format(new Date(selected.delivered_at), "MMM d, yyyy")
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

              <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPickupOpen(true)}
                >
                  <CalendarClock className="size-3.5" />
                  Schedule pickup
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive border-destructive/40 hover:bg-destructive/10"
                  onClick={() => setConfirmAction({ type: "void", id: selected.id })}
                >
                  <Trash2 className="size-3.5" />
                  Void shipment
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive border-destructive/40 hover:bg-destructive/10"
                  onClick={() => setConfirmAction({ type: "cancel_pickup", id: selected.id })}
                >
                  <X className="size-3.5" />
                  Cancel pickup
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <SchedulePickupDialog
        open={pickupOpen}
        onOpenChange={setPickupOpen}
        shipmentId={selected?.id ?? null}
        onScheduled={() => setRefreshKey((k) => k + 1)}
      />

      <ConfirmDeleteDialog
        open={!!confirmAction}
        onOpenChange={(v) => { if (!v) setConfirmAction(null); }}
        loading={confirmLoading}
        onConfirm={handleConfirmAction}
        title={confirmAction?.type === "void" ? "Void this shipment?" : "Cancel pickup?"}
        description={confirmAction?.type === "void"
          ? "This will void / cancel the shipment. This action cannot be undone."
          : "This will cancel the scheduled pickup for this shipment."}
      />
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

// ─── Schedule Pickup Dialog ──────────────────────────────────────────────────

const schedulePickupSchema = z.object({
  requested_start_time: z.string().min(1, "Start time is required"),
  requested_end_time: z.string().min(1, "End time is required"),
});
type SchedulePickupValues = z.infer<typeof schedulePickupSchema>;

function SchedulePickupDialog({
  open, onOpenChange, shipmentId, onScheduled,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  shipmentId: number | string | null;
  onScheduled: () => void;
}) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<SchedulePickupValues>({
      resolver: zodResolver(schedulePickupSchema),
      defaultValues: { requested_start_time: "", requested_end_time: "" },
    });

  React.useEffect(() => {
    if (open) reset({ requested_start_time: "", requested_end_time: "" });
  }, [open, reset]);

  const onSubmit = async (values: SchedulePickupValues) => {
    if (!shipmentId) return;
    try {
      const msg = await schedulePickup({
        shipment_ids: [shipmentId],
        requested_start_time: new Date(values.requested_start_time).toISOString(),
        requested_end_time: new Date(values.requested_end_time).toISOString(),
      });
      toast.success(msg);
      onOpenChange(false);
      onScheduled();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't schedule pickup."));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Schedule pickup</DialogTitle>
          <DialogDescription>Choose a pickup window for this shipment.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="pickup-start">Start time *</Label>
            <Input id="pickup-start" type="datetime-local"
              aria-invalid={!!errors.requested_start_time} {...register("requested_start_time")} />
            {errors.requested_start_time && <p className="text-sm text-destructive">{errors.requested_start_time.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pickup-end">End time *</Label>
            <Input id="pickup-end" type="datetime-local"
              aria-invalid={!!errors.requested_end_time} {...register("requested_end_time")} />
            {errors.requested_end_time && <p className="text-sm text-destructive">{errors.requested_end_time.message}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              Schedule pickup
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Create Shipment Dialog ─────────────────────────────────────────────────

const createShipmentSchema = z.object({
  courier_id: z.string().min(1, "Courier is required"),
  order_id: z.string().min(1, "Order ID is required"),
});
type CreateShipmentValues = z.infer<typeof createShipmentSchema>;

function CreateShipmentDialog({
  open, onOpenChange, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [couriers, setCouriers] = React.useState<CourierRow[]>([]);

  React.useEffect(() => {
    if (open) {
      listCouriers({ page: 1, limit: 100, filters: {} })
        .then((res) => setCouriers(res.rows))
        .catch(() => setCouriers([]));
    }
  }, [open]);

  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } =
    useForm<CreateShipmentValues>({
      resolver: zodResolver(createShipmentSchema),
      defaultValues: { courier_id: "", order_id: "" },
    });

  React.useEffect(() => {
    if (open) reset({ courier_id: "", order_id: "" });
  }, [open, reset]);

  const onSubmit = async (values: CreateShipmentValues) => {
    try {
      const msg = await createShipmentRate({
        courier_id: Number(values.courier_id),
        order_id: Number(values.order_id),
      });
      toast.success(msg);
      onOpenChange(false);
      onCreated();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't create shipment."));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Create shipment</DialogTitle>
          <DialogDescription>
            Book a shipment for an order using the destination and package details already on the order.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="ship-order-id">Order ID *</Label>
            <Input id="ship-order-id" type="number" min="1" placeholder="17"
              aria-invalid={!!errors.order_id} {...register("order_id")} />
            {errors.order_id && <p className="text-sm text-destructive">{errors.order_id.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Courier *</Label>
            <Controller control={control} name="courier_id" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select a courier" /></SelectTrigger>
                <SelectContent>
                  {couriers.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )} />
            {errors.courier_id && <p className="text-sm text-destructive">{errors.courier_id.message}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              Create shipment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
