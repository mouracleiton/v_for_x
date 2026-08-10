# V FOR X — The Mirror · one-command deployment kit

> Fortress documents self-hosting. **The Mirror automates it.**
> One command pulls the latest static build, pins it to IPFS, and stands up
> a censorship-resistant node in under five minutes.

This directory is the deployment kit referenced by the **/the-mirror/** page.
Everything here is meant to be copy-pasted onto a fresh machine — a laptop,
a VPS, a Raspberry Pi, or a USB stick — and Just Work.

The platform is a fully static export. **Any copy of the build is a complete,
functional node.** No databases, no servers, no single point of failure.

---

## The one command

```bash
curl -fsSL https://vforx.org/mirror/install.sh | bash
```

With the works — Tor hidden service + IPFS pin:

```bash
curl -fsSL https://vforx.org/mirror/install.sh | bash -s -- --tor --pin-ipfs
```

The installer:

1. Downloads a prebuilt release tarball (falls back to a source build if none).
2. Verifies the SHA-256 checksum.
3. Computes a **build manifest root hash** (the integrity proof for your badge).
4. Optionally pins the build to a local IPFS (kubo) node — via Docker if kubo isn't installed.
5. Stands up a hardened nginx/caddy/python static server.
6. Optionally publishes a Tor `.onion` hidden service.

### Flags

| Flag | Effect |
|------|--------|
| `--source` | Build from git instead of a release tarball |
| `--tor` | Configure a Tor `.onion` hidden service |
| `--pin-ipfs` | Pin the build to IPFS (kubo via Docker if needed) |
| `--port <N>` | Local HTTP port (default `8080`) |
| `--release <tag>` | Pin a specific release tag (default `latest`) |
| `--dir <path>` | Install directory (default `/opt/vfx-mirror`) |
| `--no-start` | Install only; don't start the server |

---

## Files

| File | Purpose |
|------|---------|
| `install.sh` | The one-command installer (curl\|bash target) |
| `pi-install.sh` | Raspberry Pi variant — installs Node, builds on ARM, survives reboot |
| `manifest.sh` | Standalone build-manifest / root-hash generator |
| `Dockerfile` | Multi-stage image: builds + serves with nginx |
| `docker-entrypoint.sh` | Computes the manifest on first boot, execs nginx |
| `docker-compose.yml` | Full stack: web + IPFS (kubo) + Tor |
| `nginx.conf` | Hardened static config (no logging, defensive headers) |
| `cloud-init.yaml` | Cloud VM bootstrap (paste as user-data) |

---

## Quick recipes

### Docker

```bash
docker build -t vfx-mirror .
docker run -d -p 8080:80 --name vfx vfx-mirror
# build hash:
docker exec vfx cat /usr/share/nginx/html/.vfx-build-hash
```

### Full stack (web + IPFS + Tor) via compose

```bash
docker compose up -d --build
# onion address:
docker exec vfx-tor cat /var/lib/tor/vfx/hostname
```

### Cloud VM (Hetzner / DigitalOcean / AWS / GCP)

Launch a Debian/Ubuntu instance and paste `cloud-init.yaml` as the **user-data**.
On first boot it installs Docker, runs the installer with `--pin-ipfs --tor`,
and writes the build hash, CID, and `.onion` address to `/var/log/vfx-mirror.log`.

### Raspberry Pi

```bash
curl -fsSL https://vforx.org/mirror/pi-install.sh | sudo bash
# then open http://<pi-ip>:8080 from any device on the LAN
```

### USB sneakernet

```bash
./manifest.sh ./out          # prints the build root hash
cp -R out /media/$USER/VFX   # copy to a USB drive
```
Open `index.html` directly — works with zero internet.

---

## The "I mirrored this" badge

After your mirror is live, open **[/the-mirror/](https://vforx.org/the-mirror/)** and:

1. Generate an anonymous operator keypair (ECDSA P-256, client-side).
2. Enter your transport (clearnet / `.onion` / IPFS CID / mesh / USB) and the
   **build root hash** printed by the installer.
3. Mint a signed badge. The badge is a compact, self-contained token anyone can
   verify offline — no server, no registry.

The **distributed node list** is a local collection of verified badges. Merge
lists peer-to-peer (via The Web, dead drops, QR — see `/the-relay/`). There is
no central registry; every operator holds their own view of the network.

### How the build hash works

`manifest.sh` (and the installer, and `docker-entrypoint.sh`) hash every file in
the build, write `.vfx-manifest.json`, and take the SHA-256 of that manifest as
the **root hash**. The browser (`lib/mirror.ts → computeManifestRoot`) reproduces
the exact same value from the manifest file, so a badge cryptographically binds
a mirror claim to a specific, verifiable build.

---

## Threat model & hardening

- **No logging** — nginx config sets `access_log off` by default.
- **Defensive headers** — `X-Content-Type-Options`, `X-Frame-Options: DENY`,
  `Referrer-Policy: no-referrer`, `Permissions-Policy`.
- **No third-party requests** — the static build has no analytics, fonts, or CDNs.
  Verify before deploying to an `.onion`: every external request can deanonymize
  a visitor. See **[/the-onion/](https://vforx.org/the-onion/)**.
- **Content-addressed pinning** — the IPFS CID and the build root hash both
  pin a mirror to a specific, immutable build.

---

*People should not be afraid of their governments. Governments should be afraid
of their people.*
