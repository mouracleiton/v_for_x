# ADR 0003 — Threat model & its revision cadence

- **Status:** Accepted
- **Date:** 2026-08-12
- **Supersedes:** —

## Context

V FOR X is used by journalists, protesters, aid operators, and observers in
hostile environments. A single, frozen threat model cannot cover all of them:
a protester at a kettle and an aid operator coordinating relief face different
risks and need different defaults. The threat model must also *evolve* as real
incidents expose gaps.

## Decision

1. **Persona-driven defaults.** A threat-model picker (`lib/threat-model.ts`)
   offers presets (journalist / protester / aid / observer / custom) that map
   to defensive FeatureFlags. Persona defaults blend worst-of with the user's
   jurisdiction risk (`lib/jurisdiction-risk.ts`) so a high-risk persona in a
   low-risk country is still treated as high-risk.
2. **User-supplied-only for hosted network.** Hosted TURN / SFU / relay are
   **never** platform dependencies. They are optional, user-supplied, and off
   by default. The core stays serverless (ADR-0001).
3. **Defense in depth, client-side.** Sybil resistance (`lib/sybil-resistance.ts`),
   classification + share scrubbing (`lib/classification.ts`), sealed-sender
   mesh mail, and the harm checklist (`lib/share-pack.ts`) all run on-device.
4. **Quarterly revision cadence.** After every real incident drill, the threat
   model is revisited and this ADR (or a successor) updated. The cadence is the
   only way a heuristic threat model stays honest.

## Consequences

**Positive**

- One user under one persona gets coherent defaults across Mask, Web, Heatmap,
  and Share surfaces — no per-feature ad-hoc risk decisions.
- The decision filter (static / offline / trust-or-reach / <10min) stays
  enforceable because the threat model never requires a hosted service.

**Negative**

- Persona presets are heuristics, not guarantees; the UI must surface the
  effective config (`effectiveThreatModel`) so the user can see and override it.
- Revision cadence requires discipline; a stale threat model is a liability.
  The Skeptic (`lib/skeptic.ts`) and incident-response playbook
  (`docs/INCIDENT_RESPONSE.md`) exist to surface when the model lags reality.

## Enforcement

- `lib/threat-model.ts` is the single source of persona→flag mapping; new
  surfaces import its FeatureFlags rather than re-deriving risk.
- The PR template asks whether a change raises jurisdiction/persona risk.
- Quarterly: re-read this ADR against the incident history; if reality has
  diverged, cut ADR-0004 (or supersede this one).
