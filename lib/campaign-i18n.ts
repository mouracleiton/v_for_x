/**
 * V FOR X — Country language detection + campaign translations
 *
 * Maps ISO3 codes to primary language, then provides translated
 * phrase templates for the campaign generator.
 */

export type CampaignLang = "en" | "pt" | "es" | "fr" | "ar";

export const CAMPAIGN_LANGS: { id: CampaignLang; label: string; flag: string }[] = [
  { id: "en", label: "EN", flag: "🇬🇧" },
  { id: "pt", label: "PT", flag: "🇧🇷" },
  { id: "es", label: "ES", flag: "🇪🇸" },
  { id: "fr", label: "FR", flag: "🇫🇷" },
  { id: "ar", label: "AR", flag: "🇸🇦" },
];

/** ISO3 → primary language code. Unlisted = English. */
const ISO3_LANG: Record<string, CampaignLang> = {
  // Portuguese (Lusophone)
  BRA: "pt", AGO: "pt", MOZ: "pt", PRT: "pt", CPV: "pt",
  GNB: "pt", STP: "pt", TLS: "pt",
  // Spanish (Hispanophone)
  ESP: "es", MEX: "es", COL: "es", ARG: "es", PER: "es",
  VEN: "es", CHL: "es", ECU: "es", GTM: "es", CUB: "es",
  BOL: "es", DOM: "es", HND: "es", PRY: "es", SLV: "es",
  NIC: "es", CRI: "es", PAN: "es", URY: "es", PRI: "es",
  // French (Francophone)
  FRA: "fr", BEL: "fr", LUX: "fr", MCO: "fr",
  CIV: "fr", SEN: "fr", MLI: "fr", BFA: "fr", NER: "fr",
  TCD: "fr", CAF: "fr", GAB: "fr", COG: "fr", COD: "fr",
  MDG: "fr", BEN: "fr", TGO: "fr", GIN: "fr", BDI: "fr",
  RWA: "fr", DJI: "fr", COM: "fr", HTI: "fr",
  MTQ: "fr", GLP: "fr", GUF: "fr", REU: "fr", NCL: "fr",
  // Arabic
  SAU: "ar", EGY: "ar", DZA: "ar", MAR: "ar", IRQ: "ar",
  SYR: "ar", YEM: "ar", LBY: "ar", TUN: "ar", JOR: "ar",
  LBN: "ar", PSE: "ar", SOM: "ar", SDN: "ar", SSD: "ar",
  KWT: "ar", ARE: "ar", QAT: "ar", BHR: "ar", OMN: "ar",
  MRT: "ar",
  // Russian — uses English templates for now (ru phrases not yet written)
  // RUS: "ru", BLR: "ru", KAZ: "ru", KGZ: "ru",
};

/** Detect country language from ISO3 */
export function detectLang(iso3: string): CampaignLang {
  return ISO3_LANG[iso3] ?? "en";
}

/* ═══ TRANSLATED PHRASE TEMPLATES ═══
 * Each phrase uses {placeholders} that get filled with country-specific data.
 * The actual numbers stay the same — we translate the framing and structure.
 */

interface PhraseTemplates {
  threadHook: (name: string, headline: string, context: string) => string;
  threadNeed: (category: string, name: string, headline: string, context: string) => string;
  threadMilitary: (name: string, militaryPct: number, days: string) => string;
  threadSolution: (hungerCost: string, militaryT: string, quickWins: string) => string;
  threadDemand: (name: string, isHotspot: boolean) => string;
  whatsappIntro: (name: string) => string;
  whatsappCTA: string;
  instagramTags: (name: string) => string;
  notFate: string;
  thisIsPolicy: string;
  perDay: string;
  globalContext: string;
}

