"use client";

import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import backbone from "@/data/world_backbone.json";
import type { WorldBackbone } from "@/lib/types";
import TerminalCard from "@/components/ui/TerminalCard";
import { sound } from "@/lib/sound";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ZAxis,
} from "recharts";
import {
  ChartConfig,
  METRIC_OPTIONS,
  METRIC_CATEGORIES,
  METRIC_EXTRACTORS,
  REGION_LIST,
  SERIES_COLORS,
  DEFAULT_CONFIG,
  buildChartData,
  encodeConfig,
  getMetricOption,
} from "@/lib/chart-builder";
import { downloadFile, generateEmbedCode } from "@/lib/export-utils";

const data = backbone as WorldBackbone;

/* ═══════════════════════════════════════════════════════════════
   CHART TYPE PREVIEW ICONS
   ═══════════════════════════════════════════════════════════════ */
const CHART_TYPES: {
  id: ChartConfig["chartType"];
  label: string;
  icon: string;
}[] = [
  { id: "bar", label: "Bar", icon: "📊" },
  { id: "line", label: "Line", icon: "📈" },
  { id: "scatter", label: "Scatter", icon: "🔵" },
];

/* ═══════════════════════════════════════════════════════════════
   SVG → PNG EXPORT
   ═══════════════════════════════════════════════════════════════ */
function exportSvgAsPng(
  svg: SVGSVGElement | null,
  filename: string,
  width = 1200,
  height = 700
): void {
  if (!svg) return;
  const serializer = new XMLSerializer();
  let svgString = serializer.serializeToString(svg);
  if (!svgString.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
    svgString = svgString.replace(
      /^<svg/,
      '<svg xmlns="http://www.w3.org/2000/svg"'
    );
  }
  const blob = new Blob([svgString], {
    type: "image/svg+xml;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      URL.revokeObjectURL(url);
      return;
    }
    ctx.fillStyle = "#060b14";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    URL.revokeObjectURL(url);
    canvas.toBlob((pngBlob) => {
      if (!pngBlob) return;
      const dlUrl = URL.createObjectURL(pngBlob);
      const a = document.createElement("a");
      a.href = dlUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(dlUrl), 1500);
    });
  };
  img.src = url;
}

