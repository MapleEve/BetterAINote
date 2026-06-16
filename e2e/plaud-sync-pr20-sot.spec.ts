import { createCipheriv, randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { expect, type Page, test } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

const E2E_DATA_DIR = path.resolve(process.cwd(), "tmp/e2e/data");
const E2E_STORAGE_DIR = process.env.PLAYWRIGHT_E2E_STORAGE_DIR
    ? path.resolve(process.cwd(), process.env.PLAYWRIGHT_E2E_STORAGE_DIR)
    : path.resolve(process.cwd(), "tmp/e2e/storage");
const SOURCE_PREFIX = "e2e-pr20-plaud-";
const BACKFILL_RECORDING_ID = "e2e-pr20-plaud-backfill-local";
const BACKFILL_SOURCE_ID = `${SOURCE_PREFIX}backfill`;
const SOURCE_ONLY_ID = `${SOURCE_PREFIX}source-only`;
const PAGE2_SOURCE_ID = `${SOURCE_PREFIX}page2`;
const SOURCE_ONLY_TITLE = "PR20 Plaud source-only artifact";
const BACKFILL_TITLE = "PR20 Plaud backfill audio";
const E2E_AUDIO_BYTES = Buffer.from("betterainote pr20 plaud audio fixture");
const E2E_ENCRYPTION_KEY =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

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
        process.env.PLAYWRIGHT_E2E_ROOT ?? path.join(process.cwd(), "tmp/e2e"),
    );
    const resolved = path.resolve(filePath);
    if (resolved !== e2eRoot && !resolved.startsWith(`${e2eRoot}${path.sep}`)) {
        throw new Error(`Refusing to touch non-E2E path: ${resolved}`);
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

const CORE_DB = resolveDatabasePath();
const LIBRARY_DB = deriveSiblingDatabasePath(CORE_DB, "library");
const TRANSCRIPTS_DB = deriveSiblingDatabasePath(CORE_DB, "transcripts");
const VOICEPRINTS_DB = deriveSiblingDatabasePath(CORE_DB, "voiceprints");
const SEARCH_DB = deriveSiblingDatabasePath(CORE_DB, "search");

for (const databasePath of [
    CORE_DB,
    LIBRARY_DB,
    TRANSCRIPTS_DB,
    VOICEPRINTS_DB,
    SEARCH_DB,
]) {
    assertE2EPath(databasePath);
}

async function executeWithBusyRetry<T>(operation: () => Promise<T>, attempts = 8) {
    let lastError: unknown;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            if (
                !(error instanceof Error) ||
                !error.message.includes("SQLITE_BUSY") ||
                attempt === attempts - 1
            ) {
                throw error;
            }
            await new Promise((resolve) =>
                setTimeout(resolve, 80 * (attempt + 1)),
            );
        }
    }
    throw lastError;
}

