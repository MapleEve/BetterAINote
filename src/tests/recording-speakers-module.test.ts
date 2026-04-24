import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

vi.mock("@/db", () => ({
    db: {
        select: vi.fn(),
        update: vi.fn(),
    },
}));

vi.mock("@/server/modules/recordings/ownership", () => ({
    findOwnedRecording: vi.fn(),
}));

vi.mock("@/lib/speakers", async () => {
    const actual =
        await vi.importActual<typeof import("@/lib/speakers")>(
            "@/lib/speakers",
        );

    return {
        ...actual,
        applySpeakerProfileToRecording: vi.fn(),
        createSpeakerProfile: vi.fn(),
    };
});

vi.mock("@/lib/voice-transcribe/service", () => ({
    getVoiceTranscribeAccessForUser: vi.fn(),
}));

vi.mock("@/lib/voice-transcribe/client", () => ({
    VoiceTranscribeHttpError: class VoiceTranscribeHttpError extends Error {
        status: number;

        constructor(message: string, status: number) {
            super(message);
            this.name = "VoiceTranscribeHttpError";
            this.status = status;
        }
    },
}));

import { db } from "@/db";
import {
    applySpeakerProfileToRecording,
    createSpeakerProfile,
} from "@/lib/speakers";
import { VoiceTranscribeHttpError } from "@/lib/voice-transcribe/client";
import { getVoiceTranscribeAccessForUser } from "@/lib/voice-transcribe/service";
import { findOwnedRecording } from "@/server/modules/recordings/ownership";
import {
    getRecordingSpeakersReview,
    RecordingSpeakersError,
    updateRecordingSpeakerReview,
} from "@/server/modules/recordings/speakers-review";

function mockSelectLimitResult(result: unknown[]) {
    (db.select as Mock).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue(result),
            }),
        }),
    });
}

function mockSelectWhereResult(result: unknown[]) {
    (db.select as Mock).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(result),
        }),
    });
}

