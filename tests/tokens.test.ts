import { describe, it, expect } from "vitest";
import {
  TOKEN_SPECS,
  detectToken,
  getAllTokenIds,
  getAllPrefixes,
  isVFXToken,
  validateTokenFormat,
  extractTokenData,
  getTokenSpec,
  getTokenSpecForToken,
  groupTokensByType,
  countTokensByType,
  filterTokensByType,
  sortTokensByType,
  type DetectedToken,
} from "../lib/tokens";

describe("TOKEN_SPECS", () => {
  it("contains all expected token types", () => {
    const ids = TOKEN_SPECS.map((s) => s.id);
    expect(ids).toContain("VFXID1");
    expect(ids).toContain("VFXSIG1");
    expect(ids).toContain("VFXGP1");
    expect(ids).toContain("VFXRV1");
    expect(ids).toContain("VFXWIT1");
    expect(ids).toContain("VFXEV1");
    expect(ids).toContain("VFXFILE1");
    expect(ids).toContain("VFXCRDT1");
    expect(ids).toContain("VFXDM1");
    expect(ids).toContain("VFXM1");
    expect(ids).toContain("VFXPACK1");
  });

  it("each spec has required fields", () => {
    TOKEN_SPECS.forEach((spec) => {
      expect(spec).toHaveProperty("prefix");
      expect(spec).toHaveProperty("id");
      expect(spec).toHaveProperty("name");
      expect(spec).toHaveProperty("description");
      expect(spec).toHaveProperty("module");
      expect(spec).toHaveProperty("signed");
      expect(spec).toHaveProperty("encrypted");
      expect(typeof spec.prefix).toBe("string");
      expect(typeof spec.signed).toBe("boolean");
      expect(typeof spec.encrypted).toBe("boolean");
    });
  });

  it("all prefixes end with colon", () => {
    TOKEN_SPECS.forEach((spec) => {
      expect(spec.prefix).toMatch(/:$/);
    });
  });
});

describe("detectToken", () => {
  it("detects VFXID1 tokens", () => {
    const token = "VFXID1:eyJhIjogInkIn0=";
    const result = detectToken(token);
    expect(result).not.toBeNull();
    expect(result?.spec.id).toBe("VFXID1");
    expect(result?.payload).toBe("eyJhIjogInkIn0=");
  });

  it("detects VFXSIG1 tokens", () => {
    const token = "VFXSIG1:eyJraW5kIjogIm9mZmVyIn0=";
    const result = detectToken(token);
    expect(result?.spec.id).toBe("VFXSIG1");
  });

  it("detects VGP1 tokens", () => {
    const token = "VFXGP1:ZW5jcnlwdGVkX2RhdGE=";
    const result = detectToken(token);
    expect(result?.spec.id).toBe("VFXGP1");
  });

  it("returns null for unknown prefixes", () => {
    const result = detectToken("UNKNOWN:test");
    expect(result).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(detectToken("")).toBeNull();
  });

  it("returns null for non-string input", () => {
    expect(detectToken(null as any)).toBeNull();
    expect(detectToken(undefined as any)).toBeNull();
    expect(detectToken(123 as any)).toBeNull();
  });

  it("handles whitespace", () => {
    const token = "  VFXID1:test  ";
    const result = detectToken(token);
    expect(result).not.toBeNull();
    expect(result?.token).toBe("VFXID1:test");
  });

  it("validFormat is false for empty payload", () => {
    const result = detectToken("VFXID1:");
    expect(result?.validFormat).toBe(false);
  });

  it("validFormat is true for non-empty payload", () => {
    const result = detectToken("VFXID1:data");
    expect(result?.validFormat).toBe(true);
  });
});

describe("getAllTokenIds", () => {
  it("returns all token IDs", () => {
    const ids = getAllTokenIds();
    expect(ids).toHaveLength(TOKEN_SPECS.length);
    expect(ids).toContain("VFXID1");
    expect(ids).toContain("VFXWIT1");
  });

  it("returns a new array each time", () => {
    const ids1 = getAllTokenIds();
    const ids2 = getAllTokenIds();
    expect(ids1).not.toBe(ids2);
  });
});

describe("getAllPrefixes", () => {
  it("returns all prefixes", () => {
    const prefixes = getAllPrefixes();
    expect(prefixes).toHaveLength(TOKEN_SPECS.length);
    expect(prefixes).toContain("VFXID1:");
    expect(prefixes).toContain("VFXWIT1:");
  });
});

describe("isVFXToken", () => {
  it("returns true for valid VFX tokens", () => {
    expect(isVFXToken("VFXID1:test")).toBe(true);
    expect(isVFXToken("VFXWIT1:data")).toBe(true);
  });

  it("returns false for unknown tokens", () => {
    expect(isVFXToken("UNKNOWN:test")).toBe(false);
    expect(isVFXToken("PREFIX:test")).toBe(false);
  });

  it("returns false for non-strings", () => {
    expect(isVFXToken("" as any)).toBe(false);
    expect(isVFXToken(null as any)).toBe(false);
  });
});

describe("validateTokenFormat", () => {
  it("returns true for valid tokens", () => {
    expect(validateTokenFormat("VFXID1:test")).toBe(true);
    expect(validateTokenFormat("VFXWIT1:data")).toBe(true);
  });

  it("returns false for tokens with empty payload", () => {
    expect(validateTokenFormat("VFXID1:")).toBe(false);
  });

  it("returns false for unknown tokens", () => {
    expect(validateTokenFormat("UNKNOWN:test")).toBe(false);
  });
});

