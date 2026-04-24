import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

vi.mock("@/db", () => ({
    db: {
        delete: vi.fn(),
        insert: vi.fn(),
        select: vi.fn(),
        update: vi.fn(),
    },
}));

import { db } from "@/db";
import {
    applySpeakerProfileToRecording,
    createSpeakerProfile,
    syncRecordingSpeakers,
} from "@/lib/speakers";

describe("speakers helpers", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("syncs transcript labels, preserves existing matches, and deletes stale labels", async () => {
        const insertValues = vi.fn().mockReturnValue({
            onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        });
        const deleteWhere = vi.fn().mockResolvedValue(undefined);

        (db.select as Mock).mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([
                    {
                        rawLabel: "Speaker 1",
                        matchedProfileId: "profile-1",
                    },
                ]),
            }),
        });
        (db.insert as Mock).mockReturnValue({
            values: insertValues,
        });
        (db.delete as Mock).mockReturnValue({
            where: deleteWhere,
        });

        await syncRecordingSpeakers({
            userId: "user-1",
            recordingId: "rec-1",
            transcriptText: "Speaker 1: Hello\n\nSpeaker 2: Hi there",
            speakerSegments: [
                {
                    speaker: "Speaker 1",
                    startMs: 0,
                    endMs: 1000,
                    text: "Hello",
                },
                {
                    speaker: "Speaker 2",
                    startMs: 1000,
                    endMs: 2000,
                    text: "Hi there",
                },
            ],
        });

        expect(insertValues).toHaveBeenCalledTimes(2);
        expect(insertValues.mock.calls[0][0]).toMatchObject({
            userId: "user-1",
            recordingId: "rec-1",
            rawLabel: "Speaker 1",
            matchedProfileId: "profile-1",
            segmentCount: 1,
            sampleSegments: [
                {
                    startMs: 0,
                    endMs: 1000,
                    text: "Hello",
                },
            ],
        });
        expect(insertValues.mock.calls[1][0]).toMatchObject({
            rawLabel: "Speaker 2",
            matchedProfileId: null,
        });
        expect(deleteWhere).toHaveBeenCalled();
    });

    it("updates transcription speakerMap when assigning or clearing a profile", async () => {
        const updateWhere = vi.fn().mockResolvedValue(undefined);
        const updateSet = vi.fn().mockReturnValue({
            where: updateWhere,
        });

        (db.update as Mock).mockReturnValue({
            set: updateSet,
        });
        (db.select as Mock)
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([
                            {
                                id: "tx-1",
                                speakerMap: { "Speaker 1": "Old Name" },
                            },
                        ]),
                    }),
                }),
            })
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi
                            .fn()
                            .mockResolvedValue([{ displayName: "Alex" }]),
                    }),
                }),
            });

        await applySpeakerProfileToRecording({
            recordingId: "rec-1",
            rawLabel: "Speaker 1",
            profileId: "profile-1",
        });

        expect(updateSet.mock.calls[1][0]).toEqual({
            speakerMap: { "Speaker 1": "Alex" },
        });

        (db.select as Mock).mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([
                        {
                            id: "tx-1",
                            speakerMap: { "Speaker 1": "Alex" },
                        },
                    ]),
                }),
            }),
        });

        await applySpeakerProfileToRecording({
            recordingId: "rec-1",
            rawLabel: "Speaker 1",
            profileId: null,
        });

        expect(updateSet.mock.calls[3][0]).toEqual({
            speakerMap: {},
        });
    });

    it("creates or upserts a trimmed speaker profile", async () => {
        const returning = vi.fn().mockResolvedValue([
            {
                id: "profile-1",
                displayName: "Taylor",
                voiceprintRef: "vp-1",
            },
        ]);

        const onConflictDoUpdate = vi.fn().mockReturnValue({
            returning,
        });
        const values = vi.fn().mockReturnValue({
            onConflictDoUpdate,
        });

        (db.insert as Mock).mockReturnValue({
            values,
        });

        const profile = await createSpeakerProfile(
            "user-1",
            " Taylor ",
            " vp-1 ",
        );

        expect(values).toHaveBeenCalledWith({
            userId: "user-1",
            displayName: "Taylor",
            voiceprintRef: "vp-1",
        });
        expect(profile).toEqual({
            id: "profile-1",
            displayName: "Taylor",
            voiceprintRef: "vp-1",
        });
    });

    it("prefers longer speaker samples over short acknowledgements", async () => {
        const insertValues = vi.fn().mockReturnValue({
            onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        });

        (db.select as Mock).mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([]),
            }),
        });
        (db.insert as Mock).mockReturnValue({
            values: insertValues,
        });
        (db.delete as Mock).mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
        });

        await syncRecordingSpeakers({
            userId: "user-1",
            recordingId: "rec-1",
            transcriptText: "",
            speakerSegments: [
                {
                    speaker: "Speaker 1",
                    startMs: 0,
                    endMs: 300,
                    text: "对",
                },
                {
                    speaker: "Speaker 1",
                    startMs: 1000,
                    endMs: 5000,
                    text: "这是一个更长的完整句子，应该优先作为声纹确认示例。",
                },
                {
                    speaker: "Speaker 1",
                    startMs: 6000,
                    endMs: 9000,
                    text: "然后这里还有另一段较长的补充说明，适合人工试听辨认。",
                },
                {
                    speaker: "Speaker 1",
                    startMs: 9500,
                    endMs: 9800,
                    text: "嗯",
                },
            ],
        });

        expect(insertValues.mock.calls[0][0]).toMatchObject({
            rawLabel: "Speaker 1",
        });
        expect(insertValues.mock.calls[0][0].sampleSegments[0]).toMatchObject({
            startMs: 0,
            endMs: 9800,
            text: "对 这是一个更长的完整句子，应该优先作为声纹确认示例。 然后这里还有另一段较长的补充说明，适合人工试听辨认。 嗯",
        });
    });

    it("merges adjacent short turns from the same speaker into a better sample", async () => {
        const insertValues = vi.fn().mockReturnValue({
            onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        });

        (db.select as Mock).mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([]),
            }),
        });
        (db.insert as Mock).mockReturnValue({
            values: insertValues,
        });
        (db.delete as Mock).mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
        });

        await syncRecordingSpeakers({
            userId: "user-1",
            recordingId: "rec-2",
            transcriptText: "",
            speakerSegments: [
                {
                    speaker: "Speaker 5",
                    startMs: 9_100,
                    endMs: 9_450,
                    text: "都有問題",
                },
                {
                    speaker: "Speaker 5",
                    startMs: 9_620,
                    endMs: 10_500,
                    text: "我現在也沒有找到一個格式",
                },
                {
                    speaker: "Speaker 5",
                    startMs: 10_800,
                    endMs: 12_000,
                    text: "很完美解決我們所有的問題",
                },
            ],
        });

        expect(insertValues.mock.calls[0][0].sampleSegments[0]).toMatchObject({
            startMs: 9_100,
            endMs: 12_000,
            text: "都有問題 我現在也沒有找到一個格式 很完美解決我們所有的問題",
        });
    });
});
