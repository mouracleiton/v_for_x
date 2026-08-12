# ADR 0001 — Static export, no server runtime

- **Status:** Accepted
- **Date:** 2026-08-12
- **Supersedes:** —

## Context

V FOR X must be deployable by anyone, anywhere, including behind a censor's
firewall or in a jurisdiction that blocks the origin. Any dependency on a
running server (an API, a database, an auth service) is a single point of
failure an adversary can cut.

## Decision

The production artifact is a **fully static export** (`next build` → `out/`).
There is no Node runtime, no database, no server-side request handler in the
deployed site. All interactivity is client-side; all "data" is either baked
into the static bundle at build time or produced and stored on the visitor's
device (IndexedDB / localStorage).

Public, read-only data is emitted as static JSON under `out/api/v1/` by
`scripts/generate_api.py` from `data/world_backbone.json`. A deterministic
SHA-256 manifest (`scripts/generate_data_manifest.py`) lets any mirror prove
its copy matches the canonical build.

## Consequences

**Positive**

- A mirror is just a directory of files behind any static host (GitHub Pages,
  S3, a USB stick, a phone hotspot). No process to keep alive, no logs to seize.
- Forks can re-host by copying files (see `docs/FORK_COORDINATION.md`).
- No tracking surface: there is no backend to receive telemetry.

**Negative**

- No per-user server state → identity, witness ledgers, and annotations live
  client-side and must be exportable/shareable as tokens (VFX*).
- Data freshness depends on a build/CI pipeline, not live fetches; staleness
  is surfaced via `lib/data-freshness.ts`, not hidden.
- Some dynamic features (TURN, WebRTC SFU) are explicitly **not** platform
  dependencies — they are user-supplied only (see ADR-0003).

## Enforcement

- `npm run build` produces only static output; a runtime phone-home in client
  code is blocked by `lib/quiet-hours.ts` (`assertNetworkAllowed`) and the PR
  template's static-export checklist.
- `tests/contract.test.ts` asserts the backbone shape
  `scripts/generate_api.py` consumes, so a build-time schema drift fails CI.
