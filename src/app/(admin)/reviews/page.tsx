"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Loader2, Search, Star, ThumbsUp } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { fetchAllPages } from "@/lib/export";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MultiSelectFilter } from "@/components/multi-select-filter";
import { SummaryStatStrip, type SummaryTile } from "@/components/summary-stat-strip";
import { Textarea } from "@/components/ui/textarea";
import { DataTable, type ColumnFilterDef } from "@/components/data-table";
import { ExportMenu } from "@/components/export-menu";
import { DateRangePicker } from "@/components/date-range-picker";
import { StatusBadge } from "@/components/status-badge";
import { apiErrorMessage } from "@/lib/auth-api";
import {
  REVIEW_STATUSES,
  listReviews,
  getReviewsSummary,
  getReviewById,
  updateReview,
  type ReviewRow,
  type ReviewsSummary,
} from "@/lib/admin-api";

const DEFAULT_PAGE_SIZE = 10;
const EXPORT_CAP = 5000;
const EMPTY_SUMMARY: ReviewsSummary = {
  total_reviews: 0, average_rating: 0,
  rating_distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  verified_reviews_count: 0, recommendation_percentage: 0,
};

const exportColumns = [
  { key: "reviewer", label: "Reviewer", value: (r: ReviewRow) => r.user?.full_name ?? (r.user_id ? `User #${r.user_id}` : "Anonymous") },
  { key: "product", label: "Product", value: (r: ReviewRow) => r.product?.name ?? (r.product_id ? `#${r.product_id}` : "") },
  { key: "rating", label: "Rating", value: (r: ReviewRow) => r.rating },
  { key: "title", label: "Title", value: (r: ReviewRow) => r.title ?? "" },
  { key: "comment", label: "Comment", value: (r: ReviewRow) => r.comment ?? "" },
  { key: "status", label: "Status", value: (r: ReviewRow) => r.status ?? "" },
  { key: "is_verified", label: "Verified", value: (r: ReviewRow) => (r.is_verified ? "Yes" : "No") },
  { key: "helpful_count", label: "Helpful", value: (r: ReviewRow) => r.helpful_count ?? 0 },
  { key: "created_at", label: "Date", value: (r: ReviewRow) => r.created_at ?? "" },
];

const COLUMN_FILTERS: Record<string, ColumnFilterDef> = {
  title: { type: "text", placeholder: "Search titles" },
  status: { type: "select", options: REVIEW_STATUSES, placeholder: "Any" },
};

const STATUS_FORM_ITEMS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

const statusTone = (s?: string) =>
  s === "approved" ? "success" : s === "rejected" ? "critical" : "warning";

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`size-3.5 ${i <= rating ? "fill-amber-400 text-amber-400" : "fill-muted text-muted-foreground/30"}`}
        />
      ))}
      <span className="ml-1 text-xs text-muted-foreground">{rating}/5</span>
    </span>
  );
}

const columns: ColumnDef<ReviewRow>[] = [
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
    id: "reviewer",
    header: "Reviewer",
    cell: ({ row }) => {
      const r = row.original;
      const name = r.user?.full_name ?? (r.user_id ? `User #${r.user_id}` : "Anonymous");
      return (
        <div className="min-w-0">
          <p className="truncate font-medium">{name}</p>
          {r.user?.email && (
            <p className="truncate text-xs text-muted-foreground">{r.user.email}</p>
          )}
        </div>
      );
    },
  },
  {
    id: "product",
    header: "Product",
    cell: ({ row }) => {
      const r = row.original;
      return (
        <span className="truncate text-sm">
          {r.product?.name ?? (r.product_id ? `#${r.product_id}` : "—")}
        </span>
      );
    },
  },
  {
    accessorKey: "rating",
    header: "Rating",
    cell: ({ row }) => <StarRating rating={row.original.rating} />,
  },
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row }) => (
      <span className="block max-w-48 truncate">{row.original.title || "—"}</span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const s = row.original.status ?? "pending";
      return (
        <StatusBadge
          status={s.charAt(0).toUpperCase() + s.slice(1)}
          tone={statusTone(s)}
        />
      );
    },
  },
  {
    accessorKey: "is_verified",
    header: "Verified",
    cell: ({ row }) =>
      row.original.is_verified ? (
        <StatusBadge status="Verified" tone="success" />
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      ),
  },
  {
    accessorKey: "helpful_count",
    header: "Helpful",
    cell: ({ row }) => (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <ThumbsUp className="size-3" />
        {row.original.helpful_count ?? 0}
      </span>
    ),
  },
  {
    accessorKey: "created_at",
    header: "Date",
    cell: ({ row }) => {
      const d = row.original.created_at;
      if (!d) return "—";
      const date = new Date(d);
      return isNaN(date.getTime()) ? "—" : format(date, "MMM d, yyyy");
    },
  },
];

