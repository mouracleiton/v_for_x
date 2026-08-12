# V FOR X — Incident Response Playbook

How to respond when a malicious dossier PR, a poisoned mirror claim, or a
corrupted data source reaches the network. V FOR X is static, account-free,
and trust-by-signature — there is no central kill-switch, so containment is
*detect → refute locally → publish signed correction*. Every operator runs
this playbook independently; consensus emerges from signed errata.

## Principles

1. **No central delete.** We cannot retract a file from every mirror. We
   *can* publish a signed refutation every honest mirror will surface.
2. **Local-first.** Detection and refusal happen on each device using the
   on-chain signatures, hashes, and errata already shipped.
3. **Proof over assertion.** A correction is a `VFXERR1` token with evidence,
   not a statement. Refutations without evidence are themselves noise.
4. **Minimize harm during response.** If the incident names real people,
   contain *before* you publish — do not amplify the harm while refuting it.

## Triage: what kind of incident?

| Kind | Signal | First response |
| ------ | -------- | ---------------- |
| Poisoned dossier PR | PR adds/edits a dossier with unsourced figures, fabricated sources, or PII | Do not merge. Request sources; run `lib/source-conflict.ts` against existing figures |
| Forged signature | A `VFXWIT1` / `VFXID1` / `VFXEV1` token fails `verify*` or uses an impostor handle | Refuse locally; flag handle on impostor watchlist; publish signed `VFXERR1` retraction |
| Corrupted data source | A backbone upstream (`data/world_backbone.json` producer) ships a regression / wrong units | Revert via `npm run snapshot` baseline; publish `VFXERR1` clarification |
| Malicious mirror claim | A `VFXM1` attestation is signed but the mirror serves tampered content | Drop mirror from `lib/mirror-ring.ts` seed; publish signed advisory |

## Response procedure

### 1. Contain locally (immediate)

- On the reviewing device: do **not** import the suspect token into a pack.
- If already imported: run panic wipe (`lib/storage-map.ts` `panicWipe`), then
  restore from the last known-good `VFXPACK1` backup.
- Log the incident to the local ops journal with type `incident`.

### 2. Verify the harm with evidence

- Run `lib/source-conflict.ts` over the contested metric + its existing
  sourced figures. A disagreement ≥ the `disagreement` threshold is evidence.
- For signature incidents, run `verifyWitness` / `verifyDagEntrySignature` /
  `decodeAndValidatePack` and capture the exact failure reason.
- Record: token, publisher, timestamp, the specific field in error, and the
  contradicting source(s).

### 3. Publish a signed erratum

- Use the registry `ErrataChainCard` (or `lib/registry-safety.ts` directly)
  to emit a `VFXERR1` token of the appropriate type:
  - `correction` — figure was wrong, here is the right one + source
  - `clarification` — figure was right but easily misread
  - `retraction` — figure should not have been published at all (PII / unsafe)
  - `dispute` — publisher disagrees; link the counter-dossier (`VFXDSP1`)
- The erratum is signed with your `VFXID1` identity. Honest mirrors surface
  signed errata automatically next to the contested dossier.

### 4. Notify honest mirrors

- Post the `VFXERR1` token to the usual out-of-band channel (Relay / docs
  room). Do **not** publish the harmful content itself in the notice —
  reference it by hash only.
- Mirror operators who have your identity in their ring will merge the
  erratum; consensus (`lib/mirror-consensus.ts`) propagates the corrected
  root.

### 5. Post-mortem

- Add a one-paragraph note to this file under "History" with: date, kind,
  root cause, what contained it, what would have caught it sooner.
- If a new detection rule would have caught it, add it as a test in
  `tests/` (the fuzz and contract suites exist for exactly this).

## Impostor handles

A handle collision (two different public keys claiming the same handle) is
detected via the local key-transparency log (append-only list of public keys
seen per handle). On detection:

1. Refuse the newer signature locally.
2. Publish a signed `VFXERR1` `dispute` referencing both public-key
   fingerprints.
3. Do **not** attempt to revoke a key you do not control — surface the
   conflict and let each reader's safety-number gate (`SafetyNumberGate`)
   do its job.

## History

<!-- Append one-line entries: YYYY-MM-DD — kind — one-line root cause -->
- *(none yet)*

## Related modules

- `lib/registry-safety.ts` — `VFXERR1` errata encode/decode/chain
- `lib/dispute.ts` — `VFXDSP1` threshold unpublish
- `lib/witness.ts` / `lib/evidence-room.ts` — signature verification
- `lib/source-conflict.ts` — publisher-disagreement detection
- `lib/storage-map.ts` — panic wipe + backup/restore
- `lib/mirror-ring.ts` / `lib/mirror-consensus.ts` — mirror trust + fork detection
