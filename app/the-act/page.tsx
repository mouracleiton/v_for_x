"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import backbone from "@/data/world_backbone.json";
import type { WorldBackbone, CountryData } from "@/lib/types";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import { sound } from "@/lib/sound";
import { generateCountryCampaign, generateEquationCampaign, analyzeNeeds, type CampaignKit } from "@/lib/campaign";
import { downloadJSON } from "@/lib/idb";
import { calculateVulnerability, scoreColor } from "@/lib/vulnerability";

const data = backbone as WorldBackbone;

const sdgTabMeta: Record<string, { label: string; color: string }> = {
  sdg6_water: { label: "WATER", color: "#00ddff" },
  sdg3_health: { label: "HEALTH", color: "#e10600" },
  sdg7_energy: { label: "ENERGY", color: "#ffaa00" },
  sdg4_education: { label: "EDUCATION", color: "#00ff41" },
  sdg13_climate: { label: "CLIMATE", color: "#cc6600" },
  sdg10_inequality: { label: "INEQUALITY", color: "#aa44ff" },
};

type Mode = "country" | "equation";

function CopyButton({ text, label }: { text: string; label: string }) {
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
      {copied ? "[ COPIED ]" : label}
    </button>
  );
}

export default function TheActPage() {
  const [mode, setMode] = useState<Mode>("country");
  const [countrySearch, setCountrySearch] = useState("");
  const [selectedIso, setSelectedIso] = useState<string>("");
  const [selectedEq, setSelectedEq] = useState<string>("sdg6_water");
  const [activeTab, setActiveTab] = useState<"thread" | "whatsapp" | "instagram" | "email" | "brief">("thread");

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
      return generateCountryCampaign(country, data);
    }
    if (mode === "equation" && data.sdg_equations) {
      const eq = data.sdg_equations.equations[selectedEq];
      if (eq) return generateEquationCampaign(selectedEq, eq, data.sdg_equations.meta);
    }
    return null;
  }, [mode, country, selectedEq]);

  const needs = useMemo(() => country ? analyzeNeeds(country) : [], [country]);
  const vuln = useMemo(() => country ? calculateVulnerability(country) : null, [country]);

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8 pt-4">
        <div className="text-xs text-content-dim mb-1">[12] THE ACT</div>
        <h1 className="text-2xl md:text-3xl text-blood-bright font-bold glow-blood">
          THE ACT
        </h1>
        <p className="text-content-secondary text-sm mt-2">
          // Pick a country. Get a ready-to-post analysis of what it actually needs.
          Tweet threads, WhatsApp messages, Instagram captions — all pre-written with real data.
          Copy. Paste. Change the narrative.
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
          BY COUNTRY
        </button>
        <button
          onClick={() => { setMode("equation"); sound.select(); }}
          className={`px-4 py-2 text-xs border transition-colors ${
            mode === "equation"
              ? "bg-blood text-void border-blood-bright"
              : "border-border-dim text-content-secondary hover:border-blood-dim"
          }`}
        >
          BY SDG EQUATION
        </button>
      </div>

      {/* Source selector */}
      <TerminalCard title="SELECT SOURCE" accent="green" className="mb-6">
        {mode === "country" ? (
          <div>
            <div className="relative">
              <input
                type="text"
                value={countrySearch}
                onChange={(e) => setCountrySearch(e.target.value)}
                placeholder="Search country (e.g. Sudan, SSD, Yemen…)"
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
                      {c.is_hotspot && <StatusPill color="blood">HOTSPOT</StatusPill>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {country && (
              <div className="mt-3 p-2 border border-terminal-green bg-terminal-green/5 text-xs text-content-primary">
                ✓ Selected: <strong>{country.name_en}</strong> ({country.iso3}) — {(country.demographics.population / 1e6).toFixed(0)}M people
                {vuln && (
                  <span className="ml-2 text-[10px]" style={{ color: scoreColor(vuln.composite) }}>
                    Vulnerability: {vuln.composite.toFixed(0)}/100
                  </span>
                )}
              </div>
            )}
            {/* Quick picks */}
            <div className="mt-3">
              <div className="text-[10px] text-content-dim uppercase mb-1">Quick pick — worst crises</div>
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

      {/* Needs analysis (country mode only) */}
      {mode === "country" && country && needs.length > 0 && (
        <TerminalCard title={`${country.name_en.toUpperCase()} — WHAT THE DATA SAYS IT NEEDS`} accent="blood" glow className="mb-6">
          <p className="text-xs text-content-dim mb-3">
            // {needs.length} critical needs identified. These are sorted by severity —
            how far the country is from acceptable thresholds.
          </p>
          <div className="space-y-2">
            {needs.slice(0, 8).map((n, i) => (
              <div key={n.id} className="flex items-start gap-3 p-2 border border-border-dim bg-void">
                <span className="text-lg shrink-0">{n.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[9px] text-content-dim uppercase">{n.category}</span>
                    {i === 0 && <span className="text-[9px] text-blood-bright font-bold">URGENT</span>}
                  </div>
                  <div className="text-xs text-content-primary font-bold">{n.headline}</div>
                  <div className="text-[10px] text-content-secondary mt-0.5">{n.context}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[9px] text-content-dim">SEVERITY</div>
                  <div className="text-sm font-bold" style={{ color: scoreColor(Math.min(n.severity * 2, 100)) }}>
                    {n.severity.toFixed(0)}
                  </div>
                </div>
              </div>
            ))}
          </div>
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
                          color: tweet.type === "hook" ? "#e10600" : tweet.type === "solution" ? "#00ff41" : tweet.type === "demand" ? "#ffaa00" : "#888"
                        }}>
                          {tweet.type.toUpperCase()}
                        </span>
                      </span>
                    </div>
                    <span className={`text-[9px] ${tweet.charCount > 280 ? "text-blood-bright" : "text-terminal-green"}`}>
                      {tweet.charCount} {tweet.charCount > 280 ? "(split)" : "✓"}
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
                      [ TWEET ]
                    </a>
                  </div>
                </div>
              ))}
              {kit.tweets.length > 1 && (
                <TerminalCard title="COPY ENTIRE THREAD">
                  <CopyButton text={kit.tweets.map((t, i) => `${i + 1}/${kit.tweets.length}\n${t.text}`).join("\n\n---\n\n")} label="[ COPY ALL ]" />
                </TerminalCard>
              )}
            </div>
          )}

          {/* WhatsApp */}
          {activeTab === "whatsapp" && (
            <TerminalCard title="💬 WHATSAPP / TELEGRAM MESSAGE" accent="green">
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
                    [ OPEN WHATSAPP ]
                  </a>
                </div>
              </div>
            </TerminalCard>
          )}

          {/* Instagram */}
          {activeTab === "instagram" && (
            <TerminalCard title="📸 INSTAGRAM / FACEBOOK CAPTION" accent="amber">
              <pre className="text-xs text-content-primary whitespace-pre-wrap font-mono leading-relaxed p-3 border border-border-dim bg-void max-h-[400px] overflow-y-auto">
                {kit.instagram}
              </pre>
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-border-dim">
                <span className="text-[10px] text-content-dim">{kit.instagram.length} chars · {kit.instagram.includes("#") ? "hashtags included" : "no hashtags"}</span>
                <CopyButton text={kit.instagram} label="[ COPY CAPTION ]" />
              </div>
              <div className="text-[10px] text-content-dim mt-2 italic">
                ▸ Tip: Use the Country Briefing page (/the-briefing/) to generate a printable image for your post.
              </div>
            </TerminalCard>
          )}

          {/* Email */}
          {activeTab === "email" && (
            <TerminalCard title="✉ EMAIL TO REPRESENTATIVE" accent="green" glow>
              <div className="mb-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[10px] text-content-dim uppercase">Subject</span>
                  <CopyButton text={kit.email.subject} label="[ COPY ]" />
                </div>
                <div className="p-2 border border-border-dim bg-void text-xs text-content-primary font-mono">
                  {kit.email.subject}
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[10px] text-content-dim uppercase">Body</span>
                <CopyButton text={kit.email.body} label="[ COPY EMAIL ]" />
              </div>
              <pre className="p-3 border border-border-dim bg-void text-xs text-content-primary whitespace-pre-wrap font-mono leading-relaxed max-h-[500px] overflow-y-auto">
                {kit.email.body}
              </pre>
              <div className="text-[10px] text-content-dim mt-2 italic">
                ▸ Replace [bracketed] fields with your information.
              </div>
            </TerminalCard>
          )}

          {/* Brief */}
          {activeTab === "brief" && (
            <TerminalCard title={kit.brief.title} accent="blood" glow>
              <div className="space-y-4">
                <div>
                  <div className="text-[10px] text-content-dim uppercase tracking-widest mb-1">SUMMARY</div>
                  <p className="text-sm text-content-secondary">{kit.brief.summary}</p>
                </div>
                <div>
                  <div className="text-[10px] text-content-dim uppercase tracking-widest mb-2">KEY DATA</div>
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
                  <div className="text-[10px] text-content-dim uppercase tracking-widest mb-1">CALL TO ACTION</div>
                  <p className="text-sm text-content-primary">{kit.brief.callToAction}</p>
                </div>
                <div>
                  <div className="text-[10px] text-content-dim uppercase tracking-widest mb-1">SOURCES</div>
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
                    🖨 PRINT / PDF
                  </button>
                  <CopyButton text={`${kit.brief.title}\n\n${kit.brief.summary}\n\n${kit.brief.keyStats.map(s => `${s.label}: ${s.value}`).join("\n")}\n\n${kit.brief.callToAction}`} label="[ COPY BRIEF ]" />
                </div>
              </div>
            </TerminalCard>
          )}
        </>
      ) : (
        <TerminalCard title="AWAITING INPUT" accent="amber">
          <div className="text-sm text-content-dim text-center py-6">
            ▒ Select a country or SDG equation above to generate your campaign kit. ▒
          </div>
        </TerminalCard>
      )}
    </div>
  );
}
