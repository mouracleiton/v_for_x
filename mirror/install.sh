#!/usr/bin/env bash
#
# vfx-mirror — one-command censorship-resistant mirror installer
# ─────────────────────────────────────────────────────────────
# Pulls the latest static build of V FOR X, verifies its integrity,
# optionally pins it to IPFS, and stands up a serving node in <5 min.
#
# Usage:
#   curl -fsSL https://vforx.org/mirror/install.sh | bash
#   curl -fsSL https://vforx.org/mirror/install.sh | bash -s -- --tor --pin-ipfs
#
# Flags:
#   --source              Build from git source instead of a release tarball
#   --tor                 Also configure a Tor .onion hidden service
#   --pin-ipfs            Pin the build to a local IPFS (kubo) node (via docker if absent)
#   --port <N>            Local HTTP port (default 8080)
#   --release <tag>       Pin a specific release tag (default: latest)
#   --dir <path>          Install directory (default: /opt/vfx-mirror)
#   --no-start            Install only; do not start the server
#   -h, --help            Show this help
#
# Environment overrides:
#   VFX_REPO              Git repo to clone in --source mode (default below)
#   VFX_RELEASE_BASE      Base URL for release tarballs (default below)
#
set -euo pipefail

# ── defaults ────────────────────────────────────────────────────
REPO="${VFX_REPO:-https://github.com/mouracleiton/v_for_vigilance.git}"
RELEASE_BASE="${VFX_RELEASE_BASE:-https://github.com/mouracleiton/v_for_vigilance/releases/latest/download}"
INSTALL_DIR="/opt/vfx-mirror"
PORT="${PORT:-8080}"
RELEASE_TAG="latest"
SOURCE_MODE=0
ENABLE_TOR=0
ENABLE_IPFS=0
START_SERVER=1

# ── pretty output ───────────────────────────────────────────────
if [[ -t 1 ]]; then
  C_RED=$'\033[31m'; C_GRN=$'\033[32m'; C_DIM=$'\033[2m'; C_BLD=$'\033[1m'; C_RST=$'\033[0m'
else
  C_RED=""; C_GRN=""; C_DIM=""; C_BLD=""; C_RST=""
fi
say()  { printf '%s▶%s %s\n' "$C_GRN" "$C_RST" "$*"; }
warn() { printf '%s⚠%s %s\n' "$C_RED" "$C_RST" "$*" >&2; }
hdr()  { printf '\n%s══ %s ══%s\n' "$C_BLD" "$*" "$C_RST"; }
die()  { warn "$*"; exit 1; }

usage() {
  sed -n '2,28p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
}

# ── parse args ──────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --source)   SOURCE_MODE=1; shift ;;
    --tor)      ENABLE_TOR=1; shift ;;
    --pin-ipfs) ENABLE_IPFS=1; shift ;;
    --no-start) START_SERVER=0; shift ;;
    --port)     PORT="${2:?--port requires a value}"; shift 2 ;;
    --release)  RELEASE_TAG="${2:?--release requires a value}"; shift 2 ;;
    --dir)      INSTALL_DIR="${2:?--dir requires a value}"; shift 2 ;;
    -h|--help)  usage ;;
    *) die "Unknown flag: $1 (try --help)" ;;
  esac
done

# ── platform detection ──────────────────────────────────────────
hdr "V FOR X · MIRROR NODE — one-command deployment"
ARCH="$(uname -m)"
OS="$(uname -s)"
say "Detected: ${OS} / ${ARCH}"
command -v curl >/dev/null || command -v wget >/dev/null || die "Need curl or wget."
[[ "$OS" == "Linux" || "$OS" == "Darwin" ]] || warn "Untested OS ($OS) — proceeding anyway."

need_root() {
  if [[ $EUID -ne 0 ]]; then
    warn "Not root — re-running with sudo for system install at ${INSTALL_DIR}"
    exec sudo -E env ENABLE_TOR="$ENABLE_TOR" ENABLE_IPFS="$ENABLE_IPFS" \
         PORT="$PORT" RELEASE_TAG="$RELEASE_TAG" SOURCE_MODE="$SOURCE_MODE" \
         START_SERVER="$START_SERVER" INSTALL_DIR="$INSTALL_DIR" \
         bash "$0" "$@"
  fi
}

# ── helpers ─────────────────────────────────────────────────────
dl() {  # download URL to file
  if command -v curl >/dev/null; then curl -fsSL "$1" -o "$2"
  else wget -qO "$2" "$1"; fi
}

have() { command -v "$1" >/dev/null 2>&1; }

ensure_static_server() {
  # Pick the first available static file server; install nginx on Debian if none.
  if have nginx; then SERVE_WITH="nginx"; return; fi
  if have caddy;  then SERVE_WITH="caddy";  return; fi
  if have busybox; then SERVE_WITH="busybox"; return; fi
  if have python3; then SERVE_WITH="python";  return; fi
  if have apt-get; then
    say "No static server found — installing nginx via apt."
    apt-get update -qq && apt-get install -y -qq nginx
    SERVE_WITH="nginx"; return
  fi
  die "No static server available (nginx/caddy/busybox/python3). Install one and retry."
}

