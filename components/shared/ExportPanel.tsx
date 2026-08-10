"use client";

import { useState, useMemo } from "react";
import type { CountryData } from "@/lib/types";
import {
  exportCountryCSV,
  exportAllCountriesCSV,
  exportJSON,
  generateCitation,
  generateEmbedCode,
  downloadFile,
} from "@/lib/export-utils";
import { sound } from "@/lib/sound";
import { SITE } from "@/lib/seo";

interface ExportPanelProps {
  /** Single country context (for CSV/JSON/citation). */
  country?: CountryData;
  /** Multi-country context (for CSV/JSON of several countries). */
  countries?: CountryData[];
  /** Page slug for embed code, e.g. "sorrow-map" or "the-compare". */
  page?: string;
  /** Extra query params merged into the embed URL. */
  params?: Record<string, string>;
  className?: string;
}

/**
 * Reusable compact glass panel offering CSV/JSON download, academic
 * citations (APA/MLA), and an embeddable iframe snippet.
 */
export default function ExportPanel({
  country,
  countries,
  page = "sorrow-map",
  params = {},
  className = "",
}: ExportPanelProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [showEmbed, setShowEmbed] = useState(false);
  const [citationFormat, setCitationFormat] = useState<"apa" | "mla">("apa");

  /* The reference country for citations: explicit single country, else
     the first of the multi-country list. */
  const refCountry = country ?? countries?.[0];

  const citation = useMemo(
    () => (refCountry ? generateCitation(refCountry, citationFormat) : ""),
    [refCountry, citationFormat]
  );

  const embedParams = useMemo(() => {
    if (country) return { ...params, country: country.iso3 };
    if (countries && countries.length > 0)
      return { ...params, countries: countries.map((c) => c.iso3).join(",") };
    return params;
  }, [country, countries, params]);

  const embedCode = useMemo(
    () => generateEmbedCode(page, embedParams),
    [page, embedParams]
  );

  const flash = (key: string) => {
    setCopied(key);
    sound.copy();
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1800);
  };

  const handleCopy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      flash(key);
    } catch {
      sound.error();
    }
  };

  const handleCSV = () => {
    sound.select();
    if (countries && countries.length > 0) {
      downloadFile(
        `vfx-countries-${countries.length}.csv`,
        exportAllCountriesCSV(countries),
        "text/csv;charset=utf-8"
      );
    } else if (country) {
      downloadFile(
        `vfx-${country.iso3.toLowerCase()}.csv`,
        exportCountryCSV(country),
        "text/csv;charset=utf-8"
      );
    }
  };

  const handleJSON = () => {
    sound.select();
    if (countries && countries.length > 0) {
      exportJSON(countries, `vfx-countries-${countries.length}.json`);
    } else if (country) {
      exportJSON(country, `vfx-${country.iso3.toLowerCase()}.json`);
    }
  };

  const hasData = Boolean(country || (countries && countries.length > 0));

  if (!hasData) {
    return (
      <div
        className={`terminal-card p-3 ${className}`}
        style={{ borderColor: "var(--color-border-dim)" }}
      >
        <div className="text-[10px] uppercase tracking-widest" style={{ color: "var(--color-content-dim)" }}>
          {"> export"} // NO DATA SELECTED
        </div>
      </div>
    );
  }

  const btnBase =
    "text-[10px] px-2.5 py-1.5 border transition-colors flex items-center gap-1 uppercase tracking-wider";

  return (
    <div className={`terminal-card p-3 ${className}`}>
      <div
        className="text-[10px] uppercase tracking-widest mb-3 pb-2 border-b flex items-center justify-between"
        style={{
          color: "var(--color-command-bright)",
          borderColor: "var(--color-border-dim)",
        }}
      >
        <span>{"> "}export · cite · embed</span>
        <span style={{ color: "var(--color-content-dim)" }}>
          {refCountry ? refCountry.iso3 : `${countries?.length ?? 0}× country`}
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 mb-3">
        <button
          onClick={handleCSV}
          className={`${btnBase} border-border-dim text-content-secondary hover:border-terminal-green hover:text-terminal-green`}
        >
          ⭳ CSV
        </button>
        <button
          onClick={handleJSON}
          className={`${btnBase} border-border-dim text-content-secondary hover:border-command hover:text-command-bright`}
        >
          ⭳ JSON
        </button>
        <button
          onClick={() => handleCopy("apa", citation)}
          className={`${btnBase} ${
            copied === "apa"
              ? "border-terminal-green text-terminal-green"
              : "border-border-dim text-content-secondary hover:border-amber hover:text-warning-amber"
          }`}
        >
          {copied === "apa" ? "✓ COPIED" : "⧉ APA"}
        </button>
        <button
          onClick={() => handleCopy("mla", generateCitation(refCountry!, "mla"))}
          className={`${btnBase} ${
            copied === "mla"
              ? "border-terminal-green text-terminal-green"
              : "border-border-dim text-content-secondary hover:border-amber hover:text-warning-amber"
          }`}
        >
          {copied === "mla" ? "✓ COPIED" : "⧉ MLA"}
        </button>
        <button
          onClick={() => {
            setShowEmbed((s) => !s);
            sound.select();
          }}
          className={`${btnBase} ${
            showEmbed
              ? "border-blood text-blood-bright"
              : "border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright"
          }`}
        >
          {"</>"} EMBED
        </button>
      </div>

      {/* Citation preview */}
      {refCountry && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] uppercase tracking-widest" style={{ color: "var(--color-content-dim)" }}>
              // citation preview
            </span>
            <div className="flex gap-1">
              {(["apa", "mla"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setCitationFormat(f)}
                  className="text-[9px] px-1.5 py-0.5 border uppercase"
                  style={{
                    borderColor:
                      citationFormat === f
                        ? "var(--color-warning-amber)"
                        : "var(--color-border-dim)",
                    color:
                      citationFormat === f
                        ? "var(--color-warning-amber)"
                        : "var(--color-content-dim)",
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <p
            className="text-[11px] leading-relaxed p-2 border"
            style={{
              backgroundColor: "var(--color-void)",
              borderColor: "var(--color-border-dim)",
              color: "var(--color-content-secondary)",
            }}
          >
            {citation}
          </p>
        </div>
      )}

      {/* Embed code */}
      {showEmbed && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] uppercase tracking-widest" style={{ color: "var(--color-content-dim)" }}>
              // embed snippet
            </span>
            <button
              onClick={() => handleCopy("embed", embedCode)}
              className={`text-[9px] px-1.5 py-0.5 border uppercase transition-colors ${
                copied === "embed"
                  ? "border-terminal-green text-terminal-green"
                  : "border-border-dim text-content-dim hover:border-blood hover:text-blood-bright"
              }`}
            >
              {copied === "embed" ? "✓ COPIED" : "⧉ COPY"}
            </button>
          </div>
          <textarea
            readOnly
            value={embedCode}
            rows={5}
            onClick={(e) => e.currentTarget.select()}
            className="w-full text-[10px] p-2 border resize-none focus:outline-none"
            style={{
              backgroundColor: "var(--color-void)",
              borderColor: "var(--color-border-dim)",
              color: "var(--color-content-secondary)",
              fontFamily: "var(--font-mono)",
            }}
          />
          <div className="text-[9px] mt-1" style={{ color: "var(--color-content-dim)" }}>
            ▸ Paste into any blog, CMS, or presentation. Source:{" "}
            <span style={{ color: "var(--color-blood-bright)" }}>{SITE.url}</span>
          </div>
          <a
            href="/the-embed/"
            className="inline-block mt-2 text-[9px] uppercase tracking-widest border border-border-dim px-2 py-1 transition-colors hover:border-blood hover:text-blood-bright no-underline"
            style={{ color: "var(--color-content-secondary)" }}
          >
            ▶ Build an advanced widget →
          </a>
        </div>
      )}
    </div>
  );
}
