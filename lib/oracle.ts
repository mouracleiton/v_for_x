/**
 * V FOR X — The Oracle
 *
 * Natural-language query engine over 200 countries × 24 dimensions.
 * No API calls, no AI service — pure client-side pattern matching.
 *
 * Parses plain-English queries like:
 *   "Which countries spend more on military than healthcare?"
 *   "Top 10 countries by hunger"
 *   "Countries where child mortality > 50"
 *   "Show me countries with lowest life expectancy"
 *
 * Returns ranked country lists with the relevant metrics highlighted.
 */

import type { CountryData, WorldBackbone } from "./types";

/* ═══════════════════════════════════════════════════════════════
   Metric registry — maps natural-language keywords to data extractors
   ═══════════════════════════════════════════════════════════════ */

export interface MetricDef {
  id: string;
  label: string;
  unit: string;
  keywords: string[];
  extract: (c: CountryData) => number | null;
  /** When true, lower values are "better" (e.g. mortality) */
  lowerIsBetter?: boolean;
  /** Higher values indicate crisis/worsening */
  higherIsCrisis?: boolean;
}

export const METRICS: MetricDef[] = [
  // Hunger
  {
    id: "undernourishment",
    label: "Undernourishment",
    unit: "%",
    keywords: ["hunger", "undernourished", "starving", "malnourished", "food insecurity", "famine"],
    extract: (c) => c.hunger.undernourishment_pct,
    higherIsCrisis: true,
  },
  {
    id: "acute_hunger",
    label: "Acute Food Insecurity",
    unit: "M people",
    keywords: ["acute hunger", "acute food insecurity", "food crisis"],
    extract: (c) => c.hunger.pop_acute_fi_m,
    higherIsCrisis: true,
  },
  {
    id: "child_stunting",
    label: "Child Stunting",
    unit: "%",
    keywords: ["stunting", "stunted", "child growth"],
    extract: (c) => c.hunger.child_stunting_pct,
    higherIsCrisis: true,
  },
  // Conflict
  {
    id: "conflict_intensity",
    label: "Conflict Intensity",
    unit: "1-5",
    keywords: ["conflict", "war", "violence", "battle"],
    extract: (c) => c.conflict.intensity_1to5,
    higherIsCrisis: true,
  },
  {
    id: "displacement",
    label: "Displacement",
    unit: "M people",
    keywords: ["displacement", "displaced", "refugees", "idp"],
    extract: (c) => c.conflict.displacement_m,
    higherIsCrisis: true,
  },
  // Military
  {
    id: "military_spending",
    label: "Military Expenditure",
    unit: "USD",
    keywords: ["military", "defense spending", "arms budget", "war budget"],
    extract: (c) => c.military.expenditure_usd,
    higherIsCrisis: true,
  },
  {
    id: "military_pct_gdp",
    label: "Military % GDP",
    unit: "%",
    keywords: ["military percent", "defense percent gdp", "military gdp"],
    extract: (c) => c.military.pct_gdp,
    higherIsCrisis: true,
  },
  // Health
  {
    id: "life_expectancy",
    label: "Life Expectancy",
    unit: "years",
    keywords: ["life expectancy", "lifespan", "longevity"],
    extract: (c) => c.health.life_expectancy,
    lowerIsBetter: false,
  },
  {
    id: "child_mortality",
    label: "Child Mortality (under 5)",
    unit: "per 1k",
    keywords: ["child mortality", "infant mortality", "child death", "under 5 mortality"],
    extract: (c) => c.health.child_mortality_under5_per1k,
    higherIsCrisis: true,
  },
  {
    id: "health_spending",
    label: "Health Expenditure",
    unit: "USD",
    keywords: ["health spending", "healthcare spending", "health expenditure", "medical budget"],
    extract: (c) => c.health.expenditure_per_capita_usd,
  },
  {
    id: "health_pct_gdp",
    label: "Health % GDP",
    unit: "%",
    keywords: ["health percent gdp", "healthcare percent"],
    extract: (c) => c.health.expenditure_pct_gdp,
  },
  {
    id: "doctors",
    label: "Doctors",
    unit: "per 1k",
    keywords: ["doctors", "physicians", "medical staff"],
    extract: (c) => c.health.doctors_per_1000 ?? null,
  },
  // Poverty
  {
    id: "poverty",
    label: "Extreme Poverty ($3.65/day)",
    unit: "%",
    keywords: ["poverty", "poor", "extreme poverty", "destitution"],
    extract: (c) => c.poverty.headcount_365_pct,
    higherIsCrisis: true,
  },
  // Economy
  {
    id: "gdp_per_capita",
    label: "GDP per Capita",
    unit: "USD",
    keywords: ["gdp", "income", "wealth", "economic output", "per capita"],
    extract: (c) => c.economy.gdp_per_capita_usd,
  },
  {
    id: "unemployment",
    label: "Unemployment",
    unit: "%",
    keywords: ["unemployment", "jobless", "unemployed"],
    extract: (c) => c.employment.unemployment_pct,
    higherIsCrisis: true,
  },
  // Inequality
  {
    id: "gini",
    label: "Gini Coefficient",
    unit: "",
    keywords: ["gini", "inequality", "income gap", "wealth gap"],
    extract: (c) => c.inequality.gini,
    higherIsCrisis: true,
  },
  // Water
  {
    id: "water_access",
    label: "Basic Water Access",
    unit: "%",
    keywords: ["water", "water access", "clean water", "drinking water"],
    extract: (c) => c.water_sanitation.basic_access_pct,
  },
  // Education
  {
    id: "literacy",
    label: "Literacy Rate",
    unit: "%",
    keywords: ["literacy", "literate", "reading", "illiteracy"],
    extract: (c) => c.education.literacy_rate_pct,
  },
  // Climate
  {
    id: "co2_per_capita",
    label: "CO₂ per Capita",
    unit: "tons",
    keywords: ["co2", "carbon", "emissions", "climate emissions"],
    extract: (c) => c.climate.co2_per_capita_t,
    higherIsCrisis: true,
  },
  {
    id: "air_pollution",
    label: "Air Pollution (PM2.5)",
    unit: "µg/m³",
    keywords: ["air pollution", "pm25", "pm2.5", "air quality", "smog"],
    extract: (c) => c.environment.air_pollution_pm25_ugm3,
    higherIsCrisis: true,
  },
  // Governance
  {
    id: "corruption",
    label: "Corruption Perceptions Index",
    unit: "0-100",
    keywords: ["corruption", "corrupt", "bribe"],
    extract: (c) => c.governance.corruption_perceptions_index,
    // Note: CPI is inverted — lower = more corrupt
  },
  {
    id: "democracy",
    label: "Democracy Index",
    unit: "0-1",
    keywords: ["democracy", "democratic", "freedom", "autocracy", "authoritarian"],
    extract: (c) => c.governance.electoral_democracy_index,
  },
  // Security
  {
    id: "homicide",
    label: "Homicide Rate",
    unit: "per 100k",
    keywords: ["homicide", "murder", "violent crime", "killings"],
    extract: (c) => c.security.homicide_rate_per100k,
    higherIsCrisis: true,
  },
  // Connectivity
  {
    id: "internet",
    label: "Internet Access",
    unit: "%",
    keywords: ["internet", "connectivity", "online", "broadband"],
    extract: (c) => c.connectivity.internet_users_pct,
  },
  // Energy
  {
    id: "no_electricity",
    label: "People without Electricity",
    unit: "M",
    keywords: ["electricity", "energy access", "power", "no electricity"],
    extract: (c) => c.energy?.no_access_electricity_m ?? null,
    higherIsCrisis: true,
  },
  // Mental health
  {
    id: "suicide_rate",
    label: "Suicide Rate",
    unit: "per 100k",
    keywords: ["suicide", "mental health", "depression"],
    extract: (c) => c.mental_health?.suicide_rate_per100k ?? null,
    higherIsCrisis: true,
  },
];

