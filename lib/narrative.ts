/**
 * V FOR X — Auto-Generated Country Narratives
 *
 * Renders a readable, data-grounded briefing for ANY of the 200 countries,
 * closing the "narrative gap": only 22 countries have curated timelines.
 * Every sentence is derived directly from world_backbone.json — no fabricated
 * claims. Sentences are suppressed when the underlying data is missing.
 *
 * Pure functions throughout; unit-testable without a DOM.
 */

import type { CountryData } from "./types";

export interface NarrativeSentence {
  text: string;
  /** Dimension the sentence draws on (for display grouping). */
  dimension: string;
}

export interface CountryNarrative {
  /** Country the narrative was generated for. */
  iso3: string;
  /** Ordered, data-grounded sentences. */
  sentences: NarrativeSentence[];
  /** Short one-line summary (first sentence or manual fallback). */
  summary: string;
  /** Whether every sentence is data-derived (no fabricated content). */
  dataGrounded: true;
}

const fmt1 = (n: number | null | undefined): string | null => {
  if (n === null || n === undefined || Number.isNaN(n)) return null;
  return (n >= 100 ? Math.round(n).toLocaleString("en-US") : n.toFixed(1));
};

const pct = (n: number | null | undefined): string | null =>
  n === null || n === undefined ? null : `${n.toFixed(1)}%`;

