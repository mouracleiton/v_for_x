"use client";

import { useState, useMemo } from "react";
import { useStore } from "@/stores/useStore";
import { tc } from "@/lib/i18n-content";
import type { Lang } from "@/lib/i18n";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import { sound } from "@/lib/sound";
import {
  getAllDatasets,
  getCategoryList,
  getStats,
  searchDatasets,
  PRIORITY_META,
  type DatasetCategory,
  type DatasetPriority,
  type Dataset,
} from "@/lib/public-datasets";

type CatFilter = DatasetCategory | "all";
type PriFilter = DatasetPriority | "all";

export default function TheVaultPage() {
  const { lang } = useStore();
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<CatFilter>("all");
  const [pri, setPri] = useState<PriFilter>("all");

  const stats = useMemo(() => getStats(), []);
  const categories = useMemo(() => getCategoryList(), []);
  const datasets = useMemo(() => getAllDatasets(), []);

  const results = useMemo(
    () => searchDatasets({ query, category: cat, priority: pri }),
    [query, cat, pri]
  );

  const resetFilters = () => {
    setQuery("");
    setCat("all");
    setPri("all");
    sound.select();
  };

  const hasFilters = query !== "" || cat !== "all" || pri !== "all";

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8 pt-4">
        <div className="text-xs text-content-dim mb-1">{tc(lang, "vault.tag")}</div>
        <h1 className="text-2xl md:text-3xl text-blood-bright font-bold glow-blood">
          {tc(lang, "vault.title")}
        </h1>
        <p className="text-content-secondary text-sm mt-2 max-w-3xl">
          {tc(lang, "vault.subtitle")}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <Indicator label={tc(lang, "vault.stat_datasets")} value={String(stats.total)} unit="" color="var(--color-blood-bright)" />
        <Indicator label={tc(lang, "vault.stat_categories")} value={String(stats.categories)} unit="" color="var(--color-warning-amber)" />
        <Indicator label={tc(lang, "vault.stat_critical")} value={String(stats.criticalCount)} unit="" color="var(--color-blood)" />
        <Indicator label={tc(lang, "vault.stat_open")} value="100" unit="%" color="var(--color-terminal-green)" />
      </div>

      {/* Search bar */}
      <div className="mb-4 flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tc(lang, "vault.search_placeholder")}
          className="flex-1 bg-abyss border border-border-dim text-content-primary px-3 py-2 text-sm focus:outline-none focus:border-blood transition-colors"
        />
        {hasFilters && (
          <button
            onClick={resetFilters}
            className="px-3 py-2 text-xs border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright transition-colors"
          >
            ✕ {tc(lang, "vault.clear")}
          </button>
        )}
      </div>

      {/* Category filter chips */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        <FilterChip
          active={cat === "all"}
          onClick={() => { setCat("all"); sound.select(); }}
          label={tc(lang, "vault.filter_all")}
          count={datasets.length}
        />
        {categories.map((c) => (
          <FilterChip
            key={c.key}
            active={cat === c.key}
            onClick={() => { setCat(c.key); sound.select(); }}
            label={`${c.icon} ${c.label}`}
            count={stats.byCategory[c.key] ?? 0}
          />
        ))}
      </div>

      {/* Priority filter */}
      <div className="mb-6 flex flex-wrap gap-1.5">
        <FilterChip
          active={pri === "all"}
          onClick={() => { setPri("all"); sound.select(); }}
          label={tc(lang, "vault.filter_any_priority")}
        />
        {(["critical", "high", "standard"] as const).map((p) => (
          <FilterChip
            key={p}
            active={pri === p}
            onClick={() => { setPri(p); sound.select(); }}
            label={PRIORITY_META[p].label}
            count={stats.byPriority[p]}
          />
        ))}
      </div>

      {/* Results count */}
      <div className="text-xs text-content-dim mb-4">
        {tc(lang, "vault.showing").replace("{n}", String(results.length))}{" "}
        {hasFilters && query && (
          <span className="text-content-secondary">
            · {tc(lang, "vault.query")}: &quot;{query}&quot;
          </span>
        )}
      </div>

      {/* Dataset cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {results.map(({ dataset }) => (
          <DatasetCard key={dataset.id} dataset={dataset} lang={lang} />
        ))}
      </div>

      {/* Empty state */}
      {results.length === 0 && (
        <TerminalCard title={tc(lang, "vault.no_results")} accent="amber">
          <p className="text-content-secondary text-sm">
            {tc(lang, "vault.no_results_desc")}
          </p>
        </TerminalCard>
      )}

      {/* Footer note */}
      <div className="mt-10 pt-6 border-t border-border-dim">
        <TerminalCard title={tc(lang, "vault.methodology_title")} accent="green">
          <p className="text-content-secondary text-xs leading-relaxed">
            {tc(lang, "vault.methodology")}
          </p>
        </TerminalCard>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

function FilterChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 text-[11px] border transition-colors ${
        active
          ? "border-blood text-blood-bright bg-blood/10"
          : "border-border-dim text-content-secondary hover:border-blood-dim hover:text-content-primary"
      }`}
    >
      {label}
      {count !== undefined && (
        <span className="ml-1 text-content-dim">({count})</span>
      )}
    </button>
  );
}

function DatasetCard({
  dataset,
  lang,
}: {
  dataset: Dataset;
  lang: Lang;
}) {
  const pm = PRIORITY_META[dataset.priority];
  return (
    <TerminalCard accent={pm.color as "blood" | "amber"}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-sm font-bold text-content-primary leading-tight flex-1">
          {dataset.name}
        </h3>
        <StatusPill color={pm.color}>{pm.label}</StatusPill>
      </div>

      <div className="text-[11px] text-content-dim mb-2">
        {dataset.provider}
      </div>

      <p className="text-xs text-content-secondary leading-relaxed mb-3">
        {dataset.description}
      </p>

      {/* Metadata grid */}
      <div className="grid grid-cols-1 gap-1 text-[11px] mb-3">
        <MetaRow label={tc(lang, "vault.meta_coverage")} value={dataset.coverage} />
        <MetaRow label={tc(lang, "vault.meta_format")} value={dataset.format} />
        <MetaRow label={tc(lang, "vault.meta_license")} value={dataset.license} />
        <MetaRow label={tc(lang, "vault.meta_cadence")} value={dataset.cadence} />
        <MetaRow label={tc(lang, "vault.meta_dimension")} value={dataset.mapsTo} />
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1 mb-3">
        {dataset.tags.slice(0, 5).map((tag) => (
          <span
            key={tag}
            className="text-[9px] px-1.5 py-0.5 border border-border-dim text-content-dim uppercase tracking-wide"
          >
            {tag}
          </span>
        ))}
      </div>

      <a
        href={dataset.url}
        target="_blank"
        rel="noopener noreferrer nofollow"
        onClick={() => sound.nav()}
        className="inline-block text-xs text-blood-bright border border-blood-dim hover:border-blood hover:bg-blood/10 px-3 py-1.5 transition-colors"
      >
        {tc(lang, "vault.access")} ↗
      </a>
    </TerminalCard>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-content-dim shrink-0 w-20">{label}</span>
      <span className="text-content-secondary">{value}</span>
    </div>
  );
}

function Indicator({ label, value, unit, color }: {
  label: string;
  value: string;
  unit: string;
  color: string;
}) {
  return (
    <div className="p-3 border border-border-dim bg-void">
      <div className="text-[9px] text-content-dim uppercase tracking-widest">{label}</div>
      <div className="text-2xl font-bold" style={{ color }}>
        {value}<span className="text-sm ml-0.5">{unit}</span>
      </div>
    </div>
  );
}
