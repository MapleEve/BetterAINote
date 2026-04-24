import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    type Mock,
    vi,
} from "vitest";

vi.mock("@/lib/data-sources/connections", () => ({
    getResolvedSourceConnectionForUser: vi.fn(),
}));

vi.mock("@/lib/data-sources/providers/plaud/client", () => ({
    PlaudClient: vi.fn(),
}));

import { getResolvedSourceConnectionForUser } from "@/lib/data-sources/connections";
import { PlaudClient } from "@/lib/data-sources/providers/plaud/client";
import {
    getSourceTitleWritebackRuntimeProviders,
    writeRecordingTitleToSource,
    writeRecordingTitleToSourceOrThrow,
} from "@/lib/data-sources/source-title-writeback";

describe("source title writeback", () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it("exposes the current runtime write-back implementations explicitly", () => {
        expect(getSourceTitleWritebackRuntimeProviders()).toEqual([
            "plaud",
            "ticnote",
        ]);
    });

    it("skips unsupported source providers", async () => {
        await expect(
            writeRecordingTitleToSource({
                userId: "user-1",
                recording: {
                    sourceProvider: "iflyrec",
                    sourceRecordingId: "iflyrec-1",
                },
                title: "Synthetic title",
            }),
        ).resolves.toBe(false);

        expect(getResolvedSourceConnectionForUser).not.toHaveBeenCalled();
    });

    it("updates the Plaud filename when source sync is enabled", async () => {
        const updateFilename = vi.fn().mockResolvedValue(undefined);

        (
            getResolvedSourceConnectionForUser as unknown as Mock
        ).mockResolvedValue({
            provider: "plaud",
            config: { syncTitleToSource: true },
            secrets: { bearerToken: "encrypted-token" },
            baseUrl: "https://api.plaud.ai",
        });
        (PlaudClient as unknown as Mock).mockImplementation(
            function MockPlaudClient() {
                return {
                    updateFilename,
                };
            },
        );

        await expect(
            writeRecordingTitleToSource({
                userId: "user-1",
                recording: {
                    sourceProvider: "plaud",
                    sourceRecordingId: "plaud-1",
                },
                title: "Synthetic title",
            }),
        ).resolves.toBe(true);

        expect(PlaudClient).toHaveBeenCalledWith(
            "encrypted-token",
            "https://api.plaud.ai",
        );
        expect(updateFilename).toHaveBeenCalledWith(
            "plaud-1",
            "Synthetic title",
        );
    });

    it("updates the TicNote title through the upstream source when source sync is enabled", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                code: 200,
                data: {
                    path: "/sanitized/path",
                    absolutePath: "/sanitized/absolute/path",
                },
            }),
        });
        global.fetch = fetchMock as typeof fetch;

        (
            getResolvedSourceConnectionForUser as unknown as Mock
        ).mockResolvedValue({
            userId: "user-1",
            provider: "ticnote",
            enabled: true,
            authMode: "bearer",
            config: {
                syncTitleToSource: true,
                orgId: "org_123",
                timezone: "Asia/Shanghai",
                language: "zh",
            },
            secrets: { bearerToken: "tic-token-123" },
            baseUrl: "https://voice-api.ticnote.cn",
            lastSync: null,
        });

        await expect(
            writeRecordingTitleToSource({
                userId: "user-1",
                recording: {
                    sourceProvider: "ticnote",
                    sourceRecordingId: "ticnote-1",
                },
                title: "Synthetic title",
            }),
        ).resolves.toBe(true);

        expect(fetchMock).toHaveBeenCalledWith(
            "https://voice-api.ticnote.cn/api/v1/knowledge/edit/ticnote-1",
            expect.objectContaining({
                method: "PUT",
                body: JSON.stringify({ title: "Synthetic title" }),
            }),
        );
        expect(
            Object.keys(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body)),
        ).toEqual(["title"]);
    });

    it("throws a clear error when upstream write-back is enabled but the recording is not linked upstream", async () => {
        (
            getResolvedSourceConnectionForUser as unknown as Mock
        ).mockResolvedValue({
            provider: "plaud",
            enabled: true,
            config: { syncTitleToSource: true },
            secrets: { bearerToken: "encrypted-token" },
            baseUrl: "https://api.plaud.ai",
        });

        await expect(
            writeRecordingTitleToSourceOrThrow({
                userId: "user-1",
                recording: {
                    sourceProvider: "plaud",
                    sourceRecordingId: "",
                },
                title: "Synthetic title",
            }),
        ).rejects.toMatchObject({
            message:
                "This recording is not linked to an upstream source entry that can accept title write-back",
            status: 409,
        });

        expect(PlaudClient).not.toHaveBeenCalled();
    });
});
