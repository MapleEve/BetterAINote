import { execFile } from "node:child_process";
import { createCipheriv, randomBytes } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { expect, type Page, test } from "@playwright/test";
import { buildSearchTerms } from "../src/lib/search/tokenization";
import { ensureSignedIn } from "./helpers/auth";
import {
    REAL_VOSCRIPT_E2E_GUARD,
    REAL_VOSCRIPT_TARGET_RECORDING_ID,
    seedRealVoScriptCurrentFixture,
    shouldRunRealVoScriptE2E,
} from "./helpers/real-voscript-current";

const execFileAsync = promisify(execFile);
const E2E_DATA_DIR = path.resolve(process.cwd(), "tmp/e2e/data");
const E2E_STORAGE_DIR = path.resolve(process.cwd(), "tmp/e2e/storage");
const E2E_WORDS_DATABASE_PATH = path.join(
    E2E_DATA_DIR,
    "betterainote-e2e-words.db",
);
const E2E_AUTH_SECRET =
    "playwright-better-auth-secret-0123456789abcdef-playwright";
const E2E_ENCRYPTION_KEY =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const REAL_VOSCRIPT_TIMEOUT_MS = 20 * 60 * 1000;
const LOCAL_VOSCRIPT_RECORDING_ID = "e2e-local-voscript-queue-recording";
const LOCAL_VOSCRIPT_SOURCE_ID = "e2e-local-voscript-queue-source";
const LOCAL_VOSCRIPT_CREDENTIAL_ID = "e2e-local-voscript-queue-credential";
const LOCAL_VOSCRIPT_SETTINGS_ID = "e2e-local-voscript-queue-settings";
const LOCAL_VOSCRIPT_AUDIO_KEY = "recordings/e2e-local-voscript-queue.mp3";
const LOCAL_VOSCRIPT_FAKE_API_KEY = "e2e-local-voscript-key";
const LOCAL_VOSCRIPT_SEARCH_PHRASE = "hermetic voscript queue calibration";
const LOCAL_VOSCRIPT_OLD_TRANSCRIPTION_ID =
    "e2e-local-voscript-old-transcription";
const LOCAL_VOSCRIPT_OLD_TRANSCRIPT_MARKER =
    "stale local transcript before retranscribe";
const LOCAL_VOSCRIPT_OLD_PROVIDER = "old-local-transcription-provider";
const LOCAL_VOSCRIPT_OLD_MODEL = "old-local-transcription-model";

type WorkerSummary = {
    processed: number;
    succeeded: number;
    failed: number;
};

type TranscriptionState = {
    transcript: {
        provider: string;
        model: string;
        text: string;
        segments: Array<{
            start?: number | null;
            end?: number | null;
            startMs?: number | null;
            endMs?: number | null;
            speakerLabel?: string | null;
            speakerName?: string | null;
            displaySpeaker?: string | null;
        }> | null;
    } | null;
    job: {
        status: string;
        remoteStatus: string | null;
        lastError: string | null;
    } | null;
};

type SearchResponse = {
    results: Array<{
        entityType: string;
        recordingId: string | null;
    }>;
};

test.use({ screenshot: "off", trace: "off" });
test.setTimeout(REAL_VOSCRIPT_TIMEOUT_MS + 120_000);

function resolveDatabasePath() {
    return process.env.DATABASE_PATH
        ? path.resolve(process.cwd(), process.env.DATABASE_PATH)
        : path.join(E2E_DATA_DIR, "betterainote-e2e.db");
}

function deriveSiblingDatabasePath(databasePath: string, suffix: string) {
    const parsed = path.parse(databasePath);

    return path.resolve(
        parsed.dir || ".",
        `${parsed.name || "betterainote"}-${suffix}${parsed.ext || ".db"}`,
    );
}

function assertE2EPath(filePath: string) {
    const e2eRoot = path.resolve(
        process.env.PLAYWRIGHT_E2E_ROOT ??
            path.join(process.cwd(), "tmp/e2e"),
    );
    const resolvedPath = path.resolve(filePath);

    if (
        resolvedPath !== e2eRoot &&
        !resolvedPath.startsWith(`${e2eRoot}${path.sep}`)
    ) {
        throw new Error("Real VoScript E2E target path is outside E2E root");
    }
}

function databaseUrl(filePath: string) {
    assertE2EPath(filePath);
    return pathToFileURL(filePath).href;
}

function encryptWithE2EKey(plaintext: string) {
    const iv = randomBytes(16);
    const cipher = createCipheriv(
        "aes-256-gcm",
        Buffer.from(process.env.ENCRYPTION_KEY || E2E_ENCRYPTION_KEY, "hex"),
        iv,
    );
    const encrypted = Buffer.concat([
        cipher.update(plaintext, "utf8"),
        cipher.final(),
    ]);

    return [
        iv.toString("hex"),
        cipher.getAuthTag().toString("hex"),
        encrypted.toString("hex"),
    ].join(":");
}

