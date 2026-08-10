#!/usr/bin/env bash
#
# vfx-mirror — Raspberry Pi (ARM64/ARMv7) installer
# ───────────────────────────────────────────────────────────────
# Turns a Pi on a local network into a censorship-resistant mirror.
# Builds from source (Node runs natively on ARM), serves on the LAN,
# and optionally pins to IPFS. Designed for Pi 3/4/5 + Pi Zero 2 W.
#
#   curl -fsSL https://vforx.org/mirror/pi-install.sh | sudo bash
#   curl -fsSL https://vforx.org/mirror/pi-install.sh | sudo bash -s -- --tor
#
set -euo pipefail

PORT="${PORT:-8080}"
INSTALL_DIR="${INSTALL_DIR:-/opt/vfx-mirror}"
ENABLE_TOR=0
[[ "${1:-}" == "--tor" ]] && ENABLE_TOR=1

C_GRN=$'\033[32m'; C_RED=$'\033[31m'; C_BLD=$'\033[1m'; C_RST=$'\033[0m'
say()  { printf '%s▶%s %s\n' "$C_GRN" "$C_RST" "$*"; }
warn() { printf '%s⚠%s %s\n' "$C_RED" "$C_RST" "$*" >&2; }
hdr()  { printf '\n%s══ %s ══%s\n' "$C_BLD" "$*" "$C_RST"; }
die()  { warn "$*"; exit 1; }

[[ $EUID -eq 0 ]] || die "Run with sudo: sudo bash pi-install.sh"

hdr "V FOR X · RASPBERRY PI MIRROR"
ARCH="$(uname -m)"
say "Detected architecture: $ARCH"
case "$ARCH" in
  aarch64|arm64) say "64-bit ARM — full speed build" ;;
  armv7l)        warn "32-bit ARM — build will be slow but works" ;;
  *) warn "Unexpected arch ($ARCH) — proceeding" ;;
esac

# ── install Node if missing (NodeSource 22.x) ──────────────────
if ! command -v node >/dev/null 2>&1; then
  hdr "INSTALL NODE.JS 22"
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
    | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" \
    > /etc/apt/sources.list.d/nodesource.list
  apt-get update -qq && apt-get install -y -qq nodejs
fi
say "Node: $(node -v)  npm: $(npm -v)"

# ── delegate to the main installer in --source mode ────────────
hdr "BUILD + SERVE"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
INSTALL_SH="$SCRIPT_DIR/install.sh"
if [[ ! -x "$INSTALL_SH" ]]; then
  curl -fsSL https://raw.githubusercontent.com/mouracleiton/v_for_vigilance/main/v-for-x/mirror/install.sh \
    -o /tmp/vfx-install.sh
  INSTALL_SH=/tmp/vfx-install.sh
  chmod +x "$INSTALL_SH"
fi

bash "$INSTALL_SH" --source --port "$PORT" --dir "$INSTALL_DIR" \
  $([[ $ENABLE_TOR -eq 1 ]] && echo --tor)

# ── LAN access hint ────────────────────────────────────────────
LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
hdr "MIRROR ONLINE ON YOUR LAN"
cat <<SUM
  ${C_GRN}build hash${C_RST} : $(cut -c1-16 "$INSTALL_DIR/BUILD_HASH" 2>/dev/null)…
  ${C_GRN}open from any device${C_RST}:
      http://${LAN_IP:-<pi-ip>}:${PORT}

  Add yourself to the distributed node list at
    ${C_BLD}https://vforx.org/the-mirror/${C_RST}

  A Pi drawing ~3W can keep this data uncensorable forever.
SUM

# ── optional: survive reboot via systemd ───────────────────────
if [[ -f "$INSTALL_DIR/vfx-mirror.pid" ]]; then
  cat > /etc/systemd/system/vfx-mirror.service <<SVC
[Unit]
Description=V FOR X mirror node
After=network.target

[Service]
Type=simple
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/env python3 -m http.server $PORT --directory $INSTALL_DIR/out
Restart=on-failure
User=root

[Install]
WantedBy=multi-user.target
SVC
  systemctl daemon-reload
  systemctl enable --now vfx-mirror.service
  say "Enabled systemd unit: vfx-mirror.service (survives reboot)"
fi
