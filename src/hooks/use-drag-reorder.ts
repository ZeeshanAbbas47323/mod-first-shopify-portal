"use client";

import * as React from "react";
import { toast } from "sonner";

import { apiErrorMessage } from "@/lib/auth-api";

interface Options {
  /**
   * Persists the new order. The list has already moved on screen, so a
   * rejection here is what puts the previous order back.
   */
  onReorder: (fromIndex: number, toIndex: number) => Promise<unknown>;
  disabled?: boolean;
  /** Toast shown when the save fails. */
  errorMessage?: string;
}

/**
 * Drag-to-reorder wiring for any list shape - a grid of cards, table rows, or
 * a stack of panels. It owns only the drag state and hands back prop bundles,
 * so each call site keeps its own markup and styling.
 *
 * Built on native HTML5 drag events, so it adds no dependency. Only the handle
 * starts a drag, which keeps text inside a row selectable.
 */
export function useDragReorder({
  onReorder,
  disabled = false,
  errorMessage = "Couldn't save the new order.",
}: Options) {
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const [overIndex, setOverIndex] = React.useState<number | null>(null);
  const [saving, setSaving] = React.useState(false);

  const reset = () => {
    setDragIndex(null);
    setOverIndex(null);
  };

  const commit = React.useCallback(
    async (from: number, to: number) => {
      if (from === to) return;
      setSaving(true);
      try {
        await onReorder(from, to);
      } catch (error) {
        toast.error(apiErrorMessage(error, errorMessage));
      } finally {
        setSaving(false);
      }
    },
    [onReorder, errorMessage]
  );

  /** Spread onto the element that should accept a drop (the row or card). */
  const dropProps = (index: number) => ({
    onDragOver: (e: React.DragEvent) => {
      if (disabled || dragIndex === null) return;
      e.preventDefault();
      if (overIndex !== index) setOverIndex(index);
    },
    onDragLeave: () => {
      setOverIndex((current) => (current === index ? null : current));
    },
    onDrop: (e: React.DragEvent) => {
      if (disabled || dragIndex === null) return;
      e.preventDefault();
      const from = dragIndex;
      reset();
      void commit(from, index);
    },
  });

  /** Spread onto the grip button that starts the drag. */
  const handleProps = (index: number, count: number) => ({
    draggable: !disabled,
    onDragStart: (e: React.DragEvent) => {
      if (disabled) return;
      setDragIndex(index);
      e.dataTransfer.effectAllowed = "move";
      // Firefox refuses to start a drag unless data is set.
      e.dataTransfer.setData("text/plain", String(index));
    },
    onDragEnd: reset,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (disabled) return;
      if (e.key === "ArrowUp" && index > 0) {
        e.preventDefault();
        void commit(index, index - 1);
      } else if (e.key === "ArrowDown" && index < count - 1) {
        e.preventDefault();
        void commit(index, index + 1);
      }
    },
  });

  return {
    saving,
    dragIndex,
    overIndex,
    isDragging: (index: number) => dragIndex === index,
    isOver: (index: number) => overIndex === index && dragIndex !== index,
    dropProps,
    handleProps,
  };
}

/** Returns a copy of `rows` with the item at `from` moved to `to`. */
export function moveItem<T>(rows: T[], from: number, to: number): T[] {
  const next = [...rows];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
