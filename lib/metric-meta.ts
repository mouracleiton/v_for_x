/**
 * V FOR X — Metric Metadata (source-grade footnotes for backbone metrics)
 *
 * Every number on a dossier should be able to answer: "where did this
 * come from, when, under what license, and how confident are we?" This
 * module is the seed registry that gives each backbone metric a
 * citable source card. Dossiers render these as footnotes so a reader
 * can audit any figure.
 *
 * The registry is keyed by metric-path fragments (matching the dotted
 * paths used by lib/snapshot-diff.ts). A `resolveMetricMeta` lookup
 * returns the best match for any path. Missing metrics get a graceful
 * "source not yet documented" fallback rather than a silent blank.
 */

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

export type Confidence = "high" | "medium" | "low" | "modelled";

export interface MetricMeta {
  /** Canonical metric id (matches backbone key, e.g. "displacement"). */
  id: string;
  /** Human label. */
  label: string;
  /** Unit (e.g. "people", "% of population", "USD millions"). */
  unit: string;
  /** Origin publisher. */
  publisher: string;
  /** Publisher's dataset name. */
  dataset: string;
  /** Year the figure was published/collected. */
  year: number;
  /** Data license / terms. */
  license: string;
  /** Source URL (for the citation, not auto-fetched). */
  url?: string;
  /** Our confidence in the figure. */
  confidence: Confidence;
  /** One-line methodology note. */
  methodology?: string;
  /** Caveats / known gaps. */
  caveats?: string[];
  /** Category bucket. */
  category: string;
  /** Path fragments this meta applies to (for fuzzy matching). */
  matches: string[];
}

/* ═══════════════════════════════════════════════════════════════
   Seeded registry
   ═══════════════════════════════════════════════════════════════ */

export const METRIC_META: MetricMeta[] = [
  {
    id: "displacement",
    label: "Forced displacement",
    unit: "people",
    publisher: "UNHCR",
    dataset: "Global Trends / Population Movement",
    year: 2024,
    license: "CC BY 4.0",
    url: "https://www.unhcr.org/data",
    confidence: "high",
    methodology: "Registered refugees, asylum-seekers, IDPs and others of concern.",
    caveats: ["Unregistered displacement undercounted", "IDP figures revised quarterly"],
    category: "humanitarian",
    matches: ["displacement", "refugees", "idp", "asylum"],
  },
  {
    id: "conflict_deaths",
    label: "Conflict-related deaths",
    unit: "people (annual)",
    publisher: "ACLED / UCDP",
    dataset: "Armed Conflict Location & Event Data",
    year: 2024,
    license: "CC BY-NC (ACLED)",
    url: "https://acleddata.com",
    confidence: "medium",
    methodology: "Event-based coding of reported fatalities from media and partner sources.",
    caveats: ["Reporting bias in active war zones", "Civilian/combatant split often unclear"],
    category: "conflict",
    matches: ["deaths", "fatalities", "casualties", "conflict"],
  },
  {
    id: "hunger",
    label: "Undernourishment",
    unit: "people / % of population",
    publisher: "FAO",
    dataset: "State of Food Security and Nutrition (SOFI)",
    year: 2023,
    license: "CC BY-NC-SA",
    url: "https://www.fao.org/hunger",
    confidence: "medium",
    methodology: "Prevalence of undernourishment (PoU) modelled from food supply + inequality.",
    caveats: ["Modelled, not directly surveyed", "Acute food insecurity (IPC) reported separately"],
    category: "humanitarian",
    matches: ["hunger", "undernourish", "food_insecur", "sdg2"],
  },
  {
    id: "military_spending",
    label: "Military expenditure",
    unit: "USD (current)",
    publisher: "SIPRI",
    dataset: "Military Expenditure Database",
    year: 2023,
    license: "Open access (attribution)",
    url: "https://www.sipri.org/databases/milex",
    confidence: "high",
    methodology: "Standardised NATO reporting; %GDP and per-capita derived.",
    caveats: ["Opaque budgets (some states exclude paramilitary)"],
    category: "economic",
    matches: ["military", "milex", "defense_spending", "arms"],
  },
  {
    id: "gdp",
    label: "Gross Domestic Product",
    unit: "USD (current)",
    publisher: "World Bank",
    dataset: "World Development Indicators",
    year: 2023,
    license: "World Bank Open Data (CC BY 4.0)",
    url: "https://data.worldbank.org",
    confidence: "high",
    methodology: "System of National Accounts; per-capita and PPP variants available.",
    caveats: ["Informal economy undercounted in some states"],
    category: "economic",
    matches: ["gdp", "gdp_per_capita", "gdp_ppp"],
  },
  {
    id: "governance",
    label: "Worldwide Governance Indicators",
    unit: "percentile rank (0–100)",
    publisher: "World Bank",
    dataset: "WGI",
    year: 2023,
    license: "World Bank Open Data",
    url: "https://info.worldbank.org/governance/wgi",
    confidence: "medium",
    methodology: "Aggregated from 30+ sources (surveys, expert ratings, NGOs) per dimension.",
    caveats: ["Composite perception index, not direct measurement", "Source coverage varies by country"],
    category: "governance",
    matches: ["governance", "rule_of_law", "control_of_corruption", "government_effectiveness", "regulatory_quality", "voice_accountability", "political_stability"],
  },
  {
    id: "press_freedom",
    label: "Press Freedom Index",
    unit: "score (0–100, lower = worse)",
    publisher: "Reporters Without Borders",
    dataset: "World Press Freedom Index",
    year: 2024,
    license: "RSF terms (attribution)",
    url: "https://rsf.org/en/index",
    confidence: "medium",
    methodology: "Survey of journalists + quantitative abuses data.",
    category: "governance",
    matches: ["press", "media_freedom"],
  },
  {
    id: "water_access",
    label: "Safe water access",
    unit: "% of population",
    publisher: "WHO / UNICEF",
    dataset: "Joint Monitoring Programme (JMP)",
    year: 2022,
    license: "CC BY 3.0 IGO",
    confidence: "high",
    methodology: "Safely-managed / basic drinking water service levels.",
    caveats: ["Rural/urban and subnational gaps large"],
    category: "humanitarian",
    matches: ["water", "sanitation", "sdg6"],
  },
  {
    id: "health_access",
    label: "Healthcare access",
    unit: "index / per-capita workers",
    publisher: "WHO",
    dataset: "Global Health Observatory",
    year: 2023,
    license: "CC BY-NC-SA 3.0 IGO",
    confidence: "medium",
    methodology: "UHC service coverage index + health-worker density.",
    category: "humanitarian",
    matches: ["health", "uhc", "sdg3", "doctors", "vaccin"],
  },
  {
    id: "education",
    label: "Education access / literacy",
    unit: "% / years of schooling",
    publisher: "UNESCO Institute for Statistics",
    dataset: "Education indicators",
    year: 2022,
    license: "CC BY 3.0 IGO",
    confidence: "medium",
    methodology: "Out-of-school rates, literacy, mean years of schooling.",
    category: "humanitarian",
    matches: ["education", "literacy", "school", "sdg4"],
  },
  {
    id: "energy_access",
    label: "Electricity access",
    unit: "% of population",
    publisher: "IEA / World Bank",
    dataset: "Tracking SDG7",
    year: 2022,
    license: "CC BY 4.0",
    confidence: "high",
    methodology: "Population with electricity / clean cooking access.",
    category: "infrastructure",
    matches: ["energy", "electricity", "sdg7", "cooking"],
  },
  {
    id: "sanctions",
    label: "Sanctions & designations",
    unit: "entities",
    publisher: "OpenSanctions",
    dataset: "Consolidated sanctions registry",
    year: 2024,
    license: "CC BY 4.0",
    url: "https://www.opensanctions.org",
    confidence: "high",
    methodology: "Aggregation of OFAC, EU, UK, UN and national sanctions lists.",
    category: "sanctions",
    matches: ["sanctions", "designated", "ofac"],
  },
  {
    id: "ejatlas_conflicts",
    label: "Environmental conflicts",
    unit: "cases",
    publisher: "EJAtlas",
    dataset: "Global Atlas of Environmental Justice",
    year: 2023,
    license: "CC BY-NC-SA",
    confidence: "medium",
    methodology: "Crowd-sourced + verified case documentation.",
    caveats: ["Coverage biased toward documented cases"],
    category: "environmental",
    matches: ["ejatlas", "environmental", "land_conflict"],
  },
];

