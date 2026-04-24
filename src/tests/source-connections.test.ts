import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => {
    const limit = vi.fn();
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));

    return {
        limit,
        where,
        from,
        select,
    };
});

vi.mock("@/db", () => ({
    db: {
        select: dbMocks.select,
    },
}));

vi.mock("@/db/schema/core", () => ({
    sourceConnections: {
        userId: "userId",
        provider: "provider",
    },
}));

import {
    getResolvedSourceConnectionForUser,
    resolveSourceConnectionConfig,
} from "@/lib/data-sources/connections";

describe("source connections", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("resolves Plaud persisted config through the provider definition hook", () => {
        expect(
            resolveSourceConnectionConfig(
                "plaud",
                "https://api-euc1.plaud.ai",
                {
                    syncTitleToSource: true,
                },
            ),
        ).toEqual({
            server: "eu",
            customApiBase: "",
            syncTitleToSource: true,
        });
    });

    it("resolves TicNote persisted config through the provider definition hook", () => {
        expect(
            resolveSourceConnectionConfig(
                "ticnote",
                "https://prd-backend-api.ticnote.com/api",
                {
                    orgId: " org_fake_123 ",
                    timezone: " Asia/Tokyo ",
                    language: " en ",
                },
            ),
        ).toEqual({
            region: "intl",
            orgId: "org_fake_123",
            timezone: "Asia/Tokyo",
            language: "en",
            syncTitleToSource: false,
        });
    });

    it("normalizes persisted connection config before returning a resolved connection", async () => {
        dbMocks.limit.mockResolvedValueOnce([
            {
                userId: "user-1",
                provider: "plaud",
                enabled: true,
                authMode: "bearer",
                baseUrl: "https://api.plaud.cn",
                config: {},
                secretConfig: null,
                lastSync: null,
            },
        ]);

        await expect(
            getResolvedSourceConnectionForUser("user-1", "plaud"),
        ).resolves.toMatchObject({
            provider: "plaud",
            baseUrl: "https://api.plaud.cn",
            config: {
                server: "china",
                customApiBase: "",
                syncTitleToSource: false,
            },
        });
    });
});
