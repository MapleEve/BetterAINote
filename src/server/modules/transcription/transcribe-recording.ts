import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { userSettings } from "@/db/schema/core";
import { recordings } from "@/db/schema/library";
import { transcriptions } from "@/db/schema/transcripts";
import { decrypt } from "@/lib/encryption";
import { resolveVoScriptSpeakerBoundsFromStoredSettings } from "@/lib/settings/voscript-provider-settings";
import { createUserStorageProvider } from "@/lib/storage/factory";
import {
    createTranscriptionProvider,
    inferProviderType,
} from "@/lib/transcription/providers";
import type {
    TranscriptionOptions,
    TranscriptionProvider,
    TranscriptionResult,
} from "@/lib/transcription/providers/types";
import { mergeSpeakerMaps } from "@/lib/transcription/voice-transcribe-metadata";
import { getDefaultTranscriptionCredential } from "@/server/modules/api-credentials/default-transcription";
import { writeRecordingTitleToSource } from "@/server/modules/data-sources";
import { replaceTranscriptSegmentsForTranscription } from "@/server/modules/search/indexer";
import {
    getConfiguredPrivateTranscriptionBaseUrl,
    getTranscriptionRuntimeSettingsForUser,
    type TranscriptionRuntimeSettings,
} from "@/server/modules/settings";
import { syncRecordingSpeakers } from "@/server/modules/speakers/speaker-review";
import { generateTitleFromTranscription } from "@/server/modules/title-generation/generate-title";
import {
    findVoiceTranscribeCredential,
    getDecryptedVoiceTranscribeApiKey,
    getVoiceTranscribeCredentials,
} from "@/server/modules/voice-transcribe/credentials";
import {
    persistTranscriptionWordsArtifact,
    splitVoiceTranscribePayloadWords,
} from "./word-artifacts";

const PRIVATE_TRANSCRIPTION_MODEL =
    "faster-whisper-large-v3+pyannote-3.1+ecapa";

export { PRIVATE_TRANSCRIPTION_MODEL };

function formatTitleGenerationMetadata(recording: {
    startTime: Date;
    filename: string;
}) {
    const dateFormatter = new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });
    const timeFormatter = new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });

    return {
        recordingDate: dateFormatter.format(recording.startTime),
        recordingTime: timeFormatter
            .format(recording.startTime)
            .replace(":", ""),
        currentFilename: recording.filename,
    };
}

export function normalizeTranscriptionError(error: unknown) {
    if (!(error instanceof Error)) {
        return "Transcription failed";
    }

    if (error.message.includes("`np.NaN` was removed")) {
        return "Private transcription service failed on the remote host because it is running with an incompatible NumPy 2.x build. Redeploy the voice-transcribe service with numpy<2.0.";
    }

    return error.message;
}

type PrivateTranscriptionSettings = Pick<
    TranscriptionRuntimeSettings,
    | "defaultTranscriptionLanguage"
    | "speakerDiarization"
    | "diarizationSpeakers"
    | "privateTranscriptionMinSpeakers"
    | "privateTranscriptionMaxSpeakers"
    | "privateTranscriptionDenoiseModel"
    | "privateTranscriptionSnrThreshold"
    | "privateTranscriptionNoRepeatNgramSize"
>;

export function buildPrivateTranscriptionOptions(params: {
    settings: PrivateTranscriptionSettings | null;
    model: string;
    audioPath?: string;
}): TranscriptionOptions {
    const { settings, model, audioPath } = params;
    const { minSpeakers, maxSpeakers } =
        resolveVoScriptSpeakerBoundsFromStoredSettings(settings);
    const noRepeatNgramSize =
        typeof settings?.privateTranscriptionNoRepeatNgramSize === "number" &&
        Number.isFinite(settings.privateTranscriptionNoRepeatNgramSize) &&
        settings.privateTranscriptionNoRepeatNgramSize >= 3
            ? settings.privateTranscriptionNoRepeatNgramSize
            : undefined;

    return {
        language: settings?.defaultTranscriptionLanguage || undefined,
        model,
        minSpeakers,
        maxSpeakers,
        denoiseModel: settings?.privateTranscriptionDenoiseModel || "none",
        snrThreshold: settings?.privateTranscriptionSnrThreshold ?? undefined,
        noRepeatNgramSize,
        audioPath,
    };
}