function writeJson(response: ServerResponse, body: unknown, status = 200) {
    response.writeHead(status, { "content-type": "application/json" });
    response.end(JSON.stringify(body));
}

async function readRequestBuffer(request: IncomingMessage) {
    const chunks: Buffer[] = [];
    for await (const chunk of request) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
}

async function startLocalVoScriptStubServer() {
    const state = {
        submitCount: 0,
        pollCount: 0,
        authorizationHeaders: [] as string[],
        apiKeyHeaders: [] as string[],
        contentTypes: [] as string[],
        uploadBytes: 0,
    };

    const server = createServer(async (request, response) => {
        const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
        state.authorizationHeaders.push(request.headers.authorization ?? "");
        state.apiKeyHeaders.push(String(request.headers["x-api-key"] ?? ""));
        state.contentTypes.push(String(request.headers["content-type"] ?? ""));

        if (
            request.method === "POST" &&
            requestUrl.pathname === "/api/transcribe"
        ) {
            const upload = await readRequestBuffer(request);
            state.submitCount += 1;
            state.uploadBytes += upload.byteLength;
            writeJson(response, {
                id: "e2e-local-voscript-job",
                status: "queued",
                filename: "e2e-local-voscript-queue.mp3",
                created_at: new Date().toISOString(),
            });
            return;
        }

        if (
            request.method === "GET" &&
            requestUrl.pathname === "/api/jobs/e2e-local-voscript-job"
        ) {
            state.pollCount += 1;
            writeJson(response, {
                id: "e2e-local-voscript-job",
                status: "completed",
                filename: "e2e-local-voscript-queue.mp3",
                created_at: new Date().toISOString(),
                result: {
                    id: "e2e-local-voscript-result",
                    language: "zh",
                    created_at: new Date().toISOString(),
                    segments: [
                        {
                            id: 1,
                            start: 0,
                            end: 1.8,
                            text: `${LOCAL_VOSCRIPT_SEARCH_PHRASE} alpha`,
                            speaker_label: "SPEAKER_A",
                            speaker_id: "voiceprint-alpha",
                            speaker_name: "Alpha Reviewer",
                            similarity: 0.98,
                            has_overlap: false,
                            words: [
                                {
                                    word: "hermetic",
                                    start: 0.1,
                                    end: 0.5,
                                    score: 0.99,
                                },
                                {
                                    word: "voscript",
                                    start: 0.5,
                                    end: 0.9,
                                    score: 0.98,
                                },
                            ],
                        },
                        {
                            id: 2,
                            start: 2.2,
                            end: 4.1,
                            text: "beta speaker keeps timestamps searchable",
                            speaker_label: "SPEAKER_B",
                            speaker_id: null,
                            speaker_name: null,
                            similarity: null,
                            has_overlap: false,
                            words: [
                                {
                                    word: "timestamps",
                                    start: 2.5,
                                    end: 3.1,
                                    score: 0.97,
                                },
                            ],
                        },
                    ],
                    speaker_map: {
                        SPEAKER_A: {
                            matched_id: "voiceprint-alpha",
                            matched_name: "Alpha Reviewer",
                            similarity: 0.98,
                            embedding_key: "e2e-local-embedding-alpha",
                        },
                    },
                    unique_speakers: ["SPEAKER_A", "SPEAKER_B"],
                    params: {
                        language: "zh",
                        denoise_model: "none",
                        snr_threshold: null,
                        voiceprint_threshold: null,
                        min_speakers: 2,
                        max_speakers: 2,
                        no_repeat_ngram_size: 3,
                    },
                },
            });
            return;
        }

        writeJson(response, { detail: "not found" }, 404);
    });

    let baseUrl = "";
    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
            const address = server.address();
            if (!address || typeof address === "string") {
                reject(new Error("Unable to start local VoScript stub"));
                return;
            }
            baseUrl = `http://127.0.0.1:${address.port}`;
            resolve();
        });
    });

    return {
        baseUrl,
        state,
        close: () =>
            new Promise<void>((resolve, reject) => {
                server.close((error) => (error ? reject(error) : resolve()));
            }),
    };
}

function buildWorkerEnv() {
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3201";

    return {
        ...process.env,
        APP_URL: process.env.APP_URL || baseUrl,
        BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || E2E_AUTH_SECRET,
        DATABASE_PATH: process.env.DATABASE_PATH || resolveDatabasePath(),
        ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || E2E_ENCRYPTION_KEY,
        LOCAL_STORAGE_PATH:
            process.env.LOCAL_STORAGE_PATH || E2E_STORAGE_DIR,
        TRANSCRIPT_WORDS_DATABASE_PATH:
            process.env.TRANSCRIPT_WORDS_DATABASE_PATH ||
            E2E_WORDS_DATABASE_PATH,
    };
}

