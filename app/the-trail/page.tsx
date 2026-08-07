"use client";

import { useState } from "react";
import Link from "next/link";
import backbone from "@/data/world_backbone.json";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import { sound } from "@/lib/sound";
import type { WorldBackbone } from "@/lib/types";

const data = backbone as WorldBackbone;

interface LedgerEntry {
  ts: string;
  source: string;
  destination: string;
  amount: string;
  purpose: string;
  status: "VERIFIED" | "PENDING" | "IN_TRANSIT";
}

const seedLedger: LedgerEntry[] = [
  { ts: "2025-07-01 09:15", source: "V-3X2A", destination: "SDN-SECTOR-7", amount: "$5,000", purpose: "Emergency food supplies", status: "VERIFIED" },
  { ts: "2025-07-01 11:42", source: "V-7K2M", destination: "SSD-JUBA", amount: "$2,300", purpose: "Medical kit transport", status: "VERIFIED" },
  { ts: "2025-07-01 14:03", source: "V-1Z9X", destination: "COD-GOMA", amount: "$8,100", purpose: "Water purification equipment", status: "IN_TRANSIT" },
  { ts: "2025-07-01 16:20", source: "V-8B2N", destination: "HTI-PORT-AU-PRINCE", amount: "$3,750", purpose: "Shelter materials", status: "VERIFIED" },
  { ts: "2025-07-02 08:55", source: "V-5F4E", destination: "YEM-SANAA", amount: "$6,000", purpose: "Child nutrition formula", status: "IN_TRANSIT" },
  { ts: "2025-07-02 10:30", source: "V-9D3C", destination: "AFG-KABUL", amount: "$4,200", purpose: "Winter survival kits", status: "VERIFIED" },
  { ts: "2025-07-02 13:15", source: "V-2B1A", destination: "SOM-MOGADISHU", amount: "$3,000", purpose: "Cholera treatment supplies", status: "PENDING" },
  { ts: "2025-07-02 15:45", source: "V-6G5F", destination: "ETH-ADDIS", amount: "$7,500", purpose: "Seed distribution — drought-resistant", status: "VERIFIED" },
  { ts: "2025-07-03 09:00", source: "V-4H3G", destination: "SDN-DARFUR", amount: "$10,000", purpose: "Humanitarian corridor logistics", status: "IN_TRANSIT" },
  { ts: "2025-07-03 11:20", source: "V-7K2M", destination: "MLI-BAMAKO", amount: "$2,800", purpose: "School feeding program startup", status: "VERIFIED" },
  { ts: "2025-07-03 14:30", source: "V-1Z9X", destination: "BFA-OUAGADOUGOU", amount: "$1,500", purpose: "Orphan support network", status: "VERIFIED" },
  { ts: "2025-07-03 17:00", source: "V-8B2N", destination: "CAF-BANGUI", amount: "$4,500", purpose: "Emergency communications equipment", status: "PENDING" },
];

