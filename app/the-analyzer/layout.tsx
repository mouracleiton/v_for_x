import type { Metadata } from "next";
import { getMeta } from "@/lib/seo";

export const metadata: Metadata = getMeta("/the-analyzer/");

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
