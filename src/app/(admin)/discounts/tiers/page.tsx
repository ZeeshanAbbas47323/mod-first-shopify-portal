"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Loader2, Plus, Search } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/data-table";
import { DateRangePicker } from "@/components/date-range-picker";
import { StatusBadge, StatusToggle } from "@/components/status-badge";
import { apiErrorMessage } from "@/lib/auth-api";
import {
  DISCOUNT_TIER_TYPES,
  DISCOUNT_TIER_TYPE_LABELS,
  createDiscountTier,
  listDiscountTiers,
  updateDiscountTier,
  type DiscountTierRow,
} from "@/lib/admin-api";

const PAGE_SIZE = 20;

const TYPE_FILTER_ITEMS: Record<string, string> = {
  all: "All types",
  ...DISCOUNT_TIER_TYPE_LABELS,
};

const STATUS_ITEMS: Record<string, string> = {
  all: "All statuses",
  active: "Active",
  inactive: "Inactive",
};

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
  const [pageCount, setPageCount] = React.useState(1);
  const [total, setTotal] = React.useState(0);

  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [type, setType] = React.useState("all");
  const [status, setStatus] = React.useState("all");
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
  }, [debounced, type, status, dateRange]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listDiscountTiers({
      page: page + 1,
      limit: PAGE_SIZE,
      dateRange,
      filters: {
        name: debounced || undefined,
        discount_type: type === "all" ? undefined : type,
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
        toast.error(apiErrorMessage(error, "Couldn't load discount tiers."));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, debounced, type, status, dateRange, refreshKey]);

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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Discount tiers</h1>
          <p className="text-sm text-muted-foreground">
            Standing discounts you attach to a customer — wholesale, trade, staff.
          </p>
        </div>
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
        <Select items={TYPE_FILTER_ITEMS} value={type} onValueChange={(v) => setType(v as string)}>
          <SelectTrigger className="min-w-36 bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(TYPE_FILTER_ITEMS).map(([v, label]) => (
              <SelectItem key={v} value={v}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select items={STATUS_ITEMS} value={status} onValueChange={(v) => setStatus(v as string)}>
          <SelectTrigger className="min-w-32 bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_ITEMS).map(([v, label]) => (
              <SelectItem key={v} value={v}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

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
