/**
 * Quiet Hours — software kill-switch for all network APIs
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  enable,
  disable,
  toggle,
  setSchedule,
  clearSchedule,
  isNetworkAllowed,
  assertNetworkAllowed,
  withNetwork,
  createQuietFetch,
  install,
  uninstall,
  isInstalled,
  statusLabel,
  isQuietActive,
  NetworkBlockError,
  getConfig,
  loadConfig,
  QUIET_HOURS_KEY,
} from "@/lib/quiet-hours";

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
};
vi.stubGlobal("localStorage", localStorageMock);

beforeEach(() => {
  localStorage.clear();
  disable();
  uninstall();
});

afterEach(() => {
  disable();
  uninstall();
});

describe("quiet hours config", () => {
  it("is off by default", () => {
    expect(getConfig().enabled).toBe(false);
    expect(isNetworkAllowed()).toBe(true);
  });

  it("enable/disable toggle the switch", () => {
    enable();
    expect(getConfig().enabled).toBe(true);
    expect(isNetworkAllowed()).toBe(false);
    disable();
    expect(getConfig().enabled).toBe(false);
    expect(isNetworkAllowed()).toBe(true);
  });

  it("toggle flips state", () => {
    expect(toggle().enabled).toBe(true);
    expect(toggle().enabled).toBe(false);
  });

  it("persists to localStorage", () => {
    enable();
    const raw = store[QUIET_HOURS_KEY];
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!).enabled).toBe(true);
    // reload config from storage
    const reloaded = loadConfig();
    expect(reloaded.enabled).toBe(true);
  });
});

describe("quiet hours gating", () => {
  it("assertNetworkAllowed throws when enabled", () => {
    enable();
    expect(() => assertNetworkAllowed()).toThrow(NetworkBlockError);
  });

  it("assertNetworkAllowed passes when disabled", () => {
    disable();
    expect(() => assertNetworkAllowed()).not.toThrow();
  });

  it("withNetwork temporarily lifts the switch", async () => {
    enable();
    expect(isNetworkAllowed()).toBe(false);
    let calledInside = false;
    const result = await withNetwork(async () => {
      expect(isNetworkAllowed()).toBe(true);
      calledInside = true;
      return 42;
    });
    expect(result).toBe(42);
    expect(calledInside).toBe(true);
    // restored after
    expect(isNetworkAllowed()).toBe(false);
  });

  it("withNetwork restores even on exception", async () => {
    enable();
    await expect(withNetwork(async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    expect(isNetworkAllowed()).toBe(false);
  });

  it("withNetwork is a no-op when already allowed", async () => {
    disable();
    const r = await withNetwork(() => "ok");
    expect(r).toBe("ok");
    expect(isNetworkAllowed()).toBe(true);
  });
});

describe("quiet hours scheduling", () => {
  it("blocks during a scheduled window", () => {
    clearSchedule();
    setSchedule(22, 7); // quiet 22:00–07:00
    const inWindow = new Date(2024, 0, 1, 23, 0); // 23:00
    expect(isNetworkAllowed(inWindow)).toBe(false);
    const beforeWindow = new Date(2024, 0, 1, 12, 0); // noon
    expect(isNetworkAllowed(beforeWindow)).toBe(true);
    const justAfter = new Date(2024, 0, 1, 8, 0); // 08:00
    expect(isNetworkAllowed(justAfter)).toBe(true);
  });

  it("handles same-day window", () => {
    setSchedule(9, 17); // quiet during work hours
    const inside = new Date(2024, 0, 1, 12, 0);
    expect(isNetworkAllowed(inside)).toBe(false);
    const outside = new Date(2024, 0, 1, 8, 0);
    expect(isNetworkAllowed(outside)).toBe(true);
  });

  it("empty window (start==end) never blocks", () => {
    setSchedule(12, 12);
    const any = new Date(2024, 0, 1, 12, 0);
    expect(isNetworkAllowed(any)).toBe(true);
    clearSchedule();
  });
});

describe("quiet fetch + install", () => {
  it("createQuietFetch throws when blocked", async () => {
    enable();
    const fakeFetch = vi.fn();
    const quiet = createQuietFetch(fakeFetch as never);
    await expect(quiet("https://x.example")).rejects.toThrow(NetworkBlockError);
    expect(fakeFetch).not.toHaveBeenCalled();
  });

  it("createQuietFetch delegates when allowed", async () => {
    disable();
    const fakeFetch = vi.fn().mockResolvedValue(new Response("ok"));
    const quiet = createQuietFetch(fakeFetch as never);
    await quiet("https://x.example");
    expect(fakeFetch).toHaveBeenCalledTimes(1);
  });

  it("install wraps global fetch and blocks when enabled", async () => {
    const realFetch = vi.fn().mockResolvedValue(new Response("ok"));
    (globalThis as any).fetch = realFetch;
    install();
    expect(isInstalled()).toBe(true);
    disable();
    await fetch("https://allowed.example");
    expect(realFetch).toHaveBeenCalledTimes(1);
    enable();
    await expect(fetch("https://blocked.example")).rejects.toThrow(NetworkBlockError);
    expect(realFetch).toHaveBeenCalledTimes(1); // not called again
    uninstall();
    expect(isInstalled()).toBe(false);
  });

  it("install is idempotent", () => {
    (globalThis as any).fetch = vi.fn();
    install();
    install();
    expect(isInstalled()).toBe(true);
    uninstall();
  });
});

describe("quiet hours display", () => {
  it("statusLabel reflects state", () => {
    disable();
    expect(statusLabel()).toBe("Network allowed");
    enable();
    expect(statusLabel()).toContain("blocked");
  });

  it("isQuietActive tracks active state", () => {
    enable();
    expect(isQuietActive()).toBe(true);
    disable();
    expect(isQuietActive()).toBe(false);
  });
});
