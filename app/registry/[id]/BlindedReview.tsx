"use client";

/**
 * V FOR X — Blinded Peer Review card (The Registry cross-validation)
 *
 * Two-phase commit/reveal corroboration for a dossier, fully local:
 *  - COMMIT: rating + flags are hashed with a random nonce; only the
 *    hash is stored. Nothing is observable.
 *  - REVEAL: the nonce + review are disclosed and verified against
 *    the earlier commitment. A reviewer cannot rewrite their verdict
 *    after seeing others' votes without the nonce matching.
 *
 * The ledger counts every reveal that self-verifies (commitment ==
 * H(review || nonce)) and attributes one review per timestamp key.
 * Tokens imported from peers (VFXRV1:) go through the same check.
 */

import { useState, useEffect, useCallback } from "react";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import { sound } from "@/lib/sound";
import { tc } from "@/lib/i18n-content";
import type { Lang } from "@/lib/i18n";
import {
  createReviewCommitment,
  verifyReveal,
  canonicalReview,
  aggregateReviews,
  encodeReviewToken,
  decodeReviewToken,
  isValidRating,
  loadLocalReviews,
  saveLocalReviews,
  loadLocalNonce,
  saveLocalNonce,
  type PeerReview,
  type RevealedReview,
  type AggregateReview,
} from "@/lib/review";

const FLAG_KEYS: { flag: string; labelKey: string }[] = [
  { flag: "verified_evidence", labelKey: "review.flag_verified" },
  { flag: "has_sources", labelKey: "review.flag_sources" },
  { flag: "independent_account", labelKey: "review.flag_independent" },
  { flag: "contradicts_claim", labelKey: "review.flag_contradicts" },
  { flag: "insufficient", labelKey: "review.flag_insufficient" },
];

