"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Download, Loader2, Plus, Search } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { MultiSelectFilter } from "@/components/multi-select-filter";
import { SummaryStatStrip, type SummaryTile } from "@/components/summary-stat-strip";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTable } from "@/components/data-table";
import { DateRangePicker } from "@/components/date-range-picker";
import { StatusBadge } from "@/components/status-badge";
import { apiErrorMessage } from "@/lib/auth-api";
import { usePermissions } from "@/stores/menu-store";
import { exportRowsToCsv } from "@/lib/utils";
import {
  CONTENT_TYPES,
  CONTENT_TYPE_LABELS,
  listContentPages,
  getContentPagesSummary,
  type ContentPageRow,
  type ContentPagesSummary,
} from "@/lib/admin-api";

const DEFAULT_PAGE_SIZE = 15;
const EXPORT_CAP = 5000;
const STATUS_OPTIONS = ["active", "inactive"] as const;
const EMPTY_SUMMARY: ContentPagesSummary = { total_pages: 0, published: 0, draft: 0, missing_seo: 0 };

/** Plain-text excerpt of the stored HTML, for the table preview. */
const excerpt = (html?: string) =>
  (html ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const exportColumns = [
  { key: "title", label: "Page", value: (r: ContentPageRow) => r.title },
  { key: "slug", label: "Slug", value: (r: ContentPageRow) => r.slug },
  { key: "content_type", label: "Type", value: (r: ContentPageRow) => CONTENT_TYPE_LABELS[r.content_type] ?? r.content_type },
  { key: "seo", label: "SEO", value: (r: ContentPageRow) => (r.meta_title || r.meta_desc ? "Set" : "Missing") },
  { key: "status", label: "Status", value: (r: ContentPageRow) => (r.is_active ? "Published" : "Draft") },
  { key: "updated_at", label: "Last updated", value: (r: ContentPageRow) => r.updated_at ?? r.created_at ?? "" },
];

const columns: ColumnDef<ContentPageRow>[] = [
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
    header: "Page",
    cell: ({ row }) => (
      <div className="min-w-0 max-w-80">
        <p className="truncate font-medium">{row.original.title}</p>
        <p className="truncate font-mono text-xs text-muted-foreground">
          /{row.original.slug}
        </p>
      </div>
    ),
  },
  {
    accessorKey: "content",
    header: "Content",
    cell: ({ row }) => (
      <span className="block max-w-72 truncate text-xs text-muted-foreground">
        {excerpt(row.original.content) || "—"}
      </span>
    ),
  },
  {
    accessorKey: "content_type",
    header: "Type",
    cell: ({ row }) =>
      row.original.humanize_content_type ??
      CONTENT_TYPE_LABELS[row.original.content_type] ??
      "—",
  },
  {
    accessorKey: "meta_title",
    header: "SEO",
    cell: ({ row }) =>
      row.original.meta_title || row.original.meta_desc ? (
        <StatusBadge status="Set" tone="success" />
      ) : (
        <StatusBadge status="Missing" tone="neutral" />
      ),
  },
  {
    accessorKey: "is_active",
    header: "Status",
    cell: ({ row }) => (
      <StatusBadge
        status={row.original.is_active ? "Published" : "Draft"}
        tone={row.original.is_active ? "success" : "neutral"}
      />
    ),
  },
  {
    accessorKey: "updated_at",
    header: "Last updated",
    cell: ({ row }) => {
      const d = row.original.updated_at ?? row.original.created_at;
      if (!d) return "—";
      const date = new Date(d);
      return isNaN(date.getTime()) ? "—" : format(date, "MMM d, yyyy");
    },
  },
];

