"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Loader2, Plus, Search, Trash2 } from "lucide-react";
import { useForm, Controller, useWatch } from "react-hook-form";
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
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { apiErrorMessage } from "@/lib/auth-api";
import { createColor, deleteRecord, listColors, updateColor, type ColorRow } from "@/lib/admin-api";

const PAGE_SIZE = 10;

const STATUS_ITEMS = { all: "All statuses", active: "Active", inactive: "Inactive" };


const columns: ColumnDef<ColorRow>[] = [
  {
    accessorKey: "name",
    header: "Color",
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <span
          className="size-6 shrink-0 rounded-md ring-1 ring-black/15"
          style={{ backgroundColor: row.original.hex_code }}
        />
        <span className="font-medium">{row.original.name}</span>
      </div>
    ),
  },
  {
    accessorKey: "hex_code",
    header: "Hex code",
    cell: ({ row }) => (
      <span className="font-mono text-xs uppercase">
        {row.original.hex_code}
      </span>
    ),
  },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) =>
      row.original.is_active === false ? (
        <StatusBadge status="Inactive" tone="neutral" />
      ) : (
        <StatusBadge status="Active" tone="success" />
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

export function ColorsSection() {
  const [rows, setRows] = React.useState<ColorRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(0);
  const [pageCount, setPageCount] = React.useState(1);
  const [total, setTotal] = React.useState(0);

  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ColorRow | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);

  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  React.useEffect(() => {
    setPage(0);
  }, [debouncedSearch, status]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listColors({
      page: page + 1,
      limit: PAGE_SIZE,
      filters: {
        name: debouncedSearch || undefined,
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
        toast.error(apiErrorMessage(error, "Couldn't load colors."));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, debouncedSearch, status, refreshKey]);

  return (
    <div className="flex flex-col gap-3">
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
        <Button className="ml-auto" onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="size-4" />
          Add color
        </Button>
      </div>

      <ColorDialog
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
        serverPagination={{
          pageIndex: page,
          pageCount,
          total,
          onPageChange: setPage,
        }}
      />
    </div>
  );
}

const STATUS_FORM_ITEMS = { active: "Active", inactive: "Inactive" };

const colorSchema = z.object({
  name: z.string().min(1, "Name is required"),
  hex_code: z
    .string()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Enter a valid hex color like #4169E1"),
  status: z.enum(["active", "inactive"]),
});
type ColorValues = z.infer<typeof colorSchema>;

function ColorDialog({
  editing,
  open,
  onOpenChange,
  onCreated,
}: {
  editing: ColorRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ColorValues>({
    resolver: zodResolver(colorSchema),
    defaultValues: { name: "", hex_code: "#4169E1", status: "active" },
  });
  const hex = useWatch({
    control,
    name: "hex_code",
  });
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      reset({
        name: editing?.name ?? "",
        hex_code: editing?.hex_code ?? "#4169E1",
        status: editing?.is_active === false ? "inactive" : "active",
      });
    }
  }, [open, editing, reset]);

  const onSubmit = async (values: ColorValues) => {
    const body = {
      name: values.name,
      hex_code: values.hex_code,
      is_active: values.status === "active",
    };
    try {
      const message = editing
        ? await updateColor(editing.id, body)
        : await createColor(body);
      toast.success(message);
      onOpenChange(false);
      onCreated();
    } catch (error) {
      toast.error(
        apiErrorMessage(error, `Couldn't ${editing ? "update" : "create"} the color.`)
      );
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    setDeleting(true);
    try {
      const message = await deleteRecord("color", editing.id);
      toast.success(message);
      setConfirmOpen(false);
      onOpenChange(false);
      onCreated();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't delete the color."));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit color" : "Add color"}</DialogTitle>
          <DialogDescription>
            {editing ? `Update "${editing.name}"` : "Create a new product color."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="color-name">Name</Label>
            <Input id="color-name" placeholder="Royal Blue" aria-invalid={!!errors.name} {...register("name")} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="color-hex">Hex code</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label="Pick color"
                value={/^#([0-9a-fA-F]{6})$/.test(hex) ? hex : "#4169E1"}
                onChange={(e) => setValue("hex_code", e.target.value, { shouldValidate: true })}
                className="size-9 shrink-0 cursor-pointer rounded-lg border border-input bg-card p-1"
              />
              <Input id="color-hex" placeholder="#4169E1" className="font-mono uppercase" aria-invalid={!!errors.hex_code} {...register("hex_code")} />
            </div>
            {errors.hex_code && <p className="text-sm text-destructive">{errors.hex_code.message}</p>}
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
              {editing ? "Save changes" : "Save color"}
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
