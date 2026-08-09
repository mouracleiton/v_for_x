/**
 * V FOR X — Data Export Utilities
 *
 * CSV / JSON export, academic citation generation, and embeddable
 * iframe snippets. All functions are SSR-safe (guard `window`).
 */

import type { CountryData } from "@/lib/types";
import { SITE } from "@/lib/seo";

/* ═══════════════════════════════════════════════════════════════
   LOW-LEVEL HELPERS
   ═══════════════════════════════════════════════════════════════ */

/** Trigger a file download in the browser. SSR-safe. */
export function downloadFile(
  filename: string,
  content: string,
  mime: string
): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke on next tick so the download has time to start.
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/** Escape a single CSV cell value (RFC 4180). */
function csvEscape(val: unknown): string {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Resolve a dotted path (e.g. "health.life_expectancy") from an object. */
function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc !== null && typeof acc === "object") {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/** Recursively flatten a nested object into dot-path key/value pairs. */
function flatten(
  obj: unknown,
  prefix = ""
): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) return out;
  for (const [key, value] of Object.entries(
    obj as Record<string, unknown>
  )) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      Object.assign(out, flatten(value, path));
    } else if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      out[path] = value as string | number | boolean | null;
    }
  }
  return out;
}

/* ═══════════════════════════════════════════════════════════════
   CSV EXPORT
   ═══════════════════════════════════════════════════════════════ */

/**
 * Export a single country as a 2-column (metric, value) CSV string.
 * Every dimension is flattened with dot notation so nothing is lost.
 */
export function exportCountryCSV(country: CountryData): string {
  const flat = flatten(country);
  const lines = ["metric,value"];
  for (const [key, value] of Object.entries(flat)) {
    lines.push(`${csvEscape(key)},${csvEscape(value ?? "")}`);
  }
  return lines.join("\n");
}

/** Key comparison dimensions for the multi-country export. */
const COUNTRY_COLUMNS: { key: string; label: string }[] = [
  { key: "iso3", label: "ISO3" },
  { key: "iso2", label: "ISO2" },
  { key: "name_en", label: "Name" },
  { key: "region", label: "Region" },
  { key: "subregion", label: "Subregion" },
  { key: "is_hotspot", label: "Hotspot" },
  { key: "population_m", label: "Population (M)" },
  { key: "hunger.undernourishment_pct", label: "Undernourishment (%)" },
  { key: "hunger.child_stunting_pct", label: "Child Stunting (%)" },
  { key: "hunger.famine_risk_1to5", label: "Famine Risk (/5)" },
  { key: "conflict.intensity_1to5", label: "Conflict Intensity (/5)" },
  { key: "conflict.displacement_m", label: "Displacement (M)" },
  { key: "economy.gdp_usd", label: "GDP (USD)" },
  { key: "economy.gdp_per_capita_usd", label: "GDP per Capita (USD)" },
  { key: "health.life_expectancy", label: "Life Expectancy" },
  { key: "health.child_mortality_under5_per1k", label: "Child Mortality (/1k)" },
  { key: "health.doctors_per_1000", label: "Doctors (/1k)" },
  { key: "education.literacy_rate_pct", label: "Literacy (%)" },
  { key: "education.pisa_score", label: "PISA Score" },
  { key: "military.expenditure_usd", label: "Military Spending (USD)" },
  { key: "military.pct_gdp", label: "Military (% GDP)" },
  { key: "climate.co2_per_capita_t", label: "CO2 per Capita (t)" },
  { key: "inequality.gini", label: "Gini" },
  { key: "poverty.headcount_365_pct", label: "Extreme Poverty (%)" },
  { key: "governance.corruption_perceptions_index", label: "CPI (Corruption)" },
  { key: "governance.electoral_democracy_index", label: "Democracy Index" },
  { key: "water_sanitation.basic_access_pct", label: "Basic Water (%)" },
  { key: "water_sanitation.safe_sanitation_pct", label: "Safe Sanitation (%)" },
];

/**
 * Export many countries as a wide CSV: one row per country, one column per
 * key dimension. Ideal for spreadsheets and statistical tools.
 */
export function exportAllCountriesCSV(countries: CountryData[]): string {
  const header = COUNTRY_COLUMNS.map((c) => csvEscape(c.label)).join(",");
  const rows = countries.map((country) =>
    COUNTRY_COLUMNS.map((col) =>
      csvEscape(getPath(country, col.key) ?? "")
    ).join(",")
  );
  return [header, ...rows].join("\n");
}

/* ═══════════════════════════════════════════════════════════════
   JSON EXPORT
   ═══════════════════════════════════════════════════════════════ */

/** Serialize any data as pretty-printed JSON and download it. */
export function exportJSON(data: unknown, filename: string): void {
  downloadFile(
    filename,
    JSON.stringify(data, null, 2),
    "application/json;charset=utf-8"
  );
}

/* ═══════════════════════════════════════════════════════════════
   ACADEMIC CITATIONS
   ═══════════════════════════════════════════════════════════════ */

function todayLong(): string {
  try {
    return new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/**
 * Generate a formatted academic citation for a country's data profile.
 * Supports APA (7th ed.), MLA (9th ed.), and Chicago (notes) styles.
 */
export function generateCitation(
  country: CountryData,
  format: "apa" | "mla" | "chicago"
): string {
  const year = new Date().getFullYear();
  const retrieved = todayLong();
  const title = `${country.name_en} (${country.iso3}) — Country Data Profile`;
  const url = `${SITE.url}/sorrow-map/${country.iso3.toLowerCase()}/`;

  switch (format) {
    case "apa":
      return `V FOR X. (${year}). ${title}. Retrieved ${retrieved}, from ${url}`;
    case "mla":
      return `V FOR X. "${title}." V FOR X — Open Data Against Hunger, ${year}, ${url}. Accessed ${retrieved}.`;
    case "chicago":
      return `V FOR X. "${title}." Accessed ${retrieved}. ${url}.`;
    default:
      return generateCitation(country, "apa");
  }
}

/* ═══════════════════════════════════════════════════════════════
   EMBEDDABLE IFRAME CODE
   ═══════════════════════════════════════════════════════════════ */

/**
 * Generate an embeddable iframe snippet for any V FOR X page.
 * `page` is a route like "sorrow-map" or "the-compare".
 * `params` becomes the query string (e.g. { country: "SDN" }).
 */
export function generateEmbedCode(
  page: string,
  params: Record<string, string>
): string {
  const cleanPage = page.replace(/^\/+|\/+$/g, "");
  const query = new URLSearchParams(params).toString();
  const src = `${SITE.url}/${cleanPage}/${query ? `?${query}` : ""}`;
  const label = cleanPage.replace(/[-/]/g, " ");
  return `<iframe
  src="${src}"
  width="100%"
  height="600"
  frameborder="0"
  loading="lazy"
  style="border:1px solid #1a2a44;border-radius:4px;background:#060b14;"
  title="V FOR X — ${label}"
></iframe>`;
}
