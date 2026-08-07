"use client";

import { useState, useEffect } from "react";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import { useStore } from "@/stores/useStore";
import { sound } from "@/lib/sound";

export default function TeiaPage() {
  const { identity, setIdentity, session, startSession } = useStore();
  const [channel, setChannel] = useState("#general");
  const [messages, setMessages] = useState<
    { id: number; author: string; text: string; ts: string }[]
  >([
    { id: 1, author: "V-3X2A-9B1C", text: "Coordinates confirmed. Drop point active for 6h. Password: [REDACTED].", ts: "14:32" },
    { id: 2, author: "V-7K2M-9F4A", text: "Medical supplies en route to sector 7. ETA 2 hours. Need escort.", ts: "14:35" },
    { id: 3, author: "V-1Z9X-4C5V", text: "Mesh network node online. 4 peers connected. Coverage extends 3km.", ts: "14:38" },
    { id: 4, author: "V-3X2A-9B1C", text: "Translated the Protocol X water purification guide to 3 local languages. Ready for distribution.", ts: "14:41" },
    { id: 5, author: "V-8B2N-6M1K", text: "Hotspot alert: Aid corridor blocked. See Mapa da Dor for details. Coordinating alternative routes via Trilha.", ts: "14:45" },
  ]);
  const [input, setInput] = useState("");
  const [deadDropLat, setDeadDropLat] = useState("");
  const [deadDropLng, setDeadDropLng] = useState("");
  const [deadDropMsg, setDeadDropMsg] = useState("");

  useEffect(() => {
    if (!session) startSession();
  }, [session, startSession]);

  const generateIdentity = async () => {
    if (typeof window === "undefined") return;
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const seg = (n: number) =>
      Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    const handle = `V-${seg(4)}-${seg(4)}`;

    try {
      const keyPair = await crypto.subtle.generateKey(
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["sign", "verify"]
      );
      const pubKey = await crypto.subtle.exportKey("raw", keyPair.publicKey);
      const pubKeyHex = Array.from(new Uint8Array(pubKey))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      setIdentity({
        handle,
        publicKey: pubKeyHex.slice(0, 32),
        createdAt: Date.now(),
      });
      sound.success();
    } catch {
      setIdentity({
        handle,
        publicKey: "simulated_key_" + Date.now(),
        createdAt: Date.now(),
      });
      sound.success();
    }
  };

  const sendMessage = () => {
    if (!input.trim() || !identity) return;
    setMessages((prev) => [
      ...prev,
      {
        id: prev.length + 1,
        author: identity.handle,
        text: input,
        ts: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
      },
    ]);
    setInput("");
    sound.select();
  };

  const plantDeadDrop = () => {
    if (!deadDropLat || !deadDropLng || !deadDropMsg || !identity) return;
    const lat = parseFloat(deadDropLat).toFixed(4);
    const lng = parseFloat(deadDropLng).toFixed(4);
    setMessages((prev) => [
      ...prev,
      {
        id: prev.length + 1,
        author: identity.handle,
        text: `[DEAD DROP] ${lat}, ${lng}: ${deadDropMsg.slice(0, 80)}`,
        ts: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
      },
    ]);
    setDeadDropLat("");
    setDeadDropLng("");
    setDeadDropMsg("");
    sound.success();
  };

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <div className="mb-8 pt-4">
        <div className="text-xs text-content-dim mb-1">[05] THE WEB</div>
        <h1 className="text-2xl md:text-3xl text-blood-bright font-bold glow-blood">
          THE WEB
        </h1>
        <p className="text-content-secondary text-sm mt-2">
          // Anonymous communication. No registration. No email. No phone. You are your key.
        </p>
      </div>

      {/* Identity panel */}
      <TerminalCard title="ANONYMOUS IDENTITY" className="mb-6">
        {identity ? (
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <div className="text-xs text-content-dim">YOUR HANDLE</div>
              <div className="text-lg text-terminal-green glow-green font-bold">{identity.handle}</div>
            </div>
            <div>
              <div className="text-xs text-content-dim">PUBLIC KEY (truncated)</div>
              <div className="text-xs text-content-secondary font-mono break-all">
                {identity.publicKey}...
              </div>
            </div>
            <StatusPill color="green">[STUB] ECDSA P-256</StatusPill>
            <button
              onClick={() => {
                setIdentity(null);
                sound.error();
              }}
              className="text-xs px-3 py-1 border border-blood text-blood hover:bg-blood hover:text-void ml-auto"
            >
              [ BURN IDENTITY ]
            </button>
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-sm text-content-secondary mb-4">
              No identity loaded. Generate a new anonymous identity to participate.
            </p>
            <button
              onClick={generateIdentity}
              className="px-4 py-2 text-sm border border-blood text-blood-bright hover:bg-blood hover:text-void"
            >
              [ GENERATE IDENTITY ]
            </button>
            <p className="text-xs text-content-dim mt-3">
              Your identity is a cryptographic keypair. It never leaves this device.
              No email, no phone, no registration. [STUB]
            </p>
          </div>
        )}
      </TerminalCard>

      {/* BBS Chat */}
      {identity && (
        <>
          <TerminalCard
            title={`P2P BBS — ${channel}`}
            className="mb-6"
          >
            <div className="flex gap-1 mb-3">
              {["#general", "#africa", "#asia", "#latam", "#crisis-response", "#mesh-net"].map((ch) => (
                <button
                  key={ch}
                  onClick={() => {
                    setChannel(ch);
                    sound.nav();
                  }}
                  className={`text-xs px-2 py-1 border transition-colors ${
                    channel === ch
                      ? "border-blood text-blood-bright"
                      : "border-border-dim text-content-dim hover:text-content-secondary"
                  }`}
                >
                  {ch}
                </button>
              ))}
            </div>

            <div className="h-80 overflow-y-auto bg-void border border-border-dim p-3 mb-3 space-y-1">
              {messages.map((m) => (
                <div key={m.id} className="text-xs flex items-start gap-2">
                  <span className="text-content-dim shrink-0">[{m.ts}]</span>
                  <span
                    className={`shrink-0 font-bold ${
                      m.author === identity.handle
                        ? "text-terminal-green"
                        : "text-blood-bright"
                    }`}
                  >
                    {m.author}:
                  </span>
                  <span className="text-content-primary break-words">{m.text}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  sound.keystroke();
                }}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="type your message..."
                className="flex-1 bg-void border border-border-dim px-3 py-2 text-xs text-content-primary focus:border-blood focus:outline-none"
              />
              <button
                onClick={sendMessage}
                className="px-4 py-2 text-xs border border-blood text-blood-bright hover:bg-blood hover:text-void"
              >
                [ SEND ]
              </button>
            </div>
            <div className="text-xs text-content-dim mt-2">
              [STUB] Messages are simulated. Production: WebRTC data channels via PeerJS. Ephemeral by default. Signed by your keypair.
            </div>
          </TerminalCard>

          {/* Dead drops */}
          <TerminalCard title="DEAD DROPS — GPS-COORDINATE MESSAGE DROPS" accent="amber" className="mb-6">
            <p className="text-xs text-content-secondary mb-4">
              Plant encrypted messages at geographic coordinates. Others within range can retrieve them.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
              <input
                type="number"
                step="0.0001"
                value={deadDropLat}
                onChange={(e) => setDeadDropLat(e.target.value)}
                placeholder="Latitude"
                className="bg-void border border-border-dim px-3 py-2 text-xs text-content-primary focus:border-blood focus:outline-none"
              />
              <input
                type="number"
                step="0.0001"
                value={deadDropLng}
                onChange={(e) => setDeadDropLng(e.target.value)}
                placeholder="Longitude"
                className="bg-void border border-border-dim px-3 py-2 text-xs text-content-primary focus:border-blood focus:outline-none"
              />
              <input
                type="text"
                value={deadDropMsg}
                onChange={(e) => setDeadDropMsg(e.target.value)}
                placeholder="Encrypted message..."
                className="bg-void border border-border-dim px-3 py-2 text-xs text-content-primary focus:border-blood focus:outline-none"
              />
            </div>
            <button
              onClick={plantDeadDrop}
              className="px-4 py-2 text-xs border border-border-dim text-content-secondary hover:border-blood hover:text-blood"
            >
              [ PLANT DEAD DROP ]
            </button>
            <div className="text-xs text-content-dim mt-2">
              [STUB] Coordinate-based message drops. Production: AES-GCM encrypted, TTL-configurable, proximity-gated retrieval.
            </div>
          </TerminalCard>
        </>
      )}
    </div>
  );
}
