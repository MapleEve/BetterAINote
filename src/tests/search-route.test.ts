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
    searchLibrary: vi.fn(),
}));

import { GET } from "@/app/api/search/route";
import { auth } from "@/lib/auth";
import { searchLibrary } from "@/server/modules/search";

vi.spyOn(console, "error").mockImplementation(() => undefined);

describe("search route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (auth.api.getSession as unknown as Mock).mockResolvedValue({
            user: { id: "user-1" },
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
});
