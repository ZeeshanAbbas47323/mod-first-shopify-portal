"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuthStore, getStoredRefreshToken } from "@/stores/auth-store";
import { silentRefresh } from "@/lib/api";
import { useMenuStore } from "@/stores/menu-store";

type State = "loading" | "authenticated" | "unauthenticated";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const resetMenus = useMenuStore((s) => s.reset);
  const [state, setState] = React.useState<State>("loading");

  const signOut = React.useCallback(() => {
    resetMenus();
    logout();
  }, [logout, resetMenus]);

  React.useEffect(() => {
    async function init() {
      await Promise.resolve();

      const authenticated = useAuthStore.getState().isAuthenticated;

      if (!authenticated) {
        resetMenus();
        setState("unauthenticated");
        router.replace("/login");
        return;
      }

      const inMemoryToken = useAuthStore.getState().token;
      if (!inMemoryToken) {
        const hasRefreshToken = !!getStoredRefreshToken();
        if (!hasRefreshToken) {
          signOut();
          setState("unauthenticated");
          router.replace("/login");
          return;
        }

        const newToken = await silentRefresh();
        if (!newToken) {
          signOut();
          setState("unauthenticated");
          router.replace("/login");
          return;
        }
      }

      setState("authenticated");
    }

    init();
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
