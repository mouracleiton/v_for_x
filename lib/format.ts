/**
 * V FOR X — Formatting utilities
 */

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return "N/A";
  if (Math.abs(n) >= 1e12) return (n / 1e12).toFixed(2) + "T";
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toFixed(1);
}

export function formatPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return "N/A";
  return n.toFixed(1) + "%";
}

export function formatMoney(n: number | null | undefined): string {
  if (n === null || n === undefined) return "N/A";
  if (Math.abs(n) >= 1e12) return "$" + (n / 1e12).toFixed(2) + "T";
  if (Math.abs(n) >= 1e9) return "$" + (n / 1e9).toFixed(2) + "B";
  if (Math.abs(n) >= 1e6) return "$" + (n / 1e6).toFixed(1) + "M";
  if (Math.abs(n) >= 1e3) return "$" + (n / 1e3).toFixed(1) + "K";
  return "$" + n.toFixed(2);
}

export function severityColor(
  value: number,
  min: number,
  max: number
): string {
  if (value === null || value === undefined || isNaN(value)) return "#1a1a1a";
  const ratio = Math.max(0, Math.min(1, (value - min) / (max - min)));
  if (ratio < 0.2) return "#3a0a0a";
  if (ratio < 0.4) return "#660000";
  if (ratio < 0.6) return "#990000";
  if (ratio < 0.8) return "#cc0000";
  return "#ff0000";
}

export function tierColor(tier: string): string {
  switch (tier.toUpperCase()) {
    case "S":
      return "#00ff41";
    case "A":
      return "#ffaa00";
    case "B":
      return "#cc0000";
    default:
      return "#444444";
  }
}

export function wfpClassColor(wfpClass: string): string {
  switch (wfpClass) {
    case "highest_concern":
      return "#ff0000";
    case "very_high_concern":
      return "#cc0000";
    case "high_concern":
      return "#990000";
    case "concern":
      return "#660000";
    default:
      return "#333333";
  }
}

export function wfpClassLabel(wfpClass: string): string {
  switch (wfpClass) {
    case "highest_concern":
      return "HIGHEST CONCERN";
    case "very_high_concern":
      return "VERY HIGH";
    case "high_concern":
      return "HIGH";
    case "concern":
      return "CONCERN";
    default:
      return "—";
  }
}
