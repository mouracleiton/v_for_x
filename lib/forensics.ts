/**
 * V FOR X — The Forensics (OSINT verification toolkit)
 *
 * Pure, client-side image & video verification primitives. No network
 * calls, no uploads, no telemetry. Everything runs against the local
 * pixel buffer so a source's material never leaves the device.
 *
 *   • Error-Level Analysis (ELA) — detect re-encoded / pasted regions
 *   • EXIF forensics — provenance, timeline consistency, device fingerprint
 *   • Sun/shadow geometry — estimate lat/long from a cast shadow
 *   • Reverse-search launchers — TinEye / Yandex / Google Lens
 *
 * Used by /the-forensics — the verification counterpart to /the-press-kit
 * (which strips metadata; this verifies what remains).
 */

/* ═══════════════════════════════════════════════════════════════
   Canvas helpers (self-contained — do not depend on citizen-tools)
   ═══════════════════════════════════════════════════════════════ */

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas encoding failed"))),
      type,
      quality
    );
  });
}

function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image could not be decoded"));
    };
    img.src = url;
  });
}

/** Decode an image File into a fresh canvas of natural pixel dimensions. */
export async function fileToCanvas(file: File | Blob): Promise<HTMLCanvasElement> {
  if (typeof document === "undefined")
    throw new Error("Image rendering requires a browser environment");
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Image could not be decoded"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    ctx.drawImage(img, 0, 0);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* ═══════════════════════════════════════════════════════════════
   1 · ERROR-LEVEL ANALYSIS (ELA)
   ═══════════════════════════════════════════════════════════════

   Re-encode the image at a known JPEG quality, then measure the
   per-pixel difference against the original. Untouched regions settle
   to a uniform low error band; regions that were spliced in, airbrushed,
   or re-saved at a different quality stand out as bright patches. */

export interface ElaStats {
  /** Mean absolute pixel error across the whole image (0-255). */
  meanError: number;
  /** Worst single-pixel error (0-255). */
  maxError: number;
  /** Fraction of pixels whose error exceeds the hot threshold (0-1). */
  hotPixelsPct: number;
  /** Standard deviation of the error (0-255) — high spread = inconsistent. */
  stdev: number;
}

export interface ElaResult {
  /** Grayscale amplified difference map as a standalone canvas. */
  canvas: HTMLCanvasElement;
  stats: ElaStats;
}

/**
 * Run ELA on an already-decoded source canvas.
 * @param quality JPEG re-encode quality (0-1, default 0.9). Lower = noisier.
 * @param amplify Multiplier applied to the difference for display (default 28).
 * @param hotThreshold Per-pixel error above which a pixel counts as "hot".
 */
export async function computeELA(
  source: HTMLCanvasElement,
  quality = 0.9,
  amplify = 28,
  hotThreshold = 12
): Promise<ElaResult> {
  const w = source.width;
  const h = source.height;
  if (w === 0 || h === 0) throw new Error("Source canvas is empty");

  const sCtx = source.getContext("2d");
  if (!sCtx) throw new Error("Canvas 2D context unavailable");
  const original = sCtx.getImageData(0, 0, w, h);

  // Re-encode the source as JPEG, then decode back to pixels.
  const blob = await canvasToBlob(source, "image/jpeg", quality);
  const reImg = await blobToImage(blob);
  const reCanvas = document.createElement("canvas");
  reCanvas.width = w;
  reCanvas.height = h;
  const reCtx = reCanvas.getContext("2d");
  if (!reCtx) throw new Error("Canvas 2D context unavailable");
  reCtx.drawImage(reImg, 0, 0);
  const reencoded = reCtx.getImageData(0, 0, w, h);

  const out = sCtx.createImageData(w, h);
  const n = w * h;
  let sum = 0;
  let max = 0;
  let hot = 0;

  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const dr = Math.abs(original.data[o] - reencoded.data[o]);
    const dg = Math.abs(original.data[o + 1] - reencoded.data[o + 1]);
    const db = Math.abs(original.data[o + 2] - reencoded.data[o + 2]);
    const diff = (dr + dg + db) / 3;
    sum += diff;
    if (diff > max) max = diff;
    if (diff > hotThreshold) hot++;

    // Brighter = larger error. Clamp to 255.
    const v = diff * amplify > 255 ? 255 : diff * amplify;
    out.data[o] = v;
    out.data[o + 1] = v;
    out.data[o + 2] = v;
    out.data[o + 3] = 255;
  }

  const mean = sum / n;
  let sqSum = 0;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const diff = (Math.abs(original.data[o] - reencoded.data[o]) +
      Math.abs(original.data[o + 1] - reencoded.data[o + 1]) +
      Math.abs(original.data[o + 2] - reencoded.data[o + 2])) / 3;
    const d = diff - mean;
    sqSum += d * d;
  }

  const outCanvas = document.createElement("canvas");
  outCanvas.width = w;
  outCanvas.height = h;
  const outCtx = outCanvas.getContext("2d");
  if (!outCtx) throw new Error("Canvas 2D context unavailable");
  outCtx.putImageData(out, 0, 0);

  return {
    canvas: outCanvas,
    stats: {
      meanError: mean,
      maxError: max,
      hotPixelsPct: hot / n,
      stdev: Math.sqrt(sqSum / n),
    },
  };
}

