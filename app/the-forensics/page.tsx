"use client";

/**
 * V FOR X — The Forensics
 *
 * The verification counterpart to The Press Kit. Where the Press Kit
 * *strips* metadata before publication, The Forensics verifies what
 * remains *after* publication — or before you trust a source's image.
 *
 * Six panels, all 100% client-side canvas work:
 *   01 · Error-Level Analysis (ELA) — detect tampering / splicing
 *   02 · EXIF timeline — provenance, consistency, device fingerprint
 *   03 · Reverse-search launchers — TinEye / Yandex / Google Lens
 *   04 · Frame-by-frame video comparison — side-by-side & difference
 *   05 · Shadow-angle geolocation — estimate lat/long from a shadow
 *   06 · Skyline matching — overlay & blend two skylines
 *
 * No uploads, no servers, no telemetry. A source's material never
 * leaves the device.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type CSSProperties,
} from "react";
import TerminalCard from "@/components/ui/TerminalCard";
import {
  computeELA,
  elaVerdict,
  readExifForensics,
  fileToCanvas,
  sunPosition,
  shadowToLocation,
  elevationFromShadow,
  shadowLength,
  mapsUrl,
  fmtBytes,
  REVERSE_SEARCH_ENGINES,
  type ExifForensicsReport,
  type ElaResult,
} from "@/lib/forensics";
import { hashFile, formatHashForDisplay } from "@/lib/citizen-tools";

/* ═══════════════════════════════════════════════════════════════
   Shared helpers
   ═══════════════════════════════════════════════════════════════ */

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

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Canvas encoding failed"))),
      type,
      quality
    );
  });
}

/** A reusable drop-or-click image loader. */
function useImageLoader() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(f);
    });
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

  const clear = useCallback(() => {
    setFile(null);
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
  }, []);

  return { file, previewUrl, dragOver, setDragOver, inputRef, onFileChange, onDrop, clear };
}

/* ═══════════════════════════════════════════════════════════════
   01 · ERROR-LEVEL ANALYSIS
   ═══════════════════════════════════════════════════════════════ */

function ErrorLevelAnalysis() {
  const { file, previewUrl, dragOver, setDragOver, inputRef, onFileChange, onDrop } =
    useImageLoader();
  const [ela, setEla] = useState<ElaResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [quality, setQuality] = useState(90);
  const [amplify, setAmplify] = useState(28);
  const [error, setError] = useState<string | null>(null);
  const outRef = useRef<HTMLCanvasElement>(null);

  const runEla = useCallback(async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setEla(null);
    try {
      const canvas = await fileToCanvas(file);
      const res = await computeELA(canvas, quality / 100, amplify);
      setEla(res);
      const ctx = outRef.current?.getContext("2d");
      if (ctx && outRef.current) {
        outRef.current.width = res.canvas.width;
        outRef.current.height = res.canvas.height;
        ctx.drawImage(res.canvas, 0, 0);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setBusy(false);
    }
  }, [file, quality, amplify]);

  // Re-render the result canvas when amplify changes the verdict display.
  useEffect(() => {
    if (ela && outRef.current) {
      const ctx = outRef.current.getContext("2d");
      if (ctx) {
        outRef.current.width = ela.canvas.width;
        outRef.current.height = ela.canvas.height;
        ctx.drawImage(ela.canvas, 0, 0);
      }
    }
  }, [ela]);

  const verdict = ela ? elaVerdict(ela.stats) : null;

  return (
    <TerminalCard title="01 · error-level analysis" accent="blood" glow>
      <p className="fx-dim fx-mono" style={sx.help}>
        Re-encodes the image at a fixed JPEG quality and measures the per-pixel
        difference. Untouched regions settle into a uniform, low-error band;
        spliced, airbrushed, or re-saved regions flare bright. The classic
        first-pass tamper check.
      </p>

      <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onFileChange} />

      {!previewUrl ? (
        <div
          className={`fx-dropzone ${dragOver ? "active" : ""}`}
          onClick={() => inputRef.current?.click()}
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
        >
          <div style={{ color: "var(--color-blood-bright)", fontSize: 13 }}>⬡ DROP IMAGE TO ANALYZE</div>
          <div className="fx-dim" style={{ fontSize: 11, marginTop: 6 }}>or click to browse · jpg works best</div>
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
            <div style={{ flex: "1 1 240px", minWidth: 220 }}>
              <div className="fx-label">original</div>
              <img src={previewUrl} alt="original" className="fx-preview" />
            </div>
            <div style={{ flex: "1 1 240px", minWidth: 220 }}>
              <div className="fx-label">ELA · amplified diff</div>
              <canvas ref={outRef} className="fx-preview" style={{ background: "#000", display: ela ? "block" : "none" }} />
              {!ela && <div className="fx-placeholder">run analysis to see results</div>}
            </div>
          </div>

          <div className="fx-controls">
            <label className="fx-slider">
              <span className="fx-dim">quality</span>
              <input type="range" min={50} max={98} value={quality} onChange={(e) => setQuality(+e.target.value)} />
              <span className="fx-val">{quality}%</span>
            </label>
            <label className="fx-slider">
              <span className="fx-dim">amplify</span>
              <input type="range" min={5} max={60} value={amplify} onChange={(e) => setAmplify(+e.target.value)} />
              <span className="fx-val">×{amplify}</span>
            </label>
            <button className="fx-btn fx-btn-blood" onClick={runEla} disabled={busy}>
              {busy ? "analyzing…" : "▸ run ELA"}
            </button>
          </div>

          {error && <div className="fx-alert fx-alert-blood">✗ {error}</div>}

          {ela && verdict && (
            <div className={`fx-alert fx-alert-${verdict.level === "suspicious" ? "blood" : verdict.level === "watch" ? "amber" : "green"}`}>
              {verdict.level === "suspicious" ? "⚠ " : verdict.level === "clean" ? "✓ " : "◇ "}
              {verdict.label}
              <div className="fx-stats">
                <span>mean error: <b>{ela.stats.meanError.toFixed(1)}</b></span>
                <span>max: <b>{ela.stats.maxError.toFixed(0)}</b></span>
                <span>spread: <b>{ela.stats.stdev.toFixed(1)}</b></span>
                <span>hot pixels: <b>{(ela.stats.hotPixelsPct * 100).toFixed(1)}%</b></span>
              </div>
            </div>
          )}
        </div>
      )}
    </TerminalCard>
  );
}

