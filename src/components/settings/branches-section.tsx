"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Loader2, Plus, Search, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
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
import { StatusToggle } from "@/components/status-badge";
import { apiErrorMessage } from "@/lib/auth-api";
import { exportRows as writeExport, type ExportFormat } from "@/lib/export";
import { ExportFormatMenu } from "@/components/export-menu";
import { createBranch, deleteRecord, listBranches, updateBranch, updateRecordStatus, type BranchRow } from "@/lib/admin-api";

const DEFAULT_PAGE_SIZE = 10;
const EXPORT_CAP = 5000;

const STATUS_ITEMS = { all: "All statuses", active: "Active", inactive: "Inactive" };


function getColumns(
  onToggleStatus: (row: BranchRow, next: boolean) => Promise<void>
): ColumnDef<BranchRow>[] {
  return [
  {
    accessorKey: "name",
    header: "Branch",
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="truncate font-medium">{row.original.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {row.original.code}
        </p>
      </div>
    ),
  },
  {
    id: "location",
    header: "Location",
    cell: ({ row }) => {
      const b = row.original;
      const parts = [b.city, b.state, b.country].filter(Boolean);
      return parts.length ? parts.join(", ") : "—";
    },
  },
  {
    accessorKey: "manager_name",
    header: "Manager",
    size: 220,
    cell: ({ row }) => {
      const b = row.original;
      if (!b.manager_name && !b.manager_email) return "—";
      return (
        <div style={{ minWidth: 180 }}>
          <p className="whitespace-nowrap font-medium">{b.manager_name ?? "—"}</p>
          {b.manager_email && (
            <p className="whitespace-nowrap text-xs text-muted-foreground">
              {b.manager_email}
            </p>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "phone",
    header: "Contact",
    size: 240,
    cell: ({ row }) => {
      const b = row.original;
      if (!b.phone && !b.email) return "—";
      return (
        <div style={{ minWidth: 200 }}>
          <p className="whitespace-nowrap font-medium">{b.phone ?? "—"}</p>
          {b.email && (
            <p className="whitespace-nowrap text-xs text-muted-foreground">{b.email}</p>
          )}
        </div>
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
  name: { type: "text", placeholder: "Search branches" },
  status: { type: "select", options: [{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }], placeholder: "Any" },
};

export function BranchesSection() {
  const [rows, setRows] = React.useState<BranchRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(0);
  const [pageSize, setPageSize] = React.useState<number>(DEFAULT_PAGE_SIZE);
  const [pageCount, setPageCount] = React.useState(1);
  const [total, setTotal] = React.useState(0);

  const [search, setSearch] = React.useState("");
  const [city, setCity] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<BranchRow | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [exportBusy, setExportBusy] = React.useState(false);

  const [debounced, setDebounced] = React.useState({ search: "", city: "" });
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced({ search, city }), 400);
    return () => clearTimeout(t);
  }, [search, city]);

  React.useEffect(() => {
    setPage(0);
  }, [debounced, status, dateRange]);

  const buildFilters = React.useCallback(
    () => ({
      name: debounced.search ? { contains: debounced.search } : undefined,
      city: debounced.city ? { contains: debounced.city } : undefined,
      is_active: status === "all" ? undefined : status === "active",
    }),
    [debounced, status]
  );

  const columnFilterValues = React.useMemo(() => {
    const values: Record<string, string[]> = {};
    if (search) values.name = [search];
    if (status !== "all") values.status = [status];
    return values;
  }, [search, status]);

  const applyColumnFilters = React.useCallback(
    (next: Record<string, string[]>) => {
      setSearch(next.name?.[0] ?? "");
      const picked = next.status ?? [];
      setStatus(picked.length === 1 ? picked[0] : "all");
    },
    []
  );

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listBranches({
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
        toast.error(apiErrorMessage(error, "Couldn't load branches."));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, buildFilters, dateRange, refreshKey]);

  const runExport = async (fileFormat: ExportFormat) => {
    setExportBusy(true);
    try {
      const exportRows = (await listBranches({ page: 1, limit: EXPORT_CAP, dateRange, filters: buildFilters() })).rows;
      if (!exportRows.length) {
        toast.error("Nothing to export.");
        return;
      }
      await writeExport(fileFormat, "branches", [
        { key: "name", label: "Branch", value: (r: BranchRow) => r.name ?? "" },
        { key: "code", label: "Code", value: (r: BranchRow) => r.code ?? "" },
        { key: "city", label: "City", value: (r: BranchRow) => r.city ?? "" },
        { key: "state", label: "State", value: (r: BranchRow) => r.state ?? "" },
        { key: "country", label: "Country", value: (r: BranchRow) => r.country ?? "" },
        { key: "manager_name", label: "Manager", value: (r: BranchRow) => r.manager_name ?? "" },
        { key: "phone", label: "Phone", value: (r: BranchRow) => r.phone ?? "" },
        { key: "email", label: "Email", value: (r: BranchRow) => r.email ?? "" },
        { key: "is_active", label: "Active", value: (r: BranchRow) => (r.is_active === false ? "No" : "Yes") },
      ], exportRows);
      toast.success(`Exported ${exportRows.length} branch${exportRows.length === 1 ? "" : "es"}.`);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't export branches."));
    } finally {
      setExportBusy(false);
    }
  };

  const handleToggleStatus = async (row: BranchRow, next: boolean) => {
    try {
      await updateRecordStatus("branch", row.id, next);
      toast.success(next ? "Branch activated." : "Branch deactivated.");
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
        <Input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="City"
          className="w-32 bg-card"
        />
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
          Add branch
        </Button>
      </div>

      <BranchDialog
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

const branchSchema = z.object({
  name: z.string().min(1, "Branch name is required"),
  code: z
    .string()
    .min(1, "Code is required")
    .regex(/^[A-Z0-9_-]+$/, "Uppercase letters, numbers, _ and - only"),
  address_line_1: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().min(1, "Country is required"),
  phone: z.string().optional(),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  manager_name: z.string().optional(),
});
type BranchValues = z.infer<typeof branchSchema>;

function BranchDialog({
  editing,
  open,
  onOpenChange,
  onCreated,
}: {
  editing: BranchRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BranchValues>({
    resolver: zodResolver(branchSchema),
    defaultValues: {
      name: "",
      code: "",
      address_line_1: "",
      city: "",
      state: "",
      postal_code: "",
      country: "United States",
      phone: "",
      email: "",
      manager_name: "",
    },
  });
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      const e = editing as (BranchRow & { address_line_1?: string; postal_code?: string }) | null;
      reset({
        name: e?.name ?? "",
        code: e?.code ?? "",
        address_line_1: e?.address_line_1 ?? "",
        city: e?.city ?? "",
        state: e?.state ?? "",
        postal_code: e?.postal_code ?? "",
        country: e?.country ?? "United States",
        phone: e?.phone ?? "",
        email: e?.email ?? "",
        manager_name: e?.manager_name ?? "",
      });
    }
  }, [open, editing, reset]);

  const onSubmit = async (values: BranchValues) => {
    try {
      const message = editing
        ? await updateBranch(editing.id, values)
        : await createBranch({ ...values, is_active: true });
      toast.success(message);
      onOpenChange(false);
      onCreated();
    } catch (error) {
      toast.error(
        apiErrorMessage(error, `Couldn't ${editing ? "update" : "create"} the branch.`)
      );
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    setDeleting(true);
    try {
      const message = await deleteRecord("branch", editing.id);
      toast.success(message);
      setConfirmOpen(false);
      onOpenChange(false);
      onCreated();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't delete the branch."));
    } finally {
      setDeleting(false);
    }
  };

  const field = (
    id: keyof BranchValues,
    label: string,
    placeholder: string
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={`branch-${id}`}>{label}</Label>
      <Input
        id={`branch-${id}`}
        placeholder={placeholder}
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
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit branch" : "Add branch"}</DialogTitle>
          <DialogDescription>
            {editing ? `Update ${editing.name}.` : "Create a new store branch."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            {field("name", "Branch name", "Hyattsville Main Branch")}
            {field("code", "Code", "HYA001")}
          </div>
          {field("address_line_1", "Address", "1234 Baltimore Ave")}
          <div className="grid gap-3 sm:grid-cols-3">
            {field("city", "City", "Hyattsville")}
            {field("state", "State", "MD")}
            {field("postal_code", "Postal code", "20782")}
          </div>
          {field("country", "Country", "United States")}
          <div className="grid gap-3 sm:grid-cols-2">
            {field("phone", "Phone", "+1 (240) 555-0123")}
            {field("email", "Email", "branch@store.com")}
          </div>
          {field("manager_name", "Manager name", "Ammar Ali")}
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
              {editing ? "Save changes" : "Save branch"}
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
