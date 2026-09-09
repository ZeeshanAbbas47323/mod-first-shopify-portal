"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { CheckCircle2, Loader2, Plus, Search, Tag, Trash2, XCircle } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MultiSelectFilter } from "@/components/multi-select-filter";
import { SummaryStatStrip, type SummaryTile } from "@/components/summary-stat-strip";
import { DataTable, type ColumnFilterDef } from "@/components/data-table";
import { ExportMenu } from "@/components/export-menu";
import { DateRangePicker } from "@/components/date-range-picker";
import { StatusBadge, StatusToggle } from "@/components/status-badge";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { apiErrorMessage } from "@/lib/auth-api";
import { usePermissions } from "@/stores/menu-store";
import { parseServerDate, toLocalDateInput } from "@/lib/utils";
import {
  COUPON_TYPES,
  COUPON_STATUSES,
  listCoupons,
  getCouponsSummary,
  createCoupon,
  updateCoupon,
  deleteRecord,
  updateRecordStatus,
  validateCoupon,
  type CouponRow,
  type CouponType,
  type CouponsSummary,
} from "@/lib/admin-api";

const DEFAULT_PAGE_SIZE = 15;
const EXPORT_CAP = 5000;

const EMPTY_SUMMARY: CouponsSummary = { total_coupons: 0, active: 0, expired: 0, total_redemptions: 0 };

const typeLabel: Record<CouponType, string> = {
  percentage: "Percentage",
  fixed_amount: "Fixed amount",
  free_shipping: "Free shipping",
};

// Status tones now live in the shared toneMap (src/components/status-badge.tsx).

/** Filter controls rendered under each column header. */
const COLUMN_FILTERS: Record<string, ColumnFilterDef> = {
  code: { type: "text", placeholder: "Search codes" },
  type: { type: "select", options: COUPON_TYPES, placeholder: "Any" },
  status: { type: "select", options: COUPON_STATUSES, placeholder: "Any" },
};

const exportColumns = [
  { key: "code", label: "Code", value: (r: CouponRow) => r.code },
  { key: "type", label: "Type", value: (r: CouponRow) => typeLabel[r.type] ?? r.type },
  { key: "value", label: "Value", value: (r: CouponRow) => (r.type === "free_shipping" ? "" : r.value) },
  { key: "min_order_amount", label: "Min order", value: (r: CouponRow) => r.min_order_amount ?? "" },
  { key: "used_count", label: "Used", value: (r: CouponRow) => r.used_count ?? 0 },
  { key: "usage_limit", label: "Usage limit", value: (r: CouponRow) => r.usage_limit ?? "" },
  { key: "start_date", label: "Start date", value: (r: CouponRow) => r.start_date ?? "" },
  { key: "end_date", label: "End date", value: (r: CouponRow) => r.end_date ?? "" },
  { key: "status", label: "Status", value: (r: CouponRow) => r.status ?? "" },
  { key: "is_active", label: "Enabled", value: (r: CouponRow) => (r.is_active !== false ? "Yes" : "No") },
];

