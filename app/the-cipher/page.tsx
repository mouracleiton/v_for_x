"use client";

/**
 * V FOR X — The Cipher (Steganography + OTP)
 * [48] THE CIPHER — Code: 48
 */

import { useState, useRef, useCallback } from "react";
import TerminalCard from "@/components/ui/TerminalCard";
import { sound } from "@/lib/sound";
import {
  generateOTP,
  encryptWithOTP,
  decryptWithOTP,
  embedInImage,
  extractFromImage,
  maxMessageSize,
  encodeWithCodebook,
  decodeWithCodebook,
  STANDARD_CODEBOOK,
} from "@/lib/cipher";

type Tab = "otp" | "stego" | "codebook";

export default function TheCipherPage() {
  const [tab, setTab] = useState<Tab>("otp");

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-4xl mx-auto">
      <h1 className="text-3xl sm:text-4xl text-blood-bright font-bold tracking-widest mb-2">
        🔐 THE CIPHER
      </h1>
      <p className="text-content-secondary text-sm mb-6">
        // steganography · one-time pads · field codebooks — hide the existence of messages
      </p>

      <div className="flex gap-1 mb-6 border-b border-border-dim">
        {([["otp", "ONE-TIME PAD"], ["stego", "STEGANOGRAPHY"], ["codebook", "CODEBOOK"]] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => { setTab(t); sound.nav(); }}
            className={`px-4 py-2 text-xs font-bold tracking-widest transition-colors ${
              tab === t
                ? "text-blood-bright border-b-2 border-blood"
                : "text-content-dim hover:text-content-primary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "otp" && <OTPTab />}
      {tab === "stego" && <StegoTab />}
      {tab === "codebook" && <CodebookTab />}
    </div>
  );
}

function OTPTab() {
  const [message, setMessage] = useState("");
  const [pad, setPad] = useState("");
  const [ciphertext, setCiphertext] = useState("");
  const [decrypted, setDecrypted] = useState("");
  const [error, setError] = useState("");

  const handleEncrypt = useCallback(() => {
    setError("");
    if (!message) { setError("// ENTER A MESSAGE"); sound.error(); return; }
    try {
      const msgBytes = new TextEncoder().encode(message);
      const newPad = pad || generateOTP(msgBytes.length);
      setPad(newPad);
      const ct = encryptWithOTP(message, newPad);
      setCiphertext(ct);
      setDecrypted("");
      sound.copy();
    } catch (e) {
      setError(`// ${e instanceof Error ? e.message : "Error"}`);
      sound.error();
    }
  }, [message, pad]);

  const handleDecrypt = useCallback(() => {
    setError("");
    if (!ciphertext || !pad) { setError("// NEED CIPHERTEXT AND PAD"); sound.error(); return; }
    try {
      const pt = decryptWithOTP(ciphertext, pad);
      setDecrypted(pt);
      sound.success();
    } catch (e) {
      setError(`// ${e instanceof Error ? e.message : "Error"}`);
      sound.error();
    }
  }, [ciphertext, pad]);

  return (
    <div className="space-y-4">
      <TerminalCard title="ONE-TIME PAD ENCRYPTION" accent="blood">
        <p className="text-sm text-content-secondary mb-4">
          Information-theoretically secure encryption. XOR the message with a truly random key of equal length. Each pad is single-use. Distribute pads in person.
        </p>

        <label className="text-xs text-content-dim uppercase tracking-widest">Message</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          className="w-full bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary mt-1 mb-3 focus:border-blood font-mono"
          placeholder="Secret message..."
        />

        <label className="text-xs text-content-dim uppercase tracking-widest">One-Time Pad (hex — leave empty to generate random)</label>
        <textarea
          value={pad}
          onChange={(e) => setPad(e.target.value)}
          rows={2}
          className="w-full bg-abyss border border-border-dim px-3 py-2 text-xs text-warning-amber mt-1 mb-3 focus:border-blood font-mono break-all"
          placeholder="Auto-generated on encrypt..."
        />

        {error && <p className="text-blood-bright text-sm mb-3">{error}</p>}

        <button onClick={handleEncrypt} className="px-4 py-2 text-xs font-bold bg-blood text-white hover:bg-blood-bright mb-4">
          [ ENCRYPT ]
        </button>

        {ciphertext && (
          <>
            <label className="text-xs text-content-dim uppercase tracking-widest">Ciphertext (hex)</label>
            <textarea
              value={ciphertext}
              onChange={(e) => setCiphertext(e.target.value)}
              rows={3}
              className="w-full bg-abyss border border-border-dim px-3 py-2 text-xs text-terminal-green mt-1 mb-3 font-mono break-all"
              readOnly
            />
            <button onClick={handleDecrypt} className="px-4 py-2 text-xs font-bold border border-terminal-green text-terminal-green hover:bg-terminal-green/10">
              [ DECRYPT ]
            </button>
          </>
        )}

        {decrypted && (
          <div className="mt-4 p-3 border border-terminal-green/30 bg-terminal-green/5">
            <span className="text-xs text-terminal-green uppercase tracking-widest">DECRYPTED:</span>
            <p className="text-sm text-content-primary mt-1 font-mono">{decrypted}</p>
          </div>
        )}
      </TerminalCard>

      <TerminalCard title="⚠ OPSEC RULES" accent="amber">
        <ul className="space-y-1 text-sm text-content-secondary">
          <li>• Never reuse a pad — reuse breaks the cipher completely</li>
          <li>• Pads must be truly random (this tool uses crypto.getRandomValues)</li>
          <li>• Share pads in person, never over monitored channels</li>
          <li>• Destroy the pad after use (burn, shred, wipe)</li>
          <li>• The pad must be at least as long as the message</li>
        </ul>
      </TerminalCard>
    </div>
  );
}

