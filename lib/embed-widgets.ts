/**
 * V FOR X — The Embed: Widget Builder Engine
 *
 * Promotes the iframe snippet generator that was buried inside the export
 * utils into a first-class, dedicated module. This is the single source of
 * truth for the four strongest syndication visuals:
 *
 *   • sorrow-map  — the choropleth crisis atlas
 *   • lives       — the running preventable-death counter
 *   • countdown   — the SDG deadline equation
 *   • brief       — a country mini-brief
 *
 * Every function here is SSR-safe (no `window` access) and deterministic so
 * the generated snippet matches the live preview exactly.
 */

import { SITE } from "@/lib/seo";

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

export type WidgetType = "sorrow-map" | "lives" | "countdown" | "brief";
export type EmbedTheme = "dark" | "light";

export interface WidgetOption {
  /** Machine value used in the URL. */
  value: string;
  /** Human label shown in the builder. */
  label: string;
  /** Short description of what this choice renders. */
  description?: string;
}

export interface WidgetSpec {
  type: WidgetType;
  /** Display name. */
  name: string;
  /** One-line pitch. */
  blurb: string;
  /** Default iframe height in pixels. */
  defaultHeight: number;
  /** Recommended min/max heights for the builder slider. */
  heightRange: [number, number];
  /** Glyph used in the builder card. */
  glyph: string;
  /** Configurable parameters for this widget. */
  params: {
    /** URL query key. */
    key: string;
    /** Builder field label. */
    label: string;
    options: WidgetOption[];
    defaultValue: string;
  }[];
}

export interface EmbedOptions {
  type: WidgetType;
  /** Widget-specific config, e.g. { metric: "hunger_undernourishment_pct" }. */
  params?: Record<string, string>;
  width?: string | number;
  height?: number;
  theme?: EmbedTheme;
  /** Override the auto-generated <iframe> title. */
  title?: string;
}

/* ═══════════════════════════════════════════════════════════════
   WIDGET CATALOG
   ═══════════════════════════════════════════════════════════════ */

/** Deterministic short hash (5 chars) from a string — for stable element IDs. */
function hashId(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = (h * 33) ^ input.charCodeAt(i);
  }
  return (h >>> 0).toString(36).slice(0, 5).padStart(5, "0");
}

/** A curated set of the most impactful map metrics (keys match the GeoJSON). */
export const MAP_METRICS: WidgetOption[] = [
  { value: "hunger_undernourishment_pct", label: "Undernourishment", description: "Share of population undernourished" },
  { value: "hunger_prevalence_pct", label: "Acute food insecurity", description: "Crisis-level or worse food insecurity" },
  { value: "hunger_famine_risk_1to5", label: "Famine risk", description: "1–5 escalating famine risk" },
  { value: "conflict_intensity_1to5", label: "Conflict intensity", description: "1–5 armed-conflict intensity" },
  { value: "conflict_displacement_m", label: "Displacement", description: "Forcibly displaced (millions)" },
  { value: "poverty_headcount_365_pct", label: "Extreme poverty", description: "Living under $3.65/day" },
  { value: "health_child_mortality_under5_per1k", label: "Child mortality", description: "Under-5 deaths per 1,000" },
  { value: "water_sanitation_basic_access_pct", label: "Water access", description: "Basic drinking-water access" },
  { value: "climate_co2_per_capita_t", label: "CO₂ per capita", description: "Tonnes per person per year" },
  { value: "inequality_gini", label: "Inequality (Gini)", description: "0–100 income inequality" },
];

export const LIFE_CAUSES: WidgetOption[] = [
  { value: "all", label: "All causes", description: "Total preventable death toll, cycling the breakdown" },
  { value: "hunger", label: "Hunger", description: "Hunger & malnutrition — 1 every 4s" },
  { value: "child_mortality", label: "Child mortality", description: "Under-5, mostly preventable" },
  { value: "conflict", label: "Conflict", description: "Armed-conflict deaths" },
  { value: "displacement", label: "Displacement", description: "People newly forced from home" },
  { value: "poverty", label: "Poverty", description: "Pushed into extreme poverty" },
];

export const SDG_OPTIONS: WidgetOption[] = [
  { value: "all", label: "All goals", description: "Cycle the six SDG equations" },
  { value: "6", label: "SDG 6 — Water", description: "2.2B without safe water" },
  { value: "3", label: "SDG 3 — Health", description: "Universal health coverage gap" },
  { value: "7", label: "SDG 7 — Energy", description: "733M without electricity" },
  { value: "4", label: "SDG 4 — Education", description: "244M out of school" },
  { value: "10", label: "SDG 10 — Inequality", description: "Widening income gap" },
  { value: "13", label: "SDG 13 — Climate", description: "Emissions gap" },
];

