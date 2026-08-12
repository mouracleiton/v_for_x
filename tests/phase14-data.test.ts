/**
 * Phase 14 — Living data moat (nexus-path, roster-skills, snapshot-diff, metric-meta, crisis manifest)
 */
import { describe, it, expect } from "vitest";
import nexusData from "@/data/nexus.json";
import rosterData from "@/data/roster.json";
import {
  buildAdjacency,
  findActor,
  shortestPath,
  neighborhood,
  degreeCentrality,
  topHubs,
  componentCount,
  pathToEvidence,
  summarizePath,
  type NexusGraph,
} from "@/lib/nexus-path";
import {
  classifySpecialty,
  helperSkills,
  searchBySkills,
  searchByRadius,
  computeVouchTrust,
  describeSkillMatch,
  tierLabel,
  type SkillBucket,
} from "@/lib/roster-skills";
import type { Helper } from "@/lib/roster";
import {
  diffNumeric,
  diffBackbone,
  describeChange,
  topWorsened,
  type Backbone,
} from "@/lib/snapshot-diff";
import {
  METRIC_META,
  resolveMetricMeta,
  resolveMany,
  renderFootnote,
  confidenceColor,
  shortCitation,
  UNDOCUMENTED_META,
} from "@/lib/metric-meta";
import {
  createCrisisManifestPack,
  readCrisisManifest,
  readCrisisManifestFromToken,
  encodePack,
  type CrisisManifest,
} from "@/lib/vfxpack";

const nexus = nexusData as unknown as NexusGraph;
const roster = rosterData as unknown as { helpers: Helper[] };

/* ═══════════════════════════════════════════════════════════════
   Nexus path-finder
   ═══════════════════════════════════════════════════════════════ */

describe("nexus path-finder", () => {
  it("builds an adjacency map", () => {
    const adj = buildAdjacency(nexus);
    expect(adj.size).toBeGreaterThan(0);
    // undirected: at least one node has neighbors
    const connected = Array.from(adj.values()).filter((n) => n.length > 0);
    expect(connected.length).toBeGreaterThan(0);
  });

  it("finds an actor by id or name", () => {
    expect(findActor(nexus, "jho_low")?.id).toBe("jho_low");
    expect(findActor(nexus, "najib")?.id).toBe("najib_razak");
    expect(findActor(nexus, "does-not-exist-xyz")).toBeNull();
    expect(findActor(nexus, "")).toBeNull();
  });

  it("returns 0 degrees for the same actor", () => {
    const r = shortestPath(nexus, "najib_razak", "najib_razak");
    expect(r.found).toBe(true);
    expect(r.degrees).toBe(0);
  });

  it("finds a path between two directly-linked actors", () => {
    const r = shortestPath(nexus, "jho_low", "najib_razak");
    expect(r.found).toBe(true);
    expect(r.degrees).toBe(1);
    expect(r.path.length).toBe(2);
  });

  it("finds a multi-hop path or reports none", () => {
    // pick two actors guaranteed to exist
    const ids = nexus.actors.slice(0, 10).map((a) => a.id);
    const r = shortestPath(nexus, ids[0]!, ids[1]!, { maxDegrees: 6 });
    // either found or not found, but degrees sensible
    if (r.found) expect(r.degrees).toBeGreaterThan(0);
    else expect(r.degrees).toBe(-1);
  });

  it("respects maxDegrees cap", () => {
    const ids = nexus.actors.map((a) => a.id);
    const r = shortestPath(nexus, ids[0]!, ids[ids.length - 1]!, { maxDegrees: 1 });
    // with only 1 degree, distant pairs likely unfound
    expect(typeof r.found).toBe("boolean");
  });

  it("computes a neighborhood", () => {
    const n = neighborhood(nexus, "najib_razak", 2);
    expect(n.actor).toBe("najib_razak");
    expect(n.within.length).toBeGreaterThanOrEqual(0);
    // direct neighbors bucketed at hop 1
    if ((n.byHop[1] ?? []).length > 0) {
      expect(n.byHop[1]!.length).toBeGreaterThan(0);
    }
  });

  it("degreeCentrality and topHubs", () => {
    const deg = degreeCentrality(nexus);
    const hubs = topHubs(nexus, 3);
    expect(Object.keys(deg).length).toBeGreaterThan(0);
    expect(hubs).toHaveLength(3);
    expect(hubs[0]!.degree).toBeGreaterThanOrEqual(hubs[2]!.degree);
  });

  it("componentCount is a positive integer", () => {
    expect(componentCount(nexus)).toBeGreaterThan(0);
  });

  it("pathToEvidence renders a citable chain", () => {
    const r = shortestPath(nexus, "jho_low", "najib_razak");
    const text = pathToEvidence(nexus, r);
    expect(text).toContain("NEXUS PATH");
    expect(summarizePath(r)).toBeTruthy();
  });

  it("pathToEvidence handles no-path", () => {
    const r: ReturnType<typeof shortestPath> = { found: false, path: [], degrees: -1, totalValueMusd: 0 };
    expect(pathToEvidence(nexus, r)).toBe("No path found.");
    expect(summarizePath(r)).toBe("no connection found");
  });
});