export default function ReviewsPage() {
  const [rows, setRows] = React.useState<ReviewRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(0);
  const [pageSize, setPageSize] = React.useState<number>(DEFAULT_PAGE_SIZE);
  const [pageCount, setPageCount] = React.useState(1);
  const [total, setTotal] = React.useState(0);

  const [selected, setSelected] = React.useState<ReviewRow[]>([]);
  const [clearKey, setClearKey] = React.useState(0);
  const [summary, setSummary] = React.useState<ReviewsSummary>(EMPTY_SUMMARY);
  const [summaryLoading, setSummaryLoading] = React.useState(true);

  const [search, setSearch] = React.useState("");
  const [statuses, setStatuses] = React.useState<string[]>([]);
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ReviewRow | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);

  const [debounced, setDebounced] = React.useState("");
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  React.useEffect(() => {
    setPage(0);
  }, [debounced, statuses, dateRange]);

  const activeFilters = React.useMemo(
    () => ({
      dateRange,
      title: debounced ? { contains: debounced } : undefined,
      status: statuses.length ? statuses : undefined,
    }),
    [dateRange, debounced, statuses]
  );

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listReviews({
      page: page + 1,
      limit: pageSize,
      dateRange: activeFilters.dateRange,
      filters: { title: activeFilters.title, status: activeFilters.status },
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
        toast.error(apiErrorMessage(error, "Couldn't load reviews."));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, activeFilters, refreshKey]);

  React.useEffect(() => {
    let cancelled = false;
    setSummaryLoading(true);
    getReviewsSummary(activeFilters)
      .then((s) => !cancelled && setSummary(s))
      .catch(() => !cancelled && setSummary(EMPTY_SUMMARY))
      .finally(() => !cancelled && setSummaryLoading(false));
    return () => { cancelled = true; };
  }, [activeFilters]);

  const fetchAllForExport = async () =>
    fetchAllPages((page, limit) => listReviews({
                page, limit, dateRange: activeFilters.dateRange,
                filters: { title: activeFilters.title, status: activeFilters.status },
              }), EXPORT_CAP);

  const openReview = async (row: ReviewRow) => {
    setEditing(row);
    setDialogOpen(true);
    try {
      const full = await getReviewById(row.id);
      setEditing(full);
    } catch {
    }
  };

  const tiles: SummaryTile[] = [
    { label: "Total reviews", value: summary.total_reviews.toLocaleString("en-US") },
    { label: "Average rating", value: `${summary.average_rating.toFixed(1)} / 5` },
    { label: "Verified", value: summary.verified_reviews_count.toLocaleString("en-US") },
    { label: "Recommend", value: `${summary.recommendation_percentage.toFixed(0)}%` },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Reviews</h1>
        <ExportMenu
          filename="reviews"
          columns={exportColumns}
          selected={selected}
          fetchAll={fetchAllForExport}
          total={total}
          noun="review"
        />
      </div>

      <SummaryStatStrip tiles={tiles} loading={summaryLoading} />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-44 flex-1 sm:max-w-56">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title"
            className="bg-card pl-8"
          />
        </div>
        <MultiSelectFilter label="Status" options={REVIEW_STATUSES} value={statuses} onChange={setStatuses} />
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-3 py-2">
          <span className="text-sm font-medium">
            {selected.length} review{selected.length === 1 ? "" : "s"} selected
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

      <ReviewDialog
        editing={editing}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />

      <DataTable
        onRefresh={() => setRefreshKey((k) => k + 1)}
        columns={columns}
        data={rows}
        loading={loading}
        onSelectionChange={setSelected}
        clearSelectionKey={clearKey}
        onRowClick={openReview}
        columnFilterDefs={COLUMN_FILTERS}
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

const reviewSchema = z.object({
  rating: z.number({ error: "Rating required" }).int().min(1).max(5),
  title: z.string().optional(),
  comment: z.string().optional(),
  status: z.enum(REVIEW_STATUSES),
  is_verified: z.boolean(),
  helpful_count: z.number().int().min(0).optional(),
});
type ReviewValues = z.infer<typeof reviewSchema>;

function StarPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [hovered, setHovered] = React.useState(0);
  return (
    <span className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(i)}
          className="cursor-pointer"
        >
          <Star
            className={`size-6 transition-colors ${
              i <= (hovered || value)
                ? "fill-amber-400 text-amber-400"
                : "fill-muted text-muted-foreground/30"
            }`}
          />
        </button>
      ))}
    </span>
  );
}

