#!/usr/bin/env python3
"""
V FOR X — VFX token changelog generator (todo-352)

"Document all VFX* prefixes in /the-tokens automatically from TOKEN_SPECS (done)
 — add version changelog."

Generates a markdown changelog of every registered VFX* token from
lib/tokens.ts TOKEN_SPECS. The canonical source of truth is the TS module, so
this script extracts TOKEN_SPECS with a regex (no TS compiler dependency) and
emits a deterministic, sorted changelog a mirror operator can publish.

Output:
  out/TOKEN_CHANGELOG.md  (default)
  stdout                  (--dry-run)

Usage:
  python3 scripts/token_changelog.py
  python3 scripts/token_changelog.py --out public/TOKEN_CHANGELOG.md
  python3 scripts/token_changelog.py --dry-run
"""

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

TOKEN_FILE = "lib/tokens.ts"

# Crude but sufficient TOKEN_SPECS extractor: each entry is an object with
# `prefix`, `id`, `name`, `description`, `module`, `signed`, `encrypted`.
ENTRY_RE = re.compile(r"\{\s*prefix:\s*\"(VFX[A-Z0-9]+:)\"\s*,\s*id:\s*\"([^\"]+)\"")


def extract_specs(src: str) -> list[dict]:
    """Extract [{prefix, id}] from the TOKEN_SPECS array text."""
    out = []
    for m in ENTRY_RE.finditer(src):
        prefix, tid = m.group(1), m.group(2)
        out.append({"prefix": prefix, "id": tid})
    return out


def render(specs: list[dict], generated_at: int) -> str:
    lines = [
        "# VFX Token Changelog",
        "",
        f"Generated: {datetime.fromtimestamp(generated_at, timezone.utc).isoformat()}",
        f"Source of truth: `lib/tokens.ts` `TOKEN_SPECS` ({len(specs)} tokens)",
        "",
        "Every portable artifact on the platform carries a `VFX*:` prefix registered",
        "in `TOKEN_SPECS`. The `/the-tokens` catalog renders this list; this file is",
        "its versioned, diff-friendly companion for mirror operators and SDK authors.",
        "",
        "| Prefix | ID |",
        "|--------|----|",
    ]
    for s in sorted(specs, key=lambda e: e["id"]):
        lines.append(f"| `{s['prefix']}` | `{s['id']}` |")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser(description="Generate the VFX token changelog.")
    ap.add_argument("--out", default="out/TOKEN_CHANGELOG.md", help="output file")
    ap.add_argument("--dry-run", action="store_true", help="print to stdout, do not write")
    args = ap.parse_args()

    root = Path(__file__).resolve().parent.parent
    token_path = root / TOKEN_FILE
    try:
        src = token_path.read_text(encoding="utf-8")
    except OSError as e:
        print(f"ERROR: could not read {token_path}: {e}", file=sys.stderr)
        return 1

    specs = extract_specs(src)
    if not specs:
        print(f"ERROR: no TOKEN_SPECS entries found in {token_path}", file=sys.stderr)
        return 1

    try:
        generated_at = int(datetime.now(timezone.utc).timestamp())
    except OSError:
        generated_at = 0
    doc = render(specs, generated_at)

    if args.dry_run:
        print(doc)
        return 0

    out_path = Path(args.out)
    try:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(doc, encoding="utf-8")
    except OSError as e:
        print(f"ERROR: could not write {out_path}: {e}", file=sys.stderr)
        return 1

    print(f"Wrote token changelog ({len(specs)} tokens) to {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
