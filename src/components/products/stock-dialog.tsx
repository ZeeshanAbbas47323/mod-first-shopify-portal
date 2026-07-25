"use client";

import * as React from "react";
import { format } from "date-fns";
import { ArrowDown, ArrowUp, Loader2, Pencil, RefreshCw } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { apiErrorMessage } from "@/lib/auth-api";
import {
  INVENTORY_REASONS,
  increaseInventory,
  decreaseInventory,
  adjustInventory,
  getInventoryStock,
  listInventoryLogs,
  type InventoryLogRow,
  type InventoryReason,
  type InventoryStock,
} from "@/lib/admin-api";

type Mode = "increase" | "decrease" | "adjust";

const reasonLabel: Record<string, string> = {
  STOCK_IN: "Stock in",
  STOCK_OUT: "Stock out",
  MANUAL_ADJUSTMENT: "Manual adjustment",
  ORDER_PLACED: "Order placed",
  ORDER_CANCELLED: "Order cancelled",
  RETURNED: "Returned",
  DAMAGED: "Damaged",
};

const buildStockSchema = (mode: Mode) =>
  z.object({
    quantity: mode === "adjust"
      ? z.number({ error: "Quantity is required" }).nonnegative("Must be 0 or more")
      : z.number({ error: "Quantity is required" }).positive("Must be greater than 0"),
    reason: z.enum(INVENTORY_REASONS).optional(),
    notes: z.string().optional(),
  });
type StockValues = { quantity: number; reason?: InventoryReason; notes?: string };

