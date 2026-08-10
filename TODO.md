# V FOR X — Development Backlog

## Completed Phases
- [x] Phase 1: Quick wins (stability, CI, test coverage)
- [x] Phase 2: Core promise (ECDSA signing, DAG ledger, ZK proofs)
- [x] Phase 3: Hardening (security headers, SW purge, build pipeline)
- [x] Phase 4: On-device semantic oracle (transformers.js, vector index)
- [x] Phase 5: Distributed event mapping (The Chronicle)
- [x] Phase 6: The Classifier (on-device document triage)
- [x] Phase 7: Module connections + crypto identity + new directions

## Phase 7 Details (Latest Sprint)

### Bug Fixes (Phase D)
- [x] Background sync no longer POSTs to nonexistent /api/sync
- [x] DAG anchoring chains to prior entries, not always genesis
- [x] Translation literal bug in the-exodus page fixed
- [x] Tests added for blockchain-verify and offline-manager

### Module Connections (Phase A)
- [x] Semantic oracle wired into GlobalSearch (conceptual Cmd+K search)
- [x] ECDSA signatures on DAG entries (lib/dag.ts + signDagEntry/verifyDagSignature)
- [x] Risk → Watch → Push alert pipeline (lib/alert-engine.ts)
- [x] Simulate → Forecast → Campaign pipeline (lib/pipeline.ts)
- [x] Exchange → Relay transport bridge (lib/exchange-relay.ts)
- [x] Gamification → signed certificates (generateCertificate/verifyCertificate)
- [x] Correlation explorer library (lib/correlation.ts — Pearson, Spearman, p-values, matrix)

### Crypto Identity Layer (Phase B)
- [x] Real ECDSA signatures on DAG entries
- [x] ECDH key agreement for dead drops (lib/ecdh.ts)
- [x] Forward secrecy ratchet for messaging (lib/ratchet.ts)
- [x] Duress decoy mode (lib/duress-decoy.ts)

### New Directions (Phase C)
- [x] Statistical correlation library (Pearson R, Spearman R, R², p-values)
- [x] Chain of custody tracker (lib/custody.ts)
- [x] Data quality scoring (lib/data-quality.ts)
- [x] Trigger rules / rules engine (lib/trigger-engine.ts)
- [x] Monte Carlo simulator (lib/monte-carlo.ts)

### New Pages
- [x] The Receipts (/the-receipts) — blockchain evidence timestamp UI
- [x] The Heatmap (/the-heatmap) — crowdsourced incident reporter
- [x] The Bridge (/the-bridge) — data import/export hub

## Test Coverage: 1109 tests across 53 files
