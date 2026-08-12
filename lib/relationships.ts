/**
 * V FOR X — Arms, Sanctions & Aid Relationships
 *
 * Processes and analyzes relationships between countries across three
 * critical dimensions: arms transfers, sanctions regimes, and aid flows.
 * Enables visualization of geopolitical corridors and dependencies.
 *
 * Data derived from:
 *   - SIPRI Arms Transfers Database (TIV-derived)
 *   - UN/EU/US sanctions lists
 *   - OECD DAC aid flows
 *
 * Storage: Static JSON at data/relationships.json
 */

/* ═══════════════════════════════════════════════════════════════
   Types
═══════════════════════════════════════════════════════════════ */

export interface ArmsTransfer {
  /** Supplier country ISO3 code */
  source_iso3: string;
  /** Recipient country ISO3 code */
  target_iso3: string;
  /** Value in millions USD (TIV-derived approximation) */
  value_musd: number;
  /** Category of equipment */
  category: string;
}

export interface Sanction {
  /** Imposing country/entity ISO3 code */
  imposer_iso3: string;
  /** Target country ISO3 code */
  target_iso3: string;
  /** Type of sanctions */
  type: SanctionType;
}

export type SanctionType =
  | "comprehensive"
  | "sectoral"
  | "arms embargo"
  | "entity / tech"
  | "nuclear / missile"
  | "proliferation"
  | "taliban / counterterrorism";

export interface AidFlow {
  /** Donor country ISO3 code */
  donor_iso3: string;
  /** Recipient country ISO3 code */
  recipient_iso3: string;
  /** Amount in millions USD */
  amount_musd: number;
}

export interface RelationshipsData {
  meta: {
    title: string;
    description: string;
    sources: string[];
    note: string;
  };
  arms_transfers: ArmsTransfer[];
  sanctions: Sanction[];
  aid_flows: AidFlow[];
}

/* ═══════════════════════════════════════════════════════════════
   Derived Types
═══════════════════════════════════════════════════════════════ */

export interface CountryFlows {
  iso3: string;
  name: string;
  /** Arms received (total M USD) */
  armsReceived: number;
  /** Arms supplied (total M USD) */
  armsSupplied: number;
  /** Sanctions imposed */
  sanctionsImposed: number;
  /** Sanctions received */
  sanctionsReceived: number;
  /** Aid received (total M USD) */
  aidReceived: number;
  /** Aid provided (total M USD) */
  aidProvided: number;
  /** Net arms flow (received - supplied) */
  netArmsFlow: number;
  /** Net aid flow (received - provided) */
  netAidFlow: number;
}

export interface FlowCorridor {
  from: string;
  to: string;
  type: "arms" | "sanctions" | "aid";
  value: number;
  category?: string;
}

export interface RelationshipsStats {
  totalArmsTransfers: number;
  totalArmsValue: number;
  totalSanctions: number;
  totalAidFlows: number;
  totalAidValue: number;
  topArmsSuppliers: Array<{ iso3: string; value: number }>;
  topArmsRecipients: Array<{ iso3: string; value: number }>;
  topAidDonors: Array<{ iso3: string; value: number }>;
  topAidRecipients: Array<{ iso3: string; value: number }>;
  mostSanctioned: Array<{ iso3: string; count: number }>;
}

/* ═══════════════════════════════════════════════════════════════
   Data Loading
═══════════════════════════════════════════════════════════════ */

let cachedData: RelationshipsData | null = null;

/**
 * Load relationships data from static JSON.
 * Cached in memory for subsequent calls.
 */
export async function loadRelationshipsData(): Promise<RelationshipsData> {
  if (cachedData) return cachedData;

  try {
    const response = await fetch("/api/v1/relationships.json");
    if (!response.ok) {
      throw new Error(`Failed to load relationships data: ${response.statusText}`);
    }
    cachedData = await response.json();
    return cachedData!;
  } catch (error) {
    console.error("Error loading relationships data:", error);
    // Return empty structure on error
    return {
      meta: {
        title: "Global Relationship Graph",
        description: "",
        sources: [],
        note: "",
      },
      arms_transfers: [],
      sanctions: [],
      aid_flows: [],
    };
  }
}

/**
 * Clear cached data (useful for testing or refresh).
 */
export function clearRelationshipsCache(): void {
  cachedData = null;
}

/* ═══════════════════════════════════════════════════════════════
   Arms Transfers
═══════════════════════════════════════════════════════════════ */