async function getPlaywrightUserId() {
    const client = createClient({ url: databaseUrl(resolveDatabasePath()) });
    try {
        const result = await client.execute({
            sql: "SELECT id FROM users WHERE email = ? LIMIT 1",
            args: ["playwright-admin@example.com"],
        });
        const id = result.rows[0]?.id;
        if (typeof id !== "string") {
            throw new Error("Playwright user not found");
        }

        return id;
    } finally {
        await client.close();
    }
}

async function executeIfTableExists(
    client: ReturnType<typeof createClient>,
    sql: string,
    args: Array<string | number | null> = [],
) {
    try {
        await client.execute({ sql, args });
    } catch (error) {
        if (
            error instanceof Error &&
            error.message.includes("no such table")
        ) {
            return;
        }
        throw error;
    }
}

async function countIfTableExists(
    client: ReturnType<typeof createClient>,
    sql: string,
    args: Array<string | number | null> = [],
) {
    try {
        const result = await client.execute({ sql, args });
        return Number(result.rows[0]?.count ?? 0);
    } catch (error) {
        if (
            error instanceof Error &&
            error.message.includes("no such table")
        ) {
            return 0;
        }
        throw error;
    }
}

async function listLocalVoScriptTranscriptionIds(
    client: ReturnType<typeof createClient>,
) {
    try {
        const transcriptionRows = await client.execute({
            sql: "SELECT id FROM transcriptions WHERE recording_id = ?",
            args: [LOCAL_VOSCRIPT_RECORDING_ID],
        });

        return transcriptionRows.rows
            .map((row) => row.id)
            .filter((id): id is string => typeof id === "string");
    } catch (error) {
        if (
            error instanceof Error &&
            error.message.includes("no such table")
        ) {
            return [];
        }
        throw error;
    }
}

function uniqueLocalVoScriptTranscriptionIds(transcriptionIds: string[]) {
    return [
        ...new Set([
            LOCAL_VOSCRIPT_OLD_TRANSCRIPTION_ID,
            ...transcriptionIds,
        ]),
    ];
}

async function readLocalVoScriptFixtureCounts(transcriptionIds: string[] = []) {
    const core = createClient({ url: databaseUrl(resolveDatabasePath()) });
    const library = createClient({
        url: databaseUrl(deriveSiblingDatabasePath(resolveDatabasePath(), "library")),
    });
    const transcripts = createClient({
        url: databaseUrl(
            deriveSiblingDatabasePath(resolveDatabasePath(), "transcripts"),
        ),
    });
    const voiceprints = createClient({
        url: databaseUrl(
            deriveSiblingDatabasePath(resolveDatabasePath(), "voiceprints"),
        ),
    });
    const search = createClient({
        url: databaseUrl(deriveSiblingDatabasePath(resolveDatabasePath(), "search")),
    });
    const words = createClient({ url: databaseUrl(E2E_WORDS_DATABASE_PATH) });
    const allTranscriptionIds =
        uniqueLocalVoScriptTranscriptionIds(transcriptionIds);
    const transcriptionPlaceholders = allTranscriptionIds
        .map(() => "?")
        .join(", ");
    const fixtureEntityArgs = [
        LOCAL_VOSCRIPT_RECORDING_ID,
        ...allTranscriptionIds,
    ];

    try {
        return {
            recordings: await countIfTableExists(
                library,
                "SELECT count(*) AS count FROM recordings WHERE id = ?",
                [LOCAL_VOSCRIPT_RECORDING_ID],
            ),
            transcriptionJobs: await countIfTableExists(
                library,
                "SELECT count(*) AS count FROM transcription_jobs WHERE recording_id = ?",
                [LOCAL_VOSCRIPT_RECORDING_ID],
            ),
            transcriptions: await countIfTableExists(
                transcripts,
                `SELECT count(*) AS count FROM transcriptions WHERE recording_id = ? OR id IN (${transcriptionPlaceholders})`,
                fixtureEntityArgs,
            ),
            transcriptSegments: await countIfTableExists(
                transcripts,
                `SELECT count(*) AS count FROM transcript_segments WHERE recording_id = ? OR transcription_id IN (${transcriptionPlaceholders})`,
                fixtureEntityArgs,
            ),
            recordingSpeakers: await countIfTableExists(
                voiceprints,
                "SELECT count(*) AS count FROM recording_speakers WHERE recording_id = ?",
                [LOCAL_VOSCRIPT_RECORDING_ID],
            ),
            searchDocuments: await countIfTableExists(
                search,
                `SELECT count(*) AS count FROM search_documents WHERE recording_id = ? OR entity_id IN (${transcriptionPlaceholders})`,
                fixtureEntityArgs,
            ),
            searchChunks: await countIfTableExists(
                search,
                `SELECT count(*) AS count FROM search_chunks WHERE recording_id = ? OR entity_id IN (${transcriptionPlaceholders})`,
                fixtureEntityArgs,
            ),
            searchContentFts: await countIfTableExists(
                search,
                `SELECT count(*) AS count FROM search_content_fts WHERE recording_id = ? OR entity_id IN (${transcriptionPlaceholders})`,
                fixtureEntityArgs,
            ),
            searchIndexJobs: await countIfTableExists(
                search,
                `SELECT count(*) AS count FROM search_index_jobs WHERE entity_id = ? OR entity_id IN (${transcriptionPlaceholders})`,
                fixtureEntityArgs,
            ),
            wordsArtifacts: await countIfTableExists(
                words,
                `SELECT count(*) AS count FROM transcription_words_artifacts WHERE recording_id = ? OR transcription_id IN (${transcriptionPlaceholders})`,
                fixtureEntityArgs,
            ),
            localCredential: await countIfTableExists(
                core,
                "SELECT count(*) AS count FROM api_credentials WHERE id = ?",
                [LOCAL_VOSCRIPT_CREDENTIAL_ID],
            ),
        };
    } finally {
        await core.close();
        await library.close();
        await transcripts.close();
        await voiceprints.close();
        await search.close();
        await words.close();
    }
}