function ReviewDialog({
  editing,
  open,
  onOpenChange,
  onSaved,
}: {
  editing: ReviewRow | null;
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
  } = useForm<ReviewValues>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      rating: 5,
      title: "",
      comment: "",
      status: "pending",
      is_verified: false,
      helpful_count: 0,
    },
  });

  React.useEffect(() => {
    if (open && editing) {
      reset({
        rating: editing.rating ?? 5,
        title: editing.title ?? "",
        comment: editing.comment ?? "",
        status: editing.status ?? "pending",
        is_verified: editing.is_verified ?? false,
        helpful_count: editing.helpful_count ?? 0,
      });
    }
  }, [open, editing, reset]);

  const onSubmit = async (values: ReviewValues) => {
    if (!editing) return;
    try {
      const body = {
        rating: values.rating,
        title: values.title || undefined,
        comment: values.comment || undefined,
        status: values.status,
        is_verified: values.is_verified,
        helpful_count: values.helpful_count,
      };
      const message = await updateReview(editing.id, body);
      toast.success(message);
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't update the review."));
    }
  };

  if (!editing) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Moderate review</DialogTitle>
          <DialogDescription>
            {editing.user?.full_name
              ? `Review by ${editing.user.full_name}.`
              : editing.user_id
              ? `Review by user #${editing.user_id}.`
              : "Review details."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="text-sm text-muted-foreground">
            Product: {editing.product?.name ?? (editing.product_id ? `#${editing.product_id}` : "—")}
          </div>

          <div className="space-y-1.5">
            <Label>Rating</Label>
            <Controller
              control={control}
              name="rating"
              render={({ field }) => (
                <StarPicker value={field.value} onChange={field.onChange} />
              )}
            />
            {errors.rating && (
              <p className="text-sm text-destructive">{errors.rating.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rv-title">Title</Label>
            <Input id="rv-title" placeholder="Great quality!" {...register("title")} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rv-comment">Comment</Label>
            <Textarea
              id="rv-comment"
              rows={3}
              placeholder="Review content…"
              {...register("comment")}
            />
          </div>

          {editing.video_url && (
            <div className="space-y-1.5">
              <Label>Video</Label>
              <a
                href={editing.video_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block truncate text-sm text-[#005bd3] hover:underline"
              >
                {editing.video_url}
              </a>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select
                    items={STATUS_FORM_ITEMS}
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REVIEW_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {STATUS_FORM_ITEMS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rv-helpful">Helpful count</Label>
              <Input
                id="rv-helpful"
                type="number"
                min="0"
                {...register("helpful_count", { valueAsNumber: true })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-input bg-card px-3 py-2 text-sm">
              <input type="checkbox" className="accent-primary" {...register("is_verified")} />
              Mark as verified purchase
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
