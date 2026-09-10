import { cn } from "@/lib/utils";

/**
 * The in-panel empty message. Most places in the admin already pair a headline
 * with a line telling you what to do next; this keeps that pairing consistent
 * for the panels that only had a bare sentence.
 *
 * The full-page table empty state lives in `data-table.tsx` - this is the
 * smaller sibling for cards, drawers and side panels.
 */
export function EmptyState({
  title,
  hint,
  action,
  className,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-1 px-4 py-10 text-center",
        className
      )}
    >
      <p className="text-sm font-medium text-foreground">{title}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
