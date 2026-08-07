import type { MetadataRoute } from "next";
import backbone from "@/data/world_backbone.json";
import blueprintsData from "@/data/blueprints.json";
import dossiersData from "@/data/dossier-seed.json";
import { SITE } from "@/lib/seo";
import type { WorldBackbone } from "@/lib/types";

export const dynamic = "force-static";

const data = backbone as WorldBackbone;
const blueprints = (Array.isArray(blueprintsData) ? blueprintsData : (blueprintsData as { blueprints: { id: string }[] }).blueprints) as { id: string }[];
const dossiers = dossiersData as { id: string }[];

const BASE = SITE.url;

/* ═══ STATIC SECTION PAGES ═══ */
const STATIC_PATHS = [
  "/", "/sorrow-map/", "/equation/", "/protocol-x/", "/registry/",
  "/the-web/", "/the-trail/", "/fortress/", "/the-mask/", "/the-lens/",
  "/the-archive/", "/the-signal/", "/the-act/", "/the-index/", "/the-stories/",
  "/the-allocator/", "/the-exodus/", "/the-tactics/", "/the-matrix/",
  "/the-fronts/", "/the-choice/", "/the-briefing/", "/the-timeline/",
  "/the-api/", "/the-ledger/", "/the-dashboard/",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];

  // Home page — highest priority
  entries.push({
    url: `${BASE}/`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 1,
  });

  // Static section pages
  for (const path of STATIC_PATHS) {
    if (path === "/") continue;
    entries.push({
      url: `${BASE}${path}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    });
  }

  // Country detail pages — high priority (the core content)
  for (const c of data.countries) {
    entries.push({
      url: `${BASE}/sorrow-map/${c.iso3.toLowerCase()}/`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: c.is_hotspot ? 0.85 : 0.7,
    });
  }

  // Blueprint pages
  for (const bp of blueprints) {
    entries.push({
      url: `${BASE}/protocol-x/${bp.id}/`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.6,
    });
  }

  // Dossier pages
  for (const dos of dossiers) {
    entries.push({
      url: `${BASE}/registry/${dos.id}/`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.65,
    });
  }

  return entries;
}