/* ═══════════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════════ */
export default function ChartBuilderPage() {
  return (
    <React.Suspense fallback={<div className="p-6 text-blood-bright text-xs animate-pulse">// LOADING...</div>}>
      <ChartBuilderContent />
    </React.Suspense>
  );
}

function ChartBuilderContent() {
  const searchParams = useSearchParams();

  // ── Initialise config from URL query or defaults ──
  const [config, setConfig] = useState<ChartConfig>(() => {
    const m = searchParams.get("m");
    if (m) {
      const keys = m
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s && METRIC_EXTRACTORS[s]);
      if (keys.length) {
        return {
          metricKeys: keys,
          chartType: (searchParams.get("t") as ChartConfig["chartType"]) ?? "bar",
          sortBy: (searchParams.get("sb") as ChartConfig["sortBy"]) ?? "value",
          sortOrder:
            (searchParams.get("so") as ChartConfig["sortOrder"]) ?? "desc",
          filter: {
            region: searchParams.get("r") || undefined,
            minPopulation: searchParams.has("min")
              ? Number(searchParams.get("min"))
              : undefined,
            maxResults: searchParams.has("n")
              ? Number(searchParams.get("n"))
              : 15,
          },
        };
      }
    }
    return { ...DEFAULT_CONFIG };
  });

  const [copied, setCopied] = useState<string | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  // ── Build chart data ──
  const chartData = useMemo(
    () => buildChartData(data.countries, config),
    [config]
  );

  // ── Scatter data: first metric = X, second = Y ──
  const scatterData = useMemo(() => {
    return chartData.labels.map((name, i) => {
      const x = chartData.datasets[0]?.data[i] ?? 0;
      const y =
        chartData.datasets[1]?.data[i] ?? chartData.datasets[0]?.data[i] ?? 0;
      return { x, y, name };
    });
  }, [chartData]);

  // ── Config setters ──
  const toggleMetric = useCallback((key: string) => {
    setConfig((prev) => {
      const has = prev.metricKeys.includes(key);
      const metricKeys = has
        ? prev.metricKeys.filter((k) => k !== key)
        : [...prev.metricKeys, key];
      return { ...prev, metricKeys };
    });
  }, []);

  const updateFilter = useCallback(
    (patch: Partial<NonNullable<ChartConfig["filter"]>>) => {
      setConfig((prev) => ({
        ...prev,
        filter: { ...prev.filter, ...patch },
      }));
    },
    []
  );

  // ── Export handlers ──
  const handleExportPng = useCallback(() => {
    sound.success();
    const svg = chartRef.current?.querySelector("svg") as SVGSVGElement | null;
    exportSvgAsPng(svg, "v-for-x-chart.png");
  }, []);

  const handleExportCsv = useCallback(() => {
    sound.success();
    const header = [
      "country",
      ...chartData.datasets.map((d) => d.label),
    ];
    const rows = chartData.labels.map((label, i) =>
      [label, ...chartData.datasets.map((d) => d.data[i])].join(",")
    );
    const csv = [header.join(","), ...rows].join("\n");
    downloadFile("v-for-x-chart.csv", csv, "text/csv;charset=utf-8");
  }, [chartData]);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const base = window.location.origin + window.location.pathname;
    return `${base}?${encodeConfig(config)}`;
  }, [config]);

  const handleCopy = useCallback(
    async (text: string, label: string) => {
      try {
        await navigator.clipboard.writeText(text);
        sound.success();
        setCopied(label);
        setTimeout(() => setCopied(null), 2000);
      } catch {
        /* clipboard unavailable */
      }
    },
    []
  );

  const embedCode = useMemo(
    () =>
      generateEmbedCode("the-chart-builder", {
        m: config.metricKeys.join(","),
        t: config.chartType,
        sb: config.sortBy,
        so: config.sortOrder,
      }),
    [config]
  );

  // Sync URL on config change (replace state, no history spam)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const qs = encodeConfig(config);
    const newUrl = `${window.location.pathname}?${qs}`;
    window.history.replaceState(null, "", newUrl);
  }, [config]);

  const btnClass =
    "px-3 py-2 text-xs uppercase tracking-widest border transition-colors cursor-pointer";
  const hasMetrics = config.metricKeys.length > 0;
  const maxResults = config.filter?.maxResults ?? 15;

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 pt-4">
        <div className="text-xs text-content-dim mb-1">// data visualization engine</div>
        <h1 className="text-2xl md:text-3xl text-blood-bright font-bold glow-blood tracking-widest">
          THE CHART BUILDER
        </h1>
        <p className="text-content-secondary text-sm mt-2">
          Build custom charts across 200 countries × {METRIC_OPTIONS.length} metrics.
          Filter, sort, export to PNG / CSV, and share via URL.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
        {/* ═════ LEFT PANEL — CONFIGURATION ═════ */}
        <div className="space-y-4">
          {/* Chart type */}
          <TerminalCard title="chart type" accent="green">
            <div className="grid grid-cols-3 gap-2">
              {CHART_TYPES.map((ct) => (
                <button
                  key={ct.id}
                  onClick={() => setConfig((p) => ({ ...p, chartType: ct.id }))}
                  className={`flex flex-col items-center gap-1 p-3 border transition-colors cursor-pointer ${
                    config.chartType === ct.id
                      ? "border-terminal-green bg-terminal-green/10"
                      : "border-border-dim hover:border-border-bright"
                  }`}
                >
                  <span className="text-xl">{ct.icon}</span>
                  <span className="text-[10px] uppercase tracking-wide text-content-secondary">
                    {ct.label}
                  </span>
                </button>
              ))}
            </div>
          </TerminalCard>

          {/* Metric selection */}
          <TerminalCard title={`metrics (${config.metricKeys.length})`}>
            <div className="max-h-[340px] overflow-y-auto pr-1 space-y-3">
              {METRIC_CATEGORIES.map((cat) => {
                const opts = METRIC_OPTIONS.filter((o) => o.category === cat);
                return (
                  <div key={cat}>
                    <div className="text-[10px] uppercase tracking-widest text-blood-bright mb-1">
                      {cat}
                    </div>
                    <div className="grid grid-cols-1 gap-0.5">
                      {opts.map((o) => {
                        const checked = config.metricKeys.includes(o.key);
                        return (
                          <label
                            key={o.key}
                            className="flex items-center gap-2 py-1 px-1 hover:bg-panel-hi cursor-pointer text-xs"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleMetric(o.key)}
                              className="accent-blood"
                            />
                            <span className="text-content-primary flex-1">
                              {o.label}
                            </span>
                            <span className="text-content-dim text-[10px]">
                              {o.unit}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </TerminalCard>

          {/* Filters */}
          <TerminalCard title="filters & sort" accent="amber">
            <div className="space-y-3">
              {/* Region */}
              <div>
                <label className="text-[10px] uppercase tracking-wide text-content-dim block mb-1">
                  Region
                </label>
                <select
                  value={config.filter?.region ?? ""}
                  onChange={(e) =>
                    updateFilter({ region: e.target.value || undefined })
                  }
                  className="w-full bg-panel border border-border-dim px-2 py-2 text-xs text-content-primary"
                >
                  <option value="">All regions</option>
                  {REGION_LIST.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              {/* Top N */}
              <div>
                <label className="text-[10px] uppercase tracking-wide text-content-dim flex justify-between mb-1">
                  <span>Top results</span>
                  <span className="text-command">{maxResults}</span>
                </label>
                <input
                  type="range"
                  min={5}
                  max={50}
                  step={1}
                  value={maxResults}
                  onChange={(e) => updateFilter({ maxResults: Number(e.target.value) })}
                  className="w-full accent-command"
                />
              </div>

              {/* Sort by */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] uppercase tracking-wide text-content-dim block mb-1">
                    Sort by
                  </label>
                  <select
                    value={config.sortBy}
                    onChange={(e) =>
                      setConfig((p) => ({
                        ...p,
                        sortBy: e.target.value as ChartConfig["sortBy"],
                      }))
                    }
                    className="w-full bg-panel border border-border-dim px-2 py-2 text-xs text-content-primary"
                  >
                    <option value="value">Value</option>
                    <option value="name">Name</option>
                    <option value="none">None</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wide text-content-dim block mb-1">
                    Order
                  </label>
                  <select
                    value={config.sortOrder}
                    onChange={(e) =>
                      setConfig((p) => ({
                        ...p,
                        sortOrder: e.target.value as ChartConfig["sortOrder"],
                      }))
                    }
                    className="w-full bg-panel border border-border-dim px-2 py-2 text-xs text-content-primary"
                  >
                    <option value="desc">Descending</option>
                    <option value="asc">Ascending</option>
                  </select>
                </div>
              </div>
            </div>
          </TerminalCard>
        </div>

        {/* ═════ RIGHT PANEL — CHART PREVIEW ═════ */}
        <div className="space-y-4">
          {/* Toolbar */}
          <TerminalCard title="export & share">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleExportPng}
                disabled={!hasMetrics}
                className={`${btnClass} border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-void disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                🖼 Export PNG
              </button>
              <button
                onClick={handleExportCsv}
                disabled={!hasMetrics}
                className={`${btnClass} border-command text-command hover:bg-command hover:text-void disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                📄 Export CSV
              </button>
              <button
                onClick={() => handleCopy(embedCode, "embed")}
                disabled={!hasMetrics}
                className={`${btnClass} border-border-bright text-content-secondary hover:bg-panel-hi disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {copied === "embed" ? "✓ Copied" : "<> Embed code"}
              </button>
              <button
                onClick={() => handleCopy(shareUrl, "url")}
                disabled={!hasMetrics}
                className={`${btnClass} border-border-bright text-content-secondary hover:bg-panel-hi disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {copied === "url" ? "✓ Copied" : "🔗 Share URL"}
              </button>
            </div>
          </TerminalCard>

          {/* Live chart */}
          <TerminalCard
            title={`live preview · ${chartData.labels.length} countries`}
            accent="green"
            glow={hasMetrics}
          >
            {!hasMetrics ? (
              <div className="h-[420px] flex items-center justify-center text-content-dim text-sm">
                Select at least one metric to render the chart →
              </div>
            ) : (
              <div ref={chartRef} className="h-[460px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {config.chartType === "bar" ? (
                    <BarChart data={rechartsBarData(chartData)} margin={{ top: 10, right: 20, bottom: 60, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1a2a44" />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: "#8da3c4", fontSize: 10 }}
                        angle={-40}
                        textAnchor="end"
                        interval={0}
                        height={70}
                      />
                      <YAxis tick={{ fill: "#8da3c4", fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{
                          background: "#0f1a2e",
                          border: "1px solid #2a4264",
                          color: "#dfe7f5",
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {chartData.datasets.map((ds, i) => (
                        <Bar
                          key={ds.label}
                          dataKey={ds.label}
                          fill={SERIES_COLORS[i % SERIES_COLORS.length]}
                        />
                      ))}
                    </BarChart>
                  ) : config.chartType === "line" ? (
                    <LineChart data={rechartsBarData(chartData)} margin={{ top: 10, right: 20, bottom: 60, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1a2a44" />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: "#8da3c4", fontSize: 10 }}
                        angle={-40}
                        textAnchor="end"
                        interval={0}
                        height={70}
                      />
                      <YAxis tick={{ fill: "#8da3c4", fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{
                          background: "#0f1a2e",
                          border: "1px solid #2a4264",
                          color: "#dfe7f5",
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {chartData.datasets.map((ds, i) => (
                        <Line
                          key={ds.label}
                          type="monotone"
                          dataKey={ds.label}
                          stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                      ))}
                    </LineChart>
                  ) : (
                    <ScatterChart margin={{ top: 10, right: 20, bottom: 40, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1a2a44" />
                      <XAxis
                        type="number"
                        dataKey="x"
                        name={chartData.datasets[0]?.label ?? "X"}
                        tick={{ fill: "#8da3c4", fontSize: 10 }}
                        label={{
                          value: chartData.datasets[0]?.label ?? "",
                          position: "bottom",
                          fill: "#8da3c4",
                          fontSize: 11,
                        }}
                      />
                      <YAxis
                        type="number"
                        dataKey="y"
                        name={chartData.datasets[1]?.label ?? chartData.datasets[0]?.label ?? "Y"}
                        tick={{ fill: "#8da3c4", fontSize: 10 }}
                      />
                      <ZAxis range={[60, 60]} />
                      <Tooltip
                        cursor={{ strokeDasharray: "3 3" }}
                        contentStyle={{
                          background: "#0f1a2e",
                          border: "1px solid #2a4264",
                          color: "#dfe7f5",
                        }}
                        formatter={(val) => (typeof val === 'number' ? val.toLocaleString() : String(val))}
                        labelFormatter={(_, payload) =>
                          (payload?.[0]?.payload as { name?: string })?.name ?? ""
                        }
                      />
                      <Scatter
                        data={scatterData}
                        fill={SERIES_COLORS[0]}
                        fillOpacity={0.7}
                      />
                    </ScatterChart>
                  )}
                </ResponsiveContainer>
              </div>
            )}
          </TerminalCard>

          {/* Data summary */}
          <TerminalCard title="data summary">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <SummaryStat label="Countries" value={String(chartData.labels.length)} />
              <SummaryStat label="Metrics" value={String(config.metricKeys.length)} />
              <SummaryStat
                label="Region"
                value={config.filter?.region ?? "Global"}
              />
              <SummaryStat label="Chart" value={config.chartType.toUpperCase()} />
            </div>
            {config.metricKeys.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {config.metricKeys.map((k) => {
                  const opt = getMetricOption(k);
                  return (
                    <span
                      key={k}
                      className="text-[10px] px-2 py-0.5 border border-border-dim text-content-secondary"
                    >
                      {opt?.label ?? k}
                      {opt?.unit ? ` (${opt.unit})` : ""}
                    </span>
                  );
                })}
              </div>
            )}
          </TerminalCard>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */

/** Transform BuiltChartData into recharts row format for Bar/Line. */
function rechartsBarData(chartData: {
  labels: string[];
  datasets: { label: string; data: number[] }[];
}): Record<string, string | number>[] {
  return chartData.labels.map((name, i) => {
    const row: Record<string, string | number> = { name };
    for (const ds of chartData.datasets) {
      row[ds.label] = ds.data[i];
    }
    return row;
  });
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border-dim p-2">
      <div className="text-[10px] uppercase tracking-wide text-content-dim">
        {label}
      </div>
      <div className="text-sm text-terminal-green font-bold truncate">
        {value}
      </div>
    </div>
  );
}
