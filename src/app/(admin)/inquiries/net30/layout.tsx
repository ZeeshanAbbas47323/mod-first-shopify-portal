import type { Metadata } from "next";

export const metadata: Metadata = { title: "Net 30 applications" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
