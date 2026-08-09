"use client";

import { useState, useMemo, useRef } from "react";
import timelinesData from "@/data/crisis_timelines.json";

interface TimelineEvent {
  year: string | number;
  event: string;
  type?: string;
  severity?: string;
}

interface CountryTimeline {
  iso3: string;
  name: string;
  events: TimelineEvent[];
}

const EVENT_COLORS: Record<string, string> = {
  military: "#c42b3e",
  famine: "#f0a93b",
  political: "#5b9cf6",
  displacement: "#9a3030",
  economic: "#22d3a6",
  health: "#e23856",
  other: "#3a5070",
};

function getEventColor(ev: TimelineEvent): string {
  const type = (ev.type || "").toLowerCase();
  for (const key of Object.keys(EVENT_COLORS)) {
    if (type.includes(key)) return EVENT_COLORS[key];
  }
  if ((ev.event || "").toLowerCase().match(/war|attack|bomb|kill|massacre|strike|assault/)) return EVENT_COLORS.military;
  if ((ev.event || "").toLowerCase().match(/famine|hunger|food|starv/)) return EVENT_COLORS.famine;
  if ((ev.event || "").toLowerCase().match(/coup|election|protest|government|president|regime/)) return EVENT_COLORS.political;
  if ((ev.event || "").toLowerCase().match(/refugee|displace|flee|displaced|idp/)) return EVENT_COLORS.displacement;
  if ((ev.event || "").toLowerCase().match(/economy|currency|crisis|sanction|debt/)) return EVENT_COLORS.economic;
  if ((ev.event || "").toLowerCase().match(/disease|cholera|epidemic|covid|health/)) return EVENT_COLORS.health;
  return EVENT_COLORS.other;
}