/** Fallback meta for undocumented metrics. */
export const UNDOCUMENTED_META: MetricMeta = {
  id: "undocumented",
  label: "Undocumented metric",
  unit: "—",
  publisher: "Unknown",
  dataset: "—",
  year: 0,
  license: "—",
  confidence: "low",
  methodology: "Source not yet documented in the metric registry.",
  category: "other",
  matches: [],
};

/* ═══════════════════════════════════════════════════════════════
   Lookup
   ═══════════════════════════════════════════════════════════════ */

/**
 * Resolve metric metadata for a dotted path (e.g. "AFG.displacement"
 * or "global_indicators.military"). Matches on any registered
 * `matches` fragment; falls back to UNDOCUMENTED_META.
 */
export function resolveMetricMeta(path: string): MetricMeta {
  const lower = path.toLowerCase();
  // Exact id match first.
  const exact = METRIC_META.find((m) => m.id === lower);
  if (exact) return exact;
  // Fragment match: prefer the longest matching fragment (most specific).
  let best: MetricMeta | null = null;
  let bestLen = 0;
  for (const m of METRIC_META) {
    for (const frag of m.matches) {
      if (lower.includes(frag) && frag.length > bestLen) {
        best = m;
        bestLen = frag.length;
      }
    }
  }
  return best ?? UNDOCUMENTED_META;
}

/** Resolve meta for many paths at once. */
export function resolveMany(paths: string[]): Record<string, MetricMeta> {
  const out: Record<string, MetricMeta> = {};
  for (const p of paths) out[p] = resolveMetricMeta(p);
  return out;
}

/* ═══════════════════════════════════════════════════════════════
   Footnote rendering
   ═══════════════════════════════════════════════════════════════ */

/**
 * Render a metric as a footnote string suitable for dossier display.
 * @param value    the numeric value (optional, for context)
 * @param meta     the resolved metric meta
 */
export function renderFootnote(value: number | null, meta: MetricMeta): string {
  const valStr = value === null ? "" : `${value.toLocaleString()} ${meta.unit}`.trim() + " — ";
  const conf = `confidence: ${meta.confidence}`;
  const caveats = meta.caveats && meta.caveats.length > 0 ? ` Caveats: ${meta.caveats.join("; ")}.` : "";
  return `${valStr}${meta.publisher}, ${meta.dataset} (${meta.year}, ${meta.license}). ${conf}.${caveats}`;
}

/** Confidence → color token (matches terminal palette). */
export function confidenceColor(confidence: Confidence): string {
  switch (confidence) {
    case "high": return "#00ff41";
    case "medium": return "#ffc40d";
    case "low": return "#ff7f50";
    case "modelled": return "#00ddff";
  }
}

/** Short citation string (publisher, year). */
export function shortCitation(meta: MetricMeta): string {
  return `${meta.publisher} (${meta.year})`;
}
