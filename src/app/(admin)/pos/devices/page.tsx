"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Loader2, Plus, Search } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { apiErrorMessage } from "@/lib/auth-api";
import { listBranches, type BranchRow } from "@/lib/admin-api";
import {
  DEVICE_TYPES,
  RECEIPT_TYPES,
  createPosDevice,
  listPosDevices,
  updatePosDevice,
  type PosDeviceRow,
} from "@/lib/pos-api";

const PAGE_SIZE = 15;

const humanize = (v?: string) =>
  v ? v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "—";

const DEVICE_TYPE_ITEMS = Object.fromEntries(
  DEVICE_TYPES.map((t) => [t, humanize(t)])
) as Record<string, string>;

const RECEIPT_TYPE_ITEMS: Record<string, string> = {
  thermal_80mm: "Thermal 80mm",
  thermal_58mm: "Thermal 58mm",
  a4: "A4",
};

const STATUS_ITEMS: Record<string, string> = {
  all: "All statuses",
  active: "Active",
  inactive: "Inactive",
};

export default function PosDevicesPage() {
  const [rows, setRows] = React.useState<PosDeviceRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(0);
  const [pageCount, setPageCount] = React.useState(1);
  const [total, setTotal] = React.useState(0);

  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [branches, setBranches] = React.useState<BranchRow[]>([]);
  const [branchId, setBranchId] = React.useState("all");

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<PosDeviceRow | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);

  React.useEffect(() => {
    listBranches({ page: 1, limit: 100 })
      .then((res) => setBranches(res.rows))
      .catch(() => setBranches([]));
  }, []);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  React.useEffect(() => {
    setPage(0);
  }, [debounced, status, branchId]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listPosDevices({
      page: page + 1,
      limit: PAGE_SIZE,
      filters: {
        name: debounced || undefined,
        branch_id: branchId === "all" ? undefined : Number(branchId),
        is_active: status === "all" ? undefined : status === "active",
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
        toast.error(apiErrorMessage(error, "Couldn't load POS devices."));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, debounced, status, branchId, refreshKey]);

  const branchName = React.useCallback(
    (id?: number | null) =>
      branches.find((b) => String(b.id) === String(id))?.name ?? "—",
    [branches]
  );

  const columns = React.useMemo<ColumnDef<PosDeviceRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Device",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{row.original.name}</p>
            <p className="truncate font-mono text-xs text-muted-foreground">
              {row.original.device_code}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "branch_id",
        header: "Branch",
        cell: ({ row }) =>
          row.original.branch?.name ?? branchName(row.original.branch_id),
      },
      {
        accessorKey: "device_type",
        header: "Type",
        cell: ({ row }) => humanize(row.original.device_type),
      },
      {
        accessorKey: "location",
        header: "Location",
        cell: ({ row }) => row.original.location || "—",
      },
      {
        accessorKey: "ip_address",
        header: "Network",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.ip_address || "—"}
            {row.original.mac_address ? ` · ${row.original.mac_address}` : ""}
          </span>
        ),
      },
      {
        accessorKey: "receipt_type",
        header: "Receipt",
        cell: ({ row }) =>
          RECEIPT_TYPE_ITEMS[row.original.receipt_type ?? ""] ??
          humanize(row.original.receipt_type),
      },
      {
        accessorKey: "is_active",
        header: "Status",
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.is_active === false ? "Inactive" : "Active"}
            tone={row.original.is_active === false ? "neutral" : "success"}
          />
        ),
      },
      {
        accessorKey: "created_at",
        header: "Added",
        cell: ({ row }) => {
          const d = row.original.created_at;
          if (!d) return "—";
          const date = new Date(d);
          return isNaN(date.getTime()) ? "—" : format(date, "MMM d, yyyy");
        },
      },
    ],
    [branchName]
  );

  const branchItems: Record<string, string> = {
    all: "All branches",
    ...Object.fromEntries(branches.map((b) => [String(b.id), b.name])),
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">POS devices</h1>
          <p className="text-sm text-muted-foreground">
            Registers and tablets that ring up sales at each branch.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="size-4" />
          Add device
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-44 flex-1 sm:max-w-56">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name"
            className="bg-card pl-8"
          />
        </div>
        <Select items={branchItems} value={branchId} onValueChange={(v) => setBranchId(v as string)}>
          <SelectTrigger className="min-w-36 bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All branches</SelectItem>
            {branches.map((b) => (
              <SelectItem key={b.id} value={String(b.id)}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select items={STATUS_ITEMS} value={status} onValueChange={(v) => setStatus(v as string)}>
          <SelectTrigger className="min-w-32 bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        onRowClick={(row) => {
          setEditing(row);
          setDialogOpen(true);
        }}
        serverPagination={{ pageIndex: page, pageCount, total, onPageChange: setPage }}
      />

      <DeviceDialog
        editing={editing}
        branches={branches}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}

// ─── Dialog ───────────────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  device_code: z.string().min(1, "Device code is required"),
  branch_id: z.string().min(1, "Branch is required"),
  device_type: z.string().min(1),
  receipt_type: z.string().min(1),
  location: z.string().optional(),
  ip_address: z.string().optional(),
  mac_address: z.string().max(50, "Max 50 characters").optional(),
  is_active: z.enum(["active", "inactive"]),
});
type Values = z.infer<typeof schema>;

