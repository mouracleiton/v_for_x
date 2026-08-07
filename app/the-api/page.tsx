"use client";

import { useState, useMemo, useCallback } from "react";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import { sound } from "@/lib/sound";
import backbone from "@/data/world_backbone.json";
import type { WorldBackbone } from "@/lib/types";

const data = backbone as WorldBackbone;

interface Endpoint {
  id: string;
  method: "GET";
  path: string;
  description: string;
  sample: unknown;
}

const ENDPOINTS: Endpoint[] = [
  {
    id: "index",
    method: "GET",
    path: "/api/v1/index.json",
    description: "API metadata — version, license, endpoint list",
    sample: {
      name: "V FOR X Public Data API",
      version: "1.0",
      license: "CC0",
      total_countries: 200,
      endpoints: { countries: "/api/v1/countries.json", country_detail: "/api/v1/countries/{iso3}.json" },
    },
  },
  {
    id: "countries",
    method: "GET",
    path: "/api/v1/countries.json",
    description: "All 200 countries with key stats (lightweight summary)",
    sample: {
      count: 200,
      countries: [
        {
          iso3: "BRA",
          name_en: "Brazil",
          name_pt: "Brasil",
          region: "Americas",
          population: 211140000,
          is_hotspot: false,
          undernourishment_pct: 3.2,
          conflict_intensity: 1,
          gdp_per_capita_usd: 8920,
          life_expectancy: 75.9,
          detail_url: "/api/v1/countries/BRA.json",
        },
      ],
    },
  },
  {
    id: "country",
    method: "GET",
    path: "/api/v1/countries/{iso3}.json",
    description: "Full country record — all 23 dimensions, ~87 fields",
    sample: data.countries.find((c) => c.iso3 === "NOR"),
  },
  {
    id: "equations",
    method: "GET",
    path: "/api/v1/equations.json",
    description: "All 6 SDG equations with costs, affordability, interventions",
    sample: data.sdg_equations?.equations ? Object.fromEntries(Object.entries(data.sdg_equations.equations).slice(0, 1)) : {},
  },
  {
    id: "hotspots",
    method: "GET",
    path: "/api/v1/hotspots.json",
    description: "WFP hunger hotspot classification — 22 countries ranked by crisis score",
    sample: { wfp_classification: data.hotspots.wfp_classification, all: data.hotspots.all.slice(0, 3) },
  },
];

const CODE_SAMPLES: Record<string, { lang: string; code: string }> = {
  javascript: {
    lang: "JavaScript / Node.js",
    code: `// Fetch all countries
const res = await fetch('https://mouracleiton.github.io/v_for_x/api/v1/countries.json');
const { countries } = await res.json();

// Find countries with >30% undernourishment
const crisis = countries.filter(c => c.undernourishment_pct > 30);
console.log(\`\${crisis.length} countries in crisis\`);`,
  },
  python: {
    lang: "Python",
    code: `import requests

# Get full detail for a specific country
r = requests.get('https://mouracleiton.github.io/v_for_x/api/v1/countries/SDN.json')
sudan = r.json()

print(f"Sudan undernourishment: {sudan['hunger']['undernourishment_pct']}%")
print(f"Life expectancy: {sudan['health']['life_expectancy']} years")`,
  },
  curl: {
    lang: "cURL",
    code: `# Get all hunger hotspots
curl -s https://mouracleiton.github.io/v_for_x/api/v1/hotspots.json | jq '.all[0:3]'

# Get SDG equations
curl -s https://mouracleiton.github.io/v_for_x/api/v1/equations.json | jq '.equations.sdg6_water.cost'`,
  },
};

