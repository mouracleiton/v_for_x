/**
 * V FOR X — Country language detection + campaign translations
 *
 * Maps ISO3 codes to primary language, then provides translated
 * phrase templates for the campaign generator.
 *
 * Supports 10 languages: en, pt, es, fr, ar, zh, ja, ko, hi, ru
 */

export type CampaignLang = "en" | "pt" | "es" | "fr" | "ar" | "zh" | "ja" | "ko" | "hi" | "ru";

export const CAMPAIGN_LANGS: { id: CampaignLang; label: string; flag: string }[] = [
  { id: "en", label: "EN", flag: "🇬🇧" },
  { id: "pt", label: "PT", flag: "🇧🇷" },
  { id: "es", label: "ES", flag: "🇪🇸" },
  { id: "fr", label: "FR", flag: "🇫🇷" },
  { id: "ar", label: "AR", flag: "🇸🇦" },
  { id: "zh", label: "ZH", flag: "🇨🇳" },
  { id: "ja", label: "JA", flag: "🇯🇵" },
  { id: "ko", label: "KO", flag: "🇰🇷" },
  { id: "hi", label: "HI", flag: "🇮🇳" },
  { id: "ru", label: "RU", flag: "🇷🇺" },
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
  // Chinese (Sinophone)
  CHN: "zh", TWN: "zh", SGP: "zh", HKG: "zh", MAC: "zh",
  // Japanese
  JPN: "ja",
  // Korean
  KOR: "ko", PRK: "ko",
  // Hindi
  IND: "hi", NPL: "hi", BTN: "hi", LKA: "hi",
  // Russian
  RUS: "ru", BLR: "ru", KAZ: "ru", KGZ: "ru",
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
  yearUnit: string;
  daysUnit: string;
  worldSpends: string;
  onWeapons: string;
  endingHunger: string;
  daysMilitarySpending: string;
  noCrisisHeadline: string;
  noCrisisContext: string;
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
    yearUnit: "yr",
    daysUnit: "days",
    worldSpends: "The world spends",
    onWeapons: "on weapons",
    endingHunger: "Ending hunger",
    daysMilitarySpending: "days of military spending",
    noCrisisHeadline: "Doesn't appear in crisis data",
    noCrisisContext: "But that doesn't mean there's nothing to fix.",
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
    yearUnit: "ano",
    daysUnit: "dias",
    worldSpends: "O mundo gasta",
    onWeapons: "em armas",
    endingHunger: "Acabar com a fome",
    daysMilitarySpending: "dias de gasto militar",
    noCrisisHeadline: "Não aparece nos dados de crise",
    noCrisisContext: "Mas não significa que não há nada a consertar.",
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
    yearUnit: "año",
    daysUnit: "días",
    worldSpends: "El mundo gasta",
    onWeapons: "en armas",
    endingHunger: "Terminar el hambre",
    daysMilitarySpending: "días de gasto militar",
    noCrisisHeadline: "No aparece en los datos de crisis",
    noCrisisContext: "Pero no significa que no haya nada que arreglar.",
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
    yearUnit: "an",
    daysUnit: "jours",
    worldSpends: "Le monde dépense",
    onWeapons: "en armes",
    endingHunger: "Mettre fin à la faim",
    daysMilitarySpending: "jours de dépense militaire",
    noCrisisHeadline: "N'apparaît pas dans les données de crise",
    noCrisisContext: "Mais ça ne veut rien dire.",
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
    yearUnit: "سنة",
    daysUnit: "يوم",
    worldSpends: "العالم ينفق",
    onWeapons: "على الأسلحة",
    endingHunger: "إنهاء الجوع",
    daysMilitarySpending: "يوم من الإنفاق العسكري",
    noCrisisHeadline: "لا يظهر في بيانات الأزمة",
    noCrisisContext: "لكن هذا لا يعني أنه لا يوجد شيء لإصلاحه.",
  },

  zh: {
    threadHook: (name, headline, context) =>
      `${name.toUpperCase()} — 现实\n\n${headline}。\n\n${context}\n\n这不是命运。这是政策。\n\n关于${name}真正需要什么的帖子 ↓`,
    threadNeed: (category, name, headline, context) =>
      `${category}\n\n${name}：${headline}。\n\n${context}\n\n世界有资源解决这个问题。我们选择不去解决。`,
    threadMilitary: (name, militaryPct, days) =>
      `不作为的代价\n\n${name}在军事上的花费超过医疗。\n\n只需要${name}自身军事预算的${days}就能养活每一个饥饿的人。\n\n这不是梦想。这是算术。`,
    threadSolution: (hungerCost, militaryT, quickWins) =>
      `解决方案存在\n\n终结全球饥饿每年花费$${hungerCost}B。\n\n世界每年在武器上花费$${militaryT}T。\n\n这只是14天。\n\n为所有人提供安全饮水+医疗+电力+教育：$${quickWins}B = 64天。\n\n我们能承担这费用6次。`,
    threadDemand: (name, isHotspot) =>
      `该怎么做\n\n1. 分享这个帖子。沉默才是问题。\n2. 联系你的代表。要求人道主义资金。\n3. 支持做实事的组织。\n4. 推动军费开支重新分配。\n\n${isHotspot ? `${name}是WFP饥饿热点。 ` : ""}每一次分享都能触达不知情的人。\n\n完整数据：mouracleiton.github.io/v_for_x`,
    whatsappIntro: (name) => `${name.toUpperCase()} — 你知道吗？`,
    whatsappCTA: "世界每天都在选择武器而非人。如果你认为这需要改变，请分享。",
    instagramTags: (name) => `#${name.replace(/\s+/g, "")} #零饥饿 #SDG2 #消除贫困 #数据向善 #VForX`,
    notFate: "这不是命运。",
    thisIsPolicy: "这是政策。",
    perDay: "每一天",
    globalContext: "世界有资源解决这个问题。",
    yearUnit: "年",
    daysUnit: "天",
    worldSpends: "世界花费",
    onWeapons: "在武器上",
    endingHunger: "消除饥饿",
    daysMilitarySpending: "天的军费开支",
    noCrisisHeadline: "未出现在危机数据中",
    noCrisisContext: "但这并不意味着没有什么需要修复的。",
  },

  ja: {
    threadHook: (name, headline, context) =>
      `${name.toUpperCase()} — 現実\n\n${headline}。\n\n${context}\n\nこれは運命ではない。政策の結果だ。\n\n${name}が本当に必要なものについてのスレッド ↓`,
    threadNeed: (category, name, headline, context) =>
      `${category}\n\n${name}：${headline}。\n\n${context}\n\n世界にはこれを解決する資源がある。私たちが選ばないだけだ。`,
    threadMilitary: (name, militaryPct, days) =>
      `放置の代償\n\n${name}は医療よりも軍事に多くを費やしている。\n\n${name}自身の軍事予算の${days}で、飢えた人々全員を養える。\n\nこれは夢ではない。算数だ。`,
    threadSolution: (hungerCost, militaryT, quickWins) =>
      `解決策は存在する\n\n世界の飢餓を終わらせる費用は年間$${hungerCost}B。\n\n世界は年間$${militaryT}Tを兵器に費やしている。\n\nそれは14日分だ。\n\n安全な水+医療+電力+教育を全員に：$${quickWins}B = 64日分。\n\n私たちはこれを6回分支払える。`,
    threadDemand: (name, isHotspot) =>
      `何をすべきか\n\n1. このスレッドをシェアする。沈黙が問題だ。\n2. 代表者に連絡する。人道支援資金を要求する。\n3. 活動する組織を支援する。\n4. 軍事費の再配分を求める。\n\n${isHotspot ? `${name}はWFPの飢餓ホットスポットだ。 ` : ""}すべてのシェアが、知らなかった人に届く。\n\n完全なデータ：mouracleiton.github.io/v_for_x`,
    whatsappIntro: (name) => `${name.toUpperCase()} — ご存知ですか？`,
    whatsappCTA: "世界は毎日、人々よりも兵器を選んでいる。それを変えるべきだと思うならシェアを。",
    instagramTags: (name) => `#${name.replace(/\s+/g, "")} #飢餓ゼロ #SDG2 #貧困終焉 #データ善用 #VForX`,
    notFate: "これは運命ではない。",
    thisIsPolicy: "政策の結果だ。",
    perDay: "毎日",
    globalContext: "世界にはこれを解決する資源がある。",
    yearUnit: "年",
    daysUnit: "日",
    worldSpends: "世界は費やす",
    onWeapons: "武器に",
    endingHunger: "飢餓を終わらせる",
    daysMilitarySpending: "日分の軍事支出",
    noCrisisHeadline: "危機データに表示されていない",
    noCrisisContext: "しかし、修正すべきことがないという意味ではない。",
  },

  ko: {
    threadHook: (name, headline, context) =>
      `${name.toUpperCase()} — 현실\n\n${headline}.\n\n${context}\n\n이것은 운명이 아닙니다. 정책의 결과입니다.\n\n${name}가 진정으로 필요한 것에 대한 스레드 ↓`,
    threadNeed: (category, name, headline, context) =>
      `${category}\n\n${name}: ${headline}.\n\n${context}\n\n세계에는 이것을 해결할 자원이 있습니다. 우리가 선택하지 않을 뿐입니다.`,
    threadMilitary: (name, militaryPct, days) =>
      `무관심의 대가\n\n${name}는 보건보다 국방에 더 많이 지출합니다.\n\n${name} 자체 군사 예산의 ${days}면 모든 굶주린 사람을 먹일 수 있습니다.\n\n이것은 꿈이 아닙니다. 산수입니다.`,
    threadSolution: (hungerCost, militaryT, quickWins) =>
      `해결책은 존재합니다\n\n세계 기아 종식 비용은 연간 $${hungerCost}B입니다.\n\n세계는 연간 $${militaryT}T를 무기에 지출합니다.\n\n이는 14일 분입니다.\n\n안전한 물 + 의료 + 전력 + 교육을 모두에게: $${quickWins}B = 64일 분.\n\n우리는 이것을 6배나 감당할 수 있습니다.`,
    threadDemand: (name, isHotspot) =>
      `무엇을 해야 할까\n\n1. 이 스레드를 공유하세요. 침묵이 문제입니다.\n2. 대표자에게 연락하세요. 인도적 자금을 요구하세요.\n3. 일하는 단체를 지원하세요.\n4. 군사비 재분배를 촉구하세요.\n\n${isHotspot ? `${name}는 WFP 기아 핫스팟입니다. ` : ""}모든 공유는 몰랐던 누군가에게 닿습니다.\n\n전체 데이터: mouracleiton.github.io/v_for_x`,
    whatsappIntro: (name) => `${name.toUpperCase()} — 알고 계셨나요?`,
    whatsappCTA: "세계는 매일 무기보다 사람을 덜 중요하게 여깁니다. 이것이 바뀌어야 한다고 생각하면 공유하세요.",
    instagramTags: (name) => `#${name.replace(/\s+/g, "")} #제로헝거 #SDG2 #빈곤퇴치 #데이터선용 #VForX`,
    notFate: "이것은 운명이 아닙니다.",
    thisIsPolicy: "정책의 결과입니다.",
    perDay: "매일",
    globalContext: "세계에는 이것을 해결할 자원이 있습니다.",
    yearUnit: "년",
    daysUnit: "일",
    worldSpends: "세계는 지출한다",
    onWeapons: "무기에",
    endingHunger: "기아 종식",
    daysMilitarySpending: "일의 군사비 지출",
    noCrisisHeadline: "위기 데이터에 나타나지 않음",
    noCrisisContext: "하지만 고칠 것이 없다는 뜻은 아니다.",
  },

  hi: {
    threadHook: (name, headline, context) =>
      `${name.toUpperCase()} — वास्तविकता\n\n${headline}.\n\n${context}\n\nयह नियति नहीं है। यह नीति है।\n\n${name} को वास्तव में क्या चाहिए, इस पर एक थ्रेड ↓`,
    threadNeed: (category, name, headline, context) =>
      `${category}\n\n${name}: ${headline}.\n\n${context}\n\nदुनिया के पास इसे ठीक करने के संसाधन हैं। हम ऐसा नहीं करना चुनते हैं।`,
    threadMilitary: (name, militaryPct, days) =>
      `निष्क्रियता की कीमत\n\n${name} स्वास्थ्य से अधिक सैन्य पर खर्च करता है।\n\nहर भूखे व्यक्ति को खिलाने के लिए ${name} के अपने सैन्य बजट के ${days} लगेंगे।\n\nयह कोई सपना नहीं है। यह अंकगणित है।`,
    threadSolution: (hungerCost, militaryT, quickWins) =>
      `समाधान मौजूद है\n\nवैश्विक भूख समाप्त करने की लागत $${hungerCost}B/वर्ष है।\n\nदुनिया हथियारों पर $${militaryT}T/वर्ष खर्च करती है।\n\nयह 14 दिन हैं।\n\nसभी के लिए स्वच्छ जल + स्वास्थ्य + बिजली + शिक्षा: $${quickWins}B = 64 दिन।\n\nहम इसे 6 गुना वहन कर सकते हैं।`,
    threadDemand: (name, isHotspot) =>
      `क्या करें\n\n1. इस थ्रेड को साझा करें। चुप्पी ही समस्या है।\n2. अपने प्रतिनिधियों से संपर्क करें। मानवीय वित्तपोषण की मांग करें।\n3. काम करने वाले संगठनों का समर्थन करें।\n4. सैन्य खर्च के पुनःआवंटन के लिए दबाव डालें।\n\n${isHotspot ? `${name} WFP भूख हॉटस्पॉट है। ` : ""}हर साझा करना उस व्यक्ति तक पहुँचता है जिसे यह नहीं पता था।\n\nसंपूर्ण डेटा: mouracleiton.github.io/v_for_x`,
    whatsappIntro: (name) => `${name.toUpperCase()} — क्या आप जानते हैं?`,
    whatsappCTA: "दुनिया हर दिन लोगों के बजाय हथियार चुनती है। अगर आपको लगता है कि इसे बदलना है, तो साझा करें।",
    instagramTags: (name) => `#${name.replace(/\s+/g, "")} #जीरोहंगर #SDG2 #गरीबीअंत #डेटाफॉरगुड #VForX`,
    notFate: "यह नियति नहीं है।",
    thisIsPolicy: "यह नीति है।",
    perDay: "हर दिन",
    globalContext: "दुनिया के पास इसे ठीक करने के संसाधन हैं।",
    yearUnit: "वर्ष",
    daysUnit: "दिन",
    worldSpends: "दुनिया खर्च करती है",
    onWeapons: "हथियारों पर",
    endingHunger: "भूख समाप्त करना",
    daysMilitarySpending: "दिन का सैन्य खर्च",
    noCrisisHeadline: "संकट डेटा में दिखाई नहीं देता",
    noCrisisContext: "लेकिन इसका मतलब यह नहीं कि ठीक करने के लिए कुछ नहीं है।",
  },

  ru: {
    threadHook: (name, headline, context) =>
      `${name.toUpperCase()} — РЕАЛЬНОСТЬ\n\n${headline}.\n\n${context}\n\nЭто не судьба. Это политика.\n\nТред о том, что ${name} действительно нужно ↓`,
    threadNeed: (category, name, headline, context) =>
      `${category}\n\n${name}: ${headline}.\n\n${context}\n\nУ мира есть ресурсы это исправить. Мы выбираем этого не делать.`,
    threadMilitary: (name, militaryPct, days) =>
      `ЦЕНА БЕЗДЕЙСТВИЯ\n\n${name} тратит на военные нужды больше, чем на здравоохранение.\n\nПотребуется ${days} собственного военного бюджета ${name}, чтобы накормить каждого голодающего.\n\nЭто не мечта. Это арифметика.`,
    threadSolution: (hungerCost, militaryT, quickWins) =>
      `РЕШЕНИЕ СУЩЕСТВУЕТ\n\nПокончить с мировым голодом стоит $${hungerCost}B/год.\n\nМир тратит $${militaryT}T/год на оружие.\n\nЭто 14 дней.\n\nЧистая вода + здравоохранение + электричество + образование для всех: $${quickWins}B = 64 дня.\n\nМы можем позволить себе это в 6 раз.`,
    threadDemand: (name, isHotspot) =>
      `ЧТО ДЕЛАТЬ\n\n1. Поделитесь этим тредом. Молчание — это проблема.\n2. Свяжитесь со своими представителями. Требуйте гуманитарного финансирования.\n3. Поддержите организации, которые работают.\n4. Требуйте перераспределения военных расходов.\n\n${isHotspot ? `${name} — очаг голода по данным ВПП. ` : ""}Каждый репост достигает кого-то, кто не знал.\n\nПолные данные: mouracleiton.github.io/v_for_x`,
    whatsappIntro: (name) => `${name.toUpperCase()} — ЗНАЛИ ЛИ ВЫ?`,
    whatsappCTA: "Мир каждый день выбирает оружие вместо людей. Поделитесь, если считаете, что это нужно менять.",
    instagramTags: (name) => `#${name.replace(/\s+/g, "")} #НольГолода #ЦУР2 #КонецБедности #ДанныеВоБлаго #VForX`,
    notFate: "Это не судьба.",
    thisIsPolicy: "Это политика.",
    perDay: "каждый день",
    globalContext: "У мира есть ресурсы это исправить.",
    yearUnit: "год",
    daysUnit: "дней",
    worldSpends: "Мир тратит",
    onWeapons: "на оружие",
    endingHunger: "Покончить с голодом",
    daysMilitarySpending: "дней военных расходов",
    noCrisisHeadline: "Не отображается в данных о кризисе",
    noCrisisContext: "Но это не значит, что нечего исправлять.",
  },
};

