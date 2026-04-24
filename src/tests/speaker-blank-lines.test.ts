import { describe, expect, it } from "vitest";
import { ensureSpeakerBlankLines } from "@/lib/transcription/providers/google-speech-provider";

describe("ensureSpeakerBlankLines", () => {
    it("inserts blank line between speaker turns", () => {
        const input = "Speaker 1: Hello\nSpeaker 2: Hi there";
        const result = ensureSpeakerBlankLines(input);
        expect(result).toBe("Speaker 1: Hello\n\nSpeaker 2: Hi there");
    });

    it("collapses multiple blank lines between turns to exactly one", () => {
        const input = "Speaker 1: Hello\n\n\n\nSpeaker 2: Hi";
        const result = ensureSpeakerBlankLines(input);
        expect(result).toBe("Speaker 1: Hello\n\nSpeaker 2: Hi");
    });

    it("does not add blank line before the very first speaker", () => {
        const input = "Speaker 1: First line\nSpeaker 2: Second";
        const result = ensureSpeakerBlankLines(input);
        expect(result).toMatch(/^Speaker 1:/);
        expect(result).not.toMatch(/^\n/);
    });

    it("handles leading whitespace on speaker lines", () => {
        const input = "Speaker 1: Hello\n  Speaker 2: Indented";
        const result = ensureSpeakerBlankLines(input);
        expect(result).toContain("\n\n  Speaker 2:");
    });

    it("is case-insensitive for speaker labels", () => {
        const input = "speaker 1: lowercase\nSPEAKER 2: uppercase";
        const result = ensureSpeakerBlankLines(input);
        expect(result).toBe("speaker 1: lowercase\n\nSPEAKER 2: uppercase");
    });

    it("handles multi-digit speaker numbers", () => {
        const input = "Speaker 10: Last\nSpeaker 11: After";
        const result = ensureSpeakerBlankLines(input);
        expect(result).toBe("Speaker 10: Last\n\nSpeaker 11: After");
    });

    it("preserves non-speaker lines without adding blank lines", () => {
        const input =
            "Speaker 1: Hi\nSome context note\nMore context\nSpeaker 2: Reply";
        const result = ensureSpeakerBlankLines(input);
        expect(result).toBe(
            "Speaker 1: Hi\nSome context note\nMore context\n\nSpeaker 2: Reply",
        );
    });

    it("trims leading and trailing whitespace from final output", () => {
        const input = "\n\nSpeaker 1: Hello\n\n";
        const result = ensureSpeakerBlankLines(input);
        expect(result).toBe("Speaker 1: Hello");
    });

    it("returns empty string for empty input", () => {
        expect(ensureSpeakerBlankLines("")).toBe("");
    });

    it("returns text as-is when no speaker labels present", () => {
        const input = "Just some plain text\nwith multiple lines";
        const result = ensureSpeakerBlankLines(input);
        expect(result).toBe(input);
    });

    it("handles three consecutive speakers correctly", () => {
        const input = "Speaker 1: A\nSpeaker 2: B\nSpeaker 3: C";
        const result = ensureSpeakerBlankLines(input);
        expect(result).toBe("Speaker 1: A\n\nSpeaker 2: B\n\nSpeaker 3: C");
    });
});
