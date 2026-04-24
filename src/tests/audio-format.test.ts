import { describe, expect, it } from "vitest";
import { detectAudioFormat } from "@/lib/audio/detect-format";

describe("detectAudioFormat", () => {
    it("detects OGG/Opus magic bytes", () => {
        const buffer = Buffer.from([0x4f, 0x67, 0x67, 0x53, 0x00, 0x00]);
        const result = detectAudioFormat(buffer);
        expect(result.contentType).toBe("audio/ogg");
        expect(result.extension).toBe(".ogg");
    });

    it("detects MP3 ID3 magic bytes", () => {
        const buffer = Buffer.from([0x49, 0x44, 0x33, 0x00, 0x00]);
        const result = detectAudioFormat(buffer);
        expect(result.contentType).toBe("audio/mpeg");
        expect(result.extension).toBe(".mp3");
    });

    it("detects MP3 sync bytes (0xFF 0xFB)", () => {
        const buffer = Buffer.from([0xff, 0xfb, 0x00, 0x00]);
        const result = detectAudioFormat(buffer);
        expect(result.contentType).toBe("audio/mpeg");
        expect(result.extension).toBe(".mp3");
    });

    it("detects WAV magic bytes", () => {
        const buffer = Buffer.from([
            0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56,
            0x45,
        ]);
        const result = detectAudioFormat(buffer);
        expect(result.contentType).toBe("audio/wav");
        expect(result.extension).toBe(".wav");
    });

    it("detects FLAC magic bytes", () => {
        const buffer = Buffer.from([0x66, 0x4c, 0x61, 0x43, 0x00, 0x00]);
        const result = detectAudioFormat(buffer);
        expect(result.contentType).toBe("audio/flac");
        expect(result.extension).toBe(".flac");
    });

    it("falls back to MP3 for unknown formats", () => {
        const buffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);
        const result = detectAudioFormat(buffer);
        expect(result.contentType).toBe("audio/mpeg");
        expect(result.extension).toBe(".mp3");
    });

    it("handles Uint8Array input", () => {
        const arr = new Uint8Array([0x4f, 0x67, 0x67, 0x53]);
        const result = detectAudioFormat(arr);
        expect(result.contentType).toBe("audio/ogg");
    });

    it("handles empty buffer gracefully", () => {
        const buffer = Buffer.alloc(0);
        const result = detectAudioFormat(buffer);
        expect(result.contentType).toBe("audio/mpeg");
    });
});
