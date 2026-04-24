import { and, asc, eq, inArray, isNull, lte, or } from "drizzle-orm";
import { db } from "@/db";
import { recordings, transcriptionJobs } from "@/db/schema/library";
import { transcriptions } from "@/db/schema/transcripts";
import { hasAnyTranscriptionCredential } from "@/lib/api-credentials/default-transcription";
import { createUserStorageProvider } from "@/lib/storage/factory";
import {
    findVoiceTranscribeCredential,
    getDecryptedVoiceTranscribeApiKey,
    getVoiceTranscribeCredentials,
} from "@/lib/voice-transcribe/credentials";
import {
    getConfiguredPrivateTranscriptionBaseUrl,
    getTranscriptionRuntimeSettingsForUser,
    listTranscriptionRuntimeSettingsForUsers,
} from "@/server/modules/settings";
import {
    getVoiceTranscribeResult,
    normalizeVoiceTranscribeJobError,
    pollVoiceTranscribeJob,
    submitVoiceTranscribeJob,
} from "./providers/voice-transcribe-provider";
import {
    buildPrivateTranscriptionOptions,
    normalizeTranscriptionError,
    PRIVATE_TRANSCRIPTION_MODEL,
    persistTranscriptionResult,
    transcribeRecording,
} from "./transcribe-recording";

export type TranscriptionJobStatus =
    | "pending"
    | "submitted"
    | "processing"
    | "succeeded"
    | "failed";

export interface TranscriptionQueueSummary {
    queued: number;
}

export interface TranscriptionWorkerSummary {
    processed: number;
    succeeded: number;
    failed: number;
}

const ACTIVE_TRANSCRIPTION_JOB_STATUSES: TranscriptionJobStatus[] = [
    "pending",
    "submitted",
    "processing",
];
const PRIVATE_JOB_POLL_MS = 5000;
const MAX_PRIVATE_JOB_SUBMIT_ATTEMPTS = 3;

function nextPrivatePollAt(from = new Date()) {
    return new Date(from.getTime() + PRIVATE_JOB_POLL_MS);
}

async function resolvePrivateTranscriptionApiKey(
    userId: string,
    baseURL: string,
): Promise<string | null> {
    const credentials = await getVoiceTranscribeCredentials(userId);
    return getDecryptedVoiceTranscribeApiKey(
        findVoiceTranscribeCredential(credentials, baseURL),
    );
}

function mapRemoteStatusToJobStatus(
    status: string,
): Extract<TranscriptionJobStatus, "submitted" | "processing"> {
    switch (status) {
        case "denoising":
        case "transcribing":
        case "identifying":
            return "processing";
        default:
            return "submitted";
    }
}

export function serializeTranscriptionJob(
    job: typeof transcriptionJobs.$inferSelect | null,
) {
    if (!job) {
        return null;
    }

    return {
        id: job.id,
        recordingId: job.recordingId,
        status: job.status,
        force: job.force,
        provider: job.provider,
        model: job.model,
        providerJobId: job.providerJobId,
        remoteStatus: job.remoteStatus,
        attempts: job.attempts,
        compressionWarning: job.compressionWarning,
        lastError: job.lastError,
        requestedAt: job.requestedAt.toISOString(),
        startedAt: job.startedAt?.toISOString() ?? null,
        submittedAt: job.submittedAt?.toISOString() ?? null,
        lastPolledAt: job.lastPolledAt?.toISOString() ?? null,
        completedAt: job.completedAt?.toISOString() ?? null,
        nextPollAt: job.nextPollAt?.toISOString() ?? null,
        updatedAt: job.updatedAt.toISOString(),
    };
}

export async function getTranscriptionJobForRecording(
    userId: string,
    recordingId: string,
) {
    const [job] = await db
        .select()
        .from(transcriptionJobs)
        .where(
            and(
                eq(transcriptionJobs.userId, userId),
                eq(transcriptionJobs.recordingId, recordingId),
            ),
        )
        .limit(1);

    return job ?? null;
}

export async function getActiveTranscriptionJobsForUser(userId: string) {
    return await db
        .select()
        .from(transcriptionJobs)
        .where(
            and(
                eq(transcriptionJobs.userId, userId),
                inArray(
                    transcriptionJobs.status,
                    ACTIVE_TRANSCRIPTION_JOB_STATUSES,
                ),
            ),
        );
}

export async function hasTranscriptionCapability(userId: string) {
    const [settings, credentials] = await Promise.all([
        getTranscriptionRuntimeSettingsForUser(userId),
        hasAnyTranscriptionCredential(userId),
    ]);

    return Boolean(
        getConfiguredPrivateTranscriptionBaseUrl(settings) || credentials,
    );
}

