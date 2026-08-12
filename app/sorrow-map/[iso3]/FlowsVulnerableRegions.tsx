"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import {
  loadRelationshipsData,
  getArmsReceived,
  getArmsSupplied,
  getSanctionsReceived,
  getAidReceived,
  formatMusd,
  type RelationshipsData,
} from "@/lib/relationships";
import {
  loadSubnationalData,
  getMostVulnerableInCountry,
  formatVulnerabilityScore,
  getVulnerabilityLevel,
  getVulnerabilityColor,
  type SubnationalData,
  type VulnerableRegion,
} from "@/lib/subnational";

interface Props {
  iso3: string;
}

/**
 * V FOR X — Flows & Vulnerable Regions section for /sorrow-map/[iso3].
 *
 * Surfaces, on the country dossier itself, the arms/sanctions/aid corridors
 * that touch the country (Phase 14: reuses lib/relationships.ts) and the
 * most vulnerable admin-1 regions inside it (Phase 14: reuses
 * lib/subnational.ts). Both datasets already had APIs and a `/the-flows`
 * + `/the-subnational` page; this just brings them onto the dossier.
 */
export default function FlowsVulnerableRegions({ iso3 }: Props) {
  const upper = iso3.toUpperCase();
  const [rel, setRel] = useState<RelationshipsData | null>(null);
  const [sub, setSub] = useState<SubnationalData | null>(null);
  const [regions, setRegions] = useState<VulnerableRegion[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    Promise.all([loadRelationshipsData(), loadSubnationalData()])
      .then(([r, s]) => {
        if (cancelled) return;
        setRel(r);
        setSub(s);
        setRegions(getMostVulnerableInCountry(s, upper, 5));
      })
      .catch(() => {
        if (cancelled) return;
        setErr("// FLOW + SUBNATIONAL DATA UNAVAILABLE OFFLINE");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [upper]);

  if (loading) {
    return (
      <TerminalCard title="FLOWS & VULNERABLE REGIONS" accent="amber" className="mb-6">
        <p className="text-[11px] text-content-dim">// LOADING CORRIDORS + ADMIN-1 VULNERABILITY…</p>
      </TerminalCard>
    );
  }

  if (err || !rel) {
    return (
      <TerminalCard title="FLOWS & VULNERABLE REGIONS" accent="amber" className="mb-6">
        <p className="text-[11px] text-content-dim">{err ?? "// NO DATA"}</p>
      </TerminalCard>
    );
  }

  const armsIn = getArmsReceived(rel, upper);
  const armsOut = getArmsSupplied(rel, upper);
  const sanctions = getSanctionsReceived(rel, upper);
  const aid = getAidReceived(rel, upper);

  const totalArmsIn = armsIn.reduce((acc, t) => acc + (t.value_musd ?? 0), 0);
  const totalArmsOut = armsOut.reduce((acc, t) => acc + (t.value_musd ?? 0), 0);
  const totalAid = aid.reduce((acc, a) => acc + (a.amount_musd ?? 0), 0);

  const hasAnyFlow =
    armsIn.length > 0 || armsOut.length > 0 || sanctions.length > 0 || aid.length > 0;
  const hasRegions = regions.length > 0;

  if (!hasAnyFlow && !hasRegions) {
    // No data — don't render an empty card. Keeps the dossier clean.
    return null;
  }

  return (
    <TerminalCard title="FLOWS & VULNERABLE REGIONS" accent="amber" className="mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div className="text-[10px] uppercase text-content-dim">Arms · Sanctions · Aid</div>
          {hasAnyFlow ? (
            <>
              {totalArmsIn > 0 && (
                <Row
                  label="ARMS RECEIVED"
                  value={formatMusd(totalArmsIn)}
                  accent="blood"
                  count={armsIn.length}
                />
              )}
              {totalArmsOut > 0 && (
                <Row
                  label="ARMS SUPPLIED"
                  value={formatMusd(totalArmsOut)}
                  accent="amber"
                  count={armsOut.length}
                />
              )}
              {sanctions.length > 0 && (
                <Row
                  label="SANCTIONS RECEIVED"
                  value={`${sanctions.length}`}
                  accent="blood"
                />
              )}
              {totalAid > 0 && (
                <Row
                  label="AID RECEIVED"
                  value={formatMusd(totalAid)}
                  accent="green"
                  count={aid.length}
                />
              )}
              <Link
                href="/the-flows"
                className="text-[10px] text-blood-bright hover:underline block"
              >
                → FULL CORRIDORS ON /THE-FLOWS
              </Link>
            </>
          ) : (
            <p className="text-[11px] text-content-dim italic">
              No arms / sanctions / aid corridors recorded for {upper}.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <div className="text-[10px] uppercase text-content-dim">Most vulnerable admin-1</div>
          {hasRegions ? (
            <>
              {regions.map((r) => {
                const level = getVulnerabilityLevel(r.vulnerability_score);
                const hex = getVulnerabilityColor(r.vulnerability_score);
                return (
                  <div
                    key={`${r.country_iso3}-${r.subdivision_code}`}
                    className="flex items-center justify-between p-2 terminal-card text-[11px]"
                  >
                    <div>
                      <div className="text-content-primary">{r.subdivision_name}</div>
                      <div className="text-[10px] text-content-dim">{r.subdivision_code} · {r.country_iso3}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[10px] font-mono px-1"
                        style={{ color: hex }}
                      >
                        {formatVulnerabilityScore(r.vulnerability_score)}
                      </span>
                      <StatusPill
                        color={
                          level === "critical" || level === "high"
                            ? "blood"
                            : level === "moderate"
                              ? "amber"
                              : "dim"
                        }
                      >
                        {level.toUpperCase()}
                      </StatusPill>
                    </div>
                  </div>
                );
              })}
              <Link
                href="/the-subnational"
                className="text-[10px] text-blood-bright hover:underline block"
              >
                → FULL MAP ON /THE-SUBNATIONAL
              </Link>
            </>
          ) : (
            <p className="text-[11px] text-content-dim italic">
              No admin-1 vulnerability data for {upper}. See /the-subnational for global coverage.
            </p>
          )}
        </div>
      </div>

      {sub && (
        <p className="text-[10px] text-content-dim mt-3 italic">
          Sources: {sub.meta.sources.join(" · ")}
        </p>
      )}
    </TerminalCard>
  );
}

function Row({
  label,
  value,
  accent,
  count,
}: {
  label: string;
  value: string;
  accent: "blood" | "amber" | "green";
  count?: number;
}) {
  return (
    <div className="flex items-center justify-between p-2 terminal-card text-[11px]">
      <span className="text-content-dim">{label}</span>
      <span className="flex items-center gap-2">
        {count !== undefined && (
          <span className="text-[10px] text-content-dim">{count}× · </span>
        )}
        <StatusPill color={accent}>{value}</StatusPill>
      </span>
    </div>
  );
}
