"use client";

import { useState } from "react";
import { sound } from "@/lib/sound";
import { EmbedButton, tweetIntent } from "@/components/shared/EmbedButton";
import { tc } from "@/lib/i18n-content";
import { useStore } from "@/stores/useStore";
import { GLITCH_CARD, cardFileName, renderGlitchCard } from "@/lib/stat-card";
import { embedInImage } from "@/lib/cipher";
import type { Lang } from "@/lib/i18n";

interface ShareableStatProps {
  text: string;
  lang?: Lang;
}

export default function ShareableStat({ text, lang }: ShareableStatProps) {
  const [copied, setCopied] = useState(false);
  const [cardState, setCardState] = useState<"idle" | "rendering" | "saved">(
    "idle",
  );
  const [cardName, setCardName] = useState("");
  const { lang: storeLang } = useStore();
  const effectiveLang = lang ?? storeLang;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      sound.copy();
      setTimeout(() => setCopied(false), 2000);
    } catch {
      sound.error();
    }
  };

  const makeCard = async () => {
    if (typeof document === "undefined") return;
    const canvas = document.createElement("canvas");
    canvas.width = GLITCH_CARD.width;
    canvas.height = GLITCH_CARD.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return; // jsdom / no-canvas environments: no-op
    setCardState("rendering");
    sound.select();

    try {
      renderGlitchCard(ctx, text);
      // Embed a hidden, machine-verifiable payload into the card's pixels:
      // any card downloaded here can be authenticated via LSB extraction
      // (The Cipher → STEGANOGRAPHY → load card → EXTRACT).
      try {
        const stegoPayload = `VFORX/STAT:${text}`;
        ctx.putImageData(embedInImage(ctx.getImageData(0, 0, canvas.width, canvas.height), stegoPayload), 0, 0);
      } catch { /* payload too large — export plain card */ }
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!blob) {
        sound.error();
        setCardState("idle");
        return;
      }

      const fileName = cardFileName(text);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);

      const files = [new File([blob], fileName, { type: "image/png" })];
      if (
        typeof navigator !== "undefined" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files })
      ) {
        try {
          await navigator.share({ files });
        } catch {
          // user dismissed the share sheet — download already fired
        }
      }

      setCardName(fileName);
      setCardState("saved");
      sound.success();
      setTimeout(() => setCardState("idle"), 3000);
    } catch {
      sound.error();
      setCardState("idle");
    }
  };

  return (
    <div className="p-3 terminal-card hover:border-blood transition-colors group">
      <div className="flex items-start gap-2">
        <span className="text-blood mt-0.5">▸</span>
        <p className="text-xs text-content-primary flex-1">{text}</p>
        <div className="flex flex-col gap-1 shrink-0">
          <button
            onClick={copy}
            className={`text-xs px-2 py-0.5 border transition-colors ${
              copied
                ? "border-terminal-green text-terminal-green"
                : "text-content-dim group-hover:text-blood border-border-dim group-hover:border-blood"
            }`}
          >
            {copied ? `[ ${tc(effectiveLang, "ui.copied")} ]` : `[ ${tc(effectiveLang, "ui.copy")} ]`}
          </button>
          <a
            href={tweetIntent(text)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] px-2 py-0.5 border border-border-dim text-content-dim hover:border-blood hover:text-blood-bright text-center transition-colors no-print"
          >
            {tc(effectiveLang, "ui.tweet")}
          </a>
          <button
            onClick={makeCard}
            disabled={cardState === "rendering"}
            title="Download a glitch card with a hidden verifiable payload (extract it at THE CIPHER)"
            className={`text-[10px] px-2 py-0.5 border transition-colors text-center no-print ${
              cardState === "saved"
                ? "border-terminal-green text-terminal-green"
                : "text-content-dim group-hover:text-blood border-border-dim group-hover:border-blood"
            } ${cardState === "rendering" ? "cursor-wait opacity-60" : ""}`}
          >
            {cardState === "rendering"
              ? "[ RENDERING… ]"
              : cardState === "saved"
                ? `[ SAVED ${cardName} ]`
                : "[ CARD ]"}
          </button>
          <div className="no-print">
            <EmbedButton text={text} lang={effectiveLang} />
          </div>
        </div>
      </div>
    </div>
  );
}