describe("extractTokenData", () => {
  it("extracts payload from valid token", () => {
    expect(extractTokenData("VFXID1:my-payload")).toBe("my-payload");
  });

  it("returns null for unknown token", () => {
    expect(extractTokenData("UNKNOWN:test")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractTokenData("")).toBeNull();
  });
});

describe("getTokenSpec", () => {
  it("returns spec for valid ID", () => {
    const spec = getTokenSpec("VFXID1");
    expect(spec).not.toBeNull();
    expect(spec?.id).toBe("VFXID1");
  });

  it("returns null for unknown ID", () => {
    expect(getTokenSpec("UNKNOWN")).toBeNull();
  });
});

describe("getTokenSpecForToken", () => {
  it("returns spec for valid token", () => {
    const spec = getTokenSpecForToken("VFXID1:test");
    expect(spec?.id).toBe("VFXID1");
  });

  it("returns null for invalid token", () => {
    expect(getTokenSpecForToken("UNKNOWN:test")).toBeNull();
  });
});

describe("groupTokensByType", () => {
  it("groups mixed tokens by type", () => {
    const tokens = [
      "VFXID1:id1",
      "VFXWIT1:wit1",
      "VFXID1:id2",
      "VFXWIT1:wit2",
      "INVALID:test",
    ];
    const grouped = groupTokensByType(tokens);
    expect(grouped["VFXID1"]).toEqual(["VFXID1:id1", "VFXID1:id2"]);
    expect(grouped["VFXWIT1"]).toEqual(["VFXWIT1:wit1", "VFXWIT1:wit2"]);
    expect(grouped["INVALID"]).toBeUndefined();
  });

  it("returns empty object for empty input", () => {
    expect(groupTokensByType([])).toEqual({});
  });

  it("handles non-VFX tokens gracefully", () => {
    const tokens = ["INVALID1", "INVALID2"];
    const grouped = groupTokensByType(tokens);
    expect(Object.keys(grouped)).toHaveLength(0);
  });
});

describe("countTokensByType", () => {
  it("counts tokens by type", () => {
    const tokens = [
      "VFXID1:id1",
      "VFXWIT1:wit1",
      "VFXID1:id2",
      "VFXWIT1:wit2",
      "VFXWIT1:wit3",
    ];
    const counts = countTokensByType(tokens);
    expect(counts["VFXID1"]).toBe(2);
    expect(counts["VFXWIT1"]).toBe(3);
  });

  it("returns empty object for empty input", () => {
    expect(countTokensByType([])).toEqual({});
  });
});

describe("filterTokensByType", () => {
  it("filters tokens by specified types", () => {
    const tokens = [
      "VFXID1:id1",
      "VFXWIT1:wit1",
      "VFXID1:id2",
      "VFXSIG1:sig1",
    ];
    const filtered = filterTokensByType(tokens, ["VFXID1", "VFXWIT1"]);
    expect(filtered).toHaveLength(3);
    expect(filtered).toContain("VFXID1:id1");
    expect(filtered).toContain("VFXWIT1:wit1");
    expect(filtered).toContain("VFXID1:id2");
    expect(filtered).not.toContain("VFXSIG1:sig1");
  });

  it("returns empty array when no tokens match", () => {
    const tokens = ["VFXID1:id1", "VFXWIT1:wit1"];
    const filtered = filterTokensByType(tokens, ["VFXSIG1"]);
    expect(filtered).toHaveLength(0);
  });
});

describe("sortTokensByType", () => {
  it("sorts tokens grouping by type", () => {
    const tokens = [
      "VFXWIT1:wit1",
      "VFXID1:id1",
      "VFXSIG1:sig1",
      "VFXID1:id2",
      "NOT-VFX:test",
    ];
    const sorted = sortTokensByType(tokens);
    // VFXID1 tokens should be grouped together
    const id1Index = sorted.indexOf("VFXID1:id1");
    const id2Index = sorted.indexOf("VFXID1:id2");
    expect(Math.abs(id1Index - id2Index)).toBe(1);
  });

  it("puts non-VFX tokens at the end", () => {
    const tokens = ["NOT-VFX:test", "VFXID1:id1"];
    const sorted = sortTokensByType(tokens);
    expect(sorted[0]).toBe("VFXID1:id1");
    expect(sorted[1]).toBe("NOT-VFX:test");
  });

  it("returns empty array for empty input", () => {
    expect(sortTokensByType([])).toEqual([]);
  });
});

describe("edge cases", () => {
  it("handles tokens with colons in payload", () => {
    const token = "VFXID1:data:with:colons";
    const result = detectToken(token);
    expect(result?.payload).toBe("data:with:colons");
  });

  it("handles very long payloads", () => {
    const longPayload = "a".repeat(10000);
    const token = `VFXID1:${longPayload}`;
    const result = detectToken(token);
    expect(result?.payload).toBe(longPayload);
  });

  it("handles tokens with special characters", () => {
    const token = "VFXID1:dXNlci9wd2Q=@#$%";
    const result = detectToken(token);
    expect(result?.payload).toBe("dXNlci9wd2Q=@#$%");
  });
});