function DeviceDialog({
  editing,
  branches,
  open,
  onOpenChange,
  onSaved,
}: {
  editing: PosDeviceRow | null;
  branches: BranchRow[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      device_code: "",
      branch_id: "",
      device_type: "tablet",
      receipt_type: "thermal_80mm",
      location: "",
      ip_address: "",
      mac_address: "",
      is_active: "active",
    },
  });

  React.useEffect(() => {
    if (!open) return;
    reset({
      name: editing?.name ?? "",
      device_code: editing?.device_code ?? "",
      branch_id: editing?.branch_id != null ? String(editing.branch_id) : "",
      device_type: editing?.device_type ?? "tablet",
      receipt_type: editing?.receipt_type ?? "thermal_80mm",
      location: editing?.location ?? "",
      ip_address: editing?.ip_address ?? "",
      mac_address: editing?.mac_address ?? "",
      is_active: editing?.is_active === false ? "inactive" : "active",
    });
  }, [open, editing, reset]);

  const onSubmit = async (values: Values) => {
    const body = {
      name: values.name,
      device_code: values.device_code,
      branch_id: Number(values.branch_id),
      device_type: values.device_type,
      receipt_type: values.receipt_type,
      location: values.location || undefined,
      ip_address: values.ip_address || undefined,
      mac_address: values.mac_address || undefined,
      is_active: values.is_active === "active",
    };
    try {
      const message = editing
        ? await updatePosDevice(editing.id, body)
        : await createPosDevice(body);
      toast.success(message);
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(
        apiErrorMessage(error, `Couldn't ${editing ? "update" : "create"} the device.`)
      );
    }
  };

  const branchItems = Object.fromEntries(branches.map((b) => [String(b.id), b.name]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit device" : "Add POS device"}</DialogTitle>
          <DialogDescription>
            {editing
              ? `Update "${editing.name}".`
              : "Register a register, tablet or kiosk for a branch."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="device-name">Name</Label>
              <Input
                id="device-name"
                placeholder="Counter 1 Tablet"
                aria-invalid={!!errors.name}
                {...register("name")}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="device-code">Device code</Label>
              <Input
                id="device-code"
                placeholder="POS-TAB-001"
                className="font-mono"
                aria-invalid={!!errors.device_code}
                {...register("device_code")}
              />
              {errors.device_code && (
                <p className="text-sm text-destructive">{errors.device_code.message}</p>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Branch</Label>
              <Controller
                control={control}
                name="branch_id"
                render={({ field }) => (
                  <Select
                    items={branchItems}
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((b) => (
                        <SelectItem key={b.id} value={String(b.id)}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.branch_id && (
                <p className="text-sm text-destructive">{errors.branch_id.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Device type</Label>
              <Controller
                control={control}
                name="device_type"
                render={({ field }) => (
                  <Select
                    items={DEVICE_TYPE_ITEMS}
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DEVICE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {humanize(t)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="device-location">Location</Label>
              <Input id="device-location" placeholder="Main Counter" {...register("location")} />
            </div>
            <div className="space-y-1.5">
              <Label>Receipt format</Label>
              <Controller
                control={control}
                name="receipt_type"
                render={({ field }) => (
                  <Select
                    items={RECEIPT_TYPE_ITEMS}
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RECEIPT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {RECEIPT_TYPE_ITEMS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="device-ip">IP address</Label>
              <Input
                id="device-ip"
                placeholder="192.168.1.45"
                className="font-mono"
                {...register("ip_address")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="device-mac">MAC address</Label>
              <Input
                id="device-mac"
                placeholder="00:1B:44:11:3A:B7"
                className="font-mono"
                {...register("mac_address")}
              />
              {errors.mac_address && (
                <p className="text-sm text-destructive">{errors.mac_address.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Controller
                control={control}
                name="is_active"
                render={({ field }) => (
                  <Select
                    items={{ active: "Active", inactive: "Inactive" }}
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {editing ? "Save changes" : "Add device"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