export const PHRASES: Record<CampaignLang, PhraseTemplates> = {
  en: {
    threadHook: (name, headline, context) =>
      `${name.toUpperCase()} — THE REALITY\n\n${headline}.\n\n${context}\n\nThis is not fate. This is policy.\n\nA thread on what ${name} actually needs ↓`,
    threadNeed: (category, name, headline, context) =>
      `${category}\n\n${name}: ${headline}.\n\n${context}\n\nThe world has the resources to fix this. We choose not to.`,
    threadMilitary: (name, militaryPct, days) =>
      `THE COST OF INACTION\n\n${name} spends more on military than health.\n\nIt would take ${days} of ${name}'s OWN military budget to feed every hungry person.\n\nThat's not a dream. That's arithmetic.`,
    threadSolution: (hungerCost, militaryT, quickWins) =>
      `THE SOLUTION EXISTS\n\nEnding global hunger costs $${hungerCost}B/year.\n\nThe world spends $${militaryT}T/year on weapons.\n\nThat's 14 days.\n\nSafe water + healthcare + electricity + education for everyone: $${quickWins}B = 64 days.\n\nWe can afford this 6 times over.`,
    threadDemand: (name, isHotspot) =>
      `WHAT TO DO\n\n1. Share this thread. The silence is the problem.\n2. Contact your representatives. Demand humanitarian funding.\n3. Support organizations doing the work.\n4. Push for military spending reallocation.\n\n${isHotspot ? `${name} is a WFP hunger hotspot. ` : ""}Every share reaches someone who didn't know.\n\nFull data: mouracleiton.github.io/v_for_x`,
    whatsappIntro: (name) => `${name.toUpperCase()} — DID YOU KNOW?`,
    whatsappCTA: "We choose war over people every single day. Share if you think that needs to change.",
    instagramTags: (name) => `#${name.replace(/\s+/g, "")} #ZeroHunger #SDG2 #EndPoverty #DataForGood #VForX`,
    notFate: "This is not fate.",
    thisIsPolicy: "This is policy.",
    perDay: "every single day",
    globalContext: "The world has the resources to fix this.",
  },

  pt: {
    threadHook: (name, headline, context) =>
      `${name.toUpperCase()} — A REALIDADE\n\n${headline}.\n\n${context}\n\nIsso não é destino. É política.\n\nUm fio sobre o que ${name} realmente precisa ↓`,
    threadNeed: (category, name, headline, context) =>
      `${category}\n\n${name}: ${headline}.\n\n${context}\n\nO mundo tem recursos para consertar isso. A gente escolhe não fazer.`,
    threadMilitary: (name, militaryPct, days) =>
      `O CUSTO DA OMISSÃO\n\n${name} gasta mais com militares do que com saúde.\n\nLevaria ${days} do orçamento militar PRÓPRIO de ${name} para alimentar cada pessoa com fome.\n\nIsso não é sonho. É aritmética.`,
    threadSolution: (hungerCost, militaryT, quickWins) =>
      `A SOLUÇÃO EXISTE\n\nAcabar com a fome global custa $${hungerCost}B/ano.\n\nO mundo gasta $${militaryT}T/ano em armas.\n\nSão 14 dias.\n\nÁgua + saúde + energia + educação para todos: $${quickWins}B = 64 dias.\n\nA gente consegue pagar isso 6 vezes.`,
    threadDemand: (name, isHotspot) =>
      `O QUE FAZER\n\n1. Compartilhe esse fio. O silêncio é o problema.\n2. Pressione seus representantes. Exija financiamento humanitário.\n3. Apoie organizações que fazem o trabalho.\n4. Pressione por realocação do gasto militar.\n\n${isHotspot ? `${name} é um hotspot de fome da WFP. ` : ""}Cada compartilhamento alcança quem não sabia.\n\nDados completos: mouracleiton.github.io/v_for_x`,
    whatsappIntro: (name) => `${name.toUpperCase()} — VOCÊ SABIA?`,
    whatsappCTA: "O mundo escolhe armas em vez de pessoas todos os dias. Compartilhe se você acha que isso precisa mudar.",
    instagramTags: (name) => `#${name.replace(/\s+/g, "")} #FomeZero #ODS2 #FimDaPobreza #DadosPB #VForX`,
    notFate: "Isso não é destino.",
    thisIsPolicy: "É política.",
    perDay: "todos os dias",
    globalContext: "O mundo tem recursos para consertar isso.",
  },

  es: {
    threadHook: (name, headline, context) =>
      `${name.toUpperCase()} — LA REALIDAD\n\n${headline}.\n\n${context}\n\nEsto no es destino. Es política.\n\nUn hilo sobre lo que ${name} realmente necesita ↓`,
    threadNeed: (category, name, headline, context) =>
      `${category}\n\n${name}: ${headline}.\n\n${context}\n\nEl mundo tiene recursos para arreglar esto. Elegimos no hacerlo.`,
    threadMilitary: (name, militaryPct, days) =>
      `EL COSTO DE LA INACCIÓN\n\n${name} gasta más en militares que en salud.\n\nTomaría ${days} del presupuesto militar PROPIO de ${name} para alimentar a cada persona con hambre.\n\nEso no es un sueño. Es aritmética.`,
    threadSolution: (hungerCost, militaryT, quickWins) =>
      `LA SOLUCIÓN EXISTE\n\nTerminar el hambre global cuesta $${hungerCost}B/año.\n\nEl mundo gasta $${militaryT}T/año en armas.\n\nSon 14 días.\n\nAgua + salud + energía + educación para todos: $${quickWins}B = 64 días.\n\nPodemos pagar esto 6 veces.`,
    threadDemand: (name, isHotspot) =>
      `QUÉ HACER\n\n1. Comparte este hilo. El silencio es el problema.\n2. Contacta a tus representantes. Exige financiamiento humanitario.\n3. Apoya organizaciones que hacen el trabajo.\n4. Presiona por la reasignación del gasto militar.\n\n${isHotspot ? `${name} es un punto crítico de hambre del PMA. ` : ""}Cada compartido llega a alguien que no sabía.\n\nDatos completos: mouracleiton.github.io/v_for_x`,
    whatsappIntro: (name) => `${name.toUpperCase()} — ¿SABÍAS QUE?`,
    whatsappCTA: "El mundo elige armas sobre personas cada día. Comparte si crees que eso debe cambiar.",
    instagramTags: (name) => `#${name.replace(/\s+/g, "")} #HambreCero #ODS2 #FinPobreza #DatosBien #VForX`,
    notFate: "Esto no es destino.",
    thisIsPolicy: "Es política.",
    perDay: "cada día",
    globalContext: "El mundo tiene recursos para arreglar esto.",
  },

  fr: {
    threadHook: (name, headline, context) =>
      `${name.toUpperCase()} — LA RÉALITÉ\n\n${headline}.\n\n${context}\n\nCe n'est pas une fatalité. C'est un choix politique.\n\nUn thread sur ce dont ${name} a vraiment besoin ↓`,
    threadNeed: (category, name, headline, context) =>
      `${category}\n\n${name} : ${headline}.\n\n${context}\n\nLe monde a les ressources pour régler ça. On choisit de ne pas le faire.`,
    threadMilitary: (name, militaryPct, days) =>
      `LE COÛT DE L'INACTION\n\n${name} dépense plus pour l'armée que pour la santé.\n\nIl faudrait ${days} du budget militaire PROPRE de ${name} pour nourrir chaque personne affamée.\n\nCe n'est pas un rêve. C'est de l'arithmétique.`,
    threadSolution: (hungerCost, militaryT, quickWins) =>
      `LA SOLUTION EXISTE\n\nMettre fin à la faim dans le monde coûte $${hungerCost}B/an.\n\nLe monde dépense $${militaryT}T/an en armes.\n\nC'est 14 jours.\n\nEau + santé + électricité + éducation pour tous : $${quickWins}B = 64 jours.\n\nOn peut se le permettre 6 fois.`,
    threadDemand: (name, isHotspot) =>
      `QUE FAIRE\n\n1. Partagez ce thread. Le silence est le problème.\n2. Contactez vos élus. Exigez du financement humanitaire.\n3. Soutenez les organisations qui agissent.\n4. Poussez pour la réaffectation des dépenses militaires.\n\n${isHotspot ? `${name} est un point chaud de faim du PAM. ` : ""}Chaque partage atteint quelqu'un qui ne savait pas.\n\nDonnées complètes : mouracleiton.github.io/v_for_x`,
    whatsappIntro: (name) => `${name.toUpperCase()} — LE SAVIEZ-VOUS ?`,
    whatsappCTA: "Le monde choisit les armes plutôt que les personnes chaque jour. Partagez si vous pensez que ça doit changer.",
    instagramTags: (name) => `#${name.replace(/\s+/g, "")} #FaimZéro #ODD2 #FinPauvreté #DonnéesBien #VForX`,
    notFate: "Ce n'est pas une fatalité.",
    thisIsPolicy: "C'est un choix politique.",
    perDay: "chaque jour",
    globalContext: "Le monde a les ressources pour régler ça.",
  },

  ar: {
    threadHook: (name, headline, context) =>
      `${name} — الحقيقة\n\n${headline}\n\n${context}\n\nهذا ليس قدراً. هذا سياسة.\n\nسلسلة تغريدات عما تحتاجه ${name} فعلاً ↓`,
    threadNeed: (category, name, headline, context) =>
      `${category}\n\n${name}: ${headline}\n\n${context}\n\nالعالم لديه الموارد لإصلاح هذا. نحن نختار ألا نفعل.`,
    threadMilitary: (name, militaryPct, days) =>
      `تكلفة التقاعس\n\n${name} تنفق على الجيش أكثر من الصحة.\n\nسيتطلب ${days} من ميزانية ${name} العسكرية الخاصة لإطعام كل جائع.\n\nهذا ليس حلماً. هذا حساب.`,
    threadSolution: (hungerCost, militaryT, quickWins) =>
      `الحل موجود\n\nإنهاء الجوع العالمي يكلف $${hungerCost}B سنوياً.\n\nالعالم ينفق $${militaryT}T سنوياً على الأسلحة.\n\nهذا 14 يوماً.\n\nماء + رعاية صحية + كهرباء + تعليم للجميع: $${quickWins}B = 64 يوماً.\n\nيمكننا تحمل ذلك 6 مرات.`,
    threadDemand: (name, isHotspot) =>
      `ماذا تفعل\n\n1. شارك هذه السلسلة. الصمت هو المشكلة.\n2. اتصل بممثليك. اطلب تمويلاً إنسانياً.\n3. ادعم المنظمات التي تقوم بالعمل.\n4. اضغط من أجل إعادة توجيه الإنفاق العسكري.\n\n${isHotspot ? `${name} نقطة ساخنة للجوع حسب برنامج الأغذية العالمي. ` : ""}كل مشاركة تصل لشخص لم يكن يعرف.\n\nالبيانات الكاملة: mouracleiton.github.io/v_for_x`,
    whatsappIntro: (name) => `${name} — هل كنت تعلم؟`,
    whatsappCTA: "العالم يختار الأسلحة بدلاً من الناس كل يوم. شارك إذا كنت تعتقد أن هذا يجب أن يتغير.",
    instagramTags: (name) => `#${name.replace(/\s+/g, "")} #الجوع_صفر #أهداف_التنمية #نهاية_الفقر #بيانات_خير #VForX`,
    notFate: "هذا ليس قدراً.",
    thisIsPolicy: "هذا سياسة.",
    perDay: "كل يوم",
    globalContext: "العالم لديه الموارد لإصلاح هذا.",
  },
};

/* ═══ NEED HEADLINE TRANSLATIONS ═══ */

interface NeedPhrase {
  headline: (val: number, pop?: number) => string;
  context: (val: number, pop?: number) => string;
}

// For v1, the need headlines stay in English (they contain country-specific numbers).
// The thread structure, framing, and CTA are fully translated.
// This covers 90% of the perceived translation value — the numbers are universal.
