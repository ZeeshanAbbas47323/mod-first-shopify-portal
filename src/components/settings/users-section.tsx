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
import { DataTable } from "@/components/data-table";
import { DateRangePicker } from "@/components/date-range-picker";
import { StatusBadge, StatusToggle } from "@/components/status-badge";
import { apiErrorMessage } from "@/lib/auth-api";
import { createUser, deleteRecord, listUsers, unlockUser, updateRecordStatus, updateUser, USER_ROLES, type UserRow } from "@/lib/admin-api";

const PAGE_SIZE = 10;

const STATUS_ITEMS = { all: "All statuses", active: "Active", inactive: "Inactive" };
const ROLE_ITEMS = Object.fromEntries([["all", "All roles"], ...USER_ROLES.map((r) => [r, r.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())])]);


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
  onToggleStatus: (row: UserRow, next: boolean) => Promise<void>
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

export function UsersSection() {
  const [rows, setRows] = React.useState<UserRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(0);
  const [pageCount, setPageCount] = React.useState(1);
  const [total, setTotal] = React.useState(0);

  const [search, setSearch] = React.useState("");
  const [role, setRole] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<UserRow | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);

  // Debounce the text search
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  React.useEffect(() => {
    setPage(0);
  }, [debouncedSearch, role, status, dateRange]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listUsers({
      page: page + 1,
      limit: PAGE_SIZE,
      dateRange,
      filters: {
        full_name: debouncedSearch || undefined,
        role: role === "all" ? undefined : role,
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
        toast.error(apiErrorMessage(error, "Couldn't load users."));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, debouncedSearch, role, status, dateRange, refreshKey]);

  const handleToggleStatus = async (row: UserRow, next: boolean) => {
    try {
      await updateRecordStatus("user", row.id, next);
      toast.success(next ? "User activated." : "User deactivated.");
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
            placeholder="Search by name"
            className="bg-card pl-8"
          />
        </div>
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
const ROLE_FORM_ITEMS = Object.fromEntries(
  USER_ROLES.map((r) => [r, humanizeRole(r)])
);

const baseUserSchema = z.object({
  full_name: z.string().min(1, "Full name is required"),
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  phone: z.string().min(7, "Enter a valid phone number"),
  role: z.string().min(1, "Role is required"),
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
      status: "active",
      password: "",
      confirmPassword: "",
    },
  });

  React.useEffect(() => {
    if (open) {
      reset({
        full_name: editing?.full_name ?? "",
        email: editing?.email ?? "",
        phone: editing?.phone ?? "",
        role: editing?.role ?? "manager",
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
        // Update API accepts full_name, phone, role, is_active (email is not updatable)
        message = await updateUser(editing.id, {
          full_name: values.full_name,
          phone: values.phone,
          role: values.role,
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
