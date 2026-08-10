#!/usr/bin/env sh
# V FOR X mirror — container entrypoint
# Computes the build manifest hash on first boot, prints it, then execs nginx.
set -e

WEBROOT="/usr/share/nginx/html"
MANIFEST="$WEBROOT/.vfx-manifest.json"
HASH_FILE="/usr/share/nginx/html/.vfx-build-hash"

compute_manifest() {
    # Portable SHA-256 over every file in the webroot, sorted by path.
    # Emits the manifest JSON and echoes the root hash.
    printf '[' > "$MANIFEST.tmp"
    first=1
    find "$WEBROOT" -type f ! -name ".vfx-manifest.json*" 2>/dev/null | sort | while read -r f; do
        rel="${f#$WEBROOT/}"
        if command -v sha256sum >/dev/null 2>&1; then
            sum="$(sha256sum "$f" | awk '{print $1}')"
        else
            sum="$(sha256 "$f" | awk '{print $NF}')"
        fi
        size="$(wc -c < "$f" | tr -d ' ')"
        if [ "$first" -eq 0 ]; then printf ',' >> "$MANIFEST.tmp"; fi
        first=0
        printf '{"path":"%s","size":%s,"sha256":"%s"}' "$rel" "$size" "$sum" >> "$MANIFEST.tmp"
    done
    printf ']' >> "$MANIFEST.tmp"
    mv "$MANIFEST.tmp" "$MANIFEST"
    if command -v sha256sum >/dev/null 2>&1; then
        sha256sum "$MANIFEST" | awk '{print $1}'
    else
        sha256 "$MANIFEST" | awk '{print $NF}'
    fi
}

if [ ! -f "$HASH_FILE" ]; then
    echo "[vfx-mirror] computing build manifest…"
    ROOT_HASH="$(compute_manifest)"
    printf '%s\n' "$ROOT_HASH" > "$HASH_FILE"
    echo "[vfx-mirror] build root hash: $ROOT_HASH"
    echo "[vfx-mirror] claim this node at https://vforx.org/the-mirror/"
fi

# Optional IPFS pin via the sidecar (set PIN_IPFS=1)
if [ "$PIN_IPFS" = "1" ] && [ -n "$IPFS_GATEWAY" ]; then
    echo "[vfx-mirror] pinning to IPFS via $IPFS_GATEWAY …"
    CID="$(wget -qO- --post-data='' "$IPFS_GATEWAY/api/v0/add?recursive=true&pin=true" 2>/dev/null || true)"
    [ -n "$CID" ] && echo "[vfx-mirror] pinned: $CID" || echo "[vfx-mirror] IPFS pin skipped (gateway unavailable)"
fi

echo "[vfx-mirror] serving on :80"
exec nginx -g "daemon off;"