function getColumns(
  onToggleStatus: (row: CouponRow, next: boolean) => Promise<void>
): ColumnDef<CouponRow>[] {
  return [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
        onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(v) => row.toggleSelected(!!v)}
        onClick={(e) => e.stopPropagation()}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "code",
    header: "Code",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <Tag className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="font-mono font-semibold">{row.original.code}</span>
      </div>
    ),
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => (
      <span className="text-sm">{typeLabel[row.original.type] ?? row.original.type}</span>
    ),
  },
  {
    accessorKey: "value",
    header: "Value",
    cell: ({ row }) => {
      const r = row.original;
      if (r.type === "free_shipping") return <span>—</span>;
      return <span className="font-medium">{r.type === "percentage" ? `${r.value}%` : `$${r.value}`}</span>;
    },
  },
  {
    accessorKey: "min_order_amount",
    header: "Min order",
    cell: ({ row }) => {
      const v = row.original.min_order_amount;
      return v != null ? `$${v}` : "—";
    },
  },
  {
    id: "usage",
    header: "Usage",
    cell: ({ row }) => {
      const r = row.original;
      const used = r.used_count ?? 0;
      const limit = r.usage_limit;
      return <span className="text-sm">{limit ? `${used} / ${limit}` : `${used}`}</span>;
    },
  },
  {
    id: "window",
    header: "Active window",
    cell: ({ row }) => {
      const r = row.original;
      if (!r.start_date && !r.end_date) return <span className="text-muted-foreground text-sm">Always</span>;
      const f = (d?: string | null) => {
        const dt = parseServerDate(d ?? undefined);
        return dt ? format(dt, "MMM d, yyyy") : "∞";
      };
      return <span className="text-xs">{f(r.start_date)} → {f(r.end_date)}</span>;
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const s = row.original.status ?? "active";
      const label = s === "used_up" ? "Used up" : s.charAt(0).toUpperCase() + s.slice(1);
      return <StatusBadge status={label} />;
    },
  },
  {
    id: "is_active",
    header: "Enabled",
    cell: ({ row }) => (
      <StatusToggle
        isActive={row.original.is_active !== false}
        onToggle={(next) => onToggleStatus(row.original, next)}
      />
    ),
  },
  ];
}

