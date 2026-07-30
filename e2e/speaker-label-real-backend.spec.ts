import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

const PLAYWRIGHT_USER_EMAIL = "playwright-admin@example.com";
const RECORDING_PREFIX = "e2e-speaker-label-real-";
const WORKFLOW_RECORDING_ID = `${RECORDING_PREFIX}workflow`;
const RETRY_RECORDING_ID = `${RECORDING_PREFIX}retry`;
const PROFILE_PREFIX = "E2E Speaker Label ";
const MERGED_PROFILE_NAME = `${PROFILE_PREFIX}Merged`;
const RETRY_PROFILE_NAME = `${PROFILE_PREFIX}Retry`;
const E2E_ROOT_MARKER = ".betterainote-e2e-root";

function requireIsolatedE2ERoot() {
    const configuredRoot = process.env.PLAYWRIGHT_E2E_ROOT?.trim();
    if (!configuredRoot) {
        throw new Error(
            "Speaker label E2E requires PLAYWRIGHT_E2E_ROOT from scripts/e2e-setup.mjs",
        );
    }

    const root = path.resolve(configuredRoot);
    if (root === path.resolve(process.cwd())) {
        throw new Error(
            "Speaker label E2E requires a disposable root outside the worktree",
        );
    }
    return root;
}

const E2E_ROOT = requireIsolatedE2ERoot();
const E2E_DATA_DIR = path.join(E2E_ROOT, "data");

function assertMarkedDisposableE2ERoot() {
    if (!existsSync(path.join(E2E_ROOT, E2E_ROOT_MARKER))) {
        throw new Error(
            "Speaker label E2E requires scripts/e2e-setup.mjs to initialize its marked root",
        );
    }
}

function assertE2EDataPath(filePath: string) {
    const relativePath = path.relative(
        E2E_DATA_DIR,
        path.resolve(filePath),
    );
    if (
        relativePath.length === 0 ||
        relativePath === ".." ||
        relativePath.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relativePath)
    ) {
        throw new Error(`Refusing non-E2E database path: ${filePath}`);
    }
}

function resolveCoreDatabasePath() {
    const configuredPath = process.env.DATABASE_PATH?.trim();
    if (!configuredPath) {
        throw new Error(
            "Speaker label E2E requires DATABASE_PATH from scripts/e2e-setup.mjs",
        );
    }

    const databasePath = path.resolve(configuredPath);
    assertE2EDataPath(databasePath);
    return databasePath;
}

function deriveSiblingDatabasePath(databasePath: string, suffix: string) {
    const parsed = path.parse(databasePath);
    return path.resolve(
        parsed.dir,
        `${parsed.name}-${suffix}${parsed.ext || ".db"}`,
    );
}

function databaseUrl(filePath: string) {
    assertE2EDataPath(filePath);
    return pathToFileURL(filePath).href;
}

const CORE_DB = resolveCoreDatabasePath();
const LIBRARY_DB = deriveSiblingDatabasePath(CORE_DB, "library");
const TRANSCRIPTS_DB = deriveSiblingDatabasePath(CORE_DB, "transcripts");
const VOICEPRINTS_DB = deriveSiblingDatabasePath(CORE_DB, "voiceprints");

for (const databasePath of [
    CORE_DB,
    LIBRARY_DB,
    TRANSCRIPTS_DB,
    VOICEPRINTS_DB,
]) {
    assertE2EDataPath(databasePath);
}

function reportIsolatedDatabasePaths(testInfo: TestInfo) {
    console.info(
        [
            "Speaker label E2E isolated SQLite",
            `worker=${testInfo.workerIndex}`,
            `root=${E2E_ROOT}`,
            `core=${CORE_DB}`,
            `library=${LIBRARY_DB}`,
            `transcripts=${TRANSCRIPTS_DB}`,
            `voiceprints=${VOICEPRINTS_DB}`,
        ].join(" | "),
    );
}

