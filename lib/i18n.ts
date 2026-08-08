/**
 * V FOR X — Lightweight i18n (EN / PT-BR)
 *
 * No framework dependency. Uses a simple string dictionary with
 * localStorage persistence. The language toggle lives in BranchNav.
 */

export type Lang = "en" | "pt";

export const LANGS: { id: Lang; label: string; flag: string }[] = [
  { id: "en", label: "EN", flag: "🇬🇧" },
  { id: "pt", label: "PT", flag: "🇧🇷" },
];

/* ═══ NAVIGATION LABELS ═══ */

export const NAV_T: Record<Lang, Record<string, string>> = {
  en: {
    // Section names
    "nav.briefing": "BRIEFING",
    "nav.sorrow-map": "SORROW MAP",
    "nav.equation": "THE EQUATION",
    "nav.protocol-x": "PROTOCOL X",
    "nav.registry": "REGISTRY",
    "nav.the-web": "THE WEB",
    "nav.the-trail": "THE TRAIL",
    "nav.fortress": "FORTRESS",
    "nav.the-mask": "MASK",
    "nav.the-lens": "THE LENS",
    "nav.the-archive": "ARCHIVE",
    "nav.the-signal": "SIGNAL",
    "nav.the-act": "THE ACT",
    "nav.the-index": "THE INDEX",
    "nav.the-stories": "STORIES",
    "nav.the-allocator": "ALLOCATOR",
    "nav.the-exodus": "EXODUS",
    "nav.the-tactics": "TACTICS",
    "nav.the-matrix": "MATRIX",
    "nav.the-fronts": "FRONTS",
    "nav.the-choice": "CHOICE",
    "nav.the-briefing": "BRIEFING",
    "nav.the-timeline": "TIMELINE",
    "nav.the-api": "API",
    "nav.the-ledger": "LEDGER",
    "nav.the-dashboard": "DASHBOARD",
    // UI
    "ui.navigate": "Navigate",
    "ui.search": "Search",
    "ui.close": "Close",
    "ui.copy": "COPY",
    "ui.copied": "COPIED",
    "ui.tweet": "TWEET",
    "ui.embed": "EMBED",
    "ui.loading": "LOADING...",
    // Home
    "home.tagline": "// the platform that refuses to die",
    "home.entries": "ENTRIES // 25 SECTIONS",
    "home.explore": "[ EXPLORE ]",
    "home.explore.desc": "// understand the crisis",
    "home.analyze": "[ ANALYZE ]",
    "home.analyze.desc": "// make the argument",
    "home.act": "[ ACT ]",
    "home.act.desc": "// take action",
    "home.infra": "[ INFRASTRUCTURE ]",
    "home.infra.desc": "// tools & security",
    // Common
    "common.source": "Source",
    "common.sources": "Sources",
    "common.countries": "countries",
    "common.official": "official",
  },
  pt: {
    "nav.briefing": "INFORME",
    "nav.sorrow-map": "MAPA DA DOR",
    "nav.equation": "A EQUAÇÃO",
    "nav.protocol-x": "PROTOCOLO X",
    "nav.registry": "REGISTRO",
    "nav.the-web": "A TEIA",
    "nav.the-trail": "A TRILHA",
    "nav.fortress": "FORTALEZA",
    "nav.the-mask": "MÁSCARA",
    "nav.the-lens": "A LENTE",
    "nav.the-archive": "ARQUIVO",
    "nav.the-signal": "SINAL",
    "nav.the-act": "O ATO",
    "nav.the-index": "O ÍNDICE",
    "nav.the-stories": "HISTÓRIAS",
    "nav.the-allocator": "DISTRIBUIDOR",
    "nav.the-exodus": "ÊXODO",
    "nav.the-tactics": "TÁTICAS",
    "nav.the-matrix": "MATRIZ",
    "nav.the-fronts": "FRONTES",
    "nav.the-choice": "A ESCOLHA",
    "nav.the-briefing": "RELATÓRIO",
    "nav.the-timeline": "CRONOGRAMA",
    "nav.the-api": "API",
    "nav.the-ledger": "BALANÇO",
    "nav.the-dashboard": "PAINEL",
    "ui.navigate": "Navegar",
    "ui.search": "Buscar",
    "ui.close": "Fechar",
    "ui.copy": "COPIAR",
    "ui.copied": "COPIADO",
    "ui.tweet": "TWEET",
    "ui.embed": "EMBUTIR",
    "ui.loading": "CARREGANDO...",
    "home.tagline": "// a plataforma que se recusa a morrer",
    "home.entries": "ENTRADAS // 25 SEÇÕES",
    "home.explore": "[ EXPLORAR ]",
    "home.explore.desc": "// entenda a crise",
    "home.analyze": "[ ANALISAR ]",
    "home.analyze.desc": "// construa o argumento",
    "home.act": "[ AGIR ]",
    "home.act.desc": "// tome atitude",
    "home.infra": "[ INFRAESTRUTURA ]",
    "home.infra.desc": "// ferramentas e segurança",
    "common.source": "Fonte",
    "common.sources": "Fontes",
    "common.countries": "países",
    "common.official": "oficial",
  },
};