export async function persistTranscriptionResult(params: {
    userId: string;
    recordingId: string;
    result: TranscriptionResult;
    providerName: string;
    model: string;
}) {
    const { userId, recordingId, result, providerName, model } = params;

    const [recording, existingTranscription, settings] = await Promise.all([
        db
            .select()
            .from(recordings)
            .where(
                and(
                    eq(recordings.id, recordingId),
                    eq(recordings.userId, userId),
                ),
            )
            .limit(1)
            .then((rows) => rows[0] ?? null),
        db
            .select()
            .from(transcriptions)
            .where(eq(transcriptions.recordingId, recordingId))
            .limit(1)
            .then((rows) => rows[0] ?? null),
        db
            .select()
            .from(userSettings)
            .where(eq(userSettings.userId, userId))
            .limit(1)
            .then((rows) => rows[0] ?? null),
    ]);

    if (!recording) {
        throw new Error("Recording not found");
    }

    const transcriptionText = result.text;
    const detectedLanguage = result.detectedLanguage;
    const { sanitizedPayload, wordsArtifact } =
        splitVoiceTranscribePayloadWords(result.providerPayload);
    const speakerMap = mergeSpeakerMaps(
        existingTranscription?.speakerMap ?? null,
        result.providerPayload,
    );
    const autoGenerateTitle = settings?.autoGenerateTitle ?? true;
    const transcriptionId = existingTranscription?.id ?? nanoid();

    if (existingTranscription) {
        await db
            .update(transcriptions)
            .set({
                text: transcriptionText,
                detectedLanguage,
                transcriptionType: "server",
                provider: providerName,
                model,
                providerJobId: result.providerJobId ?? null,
                speakerMap,
                providerPayload: sanitizedPayload ?? null,
            })
            .where(eq(transcriptions.id, existingTranscription.id));
    } else {
        await db.insert(transcriptions).values({
            id: transcriptionId,
            recordingId,
            userId,
            text: transcriptionText,
            detectedLanguage,
            transcriptionType: "server",
            provider: providerName,
            model,
            providerJobId: result.providerJobId ?? null,
            speakerMap,
            providerPayload: sanitizedPayload ?? null,
        });
    }

    await replaceTranscriptSegmentsForTranscription({
        userId,
        recordingId,
        transcriptionId,
        transcriptOrigin: "local",
        text: transcriptionText,
        providerPayload: sanitizedPayload ?? null,
    });

    await persistTranscriptionWordsArtifact({
        transcriptionId: existingTranscription?.id ?? transcriptionId,
        recordingId,
        userId,
        providerJobId: result.providerJobId ?? null,
        payload: wordsArtifact,
    });

    await syncRecordingSpeakers({
        userId,
        recordingId,
        transcriptText: transcriptionText,
        speakerSegments: result.speakerSegments,
    });

    if (autoGenerateTitle && transcriptionText.trim()) {
        try {
            const generatedTitle = await generateTitleFromTranscription(
                userId,
                transcriptionText,
                formatTitleGenerationMetadata(recording),
            );

            if (generatedTitle) {
                await db
                    .update(recordings)
                    .set({
                        filename: generatedTitle,
                        updatedAt: new Date(),
                    })
                    .where(eq(recordings.id, recordingId));

                await writeRecordingTitleToSource({
                    userId,
                    recording,
                    title: generatedTitle,
                }).catch((error) => {
                    console.error(
                        "Failed to sync generated title to source:",
                        error,
                    );
                });
            }
        } catch (error) {
            console.error("Failed to generate title:", error);
        }
    }
}

export async function transcribeRecording(
    userId: string,
    recordingId: string,
    options?: { force?: boolean },
): Promise<{ success: boolean; error?: string; compressionWarning?: string }> {
    try {
        const [recording] = await db
            .select()
            .from(recordings)
            .where(
                and(
                    eq(recordings.id, recordingId),
                    eq(recordings.userId, userId),
                ),
            )
            .limit(1);

        if (!recording) {
            return { success: false, error: "Recording not found" };
        }

        const [existingTranscription] = await db
            .select()
            .from(transcriptions)
            .where(eq(transcriptions.recordingId, recordingId))
            .limit(1);

        if (existingTranscription?.text && !options?.force) {
            return { success: true };
        }

        const settings = await getTranscriptionRuntimeSettingsForUser(userId);
        const privateTranscriptionBaseUrl =
            getConfiguredPrivateTranscriptionBaseUrl(settings);
        const defaultLanguage =
            settings?.defaultTranscriptionLanguage || undefined;
        let effectiveProviderName = "voice-transcribe";
        let effectiveModel = PRIVATE_TRANSCRIPTION_MODEL;
        let provider: TranscriptionProvider;

        if (privateTranscriptionBaseUrl) {
            const voiceTranscribeCredentials =
                await getVoiceTranscribeCredentials(userId);
            const matchedVoiceTranscribeCredential =
                findVoiceTranscribeCredential(
                    voiceTranscribeCredentials,
                    privateTranscriptionBaseUrl,
                );
            const privateApiKey =
                getDecryptedVoiceTranscribeApiKey(
                    matchedVoiceTranscribeCredential,
                ) ?? "";
            provider = createTranscriptionProvider(
                "voice-transcribe",
                privateApiKey,
                privateTranscriptionBaseUrl,
            );
        } else {
            const credentials = await getDefaultTranscriptionCredential(userId);

            if (!credentials) {
                return {
                    success: false,
                    error: "No transcription API configured",
                };
            }

            const apiKey = decrypt(credentials.apiKey);
            effectiveProviderName = credentials.provider;
            effectiveModel = credentials.defaultModel || "whisper-1";
            const providerType = inferProviderType(
                credentials.provider,
                credentials.baseUrl,
            );
            provider = createTranscriptionProvider(
                providerType,
                apiKey,
                credentials.baseUrl || undefined,
            );
        }

        const storage = await createUserStorageProvider(userId);
        const audioBuffer = await storage.downloadFile(recording.storagePath);
        const transcriptionOptions = privateTranscriptionBaseUrl
            ? buildPrivateTranscriptionOptions({
                  settings,
                  model: effectiveModel,
              })
            : ({
                  language: defaultLanguage,
                  model: effectiveModel,
              } satisfies TranscriptionOptions);

        const result: TranscriptionResult = await provider.transcribe(
            audioBuffer,
            recording.filename,
            transcriptionOptions,
        );

        await persistTranscriptionResult({
            userId,
            recordingId,
            result,
            providerName: effectiveProviderName,
            model: effectiveModel,
        });

        return { success: true, compressionWarning: result.compressionWarning };
    } catch (error) {
        console.error("Error transcribing recording:", error);
        return {
            success: false,
            error: normalizeTranscriptionError(error),
        };
    } finally {
        // No provider-specific temp files are staged for shared transcription.
    }
}
