"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Plus, Search } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/data-table";
import { DateRangePicker } from "@/components/date-range-picker";
import { StatusBadge } from "@/components/status-badge";
import { apiErrorMessage } from "@/lib/auth-api";
import {
  CONTENT_TYPE_LABELS,
  listContentPages,
  type ContentPageRow,
} from "@/lib/admin-api";

const PAGE_SIZE = 15;

const TYPE_FILTER_ITEMS: Record<string, string> = {
  all: "All types",
  ...CONTENT_TYPE_LABELS,
};

const STATUS_FILTER_ITEMS: Record<string, string> = {
  all: "All statuses",
  active: "Published",
  inactive: "Draft",
};

/** Plain-text excerpt of the stored HTML, for the table preview. */
const excerpt = (html?: string) =>
  (html ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const columns: ColumnDef<ContentPageRow>[] = [
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
  const router = useRouter();

  const [rows, setRows] = React.useState<ContentPageRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(0);
  const [pageCount, setPageCount] = React.useState(1);
  const [total, setTotal] = React.useState(0);

  const [search, setSearch] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [contentType, setContentType] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();

  const [debounced, setDebounced] = React.useState({ search: "", slug: "" });
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced({ search, slug }), 400);
    return () => clearTimeout(t);
  }, [search, slug]);

  React.useEffect(() => {
    setPage(0);
  }, [debounced, contentType, status, dateRange]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listContentPages({
      page: page + 1,
      limit: PAGE_SIZE,
      dateRange,
      filters: {
        title: debounced.search || undefined,
        slug: debounced.slug || undefined,
        content_type: contentType === "all" ? undefined : contentType,
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
        toast.error(apiErrorMessage(error, "Couldn't load pages."));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, debounced, contentType, status, dateRange]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Pages</h1>
          <p className="text-sm text-muted-foreground">
            Every storefront page — content, SEO and visibility.
          </p>
        </div>
        <Button render={<Link href="/content/pages/new" />}>
          <Plus className="size-4" />
          Add page
        </Button>
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
        <Input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="Slug"
          className="w-44 bg-card font-mono"
        />
        <Select
          items={TYPE_FILTER_ITEMS}
          value={contentType}
          onValueChange={(v) => setContentType(v as string)}
        >
          <SelectTrigger className="min-w-32 bg-card">
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
        <Select
          items={STATUS_FILTER_ITEMS}
          value={status}
          onValueChange={(v) => setStatus(v as string)}
        >
          <SelectTrigger className="min-w-32 bg-card">
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

      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        onRowClick={(row) => router.push(`/content/pages/${row.id}`)}
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