/**
 * Get all arms transfers for a specific country (as supplier or recipient).
 */
export function getArmsTransfersForCountry(
  data: RelationshipsData,
  iso3: string,
): ArmsTransfer[] {
  return data.arms_transfers.filter(
    (t) => t.source_iso3 === iso3 || t.target_iso3 === iso3,
  );
}

/**
 * Get arms transfers where country is supplier.
 */
export function getArmsSupplied(data: RelationshipsData, iso3: string): ArmsTransfer[] {
  return data.arms_transfers.filter((t) => t.source_iso3 === iso3);
}

/**
 * Get arms transfers where country is recipient.
 */
export function getArmsReceived(data: RelationshipsData, iso3: string): ArmsTransfer[] {
  return data.arms_transfers.filter((t) => t.target_iso3 === iso3);
}

/**
 * Calculate total arms value supplied by a country.
 */
export function getTotalArmsSupplied(data: RelationshipsData, iso3: string): number {
  return getArmsSupplied(data, iso3).reduce((sum, t) => sum + t.value_musd, 0);
}

/**
 * Calculate total arms value received by a country.
 */
export function getTotalArmsReceived(data: RelationshipsData, iso3: string): number {
  return getArmsReceived(data, iso3).reduce((sum, t) => sum + t.value_musd, 0);
}

/**
 * Get top arms suppliers ranked by total value.
 */
