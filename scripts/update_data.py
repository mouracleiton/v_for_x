#!/usr/bin/env python3
"""
V FOR X — Data Update Pipeline Orchestrator
============================================

Runs every data-update script in the correct sequence so a full data
refresh is a single command:

  1. snapshot.py save           — preserve the old backbone for diffing
  2. enrich_backbone.py         — merge deep-data into world_backbone.json
  3. fetch_sanctions_dossiers.py — refresh adjudicated entity dossiers
  4. snapshot.py save           — preserve the new backbone (for next diff)
  5. generate_api.py             — rebuild static API JSON into out/api/

Each step logs its status. A failure in any step halts the pipeline so
partial/corrupt data never ships.

Usage:
  python3 scripts/update_data.py            # full pipeline
  python3 scripts/update_data.py --dry-run  # show what would run, execute nothing
  python3 scripts/update_data.py --skip-fetch  # skip the network step (sanctions)

Exits non-zero on any failure.
"""

import argparse
import subprocess
import sys
import time
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent


class Style:
    OK = "\033[92m"
    WARN = "\033[93m"
    ERR = "\033[91m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    RESET = "\033[0m"


def banner(msg: str) -> None:
    bar = "=" * 60
    print(f"\n{Style.BOLD}{bar}\n  {msg}\n{bar}{Style.RESET}")


def run_step(name: str, cmd: list[str], dry_run: bool) -> bool:
    label = f"{Style.BOLD}[{name}]{Style.RESET}"
    if dry_run:
        print(f"{Style.DIM}  [DRY-RUN] {name}: {' '.join(cmd)}{Style.RESET}")
        return True
    print(f"\n{label} Running: {' '.join(cmd)}")
    start = time.time()
    result = subprocess.run(cmd, cwd=str(SCRIPTS_DIR))
    elapsed = time.time() - start
    if result.returncode != 0:
        print(f"{Style.ERR}  ✗ {name} FAILED (exit {result.returncode}) in {elapsed:.1f}s{Style.RESET}")
        return False
    print(f"{Style.OK}  ✓ {name} completed in {elapsed:.1f}s{Style.RESET}")
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description="V FOR X data update pipeline")
    parser.add_argument("--dry-run", action="store_true", help="Print steps without executing")
    parser.add_argument("--skip-fetch", action="store_true", help="Skip the sanctions fetch step")
    args = parser.parse_args()

    banner("V FOR X — DATA UPDATE PIPELINE")
    if args.dry_run:
        print(f"{Style.DIM}(dry-run mode — no commands will execute){Style.RESET}")
    if args.skip_fetch:
        print(f"{Style.WARN}(--skip-fetch: sanctions dossier fetch will be skipped){Style.RESET}")

    steps: list[tuple[str, list[str]]] = [
        ("1/5 snapshot-old", [sys.executable, "snapshot.py", "save"]),
        ("2/5 enrich-backbone", [sys.executable, "enrich_backbone.py"]),
    ]
    if not args.skip_fetch:
        steps.append(("3/5 fetch-sanctions", [sys.executable, "fetch_sanctions_dossiers.py", "--limit", "50"]))
    # Renumber dynamically after optional skip
    steps.append(("snapshot-new", [sys.executable, "snapshot.py", "save"]))
    steps.append(("generate-api", [sys.executable, "generate_api.py"]))

    # Renumber
    total = len(steps)
    renumbered: list[tuple[str, list[str]]] = []
    for i, (name, cmd) in enumerate(steps, 1):
        label = f"{i}/{total} {name.split(' ', 1)[-1] if ' ' in name else name}"
        renumbered.append((label, cmd))

    start = time.time()
    for name, cmd in renumbered:
        ok = run_step(name, cmd, args.dry_run)
        if not ok:
            banner(f"{Style.ERR}PIPELINE HALTED — fix the failure above and re-run.{Style.RESET}")
            return 1

    elapsed = time.time() - start
    banner(f"{Style.OK}PIPELINE COMPLETE — {total} steps in {elapsed:.1f}s{Style.RESET}")
    print(f"{Style.DIM}  Review changes with: git diff data/world_backbone.json{Style.RESET}")
    print(f"{Style.DIM}  Rebuild the site:    npm run build{Style.RESET}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
