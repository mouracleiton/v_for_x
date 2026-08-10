#!/usr/bin/env python3
"""
V FOR X — Generate the data integrity manifest.

Hashes every JSON file served by the public data API
(out/api/v1/**) and writes a deterministic manifest at
out/api/v1/manifest.json:

    {
      "format": "vfx-data-manifest-1",
      "generatedAt": "…",
      "count": N,
      "root": "<sha256 of canonical entry list>",
      "entries": [ { "path", "size", "sha256" }, … ]
    }

The root hash is computed exactly as lib/mirror.ts
computeManifestRoot: entries sorted by path, canonicalized,
JSON-serialized, SHA-256 over the whole document. This same root
can be pasted into an "I mirrored this" badge so a badge's build
hash also vouches for the data files.

Usage: python3 scripts/generate_data_manifest.py [--out out]
The output path is relative to the site root, so the manifest is
served at /api/v1/manifest.json.
"""

import hashlib
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def main():
    project_root = Path(__file__).resolve().parent.parent
    out_dir = Path(sys.argv[sys.argv.index("--out") + 1]) if "--out" in sys.argv else project_root / "out"
    api_dir = out_dir / "api" / "v1"

    if not api_dir.exists():
        print(f"✗ {api_dir} not found — run generate_api.py first", file=sys.stderr)
        sys.exit(1)

    entries = []
    for f in sorted(api_dir.rglob("*.json")):
        if f.name == "manifest.json":
            continue
        rel = f.relative_to(out_dir).as_posix()
        entries.append({
            "path": rel,
            "size": f.stat().st_size,
            "sha256": sha256_file(f),
        })

    # Deterministic root hash — identical algorithm to lib/mirror.ts
    canon = json.dumps(
        [{"path": e["path"], "size": e["size"], "sha256": e["sha256"]} for e in sorted(entries, key=lambda e: e["path"])],
        separators=(",", ":"),
    )
    root = hashlib.sha256(canon.encode("utf-8")).hexdigest()

    manifest = {
        "format": "vfx-data-manifest-1",
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "count": len(entries),
        "root": root,
        "entries": entries,
    }

    out = api_dir / "manifest.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(manifest, f, separators=(",", ":"))

    print(f"✓ data manifest: {len(entries)} files → {out.relative_to(project_root)}")
    print(f"  root: {root}")


if __name__ == "__main__":
    main()