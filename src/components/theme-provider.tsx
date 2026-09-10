"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Drives the `.dark` class on <html>, which is what every `dark:` variant and
 * the `.dark` token block in globals.css key off.
 *
 * `attribute="class"` rather than the default data attribute, because the
 * Tailwind dark variant is declared as `&:is(.dark *)`.
 */
export function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
