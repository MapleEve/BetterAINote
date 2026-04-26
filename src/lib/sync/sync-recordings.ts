import { and, eq, inArray, ne, notInArray, or } from "drizzle-orm";
import { db } from "@/db";
import {
    sourceConnections,
    syncWorkerState,
    userSettings,
} from "@/db/schema/core";
import { recordings } from "@/db/schema/library";
import { sourceArtifacts } from "@/db/schema/transcripts";
import {
    canRecordingUsePrivateTranscribe,
    createSourceProviderClient,
    getEnabledSourceConnectionsForUser,
    isSourceProvider,
    type ResolvedSourceConnection,
    type SourceArtifacts,
    type SourceRecordingData,
    sourceConnectionSupportsWorkerSync,
} from "@/lib/data-sources";
import { PUBLIC_DATA_SOURCE_IMPORT_ERROR } from "@/lib/data-sources/public-errors";
import {
    buildSourceAudioArchivePlan,
    downloadSourceAudioBuffer,
} from "@/lib/data-sources/utils";
import { createUserStorageProvider } from "@/lib/storage/factory";
import {
    resolveUniqueRecordingArchiveKey,
    uploadArchivedRecordingAudio,
} from "@/lib/storage/recording-archive";
import { enqueueTranscriptionJobs } from "@/lib/transcription/jobs";
import { replaceSourceArtifactSegmentsForArtifact } from "@/server/modules/search/indexer";

const SYNC_CONFIG = {
    BATCH_CONCURRENCY: 5,
} as const;

interface SyncResult {
    newRecordings: number;
    updatedRecordings: number;
    removedRecordings: number;
    errors: string[];
    pendingTranscriptionIds: string[];
}

interface SyncContext {
    userId: string;
    autoTranscribe: boolean;
}

export interface SyncSchedule {
    userId: string;
    lastSync: Date | null;
    syncInterval: number;
    autoSyncEnabled: boolean;
    manualTriggerRequestedAt: Date | null;
}

export interface SyncUsersResult {
    checkedUsers: number;
    syncedUsers: number;
    skippedUsers: number;
    errors: string[];
    results: Array<{
        userId: string;
        result: SyncResult;
    }>;
}

function redactSyncLogText(value: string) {
    return value
        .replace(/https?:\/\/\S+/gi, "[redacted-url]")
        .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
        .replace(
            /([?&](?:X-Amz-[^=]+|token|access_token|signature|credential|security-token)=)[^&\s]+/gi,
            "$1[redacted]",
        );
}

function getSyncErrorField(error: unknown, field: string) {
    if (!error || typeof error !== "object") {
        return null;
    }

    const value = (error as Record<string, unknown>)[field];
    return typeof value === "string" || typeof value === "number"
        ? value
        : null;
}

function summarizeSyncError(error: unknown): Record<string, unknown> {
    if (error instanceof Error) {
        const cause = (error as Error & { cause?: unknown }).cause;

        return {
            name: error.name,
            message: redactSyncLogText(error.message),
            code: getSyncErrorField(error, "code"),
            cause: cause ? summarizeSyncError(cause) : undefined,
        };
    }

    if (typeof error === "string") {
        return { message: redactSyncLogText(error) };
    }

    if (error && typeof error === "object") {
        return {
            name: getSyncErrorField(error, "name"),
            message:
                typeof (error as Record<string, unknown>).message === "string"
                    ? redactSyncLogText(
                          (error as Record<string, unknown>).message as string,
                      )
                    : undefined,
            code: getSyncErrorField(error, "code"),
            status: getSyncErrorField(error, "status"),
            host: getSyncErrorField(error, "host"),
        };
    }

    return { message: String(error) };
}

async function isAudioStorageKeyTaken(
    storageKey: string,
    provider: string,
    sourceRecordingId: string,
) {
    const [existing] = await db
        .select({ id: recordings.id })
        .from(recordings)
        .where(
            and(
                eq(recordings.storagePath, storageKey),
                or(
                    ne(recordings.sourceProvider, provider),
                    ne(recordings.sourceRecordingId, sourceRecordingId),
                ),
            ),
        )
        .limit(1);

    return Boolean(existing);
}

