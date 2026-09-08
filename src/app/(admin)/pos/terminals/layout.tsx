import type { Metadata } from "next";

export const metadata: Metadata = { title: "POS terminals" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