/** A focused, high-impact subset of countries for the builder dropdown.
 *  Any valid ISO3 still works via the brief route — the full 200 are
 *  available in the autocomplete. */
export const FEATURED_COUNTRIES: WidgetOption[] = [
  { value: "SDN", label: "Sudan", description: "Active conflict · famine risk" },
  { value: "YEM", label: "Yemen", description: "One of the world's worst hunger crises" },
  { value: "AFG", label: "Afghanistan", description: "Economic collapse · mass hunger" },
  { value: "RDC", label: "DR Congo", description: "Decades of displacement" },
  { value: "HTI", label: "Haiti", description: "Gang violence · food emergency" },
  { value: "PSE", label: "Palestine", description: "Active conflict" },
  { value: "SOM", label: "Somalia", description: "Climate + conflict hunger" },
  { value: "MMR", label: "Myanmar", description: "Conflict · displacement" },
  { value: "BRA", label: "Brazil", description: "Inequality · hunger return" },
  { value: "USA", label: "United States", description: "Wealth + inequality contrast" },
];

export const WIDGETS: Record<WidgetType, WidgetSpec> = {
  "sorrow-map": {
    type: "sorrow-map",
    name: "Sorrow Map",
    blurb: "The interactive crisis atlas — 200 countries colored by 48 dimensions.",
    defaultHeight: 520,
    heightRange: [320, 800],
    glyph: "🌍",
    params: [
      { key: "metric", label: "Metric", options: MAP_METRICS, defaultValue: "hunger_undernourishment_pct" },
    ],
  },
  lives: {
    type: "lives",
    name: "Lives Counter",
    blurb: "A running tally of preventable deaths. The clock that never stops.",
    defaultHeight: 240,
    heightRange: [160, 480],
    glyph: "🕯️",
    params: [
      { key: "cause", label: "Cause", options: LIFE_CAUSES, defaultValue: "all" },
    ],
  },
  countdown: {
    type: "countdown",
    name: "SDG Countdown",
    blurb: "Six UN goals, six equations — each with a gap, a cost, a deadline.",
    defaultHeight: 320,
    heightRange: [220, 560],
    glyph: "⏳",
    params: [
      { key: "sdg", label: "Goal", options: SDG_OPTIONS, defaultValue: "all" },
    ],
  },
  brief: {
    type: "brief",
    name: "Country Mini-Brief",
    blurb: "A devastating one-card data brief for any of 200 countries.",
    defaultHeight: 480,
    heightRange: [320, 720],
    glyph: "📋",
    params: [
      { key: "country", label: "Country", options: FEATURED_COUNTRIES, defaultValue: "SDN" },
    ],
  },
};

export const WIDGET_ORDER: WidgetType[] = ["sorrow-map", "lives", "countdown", "brief"];

/* ═══════════════════════════════════════════════════════════════
   URL / SRC BUILDING
   ═══════════════════════════════════════════════════════════════ */

/** The route slug for a widget, e.g. "sorrow-map" → /embed/sorrow-map/ */
export function widgetRoute(type: WidgetType): string {
  return `/embed/${type}/`;
}

/** Resolve the merged params (spec defaults overridden by user choices). */
export function resolveParams(
  type: WidgetType,
  overrides: Record<string, string> = {}
): Record<string, string> {
  const spec = WIDGETS[type];
  const out: Record<string, string> = {};
  for (const p of spec.params) out[p.key] = p.defaultValue;
  return { ...out, ...overrides };
}

/**
 * Build the iframe `src` URL for a widget.
 *
 * @param absolute  When true (default) emits the full canonical URL using
 *                  SITE.url — the value copied into a snippet. When false,
 *                  emits a root-relative path including the production
 *                  basePath, for the in-app live preview.
 */
export function buildEmbedSrc(
  opts: EmbedOptions,
  absolute = true
): string {
  const params = resolveParams(opts.type, opts.params);
  const qs = new URLSearchParams(params);
  qs.set("theme", opts.theme ?? "dark");
  const query = qs.toString();
  const suffix = query ? `?${query}` : "";

  if (absolute) {
    return `${SITE.url}${widgetRoute(opts.type)}${suffix}`;
  }

  const base = prodBasePath();
  return `${base}${widgetRoute(opts.type)}${suffix}`;
}