describe("recording speakers module", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (findOwnedRecording as Mock).mockResolvedValue({ id: "rec-1" });
    });

    describe("getRecordingSpeakersReview", () => {
        it("throws 404 when the recording is not owned by the user", async () => {
            (findOwnedRecording as Mock).mockResolvedValueOnce(null);

            await expect(
                getRecordingSpeakersReview("user-1", "rec-1"),
            ).rejects.toEqual(
                expect.objectContaining({
                    message: "Recording not found",
                    status: 404,
                }),
            );

            expect(db.select).not.toHaveBeenCalled();
        });

        it("builds a stable speakers review payload", async () => {
            mockSelectWhereResult([
                {
                    rawLabel: "Speaker 2",
                    matchedProfileId: null,
                    sampleSegments: null,
                    segmentCount: 1,
                    updatedAt: new Date("2026-04-18T10:06:00.000Z"),
                },
                {
                    rawLabel: "Speaker 1",
                    matchedProfileId: "profile-1",
                    sampleSegments: [
                        {
                            startMs: 1000,
                            endMs: 3500,
                            text: "Hello there",
                        },
                    ],
                    segmentCount: 3,
                    updatedAt: new Date("2026-04-18T10:05:00.000Z"),
                },
            ]);
            mockSelectWhereResult([
                {
                    id: "profile-2",
                    displayName: "Blake",
                    voiceprintRef: null,
                },
                {
                    id: "profile-1",
                    displayName: "Alex",
                    voiceprintRef: "vp-1",
                },
            ]);

            await expect(
                getRecordingSpeakersReview("user-1", "rec-1"),
            ).resolves.toEqual({
                recordingId: "rec-1",
                reviewBasis: "private-transcript",
                rawTranscriptUrl: "/api/recordings/rec-1/transcript/raw",
                speakerTranscriptUrl:
                    "/api/recordings/rec-1/transcript/speakers",
                speakers: [
                    {
                        rawLabel: "Speaker 1",
                        matchedProfileId: "profile-1",
                        matchedProfileName: "Alex",
                        hasVoiceprint: true,
                        sampleSegments: [
                            {
                                startMs: 1000,
                                endMs: 3500,
                                text: "Hello there",
                            },
                        ],
                        sampleCount: 1,
                        hasPlayableSample: true,
                        segmentCount: 3,
                        updatedAt: "2026-04-18T10:05:00.000Z",
                    },
                    {
                        rawLabel: "Speaker 2",
                        matchedProfileId: null,
                        matchedProfileName: null,
                        hasVoiceprint: false,
                        sampleSegments: [],
                        sampleCount: 0,
                        hasPlayableSample: false,
                        segmentCount: 1,
                        updatedAt: "2026-04-18T10:06:00.000Z",
                    },
                ],
                profiles: [
                    {
                        id: "profile-1",
                        displayName: "Alex",
                        voiceprintRef: "vp-1",
                        hasVoiceprint: true,
                    },
                    {
                        id: "profile-2",
                        displayName: "Blake",
                        voiceprintRef: null,
                        hasVoiceprint: false,
                    },
                ],
            });
        });
    });

    describe("updateRecordingSpeakerReview", () => {
        it("rejects blank raw labels", async () => {
            await expect(
                updateRecordingSpeakerReview("user-1", "rec-1", {
                    rawLabel: "   ",
                }),
            ).rejects.toEqual(
                expect.objectContaining({
                    message: "rawLabel is required",
                    status: 400,
                }),
            );

            expect(findOwnedRecording).not.toHaveBeenCalled();
        });

        it("clears a matched profile when neither profileId nor profileName is provided", async () => {
            mockSelectLimitResult([
                {
                    provider: "voice-transcribe",
                    providerJobId: "job-1",
                },
            ]);

            await expect(
                updateRecordingSpeakerReview("user-1", "rec-1", {
                    rawLabel: "SPEAKER_01",
                }),
            ).resolves.toEqual({
                success: true,
                rawLabel: "SPEAKER_01",
                profileId: null,
                voiceprintRef: null,
            });

            expect(applySpeakerProfileToRecording).toHaveBeenCalledWith({
                recordingId: "rec-1",
                rawLabel: "SPEAKER_01",
                profileId: null,
            });
            expect(getVoiceTranscribeAccessForUser).not.toHaveBeenCalled();
        });

        it("throws 404 when an existing profile does not belong to the user", async () => {
            mockSelectLimitResult([]);
            mockSelectLimitResult([]);

            await expect(
                updateRecordingSpeakerReview("user-1", "rec-1", {
                    rawLabel: "SPEAKER_01",
                    profileId: "profile-1",
                }),
            ).rejects.toEqual(
                expect.objectContaining({
                    message: "Speaker profile not found",
                    status: 404,
                }),
            );
        });

        it("creates a new speaker profile and enrolls the remote voiceprint", async () => {
            const enrollVoiceprint = vi.fn().mockResolvedValue({
                action: "created",
                speakerId: "vp-2",
            });

            mockSelectLimitResult([
                {
                    provider: "voice-transcribe",
                    providerJobId: "job-1",
                },
            ]);
            (
                getVoiceTranscribeAccessForUser as unknown as Mock
            ).mockResolvedValue({
                client: { enrollVoiceprint },
            });
            (createSpeakerProfile as unknown as Mock).mockResolvedValue({
                id: "profile-2",
                displayName: "Taylor",
                voiceprintRef: "vp-2",
            });

            await expect(
                updateRecordingSpeakerReview("user-1", "rec-1", {
                    rawLabel: "SPEAKER_01",
                    profileName: "Taylor",
                }),
            ).resolves.toEqual({
                success: true,
                rawLabel: "SPEAKER_01",
                profileId: "profile-2",
                voiceprintRef: "vp-2",
            });

            expect(enrollVoiceprint).toHaveBeenCalledWith({
                transcriptionId: "job-1",
                speakerLabel: "SPEAKER_01",
                speakerName: "Taylor",
                speakerId: null,
            });
            expect(createSpeakerProfile).toHaveBeenCalledWith(
                "user-1",
                "Taylor",
                "vp-2",
            );
            expect(applySpeakerProfileToRecording).toHaveBeenCalledWith({
                recordingId: "rec-1",
                rawLabel: "SPEAKER_01",
                profileId: "profile-2",
            });
        });

        it("maps remote voiceprint errors to stable route statuses", async () => {
            mockSelectLimitResult([
                {
                    provider: "voice-transcribe",
                    providerJobId: "job-1",
                },
            ]);
            (
                getVoiceTranscribeAccessForUser as unknown as Mock
            ).mockResolvedValue({
                client: {
                    enrollVoiceprint: vi
                        .fn()
                        .mockRejectedValue(
                            new VoiceTranscribeHttpError(
                                "upstream failed",
                                500,
                            ),
                        ),
                },
            });

            await expect(
                updateRecordingSpeakerReview("user-1", "rec-1", {
                    rawLabel: "SPEAKER_01",
                    profileName: "Taylor",
                }),
            ).rejects.toEqual(
                expect.objectContaining({
                    message: "声纹服务暂时不可用，请稍后重试",
                    status: 502,
                }),
            );
        });
    });

    it("keeps the exported error type stable", () => {
        const error = new RecordingSpeakersError("boom", 500);

        expect(error).toBeInstanceOf(Error);
        expect(error.status).toBe(500);
        expect(error.name).toBe("RecordingSpeakersError");
    });
});
