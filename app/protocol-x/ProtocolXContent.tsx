"use client";

import { useState, useMemo, useEffect } from "react";
import { useStore } from "@/stores/useStore";
import { tc } from "@/lib/i18n-content";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import blueprintsData from "@/data/blueprints.json";
import backbone from "@/data/world_backbone.json";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import { sound } from "@/lib/sound";
import type { WorldBackbone, CountryData } from "@/lib/types";
import { countryToBlueprints } from "@/lib/crosslinks";
import {
  checklistGetAll,
  checklistSave,
  checklistDelete,
  signData,
  downloadJSON,
  type ChecklistKit,
} from "@/lib/idb";

const data = backbone as WorldBackbone;

interface Blueprint {
  id: string;
  title: string;
  category: string;
  tech_level: string;
  difficulty: number;
  time_estimate: string;
  tags: string[];
  summary: string;
  requirements: string[];
  steps: string[];
  notes: string;
}

const blueprints = blueprintsData as Blueprint[];

/* Blueprint data translation keys */
const BP_TITLE_KEY = (id: string) => `bp.${id}.title`;
const BP_SUMMARY_KEY = (id: string) => `bp.${id}.summary`;
const BP_TIME_KEY = (id: string) => `bp.time.${id}`;
const BP_CAT_KEY = (cat: string) => `bp.cat.${cat}`;

/* Survival checklist scenario items — use translation keys */
const SCENARIO_ITEMS: Record<string, string[]> = {
  conflict: [
    "bp.item.mesh_devices", "bp.item.dead_drop", "bp.item.first_aid_knowledge",
    "bp.item.nonviolent_training", "bp.item.opsec_practices", "bp.item.mutual_aid_active", "bp.item.evac_route",
  ],
  disaster: [
    "bp.item.water_supplies", "bp.item.garden_started", "bp.item.micro_solar",
    "bp.item.food_reserve", "bp.item.radio", "bp.item.first_aid_supplies", "bp.item.physical_maps",
  ],
  economic: [
    "bp.item.mutual_aid_est", "bp.item.garden_started", "bp.item.barter_inventory",
    "bp.item.offgrid_power", "bp.item.water_capacity", "bp.item.community_defense",
  ],
  epidemic: [
    "bp.item.water_purif", "bp.item.no_contact_care", "bp.item.isolation",
    "bp.item.medical_supplies", "bp.item.comms_plan", "bp.item.nutrition",
  ],
};

