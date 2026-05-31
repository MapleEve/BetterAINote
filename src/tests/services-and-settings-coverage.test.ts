import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
    env: {
        ENCRYPTION_KEY:
            "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    },
}));

import {
    buildSourceAudioArchivePlan,
    downloadSourceAudioBuffer,
    extractFileExtension,
    fetchBuffer,
    parseJsonString,
    safeNumber,
    toDateOrNull,
} from "@/lib/data-sources/utils";
import { encrypt } from "@/lib/encryption";
import {
    normalizeFiniteNumber,
    normalizeFlooredNumberInRange,
    normalizeIntegerInRange,
    normalizeNonNegativeInteger,
    normalizeNullableIntegerMinimum,
    normalizePositiveNumber,
} from "@/lib/settings/number-normalization";
import {
    buildVoScriptProviderUpdates,
    normalizePrivateTranscriptionApiKey,
    normalizePrivateTranscriptionMaxInflightJobs,
    normalizePrivateTranscriptionNoRepeatNgramSize,
    normalizePrivateTranscriptionSnrThreshold,
    normalizeVoScriptDenoiseModel,
    resolveVoScriptSpeakerBounds,
    resolveVoScriptSpeakerBoundsFromStoredSettings,
} from "@/lib/settings/voscript-provider-settings";
import {
    parseSourceSecretConfig,
    resolveSourceConnectionConfig,
} from "@/server/modules/data-sources/connections";
import {
    getDataSources,
    saveDataSource,
    testDataSource,
} from "@/services/data-sources";
import { testVoScriptConnection } from "@/services/voscript-settings";

describe("data source utility coverage", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("normalizes source metadata and archive plans without leaking request tokens", () => {
        expect(toDateOrNull(new Date("bad"))).toBeNull();
        expect(toDateOrNull(1_775_000_000)).toEqual(
            new Date(1_775_000_000_000),
        );
        expect(toDateOrNull("1775000000000")).toEqual(
            new Date(1_775_000_000_000),
        );
        expect(toDateOrNull("2026-05-01T10:00:00.000Z")).toEqual(
            new Date("2026-05-01T10:00:00.000Z"),
        );
        expect(toDateOrNull("not-a-date")).toBeNull();

        expect(safeNumber("42", 1)).toBe(42);
        expect(safeNumber(Number.NaN, 7)).toBe(7);
        expect(extractFileExtension("https://example.test/audio.M4A?x=1")).toBe(
            "m4a",
        );
        expect(extractFileExtension(null, "wav")).toBe("wav");
        expect(parseJsonString('{"ok":true}', { ok: false })).toEqual({
            ok: true,
        });
        expect(parseJsonString("{bad", { ok: false })).toEqual({ ok: false });

        expect(
            buildSourceAudioArchivePlan({
                filename: "bad/name?.wav",
                sourceRecordingId: "remote-1",
                audioDownload: {
                    url: "https://example.test/download?id=secret",
                    headers: { Authorization: "Bearer token" },
                    fileExtension: ".mp3",
                },
            }),
        ).toEqual({
            url: "https://example.test/download?id=secret",
            headers: { Authorization: "Bearer token" },
            archiveBaseName: "bad-name-",
            fileExtension: "mp3",
            contentType: "audio/mpeg",
        });
        expect(
            buildSourceAudioArchivePlan({
                filename: "No audio",
                sourceRecordingId: "remote-2",
                audioDownload: null,
            }),
        ).toBeNull();
    });

    it("maps source fetch success and failure paths to stable errors", async () => {
        vi.stubGlobal(
            "fetch",
            vi
                .fn()
                .mockResolvedValueOnce(
                    new Response(new Uint8Array([1, 2, 3]), { status: 200 }),
                )
                .mockResolvedValueOnce(
                    new Response("forbidden", {
                        status: 403,
                        statusText: "Forbidden",
                    }),
                )
                .mockRejectedValueOnce(
                    Object.assign(new Error("late"), { name: "TimeoutError" }),
                )
                .mockRejectedValueOnce(new Error("socket reset")),
        );

        await expect(fetchBuffer("https://example.test/a")).resolves.toEqual(
            Buffer.from([1, 2, 3]),
        );
        await expect(
            fetchBuffer("https://example.test/a", { errorLabel: "audio" }),
        ).rejects.toThrow("audio (403 Forbidden)");
        await expect(
            fetchBuffer("https://example.test/a", { errorLabel: "audio" }),
        ).rejects.toThrow("audio: request timed out");
        await expect(
            downloadSourceAudioBuffer("plaud", {
                url: "https://example.test/file.mp3?token=secret",
            }),
        ).rejects.toThrow(
            "[plaud] Failed to download source audio from https://example.test/file.mp3: socket reset",
        );
    });
});