export default function TrilhaPage() {
  const [ledger] = useState<LedgerEntry[]>(seedLedger);
  const [needType, setNeedType] = useState("food");
  const [needLocation, setNeedLocation] = useState("");
  const [haveType, setHaveType] = useState("food");
  const [haveLocation, setHaveLocation] = useState("");

  const topHotspots = data.hotspots.all.slice(0, 8);

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <div className="mb-8 pt-4">
        <div className="text-xs text-content-dim mb-1">[06] THE TRAIL</div>
        <h1 className="text-2xl md:text-3xl text-blood-bright font-bold glow-blood">
          THE TRAIL
        </h1>
        <p className="text-content-secondary text-sm mt-2">
          // Resource routing. Transparent ledger. Direct-to-recipient. No intermediaries.
        </p>
      </div>

      {/* Transparent ledger */}
      <TerminalCard title="TRANSPARENT LEDGER — LIVE FEED" glow className="mb-6">
        <div className="text-xs text-content-secondary mb-3">
          [STUB] Simulated DAO ledger. Production: on-chain auditable transactions with smart contract routing.
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-dim text-content-dim">
                <th className="text-left py-2 px-2">TIMESTAMP</th>
                <th className="text-left py-2 px-2 hidden sm:table-cell">FROM</th>
                <th className="text-left py-2 px-2">TO</th>
                <th className="text-left py-2 px-2">AMOUNT</th>
                <th className="text-left py-2 px-2 hidden md:table-cell">PURPOSE</th>
                <th className="text-left py-2 px-2">STATUS</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((e, i) => (
                <tr key={i} className="border-b border-border-dim hover:bg-panel">
                  <td className="py-1 px-2 text-content-dim font-mono">{e.ts}</td>
                  <td className="py-1 px-2 text-content-secondary hidden sm:table-cell">{e.source}</td>
                  <td className="py-1 px-2 text-blood-bright">{e.destination}</td>
                  <td className="py-1 px-2 text-content-primary font-bold">{e.amount}</td>
                  <td className="py-1 px-2 text-content-secondary hidden md:table-cell">{e.purpose}</td>
                  <td className="py-1 px-2">
                    <span
                      className="text-xs"
                      style={{
                        color:
                          e.status === "VERIFIED"
                            ? "#00ff41"
                            : e.status === "IN_TRANSIT"
                              ? "#ffaa00"
                              : "#cc0000",
                      }}
                    >
                      {e.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TerminalCard>

      {/* Needs matching */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* I NEED */}
        <TerminalCard title="I NEED" accent="blood">
          <div className="space-y-3">
            <select
              value={needType}
              onChange={(e) => setNeedType(e.target.value)}
              className="w-full bg-void border border-border-dim px-3 py-2 text-xs text-content-primary focus:border-blood focus:outline-none"
            >
              <option value="food">Food</option>
              <option value="water">Water</option>
              <option value="medical">Medical</option>
              <option value="shelter">Shelter</option>
              <option value="comms">Communications</option>
            </select>
            <input
              type="text"
              value={needLocation}
              onChange={(e) => setNeedLocation(e.target.value)}
              placeholder="Location (city/coordinates)"
              className="w-full bg-void border border-border-dim px-3 py-2 text-xs text-content-primary focus:border-blood focus:outline-none"
            />
            <button
              onClick={() => sound.success()}
              className="w-full px-3 py-2 text-xs border border-blood text-blood-bright hover:bg-blood hover:text-void"
            >
              [ BROADCAST NEED ]
            </button>
          </div>
          <div className="text-xs text-content-dim mt-2">
            [STUB] Broadcasts to the matching engine. Production: proximity-based matching against provider network.
          </div>
        </TerminalCard>

        {/* I HAVE */}
        <TerminalCard title="I HAVE" accent="green">
          <div className="space-y-3">
            <select
              value={haveType}
              onChange={(e) => setHaveType(e.target.value)}
              className="w-full bg-void border border-border-dim px-3 py-2 text-xs text-content-primary focus:border-blood focus:outline-none"
            >
              <option value="food">Food</option>
              <option value="water">Water</option>
              <option value="medical">Medical</option>
              <option value="shelter">Shelter</option>
              <option value="comms">Communications</option>
            </select>
            <input
              type="text"
              value={haveLocation}
              onChange={(e) => setHaveLocation(e.target.value)}
              placeholder="Location (city/coordinates)"
              className="w-full bg-void border border-border-dim px-3 py-2 text-xs text-content-primary focus:border-blood focus:outline-none"
            />
            <button
              onClick={() => sound.success()}
              className="w-full px-3 py-2 text-xs border border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-void"
            >
              [ OFFER RESOURCE ]
            </button>
          </div>
        </TerminalCard>
      </div>

      {/* Priority routing — hottest needs */}
      <TerminalCard title="PRIORITY ROUTING — HIGHEST-NEED ZONES" accent="amber" className="mb-6">
        <p className="text-xs text-content-secondary mb-3">
          These zones have the highest measured need. Route resources here for maximum impact.
        </p>
        <div className="space-y-2">
          {topHotspots.map((h) => {
            const country = data.countries.find((c) => c.iso3 === h.iso3);
            return (
              <Link
                key={h.iso3}
                href={`/sorrow-map/${h.iso3.toLowerCase()}/`}
                className="flex items-center justify-between p-2 terminal-card hover:border-blood block"
              >
                <div>
                  <span className="text-xs text-content-primary font-bold">
                    {country?.name_en || h.name_pt}
                  </span>
                  <span className="text-xs text-content-dim ml-2">
                    Score: {h.score} · Undernourishment:{" "}
                    {country?.hunger.undernourishment_pct
                      ? `${country.hunger.undernourishment_pct.toFixed(1)}%`
                      : "N/A"}
                  </span>
                </div>
                <span className="text-xs text-blood-bright">→ ROUTE HERE</span>
              </Link>
            );
          })}
        </div>
      </TerminalCard>

      {/* Financing integration */}
      <TerminalCard title="FUND THE SOLUTION" className="mb-6">
        <Link href="/equation/" className="text-sm text-blood-bright hover:underline">
          → See The Equation: How $93B/year can end global hunger
        </Link>
        <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2">
          {data.financing.allocation.slice(0, 6).map((a, i) => (
            <div key={i} className="text-xs p-2 terminal-card">
              <div className="text-content-dim">{a.name}</div>
              <div className="text-blood-bright font-bold">${a.billion_yr}B/yr</div>
            </div>
          ))}
        </div>
      </TerminalCard>
    </div>
  );
}