/* ═══════════════════════════════════════════════════════════════
   Query parser
   ═══════════════════════════════════════════════════════════════ */

export type Comparator = "gt" | "lt" | "top" | "bottom" | "max" | "min" | "avg" | "list";

export interface ParsedQuery {
  metric: MetricDef;
  comparator: Comparator;
  threshold?: number;
  limit?: number;
  region?: string;
  raw: string;
  interpretation: string;
}

const REGIONS = [
  "africa", "asia", "europe", "americas", "oceania",
  "sub-saharan", "north africa", "middle east", "latin america",
  "south america", "north america", "central asia", "south asia",
  "southeast asia", "east asia", "western europe", "eastern europe",
];

function matchRegion(query: string): string | undefined {
  const lower = query.toLowerCase();
  for (const r of REGIONS) {
    if (lower.includes(r)) {
      return r.charAt(0).toUpperCase() + r.slice(1);
    }
  }
  return undefined;
}

function matchMetric(query: string): MetricDef | null {
  const lower = query.toLowerCase();
  let best: MetricDef | null = null;
  let bestScore = 0;

  for (const m of METRICS) {
    for (const kw of m.keywords) {
      if (lower.includes(kw)) {
        // Longer keyword = more specific match
        const score = kw.length;
        if (score > bestScore) {
          bestScore = score;
          best = m;
        }
      }
    }
  }
  return best;
}

