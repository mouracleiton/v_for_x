"use client";

import { useState, useCallback } from "react";
import TerminalCard from "@/components/ui/TerminalCard";
import { sound } from "@/lib/sound";
import {
  encodeMessage,
  decodeMessage,
  segmentForQR,
  createAlert,
  createCoords,
  createSupplyMessage,
  typeLabel,
  typeIcon,
  formatTimestamp,
  type RelayMessage,
  type MessageType,
} from "@/lib/relay";

export default function TheRelayPage() {
  const [msgType, setMsgType] = useState<MessageType>("text");
  const [iso3, setIso3] = useState("XXX");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState(5);
  const [encoded, setEncoded] = useState("");
  const [decoded, setDecoded] = useState<RelayMessage | null>(null);
  const [segments, setSegments] = useState<string[]>([]);

  const handleEncode = useCallback(() => {
    const msg: RelayMessage = {
      type: msgType,
      iso3,
      body,
      priority,
      ts: Math.floor(Date.now() / 1000),
    };
    const enc = encodeMessage(msg);
    setEncoded(enc);
    setSegments(segmentForQR(enc).map((s) => s.content));
    sound.copy();
  }, [msgType, iso3, body, priority]);

  const handleDecode = useCallback(() => {
    const dec = decodeMessage(encoded);
    setDecoded(dec);
    if (dec) sound.success();
    else sound.error();
  }, [encoded]);

  const handleTemplate = useCallback((template: "alert" | "coords" | "supply") => {
    if (template === "alert") {
      const m = createAlert(iso3, body || "Emergency alert", 9);
      setMsgType(m.type); setPriority(m.priority); setBody(m.body);
    } else if (template === "coords") {
      const m = createCoords(iso3, 15.5, 32.5, body);
      setMsgType(m.type); setPriority(m.priority); setBody(m.body);
    } else {
      const m = createSupplyMessage(iso3, "need", body || "rice", "50kg");
      setMsgType(m.type); setPriority(m.priority); setBody(m.body);
    }
    sound.select();
  }, [iso3, body]);

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-4xl mx-auto">
      <h1 className="text-3xl sm:text-4xl text-blood-bright font-bold tracking-widest mb-2">📡 THE RELAY</h1>
      <p className="text-content-secondary text-sm mb-6">
        // offline burst message format — encode, segment, and relay when the internet is cut
      </p>

      <div className="space-y-4">
        <TerminalCard title="COMPOSE MESSAGE" accent="blood">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            <div>
              <label className="text-xs text-content-dim uppercase">Type</label>
              <select value={msgType} onChange={(e) => setMsgType(e.target.value as MessageType)}
                className="w-full bg-abyss border border-border-dim px-2 py-1.5 text-sm text-content-primary mt-1">
                <option value="text">{typeIcon("text")} Text</option>
                <option value="alert">{typeIcon("alert")} Alert</option>
                <option value="coords">{typeIcon("coords")} Coordinates</option>
                <option value="contact">{typeIcon("contact")} Contact</option>
                <option value="supply">{typeIcon("supply")} Supply</option>
                <option value="medical">{typeIcon("medical")} Medical</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-content-dim uppercase">Country</label>
              <input type="text" value={iso3} onChange={(e) => setIso3(e.target.value.toUpperCase().slice(0, 3))}
                className="w-full bg-abyss border border-border-dim px-2 py-1.5 text-sm text-content-primary mt-1" />
            </div>
            <div>
              <label className="text-xs text-content-dim uppercase">Priority: {priority}</label>
              <input type="range" min={0} max={9} value={priority} onChange={(e) => setPriority(Number(e.target.value))}
                className="w-full mt-2" />
            </div>
          </div>

          <label className="text-xs text-content-dim uppercase">Message Body</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3}
            className="w-full bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary mt-1 mb-3 focus:border-blood font-mono"
            placeholder="Message content..." />

          <div className="flex gap-2 flex-wrap mb-4">
            <button onClick={() => handleTemplate("alert")} className="px-3 py-1 text-xs border border-border-dim text-content-secondary hover:border-blood">⚠ Alert Template</button>
            <button onClick={() => handleTemplate("coords")} className="px-3 py-1 text-xs border border-border-dim text-content-secondary hover:border-blood">📍 Coords Template</button>
            <button onClick={() => handleTemplate("supply")} className="px-3 py-1 text-xs border border-border-dim text-content-secondary hover:border-blood">📦 Supply Template</button>
          </div>

          <button onClick={handleEncode} className="px-4 py-2 text-xs font-bold bg-blood text-white hover:bg-blood-bright">
            [ ENCODE ]
          </button>
        </TerminalCard>

        {encoded && (
          <>
            <TerminalCard title="ENCODED MESSAGE" accent="green">
              <code className="block text-xs bg-abyss border border-border-dim p-3 break-all text-terminal-green font-mono">{encoded}</code>
              <button onClick={() => { navigator.clipboard?.writeText(encoded); sound.copy(); }}
                className="mt-2 px-3 py-1 text-xs border border-border-dim text-content-secondary hover:border-blood">[ COPY ]</button>
            </TerminalCard>

            {segments.length > 1 && (
              <TerminalCard title={`QR SEGMENTS (${segments.length})`} accent="amber">
                <p className="text-xs text-content-secondary mb-3">Message is too long for one QR code. Scan each segment in order:</p>
                {segments.map((seg, i) => (
                  <div key={i} className="mb-2">
                    <span className="text-xs text-content-dim">Segment {i + 1}/{segments.length}:</span>
                    <code className="block text-xs bg-abyss border border-border-dim p-2 break-all text-warning-amber font-mono">{seg}</code>
                  </div>
                ))}
              </TerminalCard>
            )}

            <TerminalCard title="DECODE" accent="blood">
              <textarea value={encoded} onChange={(e) => setEncoded(e.target.value)} rows={3}
                className="w-full bg-abyss border border-border-dim px-3 py-2 text-xs text-content-primary mb-3 font-mono break-all" />
              <button onClick={handleDecode} className="px-4 py-2 text-xs font-bold border border-terminal-green text-terminal-green hover:bg-terminal-green/10">[ DECODE ]</button>
            </TerminalCard>
          </>
        )}

        {decoded && (
          <TerminalCard title="DECODED MESSAGE" accent="green">
            <div className="space-y-1 text-sm">
              <p><span className="text-content-dim">Type:</span> {typeIcon(decoded.type)} {typeLabel(decoded.type)}</p>
              <p><span className="text-content-dim">Country:</span> {decoded.iso3}</p>
              <p><span className="text-content-dim">Priority:</span> {decoded.priority}/9</p>
              <p><span className="text-content-dim">Timestamp:</span> {formatTimestamp(decoded.ts)}</p>
              {decoded.sender && <p><span className="text-content-dim">Sender:</span> @{decoded.sender}</p>}
              <p><span className="text-content-dim">Body:</span> <span className="text-content-primary font-mono">{decoded.body}</span></p>
            </div>
          </TerminalCard>
        )}
      </div>
    </div>
  );
}