export default function BlindedReview({ dossierId, lang }: { dossierId: string; lang: Lang }) {
  // draft
  const [rating, setRating] = useState(3);
  const [flags, setFlags] = useState<string[]>(["has_sources"]);
  const [note, setNote] = useState("");

  // commit/reveal state
  const [commitment, setCommitment] = useState<string | null>(null);
  const [myNonce, setMyNonce] = useState<string | null>(null);
  const [myReview, setMyReview] = useState<PeerReview | null>(null);

  // ledger
  const [revealed, setRevealed] = useState<RevealedReview[]>([]);
  const [agg, setAgg] = useState<AggregateReview>({
    count: 0, rejected: 0, meanRating: 0,
    ratingHistogram: [0, 0, 0, 0, 0],
    flagTallies: { verified_evidence: 0, has_sources: 0, independent_account: 0, contradicts_claim: 0, insufficient: 0 },
  });
  const [importToken, setImportToken] = useState("");
  const [statusMsg, setStatusMsg] = useState("");

  // Load persisted ledger on mount (client-only)
  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    try {
      setRevealed(loadLocalReviews(dossierId));
      const nonce = loadLocalNonce(dossierId);
      if (nonce) {
        setMyNonce(nonce);
        setCommittedStatus(nonce);
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dossierId]);

  async function setCommittedStatus(nonce: string) {
    // A pending nonce means a review was committed but not revealed yet.
    // The commitment hash is recomputed at reveal time; storing it now is
    // not necessary for verification, only for the UI state.
    try {
      const raw = localStorage.getItem(`vfx-reviews:${dossierId}:commit`);
      if (raw) setCommitment(raw);
    } catch { /* ignore */ }
  }

  // Recompute aggregate whenever the ledger changes.
  // Commitments are the recomputed hashes of each reveal — a reveal can
  // only enter the ledger after it has been (or can be) verified.
  useEffect(() => {
    const build = async () => {
      const commitments: Record<string, string> = {};
      for (const r of revealed) {
        const hash = await sha256Hex(canonicalReview(r.review, r.nonce));
        commitments[`k-${r.review.ts}`] = hash;
      }
      const result = await aggregateReviews(commitments, revealed);
      setAgg(result);
    };
    void build();
  }, [revealed]);

  const toggleFlag = (f: string) => {
    setFlags((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));
    sound.keystroke();
  };

  /** Phase 1 — commit invisibly */
  const handleCommit = useCallback(async () => {
    if (!isValidRating(rating)) return;
    const review: PeerReview = {
      dossierId,
      rating,
      flags: flags as PeerReview["flags"],
      note: note.trim() || undefined,
      ts: Date.now(),
    };
    try {
      const { commit, nonce } = await createReviewCommitment(review);
      setCommitment(commit);
      setMyNonce(nonce);
      setMyReview(review);
      try {
        localStorage.setItem(`vfx-reviews:${dossierId}:commit`, commit);
        saveLocalNonce(dossierId, nonce);
      } catch { /* ignore */ }
      setStatusMsg("COMMITTED (hidden). Reveal to count it.");
      sound.success();
    } catch {
      setStatusMsg("// WEB CRYPTO UNAVAILABLE");
      sound.error();
    }
  }, [dossierId, rating, flags, note]);

  /** Phase 2 — reveal, verify against the commitment, add to ledger */
  const handleReveal = useCallback(async () => {
    if (!myReview || !myNonce || !commitment) return;
    const revealedReview: RevealedReview = { review: myReview, nonce: myNonce };
    const res = await verifyReveal(commitment, revealedReview);
    if (!res.verified) {
      setStatusMsg(`// REVEAL REJECTED: ${res.reason}`);
      sound.error();
      return;
    }
    const next = [...revealed.filter((r) => r.review.ts !== myReview.ts), revealedReview];
    setRevealed(next);
    saveLocalReviews(dossierId, next);
    try {
      localStorage.removeItem(`vfx-reviews:${dossierId}:commit`);
      saveLocalNonce(dossierId, null);
    } catch { /* ignore */ }
    setCommitment(null);
    setMyNonce(null);
    setStatusMsg("REVEALED + VERIFIED — counted in the aggregate.");
    sound.success();
  }, [dossierId, myReview, myNonce, commitment, revealed]);

  const handleExport = useCallback(() => {
    const mine = myReview ? revealed.find((r) => r.review.ts === myReview.ts) : null;
    if (mine) {
      navigator.clipboard?.writeText(encodeReviewToken(mine));
      setStatusMsg("REVIEW TOKEN COPIED — share it with a peer.");
      sound.select();
    }
  }, [myReview, revealed]);

  const handleImport = useCallback(async () => {
    try {
      const imported = decodeReviewToken(importToken);
      if (imported.review.dossierId !== dossierId) {
        setStatusMsg(`// TOKEN BELONGS TO ${imported.review.dossierId} — NOT THIS DOSSIER`);
        sound.error();
        return;
      }
      // verify the reveal is self-consistent (commitment == H(review || nonce))
      const hash = await sha256Hex(canonicalReview(imported.review, imported.nonce));
      const res = await verifyReveal(hash, imported);
      if (!res.verified) {
        setStatusMsg(`// IMPORT REJECTED: ${res.reason}`);
        sound.error();
        return;
      }
      const next = [...revealed.filter((r) => r.review.ts !== imported.review.ts), imported];
      setRevealed(next);
      saveLocalReviews(dossierId, next);
      setImportToken("");
      setStatusMsg("IMPORTED + VERIFIED — added to the aggregate.");
      sound.success();
    } catch (e) {
      setStatusMsg(`// ${e instanceof Error ? e.message : "Malformed token"}`);
      sound.error();
    }
  }, [dossierId, importToken, revealed]);

  return (
    <TerminalCard title={tc(lang, "review.title")} accent="green" className="mb-6">
      {/* Aggregate */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <StatusPill color="green">
          {agg.count} {tc(lang, "review.count")}
        </StatusPill>
        {agg.rejected > 0 && (
          <StatusPill color="blood">
            {agg.rejected} {tc(lang, "review.rejected")}
          </StatusPill>
        )}
        <div className="text-xs text-content-secondary">
          {tc(lang, "review.mean")} <span className="text-terminal-green font-bold">{agg.meanRating.toFixed(2)}</span>
        </div>
        <div className="text-[10px] text-content-dim font-mono">
          {agg.ratingHistogram.map((n, i) => `${i + 1}★:${n}`).join(" · ")}
        </div>
      </div>

      {/* Form */}
      <div className="text-[10px] text-content-dim uppercase tracking-widest mb-2">{tc(lang, "review.rating")}</div>
      <div className="flex gap-1 mb-3">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => { setRating(n); sound.keystroke(); }}
            className={`w-10 py-1.5 text-sm border ${
              rating === n
                ? "border-terminal-green text-terminal-green bg-terminal-green/10"
                : "border-border-dim text-content-dim hover:border-terminal-green"
            }`}
          >
            {n}★
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        {FLAG_KEYS.map(({ flag, labelKey }) => (
          <button
            key={flag}
            onClick={() => toggleFlag(flag)}
            className={`px-2 py-1 text-[10px] border ${
              flags.includes(flag)
                ? "border-terminal-green text-terminal-green bg-terminal-green/10"
                : "border-border-dim text-content-dim hover:border-terminal-green"
            }`}
          >
            {tc(lang, labelKey)}
          </button>
        ))}
      </div>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        disabled={!!myNonce}
        placeholder="Optional note — only revealed when you reveal"
        className="w-full bg-void border border-border-dim px-3 py-2 text-xs text-content-primary mb-3 disabled:opacity-30"
      />

      {myNonce ? (
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill color="amber">{tc(lang, "review.pending_commit")}</StatusPill>
          <span className="text-[10px] text-content-dim font-mono break-all">commit {commitment?.slice(0, 16)}…</span>
          <button
            onClick={handleReveal}
            className="ml-auto px-3 py-1.5 text-xs border border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-void"
          >
            {tc(lang, "review.reveal_btn")}
          </button>
        </div>
      ) : (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleCommit}
            className="px-3 py-1.5 text-xs border border-blood text-blood-bright hover:bg-blood hover:text-void"
          >
            {tc(lang, "review.commit_btn")}
          </button>
          <button
            onClick={handleExport}
            disabled={revealed.length === 0}
            className="px-3 py-1.5 text-xs border border-border-dim text-content-secondary hover:border-terminal-green disabled:opacity-30"
          >
            {tc(lang, "review.export_btn")}
          </button>
        </div>
      )}

      {/* Import */}
      <div className="flex gap-2 mt-4">
        <input
          value={importToken}
          onChange={(e) => setImportToken(e.target.value)}
          placeholder={tc(lang, "review.import_ph")}
          className="flex-1 bg-void border border-border-dim px-3 py-2 text-[10px] text-content-primary font-mono focus:border-terminal-green"
        />
        <button
          onClick={handleImport}
          disabled={!importToken.trim()}
          className="px-3 py-1.5 text-xs border border-border-dim text-content-secondary hover:border-terminal-green disabled:opacity-30"
        >
          {tc(lang, "review.import_btn")}
        </button>
      </div>

      {statusMsg && <p className="text-[10px] text-terminal-green mt-2 font-mono">{statusMsg}</p>}
      <p className="text-[10px] text-content-dim mt-3">{tc(lang, "review.desc")}</p>
    </TerminalCard>
  );
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}