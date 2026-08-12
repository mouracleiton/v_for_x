/**
 * V FOR X — "Explain this number"
 *
 * Phase 21 north-star: every chart/stat opens source meta (publisher/year/
 * license/confidence) from metric-meta. This module is the bridge between
 * a single rendered number on a page and its full source provenance —
 * a structured payload the UI can render as a popover, side panel, or
 * audit row.
 *
 * Pure function of (value, metricPath) → ExplainCard. No network, no
 * side effects, no storage. Tested independently of React.
 */

import {
  resolveMetricMeta,
  renderFootnote,
  shortCitation,
  confidenceColor,
  UNDOCUMENTED_META,
  type MetricMeta,
  type Confidence,
} from "./metric-meta";

export interface ExplainCard {
  /** The numeric value being explained (null when unknown / N/A). */
  value: number | null;
  /** Formatted display string, e.g. "12.3 %" — caller formats. */
  displayValue: string;
  /** Dotted path the caller passed in (for debugging / linking back). */
  metricPath: string;
  /** Resolved metric metadata (never null — falls back to UNDOCUMENTED_META). */
  meta: MetricMeta;
  /** True when the caller-supplied value is atypical (negative, NaN, etc). */
  anomalous: boolean;
  /** True when meta resolved to the undocumented fallback. */
  undocumented: boolean;
  /** One-line citation (publisher, year). */
  citation: string;
  /** Full footnote string. */
  footnote: string;
  /** Hex color for the confidence pill (terminal palette). */
  confidenceHex: string;
  /** Stable severity ranking 0..3 (low → high) for sorting cards. */
  confidenceRank: number;
}

const RANK: Record<Confidence, number> = { low: 0, modelled: 1, medium: 2, high: 3 };

/**
 * Build an ExplainCard for a single stat.
 *
 * @param value       The number being shown (null when N/A).
 * @param metricPath  Dotted metric key, e.g. "SDN.hunger.undernourishment_pct".
 * @param displayValue Optional pre-formatted string; defaults to value?.toString() ?? "N/A".
 */
export function explainNumber(
  value: number | null,
  metricPath: string,
  displayValue?: string,
): ExplainCard {
  const meta = resolveMetricMeta(metricPath);
  const undocumented = meta.id === UNDOCUMENTED_META.id;
  const anomalous =
    value !== null && (Number.isNaN(value) || !Number.isFinite(value) || value < 0);

  return {
    value,
    displayValue: displayValue ?? (value === null ? "N/A" : String(value)),
    metricPath,
    meta,
    anomalous,
    undocumented,
    citation: shortCitation(meta),
    footnote: renderFootnote(value, meta),
    confidenceHex: confidenceColor(meta.confidence),
    confidenceRank: RANK[meta.confidence],
  };
}

/** Build many cards at once. Keeps the UI loop tight. */
export function explainMany(
  rows: Array<{ value: number | null; metricPath: string; displayValue?: string }>,
): ExplainCard[] {
  return rows.map((r) => explainNumber(r.value, r.metricPath, r.displayValue));
}

/**
 * Two-line summary string for compact surfaces (terminal cards, audit rows).
 * Example: "12.3 % — FAO (2023). confidence: medium."
 */
export function summaryLine(card: ExplainCard): string {
  const head = `${card.displayValue} ${card.meta.unit}`.trim();
  return `${head} — ${card.citation}. confidence: ${card.meta.confidence}.`;
}

/** True when the card carries enough info to actually cite (not the fallback). */
export function isCitable(card: ExplainCard): boolean {
  return !card.undocumented;
}

/**
 * Sort cards by confidence (highest first), with undocumented cards last.
 * Stable on equal confidence by preserving input order.
 */
export function sortByConfidence(cards: ExplainCard[]): ExplainCard[] {
  return [...cards].sort((a, b) => {
    if (a.undocumented !== b.undocumented) return a.undocumented ? 1 : -1;
    return b.confidenceRank - a.confidenceRank;
  });
}
