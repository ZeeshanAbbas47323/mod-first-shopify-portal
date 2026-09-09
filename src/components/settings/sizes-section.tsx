"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Loader2, Plus, Search, Trash2 } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";

import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable, type ColumnFilterDef } from "@/components/data-table";
import { StatusToggle } from "@/components/status-badge";
import { apiErrorMessage } from "@/lib/auth-api";
import { exportRows as writeExport, type ExportFormat } from "@/lib/export";
import { ExportFormatMenu } from "@/components/export-menu";
import { createSize, deleteRecord, listSizes, updateRecordStatus, updateSize, type SizeRow } from "@/lib/admin-api";

const DEFAULT_PAGE_SIZE = 10;
const EXPORT_CAP = 5000;

const STATUS_ITEMS = { all: "All statuses", active: "Active", inactive: "Inactive" };


function getColumns(
  onToggleStatus: (row: SizeRow, next: boolean) => Promise<void>
): ColumnDef<SizeRow>[] {
  return [
  {
    accessorKey: "name",
    header: "Size",
    cell: ({ row }) => (
      <span className="inline-flex min-w-9 items-center justify-center rounded-lg border bg-muted px-2 py-0.5 text-xs font-semibold">
        {row.original.name}
      </span>
    ),
  },
  {
    accessorKey: "display_name",
    header: "Display name",
    cell: ({ row }) => (
      <span className="font-medium">{row.original.display_name}</span>
    ),
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
  display_name: { type: "text", placeholder: "Search names" },
  status: { type: "select", options: [{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }], placeholder: "Any" },
};

export function SizesSection() {
  const [rows, setRows] = React.useState<SizeRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(0);
  const [pageSize, setPageSize] = React.useState<number>(DEFAULT_PAGE_SIZE);
  const [pageCount, setPageCount] = React.useState(1);
  const [total, setTotal] = React.useState(0);

  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SizeRow | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [exportBusy, setExportBusy] = React.useState(false);

  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  React.useEffect(() => {
    setPage(0);
  }, [debouncedSearch, status]);

  const buildFilters = React.useCallback(
    () => ({
      display_name: debouncedSearch ? { contains: debouncedSearch } : undefined,
      is_active: status === "all" ? undefined : status === "active",
    }),
    [debouncedSearch, status]
  );

  const columnFilterValues = React.useMemo(() => {
    const values: Record<string, string[]> = {};
    if (search) values.display_name = [search];
    if (status !== "all") values.status = [status];
    return values;
  }, [search, status]);

  const applyColumnFilters = React.useCallback(
    (next: Record<string, string[]>) => {
      setSearch(next.display_name?.[0] ?? "");
      const picked = next.status ?? [];
      setStatus(picked.length === 1 ? picked[0] : "all");
    },
    []
  );

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listSizes({
      page: page + 1,
      limit: pageSize,
      filters: buildFilters(),
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
        toast.error(apiErrorMessage(error, "Couldn't load sizes."));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, buildFilters, refreshKey]);

  const runExport = async (fileFormat: ExportFormat) => {
    setExportBusy(true);
    try {
      const exportRows = fetchAllPages((page, limit) => listSizes({ page, limit, filters: buildFilters() }), EXPORT_CAP);
      if (!exportRows.length) {
        toast.error("Nothing to export.");
        return;
      }
      await writeExport(fileFormat, "sizes", [
        { key: "name", label: "Size", value: (r: SizeRow) => r.name ?? "" },
        { key: "display_name", label: "Display name", value: (r: SizeRow) => r.display_name ?? "" },
        { key: "is_active", label: "Active", value: (r: SizeRow) => (r.is_active === false ? "No" : "Yes") },
      ], exportRows);
      toast.success(`Exported ${exportRows.length} size${exportRows.length === 1 ? "" : "s"}.`);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't export sizes."));
    } finally {
      setExportBusy(false);
    }
  };

  const handleToggleStatus = async (row: SizeRow, next: boolean) => {
    try {
      await updateRecordStatus("size", row.id, next);
      toast.success(next ? "Size activated." : "Size deactivated.");
      setRefreshKey((k) => k + 1);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't update status."));
    }
  };
  const columns = React.useMemo(() => getColumns(handleToggleStatus), []);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-44 flex-1 sm:max-w-56">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by display name"
            className="bg-card pl-8"
          />
        </div>
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
        <ExportFormatMenu onSelect={runExport} busy={exportBusy} />
        <Button className="ml-auto" onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="size-4" />
          Add size
        </Button>
      </div>

      <SizeDialog
        editing={editing}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={() => setRefreshKey((k) => k + 1)}
      />

      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
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

const STATUS_FORM_ITEMS = { active: "Active", inactive: "Inactive" };

const sizeSchema = z.object({
  name: z.string().min(1, "Name is required").max(20, "Keep it short"),
  display_name: z.string().min(1, "Display name is required"),
  status: z.enum(["active", "inactive"]),
});
type SizeValues = z.infer<typeof sizeSchema>;

function SizeDialog({
  editing,
  open,
  onOpenChange,
  onCreated,
}: {
  editing: SizeRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SizeValues>({
    resolver: zodResolver(sizeSchema),
    defaultValues: { name: "", display_name: "", status: "active" },
  });
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      reset({
        name: editing?.name ?? "",
        display_name: editing?.display_name ?? "",
        status: editing?.is_active === false ? "inactive" : "active",
      });
    }
  }, [open, editing, reset]);

  const onSubmit = async (values: SizeValues) => {
    const body = {
      name: values.name,
      display_name: values.display_name,
      is_active: values.status === "active",
    };
    try {
      const message = editing
        ? await updateSize(editing.id, body)
        : await createSize(body);
      toast.success(message);
      onOpenChange(false);
      onCreated();
    } catch (error) {
      toast.error(
        apiErrorMessage(error, `Couldn't ${editing ? "update" : "create"} the size.`)
      );
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    setDeleting(true);
    try {
      const message = await deleteRecord("size", editing.id);
      toast.success(message);
      setConfirmOpen(false);
      onOpenChange(false);
      onCreated();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't delete the size."));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit size" : "Add size"}</DialogTitle>
          <DialogDescription>
            {editing ? `Update "${editing.display_name}"` : "Create a new product size."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="size-name">Name</Label>
            <Input id="size-name" placeholder="XL" aria-invalid={!!errors.name} {...register("name")} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="size-display">Display name</Label>
            <Input id="size-display" placeholder="Extra Large" aria-invalid={!!errors.display_name} {...register("display_name")} />
            {errors.display_name && <p className="text-sm text-destructive">{errors.display_name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select items={STATUS_FORM_ITEMS} value={field.value} onValueChange={field.onChange}>
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
          <DialogFooter className="gap-2">
            {editing && (
              <Button
                type="button"
                variant="destructive"
                className="mr-auto"
                onClick={() => setConfirmOpen(true)}
              >
                <Trash2 className="size-4" />
                Delete
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {editing ? "Save changes" : "Save size"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        loading={deleting}
        onConfirm={handleDelete}
        title={`Delete "${editing?.display_name}"?`}
        description="This can't be undone."
      />
    </Dialog>
  );
}
