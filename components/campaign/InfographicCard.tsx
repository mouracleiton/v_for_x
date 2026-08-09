"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import type { CountryData } from "@/lib/types";
import { generateInfographicData } from "@/lib/campaign-tools";
import { formatNumber, formatPct, formatMoney } from "@/lib/format";
import { sound } from "@/lib/sound";

/* ═══════════════════════════════════════════════════════════════
 *  DESIGN TOKENS (match globals.css @theme vars)
 * ═══════════════════════════════════════════════════════════════ */

const C = {
  void: "#060b14",
  abyss: "#0a1220",
  panel: "#0f1a2e",
  borderDim: "#1a2a44",
  borderBright: "#2a4264",
  blood: "#c42b3e",
  bloodBright: "#e23856",
  green: "#22d3a6",
  amber: "#f0a03b",
  command: "#5b9cf6",
  contentPrimary: "#dfe7f5",
  contentSecondary: "#8da3c4",
  contentDim: "#4a5d7a",
};

type CardSize = "square" | "wide";
type TemplateStyle = "crisis" | "comparison" | "call-to-action";

interface InfographicCardProps {
  country: CountryData;
  /** Override which template to render. Defaults to "crisis". */
  template?: TemplateStyle;
  /** Card dimensions. "square" = 1080×1080 (Instagram). "wide" = 1200×628 (Twitter/OG). */
  size?: CardSize;
}

const DIMS: Record<CardSize, { w: number; h: number; label: string }> = {
  square: { w: 1080, h: 1080, label: "1080×1080 · Instagram" },
  wide: { w: 1200, h: 628, label: "1200×628 · Twitter / OG" },
};

/* ═══════════════════════════════════════════════════════════════
 *  CANVAS DRAWING
 * ═══════════════════════════════════════════════════════════════ */

function drawCard(
  ctx: CanvasRenderingContext2D,
  country: CountryData,
  template: TemplateStyle,
  size: CardSize,
): void {
  const { w, h } = DIMS[size];
  const info = generateInfographicData(country);

  // ── Background ──
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, C.abyss);
  grad.addColorStop(1, C.void);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // ── Top accent bar ──
  const accent = template === "comparison" ? C.command : template === "call-to-action" ? C.green : info.color;
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, w, 6);

  // ── Scanline texture (subtle) ──
  ctx.fillStyle = "rgba(15,26,46,0.04)";
  for (let y = 6; y < h; y += 4) {
    ctx.fillRect(0, y, w, 1);
  }

  // ── Border frame ──
  ctx.strokeStyle = C.borderDim;
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, w - 48, h - 48);

  // ── Corner ticks (tactical UI feel) ──
  ctx.strokeStyle = C.borderBright;
  ctx.lineWidth = 3;
  const tick = 30;
  // top-left
  ctx.beginPath(); ctx.moveTo(24, 24 + tick); ctx.lineTo(24, 24); ctx.lineTo(24 + tick, 24); ctx.stroke();
  // top-right
  ctx.beginPath(); ctx.moveTo(w - 24 - tick, 24); ctx.lineTo(w - 24, 24); ctx.lineTo(w - 24, 24 + tick); ctx.stroke();
  // bottom-left
  ctx.beginPath(); ctx.moveTo(24, h - 24 - tick); ctx.lineTo(24, h - 24); ctx.lineTo(24 + tick, h - 24); ctx.stroke();
  // bottom-right
  ctx.beginPath(); ctx.moveTo(w - 24 - tick, h - 24); ctx.lineTo(w - 24, h - 24); ctx.lineTo(w - 24, h - 24 - tick); ctx.stroke();

  if (size === "square") {
    drawSquareLayout(ctx, country, template, info, w, h, accent);
  } else {
    drawWideLayout(ctx, country, template, info, w, h, accent);
  }
}

