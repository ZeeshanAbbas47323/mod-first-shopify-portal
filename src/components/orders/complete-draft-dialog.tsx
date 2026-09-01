"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  Banknote,
  CreditCard,
  ExternalLink,
  Loader2,
  Mail,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { apiErrorMessage } from "@/lib/auth-api";
import { cn } from "@/lib/utils";
import {
  DRAFT_PAYMENT_METHODS,
  completeDraftOrder,
  type CompleteDraftResult,
  type DraftOrderRow,
  type DraftPaymentOption,
  type PrintType,
} from "@/lib/admin-api";

const money = (v?: number | string | null) =>
  Number(v ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD" });

const METHOD_LABELS: Record<string, string> = {
  stripe: "Card (Stripe)",
  paypal: "PayPal",
  stripe_and_cash: "Card + cash",
  paypal_and_cash: "PayPal + cash",
  cash: "Cash",
  bank_transfer: "Bank transfer",
  without_payment: "No payment",
};

const OPTIONS: {
  value: DraftPaymentOption;
  title: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "send_payment_link",
    title: "Email a payment link",
    description: "Creates a checkout session and emails the customer the link.",
    icon: <Mail className="size-4" />,
  },
  {
    value: "payment_screen",
    title: "Take payment now",
    description: "Opens the checkout page here — nothing is emailed.",
    icon: <CreditCard className="size-4" />,
  },
  {
    value: "mark_as_paid",
    title: "Mark as paid",
    description: "Records payment as already settled, e.g. cash at the counter.",
    icon: <Banknote className="size-4" />,
  },
];

const PRINT_TYPES: Record<string, string> = {
  a4: "A4 invoice",
  thermal_80mm: "Receipt 80mm",
  thermal_58mm: "Receipt 58mm",
};

const isSplit = (method: string) =>
  method === "stripe_and_cash" || method === "paypal_and_cash";

