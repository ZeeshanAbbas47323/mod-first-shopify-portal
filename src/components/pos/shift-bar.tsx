"use client";

import * as React from "react";
import { format } from "date-fns";
import {
  CirclePause,
  CirclePlay,
  Loader2,
  LockKeyhole,
  Printer,
  Receipt,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StatusBadge, type BadgeTone } from "@/components/status-badge";
import { apiErrorMessage } from "@/lib/auth-api";
import { cn } from "@/lib/utils";
import {
  openPrintWindow,
  pickFileUrl,
  pickHtml,
  popupBlocked,
  showBlob,
  type PrintWindow,
} from "@/lib/print-output";
import {
  closeShift,
  getMyBranchDevices,
  openShift,
  printShiftReport,
  setShiftStatus,
  type PosDeviceRow,
  type ShiftRow,
} from "@/lib/pos-api";

export const money = (v?: string | number | null) =>
  Number(v ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD" });

const SHIFT_TONES: Record<string, BadgeTone> = {
  open: "success",
  paused: "attention",
  closed: "neutral",
  ended: "neutral",
};

/**
 * Show a print-service response in a tab. `target` must be opened
 * synchronously inside the click handler, otherwise the browser blocks it.
 */
export async function openPrintOutput(
  result: Blob | Record<string, unknown>,
  target: PrintWindow
) {
  if (result instanceof Blob) {
    await showBlob(result, target);
    if (popupBlocked(target)) {
      toast.warning("Pop-ups are blocked — the file was downloaded instead.");
    }
    return;
  }
  const url = pickFileUrl(result);
  const html = pickHtml(result);
  if (url) {
    if (target.win) target.show(url);
    else window.open(url, "_blank");
    return;
  }
  if (html) {
    target.writeHtml(html);
    return;
  }
  target.close();
  throw new Error("Nothing to print in the response.");
}

export function ShiftBar({
  shift,
  loading,
  onChanged,
}: {
  shift: ShiftRow | null;
  loading: boolean;
  onChanged: () => void;
}) {
  const [openDialog, setOpenDialog] = React.useState(false);
  const [closeDialog, setCloseDialog] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const toggleStatus = async () => {
    if (!shift) return;
    const next = shift.status === "paused" ? "open" : "paused";
    setBusy(true);
    try {
      toast.success(await setShiftStatus(shift.id, next));
      onChanged();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't change the shift status."));
    } finally {
      setBusy(false);
    }
  };

  const print = async () => {
    if (!shift) return;
    const target = openPrintWindow();
    setBusy(true);
    try {
      await openPrintOutput(await printShiftReport(shift.id, { format: "pdf" }), target);
    } catch (error) {
      target.close();
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : apiErrorMessage(error, "Couldn't print the shift report.")
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <Skeleton className="h-20 w-full rounded-xl" />;
  }

  return (
    <>
      <Card className="py-0 shadow-none">
        <CardContent className="flex flex-wrap items-center gap-4 p-4">
          {shift ? (
            <>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold">
                    {shift.shift_code ?? `Shift #${shift.id}`}
                  </span>
                  <StatusBadge
                    status={(shift.status ?? "open").replace(/\b\w/g, (c) => c.toUpperCase())}
                    tone={SHIFT_TONES[shift.status ?? "open"] ?? "neutral"}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {shift.user?.full_name ?? shift.user?.name ?? "Cashier"}
                  {shift.posDevice?.name ? ` · ${shift.posDevice.name}` : ""}
                  {shift.opened_at
                    ? ` · opened ${format(new Date(shift.opened_at), "MMM d, h:mm a")}`
                    : ""}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm">
                <Metric label="Float" value={money(shift.opening_float)} />
                <Metric label="Sales" value={money(shift.total_sales)} />
                <Metric label="Cash" value={money(shift.cash_sales)} />
                <Metric label="Orders" value={String(shift.total_orders ?? 0)} />
              </div>

              <div className="ml-auto flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={print} disabled={busy}>
                  <Printer className="size-4" />
                  Z-report
                </Button>
                <Button variant="outline" size="sm" onClick={toggleStatus} disabled={busy}>
                  {shift.status === "paused" ? (
                    <>
                      <CirclePlay className="size-4" /> Resume
                    </>
                  ) : (
                    <>
                      <CirclePause className="size-4" /> Pause
                    </>
                  )}
                </Button>
                <Button size="sm" onClick={() => setCloseDialog(true)} disabled={busy}>
                  <LockKeyhole className="size-4" />
                  Close shift
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Receipt className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">No shift is open</p>
                  <p className="text-xs text-muted-foreground">
                    Open a shift to start taking counter sales.
                  </p>
                </div>
              </div>
              <Button className="ml-auto" onClick={() => setOpenDialog(true)}>
                <CirclePlay className="size-4" />
                Open shift
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <OpenShiftDialog
        open={openDialog}
        onOpenChange={setOpenDialog}
        onOpened={onChanged}
      />
      {shift && (
        <CloseShiftDialog
          shift={shift}
          open={closeDialog}
          onOpenChange={setCloseDialog}
          onClosed={onChanged}
        />
      )}
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

// ─── Open ─────────────────────────────────────────────────────────────────────

function OpenShiftDialog({
  open,
  onOpenChange,
  onOpened,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onOpened: () => void;
}) {
  const [devices, setDevices] = React.useState<PosDeviceRow[]>([]);
  const [deviceId, setDeviceId] = React.useState("none");
  const [float, setFloat] = React.useState("0");
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setFloat("0");
    setNotes("");
    setDeviceId("none");
    getMyBranchDevices()
      .then(setDevices)
      .catch(() => setDevices([]));
  }, [open]);

  const submit = async () => {
    setSaving(true);
    try {
      const shift = await openShift({
        opening_float: Number(float) || 0,
        pos_device_id: deviceId === "none" ? undefined : deviceId,
        opening_notes: notes.trim() || undefined,
      });
      toast.success(`Shift ${shift.shift_code ?? ""} opened.`.trim());
      onOpenChange(false);
      onOpened();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't open the shift."));
    } finally {
      setSaving(false);
    }
  };

  const deviceItems: Record<string, string> = {
    none: "No device",
    ...Object.fromEntries(devices.map((d) => [String(d.id), d.name])),
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Open shift</DialogTitle>
          <DialogDescription>
            Count the drawer before you start — the closing report compares against it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="shift-float">Opening float</Label>
            <Input
              id="shift-float"
              type="number"
              min={0}
              step="0.01"
              value={float}
              onChange={(e) => setFloat(e.target.value)}
              className="tabular-nums"
            />
          </div>

          <div className="space-y-1.5">
            <Label>POS device</Label>
            <Select
              items={deviceItems}
              value={deviceId}
              onValueChange={(v) => setDeviceId(v as string)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No device</SelectItem>
                {devices.map((d) => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {d.name}
                    {d.location ? ` · ${d.location}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {devices.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No devices registered for your branch.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="shift-notes">Notes</Label>
            <Textarea
              id="shift-notes"
              rows={2}
              maxLength={1000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Morning shift"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Open shift
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Close ────────────────────────────────────────────────────────────────────

function CloseShiftDialog({
  shift,
  open,
  onOpenChange,
  onClosed,
}: {
  shift: ShiftRow;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onClosed: () => void;
}) {
  const [counted, setCounted] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setCounted("");
      setNotes("");
    }
  }, [open]);

  // Expected drawer = opening float + cash taken during the shift.
  const expected =
    shift.expected_cash != null
      ? Number(shift.expected_cash)
      : Number(shift.opening_float ?? 0) + Number(shift.cash_sales ?? 0);

  const countedNum = Number(counted);
  const diff = counted.trim() && !isNaN(countedNum) ? countedNum - expected : null;

  const submit = async () => {
    if (!counted.trim() || isNaN(countedNum)) return;
    setSaving(true);
    try {
      const closed = await closeShift(shift.id, {
        counted_cash: countedNum,
        closing_notes: notes.trim() || undefined,
      });
      toast.success(`Shift ${closed.shift_code ?? shift.shift_code ?? ""} closed.`.trim());
      onOpenChange(false);
      onClosed();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't close the shift."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Close shift</DialogTitle>
          <DialogDescription>
            Count the drawer and enter the total. Any difference is recorded on the
            Z-report.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-border p-3 text-sm">
            <Metric label="Opening float" value={money(shift.opening_float)} />
            <Metric label="Cash sales" value={money(shift.cash_sales)} />
            <Metric label="Total sales" value={money(shift.total_sales)} />
            <Metric label="Expected cash" value={money(expected)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="counted-cash">Counted cash</Label>
            <Input
              id="counted-cash"
              type="number"
              min={0}
              step="0.01"
              value={counted}
              onChange={(e) => setCounted(e.target.value)}
              placeholder="0.00"
              className="tabular-nums"
              autoFocus
            />
            {diff != null && (
              <p
                className={cn(
                  "text-sm font-medium tabular-nums",
                  Math.abs(diff) < 0.005
                    ? "text-[#29845a]"
                    : diff > 0
                      ? "text-[#b98900]"
                      : "text-[#e51c00]"
                )}
              >
                {Math.abs(diff) < 0.005
                  ? "Balanced"
                  : `${diff > 0 ? "Over" : "Short"} by ${money(Math.abs(diff))}`}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="closing-notes">Closing notes</Label>
            <Textarea
              id="closing-notes"
              rows={2}
              maxLength={1000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="All balanced"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || !counted.trim()}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Close shift
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
