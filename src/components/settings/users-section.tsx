"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Building2, Loader2, LogOut, MoreHorizontal, Pencil, Plus, Search, Trash2, Unlock, UserMinus } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { DateRange } from "react-day-picker";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable, type ColumnFilterDef } from "@/components/data-table";
import { DateRangePicker } from "@/components/date-range-picker";
import { StatusBadge, StatusToggle } from "@/components/status-badge";
import { MultiSelectFilter } from "@/components/multi-select-filter";
import { SummaryStatStrip } from "@/components/summary-stat-strip";
import { apiErrorMessage } from "@/lib/auth-api";
import { exportRows as writeExport, type ExportFormat, fetchAllPages } from "@/lib/export";
import { ExportFormatMenu } from "@/components/export-menu";
import {
  assignUserToBranch,
  createUser,
  fetchAllDiscountTiers,
  deleteRecord,
  getUsersSummary,
  listBranches,
  listUsers,
  removeUserFromBranch,
  terminateUserSession,
  unlockUser,
  updateRecordStatus,
  updateUser,
  USER_ROLES,
  type BranchRow,
  type DiscountTierRow,
  type UserRow,
} from "@/lib/admin-api";

const DEFAULT_PAGE_SIZE = 10;
const EXPORT_CAP = 5000;

const STAFF_ROLES = USER_ROLES.filter((r) => r !== "customer");

const STATUS_ITEMS = { all: "All statuses", active: "Active", inactive: "Inactive" };


function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const humanizeRole = (role?: string) =>
  role ? role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "—";

