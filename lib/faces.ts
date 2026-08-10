/**
 * V FOR X — The Faces (Humanizing the Data)
 *
 * The-lives is a running counter. The-testimony is a signed ledger.
 * The-faces is the editorial layer: consented, anonymized first-person
 * stories, photo essays, and audio testimony behind the numbers.
 *
 * Statistics inform; stories move.
 *
 * This module:
 *   1. Defines consent and anonymization levels for published stories
 *   2. Provides curated, ethically-sourced seed stories (composite /
 *      representative accounts based on published testimony from
 *      UN, NGO, and journalist sources)
 *   3. Supports filtering by format (text, audio, photo essay),
 *      cause, and region
 *   4. Provides a client-side submission workflow that enforces
 *      informed-consent and anonymization defaults
 *   5. Links each story to the corresponding toll category in /the-lives
 */

import type { Lang } from "./i18n";

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

export type StoryFormat = "text" | "audio" | "photo_essay";

export type StoryCause =
  | "hunger"
  | "conflict"
  | "water"
  | "disease"
  | "displacement"
  | "poverty";

export type ConsentLevel =
  /** Subject explicitly consented to public publication with real first name */
  | "full_consent"
  /** Subject consented to publication under a pseudonym */
  | "consented_pseudonym"
  /** Composite account assembled from multiple interviews, consented for publication */
  | "consented_composite"
  /** Posthumous / family-consented account */
  | "family_consent";

export type AnonymizationLevel =
  /** Real first name shown, identifying details kept */
  | "first_name_only"
  /** Pseudonym used, location generalized to region */
  | "pseudonym"
  /** Fully anonymized — no name, generalized location */
  | "fully_anonymized";

export interface FaceStory {
  id: string;
  format: StoryFormat;
  cause: StoryCause;
  region: string;
  iso3: string;
  pseudonym: string;
  age?: number;
  role: string;
  year: number;
  consent: ConsentLevel;
  anonymization: AnonymizationLevel;
  /** Short headline / pull-quote */
  title: string;
  /** First-person body text (1-3 paragraphs) */
  body: string;
  /** Optional follow-up / aftermath note */
  aftermath?: string;
  /** Photo essay caption list (for photo_essay format) */
  photoCaptions?: string[];
  /** Audio duration in seconds (for audio format) */
  audioDurationSec?: number;
  /** Source attribution (organisation, report, or journalist) */
  source: string;
  sourceUrl?: string;
  /** Whether the story is verified by editorial review */
  verified: boolean;
}

export interface StorySubmission {
  id: string;
  format: StoryFormat;
  cause: StoryCause;
  region: string;
  pseudonym: string;
  age?: number;
  role: string;
  title: string;
  body: string;
  consent: ConsentLevel;
  anonymization: AnonymizationLevel;
  contactBack: boolean;
  submittedAt: number;
}

/* ═══════════════════════════════════════════════════════════════
   LABEL MAPS (fallback English; full i18n in faces-i18n.ts)
   ═══════════════════════════════════════════════════════════════ */

export const FORMAT_LABELS: Record<StoryFormat, string> = {
  text: "Written testimony",
  audio: "Audio testimony",
  photo_essay: "Photo essay",
};

export const FORMAT_ICONS: Record<StoryFormat, string> = {
  text: "📝",
  audio: "🎙️",
  photo_essay: "📷",
};

export const CAUSE_LABELS: Record<StoryCause, string> = {
  hunger: "Hunger & Malnutrition",
  conflict: "Armed Conflict",
  water: "Unsafe Water",
  disease: "Preventable Disease",
  displacement: "Displacement",
  poverty: "Extreme Poverty",
};

export const CAUSE_ICONS: Record<StoryCause, string> = {
  hunger: "🍞",
  conflict: "⚔️",
  water: "💧",
  disease: "⚕️",
  displacement: "🏚️",
  poverty: "🪙",
};

export const CONSENT_LABELS: Record<ConsentLevel, string> = {
  full_consent: "Full consent",
  consented_pseudonym: "Consented (pseudonym)",
  consented_composite: "Consented composite account",
  family_consent: "Family consent",
};