export default function DiscountsPage() {
  const permissions = usePermissions("/discounts");
  const [rows, setRows] = React.useState<CouponRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(0);
  const [pageSize, setPageSize] = React.useState<number>(DEFAULT_PAGE_SIZE);
  const [pageCount, setPageCount] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [selected, setSelected] = React.useState<CouponRow[]>([]);
  const [clearKey, setClearKey] = React.useState(0);
  const [summary, setSummary] = React.useState<CouponsSummary>(EMPTY_SUMMARY);
  const [summaryLoading, setSummaryLoading] = React.useState(true);

  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [statuses, setStatuses] = React.useState<string[]>([]);
  const [types, setTypes] = React.useState<string[]>([]);
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<CouponRow | null>(null);
  const [validateOpen, setValidateOpen] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  React.useEffect(() => { setPage(0); }, [debounced, statuses, types, dateRange]);

  const activeFilters = React.useMemo(
    () => ({
      dateRange,
      code: debounced ? { contains: debounced } : undefined,
      status: statuses.length ? statuses : undefined,
      type: types.length ? types : undefined,
    }),
    [dateRange, debounced, statuses, types]
  );

  /**
   * The header filter row edits the same state as the filter bar above it,
   * so a pick in one shows up in the other instead of silently competing.
   */
  const columnFilterValues = React.useMemo(() => {
    const values: Record<string, string[]> = {};
    if (search) values.code = [search];
    if (types.length) values.type = types;
    if (statuses.length) values.status = statuses;
    return values;
  }, [search, types, statuses]);

  const applyColumnFilters = React.useCallback(
    (next: Record<string, string[]>) => {
      setSearch(next.code?.[0] ?? "");
      setTypes(next.type ?? []);
      setStatuses(next.status ?? []);
    },
    []
  );

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listCoupons({
      page: page + 1,
      limit: pageSize,
      dateRange: activeFilters.dateRange,
      filters: { code: activeFilters.code, status: activeFilters.status, type: activeFilters.type },
    })
      .then((res) => {
        if (cancelled) return;
        setRows(res.rows); setTotal(res.total); setPageCount(res.totalPages);
      })
      .catch((err) => {
        if (cancelled) return;
        setRows([]);
        toast.error(apiErrorMessage(err, "Couldn't load coupons."));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [page, pageSize, activeFilters, refreshKey]);

  React.useEffect(() => {
    let cancelled = false;
    setSummaryLoading(true);
    getCouponsSummary(activeFilters)
      .then((s) => !cancelled && setSummary(s))
      .catch(() => !cancelled && setSummary(EMPTY_SUMMARY))
      .finally(() => !cancelled && setSummaryLoading(false));
    return () => { cancelled = true; };
  }, [activeFilters]);

  const fetchAllForExport = async () =>
    (
              await listCoupons({
                page: 1, limit: EXPORT_CAP, dateRange: activeFilters.dateRange,
                filters: { code: activeFilters.code, status: activeFilters.status, type: activeFilters.type },
              })
            ).rows;

  const handleToggleStatus = async (row: CouponRow, next: boolean) => {
    try {
      await updateRecordStatus("coupon", row.id, next);
      toast.success(next ? "Coupon enabled." : "Coupon disabled.");
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't update status."));
    }
  };
  const columns = React.useMemo(() => getColumns(handleToggleStatus), []);

  const tiles: SummaryTile[] = [
    { label: "Total coupons", value: summary.total_coupons.toLocaleString("en-US") },
    { label: "Active", value: summary.active.toLocaleString("en-US") },
    { label: "Expired", value: summary.expired.toLocaleString("en-US") },
    { label: "Total redemptions", value: summary.total_redemptions.toLocaleString("en-US") },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Discounts</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setValidateOpen(true)}>
            <CheckCircle2 className="size-4" /> Validate code
          </Button>
          <ExportMenu
            filename="coupons"
            columns={exportColumns}
            selected={selected}
            fetchAll={fetchAllForExport}
            total={total}
            noun="coupon"
          />
          {permissions.can_create && (
            <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
              <Plus className="size-4" /> Create coupon
            </Button>
          )}
        </div>
      </div>

      <SummaryStatStrip tiles={tiles} loading={summaryLoading} />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-44 flex-1 sm:max-w-56">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by code" className="bg-card pl-8" />
        </div>
        <MultiSelectFilter label="Type" options={COUPON_TYPES} value={types} onChange={setTypes} />
        <MultiSelectFilter label="Status" options={COUPON_STATUSES} value={statuses} onChange={setStatuses} />
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-3 py-2">
          <span className="text-sm font-medium">
            {selected.length} coupon{selected.length === 1 ? "" : "s"} selected
          </span>
          <button
            type="button"
            onClick={() => setClearKey((k) => k + 1)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear selection
          </button>
        </div>
      )}

      <CouponDialog
        editing={editing} open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />

      <ValidateCouponDialog open={validateOpen} onOpenChange={setValidateOpen} />

      <DataTable
        columns={columns} data={rows} loading={loading}
        onSelectionChange={setSelected}
        clearSelectionKey={clearKey}
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

const couponSchema = z.object({
  code: z.string().min(1, "Code is required").regex(/^[A-Z0-9_-]+$/, "Uppercase letters, numbers, dashes and underscores only"),
  type: z.enum(COUPON_TYPES),
  // `value` is only required for percentage / fixed_amount; free_shipping ignores it.
  // A cleared input yields NaN under valueAsNumber — coerce that to undefined here
  // and only enforce a number on the non-free-shipping branches via superRefine below.
  value: z.union([z.number(), z.nan()]).optional(),
  min_order_amount: z.number().nonnegative().optional(),
  usage_limit: z.number().int().positive().optional(),
  per_user_limit: z.number().int().positive().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  status: z.enum(COUPON_STATUSES),
  is_active: z.boolean(),
}).superRefine((data, ctx) => {
  if (data.type === "free_shipping") return;
  const v = data.value;
  if (v === undefined || v === null || Number.isNaN(v)) {
    ctx.addIssue({ code: "custom", path: ["value"], message: "Value is required" });
    return;
  }
  if (v < 0) {
    ctx.addIssue({ code: "custom", path: ["value"], message: "Must be 0 or more" });
  }
  if (data.type === "percentage" && v > 100) {
    ctx.addIssue({ code: "custom", path: ["value"], message: "Percentage must be 100 or less" });
  }
});
type CouponValues = z.infer<typeof couponSchema>;

const numOrUndefined = (v: unknown) =>
  v === "" || v === null || v === undefined || Number.isNaN(v as number) ? undefined : Number(v);

function CouponDialog({
  editing, open, onOpenChange, onSaved,
}: {
  editing: CouponRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const { register, handleSubmit, control, reset, watch, formState: { errors, isSubmitting } } =
    useForm<CouponValues>({
      resolver: zodResolver(couponSchema),
      defaultValues: {
        code: "", type: "percentage", value: 0,
        min_order_amount: undefined, usage_limit: undefined, per_user_limit: undefined,
        start_date: "", end_date: "",
        status: "active", is_active: true,
      },
    });

  React.useEffect(() => {
    if (open) reset({
      code: editing?.code ?? "",
      type: editing?.type ?? "percentage",
      value: editing?.value ?? 0,
      min_order_amount: editing?.min_order_amount ?? undefined,
      usage_limit: editing?.usage_limit ?? undefined,
      per_user_limit: editing?.per_user_limit ?? undefined,
      start_date: toLocalDateInput(editing?.start_date ?? undefined),
      end_date: toLocalDateInput(editing?.end_date ?? undefined),
      status: editing?.status ?? "active",
      is_active: editing?.is_active ?? true,
    });
  }, [open, editing, reset]);

  const currentType = watch("type");
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const handleDelete = async () => {
    if (!editing) return;
    setDeleting(true);
    try {
      const msg = await deleteRecord("coupon", editing.id);
      toast.success(msg);
      setConfirmOpen(false);
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't delete coupon."));
    } finally {
      setDeleting(false);
    }
  };

  const onSubmit = async (values: CouponValues) => {
    const body: Partial<CouponRow> = {
      code: values.code.toUpperCase(),
      type: values.type,
      value: values.type === "free_shipping" ? 0 : (values.value ?? 0),
      min_order_amount: values.min_order_amount,
      usage_limit: values.usage_limit,
      per_user_limit: values.per_user_limit,
      start_date: values.start_date || undefined,
      end_date: values.end_date || undefined,
      status: values.status,
      is_active: values.is_active,
    };
    try {
      const msg = editing ? await updateCoupon(editing.id, body) : await createCoupon(body);
      toast.success(msg);
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(apiErrorMessage(err, `Couldn't ${editing ? "update" : "create"} coupon.`));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit coupon" : "Create coupon"}</DialogTitle>
          <DialogDescription>
            {editing ? `Update "${editing.code}"` : "Create a new discount coupon."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="coupon-code">Code *</Label>
              <Input id="coupon-code" placeholder="SUMMER25" className="font-mono uppercase"
                aria-invalid={!!errors.code} {...register("code")} />
              {errors.code && <p className="text-sm text-destructive">{errors.code.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Type *</Label>
              <Controller control={control} name="type" render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage off</SelectItem>
                    <SelectItem value="fixed_amount">Fixed amount off</SelectItem>
                    <SelectItem value="free_shipping">Free shipping</SelectItem>
                  </SelectContent>
                </Select>
              )} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="coupon-value">
                {currentType === "percentage" ? "Percent (%)" : currentType === "fixed_amount" ? "Amount ($)" : "Value"}
                {currentType !== "free_shipping" && " *"}
              </Label>
              <Input id="coupon-value" type="number" step="0.01" min="0"
                disabled={currentType === "free_shipping"}
                aria-invalid={!!errors.value}
                {...register("value", { setValueAs: numOrUndefined })} />
              {errors.value && <p className="text-sm text-destructive">{errors.value.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="coupon-min">Min order amount ($)</Label>
              <Input id="coupon-min" type="number" step="0.01" min="0" placeholder="e.g. 50"
                {...register("min_order_amount", { setValueAs: numOrUndefined })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="coupon-usage">Total usage limit</Label>
              <Input id="coupon-usage" type="number" min="1" placeholder="e.g. 100"
                {...register("usage_limit", { setValueAs: numOrUndefined })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="coupon-per-user">Per-user limit</Label>
              <Input id="coupon-per-user" type="number" min="1" placeholder="e.g. 1"
                {...register("per_user_limit", { setValueAs: numOrUndefined })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="coupon-start">Start date</Label>
              <Input id="coupon-start" type="date" {...register("start_date")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="coupon-end">End date</Label>
              <Input id="coupon-end" type="date" {...register("end_date")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Controller control={control} name="status" render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="used_up">Used up</SelectItem>
                  </SelectContent>
                </Select>
              )} />
            </div>
            <div className="space-y-1.5">
              <Label>&nbsp;</Label>
              <label className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-input bg-card px-3 py-2 text-sm">
                <input type="checkbox" className="accent-primary" {...register("is_active")} />
                Enabled
              </label>
            </div>
          </div>

          <DialogFooter className="gap-2">
            {editing && (
              <Button type="button" variant="destructive" className="mr-auto" onClick={() => setConfirmOpen(true)}>
                <Trash2 className="size-4" />
                Delete
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {editing ? "Save changes" : "Create coupon"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        loading={deleting}
        onConfirm={handleDelete}
        title={`Delete "${editing?.code}"?`}
        description="This can't be undone."
      />
    </Dialog>
  );
}

// ─── Validate Coupon Dialog ──────────────────────────────────────────────────

const validateSchema = z.object({
  code: z.string().min(1, "Code is required"),
  order_amount: z.number({ error: "Amount is required" }).positive(),
  user_id: z.number().int().positive().optional(),
});
type ValidateValues = z.infer<typeof validateSchema>;

function ValidateCouponDialog({
  open, onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<ValidateValues>({
      resolver: zodResolver(validateSchema),
      defaultValues: { code: "", order_amount: 0, user_id: undefined },
    });

  const [result, setResult] = React.useState<{ ok: boolean; data?: unknown; error?: string } | null>(null);

  React.useEffect(() => {
    if (open) { reset({ code: "", order_amount: 0, user_id: undefined }); setResult(null); }
  }, [open, reset]);

  const onSubmit = async (values: ValidateValues) => {
    setResult(null);
    try {
      const res = await validateCoupon({
        code: values.code.toUpperCase(),
        order_amount: values.order_amount,
        user_id: values.user_id,
      });
      setResult({ ok: true, data: res });
    } catch (err) {
      setResult({ ok: false, error: apiErrorMessage(err, "Coupon is not valid.") });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Validate coupon</DialogTitle>
          <DialogDescription>Check whether a coupon applies to a given order.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="val-code">Code *</Label>
            <Input id="val-code" placeholder="SUMMER25" className="font-mono uppercase"
              aria-invalid={!!errors.code} {...register("code")} />
            {errors.code && <p className="text-sm text-destructive">{errors.code.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="val-amount">Order amount ($) *</Label>
            <Input id="val-amount" type="number" step="0.01" min="0" placeholder="120.50"
              aria-invalid={!!errors.order_amount}
              {...register("order_amount", { valueAsNumber: true })} />
            {errors.order_amount && <p className="text-sm text-destructive">{errors.order_amount.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="val-user">User ID</Label>
            <Input id="val-user" type="number" min="1" placeholder="Optional"
              {...register("user_id", { setValueAs: numOrUndefined })} />
          </div>

          {result && (
            <div className={`rounded-lg border p-3 text-sm ${result.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-destructive/40 bg-destructive/10 text-destructive"}`}>
              <div className="flex items-center gap-1.5 font-medium">
                {result.ok ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
                {result.ok ? "Coupon is valid" : "Not valid"}
              </div>
              {result.ok && result.data != null && (
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-emerald-900/80">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              )}
              {!result.ok && result.error && (
                <p className="mt-1 text-xs">{result.error}</p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              Validate
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
