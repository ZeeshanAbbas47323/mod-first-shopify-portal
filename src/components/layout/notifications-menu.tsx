"use client";

import * as React from "react";
import { Bell, Check, Loader2, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { apiErrorMessage } from "@/lib/auth-api";
import {
  deleteNotification,
  getUnreadNotificationCount,
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationRow,
} from "@/lib/admin-api";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 15;

/** How often the badge re-checks while the tab is open. */
const POLL_MS = 60_000;

function timeAgo(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return formatDistanceToNow(d, { addSuffix: true });
}

export function NotificationsMenu() {
  const [open, setOpen] = React.useState(false);
  const [rows, setRows] = React.useState<NotificationRow[]>([]);
  const [unread, setUnread] = React.useState(0);
  const [loading, setLoading] = React.useState(false);

  const refreshCount = React.useCallback(async () => {
    try {
      setUnread(await getUnreadNotificationCount());
    } catch {
      // A failing badge must not interrupt the person's work.
    }
  }, []);

  React.useEffect(() => {
    void refreshCount();
    const t = setInterval(() => void refreshCount(), POLL_MS);
    return () => clearInterval(t);
  }, [refreshCount]);

  // Load the list only when the menu is actually opened.
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    listMyNotifications({ page: 1, limit: PAGE_SIZE })
      .then((res) => {
        if (cancelled) return;
        setRows(res.rows);
        setUnread(res.unreadCount);
      })
      .catch((error) => {
        if (cancelled) return;
        toast.error(apiErrorMessage(error, "Couldn't load notifications."));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open]);

  const readOne = async (row: NotificationRow) => {
    if (row.is_read) return;
    // Optimistic: the badge should drop the moment it's clicked.
    setRows((prev) =>
      prev.map((r) => (r.id === row.id ? { ...r, is_read: true } : r))
    );
    setUnread((n) => Math.max(0, n - 1));
    try {
      await markNotificationRead(row.id);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't mark it read."));
      void refreshCount();
    }
  };

  const readAll = async () => {
    try {
      await markAllNotificationsRead();
      setRows((prev) => prev.map((r) => ({ ...r, is_read: true })));
      setUnread(0);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't mark them read."));
    }
  };

  const remove = async (row: NotificationRow) => {
    const previous = rows;
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    if (!row.is_read) setUnread((n) => Math.max(0, n - 1));
    try {
      await deleteNotification(row.id);
    } catch (error) {
      setRows(previous);
      toast.error(apiErrorMessage(error, "Couldn't remove it."));
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <button
            aria-label={
              unread > 0 ? `Notifications, ${unread} unread` : "Notifications"
            }
            className="relative flex size-8 cursor-pointer items-center justify-center rounded-lg text-neutral-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Bell className="size-4" />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </button>
        }
      />
      <DropdownMenuContent align="end" className="w-88 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <p className="text-sm font-semibold">Notifications</p>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={readAll}
            >
              <Check className="size-3.5" />
              Mark all read
            </Button>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <p className="px-3 py-10 text-center text-sm text-muted-foreground">
              Nothing here yet.
            </p>
          ) : (
            rows.map((row) => (
              <div
                key={row.id}
                onClick={() => void readOne(row)}
                className={cn(
                  "group flex cursor-pointer gap-2 border-b border-border px-3 py-2.5 last:border-b-0 hover:bg-muted/60",
                  !row.is_read && "bg-blue-50/60"
                )}
              >
                <span
                  className={cn(
                    "mt-1.5 size-1.5 shrink-0 rounded-full",
                    row.is_read ? "bg-transparent" : "bg-blue-500"
                  )}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{row.title}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {row.body}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {timeAgo(row.created_at)}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Remove notification"
                  onClick={(e) => {
                    e.stopPropagation();
                    void remove(row);
                  }}
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