async function expectLocalVoScriptFixtureClean(transcriptionIds: string[] = []) {
    await expect(
        readLocalVoScriptFixtureCounts(transcriptionIds),
    ).resolves.toEqual({
        recordings: 0,
        transcriptionJobs: 0,
        transcriptions: 0,
        transcriptSegments: 0,
        recordingSpeakers: 0,
        searchDocuments: 0,
        searchChunks: 0,
        searchContentFts: 0,
        searchIndexJobs: 0,
        wordsArtifacts: 0,
        localCredential: 0,
    });
}

async function cleanupLocalVoScriptQueueSeed(userId?: string) {
    const core = createClient({ url: databaseUrl(resolveDatabasePath()) });
    const library = createClient({
        url: databaseUrl(deriveSiblingDatabasePath(resolveDatabasePath(), "library")),
    });
    const transcripts = createClient({
        url: databaseUrl(
            deriveSiblingDatabasePath(resolveDatabasePath(), "transcripts"),
        ),
    });
    const voiceprints = createClient({
        url: databaseUrl(
            deriveSiblingDatabasePath(resolveDatabasePath(), "voiceprints"),
        ),
    });
    const search = createClient({
        url: databaseUrl(deriveSiblingDatabasePath(resolveDatabasePath(), "search")),
    });
    const words = createClient({ url: databaseUrl(E2E_WORDS_DATABASE_PATH) });
    let transcriptionIds: string[] = [];

    try {
        transcriptionIds = await listLocalVoScriptTranscriptionIds(transcripts);
        const allTranscriptionIds =
            uniqueLocalVoScriptTranscriptionIds(transcriptionIds);
        const transcriptionPlaceholders = allTranscriptionIds
            .map(() => "?")
            .join(", ");
        const fixtureEntityArgs = [
            LOCAL_VOSCRIPT_RECORDING_ID,
            ...allTranscriptionIds,
        ];

        for (const transcriptionId of transcriptionIds) {
            await executeIfTableExists(
                words,
                "DELETE FROM transcription_words_artifacts WHERE transcription_id = ?",
                [transcriptionId],
            );
            await executeIfTableExists(
                search,
                "DELETE FROM search_index_jobs WHERE entity_id = ?",
                [transcriptionId],
            );
        }

        await executeIfTableExists(
            search,
            `DELETE FROM search_content_fts WHERE recording_id = ? OR entity_id IN (${transcriptionPlaceholders})`,
            fixtureEntityArgs,
        );
        await executeIfTableExists(
            search,
            `DELETE FROM search_chunks WHERE recording_id = ? OR entity_id IN (${transcriptionPlaceholders})`,
            fixtureEntityArgs,
        );
        await executeIfTableExists(
            search,
            `DELETE FROM search_documents WHERE recording_id = ? OR entity_id IN (${transcriptionPlaceholders})`,
            fixtureEntityArgs,
        );
        await executeIfTableExists(
            search,
            `DELETE FROM search_index_jobs WHERE entity_id = ? OR entity_id IN (${transcriptionPlaceholders})`,
            fixtureEntityArgs,
        );
        await executeIfTableExists(
            voiceprints,
            "DELETE FROM recording_speakers WHERE recording_id = ?",
            [LOCAL_VOSCRIPT_RECORDING_ID],
        );
        await executeIfTableExists(
            transcripts,
            "DELETE FROM transcript_segments WHERE recording_id = ?",
            [LOCAL_VOSCRIPT_RECORDING_ID],
        );
        await executeIfTableExists(
            transcripts,
            "DELETE FROM transcriptions WHERE recording_id = ?",
            [LOCAL_VOSCRIPT_RECORDING_ID],
        );
        await executeIfTableExists(
            library,
            "DELETE FROM transcription_jobs WHERE recording_id = ?",
            [LOCAL_VOSCRIPT_RECORDING_ID],
        );
        await executeIfTableExists(
            library,
            "DELETE FROM recordings WHERE id = ?",
            [LOCAL_VOSCRIPT_RECORDING_ID],
        );
        await core.execute({
            sql: "DELETE FROM api_credentials WHERE id = ?",
            args: [LOCAL_VOSCRIPT_CREDENTIAL_ID],
        });

        if (userId) {
            await core.execute({
                sql: `
                    UPDATE user_settings
                    SET private_transcription_base_url = NULL,
                        private_transcription_min_speakers = 0,
                        private_transcription_max_speakers = 0,
                        private_transcription_denoise_model = 'none',
                        private_transcription_no_repeat_ngram_size = 0,
                        private_transcription_max_inflight_jobs = 1,
                        auto_generate_title = 1,
                        updated_at = ?
                    WHERE user_id = ?
                `,
                args: [Date.now(), userId],
            });
        }
    } finally {
        await core.close();
        await library.close();
        await transcripts.close();
        await voiceprints.close();
        await search.close();
        await words.close();
    }

    const audioPath = path.join(E2E_STORAGE_DIR, LOCAL_VOSCRIPT_AUDIO_KEY);
    assertE2EPath(audioPath);
    await rm(audioPath, { force: true });

    return transcriptionIds;
}

