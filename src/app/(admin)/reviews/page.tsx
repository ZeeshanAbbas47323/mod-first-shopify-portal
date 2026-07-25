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
import { Textarea } from "@/components/ui/textarea";
import { DataTable } from "@/components/data-table";
import { DateRangePicker } from "@/components/date-range-picker";
import { StatusBadge } from "@/components/status-badge";
import { apiErrorMessage } from "@/lib/auth-api";
import {
  REVIEW_STATUSES,
  listReviews,
  getReviewById,
  updateReview,
  type ReviewRow,
} from "@/lib/admin-api";

const PAGE_SIZE = 10;

const STATUS_FILTER_ITEMS: Record<string, string> = {
  all: "All statuses",
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
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
  const [pageCount, setPageCount] = React.useState(1);
  const [total, setTotal] = React.useState(0);

  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("all");
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
  }, [debounced, status, dateRange]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listReviews({
      page: page + 1,
      limit: PAGE_SIZE,
      dateRange,
      filters: {
        title: debounced || undefined,
        status: status === "all" ? undefined : status,
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
        toast.error(apiErrorMessage(error, "Couldn't load reviews."));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, debounced, status, dateRange, refreshKey]);

  const openReview = async (row: ReviewRow) => {
    setEditing(row);
    setDialogOpen(true);
    try {
      const full = await getReviewById(row.id);
      setEditing(full);
    } catch {
      // fall back to the row data already shown
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Reviews</h1>
      </div>

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
        <Select
          items={STATUS_FILTER_ITEMS}
          value={status}
          onValueChange={(v) => setStatus(v as string)}
        >
          <SelectTrigger className="min-w-36 bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_FILTER_ITEMS).map(([v, label]) => (
              <SelectItem key={v} value={v}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      <ReviewDialog
        editing={editing}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />

      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        onRowClick={openReview}
        serverPagination={{ pageIndex: page, pageCount, total, onPageChange: setPage }}
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
