"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ChevronDown, Loader2, MapPin, Package } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { imgUrl, cn } from "@/lib/utils";
import { listOrders } from "@/lib/admin-api";


export interface CustomerPreviewData {
  user_id?: number | string | null;
  name: string;
  email?: string | null;
  city?: string | null;
  country?: string | null;
}

export function CustomerPreviewPopover({ customer }: { customer: CustomerPreviewData }) {
  const [orderCount, setOrderCount] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(false);

  const location = [customer.city, customer.country].filter(Boolean).join(", ");

  const load = () => {
    if (orderCount !== null || !customer.user_id) return;
    setLoading(true);
    listOrders({ page: 1, limit: 1, filters: { user_id: customer.user_id } })
      .then((res) => setOrderCount(res.total))
      .catch(() => setOrderCount(null))
      .finally(() => setLoading(false));
  };

  return (
    <Popover onOpenChange={(open) => open && load()}>
      <PopoverTrigger
        render={
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className="font-medium text-left hover:text-[#005bd3] hover:underline"
          >
            {customer.name}
          </button>
        }
      />
      <PopoverContent align="start" className="w-64" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col gap-2">
          <div>
            <p className="text-sm font-semibold">{customer.name}</p>
            {location && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="size-3" /> {location}
              </p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {loading ? (
              <Loader2 className="size-3 animate-spin" />
            ) : orderCount != null ? (
              `${orderCount} order${orderCount === 1 ? "" : "s"}`
            ) : null}
          </p>
          {customer.email && (
            <a
              href={`mailto:${customer.email}`}
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-[#005bd3] hover:underline"
            >
              {customer.email}
            </a>
          )}
          {customer.user_id && (
            <>
              <Separator />
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                render={<Link href={`/customers/${customer.user_id}`} onClick={(e) => e.stopPropagation()} />}
              >
                View customer
              </Button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}


export interface FulfillmentPreviewItem {
  id: number | string;
  name: string;
  variant?: string | null;
  quantity: number;
  image?: string | null;
}

export function pickupOrDeliveryBlurb(input: {
  delivery_type?: string | null;
  pickupLocationName?: string | null;
  estimatedDeliveryDate?: string | null;
}): string | null {
  if (input.delivery_type === "store_pickup" && input.pickupLocationName) {
    return `Pickup at ${input.pickupLocationName}`;
  }
  if (input.estimatedDeliveryDate) {
    const d = new Date(input.estimatedDeliveryDate);
    if (!isNaN(d.getTime())) return `Deliver by ${format(d, "EEE, MMM d")}`;
  }
  return null;
}

export function FulfillmentPreviewPopover({
  items,
  deliveryBlurb,
}: {
  items: FulfillmentPreviewItem[];
  deliveryBlurb?: string | null;
}) {
  if (!items.length) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-sm hover:text-[#005bd3]"
          >
            {items.length} item{items.length !== 1 ? "s" : ""}
            <ChevronDown className="size-3.5" />
          </button>
        }
      />
      <PopoverContent align="start" className="w-72" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col gap-2.5">
          {deliveryBlurb && (
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Package className="size-3.5" /> {deliveryBlurb}
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {items.slice(0, 6).map((item) => (
              <li key={item.id} className="flex items-center gap-2.5">
                <div className={cn(
                  "flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted",
                )}>
                  {item.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imgUrl(item.image)} alt="" className="size-full object-cover" />
                  ) : (
                    <Package className="size-4 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{item.name}</p>
                  {item.variant && (
                    <p className="truncate text-xs text-muted-foreground">{item.variant}</p>
                  )}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">x{item.quantity}</span>
              </li>
            ))}
          </ul>
          {items.length > 6 && (
            <p className="text-xs text-muted-foreground">+{items.length - 6} more</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
