import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  enableDecoyMode,
  disableDecoyMode,
  loadDuressConfig,
  checkDuressCode,
  generateDecoyState,
  enterDecoyMode,
  exitDecoyMode,
  isInDecoyMode,
  getActiveMode,
  setActiveMode,
} from "../lib/duress-decoy";
import { generateIdentity, saveIdentity } from "../lib/identity";
import { clearAllBackups } from "../lib/storage-map";

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
};
vi.stubGlobal("localStorage", localStorageMock);

beforeEach(() => {
  localStorageMock.clear();
  clearAllBackups();
});

describe("enableDecoyMode", () => {
  it("stores the decoy code", () => {
    enableDecoyMode("my-decoy-123");
    const config = loadDuressConfig();
    expect(config.enabled).toBe(true);
    expect(config.decoyCode).toBe("my-decoy-123");
  });
});

describe("disableDecoyMode", () => {
  it("clears the config", () => {
    enableDecoyMode("test");
    disableDecoyMode();
    const config = loadDuressConfig();
    expect(config.enabled).toBe(false);
    expect(config.decoyCode).toBe("");
  });
});

describe("checkDuressCode", () => {
  it("returns 'decoy' for the correct code", () => {
    enableDecoyMode("decoy-pass");
    expect(checkDuressCode("decoy-pass")).toBe("decoy");
  });

  it("returns 'normal' for the wrong code", () => {
    enableDecoyMode("decoy-pass");
    expect(checkDuressCode("wrong-code")).toBe("normal");
  });

  it("returns 'normal' when decoy mode is disabled", () => {
    disableDecoyMode();
    expect(checkDuressCode("anything")).toBe("normal");
  });
});

describe("generateDecoyState", () => {
  it("produces plausible-looking gamification data", () => {
    const state = generateDecoyState();
    expect(state.countriesVisited.length).toBeGreaterThanOrEqual(5);
    expect(state.countriesVisited.length).toBeLessThanOrEqual(10);
    expect(state.badges.length).toBeGreaterThan(0);
    expect(state.xp).toBeGreaterThan(0);
    expect(state.level).toBe(1);
    expect(state.dossiersRead).toEqual([]);
    expect(state.campaignsGenerated).toBe(0);
  });

  it("uses only safe countries", () => {
    const state = generateDecoyState();
    const safe = ["FRA", "DEU", "JPN", "BRA", "AUS", "CAN", "GBR", "ITA", "ESP", "PRT"];
    for (const iso of state.countriesVisited) {
      expect(safe).toContain(iso);
    }
  });
});

describe("decoy mode activation", () => {
  it("sets active mode when entering decoy mode", async () => {
    // Create and save a real identity first (required for new async interface)
    const realIdentity = await generateIdentity();
    await saveIdentity(realIdentity);

    expect(isInDecoyMode()).toBe(false);
    await enterDecoyMode();
    expect(isInDecoyMode()).toBe(true);
    expect(getActiveMode()).toBe("decoy");

    // Clean up - exit decoy mode
    await exitDecoyMode();
  });

  it("writes decoy data to gamification store on activation", async () => {
    // Create and save a real identity first
    const realIdentity = await generateIdentity();
    await saveIdentity(realIdentity);

    await enterDecoyMode();
    const raw = localStorageMock.getItem("vfx-gamification");
    expect(raw).toBeTruthy();
    const data = JSON.parse(raw!);
    expect(data.countriesVisited.length).toBeGreaterThan(0);

    // Clean up
    await exitDecoyMode();
  });

  it("clears watchlist on activation", async () => {
    // Create and save a real identity first
    const realIdentity = await generateIdentity();
    await saveIdentity(realIdentity);

    localStorageMock.setItem("vfx-watch", JSON.stringify([{ id: "sensitive-rule" }]));
    await enterDecoyMode();
    expect(localStorageMock.getItem("vfx-watch")).toBeNull();

    // Clean up
    await exitDecoyMode();
  });

  it("exits decoy mode and returns to normal", async () => {
    // Create and save a real identity
    const realIdentity = await generateIdentity();
    await saveIdentity(realIdentity);

    await enterDecoyMode();
    expect(isInDecoyMode()).toBe(true);

    await exitDecoyMode();
    expect(isInDecoyMode()).toBe(false);
    expect(getActiveMode()).toBe("normal");
  });
});