async function getPlaywrightUserId() {
    const client = createClient({ url: databaseUrl(CORE_DB) });
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

async function resetDisplayToNewestChinese(page: Page) {
    const response = await page.request.put("/api/settings/display", {
        data: {
            dateTimeFormat: "relative",
            itemsPerPage: 50,
            recordingListSortOrder: "newest",
            theme: "dark",
            uiLanguage: "zh-CN",
        },
    });
    expect(response.ok()).toBe(true);
}

type RecordingRow = {
    id: string;
    filename: string;
    source_recording_id: string;
    storage_path: string;
};

async function readRecordingBySourceId(userId: string, sourceRecordingId: string) {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    try {
        const result = await library.execute({
            sql: `
                SELECT id, filename, source_recording_id, storage_path
                FROM recordings
                WHERE user_id = ? AND source_provider = 'plaud' AND source_recording_id = ?
                LIMIT 1
            `,
            args: [userId, sourceRecordingId],
        });
        return (result.rows[0] ?? null) as RecordingRow | null;
    } finally {
        await library.close();
    }
}

async function readPlaudRecordingCount(userId: string, sourceRecordingId?: string) {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    try {
        const result = await library.execute({
            sql: sourceRecordingId
                ? `
                    SELECT count(*) AS count
                    FROM recordings
                    WHERE user_id = ?
                      AND source_provider = 'plaud'
                      AND source_recording_id = ?
                `
                : `
                    SELECT count(*) AS count
                    FROM recordings
                    WHERE user_id = ?
                      AND source_provider = 'plaud'
                      AND source_recording_id LIKE ?
                `,
            args: sourceRecordingId
                ? [userId, sourceRecordingId]
                : [userId, `${SOURCE_PREFIX}%`],
        });
        return Number(result.rows[0]?.count ?? 0);
    } finally {
        await library.close();
    }
}

async function readTranscriptionJobCount(recordingId: string) {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    try {
        const result = await library.execute({
            sql: "SELECT count(*) AS count FROM transcription_jobs WHERE recording_id = ?",
            args: [recordingId],
        });
        return Number(result.rows[0]?.count ?? 0);
    } finally {
        await library.close();
    }
}

async function cleanupPlaudPr20Seeds(userId?: string) {
    const core = createClient({ url: databaseUrl(CORE_DB) });
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const transcripts = createClient({ url: databaseUrl(TRANSCRIPTS_DB) });
    const voiceprints = createClient({ url: databaseUrl(VOICEPRINTS_DB) });
    const search = createClient({ url: databaseUrl(SEARCH_DB) });
    const storageKeys: string[] = [];

    try {
        const recordingResult = await library.execute({
            sql: userId
                ? `
                    SELECT id, storage_path
                    FROM recordings
                    WHERE user_id = ?
                      AND source_provider = 'plaud'
                      AND (source_recording_id LIKE ? OR id = ?)
                `
                : `
                    SELECT id, storage_path
                    FROM recordings
                    WHERE source_provider = 'plaud'
                      AND (source_recording_id LIKE ? OR id = ?)
                `,
            args: userId
                ? [userId, `${SOURCE_PREFIX}%`, BACKFILL_RECORDING_ID]
                : [`${SOURCE_PREFIX}%`, BACKFILL_RECORDING_ID],
        });
        const recordingIds = recordingResult.rows
            .map((row) => row.id)
            .filter((id): id is string => typeof id === "string");
        storageKeys.push(
            ...recordingResult.rows
                .map((row) => row.storage_path)
                .filter(
                    (storagePath): storagePath is string =>
                        typeof storagePath === "string" &&
                        storagePath.trim().length > 0,
                ),
        );

        for (const recordingId of recordingIds) {
            await executeWithBusyRetry(() =>
                transcripts.execute({
                    sql: "DELETE FROM source_artifact_segments WHERE recording_id = ?",
                    args: [recordingId],
                }),
            );
            await executeWithBusyRetry(() =>
                transcripts.execute({
                    sql: "DELETE FROM transcript_segments WHERE recording_id = ?",
                    args: [recordingId],
                }),
            );
            await executeWithBusyRetry(() =>
                transcripts.execute({
                    sql: "DELETE FROM source_artifacts WHERE recording_id = ?",
                    args: [recordingId],
                }),
            );
            await executeWithBusyRetry(() =>
                transcripts.execute({
                    sql: "DELETE FROM transcriptions WHERE recording_id = ?",
                    args: [recordingId],
                }),
            );
            await executeWithBusyRetry(() =>
                library.execute({
                    sql: "DELETE FROM transcription_jobs WHERE recording_id = ?",
                    args: [recordingId],
                }),
            );
            await executeWithBusyRetry(() =>
                library.execute({
                    sql: "DELETE FROM recording_tag_assignments WHERE recording_id = ?",
                    args: [recordingId],
                }),
            );
            await executeWithBusyRetry(() =>
                voiceprints.execute({
                    sql: "DELETE FROM recording_speakers WHERE recording_id = ?",
                    args: [recordingId],
                }),
            );
            await executeWithBusyRetry(() =>
                search.execute({
                    sql: "DELETE FROM search_content_fts WHERE recording_id = ?",
                    args: [recordingId],
                }),
            );
            await executeWithBusyRetry(() =>
                search.execute({
                    sql: "DELETE FROM search_chunks WHERE recording_id = ?",
                    args: [recordingId],
                }),
            );
            await executeWithBusyRetry(() =>
                search.execute({
                    sql: "DELETE FROM search_documents WHERE recording_id = ?",
                    args: [recordingId],
                }),
            );
        }

        await executeWithBusyRetry(() =>
            library.execute({
                sql: userId
                    ? `
                        DELETE FROM recordings
                        WHERE user_id = ?
                          AND source_provider = 'plaud'
                          AND (source_recording_id LIKE ? OR id = ?)
                    `
                    : `
                        DELETE FROM recordings
                        WHERE source_provider = 'plaud'
                          AND (source_recording_id LIKE ? OR id = ?)
                    `,
                args: userId
                    ? [userId, `${SOURCE_PREFIX}%`, BACKFILL_RECORDING_ID]
                    : [`${SOURCE_PREFIX}%`, BACKFILL_RECORDING_ID],
            }),
        );
        if (userId) {
            await executeWithBusyRetry(() =>
                library.execute({
                    sql: "DELETE FROM source_devices WHERE user_id = ? AND provider = 'plaud'",
                    args: [userId],
                }),
            );
            await executeWithBusyRetry(() =>
                core.execute({
                    sql: "DELETE FROM source_connections WHERE user_id = ? AND provider = 'plaud'",
                    args: [userId],
                }),
            );
        }
    } finally {
        await core.close();
        await library.close();
        await transcripts.close();
        await voiceprints.close();
        await search.close();
    }

    for (const storageKey of storageKeys) {
        const filePath = path.join(E2E_STORAGE_DIR, storageKey);
        assertE2EPath(filePath);
        await rm(filePath, { force: true });
    }
}

async function seedSameVersionMissingAudio(userId: string) {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const now = Date.now();
    const startTime = Date.UTC(2026, 4, 31, 8, 0, 0);
    const duration = 60_000;

    try {
        await executeWithBusyRetry(() =>
            library.execute({
                sql: `
                    INSERT OR REPLACE INTO recordings (
                        id, user_id, source_provider, source_recording_id,
                        source_version, source_metadata, provider_device_id,
                        filename, duration, start_time, end_time, filesize,
                        file_md5, storage_type, storage_path, downloaded_at,
                        upstream_trashed, upstream_deleted, created_at, updated_at
                    ) VALUES (?, ?, 'plaud', ?, ?, '{}', ?, ?, ?, ?, ?, 0, ?, 'local', '', NULL, 0, 0, ?, ?)
                `,
                args: [
                    BACKFILL_RECORDING_ID,
                    userId,
                    BACKFILL_SOURCE_ID,
                    String(startTime + duration),
                    "e2e-pr20-device",
                    BACKFILL_TITLE,
                    duration,
                    startTime,
                    startTime + duration,
                    BACKFILL_SOURCE_ID,
                    now,
                    now,
                ],
            }),
        );
    } finally {
        await library.close();
    }
}

async function seedPlaudSourceConnection(userId: string, baseUrl: string) {
    const core = createClient({ url: databaseUrl(CORE_DB) });
    const now = Date.now();

    try {
        await executeWithBusyRetry(() =>
            core.execute({
                sql: `
                    INSERT INTO source_connections (
                        id, user_id, provider, enabled, auth_mode, base_url,
                        config, secret_config, last_sync, created_at, updated_at
                    ) VALUES (?, ?, 'plaud', 1, 'bearer', ?, ?, ?, NULL, ?, ?)
                    ON CONFLICT(user_id, provider) DO UPDATE SET
                        enabled = 1,
                        auth_mode = 'bearer',
                        base_url = excluded.base_url,
                        config = excluded.config,
                        secret_config = excluded.secret_config,
                        last_sync = NULL,
                        updated_at = excluded.updated_at
                `,
                args: [
                    "e2e-pr20-plaud-source-connection",
                    userId,
                    baseUrl,
                    JSON.stringify({
                        server: "custom",
                        customApiBase: baseUrl,
                        syncTitleToSource: false,
                    }),
                    encryptWithE2EKey(
                        JSON.stringify({
                            bearerToken: "e2e-pr20-plaud-token",
                        }),
                    ),
                    now,
                    now,
                ],
            }),
        );
    } finally {
        await core.close();
    }
}

function makePlaudRecording(input: {
    id: string;
    filename: string;
    offsetMs: number;
    duration?: number;
}) {
    const start = Date.UTC(2026, 4, 31, 9, 0, 0) - input.offsetMs;
    const duration = input.duration ?? 45_000;
    return {
        id: input.id,
        filename: input.filename,
        keywords: [],
        filesize: 4096,
        filetype: "mp3",
        fullname: input.filename,
        file_md5: input.id,
        ori_ready: true,
        version: start + duration,
        version_ms: start + duration,
        edit_time: start + duration,
        edit_from: "web",
        is_trash: false,
        start_time: start,
        end_time: start + duration,
        duration,
        timezone: 8,
        zonemins: 480,
        scene: 0,
        filetag_id_list: [],
        serial_number: "e2e-pr20-device",
        is_trans: true,
        is_summary: true,
    };
}

function buildPlaudPages() {
    const sourceOnly = makePlaudRecording({
        id: SOURCE_ONLY_ID,
        filename: `${SOURCE_ONLY_TITLE}.mp3`,
        offsetMs: 0,
        duration: 61_000,
    });
    const backfill = makePlaudRecording({
        id: BACKFILL_SOURCE_ID,
        filename: `${BACKFILL_TITLE}.mp3`,
        offsetMs: 2_000,
        duration: 60_000,
    });
    const fillers = Array.from({ length: 98 }, (_, index) =>
        makePlaudRecording({
            id: `${SOURCE_PREFIX}fill-${index.toString().padStart(3, "0")}`,
            filename: `PR20 Plaud paged import ${index + 1}.mp3`,
            offsetMs: 10_000 + index * 1_000,
        }),
    );
    const page2Only = makePlaudRecording({
        id: PAGE2_SOURCE_ID,
        filename: "PR20 Plaud second page recording.mp3",
        offsetMs: 160_000,
    });

    return {
        firstPage: [sourceOnly, backfill, ...fillers],
        secondPage: [fillers[0], page2Only],
        sourceOnly,
        backfill,
        page2Only,
    };
}

function writeJson(response: ServerResponse, body: unknown, status = 200) {
    response.writeHead(status, { "content-type": "application/json" });
    response.end(JSON.stringify(body));
}

function writeText(response: ServerResponse, body: string, status = 200) {
    response.writeHead(status, { "content-type": "text/plain" });
    response.end(body);
}

async function readRequestBody(request: IncomingMessage) {
    const chunks: Buffer[] = [];
    for await (const chunk of request) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString("utf8");
}

async function startPlaudStubServer() {
    const pages = buildPlaudPages();
    const state = {
        authorizationHeaders: [] as string[],
        originHeaders: [] as string[],
        listSkips: [] as number[],
        tempUrlIds: [] as string[],
    };

    const server = createServer(async (request, response) => {
        const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
        state.authorizationHeaders.push(request.headers.authorization ?? "");
        state.originHeaders.push(String(request.headers.origin ?? ""));

        if (requestUrl.pathname === "/device/list") {
            writeJson(response, {
                status: 0,
                msg: "ok",
                data_devices: [
                    {
                        sn: "e2e-pr20-device",
                        name: "PR20 Plaud",
                        model: "NotePin",
                        version_number: 1,
                    },
                ],
            });
            return;
        }

        if (requestUrl.pathname === "/file/simple/web") {
            const skip = Number(requestUrl.searchParams.get("skip") ?? 0);
            state.listSkips.push(skip);
            writeJson(response, {
                status: 0,
                msg: "ok",
                data_file_total: 101,
                data_file_list: skip === 0 ? pages.firstPage : pages.secondPage,
            });
            return;
        }

        if (requestUrl.pathname === "/file/list") {
            const body = await readRequestBody(request);
            const ids = JSON.parse(body || "[]") as string[];
            writeJson(response, {
                status: 0,
                msg: "ok",
                data_file_list: ids.map((id) => ({
                    id,
                    trans_result: id === SOURCE_ONLY_ID
                        ? [
                              {
                                  speaker: "Speaker 1",
                                  content: "source-only transcript from Plaud",
                                  start_time: 0,
                                  end_time: 1800,
                              },
                          ]
                        : [],
                })),
            });
            return;
        }

        if (requestUrl.pathname.startsWith("/ai/transsumm/")) {
            const id = decodeURIComponent(requestUrl.pathname.split("/").at(-1) ?? "");
            writeJson(response, {
                status: 0,
                msg: "ok",
                data_result:
                    id === SOURCE_ONLY_ID || id === BACKFILL_SOURCE_ID
                        ? [
                              {
                                  speaker: "Speaker 1",
                                  content:
                                      id === SOURCE_ONLY_ID
                                          ? "source-only transcript from Plaud"
                                          : "backfilled audio transcript from Plaud",
                                  start_time: 0,
                                  end_time: 1800,
                              },
                          ]
                        : null,
                data_result_summ:
                    id === SOURCE_ONLY_ID || id === BACKFILL_SOURCE_ID
                        ? {
                              content: {
                                  markdown:
                                      id === SOURCE_ONLY_ID
                                          ? "## PR20 source-only summary\n\n- Imported without local audio."
                                          : "## PR20 backfill summary\n\n- Local audio was restored.",
                              },
                          }
                        : null,
                data_result_summ_mul: null,
                outline_result: null,
            });
            return;
        }

        if (requestUrl.pathname.startsWith("/file/detail/")) {
            const id = decodeURIComponent(requestUrl.pathname.split("/").at(-1) ?? "");
            writeJson(response, {
                status: 0,
                msg: "ok",
                data: {
                    file_id: id,
                    file_name:
                        id === SOURCE_ONLY_ID ? SOURCE_ONLY_TITLE : BACKFILL_TITLE,
                    file_version: Date.now(),
                    duration: 61_000,
                    is_trash: false,
                    start_time: Date.UTC(2026, 4, 31, 9, 0, 0),
                    scene: 0,
                    serial_number: "e2e-pr20-device",
                    session_id: 1,
                    filetag_id_list: [],
                    content_list: [],
                },
            });
            return;
        }

        if (requestUrl.pathname.startsWith("/file/temp-url/")) {
            const id = decodeURIComponent(requestUrl.pathname.split("/").at(-1) ?? "");
            state.tempUrlIds.push(id);
            if (id === BACKFILL_SOURCE_ID) {
                writeJson(response, {
                    status: 0,
                    temp_url: `${baseUrl}/audio/backfill.mp3`,
                });
                return;
            }
            if (id === SOURCE_ONLY_ID) {
                writeJson(response, {
                    status: 0,
                    temp_url: `${baseUrl}/audio/source-only.mp3?token=secret`,
                });
                return;
            }
            writeJson(response, { status: 404, msg: "no temp url" }, 404);
            return;
        }

        if (requestUrl.pathname === "/audio/backfill.mp3") {
            response.writeHead(200, { "content-type": "audio/mpeg" });
            response.end(E2E_AUDIO_BYTES);
            return;
        }

        if (requestUrl.pathname === "/audio/source-only.mp3") {
            writeText(response, "audio intentionally unavailable", 503);
            return;
        }

        writeJson(response, { status: 404, msg: "not found" }, 404);
    });

    let baseUrl = "";
    await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", () => {
            const address = server.address();
            if (!address || typeof address === "string") {
                throw new Error("Unable to start Plaud stub server");
            }
            baseUrl = `http://127.0.0.1:${address.port}`;
            resolve();
        });
    });

    return {
        baseUrl,
        pages,
        state,
        close: () =>
            new Promise<void>((resolve, reject) => {
                server.close((error) => (error ? reject(error) : resolve()));
            }),
    };
}

