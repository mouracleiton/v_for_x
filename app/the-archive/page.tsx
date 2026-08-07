"use client";

import { useState } from "react";
import backbone from "@/data/world_backbone.json";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import ShareableStat from "@/components/shared/ShareableStat";
import type { WorldBackbone } from "@/lib/types";
import DiffEngine from "@/components/shared/DiffEngine";

const data = backbone as WorldBackbone;

/* ══════════════════════════════════════════════════════════════════
   DATA SOURCES — detailed metadata for each of the 9 sources
   ══════════════════════════════════════════════════════════════════ */

interface SourceMeta {
  name: string;
  org: string;
  description: string;
  access: string;
  license: string;
  pill: { label: string; color: "blood" | "green" | "amber" };
}

const SOURCE_REGISTRY: Record<string, SourceMeta> = {
  "FAO SOFI Report 2024/2025": {
    name: "FAO SOFI Report 2024/2025",
    org: "UN Food and Agriculture Organization",
    description:
      "State of Food Security and Nutrition in the World. Primary source for global undernourishment prevalence, PoU figures, moderate/severe food insecurity (FIES), child stunting/wasting/overweight, and anemia prevalence. Forms the backbone of all hunger indicators across the dataset.",
    access: "Public dataset — fao.org/sofi",
    license: "CC BY-NC-SA 3.0 IGO",
    pill: { label: "CITED", color: "green" },
  },
  "WFP/ONU (Nov 2025)": {
    name: "WFP/ONU (Nov 2025)",
    org: "World Food Programme / United Nations",
    description:
      "Hunger hotspot classification and famine risk monitoring. Provides the WFP concern-tier classification system (highest_concern through concern) used to score and rank countries by acute food insecurity risk. Drives the hotspot_score field.",
    access: "Public dataset — wfp.org/publications",
    license: "CC BY-NC-SA 3.0 IGO",
    pill: { label: "CITED", color: "green" },
  },
  "Global Report on Food Crises 2025": {
    name: "Global Report on Food Crises 2025",
    org: "FSIN · FAO · WFP · EU · World Bank",
    description:
      "Multi-agency report on acute food insecurity (IPC/CH Phase 3+). Provides population figures in acute food insecurity (millions), the pop_acute_fi_m field, IPC Phase 5 famine flags, and children_sam_m (severe acute malnutrition) estimates.",
    access: "Public dataset — foodcrisesreport.org",
    license: "CC BY-NC-SA 3.0 IGO",
    pill: { label: "VERIFIED", color: "green" },
  },
  "IFAD 2022-2024": {
    name: "IFAD 2022-2024",
    org: "International Fund for Agricultural Development",
    description:
      "Smallholder agriculture intervention evidence. Income increase percentages, production gains, and market access improvements from IFAD project evaluations across 2022-2024. Drives the smallholder_agriculture intervention ROI fields.",
    access: "Public dataset — ifad.org/en/knowledge",
    license: "CC BY-NC-ND 3.0 IGO",
    pill: { label: "CITED", color: "amber" },
  },
  "Banco Mundial": {
    name: "Banco Mundial",
    org: "World Bank Group",
    description:
      "Macroeconomic and social indicators via the World Bank API. GDP (current USD), GDP per capita, life expectancy, health expenditure (% GDP and per capita), education enrollment, military expenditure, internet penetration, and population figures.",
    access: "Public dataset — data.worldbank.org",
    license: "CC BY 4.0",
    pill: { label: "VERIFIED", color: "green" },
  },
  "OMS/UNICEF": {
    name: "OMS/UNICEF",
    org: "World Health Organization / UNICEF",
    description:
      "Health outcomes, mortality, nutrition, and WASH data. Child mortality under-5 per 1k, infant mortality, maternal mortality per 100k, tuberculosis and HIV prevalence, basic/safe water access, sanitation coverage, and immunization indicators.",
    access: "Public dataset — who.int/data · data.unicef.org",
    license: "CC BY-NC-SA 3.0 IGO",
    pill: { label: "CITED", color: "green" },
  },
  "CGIAR": {
    name: "CGIAR",
    org: "Consultative Group on International Agricultural Research",
    description:
      "Agricultural R&D return-on-investment data. Annual percentage return on agricultural research investments, used in the agri_rd intervention evidence fields. Informs the scenario modeling for agricultural investment pathways.",
    access: "Public dataset — cgiar.org",
    license: "CC BY-NC-SA 4.0",
    pill: { label: "CITED", color: "amber" },
  },
  "SIPRI": {
    name: "SIPRI",
    org: "Stockholm International Peace Research Institute",
    description:
      "Military expenditure data. Global and per-country military spending in USD and as % of GDP. Provides the global_decade and annual global spending totals, and the comparative baseline against hunger-eradication costs.",
    access: "Public dataset — sipri.org/databases/milex",
    license: "CC BY-NC-ND 4.0",
    pill: { label: "VERIFIED", color: "green" },
  },
  "Laborde et al. (2021, Food Policy)": {
    name: "Laborde et al. (2021, Food Policy)",
    org: "Ceres2030 · Nature Research · Food Policy journal",
    description:
      "Peer-reviewed cost-to-end-hunger modeling from Ceres2030. Provides the annual cost-to-eradicate-hunger figure ($ billion/year), intervention cost-effectiveness estimates, and the foundational modeling framework adapted in the scenario engine.",
    access: "Academic — doi.org/10.1016/j.foodpol.2020.101958",
    license: "Fair use — academic citation",
    pill: { label: "VERIFIED", color: "green" },
  },
};

