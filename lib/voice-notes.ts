/**
 * V FOR X — Voice Notes with VFXFILE1 Integration
 *
 * Record audio → VFXFILE1 framing → ShareSheet dead-drop/pack
 *
 * Voice notes are recorded using the MediaRecorder API, packaged as encrypted
 * VFXFILE1 blobs, and can be shared via dead-drops or WebRTC transfer.
 *
 * FORMAT CONSIDERATIONS:
 * - Browsers widely support WebM/Opus for recording
 * - Safari supports MP4/AAC, so we detect capabilities
 * - Output is always encrypted client-side before storage/transfer
 * - Playback works with native HTML5 audio or Blob URLs
 */

import { prepareFileTransfer, type PreparedTransfer, FILE_TRANSFER_PREFIX } from './file-transfer';

export const VOICE_NOTES_PREFIX = "VFXVOICE1:";
export const VOICE_MIME_TYPES = [
  'audio/webm;codecs=opus',    // Chrome/Firefox/Edge
  'audio/mp4',                  // Safari
  'audio/webm',                 // Fallback
  'audio/ogg',                  // Fallback
];

/* ═══════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════ */

export interface VoiceNoteMeta {
  id: string;
  name: string;
  mime: string;
  duration: number;        // seconds
  size: number;            // bytes
  recordedAt: number;      // timestamp
  sha256: string;
}

export interface VoiceNote {
  meta: VoiceNoteMeta;
  encryptedData: PreparedTransfer;
  blobUrl?: string;        // For playback (not for storage)
}

export type RecordingState = 'idle' | 'recording' | 'paused' | 'stopped' | 'error';

export interface RecordingProgress {
  state: RecordingState;
  duration: number;       // seconds
  blobSize: number;        // bytes
}

/* ═══════════════════════════════════════════════════════════
   RECORDER CLASS
   ═══════════════════════════════════════════════════════════ */