export default function ProtocolXContent() {
  const { lang } = useStore();
  const searchParams = useSearchParams();
  const countryCode = searchParams.get("country");
  const [search, setSearch] = useState("");
  const [techFilter, setTechFilter] = useState<"ALL" | "HIGH" | "LOW">("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");

  // Context-aware filtering
  const countryContext = useMemo(() => {
    if (!countryCode) return null;
    return data.countries.find((c) => c.iso3 === countryCode.toUpperCase()) || null;
  }, [countryCode]);

  // Blueprint matching: use the data-driven engine to rank blueprints for this country
  const blueprintMatches = useMemo(() => {
    if (!countryContext) return [];
    return countryToBlueprints(countryContext);
  }, [countryContext]);

  // Resolve matched blueprint ids to full blueprint objects
  const matchedBlueprints = useMemo(() => {
    return blueprintMatches
      .map((m) => {
        const bp = blueprints.find((b) => b.id === m.blueprintId);
        return bp ? { ...m, blueprint: bp } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [blueprintMatches]);

  const contextTag = useMemo(() => {
    if (!countryContext) return null;
    const tags: string[] = [];
    if (countryContext.conflict.intensity_1to5 >= 3) tags.push("security", "comms", "organizing");
    if (countryContext.hunger.famine_risk_1to5 && countryContext.hunger.famine_risk_1to5 >= 3) tags.push("food", "water");
    if (countryContext.connectivity.internet_users_pct !== null && countryContext.connectivity.internet_users_pct < 30) tags.push("LOW");
    return tags;
  }, [countryContext]);

  const filtered = useMemo(() => {
    let result = blueprints;
    if (techFilter !== "ALL") {
      result = result.filter((b) => b.tech_level === techFilter);
    }
    if (categoryFilter !== "ALL") {
      result = result.filter((b) => b.category === categoryFilter);
    }
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (b) =>
          b.title.toLowerCase().includes(s) ||
          b.summary.toLowerCase().includes(s) ||
          b.tags.some((t) => t.includes(s))
      );
    }
    return result;
  }, [search, techFilter, categoryFilter]);

  const categories = ["ALL", ...new Set(blueprints.map((b) => b.category))];

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8 pt-4">
        <div className="text-xs text-content-dim mb-1">{tc(lang, "protocol.tag")}</div>
        <h1 className="text-2xl md:text-3xl text-blood-bright font-bold glow-blood">
          {tc(lang, "protocol.title")}
        </h1>
        <p className="text-content-secondary text-sm mt-2">
          {tc(lang, "subtitle.protocol_x")}
        </p>
      </div>

      {/* Blueprint Recommender — country selector + auto-suggest */}
      <BlueprintRecommender
        countryContext={countryContext}
        countryCode={countryCode}
        matchedBlueprints={matchedBlueprints}
      />

      {/* Context indicator (legacy tag-based hints, shown alongside matches) */}
      {countryContext && contextTag && contextTag.length > 0 && (
        <TerminalCard
          title={`${tc(lang, "protocol.context_filter")} — ${countryContext.name_en}`}
          accent="amber"
          className="mb-6"
        >
          <div className="text-xs space-y-1">
            {countryContext.conflict.intensity_1to5 >= 3 && (
              <div className="text-blood">{tc(lang, "protocol.ctx_conflict")}</div>
            )}
            {countryContext.hunger.famine_risk_1to5 && countryContext.hunger.famine_risk_1to5 >= 3 && (
              <div className="text-blood">{tc(lang, "protocol.ctx_famine")}</div>
            )}
            {countryContext.connectivity.internet_users_pct !== null && countryContext.connectivity.internet_users_pct < 30 && (
              <div className="text-warning-amber">{tc(lang, "protocol.ctx_low_connect")}</div>
            )}
          </div>
        </TerminalCard>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder={tc(lang, "protocol.search_ph")}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            sound.keystroke();
          }}
          className="flex-1 bg-void border border-border-dim px-3 py-2 text-sm text-content-primary focus:border-blood focus:outline-none"
        />
        <div className="flex gap-2">
          {(["ALL", "HIGH", "LOW"] as const).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTechFilter(t);
                sound.select();
              }}
              className={`px-3 py-2 text-xs border transition-colors ${
                techFilter === t
                  ? "bg-blood text-void border-blood-bright"
                  : "border-border-dim text-content-secondary hover:border-blood-dim"
              }`}
            >
              {t === "ALL" ? tc(lang, "protocol.all") : t === "HIGH" ? tc(lang, "protocol.high_tech") : tc(lang, "protocol.low_tech")}
            </button>
          ))}
        </div>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => {
              setCategoryFilter(c);
              sound.select();
            }}
            className={`px-2 py-1 text-xs border transition-colors ${
              categoryFilter === c
                ? "border-blood text-blood-bright"
                : "border-border-dim text-content-dim hover:text-content-secondary"
            }`}
          >
            {tc(lang, BP_CAT_KEY(c))}
          </button>
        ))}
      </div>

      {/* Blueprints grid */}
      <div className="space-y-3 mb-8">
        {filtered.map((b) => (
          <Link
            key={b.id}
            href={`/protocol-x/${b.id}/`}
            onClick={() => sound.nav()}
            className="terminal-card p-4 hover:border-blood transition-colors block"
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <h3 className="text-sm font-bold text-content-primary">{tc(lang, BP_TITLE_KEY(b.id))}</h3>
                <p className="text-xs text-content-secondary mt-1">{tc(lang, BP_SUMMARY_KEY(b.id))}</p>
              </div>
              <StatusPill
                color={b.tech_level === "HIGH" ? "amber" : "green"}
              >
                {b.tech_level === "HIGH" ? tc(lang, "protocol.high_tech_short") : tc(lang, "protocol.low_tech_short")}
              </StatusPill>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-content-dim mt-2">
              <span>▸ {tc(lang, BP_CAT_KEY(b.category))}</span>
              <span>▸ {tc(lang, "protocol.difficulty")}: {"★".repeat(b.difficulty)}{"☆".repeat(5 - b.difficulty)}</span>
              <span>▸ {tc(lang, BP_TIME_KEY(b.id))}</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Survival Checklist Generator */}
      <TerminalCard title={tc(lang, "protocol.checklist_generator")} glow>
        <p className="text-xs text-content-secondary mb-4">
          {tc(lang, "protocol.checklist_desc")}
        </p>
        <SurvivalChecklist />
      </TerminalCard>

      {/* Cross-links */}
      <div className="mt-6">
        <TerminalCard title={tc(lang, "card.cross_links")}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Link href="/the-trail/" className="terminal-card p-3 hover:border-blood block">
              <div className="text-xs text-blood-bright font-bold">{tc(lang, "protocol.link_supplies")}</div>
              <div className="text-xs text-content-secondary mt-1">{tc(lang, "protocol.link_supplies_desc")}</div>
            </Link>
            <Link href="/the-mask/" className="terminal-card p-3 hover:border-blood block">
              <div className="text-xs text-blood-bright font-bold">{tc(lang, "protocol.link_comms")}</div>
              <div className="text-xs text-content-secondary mt-1">{tc(lang, "protocol.link_comms_desc")}</div>
            </Link>
          </div>
        </TerminalCard>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   BLUEPRINT RECOMMENDER
   Data-driven auto-suggest: pick a country → see which blueprints
   its crisis profile demands, ranked by priority with reasoning.
   ═══════════════════════════════════════════════════════════════ */

type MatchedBlueprint = {
  blueprintId: string;
  reason: string;
  priority: "critical" | "recommended" | "resilience";
  blueprint: Blueprint;
};

const PRIORITY_META: Record<
  "critical" | "recommended" | "resilience",
  { labelKey: string; color: "blood" | "amber" | "green"; className: string }
> = {
  critical: { labelKey: "protocol.prio_critical", color: "blood", className: "border-blood bg-blood/5" },
  recommended: { labelKey: "protocol.prio_recommended", color: "amber", className: "border-warning-amber bg-warning-amber/5" },
  resilience: { labelKey: "protocol.prio_resilience", color: "green", className: "border-terminal-green bg-terminal-green/5" },
};

function BlueprintRecommender({
  countryContext,
  countryCode,
  matchedBlueprints,
}: {
  countryContext: CountryData | null;
  countryCode: string | null;
  matchedBlueprints: MatchedBlueprint[];
}) {
  const { lang } = useStore();
  const [countrySearch, setCountrySearch] = useState("");

  const searchResults = useMemo(() => {
    const q = countrySearch.trim().toLowerCase();
    if (!q) return [];
    return data.countries
      .filter(
        (c) =>
          c.name_en.toLowerCase().includes(q) ||
          c.iso3.toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [countrySearch]);

  const criticalCount = matchedBlueprints.filter((m) => m.priority === "critical").length;
  const recommendedCount = matchedBlueprints.filter((m) => m.priority === "recommended").length;

  return (
    <TerminalCard title={tc(lang, "protocol.blueprint_recommender")} accent="blood" glow={!!countryContext} className="mb-6">
      <p className="text-xs text-content-secondary mb-4">
        // {tc(lang, "protocol.recommender_desc")}
      </p>

      {/* Country selector */}
      <div className="relative mb-4">
        <label className="text-[10px] text-content-dim uppercase tracking-wider block mb-1">
          {tc(lang, "protocol.country_context")} {countryCode && <span className="text-terminal-green">— {tc(lang, "protocol.active")}: {countryContext?.name_en}</span>}
        </label>
        <input
          type="text"
          value={countryContext ? `${countryContext.name_en} (${countryContext.iso3})` : countrySearch}
          onChange={(e) => {
            setCountrySearch(e.target.value);
          }}
          onFocus={() => {
            if (countryContext) setCountrySearch("");
          }}
          placeholder={tc(lang, "act.search_country_ph")}
          className="w-full bg-void border border-border-dim px-3 py-2 text-xs text-content-primary focus:border-blood focus:outline-none"
        />
        {searchResults.length > 0 && (
          <div className="absolute z-20 left-0 right-0 mt-1 border border-border-dim bg-abyss max-h-60 overflow-y-auto">
            {searchResults.map((c) => (
              <Link
                key={c.iso3}
                href={`/protocol-x/?country=${c.iso3}`}
                onClick={() => { setCountrySearch(""); sound.select(); }}
                className="w-full text-left px-3 py-2 text-xs border-b border-border-dim last:border-b-0 hover:bg-panel block"
              >
                <span className="text-content-dim font-mono mr-2">{c.iso3}</span>
                {c.name_en}
                {c.is_hotspot && <span className="text-blood-bright ml-2 text-[10px]">{tc(lang, "act.hotspot")}</span>}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Matched blueprints */}
      {countryContext && matchedBlueprints.length > 0 ? (
        <div>
          {/* Summary line */}
          <div className="flex flex-wrap gap-3 mb-3 text-[10px]">
            <span className="text-blood-bright">{criticalCount} {tc(lang, "protocol.critical")}</span>
            <span className="text-warning-amber">{recommendedCount} {tc(lang, "protocol.recommended")}</span>
            <span className="text-terminal-green">{matchedBlueprints.length - criticalCount - recommendedCount} {tc(lang, "protocol.resilience")}</span>
            <span className="text-content-dim ml-auto">
              → {matchedBlueprints.length} / {blueprints.length} {tc(lang, "protocol.blueprints_matched")}
            </span>
          </div>

          <div className="space-y-2">
            {matchedBlueprints.map((m) => {
              const meta = PRIORITY_META[m.priority];
              return (
                <Link
                  key={m.blueprintId}
                  href={`/protocol-x/${m.blueprintId}/`}
                  onClick={() => sound.nav()}
                  className={`block border p-3 hover:border-blood-bright transition-colors ${meta.className}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <StatusPill color={meta.color}>{tc(lang, meta.labelKey)}</StatusPill>
                      <span className="text-xs font-bold text-content-primary">{tc(lang, BP_TITLE_KEY(m.blueprint.id))}</span>
                    </div>
                    <StatusPill color={m.blueprint.tech_level === "HIGH" ? "amber" : "green"}>
                      {m.blueprint.tech_level === "HIGH" ? tc(lang, "protocol.high_tech_short") : tc(lang, "protocol.low_tech_short")}
                    </StatusPill>
                  </div>
                  <div className="text-[11px] text-content-secondary leading-relaxed">
                    ▸ {m.reason}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[10px] text-content-dim mt-1">
                    <span>{tc(lang, BP_CAT_KEY(m.blueprint.category))}</span>
                    <span>·</span>
                    <span>{"★".repeat(m.blueprint.difficulty)}{"☆".repeat(5 - m.blueprint.difficulty)}</span>
                    <span>·</span>
                    <span>{tc(lang, BP_TIME_KEY(m.blueprint.id))}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ) : countryContext ? (
        <div className="text-xs text-content-dim italic">
          ▸ {tc(lang, "protocol.no_triggers")} {countryContext.name_en}. {tc(lang, "protocol.browse_catalog")}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {data.hotspots.all.slice(0, 12).map((h) => (
            <Link
              key={h.iso3}
              href={`/protocol-x/?country=${h.iso3}`}
              onClick={() => sound.select()}
              className="px-2 py-1 text-[11px] border border-blood text-blood-bright hover:bg-blood hover:text-void transition-colors"
            >
              {h.name_en || h.name_pt}
            </Link>
          ))}
        </div>
      )}
    </TerminalCard>
  );
}

function SurvivalChecklist() {
  const { lang } = useStore();
  const [scenarios, setScenarios] = useState<string[]>([]);
  const [savedKits, setSavedKits] = useState<ChecklistKit[]>([]);
  const [kitName, setKitName] = useState("");
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [loadingKits, setLoadingKits] = useState(true);

  useEffect(() => {
    checklistGetAll().then((kits) => {
      setSavedKits(kits);
      setLoadingKits(false);
    }).catch(() => setLoadingKits(false));
  }, []);

  const scenarioMap: Record<string, { label: string; items: string[] }> = {
    conflict: {
      label: tc(lang, "protocol.scn_conflict"),
      items: SCENARIO_ITEMS.conflict,
    },
    disaster: {
      label: tc(lang, "protocol.scn_disaster"),
      items: SCENARIO_ITEMS.disaster,
    },
    economic: {
      label: tc(lang, "protocol.scn_economic"),
      items: SCENARIO_ITEMS.economic,
    },
    epidemic: {
      label: tc(lang, "protocol.scn_epidemic"),
      items: SCENARIO_ITEMS.epidemic,
    },
  };

  const allItems = useMemo(() => {
    const items = new Set<string>();
    scenarios.forEach((s) => {
      scenarioMap[s].items.forEach((i) => items.add(i));
    });
    return Array.from(items);
  }, [scenarios]);

  const progress = allItems.length > 0
    ? Math.round((Array.from(checkedItems).filter((i) => allItems.includes(i)).length / allItems.length) * 100)
    : 0;

  const toggleItem = (item: string) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
    sound.select();
  };

  const saveKit = async () => {
    if (allItems.length === 0) return;
    const kit: ChecklistKit = {
      name: kitName.trim() || `${tc(lang, "protocol.kit_default")} ${new Date().toLocaleDateString()}`,
      scenarios,
      items: allItems.map((text) => ({ text: tc(lang, text), checked: checkedItems.has(text) })),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const id = await checklistSave(kit);
    const updated = await checklistGetAll();
    setSavedKits(updated);
    sound.success();
    setKitName("");
  };

  const loadKit = (kit: ChecklistKit) => {
    setScenarios(kit.scenarios);
    setCheckedItems(new Set(kit.items.filter((i) => i.checked).map((i) => i.text)));
    sound.nav();
  };

  const deleteKit = async (id: number) => {
    await checklistDelete(id);
    const updated = await checklistGetAll();
    setSavedKits(updated);
    sound.error();
  };

  const exportKit = async () => {
    if (allItems.length === 0) return;
    const exportData = {
      type: "vfx-survival-kit",
      version: 1,
      name: kitName.trim() || tc(lang, "protocol.kit_default"),
      exportedAt: new Date().toISOString(),
      scenarios,
      items: allItems.map((text) => ({ text: tc(lang, text), checked: checkedItems.has(text) })),
      progress,
    };
    const sig = await signData(exportData);
    const finalData = { ...exportData, signature: sig?.signature ?? null, signedBy: sig?.handle ?? null };
    downloadJSON(finalData, `vfx-survival-kit-${Date.now()}.json`);
    sound.success();
  };

  return (
    <div>
      {/* Scenario selectors */}
      <div className="flex flex-wrap gap-2 mb-4">
        {Object.entries(scenarioMap).map(([key, val]) => (
          <button
            key={key}
            onClick={() => {
              setScenarios((prev) =>
                prev.includes(key)
                  ? prev.filter((x) => x !== key)
                  : [...prev, key]
              );
              sound.select();
            }}
            className={`px-3 py-1.5 text-xs border transition-colors ${
              scenarios.includes(key)
                ? "bg-blood text-void border-blood-bright"
                : "border-border-dim text-content-secondary hover:border-blood-dim"
            }`}
          >
            {val.label}
          </button>
        ))}
      </div>

      {allItems.length > 0 ? (
        <>
          {/* Progress bar */}
          <div className="mb-4">
            <div className="flex justify-between text-[10px] text-content-dim mb-1">
              <span>{tc(lang, "protocol.readiness")}: {progress}%</span>
              <span>{Array.from(checkedItems).filter((i) => allItems.includes(i)).length} / {allItems.length} {tc(lang, "protocol.items_acquired")}</span>
            </div>
            <div className="w-full h-2 bg-void border border-border-dim">
              <div
                className="h-full transition-all"
                style={{
                  width: `${progress}%`,
                  backgroundColor: progress === 100 ? "var(--color-terminal-green)" : progress >= 50 ? "var(--color-warning-amber)" : "var(--color-blood)",
                }}
              />
            </div>
          </div>

          {/* Checklist items */}
          <div className="text-xs text-terminal-green mb-2">
            ▸ {tc(lang, "protocol.checklist_header")} ({allItems.length}):
          </div>
          <div className="space-y-1 mb-4">
            {allItems.map((item, i) => (
              <button
                key={i}
                onClick={() => toggleItem(item)}
                className="flex items-center gap-2 text-xs text-content-primary p-1 w-full text-left hover:bg-panel/50"
              >
                <span className={checkedItems.has(item) ? "text-terminal-green" : "text-content-dim"}>
                  [{checkedItems.has(item) ? "✓" : " "}]
                </span>
                <span className={checkedItems.has(item) ? "line-through text-content-dim" : ""}>
                  {tc(lang, item)}
                </span>
              </button>
            ))}
          </div>

          {/* Save + export controls */}
          <div className="flex flex-wrap gap-2 mb-4">
            <input
              type="text"
              value={kitName}
              onChange={(e) => setKitName(e.target.value)}
              placeholder={tc(lang, "protocol.kit_name_ph")}
              className="flex-1 min-w-[120px] bg-void border border-border-dim px-3 py-1.5 text-xs text-content-primary focus:border-blood focus:outline-none"
            />
            <button
              onClick={saveKit}
              className="px-3 py-1.5 text-xs border border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-void"
            >
              {tc(lang, "protocol.save_kit")}
            </button>
            <button
              onClick={exportKit}
              className="px-3 py-1.5 text-xs border border-blood text-blood-bright hover:bg-blood hover:text-void"
            >
              {tc(lang, "protocol.export_json")}
            </button>
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 text-xs border border-border-dim text-content-secondary hover:border-blood no-print"
            >
              {tc(lang, "protocol.print")}
            </button>
          </div>
        </>
      ) : (
        <p className="text-xs text-content-dim mb-4">{tc(lang, "protocol.select_scenarios")}</p>
      )}

      {/* Saved kits */}
      {!loadingKits && savedKits.length > 0 && (
        <div className="border-t border-border-dim pt-3">
          <div className="text-[10px] text-content-dim uppercase tracking-widest mb-2">
            {tc(lang, "protocol.saved_kits")} ({savedKits.length})
          </div>
          <div className="space-y-1">
            {savedKits.map((kit) => {
              const checked = kit.items.filter((i) => i.checked).length;
              return (
                <div key={kit.id} className="flex items-center justify-between p-2 border border-border-dim bg-void/50">
                  <button onClick={() => loadKit(kit)} className="flex-1 text-left">
                    <span className="text-xs text-content-primary font-bold">{kit.name}</span>
                    <span className="text-[10px] text-content-dim ml-2">
                      {kit.scenarios.length} {tc(lang, "protocol.scenarios")} · {checked}/{kit.items.length} {tc(lang, "protocol.items")}
                    </span>
                  </button>
                  <button
                    onClick={() => kit.id && deleteKit(kit.id)}
                    className="text-content-dim hover:text-blood text-xs ml-2"
                  >
                    {tc(lang, "protocol.delete")}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