/**
 * The production basePath. Detected from the pathname at runtime so the
 * in-app preview iframe resolves correctly under GitHub Pages.
 * SSR-safe (returns "" on the server).
 */
export function prodBasePath(): string {
  if (typeof window === "undefined") return "";
  const REPO = "v_for_x";
  const seg = `/${REPO}`;
  const path = window.location.pathname;
  return path.startsWith(`${seg}/`) || path === `${seg}` ? seg : "";
}

/* ═══════════════════════════════════════════════════════════════
   SNIPPET GENERATION
   ═══════════════════════════════════════════════════════════════ */

function fmtWidth(w: string | number | undefined): string {
  if (w === undefined || w === null) return "100%";
  return typeof w === "number" ? `${w}px` : String(w);
}

function defaultTitle(type: WidgetType): string {
  switch (type) {
    case "sorrow-map": return "V FOR X — Sorrow Map";
    case "lives": return "V FOR X — Lives Counter";
    case "countdown": return "V FOR X — SDG Countdown";
    case "brief": return "V FOR X — Country Brief";
  }
}

/**
 * Generate the drop-in `<iframe>` HTML snippet for any widget.
 * This is the primary deliverable of the builder.
 */
export function generateWidgetIframe(opts: EmbedOptions): string {
  const spec = WIDGETS[opts.type];
  const src = buildEmbedSrc(opts, true);
  const width = fmtWidth(opts.width);
  const height = String(opts.height ?? spec.defaultHeight);
  const title = opts.title ?? defaultTitle(opts.type);
  const isLight = (opts.theme ?? "dark") === "light";

  const style = isLight
    ? "border:1px solid #d8dee9;border-radius:6px;background:#ffffff;"
    : "border:1px solid #1a2a44;border-radius:6px;background:#060b14;";

  return `<iframe
  src="${src}"
  width="${width}"
  height="${height}"
  frameborder="0"
  scrolling="no"
  loading="lazy"
  style="${style}"
  title="${title}"
></iframe>`;
}

/**
 * Generate a `<script>` embed snippet that injects the iframe and posts
 * its rendered height back to the parent (responsive height). For sites
 * that prefer a script tag over pasting raw HTML.
 */
export function generateWidgetScript(opts: EmbedOptions): string {
  const spec = WIDGETS[opts.type];
  const params = resolveParams(opts.type, opts.params);
  const idSeed = `${opts.type}:${Object.entries(params)
    .map(([k, v]) => `${k}=${v}`)
    .join(",")}`;
  const containerId = `vfx-${opts.type}-${hashId(idSeed)}`;
  const src = buildEmbedSrc(opts, true);
  const height = String(opts.height ?? spec.defaultHeight);
  const title = opts.title ?? defaultTitle(opts.type);
  const isLight = (opts.theme ?? "dark") === "light";
  const bg = isLight ? "#ffffff" : "#060b14";

  return `<!-- V FOR X — ${spec.name} widget -->
<div id="${containerId}" style="width:100%;min-height:${height}px;">
  <iframe src="${src}" width="100%" height="${height}" frameborder="0"
    scrolling="no" loading="lazy" title="${title}"
    style="border:1px solid ${isLight ? "#d8dee9" : "#1a2a44"};border-radius:6px;background:${bg};">
  </iframe>
</div>`;
}

/** A clean, shareable direct link to the embed view. */
export function generateDirectLink(opts: EmbedOptions): string {
  return buildEmbedSrc(opts, true);
}

/* ═══════════════════════════════════════════════════════════════
   PARAM PARSING (used by the embed routes to read their config)
   ═══════════════════════════════════════════════════════════════ */

/**
 * Parse a widget's config from a URLSearchParams (or Next.js searchParams).
 * Falls back to the spec defaults for any missing/invalid value.
 */
export function parseWidgetConfig(
  type: WidgetType,
  search: URLSearchParams | Record<string, string | string[] | undefined>
): { params: Record<string, string>; theme: EmbedTheme } {
  const get = (key: string): string | undefined => {
    if (search instanceof URLSearchParams) return search.get(key) ?? undefined;
    const v = search[key];
    return Array.isArray(v) ? v[0] : v;
  };

  const spec = WIDGETS[type];
  const validValues = new Set(spec.params.flatMap((p) => p.options.map((o) => o.value)));

  const params: Record<string, string> = {};
  for (const p of spec.params) {
    const raw = get(p.key);
    params[p.key] = raw && validValues.has(raw) ? raw : p.defaultValue;
  }

  const themeRaw = get("theme");
  const theme: EmbedTheme = themeRaw === "light" ? "light" : "dark";

  return { params, theme };
}
