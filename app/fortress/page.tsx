import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";

export default function FortalezaPage() {
  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-4xl mx-auto">
      <div className="mb-8 pt-4">
        <div className="text-xs text-content-dim mb-1">[07] THE FORTRESS</div>
        <h1 className="text-2xl md:text-3xl text-blood-bright font-bold glow-blood">
          THE FORTRESS
        </h1>
        <p className="text-content-secondary text-sm mt-2">
          // If this platform goes dark, 10 others light up. Cut one head, two grow back.
        </p>
      </div>

      {/* Hydra Nodes */}
      <TerminalCard title="HYDRA NODES — DISTRIBUTED ARCHITECTURE" glow className="mb-6">
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
          <StatusPill color="green">ACTIVE</StatusPill>
          <StatusPill color="dim">NODES: 1 (this one)</StatusPill>
          <StatusPill color="dim">MIRRORS: 0</StatusPill>
        </div>
      </TerminalCard>

      {/* Self-hosting */}
      <TerminalCard title="SELF-HOSTING — RUN A NODE" className="mb-6">
        <div className="space-y-4">
          <div>
            <div className="text-xs font-bold text-blood-bright mb-2">DOCKER</div>
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
            <div className="text-xs font-bold text-blood-bright mb-2">RASPBERRY PI</div>
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
            <div className="text-xs font-bold text-blood-bright mb-2">USB SNEAKERNET (OFFLINE DISTRIBUTION)</div>
            <div className="text-xs text-content-secondary">
              Copy the <code className="text-blood">out/</code> directory to a USB drive.
              Open <code className="text-blood">index.html</code> in any browser.
              No internet required. Distribute physically. Works in areas with zero connectivity.
            </div>
          </div>
        </div>
      </TerminalCard>

      {/* Decentralized hosting */}
      <TerminalCard title="DECENTRALIZED HOSTING" className="mb-6">
        <div className="space-y-4">
          <div>
            <div className="text-xs font-bold text-blood-bright mb-2">IPFS</div>
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
            <div className="text-xs font-bold text-blood-bright mb-2">TOR HIDDEN SERVICE</div>
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
            <div className="text-xs font-bold text-blood-bright mb-2">LOCAL MESH NETWORK</div>
            <p className="text-xs text-content-secondary">
              Serve the static files from a device connected to a local mesh network
              (see Protocol X → Mesh Network blueprint). Anyone on the mesh can access it.
              Works in areas with no internet at all.
            </p>
          </div>
        </div>
      </TerminalCard>

      {/* Anti-censorship */}
      <TerminalCard title="ANTI-CENSORSHIP TOOLKIT" accent="amber" className="mb-6">
        <div className="space-y-3 text-xs">
          <div>
            <span className="text-blood-bright font-bold">DOMAIN ROTATION:</span>
            <span className="text-content-secondary">
              {" "}Register multiple domains in different jurisdictions. If one is seized, traffic redirects automatically.
            </span>
          </div>
          <div>
            <span className="text-blood-bright font-bold">MIRROR NETWORK:</span>
            <span className="text-content-secondary">
              {" "}Volunteers host identical copies. A shared list of mirrors is distributed via the platform itself.
            </span>
          </div>
          <div>
            <span className="text-blood-bright font-bold">ACCESSING FROM RESTRICTED NETWORKS:</span>
            <span className="text-content-secondary">
              {" "}Use Tor Browser, VPNs, or proxy chains. The Tor hidden service address is shared through trusted channels.
            </span>
          </div>
          <div>
            <span className="text-blood-bright font-bold">DEAD DROP DISTRIBUTION:</span>
            <span className="text-content-secondary">
              {" "}Physical USB distribution for areas with total internet blackout.
              See Protocol X → Dead Drop Protocol.
            </span>
          </div>
        </div>
      </TerminalCard>

      {/* Build from source */}
      <TerminalCard title="BUILD FROM SOURCE — VERIFY INTEGRITY">
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
          This project is CC0 (Public Domain). Fork it, modify it, redistribute it. You are the infrastructure.
        </p>
      </TerminalCard>
    </div>
  );
}
