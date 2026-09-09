"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Loader2, Plus, Search } from "lucide-react";
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
import { apiErrorMessage } from "@/lib/auth-api";
import {
  DISCOUNT_TIER_TYPES,
  DISCOUNT_TIER_TYPE_LABELS,
  createDiscountTier,
  listDiscountTiers,
  getDiscountTiersSummary,
  updateDiscountTier,
  type DiscountTierRow,
  type DiscountTiersSummary,
} from "@/lib/admin-api";

const DEFAULT_PAGE_SIZE = 20;
const EXPORT_CAP = 5000;
const STATUS_OPTIONS = ["active", "inactive"] as const;
const EMPTY_SUMMARY: DiscountTiersSummary = { total_tiers: 0, active: 0, inactive: 0 };

/** Filter controls rendered under each column header. */
const COLUMN_FILTERS: Record<string, ColumnFilterDef> = {
  name: { type: "text", placeholder: "Search names" },
  discount_type: { type: "select", options: DISCOUNT_TIER_TYPES, placeholder: "Any" },
  status: { type: "select", options: STATUS_OPTIONS, placeholder: "Any" },
};

const exportColumns = [
  { key: "name", label: "Tier", value: (r: DiscountTierRow) => r.name },
  { key: "discount_type", label: "Type", value: (r: DiscountTierRow) => DISCOUNT_TIER_TYPE_LABELS[r.discount_type] ?? r.discount_type },
  { key: "discount_value", label: "Discount", value: (r: DiscountTierRow) => r.discount_value },
  { key: "status", label: "Status", value: (r: DiscountTierRow) => (r.is_active !== false ? "Active" : "Inactive") },
  { key: "created_at", label: "Created", value: (r: DiscountTierRow) => r.created_at ?? "" },
];

/** Tier value reads as 10% or $10.00 depending on the type. */
const formatValue = (row: DiscountTierRow) => {
  const n = Number(row.discount_value ?? 0);
  if (isNaN(n)) return "—";
  return row.discount_type === "fixed_amount"
    ? n.toLocaleString("en-US", { style: "currency", currency: "USD" })
    : `${n}%`;
};