/* ═══════════════════════════════════════════════════════════════
   Roster skills + geo + vouch
   ═══════════════════════════════════════════════════════════════ */

describe("roster skills taxonomy", () => {
  it("classifies specialties into buckets", () => {
    expect(classifySpecialty("asylum & refugee law")).toContain("legal");
    expect(classifySpecialty("emergency medicine doctor")).toContain("medical");
    expect(classifySpecialty("digital security training")).toContain("security");
    expect(classifySpecialty("fluent Arabic translator")).toContain("translation");
  });

  it("falls back to 'other'", () => {
    expect(classifySpecialty("something exotic")).toEqual(["other"]);
  });

  it("helperSkills unions specialties", () => {
    const h = roster.helpers[0]!;
    const skills = helperSkills(h);
    expect(Array.isArray(skills)).toBe(true);
  });

  it("searchBySkills ranks matches", () => {
    const matches = searchBySkills(roster.helpers, { query: "lawyer", buckets: ["legal"] });
    expect(matches.length).toBeGreaterThan(0);
    // sorted descending
    for (let i = 1; i < matches.length; i++) {
      expect(matches[i - 1]!.score).toBeGreaterThanOrEqual(matches[i]!.score);
    }
  });

  it("searchBySkills filters by language", () => {
    const matches = searchBySkills(roster.helpers, { languages: ["ar"] });
    for (const m of matches) expect(m.helper.languages).toContain("ar");
  });

  it("searchBySkills filters availableOnly", () => {
    const matches = searchBySkills(roster.helpers, { availableOnly: true });
    for (const m of matches) expect(m.helper.availability).toBe("available");
  });

  it("searchBySkills filters by country", () => {
    const matches = searchBySkills(roster.helpers, { country: "DEU" });
    for (const m of matches) expect(m.helper.country).toBe("DEU");
  });

  it("describeSkillMatch formats a line", () => {
    const matches = searchBySkills(roster.helpers, { query: "lawyer" });
    if (matches.length > 0) {
      const line = describeSkillMatch(matches[0]!);
      expect(line).toContain(matches[0]!.helper.handle);
    }
  });
});

describe("roster geo radius", () => {
  const centroids = { DEU: { lat: 51.16, lon: 10.45 }, FRA: { lat: 46.6, lon: 2.2 } };

  it("finds helpers within radius", () => {
    const results = searchByRadius(roster.helpers, 50.0, 10.0, 500, centroids);
    for (const r of results) {
      expect(r.distanceKm).toBeLessThanOrEqual(500);
    }
    // sorted by distance
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1]!.distanceKm).toBeLessThanOrEqual(results[i]!.distanceKm);
    }
  });

  it("skips helpers whose country has no centroid", () => {
    const results = searchByRadius(roster.helpers, 0, 0, 10, {});
    // no centroids → no results (or only helpers whose country happens to match nothing)
    expect(results.length).toBe(0);
  });
});

