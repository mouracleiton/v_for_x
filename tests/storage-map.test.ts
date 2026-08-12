/**
 * V FOR X — Storage Map Tests
 *
 * Tests for the storage registry, panic wipe audit, and backup/restore.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  LOCAL_STORAGE_KEYS,
  INDEXED_DB_STORES,
  loadAuditLog,
  recordWipeEvent,
  clearAuditLog,
  getKeysForWipe,
  getKeysForPreserve,
  getStoresForClear,
  scanActualKeys,
  findUnknownKeys,
  estimateStorageSize,
  createBackup,
  saveBackup,
  loadBackups,
  restoreBackup,
  deleteBackup,
  clearAllBackups,
  executePanicWipe,
  getStorageHealthReport,
} from "../lib/storage-map";

// Mock localStorage
const mockLocalStorage = new Map<string, string>();

const localStorageMock = {
  get length() {
    return mockLocalStorage.size;
  },
  key: (index: number): string | null => {
    const keys = Array.from(mockLocalStorage.keys());
    return keys[index] || null;
  },
  getItem: (key: string): string | null => {
    return mockLocalStorage.get(key) ?? null;
  },
  setItem: (key: string, value: string): void => {
    mockLocalStorage.set(key, value);
  },
  removeItem: (key: string): void => {
    mockLocalStorage.delete(key);
  },
  clear: (): void => {
    mockLocalStorage.clear();
  },
};

// Mock IndexedDB with proper promise handling
const mockIndexedDBStores = new Map<string, Map<string, any[]>>();

function resetIndexedDBMock(): void {
  mockIndexedDBStores.clear();
  // Initialize vfx-store with some test data
  const vfxStore = new Map<string, any[]>();
  vfxStore.set("ledger", [
    { id: 1, ts: 123456, source: "test", destination: "test2", amount: "100", purpose: "test", status: "VERIFIED" },
  ]);
  vfxStore.set("checklists", [{ id: 1, name: "Test Kit", scenarios: [], items: [], createdAt: Date.now(), updatedAt: Date.now() }]);
  mockIndexedDBStores.set("vfx-store", vfxStore);

  // Initialize vfx-vault
  const vaultStore = new Map<string, any[]>();
  vaultStore.set("items", [{ id: "test-item", encrypted: "data" }]);
  mockIndexedDBStores.set("vfx-vault", vaultStore);
}

// Mock indexedDB.open with synchronous callback execution
const indexedDBMock = {
  open: (dbName: string): IDBOpenDBRequest => {
    let onsuccessCallback: ((event: Event) => void) | null = null;
    let onerrorCallback: ((event: Event) => void) | null = null;

    const mockRequest = {
      result: {
        close: () => {},
        transaction: (_storeNames: string | string[], _mode: IDBTransactionMode) => {
          return {
            objectStore: (storeName: string) => {
              return {
                clear: (): IDBRequest => {
                  let clearOnSuccess: ((event: Event) => void) | null = null;
                  let clearOnError: ((event: Event) => void) | null = null;

                  // Execute the clear operation synchronously, then surface the
                  // result through the onsuccess/onerror setters (the caller
                  // assigns them after clear() returns).
                  try {
                    const db = mockIndexedDBStores.get(dbName);
                    if (db) {
                      db.set(storeName, []);
                    }
                  } catch {
                    // surfaced via onerror below
                  }

                  return {
                    get onsuccess() { return clearOnSuccess; },
                    set onsuccess(cb) { clearOnSuccess = cb; if (cb) setTimeout(() => cb({} as Event), 0); },
                    get onerror() { return clearOnError; },
                    set onerror(cb) { clearOnError = cb; },
                  } as IDBRequest;
                },
              };
            },
          };
        },
      },
      get onsuccess() { return onsuccessCallback; },
      set onsuccess(cb) {
        onsuccessCallback = cb;
        // Trigger success immediately after being set
        if (cb) setTimeout(() => cb({} as Event), 0);
      },
      get onerror() { return onerrorCallback; },
      set onerror(cb) { onerrorCallback = cb; },
    } as IDBOpenDBRequest;

    return mockRequest;
  },
};

describe("storage-map", () => {
  beforeEach(() => {
    // Clear all mocks
    mockLocalStorage.clear();
    resetIndexedDBMock();

    // Mock global localStorage and indexedDB using vitest
    vi.stubGlobal("localStorage", localStorageMock);
    vi.stubGlobal("indexedDB", indexedDBMock);
  });

  afterEach(() => {
    // Clean up
    mockLocalStorage.clear();
    resetIndexedDBMock();
    vi.unstubAllGlobals();
  });

  describe("Storage Key Registry", () => {
    it("should have a comprehensive registry of localStorage keys", () => {
      expect(LOCAL_STORAGE_KEYS.length).toBeGreaterThan(20);

      // Check for critical keys
      const keys = LOCAL_STORAGE_KEYS.map((k) => k.key);
      expect(keys).toContain("vfx_identity");
      expect(keys).toContain("vfx_duress_cfg");
      expect(keys).toContain("vfx-lang");
      expect(keys).toContain("vfx_persona");
      expect(keys).toContain("vfx-witness-ledger");
      expect(keys).toContain("vfx-mesh-presence");
    });

    it("should categorize keys correctly", () => {
      const identityKeys = LOCAL_STORAGE_KEYS.filter((k) => k.category === "identity");
      const duressKeys = LOCAL_STORAGE_KEYS.filter((k) => k.category === "duress");
      const userDataKeys = LOCAL_STORAGE_KEYS.filter((k) => k.category === "user-data");
      const cryptoKeys = LOCAL_STORAGE_KEYS.filter((k) => k.category === "crypto");

      expect(identityKeys.length).toBeGreaterThan(0);
      expect(duressKeys.length).toBeGreaterThan(0);
      expect(userDataKeys.length).toBeGreaterThan(0);
      expect(cryptoKeys.length).toBeGreaterThan(0);
    });

    it("should mark sensitive keys correctly", () => {
      const sensitiveKeys = LOCAL_STORAGE_KEYS.filter((k) => k.sensitive);

      expect(sensitiveKeys.length).toBeGreaterThan(0);

      // Identity keys should be sensitive
      const identityKey = LOCAL_STORAGE_KEYS.find((k) => k.key === "vfx_identity");
      expect(identityKey?.sensitive).toBe(true);

      // Language preference should not be sensitive
      const langKey = LOCAL_STORAGE_KEYS.find((k) => k.key === "vfx-lang");
      expect(langKey?.sensitive).toBe(false);
    });

    it("should configure wipe behavior correctly", () => {
      const identityKey = LOCAL_STORAGE_KEYS.find((k) => k.key === "vfx_identity");
      expect(identityKey?.wipeOnPanic).toBe(true);
      expect(identityKey?.preserveInDecoy).toBe(false);

      const duressConfigKey = LOCAL_STORAGE_KEYS.find((k) => k.key === "vfx_duress_cfg");
      expect(duressConfigKey?.wipeOnPanic).toBe(false); // Keep duress config
      expect(duressConfigKey?.preserveInDecoy).toBe(true);

      const langKey = LOCAL_STORAGE_KEYS.find((k) => k.key === "vfx-lang");
      expect(langKey?.wipeOnPanic).toBe(false); // Keep benign prefs
      expect(langKey?.preserveInDecoy).toBe(true);
    });
  });

  describe("IndexedDB Registry", () => {
    it("should have a comprehensive registry of stores", () => {
      expect(INDEXED_DB_STORES.length).toBeGreaterThan(15);

      const storeNames = INDEXED_DB_STORES.map((s) => `${s.dbName}.${s.storeName}`);
      expect(storeNames).toContain("vfx-store.ledger");
      expect(storeNames).toContain("vfx-store.checklists");
      expect(storeNames).toContain("vfx-vault.items");
      expect(storeNames).toContain("vfx-pulse.feeds");
    });

    it("should mark sensitive stores correctly", () => {
      const sensitiveStores = INDEXED_DB_STORES.filter((s) => s.sensitive);

      expect(sensitiveStores.length).toBeGreaterThan(0);

      // Vault should be sensitive
      const vaultStore = INDEXED_DB_STORES.find((s) => s.dbName === "vfx-vault");
      expect(vaultStore?.sensitive).toBe(true);

      // Semantic index should not be sensitive
      const semanticStore = INDEXED_DB_STORES.find((s) => s.storeName === "semantic_index");
      expect(semanticStore?.sensitive).toBe(false);
    });
  });

  describe("Audit Log", () => {
    it("should load empty audit log initially", () => {
      const log = loadAuditLog();
      expect(log).toEqual([]);
    });

    it("should record wipe events", () => {
      const event = {
        id: "wipe-test-1",
        timestamp: Date.now(),
        trigger: "manual" as const,
        wipedKeys: ["vfx_identity", "vfx_persona"],
        preservedKeys: ["vfx-lang", "vfx_duress_cfg"],
        clearedStores: [{ dbName: "vfx-store", storeName: "ledger" }],
        reason: "test wipe",
      };

      recordWipeEvent(event);

      const log = loadAuditLog();
      expect(log).toHaveLength(1);
      expect(log[0]).toEqual(event);
    });

    it("should keep audit log sorted by most recent first", () => {
      const event1 = {
        id: "wipe-1",
        timestamp: 1000,
        trigger: "panic" as const,
        wipedKeys: [],
        preservedKeys: [],
        clearedStores: [],
      };

      const event2 = {
        id: "wipe-2",
        timestamp: 2000,
        trigger: "manual" as const,
        wipedKeys: [],
        preservedKeys: [],
        clearedStores: [],
      };

      recordWipeEvent(event1);
      recordWipeEvent(event2);

      const log = loadAuditLog();
      expect(log[0].id).toBe("wipe-2"); // Most recent first
      expect(log[1].id).toBe("wipe-1");
    });

    it("should limit audit log size", () => {
      // Add more than MAX_AUDIT_EVENTS (100)
      for (let i = 0; i < 105; i++) {
        recordWipeEvent({
          id: `wipe-${i}`,
          timestamp: Date.now() + i,
          trigger: "manual",
          wipedKeys: [],
          preservedKeys: [],
          clearedStores: [],
        });
      }

      const log = loadAuditLog();
      expect(log.length).toBeLessThanOrEqual(100);
    });

    it("should clear audit log", () => {
      recordWipeEvent({
        id: "wipe-test",
        timestamp: Date.now(),
        trigger: "manual",
        wipedKeys: [],
        preservedKeys: [],
        clearedStores: [],
      });

      expect(loadAuditLog()).toHaveLength(1);

      clearAuditLog();

      expect(loadAuditLog()).toHaveLength(0);
    });
  });

  describe("Wipe Planning", () => {
    it("should get keys for panic wipe", () => {
      const keys = getKeysForWipe("panic");

      expect(keys.length).toBeGreaterThan(0);
      expect(keys).toContain("vfx_identity");
      expect(keys).toContain("vfx_persona");
      expect(keys).not.toContain("vfx-lang"); // Should not wipe benign prefs
      expect(keys).not.toContain("vfx_duress_cfg"); // Should not wipe duress config
    });

    it("should get keys for duress wipe", () => {
      const keys = getKeysForWipe("duress");

      expect(keys.length).toBeGreaterThan(0);
      expect(keys).toContain("vfx_identity");
      // Persona is preserved in duress mode (part of benign decoy data)
      expect(keys).not.toContain("vfx_persona");
      expect(keys).not.toContain("vfx_duress_cfg"); // Preserve duress config
      expect(keys).not.toContain("vfx-lang"); // Preserve benign prefs
    });

    it("should get keys for rotation wipe", () => {
      const keys = getKeysForWipe("rotation");

      // Rotation should only wipe identity keys
      expect(keys).toContain("vfx_identity");
      expect(keys).toContain("vfx_identity_history");
      expect(keys).not.toContain("vfx_persona");
      expect(keys).not.toContain("vfx-lang");
    });

    it("should get keys to preserve for panic", () => {
      const keys = getKeysForPreserve("panic");

      expect(keys).toContain("vfx_duress_cfg");
      expect(keys).toContain("vfx-lang");
      expect(keys).not.toContain("vfx_identity");
    });

    it("should get stores to clear for panic", () => {
      const stores = getStoresForClear("panic");

      expect(stores.length).toBeGreaterThan(0);

      const vaultStore = stores.find((s) => s.dbName === "vfx-vault");
      expect(vaultStore).toBeDefined();

      const semanticStore = stores.find((s) => s.storeName === "semantic_index");
      expect(semanticStore).toBeUndefined(); // Cache not cleared on panic
    });

    it("should not clear stores on rotation", () => {
      const stores = getStoresForClear("rotation");
      expect(stores).toEqual([]);
    });
  });

  describe("Storage Scanning", () => {
    it("should scan actual localStorage keys", () => {
      mockLocalStorage.set("vfx_identity", '{"test": "data"}');
      mockLocalStorage.set("vfx-lang", "en");
      mockLocalStorage.set("unknown-key", "some value");

      const keys = scanActualKeys();
      expect(keys).toContain("vfx_identity");
      expect(keys).toContain("vfx-lang");
      expect(keys).toContain("unknown-key");
    });

    it("should find unknown keys", () => {
      mockLocalStorage.set("vfx_identity", '{"test": "data"}');
      mockLocalStorage.set("unknown-key-1", "value1");
      mockLocalStorage.set("unknown-key-2", "value2");

      const unknown = findUnknownKeys();
      expect(unknown).toContain("unknown-key-1");
      expect(unknown).toContain("unknown-key-2");
      expect(unknown).not.toContain("vfx_identity");
    });

    it("should estimate storage size", () => {
      mockLocalStorage.set("key1", "x".repeat(100));
      mockLocalStorage.set("key2", "y".repeat(50));

      const size = estimateStorageSize();
      expect(size).toBeGreaterThan(0);

      // key1(4 chars) + 100 + key2(4 chars) + 50 ≈ 158
      expect(size).toBeGreaterThanOrEqual(150);
      expect(size).toBeLessThanOrEqual(200);
    });
  });

  describe("Backup & Restore", () => {
    it("should create backup of specified keys", () => {
      mockLocalStorage.set("vfx_identity", '{"privateKey": "..."}');
      mockLocalStorage.set("vfx-lang", "en");
      mockLocalStorage.set("vfx_persona", "journalist");

      const backup = createBackup(["vfx_identity", "vfx-lang"], "test-backup", "test reason");

      expect(backup.id).toMatch(/^backup-\d+-[a-z0-9]+$/);
      expect(backup.label).toBe("test-backup");
      expect(backup.localStorage).toHaveProperty("vfx_identity");
      expect(backup.localStorage).toHaveProperty("vfx-lang");
      expect(backup.localStorage).not.toHaveProperty("vfx_persona"); // Not backed up
      expect(backup.metadata.totalKeys).toBe(2);
    });

    it("should save and load backups", () => {
      const backup = createBackup(["vfx-lang"], "test", "test");
      saveBackup(backup);

      const backups = loadBackups();
      expect(backups).toHaveLength(1);
      expect(backups[0].id).toBe(backup.id);
      expect(backups[0].label).toBe("test");
    });

    it("should keep only limited number of backups", () => {
      // Create 10 backups
      for (let i = 0; i < 10; i++) {
        mockLocalStorage.set(`key${i}`, `value${i}`);
        const backup = createBackup([`key${i}`], `backup-${i}`, "test");
        saveBackup(backup);
      }

      const backups = loadBackups();
      // MAX_BACKUPS is 5
      expect(backups.length).toBeLessThanOrEqual(5);
    });

    it("should restore backup to localStorage", () => {
      const backup = createBackup(
        ["vfx-lang", "vfx_persona"],
        "test",
        "test"
      );
      backup.localStorage = {
        "vfx-lang": "es",
        "vfx_persona": "aid-worker",
      };

      restoreBackup(backup);

      expect(mockLocalStorage.get("vfx-lang")).toBe("es");
      expect(mockLocalStorage.get("vfx_persona")).toBe("aid-worker");
    });

    it("should delete specific backup", () => {
      const backup1 = createBackup(["key1"], "backup1", "test");
      const backup2 = createBackup(["key2"], "backup2", "test");

      saveBackup(backup1);
      saveBackup(backup2);

      expect(loadBackups()).toHaveLength(2);

      deleteBackup(backup1.id);

      const backups = loadBackups();
      expect(backups).toHaveLength(1);
      expect(backups[0].id).toBe(backup2.id);
    });

    it("should clear all backups", () => {
      const backup = createBackup(["key"], "test", "test");
      saveBackup(backup);

      expect(loadBackups()).toHaveLength(1);

      clearAllBackups();

      expect(loadBackups()).toHaveLength(0);
    });
  });

  describe("Panic Wipe Execution", () => {
    it("should execute panic wipe and record event", async () => {
      // Set up test data
      mockLocalStorage.set("vfx_identity", '{"privateKey": "..."}');
      mockLocalStorage.set("vfx_persona", "journalist");
      mockLocalStorage.set("vfx-lang", "en");
      mockLocalStorage.set("vfx_duress_cfg", '{"decoyCode": "1234"}');

      const event = await executePanicWipe("panic", {
        reason: "Test panic wipe",
      });

      expect(event.trigger).toBe("panic");
      expect(event.wipedKeys).toContain("vfx_identity");
      expect(event.wipedKeys).toContain("vfx_persona");
      expect(event.wipedKeys).not.toContain("vfx-lang");
      expect(event.wipedKeys).not.toContain("vfx_duress_cfg");

      // Verify keys were actually removed
      expect(mockLocalStorage.has("vfx_identity")).toBe(false);
      expect(mockLocalStorage.has("vfx_persona")).toBe(false);
      expect(mockLocalStorage.get("vfx-lang")).toBe("en"); // Preserved
      expect(mockLocalStorage.get("vfx_duress_cfg")).toBe('{"decoyCode": "1234"}'); // Preserved
    });

    it("should create backup before wiping when specified", async () => {
      mockLocalStorage.set("vfx_identity", '{"privateKey": "..."}');

      const event = await executePanicWipe("rotation", {
        backupKeys: ["vfx_identity"],
        backupLabel: "pre-rotation-backup",
        reason: "Key rotation",
      });

      expect(event.wipedKeys).toContain("vfx_identity");

      // Check backup was created
      const backups = loadBackups();
      expect(backups).toHaveLength(1);
      expect(backups[0].label).toBe("pre-rotation-backup");
      expect(backups[0].localStorage).toHaveProperty("vfx_identity");
    });

    it("should run in test mode without actually wiping", async () => {
      mockLocalStorage.set("vfx_identity", '{"privateKey": "..."}');

      const event = await executePanicWipe("panic", {
        testMode: true,
      });

      expect(event.wipedKeys.length).toBeGreaterThan(0);

      // In test mode, keys should NOT be removed
      expect(mockLocalStorage.get("vfx_identity")).toBe('{"privateKey": "..."}');
    });

    it("should record wipe event in audit log", async () => {
      await executePanicWipe("panic", { reason: "Test wipe" });

      const log = loadAuditLog();
      expect(log).toHaveLength(1);
      expect(log[0].trigger).toBe("panic");
      expect(log[0].reason).toBe("Test wipe");
    });

    it("should handle duress mode wipe correctly", async () => {
      mockLocalStorage.set("vfx_identity", '{"privateKey": "..."}');
      mockLocalStorage.set("vfx_persona", "journalist");
      mockLocalStorage.set("vfx_duress_cfg", '{"enabled": true}');
      mockLocalStorage.set("vfx-lang", "en");

      const event = await executePanicWipe("duress");

      // Duress wipes sensitive data except duress config
      expect(event.wipedKeys).toContain("vfx_identity");
      // Persona is preserved in duress mode (part of benign decoy data)
      expect(event.wipedKeys).not.toContain("vfx_persona");
      expect(event.wipedKeys).not.toContain("vfx_duress_cfg");
      expect(event.wipedKeys).not.toContain("vfx-lang");

      // Verify
      expect(mockLocalStorage.has("vfx_identity")).toBe(false);
      expect(mockLocalStorage.get("vfx_duress_cfg")).toBe('{"enabled": true}');
      expect(mockLocalStorage.get("vfx-lang")).toBe("en");
    });
  });

  describe("Storage Health Report", () => {
    it("should generate storage health report", () => {
      mockLocalStorage.set("vfx-lang", "en");
      mockLocalStorage.set("vfx_identity", '{"test": "data"}');

      const report = getStorageHealthReport();

      expect(report.totalKeys).toBe(2);
      expect(report.registeredKeys).toBeGreaterThan(0);
      expect(report.unknownKeys).toEqual([]);
      expect(report.estimatedSize).toBeGreaterThan(0);
      expect(report.auditEvents).toBe(0);
      expect(report.backups).toBe(0);
      expect(report.warnings).toEqual([]);
    });

    it("should detect unknown keys", () => {
      mockLocalStorage.set("vfx-lang", "en");
      mockLocalStorage.set("unknown-orphan-key", "some value");

      const report = getStorageHealthReport();

      expect(report.unknownKeys).toContain("unknown-orphan-key");
      expect(report.warnings.length).toBeGreaterThan(0);
    });

    it("should warn about large storage size", () => {
      // Simulate large storage
      for (let i = 0; i < 100; i++) {
        mockLocalStorage.set(`key${i}`, "x".repeat(50000));
      }

      const report = getStorageHealthReport();

      expect(report.estimatedSize).toBeGreaterThan(4_000_000);
      expect(report.warnings.some((w) => w.includes("approaching quota"))).toBe(true);
    });

    it("should report audit events and backups", () => {
      // Add audit event
      recordWipeEvent({
        id: "wipe-test",
        timestamp: Date.now(),
        trigger: "manual",
        wipedKeys: [],
        preservedKeys: [],
        clearedStores: [],
      });

      // Add backup
      const backup = createBackup(["key"], "test", "test");
      saveBackup(backup);

      const report = getStorageHealthReport();

      expect(report.auditEvents).toBe(1);
      expect(report.backups).toBe(1);
    });
  });

  describe("Integration: Full Panic Wipe Flow", () => {
    it("should handle full panic wipe with backup and verification", async () => {
      // Set up realistic state
      mockLocalStorage.set("vfx_identity", '{"privateKey": "sensitive"}');
      mockLocalStorage.set("vfx_identity_history", "[]");
      mockLocalStorage.set("vfx_persona", "journalist");
      mockLocalStorage.set("vfx_missions_progress", '{"step": 5}');
      mockLocalStorage.set("vfx-lang", "en");
      mockLocalStorage.set("vfx_duress_cfg", '{"enabled": true, "decoyCode": "1234"}');
      mockLocalStorage.set("vfx_duress_mode", "normal");
      mockLocalStorage.set("unknown-orphan", "should-be-preserved-or-warned");

      // Check initial health
      const healthBefore = getStorageHealthReport();
      expect(healthBefore.totalKeys).toBe(8);

      // Execute panic wipe with backup
      const event = await executePanicWipe("panic", {
        backupKeys: ["vfx_identity", "vfx_persona", "vfx_missions_progress"],
        backupLabel: "pre-panic-backup",
        reason: "User requested panic wipe",
      });

      // Verify wipe event
      expect(event.trigger).toBe("panic");
      expect(event.wipedKeys.length).toBeGreaterThan(0);
      expect(event.wipedKeys).toContain("vfx_identity");

      // Verify keys were wiped
      expect(mockLocalStorage.has("vfx_identity")).toBe(false);
      expect(mockLocalStorage.has("vfx_persona")).toBe(false);
      expect(mockLocalStorage.has("vfx_missions_progress")).toBe(false);

      // Verify preserved keys
      expect(mockLocalStorage.get("vfx-lang")).toBe("en");
      expect(mockLocalStorage.get("vfx_duress_cfg")).toBe('{"enabled": true, "decoyCode": "1234"}');

      // Verify backup was created
      const backups = loadBackups();
      expect(backups.length).toBeGreaterThan(0);
      const prePanicBackup = backups.find((b) => b.label === "pre-panic-backup");
      expect(prePanicBackup).toBeDefined();
      expect(prePanicBackup?.localStorage).toHaveProperty("vfx_identity");

      // Verify audit log
      const auditLog = loadAuditLog();
      expect(auditLog).toHaveLength(1);
      expect(auditLog[0].id).toBe(event.id);

      // Check health after
      const healthAfter = getStorageHealthReport();
      expect(healthAfter.totalKeys).toBeLessThan(healthBefore.totalKeys);
      expect(healthAfter.unknownKeys).toContain("unknown-orphan");
    });

    it("should handle duress mode with decoy backup", async () => {
      // Real identity
      mockLocalStorage.set("vfx_identity", '{"privateKey": "real-key", "handle": "V-REAL-1234"}');
      mockLocalStorage.set("vfx_persona", "journalist");
      mockLocalStorage.set("vfx_missions_progress", '{"completed": ["mission-1", "mission-2"]}');
      mockLocalStorage.set("vfx-lang", "en");
      mockLocalStorage.set("vfx_duress_cfg", '{"enabled": true, "decoyCode": "9999"}');

      // Backup real identity before entering decoy
      await executePanicWipe("duress", {
        backupKeys: ["vfx_identity", "vfx_persona", "vfx_missions_progress"],
        backupLabel: "real-identity-backup",
        reason: "Entering decoy mode",
      });

      // Verify sensitive data wiped
      expect(mockLocalStorage.has("vfx_identity")).toBe(false);
      // Persona is preserved in duress mode (part of benign decoy data)
      expect(mockLocalStorage.has("vfx_persona")).toBe(true);
      expect(mockLocalStorage.has("vfx_missions_progress")).toBe(false);

      // Verify duress config preserved
      expect(mockLocalStorage.get("vfx_duress_cfg")).toBe('{"enabled": true, "decoyCode": "9999"}');
      expect(mockLocalStorage.get("vfx-lang")).toBe("en");

      // Verify backup
      const backups = loadBackups();
      const realBackup = backups.find((b) => b.label === "real-identity-backup");
      expect(realBackup).toBeDefined();
      expect(realBackup?.localStorage["vfx_identity"]).toContain("real-key");

      // Can restore real identity later
      if (realBackup) {
        restoreBackup(realBackup);
        expect(mockLocalStorage.get("vfx_identity")).toContain("real-key");
      }
    });
  });
});
