"use client";

import { useState } from "react";
import { sound } from "@/lib/sound";
import { tc } from "@/lib/i18n-content";
import { useStore } from "@/stores/useStore";
import type { Lang } from "@/lib/i18n";

/**
 * Generates an embeddable iframe snippet for any page/stat.
 * For static export sites, this generates a self-contained HTML snippet
 * that can be pasted into any blog or presentation.
 */
export function generateEmbedSnippet(opts: {
  text: string;
  source?: string;
  url?: string;
}): string {
  const { text, source, url } = opts;
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return `<blockquote style="background:var(--color-abyss);border-left:3px solid var(--color-blood);padding:16px;margin:16px 0;font-family:monospace;color:var(--color-content-primary);font-size:14px;border-radius:0;">
  <p style="margin:0 0 8px 0;">${escaped}</p>
  ${source ? `<cite style="color:#666;font-size:11px;">Source: ${source}</cite><br>` : ""}
  <a href="${url || "https://mouracleiton.github.io/v_for_x/"}" style="color:var(--color-blood);font-size:11px;text-decoration:none;">▶ V FOR X — v-for-x</a>
</blockquote>`;
}

/**
 * Generate a tweet-intent URL for a stat.
 */
export function tweetIntent(text: string, url?: string): string {
  const u = url || "https://mouracleiton.github.io/v_for_x/";
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(u)}`;
}

/** A button that opens embed options for a shareable stat */
export function EmbedButton({ text, source, lang }: { text: string; source?: string; lang?: Lang }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { lang: storeLang } = useStore();
  const effectiveLang = lang ?? storeLang;

  const snippet = generateEmbedSnippet({ text, source });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      sound.copy();
      setTimeout(() => setCopied(false), 2000);
    } catch {
      sound.error();
    }
  };

  return (
    <>
      <button
        onClick={() => { setOpen(!open); sound.select(); }}
        className="text-[10px] px-2 py-0.5 border border-border-dim text-content-dim hover:border-blood hover:text-blood-bright transition-colors"
      >
        {open ? "[ - ]" : `[ ${tc(effectiveLang, "ui.embed")} ]`}
      </button>
      {open && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-abyss border border-blood max-w-lg w-full p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-blood-bright uppercase">{tc(effectiveLang, "ui.embed")}</span>
              <button onClick={() => setOpen(false)} className="text-content-dim hover:text-blood-bright">{tc(effectiveLang, "ui.close")} ✕</button>
            </div>
            <pre className="text-[10px] text-content-secondary bg-void border border-border-dim p-2 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
              {snippet}
            </pre>
            <div className="flex gap-2 mt-3">
              <button
                onClick={copy}
                className={`flex-1 py-2 text-xs border transition-colors ${
                  copied
                    ? "border-terminal-green text-terminal-green"
                    : "border-blood text-blood-bright hover:bg-blood hover:text-void"
                }`}
              >
                {copied ? `✓ ${tc(effectiveLang, "ui.copied")}` : `${tc(effectiveLang, "ui.copy")} HTML`}
              </button>
              <a
                href={tweetIntent(text)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2 text-xs border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright text-center transition-colors"
              >
                ↗ {tc(effectiveLang, "ui.tweet")}
              </a>
            </div>
            <div className="text-[10px] text-content-dim mt-2 italic">
              ▸ Paste the HTML into any blog, CMS, or presentation.
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Print-to-PDF handler. Opens the browser print dialog optimized
 * for a clean one-page brief. The page's print CSS handles layout.
 */
export function printBrief() {
  if (typeof window !== "undefined") {
    window.print();
    sound.select();
  }
}