function assertInitializedE2EDatabaseLayout() {
    for (const databasePath of [
        CORE_DB,
        LIBRARY_DB,
        TRANSCRIPTS_DB,
        VOICEPRINTS_DB,
    ]) {
        if (!existsSync(databasePath)) {
            throw new Error(
                `Speaker label E2E database was not initialized: ${databasePath}`,
            );
        }
    }
}

async function executeWithBusyRetry<T>(operation: () => Promise<T>) {
    const delays = [50, 100, 200, 400, 800];
    for (let attempt = 0; ; attempt += 1) {
        try {
            return await operation();
        } catch (error) {
            const delay = delays[attempt];
            const message =
                error instanceof Error ? error.message : String(error);
            if (
                delay == null ||
                !/SQLITE_BUSY|database is locked/i.test(message)
            ) {
                throw error;
            }
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }
}

async function getPlaywrightUserId() {
    const core = createClient({ url: databaseUrl(CORE_DB) });
    try {
        const result = await executeWithBusyRetry(() =>
            core.execute({
                sql: "SELECT id FROM users WHERE email = ? LIMIT 1",
                args: [PLAYWRIGHT_USER_EMAIL],
            }),
        );
        const userId = result.rows[0]?.id;
        if (typeof userId !== "string") {
            throw new Error("Playwright user not found");
        }
        return userId;
    } finally {
        await core.close();
    }
}

async function cleanupSpeakerLabelSeeds(userId: string) {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const transcripts = createClient({ url: databaseUrl(TRANSCRIPTS_DB) });
    const voiceprints = createClient({ url: databaseUrl(VOICEPRINTS_DB) });

    try {
        await executeWithBusyRetry(() =>
            voiceprints.execute({
                sql: "DELETE FROM recording_speakers WHERE user_id = ? AND recording_id LIKE ?",
                args: [userId, `${RECORDING_PREFIX}%`],
            }),
        );
        await executeWithBusyRetry(() =>
            voiceprints.execute({
                sql: "DELETE FROM speaker_profiles WHERE user_id = ? AND display_name LIKE ?",
                args: [userId, `${PROFILE_PREFIX}%`],
            }),
        );
        await executeWithBusyRetry(() =>
            transcripts.execute({
                sql: "DELETE FROM transcript_segments WHERE user_id = ? AND recording_id LIKE ?",
                args: [userId, `${RECORDING_PREFIX}%`],
            }),
        );
        await executeWithBusyRetry(() =>
            transcripts.execute({
                sql: "DELETE FROM transcriptions WHERE user_id = ? AND recording_id LIKE ?",
                args: [userId, `${RECORDING_PREFIX}%`],
            }),
        );
        await executeWithBusyRetry(() =>
            library.execute({
                sql: "DELETE FROM recordings WHERE user_id = ? AND id LIKE ?",
                args: [userId, `${RECORDING_PREFIX}%`],
            }),
        );
    } finally {
        await library.close();
        await transcripts.close();
        await voiceprints.close();
    }
}

async function seedSpeakerLabelRecording(
    userId: string,
    recordingId: string,
) {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const transcripts = createClient({ url: databaseUrl(TRANSCRIPTS_DB) });
    const voiceprints = createClient({ url: databaseUrl(VOICEPRINTS_DB) });
    const now = Date.now();
    const transcriptId = `${recordingId}-transcript`;

    try {
        await executeWithBusyRetry(() =>
            library.execute({
                sql: `
                    INSERT INTO recordings (
                        id, user_id, source_provider, source_recording_id, source_version,
                        source_metadata, provider_device_id, filename, duration, start_time,
                        end_time, filesize, file_md5, storage_type, storage_path,
                        downloaded_at, upstream_trashed, upstream_deleted, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                args: [
                    recordingId,
                    userId,
                    "manual",
                    `${recordingId}-source`,
                    "1",
                    "{}",
                    "e2e-speaker-label-device",
                    "E2E speaker label recording",
                    60_000,
                    now - 60_000,
                    now,
                    0,
                    `${recordingId}-md5`,
                    "local",
                    "",
                    null,
                    0,
                    0,
                    now,
                    now,
                ],
            }),
        );
        await executeWithBusyRetry(() =>
            transcripts.execute({
                sql: `
                    INSERT INTO transcriptions (
                        id, recording_id, user_id, text, detected_language,
                        transcription_type, provider, model, provider_job_id,
                        speaker_map, provider_payload, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                args: [
                    transcriptId,
                    recordingId,
                    userId,
                    "Speaker 1: First local statement.\nSpeaker 2: Second local statement.",
                    "en",
                    "server",
                    "local-e2e",
                    "local-e2e-model",
                    null,
                    "{}",
                    "{}",
                    now,
                ],
            }),
        );

        for (const [index, rawLabel] of ["Speaker 1", "Speaker 2"].entries()) {
            const startMs = 1_000 + index * 4_000;
            await executeWithBusyRetry(() =>
                voiceprints.execute({
                    sql: `
                        INSERT INTO recording_speakers (
                            id, user_id, recording_id, raw_label,
                            matched_profile_id, sample_segments, segment_count,
                            created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `,
                    args: [
                        `${recordingId}-speaker-${index + 1}`,
                        userId,
                        recordingId,
                        rawLabel,
                        null,
                        JSON.stringify([
                            {
                                startMs,
                                endMs: startMs + 2_000,
                                text: `${rawLabel} local sample`,
                            },
                        ]),
                        1,
                        now,
                        now,
                    ],
                }),
            );
        }
    } finally {
        await library.close();
        await transcripts.close();
        await voiceprints.close();
    }
}

async function holdVoiceprintsWriteLock() {
    const voiceprints = createClient({ url: databaseUrl(VOICEPRINTS_DB) });
    await voiceprints.execute("BEGIN IMMEDIATE");

    return async () => {
        try {
            await voiceprints.execute("ROLLBACK");
        } finally {
            await voiceprints.close();
        }
    };
}

async function readSpeakerPersistence(
    userId: string,
    recordingId: string,
) {
    const transcripts = createClient({ url: databaseUrl(TRANSCRIPTS_DB) });
    const voiceprints = createClient({ url: databaseUrl(VOICEPRINTS_DB) });

    try {
        const [profileResult, assignmentResult, transcriptionResult] =
            await Promise.all([
                executeWithBusyRetry(() =>
                    voiceprints.execute({
                        sql: `
                            SELECT id, display_name
                            FROM speaker_profiles
                            WHERE user_id = ? AND display_name LIKE ?
                            ORDER BY display_name
                        `,
                        args: [userId, `${PROFILE_PREFIX}%`],
                    }),
                ),
                executeWithBusyRetry(() =>
                    voiceprints.execute({
                        sql: `
                            SELECT raw_label, matched_profile_id
                            FROM recording_speakers
                            WHERE user_id = ? AND recording_id = ?
                            ORDER BY raw_label
                        `,
                        args: [userId, recordingId],
                    }),
                ),
                executeWithBusyRetry(() =>
                    transcripts.execute({
                        sql: `
                            SELECT speaker_map
                            FROM transcriptions
                            WHERE user_id = ? AND recording_id = ?
                            LIMIT 1
                        `,
                        args: [userId, recordingId],
                    }),
                ),
            ]);

        const speakerMapValue =
            transcriptionResult.rows[0]?.speaker_map ?? "{}";
        if (typeof speakerMapValue !== "string") {
            throw new Error("Expected SQLite speaker_map to be JSON text");
        }

        return {
            profiles: profileResult.rows.map((row) => ({
                id: String(row.id),
                displayName: String(row.display_name),
            })),
            assignments: assignmentResult.rows.map((row) => ({
                rawLabel: String(row.raw_label),
                matchedProfileId:
                    typeof row.matched_profile_id === "string"
                        ? row.matched_profile_id
                        : null,
            })),
            speakerMap: JSON.parse(speakerMapValue) as Record<string, string>,
        };
    } finally {
        await transcripts.close();
        await voiceprints.close();
    }
}

function speakerPanel(page: Page) {
    return page.locator(
        '[data-speaker-review-panel="speaker-review"][data-tab-pane="speakers"]',
    );
}

function speakerRow(page: Page, rawLabel: string) {
    return page.locator(
        `[data-speaker-review-item="speaker-review-row"][data-speaker-label="${rawLabel}"]`,
    );
}

async function openSpeakerEditor(page: Page, recordingId: string) {
    await page.goto(`/recordings/${recordingId}`, {
        waitUntil: "domcontentloaded",
    });
    await expect(
        page.locator('[data-surface="recording-workstation"]'),
    ).toHaveAttribute("data-state", "ready");
    await page.getByRole("tab", { name: "说话人标签", exact: true }).click();
    await expect(speakerPanel(page)).toHaveAttribute(
        "data-speaker-review-state",
        "ready",
    );
}

function waitForSpeakerPatch(
    page: Page,
    recordingId: string,
    expectedStatus: number,
) {
    return page.waitForResponse((response) => {
        const url = new URL(response.url());
        return (
            url.pathname === `/api/recordings/${recordingId}/speakers` &&
            response.request().method() === "PATCH" &&
            response.status() === expectedStatus
        );
    });
}

test.beforeEach(async ({}, testInfo) => {
    assertMarkedDisposableE2ERoot();
    assertInitializedE2EDatabaseLayout();
    reportIsolatedDatabasePaths(testInfo);
});

test("renames, saves, and merges speaker labels through the real backend", async ({
    page,
}) => {
    let userId: string | null = null;

    try {
        await ensureSignedIn(page);
        userId = await getPlaywrightUserId();
        await cleanupSpeakerLabelSeeds(userId);
        await seedSpeakerLabelRecording(userId, WORKFLOW_RECORDING_ID);
        await openSpeakerEditor(page, WORKFLOW_RECORDING_ID);

        await speakerPanel(page)
            .getByRole("button", { name: "合并相似…", exact: true })
            .click();
        const mergePopover = page.locator(
            '[data-speaker-review-panel="speaker-review-merge"]',
        );
        await expect(mergePopover).toBeVisible();
        await expect(mergePopover).toContainText(
            "当前没有可合并的相似说话人",
        );
        await mergePopover
            .getByRole("button", { name: "关闭", exact: true })
            .click();
        await expect(mergePopover).toHaveCount(0);

        const firstRow = speakerRow(page, "Speaker 1");
        await firstRow
            .getByRole("button", { name: "重命名", exact: true })
            .click();
        const renameInput = firstRow.getByRole("textbox", {
            name: "Speaker 1 重命名",
            exact: true,
        });
        await renameInput.fill(MERGED_PROFILE_NAME);

        const renameResponsePromise = waitForSpeakerPatch(
            page,
            WORKFLOW_RECORDING_ID,
            200,
        );
        await firstRow
            .getByRole("button", { name: "保存", exact: true })
            .click();
        const renameResponse = await renameResponsePromise;
        const renameBody = (await renameResponse.json()) as {
            success?: boolean;
            rawLabel?: string;
            profileId?: string | null;
        };
        expect(renameBody).toMatchObject({
            success: true,
            rawLabel: "Speaker 1",
        });
        expect(typeof renameBody.profileId).toBe("string");
        await expect(firstRow).toHaveAttribute("data-speaker-mapped", "true");
        await expect(firstRow).toContainText(MERGED_PROFILE_NAME);

        const secondRow = speakerRow(page, "Speaker 2");
        const mappingInput = secondRow.locator(
            '[data-speaker-review-control="speaker-review-mapping-input"]',
        );
        await mappingInput.fill(MERGED_PROFILE_NAME);
        const mergeResponsePromise = waitForSpeakerPatch(
            page,
            WORKFLOW_RECORDING_ID,
            200,
        );
        await secondRow
            .locator(
                '[data-speaker-review-control="speaker-review-suggestion"]',
            )
            .filter({ hasText: MERGED_PROFILE_NAME })
            .click();
        const mergeResponse = await mergeResponsePromise;
        const mergeBody = (await mergeResponse.json()) as {
            success?: boolean;
            rawLabel?: string;
            profileId?: string | null;
        };
        expect(mergeBody).toMatchObject({
            success: true,
            rawLabel: "Speaker 2",
            profileId: renameBody.profileId,
        });
        await expect(secondRow).toHaveAttribute(
            "data-speaker-mapped",
            "true",
        );
        await expect(secondRow).toContainText(MERGED_PROFILE_NAME);

        const speakersApiResponse = await page.request.get(
            `/api/recordings/${WORKFLOW_RECORDING_ID}/speakers`,
        );
        expect(speakersApiResponse.status()).toBe(200);
        const speakersApi = (await speakersApiResponse.json()) as {
            speakers?: Array<{
                rawLabel?: string;
                matchedProfileId?: string | null;
                matchedProfileName?: string | null;
            }>;
        };
        expect(speakersApi.speakers).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    rawLabel: "Speaker 1",
                    matchedProfileId: renameBody.profileId,
                    matchedProfileName: MERGED_PROFILE_NAME,
                }),
                expect.objectContaining({
                    rawLabel: "Speaker 2",
                    matchedProfileId: renameBody.profileId,
                    matchedProfileName: MERGED_PROFILE_NAME,
                }),
            ]),
        );

        const transcriptApiResponse = await page.request.get(
            `/api/recordings/${WORKFLOW_RECORDING_ID}/transcript/speakers`,
        );
        expect(transcriptApiResponse.status()).toBe(200);
        const transcriptApi = (await transcriptApiResponse.json()) as {
            speakerMap?: Record<string, string>;
            transcript?: { displayText?: string };
        };
        expect(transcriptApi.speakerMap).toEqual({
            "Speaker 1": MERGED_PROFILE_NAME,
            "Speaker 2": MERGED_PROFILE_NAME,
        });
        expect(transcriptApi.transcript?.displayText).toContain(
            `${MERGED_PROFILE_NAME}: First local statement.`,
        );
        expect(transcriptApi.transcript?.displayText).toContain(
            `${MERGED_PROFILE_NAME}: Second local statement.`,
        );

        const sqliteState = await readSpeakerPersistence(
            userId,
            WORKFLOW_RECORDING_ID,
        );
        expect(sqliteState.profiles).toEqual([
            {
                id: renameBody.profileId,
                displayName: MERGED_PROFILE_NAME,
            },
        ]);
        expect(sqliteState.assignments).toEqual([
            {
                rawLabel: "Speaker 1",
                matchedProfileId: renameBody.profileId,
            },
            {
                rawLabel: "Speaker 2",
                matchedProfileId: renameBody.profileId,
            },
        ]);
        expect(sqliteState.speakerMap).toEqual(transcriptApi.speakerMap);

        console.info(
            [
                "Speaker label workflow read-back",
                `PATCH(rename)=${renameResponse.status()}`,
                `PATCH(merge)=${mergeResponse.status()}`,
                `GET(speakers)=${speakersApiResponse.status()}`,
                `GET(transcript)=${transcriptApiResponse.status()}`,
                `profiles=${sqliteState.profiles.length}`,
                `assignments=${sqliteState.assignments.length}`,
                `speakerMapKeys=${Object.keys(sqliteState.speakerMap).length}`,
            ].join(" | "),
        );
    } finally {
        if (userId) {
            await cleanupSpeakerLabelSeeds(userId);
        }
    }
});

