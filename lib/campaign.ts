/**
 * V FOR X — Campaign kit generator
 * Transforms country/equation data into action-ready campaign materials:
 * tweet threads, email templates, one-page briefs.
 */

import type { CountryData, SdgEquation, WorldBackbone } from "./types";
import { formatNumber, formatPct, formatMoney } from "./format";

export interface CampaignTweet {
  text: string;
  charCount: number;
}

export interface CampaignKit {
  tweets: CampaignTweet[];
  email: {
    subject: string;
    body: string;
  };
  brief: {
    title: string;
    summary: string;
    keyStats: { label: string; value: string }[];
    callToAction: string;
    sources: string[];
  };
}

/* ═══ COUNTRY CAMPAIGN ═══ */

export function generateCountryCampaign(
  country: CountryData,
  data: WorldBackbone
): CampaignKit {
  const c = country;
  const name = c.name_en;
  const under = c.hunger.undernourishment_pct;
  const docs = c.health.doctors_per_1000;
  const childMort = c.health.child_mortality_under5_per1k;
  const literacy = c.education.literacy_rate_pct;
  const co2 = c.climate.co2_per_capita_t;
  const conflict = c.conflict.intensity_1to5;
  const gini = c.inequality.gini;
  const safeSan = c.water_sanitation.safe_sanitation_pct;
  const poverty = c.poverty.headcount_365_pct;
  const milPct = c.military.pct_gdp;
  const healthPct = c.health.expenditure_pct_gdp;

  // Tweets — devastating framing using the country's real numbers
  const tweets: CampaignTweet[] = [];

  const t1 = `${name} has ${docs !== null && docs !== undefined ? docs.toFixed(1) : "?"} doctors per 1,000 people. The WHO minimum is 4.45.

That's not a gap. That's a choice the world makes every day.

Ending global hunger costs $93B/year = 14 days of military spending.

[v-for-x]`;
  tweets.push({ text: t1, charCount: t1.length });

  if (under !== null && under > 10) {
    const t = `${under.toFixed(0)}% of ${name}'s population is undernourished. That's ${formatPct(under)} of a nation going hungry while the world spends $2.4T/year on weapons.

14 days of that spending ends hunger globally.

[v-for-x]`;
    tweets.push({ text: t, charCount: t.length });
  }

  if (childMort !== null && childMort > 20) {
    const t = `In ${name}, ${childMort.toFixed(1)} of every 1,000 children die before age 5.

In Norway it's 2.2.

This isn't natural. It's political. $176B/year = 27 days of military spending = healthcare for every person in the poorest countries.

[v-for-x]`;
    tweets.push({ text: t, charCount: t.length });
  }

  if (milPct !== null && healthPct !== null && milPct > healthPct) {
    const t = `${name} spends ${milPct.toFixed(1)}% of GDP on military but only ${healthPct.toFixed(1)}% on health.

The ratio is ${(milPct / healthPct).toFixed(1)}:1 — guns over lives.

$93B/year would end global hunger. That's 0.9% of world military spending.

[v-for-x]`;
    tweets.push({ text: t, charCount: t.length });
  }

  if (poverty !== null && poverty > 20) {
    const t = `${poverty.toFixed(0)}% of ${name} lives in extreme poverty — under $3.65/day.

Meanwhile, the world's billionaires hold $15T. A 2% tax = $313B/year.

That's enough to end extreme poverty AND fund water, electricity, and education for everyone.

[v-for-x]`;
    tweets.push({ text: t, charCount: t.length });
  }

  // Email template
  const emailBody = `Dear [Representative Name],

I am writing to urge action on the humanitarian crisis in ${name}.

The data is clear:

• Undernourishment: ${under !== null ? under.toFixed(1) + "%" : "N/A"}
• Doctors per 1,000: ${docs !== null && docs !== undefined ? docs.toFixed(2) : "N/A"} (WHO minimum: 4.45)
• Child mortality (under 5): ${childMort !== null ? childMort.toFixed(1) + " per 1,000" : "N/A"}
• Safe sanitation access: ${safeSan !== null ? safeSan.toFixed(0) + "%" : "N/A"}
• Extreme poverty ($3.65/day): ${poverty !== null ? poverty.toFixed(0) + "%" : "N/A"}
• Conflict intensity: ${conflict}/5

${conflict >= 3 ? "This country is in an active conflict zone where humanitarian access is severely restricted. " : ""}${c.is_hotspot ? name + " is classified as a WFP hunger hotspot. " : ""}

Ending global hunger costs $93 billion per year — 0.9% of world military spending, or 14 days of it. The combined SDG equation — safe water, healthcare, electricity, and education for every human — costs $422B/year, just 64 days of military spending.

I urge you to:

1. Support increased humanitarian funding for ${name} and similar crisis zones.
2. Back the reallocation of military spending toward SDG targets.
3. Hold accountable those who weaponize hunger and block humanitarian aid.

The money exists. The solutions are proven. What's missing is political will.

Sincerely,
[Your Name]
[Your Address]
[Your Contact]`;

  // Brief
  const keyStats: { label: string; value: string }[] = [
    { label: "Undernourishment", value: under !== null ? `${under.toFixed(1)}%` : "N/A" },
    { label: "Doctors / 1,000", value: docs !== null && docs !== undefined ? docs.toFixed(2) : "N/A" },
    { label: "Child Mortality / 1k", value: childMort !== null ? childMort.toFixed(1) : "N/A" },
    { label: "Safe Sanitation", value: safeSan !== null ? `${safeSan.toFixed(0)}%` : "N/A" },
    { label: "Extreme Poverty", value: poverty !== null ? `${poverty.toFixed(0)}%` : "N/A" },
    { label: "Literacy Rate", value: literacy !== null ? `${literacy.toFixed(0)}%` : "N/A" },
    { label: "CO2 / Capita", value: co2 !== null ? `${co2.toFixed(2)}t` : "N/A" },
    { label: "Gini Coefficient", value: gini !== null ? gini.toFixed(1) : "N/A" },
    { label: "Conflict Level", value: `${conflict}/5` },
    { label: "Military % GDP", value: milPct !== null ? `${milPct.toFixed(1)}%` : "N/A" },
  ];

  return {
    tweets,
    email: {
      subject: `ACT NOW: Humanitarian crisis in ${name} — ${under !== null ? under.toFixed(0) + "% undernourished" : "data demands response"}`,
      body: emailBody,
    },
    brief: {
      title: `${name.toUpperCase()} — CRISIS BRIEF`,
      summary: `${name} faces ${c.is_hotspot ? "a WFP-classified hunger hotspot" : "significant humanitarian challenges"}. ${conflict >= 3 ? "Active conflict (Level " + conflict + "/5) compounds the crisis. " : ""}The data below is drawn from ${data.metadata.sources.length} official sources covering ${data.metadata.total_countries} countries.`,
      keyStats,
      callToAction: `Ending the global hunger crisis costs $93B/year — 14 days of world military spending. The 6-equation combined fix (water + health + energy + education) costs $422B/year = 64 days. Contact your representatives. Share this data. Demand reallocation.`,
      sources: data.metadata.sources,
    },
  };
}

