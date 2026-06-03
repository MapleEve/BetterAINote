import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("dashboard recording player regressions", () => {
    it("does not pass an empty audio source to the hidden audio element", () => {
        const source = readFileSync(
            path.join(
                process.cwd(),
                "src/features/recordings/components/recording-player.tsx",
            ),
            "utf8",
        );

        expect(source).not.toContain("src={audioSrc}");
        expect(source).toContain("src={audioSrc || undefined}");
        expect(source).toContain("playbackDisabled");
        expect(source).toContain("data-player-state");
        expect(source).toContain("disabled={playbackDisabled}");
        expect(source).toContain("z-[240]");
        expect(source).not.toContain("z-[1000]");
    });

    it("keeps the no-audio warning on the current glass surface", () => {
        const source = readFileSync(
            path.join(
                process.cwd(),
                "src/features/recordings/components/recording-player.tsx",
            ),
            "utf8",
        );
        const noAudioWarning = source.match(
            /<div[^>]*data-testid="recording-player-no-audio-warning"[\s\S]*?<\/div>/,
        )?.[0];

        expect(noAudioWarning).toBeDefined();
        expect(noAudioWarning).toContain("glass-surface-subtle");
        expect(noAudioWarning).toContain("rounded-xl");
        expect(noAudioWarning).toContain("p-4");
        expect(noAudioWarning).not.toContain("border-white/10");
        expect(noAudioWarning).not.toContain("bg-white/5");
    });

    it("uses the current hover surface without dropping tag or speed controls", () => {
        const source = readFileSync(
            path.join(
                process.cwd(),
                "src/features/recordings/components/recording-player.tsx",
            ),
            "utf8",
        );
        const e2eSource = readFileSync(
            path.join(
                process.cwd(),
                "e2e/recording-detail-workstation.spec.ts",
            ),
            "utf8",
        );

        expect(source).not.toContain("hover:bg-background/35");
        expect(source).toContain('data-testid="recording-tag-manager-trigger"');
        expect(source).toContain("onClick={onToggleTagManager}");
        expect(source).toContain("aria-expanded={isTagManagerOpen}");
        expect(source).toContain('data-testid="recording-player-speed"');
        expect(source).toContain('title="Click to cycle playback speed"');
        expect(e2eSource).toContain("playbackRate");

        const dateBadgeStart = source.indexOf("suppressHydrationWarning");
        const dateBadgeEnd = source.indexOf("formatDateTime(", dateBadgeStart);
        const dateBadgeSurface = source.slice(
            Math.max(0, dateBadgeStart - 240),
            dateBadgeEnd + 240,
        );

        expect(dateBadgeStart).toBeGreaterThanOrEqual(0);
        expect(dateBadgeEnd).toBeGreaterThan(dateBadgeStart);
        expect(dateBadgeSurface).not.toContain("bg-background/20");
        expect(dateBadgeSurface).toContain("bg-muted/20");

        const tagManagerStart = source.indexOf(
            'data-testid="recording-tag-manager-trigger"',
        );
        const tagManagerEnd = source.indexOf("</Button>", tagManagerStart);
        const tagManagerSurface = source.slice(
            Math.max(0, tagManagerStart - 420),
            tagManagerEnd + "</Button>".length,
        );

        expect(tagManagerStart).toBeGreaterThanOrEqual(0);
        expect(tagManagerEnd).toBeGreaterThan(tagManagerStart);
        expect(tagManagerSurface).toContain("onClick={onToggleTagManager}");
        expect(tagManagerSurface).toContain("aria-expanded={isTagManagerOpen}");
        expect(tagManagerSurface).not.toContain("bg-background/20");
        expect(tagManagerSurface).toContain("bg-muted/20");
        expect(tagManagerSurface).toContain("<RecordingTagChip");
        expect(tagManagerSurface).toContain("+{tags.length - 1}");

        const controlsStateIndex = source.indexOf("data-player-state");
        const controlsStart = source.lastIndexOf("<div", controlsStateIndex);
        const controlsEnd = source.indexOf("</div>", controlsStateIndex);
        const controlsSurface = source.slice(controlsStart, controlsEnd);

        expect(controlsStateIndex).toBeGreaterThanOrEqual(0);
        expect(controlsStart).toBeGreaterThanOrEqual(0);
        expect(controlsEnd).toBeGreaterThan(controlsStart);
        expect(controlsSurface).not.toContain("bg-background/14");
        expect(controlsSurface).toContain("glass-surface-subtle");
        expect(controlsSurface).toContain(
            "grid items-center gap-4 rounded-2xl px-4 py-4",
        );
    });
});
