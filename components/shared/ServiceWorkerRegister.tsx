"use client";

import { useEffect } from "react";

/**
 * Registers the service worker for offline functionality.
 * Renders nothing — it's a side-effect-only component.
 * Only runs in production (where basePath is set) to avoid dev cache issues.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // Only register in production — dev server + SW caching = stale reloads
    if (process.env.NODE_ENV !== "production") return;

    const basePath = process.env.NODE_ENV === "production" ? "/v_for_x" : "";
    const swPath = `${basePath}/sw.js`;

    navigator.serviceWorker
      .register(swPath, { scope: `${basePath}/` })
      .catch(() => {
        // SW registration failed — silently ignore, the site still works online
      });
  }, []);

  return null;
}