compute_manifest() {  # writes .vfx-manifest.json + prints root hash
  local root="$1"
  local manifest="$root/.vfx-manifest.json"
  say "Computing build manifest (SHA-256 root hash)…"
  # Portable: prefer sha256sum, fall back to shasum -a 256
  local hasher
  if have sha256sum; then hasher="sha256sum"
  elif have shasum; then hasher="shasum -a 256"
  else warn "No SHA-256 tool — manifest skipped."; echo "unknown"; return; fi

  printf '[' > "$manifest"
  local first=1
  while IFS= read -r -d '' f; do
    local rel="${f#$root/}"
    [[ "$rel" == ".vfx-manifest.json" ]] && continue
    local sum size
    sum="$($hasher "$f" | awk '{print $1}')"
    size="$(wc -c < "$f" | tr -d ' ')"
    [[ $first -eq 0 ]] && printf ',' >> "$manifest"
    first=0
    printf '{"path":"%s","size":%s,"sha256":"%s"}' "$rel" "$size" "$sum" >> "$manifest"
  done < <(find "$root" -type f -print0)
  printf ']' >> "$manifest"

  # Root hash = sha256 of the sorted manifest content
  local root_hash
  root_hash="$($hasher "$manifest" | awk '{print $1}')"
  echo "$root_hash"
}

# ── obtain the build ────────────────────────────────────────────
mkdir -p "$INSTALL_DIR"
WEBROOT="$INSTALL_DIR/out"
rm -rf "$WEBROOT"
mkdir -p "$WEBROOT"

if [[ $SOURCE_MODE -eq 1 ]]; then
  hdr "BUILD FROM SOURCE"
  have git || die "git not found (required for --source)."
  have npm || die "npm not found (required for --source)."
  SRC="$INSTALL_DIR/src"
  if [[ -d "$SRC/.git" ]]; then
    say "Updating existing clone…"
    git -C "$SRC" fetch --quiet --all
    git -C "$SRC" checkout -q "${RELEASE_TAG/-latest/main}"
    git -C "$SRC" reset --hard -q "origin/${RELEASE_TAG/-latest/main}"
  else
    say "Cloning $REPO …"
    git clone --depth 1 "$REPO" "$SRC"
  fi
  ( cd "$SRC/v-for-x" 2>/dev/null || cd "$SRC" \
    && say "Installing dependencies (npm ci)…" \
    && npm ci --no-audit --no-fund \
    && say "Building static export (npm run build)…" \
    && npm run build )
  cp -R "$SRC"/v-for-x/out/. "$WEBROOT"/ || cp -R "$SRC"/out/. "$WEBROOT"/
else
  hdr "DOWNLOAD PREBUILT BUILD"
  URL="$RELEASE_BASE/vfx-out.tar.gz"
  SUM_URL="$RELEASE_BASE/vfx-out.tar.gz.sha256"
  say "Fetching release tarball…"
  if ! dl "$URL" "$INSTALL_DIR/vfx-out.tar.gz"; then
    warn "Release download failed — falling back to --source build."
    SOURCE_MODE=1
    exec bash "$0" --source \
      ${ENABLE_TOR:+--tor} ${ENABLE_IPFS:+--pin-ipfs} \
      --port "$PORT" --dir "$INSTALL_DIR" ${START_SERVER:+--no-start}
  fi
  if dl "$SUM_URL" "$INSTALL_DIR/vfx-out.tar.gz.sha256"; then
    EXPECTED="$(awk '{print $1}' "$INSTALL_DIR/vfx-out.tar.gz.sha256")"
    if have sha256sum; then ACTUAL="$(sha256sum "$INSTALL_DIR/vfx-out.tar.gz" | awk '{print $1}')"
    else ACTUAL="$(shasum -a 256 "$INSTALL_DIR/vfx-out.tar.gz" | awk '{print $1}')"; fi
    [[ "$ACTUAL" == "$EXPECTED" ]] || die "SHA-256 mismatch! Expected $EXPECTED got $ACTUAL"
    say "Integrity verified: ${C_DIM}$ACTUAL${C_RST}"
  else
    warn "No checksum published — skipping verification (not recommended)."
  fi
  say "Extracting…"
  tar -xzf "$INSTALL_DIR/vfx-out.tar.gz" -C "$WEBROOT" --strip-components=1
fi

# ── manifest / integrity root ───────────────────────────────────
BUILD_HASH="$(compute_manifest "$WEBROOT")"
say "Build root hash: ${C_BLD}$BUILD_HASH${C_RST}"
printf '%s\n' "$BUILD_HASH" > "$INSTALL_DIR/BUILD_HASH"

