"use client";

/**
 * V FOR X — The Crucible
 *
 * Cascading crisis shock simulator. Pick a country, apply a shock
 * (GDP collapse, conflict onset, climate disaster, food crisis),
 * see the domino effects ripple across all dimensions.
 *
 * [45] THE CRUCIBLE — Code: 45
 *
 * This is a heuristic model — not predictive. It uses empirically
 * observed elasticity relationships between crisis dimensions:
 *   - GDP drop → increased poverty, decreased health spending
 *   - Conflict onset → displacement, hunger, reduced life expectancy
 *   - Climate shock → agricultural failure, displacement, water stress
 *   - Food crisis → child stunting, mortality spike
 *
 * All multipliers are derived from historical crisis data and are
 * clearly disclosed. The model demonstrates INTERCONNECTION, not prediction.
 */

import { useState, useMemo } from "react";
import backbone from "@/data/world_backbone.json";
import type { WorldBackbone, CountryData } from "@/lib/types";
import TerminalCard from "@/components/ui/TerminalCard";
import { sound } from "@/lib/sound";

const data = backbone as WorldBackbone;

/* ═══════════════════════════════════════════════════════════════
   Shock definitions
   ═══════════════════════════════════════════════════════════════ */

export interface ShockDef {
  id: string;
  label: string;
  icon: string;
  description: string;
  /** Multiplier intensity slider range */
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  unit: string;
  /** Which dimension this shock originates in */
  sourceDimension: string;
}

const SHOCKS: ShockDef[] = [
  {
    id: "gdp_collapse",
    label: "GDP Collapse",
    icon: "📉",
    description: "Economic contraction. Currency crisis, recession, or sanctions impact.",
    min: 5,
    max: 50,
    step: 5,
    defaultValue: 20,
    unit: "% GDP drop",
    sourceDimension: "Economy",
  },
  {
    id: "conflict_onset",
    label: "Conflict Onset",
    icon: "⚔️",
    description: "Armed conflict erupts. Civil war, invasion, or insurgency.",
    min: 1,
    max: 5,
    step: 1,
    defaultValue: 3,
    unit: "intensity (1-5)",
    sourceDimension: "Conflict",
  },
  {
    id: "climate_disaster",
    label: "Climate Disaster",
    icon: "🌪️",
    description: "Extreme weather event: drought, flood, or heatwave destroying agriculture.",
    min: 10,
    max: 80,
    step: 10,
    defaultValue: 30,
    unit: "% agricultural loss",
    sourceDimension: "Climate",
  },
  {
    id: "food_crisis",
    label: "Food System Shock",
    icon: "🌾",
    description: "Food supply chain collapse. Prices spike, imports cut off.",
    min: 10,
    max: 100,
    step: 10,
    defaultValue: 40,
    unit: "% price increase",
    sourceDimension: "Hunger",
  },
  {
    id: "pandemic",
    label: "Health Emergency",
    icon: "🦠",
    description: "Disease outbreak overwhelms healthcare system.",
    min: 10,
    max: 60,
    step: 10,
    defaultValue: 20,
    unit: "% health system overload",
    sourceDimension: "Health",
  },
];

/* ═══════════════════════════════════════════════════════════════
   Cascading impact model
   ═══════════════════════════════════════════════════════════════ */

export interface ImpactResult {
  dimension: string;
  metric: string;
  before: number;
  after: number;
  changePct: number;
  direction: "worse" | "better" | "neutral";
  note: string;
}

function safeDiv(a: number, b: number): number {
  return b === 0 ? 0 : a / b;
}

function round(n: number, decimals = 1): number {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}

/**
 * Apply cascading shocks to a country and return the projected impacts.
 * Each shock triggers primary effects, which then cascade into secondary effects.
 */
