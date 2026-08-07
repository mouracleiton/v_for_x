"use client";

import { use, useMemo, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import backbone from "@/data/world_backbone.json";
import TerminalCard from "@/components/ui/TerminalCard";
import GlitchText from "@/components/ui/GlitchText";
import DataBar from "@/components/ui/DataBar";
import StatusPill from "@/components/ui/StatusPill";
import { useStore } from "@/stores/useStore";
import {
  formatNumber,
  formatPct,
  formatMoney,
  wfpClassColor,
  wfpClassLabel,
} from "@/lib/format";
import { sound } from "@/lib/sound";
import FreshnessBadge, { computeDataFreshness } from "@/components/shared/FreshnessBadge";
import {
  countryToEquation,
  countryToProtocol,
  countryToRegistry,
  countryToTrilha,
} from "@/lib/crosslinks";
import type { WorldBackbone, CountryData } from "@/lib/types";
import {
  MigrationDeepDive,
  GovernanceDeepDive,
  ClimateHungerDeepDive,
  MilitaryHealthDeepDive,
  GenderDeepDive,
  SdgScorecardDeepDive,
} from "./DeepDives";

const data = backbone as WorldBackbone;

/* ═══════════════════════════════════════════════════════════════
   DATA-ROW HELPER — terminal table row
   ═══════════════════════════════════════════════════════════════ */

function DataRow({
  label,
  value,
  unit,
}: {
  label: string;
  value: string | number | null | undefined;
  unit?: string;
}) {
  const display = value === null || value === undefined ? "N/A" : String(value);
  return (
    <div className="flex justify-between items-center py-1 px-2 text-xs border-b border-border-dim/50 hover:bg-panel-hi/40">
      <span className="text-content-secondary">{label}</span>
      <span className="text-content-primary text-right ml-2">
        {display}
        {unit && value !== null && value !== undefined ? (
          <span className="text-content-dim ml-0.5">{unit}</span>
        ) : null}
      </span>
    </div>
  );
}

function formatVal(n: number | null | undefined, unit?: string, formatter?: (n: number) => string): string {
  if (n === null || n === undefined) return "N/A";
  if (formatter) return formatter(n) + (unit ?? "");
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 }) + (unit ?? "");
}

/* ═══════════════════════════════════════════════════════════════
   COLLAPSIBLE SECTION
   ═══════════════════════════════════════════════════════════════ */

