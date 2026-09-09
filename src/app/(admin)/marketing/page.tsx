"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Loader2, Plus, Search, Send } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { MultiSelectFilter } from "@/components/multi-select-filter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, type ColumnFilterDef } from "@/components/data-table";
import { DateRangePicker } from "@/components/date-range-picker";
import { MediaUpload } from "@/components/media-upload";
import { StatusBadge } from "@/components/status-badge";
import { apiErrorMessage } from "@/lib/auth-api";
import { ExportMenu } from "@/components/export-menu";
import {
  CAMPAIGN_STATUSES,
  SUBSCRIBER_SOURCES,
  SUBSCRIBER_STATUSES,
  createCampaign,
  createSubscriber,
  listCampaigns,
  listSubscribers,
  sendCampaign,
  updateCampaign,
  updateSubscriber,
  type CampaignRow,
  type SubscriberRow,
} from "@/lib/admin-api";

const DEFAULT_PAGE_SIZE = 10;
const EXPORT_CAP = 5000;
const cap = (s?: string | null) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1) : "—";

export default function MarketingPage() {
  const [tab, setTab] = React.useState("campaigns");

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Marketing</h1>
      <Tabs value={tab} onValueChange={(v) => setTab(v as string)}>
        <TabsList className="bg-transparent p-0">
          <TabsTrigger
            value="campaigns"
            className="cursor-pointer rounded-lg px-3 data-active:bg-[#e3e3e3] data-active:shadow-none"
          >
            Campaigns
          </TabsTrigger>
          <TabsTrigger
            value="subscribers"
            className="cursor-pointer rounded-lg px-3 data-active:bg-[#e3e3e3] data-active:shadow-none"
          >
            Subscribers
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === "campaigns" ? <CampaignsTab /> : <SubscribersTab />}
    </div>
  );
}


const campaignStatusTone = (s?: string) =>
  s === "sent"
    ? "success"
    : s === "sending" || s === "scheduled"
      ? "attention"
      : s === "failed"
        ? "critical"
        : "info";

const campaignExportColumns = [
  { key: "subject", label: "Campaign", value: (r: CampaignRow) => r.subject },
  { key: "status", label: "Status", value: (r: CampaignRow) => cap(r.status ?? "draft") },
  { key: "scheduled_at", label: "Scheduled", value: (r: CampaignRow) => r.scheduled_at ?? "" },
  { key: "sent_at", label: "Sent", value: (r: CampaignRow) => r.sent_at ?? "" },
  { key: "created_at", label: "Created", value: (r: CampaignRow) => r.created_at ?? "" },
];