/** Classify an ELA result into a human-readable tamper assessment. */
export function elaVerdict(stats: ElaStats): {
  label: string;
  level: "clean" | "watch" | "suspicious";
} {
  // High standard deviation relative to the mean is the classic splice
  // signature: a uniform image would show tight, even error everywhere.
  if (stats.stdev > 18 || stats.hotPixelsPct > 0.12) {
    return { label: "INCONSISTENT ERROR — regions may have been edited", level: "suspicious" };
  }
  if (stats.stdev > 9 || stats.hotPixelsPct > 0.04) {
    return { label: "UNEVEN ERROR PATTERN — inspect bright clusters", level: "watch" };
  }
  return { label: "UNIFORM ERROR — no obvious splice detected", level: "clean" };
}

/* ═══════════════════════════════════════════════════════════════
   2 · EXIF FORENSICS

   A richer JPEG/TIFF EXIF reader than the press-kit stripper. Produces
   a provenance report: full tag list, a timestamp timeline (with
   consistency checks), a device fingerprint, and embedded GPS.
   ═══════════════════════════════════════════════════════════════ */

export interface ExifTag {
  group: string;
  tag: string;
  label: string;
  value: string;
}

export interface ExifTimelineEntry {
  label: string;
  /** Raw EXIF string, e.g. "2024:03:14 15:09:42". */
  raw: string;
  /** ISO-8601 if parseable, else null. */
  iso: string | null;
}

export interface GpsData {
  lat: number;
  lng: number;
  alt?: number;
  /** Raw bearing if present. */
  imgDirection?: number;
}

export interface ExifForensicsReport {
  hasExif: boolean;
  hasGps: boolean;
  hasThumbnail: boolean;
  tags: ExifTag[];
  timeline: ExifTimelineEntry[];
  gps: GpsData | null;
  /** Stable fingerprint of camera/software identity. */
  deviceFingerprint: string;
  warnings: string[];
}

export const EMPTY_EXIF_REPORT: ExifForensicsReport = {
  hasExif: false,
  hasGps: false,
  hasThumbnail: false,
  tags: [],
  timeline: [],
  gps: null,
  deviceFingerprint: "",
  warnings: [],
};

const EXIF_TYPE_SIZE: Record<number, number> = {
  1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8,
};

interface IfdEntry {
  type: number;
  count: number;
  dataOffset: number;
}

function readExifValue(view: DataView, offset: number, type: number, little: boolean): number {
  switch (type) {
    case 1: case 6: case 7:
      return view.getUint8(offset);
    case 2:
      return view.getUint8(offset);
    case 3: case 8:
      return view.getUint16(offset, little);
    case 4: case 9:
      return view.getUint32(offset, little);
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
    case 11:
      return view.getFloat32(offset, little);
    case 12:
      return view.getFloat64(offset, little);
    default:
      return 0;
  }
}

function readExifAscii(bytes: Uint8Array, offset: number, len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) {
    const c = bytes[offset + i];
    if (c === 0) break;
    s += c >= 32 && c < 127 ? String.fromCharCode(c) : "";
  }
  return s.trim();
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

