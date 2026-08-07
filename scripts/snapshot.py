#!/usr/bin/env python3
"""
V FOR X — Snapshot Manager for the Data Diff Engine.

Saves versioned snapshots of world_backbone.json so future data syncs
can be diffed ("what changed since last update?").

Snapshots are stored as data/snapshots/world_backbone_YYYY-MM-DD.json

Commands:
  python3 scripts/snapshot.py save     — save a new snapshot
  python3 scripts/snapshot.py list     — list all snapshots
  python3 scripts/snapshot.py diff <old_date> <new_date> — print diff summary
"""

import json
import sys
import os
from pathlib import Path
from datetime import datetime


def project_root():
    return Path(__file__).resolve().parent.parent


def snapshots_dir():
    d = project_root() / "data" / "snapshots"
    d.mkdir(parents=True, exist_ok=True)
    return d


def load_backbone():
    path = project_root() / "data" / "world_backbone.json"
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def cmd_save():
    data = load_backbone()
    created = data.get("metadata", {}).get("created", datetime.now().strftime("%Y-%m-%d"))
    # Use the data's "created" date as the snapshot name
    safe_date = created.replace("/", "-")
    snapshot_path = snapshots_dir() / f"world_backbone_{safe_date}.json"

    if snapshot_path.exists():
        print(f"⚠ Snapshot already exists: {snapshot_path.name}")
        # Overwrite if content differs
        with open(snapshot_path, "r", encoding="utf-8") as f:
            existing = json.load(f)
        if json.dumps(existing, sort_keys=True) == json.dumps(data, sort_keys=True):
            print("  Content identical — no new snapshot needed.")
            return
        print("  Content differs — overwriting.")

    with open(snapshot_path, "w", encoding="utf-8") as f:
        json.dump(data, f, separators=(",", ":"), ensure_ascii=False)

    size_kb = snapshot_path.stat().st_size / 1024
    print(f"✓ Snapshot saved: {snapshot_path.name} ({size_kb:.0f}KB)")
    print(f"  Date: {created}")
    print(f"  Countries: {data.get('metadata', {}).get('total_countries', '?')}")


def cmd_list():
    snaps = sorted(snapshots_dir().glob("world_backbone_*.json"))
    if not snaps:
        print("No snapshots found. Run: python3 scripts/snapshot.py save")
        return
    print(f"Found {len(snaps)} snapshot(s):")
    for s in snaps:
        try:
            with open(s, "r", encoding="utf-8") as f:
                data = json.load(f)
            created = data.get("metadata", {}).get("created", "?")
            total = data.get("metadata", {}).get("total_countries", "?")
            size_kb = s.stat().st_size / 1024
            print(f"  {s.name} — {created} — {total} countries — {size_kb:.0f}KB")
        except Exception as e:
            print(f"  {s.name} — ERROR: {e}")


def cmd_diff(old_date: str, new_date: str):
    """Print a human-readable diff summary between two snapshots."""
    old_path = snapshots_dir() / f"world_backbone_{old_date}.json"
    new_path = snapshots_dir() / f"world_backbone_{new_date}.json"

    if not old_path.exists():
        print(f"ERROR: old snapshot not found: {old_path.name}")
        return
    if not new_path.exists():
        print(f"ERROR: new snapshot not found: {new_path.name}")
        return

    with open(old_path, "r", encoding="utf-8") as f:
        old = json.load(f)
    with open(new_path, "r", encoding="utf-8") as f:
        new = json.load(f)

    old_by_iso = {c["iso3"]: c for c in old.get("countries", [])}
    new_by_iso = {c["iso3"]: c for c in new.get("countries", [])}

    added = [iso for iso in new_by_iso if iso not in old_by_iso]
    removed = [iso for iso in old_by_iso if iso not in new_by_iso]

    # Count metric changes
    tracked = [
        "hunger.undernourishment_pct",
        "hunger.famine_risk_1to5",
        "conflict.intensity_1to5",
        "health.doctors_per_1000",
        "health.life_expectancy",
        "education.literacy_rate_pct",
        "inequality.gini",
        "climate.co2_per_capita_t",
    ]

    changes = 0
    worsened = 0
    improved = 0
    for iso, new_c in new_by_iso.items():
        old_c = old_by_iso.get(iso)
        if not old_c:
            continue
        for path in tracked:
            parts = path.split(".")
            old_val = old_c
            new_val = new_c
            for p in parts:
                old_val = old_val.get(p) if isinstance(old_val, dict) else None
                new_val = new_val.get(p) if isinstance(new_val, dict) else None
            if old_val is None and new_val is None:
                continue
            if old_val == new_val:
                continue
            changes += 1
            try:
                if new_val is not None and old_val is not None:
                    if path in ("health.life_expectancy", "education.literacy_rate_pct", "health.doctors_per_1000"):
                        if new_val > old_val:
                            improved += 1
                        else:
                            worsened += 1
                    elif path == "health.doctors_per_1000":
                        if new_val > old_val:
                            improved += 1
                        else:
                            worsened += 1
                    else:
                        if new_val > old_val:
                            worsened += 1
                        else:
                            improved += 1
            except TypeError:
                pass

    print(f"\n{'='*60}")
    print(f"DATA DIFF: {old_date} → {new_date}")
    print(f"{'='*60}")
    print(f"Countries: {old.get('metadata', {}).get('total_countries', '?')} → {new.get('metadata', {}).get('total_countries', '?')}")
    if added:
        print(f"Added: {len(added)} — {', '.join(added[:5])}")
    if removed:
        print(f"Removed: {len(removed)} — {', '.join(removed[:5])}")
    print(f"Metric changes: {changes} total ({worsened} worsened, {improved} improved)")
    print(f"{'='*60}\n")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return

    cmd = sys.argv[1]
    if cmd == "save":
        cmd_save()
    elif cmd == "list":
        cmd_list()
    elif cmd == "diff":
        if len(sys.argv) < 4:
            print("Usage: python3 scripts/snapshot.py diff <old_date> <new_date>")
            return
        cmd_diff(sys.argv[2], sys.argv[3])
    else:
        print(f"Unknown command: {cmd}")
        print(__doc__)


if __name__ == "__main__":
    main()