# ── optional IPFS pin ───────────────────────────────────────────
CID=""
if [[ $ENABLE_IPFS -eq 1 ]]; then
  hdr "PIN TO IPFS"
  if ! have ipfs; then
    if have docker; then
      say "kubo (ipfs) not found — starting a pinned container…"
      docker rm -f vfx-ipfs >/dev/null 2>&1 || true
      docker run -d --name vfx-ipfs -p 4001:4001 -p 127.0.0.1:5001:5001 \
        -v "$INSTALL_DIR/ipfs-data:/data/ipfs" ipfs/kubo:latest daemon
      say "Waiting for IPFS daemon to boot…"
      for _ in $(seq 1 30); do
        if docker exec vfx-ipfs ipfs id >/dev/null 2>&1; then break; fi
        sleep 2
      done
      IPFS="docker exec -i vfx-ipfs ipfs"
    else
      warn "IPFS requested but neither 'ipfs' nor 'docker' available. Skipping pin."
      ENABLE_IPFS=0
    fi
  else
    IPFS="ipfs"
    pgrep -x ipfs >/dev/null 2>&1 || { say "Starting local ipfs daemon…"; ipfs daemon --init & sleep 8; }
  fi
  if [[ $ENABLE_IPFS -eq 1 ]]; then
    say "Adding + pinning build to IPFS (this can take a minute)…"
    CID="$($IPFS add -r --quiet --pin "$WEBROOT" | tail -n1)"
    say "Pinned. CID: ${C_BLD}$CID${C_RST}"
    say "Gateway: https://ipfs.io/ipfs/$CID/"
    printf '%s\n' "$CID" > "$INSTALL_DIR/IPFS_CID"
  fi
fi

# ── start serving ───────────────────────────────────────────────
if [[ $START_SERVER -eq 1 ]]; then
  hdr "STAND UP MIRROR"
  ensure_static_server
  case "$SERVE_WITH" in
    nginx)
      SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
      CONF="/etc/nginx/sites-available/vfx-mirror"
      if [[ -f "$SCRIPT_DIR/nginx.conf" ]]; then cp "$SCRIPT_DIR/nginx.conf" "$CONF"
      else
        cat > "$CONF" <<NGINX
server {
    listen ${PORT} default_server;
    server_name _;
    root ${WEBROOT};
    index index.html;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "no-referrer" always;
    access_log off;
    location / { try_files \$uri \$uri/ \$uri.html /index.html; }
    location ~ /\\. { deny all; }
}
NGINX
      fi
      sed -i "s/listen [0-9]* default_server/listen ${PORT} default_server/" "$CONF"
      sed -i "s#root .*;#root ${WEBROOT};#" "$CONF"
      ln -sf "$CONF" /etc/nginx/sites-enabled/vfx-mirror
      nginx -t && systemctl reload nginx || nginx
      ;;
    caddy)
      nohup caddy file-server --listen ":${PORT}" --root "$WEBROOT" \
        >"$INSTALL_DIR/access.log" 2>&1 &
      echo $! > "$INSTALL_DIR/vfx-mirror.pid"
      ;;
    busybox)
      nohup busybox httpd -p "$PORT" -h "$WEBROOT" \
        >"$INSTALL_DIR/access.log" 2>&1 &
      echo $! > "$INSTALL_DIR/vfx-mirror.pid"
      ;;
    python)
      nohup python3 -m http.server "$PORT" --directory "$WEBROOT" \
        >"$INSTALL_DIR/access.log" 2>&1 &
      echo $! > "$INSTALL_DIR/vfx-mirror.pid"
      ;;
  esac
  say "Serving with $SERVE_WITH on port $PORT"
fi

# ── optional Tor hidden service ─────────────────────────────────
ONION=""
if [[ $ENABLE_TOR -eq 1 ]]; then
  hdr "TOR .ONION HIDDEN SERVICE"
  if have apt-get && ! have tor; then apt-get update -qq && apt-get install -y -qq tor; fi
  if have tor; then
    TORRC=/etc/tor/torrc
    grep -q "vfx-mirror" "$TORRC" 2>/dev/null || cat >> "$TORRC" <<TOR
HiddenServiceDir /var/lib/tor/vfx-mirror/
HiddenServicePort 80 127.0.0.1:${PORT}
TOR
    systemctl restart tor 2>/dev/null || service tor restart 2>/dev/null || tor &
    sleep 15
    ONION="$(cat /var/lib/tor/vfx-mirror/hostname 2>/dev/null || true)"
    [[ -n "$ONION" ]] && say "Onion address: ${C_BLD}$ONION${C_RST}"
  else
    warn "Tor requested but not installable. See The Onion (/the-onion/) for a manual guide."
  fi
fi

# ── summary ─────────────────────────────────────────────────────
hdr "MIRROR ONLINE"
cat <<SUM
  ${C_GRN}build hash${C_RST} : ${BUILD_HASH:0:16}…
  ${C_GRN}webroot${C_RST}    : ${WEBROOT}
  ${C_GRN}http${C_RST}       : http://localhost:${PORT}
$([[ -n "$CID" ]] && printf '  %sipfs cid%s   : %s\n' "$C_GRN" "$C_RST" "$CID")
$([[ -n "$ONION" ]] && printf '  %s.onion%s     : %s\n' "$C_GRN" "$C_RST" "$ONION")

  Now claim your node — open:
    ${C_BLD}https://vforx.org/the-mirror/${C_RST}
  and mint an "I mirrored this" badge with this build hash.

  The platform is a static export. Every copy is a node.
  People should not be afraid of their governments.
SUM