function buildArtifactRows(
    recordingId: string,
    userId: string,
    provider: string,
    artifacts: SourceArtifacts | null | undefined,
) {
    if (!artifacts) {
        return [];
    }

    const rows: Array<typeof sourceArtifacts.$inferInsert> = [];

    if (
        artifacts.transcriptText?.trim() ||
        (artifacts.transcriptSegments?.length ?? 0) > 0
    ) {
        rows.push({
            recordingId,
            userId,
            provider,
            artifactType: "official-transcript",
            textContent: artifacts.transcriptText ?? null,
            payload: artifacts.transcriptSegments
                ? { segments: artifacts.transcriptSegments }
                : null,
            updatedAt: new Date(),
        });
    }

    if (artifacts.summaryMarkdown?.trim()) {
        rows.push({
            recordingId,
            userId,
            provider,
            artifactType: "official-summary",
            markdownContent: artifacts.summaryMarkdown,
            updatedAt: new Date(),
        });
    }

    if (artifacts.detailPayload) {
        rows.push({
            recordingId,
            userId,
            provider,
            artifactType: "official-detail",
            payload: artifacts.detailPayload,
            updatedAt: new Date(),
        });
    }

    return rows;
}

async function upsertSourceArtifacts(
    recordingId: string,
    userId: string,
    provider: string,
    artifacts: SourceArtifacts | null | undefined,
) {
    const rows = buildArtifactRows(recordingId, userId, provider, artifacts);
    if (rows.length === 0) {
        return;
    }

    for (const row of rows) {
        await db
            .insert(sourceArtifacts)
            .values(row)
            .onConflictDoUpdate({
                target: [
                    sourceArtifacts.recordingId,
                    sourceArtifacts.provider,
                    sourceArtifacts.artifactType,
                ],
                set: {
                    title: row.title ?? null,
                    textContent: row.textContent ?? null,
                    markdownContent: row.markdownContent ?? null,
                    payload: row.payload ?? null,
                    updatedAt: new Date(),
                },
            });

        if (row.artifactType !== "official-transcript") {
            continue;
        }

        const [artifact] = await db
            .select()
            .from(sourceArtifacts)
            .where(
                and(
                    eq(sourceArtifacts.recordingId, recordingId),
                    eq(sourceArtifacts.provider, provider),
                    eq(sourceArtifacts.artifactType, "official-transcript"),
                ),
            )
            .limit(1);

        if (artifact) {
            await replaceSourceArtifactSegmentsForArtifact({
                sourceArtifactId: artifact.id,
                recordingId,
                userId,
                provider,
                artifactType: "official-transcript",
                textContent: artifact.textContent,
                markdownContent: artifact.markdownContent,
                payload: artifact.payload,
            });
        }
    }
}

async function resolveDownloadedAudio(
    sourceRecording: SourceRecordingData,
    context: SyncContext,
    existingRecording: typeof recordings.$inferSelect | null,
    storage: Awaited<ReturnType<typeof createUserStorageProvider>>,
) {
    if (!sourceRecording.audioDownload?.url) {
        return {
            storagePath: existingRecording?.storagePath ?? "",
            downloadedAt: existingRecording?.downloadedAt ?? null,
            filesize:
                sourceRecording.filesize ?? existingRecording?.filesize ?? 0,
        };
    }

    const archivePlan = buildSourceAudioArchivePlan(sourceRecording);
    if (!archivePlan) {
        return {
            storagePath: existingRecording?.storagePath ?? "",
            downloadedAt: existingRecording?.downloadedAt ?? null,
            filesize:
                sourceRecording.filesize ?? existingRecording?.filesize ?? 0,
        };
    }

    const storageKey = await resolveUniqueRecordingArchiveKey({
        userId: context.userId,
        provider: sourceRecording.sourceProvider,
        archiveBaseName: archivePlan.archiveBaseName,
        fileExtension: archivePlan.fileExtension,
        sourceRecordingId: sourceRecording.sourceRecordingId,
        isStorageKeyTaken: (candidateKey) =>
            isAudioStorageKeyTaken(
                candidateKey,
                sourceRecording.sourceProvider,
                sourceRecording.sourceRecordingId,
            ),
    });

    const audioBuffer = await downloadSourceAudioBuffer(
        sourceRecording.sourceProvider,
        archivePlan,
    );
    await uploadArchivedRecordingAudio({
        storage,
        storageKey,
        audioBuffer,
        contentType: archivePlan.contentType,
        archiveLabel: `source audio for "${sourceRecording.filename}"`,
    });

    return {
        storagePath: storageKey,
        downloadedAt: new Date(),
        filesize: sourceRecording.filesize ?? audioBuffer.length,
    };
}