/** Parse an EXIF datetime string "YYYY:MM:DD HH:MM:SS" into ISO, or null. */
function exifDateToIso(raw: string): string | null {
  const m = raw.match(/^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  return `${y}-${mo}-${d}T${h}:${mi}:${s}`;
}

/**
 * Read a comprehensive EXIF report from a JPEG/TIFF file.
 * Best-effort: never throws; returns an empty report on failure.
 */
export function readExifForensics(file: File): Promise<ExifForensicsReport> {
  return file.arrayBuffer().then((ab) => {
    try {
      const bytes = new Uint8Array(ab);
      const view = new DataView(ab);
      if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8)
        return EMPTY_EXIF_REPORT;

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
          exifStart = offset + 10;
          break;
        }
        offset += 2 + segLen;
        if (segLen === 0) break;
      }
      if (exifStart < 0 || exifStart + 8 > bytes.length) return EMPTY_EXIF_REPORT;

      const tiffBase = exifStart;
      const little = bytes[tiffBase] === 0x49; // "II" little-endian
      if (view.getUint16(tiffBase + 2, little) !== 0x002a) return EMPTY_EXIF_REPORT;
      const ifd0Offset = view.getUint32(tiffBase + 4, little) + tiffBase;
      const ifd0 = readIfd(view, ifd0Offset, little, tiffBase);

      // Detect a linked thumbnail (next IFD pointer).
      let hasThumbnail = false;
      if (ifd0Offset + 2 <= view.byteLength) {
        const count = view.getUint16(ifd0Offset, little);
        const nextIfdPtrOff = ifd0Offset + 2 + count * 12;
        if (nextIfdPtrOff + 4 <= view.byteLength) {
          const nextIfd = view.getUint32(nextIfdPtrOff, little);
          if (nextIfd !== 0) hasThumbnail = true;
        }
      }

      const tags: ExifTag[] = [];
      const warnings: string[] = [];

      const asciiTag = (map: Map<number, IfdEntry>, group: string, tag: string, id: number) => {
        const e = map.get(id);
        if (e && e.type === 2) {
          const val = readExifAscii(bytes, e.dataOffset, e.count);
          if (val) tags.push({ group, tag: "0x" + id.toString(16), label: tag, value: val });
        }
      };
      const numTag = (
        map: Map<number, IfdEntry>,
        group: string,
        tag: string,
        id: number,
        fmt?: (n: number) => string
      ) => {
        const e = map.get(id);
        if (e) {
          const v = readExifValue(view, e.dataOffset, e.type, little);
          if (v !== 0 || (e.type !== 3 && e.type !== 4))
            tags.push({ group, tag: "0x" + id.toString(16), label: tag, value: fmt ? fmt(v) : String(Math.round(v)) });
        }
      };

      // ── IFD0 (base image) ──
      asciiTag(ifd0, "IFD0", "Make", 0x010f);
      asciiTag(ifd0, "IFD0", "Model", 0x0110);
      asciiTag(ifd0, "IFD0", "Orientation", 0x0112);
      numTag(ifd0, "IFD0", "Orientation", 0x0112, (n) =>
        n === 1 ? "Normal" : n === 6 ? "Rotated 90° CW" : n === 8 ? "Rotated 90° CCW" : n === 3 ? "Rotated 180°" : String(n)
      );
      asciiTag(ifd0, "IFD0", "Software", 0x0131);
      asciiTag(ifd0, "IFD0", "Artist", 0x013b);
      asciiTag(ifd0, "IFD0", "Copyright", 0x8298);
      asciiTag(ifd0, "IFD0", "DateTime (modified)", 0x0132);

      // ── Exif sub-IFD ──
      const exifPtr = ifd0.get(0x8769);
      if (exifPtr) {
        const exifOff = readExifValue(view, exifPtr.dataOffset, exifPtr.type, little) + tiffBase;
        const exifIfd = readIfd(view, exifOff, little, tiffBase);
        asciiTag(exifIfd, "Exif", "DateTimeOriginal", 0x9003);
        asciiTag(exifIfd, "Exif", "DateTimeDigitized", 0x9004);
        numTag(exifIfd, "Exif", "ExposureTime", 0x829a, (n) => {
          if (n >= 1) return n.toFixed(0) + " s";
          return "1/" + Math.round(1 / n) + " s";
        });
        numTag(exifIfd, "Exif", "FNumber", 0x829d, (n) => "f/" + (Math.round(n * 10) / 10));
        numTag(exifIfd, "Exif", "ISOSpeedRatings", 0x8827, (n) => "ISO " + Math.round(n));
        numTag(exifIfd, "Exif", "FocalLength", 0x920a, (n) => n + " mm");
        numTag(exifIfd, "Exif", "Flash", 0x9209, (n) => (n & 1 ? "Fired" : "Off"));
        numTag(exifIfd, "Exif", "ExifImageWidth", 0xa002);
        numTag(exifIfd, "Exif", "ExifImageHeight", 0xa003);
        asciiTag(exifIfd, "Exif", "LensMake", 0xa433);
        asciiTag(exifIfd, "Exif", "LensModel", 0xa434);
        numTag(exifIfd, "Exif", "ColorSpace", 0xa001, (n) =>
          n === 1 ? "sRGB" : n === 0xffff ? "Uncalibrated" : String(n)
        );
      }

      // ── GPS sub-IFD ──
      let gps: GpsData | null = null;
      let hasGps = false;
      const gpsPtr = ifd0.get(0x8825);
      if (gpsPtr) {
        const gpsOff = readExifValue(view, gpsPtr.dataOffset, gpsPtr.type, little) + tiffBase;
        const gpsIfd = readIfd(view, gpsOff, little, tiffBase);
        const lat = gpsIfd.get(0x0002);
        const latRef = gpsIfd.get(0x0001);
        const lng = gpsIfd.get(0x0004);
        const lngRef = gpsIfd.get(0x0003);
        if ((lat || lng) && latRef && lngRef) {
          hasGps = true;
          let latVal = lat ? readGpsCoord(view, lat, little) : 0;
          let lngVal = lng ? readGpsCoord(view, lng, little) : 0;
          const latRefVal = readExifAscii(bytes, latRef.dataOffset, latRef.count);
          const lngRefVal = readExifAscii(bytes, lngRef.dataOffset, lngRef.count);
          if (latRefVal.startsWith("S")) latVal = -latVal;
          if (lngRefVal.startsWith("W")) lngVal = -lngVal;
          const alt = gpsIfd.get(0x0006);
          gps = { lat: latVal, lng: lngVal };
          if (alt) gps.alt = readExifValue(view, alt.dataOffset, alt.type, little);
          const dir = gpsIfd.get(0x0011);
          if (dir) gps.imgDirection = readExifValue(view, dir.dataOffset, dir.type, little);
          tags.push({ group: "GPS", tag: "0x0002", label: "GPSLatitude", value: latVal.toFixed(6) + "°" });
          tags.push({ group: "GPS", tag: "0x0004", label: "GPSLongitude", value: lngVal.toFixed(6) + "°" });
          if (gps.alt !== undefined)
            tags.push({ group: "GPS", tag: "0x0006", label: "GPSAltitude", value: gps.alt.toFixed(1) + " m" });
        }
      }

      // ── Timeline (all timestamps, with consistency check) ──
      const timeline: ExifTimelineEntry[] = [];
      for (const t of tags) {
        if (t.label.startsWith("DateTime")) {
          timeline.push({ label: t.label, raw: t.value, iso: exifDateToIso(t.value) });
        }
      }
      if (timeline.length > 1) {
        const isos = timeline.map((t) => t.iso).filter((x): x is string => !!x);
        if (isos.length > 1) {
          const allSame = isos.every((x) => x === isos[0]);
          if (!allSame) {
            warnings.push("Timestamps disagree — original/digitized/modified times are not identical.");
          }
        }
      }

      // ── Device fingerprint ──
      const make = tags.find((t) => t.label === "Make")?.value;
      const model = tags.find((t) => t.label === "Model")?.value;
      const software = tags.find((t) => t.label === "Software")?.value;
      const lens = tags.find((t) => t.label === "LensModel")?.value;
      const parts = [make, model, lens, software].filter(Boolean);
      const deviceFingerprint = parts.join(" · ");

      if (hasGps) warnings.push("GPS coordinates are embedded — this image locates the photographer.");
      if (software && /photoshop|gimp|lightroom|affinity|snapseed|pixlr/i.test(software))
        warnings.push("Editing software detected in metadata: " + software);
      if (timeline.length === 0) {
        warnings.push("No timestamps found — metadata may have been stripped.");
      }

      return {
        hasExif: tags.length > 0,
        hasGps,
        hasThumbnail,
        tags,
        timeline,
        gps,
        deviceFingerprint,
        warnings,
      };
    } catch {
      return EMPTY_EXIF_REPORT;
    }
  });
}

