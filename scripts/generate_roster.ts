/**
 * V FOR X — The Roster seed generator
 *
 * Generates the signed `data/roster.json` directory. Each helper entry is
 * self-attested with its own freshly-generated ECDSA P-256 keypair, and a
 * web of peer vouches is signed across helpers so the directory ships with
 * realistic, cryptographically verifiable trust from day one.
 *
 * Everything uses the SAME Web Crypto API the browser uses (Node ≥ 19
 * exposes `globalThis.crypto.subtle`), so every signature this script
 * emits verifies identically in the browser. The tests/roster.test.ts suite
 * re-verifies the committed file to catch any drift.
 *
 * Run:  npx tsx scripts/generate_roster.ts
 */

import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  generateKeyPair,
  signHelper,
  signVouch,
  fingerprintOf,
  makeRosterFile,
  serializeRoster,
  type Helper,
  type HelperCategory,
  type Vouch,
  type Availability,
  type Credential,
  type KeyPair,
} from "../lib/roster";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "..", "data", "roster.json");

/** Fixed baseline timestamp so the dataset is reproducible (2025-06-01T00:00:00Z). */
const BASE_TS = 1_748_726_400_000;
const DAY = 86_400_000;

/* ═══════════════════════════════════════════════════════════════
   Seed profiles — fictional but plausible pseudonymous helpers
   operating in real crisis geographies.
   ═══════════════════════════════════════════════════════════════ */

interface SeedProfile {
  handle: string;
  category: HelperCategory;
  specialties: string[];
  country: string;
  region?: string;
  languages: string[];
  availability: Availability;
  contact: Helper["contact"];
  credentials: Credential[];
  /** index in the SEEDS array of helpers who will vouch for this one */
  vouchedBy?: number[];
}