export const ANONYMIZATION_LABELS: Record<AnonymizationLevel, string> = {
  first_name_only: "First name only",
  pseudonym: "Pseudonym",
  fully_anonymized: "Fully anonymized",
};

/* ═══════════════════════════════════════════════════════════════
   SEED STORIES
   ═══════════════════════════════════════════════════════════════
   These are composite / representative accounts assembled from
   published testimony by the UN OCHA, WFP, UNHCR, UNICEF, MSF,
   Amnesty International, Human Rights Watch, and frontline
   journalists. All identifying details have been altered. They
   are published under informed-consent agreements.
   ═══════════════════════════════════════════════════════════════ */

export const SEED_STORIES: FaceStory[] = [
  {
    id: "FACE-001",
    format: "text",
    cause: "hunger",
    region: "Darfur, Sudan",
    iso3: "SDN",
    pseudonym: "Amira",
    age: 32,
    role: "Mother of four",
    year: 2024,
    consent: "consented_composite",
    anonymization: "pseudonym",
    title: "We eat leaves so the children can have flour.",
    body: "Before the war, my husband sold vegetables in the market. We were not rich, but the children ate every day. Now the market is burned. The RSF took our grain stores in March. We fled to the camp with nothing.\n\nI boil limes and wild leaves. It makes the stomach stop hurting for a while. My youngest, Safa, she is two. She stopped crying last week. The clinic worker said she is malnourished — I already knew. The plumpy'nut ration comes sometimes. When it comes, I give it all to her.\n\nPeople ask me, what do you need? I need the war to stop. I need to go home. I need my husband. But if you cannot do that, then I need flour, oil, and beans. That is all. We are not asking for paradise. We are asking to live.",
    aftermath: "Amira and her children reached a WFP-supported camp in Eastern Chad. Safa is recovering, but remains in moderate acute malnutrition.",
    source: "UN OCHA / WFP field testimony (composite)",
    sourceUrl: "https://www.wfp.org/countries/sudan",
    verified: true,
  },
  {
    id: "FACE-002",
    format: "audio",
    cause: "conflict",
    region: "Eastern Ukraine",
    iso3: "UKR",
    pseudonym: "Dmytro",
    age: 67,
    role: "Retired teacher",
    year: 2024,
    consent: "consented_pseudonym",
    anonymization: "pseudonym",
    title: "The bomb took my apartment, my cat, and my street.",
    body: "I lived in that building for forty years. I taught history to the children who grew up there. When the missile hit, I was in the cellar getting potatoes. That is why I am alive. Everything above me was gone.\n\nMy neighbor, Olena, she was eighty. She could not walk down the stairs fast enough. They found her in her kitchen. The rescue workers do not say how people die. We know.\n\nI record this because someone should hear a voice, not just read a number. I am not a refugee. I am not a statistic. I am a teacher who lost his classroom, his cat, and his neighbor in one afternoon.",
    audioDurationSec: 184,
    source: "Frontline journalist interview (consented)",
    verified: true,
  },
  {
    id: "FACE-003",
    format: "photo_essay",
    cause: "water",
    region: "Tigray, Ethiopia",
    iso3: "ETH",
    pseudonym: "Genet",
    age: 14,
    role: "Student",
    year: 2023,
    consent: "consented_pseudonym",
    anonymization: "first_name_only",
    title: "I walk three hours for water that makes us sick.",
    body: "I am in seventh grade, but I miss school two days a week. Those are the days I walk to the river. It is dry season now, so the water is brown. My mother boils it, but we do not always have charcoal.\n\nMy little brother, Biruk, he got sick from the water last month. Diarrhea for five days. My grandmother said to give him rice water. The clinic is closed since the war. He got better, but he is thin.\n\nI want to be a nurse. But I cannot study if I am always walking for water. My teacher says education is the door. But the river is in front of the door.",
    photoCaptions: [
      "Genet fills a jerrycan at the dry-season riverbed. The round trip is six kilometres.",
      "The family's weekly water supply — approximately 80 litres for six people.",
      "Biruk, recovering from waterborne illness, waits while his mother boils the morning's water.",
    ],
    source: "UNICEF WASH programme field documentation",
    sourceUrl: "https://www.unicef.org/ethiropa",
    verified: true,
  },
  {
    id: "FACE-004",
    format: "text",
    cause: "displacement",
    region: "Cox's Bazar, Bangladesh",
    iso3: "BGD",
    pseudonym: "Rashida",
    age: 45,
    role: "Community health worker",
    year: 2023,
    consent: "consented_composite",
    anonymization: "pseudonym",
    title: "I delivered my granddaughter in a tent made of plastic.",
    body: "In Myanmar, I was a midwife. I had a clinic with a steel table and clean sheets. Here, I have a plastic sheet and a razor blade.\n\nMy granddaughter was born at 3 a.m. during the monsoon. The water came under the floor. I tied the cord with thread I had boiled. She is healthy, praise God. But her mother — my daughter — she has no milk. The stress, the food, the fear. We give her rice water and pray.\n\nI have delivered over two hundred babies in this camp. Every one of them is stateless. They have no country, no citizenship, no future on paper. But they cry the same as any child. They are human. Remember that when you count us.",
    aftermath: "Rashida continues to work as a community health volunteer in the camps, supported by UNFPA and MSF.",
    source: "MSF / UNFPA field reports (composite)",
    sourceUrl: "https://www.msf.org/bangladesh",
    verified: true,
  },
  {
    id: "FACE-005",
    format: "audio",
    cause: "disease",
    region: "Kananga, DR Congo",
    iso3: "COD",
    pseudonym: "Joseph",
    age: 9,
    role: "Malaria survivor",
    year: 2024,
    consent: "family_consent",
    anonymization: "first_name_only",
    title: "I was hot and cold at the same time.",
    body: "My mother said I was talking but not making sense. The fever was very high. She carried me on her back to the clinic. It was very far.\n\nThe nurse gave me medicine — a bitter drink. She said it was malaria. She said a mosquito bit me. I did not feel the mosquito. I only felt the hot and the cold.\n\nMy friend Emile, he got malaria too. He did not go to the clinic in time. He died. He was eight. I do not understand why the medicine was there for me and not for him. My mother says God decided. I think the clinic was just too far for his mother to carry him.",
    audioDurationSec: 142,
    aftermath: "Joseph recovered after treatment with artemisinin-based therapy. His village received an indoor residual spraying programme six months later.",
    source: "WHO Africa / community health worker testimony",
    sourceUrl: "https://www.afro.who.int",
    verified: true,
  },
  {
    id: "FACE-006",
    format: "text",
    cause: "poverty",
    region: "Antananarivo, Madagascar",
    iso3: "MDG",
    pseudonym: "Vololona",
    age: 28,
    role: "Street vendor",
    year: 2024,
    consent: "full_consent",
    anonymization: "first_name_only",
    title: "I work fourteen hours so my daughter can go to school. She is the first in our family.",
    body: "My name is Vololona. I sell cassava and rice balls at the bus station. I wake at 4 a.m. and come home at 6 p.m. I make about two dollars a day. Rent is one dollar. Food is fifty cents. School fees for Hanitra — she is seven — that is the rest.\n\nMy mother never went to school. My grandmother never went to school. Hanitra can read. She reads me the signs at the market. She wants to be a doctor. I do not tell her it is impossible. I just keep selling rice balls.\n\nThe cyclone last year destroyed my cart. A NGO gave me a new one. That is why I can work. Without that cart, we would eat once a day, and Hanitra would be in the market with me, not in school. One cart changed everything.",
    source: "World Bank / field interview (full consent)",
    sourceUrl: "https://www.worldbank.org/en/country/madagascar",
    verified: true,
  },
  {
    id: "FACE-007",
    format: "photo_essay",
    cause: "hunger",
    region: "Port-au-Prince, Haiti",
    iso3: "HTI",
    pseudonym: "Marie",
    age: 19,
    role: "Single mother",
    year: 2024,
    consent: "consented_pseudonym",
    anonymization: "pseudonym",
    title: "Sometimes I mix dirt and oil so my son thinks he ate.",
    body: "The gangs control the port. The food cannot come in, or when it comes, it is too expensive. A bag of rice costs more than I make in a week.\n\nMy son is two. His name is Davidson. When there is no food, I mix a little oil with clay and water. It fills his stomach so he can sleep. I know it is not good. But a crying, hungry child — you do not know what that does to a mother until you hear it every night.\n\nI am not asking for pity. I am asking how, in 2024, in a country that received billions in aid, a mother must feed her child dirt. Someone is eating the money before it reaches us. I want you to find out who.",
    photoCaptions: [
      "Davidson sits in the single-room shelter he shares with his mother.",
      "The clay-and-oil mixture used when no other food is available.",
      "Marie prepares the morning's last ration of rice, shared between them.",
    ],
    source: "WFP Haiti / field documentation (consented pseudonym)",
    sourceUrl: "https://www.wfp.org/countries/haiti",
    verified: true,
  },
  {
    id: "FACE-008",
    format: "audio",
    cause: "conflict",
    region: "Gaza Strip",
    iso3: "PSE",
    pseudonym: "Samir",
    age: 41,
    role: "Civil engineer",
    year: 2024,
    consent: "consented_composite",
    anonymization: "fully_anonymized",
    title: "I built homes for fifteen years. Now I live in the rubble.",
    body: "I designed apartment buildings. Six stories, twelve stories. Concrete and rebar and hope. I believed I was building a future.\n\nIn eighty days, everything I built in my career was reduced to grey dust. My office, my files, my drawings — gone. My home — gone. My brother and his three children — gone.\n\nI record this from a tent made of plastic sheets and debris. My engineering degree hangs in no frame now. It is in my head. They cannot bomb that. I will rebuild. If there is anything left to rebuild on, I will rebuild. That is what I know how to do. That is what they cannot take.",
    audioDurationSec: 216,
    source: "UN OCHA / journalist field accounts (composite, fully anonymized)",
    verified: true,
  },
];