function getComparableDateTime(value: Date | string | number | null) {
    if (value instanceof Date) {
        return value.getTime();
    }

    if (value === null) {
        return Number.NaN;
    }

    return new Date(value).getTime();
}

function sourceRecordingTimingMatchesExisting(
    existingRecording: typeof recordings.$inferSelect,
    sourceRecording: SourceRecordingData,
) {
    return (
        existingRecording.duration === sourceRecording.durationMs &&
        getComparableDateTime(existingRecording.startTime) ===
            sourceRecording.startTime.getTime() &&
        getComparableDateTime(existingRecording.endTime) ===
            sourceRecording.endTime.getTime()
    );
}

async function processSourceRecording(
    sourceRecording: SourceRecordingData,
    context: SyncContext,
    storage: Awaited<ReturnType<typeof createUserStorageProvider>>,
): Promise<{
    status: "new" | "updated" | "skipped" | "error";
    recordingId?: string;
    error?: string;
    shouldQueueTranscription?: boolean;
}> {
    try {
        const [existingRecording] = await db
            .select()
            .from(recordings)
            .where(
                and(
                    eq(recordings.userId, context.userId),
                    eq(
                        recordings.sourceProvider,
                        sourceRecording.sourceProvider,
                    ),
                    eq(
                        recordings.sourceRecordingId,
                        sourceRecording.sourceRecordingId,
                    ),
                ),
            )
            .limit(1);

        if (
            existingRecording &&
            sourceRecording.version &&
            existingRecording.sourceVersion === sourceRecording.version &&
            sourceRecordingTimingMatchesExisting(
                existingRecording,
                sourceRecording,
            ) &&
            !sourceRecording.upstreamDeleted
        ) {
            return { status: "skipped" };
        }

        const downloaded = await resolveDownloadedAudio(
            sourceRecording,
            context,
            existingRecording ?? null,
            storage,
        );
        const hasAudio = downloaded.storagePath.trim().length > 0;
        const now = new Date();

        const recordValues = {
            userId: context.userId,
            sourceProvider: sourceRecording.sourceProvider,
            sourceRecordingId: sourceRecording.sourceRecordingId,
            sourceVersion: sourceRecording.version ?? null,
            sourceMetadata: sourceRecording.metadata ?? null,
            providerDeviceId: sourceRecording.providerDeviceId ?? "",
            filename: sourceRecording.filename,
            duration: sourceRecording.durationMs,
            startTime: sourceRecording.startTime,
            endTime: sourceRecording.endTime,
            filesize: downloaded.filesize ?? 0,
            fileMd5: sourceRecording.md5 ?? "",
            storageType: "local",
            storagePath: downloaded.storagePath,
            downloadedAt: downloaded.downloadedAt,
            upstreamTrashed: sourceRecording.upstreamTrashed ?? false,
            upstreamDeleted: sourceRecording.upstreamDeleted ?? false,
            updatedAt: now,
        } satisfies Partial<typeof recordings.$inferInsert>;

        let recordingId: string;
        let status: "new" | "updated";

        if (existingRecording) {
            await db
                .update(recordings)
                .set(recordValues)
                .where(eq(recordings.id, existingRecording.id));
            recordingId = existingRecording.id;
            status = "updated";
        } else {
            const [inserted] = await db
                .insert(recordings)
                .values({
                    ...recordValues,
                    createdAt: now,
                })
                .returning({ id: recordings.id });
            recordingId = inserted.id;
            status = "new";
        }

        await upsertSourceArtifacts(
            recordingId,
            context.userId,
            sourceRecording.sourceProvider,
            sourceRecording.artifacts,
        );

        return {
            status,
            recordingId,
            shouldQueueTranscription:
                context.autoTranscribe &&
                canRecordingUsePrivateTranscribe({
                    sourceProvider: sourceRecording.sourceProvider,
                    hasAudio,
                }),
        };
    } catch (error) {
        console.error("Failed to sync source recording:", {
            provider: sourceRecording.sourceProvider,
            error: summarizeSyncError(error),
        });
        return {
            status: "error",
            error: PUBLIC_DATA_SOURCE_IMPORT_ERROR,
        };
    }
}

