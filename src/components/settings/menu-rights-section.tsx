"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Check, Loader2, Minus, Plus, Trash2 } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
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
import { StatusBadge } from "@/components/status-badge";
import { Checkbox } from "@/components/ui/checkbox";
import { MultiSelectFilter } from "@/components/multi-select-filter";
import { apiErrorMessage } from "@/lib/auth-api";
import { cn } from "@/lib/utils";
import { exportRows as writeExport, type ExportFormat } from "@/lib/export";
import { ExportFormatMenu } from "@/components/export-menu";
import {
  createMenuRight,
  deleteRecord,
  listMenuRights,
  listMenus,
  updateMenuRight,
  USER_ROLES,
  type MenuRightRow,
  type MenuRow,
} from "@/lib/admin-api";

const DEFAULT_PAGE_SIZE = 10;
const EXPORT_CAP = 5000;

const STAFF_ROLES = USER_ROLES.filter((r) => r !== "customer");

const humanizeRole = (role?: string) =>
  role ? role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "—";

function PermissionCell({ allowed }: { allowed?: boolean }) {
  return allowed ? (
    <Check className="size-4 text-[#29845a]" aria-label="Allowed" />
  ) : (
    <Minus className="size-4 text-muted-foreground/50" aria-label="Not allowed" />
  );
}

