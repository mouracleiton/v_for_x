/**
 * V FOR X — Docs ⇄ Web room binding tests (Phase 12)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { getDocsRoom, setDocsRoom, clearDocsRoom, subscribeDocsRoom } from "../lib/docs-room";

describe("docs-room", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when unset", () => {
    expect(getDocsRoom()).toBeNull();
  });

  it("round-trips a room id", () => {
    setDocsRoom("alpha-42");
    expect(getDocsRoom()).toBe("ALPHA-42");
  });

  it("normalizes to uppercase", () => {
    setDocsRoom("beta-99");
    expect(getDocsRoom()).toBe("BETA-99");
  });

  it("trims surrounding whitespace", () => {
    setDocsRoom("  gamma-7  ");
    expect(getDocsRoom()).toBe("GAMMA-7");
  });

  it("clears on empty / whitespace-only room", () => {
    setDocsRoom("delta-1");
    setDocsRoom("   ");
    expect(getDocsRoom()).toBeNull();
  });

  it("clears on explicit reset", () => {
    setDocsRoom("epsilon-3");
    clearDocsRoom();
    expect(getDocsRoom()).toBeNull();
  });

  it("survives malformed JSON in storage", () => {
    localStorage.setItem("vfx-docs-room", "{not json");
    expect(getDocsRoom()).toBeNull();
  });

  it("rejects empty room field in storage", () => {
    localStorage.setItem("vfx-docs-room", JSON.stringify({ room: "", ts: 1 }));
    expect(getDocsRoom()).toBeNull();
  });

  it("subscribeDocsRoom fires on cross-tab storage events for vfx-docs-room (localStorage already updated, as in real browser ordering)", () => {
    const cb = vi.fn();
    const unsub = subscribeDocsRoom(cb);

    localStorage.setItem("vfx-docs-room", JSON.stringify({ room: "ZETA-2", ts: 1 }));
    const event = new StorageEvent("storage", {
      key: "vfx-docs-room",
      newValue: JSON.stringify({ room: "ZETA-2", ts: 1 }),
    });
    window.dispatchEvent(event);

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith("ZETA-2");
    unsub();
  });

  it("subscribeDocsRoom ignores other storage keys", () => {
    const cb = vi.fn();
    const unsub = subscribeDocsRoom(cb);

    const event = new StorageEvent("storage", {
      key: "vfx-something-else",
      newValue: "x",
    });
    window.dispatchEvent(event);

    expect(cb).not.toHaveBeenCalled();
    unsub();
  });

  it("subscribeDocsRoom returns a working unsubscribe", () => {
    const cb = vi.fn();
    const unsub = subscribeDocsRoom(cb);
    unsub();

    const event = new StorageEvent("storage", {
      key: "vfx-docs-room",
      newValue: JSON.stringify({ room: "eta-9", ts: 1 }),
    });
    window.dispatchEvent(event);

    expect(cb).not.toHaveBeenCalled();
  });
});