export default function DiscountTiersPage() {
  const [rows, setRows] = React.useState<DiscountTierRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(0);
  const [pageSize, setPageSize] = React.useState<number>(DEFAULT_PAGE_SIZE);
  const [pageCount, setPageCount] = React.useState(1);
  const [total, setTotal] = React.useState(0);

  const [selected, setSelected] = React.useState<DiscountTierRow[]>([]);
  const [clearKey, setClearKey] = React.useState(0);
  const [summary, setSummary] = React.useState<DiscountTiersSummary>(EMPTY_SUMMARY);
  const [summaryLoading, setSummaryLoading] = React.useState(true);

  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [types, setTypes] = React.useState<string[]>([]);
  const [statuses, setStatuses] = React.useState<string[]>([]);
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<DiscountTierRow | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  React.useEffect(() => {
    setPage(0);
  }, [debounced, types, statuses, dateRange]);

  const activeFilters = React.useMemo(
    () => ({
      dateRange,
      name: debounced ? { contains: debounced } : undefined,
      discount_type: types.length ? types : undefined,
      is_active: statuses.length === 1 ? statuses[0] === "active" : undefined,
    }),
    [dateRange, debounced, types, statuses]
  );

  /**
   * The header filter row edits the same state as the filter bar above it,
   * so a pick in one shows up in the other instead of silently competing.
   */
  const columnFilterValues = React.useMemo(() => {
    const values: Record<string, string[]> = {};
    if (search) values.name = [search];
    if (types.length) values.discount_type = types;
    if (statuses.length) values.status = statuses;
    return values;
  }, [search, types, statuses]);

  const applyColumnFilters = React.useCallback(
    (next: Record<string, string[]>) => {
      setSearch(next.name?.[0] ?? "");
      setTypes(next.discount_type ?? []);
      setStatuses(next.status ?? []);
    },
    []
  );

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listDiscountTiers({
      page: page + 1,
      limit: pageSize,
      dateRange: activeFilters.dateRange,
      filters: { name: activeFilters.name, discount_type: activeFilters.discount_type, is_active: activeFilters.is_active },
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
        toast.error(apiErrorMessage(error, "Couldn't load discount tiers."));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, activeFilters, refreshKey]);

  React.useEffect(() => {
    let cancelled = false;
    setSummaryLoading(true);
    getDiscountTiersSummary(activeFilters)
      .then((s) => !cancelled && setSummary(s))
      .catch(() => !cancelled && setSummary(EMPTY_SUMMARY))
      .finally(() => !cancelled && setSummaryLoading(false));
    return () => { cancelled = true; };
  }, [activeFilters]);

  const fetchAllForExport = async () =>
    (
              await listDiscountTiers({
                page: 1, limit: EXPORT_CAP, dateRange: activeFilters.dateRange,
                filters: { name: activeFilters.name, discount_type: activeFilters.discount_type, is_active: activeFilters.is_active },
              })
            ).rows;

  // There is no common/update-status table for tiers, so the toggle updates
  // the record itself.
  const handleToggle = React.useCallback(
    async (row: DiscountTierRow, next: boolean) => {
      try {
        toast.success(await updateDiscountTier(row.id, { is_active: next }));
        setRefreshKey((k) => k + 1);
      } catch (error) {
        toast.error(apiErrorMessage(error, "Couldn't update the tier."));
      }
    },
    []
  );

  const columns = React.useMemo<ColumnDef<DiscountTierRow>[]>(
    () => [
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
        accessorKey: "name",
        header: "Tier",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name}</span>
        ),
      },
      {
        accessorKey: "discount_type",
        header: "Type",
        cell: ({ row }) => (
          <StatusBadge
            status={
              DISCOUNT_TIER_TYPE_LABELS[row.original.discount_type] ??
              row.original.discount_type
            }
            tone="info"
          />
        ),
      },
      {
        accessorKey: "discount_value",
        header: () => <div className="text-right">Discount</div>,
        cell: ({ row }) => (
          <div className="text-right font-medium tabular-nums">
            {formatValue(row.original)}
          </div>
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => (
          <StatusToggle
            isActive={row.original.is_active !== false}
            onToggle={(next) => handleToggle(row.original, next)}
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
    ],
    [handleToggle]
  );

  const tiles: SummaryTile[] = [
    { label: "Total tiers", value: summary.total_tiers.toLocaleString("en-US") },
    { label: "Active", value: summary.active.toLocaleString("en-US") },
    { label: "Inactive", value: summary.inactive.toLocaleString("en-US") },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Discount tiers</h1>
          <p className="text-sm text-muted-foreground">
            Standing discounts you attach to a customer — wholesale, trade, staff.
          </p>
        </div>
        <div className="flex gap-2">
          <ExportMenu
            filename="discount-tiers"
            columns={exportColumns}
            fetchAll={fetchAllForExport}
            total={total}
            noun="tier"
          />
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4" />
            Add tier
          </Button>
        </div>
      </div>

      <SummaryStatStrip tiles={tiles} loading={summaryLoading} />

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
        <MultiSelectFilter label="Type" options={DISCOUNT_TIER_TYPES} value={types} onChange={setTypes} />
        <MultiSelectFilter label="Status" options={STATUS_OPTIONS} value={statuses} onChange={setStatuses} />
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-3 py-2">
          <span className="text-sm font-medium">
            {selected.length} tier{selected.length === 1 ? "" : "s"} selected
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

      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        onSelectionChange={setSelected}
        clearSelectionKey={clearKey}
        onRowClick={(row) => {
          setEditing(row);
          setDialogOpen(true);
        }}
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

      <TierDialog
        editing={editing}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}

// ─── Dialog ───────────────────────────────────────────────────────────────────

function TierDialog({
  editing,
  open,
  onOpenChange,
  onSaved,
}: {
  editing: DiscountTierRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [name, setName] = React.useState("");
  const [type, setType] = React.useState<string>("percentage");
  const [value, setValue] = React.useState("");
  const [active, setActive] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setType(editing?.discount_type ?? "percentage");
    setValue(editing != null ? String(editing.discount_value ?? "") : "");
    setActive(editing?.is_active !== false);
  }, [open, editing]);

  const num = Number(value);
  const problem = !name.trim()
    ? "Enter a name."
    : !value.trim() || isNaN(num) || num <= 0
      ? "Enter a discount greater than 0."
      : type === "percentage" && num > 100
        ? "A percentage can't be over 100."
        : null;

  const submit = async () => {
    if (problem) return;
    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        discount_type: type,
        discount_value: num,
        is_active: active,
      };
      const message = editing
        ? await updateDiscountTier(editing.id, body)
        : await createDiscountTier(body);
      toast.success(message);
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(
        apiErrorMessage(error, `Couldn't ${editing ? "update" : "create"} the tier.`)
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit tier" : "Add discount tier"}</DialogTitle>
          <DialogDescription>
            {editing
              ? `Update "${editing.name}".`
              : "Customers on this tier get the discount automatically."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tier-name">Name</Label>
            <Input
              id="tier-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Wholesale"
              autoFocus
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Discount type</Label>
              <Select
                items={DISCOUNT_TIER_TYPE_LABELS}
                value={type}
                onValueChange={(v) => setType(v as string)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DISCOUNT_TIER_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {DISCOUNT_TIER_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tier-value">
                {type === "percentage" ? "Percentage" : "Amount"}
              </Label>
              <div className="flex items-center gap-1.5">
                {type === "fixed_amount" && (
                  <span className="text-sm text-muted-foreground">$</span>
                )}
                <Input
                  id="tier-value"
                  type="number"
                  min={0}
                  max={type === "percentage" ? 100 : undefined}
                  step="0.01"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="tabular-nums"
                />
                {type === "percentage" && (
                  <span className="text-sm text-muted-foreground">%</span>
                )}
              </div>
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-input px-3 py-2 text-sm">
            <input
              type="checkbox"
              className="accent-primary"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            Active
          </label>

          {problem && <p className="text-sm text-muted-foreground">{problem}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || !!problem}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {editing ? "Save changes" : "Add tier"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
