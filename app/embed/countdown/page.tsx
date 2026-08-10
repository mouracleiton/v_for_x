"use client";

import EmbedShell from "@/components/embed/EmbedShell";
import EmbedCountdown from "@/components/embed/EmbedCountdown";
import { useEmbedConfig } from "@/components/embed/useEmbedConfig";

export default function CountdownEmbedPage() {
  const { params, theme, ready } = useEmbedConfig("countdown");
  if (!ready) {
    return <EmbedShell theme="dark" label="SDG COUNTDOWN"><div /></EmbedShell>;
  }
  return (
    <EmbedShell theme={theme} label="SDG COUNTDOWN · 2030 DEADLINE">
      <EmbedCountdown sdg={params.sdg} theme={theme} />
    </EmbedShell>
  );
}