export default function ContentPagesPage() {
  const permissions = usePermissions("/content/pages");
  const router = useRouter();

  const [rows, setRows] = React.useState<ContentPageRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(0);
  const [pageSize, setPageSize] = React.useState<number>(DEFAULT_PAGE_SIZE);
  const [pageCount, setPageCount] = React.useState(1);
  const [total, setTotal] = React.useState(0);

  const [selected, setSelected] = React.useState<ContentPageRow[]>([]);
  const [clearKey, setClearKey] = React.useState(0);
  const [exportBusy, setExportBusy] = React.useState(false);
  const [summary, setSummary] = React.useState<ContentPagesSummary>(EMPTY_SUMMARY);
  const [summaryLoading, setSummaryLoading] = React.useState(true);

  const [search, setSearch] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [contentTypes, setContentTypes] = React.useState<string[]>([]);
  const [statuses, setStatuses] = React.useState<string[]>([]);
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();

  const [debounced, setDebounced] = React.useState({ search: "", slug: "" });
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced({ search, slug }), 400);
    return () => clearTimeout(t);
  }, [search, slug]);

  React.useEffect(() => {
    setPage(0);
  }, [debounced, contentTypes, statuses, dateRange]);

  const activeFilters = React.useMemo(
    () => ({
      dateRange,
      title: debounced.search ? { contains: debounced.search } : undefined,
      slug: debounced.slug ? { contains: debounced.slug } : undefined,
      content_type: contentTypes.length ? contentTypes : undefined,
      is_active: statuses.length === 1 ? statuses[0] === "active" : undefined,
    }),
    [dateRange, debounced, contentTypes, statuses]
  );

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listContentPages({
      page: page + 1,
      limit: pageSize,
      dateRange: activeFilters.dateRange,
      filters: {
        title: activeFilters.title, slug: activeFilters.slug,
        content_type: activeFilters.content_type, is_active: activeFilters.is_active,
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
        toast.error(apiErrorMessage(error, "Couldn't load pages."));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, activeFilters]);

  React.useEffect(() => {
    let cancelled = false;
    setSummaryLoading(true);
    getContentPagesSummary(activeFilters)
      .then((s) => !cancelled && setSummary(s))
      .catch(() => !cancelled && setSummary(EMPTY_SUMMARY))
      .finally(() => !cancelled && setSummaryLoading(false));
    return () => { cancelled = true; };
  }, [activeFilters]);

  const runExport = async (scope: "selected" | "all") => {
    setExportBusy(true);
    try {
      const exportRows =
        scope === "selected"
          ? selected
          : (
              await listContentPages({
                page: 1, limit: EXPORT_CAP, dateRange: activeFilters.dateRange,
                filters: {
                  title: activeFilters.title, slug: activeFilters.slug,
                  content_type: activeFilters.content_type, is_active: activeFilters.is_active,
                },
              })
            ).rows;
      if (!exportRows.length) {
        toast.error("Nothing to export.");
        return;
      }
      exportRowsToCsv(`pages-${format(new Date(), "yyyy-MM-dd")}`, exportColumns, exportRows);
      toast.success(`Exported ${exportRows.length} page${exportRows.length === 1 ? "" : "s"}.`);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't export pages."));
    } finally {
      setExportBusy(false);
    }
  };

  const tiles: SummaryTile[] = [
    { label: "Total pages", value: summary.total_pages.toLocaleString("en-US") },
    { label: "Published", value: summary.published.toLocaleString("en-US") },
    { label: "Draft", value: summary.draft.toLocaleString("en-US") },
    { label: "Missing SEO", value: summary.missing_seo.toLocaleString("en-US") },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Pages</h1>
          <p className="text-sm text-muted-foreground">
            Every storefront page — content, SEO and visibility.
          </p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={exportBusy}
              render={
                <Button variant="outline">
                  {exportBusy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                  Export
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuItem disabled={!selected.length} onClick={() => runExport("selected")}>
                Export {selected.length || ""} selected
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => runExport("all")}>
                Export all matching filters ({total})
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {permissions.can_create && (
            <Button render={<Link href="/content/pages/new" />}>
              <Plus className="size-4" />
              Add page
            </Button>
          )}
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
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="Slug"
          className="w-44 bg-card font-mono"
        />
        <MultiSelectFilter label="Type" options={CONTENT_TYPES} value={contentTypes} onChange={setContentTypes} />
        <MultiSelectFilter label="Status" options={STATUS_OPTIONS} value={statuses} onChange={setStatuses} />
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-3 py-2">
          <span className="text-sm font-medium">
            {selected.length} page{selected.length === 1 ? "" : "s"} selected
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
        onRowClick={(row) => router.push(`/content/pages/${row.id}`)}
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
