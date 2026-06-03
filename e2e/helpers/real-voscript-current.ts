import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { mkdir, stat, copyFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient, type Client } from "@libsql/client";

export const REAL_VOSCRIPT_E2E_GUARD = "BETTERAINOTE_REAL_VOSCRIPT_E2E";
export const REAL_VOSCRIPT_SOURCE_DATABASE_PATH =
    "BETTERAINOTE_REAL_VOSCRIPT_SOURCE_DATABASE_PATH";
export const REAL_VOSCRIPT_SOURCE_STORAGE_PATH =
    "BETTERAINOTE_REAL_VOSCRIPT_SOURCE_STORAGE_PATH";
export const REAL_VOSCRIPT_SOURCE_ENCRYPTION_KEY =
    "BETTERAINOTE_REAL_VOSCRIPT_SOURCE_ENCRYPTION_KEY";
export const REAL_VOSCRIPT_SOURCE_USER_ID =
    "BETTERAINOTE_REAL_VOSCRIPT_SOURCE_USER_ID";
export const REAL_VOSCRIPT_SOURCE_RECORDING_ID =
    "BETTERAINOTE_REAL_VOSCRIPT_SOURCE_RECORDING_ID";

export const REAL_VOSCRIPT_TARGET_RECORDING_ID =
    "e2e-real-voscript-current-recording";

const REAL_VOSCRIPT_TARGET_TRANSCRIPTION_ID =
    "e2e-real-voscript-current-transcription";
const REAL_VOSCRIPT_TARGET_CREDENTIAL_ID =
    "e2e-real-voscript-current-credential";
const REAL_VOSCRIPT_TARGET_SOURCE_RECORDING_ID =
    "e2e-real-voscript-current-source";
const REAL_VOSCRIPT_TARGET_DEVICE_ID = "e2e-real-voscript-current-device";
const PRIVATE_TRANSCRIPTION_PROVIDER = "private-transcription";
const DEFAULT_E2E_ROOT = path.resolve(process.cwd(), "tmp/e2e");
const DEFAULT_E2E_DATABASE_PATH = path.join(
    DEFAULT_E2E_ROOT,
    "data/betterainote-e2e.db",
);
const DEFAULT_E2E_STORAGE_PATH = path.join(DEFAULT_E2E_ROOT, "storage");
const DEFAULT_E2E_ENCRYPTION_KEY =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const SUPPORTED_PRIVATE_TRANSCRIBE_PROVIDERS = new Set([
    "plaud",
    "ticnote",
    "feishu-minutes",
    "dingtalk-a1",
]);

type DatabaseLayout = {
    core: string;
    library: string;
    transcripts: string;
    voiceprints: string;
    search: string;
};

type SourceSettingsRow = {
    user_id: string;
    default_transcription_language: string | null;
    speaker_diarization: number | null;
    diarization_speakers: number | null;
    private_transcription_base_url: string | null;
    private_transcription_min_speakers: number | null;
    private_transcription_max_speakers: number | null;
    private_transcription_denoise_model: string | null;
    private_transcription_snr_threshold: number | null;
    private_transcription_no_repeat_ngram_size: number | null;
    private_transcription_max_inflight_jobs: number | null;
};

type SourceCredentialRow = {
    provider: string;
    api_key: string;
    base_url: string | null;
    is_default_transcription: number | null;
};

type SourceRecordingRow = {
    id: string;
    source_provider: string;
    duration: number;
    start_time: number;
    end_time: number;
    filesize: number;
    file_md5: string;
    storage_path: string;
    filename: string;
};

export type RealVoScriptCurrentFixture = {
    recordingId: string;
    sourceProvider: string;
    durationMs: number;
    audioBytes: number;
    hasApiKey: boolean;
};

function resolveLocalPath(targetPath: string) {
    if (/^(libsql:|https?:)/.test(targetPath)) {
        throw new Error("Real VoScript E2E only supports local SQLite paths");
    }

    if (targetPath.startsWith("file:")) {
        return new URL(targetPath).pathname;
    }

    return targetPath;
}

function deriveSiblingDatabasePath(databasePath: string, suffix: string) {
    const localPath = resolveLocalPath(databasePath);
    const parsed = path.parse(localPath);

    return path.resolve(
        parsed.dir || ".",
        `${parsed.name || "betterainote"}-${suffix}${parsed.ext || ".db"}`,
    );
}

