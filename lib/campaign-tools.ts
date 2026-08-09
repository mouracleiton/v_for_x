/**
 * V FOR X — Expanded Campaign Toolkit
 *
 * Petitions, press releases, hashtags, infographic data,
 * multi-language bundles, and optimal posting schedules.
 * Builds on the core need-analysis engine from campaign.ts.
 */

import type { CountryData } from "./types";
import { analyzeNeeds, type NeedAnalysis } from "./campaign";
import { detectLang, type CampaignLang } from "./campaign-i18n";
import { formatNumber, formatMoney, formatPct } from "./format";

/* ═══════════════════════════════════════════════════════════════
 *  PETITION GENERATOR
 * ═══════════════════════════════════════════════════════════════ */

export interface Petition {
  title: string;
  body: string;
  signatories: string;
  targetAuthority: string;
  citations: string[];
}

/**
 * Generate a formatted petition with evidence citations.
 * @param country  Country data record
 * @param topic    Free-text topic (e.g. "child malnutrition")
 * @param lang     Optional language override
 */
export function generatePetition(
  country: CountryData,
  topic: string,
  lang?: string,
): Petition {
  const cl = (lang as CampaignLang) ?? detectLang(country.iso3);
  const name = country.name_en;
  const needs = analyzeNeeds(country, cl);
  const topNeeds = needs.slice(0, 4);
  const pop = country.demographics.population / 1_000_000;

  // Determine target authority based on crisis profile
  let targetAuthority: string;
  if (country.conflict.intensity_1to5 >= 4) {
    targetAuthority = "UN Security Council & International Criminal Court";
  } else if (country.governance.corruption_perceptions_index != null &&
             country.governance.corruption_perceptions_index < 30) {
    targetAuthority = `${name} National Assembly & Anti-Corruption Commission`;
  } else if (country.hunger.famine_risk_1to5 != null && country.hunger.famine_risk_1to5 >= 3) {
    targetAuthority = "World Food Programme & UN Office for the Coordination of Humanitarian Affairs";
  } else {
    targetAuthority = `${name} Parliament & Ministry of ${needs[0]?.category ?? "Social Affairs"}`;
  }

  const title = topic
    ? `PETITION: Immediate Action on ${topic} in ${name}`
    : `PETITION: End the Humanitarian Crisis in ${name}`;

  const evidence = topNeeds.length > 0
    ? topNeeds.map((n, i) =>
        `${i + 1}. ${n.category}: ${n.headline}\n   ${n.context}`,
      ).join("\n\n")
    : `${name} faces systemic underinvestment despite available resources.`;

  const milVsHealth =
    country.military.pct_gdp != null && country.health.expenditure_pct_gdp != null &&
    country.military.pct_gdp > country.health.expenditure_pct_gdp
      ? `\n\nFurthermore, ${name} spends ${country.military.pct_gdp.toFixed(1)}% of GDP on the military but only ${country.health.expenditure_pct_gdp!.toFixed(1)}% on healthcare — a moral inversion that must be corrected.`
      : "";

  const body = [
    `To the ${targetAuthority},`,
    ``,
    `We, the undersigned, call for immediate and decisive action regarding the humanitarian situation in ${name} (population: ${formatNumber(pop)} million).`,
    ``,
    `The evidence is clear:`,
    ``,
    evidence,
    milVsHealth,
    ``,
    `Ending global hunger costs $93 billion per year — equivalent to just 14 days of world military spending. The resources exist. What is missing is political will.`,
    ``,
    `We therefore demand:`,
    ``,
    `  a) Increased humanitarian funding and unhindered aid access to ${name};`,
    `  b) Independent investigation into the structural causes identified above;`,
    `  c) Public reporting on progress toward measurable targets within 12 months.`,
    ``,
    `Every day of inaction has a human cost measured in lives. We will not be silent.`,
  ].join("\n");

  const signatories = "Concerned citizens, human rights advocates, and data-driven activists worldwide";

  const citations = topNeeds.map((n) =>
    `${n.category}: ${n.headline} (threshold: ${n.threshold})`,
  );
  if (country.military.pct_gdp != null) {
    citations.push(`Military spending: ${country.military.pct_gdp.toFixed(1)}% of GDP (${country.military.year})`);
  }
  citations.push("Global hunger eradication cost: FAO SOFI 2024 ($93B/yr)");
  citations.push("World military spending: SIPRI 2024 ($2.44T/yr)");

  return { title, body, signatories, targetAuthority, citations };
}

/* ═══════════════════════════════════════════════════════════════
 *  PRESS RELEASE GENERATOR
 * ═══════════════════════════════════════════════════════════════ */

export interface PressRelease {
  headline: string;
  dateline: string;
  body: string;
  boilerplate: string;
  citations: string[];
}