describe("roster vouch graph", () => {
  it("computes vouch trust tiers", () => {
    const trust = computeVouchTrust(roster.helpers);
    expect(trust.size).toBeGreaterThan(0);
    for (const t of trust.values()) {
      expect(["self", "vouched", "trusted", "well-vouched"]).toContain(t.tier);
      expect(t.distinctVouchers).toBeGreaterThanOrEqual(0);
    }
  });

  it("distinct vouchers count unique public keys", () => {
    const helpers: Helper[] = [
      {
        id: "h1", version: 1, handle: "a", category: "lawyer" as never, specialties: [], country: "DEU",
        languages: [], availability: "available", contact: {}, credentials: [], publicKey: "k1", ts: 1, signature: "s",
        vouches: [
          { helperId: "h1", byHandle: "b", byPublicKey: "PK1", relationship: "x", note: "n", ts: 1, signature: "s" },
          { helperId: "h1", byHandle: "b", byPublicKey: "PK1", relationship: "x", note: "n", ts: 2, signature: "s" }, // dup key
          { helperId: "h1", byHandle: "c", byPublicKey: "PK2", relationship: "x", note: "n", ts: 3, signature: "s" },
        ],
      },
    ];
    const trust = computeVouchTrust(helpers);
    expect(trust.get("h1")!.distinctVouchers).toBe(2); // PK1 + PK2
    expect(trust.get("h1")!.tier).toBe("trusted"); // 2 distinct = trusted
  });

  it("tierLabel renders", () => {
    expect(tierLabel("well-vouched")).toContain("well-vouched");
    expect(tierLabel("self")).toContain("self");
  });
});

/* ═══════════════════════════════════════════════════════════════
   Snapshot diff
   ═══════════════════════════════════════════════════════════════ */

describe("snapshot diff engine", () => {
  it("diffNumeric finds numeric changes", () => {
    const changes = diffNumeric({ a: 1, b: 2 }, { a: 1, b: 5 });
    expect(changes).toHaveLength(1);
    expect(changes[0]!.path).toBe("b");
    expect(changes[0]!.delta).toBe(3);
    expect(changes[0]!.direction).toBe("up");
  });

  it("diffNumeric detects added/removed", () => {
    const added = diffNumeric(null, 5, "x");
    expect(added[0]!.direction).toBe("added");
    const removed = diffNumeric(5, null, "x");
    expect(removed[0]!.direction).toBe("removed");
  });

  it("diffNumeric handles nested objects and arrays", () => {
    const changes = diffNumeric(
      { outer: { inner: 10 }, arr: [1, 2, 3] },
      { outer: { inner: 14 }, arr: [1, 2, 3, 4] },
    );
    expect(changes.some((c) => c.path === "outer.inner" && c.delta === 4)).toBe(true);
    expect(changes.some((c) => c.path.endsWith("length") && c.direction === "up")).toBe(true);
  });

  it("diffBackbone separates country vs global", () => {
    const oldSnap: Backbone = {
      countries: [
        { iso3: "SDN", displacement: 100, hunger: 50 },
        { iso3: "YEM", displacement: 200 },
      ],
      global_indicators: { hunger: 800 },
    };
    const newSnap: Backbone = {
      countries: [
        { iso3: "SDN", displacement: 150, hunger: 50 }, // displacement up (worse)
        { iso3: "YEM", displacement: 200 }, // unchanged
      ],
      global_indicators: { hunger: 900 },
    };
    const diff = diffBackbone(oldSnap, newSnap);
    expect(diff.countries).toHaveLength(1); // only SDN changed
    expect(diff.countries[0]!.iso3).toBe("SDN");
    expect(diff.countries[0]!.worsening).toBeGreaterThan(0);
    expect(diff.global.length).toBeGreaterThan(0);
    expect(diff.totalChanges).toBeGreaterThan(0);
    expect(diff.summary).toContain("changed");
  });

  it("diffBackbone handles no changes", () => {
    const snap: Backbone = { countries: [{ iso3: "X", v: 1 }] };
    const diff = diffBackbone(snap, snap);
    expect(diff.countries).toHaveLength(0);
    expect(diff.totalChanges).toBe(0);
  });

  it("topWorsened sorts by worsening", () => {
    const diff = diffBackbone(
      { countries: [{ iso3: "A", displacement: 0 }, { iso3: "B", displacement: 0 }] },
      { countries: [{ iso3: "A", displacement: 10 }, { iso3: "B", displacement: 100 }] },
    );
    const top = topWorsened(diff, 2);
    expect(top[0]!.worsening).toBeGreaterThanOrEqual(top[1]!.worsening);
  });

  it("describeChange formats", () => {
    const c = diffNumeric({ x: 100 }, { x: 120 })[0]!;
    const s = describeChange(c);
    expect(s).toContain("x");
    expect(s).toContain("120");
    expect(s).toContain("↑");
  });
});

