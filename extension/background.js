/* ═══════════════════════════════════════════════════════════════
   V FOR X COMPASS — background service worker (MV3)
   ----------------------------------------------------------------
   Responsibilities:
     1. On install: register the context-menu item
        "Search V FOR X for '%s'".
     2. On context-menu click: resolve the selected text to an ISO3
        code; if it's a known country open its Sorrow Map dossier,
        otherwise open the V FOR X index search for that term.
     3. Message listener: content scripts / popup ask the worker to
        resolve a country name → ISO3 and to open V FOR X tabs.
   `countries.js` is loaded via importScripts() (available in MV3
   service workers) and exposes `self.V4X_COUNTRIES`.
   ═══════════════════════════════════════════════════════════════ */

try {
  importScripts("countries.js");
} catch (e) {
  console.error("[V4X Compass] failed to load countries.js:", e);
}

// Alert ticker (loads independently; the rest of the worker keeps
// working even if the feed is unreachable).
try {
  importScripts("alerts.js");
} catch (e) {
  console.error("[V4X Compass] failed to load alerts.js:", e);
}

// Namespace guard: if countries.js somehow didn't load, fall back to no-op
// resolvers so the worker never throws on startup.
const C = typeof self.V4X_COUNTRIES !== "undefined"
  ? self.V4X_COUNTRIES
  : { iso3FromText: () => null, countryFromText: () => null };

// ── Constants ──────────────────────────────────────────────────
const BASE = "https://mouracleiton.github.io/v_for_x";
const CONTEXT_ID = "vfx-search-selection";

function dossierUrl(iso3) {
  // The site lowercases the ISO3 in its route (see app/sorrow-map/page.tsx).
  return `${BASE}/sorrow-map/${iso3.toLowerCase()}/`;
}

function indexSearchUrl(term) {
  return `${BASE}/the-index?q=${encodeURIComponent(term)}`;
}

// ── 1. Context menu on install ─────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  // Re-create cleanly across updates.
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_ID,
      title: "Search V FOR X for '%s'",
      contexts: ["selection"],
    });
  });
});

// ── 2. Context-menu click ──────────────────────────────────────
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== CONTEXT_ID) return;
  const selection = (info.selectionText || "").trim();
  if (!selection) return;

  const iso3 = C.iso3FromText(selection);
  const url = iso3 ? dossierUrl(iso3) : indexSearchUrl(selection);

  // Open next to the active tab; keep opener focus.
  chrome.tabs.create({ url, index: tab ? tab.index + 1 : undefined });
});

// ── 3. Message bus ─────────────────────────────────────────────
// Protocol:
//   { type: "RESOLVE_COUNTRY", name }  → { iso3 } | { iso3: null }
//   { type: "OPEN_VFX", iso3 }         → opens dossier tab
//   { type: "OPEN_VFX_SEARCH", term }  → opens index search tab
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg !== "object") return false;

  switch (msg.type) {
    case "RESOLVE_COUNTRY": {
      const iso3 = C.iso3FromText(String(msg.name || ""));
      sendResponse({ iso3 });
      return false; // synchronous response
    }

    case "OPEN_VFX": {
      if (C.iso3FromText(String(msg.iso3 || "")) || /^[A-Z]{3}$/i.test(String(msg.iso3 || ""))) {
        chrome.tabs.create({ url: dossierUrl(String(msg.iso3).toUpperCase()) });
        sendResponse({ ok: true });
      } else {
        sendResponse({ ok: false });
      }
      return false;
    }

    case "OPEN_VFX_SEARCH": {
      const term = String(msg.term || "").trim();
      if (term) chrome.tabs.create({ url: indexSearchUrl(term) });
      sendResponse({ ok: !!term });
      return false;
    }

    default:
      return false;
  }
});

// Lifecycle log (dev convenience; harmless in production).
chrome.runtime.onStartup &&
  chrome.runtime.onStartup.addListener(() => {
    /* worker warmed — countries.js re-imported by importScripts on next wake */
  });

// ── 4. Alert ticker ────────────────────────────────────────────
// Polls the published feed; on first run primes the store silently,
// afterwards the badge + notification fire only on actual changes.
const A = typeof self.V4X_ALERTS !== "undefined" ? self.V4X_ALERTS : null;

function startTicker() {
  if (!A) return;
  A.pollOnce(true).catch(() => {}); // prime silently
  chrome.alarms.create("v4x-tick", { periodInMinutes: 15 });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm && alarm.name === "v4x-tick") A.pollOnce(false).catch(() => {});
  });
}

startTicker();