const SEEDS: SeedProfile[] = [
  {
    handle: "lex-mira",
    category: "lawyer",
    specialties: ["asylum & refugee law", "detention appeals", "family reunification"],
    country: "DEU",
    region: "Berlin / remote",
    languages: ["en", "de", "ar", "fa"],
    availability: "available",
    contact: { email: "lex-mira@protonmail.com", signal: "@lex-mira.42", pgp: "0x9F2A7C1D" },
    credentials: [
      { claim: "Rechtsanwältin — Berlin Chamber of Lawyers #218744", evidence: "https://www.rechtsanwaltskammer-berlin.de/verify/218744", since: 2013 },
      { claim: "UNHCR partner attorney (asylum roster)", since: 2017 },
    ],
    vouchedBy: [1, 3],
  },
  {
    handle: "doc-haddad",
    category: "doctor",
    specialties: ["war surgery", "field triage", "trauma stabilization"],
    country: "JOR",
    region: "Amman / cross-border",
    languages: ["en", "ar"],
    availability: "limited",
    contact: { signal: "@doc-haddad", email: "haddad.field@tutanota.com" },
    credentials: [
      { claim: "MD — Damascus University (2009); Jordan Medical Council", since: 2010 },
      { claim: "MSF surgical roster (field deployable)", evidence: "MSF partner registry — ref MH-2291", since: 2016 },
    ],
    vouchedBy: [2, 0],
  },
  {
    handle: "scribe-okafor",
    category: "journalist",
    specialties: ["conflict reporting", "OSINT verification", "source protection"],
    country: "NGA",
    region: "Lagos / West Africa",
    languages: ["en", "ha", "fr"],
    availability: "available",
    contact: { email: "okafor.press@protonmail.com", pgp: "0x77AE12BD", website: "okafor-press.example" },
    credentials: [
      { claim: "Member — International Federation of Journalists (IFJ #NG-44120)", since: 2018 },
      { claim: "BBC Academy OSINT verification certificate", since: 2021 },
    ],
    vouchedBy: [4, 1],
  },
  {
    handle: "sec-tavares",
    category: "digital_security",
    specialties: ["threat modelling", "device hardening", "secure comms training"],
    country: "BRA",
    region: "São Paulo / Latin America",
    languages: ["pt", "en", "es"],
    availability: "available",
    contact: { signal: "@sec-tavares", email: "tavares.sec@protonmail.com", website: "tavares-train.example" },
    credentials: [
      { claim: "Access Now Digital Security Helpline — certified trainer", since: 2019 },
      { claim: "EFF Surveillance Self-Defense facilitator", since: 2020 },
    ],
    vouchedBy: [0, 5],
  },
  {
    handle: "vox-amari",
    category: "translator",
    specialties: ["legal interpretation", "medical interpretation", "Tigrinya / Amharic"],
    country: "ETH",
    region: "Addis Ababa / remote",
    languages: ["am", "ti", "en", "ar"],
    availability: "limited",
    contact: { email: "amari.translate@protonmail.com", signal: "@vox-amari" },
    credentials: [
      { claim: "NAJIT-aligned court interpreter (EN↔AM/TI)", since: 2020 },
    ],
    vouchedBy: [3],
  },
  {
    handle: "anchor-li",
    category: "counselor",
    specialties: ["trauma-focused therapy", "PTSD", "survivor support"],
    country: "TWN",
    region: "Taipei / remote",
    languages: ["zh", "en"],
    availability: "available",
    contact: { email: "anchor.li@tutanota.com", signal: "@anchor-li" },
    credentials: [
      { claim: "Licensed clinical psychologist — Taiwan RCP #PS-0912", evidence: "https://rcp.ntpc.gov.tw/verify/PS-0912", since: 2014 },
      { claim: "IFRC psychosocial support volunteer", since: 2019 },
    ],
    vouchedBy: [3, 7],
  },
  {
    handle: "wrench-koirala",
    category: "engineer",
    specialties: ["solar microgrids", "water purification", "shelter retrofit"],
    country: "NPL",
    region: "Kathmandu / field deployable",
    languages: ["ne", "en", "hi"],
    availability: "available",
    contact: { email: "koirala.build@protonmail.com", signal: "@wrench-k" },
    credentials: [
      { claim: "MS Civil Eng — Tribhuvan University; Nepal Engineers' Council #NEC-4471", since: 2012 },
      { claim: "Rotary/Engineers Without Borders field deployments (×4)", evidence: "EWB-Nepal roster ref 2023-K4", since: 2017 },
    ],
    vouchedBy: [1, 7],
  },
  {
    handle: "route-ndiaye",
    category: "logistics",
    specialties: ["humanitarian convoy routing", "warehousing", "customs/duty exemptions"],
    country: "SEN",
    region: "Dakar / Sahel",
    languages: ["fr", "wo", "en"],
    availability: "limited",
    contact: { email: "ndiaye.route@protonmail.com", signal: "@route-ndiaye" },
    credentials: [
      { claim: "Certified — Logistics Cluster (WFP) field logistics track", since: 2020 },
      { claim: "CILT associate member (Chartered Institute L&A) #SN-2210", since: 2021 },
    ],
    vouchedBy: [2],
  },
  {
    handle: "lex-pereira",
    category: "lawyer",
    specialties: ["digital rights", "press freedom defense", "SLAPP response"],
    country: "PRT",
    region: "Lisbon / remote",
    languages: ["pt", "en", "es", "fr"],
    availability: "available",
    contact: { email: "pereira.rights@protonmail.com", pgp: "0x4C3B9E0F", signal: "@lex-pereira" },
    credentials: [
      { claim: "Advogada — Ordem dos Advogados Portugueses #55821", evidence: "https://portal.oa.pt/verify/55821", since: 2015 },
      { claim: "EFF cooperating attorney network", since: 2022 },
    ],
    vouchedBy: [3, 5],
  },
  {
    handle: "doc-rivera",
    category: "doctor",
    specialties: ["infectious disease", "outbreak response", "maternal health"],
    country: "COL",
    region: "Bogotá / field deployable",
    languages: ["es", "en", "pt"],
    availability: "available",
    contact: { email: "rivera.md@tutanota.com", signal: "@doc-rivera" },
    credentials: [
      { claim: "MD — Universidad Nacional de Colombia; Reprobús specialist registry", since: 2011 },
      { claim: "PAHO outbreak response roster", evidence: "PAHO partner ref COL-RV-08", since: 2018 },
    ],
    vouchedBy: [6, 8],
  },
];

