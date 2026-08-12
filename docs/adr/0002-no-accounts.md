# ADR 0002 — No accounts, no cloud identity

- **Status:** Accepted
- **Date:** 2026-08-12
- **Supersedes:** —

## Context

A central account system would be both a honeypot (one breach compromises every
user) and a chokepoint (the censor blocks the auth endpoint and the tool dies).
It would also violate the project's "a non-technical person can finish it in
<10 minutes under stress" rule: signing up is friction, and a recoverable
password is a weak secret.

## Decision

V FOR X has **no user accounts**. Identity is a self-sovereign ECDSA P-256
keypair generated and stored on the visitor's device (`lib/identity.ts`,
VFXID1). There is no server that "knows" a user. Public keys are exchanged
peer-to-peer (WebRTC, QR, Relay tokens); trust is established via safety
numbers (`lib/safety-gate.ts`), not a directory.

## Consequences

**Positive**

- No credentials to phish, leak, or subpoena. The worst an adversary gets from
  a seized device is the local keypair — recoverable via social recovery
  (Shamir / Guardian set, Phase 23) if the user planned ahead.
- No account-creation step in the onboarding loop; a stranger can sign a
  witness statement offline in minutes (OnboardingWizard).
- Identity portability: a VFXID1 public card token moves between devices and
  forks without a migration server.

**Negative**

- Key loss = identity loss (mitigated by `rotateIdentity` grace period,
  `loadPreviousIdentities`, and the planned social-recovery UX).
- No central revocation → impostor handles are surfaced via the local key
  transparency log + safety-number gates, not killed by an admin
  (see `docs/INCIDENT_RESPONSE.md`).
- Spam/sybil resistance is local (`lib/sybil-resistance.ts`: rate limits, PoW,
  vouch dedupe) rather than a server-side reputation system.

## Enforcement

- No login/signup UI exists; `lib/identity.ts` is the only identity surface.
- The PR template's static-export checklist rejects new server-side session or
  auth code.
- Duress/panic flows (`lib/duress-decoy.ts`, `lib/storage-map.ts` panicWipe)
  assume device-only state.
