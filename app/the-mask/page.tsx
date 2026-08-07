"use client";

import { useState, useEffect } from "react";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import { useStore } from "@/stores/useStore";
import { sound } from "@/lib/sound";

export default function MascaraPage() {
  const { identity, triggerDuress, isDuress, session, startSession } = useStore();
  const [duressCode, setDuressCode] = useState("");
  const [duressSet, setDuressSet] = useState(false);
  const [showDecoy, setShowDecoy] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>("opsec");

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
      <div className="p-10 max-w-3xl mx-auto">
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
    <div className="p-6 md:p-10 max-w-4xl mx-auto">
      <div className="mb-8 pt-4">
        <div className="text-xs text-content-dim mb-1">[08] THE MASK</div>
        <h1 className="text-2xl md:text-3xl text-blood-bright font-bold glow-blood">
          THE MASK
        </h1>
        <p className="text-content-secondary text-sm mt-2">
          // Identity protection. Operational security. You are invisible until you choose not to be.
        </p>
      </div>

      {/* Threat model */}
      <TerminalCard title="THREAT MODEL — WHAT WE PROTECT AGAINST" accent="amber" className="mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-dim text-content-dim">
                <th className="text-left py-2 px-2">ADVERSARY</th>
                <th className="text-left py-2 px-2">WHAT THEY WANT</th>
                <th className="text-left py-2 px-2">WHAT V FOR X DOES</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border-dim">
                <td className="py-2 px-2 text-blood-bright">Surveillance state</td>
                <td className="py-2 px-2 text-content-secondary">Identify and locate users</td>
                <td className="py-2 px-2 text-terminal-green">No registration, client-side crypto</td>
              </tr>
              <tr className="border-b border-border-dim">
                <td className="py-2 px-2 text-blood-bright">Network ISP</td>
                <td className="py-2 px-2 text-content-secondary">Track browsing patterns</td>
                <td className="py-2 px-2 text-terminal-green">All client-side, recommend Tor</td>
              </tr>
              <tr className="border-b border-border-dim">
                <td className="py-2 px-2 text-blood-bright">Platform operator</td>
                <td className="py-2 px-2 text-content-secondary">Correlate user activity</td>
                <td className="py-2 px-2 text-terminal-green">No operator — decentralized</td>
              </tr>
              <tr className="border-b border-border-dim">
                <td className="py-2 px-2 text-blood-bright">Physical attacker</td>
                <td className="py-2 px-2 text-content-secondary">Force disclosure</td>
                <td className="py-2 px-2 text-terminal-green">Duress codes, decoy interface</td>
              </tr>
              <tr className="border-b border-border-dim">
                <td className="py-2 px-2 text-blood-bright">Malicious peer</td>
                <td className="py-2 px-2 text-content-secondary">Impersonate or deceive</td>
                <td className="py-2 px-2 text-terminal-green">Keypair signatures, reputation</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-3 p-2 border border-blood-dim bg-panel text-xs text-blood">
          ⚠ LIMITATIONS: Does NOT protect against physical compromise with forensics,
          endpoint malware, or zero-day exploits. This is a tool, not a shield.
        </div>
      </TerminalCard>

      {/* ZK Identity */}
      <TerminalCard title="ZK IDENTITY SYSTEM" accent="green" className="mb-6">
        <p className="text-xs text-content-secondary mb-3">
          Prove attributes about yourself without revealing your identity. [STUB] — demonstrates the concept.
        </p>
        <div className="space-y-2">
          <div className="flex items-center justify-between p-2 terminal-card">
            <span className="text-xs text-content-primary">Claim: "I am in a hunger-affected country"</span>
            <StatusPill color="green">PROVABLE</StatusPill>
          </div>
          <div className="flex items-center justify-between p-2 terminal-card">
            <span className="text-xs text-content-primary">Claim: "I have reputation &gt; 5"</span>
            <StatusPill color="green">PROVABLE</StatusPill>
          </div>
          <div className="flex items-center justify-between p-2 terminal-card">
            <span className="text-xs text-content-primary">Claim: "I am a real human (not a bot)"</span>
            <StatusPill color="amber">[STUB] WEB OF TRUST</StatusPill>
          </div>
        </div>
        <div className="text-xs text-content-dim mt-3">
          [STUB] Production: ZK-SNARK proofs (e.g., Groth16 or PLONK). Prover generates proof from private inputs.
          Verifier checks without learning anything except the claim is true.
          Current implementation: hash commitments demonstrating the concept.
        </div>
      </TerminalCard>

      {/* Duress codes */}
      <TerminalCard title="DURESS CODES — PLAUSIBLE DENIABILITY" className="mb-6">
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
              placeholder="Enter duress code (memorize it)"
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
              [ ACTIVATE DURESS SYSTEM ]
            </button>
            <div className="text-xs text-content-dim">
              PANIC SHORTCUT (when activated): Ctrl+Shift+Delete — instant wipe + decoy.
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <StatusPill color="green">DURESS SYSTEM ACTIVE</StatusPill>
              <span className="text-xs text-content-secondary">Panic shortcut: Ctrl+Shift+Delete</span>
            </div>
            <button
              onClick={() => {
                triggerDuress();
                setShowDecoy(true);
              }}
              className="px-4 py-2 text-xs border border-blood text-blood hover:bg-blood"
            >
              [ TEST DURESS WIPE ]
            </button>
            <p className="text-xs text-content-dim">
              This will wipe all local data and show the decoy interface.
            </p>
          </div>
        )}
      </TerminalCard>

      {/* Session management */}
      <TerminalCard title="SESSION MANAGEMENT" className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            {session ? (
              <span className="text-xs text-terminal-green">
                ● SESSION ACTIVE — Started {new Date(session.startTime).toLocaleTimeString()}
              </span>
            ) : (
              <span className="text-xs text-content-dim">○ No active session</span>
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
          [ PANIC — WIPE EVERYTHING ]
        </button>
        <p className="text-xs text-content-dim mt-2">
          Clears localStorage, deletes IndexedDB, destroys session and identity.
        </p>
      </TerminalCard>

      {/* OpSec Guide */}
      <TerminalCard title="OPSEC GUIDE — COMPREHENSIVE">
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
            <p>▸ Your browser fingerprint (canvas, fonts, plugins, screen size) is nearly unique. Tor Browser standardizes this.</p>
            <p>▸ If Tor is unavailable: use a hardened Firefox with Privacy Badger, uBlock Origin, and NoScript. Set privacy.strict to maximum.</p>
            <p>▸ Never use your personal browser for sensitive activity. Use a dedicated browser profile or separate device.</p>
            <p>▸ Clear cookies on close. Disable third-party cookies entirely. Use container tabs to isolate sessions.</p>
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
            <p>▸ Social engineering is the #1 attack vector. Humans are the weakest link.</p>
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