export function getTopArmsSuppliers(data: RelationshipsData, limit = 10): Array<{ iso3: string; value: number }> {
  const totals: Record<string, number> = {};
  for (const t of data.arms_transfers) {
    totals[t.source_iso3] = (totals[t.source_iso3] || 0) + t.value_musd;
  }
  return Object.entries(totals)
    .map(([iso3, value]) => ({ iso3, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

/**
 * Get top arms recipients ranked by total value.
 */
export function getTopArmsRecipients(data: RelationshipsData, limit = 10): Array<{ iso3: string; value: number }> {
  const totals: Record<string, number> = {};
  for (const t of data.arms_transfers) {
    totals[t.target_iso3] = (totals[t.target_iso3] || 0) + t.value_musd;
  }
  return Object.entries(totals)
    .map(([iso3, value]) => ({ iso3, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

/* ═══════════════════════════════════════════════════════════════
   Sanctions
═══════════════════════════════════════════════════════════════ */

/**
 * Get all sanctions for a country (as imposer or target).
 */
export function getSanctionsForCountry(data: RelationshipsData, iso3: string): Sanction[] {
  return data.sanctions.filter(
    (s) => s.imposer_iso3 === iso3 || s.target_iso3 === iso3,
  );
}

/**
 * Get sanctions imposed by a country.
 */
export function getSanctionsImposed(data: RelationshipsData, iso3: string): Sanction[] {
  return data.sanctions.filter((s) => s.imposer_iso3 === iso3);
}

/**
 * Get sanctions received by a country.
 */
export function getSanctionsReceived(data: RelationshipsData, iso3: string): Sanction[] {
  return data.sanctions.filter((s) => s.target_iso3 === iso3);
}

/**
 * Get most sanctioned countries ranked by count.
 */
export function getMostSanctioned(data: RelationshipsData, limit = 10): Array<{ iso3: string; count: number }> {
  const counts: Record<string, number> = {};
  for (const s of data.sanctions) {
    counts[s.target_iso3] = (counts[s.target_iso3] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([iso3, count]) => ({ iso3, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Check if a specific sanction relationship exists.
 */
export function hasSanction(data: RelationshipsData, imposer: string, target: string): boolean {
  return data.sanctions.some(
    (s) => s.imposer_iso3 === imposer && s.target_iso3 === target,
  );
}

/* ═══════════════════════════════════════════════════════════════
   Aid Flows
═══════════════════════════════════════════════════════════════ */

/**
 * Get all aid flows for a country (as donor or recipient).
 */
export function getAidFlowsForCountry(data: RelationshipsData, iso3: string): AidFlow[] {
  return data.aid_flows.filter(
    (f) => f.donor_iso3 === iso3 || f.recipient_iso3 === iso3,
  );
}

/**
 * Get aid provided by a country.
 */
export function getAidProvided(data: RelationshipsData, iso3: string): AidFlow[] {
  return data.aid_flows.filter((f) => f.donor_iso3 === iso3);
}

/**
 * Get aid received by a country.
 */
export function getAidReceived(data: RelationshipsData, iso3: string): AidFlow[] {
  return data.aid_flows.filter((f) => f.recipient_iso3 === iso3);
}

/**
 * Calculate total aid provided by a country.
 */
export function getTotalAidProvided(data: RelationshipsData, iso3: string): number {
  return getAidProvided(data, iso3).reduce((sum, f) => sum + f.amount_musd, 0);
}

/**
 * Calculate total aid received by a country.
 */
export function getTotalAidReceived(data: RelationshipsData, iso3: string): number {
  return getAidReceived(data, iso3).reduce((sum, f) => sum + f.amount_musd, 0);
}

/**
 * Get top aid donors ranked by total value.
 */
export function getTopAidDonors(data: RelationshipsData, limit = 10): Array<{ iso3: string; value: number }> {
  const totals: Record<string, number> = {};
  for (const f of data.aid_flows) {
    totals[f.donor_iso3] = (totals[f.donor_iso3] || 0) + f.amount_musd;
  }
  return Object.entries(totals)
    .map(([iso3, value]) => ({ iso3, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

/**
 * Get top aid recipients ranked by total value.
 */
export function getTopAidRecipients(data: RelationshipsData, limit = 10): Array<{ iso3: string; value: number }> {
  const totals: Record<string, number> = {};
  for (const f of data.aid_flows) {
    totals[f.recipient_iso3] = (totals[f.recipient_iso3] || 0) + f.amount_musd;
  }
  return Object.entries(totals)
    .map(([iso3, value]) => ({ iso3, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

/* ═══════════════════════════════════════════════════════════════
   Composite Analysis
═══════════════════════════════════════════════════════════════ */

/**
 * Compute comprehensive flow statistics for all countries.
 */
export function computeCountryFlows(
  data: RelationshipsData,
  countryNames: Record<string, string>,
): CountryFlows[] {
  const allCountries = new Set<string>();

  // Collect all unique countries
  for (const t of data.arms_transfers) {
    allCountries.add(t.source_iso3);
    allCountries.add(t.target_iso3);
  }
  for (const s of data.sanctions) {
    allCountries.add(s.imposer_iso3);
    allCountries.add(s.target_iso3);
  }
  for (const f of data.aid_flows) {
    allCountries.add(f.donor_iso3);
    allCountries.add(f.recipient_iso3);
  }

  return Array.from(allCountries).map((iso3) => {
    const armsReceived = getTotalArmsReceived(data, iso3);
    const armsSupplied = getTotalArmsSupplied(data, iso3);
    const sanctionsReceived = getSanctionsReceived(data, iso3).length;
    const sanctionsImposed = getSanctionsImposed(data, iso3).length;
    const aidReceived = getTotalAidReceived(data, iso3);
    const aidProvided = getTotalAidProvided(data, iso3);

    return {
      iso3,
      name: countryNames[iso3] || iso3,
      armsReceived,
      armsSupplied,
      sanctionsImposed,
      sanctionsReceived,
      aidReceived,
      aidProvided,
      netArmsFlow: armsReceived - armsSupplied,
      netAidFlow: aidReceived - aidProvided,
    };
  }).sort((a, b) => {
    // Sort by total activity (arms + sanctions + aid)
    const totalA = a.armsReceived + a.armsSupplied + a.aidReceived + a.aidProvided +
                   a.sanctionsImposed + a.sanctionsReceived;
    const totalB = b.armsReceived + b.armsSupplied + b.aidReceived + b.aidProvided +
                   b.sanctionsImposed + b.sanctionsReceived;
    return totalB - totalA;
  });
}

/**
 * Get all flow corridors for visualization.
 */
export function getAllFlowCorridors(data: RelationshipsData): FlowCorridor[] {
  const corridors: FlowCorridor[] = [];

  // Arms corridors
  for (const t of data.arms_transfers) {
    corridors.push({
      from: t.source_iso3,
      to: t.target_iso3,
      type: "arms",
      value: t.value_musd,
      category: t.category,
    });
  }

  // Sanctions (value = 1 for binary representation)
  for (const s of data.sanctions) {
    corridors.push({
      from: s.imposer_iso3,
      to: s.target_iso3,
      type: "sanctions",
      value: 1,
      category: s.type,
    });
  }

  // Aid corridors
  for (const f of data.aid_flows) {
    corridors.push({
      from: f.donor_iso3,
      to: f.recipient_iso3,
      type: "aid",
      value: f.amount_musd,
    });
  }

  return corridors;
}

/**
 * Generate comprehensive statistics.
 */
export function generateRelationshipsStats(data: RelationshipsData): RelationshipsStats {
  return {
    totalArmsTransfers: data.arms_transfers.length,
    totalArmsValue: data.arms_transfers.reduce((sum, t) => sum + t.value_musd, 0),
    totalSanctions: data.sanctions.length,
    totalAidFlows: data.aid_flows.length,
    totalAidValue: data.aid_flows.reduce((sum, f) => sum + f.amount_musd, 0),
    topArmsSuppliers: getTopArmsSuppliers(data, 5),
    topArmsRecipients: getTopArmsRecipients(data, 5),
    topAidDonors: getTopAidDonors(data, 5),
    topAidRecipients: getTopAidRecipients(data, 5),
    mostSanctioned: getMostSanctioned(data, 5),
  };
}

/* ═══════════════════════════════════════════════════════════════
   Formatting & Display
═══════════════════════════════════════════════════════════════ */

/**
 * Format value in millions USD for display.
 */
export function formatMusd(value: number): string {
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}B`;
  }
  return `$${value.toFixed(0)}M`;
}

/**
 * Get color for flow type.
 */
export function getFlowColor(type: "arms" | "sanctions" | "aid"): string {
  switch (type) {
    case "arms":
      return "var(--color-blood-dim)";
    case "sanctions":
      return "var(--color-warning-amber)";
    case "aid":
      return "var(--color-terminal-green)";
  }
}

/**
 * Get icon/emoji for flow type.
 */
export function getFlowIcon(type: "arms" | "sanctions" | "aid"): string {
  switch (type) {
    case "arms":
      return "🔫";
    case "sanctions":
      return "⚖️";
    case "aid":
      return "🏥";
  }
}

/* ═══════════════════════════════════════════════════════════════
   Sovereignty friction matrix
   (Phase 26 B — Quantum P2P Squad adaptation)
   ═══════════════════════════════════════════════════════════════ */

/** Friction verdict for a directed ISO3-A → ISO3-B corridor. */
export type FrictionLevel = "clean" | "risk" | "blocked";

export interface SovereigntyFriction {
  /** Directed corridor A→B. */
  from: string;
  /** Directed corridor A→B. */
  to: string;
  /** clean / risk / blocked. */
  level: FrictionLevel;
  /** Weight damping factor: clean=1, risk=0.5, blocked=0. */
  multiplier: number;
  /** Human-readable why (sanction / arms-asymmetry / override / ally). */
  reasons: string[];
  /** True when an override row forced the verdict. */
  overridden: boolean;
}

/** Multiplier applied per friction level when damping a roster/mesh weight. */
export const FRICTION_MULTIPLIER: Record<FrictionLevel, number> = {
  clean: 1,
  risk: 0.5,
  blocked: 0,
};

/** Arms-corridor value (M USD) above which a directed corridor reads as "risk". */
const ARMS_ASYMMETRY_THRESHOLD_MUSD = 500;

/** Normalize an ISO3 code for lookup. */
function normIso3(code: string): string {
  return (code ?? "").trim().toUpperCase();
}

let cachedOverrides: Record<string, { level: FrictionLevel; reason: string }> | null =
  null;

/**
 * Load the static sovereignty-friction override table once. The table is a
 * curated set of directed corridors ("USA>IRN") with a clean/risk/blocked
 * verdict; sovereigntyFriction() prefers it over the derived heuristic.
 */
export function loadFrictionOverrides(
  raw: unknown,
): Record<string, { level: FrictionLevel; reason: string }> {
  if (raw && typeof raw === "object") {
    const obj = raw as { overrides?: Record<string, unknown> };
    if (obj.overrides && typeof obj.overrides === "object") {
      cachedOverrides = obj.overrides as Record<string, {
        level: FrictionLevel;
        reason: string;
      }>;
      return cachedOverrides;
    }
  }
  cachedOverrides = {};
  return cachedOverrides;
}

/** Clear cached overrides (tests / refresh). */
export function clearFrictionOverrides(): void {
  cachedOverrides = null;
}

/** Look up a directed override row, if any. */
function lookupOverride(
  a: string,
  b: string,
): { level: FrictionLevel; reason: string } | null {
  const table = cachedOverrides ?? loadFrictionOverrides(DEFAULT_FRICTION_OVERRIDES);
  return table[`${a}>${b}`] ?? null;
}

/** Default override table bundled with the lib (data/sovereignty-friction.json mirror). */
export const DEFAULT_FRICTION_OVERRIDES = {
  overrides: {
    "USA>IRN": { level: "blocked" as FrictionLevel, reason: "comprehensive US sanctions on Iran" },
    "IRN>USA": { level: "blocked" as FrictionLevel, reason: "comprehensive Iran sanctions regime" },
    "USA>CUB": { level: "blocked" as FrictionLevel, reason: "US embargo on Cuba" },
    "CUB>USA": { level: "blocked" as FrictionLevel, reason: "US embargo on Cuba (reciprocal)" },
    "USA>PRK": { level: "blocked" as FrictionLevel, reason: "comprehensive US sanctions on DPRK" },
    "PRK>USA": { level: "blocked" as FrictionLevel, reason: "comprehensive DPRK sanctions regime" },
    "USA>RUS": { level: "blocked" as FrictionLevel, reason: "post-2022 sanctions regime" },
    "RUS>USA": { level: "blocked" as FrictionLevel, reason: "reciprocal sanctions regime" },
    "RUS>UKR": { level: "blocked" as FrictionLevel, reason: "active invasion corridor" },
    "UKR>RUS": { level: "blocked" as FrictionLevel, reason: "active invasion corridor" },
  },
};

/**
 * Sovereignty friction for a directed corridor A→B.
 *
 * Verdict is derived from sanctions + arms-corridor asymmetry and damped by
 * the static override table. Friction *damps* a weight (multiplier), it never
 * hard-fails a route — matching the squads model (clean/risk/blocked →
 * multiplier, not filter). Callers decide whether multiplier===0 is a skip.
 *
 * Precedence: override > sanctions (either direction) > arms asymmetry > clean.
 */
export function sovereigntyFriction(
  data: RelationshipsData,
  iso3A: string,
  iso3B: string,
): SovereigntyFriction {
  const a = normIso3(iso3A);
  const b = normIso3(iso3B);
  if (!a || !b) {
    return { from: a, to: b, level: "clean", multiplier: FRICTION_MULTIPLIER.clean, reasons: ["missing iso3"], overridden: false };
  }
  if (a === b) {
    return { from: a, to: b, level: "clean", multiplier: FRICTION_MULTIPLIER.clean, reasons: ["same country"], overridden: false };
  }

  const reasons: string[] = [];

  // 1. Override table wins.
  const override = lookupOverride(a, b);
  if (override) {
    return {
      from: a,
      to: b,
      level: override.level,
      multiplier: FRICTION_MULTIPLIER[override.level],
      reasons: [override.reason],
      overridden: true,
    };
  }

  // 2. Sanction either direction → blocked.
  if (hasSanction(data, a, b) || hasSanction(data, b, a)) {
    reasons.push("active sanctions regime");
    return { from: a, to: b, level: "blocked", multiplier: FRICTION_MULTIPLIER.blocked, reasons, overridden: false };
  }

  // 3. Arms-corridor asymmetry → risk. A heavy one-way arms flow signals a
  //    sovereignty incompatibility even without a formal sanctions regime.
  const supplied = getTotalArmsSupplied(data, a);
  const received = getTotalArmsReceived(data, b);
  const aToB = data.arms_transfers
    .filter((t) => normIso3(t.source_iso3) === a && normIso3(t.target_iso3) === b)
    .reduce((sum, t) => sum + (t.value_musd || 0), 0);
  const bToA = data.arms_transfers
    .filter((t) => normIso3(t.source_iso3) === b && normIso3(t.target_iso3) === a)
    .reduce((sum, t) => sum + (t.value_musd || 0), 0);
  if (aToB >= ARMS_ASYMMETRY_THRESHOLD_MUSD && bToA < aToB * 0.1) {
    reasons.push(`arms-corridor asymmetry (A→B $${aToB.toFixed(0)}M vs B→A $${bToA.toFixed(0)}M)`);
  }
  // High general arms posture on either side also reads as risk.
  if (supplied >= ARMS_ASYMMETRY_THRESHOLD_MUSD || received >= ARMS_ASYMMETRY_THRESHOLD_MUSD) {
    if (reasons.length === 0) reasons.push("heavy arms posture on corridor endpoint");
  }

  if (reasons.length > 0) {
    return { from: a, to: b, level: "risk", multiplier: FRICTION_MULTIPLIER.risk, reasons, overridden: false };
  }

  return { from: a, to: b, level: "clean", multiplier: FRICTION_MULTIPLIER.clean, reasons: ["no friction signal"], overridden: false };
}
