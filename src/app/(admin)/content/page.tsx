"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Loader2, Plus, Search } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { RichTextEditor } from "@/components/ui/rich-text-editor";
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
import { MediaUpload } from "@/components/media-upload";
import { StatusBadge } from "@/components/status-badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiErrorMessage } from "@/lib/auth-api";
import {
  BLOG_STATUSES,
  createBlog,
  listBlogs,
  getBlogsSummary,
  updateBlog,
  type BlogRow,
  type BlogsSummary,
} from "@/lib/admin-api";
import { FooterSectionsTab } from "@/components/content/footer-sections-tab";
import { PopupsTab } from "@/components/content/popups-tab";

const DEFAULT_PAGE_SIZE = 10;
const EXPORT_CAP = 5000;
const EMPTY_SUMMARY: BlogsSummary = { total_posts: 0, published: 0, draft: 0, archived: 0 };

const COLUMN_FILTERS: Record<string, ColumnFilterDef> = {
  title: { type: "text", placeholder: "Search titles" },
  category: { type: "text", placeholder: "Category" },
  status: { type: "select", options: BLOG_STATUSES, placeholder: "Any" },
};

const exportColumns = [
  { key: "title", label: "Post", value: (r: BlogRow) => r.title },
  { key: "slug", label: "Slug", value: (r: BlogRow) => r.slug },
  { key: "category", label: "Category", value: (r: BlogRow) => r.category ?? "" },
  { key: "tags", label: "Tags", value: (r: BlogRow) => r.tags ?? "" },
  { key: "status", label: "Status", value: (r: BlogRow) => r.status ?? "" },
  { key: "published_at", label: "Published", value: (r: BlogRow) => r.published_at ?? "" },
  { key: "created_at", label: "Created", value: (r: BlogRow) => r.created_at ?? "" },
];

const STATUS_FORM_ITEMS: Record<string, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

const statusTone = (s?: string) =>
  s === "published" ? "success" : s === "draft" ? "info" : "neutral";