export function StockDialog({
  open, onOpenChange, productId, productName, variantId, variantLabel,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  productId: number | string;
  productName?: string;
  variantId?: number | string | null;
  variantLabel?: string;
}) {
  const [mode, setMode] = React.useState<Mode>("increase");
  const [stock, setStock] = React.useState<InventoryStock | null>(null);
  const [stockLoading, setStockLoading] = React.useState(false);
  const [logs, setLogs] = React.useState<InventoryLogRow[]>([]);
  const [logsLoading, setLogsLoading] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);

  const modeRef = React.useRef<Mode>(mode);
  React.useEffect(() => { modeRef.current = mode; }, [mode]);

  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } =
    useForm<StockValues>({
      resolver: (values, context, options) =>
        zodResolver(buildStockSchema(modeRef.current))(values, context, options),
      defaultValues: { quantity: undefined as unknown as number, reason: undefined, notes: "" },
    });

  React.useEffect(() => {
    if (open) {
      reset({ quantity: undefined as unknown as number, reason: undefined, notes: "" });
      setMode("increase");
    }
  }, [open, reset]);

  // Re-reset when mode changes so the mode-specific schema applies to a fresh form
  React.useEffect(() => {
    reset({ quantity: undefined as unknown as number, reason: undefined, notes: "" });
  }, [mode, reset]);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setStockLoading(true);
    getInventoryStock(productId, variantId ?? undefined)
      .then((raw) => {
        if (cancelled) return;
        // Response envelope may be flat, nested under `stock`, or an array `stocks[]`
        const r = raw as Record<string, unknown> | null;
        let flat: InventoryStock | null = null;
        if (r && typeof r === "object") {
          if (typeof (r as { quantity?: unknown }).quantity === "number") {
            flat = r as unknown as InventoryStock;
          } else if ((r as { stock?: unknown }).stock && typeof (r as { stock?: Record<string, unknown> }).stock === "object") {
            flat = (r as { stock: InventoryStock }).stock;
          } else if (Array.isArray((r as { stocks?: unknown }).stocks)) {
            const stocks = (r as { stocks: InventoryStock[] }).stocks;
            const target = variantId != null
              ? stocks.find((s) => String(s.variant_id) === String(variantId))
              : stocks.find((s) => s.variant_id == null) ?? stocks[0];
            flat = target ?? null;
          }
        }
        setStock(flat);
      })
      .catch(() => !cancelled && setStock(null))
      .finally(() => !cancelled && setStockLoading(false));
    return () => { cancelled = true; };
  }, [open, productId, variantId, refreshKey]);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLogsLoading(true);
    listInventoryLogs({
      page: 1, limit: 10,
      filters: { product_id: productId, variant_id: variantId ?? undefined },
    })
      .then((res) => !cancelled && setLogs(res.rows))
      .catch(() => !cancelled && setLogs([]))
      .finally(() => !cancelled && setLogsLoading(false));
    return () => { cancelled = true; };
  }, [open, productId, variantId, refreshKey]);

  const onSubmit = async (values: StockValues) => {
    const commonBody = {
      product_id: productId,
      variant_id: variantId ?? undefined,
      quantity: values.quantity,
      notes: values.notes || undefined,
    };
    try {
      let msg: string;
      if (mode === "adjust") {
        msg = await adjustInventory(commonBody);
      } else if (mode === "increase") {
        msg = await increaseInventory({ ...commonBody, reason: values.reason as InventoryReason | undefined });
      } else {
        msg = await decreaseInventory({ ...commonBody, reason: values.reason as InventoryReason | undefined });
      }
      toast.success(msg);
      reset({ quantity: undefined, reason: undefined, notes: "" });
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't update inventory."));
    }
  };

  const qty = stock?.quantity ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage stock</DialogTitle>
          <DialogDescription>
            {productName ?? `Product #${productId}`}
            {variantLabel && <> · <span className="text-foreground">{variantLabel}</span></>}
          </DialogDescription>
        </DialogHeader>

        {/* Current stock */}
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">Current stock</p>
          {stockLoading ? (
            <Loader2 className="mt-1 size-4 animate-spin text-muted-foreground" />
          ) : (
            <p className={`text-2xl font-semibold ${qty === 0 ? "text-destructive" : ""}`}>
              {qty}
            </p>
          )}
        </div>

        {/* Mode tabs */}
        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <TabsList className="w-full">
            <TabsTrigger value="increase" className="flex-1">
              <ArrowUp className="size-3.5" /> Increase
            </TabsTrigger>
            <TabsTrigger value="decrease" className="flex-1">
              <ArrowDown className="size-3.5" /> Decrease
            </TabsTrigger>
            <TabsTrigger value="adjust" className="flex-1">
              <Pencil className="size-3.5" /> Set exact
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="stock-qty">
              {mode === "adjust" ? "New exact quantity" : "Quantity"} *
            </Label>
            <Input id="stock-qty" type="number" min={mode === "adjust" ? "0" : "1"} step="1"
              aria-invalid={!!errors.quantity}
              {...register("quantity", {
                setValueAs: (v) => {
                  if (v === "" || v === null || v === undefined) return undefined;
                  const n = typeof v === "number" ? v : parseFloat(String(v));
                  return isNaN(n) ? undefined : n;
                },
              })} />
            {errors.quantity && <p className="text-sm text-destructive">{errors.quantity.message}</p>}
          </div>

          {mode !== "adjust" && (
            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Controller control={control} name="reason" render={({ field }) => (
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>
                    {INVENTORY_REASONS.map((r) => (
                      <SelectItem key={r} value={r}>{reasonLabel[r] ?? r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )} />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="stock-notes">Notes</Label>
            <Textarea id="stock-notes" rows={2}
              placeholder="Received new stock from supplier"
              {...register("notes")} />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {mode === "adjust" ? "Set stock" : mode === "increase" ? "Add stock" : "Remove stock"}
            </Button>
          </DialogFooter>
        </form>

        {/* Recent activity */}
        <div className="space-y-2 border-t border-border pt-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Recent activity
            </p>
            <button
              type="button"
              onClick={() => setRefreshKey((k) => k + 1)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={`size-3 ${logsLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
          {logsLoading ? (
            <Loader2 className="mx-auto size-4 animate-spin text-muted-foreground" />
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No inventory activity yet.</p>
          ) : (
            <div className="max-h-56 space-y-2 overflow-y-auto">
              {logs.map((log) => {
                const change = log.quantity_change ?? 0;
                const positive = change > 0;
                return (
                  <div key={log.id} className="flex items-start gap-2 rounded-lg border border-border p-2 text-sm">
                    <Badge variant="outline" className={`shrink-0 font-mono text-xs ${positive ? "text-emerald-700" : "text-destructive"}`}>
                      {positive ? "+" : ""}{change}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs">
                        {reasonLabel[log.reason ?? ""] ?? log.reason ?? "Update"}
                        {log.performer?.full_name && (
                          <span className="text-muted-foreground"> · {log.performer.full_name}</span>
                        )}
                      </p>
                      {log.notes && <p className="truncate text-xs text-muted-foreground">{log.notes}</p>}
                      {log.created_at && (
                        <p className="text-[10px] text-muted-foreground">
                          {format(new Date(log.created_at), "MMM d, yyyy · HH:mm")}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