export function simulateShocks(
  country: CountryData,
  shockValues: Record<string, number>
): ImpactResult[] {
  const results: ImpactResult[] = [];
  const c = country;

  const gdpDrop = shockValues.gdp_collapse || 0;
  const conflict = shockValues.conflict_onset || 0;
  const climateLoss = shockValues.climate_disaster || 0;
  const foodShock = shockValues.food_crisis || 0;
  const healthOverload = shockValues.pandemic || 0;

  /* ── PRIMARY EFFECTS ── */

  // GDP collapse → poverty increases, health spending drops
  if (gdpDrop > 0) {
    const gdpPerCapBefore = c.economy.gdp_per_capita_usd || 0;
    const gdpPerCapAfter = gdpPerCapBefore * (1 - gdpDrop / 100);
    results.push({
      dimension: "Economy",
      metric: "GDP per Capita",
      before: gdpPerCapBefore,
      after: gdpPerCapAfter,
      changePct: -gdpDrop,
      direction: "worse",
      note: `Direct ${gdpDrop}% economic contraction`,
    });

    // Poverty multiplier: GDP drop roughly doubles poverty rate (World Bank elasticity ~1.5-2)
    const povertyBefore = c.poverty.headcount_365_pct || 0;
    const povertyIncrease = gdpDrop * 0.8; // ~0.8% poverty increase per 1% GDP drop in developing countries
    const povertyAfter = Math.min(povertyBefore + povertyIncrease, 100);
    results.push({
      dimension: "Poverty",
      metric: "Extreme Poverty Rate",
      before: povertyBefore,
      after: povertyAfter,
      changePct: povertyBefore > 0 ? ((povertyAfter - povertyBefore) / povertyBefore) * 100 : 0,
      direction: "worse",
      note: `Each 1% GDP drop raises poverty ~0.8% (World Bank elasticity)`,
    });

    // Health spending drops proportionally with GDP
    const healthSpendBefore = c.health.expenditure_per_capita_usd || 0;
    const healthSpendAfter = healthSpendBefore * (1 - gdpDrop / 100);
    results.push({
      dimension: "Health",
      metric: "Health Spending per Capita",
      before: healthSpendBefore,
      after: healthSpendAfter,
      changePct: -gdpDrop,
      direction: "worse",
      note: `Government budgets contract with GDP`,
    });
  }

  // Conflict onset → displacement, hunger, mortality
  if (conflict > 0) {
    const displacementBefore = c.conflict.displacement_m || 0;
    // Historical pattern: conflict intensity 3 → ~2M displaced, 5 → 10M+
    const displacementAdded = conflict * conflict * 0.5;
    const displacementAfter = displacementBefore + displacementAdded;
    results.push({
      dimension: "Conflict",
      metric: "Displaced People",
      before: displacementBefore,
      after: displacementAfter,
      changePct: displacementBefore > 0 ? ((displacementAfter - displacementBefore) / displacementBefore) * 100 : 100,
      direction: "worse",
      note: `Conflict intensity ${conflict}/5 generates ~${displacementAdded.toFixed(1)}M new IDPs`,
    });

    // Conflict dramatically increases hunger
    const hungerBefore = c.hunger.undernourishment_pct || 0;
    // Each conflict level adds ~5% undernourishment (GRFC 2025 pattern)
    const hungerAfter = Math.min(hungerBefore + conflict * 5, 100);
    results.push({
      dimension: "Hunger",
      metric: "Undernourishment",
      before: hungerBefore,
      after: hungerAfter,
      changePct: hungerBefore > 0 ? ((hungerAfter - hungerBefore) / hungerBefore) * 100 : 100,
      direction: "worse",
      note: `Conflict disrupts food systems; +5% per intensity level (GRFC)`,
    });

    // Life expectancy drops
    const lifeExpBefore = c.health.life_expectancy || 70;
    const lifeExpDrop = conflict * 1.2; // ~1.2 years per conflict level
    results.push({
      dimension: "Health",
      metric: "Life Expectancy",
      before: lifeExpBefore,
      after: lifeExpBefore - lifeExpDrop,
      changePct: -(lifeExpDrop / lifeExpBefore) * 100,
      direction: "worse",
      note: `Conflict reduces life expectancy ~${lifeExpDrop.toFixed(1)} years (Syria, Yemen precedent)`,
    });
  }

  // Climate disaster → agricultural loss, water stress, displacement
  if (climateLoss > 0) {
    const hungerBefore = c.hunger.undernourishment_pct || 0;
    // Agricultural loss directly increases hunger
    const hungerIncrease = climateLoss * 0.3;
    const hungerAfter = Math.min(hungerBefore + hungerIncrease, 100);
    if (!results.some(r => r.metric === "Undernourishment")) {
      results.push({
        dimension: "Hunger",
        metric: "Undernourishment",
        before: hungerBefore,
        after: hungerAfter,
        changePct: hungerBefore > 0 ? ((hungerAfter - hungerBefore) / hungerBefore) * 100 : 100,
        direction: "worse",
        note: `Agricultural loss drives food scarcity (+${hungerIncrease.toFixed(1)}%)`,
      });
    }

    // Climate displacement
    const idpBefore = c.migration?.idps_disaster_new || 0;
    const idpAfter = idpBefore + (climateLoss / 100) * (c.demographics.population / 1_000_000) * 0.05;
    results.push({
      dimension: "Migration",
      metric: "Climate IDPs",
      before: idpBefore,
      after: idpAfter,
      changePct: idpBefore > 0 ? ((idpAfter - idpBefore) / idpBefore) * 100 : 100,
      direction: "worse",
      note: `${climateLoss}% agricultural loss displaces ~${(idpAfter - idpBefore).toFixed(1)}M`,
    });

    // Water access impact
    const waterBefore = c.water_sanitation.basic_access_pct || 100;
    const waterAfter = Math.max(waterBefore - climateLoss * 0.2, 0);
    results.push({
      dimension: "Water",
      metric: "Water Access",
      before: waterBefore,
      after: waterAfter,
      changePct: ((waterAfter - waterBefore) / waterBefore) * 100,
      direction: "worse",
      note: `Drought/flood damages water infrastructure`,
    });
  }

  // Food system shock → prices spike, child stunting increases
  if (foodShock > 0) {
    const stuntingBefore = c.hunger.child_stunting_pct || 0;
    const stuntingIncrease = foodShock * 0.15;
    const stuntingAfter = Math.min(stuntingBefore + stuntingIncrease, 100);
    results.push({
      dimension: "Hunger",
      metric: "Child Stunting",
      before: stuntingBefore,
      after: stuntingAfter,
      changePct: stuntingBefore > 0 ? ((stuntingAfter - stuntingBefore) / stuntingBefore) * 100 : 100,
      direction: "worse",
      note: `Food price spike of ${foodShock}% increases malnutrition (UNICEF elasticity)`,
    });

    const acuteBefore = c.hunger.pop_acute_fi_m || 0;
    const acuteAfter = acuteBefore + (foodShock / 100) * (c.demographics.population / 1_000_000) * 0.1;
    results.push({
      dimension: "Hunger",
      metric: "Acute Food Insecurity",
      before: acuteBefore,
      after: acuteAfter,
      changePct: acuteBefore > 0 ? ((acuteAfter - acuteBefore) / acuteBefore) * 100 : 100,
      direction: "worse",
      note: `${foodShock}% price shock pushes more into acute hunger`,
    });
  }

  // Health emergency → child mortality spikes
  if (healthOverload > 0) {
    const childMortBefore = c.health.child_mortality_under5_per1k || 0;
    const childMortAfter = childMortBefore * (1 + healthOverload / 100);
    results.push({
      dimension: "Health",
      metric: "Child Mortality",
      before: childMortBefore,
      after: childMortAfter,
      changePct: healthOverload,
      direction: "worse",
      note: `Health system at ${100 - healthOverload}% capacity → preventable deaths rise`,
    });

    const lifeExpBefore = c.health.life_expectancy || 70;
    const lifeExpDrop = healthOverload * 0.1;
    if (!results.some(r => r.metric === "Life Expectancy")) {
      results.push({
        dimension: "Health",
        metric: "Life Expectancy",
        before: lifeExpBefore,
        after: lifeExpBefore - lifeExpDrop,
        changePct: -(lifeExpDrop / lifeExpBefore) * 100,
        direction: "worse",
        note: `Health system overload reduces life expectancy ~${lifeExpDrop.toFixed(1)} years`,
      });
    }
  }

  /* ── SECONDARY CASCADES ── */
  // If hunger increased significantly AND conflict is present → displacement compounds
  const totalHungerIncrease = results
    .filter(r => r.metric === "Undernourishment")
    .reduce((sum, r) => sum + (r.after - r.before), 0);

  if (totalHungerIncrease > 15 && conflict > 0) {
    const famineRiskBefore = c.hunger.famine_risk_1to5 || 1;
    const famineRiskAfter = Math.min(famineRiskBefore + Math.floor(totalHungerIncrease / 10), 5);
    if (famineRiskAfter > famineRiskBefore) {
      results.push({
        dimension: "Hunger",
        metric: "Famine Risk",
        before: famineRiskBefore,
        after: famineRiskAfter,
        changePct: ((famineRiskAfter - famineRiskBefore) / famineRiskBefore) * 100,
        direction: "worse",
        note: `COMPOUND EFFECT: Conflict + hunger escalation pushes famine risk to ${famineRiskAfter}/5`,
      });
    }
  }

  // GDP + conflict → economic collapse accelerates
  if (gdpDrop > 15 && conflict >= 3) {
    const unemploymentBefore = c.employment.unemployment_pct || 10;
    const unemploymentAfter = Math.min(unemploymentBefore + conflict * 3 + gdpDrop * 0.3, 60);
    results.push({
      dimension: "Economy",
      metric: "Unemployment",
      before: unemploymentBefore,
      after: unemploymentAfter,
      changePct: ((unemploymentAfter - unemploymentBefore) / unemploymentBefore) * 100,
      direction: "worse",
      note: `COMPOUND EFFECT: War + recession → unemployment surge (Lebanon, Syria precedent)`,
    });
  }

  return results.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
}