function StegoTab() {
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [message, setMessage] = useState("");
  const [stegoImage, setStegoImage] = useState<ImageData | null>(null);
  const [extracted, setExtracted] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [imgWidth, setImgWidth] = useState(0);
  const [imgHeight, setImgHeight] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current || document.createElement("canvas");
        const maxSize = 800;
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        setImageData(data);
        setImgWidth(canvas.width);
        setImgHeight(canvas.height);
        setStegoImage(null);
        setExtracted(null);
        sound.select();
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, []);

  const handleEmbed = useCallback(() => {
    setError("");
    if (!imageData) { setError("// LOAD AN IMAGE FIRST"); sound.error(); return; }
    if (!message) { setError("// ENTER A MESSAGE TO HIDE"); sound.error(); return; }
    try {
      const stego = embedInImage(imageData, message);
      setStegoImage(stego);
      sound.success();
    } catch (e) {
      setError(`// ${e instanceof Error ? e.message : "Error"}`);
      sound.error();
    }
  }, [imageData, message]);

  const handleExtract = useCallback(() => {
    setError("");
    if (!stegoImage) { setError("// EMBED A MESSAGE FIRST"); sound.error(); return; }
    const msg = extractFromImage(stegoImage);
    setExtracted(msg);
    sound.copy();
  }, [stegoImage]);

  const handleDownload = useCallback(() => {
    if (!stegoImage) return;
    const canvas = document.createElement("canvas");
    canvas.width = stegoImage.width;
    canvas.height = stegoImage.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.putImageData(stegoImage, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "stego-image.png";
      a.click();
      URL.revokeObjectURL(url);
    });
    sound.copy();
  }, [stegoImage]);

  const maxChars = imgWidth > 0 ? maxMessageSize(imgWidth, imgHeight) : 0;

  return (
    <div className="space-y-4">
      <canvas ref={canvasRef} className="hidden" />
      <TerminalCard title="IMAGE STEGANOGRAPHY" accent="blood">
        <p className="text-sm text-content-secondary mb-4">
          Hide a text message in the least-significant bits of an image. The image looks unchanged but carries a hidden payload. 2 bits per RGB channel.
        </p>
        <p className="text-xs text-content-dim mb-4">
          Tip: V FOR X glitch cards carry a hidden <code className="text-warning-amber">VFORX/STAT:</code> payload — load any downloaded card here and hit EXTRACT to verify it.
        </p>

        <input
          type="file"
          accept="image/*"
          onChange={handleFile}
          className="block w-full text-xs text-content-secondary file:mr-3 file:py-2 file:px-4 file:border-0 file:bg-blood file:text-white file:text-xs file:font-bold mb-4"
        />

        {imageData && (
          <>
            <p className="text-xs text-terminal-green mb-3">
              ✓ Image loaded: {imgWidth}×{imgHeight} · Max hidden message: {maxChars} chars
            </p>

            <label className="text-xs text-content-dim uppercase tracking-widest">Message to Hide</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              maxLength={maxChars}
              className="w-full bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary mt-1 mb-3 focus:border-blood font-mono"
              placeholder="The message to embed..."
            />
            <div className="text-xs text-content-dim mb-3">{message.length} / {maxChars} chars</div>

            {error && <p className="text-blood-bright text-sm mb-3">{error}</p>}

            <div className="flex gap-2 flex-wrap">
              <button onClick={handleEmbed} className="px-4 py-2 text-xs font-bold bg-blood text-white hover:bg-blood-bright">
                [ EMBED ]
              </button>
              {stegoImage && (
                <>
                  <button onClick={handleExtract} className="px-4 py-2 text-xs font-bold border border-terminal-green text-terminal-green hover:bg-terminal-green/10">
                    [ EXTRACT ]
                  </button>
                  <button onClick={handleDownload} className="px-4 py-2 text-xs font-bold border border-border-dim text-content-secondary hover:border-blood">
                    [ DOWNLOAD ]
                  </button>
                </>
              )}
            </div>

            {extracted !== null && (
              <div className="mt-4 p-3 border border-terminal-green/30 bg-terminal-green/5">
                <span className="text-xs text-terminal-green uppercase tracking-widest">EXTRACTED MESSAGE:</span>
                <p className="text-sm text-content-primary mt-1 font-mono">{extracted || "(none — no hidden message found)"}</p>
              </div>
            )}
          </>
        )}
      </TerminalCard>

      <TerminalCard title="HOW LSB STEGANOGRAPHY WORKS" accent="amber">
        <p className="text-sm text-content-secondary">
          Each pixel has 3 color channels (R, G, B). We modify only the last 2 bits of each — changes invisible to the human eye. A magic header (VFX1) identifies the payload, and a 4-byte length prefix tells the extractor how much data to read.
        </p>
      </TerminalCard>
    </div>
  );
}

