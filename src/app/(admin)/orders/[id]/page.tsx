"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowLeft, Loader2, Truck, CreditCard, Package, MapPin,
  Phone, Mail, User, Clock, ChevronDown, FileText, Banknote,
  Printer,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/status-badge";
import { apiErrorMessage } from "@/lib/auth-api";
import {
  getOrder, updateOrderStatus, printOrder,
  ORDER_STATUSES,
  type OrderDetail, type OrderAddress, type PrintType, type PrintFormat,
} from "@/lib/admin-api";

const n = (v?: string | number | null) => (v != null ? Number(v) : null);

const fmt$ = (v?: string | number | null) => {
  const num = n(v);
  return num != null ? `Rs ${num.toLocaleString("en-PK", { minimumFractionDigits: 2 })}` : "—";
};

const fmtDate = (d?: string | null) =>
  d ? format(new Date(d), "MMM d, yyyy 'at' h:mm a") : "—";

const fmtShortDate = (d?: string | null) =>
  d ? format(new Date(d), "MMM d, yyyy") : "—";

const fmtAddr = (a?: OrderAddress | null) => {
  if (!a) return null;
  const parts = [a.address_line_1, a.address_line_2, a.city, a.state, a.postal_code, a.country].filter(Boolean);
  return parts.join(", ");
};

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = React.useState<OrderDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = React.useState(false);
  const [statusOpen, setStatusOpen] = React.useState(false);
  const [printOpen, setPrintOpen] = React.useState(false);
  const [printing, setPrinting] = React.useState(false);

  const load = React.useCallback(() => {
    if (!id) return;
    setLoading(true);
    getOrder(id)
      .then(setOrder)
      .catch((err) => setError(apiErrorMessage(err, "Couldn't load order.")))
      .finally(() => setLoading(false));
  }, [id]);

  React.useEffect(() => { load(); }, [load]);

  // Close dropdowns on outside click
  React.useEffect(() => {
    const handleClick = () => { setPrintOpen(false); setStatusOpen(false); };
    if (printOpen || statusOpen) {
      document.addEventListener("click", handleClick, { capture: true, once: true });
      return () => document.removeEventListener("click", handleClick, { capture: true });
    }
  }, [printOpen, statusOpen]);

  const handlePrint = async (printType: PrintType, fmt: PrintFormat) => {
    if (!order) return;
    setPrinting(true);
    setPrintOpen(false);
    try {
      const result = await printOrder({
        order_code: order.order_number,
        order_id: order.id,
        print_type: printType,
        format: fmt,
        raw: fmt === "pdf",
      });
      if (fmt === "pdf" && result instanceof Blob) {
        const url = URL.createObjectURL(result);
        window.open(url, "_blank");
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } else {
        // HTML response — open in new window
        const html = typeof result === "string" ? result : (result as Record<string, unknown>)?.html ?? (result as Record<string, unknown>)?.payload ?? "";
        const win = window.open("", "_blank");
        if (win) {
          win.document.write(String(html));
          win.document.close();
          win.focus();
          win.print();
        }
      }
      toast.success("Print ready.");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't print order."));
    } finally {
      setPrinting(false);
    }
  };

  const PRINT_OPTIONS: { label: string; type: PrintType; format: PrintFormat }[] = [
    { label: "Thermal 80mm (PDF)", type: "thermal_80mm", format: "pdf" },
    { label: "Thermal 58mm (PDF)", type: "thermal_58mm", format: "pdf" },
    { label: "A4 Invoice (PDF)", type: "a4", format: "pdf" },
    { label: "Thermal 80mm (HTML)", type: "thermal_80mm", format: "html" },
    { label: "A4 Invoice (HTML)", type: "a4", format: "html" },
  ];

  const handleStatusChange = async (status: string) => {
    if (!order) return;
    setUpdatingStatus(true);
    setStatusOpen(false);
    try {
      await updateOrderStatus(order.id, status);
      toast.success(`Order status updated to "${status}".`);
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't update status."));
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
        <Package className="size-12 opacity-30" />
        <p className="text-sm font-medium text-foreground">Order not found</p>
        <p className="text-xs">{error ?? "This order could not be loaded."}</p>
        <Button variant="outline" size="sm" onClick={() => router.push("/orders")}>
          <ArrowLeft className="size-4" /> Back to orders
        </Button>
      </div>
    );
  }

  const items = order.items ?? [];
  const subtotal = n(order.subtotal) ?? 0;
  const discount = n(order.discount_amount) ?? 0;
  const shippingFee = n(order.shipping_fee) ?? 0;
  const tax = n(order.tax_amount) ?? 0;
  const total = n(order.total_amount) ?? n(order.total) ?? 0;
  const paidAmount = n(order.paid_amount) ?? 0;
  const activityLogs = order.activityLogs ?? [];
  const paymentLogs = order.paymentLogs ?? [];
  const shipments = order.shipments ?? [];

  return (
    <div className="flex flex-col gap-4">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/orders")} className="shrink-0">
          <ArrowLeft className="size-5" />
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold">
            {order.order_number ?? `#${order.id}`}
          </h1>
          <StatusBadge status={order.humanize_status ?? order.status ?? "unknown"} />
          <StatusBadge status={order.humanize_payment_status ?? order.payment_status ?? "unknown"} />
          {order.humanize_shipping_status && (
            <StatusBadge status={order.humanize_shipping_status} />
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {fmtDate(order.order_date ?? order.created_at)}
          </span>
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPrintOpen((o) => !o)}
              disabled={printing}
            >
              {printing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Printer className="size-4" />
              )}
              Print
              <ChevronDown className="size-3.5" />
            </Button>
            {printOpen && (
              <div className="absolute right-0 top-full z-10 mt-1 w-56 rounded-lg border bg-popover p-1 shadow-md">
                {PRINT_OPTIONS.map((opt) => (
                  <button
                    key={`${opt.type}-${opt.format}`}
                    onClick={() => handlePrint(opt.type, opt.format)}
                    className="flex w-full items-center rounded-md px-3 py-2 text-sm hover:bg-accent"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        {/* ── LEFT COLUMN ── */}
        <div className="flex flex-col gap-4">
          {/* Items card */}
          <Card>
            <CardHeader className="flex-row items-center gap-2 pb-3">
              <Package className="size-4 text-muted-foreground" />
              <CardTitle className="text-base">Items</CardTitle>
              <span className="ml-auto text-xs text-muted-foreground">
                {order.humanize_delivery_type ?? order.delivery_type?.replace(/_/g, " ") ?? ""}
              </span>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {items.length === 0 && (
                  <p className="px-6 py-8 text-center text-sm text-muted-foreground">
                    No items found.
                  </p>
                )}
                {items.map((item) => {
                  const unitPrice = n(item.unit_price) ?? 0;
                  const qty = item.quantity ?? 1;
                  const lineTotal = n(item.total_price) ?? unitPrice * qty;
                  const title = item.product_name ?? item.product?.title ?? "Untitled product";
                  const img = item.image ?? item.product?.images?.[0]?.url;

                  return (
                    <div key={String(item.id)} className="flex items-center gap-4 px-6 py-3">
                      <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                        {img ? (
                          <img src={img} alt={title} className="size-full object-cover" />
                        ) : (
                          <Package className="size-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium">{title}</p>
                        {item.variant_name && (
                          <p className="text-xs text-muted-foreground">{item.variant_name}</p>
                        )}
                        {item.sku && (
                          <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>
                        )}
                      </div>
                      <div className="shrink-0 text-right text-sm">
                        <p className="text-muted-foreground">
                          {fmt$(unitPrice)} × {qty}
                        </p>
                        <p className="font-medium">{fmt$(lineTotal)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Payment summary card */}
          <Card>
            <CardHeader className="flex-row items-center gap-2 pb-3">
              <CreditCard className="size-4 text-muted-foreground" />
              <CardTitle className="text-base">Payment Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{fmt$(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Discount
                      {order.discount_label && (
                        <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                          {order.discount_label}
                        </span>
                      )}
                    </span>
                    <span className="text-green-600">−{fmt$(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>{shippingFee === 0 ? "Free" : fmt$(shippingFee)}</span>
                </div>
                {tax > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax</span>
                    <span>{fmt$(tax)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-semibold text-base">
                  <span>Total</span>
                  <span>{fmt$(total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Paid</span>
                  <span className="font-medium">{fmt$(paidAmount)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment logs */}
          {paymentLogs.length > 0 && (
            <Card>
              <CardHeader className="flex-row items-center gap-2 pb-3">
                <Banknote className="size-4 text-muted-foreground" />
                <CardTitle className="text-base">Payment History</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {paymentLogs.map((log) => (
                    <div key={String(log.id)} className="flex items-center justify-between px-6 py-3 text-sm">
                      <div>
                        <p className="font-medium capitalize">
                          {(log.payment_method ?? "").replace(/_/g, " ")}
                        </p>
                        <p className="text-xs text-muted-foreground">{fmtShortDate(log.created_at)}</p>
                      </div>
                      <div className="text-right flex items-center gap-2">
                        <span className="font-medium">{fmt$(log.amount)}</span>
                        {log.status && <StatusBadge status={log.status} />}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Shipments */}
          {shipments.length > 0 && (
            <Card>
              <CardHeader className="flex-row items-center gap-2 pb-3">
                <Truck className="size-4 text-muted-foreground" />
                <CardTitle className="text-base">Shipments</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {shipments.map((s) => (
                    <div key={String(s.id)} className="flex items-center justify-between px-6 py-3 text-sm">
                      <div>
                        <p className="font-mono font-medium">{s.shipment_number ?? `#${s.id}`}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.service_name ?? "—"} · {s.tracking_number ?? "No tracking"}
                        </p>
                      </div>
                      <StatusBadge status={s.status ?? "—"} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Activity timeline */}
          {activityLogs.length > 0 && (
            <Card>
              <CardHeader className="flex-row items-center gap-2 pb-3">
                <Clock className="size-4 text-muted-foreground" />
                <CardTitle className="text-base">Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="relative border-l border-muted ml-2">
                  {activityLogs.map((log, i) => {
                    const userName = typeof log.user === "object" && log.user
                      ? (log.user.name ?? log.user.email ?? "")
                      : (log.user ?? "");
                    return (
                      <li key={String(log.id ?? i)} className="mb-4 ml-4 last:mb-0">
                        <div className="absolute -left-1.5 mt-1 size-3 rounded-full border border-background bg-muted-foreground/40" />
                        <p className="text-sm">{log.message ?? log.description ?? log.action ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">
                          {fmtDate(log.created_at)}
                          {userName && ` · ${userName}`}
                        </p>
                      </li>
                    );
                  })}
                </ol>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── RIGHT COLUMN (sidebar) ── */}
        <div className="flex flex-col gap-4">
          {/* Status actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Update Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => setStatusOpen((o) => !o)}
                  disabled={updatingStatus}
                >
                  {updatingStatus ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <span className="capitalize">{(order.status ?? "—").replace(/_/g, " ")}</span>
                  )}
                  <ChevronDown className="size-4 text-muted-foreground" />
                </Button>
                {statusOpen && (
                  <div className="absolute left-0 top-full z-10 mt-1 w-full rounded-lg border bg-popover p-1 shadow-md">
                    {ORDER_STATUSES.map((s) => (
                      <button
                        key={s}
                        onClick={() => handleStatusChange(s)}
                        className="flex w-full items-center rounded-md px-3 py-2 text-sm capitalize hover:bg-accent disabled:opacity-50"
                        disabled={s === order.status}
                      >
                        {s.replace(/_/g, " ")}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Order info card */}
          <Card>
            <CardHeader className="flex-row items-center gap-2 pb-3">
              <FileText className="size-4 text-muted-foreground" />
              <CardTitle className="text-base">Order Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Channel</span>
                <span>{order.humanize_channel ?? order.channel ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment Method</span>
                <span>{order.humanize_pos_payment_type ?? (order.pos_payment_type ?? "—").replace(/_/g, " ")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Delivery</span>
                <span>{order.humanize_delivery_type ?? (order.delivery_type ?? "—").replace(/_/g, " ")}</span>
              </div>
              {order.estimated_delivery_date && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Est. Delivery</span>
                  <span>{fmtShortDate(order.estimated_delivery_date)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes card */}
          <Card>
            <CardHeader className="flex-row items-center gap-2 pb-3">
              <FileText className="size-4 text-muted-foreground" />
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {order.notes || "No notes on this order."}
              </p>
            </CardContent>
          </Card>

          {/* Customer card */}
          <Card>
            <CardHeader className="flex-row items-center gap-2 pb-3">
              <User className="size-4 text-muted-foreground" />
              <CardTitle className="text-base">Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm font-medium">{order.full_name ?? "Guest checkout"}</p>
              {order.email && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="size-3.5" />
                  <span>{order.email}</span>
                </div>
              )}
              {order.phone && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="size-3.5" />
                  <span>{order.phone}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Shipping address card */}
          {order.shippingAddr && (
            <Card>
              <CardHeader className="flex-row items-center gap-2 pb-3">
                <MapPin className="size-4 text-muted-foreground" />
                <CardTitle className="text-base">Shipping Address</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm space-y-1">
                  {order.shippingAddr.full_name && (
                    <p className="font-medium">{order.shippingAddr.full_name}</p>
                  )}
                  <p className="text-muted-foreground">{fmtAddr(order.shippingAddr)}</p>
                  {order.shippingAddr.phone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="size-3.5" />
                      <span>{order.shippingAddr.phone}</span>
                    </div>
                  )}
                  {order.shippingAddr.email && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="size-3.5" />
                      <span>{order.shippingAddr.email}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Billing address card */}
          {order.billingAddr && (
            <Card>
              <CardHeader className="flex-row items-center gap-2 pb-3">
                <CreditCard className="size-4 text-muted-foreground" />
                <CardTitle className="text-base">Billing Address</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm space-y-1">
                  {order.billingAddr.full_name && (
                    <p className="font-medium">{order.billingAddr.full_name}</p>
                  )}
                  <p className="text-muted-foreground">{fmtAddr(order.billingAddr)}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