describe("settings normalization coverage", () => {
    it("validates numeric settings on success and failure paths", () => {
        expect(normalizeNonNegativeInteger("count", 0)).toBe(0);
        expect(normalizeFiniteNumber("snr", 1.25)).toBe(1.25);
        expect(normalizePositiveNumber("rate", 0.1)).toBe(0.1);
        expect(normalizeFlooredNumberInRange("size", 2.9, 1, 3)).toBe(2);
        expect(normalizeIntegerInRange("window", 3, 1, 5)).toBe(3);
        expect(normalizeNullableIntegerMinimum("limit", null, 1)).toBeNull();
        expect(normalizeNullableIntegerMinimum("limit", 2, 1)).toBe(2);

        expect(() => normalizeNonNegativeInteger("count", -1)).toThrow(
            "count must be a non-negative integer",
        );
        expect(() => normalizeFiniteNumber("snr", Number.NaN)).toThrow(
            "snr must be a number",
        );
        expect(() => normalizePositiveNumber("rate", 0)).toThrow(
            "rate must be a positive number",
        );
        expect(() => normalizeFlooredNumberInRange("size", 4, 1, 3)).toThrow(
            "size must be a number between 1 and 3",
        );
        expect(() => normalizeIntegerInRange("window", 1.5, 1, 5)).toThrow(
            "window must be an integer between 1 and 5",
        );
        expect(() => normalizeNullableIntegerMinimum("limit", 0, 1)).toThrow(
            "limit must be an integer greater than or equal to 1, or null",
        );
    });

    it("normalizes VoScript provider settings and legacy speaker bounds", () => {
        expect(normalizeVoScriptDenoiseModel(" DeepFilterNet ")).toBe(
            "deepfilternet",
        );
        expect(() => normalizeVoScriptDenoiseModel("bad")).toThrow(
            "privateTranscriptionDenoiseModel must be one of none, deepfilternet, or noisereduce",
        );

        const encryptedKey = normalizePrivateTranscriptionApiKey("  key  ");
        expect(encryptedKey).toBeTypeOf("string");
        expect(normalizePrivateTranscriptionApiKey(" ")).toBeNull();
        expect(() => normalizePrivateTranscriptionApiKey(1)).toThrow(
            "privateTranscriptionApiKey must be a string or null",
        );

        expect(
            resolveVoScriptSpeakerBounds({
                bodyMinSpeakers: 1,
                bodyMaxSpeakers: 2,
                existingMinSpeakers: null,
                existingMaxSpeakers: null,
            }),
        ).toEqual({ nextMinSpeakers: 1, nextMaxSpeakers: 2 });
        expect(
            resolveVoScriptSpeakerBounds({
                bodyMinSpeakers: undefined,
                bodyMaxSpeakers: undefined,
                existingMinSpeakers: 3,
                existingMaxSpeakers: null,
            }),
        ).toEqual({ nextMinSpeakers: 3, nextMaxSpeakers: 0 });
        expect(() =>
            resolveVoScriptSpeakerBounds({
                bodyMinSpeakers: 4,
                bodyMaxSpeakers: 2,
                existingMinSpeakers: null,
                existingMaxSpeakers: null,
            }),
        ).toThrow(
            "privateTranscriptionMaxSpeakers must be greater than or equal to privateTranscriptionMinSpeakers, or 0 for auto",
        );

        expect(
            resolveVoScriptSpeakerBoundsFromStoredSettings({
                speakerDiarization: true,
                diarizationSpeakers: 2,
            }),
        ).toEqual({
            minSpeakers: 2,
            maxSpeakers: 2,
            usesLegacySharedDiarization: true,
        });
        expect(
            resolveVoScriptSpeakerBoundsFromStoredSettings({
                privateTranscriptionMinSpeakers: 1,
                privateTranscriptionMaxSpeakers: 3,
            }),
        ).toEqual({
            minSpeakers: 1,
            maxSpeakers: 3,
            usesLegacySharedDiarization: false,
        });
        expect(resolveVoScriptSpeakerBoundsFromStoredSettings(null)).toEqual({
            minSpeakers: undefined,
            maxSpeakers: undefined,
            usesLegacySharedDiarization: false,
        });

        expect(normalizePrivateTranscriptionSnrThreshold(null)).toBeNull();
        expect(normalizePrivateTranscriptionSnrThreshold(3.2)).toBe(3.2);
        expect(normalizePrivateTranscriptionNoRepeatNgramSize(0)).toBe(0);
        expect(normalizePrivateTranscriptionNoRepeatNgramSize(3)).toBe(3);
        expect(() => normalizePrivateTranscriptionNoRepeatNgramSize(2)).toThrow(
            "privateTranscriptionNoRepeatNgramSize must be 0 or an integer greater than or equal to 3",
        );
        expect(normalizePrivateTranscriptionMaxInflightJobs(2)).toBe(2);
        expect(
            buildVoScriptProviderUpdates({
                privateTranscriptionBaseUrl: "https://voscript.test",
                privateTranscriptionMinSpeakers: 1,
                privateTranscriptionMaxSpeakers: 2,
                privateTranscriptionDenoiseModel: "none",
                privateTranscriptionSnrThreshold: null,
                privateTranscriptionNoRepeatNgramSize: 3,
                privateTranscriptionMaxInflightJobs: 2,
            }),
        ).toMatchObject({
            privateTranscriptionBaseUrl: "https://voscript.test",
            privateTranscriptionSnrThreshold: null,
        });
    });
});