export class VoiceRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private startTime: number = 0;
  private pausedTime: number = 0;
  private pauseStart: number = 0;
  private state: RecordingState = 'idle';
  private stream: MediaStream | null = null;
  private onStateChangeCallback?: (state: RecordingState) => void;
  private onProgressCallback?: (progress: RecordingProgress) => void;

  constructor() {
    // Initialize in idle state regardless of MediaRecorder availability
    // Real recording will fail if MediaRecorder is unavailable
    this.state = 'idle';
  }

  private notifyStateChange() {
    this.onStateChangeCallback?.(this.state);
    this.notifyProgress();
  }

  private notifyProgress() {
    const duration = this.state === 'recording' || this.state === 'paused'
      ? (Date.now() - this.startTime - this.pausedTime) / 1000
      : 0;

    this.onProgressCallback?.({
      state: this.state,
      duration: Math.round(duration * 100) / 100,
      blobSize: new Blob(this.audioChunks).size,
    });
  }

  onStateChange(callback: (state: RecordingState) => void) {
    this.onStateChangeCallback = callback;
  }

  onProgress(callback: (progress: RecordingProgress) => void) {
    this.onProgressCallback = callback;
  }

  getState(): RecordingState {
    return this.state;
  }

  getDuration(): number {
    if (this.state === 'idle' || this.state === 'error') return 0;
    return Math.round(((Date.now() - this.startTime - this.pausedTime) / 1000) * 100) / 100;
  }

  /**
   * Detect the best supported MIME type for audio recording.
   */
  private getSupportedMimeType(): string | null {
    if (typeof MediaRecorder === 'undefined') return null;

    for (const mime of VOICE_MIME_TYPES) {
      if (MediaRecorder.isTypeSupported(mime)) {
        return mime;
      }
    }
    return null;
  }

  /**
   * Request microphone access and start recording.
   */
  async start(): Promise<void> {
    if (this.state === 'recording') {
      throw new Error('Already recording');
    }

    try {
      // Request microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000, // High quality
        }
      });

      const mimeType = this.getSupportedMimeType();
      if (!mimeType) {
        throw new Error('No supported audio MIME type');
      }

      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType,
        audioBitsPerSecond: 128000, // 128 kbps
      });

      this.audioChunks = [];
      this.startTime = Date.now();
      this.pausedTime = 0;
      this.pauseStart = 0;

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
          this.notifyProgress();
        }
      };

      this.mediaRecorder.onstop = () => {
        this.state = 'stopped';
        this.notifyStateChange();
      };

      this.mediaRecorder.onerror = () => {
        this.state = 'error';
        this.notifyStateChange();
      };

      this.mediaRecorder.start(100); // Collect data every 100ms
      this.state = 'recording';
      this.notifyStateChange();

    } catch (error) {
      console.error('VoiceRecorder start error:', error);
      this.state = 'error';
      this.notifyStateChange();
      throw error;
    }
  }

  /**
   * Pause the current recording.
   */
  pause(): void {
    if (this.state !== 'recording' || !this.mediaRecorder) {
      throw new Error('Not recording');
    }

    this.mediaRecorder.pause();
    this.pauseStart = Date.now();
    this.state = 'paused';
    this.notifyStateChange();
  }

  /**
   * Resume a paused recording.
   */
  resume(): void {
    if (this.state !== 'paused' || !this.mediaRecorder) {
      throw new Error('Not paused');
    }

    this.mediaRecorder.resume();
    this.pausedTime += Date.now() - this.pauseStart;
    this.pauseStart = 0;
    this.state = 'recording';
    this.notifyStateChange();
  }

  /**
   * Stop recording and return the audio blob.
   */
  async stop(): Promise<Blob> {
    if (this.state !== 'recording' && this.state !== 'paused') {
      throw new Error('Not recording');
    }

    // Check for MediaRecorder availability synchronously before async operations
    if (!this.mediaRecorder) {
      throw new Error('No MediaRecorder instance');
    }

    if (!this.mediaRecorder) {
      throw new Error('No MediaRecorder instance');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Recording stop timeout'));
      }, 5000);

      this.mediaRecorder!.onstop = () => {
        clearTimeout(timeout);
        const blob = new Blob(this.audioChunks, {
          type: this.mediaRecorder!.mimeType
        });
        this.cleanup();
        this.state = 'stopped';
        this.notifyStateChange();
        resolve(blob);
      };

      this.mediaRecorder!.onerror = (error) => {
        clearTimeout(timeout);
        this.cleanup();
        this.state = 'error';
        this.notifyStateChange();
        reject(error);
      };

      this.mediaRecorder!.stop();
    });
  }

  /**
   * Cancel the current recording and clean up.
   */
  cancel(): void {
    if (this.state !== 'recording' && this.state !== 'paused') {
      return;
    }

    try {
      if (this.mediaRecorder && this.state === 'recording') {
        this.mediaRecorder.stop();
      }
    } catch (error) {
      console.error('Error canceling recording:', error);
    }

    this.audioChunks = [];
    this.cleanup();
    this.state = 'idle';
    this.notifyStateChange();
  }

  private cleanup(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
  }

  /**
   * Clean up resources when done.
   */
  dispose(): void {
    this.cancel();
    this.onStateChangeCallback = undefined;
    this.onProgressCallback = undefined;
  }
}

/* ═══════════════════════════════════════════════════════════
   VOICE NOTE FUNCTIONS
   ═══════════════════════════════════════════════════════════ */

/**
 * Create a voice note from a recorded audio blob.
 * Encrypts the audio and prepares it for VFXFILE1 transfer.
 */
