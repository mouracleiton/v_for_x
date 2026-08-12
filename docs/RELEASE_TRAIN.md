# V FOR X — Release Train

How a tagged static build gets cut, signed, and seeded to mirrors. The release
is a *process*, not a button: every step is reproducible so a volunteer can
rebuild the same artifact from the same commit.

## Cadence

- **Patch:** errata corrections, dependency bumps, test fixes. No data schema
  change. Tag `vX.Y.Z+1`.
- **Minor:** new VFX tokens, new libs, new `/the-*` routes (passing the
  decision filter). Data schema backward-compatible. Tag `vX.Y+1.0`.
- **Major:** breaking data-schema or token-format change. Requires an ADR and
  a fork-coordination notice (see [FORK_COORDINATION](./FORK_COORDINATION.md)).
  Tag `vX+1.0.0`.

## Pre-flight (before tagging)

1. `npm test` → 0 failures.
2. `npx tsc --noEmit` → no new errors.
3. `npm run sbom:strict` → no unpinned dependencies.
4. `npm run token-changelog` → regenerate `out/TOKEN_CHANGELOG.md`.
5. Confirm `data-manifest.json` root is documented (run
   `scripts/manifest_drift.py --base HEAD~1`); any drift has a VFXERR1.

## Cut the build

```bash
git checkout main && git pull
npm ci
npm run build               # next build + generate_api + generate_data_manifest + copy_headers
npm run snapshot            # save a data snapshot for diff history
npm run hotspot-packs       # regenerate crisis packs for top-N hotspots
```

## Sign the build (build attestation)

```bash
python3 scripts/write_build_attest.py    # minisign-signed out/ + SBOM hash
```

The Receipts page's BUILD AUTHENTICITY card verifies this signature in-app
(`lib/build-attest.ts`), so a mirror operator can prove their copy is authentic
without trusting the transport.

## Tag + changelog

```bash
git tag -s vX.Y.Z -m " vX.Y.Z "
# changelog: concat the merged PR titles since the last tag
git log --pretty=format:"- %s" vX.Y.Z-1..HEAD > out/CHANGELOG.md
git push --tags
```

## Seed the mirrors

1. Publish the static `out/` to the canonical host (GitHub Pages).
2. Update the mirror seed list (`lib/mirror-ring.ts`) with the new build hash.
3. Post the release to the out-of-band channel: build hash, signature, mirror
   seed delta. Mirrors pull and self-attest via `VFXM1` claims.

## Post-release

- Run `scripts/manifest_drift.py` against the new tag on the next data PR to
  re-baseline.
- If a critical defect ships, the incident-response playbook
  ([INCIDENT_RESPONSE](./INCIDENT_RESPONSE.md)) governs the signed erratum, not
  a silent re-tag.

## Reproducibility contract

A volunteer following [REPRODUCIBILITY](./REPRODUCIBILITY.md) must be able to
rebuild the Briefing numbers and reproduce a manifest root within tolerance of
the tagged build. If they cannot, the release is not honest — file it before
the next train.
