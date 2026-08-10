/* ═══════════════════════════════════════════════════════════════
   V FOR X COMPASS — content script
   ----------------------------------------------------------------
   Runs at document_idle on every page. `countries.js` is injected
   just before this file and exposes `window.V4X_COUNTRIES`.

   Two features:
     1. SELECTION TOOLTIP — when the user selects text that resolves
        to a known country, show a dark floating tooltip (shadow DOM)
        with flag + quick stats + "View on V FOR X →". Auto-dismisses
        after 5s or on click-away.
     2. FULL-PAGE HIGHLIGHTING — toggled from the popup. Scans text
        nodes for country names and underlines them (crimson dashed).

   All UI is isolated in a Shadow DOM or uses inline styles so it
   cannot collide with the host page.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  const C =
    typeof window.V4X_COUNTRIES !== "undefined"
      ? window.V4X_COUNTRIES
      : { COUNTRY_NAMES: [], countryFromText: () => null, TOP_STATS: {}, wfpLabel: () => "—" };

  const BASE = "https://mouracleiton.github.io/v_for_x";
  const dossierUrl = (iso3) => `${BASE}/sorrow-map/${iso3.toLowerCase()}/`;
  const indexSearchUrl = (term) => `${BASE}/the-index?q=${encodeURIComponent(term)}`;

  const HIGHLIGHT_ATTR = "data-vfx-iso3";
  const HIGHLIGHT_CLASS = "vfx-compass-hl";
  const STORAGE_KEY = "vfx_highlight_enabled";
  const TOOLTIP_TTL_MS = 5000;

  let highlightingEnabled = false;
  let tooltipTimer = null;

  /* ═══════════════════════════════════════════════════════════════
     1. SELECTION TOOLTIP
     ═══════════════════════════════════════════════════════════════ */

  let tooltipHost = null;
  let tooltipShadow = null;
  let tooltipBox = null;

  function ensureTooltip() {
    if (tooltipHost) return tooltipBox;

    tooltipHost = document.createElement("div");
    tooltipHost.id = "vfx-compass-tooltip-root";
    Object.assign(tooltipHost.style, {
      all: "initial",
      position: "fixed",
      top: "0",
      left: "0",
      zIndex: "2147483647",
      pointerEvents: "none",
      // will be moved via transform
      transform: "translate(-9999px,-9999px)",
    });

    tooltipShadow = tooltipHost.attachShadow({ mode: "closed" });
    tooltipShadow.innerHTML = `
      <style>
        :host, * { all: initial; box-sizing: border-box; }
        .box {
          font-family: "JetBrains Mono","Fira Code","SF Mono","Cascadia Code","Menlo","Consolas",monospace;
          background: #060b14;
          color: #dfe7f5;
          border: 1px solid #c42b3e;
          border-radius: 6px;
          padding: 10px 12px;
          width: 240px;
          pointer-events: auto;
          box-shadow: 0 8px 28px rgba(0,0,0,.55), 0 0 0 1px rgba(196,43,62,.25);
          backdrop-filter: blur(8px);
          position: absolute;
          top: 0; left: 0;
          transform: translateY(8px);
          opacity: 0;
          animation: vfx-in .14s ease forwards;
        }
        .head { display:flex; align-items:center; gap:8px; margin-bottom:8px; }
        .flag { font-size: 18px; line-height:1; }
        .iso { font-size: 10px; font-weight: 700; letter-spacing: .12em;
               color:#e23856; border:1px solid #5a1828; padding:1px 5px; border-radius:3px; }
        .name { font-size: 13px; font-weight: 700; color:#dfe7f5; flex:1; overflow:hidden;
                text-overflow:ellipsis; white-space:nowrap; }
        .stats { display:flex; flex-direction:column; gap:4px; margin-bottom:9px; }
        .stat { display:flex; justify-content:space-between; align-items:baseline; font-size:11px; }
        .stat .k { color:#4a5d7a; text-transform:uppercase; letter-spacing:.06em; }
        .stat .v { color:#f0a93b; font-weight:700; }
        .stat .v.bad { color:#e23856; }
        .stat .v.ok  { color:#22d3a6; }
        .pill { font-size:9px; font-weight:700; letter-spacing:.08em; text-transform:uppercase;
                color:#e23856; border:1px solid #5a1828; border-radius:3px; padding:2px 6px;
                display:inline-block; }
        .link { display:flex; align-items:center; justify-content:space-between;
                font-size:12px; font-weight:700; color:#22d3a6; text-decoration:none;
                border-top:1px solid #1a2a44; padding-top:8px; cursor:pointer; }
        .link:hover { color:#7db5ff; }
        .link .arrow { color:#c42b3e; }
        .empty { font-size:11px; color:#8da3c4; margin-bottom:9px; }
        @keyframes vfx-in { to { opacity:1; transform: translateY(0); } }
      </style>
      <div class="box" part="box"></div>
    `;
    tooltipBox = tooltipShadow.querySelector(".box");

    document.documentElement.appendChild(tooltipHost);
    return tooltipBox;
  }

  function buildTooltipHTML(country) {
    const stats = C.TOP_STATS && C.TOP_STATS[country.iso3];
    const wfpLabel = stats ? C.wfpLabel(stats.wfpClass) : null;
    let statsHTML = "";
    if (stats) {
      const rows = [];
      rows.push(
        `<div class="stat"><span class="k">Severity</span>` +
          `<span class="v bad">${Number(stats.score).toFixed(0)}/100</span></div>`
      );
      if (stats.undernour != null) {
        rows.push(
          `<div class="stat"><span class="k">Undernourished</span>` +
            `<span class="v bad">${Number(stats.undernour).toFixed(1)}%</span></div>`
        );
      }
      if (stats.conflict != null) {
        rows.push(
          `<div class="stat"><span class="k">Conflict</span>` +
            `<span class="v bad">${stats.conflict}/5</span></div>`
        );
      }
      if (stats.displaced != null && stats.displaced > 0) {
        rows.push(
          `<div class="stat"><span class="k">Displaced</span>` +
            `<span class="v">${Number(stats.displaced).toFixed(1)}M</span></div>`
        );
      }
      statsHTML = `<div class="stats">${rows.join("")}</div>`;
    } else {
      statsHTML = `<div class="empty">// Full intelligence dossier available on V FOR X.</div>`;
    }

    const pill = wfpLabel ? `<span class="pill">${wfpLabel}</span>` : "";

    return `
      <div class="head">
        <span class="flag">${country.flag || "🏳️"}</span>
        <span class="name">${country.name}</span>
        <span class="iso">${country.iso3}</span>
      </div>
      ${pill ? `<div style="margin-bottom:8px">${pill}</div>` : ""}
      ${statsHTML}
      <a class="link" href="${dossierUrl(country.iso3)}" target="_blank" rel="noopener noreferrer">
        <span>View on V FOR X</span><span class="arrow">→</span>
      </a>
    `;
  }

  function showTooltipForSelection() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;

    const text = sel.toString();
    const country = C.countryFromText(text);
    if (!country) return;

    const box = ensureTooltip();
    box.innerHTML = buildTooltipHTML(country);

    const rect = sel.getRangeAt(0).getBoundingClientRect();
    // Wait one frame so the box has measured size before placing.
    requestAnimationFrame(() => {
      const bw = box.offsetWidth || 240;
      const bh = box.offsetHeight || 120;
      const gap = 10;
      const vw = document.documentElement.clientWidth;
      const vh = document.documentElement.clientHeight;

      let x = rect.left + rect.width / 2 - bw / 2;
      x = Math.max(8, Math.min(x, vw - bw - 8));

      // Prefer below; if no room, place above.
      let below = rect.bottom + gap + bh < vh;
      const y = below ? rect.bottom + gap : Math.max(8, rect.top - gap - bh);

      // Move the host; the inner box is offset from host origin.
      tooltipHost.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    });

    scheduleDismiss();
  }

  function scheduleDismiss() {
    clearTimeout(tooltipTimer);
    tooltipTimer = setTimeout(hideTooltip, TOOLTIP_TTL_MS);
  }

  function hideTooltip() {
    if (tooltipHost) tooltipHost.style.transform = "translate(-9999px,-9999px)";
    clearTimeout(tooltipTimer);
  }

  // Throttle the selection handler a touch (selectionchange fires a lot).
  let selRaf = null;
  document.addEventListener("selectionchange", () => {
    if (selRaf) return;
    selRaf = requestAnimationFrame(() => {
      selRaf = null;
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        hideTooltip();
        return;
      }
      showTooltipForSelection();
    });
  });

  // Click-away dismiss (ignore clicks inside the shadow tooltip).
  document.addEventListener(
    "mousedown",
    (e) => {
      if (!tooltipHost) return;
      if (e.target && e.target.closest && e.target.closest("#vfx-compass-tooltip-root")) return;
      hideTooltip();
    },
    true
  );

  // Hide when the page scrolls or loses focus.
  window.addEventListener("scroll", hideTooltip, true);
  window.addEventListener("blur", hideTooltip);

  /* ═══════════════════════════════════════════════════════════════
     2. FULL-PAGE HIGHLIGHTING
     ═══════════════════════════════════════════════════════════════ */

  // Build a safe matcher from PRIMARY names only (all ≥4 chars,
  // unambiguous, no short codes). Sorted longest-first so e.g.
  // "DR Congo" wins over "Congo".
  const HL_NAMES = C.COUNTRY_NAMES.map((c) => c.name).filter(Boolean);
  HL_NAMES.sort((a, b) => b.length - a.length);

  const HL_NAME_TO_ISO3 = {};
  for (const c of C.COUNTRY_NAMES) HL_NAME_TO_ISO3[c.name.toLowerCase()] = c.iso3;

  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  const HL_REGEX = new RegExp("\\b(" + HL_NAMES.map(escapeRegex).join("|") + ")\\b", "gi");

  // Nodes we must never walk into / modify.
  function isForbiddenNode(node) {
    if (!node) return true;
    const tag = node.nodeName;
    if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT" || tag === "IFRAME") return true;
    if (tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT") return true;
    if (node.isContentEditable) return true;
    // Don't touch our tooltip host.
    if (node.id === "vfx-compass-tooltip-root") return true;
    return false;
  }

  function highlightAll() {
    if (!HL_NAMES.length) return;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentNode;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (isForbiddenNode(parent)) return NodeFilter.FILTER_REJECT;
        // Skip already-highlighted spans.
        if (parent.nodeType === 1 && parent.classList && parent.classList.contains(HIGHLIGHT_CLASS))
          return NodeFilter.FILTER_REJECT;
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const targets = [];
    let n;
    while ((n = walker.nextNode())) targets.push(n);

    for (const textNode of targets) {
      const text = textNode.nodeValue;
      HL_REGEX.lastIndex = 0;
      if (!HL_REGEX.test(text)) continue;

      HL_REGEX.lastIndex = 0;
      const frag = document.createDocumentFragment();
      let last = 0;
      let m;
      while ((m = HL_REGEX.exec(text)) !== null) {
        const matchStart = m.index;
        const matchEnd = matchStart + m[0].length;
        const iso3 = HL_NAME_TO_ISO3[m[0].toLowerCase()];
        if (matchStart > last) frag.appendChild(document.createTextNode(text.slice(last, matchStart)));
        const span = document.createElement("span");
        span.className = HIGHLIGHT_CLASS;
        span.setAttribute(HIGHLIGHT_ATTR, iso3);
        span.title = `V FOR X — ${m[0]} · click to open dossier`;
        // Inline styles so we inject zero CSS into the page.
        Object.assign(span.style, {
          textDecoration: "underline",
          textDecorationStyle: "dashed",
          textDecorationColor: "#c42b3e",
          textUnderlineOffset: "2px",
          color: "inherit",
          cursor: "help",
          background: "rgba(196,43,62,0.06)",
          borderRadius: "2px",
        });
        span.textContent = m[0];
        frag.appendChild(span);
        last = matchEnd;
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      textNode.parentNode.replaceChild(frag, textNode);
    }
  }

  function unhighlightAll() {
    const spans = document.body.querySelectorAll(`span[${HIGHLIGHT_ATTR}]`);
    spans.forEach((span) => {
      const parent = span.parentNode;
      if (!parent) return;
      // Replace the span with its text, then merge adjacent text nodes.
      while (span.firstChild) parent.insertBefore(span.firstChild, span);
      parent.removeChild(span);
      parent.normalize();
    });
  }

  function setHighlighting(enabled) {
    highlightingEnabled = !!enabled;
    if (highlightingEnabled) {
      highlightAll();
    } else {
      unhighlightAll();
    }
  }

  // Clicking an underlined country opens its dossier (user gesture).
  document.addEventListener("click", (e) => {
    const span = e.target && e.target.closest ? e.target.closest(`span[${HIGHLIGHT_ATTR}]`) : null;
    if (!span) return;
    const iso3 = span.getAttribute(HIGHLIGHT_ATTR);
    if (iso3) {
      e.stopPropagation();
      window.open(dossierUrl(iso3), "_blank", "noopener,noreferrer");
    }
  });

  /* ═══════════════════════════════════════════════════════════════
     3. MESSAGE BUS + STATE RESTORE
     ═══════════════════════════════════════════════════════════════ */

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || typeof msg !== "object") return false;
    if (msg.type === "TOGGLE_HIGHLIGHT") {
      setHighlighting(msg.enabled);
      sendResponse({ ok: true, enabled: highlightingEnabled });
      return false;
    }
    if (msg.type === "GET_HIGHLIGHT_STATE") {
      sendResponse({ enabled: highlightingEnabled });
      return false;
    }
    return false;
  });

  // Restore highlight state from storage on load (best-effort).
  try {
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(STORAGE_KEY, (res) => {
        if (res && res[STORAGE_KEY] === true) setHighlighting(true);
      });
    }
  } catch (_) {
    /* storage unavailable — ignore */
  }
})();
