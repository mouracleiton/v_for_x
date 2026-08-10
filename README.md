# V FOR X

**An indestructible, decentralized, anonymous-first web platform for exposing corruption, routing resources, and sharing survival knowledge.**

Cyberpunk terminal aesthetic. Fully static. No backend. No tracking. Works offline.

People should not be afraid of their governments. Governments should be afraid of their people.

---

## What It Is

V for X is not a tool — it's a transition phase. A platform where ordinary people can **see** the problem, **understand** the solution, **act** on it, **hold** the powerful accountable, **coordinate** anonymously, and **protect** themselves while doing so.

The 9 branches form a connected loop:

```
    ┌──────────────────────────────────────────────────┐
    │                                                  │
    ▼                                                  │
 00. SEE        →  02. UNDERSTAND  →  03. ACT          │
 (Briefing)        (The Equation)     (Protocol X      │
                                     + The Trail)       │
    ▲                                                  │
    │                                                  │
 07. SURVIVE  ←  08. PROTECT  ←  05. COORDINATE  ← 04. │
 (Fortress)     (The Mask)      (The Web)         HOLD │
                                                   (Registry)
```

---

## The 9 Branches

| Code | Route | Name | Description |
|------|-------|------|-------------|
| 00 | `/` | **Daily Briefing** | Top 3 live crises, devastating statistics, shareable viral data points |
| 01 | `/sorrow-map` | **Sorrow Map** | Interactive choropleth world map — 200 countries × 19 dimensions, hotspot overlay, country detail dossiers |
| 02 | `/equation` | **The Equation** | Scenario simulator ($0–$150B/yr), intervention ROI, financing mechanisms, 17 ranked conflict-zone tactics |
| 03 | `/protocol-x` | **Protocol X** | 12 survival blueprints (water, food, power, comms, medical, security, organizing), context-aware filtering, checklist generator |
| 04 | `/registry` | **The Registry** | Accountability dossiers with peer-validated evidence chain, 6 anti-witch-hunt safeguards |
| 05 | `/the-web` | **The Web** | Anonymous P2P BBS chat (WebRTC), dead drops, ECDSA keypair identity — plus automated signaling relay (room codes, clipboard broadcast, hash links) |
| 06 | `/the-trail` | **The Trail** | Transparent DAO ledger, resource routing, needs matching |
| 07 | `/fortress` | **The Fortress** | Hydra nodes architecture, self-hosting (Docker/Pi/IPFS/Tor), anti-censorship toolkit |
| 08 | `/the-mask` | **The Mask** | ZK identity stub, duress codes with decoy interface, 6-section OpSec guide, threat model |

---

## Data Backbone

The platform is powered by a unified data spine covering **200 countries × 19 dimensions (~87 fields each)**.

| File | Size | Description |
|------|------|-------------|
| `world_backbone.json` | 747 KB | 200 countries, 19 dimensions, JOIN by ISO3 |
| `world_backbone_geo.json` | 2.7 MB | Same data + Natural Earth 50m geometries for maps |
| `countries_en.json` | 46 KB | Canonical country list (ISO 3166-1 + UN M49) |
| `blueprints.json` | 17 KB | 12 Protocol X seed blueprints |
| `dossier-seed.json` | 5 KB | 5 example Registry dossiers |
| `ejatlas-summary.json` | 549 KB | 3,838 environmental conflicts × 156 countries (summary + top conflicts per country) |
| `ejatlas-conflicts.json` | 5.3 MB | Full EJAtlas conflict records (all fields) |

### 19 Dimensions

Demographics · Economy · Health · Human Development · Hunger · Conflict · Military · Climate · Environment · Inequality · Water/Sanitation · Education · Connectivity · Migration · Gender · Governance · Security · Poverty · Employment

### Scenario Engine

5 budget scenarios with 10-year projections (2025–2034):

| Scenario | Annual Budget | Final Hunger (2034) | SDG2 Met? |
|----------|--------------|---------------------|-----------|
| BAU | $0/yr | 625.8M | No |
| Minimum | $15B/yr | 321.8M | No |
| Moderate | $40B/yr | ~140M | No |
| Ambitious | $93B/yr | 18.9M | Yes |
| Maximum | $150B/yr | ~5M | Yes |

### Data Sources

1. FAO SOFI Report 2024/2025
2. WFP/UN (Nov 2025)
3. Global Report on Food Crises 2025
4. IFAD 2022–2024
5. World Bank
6. WHO/UNICEF
7. CGIAR
8. SIPRI
9. Laborde et al. (2021, Food Policy)
10. EJAtlas — Global Atlas of Environmental Justice (ejatlas.org / ICTA-UAB) — 3,838 socio-environmental conflicts across 156 countries (CC BY-NC-SA 3.0)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, static export) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| State | Zustand |
| Maps | react-leaflet + Leaflet |
| Charts | ASCII bar charts (no chart library overhead) |
| CRDT | Custom RGA documents (from scratch, zero deps) |
| Crypto | Web Crypto API (SHA-256, AES-GCM, ECDSA P-256) |
| Sound | Web Audio API (procedural — no audio files) |
| Persistence | IndexedDB / LocalStorage (client-side only) |
| On-device AI | transformers.js (WebGPU/WASM) — semantic understanding, zero query leakage |

