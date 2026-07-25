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
  Paid: "neutral",
  Pending: "warning",
  Refunded: "neutral",
  // fulfillment status
  Fulfilled: "neutral",
  Unfulfilled: "attention",
  "Partially fulfilled": "warning",
  // customers
  Subscribed: "success",
  "Not subscribed": "neutral",
  // coupons
  Expired: "critical",
  "Used up": "neutral",
};

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
      {status}
    </span>
  );
}
