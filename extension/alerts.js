/* ═══════════════════════════════════════════════════════════════
   V FOR X COMPASS — alert ticker (shared by background & popup)
   ----------------------------------------------------------------
   The platform is static, so there is no push channel; instead the
   extension polls the published data API every N minutes and keeps
   the last-known alert list in chrome.storage.local as the source
   of truth for the popup and the badge.

   Protocol (all plain JSON, no API key):
     GET https://mouracleiton.github.io/v_for_x/api/v1/feed/ext-ticks.json
       → { ticks: [{ iso3, title, ts, severity, url? }] }

   A "tick" fires the badge when:
     - the list changes between polls (item added / iso3 becomes
       unresolved → resolved), or
     - a stored systemNotice appears that was not seen before.
   ═══════════════════════════════════════════════════════════════ */

const V4X_TICK_URL = "https://mouracleiton.github.io/v_for_x/api/v1/feed/ext-ticks.json";
const V4X_TICK_INTERVAL_MIN = 15; // poll cadence
const STORE_KEY = "vfxTicker";

// Data we retain between polls (iso3 → last seen headline).
function emptyState() {
  return { known: {}, notice: null, updatedAt: 0 };
}

function loadState() {
  return chrome.storage.local.get([STORE_KEY]).then((r) => r[STORE_KEY] || emptyState());
}

function saveState(s) {
  return chrome.storage.local.set({ [STORE_KEY]: s });
}

async function fetchTicks() {
  const res = await fetch(V4X_TICK_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const json = await res.json();
  if (!json || !Array.isArray(json.ticks)) throw new Error("bad payload");
  return json;
}

// True when any tick is new or its headline changed since last poll.
function diffOrNew(state, ticks) {
  let fresh = 0;
  const nextKnown = {};
  for (const t of ticks) {
    const iso3 = String(t.iso3 || "").toUpperCase();
    const title = String(t.title || "");
    if (!iso3) continue;
    if (!state.known[iso3] || state.known[iso3] !== title) fresh++;
    nextKnown[iso3] = title;
  }
  return { fresh, nextKnown };
}

async function pollOnce(silentFirst) {
  let ticks;
  try {
    ticks = await fetchTicks();
  } catch {
    // Offline or mirror down — keep prior state, no alarm.
    return;
  }

  const state = await loadState();
  const { fresh, nextKnown } = diffOrNew(state, ticks);

  // systemNotice: a one-shot alert surfaced through the same feed.
  const nextNotice = (ticks.systemNotice || null);
  const noticeFresh = nextNotice && state.notice !== nextNotice;

  if (silentFirst || (fresh === 0 && !noticeFresh)) {
    // First poll (or nothing new): just persist.
    await saveState({ known: nextKnown, notice: nextNotice || state.notice, updatedAt: Date.now() });
    return;
  }

  const headline =
    noticeFresh && nextNotice
      ? nextNotice
      : (Object.keys(nextKnown).find((k) => state.known[k] !== nextKnown[k]) && "new-tracked: " + nextKnown[Object.keys(nextKnown).find((k) => state.known[k] !== nextKnown[k])]) ||
        (fresh > 0 ? fresh + " dossier update(s)" : "feed updated");

  await saveState({ known: nextKnown, notice: nextNotice || state.notice, updatedAt: Date.now() });
  setBadge(fresh + (noticeFresh ? 1 : 0));
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: "V FOR X",
    message: headline,
    priority: 1,
  });
}

function setBadge(count) {
  const text = count > 0 ? String(Math.min(count, 99)) : "";
  try {
    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({ color: "#8b0000" });
  } catch (e) {
    /* badge unavailable (e.g. toolbox build) — alerts still work via popup */
  }
}

// Public API used by background.js and popup.js:
self.V4X_ALERTS = {
  STORE_KEY,
  loadState,
  fetchTicks,
  pollOnce,
  setBadge,
};