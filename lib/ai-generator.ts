/**
 * V FOR X — AI Campaign Generator
 *
 * Connects to any OpenAI REST-like API (OpenAI, Groq, OpenRouter, etc.)
 * to generate unique, varied social media messages from country data.
 *
 * SECURITY: API key and endpoint are stored ONLY in localStorage on the
 * user's device. They are never sent to any server except the one the
 * user configures. This file contains zero hardcoded keys.
 *
 * ANTI-BAN: Each generation uses a random prompt variant + temperature
 * variation + random data angle selection, so no two messages are alike.
 */

import type { CountryData, WorldBackbone } from "./types";
import { analyzeNeeds } from "./campaign";
import { detectLang } from "./campaign-i18n";

/* ═══ CONFIG TYPES ═══ */

export interface AIConfig {
  baseUrl: string;    // e.g. https://api.openai.com/v1 or https://api.groq.com/openai/v1
  apiKey: string;     // user's private key
  model: string;      // e.g. gpt-4o-mini, llama-3.3-70b-versatile
}

const STORAGE_KEY = "vfx-ai-config";

export function loadAIConfig(): AIConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.baseUrl && parsed.apiKey && parsed.model) return parsed;
    return null;
  } catch {
    return null;
  }
}

export function saveAIConfig(config: AIConfig) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch { /* ignore */ }
}

export function clearAIConfig() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
}

/* ═══ PROMPT VARIANTS ═══
 * Each generation picks a random variant to ensure unique output.
 * This prevents message-pattern bans on social platforms.
 */

const LANG_NAMES: Record<string, string> = {
  en: "English",
  pt: "Portuguese (Brazilian)",
  es: "Spanish",
  fr: "French",
  ar: "Arabic",
};

const PLATFORM_STYLES: Record<string, { name: string; maxLen: number; instructions: string }> = {
  twitter: {
    name: "Twitter/X",
    maxLen: 270,
    instructions: "Write a single impactful tweet (max 270 chars). Use a strong hook in the first line. Include ONE data point. End with a call to action. No hashtags in the middle — put 2-3 at the end.",
  },
  whatsapp: {
    name: "WhatsApp",
    maxLen: 800,
    instructions: "Write a WhatsApp message (max 800 chars). Use *bold* for key phrases. Start with an emoji hook. Make it personal — like sending to a friend. End with a question that prompts the person to share.",
  },
  instagram: {
    name: "Instagram",
    maxLen: 1500,
    instructions: "Write an Instagram caption (max 1500 chars). Start with a bold statement. Use line breaks for readability. Include a mini story about what the data means for real people. End with 5-7 relevant hashtags.",
  },
  telegram: {
    name: "Telegram",
    maxLen: 1000,
    instructions: "Write a Telegram channel post (max 1000 chars). Use **bold** formatting. Be informative but urgent. Include 2-3 key data points. End with a link placeholder.",
  },
};

const TONE_VARIANTS = [
  "angry and urgent — like you're watching people die and nobody cares",
  "cold and analytical — let the numbers speak, no emotion, just facts",
  "personal and emotional — imagine it's YOUR family affected by these numbers",
  "sarcastic and dark — point out the absurdity of spending trillions on weapons while children starve",
  "hopeful but firm — we CAN fix this, the solution exists, but we must demand it",
  "direct and accusatory — name the system, name the priorities, name the cost",
  "storytelling — start with a human detail, then reveal the systemic data behind it",
  "Socratic — ask questions that make the reader uncomfortable with the answers",
];

const ANGLE_VARIANTS = [
  "Lead with the most shocking statistic and build the case outward.",
  "Start with the cost comparison: how little it would take to fix vs what we spend on weapons.",
  "Focus on children — child mortality, stunting, education gaps. Make it about the next generation.",
  "Frame it as a political choice, not an economic problem. The money exists.",
  "Compare the country's numbers to a wealthy country (Norway, Japan, Germany).",
  "Lead with displacement or conflict if relevant — humanize the numbers.",
];

/* ═══ DATA CONTEXT BUILDER ═══ */

