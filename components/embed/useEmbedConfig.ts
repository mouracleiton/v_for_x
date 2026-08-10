"use client";

import { useEffect, useState } from "react";
import { parseWidgetConfig, type WidgetType, type EmbedTheme } from "@/lib/embed-widgets";

export interface EmbedConfig {
  params: Record<string, string>;
  theme: EmbedTheme;
  ready: boolean;
}

/**
 * Reads a widget's configuration from the live URL search params.
 * Designed for the static-export embed routes: the iframe `src` carries
 * the config as a query string, which is parsed client-side here.
 */
export function useEmbedConfig(type: WidgetType): EmbedConfig {
  const [cfg, setCfg] = useState<EmbedConfig>({
    params: {},
    theme: "dark",
    ready: false,
  });

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    setCfg({ ...parseWidgetConfig(type, search), ready: true });
  }, [type]);

  return cfg;
}