/* ═══════════════════════════════════════════════════════════════
   3 · SUN / SHADOW GEOMETRY  (NOAA solar approximation)

   Forward:  sunPosition(lat, lng, date) → elevation, azimuth, declination
   Inverse:  shadowToLocation(date, elev, azim) → estimated { lat, lng }
   ═══════════════════════════════════════════════════════════════ */

const DEG = Math.PI / 180;

function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const diff = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor((diff - start) / 86400000);
}

export interface SunPosition {
  /** Solar elevation above horizon, degrees (-90..90). */
  elevation: number;
  /** Solar azimuth clockwise from true North, degrees (0..360). */
  azimuth: number;
  /** Solar declination, degrees. */
  declination: number;
  /** Equation of time, minutes. */
  eqTime: number;
}

/**
 * Solar position for a given observer and UTC instant.
 * Uses the NOAA fractional-year approximation (accurate to ~0.01°).
 */
export function sunPosition(lat: number, lng: number, date: Date): SunPosition {
  const fracHour =
    date.getUTCHours() +
    date.getUTCMinutes() / 60 +
    date.getUTCSeconds() / 3600;
  const gamma = (2 * Math.PI) / 365 * (dayOfYear(date) - 1 + (fracHour - 12) / 24);

  // Equation of time (minutes).
  const eqTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));

  // Solar declination (radians).
  const decl =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);

  const timeOffset = eqTime + 4 * lng; // minutes
  const tst = fracHour * 60 + timeOffset; // true solar time, minutes
  const ha = DEG * (tst / 4 - 180); // hour angle, radians

  const latR = lat * DEG;
  const cosZen =
    Math.sin(latR) * Math.sin(decl) + Math.cos(latR) * Math.cos(decl) * Math.cos(ha);
  const elevation = Math.PI / 2 - Math.acos(clamp(cosZen, -1, 1));

  // Azimuth via the local direction vector (unambiguous, clockwise from North).
  const east = -Math.cos(decl) * Math.sin(ha);
  const north = Math.cos(latR) * Math.sin(decl) - Math.sin(latR) * Math.cos(decl) * Math.cos(ha);
  let azimuth = Math.atan2(east, north) / DEG;
  if (azimuth < 0) azimuth += 360;

  return {
    elevation: elevation / DEG,
    azimuth,
    declination: decl / DEG,
    eqTime,
  };
}

