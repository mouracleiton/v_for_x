import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { WorldBackbone } from "../lib/types";
import backbone from "../data/world_backbone.json";
import {
  loadAIConfig,
  saveAIConfig,
  clearAIConfig,
  generateAIMessage,
  generateAIBatch,
  PLATFORM_STYLES,
  TONE_VARIANTS,
  ANGLE_VARIANTS,
  type AIConfig,
} from "../lib/ai-generator";

const data = backbone as WorldBackbone;
const country = data.countries[0];
const CONFIG: AIConfig = {
  baseUrl: "https://api.example.com/v1",
  apiKey: "sk-test-key",
  model: "test-model",
};

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

function errorResponse(status: number, body: string): Response {
  return { ok: false, status, text: async () => body } as Response;
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ai-generator.ts — AI Campaign Generator", () => {
  describe("config persistence", () => {
    it("loadAIConfig returns null when nothing stored", () => {
      expect(loadAIConfig()).toBeNull();
    });

    it("saveAIConfig then loadAIConfig round-trips", () => {
      saveAIConfig(CONFIG);
      const loaded = loadAIConfig();
      expect(loaded).toEqual(CONFIG);
    });

    it("clearAIConfig removes the stored config", () => {
      saveAIConfig(CONFIG);
      clearAIConfig();
      expect(loadAIConfig()).toBeNull();
    });

    it("loadAIConfig returns null for malformed JSON", () => {
      localStorage.setItem("vfx-ai-config", "{not json");
      expect(loadAIConfig()).toBeNull();
    });

    it("loadAIConfig returns null when required fields are missing", () => {
      localStorage.setItem("vfx-ai-config", JSON.stringify({ baseUrl: "x" }));
      expect(loadAIConfig()).toBeNull();
    });
  });

  describe("exported variant registries", () => {
    it("exposes platform styles with max length instructions", () => {
      expect(Object.keys(PLATFORM_STYLES).length).toBeGreaterThanOrEqual(4);
      for (const style of Object.values(PLATFORM_STYLES)) {
        expect(style.name).toBeTruthy();
        expect(style.maxLen).toBeGreaterThan(0);
        expect(style.instructions.length).toBeGreaterThan(0);
      }
    });

    it("exposes non-empty tone and angle variants", () => {
      expect(TONE_VARIANTS.length).toBeGreaterThanOrEqual(4);
      expect(ANGLE_VARIANTS.length).toBeGreaterThanOrEqual(3);
      for (const t of TONE_VARIANTS) expect(t.length).toBeGreaterThan(0);
      for (const a of ANGLE_VARIANTS) expect(a.length).toBeGreaterThan(0);
    });
  });

  describe("generateAIMessage", () => {
    it("posts to <baseUrl>/chat/completions and returns trimmed text", async () => {
      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(
          jsonResponse({
            choices: [{ message: { content: "  A powerful message  " } }],
          }),
        );

      const result = await generateAIMessage(CONFIG, country, data, "twitter");

      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toBe("https://api.example.com/v1/chat/completions");
      const opts = init as RequestInit;
      expect(opts.method).toBe("POST");
      expect((opts.headers as Record<string, string>)["Authorization"]).toBe(
        "Bearer sk-test-key",
      );
      const body = JSON.parse(opts.body as string);
      expect(body.model).toBe("test-model");
      expect(body.messages).toHaveLength(2);
      expect(body.messages[0].role).toBe("system");
      expect(body.messages[1].role).toBe("user");

      expect(result.text).toBe("A powerful message");
      expect(result.platform).toBe(PLATFORM_STYLES.twitter.name);
      expect(result.timestamp).toBeGreaterThan(0);
    });

    it("strips trailing slashes from baseUrl", async () => {
      const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        jsonResponse({ choices: [{ message: { content: "hi" } }] }),
      );
      await generateAIMessage(
        { ...CONFIG, baseUrl: "https://api.example.com/v1///" },
        country,
        data,
        "whatsapp",
      );
      expect(String(fetchMock.mock.calls[0][0])).toBe(
        "https://api.example.com/v1/chat/completions",
      );
    });

    it("includes custom instructions in the user prompt when provided", async () => {
      const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        jsonResponse({ choices: [{ message: { content: "hi" } }] }),
      );
      await generateAIMessage(
        CONFIG,
        country,
        data,
        "telegram",
        "en",
        "Emphasize the children.",
      );
      const sent: RequestInit = fetchMock.mock.calls[0][1] as RequestInit;
      const userBody = JSON.parse(sent.body as string);
      expect(userBody.messages[1].content).toContain("Emphasize the children.");
    });

    it("uses the detected language when none provided", async () => {
      const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        jsonResponse({ choices: [{ message: { content: "hi" } }] }),
      );
      await generateAIMessage(CONFIG, country, data, "twitter");
      expect(fetchMock).toHaveBeenCalledOnce();
    });

    it("throws on non-OK response with status in the message", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        errorResponse(429, "rate limited"),
      );
      await expect(
        generateAIMessage(CONFIG, country, data, "twitter"),
      ).rejects.toThrow(/429/);
    });

    it("throws when the API returns empty content", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        jsonResponse({ choices: [{ message: { content: "" } }] }),
      );
      await expect(
        generateAIMessage(CONFIG, country, data, "twitter"),
      ).rejects.toThrow(/empty/i);
    });

    it("throws when choices are missing entirely", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({}));
      await expect(
        generateAIMessage(CONFIG, country, data, "twitter"),
      ).rejects.toThrow();
    });

    it("request body temperature is in [0.7, 1.0]", async () => {
      const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        jsonResponse({ choices: [{ message: { content: "hi" } }] }),
      );
      await generateAIMessage(CONFIG, country, data, "instagram");
      const sent = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
      expect(sent.temperature).toBeGreaterThanOrEqual(0.7);
      expect(sent.temperature).toBeLessThanOrEqual(1.0);
    });

    it("uses a higher max_tokens budget for instagram", async () => {
      const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        jsonResponse({ choices: [{ message: { content: "hi" } }] }),
      );
      await generateAIMessage(CONFIG, country, data, "instagram");
      const igBody = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
      await generateAIMessage(CONFIG, country, data, "twitter");
      const twBody = JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string);
      expect(igBody.max_tokens).toBeGreaterThan(twBody.max_tokens);
    });

    it("falls back to twitter style for an unknown platform", async () => {
      const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        jsonResponse({ choices: [{ message: { content: "hi" } }] }),
      );
      const result = await generateAIMessage(CONFIG, country, data, "myspace");
      expect(result.platform).toBe(PLATFORM_STYLES.twitter.name);
      expect(fetchMock).toHaveBeenCalledOnce();
    });
  });

  describe("generateAIBatch", () => {
    it("returns one result per requested count, cycling platforms", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        jsonResponse({ choices: [{ message: { content: "msg" } }] }),
      );
      const results = await generateAIBatch(CONFIG, country, data, undefined, 4);
      expect(results).toHaveLength(4);
      const platforms = new Set(results.map((r) => r.platform));
      expect(platforms.size).toBe(4);
    });

    it("records errors as result entries without aborting the batch", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        errorResponse(500, "server down"),
      );
      const results = await generateAIBatch(CONFIG, country, data, undefined, 3);
      expect(results).toHaveLength(3);
      expect(results.every((r) => r.tone === "error")).toBe(true);
      expect(results.every((r) => r.text.startsWith("[ERROR"))).toBe(true);
    });

    it("mixed success and failure yields a partial batch", async () => {
      let n = 0;
      vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
        n++;
        if (n % 2 === 0) return errorResponse(500, "x");
        return jsonResponse({ choices: [{ message: { content: "ok" } }] });
      });
      const results = await generateAIBatch(CONFIG, country, data, undefined, 4);
      expect(results).toHaveLength(4);
      const okCount = results.filter((r) => r.text === "ok").length;
      const errCount = results.filter((r) => r.tone === "error").length;
      expect(okCount + errCount).toBe(4);
      expect(okCount).toBeGreaterThan(0);
    });
  });
});
