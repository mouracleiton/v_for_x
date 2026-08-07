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
| 05 | `/the-web` | **The Web** | Anonymous P2P BBS chat (WebRTC stub), dead drops, ECDSA keypair identity |
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
| Crypto | Web Crypto API (SHA-256, AES-GCM, ECDSA P-256) |
| Sound | Web Audio API (procedural — no audio files) |
| Persistence | IndexedDB / LocalStorage (client-side only) |

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

The build produces 229 static HTML pages in `out/`. No server required. Deploy to any static host (GitHub Pages, IPFS, USB drive).

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
│   └── the-mask/               # [08] The Mask
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

- **229 static pages** generated at build time (200 country detail pages + 12 blueprints + 5 dossiers + 9 branch pages)
- **Zero external API calls** at runtime — all data is bundled
- **Zero tracking** — no analytics, no cookies, no third-party scripts
- **Zero API keys** — Leaflet uses bundled GeoJSON, no Mapbox/Google token
- **Offline-capable** — works from a USB drive with no internet
- **Anonymous by design** — identity is a client-side ECDSA keypair, no registration
- **Decentralized-ready** — static export can be mirrored on IPFS, Tor, or local mesh
- **Stubs clearly marked** — every [STUB] feature has a visible badge and documented upgrade path

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
