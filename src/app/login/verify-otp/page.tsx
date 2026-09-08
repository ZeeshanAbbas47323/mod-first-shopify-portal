"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AuthShell } from "@/components/auth-shell";
import { OtpInput } from "@/components/otp-input";
import { apiErrorMessage, sendOtp, verifyOtp } from "@/lib/auth-api";
import { useAuthStore } from "@/stores/auth-store";

/** Seconds before "Resend code" becomes available again. */
const RESEND_COOLDOWN = 30;

function VerifyOtpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const login = useAuthStore((s) => s.login);

  const [otp, setOtp] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [resending, setResending] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(RESEND_COOLDOWN);

  // Verification fires from the input's completion callback, so guard against
  // a second run while the first request is still in flight.
  const verifying = React.useRef(false);

  React.useEffect(() => {
    if (!email) router.replace("/login");
  }, [email, router]);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const submit = React.useCallback(
    async (code: string) => {
      if (verifying.current) return;
      verifying.current = true;
      setError(null);
      setBusy(true);
      try {
        const result = await verifyOtp(email, code);
        if (result.token) {
          login(
            result.user ?? { name: email.split("@")[0], email },
            result.token,
            result.refreshToken
          );
          toast.success(result.message || "Welcome back!");
          router.replace("/");
        } else {
          toast.success(result.message || "Code verified.");
          router.replace("/login");
        }
      } catch (err) {
        const message = apiErrorMessage(err, "Invalid or expired code.");
        setError(message);
        toast.error(message);
        // Clear the boxes so the next attempt starts from an empty field.
        setOtp("");
      } finally {
        verifying.current = false;
        setBusy(false);
      }
    },
    [email, login, router]
  );

  const resend = async () => {
    setResending(true);
    setError(null);
    try {
      toast.success(await sendOtp(email));
      setOtp("");
      setCooldown(RESEND_COOLDOWN);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't resend the code."));
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthShell
      title="Enter verification code"
      subtitle={
        <>
          We sent a 6-digit code to <span className="font-medium">{email}</span>
        </>
      }
    >
      <OtpInput
        value={otp}
        onChange={setOtp}
        onComplete={submit}
        disabled={busy}
        invalid={!!error}
      />

      {/* Reserved height so the layout doesn't jump as messages swap. */}
      <div className="mt-4 min-h-5 text-center text-sm" aria-live="polite">
        {busy && (
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Verifying…
          </span>
        )}
        {!busy && error && <span className="text-destructive">{error}</span>}
      </div>

      <div className="mt-4 flex items-center justify-between text-sm">
        <Link
          href="/login"
          className="flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to login
        </Link>

        {cooldown > 0 ? (
          <span className="text-muted-foreground">Resend in {cooldown}s</span>
        ) : (
          <button
            type="button"
            onClick={resend}
            disabled={resending || busy}
            className="cursor-pointer font-medium text-[#005bd3] hover:underline disabled:opacity-50"
          >
            {resending ? "Sending…" : "Resend code"}
          </button>
        )}
      </div>
    </AuthShell>
  );
}

export default function VerifyOtpPage() {
  return (
    <React.Suspense fallback={null}>
      <VerifyOtpForm />
    </React.Suspense>
  );
}
