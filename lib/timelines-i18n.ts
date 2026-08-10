/**
 * V FOR X — Crisis timeline translations (10 languages)
 *
 * Aggregates 4 partial files into a unified translation map
 * for all 154 crisis events across 22 countries.
 *
 * Supported languages: en, pt, es, fr, zh, ja, ko, hi, ar, ru
 */

import type { Lang } from "./i18n";
import { TIMELINE_PART1 } from "./timelines-i18n-part1";
import { TIMELINE_PART2 } from "./timelines-i18n-part2";
import { TIMELINE_PART3 } from "./timelines-i18n-part3";
import { TIMELINE_PART4 } from "./timelines-i18n-part4";

export const TIMELINE_I18N: Record<string, Partial<Record<Lang, string[]>>> = {
  ...TIMELINE_PART1,
  ...TIMELINE_PART2,
  ...TIMELINE_PART3,
  ...TIMELINE_PART4,
};

/** Translate a single timeline event by iso3, index, and language. */
export function tle(iso3: string, index: number, lang: Lang): string {
  const events = TIMELINE_I18N[iso3]?.[lang];
  if (events && index < events.length) return events[index];
  const enEvents = TIMELINE_I18N[iso3]?.en;
  if (enEvents && index < enEvents.length) return enEvents[index];
  return "";
}

/** Get all translated events for a country. */
export function tlEvents(iso3: string, lang: Lang): string[] {
  return TIMELINE_I18N[iso3]?.[lang] ?? TIMELINE_I18N[iso3]?.en ?? [];
}