async function processSourceBatch(
    recordingsBatch: SourceRecordingData[],
    context: SyncContext,
    storage: Awaited<ReturnType<typeof createUserStorageProvider>>,
) {
    const results = await Promise.allSettled(
        recordingsBatch.map((recording) =>
            processSourceRecording(recording, context, storage),
        ),
    );

    let newCount = 0;
    let updatedCount = 0;
    const errors: string[] = [];
    const pendingTranscriptionIds: string[] = [];

    for (const result of results) {
        if (result.status === "rejected") {
            console.error(
                "Source sync batch item failed:",
                summarizeSyncError(result.reason),
            );
            errors.push(PUBLIC_DATA_SOURCE_IMPORT_ERROR);
            continue;
        }

        if (result.value.status === "new") {
            newCount += 1;
        } else if (result.value.status === "updated") {
            updatedCount += 1;
        } else if (result.value.status === "error" && result.value.error) {
            errors.push(result.value.error);
        }

        if (result.value.recordingId && result.value.shouldQueueTranscription) {
            pendingTranscriptionIds.push(result.value.recordingId);
        }
    }

    return {
        newCount,
        updatedCount,
        errors,
        pendingTranscriptionIds,
    };
}

async function cleanupUpstreamDeletedRecordings(
    userId: string,
    provider: ResolvedSourceConnection["provider"],
    seenIds: Set<string>,
) {
    if (seenIds.size === 0) {
        return 0;
    }

    const seenArray = Array.from(seenIds);
    const now = new Date();
    const flagged = await db
        .update(recordings)
        .set({
            upstreamDeleted: true,
            updatedAt: now,
        })
        .where(
            and(
                eq(recordings.userId, userId),
                eq(recordings.sourceProvider, provider),
                eq(recordings.upstreamTrashed, false),
                eq(recordings.upstreamDeleted, false),
                notInArray(recordings.sourceRecordingId, seenArray),
            ),
        )
        .returning({ id: recordings.id });

    await db
        .update(recordings)
        .set({
            upstreamDeleted: false,
            updatedAt: now,
        })
        .where(
            and(
                eq(recordings.userId, userId),
                eq(recordings.sourceProvider, provider),
                eq(recordings.upstreamDeleted, true),
                inArray(recordings.sourceRecordingId, seenArray),
            ),
        );

    return flagged.length;
}

async function updateConnectionLastSync(
    userId: string,
    provider: ResolvedSourceConnection["provider"],
    syncedAt: Date,
) {
    await db
        .update(sourceConnections)
        .set({
            lastSync: syncedAt,
            updatedAt: syncedAt,
        })
        .where(
            and(
                eq(sourceConnections.userId, userId),
                eq(sourceConnections.provider, provider),
            ),
        );
}

