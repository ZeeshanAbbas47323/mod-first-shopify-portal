"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Bell, Loader2, Search, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable } from "@/components/data-table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiErrorMessage } from "@/lib/auth-api";
import { exportRows as writeExport, type ExportFormat, fetchAllPages } from "@/lib/export";
import { ExportFormatMenu } from "@/components/export-menu";
import {
  NOTIFIABLE_ROLES,
  listNotifications,
  sendNotification,
  type AdminNotificationRow,
} from "@/lib/admin-api";

const DEFAULT_PAGE_SIZE = 10;
const EXPORT_CAP = 5000;

const columns: ColumnDef<AdminNotificationRow>[] = [
  {
    accessorKey: "title",
    header: "Notification",
    cell: ({ row }) => (
      <div className="min-w-0 max-w-sm">
        <p className="truncate font-medium">{row.original.title}</p>
        <p className="truncate text-xs text-muted-foreground">{row.original.body}</p>
      </div>
    ),
  },
  {
    accessorKey: "recipient",
    header: "Sent to",
    cell: ({ row }) => {
      const r = row.original.recipient;
      if (!r) return "—";
      return (
        <div className="min-w-0">
          <p className="truncate">{r.full_name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {NOTIFIABLE_ROLES[r.role] ?? r.role}
          </p>
        </div>
      );
    },
  },
  {
    accessorKey: "is_read",
    header: "Read",
    cell: ({ row }) => (row.original.is_read ? "Yes" : "No"),
  },
  {
    accessorKey: "created_at",
    header: "Sent",
    cell: ({ row }) => {
      const v = row.original.created_at;
      return v ? format(new Date(v), "MMM d, yyyy h:mm a") : "—";
    },
  },
];

export function NotificationsSection() {
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [roles, setRoles] = React.useState<Set<string>>(new Set());
  const [sending, setSending] = React.useState(false);

  const toggleRole = (role: string) => {
    setRoles((prev) => {
      const next = new Set(prev);
      next.has(role) ? next.delete(role) : next.add(role);
      return next;
    });
  };

  const send = async () => {
    if (!title.trim() || !body.trim() || roles.size === 0) return;
    setSending(true);
    try {
      toast.success(
        await sendNotification({
          title: title.trim(),
          body: body.trim(),
          roles: [...roles],
        })
      );
      setTitle("");
      setBody("");
      setRoles(new Set());
      setRefreshKey((k) => k + 1);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't send the notification."));
    } finally {
      setSending(false);
    }
  };

  const [rows, setRows] = React.useState<AdminNotificationRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(0);
  const [pageSize, setPageSize] = React.useState<number>(DEFAULT_PAGE_SIZE);
  const [pageCount, setPageCount] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [search, setSearch] = React.useState("");
  const [searchInput, setSearchInput] = React.useState("");
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [exportBusy, setExportBusy] = React.useState(false);

  React.useEffect(() => { setPage(0); }, [search]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listNotifications({ page: page + 1, limit: pageSize, search: search || undefined })
      .then((res) => {
        if (cancelled) return;
        setRows(res.rows);
        setTotal(res.total);
        setPageCount(res.totalPages);
      })
      .catch((error) => {
        if (cancelled) return;
        setRows([]);
        toast.error(apiErrorMessage(error, "Couldn't load notifications."));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, search, refreshKey]);

  const runExport = async (fileFormat: ExportFormat) => {
    setExportBusy(true);
    try {
      const exportRows = await fetchAllPages((page, limit) => listNotifications({ page, limit, search: search || undefined }), EXPORT_CAP);
      if (!exportRows.length) {
        toast.error("Nothing to export.");
        return;
      }
      await writeExport(fileFormat, "notifications", [
        { key: "title", label: "Title", value: (r: AdminNotificationRow) => r.title ?? "" },
        { key: "body", label: "Message", value: (r: AdminNotificationRow) => r.body ?? "" },
        { key: "recipient", label: "Sent to", value: (r: AdminNotificationRow) => r.recipient?.full_name ?? "" },
        { key: "role", label: "Role", value: (r: AdminNotificationRow) => (r.recipient?.role ? (NOTIFIABLE_ROLES[r.recipient.role] ?? r.recipient.role) : "") },
        { key: "is_read", label: "Read", value: (r: AdminNotificationRow) => (r.is_read ? "Yes" : "No") },
        { key: "created_at", label: "Sent", value: (r: AdminNotificationRow) => (r.created_at ? format(new Date(r.created_at), "yyyy-MM-dd HH:mm") : "") },
      ], exportRows);
      toast.success(`Exported ${exportRows.length} notification${exportRows.length === 1 ? "" : "s"}.`);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't export notifications."));
    } finally {
      setExportBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex-row items-center gap-2 pb-3">
          <Bell className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">Send a notification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="notif-title">Title</Label>
            <Input
              id="notif-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Scheduled maintenance tonight"
              maxLength={200}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notif-body">Message</Label>
            <Textarea
              id="notif-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What the team needs to know"
              rows={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Send to</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Object.entries(NOTIFIABLE_ROLES).map(([value, label]) => (
                <label
                  key={value}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-sm"
                >
                  <Checkbox
                    checked={roles.has(value)}
                    onCheckedChange={() => toggleRole(value)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <Button
            onClick={send}
            disabled={sending || !title.trim() || !body.trim() || roles.size === 0}
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {sending ? "Sending…" : "Send"}
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">History</h2>
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setSearch(searchInput)}
            placeholder="Search notifications"
            className="h-9 w-56 pl-8"
          />
        </div>
        <ExportFormatMenu onSelect={runExport} busy={exportBusy} size="sm" />
      </div>

      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
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
