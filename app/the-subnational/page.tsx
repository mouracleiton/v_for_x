"use client";

import { useState, useCallback, useEffect } from "react";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import { sound } from "@/lib/sound";
import {
  loadSubnationalData,
  getMostVulnerableRegions,
  getMostVulnerableInCountry,
  getAllCountriesVulnerabilityStats,
  getCountriesWithData,
  getCountryName,
  getRegionsByThreshold,
  getVulnerabilityLevel,
  getVulnerabilityColor,
  getVulnerabilityIcon,
  formatVulnerabilityScore,
  formatCentroid,
  getVulnerabilityThresholds,
  type VulnerableRegion,
  type CountryVulnerabilityStats,
} from "@/lib/subnational";
import { useStore } from "@/stores/useStore";

export default function TheSubnationalPage() {
  const { lang } = useStore();
  const [loading, setLoading] = useState(true);
  const [regions, setRegions] = useState<VulnerableRegion[]>([]);
  const [countryStats, setCountryStats] = useState<CountryVulnerabilityStats[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<VulnerableRegion | null>(null);
  const [viewMode, setViewMode] = useState<"overview" | "by-country" | "threshold">("overview" as "overview" | "by-country" | "threshold");
  const [searchQuery, setSearchQuery] = useState("");
  const [threshold, setThreshold] = useState<number>(0.7);

  const countryNames: Record<string, string> = {
    BRA: "Brazil",
    COD: "Democratic Republic of Congo",
    COL: "Colombia",
    ETH: "Ethiopia",
    IDN: "Indonesia",
    IND: "India",
    MEX: "Mexico",
    NGA: "Nigeria",
    PAK: "Pakistan",
    PHL: "Philippines",
    USA: "United States",
    ZAF: "South Africa",
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadSubnationalData();
      const mostVulnerable = getMostVulnerableRegions(data, 50);
      const stats = getAllCountriesVulnerabilityStats(data);

      setRegions(mostVulnerable);
      setCountryStats(stats);
      sound.success();
    } catch (error) {
      console.error("Failed to load subnational data:", error);
      sound.error();
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCountrySelect = useCallback(async (iso3: string) => {
    setSelectedCountry(iso3);
    try {
      const data = await loadSubnationalData();
      const countryRegions = getMostVulnerableInCountry(data, iso3, 100);
      setRegions(countryRegions);
      sound.success();
    } catch (error) {
      console.error("Failed to load country data:", error);
      sound.error();
    }
  }, []);

  const handleThresholdChange = useCallback(async (minScore: number) => {
    setThreshold(minScore);
    try {
      const data = await loadSubnationalData();
      const thresholdRegions = getRegionsByThreshold(data, minScore, 1.0);
      setRegions(thresholdRegions);
      sound.success();
    } catch (error) {
      console.error("Failed to load threshold data:", error);
      sound.error();
    }
  }, []);

  const filteredRegions = regions.filter(
    (r) =>
      r.subdivision_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.country_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.subdivision_code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-green-500 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <div className="animate-spin text-4xl">⏳</div>
            <h1 className="text-3xl font-bold">THE SUBNATIONAL</h1>
          </div>
          <p className="text-green-400">Loading vulnerability data...</p>
        </div>
      </div>
    );
  }

  const thresholds = getVulnerabilityThresholds();

  return (
    <div className="min-h-screen bg-black text-green-500 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="border-b border-green-900 pb-6">
          <div className="flex items-center gap-4 mb-4">
            <span className="text-4xl">🗺️</span>
            <div>
              <h1 className="text-4xl font-bold">THE SUBNATIONAL</h1>
              <p className="text-green-400 text-sm mt-1">
                Administrative Area Vulnerability Map
              </p>
            </div>
          </div>
          <p className="text-green-300 max-w-3xl">
            Explore vulnerability patterns at the subnational level across administrative
            boundaries. Identify high-risk regions within countries for targeted intervention
            and resource allocation.
          </p>
        </div>

        {/* View Mode Tabs */}
        <div className="flex gap-2 flex-wrap">
          {(["overview", "by-country", "threshold"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => {
                setViewMode(mode);
                if (mode === "overview" && !selectedCountry) {
                  loadData();
                }
              }}
              className={`px-4 py-2 border border-green-900 uppercase text-sm font-mono transition-colors ${
                viewMode === mode
                  ? "bg-green-900 text-black"
                  : "bg-black text-green-500 hover:bg-green-900 hover:text-black"
              }`}
            >
              {mode === "overview" && "🌍"}
              {mode === "by-country" && "🏳️"}
              {mode === "threshold" && "📊"}
              {mode.replace("-", " ")}
            </button>
          ))}
        </div>

        {/* Overview: Top Vulnerable Regions */}
        {viewMode === "overview" && (
          <>
            <TerminalCard title="MOST VULNERABLE REGIONS" className="border-red-900">
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Search regions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-black border border-green-900 px-4 py-2 text-green-500 font-mono focus:outline-none focus:border-green-500"
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-green-900">
                      <th className="text-left py-2 px-3 font-mono">CODE</th>
                      <th className="text-left py-2 px-3">REGION</th>
                      <th className="text-left py-2 px-3">COUNTRY</th>
                      <th className="text-right py-2 px-3">SCORE</th>
                      <th className="text-right py-2 px-3">LEVEL</th>
                      <th className="text-right py-2 px-3">LOCATION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRegions.slice(0, 50).map((region) => (
                      <tr
                        key={`${region.country_iso3}-${region.subdivision_code}`}
                        onClick={() => setSelectedRegion(region)}
                        className={`border-b border-green-900/30 cursor-pointer transition-colors ${
                          selectedRegion?.subdivision_code === region.subdivision_code
                            ? "bg-green-900/20"
                            : "hover:bg-green-900/10"
                        }`}
                      >
                        <td className="py-2 px-3 font-mono">{region.subdivision_code}</td>
                        <td className="py-2 px-3">{region.subdivision_name}</td>
                        <td className="py-2 px-3 text-green-400">{region.country_name}</td>
                        <td
                          className="py-2 px-3 text-right font-mono"
                          style={{ color: getVulnerabilityColor(region.vulnerability_score) }}
                        >
                          {formatVulnerabilityScore(region.vulnerability_score)}
                        </td>
                        <td className="py-2 px-3 text-right">
                          {getVulnerabilityIcon(region.vulnerability_score)}{" "}
                          {getVulnerabilityLevel(region.vulnerability_score)}
                        </td>
                        <td className="py-2 px-3 text-right text-green-400 font-mono text-xs">
                          {formatCentroid(region.centroid)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredRegions.length > 50 && (
                <div className="text-center text-green-400 text-sm mt-4">
                  Showing 50 of {filteredRegions.length} regions
                </div>
              )}
            </TerminalCard>

            {/* Country Rankings */}
            <TerminalCard title="COUNTRIES BY AVERAGE VULNERABILITY" className="border-yellow-900">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {countryStats.slice(0, 12).map((stat) => (
                  <div
                    key={stat.iso3}
                    onClick={() => handleCountrySelect(stat.iso3)}
                    className="border border-green-900/30 p-3 cursor-pointer hover:bg-green-900/10 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-green-400">{stat.iso3}</span>
                      <StatusPill
                        color={
                          stat.avgVulnerability >= 0.8
                            ? "blood"
                            : stat.avgVulnerability >= 0.6
                            ? "amber"
                            : "dim"
                        }
                      >
                        {getVulnerabilityLevel(stat.avgVulnerability)}
                      </StatusPill>
                    </div>
                    <div className="text-sm mb-1">{stat.name}</div>
                    <div className="text-xs text-green-400">
                      Avg: {formatVulnerabilityScore(stat.avgVulnerability)}
                    </div>
                    <div className="text-xs text-green-500 mt-1">
                      {stat.highVulnerabilityCount} high-risk regions
                    </div>
                  </div>
                ))}
              </div>
            </TerminalCard>
          </>
        )}

        {/* By Country View */}
        {viewMode === "by-country" && (
          <TerminalCard title="SELECT COUNTRY" className="border-blue-900">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {Object.entries(countryNames).map(([iso3, name]) => (
                <button
                  key={iso3}
                  onClick={() => handleCountrySelect(iso3)}
                  className={`px-4 py-3 border border-green-900 text-left transition-colors ${
                    selectedCountry === iso3
                      ? "bg-green-900 text-black"
                      : "bg-black text-green-500 hover:bg-green-900 hover:text-black"
                  }`}
                >
                  <div className="font-mono text-sm">{iso3}</div>
                  <div className="text-xs mt-1 opacity-80">{name}</div>
                </button>
              ))}
            </div>

            {selectedCountry && regions.length > 0 && (
              <div className="mt-6 pt-6 border-t border-green-900">
                <h3 className="text-lg font-mono mb-3">
                  {countryNames[selectedCountry as keyof typeof countryNames]} - Regions Ranked by
                  Vulnerability
                </h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {regions.map((region) => (
                    <div
                      key={region.subdivision_code}
                      onClick={() => setSelectedRegion(region)}
                      className={`flex items-center justify-between p-2 border border-green-900/30 cursor-pointer transition-colors ${
                        selectedRegion?.subdivision_code === region.subdivision_code
                          ? "bg-green-900/20"
                          : "hover:bg-green-900/10"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{getVulnerabilityIcon(region.vulnerability_score)}</span>
                        <div>
                          <div className="font-mono text-sm">{region.subdivision_code}</div>
                          <div className="text-xs text-green-400">{region.subdivision_name}</div>
                        </div>
                      </div>
                      <div
                        className="font-mono text-sm"
                        style={{ color: getVulnerabilityColor(region.vulnerability_score) }}
                      >
                        {formatVulnerabilityScore(region.vulnerability_score)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TerminalCard>
        )}

        {/* Threshold View */}
        {viewMode === "threshold" && (
          <TerminalCard title="VULNERABILITY THRESHOLD FILTER" className="border-purple-900">
            <div className="space-y-6">
              <div>
                <label className="block text-sm mb-2">
                  Minimum Vulnerability Score: {formatVulnerabilityScore(threshold)}
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={threshold * 100}
                  onChange={(e) => handleThresholdChange(parseInt(e.target.value) / 100)}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-green-400 mt-1">
                  <span>0%</span>
                  <span>25%</span>
                  <span>50%</span>
                  <span>75%</span>
                  <span>100%</span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div
                  onClick={() => handleThresholdChange(thresholds.critical)}
                  className="border border-red-900 p-3 text-center cursor-pointer hover:bg-red-900/10 transition-colors"
                >
                  <div className="text-2xl mb-1">🔴</div>
                  <div className="text-sm font-mono">CRITICAL</div>
                  <div className="text-xs text-red-400">≥80%</div>
                </div>
                <div
                  onClick={() => handleThresholdChange(thresholds.high)}
                  className="border border-yellow-900 p-3 text-center cursor-pointer hover:bg-yellow-900/10 transition-colors"
                >
                  <div className="text-2xl mb-1">🟠</div>
                  <div className="text-sm font-mono">HIGH</div>
                  <div className="text-xs text-yellow-400">≥60%</div>
                </div>
                <div
                  onClick={() => handleThresholdChange(thresholds.moderate)}
                  className="border border-yellow-700 p-3 text-center cursor-pointer hover:bg-yellow-700/10 transition-colors"
                >
                  <div className="text-2xl mb-1">🟡</div>
                  <div className="text-sm font-mono">MODERATE</div>
                  <div className="text-xs text-yellow-600">≥40%</div>
                </div>
                <div
                  onClick={() => handleThresholdChange(thresholds.low)}
                  className="border border-green-900 p-3 text-center cursor-pointer hover:bg-green-900/10 transition-colors"
                >
                  <div className="text-2xl mb-1">🟢</div>
                  <div className="text-sm font-mono">LOW</div>
                  <div className="text-xs text-green-400">≥0%</div>
                </div>
              </div>

              <div className="text-center text-green-400">
                Found <span className="font-mono text-lg">{filteredRegions.length}</span> regions
                with score ≥ {formatVulnerabilityScore(threshold)}
              </div>

              {filteredRegions.length > 0 && (
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-green-900">
                        <th className="text-left py-2 px-3 font-mono">CODE</th>
                        <th className="text-left py-2 px-3">REGION</th>
                        <th className="text-left py-2 px-3">COUNTRY</th>
                        <th className="text-right py-2 px-3">SCORE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRegions.map((region) => (
                        <tr
                          key={`${region.country_iso3}-${region.subdivision_code}`}
                          onClick={() => setSelectedRegion(region)}
                          className="border-b border-green-900/30 cursor-pointer hover:bg-green-900/10"
                        >
                          <td className="py-2 px-3 font-mono">{region.subdivision_code}</td>
                          <td className="py-2 px-3">{region.subdivision_name}</td>
                          <td className="py-2 px-3 text-green-400">{region.country_name}</td>
                          <td
                            className="py-2 px-3 text-right font-mono"
                            style={{ color: getVulnerabilityColor(region.vulnerability_score) }}
                          >
                            {formatVulnerabilityScore(region.vulnerability_score)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TerminalCard>
        )}

        {/* Region Detail Modal */}
        {selectedRegion && (
          <TerminalCard
            title={`REGION DETAIL: ${selectedRegion.subdivision_name}`}
            className="border-blue-900"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-green-500 font-mono mb-3">IDENTITY</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-green-400">Code:</span>{" "}
                    <span className="font-mono">{selectedRegion.subdivision_code}</span>
                  </div>
                  <div>
                    <span className="text-green-400">Name:</span> {selectedRegion.subdivision_name}
                  </div>
                  <div>
                    <span className="text-green-400">Country:</span> {selectedRegion.country_name} (
                    <span className="font-mono">{selectedRegion.country_iso3}</span>)
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-green-500 font-mono mb-3">VULNERABILITY</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{getVulnerabilityIcon(selectedRegion.vulnerability_score)}</span>
                    <span className="font-mono text-lg">
                      {formatVulnerabilityScore(selectedRegion.vulnerability_score)}
                    </span>
                    <span className="text-green-400">
                      ({getVulnerabilityLevel(selectedRegion.vulnerability_score)})
                    </span>
                  </div>
                  <div
                    className="w-full bg-black border border-green-900 h-4"
                    title="Vulnerability score"
                  >
                    <div
                      className="h-full"
                      style={{
                        width: `${selectedRegion.vulnerability_score * 100}%`,
                        backgroundColor: getVulnerabilityColor(selectedRegion.vulnerability_score),
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="md:col-span-2">
                <h3 className="text-green-500 font-mono mb-3">LOCATION</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-green-400">Centroid:</span>{" "}
                    <span className="font-mono">{formatCentroid(selectedRegion.centroid)}</span>
                  </div>
                  <div className="text-green-400 text-xs">
                    Coordinates: [{selectedRegion.centroid[0].toFixed(4)},{" "}
                    {selectedRegion.centroid[1].toFixed(4)}]
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedRegion(null)}
              className="mt-6 px-4 py-2 border border-blue-900 text-blue-400 hover:bg-blue-900 hover:text-black transition-colors"
            >
              CLOSE DETAIL
            </button>
          </TerminalCard>
        )}

        {/* Data Sources Note */}
        <div className="text-center text-green-600 text-xs space-y-1">
          <div>
            Data sources: Administrative boundary datasets, conflict databases, vulnerability indices
          </div>
          <div className="text-green-700">
            Vulnerability scores are composite indicators based on conflict, development, and
            stability metrics
          </div>
        </div>
      </div>
    </div>
  );
}
