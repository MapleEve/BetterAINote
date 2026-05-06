import { describe, expect, it } from "vitest";

import {
    getDashboardTranscriptionPollingKey,
    resolveDashboardTranscriptionPoll,
} from "@/features/dashboard/transcription-polling";

describe("dashboard transcription polling", () => {
    it("does not treat an existing transcript as complete while the job is still active", () => {
        const result = resolveDashboardTranscriptionPoll({
            transcript: {
                text: "old transcript",
            },
            job: {
                status: "submitted",
                remoteStatus: "transcribing",
                lastError: null,
            },
        });

        expect(result).toEqual({
            state: "active",
            job: {
                status: "submitted",
                remoteStatus: "transcribing",
                lastError: null,
            },
        });
    });

    it("treats a transcript as complete once the job is no longer active", () => {
        const result = resolveDashboardTranscriptionPoll({
            transcript: {
                text: "new transcript",
                detectedLanguage: "zh",
            },
            job: {
                status: "succeeded",
                remoteStatus: null,
                lastError: null,
            },
        });

        expect(result).toMatchObject({
            state: "completed",
            transcript: {
                text: "new transcript",
                detectedLanguage: "zh",
            },
            job: {
                status: "succeeded",
                remoteStatus: null,
                lastError: null,
            },
        });
    });

    it("keeps the polling dependency stable for equivalent active job snapshots", () => {
        expect(
            getDashboardTranscriptionPollingKey("rec-1", {
                status: "submitted",
                remoteStatus: "transcribing",
            }),
        ).toBe(
            getDashboardTranscriptionPollingKey("rec-1", {
                status: "submitted",
                remoteStatus: "transcribing",
            }),
        );
        expect(
            getDashboardTranscriptionPollingKey("rec-1", {
                status: "succeeded",
                remoteStatus: null,
            }),
        ).toBeNull();
    });
});