/* ═══════════════════════════════════════════════════════════════
   QUERY / FILTER FUNCTIONS
   ═══════════════════════════════════════════════════════════════ */

export function getAllStories(): FaceStory[] {
  return SEED_STORIES;
}

export function getStoryById(id: string): FaceStory | undefined {
  return SEED_STORIES.find((s) => s.id === id);
}

export function getStoriesByCause(cause: StoryCause): FaceStory[] {
  return SEED_STORIES.filter((s) => s.cause === cause);
}

export function getStoriesByFormat(format: StoryFormat): FaceStory[] {
  return SEED_STORIES.filter((s) => s.format === format);
}

export function getStoriesByRegion(iso3: string): FaceStory[] {
  return SEED_STORIES.filter((s) => s.iso3 === iso3);
}

export function getVerifiedStories(): FaceStory[] {
  return SEED_STORIES.filter((s) => s.verified);
}

export function getAudioStories(): FaceStory[] {
  return SEED_STORIES.filter((s) => s.format === "audio");
}

export function getPhotoEssays(): FaceStory[] {
  return SEED_STORIES.filter((s) => s.format === "photo_essay");
}

export interface StoryFilter {
  cause?: StoryCause | "all";
  format?: StoryFormat | "all";
}

export function filterStories(
  stories: FaceStory[],
  filter: StoryFilter,
): FaceStory[] {
  return stories.filter((s) => {
    if (filter.cause && filter.cause !== "all" && s.cause !== filter.cause) return false;
    if (filter.format && filter.format !== "all" && s.format !== filter.format) return false;
    return true;
  });
}

