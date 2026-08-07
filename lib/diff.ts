/**
 * V FOR X — Data Diff Engine
 *
 * Compares two versions of world_backbone.json to detect:
 * - Countries whose metrics changed between data syncs
 * - Threshold crossings (e.g., country entered famine risk)
 * - New/removed countries
 * - Global aggregate shifts
 *
 * Snapshots are stored as versioned JSON in data/snapshots/.
 */

export interface MetricChange {
  iso3: string;
  countryName: string;
  /** dotted path, e.g. "hunger.undernourishment_pct" */
  path: string;
  label: string;
  oldValue: number | null;
  newValue: number | null;
  delta: number | null;
  /** percent change relative to old value */
  pctChange: number | null;
  direction: "worse" | "better" | "neutral";
  severity: "critical" | "notable" | "minor";
}

export interface CountryAdded {
  iso3: string;
  countryName: string;
}

export interface CountryRemoved {
  iso3: string;
  countryName: string;
}

export interface DiffResult {
  oldDate: string;
  newDate: string;
  totalChanges: number;
  worsened: number;
  improved: number;
  newCountries: CountryAdded[];
  removedCountries: CountryRemoved[];
  changes: MetricChange[];
  /** top N most significant changes, sorted by severity */
  topChanges: MetricChange[];
  /** countries that crossed notable thresholds */
  thresholdCrossings: MetricChange[];
  summary: {
    oldTotalCountries: number;
    newTotalCountries: number;
    oldDate: string;
    newDate: string;
  };
}

/** Metrics we track for changes — dotted paths with labels and severity rules */
export const TRACKED_METRICS: {
  path: string;
  label: string;
  /** higher = worse (e.g. undernourishment) */
  higherIsWorse?: boolean;
  /** thresholds that matter when crossed */
  thresholds?: number[];
}[] = [
  { path: "hunger.undernourishment_pct", label: "Undernourishment", higherIsWorse: true, thresholds: [10, 20, 40] },
  { path: "hunger.famine_risk_1to5", label: "Famine Risk", higherIsWorse: true, thresholds: [3, 4, 5] },
  { path: "hunger.child_stunting_pct", label: "Child Stunting", higherIsWorse: true, thresholds: [20, 40] },
  { path: "hunger.child_wasting_pct", label: "Child Wasting", higherIsWorse: true, thresholds: [10, 15] },
  { path: "conflict.intensity_1to5", label: "Conflict Intensity", higherIsWorse: true, thresholds: [3, 4, 5] },
  { path: "conflict.displacement_m", label: "Displacement (M)", higherIsWorse: true },
  { path: "health.doctors_per_1000", label: "Doctors / 1k", thresholds: [1, 4.45] },
  { path: "health.life_expectancy", label: "Life Expectancy" },
  { path: "health.child_mortality_under5_per1k", label: "Child Mortality /1k", higherIsWorse: true, thresholds: [20, 40] },
  { path: "education.literacy_rate_pct", label: "Literacy Rate", thresholds: [50, 80] },
  { path: "water_sanitation.safe_sanitation_pct", label: "Safe Sanitation", thresholds: [50, 75] },
  { path: "climate.co2_per_capita_t", label: "CO2 / Capita", higherIsWorse: true, thresholds: [5, 10] },
  { path: "inequality.gini", label: "Gini Coefficient", higherIsWorse: true, thresholds: [40, 50] },
  { path: "poverty.headcount_365_pct", label: "Extreme Poverty", higherIsWorse: true, thresholds: [20, 40] },
  { path: "governance.corruption_perceptions_index", label: "CPI (corruption)" },
  { path: "military.pct_gdp", label: "Military % GDP", higherIsWorse: true },
  { path: "economy.gdp_per_capita_usd", label: "GDP per Capita" },
];

/** Resolve a dotted path from a country record */
function resolve(country: Record<string, unknown>, path: string): number | null {
  const parts = path.split(".");
  let val: unknown = country;
  for (const p of parts) {
    if (val == null || typeof val !== "object") return null;
    val = (val as Record<string, unknown>)[p];
  }
  if (val == null) return null;
  const n = typeof val === "boolean" ? (val ? 1 : 0) : Number(val);
  return Number.isFinite(n) ? n : null;
}

function classifySeverity(
  delta: number,
  pctChange: number,
  metricDef: (typeof TRACKED_METRICS)[number]
): "critical" | "notable" | "minor" {
  const absDelta = Math.abs(delta);
  const absPct = Math.abs(pctChange);

  // Metric-specific severity thresholds
  if (metricDef.path === "hunger.famine_risk_1to5" || metricDef.path === "conflict.intensity_1to5") {
    if (absDelta >= 1) return "critical";
    if (absDelta >= 0.5) return "notable";
  }
  if (metricDef.path.includes("undernourishment") || metricDef.path.includes("stunting")) {
    if (absDelta >= 5) return "critical";
    if (absDelta >= 2) return "notable";
  }
  // Generic: >20% change is notable, >50% is critical
  if (absPct >= 50) return "critical";
  if (absPct >= 20) return "notable";
  if (absDelta >= 1) return "notable";
  return "minor";
}