export default function TheApiPage() {
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>("countries");
  const [codeLang, setCodeLang] = useState<keyof typeof CODE_SAMPLES>("javascript");
  const [queryIso3, setQueryIso3] = useState("BRA");
  const [queryResult, setQueryResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const endpoint = ENDPOINTS.find((e) => e.id === selectedEndpoint) ?? ENDPOINTS[0];

  const json = useMemo(() => {
    try {
      return JSON.stringify(endpoint.sample, null, 2);
    } catch {
      return "{}";
    }
  }, [endpoint]);

  // Live query (client-side from the bundled data, simulating the API)
  const runQuery = useCallback(() => {
    const iso3 = queryIso3.toUpperCase().trim();
    const country = data.countries.find((c) => c.iso3 === iso3);
    if (!country) {
      setQueryResult(JSON.stringify({ error: `Country ${iso3} not found. Valid: 3-letter ISO code.` }, null, 2));
    } else {
      setQueryResult(JSON.stringify(country, null, 2));
    }
    sound.success();
  }, [queryIso3]);

  const copyJson = useCallback(() => {
    navigator.clipboard?.writeText(json);
    setCopied(true);
    sound.copy();
    setTimeout(() => setCopied(false), 2000);
  }, [json]);

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8 pt-4">
        <div className="text-xs text-content-dim mb-1">[23] THE API</div>
        <h1 className="text-2xl md:text-3xl text-blood-bright font-bold glow-blood tracking-widest">
          THE API
        </h1>
        <p className="text-content-secondary text-sm mt-2">
          // {data.metadata.total_countries} countries · {data.metadata.sources.length} sources · 23 dimensions · CC0.
          No auth. No rate limit. No tracking. Just data.
        </p>
      </div>

      {/* API overview */}
      <TerminalCard title="PUBLIC DATA API // v1.0" accent="green" glow className="mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <div className="text-[10px] text-content-dim uppercase tracking-widest">ENDPOINTS</div>
            <div className="text-2xl text-terminal-green font-bold">{ENDPOINTS.length}</div>
          </div>
          <div>
            <div className="text-[10px] text-content-dim uppercase tracking-widest">COUNTRIES</div>
            <div className="text-2xl text-content-primary font-bold">{data.metadata.total_countries}</div>
          </div>
          <div>
            <div className="text-[10px] text-content-dim uppercase tracking-widest">FIELDS/COUNTRY</div>
            <div className="text-2xl text-content-primary font-bold">~87</div>
          </div>
          <div>
            <div className="text-[10px] text-content-dim uppercase tracking-widest">LICENSE</div>
            <div className="text-2xl text-terminal-green font-bold">CC0</div>
          </div>
        </div>
        <div className="p-3 border border-border-dim bg-void text-xs text-content-secondary">
          Base URL: <span className="text-terminal-green font-mono">https://mouracleiton.github.io/v_for_x</span>
          <br />
          All endpoints return JSON. No authentication required. CORS-enabled.
          Data is static — generated at build time from {data.metadata.sources.length} primary sources.
        </div>
      </TerminalCard>

      {/* Endpoint explorer */}
      <TerminalCard title="ENDPOINTS // INTERACTIVE EXPLORER" accent="amber" className="mb-6">
        <div className="flex flex-wrap gap-2 mb-4">
          {ENDPOINTS.map((e) => (
            <button
              key={e.id}
              onClick={() => { setSelectedEndpoint(e.id); sound.select(); }}
              className={`text-[10px] px-2 py-1 border font-mono transition-colors ${
                selectedEndpoint === e.id
                  ? "border-terminal-green text-terminal-green bg-terminal-green/5"
                  : "border-border-dim text-content-secondary hover:border-terminal-green"
              }`}
            >
              {e.path}
            </button>
          ))}
        </div>

        {/* Selected endpoint detail */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <StatusPill color="green">{endpoint.method}</StatusPill>
            <code className="text-xs text-terminal-green font-mono">{endpoint.path}</code>
          </div>
          <p className="text-xs text-content-secondary">{endpoint.description}</p>
        </div>

        {/* JSON preview */}
        <div className="relative">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-content-dim uppercase tracking-widest">SAMPLE RESPONSE</span>
            <button
              onClick={copyJson}
              className="text-[10px] px-2 py-0.5 border border-border-dim text-content-secondary hover:border-terminal-green hover:text-terminal-green"
            >
              {copied ? "✓ COPIED" : "COPY JSON"}
            </button>
          </div>
          <pre className="bg-void border border-border-dim p-3 text-[10px] text-terminal-green font-mono overflow-x-auto max-h-80 overflow-y-auto">
{json.length > 3000 ? json.slice(0, 3000) + "\n... (truncated — see full response at endpoint)" : json}
          </pre>
        </div>
      </TerminalCard>

      {/* Live query */}
      <TerminalCard title="LIVE QUERY // FETCH ANY COUNTRY" className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <code className="text-xs text-content-dim font-mono">
            GET /api/v1/countries/
          </code>
          <input
            type="text"
            value={queryIso3}
            onChange={(e) => setQueryIso3(e.target.value)}
            placeholder="ISO3"
            maxLength={3}
            className="bg-void border border-border-dim text-content-primary text-xs px-2 py-1 w-20 font-mono focus:border-terminal-green focus:outline-none uppercase"
          />
          <code className="text-xs text-content-dim font-mono">.json</code>
          <button
            onClick={runQuery}
            className="text-xs px-3 py-1 border border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-void font-bold"
          >
            [ RUN QUERY ]
          </button>
        </div>

        {queryResult && (
          <pre className="bg-void border border-border-dim p-3 text-[10px] text-terminal-green font-mono overflow-x-auto max-h-80 overflow-y-auto">
{queryResult.length > 3000 ? queryResult.slice(0, 3000) + "\n..." : queryResult}
          </pre>
        )}
      </TerminalCard>

      {/* Code samples */}
      <TerminalCard title="CODE SAMPLES // USE THE DATA" accent="green" className="mb-6">
        <div className="flex gap-2 mb-3">
          {(Object.keys(CODE_SAMPLES) as Array<keyof typeof CODE_SAMPLES>).map((lang) => (
            <button
              key={lang}
              onClick={() => { setCodeLang(lang); sound.select(); }}
              className={`text-[10px] px-2 py-1 border transition-colors ${
                codeLang === lang
                  ? "border-blood text-blood-bright"
                  : "border-border-dim text-content-secondary hover:border-blood"
              }`}
            >
              {CODE_SAMPLES[lang].lang}
            </button>
          ))}
        </div>
        <pre className="bg-void border border-border-dim p-3 text-[10px] text-content-primary font-mono overflow-x-auto">
{CODE_SAMPLES[codeLang].code}
        </pre>
      </TerminalCard>

      {/* Data schema overview */}
      <TerminalCard title="DATA SCHEMA // 23 DIMENSIONS" className="mb-6">
        <p className="text-xs text-content-dim mb-3">
          // Each country record has these nested objects. Full TypeScript definitions in lib/types.ts.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {[
            { name: "hunger", fields: ["undernourishment_pct", "child_stunting_pct", "famine_risk_1to5", "child_wasting_pct"] },
            { name: "conflict", fields: ["intensity_1to5", "displacement_m", "battle_deaths_total"] },
            { name: "health", fields: ["life_expectancy", "child_mortality_under5_per1k", "doctors_per_1000", "maternal_mortality"] },
            { name: "economy", fields: ["gdp_usd", "gdp_per_capita_usd"] },
            { name: "governance", fields: ["corruption_perceptions_index", "electoral_democracy_index"] },
            { name: "education", fields: ["literacy_rate_pct", "primary_enrollment_pct", "pisa_score"] },
            { name: "military", fields: ["expenditure_usd", "pct_gdp"] },
            { name: "climate", fields: ["co2_per_capita_t", "ghg_total_mt"] },
            { name: "migration", fields: ["refugees_origin", "refugees_hosted", "forcibly_displaced", "net_migration"] },
            { name: "security", fields: ["homicide_rate_per100k", "femicides_per_year", "prison_rate_per_100k"] },
            { name: "poverty", fields: ["headcount_365_pct", "headcount_685_pct"] },
            { name: "energy", fields: ["renewable_electric_pct", "no_access_electricity_m"] },
            { name: "justice", fields: ["prison_rate_per_100k", "rule_of_law_index", "pre_trial_pct"] },
            { name: "taxation", fields: ["tax_burden_pct_gdp", "consumption_tax_pct"] },
            { name: "food_security", fields: ["severe_food_insecurity_m", "food_cost_affordability_ratio"] },
          ].map((dim) => (
            <div key={dim.name} className="p-2 border border-border-dim bg-void">
              <div className="text-[10px] text-blood-bright font-bold uppercase">{dim.name}</div>
              <div className="text-[9px] text-content-dim mt-1">
                {dim.fields.map((f) => (
                  <div key={f} className="font-mono">{f}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </TerminalCard>

      {/* License */}
      <TerminalCard title="LICENSE // NO RIGHTS RESERVED" accent="green">
        <div className="text-xs text-content-secondary space-y-2">
          <p>
            All data is released under <span className="text-terminal-green font-bold">CC0 (Creative Commons Zero)</span> —
            no rights reserved. You may copy, modify, distribute, and perform the work, even for commercial
            purposes, all without asking permission.
          </p>
          <p className="text-content-dim">
            Attribution appreciated but not required: &quot;Data: V FOR X / FAO / WHO / World Bank / SIPRI / UNHCR&quot;
          </p>
          <p className="text-content-dim mt-2">
            Sources ({data.metadata.sources.length}): {data.metadata.sources.join(" · ")}
          </p>
        </div>
      </TerminalCard>
    </div>
  );
}