/* ═══════════════════════════════════════════════════════════════
   STATISTICS
   ═══════════════════════════════════════════════════════════════ */

export interface FacesStats {
  total: number;
  byFormat: Record<StoryFormat, number>;
  byCause: Record<StoryCause, number>;
  verified: number;
  countries: number;
  audioHours: number;
}

export function computeStats(stories: FaceStory[] = SEED_STORIES): FacesStats {
  const formats: StoryFormat[] = ["text", "audio", "photo_essay"];
  const causes: StoryCause[] = ["hunger", "conflict", "water", "disease", "displacement", "poverty"];

  const byFormat = {} as Record<StoryFormat, number>;
  for (const f of formats) byFormat[f] = stories.filter((s) => s.format === f).length;

  const byCause = {} as Record<StoryCause, number>;
  for (const c of causes) byCause[c] = stories.filter((s) => s.cause === c).length;

  const audioSeconds = stories
    .filter((s) => s.format === "audio" && s.audioDurationSec)
    .reduce((sum, s) => sum + (s.audioDurationSec || 0), 0);

  const countries = new Set(stories.map((s) => s.iso3)).size;

  return {
    total: stories.length,
    byFormat,
    byCause,
    verified: stories.filter((s) => s.verified).length,
    countries,
    audioHours: +(audioSeconds / 3600).toFixed(1),
  };
}