function crossedThreshold(
  oldVal: number,
  newVal: number,
  thresholds: number[]
): boolean {
  for (const t of thresholds) {
    if ((oldVal < t && newVal >= t) || (oldVal >= t && newVal < t)) return true;
  }
  return false;
}

/**
 * Compute the full diff between two backbone datasets.
 */
export function computeDiff(
  oldBackbone: { metadata: { created: string; total_countries: number }; countries: unknown[] },
  newBackbone: { metadata: { created: string; total_countries: number }; countries: unknown[] }
): DiffResult {
  const oldCountries = new Map<string, Record<string, unknown>>();
  const newCountries = new Map<string, Record<string, unknown>>();

  for (const c of oldBackbone.countries) {
    const rec = c as Record<string, unknown>;
    oldCountries.set(rec.iso3 as string, rec);
  }
  for (const c of newBackbone.countries) {
    const rec = c as Record<string, unknown>;
    newCountries.set(rec.iso3 as string, rec);
  }

  const changes: MetricChange[] = [];
  const newCountriesList: CountryAdded[] = [];
  const removedCountriesList: CountryRemoved[] = [];

  // Detect added/removed countries
  for (const [iso3, rec] of newCountries) {
    if (!oldCountries.has(iso3)) {
      newCountriesList.push({ iso3, countryName: (rec as { name_en?: string }).name_en ?? iso3 });
    }
  }
  for (const [iso3, rec] of oldCountries) {
    if (!newCountries.has(iso3)) {
      removedCountriesList.push({ iso3, countryName: (rec as { name_en?: string }).name_en ?? iso3 });
    }
  }

  // Compare tracked metrics
  for (const metricDef of TRACKED_METRICS) {
    for (const [iso3, newRec] of newCountries) {
      const oldRec = oldCountries.get(iso3);
      if (!oldRec) continue;

      const oldVal = resolve(oldRec, metricDef.path);
      const newVal = resolve(newRec, metricDef.path);

      // Skip if both null or both same value
      if (oldVal === null && newVal === null) continue;
      if (oldVal === newVal) continue;

      const delta = oldVal !== null && newVal !== null ? newVal - oldVal : null;
      const pctChange = oldVal !== null && oldVal !== 0 && newVal !== null
        ? ((newVal - oldVal) / Math.abs(oldVal)) * 100
        : null;

      // Determine direction
      let direction: "worse" | "better" | "neutral" = "neutral";
      if (delta !== null && delta !== 0) {
        if (metricDef.higherIsWorse) {
          direction = delta > 0 ? "worse" : "better";
        } else if (metricDef.path.includes("life_expectancy") || metricDef.path.includes("literacy") || metricDef.path.includes("safe_sanitation") || metricDef.path.includes("doctors") || metricDef.path.includes("gdp_per_capita") || metricDef.path.includes("corruption")) {
          // For "good" metrics (higher = better), increase is improvement
          direction = delta > 0 ? "better" : "worse";
        } else {
          direction = delta > 0 ? "worse" : "better";
        }
      }

      const severity = delta !== null && pctChange !== null
        ? classifySeverity(delta, pctChange, metricDef)
        : "notable";

      changes.push({
        iso3,
        countryName: (newRec as { name_en?: string }).name_en ?? iso3,
        path: metricDef.path,
        label: metricDef.label,
        oldValue: oldVal,
        newValue: newVal,
        delta,
        pctChange,
        direction,
        severity,
      });
    }
  }

  // Threshold crossings
  const thresholdCrossings = changes.filter((c) => {
    const metricDef = TRACKED_METRICS.find((m) => m.path === c.path);
    if (!metricDef?.thresholds || c.oldValue === null || c.newValue === null) return false;
    return crossedThreshold(c.oldValue, c.newValue, metricDef.thresholds);
  });

  // Sort by severity
  const severityOrder = { critical: 0, notable: 1, minor: 2 };
  const topChanges = [...changes]
    .filter((c) => c.severity !== "minor")
    .sort((a, b) => {
      const s = severityOrder[a.severity] - severityOrder[b.severity];
      if (s !== 0) return s;
      return Math.abs(b.pctChange ?? 0) - Math.abs(a.pctChange ?? 0);
    })
    .slice(0, 50);

  return {
    oldDate: oldBackbone.metadata.created,
    newDate: newBackbone.metadata.created,
    totalChanges: changes.length,
    worsened: changes.filter((c) => c.direction === "worse").length,
    improved: changes.filter((c) => c.direction === "better").length,
    newCountries: newCountriesList,
    removedCountries: removedCountriesList,
    changes,
    topChanges,
    thresholdCrossings,
    summary: {
      oldTotalCountries: oldBackbone.metadata.total_countries,
      newTotalCountries: newBackbone.metadata.total_countries,
      oldDate: oldBackbone.metadata.created,
      newDate: newBackbone.metadata.created,
    },
  };
}
