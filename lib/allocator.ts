/**
 * V FOR X — Budget Allocator Simulator
 *
 * Lets users allocate a hypothetical budget across real intervention areas.
 * All costs and reach figures come from world_backbone.json sdg_equations.
 */

export interface BudgetItem {
  id: string;
  sdg: string;
  label: string;
  color: string;
  fullCostB: number; // full annual cost in $B
  reachFullM: number; // total people reached at full funding (millions)
  unit: string;
  description: string;
  metricLabel: string; // what the reach represents
}

export const BUDGET_ITEMS: BudgetItem[] = [
  {
    id: "sdg2_hunger",
    sdg: "SDG 2",
    label: "Zero Hunger",
    color: "#e10600",
    fullCostB: 93,
    reachFullM: 667,
    unit: "M",
    description: "End undernourishment for 667M people. School feeding, smallholder agriculture, emergency aid.",
    metricLabel: "people lifted from undernourishment",
  },
  {
    id: "sdg6_water",
    sdg: "SDG 6",
    label: "Water & Sanitation",
    color: "#00ddff",
    fullCostB: 114,
    reachFullM: 2000,
    unit: "M",
    description: "Safe water and sanitation for 2B people. Rural piped systems, treatment, hygiene.",
    metricLabel: "people gaining safe water access",
  },
  {
    id: "sdg3_health",
    sdg: "SDG 3",
    label: "Healthcare Access",
    color: "#ff4444",
    fullCostB: 176,
    reachFullM: 2000,
    unit: "M",
    description: "Train health workers, build clinics, provide essential medicines for 2B people.",
    metricLabel: "people gaining healthcare access",
  },
  {
    id: "sdg7_energy",
    sdg: "SDG 7",
    label: "Energy Access",
    color: "#ffaa00",
    fullCostB: 35,
    reachFullM: 524,
    unit: "M",
    description: "Electrify the planet. Mini-grid solar, grid extension, clean cooking for 524M.",
    metricLabel: "people gaining electricity access",
  },
  {
    id: "sdg4_education",
    sdg: "SDG 4",
    label: "Education",
    color: "#00ff41",
    fullCostB: 97,
    reachFullM: 773,
    unit: "M",
    description: "Universal schooling, teacher training, adult literacy for 773M.",
    metricLabel: "people gaining quality education",
  },
  {
    id: "sdg10_inequality",
    sdg: "SDG 10",
    label: "Inequality Reduction",
    color: "#aa44ff",
    fullCostB: 313,
    reachFullM: 4000,
    unit: "M",
    description: "Social protection floors, debt cancellation, progressive tax reform reaching 4B.",
    metricLabel: "people lifted from poverty",
  },
];

export const TOTAL_FULL_COST = BUDGET_ITEMS.reduce((s, i) => s + i.fullCostB, 0); // 828
export const QUICK_WINS_TOTAL = 422; // water + health + energy + education
export const MILITARY_PER_DAY_B = 6.6;
export const WORLD_MILITARY_TRILLION = 2.41;

export interface AllocationResult {
  item: BudgetItem;
  allocatedB: number;
  fundedPct: number; // 0-100
  reachM: number;
}

export interface BudgetResult {
  allocations: AllocationResult[];
  totalAllocatedB: number;
  totalReachM: number;
  daysOfMilitary: number;
  pctMilitary: number;
  pctWorldGdp: number;
  fullyFundedCount: number;
  partiallyFundedCount: number;
  unfundedCount: number;
}

export function calculateAllocation(
  allocations: Record<string, number>
): BudgetResult {
  const results: AllocationResult[] = BUDGET_ITEMS.map((item) => {
    const allocatedB = allocations[item.id] ?? 0;
    const fundedPct = item.fullCostB > 0 ? Math.min(100, (allocatedB / item.fullCostB) * 100) : 0;
    const reachM = item.fullCostB > 0 ? (allocatedB / item.fullCostB) * item.reachFullM : 0;
    return { item, allocatedB, fundedPct, reachM };
  });

  const totalAllocatedB = results.reduce((s, r) => s + r.allocatedB, 0);
  const totalReachM = results.reduce((s, r) => s + r.reachM, 0);
  const daysOfMilitary = totalAllocatedB / MILITARY_PER_DAY_B;
  const pctMilitary = (totalAllocatedB / (WORLD_MILITARY_TRILLION * 1000)) * 100;
  const pctWorldGdp = (totalAllocatedB / (106.7 * 1000)) * 100;

  const fullyFundedCount = results.filter((r) => r.fundedPct >= 99.5).length;
  const partiallyFundedCount = results.filter((r) => r.fundedPct > 0.5 && r.fundedPct < 99.5).length;
  const unfundedCount = results.filter((r) => r.fundedPct <= 0.5).length;

  return {
    allocations: results,
    totalAllocatedB,
    totalReachM,
    daysOfMilitary,
    pctMilitary,
    pctWorldGdp,
    fullyFundedCount,
    partiallyFundedCount,
    unfundedCount,
  };
}

export const PRESETS: { label: string; desc: string; allocations: Record<string, number> }[] = [
  {
    label: "RECOMMENDED ($93B)",
    desc: "The hunger-only plan — the minimal viable humanity",
    allocations: { sdg2_hunger: 93, sdg6_water: 0, sdg3_health: 0, sdg7_energy: 0, sdg4_education: 0, sdg10_inequality: 0 },
  },
  {
    label: "QUICK WINS ($422B)",
    desc: "Water + health + energy + education for everyone",
    allocations: { sdg2_hunger: 93, sdg6_water: 114, sdg3_health: 176, sdg7_energy: 35, sdg4_education: 97, sdg10_inequality: 0 },
  },
  {
    label: "FULL TRANSITION ($828B)",
    desc: "Everything. 34% of military spending solves all six.",
    allocations: { sdg2_hunger: 93, sdg6_water: 114, sdg3_health: 176, sdg7_energy: 35, sdg4_education: 97, sdg10_inequality: 313 },
  },
  {
    label: "ONE WEEK OF WAR ($46B)",
    desc: "7 days of global military spending — what could it buy?",
    allocations: { sdg2_hunger: 23, sdg6_water: 0, sdg3_health: 0, sdg7_energy: 0, sdg4_education: 0, sdg10_inequality: 23 },
  },
];
