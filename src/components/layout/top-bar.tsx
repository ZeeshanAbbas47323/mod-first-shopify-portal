"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Bell, Home, Loader2, LockKeyhole, LogOut, Package, Percent,
  Search, Settings, ShoppingCart, Store, Tag, Users, X,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { lockScreenNow } from "@/components/layout/screen-lock";
import { useAuthStore } from "@/stores/auth-store";
import {
  globalAdminSearch,
  type AdminSearchResults,
  type AdminSearchItem,
  type AdminSearchType,
} from "@/lib/admin-api";

// ─── Result-type config ───────────────────────────────────────────────────────

const TYPE_CONFIG: Record<
  AdminSearchType,
  {
    label: string;
    icon: React.ElementType;
    color: string;
    href: (item: AdminSearchItem) => string;
    display: (item: AdminSearchItem) => string;
    sub: (item: AdminSearchItem) => string | undefined;
  }
> = {
  products: {
    label: "Products",
    icon: Package,
    color: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400",
    href: (item) => `/products/${item.id}`,
    display: (item) => String(item.title ?? item.name ?? `Product #${item.id}`),
    sub: (item) =>
      item.status
        ? String(item.status)
        : item.base_price != null
        ? `$${item.base_price}`
        : item.price != null
        ? `$${item.price}`
        : undefined,
  },
  orders: {
    label: "Orders",
    icon: ShoppingCart,
    color: "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400",
    href: () => `/orders`,
    display: (item) => String(item.order_number ?? `#${item.id}`),
    sub: (item) =>
      item.status
        ? String(item.status)
        : item.total != null
        ? `$${item.total}`
        : undefined,
  },
  users: {
    label: "Customers",
    icon: Users,
    color: "bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400",
    href: () => `/customers`,
    display: (item) =>
      String(item.full_name ?? item.name ?? item.email ?? `User #${item.id}`),
    sub: (item) => (item.email ? String(item.email) : undefined),
  },
  vendors: {
    label: "Vendors",
    icon: Store,
    color: "bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400",
    href: () => `/settings`,
    display: (item) =>
      String(item.name ?? item.full_name ?? `Vendor #${item.id}`),
    sub: (item) => (item.email ? String(item.email) : undefined),
  },
  coupons: {
    label: "Coupons",
    icon: Tag,
    color: "bg-pink-100 text-pink-600 dark:bg-pink-900/40 dark:text-pink-400",
    href: () => `/discounts`,
    display: (item) => String(item.code ?? item.name ?? `Coupon #${item.id}`),
    sub: (item) => (item.status ? String(item.status) : undefined),
  },
};

const ALL_TYPES = Object.keys(TYPE_CONFIG) as AdminSearchType[];

// ─── Quick nav links shown when no query ──────────────────────────────────────

