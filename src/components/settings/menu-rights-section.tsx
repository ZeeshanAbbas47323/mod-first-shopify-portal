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
import { apiErrorMessage } from "@/lib/auth-api";
import {
  createMenuRight,
  deleteRecord,
  listMenuRights,
  updateMenuRight,
  USER_ROLES,
  type MenuRightRow,
} from "@/lib/admin-api";

const PAGE_SIZE = 10;

const ROLE_ITEMS: Record<string, string> = Object.fromEntries([
  ["all", "All roles"],
  ...USER_ROLES.map((r) => [r, r.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())]),
]);

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
  const [pageCount, setPageCount] = React.useState(1);
  const [total, setTotal] = React.useState(0);

  const [role, setRole] = React.useState("all");
  const [canView, setCanView] = React.useState<Tri>("all");
  const [canEdit, setCanEdit] = React.useState<Tri>("all");
  const [canDelete, setCanDelete] = React.useState<Tri>("all");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<MenuRightRow | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);

  React.useEffect(() => {
    setPage(0);
  }, [role, canView, canEdit, canDelete]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listMenuRights({
      page: page + 1,
      limit: PAGE_SIZE,
      filters: {
        role: role === "all" ? undefined : role,
        can_view: triToBool(canView),
        can_edit: triToBool(canEdit),
        can_delete: triToBool(canDelete),
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
        toast.error(apiErrorMessage(error, "Couldn't load menu rights."));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, role, canView, canEdit, canDelete, refreshKey]);

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
        <Select items={ROLE_ITEMS} value={role} onValueChange={(v) => setRole(v as string)}>
          <SelectTrigger className="min-w-36 bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {USER_ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {humanizeRole(r)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {triSelect("View", canView, setCanView)}
        {triSelect("Edit", canEdit, setCanEdit)}
        {triSelect("Delete", canDelete, setCanDelete)}
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
        serverPagination={{ pageIndex: page, pageCount, total, onPageChange: setPage }}
      />
    </div>
  );
}

const ROLE_FORM_ITEMS: Record<string, string> = Object.fromEntries(
  USER_ROLES.map((r) => [r, humanizeRole(r)])
);

const menuRightSchema = z.object({
  menu_id: z.number({ error: "Menu ID must be a number" }).int().positive("Menu ID is required"),
  role: z.string().min(1, "Role is required"),
  can_view: z.boolean(),
  can_create: z.boolean(),
  can_edit: z.boolean(),
  can_delete: z.boolean(),
});
type MenuRightValues = z.infer<typeof menuRightSchema>;

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
    formState: { errors, isSubmitting },
  } = useForm<MenuRightValues>({
    resolver: zodResolver(menuRightSchema),
    defaultValues: {
      menu_id: undefined as unknown as number,
      role: "manager",
      can_view: true,
      can_create: false,
      can_edit: false,
      can_delete: false,
    },
  });

  React.useEffect(() => {
    if (open) {
      reset({
        menu_id: editing?.menu_id ?? (undefined as unknown as number),
        role: editing?.role ?? "manager",
        can_view: editing?.can_view ?? true,
        can_create: editing?.can_create ?? false,
        can_edit: editing?.can_edit ?? false,
        can_delete: editing?.can_delete ?? false,
      });
    }
  }, [open, editing, reset]);

  const onSubmit = async (values: MenuRightValues) => {
    try {
      const body = {
        menu_id: values.menu_id,
        role: values.role,
        can_view: values.can_view,
        can_create: values.can_create,
        can_edit: values.can_edit,
        can_delete: values.can_delete,
      };
      const message = editing
        ? await updateMenuRight(editing.id, body)
        : await createMenuRight(body);
      toast.success(message);
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(
        apiErrorMessage(error, `Couldn't ${editing ? "update" : "create"} the menu right.`)
      );
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
            <Label htmlFor="mr-menu-id">Menu ID</Label>
            <Input
              id="mr-menu-id"
              type="number"
              placeholder="5"
              disabled={!!editing}
              aria-invalid={!!errors.menu_id}
              {...register("menu_id", { valueAsNumber: true })}
            />
            {errors.menu_id && (
              <p className="text-sm text-destructive">{errors.menu_id.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Find IDs in the Menus section above.
            </p>
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
                    {USER_ROLES.map((r) => (
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