function extractNumber(query: string): number | undefined {
  // Match "top 10", "bottom 5", "> 50", "< 30", "above 40", "below 20"
  const topMatch = query.match(/(?:top|highest|most)\s+(\d+)/i);
  if (topMatch) return parseInt(topMatch[1]);

  const bottomMatch = query.match(/(?:bottom|lowest|least|fewest)\s+(\d+)/i);
  if (bottomMatch) return parseInt(bottomMatch[1]);

  const thresholdMatch = query.match(/(?:>|>|above|over|more than|exceeding|higher than)\s+(\d+(?:\.\d+)?)/i);
  if (thresholdMatch) return parseFloat(thresholdMatch[1]);

  const belowMatch = query.match(/(?:<|<|below|under|less than|fewer than|lower than)\s+(\d+(?:\.\d+)?)/i);
  if (belowMatch) return parseFloat(belowMatch[1]);

  // Default limit
  const limitMatch = query.match(/\b(\d+)\b/);
  if (limitMatch) return parseInt(limitMatch[1]);

  return undefined;
}

function determineComparator(query: string, num: number | undefined): Comparator {
  const lower = query.toLowerCase();

  if (lower.includes("average") || lower.includes("mean") || lower.includes("global average")) {
    return "avg";
  }

  if (lower.includes("max") || lower.includes("highest") || lower.includes("most") || lower.includes("worst")) {
    if (lower.includes("top") || (num && num <= 50)) return "top";
    return "max";
  }

  if (lower.includes("min") || lower.includes("lowest") || lower.includes("least") || lower.includes("best") || lower.includes("fewest")) {
    if (lower.includes("bottom") || (num && num <= 50)) return "bottom";
    return "min";
  }

  if (lower.includes(">") || lower.includes("above") || lower.includes("over") || lower.includes("more than") || lower.includes("exceeding") || lower.includes("higher than")) {
    return "gt";
  }

  if (lower.includes("<") || lower.includes("below") || lower.includes("under") || lower.includes("less than") || lower.includes("fewer than") || lower.includes("lower than")) {
    return "lt";
  }

  // Comparison queries
  if (lower.includes("spend more") || lower.includes("more.*than.*health") || lower.includes("versus") || lower.includes(" vs ") || lower.includes("compare")) {
    return "list";
  }

  // "Bottom N" / "bottom" queries (without a min keyword above)
  if (lower.includes("bottom")) return "bottom";

  return "top";
}

export function parseQuery(rawQuery: string): ParsedQuery | null {
  const metric = matchMetric(rawQuery);
  if (!metric) return null;

  const num = extractNumber(rawQuery);
  const comparator = determineComparator(rawQuery, num);
  const region = matchRegion(rawQuery);

  let interpretation = "";
  switch (comparator) {
    case "top":
      interpretation = `Top ${num || 10} countries by ${metric.label}`;
      break;
    case "bottom":
      interpretation = `Bottom ${num || 10} countries by ${metric.label}`;
      break;
    case "gt":
      interpretation = `Countries where ${metric.label} > ${num}`;
      break;
    case "lt":
      interpretation = `Countries where ${metric.label} < ${num}`;
      break;
    case "max":
      interpretation = `Country with highest ${metric.label}`;
      break;
    case "min":
      interpretation = `Country with lowest ${metric.label}`;
      break;
    case "avg":
      interpretation = `Global average ${metric.label}`;
      break;
    default:
      interpretation = `All countries ranked by ${metric.label}`;
  }
  if (region) interpretation += ` in ${region}`;

  return {
    metric,
    comparator,
    threshold: comparator === "gt" || comparator === "lt" ? num : undefined,
    limit: (comparator === "top" || comparator === "bottom") ? (num || 10) : undefined,
    region,
    raw: rawQuery,
    interpretation,
  };
}

