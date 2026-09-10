"use client";

import * as React from "react";

import { cn, imgUrl } from "@/lib/utils";

/**
 * A small image tile that degrades to a placeholder instead of the browser's
 * broken-image icon. Uploads can go missing or resolve against the wrong base,
 * and a broken glyph in a settings list reads as a bug in the page rather than
 * a missing file.
 */
export function Thumb({
  src,
  fallback,
  background,
  className,
  alt = "",
}: {
  src?: string | null;
  /** Shown when there is no image, or when it fails to load. */
  fallback: React.ReactNode;
  /** Tints the placeholder, e.g. a section's own background colour. */
  background?: string | null;
  className?: string;
  alt?: string;
}) {
  const [failed, setFailed] = React.useState(false);

  // A new src deserves a fresh attempt.
  React.useEffect(() => setFailed(false), [src]);

  if (!src || failed) {
    return (
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground",
          className
        )}
        style={background ? { background } : undefined}
      >
        {fallback}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imgUrl(src)}
      alt={alt}
      onError={() => setFailed(true)}
      className={cn(
        "shrink-0 rounded-lg border border-border object-cover",
        className
      )}
    />
  );
}
