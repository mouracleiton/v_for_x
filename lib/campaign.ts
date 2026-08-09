/**
 * V FOR X — Campaign kit generator v2
 *
 * Analyzes a country's actual data to identify its most urgent needs,
 * then generates a structured tweet thread that reads like a professional
 * policy analyst wrote it. Zero cognitive effort for the person posting.
 *
 * Each tweet follows a narrative arc:
 * 1. HOOK — the most shocking stat
 * 2-5. EVIDENCE — one need per tweet, with framing
 * 6. THE SOLUTION — what it costs to fix
 * 7. THE DEMAND — specific call to action
 */

import type { CountryData, SdgEquation, WorldBackbone } from "./types";
import { detectLang, PHRASES, type CampaignLang, needTemplate, fillTemplate } from "./campaign-i18n";

export interface CampaignTweet {
  text: string;
  charCount: number;
  type: "hook" | "evidence" | "solution" | "demand";
  icon: string;
}

export interface CampaignKit {
  tweets: CampaignTweet[];
  needs: NeedAnalysis[];
  whatsapp: string;
  instagram: string;
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

/* ═══ NEED ANALYSIS ENGINE ═══ */

export interface NeedAnalysis {
  id: string;
  category: string;
  severity: number;
  value: number;
  threshold: number;
  direction: "bad_high" | "bad_low";
  emoji: string;
  headline: string;
  context: string;
  comparison: string;
}

interface MetricDef {
  path: string;
  threshold: number;
  direction: "bad_high" | "bad_low";
  category: string;
  emoji: string;
  /** How to compute popV for context template: "pct" = pop*v/100, "inv_pct" = pop*(100-v)/100, "none" = no popV */
  popVCalc: "pct" | "inv_pct" | "none";
}

const POP_MOON = 211; // Brazil pop for comparison reference

const METRICS: MetricDef[] = [
  {
    path: "hunger.undernourishment_pct", threshold: 5, direction: "bad_high",
    category: "HUNGER", emoji: "🍽️",
    popVCalc: "pct",
  },
  {
    path: "hunger.child_stunting_pct", threshold: 20, direction: "bad_high",
    category: "CHILD HEALTH", emoji: "🧒",
    popVCalc: "pct",
  },
  {
    path: "hunger.child_wasting_pct", threshold: 5, direction: "bad_high",
    category: "CHILD HEALTH", emoji: "🧒",
    popVCalc: "pct",
  },
  {
    path: "hunger.famine_risk_1to5", threshold: 3, direction: "bad_high",
    category: "FAMINE", emoji: "💀",
    popVCalc: "none",
  },
  {
    path: "hunger.food_insecurity_mod_severe_pct", threshold: 25, direction: "bad_high",
    category: "FOOD SECURITY", emoji: "饥饿",
    popVCalc: "pct",
  },
  {
    path: "food_security.severe_food_insecurity_m", threshold: 3, direction: "bad_high",
    category: "FOOD SECURITY", emoji: "🍽️",
    popVCalc: "none",
  },
  {
    path: "conflict.intensity_1to5", threshold: 3, direction: "bad_high",
    category: "CONFLICT", emoji: "⚔️",
    popVCalc: "none",
  },
  {
    path: "conflict.displacement_m", threshold: 0.5, direction: "bad_high",
    category: "DISPLACEMENT", emoji: "🏃",
    popVCalc: "none",
  },
  {
    path: "migration.forcibly_displaced", threshold: 1_000_000, direction: "bad_high",
    category: "DISPLACEMENT", emoji: "🏠",
    popVCalc: "none",
  },
  {
    path: "health.child_mortality_under5_per1k", threshold: 25, direction: "bad_high",
    category: "CHILD SURVIVAL", emoji: "👶",
    popVCalc: "none",
  },
  {
    path: "health.maternal_mortality_per100k", threshold: 200, direction: "bad_high",
    category: "MATERNAL HEALTH", emoji: "🤰",
    popVCalc: "none",
  },
  {
    path: "health.doctors_per_1000", threshold: 4.45, direction: "bad_low",
    category: "HEALTHCARE", emoji: "⚕️",
    popVCalc: "none",
  },
  {
    path: "health.life_expectancy", threshold: 65, direction: "bad_low",
    category: "LIFE EXPECTANCY", emoji: "⏳",
    popVCalc: "none",
  },
  {
    path: "education.literacy_rate_pct", threshold: 75, direction: "bad_low",
    category: "EDUCATION", emoji: "📚",
    popVCalc: "inv_pct",
  },
  {
    path: "water_sanitation.basic_access_pct", threshold: 80, direction: "bad_low",
    category: "WATER", emoji: "💧",
    popVCalc: "inv_pct",
  },
  {
    path: "water_sanitation.safe_sanitation_pct", threshold: 35, direction: "bad_low",
    category: "SANITATION", emoji: "🚽",
    popVCalc: "none",
  },
  {
    path: "poverty.headcount_365_pct", threshold: 15, direction: "bad_high",
    category: "EXTREME POVERTY", emoji: "💸",
    popVCalc: "pct",
  },
  {
    path: "security.homicide_rate_per100k", threshold: 10, direction: "bad_high",
    category: "VIOLENCE", emoji: "🔫",
    popVCalc: "none",
  },
  {
    path: "governance.corruption_perceptions_index", threshold: 40, direction: "bad_low",
    category: "CORRUPTION", emoji: "🤝",
    popVCalc: "none",
  },
  {
    path: "governance.electoral_democracy_index", threshold: 0.3, direction: "bad_low",
    category: "DEMOCRACY", emoji: "🗳️",
    popVCalc: "none",
  },
  {
    path: "energy.no_access_electricity_m", threshold: 2, direction: "bad_high",
    category: "ENERGY", emoji: "⚡",
    popVCalc: "none",
  },
  {
    path: "employment.unemployment_pct", threshold: 15, direction: "bad_high",
    category: "EMPLOYMENT", emoji: "🏭",
    popVCalc: "none",
  },
  {
    path: "employment.youth_unemployment_pct", threshold: 25, direction: "bad_high",
    category: "YOUTH", emoji: "青年的",
    popVCalc: "none",
  },
  {
    path: "inequality.gini", threshold: 45, direction: "bad_high",
    category: "INEQUALITY", emoji: "⚖️",
    popVCalc: "none",
  },
  {
    path: "environment.air_pollution_pm25_ugm3", threshold: 25, direction: "bad_high",
    category: "ENVIRONMENT", emoji: "🏭",
    popVCalc: "none",
  },
  {
    path: "health.hiv_prevalence_pct", threshold: 3, direction: "bad_high",
    category: "PUBLIC HEALTH", emoji: "🦠",
    popVCalc: "none",
  },
  {
    path: "health.tuberculosis_per100k", threshold: 200, direction: "bad_high",
    category: "PUBLIC HEALTH", emoji: "🦠",
    popVCalc: "none",
  },
  {
    path: "justice.prison_overcrowding_pct", threshold: 100, direction: "bad_high",
    category: "JUSTICE", emoji: "🔒",
    popVCalc: "none",
  },
];

function getVal(country: CountryData, path: string): number | null {
  const parts = path.split(".");
  let obj: unknown = country;
  for (const p of parts) {
    if (typeof obj !== "object" || obj === null) return null;
    obj = (obj as Record<string, unknown>)[p];
  }
  if (typeof obj === "number") return obj;
  return null;
}

/** Analyze a country and return its most urgent needs, sorted by severity */
export function analyzeNeeds(country: CountryData, lang?: CampaignLang): NeedAnalysis[] {
  const cl = lang ?? "en";
  const pop = country.demographics.population / 1_000_000;
  const needs: NeedAnalysis[] = [];

  for (const m of METRICS) {
    const val = getVal(country, m.path);
    if (val === null) continue;

    let severity = 0;
    let isCrisis = false;

    if (m.direction === "bad_high") {
      severity = val - m.threshold;
      if (val > m.threshold) isCrisis = true;
    } else {
      severity = m.threshold - val;
      if (val < m.threshold) isCrisis = true;
    }

    if (!isCrisis) continue;

    // Compute popV based on metric type
    let popV: number | undefined;
    if (m.popVCalc === "pct") {
      popV = pop * val / 100;
    } else if (m.popVCalc === "inv_pct") {
      popV = pop * (100 - val) / 100;
    }
    // For "none", popV stays undefined

    const tpl = needTemplate(m.path, cl);
    const headline = fillTemplate(tpl.headline, val, popV);
    const context = fillTemplate(tpl.context, val, popV);

    needs.push({
      id: m.path.split(".").pop() ?? m.path,
      category: m.category,
      severity,
      value: val,
      threshold: m.threshold,
      direction: m.direction,
      emoji: m.emoji,
      headline,
      context,
      comparison: "",
    });
  }

  return needs.sort((a, b) => b.severity - a.severity);
}

/* ═══ TWEET THREAD GENERATOR ═══ */

export function generateCountryCampaign(
  country: CountryData,
  data: WorldBackbone,
  langOverride?: CampaignLang
): CampaignKit {
  const lang = langOverride ?? detectLang(country.iso3);
  const P = PHRASES[lang] ?? PHRASES.en;
  const name = country.name_en;
  const pop = country.demographics.population / 1_000_000;
  const needs = analyzeNeeds(country, lang);
  const topNeeds = needs.slice(0, 5);

  // Military vs health framing
  const milPct = country.military.pct_gdp;
  const healthPct = country.health.expenditure_pct_gdp;
  const milGtHealth = milPct != null && healthPct != null && milPct > healthPct;

  // Global context
  const globalHunger = data.global_indicators.hunger.undernourished_2024_m;
  const globalMilitaryT = data.global_indicators.military.global_spending_yr_t;
  const hungerCost = data.global_indicators.hunger.cost_to_eradicate_billion_yr;

  const tweets: CampaignTweet[] = [];

  // ── TWEET 1: HOOK ──
  let hookText: string;
  if (topNeeds.length > 0) {
    const worst = topNeeds[0];
    hookText = P.threadHook(name, worst.headline, worst.context);
  } else {
    hookText = P.threadHook(name, P.noCrisisHeadline, P.noCrisisContext);
  }
  tweets.push({ text: hookText, charCount: hookText.length, type: "hook", icon: "🧵" });

  // ── TWEETS 2-N: EVIDENCE (one per need) ──
  for (const need of topNeeds.slice(0, 4)) {
    const text = P.threadNeed(need.category, name, need.headline, need.context);
    tweets.push({ text, charCount: text.length, type: "evidence", icon: need.emoji });
  }

  // ── MILITARY vs HEALTH (if applicable) ──
  if (milGtHealth) {
    const mil = country.military.expenditure_usd ?? 0;
    const dailyMil = mil / 1e9 / 365;
    const undernourishedM = country.hunger.undernourishment_pct
      ? pop * country.hunger.undernourishment_pct / 100
      : 0;
    const costPerMillion = 93 / 667;
    const costFix = undernourishedM * costPerMillion;
    const days = dailyMil > 0 ? costFix / dailyMil : 0;
    const daysStr = days < 1 ? `${(days * 24).toFixed(0)}h` : `${days.toFixed(1)} dias`;
    const text = P.threadMilitary(name, milPct ?? 0, daysStr);
    tweets.push({ text, charCount: text.length, type: "evidence", icon: "💰" });
  }

  // ── THE SOLUTION ──
  const solutionText = P.threadSolution(String(hungerCost), String(globalMilitaryT), "422");
  tweets.push({ text: solutionText, charCount: solutionText.length, type: "solution", icon: "🔧" });

  // ── THE DEMAND ──
  const demandText = P.threadDemand(name, country.is_hotspot);
  tweets.push({ text: demandText, charCount: demandText.length, type: "demand", icon: "📢" });

  // ── WHATSAPP ──
  const whatsapp = topNeeds.length > 0
    ? `*${P.whatsappIntro(name)}*\n\n${topNeeds[0].headline}.\n${topNeeds[0].context}\n\n${P.worldSpends} $${globalMilitaryT}T/${P.yearUnit} ${P.onWeapons}. ${P.endingHunger} = $${hungerCost}B = 14 ${P.daysUnit}.\n\n${P.whatsappCTA}\n\nmouracleiton.github.io/v_for_x`
    : `${name} data briefing: mouracleiton.github.io/v_for_x`;

  // ── INSTAGRAM ──
  const igNeeds = topNeeds.slice(0, 3).map((n) => `${n.emoji} ${n.headline}`).join("\n");
  const instagram = `${name} 📍\n\n${igNeeds}\n\n${P.globalContext}\n\n$${hungerCost}B/${P.yearUnit} = 14 ${P.daysMilitarySpending}.\n\n${P.instagramTags(name)}`;

  // ── EMAIL ──
  const emailBody = `Dear [Representative Name],

I am writing to urge action on the humanitarian crisis in ${name}.

The data is unambiguous. ${name}'s most urgent needs:

${topNeeds.map((n, i) => `${i + 1}. ${n.category}: ${n.headline}\n   ${n.context}`).join("\n\n")}

${country.is_hotspot ? `${name} is classified as a WFP hunger hotspot.\n\n` : ""}Ending global hunger costs $${hungerCost} billion per year — 0.9% of world military spending, or 14 days of it. The combined fix — safe water, healthcare, electricity, and education for every human — costs $422B/year, just 64 days of military spending.

I urge you to:
1. Support increased humanitarian funding for ${name} and similar crisis zones.
2. Back the reallocation of military spending toward SDG targets.
3. Hold accountable those who weaponize hunger and block humanitarian access.

The money exists. The solutions are proven. What's missing is political will — and that's where you come in.

Sincerely,
[Your Name]
[Your Address]
[Your Contact]`;

  // ── BRIEF ──
  const keyStats = topNeeds.map((n) => ({
    label: n.category,
    value: n.direction === "bad_high"
      ? `${n.value.toFixed(n.value > 100 ? 0 : 1)} (threshold: ${n.threshold})`
      : `${n.value.toFixed(n.value > 100 ? 0 : 1)} (minimum: ${n.threshold})`,
  }));

  return {
    tweets,
    needs,
    whatsapp,
    instagram,
    email: {
      subject: `URGENT: ${name} crisis — ${topNeeds[0]?.category ?? "humanitarian"} demands response`,
      body: emailBody,
    },
    brief: {
      title: `${name.toUpperCase()} — CRISIS BRIEF`,
      summary: `${name} has ${needs.length} critical needs identified by data from ${data.metadata.sources.length} official sources. ${topNeeds[0] ? `The most urgent: ${topNeeds[0].headline}.` : ""} ${country.conflict.intensity_1to5 >= 3 ? `Active conflict (Level ${country.conflict.intensity_1to5}/5) compounds every dimension of the crisis.` : ""}`,
      keyStats,
      callToAction: `Ending global hunger costs $${hungerCost}B/year = 14 days of military spending. Contact your representatives. Share this data. Demand reallocation.`,
      sources: data.metadata.sources,
    },
  };
}

/* ═══ SDG EQUATION CAMPAIGN (updated for v2 interface) ═══ */

export function generateEquationCampaign(
  eqKey: string,
  eq: SdgEquation,
  meta: { quick_wins_total_billion?: number; quick_wins_pct_military?: number; quick_wins_days_military?: number }
): CampaignKit {
  const tweets: CampaignTweet[] = [];

  const t1Text = `${eq.moral_framing}\n\nThe cost: ${eq.cost.annual_trillion ? "$" + eq.cost.annual_trillion + "T" : "$" + eq.cost.annual_billion + "B"}/year.\nThat's ${eq.affordability.pct_military}% of world military spending.\n${eq.affordability.days_of_military} days.\n\n[v-for-x]`;
  tweets.push({ text: t1Text, charCount: t1Text.length, type: "hook", icon: "🧵" });

  const gapEntries = Object.entries(eq.current_gap).filter(([, v]) => typeof v === "string");
  const gapLabel = gapEntries.find(([k]) => k === "label")?.[1] as string | undefined;
  if (gapLabel) {
    const text = `${gapLabel}\n\nFix it for ${eq.cost.annual_trillion ? "$" + eq.cost.annual_trillion + "T" : "$" + eq.cost.annual_billion + "B"}/year.\n= ${eq.affordability.days_of_military} days of what the world spends on weapons.\n\n[v-for-x]`;
    tweets.push({ text, charCount: text.length, type: "evidence", icon: "📊" });
  }

  if (meta.quick_wins_total_billion) {
    const text = `Here's the full equation:\n\n$${meta.quick_wins_total_billion}B/year = safe water + healthcare + electricity + education for every human alive.\n\nThat's ${meta.quick_wins_pct_military}% of military spending. ${meta.quick_wins_days_military} days.\n\nWe can afford this.\n\n[v-for-x]`;
    tweets.push({ text, charCount: text.length, type: "solution", icon: "🔧" });
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
    needs: [],
    whatsapp: `${eq.title}: ${eq.moral_framing}\n\nCost: $${eq.cost.annual_billion}B/yr = ${eq.affordability.days_of_military} days of military spending.\n\nShare if you think we can afford this.\nmouracleiton.github.io/v_for_x`,
    instagram: `${eq.title}\n\n${eq.moral_framing}\n\n$${eq.cost.annual_billion}B/year = ${eq.affordability.days_of_military} days of military spending.\n\n#${eq.sdg} #SDG #ZeroHunger #DataForGood #VForX`,
    email: {
      subject: `ACT NOW: ${eq.title} — $${eq.cost.annual_billion}B/year = ${eq.affordability.days_of_military} days of military spending`,
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
