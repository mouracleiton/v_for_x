/* ═══════════════════════════════════════════════════════════════
   V FOR X COMPASS — Shared country data module
   ----------------------------------------------------------------
   Loaded by background.js (service worker), content.js (content
   script) and popup.js (popup page). Exposes:
     • COUNTRY_NAMES   — [{ iso3, names:[...], flag, ... }]  (~50)
     • NAME_TO_ISO3    — lowercased name → ISO3 lookup map
     • TOP_STATS       — quick stat previews for 20 countries
     • countryFromText(text) — resolve arbitrary text to an entry
   No dependencies. Plain ES module (also usable as a classic
   script via the global `V4X_COUNTRIES` fallback).
   ═══════════════════════════════════════════════════════════════ */

// ── Helpers ────────────────────────────────────────────────────
// Convert a 2-letter ISO code to a regional flag emoji (works for
// CLDR region subtags, which ISO 3166-1 alpha-2 codes are).
function iso2ToFlag(iso2) {
  if (!iso2 || iso2.length !== 2) return "🏳️";
  const A = 0x1f1e6; // regional indicator A
  const cc = iso2.toUpperCase();
  return String.fromCodePoint(
    A + (cc.charCodeAt(0) - 65),
    A + (cc.charCodeAt(1) - 65)
  );
}

