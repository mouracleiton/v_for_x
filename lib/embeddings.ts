/**
 * V FOR X — On-device embedding runtime
 *
 * Loads a sentence-embedding model via transformers.js so the Oracle
 * can perform genuine semantic understanding entirely in the browser
 * (WebGPU when available, WASM otherwise). This is the privacy keystone:
 * the model and its WASM runtime are public open-source artifacts fetched
 * once and cached locally; every user query is embedded on-device and never
 * transmitted anywhere.
 *
 * Polyglot: the runtime now carries a registry of selectable models
 * (SEMANTIC_MODELS). The default is the fast English-only
 * all-MiniLM-L6-v2 (384-dim, ~23MB). A larger multilingual option —
 * paraphrase-multilingual-MiniLM-L12-v2 (768-dim, 50+ languages incl.
 * Arabic, Urdu, Persian, Chinese, Russian, Hindi) — lets users query the
 * Oracle in their own language. Both models ship the same privacy
 * guarantee: weights are downloaded once and cached forever, and all
 * inference stays in this browser.
 *
 * Build-safety: this module is imported ONLY at runtime from client code
 * (inside useEffect / event handlers). transformers.js is fetched via a
 * native browser dynamic import of a CDN ESM build, which Next.js' static
 * export leaves untouched (`webpackIgnore`). Nothing here is ever part of
 * the server bundle or the static build graph, so it cannot break `next build`.
 */

import type { EmbedFn } from "./semantic-oracle";

/* ── Model registry ─────────────────────────────────────────────
 * The embedding model is a first-class, user-selectable choice: English
 * (fast, tiny) vs multilingual (50+ languages, larger). `resolveModel`
 * validates id-s, `modelForLang` picks a model from a language code, and
 * legacy consts (SEMANTIC_MODEL_ID / SEMANTIC_MODEL_DIM) keep existing
 * callers working unchanged — they point at the default English model.
 */

export interface SemanticModelInfo {
  /** transformers.js model id, e.g. "Xenova/all-MiniLM-L6-v2". */
  id: string;
  /** Output vector dimension (384 English / 768 multilingual). */
  dim: number;
  /** Short UI label, e.g. "EN — English". */
  label: string;
  /** Language codes this model is primarily aimed at (lowercase). */
  langs: string[];
  /** Approximate download size in MB (quantized weights where used). */
  sizeMB: number;
  /** One-line human note for tooltips / the model selector. */
  note: string;
}

/** Legacy constant — the default model id (English). Kept for back-compat. */
export const SEMANTIC_MODEL_ID = "Xenova/all-MiniLM-L6-v2";

/** Legacy constant — the default model dimension. Kept for back-compat. */
export const SEMANTIC_MODEL_DIM = 384;

/**
 * Selectable embedding models. Index 0 is the default (English, fast).
 *
 * Multilingual — Xenova/paraphrase-multilingual-MiniLM-L12-v2, the platform's
 * polyglot option: 768-dim, covers 50+ languages. File size is backend-
 * dependent: the loader requests q8-quantized weights on WASM (~118MB,
 * the default backend) and full fp32 weights on WebGPU (~470MB).
 */
export const SEMANTIC_MODELS: SemanticModelInfo[] = [
  {
    id: SEMANTIC_MODEL_ID,
    dim: SEMANTIC_MODEL_DIM,
    label: "EN — English",
    langs: ["en"],
    sizeMB: 23,
    note: "fast, 23MB, English only",
  },
  {
    id: "Xenova/paraphrase-multilingual-MiniLM-L12-v2",
    dim: 768,
    label: "ML — 50+ languages",
    langs: ["ar", "fa", "ur", "ru", "zh", "hi", "ja", "ko", "es", "fr", "pt"],
    sizeMB: 118,
    note: "50+ languages (Arabic, Urdu, Persian, Chinese, Russian, Hindi…) — q8 ~118MB on WASM, fp32 ~470MB on WebGPU",
  },
];

/** Resolve the default (English) model entry. */
const EN_MODEL = SEMANTIC_MODELS[0];

/**
 * Validate a model id against the registry and resolve it to its full info.
 * Defaults to the English model when no id is given; throws on unknown ids
 * so typos surface loudly at the call site instead of silently downgrading.
 */
export function resolveModel(id?: string): SemanticModelInfo {
  if (!id) return EN_MODEL;
  const found = SEMANTIC_MODELS.find((m) => m.id === id);
  if (!found) {
    throw new Error(`Unknown semantic model id: "${id}"`);
  }
  return found;
}

/**
 * Pick the best model for a user language code. This is a flag-based
 * mapping, not a per-code verification: missing/empty/"en" codes resolve
 * to the fast English model; every other code (e.g. ar/fa/ur/zh/ru/hi/
 * ja/ko/es/fr/pt — and any other non-English code) resolves to the
 * multilingual model, which natively handles 50+ languages.
 */
export function modelForLang(lang: string): SemanticModelInfo {
  const code = (lang ?? "").trim().toLowerCase();
  if (!code || code === "en") return EN_MODEL;
  return resolveModel(SEMANTIC_MODELS[1].id);
}

/** Pinned transformers.js ESM build served from the jsDelivr CDN. */
const TRANSFORMERS_CDN_URL =
  "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.6";

export type EmbedderBackend = "webgpu" | "wasm";

export interface EmbedderStatus {
  backend: EmbedderBackend;
  modelId: string;
  dim: number;
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

/* Pipelines are cached per model id, so switching models tears down the
 * old extractor's references (page-side) and boots a fresh pipeline for
 * the new model without clobbering a pipeline another page may hold. */
const pipelinePromises = new Map<
  string,
  Promise<{ extractor: TransformersFeatureExtraction; backend: EmbedderBackend }>
>();

/**
 * Load the embedding pipeline for a model (downloading + caching its
 * weights on first use). Defaults to the English model when none is given.
 * Resolves to an `EmbedFn` suitable for buildSemanticIndex / semanticSearch.
 * Returns null if the environment cannot run on-device inference.
 */
export async function getEmbedder(
  onProgress?: ProgressCb,
  model?: SemanticModelInfo
): Promise<{
  embed: EmbedFn;
  status: EmbedderStatus;
} | null> {
  const resolved = resolveModel(model?.id ?? SEMANTIC_MODEL_ID);
  if (!isSemanticSupported()) return null;

  let pipeline = pipelinePromises.get(resolved.id);
  if (!pipeline) {
    pipeline = (async () => {
      const mod = await loadTransformers(onProgress);
      const backend = detectBackend();

      const fileProgress: Record<string, number> = {};
      const extractor = await mod.pipeline("feature-extraction", resolved.id, {
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
      pipelinePromises.delete(resolved.id);
      throw err;
    });
    pipelinePromises.set(resolved.id, pipeline);
  }

  const { extractor, backend } = await pipeline;

  const embed: EmbedFn = async (texts: string[]) => {
    const output = await extractor(texts, { pooling: "mean", normalize: true });
    return output.tolist();
  };

  return {
    embed,
    status: { backend, modelId: resolved.id, dim: resolved.dim, ready: true },
  };
}