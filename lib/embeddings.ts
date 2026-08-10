/**
 * V FOR X — On-device embedding runtime
 *
 * Loads a small sentence-embedding model via transformers.js so the Oracle
 * can perform genuine semantic understanding entirely in the browser
 * (WebGPU when available, WASM otherwise). This is the privacy keystone:
 * the model and its WASM runtime are public open-source artifacts fetched
 * once and cached locally; every user query is embedded on-device and never
 * transmitted anywhere.
 *
 * Build-safety: this module is imported ONLY at runtime from client code
 * (inside useEffect / event handlers). transformers.js is fetched via a
 * native browser dynamic import of a CDN ESM build, which Next.js' static
 * export leaves untouched (`webpackIgnore`). Nothing here is ever part of
 * the server bundle or the static build graph, so it cannot break `next build`.
 */

import type { EmbedFn } from "./semantic-oracle";

/* ── The model ───────────────────────────────────────────────────
 * Xenova/all-MiniLM-L6-v2 — the canonical small (≈23 MB) sentence
 * embedding model for transformers.js. Produces 384-dim unit vectors.
 * Tiny, fast on WASM, excellent on WebGPU, multilingual-robust enough
 * for this use case. Swappable via SEMANTIC_MODEL_ID.
 */
export const SEMANTIC_MODEL_ID = "Xenova/all-MiniLM-L6-v2";
export const SEMANTIC_MODEL_DIM = 384;

/** Pinned transformers.js ESM build served from the jsDelivr CDN. */
const TRANSFORMERS_CDN_URL =
  "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.6";

export type EmbedderBackend = "webgpu" | "wasm";

export interface EmbedderStatus {
  backend: EmbedderBackend;
  modelId: string;
  ready: boolean;
}

export type ProgressCb = (frac: number, label: string) => void;

/* Minimal shape of the transformers.js API surface we touch. Keeping it
 * local avoids importing the package at build time. */
interface TransformersFeatureExtraction {
  (text: string | string[], options: {
    pooling: "mean";
    normalize: boolean;
  }): { tolist: () => number[][] };
}

interface TransformersModule {
  pipeline: (
    task: "feature-extraction",
    model: string,
    options?: {
      device?: "webgpu" | "wasm" | "cpu";
      dtype?: "fp32" | "fp16" | "q8" | "int8" | "uint8";
      progress_callback?: (data: ProgressData) => void;
    }
  ) => Promise<TransformersFeatureExtraction>;
  env: {
    allowLocalModels: boolean;
    useBrowserCache: boolean;
    remoteHost?: string;
    remotePathTemplate?: string;
  };
}

interface ProgressData {
  status: string;
  name?: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
}

/* ── Capability detection ─────────────────────────────────────── */

export function detectBackend(): EmbedderBackend {
  if (typeof navigator !== "undefined" && "gpu" in navigator) {
    return "webgpu";
  }
  return "wasm";
}

export function isSemanticSupported(): boolean {
  return typeof window !== "undefined" && typeof WebAssembly !== "undefined";
}

/* ── Module loader (native browser import, build-ignored) ─────── */

let modulePromise: Promise<TransformersModule> | null = null;

async function loadTransformers(onProgress?: ProgressCb): Promise<TransformersModule> {
  if (modulePromise) return modulePromise;
  onProgress?.(0.01, "Loading on-device inference runtime…");
  // `webpackIgnore` tells the bundler to leave this as a native runtime
  // import — the browser fetches the ESM build from the CDN at run time.
  const url = `${TRANSFORMERS_CDN_URL}/+esm`;
  modulePromise = import(/* webpackIgnore: true */ /* @vite-ignore */ url) as Promise<TransformersModule>;
  const mod = await modulePromise;
  // Serve model weights from the HuggingFace CDN, cache in the browser.
  mod.env.allowLocalModels = false;
  mod.env.useBrowserCache = true;
  return mod;
}

/* ── Pipeline + embed function ────────────────────────────────── */

let pipelinePromise: Promise<{ extractor: TransformersFeatureExtraction; backend: EmbedderBackend }> | null = null;

/**
 * Load the embedding pipeline (downloading + caching the model on first use).
 * Resolves to an `EmbedFn` suitable for buildSemanticIndex / semanticSearch.
 * Returns null if the environment cannot run on-device inference.
 */
export async function getEmbedder(onProgress?: ProgressCb): Promise<{
  embed: EmbedFn;
  status: EmbedderStatus;
} | null> {
  if (!isSemanticSupported()) return null;

  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      const mod = await loadTransformers(onProgress);
      const backend = detectBackend();

      const fileProgress: Record<string, number> = {};
      const extractor = await mod.pipeline("feature-extraction", SEMANTIC_MODEL_ID, {
        device: backend,
        dtype: backend === "webgpu" ? "fp32" : "q8",
        progress_callback: (data: ProgressData) => {
          if (data.status === "progress" && data.file && typeof data.progress === "number") {
            fileProgress[data.file] = data.progress;
            const vals = Object.values(fileProgress);
            const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
            onProgress?.(0.05 + 0.9 * (avg / 100), `Downloading model: ${data.file}…`);
          } else if (data.status === "ready") {
            onProgress?.(0.96, "Finalizing model…");
          }
        },
      });
      onProgress?.(1, "On-device model ready.");
      return { extractor, backend };
    })().catch((err) => {
      // Reset so a later retry can attempt again.
      pipelinePromise = null;
      throw err;
    });
  }

  const { extractor, backend } = await pipelinePromise;

  const embed: EmbedFn = async (texts: string[]) => {
    const output = await extractor(texts, { pooling: "mean", normalize: true });
    return output.tolist();
  };

  return {
    embed,
    status: { backend, modelId: SEMANTIC_MODEL_ID, ready: true },
  };
}