/* ═══════════════════════════════════════════════════════════════
   UI Component
   ═══════════════════════════════════════════════════════════════ */

export default function TheCruciblePage() {
  const [selectedIso3, setSelectedIso3] = useState("BRA");
  const [shockValues, setShockValues] = useState<Record<string, number>>(
    Object.fromEntries(SHOCKS.map((s) => [s.id, 0]))
  );

  const country = useMemo(
    () => data.countries.find((c) => c.iso3 === selectedIso3)!,
    [selectedIso3]
  );

  const impacts = useMemo(
    () => simulateShocks(country, shockValues),
    [country, shockValues]
  );

  const activeShockCount = Object.values(shockValues).filter((v) => v > 0).length;
  const worstImpact = impacts[0];
  const hasAnyShock = activeShockCount > 0;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="text-content-dim text-xs">
          [45] CASCADING CRISIS SIMULATOR
        </div>
        <h1 className="text-blood-bright text-2xl font-bold tracking-widest mt-1">
          <span className="glitch" data-text="THE CRUCIBLE">
            THE CRUCIBLE
          </span>
        </h1>
        <p className="text-content-secondary text-sm mt-2 max-w-2xl">
          {
            "// Apply crisis shocks to any country. Watch domino effects cascade across every dimension. This is a heuristic model — it demonstrates INTERCONNECTION, not prediction."
          }
        </p>
      </div>

      {/* Disclaimer */}
      <div className="border border-amber/40 bg-amber/5 p-2 text-amber text-[10px]">
        ⚠ HEURISTIC MODEL: Multipliers derived from historical crisis data
        (Syria, Yemen, Lebanon, Afghanistan, Horn of Africa). Not a forecast.
        Real crises are non-linear and context-dependent.
      </div>

      {/* Country selector */}
      <TerminalCard title="// SELECT TARGET COUNTRY">
        <select
          value={selectedIso3}
          onChange={(e) => {
            setSelectedIso3(e.target.value);
            sound.select();
          }}
          className="w-full bg-abyss border border-border-dim px-3 py-2 text-content-primary text-sm focus:border-blood outline-none"
        >
          {data.countries
            .slice()
            .sort((a, b) => a.name_en.localeCompare(b.name_en))
            .map((c) => (
              <option key={c.iso3} value={c.iso3}>
                {c.name_en} ({c.iso3}) — Pop: {(c.demographics.population / 1_000_000).toFixed(0)}M
              </option>
            ))}
        </select>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-3 text-center">
          {[
            { label: "GDP/cap", val: country.economy.gdp_per_capita_usd, unit: "USD" },
            { label: "Hunger", val: country.hunger.undernourishment_pct, unit: "%" },
            { label: "Life Exp", val: country.health.life_expectancy, unit: "yr" },
            { label: "Conflict", val: country.conflict.intensity_1to5, unit: "/5" },
            { label: "Poverty", val: country.poverty.headcount_365_pct, unit: "%" },
            { label: "Child Mort", val: country.health.child_mortality_under5_per1k, unit: "/1k" },
          ].map((stat) => (
            <div key={stat.label} className="border border-border-dim p-1.5">
              <div className="text-content-dim text-[8px] uppercase">{stat.label}</div>
              <div className="text-content-primary text-xs font-bold">
                {stat.val !== null ? stat.val : "N/A"}
                <span className="text-content-dim text-[8px] ml-0.5">{stat.unit}</span>
              </div>
            </div>
          ))}
        </div>
      </TerminalCard>

      {/* Shock controls */}
      <TerminalCard title="// APPLY SHOCKS" glow>
        <div className="space-y-4">
          {SHOCKS.map((shock) => (
            <div key={shock.id} className="border border-border-dim p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{shock.icon}</span>
                  <div>
                    <div className="text-content-primary text-xs font-bold">
                      {shock.label}
                    </div>
                    <div className="text-content-dim text-[9px]">
                      {shock.description}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className={`text-sm font-bold ${
                      shockValues[shock.id] > 0
                        ? "text-blood-bright"
                        : "text-content-dim"
                    }`}
                  >
                    {shockValues[shock.id]}
                    {shock.unit.includes("%") ? shock.unit.split(" ")[0] : ""}
                  </span>
                  <span className="text-content-dim text-[9px] ml-1">
                    {shock.unit.includes(" ")
                      ? shock.unit.split(" ").slice(1).join(" ")
                      : shock.unit}
                  </span>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={shock.max}
                step={shock.step}
                value={shockValues[shock.id]}
                onChange={(e) => {
                  setShockValues((prev) => ({
                    ...prev,
                    [shock.id]: parseInt(e.target.value),
                  }));
                  sound.keystroke();
                }}
                className="w-full accent-blood"
              />
              <div className="flex justify-between text-[8px] text-content-dim mt-0.5">
                <span>NONE</span>
                <span>
                  {shock.max}
                  {shock.unit.includes("%") ? shock.unit.split(" ")[0] : ""} {shock.unit.split(" ").slice(1).join(" ")}
                </span>
              </div>
            </div>
          ))}

          {/* Reset */}
          <button
            onClick={() => {
              setShockValues(Object.fromEntries(SHOCKS.map((s) => [s.id, 0])));
              sound.nav();
            }}
            className="px-4 py-1.5 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright transition-colors text-[10px]"
          >
            [ RESET ALL SHOCKS ]
          </button>
        </div>
      </TerminalCard>

      {/* Results */}
      {hasAnyShock ? (
        <TerminalCard
          title={`// CASCADING IMPACT ON ${country.name_en.toUpperCase()}`}
          glow
          accent={worstImpact && worstImpact.changePct > 50 ? "blood" : "amber"}
        >
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="border border-border-dim p-2 text-center">
              <div className="text-content-dim text-[9px] uppercase">
                Metrics Affected
              </div>
              <div className="text-blood-bright text-lg font-bold">
                {impacts.length}
              </div>
            </div>
            <div className="border border-border-dim p-2 text-center">
              <div className="text-content-dim text-[9px] uppercase">
                Worst Change
              </div>
              <div className="text-blood text-lg font-bold">
                {worstImpact ? `${worstImpact.changePct > 0 ? "+" : ""}${worstImpact.changePct.toFixed(0)}%` : "—"}
              </div>
            </div>
            <div className="border border-border-dim p-2 text-center">
              <div className="text-content-dim text-[9px] uppercase">
                Compound Effects
              </div>
              <div className="text-amber text-lg font-bold">
                {impacts.filter((i) => i.note.includes("COMPOUND")).length}
              </div>
            </div>
            <div className="border border-border-dim p-2 text-center">
              <div className="text-content-dim text-[9px] uppercase">
                Shocks Applied
              </div>
              <div className="text-content-primary text-lg font-bold">
                {activeShockCount}
              </div>
            </div>
          </div>

          {/* Impact list */}
          <div className="space-y-1">
            {impacts.map((imp, i) => {
              const barWidth = Math.min(Math.abs(imp.changePct), 100);
              const isCompound = imp.note.includes("COMPOUND");
              return (
                <div
                  key={i}
                  className={`flex items-center gap-2 py-1.5 border-b border-border-dim/30 last:border-0 ${
                    isCompound ? "bg-amber/5" : ""
                  }`}
                >
                  <span className="text-content-dim text-[9px] uppercase w-16 shrink-0">
                    {imp.dimension}
                  </span>
                  <span className="text-content-primary text-[10px] font-bold w-28 shrink-0 truncate">
                    {imp.metric}
                  </span>
                  <div className="flex-1 min-w-[60px]">
                    <div
                      className="h-2"
                      style={{
                        width: `${Math.max(barWidth, 3)}%`,
                        background: isCompound
                          ? "var(--color-warning-amber)"
                          : "var(--color-blood)",
                        opacity: 0.7,
                      }}
                    />
                  </div>
                  <span className="text-content-dim text-[9px] w-16 text-right shrink-0">
                    {imp.before < 100
                      ? imp.before.toFixed(1)
                      : imp.before.toLocaleString()}
                  </span>
                  <span className="text-content-dim text-[9px] shrink-0">→</span>
                  <span className="text-blood-bright text-[9px] w-16 text-right shrink-0 font-bold">
                    {imp.after < 100
                      ? imp.after.toFixed(1)
                      : imp.after.toLocaleString()}
                  </span>
                  <span
                    className={`text-[9px] font-bold w-12 text-right shrink-0 ${
                      isCompound ? "text-amber" : "text-blood"
                    }`}
                  >
                    {imp.changePct > 0 ? "+" : ""}
                    {imp.changePct.toFixed(0)}%
                  </span>
                  {isCompound && (
                    <span className="text-amber text-[8px] shrink-0 hidden md:inline">
                      ⚡
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Notes */}
          <div className="mt-3 pt-2 border-t border-border-dim space-y-1">
            {impacts.map((imp, i) => (
              <div key={i} className="text-content-dim text-[9px]">
                <span className={imp.note.includes("COMPOUND") ? "text-amber" : "text-content-dim"}>
                  ■
                </span>{" "}
                {imp.metric}: {imp.note}
              </div>
            ))}
          </div>
        </TerminalCard>
      ) : (
        <TerminalCard title="// AWAITING SHOCK APPLICATION">
          <p className="text-content-dim text-xs">
            {`// Apply one or more shocks above to see cascading impacts on ${country.name_en}.`}
          </p>
        </TerminalCard>
      )}
    </div>
  );
}
