# V FOR X — Fork Coordination Guide

V FOR X is static-export, account-free, and mirror-first. Forks are not bugs —
they are the distribution model. This guide describes how divergent forks
**re-merge manifests and packs** so the network of mirrors stays coherent
without a central authority.

## Why forks diverge

- A mirror operator adds a local data source (regional NGO, a court filing).
- A translator finishes a language pack and ships before upstream.
- A censored jurisdiction hosts a subset under a different domain.
- A researcher freezes a snapshot for a paper and continues locally.

Each is legitimate. The problem is not divergence — it is *silent* divergence,
where two honest mirrors disagree on the same number and neither knows why.

## The two reconciliation primitives

### 1. Content-addressed data manifest

`scripts/generate_data_manifest.py` produces a deterministic SHA-256 manifest
over `api/v1/`. Two builds from the same inputs produce byte-identical
manifests. When two forks meet (cross-mirror consensus, `lib/mirror-feed.ts`),
they exchange manifest roots:

- **Roots match** → the forks are data-identical. Nothing to merge.
- **Roots differ** → run `lib/mirror-consensus.ts` to find which per-file
  hashes differ, then reconcile file-by-file (below).

### 2. Signed, content-addressed packs (VFXPACK1)

Every portable artifact — a dossier errata chain, a witness ledger, a crisis
manifest, an evidence bundle, annotations — is a `VFXPACK1` token whose
integrity is self-verifying (`decodeAndValidatePack`). A fork can accept a
pack from any source without trusting the transport: verify the signature,
then merge by content hash.

## Re-merge procedure

When two forks want to reconcile (e.g., before a release, or when a mirror
operator discovers a sibling):

1. **Exchange manifest roots.** Each side runs
   `python3 scripts/generate_data_manifest.py` and shares the root hash.
   This is the cheapest diff — if roots match, stop.

2. **Diff per-file hashes.** Run `lib/mirror-consensus.ts` against the two
   manifests. Output is the set of files that changed. For each:
   - If only one side changed it → accept that side's version.
   - If both changed it → it is a true conflict; resolve by the rule below.

3. **Merge packs by content hash.** For each VFXPACK1 on either side:
   - Verify the signature (`decodeAndValidatePack`).
   - Merge into the local store by content hash (`mergePacks` /
     `mergePackTokens` in `lib/vfxpack.ts`). Duplicates dedupe automatically;
     divergent signed updates chain via the errata/dispute tokens
     (`VFXERR1` / `VFXDSP1`).

4. **Resolve data conflicts via the corrections ledger.** When both forks
   changed the same backbone field, do **not** pick a winner silently.
   Publish a `VFXERR1` `correction` documenting the disagreement and the
   chosen value + source (see `docs/INCIDENT_RESPONSE.md`). The loser fork's
   next consensus round will adopt the correction.

5. **Re-emit the manifest.** After merge, both sides regenerate the manifest
   and confirm roots match. That is the merge commit.

## Conflict resolution rule (default)

> Prefer the figure with the more recent, more-cited, signed source. Tie-break
> by publisher seniority (UN agency > INGO > national government > local
> report). Document the choice in the corrections ledger. Never average.

Averaging two disagreeing figures destroys both and invents a third. The
network's trust comes from preserving the disagreement, not hiding it.

## What NOT to merge

- **Private keys / identities.** Never. A fork's `VFXID1` is its own.
- **User annotations** (`vfx-annotations`). Local-only; export/share is the
  user's explicit choice.
- **Ops journals.** Per-device logs; no value in merging.

## Tooling cross-reference

| Concern | Module |
| --- | --- |
| Data manifest | `scripts/generate_data_manifest.py`, `lib/data-verifier.ts` |
| Cross-mirror root feed | `lib/mirror-feed.ts`, `lib/mirror-consensus.ts` |
| Pack merge by hash | `lib/vfxpack.ts` (`mergePacks`, `mergePackTokens`) |
| Corrections ledger | `lib/registry-safety.ts` (`VFXERR1`), `lib/corrections.ts` |
| Source disagreement view | `lib/source-conflict.ts` |
| Incident handling | `docs/INCIDENT_RESPONSE.md` |

## Reproducibility contract

A volunteer who clones the repo, runs the data scripts, and builds the static
export must get a manifest root within the documented tolerance of the
canonical build. See the **Reproducibility Challenge** doc for the target
(`<1h`, deterministic root) and the current tolerance.
