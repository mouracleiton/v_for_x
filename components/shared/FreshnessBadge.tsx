"use client";

/**
 * V FOR X — Data Freshness Indicator
 * Shows the year a metric was last updated, with stale warnings.
 */

interface FreshnessBadgeProps {
  year: number | null | undefined;
  label?: string;
}

export default function FreshnessBadge({ year, label }: FreshnessBadgeProps) {
  if (year === null || year === undefined) return null;

  const currentYear = new Date().getFullYear();
  const age = currentYear - year;
  const isStale = age > 3;
  const isWarning = age > 2;

  const color = isStale
    ? "var(--color-blood)"
    : isWarning
      ? "var(--color-warning-amber)"
      : "var(--color-terminal-green)";

  const indicator = isStale ? "⚠" : isWarning ? "△" : "✓";

  return (
    <span
      className="inline-flex items-center gap-1 text-[9px] px-1 py-0.5 border font-mono"
      style={{ borderColor: color + "66", color }}
      title={`Data from ${year} (${age} year${age !== 1 ? "s" : ""} old)${isStale ? " — may be stale" : ""}`}
    >
      {indicator} {label ? `${label}: ` : ""}{year}
    </span>
  );
}

/**
 * Compute the overall data freshness for a country record.
 * Returns the oldest year found and the newest year.
 */
export function computeDataFreshness(country: {
  economy: { gdp_year: number };
  health: { life_expectancy_year: number };
  climate: { year: number };
  inequality: { gini_year: number };
  water_sanitation: { year: number };
  education: { year: number };
  connectivity: { year: number };
  migration: { year: number };
  environment: { year: number };
  gender: { year: number };
  governance: { democracy_year: number; cpi_year: number };
  military: { year: number };
}): { oldestYear: number | null; newestYear: number | null; avgAge: number | null } {
  const years = [
    country.economy.gdp_year,
    country.health.life_expectancy_year,
    country.climate.year,
    country.inequality.gini_year,
    country.water_sanitation.year,
    country.education.year,
    country.connectivity.year,
    country.migration.year,
    country.environment.year,
    country.gender.year,
    country.governance.democracy_year,
    country.governance.cpi_year,
    country.military.year,
  ];
  const valid = years.filter((y): y is number => y !== null && y !== undefined);
  if (valid.length === 0) return { oldestYear: null, newestYear: null, avgAge: null };
  const oldest = Math.min(...valid);
  const newest = Math.max(...valid);
  const currentYear = new Date().getFullYear();
  const avgAge = currentYear - Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
  return { oldestYear: oldest, newestYear: newest, avgAge };
}
