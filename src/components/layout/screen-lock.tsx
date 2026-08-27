"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Delete, Loader2, LockKeyhole } from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiErrorMessage } from "@/lib/auth-api";
import { cn } from "@/lib/utils";
import { getPinStatus, verifyPin } from "@/lib/admin-api";
import { useAuthStore } from "@/stores/auth-store";

/** Locked state survives a reload so refreshing the page can't bypass the lock. */
const LOCK_KEY = "modefirst-locked";
const DEFAULT_MINUTES = 10;

const ACTIVITY_EVENTS = [
  "mousemove", "mousedown", "keydown", "touchstart", "scroll", "wheel",
] as const;

const readLocked = () => {
  try {
    return sessionStorage.getItem(LOCK_KEY) === "1";
  } catch {
    return false;
  }
};

const writeLocked = (locked: boolean) => {
  try {
    if (locked) sessionStorage.setItem(LOCK_KEY, "1");
    else sessionStorage.removeItem(LOCK_KEY);
  } catch {
    // Private mode — the lock just won't survive a reload.
  }
};

/** Imperative lock trigger for the top bar's "Lock screen" menu item. */
export const LOCK_EVENT = "modefirst:lock-screen";
export const lockScreenNow = () =>
  window.dispatchEvent(new CustomEvent(LOCK_EVENT));

export function ScreenLock({ children }: { children: React.ReactNode }) {
  const [pinSet, setPinSet] = React.useState(false);
  const [minutes, setMinutes] = React.useState(DEFAULT_MINUTES);
  const [locked, setLocked] = React.useState(false);

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Load the PIN settings once the user is signed in.
  React.useEffect(() => {
    if (!isAuthenticated) {
      setPinSet(false);
      setLocked(false);
      writeLocked(false);
      return;
    }
    let cancelled = false;
    getPinStatus()
      .then((status) => {
        if (cancelled) return;
        const enabled = !!status.is_pin_set;
        setPinSet(enabled);
        if (status.auto_lock_minutes) setMinutes(Number(status.auto_lock_minutes));
        // Restore a lock that was active before a reload.
        if (enabled && readLocked()) setLocked(true);
      })
      .catch(() => {
        if (!cancelled) setPinSet(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const lock = React.useCallback(() => {
    setLocked(true);
    writeLocked(true);
  }, []);

  const unlock = React.useCallback(() => {
    setLocked(false);
    writeLocked(false);
  }, []);

  // Idle timer — any activity restarts the countdown.
  React.useEffect(() => {
    if (!pinSet || locked) return;

    let timer = window.setTimeout(lock, minutes * 60_000);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(lock, minutes * 60_000);
    };

    ACTIVITY_EVENTS.forEach((e) =>
      window.addEventListener(e, reset, { passive: true })
    );
    return () => {
      window.clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [pinSet, locked, minutes, lock]);

  // Manual lock from the account menu.
  React.useEffect(() => {
    if (!pinSet) return;
    const handler = () => lock();
    window.addEventListener(LOCK_EVENT, handler);
    return () => window.removeEventListener(LOCK_EVENT, handler);
  }, [pinSet, lock]);

  return (
    <>
      {children}
      {locked && <LockOverlay onUnlock={unlock} />}
    </>
  );
}

// ─── Overlay ──────────────────────────────────────────────────────────────────

function LockOverlay({ onUnlock }: { onUnlock: () => void }) {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [pin, setPin] = React.useState("");
  const [checking, setChecking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const initials =
    (user?.name ?? "MF")
      .split(/\s+/)
      .map((p) => p[0] ?? "")
      .join("")
      .slice(0, 2)
      .toUpperCase() || "MF";

  const submit = React.useCallback(
    async (value: string) => {
      if (value.length < 4 || checking) return;
      setChecking(true);
      setError(null);
      try {
        const ok = await verifyPin(value);
        if (ok) {
          setPin("");
          onUnlock();
        } else {
          setPin("");
          setError("Incorrect PIN.");
        }
      } catch (err) {
        setPin("");
        setError(apiErrorMessage(err, "Incorrect PIN."));
      } finally {
        setChecking(false);
      }
    },
    [checking, onUnlock]
  );

  const press = (digit: string) => {
    setError(null);
    setPin((prev) => {
      const next = (prev + digit).slice(0, 6);
      return next;
    });
  };

  // Physical keyboard works too — digits, backspace, Enter.
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) {
        e.preventDefault();
        press(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        setPin((p) => p.slice(0, -1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        submit(pin);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [pin, submit]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Screen locked"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-[#1a1a1a]/98 backdrop-blur-sm"
    >
      <div className="flex flex-col items-center gap-2">
        <span className="flex size-14 items-center justify-center rounded-full bg-white/10 text-lg font-semibold text-white">
          {initials}
        </span>
        <p className="text-base font-medium text-white">{user?.name ?? "Locked"}</p>
        <p className="flex items-center gap-1.5 text-xs text-white/60">
          <LockKeyhole className="size-3.5" />
          Enter your PIN to unlock
        </p>
      </div>

      {/* PIN dots */}
      <div className="flex items-center gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "size-3 rounded-full border border-white/40 transition-colors",
              i < pin.length && "bg-white"
            )}
          />
        ))}
      </div>

      <p className="h-5 text-sm text-[#ff9a8a]">{error ?? ""}</p>

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <KeypadButton key={d} onClick={() => press(d)}>
            {d}
          </KeypadButton>
        ))}
        <KeypadButton onClick={() => setPin((p) => p.slice(0, -1))} aria-label="Delete">
          <Delete className="size-5" />
        </KeypadButton>
        <KeypadButton onClick={() => press("0")}>0</KeypadButton>
        <KeypadButton
          onClick={() => submit(pin)}
          disabled={pin.length < 4 || checking}
          aria-label="Unlock"
          primary
        >
          {checking ? <Loader2 className="size-5 animate-spin" /> : "→"}
        </KeypadButton>
      </div>

      <Button
        variant="ghost"
        className="text-white/60 hover:bg-white/10 hover:text-white"
        onClick={() => {
          writeLocked(false);
          logout();
          router.replace("/login");
        }}
      >
        Sign out instead
      </Button>
    </div>
  );
}

function KeypadButton({
  children,
  onClick,
  disabled,
  primary,
  ...rest
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
} & React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex size-16 items-center justify-center rounded-full text-xl font-medium text-white transition-colors",
        "bg-white/10 hover:bg-white/20 active:bg-white/30",
        "disabled:pointer-events-none disabled:opacity-40",
        primary && "bg-white/20 hover:bg-white/30"
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
