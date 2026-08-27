"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowLeft,
  Heart,
  Loader2,
  Mail,
  MapPin,
  Phone,
  ShoppingCart,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { apiErrorMessage } from "@/lib/auth-api";
import { cn, imgUrl } from "@/lib/utils";
import {
  listAddresses,
  listCartItems,
  listOrders,
  listUsers,
  listWishlists,
  type AddressRow,
  type CartItemRow,
  type OrderRow,
  type UserRow,
  type WishlistRow,
} from "@/lib/admin-api";

const money = (v?: number | string | null) =>
  v != null
    ? Number(v).toLocaleString("en-US", { style: "currency", currency: "USD" })
    : "—";

const fmtDate = (v?: string) => {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "—" : format(d, "MMM d, yyyy");
};

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [customer, setCustomer] = React.useState<UserRow | null>(null);
  const [orders, setOrders] = React.useState<OrderRow[]>([]);
  const [addresses, setAddresses] = React.useState<AddressRow[]>([]);
  const [cart, setCart] = React.useState<CartItemRow[]>([]);
  const [wishlist, setWishlist] = React.useState<WishlistRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);

    // The user list is the only place a single admin user can be looked up.
    listUsers({ page: 1, limit: 1, filters: { id: Number(id) } })
      .then((res) => !cancelled && setCustomer(res.rows[0] ?? null))
      .catch((e) => {
        if (cancelled) return;
        toast.error(apiErrorMessage(e, "Couldn't load the customer."));
      })
      .finally(() => !cancelled && setLoading(false));

    // Each related list is optional — one failing shouldn't blank the page.
    listOrders({ page: 1, limit: 10, filters: { user_id: Number(id) } })
      .then((res) => !cancelled && setOrders(res.rows))
      .catch(() => {});
    listAddresses({ page: 1, limit: 20, filters: { user_id: Number(id) } })
      .then((res) => !cancelled && setAddresses(res.rows))
      .catch(() => {});
    listCartItems({ page: 1, limit: 20, filters: { user_id: Number(id) } })
      .then((res) => !cancelled && setCart(res.rows))
      .catch(() => {});
    listWishlists({ page: 1, limit: 20, filters: { user_id: Number(id) } })
      .then((res) => !cancelled && setWishlist(res.rows))
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
        <p className="text-sm font-medium text-foreground">Customer not found</p>
        <Button variant="outline" size="sm" onClick={() => router.push("/customers")}>
          <ArrowLeft className="size-4" /> Back to customers
        </Button>
      </div>
    );
  }

  const initials =
    (customer.full_name ?? "?")
      .split(/\s+/)
      .map((p) => p[0] ?? "")
      .join("")
      .slice(0, 2)
      .toUpperCase() || "??";

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => router.push("/customers")}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <span className="flex size-10 items-center justify-center rounded-full bg-[#e0f0ff] text-sm font-semibold text-[#00527c]">
          {initials}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold">{customer.full_name}</h1>
          <p className="truncate text-sm text-muted-foreground">
            {customer.role?.replace(/_/g, " ")} · joined {fmtDate(customer.created_at)}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <StatusBadge
            status={customer.is_active === false ? "Inactive" : "Active"}
            tone={customer.is_active === false ? "neutral" : "success"}
          />
          {customer.is_locked && <StatusBadge status="Locked" tone="critical" />}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        {/* ── Left ── */}
        <div className="flex flex-col gap-4">
          {/* Orders */}
          <Card>
            <CardHeader className="flex-row items-center gap-2 pb-3">
              <ShoppingCart className="size-4 text-muted-foreground" />
              <CardTitle className="text-base">Recent orders</CardTitle>
              <span className="text-xs text-muted-foreground">{orders.length}</span>
            </CardHeader>
            <CardContent className="p-0">
              {orders.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No orders yet.
                </p>
              ) : (
                <div className="divide-y">
                  {orders.map((o) => (
                    <Link
                      key={String(o.id)}
                      href={`/orders/${o.id}`}
                      className="flex items-center justify-between px-6 py-3 text-sm hover:bg-muted/50"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-mono font-medium">
                          {o.order_number ?? `#${o.id}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {fmtDate(o.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={o.status ?? "—"} />
                        <span className="font-medium tabular-nums">
                          {money(o.total_amount as number | string | undefined)}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cart */}
          <Card>
            <CardHeader className="flex-row items-center gap-2 pb-3">
              <ShoppingCart className="size-4 text-muted-foreground" />
              <CardTitle className="text-base">Current cart</CardTitle>
              <span className="text-xs text-muted-foreground">{cart.length}</span>
            </CardHeader>
            <CardContent className="p-0">
              {cart.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Cart is empty.
                </p>
              ) : (
                <div className="divide-y">
                  {cart.map((c) => (
                    <div
                      key={String(c.id)}
                      className="flex items-center gap-3 px-6 py-3 text-sm"
                    >
                      {c.product?.featured_image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={imgUrl(c.product.featured_image)}
                          alt=""
                          className="size-9 rounded-lg border border-border object-cover"
                        />
                      ) : (
                        <span className="size-9 rounded-lg border border-border bg-muted" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {c.product?.title ?? c.product?.name ?? `Product #${c.product_id}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Qty {c.quantity ?? 1}
                          {c.variant_id != null ? ` · variant #${c.variant_id}` : ""}
                        </p>
                      </div>
                      <span className="font-medium tabular-nums">
                        {money(c.product?.price)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Wishlist */}
          <Card>
            <CardHeader className="flex-row items-center gap-2 pb-3">
              <Heart className="size-4 text-muted-foreground" />
              <CardTitle className="text-base">Wishlist</CardTitle>
              <span className="text-xs text-muted-foreground">{wishlist.length}</span>
            </CardHeader>
            <CardContent className="p-0">
              {wishlist.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Nothing saved.
                </p>
              ) : (
                <div className="divide-y">
                  {wishlist.map((w) => (
                    <div
                      key={String(w.id)}
                      className="flex items-center gap-3 px-6 py-3 text-sm"
                    >
                      {w.product?.featured_image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={imgUrl(w.product.featured_image)}
                          alt=""
                          className="size-9 rounded-lg border border-border object-cover"
                        />
                      ) : (
                        <span className="size-9 rounded-lg border border-border bg-muted" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {w.product?.title ?? w.product?.name ?? `Product #${w.product_id}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Saved {fmtDate(w.created_at)}
                        </p>
                      </div>
                      <span className="font-medium tabular-nums">
                        {money(w.product?.price)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Right ── */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <a
                href={`mailto:${customer.email}`}
                className="flex items-center gap-2 text-[#005bd3] hover:underline"
              >
                <Mail className="size-3.5 shrink-0" />
                <span className="truncate">{customer.email}</span>
              </a>
              {customer.phone && (
                <a
                  href={`tel:${customer.phone}`}
                  className="flex items-center gap-2 text-[#005bd3] hover:underline"
                >
                  <Phone className="size-3.5 shrink-0" />
                  {customer.phone}
                </a>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center gap-2 pb-3">
              <MapPin className="size-4 text-muted-foreground" />
              <CardTitle className="text-base">Addresses</CardTitle>
              <span className="text-xs text-muted-foreground">{addresses.length}</span>
            </CardHeader>
            <CardContent className="space-y-2">
              {addresses.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No saved addresses.
                </p>
              ) : (
                addresses.map((a) => (
                  <div
                    key={String(a.id)}
                    className={cn(
                      "rounded-xl border border-border p-3 text-sm",
                      a.is_default && "border-[#005bd3]"
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium">{a.full_name ?? "—"}</p>
                      {a.is_default && <StatusBadge status="Default" tone="info" />}
                    </div>
                    <p className="text-muted-foreground">
                      {[a.address_line1, a.address_line2, a.city, a.state, a.postal_code, a.country]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                    {a.phone && (
                      <p className="text-xs text-muted-foreground">{a.phone}</p>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
