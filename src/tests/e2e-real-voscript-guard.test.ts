import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const REAL_VOSCRIPT_SPEC = path.join(
    ROOT,
    "e2e/real-voscript-current-config.spec.ts",
);
const REAL_VOSCRIPT_HELPER = path.join(
    ROOT,
    "e2e/helpers/real-voscript-current.ts",
);

function readSource(filePath: string) {
    return readFileSync(filePath, "utf8");
}

describe("real VoScript E2E guard", () => {
    it("keeps real VoScript validation behind an explicit guard and source env", () => {
        const spec = readSource(REAL_VOSCRIPT_SPEC);
        const helper = readSource(REAL_VOSCRIPT_HELPER);

        expect(helper).toContain("BETTERAINOTE_REAL_VOSCRIPT_E2E");
        expect(helper).toContain(
            "BETTERAINOTE_REAL_VOSCRIPT_SOURCE_DATABASE_PATH",
        );
        expect(helper).toContain(
            "BETTERAINOTE_REAL_VOSCRIPT_SOURCE_STORAGE_PATH",
        );
        expect(helper).toContain(
            "BETTERAINOTE_REAL_VOSCRIPT_SOURCE_ENCRYPTION_KEY",
        );
        expect(helper).toContain("shouldRunRealVoScriptE2E");
        expect(spec).toContain("startLocalVoScriptStubServer");
        expect(spec).toContain("if (shouldRunRealVoScriptE2E())");
        expect(spec).not.toContain("test.skip(");
    });

    it("uses the app queue and worker path instead of direct remote or voiceprint APIs", () => {
        const spec = readSource(REAL_VOSCRIPT_SPEC);
        const helper = readSource(REAL_VOSCRIPT_HELPER);
        const combined = `${spec}\n${helper}`;
        const realExternalBlock =
            spec.split("if (shouldRunRealVoScriptE2E())").at(1) ?? "";

        expect(spec).toContain("/api/recordings/");
        expect(spec).toContain("processDueTranscriptionJobs");
        expect(spec).toContain("processPendingSearchIndexJobs");
        expect(spec).toContain("/api/transcribe");
        expect(realExternalBlock).not.toContain("/api/transcribe");
        expect(combined).not.toContain("/api/settings/voscript/test");
        expect(combined).not.toContain("/voiceprints");
        expect(combined).not.toContain("listVoiceprints");
        expect(combined).not.toContain("deleteVoiceprint");
        expect(combined).not.toContain("submitVoiceTranscribeJob");
    });

    it("keeps copied current config/content redacted and isolated", () => {
        const spec = readSource(REAL_VOSCRIPT_SPEC);
        const helper = readSource(REAL_VOSCRIPT_HELPER);

        expect(helper).toContain("assertInsideRoot");
        expect(helper).toContain("decryptWithKey");
        expect(helper).toContain("encryptWithKey");
        expect(helper).toContain("auto_generate_title = 0");
        expect(helper).toContain("REAL_VOSCRIPT_TARGET_RECORDING_ID");
        expect(helper).not.toMatch(/console\.(log|info|warn|error)/);
        expect(spec).toContain('trace: "off"');
        expect(spec).toContain('screenshot: "off"');
    });
});