export default function TimelineRiver() {
  const [selectedCountries, setSelectedCountries] = useState<Set<string>>(new Set());
  const [scrubberYear, setScrubberYear] = useState<number>(2024);
  const [isPlaying, setIsPlaying] = useState(false);
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const timelines = useMemo(() => {
    const raw = timelinesData as unknown;
    if (Array.isArray(raw)) return raw as CountryTimeline[];
    if (raw && typeof raw === "object" && "timelines" in raw) {
      return (raw as { timelines: CountryTimeline[] }).timelines;
    }
    return [];
  }, []);

  // All unique years
  const yearRange = useMemo(() => {
    const years = new Set<number>();
    timelines.forEach((t) =>
      t.events.forEach((e) => {
        const y = typeof e.year === "number" ? e.year : parseInt(String(e.year), 10);
        if (!isNaN(y)) years.add(y);
      })
    );
    const sorted = [...years].sort((a, b) => a - b);
    return sorted.length > 0 ? { min: sorted[0], max: sorted[sorted.length - 1] } : { min: 2000, max: 2024 };
  }, [timelines]);

  const visibleTimelines = useMemo(() => {
    if (selectedCountries.size === 0) return timelines.slice(0, 5);
    return timelines.filter((t) => selectedCountries.has(t.iso3));
  }, [timelines, selectedCountries]);

  const toggleCountry = (iso3: string) => {
    setSelectedCountries((prev) => {
      const next = new Set(prev);
      if (next.has(iso3)) next.delete(iso3);
      else next.add(iso3);
      return next;
    });
  };

  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      if (playRef.current) clearInterval(playRef.current);
    } else {
      setIsPlaying(true);
      playRef.current = setInterval(() => {
        setScrubberYear((y) => {
          if (y >= yearRange.max) {
            setIsPlaying(false);
            if (playRef.current) clearInterval(playRef.current);
            return yearRange.max;
          }
          return y + 1;
        });
      }, 500);
    }
  };

  const eventsAtYear = useMemo(() => {
    const events: { iso3: string; name: string; event: TimelineEvent; color: string }[] = [];
    visibleTimelines.forEach((t) => {
      t.events.forEach((e) => {
        const y = typeof e.year === "number" ? e.year : parseInt(String(e.year), 10);
        if (y === scrubberYear) {
          events.push({ iso3: t.iso3, name: t.name, event: e, color: getEventColor(e) });
        }
      });
    });
    return events;
  }, [visibleTimelines, scrubberYear]);

  return (
    <div className="space-y-4">
      {/* Country filters */}
      <div className="flex flex-wrap gap-1">
        <span className="text-[10px] text-content-dim self-center mr-1">FILTER:</span>
        {timelines.map((t) => (
          <button
            key={t.iso3}
            onClick={() => toggleCountry(t.iso3)}
            className={`inline-pill text-[9px] px-2 py-1 border transition-colors ${
              selectedCountries.size === 0
                ? "border-border-dim text-content-secondary"
                : selectedCountries.has(t.iso3)
                  ? "border-blood text-blood-bright bg-blood-dim/30"
                  : "border-border-dim text-content-dim opacity-50"
            }`}
          >
            {t.iso3}
          </button>
        ))}
        {selectedCountries.size > 0 && (
          <button
            onClick={() => setSelectedCountries(new Set())}
            className="inline-pill text-[9px] px-2 py-1 text-content-dim hover:text-blood"
          >
            ✕ CLEAR
          </button>
        )}
      </div>

      {/* Timeline visualization */}
      <div className="border border-border-dim bg-abyss overflow-x-auto">
        <div className="min-w-[800px] p-4">
          {/* Year axis */}
          <div className="flex items-center justify-between mb-3 px-2">
            {Array.from({ length: Math.min(yearRange.max - yearRange.min + 1, 25) }, (_, i) => {
              const year = yearRange.min + Math.floor(((yearRange.max - yearRange.min) * i) / 24);
              return (
                <div key={i} className="text-[8px] text-content-dim font-mono">
                  {year}
                </div>
              );
            })}
          </div>

          {/* Each country's event stream */}
          <div className="space-y-1">
            {visibleTimelines.map((t) => (
              <div key={t.iso3} className="flex items-center gap-2 group">
                <div className="w-16 text-[9px] text-content-secondary font-mono shrink-0">
                  {t.iso3}
                </div>
                <div className="flex-1 relative h-6 bg-panel/50 border border-border-dim">
                  {/* Scrubber line */}
                  {scrubberYear >= yearRange.min && scrubberYear <= yearRange.max && (
                    <div
                      className="absolute top-0 bottom-0 w-px bg-terminal-green z-10"
                      style={{
                        left: `${((scrubberYear - yearRange.min) / Math.max(yearRange.max - yearRange.min, 1)) * 100}%`,
                      }}
                    >
                      <div className="absolute -top-1 -left-1 w-2 h-2 bg-terminal-green rounded-full" />
                    </div>
                  )}
                  {/* Events */}
                  {t.events.map((e, i) => {
                    const y = typeof e.year === "number" ? e.year : parseInt(String(e.year), 10);
                    if (isNaN(y)) return null;
                    const pct = ((y - yearRange.min) / Math.max(yearRange.max - yearRange.min, 1)) * 100;
                    return (
                      <div
                        key={i}
                        className="absolute top-1 w-2 h-2 rounded-full group-hover:scale-150 transition-transform"
                        style={{ left: `${pct}%`, background: getEventColor(e) }}
                        title={`${y}: ${e.event}`}
                      >
                        <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block whitespace-nowrap bg-void border border-border-bright px-2 py-1 text-[8px] text-content-primary z-20 max-w-xs">
                          {y}: {e.event}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scrubber controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          className="px-3 py-1.5 border border-border-bright text-content-secondary hover:text-terminal-green hover:border-terminal-green transition-colors text-xs font-mono"
        >
          {isPlaying ? "⏸ PAUSE" : "▶ PLAY"}
        </button>
        <input
          type="range"
          min={yearRange.min}
          max={yearRange.max}
          value={scrubberYear}
          onChange={(e) => setScrubberYear(parseInt(e.target.value, 10))}
          className="flex-1 accent-terminal-green"
        />
        <span className="text-blood-bright font-mono font-bold text-lg w-16 text-right">
          {scrubberYear}
        </span>
      </div>

      {/* Events at scrubber year */}
      <div className="border border-border-dim bg-panel/50 p-3 min-h-[80px]">
        <div className="text-[10px] text-content-dim mb-2 font-mono">
          EVENTS IN {scrubberYear}:
        </div>
        {eventsAtYear.length === 0 ? (
          <div className="text-[10px] text-content-dim">No recorded events for this year in selected countries.</div>
        ) : (
          <div className="space-y-1">
            {eventsAtYear.map((ev, i) => (
              <div key={i} className="flex items-start gap-2 text-[11px] font-mono">
                <span
                  className="shrink-0 w-2 h-2 rounded-full mt-1"
                  style={{ background: ev.color }}
                />
                <span className="text-command shrink-0 w-16">{ev.iso3}</span>
                <span className="text-content-secondary">{ev.event.event}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-[9px] text-content-dim font-mono">
        {Object.entries(EVENT_COLORS).map(([type, color]) => (
          <span key={type} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: color }} />
            {type}
          </span>
        ))}
      </div>
    </div>
  );
}