/**
 * Inverse problem: estimate latitude/longitude from a cast shadow.
 *
 * @param date UTC date/time the photo was taken.
 * @param elevation Solar elevation in degrees (from shadow length / object height).
 * @param azimuth Solar azimuth in degrees clockwise from North (shadow points opposite the sun).
 */
export function shadowToLocation(
  date: Date,
  elevation: number,
  azimuth: number
): { lat: number; lng: number } | null {
  if (elevation <= 0) return null; // sun below horizon — no useful cast shadow

  const decl = sunPosition(0, 0, date).declination * DEG; // declination depends only on date
  const eqTime = sunPosition(0, 0, date).eqTime;

  const sElev = Math.sin(elevation * DEG);
  const cElev = Math.cos(elevation * DEG);
  const sAz = Math.sin(azimuth * DEG);
  const cAz = Math.cos(azimuth * DEG);
  const sDecl = Math.sin(decl);
  const cDecl = Math.cos(decl);

  // Hour angle from the east-component relation:
  //   cos(elev)·sin(az) = -cos(decl)·sin(H)
  const sinH = -cElev * sAz / cDecl;
  if (Math.abs(sinH) > 1) return null; // inconsistent input
  // cos(H) ≥ 0 for |H| < 90° (sun within ~6h of solar noon — the OSINT norm).
  const cosH = Math.sqrt(1 - sinH * sinH);
  const cdch = cDecl * cosH;

  // Solve a 2×2 LINEAR system for sin(lat) and cos(lat), which is free of
  // the arcsin hemisphere ambiguity that plagues the single-equation form.
  //   sin(decl)·sφ + cos(decl)·cosH·cφ = sin(elev)        (Up component)
  //   -cos(decl)·cosH·sφ + sin(decl)·cφ = cos(elev)·cos(az) (North component)
  const det = sDecl * sDecl + cdch * cdch;
  if (det === 0) return null;
  const north = cElev * cAz;
  const sLat = (sElev * sDecl - cdch * north) / det;
  const cLat = (sDecl * north + sElev * cdch) / det;
  if (sLat * sLat + cLat * cLat < 0.25) return null; // numerically inconsistent
  const lat = Math.atan2(sLat, cLat);

  // Longitude from the hour angle:
  //   H(deg) = lng + (UTCmin + eqTime)/4 - 180
  const fracHour =
    date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const utcMin = fracHour * 60;
  const Hdeg = Math.atan2(sinH, cosH) / DEG;
  let lng = Hdeg - (utcMin + eqTime) / 4 + 180;

  // Normalize longitude to [-180, 180].
  while (lng > 180) lng -= 360;
  while (lng < -180) lng += 360;

  return { lat: lat / DEG, lng };
}