export async function enqueueTranscriptionJobs(
    userId: string,
    recordingIds: string[],
    options?: { force?: boolean },
): Promise<TranscriptionQueueSummary> {
    const requestedAt = new Date();
    const uniqueRecordingIds = [...new Set(recordingIds)];

    if (uniqueRecordingIds.length === 0) {
        return { queued: 0 };
    }

    for (const recordingId of uniqueRecordingIds) {
        await db
            .insert(transcriptionJobs)
            .values({
                userId,
                recordingId,
                status: "pending",
                force: options?.force ?? false,
                attempts: 0,
                provider: null,
                model: null,
                providerJobId: null,
                remoteStatus: null,
                compressionWarning: null,
                lastError: null,
                requestedAt,
                startedAt: null,
                submittedAt: null,
                lastPolledAt: null,
                completedAt: null,
                nextPollAt: null,
                updatedAt: requestedAt,
            })
            .onConflictDoUpdate({
                target: transcriptionJobs.recordingId,
                set: {
                    status: "pending",
                    force: options?.force ?? false,
                    attempts: 0,
                    provider: null,
                    model: null,
                    providerJobId: null,
                    remoteStatus: null,
                    compressionWarning: null,
                    lastError: null,
                    requestedAt,
                    startedAt: null,
                    submittedAt: null,
                    lastPolledAt: null,
                    completedAt: null,
                    nextPollAt: null,
                    updatedAt: requestedAt,
                },
            });
    }

    return { queued: uniqueRecordingIds.length };
}

async function markJobFailed(
    jobId: string,
    now: Date,
    lastError: string,
): Promise<void> {
    console.error("[transcription] job failed", {
        jobId,
        lastError,
    });

    await db
        .update(transcriptionJobs)
        .set({
            status: "failed",
            lastError,
            completedAt: now,
            nextPollAt: null,
            updatedAt: now,
        })
        .where(eq(transcriptionJobs.id, jobId));
}

function isMissingRemoteVoiceTranscribeJob(error: unknown) {
    if (!(error instanceof Error)) {
        return false;
    }

    return (
        error.message.includes("Voice-transcribe job polling failed (404)") &&
        error.message.includes("Job not found")
    );
}

async function requeueLostPrivateJob(
    job: typeof transcriptionJobs.$inferSelect,
    now: Date,
): Promise<void> {
    await db
        .update(transcriptionJobs)
        .set({
            status: "pending",
            provider: "voice-transcribe",
            model: PRIVATE_TRANSCRIPTION_MODEL,
            providerJobId: null,
            remoteStatus: null,
            startedAt: null,
            submittedAt: null,
            lastPolledAt: now,
            nextPollAt: null,
            lastError: null,
            updatedAt: now,
        })
        .where(eq(transcriptionJobs.id, job.id));
}

async function submitPrivateTranscriptionJob(
    job: typeof transcriptionJobs.$inferSelect,
    now: Date,
): Promise<void> {
    const [recording, settings] = await Promise.all([
        db
            .select({
                id: recordings.id,
                filename: recordings.filename,
                storagePath: recordings.storagePath,
            })
            .from(recordings)
            .where(eq(recordings.id, job.recordingId))
            .limit(1)
            .then((rows) => rows[0] ?? null),
        getTranscriptionRuntimeSettingsForUser(job.userId),
    ]);

    if (!recording) {
        await markJobFailed(job.id, now, "Recording not found");
        return;
    }

    const baseURL = getConfiguredPrivateTranscriptionBaseUrl(settings);
    if (!baseURL) {
        await markJobFailed(
            job.id,
            now,
            "No private transcription service URL configured",
        );
        return;
    }

    try {
        const apiKey = await resolvePrivateTranscriptionApiKey(
            job.userId,
            baseURL,
        );
        const storage = await createUserStorageProvider(job.userId);
        const audioBuffer = await storage.downloadFile(recording.storagePath);
        const submission = await submitVoiceTranscribeJob({
            baseURL,
            audioBuffer,
            filename: recording.filename,
            options: buildPrivateTranscriptionOptions({
                settings: settings ?? null,
                model: PRIVATE_TRANSCRIPTION_MODEL,
            }),
            apiKey,
        });

        await db
            .update(transcriptionJobs)
            .set({
                status: mapRemoteStatusToJobStatus(submission.status),
                provider: "voice-transcribe",
                model: PRIVATE_TRANSCRIPTION_MODEL,
                providerJobId: submission.jobId,
                remoteStatus: submission.status,
                attempts: job.attempts + 1,
                startedAt: job.startedAt ?? now,
                submittedAt: now,
                lastPolledAt: null,
                nextPollAt: nextPrivatePollAt(now),
                lastError: null,
                updatedAt: now,
            })
            .where(eq(transcriptionJobs.id, job.id));
    } catch (error) {
        await markJobFailed(job.id, now, normalizeTranscriptionError(error));
    }
}

