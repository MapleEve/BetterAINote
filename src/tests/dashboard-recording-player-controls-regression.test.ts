import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

function read(relativePath: string) {
    return readFileSync(path.join(ROOT, relativePath), "utf8");
}

describe("dashboard recording player controls regression", () => {
    const controls = read(
        "src/features/dashboard/components/dashboard-recording-player-controls.tsx",
    );
    const primitives = read(
        "src/features/recordings/components/player-primitives.tsx",
    );

    it("uses shared player names and semantic data attributes", () => {
        const migratedSources = `${controls}\n${primitives}`;

        expect(migratedSources).not.toMatch(
            /data-sot|SotPlayer|formatSot|sotPlayer|SOT_/,
        );
        expect(primitives).toContain("export function formatPlayerTime");
        expect(primitives).toContain("export function playerVolumeLevel");
        expect(controls).toContain("formatPlayerTime(currentTime)");
        expect(controls).toContain("playerVolumeLevel(volume)");
        expect(controls).toContain("data-state={playerControlsState}");
        expect(controls).toContain('data-control="dashboard-player-seek"');
    });

    it("keeps the playable controls and disabled keyboard semantics connected", () => {
        for (const source of [
            "onClick={() => onSeekBySeconds(-5)}",
            "onClick={onTogglePlayPause}",
            "onClick={() => onSeekBySeconds(5)}",
            "onClick={onCyclePlaybackSpeed}",
            "onVolumeChange(volumeMuted ? 70 : 0)",
            "onVolumeChange(nextValue[0] ?? volume)",
            "disabled={playbackDisabled}",
            "tabIndex={disabled ? -1 : 0}",
        ]) {
            expect(controls).toContain(source);
        }

        for (const key of ["ArrowLeft", "ArrowRight", "Home", "End"]) {
            expect(controls).toContain(`event.key === "${key}"`);
        }
    });
});