/**
 * Generate a formal, citation-heavy press release.
 */
export function generatePressRelease(
  country: CountryData,
  lang?: string,
): PressRelease {
  const cl = (lang as CampaignLang) ?? detectLang(country.iso3);
  const name = country.name_en;
  const needs = analyzeNeeds(country, cl);
  const topNeeds = needs.slice(0, 3);
  const pop = country.demographics.population / 1_000_000;

  const dateStr = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const worst = topNeeds[0];
  const headline = worst
    ? `${name}: ${worst.category} Crisis Demands International Response, Data Shows`
    : `${name}: Humanitarian Indicators Require Sustained Attention`;

  const dateline = `${dateStr} — FOR IMMEDIATE RELEASE`;

  const leadParagraph = worst
    ? `${name} (pop. ${formatNumber(pop)}M) is experiencing a critical ${worst.category.toLowerCase()} crisis, according to verified data from international monitoring bodies. ${worst.headline}. ${worst.context}`
    : `${name} (pop. ${formatNumber(pop)}M) continues to face development challenges that warrant sustained international engagement.`;

  const evidenceParagraphs = topNeeds.slice(1).map((n, i) =>
    `${i === 0 ? "Further compounding the situation" : "Additionally"}, ${n.headline}. ${n.context}`,
  ).join("\n\n");

  const economicContext =
    country.economy.gdp_per_capita_usd != null
      ? `\n\nWith a GDP per capita of ${formatMoney(country.economy.gdp_per_capita_usd)} (${country.economy.gdp_year}), the structural capacity to address these challenges is ${country.economy.gdp_per_capita_usd < 2000 ? "severely limited without international support" : "present but constrained by priorities"}.`
      : "";

  const militaryContext =
    country.military.pct_gdp != null && country.health.expenditure_pct_gdp != null &&
    country.military.pct_gdp > country.health.expenditure_pct_gdp
      ? `\n\nNotably, ${name} allocates ${country.military.pct_gdp.toFixed(1)}% of GDP to military expenditure versus ${country.health.expenditure_pct_gdp.toFixed(1)}% to healthcare — a ratio that raises questions about resource prioritization.`
      : "";

  const callToAction = `\n\n"Ending global hunger costs $93 billion per year — 0.9% of world military spending," said a V FOR X spokesperson. "The data on ${name} is not ambiguous. The question is whether the international community will act before the situation deteriorates further."\n\nV FOR X urges policymakers, humanitarian organizations, and concerned citizens to use this verified data to advocate for evidence-based intervention and resource reallocation.`;

  const body = [leadParagraph, evidenceParagraphs, economicContext, militaryContext, callToAction]
    .filter((s) => s.length > 0)
    .join("\n\n");

  const boilerplate = `About V FOR X: V FOR X is an open-data platform tracking humanitarian indicators across 200 countries and 19 dimensions. All data is sourced from official international bodies (FAO, WHO, World Bank, SIPRI, UNHCR, V-Dem Institute) and published under CC0 license. mouracleiton.github.io/v_for_x`;

  const citations: string[] = [];
  for (const n of topNeeds) {
    citations.push(`${n.category}: ${n.headline} (value: ${n.value}, threshold: ${n.threshold})`);
  }
  if (country.economy.gdp_per_capita_usd != null) {
    citations.push(`GDP per capita: ${formatMoney(country.economy.gdp_per_capita_usd)} (World Bank ${country.economy.gdp_year})`);
  }
  if (country.military.pct_gdp != null) {
    citations.push(`Military expenditure: ${country.military.pct_gdp.toFixed(1)}% of GDP (SIPRI ${country.military.year})`);
  }
  citations.push("Global military spending: $2.44 trillion/year (SIPRI 2024)");
  citations.push("Cost to end hunger: $93 billion/year (FAO SOFI 2024)");

  return { headline, dateline, body, boilerplate, citations };
}

/* ═══════════════════════════════════════════════════════════════
 *  HASHTAG SUGGESTION ENGINE
 * ═══════════════════════════════════════════════════════════════ */

/**
 * Suggest hashtags based on country + crisis profile.
 * Combines generic advocacy tags with country-specific and
 * crisis-specific tags.
 */
