"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import backbone from "@/data/world_backbone.json";
import blueprintsData from "@/data/blueprints.json";
import dossiersData from "@/data/dossier-seed.json";
import type { WorldBackbone } from "@/lib/types";
import { sound } from "@/lib/sound";
import { tc } from "@/lib/i18n-content";
import { td } from "@/lib/dossiers-i18n";
import { t } from "@/lib/i18n";
import { useStore } from "@/stores/useStore";

const data = backbone as WorldBackbone;
const blueprints = (Array.isArray(blueprintsData) ? blueprintsData : (blueprintsData as { blueprints: unknown[] }).blueprints) as {
  id: string; title: string; category: string; summary: string; tags?: string[];
}[];
const dossiers = dossiersData as {
  id: string; subject: string; category: string; severity: string;
}[];

type ResultType = "country" | "blueprint" | "dossier" | "equation" | "page";

interface SearchResult {
  type: ResultType;
  label: string;
  sublabel: string;
  href: string;
  score: number;
}

const TYPE_META: Record<ResultType, { labelKey: string; color: string; icon: string }> = {
  country: { labelKey: "search.type_country", color: "var(--color-blood-bright)", icon: "🌍" },
  blueprint: { labelKey: "search.type_blueprint", color: "var(--color-terminal-green)", icon: "📋" },
  dossier: { labelKey: "search.type_dossier", color: "var(--color-warning-amber)", icon: "⚖" },
  equation: { labelKey: "search.type_equation", color: "#00ddff", icon: "∑" },
  page: { labelKey: "search.type_page", color: "#aa44ff", icon: "▸" },
};

const STATIC_PAGES = [
  { label: "Sorrow Map", href: "/sorrow-map/", desc: "Atlas of suffering" },
  { label: "The Equation", href: "/equation/", desc: "Model the fix" },
  { label: "Protocol X", href: "/protocol-x/", desc: "Survival blueprints" },
  { label: "Registry", href: "/registry/", desc: "Accountability" },
  { label: "The Web", href: "/the-web/", desc: "Anonymous comms" },
  { label: "The Trail", href: "/the-trail/", desc: "Resource routing" },
  { label: "Fortress", href: "/fortress/", desc: "Infrastructure" },
  { label: "The Mask", href: "/the-mask/", desc: "Identity & OpSec" },
  { label: "The Lens", href: "/the-lens/", desc: "Compare & correlate" },
  { label: "The Archive", href: "/the-archive/", desc: "Sources & methods" },
  { label: "The Signal", href: "/the-signal/", desc: "Watchlist alerts" },
  { label: "The Act", href: "/the-act/", desc: "Campaign generator" },
  { label: "The Index", href: "/the-index/", desc: "Vulnerability ranking" },
  { label: "The Stories", href: "/the-stories/", desc: "Narrative tours" },
  { label: "The Allocator", href: "/the-allocator/", desc: "Budget simulator" },
  { label: "The Exodus", href: "/the-exodus/", desc: "Displacement flows" },
  { label: "The Tactics", href: "/the-tactics/", desc: "Resistance tactics" },
  { label: "The Matrix", href: "/the-matrix/", desc: "Data transparency" },
  { label: "The Fronts", href: "/the-fronts/", desc: "Regional crises" },
  { label: "The Choice", href: "/the-choice/", desc: "Military vs health spending" },
  { label: "The Briefing", href: "/the-briefing/", desc: "Country report generator" },
  { label: "The Timeline", href: "/the-timeline/", desc: "Scenario model" },
  { label: "The API", href: "/the-api/", desc: "Public data API docs" },
  { label: "The Ledger", href: "/the-ledger/", desc: "Financing and blockers" },
  { label: "The Dashboard", href: "/the-dashboard/", desc: "World crisis cockpit" },
  { label: "The Vault", href: "/the-vault/", desc: "Open datasets catalog" },
  { label: "The Submit", href: "/the-submit/", desc: "Anonymous dossier submission" },
  { label: "The Network", href: "/the-network/", desc: "Anonymous action circles" },
  { label: "The Compare", href: "/the-compare/", desc: "Side-by-side country analysis" },
  { label: "The Badges", href: "/the-badges/", desc: "Knowledge & action tracker" },
  { label: "The Changelog", href: "/the-changelog/", desc: "Data evolution tracker" },
  { label: "The Press Kit", href: "/the-press-kit/", desc: "Citizen journalist toolkit" },
  { label: "The Simulator", href: "/the-simulator/", desc: "Scenario impact model" },
  { label: "The Alerts", href: "/the-alerts/", desc: "Live crisis feed" },
  { label: "The Satellite", href: "/the-satellite/", desc: "Open imagery of conflict" },
  { label: "The Chart Builder", href: "/the-chart-builder/", desc: "Custom data visualizer" },
  { label: "The Digest", href: "/the-digest/", desc: "Personalized crisis feed" },
  { label: "The Forecast", href: "/the-forecast/", desc: "Transparent crisis risk model" },
  { label: "The Analyzer", href: "/the-analyzer/", desc: "Client-side document triage" },
  { label: "The Academy", href: "/the-academy/", desc: "Interactive crisis education" },
  { label: "The Onion", href: "/the-onion/", desc: "Tor hidden service mirror guide" },
  { label: "The Safehouse", href: "/the-safehouse/", desc: "Encrypted evidence store" },
  { label: "The Chain", href: "/the-chain/", desc: "Arms, sanctions & aid graph" },
  { label: "The Countdown", href: "/the-countdown/", desc: "SDG 2030 deadline tracker" },
  { label: "The Oracle", href: "/the-oracle/", desc: "Natural-language query engine" },
  { label: "The Crucible", href: "/the-crucible/", desc: "Cascading crisis simulator" },
  { label: "The Cartographer", href: "/the-cartographer/", desc: "Custom choropleth builder" },
  { label: "The Canary", href: "/the-canary/", desc: "Dead man's switch timer" },
  { label: "The Cipher", href: "/the-cipher/", desc: "Steganography & one-time pads" },
  { label: "The Relay", href: "/the-relay/", desc: "Offline burst message format" },
  { label: "The Quorum", href: "/the-quorum/", desc: "Anonymous ZK voting" },
  { label: "The Tribunal", href: "/the-tribunal/", desc: "Evidence-backed accountability cases" },
  { label: "The Promises", href: "/the-promises/", desc: "Politician pledge tracker" },
  { label: "The Lives", href: "/the-lives/", desc: "Running memorial counter" },
  { label: "The Testimony", href: "/the-testimony/", desc: "Signed witness statements" },
  { label: "The Watch", href: "/the-watch/", desc: "Threshold alert rules" },
  { label: "The Exchange", href: "/the-exchange/", desc: "Mutual-aid matching" },
  { label: "The Field Manual", href: "/the-field-manual/", desc: "Printable survival guides" },
  { label: "The Resistance", href: "/the-resistance/", desc: "Civil resistance analytics" },
];

