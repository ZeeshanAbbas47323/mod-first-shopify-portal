"use client";

import * as React from "react";
import { ExternalLink, Monitor, RefreshCw, Smartphone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Device = "desktop" | "mobile";

const DEVICES: {
  value: Device;
  label: string;
  icon: typeof Monitor;
  width: string;
  height: string;
}[] = [
  { value: "desktop", label: "Desktop", icon: Monitor, width: "100%", height: "40rem" },
  { value: "mobile", label: "Mobile", icon: Smartphone, width: "23.4375rem", height: "44rem" },
];

export function storefrontUrl(): string {
  return (process.env.NEXT_PUBLIC_STOREFRONT_URL ?? "").trim().replace(/\/$/, "");
}

/**
 * The real storefront home page in a frame, rather than a mock-up of it.
 *
 * Rebuilding the sections here would mean maintaining a second copy of every
 * storefront component, and it would still only ever approximate the site. The
 * live page is the site.
 *
 * The trade-off is that it renders *saved* content: an edit shows up after it
 * is saved, not while it is being typed.
 */
export function ThemePreview({ reloadKey }: { reloadKey?: number }) {
  const base = storefrontUrl();
  const [device, setDevice] = React.useState<Device>("desktop");
  const [nonce, setNonce] = React.useState(0);
  const [loading, setLoading] = React.useState(true);

  // Re-mount the frame after a save so the preview shows the new content.
  React.useEffect(() => {
    if (reloadKey === undefined) return;
    setNonce((n) => n + 1);
    setLoading(true);
  }, [reloadKey]);

  if (!base) return null;

  const active = DEVICES.find((d) => d.value === device)!;

  // Cache-busted so a refresh actually refetches rather than reusing the frame.
  const src = `${base}/?preview=${nonce}`;

  const refresh = () => {
    setNonce((n) => n + 1);
    setLoading(true);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Live preview</h3>
          <p className="text-xs text-muted-foreground">
            The storefront home page as customers see it. Shows saved changes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg bg-muted p-0.5">
            {DEVICES.map(({ value, label, icon: Icon }) => (
              <Button
                key={value}
                size="sm"
                variant={device === value ? "outline" : "ghost"}
                onClick={() => setDevice(value)}
                className={cn(
                  "h-7 gap-1.5 px-2 text-xs",
                  device === value && "bg-card shadow-sm"
                )}
                aria-pressed={device === value}
              >
                <Icon className="size-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </Button>
            ))}
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={refresh}
            aria-label="Reload preview"
            title="Reload preview"
          >
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          </Button>

          <Button variant="outline" size="sm" render={<a href={base} target="_blank" rel="noopener noreferrer" />}>
            <ExternalLink className="size-3.5" />
            <span className="hidden sm:inline">Open site</span>
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-muted/40 p-3">
        <div
          className="relative mx-auto overflow-hidden rounded-md bg-card ring-1 ring-black/8 transition-[max-width] duration-200"
          style={{ maxWidth: active.width }}
        >
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-card">
              <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
                <RefreshCw className="size-4 animate-spin" />
                Loading the storefront…
              </div>
            </div>
          )}

          <iframe
            key={nonce}
            src={src}
            title="Storefront preview"
            onLoad={() => setLoading(false)}
            className="w-full border-0 bg-card"
            style={{ height: active.height }}
            // The storefront is first-party, but the frame gets no more
            // privilege than it needs.
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            loading="lazy"
          />
        </div>

        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Not loading?{" "}
          <a
            href={base}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            Open the storefront in a new tab
          </a>
          .
        </p>
      </div>
    </div>
  );
}