function drawSquareLayout(
  ctx: CanvasRenderingContext2D,
  country: CountryData,
  template: TemplateStyle,
  info: ReturnType<typeof generateInfographicData>,
  w: number,
  h: number,
  accent: string,
): void {
  const cx = w / 2;

  // ── Country name (top) ──
  ctx.textAlign = "center";
  ctx.fillStyle = C.contentDim;
  ctx.font = "600 28px 'JetBrains Mono', monospace";
  ctx.fillText("// " + country.region.toUpperCase(), cx, 80);

  ctx.fillStyle = C.contentPrimary;
  ctx.font = "700 48px 'JetBrains Mono', monospace";
  ctx.fillText(country.name_en.toUpperCase(), cx, 135);

  // Divider
  ctx.strokeStyle = C.borderDim;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(120, 160); ctx.lineTo(w - 120, 160); ctx.stroke();

  // ── Emoji + template label ──
  ctx.font = "72px serif";
  ctx.fillText(info.emoji, cx, 260);

  ctx.fillStyle = accent;
  ctx.font = "600 24px 'JetBrains Mono', monospace";
  const tplLabel = template === "crisis" ? "⚠ CRISIS ALERT"
    : template === "comparison" ? "⚖ THE GAP"
    : "📢 TAKE ACTION";
  ctx.fillText(tplLabel, cx, 310);

  // ── Headline ──
  ctx.fillStyle = C.contentSecondary;
  ctx.font = "400 30px 'JetBrains Mono', monospace";
  wrapText(ctx, info.headline, cx, 370, w - 160, 40);

  // ── BIG NUMBER ──
  ctx.fillStyle = accent;
  ctx.font = "900 160px 'JetBrains Mono', monospace";
  ctx.shadowColor = accent;
  ctx.shadowBlur = 30;
  ctx.fillText(info.bigNumber, cx, 560);
  ctx.shadowBlur = 0;

  // ── Big label ──
  ctx.fillStyle = C.contentDim;
  ctx.font = "600 26px 'JetBrains Mono', monospace";
  ctx.fillText(info.bigLabel, cx, 610);

  // ── Comparison / context ──
  ctx.fillStyle = C.contentSecondary;
  ctx.font = "400 28px 'JetBrains Mono', monospace";
  wrapText(ctx, info.comparison, cx, 700, w - 180, 38);

  // ── Call to action (for call-to-action template) ──
  if (template === "call-to-action") {
    ctx.fillStyle = C.green;
    ctx.font = "700 34px 'JetBrains Mono', monospace";
    ctx.fillText("SHARE THIS. DEMAND ACTION.", cx, 870);
  }

  // ── Source ──
  ctx.fillStyle = C.contentDim;
  ctx.font = "400 22px 'JetBrains Mono', monospace";
  ctx.fillText("Source: " + info.source, cx, h - 95);

  // ── Branding footer ──
  ctx.fillStyle = C.blood;
  ctx.font = "700 36px 'JetBrains Mono', monospace";
  ctx.fillText("V FOR X", cx, h - 55);

  ctx.fillStyle = C.contentDim;
  ctx.font = "400 18px 'JetBrains Mono', monospace";
  ctx.fillText("mouracleiton.github.io/v_for_x", cx, h - 35);
}

function drawWideLayout(
  ctx: CanvasRenderingContext2D,
  country: CountryData,
  template: TemplateStyle,
  info: ReturnType<typeof generateInfographicData>,
  w: number,
  h: number,
  accent: string,
): void {
  // Two-column layout: left = big number, right = text
  const leftW = w * 0.42;

  // ── Left panel background ──
  ctx.fillStyle = "rgba(15,26,46,0.5)";
  ctx.fillRect(24, 24, leftW, h - 48);

  // Vertical divider
  ctx.strokeStyle = C.borderDim;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(leftW + 24, 40); ctx.lineTo(leftW + 24, h - 40); ctx.stroke();

  // ── Left: big number ──
  ctx.textAlign = "center";
  ctx.font = "80px serif";
  ctx.fillStyle = C.contentPrimary;
  ctx.fillText(info.emoji, leftW / 2 + 12, 100);

  ctx.fillStyle = accent;
  ctx.font = "900 110px 'JetBrains Mono', monospace";
  ctx.shadowColor = accent;
  ctx.shadowBlur = 25;
  ctx.fillText(info.bigNumber, leftW / 2 + 12, h / 2 + 40);
  ctx.shadowBlur = 0;

  ctx.fillStyle = C.contentDim;
  ctx.font = "600 18px 'JetBrains Mono', monospace";
  ctx.fillText(info.bigLabel, leftW / 2 + 12, h / 2 + 80);

  // ── Right: text content ──
  ctx.textAlign = "left";
  const rx = leftW + 50;
  const rw = w - rx - 50;

  // Country name
  ctx.fillStyle = C.contentDim;
  ctx.font = "600 16px 'JetBrains Mono', monospace";
  ctx.fillText("// " + country.region.toUpperCase(), rx, 60);

  ctx.fillStyle = C.contentPrimary;
  ctx.font = "700 34px 'JetBrains Mono', monospace";
  ctx.fillText(country.name_en.toUpperCase(), rx, 95);

  // Headline
  ctx.fillStyle = accent;
  ctx.font = "600 20px 'JetBrains Mono', monospace";
  wrapText(ctx, info.headline, rx, 140, rw, 28, "left");

  // Comparison
  ctx.fillStyle = C.contentSecondary;
  ctx.font = "400 18px 'JetBrains Mono', monospace";
  wrapText(ctx, info.comparison, rx, 260, rw, 26, "left");

  // Source
  ctx.fillStyle = C.contentDim;
  ctx.font = "400 14px 'JetBrains Mono', monospace";
  ctx.fillText("Source: " + info.source, rx, h - 80);

  // Branding
  ctx.fillStyle = C.blood;
  ctx.font = "700 24px 'JetBrains Mono', monospace";
  ctx.fillText("V FOR X", rx, h - 50);

  ctx.fillStyle = C.contentDim;
  ctx.font = "400 12px 'JetBrains Mono', monospace";
  ctx.fillText("mouracleiton.github.io/v_for_x", rx + 110, h - 50);
}

