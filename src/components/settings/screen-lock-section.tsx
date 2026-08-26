"use client";

import * as React from "react";
import { format } from "date-fns";
import { KeyRound, Loader2, LockKeyhole, ShieldCheck, Timer } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { apiErrorMessage } from "@/lib/auth-api";
import {
  changePin,
  disablePin,
  getPinStatus,
  listUsers,
  resetUserPin,
  setPin,
  updateAutoLock,
  verifyPin,
  type PinStatus,
  type UserRow,
} from "@/lib/admin-api";

const AUTO_LOCK_OPTIONS = [1, 5, 10, 15, 30, 60, 120];

/**
 * Only staff who sign in at a terminal have a screen-lock PIN. The list API
 * takes a single role per request, so the roles are fetched in parallel and
 * merged.
 */
const PIN_ROLES = ["pos_user", "super_admin", "admin"] as const;

async function listPinUsers(search: string): Promise<UserRow[]> {
  const pages = await Promise.all(
    PIN_ROLES.map((role) =>
      listUsers({
        page: 1,
        limit: 20,
        filters: { role, full_name: search.trim() || undefined },
      })
        .then((res) => res.rows)
        .catch(() => [] as UserRow[])
    )
  );
  const byId = new Map<string, UserRow>();
  pages.flat().forEach((u) => byId.set(String(u.id), u));
  return [...byId.values()].sort((a, b) =>
    (a.full_name ?? "").localeCompare(b.full_name ?? "")
  );
}
const PIN_RE = /^\d{4,6}$/;

/** Digits only, capped at 6 — every PIN field shares this. */
const onlyDigits = (v: string) => v.replace(/\D/g, "").slice(0, 6);

function PinInput({
  id,
  value,
  onChange,
  label,
  autoFocus,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  label: string;
  autoFocus?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="password"
        inputMode="numeric"
        autoComplete="off"
        placeholder="••••"
        value={value}
        onChange={(e) => onChange(onlyDigits(e.target.value))}
        className="w-40 font-mono tracking-[0.4em]"
        autoFocus={autoFocus}
      />
    </div>
  );
}