async function pollPrivateTranscriptionJob(
    job: typeof transcriptionJobs.$inferSelect,
    now: Date,
): Promise<void> {
    const settings = await getTranscriptionRuntimeSettingsForUser(job.userId);
    const baseURL = getConfiguredPrivateTranscriptionBaseUrl(settings);
    if (!baseURL || !job.providerJobId) {
        await markJobFailed(
            job.id,
            now,
            "Private transcription job is missing its remote job id or base URL",
        );
        return;
    }

    try {
        const apiKey = await resolvePrivateTranscriptionApiKey(
            job.userId,
            baseURL,
        );
        const remoteJob = await pollVoiceTranscribeJob({
            baseURL,
            jobId: job.providerJobId,
            apiKey,
        });

        if (remoteJob.status === "failed") {
            await markJobFailed(
                job.id,
                now,
                normalizeVoiceTranscribeJobError(remoteJob),
            );
            return;
        }

        if (remoteJob.status !== "completed" || !remoteJob.result) {
            await db
                .update(transcriptionJobs)
                .set({
                    status: mapRemoteStatusToJobStatus(remoteJob.status),
                    remoteStatus: remoteJob.status,
                    lastPolledAt: now,
                    nextPollAt: nextPrivatePollAt(now),
                    lastError: null,
                    updatedAt: now,
                })
                .where(eq(transcriptionJobs.id, job.id));
            return;
        }

        const result = getVoiceTranscribeResult(remoteJob);
        await persistTranscriptionResult({
            userId: job.userId,
            recordingId: job.recordingId,
            result,
            providerName: "voice-transcribe",
            model: PRIVATE_TRANSCRIPTION_MODEL,
        });

        await db
            .update(transcriptionJobs)
            .set({
                status: "succeeded",
                provider: "voice-transcribe",
                model: PRIVATE_TRANSCRIPTION_MODEL,
                providerJobId: result.providerJobId ?? job.providerJobId,
                remoteStatus: remoteJob.status,
                compressionWarning: null,
                lastPolledAt: now,
                completedAt: now,
                nextPollAt: null,
                lastError: null,
                updatedAt: now,
            })
            .where(eq(transcriptionJobs.id, job.id));
    } catch (error) {
        if (isMissingRemoteVoiceTranscribeJob(error)) {
            if (job.attempts < MAX_PRIVATE_JOB_SUBMIT_ATTEMPTS) {
                await requeueLostPrivateJob(job, now);
                return;
            }

            await markJobFailed(
                job.id,
                now,
                `Remote queue lost the transcription job after ${job.attempts} submission attempts`,
            );
            return;
        }

        await markJobFailed(job.id, now, normalizeTranscriptionError(error));
    }
}

async function executeFallbackTranscriptionJob(
    job: typeof transcriptionJobs.$inferSelect,
    now: Date,
): Promise<void> {
    await db
        .update(transcriptionJobs)
        .set({
            status: "processing",
            provider: job.provider ?? "default",
            model: job.model ?? null,
            remoteStatus: "processing",
            attempts: job.attempts + 1,
            startedAt: job.startedAt ?? now,
            submittedAt: job.submittedAt ?? now,
            lastPolledAt: now,
            nextPollAt: null,
            lastError: null,
            updatedAt: now,
        })
        .where(eq(transcriptionJobs.id, job.id));

    const result = await transcribeRecording(job.userId, job.recordingId, {
        force: job.force,
    });

    if (!result.success) {
        await markJobFailed(
            job.id,
            new Date(),
            result.error || "Transcription failed",
        );
        return;
    }

    const [savedTranscription] = await db
        .select({
            provider: transcriptions.provider,
            model: transcriptions.model,
            providerJobId: transcriptions.providerJobId,
        })
        .from(transcriptions)
        .where(eq(transcriptions.recordingId, job.recordingId))
        .limit(1);

    const completedAt = new Date();
    await db
        .update(transcriptionJobs)
        .set({
            status: "succeeded",
            provider: savedTranscription?.provider ?? job.provider ?? "default",
            model: savedTranscription?.model ?? job.model ?? null,
            providerJobId:
                savedTranscription?.providerJobId ?? job.providerJobId,
            remoteStatus: "completed",
            compressionWarning: result.compressionWarning ?? null,
            lastPolledAt: completedAt,
            completedAt,
            nextPollAt: null,
            lastError: null,
            updatedAt: completedAt,
        })
        .where(eq(transcriptionJobs.id, job.id));
}

