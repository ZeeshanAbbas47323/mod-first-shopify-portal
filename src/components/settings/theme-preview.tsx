"use client";

import * as React from "react";
import { Monitor, Smartphone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn, imgUrl } from "@/lib/utils";
import type { HomeSectionItemRow, HomeSectionRow } from "@/lib/admin-api";

type Device = "desktop" | "mobile";

const DEVICES: { value: Device; label: string; icon: typeof Monitor; width: string }[] = [
  { value: "desktop", label: "Desktop", icon: Monitor, width: "100%" },
  { value: "mobile", label: "Mobile", icon: Smartphone, width: "23.4375rem" },
];

/** Only what the storefront would actually render, in render order. */
function visibleSections(sections: HomeSectionRow[]) {
  return sections
    .filter((s) => s.is_active !== false)
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

function visibleItems(section: HomeSectionRow) {
  return (section.items ?? [])
    .filter((i) => i.is_active !== false)
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

function ItemCard({
  item,
  device,
  wide,
}: {
  item: HomeSectionItemRow;
  device: Device;
  wide?: boolean;
}) {
  const src = device === "mobile" && item.mobile_image_url
    ? item.mobile_image_url
    : item.image_url;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border border-border bg-card",
        wide && "col-span-full"
      )}
    >
      <div className="relative aspect-[16/9] w-full bg-muted">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgUrl(src)}
            alt=""
            className="size-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-[10px] text-muted-foreground">
            No image
          </div>
        )}
        {item.badge && (
          <span className="absolute left-1.5 top-1.5 rounded-full bg-attention-subtle px-1.5 py-0.5 text-[9px] font-medium text-attention-subtle-foreground">
            {item.badge}
          </span>
        )}
      </div>
      <div className="space-y-0.5 p-2">
        <p className="truncate text-xs font-medium">{item.title}</p>
        {item.subtitle && (
          <p className="truncate text-[10px] text-muted-foreground">
            {item.subtitle}
          </p>
        )}
        {item.button_text && (
          <span className="mt-1 inline-block rounded bg-primary px-2 py-0.5 text-[9px] font-medium text-primary-foreground">
            {item.button_text}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * An approximation of the storefront home page, built from the same records the
 * editor above is changing. It is deliberately a sketch, not an iframe of the
 * live site: it answers "what order are these in, and what will show" without
 * needing the storefront to be running or the changes to be published.
 */
export function ThemePreview({ sections }: { sections: HomeSectionRow[] }) {
  const [device, setDevice] = React.useState<Device>("desktop");

  const shown = visibleSections(sections);
  const hiddenCount = sections.length - shown.length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Live preview</h3>
          <p className="text-xs text-muted-foreground">
            {shown.length} section{shown.length === 1 ? "" : "s"} shown
            {hiddenCount > 0 && `, ${hiddenCount} hidden`}
          </p>
        </div>
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
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-muted/40 p-3">
        <div
          className="mx-auto space-y-3 transition-[max-width] duration-200"
          style={{ maxWidth: DEVICES.find((d) => d.value === device)!.width }}
        >
          {/* A hint of storefront chrome, so the stack reads as a page. */}
          <div className="flex items-center gap-1.5 rounded-md bg-card px-2 py-1.5 ring-1 ring-black/8">
            <span className="size-1.5 rounded-full bg-destructive/60" />
            <span className="size-1.5 rounded-full bg-warning/60" />
            <span className="size-1.5 rounded-full bg-success/60" />
            <span className="ml-1 truncate text-[10px] text-muted-foreground">
              Home
            </span>
          </div>

          {!shown.length ? (
            <div className="rounded-md border border-dashed border-border bg-card px-4 py-12 text-center">
              <p className="text-xs font-medium">Nothing to show</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Every section is hidden, so the home page would be empty.
              </p>
            </div>
          ) : (
            shown.map((section) => {
              const items = visibleItems(section);
              const layout = (section.layout_type ?? "").toLowerCase();
              const isHero = layout.includes("hero");
              const isCarousel =
                layout.includes("carousel") || layout.includes("slider");

              return (
                <section
                  key={String(section.id)}
                  className="rounded-md bg-card p-3 ring-1 ring-black/8"
                  style={
                    section.background_color
                      ? { background: section.background_color }
                      : undefined
                  }
                >
                  {(section.title || section.subtitle) && (
                    <header className="mb-2 text-center">
                      {section.title && (
                        <p className="text-sm font-semibold">{section.title}</p>
                      )}
                      {section.subtitle && (
                        <p className="text-[11px] text-muted-foreground">
                          {section.subtitle}
                        </p>
                      )}
                    </header>
                  )}

                  {!items.length ? (
                    <div className="rounded border border-dashed border-border px-3 py-6 text-center text-[11px] text-muted-foreground">
                      {section.section_key} — no visible items
                    </div>
                  ) : isCarousel ? (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {items.map((item) => (
                        <div
                          key={String(item.id)}
                          className={cn(
                            "shrink-0",
                            device === "mobile" ? "w-32" : "w-40"
                          )}
                        >
                          <ItemCard item={item} device={device} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "grid gap-2",
                        isHero
                          ? "grid-cols-1"
                          : device === "mobile"
                            ? "grid-cols-2"
                            : "grid-cols-3"
                      )}
                    >
                      {items.map((item) => (
                        <ItemCard
                          key={String(item.id)}
                          item={item}
                          device={device}
                          wide={isHero}
                        />
                      ))}
                    </div>
                  )}
                </section>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
