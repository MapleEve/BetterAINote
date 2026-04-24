import { mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { type Client, createClient } from "@libsql/client";
import { env } from "@/lib/env";
import type {
    VoiceTranscribePayload,
    VoiceTranscribeWord,
} from "./providers/types";

interface WordSegmentArtifact {
    id: number;
    speakerLabel: string;
    start: number | null;
    end: number | null;
    text: string;
    words: VoiceTranscribeWord[];
}

export interface TranscriptionWordsArtifact {
    payloadId: string;
    language: string | null;
    segments: WordSegmentArtifact[];
}

let wordsClient: Client | null | undefined;
let wordsDbReady: Promise<void> | null = null;

export function deriveTranscriptWordsDatabasePath(
    databasePath?: string | null,
    overridePath?: string | null,
) {
    const sourcePath = overridePath?.trim() || databasePath?.trim() || null;
    if (!sourcePath) {
        return null;
    }

    if (/^(https?:|libsql:)/.test(sourcePath)) {
        return null;
    }

    if (sourcePath.startsWith("file:")) {
        const url = new URL(sourcePath);
        const resolvedPath = url.pathname;
        const parsed = path.parse(resolvedPath);
        return path.format({
            dir: parsed.dir,
            name: `${parsed.name}-words`,
            ext: parsed.ext || ".db",
        });
    }

    const parsed = path.parse(sourcePath);
    return path.resolve(
        parsed.dir || ".",
        `${parsed.name || "betterainote"}-words${parsed.ext || ".db"}`,
    );
}

function resolveDatabaseUrl(databasePath: string) {
    if (/^(file:|libsql:|https?:)/.test(databasePath)) {
        return databasePath;
    }

    return pathToFileURL(path.resolve(databasePath)).href;
}

export function splitVoiceTranscribePayloadWords(
    payload: VoiceTranscribePayload | null | undefined,
): {
    sanitizedPayload: VoiceTranscribePayload | null;
    wordsArtifact: TranscriptionWordsArtifact | null;
} {
    if (!payload) {
        return {
            sanitizedPayload: null,
            wordsArtifact: null,
        };
    }

    const wordSegments: WordSegmentArtifact[] = [];
    const sanitizedPayload: VoiceTranscribePayload = {
        ...payload,
        segments: payload.segments.map((segment) => {
            const words = segment.words?.filter(Boolean) ?? [];
            if (words.length > 0) {
                wordSegments.push({
                    id: segment.id,
                    speakerLabel: segment.speakerLabel,
                    start: segment.start,
                    end: segment.end,
                    text: segment.text,
                    words,
                });
            }

            return {
                ...segment,
                words: null,
            };
        }),
    };

    return {
        sanitizedPayload,
        wordsArtifact:
            wordSegments.length > 0
                ? {
                      payloadId: payload.id,
                      language: payload.language,
                      segments: wordSegments,
                  }
                : null,
    };
}

function getWordsClient() {
    if (wordsClient !== undefined) {
        return wordsClient;
    }

    const wordsPath = deriveTranscriptWordsDatabasePath(
        env.DATABASE_PATH,
        env.TRANSCRIPT_WORDS_DATABASE_PATH,
    );
    if (!wordsPath) {
        wordsClient = null;
        return wordsClient;
    }

    mkdirSync(path.dirname(path.resolve(wordsPath)), { recursive: true });
    wordsClient = createClient({
        url: resolveDatabaseUrl(wordsPath),
    });
    return wordsClient;
}

async function ensureWordsDatabase() {
    const client = getWordsClient();
    if (!client) {
        return;
    }

    if (!wordsDbReady) {
        wordsDbReady = (async () => {
            await client.batch(
                [
                    {
                        sql: `CREATE TABLE IF NOT EXISTS transcription_words_artifacts (
                            transcription_id TEXT PRIMARY KEY NOT NULL,
                            recording_id TEXT NOT NULL,
                            user_id TEXT NOT NULL,
                            provider_job_id TEXT,
                            payload TEXT NOT NULL,
                            created_at INTEGER NOT NULL,
                            updated_at INTEGER NOT NULL
                        )`,
                        args: [],
                    },
                    {
                        sql: "CREATE INDEX IF NOT EXISTS transcription_words_artifacts_recording_id_idx ON transcription_words_artifacts (recording_id)",
                        args: [],
                    },
                    {
                        sql: "CREATE INDEX IF NOT EXISTS transcription_words_artifacts_user_id_idx ON transcription_words_artifacts (user_id)",
                        args: [],
                    },
                ],
                "write",
            );
        })();
    }

    await wordsDbReady;
}

export async function persistTranscriptionWordsArtifact(params: {
    transcriptionId: string;
    recordingId: string;
    userId: string;
    providerJobId?: string | null;
    payload: TranscriptionWordsArtifact | null;
}) {
    const client = getWordsClient();
    if (!client) {
        return;
    }

    try {
        await ensureWordsDatabase();

        if (!params.payload) {
            await client.execute({
                sql: "DELETE FROM transcription_words_artifacts WHERE transcription_id = ?",
                args: [params.transcriptionId],
            });
            return;
        }

        const now = Date.now();
        await client.execute({
            sql: `INSERT INTO transcription_words_artifacts (
                    transcription_id,
                    recording_id,
                    user_id,
                    provider_job_id,
                    payload,
                    created_at,
                    updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(transcription_id) DO UPDATE SET
                    recording_id = excluded.recording_id,
                    user_id = excluded.user_id,
                    provider_job_id = excluded.provider_job_id,
                    payload = excluded.payload,
                    updated_at = excluded.updated_at`,
            args: [
                params.transcriptionId,
                params.recordingId,
                params.userId,
                params.providerJobId ?? null,
                JSON.stringify(params.payload),
                now,
                now,
            ],
        });
    } catch (error) {
        console.warn(
            "[transcription] Failed to persist transcript words artifact:",
            error,
        );
    }
}