const columns: ColumnDef<MenuRightRow>[] = [
  {
    id: "menu",
    header: "Menu",
    cell: ({ row }) => {
      const r = row.original;
      return (
        <div className="min-w-0">
          <p className="truncate font-medium">
            {r.menu?.name ?? `Menu #${r.menu_id}`}
          </p>
          {r.menu?.slug && (
            <p className="truncate font-mono text-xs text-muted-foreground">
              /{r.menu.slug}
            </p>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "role",
    header: "Role",
    cell: ({ row }) => (
      <StatusBadge status={humanizeRole(row.original.role)} tone="info" />
    ),
  },
  {
    accessorKey: "can_view",
    header: "View",
    cell: ({ row }) => <PermissionCell allowed={row.original.can_view} />,
  },
  {
    accessorKey: "can_create",
    header: "Create",
    cell: ({ row }) => <PermissionCell allowed={row.original.can_create} />,
  },
  {
    accessorKey: "can_edit",
    header: "Edit",
    cell: ({ row }) => <PermissionCell allowed={row.original.can_edit} />,
  },
  {
    accessorKey: "can_delete",
    header: "Delete",
    cell: ({ row }) => <PermissionCell allowed={row.original.can_delete} />,
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

type Tri = "all" | "yes" | "no";
const triToBool = (v: Tri) => (v === "all" ? undefined : v === "yes");

export function MenuRightsSection() {
  const [rows, setRows] = React.useState<MenuRightRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(0);
  const [pageSize, setPageSize] = React.useState<number>(DEFAULT_PAGE_SIZE);
  const [pageCount, setPageCount] = React.useState(1);
  const [total, setTotal] = React.useState(0);

  const [roles, setRoles] = React.useState<string[]>([]);
  const [canView, setCanView] = React.useState<Tri>("all");
  const [canEdit, setCanEdit] = React.useState<Tri>("all");
  const [canDelete, setCanDelete] = React.useState<Tri>("all");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<MenuRightRow | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [exportBusy, setExportBusy] = React.useState(false);

  React.useEffect(() => {
    setPage(0);
  }, [roles, canView, canEdit, canDelete]);

  const buildFilters = React.useCallback(
    () => ({
      role: roles.length ? { in: roles } : undefined,
      can_view: triToBool(canView),
      can_edit: triToBool(canEdit),
      can_delete: triToBool(canDelete),
    }),
    [roles, canView, canEdit, canDelete]
  );

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listMenuRights({
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
        toast.error(apiErrorMessage(error, "Couldn't load menu rights."));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, buildFilters, refreshKey]);

  const runExport = async (fileFormat: ExportFormat) => {
    setExportBusy(true);
    try {
      const exportRows = (await listMenuRights({ page: 1, limit: EXPORT_CAP, filters: buildFilters() })).rows;
      if (!exportRows.length) {
        toast.error("Nothing to export.");
        return;
      }
      await writeExport(fileFormat, "menu-rights", [
        { key: "menu", label: "Menu", value: (r: MenuRightRow) => r.menu?.name ?? `Menu #${r.menu_id}` },
        { key: "role", label: "Role", value: (r: MenuRightRow) => humanizeRole(r.role) },
        { key: "can_view", label: "View", value: (r: MenuRightRow) => (r.can_view ? "Yes" : "No") },
        { key: "can_create", label: "Create", value: (r: MenuRightRow) => (r.can_create ? "Yes" : "No") },
        { key: "can_edit", label: "Edit", value: (r: MenuRightRow) => (r.can_edit ? "Yes" : "No") },
        { key: "can_delete", label: "Delete", value: (r: MenuRightRow) => (r.can_delete ? "Yes" : "No") },
      ], exportRows);
      toast.success(`Exported ${exportRows.length} row${exportRows.length === 1 ? "" : "s"}.`);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't export menu rights."));
    } finally {
      setExportBusy(false);
    }
  };

  const triSelect = (label: string, value: Tri, onChange: (v: Tri) => void) => (
    <Select
      items={{ all: `${label}: All`, yes: `${label}: Yes`, no: `${label}: No` }}
      value={value}
      onValueChange={(v) => onChange(v as Tri)}
    >
      <SelectTrigger className="min-w-32 bg-card">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{label}: All</SelectItem>
        <SelectItem value="yes">{label}: Yes</SelectItem>
        <SelectItem value="no">{label}: No</SelectItem>
      </SelectContent>
    </Select>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <MultiSelectFilter
          label="Role"
          options={STAFF_ROLES.map((r) => ({ value: r, label: humanizeRole(r) }))}
          value={roles}
          onChange={setRoles}
        />
        {triSelect("View", canView, setCanView)}
        {triSelect("Edit", canEdit, setCanEdit)}
        {triSelect("Delete", canDelete, setCanDelete)}
        <ExportFormatMenu onSelect={runExport} busy={exportBusy} />
        <Button
          className="ml-auto"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="size-4" />
          Add right
        </Button>
      </div>

      <MenuRightDialog
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

const ROLE_FORM_ITEMS: Record<string, string> = Object.fromEntries(
  STAFF_ROLES.map((r) => [r, humanizeRole(r)])
);

const menuRightSchema = z.object({
  menu_ids: z.array(z.number().int().positive()).min(1, "Pick at least one menu"),
  role: z.string().min(1, "Role is required"),
  can_view: z.boolean(),
  can_create: z.boolean(),
  can_edit: z.boolean(),
  can_delete: z.boolean(),
});
type MenuRightValues = z.infer<typeof menuRightSchema>;

function menuDepth(menu: MenuRow, byId: Map<number, MenuRow>): number {
  let depth = 0;
  let parent = menu.parent_id != null ? byId.get(Number(menu.parent_id)) : undefined;
  while (parent && depth < 5) {
    depth += 1;
    parent = parent.parent_id != null ? byId.get(Number(parent.parent_id)) : undefined;
  }
  return depth;
}

function MenuPicker({
  menus,
  loading,
  value,
  onChange,
  disabled,
  assigned,
  assignedLoading,
}: {
  menus: MenuRow[];
  loading: boolean;
  value: number[];
  onChange: (next: number[]) => void;
  disabled?: boolean;
  assigned?: Set<number>;
  assignedLoading?: boolean;
}) {
  const [query, setQuery] = React.useState("");

  const byId = React.useMemo(
    () => new Map(menus.map((m) => [Number(m.id), m])),
    [menus]
  );

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return menus;
    return menus.filter(
      (m) =>
        m.name.toLowerCase().includes(q) || (m.slug ?? "").toLowerCase().includes(q)
    );
  }, [menus, query]);

  const toggle = (id: number) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  const allVisibleIds = visible
    .map((m) => Number(m.id))
    .filter((id) => !assigned?.has(id));
  const allSelected =
    allVisibleIds.length > 0 && allVisibleIds.every((id) => value.includes(id));

  return (
    <div className="rounded-lg border border-input bg-card">
      <div className="flex items-center gap-2 border-b border-input p-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search menus"
          disabled={disabled}
          className="h-8 text-sm"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || !allVisibleIds.length}
          onClick={() =>
            onChange(
              allSelected
                ? value.filter((id) => !allVisibleIds.includes(id))
                : [...new Set([...value, ...allVisibleIds])]
            )
          }
        >
          {allSelected ? "Clear" : "All"}
        </Button>
      </div>

      <div className="max-h-56 overflow-y-auto p-1">
        {loading ? (
          <p className="flex items-center gap-2 px-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading menus…
          </p>
        ) : !visible.length ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            {menus.length ? "No menus match that search." : "No dashboard menus found."}
          </p>
        ) : (
          visible.map((menu) => {
            const id = Number(menu.id);
            const taken = !!assigned?.has(id);
            return (
              <label
                key={id}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                  taken ? "cursor-not-allowed opacity-55" : "cursor-pointer hover:bg-muted"
                )}
                style={{ paddingLeft: 8 + menuDepth(menu, byId) * 14 }}
              >
                <Checkbox
                  checked={taken || value.includes(id)}
                  onCheckedChange={() => !taken && toggle(id)}
                  disabled={disabled || taken}
                />
                <span className="truncate">{menu.name}</span>
                {menu.slug && (
                  <span className="truncate font-mono text-xs text-muted-foreground">
                    /{menu.slug}
                  </span>
                )}
                {taken && (
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    Already added
                  </span>
                )}
              </label>
            );
          })
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-input px-3 py-1.5 text-xs text-muted-foreground">
        <span>{value.length} selected</span>
        {assignedLoading && (
          <span className="ml-auto flex items-center gap-1">
            <Loader2 className="size-3 animate-spin" />
            Checking this role…
          </span>
        )}
      </div>
    </div>
  );
}

function MenuRightDialog({
  editing,
  open,
  onOpenChange,
  onSaved,
}: {
  editing: MenuRightRow | null;
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
  } = useForm<MenuRightValues>({
    resolver: zodResolver(menuRightSchema),
    defaultValues: {
      menu_ids: [],
      role: "manager",
      can_view: true,
      can_create: false,
      can_edit: false,
      can_delete: false,
    },
  });

  const [menus, setMenus] = React.useState<MenuRow[]>([]);
  const [menusLoading, setMenusLoading] = React.useState(false);
  const [assigned, setAssigned] = React.useState<Set<number>>(new Set());
  const [assignedLoading, setAssignedLoading] = React.useState(false);

  const role = watch("role");
  const selectedMenuIds = watch("menu_ids");

  const selectedMenuIdsRef = React.useRef(selectedMenuIds);
  selectedMenuIdsRef.current = selectedMenuIds;

  React.useEffect(() => {
    if (!open || editing || !role) return;
    let cancelled = false;

    setAssigned(new Set());
    setAssignedLoading(true);

    listMenuRights({ page: 1, limit: 500, filters: { role } })
      .then((res) => {
        if (cancelled) return;
        const taken = new Set(res.rows.map((r) => Number(r.menu_id)));
        setAssigned(taken);
        setValue(
          "menu_ids",
          (selectedMenuIdsRef.current ?? []).filter((id) => !taken.has(id))
        );
      })
      .catch((error) => {
        if (cancelled) return;
        toast.error(
          apiErrorMessage(error, "Couldn't check which menus this role already has.")
        );
      })
      .finally(() => !cancelled && setAssignedLoading(false));

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, role]);


  React.useEffect(() => {
    if (!open || menus.length) return;
    let cancelled = false;
    setMenusLoading(true);
    listMenus({ page: 1, limit: 500, filters: { menu_type: "dashboard" } })
      .then((res) => !cancelled && setMenus(res.rows))
      .catch((error) => {
        if (cancelled) return;
        toast.error(apiErrorMessage(error, "Couldn't load the menu list."));
      })
      .finally(() => !cancelled && setMenusLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, menus.length]);

  React.useEffect(() => {
    if (open) {
      reset({
        menu_ids: editing?.menu_id != null ? [Number(editing.menu_id)] : [],
        role: editing?.role ?? "manager",
        can_view: editing?.can_view ?? true,
        can_create: editing?.can_create ?? false,
        can_edit: editing?.can_edit ?? false,
        can_delete: editing?.can_delete ?? false,
      });
    }
  }, [open, editing, reset]);

  const onSubmit = async (values: MenuRightValues) => {
    const permissions = {
      role: values.role,
      can_view: values.can_view,
      can_create: values.can_create,
      can_edit: values.can_edit,
      can_delete: values.can_delete,
    };

    if (editing) {
      try {
        toast.success(
          await updateMenuRight(editing.id, {
            menu_id: Number(editing.menu_id),
            ...permissions,
          })
        );
        onOpenChange(false);
        onSaved();
      } catch (error) {
        toast.error(apiErrorMessage(error, "Couldn't update the menu right."));
      }
      return;
    }

    const results = await Promise.allSettled(
      values.menu_ids.map((menu_id) => createMenuRight({ menu_id, ...permissions }))
    );

    const failed = results.flatMap((result, i) =>
      result.status === "rejected"
        ? [{ menu_id: values.menu_ids[i], reason: result.reason }]
        : []
    );
    const created = results.length - failed.length;

    if (created) {
      toast.success(`Added ${created} menu right${created === 1 ? "" : "s"}.`);
    }
    failed.forEach(({ menu_id, reason }) => {
      const name = menus.find((m) => Number(m.id) === menu_id)?.name ?? `Menu #${menu_id}`;
      toast.error(`${name}: ${apiErrorMessage(reason, "couldn't be added.")}`);
    });

    if (created) {
      onOpenChange(false);
      onSaved();
    }
  };

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const handleDelete = async () => {
    if (!editing) return;
    setDeleting(true);
    try {
      const message = await deleteRecord("menuRight", editing.id);
      toast.success(message);
      setConfirmOpen(false);
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't delete the menu right."));
    } finally {
      setDeleting(false);
    }
  };

  const perm = (
    id: "can_view" | "can_create" | "can_edit" | "can_delete",
    label: string
  ) => (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-input bg-card px-3 py-2 text-sm">
      <input type="checkbox" className="accent-primary" {...register(id)} />
      {label}
    </label>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit menu right" : "Add menu right"}</DialogTitle>
          <DialogDescription>
            {editing
              ? `Update permissions for ${humanizeRole(editing.role)}.`
              : "Assign permissions for a role on a menu item."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label>{editing ? "Menu" : "Menus"}</Label>
            <Controller
              control={control}
              name="menu_ids"
              render={({ field }) => (
                <MenuPicker
                  menus={menus}
                  loading={menusLoading}
                  value={field.value}
                  onChange={field.onChange}
                  disabled={!!editing}
                  assigned={editing ? undefined : assigned}
                  assignedLoading={assignedLoading}
                />
              )}
            />
            {errors.menu_ids && (
              <p className="text-sm text-destructive">{errors.menu_ids.message}</p>
            )}
            {!editing && (
              <p className="text-xs text-muted-foreground">
                Pick as many as you like — the same permissions are applied to each.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Role</Label>
            <Controller
              control={control}
              name="role"
              render={({ field }) => (
                <Select items={ROLE_FORM_ITEMS} value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAFF_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {humanizeRole(r)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Permissions</Label>
            <div className="grid grid-cols-2 gap-2">
              {perm("can_view", "View")}
              {perm("can_create", "Create")}
              {perm("can_edit", "Edit")}
              {perm("can_delete", "Delete")}
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
              {editing ? "Save changes" : "Save right"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        loading={deleting}
        onConfirm={handleDelete}
        title="Delete this menu right?"
        description="This can't be undone."
      />
    </Dialog>
  );
}
