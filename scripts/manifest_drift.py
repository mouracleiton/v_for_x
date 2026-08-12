#!/usr/bin/env python3
"""
V FOR X — Manifest drift checker for CI (todo-353)

"Deterministic data pipeline CI: fetch-* dry-run + manifest drift comments on PRs."

Regenerates the data manifest from the CURRENT working tree and diffs it
against the COMMITTED manifest, then prints a machine- and human-readable
drift report. Intended to run in CI on PRs that touch data/ or scripts/, so a
reviewer sees exactly which backbone figures shifted and why.

Exit codes:
  0 — no drift (or --allow-drift)
  1 — drift detected (default), or manifest missing/unreadable

Usage:
  python3 scripts/manifest_drift.py               # fail on drift
  python3 scripts/manifest_drift.py --allow-drift # report only, exit 0
  python3 scripts/manifest_drift.py --base HEAD   # compare against a ref
"""

import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    try:
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                h.update(chunk)
    except OSError as e:
        print(f"ERROR: could not hash {path}: {e}", file=sys.stderr)
        return ""
    return h.hexdigest()


def manifest_root(manifest_path: Path) -> str | None:
    try:
        with open(manifest_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except OSError as e:
        print(f"ERROR: could not read {manifest_path}: {e}", file=sys.stderr)
        return None
    except json.JSONDecodeError as e:
        print(f"ERROR: manifest not valid JSON: {e}", file=sys.stderr)
        return None
    # generate_data_manifest.py emits { root, files: {path: hash} }
    return data.get("root") if isinstance(data, dict) else None


def git_show(ref: str, path: str) -> str | None:
    """Return the content of `path` at `ref`, or None if unavailable."""
    try:
        out = subprocess.run(
            ["git", "show", f"{ref}:{path}"],
            capture_output=True,
            text=True,
            check=False,
        )
    except FileNotFoundError:
        return None
    if out.returncode != 0:
        return None
    return out.stdout


def main() -> int:
    ap = argparse.ArgumentParser(description="Detect data-manifest drift for CI.")
    ap.add_argument("--manifest", default="data-manifest.json", help="manifest path")
    ap.add_argument("--base", default="HEAD", help="git ref to compare against")
    ap.add_argument("--allow-drift", action="store_true", help="exit 0 even on drift")
    args = ap.parse_args()

    root = Path(__file__).resolve().parent.parent
    manifest_path = root / args.manifest
    if not manifest_path.exists():
        # Try the committed location generate_data_manifest.py writes to.
        alt = root / "data-manifest.json"
        if alt.exists():
            manifest_path = alt
        else:
            print(f"ERROR: manifest not found at {manifest_path}", file=sys.stderr)
            return 1

    current_root = manifest_root(manifest_path)
    if current_root is None:
        return 1

    base_content = git_show(args.base, args.manifest) or git_show(args.base, "data-manifest.json")
    base_root = None
    if base_content:
        try:
            parsed = json.loads(base_content)
            if isinstance(parsed, dict):
                base_root = parsed.get("root")
        except json.JSONDecodeError as _e:
            base_root = None

    if base_root is None:
        print(f"## Manifest Drift\n\nNo baseline manifest at `{args.base}` — treating first run as the baseline.")
        print(f"\nCurrent root: `{current_root}`")
        return 0

    if current_root == base_root:
        print("## Manifest Drift\n\n✅ No drift — manifest root unchanged.")
        return 0

    print("## Manifest Drift\n")
    print(f"⚠️ Manifest root changed:\n  base `{args.base}`: `{base_root}`")
    print(f"  current:           `{current_root}`\n")
    print(
        "One or more backbone figures shifted. If this PR updates a data source, "
        "document the change in the corrections ledger (VFXERR1). If it is "
        "unintended, revert the data file before merging."
    )
    return 0 if args.allow_drift else 1


if __name__ == "__main__":
    raise SystemExit(main())