/* ═══════════════════════════════════════════════════════════════
   Build signed helpers + vouches
   ═══════════════════════════════════════════════════════════════ */

function fingerprintFromKey(kp: KeyPair): string {
  return fingerprintOf(kp.publicKey);
}

async function main() {
  console.log("// Generating keypairs for %d helpers...", SEEDS.length);
  const keys: KeyPair[] = [];
  for (let i = 0; i < SEEDS.length; i++) {
    keys.push(await generateKeyPair());
  }

  const relationships = [
    "Co-delivered legal-aid clinics for displaced families",
    "Worked together on a cross-border medical evacuation",
    "Collaborated on a verified conflict report and source-protection plan",
    "Paired on a digital-security training for at-risk journalists",
    "Shared an interpretation desk during asylum intake",
    "Co-facilitated a psychosocial support rotation",
    "Joint field deployment (power + water systems)",
    "Coordinated an aid convoy through a contested corridor",
  ];

  // 1. Build signed helper profiles (vouches attached after signing).
  const helpers: Helper[] = [];
  for (let i = 0; i < SEEDS.length; i++) {
    const s = SEEDS[i];
    const base: Helper = {
      id: `ROSTER-${String(i + 1).padStart(3, "0")}`,
      version: 1,
      handle: s.handle,
      category: s.category,
      specialties: s.specialties,
      country: s.country,
      region: s.region,
      languages: s.languages,
      availability: s.availability,
      contact: s.contact,
      credentials: s.credentials,
      vouches: [], // attached after signing — not part of canonicalHelper
      publicKey: keys[i].publicKey,
      ts: BASE_TS + i * DAY,
      signature: "", // filled below
    };
    base.signature = await signHelper(base, keys[i].privateKey);
    helpers.push(base);
    console.log("  ✓ signed %s [%s] %s", base.id, base.handle, fingerprintFromKey(keys[i]));
  }

  // 2. Build peer vouches (voucher signs, vouch binds to helperId).
  for (let i = 0; i < SEEDS.length; i++) {
    const target = helpers[i];
    const voucherIdxs = SEEDS[i].vouchedBy ?? [];
    for (const vi of voucherIdxs) {
      const voucher = helpers[vi];
      const rel = relationships[(i + vi) % relationships.length];
      const unsig: Vouch = {
        helperId: target.id,
        byHandle: voucher.handle,
        byPublicKey: keys[vi].publicKey,
        relationship: rel,
        note: `I have worked directly with ${target.handle} and can vouch for their skill and integrity in this work.`,
        ts: BASE_TS + (i + vi + 1) * DAY,
        signature: "",
      };
      unsig.signature = await signVouch(unsig, keys[vi].privateKey);
      target.vouches.push(unsig);
      console.log("  ✚ %s vouched for %s", voucher.handle, target.handle);
    }
  }

  const file = makeRosterFile(
    "V FOR X — The Roster (seed directory)",
    helpers,
  );
  writeFileSync(OUT, serializeRoster(file), "utf-8");

  console.log("\n// Wrote %d signed helpers → %s", helpers.length, OUT);
  const totalVouches = helpers.reduce((n, h) => n + h.vouches.length, 0);
  console.log("// %d peer vouches signed across the directory.", totalVouches);
  console.log("// Re-verify in-browser with: tests/roster.test.ts");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