async function seedLocalVoScriptQueueFixture(userId: string, baseUrl: string) {
    await cleanupLocalVoScriptQueueSeed(userId);

    const now = Date.now();
    const start = now - 90_000;
    const audioPath = path.join(E2E_STORAGE_DIR, LOCAL_VOSCRIPT_AUDIO_KEY);
    assertE2EPath(audioPath);
    await mkdir(path.dirname(audioPath), { recursive: true });
    await writeFile(audioPath, Buffer.from("ID3e2e-local-voscript-audio"));

    const core = createClient({ url: databaseUrl(resolveDatabasePath()) });
    const library = createClient({
        url: databaseUrl(deriveSiblingDatabasePath(resolveDatabasePath(), "library")),
    });
    const transcripts = createClient({
        url: databaseUrl(
            deriveSiblingDatabasePath(resolveDatabasePath(), "transcripts"),
        ),
    });

    try {
        await core.execute({
            sql: `
                INSERT INTO user_settings (
                    id, user_id, private_transcription_base_url,
                    default_transcription_language, speaker_diarization,
                    private_transcription_min_speakers,
                    private_transcription_max_speakers,
                    private_transcription_denoise_model,
                    private_transcription_no_repeat_ngram_size,
                    private_transcription_max_inflight_jobs,
                    auto_generate_title, created_at, updated_at
                ) VALUES (?, ?, ?, 'zh', 1, 2, 2, 'none', 3, 1, 0, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    private_transcription_base_url = excluded.private_transcription_base_url,
                    default_transcription_language = excluded.default_transcription_language,
                    speaker_diarization = excluded.speaker_diarization,
                    private_transcription_min_speakers = excluded.private_transcription_min_speakers,
                    private_transcription_max_speakers = excluded.private_transcription_max_speakers,
                    private_transcription_denoise_model = excluded.private_transcription_denoise_model,
                    private_transcription_no_repeat_ngram_size = excluded.private_transcription_no_repeat_ngram_size,
                    private_transcription_max_inflight_jobs = excluded.private_transcription_max_inflight_jobs,
                    auto_generate_title = excluded.auto_generate_title,
                    updated_at = excluded.updated_at
            `,
            args: [LOCAL_VOSCRIPT_SETTINGS_ID, userId, baseUrl, now, now],
        });
        await core.execute({
            sql: `
                INSERT OR REPLACE INTO api_credentials (
                    id, user_id, provider, api_key, base_url, default_model,
                    is_default_transcription, created_at, updated_at
                ) VALUES (?, ?, 'private-transcription', ?, ?, NULL, 0, ?, ?)
            `,
            args: [
                LOCAL_VOSCRIPT_CREDENTIAL_ID,
                userId,
                encryptWithE2EKey(LOCAL_VOSCRIPT_FAKE_API_KEY),
                baseUrl,
                now,
                now,
            ],
        });
        await library.execute({
            sql: `
                INSERT OR REPLACE INTO recordings (
                    id, user_id, source_provider, source_recording_id,
                    source_version, source_metadata, provider_device_id,
                    filename, duration, start_time, end_time, filesize,
                    file_md5, storage_type, storage_path, downloaded_at,
                    upstream_trashed, upstream_deleted, created_at, updated_at
                ) VALUES (?, ?, 'ticnote', ?, '1', '{}', ?, ?, ?, ?, ?, ?, ?, 'local', ?, ?, 0, 0, ?, ?)
            `,
            args: [
                LOCAL_VOSCRIPT_RECORDING_ID,
                userId,
                LOCAL_VOSCRIPT_SOURCE_ID,
                "e2e-local-voscript-device",
                "E2E local VoScript queue",
                90_000,
                start,
                start + 90_000,
                26,
                "e2e-local-voscript-md5",
                LOCAL_VOSCRIPT_AUDIO_KEY,
                now,
                now,
                now,
            ],
        });
        await transcripts.execute({
            sql: `
                INSERT OR REPLACE INTO transcriptions (
                    id, recording_id, user_id, text, detected_language,
                    transcription_type, provider, model, provider_job_id,
                    speaker_map, provider_payload, created_at
                ) VALUES (?, ?, ?, ?, 'zh', 'server', ?, ?, ?, '{}', '{}', ?)
            `,
            args: [
                LOCAL_VOSCRIPT_OLD_TRANSCRIPTION_ID,
                LOCAL_VOSCRIPT_RECORDING_ID,
                userId,
                LOCAL_VOSCRIPT_OLD_TRANSCRIPT_MARKER,
                LOCAL_VOSCRIPT_OLD_PROVIDER,
                LOCAL_VOSCRIPT_OLD_MODEL,
                "e2e-local-voscript-old-job",
                now - 120_000,
            ],
        });
        await transcripts.execute({
            sql: `
                INSERT OR REPLACE INTO transcript_segments (
                    id, recording_id, user_id, transcription_id,
                    transcript_origin, provider_segment_id, raw_speaker_label,
                    start_ms, end_ms, sort_seq_ms, text, content_hash,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, 'local', ?, 'OLD_SPEAKER', 0, 1000, 0, ?, ?, ?, ?)
            `,
            args: [
                `${LOCAL_VOSCRIPT_OLD_TRANSCRIPTION_ID}:segment-0`,
                LOCAL_VOSCRIPT_RECORDING_ID,
                userId,
                LOCAL_VOSCRIPT_OLD_TRANSCRIPTION_ID,
                "old-segment-0",
                LOCAL_VOSCRIPT_OLD_TRANSCRIPT_MARKER,
                `${LOCAL_VOSCRIPT_OLD_TRANSCRIPTION_ID}:hash:0`,
                now - 120_000,
                now - 120_000,
            ],
        });
    } finally {
        await core.close();
        await library.close();
        await transcripts.close();
    }
}