/* ══════════════════════════════════════════════════════════════════
   DIMENSION FIELD DEFINITIONS — all 19 dimensions, ~87 fields total
   ══════════════════════════════════════════════════════════════════ */

interface FieldDef {
  name: string;
  description: string;
  unit: string;
}

interface DimensionDef {
  key: string;
  label: string;
  icon: string;
  fields: FieldDef[];
}

const DIMENSIONS: DimensionDef[] = [
  {
    key: "demographics",
    label: "DEMOGRAPHICS",
    icon: "◈",
    fields: [
      { name: "population", description: "Total population (headcount)", unit: "persons" },
      { name: "population_year", description: "Reference year for population estimate", unit: "year" },
    ],
  },
  {
    key: "economy",
    label: "ECONOMY",
    icon: "$",
    fields: [
      { name: "gdp_usd", description: "Gross Domestic Product, current prices", unit: "USD" },
      { name: "gdp_per_capita_usd", description: "GDP divided by total population", unit: "USD/person" },
      { name: "gdp_year", description: "Reference year for GDP data", unit: "year" },
    ],
  },
  {
    key: "health",
    label: "HEALTH",
    icon: "✚",
    fields: [
      { name: "life_expectancy", description: "Life expectancy at birth", unit: "years" },
      { name: "life_expectancy_year", description: "Reference year", unit: "year" },
      { name: "child_mortality_under5_per1k", description: "Under-5 mortality rate", unit: "deaths/1k live births" },
      { name: "infant_mortality_per1k", description: "Infant mortality rate (<1 year)", unit: "deaths/1k live births" },
      { name: "maternal_mortality_per100k", description: "Maternal mortality ratio", unit: "deaths/100k live births" },
      { name: "expenditure_pct_gdp", description: "Health expenditure as share of GDP", unit: "%" },
      { name: "expenditure_per_capita_usd", description: "Per-capita health expenditure", unit: "USD/person" },
      { name: "tuberculosis_per100k", description: "Tuberculosis incidence", unit: "cases/100k" },
      { name: "hiv_prevalence_pct", description: "HIV prevalence among adults 15-49", unit: "%" },
    ],
  },
  {
    key: "human_development",
    label: "HUMAN DEVELOPMENT",
    icon: "▤",
    fields: [
      { name: "hdi", description: "Human Development Index (0-1 composite)", unit: "index 0–1" },
      { name: "hdi_category", description: "HDI tier classification", unit: "category" },
      { name: "hdi_year", description: "Reference year for HDI", unit: "year" },
    ],
  },
  {
    key: "military",
    label: "MILITARY",
    icon: "⚔",
    fields: [
      { name: "expenditure_usd", description: "Total military expenditure", unit: "USD" },
      { name: "pct_gdp", description: "Military spending as share of GDP", unit: "%" },
      { name: "year", description: "Reference year", unit: "year" },
    ],
  },
  {
    key: "climate",
    label: "CLIMATE",
    icon: "☁",
    fields: [
      { name: "co2_mt", description: "Total CO₂ emissions from fossil fuels", unit: "metric tons (millions)" },
      { name: "co2_per_capita_t", description: "CO₂ emissions per person", unit: "tons/person" },
      { name: "ghg_total_mt", description: "Total greenhouse gas emissions", unit: "Mt CO₂eq" },
      { name: "year", description: "Reference year for emissions data", unit: "year" },
    ],
  },
  {
    key: "inequality",
    label: "INEQUALITY",
    icon: "⊿",
    fields: [
      { name: "gini", description: "Gini coefficient (income inequality, 0=equality)", unit: "index 0–100" },
      { name: "year", description: "Reference year for Gini", unit: "year" },
      { name: "gini_year", description: "Alternate Gini reference year field", unit: "year" },
    ],
  },
  {
    key: "water_sanitation",
    label: "WATER & SANITATION",
    icon: "≋",
    fields: [
      { name: "basic_access_pct", description: "Population with basic drinking-water access", unit: "%" },
      { name: "year", description: "Reference year", unit: "year" },
      { name: "basic_sanitation_pct", description: "Population with basic sanitation", unit: "%" },
      { name: "safe_sanitation_pct", description: "Population with safely-managed sanitation", unit: "%" },
    ],
  },
  {
    key: "education",
    label: "EDUCATION",
    icon: "✎",
    fields: [
      { name: "literacy_rate_pct", description: "Adult literacy rate (15+)", unit: "%" },
      { name: "primary_enrollment_pct", description: "Primary school gross enrollment", unit: "%" },
      { name: "secondary_enrollment_pct", description: "Secondary school gross enrollment", unit: "%" },
      { name: "year", description: "Reference year for education data", unit: "year" },
      { name: "primary_completion_pct", description: "Primary completion rate", unit: "%" },
    ],
  },
  {
    key: "connectivity",
    label: "CONNECTIVITY",
    icon: "⌁",
    fields: [
      { name: "internet_users_pct", description: "Individuals using the internet", unit: "%" },
      { name: "broadband_per100", description: "Fixed broadband subscriptions", unit: "subs/100 people" },
      { name: "year", description: "Reference year", unit: "year" },
    ],
  },
  {
    key: "migration",
    label: "MIGRATION",
    icon: "⇄",
    fields: [
      { name: "refugees_origin", description: "Refugees originating from this country", unit: "persons" },
      { name: "refugees_hosted", description: "Refugees hosted/asylum in this country", unit: "persons" },
      { name: "asylum_seekers_origin", description: "Pending asylum seekers originating here", unit: "persons" },
      { name: "asylum_seekers_hosted", description: "Pending asylum seekers hosted", unit: "persons" },
      { name: "forcibly_displaced", description: "Total forcibly displaced (refugees+IDPs+asylum)", unit: "persons" },
      { name: "idps_disaster_new", description: "New internal displacements from disasters", unit: "persons" },
      { name: "net_migration", description: "Net migration rate", unit: "persons" },
      { name: "year", description: "Reference year", unit: "year" },
    ],
  },
  {
    key: "environment",
    label: "ENVIRONMENT",
    icon: "❀",
    fields: [
      { name: "forest_area_pct", description: "Forest area as share of land area", unit: "%" },
      { name: "renewable_energy_pct", description: "Renewable energy share of total consumption", unit: "%" },
      { name: "air_pollution_pm25_ugm3", description: "PM2.5 mean annual exposure", unit: "µg/m³" },
      { name: "year", description: "Reference year", unit: "year" },
      { name: "forest_area_km2", description: "Forest area in absolute terms", unit: "km²" },
    ],
  },
  {
    key: "gender",
    label: "GENDER",
    icon: "♀",
    fields: [
      { name: "female_labor_force_pct", description: "Female share of labor force", unit: "%" },
      { name: "women_parliament_pct", description: "Women in national parliament seats", unit: "%" },
      { name: "year", description: "Reference year", unit: "year" },
    ],
  },
  {
    key: "governance",
    label: "GOVERNANCE",
    icon: "§",
    fields: [
      { name: "electoral_democracy_index", description: "V-Dem electoral democracy index", unit: "index 0–1" },
      { name: "democracy_year", description: "Reference year for democracy index", unit: "year" },
      { name: "corruption_perceptions_index", description: "Transparency International CPI", unit: "index 0–100" },
      { name: "cpi_year", description: "Reference year for CPI", unit: "year" },
      { name: "political_corruption_index", description: "V-Dem political corruption index", unit: "index 0–1" },
      { name: "political_corruption_year", description: "Reference year for political corruption", unit: "year" },
    ],
  },
  {
    key: "security",
    label: "SECURITY",
    icon: "◉",
    fields: [
      { name: "homicide_rate_per100k", description: "Intentional homicide rate", unit: "deaths/100k" },
      { name: "homicide_male_per100k", description: "Male homicide rate", unit: "deaths/100k" },
      { name: "homicide_female_per100k", description: "Female homicide rate", unit: "deaths/100k" },
    ],
  },
  {
    key: "poverty",
    label: "POVERTY",
    icon: "☷",
    fields: [
      { name: "headcount_365_pct", description: "Population below $3.65/day (2017 PPP)", unit: "%" },
      { name: "headcount_685_pct", description: "Population below $6.85/day (2017 PPP)", unit: "%" },
    ],
  },
  {
    key: "employment",
    label: "EMPLOYMENT",
    icon: "⚙",
    fields: [
      { name: "unemployment_pct", description: "Total unemployment rate (modeled ILO)", unit: "%" },
      { name: "youth_unemployment_pct", description: "Youth (15-24) unemployment rate", unit: "%" },
    ],
  },
  {
    key: "hunger",
    label: "HUNGER",
    icon: "◎",
    fields: [
      { name: "pop_acute_fi_m", description: "Population in acute food insecurity (IPC/CH Phase 3+)", unit: "millions" },
      { name: "prevalence_pct", description: "Prevalence of undernourishment (PoU)", unit: "%" },
      { name: "children_sam_m", description: "Children with severe acute malnutrition", unit: "millions" },
      { name: "ipc_phase5", description: "IPC Phase 5 (Catastrophe/Famine) flag", unit: "boolean" },
      { name: "famine_risk_1to5", description: "Famine risk classification score", unit: "1–5" },
      { name: "wfp_class", description: "WFP hotspot concern tier", unit: "category" },
      { name: "undernourishment_pct", description: "Undernourishment prevalence (3-year avg)", unit: "%" },
      { name: "child_stunting_pct", description: "Children under-5 stunted (height-for-age)", unit: "%" },
      { name: "child_overweight_pct", description: "Children under-5 overweight", unit: "%" },
      { name: "anemia_prevalence_pct", description: "Anemia prevalence among women 15-49", unit: "%" },
      { name: "child_wasting_pct", description: "Children under-5 wasted (weight-for-height)", unit: "%" },
      { name: "food_insecurity_mod_severe_pct", description: "Moderate or severe food insecurity (FIES)", unit: "%" },
    ],
  },
  {
    key: "conflict",
    label: "CONFLICT",
    icon: "✕",
    fields: [
      { name: "intensity_1to5", description: "Armed conflict intensity level (UCDP-based)", unit: "1–5" },
      { name: "displacement_m", description: "Conflict-driven displacement", unit: "millions" },
      { name: "access_blocked_1to5", description: "Humanitarian access obstruction level", unit: "1–5" },
      { name: "battle_deaths_total", description: "Total battle-related deaths", unit: "deaths" },
      { name: "deaths_1", description: "Conflict deaths category 1 (low-intensity)", unit: "deaths" },
      { name: "deaths_2", description: "Conflict deaths category 2", unit: "deaths" },
      { name: "deaths_3", description: "Conflict deaths category 3", unit: "deaths" },
      { name: "deaths_4", description: "Conflict deaths category 4", unit: "deaths" },
      { name: "deaths_5", description: "Conflict deaths category 5 (high-intensity)", unit: "deaths" },
    ],
  },
];