function CodebookTab() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [mode, setMode] = useState<"encode" | "decode">("encode");

  const handleProcess = useCallback(() => {
    if (mode === "encode") {
      setOutput(encodeWithCodebook(input));
    } else {
      setOutput(decodeWithCodebook(input));
    }
    sound.copy();
  }, [input, mode]);

  return (
    <div className="space-y-4">
      <TerminalCard title="FIELD CODEBOOK" accent="blood">
        <p className="text-sm text-content-secondary mb-4">
          Standard code words for burst communication over radio, QR codes, or dead drops. Replaces known phrases with 2-character codes to minimize message length.
        </p>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMode("encode")}
            className={`px-4 py-2 text-xs font-bold ${mode === "encode" ? "bg-blood text-white" : "border border-border-dim text-content-secondary"}`}
          >
            ENCODE
          </button>
          <button
            onClick={() => setMode("decode")}
            className={`px-4 py-2 text-xs font-bold ${mode === "decode" ? "bg-blood text-white" : "border border-border-dim text-content-secondary"}`}
          >
            DECODE
          </button>
        </div>

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={3}
          className="w-full bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary mb-3 focus:border-blood font-mono"
          placeholder={mode === "encode" ? "Type a message to encode..." : "Paste encoded message [AA], [BF]..."}
        />

        <button onClick={handleProcess} className="px-4 py-2 text-xs font-bold bg-blood text-white hover:bg-blood-bright mb-4">
          [ {mode.toUpperCase()} ]
        </button>

        {output && (
          <div className="p-3 border border-border-dim bg-abyss">
            <span className="text-xs text-content-dim uppercase">{mode === "encode" ? "ENCODED" : "DECODED"}:</span>
            <p className="text-sm text-content-primary mt-1 font-mono break-all">{output}</p>
          </div>
        )}
      </TerminalCard>

      <TerminalCard title="STANDARD CODEBOOK" accent="amber">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {STANDARD_CODEBOOK.map((entry) => (
            <div key={entry.code} className="flex items-center gap-2 text-xs p-2 border border-border-dim bg-abyss">
              <code className="text-warning-amber font-bold w-8">[{entry.code}]</code>
              <span className="text-content-secondary">{entry.meaning}</span>
            </div>
          ))}
        </div>
      </TerminalCard>
    </div>
  );
}