// ═══════════════════════════════════════════════════════════════
// COUNTRY_NAMES — ~50 major countries
// Each entry: { iso3, iso2, name, alt:[alternative spellings],
//               flag, region }
// `alt` covers common variants ("United States"/"USA"/"America").
// ═══════════════════════════════════════════════════════════════
const COUNTRY_NAMES = [
  { iso3: "USA", iso2: "US", name: "United States", alt: ["USA", "U.S.A.", "United States of America", "America", "US", "U.S."], region: "Americas" },
  { iso3: "BRA", iso2: "BR", name: "Brazil", alt: ["Brasil", "Federative Republic of Brazil"], region: "Americas" },
  { iso3: "CHN", iso2: "CN", name: "China", alt: ["People's Republic of China", "PRC", "Mainland China"], region: "Asia" },
  { iso3: "IND", iso2: "IN", name: "India", alt: ["Republic of India", "Bharat"], region: "Asia" },
  { iso3: "RUS", iso2: "RU", name: "Russia", alt: ["Russian Federation", "USSR", "Soviet Union"], region: "Europe" },
  { iso3: "DEU", iso2: "DE", name: "Germany", alt: ["Deutschland", "Federal Republic of Germany"], region: "Europe" },
  { iso3: "JPN", iso2: "JP", name: "Japan", alt: ["Nippon", "Nihon"], region: "Asia" },
  { iso3: "GBR", iso2: "GB", name: "United Kingdom", alt: ["UK", "U.K.", "Britain", "Great Britain", "England"], region: "Europe" },
  { iso3: "FRA", iso2: "FR", name: "France", alt: ["French Republic"], region: "Europe" },
  { iso3: "ITA", iso2: "IT", name: "Italy", alt: ["Italia", "Italian Republic"], region: "Europe" },
  { iso3: "CAN", iso2: "CA", name: "Canada", alt: [], region: "Americas" },
  { iso3: "AUS", iso2: "AU", name: "Australia", alt: ["Commonwealth of Australia"], region: "Oceania" },
  { iso3: "ESP", iso2: "ES", name: "Spain", alt: ["España"], region: "Europe" },
  { iso3: "MEX", iso2: "MX", name: "Mexico", alt: ["México", "United Mexican States"], region: "Americas" },
  { iso3: "KOR", iso2: "KR", name: "South Korea", alt: ["Republic of Korea", "Korea", "Korea, Republic of"], region: "Asia" },
  { iso3: "PRK", iso2: "KP", name: "North Korea", alt: ["DPRK", "Democratic People's Republic of Korea"], region: "Asia" },
  { iso3: "IRN", iso2: "IR", name: "Iran", alt: ["Islamic Republic of Iran", "Persia"], region: "Asia" },
  { iso3: "IRQ", iso2: "IQ", name: "Iraq", alt: ["Irak"], region: "Asia" },
  { iso3: "SAU", iso2: "SA", name: "Saudi Arabia", alt: ["KSA", "Kingdom of Saudi Arabia"], region: "Asia" },
  { iso3: "ISR", iso2: "IL", name: "Israel", alt: ["State of Israel"], region: "Asia" },
  { iso3: "TUR", iso2: "TR", name: "Turkey", alt: ["Türkiye", "Turkiye"], region: "Asia" },
  { iso3: "EGY", iso2: "EG", name: "Egypt", alt: ["Arab Republic of Egypt"], region: "Africa" },
  { iso3: "ZAF", iso2: "ZA", name: "South Africa", alt: ["RSA", "Republic of South Africa"], region: "Africa" },
  { iso3: "NGA", iso2: "NG", name: "Nigeria", alt: ["Federal Republic of Nigeria"], region: "Africa" },
  { iso3: "ARG", iso2: "AR", name: "Argentina", alt: ["Argentine Republic"], region: "Americas" },
  { iso3: "UKR", iso2: "UA", name: "Ukraine", alt: ["Ucrânia"], region: "Europe" },
  { iso3: "POL", iso2: "PL", name: "Poland", alt: ["Polska"], region: "Europe" },
  { iso3: "NLD", iso2: "NL", name: "Netherlands", alt: ["Holland", "The Netherlands", "Nederland"], region: "Europe" },
  { iso3: "SWE", iso2: "SE", name: "Sweden", alt: ["Sverige"], region: "Europe" },
  { iso3: "CHE", iso2: "CH", name: "Switzerland", alt: ["Swiss Confederation", "Suisse", "Schweiz"], region: "Europe" },
  { iso3: "IDN", iso2: "ID", name: "Indonesia", alt: ["Republic of Indonesia"], region: "Asia" },
  { iso3: "PAK", iso2: "PK", name: "Pakistan", alt: ["Islamic Republic of Pakistan"], region: "Asia" },
  { iso3: "BGD", iso2: "BD", name: "Bangladesh", alt: ["People's Republic of Bangladesh"], region: "Asia" },
  { iso3: "PHL", iso2: "PH", name: "Philippines", alt: ["Republic of the Philippines", "Filipinas"], region: "Asia" },
  { iso3: "VNM", iso2: "VN", name: "Vietnam", alt: ["Viet Nam", "Socialist Republic of Vietnam"], region: "Asia" },
  { iso3: "THA", iso2: "TH", name: "Thailand", alt: ["Kingdom of Thailand", "Siam"], region: "Asia" },
  { iso3: "COL", iso2: "CO", name: "Colombia", alt: ["Republic of Colombia"], region: "Americas" },
  { iso3: "VEN", iso2: "VE", name: "Venezuela", alt: ["Bolivarian Republic of Venezuela"], region: "Americas" },
  { iso3: "CUB", iso2: "CU", name: "Cuba", alt: ["Republic of Cuba"], region: "Americas" },
  // ── Crisis hotspots (data-rich on V FOR X) ──
  { iso3: "SDN", iso2: "SD", name: "Sudan", alt: ["Republic of the Sudan"], region: "Africa" },
  { iso3: "SSD", iso2: "SS", name: "South Sudan", alt: ["Republic of South Sudan"], region: "Africa" },
  { iso3: "COD", iso2: "CD", name: "DR Congo", alt: ["DRC", "Democratic Republic of the Congo", "Congo-Kinshasa", "Zaire"], region: "Africa" },
  { iso3: "COG", iso2: "CG", name: "Republic of the Congo", alt: ["Congo", "Congo-Brazzaville"], region: "Africa" },
  { iso3: "YEM", iso2: "YE", name: "Yemen", alt: ["Republic of Yemen"], region: "Asia" },
  { iso3: "SYR", iso2: "SY", name: "Syria", alt: ["Syrian Arab Republic", "Syrian Republic"], region: "Asia" },
  { iso3: "HTI", iso2: "HT", name: "Haiti", alt: ["Republic of Haiti", "Haïti"], region: "Americas" },
  { iso3: "MLI", iso2: "ML", name: "Mali", alt: ["Republic of Mali"], region: "Africa" },
  { iso3: "MMR", iso2: "MM", name: "Myanmar", alt: ["Burma", "Republic of the Union of Myanmar"], region: "Asia" },
  { iso3: "ETH", iso2: "ET", name: "Ethiopia", alt: ["Federal Democratic Republic of Ethiopia"], region: "Africa" },
  { iso3: "SOM", iso2: "SO", name: "Somalia", alt: ["Federal Republic of Somalia", "Somaliland"], region: "Africa" },
  { iso3: "BFA", iso2: "BF", name: "Burkina Faso", alt: [], region: "Africa" },
  { iso3: "AFG", iso2: "AF", name: "Afghanistan", alt: ["Islamic Emirate of Afghanistan", "Islamic Republic of Afghanistan"], region: "Asia" },
  { iso3: "CAF", iso2: "CF", name: "Central African Republic", alt: ["CAR"], region: "Africa" },
  { iso3: "TCD", iso2: "TD", name: "Chad", alt: ["Tchad", "Republic of Chad"], region: "Africa" },
  { iso3: "LBN", iso2: "LB", name: "Lebanon", alt: ["Lebanese Republic"], region: "Asia" },
  { iso3: "ZWE", iso2: "ZW", name: "Zimbabwe", alt: ["Republic of Zimbabwe"], region: "Africa" },
  { iso3: "KEN", iso2: "KE", name: "Kenya", alt: ["Republic of Kenya"], region: "Africa" },
  { iso3: "PSE", iso2: "PS", name: "Palestine", alt: ["State of Palestine", "Palestinian Territories", "West Bank", "Gaza"], region: "Asia" },
].map((c) => ({ ...c, flag: iso2ToFlag(c.iso2) }));

// ═══════════════════════════════════════════════════════════════
// NAME_TO_ISO3 — flat lowercase lookup for O(1) name resolution.
// Keys include every name + alt variant. First match wins.
// ═══════════════════════════════════════════════════════════════
const NAME_TO_ISO3 = {};
for (const c of COUNTRY_NAMES) {
  const keys = [c.name, ...(c.alt || [])];
  for (const k of keys) NAME_TO_ISO3[k.trim().toLowerCase()] = c.iso3;
}

