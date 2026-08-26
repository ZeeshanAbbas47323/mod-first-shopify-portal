"use client";

import * as React from "react";
import {
  Loader2,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { apiErrorMessage } from "@/lib/auth-api";
import { cn, imgUrl } from "@/lib/utils";
import {
  listPickupLocations,
  listProducts,
  listUsers,
  type PickupLocationRow,
  type ProductRow,
  type UserRow,
} from "@/lib/admin-api";
import {
  createPosOrder,
  getCurrentShift,
  type PosOrderItemInput,
  type ShiftRow,
} from "@/lib/pos-api";
import { ShiftBar, money } from "@/components/pos/shift-bar";
import { PosPaymentDialog } from "@/components/pos/payment-dialog";

interface CartLine {
  product: ProductRow;
  quantity: number;
  custom_text?: string;
}

export default function PosRegisterPage() {
  // Shift
  const [shift, setShift] = React.useState<ShiftRow | null>(null);
  const [shiftLoading, setShiftLoading] = React.useState(true);
  const [shiftKey, setShiftKey] = React.useState(0);

  // Catalogue
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [products, setProducts] = React.useState<ProductRow[]>([]);
  const [productsLoading, setProductsLoading] = React.useState(true);

  // Cart
  const [lines, setLines] = React.useState<CartLine[]>([]);
  const [notes, setNotes] = React.useState("");
  const [coupon, setCoupon] = React.useState("");

  // Customer
  const [customer, setCustomer] = React.useState<UserRow | null>(null);
  const [customerSearch, setCustomerSearch] = React.useState("");
  const [customerResults, setCustomerResults] = React.useState<UserRow[]>([]);
  const [customerOpen, setCustomerOpen] = React.useState(false);

  // Fulfilment
  const [deliveryType, setDeliveryType] = React.useState<"store_pickup" | "home_delivery">(
    "store_pickup"
  );
  const [pickupLocations, setPickupLocations] = React.useState<PickupLocationRow[]>([]);
  const [pickupId, setPickupId] = React.useState("");

  // Checkout
  const [placing, setPlacing] = React.useState(false);
  const [placedOrder, setPlacedOrder] = React.useState<{ code: string; total: number } | null>(
    null
  );

  React.useEffect(() => {
    setShiftLoading(true);
    getCurrentShift()
      .then(setShift)
      .catch(() => setShift(null))
      .finally(() => setShiftLoading(false));
  }, [shiftKey]);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  React.useEffect(() => {
    let cancelled = false;
    setProductsLoading(true);
    listProducts({
      page: 1,
      limit: 24,
      filters: { title: debounced || undefined, status: "published" },
    })
      .then((res) => !cancelled && setProducts(res.rows))
      .catch((error) => {
        if (cancelled) return;
        setProducts([]);
        toast.error(apiErrorMessage(error, "Couldn't load products."));
      })
      .finally(() => !cancelled && setProductsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  React.useEffect(() => {
    listPickupLocations({ page: 1, limit: 100, filters: { is_active: true } })
      .then((res) => {
        setPickupLocations(res.rows);
        if (res.rows[0]) setPickupId(String(res.rows[0].id));
      })
      .catch(() => setPickupLocations([]));
  }, []);

  // Customer lookup
  React.useEffect(() => {
    if (!customerSearch.trim()) {
      setCustomerResults([]);
      return;
    }
    const t = setTimeout(() => {
      listUsers({
        page: 1,
        limit: 8,
        filters: { full_name: customerSearch.trim(), role: "customer" },
      })
        .then((res) => setCustomerResults(res.rows))
        .catch(() => setCustomerResults([]));
    }, 350);
    return () => clearTimeout(t);
  }, [customerSearch]);

  // ── Cart helpers ──────────────────────────────────────────────────────────
  const addLine = (product: ProductRow) => {
    setLines((prev) => {
      const i = prev.findIndex((l) => String(l.product.id) === String(product.id));
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], quantity: next[i].quantity + 1 };
        return next;
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const setQty = (id: number | string, qty: number) =>
    setLines((prev) =>
      qty <= 0
        ? prev.filter((l) => String(l.product.id) !== String(id))
        : prev.map((l) =>
            String(l.product.id) === String(id) ? { ...l, quantity: qty } : l
          )
    );

  const removeLine = (id: number | string) =>
    setLines((prev) => prev.filter((l) => String(l.product.id) !== String(id)));

  const clearCart = () => {
    setLines([]);
    setNotes("");
    setCoupon("");
    setCustomer(null);
    setCustomerSearch("");
  };

  const subtotal = lines.reduce(
    (sum, l) => sum + Number(l.product.price ?? 0) * l.quantity,
    0
  );
  const itemCount = lines.reduce((sum, l) => sum + l.quantity, 0);

  const shiftOpen = shift?.status === "open";
  const canCheckout =
    shiftOpen &&
    lines.length > 0 &&
    (deliveryType !== "store_pickup" || !!pickupId) &&
    !placing;

  const placeOrder = async () => {
    if (!canCheckout) return;
    setPlacing(true);
    try {
      const items: PosOrderItemInput[] = lines.map((l) => ({
        product_id: l.product.id,
        quantity: l.quantity,
        custom_text: l.custom_text || undefined,
      }));

      const order = await createPosOrder({
        items,
        delivery_type: deliveryType,
        pickup_location_id: deliveryType === "store_pickup" ? pickupId : undefined,
        user_id: customer?.id,
        email: customer?.email,
        full_name: customer?.full_name,
        phone: customer?.phone,
        coupon_code: coupon.trim() || undefined,
        notes: notes.trim() || undefined,
        send_email: false,
      });

      const code = order.order_code ?? order.order_number;
      if (!code) throw new Error("Order created but no order code was returned.");

      setPlacedOrder({
        code: String(code),
        total: Number(order.total_amount ?? subtotal),
      });
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't create the sale."));
    } finally {
      setPlacing(false);
    }
  };

  const pickupItems = React.useMemo<Record<string, string>>(
    () => Object.fromEntries(pickupLocations.map((p) => [String(p.id), p.name])),
    [pickupLocations]
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Register</h1>
          <p className="text-sm text-muted-foreground">
            Ring up counter sales, take payment and print the receipt.
          </p>
        </div>
      </div>

      <ShiftBar
        shift={shift}
        loading={shiftLoading}
        onChanged={() => setShiftKey((k) => k + 1)}
      />

      {!shiftLoading && !shiftOpen && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-400">
          {shift?.status === "paused"
            ? "This shift is paused — resume it before ringing up a sale."
            : "Open a shift before ringing up a sale."}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        {/* ── Catalogue ─────────────────────────────────────────────────── */}
        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <div className="relative">
              <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products by name…"
                className="pl-8"
                autoFocus
              />
            </div>
          </CardHeader>
          <CardContent>
            {productsLoading ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-36 rounded-xl" />
                ))}
              </div>
            ) : products.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No products found.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {products.map((p) => {
                  const out = (p.quantity ?? 0) <= 0;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={!shiftOpen}
                      onClick={() => addLine(p)}
                      className={cn(
                        "group flex flex-col overflow-hidden rounded-xl border border-border text-left transition-colors hover:border-primary/50 hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
                      )}
                    >
                      <div className="flex h-20 items-center justify-center overflow-hidden bg-muted/40">
                        {p.featured_image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={imgUrl(p.featured_image)}
                            alt={p.title}
                            className="size-full object-cover"
                          />
                        ) : (
                          <ShoppingCart className="size-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex flex-1 flex-col gap-0.5 p-2">
                        <p className="line-clamp-2 text-sm font-medium">{p.title}</p>
                        <p className="mt-auto text-sm font-semibold tabular-nums">
                          {money(p.price)}
                        </p>
                        <p
                          className={cn(
                            "text-[11px]",
                            out ? "text-destructive" : "text-muted-foreground"
                          )}
                        >
                          {out ? "Out of stock" : `${p.quantity ?? 0} in stock`}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Cart ──────────────────────────────────────────────────────── */}
        <Card className="flex h-fit flex-col shadow-none lg:sticky lg:top-20">
          <CardHeader className="flex-row items-center gap-2 pb-3">
            <ShoppingCart className="size-4 text-muted-foreground" />
            <CardTitle className="text-base">Cart</CardTitle>
            {itemCount > 0 && (
              <span className="rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground">
                {itemCount}
              </span>
            )}
            {lines.length > 0 && (
              <button
                type="button"
                onClick={clearCart}
                className="ml-auto text-xs text-muted-foreground hover:text-destructive"
              >
                Clear
              </button>
            )}
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Lines */}
            {lines.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Tap a product to add it.
              </p>
            ) : (
              <div className="space-y-2">
                {lines.map((l) => (
                  <div
                    key={String(l.product.id)}
                    className="flex items-start gap-2 rounded-lg border border-border p-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{l.product.title}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {money(l.product.price)} each
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label="Decrease"
                        onClick={() => setQty(l.product.id, l.quantity - 1)}
                        className="rounded p-1 text-muted-foreground hover:bg-muted"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <span className="w-6 text-center text-sm font-medium tabular-nums">
                        {l.quantity}
                      </span>
                      <button
                        type="button"
                        aria-label="Increase"
                        onClick={() => setQty(l.product.id, l.quantity + 1)}
                        className="rounded p-1 text-muted-foreground hover:bg-muted"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                    <span className="w-16 text-right text-sm font-semibold tabular-nums">
                      {money(Number(l.product.price ?? 0) * l.quantity)}
                    </span>
                    <button
                      type="button"
                      aria-label="Remove"
                      onClick={() => removeLine(l.product.id)}
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <Separator />

            {/* Customer */}
            <div className="space-y-1.5">
              <Label>Customer</Label>
              {customer ? (
                <div className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-2">
                  <UserRound className="size-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{customer.full_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {customer.email}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Clear customer"
                    onClick={() => setCustomer(null)}
                    className="rounded p-1 text-muted-foreground hover:bg-muted"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Input
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setCustomerOpen(true);
                    }}
                    onFocus={() => setCustomerOpen(true)}
                    placeholder="Walk-in — search to attach a customer"
                  />
                  {customerOpen && customerResults.length > 0 && (
                    <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-md">
                      {customerResults.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            setCustomer(u);
                            setCustomerOpen(false);
                            setCustomerSearch("");
                          }}
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                        >
                          <span className="font-medium">{u.full_name}</span>
                          <span className="block text-xs text-muted-foreground">
                            {u.email}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Fulfilment */}
            <div className="space-y-1.5">
              <Label>Fulfilment</Label>
              <Select
                items={{ store_pickup: "Store pickup", home_delivery: "Home delivery" }}
                value={deliveryType}
                onValueChange={(v) =>
                  setDeliveryType(v as "store_pickup" | "home_delivery")
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="store_pickup">Store pickup</SelectItem>
                  <SelectItem value="home_delivery">Home delivery</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {deliveryType === "store_pickup" && (
              <div className="space-y-1.5">
                <Label>Pickup location</Label>
                <Select
                  items={pickupItems}
                  value={pickupId}
                  onValueChange={(v) => setPickupId(v as string)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a location" />
                  </SelectTrigger>
                  <SelectContent>
                    {pickupLocations.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {pickupLocations.length === 0 && (
                  <p className="text-xs text-destructive">
                    No pickup locations configured.
                  </p>
                )}
              </div>
            )}

            {deliveryType === "home_delivery" && (
              <p className="rounded-lg bg-muted/50 px-2.5 py-2 text-xs text-muted-foreground">
                Home delivery needs a saved address on the customer — attach a customer
                who has one, or switch to store pickup.
              </p>
            )}

            {/* Coupon + notes */}
            <div className="space-y-1.5">
              <Label htmlFor="pos-coupon">Coupon code</Label>
              <Input
                id="pos-coupon"
                value={coupon}
                onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                placeholder="SAVE10"
                className="font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pos-notes">Notes</Label>
              <Textarea
                id="pos-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Paid at counter"
              />
            </div>

            <Separator />

            {/* Totals */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-semibold tabular-nums">{money(subtotal)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Tax, shipping and discounts are calculated by the server on checkout.
            </p>

            <Button className="w-full" disabled={!canCheckout} onClick={placeOrder}>
              {placing && <Loader2 className="size-4 animate-spin" />}
              Charge {money(subtotal)}
            </Button>
          </CardContent>
        </Card>
      </div>

      {placedOrder && (
        <PosPaymentDialog
          open={!!placedOrder}
          onOpenChange={(next) => {
            if (!next) {
              setPlacedOrder(null);
              clearCart();
              setShiftKey((k) => k + 1);
            }
          }}
          orderCode={placedOrder.code}
          total={placedOrder.total}
          onCompleted={() => setShiftKey((k) => k + 1)}
        />
      )}
    </div>
  );
}
