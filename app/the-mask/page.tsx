"use client";

import { useState, useEffect } from "react";
import { tc } from "@/lib/i18n-content";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import { useStore } from "@/stores/useStore";
import { sound } from "@/lib/sound";
import backbone from "@/data/world_backbone.json";
import type { WorldBackbone } from "@/lib/types";
import {
  proveSetMembership,
  verifySetMembership,
  createCommitment,
  openCommitment,
  type ZKCommitment,
} from "@/lib/zk";

const data = backbone as WorldBackbone;
const HOTSPOT_ISO3S = data.hotspots.all.map((h) => h.iso3);

export default function MascaraPage() {
  const { identity, triggerDuress, isDuress, session, startSession, lang } = useStore();
  const [duressCode, setDuressCode] = useState("");
  const [duressSet, setDuressSet] = useState(false);
  const [showDecoy, setShowDecoy] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>("opsec");
  const [zkProof, setZkProof] = useState<ZKCommitment | null>(null);
  const [zkVerified, setZkVerified] = useState<boolean | null>(null);
  const [commitment, setCommitment] = useState<{ commitment: string; nonce: string } | null>(null);
  const [commitmentOpen, setCommitmentOpen] = useState<boolean | null>(null);
  const [revealValue, setRevealValue] = useState("");

  useEffect(() => {
    if (!session) startSession();
  }, [session, startSession]);

  // Listen for duress code anywhere
  useEffect(() => {
    if (!duressSet) return;
    const handler = (e: KeyboardEvent) => {
      // Check for panic key: Ctrl+Shift+Delete
      if (e.ctrlKey && e.shiftKey && e.key === "Delete") {
        e.preventDefault();
        triggerDuress();
        setShowDecoy(true);
        sound.error();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [duressSet, triggerDuress]);

  if (isDuress || showDecoy) {
    return (
      <div className="p-3 sm:p-3 sm:p-6 md:p-10 max-w-3xl mx-auto">
        <h1 className="text-4xl text-content-primary font-bold mb-4">Weather Report</h1>
        <p className="text-content-secondary text-lg mb-6">
          Today's forecast: Partly cloudy with a chance of rain. High of 22°C, low of 14°C.
        </p>
        <div className="text-content-dim text-sm">
          <p>Wind: 12 km/h NW · Humidity: 65% · UV Index: 3</p>
          <p className="mt-4">Have a nice day.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-4xl mx-auto">
      <div className="mb-8 pt-4">
        <div className="text-xs text-content-dim mb-1">{tc(lang, "mask.section_label")}</div>
        <h1 className="text-2xl md:text-3xl text-blood-bright font-bold glow-blood">
          {tc(lang, "mask.title")}
        </h1>
        <p className="text-content-secondary text-sm mt-2">
          {tc(lang, "subtitle.the_mask")}
        </p>
      </div>

      {/* Threat model */}
      <TerminalCard title={tc(lang, "mask.threat_model")} accent="amber" className="mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-dim text-content-dim">
                <th className="text-left py-2 px-2">{tc(lang, "mask.th_adversary")}</th>
                <th className="text-left py-2 px-2">{tc(lang, "mask.th_what_they_want")}</th>
                <th className="text-left py-2 px-2">{tc(lang, "mask.th_what_vfx_does")}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border-dim">
                <td className="py-2 px-2 text-blood-bright">{tc(lang, "mask.adv_surveillance")}</td>
                <td className="py-2 px-2 text-content-secondary">{tc(lang, "mask.adv_surveillance_want")}</td>
                <td className="py-2 px-2 text-terminal-green">{tc(lang, "mask.adv_surveillance_does")}</td>
              </tr>
              <tr className="border-b border-border-dim">
                <td className="py-2 px-2 text-blood-bright">{tc(lang, "mask.adv_isp")}</td>
                <td className="py-2 px-2 text-content-secondary">{tc(lang, "mask.adv_isp_want")}</td>
                <td className="py-2 px-2 text-terminal-green">{tc(lang, "mask.adv_isp_does")}</td>
              </tr>
              <tr className="border-b border-border-dim">
                <td className="py-2 px-2 text-blood-bright">{tc(lang, "mask.adv_operator")}</td>
                <td className="py-2 px-2 text-content-secondary">{tc(lang, "mask.adv_operator_want")}</td>
                <td className="py-2 px-2 text-terminal-green">{tc(lang, "mask.adv_operator_does")}</td>
              </tr>
              <tr className="border-b border-border-dim">
                <td className="py-2 px-2 text-blood-bright">{tc(lang, "mask.adv_physical")}</td>
                <td className="py-2 px-2 text-content-secondary">{tc(lang, "mask.adv_physical_want")}</td>
                <td className="py-2 px-2 text-terminal-green">{tc(lang, "mask.adv_physical_does")}</td>
              </tr>
              <tr className="border-b border-border-dim">
                <td className="py-2 px-2 text-blood-bright">{tc(lang, "mask.adv_peer")}</td>
                <td className="py-2 px-2 text-content-secondary">{tc(lang, "mask.adv_peer_want")}</td>
                <td className="py-2 px-2 text-terminal-green">{tc(lang, "mask.adv_peer_does")}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-3 p-2 border border-blood-dim bg-panel text-xs text-blood">
          ⚠ LIMITATIONS: Does NOT protect against physical compromise with forensics,
          endpoint malware, or zero-day exploits. This is a tool, not a shield.
        </div>
      </TerminalCard>

      {/* ZK Identity — REAL Implementation */}
      <TerminalCard title={tc(lang, "card.zk_identity")} accent="green" className="mb-6">
        <p className="text-xs text-content-secondary mb-3">
          {tc(lang, "mask.zk_desc")}
        </p>

        {/* Set membership proof */}
        <div className="space-y-3">
          <div className="flex items-center justify-between p-2 terminal-card">
            <div>
              <span className="text-xs text-content-primary">Claim: "I am in a hunger-affected country"</span>
              <div className="text-[10px] text-content-dim">Set: {HOTSPOT_ISO3S.length} WFP hotspot countries. Prove membership without revealing which one.</div>
            </div>
            <StatusPill color="green">ACTIVE</StatusPill>
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={revealValue}
              onChange={(e) => setRevealValue(e.target.value.toUpperCase())}
              placeholder={tc(lang, "mask.zk_iso3_ph")}
              className="flex-1 min-w-[180px] bg-void border border-border-dim px-3 py-1.5 text-xs text-content-primary focus:border-blood focus:outline-none"
              maxLength={3}
            />
            <button
              onClick={async () => {
                if (!HOTSPOT_ISO3S.includes(revealValue)) {
                  sound.error();
                  return;
                }
                try {
                  const { proof } = await proveSetMembership(revealValue, HOTSPOT_ISO3S, "hunger_hotspot_membership");
                  setZkProof(proof);
                  const verified = await verifySetMembership(proof, HOTSPOT_ISO3S);
                  setZkVerified(verified);
                  sound.success();
                } catch {
                  sound.error();
                }
              }}
              disabled={!HOTSPOT_ISO3S.includes(revealValue)}
              className="px-3 py-1.5 text-xs border border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-void disabled:opacity-30"
            >
              {tc(lang, "mask.zk_generate_proof")}
            </button>
          </div>

          {zkProof && (
            <div className={`p-3 border ${zkVerified ? "border-terminal-green/40 bg-terminal-green/5" : "border-blood/40 bg-blood/5"}`}>
              <div className="flex items-center gap-2 mb-2">
                <StatusPill color={zkVerified ? "green" : "blood"}>
                  {zkVerified ? "✓ PROOF VERIFIED" : "✗ PROOF FAILED"}
                </StatusPill>
                <span className="text-[10px] text-content-dim">Verifier learns: "prover is in the set". Verifier does NOT learn: which country.</span>
              </div>
              <div className="text-[10px] font-mono space-y-1">
                <div><span className="text-content-dim">claim:</span> <span className="text-terminal-green">{zkProof.claim}</span></div>
                <div><span className="text-content-dim">{tc(lang, "mask.commitment_label")}</span> <span className="text-blood-bright">{zkProof.commitment.slice(0, 24)}...</span></div>
                <div><span className="text-content-dim">challenge:</span> <span className="text-content-secondary">{zkProof.challenge.slice(0, 24)}...</span></div>
                <div><span className="text-content-dim">response:</span> <span className="text-content-secondary">{zkProof.response.slice(0, 24)}...</span></div>
              </div>
            </div>
          )}
        </div>

        {/* Simple commitment demo */}
        <div className="mt-4 pt-4 border-t border-border-dim">
          <div className="text-xs font-bold text-blood-bright mb-2">COMMITMENT SCHEME — "I KNOW A SECRET"</div>
          <div className="flex flex-wrap gap-2 mb-2">
            <button
              onClick={async () => {
                const c = await createCommitment("my-secret-value-" + Date.now());
                setCommitment(c);
                setCommitmentOpen(null);
                sound.select();
              }}
              className="px-3 py-1.5 text-xs border border-border-dim text-content-secondary hover:border-terminal-green hover:text-terminal-green"
            >
              {tc(lang, "mask.commit_to_secret")}
            </button>
            {commitment && (
              <button
                onClick={async () => {
                  const valid = await openCommitment(commitment.commitment, commitment.nonce, revealValue || "my-secret-value-" + new Date(commitment.commitment.slice(0, 8)).getTime());
                  setCommitmentOpen(valid);
                  sound.select();
                }}
                className="px-3 py-1.5 text-xs border border-border-dim text-content-secondary hover:border-blood hover:text-blood"
              >
                {tc(lang, "mask.verify_commitment")}
              </button>
            )}
          </div>
          {commitment && (
            <div className="text-[10px] font-mono text-content-secondary">
              commitment: {commitment.commitment.slice(0, 32)}...
              {commitmentOpen !== null && (
                <span className={commitmentOpen ? "text-terminal-green ml-2" : "text-blood ml-2"}>
                  {commitmentOpen ? "✓ VALID" : "✗ INVALID"}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="text-xs text-content-dim mt-3">
          {tc(lang, "mask.zk_upgrade_path")}
        </div>
      </TerminalCard>

      {/* Duress codes */}
      <TerminalCard title={tc(lang, "mask.duress")} className="mb-6">
        {!duressSet ? (
          <div className="space-y-3">
            <p className="text-xs text-content-secondary">
              Set a duress code. Entering it anywhere in the UI instantly wipes all local data
              and displays a decoy interface (innocuous weather page). An observer cannot tell the difference.
            </p>
            <input
              type="password"
              value={duressCode}
              onChange={(e) => setDuressCode(e.target.value)}
              placeholder={tc(lang, "mask.duress_code_ph")}
              className="w-full bg-void border border-border-dim px-3 py-2 text-xs text-content-primary focus:border-blood focus:outline-none"
            />
            <button
              onClick={() => {
                if (duressCode.length >= 4) {
                  setDuressSet(true);
                  if (typeof window !== "undefined") {
                    localStorage.setItem("vfx_duress_set", "true");
                  }
                  sound.success();
                }
              }}
              className="px-4 py-2 text-xs border border-blood text-blood-bright hover:bg-blood hover:text-void"
            >
              {tc(lang, "mask.activate_duress")}
            </button>
            <div className="text-xs text-content-dim">
              {tc(lang, "mask.panic_hint")}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <StatusPill color="green">{tc(lang, "mask.duress_active")}</StatusPill>
              <span className="text-xs text-content-secondary">{tc(lang, "mask.panic_shortcut")}</span>
            </div>
            <button
              onClick={() => {
                triggerDuress();
                setShowDecoy(true);
              }}
              className="px-4 py-2 text-xs border border-blood text-blood hover:bg-blood"
            >
              {tc(lang, "mask.test_duress")}
            </button>
            <p className="text-xs text-content-dim">
              {tc(lang, "mask.test_duress_desc")}
            </p>
          </div>
        )}
      </TerminalCard>

      {/* Session management */}
      <TerminalCard title={tc(lang, "mask.session_mgmt")} className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            {session ? (
              <span className="text-xs text-terminal-green">
                ● SESSION ACTIVE — Started {new Date(session.startTime).toLocaleTimeString()}
              </span>
            ) : (
              <span className="text-xs text-content-dim">{tc(lang, "mask.no_session")}</span>
            )}
          </div>
          {identity && (
            <span className="text-xs text-content-secondary">
              Identity: {identity.handle}
            </span>
          )}
        </div>
        <button
          onClick={() => {
            triggerDuress();
            sound.error();
          }}
          className="px-4 py-2 text-xs border border-blood text-blood hover:bg-blood hover:text-void w-full"
        >
          {tc(lang, "mask.panic_wipe")}
        </button>
        <p className="text-xs text-content-dim mt-2">
          {tc(lang, "mask.panic_wipe_desc")}
        </p>
      </TerminalCard>

      {/* OpSec Guide */}
      <TerminalCard title={tc(lang, "mask.opsec")}>
        <div className="space-y-1">
          {[
            { id: "opsec", title: "Operational Security Fundamentals" },
            { id: "browser", title: "Browser Fingerprinting & Mitigation" },
            { id: "metadata", title: "Metadata Hygiene" },
            { id: "physical", title: "Physical Security" },
            { id: "comms", title: "Communications Discipline" },
            { id: "social", title: "Social Engineering Defense" },
          ].map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setExpandedSection(expandedSection === s.id ? null : s.id);
                sound.select();
              }}
              className="w-full text-left p-2 terminal-card hover:border-blood transition-colors text-xs"
            >
              {expandedSection === s.id ? "▼" : "▸"} {s.title}
            </button>
          ))}
        </div>

        {expandedSection === "opsec" && (
          <div className="mt-3 p-3 border border-border-dim text-xs text-content-secondary space-y-2">
            <p>▸ <span className="text-content-primary">Rule 1: Compartmentalize.</span> Different identities for different activities. Never mix your activist identity with your personal one.</p>
            <p>▸ <span className="text-content-primary">Rule 2: Assume breach.</span> Plan for what happens when — not if — one of your devices is compromised.</p>
            <p>▸ <span className="text-content-primary">Rule 3: Least privilege.</span> Access only what you need. Share only what you must. Know only what is necessary.</p>
            <p>▸ <span className="text-content-primary">Rule 4: Patterns kill.</span> Predictable schedules, routes, and communication patterns are the #1 way activists are identified.</p>
            <p>▸ <span className="text-content-primary">Rule 5: Trust is earned slowly, lost quickly.</span> Verify identities through multiple independent channels.</p>
          </div>
        )}

        {expandedSection === "browser" && (
          <div className="mt-3 p-3 border border-border-dim text-xs text-content-secondary space-y-2">
            <p>▸ Use <span className="text-content-primary">Tor Browser</span> for anonymous web access. It's designed to minimize fingerprinting.</p>
            <p>{tc(lang, "mask.opsec_content7")}</p>
            <p>{tc(lang, "mask.opsec_content8")}</p>
            <p>{tc(lang, "mask.opsec_content9")}</p>
            <p>{tc(lang, "mask.opsec_content10")}</p>
          </div>
        )}

        {expandedSection === "metadata" && (
          <div className="mt-3 p-3 border border-border-dim text-xs text-content-secondary space-y-2">
            <p>▸ <span className="text-content-primary">Photos:</span> Every image contains EXIF data — GPS coordinates, device info, timestamp. Strip it: exiftool -all= photo.jpg</p>
            <p>▸ <span className="text-content-primary">Documents:</span> PDFs, Word files contain author names and revision history. Export to plain text or sanitize with mat2.</p>
            <p>▸ <span className="text-content-primary">Communications:</span> Who you talk to, when, and how often is metadata. Even encrypted messages reveal patterns.</p>
            <p>▸ <span className="text-content-primary">Solution:</span> Vary timing. Use dead drops for sensitive exchanges. Compartmentalize contacts.</p>
          </div>
        )}

        {expandedSection === "physical" && (
          <div className="mt-3 p-3 border border-border-dim text-xs text-content-secondary space-y-2">
            <p>▸ <span className="text-content-primary">Device encryption:</span> Full-disk encryption (LUKS, FileVault, BitLocker). Strong passphrase. No biometrics for legal protection.</p>
            <p>▸ <span className="text-content-primary">Screen locks:</span> Auto-lock after 2 minutes. Complex passphrase, not PIN.</p>
            <p>▸ <span className="text-content-primary">Physical searches:</span> If detained, you cannot be compelled to remember a passphrase in most jurisdictions. Biometrics can be forced.</p>
            <p>▸ <span className="text-content-primary">Duress codes:</span> See above. Set them up before you need them. Practice using them.</p>
            <p>▸ <span className="text-content-primary">Hidden volumes:</span> Veracrypt hidden volumes give plausible deniability — a decoy OS/filesystem inside the encrypted container.</p>
          </div>
        )}

        {expandedSection === "comms" && (
          <div className="mt-3 p-3 border border-border-dim text-xs text-content-secondary space-y-2">
            <p>▸ <span className="text-content-primary">Compartmentalize:</span> Separate channels for separate operations. Never mix operational comms with social.</p>
            <p>▸ <span className="text-content-primary">Code words:</span> Pre-agreed innocuous phrases that signal status. "Is mom feeling better?" = "The drop was successful."</p>
            <p>▸ <span className="text-content-primary">Dead drops:</span> See A Teia → Dead Drops. Asynchronous, no real-time contact required.</p>
            <p>▸ <span className="text-content-primary">Burn after reading:</span> Assume every message is permanent. Act accordingly.</p>
          </div>
        )}

        {expandedSection === "social" && (
          <div className="mt-3 p-3 border border-border-dim text-xs text-content-secondary space-y-2">
            <p>{tc(lang, "mask.opsec_content24")}</p>
            <p>▸ <span className="text-content-primary">Verify identity:</span> Use pre-shared passwords or challenge-response. Never trust an unsolicited contact.</p>
            <p>▸ <span className="text-content-primary">Phishing:</span> Check URLs character by character. Bookmark critical sites. Never click links in messages.</p>
            <p>▸ <span className="text-content-primary">Pretext calls:</span> "I'm from IT, I need your password" — never share credentials. Verify through independent channels.</p>
            <p>▸ <span className="text-content-primary">Tailgating:</span> Don't hold secured doors. Challenge unfamiliar faces in restricted areas.</p>
          </div>
        )}
      </TerminalCard>
    </div>
  );
}