export function ScreenLockSection() {
  const [status, setStatus] = React.useState<PinStatus | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshKey, setRefreshKey] = React.useState(0);

  const [setDialog, setSetDialog] = React.useState(false);
  const [changeDialog, setChangeDialog] = React.useState(false);
  const [disableDialog, setDisableDialog] = React.useState(false);
  const [verifyDialog, setVerifyDialog] = React.useState(false);
  const [resetDialog, setResetDialog] = React.useState(false);

  const [autoLock, setAutoLock] = React.useState("10");
  const [savingAutoLock, setSavingAutoLock] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getPinStatus()
      .then((s) => {
        if (cancelled) return;
        setStatus(s);
        if (s.auto_lock_minutes != null) setAutoLock(String(s.auto_lock_minutes));
      })
      .catch((error) => {
        if (cancelled) return;
        setStatus(null);
        toast.error(apiErrorMessage(error, "Couldn't load the PIN status."));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const reload = () => setRefreshKey((k) => k + 1);
  const pinSet = !!status?.is_pin_set;

  const saveAutoLock = async (minutes: string) => {
    setAutoLock(minutes);
    setSavingAutoLock(true);
    try {
      toast.success(await updateAutoLock(Number(minutes)));
      reload();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't update auto-lock."));
    } finally {
      setSavingAutoLock(false);
    }
  };

  if (loading) {
    return <Skeleton className="h-52 w-full rounded-xl" />;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Status */}
      <Card className="shadow-none">
        <CardHeader className="flex-row items-center gap-2 pb-3">
          <LockKeyhole className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">Screen lock PIN</CardTitle>
          <StatusBadge
            status={pinSet ? "Enabled" : "Not set"}
            tone={pinSet ? "success" : "neutral"}
          />
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            A 4–6 digit PIN to unlock the portal after it has been left idle — handy on a
            shared counter machine, so nobody has to sign in again.
          </p>

          {pinSet && status?.pin_updated_at && (
            <p className="text-xs text-muted-foreground">
              Last changed{" "}
              {format(new Date(status.pin_updated_at), "MMM d, yyyy · h:mm a")}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {pinSet ? (
              <>
                <Button variant="outline" onClick={() => setChangeDialog(true)}>
                  <KeyRound className="size-4" />
                  Change PIN
                </Button>
                <Button variant="outline" onClick={() => setVerifyDialog(true)}>
                  <ShieldCheck className="size-4" />
                  Test PIN
                </Button>
                <Button variant="destructive" onClick={() => setDisableDialog(true)}>
                  Disable PIN
                </Button>
              </>
            ) : (
              <Button onClick={() => setSetDialog(true)}>
                <KeyRound className="size-4" />
                Set a PIN
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Auto-lock */}
      <Card className="shadow-none">
        <CardHeader className="flex-row items-center gap-2 pb-3">
          <Timer className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">Auto-lock</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Lock the screen after this much inactivity.
          </p>
          <div className="flex items-center gap-2">
            <Select
              items={Object.fromEntries(
                AUTO_LOCK_OPTIONS.map((m) => [String(m), `${m} minute${m === 1 ? "" : "s"}`])
              )}
              value={autoLock}
              onValueChange={(v) => saveAutoLock(v as string)}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUTO_LOCK_OPTIONS.map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {m} minute{m === 1 ? "" : "s"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {savingAutoLock && (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            )}
          </div>
          {!pinSet && (
            <p className="text-xs text-muted-foreground">
              Auto-lock only takes effect once a PIN is set.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Admin reset */}
      <Card className="shadow-none">
        <CardHeader className="flex-row items-center gap-2 pb-3">
          <ShieldCheck className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">Reset a user&apos;s PIN</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Set a new PIN for a team member who has forgotten theirs. They can change it
            afterwards from their own settings.
          </p>
          <Button variant="outline" onClick={() => setResetDialog(true)}>
            Reset a PIN
          </Button>
        </CardContent>
      </Card>

      <SetPinDialog open={setDialog} onOpenChange={setSetDialog} onSaved={reload} />
      <ChangePinDialog open={changeDialog} onOpenChange={setChangeDialog} onSaved={reload} />
      <DisablePinDialog open={disableDialog} onOpenChange={setDisableDialog} onSaved={reload} />
      <VerifyPinDialog open={verifyDialog} onOpenChange={setVerifyDialog} />
      <ResetPinDialog open={resetDialog} onOpenChange={setResetDialog} />
    </div>
  );
}

// ─── Set ──────────────────────────────────────────────────────────────────────

function SetPinDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [pin, setPinValue] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setPinValue("");
      setConfirm("");
    }
  }, [open]);

  const mismatch = confirm.length > 0 && pin !== confirm;
  const invalid = !PIN_RE.test(pin) || pin !== confirm;

  const submit = async () => {
    if (invalid) return;
    setSaving(true);
    try {
      toast.success(await setPin(pin, confirm));
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't set the PIN."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Set a PIN</DialogTitle>
          <DialogDescription>4 to 6 digits.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <PinInput id="new-pin" label="PIN" value={pin} onChange={setPinValue} autoFocus />
          <PinInput id="confirm-pin" label="Confirm PIN" value={confirm} onChange={setConfirm} />
          {pin.length > 0 && !PIN_RE.test(pin) && (
            <p className="text-sm text-destructive">PIN must be 4 to 6 digits.</p>
          )}
          {mismatch && <p className="text-sm text-destructive">PINs don&apos;t match.</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || invalid}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Set PIN
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Change ───────────────────────────────────────────────────────────────────

function ChangePinDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setCurrent("");
      setNext("");
      setConfirm("");
    }
  }, [open]);

  const invalid = !current || !PIN_RE.test(next) || next !== confirm;

  const submit = async () => {
    if (invalid) return;
    setSaving(true);
    try {
      toast.success(
        await changePin({ currentPin: current, newPin: next, confirmNewPin: confirm })
      );
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't change the PIN."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Change PIN</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <PinInput
            id="current-pin"
            label="Current PIN"
            value={current}
            onChange={setCurrent}
            autoFocus
          />
          <PinInput id="next-pin" label="New PIN" value={next} onChange={setNext} />
          <PinInput
            id="confirm-next-pin"
            label="Confirm new PIN"
            value={confirm}
            onChange={setConfirm}
          />
          {confirm.length > 0 && next !== confirm && (
            <p className="text-sm text-destructive">PINs don&apos;t match.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || invalid}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Change PIN
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Disable ──────────────────────────────────────────────────────────────────

function DisablePinDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [current, setCurrent] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) setCurrent("");
  }, [open]);

  const submit = async () => {
    if (!current) return;
    setSaving(true);
    try {
      toast.success(await disablePin(current));
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't disable the PIN."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Disable PIN</DialogTitle>
          <DialogDescription>
            The screen will stop locking. Confirm with your current PIN.
          </DialogDescription>
        </DialogHeader>
        <PinInput
          id="disable-pin"
          label="Current PIN"
          value={current}
          onChange={setCurrent}
          autoFocus
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={submit} disabled={saving || !current}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Disable PIN
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Verify ───────────────────────────────────────────────────────────────────

function VerifyPinDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [pin, setPinValue] = React.useState("");
  const [checking, setChecking] = React.useState(false);

  React.useEffect(() => {
    if (open) setPinValue("");
  }, [open]);

  const submit = async () => {
    if (!pin) return;
    setChecking(true);
    try {
      const ok = await verifyPin(pin);
      if (ok) {
        toast.success("PIN is correct.");
        onOpenChange(false);
      } else {
        toast.error("That PIN is incorrect.");
      }
    } catch (error) {
      toast.error(apiErrorMessage(error, "That PIN is incorrect."));
    } finally {
      setChecking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Test your PIN</DialogTitle>
          <DialogDescription>
            Check the PIN you&apos;ll type on the lock screen.
          </DialogDescription>
        </DialogHeader>
        <PinInput
          id="verify-pin"
          label="PIN"
          value={pin}
          onChange={setPinValue}
          autoFocus
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={submit} disabled={checking || !pin}>
            {checking && <Loader2 className="size-4 animate-spin" />}
            Verify
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Admin reset ──────────────────────────────────────────────────────────────

function ResetPinDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [search, setSearch] = React.useState("");
  const [results, setResults] = React.useState<UserRow[]>([]);
  const [user, setUser] = React.useState<UserRow | null>(null);
  const [searching, setSearching] = React.useState(false);
  const [pin, setPinValue] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  // Preload a first page of users so the picker is never an empty dead end.
  React.useEffect(() => {
    if (!open) return;
    setSearch("");
    setUser(null);
    setPinValue("");
    setConfirm("");
    setSearching(true);
    listPinUsers("")
      .then(setResults)
      .catch(() => setResults([]))
      .finally(() => setSearching(false));
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      setSearching(true);
      listPinUsers(search)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 350);
    return () => clearTimeout(t);
  }, [search, open]);

  // Spell out what is still missing rather than leaving the button dead.
  const problem = !user
    ? "Select a user first."
    : !PIN_RE.test(pin)
      ? "Enter a new PIN of 4 to 6 digits."
      : pin !== confirm
        ? "PINs don't match."
        : null;
  const invalid = !!problem;

  const submit = async () => {
    if (invalid || !user) return;
    setSaving(true);
    try {
      toast.success(
        await resetUserPin({ userId: user.id, newPin: pin, confirmNewPin: confirm })
      );
      onOpenChange(false);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't reset the PIN."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset a user&apos;s PIN</DialogTitle>
          <DialogDescription>
            Tell them the new PIN privately — they can change it from their own settings.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pin-user">User</Label>
            {user ? (
              <div className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{user.full_name}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setUser(null)}>
                  Change
                </Button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Input
                  id="pin-user"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search POS and admin users by name"
                />
                <div className="max-h-48 overflow-y-auto rounded-lg border border-border">
                  {searching ? (
                    <p className="flex items-center justify-center gap-2 px-3 py-4 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      Searching…
                    </p>
                  ) : results.length === 0 ? (
                    <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                      No POS or admin users found.
                    </p>
                  ) : (
                    results.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => setUser(u)}
                        className="block w-full border-b border-border px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted"
                      >
                        <span className="font-medium">{u.full_name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {u.email}
                          {u.role ? ` · ${u.role.replace(/_/g, " ")}` : ""}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <PinInput id="reset-pin" label="New PIN" value={pin} onChange={setPinValue} />
          <PinInput
            id="reset-confirm"
            label="Confirm new PIN"
            value={confirm}
            onChange={setConfirm}
          />
          {problem && <p className="text-sm text-muted-foreground">{problem}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || invalid}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Reset PIN
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
