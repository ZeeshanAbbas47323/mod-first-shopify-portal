"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowLeft, Loader2, Truck, CreditCard, Package, MapPin,
  Phone, Mail, User, Clock, ChevronDown, FileText, Banknote,
  Printer, XCircle, Download, ExternalLink, FileImage,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { OrderComments } from "@/components/orders/order-comments";
import { RefundsSection } from "@/components/orders/refunds-section";
import { apiErrorMessage } from "@/lib/auth-api";
import { fileUrl, imgUrl } from "@/lib/utils";
import {
  openPrintWindow,
  pickFileUrl,
  pickHtml,
  popupBlocked,
  showBlob,
} from "@/lib/print-output";
import {
  getOrder, updateOrderStatus, printOrder, printOrderRaw,
  orderItemDesigns, orderItemDesignIds, orderDesigns, orderDesignIds,
  fetchOrderDesigns, type DesignUploadRow,
  type OrderDesignUpload,
  assignOrderCourier, cancelOrder, listCouriers, type CourierRow,
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
  // Artwork is referenced by id on the order lines, so the files are fetched
  // once the order itself has loaded.
  const [designFiles, setDesignFiles] = React.useState<Map<string, DesignUploadRow>>(
    new Map()
  );
  const [courierOpen, setCourierOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);

  const load = React.useCallback(() => {
    if (!id) return;
    setLoading(true);
    getOrder(id)
      .then(setOrder)
      .catch((err) => setError(apiErrorMessage(err, "Couldn't load order.")))
      .finally(() => setLoading(false));
  }, [id]);

  React.useEffect(() => { load(); }, [load]);

  React.useEffect(() => {
    if (!order) return;
    const ids = orderDesignIds(order);
    if (ids.length === 0) {
      setDesignFiles(new Map());
      return;
    }
    let cancelled = false;
    fetchOrderDesigns(ids)
      .then((map) => !cancelled && setDesignFiles(map))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [order]);

  // The print service keys off order_code; order_number is a different value,
  // so only send it when the order actually carries a code.
  const printTarget = () => ({
    order_code: order?.order_code,
    order_id: order?.id,
  });

  const handlePrintRaw = async (printType: PrintType, fmt: PrintFormat) => {
    if (!order) return;
    // Open the tab inside the click so the browser doesn't treat it as a popup.
    const target = openPrintWindow();
    setPrinting(true);
    setPrintOpen(false);
    try {
      const blob = await printOrderRaw({
        ...printTarget(),
        print_type: printType,
        format: fmt,
      });
      await showBlob(blob, target);
      if (popupBlocked(target)) {
        toast.warning("Pop-ups are blocked — the file was downloaded instead.");
      }
    } catch (err) {
      target.close();
      toast.error(
        err instanceof Error && err.message
          ? err.message
          : apiErrorMessage(err, "Couldn't open the receipt.")
      );
    } finally {
      setPrinting(false);
    }
  };

  const handlePrint = async (printType: PrintType, fmt: PrintFormat) => {
    if (!order) return;
    const target = openPrintWindow();
    setPrinting(true);
    setPrintOpen(false);
    try {
      const result = await printOrder({
        ...printTarget(),
        print_type: printType,
        format: fmt,
        raw: fmt === "pdf",
      });

      if (result instanceof Blob) {
        await showBlob(result, target);
        if (popupBlocked(target)) {
          toast.warning("Pop-ups are blocked — the file was downloaded instead.");
        }
      } else {
        // JSON response — either inline HTML or a link to a hosted file.
        const html = pickHtml(result);
        const fileUrl = pickFileUrl(result);
        if (html) {
          target.writeHtml(html);
          target.win?.print();
        } else if (fileUrl) {
          if (target.win) target.show(fileUrl);
          else window.open(fileUrl, "_blank");
        } else {
          target.close();
          throw new Error("The print service returned nothing to display.");
        }
        if (popupBlocked(target)) {
          toast.error("Pop-ups are blocked — allow them for this site to print.");
          return;
        }
      }
      toast.success("Print ready.");
    } catch (err) {
      target.close();
      toast.error(
        err instanceof Error && err.message
          ? err.message
          : apiErrorMessage(err, "Couldn't print order.")
      );
    } finally {
      setPrinting(false);
    }
  };

  const PRINT_OPTIONS: {
    label: string;
    type: PrintType;
    format: PrintFormat;
    raw?: boolean;
  }[] = [
    { label: "Receipt 80mm (PDF)", type: "thermal_80mm", format: "pdf" },
    { label: "Receipt 58mm (PDF)", type: "thermal_58mm", format: "pdf" },
    { label: "A4 invoice (PDF)", type: "a4", format: "pdf" },
    { label: "Receipt 80mm (print now)", type: "thermal_80mm", format: "html" },
    { label: "A4 invoice (print now)", type: "a4", format: "html" },
    { label: "Open 80mm in new tab", type: "thermal_80mm", format: "html", raw: true },
    { label: "Open A4 in new tab", type: "a4", format: "pdf", raw: true },
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
  // Embedded designs plus the ones resolved from their ids.
  const allDesigns: OrderDesignUpload[] = [
    ...orderDesigns(order),
    ...[...designFiles.values()],
  ];

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
          <DropdownMenu open={printOpen} onOpenChange={setPrintOpen}>
            <DropdownMenuTrigger
              disabled={printing}
              render={
                <Button variant="outline" size="sm">
                  {printing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Printer className="size-4" />
                  )}
                  Print
                  <ChevronDown className="size-3.5" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-56">
              {PRINT_OPTIONS.map((opt) => (
                <DropdownMenuItem
                  key={`${opt.type}-${opt.format}-${opt.raw ? "raw" : "post"}`}
                  onClick={() =>
                    opt.raw
                      ? handlePrintRaw(opt.type, opt.format)
                      : handlePrint(opt.type, opt.format)
                  }
                >
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
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
                          // eslint-disable-next-line @next/next/no-img-element
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
                        {item.print_method && (
                          <p className="text-xs text-muted-foreground uppercase">
                            {item.print_method.replace(/_/g, " ")}
                          </p>
                        )}
                        {item.custom_text && (
                          <p className="truncate text-xs text-muted-foreground">
                            “{item.custom_text}”
                          </p>
                        )}
                        <ItemDesigns
                          designs={[
                            ...orderItemDesigns(item),
                            ...orderItemDesignIds(item)
                              .map((did) => designFiles.get(String(did)))
                              .filter((d): d is DesignUploadRow => !!d),
                          ]}
                        />
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

          {/* Artwork */}
          {allDesigns.length > 0 && (
            <Card>
              <CardHeader className="flex-row items-center gap-2 pb-3">
                <FileImage className="size-4 text-muted-foreground" />
                <CardTitle className="text-base">Artwork</CardTitle>
                <span className="ml-auto text-xs text-muted-foreground">
                  {allDesigns.length} file{allDesigns.length === 1 ? "" : "s"}
                </span>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {allDesigns.map((d, i) => (
                    <DesignCard key={String(d.id ?? i)} design={d} index={i} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

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

          {/* Payments & refunds */}
          {id && <RefundsSection orderId={id} />}

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
          {/* Comments */}
          {id && <OrderComments orderId={id} />}

          <AssignCourierDialog
            orderId={order.id}
            open={courierOpen}
            onOpenChange={setCourierOpen}
            onSaved={load}
          />
          <CancelOrderDialog
            order={order}
            open={cancelOpen}
            onOpenChange={setCancelOpen}
            onSaved={load}
          />
        </div>

        {/* ── RIGHT COLUMN (sidebar) ── */}
        <div className="flex flex-col gap-4">
          {/* Status actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Update Status</CardTitle>
            </CardHeader>
            <CardContent>
              <DropdownMenu open={statusOpen} onOpenChange={setStatusOpen}>
                <DropdownMenuTrigger
                  disabled={updatingStatus}
                  render={
                    <Button variant="outline" className="w-full justify-between">
                      {updatingStatus ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <span className="capitalize">
                          {(order.status ?? "—").replace(/_/g, " ")}
                        </span>
                      )}
                      <ChevronDown className="size-4 text-muted-foreground" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="start" className="w-56">
                  {ORDER_STATUSES.map((s) => (
                    <DropdownMenuItem
                      key={s}
                      disabled={s === order.status}
                      onClick={() => handleStatusChange(s)}
                      className="capitalize"
                    >
                      {s.replace(/_/g, " ")}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </CardContent>
          </Card>

          {/* Fulfilment actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button
                variant="outline"
                className="justify-start"
                onClick={() => setCourierOpen(true)}
              >
                <Truck className="size-4" />
                Assign courier
              </Button>
              <Button
                variant="outline"
                className="justify-start text-destructive hover:text-destructive"
                disabled={order.status === "cancelled"}
                onClick={() => setCancelOpen(true)}
              >
                <XCircle className="size-4" />
                {order.status === "cancelled" ? "Order cancelled" : "Cancel order"}
              </Button>
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


// ─── Assign courier ───────────────────────────────────────────────────────────

function AssignCourierDialog({
  orderId,
  open,
  onOpenChange,
  onSaved,
}: {
  orderId: number | string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [couriers, setCouriers] = React.useState<CourierRow[]>([]);
  const [courierId, setCourierId] = React.useState("");
  const [carrierName, setCarrierName] = React.useState("");
  const [serviceName, setServiceName] = React.useState("");
  const [serviceCode, setServiceCode] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setCarrierName("");
    setServiceName("");
    setServiceCode("");
    listCouriers({ page: 1, limit: 100, filters: { is_active: true } })
      .then((res) => {
        setCouriers(res.rows);
        setCourierId(res.rows[0] ? String(res.rows[0].id) : "");
      })
      .catch(() => setCouriers([]));
  }, [open]);

  const submit = async () => {
    if (!courierId) return;
    setSaving(true);
    try {
      toast.success(
        await assignOrderCourier(orderId, {
          courier_id: Number(courierId),
          carrier_name: carrierName.trim() || undefined,
          service_name: serviceName.trim() || undefined,
          service_code: serviceCode.trim() || undefined,
        })
      );
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't assign the courier."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign courier</DialogTitle>
          <DialogDescription>
            Carrier and service are required by Shippo and UPS; leave them blank for
            couriers that don&apos;t need them.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Courier</Label>
            <Select
              items={Object.fromEntries(couriers.map((c) => [String(c.id), c.name]))}
              value={courierId}
              onValueChange={(v) => setCourierId(v as string)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a courier" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {couriers.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                    {c.code ? ` · ${c.code}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {couriers.length === 0 && (
              <p className="text-xs text-destructive">
                No active couriers — add one under Settings → Couriers.
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="carrier-name">Carrier name</Label>
              <Input
                id="carrier-name"
                value={carrierName}
                onChange={(e) => setCarrierName(e.target.value)}
                placeholder="USPS"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="service-name">Service name</Label>
              <Input
                id="service-name"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                placeholder="UPS Next Day Air"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="service-code">Service code (UPS)</Label>
            <Input
              id="service-code"
              value={serviceCode}
              onChange={(e) => setServiceCode(e.target.value)}
              placeholder="01"
              className="w-24 font-mono"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || !courierId}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Cancel order ─────────────────────────────────────────────────────────────

function CancelOrderDialog({
  order,
  open,
  onOpenChange,
  onSaved,
}: {
  order: OrderDetail;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [reason, setReason] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) setReason("");
  }, [open]);

  const customer = order.customer;
  const userId =
    order.user_id ??
    (customer && typeof customer === "object" ? customer.id : undefined);

  const submit = async () => {
    if (!reason.trim() || userId == null) return;
    setSaving(true);
    try {
      toast.success(
        await cancelOrder(order.id, {
          user_id: userId as number | string,
          reason: reason.trim(),
        })
      );
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't cancel the order."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel this order?</DialogTitle>
          <DialogDescription>
            The reason is recorded on the activity log and shown to the customer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="cancel-reason">Reason</Label>
          <Textarea
            id="cancel-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Customer changed their mind"
            autoFocus
          />
          {userId == null && (
            <p className="text-sm text-destructive">
              This order has no customer attached, so it can&apos;t be cancelled here.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Keep order
          </Button>
          <Button
            variant="destructive"
            onClick={submit}
            disabled={saving || !reason.trim() || userId == null}
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            Cancel order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


// ─── Artwork attached to a line ───────────────────────────────────────────────

/**
 * Design files can't just be plain links — the same file is usually wanted
 * either saved to disk or opened for a quick look, so each one offers both.
 */
function ItemDesigns({ designs }: { designs: OrderDesignUpload[] }) {
  if (designs.length === 0) return null;

  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {designs.map((d, i) => {
        const url = fileUrl(d.file_url ?? d.edit_url ?? "");
        const name = d.file_name ?? `Design ${i + 1}`;
        return (
          <DropdownMenu key={String(d.id ?? i)}>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="flex max-w-52 items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2 py-1 text-xs text-[#005bd3] transition-colors hover:bg-muted"
                >
                  <FileImage className="size-3.5 shrink-0" />
                  <span className="truncate">{name}</span>
                  <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
                </button>
              }
            />
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuItem
                onClick={() => window.open(url, "_blank", "noopener")}
              >
                <ExternalLink className="size-4" /> Open in new tab
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => downloadDesign(url, name)}>
                <Download className="size-4" /> Download
              </DropdownMenuItem>
              {d.edit_url && d.file_url && d.edit_url !== d.file_url && (
                <DropdownMenuItem
                  onClick={() =>
                    window.open(fileUrl(d.edit_url as string), "_blank", "noopener")
                  }
                >
                  <ExternalLink className="size-4" /> Open edited version
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      })}
    </div>
  );
}

/**
 * Fetch the file first so the browser saves it instead of navigating — a plain
 * `download` attribute is ignored for cross-origin URLs.
 */
async function downloadDesign(url: string, name: string) {
  if (!url) return;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  } catch {
    // CORS or a dead link — fall back to opening it so the file isn't lost.
    toast.error("Couldn't download directly — opening the file instead.");
    window.open(url, "_blank", "noopener");
  }
}


// ─── Artwork card ─────────────────────────────────────────────────────────────

const isPreviewable = (url: string) =>
  /\.(png|jpe?g|webp|gif|svg|avif)(\?|$)/i.test(url);

/** Thumbnail with the same open/download choice as the inline chips. */
function DesignCard({ design, index }: { design: OrderDesignUpload; index: number }) {
  const url = fileUrl(design.file_url ?? design.edit_url ?? "");
  const name = design.file_name ?? `Design ${index + 1}`;

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="flex h-28 items-center justify-center bg-muted/40">
        {isPreviewable(url) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imgUrl(url)} alt={name} className="size-full object-contain" />
        ) : (
          <FileImage className="size-6 text-muted-foreground" />
        )}
      </div>
      <div className="space-y-1.5 p-2">
        <p className="truncate text-xs font-medium" title={name}>
          {name}
        </p>
        {design.print_method && (
          <p className="text-[11px] uppercase text-muted-foreground">
            {design.print_method.replace(/_/g, " ")}
          </p>
        )}
        <div className="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 flex-1 px-2 text-xs"
            onClick={() => window.open(url, "_blank", "noopener")}
          >
            <ExternalLink className="size-3" />
            Open
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            aria-label={`Download ${name}`}
            onClick={() => downloadDesign(url, name)}
          >
            <Download className="size-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
