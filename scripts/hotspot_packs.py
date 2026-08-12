#!/usr/bin/env python3
"""
V FOR X — Hotspot watch-pack generator (todo-096)

Auto-builds VFXPACK1 crisis manifests for the top-N severity ISO3 hotspots
and writes a manifest index. Each pack is a deterministic JSON envelope
(kind=manifest) that lib/vfxpack.ts readCrisisManifestFromToken() can decode,
so a mirror operator can pre-seed crisis packs without hand-editing.

Output:
  out/hotspot-packs/<ISO3>.json   — one pack per top-N hotspot
  out/hotspot-packs/index.json    — manifest index (id, iso3, severity, path)

Usage:
  python3 scripts/hotspot_packs.py                       # top-10, default out
  python3 scripts/hotspot_packs.py --top 20 --out public/hotspot-packs
  python3 scripts/hotspot_packs.py --dry-run             # print what would ship

Deterministic: same backbone → same packs (stable ids for dedup).
No network. Reads only data/world_backbone.json.
"""

import argparse
import json
import sys
import hashlib
from datetime import datetime, timezone
from pathlib import Path

DIMENSIONS = [
    "hunger", "conflict", "health", "demographics", "economy",
    "climate", "water_sanitation", "displacement",
]


def stable_id(iso3: str, ts: int) -> str:
    return "VFXHS-" + hashlib.sha256(f"{iso3}:{ts}".encode()).hexdigest()[:12].upper()


def _safe_round(score, default: float = 0.0) -> float:
    """Coerce a backbone severity to a finite float, else 0.0."""
    try:
        return round(float(score), 1)
    except (TypeError, ValueError):
        return default


def build_pack(country: dict, generated_at: int) -> dict:
    iso3 = country.get("iso3", "XXX")
    name = country.get("name_en", iso3)
    score = country.get("hotspot_score", 0)
    metrics = {}
    for dim in DIMENSIONS:
        block = country.get(dim)
        if isinstance(block, dict):
            # pick a couple of representative fields per dimension
            keys = [k for k in block if isinstance(block[k], (int, float))][:3]
            metrics[dim] = {k: block[k] for k in keys}
    return {
        "format": "vfx-pack-1",
        "version": 1,
        "kind": "manifest",
        "id": stable_id(iso3, generated_at),
        "label": f"Hotspot watch pack — {name} ({iso3})",
        "iso3": iso3,
        "severity": _safe_round(score),
        "generatedAt": generated_at,
        "metrics": metrics,
        "source": "data/world_backbone.json",
        "license": "CC0-1.0",
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="Build VFXPACK1 hotspot watch packs.")
    ap.add_argument("--top", type=int, default=10, help="number of top hotspots (default 10)")
    ap.add_argument("--out", default="out/hotspot-packs", help="output directory")
    ap.add_argument("--dry-run", action="store_true", help="print, do not write")
    args = ap.parse_args()

    root = Path(__file__).resolve().parent.parent
    backbone_path = root / "data" / "world_backbone.json"
    if not backbone_path.exists():
        print(f"ERROR: backbone not found at {backbone_path}", file=sys.stderr)
        return 1

    try:
        with open(backbone_path, "r", encoding="utf-8") as f:
            backbone = json.load(f)
    except OSError as e:
        print(f"ERROR: could not read backbone {backbone_path}: {e}", file=sys.stderr)
        return 1
    except json.JSONDecodeError as e:
        print(f"ERROR: backbone is not valid JSON: {e}", file=sys.stderr)
        return 1

    countries = backbone.get("countries", [])
    hotspots = [c for c in countries if c.get("is_hotspot")]
    hotspots.sort(key=lambda c: c.get("hotspot_score", 0), reverse=True)
    top = hotspots[: max(1, args.top)]

    try:
        generated_at = int(datetime.now(timezone.utc).timestamp())
    except OSError:
        generated_at = 0
    packs = [build_pack(c, generated_at) for c in top]

    if args.dry_run:
        print(f"[dry-run] would write {len(packs)} packs for: {', '.join(p['iso3'] for p in packs)}")
        for p in packs[:3]:
            print(f"  {p['id']}  {p['iso3']}  sev={p['severity']}  metrics={len(p['metrics'])}")
        return 0

    out_dir = Path(args.out)
    (out_dir).mkdir(parents=True, exist_ok=True)

    index = []
    try:
        for p in packs:
            rel = f"{p['iso3']}.json"
            with open(out_dir / rel, "w", encoding="utf-8") as f:
                json.dump(p, f, separators=(",", ":"), ensure_ascii=False)
            index.append({"id": p["id"], "iso3": p["iso3"], "severity": p["severity"], "path": rel})
    except OSError as e:
        print(f"ERROR: failed writing pack to {out_dir}: {e}", file=sys.stderr)
        return 1

    index.sort(key=lambda e: e["severity"], reverse=True)
    try:
        with open(out_dir / "index.json", "w", encoding="utf-8") as f:
            json.dump(
                {"generatedAt": generated_at, "count": len(index), "packs": index},
                f,
                separators=(",", ":"),
                ensure_ascii=False,
            )
    except OSError as e:
        print(f"ERROR: failed writing index to {out_dir}: {e}", file=sys.stderr)
        return 1

    print(f"Wrote {len(packs)} hotspot packs to {out_dir}/")
    for e in index[:5]:
        print(f"  {e['iso3']}  sev={e['severity']}  → {e['path']}")
    if len(index) > 5:
        print(f"  ... and {len(index) - 5} more (see index.json)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
