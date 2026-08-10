import { describe, it, expect } from "vitest";
import {
  SEMANTIC_MODELS,
  SEMANTIC_MODEL_ID,
  SEMANTIC_MODEL_DIM,
  resolveModel,
  modelForLang,
  type SemanticModelInfo,
} from "../lib/embeddings";

const MULTILINGUAL_ID = "Xenova/paraphrase-multilingual-MiniLM-L12-v2";

const ML_LANGS = ["ar", "fa", "ur", "ru", "zh", "hi", "ja", "ko", "es", "fr", "pt"];

/* ═══════════════════════════════════════════════════════════════
   Registry integrity
   ═══════════════════════════════════════════════════════════════ */

describe("polyglot-oracle · model registry", () => {
  it("exposes exactly the English and multilingual models", () => {
    expect(SEMANTIC_MODELS).toHaveLength(2);
  });

  it("keeps the English entry as the legacy SEMANTIC_MODEL_ID constant", () => {
    const en = SEMANTIC_MODELS.find((m) => m.id === SEMANTIC_MODEL_ID);
    expect(en).toBeDefined();
    expect(en!.dim).toBe(SEMANTIC_MODEL_DIM);
  });

  it("every entry has a unique id, positive dim, nonzero sizeMB and non-empty langs", () => {
    const ids = SEMANTIC_MODELS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of SEMANTIC_MODELS) {
      expect(m.dim).toBeGreaterThan(0);
      expect(m.sizeMB).toBeGreaterThan(0);
      expect(m.langs.length).toBeGreaterThan(0);
      expect(m.langs.every((l) => typeof l === "string" && l.length > 0)).toBe(true);
    }
  });

  it("the multilingual model covers the platform languages (768-dim)", () => {
    const ml = SEMANTIC_MODELS.find((m) => m.id === MULTILINGUAL_ID) as SemanticModelInfo;
    expect(ml).toBeDefined();
    expect(ml.dim).toBe(768);
    for (const code of ML_LANGS) {
      expect(ml.langs).toContain(code);
    }
  });
});

/* ═══════════════════════════════════════════════════════════════
   resolveModel — validation + defaults
   ═══════════════════════════════════════════════════════════════ */

describe("polyglot-oracle · resolveModel", () => {
  it("defaults to the English model when no id is given", () => {
    expect(resolveModel().id).toBe(SEMANTIC_MODEL_ID);
    expect(resolveModel(undefined).id).toBe(SEMANTIC_MODEL_ID);
    expect(resolveModel("").id).toBe(SEMANTIC_MODEL_ID);
  });

  it("resolves known ids to their registry entries", () => {
    const en = resolveModel(SEMANTIC_MODEL_ID);
    expect(en.label).toBe("EN — English");
    expect(en.dim).toBe(384);

    const ml = resolveModel(MULTILINGUAL_ID);
    expect(ml.label).toBe("ML — 50+ languages");
    expect(ml.dim).toBe(768);
  });

  it("throws on unknown ids so typos surface", () => {
    expect(() => resolveModel("Xenova/does-not-exist")).toThrow(/Unknown semantic model/);
  });
});

/* ═══════════════════════════════════════════════════════════════
   modelForLang — language → model mapping (flag-based)
   ═══════════════════════════════════════════════════════════════ */

describe("polyglot-oracle · modelForLang", () => {
  it("English and empty / unknown codes resolve to the EN model", () => {
    expect(modelForLang("en").id).toBe(SEMANTIC_MODEL_ID);
    expect(modelForLang("EN").id).toBe(SEMANTIC_MODEL_ID);
    expect(modelForLang("").id).toBe(SEMANTIC_MODEL_ID);
    expect(modelForLang("  ").id).toBe(SEMANTIC_MODEL_ID);
    expect(modelForLang(undefined as unknown as string).id).toBe(SEMANTIC_MODEL_ID);
  });

  it("platform languages resolve to the multilingual model", () => {
    for (const code of ML_LANGS) {
      expect(modelForLang(code).id).toBe(MULTILINGUAL_ID);
    }
  });

  it("is flag-based: any non-English code (incl. unlisted ones like de/it) routes to the multilingual model", () => {
    expect(modelForLang("de").id).toBe(MULTILINGUAL_ID);
    expect(modelForLang("it").id).toBe(MULTILINGUAL_ID);
    expect(modelForLang("xx").id).toBe(MULTILINGUAL_ID);
  });
});