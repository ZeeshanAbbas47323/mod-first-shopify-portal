"use client";

import * as React from "react";
import { GripVertical, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { apiErrorMessage } from "@/lib/auth-api";
import { cn } from "@/lib/utils";

export interface SortableItem {
  id: number | string;
  sort_order?: number | null;
}

interface SortableListProps<T extends SortableItem> {
  items: T[];
  /**
   * Persists the new order. Receives the reordered rows; the list has already
   * moved on screen, so a rejection here is what restores the previous order.
   */
  onReorder: (ordered: T[]) => Promise<unknown>;
  renderItem: (item: T, index: number) => React.ReactNode;
  disabled?: boolean;
  className?: string;
  itemClassName?: string;
  /** Shown instead of the list when there is nothing to sort. */
  empty?: React.ReactNode;
}

/**
 * Drag-to-reorder list built on native HTML5 drag events, so it adds no
 * dependency. The row is the drop target but only the handle starts a drag,
 * which keeps text inside the row selectable.
 */
export function SortableList<T extends SortableItem>({
  items,
  onReorder,
  renderItem,
  disabled = false,
  className,
  itemClassName,
  empty,
}: SortableListProps<T>) {
  const [order, setOrder] = React.useState<T[]>(items);
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const [overIndex, setOverIndex] = React.useState<number | null>(null);
  const [saving, setSaving] = React.useState(false);

  // The parent refetches after a save, so incoming items are authoritative.
  React.useEffect(() => setOrder(items), [items]);

  const commit = React.useCallback(
    async (next: T[], previous: T[]) => {
      setOrder(next);
      setSaving(true);
      try {
        await onReorder(next);
        toast.success("Order updated.");
      } catch (error) {
        setOrder(previous);
        toast.error(apiErrorMessage(error, "Couldn't save the new order."));
      } finally {
        setSaving(false);
      }
    },
    [onReorder]
  );

  const move = React.useCallback(
    (from: number, to: number) => {
      if (from === to || to < 0 || to >= order.length) return;
      const previous = order;
      const next = [...order];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      void commit(next, previous);
    },
    [order, commit]
  );

  const handleDrop = (index: number) => {
    if (dragIndex === null) return;
    move(dragIndex, index);
    setDragIndex(null);
    setOverIndex(null);
  };

  if (!order.length && empty) {
    return <>{empty}</>;
  }

  return (
    <div className={cn("relative flex flex-col gap-2", className)}>
      {saving && (
        <div className="pointer-events-none absolute right-0 -top-6 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          Saving order…
        </div>
      )}

      {order.map((item, index) => {
        const isDragging = dragIndex === index;
        const isOver = overIndex === index && dragIndex !== index;

        return (
          <div
            key={item.id}
            onDragOver={(e) => {
              if (disabled || dragIndex === null) return;
              e.preventDefault();
              setOverIndex(index);
            }}
            onDragLeave={() => setOverIndex((i) => (i === index ? null : i))}
            onDrop={(e) => {
              e.preventDefault();
              handleDrop(index);
            }}
            className={cn(
              "group flex items-center gap-3 rounded-lg bg-card p-3 ring-1 ring-black/8 transition",
              "hover:ring-black/15",
              isDragging && "opacity-40 ring-primary/40",
              isOver &&
                (dragIndex !== null && dragIndex < index
                  ? "border-b-2 border-b-primary"
                  : "border-t-2 border-t-primary"),
              itemClassName
            )}
          >
            <button
              type="button"
              draggable={!disabled}
              onDragStart={(e) => {
                if (disabled) return;
                setDragIndex(index);
                e.dataTransfer.effectAllowed = "move";
                // Firefox refuses to start a drag without data set.
                e.dataTransfer.setData("text/plain", String(item.id));
              }}
              onDragEnd={() => {
                setDragIndex(null);
                setOverIndex(null);
              }}
              onKeyDown={(e) => {
                if (disabled) return;
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  move(index, index - 1);
                } else if (e.key === "ArrowDown") {
                  e.preventDefault();
                  move(index, index + 1);
                }
              }}
              disabled={disabled}
              aria-label={`Reorder item ${index + 1} of ${order.length}. Use arrow keys to move.`}
              className={cn(
                "shrink-0 cursor-grab rounded p-1 text-muted-foreground transition",
                "hover:bg-muted hover:text-foreground active:cursor-grabbing",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                disabled && "cursor-not-allowed opacity-40"
              )}
            >
              <GripVertical className="size-4" />
            </button>

            <div className="min-w-0 flex-1">{renderItem(item, index)}</div>
          </div>
        );
      })}
    </div>
  );
}
