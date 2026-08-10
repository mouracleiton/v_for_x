"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import TerminalCard from "@/components/ui/TerminalCard";
import { sound } from "@/lib/sound";
import {
  loadIndex,
  loadDataset,
  getLatestValue,
  getAllLatest,
  getRanking,
  toLineChartData,
  toBarChartData,
  type OWIDIndex,
  type OWIDIndexEntry,
  type OWIDDataset,
} from "@/lib/owid";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

const CHART_COLORS = ["#ff3344", "#22d3a6", "#ffcc00", "#44aaff", "#aa44ff", "#ff8800"];

export default function TheWorldDataPage() {
  const [index, setIndex] = useState<OWIDIndex | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string>("");
  const [dataset, setDataset] = useState<OWIDDataset | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedCountries, setSelectedCountries] = useState<string[]>(["USA", "BRA", "JPN"]);
  const [countryInput, setCountryInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Load index on mount
  useEffect(() => {
    loadIndex()
      .then((idx) => {
        setIndex(idx);
        if (idx && idx.datasets.length > 0) {
          setSelectedSlug(idx.datasets[0].slug);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load OWID data index. Run: python3 scripts/fetch_owid.py");
        setLoading(false);
      });
  }, []);

  // Load dataset when slug changes
  useEffect(() => {
    if (!selectedSlug) return;
    setLoading(true);
    loadDataset(selectedSlug)
      .then((ds) => {
        setDataset(ds);
        setLoading(false);
      })
      .catch(() => {
        setError(`Failed to load dataset: ${selectedSlug}`);
        setLoading(false);
      });
  }, [selectedSlug]);

  const filteredDatasets = useMemo(() => {
    if (!index) return [];
    if (selectedCategory === "all") return index.datasets;
    return index.datasets.filter((d) => d.category === selectedCategory);
  }, [index, selectedCategory]);

  const currentEntry = useMemo(
    () => index?.datasets.find((d) => d.slug === selectedSlug) ?? null,
    [index, selectedSlug],
  );

  const lineData = useMemo(() => {
    if (!dataset) return [];
    return toLineChartData(dataset, selectedCountries);
  }, [dataset, selectedCountries]);

  const barData = useMemo(() => {
    if (!dataset) return [];
    return toBarChartData(dataset, 15, "higher_better");
  }, [dataset]);

  const ranking = useMemo(() => {
    if (!dataset) return [];
    return getRanking(dataset, "higher_better", 20);
  }, [dataset]);

  const addCountry = useCallback((code: string) => {
    const upper = code.toUpperCase().trim();
    if (upper.length < 2) return;
    setSelectedCountries((prev) =>
      prev.includes(upper) ? prev : [...prev, upper].slice(-6),
    );
    setCountryInput("");
    sound.select();
  }, []);

  const removeCountry = useCallback((code: string) => {
    setSelectedCountries((prev) => prev.filter((c) => c !== code));
    sound.nav();
  }, []);

  if (loading && !index) {
    return (
      <div className="p-10 max-w-4xl mx-auto">
        <h1 className="text-3xl text-blood-bright font-bold tracking-widest mb-2">
          📊 THE WORLD DATA
        </h1>
        <div className="text-content-dim text-sm">Loading OWID datasets…</div>
      </div>
    );
  }

  if (error || !index) {
    return (
      <div className="p-10 max-w-4xl mx-auto">
        <h1 className="text-3xl text-blood-bright font-bold tracking-widest mb-2">
          📊 THE WORLD DATA
        </h1>
        <TerminalCard title="NO DATA LOADED" accent="amber">
          <p className="text-sm text-content-secondary mb-3">{error || "No OWID datasets found."}</p>
          <p className="text-xs text-content-dim">
            To fetch datasets, run:
          </p>
          <pre className="mt-2 p-2 bg-abyss border border-border-dim text-[10px] text-content-secondary">
{`python3 scripts/fetch_owid.py`}
          </pre>
          <p className="text-xs text-content-dim mt-2">
            This downloads curated datasets from Our World in Data's public CSV API.
          </p>
        </TerminalCard>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-5xl mx-auto">
      <h1 className="text-3xl sm:text-4xl text-blood-bright font-bold tracking-widest mb-2">
        📊 THE WORLD DATA
      </h1>
      <p className="text-content-secondary text-sm mb-6">
        // our world in data explorer — {index.total_datasets} datasets across {index.categories.length} categories
      </p>

      {/* Dataset selector */}
      <TerminalCard title="DATASET CATALOG" accent="blood">
        <div className="flex flex-wrap gap-2 mb-3">
          <button
            onClick={() => setSelectedCategory("all")}
            className={`text-[10px] px-2 py-1 border ${
              selectedCategory === "all"
                ? "border-blood text-blood-bright bg-blood/10"
                : "border-border-dim text-content-secondary"
            }`}
          >
            ALL ({index.datasets.length})
          </button>
          {index.categories.map((cat) => {
            const count = index.datasets.filter((d) => d.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => {
                  setSelectedCategory(cat);
                  sound.nav();
                }}
                className={`text-[10px] px-2 py-1 border capitalize ${
                  selectedCategory === cat
                    ? "border-blood text-blood-bright bg-blood/10"
                    : "border-border-dim text-content-secondary hover:border-blood"
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          {filteredDatasets.map((d) => (
            <button
              key={d.slug}
              onClick={() => {
                setSelectedSlug(d.slug);
                sound.select();
              }}
              className={`text-[10px] px-2 py-1 border ${
                selectedSlug === d.slug
                  ? "border-terminal-green text-terminal-green bg-terminal-green/5"
                  : "border-border-dim text-content-secondary hover:border-terminal-green"
              }`}
            >
              {d.label}
              <span className="text-content-dim ml-1">· {d.entities}</span>
            </button>
          ))}
        </div>
      </TerminalCard>

      {/* Current dataset info */}
      {currentEntry && (
        <div className="mt-4">
          <TerminalCard title={currentEntry.label.toUpperCase()} accent="amber">
            <p className="text-xs text-content-secondary mb-2">{currentEntry.description}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div>
                <div className="text-lg font-bold text-content-primary">{currentEntry.entities}</div>
                <div className="text-[10px] text-content-dim">ENTITIES</div>
              </div>
              <div>
                <div className="text-lg font-bold text-content-primary">{currentEntry.min_year ?? "—"}</div>
                <div className="text-[10px] text-content-dim">FROM</div>
              </div>
              <div>
                <div className="text-lg font-bold text-content-primary">{currentEntry.max_year ?? "—"}</div>
                <div className="text-[10px] text-content-dim">TO</div>
              </div>
              <div>
                <div className="text-lg font-bold text-content-primary capitalize">{currentEntry.category}</div>
                <div className="text-[10px] text-content-dim">CATEGORY</div>
              </div>
            </div>
            <div className="mt-2 text-[10px] text-content-dim">Source: {currentEntry.source}</div>
          </TerminalCard>
        </div>
      )}

      {/* Country comparison line chart */}
      {dataset && (
        <div className="mt-4">
          <TerminalCard title="TIME SERIES — COUNTRY COMPARISON" accent="green">
            <div className="mb-3 flex flex-wrap gap-2 items-center">
              {selectedCountries.map((code) => (
                <span
                  key={code}
                  className="text-[10px] px-2 py-0.5 border border-border-dim text-content-secondary flex items-center gap-1"
                >
                  {code}
                  <button
                    onClick={() => removeCountry(code)}
                    className="text-blood-bright hover:text-blood"
                  >
                    ✕
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={countryInput}
                onChange={(e) => setCountryInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && countryInput.trim()) {
                    e.preventDefault();
                    addCountry(countryInput);
                  }
                }}
                placeholder="Add ISO3 code…"
                maxLength={5}
                className="w-24 bg-abyss border border-border-dim text-content-primary text-xs p-1"
              />
              <button
                onClick={() => countryInput.trim() && addCountry(countryInput)}
                className="text-[10px] px-2 py-1 border border-border-dim text-content-secondary hover:border-terminal-green"
              >
                ADD
              </button>
            </div>

            {lineData.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={lineData} margin={{ left: 0, right: 20, top: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                  <XAxis
                    dataKey="year"
                    stroke="#666"
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis stroke="#666" tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0a0a0a", border: "1px solid #ff3344", fontSize: 11 }}
                  />
                  {selectedCountries.map((code, i) => (
                    <Line
                      key={code}
                      type="monotone"
                      dataKey={code}
                      stroke={CHART_COLORS[i % CHART_COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-content-dim text-xs py-8">
                No data for selected countries
              </div>
            )}
          </TerminalCard>
        </div>
      )}

      {/* Top 15 ranking bar chart */}
      {dataset && barData.length > 0 && (
        <div className="mt-4">
          <TerminalCard title="TOP 15 — LATEST VALUES" accent="amber">
            <ResponsiveContainer width="100%" height={400}>
              <BarChart
                data={barData}
                layout="vertical"
                margin={{ left: 10, right: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                <XAxis type="number" stroke="#666" tick={{ fontSize: 10 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="#666"
                  tick={{ fontSize: 9 }}
                  width={70}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0a0a0a", border: "1px solid #ff3344", fontSize: 11 }}
                />
                <Bar dataKey="value" fill="#ff3344" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </TerminalCard>
        </div>
      )}

      {/* Data table */}
      {ranking.length > 0 && (
        <div className="mt-4">
          <TerminalCard title="RANKING TABLE" accent="blood">
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-abyss">
                  <tr className="border-b border-border-dim text-content-dim">
                    <th className="text-left p-2">#</th>
                    <th className="text-left p-2">Country</th>
                    <th className="text-left p-2">Code</th>
                    <th className="text-right p-2">Value</th>
                    <th className="text-right p-2">Year</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((c, i) => (
                    <tr key={c.iso3} className="border-b border-border-dim/30 hover:bg-panel-hi">
                      <td className="p-2 text-content-dim">{i + 1}</td>
                      <td className="p-2">
                        <Link
                          href={`/sorrow-map/${c.iso3.toLowerCase()}/`}
                          className="text-content-primary hover:text-blood-bright"
                        >
                          {c.name}
                        </Link>
                      </td>
                      <td className="p-2 text-content-dim font-mono">{c.iso3}</td>
                      <td className="p-2 text-right text-content-primary">
                        {Math.round(c.value * 100) / 100}
                      </td>
                      <td className="p-2 text-right text-content-dim">{c.year}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TerminalCard>
        </div>
      )}

      <div className="mt-6 text-center text-[10px] text-content-dim">
        Data from Our World in Data (CC BY 4.0) · Fetched via public CSV API · {index.fetched_at}
      </div>
    </div>
  );
}
