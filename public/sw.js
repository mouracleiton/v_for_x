/* ═══════════════════════════════════════════════════════════════
   V FOR X — Service Worker  (vfx-v2)
   Offline-first PWA shell. Caches the static build so the platform
   survives network disruption. "The platform that refuses to die."

   Strategies:
     • Network-first  — navigation requests (offline fallback page)
     • Cache-first    — _next/static, /data/, images
     • Stale-revalidate — everything else
   Extras:
     • Background sync queue for POST-like operations
     • ~50 MB cache budget with oldest-first eviction
     • Message API: SKIP_WAITING, CACHE_COUNTRY_PACK, CLEAR_ALL
     • Push notifications for crisis alerts
   ═══════════════════════════════════════════════════════════════ */

const CACHE_NAME = "vfx-v2";

/* The offline-manager (idb package) and this service worker share one
   database so the page and the worker read/write the same queue + meta.
   Both define identical stores in their upgrade callbacks. */
const OFFLINE_DB = "vfx-offline";
const OFFLINE_DB_VERSION = 1;
const QUEUE_STORE = "action-queue"; // keyPath "id", autoIncrement
const COUNTRY_STORE = "country-packs"; // keyPath "iso3"
const META_STORE = "cache-meta"; // keyPath "url"  { url, size, ts }

const MAX_CACHE_BYTES = 50 * 1024 * 1024; // 50 MB budget

/* Section page shells to precache (trailing slash = static export convention) */
const SECTIONS = [
  "equation", "fortress", "protocol-x", "registry", "sorrow-map",
  "the-act", "the-allocator", "the-api", "the-archive", "the-briefing",
  "the-choice", "the-dashboard", "the-exodus", "the-fronts", "the-index",
  "the-ledger", "the-lens", "the-mask", "the-matrix", "the-signal",
  "the-stories", "the-tactics", "the-timeline", "the-trail", "the-web",
];

const PRECACHE = [
  "./",
  "./manifest.json",
  ...SECTIONS.map((s) => `./${s}/`),
];

/* ═══════════════════════════════════════════════════════════════
   IndexedDB helpers (raw — the SW cannot import the `idb` npm package)
   ═══════════════════════════════════════════════════════════════ */

function openOfflineDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(OFFLINE_DB, OFFLINE_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(COUNTRY_STORE)) {
        db.createObjectStore(COUNTRY_STORE, { keyPath: "iso3" });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: "url" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbTx(db, store, mode) {
  return db.transaction(store, mode).objectStore(store);
}

function dbPut(db, store, value) {
  return new Promise((resolve, reject) => {
    const r = dbTx(db, store, "readwrite").put(value);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
}

function dbGetAll(db, store) {
  return new Promise((resolve, reject) => {
    const r = dbTx(db, store, "readonly").getAll();
    r.onsuccess = () => resolve(r.result || []);
    r.onerror = () => reject(r.error);
  });
}

function dbDelete(db, store, key) {
  return new Promise((resolve, reject) => {
    const r = dbTx(db, store, "readwrite").delete(key);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
}

function dbClear(db, store) {
  return new Promise((resolve, reject) => {
    const r = dbTx(db, store, "readwrite").clear();
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
}

function queueAdd(action) {
  return openOfflineDB().then((db) =>
    dbPut(db, QUEUE_STORE, { ...action, ts: Date.now(), status: "queued" })
  );
}

function queueGetAll() {
  return openOfflineDB().then((db) => dbGetAll(db, QUEUE_STORE));
}

function queueDelete(id) {
  return openOfflineDB().then((db) => dbDelete(db, QUEUE_STORE, id));
}

function metaPut(url, size) {
  return openOfflineDB()
    .then((db) => dbPut(db, META_STORE, { url, size, ts: Date.now() }))
    .catch(() => {});
}

function metaGetAll() {
  return openOfflineDB()
    .then((db) => dbGetAll(db, META_STORE))
    .catch(() => []);
}

function metaDelete(url) {
  return openOfflineDB()
    .then((db) => dbDelete(db, META_STORE, url))
    .catch(() => {});
}

/* ═══════════════════════════════════════════════════════════════
   Cache size management — record sizes, evict oldest over budget
   ═══════════════════════════════════════════════════════════════ */

function responseSize(res) {
  const len = res.headers.get("content-length");
  if (len) {
    const n = parseInt(len, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0; // unknown — refined below if needed
}

/** Store a response in the cache and record its byte size for budgeting. */
async function putInCache(cache, request, response) {
  let size = responseSize(response);
  try {
    await cache.put(request, response.clone());
    if (!size) {
      // Fall back to measuring the body once after the put.
      try {
        size = (await response.clone().arrayBuffer()).byteLength;
      } catch (_) {
        size = 0;
      }
    }
  } catch (_) {
    return;
  }
  const url = typeof request === "string" ? request : request.url;
  await metaPut(url, size);
  await evictIfNeeded(cache);
}

async function evictIfNeeded(cache) {
  const metas = await metaGetAll();
  const total = metas.reduce((sum, m) => sum + (m.size || 0), 0);
  if (total <= MAX_CACHE_BYTES) return;

  // Evict oldest first until under 90 % of budget.
  metas.sort((a, b) => (a.ts || 0) - (b.ts || 0));
  const target = MAX_CACHE_BYTES * 0.9;
  let running = total;
  for (const m of metas) {
    if (running <= target) break;
    try {
      await cache.delete(m.url);
    } catch (_) {
      /* ignore */
    }
    await metaDelete(m.url);
    running -= m.size || 0;
  }
}

/* ═══════════════════════════════════════════════════════════════
   Offline fallback page (self-contained, themed, no extra file needed)
   ═══════════════════════════════════════════════════════════════ */

const OFFLINE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>V FOR X — OFFLINE</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: flex; align-items: center;
    justify-content: center; padding: 2rem; text-align: center;
    font-family: "JetBrains Mono", "Fira Code", "SF Mono", Menlo, Consolas, monospace;
    background: #060b14; color: #dfe7f5;
  }
  .card { max-width: 28rem; border: 1px solid #1a2a44; background: #0f1a2e; padding: 2.5rem 2rem; }
  .tag { font-size: .7rem; letter-spacing: .3em; color: #f0a93b; text-transform: uppercase; }
  h1 { font-size: 1.4rem; margin: 1rem 0 .5rem; color: #e23856; letter-spacing: .15em; }
  p { color: #8da3c4; font-size: .85rem; line-height: 1.7; margin: .5rem 0; }
  code { color: #22d3a6; }
  a { display: inline-block; margin-top: 1.5rem; padding: .6rem 1.4rem; border: 1px solid #5b9cf6;
       color: #5b9cf6; text-decoration: none; text-transform: uppercase; letter-spacing: .15em; font-size: .75rem; }
  a:hover { background: rgba(91,156,246,.12); }
</style>
</head>
<body>
  <div class="card">
    <div class="tag">// signal lost</div>
    <h1>NETWORK&nbsp;SEVERED</h1>
    <p>You are offline. Cached country packs and previously visited sections remain operational.</p>
    <p>Code: <code>ERR_OFFLINE_SHELL_ACTIVE</code></p>
    <a href="./">↻ RETRY CONNECTION</a>
  </div>
</body>
</html>`;

function offlineResponse() {
  return new Response(OFFLINE_HTML, {
    status: 503,
    statusText: "Service Unavailable",
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/* ═══════════════════════════════════════════════════════════════
   INSTALL — precache the app shell (resilient to individual failures)
   ═══════════════════════════════════════════════════════════════ */

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // addAll rejects if any URL fails — use per-request fallback instead.
      await Promise.allSettled(
        PRECACHE.map(async (url) => {
          try {
            const res = await fetch(url, { cache: "reload" });
            if (res.ok) await putInCache(cache, url, res);
          } catch (_) {
            /* skip unavailable precache entry */
          }
        })
      );
      // Offline shell is always available once installed.
      await putInCache(
        cache,
        "./offline.html",
        new Response(OFFLINE_HTML, {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        })
      );
    })()
  );
  self.skipWaiting();
});

/* ═══════════════════════════════════════════════════════════════
   ACTIVATE — purge old caches, claim clients
   ═══════════════════════════════════════════════════════════════ */

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

/* ═══════════════════════════════════════════════════════════════
   FETCH — routing by strategy
   ═══════════════════════════════════════════════════════════════ */

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle same-origin GET requests.
  if (req.method !== "GET") {
    // Intercept write methods → queue for background sync.
    if (req.method === "POST" || req.method === "PUT" || req.method === "DELETE") {
      event.respondWith(queueWriteRequest(req));
    }
    return;
  }

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 1) Navigation → network-first with offline fallback.
  if (req.mode === "navigate") {
    event.respondWith(networkFirstNavigation(req));
    return;
  }

  // 2) Static assets & data → cache-first.
  if (
    url.pathname.includes("_next/static") ||
    url.pathname.includes("/data/") ||
    req.destination === "image" ||
    /\.(?:png|jpe?g|gif|webp|svg|ico|woff2?|ttf|css|js)(?:\?|$)/i.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // 3) Everything else → stale-while-revalidate.
  event.respondWith(staleWhileRevalidate(req));
});

async function networkFirstNavigation(req) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const res = await fetch(req);
    if (res && res.ok) await putInCache(cache, req, res);
    return res;
  } catch (_) {
    const cached = await caches.match(req);
    if (cached) return cached;
    const home = await caches.match("./");
    if (home) return home;
    const offline = await caches.match("./offline.html");
    return offline || offlineResponse();
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res && res.ok) await putInCache(cache, req, res);
    return res;
  } catch (_) {
    return cached || Response.error();
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);
  const network = fetch(req)
    .then((res) => {
      if (res && res.ok) putInCache(cache, req, res);
      return res;
    })
    .catch(() => cached);
  return cached || network;
}

/** Capture a write request into the background-sync queue. */
async function queueWriteRequest(req) {
  let body = null;
  try {
    body = await req.clone().text();
  } catch (_) {
    body = null;
  }
  try {
    await queueAdd({
      type: "write",
      method: req.method,
      url: req.url,
      body,
      ts: Date.now(),
    });
    // Kick a background sync if the API is available.
    try {
      if (self.registration && "sync" in self.registration) {
        await self.registration.sync.register("vfx-sync");
      }
    } catch (_) {
      /* sync unsupported — will retry on next sync/activate */
    }
  } catch (_) {
    /* ignore */
  }
  return new Response(
    JSON.stringify({ queued: true, message: "Saved offline — will sync when online." }),
    { status: 202, headers: { "Content-Type": "application/json" } }
  );
}

/* ═══════════════════════════════════════════════════════════════
   MESSAGE API — page → worker commands
   ═══════════════════════════════════════════════════════════════ */

self.addEventListener("message", (event) => {
  const data = event.data || {};
  const type = data.type;

  if (type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (type === "CLEAR_ALL") {
    event.waitUntil?.(
      (async () => {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
        try {
          const db = await openOfflineDB();
          await dbClear(db, QUEUE_STORE);
          await dbClear(db, COUNTRY_STORE);
          await dbClear(db, META_STORE);
        } catch (_) {
          /* ignore */
        }
      })()
    );
    return;
  }

  if (type === "CACHE_COUNTRY_PACK") {
    const iso3 = String(data.iso3 || "").toUpperCase();
    if (iso3) {
      event.waitUntil?.(cacheCountryPack(iso3, data.name));
    }
    return;
  }
});

/** Proactively cache every resource relevant to a single country. */
async function cacheCountryPack(iso3, name) {
  const cache = await caches.open(CACHE_NAME);
  const lower = iso3.toLowerCase();
  const targets = [
    `./sorrow-map/${lower}/`,
    "./data/world_backbone_geo.json",
    "./",
    "./manifest.json",
  ];

  await Promise.allSettled(
    targets.map(async (url) => {
      try {
        const res = await fetch(url, { cache: "reload" });
        if (res && res.ok) await putInCache(cache, url, res);
      } catch (_) {
        /* skip */
      }
    })
  );

  // Record that this country is available offline.
  try {
    const db = await openOfflineDB();
    await dbPut(db, COUNTRY_STORE, {
      iso3,
      name: name || iso3,
      downloadedAt: Date.now(),
    });
  } catch (_) {
    /* ignore */
  }
}

/* ═══════════════════════════════════════════════════════════════
   BACKGROUND SYNC — replay queued actions when connectivity returns
   ═══════════════════════════════════════════════════════════════ */

self.addEventListener("sync", (event) => {
  if (event.tag === "vfx-sync") {
    event.waitUntil(replayQueue());
  }
});

async function replayQueue() {
  let items = [];
  try {
    items = await queueGetAll();
  } catch (_) {
    return;
  }
  for (const item of items) {
    if (!item || item.id === undefined) continue;
    try {
      const res = await fetch(item.url || "/", {
        method: item.method || "POST",
        headers: { "Content-Type": "application/json" },
        body: item.body ?? JSON.stringify(item),
      });
      // Only drop the item if the server actually accepted it.
      if (res && res.ok) {
        await queueDelete(item.id);
      }
    } catch (_) {
      // Still offline — keep the item for the next sync window.
    }
  }
}

/* ═══════════════════════════════════════════════════════════════
   PUSH — crisis alerts (no server required yet)
   ═══════════════════════════════════════════════════════════════ */

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_) {
    try {
      payload = { body: event.data ? event.data.text() : "" };
    } catch (_) {
      payload = {};
    }
  }

  const title = payload.title || "⚠ V FOR X — CRISIS ALERT";
  const options = {
    body: payload.body || "A threshold has been crossed. Open the platform for details.",
    icon: payload.icon || "./icon-192.png",
    badge: payload.badge || "./icon-192.png",
    tag: payload.tag || "vfx-alert",
    renotify: true,
    data: payload.data || { url: "./" },
    requireInteraction: true,
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "./";
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of allClients) {
        if ("focus" in client) {
          await client.focus();
          return client;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return null;
    })()
  );
});