async function makeLocalVoScriptJobDue() {
    const library = createClient({
        url: databaseUrl(deriveSiblingDatabasePath(resolveDatabasePath(), "library")),
    });
    try {
        await library.execute({
            sql: "UPDATE transcription_jobs SET next_poll_at = ? WHERE recording_id = ?",
            args: [Date.now() - 1000, LOCAL_VOSCRIPT_RECORDING_ID],
        });
    } finally {
        await library.close();
    }
}

async function findIndexedTranscriptSearchTerm(
    text: string,
    recordingId = REAL_VOSCRIPT_TARGET_RECORDING_ID,
) {
    const terms = buildSearchTerms(text).filter((term) => {
        const length = Array.from(term).length;

        return length >= 2 && length <= 24;
    });
    const searchDbPath = deriveSiblingDatabasePath(
        resolveDatabasePath(),
        "search",
    );
    const client = createClient({ url: databaseUrl(searchDbPath) });

    try {
        for (const term of terms) {
            const result = await client.execute({
                sql: `
                    SELECT count(*) AS count
                    FROM search_content_fts
                    WHERE search_content_fts MATCH ?
                      AND recording_id = ?
                `,
                args: [term, recordingId],
            });
            if (Number(result.rows[0]?.count ?? 0) > 0) {
                return term;
            }
        }
    } finally {
        await client.close();
    }

    return null;
}

async function runBunJson<T>(label: string, source: string) {
    try {
        const { stdout } = await execFileAsync("bun", ["-e", source], {
            cwd: process.cwd(),
            env: buildWorkerEnv(),
            maxBuffer: 1024 * 1024,
            timeout: 90_000,
        });
        const jsonLine = stdout
            .trim()
            .split(/\r?\n/)
            .filter(Boolean)
            .at(-1);

        if (!jsonLine) {
            throw new Error("No JSON summary emitted");
        }

        return JSON.parse(jsonLine) as T;
    } catch {
        throw new Error(`${label} failed; see private local logs for details`);
    }
}

async function runTranscriptionWorker() {
    return runBunJson<WorkerSummary>(
        "Real VoScript transcription worker",
        `
            import { processDueTranscriptionJobs } from "./src/server/modules/transcription/jobs";
            const summary = await processDueTranscriptionJobs(1);
            console.log(JSON.stringify(summary));
        `,
    );
}

async function runSearchWorker() {
    return runBunJson<WorkerSummary>(
        "Real VoScript search worker",
        `
            import { processPendingSearchIndexJobs } from "./src/server/modules/search";
            const summary = await processPendingSearchIndexJobs({ limit: 20 });
            console.log(JSON.stringify(summary));
        `,
    );
}

