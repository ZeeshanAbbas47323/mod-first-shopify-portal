import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

/**
 * `title.template` appends " · ModFirst" to every page that sets a plain title,
 * so a tab reads "Orders · ModFirst" instead of one shared name across the
 * whole admin.
 *
 * Unlike the storefront these are not read from Website Settings: that endpoint
 * needs the storefront API key, which the dashboard does not carry.
 */
export const metadata: Metadata = {
  title: {
    default: "ModFirst Admin",
    template: "%s · ModFirst",
  },
  description: "ModFirst commerce admin — orders, catalogue, customers and POS.",
  applicationName: "ModFirst Admin",
  // An admin portal should never surface in search results.
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster position="bottom-center" richColors />
      </body>
    </html>
  );
}
