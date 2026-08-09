import type { Metadata } from "next";
import { getMeta } from "@/lib/seo";

export const metadata: Metadata = getMeta("/the-compare/");

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
