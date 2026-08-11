import { describe, it, expect, beforeEach, vi } from "vitest";

const memoryStores: Record<string, Map<string, any>> = {};
let autoIncrement = 0;

// destroyVault() calls indexedDB.deleteDatabase — stub it to wipe the mock stores.
vi.stubGlobal("indexedDB", {
  deleteDatabase: () => {
    for (const key of Object.keys(memoryStores)) delete memoryStores[key];
  },
});

vi.mock("idb", () => ({
  openDB: vi.fn().mockResolvedValue({
    getAll: vi.fn(async (store: string) => {
      memoryStores[store] = memoryStores[store] || new Map();
      return Array.from(memoryStores[store].values());
    }),
    put: vi.fn(async (store: string, record: any) => {
      memoryStores[store] = memoryStores[store] || new Map();
      if (record.id === undefined) {
        record.id = ++autoIncrement;
      }
      memoryStores[store].set(String(record.id), record);
      return record.id;
    }),
    delete: vi.fn(async (store: string, id: string) => {
      memoryStores[store] = memoryStores[store] || new Map();
      memoryStores[store].delete(String(id));
    }),
    get: vi.fn(async (store: string, key: string) => {
      memoryStores[store] = memoryStores[store] || new Map();
      return memoryStores[store].get(String(key));
    }),
    count: vi.fn(async (store: string) => {
      memoryStores[store] = memoryStores[store] || new Map();
      return memoryStores[store].size;
    }),
  }),
}));

import {
  vaultExists,
  createVault,
  verifyPassphrase,
  unlockVault,
  lockVault,
  isVaultUnlocked,
  saveVaultEntry,
  getAllVaultEntries,
  deleteVaultEntry,
  getVaultEntryCount,
  exportVault,
  destroyVault,
} from "../lib/vault";

const PASSPHRASE = "correct horse battery staple";

beforeEach(async () => {
  for (const key of Object.keys(memoryStores)) delete memoryStores[key];
  autoIncrement = 0;
  lockVault();
  try {
    await destroyVault();
  } catch { /* noop */ }
});

describe("vault — lifecycle", () => {
  it("reports no vault before initialization", async () => {
    expect(await vaultExists()).toBe(false);
  });

  it("rejects passphrases shorter than 8 characters", async () => {
    await expect(createVault("short")).rejects.toThrow("at least 8");
  });

  it("creates a vault and refuses a second one", async () => {
    await createVault(PASSPHRASE);
    expect(await vaultExists()).toBe(true);
    await expect(createVault(PASSPHRASE)).rejects.toThrow("already exists");
  });

  it("verifies the passphrase and rejects wrong ones", async () => {
    await createVault(PASSPHRASE);
    expect(await verifyPassphrase(PASSPHRASE)).toBe(true);
    expect(await verifyPassphrase("wrong-passphrase")).toBe(false);
  });

  it("unlocks only with the correct passphrase", async () => {
    await createVault(PASSPHRASE);
    expect(await unlockVault("wrong-passphrase")).toBe(false);
    expect(isVaultUnlocked()).toBe(false);
    expect(await unlockVault(PASSPHRASE)).toBe(true);
    expect(isVaultUnlocked()).toBe(true);
  });

  it("locks and clears the session key", async () => {
    await createVault(PASSPHRASE);
    await unlockVault(PASSPHRASE);
    lockVault();
    expect(isVaultUnlocked()).toBe(false);
  });
});

describe("vault — entry CRUD", () => {
  it("refuses writes while locked", async () => {
    await createVault(PASSPHRASE);
    await expect(saveVaultEntry({ title: "x", body: "y", tags: [], severity: "info" })).rejects.toThrow("locked");
  });

  it("round-trips an entry encrypted with the session key", async () => {
    await createVault(PASSPHRASE);
    await unlockVault(PASSPHRASE);
    const id = await saveVaultEntry({
      title: "My Evidence",
      body: "Photographed the convoy at 14:03.",
      iso3: "SDN",
      tags: ["evidence", "war-crime"],
      severity: "critical",
    });
    expect(id).toMatch(/^vault-/);

    const entries = await getAllVaultEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].title).toBe("My Evidence");
    expect(entries[0].body).toBe("Photographed the convoy at 14:03.");
    expect(entries[0].iso3).toBe("SDN");
    expect(entries[0].severity).toBe("critical");
    expect(entries[0].createdAt).toBe(entries[0].updatedAt);
  });

  it("preserves createdAt on update", async () => {
    await createVault(PASSPHRASE);
    await unlockVault(PASSPHRASE);
    const id = await saveVaultEntry({ title: "A", body: "one", tags: [], severity: "info" });
    await saveVaultEntry({ id, title: "A2", body: "two", tags: ["x"], severity: "warning" });
    const entries = await getAllVaultEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].title).toBe("A2");
    expect(entries[0].body).toBe("two");
    expect(entries[0].createdAt).toBeLessThanOrEqual(entries[0].updatedAt);
  });

  it("stores ciphertext — plaintext never touches storage", async () => {
    await createVault(PASSPHRASE);
    await unlockVault(PASSPHRASE);
    const secret = "TOP-SECRET-OBSERVATION";
    await saveVaultEntry({ title: "sensitive", body: secret, tags: [], severity: "critical" });
    for (const records of Object.values(memoryStores)) {
      for (const record of records.values()) {
        if (record.ciphertext) {
          expect(record.ciphertext).not.toContain(secret);
          expect(record.ciphertext).not.toContain("sensitive");
        }
      }
    }
  });

  it("deletes entries and reports the count", async () => {
    await createVault(PASSPHRASE);
    await unlockVault(PASSPHRASE);
    const a = await saveVaultEntry({ title: "a", body: "1", tags: [], severity: "info" });
    await saveVaultEntry({ title: "b", body: "2", tags: [], severity: "info" });
    expect(await getVaultEntryCount()).toBe(2);
    await deleteVaultEntry(a);
    expect(await getVaultEntryCount()).toBe(1);
    expect((await getAllVaultEntries())[0].title).toBe("b");
  });

  it("returns an empty list when locked", async () => {
    await createVault(PASSPHRASE);
    await unlockVault(PASSPHRASE);
    await saveVaultEntry({ title: "a", body: "1", tags: [], severity: "info" });
    lockVault();
    expect(await getAllVaultEntries()).toEqual([]);
  });
});

describe("vault — export / destroy", () => {
  it("exports an encrypted, portable blob", async () => {
    await createVault(PASSPHRASE);
    await unlockVault(PASSPHRASE);
    await saveVaultEntry({ title: "note", body: "hello", tags: [], severity: "info" });
    const blob = await exportVault();
    const parsed = JSON.parse(blob);
    expect(parsed.version).toBe(1);
    expect(parsed.key.salt).toBeTruthy();
    expect(parsed.key.verifyHash).toBeTruthy();
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.entries[0].ciphertext).toBeTruthy();
  });

  it("destroys the vault and allows re-initialization", async () => {
    await createVault(PASSPHRASE);
    await unlockVault(PASSPHRASE);
    await saveVaultEntry({ title: "gone", body: "x", tags: [], severity: "info" });
    await destroyVault();
    expect(isVaultUnlocked()).toBe(false);
    expect(await vaultExists()).toBe(false);
    await createVault(PASSPHRASE);
    expect(await vaultExists()).toBe(true);
  });
});
