import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSource(relativePath: string) {
    return readFileSync(path.join(ROOT, relativePath), "utf8");
}

describe("settings UI replacement S6-S8 regressions", () => {
    it("keeps the settings dialog as a fixed-height shell with local scrolling and focus return", () => {
        const dialog = readSource(
            "features/settings/components/settings-dialog.tsx",
        );

        expect(dialog).toContain(
            "[--settings-dialog-height:calc(100svh-1rem)]",
        );
        expect(dialog).toContain(
            "sm:[--settings-dialog-height:min(94svh,980px)]",
        );
        expect(dialog).toContain("h-(--settings-dialog-height)");
        expect(dialog).toContain("min-h-(--settings-dialog-height)");
        expect(dialog).toContain("max-h-(--settings-dialog-height)");
        expect(dialog).toContain("sm:w-[min(96vw,920px)]");
        expect(dialog).toContain('"--tw-enter-scale": "1"');
        expect(dialog).toContain('"--tw-exit-scale": "1"');
        expect(dialog).toContain("overflow-hidden p-0");
        expect(dialog).toContain("data-settings-shell");
        expect(dialog).toContain("data-settings-scroll-body");
        expect(dialog).toContain(
            "data-settings-active-section={activeSection}",
        );
        expect(dialog).toContain(
            "flex min-h-0 flex-1 flex-col overscroll-contain",
        );
        expect(dialog).toContain(
            "overflow-y-auto p-4 lg:overflow-hidden lg:p-0",
        );
        expect(dialog).toContain("gap-4 overflow-y-auto p-4 pt-6");
        expect(dialog).toContain("data-settings-active-section");
        expect(dialog).toContain("data-settings-inner-scroll");
        expect(dialog).toContain("scrollBodyRef.current?.scrollTo");
        expect(dialog).toContain("querySelectorAll<HTMLElement>");
        expect(dialog).toContain("[data-settings-inner-scroll]");
        expect(dialog).toContain("node.scrollTop = 0");
        expect(dialog).toContain("node.scrollLeft = 0");
        expect(dialog).toContain("returnFocusRef");
        expect(dialog).toContain("focus({ preventScroll: true })");
        expect(dialog).toContain('event.key === "Escape"');

        const select = readSource("components/ui/select.tsx");
        const baseDialog = readSource("components/ui/dialog.tsx");
        const search = readSource(
            "features/dashboard/components/library-search.tsx",
        );
        const activity = readSource(
            "features/dashboard/components/activity-overlay.tsx",
        );

        expect(baseDialog).toContain("z-[600]");
        expect(select).toContain("z-[650]");
        expect(search).toContain("z-[220]");
        expect(activity).toContain("z-[220]");
    });

    it("keeps data-source settings on provider rows with detail status, save, and test lanes", () => {
        const section = readSource(
            "features/settings/components/sections/data-sources-section.tsx",
        );
        const providerTypes = readSource("lib/data-sources/types.ts");

        for (const provider of [
            "dingtalk-a1",
            "ticnote",
            "plaud",
            "feishu-minutes",
            "iflyrec",
        ]) {
            expect(providerTypes).toContain(provider);
        }

        expect(section).toContain('data-settings-section="data-sources"');
        expect(section).toContain("lg:grid-cols-[280px_minmax(0,1fr)]");
        expect(section).toContain("data-ds-scroll");
        expect(section).toContain("data-settings-inner-scroll");
        expect(section).toContain(
            "min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5",
        );
        expect(section).toContain("data-provider=");
        expect(section).toContain("data-provider-detail");
        expect(section).toContain("PROVIDER_ICONS");
        expect(section).not.toContain("getProviderInitial");
        expect(section).not.toContain('isZh ? "总览" : "Overview"');
        expect(section).toContain("ProviderActionMessage");
        expect(section).toContain('"testing"');
        expect(section).toContain('"test-success"');
        expect(section).toContain('"save-error"');
        expect(section).toContain("handleTestSource");
        expect(section).toContain("handleSaveSource");
        expect(section).not.toContain("/api/data-sources/test");
    });

    it("keeps VoScript and speaker profile rows renderable without expanding into later source detail work", () => {
        const voscript = readSource(
            "features/settings/components/sections/voscript-section.tsx",
        );
        const speakers = readSource(
            "features/settings/components/sections/speaker-profiles-panel.tsx",
        );

        expect(voscript).toContain('data-settings-section="voscript"');
        expect(voscript).toContain("VoScriptStatusBanner");
        expect(voscript).toContain("data-voscript-service-state");
        expect(voscript).toContain("data-voscript-availability");
        expect(voscript).toContain("data-voscript-save-state");
        expect(voscript).toContain("VoScriptSaveState");
        expect(voscript).toContain("setSaveMessage");
        expect(voscript).toContain("privateTranscriptionBaseUrl");
        expect(voscript).toContain("privateTranscriptionMaxInflightJobs");

        expect(speakers).toContain("data-profiles-state");
        expect(speakers).toContain("data-vs-state");
        expect(speakers).toContain("data-speaker-profile-row");
        expect(speakers).toContain("data-vs-profile-row");
        expect(speakers).toContain(
            "sm:grid-cols-[2rem_minmax(0,1fr)_auto_auto]",
        );
        expect(speakers).toContain("[word-break:keep-all]");
        expect(speakers).toContain("max-h-[24rem]");
        expect(speakers).toContain("profilesError");
        expect(speakers).toContain("voiceprintsError");
        expect(speakers).not.toContain("source detail");
        expect(speakers).not.toContain("AI rename");
    });
});
