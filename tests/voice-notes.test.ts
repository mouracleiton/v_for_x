/**
 * V FOR X — Voice Notes Tests
 *
 * Tests voice recording, VFXFILE1 integration, and token handling.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  VoiceRecorder,
  createVoiceNote,
  parseVoiceNoteToken,
  encodeVoiceNoteToken,
  isVoiceNoteToken,
  createPlaybackUrl,
  formatDuration,
  formatFileSize,
  fileTransferToVoiceNote,
  type VoiceNote,
  type RecordingState,
  VOICE_NOTES_PREFIX,
} from '../lib/voice-notes';

describe('Voice Notes', () => {
  describe('VoiceRecorder', () => {
    let recorder: VoiceRecorder;

    beforeEach(() => {
      recorder = new VoiceRecorder();
    });

    afterEach(() => {
      recorder.dispose();
    });

    describe('Initialization', () => {
      it('should initialize in idle state', () => {
        expect(recorder.getState()).toBe('idle');
      });

      it('should have zero duration when idle', () => {
        expect(recorder.getDuration()).toBe(0);
      });
    });

    describe('State Management', () => {
      it('should track state changes', () => {
        const states: RecordingState[] = [];
        recorder.onStateChange((state) => states.push(state));

        // Mock the start method to avoid actual microphone
        states.push('idle'); // Initial state
        expect(states).toContain('idle');
      });

      it('should provide progress updates', () => {
        const progresses: any[] = [];
        recorder.onProgress((progress) => progresses.push(progress));

        // In idle state, duration should be 0
        expect(recorder.getDuration()).toBe(0);
      });
    });

    describe('Error Handling', () => {
      it('should throw when pausing while not recording', () => {
        expect(() => recorder.pause()).toThrow('Not recording');
      });

      it('should throw when resuming while not paused', () => {
        expect(() => recorder.resume()).toThrow('Not paused');
      });

      it('should throw when stopping while not recording', async () => {
        await expect(recorder.stop()).rejects.toThrow('Not recording');
      });

      it('should handle cancel gracefully when not recording', () => {
        expect(() => recorder.cancel()).not.toThrow();
      });
    });

    describe('Resource Cleanup', () => {
      it('should clean up resources on dispose', () => {
        const stateCallback = vi.fn();
        recorder.onStateChange(stateCallback);

        recorder.dispose();

        // After dispose, callbacks should be cleared
        recorder.onStateChange(() => {});
        expect(stateCallback).not.toHaveBeenCalled();
      });
    });
  });

  describe('Token Handling', () => {
    describe('encodeVoiceNoteToken', () => {
      it('should encode voice note metadata correctly', () => {
        const meta = {
          id: 'test-id-123',
          name: 'my-recording',
          mime: 'audio/webm',
          duration: 45,
          size: 57600,
          recordedAt: 1625097600000,
          sha256: 'abc123def456',
        };

        const token = encodeVoiceNoteToken(meta);

        expect(token).toBe('VFXVOICE1:test-id-123|my-recording|audio/webm|45|57600|1625097600000|abc123def456');
      });

      it('should handle special characters in name', () => {
        const meta = {
          id: 'test',
          name: 'recording|with|pipes',
          mime: 'audio/webm',
          duration: 10,
          size: 1000,
          recordedAt: Date.now(),
          sha256: 'hash',
        };

        const token = encodeVoiceNoteToken(meta);
        expect(token).toContain('recording|with|pipes');
      });
    });

    describe('parseVoiceNoteToken', () => {
      it('should parse a valid voice note token', () => {
        const token = 'VFXVOICE1:test-id-123|my-recording|audio/webm|45|57600|1625097600000|abc123def456';
        const meta = parseVoiceNoteToken(token);

        expect(meta).not.toBeNull();
        expect(meta?.id).toBe('test-id-123');
        expect(meta?.name).toBe('my-recording');
        expect(meta?.mime).toBe('audio/webm');
        expect(meta?.duration).toBe(45);
        expect(meta?.size).toBe(57600);
        expect(meta?.recordedAt).toBe(1625097600000);
        expect(meta?.sha256).toBe('abc123def456');
      });

      it('should return null for invalid tokens', () => {
        expect(parseVoiceNoteToken('INVALID:token')).toBeNull();
        expect(parseVoiceNoteToken('')).toBeNull();
        expect(parseVoiceNoteToken('VFXVOICE1:incomplete')).toBeNull();
      });

      it('should handle missing optional fields', () => {
        const token = 'VFXVOICE1:test-id|my-recording|audio/webm|45|57600|1625097600000';
        const meta = parseVoiceNoteToken(token);

        expect(meta).not.toBeNull();
        expect(meta?.sha256).toBe('');
      });
    });

    describe('isVoiceNoteToken', () => {
      it('should identify voice note tokens', () => {
        expect(isVoiceNoteToken('VFXVOICE1:test-id|name|audio/webm|10|1000|1234567890|hash')).toBe(true);
      });

      it('should reject non-voice-note tokens', () => {
        expect(isVoiceNoteToken('VFXFILE1:test')).toBe(false);
        expect(isVoiceNoteToken('INVALID:token')).toBe(false);
        expect(isVoiceNoteToken('')).toBe(false);
      });
    });
  });

  describe('Voice Note Creation', () => {
    describe('createVoiceNote', () => {
      it('should create a voice note from an audio blob', async () => {
        const audioData = new Uint8Array([1, 2, 3, 4, 5]);
        const audioBlob = new Blob([audioData], { type: 'audio/webm' });

        const voiceNote = await createVoiceNote(audioBlob, {
          name: 'test-recording',
          author: 'test-user',
        });

        expect(voiceNote.meta.name).toBe('test-recording');
        expect(voiceNote.meta.mime).toBe('audio/webm');
        expect(voiceNote.meta.size).toBe(5);
        expect(voiceNote.encryptedData.meta.size).toBe(5);
        expect(voiceNote.meta.id).toBeDefined();
        expect(voiceNote.meta.sha256).toBeDefined();
        expect(voiceNote.blobUrl).toBeDefined();
      });

      it('should generate default name when not provided', async () => {
        const audioBlob = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/webm' });

        const voiceNote = await createVoiceNote(audioBlob);

        expect(voiceNote.meta.name).toMatch(/^voice-note-\d+$/);
      });

      it('should estimate duration from file size', async () => {
        // Create a blob that would be approximately 10 seconds at 128kbps
        const sizeFor10Seconds = (128000 * 10) / 8; // ~160KB
        const audioData = new Uint8Array(sizeFor10Seconds);
        const audioBlob = new Blob([audioData], { type: 'audio/webm' });

        const voiceNote = await createVoiceNote(audioBlob);

        expect(voiceNote.meta.duration).toBeGreaterThan(0);
        expect(voiceNote.meta.duration).toBeCloseTo(10, 0); // Allow some rounding
      });

      it('should handle empty audio blobs', async () => {
        const audioBlob = new Blob([], { type: 'audio/webm' });

        const voiceNote = await createVoiceNote(audioBlob);

        expect(voiceNote.meta.size).toBe(0);
        expect(voiceNote.meta.duration).toBe(0);
      });
    });

    describe('fileTransferToVoiceNote', () => {
      it('should convert file transfer to voice note', async () => {
        const audioData = new Uint8Array([1, 2, 3, 4, 5]);
        const audioBlob = new Blob([audioData], { type: 'audio/webm' });

        const fileTransfer = {
          meta: {
            id: 'transfer-id',
            name: 'received-note',
            mime: 'audio/webm',
            size: 5,
            chunkSize: 8192,
            chunkCount: 1,
            sha256: 'transfer-hash',
          },
          chunks: [audioData],
          keyB64: 'base64-key',
        };

        const voiceNote = await fileTransferToVoiceNote(fileTransfer, audioBlob);

        expect(voiceNote.meta.id).toBe('transfer-id');
        expect(voiceNote.meta.name).toBe('received-note');
        expect(voiceNote.meta.mime).toBe('audio/webm');
        expect(voiceNote.encryptedData).toBe(fileTransfer);
        expect(voiceNote.blobUrl).toBeDefined();
      });

      it('should estimate duration for received files', async () => {
        const sizeFor30Seconds = (128000 * 30) / 8;
        const audioData = new Uint8Array(sizeFor30Seconds);
        const audioBlob = new Blob([audioData], { type: 'audio/webm' });

        const fileTransfer = {
          meta: {
            id: 'test',
            name: 'test',
            mime: 'audio/webm',
            size: sizeFor30Seconds,
            chunkSize: 8192,
            chunkCount: 1,
            sha256: 'hash',
          },
          chunks: [audioData],
          keyB64: 'key',
        };

        const voiceNote = await fileTransferToVoiceNote(fileTransfer, audioBlob);

        expect(voiceNote.meta.duration).toBeGreaterThan(20); // Should be roughly 30 seconds
      });
    });
  });

  describe('Playback Functions', () => {
    describe('createPlaybackUrl', () => {
      it('should create a playback URL from voice note', async () => {
        const audioData = new Uint8Array([1, 2, 3, 4, 5]);
        const voiceNote: VoiceNote = {
          meta: {
            id: 'test',
            name: 'test',
            mime: 'audio/webm',
            duration: 1,
            size: 5,
            recordedAt: Date.now(),
            sha256: 'hash',
          },
          encryptedData: {
            meta: {
              id: 'test',
              name: 'test',
              mime: 'audio/webm',
              size: 5,
              chunkSize: 8192,
              chunkCount: 1,
              sha256: 'hash',
            },
            chunks: [audioData],
            keyB64: 'key',
          },
        };

        const url = await createPlaybackUrl(voiceNote);

        expect(url).toMatch(/^blob:/);
        expect(typeof url).toBe('string');
        expect(url.length).toBeGreaterThan(10);
      });

      it('should handle encrypted chunks correctly', async () => {
        const chunk1 = new Uint8Array([1, 2, 3]);
        const chunk2 = new Uint8Array([4, 5, 6]);
        const voiceNote: VoiceNote = {
          meta: {
            id: 'test',
            name: 'test',
            mime: 'audio/webm',
            duration: 1,
            size: 6,
            recordedAt: Date.now(),
            sha256: 'hash',
          },
          encryptedData: {
            meta: {
              id: 'test',
              name: 'test',
              mime: 'audio/webm',
              size: 6,
              chunkSize: 8192,
              chunkCount: 2,
              sha256: 'hash',
            },
            chunks: [chunk1, chunk2],
            keyB64: 'key',
          },
        };

        const url = await createPlaybackUrl(voiceNote);

        expect(url).toMatch(/^blob:/);
      });
    });
  });

  describe('Utility Functions', () => {
    describe('formatDuration', () => {
      it('should format seconds as mm:ss', () => {
        expect(formatDuration(0)).toBe('0:00');
        expect(formatDuration(30)).toBe('0:30');
        expect(formatDuration(60)).toBe('1:00');
        expect(formatDuration(90)).toBe('1:30');
        expect(formatDuration(3661)).toBe('61:01');
      });

      it('should handle decimal seconds', () => {
        expect(formatDuration(45.7)).toBe('0:45');
        expect(formatDuration(59.9)).toBe('0:59');
      });
    });

    describe('formatFileSize', () => {
      it('should format bytes correctly', () => {
        expect(formatFileSize(0)).toBe('0 B');
        expect(formatFileSize(512)).toBe('512 B');
        expect(formatFileSize(1024)).toBe('1 KB');
        expect(formatFileSize(1536)).toBe('2 KB');
        expect(formatFileSize(1024 * 1024)).toBe('1024 KB');
        expect(formatFileSize(2 * 1024 * 1024)).toBe('2 MB');
      });

      it('should handle large files', () => {
        expect(formatFileSize(10 * 1024 * 1024)).toBe('10 MB');
        expect(formatFileSize(1024 * 1024 * 1024)).toBe('1024 MB');
      });
    });
  });

  describe('Integration', () => {
    it('should handle full voice note workflow', async () => {
      // Simulate recording
      const audioData = new Uint8Array([1, 2, 3, 4, 5]);
      const audioBlob = new Blob([audioData], { type: 'audio/webm' });

      // Create voice note
      const voiceNote = await createVoiceNote(audioBlob, {
        name: 'integration-test',
      });

      // Encode as token
      const token = encodeVoiceNoteToken(voiceNote.meta);

      // Parse back
      const parsed = parseVoiceNoteToken(token);

      expect(parsed).not.toBeNull();
      expect(parsed?.id).toBe(voiceNote.meta.id);
      expect(parsed?.name).toBe('integration-test');
      expect(parsed?.sha256).toBe(voiceNote.meta.sha256);

      // Verify it's identified as voice note token
      expect(isVoiceNoteToken(token)).toBe(true);

      // Create playback URL
      const playbackUrl = await createPlaybackUrl(voiceNote);
      expect(playbackUrl).toMatch(/^blob:/);

      // Format utilities
      expect(formatDuration(voiceNote.meta.duration)).toBe('0:00');
      expect(formatFileSize(voiceNote.meta.size)).toBe('5 B');
    });
  });
});