---

## Design System

Strict cyberpunk terminal aesthetic — every pixel obeys:

- **Pure black** backgrounds (#000 / #0a0a0a), no light themes
- **Blood-red** accents (#cc0000), terminal green only for verified states (#00ff41)
- **Monospace** typography throughout (JetBrains Mono / Fira Code / system mono)
- **Scanlines**, CRT vignette, film grain, flicker effects
- **Glitch** text (RGB chromatic aberration on hover)
- **Typewriter** effect on hero text and headers
- **Sharp corners** everywhere (border-radius: 0), brutalist
- **Procedural sound** — keystroke clicks, nav beeps, static bursts (off by default)
- **prefers-reduced-motion** respected — disables all animations
- **Mobile responsive** — effects reduce intensity on small screens
- **Print mode** — Protocol X blueprints strip all effects for physical distribution

---

## On-device Semantic Oracle

The Oracle (`/the-oracle/`) answers plain-English questions over the 200×28 data matrix. It runs **two engines**, both fully on-device:

- **Exact** — instant heuristic pattern matching for threshold/rank queries (`"hunger > 30%"`, `"top 10 by military"`).
- **Semantic** — a small transformer model (`all-MiniLM-L6-v2`, ~23 MB) loaded via [transformers.js](https://huggingface.co/docs/transformers.js), running in-browser on **WebGPU** (or WASM fallback). It embeds every country's crisis profile and every metric into a vector index, then answers *conceptual* questions that keywords cannot:

> *"Which countries are most likely to tip into famine next year?"*

The semantic ranker blends two on-device signals: a direction-normalized **composite** crisis score weighted by the metrics most relevant to the query (80%), plus direct **query↔country semantic similarity** (20%). Every result shows its top contributing dimensions for explainability.

**Privacy by design.** The model and its WASM runtime are public open-source artifacts fetched once and cached locally forever. Every query is embedded on-device and compared against the local index — **nothing about your questions ever leaves the browser.** This is the platform's most defensible differentiator: real natural-language understanding that never phones home.

The computed 200-country + metric vector index is persisted in IndexedDB (keyed by model + data version), so repeat visits are instantly ready.

| Module | Role |
|--------|------|
| `lib/semantic-oracle.ts` | Pure vector math, normalization, scoring, ranking (model-agnostic, fully unit-tested) |
| `lib/embeddings.ts` | Runtime loader for transformers.js (WebGPU/WASM, progress, caching) |
| `app/the-oracle/page.tsx` | Dual-engine UI with graceful fallback + privacy panel |
| `tests/semantic-oracle.test.ts` | 24 tests covering math, normalization, and end-to-end ranking on real data |

---

## Build & Run

```bash
# Clone
git clone https://github.com/mouracleiton/v_for_x.git
cd v_for_x

# Install
npm install

# Develop
npm run dev

# Build static export
npm run build

# Serve locally
npx serve out/
```

The build produces 231 static HTML pages in `out/`. No server required. Deploy to any static host (GitHub Pages, IPFS, USB drive).

---

## The Mirror — one-command deployment kit

Fortress documents self-hosting; **The Mirror automates it.** A single command
pulls the latest static build, pins it to IPFS, and stands up a censorship-
resistant node in under five minutes.

```bash
# One command → a live mirror (clearnet, .onion, IPFS, Pi, USB)
curl -fsSL https://vforx.org/mirror/install.sh | bash -s -- --tor --pin-ipfs
```

The kit (`/mirror/`) ships a Docker image, a `docker-compose` stack (web + kubo
IPFS + Tor), a `cloud-init.yaml` for cloud VMs, a Raspberry Pi installer, and a
build-manifest tool that produces a SHA-256 root hash bound to every badge.

Each operator mints a signed **"I mirrored this" badge** (ECDSA P-256, fully
client-side) that feeds a **distributed, serverless node list** — merge lists
peer-to-peer via The Web or dead drops. There is no central registry.

→ **[/the-mirror/](app/the-mirror/page.tsx)** — the in-app kit page + badge generator
→ **[mirror/](mirror/)** — the deployment artifacts

---

## Project Structure

```
v-for-x/
├── app/
│   ├── layout.tsx              # Global terminal layout, scanlines, CRT, sound
│   ├── page.tsx                # [00] Daily Briefing
│   ├── sorrow-map/             # [01] Map of Sorrow
│   │   ├── page.tsx            #     World map + dimension switcher
│   │   ├── [iso3]/             #     200 country detail pages
│   │   └── [iso3]/page.tsx     #     generateStaticParams wrapper
│   ├── equation/               # [02] The Equation
│   ├── protocol-x/             # [03] Protocol X
│   │   ├── page.tsx            #     Blueprint repository
│   │   └── [id]/               #     12 blueprint detail pages
│   ├── registry/               # [04] The Registry
│   │   └── [id]/               #     Dossier detail pages
│   ├── the-web/                # [05] The Web
│   ├── the-trail/              # [06] The Trail
│   ├── fortress/               # [07] The Fortress
│   ├── the-mask/               # [08] The Mask
│   ├── the-docs/               # Collaborative CRDT documents
│   └── the-mirror-ring/        # Verified mirror directory
├── components/
│   ├── ui/                     # TerminalCard, GlitchText, Typewriter, DataBar, StatusPill
│   ├── map/                    # ChoroplethMap (react-leaflet)
│   └── shared/                 # BranchNav, ShareableStat, SoundToggle
├── data/                       # All JSON data (static imports)
├── lib/                        # Types, formatters, crosslinks, sound engine
├── stores/                     # Zustand store
└── styles/                     # (in globals.css)
```

---

## Key Features

- **231 static pages** generated at build time (200 country detail pages + 12 blueprints + 5 dossiers + 9 branch pages + 2 new routes)
- **Zero external API calls** at runtime — all data is bundled
- **On-device semantic AI** — a transformer model runs in your browser (WebGPU/WASM) to answer conceptual natural-language questions about the data; queries never leave the device
- **Zero tracking** — no analytics, no cookies, no third-party scripts
- **Zero API keys** — Leaflet uses bundled GeoJSON, no Mapbox/Google token
- **Offline-capable** — works from a USB drive with no internet
- **Anonymous by design** — identity is a client-side ECDSA keypair, no registration
- **Decentralized-ready** — static export can be mirrored on IPFS, Tor, or local mesh
- **Stubs clearly marked** — every [STUB] feature has a visible badge and documented upgrade path
- **Signed data manifest** — every build hashes its public data API files (205 entries, deterministic root); the Receipts page verifies any copy locally, so tampered mirrors are detectable with zero network trust
- **Browser-to-browser signaling** — The Web pairs peers via VFXSIG tokens over clipboard/BroadcastChannel/hash links, no server in the path
- **Extension alert ticker** — the V FOR X Compass add-on polls a tiny generated feed and raises badge/notifications only when the watchlist actually changes
- **Dead man's switch auto-release** — the Guardian's armed ladder fires by itself at the missed deadline: builds the ECDSA-signed release packet, copies the token to the clipboard, and surfaces it for trusted contacts; duress/panic release immediately
- **Chunked encrypted file transfer** — The Web ships files over the live peer channel (VFXFILE1), per-chunk AES-GCM, SHA-256 verified on arrival; received files can be planted as encrypted dead drops
- **Mesh store-and-forward** — offline mail rides the peer mesh: queued in IndexedDB, flushed when peers meet, TTL-expired, hop-capped to 5
- **Collaborative documents (The Docs)** — offline-first conflict-free text docs built on a from-scratch RGA CRDT (no yjs/automerge); sync by copy, paste, or BroadcastChannel; concurrent edits always converge
- **Evidence Room (Registry)** — hash-chain evidence bundles sealed per dossier, verifiable offline (VFXEV1), optional ZK commitment of custody
- **Public Witness Ledger (The Receipts)** — signed, hash-chained public statements (VFXWIT1), exportable/importable, signature proves authorship without a name
- **Mirror Ring (/the-mirror-ring)** — verified mirror directory: paste a VFXM1: claim token, verify the signature locally, swap hosts with one click, share the ring as a text block
- **Offline Briefcase (Fortress)** — one tap crawls the whole static platform into the service-worker cache with live progress; the site then runs with zero connectivity
- **Polyglot Oracle** — the on-device semantic model is now selectable: fast English (23 MB) or the multilingual MiniLM-L12 (~118 MB quantized) covering 50+ languages; inference and indexing still stay in the browser
- **12 languages, 3 RTL** — Persian (فارسی) and Urdu (اردو) join Arabic as full right-to-left layouts with dir-aware CSS
- **Glitch Cards** — every ShareableStat can render as a downloadable 1200×630 PNG glitch card (canvas-drawn, zero server, zero libraries)

---

## Threat Model

| Adversary | What They Want | What V for X Does |
|-----------|---------------|-------------------|
| Surveillance state | Identify and locate users | No registration, client-side crypto |
| Network ISP | Track browsing patterns | All client-side, recommend Tor |
| Platform operator | Correlate user activity | No operator — decentralized |
| Physical attacker | Force disclosure | Duress codes, decoy interface |
| Malicious peer | Impersonate or deceive | Keypair signatures, reputation |

**Limitations:** Does NOT protect against physical compromise with forensics, endpoint malware, or zero-day exploits.

---

## License

**CC0-1.0** (Public Domain Dedication)

Fork it, modify it, redistribute it. You are the infrastructure.

---

## Acknowledgments

- Data backbone derived from [V for Vigilance](https://github.com/mouracleiton/v_for_vigilance) — 200 countries × 19 dimensions from 9 official sources
- Nonviolent resistance data: Erica Chenoweth, "Why Civil Resistance Works" (2011)
- SODIS water purification: WHO-validated method
- Meshtastic: open-source LoRa mesh networking
