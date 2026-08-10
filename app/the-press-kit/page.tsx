"use client";

/**
 * V FOR X — The Press Kit
 *
 * A field-ready citizen-journalist toolkit. Four panels, all 100%
 * client-side: EXIF stripping, region redaction, file-integrity
 * verification, and blockchain evidence notarization via
 * OpenTimestamps. No uploads, no servers, no telemetry — a source's
 * material never leaves the device until they choose to publish.
 */

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
  type CSSProperties,
} from "react";
import TerminalCard from "@/components/ui/TerminalCard";
import {
  stripImageExif,
  hashFile,
  verifyFileIntegrity,
  redactImage,
  generateEvidenceHash,
  formatHashForDisplay,
} from "@/lib/citizen-tools";
import {
  notarizeEvidence,
  createMerkleLeaf,
  anchorToDag,
  type NotarizationResult,
} from "@/lib/blockchain-verify";
import { type DagEntry, GENESIS_HASH } from "@/lib/dag";

/* ═══════════════════════════════════════════════════════════════
   Shared helpers
   ═══════════════════════════════════════════════════════════════ */

interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

function downloadBlob(blob: Blob, filename: string): void {
  if (typeof document === "undefined") return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

/* ═══════════════════════════════════════════════════════════════
   EXIF reader (JPEG/TIFF) — best-effort, never throws
   ═══════════════════════════════════════════════════════════════ */

interface ExifField {
  label: string;
  value: string;
}
interface ExifReport {
  fields: ExifField[];
  hasGps: boolean;
  hasExif: boolean;
}

const EMPTY_REPORT: ExifReport = { fields: [], hasGps: false, hasExif: false };

const EXIF_TYPE_SIZE: Record<number, number> = {
  1: 1,
  2: 1,
  3: 2,
  4: 4,
  5: 8,
  7: 1,
  9: 4,
  10: 8,
};

function readExifValue(
  view: DataView,
  offset: number,
  type: number,
  little: boolean
): number {
  switch (type) {
    case 1:
    case 7:
      return view.getUint8(offset);
    case 3:
      return view.getUint16(offset, little);
    case 4:
      return view.getUint32(offset, little);
    case 9:
      return view.getInt32(offset, little);
    case 5: {
      const n = view.getUint32(offset, little);
      const d = view.getUint32(offset + 4, little);
      return d === 0 ? 0 : n / d;
    }
    case 10: {
      const n = view.getInt32(offset, little);
      const d = view.getInt32(offset + 4, little);
      return d === 0 ? 0 : n / d;
    }
    default:
      return 0;
  }
}

function readExifAscii(bytes: Uint8Array, offset: number, len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) {
    const c = bytes[offset + i];
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s.trim();
}

interface IfdEntry {
  type: number;
  count: number;
  dataOffset: number;
}

function readIfd(
  view: DataView,
  ifdOffset: number,
  little: boolean,
  tiffBase: number
): Map<number, IfdEntry> {
  const entries = new Map<number, IfdEntry>();
  if (ifdOffset + 2 > view.byteLength) return entries;
  const count = view.getUint16(ifdOffset, little);
  for (let i = 0; i < count; i++) {
    const entryOffset = ifdOffset + 2 + i * 12;
    if (entryOffset + 12 > view.byteLength) break;
    const tag = view.getUint16(entryOffset, little);
    const type = view.getUint16(entryOffset + 2, little);
    const num = view.getUint32(entryOffset + 4, little);
    const typeSize = EXIF_TYPE_SIZE[type] || 1;
    const totalLen = num * typeSize;
    const dataOffset =
      totalLen <= 4
        ? entryOffset + 8
        : view.getUint32(entryOffset + 8, little) + tiffBase;
    entries.set(tag, { type, count: num, dataOffset });
  }
  return entries;
}

function readGpsCoord(view: DataView, entry: IfdEntry, little: boolean): number {
  if (entry.count < 3) return 0;
  const deg = readExifValue(view, entry.dataOffset, 5, little);
  const min = readExifValue(view, entry.dataOffset + 8, 5, little);
  const sec = readExifValue(view, entry.dataOffset + 16, 5, little);
  return deg + min / 60 + sec / 3600;
}

function readExif(file: File): Promise<ExifReport> {
  return file.arrayBuffer().then((ab) => {
    try {
      const bytes = new Uint8Array(ab);
      const view = new DataView(ab);
      if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8)
        return EMPTY_REPORT;

      // Locate the APP1 "Exif\0\0" segment.
      let offset = 2;
      let exifStart = -1;
      while (offset < bytes.length - 3) {
        if (bytes[offset] !== 0xff) {
          offset++;
          continue;
        }
        const marker = bytes[offset + 1];
        if (
          marker === 0xd8 ||
          (marker >= 0xd0 && marker <= 0xd9) ||
          marker === 0x01
        ) {
          offset += 2;
          continue;
        }
        const segLen = view.getUint16(offset + 2, false);
        if (
          marker === 0xe1 &&
          segLen >= 8 &&
          bytes[offset + 4] === 0x45 && // E
          bytes[offset + 5] === 0x78 && // x
          bytes[offset + 6] === 0x69 && // i
          bytes[offset + 7] === 0x66 //   f
        ) {
          exifStart = offset + 10; // FF E1(2) + len(2) + "Exif\0\0"(6)
          break;
        }
        offset += 2 + segLen;
        if (segLen === 0) break;
      }
      if (exifStart < 0 || exifStart + 8 > bytes.length) return EMPTY_REPORT;

      const tiffBase = exifStart;
      const little = bytes[tiffBase] === 0x49; // "II" little-endian
      if (view.getUint16(tiffBase + 2, little) !== 0x002a) return EMPTY_REPORT;
      const ifd0Offset = view.getUint32(tiffBase + 4, little) + tiffBase;
      const ifd0 = readIfd(view, ifd0Offset, little, tiffBase);

      const fields: ExifField[] = [];
      let hasGps = false;

      const asciiTag = (map: Map<number, IfdEntry>, tag: number, label: string) => {
        const e = map.get(tag);
        if (e && e.type === 2) {
          const val = readExifAscii(bytes, e.dataOffset, e.count);
          if (val) fields.push({ label, value: val });
        }
      };
      const numTag = (
        map: Map<number, IfdEntry>,
        tag: number,
        label: string,
        fmt?: (n: number) => string
      ) => {
        const e = map.get(tag);
        if (e) {
          const v = readExifValue(view, e.dataOffset, e.type, little);
          if (v !== 0) fields.push({ label, value: fmt ? fmt(v) : String(Math.round(v)) });
        }
      };

      asciiTag(ifd0, 0x010f, "Make");
      asciiTag(ifd0, 0x0110, "Model");
      asciiTag(ifd0, 0x0131, "Software");
      asciiTag(ifd0, 0x013b, "Artist");
      asciiTag(ifd0, 0x0132, "DateTime");
      numTag(ifd0, 0x0112, "Orientation");

      // Exif sub-IFD
      const exifPtr = ifd0.get(0x8769);
      if (exifPtr) {
        const exifOff =
          readExifValue(view, exifPtr.dataOffset, exifPtr.type, little) + tiffBase;
        const exifIfd = readIfd(view, exifOff, little, tiffBase);
        asciiTag(exifIfd, 0x9003, "DateTimeOriginal");
        asciiTag(exifIfd, 0x9004, "DateTimeDigitized");
        numTag(exifIfd, 0xa002, "ExifImageWidth");
        numTag(exifIfd, 0xa003, "ExifImageHeight");
        numTag(exifIfd, 0x920a, "FocalLength", (n) => `${n}mm`);
        numTag(exifIfd, 0x829d, "FNumber", (n) => `f/${n}`);
        numTag(exifIfd, 0x9209, "Flash", (n) => (n & 1 ? "Fired" : "Off"));
      }

      // GPS IFD
      const gpsPtr = ifd0.get(0x8825);
      if (gpsPtr) {
        const gpsOff =
          readExifValue(view, gpsPtr.dataOffset, gpsPtr.type, little) + tiffBase;
        const gpsIfd = readIfd(view, gpsOff, little, tiffBase);
        const lat = gpsIfd.get(0x0002);
        const latRef = gpsIfd.get(0x0001);
        const lng = gpsIfd.get(0x0004);
        const lngRef = gpsIfd.get(0x0003);
        if (lat || lng) {
          hasGps = true;
          fields.push({ label: "⚠ GPS", value: "Location data embedded" });
          if (lat && latRef) {
            const d = readGpsCoord(view, lat, little);
            const ref = readExifAscii(bytes, latRef.dataOffset, latRef.count);
            fields.push({ label: "GPS Latitude", value: `${d.toFixed(6)}° ${ref}` });
          }
          if (lng && lngRef) {
            const d = readGpsCoord(view, lng, little);
            const ref = readExifAscii(bytes, lngRef.dataOffset, lngRef.count);
            fields.push({ label: "GPS Longitude", value: `${d.toFixed(6)}° ${ref}` });
          }
          const alt = gpsIfd.get(0x0006);
          if (alt) {
            const a = readExifValue(view, alt.dataOffset, alt.type, little);
            fields.push({ label: "GPS Altitude", value: `${a.toFixed(1)}m` });
          }
        }
      }

      return { fields, hasGps, hasExif: fields.length > 0 };
    } catch {
      return EMPTY_REPORT;
    }
  });
}