/** Word-wrap helper for canvas text. */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  align: "center" | "left" = "center",
): void {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const test = current ? current + " " + word : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);

  // Truncate to max 5 lines
  const maxLines = 5;
  const display = lines.slice(0, maxLines);
  if (lines.length > maxLines && display.length > 0) {
    display[maxLines - 1] = display[maxLines - 1].replace(/[,;:]?\s*$/, "…");
  }

  const prevAlign = ctx.textAlign;
  ctx.textAlign = align;
  for (let i = 0; i < display.length; i++) {
    ctx.fillText(display[i], x, y + i * lineHeight);
  }
  ctx.textAlign = prevAlign;
}

/* ═══════════════════════════════════════════════════════════════
 *  COMPONENT
 * ═══════════════════════════════════════════════════════════════ */

export default function InfographicCard({
  country,
  template = "crisis",
  size = "square",
}: InfographicCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const [renderedUrl, setRenderedUrl] = useState<string | null>(null);

  const { w, h } = DIMS[size];

  // Draw on mount and whenever inputs change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = w;
    canvas.height = h;
    drawCard(ctx, country, template, size);
    setRenderedUrl(canvas.toDataURL("image/png"));
  }, [country, template, size, w, h]);

  const handleDownload = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `vforx-${country.iso3}-${template}-${size}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    sound.success();
  }, [country, template, size]);

  const handleCopy = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      // Modern Clipboard API with image support
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ "image/png": blob }),
          ]);
          setCopied(true);
          sound.copy();
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Fallback: copy data URL as text
          sound.error();
        }
      }, "image/png");
    } catch {
      sound.error();
    }
  }, []);

  const info = generateInfographicData(country);

  return (
    <div className="terminal-card p-4">
      {/* Header */}
      <div className="text-xs uppercase tracking-widest mb-3 pb-2 border-b" style={{ color: "var(--color-blood)", borderColor: "var(--color-border-dim)" }}>
        {"> "}INFOGRAPHIC GENERATOR
      </div>

      {/* Template + size selectors */}
      <div className="flex flex-wrap gap-2 mb-3">
        {(["crisis", "comparison", "call-to-action"] as TemplateStyle[]).map((t) => (
          <button
            key={t}
            onClick={() => { sound.nav(); }}
            className={`text-[10px] px-2 py-1 border transition-colors ${
              template === t
                ? "border-blood text-blood-bright bg-blood/5"
                : "border-border-dim text-content-secondary hover:border-blood"
            }`}
          >
            {t === "crisis" ? "⚠ CRISIS" : t === "comparison" ? "⚖ COMPARE" : "📢 ACTION"}
          </button>
        ))}
        <span className="flex-1" />
        <span className="text-[10px] text-content-dim self-center">
          {DIMS[size].label}
        </span>
      </div>

      {/* Canvas preview (scaled via CSS) */}
      <div className="flex justify-center mb-4 bg-void border border-border-dim p-2">
        <canvas
          ref={canvasRef}
          width={w}
          height={h}
          style={{
            width: size === "square" ? "min(100%, 400px)" : "100%",
            height: "auto",
            imageRendering: "auto",
          }}
          aria-label={`Infographic card for ${country.name_en}`}
        />
      </div>

      {/* Data summary */}
      <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
        <div className="border border-border-dim p-2">
          <div className="text-content-dim text-[10px]">{info.emoji} BIG NUMBER</div>
          <div className="text-blood-bright font-bold text-lg">{info.bigNumber}</div>
          <div className="text-content-secondary text-[10px]">{info.bigLabel}</div>
        </div>
        <div className="border border-border-dim p-2">
          <div className="text-content-dim text-[10px]">SOURCE</div>
          <div className="text-content-secondary text-[10px] leading-tight mt-1">{info.source}</div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleDownload}
          className="flex-1 text-xs px-3 py-2 border border-command text-command hover:bg-command/10 transition-colors"
        >
          ⬇ DOWNLOAD PNG
        </button>
        <button
          onClick={handleCopy}
          className={`flex-1 text-xs px-3 py-2 border transition-colors ${
            copied
              ? "border-terminal-green text-terminal-green"
              : "border-border-dim text-content-secondary hover:border-terminal-green hover:text-terminal-green"
          }`}
        >
          {copied ? "✓ COPIED TO CLIPBOARD" : "📋 COPY IMAGE"}
        </button>
      </div>

      {/* Hidden rendered URL for external use */}
      {renderedUrl && <input type="hidden" value={renderedUrl} readOnly />}
    </div>
  );
}

/** Export the dimensions map for external consumers. */
export { DIMS as CARD_DIMENSIONS };