export function suggestHashtags(country: CountryData): string[] {
  const tags = new Set<string>();
  const nameNoSpace = country.name_en.replace(/\s+/g, "");
  const iso3 = country.iso3;

  // Brand tags
  tags.add("#VForX");
  tags.add("#DataForGood");

  // Country-specific
  tags.add(`#${nameNoSpace}`);
  tags.add(`#${iso3}`);

  // Crisis-driven from needs
  const needs = analyzeNeeds(country);
  const crisisTags: Record<string, string> = {
    HUNGER: "#ZeroHunger",
    FAMINE: "#FamineAlert",
    "CHILD HEALTH": "#ChildHealth",
    "FOOD SECURITY": "#FoodSecurity",
    CONFLICT: "#StopWar",
    DISPLACEMENT: "#RefugeesWelcome",
    "CHILD SURVIVAL": "#ChildSurvival",
    "MATERNAL HEALTH": "#MaternalHealth",
    HEALTHCARE: "#HealthForAll",
    "LIFE EXPECTANCY": "#RightToHealth",
    EDUCATION: "#EducationForAll",
    WATER: "#WaterIsLife",
    SANITATION: "#WASH",
    "EXTREME POVERTY": "#EndPoverty",
    VIOLENCE: "#EndViolence",
    CORRUPTION: "#EndCorruption",
    DEMOCRACY: "#DefendDemocracy",
    ENERGY: "#EnergyAccess",
    EMPLOYMENT: "#DecentWork",
    YOUTH: "#YouthEmpowerment",
    INEQUALITY: "#FightInequality",
    ENVIRONMENT: "#ClimateJustice",
    "PUBLIC HEALTH": "#PublicHealth",
    JUSTICE: "#JusticeReform",
  };
  for (const need of needs.slice(0, 5)) {
    const tag = crisisTags[need.category];
    if (tag) tags.add(tag);
  }

  // WFP hotspot
  if (country.is_hotspot) tags.add("#HungerHotspot");

  // Conflict
  if (country.conflict.intensity_1to5 >= 4) tags.add("#CrisisZone");

  // Always-relevant global tags
  tags.add("#SDGs");
  tags.add("#HumanRights");

  return Array.from(tags);
}

/* ═══════════════════════════════════════════════════════════════
 *  INFOGRAPHIC DATA
 * ═══════════════════════════════════════════════════════════════ */

export interface InfographicData {
  headline: string;
  bigNumber: string;
  bigLabel: string;
  comparison: string;
  source: string;
  color: string;
  emoji: string;
}

/**
 * Generate structured infographic data for shareable cards.
 * Picks the most devastating stat for maximum impact.
 */
export function generateInfographicData(country: CountryData): InfographicData {
  const name = country.name_en;
  const pop = country.demographics.population / 1_000_000;
  const needs = analyzeNeeds(country);

  // Priority: famine risk → displacement → child mortality → undernourishment → worst need
  const famineRisk = country.hunger.famine_risk_1to5;
  if (famineRisk != null && famineRisk >= 4) {
    return {
      headline: `${name} is on the brink of famine`,
      bigNumber: `${famineRisk}/5`,
      bigLabel: "FAMINE RISK LEVEL",
      comparison: "Phase 5 = catastrophe. Entire communities face starvation. This is preventable.",
      source: "WFP / IPC Famine Review Committee",
      color: "#c42b3e",
      emoji: "💀",
    };
  }

  const displaced = country.migration.forcibly_displaced;
  if (displaced != null && displaced >= 1_000_000) {
    return {
      headline: `${formatNumber(displaced)} people forcibly displaced from ${name}`,
      bigNumber: formatNumber(displaced),
      bigLabel: "FORCIBLY DISPLACED",
      comparison: `That's more than the population of many countries. Each number is a human being forced from home.`,
      source: "UNHCR Global Trends",
      color: "#f0a03b",
      emoji: "🏃",
    };
  }

  const childMort = country.health.child_mortality_under5_per1k;
  if (childMort != null && childMort >= 50) {
    return {
      headline: `In ${name}, ${childMort.toFixed(0)} of every 1,000 children die before age 5`,
      bigNumber: `${childMort.toFixed(0)}‰`,
      bigLabel: "CHILD MORTALITY (UNDER-5)",
      comparison: "The best-performing countries lose fewer than 3 per 1,000. The gap is a policy choice.",
      source: "UN IGME / WHO",
      color: "#c42b3e",
      emoji: "🧒",
    };
  }

  const underPct = country.hunger.undernourishment_pct;
  if (underPct != null && underPct >= 15) {
    const underM = pop * underPct / 100;
    return {
      headline: `${formatNumber(underM)}M people in ${name} are undernourished`,
      bigNumber: formatPct(underPct),
      bigLabel: "UNDERNOURISHMENT RATE",
      comparison: `Ending global hunger costs $93B/year = 14 days of military spending. We can afford this.`,
      source: "FAO State of Food Security (SOFI)",
      color: "#e23856",
      emoji: "🍽️",
    };
  }

  // Fall back to worst analyzed need
  if (needs.length > 0) {
    const worst = needs[0];
    return {
      headline: `${name}: ${worst.headline}`,
      bigNumber: worst.value > 100
        ? worst.value.toFixed(0)
        : worst.value.toFixed(1),
      bigLabel: worst.category,
      comparison: worst.context,
      source: "V FOR X analysis from official sources",
      color: "#c42b3e",
      emoji: worst.emoji,
    };
  }

  // No crisis — highlight a positive or neutral stat
  const lifeExp = country.health.life_expectancy;
  return {
    headline: `${name}: key indicators`,
    bigNumber: lifeExp != null ? lifeExp.toFixed(1) : "—",
    bigLabel: "LIFE EXPECTANCY (YEARS)",
    comparison: "Every data point is a story. Explore the full picture at V FOR X.",
    source: "WHO World Health Statistics",
    color: "#22d3a6",
    emoji: "📊",
  };
}

