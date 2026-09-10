"use client";

import * as React from "react";
import { GripVertical } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The grab affordance for a reorderable row. Spread the `handleProps` from
 * `useDragReorder` onto it; arrow keys move the row for keyboard users.
 */
export function DragHandle({
  label,
  className,
  disabled,
  ...props
}: React.ComponentProps<"button"> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={`Reorder ${label}. Drag, or use arrow keys.`}
      title="Drag to reorder"
      disabled={disabled}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "shrink-0 cursor-grab rounded p-1 text-muted-foreground transition",
        "hover:bg-muted hover:text-foreground active:cursor-grabbing",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        disabled && "cursor-not-allowed opacity-40",
        className
      )}
      {...props}
    >
      <GripVertical className="size-3.5" />
    </button>
  );
}