/* ═══ NEED HEADLINE + CONTEXT TRANSLATIONS ═══
 *
 * Each metric path maps to headline/context templates for all 10 languages.
 * {v} is replaced with the metric value; {popV} is a derived population figure
 * (already in millions). For metrics whose value IS already in millions
 * (e.g. severe_food_insecurity_m), only {v} is used.
 */

export interface NeedTemplate {
  headline: string;  // uses {v} placeholder
  context: string;   // uses {v} and/or {popV} placeholder
}

// Key = metric path (e.g. "hunger.undernourishment_pct")
export const NEED_I18N: Record<string, Record<CampaignLang, NeedTemplate>> = {
  /* ─── HUNGER ─── */
  "hunger.undernourishment_pct": {
    en: { headline: "{v}% of the population is undernourished", context: "That's {popV} million people who don't have enough to eat — every single day." },
    pt: { headline: "{v}% da população está subnutrida", context: "São {popV} milhões de pessoas sem comida suficiente — todos os dias." },
    es: { headline: "{v}% de la población está desnutrida", context: "Son {popV} millones de personas sin comida suficiente — todos los días." },
    fr: { headline: "{v}% de la population est sous-alimentée", context: "C'est {popV} millions de personnes qui n'ont pas assez à manger — chaque jour." },
    ar: { headline: "{v}% من السكان يعانون من سوء التغذية", context: "هذا يعني {popV} مليون شخص لا يجدون ما يكفي من الطعام — كل يوم." },
    zh: { headline: "{v}%的人口营养不良", context: "这意味着{popV}百万人每天吃不饱饭。" },
    ja: { headline: "人口の{v}%が栄養失調です", context: "それは{popV}百万人が毎日十分な食料を得られていないということです。" },
    ko: { headline: "인구의 {v}%가 영양실조입니다", context: "이는 {popV}백만 명이 매일 충분한 식량을 얻지 못한다는 뜻입니다." },
    hi: { headline: "जनसंख्या का {v}% कुपोषित है", context: "यह {popV} मिलियन लोग हैं जिन्हें हर दिन पर्याप्त भोजन नहीं मिलता।" },
    ru: { headline: "{v}% населения страдает от недоедания", context: "Это {popV} миллионов человек, которым каждый день не хватает еды." },
  },
  "hunger.child_stunting_pct": {
    en: { headline: "{v}% of children are stunted — permanently damaged by malnutrition", context: "These children will never reach their full physical or cognitive potential. This is irreversible." },
    pt: { headline: "{v}% das crianças sofrem de nanismo — danos permanentes pela desnutrição", context: "Essas crianças nunca alcançarão seu potencial físico ou cognitivo. Isso é irreversível." },
    es: { headline: "{v}% de los niños sufren retraso del crecimiento — daño permanente por desnutrición", context: "Estos niños nunca alcanzarán su potencial físico o cognitivo. Es irreversible." },
    fr: { headline: "{v}% des enfants souffrent de retard de croissance — dommages permanents dus à la malnutrition", context: "Ces enfants n'atteindront jamais leur potentiel physique ou cognitif. C'est irréversible." },
    ar: { headline: "{v}% من الأطفال يعانون من توقف النمو — ضرر دائم بسبب سوء التغذية", context: "هؤلاء الأطفال لن يصلوا أبداً إلى كامل إمكاناتهم البدنية أو الذهنية. هذا لا يمكن عكسه." },
    zh: { headline: "{v}%的儿童发育迟缓——因营养不良遭受永久性损害", context: "这些儿童永远无法达到他们应有的身体或认知潜力。这是不可逆转的。" },
    ja: { headline: "{v}%の子どもが発育障害——栄養失調による永久のダメージ", context: "これらの子どもは決して本来の身体的能力や認知能力に達することはありません。これは不可逆的です。" },
    ko: { headline: "{v}%의 아동이 발육부진 — 영양실조로 인한 영구적 손상", context: "이 아이들은 결코 신체적, 인지적 잠재력에 도달하지 못할 것입니다. 이는 되돌릴 수 없습니다." },
    hi: { headline: "{v}% बच्चे विकास में पिछड़े हुए हैं — कुपोषण से स्थायी क्षति", context: "ये बच्चे कभी अपनी पूर्ण शारीरिक या संज्ञानात्मक क्षमता तक नहीं पहुँचेंगे। यह अपरिवर्तनीय है।" },
    ru: { headline: "{v}% детей отстают в росте — необратимые последствия недоедания", context: "Эти дети никогда не достигнут своего физического или когнитивного потенциала. Это необратимо." },
  },
  "hunger.child_wasting_pct": {
    en: { headline: "{v}% of children suffer from acute malnutrition (wasting)", context: "These children are dying right now. Wasting means their bodies are consuming themselves to stay alive." },
    pt: { headline: "{v}% das crianças sofrem de desnutrição aguda (emaciação)", context: "Essas crianças estão morrendo agora. Emaciação significa que seus corpos estão se consumindo para permanecer vivos." },
    es: { headline: "{v}% de los niños sufren desnutrición aguda (emaciación)", context: "Estos niños están muriendo ahora mismo. La emaciación significa que sus cuerpos se consumen a sí mismos para sobrevivir." },
    fr: { headline: "{v}% des enfants souffrent de malnutrition aiguë (émaciation)", context: "Ces enfants sont en train de mourir. L'émaciation signifie que leur corps se consume pour rester en vie." },
    ar: { headline: "{v}% من الأطفال يعانون من سوء التغذية الحاد (الهزال)", context: "هؤلاء الأطفال يموتون الآن. الهزال يعني أن أجسادهم تستهلك نفسها للبقاء على قيد الحياة." },
    zh: { headline: "{v}%的儿童患有急性营养不良（消瘦）", context: "这些儿童正在死去。消瘦意味着他们的身体在消耗自己以维持生命。" },
    ja: { headline: "{v}%の子どもが急性栄養失調（消耗）に苦しんでいる", context: "これらの子どもは今まさに死につつあります。消耗とは、生き続けるために体が自分自身を消費していることを意味します。" },
    ko: { headline: "{v}%의 아동이 급성 영양실조(소모증)를 앓고 있습니다", context: "이 아이들은 지금 죽어가고 있습니다. 소모증은 살아남기 위해 몸이 자기 자신을 소비한다는 뜻입니다." },
    hi: { headline: "{v}% बच्चे गंभीर कुपोषण (क्षय) से पीड़ित हैं", context: "ये बच्चे अभी मर रहे हैं। क्षय का मतलब है कि उनके शरीर जीवित रहने के लिए स्वयं को ही खा रहे हैं।" },
    ru: { headline: "{v}% детей страдают от острого недоедания (истощение)", context: "Эти дети умирают прямо сейчас. Истощение означает, что их тела потребляют сами себя, чтобы выжить." },
  },
  "hunger.famine_risk_1to5": {
    en: { headline: "Famine risk: {v}/5 — catastrophe is imminent", context: "This is the highest level of food emergency. People are already dying. International response is needed NOW." },
    pt: { headline: "Risco de fome: {v}/5 — catástrofe é iminente", context: "Este é o nível mais alto de emergência alimentar. Pessoas já estão morrendo. Resposta internacional é necessária AGORA." },
    es: { headline: "Riesgo de hambruna: {v}/5 — la catástrofe es inminente", context: "Este es el nivel más alto de emergencia alimentaria. La gente ya está muriendo. Se necesita respuesta internacional AHORA." },
    fr: { headline: "Risque de famine : {v}/5 — la catastrophe est imminente", context: "C'est le niveau d'urgence alimentaire le plus élevé. Des gens meurent déjà. Une réponse internationale est nécessaire MAINTENANT." },
    ar: { headline: "خطر المجاعة: {v}/5 — الكارثة وشيكة", context: "هذا أعلى مستوى من حالات الطوارئ الغذائية. الناس يموتون بالفعل. الاستجابة الدولية مطلوبة الآن." },
    zh: { headline: "饥荒风险：{v}/5——灾难迫在眉睫", context: "这是最高级别的粮食紧急状态。人们已经在死去。现在就需要国际社会的回应。" },
    ja: { headline: "飢饉リスク：{v}/5 — 災害が差し迫っている", context: "これは最も高いレベルの食料非常事態です。人々はすでに死んでいます。今すぐ国際的な対応が必要です。" },
    ko: { headline: "기근 위험: {v}/5 — 재앙이 임박했습니다", context: "이것은 최고 수준의 식량 비상사태입니다. 사람들이 이미 죽어가고 있습니다. 지금 당장 국제적 대응이 필요합니다." },
    hi: { headline: "अकाल जोखिम: {v}/5 — तबाही निकट है", context: "यह खाद्य आपातकाल का सर्वोच्च स्तर है। लोग पहले से ही मर रहे हैं। अभी अंतर्राष्ट्रीय प्रतिक्रिया चाहिए।" },
    ru: { headline: "Риск голода: {v}/5 — катастрофа неизбежна", context: "Это высший уровень продовольственной чрезвычайной ситуации. Люди уже умирают. Международное реагирование нужно СЕЙЧАС." },
  },
  "hunger.food_insecurity_mod_severe_pct": {
    en: { headline: "{v}% of the population faces moderate or severe food insecurity", context: "{popV} million people don't know where their next meal is coming from." },
    pt: { headline: "{v}% da população enfrenta insegurança alimentar moderada ou grave", context: "{popV} milhões de pessoas não sabem de onde virá a próxima refeição." },
    es: { headline: "{v}% de la población enfrenta inseguridad alimentaria moderada o grave", context: "{popV} millones de personas no saben de dónde vendrá su próxima comida." },
    fr: { headline: "{v}% de la population fait face à l'insécurité alimentaire modérée ou grave", context: "{popV} millions de personnes ne savent pas d'où viendra leur prochain repas." },
    ar: { headline: "{v}% من السكان يواجهون انعدام الأمن الغذائي المعتدل أو الشديد", context: "{popV} مليون شخص لا يعرفون من أين ستأتي وجبتهم التالية." },
    zh: { headline: "{v}%的人口面临中度或严重的粮食不安全", context: "{popV}百万人不知道下一顿饭从哪里来。" },
    ja: { headline: "人口の{v}%が中程度または重度の食料不安に直面している", context: "{popV}百万人が次の食事がどこから来るか分かりません。" },
    ko: { headline: "인구의 {v}%가 중간도 또는 심각한 식량 불안에 직면해 있습니다", context: "{popV}백만 명이 다음 식사가 어디서 올지 모릅니다." },
    hi: { headline: "जनसंख्या का {v}% मध्यम या गंभीर खाद्य असुरक्षा का सामना कर रहा है", context: "{popV} मिलियन लोगों को नहीं पता कि उनका अगला भोजन कहाँ से आएगा।" },
    ru: { headline: "{v}% населения сталкивается с умеренной или тяжёлой продовольственной необеспеченностью", context: "{popV} миллионов человек не знают, откуда возьмётся их следующий приём пищи." },
  },

  /* ─── FOOD SECURITY ─── */
  "food_security.severe_food_insecurity_m": {
    en: { headline: "{v} million people in severe food insecurity", context: "These people have run out of food. They are skipping meals for days. Children are the most affected." },
    pt: { headline: "{v} milhões de pessoas em grave insegurança alimentar", context: "Essas pessoas ficaram sem comida. Estão pulando refeições por dias. As crianças são as mais afetadas." },
    es: { headline: "{v} millones de personas en grave inseguridad alimentaria", context: "Estas personas se han quedado sin comida. Saltan comidas durante días. Los niños son los más afectados." },
    fr: { headline: "{v} millions de personnes en insécurité alimentaire grave", context: "Ces personnes n'ont plus de nourriture. Elles sautent des repas pendant des jours. Les enfants sont les plus touchés." },
    ar: { headline: "{v} مليون شخص في انعدام أمن غذائي شديد", context: "هؤلاء الأشخاص نفد طعامهم. يتخطون الوجبات لأيام. الأطفال هم الأكثر تضرراً." },
    zh: { headline: "{v}百万人面临严重的粮食不安全", context: "这些人已经断粮。他们连续几天吃不上饭。儿童受影响最大。" },
    ja: { headline: "{v}百万人が重度の食料不安に陥っている", context: "これらの人々は食料を使い果たしました。何日も食事を抜いています。子どもが最も影響を受けます。" },
    ko: { headline: "{v}백만 명이 심각한 식량 불안 상태에 있습니다", context: "이 사람들은 식량이 떨어졌습니다. 며칠씩 식사를 거르고 있습니다. 아동이 가장 큰 영향을 받습니다." },
    hi: { headline: "{v} मिलियन लोग गंभीर खाद्य असुरक्षा में हैं", context: "इन लोगों का खाना खत्म हो गया है। वे कई दिनों तक भोजन छोड़ रहे हैं। बच्चे सबसे अधिक प्रभावित हैं।" },
    ru: { headline: "{v} миллионов человек в состоянии тяжёлой продовольственной необеспеченности", context: "У этих людей закончилась еда. Они пропускают приёмы пищи днями. Дети страдают больше всего." },
  },

  /* ─── CONFLICT ─── */
  "conflict.intensity_1to5": {
    en: { headline: "Active armed conflict — intensity level {v}/5", context: "War blocks food, medicine, and aid from reaching civilians. You cannot end hunger in a war zone without peace." },
    pt: { headline: "Conflito armado ativo — nível de intensidade {v}/5", context: "A guerra impede que comida, remédios e ajuda cheguem aos civis. Não se acaba a fome em zona de guerra sem paz." },
    es: { headline: "Conflicto armado activo — nivel de intensidad {v}/5", context: "La guerra impide que la comida, la medicina y la ayuda lleguen a los civiles. No se puede acabar el hambre en una zona de guerra sin paz." },
    fr: { headline: "Conflit armé actif — niveau d'intensité {v}/5", context: "La guerre empêche la nourriture, les médicaments et l'aide d'atteindre les civils. On ne peut pas mettre fin à la faim dans une zone de guerre sans la paix." },
    ar: { headline: "نزاع مسلح نشط — مستوى الكثافة {v}/5", context: "الحرب تمنع وصول الطعام والدواء والمساعدات إلى المدنيين. لا يمكن إنهاء الجوع في منطقة حرب دون سلام." },
    zh: { headline: "活跃武装冲突——强度等级{v}/5", context: "战争阻碍食物、药品和援助到达平民手中。没有和平，就无法在战区终结饥饿。" },
    ja: { headline: "活動中の武力紛争 — 強度レベル{v}/5", context: "戦争は食料、医薬品、支援が民間人に届くのを妨げます。平和なしに戦場で飢餓を終わらせることはできません。" },
    ko: { headline: "활동 중인 무력 분쟁 — 강도 수준 {v}/5", context: "전쟁은 식량, 의약품, 지원이 민간인에게 도달하는 것을 막습니다. 평화 없이 전쟁 지역에서 기아를 끝낼 수 없습니다." },
    hi: { headline: "सक्रिय सशस्त्र संघर्ष — तीव्रता स्तर {v}/5", context: "युद्ध खाद्य, दवा और सहायता को नागरिकों तक पहुँचने से रोकता है। शांति के बिना युद्ध क्षेत्र में भूख समाप्त नहीं की जा सकती।" },
    ru: { headline: "Активный вооружённый конфликт — уровень интенсивности {v}/5", context: "Война блокирует доставку еды, лекарств и помощи мирным жителям. Нельзя победить голод в зоне боевых действий без мира." },
  },
  "conflict.displacement_m": {
    en: { headline: "{v} million people displaced by conflict", context: "These families left everything behind. They now live in camps, with no income, no land, no future — dependent on aid that is being cut." },
    pt: { headline: "{v} milhões de pessoas deslocadas por conflito", context: "Essas famílias deixaram tudo para trás. Agora vivem em acampamentos, sem renda, sem terra, sem futuro — dependentes de ajuda que está sendo cortada." },
    es: { headline: "{v} millones de personas desplazadas por conflicto", context: "Estas familias lo dejaron todo atrás. Ahora viven en campamentos, sin ingresos, sin tierra, sin futuro — dependientes de una ayuda que se está recortando." },
    fr: { headline: "{v} millions de personnes déplacées par le conflit", context: "Ces familles ont tout laissé derrière elles. Elles vivent maintenant dans des camps, sans revenus, sans terre, sans avenir — dépendantes d'une aide qu'on coupe." },
    ar: { headline: "{v} مليون شخص نازح بسبب النزاع", context: "هذه العائلات تركت كل شيء وراءها. يعيشون الآن في مخيمات، بلا دخل، بلا أرض، بلا مستقبل — معتمدين على مساعدات يتم قطعها." },
    zh: { headline: "{v}百万人因冲突而流离失所", context: "这些家庭抛弃了一切。他们现在住在难民营里，没有收入，没有土地，没有未来——依赖正在被削减的援助。" },
    ja: { headline: "{v}百万人が紛争で避難している", context: "これらの家族はすべてを置いてきました。現在キャンプで暮らし、収入も土地も未来もなく、削減されている支援に依存しています。" },
    ko: { headline: "{v}백만 명이 분쟁으로 실향했습니다", context: "이 가족들은 모든 것을 두고 떠났습니다. 이제 수용소에서 살며, 소득도, 토지도, 미래도 없이 삭감되는 지원에 의존하고 있습니다." },
    hi: { headline: "{v} मिलियन लोग संघर्ष के कारण विस्थापित हैं", context: "इन परिवारों ने सब कुछ पीछे छोड़ दिया। वे अब शिविरों में रहते हैं, बिना आय, बिना भूमि, बिना भविष्य के — कटती सहायता पर निर्भर।" },
    ru: { headline: "{v} миллионов человек перемещены из-за конфликта", context: "Эти семьи оставили всё позади. Теперь они живут в лагерях, без дохода, без земли, без будущего — зависят от помощи, которую сокращают." },
  },

  /* ─── MIGRATION / DISPLACEMENT ─── */
  "migration.forcibly_displaced": {
    en: { headline: "{v} million people forcibly displaced", context: "Refugees, asylum seekers, and internally displaced. The largest displacement crisis most people have never heard of." },
    pt: { headline: "{v} milhões de pessoas deslocadas à força", context: "Refugiados, solicitantes de asilo e deslocados internos. A maior crise de deslocamento que a maioria das pessoas nunca ouviu falar." },
    es: { headline: "{v} millones de personas desplazadas por la fuerza", context: "Refugiados, solicitantes de asilo y desplazados internos. La mayor crisis de desplazamiento de la que la mayoría de la gente nunca ha oído hablar." },
    fr: { headline: "{v} millions de personnes déplacées de force", context: "Réfugiés, demandeurs d'asile et déplacés internes. La plus grande crise de déplacement dont la plupart des gens n'ont jamais entendu parler." },
    ar: { headline: "{v} مليون شخص نازحون قسراً", context: "لاجئون وطالبو لجوء ونازحون داخلياً. أكبر أزمة نزوح لم يسمع بها معظم الناس من قبل." },
    zh: { headline: "{v}百万人被迫流离失所", context: "难民、寻求庇护者和境内流离失所者。大多数人从未听说过的最大流离失所危机。" },
    ja: { headline: "{v}百万人が強制的に避難させられている", context: "難民、庇護申請者、国内避難民。ほとんどの人が聞いたこともない最大の避難危機。" },
    ko: { headline: "{v}백만 명이 강제 실향되었습니다", context: "난민, 망명 신청자, 국내 실향민. 대부분의 사람이 들어본 적 없는 가장 큰 실향 위기입니다." },
    hi: { headline: "{v} मिलियन लोग जबरन विस्थापित हैं", context: "शरणार्थी, शरण चाहने वाले और आंतरिक रूप से विस्थापित। अधिकांश लोगों ने कभी नहीं सुनी सबसे बड़ी विस्थापन संकट।" },
    ru: { headline: "{v} миллионов человек принудительно перемещены", context: "Беженцы, искатели убежища и внутренне перемещённые лица. Крупнейший кризис перемещения, о котором большинство людей даже не слышало." },
  },

  /* ─── HEALTH ─── */
  "health.child_mortality_under5_per1k": {
    en: { headline: "{v} out of every 1,000 children die before age 5", context: "In Norway it's 2.2. In Japan it's 1.9. This gap is not natural — it's a policy choice." },
    pt: { headline: "{v} de cada 1.000 crianças morrem antes dos 5 anos", context: "Na Noruega é 2.2. No Japão é 1.9. Essa diferença não é natural — é uma escolha política." },
    es: { headline: "{v} de cada 1.000 niños mueren antes de los 5 años", context: "En Noruega es 2.2. En Japón es 1.9. Esta brecha no es natural — es una elección política." },
    fr: { headline: "{v} sur 1.000 enfants meurent avant 5 ans", context: "En Norvège c'est 2.2. Au Japon c'est 1.9. Cet écart n'est pas naturel — c'est un choix politique." },
    ar: { headline: "{v} من كل 1.000 طفل يموتون قبل سن الخامسة", context: "في النرويج النسبة 2.2. في اليابان 1.9. هذه الفجوة ليست طبيعية — إنها اختيار سياسي." },
    zh: { headline: "每1,000名儿童中有{v}名在5岁前死亡", context: "在挪威这一数字是2.2。在日本是1.9。这种差距不是自然的——这是政策选择。" },
    ja: { headline: "1,000人あたり{v}人の子どもが5歳未満で死亡する", context: "ノルウェーでは2.2です。日本では1.9です。この格差は自然なものではありません — 政策の選択です。" },
    ko: { headline: "1,000명 중 {v}명이 5세 이전에 사망합니다", context: "노르웨이에서는 2.2입니다. 일본에서는 1.9입니다. 이 격차는 자연스러운 것이 아닙니다 — 정책의 선택입니다." },
    hi: { headline: "हर 1,000 बच्चों में से {v} 5 साल की आयु से पहले मर जाते हैं", context: "नॉर्वे में यह 2.2 है। जापान में 1.9। यह अंतर प्राकृतिक नहीं है — यह नीतिगत विकल्प है।" },
    ru: { headline: "{v} из каждой 1.000 детей умирают до 5 лет", context: "В Норвегии это 2.2. В Японии — 1.9. Этот разрыв не естественный — это политический выбор." },
  },
  "health.maternal_mortality_per100k": {
    en: { headline: "{v} mothers die per 100,000 births", context: "Most of these deaths are preventable with basic healthcare that costs less than a single missile." },
    pt: { headline: "{v} mães morrem por 100.000 nascimentos", context: "A maioria dessas mortes é evitável com cuidados básicos que custam menos que um único míssil." },
    es: { headline: "{v} madres mueren por cada 100.000 nacimientos", context: "La mayoría de estas muertes son prevenibles con atención médica básica que cuesta menos que un solo misil." },
    fr: { headline: "{v} mères meurent pour 100.000 naissances", context: "La plupart de ces décès sont évitables avec des soins de base qui coûtent moins cher qu'un seul missile." },
    ar: { headline: "{v} أمهات يمتن لكل 100.000 ولادة", context: "معظم هذه الوفيات يمكن الوقاية منها برعاية صحية أساسية تكلفتها أقل من صاروخ واحد." },
    zh: { headline: "每100,000次分娩中有{v}名母亲死亡", context: "这些死亡大多可以通过基本医疗来预防，其费用低于一枚导弹。" },
    ja: { headline: "出生10万人あたり{v}人の母親が死亡する", context: "これらの死亡のほとんどは、1発のミサイルより安い基本的な医療で予防できます。" },
    ko: { headline: "10만 명 출산당 {v}명의 산모가 사망합니다", context: "이 사망의 대부분은 미사일 한 발보다 싼 기본 의료로 예방할 수 있습니다." },
    hi: { headline: "प्रति 100,000 जन्मों पर {v} माताएँ मरती हैं", context: "इनमें से अधिकांश मौतें बुनियादी स्वास्थ्य सेवा से रोकी जा सकती हैं, जिसकी लागत एक मिसाइल से भी कम है।" },
    ru: { headline: "{v} матерей умирают на 100.000 родов", context: "Большинство этих смертей можно предотвратить базовым здравоохранением, которое стоит дешевле одной ракеты." },
  },
  "health.doctors_per_1000": {
    en: { headline: "Only {v} doctors per 1,000 people (WHO minimum: 4.45)", context: "When people get sick, there's often no one to help. This is why preventable diseases become death sentences." },
    pt: { headline: "Apenas {v} médicos por 1.000 pessoas (mínimo da OMS: 4.45)", context: "Quando as pessoas adoecem, muitas vezes não há ninguém para ajudar. É por isso que doenças evitáveis se tornam sentenças de morte." },
    es: { headline: "Solo {v} médicos por 1.000 personas (mínimo de la OMS: 4.45)", context: "Cuando la gente se enferma, a menudo no hay nadie para ayudar. Por eso las enfermedades prevenibles se convierten en sentencias de muerte." },
    fr: { headline: "Seulement {v} médecins pour 1.000 habitants (minimum OMS : 4.45)", context: "Quand les gens tombent malades, il n'y a souvent personne pour aider. C'est pourquoi les maladies évitables deviennent des condamnations à mort." },
    ar: { headline: "فقط {v} أطباء لكل 1.000 شخص (الحد الأدنى لمنظمة الصحة: 4.45)", context: "عندما يمرض الناس، غالباً لا يوجد أحد للمساعدة. لهذا السبب تصبح الأمراض التي يمكن الوقاية منها أحكاماً بالإعدام." },
    zh: { headline: "每1,000人仅有{v}名医生（世卫组织最低标准：4.45）", context: "当人们生病时，往往没有人能帮忙。这就是为什么可预防的疾病变成死刑。" },
    ja: { headline: "1,000人あたり医師はわずか{v}人（WHO最低基準：4.45）", context: "人が病気になっても、助けてくれる人がいないことが多いです。これが予防可能な病気が死刑判決になる理由です。" },
    ko: { headline: "1,000명당 의사 단 {v}명 (WHO 최소 기준: 4.45)", context: "사람들이 아플 때 도와줄 사람이 없는 경우가 많습니다. 이것이 예방 가능한 질병이 사형 선고가 되는 이유입니다." },
    hi: { headline: "केवल प्रति 1,000 लोगों पर {v} डॉक्टर (WHO न्यूनतम: 4.45)", context: "जब लोग बीमार पड़ते हैं, तो अक्सर मदद करने वाला कोई नहीं होता। इसीलिए रोकने योग्य बीमारियाँ मौत की सजा बन जाती हैं।" },
    ru: { headline: "Всего {v} врача на 1.000 человек (минимум ВОЗ: 4.45)", context: "Когда люди болеют, им часто некому помочь. Вот почему предотвратимые болезни становятся смертным приговором." },
  },
  "health.life_expectancy": {
    en: { headline: "Average life expectancy: {v} years", context: "People here die 15-20 years earlier than they should. Not from fate — from a system that chose not to invest in them." },
    pt: { headline: "Expectativa de vida média: {v} anos", context: "As pessoas aqui morrem 15-20 anos mais cedo do que deveriam. Não por destino — por um sistema que escolheu não investir nelas." },
    es: { headline: "Esperanza de vida media: {v} años", context: "La gente aquí muere 15-20 años antes de lo que debería. No por destino — por un sistema que eligió no invertir en ellos." },
    fr: { headline: "Espérance de vie moyenne : {v} ans", context: "Les gens ici meurent 15-20 ans plus tôt qu'ils ne le devraient. Pas par fatalité — par un système qui a choisi de ne pas investir en eux." },
    ar: { headline: "متوسط العمر المتوقع: {v} سنة", context: "الناس هنا يموتون قبل أوانهم بـ 15-20 سنة. ليس بسبب القدر — بل بسبب نظام اختار ألا يستثمر فيهم." },
    zh: { headline: "平均预期寿命：{v}岁", context: "这里的人们比应有的寿命早死15-20年。不是因为命运——而是因为一个选择不对他们投资的系统。" },
    ja: { headline: "平均寿命：{v}歳", context: "ここの人々は本来より15〜20年早く死んでいます。運命ではなく — 彼らに投資しないことを選んだシステムのせいです。" },
    ko: { headline: "평균 기대 수명: {v}세", context: "이곳의 사람들은 마땅히 살아야 할 때보다 15-20년 일찍 죽습니다. 운명이 아니라 — 그들에게 투자하지 않기로 선택한 시스템 때문입니다." },
    hi: { headline: "औसत जीवन प्रत्याशा: {v} वर्ष", context: "यहाँ लोग उम्र से 15-20 साल पहले मर जाते हैं। नियति से नहीं — उस व्यवस्था से जिसने उनमें निवेश न करना चुना।" },
    ru: { headline: "Средняя ожидаемая продолжительность жизни: {v} лет", context: "Люди здесь умирают на 15-20 лет раньше, чем должны. Не от судьбы — от системы, которая решила в них не вкладываться." },
  },

  /* ─── EDUCATION ─── */
  "education.literacy_rate_pct": {
    en: { headline: "Only {v}% of adults can read and write", context: "{popV} million adults are illiterate. Education is the escape hatch — and it's been closed." },
    pt: { headline: "Apenas {v}% dos adultos sabem ler e escrever", context: "{popV} milhões de adultos são analfabetos. A educação é a saída — e foi fechada." },
    es: { headline: "Solo {v}% de los adultos saben leer y escribir", context: "{popV} millones de adultos son analfabetos. La educación es la vía de escape — y se ha cerrado." },
    fr: { headline: "Seulement {v}% des adultes savent lire et écrire", context: "{popV} millions d'adultes sont analphabètes. L'éducation est la porte de sortie — et elle a été fermée." },
    ar: { headline: "فقط {v}% من البالغين يستطيعون القراءة والكتابة", context: "{popV} مليون بالغ أمي. التعليم هو مخرج النجاة — وقد أغلق." },
    zh: { headline: "仅有{v}%的成年人能读会写", context: "{popV}百万成年人是文盲。教育是逃生通道——而已被关闭。" },
    ja: { headline: "読み書きできる大人はわずか{v}%", context: "{popV}百万人の大人が識字できません。教育は脱出への道 — そしてそれは閉ざされました。" },
    ko: { headline: "읽고 쓸 줄 아는 성인은 단 {v}%에 불과합니다", context: "{popV}백만 명의 성인이 문맹입니다. 교육은 탈출구 — 그리고 그것은 닫혔습니다." },
    hi: { headline: "केवल {v}% वयस्क पढ़ और लिख सकते हैं", context: "{popV} मिलियन वयस्क निरक्षर हैं। शिक्षा बचाव का रास्ता है — और उसे बंद कर दिया गया है।" },
    ru: { headline: "Только {v}% взрослых умеют читать и писать", context: "{popV} миллионов взрослых — неграмотны. Образование — путь к спасению, и он закрыт." },
  },

  /* ─── WATER & SANITATION ─── */
  "water_sanitation.basic_access_pct": {
    en: { headline: "Only {v}% of the population has basic drinking water access", context: "{popV} million people drink unsafe water every day. Children die from diarrhea — a disease of poverty." },
    pt: { headline: "Apenas {v}% da população tem acesso a água potável básica", context: "{popV} milhões de pessoas bebem água imprópria todos os dias. Crianças morrem de diarreia — uma doença da pobreza." },
    es: { headline: "Solo {v}% de la población tiene acceso a agua potable básica", context: "{popV} millones de personas beben agua no potable todos los días. Los niños mueren de diarrea — una enfermedad de la pobreza." },
    fr: { headline: "Seulement {v}% de la population a accès à l'eau potable de base", context: "{popV} millions de personnes boivent de l'eau non potable chaque jour. Les enfants meurent de diarrhée — une maladie de la pauvreté." },
    ar: { headline: "فقط {v}% من السكان لديهم وصول إلى مياه الشرب الأساسية", context: "{popV} مليون شخص يشربون مياهاً غير آمنة كل يوم. يموت الأطفال من الإسهال — مرض الفقر." },
    zh: { headline: "仅有{v}%的人口能获得基本饮用水", context: "{popV}百万人每天饮用不安全的水。儿童死于腹泻——一种贫困疾病。" },
    ja: { headline: "基本的な飲料水へのアクセスがあるのはわずか{v}%", context: "{popV}百万人が毎日安全でない水を飲んでいます。子どもが下痢で死んでいます — 貧困の病気です。" },
    ko: { headline: "기본 식수에 접근할 수 있는 인구는 단 {v}%입니다", context: "{popV}백만 명이 매일 안전하지 않은 물을 마십니다. 아동들이 설사로 죽습니다 — 빈곤의 질병입니다." },
    hi: { headline: "केवल {v}% जनसंख्या के पास बुनियादी पेयजल तक पहुँच है", context: "{popV} मिलियन लोग हर दिन असुरक्षित पानी पीते हैं। बच्चे दस्त से मरते हैं — गरीबी की बीमारी।" },
    ru: { headline: "Только {v}% населения имеет доступ к чистой питьевой воде", context: "{popV} миллионов человек каждый день пьют небезопасную воду. Дети умирают от диареи — болезни нищеты." },
  },
  "water_sanitation.safe_sanitation_pct": {
    en: { headline: "Only {v}% has safely managed sanitation", context: "Without toilets and wastewater treatment, diseases spread. This is a 19th-century problem in the 21st century." },
    pt: { headline: "Apenas {v}% tem saneamento gerenciado com segurança", context: "Sem banheiros e tratamento de esgoto, doenças se espalham. Isso é um problema do século XIX no século XXI." },
    es: { headline: "Solo {v}% tiene saneamiento gestionado de forma segura", context: "Sin inodoros y tratamiento de aguas residuales, las enfermedades se propagan. Esto es un problema del siglo XIX en el siglo XXI." },
    fr: { headline: "Seulement {v}% dispose d'assainissement géré en toute sécurité", context: "Sans toilettes ni traitement des eaux usées, les maladies se propagent. C'est un problème du XIXe siècle au XXIe siècle." },
    ar: { headline: "فقط {v}% لديهم صرف صحي مُدار بأمان", context: "بدون مراحيض ومعالجة مياه الصرف الصحي، تنتشر الأمراض. هذه مشكلة القرن التاسع عشر في القرن الحادي والعشرين." },
    zh: { headline: "仅有{v}%拥有安全管理的卫生设施", context: "没有厕所和废水处理，疾病就会蔓延。这是21世纪里的19世纪问题。" },
    ja: { headline: "安全に管理された衛生設備があるのはわずか{v}%", context: "トイレと下水処理がなければ病気が蔓延します。これは21世紀における19世紀の問題です。" },
    ko: { headline: "안전하게 관리되는 위생 시설은 단 {v}%입니다", context: "화장실과 하수 처리가 없으면 질병이 퍼집니다. 이것은 21세기에 존재하는 19세기의 문제입니다." },
    hi: { headline: "केवल {v}% के पास सुरक्षित रूप से प्रबंधित स्वच्छता है", context: "शौचालय और अपशिष्ट जल उपचार के बिना, बीमारियाँ फैलती हैं। यह 21वीं सदी में 19वीं सदी की समस्या है।" },
    ru: { headline: "Только {v}% имеют безопасную систему санитарии", context: "Без туалетов и очистки сточных вод болезни распространяются. Это проблема XIX века в XXI веке." },
  },

  /* ─── POVERTY ─── */
  "poverty.headcount_365_pct": {
    en: { headline: "{v}% of the population lives on less than $3.65/day", context: "{popV} million people in extreme poverty. The global cost to fix this is less than what the world spends on weapons in a month." },
    pt: { headline: "{v}% da população vive com menos de $3.65/dia", context: "{popV} milhões de pessoas em pobreza extrema. O custo global para consertar isso é menor do que o mundo gasta em armas num mês." },
    es: { headline: "{v}% de la población vive con menos de $3.65/día", context: "{popV} millones de personas en pobreza extrema. El costo global de arreglar esto es menor a lo que el mundo gasta en armas en un mes." },
    fr: { headline: "{v}% de la population vit avec moins de $3.65/jour", context: "{popV} millions de personnes en extrême pauvreté. Le coût mondial pour régler ça est inférieur à ce que le monde dépense en armes en un mois." },
    ar: { headline: "{v}% من السكان يعيشون بأقل من $3.65/يوم", context: "{popV} مليون شخص في فقر مدقع. التكلفة العالمية لإصلاح هذا أقل مما ينفقه العالم على الأسلحة في شهر." },
    zh: { headline: "{v}%的人口每天生活费不到3.65美元", context: "{popV}百万人处于极度贫困中。解决这一问题的全球成本低于世界一个月的武器开支。" },
    ja: { headline: "人口の{v}%が1日$3.65未満で暮らしている", context: "{popV}百万人が極度の貧困にあります。これを解決する世界的コストは、世界が1ヶ月間に兵器に費やす額より少ないです。" },
    ko: { headline: "인구의 {v}%가 하루 $3.65 미만으로 살아갑니다", context: "{popV}백만 명이 극빈 상태입니다. 이것을 해결할 세계적 비용은 세계가 한 달 동안 무기에 지출하는 금액보다 적습니다." },
    hi: { headline: "जनसंख्या का {v}% लोग प्रतिदिन $3.65 से कम पर जीते हैं", context: "{popV} मिलियन लोग चरम गरीबी में हैं। इसे ठीक करने की वैश्विक लागत दुनिया के एक महीने के हथियार खर्च से भी कम है।" },
    ru: { headline: "{v}% населения живёт менее чем на $3.65/день", context: "{popV} миллионов человек в крайней нищете. Мировые затраты на решение этой проблемы меньше, чем мир тратит на оружие за месяц." },
  },

  /* ─── SECURITY ─── */
  "security.homicide_rate_per100k": {
    en: { headline: "{v} homicides per 100,000 people", context: "That's higher than many active war zones. Violence is a public health crisis that goes untreated." },
    pt: { headline: "{v} homicídios por 100.000 pessoas", context: "Isso é mais alto do que muitas zonas de guerra ativas. A violência é uma crise de saúde pública que não é tratada." },
    es: { headline: "{v} homicidios por cada 100.000 personas", context: "Es más alto que en muchas zonas de guerra activas. La violencia es una crisis de salud pública sin tratar." },
    fr: { headline: "{v} homicides pour 100.000 habitants", context: "C'est plus élevé que dans de nombreuses zones de guerre actives. La violence est une crise de santé publique non traitée." },
    ar: { headline: "{v} جرائم قتل لكل 100.000 شخص", context: "هذا أعلى من العديد من مناطق الحرب النشطة. العنف هو أزمة صحية عامة لا يتم علاجها." },
    zh: { headline: "每10万人中有{v}起凶杀案", context: "这比许多活跃战区还要高。暴力是一个未得到治疗的公共卫生危机。" },
    ja: { headline: "10万人あたり{v}件の殺人", context: "これは多くの活動中の戦場より高いです。暴力は治療されていない公衆衛生の危機です。" },
    ko: { headline: "10만 명당 {v}건의 살인", context: "이는 많은 활동 중인 전쟁 지역보다 높습니다. 폭력은 치료되지 않는 공중 보건 위기입니다." },
    hi: { headline: "प्रति 100,000 लोगों पर {v} हत्याएँ", context: "यह कई सक्रिय युद्ध क्षेत्रों से अधिक है। हिंसा एक अनुपचारित सार्वजनिक स्वास्थ्य संकट है।" },
    ru: { headline: "{v} убийств на 100.000 человек", context: "Это выше, чем во многих зонах активных боевых действий. Насилие — кризис общественного здравоохранения, который не лечат." },
  },

  /* ─── GOVERNANCE ─── */
  "governance.corruption_perceptions_index": {
    en: { headline: "Corruption Perception Index: {v}/100 (100 = clean)", context: "Aid money, tax revenue, natural resource wealth — it disappears into private pockets instead of public services." },
    pt: { headline: "Índice de Percepção da Corrupção: {v}/100 (100 = limpo)", context: "Dinheiro de ajuda, receita fiscal, riqueza de recursos naturais — desaparece em bolsos privados em vez de serviços públicos." },
    es: { headline: "Índice de Percepción de Corrupción: {v}/100 (100 = limpio)", context: "Dinero de ayuda, ingresos fiscales, riqueza de recursos naturales — desaparece en bolsillos privados en lugar de servicios públicos." },
    fr: { headline: "Indice de perception de la corruption : {v}/100 (100 = propre)", context: "Argent d'aide, recettes fiscales, richesse des ressources naturelles — tout disparaît dans des poches privées au lieu de services publics." },
    ar: { headline: "مؤشر مدركات الفساد: {v}/100 (100 = نظيف)", context: "أموال المساعدات والإيرادات الضريبية وثروة الموارد الطبيعية — تختفي في الجيوب الخاصة بدلاً من الخدمات العامة." },
    zh: { headline: "清廉指数：{v}/100（100=清廉）", context: "援助资金、税收收入、自然资源财富——都消失进了私人腰包，而不是公共服务。" },
    ja: { headline: "腐敗認識指数：{v}/100（100 = クリーン）", context: "支援金、税収、天然資源の富 — それは公共サービスではなく個人のポケットに消えていきます。" },
    ko: { headline: "부패 인식 지수: {v}/100 (100 = 청렴)", context: "원조 자금, 세수, 천연자원 부 — 공공 서비스가 아닌 개인 주머니로 사라집니다." },
    hi: { headline: "भ्रष्टाचार बोध सूचकांक: {v}/100 (100 = स्वच्छ)", context: "सहायता धन, कर राजस्व, प्राकृतिक संसाधन धन — यह सार्वजनिक सेवाओं के बजाय निजी जेबों में गायब हो जाता है।" },
    ru: { headline: "Индекс восприятия коррупции: {v}/100 (100 = без коррупции)", context: "Деньги помощи, налоговые поступления, богатство природных ресурсов — всё исчезает в частных карманах вместо общественных услуг." },
  },
  "governance.electoral_democracy_index": {
    en: { headline: "Democracy Index: {v} (0 = authoritarian, 1 = full democracy)", context: "Without democratic accountability, there is no pressure to fix any of these problems. The people cannot vote for change." },
    pt: { headline: "Índice de Democracia: {v} (0 = autoritário, 1 = democracia plena)", context: "Sem prestação de contas democrática, não há pressão para consertar nenhum desses problemas. O povo não pode votar por mudança." },
    es: { headline: "Índice de Democracia: {v} (0 = autoritario, 1 = democracia plena)", context: "Sin rendición de cuentas democrática, no hay presión para arreglar estos problemas. La gente no puede votar por el cambio." },
    fr: { headline: "Indice de démocratie : {v} (0 = autoritaire, 1 = démocratie complète)", context: "Sans responsabilité démocratique, il n'y a pas de pression pour régler ces problèmes. Les gens ne peuvent pas voter pour le changement." },
    ar: { headline: "مؤشر الديمقراطية: {v} (0 = استبدادي، 1 = ديمقراطية كاملة)", context: "بدون مساءلة ديمقراطية، لا يوجد ضغط لإصلاح أي من هذه المشاكل. لا يستطيع الناس التصويت من أجل التغيير." },
    zh: { headline: "民主指数：{v}（0=威权，1=完全民主）", context: "没有民主问责制，就没有解决这些问题的压力。人民无法通过投票寻求改变。" },
    ja: { headline: "民主主義指数：{v}（0 = 権威主義、1 = 完全な民主主義）", context: "民主的な説明責任がなければ、これらの問題を修正する圧力はありません。人々は変革のために投票できません。" },
    ko: { headline: "민주주의 지수: {v} (0 = 권위주의, 1 = 완전한 민주주의)", context: "민주적 책임 없이는 이 문제들을 해결할 압력이 없습니다. 사람들은 변화를 위해 투표할 수 없습니다." },
    hi: { headline: "लोकतंत्र सूचकांक: {v} (0 = सत्तावादी, 1 = पूर्ण लोकतंत्र)", context: "लोकतांत्रिक जवाबदेही के बिना, इन समस्याओं को ठीक करने का कोई दबाव नहीं है। लोग परिवर्तन के लिए मतदान नहीं कर सकते।" },
    ru: { headline: "Индекс демократии: {v} (0 = авторитарный, 1 = полная демократия)", context: "Без демократической подотчётности нет давления для решения этих проблем. Люди не могут проголосовать за перемены." },
  },

  /* ─── ENERGY ─── */
  "energy.no_access_electricity_m": {
    en: { headline: "{v} million people have NO electricity", context: "No light to study by. No refrigeration for vaccines. No pump for clean water. Electricity is the foundation of everything." },
    pt: { headline: "{v} milhões de pessoas NÃO têm eletricidade", context: "Sem luz para estudar. Sem refrigeração para vacinas. Sem bomba para água limpa. Eletricidade é a base de tudo." },
    es: { headline: "{v} millones de personas NO tienen electricidad", context: "Sin luz para estudiar. Sin refrigeración para vacunas. Sin bomba para agua limpia. La electricidad es la base de todo." },
    fr: { headline: "{v} millions de personnes SANS électricité", context: "Pas de lumière pour étudier. Pas de réfrigération pour les vaccins. Pas de pompe pour l'eau propre. L'électricité est la base de tout." },
    ar: { headline: "{v} مليون شخص بلا كهرباء", context: "لا ضوء للدراسة. لا تبريد للقاحات. لا مضخة للمياه النظيفة. الكهرباء أساس كل شيء." },
    zh: { headline: "{v}百万人没有电力", context: "没有灯光学习。没有冰箱保存疫苗。没有水泵抽取清洁水。电力是一切的基础。" },
    ja: { headline: "{v}百万人が電気なしで暮らしている", context: "勉強するための光もない。ワクチンのための冷蔵もない。きれいな水のためのポンプもない。電気はすべての基盤です。" },
    ko: { headline: "{v}백만 명이 전기가 없습니다", context: "공부할 불빛도 없습니다. 백신을 위한 냉장고도 없습니다. 깨끗한 물을 위한 펌프도 없습니다. 전기는 모든 것의 기초입니다." },
    hi: { headline: "{v} मिलियन लोगों के पास बिजली नहीं है", context: "पढ़ने के लिए रोशनी नहीं। टीकों के लिए रेफ्रिजरेशन नहीं। स्वच्छ पानी के लिए पंप नहीं। बिजली हर चीज की नींव है।" },
    ru: { headline: "{v} миллионов человек НЕ имеют электричества", context: "Нет света для учёбы. Нет холодильника для вакцин. Нет насоса для чистой воды. Электричество — основа всего." },
  },

  /* ─── EMPLOYMENT ─── */
  "employment.unemployment_pct": {
    en: { headline: "{v}% unemployment", context: "No jobs means no income, no food security, no future. Youth unemployment drives migration and unrest." },
    pt: { headline: "{v}% de desemprego", context: "Sem emprego não há renda, segurança alimentar, futuro. O desemprego juvenil impulsiona migração e instabilidade." },
    es: { headline: "{v}% de desempleo", context: "Sin trabajo no hay ingresos, seguridad alimentaria, futuro. El desempleo juvenil impulsa la migración y el malestar." },
    fr: { headline: "{v}% de chômage", context: "Pas d'emploi signifie pas de revenus, pas de sécurité alimentaire, pas d'avenir. Le chômage des jeunes pousse à la migration et à l'agitation." },
    ar: { headline: "{v}% بطالة", context: "لا عمل يعني لا دخل، لا أمن غذائي، لا مستقبل. بطالة الشباب تدفع للهجرة والاضطرابات." },
    zh: { headline: "{v}%的失业率", context: "没有工作意味着没有收入、没有粮食安全、没有未来。青年失业推动移民和动荡。" },
    ja: { headline: "失業率{v}%", context: "仕事がなければ収入も食の安全保障も未来もありません。若者の失業は移住と動揺を引き起こします。" },
    ko: { headline: "{v}% 실업률", context: "일자리가 없으면 소득도, 식량 안보도, 미래도 없습니다. 청년 실업은 이주와 불안을 유발합니다." },
    hi: { headline: "{v}% बेरोजगारी", context: "नौकरी नहीं होने का मतलब है आय नहीं, खाद्य सुरक्षा नहीं, भविष्य नहीं। युवा बेरोजगारी प्रवास और अशांति को बढ़ाती है।" },
    ru: { headline: "Безработица: {v}%", context: "Нет работы — нет дохода, нет продовольственной безопасности, нет будущего. Молодёжная безработица стимулирует миграцию и волнения." },
  },
  "employment.youth_unemployment_pct": {
    en: { headline: "{v}% youth unemployment", context: "When young people have no future, they migrate, riot, or join armed groups. This is a security issue disguised as an economic one." },
    pt: { headline: "{v}% de desemprego juvenil", context: "Quando os jovens não têm futuro, migram, se revoltam ou se juntam a grupos armados. Isso é uma questão de segurança disfarçada de econômica." },
    es: { headline: "{v}% de desempleo juvenil", context: "Cuando los jóvenes no tienen futuro, migran, se amotinan o se unen a grupos armados. Esto es un problema de seguridad disfrazado de económico." },
    fr: { headline: "{v}% de chômage des jeunes", context: "Quand les jeunes n'ont pas d'avenir, ils migrent, s'émeuvent ou rejoignent des groupes armés. C'est un problème de sécurité déguisé en problème économique." },
    ar: { headline: "{v}% بطالة الشباب", context: "عندما لا يكون للشباب مستقبل، يهاجرون أو يشتعلون أو ينضمون إلى مجموعات مسلحة. هذه قضية أمنية متنكرة في صورة اقتصادية." },
    zh: { headline: "{v}%的青年失业率", context: "当年轻人没有未来时，他们会移民、暴动或加入武装组织。这是一个伪装成经济问题的安全问题。" },
    ja: { headline: "若者失業率{v}%", context: "若者に未来がなければ、移住、暴動、武装グループへの加入が起こります。これは経済問題に偽装された安全保障問題です。" },
    ko: { headline: "청년 실업률 {v}%", context: "청년에게 미래가 없으면 이주, 폭동, 무장 단체 가입으로 이어집니다. 이것은 경제 문제로 위장된 안보 문제입니다." },
    hi: { headline: "{v}% युवा बेरोजगारी", context: "जब युवाओं के पास कोई भविष्य नहीं होता, तो वे प्रवास करते हैं, दंगे करते हैं, या सशस्त्र समूहों में शामिल होते हैं। यह आर्थिक समस्या के भेष में सुरक्षा मुद्दा है।" },
    ru: { headline: "Молодёжная безработица: {v}%", context: "Когда у молодых людей нет будущего, они мигрируют, бунтуют или вступают в вооружённые группы. Это проблема безопасности, замаскированная под экономическую." },
  },

  /* ─── INEQUALITY ─── */
  "inequality.gini": {
    en: { headline: "Gini coefficient: {v} (100 = maximum inequality)", context: "The gap between rich and poor is extreme. Wealth concentrates at the top while millions lack food, water, and healthcare." },
    pt: { headline: "Coeficiente de Gini: {v} (100 = desigualdade máxima)", context: "A distância entre ricos e pobres é extrema. A riqueza se concentra no topo enquanto milhões não têm comida, água e saúde." },
    es: { headline: "Coeficiente de Gini: {v} (100 = desigualdad máxima)", context: "La brecha entre ricos y pobres es extrema. La riqueza se concentra en la cima mientras millones carecen de comida, agua y salud." },
    fr: { headline: "Coefficient de Gini : {v} (100 = inégalité maximale)", context: "L'écart entre riches et pauvres est extrême. La richesse se concentre au sommet tandis que des millions manquent de nourriture, d'eau et de soins." },
    ar: { headline: "معامل جيني: {v} (100 = أقصى تفاوت)", context: "الفجوة بين الأغنياء والفقراء متطرفة. تتركز الثروة في القمة بينما يفتقر الملايين للطعام والماء والرعاية الصحية." },
    zh: { headline: "基尼系数：{v}（100=最大不平等）", context: "贫富差距极其悬殊。财富集中在顶层，而数百万人缺乏食物、水和医疗。" },
    ja: { headline: "ジニ係数：{v}（100 = 最大の不平等）", context: "富裕層と貧困層の格差は極端です。富は頂点に集中し、数百万人が食料、水、医療を欠いています。" },
    ko: { headline: "지니 계수: {v} (100 = 최대 불평등)", context: "부자와 가난한 자 사이의 격차가 극심합니다. 부는 상층부에 집중되는 반면 수백만 명이 식량, 물, 의료를 결핍합니다." },
    hi: { headline: "गिनी गुणांक: {v} (100 = अधिकतम असमानता)", context: "अमीर और गरीब के बीच की खाई चरम है। धन शीर्ष पर केंद्रित है जबकि लाखों लोगों के पास भोजन, पानी और स्वास्थ्य सेवा नहीं है।" },
    ru: { headline: "Коэффициент Джини: {v} (100 = максимальное неравенство)", context: "Разрыв между богатыми и бедными крайне велик. Богатство концентрируется наверху, а миллионы лишены еды, воды и здравоохранения." },
  },

  /* ─── ENVIRONMENT ─── */
  "environment.air_pollution_pm25_ugm3": {
    en: { headline: "Air pollution: {v} µg/m³ PM2.5 (WHO limit: 15)", context: "People are breathing toxic air. This causes heart disease, lung cancer, and cognitive damage in children — silently, every day." },
    pt: { headline: "Poluição do ar: {v} µg/m³ PM2.5 (limite da OMS: 15)", context: "As pessoas estão respirando ar tóxico. Isso causa doenças cardíacas, câncer de pulmão e danos cognitivos em crianças — silenciosamente, todos os dias." },
    es: { headline: "Contaminación del aire: {v} µg/m³ PM2.5 (límite de la OMS: 15)", context: "La gente respira aire tóxico. Esto causa enfermedades cardíacas, cáncer de pulmón y daño cognitivo en niños — silenciosamente, cada día." },
    fr: { headline: "Pollution de l'air : {v} µg/m³ PM2.5 (limite OMS : 15)", context: "Les gens respirent de l'air toxique. Cela cause des maladies cardiaques, le cancer du poumon et des dommages cognitifs chez les enfants — silencieusement, chaque jour." },
    ar: { headline: "تلوث الهواء: {v} ميكروغرام/م³ PM2.5 (حد منظمة الصحة: 15)", context: "الناس يتنفسون هواءً ساماً. يسبب هذا أمراض القلب وسرطان الرئة وتلفاً إدراكياً لدى الأطفال — بصمت، كل يوم." },
    zh: { headline: "空气污染：{v} µg/m³ PM2.5（世卫组织限值：15）", context: "人们正在呼吸有毒空气。这会导致心脏病、肺癌和儿童认知损伤——每天无声无息地发生。" },
    ja: { headline: "大気汚染：{v} µg/m³ PM2.5（WHO基準値：15）", context: "人々は有毒な空気を吸っています。これは心臓病、肺がん、子どもの認知障害を引き起こします — 毎日、静かに。" },
    ko: { headline: "대기 오염: {v} µg/m³ PM2.5 (WHO 한도: 15)", context: "사람들이 독성 공기를 마시고 있습니다. 이는 심장병, 폐암, 아동 인지 손상을 유발합니다 — 매일 조용히." },
    hi: { headline: "वायु प्रदूषण: {v} µg/m³ PM2.5 (WHO सीमा: 15)", context: "लोग जहरीली हवा साँस ले रहे हैं। यह हृदय रोग, फेफड़ों का कैंसर और बच्चों में संज्ञानात्मक क्षति का कारण बनता है — चुपचाप, हर दिन।" },
    ru: { headline: "Загрязнение воздуха: {v} мкг/м³ PM2.5 (предел ВОЗ: 15)", context: "Люди дышат токсичным воздухом. Это вызывает болезни сердца, рак лёгких и когнитивные нарушения у детей — незаметно, каждый день." },
  },

  /* ─── PUBLIC HEALTH ─── */
  "health.hiv_prevalence_pct": {
    en: { headline: "HIV prevalence: {v}% of the adult population", context: "A preventable, treatable disease that still kills because of stigma, lack of testing, and drug shortages." },
    pt: { headline: "Prevalência de HIV: {v}% da população adulta", context: "Uma doença evitável e tratável que ainda mata por estigma, falta de testes e escassez de medicamentos." },
    es: { headline: "Prevalencia del VIH: {v}% de la población adulta", context: "Una enfermedad prevenible y tratable que aún mata por estigma, falta de pruebas y escasez de medicamentos." },
    fr: { headline: "Prévalence du VIH : {v}% de la population adulte", context: "Une maladie évitable et traitable qui tue encore à cause de la stigmatisation, du manque de dépistage et des pénuries de médicaments." },
    ar: { headline: "انتشار فيروس نقص المناعة: {v}% من البالغين", context: "مرض يمكن الوقاية منه وعلاجه لا يزال يقتل بسبب الوصم ونقص الفحوصات ونقص الأدوية." },
    zh: { headline: "艾滋病患病率：占成年人口的{v}%", context: "一种可预防、可治疗的疾病，但仍因污名化、缺乏检测和药物短缺而导致死亡。" },
    ja: { headline: "HIV有病率：成人人口の{v}%", context: "予防も治療も可能な病気が、偏見、検査不足、薬不足のために今も人を殺しています。" },
    ko: { headline: "HIV 유병률: 성인 인구의 {v}%", context: "예방 및 치료 가능한 질병이 편견, 검사 부족, 약품 부족으로 여전히 사람을 죽이고 있습니다." },
    hi: { headline: "HIV व्याप्तता: वयस्क जनसंख्या का {v}%", context: "एक रोकने योग्य, इलाज योग्य बीमारी जो कलंक, जांच की कमी और दवा की कमी के कारण आज भी मारती है।" },
    ru: { headline: "Распространённость ВИЧ: {v}% взрослого населения", context: "Предотвратимое, излечимое заболевание, которое всё ещё убивает из-за стигмы, нехватки тестирования и дефицита лекарств." },
  },
  "health.tuberculosis_per100k": {
    en: { headline: "{v} TB cases per 100,000 people", context: "Tuberculosis is curable for a few dollars. People die because the health system doesn't reach them in time." },
    pt: { headline: "{v} casos de tuberculose por 100.000 pessoas", context: "A tuberculose é curável por alguns dólares. Pessoas morrem porque o sistema de saúde não as alcança a tempo." },
    es: { headline: "{v} casos de tuberculosis por cada 100.000 personas", context: "La tuberculosis es curable por unos pocos dólares. La gente muere porque el sistema de salud no los alcanza a tiempo." },
    fr: { headline: "{v} cas de tuberculose pour 100.000 habitants", context: "La tuberculose est curable pour quelques dollars. Les gens meurent parce que le système de santé ne les atteint pas à temps." },
    ar: { headline: "{v} حالة سل لكل 100.000 شخص", context: "السل قابل للشفاء مقابل بضعة دولارات. يموت الناس لأن نظام الصحة لا يصل إليهم في الوقت المناسب." },
    zh: { headline: "每10万人中有{v}例结核病", context: "结核病只需几美元就能治愈。人们之所以死亡，是因为医疗系统没有及时覆盖他们。" },
    ja: { headline: "10万人あたり{v}件の結核症例", context: "結核は数ドルで治癒可能です。医療制度が時間内に届かないために人が死んでいます。" },
    ko: { headline: "10만 명당 {v}건의 결핵 사례", context: "결핵은 몇 달러면 치료할 수 있습니다. 보건 시스템이 제때 닿지 않아 사람들이 죽습니다." },
    hi: { headline: "प्रति 100,000 लोगों पर {v} टीबी मामले", context: "ट्यूबरकुलोसिस कुछ ही डॉलर में ठीक हो सकता है। लोग इसलिए मरते हैं क्योंकि स्वास्थ्य प्रणाली समय पर उन तक नहीं पहुँचती।" },
    ru: { headline: "{v} случаев туберкулёза на 100.000 человек", context: "Туберкулёз излечим за несколько долларов. Люди умирают, потому что система здравоохранения не достигает их вовремя." },
  },

  /* ─── JUSTICE ─── */
  "justice.prison_overcrowding_pct": {
    en: { headline: "Prison overcrowding: {v}% of capacity", context: "Cells built for 4 hold 12. Disease, violence, and death are routine. Pre-trial detainees — innocent until proven guilty — suffer most." },
    pt: { headline: "Superlotação prisional: {v}% da capacidade", context: "Celas feitas para 4 abrigam 12. Doença, violência e morte são rotina. Detentos provisórios — inocentes até prova em contrário — sofrem mais." },
    es: { headline: "Hacinamiento penitenciario: {v}% de la capacidad", context: "Celdas hechas para 4 albergan a 12. Enfermedad, violencia y muerte son rutina. Los detenidos sin condena — inocentes hasta que se pruebe lo contrario — sufren más." },
    fr: { headline: "Surpopulation carcérale : {v}% de la capacité", context: "Des cellules prévues pour 4 en abritent 12. Maladie, violence et mort sont monnaie courante. Les détenus en attente de jugement — innocents jusqu'à preuve du contraire — souffrent le plus." },
    ar: { headline: "اكتظاظ السجون: {v}% من الطاقة الاستيعابية", context: "زنازن بُنيت لـ 4 تؤوي 12. المرض والعنف والموت أمر روتيني. المحتجزون قبل المحاكمة — أبرياء حتى تثبت إدانتهم — يعانون أكثر." },
    zh: { headline: "监狱过度拥挤：达到容量的{v}%", context: "为4人建造的牢房关了12人。疾病、暴力和死亡成为常态。审前拘留者——在证明有罪之前是无辜的——受苦最多。" },
    ja: { headline: "刑務所の過密：収容能力の{v}%", context: "4人用の房に12人が入れられています。病気、暴力、死が日常です。未決拘禁者 — 有罪が証明されるまでは無罪 — が最も苦しんでいます。" },
    ko: { headline: "교도소 과백: 수용 능력의 {v}%", context: "4명용 감방에 12명이 있습니다. 질병, 폭력, 사망이 일상입니다. 재판 전 구금자 — 유죄가 입증될 때까지 무죄 — 가 가장 고통받습니다." },
    hi: { headline: "जेल में भीड़भाड़: क्षमता का {v}%", context: "4 लोगों के लिए बनी कोशिकाओं में 12 लोग हैं। बीमारी, हिंसा और मौत आम बात है। पूर्व-विचाराधीन बंदी — दोष सिद्ध होने तक निर्दोष — सबसे अधिक पीड़ित होते हैं।" },
    ru: { headline: "Переполненность тюрем: {v}% от вместимости", context: "Камеры на 4 человека вмещают 12. Болезни, насилие и смерть — обычное дело. Подследственные — невиновные до доказательства вины — страдают больше всего." },
  },
};

/** Look up a need template by metric path + language, falling back to English */
export function needTemplate(path: string, lang: CampaignLang): NeedTemplate {
  return NEED_I18N[path]?.[lang] ?? NEED_I18N[path]?.en ?? { headline: "", context: "" };
}

/** Fill a template string: {v} → formatted value, {popV} → formatted population (millions) */
export function fillTemplate(tpl: string, v: number, popV?: number): string {
  return tpl.replace(/\{v\}/g, v.toFixed(v > 100 ? 0 : 1)).replace(/\{popV\}/g, (popV ?? 0).toFixed(1));
}