const campaignColumns: ColumnDef<CampaignRow>[] = [
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
    accessorKey: "subject",
    header: "Campaign",
    cell: ({ row }) => (
      <div className="min-w-0 max-w-80">
        <p className="truncate font-medium">{row.original.subject}</p>
        {row.original.preview_text && (
          <p className="truncate text-xs text-muted-foreground">
            {row.original.preview_text}
          </p>
        )}
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <StatusBadge
        status={cap(row.original.status ?? "draft")}
        tone={campaignStatusTone(row.original.status)}
      />
    ),
  },
  {
    accessorKey: "scheduled_at",
    header: "Scheduled",
    cell: ({ row }) => {
      const d = row.original.scheduled_at;
      if (!d) return "—";
      const date = new Date(d);
      return isNaN(date.getTime()) ? "—" : format(date, "MMM d, yyyy h:mm a");
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

const CAMPAIGN_COLUMN_FILTERS: Record<string, ColumnFilterDef> = {
  subject: { type: "text", placeholder: "Search subjects" },
  status: { type: "select", options: CAMPAIGN_STATUSES, placeholder: "Any" },
};

function CampaignsTab() {
  const [rows, setRows] = React.useState<CampaignRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(0);
  const [pageSize, setPageSize] = React.useState<number>(DEFAULT_PAGE_SIZE);
  const [pageCount, setPageCount] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [selected, setSelected] = React.useState<CampaignRow[]>([]);
  const [clearKey, setClearKey] = React.useState(0);

  const [search, setSearch] = React.useState("");
  const [statuses, setStatuses] = React.useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<CampaignRow | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);

  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  React.useEffect(() => {
    setPage(0);
  }, [debouncedSearch, statuses]);

  const activeFilters = React.useMemo(
    () => ({
      subject: debouncedSearch ? { contains: debouncedSearch } : undefined,
      status: statuses.length ? statuses : undefined,
    }),
    [debouncedSearch, statuses]
  );

  const columnFilterValues = React.useMemo(() => {
    const values: Record<string, string[]> = {};
    if (search) values.subject = [search];
    if (statuses.length) values.status = statuses;
    return values;
  }, [search, statuses]);

  const applyColumnFilters = React.useCallback(
    (next: Record<string, string[]>) => {
      setSearch(next.subject?.[0] ?? "");
      setStatuses(next.status ?? []);
    },
    []
  );

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listCampaigns({ page: page + 1, limit: pageSize, filters: activeFilters })
      .then((res) => {
        if (cancelled) return;
        setRows(res.rows);
        setTotal(res.total);
        setPageCount(res.totalPages);
      })
      .catch((error) => {
        if (cancelled) return;
        setRows([]);
        toast.error(apiErrorMessage(error, "Couldn't load campaigns."));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, activeFilters, refreshKey]);

  const fetchAllForExport = async () =>
    fetchAllPages((page, limit) => listCampaigns({ page, limit, filters: activeFilters }), EXPORT_CAP);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-44 flex-1 sm:max-w-56">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by subject"
            className="bg-card pl-8"
          />
        </div>
        <MultiSelectFilter label="Status" options={CAMPAIGN_STATUSES} value={statuses} onChange={setStatuses} />
        <ExportMenu
          filename="campaigns"
          columns={campaignExportColumns}
          selected={selected}
          fetchAll={fetchAllForExport}
          total={total}
          noun="campaign"
        />
        <Button
          className="ml-auto"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="size-4" />
          Create campaign
        </Button>
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-3 py-2">
          <span className="text-sm font-medium">
            {selected.length} campaign{selected.length === 1 ? "" : "s"} selected
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

      <CampaignDialog
        editing={editing}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />

      <DataTable
        columns={campaignColumns}
        data={rows}
        loading={loading}
        onSelectionChange={setSelected}
        clearSelectionKey={clearKey}
        onRowClick={(row) => {
          setEditing(row);
          setDialogOpen(true);
        }}
        columnFilterDefs={CAMPAIGN_COLUMN_FILTERS}
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

const campaignSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  preview_text: z.string().optional(),
  content: z
    .string()
    .refine((v) => v.replace(/<[^>]*>/g, "").trim().length > 0, "Content is required"),
  featured_image: z.string().nullable().optional(),
  scheduled_at: z.string().optional(),
});
type CampaignValues = z.infer<typeof campaignSchema>;

