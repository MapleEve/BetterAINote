import {
    isActiveTranscriptionJob,
    type TranscriptionJobLike,
} from "@/lib/transcription/job-display";

export interface DashboardTranscriptionPollJob extends TranscriptionJobLike {
    status: string;
    lastError?: string | null;
}

export interface DashboardTranscriptionPollResponse<TTranscript = unknown> {
    transcript?: TTranscript | null;
    job?: Partial<DashboardTranscriptionPollJob> | null;
}

export type DashboardTranscriptionPollResult<TTranscript = unknown> =
    | {
          state: "active";
          job: DashboardTranscriptionPollJob;
      }
    | {
          state: "completed";
          transcript: TTranscript;
          job: DashboardTranscriptionPollJob | null;
      }
    | {
          state: "failed";
          job: DashboardTranscriptionPollJob;
      }
    | {
          state: "idle";
          job: DashboardTranscriptionPollJob | null;
      };

export function getDashboardTranscriptionPollingKey(
    recordingId: string | null | undefined,
    job?: TranscriptionJobLike | null,
) {
    if (!recordingId || !isActiveTranscriptionJob(job)) {
        return null;
    }

    return [recordingId, job?.status ?? "", job?.remoteStatus ?? ""].join(":");
}

export function normalizeDashboardTranscriptionJob(
    job?: Partial<DashboardTranscriptionPollJob> | null,
): DashboardTranscriptionPollJob | null {
    if (typeof job?.status !== "string" || !job.status.trim()) {
        return null;
    }

    return {
        status: job.status,
        remoteStatus:
            typeof job.remoteStatus === "string" ? job.remoteStatus : null,
        lastError: typeof job.lastError === "string" ? job.lastError : null,
    };
}

export function areDashboardTranscriptionJobsEqual(
    left?: TranscriptionJobLike | null,
    right?: TranscriptionJobLike | null,
) {
    return (
        (left?.status ?? null) === (right?.status ?? null) &&
        (left?.remoteStatus ?? null) === (right?.remoteStatus ?? null) &&
        ("lastError" in (left ?? {})
            ? ((left as { lastError?: string | null }).lastError ?? null)
            : null) ===
            ("lastError" in (right ?? {})
                ? ((right as { lastError?: string | null }).lastError ?? null)
                : null)
    );
}

export function resolveDashboardTranscriptionPoll<TTranscript>(
    data?: DashboardTranscriptionPollResponse<TTranscript> | null,
): DashboardTranscriptionPollResult<TTranscript> {
    const job = normalizeDashboardTranscriptionJob(data?.job);

    if (job && isActiveTranscriptionJob(job)) {
        return {
            state: "active",
            job,
        };
    }

    if (job?.status === "failed") {
        return {
            state: "failed",
            job,
        };
    }

    if (data?.transcript) {
        return {
            state: "completed",
            transcript: data.transcript,
            job,
        };
    }

    return {
        state: "idle",
        job,
    };
}
