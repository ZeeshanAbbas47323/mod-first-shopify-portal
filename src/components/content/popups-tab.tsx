"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Loader2, Plus, Search, Trash2 } from "lucide-react";
import { useForm, Controller, useWatch } from "react-hook-form";
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
import { DataTable } from "@/components/data-table";
import { StatusBadge, StatusToggle } from "@/components/status-badge";
import { apiErrorMessage } from "@/lib/auth-api";
import {
  listPopups, createPopup, updatePopup, deletePopup, updateRecordStatus,
  POPUP_TYPES, type PopupRow,
} from "@/lib/admin-api";

const PAGE_SIZE = 10;

const popupTypeLabel: Record<string, string> = {
  announcement: "Announcement",
  coupon: "Coupon",
  newsletter: "Newsletter",
};

function getColumns(
  onToggleStatus: (row: PopupRow, next: boolean) => Promise<void>
): ColumnDef<PopupRow>[] {
  return [
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row }) => <span className="font-medium">{row.original.title}</span>,
  },
  {
    accessorKey: "popup_type",
    header: "Type",
    cell: ({ row }) => {
      const t = row.original.popup_type;
      if (!t) return "—";
      return <StatusBadge status={popupTypeLabel[t] ?? t} tone="info" />;
    },
  },
  {
    accessorKey: "display_priority",
    header: () => <div className="text-right">Priority</div>,
    cell: ({ row }) => (
      <div className="text-right">{row.original.display_priority ?? "—"}</div>
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

  const handleToggleStatus = async (row: PopupRow, next: boolean) => {
    try {
      await updateRecordStatus("popup", row.id, next);
      toast.success(next ? "Popup activated." : "Popup deactivated.");
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
  message: z.string().min(1, "Message is required"),
  button_text: z.string().optional(),
  link_url: z.string().optional(),
  popup_type: z.enum(POPUP_TYPES),
  coupon_code: z.string().optional(),
  display_priority: z.number().int().optional(),
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
        title: "", message: "", button_text: "", link_url: "",
        popup_type: "announcement", coupon_code: "", display_priority: undefined,
        start_date: "", end_date: "", status: "active",
      },
    });

  const [deleting, setDeleting] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const popupType = useWatch({ control, name: "popup_type" });

  React.useEffect(() => {
    if (open) reset({
      title: editing?.title ?? "",
      message: editing?.message ?? "",
      button_text: editing?.button_text ?? "",
      link_url: editing?.link_url ?? "",
      popup_type: (editing?.popup_type as typeof POPUP_TYPES[number]) ?? "announcement",
      coupon_code: editing?.coupon_code ?? "",
      display_priority: editing?.display_priority,
      start_date: editing?.start_date?.slice(0, 10) ?? "",
      end_date: editing?.end_date?.slice(0, 10) ?? "",
      status: editing?.is_active === false ? "inactive" : "active",
    });
  }, [open, editing, reset]);

  const onSubmit = async (values: PopupValues) => {
    const body: Partial<PopupRow> = {
      title: values.title,
      message: values.message,
      button_text: values.button_text || undefined,
      link_url: values.link_url || undefined,
      popup_type: values.popup_type,
      coupon_code: values.popup_type === "coupon" ? (values.coupon_code || undefined) : undefined,
      display_priority: values.display_priority,
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
    if (!editing) return;
    setDeleting(true);
    try {
      const msg = await deletePopup(editing.id);
      toast.success(msg);
      setConfirmOpen(false);
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
            <Label htmlFor="popup-message">Message *</Label>
            <Textarea id="popup-message" rows={3} placeholder="Popup body text…"
              aria-invalid={!!errors.message} {...register("message")} />
            {errors.message && <p className="text-sm text-destructive">{errors.message.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="popup-btn-text">Button text</Label>
              <Input id="popup-btn-text" placeholder="Shop now" {...register("button_text")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="popup-link-url">Link URL</Label>
              <Input id="popup-link-url" placeholder="/shop/summer-sale" {...register("link_url")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Popup type</Label>
              <Controller control={control} name="popup_type" render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="announcement">Announcement</SelectItem>
                    <SelectItem value="coupon">Coupon</SelectItem>
                    <SelectItem value="newsletter">Newsletter</SelectItem>
                  </SelectContent>
                </Select>
              )} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="popup-priority">Display priority</Label>
              <Input id="popup-priority" type="number" placeholder="Higher = show first"
                {...register("display_priority", { valueAsNumber: true })} />
            </div>
          </div>

          {popupType === "coupon" && (
            <div className="space-y-1.5">
              <Label htmlFor="popup-coupon-code">Coupon code</Label>
              <Input id="popup-coupon-code" placeholder="SUMMER35" className="font-mono uppercase" {...register("coupon_code")} />
            </div>
          )}

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
              {editing ? "Save changes" : "Add popup"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        loading={deleting}
        onConfirm={handleDelete}
        title={`Delete "${editing?.title}"?`}
        description="This can't be undone."
      />
    </Dialog>
  );
}
