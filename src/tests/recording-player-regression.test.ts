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
        expect(source).toContain("z-[220]");
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
});
