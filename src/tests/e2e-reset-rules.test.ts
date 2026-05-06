import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RESET_SCRIPT = path.resolve(ROOT, "../scripts/e2e-reset-data.mjs");

describe("E2E reset safety rules", () => {
    it("requires an explicit reset guard and refuses production-like paths", () => {
        expect(existsSync(RESET_SCRIPT)).toBe(true);

        const script = readFileSync(RESET_SCRIPT, "utf8");

        expect(script).toContain("BETTERAINOTE_E2E_RESET");
        expect(script).toContain("UnsafeE2EResetPath");
        expect(script).toContain("PLAYWRIGHT_E2E_ROOT");
        expect(script).toContain("DATABASE_PATH");
    });

    it("preserves provider configuration and automatic sync while clearing local app/search state", () => {
        expect(existsSync(RESET_SCRIPT)).toBe(true);

        const script = readFileSync(RESET_SCRIPT, "utf8");

        expect(script).toContain("source_connections");
        expect(script).toContain("api_credentials");
        expect(script).not.toContain("auto_sync_enabled = 0");
        expect(script).toContain("auto_transcribe = 0");
        expect(script).toContain("recordings");
        expect(script).toContain("transcriptions");
        expect(script).toContain("recording_tags");
        expect(script).toContain("search_documents");
        expect(script).toContain("search_content_fts");
        expect(script).toContain("DELETE FROM `search_content_fts`");
        expect(script).not.toContain("delete-all");
    });

    it("never resets remote VoScript voiceprints through API calls", () => {
        expect(existsSync(RESET_SCRIPT)).toBe(true);

        const script = readFileSync(RESET_SCRIPT, "utf8");

        expect(script).not.toContain("/voiceprints");
        expect(script).not.toContain("deleteVoiceprint");
        expect(script).not.toContain("listVoiceprints");
        expect(script).not.toContain("fetch(");
    });
});