const QUICK_LINKS = [
  { label: "Home", href: "/", icon: Home, color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
  { label: "Orders", href: "/orders", icon: ShoppingCart, color: "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400" },
  { label: "Products", href: "/products", icon: Package, color: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400" },
  { label: "Customers", href: "/customers", icon: Users, color: "bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400" },
  { label: "Discounts", href: "/discounts", icon: Percent, color: "bg-pink-100 text-pink-600 dark:bg-pink-900/40 dark:text-pink-400" },
  { label: "Settings", href: "/settings", icon: Settings, color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
];

// ─── Debounce ─────────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ─── TopBar ───────────────────────────────────────────────────────────────────

export function TopBar() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<AdminSearchResults>({});
  const [loading, setLoading] = React.useState(false);

  const debounced = useDebounce(query.trim(), 300);

  // ⌘K / Ctrl+K shortcut
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Clear state when dialog closes
  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setResults({});
      setLoading(false);
    }
  }, [open]);

  // Call POST /search/admin when debounced query >= 2 chars
  React.useEffect(() => {
    if (debounced.length < 2) {
      setResults({});
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    globalAdminSearch(debounced, undefined, 5)
      .then((r) => {
        if (!cancelled) { setResults(r); setLoading(false); }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [debounced]);

  const totalHits = ALL_TYPES.reduce((n, t) => n + (results[t]?.length ?? 0), 0);

  const initials = (user?.name ?? "MF")
    .split(/[\s._-]+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  function navigate(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex h-14 items-center gap-3 bg-[#1a1a1a] px-3">
      {/* Left — logo + sidebar trigger */}
      <div className="flex flex-1 items-center gap-2">
        <SidebarTrigger className="text-neutral-300 hover:bg-white/10 hover:text-white md:hidden" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/branding/logo_white.png" alt="Mod First" className="h-7 w-auto" />
      </div>

      {/* Center — search trigger button */}
      <div className="flex w-full max-w-xl justify-center">
        <button
          onClick={() => setOpen(true)}
          className="flex h-9 w-full max-w-md cursor-pointer items-center gap-2 rounded-lg border border-neutral-600 bg-[#303030] px-3 text-sm text-neutral-400 transition-colors hover:border-neutral-500 hover:bg-[#3a3a3a]"
        >
          <Search className="size-4" />
          <span className="flex-1 text-left">Search</span>
          <kbd className="hidden rounded border border-neutral-600 px-1.5 py-0.5 text-[10px] font-medium text-neutral-400 sm:inline">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right — notifications + user menu */}
      <div className="flex flex-1 items-center justify-end gap-2">
        <button
          aria-label="Notifications"
          className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-neutral-300 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Bell className="size-4" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex cursor-pointer items-center gap-2 rounded-lg p-1 transition-colors hover:bg-white/10">
            <Avatar className="size-7 rounded-md">
              <AvatarFallback className="rounded-md bg-brand text-xs font-bold text-brand-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="hidden max-w-32 truncate text-sm font-medium text-white lg:inline">
              {user?.name ?? "My Store"}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="font-medium capitalize">{user?.name}</span>
                  <span className="text-xs font-normal text-muted-foreground">{user?.email}</span>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/settings")}>
              <Settings className="size-4" /> Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => lockScreenNow()}>
              <LockKeyhole className="size-4" /> Lock screen
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => { logout(); router.replace("/login"); }}
            >
              <LogOut className="size-4" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Global Search Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="overflow-hidden p-0 shadow-2xl sm:max-w-2xl [&>button]:hidden">
          <Command shouldFilter={false} className="rounded-xl">

            {/* ── Search input ── */}
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              {loading
                ? <Loader2 className="size-5 shrink-0 animate-spin text-muted-foreground" />
                : <Search className="size-5 shrink-0 text-muted-foreground" />
              }
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
                placeholder="Search products, orders, customers, vendors…"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="flex size-5 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/80"
                >
                  <X className="size-3" />
                </button>
              )}
              <kbd className="hidden shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
                Esc
              </kbd>
            </div>

            <CommandList className="max-h-[480px] overflow-y-auto">

              {/* ── Quick links (no query) ── */}
              {debounced.length < 2 && (
                <CommandGroup heading="Quick navigation">
                  <div className="grid grid-cols-3 gap-1 p-2">
                    {QUICK_LINKS.map((link) => {
                      const Icon = link.icon;
                      return (
                        <CommandItem
                          key={link.href}
                          value={link.href}
                          onSelect={() => navigate(link.href)}
                          className="flex cursor-pointer flex-col items-center gap-2 rounded-lg p-3 text-center hover:bg-accent"
                        >
                          <span className={`flex size-9 items-center justify-center rounded-lg ${link.color}`}>
                            <Icon className="size-4" />
                          </span>
                          <span className="text-xs font-medium">{link.label}</span>
                        </CommandItem>
                      );
                    })}
                  </div>
                </CommandGroup>
              )}

              {/* ── No results ── */}
              {!loading && debounced.length >= 2 && totalHits === 0 && (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <div className="flex size-14 items-center justify-center rounded-full bg-muted">
                    <Search className="size-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">No results for &ldquo;{debounced}&rdquo;</p>
                    <p className="mt-1 text-xs text-muted-foreground">Try a different search term</p>
                  </div>
                </div>
              )}

              {/* ── Grouped results ── */}
              {ALL_TYPES.map((type) => {
                const items = results[type];
                if (!items?.length) return null;
                const cfg = TYPE_CONFIG[type];
                const Icon = cfg.icon;
                return (
                  <CommandGroup
                    key={type}
                    heading={
                      <div className="flex items-center gap-2">
                        <span className={`flex size-5 items-center justify-center rounded ${cfg.color}`}>
                          <Icon className="size-3" />
                        </span>
                        {cfg.label}
                        <span className="ml-auto text-xs text-muted-foreground">{items.length}</span>
                      </div>
                    }
                  >
                    {items.map((item) => {
                      const sub = cfg.sub(item);
                      return (
                        <CommandItem
                          key={`${type}-${item.id}`}
                          value={`${type}-${item.id}`}
                          onSelect={() => navigate(cfg.href(item))}
                          className="mx-2 mb-0.5 flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5"
                        >
                          <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${cfg.color}`}>
                            <Icon className="size-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium leading-tight">
                              {cfg.display(item)}
                            </p>
                            {sub && (
                              <p className="mt-0.5 truncate text-xs capitalize text-muted-foreground">
                                {sub}
                              </p>
                            )}
                          </div>
                          <span className="shrink-0 text-xs text-muted-foreground">↵</span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                );
              })}
            </CommandList>

            {/* ── Footer ── */}
            <div className="flex items-center justify-between border-t border-border bg-muted/30 px-4 py-2">
              <p className="text-xs text-muted-foreground">
                {debounced.length >= 2
                  ? totalHits > 0
                    ? `${totalHits} result${totalHits > 1 ? "s" : ""} found`
                    : "No results"
                  : "Search across your entire store"}
              </p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-border bg-background px-1 py-0.5 text-[10px]">↑↓</kbd>
                  navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-border bg-background px-1 py-0.5 text-[10px]">↵</kbd>
                  open
                </span>
              </div>
            </div>

          </Command>
        </DialogContent>
      </Dialog>
    </header>
  );
}
