"use client";

import * as React from "react";
import { format } from "date-fns";
import { Loader2, ReceiptText, RotateCcw, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { StatusBadge, type BadgeTone } from "@/components/status-badge";
import { apiErrorMessage } from "@/lib/auth-api";
import {
  cancelRefund,
  createRefund,
  listOrderPayments,
  listRefundsByPayment,
  refundedTotal,
  type PaymentRow,
  type RefundRow,
} from "@/lib/admin-api";

const fmt$ = (n?: string | number | null, currency = "USD") => {
  const v = Number(n ?? 0);
  return v.toLocaleString("en-US", { style: "currency", currency });
};

const fmtWhen = (v?: string) => {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "—" : format(d, "MMM d, yyyy · h:mm a");
};

const humanize = (v?: string) =>
  v ? v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "—";

const REFUND_TONES: Record<string, BadgeTone> = {
  succeeded: "success",
  completed: "success",
  paid: "success",
  pending: "attention",
  processing: "info",
  failed: "critical",
  cancelled: "neutral",
  canceled: "neutral",
};

/** A payment plus its refunds and the balance still refundable. */
interface PaymentWithRefunds {
  payment: PaymentRow;
  refunds: RefundRow[];
  refunded: number;
  refundable: number;
}

const isCancellable = (status?: string) =>
  ["pending", "processing", "requires_action"].includes(
    String(status ?? "").toLowerCase()
  );

export function RefundsSection({ orderId }: { orderId: number | string }) {
  const [entries, setEntries] = React.useState<PaymentWithRefunds[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshKey, setRefreshKey] = React.useState(0);

  const [refundTarget, setRefundTarget] = React.useState<PaymentWithRefunds | null>(null);
  const [cancelTarget, setCancelTarget] = React.useState<RefundRow | null>(null);
  const [cancelling, setCancelling] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);

    listOrderPayments(orderId)
      .then(async (payments) => {
        // Refunds live per payment, so fetch them alongside each one.
        const withRefunds = await Promise.all(
          payments.map(async (payment) => {
            let refunds: RefundRow[] = [];
            try {
              refunds = await listRefundsByPayment(payment.id);
            } catch {
              refunds = [];
            }
            const refunded = refundedTotal(refunds);
            return {
              payment,
              refunds,
              refunded,
              refundable: Math.max(0, Number(payment.amount ?? 0) - refunded),
            };
          })
        );
        if (!cancelled) setEntries(withRefunds);
      })
      .catch((error) => {
        if (cancelled) return;
        setEntries([]);
        toast.error(apiErrorMessage(error, "Couldn't load payments."));
      })
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [orderId, refreshKey]);

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      const message = await cancelRefund(cancelTarget.id);
      toast.success(message);
      setCancelTarget(null);
      setRefreshKey((k) => k + 1);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't cancel the refund."));
    } finally {
      setCancelling(false);
    }
  };

  if (!loading && entries.length === 0) return null;

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-center gap-2 pb-3">
          <ReceiptText className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">Payments &amp; refunds</CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          {loading ? (
            Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))
          ) : (
            entries.map(({ payment, refunds, refunded, refundable }) => {
              const currency = payment.currency ?? "USD";
              return (
                <div key={String(payment.id)} className="rounded-xl border border-border p-3">
                  {/* Payment header */}
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium capitalize">
                          {humanize(payment.payment_method)}
                        </span>
                        {payment.status && (
                          <StatusBadge status={humanize(payment.status)} />
                        )}
                      </div>
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        {payment.payment_reference ?? `Payment #${payment.id}`}
                        {" · "}
                        {fmtWhen(payment.captured_at ?? payment.created_at)}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="font-semibold tabular-nums">
                        {fmt$(payment.amount, currency)}
                      </p>
                      {refunded > 0 && (
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {fmt$(refunded, currency)} refunded ·{" "}
                          {fmt$(refundable, currency)} left
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Refund list */}
                  {refunds.length > 0 && (
                    <div className="mt-3 space-y-1.5 border-t border-border pt-2.5">
                      {refunds.map((r) => (
                        <div
                          key={String(r.id)}
                          className="flex flex-wrap items-center gap-2 text-sm"
                        >
                          <Undo2 className="size-3.5 shrink-0 text-muted-foreground" />
                          <span className="font-medium tabular-nums">
                            {fmt$(r.amount, currency)}
                          </span>
                          <StatusBadge
                            status={humanize(r.status)}
                            tone={REFUND_TONES[String(r.status ?? "").toLowerCase()] ?? "neutral"}
                          />
                          {r.reason && (
                            <span className="min-w-0 truncate text-xs text-muted-foreground">
                              {r.reason}
                            </span>
                          )}
                          <span className="ml-auto text-xs text-muted-foreground">
                            {fmtWhen(r.created_at)}
                          </span>
                          {isCancellable(r.status) && (
                            <button
                              type="button"
                              onClick={() => setCancelTarget(r)}
                              className="rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-destructive"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Action */}
                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2.5">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      Refundable: {fmt$(refundable, currency)}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={refundable <= 0}
                      onClick={() => setRefundTarget({ payment, refunds, refunded, refundable })}
                    >
                      <RotateCcw className="size-3.5" />
                      Refund
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <RefundDialog
        entry={refundTarget}
        onOpenChange={(next) => !next && setRefundTarget(null)}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />

      <ConfirmDeleteDialog
        open={!!cancelTarget}
        onOpenChange={(next) => !next && setCancelTarget(null)}
        loading={cancelling}
        onConfirm={handleCancel}
        title="Cancel this refund?"
        confirmLabel="Cancel refund"
        description={
          cancelTarget
            ? `The ${fmt$(cancelTarget.amount)} refund will not be processed.`
            : undefined
        }
      />
    </>
  );
}

// ─── Refund dialog ────────────────────────────────────────────────────────────

function RefundDialog({
  entry,
  onOpenChange,
  onSaved,
}: {
  entry: PaymentWithRefunds | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const currency = entry?.payment.currency ?? "USD";
  const max = entry?.refundable ?? 0;

  React.useEffect(() => {
    if (entry) {
      setAmount(max ? String(max.toFixed(2)) : "");
      setReason("");
    }
  }, [entry, max]);

  const parsed = Number(amount);
  const invalid =
    !amount.trim() || isNaN(parsed) || parsed <= 0 || parsed > max + 0.001;

  const submit = async () => {
    if (!entry || invalid) return;
    setSaving(true);
    try {
      const message = await createRefund({
        payment_id: entry.payment.id,
        amount: Number(parsed.toFixed(2)),
        reason: reason.trim() || undefined,
      });
      toast.success(message);
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't create the refund."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!entry} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Refund payment</DialogTitle>
          <DialogDescription>
            {entry
              ? `${humanize(entry.payment.payment_method)} · ${fmt$(entry.payment.amount, currency)} charged, ${fmt$(max, currency)} refundable.`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="refund-amount">Amount</Label>
            <div className="flex items-center gap-2">
              <Input
                id="refund-amount"
                type="number"
                min={0}
                max={max}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="tabular-nums"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setAmount(max.toFixed(2))}
              >
                Full
              </Button>
            </div>
            {amount.trim() && invalid && (
              <p className="text-sm text-destructive">
                Enter an amount between 0 and {fmt$(max, currency)}.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="refund-reason">Reason</Label>
            <Textarea
              id="refund-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Customer requested refund — size was too small"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={saving || invalid}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Refund {!invalid ? fmt$(parsed, currency) : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
