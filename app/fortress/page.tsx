import type { Metadata } from "next";
import { tc } from "@/lib/i18n-content";
import { getMeta } from "@/lib/seo";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import OfflineBriefcase from "./OfflineBriefcase";

const meta = getMeta("/fortress/");

export const metadata: Metadata = {
  title: meta.title,
  description: meta.description,
  openGraph: { title: meta.title, description: meta.description },
};

export default function FortalezaPage() {
  // Fortress is a server component — use "en" for static export
  const lang = "en" as const;
  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-4xl mx-auto">
      <div className="mb-8 pt-4">
        <div className="text-xs text-content-dim mb-1">{tc(lang, "fortress.section_label")}</div>
        <h1 className="text-2xl md:text-3xl text-blood-bright font-bold glow-blood">
          {tc(lang, "fortress.title")}
        </h1>
        <p className="text-content-secondary text-sm mt-2">
          {tc(lang, "subtitle.fortress")}
        </p>
      </div>

      {/* One-command deployment → The Mirror */}
      <TerminalCard title={tc(lang, "card.anti_censorship")} accent="green" glow className="mb-6">
        <p className="text-xs text-content-secondary mb-2">
          Don&apos;t want to do this by hand? <span className="text-terminal-green">The Mirror</span> automates it —
          one command pulls the latest static build, pins it to IPFS, and stands up a censorship-resistant node in
          under five minutes. Docker, cloud-init, Raspberry Pi, and Tor paths included.
        </p>
        <pre className="text-xs text-terminal-green bg-void border border-border-dim p-3 overflow-x-auto mb-2">{`curl -fsSL https://vforx.org/mirror/install.sh | bash -s -- --tor --pin-ipfs`}</pre>
        <a href="/the-mirror/" className="text-xs text-blood-bright underline">→ Open The Mirror — one-command deployment kit</a>
      </TerminalCard>

      {/* Hydra Nodes */}
      <TerminalCard title={tc(lang, "fortress.hydra")} glow className="mb-6">
        <pre className="text-blood text-[8px] md:text-[10px] leading-tight mb-4" aria-hidden="true">{`
     NODE-A          NODE-B          NODE-C
    ┌───────┐      ┌───────┐      ┌───────┐
    │ VFX-1 │◄────►│ VFX-2 │◄────►│ VFX-3 │
    └───┬───┘      └───┬───┘      └───┬───┘
        │              │              │
        ▼              ▼              ▼
    ┌───────┐      ┌───────┐      ┌───────┐
    │ IPFS  │      │ TOR   │      │ MESH  │
    └───────┘      └───────┘      └───────┘
        ▲              ▲              ▲
        │              │              │
        └──────────────┴──────────────┘
                   PEER SYNC
`}</pre>
        <p className="text-xs text-content-secondary">
          The platform is a static export. Any copy of the build is a fully functional node.
          No databases, no servers, no central authority. You download it, you host it, you are a node.
        </p>
        <div className="flex gap-2 mt-3">
          <StatusPill color="green">{tc(lang, "status.active")}</StatusPill>
          <StatusPill color="dim">{tc(lang, "fortress.nodes")}</StatusPill>
          <StatusPill color="dim">{tc(lang, "fortress.mirrors")}</StatusPill>
        </div>
      </TerminalCard>

      {/* Self-hosting */}
      <TerminalCard title={tc(lang, "fortress.self_hosting")} className="mb-6">
        <div className="space-y-4">
          <div>
            <div className="text-xs font-bold text-blood-bright mb-2">{tc(lang, "fortress.docker")}</div>
            <pre className="text-xs text-terminal-green bg-void border border-border-dim p-3 overflow-x-auto">{`# Clone the repository
git clone https://github.com/mouracleiton/v_for_vigilance
cd v_for_vigilance/v-for-x

# Build static site
npm install
npm run build

# Serve with any static file server
npx serve out/

# Or use Docker
docker build -t v-for-x .
docker run -p 8080:80 v-for-x`}</pre>
          </div>

          <div>
            <div className="text-xs font-bold text-blood-bright mb-2">{tc(lang, "fortress.raspberry_pi")}</div>
            <pre className="text-xs text-terminal-green bg-void border border-border-dim p-3 overflow-x-auto">{`# On the Pi (ARM64)
sudo apt install nodejs npm
git clone https://github.com/mouracleiton/v_for_vigilance
cd v_for_vigilance/v-for-x
npm install && npm run build

# Serve on local network
npx serve out/ -l 8080

# Access from any device on the same network:
# http://[PI-IP]:8080`}</pre>
          </div>

          <div>
            <div className="text-xs font-bold text-blood-bright mb-2">{tc(lang, "fortress.usb_sneakernet")}</div>
            <div className="text-xs text-content-secondary">
              Copy the <code className="text-blood">out/</code> directory to a USB drive.
              Open <code className="text-blood">index.html</code> in any browser.
              No internet required. Distribute physically. Works in areas with zero connectivity.
            </div>
          </div>
        </div>
      </TerminalCard>

      {/* Decentralized hosting */}
      <TerminalCard title={tc(lang, "card.decentralized_hosting")} className="mb-6">
        <div className="space-y-4">
          <div>
            <div className="text-xs font-bold text-blood-bright mb-2">{tc(lang, "fortress.ipfs")}</div>
            <pre className="text-xs text-terminal-green bg-void border border-border-dim p-3 overflow-x-auto">{`# Pin the build to IPFS
npm run build
npx thirdweb upload out/

# Or manually:
ipfs add -r out/
# Share the resulting CID. Anyone can access via:
# https://ipfs.io/ipfs/[YOUR-CID]/`}</pre>
            <p className="text-xs text-content-secondary mt-1">
              IPFS pinning ensures the content is available even if the original server goes down.
              Multiple pinners = multiple copies across the network.
            </p>
          </div>

          <div>
            <div className="text-xs font-bold text-blood-bright mb-2">{tc(lang, "fortress.tor")}</div>
            <pre className="text-xs text-terminal-green bg-void border border-border-dim p-3 overflow-x-auto">{`# Install Tor
sudo apt install tor

# Edit torrc
sudo nano /etc/tor/torrc

# Add:
HiddenServiceDir /var/lib/tor/v-for-x/
HiddenServicePort 80 127.0.0.1:8080

# Restart Tor
sudo systemctl restart tor

# Get your onion address
sudo cat /var/lib/tor/v-for-x/hostname`}</pre>
            <p className="text-xs text-content-secondary mt-1">
              The onion address makes the platform accessible from Tor Browser,
              bypassing DNS-level censorship and hiding the server's location.
            </p>
          </div>

          <div>
            <div className="text-xs font-bold text-blood-bright mb-2">{tc(lang, "fortress.mesh")}</div>
            <p className="text-xs text-content-secondary">
              Serve the static files from a device connected to a local mesh network
              (see Protocol X → Mesh Network blueprint). Anyone on the mesh can access it.
              Works in areas with no internet at all.
            </p>
          </div>
        </div>
      </TerminalCard>

      {/* Anti-censorship */}
      <TerminalCard title={tc(lang, "card.anti_censorship")} accent="amber" className="mb-6">
        <div className="space-y-3 text-xs">
          <div>
            <span className="text-blood-bright font-bold">{tc(lang, "fortress.domain_rotation")}</span>
            <span className="text-content-secondary">
              {" "}{tc(lang, "fortress.domain_rotation_desc")}
            </span>
          </div>
          <div>
            <span className="text-blood-bright font-bold">{tc(lang, "fortress.mirror_network")}</span>
            <span className="text-content-secondary">
              {" "}{tc(lang, "fortress.mirror_network_desc")}
            </span>
          </div>
          <div>
            <span className="text-blood-bright font-bold">{tc(lang, "fortress.accessing_restricted")}</span>
            <span className="text-content-secondary">
              {" "}{tc(lang, "fortress.accessing_restricted_desc")}
            </span>
          </div>
          <div>
            <span className="text-blood-bright font-bold">{tc(lang, "fortress.dead_drop_distribution")}</span>
            <span className="text-content-secondary">
              {" "}Physical USB distribution for areas with total internet blackout.
              See Protocol X → Dead Drop Protocol.
            </span>
          </div>
        </div>
      </TerminalCard>

      {/* Build from source */}
      <TerminalCard title={tc(lang, "card.build_source")}>
        <pre className="text-xs text-terminal-green bg-void border border-border-dim p-3 overflow-x-auto">{`# Requirements: Node.js 18+, npm
git clone https://github.com/mouracleiton/v_for_vigilance
cd v_for_vigilance/v-for-x

# Verify data integrity
sha256sum data/world_backbone.json

# Install dependencies
npm install

# Build static export
npm run build

# Output is in out/ — fully self-contained static site
# No external API calls. No tracking. Works offline.`}</pre>
        <p className="text-xs text-content-dim mt-3">
          {tc(lang, "fortress.cc0_notice")}
        </p>
      </TerminalCard>

      {/* Offline briefcase — crawl the platform into this device's cache */}
      <OfflineBriefcase />
    </div>
  );
}