/* ═══ SDG EQUATION CAMPAIGN ═══ */

export function generateEquationCampaign(
  eqKey: string,
  eq: SdgEquation,
  meta: { quick_wins_total_billion?: number; quick_wins_pct_military?: number; quick_wins_days_military?: number }
): CampaignKit {
  const tweets: CampaignTweet[] = [];

  const t1 = `${eq.moral_framing}

The cost: ${eq.cost.annual_trillion ? "$" + eq.cost.annual_trillion + "T" : "$" + eq.cost.annual_billion + "B"}/year.
That's ${eq.affordability.pct_military}% of world military spending.
${eq.affordability.days_of_military} days.

[v-for-x]`;
  tweets.push({ text: t1, charCount: t1.length });

  const gapEntries = Object.entries(eq.current_gap).filter(([, v]) => typeof v === "string");
  const gapLabel = gapEntries.find(([k]) => k === "label")?.[1] as string | undefined;
  if (gapLabel) {
    const t = `${gapLabel}

Fix it for ${eq.cost.annual_trillion ? "$" + eq.cost.annual_trillion + "T" : "$" + eq.cost.annual_billion + "B"}/year.
= ${eq.affordability.days_of_military} days of what the world spends on weapons.

[v-for-x]`;
    tweets.push({ text: t, charCount: t.length });
  }

  if (meta.quick_wins_total_billion) {
    const t = `Here's the full equation:

$${meta.quick_wins_total_billion}B/year = safe water + healthcare + electricity + education for every human alive.

That's ${meta.quick_wins_pct_military}% of military spending. ${meta.quick_wins_days_military} days.

We can afford this 6 times over.

[v-for-x]`;
    tweets.push({ text: t, charCount: t.length });
  }

  const emailBody = `Dear [Representative Name],

I am writing about ${eq.title} — ${eq.subtitle}.

The global gap:
${gapLabel ?? Object.entries(eq.current_gap).map(([k, v]) => `- ${k.replace(/_/g, " ")}: ${v}`).join("\n")}

The solution costs ${eq.cost.annual_trillion ? "$" + eq.cost.annual_trillion + "T" : "$" + eq.cost.annual_billion + "B"}/year.
That is ${eq.affordability.pct_military}% of world military spending, or ${eq.affordability.days_of_military} days of it.

${eq.affordability.framing}

The interventions are proven and evidence-backed:
${eq.interventions.map((iv) => `- ${iv.name}: ${iv.roi_note}`).join("\n")}

I urge you to support funding for these interventions and the reallocation of military spending toward human needs.

Sincerely,
[Your Name]`;

  return {
    tweets,
    email: {
      subject: `ACT NOW: ${eq.title} — ${eq.cost.annual_trillion ? "$" + eq.cost.annual_trillion + "T" : "$" + eq.cost.annual_billion + "B"}/year = ${eq.affordability.days_of_military} days of military spending`,
      body: emailBody,
    },
    brief: {
      title: `${eq.title.toUpperCase()} — THE EQUATION`,
      summary: eq.moral_framing,
      keyStats: [
        { label: "Annual Cost", value: eq.cost.annual_trillion ? "$" + eq.cost.annual_trillion + "T" : "$" + eq.cost.annual_billion + "B" },
        { label: "% of Military", value: `${eq.affordability.pct_military}%` },
        { label: "Days of Military", value: `${eq.affordability.days_of_military}` },
        { label: "% of World GDP", value: `${eq.affordability.pct_world_gdp}%` },
        { label: "Status", value: eq.status.replace(/_/g, " ") },
        { label: "SDG Target", value: eq.sdg_target },
      ],
      callToAction: eq.affordability.framing,
      sources: [eq.cost.source],
    },
  };
}
