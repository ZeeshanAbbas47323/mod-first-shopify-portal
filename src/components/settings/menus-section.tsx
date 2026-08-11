"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { ArrowDown, ArrowUp, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/data-table";
import { StatusBadge, StatusToggle } from "@/components/status-badge";
import { apiErrorMessage } from "@/lib/auth-api";
import {
  createMenu,
  deleteRecord,
  listMenus,
  updateMenu,
  updateRecordStatus,
  updateSortOrder,
  MENU_LINK_TYPES,
  type MenuRow,
} from "@/lib/admin-api";

const PAGE_SIZE = 10;

const STATUS_ITEMS = { all: "All statuses", active: "Active", inactive: "Inactive" };
const MENU_TYPE_ITEMS: Record<string, string> = { dashboard: "Dashboard", frontend: "Frontend" };
const LINK_TYPE_ITEMS: Record<string, string> = Object.fromEntries([
  ["all", "All link types"],
  ...MENU_LINK_TYPES.map((t) => [t, t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())]),
]);

const humanize = (v?: string) =>
  v ? v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "—";

function getColumns(
  onToggleStatus: (row: MenuRow, next: boolean) => Promise<void>,
  onMove: (row: MenuRow, direction: "up" | "down") => Promise<void>
): ColumnDef<MenuRow>[] {
  return [
  {
    accessorKey: "name",
    header: "Menu",
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="truncate font-medium">{row.original.name}</p>
        <p className="truncate font-mono text-xs text-muted-foreground">
          /{row.original.slug}
        </p>
      </div>
    ),
  },
  {
    accessorKey: "menu_type",
    header: "Type",
    cell: ({ row }) => (
      <StatusBadge
        status={humanize(row.original.menu_type)}
        tone={row.original.menu_type === "dashboard" ? "info" : "neutral"}
      />
    ),
  },
  {
    accessorKey: "link_type",
    header: "Link type",
    cell: ({ row }) => humanize(row.original.link_type),
  },
  {
    accessorKey: "sort_order",
    header: () => <div className="text-right">Order</div>,
    cell: ({ row }) => (
      <div className="flex items-center justify-end gap-1">
        <span className="text-sm text-muted-foreground">{row.original.sort_order ?? "—"}</span>
        <button
          type="button"
          className="rounded p-1 hover:bg-muted disabled:opacity-30"
          onClick={(e) => { e.stopPropagation(); onMove(row.original, "up"); }}
        >
          <ArrowUp className="size-3.5" />
        </button>
        <button
          type="button"
          className="rounded p-1 hover:bg-muted disabled:opacity-30"
          onClick={(e) => { e.stopPropagation(); onMove(row.original, "down"); }}
        >
          <ArrowDown className="size-3.5" />
        </button>
      </div>
    ),
  },
  {
    id: "visibility",
    header: "Visibility",
    cell: ({ row }) =>
      row.original.visibility === false ? (
        <StatusBadge status="Hidden" tone="neutral" />
      ) : (
        <StatusBadge status="Visible" tone="success" />
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

export function MenusSection() {
  const [rows, setRows] = React.useState<MenuRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(0);
  const [pageCount, setPageCount] = React.useState(1);
  const [total, setTotal] = React.useState(0);

  const [search, setSearch] = React.useState("");
  const [menuType, setMenuType] = React.useState("dashboard");
  const [linkType, setLinkType] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<MenuRow | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);

  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  React.useEffect(() => {
    setPage(0);
  }, [debouncedSearch, menuType, linkType, status]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listMenus({
      page: page + 1,
      limit: PAGE_SIZE,
      filters: {
        menu_type: menuType,
        name: debouncedSearch || undefined,
        link_type: linkType === "all" ? undefined : linkType,
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
        toast.error(apiErrorMessage(error, "Couldn't load menus."));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, debouncedSearch, menuType, linkType, status, refreshKey]);

  const handleToggleStatus = async (row: MenuRow, next: boolean) => {
    try {
      await updateRecordStatus("menu", row.id, next);
      toast.success(next ? "Menu activated." : "Menu deactivated.");
      setRefreshKey((k) => k + 1);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't update status."));
    }
  };

  const handleMove = async (row: MenuRow, direction: "up" | "down") => {
    const index = rows.findIndex((r) => r.id === row.id);
    const adjacentIndex = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || adjacentIndex < 0 || adjacentIndex >= rows.length) return;
    const adjacent = rows[adjacentIndex];
    const rowOrder = row.sort_order ?? index;
    const adjacentOrder = adjacent.sort_order ?? adjacentIndex;
    try {
      await updateSortOrder("menu", [
        { id: row.id, sort_order: adjacentOrder },
        { id: adjacent.id, sort_order: rowOrder },
      ]);
      setRefreshKey((k) => k + 1);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't reorder menus."));
    }
  };

  const columns = React.useMemo(() => getColumns(handleToggleStatus, handleMove), [rows]);

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
        <Select items={MENU_TYPE_ITEMS} value={menuType} onValueChange={(v) => setMenuType(v as string)}>
          <SelectTrigger className="min-w-32 bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dashboard">Dashboard</SelectItem>
            <SelectItem value="frontend">Frontend</SelectItem>
          </SelectContent>
        </Select>
        <Select items={LINK_TYPE_ITEMS} value={linkType} onValueChange={(v) => setLinkType(v as string)}>
          <SelectTrigger className="min-w-36 bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All link types</SelectItem>
            {MENU_LINK_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {humanize(t)}
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
        <Button
          className="ml-auto"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="size-4" />
          Add menu
        </Button>
      </div>

      <MenuDialog
        editing={editing}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />

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
    </div>
  );
}

const STATUS_FORM_ITEMS: Record<string, string> = { active: "Active", inactive: "Inactive" };
const MENU_TYPE_FORM_ITEMS: Record<string, string> = { dashboard: "Dashboard", frontend: "Frontend" };
const LINK_TYPE_FORM_ITEMS: Record<string, string> = Object.fromEntries(
  MENU_LINK_TYPES.map((t) => [t, t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())])
);

const menuSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9]+(?:[/-][a-z0-9]+)*$/, "Lowercase letters, numbers, / and -"),
  menu_type: z.enum(["frontend", "dashboard"]),
  link_type: z.string().min(1, "Link type is required"),
  sort_order: z.number({ error: "Must be a number" }).int().min(0).optional(),
  icon: z.string().optional(),
  external_url: z.string().optional(),
  open_in_new_tab: z.boolean().optional(),
  visibility: z.enum(["visible", "hidden"]),
  status: z.enum(["active", "inactive"]),
});
type MenuValues = z.infer<typeof menuSchema>;