/** Expected shadow length for a vertical object of given height. */
export function shadowLength(objectHeight: number, elevationDeg: number): number {
  const e = elevationDeg * DEG;
  if (e <= 0) return Infinity; // sun below horizon → no cast shadow
  return objectHeight / Math.tan(e);
}

/** Solar elevation derived from a measured shadow. */
export function elevationFromShadow(objectHeight: number, shadowLength: number): number {
  if (shadowLength <= 0) return 90;
  return Math.atan(objectHeight / shadowLength) / DEG;
}

/* ═══════════════════════════════════════════════════════════════
   4 · REVERSE-IMAGE-SEARCH LAUNCHERS
   ═══════════════════════════════════════════════════════════════ */

export interface ReverseSearchEngine {
  id: string;
  label: string;
  /** Upload-page URL the user pastes / drops the image into. */
  url: string;
  /** Short instruction shown to the user. */
  hint: string;
  accent: "blood" | "green" | "amber";
}

/**
 * The three engines that power most OSINT reverse-image work.
 *
 * Browsers block programmatic file uploads to third-party sites, so the
 * tool opens each engine's upload page; the user drops the same image.
 * This keeps the whole flow client-side and anonymous.
 */
export const REVERSE_SEARCH_ENGINES: ReverseSearchEngine[] = [
  {
    id: "google",
    label: "Google Lens",
    url: "https://lens.google.com/",
    hint: "Open Google Lens, then drag the image onto the search field.",
    accent: "amber",
  },
  {
    id: "tineye",
    label: "TinEye",
    url: "https://tineye.com/",
    hint: "Open TinEye and upload the image — best for finding the earliest copy.",
    accent: "green",
  },
  {
    id: "yandex",
    label: "Yandex Images",
    url: "https://yandex.com/images/",
    hint: "Open Yandex Images, click the camera icon, and upload — strongest for faces & places.",
    accent: "blood",
  },
];

/* ═══════════════════════════════════════════════════════════════
   Shared small utils
   ═══════════════════════════════════════════════════════════════ */

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

export function fmtBytes(n: number): string {
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  return (n / (1024 * 1024)).toFixed(2) + " MB";
}

/** Build a Google Maps URL for a lat/long (opens in a new tab). */
export function mapsUrl(lat: number, lng: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat.toFixed(6)}&mlon=${lng.toFixed(6)}#map=15/${lat.toFixed(6)}/${lng.toFixed(6)}`;
}