function CollapsibleSection({
  title,
  defaultOpen = false,
  accent = "blood",
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  accent?: "blood" | "green" | "amber";
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const accentColor =
    accent === "green"
      ? "var(--color-terminal-green)"
      : accent === "amber"
        ? "var(--color-warning-amber)"
        : "var(--color-blood)";

  return (
    <TerminalCard accent={accent}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-xs uppercase tracking-widest"
        style={{ color: accentColor }}
      >
        <span>
          {open ? "▼" : "▶"} {title}
        </span>
        <span className="text-content-dim normal-case text-[10px]">
          {open ? "collapse" : "expand"}
        </span>
      </button>
      {open && <div className="mt-3">{children}</div>}
    </TerminalCard>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STRUCTURAL BLOCKERS PANEL
   ═══════════════════════════════════════════════════════════════ */

function StructuralBlockers({ country }: { country: CountryData }) {
  const blockers = useMemo(() => {
    const result: { name: string; active: boolean; detail: string }[] = [];

    // Armed conflict
    result.push({
      name: "Armed Conflict",
      active:
        country.conflict.intensity_1to5 >= 3 ||
        country.is_hotspot ||
        country.conflict.access_blocked_1to5 >= 3,
      detail: `Conflict intensity: ${country.conflict.intensity_1to5}/5 — ${
        country.conflict.intensity_1to5 >= 3
          ? "ACTIVE CONFLICT ZONE — direct investment blocked"
          : "Not currently a primary blocker"
      }`,
    });

    // Climate change
    const climateRisk =
      (country.environment?.renewable_energy_pct !== undefined &&
        (country.environment.renewable_energy_pct ?? 100) < 20) ||
      country.hunger.famine_risk_1to5 !== null && (country.hunger.famine_risk_1to5 ?? 0) >= 3;
    result.push({
      name: "Climate Change",
      active: Boolean(climateRisk),
      detail: `Air pollution: ${formatVal(country.environment.air_pollution_pm25_ugm3, " µg/m³")}`,
    });

    // Corruption & governance
    const cpi = country.governance.corruption_perceptions_index;
    result.push({
      name: "Corruption & Governance",
      active: cpi !== null && cpi < 35,
      detail: `CPI: ${formatVal(cpi)} / 100 — ${
        cpi !== null && cpi < 35
          ? "HIGH CORRUPTION — resources at risk of diversion"
          : "Governance functional"
      }`,
    });

    // Last-mile access
    result.push({
      name: "Restricted Access (Last Mile)",
      active: country.conflict.access_blocked_1to5 >= 3,
      detail: `Access blocked: ${country.conflict.access_blocked_1to5}/5 — ${
        country.conflict.access_blocked_1to5 >= 3
          ? "HUMANITARIAN ACCESS SEVERELY RESTRICTED"
          : "Access feasible"
      }`,
    });

    return result;
  }, [country]);

  return (
    <TerminalCard title="STRUCTURAL BLOCKERS" accent="amber">
      <div className="space-y-2">
        {blockers.map((b) => (
          <div
            key={b.name}
            className={`p-2 border ${b.active ? "border-blood bg-blood/5" : "border-border-dim opacity-50"}`}
          >
            <div className="flex items-center gap-2">
              <StatusPill color={b.active ? "blood" : "dim"}>
                {b.active ? "ACTIVE" : "CLEAR"}
              </StatusPill>
              <span className="text-xs text-content-primary">{b.name}</span>
            </div>
            <div className="text-[10px] text-content-dim mt-1 ml-1">{b.detail}</div>
          </div>
        ))}
      </div>
    </TerminalCard>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CROSS-LINKS
   ═══════════════════════════════════════════════════════════════ */

function CrossLinks({ country }: { country: CountryData }) {
  const iso3 = country.iso3;
  const links = [
    countryToEquation(iso3),
    countryToProtocol(iso3, {
      isHotspot: country.is_hotspot,
      conflictIntensity: country.conflict.intensity_1to5,
      famineRisk: country.hunger.famine_risk_1to5 ?? 0,
      connectivity: country.connectivity.internet_users_pct ?? 0,
    }),
    countryToRegistry(iso3),
    countryToTrilha(iso3),
  ];

  return (
    <TerminalCard title="CROSS-BRANCH LINKS" accent="green">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="block p-2 border border-border-dim hover:border-terminal-green hover:bg-terminal-green/5 transition-all"
          >
            <div className="text-xs text-terminal-green glow-green uppercase tracking-wider">
              {">"} {link.label}
            </div>
            <div className="text-[10px] text-content-dim mt-0.5">
              {link.description}
            </div>
          </Link>
        ))}
      </div>
    </TerminalCard>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PROOF OF MISERY FORM (client-side SHA-256 + localStorage)
   ═══════════════════════════════════════════════════════════════ */

interface MiserySubmission {
  iso3: string;
  text: string;
  fileHash: string | null;
  timestamp: number;
  status: "UNVERIFIED";
}

function ProofOfMiseryForm({ iso3 }: { iso3: string }) {
  const [text, setText] = useState("");
  const [fileHash, setFileHash] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [pastSubmissions, setPastSubmissions] = useState<MiserySubmission[]>([]);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load past submissions on mount
  useState(() => {
    try {
      const stored = localStorage.getItem(`vfx-misery-${iso3}`);
      if (stored) {
        setPastSubmissions(JSON.parse(stored));
      }
    } catch {
      /* ignore */
    }
  });

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      setFileHash(hashHex);
    } catch {
      setFileHash("[HASH FAILED — crypto.subtle requires HTTPS]");
    }
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!text.trim() && !fileHash) return;

      const submission: MiserySubmission = {
        iso3,
        text: text.trim(),
        fileHash,
        timestamp: Date.now(),
        status: "UNVERIFIED",
      };

      try {
        const key = `vfx-misery-${iso3}`;
        const existing = localStorage.getItem(key);
        const arr: MiserySubmission[] = existing ? JSON.parse(existing) : [];
        arr.push(submission);
        localStorage.setItem(key, JSON.stringify(arr));
        setPastSubmissions(arr);
        setSubmitted(true);
        setText("");
        setFileHash(null);
        setFileName(null);
        if (fileInputRef.current) fileInputRef.current.value = "";

        // Reset the "submitted" flash after 3s
        setTimeout(() => setSubmitted(false), 3000);
      } catch {
        /* localStorage may fail in private mode */
      }
    },
    [text, fileHash, iso3]
  );

  const copyHash = useCallback(() => {
    if (fileHash) {
      navigator.clipboard?.writeText(fileHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [fileHash]);

  return (
    <TerminalCard title="PROOF OF MISERY // SUBMISSION" accent="blood" glow>
      <div className="mb-3 p-2 border border-blood-dim bg-blood/5">
        <div className="flex items-center gap-2 mb-1">
          <StatusPill color="blood">UNVERIFIED</StatusPill>
          <span className="text-[10px] text-content-dim">
            Evidence stored locally. Requires on-chain attestation to become permanent.
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="text-xs text-content-secondary uppercase tracking-widest block mb-1">
            Testimony / Evidence Description
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="Describe the situation on the ground..."
            className="w-full bg-void border border-border-dim text-content-primary text-xs p-2 focus:border-blood focus:outline-none font-mono resize-y"
          />
        </div>

        <div>
          <label className="text-xs text-content-secondary uppercase tracking-widest block mb-1">
            Attach Evidence File (hash computed locally — file never uploaded)
          </label>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFile}
            className="w-full text-xs text-content-dim file:bg-blood file:text-void file:border-0 file:px-2 file:py-1 file:mr-2 file:cursor-pointer file:font-mono border border-border-dim"
          />
          {fileName && (
            <div className="mt-2 p-2 border border-border-dim bg-abyss">
              <div className="text-[10px] text-content-dim uppercase">SHA-256 HASH</div>
              {fileHash ? (
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-[10px] text-terminal-green break-all flex-1">
                    {fileHash}
                  </code>
                  <button
                    type="button"
                    onClick={copyHash}
                    className="text-[10px] px-1.5 py-0.5 border border-border-dim hover:border-terminal-green text-content-secondary hover:text-terminal-green shrink-0"
                  >
                    {copied ? "✓ COPIED" : "COPY"}
                  </button>
                </div>
              ) : (
                <div className="text-[10px] text-blood-bright mt-1 cursor-blink">
                  &gt; COMPUTING...
                </div>
              )}
              <div className="text-[9px] text-content-dim mt-1">{fileName}</div>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={!text.trim() && !fileHash}
          className="w-full py-2 text-xs uppercase tracking-widest border border-blood text-blood-bright hover:bg-blood hover:text-void transition-all disabled:opacity-30 disabled:cursor-not-allowed font-bold"
        >
          {submitted ? "✓ SUBMITTED (UNVERIFIED)" : "> SUBMIT EVIDENCE"}
        </button>
      </form>

      {pastSubmissions.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border-dim">
          <div className="text-[10px] text-content-dim uppercase tracking-widest mb-2">
            LOCAL SUBMISSIONS ({pastSubmissions.length})
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {pastSubmissions.slice().reverse().map((s, i) => (
              <div key={i} className="text-[10px] p-1.5 border border-border-dim bg-abyss">
                <div className="flex justify-between">
                  <span className="text-blood-bright">{s.status}</span>
                  <span className="text-content-dim">
                    {new Date(s.timestamp).toISOString().slice(0, 16).replace("T", " ")}
                  </span>
                </div>
                {s.text && (
                  <div className="text-content-secondary mt-0.5 truncate">
                    {s.text}
                  </div>
                )}
                {s.fileHash && (
                  <code className="text-terminal-green text-[9px]">
                    {s.fileHash.slice(0, 32)}...
                  </code>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </TerminalCard>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SECTION RENDERERS — one per data category
   ═══════════════════════════════════════════════════════════════ */

function HungerSection({ c }: { c: CountryData }) {
  const h = c.hunger;
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        {h.undernourishment_pct !== null && (
          <DataBar value={h.undernourishment_pct} max={60} label="Undernourishment" unit="%" />
        )}
        {h.child_stunting_pct !== null && (
          <DataBar value={h.child_stunting_pct} max={50} label="Child Stunting" unit="%" />
        )}
        {h.child_wasting_pct !== null && (
          <DataBar value={h.child_wasting_pct} max={25} label="Child Wasting" unit="%" />
        )}
        {h.food_insecurity_mod_severe_pct !== null && (
          <DataBar value={h.food_insecurity_mod_severe_pct} max={90} label="Mod/Severe FI" unit="%" />
        )}
      </div>
      <DataRow label="Acute FI Population" value={formatVal(h.pop_acute_fi_m, "M", formatNumber)} />
      <DataRow label="Prevalence (Acute)" value={formatVal(h.prevalence_pct, "%")} />
      <DataRow label="Children SAM" value={formatVal(h.children_sam_m, "M", formatNumber)} />
      <DataRow
        label="IPC Phase 5 (Famine)"
        value={h.ipc_phase5 ? "CONFIRMED" : "No"}
      />
      <DataRow label="Famine Risk" value={formatVal(h.famine_risk_1to5, "/5")} />
      <DataRow label="WFP Classification" value={h.wfp_class ? wfpClassLabel(h.wfp_class) : "—"} />
      <DataRow label="Child Overweight" value={formatVal(h.child_overweight_pct, "%")} />
      <DataRow label="Anemia Prevalence" value={formatVal(h.anemia_prevalence_pct, "%")} />
      <DataRow label="Undernourishment" value={formatVal(h.undernourishment_pct, "%")} />
      <DataRow label="Child Stunting" value={formatVal(h.child_stunting_pct, "%")} />
      <DataRow label="Child Wasting" value={formatVal(h.child_wasting_pct, "%")} />
    </>
  );
}

function ConflictSection({ c }: { c: CountryData }) {
  const cf = c.conflict;
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <DataBar value={cf.intensity_1to5} max={5} label="Conflict Intensity" unit="/5" />
        <DataBar value={cf.access_blocked_1to5} max={5} label="Access Blocked" unit="/5" />
      </div>
      <DataRow label="Intensity" value={`${cf.intensity_1to5}/5`} />
      <DataRow label="Displacement" value={formatVal(cf.displacement_m, "M")} />
      <DataRow label="Access Blocked" value={`${cf.access_blocked_1to5}/5`} />
      <DataRow label="Battle Deaths (Total)" value={formatNumber(cf.battle_deaths_total)} />
      <DataRow label="Deaths (Year -4)" value={formatNumber(cf.deaths_1)} />
      <DataRow label="Deaths (Year -3)" value={formatNumber(cf.deaths_2)} />
      <DataRow label="Deaths (Year -2)" value={formatNumber(cf.deaths_3)} />
      <DataRow label="Deaths (Year -1)" value={formatNumber(cf.deaths_4)} />
      <DataRow label="Deaths (Current)" value={formatNumber(cf.deaths_5)} />
    </>
  );
}

function GenericSection({
  title,
  entries,
  bars,
}: {
  title: string;
  entries: { label: string; value: string | number | null | undefined; unit?: string }[];
  bars?: { value: number; max: number; label: string; unit?: string; inverse?: boolean }[];
}) {
  return (
    <>
      {bars && bars.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          {bars.map((b, i) => (
            <DataBar key={i} {...b} />
          ))}
        </div>
      )}
      {entries.map((e, i) => (
        <DataRow key={i} label={e.label} value={e.value} unit={e.unit} />
      ))}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════ */

interface PageProps {
  params: Promise<{ iso3: string }>;
}

export default function CountryDetail({ params }: PageProps) {
  const { iso3: rawIso3 } = use(params);
  const code = rawIso3.toUpperCase();
  const router = useRouter();
  const { setCurrentCountry } = useStore();

  const country = useMemo(
    () => data.countries.find((c) => c.iso3 === code) ?? null,
    [code]
  );

  const hotspotIso3s = useMemo(
    () => new Set(data.hotspots.all.map((h) => h.iso3)),
    []
  );

  // Set store context
  useState(() => {
    if (country) setCurrentCountry(country.iso3);
  });

  if (!country) {
    return (
      <div className="p-3 sm:p-6 max-w-3xl mx-auto">
        <GlitchText
          text="COUNTRY NOT FOUND"
          as="h1"
          className="text-2xl font-bold text-blood-bright glow-blood tracking-widest"
        />
        <div className="mt-4 text-content-secondary text-sm">
          {">"} No data for ISO3 code:{" "}
          <code className="text-blood-bright">{code}</code>
        </div>
        <button
          onClick={() => router.push("/sorrow-map/")}
          className="mt-6 text-xs px-3 py-2 border border-blood text-blood-bright hover:bg-blood hover:text-void transition-all uppercase tracking-widest"
        >
          {">"} RETURN TO MAP
        </button>
      </div>
    );
  }

  const c = country;
  const wfpColor = c.hunger.wfp_class ? wfpClassColor(c.hunger.wfp_class) : "#333";

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 border-b border-border-dim pb-4">
        <Link
          href="/sorrow-map/"
          className="text-[10px] text-content-dim hover:text-blood-bright uppercase tracking-widest"
        >
          {">"} MAPA DA DOR
        </Link>
        <div className="flex items-baseline gap-3 mt-2 flex-wrap">
          <GlitchText
            text={c.name_en.toUpperCase()}
            as="h1"
            className="text-xl sm:text-2xl md:text-3xl font-bold text-blood-bright glow-blood tracking-widest"
          />
          <span className="text-lg text-content-dim">({c.iso3})</span>
          {c.is_hotspot && (
            <StatusPill color="blood">
              ◆ HOTSPOT — SCORE {c.hotspot_score}
            </StatusPill>
          )}
        </div>
        <div className="text-sm text-content-secondary mt-1">
          {c.name_pt} · {c.region} / {c.subregion}
        </div>
        {/* Action bar */}
        <div className="flex flex-wrap items-center gap-2 mt-3 no-print">
          <button
            onClick={() => { window.print(); sound.select(); }}
            className="text-[10px] px-2 py-1 border border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-void transition-colors uppercase tracking-widest"
          >
            🖨 PRINT / PDF BRIEF
          </button>
          <Link
            href={`/the-act/?country=${c.iso3}`}
            className="text-[10px] px-2 py-1 border border-blood text-blood-bright hover:bg-blood hover:text-void transition-colors uppercase tracking-widest"
          >
            → CAMPAIGN KIT
          </Link>
          {/* Data freshness */}
          {(() => {
            const f = computeDataFreshness(c);
            return f.newestYear !== null && (
              <FreshnessBadge year={f.newestYear} label={`Data through`} />
            );
          })()}
        </div>
        {c.hunger.wfp_class && (
          <div className="mt-2">
            <span
              className="inline-block px-2 py-0.5 text-xs uppercase tracking-wider border"
              style={{
                backgroundColor: "#1a0000",
                borderColor: wfpColor,
                color: wfpColor,
              }}
            >
              WFP: {wfpClassLabel(c.hunger.wfp_class)}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        {/* LEFT — main data */}
        <div className="space-y-4">
          {/* Overview */}
          <CollapsibleSection title="OVERVIEW" defaultOpen accent="blood">
            <DataRow label="Name (EN)" value={c.name_en} />
            <DataRow label="Name (PT)" value={c.name_pt} />
            <DataRow label="ISO3" value={c.iso3} />
            <DataRow label="ISO2" value={c.iso2} />
            <DataRow label="UN M49" value={c.un_m49} />
            <DataRow label="Region" value={c.region} />
            <DataRow label="Subregion" value={c.subregion} />
            <DataRow label="UN Member" value={c.is_un_member ? "Yes" : "No"} />
            <DataRow label="Population" value={`${formatNumber(c.demographics.population)} (${c.demographics.population_year})`} />
            <DataRow label="Is Hotspot" value={c.is_hotspot ? "YES" : "No"} />
            <DataRow label="Hotspot Score" value={formatVal(c.hotspot_score)} />
          </CollapsibleSection>

          {/* Hunger */}
          <CollapsibleSection title="HUNGER & FOOD SECURITY" defaultOpen accent="blood">
            <HungerSection c={c} />
          </CollapsibleSection>

          {/* Conflict */}
          <CollapsibleSection title="CONFLICT & DISPLACEMENT" accent="blood">
            <ConflictSection c={c} />
          </CollapsibleSection>

          {/* Economy */}
          <CollapsibleSection title="ECONOMY" accent="amber">
            <GenericSection
              title="Economy"
              entries={[
                { label: "GDP", value: formatMoney(c.economy.gdp_usd) },
                { label: "GDP Per Capita", value: formatMoney(c.economy.gdp_per_capita_usd) },
                { label: "GDP Year", value: c.economy.gdp_year },
              ]}
              bars={c.economy.gdp_per_capita_usd !== null ? [
                { value: c.economy.gdp_per_capita_usd, max: 50000, label: "GDP Per Capita", unit: "$", inverse: true },
              ] : undefined}
            />
          </CollapsibleSection>

          {/* Health */}
          <CollapsibleSection title="HEALTH" accent="blood">
            <GenericSection
              title="Health"
              entries={[
                { label: "Life Expectancy", value: formatVal(c.health.life_expectancy, " yrs") },
                { label: "Life Expectancy Year", value: c.health.life_expectancy_year },
                { label: "Child Mortality (U5)", value: formatVal(c.health.child_mortality_under5_per1k, " /1k") },
                { label: "Infant Mortality", value: formatVal(c.health.infant_mortality_per1k, " /1k") },
                { label: "Maternal Mortality", value: formatVal(c.health.maternal_mortality_per100k, " /100k") },
                { label: "Health Expenditure % GDP", value: formatVal(c.health.expenditure_pct_gdp, "%") },
                { label: "Health Expenditure/Capita", value: formatMoney(c.health.expenditure_per_capita_usd) },
                { label: "Tuberculosis", value: formatVal(c.health.tuberculosis_per100k, " /100k") },
                { label: "HIV Prevalence", value: formatVal(c.health.hiv_prevalence_pct, "%") },
              ]}
              bars={[
                ...(c.health.life_expectancy !== null ? [{ value: c.health.life_expectancy, max: 85, label: "Life Expectancy", unit: " yrs", inverse: true }] : []),
                ...(c.health.child_mortality_under5_per1k !== null ? [{ value: c.health.child_mortality_under5_per1k, max: 150, label: "Child Mortality (U5)", unit: "/1k" }] : []),
              ]}
            />
          </CollapsibleSection>

          {/* HDI */}
          <CollapsibleSection title="HUMAN DEVELOPMENT (HDI)" accent="amber">
            <GenericSection
              title="HDI"
              entries={[
                { label: "HDI", value: formatVal(c.human_development.hdi) },
                { label: "HDI Category", value: c.human_development.hdi_category },
                { label: "HDI Year", value: c.human_development.hdi_year },
              ]}
              bars={c.human_development.hdi !== null ? [
                { value: c.human_development.hdi, max: 1, label: "HDI Score", inverse: true },
              ] : undefined}
            />
          </CollapsibleSection>

          {/* Military */}
          <CollapsibleSection title="MILITARY" accent="amber">
            <GenericSection
              title="Military"
              entries={[
                { label: "Expenditure", value: formatMoney(c.military.expenditure_usd) },
                { label: "% GDP", value: formatVal(c.military.pct_gdp, "%") },
                { label: "Year", value: c.military.year },
              ]}
            />
          </CollapsibleSection>

          {/* Climate */}
          <CollapsibleSection title="CLIMATE & EMISSIONS" accent="green">
            <GenericSection
              title="Climate"
              entries={[
                { label: "CO₂ Emissions", value: formatVal(c.climate.co2_mt, " Mt") },
                { label: "CO₂ Per Capita", value: formatVal(c.climate.co2_per_capita_t, " t") },
                { label: "GHG Total", value: formatVal(c.climate.ghg_total_mt, " Mt") },
                { label: "Year", value: c.climate.year },
              ]}
            />
          </CollapsibleSection>

          {/* Inequality */}
          <CollapsibleSection title="INEQUALITY" accent="amber">
            <GenericSection
              title="Inequality"
              entries={[
                { label: "Gini", value: formatVal(c.inequality.gini) },
                { label: "Year", value: c.inequality.gini_year ?? c.inequality.year },
              ]}
              bars={c.inequality.gini !== null ? [
                { value: c.inequality.gini, max: 65, label: "Gini Coefficient" },
              ] : undefined}
            />
          </CollapsibleSection>

          {/* Water & Sanitation */}
          <CollapsibleSection title="WATER & SANITATION" accent="green">
            <GenericSection
              title="Water"
              entries={[
                { label: "Basic Water Access", value: formatVal(c.water_sanitation.basic_access_pct, "%") },
                { label: "Basic Sanitation", value: formatVal(c.water_sanitation.basic_sanitation_pct, "%") },
                { label: "Safe Sanitation", value: formatVal(c.water_sanitation.safe_sanitation_pct, "%") },
                { label: "Year", value: c.water_sanitation.year },
              ]}
              bars={[
                ...(c.water_sanitation.basic_access_pct !== null ? [{ value: c.water_sanitation.basic_access_pct, max: 100, label: "Water Access", unit: "%", inverse: true }] : []),
                ...(c.water_sanitation.safe_sanitation_pct !== null ? [{ value: c.water_sanitation.safe_sanitation_pct, max: 100, label: "Safe Sanitation", unit: "%", inverse: true }] : []),
              ]}
            />
          </CollapsibleSection>

          {/* Education */}
          <CollapsibleSection title="EDUCATION" accent="green">
            <GenericSection
              title="Education"
              entries={[
                { label: "Literacy Rate", value: formatVal(c.education.literacy_rate_pct, "%") },
                { label: "Primary Enrollment", value: formatVal(c.education.primary_enrollment_pct, "%") },
                { label: "Secondary Enrollment", value: formatVal(c.education.secondary_enrollment_pct, "%") },
                { label: "Primary Completion", value: formatVal(c.education.primary_completion_pct, "%") },
                { label: "Year", value: c.education.year },
              ]}
              bars={c.education.literacy_rate_pct !== null ? [
                { value: c.education.literacy_rate_pct, max: 100, label: "Literacy", unit: "%", inverse: true },
              ] : undefined}
            />
          </CollapsibleSection>

          {/* Connectivity */}
          <CollapsibleSection title="CONNECTIVITY" accent="green">
            <GenericSection
              title="Connectivity"
              entries={[
                { label: "Internet Users", value: formatVal(c.connectivity.internet_users_pct, "%") },
                { label: "Broadband /100", value: formatVal(c.connectivity.broadband_per100) },
                { label: "Year", value: c.connectivity.year },
              ]}
              bars={c.connectivity.internet_users_pct !== null ? [
                { value: c.connectivity.internet_users_pct, max: 100, label: "Internet Access", unit: "%", inverse: true },
              ] : undefined}
            />
          </CollapsibleSection>

          {/* Migration */}
          <CollapsibleSection title="MIGRATION & DISPLACEMENT" accent="amber">
            <GenericSection
              title="Migration"
              entries={[
                { label: "Refugees (Origin)", value: formatNumber(c.migration.refugees_origin) },
                { label: "Refugees (Hosted)", value: formatNumber(c.migration.refugees_hosted) },
                { label: "Asylum Seekers (Origin)", value: formatNumber(c.migration.asylum_seekers_origin) },
                { label: "Asylum Seekers (Hosted)", value: formatNumber(c.migration.asylum_seekers_hosted) },
                { label: "Forcibly Displaced", value: formatNumber(c.migration.forcibly_displaced) },
                { label: "IDPs (Disaster, New)", value: formatNumber(c.migration.idps_disaster_new) },
                { label: "Net Migration", value: formatNumber(c.migration.net_migration) },
                { label: "Year", value: c.migration.year },
              ]}
            />
          </CollapsibleSection>

          {/* Environment */}
          <CollapsibleSection title="ENVIRONMENT" accent="green">
            <GenericSection
              title="Environment"
              entries={[
                { label: "Forest Area", value: formatVal(c.environment.forest_area_pct, "%") },
                { label: "Forest Area (km²)", value: formatNumber(c.environment.forest_area_km2) },
                { label: "Renewable Energy", value: formatVal(c.environment.renewable_energy_pct, "%") },
                { label: "Air Pollution (PM2.5)", value: formatVal(c.environment.air_pollution_pm25_ugm3, " µg/m³") },
                { label: "Year", value: c.environment.year },
              ]}
            />
          </CollapsibleSection>

          {/* Gender */}
          <CollapsibleSection title="GENDER" accent="amber">
            <GenericSection
              title="Gender"
              entries={[
                { label: "Female Labor Force", value: formatVal(c.gender.female_labor_force_pct, "%") },
                { label: "Women in Parliament", value: formatVal(c.gender.women_parliament_pct, "%") },
                { label: "Year", value: c.gender.year },
              ]}
              bars={c.gender.women_parliament_pct !== null ? [
                { value: c.gender.women_parliament_pct, max: 60, label: "Women in Parliament", unit: "%", inverse: true },
              ] : undefined}
            />
          </CollapsibleSection>

          {/* Governance */}
          <CollapsibleSection title="GOVERNANCE" accent="blood">
            <GenericSection
              title="Governance"
              entries={[
                { label: "Electoral Democracy Index", value: formatVal(c.governance.electoral_democracy_index) },
                { label: "Democracy Year", value: c.governance.democracy_year },
                { label: "Corruption Perceptions (CPI)", value: formatVal(c.governance.corruption_perceptions_index) },
                { label: "CPI Year", value: c.governance.cpi_year },
                { label: "Political Corruption Index", value: formatVal(c.governance.political_corruption_index) },
                { label: "Political Corruption Year", value: c.governance.political_corruption_year },
              ]}
              bars={[
                ...(c.governance.electoral_democracy_index !== null ? [{ value: c.governance.electoral_democracy_index, max: 1, label: "Democracy Index", inverse: true }] : []),
                ...(c.governance.corruption_perceptions_index !== null ? [{ value: c.governance.corruption_perceptions_index, max: 100, label: "CPI (higher = cleaner)", inverse: true }] : []),
              ]}
            />
          </CollapsibleSection>

          {/* Security */}
          <CollapsibleSection title="SECURITY" accent="blood">
            <GenericSection
              title="Security"
              entries={[
                { label: "Homicide Rate", value: formatVal(c.security.homicide_rate_per100k, " /100k") },
                { label: "Homicide (Male)", value: formatVal(c.security.homicide_male_per100k, " /100k") },
                { label: "Homicide (Female)", value: formatVal(c.security.homicide_female_per100k, " /100k") },
              ]}
              bars={c.security.homicide_rate_per100k !== null ? [
                { value: c.security.homicide_rate_per100k, max: 60, label: "Homicide Rate", unit: "/100k" },
              ] : undefined}
            />
          </CollapsibleSection>

          {/* Poverty */}
          <CollapsibleSection title="POVERTY" accent="blood">
            <GenericSection
              title="Poverty"
              entries={[
                { label: "Headcount ($3.65/day)", value: formatVal(c.poverty.headcount_365_pct, "%") },
                { label: "Headcount ($6.85/day)", value: formatVal(c.poverty.headcount_685_pct, "%") },
              ]}
              bars={[
                ...(c.poverty.headcount_365_pct !== null ? [{ value: c.poverty.headcount_365_pct, max: 80, label: "Extreme Poverty ($3.65)", unit: "%" }] : []),
              ]}
            />
          </CollapsibleSection>

          {/* Employment */}
          <CollapsibleSection title="EMPLOYMENT" accent="amber">
            <GenericSection
              title="Employment"
              entries={[
                { label: "Unemployment", value: formatVal(c.employment.unemployment_pct, "%") },
                { label: "Youth Unemployment", value: formatVal(c.employment.youth_unemployment_pct, "%") },
              ]}
              bars={[
                ...(c.employment.unemployment_pct !== null ? [{ value: c.employment.unemployment_pct, max: 35, label: "Unemployment", unit: "%" }] : []),
              ]}
            />
          </CollapsibleSection>

          {/* ═══ DIMENSION DEEP-DIVE MODULES ═══ */}
          {/* Derived analytics that cross-reference multiple dimensions */}

          <SdgScorecardDeepDive country={c} />

          <MigrationDeepDive country={c} hotspotIso3s={hotspotIso3s} />
          <GovernanceDeepDive country={c} />
          <ClimateHungerDeepDive country={c} />
          <MilitaryHealthDeepDive country={c} />
          <GenderDeepDive country={c} />

          {/* ═══ ENRICHED DIMENSIONS (OpenRepublic integration) ═══ */}
          {/* These only show when data is present for this country */}

          {c.energy && (c.energy.renewable_electric_pct !== null || c.energy.renewable_matrix_pct !== null) && (
            <CollapsibleSection title="ENERGY MATRIX" accent="green">
              <GenericSection
                title="Energy"
                entries={[
                  { label: "Renewable Matrix", value: formatVal(c.energy.renewable_matrix_pct, "%") },
                  { label: "Renewable Electric", value: formatVal(c.energy.renewable_electric_pct, "%") },
                  { label: "Hydroelectric", value: formatVal(c.energy.hydroelectric_pct, "%") },
                  { label: "Wind", value: formatVal(c.energy.wind_pct, "%") },
                  { label: "Solar", value: formatVal(c.energy.solar_pct, "%") },
                  { label: "Fossil Electric", value: formatVal(c.energy.fossil_electric_pct, "%") },
                  { label: "Nuclear", value: formatVal(c.energy.nuclear_pct, "%") },
                  { label: "No Access (M)", value: formatVal(c.energy.no_access_electricity_m) },
                ]}
                bars={c.energy.renewable_electric_pct !== null ? [
                  { value: c.energy.renewable_electric_pct, max: 100, label: "Renewable Electricity", unit: "%", inverse: true },
                ] : undefined}
              />
            </CollapsibleSection>
          )}

          {c.justice && c.justice.prison_population !== null && (
            <CollapsibleSection title="JUSTICE & INCARCERATION" accent="amber">
              <GenericSection
                title="Justice"
                entries={[
                  { label: "Prison Population", value: formatNumber(c.justice.prison_population) },
                  { label: "Prison Rate /100k", value: formatVal(c.justice.prison_rate_per_100k) },
                  { label: "Pre-Trial %", value: formatVal(c.justice.pre_trial_pct, "%") },
                  { label: "Overcrowding %", value: formatVal(c.justice.prison_overcrowding_pct, "%") },
                  { label: "Cases Backlog", value: formatNumber(c.justice.judicial_efficiency_cases_backlog) },
                ]}
                bars={c.justice.prison_rate_per_100k !== null ? [
                  { value: c.justice.prison_rate_per_100k, max: 700, label: "Incarceration Rate", unit: "/100k" },
                ] : undefined}
              />
            </CollapsibleSection>
          )}

          {c.taxation && c.taxation.tax_burden_pct_gdp !== null && (
            <CollapsibleSection title="TAXATION" accent="amber">
              <GenericSection
                title="Taxation"
                entries={[
                  { label: "Tax Burden % GDP", value: formatVal(c.taxation.tax_burden_pct_gdp, "%") },
                  { label: "Consumption Tax %", value: formatVal(c.taxation.consumption_tax_pct, "%") },
                  { label: "Income Tax %", value: formatVal(c.taxation.income_tax_pct, "%") },
                  { label: "Property Tax %", value: formatVal(c.taxation.property_tax_pct, "%") },
                ]}
                bars={c.taxation.tax_burden_pct_gdp !== null ? [
                  { value: c.taxation.tax_burden_pct_gdp, max: 50, label: "Tax Burden", unit: "% GDP" },
                ] : undefined}
              />
            </CollapsibleSection>
          )}

          {c.food_security && c.food_security.severe_food_insecurity_m !== null && (
            <CollapsibleSection title="FOOD SECURITY (DEEP)" accent="blood">
              <GenericSection
                title="Food Security"
                entries={[
                  { label: "Severe FI (M)", value: formatVal(c.food_security.severe_food_insecurity_m, "M") },
                  { label: "Total FI (M)", value: formatVal(c.food_security.total_food_insecurity_m, "M") },
                  { label: "Min Wage Affordability", value: formatVal(c.food_security.food_cost_affordability_ratio, "×") },
                ]}
              />
            </CollapsibleSection>
          )}

          {/* Cross-Links */}
          <CrossLinks country={c} />
        </div>

        {/* RIGHT — sidebar */}
        <div className="space-y-4">
          {/* Key indicators summary */}
          <TerminalCard title="KEY INDICATORS" accent="blood" glow>
            <div className="space-y-2">
              {c.hunger.undernourishment_pct !== null && (
                <div className="flex justify-between text-xs">
                  <span className="text-content-secondary">Undernourishment</span>
                  <span className="text-blood-bright font-bold">
                    {formatPct(c.hunger.undernourishment_pct)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-xs">
                <span className="text-content-secondary">Conflict</span>
                <span className="text-blood-bright font-bold">
                  {c.conflict.intensity_1to5}/5
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-content-secondary">Life Expectancy</span>
                <span className="text-content-primary">
                  {formatVal(c.health.life_expectancy, " yrs")}
                </span>
              </div>
              {c.human_development.hdi !== null && (
                <div className="flex justify-between text-xs">
                  <span className="text-content-secondary">HDI</span>
                  <span className="text-content-primary">
                    {c.human_development.hdi.toFixed(3)}
                  </span>
                </div>
              )}
              {c.poverty.headcount_365_pct !== null && (
                <div className="flex justify-between text-xs">
                  <span className="text-content-secondary">Poverty ($3.65)</span>
                  <span className="text-blood-bright font-bold">
                    {formatPct(c.poverty.headcount_365_pct)}
                  </span>
                </div>
              )}
              {c.governance.corruption_perceptions_index !== null && (
                <div className="flex justify-between text-xs">
                  <span className="text-content-secondary">CPI</span>
                  <span className="text-content-primary">
                    {c.governance.corruption_perceptions_index}/100
                  </span>
                </div>
              )}
            </div>
          </TerminalCard>

          {/* Structural blockers */}
          <StructuralBlockers country={c} />

          {/* Proof of Misery */}
          <ProofOfMiseryForm iso3={c.iso3} />
        </div>
      </div>
    </div>
  );
}
