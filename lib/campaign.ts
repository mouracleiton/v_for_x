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
  headline: (val: number) => string;
  context: (val: number, pop: number) => string;
}

const POP_MOON = 211; // Brazil pop for comparison reference

const METRICS: MetricDef[] = [
  {
    path: "hunger.undernourishment_pct", threshold: 5, direction: "bad_high",
    category: "HUNGER", emoji: "🍽️",
    headline: (v) => `${v.toFixed(0)}% of the population is undernourished`,
    context: (v, pop) => `That's ${(pop * v / 100).toFixed(1)} million people who don't have enough to eat — every single day.`,
  },
  {
    path: "hunger.child_stunting_pct", threshold: 20, direction: "bad_high",
    category: "CHILD HEALTH", emoji: "🧒",
    headline: (v) => `${v.toFixed(0)}% of children are stunted — permanently damaged by malnutrition`,
    context: (v, pop) => `These children will never reach their full physical or cognitive potential. This is irreversible.`,
  },
  {
    path: "hunger.child_wasting_pct", threshold: 5, direction: "bad_high",
    category: "CHILD HEALTH", emoji: "🧒",
    headline: (v) => `${v.toFixed(0)}% of children suffer from acute malnutrition (wasting)`,
    context: (v, pop) => `These children are dying right now. Wasting means their bodies are consuming themselves to stay alive.`,
  },
  {
    path: "hunger.famine_risk_1to5", threshold: 3, direction: "bad_high",
    category: "FAMINE", emoji: "💀",
    headline: (v) => `Famine risk: ${v.toFixed(0)}/5 — catastrophe is imminent`,
    context: () => `This is the highest level of food emergency. People are already dying. International response is needed NOW.`,
  },
  {
    path: "hunger.food_insecurity_mod_severe_pct", threshold: 25, direction: "bad_high",
    category: "FOOD SECURITY", emoji: "饥饿",
    headline: (v) => `${v.toFixed(0)}% of the population faces moderate or severe food insecurity`,
    context: (v, pop) => `${(pop * v / 100).toFixed(1)} million people don't know where their next meal is coming from.`,
  },
  {
    path: "food_security.severe_food_insecurity_m", threshold: 3, direction: "bad_high",
    category: "FOOD SECURITY", emoji: "🍽️",
    headline: (v) => `${v.toFixed(1)} million people in severe food insecurity`,
    context: () => `These people have run out of food. They are skipping meals for days. Children are the most affected.`,
  },
  {
    path: "conflict.intensity_1to5", threshold: 3, direction: "bad_high",
    category: "CONFLICT", emoji: "⚔️",
    headline: (v) => `Active armed conflict — intensity level ${v.toFixed(0)}/5`,
    context: () => `War blocks food, medicine, and aid from reaching civilians. You cannot end hunger in a war zone without peace.`,
  },
  {
    path: "conflict.displacement_m", threshold: 0.5, direction: "bad_high",
    category: "DISPLACEMENT", emoji: "🏃",
    headline: (v) => `${v.toFixed(1)} million people displaced by conflict`,
    context: () => `These families left everything behind. They now live in camps, with no income, no land, no future — dependent on aid that is being cut.`,
  },
  {
    path: "migration.forcibly_displaced", threshold: 1_000_000, direction: "bad_high",
    category: "DISPLACEMENT", emoji: "🏠",
    headline: (v) => `${(v / 1_000_000).toFixed(1)} million people forcibly displaced`,
    context: () => `Refugees, asylum seekers, and internally displaced. The largest displacement crisis most people have never heard of.`,
  },
  {
    path: "health.child_mortality_under5_per1k", threshold: 25, direction: "bad_high",
    category: "CHILD SURVIVAL", emoji: "👶",
    headline: (v) => `${v.toFixed(1)} out of every 1,000 children die before age 5`,
    context: () => `In Norway it's 2.2. In Japan it's 1.9. This gap is not natural — it's a policy choice.`,
  },
  {
    path: "health.maternal_mortality_per100k", threshold: 200, direction: "bad_high",
    category: "MATERNAL HEALTH", emoji: "🤰",
    headline: (v) => `${v.toFixed(0)} mothers die per 100,000 births`,
    context: () => `Most of these deaths are preventable with basic healthcare that costs less than a single missile.`,
  },
  {
    path: "health.doctors_per_1000", threshold: 4.45, direction: "bad_low",
    category: "HEALTHCARE", emoji: "⚕️",
    headline: (v) => `Only ${v.toFixed(1)} doctors per 1,000 people (WHO minimum: 4.45)`,
    context: () => `When people get sick, there's often no one to help. This is why preventable diseases become death sentences.`,
  },
  {
    path: "health.life_expectancy", threshold: 65, direction: "bad_low",
    category: "LIFE EXPECTANCY", emoji: "⏳",
    headline: (v) => `Average life expectancy: ${v.toFixed(0)} years`,
    context: () => `People here die 15-20 years earlier than they should. Not from fate — from a system that chose not to invest in them.`,
  },
  {
    path: "education.literacy_rate_pct", threshold: 75, direction: "bad_low",
    category: "EDUCATION", emoji: "📚",
    headline: (v) => `Only ${v.toFixed(0)}% of adults can read and write`,
    context: (v, pop) => `${(pop * (100 - v) / 100).toFixed(1)} million adults are illiterate. Education is the escape hatch — and it's been closed.`,
  },
  {
    path: "water_sanitation.basic_access_pct", threshold: 80, direction: "bad_low",
    category: "WATER", emoji: "💧",
    headline: (v) => `Only ${v.toFixed(0)}% of the population has basic drinking water access`,
    context: (v, pop) => `${(pop * (100 - v) / 100).toFixed(1)} million people drink unsafe water every day. Children die from diarrhea — a disease of poverty.`,
  },
  {
    path: "water_sanitation.safe_sanitation_pct", threshold: 35, direction: "bad_low",
    category: "SANITATION", emoji: "🚽",
    headline: (v) => `Only ${v.toFixed(0)}% has safely managed sanitation`,
    context: () => `Without toilets and wastewater treatment, diseases spread. This is a 19th-century problem in the 21st century.`,
  },
  {
    path: "poverty.headcount_365_pct", threshold: 15, direction: "bad_high",
    category: "EXTREME POVERTY", emoji: "💸",
    headline: (v) => `${v.toFixed(0)}% of the population lives on less than $3.65/day`,
    context: (v, pop) => `${(pop * v / 100).toFixed(1)} million people in extreme poverty. The global cost to fix this is less than what the world spends on weapons in a month.`,
  },
  {
    path: "security.homicide_rate_per100k", threshold: 10, direction: "bad_high",
    category: "VIOLENCE", emoji: "🔫",
    headline: (v) => `${v.toFixed(1)} homicides per 100,000 people`,
    context: () => `That's higher than many active war zones. Violence is a public health crisis that goes untreated.`,
  },
  {
    path: "governance.corruption_perceptions_index", threshold: 40, direction: "bad_low",
    category: "CORRUPTION", emoji: "🤝",
    headline: (v) => `Corruption Perception Index: ${v.toFixed(0)}/100 (100 = clean)`,
    context: () => `Aid money, tax revenue, natural resource wealth — it disappears into private pockets instead of public services.`,
  },
  {
    path: "governance.electoral_democracy_index", threshold: 0.3, direction: "bad_low",
    category: "DEMOCRACY", emoji: "🗳️",
    headline: (v) => `Democracy Index: ${v.toFixed(2)} (0 = authoritarian, 1 = full democracy)`,
    context: () => `Without democratic accountability, there is no pressure to fix any of these problems. The people cannot vote for change.`,
  },
  {
    path: "energy.no_access_electricity_m", threshold: 2, direction: "bad_high",
    category: "ENERGY", emoji: "⚡",
    headline: (v) => `${v.toFixed(1)} million people have NO electricity`,
    context: () => `No light to study by. No refrigeration for vaccines. No pump for clean water. Electricity is the foundation of everything.`,
  },
  {
    path: "employment.unemployment_pct", threshold: 15, direction: "bad_high",
    category: "EMPLOYMENT", emoji: "🏭",
    headline: (v) => `${v.toFixed(0)}% unemployment`,
    context: () => `No jobs means no income, no food security, no future. Youth unemployment drives migration and unrest.`,
  },
  {
    path: "employment.youth_unemployment_pct", threshold: 25, direction: "bad_high",
    category: "YOUTH", emoji: "青年的",
    headline: (v) => `${v.toFixed(0)}% youth unemployment`,
    context: () => `When young people have no future, they migrate, riot, or join armed groups. This is a security issue disguised as an economic one.`,
  },
  {
    path: "inequality.gini", threshold: 45, direction: "bad_high",
    category: "INEQUALITY", emoji: "⚖️",
    headline: (v) => `Gini coefficient: ${v.toFixed(0)} (100 = maximum inequality)`,
    context: () => `The gap between rich and poor is extreme. Wealth concentrates at the top while millions lack food, water, and healthcare.`,
  },
  {
    path: "environment.air_pollution_pm25_ugm3", threshold: 25, direction: "bad_high",
    category: "ENVIRONMENT", emoji: "🏭",
    headline: (v) => `Air pollution: ${v.toFixed(0)} µg/m³ PM2.5 (WHO limit: 15)`,
    context: () => `People are breathing toxic air. This causes heart disease, lung cancer, and cognitive damage in children — silently, every day.`,
  },
  {
    path: "health.hiv_prevalence_pct", threshold: 3, direction: "bad_high",
    category: "PUBLIC HEALTH", emoji: "🦠",
    headline: (v) => `HIV prevalence: ${v.toFixed(1)}% of the adult population`,
    context: () => `A preventable, treatable disease that still kills because of stigma, lack of testing, and drug shortages.`,
  },
  {
    path: "health.tuberculosis_per100k", threshold: 200, direction: "bad_high",
    category: "PUBLIC HEALTH", emoji: "🦠",
    headline: (v) => `${v.toFixed(0)} TB cases per 100,000 people`,
    context: () => `Tuberculosis is curable for a few dollars. People die because the health system doesn't reach them in time.`,
  },
  {
    path: "justice.prison_overcrowding_pct", threshold: 100, direction: "bad_high",
    category: "JUSTICE", emoji: "🔒",
    headline: (v) => `Prison overcrowding: ${v.toFixed(0)}% of capacity`,
    context: () => `Cells built for 4 hold 12. Disease, violence, and death are routine. Pre-trial detainees — innocent until proven guilty — suffer most.`,
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
export function analyzeNeeds(country: CountryData): NeedAnalysis[] {
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

    needs.push({
      id: m.path.split(".").pop() ?? m.path,
      category: m.category,
      severity,
      value: val,
      threshold: m.threshold,
      direction: m.direction,
      emoji: m.emoji,
      headline: m.headline(val),
      context: m.context(val, pop),
      comparison: "",
    });
  }

  return needs.sort((a, b) => b.severity - a.severity);
}

/* ═══ TWEET THREAD GENERATOR ═══ */

export function generateCountryCampaign(
  country: CountryData,
  data: WorldBackbone
): CampaignKit {
  const name = country.name_en;
  const pop = country.demographics.population / 1_000_000;
  const needs = analyzeNeeds(country);
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
    hookText = `${worst.emoji} ${name.toUpperCase()} — THE REALITY\n\n${worst.headline}.\n\n${worst.context}\n\nThis is not fate. This is policy.\n\nA thread on what ${name} actually needs ↓`;
  } else {
    hookText = `${name} doesn't appear in the crisis data.\n\nBut that doesn't mean there's nothing to fix. Every country has gaps. Here's what the data says ↓`;
  }
  tweets.push({ text: hookText, charCount: hookText.length, type: "hook", icon: "🧵" });

  // ── TWEETS 2-N: EVIDENCE (one per need) ──
  for (const need of topNeeds.slice(0, 4)) {
    const text = `${need.emoji} ${need.category}\n\n${name}: ${need.headline}.\n\n${need.context}\n\nThe world has the resources to fix this. We choose not to.`;
    tweets.push({ text, charCount: text.length, type: "evidence", icon: need.emoji });
  }

  // ── MILITARY vs HEALTH (if applicable) ──
  if (milGtHealth) {
    const mil = country.military.expenditure_usd ?? 0;
    const dailyMil = mil / 1e9 / 365;
    const undernourishedM = country.hunger.undernourishment_pct
      ? pop * country.hunger.undernourishment_pct / 100
      : 0;
    const costPerMillion = 93 / 667; // $B per million hungry
    const costFix = undernourishedM * costPerMillion;
    const days = dailyMil > 0 ? costFix / dailyMil : 0;

    const text = `💰 THE COST OF INACTION\n\n${name} spends ${(mil / 1e9).toFixed(1)}% of GDP on military — more than on health.\n\nIt would take ${days < 1 ? `${(days * 24).toFixed(0)} hours` : `${days.toFixed(1)} days`} of ${name}'s OWN military budget to feed every hungry person in the country.\n\nThat's not a dream. That's arithmetic.`;
    tweets.push({ text, charCount: text.length, type: "evidence", icon: "💰" });
  }

  // ── THE SOLUTION ──
  const solutionText = `🔧 THE SOLUTION EXISTS\n\nEnding global hunger costs $${hungerCost}B/year.\n\nThe world spends $${globalMilitaryT}T/year on weapons.\n\nThat's 14 days.\n\nSafe water + healthcare + electricity + education for every human: $422B/year = 64 days.\n\nWe can afford this 6 times over.`;
  tweets.push({ text: solutionText, charCount: solutionText.length, type: "solution", icon: "🔧" });

  // ── THE DEMAND ──
  const demandText = `📢 WHAT TO DO\n\n1. Share this thread. The silence is the problem.\n2. Contact your representatives. Demand humanitarian funding.\n3. Support organizations doing the work.\n4. Push for military spending reallocation.\n\n${country.is_hotspot ? `${name} is a WFP hunger hotspot. ` : ""}Every share reaches someone who didn't know.\n\nFull data + sources: mouracleiton.github.io/v_for_x`;
  tweets.push({ text: demandText, charCount: demandText.length, type: "demand", icon: "📢" });

  // ── WHATSAPP ──
  const whatsapp = topNeeds.length > 0
    ? `${topNeeds[0].emoji} *${name.toUpperCase()} — DID YOU KNOW?*\n\n${topNeeds[0].headline}.\n${topNeeds[0].context}\n\nThe world spends $${globalMilitaryT}T/year on weapons. Ending hunger costs $${hungerCost}B = 14 days of that.\n\nWe choose war over people every single day. Share if you think that needs to change.\n\nmouracleiton.github.io/v_for_x`
    : `${name} data briefing: mouracleiton.github.io/v_for_x`;

  // ── INSTAGRAM ──
  const igNeeds = topNeeds.slice(0, 3).map((n) => `${n.emoji} ${n.headline}`).join("\n");
  const instagram = `${name} 📍\n\n${igNeeds}\n\nThe data doesn't lie. The resources exist. What's missing is political will.\n\n$93B/year ends global hunger = 14 days of military spending.\n\nShare → pressure → change.\n\n#${name.replace(/\s+/g, "")} #ZeroHunger #SDG2 #EndPoverty #DataForGood #VForX`;

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