/* ══════════════════════════════════════════════════════════════════
   CITATION STRINGS
   ══════════════════════════════════════════════════════════════════ */

const CITATIONS: string[] = [
  'V FOR X. "The Archive — Evidence Library." Data spine v' +
    data.metadata.schema_version +
    ", " +
    data.metadata.total_countries +
    " countries, 19 dimensions. CC0-1.0. Accessed " +
    new Date().toISOString().split("T")[0] +
    ".",
  'V FOR X (2026). Unified World Data Backbone [dataset]. Schema v' +
    data.metadata.schema_version +
    ". Standard: " +
    data.metadata.standard +
    ". License: CC0-1.0.",
  "Sources: " +
    data.metadata.sources.join("; ") +
    ".",
];

export default function TheArchivePage() {
  const [openDim, setOpenDim] = useState<string | null>("hunger");

  const toggleDim = (key: string) => {
    setOpenDim((prev) => (prev === key ? null : key));
  };

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-5xl mx-auto">
      {/* ══ HEADER ══ */}
      <div className="mb-8 pt-4">
        <div className="text-xs text-content-dim mb-1">[10] THE ARCHIVE</div>
        <h1 className="text-2xl md:text-3xl text-blood-bright font-bold glow-blood">
          THE ARCHIVE
        </h1>
        <p className="text-content-secondary text-sm mt-2">
          // Sources. Methods. Field definitions. Every number traceable to its origin.
        </p>
      </div>

      {/* ══ METADATA STRIP ══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-8 text-xs">
        <div className="border border-border-dim p-2">
          <div className="text-content-dim">SCHEMA VERSION</div>
          <div className="text-terminal-green font-mono">{data.metadata.schema_version}</div>
        </div>
        <div className="border border-border-dim p-2">
          <div className="text-content-dim">COUNTRIES</div>
          <div className="text-terminal-green font-mono">{data.metadata.total_countries}</div>
        </div>
        <div className="border border-border-dim p-2">
          <div className="text-content-dim">CREATED</div>
          <div className="text-terminal-green font-mono">{data.metadata.created}</div>
        </div>
        <div className="border border-border-dim p-2">
          <div className="text-content-dim">LICENSE</div>
          <div className="text-warning-amber font-mono">{data.metadata.license}</div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 1 — DATA SOURCES
          ══════════════════════════════════════════════════════════════ */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-blood-bright text-lg">§01</span>
          <h2 className="text-lg text-content-primary font-bold tracking-wide">
            DATA SOURCES
          </h2>
          <StatusPill color="green">{data.metadata.sources.length} CITED</StatusPill>
        </div>
        <p className="text-content-secondary text-xs mb-5">
          Every indicator in the data spine traces back to one or more of these {data.metadata.sources.length} primary sources. No data is inferred without attribution.
        </p>

        <div className="grid gap-3">
          {data.metadata.sources.map((sourceName, idx) => {
            const meta = SOURCE_REGISTRY[sourceName];
            if (!meta) {
              return (
                <TerminalCard key={idx} title={sourceName} accent="amber">
                  <p className="text-xs text-content-secondary">
                    Source metadata not yet registered in the archive. Pending documentation.
                  </p>
                </TerminalCard>
              );
            }
            return (
              <TerminalCard key={idx} accent={meta.pill.color === "green" ? "green" : meta.pill.color === "amber" ? "amber" : "blood"}>
                <div className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-content-dim font-mono text-xs">
                        [{String(idx + 1).padStart(2, "0")}]
                      </span>
                      <span className="text-blood-bright font-bold text-sm">
                        {meta.name}
                      </span>
                    </div>
                    <StatusPill color={meta.pill.color}>{meta.pill.label}</StatusPill>
                  </div>

                  <div className="text-xs text-terminal-green font-mono">{meta.org}</div>

                  <p className="text-xs text-content-secondary leading-relaxed">
                    {meta.description}
                  </p>

                  <div className="flex flex-wrap gap-4 mt-1 text-xs">
                    <div>
                      <span className="text-content-dim">ACCESS ▸ </span>
                      <span className="text-content-primary font-mono">{meta.access}</span>
                    </div>
                    <div>
                      <span className="text-content-dim">LICENSE ▸ </span>
                      <span className="text-warning-amber font-mono">{meta.license}</span>
                    </div>
                  </div>
                </div>
              </TerminalCard>
            );
          })}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 2 — METHODOLOGY
          ══════════════════════════════════════════════════════════════ */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-blood-bright text-lg">§02</span>
          <h2 className="text-lg text-content-primary font-bold tracking-wide">
            METHODOLOGY
          </h2>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {/* Schema */}
          <TerminalCard title="SCHEMA ARCHITECTURE" accent="green">
            <p className="text-xs text-content-secondary leading-relaxed mb-3">
              The data spine is a flat relational structure:{" "}
              <span className="text-terminal-green font-mono">
                {data.metadata.total_countries} countries × 19 dimensions × ~87 fields
              </span>
              . Every country is a row identified by{" "}
              <span className="text-terminal-green font-mono">ISO3</span> code, with all
              dimensional data joined on that key.
            </p>
            <div className="flex flex-wrap gap-2">
              <StatusPill color="dim">{data.metadata.standard}</StatusPill>
              <StatusPill color="green">{data.metadata.total_countries} ROWS</StatusPill>
              <StatusPill color="amber">19 DIMENSIONS</StatusPill>
            </div>
          </TerminalCard>

          {/* Hotspot scoring */}
          <TerminalCard title="HOTSPOT SCORING" accent="blood" glow>
            <p className="text-xs text-content-secondary leading-relaxed mb-3">
              Countries are classified into WFP concern tiers based on acute food
              insecurity, famine risk, and conflict intensity. The{" "}
              <span className="text-blood-bright font-mono">hotspot_score</span> field
              aggregates these into a sortable ranking.
            </p>
            <div className="space-y-1">
              {[
                { tier: "highest_concern", label: "HIGHEST CONCERN", color: "blood" as const },
                { tier: "very_high_concern", label: "VERY HIGH CONCERN", color: "blood" as const },
                { tier: "high_concern", label: "HIGH CONCERN", color: "amber" as const },
                { tier: "concern", label: "CONCERN", color: "amber" as const },
              ].map((t) => {
                const count = data.hotspots.wfp_classification?.[t.tier]?.length ?? 0;
                return (
                  <div key={t.tier} className="flex items-center justify-between text-xs">
                    <StatusPill color={t.color}>{t.label}</StatusPill>
                    <span className="text-content-dim font-mono">
                      {count > 0 ? `${count} countries` : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </TerminalCard>

          {/* Scenario modeling */}
          <TerminalCard title="SCENARIO MODELING" accent="amber">
            <p className="text-xs text-content-secondary leading-relaxed mb-3">
              Five budget-level scenarios project hunger trajectories from{" "}
              <span className="text-warning-amber font-mono">2025–2034</span>. Each
              allocates annual funding across intervention pathways, calculates
              cumulative costs, deaths avoided, and aggregate return-on-investment
              (ROI).
            </p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-content-dim">SCENARIOS</span>
                <span className="text-warning-amber font-mono">
                  {Object.keys(data.scenarios).length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-content-dim">TIMEFRAME</span>
                <span className="text-warning-amber font-mono">2025 → 2034</span>
              </div>
              <div className="flex justify-between">
                <span className="text-content-dim">TARGET</span>
                <span className="text-terminal-green font-mono">SDG2 (Zero Hunger)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-content-dim">RECOMMENDED</span>
                <span className="text-blood-bright font-mono">
                  ${data.financing.annual_budget_billion}B/yr
                </span>
              </div>
            </div>
          </TerminalCard>

          {/* CPI / Democracy scales */}
          <TerminalCard title="GOVERNANCE SCALES" accent="green">
            <p className="text-xs text-content-secondary leading-relaxed mb-3">
              Two governance indices use fixed scales for cross-country comparison.
            </p>
            <div className="space-y-2 text-xs">
              <div>
                <span className="text-terminal-green font-mono">CPI (Transparency International)</span>
                <p className="text-content-dim mt-0.5">
                  Range 0–100. 0 = highly corrupt, 100 = very clean. Higher is better.
                </p>
              </div>
              <div>
                <span className="text-terminal-green font-mono">V-Dem Electoral Democracy Index</span>
                <p className="text-content-dim mt-0.5">
                  Range 0.000–1.000. Composite of freedom of expression, free elections,
                  suffrage, and institutional checks. Higher is more democratic.
                </p>
              </div>
              <div>
                <span className="text-terminal-green font-mono">V-Dem Political Corruption Index</span>
                <p className="text-content-dim mt-0.5">
                  Range 0–1 (reverse-scaled). Lower values indicate higher corruption
                  exposure in public sector.
                </p>
              </div>
            </div>
          </TerminalCard>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 3 — FIELD DEFINITIONS
          ══════════════════════════════════════════════════════════════ */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-blood-bright text-lg">§03</span>
          <h2 className="text-lg text-content-primary font-bold tracking-wide">
            FIELD DEFINITIONS
          </h2>
          <StatusPill color="dim">
            {DIMENSIONS.length} DIMENSIONS · ~{DIMENSIONS.reduce((acc, d) => acc + d.fields.length, 0)} FIELDS
          </StatusPill>
        </div>
        <p className="text-content-secondary text-xs mb-5">
          Click any dimension to expand its field definitions. Every field is typed in{" "}
          <span className="text-terminal-green font-mono">lib/types.ts</span> and stored in{" "}
          <span className="text-terminal-green font-mono">world_backbone.json</span>.
        </p>

        <div className="space-y-1">
          {DIMENSIONS.map((dim) => {
            const isOpen = openDim === dim.key;
            return (
              <div key={dim.key} className="border border-border-dim">
                {/* Header row */}
                <button
                  onClick={() => toggleDim(dim.key)}
                  className="w-full flex items-center justify-between p-3 text-left hover:bg-panel transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-blood-bright font-mono text-sm w-5 text-center">
                      {dim.icon}
                    </span>
                    <span className="text-content-primary text-sm font-bold tracking-wide">
                      {dim.label}
                    </span>
                    <span className="text-content-dim font-mono text-xs">{dim.key}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-content-dim text-xs font-mono">
                      {dim.fields.length} fields
                    </span>
                    <span className={`text-blood-bright text-xs ${isOpen ? "rotate-90 inline-block" : ""}`}>
                      ▸
                    </span>
                  </div>
                </button>

                {/* Expanded fields */}
                {isOpen && (
                  <div className="border-t border-border-dim">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-content-dim border-b border-border-dim">
                          <th className="text-left py-1 px-3 w-1/3">FIELD</th>
                          <th className="text-left py-1 px-3">DESCRIPTION</th>
                          <th className="text-left py-1 px-3 w-1/6">UNIT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dim.fields.map((field, fi) => (
                          <tr
                            key={fi}
                            className="border-b border-border-dim last:border-b-0 hover:bg-panel"
                          >
                            <td className="py-1.5 px-3 text-terminal-green font-mono align-top">
                              {field.name}
                            </td>
                            <td className="py-1.5 px-3 text-content-secondary align-top">
                              {field.description}
                            </td>
                            <td className="py-1.5 px-3 text-warning-amber font-mono align-top">
                              {field.unit}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 4 — CITATION
          ══════════════════════════════════════════════════════════════ */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-blood-bright text-lg">§04</span>
          <h2 className="text-lg text-content-primary font-bold tracking-wide">
            CITATION &amp; LICENSE
          </h2>
        </div>

        <TerminalCard title="OPEN DATA LICENSE" accent="amber">
          <p className="text-xs text-content-secondary leading-relaxed mb-3">
            This dataset is released under{" "}
            <span className="text-warning-amber font-mono">{data.metadata.license}</span>{" "}
            (Creative Commons Zero / Public Domain Dedication). You are free to copy,
            modify, distribute, and perform the work — even for commercial purposes —
            without asking permission.
          </p>
          <div className="flex flex-wrap gap-2">
            <StatusPill color="green">CC0-1.0</StatusPill>
            <StatusPill color="dim">NO ATTRIBUTION REQUIRED</StatusPill>
            <StatusPill color="dim">COMMERCIAL USE OK</StatusPill>
          </div>
        </TerminalCard>

        <div className="mt-4">
          <div className="text-xs text-content-dim mb-2 uppercase tracking-widest">
            // Recommended citation formats — click to copy
          </div>
          <div className="space-y-2">
            {CITATIONS.map((citation, idx) => (
              <ShareableStat key={idx} text={citation} />
            ))}
          </div>
        </div>

        <div className="mt-4 border border-border-dim p-3 text-xs text-content-dim">
          <span className="text-blood-bright font-mono">NOTE ▸</span>{" "}
          Underlying source data retains its original licenses (see §01 per-source
          license fields). The CC0 dedication applies to the compiled dataset and
          platform code only.
        </div>
      </section>

      {/* ══ FOOTER ══ */}
      <div className="border-t border-border-dim pt-4 mt-8 text-xs text-content-dim font-mono">
        <div className="flex flex-wrap justify-between gap-2">
          <span>// END OF ARCHIVE</span>
          <span>
            {data.metadata.total_countries} COUNTRIES · {DIMENSIONS.length} DIMENSIONS ·{" "}
            {DIMENSIONS.reduce((acc, d) => acc + d.fields.length, 0)} FIELDS · v{data.metadata.schema_version}
          </span>
        </div>
      </div>

      {/* ══ PUBLIC DATA API ══ */}
      <section className="mt-8">
        <h2 className="text-sm uppercase tracking-widest text-blood-bright mb-4">
          §05 // PUBLIC DATA API
        </h2>
        <TerminalCard title="JSON API — READ-ONLY, CC0" accent="green">
          <p className="text-xs text-content-secondary mb-4">
            The entire dataset is served as static JSON. No keys, no rate limits, no authentication.
            Build apps, dashboards, research tools on top of this data.
          </p>
          <div className="space-y-2">
            {[
              { path: "/api/v1/index.json", desc: "API metadata + endpoint directory" },
              { path: "/api/v1/countries.json", desc: "All 200 countries — summary (name, region, key stats)" },
              { path: "/api/v1/countries/{ISO3}.json", desc: "Full country record (all 19 dimensions)" },
              { path: "/api/v1/equations.json", desc: "6 cross-domain SDG equations" },
              { path: "/api/v1/hotspots.json", desc: "22 WFP-classified hunger hotspots" },
            ].map((ep) => (
              <div key={ep.path} className="flex items-center gap-3 p-2 border border-border-dim bg-void">
                <StatusPill color="green">GET</StatusPill>
                <code className="text-xs text-blood-bright font-mono flex-1">{ep.path}</code>
                <span className="text-[10px] text-content-dim hidden sm:inline">{ep.desc}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 border border-terminal-green bg-terminal-green/5">
            <div className="text-[10px] text-content-dim uppercase tracking-widest mb-1">EXAMPLE</div>
            <pre className="text-[10px] text-terminal-green font-mono overflow-x-auto">{`curl https://mouracleiton.github.io/v_for_x/api/v1/countries/SSD.json | jq .`}</pre>
            <div className="text-[10px] text-content-dim mt-1">
              Returns the full South Sudan record — all health, education, water, climate, governance data.
            </div>
          </div>
          <div className="text-[10px] text-content-dim italic mt-3">
            ▸ Base URL: https://mouracleiton.github.io/v_for_x · License: CC0 · {data.metadata.total_countries} countries
          </div>
        </TerminalCard>
      </section>

      {/* ══ DATA DIFF ENGINE ══ */}
      <section className="mt-8">
        <h2 className="text-sm uppercase tracking-widest text-blood-bright mb-4">
          §06 // DATA DIFF ENGINE
        </h2>
        <DiffEngine />
      </section>
    </div>
  );
}