// ═══════════════════════════════════════════════════════════════
// TOP_STATS — quick preview numbers for the 20 most data-rich
// (highest V FOR X severity score) countries. Sources: WFP/FAO
// hunger hotspots & Global Report on Food Crises 2025.
//   score      — composite V FOR X severity (0–100)
//   wfpClass   — WFP food-crisis band label
//   undernour  — undernourishment %
//   conflict   — conflict intensity (1–5)
//   displaced  — displaced people (millions)
// ═══════════════════════════════════════════════════════════════
const TOP_STATS = {
  SDN: { score: 98.8, wfpClass: "highest_concern", undernour: null, conflict: 5, displaced: 10.0 },
  SSD: { score: 76.8, wfpClass: "highest_concern", undernour: 21.0, conflict: 4, displaced: 4.0 },
  PSE: { score: 76.1, wfpClass: "highest_concern", undernour: null, conflict: 5, displaced: 1.9 },
  COD: { score: 72.6, wfpClass: "very_high_concern", undernour: 37.3, conflict: 5, displaced: 7.0 },
  YEM: { score: 70.5, wfpClass: "very_high_concern", undernour: null, conflict: 4, displaced: 4.5 },
  SYR: { score: 66.4, wfpClass: "very_high_concern", undernour: 35.9, conflict: 3, displaced: 7.2 },
  HTI: { score: 65.1, wfpClass: "highest_concern", undernour: 51.1, conflict: 4, displaced: 0.7 },
  MLI: { score: 62.9, wfpClass: "highest_concern", undernour: 9.9, conflict: 4, displaced: 0.4 },
  MMR: { score: 60.9, wfpClass: "very_high_concern", undernour: 5.2, conflict: 4, displaced: 3.4 },
  NGA: { score: 57.8, wfpClass: "high_concern", undernour: 18.7, conflict: 4, displaced: 3.3 },
  ETH: { score: 56.3, wfpClass: "very_high_concern", undernour: 20.2, conflict: 4, displaced: 3.0 },
  SOM: { score: 52.1, wfpClass: "very_high_concern", undernour: 52.8, conflict: 4, displaced: 3.9 },
  BFA: { score: 51.4, wfpClass: "very_high_concern", undernour: 13.9, conflict: 5, displaced: 2.3 },
  AFG: { score: 50.2, wfpClass: "high_concern", undernour: 28.9, conflict: 3, displaced: 6.0 },
  CAF: { score: 49.0, wfpClass: "high_concern", undernour: 29.6, conflict: 4, displaced: 1.0 },
  TCD: { score: 38.9, wfpClass: "high_concern", undernour: 30.5, conflict: 3, displaced: 1.2 },
  LBN: { score: 35.4, wfpClass: "high_concern", undernour: 9.8, conflict: 3, displaced: 0.1 },
  ZWE: { score: 31.9, wfpClass: "concern", undernour: 21.4, conflict: 2, displaced: 0.02 },
  KEN: { score: 18.7, wfpClass: "concern", undernour: 35.3, conflict: 1, displaced: 0.05 },
  UKR: { score: 42.0, wfpClass: "high_concern", undernour: null, conflict: 5, displaced: 6.5 },
};

// Friendly label for a WFP class code.
function wfpLabel(code) {
  switch (code) {
    case "highest_concern": return "HIGHEST CONCERN";
    case "very_high_concern": return "VERY HIGH CONCERN";
    case "high_concern": return "HIGH CONCERN";
    case "concern": return "CONCERN";
    default: return code ? String(code).toUpperCase() : "—";
  }
}

// ═══════════════════════════════════════════════════════════════
// countryFromText — resolve arbitrary selected text to a country
// entry. Returns the matching COUNTRY_NAMES element or null.
// Tolerant of surrounding punctuation / whitespace.
// ═══════════════════════════════════════════════════════════════
function countryFromText(text) {
  if (!text) return null;
  const clean = text.trim().replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
  if (!clean) return null;
  const iso3 = NAME_TO_ISO3[clean.toLowerCase()];
  if (!iso3) return null;
  return COUNTRY_NAMES.find((c) => c.iso3 === iso3) || null;
}

// Resolve any text to its ISO3 code (used by background.js).
function iso3FromText(text) {
  const c = countryFromText(text);
  return c ? c.iso3 : null;
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS — support both ES modules and classic <script> loading.
// ═══════════════════════════════════════════════════════════════
const V4X_COUNTRIES = {
  COUNTRY_NAMES,
  NAME_TO_ISO3,
  TOP_STATS,
  iso2ToFlag,
  wfpLabel,
  countryFromText,
  iso3FromText,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = V4X_COUNTRIES;
}
if (typeof self !== "undefined") {
  self.V4X_COUNTRIES = V4X_COUNTRIES;
}
if (typeof window !== "undefined") {
  window.V4X_COUNTRIES = V4X_COUNTRIES;
}
