#!/usr/bin/env bash
#
# vfx-manifest — compute a deterministic SHA-256 root hash for a build
# ────────────────────────────────────────────────────────────────────
# Emits .vfx-manifest.json in the build root and prints the root hash.
# This is the exact value you paste as "build hash" when minting an
# "I mirrored this" badge at https://vforx.org/the-mirror/
#
#   ./manifest.sh ./out
#
# The browser-side lib/mirror.ts computeManifestRoot() reproduces the
# same root from the manifest file, so anyone can verify the build a
# mirror claims to be serving.
set -euo pipefail

ROOT="${1:-./out}"
[[ -d "$ROOT" ]] || { echo "Usage: $0 <build-dir> (default: ./out)" >&2; exit 1; }

if command -v sha256sum >/dev/null 2>&1; then H=sha256sum
elif command -v shasum >/dev/null 2>&1; then H="shasum -a 256"
else echo "No SHA-256 tool found." >&2; exit 1; fi

MANIFEST="$ROOT/.vfx-manifest.json"
TMP="$MANIFEST.tmp"

printf '[' > "$TMP"
first=1
while IFS= read -r -d '' f; do
  rel="${f#$ROOT/}"
  [[ "$rel" == ".vfx-manifest.json"* ]] && continue
  sum="$($H "$f" | awk '{print $1}')"
  size="$(wc -c < "$f" | tr -d ' ')"
  [[ $first -eq 0 ]] && printf ',' >> "$TMP"
  first=0
  printf '{"path":"%s","size":%s,"sha256":"%s"}' "$rel" "$size" "$sum" >> "$TMP"
done < <(find "$ROOT" -type f -print0 | sort -z)
printf ']' >> "$TMP"
mv "$TMP" "$MANIFEST"

ROOT_HASH="$($H "$MANIFEST" | awk '{print $1}')"
echo "$ROOT_HASH"
echo "wrote $MANIFEST" >&2
