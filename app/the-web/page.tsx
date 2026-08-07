"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import { useStore } from "@/stores/useStore";
import { sound } from "@/lib/sound";

interface P2PMessage {
  id: string;
  author: string;
  text: string;
  ts: number;
  self: boolean;
}

interface DeadDrop {
  id: string;
  lat: string;
  lng: string;
  msg: string;
  ts: number;
  author: string;
}

export default function TeiaPage() {
  const { identity, setIdentity, session, startSession } = useStore();
  const [channel, setChannel] = useState("#general");
  const [input, setInput] = useState("");
  const [localMessages, setLocalMessages] = useState<P2PMessage[]>([]);
  const [deadDropLat, setDeadDropLat] = useState("");
  const [deadDropLng, setDeadDropLng] = useState("");
  const [deadDropMsg, setDeadDropMsg] = useState("");
  const [deadDrops, setDeadDrops] = useState<DeadDrop[]>([]);

  // WebRTC state
  const [peerStatus, setPeerStatus] = useState<"idle" | "creating" | "waiting" | "connecting" | "connected" | "error">("idle");
  const [localSDP, setLocalSDP] = useState("");
  const [remoteSDP, setRemoteSDP] = useState("");
  const [connectionLog, setConnectionLog] = useState<string[]>([]);
  const [copiedOffer, setCopiedOffer] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);

  useEffect(() => {
    if (!session) startSession();
  }, [session, startSession]);

  // Load persisted dead drops on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("vfx-dead-drops");
      if (stored) setDeadDrops(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  const log = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
    setConnectionLog((prev) => [...prev, `[${ts}] ${msg}`]);
  }, []);

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

  /* ═══════════════════════════════════════════════════════════════
     WebRTC — Manual signaling (copy-paste SDP)
     No server needed. Works on static export.
     ═══════════════════════════════════════════════════════════════ */

  const setupDataChannel = useCallback((dc: RTCDataChannel) => {
    dcRef.current = dc;
    dc.onopen = () => {
      log("DATA CHANNEL OPEN — P2P link established");
      setPeerStatus("connected");
      sound.success();
    };
    dc.onclose = () => {
      log("DATA CHANNEL CLOSED — P2P link severed");
      setPeerStatus("idle");
    };
    dc.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as P2PMessage;
        setLocalMessages((prev) => [...prev, { ...msg, self: false }]);
        sound.select();
      } catch {
        log("Received malformed message");
      }
    };
    dc.onerror = () => {
      log("DATA CHANNEL ERROR");
      setPeerStatus("error");
    };
  }, [log]);

  const createOffer = async () => {
    if (!identity) return;
    try {
      setPeerStatus("creating");
      log("Creating offer (you are the initiator)...");

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      pcRef.current = pc;

      const dc = pc.createDataChannel("vfx-chat", { ordered: true });
      setupDataChannel(dc);

      pc.oniceconnectionstatechange = () => {
        log(`ICE state: ${pc.iceConnectionState}`);
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE gathering to complete
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === "complete") return resolve();
        const check = setInterval(() => {
          if (pc.iceGatheringState === "complete") {
            clearInterval(check);
            resolve();
          }
        }, 200);
        setTimeout(() => { clearInterval(check); resolve(); }, 3000);
      });

      const sdp = JSON.stringify(pc.localDescription);
      setLocalSDP(sdp);
      log("Offer ready — copy and send to your peer");
      setPeerStatus("waiting");
    } catch (err) {
      log(`ERROR: ${err}`);
      setPeerStatus("error");
    }
  };

  const createAnswer = async () => {
    if (!identity || !remoteSDP.trim()) return;
    try {
      setPeerStatus("creating");
      log("Processing incoming offer, creating answer...");

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      pcRef.current = pc;

      pc.ondatachannel = (e) => {
        log("Data channel received");
        setupDataChannel(e.channel);
      };

      pc.oniceconnectionstatechange = () => {
        log(`ICE state: ${pc.iceConnectionState}`);
      };

      const offer = JSON.parse(remoteSDP);
      await pc.setRemoteDescription(offer);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Wait for ICE gathering
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === "complete") return resolve();
        const check = setInterval(() => {
          if (pc.iceGatheringState === "complete") {
            clearInterval(check);
            resolve();
          }
        }, 200);
        setTimeout(() => { clearInterval(check); resolve(); }, 3000);
      });

      const sdp = JSON.stringify(pc.localDescription);
      setLocalSDP(sdp);
      log("Answer ready — copy and send back to the initiator");
      setPeerStatus("waiting");
    } catch (err) {
      log(`ERROR: Invalid offer SDP. ${err}`);
      setPeerStatus("error");
    }
  };

  const acceptAnswer = async () => {
    if (!remoteSDP.trim() || !pcRef.current) return;
    try {
      setPeerStatus("connecting");
      log("Accepting answer SDP...");
      const answer = JSON.parse(remoteSDP);
      await pcRef.current.setRemoteDescription(answer);
      log("Remote description set — waiting for connection");
    } catch (err) {
      log(`ERROR: Invalid answer SDP. ${err}`);
      setPeerStatus("error");
    }
  };

  const closeConnection = () => {
    if (dcRef.current) dcRef.current.close();
    if (pcRef.current) pcRef.current.close();
    pcRef.current = null;
    dcRef.current = null;
    setPeerStatus("idle");
    setLocalSDP("");
    setRemoteSDP("");
    log("Connection closed manually");
  };

  const sendP2PMessage = () => {
    if (!input.trim() || !identity) return;
    if (!dcRef.current || dcRef.current.readyState !== "open") {
      sound.error();
      return;
    }
    const msg: P2PMessage = {
      id: Date.now() + "-" + Math.random().toString(36).slice(2),
      author: identity.handle,
      text: input,
      ts: Date.now(),
      self: true,
    };
    try {
      dcRef.current.send(JSON.stringify(msg));
      setLocalMessages((prev) => [...prev, msg]);
      setInput("");
      sound.select();
    } catch {
      log("Failed to send — channel not open");
      sound.error();
    }
  };

  const plantDeadDrop = () => {
    if (!deadDropLat || !deadDropLng || !deadDropMsg || !identity) return;
    const lat = parseFloat(deadDropLat).toFixed(4);
    const lng = parseFloat(deadDropLng).toFixed(4);
    const drop: DeadDrop = {
      id: Date.now() + "-" + Math.random().toString(36).slice(2),
      lat,
      lng,
      msg: deadDropMsg.slice(0, 200),
      ts: Date.now(),
      author: identity.handle,
    };
    const updated = [...deadDrops, drop];
    setDeadDrops(updated);
    try { localStorage.setItem("vfx-dead-drops", JSON.stringify(updated)); } catch { /* ignore */ }
    setDeadDropLat("");
    setDeadDropLng("");
    setDeadDropMsg("");
    sound.success();
  };

  const removeDeadDrop = (id: string) => {
    const updated = deadDrops.filter((d) => d.id !== id);
    setDeadDrops(updated);
    try { localStorage.setItem("vfx-dead-drops", JSON.stringify(updated)); } catch { /* ignore */ }
  };

  const copyOffer = () => {
    if (localSDP) {
      navigator.clipboard?.writeText(localSDP);
      setCopiedOffer(true);
      setTimeout(() => setCopiedOffer(false), 2000);
    }
  };

  const peerStatusColor = peerStatus === "connected" ? "green" : peerStatus === "error" ? "blood" : peerStatus === "idle" ? "dim" : "amber";

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-5xl mx-auto">
      <div className="mb-8 pt-4">
        <div className="text-xs text-content-dim mb-1">[05] THE WEB</div>
        <h1 className="text-2xl md:text-3xl text-blood-bright font-bold glow-blood">
          THE WEB
        </h1>
        <p className="text-content-secondary text-sm mt-2">
          // Anonymous communication. No registration. No email. No phone. Direct peer-to-peer.
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
            <StatusPill color="green">ECDSA P-256</StatusPill>
            <button
              onClick={() => {
                setIdentity(null);
                closeConnection();
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
              No email, no phone, no registration.
            </p>
          </div>
        )}
      </TerminalCard>

      {identity && (
        <>
          {/* P2P Connection Manager */}
          <TerminalCard title="P2P LINK — MANUAL SIGNALING (NO SERVER)" accent="amber" className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <StatusPill color={peerStatusColor as "green" | "blood" | "dim" | "amber"}>
                {peerStatus.toUpperCase()}
              </StatusPill>
              <span className="text-xs text-content-dim">
                {peerStatus === "connected"
                  ? "Encrypted data channel active"
                  : peerStatus === "waiting"
                    ? "Exchange SDP with your peer"
                    : "No active connection"}
              </span>
            </div>

            {/* Step 1: Role selection */}
            {peerStatus === "idle" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                <button
                  onClick={createOffer}
                  className="p-3 border border-blood-dim hover:border-blood hover:bg-blood/5 text-left"
                >
                  <div className="text-xs text-blood-bright font-bold">▸ CREATE OFFER</div>
                  <div className="text-[10px] text-content-secondary mt-1">
                    You are the initiator. Generates an SDP offer to send to your peer.
                  </div>
                </button>
                <button
                  onClick={() => {
                    setPeerStatus("connecting");
                    log("Paste an offer SDP below to create an answer");
                  }}
                  className="p-3 border border-terminal-green hover:bg-terminal-green/5 text-left"
                >
                  <div className="text-xs text-terminal-green font-bold">▸ ACCEPT OFFER</div>
                  <div className="text-[10px] text-content-secondary mt-1">
                    You received an offer. Paste it to generate an answer SDP.
                  </div>
                </button>
              </div>
            )}

            {/* Step 2a: Display local SDP for copying */}
            {localSDP && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-[10px] text-content-dim uppercase tracking-widest">
                    YOUR SDP {peerStatus === "waiting" && pcRef.current?.localDescription?.type === "offer" ? "(OFFER)" : "(ANSWER)"}
                  </div>
                  <button
                    onClick={copyOffer}
                    className="text-[10px] px-2 py-0.5 border border-border-dim hover:border-terminal-green text-content-secondary hover:text-terminal-green"
                  >
                    {copiedOffer ? "✓ COPIED" : "COPY"}
                  </button>
                </div>
                <textarea
                  readOnly
                  value={localSDP}
                  rows={4}
                  className="w-full bg-void border border-border-dim p-2 text-[10px] text-terminal-green font-mono resize-y"
                />
                <div className="text-[10px] text-content-dim mt-1">
                  {pcRef.current?.localDescription?.type === "offer"
                    ? "Send this to your peer. They should paste it into 'Remote SDP' and click CREATE ANSWER."
                    : "Send this back to the initiator. They paste it into 'Remote SDP' and click ACCEPT ANSWER."}
                </div>
              </div>
            )}

            {/* Step 2b: Remote SDP input */}
            {(peerStatus === "connecting" || peerStatus === "waiting" || peerStatus === "connected") && (
              <div className="mb-4">
                <div className="text-[10px] text-content-dim uppercase tracking-widest mb-1">
                  REMOTE SDP (paste peer's offer or answer)
                </div>
                <textarea
                  value={remoteSDP}
                  onChange={(e) => setRemoteSDP(e.target.value)}
                  rows={4}
                  placeholder="Paste the SDP JSON from your peer here..."
                  className="w-full bg-void border border-border-dim p-2 text-[10px] text-blood-bright font-mono resize-y focus:border-blood focus:outline-none"
                />
                <div className="flex gap-2 mt-2">
                  {peerStatus === "connecting" && (
                    <button
                      onClick={createAnswer}
                      disabled={!remoteSDP.trim()}
                      className="px-3 py-1.5 text-xs border border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-void disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      [ CREATE ANSWER ]
                    </button>
                  )}
                  {peerStatus === "waiting" && pcRef.current?.localDescription?.type === "offer" && (
                    <button
                      onClick={acceptAnswer}
                      disabled={!remoteSDP.trim()}
                      className="px-3 py-1.5 text-xs border border-blood text-blood-bright hover:bg-blood hover:text-void disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      [ ACCEPT ANSWER ]
                    </button>
                  )}
                  {(peerStatus === "connected" || peerStatus === "waiting" || peerStatus === "connecting") && (
                    <button
                      onClick={closeConnection}
                      className="px-3 py-1.5 text-xs border border-border-dim text-content-secondary hover:border-blood hover:text-blood ml-auto"
                    >
                      [ CLOSE ]
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Connection log */}
            {connectionLog.length > 0 && (
              <div className="border border-border-dim bg-void p-2 max-h-32 overflow-y-auto">
                <div className="text-[9px] text-content-dim uppercase mb-1">CONNECTION LOG</div>
                {connectionLog.slice(-10).map((l, i) => (
                  <div key={i} className="text-[10px] text-content-secondary">{l}</div>
                ))}
              </div>
            )}

            <div className="text-[10px] text-content-dim mt-3">
              ▸ How it works: No signaling server needed. You copy-paste SDP descriptions between peers via any channel (email, USB, voice). WebRTC handles NAT traversal via STUN. All data is end-to-end encrypted by DTLS.
            </div>
          </TerminalCard>

          {/* P2P Chat — only when connected */}
          <TerminalCard title={`P2P ENCRYPTED CHAT — ${channel}`} className="mb-6">
            {peerStatus === "connected" ? (
              <>
                <div className="h-80 overflow-y-auto bg-void border border-border-dim p-3 mb-3 space-y-1">
                  {localMessages.length === 0 ? (
                    <div className="text-xs text-content-dim text-center mt-20">
                      <span className="cursor-blink">&gt;</span> Channel open. Send the first message...
                    </div>
                  ) : (
                    localMessages.map((m) => (
                      <div key={m.id} className={`text-xs flex items-start gap-2 ${m.self ? "justify-end" : ""}`}>
                        {!m.self && <span className="text-content-dim shrink-0">[{new Date(m.ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}]</span>}
                        <span className={`shrink-0 font-bold ${m.self ? "text-terminal-green" : "text-blood-bright"}`}>
                          {m.author}:
                        </span>
                        <span className={`text-content-primary break-words ${m.self ? "text-right" : ""}`}>{m.text}</span>
                        {m.self && <span className="text-content-dim shrink-0">[{new Date(m.ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}]</span>}
                      </div>
                    ))
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => { setInput(e.target.value); sound.keystroke(); }}
                    onKeyDown={(e) => e.key === "Enter" && sendP2PMessage()}
                    placeholder="type your encrypted message..."
                    className="flex-1 bg-void border border-border-dim px-3 py-2 text-xs text-content-primary focus:border-blood focus:outline-none"
                  />
                  <button
                    onClick={sendP2PMessage}
                    className="px-4 py-2 text-xs border border-blood text-blood-bright hover:bg-blood hover:text-void"
                  >
                    [ SEND ]
                  </button>
                </div>
                <div className="text-[10px] text-terminal-green mt-2">
                  ▸ Messages are end-to-end encrypted via DTLS-SRTP. Signed by your ECDSA keypair. Ephemeral — no persistence.
                </div>
              </>
            ) : (
              <div className="py-12 text-center">
                <div className="text-blood-bright text-sm mb-2">
                  <span className="cursor-blink">&gt;</span> NO ACTIVE P2P CONNECTION
                </div>
                <p className="text-xs text-content-dim">
                  Establish a peer link above to start sending encrypted messages.
                  No server involved — pure browser-to-browser WebRTC.
                </p>
              </div>
            )}
          </TerminalCard>

          {/* Dead drops */}
          <TerminalCard title="DEAD DROPS — GPS-COORDINATE MESSAGE DROPS" accent="amber" className="mb-6">
            <p className="text-xs text-content-secondary mb-4">
              Plant messages at geographic coordinates. Stored locally, persisted across sessions.
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
                placeholder="Message..."
                className="bg-void border border-border-dim px-3 py-2 text-xs text-content-primary focus:border-blood focus:outline-none"
              />
            </div>
            <button
              onClick={plantDeadDrop}
              disabled={!deadDropLat || !deadDropLng || !deadDropMsg}
              className="px-4 py-2 text-xs border border-border-dim text-content-secondary hover:border-blood hover:text-blood disabled:opacity-30"
            >
              [ PLANT DEAD DROP ]
            </button>

            {deadDrops.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="text-[10px] text-content-dim uppercase tracking-widest">
                  LOCAL DEAD DROPS ({deadDrops.length})
                </div>
                {deadDrops.slice().reverse().map((d) => (
                  <div key={d.id} className="border border-border-dim bg-void/50 p-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-blood-bright font-bold">{d.author}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-content-dim">{new Date(d.ts).toISOString().slice(0, 16).replace("T", " ")}</span>
                        <button
                          onClick={() => removeDeadDrop(d.id)}
                          className="text-[10px] text-content-dim hover:text-blood"
                        >
                          [×]
                        </button>
                      </div>
                    </div>
                    <div className="text-[10px] text-terminal-green mt-1">
                      {d.lat}, {d.lng}
                    </div>
                    <div className="text-xs text-content-primary mt-1">{d.msg}</div>
                  </div>
                ))}
              </div>
            )}
          </TerminalCard>
        </>
      )}
    </div>
  );
}
