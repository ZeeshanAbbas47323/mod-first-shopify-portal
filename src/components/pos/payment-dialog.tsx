"use client";

import * as React from "react";
import { CheckCircle2, CreditCard, Loader2, Printer, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { apiErrorMessage } from "@/lib/auth-api";
import { cn } from "@/lib/utils";
import { printOrder, type PrintType } from "@/lib/admin-api";
import { money, openPrintOutput } from "@/components/pos/shift-bar";
import {
  POS_PAYMENT_LABELS,
  POS_PAYMENT_METHODS,
  cancelReaderAction,
  captureTerminalPayment,
  collectTerminalPayment,
  createPosPaymentSession,
  getTerminalPaymentStatus,
  listReaders,
  type PosPaymentMethod,
  type TerminalReaderRow,
} from "@/lib/pos-api";

/** Methods that need a card reader instead of a cash amount. */
const TERMINAL_METHODS: PosPaymentMethod[] = ["stripe", "stripe_and_cash"];
const SPLIT_METHODS: PosPaymentMethod[] = ["stripe_and_cash", "paypal_and_cash"];
const CASH_METHODS: PosPaymentMethod[] = ["cash", ...SPLIT_METHODS];

const PRINT_TYPE_ITEMS: Record<string, string> = {
  thermal_80mm: "Receipt 80mm",
  thermal_58mm: "Receipt 58mm",
  a4: "Invoice A4",
};

type Phase = "form" | "waiting" | "done";

/** Terminal statuses that mean the customer finished on the reader. */
const SUCCESS_STATES = ["succeeded", "requires_capture", "captured", "paid", "completed"];
const FAILED_STATES = ["canceled", "cancelled", "failed", "expired"];

export function PosPaymentDialog({
  open,
  onOpenChange,
  orderCode,
  total,
  onCompleted,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orderCode: string;
  total: number;
  onCompleted: () => void;
}) {
  const [method, setMethod] = React.useState<PosPaymentMethod>("cash");
  const [cashAmount, setCashAmount] = React.useState("");
  const [readers, setReaders] = React.useState<TerminalReaderRow[]>([]);
  const [readerId, setReaderId] = React.useState("");
  const [phase, setPhase] = React.useState<Phase>("form");
  const [busy, setBusy] = React.useState(false);
  const [statusText, setStatusText] = React.useState("");
  const [paymentRef, setPaymentRef] = React.useState<string | null>(null);
  const [printType, setPrintType] = React.useState<PrintType>("thermal_80mm");

  const pollRef = React.useRef<number | null>(null);
  const stopPolling = React.useCallback(() => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  React.useEffect(() => () => stopPolling(), [stopPolling]);

  React.useEffect(() => {
    if (!open) return;
    setMethod("cash");
    setCashAmount(total ? total.toFixed(2) : "");
    setPhase("form");
    setStatusText("");
    setPaymentRef(null);
    setBusy(false);
    listReaders({ page: 1, limit: 50, filters: { is_active: true } })
      .then((res) => {
        setReaders(res.rows);
        const online = res.rows.find((r) => String(r.status).toLowerCase() === "online");
        setReaderId(String((online ?? res.rows[0])?.id ?? ""));
      })
      .catch(() => setReaders([]));
  }, [open, total]);

  const needsCash = CASH_METHODS.includes(method);
  const isSplit = SPLIT_METHODS.includes(method);
  const needsReader = TERMINAL_METHODS.includes(method);

  const cashNum = Number(cashAmount || 0);
  const onlineAmount = isSplit ? Math.max(0, Number((total - cashNum).toFixed(2))) : undefined;
  const changeDue = method === "cash" ? Number((cashNum - total).toFixed(2)) : 0;

  const invalid =
    (needsCash && (isNaN(cashNum) || cashNum < 0)) ||
    (method === "cash" && cashNum < total) ||
    (isSplit && (cashNum <= 0 || cashNum >= total)) ||
    (needsReader && !readerId);

  // ── Terminal flow: push to reader → poll → capture ────────────────────────
  const runTerminal = async (amount: number) => {
    setPhase("waiting");
    setStatusText("Sending the charge to the reader…");
    try {
      const result = await collectTerminalPayment({
        order_code: orderCode,
        reader_id: readerId,
        amount,
      });
      const reference = result.payment_reference;
      if (!reference) throw new Error("No payment reference returned.");
      setPaymentRef(reference);
      setStatusText("Waiting for the customer to tap or insert their card…");

      pollRef.current = window.setInterval(async () => {
        try {
          const status = await getTerminalPaymentStatus(reference);
          const state = String(
            status.status ?? status.payment_status ?? status.state ?? ""
          ).toLowerCase();

          if (SUCCESS_STATES.includes(state)) {
            stopPolling();
            setStatusText("Card approved — capturing…");
            try {
              await captureTerminalPayment(reference);
            } catch {
              // Some flows capture automatically; a failure here is not fatal.
            }
            setPhase("done");
            setStatusText("Payment complete.");
            onCompleted();
          } else if (FAILED_STATES.includes(state)) {
            stopPolling();
            setPhase("form");
            toast.error(`Payment ${state}.`);
          }
        } catch {
          // Transient poll failure — keep waiting.
        }
      }, 2500);
    } catch (error) {
      setPhase("form");
      toast.error(apiErrorMessage(error, "Couldn't start the card payment."));
    }
  };

  const submit = async () => {
    if (invalid) return;
    setBusy(true);
    try {
      const session = await createPosPaymentSession({
        order_code: orderCode,
        payment_method: method,
        cash_amount: needsCash ? cashNum : undefined,
        online_amount: isSplit ? onlineAmount : undefined,
      });

      // Card-present: drive the reader. Hosted gateways: open the checkout URL.
      if (needsReader && readerId) {
        await runTerminal(isSplit ? (onlineAmount ?? 0) : total);
        return;
      }
      if (session.checkout_url) {
        window.open(session.checkout_url, "_blank");
        setStatusText("Complete the payment in the gateway window.");
      }
      setPhase("done");
      onCompleted();
      toast.success("Payment recorded.");
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't record the payment."));
    } finally {
      setBusy(false);
    }
  };

  const abortReader = async () => {
    stopPolling();
    try {
      if (readerId) await cancelReaderAction(readerId);
    } catch {
      // Reader may already be idle.
    }
    setPhase("form");
    setStatusText("");
  };

  const print = async () => {
    try {
      await openPrintOutput(
        await printOrder({ order_code: orderCode, print_type: printType, format: "pdf" })
      );
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't print the receipt."));
    }
  };

  const methodItems = POS_PAYMENT_LABELS as Record<string, string>;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && phase === "waiting") return; // don't close mid-charge
        if (!next) stopPolling();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {phase === "done" ? "Sale complete" : `Take payment · ${money(total)}`}
          </DialogTitle>
          <DialogDescription className="font-mono">{orderCode}</DialogDescription>
        </DialogHeader>

        {phase === "form" && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Payment method</Label>
              <Select
                items={methodItems}
                value={method}
                onValueChange={(v) => {
                  const next = v as PosPaymentMethod;
                  setMethod(next);
                  setCashAmount(next === "cash" ? total.toFixed(2) : "");
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POS_PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {POS_PAYMENT_LABELS[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {needsCash && (
              <div className="space-y-1.5">
                <Label htmlFor="cash-amount">
                  {isSplit ? "Cash portion" : "Cash received"}
                </Label>
                <Input
                  id="cash-amount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                  className="tabular-nums"
                  autoFocus
                />
                {method === "cash" && (
                  <div className="flex flex-wrap gap-1.5">
                    {[total, 20, 50, 100].map((amt, i) => (
                      <Button
                        key={`${amt}-${i}`}
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setCashAmount(Number(amt).toFixed(2))}
                      >
                        {i === 0 ? "Exact" : money(amt)}
                      </Button>
                    ))}
                  </div>
                )}
                {method === "cash" && changeDue > 0 && (
                  <p className="text-sm font-medium text-[#29845a] tabular-nums">
                    Change due {money(changeDue)}
                  </p>
                )}
                {method === "cash" && cashNum < total && cashAmount.trim() !== "" && (
                  <p className="text-sm text-destructive tabular-nums">
                    {money(total - cashNum)} short
                  </p>
                )}
                {isSplit && (
                  <p className="text-sm text-muted-foreground tabular-nums">
                    On card / gateway: {money(onlineAmount)}
                  </p>
                )}
              </div>
            )}

            {needsReader && (
              <div className="space-y-1.5">
                <Label>Card reader</Label>
                <Select
                  items={Object.fromEntries(
                    readers.map((r) => [String(r.id), r.label])
                  )}
                  value={readerId}
                  onValueChange={(v) => setReaderId(v as string)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a reader" />
                  </SelectTrigger>
                  <SelectContent>
                    {readers.map((r) => (
                      <SelectItem key={r.id} value={String(r.id)}>
                        {r.label}
                        {r.status ? ` · ${r.status}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {readers.length === 0 && (
                  <p className="text-xs text-destructive">
                    No readers registered. Add one under POS → Terminals.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {phase === "waiting" && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <CreditCard className="size-8 text-muted-foreground" />
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
            <p className="text-sm font-medium">{statusText}</p>
            <p className="font-mono text-xs text-muted-foreground">{paymentRef}</p>
          </div>
        )}

        {phase === "done" && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <CheckCircle2 className="size-10 text-[#29845a]" />
            <p className="text-sm font-medium">{statusText || "Payment recorded."}</p>
            {method === "cash" && changeDue > 0 && (
              <p className="text-lg font-bold tabular-nums text-[#29845a]">
                Change {money(changeDue)}
              </p>
            )}
            <div className="mt-3 flex items-center gap-2">
              <Select
                items={PRINT_TYPE_ITEMS}
                value={printType}
                onValueChange={(v) => setPrintType(v as PrintType)}
              >
                <SelectTrigger className="h-9 w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRINT_TYPE_ITEMS).map(([v, label]) => (
                    <SelectItem key={v} value={v}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={print}>
                <Printer className="size-4" />
                Print
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          {phase === "form" && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={busy || invalid}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                Charge {money(total)}
              </Button>
            </>
          )}
          {phase === "waiting" && (
            <Button variant="destructive" onClick={abortReader} className={cn("w-full")}>
              <XCircle className="size-4" />
              Cancel on reader
            </Button>
          )}
          {phase === "done" && (
            <Button onClick={() => onOpenChange(false)} className="w-full">
              New sale
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
