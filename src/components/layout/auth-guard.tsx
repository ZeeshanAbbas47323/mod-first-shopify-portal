"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuthStore, getStoredRefreshToken } from "@/stores/auth-store";
import { silentRefresh } from "@/lib/api";

type State = "loading" | "authenticated" | "unauthenticated";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const [state, setState] = React.useState<State>("loading");

  React.useEffect(() => {
    async function init() {
      // Zustand persist has not yet hydrated from localStorage — wait one tick
      await Promise.resolve();

      const authenticated = useAuthStore.getState().isAuthenticated;

      if (!authenticated) {
        setState("unauthenticated");
        router.replace("/login");
        return;
      }

      // isAuthenticated = true but no in-memory token means the page was
      // refreshed. Exchange the stored refresh token for a new access token.
      const inMemoryToken = useAuthStore.getState().token;
      if (!inMemoryToken) {
        const hasRefreshToken = !!getStoredRefreshToken();
        if (!hasRefreshToken) {
          logout();
          setState("unauthenticated");
          router.replace("/login");
          return;
        }

        const newToken = await silentRefresh();
        if (!newToken) {
          logout();
          setState("unauthenticated");
          router.replace("/login");
          return;
        }
      }

      setState("authenticated");
    }

    init();
    // Run once on mount — we only need to bootstrap the session, not react to
    // token changes (the axios interceptor handles mid-session refreshes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (state === "unauthenticated") return null;

  return <>{children}</>;
}