function buildDataContext(country: CountryData, data: WorldBackbone): string {
  const needs = analyzeNeeds(country);
  const top = needs.slice(0, 5);
  const pop = country.demographics.population / 1_000_000;

  const lines: string[] = [];
  lines.push(`COUNTRY: ${country.name_en} (${country.iso3})`);
  lines.push(`REGION: ${country.region}`);
  lines.push(`POPULATION: ${pop.toFixed(1)} million`);
  lines.push(`HUNGER HOTSPOT: ${country.is_hotspot ? "YES — WFP classified" : "No"}`);
  lines.push("");

  if (top.length > 0) {
    lines.push("TOP URGENT NEEDS (sorted by severity):");
    for (const n of top) {
      lines.push(`- ${n.category}: ${n.headline}`);
    }
    lines.push("");
  }

  // Additional context
  const under = country.hunger.undernourishment_pct;
  const childMort = country.health.child_mortality_under5_per1k;
  const docs = country.health.doctors_per_1000;
  const lifeExp = country.health.life_expectancy;
  const lit = country.education.literacy_rate_pct;
  const milPct = country.military.pct_gdp;
  const healthPct = country.health.expenditure_pct_gdp;
  const poverty = country.poverty.headcount_365_pct;
  const gini = country.inequality.gini;
  const conflict = country.conflict.intensity_1to5;
  const homicide = country.security.homicide_rate_per100k;
  const cpi = country.governance.corruption_perceptions_index;
  const displaced = country.migration.forcibly_displaced;
  const noElec = country.energy?.no_access_electricity_m;

  lines.push("KEY DATA POINTS:");
  if (under !== null) lines.push(`- Undernourishment: ${under}% of population`);
  if (childMort !== null) lines.push(`- Child mortality (under 5): ${childMort} per 1,000 (Norway: 2.2)`);
  if (docs != null) lines.push(`- Doctors: ${docs} per 1,000 (WHO minimum: 4.45)`);
  if (lifeExp !== null) lines.push(`- Life expectancy: ${lifeExp} years`);
  if (lit !== null) lines.push(`- Adult literacy: ${lit}%`);
  if (poverty !== null) lines.push(`- Extreme poverty ($3.65/day): ${poverty}%`);
  if (gini !== null) lines.push(`- Inequality (Gini): ${gini} (0=equal, 100=max)`);
  if (homicide !== null) lines.push(`- Homicide rate: ${homicide} per 100k`);
  if (cpi !== null) lines.push(`- Corruption Perception Index: ${cpi}/100 (100=clean)`);
  if (conflict >= 3) lines.push(`- CONFLICT: Level ${conflict}/5 (active armed conflict)`);
  if (displaced && displaced > 100000) lines.push(`- Forcibly displaced: ${(displaced / 1e6).toFixed(1)} million`);
  if (noElec && noElec > 0.5) lines.push(`- Without electricity: ${noElec} million`);
  if (milPct != null && healthPct != null && milPct > healthPct) {
    lines.push(`- Military spending: ${milPct}% GDP vs Health: ${healthPct}% GDP — SPENDS MORE ON MILITARY`);
  }
  lines.push("");

  // Global context
  lines.push("GLOBAL CONTEXT:");
  lines.push(`- Ending global hunger: $${data.global_indicators.hunger.cost_to_eradicate_billion_yr}B/year`);
  lines.push(`- World military spending: $${data.global_indicators.military.global_spending_yr_t}T/year`);
  lines.push(`- That's 14 days of military spending to end hunger.`);
  lines.push(`- $422B/year = water + health + electricity + education for everyone = 64 days of military spending.`);

  return lines.join("\n");
}

/* ═══ PROMPT BUILDER ═══ */

function buildPrompt(
  country: CountryData,
  data: WorldBackbone,
  platform: string,
  lang: string,
  customInstructions?: string,
): { system: string; user: string } {
  const langName = LANG_NAMES[lang] ?? "English";
  const platformStyle = PLATFORM_STYLES[platform] ?? PLATFORM_STYLES.twitter;
  const tone = TONE_VARIANTS[Math.floor(Math.random() * TONE_VARIANTS.length)];
  const angle = ANGLE_VARIANTS[Math.floor(Math.random() * ANGLE_VARIANTS.length)];
  const tempNote = `Variation seed: ${Date.now()}`;

  const system = `You are a data-driven activist and expert communicator. You write social media content that makes people stop scrolling and care about humanitarian crises.

Your writing rules:
- NEVER use generic phrases like "thoughts and prayers", "in these trying times", "it is heartbreaking"
- ALWAYS cite specific numbers from the data provided
- Be direct, specific, and human. Avoid bureaucratic language.
- Don't use AI-typical phrases ("delve into", "it's important to note", "in conclusion")
- Every message must be unique — vary your structure, opening, and tone each time
- The tone now: ${tone}
- The angle: ${angle}
- ${tempNote}`;

  const dataContext = buildDataContext(country, data);

  const user = `Write a ${platformStyle.name} message in ${langName} about ${country.name_en}.

${platformStyle.instructions}

${customInstructions ? `ADDITIONAL INSTRUCTIONS: ${customInstructions}` : ""}

Use ONLY real data from this brief:

${dataContext}

Write the message now. Output ONLY the message text — no preamble, no explanation, no labels. Just the ready-to-post content.`;

  return { system, user };
}

/* ═══ API CALL ═══ */

export interface AIGenerateResult {
  text: string;
  platform: string;
  tone: string;
  timestamp: number;
}

export async function generateAIMessage(
  config: AIConfig,
  country: CountryData,
  data: WorldBackbone,
  platform: string,
  lang?: string,
  customInstructions?: string,
): Promise<AIGenerateResult> {
  const detectedLang = lang ?? detectLang(country.iso3);
  const { system, user } = buildPrompt(country, data, platform, detectedLang, customInstructions);
  const platformStyle = PLATFORM_STYLES[platform] ?? PLATFORM_STYLES.twitter;

  // Random temperature between 0.7 and 1.0 for variation
  const temperature = 0.7 + Math.random() * 0.3;

  const url = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature,
      max_tokens: platform === "instagram" ? 600 : 300,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`API error ${response.status}: ${errorBody.slice(0, 200)}`);
  }

  const json = await response.json();
  const text = json.choices?.[0]?.message?.content?.trim() ?? "";

  if (!text) {
    throw new Error("API returned empty response");
  }

  return {
    text,
    platform: platformStyle.name,
    tone: "AI generated",
    timestamp: Date.now(),
  };
}

/* ═══ BATCH GENERATION ═══ */

export async function generateAIBatch(
  config: AIConfig,
  country: CountryData,
  data: WorldBackbone,
  lang?: string,
  count: number = 5,
): Promise<AIGenerateResult[]> {
  const platforms = ["twitter", "whatsapp", "instagram", "telegram"];
  const results: AIGenerateResult[] = [];

  for (let i = 0; i < count; i++) {
    const platform = platforms[i % platforms.length];
    try {
      const result = await generateAIMessage(config, country, data, platform, lang);
      results.push(result);
    } catch (e) {
      // Continue generating others even if one fails
      results.push({
        text: `[ERROR: ${(e as Error).message}]`,
        platform,
        tone: "error",
        timestamp: Date.now(),
      });
    }
  }

  return results;
}

export { PLATFORM_STYLES, TONE_VARIANTS, ANGLE_VARIANTS };