test("shows a real SQLite save failure and retries after the backend recovers", async ({
    page,
}) => {
    let userId: string | null = null;
    let releaseWriteLock: (() => Promise<void>) | null = null;

    try {
        await ensureSignedIn(page);
        userId = await getPlaywrightUserId();
        await cleanupSpeakerLabelSeeds(userId);
        await seedSpeakerLabelRecording(userId, RETRY_RECORDING_ID);
        await openSpeakerEditor(page, RETRY_RECORDING_ID);

        const firstRow = speakerRow(page, "Speaker 1");
        await firstRow
            .getByRole("button", { name: "重命名", exact: true })
            .click();
        await firstRow
            .getByRole("textbox", {
                name: "Speaker 1 重命名",
                exact: true,
            })
            .fill(RETRY_PROFILE_NAME);

        releaseWriteLock = await holdVoiceprintsWriteLock();
        const failureResponsePromise = waitForSpeakerPatch(
            page,
            RETRY_RECORDING_ID,
            500,
        );
        await firstRow
            .getByRole("button", { name: "保存", exact: true })
            .click();
        const failureResponse = await failureResponsePromise;
        expect(await failureResponse.json()).toEqual({
            error: "Failed to update recording speaker",
        });
        await expect(firstRow).toHaveAttribute("data-state", "error");
        await expect(firstRow).toContainText("保存失败 · 请重试");

        const failedSqliteState = await readSpeakerPersistence(
            userId,
            RETRY_RECORDING_ID,
        );
        expect(failedSqliteState.profiles).toEqual([]);
        expect(failedSqliteState.assignments).toEqual([
            { rawLabel: "Speaker 1", matchedProfileId: null },
            { rawLabel: "Speaker 2", matchedProfileId: null },
        ]);
        expect(failedSqliteState.speakerMap).toEqual({});

        await releaseWriteLock();
        releaseWriteLock = null;

        const retryResponsePromise = waitForSpeakerPatch(
            page,
            RETRY_RECORDING_ID,
            200,
        );
        await firstRow
            .getByRole("button", { name: "重试", exact: true })
            .click();
        const retryResponse = await retryResponsePromise;
        const retryBody = (await retryResponse.json()) as {
            success?: boolean;
            rawLabel?: string;
            profileId?: string | null;
        };
        expect(retryBody).toMatchObject({
            success: true,
            rawLabel: "Speaker 1",
        });
        expect(typeof retryBody.profileId).toBe("string");
        await expect(firstRow).toHaveAttribute("data-speaker-mapped", "true");
        await expect(firstRow).toContainText(RETRY_PROFILE_NAME);

        const speakersApiResponse = await page.request.get(
            `/api/recordings/${RETRY_RECORDING_ID}/speakers`,
        );
        expect(speakersApiResponse.status()).toBe(200);
        const speakersApi = (await speakersApiResponse.json()) as {
            speakers?: Array<{
                rawLabel?: string;
                matchedProfileId?: string | null;
                matchedProfileName?: string | null;
            }>;
        };
        expect(speakersApi.speakers).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    rawLabel: "Speaker 1",
                    matchedProfileId: retryBody.profileId,
                    matchedProfileName: RETRY_PROFILE_NAME,
                }),
            ]),
        );

        const recoveredSqliteState = await readSpeakerPersistence(
            userId,
            RETRY_RECORDING_ID,
        );
        expect(recoveredSqliteState.profiles).toEqual([
            {
                id: retryBody.profileId,
                displayName: RETRY_PROFILE_NAME,
            },
        ]);
        expect(recoveredSqliteState.assignments).toEqual([
            {
                rawLabel: "Speaker 1",
                matchedProfileId: retryBody.profileId,
            },
            { rawLabel: "Speaker 2", matchedProfileId: null },
        ]);
        expect(recoveredSqliteState.speakerMap).toEqual({
            "Speaker 1": RETRY_PROFILE_NAME,
        });

        console.info(
            [
                "Speaker label retry read-back",
                `PATCH(failure)=${failureResponse.status()}`,
                `PATCH(retry)=${retryResponse.status()}`,
                `GET(speakers)=${speakersApiResponse.status()}`,
                `profiles=${recoveredSqliteState.profiles.length}`,
                `assignments=${recoveredSqliteState.assignments.length}`,
                `speakerMapKeys=${Object.keys(recoveredSqliteState.speakerMap).length}`,
            ].join(" | "),
        );
    } finally {
        if (releaseWriteLock) {
            await releaseWriteLock();
        }
        if (userId) {
            await cleanupSpeakerLabelSeeds(userId);
        }
    }
});