const columns: ColumnDef<BlogRow>[] = [
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
    accessorKey: "title",
    header: "Post",
    cell: ({ row }) => (
      <div className="min-w-0 max-w-72">
        <p className="truncate font-medium">{row.original.title}</p>
        <p className="truncate font-mono text-xs text-muted-foreground">
          /{row.original.slug}
        </p>
      </div>
    ),
  },
  {
    accessorKey: "category",
    header: "Category",
    cell: ({ row }) => row.original.category || "—",
  },
  {
    accessorKey: "tags",
    header: "Tags",
    cell: ({ row }) => (
      <span className="block max-w-40 truncate text-xs text-muted-foreground">
        {row.original.tags || "—"}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const s = row.original.status ?? "draft";
      return (
        <StatusBadge
          status={s.charAt(0).toUpperCase() + s.slice(1)}
          tone={statusTone(s)}
        />
      );
    },
  },
  {
    accessorKey: "published_at",
    header: "Published",
    cell: ({ row }) => {
      const d = row.original.published_at;
      if (!d) return "—";
      const date = new Date(d);
      return isNaN(date.getTime()) ? "—" : format(date, "MMM d, yyyy");
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

export default function ContentPage() {
  const [activeTab, setActiveTab] = React.useState<"blogs" | "footer" | "popups">("blogs");
  const [rows, setRows] = React.useState<BlogRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(0);
  const [pageSize, setPageSize] = React.useState<number>(DEFAULT_PAGE_SIZE);
  const [pageCount, setPageCount] = React.useState(1);
  const [total, setTotal] = React.useState(0);

  const [selected, setSelected] = React.useState<BlogRow[]>([]);
  const [clearKey, setClearKey] = React.useState(0);
  const [summary, setSummary] = React.useState<BlogsSummary>(EMPTY_SUMMARY);
  const [summaryLoading, setSummaryLoading] = React.useState(true);

  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [statuses, setStatuses] = React.useState<string[]>([]);
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<BlogRow | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);

  const [debounced, setDebounced] = React.useState({ search: "", category: "" });
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced({ search, category }), 400);
    return () => clearTimeout(t);
  }, [search, category]);

  React.useEffect(() => {
    setPage(0);
  }, [debounced, statuses, dateRange]);

  const activeFilters = React.useMemo(
    () => ({
      dateRange,
      title: debounced.search ? { contains: debounced.search } : undefined,
      category: debounced.category ? { contains: debounced.category } : undefined,
      status: statuses.length ? statuses : undefined,
    }),
    [dateRange, debounced, statuses]
  );

  const columnFilterValues = React.useMemo(() => {
    const values: Record<string, string[]> = {};
    if (search) values.title = [search];
    if (category) values.category = [category];
    if (statuses.length) values.status = statuses;
    return values;
  }, [search, category, statuses]);

  const applyColumnFilters = React.useCallback(
    (next: Record<string, string[]>) => {
      setSearch(next.title?.[0] ?? "");
      setCategory(next.category?.[0] ?? "");
      setStatuses(next.status ?? []);
    },
    []
  );

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listBlogs({
      page: page + 1,
      limit: pageSize,
      dateRange: activeFilters.dateRange,
      filters: { title: activeFilters.title, category: activeFilters.category, status: activeFilters.status },
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
        toast.error(apiErrorMessage(error, "Couldn't load blog posts."));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, activeFilters, refreshKey]);

  React.useEffect(() => {
    if (activeTab !== "blogs") return;
    let cancelled = false;
    setSummaryLoading(true);
    getBlogsSummary(activeFilters)
      .then((s) => !cancelled && setSummary(s))
      .catch(() => !cancelled && setSummary(EMPTY_SUMMARY))
      .finally(() => !cancelled && setSummaryLoading(false));
    return () => { cancelled = true; };
  }, [activeTab, activeFilters]);

  const fetchAllForExport = async () =>
    (
              await listBlogs({
                page: 1, limit: EXPORT_CAP, dateRange: activeFilters.dateRange,
                filters: { title: activeFilters.title, category: activeFilters.category, status: activeFilters.status },
              })
            ).rows;

  const tiles: SummaryTile[] = [
    { label: "Total posts", value: summary.total_posts.toLocaleString("en-US") },
    { label: "Published", value: summary.published.toLocaleString("en-US") },
    { label: "Draft", value: summary.draft.toLocaleString("en-US") },
    { label: "Archived", value: summary.archived.toLocaleString("en-US") },
  ];

  return (
    <div className="flex flex-col gap-4">
      {}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Content</h1>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "blogs" | "footer" | "popups")}>
          <TabsList>
            <TabsTrigger value="blogs">Blog posts</TabsTrigger>
            <TabsTrigger value="footer">Footer sections</TabsTrigger>
            <TabsTrigger value="popups">Popups</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {}
      {activeTab === "footer" && <FooterSectionsTab />}

      {}
      {activeTab === "popups" && <PopupsTab />}

      {}
      {activeTab === "blogs" && <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div />
        <div className="flex gap-2">
          <ExportMenu
            filename="blog-posts"
            columns={exportColumns}
          selected={selected}
            fetchAll={fetchAllForExport}
            total={total}
            noun="post"
          />
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4" />
            Add blog post
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
            placeholder="Search by title"
            className="bg-card pl-8"
          />
        </div>
        <Input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Category"
          className="w-36 bg-card"
        />
        <MultiSelectFilter label="Status" options={BLOG_STATUSES} value={statuses} onChange={setStatuses} />
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-3 py-2">
          <span className="text-sm font-medium">
            {selected.length} post{selected.length === 1 ? "" : "s"} selected
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

      <BlogDialog
        editing={editing}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />

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
      </>}
    </div>
  );
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const blogSchema = z.object({
  title: z.string().min(1, "Title is required"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and dashes"),
  excerpt: z.string().optional(),
  content: z
    .string()
    .refine(
      (v) => v.replace(/<[^>]*>/g, "").trim().length > 0,
      "Content is required"
    ),
  featured_image: z.string().nullable().optional(),
  category: z.string().optional(),
  tags: z.string().optional(),
  status: z.enum(BLOG_STATUSES),
  meta_title: z.string().optional(),
  meta_description: z.string().optional(),
});
type BlogValues = z.infer<typeof blogSchema>;

function BlogDialog({
  editing,
  open,
  onOpenChange,
  onSaved,
}: {
  editing: BlogRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    getFieldState,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<BlogValues>({
    resolver: zodResolver(blogSchema),
    defaultValues: {
      title: "",
      slug: "",
      excerpt: "",
      content: "",
      featured_image: null,
      category: "",
      tags: "",
      status: "draft",
      meta_title: "",
      meta_description: "",
    },
  });

  React.useEffect(() => {
    if (open) {
      reset({
        title: editing?.title ?? "",
        slug: editing?.slug ?? "",
        excerpt: editing?.excerpt ?? "",
        content: editing?.content ?? "",
        featured_image: editing?.featured_image ?? null,
        category: editing?.category ?? "",
        tags: editing?.tags ?? "",
        status: editing?.status ?? "draft",
        meta_title: editing?.meta_title ?? "",
        meta_description: editing?.meta_description ?? "",
      });
    }
  }, [open, editing, reset]);

  const title = watch("title");
  React.useEffect(() => {
    if (!editing && !getFieldState("slug").isDirty) {
      setValue("slug", slugify(title));
    }
  }, [title, editing, getFieldState, setValue]);

  const onSubmit = async (values: BlogValues) => {
    const body = {
      ...values,
      featured_image: values.featured_image || undefined,
      is_active: true,
    };
    try {
      const message = editing
        ? await updateBlog(editing.id, body)
        : await createBlog(body);
      toast.success(message);
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(
        apiErrorMessage(
          error,
          `Couldn't ${editing ? "update" : "create"} the blog post.`
        )
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit blog post" : "Add blog post"}</DialogTitle>
          <DialogDescription>
            {editing
              ? `Update "${editing.title}".`
              : "Write and publish a new blog post."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="blog-title">Title</Label>
            <Input
              id="blog-title"
              placeholder="How to choose the perfect custom t-shirt"
              aria-invalid={!!errors.title}
              {...register("title")}
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="blog-slug">Slug</Label>
              <Input
                id="blog-slug"
                placeholder="how-to-choose-perfect-custom-t-shirt"
                className="font-mono"
                aria-invalid={!!errors.slug}
                {...register("slug")}
              />
              {errors.slug && (
                <p className="text-sm text-destructive">{errors.slug.message}</p>
              )}
            </div>
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
                      {BLOG_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {STATUS_FORM_ITEMS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="blog-excerpt">Excerpt</Label>
            <Textarea
              id="blog-excerpt"
              rows={2}
              placeholder="A short summary shown in blog listings…"
              {...register("excerpt")}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Content</Label>
            <Controller
              control={control}
              name="content"
              render={({ field }) => (
                <RichTextEditor
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Write your blog post…"
                />
              )}
            />
            {errors.content && (
              <p className="text-sm text-destructive">{errors.content.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Featured image</Label>
            <Controller
              control={control}
              name="featured_image"
              render={({ field }) => (
                <MediaUpload
                  value={field.value}
                  onChange={field.onChange}
                  folder="blogs"
                />
              )}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="blog-category">Category</Label>
              <Input
                id="blog-category"
                placeholder="Business Tips"
                {...register("category")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="blog-tags">Tags</Label>
              <Input
                id="blog-tags"
                placeholder="t-shirt, custom, branding"
                {...register("tags")}
              />
            </div>
          </div>

          <div className="rounded-lg border border-border p-3">
            <p className="mb-3 text-sm font-semibold">Search engine listing</p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="blog-meta-title">Meta title</Label>
                <Input
                  id="blog-meta-title"
                  placeholder="Defaults to the post title"
                  {...register("meta_title")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="blog-meta-description">Meta description</Label>
                <Textarea
                  id="blog-meta-description"
                  rows={2}
                  placeholder="Shown in search results…"
                  {...register("meta_description")}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {editing ? "Save changes" : "Save post"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
