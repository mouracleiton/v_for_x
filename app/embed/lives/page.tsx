"use client";

import EmbedShell from "@/components/embed/EmbedShell";
import EmbedLives from "@/components/embed/EmbedLives";
import { useEmbedConfig } from "@/components/embed/useEmbedConfig";

export default function LivesEmbedPage() {
  const { params, theme, ready } = useEmbedConfig("lives");
  if (!ready) {
    return <EmbedShell theme="dark" label="LIVES COUNTER"><div /></EmbedShell>;
  }
  return (
    <EmbedShell theme={theme} label="LIVES COUNTER · THE CLOCK NEVER STOPS">
      <EmbedLives cause={params.cause} theme={theme} />
    </EmbedShell>
  );
}