function getDatabaseLayout(databasePath: string): DatabaseLayout {
    return {
        core: resolveLocalPath(databasePath),
        library: deriveSiblingDatabasePath(databasePath, "library"),
        transcripts: deriveSiblingDatabasePath(databasePath, "transcripts"),
        voiceprints: deriveSiblingDatabasePath(databasePath, "voiceprints"),
        search: deriveSiblingDatabasePath(databasePath, "search"),
    };
}

function assertInsideRoot(targetPath: string, rootPath: string, label: string) {
    const resolvedTarget = path.resolve(resolveLocalPath(targetPath));
    const resolvedRoot = path.resolve(rootPath);
    const isInsideRoot =
        resolvedTarget === resolvedRoot ||
        resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`);

    if (!isInsideRoot) {
        throw new Error(`${label} must stay inside the guarded E2E root`);
    }
}

function databaseUrl(filePath: string) {
    return pathToFileURL(path.resolve(resolveLocalPath(filePath))).href;
}

function requireEnv(name: string) {
    const value = process.env[name]?.trim();
    if (!value) {
        throw new Error(`${name} is required for real VoScript E2E`);
    }

    return value;
}

function resolveTargetEnv(name: string, fallback: string) {
    return process.env[name]?.trim() || fallback;
}

function normalizeHexKey(value: string, label: string) {
    if (!/^[0-9a-fA-F]{64}$/.test(value)) {
        throw new Error(`${label} must be a 64 character hex key`);
    }

    return Buffer.from(value, "hex");
}

function decryptWithKey(ciphertext: string, keyHex: string) {
    const [ivHex, authTagHex, encryptedHex] = ciphertext.split(":");
    if (!ivHex || !authTagHex || !encryptedHex) {
        throw new Error("Stored VoScript credential has an unsupported shape");
    }

    const decipher = createDecipheriv(
        "aes-256-gcm",
        normalizeHexKey(keyHex, REAL_VOSCRIPT_SOURCE_ENCRYPTION_KEY),
        Buffer.from(ivHex, "hex"),
    );
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(encryptedHex, "hex")),
        decipher.final(),
    ]);

    return decrypted.toString("utf8");
}

function encryptWithKey(plaintext: string, keyHex: string) {
    const iv = randomBytes(16);
    const cipher = createCipheriv(
        "aes-256-gcm",
        normalizeHexKey(keyHex, "ENCRYPTION_KEY"),
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

function createDb(filePath: string) {
    return createClient({ url: databaseUrl(filePath) });
}

async function readFirst<T>(
    client: Client,
    sql: string,
    args: Array<string | number | null> = [],
) {
    const result = await client.execute({ sql, args });

    return (result.rows[0] ?? null) as T | null;
}

async function readAll<T>(
    client: Client,
    sql: string,
    args: Array<string | number | null> = [],
) {
    const result = await client.execute({ sql, args });

    return result.rows as unknown as T[];
}

function chooseCredential(
    credentials: SourceCredentialRow[],
    configuredBaseUrl: string,
) {
    return (
        credentials.find(
            (credential) =>
                credential.provider === PRIVATE_TRANSCRIPTION_PROVIDER,
        ) ??
        credentials.find(
            (credential) => credential.base_url?.trim() === configuredBaseUrl,
        ) ??
        credentials.find((credential) => credential.is_default_transcription) ??
        null
    );
}

async function getSourceSettings(sourceCore: Client) {
    const configuredSourceUserId = process.env[
        REAL_VOSCRIPT_SOURCE_USER_ID
    ]?.trim();
    const sourceSettings = configuredSourceUserId
        ? await readFirst<SourceSettingsRow>(
              sourceCore,
              `
                SELECT *
                FROM user_settings
                WHERE user_id = ? AND private_transcription_base_url IS NOT NULL
                LIMIT 1
              `,
              [configuredSourceUserId],
          )
        : await readFirst<SourceSettingsRow>(
              sourceCore,
              `
                SELECT *
                FROM user_settings
                WHERE private_transcription_base_url IS NOT NULL
                ORDER BY updated_at DESC
                LIMIT 1
              `,
          );

    if (!sourceSettings?.private_transcription_base_url?.trim()) {
        throw new Error("Current VoScript configuration is missing");
    }

    return sourceSettings;
}

async function getSourceCredential(
    sourceCore: Client,
    sourceUserId: string,
    configuredBaseUrl: string,
) {
    const credentials = await readAll<SourceCredentialRow>(
        sourceCore,
        `
            SELECT provider, api_key, base_url, is_default_transcription
            FROM api_credentials
            WHERE user_id = ?
              AND (
                provider = ?
                OR provider LIKE '%voice-transcribe%'
                OR provider LIKE '%private-transcription%'
                OR base_url = ?
                OR is_default_transcription = 1
              )
        `,
        [sourceUserId, PRIVATE_TRANSCRIPTION_PROVIDER, configuredBaseUrl],
    );

    return chooseCredential(credentials, configuredBaseUrl);
}

async function getSourceRecording(sourceLibrary: Client, sourceUserId: string) {
    const configuredRecordingId = process.env[
        REAL_VOSCRIPT_SOURCE_RECORDING_ID
    ]?.trim();
    const rows = configuredRecordingId
        ? await readAll<SourceRecordingRow>(
              sourceLibrary,
              `
                SELECT id, source_provider, duration, start_time, end_time,
                       filesize, file_md5, storage_path, filename
                FROM recordings
                WHERE user_id = ? AND id = ? AND trim(storage_path) != ''
                LIMIT 1
              `,
              [sourceUserId, configuredRecordingId],
          )
        : await readAll<SourceRecordingRow>(
              sourceLibrary,
              `
                SELECT id, source_provider, duration, start_time, end_time,
                       filesize, file_md5, storage_path, filename
                FROM recordings
                WHERE user_id = ?
                  AND trim(storage_path) != ''
                  AND upstream_trashed = 0
                  AND upstream_deleted = 0
                ORDER BY duration ASC, start_time DESC
                LIMIT 50
              `,
              [sourceUserId],
          );
    const recording =
        rows.find((row) =>
            SUPPORTED_PRIVATE_TRANSCRIBE_PROVIDERS.has(row.source_provider),
        ) ?? null;

    if (!recording) {
        throw new Error("Current content with local audio is missing");
    }

    return recording;
}

async function hasExistingSourceTranscript(
    sourceTranscripts: Client,
    recordingId: string,
) {
    const row = await readFirst<{ count: number }>(
        sourceTranscripts,
        `
            SELECT count(*) AS count
            FROM transcriptions
            WHERE recording_id = ?
              AND trim(text) != ''
            LIMIT 1
        `,
        [recordingId],
    );

    return Number(row?.count ?? 0) > 0;
}

async function getSourceRecordingWithTranscriptPreference(params: {
    sourceLibrary: Client;
    sourceTranscripts: Client;
    sourceUserId: string;
}) {
    const configuredRecordingId = process.env[
        REAL_VOSCRIPT_SOURCE_RECORDING_ID
    ]?.trim();
    if (configuredRecordingId) {
        return getSourceRecording(params.sourceLibrary, params.sourceUserId);
    }

    const rows = await readAll<SourceRecordingRow>(
        params.sourceLibrary,
        `
            SELECT id, source_provider, duration, start_time, end_time,
                   filesize, file_md5, storage_path, filename
            FROM recordings
            WHERE user_id = ?
              AND trim(storage_path) != ''
              AND upstream_trashed = 0
              AND upstream_deleted = 0
              AND duration >= 10000
            ORDER BY duration ASC, start_time DESC
            LIMIT 100
        `,
        [params.sourceUserId],
    );
    const supportedRows = rows.filter((row) =>
        SUPPORTED_PRIVATE_TRANSCRIBE_PROVIDERS.has(row.source_provider),
    );

    for (const row of supportedRows) {
        if (await hasExistingSourceTranscript(params.sourceTranscripts, row.id)) {
            return row;
        }
    }

    return supportedRows[0] ?? getSourceRecording(params.sourceLibrary, params.sourceUserId);
}

function resolveStorageFile(rootPath: string, storageKey: string) {
    const normalizedKey = storageKey.replace(/\\/g, "/");
    if (
        !normalizedKey ||
        normalizedKey.includes("..") ||
        normalizedKey.startsWith("/") ||
        normalizedKey.includes("\0")
    ) {
        throw new Error("Current recording audio path is not storage-safe");
    }

    const resolvedRoot = path.resolve(rootPath);
    const resolvedFile = path.resolve(resolvedRoot, normalizedKey);
    const relativePath = path.relative(resolvedRoot, resolvedFile);
    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
        throw new Error("Current recording audio path escapes storage root");
    }

    return resolvedFile;
}

function extensionForRecording(recording: SourceRecordingRow) {
    const extension =
        path.extname(recording.storage_path) || path.extname(recording.filename);

    return /^[.][a-zA-Z0-9]{1,8}$/.test(extension) ? extension : ".wav";
}

async function seedTargetSettings(params: {
    targetCore: Client;
    targetUserId: string;
    sourceSettings: SourceSettingsRow;
    encryptedApiKey: string | null;
}) {
    const now = Date.now();
    const maxInflightJobs =
        params.sourceSettings.private_transcription_max_inflight_jobs ?? 1;

    await params.targetCore.execute({
        sql: `
            INSERT INTO user_settings (
                id, user_id, default_transcription_language,
                speaker_diarization, diarization_speakers,
                private_transcription_base_url,
                private_transcription_min_speakers,
                private_transcription_max_speakers,
                private_transcription_denoise_model,
                private_transcription_snr_threshold,
                private_transcription_no_repeat_ngram_size,
                private_transcription_max_inflight_jobs,
                auto_generate_title,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                default_transcription_language = excluded.default_transcription_language,
                speaker_diarization = excluded.speaker_diarization,
                diarization_speakers = excluded.diarization_speakers,
                private_transcription_base_url = excluded.private_transcription_base_url,
                private_transcription_min_speakers = excluded.private_transcription_min_speakers,
                private_transcription_max_speakers = excluded.private_transcription_max_speakers,
                private_transcription_denoise_model = excluded.private_transcription_denoise_model,
                private_transcription_snr_threshold = excluded.private_transcription_snr_threshold,
                private_transcription_no_repeat_ngram_size = excluded.private_transcription_no_repeat_ngram_size,
                private_transcription_max_inflight_jobs = excluded.private_transcription_max_inflight_jobs,
                auto_generate_title = 0,
                updated_at = excluded.updated_at
        `,
        args: [
            "e2e-real-voscript-current-settings",
            params.targetUserId,
            params.sourceSettings.default_transcription_language,
            params.sourceSettings.speaker_diarization ?? 0,
            params.sourceSettings.diarization_speakers,
            params.sourceSettings.private_transcription_base_url,
            params.sourceSettings.private_transcription_min_speakers ?? 0,
            params.sourceSettings.private_transcription_max_speakers ?? 0,
            params.sourceSettings.private_transcription_denoise_model ?? "none",
            params.sourceSettings.private_transcription_snr_threshold,
            params.sourceSettings
                .private_transcription_no_repeat_ngram_size ?? 0,
            maxInflightJobs,
            now,
            now,
        ],
    });

    await params.targetCore.execute({
        sql: "DELETE FROM api_credentials WHERE user_id = ? AND provider = ?",
        args: [params.targetUserId, PRIVATE_TRANSCRIPTION_PROVIDER],
    });

    if (!params.encryptedApiKey) {
        return;
    }

    await params.targetCore.execute({
        sql: `
            INSERT INTO api_credentials (
                id, user_id, provider, api_key, base_url, default_model,
                is_default_transcription, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, NULL, 0, ?, ?)
        `,
        args: [
            REAL_VOSCRIPT_TARGET_CREDENTIAL_ID,
            params.targetUserId,
            PRIVATE_TRANSCRIPTION_PROVIDER,
            params.encryptedApiKey,
            params.sourceSettings.private_transcription_base_url,
            now,
            now,
        ],
    });
}

async function cleanupTargetRows(params: {
    targetLibrary: Client;
    targetTranscripts: Client;
    targetVoiceprints: Client;
    targetSearch: Client;
    targetUserId: string;
}) {
    await params.targetTranscripts.execute({
        sql: "DELETE FROM transcript_segments WHERE recording_id = ?",
        args: [REAL_VOSCRIPT_TARGET_RECORDING_ID],
    });
    await params.targetTranscripts.execute({
        sql: "DELETE FROM source_artifact_segments WHERE recording_id = ?",
        args: [REAL_VOSCRIPT_TARGET_RECORDING_ID],
    });
    await params.targetTranscripts.execute({
        sql: "DELETE FROM source_artifacts WHERE recording_id = ?",
        args: [REAL_VOSCRIPT_TARGET_RECORDING_ID],
    });
    await params.targetTranscripts.execute({
        sql: "DELETE FROM transcriptions WHERE recording_id = ?",
        args: [REAL_VOSCRIPT_TARGET_RECORDING_ID],
    });
    await params.targetLibrary.execute({
        sql: "DELETE FROM transcription_jobs WHERE recording_id = ?",
        args: [REAL_VOSCRIPT_TARGET_RECORDING_ID],
    });
    await params.targetLibrary.execute({
        sql: "DELETE FROM recordings WHERE id = ?",
        args: [REAL_VOSCRIPT_TARGET_RECORDING_ID],
    });
    await params.targetVoiceprints.execute({
        sql: "DELETE FROM recording_speakers WHERE recording_id = ?",
        args: [REAL_VOSCRIPT_TARGET_RECORDING_ID],
    });
    await params.targetSearch.execute({
        sql: "DELETE FROM search_content_fts WHERE recording_id = ?",
        args: [REAL_VOSCRIPT_TARGET_RECORDING_ID],
    });
    await params.targetSearch.execute({
        sql: "DELETE FROM search_chunks WHERE recording_id = ?",
        args: [REAL_VOSCRIPT_TARGET_RECORDING_ID],
    });
    await params.targetSearch.execute({
        sql: `
            DELETE FROM search_documents
            WHERE recording_id = ? OR entity_id = ? OR entity_id = ?
        `,
        args: [
            REAL_VOSCRIPT_TARGET_RECORDING_ID,
            REAL_VOSCRIPT_TARGET_RECORDING_ID,
            REAL_VOSCRIPT_TARGET_TRANSCRIPTION_ID,
        ],
    });
    await params.targetSearch.execute({
        sql: `
            DELETE FROM search_index_jobs
            WHERE user_id = ?
              AND (entity_id = ? OR entity_id = ?)
        `,
        args: [
            params.targetUserId,
            REAL_VOSCRIPT_TARGET_RECORDING_ID,
            REAL_VOSCRIPT_TARGET_TRANSCRIPTION_ID,
        ],
    });
}

async function seedTargetRecording(params: {
    targetLibrary: Client;
    targetUserId: string;
    sourceRecording: SourceRecordingRow;
    targetStorageKey: string;
    audioBytes: number;
}) {
    const now = Date.now();
    const duration = Math.max(1, params.sourceRecording.duration || 1);
    const startTime = now - duration;
    const endTime = startTime + duration;

    await params.targetLibrary.execute({
        sql: `
            INSERT INTO recordings (
                id, user_id, source_provider, source_recording_id,
                source_version, source_metadata, provider_device_id,
                filename, duration, start_time, end_time, filesize,
                file_md5, storage_type, storage_path, downloaded_at,
                upstream_trashed, upstream_deleted, created_at, updated_at
            ) VALUES (?, ?, ?, ?, 'current-e2e', '{}', ?, ?, ?, ?, ?, ?, ?, 'local', ?, ?, 0, 0, ?, ?)
        `,
        args: [
            REAL_VOSCRIPT_TARGET_RECORDING_ID,
            params.targetUserId,
            params.sourceRecording.source_provider,
            REAL_VOSCRIPT_TARGET_SOURCE_RECORDING_ID,
            REAL_VOSCRIPT_TARGET_DEVICE_ID,
            `Real VoScript current content${extensionForRecording(
                params.sourceRecording,
            )}`,
            duration,
            startTime,
            endTime,
            params.audioBytes || params.sourceRecording.filesize || 0,
            "e2e-real-voscript-current",
            params.targetStorageKey,
            now,
            now,
            now,
        ],
    });
}

export function shouldRunRealVoScriptE2E() {
    return process.env[REAL_VOSCRIPT_E2E_GUARD] === "1";
}

export async function seedRealVoScriptCurrentFixture(params: {
    targetUserId: string;
}): Promise<RealVoScriptCurrentFixture> {
    if (!shouldRunRealVoScriptE2E()) {
        throw new Error(`${REAL_VOSCRIPT_E2E_GUARD}=1 is required`);
    }

    const e2eRoot = resolveTargetEnv("PLAYWRIGHT_E2E_ROOT", DEFAULT_E2E_ROOT);
    const targetDatabasePath = resolveTargetEnv(
        "DATABASE_PATH",
        DEFAULT_E2E_DATABASE_PATH,
    );
    const targetStorageRoot = resolveTargetEnv(
        "LOCAL_STORAGE_PATH",
        DEFAULT_E2E_STORAGE_PATH,
    );
    const targetEncryptionKey = resolveTargetEnv(
        "ENCRYPTION_KEY",
        DEFAULT_E2E_ENCRYPTION_KEY,
    );
    const sourceDatabasePath = requireEnv(REAL_VOSCRIPT_SOURCE_DATABASE_PATH);
    const sourceStorageRoot = requireEnv(REAL_VOSCRIPT_SOURCE_STORAGE_PATH);
    const sourceEncryptionKey = requireEnv(REAL_VOSCRIPT_SOURCE_ENCRYPTION_KEY);
    const targetLayout = getDatabaseLayout(targetDatabasePath);
    const sourceLayout = getDatabaseLayout(sourceDatabasePath);

    for (const dbPath of Object.values(targetLayout)) {
        assertInsideRoot(dbPath, e2eRoot, "Real VoScript target database");
    }
    assertInsideRoot(targetStorageRoot, e2eRoot, "Real VoScript target storage");

    const sourceCore = createDb(sourceLayout.core);
    const sourceLibrary = createDb(sourceLayout.library);
    const sourceTranscripts = createDb(sourceLayout.transcripts);
    const targetCore = createDb(targetLayout.core);
    const targetLibrary = createDb(targetLayout.library);
    const targetTranscripts = createDb(targetLayout.transcripts);
    const targetVoiceprints = createDb(targetLayout.voiceprints);
    const targetSearch = createDb(targetLayout.search);

    try {
        const targetUser = await readFirst<{ id: string }>(
            targetCore,
            "SELECT id FROM users WHERE id = ? LIMIT 1",
            [params.targetUserId],
        );
        if (!targetUser) {
            throw new Error("Target E2E user is missing");
        }

        const sourceSettings = await getSourceSettings(sourceCore);
        const sourceBaseUrl =
            sourceSettings.private_transcription_base_url?.trim() ?? "";
        const sourceCredential = await getSourceCredential(
            sourceCore,
            sourceSettings.user_id,
            sourceBaseUrl,
        );
        const encryptedTargetApiKey = sourceCredential?.api_key
            ? encryptWithKey(
                  decryptWithKey(sourceCredential.api_key, sourceEncryptionKey),
                  targetEncryptionKey,
              )
            : null;
        const sourceRecording = await getSourceRecordingWithTranscriptPreference(
            {
                sourceLibrary,
                sourceTranscripts,
                sourceUserId: sourceSettings.user_id,
            },
        );
        const sourceAudioPath = resolveStorageFile(
            sourceStorageRoot,
            sourceRecording.storage_path,
        );
        const sourceAudioStats = await stat(sourceAudioPath);
        const targetExtension = extensionForRecording(sourceRecording);
        const targetStorageKey = `e2e/real-voscript/current-content${targetExtension}`;
        const targetAudioPath = resolveStorageFile(
            targetStorageRoot,
            targetStorageKey,
        );

        await mkdir(path.dirname(targetAudioPath), { recursive: true });
        await copyFile(sourceAudioPath, targetAudioPath);
        await cleanupTargetRows({
            targetLibrary,
            targetTranscripts,
            targetVoiceprints,
            targetSearch,
            targetUserId: params.targetUserId,
        });
        await seedTargetSettings({
            targetCore,
            targetUserId: params.targetUserId,
            sourceSettings,
            encryptedApiKey: encryptedTargetApiKey,
        });
        await seedTargetRecording({
            targetLibrary,
            targetUserId: params.targetUserId,
            sourceRecording,
            targetStorageKey,
            audioBytes: sourceAudioStats.size,
        });

        return {
            recordingId: REAL_VOSCRIPT_TARGET_RECORDING_ID,
            sourceProvider: sourceRecording.source_provider,
            durationMs: sourceRecording.duration,
            audioBytes: sourceAudioStats.size,
            hasApiKey: Boolean(encryptedTargetApiKey),
        };
    } finally {
        await sourceCore.close();
        await sourceLibrary.close();
        await sourceTranscripts.close();
        await targetCore.close();
        await targetLibrary.close();
        await targetTranscripts.close();
        await targetVoiceprints.close();
        await targetSearch.close();
    }
}
