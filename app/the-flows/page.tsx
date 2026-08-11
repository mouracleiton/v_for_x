"use client";

import { useState, useCallback, useEffect } from "react";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import { sound } from "@/lib/sound";
import {
  loadRelationshipsData,
  computeCountryFlows,
  getAllFlowCorridors,
  generateRelationshipsStats,
  getArmsTransfersForCountry,
  getSanctionsForCountry,
  getAidFlowsForCountry,
  formatMusd,
  getFlowColor,
  getFlowIcon,
  type CountryFlows,
  type FlowCorridor,
  type RelationshipsStats,
} from "@/lib/relationships";
import { useStore } from "@/stores/useStore";

export default function TheFlowsPage() {
  const { lang } = useStore();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<RelationshipsStats | null>(null);
  const [countryFlows, setCountryFlows] = useState<CountryFlows[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedCountryData, setSelectedCountryData] = useState<CountryFlows | null>(null);
  const [viewMode, setViewMode] = useState<"overview" | "arms" | "sanctions" | "aid">("overview");
  const [searchQuery, setSearchQuery] = useState("");

  const countryNames: Record<string, string> = {
    USA: "United States",
    RUS: "Russia",
    CHN: "China",
    DEU: "Germany",
    FRA: "France",
    GBR: "United Kingdom",
    IRN: "Iran",
    PRK: "North Korea",
    UKR: "Ukraine",
    ISR: "Israel",
    SAU: "Saudi Arabia",
    IND: "India",
    JPN: "Japan",
    AUS: "Australia",
    CAN: "Canada",
    KOR: "South Korea",
    // Add more as needed
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadRelationshipsData();
      const stats = generateRelationshipsStats(data);
      const flows = computeCountryFlows(data, countryNames);
      const corridors = getAllFlowCorridors(data);

      setStats(stats);
      setCountryFlows(flows);
      sound.success();
    } catch (error) {
      console.error("Failed to load relationships data:", error);
      sound.error();
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCountrySelect = useCallback((iso3: string) => {
    const country = countryFlows.find((c) => c.iso3 === iso3);
    if (country) {
      setSelectedCountry(iso3);
      setSelectedCountryData(country);
      sound.success();
    }
  }, [countryFlows]);

  const filteredFlows = countryFlows.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.iso3.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getFilteredCorridors = useCallback(() => {
    if (!stats) return [];
    const data = loadRelationshipsData().then(d => getAllFlowCorridors(d));
    // For now, return empty - would need to handle async properly
    return [];
  }, [stats]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-green-500 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <div className="animate-spin text-4xl">⏳</div>
            <h1 className="text-3xl font-bold">THE FLOWS</h1>
          </div>
          <p className="text-green-400">Loading relationship data...</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-black text-red-500 p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-4">⚠️ ERROR</h1>
          <p>Failed to load relationships data. Please try refreshing the page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-green-500 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="border-b border-green-900 pb-6">
          <div className="flex items-center gap-4 mb-4">
            <span className="text-4xl">🌐</span>
            <div>
              <h1 className="text-4xl font-bold">THE FLOWS</h1>
              <p className="text-green-400 text-sm mt-1">
                Arms Transfers • Sanctions Regimes • Aid Corridors
              </p>
            </div>
          </div>
          <p className="text-green-300 max-w-3xl">
            Track critical geopolitical relationships: arms transfers between states,
            sanctions regimes, and humanitarian aid flows. Data derived from SIPRI,
            UN/EU/US sanctions lists, and OECD DAC aid reporting.
          </p>
        </div>

        {/* View Mode Tabs */}
        <div className="flex gap-2 flex-wrap">
          {(["overview", "arms", "sanctions", "aid"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-4 py-2 border border-green-900 uppercase text-sm font-mono transition-colors ${
                viewMode === mode
                  ? "bg-green-900 text-black"
                  : "bg-black text-green-500 hover:bg-green-900 hover:text-black"
              }`}
            >
              {getFlowIcon(mode === "overview" ? "aid" : mode)} {mode}
            </button>
          ))}
        </div>

        {/* Overview Stats */}
        {viewMode === "overview" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <TerminalCard title="ARMS TRANSFERS" className="border-red-900">
              <div className="text-3xl font-bold text-red-500">{stats.totalArmsTransfers}</div>
              <div className="text-sm text-red-400 mt-1">total transfers</div>
              <div className="text-2xl font-bold text-red-400 mt-2">{formatMusd(stats.totalArmsValue)}</div>
              <div className="text-sm text-red-500">total value</div>
            </TerminalCard>

            <TerminalCard title="SANCTIONS" className="border-yellow-900">
              <div className="text-3xl font-bold text-yellow-500">{stats.totalSanctions}</div>
              <div className="text-sm text-yellow-400 mt-1">active regimes</div>
              <div className="text-lg text-yellow-300 mt-2">
                Top: {stats.mostSanctioned[0]?.iso3 || "N/A"} ({stats.mostSanctioned[0]?.count || 0})
              </div>
            </TerminalCard>

            <TerminalCard title="AID FLOWS" className="border-green-900">
              <div className="text-3xl font-bold text-green-500">{stats.totalAidFlows}</div>
              <div className="text-sm text-green-400 mt-1">total flows</div>
              <div className="text-2xl font-bold text-green-400 mt-2">{formatMusd(stats.totalAidValue)}</div>
              <div className="text-sm text-green-500">total value</div>
            </TerminalCard>

            <TerminalCard title="DATA SOURCES" className="border-blue-900">
              <div className="text-sm text-blue-300 space-y-1">
                <div>• SIPRI Arms Transfers</div>
                <div>• UN/EU/US Sanctions</div>
                <div>• OECD DAC Aid</div>
              </div>
              <div className="text-xs text-blue-400 mt-2">
                Values in millions USD (TIV-derived)
              </div>
            </TerminalCard>
          </div>
        )}

        {/* Top Rankings */}
        {viewMode === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Arms Suppliers */}
            <TerminalCard title="TOP ARMS SUPPLIERS" className="border-red-900">
              <div className="space-y-2">
                {stats.topArmsSuppliers.map((item, index) => (
                  <div key={item.iso3} className="flex items-center justify-between border-b border-red-900/30 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-red-500 font-mono">#{index + 1}</span>
                      <span className="font-mono">{item.iso3}</span>
                      <span className="text-sm text-red-400">{countryNames[item.iso3] || ""}</span>
                    </div>
                    <span className="text-red-400 font-mono">{formatMusd(item.value)}</span>
                  </div>
                ))}
              </div>
            </TerminalCard>

            {/* Top Aid Donors */}
            <TerminalCard title="TOP AID DONORS" className="border-green-900">
              <div className="space-y-2">
                {stats.topAidDonors.map((item, index) => (
                  <div key={item.iso3} className="flex items-center justify-between border-b border-green-900/30 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-green-500 font-mono">#{index + 1}</span>
                      <span className="font-mono">{item.iso3}</span>
                      <span className="text-sm text-green-400">{countryNames[item.iso3] || ""}</span>
                    </div>
                    <span className="text-green-400 font-mono">{formatMusd(item.value)}</span>
                  </div>
                ))}
              </div>
            </TerminalCard>
          </div>
        )}

        {/* Country Flows Table */}
        <TerminalCard title="COUNTRY FLOWS" className="border-green-900">
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search countries..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black border border-green-900 px-4 py-2 text-green-500 font-mono focus:outline-none focus:border-green-500"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-green-900">
                  <th className="text-left py-2 px-3 font-mono">ISO3</th>
                  <th className="text-left py-2 px-3">COUNTRY</th>
                  <th className="text-right py-2 px-3 text-red-500">ARMS IN</th>
                  <th className="text-right py-2 px-3 text-red-400">ARMS OUT</th>
                  <th className="text-right py-2 px-3 text-yellow-500">SANCTIONS IN</th>
                  <th className="text-right py-2 px-3 text-yellow-400">OUT</th>
                  <th className="text-right py-2 px-3 text-green-500">AID IN</th>
                  <th className="text-right py-2 px-3 text-green-400">AID OUT</th>
                </tr>
              </thead>
              <tbody>
                {filteredFlows.slice(0, 50).map((country) => (
                  <tr
                    key={country.iso3}
                    onClick={() => handleCountrySelect(country.iso3)}
                    className={`border-b border-green-900/30 cursor-pointer transition-colors ${
                      selectedCountry === country.iso3
                        ? "bg-green-900/20"
                        : "hover:bg-green-900/10"
                    }`}
                  >
                    <td className="py-2 px-3 font-mono">{country.iso3}</td>
                    <td className="py-2 px-3">{country.name}</td>
                    <td className="py-2 px-3 text-right text-red-500">
                      {country.armsReceived > 0 ? formatMusd(country.armsReceived) : "—"}
                    </td>
                    <td className="py-2 px-3 text-right text-red-400">
                      {country.armsSupplied > 0 ? formatMusd(country.armsSupplied) : "—"}
                    </td>
                    <td className="py-2 px-3 text-right text-yellow-500">
                      {country.sanctionsReceived > 0 ? country.sanctionsReceived : "—"}
                    </td>
                    <td className="py-2 px-3 text-right text-yellow-400">
                      {country.sanctionsImposed > 0 ? country.sanctionsImposed : "—"}
                    </td>
                    <td className="py-2 px-3 text-right text-green-500">
                      {country.aidReceived > 0 ? formatMusd(country.aidReceived) : "—"}
                    </td>
                    <td className="py-2 px-3 text-right text-green-400">
                      {country.aidProvided > 0 ? formatMusd(country.aidProvided) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredFlows.length > 50 && (
            <div className="text-center text-green-400 text-sm mt-4">
              Showing 50 of {filteredFlows.length} countries
            </div>
          )}
        </TerminalCard>

        {/* Country Detail View */}
        {selectedCountry && selectedCountryData && (
          <TerminalCard
            title={`COUNTRY DETAIL: ${selectedCountryData.name}`}
            className="border-blue-900"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <h3 className="text-red-500 font-mono mb-3">ARMS TRANSFERS</h3>
                <div className="space-y-2 text-sm">
                  <div>Received: {formatMusd(selectedCountryData.armsReceived)}</div>
                  <div>Supplied: {formatMusd(selectedCountryData.armsSupplied)}</div>
                  <div className="text-red-400">
                    Net Flow: {formatMusd(selectedCountryData.netArmsFlow)}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-yellow-500 font-mono mb-3">SANCTIONS</h3>
                <div className="space-y-2 text-sm">
                  <div>Received: {selectedCountryData.sanctionsReceived} regime(s)</div>
                  <div>Imposed: {selectedCountryData.sanctionsImposed} regime(s)</div>
                  <div className="text-yellow-400">
                    Total: {selectedCountryData.sanctionsReceived + selectedCountryData.sanctionsImposed}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-green-500 font-mono mb-3">AID FLOWS</h3>
                <div className="space-y-2 text-sm">
                  <div>Received: {formatMusd(selectedCountryData.aidReceived)}</div>
                  <div>Provided: {formatMusd(selectedCountryData.aidProvided)}</div>
                  <div className="text-green-400">
                    Net Flow: {formatMusd(selectedCountryData.netAidFlow)}
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setSelectedCountry(null);
                setSelectedCountryData(null);
              }}
              className="mt-6 px-4 py-2 border border-blue-900 text-blue-400 hover:bg-blue-900 hover:text-black transition-colors"
            >
              CLOSE DETAIL
            </button>
          </TerminalCard>
        )}

        {/* Data Sources Note */}
        <div className="text-center text-green-600 text-xs space-y-1">
          <div>Data sources: SIPRI Arms Transfers Database, UN Security Council Consolidated Sanctions List,</div>
          <div>EU Consolidated Financial Sanctions List, US OFAC Sanctions Programs, OECD DAC Aid (CRS) flows</div>
          <div className="text-green-700">Values are indicative approximations for visualization, not exact accounting</div>
        </div>
      </div>
    </div>
  );
}