async function processTranscriptionJob(
    job: typeof transcriptionJobs.$inferSelect,
    now: Date,
): Promise<boolean> {
    if (job.status === "pending") {
        const settings = await getTranscriptionRuntimeSettingsForUser(
            job.userId,
        );

        if (getConfiguredPrivateTranscriptionBaseUrl(settings)) {
            await submitPrivateTranscriptionJob(job, now);
        } else {
            await executeFallbackTranscriptionJob(job, now);
        }

        return true;
    }

    if (job.provider === "voice-transcribe") {
        await pollPrivateTranscriptionJob(job, now);
        return true;
    }

    await executeFallbackTranscriptionJob(job, now);
    return true;
}

async function processTranscriptionJobSafely(
    job: typeof transcriptionJobs.$inferSelect,
    now: Date,
) {
    try {
        return await processTranscriptionJob(job, now);
    } catch (error) {
        await markJobFailed(
            job.id,
            new Date(),
            normalizeTranscriptionError(error),
        );
        return true;
    }
}

async function selectPendingJobsForProcessing(
    pendingJobs: (typeof transcriptionJobs.$inferSelect)[],
    limit: number,
) {
    if (pendingJobs.length === 0 || limit === 0) {
        return [];
    }

    const userIds = [...new Set(pendingJobs.map((job) => job.userId))];
    const [settingsRows, activeRemoteJobs] = await Promise.all([
        listTranscriptionRuntimeSettingsForUsers(userIds),
        db
            .select({
                userId: transcriptionJobs.userId,
            })
            .from(transcriptionJobs)
            .where(
                and(
                    inArray(transcriptionJobs.userId, userIds),
                    eq(transcriptionJobs.provider, "voice-transcribe"),
                    inArray(transcriptionJobs.status, [
                        "submitted",
                        "processing",
                    ]),
                ),
            ),
    ]);

    const settingsByUser = new Map(
        settingsRows.map((row) => [row.userId, row]),
    );
    const activeRemoteCounts = new Map<string, number>();
    for (const job of activeRemoteJobs) {
        activeRemoteCounts.set(
            job.userId,
            (activeRemoteCounts.get(job.userId) ?? 0) + 1,
        );
    }

    const selected: (typeof transcriptionJobs.$inferSelect)[] = [];
    for (const job of pendingJobs) {
        if (selected.length >= limit) {
            break;
        }

        const settings = settingsByUser.get(job.userId) ?? null;
        if (!getConfiguredPrivateTranscriptionBaseUrl(settings)) {
            selected.push(job);
            continue;
        }

        const maxInflightJobs =
            settings?.privateTranscriptionMaxInflightJobs ?? 1;
        if (maxInflightJobs === 0) {
            selected.push(job);
            continue;
        }

        const currentActive = activeRemoteCounts.get(job.userId) ?? 0;
        if (currentActive >= maxInflightJobs) {
            continue;
        }

        selected.push(job);
        activeRemoteCounts.set(job.userId, currentActive + 1);
    }

    return selected;
}

export async function processDueTranscriptionJobs(
    limit = 5,
): Promise<TranscriptionWorkerSummary> {
    const now = new Date();
    const dueRemoteJobs = await db
        .select()
        .from(transcriptionJobs)
        .where(
            and(
                inArray(transcriptionJobs.status, ["submitted", "processing"]),
                or(
                    isNull(transcriptionJobs.nextPollAt),
                    lte(transcriptionJobs.nextPollAt, now),
                ),
            ),
        )
        .orderBy(asc(transcriptionJobs.requestedAt))
        .limit(limit);

    const remainingSlots = Math.max(0, limit - dueRemoteJobs.length);
    const pendingCandidates =
        remainingSlots > 0
            ? await db
                  .select()
                  .from(transcriptionJobs)
                  .where(eq(transcriptionJobs.status, "pending"))
                  .orderBy(asc(transcriptionJobs.requestedAt))
                  .limit(Math.max(remainingSlots * 4, remainingSlots))
            : [];

    const pendingJobs = await selectPendingJobsForProcessing(
        pendingCandidates,
        remainingSlots,
    );
    const dueJobs = [...dueRemoteJobs, ...pendingJobs];

    const summary: TranscriptionWorkerSummary = {
        processed: 0,
        succeeded: 0,
        failed: 0,
    };

    const settled = await Promise.all(
        dueJobs.map(async (job) => ({
            jobId: job.id,
            processed: await processTranscriptionJobSafely(job, now),
        })),
    );

    const processedIds = settled
        .filter((result) => result.processed)
        .map((result) => result.jobId);

    summary.processed = processedIds.length;

    if (processedIds.length > 0) {
        const latestStatuses = await db
            .select({
                id: transcriptionJobs.id,
                status: transcriptionJobs.status,
            })
            .from(transcriptionJobs)
            .where(inArray(transcriptionJobs.id, processedIds));

        for (const latest of latestStatuses) {
            if (latest.status === "succeeded") {
                summary.succeeded += 1;
            } else if (latest.status === "failed") {
                summary.failed += 1;
            }
        }
    }

    return summary;
}