describe("data source service and connection coverage", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("handles data source service responses and fallback errors", async () => {
        vi.stubGlobal(
            "fetch",
            vi
                .fn()
                .mockResolvedValueOnce(
                    Response.json({ sources: [] }, { status: 200 }),
                )
                .mockResolvedValueOnce(
                    Response.json({ error: "load failed" }, { status: 500 }),
                )
                .mockResolvedValueOnce(Response.json({}, { status: 200 }))
                .mockResolvedValueOnce(Response.json({ ok: true }))
                .mockResolvedValueOnce(new Response("{bad", { status: 500 }))
                .mockResolvedValueOnce(Response.json({ success: true }))
                .mockResolvedValueOnce(
                    Response.json({ error: "test failed" }, { status: 502 }),
                )
                .mockResolvedValueOnce(new Response("{bad", { status: 500 })),
        );

        await expect(getDataSources("/data")).resolves.toEqual({ sources: [] });
        await expect(getDataSources("/data")).rejects.toThrow("load failed");
        await expect(getDataSources("/data")).rejects.toThrow(
            "Failed to load data sources",
        );
        await expect(
            saveDataSource({
                provider: "plaud",
                enabled: false,
                authMode: "bearer",
                config: {},
                secrets: {},
            }),
        ).resolves.toEqual({ ok: true });
        await expect(
            saveDataSource(
                {
                    provider: "ticnote",
                    enabled: true,
                    authMode: "cookie",
                    config: {},
                    secrets: {},
                },
                { endpoint: "/data", fallbackMessage: "save failed" },
            ),
        ).rejects.toThrow("save failed");
        await expect(
            testDataSource(
                {
                    provider: "ticnote",
                    enabled: true,
                    authMode: "bearer",
                    config: {},
                    secrets: {},
                },
                { endpoint: "/data/test" },
            ),
        ).resolves.toEqual({ success: true });
        await expect(
            testDataSource(
                {
                    provider: "ticnote",
                    enabled: true,
                    authMode: "bearer",
                    config: {},
                    secrets: {},
                },
                { endpoint: "/data/test" },
            ),
        ).rejects.toThrow("test failed");
        await expect(
            testDataSource(
                {
                    provider: "ticnote",
                    enabled: true,
                    authMode: "bearer",
                    config: {},
                    secrets: {},
                },
                {
                    endpoint: "/data/test",
                    fallbackMessage: "test fallback",
                },
            ),
        ).rejects.toThrow("test fallback");
    });

    it("parses source connection secrets and provider config defaults", () => {
        expect(parseSourceSecretConfig(null)).toEqual({});
        expect(parseSourceSecretConfig("not encrypted json")).toEqual({});
        expect(
            parseSourceSecretConfig(
                encrypt(
                    JSON.stringify({
                        Authorization: "Bearer token",
                        empty: " ",
                        nested: { nope: true },
                    }),
                ),
            ),
        ).toEqual({ Authorization: "Bearer token" });

        expect(
            resolveSourceConnectionConfig("plaud", "https://api.plaud.ai", {
                region: "us",
            }),
        ).toEqual({
            customApiBase: "",
            server: "global",
            syncTitleToSource: false,
        });
        expect(resolveSourceConnectionConfig("ticnote", null, null)).toEqual({
            region: "cn",
            orgId: "",
            language: "zh",
            timezone: "Asia/Shanghai",
            syncTitleToSource: false,
        });
    });
});

describe("VoScript service connection coverage", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("posts connection tests to the no-persist VoScript endpoint", async () => {
        vi.stubGlobal(
            "fetch",
            vi
                .fn()
                .mockResolvedValueOnce(
                    Response.json(
                        {
                            available: true,
                            providerName: "voice-transcribe",
                            success: true,
                            voiceprintCount: 2,
                        },
                        { status: 200 },
                    ),
                )
                .mockResolvedValueOnce(
                    Response.json(
                        { error: "connection failed" },
                        { status: 502 },
                    ),
                )
                .mockResolvedValueOnce(new Response("{bad", { status: 500 })),
        );

        await expect(
            testVoScriptConnection({
                privateTranscriptionApiKey: "key",
                privateTranscriptionBaseUrl: "https://voscript.test",
            }),
        ).resolves.toEqual({
            available: true,
            providerName: "voice-transcribe",
            success: true,
            voiceprintCount: 2,
        });
        expect(fetch).toHaveBeenCalledWith("/api/settings/voscript/test", {
            body: JSON.stringify({
                privateTranscriptionApiKey: "key",
                privateTranscriptionBaseUrl: "https://voscript.test",
            }),
            headers: { "Content-Type": "application/json" },
            method: "POST",
        });

        await expect(
            testVoScriptConnection({
                privateTranscriptionBaseUrl: "https://voscript.test",
            }),
        ).rejects.toThrow("connection failed");
        await expect(
            testVoScriptConnection({
                privateTranscriptionBaseUrl: "https://voscript.test",
            }),
        ).rejects.toThrow("Failed to test VoScript connection");
    });
});