/* ═══════════════════════════════════════════════════════════════
   Section 1 — EXIF STRIPPER
   ═══════════════════════════════════════════════════════════════ */

function ExifStripper() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [report, setReport] = useState<ExifReport | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    setDone(false);
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(f);
    });
    setReport(await readExif(f));
  }, []);

  const onFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files?.[0];
      if (f && f.type.startsWith("image/")) handleFile(f);
    },
    [handleFile]
  );

  const onStrip = useCallback(async () => {
    if (!file) return;
    setBusy(true);
    try {
      const blob = await stripImageExif(file);
      const ext = file.type === "image/png" ? ".png" : ".jpg";
      const name = file.name.replace(/\.[^.]+$/, "") + "-clean" + ext;
      downloadBlob(blob, name);
      setDone(true);
    } finally {
      setBusy(false);
    }
  }, [file]);

  return (
    <TerminalCard title="01 · exif stripper" accent="blood" glow>
      <p className="pk-dim pk-mono" style={{ fontSize: 11, marginBottom: 12 }}>
        Every photo from a phone or camera carries hidden metadata — GPS
        coordinates, device serial numbers, timestamps, even thumbnails.
        Drop an image below to see what&apos;s leaking, then strip every byte.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={onFileChange}
      />

      {!previewUrl ? (
        <div
          className={`pk-dropzone ${dragOver ? "active" : ""}`}
          onClick={() => inputRef.current?.click()}
          onDrop={onDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
        >
          <div style={{ color: "var(--color-blood-bright)", fontSize: 13 }}>
            ⬡ DROP IMAGE HERE
          </div>
          <div className="pk-dim" style={{ fontSize: 11, marginTop: 6 }}>
            or click to browse · jpg / png
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 220px", minWidth: 220 }}>
            <img
              src={previewUrl}
              alt="preview"
              className="pk-preview"
              style={{
                width: "100%",
                borderRadius: 4,
                border: "1px solid var(--color-border-dim)",
              }}
            />
            <button
              className="pk-btn pk-btn-green"
              style={{ marginTop: 10, width: "100%" }}
              onClick={onStrip}
              disabled={busy}
            >
              {busy ? "stripping…" : done ? "✓ stripped — download again" : "strip & download"}
            </button>
            {done && (
              <div
                className="pk-mono"
                style={{
                  fontSize: 11,
                  marginTop: 8,
                  color: "var(--color-terminal-green)",
                }}
              >
                ✓ All metadata removed — file redrawn from raw pixels.
              </div>
            )}
          </div>

          <div style={{ flex: "1 1 240px", minWidth: 240 }}>
            {file && (
              <div className="pk-field-row">
                <span className="pk-dim">file</span>
                <span>{file.name}</span>
              </div>
            )}
            {file && (
              <div className="pk-field-row">
                <span className="pk-dim">size</span>
                <span>{fmtBytes(file.size)}</span>
              </div>
            )}
            <div
              className="pk-mono"
              style={{
                fontSize: 10,
                letterSpacing: "0.12em",
                color: "var(--color-content-secondary)",
                marginTop: 12,
                marginBottom: 6,
              }}
            >
              METADATA FOUND
            </div>
            {!report?.hasExif && (
              <div className="pk-dim" style={{ fontSize: 11 }}>
                {file?.type === "image/jpeg"
                  ? "No EXIF fields detected."
                  : "EXIF scan targets JPEG. PNG redraw still strips any metadata."}
              </div>
            )}
            {report?.hasGps && (
              <div
                className="pk-mono"
                style={{
                  fontSize: 11,
                  padding: "6px 8px",
                  marginBottom: 6,
                  borderRadius: 4,
                  background: "rgba(196,43,62,0.18)",
                  border: "1px solid var(--color-blood)",
                  color: "var(--color-blood-bright)",
                }}
              >
                ⚠ GPS LOCATION DATA — strip before publishing
              </div>
            )}
            {report?.fields.map((f, i) => (
              <div key={i} className="pk-field-row">
                <span className="pk-dim">{f.label}</span>
                <span
                  style={{
                    color:
                      f.label === "⚠ GPS"
                        ? "var(--color-blood-bright)"
                        : "var(--color-content-primary)",
                  }}
                >
                  {f.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </TerminalCard>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Section 2 — REGION REDACTION
   ═══════════════════════════════════════════════════════════════ */

function RegionRedaction() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [regions, setRegions] = useState<Region[]>([]);
  const [draft, setDraft] = useState<Region | null>(null);
  const [busy, setBusy] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setRegions([]);
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(f);
    });
  }, []);

  const onFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f && f.type.startsWith("image/")) handleFile(f);
    },
    [handleFile]
  );

  const toNatural = useCallback(
    (clientX: number, clientY: number): Region | null => {
      const img = imgRef.current;
      if (!img || dims.w === 0) return null;
      const rect = img.getBoundingClientRect();
      return {
        x: ((clientX - rect.left) / rect.width) * dims.w,
        y: ((clientY - rect.top) / rect.height) * dims.h,
        w: 0,
        h: 0,
      };
    },
    [dims]
  );

  const onDown = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      const p = toNatural(e.clientX, e.clientY);
      if (!p) return;
      startRef.current = { x: p.x, y: p.y };
      setDraft(p);
    },
    [toNatural]
  );

  const onMove = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      if (!startRef.current) return;
      const p = toNatural(e.clientX, e.clientY);
      if (!p) return;
      setDraft({
        x: Math.min(startRef.current.x, p.x),
        y: Math.min(startRef.current.y, p.y),
        w: Math.abs(p.x - startRef.current.x),
        h: Math.abs(p.y - startRef.current.y),
      });
    },
    [toNatural]
  );

  const onUp = useCallback(() => {
    setDraft((d) => {
      if (d && d.w > 4 && d.h > 4) setRegions((r) => [...r, d]);
      return null;
    });
    startRef.current = null;
  }, []);

  const onDownload = useCallback(async () => {
    if (!file || regions.length === 0) return;
    setBusy(true);
    try {
      const blob = await redactImage(file, regions);
      const ext = file.type === "image/png" ? ".png" : ".jpg";
      const name = file.name.replace(/\.[^.]+$/, "") + "-redacted" + ext;
      downloadBlob(blob, name);
    } finally {
      setBusy(false);
    }
  }, [file, regions]);

  const pct = (n: number, axis: "x" | "y"): string =>
    `${(n / (axis === "x" ? dims.w : dims.h)) * 100}%`;

  const boxStyle = (r: Region, isDraft = false): CSSProperties => ({
    position: "absolute",
    left: pct(r.x, "x"),
    top: pct(r.y, "y"),
    width: pct(r.w, "x"),
    height: pct(r.h, "y"),
    background: isDraft ? "rgba(196,43,62,0.35)" : "#000",
    border: "1px solid var(--color-blood)",
    pointerEvents: "none",
  });

  return (
    <TerminalCard title="02 · region redaction" accent="blood">
      <p className="pk-dim pk-mono" style={{ fontSize: 11, marginBottom: 12 }}>
        Upload an image, then click-drag to draw black boxes over faces,
        license plates, documents — anything that identifies a source.
        All processing stays in your browser.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={onFileChange}
      />

      {!previewUrl ? (
        <div
          className="pk-dropzone"
          onClick={() => inputRef.current?.click()}
        >
          <div style={{ color: "var(--color-blood-bright)", fontSize: 13 }}>
            ⬡ UPLOAD IMAGE TO REDACT
          </div>
          <div className="pk-dim" style={{ fontSize: 11, marginTop: 6 }}>
            click to browse
          </div>
        </div>
      ) : (
        <>
          <div
            className="pk-mono"
            style={{ fontSize: 11, color: "var(--color-content-secondary)", marginBottom: 6 }}
          >
            ✛ click-drag on the image to add redaction boxes
          </div>
          <div
            style={{
              position: "relative",
              userSelect: "none",
              cursor: "crosshair",
              lineHeight: 0,
            }}
            onMouseDown={onDown}
            onMouseMove={onMove}
            onMouseUp={onUp}
            onMouseLeave={onUp}
          >
            <img
              ref={imgRef}
              src={previewUrl}
              alt="redact target"
              draggable={false}
              onLoad={(e) =>
                setDims({
                  w: e.currentTarget.naturalWidth,
                  h: e.currentTarget.naturalHeight,
                })
              }
              style={{ width: "100%", display: "block", borderRadius: 4 }}
            />
            {regions.map((r, i) => (
              <div key={i} style={boxStyle(r)} />
            ))}
            {draft && <div style={boxStyle(draft, true)} />}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginTop: 12,
              flexWrap: "wrap",
            }}
          >
            <button
              className="pk-btn pk-btn-green"
              onClick={onDownload}
              disabled={busy || regions.length === 0}
            >
              {busy
                ? "processing…"
                : `download redacted (${regions.length})`}
            </button>
            <button
              className="pk-btn"
              onClick={() => {
                setRegions([]);
                setDraft(null);
              }}
              disabled={regions.length === 0}
            >
              clear boxes
            </button>
          </div>
        </>
      )}
    </TerminalCard>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Section 3 — FILE INTEGRITY VERIFIER
   ═══════════════════════════════════════════════════════════════ */

