#!/usr/bin/env bash
#
# V FOR X — SBOM + dependency-pin audit
#
# Phase 13 supply-chain item: emit a lightweight SBOM artifact and
# fail when runtime dependencies drift away from pinned versions.
#
# SBOM format: minimal SPDX-2.3-ish JSON document with one entry per
# declared dependency in package.json + package-lock.json. The file is
# written to ./sbom.json next to the repo root so it ships with the
# static export, mirrors, and release artifacts.
#
# Pinned-dep audit: each runtime dependency in package.json must have
# an exact version (no "^", no "~", no "*"). Exits 1 on the first
# violation. Pre-existing drift is reported but does not block CI by
# default (set VFX_SBOM_STRICT=1 to fail on any drift).
#
# Usage:
#   ./scripts/sbom-audit.sh                 # write sbom.json + warn
#   VFX_SBOM_STRICT=1 ./scripts/sbom-audit.sh   # fail on any drift
#
# No network calls. No telemetry. Pure static analysis.

set -euo pipefail

# Prefer caller's CWD when it ships its own package.json (lets tests run in fixture dirs).
if [[ -f "${PWD}/package.json" ]]; then
  ROOT_DIR="$PWD"
else
  ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fi
PKG_JSON="$ROOT_DIR/package.json"
PKG_LOCK="$ROOT_DIR/package-lock.json"
OUT_FILE="$ROOT_DIR/sbom.json"

if [[ ! -f "$PKG_JSON" ]]; then
  echo "FATAL: package.json not found at $PKG_JSON" >&2
  exit 2
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "FATAL: python3 is required for sbom-audit.sh" >&2
  exit 2
fi

STRICT="${VFX_SBOM_STRICT:-0}"

python3 - "$PKG_JSON" "$PKG_LOCK" "$OUT_FILE" "$STRICT" <<'PYEOF'
import hashlib
import json
import sys
import time
from pathlib import Path

pkg_path, lock_path, out_path, strict = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
strict_fail = strict == "1"

pkg = json.loads(Path(pkg_path).read_text(encoding="utf-8"))
lock = {}
if Path(lock_path).exists():
    try:
        lock = json.loads(Path(lock_path).read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        # Treat unreadable lockfile as empty; we still emit SBOM from pkg
        lock = {}

declared = dict(pkg.get("dependencies", {}))
declared.update(pkg.get("devDependencies", {}))

drift = []
packages = []
lock_packages = lock.get("packages", {}) if isinstance(lock, dict) else {}

for name, declared_spec in sorted(declared.items()):
    # Resolve the actual locked version from package-lock.json
    # (root self-entry is keyed as "" — skip that)
    locked_version = None
    integrity = None
    resolved = None
    for key, info in lock_packages.items():
        if key == "":
            continue
        if key == f"node_modules/{name}" or key.endswith(f"/node_modules/{name}"):
            locked_version = info.get("version")
            integrity = info.get("integrity")
            resolved = info.get("resolved")
            break

    is_pinned = (
        declared_spec
        and not declared_spec.startswith("^")
        and not declared_spec.startswith("~")
        and not declared_spec.startswith("*")
        and not declared_spec.startswith(">")  # ranges / >=
        and not declared_spec.startswith("<")
    )
    if not is_pinned:
        drift.append({"name": name, "declared": declared_spec, "reason": "not pinned exact"})

    packages.append({
        "name": name,
        "version": locked_version or declared_spec.lstrip("^~>=<* "),
        "declaredSpec": declared_spec,
        "pinned": is_pinned,
        "integrity": integrity,
        "resolved": resolved,
    })

# Hashes for tamper evidence
src_bytes = Path(pkg_path).read_bytes()
pkg_sha = hashlib.sha256(src_bytes).hexdigest()
lock_sha = (
    hashlib.sha256(Path(lock_path).read_bytes()).hexdigest()
    if Path(lock_path).exists() else None
)

sbom = {
    "spdxVersion": "SPDX-2.3",
    "SPDXID": "SPDXRef-DOCUMENT",
    "name": pkg.get("name", "v-for-x"),
    "dataLicense": "CC0-1.0",
    "documentNamespace": f"https://vforx.local/sbom/{pkg.get('name', 'v-for-x')}/{int(time.time())}",
    "creationInfo": {
        "created": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "creators": ["Tool: v-for-x/scripts/sbom-audit.sh", "Organization: V FOR X"],
    },
    "packages": packages,
    "packageCount": len(packages),
    "drift": drift,
    "driftCount": len(drift),
    "sourceHashes": {
        "package.json": pkg_sha,
        "package-lock.json": lock_sha,
    },
}

Path(out_path).write_text(json.dumps(sbom, indent=2, sort_keys=True), encoding="utf-8")

# Console report
print(f"[sbom-audit] wrote {out_path}")
print(f"[sbom-audit] {len(packages)} packages declared, {len(drift)} not pinned exact")
if drift:
    print("[sbom-audit] drift:")
    for d in drift:
        print(f"  - {d['name']} = {d['declared']} ({d['reason']})")
    if strict_fail:
        print("[sbom-audit] STRICT mode: failing CI", file=sys.stderr)
        sys.exit(1)
PYEOF