/* ═══════════════════════════════════════════════════════════════
   02 · EXIF TIMELINE FORENSICS
   ═══════════════════════════════════════════════════════════════ */

function ExifTimeline() {
  const { file, previewUrl, dragOver, setDragOver, inputRef, onFileChange, onDrop } =
    useImageLoader();
  const [report, setReport] = useState<ExifForensicsReport | null>(null);
  const [hash, setHash] = useState("");
  const [busy, setBusy] = useState(false);

  const analyze = useCallback(async () => {
    if (!file) return;
    setBusy(true);
    try {
      const [rep, h] = await Promise.all([readExifForensics(file), hashFile(file)]);
      setReport(rep);
      setHash(h);
    } finally {
      setBusy(false);
    }
  }, [file]);

  return (
    <TerminalCard title="02 · exif timeline & metadata forensics" accent="amber">
      <p className="fx-dim fx-mono" style={sx.help}>
        Reads every embedded EXIF tag and reconstructs the provenance story:
        when it was shot, digitized, and last modified — and whether those
        timestamps agree. Flags GPS, editing software, and stripped metadata.
      </p>

      <input ref={inputRef} type="file" accept="image/jpeg,image/tiff,image/png" style={{ display: "none" }} onChange={onFileChange} />

      {!previewUrl ? (
        <div
          className={`fx-dropzone ${dragOver ? "active" : ""}`}
          onClick={() => inputRef.current?.click()}
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
        >
          <div style={{ color: "var(--color-warning-amber)", fontSize: 13 }}>⬡ DROP JPEG FOR EXIF SCAN</div>
          <div className="fx-dim" style={{ fontSize: 11, marginTop: 6 }}>or click to browse · JPEG/TIFF only</div>
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
            <img src={previewUrl} alt="scan target" className="fx-preview" style={{ maxWidth: 260 }} />
            <div style={{ flex: "1 1 260px", minWidth: 240 }}>
              <div className="fx-field-row"><span className="fx-dim">file</span><span>{file?.name}</span></div>
              <div className="fx-field-row"><span className="fx-dim">size</span><span>{file && fmtBytes(file.size)}</span></div>
              <div className="fx-field-row"><span className="fx-dim">type</span><span>{file?.type || "—"}</span></div>
              <button className="fx-btn fx-btn-amber" style={{ marginTop: 10 }} onClick={analyze} disabled={busy}>
                {busy ? "scanning…" : "▸ scan metadata"}
              </button>
            </div>
          </div>

          {report && !report.hasExif && (
            <div className="fx-alert fx-alert-green">
              ✓ NO EXIF FOUND — metadata was stripped (or this is not a JPEG). The Press Kit
              produces exactly this result. An image with no metadata is safe to publish, but
              cannot be verified for provenance.
            </div>
          )}

          {report && report.hasExif && (
            <div>
              {report.warnings.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  {report.warnings.map((w, i) => (
                    <div key={i} className="fx-alert fx-alert-blood">⚠ {w}</div>
                  ))}
                </div>
              )}

              {report.timeline.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div className="fx-section-label">TIMELINE</div>
                  {report.timeline.map((t, i) => (
                    <div key={i} className="fx-field-row">
                      <span className="fx-dim">{t.label}</span>
                      <span style={{ textAlign: "right" }}>
                        {t.raw}
                        {t.iso && <span className="fx-dim" style={{ marginLeft: 8, fontSize: 10 }}>({t.iso})</span>}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {report.deviceFingerprint && (
                <div className="fx-field-row" style={{ marginBottom: 12 }}>
                  <span className="fx-dim">device fingerprint</span>
                  <span style={{ color: "var(--color-warning-amber)" }}>{report.deviceFingerprint}</span>
                </div>
              )}

              {report.gps && (
                <div className="fx-alert fx-alert-green" style={{ marginBottom: 10 }}>
                  <span>✓ GPS: {report.gps.lat.toFixed(5)}, {report.gps.lng.toFixed(5)}</span>
                  <a href={mapsUrl(report.gps.lat, report.gps.lng)} target="_blank" rel="noopener noreferrer" className="fx-link">
                    view on map ↗
                  </a>
                </div>
              )}

              <div className="fx-section-label">ALL TAGS ({report.tags.length})</div>
              <div style={{ maxHeight: 240, overflowY: "auto", border: "1px solid var(--color-border-dim)", borderRadius: 4 }}>
                {report.tags.map((t, i) => (
                  <div key={i} className="fx-field-row">
                    <span className="fx-dim">{t.label} <span style={{ opacity: 0.5 }}>[{t.group}]</span></span>
                    <span style={{ textAlign: "right" }}>{t.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {hash && (
            <div className="fx-field-row" style={{ marginTop: 10, alignItems: "flex-start" }}>
              <span className="fx-dim" style={{ flexShrink: 0 }}>sha-256</span>
              <span className="fx-mono" style={{ fontSize: 11, wordBreak: "break-all" }}>{formatHashForDisplay(hash)}</span>
            </div>
          )}
        </div>
      )}
    </TerminalCard>
  );
}

/* ═══════════════════════════════════════════════════════════════
   03 · REVERSE-SEARCH LAUNCHERS
   ═══════════════════════════════════════════════════════════════ */

function ReverseSearch() {
  const { file, previewUrl, dragOver, setDragOver, inputRef, onFileChange, onDrop } =
    useImageLoader();

  return (
    <TerminalCard title="03 · reverse-image-search launchers" accent="green">
      <p className="fx-dim fx-mono" style={sx.help}>
        Find where else an image has appeared — the earliest upload, the
        original source, manipulated variants. Pick the image, then launch the
        three engines that matter. Browsers block automated uploads to
        third-party sites, so each opens its upload page; drag the same image in.
      </p>

      <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onFileChange} />

      {!previewUrl ? (
        <div
          className={`fx-dropzone ${dragOver ? "active" : ""}`}
          onClick={() => inputRef.current?.click()}
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
        >
          <div style={{ color: "var(--color-terminal-green)", fontSize: 13 }}>⬡ SELECT IMAGE TO SEARCH</div>
          <div className="fx-dim" style={{ fontSize: 11, marginTop: 6 }}>or click to browse</div>
        </div>
      ) : (
        <div>
          <img src={previewUrl} alt="search target" className="fx-preview" style={{ maxWidth: 280, marginBottom: 14 }} />
          <div className="fx-dim fx-mono" style={{ fontSize: 11, marginBottom: 10 }}>
            {file?.name} — ready to search across three engines:
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {REVERSE_SEARCH_ENGINES.map((eng) => (
              <a
                key={eng.id}
                href={eng.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`fx-btn fx-btn-${eng.accent} fx-launcher`}
              >
                <span>↗ {eng.label}</span>
                <span className="fx-dim" style={{ fontSize: 10 }}>{eng.hint}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </TerminalCard>
  );
}

/* ═══════════════════════════════════════════════════════════════
   04 · FRAME-BY-FRAME VIDEO COMPARISON
   ═══════════════════════════════════════════════════════════════ */

interface VideoSlot {
  file: File | null;
  url: string | null;
}

function VideoComparison() {
  const [a, setA] = useState<VideoSlot>({ file: null, url: null });
  const [b, setB] = useState<VideoSlot>({ file: null, url: null });
  const [mode, setMode] = useState<"split" | "difference" | "blink">("split");
  const [t, setT] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [diffScale, setDiffScale] = useState(3);
  const vidA = useRef<HTMLVideoElement>(null);
  const vidB = useRef<HTMLVideoElement>(null);
  const diffRef = useRef<HTMLCanvasElement>(null);
  const blinkTimer = useRef<number | null>(null);
  const blinkWhich = useRef(false);

  const loadVideo = (slot: "a" | "b") => (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    setSlot(slot, { file: f, url });
    setT(0);
    setDuration(0);
    setPlaying(false);
  };

  const setSlot = (slot: "a" | "b", v: VideoSlot) => {
    if (slot === "a") setA((old) => { if (old.url) URL.revokeObjectURL(old.url); return v; });
    else setB((old) => { if (old.url) URL.revokeObjectURL(old.url); return v; });
  };

  // Keep both video elements seeking together.
  const seek = useCallback((time: number) => {
    setT(time);
    if (vidA.current) vidA.current.currentTime = time;
    if (vidB.current) vidB.current.currentTime = time;
  }, []);

  const stepFrame = useCallback((dir: number) => {
    const fps = 30;
    seek(Math.max(0, t + dir / fps));
  }, [t, seek]);

  const togglePlay = useCallback(() => {
    const va = vidA.current;
    const vb = vidB.current;
    if (!va || !vb) return;
    if (playing) {
      va.pause();
      vb.pause();
      setPlaying(false);
    } else {
      va.play().catch(() => {});
      vb.play().catch(() => {});
      setPlaying(true);
    }
  }, [playing]);

  // Drive the difference canvas while playing.
  useEffect(() => {
    if (mode !== "difference" || !diffRef.current) return;
    let raf = 0;
    const draw = () => {
      const c = diffRef.current;
      const va = vidA.current;
      const vb = vidB.current;
      if (c && va && vb && va.videoWidth && vb.videoWidth) {
        const w = Math.min(va.videoWidth, vb.videoWidth);
        const hh = Math.min(va.videoHeight, vb.videoHeight);
        if (c.width !== w) c.width = w;
        if (c.height !== hh) c.height = hh;
        const ctx = c.getContext("2d");
        if (ctx) {
          ctx.globalCompositeOperation = "difference";
          ctx.drawImage(va, 0, 0, w, hh);
          ctx.drawImage(vb, 0, 0, w, hh);
          ctx.globalCompositeOperation = "source-over";
          // Amplify for visibility.
          if (diffScale !== 1) {
            const img = ctx.getImageData(0, 0, w, hh);
            for (let i = 0; i < img.data.length; i += 4) {
              img.data[i] = Math.min(255, img.data[i] * diffScale);
              img.data[i + 1] = Math.min(255, img.data[i + 1] * diffScale);
              img.data[i + 2] = Math.min(255, img.data[i + 2] * diffScale);
            }
            ctx.putImageData(img, 0, 0);
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [mode, diffScale]);

  // Blink mode alternates which video is visible.
  useEffect(() => {
    if (mode !== "blink") {
      if (blinkTimer.current) { clearInterval(blinkTimer.current); blinkTimer.current = null; }
      return;
    }
    blinkTimer.current = window.setInterval(() => {
      blinkWhich.current = !blinkWhich.current;
    }, 500);
    return () => { if (blinkTimer.current) clearInterval(blinkTimer.current); };
  }, [mode]);

  const ready = a.url && b.url;

  const videoInput = (slot: "a" | "b", v: VideoSlot, accent: string) => (
    <div style={{ flex: "1 1 240px", minWidth: 220 }}>
      <div className="fx-label" style={{ color: accent }}>video {slot.toUpperCase()}</div>
      <input type="file" accept="video/*" style={{ display: "none" }} id={`vid-${slot}`} onChange={loadVideo(slot)} />
      <label htmlFor={`vid-${slot}`} className="fx-file-label">
        {v.file ? `✓ ${v.file.name}` : "choose video…"}
      </label>
      {v.url && (
        <video
          ref={slot === "a" ? vidA : vidB}
          src={v.url}
          onLoadedMetadata={(e) => { if (slot === "a") setDuration(e.currentTarget.duration); }}
          onTimeUpdate={(e) => { if (playing) setT(e.currentTarget.currentTime); }}
          onEnded={() => setPlaying(false)}
          crossOrigin="anonymous"
          playsInline
          muted
          style={{
            width: "100%",
            marginTop: 8,
            borderRadius: 4,
            border: "1px solid var(--color-border-dim)",
            display: (mode === "split" || (mode === "blink" && slot === "a")) ? "block" : "none",
            opacity: mode === "blink" && slot === "a" ? (blinkWhich.current ? 1 : 0) : 1,
          }}
        />
      )}
    </div>
  );

  return (
    <TerminalCard title="04 · frame-by-frame video comparison" accent="blood">
      <p className="fx-dim fx-mono" style={sx.help}>
        Load two clips and scrub them frame by frame in lockstep. Compare
        side-by-side, blink between them, or run a pixel-difference overlay to
        expose added, removed, or composited content.
      </p>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
        {videoInput("a", a, "var(--color-blood-bright)")}
        {videoInput("b", b, "var(--color-terminal-green)")}
      </div>

      {ready && (
        <div>
          {mode === "difference" && (
            <div>
              <div className="fx-label">difference overlay (amplified)</div>
              <canvas ref={diffRef} className="fx-preview" style={{ background: "#000" }} />
            </div>
          )}

          <div className="fx-mode-row">
            {(["split", "blink", "difference"] as const).map((m) => (
              <button key={m} className={`fx-mode-btn ${mode === m ? "active" : ""}`} onClick={() => setMode(m)}>
                {m}
              </button>
            ))}
          </div>

          <div className="fx-scrub">
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={1 / 30}
              value={t}
              onChange={(e) => seek(+e.target.value)}
              style={{ flex: 1 }}
            />
            <span className="fx-mono" style={{ fontSize: 11, minWidth: 90, textAlign: "right" }}>
              {t.toFixed(2)}s / {duration.toFixed(2)}s
            </span>
          </div>

          <div className="fx-controls" style={{ marginTop: 8 }}>
            <button className="fx-btn" onClick={() => stepFrame(-1)}>◂ frame</button>
            <button className="fx-btn fx-btn-blood" onClick={togglePlay}>{playing ? "❚❚ pause" : "▸ play sync"}</button>
            <button className="fx-btn" onClick={() => stepFrame(1)}>frame ▸</button>
            {mode === "difference" && (
              <label className="fx-slider">
                <span className="fx-dim">amplify</span>
                <input type="range" min={1} max={10} value={diffScale} onChange={(e) => setDiffScale(+e.target.value)} />
                <span className="fx-val">×{diffScale}</span>
              </label>
            )}
          </div>
        </div>
      )}
    </TerminalCard>
  );
}

/* ═══════════════════════════════════════════════════════════════
   05 · SHADOW-ANGLE GEOLOCATION
   ═══════════════════════════════════════════════════════════════ */

function ShadowGeolocation() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("12:00");
  const [tz, setTz] = useState("0");
  const [objectHeight, setObjectHeight] = useState(100);
  const [shadowLength, setShadowLength] = useState(80);
  const [shadowBearing, setShadowBearing] = useState(180);

  // Forward-verification inputs.
  const [vLat, setVLat] = useState("");
  const [vLng, setVLng] = useState("");

  const utcDate = useMemo(() => {
    const local = new Date(`${date}T${time}:00`);
    const utcMs = local.getTime() - (Number(tz) * 60 * 60 * 1000);
    return new Date(utcMs);
  }, [date, time, tz]);

  const solarElevation = useMemo(
    () => elevationFromShadow(objectHeight, shadowLength),
    [objectHeight, shadowLength]
  );
  // Sun azimuth is opposite the shadow bearing.
  const sunAzimuth = useMemo(() => (shadowBearing + 180) % 360, [shadowBearing]);

  const estimate = useMemo(() => {
    if (solarElevation <= 0) return null;
    return shadowToLocation(utcDate, solarElevation, sunAzimuth);
  }, [utcDate, solarElevation, sunAzimuth]);

  const forward = useMemo(() => {
    const lat = parseFloat(vLat);
    const lng = parseFloat(vLng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return sunPosition(lat, lng, utcDate);
  }, [vLat, vLng, utcDate]);

  return (
    <TerminalCard title="05 · shadow-angle geolocation" accent="amber">
      <p className="fx-dim fx-mono" style={sx.help}>
        A cast shadow is a sun dial. Measure an object&apos;s height, its
        shadow&apos;s length, the direction the shadow points (bearing from
        North), and the exact time — then estimate where on Earth the photo was
        taken. Use the forward tool to verify against a candidate location.
      </p>

      <div className="fx-grid">
        <div>
          <div className="fx-section-label">MEASUREMENT</div>
          <label className="fx-field">
            <span className="fx-dim">date (local)</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="fx-field">
            <span className="fx-dim">time (local)</span>
            <input type="time" step={1} value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
          <label className="fx-field">
            <span className="fx-dim">UTC offset</span>
            <select value={tz} onChange={(e) => setTz(e.target.value)}>
              {[-12, -11, -10, -9, -8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 5.5, 6, 7, 8, 9, 9.5, 10, 11, 12].map((z) => (
                <option key={z} value={z}>UTC{z >= 0 ? "+" : ""}{z}</option>
              ))}
            </select>
          </label>
          <label className="fx-field">
            <span className="fx-dim">object height (any unit)</span>
            <input type="number" min={1} value={objectHeight} onChange={(e) => setObjectHeight(+e.target.value)} />
          </label>
          <label className="fx-field">
            <span className="fx-dim">shadow length (same unit)</span>
            <input type="number" min={0} value={shadowLength} onChange={(e) => setShadowLength(+e.target.value)} />
          </label>
          <label className="fx-field">
            <span className="fx-dim">shadow bearing ° (from N)</span>
            <input type="number" min={0} max={360} value={shadowBearing} onChange={(e) => setShadowBearing(+e.target.value)} />
          </label>
        </div>

        <div>
          <div className="fx-section-label">SOLAR GEOMETRY</div>
          <div className="fx-field-row"><span className="fx-dim">solar elevation</span><span>{solarElevation > 0 ? solarElevation.toFixed(2) + "°" : "below horizon"}</span></div>
          <div className="fx-field-row"><span className="fx-dim">sun azimuth</span><span>{sunAzimuth.toFixed(1)}°</span></div>
          <div className="fx-field-row"><span className="fx-dim">declination</span><span>{sunPosition(0, 0, utcDate).declination.toFixed(2)}°</span></div>
          <div className="fx-field-row"><span className="fx-dim">UTC instant</span><span className="fx-mono" style={{ fontSize: 11 }}>{utcDate.toISOString().slice(0, 19)}Z</span></div>

          <div className="fx-section-label" style={{ marginTop: 14 }}>ESTIMATED LOCATION</div>
          {solarElevation <= 0 ? (
            <div className="fx-alert fx-alert-blood">✗ Sun is below horizon — no cast shadow possible. Check measurements.</div>
          ) : estimate ? (
            <div className="fx-alert fx-alert-green">
              <div>lat {estimate.lat.toFixed(4)}°, lng {estimate.lng.toFixed(4)}°</div>
              <a href={mapsUrl(estimate.lat, estimate.lng)} target="_blank" rel="noopener noreferrer" className="fx-link">
                view estimated location on map ↗
              </a>
            </div>
          ) : (
            <div className="fx-alert fx-alert-amber">◇ Inputs are inconsistent — check bearing and elevation.</div>
          )}
          <div className="fx-dim" style={{ fontSize: 10, marginTop: 6 }}>
            Estimate from solar geometry; accuracy depends on precise time & bearing. Cross-check against landmarks.
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16, borderTop: "1px solid var(--color-border-dim)", paddingTop: 14 }}>
        <div className="fx-section-label">FORWARD VERIFICATION</div>
        <p className="fx-dim fx-mono" style={{ fontSize: 11, marginBottom: 8 }}>
          Enter a candidate location to check what the sun & shadow should look like at that moment.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
          <input className="fx-input" placeholder="latitude" value={vLat} onChange={(e) => setVLat(e.target.value)} />
          <input className="fx-input" placeholder="longitude" value={vLng} onChange={(e) => setVLng(e.target.value)} />
        </div>
        {forward && (
          <div>
            <div className="fx-field-row"><span className="fx-dim">expected sun elevation</span><span>{forward.elevation.toFixed(2)}°</span></div>
            <div className="fx-field-row"><span className="fx-dim">expected sun azimuth</span><span>{forward.azimuth.toFixed(1)}°</span></div>
            <div className="fx-field-row"><span className="fx-dim">expected shadow bearing</span><span>{((forward.azimuth + 180) % 360).toFixed(1)}°</span></div>
            <div className="fx-field-row"><span className="fx-dim">expected shadow/height ratio</span><span>{shadowLengthPerHeight(forward.elevation).toFixed(3)}</span></div>
          </div>
        )}
      </div>
    </TerminalCard>
  );
}

function shadowLengthPerHeight(elevationDeg: number): number {
  if (elevationDeg <= 0) return Infinity;
  return 1 / Math.tan(elevationDeg * (Math.PI / 180));
}

/* ═══════════════════════════════════════════════════════════════
   06 · SKYLINE MATCHING
   ═══════════════════════════════════════════════════════════════ */

function SkylineMatching() {
  const ref = useImageLoader();
  const cand = useImageLoader();
  const stackRef = useRef<HTMLCanvasElement>(null);
  const [opacity, setOpacity] = useState(50);
  const [align, setAlign] = useState<"left" | "stretch">("stretch");

  const buildComposite = useCallback(async () => {
    if (!ref.previewUrl || !cand.previewUrl || !stackRef.current) return;
    const [imgA, imgB] = await Promise.all([loadImg(ref.previewUrl), loadImg(cand.previewUrl)]);
    const c = stackRef.current;
    const w = Math.max(imgA.naturalWidth, imgB.naturalWidth);
    const h = Math.max(imgA.naturalHeight, imgB.naturalHeight);
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#060b14";
    ctx.fillRect(0, 0, w, h);
    const drawFit = (img: HTMLImageElement) => {
      if (align === "stretch") ctx.drawImage(img, 0, 0, w, h);
      else ctx.drawImage(img, 0, 0);
    };
    ctx.globalAlpha = 1;
    drawFit(imgA);
    ctx.globalAlpha = opacity / 100;
    drawFit(imgB);
    ctx.globalAlpha = 1;
  }, [ref.previewUrl, cand.previewUrl, opacity, align]);

  useEffect(() => {
    buildComposite();
  }, [buildComposite]);

  const onDownload = useCallback(async () => {
    if (!stackRef.current) return;
    const blob = await canvasToBlob(stackRef.current, "image/png");
    downloadBlob(blob, "skyline-composite.png");
  }, []);

  const both = ref.previewUrl && cand.previewUrl;

  return (
    <TerminalCard title="06 · skyline matching" accent="green">
      <p className="fx-dim fx-mono" style={sx.help}>
        Identify an unknown skyline by overlaying it against a known reference.
        Load the reference (top) and the candidate, then drag the opacity slider
        to blend them. Misaligned silhouettes reveal mismatches instantly.
      </p>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
        <SkylineSlot label="reference" loader={ref} accent="var(--color-terminal-green)" />
        <SkylineSlot label="candidate (unknown)" loader={cand} accent="var(--color-warning-amber)" />
      </div>

      {both && (
        <div>
          <div className="fx-label">composite overlay</div>
          <canvas ref={stackRef} className="fx-preview" style={{ background: "#060b14" }} />
          <div className="fx-controls" style={{ marginTop: 10 }}>
            <label className="fx-slider">
              <span className="fx-dim">candidate opacity</span>
              <input type="range" min={0} max={100} value={opacity} onChange={(e) => setOpacity(+e.target.value)} />
              <span className="fx-val">{opacity}%</span>
            </label>
            <label className="fx-slider">
              <span className="fx-dim">align</span>
              <select value={align} onChange={(e) => setAlign(e.target.value as "left" | "stretch")} className="fx-select">
                <option value="stretch">stretch to fit</option>
                <option value="left">natural (top-left)</option>
              </select>
            </label>
            <button className="fx-btn fx-btn-green" onClick={onDownload}>⬇ download composite</button>
          </div>
        </div>
      )}
    </TerminalCard>
  );
}

function SkylineSlot({
  label,
  loader,
  accent,
}: {
  label: string;
  loader: ReturnType<typeof useImageLoader>;
  accent: string;
}) {
  const { previewUrl, dragOver, setDragOver, inputRef, onFileChange, onDrop } = loader;
  return (
    <div style={{ flex: "1 1 200px", minWidth: 200 }}>
      <div className="fx-label" style={{ color: accent }}>{label}</div>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onFileChange} />
      {!previewUrl ? (
        <div
          className={`fx-dropzone ${dragOver ? "active" : ""}`}
          style={{ padding: "20px 12px" }}
          onClick={() => inputRef.current?.click()}
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
        >
          <div className="fx-dim" style={{ fontSize: 11 }}>⬡ drop image</div>
        </div>
      ) : (
        <img src={previewUrl} alt={label} className="fx-preview" />
      )}
    </div>
  );
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/* ═══════════════════════════════════════════════════════════════
   Page
   ═══════════════════════════════════════════════════════════════ */

const sx = {
  help: { fontSize: 11, marginBottom: 12 } as CSSProperties,
};

export default function ForensicsPage() {
  return (
    <div className="fx-mono" style={{ maxWidth: 940, margin: "0 auto", padding: "32px 16px 64px", color: "var(--color-content-primary)" }}>
      <style>{PAGE_STYLES}</style>

      <header style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "0.04em", margin: 0, color: "var(--color-content-primary)" }}>
          THE FORENSICS
        </h1>
        <p className="fx-dim" style={{ fontSize: 12, marginTop: 6, maxWidth: 680 }}>
          The press kit strips metadata; this verifies it. Drop an image to run
          error-level analysis, reconstruct the EXIF timeline, launch reverse
          searches, compare video frames, and geolocate a shadow. Citizen
          journalists publish before verifying — this closes the gap.
        </p>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <ErrorLevelAnalysis />
        <ExifTimeline />
        <ReverseSearch />
        <VideoComparison />
        <ShadowGeolocation />
        <SkylineMatching />
      </div>

      <footer className="fx-dim" style={{ fontSize: 10, marginTop: 32, textAlign: "center", letterSpacing: "0.1em" }}>
        NO DATA LEAVES THIS PAGE · EVERYTHING RUNS IN YOUR BROWSER
      </footer>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Local styles
   ═══════════════════════════════════════════════════════════════ */

const PAGE_STYLES = `
.fx-mono { font-family: var(--font-mono); }
.fx-dim { color: var(--color-content-secondary); }
.fx-label {
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-content-secondary);
  margin-bottom: 6px;
}
.fx-section-label {
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--color-content-dim);
  margin-bottom: 8px;
}
.fx-dropzone {
  border: 2px dashed var(--color-border-dim);
  border-radius: 6px;
  padding: 34px 16px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}
.fx-dropzone:hover { border-color: var(--color-border-bright); background: rgba(255,255,255,0.02); }
.fx-dropzone.active { border-color: var(--color-blood); background: rgba(196,43,62,0.08); }
.fx-preview {
  width: 100%;
  border-radius: 4px;
  border: 1px solid var(--color-border-dim);
  user-select: none;
  -webkit-user-drag: none;
  display: block;
}
.fx-placeholder {
  width: 100%;
  min-height: 160px;
  border: 1px dashed var(--color-border-dim);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: var(--color-content-dim);
}
.fx-input, .fx-select {
  font-family: var(--font-mono);
  font-size: 12px;
  background: var(--color-void);
  border: 1px solid var(--color-border-dim);
  color: var(--color-content-primary);
  padding: 9px 11px;
  border-radius: 4px;
  outline: none;
  flex: 1;
  min-width: 120px;
  transition: border-color 0.15s;
}
.fx-input:focus, .fx-select:focus { border-color: var(--color-border-bright); }
.fx-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
}
.fx-field span { font-size: 11px; }
.fx-field input, .fx-field select {
  font-family: var(--font-mono);
  font-size: 12px;
  background: var(--color-void);
  border: 1px solid var(--color-border-dim);
  color: var(--color-content-primary);
  padding: 7px 9px;
  border-radius: 4px;
  outline: none;
}
.fx-field input:focus, .fx-field select:focus { border-color: var(--color-border-bright); }
.fx-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}
@media (max-width: 640px) { .fx-grid { grid-template-columns: 1fr; } }
.fx-field-row {
  font-family: var(--font-mono);
  font-size: 11px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 4px 0;
  border-bottom: 1px solid var(--color-border-dim);
}
.fx-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.fx-slider {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
}
.fx-slider input[type=range] { width: 110px; accent-color: var(--color-blood); }
.fx-val { color: var(--color-content-primary); min-width: 34px; }
.fx-btn {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 9px 16px;
  background: var(--color-panel);
  border: 1px solid var(--color-border-dim);
  color: var(--color-content-primary);
  cursor: pointer;
  border-radius: 4px;
  text-decoration: none;
  transition: background 0.15s, border-color 0.15s, transform 0.05s, opacity 0.15s;
}
.fx-btn:hover:not(:disabled) { background: var(--color-panel-hi); border-color: var(--color-border-bright); }
.fx-btn:active:not(:disabled) { transform: translateY(1px); }
.fx-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.fx-btn-blood { background: rgba(196,43,62,0.12); border-color: var(--color-blood-dim); color: var(--color-blood-bright); }
.fx-btn-blood:hover:not(:disabled) { background: rgba(196,43,62,0.22); border-color: var(--color-blood); }
.fx-btn-green { background: rgba(34,211,166,0.1); border-color: rgba(34,211,166,0.4); color: var(--color-terminal-green); }
.fx-btn-green:hover:not(:disabled) { background: rgba(34,211,166,0.2); border-color: var(--color-terminal-green); }
.fx-btn-amber { background: rgba(240,169,59,0.1); border-color: rgba(240,169,59,0.4); color: var(--color-warning-amber); }
.fx-btn-amber:hover:not(:disabled) { background: rgba(240,169,59,0.2); border-color: var(--color-warning-amber); }
.fx-launcher {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  text-align: left;
}
.fx-alert {
  font-family: var(--font-mono);
  font-size: 12px;
  padding: 10px 12px;
  border-radius: 4px;
  margin-top: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.fx-alert-green { background: rgba(34,211,166,0.12); border: 1px solid var(--color-terminal-green); color: var(--color-terminal-green); }
.fx-alert-blood { background: rgba(196,43,62,0.15); border: 1px solid var(--color-blood); color: var(--color-blood-bright); }
.fx-alert-amber { background: rgba(240,169,59,0.12); border: 1px solid var(--color-warning-amber); color: var(--color-warning-amber); }
.fx-stats {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  font-size: 10px;
  opacity: 0.85;
  margin-top: 4px;
}
.fx-stats b { color: inherit; }
.fx-link { color: inherit; text-decoration: underline; font-size: 11px; }
.fx-link:hover { opacity: 0.8; }
.fx-mode-row { display: flex; gap: 0; margin: 12px 0 8px; border: 1px solid var(--color-border-dim); border-radius: 4px; overflow: hidden; width: fit-content; }
.fx-mode-btn {
  font-family: var(--font-mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 7px 14px;
  background: transparent;
  border: none;
  border-right: 1px solid var(--color-border-dim);
  color: var(--color-content-secondary);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.fx-mode-btn:last-child { border-right: none; }
.fx-mode-btn:hover { background: var(--color-panel); color: var(--color-content-primary); }
.fx-mode-btn.active { background: rgba(196,43,62,0.18); color: var(--color-blood-bright); }
.fx-scrub { display: flex; align-items: center; gap: 10px; color: var(--color-content-secondary); }
.fx-scrub input[type=range] { accent-color: var(--color-blood); }
.fx-file-label {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 9px 14px;
  background: var(--color-panel);
  border: 1px dashed var(--color-border-bright);
  border-radius: 4px;
  color: var(--color-content-secondary);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}
.fx-file-label:hover { border-color: var(--color-blood); color: var(--color-blood-bright); }
`;