async function getTranscriptionState(
    page: Page,
    recordingId = REAL_VOSCRIPT_TARGET_RECORDING_ID,
) {
    const response = await page.request.get(
        `/api/recordings/${recordingId}/transcribe`,
    );
    expect(response.ok()).toBe(true);

    return (await response.json()) as TranscriptionState;
}

function getSegmentCount(state: TranscriptionState) {
    return state.transcript?.segments?.length ?? 0;
}

function getTimestampCoverage(state: TranscriptionState) {
    return (
        state.transcript?.segments?.filter((segment) => {
            const start =
                typeof segment.startMs === "number"
                    ? segment.startMs
                    : segment.start;
            const end =
                typeof segment.endMs === "number" ? segment.endMs : segment.end;

            return (
                typeof start === "number" &&
                Number.isFinite(start) &&
                typeof end === "number" &&
                Number.isFinite(end) &&
                end >= start
            );
        }).length ?? 0
    );
}

function getSpeakerLabelCount(state: TranscriptionState) {
    return new Set(
        (state.transcript?.segments ?? []).flatMap((segment) => {
            const label =
                segment.displaySpeaker ??
                segment.speakerName ??
                segment.speakerLabel;

            return label ? [label] : [];
        }),
    ).size;
}

async function waitForCompletedTranscription(page: Page) {
    const deadline = Date.now() + REAL_VOSCRIPT_TIMEOUT_MS;
    let state = await getTranscriptionState(page);

    while (Date.now() < deadline) {
        const summary = await runTranscriptionWorker();
        expect(summary.processed).toBeGreaterThanOrEqual(0);
        state = await getTranscriptionState(page);

        if (state.job?.status === "succeeded") {
            return state;
        }

        if (state.job?.status === "failed") {
            throw new Error(
                "Real VoScript transcription failed; see private local logs for details",
            );
        }

        await page.waitForTimeout(5_000);
    }

    throw new Error("Real VoScript transcription timed out");
}

async function querySearchForGeneratedTranscript(
    page: Page,
    recordingId = REAL_VOSCRIPT_TARGET_RECORDING_ID,
) {
    const state = await getTranscriptionState(page, recordingId);

    for (let attempt = 0; attempt < 5; attempt += 1) {
        await runSearchWorker();
        const query = await findIndexedTranscriptSearchTerm(
            state.transcript?.text ?? "",
            recordingId,
        );
        if (!query) {
            await page.waitForTimeout(1_000);
            continue;
        }

        const response = await page.request.get("/api/search", {
            params: {
                q: query,
                type: "transcript",
                limit: "10",
            },
        });
        expect(response.ok()).toBe(true);

        const body = (await response.json()) as SearchResponse;
        if (
            body.results.some(
                (result) =>
                    result.entityType === "transcript" &&
                    result.recordingId === recordingId,
            )
        ) {
            return true;
        }

        await page.waitForTimeout(1_000);
    }

    return false;
}