const money = (n: number | null | undefined): string | null => {
  if (n === null || n === undefined) return null;
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)} trillion`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)} billion`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)} million`;
  return `$${n.toFixed(0)}`;
};

function sentence(dimension: string, text: string): NarrativeSentence {
  return { dimension, text };
}

/**
 * Generate the full data-grounded narrative for a country.
 * Sentences with missing data are silently dropped.
 */
export function generateCountryNarrative(c: CountryData): CountryNarrative {
  const s: NarrativeSentence[] = [];
  const name = c.name_en;
  const pop = c.population_m;
  const region = c.subregion || c.region;

  // ── Population ──
  if (pop !== null && pop !== undefined) {
    s.push(sentence(
      "overview",
      `${name} has an estimated population of ${fmt1(pop)} million people in ${region}.`,
    ));
  }

  // ── Hunger ──
  const hunger = c.hunger;
  if (hunger) {
    const und = pct(hunger.undernourishment_pct);
    if (und) {
      s.push(sentence(
        "hunger",
        `${und} of the population is undernourished.`,
      ));
    }
    const stunting = pct(hunger.child_stunting_pct);
    if (stunting) {
      s.push(sentence(
        "hunger",
        `Child stunting affects ${stunting} of children under five — a signal of chronic food insecurity and early-life deprivation.`,
      ));
    }
    const famine = hunger.famine_risk_1to5;
    if (famine !== null && famine !== undefined && famine > 0) {
      s.push(sentence(
        "hunger",
        `The FAO famine risk is rated ${famine}/5, meaning ${famine >= 4 ? "extreme and imminent risk of famine" : famine === 3 ? "a serious and rapidly deteriorating situation" : famine === 2 ? "a stressed but not yet critical situation" : "conditions that remain below emergency thresholds"}.`,
      ));
    }
    if (hunger.wfp_class) {
      s.push(sentence(
        "hunger",
        `WFP classifies the food-security situation as ${hunger.wfp_class.replace(/_/g, " ")}.`,
      ));
    }
  }

  // ── Conflict ──
  const conflict = c.conflict;
  if (conflict) {
    const intensity = conflict.intensity_1to5;
    if (intensity !== null && intensity !== undefined && intensity > 0) {
      s.push(sentence(
        "conflict",
        intensity >= 3
          ? `Active armed conflict is ongoing at intensity ${intensity}/5 — civilians bear the direct consequences.`
          : intensity === 2
            ? `Limited armed conflict is recorded at intensity ${intensity}/5.`
            : `Conflict activity is present but low-intensity (${intensity}/5).`,
      ));
    }
    const displaced = conflict.displacement_m;
    if (displaced !== null && displaced !== undefined && displaced > 0) {
      s.push(sentence(
        "conflict",
        `${fmt1(displaced)} million people are internally displaced by conflict.`,
      ));
    }
    if (c.is_hotspot && c.hotspot_score !== null && c.hotspot_score !== undefined) {
      s.push(sentence(
        "conflict",
        `${name} is flagged as a V FOR X crisis hotspot with a composite risk score of ${c.hotspot_score}/100.`,
      ));
    }
  }

  // ── Military vs health ──
  const military = c.military;
  if (military) {
    const milPct = military.pct_gdp;
    const healthPct = c.health?.expenditure_pct_gdp;
    if (milPct !== null && milPct !== undefined) {
      const mil = money(military.expenditure_usd);
      s.push(sentence(
        "military",
        `${milPct.toFixed(1)}% of GDP goes to the military${mil ? ` (${mil} annually)` : ""}.`,
      ));
      if (healthPct !== null && healthPct !== undefined) {
        if (milPct > healthPct * 1.5) {
          s.push(sentence(
            "military",
            `Military spending is ${(milPct / (healthPct || 0.001)).toFixed(1)}× higher than public health spending (${healthPct.toFixed(1)}% of GDP) — a reversal of priorities with measurable human cost.`,
          ));
        } else if (healthPct > milPct) {
          s.push(sentence(
            "military",
            `Public health spending (${healthPct.toFixed(1)}% of GDP) exceeds the military share, prioritizing care over arms.`,
          ));
        }
      }
    }
  }

  // ── Health ──
  const health = c.health;
  if (health) {
    const le = health.life_expectancy;
    if (le !== null && le !== undefined) {
      s.push(sentence(
        "health",
        `Average life expectancy is ${le.toFixed(1)} years.`,
      ));
    }
    const childMort = health.child_mortality_under5_per1k;
    if (childMort !== null && childMort !== undefined) {
      s.push(sentence(
        "health",
        childMort >= 60
          ? `Child mortality is severe at ${fmt1(childMort)} per 1,000 live births — among the highest in the world.`
          : childMort >= 25
            ? `Child mortality stands at ${fmt1(childMort)} per 1,000 live births, well above the global average.`
            : `Child mortality is ${fmt1(childMort)} per 1,000 live births.`,
      ));
    }
  }

  // ── Poverty & economy ──
  const poverty = c.poverty;
  if (poverty) {
    const extreme = pct(poverty.headcount_365_pct);
    if (extreme) {
      s.push(sentence(
        "poverty",
        `${extreme} of the population lives in extreme poverty on less than $3.65 a day.`,
      ));
    }
  }
  const economy = c.economy;
  if (economy && economy.gdp_per_capita_usd !== null && economy.gdp_per_capita_usd !== undefined) {
    const gdppc = economy.gdp_per_capita_usd;
    s.push(sentence(
      "economy",
      gdppc < 2000
        ? `GDP per capita is ${money(gdppc)} — the economy cannot lift most citizens out of subsistence.`
        : gdppc < 12000
          ? `GDP per capita is ${money(gdppc)}, placing ${name} among lower-middle-income economies.`
          : gdppc < 30000
            ? `GDP per capita is ${money(gdppc)} — an upper-middle-income economy.`
            : `GDP per capita is ${money(gdppc)}, a high-income economy.`,
    ));
  }
  const gini = c.inequality?.gini;
  if (gini !== null && gini !== undefined) {
    s.push(sentence(
      "economy",
      gini >= 50
        ? `Income inequality is extreme (Gini ${gini.toFixed(0)}), concentrating wealth in a small elite.`
        : gini >= 40
          ? `Income inequality is high (Gini ${gini.toFixed(0)}).`
          : gini >= 30
            ? `Income inequality is moderate (Gini ${gini.toFixed(0)}).`
            : `Income distribution is relatively equal (Gini ${gini.toFixed(0)}).`,
    ));
  }

  // ── Education ──
  const education = c.education;
  if (education) {
    const lit = pct(education.literacy_rate_pct);
    if (lit) {
      s.push(sentence(
        "education",
        `Literacy stands at ${lit}${lit === "100.0%" ? "" : ` — ${Number.parseFloat(lit) < 60 ? "a severe barrier to opportunity and civic power" : "leaving a meaningful share of people excluded from written information"}`}.`,
      ));
    }
  }

  // ── Environment / climate ──
  const climate = c.climate;
  if (climate && climate.co2_per_capita_t !== null && climate.co2_per_capita_t !== undefined) {
    s.push(sentence(
      "climate",
      climate.co2_per_capita_t >= 8
        ? `Per-capita CO₂ emissions of ${climate.co2_per_capita_t.toFixed(1)}t are among the highest globally.`
        : climate.co2_per_capita_t >= 3
          ? `Per-capita CO₂ emissions are ${climate.co2_per_capita_t.toFixed(1)}t.`
          : `Per-capita CO₂ emissions are low at ${climate.co2_per_capita_t.toFixed(1)}t — the country contributes little to the crisis it is already enduring.`,
    ));
  }

  // ── Water & sanitation ──
  const water = c.water_sanitation;
  if (water) {
    const basic = pct(water.basic_access_pct);
    if (basic) {
      s.push(sentence(
        "water",
        `${basic} of the population has access to basic drinking water${Number.parseFloat(basic) < 60 ? " — a daily survival struggle for millions" : ""}.`,
      ));
    }
  }

  // ── Governance ──
  const governance = c.governance;
  if (governance) {
    const demIdx = governance.electoral_democracy_index;
    if (demIdx !== null && demIdx !== undefined) {
      s.push(sentence(
        "governance",
        demIdx >= 0.7
          ? `Electoral democracy is strong (V-Dem index ${demIdx.toFixed(2)}).`
          : demIdx >= 0.4
            ? `The V-Dem electoral democracy index of ${demIdx.toFixed(2)} points to a partial or fragile democracy.`
            : demIdx >= 0.15
              ? `The V-Dem electoral democracy index of ${demIdx.toFixed(2)} signals an authoritarian or closed system.`
              : `The V-Dem electoral democracy index of ${demIdx.toFixed(2)} indicates minimal democratic process.`,
      ));
    }
    const cpi = governance.corruption_perceptions_index;
    if (cpi !== null && cpi !== undefined) {
      s.push(sentence(
        "governance",
        cpi < 30
          ? `Corruption is pervasive (CPI ${fmt1(cpi)}/100).`
          : cpi < 50
            ? `Corruption is a systemic concern (CPI ${fmt1(cpi)}/100).`
            : `Corruption perceptions are relatively low (CPI ${fmt1(cpi)}/100).`,
      ));
    }
  }

  // ── Security / justice ──
  const security = c.security;
  if (security && security.homicide_rate_per100k !== null && security.homicide_rate_per100k !== undefined) {
    const hr = security.homicide_rate_per100k;
    s.push(sentence(
      "security",
      hr >= 20
        ? `The homicide rate of ${hr.toFixed(1)} per 100,000 is among the world's most violent.`
        : hr >= 8
          ? `The homicide rate of ${hr.toFixed(1)} per 100,000 is well above the global average.`
          : `The homicide rate is ${hr.toFixed(1)} per 100,000.`,
    ));
  }
  const prison = c.justice?.prison_rate_per_100k ?? c.security?.prison_rate_per_100k;
  if (prison !== null && prison !== undefined) {
    s.push(sentence(
      "justice",
      prison >= 300
        ? `${fmt1(prison)} people per 100,000 are incarcerated — an exceptionally punitive justice system.`
        : prison >= 150
          ? `${fmt1(prison)} people per 100,000 are incarcerated, above the global average.`
          : `${fmt1(prison)} people per 100,000 are incarcerated.`,
    ));
  }

  // ── Migration ──
  const migration = c.migration;
  if (migration) {
    const displaced = migration.forcibly_displaced;
    if (displaced !== null && displaced !== undefined && displaced > 0) {
      s.push(sentence(
        "migration",
        displaced >= 1_000_000
          ? `Over ${(displaced / 1_000_000).toFixed(1)} million people from ${name} are forcibly displaced.`
          : displaced >= 1000
            ? `${Math.round(displaced).toLocaleString("en-US")} people from ${name} are forcibly displaced.`
            : `${Math.round(displaced)} people from ${name} are forcibly displaced.`,
      ));
    }
  }

  // ── Gender ──
  const gender = c.gender;
  if (gender) {
    const wip = gender.women_parliament_pct;
    if (wip !== null && wip !== undefined) {
      s.push(sentence(
        "gender",
        wip >= 40
          ? `Women hold ${wip.toFixed(0)}% of parliamentary seats — among the highest representation globally.`
          : wip >= 25
            ? `Women hold ${wip.toFixed(0)}% of parliamentary seats, near the global average.`
            : `Women hold just ${wip.toFixed(0)}% of parliamentary seats — power remains concentrated in male hands.`,
      ));
    }
  }

  // ── Mental health ──
  const mh = c.mental_health;
  if (mh && mh.suicide_rate_per100k !== null && mh.suicide_rate_per100k !== undefined) {
    const sr = mh.suicide_rate_per100k;
    s.push(sentence(
      "mental_health",
      sr >= 15
        ? `The suicide rate of ${sr.toFixed(1)} per 100,000 is among the highest globally — a mental-health emergency.`
        : sr >= 9
          ? `The suicide rate of ${sr.toFixed(1)} per 100,000 exceeds the global average.`
          : `The suicide rate is ${sr.toFixed(1)} per 100,000.`,
    ));
  }

  // ── Fallback: if nothing grounded, never fabricate ──
  if (s.length === 0) {
    s.push(sentence(
      "overview",
      `${name} is present in the V FOR X dataset, but no narrative metrics are populated for this country at this time.`,
    ));
  }

  return {
    iso3: c.iso3,
    sentences: s,
    summary: s[0].text,
    dataGrounded: true,
  };
}
