"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Loader2, MapPin, Plus, Search, Trash2 } from "lucide-react";
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
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { apiErrorMessage } from "@/lib/auth-api";
import {
  listPickupLocations, createPickupLocation, updatePickupLocation, deletePickupLocation,
  type PickupLocationRow,
} from "@/lib/admin-api";

const PAGE_SIZE = 10;

const columns: ColumnDef<PickupLocationRow>[] = [
  {
    accessorKey: "name",
    header: "Location",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="font-medium">{row.original.name}</span>
      </div>
    ),
  },
  {
    id: "address",
    header: "Address",
    cell: ({ row }) => {
      const { address, city, state, country } = row.original;
      const parts = [address, city, state, country].filter(Boolean).join(", ");
      return <span className="text-sm text-muted-foreground">{parts || "—"}</span>;
    },
  },
  {
    accessorKey: "phone",
    header: "Phone",
    cell: ({ row }) => row.original.phone ?? "—",
  },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) =>
      row.original.is_active === false
        ? <StatusBadge status="Inactive" tone="neutral" />
        : <StatusBadge status="Active" tone="success" />,
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
];

export function PickupLocationsSection() {
  const [rows, setRows] = React.useState<PickupLocationRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(0);
  const [pageCount, setPageCount] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<PickupLocationRow | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  React.useEffect(() => { setPage(0); }, [debounced]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listPickupLocations({ page: page + 1, limit: PAGE_SIZE, filters: { name: debounced || undefined } })
      .then((res) => {
        if (cancelled) return;
        setRows(res.rows); setTotal(res.total); setPageCount(res.totalPages);
      })
      .catch((err) => { if (!cancelled) toast.error(apiErrorMessage(err, "Couldn't load pickup locations.")); })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [page, debounced, refreshKey]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-44 flex-1 sm:max-w-56">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search locations" className="bg-card pl-8" />
        </div>
        <Button className="ml-auto" onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="size-4" /> Add location
        </Button>
      </div>

      <PickupLocationDialog
        editing={editing} open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />

      <DataTable
        columns={columns} data={rows} loading={loading}
        onRowClick={(row) => { setEditing(row); setDialogOpen(true); }}
        serverPagination={{ pageIndex: page, pageCount, total, onPageChange: setPage }}
      />
    </div>
  );
}

const locationSchema = z.object({
  name: z.string().min(1, "Name is required"),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  postal_code: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Must be a valid email").optional().or(z.literal("")),
  status: z.enum(["active", "inactive"]),
});
type LocationValues = z.infer<typeof locationSchema>;

function PickupLocationDialog({
  editing, open, onOpenChange, onSaved,
}: {
  editing: PickupLocationRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } =
    useForm<LocationValues>({
      resolver: zodResolver(locationSchema),
      defaultValues: {
        name: "", address: "", city: "", state: "", country: "",
        postal_code: "", phone: "", email: "", status: "active",
      },
    });

  const [deleting, setDeleting] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  React.useEffect(() => {
    if (open) reset({
      name: editing?.name ?? "",
      address: (editing?.address as string) ?? "",
      city: (editing?.city as string) ?? "",
      state: (editing?.state as string) ?? "",
      country: (editing?.country as string) ?? "",
      postal_code: (editing?.postal_code as string) ?? "",
      phone: (editing?.phone as string) ?? "",
      email: (editing?.email as string) ?? "",
      status: editing?.is_active === false ? "inactive" : "active",
    });
  }, [open, editing, reset]);

  const onSubmit = async (values: LocationValues) => {
    const body: Partial<PickupLocationRow> = {
      name: values.name,
      address: values.address || undefined,
      city: values.city || undefined,
      state: values.state || undefined,
      country: values.country || undefined,
      postal_code: values.postal_code || undefined,
      phone: values.phone || undefined,
      email: values.email || undefined,
      is_active: values.status === "active",
    };
    try {
      const msg = editing
        ? await updatePickupLocation(editing.id, body)
        : await createPickupLocation(body);
      toast.success(msg);
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(apiErrorMessage(err, `Couldn't ${editing ? "update" : "create"} pickup location.`));
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    setDeleting(true);
    try {
      const msg = await deletePickupLocation(editing.id);
      toast.success(msg);
      setConfirmOpen(false);
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't delete pickup location."));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit location" : "Add pickup location"}</DialogTitle>
          <DialogDescription>
            {editing ? `Update "${editing.name}"` : "Add a new pickup location for customers."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="loc-name">Name *</Label>
            <Input id="loc-name" placeholder="Main Store, Warehouse A…" aria-invalid={!!errors.name} {...register("name")} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="loc-address">Address</Label>
            <Input id="loc-address" placeholder="123 Main St" {...register("address")} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="loc-city">City</Label>
              <Input id="loc-city" placeholder="Karachi" {...register("city")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="loc-state">State / Province</Label>
              <Input id="loc-state" placeholder="Sindh" {...register("state")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="loc-country">Country</Label>
              <Input id="loc-country" placeholder="Pakistan" {...register("country")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="loc-postal">Postal code</Label>
              <Input id="loc-postal" placeholder="75000" {...register("postal_code")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="loc-phone">Phone</Label>
              <Input id="loc-phone" placeholder="+92 300 0000000" {...register("phone")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="loc-email">Email</Label>
              <Input id="loc-email" type="email" placeholder="store@example.com"
                aria-invalid={!!errors.email} {...register("email")} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <Controller control={control} name="status" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            )} />
          </div>

          <DialogFooter className="gap-2">
            {editing && (
              <Button type="button" variant="destructive" disabled={deleting}
                className="mr-auto"
                onClick={() => setConfirmOpen(true)}>
                <Trash2 className="size-4" />
                Delete
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {editing ? "Save changes" : "Add location"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        loading={deleting}
        onConfirm={handleDelete}
        title={`Delete "${editing?.name}"?`}
        description="This can't be undone."
      />
    </Dialog>
  );
}
