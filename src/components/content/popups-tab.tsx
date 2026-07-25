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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { apiErrorMessage } from "@/lib/auth-api";
import {
  listPopups, createPopup, updatePopup, deletePopup,
  type PopupRow,
} from "@/lib/admin-api";

const PAGE_SIZE = 10;

const POSITIONS = ["center", "bottom-left", "bottom-right"] as const;

const columns: ColumnDef<PopupRow>[] = [
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row }) => <span className="font-medium">{row.original.title}</span>,
  },
  {
    accessorKey: "position",
    header: "Position",
    cell: ({ row }) => (
      <span className="capitalize text-sm">{row.original.position?.replace(/-/g, " ") ?? "—"}</span>
    ),
  },
  {
    id: "schedule",
    header: "Schedule",
    cell: ({ row }) => {
      const { start_date, end_date } = row.original;
      if (!start_date && !end_date) return <span className="text-muted-foreground text-sm">Always</span>;
      const fmt = (d: string) => format(new Date(d), "MMM d, yyyy");
      return (
        <span className="text-sm">
          {start_date ? fmt(start_date) : "∞"} → {end_date ? fmt(end_date) : "∞"}
        </span>
      );
    },
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

export function PopupsTab() {
  const [rows, setRows] = React.useState<PopupRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(0);
  const [pageCount, setPageCount] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<PopupRow | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  React.useEffect(() => { setPage(0); }, [debounced]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listPopups({ page: page + 1, limit: PAGE_SIZE, filters: { title: debounced || undefined } })
      .then((res) => {
        if (cancelled) return;
        setRows(res.rows); setTotal(res.total); setPageCount(res.totalPages);
      })
      .catch((err) => { if (!cancelled) toast.error(apiErrorMessage(err, "Couldn't load popups.")); })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [page, debounced, refreshKey]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-44 flex-1 sm:max-w-56">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search popups" className="bg-card pl-8" />
        </div>
        <Button className="ml-auto" onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="size-4" /> Add popup
        </Button>
      </div>

      <PopupDialog
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

const popupSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  button_text: z.string().optional(),
  button_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  position: z.enum(POSITIONS),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  status: z.enum(["active", "inactive"]),
});
type PopupValues = z.infer<typeof popupSchema>;

function PopupDialog({
  editing, open, onOpenChange, onSaved,
}: {
  editing: PopupRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } =
    useForm<PopupValues>({
      resolver: zodResolver(popupSchema),
      defaultValues: {
        title: "", description: "", button_text: "", button_url: "",
        position: "center", start_date: "", end_date: "", status: "active",
      },
    });

  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => {
    if (open) reset({
      title: editing?.title ?? "",
      description: editing?.description ?? "",
      button_text: editing?.button_text ?? "",
      button_url: editing?.button_url ?? "",
      position: (editing?.position as typeof POSITIONS[number]) ?? "center",
      start_date: editing?.start_date?.slice(0, 10) ?? "",
      end_date: editing?.end_date?.slice(0, 10) ?? "",
      status: editing?.is_active === false ? "inactive" : "active",
    });
  }, [open, editing, reset]);

  const onSubmit = async (values: PopupValues) => {
    const body: Partial<PopupRow> = {
      title: values.title,
      description: values.description || undefined,
      button_text: values.button_text || undefined,
      button_url: values.button_url || undefined,
      position: values.position,
      start_date: values.start_date || undefined,
      end_date: values.end_date || undefined,
      is_active: values.status === "active",
    };
    try {
      const msg = editing ? await updatePopup(editing.id, body) : await createPopup(body);
      toast.success(msg);
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(apiErrorMessage(err, `Couldn't ${editing ? "update" : "create"} popup.`));
    }
  };

  const handleDelete = async () => {
    if (!editing || !confirm(`Delete "${editing.title}"?`)) return;
    setDeleting(true);
    try {
      const msg = await deletePopup(editing.id);
      toast.success(msg);
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't delete popup."));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit popup" : "Add popup"}</DialogTitle>
          <DialogDescription>
            {editing ? `Update "${editing.title}"` : "Create a new storefront popup."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="popup-title">Title *</Label>
            <Input id="popup-title" placeholder="Summer Sale!" aria-invalid={!!errors.title} {...register("title")} />
            {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="popup-desc">Description</Label>
            <Textarea id="popup-desc" rows={3} placeholder="Popup body text…" {...register("description")} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="popup-btn-text">Button text</Label>
              <Input id="popup-btn-text" placeholder="Shop now" {...register("button_text")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="popup-btn-url">Button URL</Label>
              <Input id="popup-btn-url" placeholder="https://…" aria-invalid={!!errors.button_url} {...register("button_url")} />
              {errors.button_url && <p className="text-sm text-destructive">{errors.button_url.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Position</Label>
              <Controller control={control} name="position" render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="center">Center</SelectItem>
                    <SelectItem value="bottom-left">Bottom left</SelectItem>
                    <SelectItem value="bottom-right">Bottom right</SelectItem>
                  </SelectContent>
                </Select>
              )} />
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
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="popup-start">Start date</Label>
              <Input id="popup-start" type="date" {...register("start_date")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="popup-end">End date</Label>
              <Input id="popup-end" type="date" {...register("end_date")} />
            </div>
          </div>

          <DialogFooter className="gap-2">
            {editing && (
              <Button type="button" variant="outline" disabled={deleting}
                className="text-destructive border-destructive/40 hover:bg-destructive/10 mr-auto"
                onClick={handleDelete}>
                {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                Delete
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {editing ? "Save changes" : "Add popup"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
