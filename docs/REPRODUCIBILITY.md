# V FOR X — Reproducibility Challenge

**Goal:** a volunteer who clones the repo must be able to rebuild the
Briefing numbers from sources in under one hour, producing a data manifest
root within tolerance of the canonical build. If they cannot, the pipeline is
opaque — and an opaque pipeline cannot be trusted in a censorship context.

This document is both the **target** and the **current status**, so a reader
can see exactly where the gap is.

## The challenge

> Given a fresh clone, no prior context, can you reproduce Briefing's headline
> numbers from their cited sources in under 60 minutes?

A pass requires:

1. Every Briefing figure traces to a named publisher + year + license
   (`lib/metric-meta.ts`).
2. Running the data pipeline (`npm run update-data -- --dry-run`) reproduces
   the committed `data/world_backbone.json` within tolerance.
3. `scripts/generate_data_manifest.py` produces a root matching the canonical
   build within tolerance.
4. `npm run build` succeeds offline (no runtime network calls) and the SBOM
   (`npm run sbom`) has no unpinned dependencies in strict mode.

## How to attempt it

```bash
git clone <repo> && cd v-for-x
npm ci
# 1. Dry-run the data pipeline (no network writes; reads cached sources)
npm run update-data -- --dry-run
# 2. Regenerate the data manifest
python3 scripts/generate_data_manifest.py
# 3. Compare your manifest root to the canonical one in the release notes
diff <(jq -r .root data-manifest.json) <(echo $CANONICAL_ROOT)
# 4. Build offline
npm run build
```

If any step fails or diverges beyond tolerance, file an issue with the step,
the error, and your environment. That report *is* the reproducibility work.

## Current status

| Step | Status | Notes |
| --- | --- | --- |
| Metric citations | **partial** | `lib/metric-meta.ts` has a seed set; not every Briefing figure has an entry yet |
| Data pipeline dry-run | **green** | `update_data.py --dry-run` is idempotent |
| Manifest determinism | **green** | same inputs → byte-identical root |
| Offline build | **green** | no runtime phone-home; Quiet Hours enforces it |
| SBOM strict | **green** | `npm run sbom:strict` passes on pinned deps |
| **End-to-end < 1h, no context** | **not yet** | Citations are the gap |

## Tolerance

- **Manifest root:** must match exactly for committed data; dry-run drift
  comments are acceptable on PRs (they surface source updates).
- **Numeric figures:** within the source's own revision window (e.g. a UNHCR
  quarterly revision). Document any deliberate re-baselining as a
  `VFXERR1` `update`.

## Closing the gap

The remaining work is citation coverage, not pipeline mechanics:

1. Expand `lib/metric-meta.ts` until every Briefing figure has a citable
   source card (the `i18n-coverage.ts` pattern applies: a coverage meter per
   metric, prioritizing the hotspot dimensions).
2. Surface "uncited figure" as a Skeptic finding (`lib/skeptic.ts`) so an
   author cannot publish a number the pipeline cannot defend.
3. Add a reproducibility CI job: clone → build → manifest → compare root to
   the committed one; fail on unexplained drift.

When citation coverage crosses the threshold and the CI job is green, this
challenge is closed and the "not yet" becomes a date.
