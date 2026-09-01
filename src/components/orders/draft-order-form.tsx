"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Package,
  Plus,
  MapPin,
  Search,
  Tag,
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
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { StatusBadge } from "@/components/status-badge";
import { CompleteDraftDialog } from "@/components/orders/complete-draft-dialog";
import { DRAFT_TONES } from "@/app/(admin)/orders/drafts/page";
import { apiErrorMessage } from "@/lib/auth-api";
import { cn, imgUrl } from "@/lib/utils";
import {
  DRAFT_STATUS_LABELS,
  createAddress,
  createDraftOrder,
  createUser,
  deleteDraftOrder,
  listCustomerAddresses,
  listPickupLocations,
  listProducts,
  listUsers,
  updateDraftOrder,
  type AddressRow,
  type DraftOrderItem,
  type DraftOrderRow,
  type PickupLocationRow,
  type ProductRow,
  type UserRow,
} from "@/lib/admin-api";
import { PRINT_METHODS } from "@/lib/pos-api";

const money = (v?: number | string | null) =>
  Number(v ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD" });

/** A line while it's being edited — prices stay strings so inputs stay usable. */
interface LineDraft {
  key: string;
  product_id: number | string;
  variant_id?: number | string | null;
  title: string;
  image?: string | null;
  quantity: string;
  unit_price: string;
  print_method?: string;
  custom_text?: string;
  width?: string;
  height?: string;
  is_tax_applied: boolean;
}

const toLine = (item: DraftOrderItem, i: number): LineDraft => ({
  key: String(item.id ?? `${item.product_id}-${i}`),
  product_id: item.product_id,
  variant_id: item.variant_id ?? null,
  title:
    item.product?.name ??
    item.product?.title ??
    `Product #${item.product_id}`,
  image:
    item.product?.featured_image ??
    ((item.product?.images?.[0] as { image_url?: string; url?: string } | undefined)
      ?.image_url ??
      (item.product?.images?.[0] as { url?: string } | undefined)?.url ??
      null),
  quantity: String(item.quantity ?? 1),
  unit_price: item.unit_price != null ? String(item.unit_price) : "",
  print_method: item.print_method ?? undefined,
  custom_text: item.custom_text ?? undefined,
  width: item.width != null ? String(item.width) : "",
  height: item.height != null ? String(item.height) : "",
  is_tax_applied: item.is_tax_applied !== false,
});

export function DraftOrderForm({ draft }: { draft?: DraftOrderRow }) {
  const router = useRouter();
  const isEdit = !!draft;
  const isCompleted = draft?.status === "completed";
  const isCancelled = draft?.status === "cancelled";
  const locked = isCompleted || isCancelled;

  const [lines, setLines] = React.useState<LineDraft[]>(
    (draft?.items ?? []).map(toLine)
  );
  const [customer, setCustomer] = React.useState<UserRow | null>(
    draft?.customer
      ? ({
          id: draft.customer.id ?? draft.user_id ?? "",
          full_name: draft.customer.full_name ?? "",
          email: draft.customer.email ?? "",
          phone: draft.customer.phone,
        } as UserRow)
      : null
  );
  const [guestName, setGuestName] = React.useState(draft?.full_name ?? "");
  const [guestEmail, setGuestEmail] = React.useState(draft?.email ?? "");
  const [guestPhone, setGuestPhone] = React.useState(draft?.phone ?? "");

  const [deliveryType, setDeliveryType] = React.useState<
    "home_delivery" | "store_pickup"
  >(draft?.delivery_type ?? "home_delivery");
  const [pickupId, setPickupId] = React.useState(
    draft?.pickup_location_id != null ? String(draft.pickup_location_id) : ""
  );
  const [pickupLocations, setPickupLocations] = React.useState<PickupLocationRow[]>([]);

  const [addresses, setAddresses] = React.useState<AddressRow[]>([]);
  const [addressLoading, setAddressLoading] = React.useState(false);
  const [shippingAddressId, setShippingAddressId] = React.useState(
    draft?.shipping_address_id != null ? String(draft.shipping_address_id) : ""
  );
  const [billingSame, setBillingSame] = React.useState(
    draft?.billing_address_id == null ||
      String(draft.billing_address_id) === String(draft.shipping_address_id)
  );
  const [addressOpen, setAddressOpen] = React.useState(false);
  const [customerOpen, setCustomerOpen] = React.useState(false);

  const [couponCode, setCouponCode] = React.useState(draft?.coupon_code ?? "");
  const [discountType, setDiscountType] = React.useState<string>(
    draft?.manual_discount_type ?? "none"
  );
  const [discountValue, setDiscountValue] = React.useState(
    draft?.manual_discount_value != null ? String(draft.manual_discount_value) : ""
  );
  const [discountReason, setDiscountReason] = React.useState(
    draft?.manual_discount_reason ?? ""
  );
  const [notes, setNotes] = React.useState(draft?.notes ?? "");

  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [completeOpen, setCompleteOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => {
    listPickupLocations({ page: 1, limit: 100, filters: { is_active: true } })
      .then((res) => setPickupLocations(res.rows))
      .catch(() => setPickupLocations([]));
  }, []);

  const loadAddresses = React.useCallback(() => {
    const target = { id: customer?.id, email: customer?.email ?? guestEmail };
    if (!target.id && !target.email) {
      setAddresses([]);
      return;
    }
    setAddressLoading(true);
    listCustomerAddresses(target)
      .then((rows) => {
        setAddresses(rows);
        // Pre-select the default address so the draft can be completed.
        setShippingAddressId((current) => {
          if (current && rows.some((a) => String(a.id) === current)) return current;
          const preferred = rows.find((a) => a.is_default) ?? rows[0];
          return preferred ? String(preferred.id) : "";
        });
      })
      .catch(() => setAddresses([]))
      .finally(() => setAddressLoading(false));
  }, [customer?.id, customer?.email, guestEmail]);

  React.useEffect(() => {
    if (deliveryType === "home_delivery") loadAddresses();
  }, [deliveryType, loadAddresses]);

  // ── Line helpers ──────────────────────────────────────────────────────────
  const addProduct = (p: ProductRow) => {
    setLines((prev) => {
      const i = prev.findIndex(
        (l) => String(l.product_id) === String(p.id) && !l.variant_id
      );
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], quantity: String(Number(next[i].quantity || 0) + 1) };
        return next;
      }
      return [
        ...prev,
        {
          key: `new-${p.id}-${Date.now()}`,
          product_id: p.id,
          variant_id: null,
          title: p.title,
          image: p.featured_image,
          quantity: "1",
          unit_price: p.price != null ? String(p.price) : "",
          is_tax_applied: true,
          width: "",
          height: "",
        },
      ];
    });
  };

  const patchLine = (key: string, patch: Partial<LineDraft>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const removeLine = (key: string) =>
    setLines((prev) => prev.filter((l) => l.key !== key));

  // ── Totals (display only — the server recalculates on complete) ────────────
  const subtotal = lines.reduce(
    (sum, l) => sum + Number(l.unit_price || 0) * Number(l.quantity || 0),
    0
  );
  const manualDiscount =
    discountType === "percentage"
      ? (subtotal * Number(discountValue || 0)) / 100
      : discountType === "fixed_amount"
        ? Number(discountValue || 0)
        : 0;
  const estimatedTotal = Math.max(0, subtotal - manualDiscount);

  const buildBody = () => ({
    user_id: customer?.id ?? undefined,
    email: (customer?.email ?? guestEmail).trim() || undefined,
    phone: (customer?.phone ?? guestPhone)?.trim() || undefined,
    full_name: (customer?.full_name ?? guestName).trim() || undefined,
    delivery_type: deliveryType,
    shipping_address_id:
      deliveryType === "home_delivery" && shippingAddressId
        ? Number(shippingAddressId)
        : undefined,
    billing_address_id:
      deliveryType === "home_delivery" && shippingAddressId && billingSame
        ? Number(shippingAddressId)
        : undefined,
    pickup_location_id:
      deliveryType === "store_pickup" && pickupId ? Number(pickupId) : undefined,
    coupon_code: couponCode.trim() || undefined,
    manual_discount_type:
      discountType === "none"
        ? undefined
        : (discountType as "percentage" | "fixed_amount"),
    manual_discount_value:
      discountType === "none" ? undefined : Number(discountValue || 0),
    manual_discount_reason: discountReason.trim() || undefined,
    notes: notes.trim() || undefined,
    items: lines.map(
      (l): DraftOrderItem => ({
        product_id: l.product_id,
        variant_id: l.variant_id ?? undefined,
        quantity: Number(l.quantity || 1),
        unit_price: l.unit_price ? Number(l.unit_price) : undefined,
        print_method: l.print_method || undefined,
        custom_text: l.custom_text || undefined,
        width: l.width ? Number(l.width) : undefined,
        height: l.height ? Number(l.height) : undefined,
        is_tax_applied: l.is_tax_applied,
      })
    ),
  });

  const problem =
    deliveryType === "store_pickup" && !pickupId
      ? "Pick a pickup location."
      : null;

  const save = async () => {
    if (problem) {
      toast.error(problem);
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await updateDraftOrder(draft.id, buildBody());
        toast.success("Draft saved.");
        router.refresh();
      } else {
        const created = await createDraftOrder(buildBody());
        toast.success(`Draft ${created.draft_number ?? ""} created.`.trim());
        router.push(`/orders/drafts/${created.id}`);
      }
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't save the draft."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!draft) return;
    setDeleting(true);
    try {
      toast.success(await deleteDraftOrder(draft.id));
      router.push("/orders/drafts");
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't delete the draft."));
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  const canComplete =
    isEdit &&
    !locked &&
    lines.length > 0 &&
    (deliveryType !== "store_pickup" || !!pickupId);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => router.push("/orders/drafts")}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold">
            {isEdit ? (draft.draft_number ?? `Draft #${draft.id}`) : "Create draft order"}
          </h1>
          {isEdit && (
            <p className="text-xs text-muted-foreground">
              {draft.channel === "online_store" ? "Online store" : "Point of sale"}
            </p>
          )}
        </div>
        {isEdit && (
          <StatusBadge
            status={DRAFT_STATUS_LABELS[draft.status ?? "open"] ?? draft.status ?? "Open"}
            tone={DRAFT_TONES[draft.status ?? "open"] ?? "neutral"}
          />
        )}

        <div className="ml-auto flex flex-wrap gap-2">
          {isEdit && !locked && (
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="size-4" />
              Delete
            </Button>
          )}
          {!locked && (
            <Button variant="outline" onClick={save} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "Save draft" : "Save draft"}
            </Button>
          )}
          {canComplete && (
            <Button onClick={() => setCompleteOpen(true)}>Collect payment</Button>
          )}
        </div>
      </div>

      {locked && (
        <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          {isCompleted
            ? "This draft has been completed and converted into an order — it can no longer be edited."
            : "This draft was cancelled."}
        </div>
      )}

      <div className={cn("grid gap-4 lg:grid-cols-[1fr_340px]", locked && "pointer-events-none opacity-70")}>
        {/* ── Left ── */}
        <div className="flex flex-col gap-4">
          {/* Products */}
          <Card>
            <CardHeader className="flex-row items-center gap-2 pb-3">
              <Package className="size-4 text-muted-foreground" />
              <CardTitle className="text-base">Products</CardTitle>
              <Button
                size="sm"
                variant="outline"
                className="ml-auto"
                onClick={() => setPickerOpen(true)}
              >
                <Plus className="size-4" />
                Browse products
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {lines.length === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-muted-foreground">
                  No products yet — add the items this customer wants.
                </p>
              ) : (
                <div className="divide-y">
                  {lines.map((l) => (
                    <LineRow
                      key={l.key}
                      line={l}
                      onChange={(patch) => patchLine(l.key, patch)}
                      onRemove={() => removeLine(l.key)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Payment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Subtotal · {lines.length} item{lines.length === 1 ? "" : "s"}
                </span>
                <span className="tabular-nums">{money(subtotal)}</span>
              </div>

              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-1.5">
                  <span className="text-muted-foreground">Discount</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Select
                      items={{
                        none: "No discount",
                        percentage: "Percentage",
                        fixed_amount: "Fixed amount",
                      }}
                      value={discountType}
                      onValueChange={(v) => setDiscountType(v as string)}
                    >
                      <SelectTrigger className="h-8 w-36 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No discount</SelectItem>
                        <SelectItem value="percentage">Percentage</SelectItem>
                        <SelectItem value="fixed_amount">Fixed amount</SelectItem>
                      </SelectContent>
                    </Select>
                    {discountType !== "none" && (
                      <>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={discountValue}
                          onChange={(e) => setDiscountValue(e.target.value)}
                          placeholder={discountType === "percentage" ? "10" : "25"}
                          className="h-8 w-20 text-sm"
                        />
                        <Input
                          value={discountReason}
                          onChange={(e) => setDiscountReason(e.target.value)}
                          placeholder="Reason"
                          maxLength={255}
                          className="h-8 w-32 text-sm"
                        />
                      </>
                    )}
                  </div>
                </div>
                <span className="tabular-nums text-[#e51c00]">
                  {manualDiscount > 0 ? `−${money(manualDiscount)}` : money(0)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-1 items-center gap-1.5">
                  <Tag className="size-3.5 text-muted-foreground" />
                  <Input
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="Coupon code"
                    className="h-8 w-40 font-mono text-sm"
                  />
                </div>
                <span className="text-xs text-muted-foreground">
                  applied on complete
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax &amp; shipping</span>
                <span className="text-xs text-muted-foreground">
                  calculated on complete
                </span>
              </div>

              <Separator />

              <div className="flex justify-between text-base font-semibold">
                <span>Estimated total</span>
                <span className="tabular-nums">{money(estimatedTotal)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                A display estimate — tax, shipping and coupons are recalculated by
                the server when the draft is completed.
              </p>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                rows={3}
                maxLength={5000}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Logo centred on chest."
              />
            </CardContent>
          </Card>
        </div>

        {/* ── Right ── */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="flex-row items-center gap-2 pb-3">
              <UserRound className="size-4 text-muted-foreground" />
              <CardTitle className="text-base">Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {customer ? (
                <div className="flex items-start gap-2 rounded-xl border border-border p-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {customer.full_name}
                    </p>
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
                <>
                  <CustomerSearch
                    onPick={setCustomer}
                    onCreate={(prefill) => {
                      setGuestName(prefill);
                      setCustomerOpen(true);
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Or keep it as a one-off and enter the details here:
                  </p>
                  <Input
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Full name"
                  />
                  <Input
                    type="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    placeholder="Email — needed to send an invoice"
                  />
                  <Input
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    placeholder="Phone"
                  />
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Delivery</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select
                items={{
                  home_delivery: "Home delivery",
                  store_pickup: "Store pickup",
                }}
                value={deliveryType}
                onValueChange={(v) =>
                  setDeliveryType(v as "home_delivery" | "store_pickup")
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="home_delivery">Home delivery</SelectItem>
                  <SelectItem value="store_pickup">Store pickup</SelectItem>
                </SelectContent>
              </Select>

              {deliveryType === "store_pickup" ? (
                <div className="space-y-1.5">
                  <Label>Pickup location</Label>
                  <Select
                    items={Object.fromEntries(
                      pickupLocations.map((p) => [String(p.id), p.name])
                    )}
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
                  {!pickupId && (
                    <p className="text-xs text-destructive">
                      Required for store pickup.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Shipping address</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => setAddressOpen(true)}
                    >
                      <Plus className="size-3.5" />
                      Add new
                    </Button>
                  </div>

                  {addressLoading ? (
                    <p className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
                      <Loader2 className="size-3.5 animate-spin" />
                      Loading addresses…
                    </p>
                  ) : addresses.length === 0 ? (
                    <p className="rounded-lg bg-muted/50 px-2.5 py-2 text-xs text-muted-foreground">
                      {customer || guestEmail
                        ? "No saved addresses for this customer — add one before completing."
                        : "Attach a customer first, then pick or add a shipping address."}
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {addresses.map((a) => (
                        <button
                          key={String(a.id)}
                          type="button"
                          onClick={() => setShippingAddressId(String(a.id))}
                          className={cn(
                            "flex w-full items-start gap-2 rounded-xl border p-2.5 text-left text-sm transition-colors",
                            String(a.id) === shippingAddressId
                              ? "border-[#005bd3] bg-[#e0f0ff]/40"
                              : "border-border hover:bg-muted/40"
                          )}
                        >
                          <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5">
                              <span className="truncate font-medium">
                                {a.full_name ?? "—"}
                              </span>
                              {a.is_default && (
                                <StatusBadge status="Default" tone="info" />
                              )}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {[a.address_line1, a.address_line2, a.city, a.state, a.postal_code]
                                .filter(Boolean)
                                .join(", ")}
                            </span>
                          </span>
                        </button>
                      ))}

                      <label className="flex cursor-pointer items-center gap-2 pt-1 text-xs">
                        <input
                          type="checkbox"
                          className="accent-primary"
                          checked={billingSame}
                          onChange={(e) => setBillingSame(e.target.checked)}
                        />
                        Billing address is the same
                      </label>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ProductPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onPick={addProduct}
      />

      <CreateCustomerDialog
        open={customerOpen}
        onOpenChange={setCustomerOpen}
        defaultName={guestName}
        defaultEmail={guestEmail}
        defaultPhone={guestPhone}
        onCreated={(u) => {
          setCustomer(u);
          setGuestName("");
          setGuestEmail("");
          setGuestPhone("");
        }}
      />

      <AddAddressDialog
        open={addressOpen}
        onOpenChange={setAddressOpen}
        customer={customer}
        fallback={{ name: guestName, email: guestEmail, phone: guestPhone }}
        onCreated={(created) => {
          setAddresses((prev) => [created, ...prev]);
          setShippingAddressId(String(created.id));
          loadAddresses();
        }}
      />

      {isEdit && (
        <>
          <CompleteDraftDialog
            draft={draft}
            open={completeOpen}
            onOpenChange={setCompleteOpen}
            defaultEmail={customer?.email ?? guestEmail}
            total={estimatedTotal}
          />
          <ConfirmDeleteDialog
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            loading={deleting}
            onConfirm={handleDelete}
            title={`Delete ${draft.draft_number ?? "this draft"}?`}
            description="The draft is removed. No order or stock is affected."
          />
        </>
      )}
    </div>
  );
}

// ─── Line row ─────────────────────────────────────────────────────────────────

function LineRow({
  line,
  onChange,
  onRemove,
}: {
  line: LineDraft;
  onChange: (patch: Partial<LineDraft>) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const lineTotal = Number(line.unit_price || 0) * Number(line.quantity || 0);

  return (
    <div className="px-6 py-3">
      <div className="flex items-center gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
          {line.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imgUrl(line.image)} alt="" className="size-full object-cover" />
          ) : (
            <Package className="size-4 text-muted-foreground" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{line.title}</p>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-[#005bd3] hover:underline"
          >
            {expanded ? "Hide options" : "Print options"}
          </button>
        </div>

        <div className="relative w-24">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            $
          </span>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={line.unit_price}
            onChange={(e) => onChange({ unit_price: e.target.value })}
            placeholder="0.00"
            className="h-8 pl-5 text-sm"
          />
        </div>

        <Input
          type="number"
          min="1"
          step="1"
          value={line.quantity}
          onChange={(e) => onChange({ quantity: e.target.value })}
          className="h-8 w-16 text-sm"
        />

        <span className="w-20 text-right text-sm font-medium tabular-nums">
          {money(lineTotal)}
        </span>

        <button
          type="button"
          aria-label="Remove line"
          onClick={onRemove}
          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      {expanded && (
        <div className="mt-3 grid gap-2 rounded-lg border border-border bg-muted/20 p-3 sm:grid-cols-4">
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Print method</Label>
            <Select
              items={{
                none: "None",
                ...Object.fromEntries(
                  PRINT_METHODS.map((m) => [m, m.replace(/_/g, " ").toUpperCase()])
                ),
              }}
              value={line.print_method ?? "none"}
              onValueChange={(v) =>
                onChange({ print_method: v === "none" ? undefined : (v as string) })
              }
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {PRINT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m.replace(/_/g, " ").toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Width</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={line.width ?? ""}
              onChange={(e) => onChange({ width: e.target.value })}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Height</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={line.height ?? ""}
              onChange={(e) => onChange({ height: e.target.value })}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1 sm:col-span-3">
            <Label className="text-xs">Custom text</Label>
            <Input
              value={line.custom_text ?? ""}
              onChange={(e) => onChange({ custom_text: e.target.value })}
              maxLength={1000}
              placeholder="Team Alpha"
              className="h-8 text-sm"
            />
          </div>
          <label className="flex items-end gap-2 pb-1 text-xs">
            <input
              type="checkbox"
              className="accent-primary"
              checked={line.is_tax_applied}
              onChange={(e) => onChange({ is_tax_applied: e.target.checked })}
            />
            Taxable
          </label>
        </div>
      )}
    </div>
  );
}

// ─── Customer search ──────────────────────────────────────────────────────────

function CustomerSearch({
  onPick,
  onCreate,
}: {
  onPick: (u: UserRow) => void;
  onCreate: (prefill: string) => void;
}) {
  const [search, setSearch] = React.useState("");
  const [results, setResults] = React.useState<UserRow[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const term = search.trim();
    if (!term) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      // Match on name or email so either one finds the customer.
      Promise.all([
        listUsers({ page: 1, limit: 8, filters: { full_name: term, role: "customer" } }),
        listUsers({ page: 1, limit: 8, filters: { email: term, role: "customer" } }),
      ])
        .then(([byName, byEmail]) => {
          const byId = new Map<string, UserRow>();
          [...byName.rows, ...byEmail.rows].forEach((u) => byId.set(String(u.id), u));
          setResults([...byId.values()]);
        })
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <div className="relative">
      <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search existing customers"
        className="pl-8"
      />
      {open && search.trim() !== "" && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-md">
          {searching ? (
            <p className="flex items-center gap-2 px-3 py-2.5 text-sm text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Searching…
            </p>
          ) : results.length === 0 ? (
            <>
              <p className="px-3 py-2.5 text-sm text-muted-foreground">
                No customer matches “{search.trim()}”.
              </p>
              <button
                type="button"
                onClick={() => {
                  onCreate(search.trim());
                  setOpen(false);
                  setSearch("");
                }}
                className="flex w-full items-center gap-2 border-t border-border px-3 py-2.5 text-left text-sm font-medium text-[#005bd3] hover:bg-muted"
              >
                <Plus className="size-4" />
                Create a new customer
              </button>
            </>
          ) : (
            results.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => {
                  onPick(u);
                  setOpen(false);
                  setSearch("");
                }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
              >
                <span className="font-medium">{u.full_name}</span>
                <span className="block text-xs text-muted-foreground">{u.email}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Product picker ───────────────────────────────────────────────────────────

function ProductPickerDialog({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick: (p: ProductRow) => void;
}) {
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [rows, setRows] = React.useState<ProductRow[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  React.useEffect(() => {
    if (!open) return;
    setLoading(true);
    listProducts({
      page: 1,
      limit: 30,
      filters: { title: debounced || undefined, status: "published" },
    })
      .then((res) => setRows(res.rows))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [open, debounced]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add products</DialogTitle>
          <DialogDescription>
            Click a product to add it to the draft.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products"
            className="pl-8"
            autoFocus
          />
        </div>

        <div className="max-h-96 overflow-y-auto rounded-lg border border-border">
          {loading ? (
            <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Searching…
            </p>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No products found.
            </p>
          ) : (
            rows.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onPick(p)}
                className="flex w-full items-center gap-3 border-b border-border px-3 py-2 text-left last:border-b-0 hover:bg-muted"
              >
                <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                  {p.featured_image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imgUrl(p.featured_image)}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : (
                    <Package className="size-4 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.quantity != null ? `${p.quantity} in stock` : "—"}
                  </p>
                </div>
                <span className="text-sm font-medium tabular-nums">
                  {money(p.price)}
                </span>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}


// ─── Create customer ──────────────────────────────────────────────────────────

/** A password is required by the users API, so one is generated by default. */
const randomPassword = () =>
  `Mf${Math.random().toString(36).slice(2, 8)}${Math.floor(Math.random() * 90 + 10)}!`;

function CreateCustomerDialog({
  open,
  onOpenChange,
  defaultName,
  defaultEmail,
  defaultPhone,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultName?: string;
  defaultEmail?: string;
  defaultPhone?: string;
  onCreated: (u: UserRow) => void;
}) {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setName(defaultName ?? "");
    setEmail(defaultEmail ?? "");
    setPhone(defaultPhone ?? "");
    setPassword(randomPassword());
  }, [open, defaultName, defaultEmail, defaultPhone]);

  const problem = !name.trim()
    ? "Enter a name."
    : !email.trim()
      ? "Enter an email."
      : phone.trim().length < 7
        ? "Enter a phone number."
        : password.length < 8
          ? "The password must be at least 8 characters."
          : null;

  const submit = async () => {
    if (problem) return;
    setSaving(true);
    try {
      await createUser({
        full_name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
        confirmPassword: password,
        role: "customer",
        is_active: true,
      });

      // The create response doesn't include the row, so read it back to get the id.
      const found = await listUsers({
        page: 1,
        limit: 1,
        filters: { email: email.trim(), role: "customer" },
      });
      const created = found.rows[0];
      if (!created) throw new Error("Customer created but couldn't be loaded.");

      toast.success(`${created.full_name} added.`);
      onCreated(created);
      onOpenChange(false);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't create the customer."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New customer</DialogTitle>
          <DialogDescription>
            Creates a customer account you can reuse on future orders.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="nc-name">Full name</Label>
            <Input
              id="nc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nc-email">Email</Label>
            <Input
              id="nc-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="customer@example.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nc-phone">Phone</Label>
            <Input
              id="nc-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 555 0100"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nc-pass">Temporary password</Label>
            <Input
              id="nc-pass"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Generated for you — the customer can reset it from the storefront.
            </p>
          </div>
          {problem && <p className="text-sm text-muted-foreground">{problem}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || !!problem}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Create customer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add address ──────────────────────────────────────────────────────────────

function AddAddressDialog({
  open,
  onOpenChange,
  customer,
  fallback,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  customer: UserRow | null;
  fallback: { name: string; email: string; phone: string };
  onCreated: (a: AddressRow) => void;
}) {
  const empty = {
    full_name: "",
    phone: "",
    email: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    postal_code: "",
    country: "United States",
  };
  const [form, setForm] = React.useState(empty);
  const [isDefault, setIsDefault] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setForm({
      ...empty,
      full_name: customer?.full_name ?? fallback.name ?? "",
      email: customer?.email ?? fallback.email ?? "",
      phone: customer?.phone ?? fallback.phone ?? "",
    });
    setIsDefault(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customer, fallback.name, fallback.email, fallback.phone]);

  const set = (key: keyof typeof empty, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const problem = !form.full_name.trim()
    ? "Enter a name."
    : form.phone.trim().length < 7
      ? "Enter a phone number."
      : !form.address_line1.trim()
        ? "Enter the street address."
        : !form.city.trim()
          ? "Enter a city."
          : null;

  const submit = async () => {
    if (problem) return;
    setSaving(true);
    try {
      const created = await createAddress({
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        address_line1: form.address_line1.trim(),
        address_line2: form.address_line2.trim() || undefined,
        city: form.city.trim(),
        state: form.state.trim() || undefined,
        postal_code: form.postal_code.trim() || undefined,
        country: form.country.trim() || "United States",
        is_default: isDefault,
        type: "shipping",
        user_id: customer?.id,
      });
      toast.success("Address added.");
      onCreated(created);
      onOpenChange(false);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't add the address."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add shipping address</DialogTitle>
          <DialogDescription>
            {customer
              ? `Saved against ${customer.full_name}.`
              : "Attach a customer first so the address is saved to their account."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ad-name">Full name</Label>
              <Input
                id="ad-name"
                value={form.full_name}
                onChange={(e) => set("full_name", e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ad-phone">Phone</Label>
              <Input
                id="ad-phone"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="+1 555 0100"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ad-email">Email</Label>
            <Input
              id="ad-email"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ad-line1">Address</Label>
            <Input
              id="ad-line1"
              value={form.address_line1}
              onChange={(e) => set("address_line1", e.target.value)}
              placeholder="1234 Baltimore Avenue"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ad-line2">Apartment, suite, etc.</Label>
            <Input
              id="ad-line2"
              value={form.address_line2}
              onChange={(e) => set("address_line2", e.target.value)}
              placeholder="Suite 200"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ad-city">City</Label>
              <Input
                id="ad-city"
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ad-state">State</Label>
              <Input
                id="ad-state"
                value={form.state}
                onChange={(e) => set("state", e.target.value)}
                placeholder="MD"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ad-zip">Postal code</Label>
              <Input
                id="ad-zip"
                value={form.postal_code}
                onChange={(e) => set("postal_code", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ad-country">Country</Label>
            <Input
              id="ad-country"
              value={form.country}
              onChange={(e) => set("country", e.target.value)}
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-primary"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
            />
            Make this the default address
          </label>

          {problem && <p className="text-sm text-muted-foreground">{problem}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || !!problem}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Save address
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
