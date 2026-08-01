import { cn } from "@/lib/utils";

/** Shopify Polaris badge tones */
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
  // product status
  Active: "success",
  Draft: "info",
  Archived: "neutral",
  // payment status
  Paid: "success",
  paid: "success",
  Pending: "warning",
  pending: "warning",
  Refunded: "info",
  refunded: "info",
  Failed: "critical",
  failed: "critical",
  // order status
  booked: "info",
  accepted: "success",
  design_review: "attention",
  preparing: "warning",
  label_create: "info",
  shipped: "info",
  ready_for_pickup: "attention",
  completed: "success",
  cancelled: "critical",
  // shipment status
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
  // fulfillment status
  Fulfilled: "success",
  Unfulfilled: "attention",
  "Partially fulfilled": "warning",
  // customers
  Subscribed: "success",
  "Not subscribed": "neutral",
  // coupons
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
