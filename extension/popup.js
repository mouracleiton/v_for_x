/* ═══════════════════════════════════════════════════════════════
   V FOR X COMPASS — popup logic
   ----------------------------------------------------------------
   • Country search → open Sorrow Map dossier (or index search).
   • Quick-link buttons → open the relevant V FOR X branch.
   • Highlight toggle → message the active tab's content script and
     persist the choice in chrome.storage.local.
   countries.js is loaded first and exposes window.V4X_COUNTRIES.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  const C =
    typeof window.V4X_COUNTRIES !== "undefined"
      ? window.V4X_COUNTRIES
      : { countryFromText: () => null };

  const BASE = "https://mouracleiton.github.io/v_for_x";
  const dossierUrl = (iso3) => `${BASE}/sorrow-map/${iso3.toLowerCase()}/`;
  const indexSearchUrl = (term) => `${BASE}/the-index?q=${encodeURIComponent(term)}`;
  const STORAGE_KEY = "vfx_highlight_enabled";

  const $ = (sel) => document.querySelector(sel);

  function openTab(url) {
    if (chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url });
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  /* ── 1. Country search ────────────────────────────────────── */
  const searchInput = $("#country-search");
  const searchGo = $("#search-go");
  const searchHint = $("#search-hint");

  function runSearch() {
    const term = (searchInput.value || "").trim();
    if (!term) return;
    const country = C.countryFromText(term);
    if (country) {
      searchHint.textContent = `→ Opening ${country.flag || ""} ${country.name} dossier…`;
      searchHint.classList.remove("err");
      openTab(dossierUrl(country.iso3));
    } else {
      searchHint.textContent = `→ No country match · searching index for "${term}"…`;
      searchHint.classList.add("err");
      openTab(indexSearchUrl(term));
    }
  }

  searchGo.addEventListener("click", runSearch);
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      runSearch();
    }
  });

  /* ── 2. Quick links ───────────────────────────────────────── */
  document.querySelectorAll(".qlink").forEach((btn) => {
    btn.addEventListener("click", () => {
      const sub = btn.getAttribute("data-url");
      if (sub) openTab(`${BASE}/${sub}`);
    });
  });

  $("#open-home").addEventListener("click", (e) => {
    e.preventDefault();
    openTab(`${BASE}/`);
  });

  /* ── 3. Highlight toggle ──────────────────────────────────── */
  const toggle = $("#highlight-toggle");

  function setToggleUI(on) {
    toggle.setAttribute("aria-pressed", on ? "true" : "false");
  }

  function getActiveTab(cb) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      cb(tabs && tabs[0] ? tabs[0] : null);
    });
  }

  function messageActiveTab(payload, cb) {
    getActiveTab((tab) => {
      if (!tab || !tab.id) return cb && cb(false);
      chrome.tabs.sendMessage(tab.id, payload, () => {
        // lastError if the page has no content script (e.g. chrome://).
        if (chrome.runtime.lastError) return cb && cb(false);
        cb && cb(true);
      });
    });
  }

  function applyHighlight(on, viaUser) {
    setToggleUI(on);
    messageActiveTab({ type: "TOGGLE_HIGHLIGHT", enabled: on }, (ok) => {
      if (!ok && viaUser) {
        // Tell the user why nothing happened.
        flashToggleNote(
          on
            ? "Cannot overlay this page (protected or internal)."
            : "Nothing to clear on this page."
        );
      }
    });
    // Persist (works whether or not the page could be messaged).
    try {
      chrome.storage.local.set({ [STORAGE_KEY]: on });
    } catch (_) {
      /* ignore */
    }
  }

  let noteTimer = null;
  function flashToggleNote(text) {
    const hint = toggle.nextElementSibling;
    if (!hint) return;
    const original = hint.getAttribute("data-original") || hint.textContent;
    hint.setAttribute("data-original", original);
    hint.textContent = text;
    hint.style.color = "var(--amber)";
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => {
      hint.textContent = original;
      hint.style.color = "";
    }, 2600);
  }

  toggle.addEventListener("click", () => {
    const next = toggle.getAttribute("aria-pressed") !== "true";
    applyHighlight(next, true);
  });

  // Restore last saved state for the LED only (the content script
  // restores the actual overlay on the page itself).
  try {
    chrome.storage.local.get(STORAGE_KEY, (res) => {
      if (res && res[STORAGE_KEY] === true) setToggleUI(true);
    });
  } catch (_) {
    /* ignore */
  }

  /* ── 4. Alert ticker display ───────────────────────────────── */
  // Reads the state the background worker keeps in storage.local
  // and renders the last-known alerts + badge-clearing.
  const tickerList = $("#ticker-list");

  function renderTicker(state) {
    if (!tickerList) return;
    const known = (state && state.known) || {};
    const keys = Object.keys(known);
    tickerList.innerHTML = "";
    if (!keys.length) {
      const el = document.createElement("div");
      el.className = "hint";
      el.textContent = "No feed state yet — background worker will poll soon.";
      tickerList.appendChild(el);
      return;
    }
    keys.forEach((iso3) => {
      const row = document.createElement("div");
      row.className = "ticker-row";
      row.innerHTML =
        `<span class="ticker-flag">${iso3}</span>` +
        `<span class="ticker-title">${escapeHtml(known[iso3])}</span>`;
      row.addEventListener("click", () => {
        openTab(dossierUrl(iso3));
        clearBadge();
      });
      tickerList.appendChild(row);
    });
    if (state.notice) {
      const notice = document.createElement("div");
      notice.className = "ticker-notice";
      notice.textContent = `⚑ ${state.notice}`;
      tickerList.appendChild(notice);
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function clearBadge() {
    if (chrome.action && chrome.action.setBadgeText) {
      chrome.action.setBadgeText({ text: "" });
    }
  }

  try {
    chrome.storage.local.get("vfxTicker", (res) => {
      renderTicker(res && res.vfxTicker);
    });
  } catch (_) {
    /* ignore */
  }

  // Focus the search box for immediate keyboard use.
  searchInput.focus();
})();