/* ═══ SECTION DESCRIPTIONS (for home page) ═══ */

export const SECTION_DESC: Record<string, { en: string; pt: string }> = {
  "/sorrow-map/": { en: "Atlas of suffering", pt: "Atlas do sofrimento" },
  "/equation/": { en: "Model the fix", pt: "Modele a solução" },
  "/protocol-x/": { en: "Survival blueprints", pt: "Manuais de sobrevivência" },
  "/registry/": { en: "Accountability", pt: "Responsabilização" },
  "/the-web/": { en: "Anonymous comms", pt: "Comunicação anônima" },
  "/the-trail/": { en: "Resource routing", pt: "Roteamento de recursos" },
  "/fortress/": { en: "Infrastructure", pt: "Infraestrutura" },
  "/the-mask/": { en: "Identity & OpSec", pt: "Identidade e OpSec" },
  "/the-lens/": { en: "Compare & correlate", pt: "Comparar e correlacionar" },
  "/the-archive/": { en: "Sources & methods", pt: "Fontes e métodos" },
  "/the-signal/": { en: "Watchlist alerts", pt: "Alertas de monitoramento" },
  "/the-act/": { en: "Campaign generator", pt: "Gerador de campanha" },
  "/the-index/": { en: "Vulnerability ranking", pt: "Ranking de vulnerabilidade" },
  "/the-stories/": { en: "Narrative tours", pt: "Tours narrativos" },
  "/the-allocator/": { en: "Budget simulator", pt: "Simulador de orçamento" },
  "/the-exodus/": { en: "Displacement flows", pt: "Fluxos de deslocamento" },
  "/the-tactics/": { en: "Resistance tactics", pt: "Táticas de resistência" },
  "/the-matrix/": { en: "Data transparency", pt: "Transparência de dados" },
  "/the-fronts/": { en: "Regional crises", pt: "Crises regionais" },
  "/the-choice/": { en: "Military vs health", pt: "Militar vs saúde" },
  "/the-briefing/": { en: "Country report", pt: "Relatório país" },
  "/the-timeline/": { en: "Scenario model", pt: "Modelo de cenário" },
  "/the-api/": { en: "Public data API", pt: "API de dados pública" },
  "/the-ledger/": { en: "Financing & blockers", pt: "Financiamento e barreiras" },
  "/the-dashboard/": { en: "World cockpit", pt: "Painel mundial" },
};

/* ═══ LANGUAGE STATE ═══ */

const STORAGE_KEY = "vfx-lang";

export function getStoredLang(): Lang {
  if (typeof window === "undefined") return "en";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "pt" ? "pt" : "en";
  } catch {
    return "en";
  }
}

export function setStoredLang(lang: Lang) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* ignore */
  }
}

/** Translate a key */
export function t(lang: Lang, key: string): string {
  return NAV_T[lang]?.[key] ?? NAV_T.en[key] ?? key;
}