function IntegrityVerifier() {
  const [file, setFile] = useState<File | null>(null);
  const [expected, setExpected] = useState("");
  const [computed, setComputed] = useState("");
  const [match, setMatch] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setComputed("");
      setMatch(null);
    }
  }, []);

  const onVerify = useCallback(async () => {
    if (!file) return;
    setBusy(true);
    try {
      const [hash, ok] = await Promise.all([
        hashFile(file),
        verifyFileIntegrity(file, expected),
      ]);
      setComputed(hash);
      setMatch(ok);
    } finally {
      setBusy(false);
    }
  }, [file, expected]);

  const ok = match === true;
  const bad = match === false;

  return (
    <TerminalCard title="03 · file integrity verifier" accent="blood">
      <p className="pk-dim pk-mono" style={{ fontSize: 11, marginBottom: 12 }}>
        Confirm a file hasn&apos;t been altered in transit. Upload the file,
        paste the trusted SHA-256, and verify they match byte-for-byte.
      </p>

      <input
        ref={inputRef}
        type="file"
        style={{ display: "none" }}
        onChange={onFileChange}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <button
          className="pk-btn"
          onClick={() => inputRef.current?.click()}
        >
          {file ? `✓ ${file.name}` : "select file"}
        </button>

        <input
          className="pk-input"
          placeholder="paste expected sha-256 hash…"
          value={expected}
          onChange={(e) => {
            setExpected(e.target.value);
            setMatch(null);
          }}
          spellCheck={false}
        />

        <button
          className="pk-btn pk-btn-green"
          onClick={onVerify}
          disabled={busy || !file || !expected.trim()}
        >
          {busy ? "hashing…" : "verify integrity"}
        </button>

        {match !== null && (
          <div
            className="pk-mono"
            style={{
              fontSize: 12,
              padding: "10px 12px",
              borderRadius: 4,
              border: `1px solid ${
                ok ? "var(--color-terminal-green)" : "var(--color-blood)"
              }`,
              background: ok
                ? "rgba(34,211,166,0.12)"
                : "rgba(196,43,62,0.15)",
              color: ok
                ? "var(--color-terminal-green)"
                : "var(--color-blood-bright)",
            }}
          >
            {ok ? "✓ VERIFIED — hash matches exactly" : "✗ MISMATCH — file has been altered"}
          </div>
        )}

        {computed && (
          <div className="pk-field-row" style={{ alignItems: "flex-start" }}>
            <span className="pk-dim" style={{ flexShrink: 0 }}>
              computed
            </span>
            <span
              className="pk-mono"
              style={{
                fontSize: 11,
                wordBreak: "break-all",
                color: ok
                  ? "var(--color-terminal-green)"
                  : bad
                    ? "var(--color-blood-bright)"
                    : "var(--color-content-primary)",
              }}
            >
              {formatHashForDisplay(computed)}
            </span>
          </div>
        )}
      </div>
    </TerminalCard>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Section 4 — EVIDENCE HASHER & BLOCKCHAIN NOTARIZE
   ═══════════════════════════════════════════════════════════════ */

function EvidenceNotarizer() {
  const [evidence, setEvidence] = useState("");
  const [result, setResult] = useState<NotarizationResult | null>(null);
  const [merkleRoot, setMerkleRoot] = useState("");
  const [dagAnchor, setDagAnchor] = useState("");
  const [busy, setBusy] = useState(false);
  const dagHistory = useRef<DagEntry[]>([]);

  const hash = useMemo(
    () => (evidence.trim() ? generateEvidenceHash([evidence]) : ""),
    [evidence]
  );

  const onNotarize = useCallback(async () => {
    if (!hash) return;
    setBusy(true);
    setResult(null);
    try {
      const merkle = createMerkleLeaf([hash]);
      setMerkleRoot(merkle.root);
      const anchorHash = anchorToDag(hash, dagHistory.current);
      setDagAnchor(anchorHash);
      dagHistory.current = [
        ...dagHistory.current,
        {
          prevHash: dagHistory.current.length > 0
            ? dagHistory.current[dagHistory.current.length - 1].hash
            : GENESIS_HASH,
          ts: Date.now(),
          source: "evidence",
          destination: hash,
          amount: "1",
          purpose: "evidence_anchor",
          status: "VERIFIED",
          signerHandle: "",
          hash: anchorHash,
        },
      ];
      const res = await notarizeEvidence(hash);
      setResult(res);
    } catch {
      setResult({ hash, timestamp: Date.now(), pending: true });
    } finally {
      setBusy(false);
    }
  }, [hash]);

  const pending = result?.pending;
  const confirmed = result && !result.pending;

  return (
    <TerminalCard title="04 · evidence hasher & blockchain notarize" accent="blood">
      <p className="pk-dim pk-mono" style={{ fontSize: 11, marginBottom: 12 }}>
        Hash a statement, document, or dataset, then anchor that hash to the
        Bitcoin blockchain via OpenTimestamps — a keyless, forge-proof proof
        that the evidence existed at this moment. If offline, the stamp queues
        locally for later resubmission.
      </p>

      <textarea
        className="pk-input"
        placeholder="paste or type the evidence to notarize…"
        value={evidence}
        onChange={(e) => setEvidence(e.target.value)}
        rows={5}
        spellCheck={false}
        style={{ resize: "vertical", minHeight: 96 }}
      />

      {hash && (
        <div className="pk-field-row" style={{ alignItems: "flex-start", marginTop: 10 }}>
          <span className="pk-dim" style={{ flexShrink: 0 }}>
            sha-256
          </span>
          <span
            className="pk-mono"
            style={{ fontSize: 11, wordBreak: "break-all" }}
          >
            {formatHashForDisplay(hash)}
          </span>
        </div>
      )}

      <button
        className="pk-btn pk-btn-amber"
        onClick={onNotarize}
        disabled={busy || !hash}
        style={{ marginTop: 12 }}
      >
        {busy ? "submitting to calendar…" : "⛏ notarize on blockchain"}
      </button>

      {result && (
        <div
          className="pk-mono"
          style={{
            fontSize: 12,
            marginTop: 12,
            padding: "10px 12px",
            borderRadius: 4,
            border: `1px solid ${
              confirmed
                ? "var(--color-terminal-green)"
                : "var(--color-warning-amber)"
            }`,
            background: confirmed
              ? "rgba(34,211,166,0.12)"
              : "rgba(240,169,59,0.12)",
            color: confirmed
              ? "var(--color-terminal-green)"
              : "var(--color-warning-amber)",
          }}
        >
          {pending && "◷ PENDING — awaiting Bitcoin confirmation"}
          {confirmed &&
            `✓ CONFIRMED — block #${result.confirmationBlock ?? "?"}`}
          <div style={{ fontSize: 10, marginTop: 4, opacity: 0.8 }}>
            submitted {new Date(result.timestamp).toLocaleString()}
          </div>
          {result.txHash && (
            <div className="pk-field-row" style={{ marginTop: 4 }}>
              <span className="pk-dim" style={{ opacity: 0.7 }}>
                tx
              </span>
              <span style={{ wordBreak: "break-all" }}>
                {formatHashForDisplay(result.txHash)}
              </span>
            </div>
          )}
        </div>
      )}

      {(merkleRoot || dagAnchor) && (
        <div
          style={{
            marginTop: 12,
            padding: "10px 12px",
            borderRadius: 4,
            border: "1px solid var(--color-border-dim)",
            background: "var(--color-void)",
          }}
        >
          {merkleRoot && (
            <div className="pk-field-row" style={{ alignItems: "flex-start" }}>
              <span className="pk-dim" style={{ flexShrink: 0 }}>
                merkle root
              </span>
              <span
                className="pk-mono"
                style={{ fontSize: 11, wordBreak: "break-all" }}
              >
                {formatHashForDisplay(merkleRoot)}
              </span>
            </div>
          )}
          {dagAnchor && (
            <div
              className="pk-field-row"
              style={{ alignItems: "flex-start", marginTop: 6 }}
            >
              <span className="pk-dim" style={{ flexShrink: 0 }}>
                dag anchor
              </span>
              <span
                className="pk-mono"
                style={{ fontSize: 11, wordBreak: "break-all" }}
              >
                {formatHashForDisplay(dagAnchor)}
              </span>
            </div>
          )}
        </div>
      )}
    </TerminalCard>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Page
   ═══════════════════════════════════════════════════════════════ */

export default function PressKitPage() {
  return (
    <div
      className="pk-mono"
      style={{
        maxWidth: 920,
        margin: "0 auto",
        padding: "32px 16px 64px",
        color: "var(--color-content-primary)",
      }}
    >
      <style>{PAGE_STYLES}</style>

      <header style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: "0.04em",
            margin: 0,
            color: "var(--color-content-primary)",
          }}
        >
          THE PRESS KIT
        </h1>
        <p
          className="pk-dim"
          style={{ fontSize: 12, marginTop: 6, maxWidth: 640 }}
        >
          Field-ready tools for reporters, activists, and whistleblowers.
          Strip metadata, redact identities, verify integrity, and anchor
          evidence to the blockchain — all client-side, all anonymous.
        </p>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <ExifStripper />
        <RegionRedaction />
        <IntegrityVerifier />
        <EvidenceNotarizer />
      </div>

      <footer
        className="pk-dim"
        style={{
          fontSize: 10,
          marginTop: 32,
          textAlign: "center",
          letterSpacing: "0.1em",
        }}
      >
        NO DATA LEAVES THIS PAGE · EVERYTHING RUNS IN YOUR BROWSER
      </footer>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Local styles
   ═══════════════════════════════════════════════════════════════ */

const PAGE_STYLES = `
.pk-mono { font-family: var(--font-mono); }
.pk-dim { color: var(--color-content-secondary); }
.pk-dropzone {
  border: 2px dashed var(--color-border-dim);
  border-radius: 6px;
  padding: 34px 16px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}
.pk-dropzone:hover {
  border-color: var(--color-blood-dim);
  background: rgba(196,43,62,0.04);
}
.pk-dropzone.active {
  border-color: var(--color-blood);
  background: rgba(196,43,62,0.08);
}
.pk-input {
  width: 100%;
  font-family: var(--font-mono);
  font-size: 12px;
  background: var(--color-void);
  border: 1px solid var(--color-border-dim);
  color: var(--color-content-primary);
  padding: 9px 11px;
  border-radius: 4px;
  outline: none;
  transition: border-color 0.15s;
}
.pk-input:focus { border-color: var(--color-command-dim); }
.pk-input::placeholder { color: var(--color-content-secondary); opacity: 0.6; }
.pk-btn {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 9px 16px;
  background: rgba(196,43,62,0.12);
  border: 1px solid var(--color-blood-dim);
  color: var(--color-blood-bright);
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.15s, border-color 0.15s, transform 0.05s, opacity 0.15s;
}
.pk-btn:hover:not(:disabled) {
  background: rgba(196,43,62,0.22);
  border-color: var(--color-blood);
}
.pk-btn:active:not(:disabled) { transform: translateY(1px); }
.pk-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.pk-btn-green {
  background: rgba(34,211,166,0.1);
  border-color: rgba(34,211,166,0.4);
  color: var(--color-terminal-green);
}
.pk-btn-green:hover:not(:disabled) {
  background: rgba(34,211,166,0.2);
  border-color: var(--color-terminal-green);
}
.pk-btn-amber {
  background: rgba(240,169,59,0.1);
  border-color: rgba(240,169,59,0.4);
  color: var(--color-warning-amber);
}
.pk-btn-amber:hover:not(:disabled) {
  background: rgba(240,169,59,0.2);
  border-color: var(--color-warning-amber);
}
.pk-field-row {
  font-family: var(--font-mono);
  font-size: 11px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 4px 0;
  border-bottom: 1px solid var(--color-border-dim);
}
.pk-preview { user-select: none; -webkit-user-drag: none; }
`;
