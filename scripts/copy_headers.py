#!/usr/bin/env python3
"""
V FOR X — Copy _headers and _redirects into the static export.

Cloudflare Pages / Netlify read _headers from the output directory.
This script ensures they're present after `next build`.
"""
from pathlib import Path
import shutil

base = Path(__file__).resolve().parent.parent
out_dir = base / "out"
headers_src = base / "public" / "_headers"

if not out_dir.exists():
    print("⚠ out/ directory not found — run `npm run build` first")
    exit(0)

if headers_src.exists():
    dest = out_dir / "_headers"
    shutil.copy2(headers_src, dest)
    print(f"✓ Copied _headers → {dest}")
else:
    print("⚠ public/_headers not found — skipping")
