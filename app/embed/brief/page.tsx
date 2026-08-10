"use client";

import EmbedShell from "@/components/embed/EmbedShell";
import EmbedBrief from "@/components/embed/EmbedBrief";
import { useEmbedConfig } from "@/components/embed/useEmbedConfig";

export default function BriefEmbedPage() {
  const { params, theme, ready } = useEmbedConfig("brief");
  if (!ready) {
    return <EmbedShell theme="dark" label="COUNTRY BRIEF"><div /></EmbedShell>;
  }
  return (
    <EmbedShell theme={theme} label={`COUNTRY BRIEF · ${params.country ?? ""}`}>
      <EmbedBrief country={params.country} theme={theme} />
    </EmbedShell>
  );
}
