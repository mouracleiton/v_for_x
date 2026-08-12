# V FOR X — Contributor Ladder

How a volunteer moves from "first clone" to trusted maintainer. Every rung is
earned by doing the work, not by asking for a title.

## The ladder

### 1. First-time contributor (good-first-issue)

- **Do:** pick an issue tagged `good-first-issue` (persona-kit scoped, single
  file, static-export-safe).
- **Must:** read the [decision filter](#decision-filter) and the
  [static-export rule](#static-export-rule) below before opening a PR.
- **Earn:** one merged PR → "contributor".

### 2. Contributor

- **Do:** any open TODO item, prioritizing depth over new `/the-*` pages.
- **Must:** run `npm test` (expect 0 failures) and `npx tsc --noEmit` (no new
  errors in changed files) before requesting review.
- **Earn:** 3+ merged PRs across at least 2 phases → "trusted contributor".

### 3. Trusted contributor

- **Do:** review others' PRs; adopt a lib or route as a steward.
- **Must:** use the [Skeptic](../lib/skeptic.ts) on any dossier change; run the
  [token linter](../tests/token-linter.test.ts) and
  [storage-map completeness](../tests/storage-map-completeness.test.ts) checks.
- **Earn:** a documented threat-model or ADR contribution → "maintainer".

### 4. Maintainer

- **Do:** cut releases (see [RELEASE TRAIN](./RELEASE_TRAIN.md)); merge data
  refreshes; adjudicate errata/disputes.
- **Must:** never merge a PR that breaks the static-export / no-accounts /
  no-tracking contract (see [ADRs](./adr/)).
- **Owe:** a quarterly threat-model re-read (ADR-0003).

## Decision filter (before opening any route)

A new `/the-*` page or feature must answer **yes** to all five:

1. Completes See → Understand → Act → Hold → Coordinate → Protect?
2. Works fully static, offline, no phone-home?
3. Increases trust (sign/verify) or reach (mirror/mesh/share)?
4. A non-technical person can finish it in <10 minutes under stress?
5. If new `/the-*`: which existing IDB/localStorage object or data file does it
   read/write? (Orphan pages with no backing object are rejected.)

If it fails the filter, park it in `TODO.md` rather than merging.

## Static-export rule (non-negotiable)

- No runtime network calls from the client (gate: `lib/quiet-hours.ts`).
- No accounts, no hosted identity (gate: ADR-0002).
- No tracking/analytics that leave the device.
- New `localStorage`/IDB keys MUST be registered in `lib/storage-map.ts`
  (the `tests/storage-map-completeness.test.ts` CI check fails otherwise).
- New `VFX*:` token prefixes MUST be in `lib/tokens.ts` `TOKEN_SPECS`
  (`tests/token-linter.test.ts` fails otherwise).

## Review expectations

- PRs under ~400 lines: one maintainer review.
- PRs over 400 lines or touching identity/crypto/mesh: two reviews + the
  [Skeptic](../lib/skeptic.ts) run on any dossier change.
- Data PRs: the [manifest drift](../scripts/manifest_drift.py) report must be
  documented (VFXERR1 correction if a figure moved).

## Communication

Be direct and technical; assume good faith. Disagreements about threat model go
to an ADR, not a comment thread.