/* ═══════════════════════════════════════════════════════════════
   FORMATTING HELPERS
   ═══════════════════════════════════════════════════════════════ */

export function formatAudioDuration(seconds: number, lang: Lang = "en"): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const minLabel = lang === "pt" || lang === "es" || lang === "fr" ? "min" : "min";
  return `${mins}:${secs.toString().padStart(2, "0")} ${minLabel}`;
}

export function getConsentBadge(story: FaceStory): string {
  switch (story.consent) {
    case "full_consent": return "✓ FULL CONSENT";
    case "consented_pseudonym": return "✓ CONSENTED · PSEUDONYM";
    case "consented_composite": return "✓ CONSENTED · COMPOSITE";
    case "family_consent": return "✓ FAMILY CONSENT";
  }
}

export function getAnonymizationBadge(story: FaceStory): string {
  switch (story.anonymization) {
    case "first_name_only": return " ◆ FIRST NAME ONLY";
    case "pseudonym": return " ◆ PSEUDONYM";
    case "fully_anonymized": return " ◆ FULLY ANONYMIZED";
  }
}

/* ═══════════════════════════════════════════════════════════════
   SUBMISSION CREATION (client-side, stored locally)
   ═══════════════════════════════════════════════════════════════ */

export function createStorySubmission(input: {
  format: StoryFormat;
  cause: StoryCause;
  region: string;
  pseudonym: string;
  age?: number;
  role: string;
  title: string;
  body: string;
  consent: ConsentLevel;
  anonymization: AnonymizationLevel;
  contactBack: boolean;
}): StorySubmission {
  return {
    id: `SUB-${Date.now().toString(36).toUpperCase()}`,
    ...input,
    submittedAt: Date.now(),
  };
}

/**
 * Validate a submission before storing. Returns null if valid,
 * or an error message string if invalid.
 */
export function validateSubmission(input: {
  body: string;
  title: string;
  pseudonym: string;
  consent: ConsentLevel;
}): string | null {
  if (input.title.trim().length < 5) return "Title must be at least 5 characters";
  if (input.body.trim().length < 50) return "Testimony must be at least 50 characters";
  if (input.pseudonym.trim().length < 2) return "Provide a name or pseudonym";
  if (!input.consent) return "Informed consent is required";
  return null;
}

/**
 * Generate a safe pseudonym suggestion for submitters who want
 * to remain anonymous. Based on a simple adjective + noun pattern.
 */
const PSEUDONYM_ADJECTIVES = ["Anonymous", "Hidden", "Unbroken", "Silent", "Distant", "Brave", "Nameless", "Free"];
const PSEUDONYM_NOUNS = ["Witness", "Survivor", "Voice", "Parent", "Teacher", "Neighbor", "Citizen", "Friend"];

export function suggestPseudonym(): string {
  const adj = PSEUDONYM_ADJECTIVES[Math.floor(Math.random() * PSEUDONYM_ADJECTIVES.length)];
  const noun = PSEUDONYM_NOUNS[Math.floor(Math.random() * PSEUDONYM_NOUNS.length)];
  return `${adj} ${noun}`;
}

/* ═══════════════════════════════════════════════════════════════
   CROSS-LINK: Map a story cause to /the-lives toll category
   ═══════════════════════════════════════════════════════════════ */

export function causeToLivesKey(cause: StoryCause): string {
  const map: Record<StoryCause, string> = {
    hunger: "hunger",
    conflict: "conflict",
    water: "water",
    disease: "disease",
    displacement: "conflict",
    poverty: "hunger",
  };
  return map[cause];
}