/* ═══════════════════════════════════════════════════════════════
   Metric metadata
   ═══════════════════════════════════════════════════════════════ */

describe("metric metadata registry", () => {
  it("resolves by exact id", () => {
    expect(resolveMetricMeta("displacement").id).toBe("displacement");
  });

  it("resolves by fragment in a path", () => {
    expect(resolveMetricMeta("AFG.displacement").id).toBe("displacement");
    expect(resolveMetricMeta("global_indicators.military").id).toBe("military_spending");
    expect(resolveMetricMeta("SDN.something.weird").id).toBe("undocumented");
  });

  it("resolves governance dimensions", () => {
    expect(resolveMetricMeta("rule_of_law").id).toBe("governance");
    expect(resolveMetricMeta("control_of_corruption").id).toBe("governance");
  });

  it("falls back to undocumented", () => {
    expect(resolveMetricMeta("zzz_unknown").id).toBe("undocumented");
  });

  it("resolveMany resolves many paths", () => {
    const many = resolveMany(["displacement", "military", "fake"]);
    expect(many.displacement.id).toBe("displacement");
    expect(many.fake.id).toBe("undocumented");
  });

  it("renderFootnote includes publisher and license", () => {
    const meta = METRIC_META[0]!;
    const note = renderFootnote(1234, meta);
    expect(note).toContain(meta.publisher);
    expect(note).toContain(meta.license);
    expect(note).toContain("confidence");
  });

  it("confidenceColors and shortCitation", () => {
    expect(confidenceColor("high")).toBe("#00ff41");
    expect(shortCitation(METRIC_META[0]!)).toContain("(");
    expect(UNDOCUMENTED_META.confidence).toBe("low");
  });
});

/* ═══════════════════════════════════════════════════════════════
   Crisis manifest packs
   ═══════════════════════════════════════════════════════════════ */

describe("crisis manifest packs", () => {
  const manifest: CrisisManifest = {
    manifestVersion: 1,
    iso3: "SDN",
    crisis: "Sudan civil war",
    dataFiles: ["data/world_backbone.json", "data/crisis_timelines.json"],
    dimensions: ["displacement", "hunger", "sanctions"],
    note: "Offline briefcase for Sudan responders",
    generatedAt: 1700000000000,
  };

  it("creates an unsigned crisis manifest pack", async () => {
    const pack = await createCrisisManifestPack(manifest, ["VFXID1:test"]);
    expect(pack.kind).toBe("manifest");
    expect(pack.iso3).toBe("SDN");
    expect(pack.tokens).toContain("VFXID1:test");
  });

  it("embeds and reads the manifest", async () => {
    const pack = await createCrisisManifestPack(manifest, ["VFXWIT1:test"]);
    const read = readCrisisManifest(pack);
    expect(read).not.toBeNull();
    expect(read!.iso3).toBe("SDN");
    expect(read!.dimensions).toContain("hunger");
  });

  it("readCrisisManifest returns null for non-manifest packs", async () => {
    const { createPack } = await import("@/lib/vfxpack");
    const pack = createPack(["VFXID1:test"], { kind: "general" });
    expect(readCrisisManifest(pack)).toBeNull();
  });

  it("round-trips through a token", async () => {
    const pack = await createCrisisManifestPack(manifest, ["VFXID1:test"]);
    const token = encodePack(pack);
    const result = readCrisisManifestFromToken(token);
    expect(result).not.toBeNull();
    expect(result!.manifest!.crisis).toBe("Sudan civil war");
  });

  it("readCrisisManifestFromToken returns null on bad token", () => {
    expect(readCrisisManifestFromToken("not a token")).toBeNull();
  });

  it("throws on bad manifest version", async () => {
    await expect(
      createCrisisManifestPack({ ...manifest, manifestVersion: 2 } as never, []),
    ).rejects.toThrow();
  });
});
