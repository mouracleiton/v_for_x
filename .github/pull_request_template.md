<!--
  V FOR X — Pull Request Template
  Static-export, no-accounts, offline-first. This checklist keeps every PR
  honest about its data + ethics impact. Fill in what applies; mark N/A on
  the rest.
-->

## Summary

<!-- One or two sentences: what does this change, and why? -->

## Static / offline contract (required for every PR)

- [ ] No new network calls from the client (or, if essential, gated behind explicit user opt-in and `lib/quiet-hours.ts`)
- [ ] No new accounts, hosted services, or cloud dependencies introduced
- [ ] No new tracking / analytics that leave the device
- [ ] Works fully offline (tested or reasoned) — no runtime phone-home

## Data ethics checklist (complete when touching dossiers, rosters, metrics, or sources)

- [ ] **Sourcing**: every new figure is citable to a named publisher + year + license, or marked `unverified`
- [ ] **No PII**: no names, contact details, exact locations, or faces of at-risk individuals without documented consent
- [ ] **Harm check**: this data could not plausibly endanger a person if it fell into hostile hands; if it could, it is marked sensitive and panic-wipe aware
- [ ] **Right to be wrong**: the data can be corrected / retracted via the errata + dispute chain (`VFXERR1` / `VFXDSP1`), not silently overwritten
- [ ] **Translator reach**: new user-facing strings have at least `en` + are logged for the ar/fa/ur/hi translation swarm (`lib/i18n-coverage.ts`)

## Storage + identity hygiene (complete when touching localStorage / IDB / identity)

- [ ] New `localStorage` / IDB keys are registered in `lib/storage-map.ts` (the completeness test fails CI otherwise)
- [ ] Sensitive new keys set `wipeOnPanic: true` unless they must survive panic (and `preserveInDecoy` is set deliberately)
- [ ] Any new `VFX*` token prefix is registered in `lib/tokens.ts` `TOKEN_SPECS` (the token-linter test fails CI otherwise)

## Verification

- [ ] `npm test` passes (no new failures beyond known pre-existing ops-journal/capacitor-guardian env issues)
- [ ] `npx tsc --noEmit` introduces no new type errors in changed files
- [ ] If new logic (branch / loop / parser / money-or-security path): a focused test covers it

## Decision filter (does this belong in V FOR X?)

1. Completes See → Understand → Act → Hold → Coordinate → Protect?
2. Works fully static, offline, no phone-home?
3. Increases trust (sign/verify) or reach (mirror/mesh/share)?
4. A non-technical person can finish it in <10 minutes under stress?

<!-- Anything that fails the filter should not merge. Park it in TODO.md instead. -->