function MenuDialog({
  editing,
  open,
  onOpenChange,
  onSaved,
}: {
  editing: MenuRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<MenuValues>({
    resolver: zodResolver(menuSchema),
    defaultValues: {
      name: "",
      slug: "",
      menu_type: "dashboard",
      link_type: "custom",
      sort_order: undefined,
      icon: "",
      external_url: "",
      open_in_new_tab: false,
      visibility: "visible",
      status: "active",
    },
  });

  const watchedName = useWatch({
    control,
    name: "name",
  });
  const slugDirty = React.useRef(false);

  React.useEffect(() => {
    if (open) {
      slugDirty.current = !!editing;
      reset({
        name: editing?.name ?? "",
        slug: editing?.slug ?? "",
        menu_type: editing?.menu_type ?? "dashboard",
        link_type: editing?.link_type ?? "custom",
        sort_order: editing?.sort_order,
        icon: editing?.icon ?? "",
        external_url: editing?.external_url ?? "",
        open_in_new_tab: editing?.open_in_new_tab ?? false,
        visibility: editing?.visibility === false ? "hidden" : "visible",
        status: editing?.is_active === false ? "inactive" : "active",
      });
    }
  }, [open, editing, reset]);

  // Auto-slug from name while creating
  React.useEffect(() => {
    if (!editing && !slugDirty.current) {
      setValue(
        "slug",
        watchedName
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9/\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "")
      );
    }
  }, [watchedName, editing, setValue]);

  const linkType = watch("link_type");
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const handleDelete = async () => {
    if (!editing) return;
    setDeleting(true);
    try {
      const message = await deleteRecord("menu", editing.id);
      toast.success(message);
      setConfirmOpen(false);
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't delete the menu."));
    } finally {
      setDeleting(false);
    }
  };

  const onSubmit = async (values: MenuValues) => {
    const body = {
      name: values.name,
      slug: values.slug,
      menu_type: values.menu_type,
      link_type: values.link_type,
      sort_order: values.sort_order ?? undefined,
      icon: values.icon || undefined,
      external_url: values.link_type === "external_url" ? values.external_url : undefined,
      open_in_new_tab: values.open_in_new_tab,
      visibility: values.visibility === "visible",
      is_active: values.status === "active",
    };
    try {
      const message = editing
        ? await updateMenu(editing.id, body)
        : await createMenu(body);
      toast.success(message);
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(
        apiErrorMessage(error, `Couldn't ${editing ? "update" : "create"} the menu.`)
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit menu" : "Add menu"}</DialogTitle>
          <DialogDescription>
            {editing ? `Update "${editing.name}".` : "Create a new navigation menu item."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="menu-name">Name</Label>
              <Input
                id="menu-name"
                placeholder="Users Management"
                aria-invalid={!!errors.name}
                {...register("name")}
                onChange={(e) => {
                  slugDirty.current = false;
                  register("name").onChange(e);
                }}
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="menu-slug">Slug</Label>
              <Input
                id="menu-slug"
                placeholder="users"
                className="font-mono"
                aria-invalid={!!errors.slug}
                {...register("slug", {
                  onChange: () => {
                    slugDirty.current = true;
                  },
                })}
              />
              {errors.slug && <p className="text-sm text-destructive">{errors.slug.message}</p>}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Menu type</Label>
              <Controller
                control={control}
                name="menu_type"
                render={({ field }) => (
                  <Select items={MENU_TYPE_FORM_ITEMS} value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dashboard">Dashboard</SelectItem>
                      <SelectItem value="frontend">Frontend</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Link type</Label>
              <Controller
                control={control}
                name="link_type"
                render={({ field }) => (
                  <Select items={LINK_TYPE_FORM_ITEMS} value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MENU_LINK_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          {linkType === "external_url" && (
            <div className="space-y-1.5">
              <Label htmlFor="menu-url">External URL</Label>
              <Input id="menu-url" placeholder="https://example.com" {...register("external_url")} />
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="menu-icon">Icon class</Label>
              <Input id="menu-icon" placeholder="fa-shopping-bag" {...register("icon")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="menu-order">Sort order</Label>
              <Input id="menu-order" type="number" min={0} placeholder="1" {...register("sort_order", { valueAsNumber: true })} />
              {errors.sort_order && <p className="text-sm text-destructive">{errors.sort_order.message}</p>}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Visibility</Label>
              <Controller
                control={control}
                name="visibility"
                render={({ field }) => (
                  <Select
                    items={{ visible: "Visible", hidden: "Hidden" }}
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="visible">Visible</SelectItem>
                      <SelectItem value="hidden">Hidden</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
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
            <div className="flex flex-col justify-end space-y-1.5">
              <Label className="invisible">Open in new tab</Label>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-input bg-card px-3 py-2 text-sm">
                <input type="checkbox" className="accent-primary" {...register("open_in_new_tab")} />
                New tab
              </label>
            </div>
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
              {editing ? "Save changes" : "Save menu"}
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
