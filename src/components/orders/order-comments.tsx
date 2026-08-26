"use client";

import * as React from "react";
import { format } from "date-fns";
import {
  Lock,
  MessageSquare,
  Paperclip,
  Pencil,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { MediaUpload } from "@/components/media-upload";
import { StatusBadge, type BadgeTone } from "@/components/status-badge";
import { apiErrorMessage } from "@/lib/auth-api";
import { cn } from "@/lib/utils";
import {
  ORDER_COMMENT_TYPES,
  ORDER_COMMENT_TYPE_LABELS,
  createOrderComment,
  deleteRecord,
  listOrderComments,
  updateOrderComment,
  type OrderCommentRow,
  type OrderCommentType,
} from "@/lib/admin-api";

const TYPE_TONES: Record<OrderCommentType, BadgeTone> = {
  note: "neutral",
  status_update: "info",
  customer_message: "success",
  internal_flag: "attention",
};

const TYPE_ITEMS = ORDER_COMMENT_TYPE_LABELS as Record<string, string>;

const authorName = (c: OrderCommentRow) =>
  c.user?.full_name ??
  c.user?.name ??
  c.creator?.full_name ??
  c.creator?.name ??
  c.user?.email ??
  (c.user_id != null ? `User #${c.user_id}` : "System");

const initials = (name: string) =>
  name.split(/\s+/).map((p) => p[0] ?? "").join("").slice(0, 2).toUpperCase() || "??";

const fmtWhen = (v?: string) => {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "—" : format(d, "MMM d, yyyy · h:mm a");
};

export function OrderComments({ orderId }: { orderId: number | string }) {
  const [comments, setComments] = React.useState<OrderCommentRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshKey, setRefreshKey] = React.useState(0);

  // Composer
  const [text, setText] = React.useState("");
  const [type, setType] = React.useState<OrderCommentType>("note");
  const [isInternal, setIsInternal] = React.useState(true);
  const [attachment, setAttachment] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  // Inline editing
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editText, setEditText] = React.useState("");
  const [savingEdit, setSavingEdit] = React.useState(false);

  const [deleteTarget, setDeleteTarget] = React.useState<OrderCommentRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listOrderComments(orderId)
      .then((rows) => {
        if (!cancelled) setComments(rows);
      })
      .catch((error) => {
        if (cancelled) return;
        setComments([]);
        toast.error(apiErrorMessage(error, "Couldn't load comments."));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [orderId, refreshKey]);

  const submit = async () => {
    const comment = text.trim();
    if (!comment) return;
    setSaving(true);
    try {
      const message = await createOrderComment({
        order_id: orderId,
        comment,
        comment_type: type,
        is_internal: isInternal,
        attachment_url: attachment || undefined,
      });
      toast.success(message);
      setText("");
      setAttachment(null);
      setRefreshKey((k) => k + 1);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't add the comment."));
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async (comment: OrderCommentRow) => {
    const next = editText.trim();
    if (!next || next === comment.comment) {
      setEditingId(null);
      return;
    }
    setSavingEdit(true);
    try {
      const message = await updateOrderComment(comment.id, { comment: next });
      toast.success(message);
      setEditingId(null);
      setRefreshKey((k) => k + 1);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't update the comment."));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const message = await deleteRecord("orderComment", deleteTarget.id);
      toast.success(message);
      setDeleteTarget(null);
      setRefreshKey((k) => k + 1);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't delete the comment."));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-center gap-2 pb-3">
          <MessageSquare className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">Comments</CardTitle>
          {comments.length > 0 && (
            <span className="rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground">
              {comments.length}
            </span>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Composer */}
          <div className="space-y-2 rounded-xl border border-border p-3">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              maxLength={5000}
              placeholder="Add a note for the team, or a message for the customer…"
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
              }}
            />

            <div className="flex flex-wrap items-center gap-2">
              <Select
                items={TYPE_ITEMS}
                value={type}
                onValueChange={(v) => setType(v as OrderCommentType)}
              >
                <SelectTrigger className="h-9 min-w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORDER_COMMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {ORDER_COMMENT_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-input px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={isInternal}
                  onChange={(e) => setIsInternal(e.target.checked)}
                />
                Internal only
              </label>

              <MediaUpload
                value={attachment}
                onChange={setAttachment}
                folder="order-comments"
              />

              <Button
                className="ml-auto"
                onClick={submit}
                disabled={saving || !text.trim()}
              >
                <Send className="size-4" />
                {saving ? "Posting…" : "Post"}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              {isInternal
                ? "Staff only — the customer won't see this."
                : "Visible to the customer on their order page."}
            </p>
          </div>

          {/* Timeline */}
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : comments.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No comments yet.
            </p>
          ) : (
            <div className="space-y-3">
              {comments.map((c) => {
                const name = authorName(c);
                const editing = editingId === String(c.id);
                const commentType = (c.comment_type ?? "note") as OrderCommentType;
                return (
                  <div
                    key={String(c.id)}
                    className={cn(
                      "group rounded-xl border border-border p-3",
                      c.is_internal && "border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/10"
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#e0f0ff] text-[11px] font-semibold text-[#00527c]">
                        {initials(name)}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-medium">{name}</span>
                          <StatusBadge
                            status={ORDER_COMMENT_TYPE_LABELS[commentType] ?? commentType}
                            tone={TYPE_TONES[commentType] ?? "neutral"}
                          />
                          {c.is_internal && (
                            <span className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-500">
                              <Lock className="size-3" />
                              Internal
                            </span>
                          )}
                          <span className="ml-auto text-xs text-muted-foreground">
                            {fmtWhen(c.created_at)}
                          </span>
                        </div>

                        {editing ? (
                          <div className="mt-2 space-y-2">
                            <Textarea
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              rows={3}
                              maxLength={5000}
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => saveEdit(c)}
                                disabled={savingEdit}
                              >
                                {savingEdit ? "Saving…" : "Save"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingId(null)}
                              >
                                <X className="size-3.5" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="mt-1 text-sm whitespace-pre-wrap break-words">
                            {c.comment}
                          </p>
                        )}

                        {c.attachment_url && !editing && (
                          <a
                            href={c.attachment_url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1.5 inline-flex items-center gap-1 text-xs text-[#005bd3] hover:underline"
                          >
                            <Paperclip className="size-3" />
                            Attachment
                          </a>
                        )}
                      </div>

                      {!editing && (
                        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            type="button"
                            aria-label="Edit comment"
                            onClick={() => {
                              setEditingId(String(c.id));
                              setEditText(c.comment);
                            }}
                            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label="Delete comment"
                            onClick={() => setDeleteTarget(c)}
                            className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(next) => !next && setDeleteTarget(null)}
        loading={deleting}
        onConfirm={handleDelete}
        title="Delete this comment?"
        description="This can't be undone."
      />
    </>
  );
}