/* ═══════════════════════════════════════════════════════════════
   Query executor
   ═══════════════════════════════════════════════════════════════ */

export interface QueryResult {
  country: CountryData;
  value: number;
  rank?: number;
}

function matchesRegion(country: CountryData, region: string | undefined): boolean {
  if (!region) return true;
  const cRegion = country.region.toLowerCase();
  const cSubregion = country.subregion.toLowerCase();
  const r = region.toLowerCase();
  return cRegion.includes(r) || cSubregion.includes(r) || r.includes(cRegion) || r.includes(cSubregion);
}

export function executeQuery(
  query: ParsedQuery,
  countries: CountryData[]
): QueryResult[] {
  // Filter by region
  let pool = countries.filter((c) => matchesRegion(c, query.region));

  // Extract metric values, filter out nulls
  const withValues: QueryResult[] = pool
    .map((c) => {
      const val = query.metric.extract(c);
      return val !== null && val !== undefined
        ? { country: c, value: val }
        : null;
    })
    .filter((r): r is QueryResult => r !== null);

  // Sort — ascending or descending depending on comparator
  const descending = query.comparator === "top" || query.comparator === "max";
  withValues.sort((a, b) =>
    descending ? b.value - a.value : a.value - b.value
  );

  switch (query.comparator) {
    case "gt":
      return withValues.filter((r) => r.value > (query.threshold || 0));
    case "lt":
      return withValues.filter((r) => r.value < (query.threshold || Infinity));
    case "top":
    case "bottom":
      return withValues.slice(0, query.limit || 10).map((r, i) => ({ ...r, rank: i + 1 }));
    case "max":
      return withValues.length > 0 ? [{ ...withValues[0], rank: 1 }] : [];
    case "min":
      // Re-sort ascending for min
      withValues.sort((a, b) => a.value - b.value);
      return withValues.length > 0 ? [{ ...withValues[0], rank: 1 }] : [];
    case "avg":
      // Return all, but we'll display average separately
      return withValues;
    default:
      return withValues.slice(0, 50).map((r, i) => ({ ...r, rank: i + 1 }));
  }
}

export function computeAverage(results: QueryResult[]): number {
  if (results.length === 0) return 0;
  return results.reduce((sum, r) => sum + r.value, 0) / results.length;
}

/* ═══════════════════════════════════════════════════════════════
   Example queries
   ═══════════════════════════════════════════════════════════════ */

export const EXAMPLE_QUERIES = [
  "Top 10 countries by military spending",
  "Countries where child mortality > 50",
  "Top 5 countries by hunger in Africa",
  "Lowest life expectancy countries",
  "Countries with highest Gini coefficient",
  "Top 10 by CO2 emissions per capita",
  "Countries where literacy < 60%",
  "Highest homicide rate countries",
  "Countries with most doctors per 1000",
  "Bottom 10 countries by internet access",
  "Countries where undernourishment > 30%",
  "Top 5 by poverty in Asia",
];

/* ═══════════════════════════════════════════════════════════════
   Military vs health comparison (special query)
   ═══════════════════════════════════════════════════════════════ */

export function militaryVsHealth(countries: CountryData[]): QueryResult[] {
  return countries
    .filter(
      (c) =>
        c.military.expenditure_usd !== null &&
        c.health.expenditure_per_capita_usd !== null &&
        c.military.expenditure_usd > 0 &&
        c.health.expenditure_per_capita_usd > 0
    )
    .map((c) => {
      const healthTotal =
        (c.health.expenditure_per_capita_usd || 0) * c.demographics.population;
      const ratio = (c.military.expenditure_usd || 0) / healthTotal;
      return { country: c, value: ratio };
    })
    .filter((r) => r.value > 1) // Only countries spending MORE on military
    .sort((a, b) => b.value - a.value)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}
