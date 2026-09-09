"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Loader2, Plus, Search, Trash2 } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DataTable, type ColumnFilterDef } from "@/components/data-table";
import { StatusToggle } from "@/components/status-badge";
import { apiErrorMessage } from "@/lib/auth-api";
import { exportRows as writeExport, type ExportFormat, fetchAllPages } from "@/lib/export";
import { ExportFormatMenu } from "@/components/export-menu";
import {
  listCouriers, createCourier, updateCourier, deleteCourier, updateRecordStatus,
  type CourierRow,
} from "@/lib/admin-api";

const DEFAULT_PAGE_SIZE = 10;
const EXPORT_CAP = 5000;

function getColumns(
  onToggleStatus: (row: CourierRow, next: boolean) => Promise<void>
): ColumnDef<CourierRow>[] {
  return [
  {
    accessorKey: "name",
    header: "Courier",
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="truncate font-medium">{row.original.name}</p>
        <p className="truncate font-mono text-xs text-muted-foreground">{row.original.code}</p>
      </div>
    ),
  },
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) => row.original.email ?? "—",
  },
  {
    accessorKey: "contact_number",
    header: "Phone",
    cell: ({ row }) => row.original.contact_number ?? "—",
  },
  {
    accessorKey: "tracking_url",
    header: "Tracking URL",
    cell: ({ row }) => {
      const url = row.original.tracking_url;
      if (!url) return <span className="text-muted-foreground">—</span>;
      return (
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="truncate text-sm text-[#005bd3] hover:underline max-w-[200px] block"
          onClick={(e) => e.stopPropagation()}>
          {url}
        </a>
      );
    },
  },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => (
      <StatusToggle
        isActive={row.original.is_active !== false}
        onToggle={(next) => onToggleStatus(row.original, next)}
      />
    ),
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
}

const COLUMN_FILTERS: Record<string, ColumnFilterDef> = {
  name: { type: "text", placeholder: "Search couriers" },
};

export function CouriersSection() {
  const [rows, setRows] = React.useState<CourierRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(0);
  const [pageSize, setPageSize] = React.useState<number>(DEFAULT_PAGE_SIZE);
  const [pageCount, setPageCount] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<CourierRow | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [exportBusy, setExportBusy] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  React.useEffect(() => { setPage(0); }, [debounced]);

  const buildFilters = React.useCallback(
    () => ({ name: debounced ? { contains: debounced } : undefined }),
    [debounced]
  );

  const columnFilterValues = React.useMemo(() => {
    const values: Record<string, string[]> = {};
    if (search) values.name = [search];
    return values;
  }, [search]);

  const applyColumnFilters = React.useCallback(
    (next: Record<string, string[]>) => {
      setSearch(next.name?.[0] ?? "");
    },
    []
  );

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listCouriers({ page: page + 1, limit: pageSize, filters: buildFilters() })
      .then((res) => {
        if (cancelled) return;
        setRows(res.rows); setTotal(res.total); setPageCount(res.totalPages);
      })
      .catch((err) => { if (!cancelled) toast.error(apiErrorMessage(err, "Couldn't load couriers.")); })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [page, pageSize, buildFilters, refreshKey]);

  const runExport = async (fileFormat: ExportFormat) => {
    setExportBusy(true);
    try {
      const exportRows = await fetchAllPages((page, limit) => listCouriers({ page, limit, filters: buildFilters() }), EXPORT_CAP);
      if (!exportRows.length) {
        toast.error("Nothing to export.");
        return;
      }
      await writeExport(fileFormat, "couriers", [
        { key: "name", label: "Courier", value: (r: CourierRow) => r.name ?? "" },
        { key: "code", label: "Code", value: (r: CourierRow) => r.code ?? "" },
        { key: "email", label: "Email", value: (r: CourierRow) => r.email ?? "" },
        { key: "contact_number", label: "Phone", value: (r: CourierRow) => r.contact_number ?? "" },
        { key: "tracking_url", label: "Tracking URL", value: (r: CourierRow) => r.tracking_url ?? "" },
        { key: "is_active", label: "Active", value: (r: CourierRow) => (r.is_active === false ? "No" : "Yes") },
      ], exportRows);
      toast.success(`Exported ${exportRows.length} courier${exportRows.length === 1 ? "" : "s"}.`);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't export couriers."));
    } finally {
      setExportBusy(false);
    }
  };

  const handleToggleStatus = async (row: CourierRow, next: boolean) => {
    try {
      await updateRecordStatus("courier", row.id, next);
      toast.success(next ? "Courier activated." : "Courier deactivated.");
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't update status."));
    }
  };
  const columns = React.useMemo(() => getColumns(handleToggleStatus), []);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-44 flex-1 sm:max-w-56">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search couriers" className="bg-card pl-8" />
        </div>
        <ExportFormatMenu onSelect={runExport} busy={exportBusy} />
        <Button className="ml-auto" onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="size-4" /> Add courier
        </Button>
      </div>

      <CourierDialog
        editing={editing} open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />

      <DataTable
        columns={columns} data={rows} loading={loading}
        onRowClick={(row) => { setEditing(row); setDialogOpen(true); }}
        columnFilterDefs={COLUMN_FILTERS}
        serverColumnFilters={{ value: columnFilterValues, onChange: applyColumnFilters }}
        serverPagination={{
          pageIndex: page,
          pageCount,
          total,
          onPageChange: setPage,
          pageSize,
          onPageSizeChange: setPageSize,
        }}
      />
    </div>
  );
}

const courierSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().min(1, "Code is required").regex(/^[A-Z0-9_]+$/, "Uppercase letters, numbers and underscores only"),
  email: z.string().email("Must be a valid email").optional().or(z.literal("")),
  contact_number: z.string().optional(),
  booking_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  tracking_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  website: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  notes: z.string().optional(),
  status: z.enum(["active", "inactive"]),
});
type CourierValues = z.infer<typeof courierSchema>;

function CourierDialog({
  editing, open, onOpenChange, onSaved,
}: {
  editing: CourierRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } =
    useForm<CourierValues>({
      resolver: zodResolver(courierSchema),
      defaultValues: {
        name: "", code: "", email: "", contact_number: "",
        booking_url: "", tracking_url: "", website: "", notes: "", status: "active",
      },
    });

  const [deleting, setDeleting] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  React.useEffect(() => {
    if (open) reset({
      name: editing?.name ?? "",
      code: editing?.code ?? "",
      email: editing?.email ?? "",
      contact_number: editing?.contact_number ?? "",
      booking_url: editing?.booking_url ?? "",
      tracking_url: editing?.tracking_url ?? "",
      website: editing?.website ?? "",
      notes: editing?.notes ?? "",
      status: editing?.is_active === false ? "inactive" : "active",
    });
  }, [open, editing, reset]);

  const onSubmit = async (values: CourierValues) => {
    const body = {
      name: values.name,
      code: values.code.toUpperCase(),
      email: values.email || undefined,
      contact_number: values.contact_number || undefined,
      booking_url: values.booking_url || undefined,
      tracking_url: values.tracking_url || undefined,
      website: values.website || undefined,
      notes: values.notes || undefined,
      is_active: values.status === "active",
    };
    try {
      const msg = editing ? await updateCourier(editing.id, body) : await createCourier(body);
      toast.success(msg);
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(apiErrorMessage(err, `Couldn't ${editing ? "update" : "create"} courier.`));
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    setDeleting(true);
    try {
      const msg = await deleteCourier(editing.id);
      toast.success(msg);
      setConfirmOpen(false);
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't delete courier."));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit courier" : "Add courier"}</DialogTitle>
          <DialogDescription>
            {editing ? `Update "${editing.name}"` : "Add a shipping courier."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="courier-name">Name *</Label>
              <Input id="courier-name" placeholder="FedEx Express" aria-invalid={!!errors.name} {...register("name")} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="courier-code">Code *</Label>
              <Input id="courier-code" placeholder="FEDEX" className="font-mono uppercase"
                aria-invalid={!!errors.code} {...register("code")} />
              {errors.code && <p className="text-sm text-destructive">{errors.code.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="courier-email">Email</Label>
              <Input id="courier-email" type="email" placeholder="support@fedex.com"
                aria-invalid={!!errors.email} {...register("email")} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="courier-phone">Contact number</Label>
              <Input id="courier-phone" placeholder="+1 (800) 463-3339" {...register("contact_number")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="courier-website">Website</Label>
            <Input id="courier-website" placeholder="https://fedex.com"
              aria-invalid={!!errors.website} {...register("website")} />
            {errors.website && <p className="text-sm text-destructive">{errors.website.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="courier-booking-url">Booking URL</Label>
            <Input id="courier-booking-url" placeholder="https://fedex.com/booking"
              aria-invalid={!!errors.booking_url} {...register("booking_url")} />
            {errors.booking_url && <p className="text-sm text-destructive">{errors.booking_url.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="courier-url">Tracking URL</Label>
            <Input id="courier-url" placeholder="https://fedex.com/track"
              aria-invalid={!!errors.tracking_url} {...register("tracking_url")} />
            {errors.tracking_url && <p className="text-sm text-destructive">{errors.tracking_url.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="courier-notes">Notes</Label>
            <Textarea id="courier-notes" rows={2} placeholder="Reliable courier for nationwide shipping"
              {...register("notes")} />
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
              {editing ? "Save changes" : "Add courier"}
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
