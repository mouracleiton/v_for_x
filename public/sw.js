/* V FOR X — Service Worker
 * Offline-first shell. Caches the static build so the platform
 * survives network disruption. "The platform that refuses to die."
 */
const CACHE_NAME = "vfx-v1";
const PRECACHE = [
  "./",
  "./manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // Only handle GET
  if (req.method !== "GET") return;

  // Network-first for navigation requests, fallback to cache
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("./")))
    );
    return;
  }

  // Cache-first for static assets (_next/static, images, etc)
  if (req.url.includes("_next/static") || req.url.includes("data/")) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
            return res;
          })
      )
    );
    return;
  }

  // Stale-while-revalidate for everything else
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