function CampaignDialog({
  editing,
  open,
  onOpenChange,
  onSaved,
}: {
  editing: CampaignRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [sending, setSending] = React.useState(false);
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CampaignValues>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      subject: "",
      preview_text: "",
      content: "",
      featured_image: null,
      scheduled_at: "",
    },
  });

  React.useEffect(() => {
    if (open) {
      reset({
        subject: editing?.subject ?? "",
        preview_text: editing?.preview_text ?? "",
        content: editing?.content ?? "",
        featured_image: editing?.featured_image ?? null,
        scheduled_at: editing?.scheduled_at
          ? format(new Date(editing.scheduled_at), "yyyy-MM-dd'T'HH:mm")
          : "",
      });
    }
  }, [open, editing, reset]);

  const onSubmit = async (values: CampaignValues) => {
    const body = {
      subject: values.subject,
      preview_text: values.preview_text || undefined,
      content: values.content,
      featured_image: values.featured_image || undefined,
      scheduled_at: values.scheduled_at
        ? new Date(values.scheduled_at).toISOString()
        : undefined,
      is_active: true,
    };
    try {
      const message = editing
        ? await updateCampaign(editing.id, body)
        : await createCampaign(body);
      toast.success(message);
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(
        apiErrorMessage(error, `Couldn't ${editing ? "update" : "create"} the campaign.`)
      );
    }
  };

  const send = async () => {
    if (!editing) return;
    setSending(true);
    try {
      toast.success(await sendCampaign(editing.id));
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't send the campaign."));
    } finally {
      setSending(false);
    }
  };

  const canSend =
    editing && (editing.status === "draft" || editing.status === "scheduled" || !editing.status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit campaign" : "Create campaign"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? `Update "${editing.subject}".`
              : "Compose a newsletter to send to your subscribers."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="camp-subject">Subject</Label>
            <Input
              id="camp-subject"
              placeholder="Summer Sale is Live – Up to 30% Off!"
              aria-invalid={!!errors.subject}
              {...register("subject")}
            />
            {errors.subject && (
              <p className="text-sm text-destructive">{errors.subject.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="camp-preview">Preview text</Label>
            <Input
              id="camp-preview"
              placeholder="Don't miss our biggest sale of the year!"
              {...register("preview_text")}
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
                  placeholder="Write your newsletter…"
                />
              )}
            />
            {errors.content && (
              <p className="text-sm text-destructive">{errors.content.message}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Featured image</Label>
              <Controller
                control={control}
                name="featured_image"
                render={({ field }) => (
                  <MediaUpload
                    value={field.value}
                    onChange={field.onChange}
                    folder="newsletters"
                  />
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="camp-schedule">Schedule (optional)</Label>
              <Input
                id="camp-schedule"
                type="datetime-local"
                {...register("scheduled_at")}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to keep it as a draft
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            {canSend && (
              <Button
                type="button"
                variant="outline"
                className="mr-auto"
                onClick={send}
                disabled={sending}
              >
                {sending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                Send now
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {editing ? "Save changes" : "Create campaign"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


const subStatusTone = (s?: string) =>
  s === "subscribed" ? "success" : s === "pending" ? "attention" : "neutral";

const subscriberExportColumns = [
  { key: "full_name", label: "Name", value: (r: SubscriberRow) => r.full_name ?? "" },
  { key: "email", label: "Email", value: (r: SubscriberRow) => r.email },
  { key: "status", label: "Status", value: (r: SubscriberRow) => cap(r.status ?? "subscribed") },
  { key: "source", label: "Source", value: (r: SubscriberRow) => cap(r.source) },
  { key: "created_at", label: "Subscribed", value: (r: SubscriberRow) => r.created_at ?? "" },
];

const subscriberColumns: ColumnDef<SubscriberRow>[] = [
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
    accessorKey: "email",
    header: "Subscriber",
    cell: ({ row }) => {
      const name = row.original.full_name || row.original.email;
      const initials = name
        .split(/\s+/)
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
      return (
        <div className="flex items-center gap-3">
          <Avatar className="size-8">
            <AvatarFallback className="bg-[#e0f0ff] text-xs font-semibold text-[#00527c]">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-medium">
              {row.original.full_name || "—"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {row.original.email}
            </p>
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <StatusBadge
        status={cap(row.original.status ?? "subscribed")}
        tone={subStatusTone(row.original.status)}
      />
    ),
  },
  {
    accessorKey: "source",
    header: "Source",
    cell: ({ row }) => cap(row.original.source),
  },
  {
    accessorKey: "created_at",
    header: "Subscribed",
    cell: ({ row }) => {
      const d = row.original.created_at;
      if (!d) return "—";
      const date = new Date(d);
      return isNaN(date.getTime()) ? "—" : format(date, "MMM d, yyyy");
    },
  },
];

const SUBSCRIBER_COLUMN_FILTERS: Record<string, ColumnFilterDef> = {
  email: { type: "text", placeholder: "Search emails" },
  status: { type: "select", options: SUBSCRIBER_STATUSES, placeholder: "Any" },
  source: { type: "select", options: SUBSCRIBER_SOURCES, placeholder: "Any" },
};

function SubscribersTab() {
  const [rows, setRows] = React.useState<SubscriberRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(0);
  const [pageSize, setPageSize] = React.useState<number>(DEFAULT_PAGE_SIZE);
  const [pageCount, setPageCount] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [selected, setSelected] = React.useState<SubscriberRow[]>([]);
  const [clearKey, setClearKey] = React.useState(0);

  const [search, setSearch] = React.useState("");
  const [statuses, setStatuses] = React.useState<string[]>([]);
  const [sources, setSources] = React.useState<string[]>([]);
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SubscriberRow | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);

  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  React.useEffect(() => {
    setPage(0);
  }, [debouncedSearch, statuses, sources, dateRange]);

  const activeFilters = React.useMemo(
    () => ({
      dateRange,
      email: debouncedSearch ? { contains: debouncedSearch } : undefined,
      status: statuses.length ? statuses : undefined,
      source: sources.length ? sources : undefined,
    }),
    [dateRange, debouncedSearch, statuses, sources]
  );

  const columnFilterValues = React.useMemo(() => {
    const values: Record<string, string[]> = {};
    if (search) values.email = [search];
    if (statuses.length) values.status = statuses;
    if (sources.length) values.source = sources;
    return values;
  }, [search, statuses, sources]);

  const applyColumnFilters = React.useCallback(
    (next: Record<string, string[]>) => {
      setSearch(next.email?.[0] ?? "");
      setStatuses(next.status ?? []);
      setSources(next.source ?? []);
    },
    []
  );

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listSubscribers({
      page: page + 1,
      limit: pageSize,
      dateRange: activeFilters.dateRange,
      filters: { email: activeFilters.email, status: activeFilters.status, source: activeFilters.source },
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
        toast.error(apiErrorMessage(error, "Couldn't load subscribers."));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, activeFilters, refreshKey]);

  const fetchAllForExport = async () =>
    (
              await listSubscribers({
                page: 1, limit: EXPORT_CAP, dateRange: activeFilters.dateRange,
                filters: { email: activeFilters.email, status: activeFilters.status, source: activeFilters.source },
              })
            ).rows;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-44 flex-1 sm:max-w-56">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email"
            className="bg-card pl-8"
          />
        </div>
        <MultiSelectFilter label="Status" options={SUBSCRIBER_STATUSES} value={statuses} onChange={setStatuses} />
        <MultiSelectFilter label="Source" options={SUBSCRIBER_SOURCES} value={sources} onChange={setSources} />
        <DateRangePicker value={dateRange} onChange={setDateRange} />
        <ExportMenu
          filename="subscribers"
          columns={subscriberExportColumns}
          selected={selected}
          fetchAll={fetchAllForExport}
          total={total}
          noun="subscriber"
        />
        <Button
          className="ml-auto"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="size-4" />
          Add subscriber
        </Button>
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-3 py-2">
          <span className="text-sm font-medium">
            {selected.length} subscriber{selected.length === 1 ? "" : "s"} selected
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

      <SubscriberDialog
        editing={editing}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />

      <DataTable
        columns={subscriberColumns}
        data={rows}
        loading={loading}
        onSelectionChange={setSelected}
        clearSelectionKey={clearKey}
        onRowClick={(row) => {
          setEditing(row);
          setDialogOpen(true);
        }}
        columnFilterDefs={SUBSCRIBER_COLUMN_FILTERS}
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

const subscriberSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  full_name: z.string().optional(),
  source: z.string().optional(),
  status: z.enum(SUBSCRIBER_STATUSES),
});
type SubscriberValues = z.infer<typeof subscriberSchema>;

const SUB_STATUS_FORM_ITEMS: Record<string, string> = Object.fromEntries(
  SUBSCRIBER_STATUSES.map((s) => [s, cap(s)])
);
const SUB_SOURCE_FORM_ITEMS: Record<string, string> = Object.fromEntries(
  SUBSCRIBER_SOURCES.map((s) => [s, cap(s)])
);

function SubscriberDialog({
  editing,
  open,
  onOpenChange,
  onSaved,
}: {
  editing: SubscriberRow | null;
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
  } = useForm<SubscriberValues>({
    resolver: zodResolver(subscriberSchema),
    defaultValues: { email: "", full_name: "", source: "manual", status: "subscribed" },
  });

  React.useEffect(() => {
    if (open) {
      reset({
        email: editing?.email ?? "",
        full_name: editing?.full_name ?? "",
        source: editing?.source ?? "manual",
        status:
          (editing?.status as (typeof SUBSCRIBER_STATUSES)[number]) ?? "subscribed",
      });
    }
  }, [open, editing, reset]);

  const onSubmit = async (values: SubscriberValues) => {
    try {
      let message: string;
      if (editing) {
        message = await updateSubscriber(editing.id, {
          full_name: values.full_name || undefined,
          status: values.status,
          is_active: true,
        });
      } else {
        message = await createSubscriber({
          email: values.email,
          full_name: values.full_name || undefined,
          source: values.source || "manual",
          is_active: true,
        });
      }
      toast.success(message);
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(
        apiErrorMessage(error, `Couldn't ${editing ? "update" : "add"} the subscriber.`)
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit subscriber" : "Add subscriber"}</DialogTitle>
          <DialogDescription>
            {editing
              ? `Update ${editing.email}.`
              : "Manually add someone to your newsletter."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="sub-email">Email</Label>
            <Input
              id="sub-email"
              type="email"
              placeholder="customer@example.com"
              disabled={!!editing}
              aria-invalid={!!errors.email}
              {...register("email")}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sub-name">Full name</Label>
            <Input id="sub-name" placeholder="John Doe" {...register("full_name")} />
          </div>
          {editing ? (
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select
                    items={SUB_STATUS_FORM_ITEMS}
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUBSCRIBER_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {cap(s)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Source</Label>
              <Controller
                control={control}
                name="source"
                render={({ field }) => (
                  <Select
                    items={SUB_SOURCE_FORM_ITEMS}
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUBSCRIBER_SOURCES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {cap(s)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {editing ? "Save changes" : "Add subscriber"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
