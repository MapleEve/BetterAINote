import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
    auth: {
        api: {
            getSession: vi.fn(),
        },
    },
}));

vi.mock("@/server/modules/search", () => ({
    SEARCH_ENTITY_TYPES: ["recording", "transcript", "speaker", "tag"],
    getSearchIndexingProgress: vi.fn(),
    searchLibrary: vi.fn(),
}));

import { GET } from "@/app/api/search/route";
import { auth } from "@/lib/auth";
import {
    getSearchIndexingProgress,
    searchLibrary,
} from "@/server/modules/search";

vi.spyOn(console, "error").mockImplementation(() => undefined);

describe("search route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (auth.api.getSession as unknown as Mock).mockResolvedValue({
            user: { id: "user-1" },
        });
        (getSearchIndexingProgress as Mock).mockResolvedValue({
            active: false,
            pendingJobs: 0,
            indexingJobs: 0,
            completedJobs: 0,
            totalJobs: 0,
        });
    });

    it("routes authenticated queries through the search module with entity filters", async () => {
        (searchLibrary as Mock).mockResolvedValue([
            {
                entityType: "recording",
                entityId: "recording-1",
                recordingId: "recording-1",
                title: "Demo",
                body: "Demo body",
                tags: [],
                source: "plaud",
                startMs: null,
                endMs: null,
                sortSeqMs: 100,
                rank: -1,
            },
        ]);

        const response = await GET(
            new Request(
                "http://localhost/api/search?q=demo&type=recording&type=transcript&limit=25",
            ),
        );

        expect(response.status).toBe(200);
        expect(response.headers.get("Cache-Control")).toBe("private, no-store");
        expect(searchLibrary).toHaveBeenCalledWith({
            userId: "user-1",
            query: "demo",
            entityTypes: ["recording", "transcript"],
            limit: 25,
        });
        await expect(response.json()).resolves.toEqual({
            results: [
                expect.objectContaining({
                    entityType: "recording",
                    entityId: "recording-1",
                }),
            ],
        });
    });

    it("returns the SOT indexing state while queued search index jobs are active", async () => {
        (getSearchIndexingProgress as Mock).mockResolvedValue({
            active: true,
            pendingJobs: 3,
            indexingJobs: 2,
            completedJobs: 0,
            totalJobs: 5,
        });

        const response = await GET(
            new Request("http://localhost/api/search?q=demo&type=recording"),
        );

        expect(response.status).toBe(200);
        expect(searchLibrary).not.toHaveBeenCalled();
        await expect(response.json()).resolves.toEqual({
            results: [],
            indexing: {
                active: true,
                pendingJobs: 3,
                indexingJobs: 2,
                completedJobs: 0,
                totalJobs: 5,
            },
        });
    });

    it("keeps unauthorized requests distinct without touching search state", async () => {
        (auth.api.getSession as unknown as Mock).mockResolvedValue(null);

        const response = await GET(
            new Request("http://localhost/api/search?q=demo&type=recording"),
        );

        expect(response.status).toBe(401);
        expect(getSearchIndexingProgress).not.toHaveBeenCalled();
        expect(searchLibrary).not.toHaveBeenCalled();
        await expect(response.json()).resolves.toEqual({
            error: "Unauthorized",
        });
    });

    it("rejects unsupported entity types before touching the repository", async () => {
        const response = await GET(
            new Request("http://localhost/api/search?q=demo&type=payload"),
        );

        expect(response.status).toBe(400);
        expect(searchLibrary).not.toHaveBeenCalled();
        await expect(response.json()).resolves.toMatchObject({
            error: "Unsupported search entity type: payload",
        });
    });

    it("redacts internal search failures from public JSON responses", async () => {
        (searchLibrary as Mock).mockRejectedValue(
            new Error(
                "SQLITE_BUSY /Users/maplec5/private/search.db token=secret cookie=session",
            ),
        );

        const response = await GET(
            new Request("http://localhost/api/search?q=demo&type=recording"),
        );
        const body = await response.json();
        const serialized = JSON.stringify(body);

        expect(response.status).toBe(500);
        expect(body).toEqual({
            error: "Failed to search library",
        });
        expect(serialized).not.toContain("SQLITE_BUSY");
        expect(serialized).not.toContain("/Users/maplec5/private/search.db");
        expect(serialized).not.toContain("token=secret");
        expect(serialized).not.toContain("cookie=session");
    });

    it("deduplicates comma-separated entity filters and clamps large limits", async () => {
        (searchLibrary as Mock).mockResolvedValue([]);

        const response = await GET(
            new Request(
                "http://localhost/api/search?q=demo&type=recording,transcript&type=recording&limit=9999",
            ),
        );

        expect(response.status).toBe(200);
        expect(searchLibrary).toHaveBeenCalledWith({
            userId: "user-1",
            query: "demo",
            entityTypes: ["recording", "transcript"],
            limit: 100,
        });
    });
});
