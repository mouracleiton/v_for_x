"use client";

/**
 * V FOR X — The Safehouse
 *
 * Encrypted client-side evidence & notes store for citizen journalists.
 * AES-GCM via Web Crypto API. Zero data leaves the device.
 * Integrates with the duress/panic wipe system.
 *
 * [42] THE SAFEHOUSE — Code: 42
 */

import { useState, useEffect, useCallback } from "react";
import TerminalCard from "@/components/ui/TerminalCard";
import { sound } from "@/lib/sound";
import {
  vaultExists,
  createVault,
  unlockVault,
  lockVault,
  isVaultUnlocked,
  saveVaultEntry,
  getAllVaultEntries,
  deleteVaultEntry,
  destroyVault,
  exportVault,
  type VaultEntry,
} from "@/lib/vault";

type Phase = "checking" | "setup" | "locked" | "unlocked";

export default function TheVaultPage() {
  const [phase, setPhase] = useState<Phase>("checking");
  const [passphrase, setPassphrase] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [error, setError] = useState("");
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [fTitle, setFTitle] = useState("");
  const [fBody, setFBody] = useState("");
  const [fIso3, setFIso3] = useState("");
  const [fTags, setFTags] = useState("");
  const [fSeverity, setFSeverity] =
    useState<VaultEntry["severity"]>("warning");
  const [editId, setEditId] = useState<string | null>(null);

  const refreshEntries = useCallback(async () => {
    const all = await getAllVaultEntries();
    setEntries(all);
  }, []);

  useEffect(() => {
    (async () => {
      const exists = await vaultExists();
      setPhase(exists ? "locked" : "setup");
      if (exists && isVaultUnlocked()) {
        setPhase("unlocked");
        await refreshEntries();
      }
    })();
  }, [refreshEntries]);

  const handleCreate = async () => {
    setError("");
    if (passphrase.length < 8) {
      setError("// PASSPHRASE MUST BE AT LEAST 8 CHARACTERS");
      sound.error();
      return;
    }
    if (passphrase !== confirmPass) {
      setError("// PASSPHRASES DO NOT MATCH");
      sound.error();
      return;
    }
    try {
      await createVault(passphrase);
      await unlockVault(passphrase);
      setPhase("unlocked");
      setPassphrase("");
      setConfirmPass("");
      sound.success();
      await refreshEntries();
    } catch (e) {
      setError(`// ${(e as Error).message}`);
      sound.error();
    }
  };

  const handleUnlock = async () => {
    setError("");
    const ok = await unlockVault(passphrase);
    if (!ok) {
      setError("// INCORRECT PASSPHRASE");
      sound.error();
      return;
    }
    setPhase("unlocked");
    setPassphrase("");
    sound.success();
    await refreshEntries();
  };

  const handleLock = () => {
    lockVault();
    setPhase("locked");
    setShowForm(false);
    sound.nav();
  };

  const handleSave = async () => {
    setError("");
    if (!fTitle.trim() || !fBody.trim()) {
      setError("// TITLE AND BODY ARE REQUIRED");
      sound.error();
      return;
    }
    try {
      await saveVaultEntry({
        id: editId || undefined,
        title: fTitle.trim(),
        body: fBody.trim(),
        iso3: fIso3.trim().toUpperCase() || undefined,
        tags: fTags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        severity: fSeverity,
      });
      setFTitle("");
      setFBody("");
      setFIso3("");
      setFTags("");
      setFSeverity("warning");
      setEditId(null);
      setShowForm(false);
      sound.success();
      await refreshEntries();
    } catch (e) {
      setError(`// ${(e as Error).message}`);
      sound.error();
    }
  };

  const handleEdit = (entry: VaultEntry) => {
    setEditId(entry.id);
    setFTitle(entry.title);
    setFBody(entry.body);
    setFIso3(entry.iso3 || "");
    setFTags(entry.tags.join(", "));
    setFSeverity(entry.severity);
    setShowForm(true);
    sound.select();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("// PERMANENTLY DELETE THIS ENTRY?")) return;
    await deleteVaultEntry(id);
    sound.error();
    await refreshEntries();
  };

  const handleExport = async () => {
    const blob = await exportVault();
    const url = URL.createObjectURL(
      new Blob([blob], { type: "application/json" })
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `vfx-vault-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    sound.success();
  };

  const handleDestroy = async () => {
    if (
      !confirm(
        "// DESTROY THE ENTIRE SAFEHOUSE?\n// ALL ENCRYPTED EVIDENCE WILL BE PERMANENTLY LOST.\n// THIS CANNOT BE UNDONE."
      )
    )
      return;
    if (!confirm("// ARE YOU ABSOLUTELY CERTAIN? LAST CHANCE.")) return;
    await destroyVault();
    setPhase("setup");
    setEntries([]);
    sound.error();
  };

  /* ═════ RENDER ═══ */

  if (phase === "checking") {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="text-blood-bright text-xs animate-pulse">
          {"// INITIALIZING SAFEHOUSE..."}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="text-content-dim text-xs">
          [41] ENCRYPTED EVIDENCE STORE
        </div>
        <h1 className="text-blood-bright text-2xl font-bold tracking-widest mt-1">
          <span className="glitch" data-text="THE SAFEHOUSE">
            THE SAFEHOUSE
          </span>
        </h1>
        <p className="text-content-secondary text-sm mt-2 max-w-2xl">
          {
            "// AES-GCM encrypted evidence and notes. Zero data leaves your device. Every entry is encrypted with a passphrase-derived key (PBKDF2, 150K iterations). Integrates with the duress/panic wipe."
          }
        </p>
      </div>

      {error && (
        <div className="border border-blood bg-blood/10 p-3 text-blood-bright text-xs">
          {error}
        </div>
      )}

      {/* SETUP PHASE */}
      {phase === "setup" && (
        <TerminalCard title="CREATE SAFEHOUSE" glow>
          <div className="space-y-4">
            <p className="text-content-secondary text-xs">
              {
                "// No vault detected. Create one with a strong passphrase. There is NO recovery — if you forget it, the data is gone forever."
              }
            </p>
            <input
              type="password"
              placeholder="// PASSPHRASE (min 8 chars)"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              className="w-full bg-abyss border border-border-dim px-3 py-2 text-content-primary text-sm focus:border-blood outline-none"
            />
            <input
              type="password"
              placeholder="// CONFIRM PASSPHRASE"
              value={confirmPass}
              onChange={(e) => setConfirmPass(e.target.value)}
              className="w-full bg-abyss border border-border-dim px-3 py-2 text-content-primary text-sm focus:border-blood outline-none"
            />
            <button
              onClick={handleCreate}
              className="px-6 py-2 border border-blood text-blood-bright hover:bg-blood hover:text-abyss transition-colors text-xs font-bold tracking-widest"
            >
              [ CREATE ENCRYPTED SAFEHOUSE ]
            </button>
            <div className="text-content-dim text-[10px] border border-border-dim p-2 mt-3">
              <div className="text-amber mb-1">// SECURITY NOTICE</div>
              <div>
                • Your passphrase derives an AES-256 key via PBKDF2 (SHA-256,
                150K iterations)
              </div>
              <div>• Only a verification hash is stored — never the key</div>
              <div>
                • The duress code in The Mask will destroy this vault
                permanently
              </div>
              <div>
                • Export creates an encrypted backup — still needs your
                passphrase to read
              </div>
            </div>
          </div>
        </TerminalCard>
      )}

      {/* LOCKED PHASE */}
      {phase === "locked" && (
        <TerminalCard title="UNLOCK SAFEHOUSE" glow>
          <div className="space-y-4">
            <p className="text-content-secondary text-xs">
              {
                "// Enter your passphrase to decrypt the vault. Failed attempts are not rate-limited locally."
              }
            </p>
            <input
              type="password"
              placeholder="// PASSPHRASE"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
              className="w-full bg-abyss border border-border-dim px-3 py-2 text-content-primary text-sm focus:border-blood outline-none"
              autoFocus
            />
            <button
              onClick={handleUnlock}
              className="px-6 py-2 border border-blood text-blood-bright hover:bg-blood hover:text-abyss transition-colors text-xs font-bold tracking-widest"
            >
              [ UNLOCK ]
            </button>
          </div>
        </TerminalCard>
      )}

      {/* UNLOCKED PHASE */}
      {phase === "unlocked" && (
        <>
          {/* Vault status bar */}
          <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-3">
              <span className="text-terminal-green">
                ● SAFEHOUSE UNLOCKED
              </span>
              <span className="text-content-dim">
                {entries.length} ENTR{entries.length === 1 ? "Y" : "IES"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowForm(!showForm)}
                className="px-3 py-1 border border-blood text-blood-bright hover:bg-blood hover:text-abyss transition-colors text-[10px]"
              >
                {showForm ? "[ CANCEL ]" : "[ + NEW ENTRY ]"}
              </button>
              <button
                onClick={handleExport}
                className="px-3 py-1 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright transition-colors text-[10px]"
              >
                [ EXPORT ]
              </button>
              <button
                onClick={handleLock}
                className="px-3 py-1 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright transition-colors text-[10px]"
              >
                [ LOCK ]
              </button>
              <button
                onClick={handleDestroy}
                className="px-3 py-1 border border-blood/50 text-blood/70 hover:bg-blood hover:text-abyss transition-colors text-[10px]"
              >
                [ ⚠ DESTROY ]
              </button>
            </div>
          </div>

          {/* Entry form */}
          {showForm && (
            <TerminalCard
              title={editId ? "// EDIT ENTRY" : "// NEW ENTRY"}
              accent="amber"
            >
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="// TITLE"
                  value={fTitle}
                  onChange={(e) => setFTitle(e.target.value)}
                  className="w-full bg-abyss border border-border-dim px-3 py-2 text-content-primary text-sm focus:border-blood outline-none"
                />
                <textarea
                  placeholder="// EVIDENCE BODY — facts, observations, source notes, witness accounts..."
                  value={fBody}
                  onChange={(e) => setFBody(e.target.value)}
                  rows={6}
                  className="w-full bg-abyss border border-border-dim px-3 py-2 text-content-primary text-sm focus:border-blood outline-none resize-y"
                />
                <div className="flex gap-3 flex-wrap">
                  <input
                    type="text"
                    placeholder="// ISO3 (e.g. BRA)"
                    value={fIso3}
                    onChange={(e) => setFIso3(e.target.value)}
                    maxLength={3}
                    className="w-32 bg-abyss border border-border-dim px-3 py-2 text-content-primary text-sm focus:border-blood outline-none uppercase"
                  />
                  <input
                    type="text"
                    placeholder="// TAGS (comma-separated)"
                    value={fTags}
                    onChange={(e) => setFTags(e.target.value)}
                    className="flex-1 min-w-[200px] bg-abyss border border-border-dim px-3 py-2 text-content-primary text-sm focus:border-blood outline-none"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-content-dim text-[10px]">
                    SEVERITY:
                  </span>
                  {(["info", "warning", "critical"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setFSeverity(s);
                        sound.select();
                      }}
                      className={`px-3 py-1 text-[10px] border transition-colors ${
                        fSeverity === s
                          ? s === "critical"
                            ? "border-blood text-blood-bright bg-blood/10"
                            : s === "warning"
                              ? "border-amber text-amber bg-amber/10"
                              : "border-terminal-green text-terminal-green bg-terminal-green/10"
                          : "border-border-dim text-content-dim hover:border-blood"
                      }`}
                    >
                      {s.toUpperCase()}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleSave}
                  className="px-6 py-2 border border-blood text-blood-bright hover:bg-blood hover:text-abyss transition-colors text-xs font-bold tracking-widest"
                >
                  [ {editId ? "UPDATE" : "ENCRYPT & SAVE"} ]
                </button>
              </div>
            </TerminalCard>
          )}

          {/* Entry list */}
          {entries.length === 0 ? (
            <TerminalCard title="// NO ENTRIES">
              <p className="text-content-dim text-xs">
                {
                  "// The vault is empty. Create your first encrypted evidence entry."
                }
              </p>
            </TerminalCard>
          ) : (
            <div className="space-y-3">
              {entries.map((entry) => (
                <TerminalCard key={entry.id}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[9px] px-1.5 py-0.5 border ${
                            entry.severity === "critical"
                              ? "border-blood text-blood-bright"
                              : entry.severity === "warning"
                                ? "border-amber text-amber"
                                : "border-terminal-green text-terminal-green"
                          }`}
                        >
                          {entry.severity.toUpperCase()}
                        </span>
                        {entry.iso3 && (
                          <span className="text-[9px] text-content-dim border border-border-dim px-1.5 py-0.5">
                            {entry.iso3}
                          </span>
                        )}
                        {entry.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-[9px] text-content-dim"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                      <h3 className="text-content-primary text-sm font-bold mt-1">
                        {entry.title}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleEdit(entry)}
                        className="text-[10px] px-2 py-1 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright transition-colors"
                      >
                        EDIT
                      </button>
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="text-[10px] px-2 py-1 border border-blood/50 text-blood/70 hover:bg-blood hover:text-abyss transition-colors"
                      >
                        DEL
                      </button>
                    </div>
                  </div>
                  <p className="text-content-secondary text-xs whitespace-pre-wrap">
                    {entry.body}
                  </p>
                  <div className="text-content-dim text-[9px] mt-2">
                    {new Date(entry.updatedAt).toISOString()}
                  </div>
                </TerminalCard>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
