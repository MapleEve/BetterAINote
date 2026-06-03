import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("dashboard speaker label editor regressions", () => {
    const source = readFileSync(
        path.join(
            process.cwd(),
            "src/features/recordings/components/speaker-label-editor.tsx",
        ),
        "utf8",
    );

    it("keeps transcript review visible when there are no saved speaker mappings", () => {
        expect(source).not.toContain(
            "if (speakers.length === 0) {\n        return null;",
        );
        expect(source).toContain("speakerReview.noDetectedSpeakers");
    });

    it("keeps speaker sample cards on the graphite glass surface", () => {
        expect(source).toContain('data-testid="speaker-review-sample"');
        expect(source).toContain("glass-surface-subtle");
        expect(source).not.toContain("bg-background/60");
    });

    it("uses the muted transcript preview surface during speaker review", () => {
        const previewMarker = 'data-testid="speaker-review-transcript-preview"';
        const previewIndex = source.indexOf(previewMarker);
        expect(previewIndex).toBeGreaterThan(-1);

        const previewSlice = source.slice(
            previewIndex - 160,
            previewIndex + 240,
        );

        expect(previewSlice).toContain(previewMarker);
        expect(previewSlice).toContain("{activeReview.text}");
        expect(previewSlice).not.toContain("bg-background/50");
        expect(previewSlice).toContain("bg-muted/20");
    });

    it("uses the shared speaker review card surface without dropping interactions", () => {
        const labelMarker = "data-speaker-label={speaker.rawLabel}";
        const cardTestIdMarker = 'data-testid="speaker-review-card"';
        const createOptionMarker = 'data-testid="speaker-review-create-option"';
        const labelIndex = source.indexOf(labelMarker);
        const createOptionIndex = source.indexOf(createOptionMarker);

        expect(labelIndex).toBeGreaterThan(-1);
        expect(createOptionIndex).toBeGreaterThan(labelIndex);

        const cardStart = source.lastIndexOf("<div", labelIndex);
        const cardOpeningSlice = source.slice(cardStart, labelIndex + 360);
        const cardInteractionSlice = source.slice(
            cardStart,
            createOptionIndex + createOptionMarker.length,
        );

        expect(cardOpeningSlice).toContain(cardTestIdMarker);
        expect(cardOpeningSlice).toContain(labelMarker);
        expect(cardOpeningSlice).toContain("data-speaker-mapped={String(");
        expect(cardOpeningSlice).not.toContain("bg-background/35");
        expect(cardOpeningSlice).toContain("glass-surface-subtle");

        expect(cardInteractionSlice).toContain(
            'data-testid="speaker-review-mapping-input"',
        );
        expect(cardInteractionSlice).toContain(
            'data-testid="speaker-review-profile-option"',
        );
        expect(cardInteractionSlice).toContain(createOptionMarker);
        expect(cardInteractionSlice).toContain(
            'data-testid="speaker-review-play-sample"',
        );
    });

    it("keeps speaker list load failures distinct from empty state", () => {
        expect(source).toContain("speakerLoadError");
        expect(source).toContain('data-testid="speaker-review-speakers-error"');
        expect(source).toContain('data-testid="speaker-review-speakers-retry"');
        expect(source).toContain("speakerLoadError ? (");
        expect(source).toContain(") : speakers.length === 0 ? (");
    });

    it("disables mapping inputs and picker options while a speaker mapping is saving", () => {
        expect(source).toContain("const isSpeakerSaving =");
        const inputMarker = 'data-testid="speaker-review-mapping-input"';
        const profileOptionMarker =
            'data-testid="speaker-review-profile-option"';
        const createOptionMarker = 'data-testid="speaker-review-create-option"';
        const inputIndex = source.indexOf(inputMarker);
        const profileOptionIndex = source.indexOf(profileOptionMarker);
        const createOptionIndex = source.indexOf(createOptionMarker);
        const inputSlice = source.slice(inputIndex - 360, inputIndex + 220);

        expect(inputIndex).toBeGreaterThan(-1);
        expect(profileOptionIndex).toBeGreaterThan(-1);
        expect(createOptionIndex).toBeGreaterThan(-1);
        expect(inputSlice).toMatch(/disabled=\{\s*isSpeakerSaving\s*\}/);
        expect(source).toMatch(
            /disabled=\{\s*isSpeakerSaving\s*\|\|\s*speaker\.matchedProfileId ===\s*profile\.id\s*\}[\s\S]*?data-testid="speaker-review-profile-option"/,
        );
        expect(source).toMatch(
            /disabled=\{\s*isSpeakerSaving\s*\}[\s\S]*?data-testid="speaker-review-create-option"/,
        );
    });
});
