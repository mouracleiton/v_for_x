"use client";

import { useState, useMemo, useEffect } from "react";
import { useStore } from "@/stores/useStore";
import { tc } from "@/lib/i18n-content";
import Link from "next/link";
import backbone from "@/data/world_backbone.json";
import type { WorldBackbone, CountryData } from "@/lib/types";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import { sound } from "@/lib/sound";
import { generateCountryCampaign, generateEquationCampaign, analyzeNeeds, type CampaignKit } from "@/lib/campaign";
import { detectLang, CAMPAIGN_LANGS, type CampaignLang } from "@/lib/campaign-i18n";
import {
  loadAIConfig, saveAIConfig, clearAIConfig,
  generateAIMessage, PLATFORM_STYLES,
  type AIConfig, type AIGenerateResult,
} from "@/lib/ai-generator";
import { downloadJSON } from "@/lib/idb";
import { calculateVulnerability, scoreColor } from "@/lib/vulnerability";

const data = backbone as WorldBackbone;

const sdgTabMeta: Record<string, { label: string; color: string }> = {
  sdg6_water: { label: "WATER", color: "#00ddff" },
  sdg3_health: { label: "HEALTH", color: "var(--color-blood-bright)" },
  sdg7_energy: { label: "ENERGY", color: "var(--color-warning-amber)" },
  sdg4_education: { label: "EDUCATION", color: "var(--color-terminal-green)" },
  sdg13_climate: { label: "CLIMATE", color: "#cc6600" },
  sdg10_inequality: { label: "INEQUALITY", color: "#aa44ff" },
};

type Mode = "country" | "equation";

function CopyButton({ text, label }: { text: string; label: string }) {
  const { lang } = useStore();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      sound.copy();
      setTimeout(() => setCopied(false), 2000);
    } catch {
      sound.error();
    }
  };
  return (
    <button
      onClick={copy}
      className={`text-[10px] px-2 py-0.5 border transition-colors shrink-0 ${
        copied
          ? "border-terminal-green text-terminal-green"
          : "border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright"
      }`}
    >
      {copied ? tc(lang, "act.copied") : label}
    </button>
  );
}