function dashboardSourceReport(page: Page, state?: string) {
    const selector = '[data-sot-panel="dashboard-source-report"]';
    return page.locator(state ? `${selector}[data-sot-state="${state}"]` : selector);
}

test("Plaud PR #20 sync uses SOT controls and imports paged, backfilled, and source-only records through the backend", async ({
    page,
}) => {
    const plaudStub = await startPlaudStubServer();
    let userId: string | null = null;

    try {
        await ensureSignedIn(page);
        userId = await getPlaywrightUserId();
        await cleanupPlaudPr20Seeds(userId);
        await resetDisplayToNewestChinese(page);
        await seedSameVersionMissingAudio(userId);
        await seedPlaudSourceConnection(userId, plaudStub.baseUrl);

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await expect(
            page.locator('[data-sot-surface="dashboard-workstation"]'),
        ).toHaveAttribute("data-sot-state", "ready");

        const syncResponsePromise = page.waitForResponse(
            (response) =>
                response.url().includes("/api/data-sources/sync") &&
                response.request().method() === "POST" &&
                response.ok(),
        );
        await page
            .locator('[data-sot-panel="dashboard-sync"]')
            .getByRole("button", { name: "同步" })
            .click();
        const syncResponse = await syncResponsePromise;
        const syncBody = await syncResponse.json();

        expect(syncBody).toMatchObject({
            success: true,
            newRecordings: 100,
            updatedRecordings: 1,
            errors: [],
        });
        expect(plaudStub.state.listSkips).toEqual([0, 100]);
        expect(
            plaudStub.state.authorizationHeaders
                .filter(Boolean)
                .every((header) => header === "Bearer e2e-pr20-plaud-token"),
        ).toBe(true);
        expect(
            plaudStub.state.originHeaders.filter(Boolean),
        ).toContain("https://app.plaud.ai");

        const sourceOnly = await readRecordingBySourceId(userId, SOURCE_ONLY_ID);
        const backfill = await readRecordingBySourceId(userId, BACKFILL_SOURCE_ID);
        const secondPage = await readRecordingBySourceId(userId, PAGE2_SOURCE_ID);
        expect(sourceOnly).toBeTruthy();
        expect(backfill).toBeTruthy();
        expect(secondPage).toBeTruthy();
        await expect
            .poll(() => readPlaudRecordingCount(userId ?? ""))
            .toBe(101);
        await expect
            .poll(() =>
                readPlaudRecordingCount(
                    userId ?? "",
                    `${SOURCE_PREFIX}fill-000`,
                ),
            )
            .toBe(1);
        expect(sourceOnly?.storage_path).toBe("");
        expect(await readTranscriptionJobCount(sourceOnly?.id ?? "")).toBe(0);
        expect(backfill?.id).toBe(BACKFILL_RECORDING_ID);
        expect(backfill?.storage_path.trim()).not.toBe("");

        const backfillAudioPath = path.join(
            E2E_STORAGE_DIR,
            backfill?.storage_path ?? "",
        );
        assertE2EPath(backfillAudioPath);
        expect(existsSync(backfillAudioPath)).toBe(true);

        const sourceOnlyRow = page.locator(
            `[data-sot-recording-id="${sourceOnly?.id}"]`,
        );
        await expect(sourceOnlyRow).toBeVisible();
        await expect(sourceOnlyRow).toHaveClass(/(^|\s)row(\s|$)/);
        await sourceOnlyRow.click();
        await expect(sourceOnlyRow).toHaveClass(/(^|\s)active(\s|$)/);
        await expect(sourceOnlyRow.locator(".src-mini")).toBeVisible();
        await expect(
            page.getByRole("heading", { name: SOURCE_ONLY_TITLE }),
        ).toBeVisible();
        const dashboardPlayer = page.locator(
            '[data-sot-surface="dashboard-recording-player"]',
        );
        await expect(dashboardPlayer).toHaveAttribute(
            "data-sot-state",
            "disabled",
        );
        await expect(dashboardPlayer).toHaveAttribute(
            "data-no-audio",
            "true",
        );
        await expect(dashboardPlayer.locator("[data-no-audio-banner]"))
            .toContainText("来源仅同步转写与报告");
        await expect(
            page.locator('[data-sot-panel="dashboard-recording-player-controls"]'),
        ).toHaveAttribute("data-sot-state", "disabled");
        await expect(
            page.locator('[data-sot-control="dashboard-player-seek"]'),
        ).toHaveAttribute("data-sot-state", "disabled");
        await expect(
            page.locator('[data-sot-control="dashboard-player-seek"]'),
        ).toHaveAttribute("aria-disabled", "true");
        for (const control of [
            "dashboard-player-back",
            "dashboard-player-play",
            "dashboard-player-forward",
            "dashboard-player-speed",
            "dashboard-player-volume",
        ]) {
            await expect(
                page.locator(`[data-sot-control="${control}"]`),
            ).toHaveAttribute("data-sot-state", "disabled");
            await expect(
                page.locator(`[data-sot-control="${control}"]`),
            ).toBeDisabled();
        }
        await page.getByRole("tab", { name: "来源详情" }).click();
        await expect(dashboardSourceReport(page, "loaded")).toBeVisible();
        await expect(dashboardSourceReport(page, "loaded")).toContainText(
            "PR20 source-only summary",
        );
        await expect(
            dashboardSourceReport(page, "loaded").locator('[data-sot-badge="source-report-status"][data-sot-tone="warn"]'),
        ).toContainText("这条来源记录没有本地音频");
        await expect(
            page.locator('[data-sot-control="copy-source-transcript"]'),
        ).toHaveAttribute("data-sot-state", "ready");
        await expect(
            page.locator('[data-sot-control="copy-source-report"]'),
        ).toHaveAttribute("data-sot-state", "ready");
        await expect(
            page.locator('[data-sot-control="retranscribe-recording"]'),
        ).toHaveAttribute("data-sot-state", "unavailable");
    } finally {
        await plaudStub.close();
        await cleanupPlaudPr20Seeds(userId ?? undefined);
    }
});