/* ═══════════════════════════════════════════════════════════════
 *  MULTI-LANGUAGE CAMPAIGN BUNDLE
 * ═══════════════════════════════════════════════════════════════ */

export interface CampaignBundle {
  languages: string[];
  formats: { format: string; content: string }[];
}

const BUNDLE_LANGS: CampaignLang[] = [
  "en", "pt", "es", "fr", "zh", "ja", "ko", "hi", "ar", "ru",
];

/**
 * Generate all campaign formats in all 10 languages.
 * Returns a flat list of { format, content } blocks.
 */
export function generateCampaignBundle(country: CountryData): CampaignBundle {
  const info = generateInfographicData(country);
  const petition = generatePetition(country, "");
  const hashtags = suggestHashtags(country);

  const formats: { format: string; content: string }[] = [];

  // One-liner punch for each language
  for (const lang of BUNDLE_LANGS) {
    const needs = analyzeNeeds(country, lang);
    const worst = needs[0];
    const tagline = worst
      ? `${country.name_en}: ${worst.headline}. ${worst.context}`
      : `${country.name_en} — explore the data. The picture speaks for itself.`;
    formats.push({
      format: `TAGLINE [${lang.toUpperCase()}]`,
      content: tagline,
    });
  }

  // Hashtag block
  formats.push({
    format: "HASHTAGS",
    content: hashtags.join(" "),
  });

  // Infographic headline
  formats.push({
    format: "INFOGRAPHIC",
    content: `${info.emoji} ${info.headline}\nBIG NUMBER: ${info.bigNumber}\nLABEL: ${info.bigLabel}\nCOMPARISON: ${info.comparison}\nSOURCE: ${info.source}`,
  });

  // Petition title + target
  formats.push({
    format: "PETITION",
    content: `${petition.title}\n\nTarget: ${petition.targetAuthority}\n\n${petition.body}`,
  });

  return {
    languages: BUNDLE_LANGS,
    formats,
  };
}

/* ═══════════════════════════════════════════════════════════════
 *  POSTING SCHEDULE
 * ═══════════════════════════════════════════════════════════════ */

export interface PostingSchedule {
  platform: string;
  bestTimes: string[];
  timezone: string;
  rationale: string;
}

/**
 * Optimal posting time suggestions per platform.
 * Based on general social media engagement research.
 */
export function getPostingSchedule(): PostingSchedule[] {
  return [
    {
      platform: "X / Twitter",
      bestTimes: ["08:00", "12:00", "17:00", "20:00"],
      timezone: "UTC (adjust for your audience)",
      rationale: "Peak engagement during commute hours and lunch breaks. Thread posting at 08:00 captures morning scrollers; 17:00 hits the post-work audience.",
    },
    {
      platform: "Instagram",
      bestTimes: ["11:00", "13:00", "19:00"],
      timezone: "UTC (adjust for your audience)",
      rationale: "Midday and early evening see highest engagement. Infographic carousel posts perform best at 19:00 when users browse leisurely.",
    },
    {
      platform: "Facebook",
      bestTimes: ["09:00", "13:00", "15:00"],
      timezone: "UTC (adjust for your audience)",
      rationale: "Weekday mornings and early afternoon drive the most link clicks and shares among the 25–54 demographic.",
    },
    {
      platform: "LinkedIn",
      bestTimes: ["07:45", "10:00", "12:00"],
      timezone: "UTC (adjust for your audience)",
      rationale: "Professional audience is most active Tuesday–Thursday mornings. Policy and data-driven posts perform best at 10:00.",
    },
    {
      platform: "TikTok",
      bestTimes: ["06:00", "10:00", "22:00"],
      timezone: "UTC (adjust for your audience)",
      rationale: "Early morning and late evening capture Gen-Z audiences. Short-form data explainers go viral when posted at 22:00.",
    },
    {
      platform: "WhatsApp / Signal",
      bestTimes: ["19:00", "21:00"],
      timezone: "Local",
      rationale: "Group forwards peak in the evening. Share the WhatsApp message format during prime messaging hours for maximum resharing.",
    },
  ];
}