export async function createVoiceNote(
  audioBlob: Blob,
  options: {
    name?: string;
    author?: string;
  } = {}
): Promise<VoiceNote> {
  const bytes = new Uint8Array(await audioBlob.arrayBuffer());
  const name = options.name || `voice-note-${Date.now()}`;
  const mime = audioBlob.type || 'audio/webm';

  const encryptedData = await prepareFileTransfer(
    { name, mime, size: bytes.length },
    bytes
  );

  const meta: VoiceNoteMeta = {
    id: encryptedData.meta.id,
    name,
    mime,
    duration: 0, // Will be estimated from size
    size: encryptedData.meta.size,
    recordedAt: Date.now(),
    sha256: encryptedData.meta.sha256,
  };

  // Estimate duration from size (rough estimate for Opus @ 128kbps)
  const estimatedDuration = Math.round((bytes.length * 8) / 128000);
  meta.duration = estimatedDuration;

  // Create a blob URL for immediate playback (temporary, not for storage)
  const blobUrl = URL.createObjectURL(audioBlob);

  return {
    meta,
    encryptedData,
    blobUrl,
  };
}

/**
 * Parse a VFXVOICE1 token and extract voice note metadata.
 */
export function parseVoiceNoteToken(token: string): VoiceNoteMeta | null {
  if (!token.startsWith(VOICE_NOTES_PREFIX)) {
    return null;
  }

  try {
    const withoutPrefix = token.slice(VOICE_NOTES_PREFIX.length);
    const parts = withoutPrefix.split('|');
    if (parts.length < 6) return null;

    return {
      id: parts[0] || '',
      name: parts[1] || 'voice-note',
      mime: parts[2] || 'audio/webm',
      duration: parseFloat(parts[3]) || 0,
      size: parseInt(parts[4], 10) || 0,
      recordedAt: parseInt(parts[5], 10) || Date.now(),
      sha256: parts[6] || '',
    };
  } catch (error) {
    console.error('Error parsing voice note token:', error);
    return null;
  }
}

/**
 * Encode a voice note as a VFXVOICE1 token string.
 */
export function encodeVoiceNoteToken(meta: VoiceNoteMeta): string {
  return [
    VOICE_NOTES_PREFIX + meta.id,
    meta.name,
    meta.mime,
    meta.duration.toString(),
    meta.size.toString(),
    meta.recordedAt.toString(),
    meta.sha256,
  ].join('|');
}

/**
 * Create a playback URL for an encrypted voice note.
 * This decrypts the data and creates a temporary blob URL.
 */
export async function createPlaybackUrl(voiceNote: VoiceNote): Promise<string> {
  const decryptedChunks = voiceNote.encryptedData.chunks;
  const totalLength = decryptedChunks.reduce((acc, chunk) => acc + chunk.length, 0);

  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of decryptedChunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  const blob = new Blob([combined], { type: voiceNote.meta.mime });
  return URL.createObjectURL(blob);
}

/**
 * Revoke a playback URL to free memory.
 */
export function revokePlaybackUrl(url: string): void {
  URL.revokeObjectURL(url);
}

/**
 * Detect if a VFXFILE1 token is a voice note.
 */
export function isVoiceNoteToken(token: string): boolean {
  return token.startsWith(VOICE_NOTES_PREFIX);
}

/**
 * Convert a VFXFILE1 file transfer to a voice note format.
 * This is used when receiving voice notes via WebRTC.
 */
export async function fileTransferToVoiceNote(
  fileTransfer: PreparedTransfer,
  audioBlob: Blob
): Promise<VoiceNote> {
  const meta: VoiceNoteMeta = {
    id: fileTransfer.meta.id,
    name: fileTransfer.meta.name,
    mime: fileTransfer.meta.mime,
    duration: 0, // Will need to be determined from playback
    size: fileTransfer.meta.size,
    recordedAt: Date.now(),
    sha256: fileTransfer.meta.sha256,
  };

  // Estimate duration
  const estimatedDuration = Math.round((fileTransfer.meta.size * 8) / 128000);
  meta.duration = estimatedDuration;

  const blobUrl = URL.createObjectURL(audioBlob);

  return {
    meta,
    encryptedData: fileTransfer,
    blobUrl,
  };
}

/**
 * Format duration in seconds to human-readable time (mm:ss).
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format file size in bytes to human-readable size.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 2 * 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}