test("uses the SOT dashboard queue with a local VoScript-compatible backend", async ({
    page,
}) => {
    const stub = await startLocalVoScriptStubServer();
    let userId: string | null = null;

    try {
        await ensureSignedIn(page);
        userId = await getPlaywrightUserId();
        await seedLocalVoScriptQueueFixture(userId, stub.baseUrl);
        const destructivePreState = await getTranscriptionState(
            page,
            LOCAL_VOSCRIPT_RECORDING_ID,
        );
        expect(destructivePreState.transcript?.provider).toBe(
            LOCAL_VOSCRIPT_OLD_PROVIDER,
        );
        expect(destructivePreState.transcript?.model).toBe(
            LOCAL_VOSCRIPT_OLD_MODEL,
        );
        expect(destructivePreState.transcript?.text).toContain(
            LOCAL_VOSCRIPT_OLD_TRANSCRIPT_MARKER,
        );

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await expect(
            page.locator('[data-sot-surface="dashboard-workstation"]'),
        ).toHaveAttribute("data-sot-state", "ready");
        await page
            .getByRole("button", { name: /E2E local VoScript queue/ })
            .click();
        await expect(
            page.getByRole("heading", { name: /E2E local VoScript queue/ }),
        ).toBeVisible();

        const retranscribe = page
            .locator('[data-sot-control="retranscribe-recording"]')
            .first();
        await expect(retranscribe).toBeEnabled();
        await expect(retranscribe).toHaveAttribute("data-sot-state", "idle");

        const postRequest = page.waitForRequest(
            (request) =>
                request
                    .url()
                    .includes(
                        `/api/recordings/${LOCAL_VOSCRIPT_RECORDING_ID}/transcribe`,
                    ) && request.method() === "POST",
        );
        const postResponse = page.waitForResponse(
            (response) =>
                response
                    .url()
                    .includes(
                        `/api/recordings/${LOCAL_VOSCRIPT_RECORDING_ID}/transcribe`,
                    ) && response.request().method() === "POST",
        );
        await retranscribe.click();
        await page
            .locator('[data-sot-panel="confirm-dialog"]')
            .filter({ hasText: "重新转写" })
            .getByRole("button", { name: "确认重新转写" })
            .click();

        expect((await postRequest).postDataJSON()).toEqual({ force: true });
        expect((await postResponse).status()).toBe(202);
        await expect(
            page.locator(
                '[data-sot-panel="dashboard-retranscription"][data-sot-state="queued"]',
            ),
        ).toContainText("转写任务已加入队列");
        await expect(
            page
                .locator("[data-sonner-toast]")
                .filter({ hasText: "转写任务已加入队列" }),
        ).toBeVisible();

        const submitted = await runTranscriptionWorker();
        expect(submitted).toMatchObject({
            processed: 1,
            succeeded: 0,
            failed: 0,
        });
        expect(stub.state.submitCount).toBe(1);
        expect(stub.state.uploadBytes).toBeGreaterThan(0);
        expect(stub.state.contentTypes.some((value) => value.includes("multipart/form-data"))).toBe(true);
        expect(
            stub.state.authorizationHeaders.filter(Boolean),
        ).toContain(`Bearer ${LOCAL_VOSCRIPT_FAKE_API_KEY}`);
        expect(stub.state.apiKeyHeaders.filter(Boolean)).toContain(
            LOCAL_VOSCRIPT_FAKE_API_KEY,
        );

        await makeLocalVoScriptJobDue();
        const completed = await runTranscriptionWorker();
        expect(completed).toMatchObject({
            processed: 1,
            succeeded: 1,
            failed: 0,
        });
        expect(stub.state.pollCount).toBe(1);

        const state = await getTranscriptionState(
            page,
            LOCAL_VOSCRIPT_RECORDING_ID,
        );
        const searchHit = await querySearchForGeneratedTranscript(
            page,
            LOCAL_VOSCRIPT_RECORDING_ID,
        );

        expect(state.job?.status).toBe("succeeded");
        expect(state.job?.lastError).toBeNull();
        expect(state.transcript?.provider).toBe("voice-transcribe");
        expect(state.transcript?.model).toContain("faster-whisper");
        expect(state.transcript?.text).toContain(LOCAL_VOSCRIPT_SEARCH_PHRASE);
        expect(state.transcript?.text).not.toContain(
            LOCAL_VOSCRIPT_OLD_TRANSCRIPT_MARKER,
        );
        expect(getSegmentCount(state)).toBe(2);
        expect(getTimestampCoverage(state)).toBe(2);
        expect(getSpeakerLabelCount(state)).toBeGreaterThanOrEqual(2);
        expect(searchHit).toBe(true);

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await page
            .getByRole("button", { name: /E2E local VoScript queue/ })
            .click();
        await expect(
            page.locator(
                '[data-sot-panel="dashboard-retranscription"][data-sot-state="completed"]',
            ),
        ).toBeVisible();
        await expect(page.getByText(LOCAL_VOSCRIPT_SEARCH_PHRASE)).toBeVisible();
    } finally {
        await stub.close();
        const cleanupTranscriptionIds = await cleanupLocalVoScriptQueueSeed(
            userId ?? undefined,
        );
        await expectLocalVoScriptFixtureClean(cleanupTranscriptionIds);
    }
});

if (shouldRunRealVoScriptE2E()) {
    test("uses current VoScript config and current content through the app queue", async ({
        page,
    }) => {
        await ensureSignedIn(page);

        const userId = await getPlaywrightUserId();
        const fixture = await seedRealVoScriptCurrentFixture({
            targetUserId: userId,
        });

        expect(fixture.recordingId).toBe(REAL_VOSCRIPT_TARGET_RECORDING_ID);
        expect(fixture.sourceProvider).toBeTruthy();
        expect(fixture.audioBytes).toBeGreaterThan(0);

        const queueResponse = await page.request.post(
            `/api/recordings/${REAL_VOSCRIPT_TARGET_RECORDING_ID}/transcribe`,
            { data: { force: true } },
        );
        expect(queueResponse.status()).toBe(202);

        const state = await waitForCompletedTranscription(page);
        const segmentCount = getSegmentCount(state);
        const timestampCoverage = getTimestampCoverage(state);
        const searchHit = await querySearchForGeneratedTranscript(page);

        expect(state.job?.status).toBe("succeeded");
        expect(state.job?.lastError).toBeNull();
        expect(state.transcript?.provider).toBe("voice-transcribe");
        expect(state.transcript?.model).toContain("faster-whisper");
        expect(state.transcript?.text.trim().length).toBeGreaterThan(0);
        expect(segmentCount).toBeGreaterThan(0);
        expect(timestampCoverage).toBeGreaterThan(0);
        expect(getSpeakerLabelCount(state)).toBeGreaterThan(0);
        expect(searchHit).toBe(true);
    });
}
