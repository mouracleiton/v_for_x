"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import blueprintsData from "@/data/blueprints.json";
import backbone from "@/data/world_backbone.json";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import { sound } from "@/lib/sound";
import type { WorldBackbone } from "@/lib/types";
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

export default function ProtocolXContent() {
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
        <div className="text-xs text-content-dim mb-1">[03] PROTOCOL X</div>
        <h1 className="text-2xl md:text-3xl text-blood-bright font-bold glow-blood">
          PROTOCOL X
        </h1>
        <p className="text-content-secondary text-sm mt-2">
          // Survival and resistance blueprints. Both high-tech and low-tech. Tech is optional.
        </p>
      </div>

      {/* Context indicator */}
      {countryContext && (
        <TerminalCard
          title={`CONTEXT FILTER ACTIVE — ${countryContext.name_en}`}
          accent="amber"
          className="mb-6"
        >
          <div className="text-xs space-y-1">
            {countryContext.conflict.intensity_1to5 >= 3 && (
              <div className="text-blood">▸ High conflict intensity — security and comms blueprints prioritized</div>
            )}
            {countryContext.hunger.famine_risk_1to5 && countryContext.hunger.famine_risk_1to5 >= 3 && (
              <div className="text-blood">▸ Famine risk detected — food and water blueprints prioritized</div>
            )}
            {countryContext.connectivity.internet_users_pct !== null && countryContext.connectivity.internet_users_pct < 30 && (
              <div className="text-warning-amber">▸ Low connectivity — low-tech solutions recommended</div>
            )}
          </div>
        </TerminalCard>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder="search blueprints..."
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
              {t === "ALL" ? "ALL" : t === "HIGH" ? "HIGH-TECH" : "LOW-TECH"}
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
            {c}
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
                <h3 className="text-sm font-bold text-content-primary">{b.title}</h3>
                <p className="text-xs text-content-secondary mt-1">{b.summary}</p>
              </div>
              <StatusPill
                color={b.tech_level === "HIGH" ? "amber" : "green"}
              >
                {b.tech_level}-TECH
              </StatusPill>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-content-dim mt-2">
              <span>▸ {b.category}</span>
              <span>▸ Difficulty: {"★".repeat(b.difficulty)}{"☆".repeat(5 - b.difficulty)}</span>
              <span>▸ {b.time_estimate}</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Survival Checklist Generator */}
      <TerminalCard title="SURVIVAL CHECKLIST GENERATOR" glow>
        <p className="text-xs text-content-secondary mb-4">
          Select scenarios to generate a custom preparedness checklist from blueprint components.
        </p>
        <SurvivalChecklist />
      </TerminalCard>

      {/* Cross-links */}
      <div className="mt-6">
        <TerminalCard title="CROSS-LINKS">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Link href="/the-trail/" className="terminal-card p-3 hover:border-blood block">
              <div className="text-xs text-blood-bright font-bold">→ NEED SUPPLIES?</div>
              <div className="text-xs text-content-secondary mt-1">Resource matching in your area</div>
            </Link>
            <Link href="/the-mask/" className="terminal-card p-3 hover:border-blood block">
              <div className="text-xs text-blood-bright font-bold">→ SECURE YOUR COMMS</div>
              <div className="text-xs text-content-secondary mt-1">Identity protection and OpSec</div>
            </Link>
          </div>
        </TerminalCard>
      </div>
    </div>
  );
}

function SurvivalChecklist() {
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
      label: "Active Conflict",
      items: ["Mesh network devices (encrypted comms)", "Dead drop protocol established", "Field first aid knowledge", "Nonviolent resistance strategy training", "Digital OpSec practices", "Mutual aid network activated", "Evacuation route planned"],
    },
    disaster: {
      label: "Natural Disaster",
      items: ["Water purification supplies (solar + boiling)", "Emergency caloric garden started", "Micro solar setup (50W)", "3-day food reserve", "Battery-powered radio", "First aid supplies", "Physical maps of area"],
    },
    economic: {
      label: "Economic Collapse",
      items: ["Mutual aid network established", "Emergency garden (food sovereignty)", "Barter inventory (skills + goods)", "Off-grid power capability", "Water purification capacity", "Community defense plan"],
    },
    epidemic: {
      label: "Epidemic/Outbreak",
      items: ["Water purification (boiling + solar)", "First aid knowledge (no-contact care)", "Isolation protocols", "Basic medical supplies (gloves, masks)", "Communications plan (remote coordination)", "Nutrition maintenance (garden)"],
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
      name: kitName.trim() || `Kit ${new Date().toLocaleDateString()}`,
      scenarios,
      items: allItems.map((text) => ({ text, checked: checkedItems.has(text) })),
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
      name: kitName.trim() || "Survival Kit",
      exportedAt: new Date().toISOString(),
      scenarios,
      items: allItems.map((text) => ({ text, checked: checkedItems.has(text) })),
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
              <span>READINESS: {progress}%</span>
              <span>{Array.from(checkedItems).filter((i) => allItems.includes(i)).length} / {allItems.length} ITEMS ACQUIRED</span>
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
            ▸ CHECKLIST ({allItems.length} ITEMS):
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
                  {item}
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
              placeholder="Kit name (optional)"
              className="flex-1 min-w-[120px] bg-void border border-border-dim px-3 py-1.5 text-xs text-content-primary focus:border-blood focus:outline-none"
            />
            <button
              onClick={saveKit}
              className="px-3 py-1.5 text-xs border border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-void"
            >
              [ SAVE KIT ]
            </button>
            <button
              onClick={exportKit}
              className="px-3 py-1.5 text-xs border border-blood text-blood-bright hover:bg-blood hover:text-void"
            >
              [ EXPORT SIGNED JSON ]
            </button>
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 text-xs border border-border-dim text-content-secondary hover:border-blood no-print"
            >
              [ PRINT ]
            </button>
          </div>
        </>
      ) : (
        <p className="text-xs text-content-dim mb-4">Select scenarios above to generate your checklist.</p>
      )}

      {/* Saved kits */}
      {!loadingKits && savedKits.length > 0 && (
        <div className="border-t border-border-dim pt-3">
          <div className="text-[10px] text-content-dim uppercase tracking-widest mb-2">
            SAVED KITS ({savedKits.length})
          </div>
          <div className="space-y-1">
            {savedKits.map((kit) => {
              const checked = kit.items.filter((i) => i.checked).length;
              return (
                <div key={kit.id} className="flex items-center justify-between p-2 border border-border-dim bg-void/50">
                  <button onClick={() => loadKit(kit)} className="flex-1 text-left">
                    <span className="text-xs text-content-primary font-bold">{kit.name}</span>
                    <span className="text-[10px] text-content-dim ml-2">
                      {kit.scenarios.length} scenarios · {checked}/{kit.items.length} items
                    </span>
                  </button>
                  <button
                    onClick={() => kit.id && deleteKit(kit.id)}
                    className="text-content-dim hover:text-blood text-xs ml-2"
                  >
                    [×]
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