export default function TheActPage() {
  const { lang } = useStore();
  const [mode, setMode] = useState<Mode>("country");
  const [countrySearch, setCountrySearch] = useState("");
  const [selectedIso, setSelectedIso] = useState<string>("");
  const [selectedEq, setSelectedEq] = useState<string>("sdg6_water");
  const [activeTab, setActiveTab] = useState<"thread" | "whatsapp" | "instagram" | "email" | "brief">("thread");
  const [campaignLang, setCampaignLang] = useState<CampaignLang>("en");
  const [langManuallySet, setLangManuallySet] = useState(false);

  // AI generator state
  const [aiConfig, setAIConfig] = useState<AIConfig | null>(null);
  const [aiBaseUrl, setAiBaseUrl] = useState("");
  const [aiApiKey, setAiApiKey] = useState("");
  const [aiModel, setAiModel] = useState("");
  const [showAiConfig, setShowAiConfig] = useState(false);
  const [aiPlatform, setAiPlatform] = useState("twitter");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiResults, setAiResults] = useState<AIGenerateResult[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiCustom, setAiCustom] = useState("");

  const country = useMemo<CountryData | undefined>(
    () => data.countries.find((c) => c.iso3 === selectedIso),
    [selectedIso]
  );

  const searchResults = useMemo(() => {
    const q = countrySearch.trim().toLowerCase();
    if (!q) return [];
    return data.countries
      .filter(
        (c) =>
          c.name_en.toLowerCase().includes(q) ||
          c.iso3.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [countrySearch]);

  const kit: CampaignKit | null = useMemo(() => {
    if (mode === "country" && country) {
      return generateCountryCampaign(country, data, campaignLang);
    }
    if (mode === "equation" && data.sdg_equations) {
      const eq = data.sdg_equations.equations[selectedEq];
      if (eq) return generateEquationCampaign(selectedEq, eq, data.sdg_equations.meta);
    }
    return null;
  }, [mode, country, selectedEq, campaignLang]);

  // Auto-detect language when country changes (unless user manually set it)
  useEffect(() => {
    if (country && !langManuallySet) {
      const detected = detectLang(country.iso3);
      setCampaignLang(detected);
    }
  }, [country, langManuallySet]);

  // Load saved AI config on mount
  useEffect(() => {
    const saved = loadAIConfig();
    if (saved) {
      setAIConfig(saved);
      setAiBaseUrl(saved.baseUrl);
      setAiApiKey(saved.apiKey);
      setAiModel(saved.model);
    }
  }, []);

  // AI handlers
  const handleSaveAIConfig = () => {
    if (!aiBaseUrl.trim() || !aiApiKey.trim() || !aiModel.trim()) return;
    const config: AIConfig = { baseUrl: aiBaseUrl.trim(), apiKey: aiApiKey.trim(), model: aiModel.trim() };
    saveAIConfig(config);
    setAIConfig(config);
    setShowAiConfig(false);
    sound.success();
  };

  const handleClearAIConfig = () => {
    clearAIConfig();
    setAIConfig(null);
    setAiBaseUrl(""); setAiApiKey(""); setAiModel("");
    sound.error();
  };

  const handleAIGenerate = async () => {
    if (!aiConfig || !country) return;
    setAiGenerating(true);
    setAiError(null);
    try {
      const result = await generateAIMessage(aiConfig, country, data, aiPlatform, campaignLang, aiCustom.trim() || undefined);
      setAiResults((prev) => [result, ...prev].slice(0, 20));
      sound.success();
    } catch (e) {
      setAiError((e as Error).message);
      sound.error();
    } finally {
      setAiGenerating(false);
    }
  };

  const handleAIGenerateBatch = async () => {
    if (!aiConfig || !country) return;
    setAiGenerating(true);
    setAiError(null);
    try {
      const platforms = Object.keys(PLATFORM_STYLES);
      for (const p of platforms) {
        try {
          const result = await generateAIMessage(aiConfig, country, data, p, campaignLang, aiCustom.trim() || undefined);
          setAiResults((prev) => [result, ...prev].slice(0, 20));
        } catch (e) {
          setAiResults((prev) => [{
            text: `[ERROR: ${(e as Error).message}]`,
            platform: PLATFORM_STYLES[p]?.name ?? p,
            tone: "error",
            timestamp: Date.now(),
          }, ...prev].slice(0, 20));
        }
      }
      sound.success();
    } catch (e) {
      setAiError((e as Error).message);
      sound.error();
    } finally {
      setAiGenerating(false);
    }
  };

  const needs = useMemo(() => country ? analyzeNeeds(country, campaignLang) : [], [country, campaignLang]);
  const vuln = useMemo(() => country ? calculateVulnerability(country) : null, [country]);

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8 pt-4">
        <div className="text-xs text-content-dim mb-1">{tc(lang, "act.tag")}</div>
        <h1 className="text-2xl md:text-3xl text-blood-bright font-bold glow-blood">
          {tc(lang, "act.title")}
        </h1>
        <p className="text-content-secondary text-sm mt-2">
          {tc(lang, "subtitle.the_act")}{" "}{tc(lang, "act.subtitle_extra")}
        </p>
      </div>

      {/* Mode selector */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => { setMode("country"); sound.select(); }}
          className={`px-4 py-2 text-xs border transition-colors ${
            mode === "country"
              ? "bg-blood text-void border-blood-bright"
              : "border-border-dim text-content-secondary hover:border-blood-dim"
          }`}
        >
          {tc(lang, "act.by_country")}
        </button>
        <button
          onClick={() => { setMode("equation"); sound.select(); }}
          className={`px-4 py-2 text-xs border transition-colors ${
            mode === "equation"
              ? "bg-blood text-void border-blood-bright"
              : "border-border-dim text-content-secondary hover:border-blood-dim"
          }`}
        >
          {tc(lang, "act.by_sdg")}
        </button>
      </div>

      {/* Source selector */}
      <TerminalCard title={tc(lang, "act.select_source")} accent="green" className="mb-6">
        {mode === "country" ? (
          <div>
            <div className="relative">
              <input
                type="text"
                value={countrySearch}
                onChange={(e) => setCountrySearch(e.target.value)}
                placeholder={tc(lang, "act.search_country_ph")}
                className="w-full bg-void border border-border-dim px-3 py-2 text-xs text-content-primary focus:border-terminal-green focus:outline-none"
              />
              {searchResults.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1 border border-border-dim bg-abyss max-h-72 overflow-y-auto">
                  {searchResults.map((c) => (
                    <button
                      key={c.iso3}
                      onClick={() => {
                        setSelectedIso(c.iso3);
                        setCountrySearch("");
                        sound.select();
                      }}
                      className="w-full text-left px-3 py-2 text-xs border-b border-border-dim last:border-b-0 hover:bg-panel flex items-center justify-between"
                    >
                      <span>
                        <span className="text-content-dim font-mono mr-2">{c.iso3}</span>
                        {c.name_en}
                      </span>
                      {c.is_hotspot && <StatusPill color="blood">{tc(lang, "act.hotspot")}</StatusPill>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {country && (
              <div className="mt-3 p-2 border border-terminal-green bg-terminal-green/5 text-xs text-content-primary">
                {tc(lang, "act.selected")} <strong>{country.name_en}</strong> ({country.iso3}) — {(country.demographics.population / 1e6).toFixed(0)}M {tc(lang, "act.people_word")}
                {vuln && (
                  <span className="ml-2 text-[10px]" style={{ color: scoreColor(vuln.composite) }}>
                    {tc(lang, "act.vulnerability_word")} {vuln.composite.toFixed(0)}/100
                  </span>
                )}
              </div>
            )}
            {/* Quick picks */}
            <div className="mt-3">
              <div className="text-[10px] text-content-dim uppercase mb-1">{tc(lang, "act.quick_pick")}</div>
              <div className="flex flex-wrap gap-2">
                {data.hotspots.all.slice(0, 8).map((h) => (
                  <button
                    key={h.iso3}
                    onClick={() => { setSelectedIso(h.iso3); sound.select(); }}
                    className={`px-2 py-1 text-[10px] border ${
                      selectedIso === h.iso3
                        ? "border-blood text-blood-bright"
                        : "border-border-dim text-content-secondary hover:border-blood-dim"
                    }`}
                  >
                    {h.name_en || h.name_pt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {data.sdg_equations &&
              Object.entries(data.sdg_equations.equations).map(([key, eq]) => {
                const meta = sdgTabMeta[key];
                const isActive = selectedEq === key;
                return (
                  <button
                    key={key}
                    onClick={() => { setSelectedEq(key); sound.select(); }}
                    className={`px-3 py-2 text-xs border transition-colors ${
                      isActive ? "bg-void" : "border-border-dim text-content-secondary hover:border-blood-dim"
                    }`}
                    style={isActive ? { borderColor: meta?.color, color: meta?.color } : {}}
                  >
                    <span className="font-bold">{meta?.label ?? eq.title}</span>
                  </button>
                );
              })}
          </div>
        )}
      </TerminalCard>

      {/* Campaign language selector */}
      {mode === "country" && country && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-[10px] text-content-dim uppercase tracking-widest">{tc(lang, "act.output_lang")}</span>
          {CAMPAIGN_LANGS.map((l) => (
            <button
              key={l.id}
              onClick={() => { setCampaignLang(l.id); setLangManuallySet(true); sound.select(); }}
              className={`text-[10px] px-2 py-1 border transition-colors ${
                campaignLang === l.id
                  ? "border-blood text-blood-bright bg-blood/5"
                  : "border-border-dim text-content-secondary hover:border-blood"
              }`}
            >
              {l.flag} {l.label}
            </button>
          ))}
          {campaignLang !== "en" && (
            <span className="text-[9px] text-terminal-green ml-auto">
              ✓ {CAMPAIGN_LANGS.find((l) => l.id === campaignLang)?.label} {tc(lang, "act.detected")}
            </span>
          )}
        </div>
      )}

      {/* Needs analysis (country mode only) */}
      {mode === "country" && country && needs.length > 0 && (
        <TerminalCard title={`${country.name_en.toUpperCase()} — ${tc(lang, "act.needs_title")}`} accent="blood" glow className="mb-6">
          <p className="text-xs text-content-dim mb-3">
            // {needs.length} {tc(lang, "act.needs_desc")}
          </p>
          <div className="space-y-2">
            {needs.slice(0, 8).map((n, i) => (
              <div key={n.id} className="flex items-start gap-3 p-2 border border-border-dim bg-void">
                <span className="text-lg shrink-0">{n.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[9px] text-content-dim uppercase">{n.category}</span>
                    {i === 0 && <span className="text-[9px] text-blood-bright font-bold">{tc(lang, "status.urgent")}</span>}
                  </div>
                  <div className="text-xs text-content-primary font-bold">{n.headline}</div>
                  <div className="text-[10px] text-content-secondary mt-0.5">{n.context}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[9px] text-content-dim">{tc(lang, "act.severity")}</div>
                  <div className="text-sm font-bold" style={{ color: scoreColor(Math.min(n.severity * 2, 100)) }}>
                    {n.severity.toFixed(0)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TerminalCard>
      )}

      {/* ═══ AI MESSAGE GENERATOR ═══ */}
      {mode === "country" && country && (
        <TerminalCard
          title={tc(lang, "act.ai_title")}
          accent="amber"
          className="mb-6"
        >
          <p className="text-xs text-content-dim mb-3">
            // {tc(lang, "act.ai_desc")}
          </p>

          {/* Config status / toggle */}
          <div className="flex items-center gap-2 mb-3">
            {aiConfig ? (
              <>
                <StatusPill color="green">{tc(lang, "act.connected")}</StatusPill>
                <span className="text-[10px] text-content-dim">{aiConfig.model} @ {aiConfig.baseUrl.replace(/https?:\/\//, "").split("/")[0]}</span>
                <button onClick={() => setShowAiConfig(!showAiConfig)} className="text-[10px] px-2 py-0.5 border border-border-dim text-content-secondary hover:border-blood ml-auto">
                  {tc(lang, "act.config_btn")}
                </button>
              </>
            ) : (
              <button onClick={() => setShowAiConfig(true)} className="text-[10px] px-3 py-1 border border-blood text-blood-bright hover:bg-blood hover:text-void">
                {tc(lang, "act.configure_api")}
              </button>
            )}
          </div>

          {/* Config form */}
          {showAiConfig && (
            <div className="p-3 border border-border-dim bg-void mb-3 space-y-2">
              <div>
                <label className="text-[10px] text-content-dim uppercase">{tc(lang, "act.api_base_url")}</label>
                <input
                  type="text"
                  value={aiBaseUrl}
                  onChange={(e) => setAiBaseUrl(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  className="w-full bg-abyss border border-border-dim px-2 py-1 text-xs text-content-primary focus:border-terminal-green focus:outline-none mt-0.5"
                />
                <div className="text-[9px] text-content-dim mt-0.5">OpenAI: https://api.openai.com/v1 · Groq: https://api.groq.com/openai/v1 · OpenRouter: https://openrouter.ai/api/v1</div>
              </div>
              <div>
                <label className="text-[10px] text-content-dim uppercase">{tc(lang, "act.api_key")}</label>
                <input
                  type="password"
                  value={aiApiKey}
                  onChange={(e) => setAiApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full bg-abyss border border-border-dim px-2 py-1 text-xs text-content-primary focus:border-terminal-green focus:outline-none mt-0.5 font-mono"
                />
                <div className="text-[9px] text-content-dim mt-0.5">Stored only in your browser's localStorage. Never sent anywhere except the API URL above.</div>
              </div>
              <div>
                <label className="text-[10px] text-content-dim uppercase">{tc(lang, "act.model")}</label>
                <input
                  type="text"
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  placeholder="gpt-4o-mini"
                  className="w-full bg-abyss border border-border-dim px-2 py-1 text-xs text-content-primary focus:border-terminal-green focus:outline-none mt-0.5 font-mono"
                />
                <div className="text-[9px] text-content-dim mt-0.5">OpenAI: gpt-4o-mini · Groq: llama-3.3-70b-versatile · OpenRouter: meta-llama/llama-3.3-70b-instruct</div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSaveAIConfig}
                  disabled={!aiBaseUrl.trim() || !aiApiKey.trim() || !aiModel.trim()}
                  className="px-3 py-1 text-xs border border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-void disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {tc(lang, "act.save")}
                </button>
                {aiConfig && (
                  <button onClick={handleClearAIConfig} className="px-3 py-1 text-xs border border-blood text-blood hover:bg-blood hover:text-void">
                    {tc(lang, "act.disconnect")}
                  </button>
                )}
                <button onClick={() => setShowAiConfig(false)} className="px-3 py-1 text-xs border border-border-dim text-content-secondary hover:border-blood ml-auto">
                  {tc(lang, "act.cancel")}
                </button>
              </div>
            </div>
          )}

          {/* Generator controls */}
          {aiConfig && (
            <div className="space-y-2">
              {/* Platform selector */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-content-dim uppercase">{tc(lang, "act.platform")}</span>
                {Object.entries(PLATFORM_STYLES).map(([id, style]) => (
                  <button
                    key={id}
                    onClick={() => { setAiPlatform(id); sound.select(); }}
                    className={`text-[10px] px-2 py-1 border transition-colors ${
                      aiPlatform === id
                        ? "border-blood text-blood-bright bg-blood/5"
                        : "border-border-dim text-content-secondary hover:border-blood"
                    }`}
                  >
                    {style.name}
                  </button>
                ))}
              </div>

              {/* Custom instructions */}
              <input
                type="text"
                value={aiCustom}
                onChange={(e) => setAiCustom(e.target.value)}
                placeholder={tc(lang, "act.custom_ph")}
                className="w-full bg-void border border-border-dim px-2 py-1 text-xs text-content-primary focus:border-terminal-green focus:outline-none"
              />

              {/* Generate buttons */}
              <div className="flex gap-2">
                <button
                  onClick={handleAIGenerate}
                  disabled={aiGenerating}
                  className="flex-1 px-3 py-2 text-xs border border-blood text-blood-bright hover:bg-blood hover:text-void transition-colors disabled:opacity-50 disabled:cursor-wait font-bold"
                >
                  {aiGenerating ? tc(lang, "act.generating") : `${tc(lang, "act.generate_for")} ${PLATFORM_STYLES[aiPlatform]?.name.toUpperCase()} ]`}
                </button>
                <button
                  onClick={handleAIGenerateBatch}
                  disabled={aiGenerating}
                  className="px-3 py-2 text-xs border border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-void transition-colors disabled:opacity-50 disabled:cursor-wait"
                >
                  {tc(lang, "act.all_platforms")}
                </button>
              </div>

              {/* Error */}
              {aiError && (
                <div className="p-2 border border-blood text-blood text-[10px] bg-abyss">
                  ⚠ {aiError}
                </div>
              )}

              {/* Results */}
              {aiResults.length > 0 && (
                <div className="space-y-2 mt-3">
                  <div className="text-[10px] text-content-dim uppercase tracking-widest">
                    {tc(lang, "act.generated_messages")} ({aiResults.length})
                  </div>
                  {aiResults.map((r, i) => (
                    <div key={r.timestamp + "-" + i} className="p-2 border border-border-dim bg-void">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] text-terminal-green font-bold uppercase">{r.platform}</span>
                        <span className="text-[9px] text-content-dim">{new Date(r.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <pre className="text-xs text-content-primary whitespace-pre-wrap font-mono leading-relaxed">
                        {r.text}
                      </pre>
                      <div className="flex items-center justify-end gap-1 mt-2 pt-1 border-t border-border-dim">
                        <span className="text-[9px] text-content-dim mr-auto">{r.text.length} {tc(lang, "act.chars")}</span>
                        <CopyButton text={r.text} label={tc(lang, "act.copy_btn")} />
                        {r.platform === "Twitter/X" && (
                          <a
                            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(r.text)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[9px] px-2 py-0.5 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright"
                          >
                            {tc(lang, "act.tweet_btn")}
                          </a>
                        )}
                        {r.platform === "WhatsApp" && (
                          <a
                            href={`https://wa.me/?text=${encodeURIComponent(r.text)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[9px] px-2 py-0.5 border border-border-dim text-content-secondary hover:border-terminal-green hover:text-terminal-green"
                          >
                            {tc(lang, "act.whatsapp_btn")}
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => { setAiResults([]); sound.error(); }}
                    className="text-[9px] px-2 py-0.5 border border-border-dim text-content-dim hover:border-blood"
                  >
                    {tc(lang, "act.clear_all")}
                  </button>
                </div>
              )}
            </div>
          )}
        </TerminalCard>
      )}

      {/* Campaign output */}
      {kit ? (
        <>
          {/* Format tabs */}
          <div className="flex flex-wrap gap-2 mb-4">
            {([
              { key: "thread", label: `🐦 THREAD (${kit.tweets.length})` },
              { key: "whatsapp", label: "💬 WHATSAPP" },
              { key: "instagram", label: "📸 INSTAGRAM" },
              { key: "email", label: "✉ EMAIL" },
              { key: "brief", label: "📄 BRIEF" },
            ] as const).map((t) => (
              <button
                key={t.key}
                onClick={() => { setActiveTab(t.key); sound.select(); }}
                className={`px-3 py-1.5 text-xs border transition-colors ${
                  activeTab === t.key
                    ? "border-blood text-blood-bright bg-blood/10"
                    : "border-border-dim text-content-secondary hover:border-blood-dim"
                }`}
              >
                {t.label}
              </button>
            ))}
            <button
              onClick={() => {
                downloadJSON(kit, `vfx-campaign-${mode === "country" ? selectedIso : selectedEq}.json`);
                sound.success();
              }}
              className="ml-auto px-3 py-1.5 text-xs border border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-void transition-colors"
            >
              ↓ JSON
            </button>
          </div>

          {/* Tweet thread */}
          {activeTab === "thread" && (
            <div className="space-y-3">
              {kit.tweets.map((tweet, i) => (
                <div key={i} className={`terminal-card p-3 ${tweet.type === "hook" ? "border-blood-dim" : ""}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{tweet.icon}</span>
                      <span className="text-[10px] text-content-dim uppercase tracking-widest">
                        {i + 1}/{kit.tweets.length}
                        <span className="ml-2 text-[9px]" style={{
                          color: tweet.type === "hook" ? "var(--color-blood-bright)" : tweet.type === "solution" ? "var(--color-terminal-green)" : tweet.type === "demand" ? "var(--color-warning-amber)" : "#888"
                        }}>
                          {tweet.type.toUpperCase()}
                        </span>
                      </span>
                    </div>
                    <span className={`text-[9px] ${tweet.charCount > 280 ? "text-blood-bright" : "text-terminal-green"}`}>
                      {tweet.charCount} {tweet.charCount > 280 ? tc(lang, "act.split") : "✓"}
                    </span>
                  </div>
                  <pre className="text-xs text-content-primary whitespace-pre-wrap font-mono flex-1 leading-relaxed">
                    {tweet.text}
                  </pre>
                  <div className="flex items-center justify-end mt-2 pt-2 border-t border-border-dim">
                    <CopyButton text={tweet.text} label="[ COPY ]" />
                    <a
                      href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet.text)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] px-2 py-0.5 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright ml-1"
                    >
                      {tc(lang, "act.tweet_btn")}
                    </a>
                  </div>
                </div>
              ))}
              {kit.tweets.length > 1 && (
                <TerminalCard title={tc(lang, "act.copy_thread")}>
                  <CopyButton text={kit.tweets.map((t, i) => `${i + 1}/${kit.tweets.length}\n${t.text}`).join("\n\n---\n\n")} label={tc(lang, "act.copy_all")} />
                </TerminalCard>
              )}
            </div>
          )}

          {/* WhatsApp */}
          {activeTab === "whatsapp" && (
            <TerminalCard title={tc(lang, "card.whatsapp_msg")} accent="green">
              <pre className="text-xs text-content-primary whitespace-pre-wrap font-mono leading-relaxed p-3 border border-border-dim bg-void max-h-[400px] overflow-y-auto">
                {kit.whatsapp}
              </pre>
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-border-dim">
                <span className="text-[10px] text-content-dim">{kit.whatsapp.length} chars</span>
                <div className="flex gap-1">
                  <CopyButton text={kit.whatsapp} label="[ COPY ]" />
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(kit.whatsapp)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] px-2 py-0.5 border border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-void"
                  >
                    {tc(lang, "act.open_whatsapp")}
                  </a>
                </div>
              </div>
            </TerminalCard>
          )}

          {/* Instagram */}
          {activeTab === "instagram" && (
            <TerminalCard title={tc(lang, "card.instagram_caption")} accent="amber">
              <pre className="text-xs text-content-primary whitespace-pre-wrap font-mono leading-relaxed p-3 border border-border-dim bg-void max-h-[400px] overflow-y-auto">
                {kit.instagram}
              </pre>
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-border-dim">
                <span className="text-[10px] text-content-dim">{kit.instagram.length} chars · {kit.instagram.includes("#") ? tc(lang, "act.hashtags_included") : tc(lang, "act.no_hashtags")}</span>
                <CopyButton text={kit.instagram} label={tc(lang, "act.copy_caption")} />
              </div>
              <div className="text-[10px] text-content-dim mt-2 italic">
                {tc(lang, "act.ig_tip")}
              </div>
            </TerminalCard>
          )}

          {/* Email */}
          {activeTab === "email" && (
            <TerminalCard title={tc(lang, "card.email_rep")} accent="green" glow>
              <div className="mb-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[10px] text-content-dim uppercase">{tc(lang, "act.subject")}</span>
                  <CopyButton text={kit.email.subject} label="[ COPY ]" />
                </div>
                <div className="p-2 border border-border-dim bg-void text-xs text-content-primary font-mono">
                  {kit.email.subject}
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[10px] text-content-dim uppercase">{tc(lang, "act.body")}</span>
                <CopyButton text={kit.email.body} label={tc(lang, "act.copy_email")} />
              </div>
              <pre className="p-3 border border-border-dim bg-void text-xs text-content-primary whitespace-pre-wrap font-mono leading-relaxed max-h-[500px] overflow-y-auto">
                {kit.email.body}
              </pre>
              <div className="text-[10px] text-content-dim mt-2 italic">
                {tc(lang, "act.replace_brackets")}
              </div>
            </TerminalCard>
          )}

          {/* Brief */}
          {activeTab === "brief" && (
            <TerminalCard title={kit.brief.title} accent="blood" glow>
              <div className="space-y-4">
                <div>
                  <div className="text-[10px] text-content-dim uppercase tracking-widest mb-1">{tc(lang, "act.summary")}</div>
                  <p className="text-sm text-content-secondary">{kit.brief.summary}</p>
                </div>
                <div>
                  <div className="text-[10px] text-content-dim uppercase tracking-widest mb-2">{tc(lang, "act.key_data")}</div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {kit.brief.keyStats.map((s, i) => (
                      <div key={i} className="border border-border-dim bg-void p-2">
                        <div className="text-[9px] text-content-dim uppercase">{s.label}</div>
                        <div className="text-sm font-bold text-blood-bright">{s.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="border-l-2 border-blood pl-3">
                  <div className="text-[10px] text-content-dim uppercase tracking-widest mb-1">{tc(lang, "act.call_to_action")}</div>
                  <p className="text-sm text-content-primary">{kit.brief.callToAction}</p>
                </div>
                <div>
                  <div className="text-[10px] text-content-dim uppercase tracking-widest mb-1">{tc(lang, "act.sources")}</div>
                  <ul className="text-[10px] text-content-dim space-y-0.5">
                    {kit.brief.sources.slice(0, 8).map((s, i) => (
                      <li key={i}>• {s}</li>
                    ))}
                  </ul>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { window.print(); sound.select(); }}
                    className="flex-1 py-2 text-xs border border-blood text-blood-bright hover:bg-blood hover:text-void transition-colors uppercase tracking-widest"
                  >
                    {tc(lang, "act.print_pdf")}
                  </button>
                  <CopyButton text={`${kit.brief.title}\n\n${kit.brief.summary}\n\n${kit.brief.keyStats.map(s => `${s.label}: ${s.value}`).join("\n")}\n\n${kit.brief.callToAction}`} label={tc(lang, "act.copy_brief")} />
                </div>
              </div>
            </TerminalCard>
          )}
        </>
      ) : (
        <TerminalCard title={tc(lang, "card.awaiting_input")} accent="amber">
          <div className="text-sm text-content-dim text-center py-6">
            {tc(lang, "act.select_prompt")}
          </div>
        </TerminalCard>
      )}
    </div>
  );
}