function getColumns(
  onToggleStatus: (row: UserRow, next: boolean) => Promise<void>,
  actions: {
    onEdit: (row: UserRow) => void;
    onAssignBranch: (row: UserRow) => void;
    onRemoveBranch: (row: UserRow) => void;
    onUnlock: (row: UserRow) => void;
    onTerminate: (row: UserRow) => void;
  },
  branchName: (id?: number | null) => string
): ColumnDef<UserRow>[] {
  return [
  {
    accessorKey: "full_name",
    header: "User",
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <Avatar className="size-8">
          <AvatarFallback className="bg-[#e0f0ff] text-xs font-semibold text-[#00527c]">
            {initialsOf(row.original.full_name ?? "?")}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate font-medium">{row.original.full_name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {row.original.email}
          </p>
        </div>
      </div>
    ),
  },
  {
    accessorKey: "role",
    header: "Role",
    cell: ({ row }) => (
      <StatusBadge status={humanizeRole(row.original.role)} tone="info" />
    ),
  },
  {
    accessorKey: "phone",
    header: "Phone",
    cell: ({ row }) => row.original.phone ?? "—",
  },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => {
      const u = row.original;
      if (u.is_locked) return <StatusBadge status="Locked" tone="critical" />;
      return (
        <StatusToggle
          isActive={u.is_active !== false}
          onToggle={(next) => onToggleStatus(u, next)}
        />
      );
    },
  },
  {
    accessorKey: "branch_id",
    header: "Branch",
    cell: ({ row }) => branchName(row.original.branch_id),
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
  {
    id: "actions",
    header: () => <div className="text-right">Actions</div>,
    cell: ({ row }) => {
      const u = row.original;
      return (
        <div className="text-right" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="User actions"
              className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => actions.onEdit(u)}>
                <Pencil className="size-4" /> Edit user
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => actions.onAssignBranch(u)}>
                <Building2 className="size-4" />
                {u.branch_id != null ? "Change branch" : "Assign to branch"}
              </DropdownMenuItem>
              {u.branch_id != null && (
                <DropdownMenuItem onClick={() => actions.onRemoveBranch(u)}>
                  <UserMinus className="size-4" /> Remove from branch
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {u.is_locked && (
                <DropdownMenuItem onClick={() => actions.onUnlock(u)}>
                  <Unlock className="size-4" /> Unlock user
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                variant="destructive"
                onClick={() => actions.onTerminate(u)}
              >
                <LogOut className="size-4" /> Terminate sessions
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  },
  ];
}

const COLUMN_FILTERS: Record<string, ColumnFilterDef> = {
  full_name: { type: "text", placeholder: "Search staff" },
  status: { type: "select", options: [{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }], placeholder: "Any" },
};

export function UsersSection() {
  const [rows, setRows] = React.useState<UserRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(0);
  const [pageSize, setPageSize] = React.useState<number>(DEFAULT_PAGE_SIZE);
  const [pageCount, setPageCount] = React.useState(1);
  const [total, setTotal] = React.useState(0);

  const [search, setSearch] = React.useState("");
  const [roles, setRoles] = React.useState<string[]>([]);
  const [status, setStatus] = React.useState("all");
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<UserRow | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [summary, setSummary] = React.useState<{ total: number; new: number; locked: number } | null>(null);
  const [exportBusy, setExportBusy] = React.useState(false);

  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  React.useEffect(() => {
    setPage(0);
  }, [debouncedSearch, roles, status, dateRange]);

  const buildFilters = React.useCallback(
    () => ({
      full_name: debouncedSearch ? { contains: debouncedSearch } : undefined,
      role: roles.length ? { in: roles } : { nin: "customer" },
      is_active: status === "all" ? undefined : status === "active",
    }),
    [debouncedSearch, roles, status]
  );

  const columnFilterValues = React.useMemo(() => {
    const values: Record<string, string[]> = {};
    if (search) values.full_name = [search];
    if (status !== "all") values.status = [status];
    return values;
  }, [search, status]);

  const applyColumnFilters = React.useCallback(
    (next: Record<string, string[]>) => {
      setSearch(next.full_name?.[0] ?? "");
      const picked = next.status ?? [];
      setStatus(picked.length === 1 ? picked[0] : "all");
    },
    []
  );

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listUsers({
      page: page + 1,
      limit: pageSize,
      dateRange,
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
        toast.error(apiErrorMessage(error, "Couldn't load users."));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, buildFilters, dateRange, refreshKey]);

  React.useEffect(() => {
    let cancelled = false;
    getUsersSummary({ dateRange, filters: buildFilters() })
      .then((s) => {
        if (cancelled) return;
        setSummary({ total: s.total_customers, new: s.new_customers.current, locked: s.locked });
      })
      .catch(() => !cancelled && setSummary(null));
    return () => {
      cancelled = true;
    };
  }, [dateRange, buildFilters, refreshKey]);

  const runExport = async (fileFormat: ExportFormat) => {
    setExportBusy(true);
    try {
      const exportRows = await fetchAllPages((page, limit) => listUsers({ page, limit, dateRange, filters: buildFilters() }), EXPORT_CAP);
      if (!exportRows.length) {
        toast.error("Nothing to export.");
        return;
      }
      await writeExport(fileFormat, `staff-users-${format(new Date(), "yyyy-MM-dd")}`, [
        { key: "full_name", label: "Name", value: (r: UserRow) => r.full_name ?? "" },
        { key: "email", label: "Email", value: (r: UserRow) => r.email ?? "" },
        { key: "role", label: "Role", value: (r: UserRow) => humanizeRole(r.role) },
        { key: "phone", label: "Phone", value: (r: UserRow) => r.phone ?? "" },
        { key: "is_active", label: "Active", value: (r: UserRow) => (r.is_active === false ? "No" : "Yes") },
        { key: "is_locked", label: "Locked", value: (r: UserRow) => (r.is_locked ? "Yes" : "No") },
        { key: "created_at", label: "Created", value: (r: UserRow) => (r.created_at ? format(new Date(r.created_at), "yyyy-MM-dd") : "") },
      ], exportRows);
      toast.success(`Exported ${exportRows.length} user${exportRows.length === 1 ? "" : "s"}.`);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't export users."));
    } finally {
      setExportBusy(false);
    }
  };

  const [branches, setBranches] = React.useState<BranchRow[]>([]);
  const [branchTarget, setBranchTarget] = React.useState<UserRow | null>(null);
  const [removeTarget, setRemoveTarget] = React.useState<UserRow | null>(null);
  const [removing, setRemoving] = React.useState(false);

  React.useEffect(() => {
    listBranches({ page: 1, limit: 100 })
      .then((res) => setBranches(res.rows))
      .catch(() => setBranches([]));
  }, []);

  const handleToggleStatus = async (row: UserRow, next: boolean) => {
    try {
      await updateRecordStatus("user", row.id, next);
      toast.success(next ? "User activated." : "User deactivated.");
      setRefreshKey((k) => k + 1);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't update status."));
    }
  };

  const [terminateTarget, setTerminateTarget] = React.useState<UserRow | null>(null);
  const [terminating, setTerminating] = React.useState(false);

  const handleTerminate = async () => {
    if (!terminateTarget) return;
    setTerminating(true);
    try {
      toast.success(await terminateUserSession(terminateTarget.id));
      setTerminateTarget(null);
      setRefreshKey((k) => k + 1);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't terminate the sessions."));
    } finally {
      setTerminating(false);
    }
  };

  const handleUnlock = async (row: UserRow) => {
    try {
      toast.success(await unlockUser(row.id));
      setRefreshKey((k) => k + 1);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't unlock the user."));
    }
  };

  const handleRemoveBranch = async () => {
    if (!removeTarget?.branch_id) return;
    setRemoving(true);
    try {
      toast.success(
        await removeUserFromBranch({
          user_id: removeTarget.id,
          branch_id: removeTarget.branch_id,
        })
      );
      setRemoveTarget(null);
      setRefreshKey((k) => k + 1);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't remove the user from the branch."));
    } finally {
      setRemoving(false);
    }
  };

  const branchName = React.useCallback(
    (id?: number | null) =>
      id == null
        ? "—"
        : branches.find((b) => String(b.id) === String(id))?.name ?? `#${id}`,
    [branches]
  );

  const columns = React.useMemo(
    () =>
      getColumns(
        handleToggleStatus,
        {
          onEdit: (row) => {
            setEditing(row);
            setDialogOpen(true);
          },
          onAssignBranch: setBranchTarget,
          onRemoveBranch: setRemoveTarget,
          onUnlock: handleUnlock,
          onTerminate: setTerminateTarget,
        },
        branchName
      ),

    [branchName]
  );

  return (
    <div className="flex flex-col gap-3">
      <SummaryStatStrip
        loading={!summary}
        tiles={[
          { label: "Total staff", value: String(summary?.total ?? 0) },
          { label: "New this period", value: String(summary?.new ?? 0) },
          { label: "Locked", value: String(summary?.locked ?? 0) },
        ]}
      />

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
        <MultiSelectFilter label="Role" options={STAFF_ROLES} value={roles} onChange={setRoles} />
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
        <DateRangePicker value={dateRange} onChange={setDateRange} />
        <ExportFormatMenu onSelect={runExport} busy={exportBusy} />
        <Button className="ml-auto" onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="size-4" />
          Add user
        </Button>
      </div>

      <UserDialog
        editing={editing}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={() => setRefreshKey((k) => k + 1)}
      />

      <AssignBranchDialog
        user={branchTarget}
        branches={branches}
        branchName={branchName}
        onClose={() => setBranchTarget(null)}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />

      <ConfirmDeleteDialog
        open={!!terminateTarget}
        onOpenChange={(next) => !next && setTerminateTarget(null)}
        loading={terminating}
        onConfirm={handleTerminate}
        title={`Sign ${terminateTarget?.full_name ?? "this user"} out everywhere?`}
        confirmLabel="Terminate sessions"
        description="Their active tokens are revoked, so they'll have to log in again on every device. Their account stays active."
      />

      <ConfirmDeleteDialog
        open={!!removeTarget}
        onOpenChange={(next) => !next && setRemoveTarget(null)}
        loading={removing}
        onConfirm={handleRemoveBranch}
        title={`Remove ${removeTarget?.full_name ?? ""} from ${branchName(removeTarget?.branch_id)}?`}
        confirmLabel="Remove"
        description="They'll keep their account but lose access to that branch's data."
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
const ROLE_FORM_ITEMS = Object.fromEntries(
  STAFF_ROLES.map((r) => [r, humanizeRole(r)])
);

const baseUserSchema = z.object({
  full_name: z.string().min(1, "Full name is required"),
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  phone: z.string().min(7, "Enter a valid phone number"),
  role: z.string().min(1, "Role is required"),
  discount_tier_id: z.string().optional(),
  status: z.enum(["active", "inactive"]),
  password: z.string().optional(),
  confirmPassword: z.string().optional(),
});

const createUserSchema = baseUserSchema
  .extend({
    password: z
      .string()
      .min(8, "At least 8 characters")
      .regex(/[A-Z]/, "Include an uppercase letter")
      .regex(/[a-z]/, "Include a lowercase letter")
      .regex(/\d/, "Include a number")
      .regex(/[^A-Za-z0-9]/, "Include a special character"),
    confirmPassword: z.string().min(1, "Confirm the password"),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match",
  });

type UserValues = z.infer<typeof baseUserSchema>;

function UserDialog({
  editing,
  open,
  onOpenChange,
  onCreated,
}: {
  editing: UserRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [unlocking, setUnlocking] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UserValues>({
    resolver: zodResolver(editing ? baseUserSchema : createUserSchema),
    defaultValues: {
      full_name: "",
      email: "",
      phone: "",
      role: "manager",
      discount_tier_id: "none",
      status: "active",
      password: "",
      confirmPassword: "",
    },
  });

  const [tiers, setTiers] = React.useState<DiscountTierRow[]>([]);
  React.useEffect(() => {
    if (!open) return;
    fetchAllDiscountTiers()
      .then(setTiers)
      .catch(() => setTiers([]));
  }, [open]);

  React.useEffect(() => {
    if (open) {
      reset({
        full_name: editing?.full_name ?? "",
        email: editing?.email ?? "",
        phone: editing?.phone ?? "",
        role: editing?.role ?? "manager",
        discount_tier_id:
          editing?.discount_tier_id != null
            ? String(editing.discount_tier_id)
            : "none",
        status: editing?.is_active === false ? "inactive" : "active",
        password: "",
        confirmPassword: "",
      });
    }
  }, [open, editing, reset]);

  const onSubmit = async (values: UserValues) => {
    try {
      let message: string;
      if (editing) {
        message = await updateUser(editing.id, {
          full_name: values.full_name,
          phone: values.phone,
          role: values.role,
          discount_tier_id:
            values.discount_tier_id && values.discount_tier_id !== "none"
              ? Number(values.discount_tier_id)
              : null,
          is_active: values.status === "active",
        });
      } else {
        message = await createUser({
          full_name: values.full_name,
          email: values.email,
          phone: values.phone,
          role: values.role,
          password: values.password,
          confirmPassword: values.confirmPassword,
          discount_tier_id:
            values.discount_tier_id && values.discount_tier_id !== "none"
              ? Number(values.discount_tier_id)
              : null,
          is_active: values.status === "active",
        });
      }
      toast.success(message);
      onOpenChange(false);
      onCreated();
    } catch (error) {
      toast.error(
        apiErrorMessage(error, `Couldn't ${editing ? "update" : "create"} the user.`)
      );
    }
  };

  const unlock = async () => {
    if (!editing) return;
    setUnlocking(true);
    try {
      toast.success(await unlockUser(editing.id));
      onOpenChange(false);
      onCreated();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't unlock the user."));
    } finally {
      setUnlocking(false);
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    setDeleting(true);
    try {
      const message = await deleteRecord("user", editing.id);
      toast.success(message);
      setConfirmOpen(false);
      onOpenChange(false);
      onCreated();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't delete the user."));
    } finally {
      setDeleting(false);
    }
  };

  const field = (
    id: "full_name" | "email" | "phone" | "password" | "confirmPassword",
    label: string,
    placeholder: string,
    type = "text",
    disabled = false
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={`user-${id}`}>{label}</Label>
      <Input
        id={`user-${id}`}
        type={type}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={!!errors[id]}
        {...register(id)}
      />
      {errors[id] && (
        <p className="text-sm text-destructive">{errors[id]?.message}</p>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit user" : "Add user"}</DialogTitle>
          <DialogDescription>
            {editing ? `Update ${editing.full_name}'s account.` : "Create a new staff account."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {field("full_name", "Full name", "Ammar Ali")}
          <div className="grid gap-3 sm:grid-cols-2">
            {field("email", "Email", "user@store.com", "email", !!editing)}
            {field("phone", "Phone", "+923001234567")}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Controller
                control={control}
                name="role"
                render={({ field: f }) => (
                  <Select items={ROLE_FORM_ITEMS} value={f.value} onValueChange={f.onChange}>
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
              <Label>Status</Label>
              <Controller
                control={control}
                name="status"
                render={({ field: f }) => (
                  <Select items={STATUS_FORM_ITEMS} value={f.value} onValueChange={f.onChange}>
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

          <div className="space-y-1.5">
            <Label>Discount tier</Label>
            <Controller
              control={control}
              name="discount_tier_id"
              render={({ field: f }) => (
                <Select
                  items={{
                    none: "No tier",
                    ...Object.fromEntries(tiers.map((t) => [String(t.id), t.name])),
                  }}
                  value={f.value ?? "none"}
                  onValueChange={f.onChange}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    <SelectItem value="none">No tier</SelectItem>
                    {tiers.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.name} ·{" "}
                        {t.discount_type === "fixed_amount"
                          ? `$${Number(t.discount_value ?? 0)}`
                          : `${Number(t.discount_value ?? 0)}%`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <p className="text-xs text-muted-foreground">
              A standing discount applied to this customer&apos;s orders.
            </p>
          </div>

          {!editing && (
            <div className="grid gap-3 sm:grid-cols-2">
              {field("password", "Password", "••••••••", "password")}
              {field("confirmPassword", "Confirm password", "••••••••", "password")}
            </div>
          )}
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
            {editing?.is_locked && (
              <Button
                type="button"
                variant="outline"
                onClick={unlock}
                disabled={unlocking}
              >
                {unlocking && <Loader2 className="size-4 animate-spin" />}
                Unlock user
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {editing ? "Save changes" : "Save user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        loading={deleting}
        onConfirm={handleDelete}
        title={`Delete "${editing?.full_name}"?`}
        description="This will permanently remove the user's account. This can't be undone."
      />
    </Dialog>
  );
}

function AssignBranchDialog({
  user,
  branches,
  branchName,
  onClose,
  onSaved,
}: {
  user: UserRow | null;
  branches: BranchRow[];
  branchName: (id?: number | null) => string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [branchId, setBranchId] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (user) setBranchId(user.branch_id != null ? String(user.branch_id) : "");
  }, [user]);

  const submit = async () => {
    if (!user || !branchId) return;
    setSaving(true);
    try {
      toast.success(
        await assignUserToBranch({ user_id: user.id, branch_id: Number(branchId) })
      );
      onClose();
      onSaved();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't assign the user to that branch."));
    } finally {
      setSaving(false);
    }
  };

  const items = Object.fromEntries(branches.map((b) => [String(b.id), b.name]));
  const unchanged = !!user && String(user.branch_id ?? "") === branchId;

  return (
    <Dialog open={!!user} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign to branch</DialogTitle>
          <DialogDescription>
            {user
              ? `${user.full_name} is currently in ${branchName(user.branch_id)}.`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label>Branch</Label>
          <Select items={items} value={branchId} onValueChange={(v) => setBranchId(v as string)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a branch" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {branches.map((b) => (
                <SelectItem key={b.id} value={String(b.id)}>
                  {b.name}
                  {b.city ? ` · ${b.city}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {branches.length === 0 && (
            <p className="text-xs text-destructive">No branches configured yet.</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || !branchId || unchanged}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