async function syncProviderRecordings(
    connection: ResolvedSourceConnection,
    context: SyncContext,
    storage: Awaited<ReturnType<typeof createUserStorageProvider>>,
): Promise<SyncResult> {
    const client = createSourceProviderClient(connection);
    const sourceRecordings = await client.listRecordings();
    sourceRecordings.sort(
        (left, right) => right.startTime.getTime() - left.startTime.getTime(),
    );

    const result: SyncResult = {
        newRecordings: 0,
        updatedRecordings: 0,
        removedRecordings: 0,
        errors: [],
        pendingTranscriptionIds: [],
    };
    const seenIds = new Set<string>();

    for (let index = 0; index < sourceRecordings.length; index += 1) {
        seenIds.add(sourceRecordings[index].sourceRecordingId);
    }

    for (
        let index = 0;
        index < sourceRecordings.length;
        index += SYNC_CONFIG.BATCH_CONCURRENCY
    ) {
        const batch = sourceRecordings.slice(
            index,
            index + SYNC_CONFIG.BATCH_CONCURRENCY,
        );
        const batchResult = await processSourceBatch(batch, context, storage);
        result.newRecordings += batchResult.newCount;
        result.updatedRecordings += batchResult.updatedCount;
        result.errors.push(...batchResult.errors);
        result.pendingTranscriptionIds.push(
            ...batchResult.pendingTranscriptionIds,
        );
    }

    result.removedRecordings = await cleanupUpstreamDeletedRecordings(
        context.userId,
        connection.provider,
        seenIds,
    );

    await updateConnectionLastSync(
        context.userId,
        connection.provider,
        new Date(),
    );
    return result;
}

export async function syncRecordingsForUser(
    userId: string,
    options?: { awaitTranscriptionQueue?: boolean },
): Promise<SyncResult> {
    const result: SyncResult = {
        newRecordings: 0,
        updatedRecordings: 0,
        removedRecordings: 0,
        errors: [],
        pendingTranscriptionIds: [],
    };

    try {
        const [settings, sourceConnectionList, storage] = await Promise.all([
            db
                .select()
                .from(userSettings)
                .where(eq(userSettings.userId, userId))
                .limit(1)
                .then((rows) => rows[0] ?? null),
            getEnabledSourceConnectionsForUser(userId),
            createUserStorageProvider(userId),
        ]);

        if (sourceConnectionList.length === 0) {
            result.errors.push("No data source connection found");
            return result;
        }
        const workerSyncConnections = sourceConnectionList.filter(
            sourceConnectionSupportsWorkerSync,
        );

        if (workerSyncConnections.length === 0) {
            result.errors.push("No sync-capable data source found");
            return result;
        }

        const context: SyncContext = {
            userId,
            autoTranscribe: settings?.autoTranscribe ?? false,
        };

        for (const connection of workerSyncConnections) {
            try {
                const providerResult = await syncProviderRecordings(
                    connection,
                    context,
                    storage,
                );
                result.newRecordings += providerResult.newRecordings;
                result.updatedRecordings += providerResult.updatedRecordings;
                result.removedRecordings += providerResult.removedRecordings;
                result.errors.push(...providerResult.errors);
                result.pendingTranscriptionIds.push(
                    ...providerResult.pendingTranscriptionIds,
                );
            } catch (error) {
                console.error("Source provider sync failed:", {
                    provider: connection.provider,
                    error: summarizeSyncError(error),
                });
                result.errors.push(PUBLIC_DATA_SOURCE_IMPORT_ERROR);
            }
        }

        const pendingIds = [...new Set(result.pendingTranscriptionIds)];
        result.pendingTranscriptionIds = pendingIds;

        if (context.autoTranscribe && pendingIds.length > 0) {
            if (options?.awaitTranscriptionQueue) {
                try {
                    await enqueueTranscriptionJobs(userId, pendingIds);
                } catch (error) {
                    console.error(
                        "Failed to enqueue background transcriptions:",
                        summarizeSyncError(error),
                    );
                }
            } else {
                enqueueTranscriptionJobs(userId, pendingIds).catch((error) => {
                    console.error(
                        "Failed to enqueue background transcriptions:",
                        summarizeSyncError(error),
                    );
                });
            }
        }

        return result;
    } catch (error) {
        console.error("Data source sync failed:", summarizeSyncError(error));
        result.errors.push(PUBLIC_DATA_SOURCE_IMPORT_ERROR);
        return result;
    }
}

