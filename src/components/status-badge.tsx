import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const tones = {
  success: "bg-[#affebf] text-[#014b40]",
  warning: "bg-[#ffd6a4] text-[#5e4200]",
  critical: "bg-[#fed1cd] text-[#8e1f0b]",
  info: "bg-[#e0f0ff] text-[#00527c]",
  neutral: "bg-[#e3e3e3] text-[#303030]",
  attention: "bg-[#ffeb78] text-[#4f4700]",
} as const;

export type BadgeTone = keyof typeof tones;

const toneMap: Record<string, BadgeTone> = {
  Active: "success",
  Draft: "info",
  Archived: "neutral",
  Paid: "success",
  paid: "success",
  Pending: "warning",
  pending: "warning",
  Refunded: "info",
  refunded: "info",
  Failed: "critical",
  failed: "critical",
  booked: "info",
  accepted: "success",
  design_review: "attention",
  preparing: "warning",
  label_create: "info",
  shipped: "info",
  ready_for_pickup: "attention",
  completed: "success",
  cancelled: "critical",
  PENDING: "warning",
  LABEL_CREATED: "info",
  PICKUP_SCHEDULED: "info",
  PICKED_UP: "info",
  SHIPPED: "info",
  IN_TRANSIT: "attention",
  OUT_FOR_DELIVERY: "attention",
  DELIVERED: "success",
  RETURNED: "critical",
  FAILED: "critical",
  CANCELLED: "critical",
  PROCESSING: "warning",
  Fulfilled: "success",
  Unfulfilled: "attention",
  "Partially fulfilled": "warning",
  Subscribed: "success",
  "Not subscribed": "neutral",
  Expired: "critical",
  "Used up": "neutral",
};

const capitalize = (s: string) =>
  s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function StatusBadge({
  status,
  tone,
  className,
}: {
  status: string;
  tone?: BadgeTone;
  className?: string;
}) {
  const resolved = tone ?? toneMap[status] ?? "neutral";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-medium",
        tones[resolved],
        className
      )}
    >
      {capitalize(status)}
    </span>
  );
}

export function StatusToggle({
  isActive,
  onToggle,
  disabled,
}: {
  isActive: boolean;
  onToggle: (next: boolean) => Promise<void> | void;
  disabled?: boolean;
}) {
  const [loading, setLoading] = React.useState(false);
  return (
    <button
      type="button"
      disabled={disabled || loading}
      onClick={async (e) => {
        e.stopPropagation();
        setLoading(true);
        try {
          await onToggle(!isActive);
        } finally {
          setLoading(false);
        }
      }}
      className="cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? (
        <span className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-0.5 text-xs font-medium">
          <Loader2 className="size-3 animate-spin" />
        </span>
      ) : (
        <StatusBadge status={isActive ? "Active" : "Inactive"} tone={isActive ? "success" : "neutral"} />
      )}
    </button>
  );
}