/** Simple fuzzy match — returns a score (0 = no match, higher = better) */
function fuzzyScore(query: string, target: string): number {
  if (!query || !target) return 0;
  const q = query.toLowerCase().trim();
  const t = target.toLowerCase().trim();

  // Exact match
  if (t === q) return 100;
  // Starts with
  if (t.startsWith(q)) return 90;
  // Word boundary match
  const words = t.split(/\s+/);
  for (const w of words) {
    if (w.startsWith(q)) return 80;
  }
  // Contains
  if (t.includes(q)) return 70;
  // Subsequence match (fuzzy)
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  if (qi === q.length) return 50;
  return 0;
}

export default function GlobalSearch() {
  const { lang } = useStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Keyboard shortcut: Cmd/Ctrl+K to open, Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setSelectedIndex(0);
    }
  }, [open]);

  // Build index
  const index = useMemo(() => {
    const results: SearchResult[] = [];

    // Countries
    for (const c of data.countries) {
      results.push({
        type: "country",
        label: c.name_en,
        sublabel: `${c.iso3} · ${c.region}${c.is_hotspot ? " · HOTSPOT" : ""}`,
        href: `/sorrow-map/${c.iso3.toLowerCase()}/`,
        score: 0,
      });
      // Also index Portuguese name and ISO codes
      results.push({
        type: "country",
        label: c.name_pt,
        sublabel: `${c.iso3} · ${c.region} (PT)`,
        href: `/sorrow-map/${c.iso3.toLowerCase()}/`,
        score: 0,
      });
    }

    // Blueprints
    for (const bp of blueprints) {
      results.push({
        type: "blueprint",
        label: bp.title,
        sublabel: `${bp.category} · ${bp.summary.slice(0, 60)}`,
        href: `/protocol-x/${bp.id}/`,
        score: 0,
      });
    }

    // Dossiers
    for (const dos of dossiers) {
      results.push({
        type: "dossier",
        label: td(dos.id, lang).subject,
        sublabel: `${dos.id} · ${tc(lang, `dcat.${dos.category}`)} · ${tc(lang, `dsev.${dos.severity}`)}`,
        href: `/registry/${dos.id}/`,
        score: 0,
      });
    }

    // Equations
    if (data.sdg_equations) {
      for (const [key, eq] of Object.entries(data.sdg_equations.equations)) {
        results.push({
          type: "equation",
          label: `SDG ${eq.sdg}: ${eq.title}`,
          sublabel: `$${eq.cost.annual_billion}B/yr · ${eq.affordability.days_of_military} days of military`,
          href: `/equation/?sdg=${key}`,
          score: 0,
        });
      }
    }

    // Static pages
    for (const p of STATIC_PAGES) {
      results.push({
        type: "page",
        label: p.label,
        sublabel: p.desc,
        href: p.href,
        score: 0,
      });
    }

    return results;
  }, []);

  // Search results
  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    const scored = index
      .map((r) => {
        const s = Math.max(
          fuzzyScore(query, r.label),
          fuzzyScore(query, r.sublabel) * 0.7,
        );
        return { ...r, score: s };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 15);
    return scored;
  }, [query, index]);

  // Group results by type for display
  const grouped = useMemo(() => {
    const groups: Record<string, SearchResult[]> = {};
    for (const r of searchResults) {
      if (!groups[r.type]) groups[r.type] = [];
      groups[r.type].push(r);
    }
    return groups;
  }, [searchResults]);

  // Flatten for keyboard navigation
  const flatResults = useMemo(() => searchResults, [searchResults]);

  const navigateToResult = useCallback((result: SearchResult) => {
    sound.nav();
    router.push(result.href);
    setOpen(false);
  }, [router]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, flatResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (flatResults[selectedIndex]) {
        navigateToResult(flatResults[selectedIndex]);
      }
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-start justify-center pt-[15vh] px-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-2xl bg-abyss border border-blood-dim shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 p-4 border-b border-border-dim">
          <span className="text-blood-bright text-lg">{'>'}</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            placeholder={tc(lang, "search.placeholder")}
            className="flex-1 bg-transparent text-content-primary text-sm focus:outline-none placeholder:text-content-dim"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="text-[10px] px-2 py-0.5 border border-border-dim text-content-dim">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {query.trim() === "" ? (
            <div className="p-8 text-center text-content-dim text-xs">
              <span className="cursor-blink">{'>'}</span> {tc(lang, "search.type_to_search")} {index.length} {tc(lang, "search.entries")}
              <div className="mt-4 text-[10px]">
                {data.metadata.total_countries} {tc(lang, "search.countries")} · {blueprints.length} {tc(lang, "search.blueprints")} · {dossiers.length} {tc(lang, "search.dossiers")} · {STATIC_PAGES.length} {tc(lang, "search.sections")}
              </div>
            </div>
          ) : flatResults.length === 0 ? (
            <div className="p-8 text-center text-content-dim text-xs">
              {tc(lang, "search.no_results")} &quot;{query}&quot;
            </div>
          ) : (
            <div className="p-2">
              {(Object.entries(grouped) as [ResultType, SearchResult[]][]).map(([type, results]) => (
                <div key={type} className="mb-2">
                  <div className="text-[9px] text-content-dim uppercase tracking-widest px-2 py-1">
                    {tc(lang, TYPE_META[type].labelKey)} ({results.length})
                  </div>
                  {results.map((r) => {
                    const flatIdx = flatResults.indexOf(r);
                    const isSelected = flatIdx === selectedIndex;
                    const meta = TYPE_META[r.type];
                    return (
                      <button
                        key={`${r.type}-${r.href}-${flatIdx}`}
                        onClick={() => navigateToResult(r)}
                        onMouseEnter={() => setSelectedIndex(flatIdx)}
                        className={`w-full flex items-center gap-3 px-2 py-2 text-left transition-colors ${
                          isSelected ? "bg-panel-hi" : ""
                        }`}
                        style={{ borderLeft: isSelected ? `2px solid ${meta.color}` : "2px solid transparent" }}
                      >
                        <span className="text-sm" style={{ color: meta.color }}>{meta.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className={`text-xs font-bold truncate ${isSelected ? "text-blood-bright" : "text-content-primary"}`}>
                            {r.label}
                          </div>
                          <div className="text-[10px] text-content-dim truncate">{r.sublabel}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border-dim text-[10px] text-content-dim">
          <span>
            <kbd className="px-1 border border-border-dim">↑↓</kbd> {tc(lang, "search.navigate")} ·{" "}
            <kbd className="px-1 border border-border-dim">↵</kbd> {tc(lang, "search.select")} ·{" "}
            <kbd className="px-1 border border-border-dim">esc</kbd> {tc(lang, "search.close")}
          </span>
          <span>V FOR X // {flatResults.length} {tc(lang, "search.results")}</span>
        </div>
      </div>
    </div>
  );
}
