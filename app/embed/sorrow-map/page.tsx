"use client";

import EmbedShell from "@/components/embed/EmbedShell";
import EmbedSorrowMap from "@/components/embed/EmbedSorrowMap";
import { useEmbedConfig } from "@/components/embed/useEmbedConfig";

export default function SorrowMapEmbedPage() {
  const { params, theme, ready } = useEmbedConfig("sorrow-map");
  if (!ready) {
    return <EmbedShell theme="dark" label="SORROW MAP"><div /></EmbedShell>;
  }
  return (
    <EmbedShell theme={theme} label={`SORROW MAP · ${params.metric ?? ""}`}>
      <EmbedSorrowMap metric={params.metric} theme={theme} />
    </EmbedShell>
  );
}