export function CompleteDraftDialog({
  draft,
  open,
  onOpenChange,
  defaultEmail,
  total,
}: {
  draft: DraftOrderRow;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultEmail?: string;
  /** Display estimate — the server recalculates the real total. */
  total: number;
}) {
  const router = useRouter();

  const [option, setOption] = React.useState<DraftPaymentOption>("send_payment_link");
  const [method, setMethod] = React.useState("stripe");
  const [cashAmount, setCashAmount] = React.useState("");
  const [email, setEmail] = React.useState(defaultEmail ?? "");
  const [note, setNote] = React.useState("");
  const [sendInvoice, setSendInvoice] = React.useState(false);
  const [printType, setPrintType] = React.useState<PrintType>("a4");
  const [sendEmail, setSendEmail] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<CompleteDraftResult | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setOption("send_payment_link");
    setMethod("stripe");
    setCashAmount("");
    setEmail(defaultEmail ?? "");
    setNote("");
    setSendInvoice(false);
    setPrintType("a4");
    setSendEmail(false);
    setResult(null);
  }, [open, defaultEmail]);

  // Each option only accepts its own methods, so switching resets the choice.
  const methods = DRAFT_PAYMENT_METHODS[option];
  React.useEffect(() => {
    if (!methods.includes(method)) setMethod(methods[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [option]);

  const split = isSplit(method);
  const cashNum = Number(cashAmount || 0);
  const onlineAmount = split ? Number((total - cashNum).toFixed(2)) : undefined;
  const needsEmail = option === "send_payment_link" || sendInvoice;

  const problem = split
    ? cashNum <= 0 || cashNum >= total
      ? "Split the total between cash and the gateway."
      : null
    : needsEmail && !email.trim()
      ? "An email address is needed to send this."
      : null;

  const submit = async () => {
    if (problem) return;
    setBusy(true);
    try {
      const res = await completeDraftOrder(draft.id, {
        payment_option: option,
        payment_method: method,
        cash_amount: split
          ? cashNum
          : method === "cash" && cashAmount
            ? cashNum
            : undefined,
        online_amount: split ? onlineAmount : undefined,
        email: email.trim() || undefined,
        note: note.trim() || undefined,
        send_invoice: sendInvoice || undefined,
        invoice_print_type: sendInvoice ? printType : undefined,
        send_email: sendEmail || undefined,
        success_url:
          typeof window !== "undefined"
            ? `${window.location.origin}/orders`
            : undefined,
      });

      setResult(res);
      if (res.success) toast.success(res.message);
      else toast.error(res.message);

      // A payment failure still creates the order, so never retry completing.
      if (res.payment?.session_url && option === "payment_screen") {
        window.open(res.payment.session_url, "_blank", "noopener");
      }
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't complete the draft."));
    } finally {
      setBusy(false);
    }
  };

  const orderNumber = (result?.order as { order_number?: string } | undefined)
    ?.order_number;
  const orderId = (result?.order as { id?: number | string } | undefined)?.id;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && result) {
          // The draft is now an order — go where the work continues.
          onOpenChange(false);
          router.push(orderId ? `/orders/${orderId}` : "/orders");
          return;
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {result ? "Draft completed" : `Collect payment · ${money(total)}`}
          </DialogTitle>
          <DialogDescription>
            {result
              ? `${draft.draft_number ?? "Draft"} is now order ${orderNumber ?? ""}.`
              : "The draft becomes a real order and stock is taken."}
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/30 p-3 text-sm">
              <BadgeCheck className="mt-0.5 size-4 shrink-0 text-[#29845a]" />
              <div className="space-y-1">
                <p className="font-medium">{orderNumber ?? "Order created"}</p>
                <p className="text-muted-foreground">
                  Payment {result.payment?.payment_status ?? "pending"} ·{" "}
                  {METHOD_LABELS[result.payment?.payment_method ?? ""] ??
                    result.payment?.payment_method}
                </p>
                {result.payment?.emailed_to && (
                  <p className="text-muted-foreground">
                    Payment link emailed to {result.payment.emailed_to}
                  </p>
                )}
                {result.payment?.invoice_sent_to && (
                  <p className="text-muted-foreground">
                    Invoice emailed to {result.payment.invoice_sent_to}
                  </p>
                )}
              </div>
            </div>

            {result.payment?.session_url && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() =>
                  window.open(result.payment!.session_url!, "_blank", "noopener")
                }
              >
                <ExternalLink className="size-4" />
                Open the checkout page
              </Button>
            )}

            {!result.success && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-400">
                The order was created but payment didn&apos;t go through. Retry
                payment from the order itself — don&apos;t complete this draft
                again.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Option cards */}
            <div className="space-y-2">
              {OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setOption(o.value)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                    option === o.value
                      ? "border-[#005bd3] bg-[#e0f0ff]/40"
                      : "border-border hover:bg-muted/40"
                  )}
                >
                  <span className="mt-0.5 text-muted-foreground">{o.icon}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{o.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {o.description}
                    </span>
                  </span>
                </button>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label>Payment method</Label>
              <Select
                items={Object.fromEntries(
                  methods.map((m) => [m, METHOD_LABELS[m] ?? m])
                )}
                value={method}
                onValueChange={(v) => setMethod(v as string)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {methods.map((m) => (
                    <SelectItem key={m} value={m}>
                      {METHOD_LABELS[m] ?? m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(split || method === "cash") && (
              <div className="space-y-1.5">
                <Label htmlFor="draft-cash">
                  {split ? "Cash portion" : "Cash collected"}
                </Label>
                <Input
                  id="draft-cash"
                  type="number"
                  min="0"
                  step="0.01"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                  placeholder={split ? "0.00" : total.toFixed(2)}
                  className="tabular-nums"
                />
                {split && (
                  <p className="text-xs text-muted-foreground tabular-nums">
                    On the gateway: {money(onlineAmount)} — the two must add up to
                    the order total.
                  </p>
                )}
                {!split && (
                  <p className="text-xs text-muted-foreground">
                    Leave blank to use the order total.
                  </p>
                )}
              </div>
            )}

            {needsEmail && (
              <div className="space-y-1.5">
                <Label htmlFor="draft-email">Customer email</Label>
                <Input
                  id="draft-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="customer@example.com"
                />
              </div>
            )}

            <div className="space-y-2 rounded-xl border border-border p-3">
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 accent-primary"
                  checked={sendInvoice}
                  onChange={(e) => setSendInvoice(e.target.checked)}
                />
                <span>
                  Email an invoice
                  <span className="block text-xs text-muted-foreground">
                    Attaches the PDF. With a payment link the customer gets one
                    email, not two.
                  </span>
                </span>
              </label>

              {sendInvoice && (
                <Select
                  items={PRINT_TYPES}
                  value={printType}
                  onValueChange={(v) => setPrintType(v as PrintType)}
                >
                  <SelectTrigger className="h-8 w-44 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRINT_TYPES).map(([v, label]) => (
                      <SelectItem key={v} value={v}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 accent-primary"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                />
                <span>
                  Send the order confirmation
                  <span className="block text-xs text-muted-foreground">
                    The standard email customers get for a new order.
                  </span>
                </span>
              </label>
            </div>

            {(option === "send_payment_link" || sendInvoice) && (
              <div className="space-y-1.5">
                <Label htmlFor="draft-note">Message to the customer</Label>
                <Textarea
                  id="draft-note"
                  rows={2}
                  maxLength={1000}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Payment link for your order."
                />
              </div>
            )}

            {problem && <p className="text-sm text-muted-foreground">{problem}</p>}
          </div>
        )}

        <DialogFooter>
          {result ? (
            <Button
              className="w-full"
              onClick={() => {
                onOpenChange(false);
                router.push(orderId ? `/orders/${orderId}` : "/orders");
              }}
            >
              View order
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={busy || !!problem}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                {option === "mark_as_paid"
                  ? "Mark as paid"
                  : option === "send_payment_link"
                    ? "Send payment link"
                    : "Take payment"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
