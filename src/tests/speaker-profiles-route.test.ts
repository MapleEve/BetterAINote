import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

vi.mock("@/db", () => ({
    db: {
        select: vi.fn(),
        update: vi.fn(),
    },
}));

vi.mock("@/lib/auth", () => ({
    auth: {
        api: {
            getSession: vi.fn(),
        },
    },
}));

vi.mock("@/lib/speakers", () => ({
    createSpeakerProfile: vi.fn(),
}));

import { PATCH } from "@/app/api/speakers/profiles/[id]/route";
import { GET, POST } from "@/app/api/speakers/profiles/route";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { createSpeakerProfile } from "@/lib/speakers";

vi.spyOn(console, "error").mockImplementation(() => undefined);

function makeRequest() {
    return new Request("http://localhost/api/speakers/profiles", {
        method: "GET",
    });
}

function makeParams(id: string) {
    return { params: Promise.resolve({ id }) };
}

describe("Speaker profiles route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (auth.api.getSession as unknown as Mock).mockResolvedValue({
            user: { id: "user-1" },
        });
    });

    it("returns 401 when unauthenticated", async () => {
        (auth.api.getSession as unknown as Mock).mockResolvedValue(null);

        const response = await GET(makeRequest());

        expect(response.status).toBe(401);
    });

    it("returns sorted profiles with assignment counts and no-store headers", async () => {
        (db.select as Mock)
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([
                        {
                            id: "profile-2",
                            displayName: "Blake",
                            voiceprintRef: null,
                            createdAt: new Date("2026-04-18T10:00:00.000Z"),
                            updatedAt: new Date("2026-04-18T10:03:00.000Z"),
                        },
                        {
                            id: "profile-1",
                            displayName: "Alex",
                            voiceprintRef: "vp-1",
                            createdAt: new Date("2026-04-18T09:00:00.000Z"),
                            updatedAt: new Date("2026-04-18T09:30:00.000Z"),
                        },
                    ]),
                }),
            })
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi
                        .fn()
                        .mockResolvedValue([
                            { matchedProfileId: "profile-2" },
                            { matchedProfileId: "profile-1" },
                            { matchedProfileId: "profile-1" },
                            { matchedProfileId: null },
                        ]),
                }),
            });

        const response = await GET(makeRequest());

        expect(response.status).toBe(200);
        expect(response.headers.get("Cache-Control")).toBe("private, no-store");

        const json = await response.json();
        expect(json.profiles).toEqual([
            {
                id: "profile-1",
                displayName: "Alex",
                voiceprintRef: "vp-1",
                createdAt: "2026-04-18T09:00:00.000Z",
                updatedAt: "2026-04-18T09:30:00.000Z",
                assignmentCount: 2,
            },
            {
                id: "profile-2",
                displayName: "Blake",
                voiceprintRef: null,
                createdAt: "2026-04-18T10:00:00.000Z",
                updatedAt: "2026-04-18T10:03:00.000Z",
                assignmentCount: 1,
            },
        ]);
    });

    it("rejects profile creation without a display name", async () => {
        const response = await POST(
            new Request("http://localhost/api/speakers/profiles", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ displayName: "  " }),
            }),
        );

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            error: "displayName is required",
        });
    });

    it("creates and serializes a new speaker profile", async () => {
        (createSpeakerProfile as unknown as Mock).mockResolvedValue({
            id: "profile-3",
            displayName: "Jordan",
            voiceprintRef: "vp-3",
            createdAt: new Date("2026-04-18T11:00:00.000Z"),
            updatedAt: new Date("2026-04-18T11:01:00.000Z"),
        });

        const response = await POST(
            new Request("http://localhost/api/speakers/profiles", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    displayName: "Jordan",
                    voiceprintRef: " vp-3 ",
                }),
            }),
        );

        expect(response.status).toBe(200);
        expect(createSpeakerProfile).toHaveBeenCalledWith(
            "user-1",
            "Jordan",
            "vp-3",
        );
        await expect(response.json()).resolves.toEqual({
            profile: {
                id: "profile-3",
                displayName: "Jordan",
                voiceprintRef: "vp-3",
                createdAt: "2026-04-18T11:00:00.000Z",
                updatedAt: "2026-04-18T11:01:00.000Z",
                assignmentCount: 0,
            },
        });
    });

    it("updates and serializes a speaker profile without leaking raw database fields", async () => {
        (db.update as Mock).mockReturnValue({
            set: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    returning: vi.fn().mockResolvedValue([
                        {
                            id: "profile-1",
                            userId: "user-1",
                            displayName: "Alex",
                            voiceprintRef: null,
                            createdAt: new Date("2026-04-18T09:00:00.000Z"),
                            updatedAt: new Date("2026-04-18T09:35:00.000Z"),
                        },
                    ]),
                }),
            }),
        });

        const response = await PATCH(
            new Request("http://localhost/api/speakers/profiles/profile-1", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    displayName: " Alex ",
                    voiceprintRef: "",
                }),
            }),
            makeParams("profile-1"),
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            profile: {
                id: "profile-1",
                displayName: "Alex",
                voiceprintRef: null,
                createdAt: "2026-04-18T09:00:00.000Z",
                updatedAt: "2026-04-18T09:35:00.000Z",
                assignmentCount: 0,
            },
        });
    });
});