export function isUserDueForSync(schedule: SyncSchedule, now: Date): boolean {
    if (schedule.manualTriggerRequestedAt) {
        return true;
    }

    if (!schedule.autoSyncEnabled) {
        return false;
    }

    if (!schedule.lastSync) {
        return true;
    }

    return now.getTime() - schedule.lastSync.getTime() >= schedule.syncInterval;
}

export async function getUserSyncSchedules(): Promise<SyncSchedule[]> {
    const enabledConnections = await db
        .select({
            userId: sourceConnections.userId,
            provider: sourceConnections.provider,
            authMode: sourceConnections.authMode,
            lastSync: sourceConnections.lastSync,
        })
        .from(sourceConnections)
        .where(eq(sourceConnections.enabled, true));

    const scheduleSeed = new Map<string, { lastSync: Date | null }>();
    for (const connection of enabledConnections) {
        const provider = connection.provider;
        if (!isSourceProvider(provider)) {
            continue;
        }

        if (
            !sourceConnectionSupportsWorkerSync({
                provider,
                authMode: connection.authMode,
            })
        ) {
            continue;
        }

        const current = scheduleSeed.get(connection.userId);
        if (!current) {
            scheduleSeed.set(connection.userId, {
                lastSync: connection.lastSync,
            });
            continue;
        }

        if (!current.lastSync || !connection.lastSync) {
            current.lastSync = null;
            continue;
        }

        if (connection.lastSync.getTime() < current.lastSync.getTime()) {
            current.lastSync = connection.lastSync;
        }
    }

    if (scheduleSeed.size === 0) {
        return [];
    }

    const userIds = Array.from(scheduleSeed.keys());
    const [settings, workerStates] = await Promise.all([
        db
            .select({
                userId: userSettings.userId,
                syncInterval: userSettings.syncInterval,
                autoSyncEnabled: userSettings.autoSyncEnabled,
            })
            .from(userSettings)
            .where(inArray(userSettings.userId, userIds)),
        db
            .select({
                userId: syncWorkerState.userId,
                manualTriggerRequestedAt:
                    syncWorkerState.manualTriggerRequestedAt,
            })
            .from(syncWorkerState)
            .where(inArray(syncWorkerState.userId, userIds)),
    ]);

    const settingsByUser = new Map(
        settings.map((setting) => [setting.userId, setting]),
    );
    const workerStatesByUser = new Map(
        workerStates.map((state) => [state.userId, state]),
    );

    return userIds.map((userId) => ({
        userId,
        lastSync: scheduleSeed.get(userId)?.lastSync ?? null,
        syncInterval: settingsByUser.get(userId)?.syncInterval ?? 300000,
        autoSyncEnabled: settingsByUser.get(userId)?.autoSyncEnabled ?? true,
        manualTriggerRequestedAt:
            workerStatesByUser.get(userId)?.manualTriggerRequestedAt ?? null,
    }));
}

export async function syncDueUsers(
    now = new Date(),
    schedules?: SyncSchedule[],
): Promise<SyncUsersResult> {
    const allSchedules = schedules ?? (await getUserSyncSchedules());
    const dueUsers = allSchedules.filter((schedule) =>
        isUserDueForSync(schedule, now),
    );

    const results: SyncUsersResult = {
        checkedUsers: allSchedules.length,
        syncedUsers: 0,
        skippedUsers: allSchedules.length - dueUsers.length,
        errors: [],
        results: [],
    };

    for (const schedule of dueUsers) {
        const syncResult = await syncRecordingsForUser(schedule.userId);
        results.results.push({
            userId: schedule.userId,
            result: syncResult,
        });

        if (syncResult.errors.length > 0) {
            results.errors.push(
                ...syncResult.errors.map(
                    (error) => `[${schedule.userId}] ${error}`,
                ),
            );
        }

        results.syncedUsers += 1;
    }

    return results;
}
