import path from "node:path";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import {
    expect,
    type Locator,
    type Page,
    test,
    type TestInfo,
} from "@playwright/test";
import { ensureSignedIn, putJsonWithRetry } from "./helpers/auth";
import {
    SOT_COMPONENT_LIBRARY_URL,
    SOT_SOURCE_ASSET_DIR,
    SOT_WORKSTATION_URL,
} from "./helpers/sot-fixtures";

const E2E_DATA_DIR = path.resolve(process.cwd(), "tmp/e2e/data");
const LIST_RECORDING_PREFIX = "e2e-list-state-";

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

function databaseUrl(filePath: string) {
    assertE2EDatabasePath(filePath);
    return pathToFileURL(filePath).href;
}

const CORE_DB = resolveDatabasePath();
const LIBRARY_DB = deriveSiblingDatabasePath(CORE_DB, "library");
const TRANSCRIPTS_DB = deriveSiblingDatabasePath(CORE_DB, "transcripts");
const SOT_PIXEL_DEV_OVERLAY_HIDDEN_CSS = `
    nextjs-portal,
    [data-nextjs-toast],
    [data-nextjs-dialog-overlay],
    [data-nextjs-dialog-backdrop],
    [data-nextjs-dialog],
    [data-nextjs-errors],
    [data-nextjs-dev-tools-button],
    button[aria-label="Open Next.js Dev Tools"],
    .__nextjs-dev-overlay {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
    }
`;
const SOT_PIXEL_DEV_OVERLAY_STYLE_ATTR = "data-sot-pixel-dev-overlay-fixture";
const LIST_ROW_SOT_STATES = [
    "active-updated",
    "transcribing",
    "updated",
    "local-only",
    "failed",
    "pending",
] as const;
const LIST_ROW_SELECTORS: Record<ListRowSotState, string> = {
    "active-updated": '.real-list .row[data-rec="rec-product-weekly"]',
    failed: '.real-list .row[data-rec="rec-eng-handover"]',
    "local-only": '.real-list .row[data-rec="rec-cs-training"]',
    pending: '.real-list .row[data-rec="rec-market-0410"]',
    transcribing: '.real-list .row[data-rec="rec-wenli-1on1"]',
    updated: '.real-list .row[data-rec="rec-investor-0418"]',
};
const LIST_ROW_SOURCE_ASSETS: Record<string, string> = {
    "../../assets/sources/dingtalk.svg": "dingtalk.svg",
    "../../assets/sources/feishu.jpeg": "feishu.jpeg",
    "../../assets/sources/plaud.png": "plaud.png",
    "../../assets/sources/ticnote.png": "ticnote.png",
};
const TAG_FILTER_TRIGGER_SOT_STATES = ["all", "single", "untagged"] as const;
const TAG_FILTER_TRIGGER_LABELS: Record<TagFilterTriggerSotState, string> = {
    all: "Trigger · all",
    single: "Trigger · single tag",
    untagged: "Trigger · untagged",
};
const LIST_STATE_BLOCK_SOT_STATES = [
    "empty",
    "no-match",
    "timeline-empty",
    "tag-empty",
    "paginated",
    "paginated-first",
    "paginated-last",
] as const;
const SOT_TAG_COLOR_MATRIX = [
    { color: "purple", className: "utag c-violet" },
    { color: "blue", className: "utag c-blue" },
    { color: "red", className: "utag c-rose" },
    { color: "orange", className: "utag c-amber" },
    { color: "green", className: "utag c-green" },
] as const;
const SOT_TAG_ICON_MATRIX = [
    "grid",
    "user",
    "heart",
    "clock",
    "tag",
    "star",
    "dialog",
    "flag",
    "book",
    "bulb",
    "file",
    "mic",
] as const;
const LIST_ROW_STYLE_PROPS = [
    "display",
    "align-items",
    "gap",
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
    "border-top-width",
    "border-top-style",
    "border-top-color",
    "border-radius",
    "background-color",
    "color",
    "box-shadow",
    "outline-width",
    "outline-style",
    "outline-color",
    "outline-offset",
] as const;
const LIST_BADGE_STYLE_PROPS = [
    "display",
    "align-items",
    "gap",
    "height",
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
    "border-radius",
    "background-color",
    "color",
    "font-family",
    "font-size",
    "font-weight",
    "line-height",
    "border-top-width",
    "border-top-style",
    "border-top-color",
] as const;
const LIST_TAG_STYLE_PROPS = [
    "display",
    "align-items",
    "gap",
    "height",
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
    "border-radius",
    "background-color",
    "color",
    "font-family",
    "font-size",
    "font-weight",
    "box-shadow",
    "border-top-width",
    "border-top-style",
    "border-top-color",
] as const;

type ListStyleProp =
    | (typeof LIST_ROW_STYLE_PROPS)[number]
    | (typeof LIST_BADGE_STYLE_PROPS)[number]
    | (typeof LIST_TAG_STYLE_PROPS)[number];
type ListRowSotState = (typeof LIST_ROW_SOT_STATES)[number];
type TagFilterTriggerSotState = (typeof TAG_FILTER_TRIGGER_SOT_STATES)[number];
type ListStateBlockSotState = (typeof LIST_STATE_BLOCK_SOT_STATES)[number];
type SotTagIcon = (typeof SOT_TAG_ICON_MATRIX)[number];
type SvgChildSignature = Array<{
    attributes: Array<readonly [string, string]>;
    tagName: string;
}>;
type ListRowPixelDiff = {
    bounds: {
        maxX: number;
        maxY: number;
        minX: number;
        minY: number;
    } | null;
    differingPixels: number;
    dimensionsMatch: boolean;
    expectedHeight: number;
    expectedWidth: number;
    maxChannelDelta: number;
    productHeight: number;
    productWidth: number;
};

function assertE2EDatabasePath(filePath: string) {
    const e2eRoot = path.resolve(
        process.env.PLAYWRIGHT_E2E_ROOT ??
            path.join(process.cwd(), "tmp/e2e"),
    );
    const resolvedPath = path.resolve(filePath);

    if (
        resolvedPath !== e2eRoot &&
        !resolvedPath.startsWith(`${e2eRoot}${path.sep}`)
    ) {
        throw new Error(
            `Refusing to touch non-E2E database path: ${resolvedPath}`,
        );
    }
}

async function getPlaywrightUserId() {
    const client = createClient({ url: databaseUrl(CORE_DB) });
    try {
        const result = await client.execute({
            sql: "SELECT id FROM `users` WHERE email = ? LIMIT 1",
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

async function cleanupListSeeds(userId: string) {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const transcripts = createClient({ url: databaseUrl(TRANSCRIPTS_DB) });

    try {
        await transcripts.execute({
            sql: "DELETE FROM source_artifact_segments WHERE user_id = ? AND recording_id LIKE ?",
            args: [userId, `${LIST_RECORDING_PREFIX}%`],
        });
        await transcripts.execute({
            sql: "DELETE FROM transcript_segments WHERE user_id = ? AND recording_id LIKE ?",
            args: [userId, `${LIST_RECORDING_PREFIX}%`],
        });
        await transcripts.execute({
            sql: "DELETE FROM source_artifacts WHERE user_id = ? AND recording_id LIKE ?",
            args: [userId, `${LIST_RECORDING_PREFIX}%`],
        });
        await transcripts.execute({
            sql: "DELETE FROM transcriptions WHERE user_id = ? AND recording_id LIKE ?",
            args: [userId, `${LIST_RECORDING_PREFIX}%`],
        });
        await library.execute({
            sql: "DELETE FROM transcription_jobs WHERE user_id = ? AND recording_id LIKE ?",
            args: [userId, `${LIST_RECORDING_PREFIX}%`],
        });
        await library.execute({
            sql: "DELETE FROM recording_tag_assignments WHERE user_id = ? AND recording_id LIKE ?",
            args: [userId, `${LIST_RECORDING_PREFIX}%`],
        });
        await library.execute({
            sql: "DELETE FROM recording_tags WHERE user_id = ? AND id LIKE ?",
            args: [userId, `${LIST_RECORDING_PREFIX}tag-%`],
        });
        await library.execute({
            sql: "DELETE FROM recordings WHERE user_id = ? AND id LIKE ?",
            args: [userId, `${LIST_RECORDING_PREFIX}%`],
        });
    } finally {
        await library.close();
        await transcripts.close();
    }
}

async function cleanupAllUserRecordings(userId: string) {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const transcripts = createClient({ url: databaseUrl(TRANSCRIPTS_DB) });

    try {
        await transcripts.execute({
            sql: "DELETE FROM source_artifact_segments WHERE user_id = ?",
            args: [userId],
        });
        await transcripts.execute({
            sql: "DELETE FROM transcript_segments WHERE user_id = ?",
            args: [userId],
        });
        await transcripts.execute({
            sql: "DELETE FROM source_artifacts WHERE user_id = ?",
            args: [userId],
        });
        await transcripts.execute({
            sql: "DELETE FROM transcriptions WHERE user_id = ?",
            args: [userId],
        });
        await library.execute({
            sql: "DELETE FROM transcription_jobs WHERE user_id = ?",
            args: [userId],
        });
        await library.execute({
            sql: "DELETE FROM recording_tag_assignments WHERE user_id = ?",
            args: [userId],
        });
        await library.execute({
            sql: "DELETE FROM recording_tags WHERE user_id = ? AND id LIKE ?",
            args: [userId, `${LIST_RECORDING_PREFIX}tag-%`],
        });
        await library.execute({
            sql: "DELETE FROM recordings WHERE user_id = ?",
            args: [userId],
        });
        await library.execute({
            sql: "DELETE FROM source_devices WHERE user_id = ?",
            args: [userId],
        });
    } finally {
        await library.close();
        await transcripts.close();
    }
}

async function seedListRecordings(userId: string, count = 10) {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const now = Date.now();

    try {
        await cleanupListSeeds(userId);
        for (let index = 0; index < count; index += 1) {
            const suffix = String(index + 1).padStart(2, "0");
            const recordingId = `${LIST_RECORDING_PREFIX}${suffix}`;
            const start = now - index * 90_000;

            await library.execute({
                sql: `
                    INSERT OR REPLACE INTO recordings (
                        id, user_id, source_provider, source_recording_id, source_version,
                        source_metadata, provider_device_id, filename, duration, start_time,
                        end_time, filesize, file_md5, storage_type, storage_path,
                        downloaded_at, upstream_trashed, upstream_deleted, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                args: [
                    recordingId,
                    userId,
                    "ticnote",
                    `${recordingId}-source`,
                    "1",
                    "{}",
                    "e2e-list-device",
                    `E2E list pagination ${suffix}`,
                    120_000 + index * 1000,
                    start,
                    start + 120_000,
                    2048 + index,
                    recordingId,
                    "local",
                    "",
                    now,
                    0,
                    0,
                    now,
                    now,
                ],
            });
        }
    } finally {
        await library.close();
    }
}

async function seedMultiTagRecordings(userId: string) {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const now = Date.now();
    const recordingId = `${LIST_RECORDING_PREFIX}multi-tag`;
    const alphaTagId = `${LIST_RECORDING_PREFIX}tag-alpha`;
    const betaTagId = `${LIST_RECORDING_PREFIX}tag-beta`;

    try {
        await cleanupListSeeds(userId);
        await library.batch([
            {
                sql: `
                    INSERT OR REPLACE INTO recordings (
                        id, user_id, source_provider, source_recording_id, source_version,
                        source_metadata, provider_device_id, filename, duration, start_time,
                        end_time, filesize, file_md5, storage_type, storage_path,
                        downloaded_at, upstream_trashed, upstream_deleted, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                args: [
                    recordingId,
                    userId,
                    "ticnote",
                    `${recordingId}-source`,
                    "1",
                    "{}",
                    "e2e-list-device",
                    "E2E multi tag recording",
                    120_000,
                    now,
                    now + 120_000,
                    2048,
                    recordingId,
                    "local",
                    "",
                    now,
                    0,
                    0,
                    now,
                    now,
                ],
            },
            {
                sql: `
                    INSERT OR REPLACE INTO recording_tags (
                        id, user_id, name, color, icon, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?)
                `,
                args: [
                    alphaTagId,
                    userId,
                    "Alpha",
                    "blue",
                    "tag",
                    now,
                    now,
                    betaTagId,
                    userId,
                    "Beta",
                    "purple",
                    "star",
                    now,
                    now,
                ],
            },
            {
                sql: `
                    INSERT OR REPLACE INTO recording_tag_assignments (
                        id, user_id, recording_id, tag_id, created_at
                    ) VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)
                `,
                args: [
                    `${recordingId}-alpha`,
                    userId,
                    recordingId,
                    alphaTagId,
                    now,
                    `${recordingId}-beta`,
                    userId,
                    recordingId,
                    betaTagId,
                    now,
                ],
            },
        ]);
    } finally {
        await library.close();
    }
}

async function seedTagMatrixRecordings(userId: string) {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const now = Date.now();

    try {
        await cleanupListSeeds(userId);
        const statements = SOT_TAG_ICON_MATRIX.flatMap((icon, index) => {
            const suffix = String(index + 1).padStart(2, "0");
            const recordingId = `${LIST_RECORDING_PREFIX}tag-matrix-${suffix}`;
            const tagId = `${LIST_RECORDING_PREFIX}tag-matrix-tag-${suffix}`;
            const color =
                SOT_TAG_COLOR_MATRIX[index % SOT_TAG_COLOR_MATRIX.length]
                    .color;
            const start = now - index * 90_000;

            return [
                {
                    sql: `
                        INSERT OR REPLACE INTO recordings (
                            id, user_id, source_provider, source_recording_id, source_version,
                            source_metadata, provider_device_id, filename, duration, start_time,
                            end_time, filesize, file_md5, storage_type, storage_path,
                            downloaded_at, upstream_trashed, upstream_deleted, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `,
                    args: [
                        recordingId,
                        userId,
                        "ticnote",
                        `${recordingId}-source`,
                        "1",
                        "{}",
                        "e2e-list-device",
                        `E2E SOT tag ${icon}`,
                        120_000 + index * 1000,
                        start,
                        start + 120_000,
                        2048 + index,
                        recordingId,
                        "local",
                        "",
                        now,
                        0,
                        0,
                        now,
                        now,
                    ],
                },
                {
                    sql: `
                        INSERT OR REPLACE INTO recording_tags (
                            id, user_id, name, color, icon, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    `,
                    args: [
                        tagId,
                        userId,
                        `SOT ${icon}`,
                        color,
                        icon,
                        now,
                        now,
                    ],
                },
                {
                    sql: `
                        INSERT OR REPLACE INTO recording_tag_assignments (
                            id, user_id, recording_id, tag_id, created_at
                        ) VALUES (?, ?, ?, ?, ?)
                    `,
                    args: [
                        `${recordingId}-assignment`,
                        userId,
                        recordingId,
                        tagId,
                        now,
                    ],
                },
            ];
        });

        await library.batch(statements);
    } finally {
        await library.close();
    }
}

async function seedRowStatusRecordings(userId: string) {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const transcripts = createClient({ url: databaseUrl(TRANSCRIPTS_DB) });
    const now = Date.now();
    const rows = [
        {
            id: `${LIST_RECORDING_PREFIX}row-updated`,
            filename: "E2E row status updated",
            sourceProvider: "dingtalk-a1",
            upstreamDeleted: 0,
        },
        {
            id: `${LIST_RECORDING_PREFIX}row-transcribing`,
            filename: "E2E row status transcribing",
            sourceProvider: "ticnote",
            upstreamDeleted: 0,
        },
        {
            id: `${LIST_RECORDING_PREFIX}row-failed`,
            filename: "E2E row status failed",
            sourceProvider: "dingtalk-a1",
            upstreamDeleted: 0,
        },
        {
            id: `${LIST_RECORDING_PREFIX}row-local-only`,
            filename: "E2E row status local only",
            sourceProvider: "ticnote",
            upstreamDeleted: 1,
        },
        {
            id: `${LIST_RECORDING_PREFIX}row-pending`,
            filename: "E2E row status pending",
            sourceProvider: "iflyrec",
            upstreamDeleted: 0,
        },
    ];

    try {
        await cleanupListSeeds(userId);
        for (const [index, row] of rows.entries()) {
            const start = now - index * 60_000;
            await library.execute({
                sql: `
                    INSERT OR REPLACE INTO recordings (
                        id, user_id, source_provider, source_recording_id, source_version,
                        source_metadata, provider_device_id, filename, duration, start_time,
                        end_time, filesize, file_md5, storage_type, storage_path,
                        downloaded_at, upstream_trashed, upstream_deleted, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                args: [
                    row.id,
                    userId,
                    row.sourceProvider,
                    `${row.id}-source`,
                    "1",
                    "{}",
                    "e2e-row-status-device",
                    row.filename,
                    180_000 + index * 1000,
                    start,
                    start + 180_000,
                    4096 + index,
                    row.id,
                    "local",
                    "",
                    now,
                    0,
                    row.upstreamDeleted,
                    now,
                    now,
                ],
            });
        }

        await library.batch([
            {
                sql: `
                    INSERT OR REPLACE INTO recording_tags (
                        id, user_id, name, color, icon, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                `,
                args: [
                    `${LIST_RECORDING_PREFIX}tag-row-style`,
                    userId,
                    "Style",
                    "blue",
                    "tag",
                    now,
                    now,
                ],
            },
            {
                sql: `
                    INSERT OR REPLACE INTO recording_tag_assignments (
                        id, user_id, recording_id, tag_id, created_at
                    ) VALUES (?, ?, ?, ?, ?)
                `,
                args: [
                    `${LIST_RECORDING_PREFIX}row-style-assignment`,
                    userId,
                    `${LIST_RECORDING_PREFIX}row-updated`,
                    `${LIST_RECORDING_PREFIX}tag-row-style`,
                    now,
                ],
            },
        ]);

        await library.batch([
            {
                sql: `
                    INSERT OR REPLACE INTO transcription_jobs (
                        id, user_id, recording_id, status, force, provider, model,
                        provider_job_id, remote_status, attempts, last_error,
                        requested_at, started_at, completed_at, next_poll_at,
                        created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                args: [
                    `${LIST_RECORDING_PREFIX}job-transcribing`,
                    userId,
                    `${LIST_RECORDING_PREFIX}row-transcribing`,
                    "processing",
                    0,
                    "voice-transcribe",
                    "e2e",
                    "remote-row-transcribing",
                    "transcribing",
                    1,
                    null,
                    now - 60_000,
                    now - 55_000,
                    null,
                    now + 300_000,
                    now - 60_000,
                    now,
                ],
            },
            {
                sql: `
                    INSERT OR REPLACE INTO transcription_jobs (
                        id, user_id, recording_id, status, force, provider, model,
                        provider_job_id, remote_status, attempts, last_error,
                        requested_at, started_at, completed_at, next_poll_at,
                        created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                args: [
                    `${LIST_RECORDING_PREFIX}job-failed`,
                    userId,
                    `${LIST_RECORDING_PREFIX}row-failed`,
                    "failed",
                    0,
                    "voice-transcribe",
                    "e2e",
                    "remote-row-failed",
                    "failed",
                    1,
                    "row status failed",
                    now - 60_000,
                    now - 55_000,
                    now - 30_000,
                    null,
                    now - 60_000,
                    now,
                ],
            },
        ]);

        await transcripts.execute({
            sql: `
                INSERT OR REPLACE INTO transcriptions (
                    id, recording_id, user_id, text, detected_language,
                    transcription_type, provider, model, provider_job_id,
                    speaker_map, provider_payload, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            args: [
                `${LIST_RECORDING_PREFIX}transcript-updated`,
                `${LIST_RECORDING_PREFIX}row-updated`,
                userId,
                "这条录音已有转写。",
                "zh",
                "server",
                "voice-transcribe",
                "e2e",
                "remote-row-updated",
                "{}",
                "{}",
                now,
            ],
        });
    } finally {
        await library.close();
        await transcripts.close();
    }
}

async function seedTimelineFilterRecordings(userId: string) {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const now = Date.now();
    const localToday = new Date();
    localToday.setHours(0, 0, 0, 0);
    const todayStart = Math.max(localToday.getTime(), now - 30 * 60_000);
    const earlierStart = localToday.getTime() - 12 * 86_400_000;

    try {
        await cleanupListSeeds(userId);
        for (const recording of [
            {
                id: `${LIST_RECORDING_PREFIX}today-ticnote`,
                filename: "E2E timeline today TicNote",
                sourceProvider: "ticnote",
                start: todayStart,
            },
            {
                id: `${LIST_RECORDING_PREFIX}earlier-plaud`,
                filename: "E2E timeline earlier Plaud",
                sourceProvider: "plaud",
                start: earlierStart,
            },
        ]) {
            await library.execute({
                sql: `
                    INSERT OR REPLACE INTO recordings (
                        id, user_id, source_provider, source_recording_id, source_version,
                        source_metadata, provider_device_id, filename, duration, start_time,
                        end_time, filesize, file_md5, storage_type, storage_path,
                        downloaded_at, upstream_trashed, upstream_deleted, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                args: [
                    recording.id,
                    userId,
                    recording.sourceProvider,
                    `${recording.id}-source`,
                    "1",
                    "{}",
                    "e2e-list-device",
                    recording.filename,
                    120_000,
                    recording.start,
                    recording.start + 120_000,
                    2048,
                    recording.id,
                    "local",
                    "",
                    now,
                    0,
                    0,
                    now,
                    now,
                ],
            });
        }
    } finally {
        await library.close();
    }
}

async function resetDisplay(
    page: Page,
    options: {
        itemsPerPage?: number;
        theme?: "system" | "light" | "dark";
        uiLanguage?: "zh-CN" | "en";
    } = {},
) {
    const resetResponse = await putJsonWithRetry(page, "/api/settings/display", {
        dateTimeFormat: "relative",
        itemsPerPage: options.itemsPerPage ?? 50,
        recordingListSortOrder: "newest",
        theme: options.theme ?? "dark",
        uiLanguage: options.uiLanguage ?? "zh-CN",
    });
    expect(resetResponse.ok()).toBe(true);
}

async function mockConnectedDataSources(page: Page) {
    await page.route("**/api/data-sources", async (route) => {
        if (route.request().method() !== "GET") {
            await route.continue();
            return;
        }

        const capabilities = {
            audioDownload: true,
            localRename: true,
            officialSummary: true,
            officialTranscript: true,
            privateTranscribe: true,
            upstreamTitleWriteback: false,
            workerSync: true,
        };
        const labels: Record<string, string> = {
            "dingtalk-a1": "钉钉",
            "feishu-minutes": "飞书妙记",
            iflyrec: "讯飞听见",
            plaud: "Plaud",
            ticnote: "TicNote",
        };
        const connectedProviders = new Set(["ticnote", "plaud"]);

        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({
                sources: [
                    "dingtalk-a1",
                    "ticnote",
                    "plaud",
                    "feishu-minutes",
                    "iflyrec",
                ].map((provider) => ({
                    authMode: "bearer",
                    authModes: ["bearer"],
                    baseUrl: "https://example.invalid",
                    capabilities,
                    config: {},
                    connected: connectedProviders.has(provider),
                    connectionStatus: "ready",
                    displayName: labels[provider] ?? provider,
                    enabled: connectedProviders.has(provider),
                    lastSync: null,
                    provider,
                    runtimeStatus: "active",
                    secretsConfigured: connectedProviders.has(provider)
                        ? { bearerToken: true }
                        : {},
                })),
            }),
        });
    });
}

async function expectNoTweaksLeak(page: Page) {
    await expect(page.locator("#tweaks-panel")).toHaveCount(0);
    await expect(page.locator(".tw-scroll")).toHaveCount(0);
    await expect(page.locator(".ds-only-mark, .ds-only-badge")).toHaveCount(0);
    await expect(page.locator('[data-sot-control="ds-only-tweaks"]')).toHaveCount(
        0,
    );
    await expect(page.getByText("Tweaks", { exact: true })).toHaveCount(0);
    await expect(page.getByText("调试", { exact: true })).toHaveCount(0);
}

function recordingListPanel(page: Page) {
    return page.locator('[data-sot-surface="dashboard-recording-list"]');
}

function sotControl(page: Page, name: string) {
    return page.locator(`[data-sot-control="${name}"]`);
}

function recordingRow(page: Page, id: string) {
    return page.locator(`[data-sot-recording-id="${id}"]`);
}

function seededRecordingRows(panel: Locator) {
    return panel.locator(
        '[data-sot-control="dashboard-recording-row"][data-sot-recording-id^="e2e-list-state-"]',
    );
}

function listStateBlock(panel: Locator, state: string) {
    return panel.locator(
        `[data-sot-part="recording-list-state"][data-sot-state="${state}"]`,
    );
}

function sourceProvider(page: Page, provider: string) {
    return page.locator(
        `[data-sot-control="dashboard-source-provider"][data-sot-provider="${provider}"]`,
    );
}

async function openSotComponentLibrary(page: Page) {
    await page.goto(SOT_COMPONENT_LIBRARY_URL, { waitUntil: "load" });
    await page.evaluate(() => {
        document.documentElement.dataset.theme = "dark";
    });
}

async function openSotWorkstation(page: Page) {
    await page.goto(SOT_WORKSTATION_URL, { waitUntil: "load" });
    await page.evaluate(() => {
        document.documentElement.dataset.theme = "dark";
        document.body.removeAttribute("data-time-style");
    });
}

async function readSotComponentTagIconSignatures(page: Page) {
    await openSotComponentLibrary(page);
    const buttons = page.locator(
        '#tagmgr .cl-card:has-text("Create") .tagm-icon-grid .tg-pick',
    );
    await expect(buttons).toHaveCount(SOT_TAG_ICON_MATRIX.length);

    return buttons.evaluateAll((buttons, icons) => {
        const svgSignature = (svg: SVGElement | null) =>
            Array.from(svg?.children ?? []).map((child) => ({
                attributes: Array.from(child.attributes).map((attribute) => [
                    attribute.name,
                    attribute.value,
                ]),
                tagName: child.tagName.toLowerCase(),
            }));

        return Object.fromEntries(
            buttons.map((button, index) => [
                icons[index] ?? "",
                svgSignature(button.querySelector("svg")),
            ]),
        );
    }, SOT_TAG_ICON_MATRIX) as Promise<Record<SotTagIcon, SvgChildSignature>>;
}

async function readSvgChildSignature(locator: Locator) {
    return locator.locator("svg").first().evaluate((svg) =>
        Array.from(svg.children).map((child) => ({
            attributes: Array.from(child.attributes).map((attribute) => [
                attribute.name,
                attribute.value,
            ]),
            tagName: child.tagName.toLowerCase(),
        })),
    ) as Promise<SvgChildSignature>;
}

function sourceAssetMime(fileName: string) {
    if (fileName.endsWith(".svg")) return "image/svg+xml";
    if (fileName.endsWith(".jpeg") || fileName.endsWith(".jpg")) {
        return "image/jpeg";
    }
    if (fileName.endsWith(".png")) return "image/png";
    throw new Error(`Unsupported SOT source asset type: ${fileName}`);
}

async function readListRowSourceAssetDataUrls() {
    const entries = await Promise.all(
        Object.entries(LIST_ROW_SOURCE_ASSETS).map(async ([src, fileName]) => {
            const bytes = await readFile(path.join(SOT_SOURCE_ASSET_DIR, fileName));
            return [
                src,
                `data:${sourceAssetMime(fileName)};base64,${bytes.toString(
                    "base64",
                )}`,
            ] as const;
        }),
    );

    return Object.fromEntries(entries) as Record<string, string>;
}

async function readSotListRowHtml(page: Page) {
    const entries = await Promise.all(
        LIST_ROW_SOT_STATES.map(async (state) => [
            state,
            await page
                .locator(LIST_ROW_SELECTORS[state])
                .first()
                .evaluate((element) => element.outerHTML),
        ]),
    );

    return Object.fromEntries(entries) as Record<ListRowSotState, string>;
}

async function readSotListSkeletonHtml(page: Page) {
    return page
        .locator(".skel-list")
        .first()
        .evaluate((element) => element.outerHTML);
}

async function readSotTagFilterTriggerHtml(page: Page) {
    const entries = await Promise.all(
        TAG_FILTER_TRIGGER_SOT_STATES.map(async (state) => {
            const card = page.locator("#tagsel .cl-card").filter({
                hasText: TAG_FILTER_TRIGGER_LABELS[state],
            });
            return [
                state,
                await card
                    .locator(".tag-filter-trigger")
                    .first()
                    .evaluate((element) => element.outerHTML),
            ] as const;
        }),
    );

    return Object.fromEntries(entries) as Record<
        TagFilterTriggerSotState,
        string
    >;
}

async function readSotOpenTagFilterHtml(page: Page) {
    await page.evaluate(() => {
        const filter = document.querySelector<HTMLElement>(
            '[data-list-filter-row="tags"]',
        );
        const trigger = document.querySelector<HTMLElement>(
            "[data-tag-filter-trigger]",
        );
        const list = document.querySelector<HTMLElement>(
            "[data-tag-filter-list]",
        );

        filter?.removeAttribute("hidden");
        trigger?.setAttribute("aria-expanded", "true");
        list?.removeAttribute("hidden");
    });
    await expect(
        page.locator("[data-tag-filter-list] .tag-filter-option"),
    ).toHaveCount(7);

    return page
        .locator('[data-list-filter-row="tags"]')
        .first()
        .evaluate((element) => element.outerHTML);
}

async function readSotListStateBlockHtml(page: Page) {
    const entries: Array<readonly [ListStateBlockSotState, string]> = [];

    for (const state of LIST_STATE_BLOCK_SOT_STATES) {
        await page.evaluate((targetState) => {
            document
                .querySelector<HTMLButtonElement>(
                    `.tw-list-grid button[data-list-state="${targetState}"]`,
                )
                ?.click();
        }, state);
        const block = page.locator(`[data-list-state-block="${state}"]`).first();
        await expect(block).toBeVisible();
        entries.push([
            state,
            await block.evaluate((element) => element.outerHTML),
        ] as const);
    }

    return Object.fromEntries(entries) as Record<ListStateBlockSotState, string>;
}

async function readSotListPanelHtml(page: Page) {
    await page.evaluate(() => {
        document
            .querySelectorAll(".list-panel .stack-banner, .list-panel [hidden]")
            .forEach((element) => element.remove());
    });
    return page
        .locator(".list-panel")
        .first()
        .evaluate((element) => element.outerHTML);
}

async function waitForListRowFixtureImages(page: Page, fixtureId: string) {
    await page.locator(`#${fixtureId} img`).evaluateAll((images) =>
        Promise.all(
            images.map(
                (image) =>
                    image.complete ||
                    new Promise<void>((resolve, reject) => {
                        image.addEventListener("load", () => resolve(), {
                            once: true,
                        });
                        image.addEventListener(
                            "error",
                            () =>
                                reject(
                                    new Error(
                                        `Failed to load fixture image ${image.getAttribute(
                                            "src",
                                        )}`,
                                    ),
                                ),
                            { once: true },
                        );
                    }),
            ),
        ),
    );
}

async function installSotPixelDevOverlaySuppression(
    page: Page,
    fixtureId: string,
) {
    await page.evaluate(
        ({ attribute, css, id }) => {
            const selector = [
                "nextjs-portal",
                "[data-nextjs-toast]",
                "[data-nextjs-dialog-overlay]",
                "[data-nextjs-dialog-backdrop]",
                "[data-nextjs-dialog]",
                "[data-nextjs-errors]",
                "[data-nextjs-dev-tools-button]",
                'button[aria-label="Open Next.js Dev Tools"]',
                ".__nextjs-dev-overlay",
            ].join(", ");
            const stateKey = "__sotPixelDevOverlaySuppressionTimers";
            const windowWithState = window as typeof window & {
                [stateKey]?: Record<string, number>;
            };
            const timers = (windowWithState[stateKey] ??= {});

            window.clearInterval(timers[id]);
            document.querySelector(`style[${attribute}="${id}"]`)?.remove();

            const devOverlayStyle = document.createElement("style");
            devOverlayStyle.setAttribute(attribute, id);
            devOverlayStyle.textContent = css;
            document.head.appendChild(devOverlayStyle);

            const hideDevOverlay = () => {
                for (const element of document.querySelectorAll<HTMLElement>(
                    selector,
                )) {
                    element.setAttribute("aria-hidden", "true");
                    element.style.setProperty("display", "none", "important");
                    element.style.setProperty(
                        "visibility",
                        "hidden",
                        "important",
                    );
                    element.style.setProperty("opacity", "0", "important");
                    element.style.setProperty(
                        "pointer-events",
                        "none",
                        "important",
                    );
                }
            };

            hideDevOverlay();
            timers[id] = window.setInterval(hideDevOverlay, 50);
        },
        {
            attribute: SOT_PIXEL_DEV_OVERLAY_STYLE_ATTR,
            css: SOT_PIXEL_DEV_OVERLAY_HIDDEN_CSS,
            id: fixtureId,
        },
    );
}

async function removeSotPixelDevOverlaySuppression(
    page: Page,
    fixtureId: string,
) {
    await page.evaluate(
        ({ attribute, id }) => {
            const stateKey = "__sotPixelDevOverlaySuppressionTimers";
            const windowWithState = window as typeof window & {
                [stateKey]?: Record<string, number>;
            };
            const timers = windowWithState[stateKey];
            if (timers?.[id]) {
                window.clearInterval(timers[id]);
                delete timers[id];
            }
            document.querySelector(`style[${attribute}="${id}"]`)?.remove();
        },
        { attribute: SOT_PIXEL_DEV_OVERLAY_STYLE_ATTR, id: fixtureId },
    );
}

async function captureListRowFixture(
    page: Page,
    rowHtml: string,
    sourceAssetDataUrls: Record<string, string>,
) {
    const fixtureId = `sot-list-row-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`;

    await page.evaluate(
        ({
            devOverlayCss,
            fixtureId: id,
            rowHtml: html,
            sourceAssetDataUrls: assetDataUrls,
        }) => {
            document.getElementById(id)?.remove();
            document.documentElement.dataset.theme = "dark";
            document.body.removeAttribute("data-time-style");
            const devOverlayStyle = document.createElement("style");
            devOverlayStyle.dataset.listPanelFrameFixture = id;
            devOverlayStyle.textContent = devOverlayCss;
            document.head.appendChild(devOverlayStyle);

            const host = document.createElement("div");
            host.id = id;
            host.style.position = "fixed";
            host.style.left = "32px";
            host.style.top = "32px";
            host.style.zIndex = "2147483647";
            host.style.pointerEvents = "none";
            host.style.background = "transparent";

            const stage = document.createElement("div");
            stage.className = "list-row-pixel-stage";
            stage.style.boxSizing = "border-box";
            stage.style.background = "var(--bg-canvas)";
            stage.style.padding = "16px";
            stage.style.width = "420px";

            const list = document.createElement("div");
            list.className = "real-list";
            list.style.width = "388px";
            list.innerHTML = html;

            for (const image of list.querySelectorAll("img")) {
                const src = image.getAttribute("src");
                if (src && assetDataUrls[src]) {
                    image.setAttribute("src", assetDataUrls[src]);
                }
            }

            stage.appendChild(list);
            host.appendChild(stage);
            document.body.appendChild(host);
        },
        {
            devOverlayCss: SOT_PIXEL_DEV_OVERLAY_HIDDEN_CSS,
            fixtureId,
            rowHtml,
            sourceAssetDataUrls,
        },
    );

    await waitForListRowFixtureImages(page, fixtureId);
    const stage = page.locator(`#${fixtureId} > .list-row-pixel-stage`).first();
    const row = page.locator(`#${fixtureId} .real-list > .row`).first();
    await expect(row).toBeVisible();
    await page.waitForTimeout(250);

    const metrics = await row.evaluate((element) => {
        const readStyle = (node: Element | null) => {
            if (!node) return null;
            const style = window.getComputedStyle(node);
            const rect = node.getBoundingClientRect();
            return {
                backgroundColor: style.backgroundColor,
                borderColor: style.borderColor,
                boxShadow: style.boxShadow,
                color: style.color,
                display: style.display,
                font: style.font,
                height: Math.round(rect.height * 1000) / 1000,
                padding: style.padding,
                width: Math.round(rect.width * 1000) / 1000,
            };
        };

        return {
            badge: readStyle(element.querySelector(".b")),
            imageCount: element.querySelectorAll("img").length,
            row: readStyle(element),
            tag: readStyle(element.querySelector(".utag")),
            title: readStyle(element.querySelector(".title")),
        };
    });
    const screenshot = await stage.screenshot({
        animations: "disabled",
        omitBackground: false,
        scale: "css",
    });
    await page.evaluate((id) => {
        document.getElementById(id)?.remove();
        document
            .querySelector(`style[data-list-panel-frame-fixture="${id}"]`)
            ?.remove();
    }, fixtureId);

    return {
        dataUrl: `data:image/png;base64,${screenshot.toString("base64")}`,
        metrics,
        screenshot,
    };
}

async function captureListSkeletonFixture(page: Page, skeletonHtml: string) {
    const fixtureId = `sot-list-skeleton-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`;

    await installSotPixelDevOverlaySuppression(page, fixtureId);
    try {
        await page.evaluate(
            ({ fixtureId: id, skeletonHtml: html }) => {
                document.getElementById(id)?.remove();
                document.documentElement.dataset.theme = "dark";

                const host = document.createElement("div");
                host.id = id;
                host.style.position = "fixed";
                host.style.left = "32px";
                host.style.top = "32px";
                host.style.zIndex = "2147483647";
                host.style.pointerEvents = "none";
                host.style.background = "transparent";

                const stage = document.createElement("div");
                stage.className = "list-skeleton-pixel-stage";
                stage.style.boxSizing = "border-box";
                stage.style.background = "var(--bg-canvas)";
                stage.style.padding = "16px";
                stage.style.width = "420px";
                stage.innerHTML = html;
                stage.querySelector(".skel-list")?.removeAttribute("hidden");

                host.appendChild(stage);
                document.body.appendChild(host);
            },
            { fixtureId, skeletonHtml },
        );

        const stage = page
            .locator(`#${fixtureId} > .list-skeleton-pixel-stage`)
            .first();
        const skeleton = page.locator(`#${fixtureId} .skel-list`).first();
        await expect(skeleton).toBeVisible();
        await page.waitForTimeout(250);
        const screenshot = await stage.screenshot({
            animations: "disabled",
            omitBackground: false,
            scale: "css",
        });

        return {
            dataUrl: `data:image/png;base64,${screenshot.toString("base64")}`,
            screenshot,
        };
    } finally {
        try {
            await page.evaluate((id) => {
                document.getElementById(id)?.remove();
            }, fixtureId);
        } finally {
            await removeSotPixelDevOverlaySuppression(page, fixtureId);
        }
    }
}

async function captureTagFilterTriggerFixture(page: Page, triggerHtml: string) {
    const fixtureId = `sot-tag-filter-trigger-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`;

    await page.evaluate(
        ({ fixtureId: id, triggerHtml: html }) => {
            document.getElementById(id)?.remove();
            document.documentElement.dataset.theme = "dark";

            const host = document.createElement("div");
            host.id = id;
            host.style.position = "fixed";
            host.style.left = "32px";
            host.style.top = "32px";
            host.style.zIndex = "2147483647";
            host.style.pointerEvents = "none";
            host.style.background = "transparent";

            const stage = document.createElement("div");
            stage.className = "tag-filter-trigger-pixel-stage";
            stage.style.boxSizing = "border-box";
            stage.style.background = "var(--bg-canvas)";
            stage.style.padding = "16px";
            stage.style.width = "280px";

            const wrapper = document.createElement("div");
            wrapper.className = "tag-filter";
            wrapper.style.margin = "0";
            wrapper.style.width = "248px";
            wrapper.innerHTML = html;

            stage.appendChild(wrapper);
            host.appendChild(stage);
            document.body.appendChild(host);
        },
        { fixtureId, triggerHtml },
    );

    const stage = page
        .locator(`#${fixtureId} > .tag-filter-trigger-pixel-stage`)
        .first();
    const trigger = page.locator(`#${fixtureId} .tag-filter-trigger`).first();
    await expect(trigger).toBeVisible();
    await page.waitForTimeout(250);
    const screenshot = await stage.screenshot({
        animations: "disabled",
        omitBackground: false,
        scale: "css",
    });
    await page.evaluate((id) => {
        document.getElementById(id)?.remove();
    }, fixtureId);

    return {
        dataUrl: `data:image/png;base64,${screenshot.toString("base64")}`,
        screenshot,
    };
}

async function captureOpenTagFilterFixture(page: Page, tagFilterHtml: string) {
    const fixtureId = `sot-tag-filter-open-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`;

    await page.evaluate(
        ({ fixtureId: id, tagFilterHtml: html }) => {
            document.getElementById(id)?.remove();
            document.documentElement.dataset.theme = "dark";

            const host = document.createElement("div");
            host.id = id;
            host.style.position = "fixed";
            host.style.left = "32px";
            host.style.top = "32px";
            host.style.zIndex = "2147483647";
            host.style.pointerEvents = "none";
            host.style.background = "transparent";

            const stage = document.createElement("div");
            stage.className = "tag-filter-open-pixel-stage";
            stage.style.boxSizing = "border-box";
            stage.style.background = "var(--bg-canvas)";
            stage.style.height = "260px";
            stage.style.overflow = "visible";
            stage.style.padding = "16px";
            stage.style.width = "280px";
            stage.innerHTML = html;

            const filter = stage.querySelector<HTMLElement>(".tag-filter");
            filter?.removeAttribute("hidden");
            if (filter) {
                filter.style.margin = "0";
                filter.style.width = "248px";
            }
            stage
                .querySelector<HTMLElement>("[data-tag-filter-trigger]")
                ?.setAttribute("aria-expanded", "true");
            stage
                .querySelector<HTMLElement>("[data-tag-filter-list]")
                ?.removeAttribute("hidden");

            host.appendChild(stage);
            document.body.appendChild(host);
        },
        { fixtureId, tagFilterHtml },
    );

    const stage = page
        .locator(`#${fixtureId} > .tag-filter-open-pixel-stage`)
        .first();
    await expect(page.locator(`#${fixtureId} .tag-filter-list`)).toBeVisible();
    await page.waitForTimeout(250);
    const screenshot = await stage.screenshot({
        animations: "disabled",
        omitBackground: false,
        scale: "css",
    });
    await page.evaluate((id) => {
        document.getElementById(id)?.remove();
    }, fixtureId);

    return {
        dataUrl: `data:image/png;base64,${screenshot.toString("base64")}`,
        screenshot,
    };
}

async function captureListStateBlockFixture(page: Page, blockHtml: string) {
    const fixtureId = `sot-list-state-block-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`;

    await page.evaluate(
        ({ blockHtml: html, fixtureId: id }) => {
            document.getElementById(id)?.remove();
            document.documentElement.dataset.theme = "dark";

            const host = document.createElement("div");
            host.id = id;
            host.style.position = "fixed";
            host.style.left = "32px";
            host.style.top = "32px";
            host.style.zIndex = "2147483647";
            host.style.pointerEvents = "none";
            host.style.background = "transparent";

            const stage = document.createElement("div");
            stage.className = "list-state-block-pixel-stage";
            stage.style.boxSizing = "border-box";
            stage.style.background = "var(--bg-canvas)";
            stage.style.padding = "16px";
            stage.style.width = "420px";
            stage.innerHTML = html;
            stage
                .querySelector<HTMLElement>(".list-state-block")
                ?.removeAttribute("hidden");

            host.appendChild(stage);
            document.body.appendChild(host);
        },
        { blockHtml, fixtureId },
    );

    const stage = page
        .locator(`#${fixtureId} > .list-state-block-pixel-stage`)
        .first();
    await expect(page.locator(`#${fixtureId} .list-state-block`)).toBeVisible();
    await page.waitForTimeout(250);
    const screenshot = await stage.screenshot({
        animations: "disabled",
        omitBackground: false,
        scale: "css",
    });
    await page.evaluate((id) => {
        document.getElementById(id)?.remove();
    }, fixtureId);

    return {
        dataUrl: `data:image/png;base64,${screenshot.toString("base64")}`,
        screenshot,
    };
}

async function captureListPanelFrameFixture(
    page: Page,
    panelHtml: string,
    sourceAssetDataUrls: Record<string, string>,
    stageWidth: number,
) {
    const fixtureId = `sot-list-panel-frame-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`;

    await installSotPixelDevOverlaySuppression(page, fixtureId);
    await page.evaluate(
        ({
            fixtureId: id,
            panelHtml: html,
            sourceAssetDataUrls: assetDataUrls,
            stageWidth: width,
        }) => {
            document.getElementById(id)?.remove();
            document.documentElement.dataset.theme = "dark";
            document.body.removeAttribute("data-time-style");

            const host = document.createElement("div");
            host.id = id;
            host.style.position = "fixed";
            host.style.left = "0";
            host.style.top = "0";
            host.style.zIndex = "2147483647";
            host.style.pointerEvents = "none";
            host.style.background = "var(--bg-canvas)";

            const stage = document.createElement("div");
            stage.className = "workspace list-panel-frame-stage";
            stage.style.boxSizing = "border-box";
            stage.style.width = `${width}px`;
            stage.innerHTML = html;
            const stackStrip = stage.querySelector<HTMLElement>(".stack-strip");
            if (stackStrip) {
                stackStrip.style.display = "flex";
            }

            for (const image of stage.querySelectorAll("img")) {
                const src = image.getAttribute("src");
                if (src && assetDataUrls[src]) {
                    image.setAttribute("src", assetDataUrls[src]);
                }
            }

            host.appendChild(stage);
            document.body.appendChild(host);
        },
        {
            fixtureId,
            panelHtml,
            sourceAssetDataUrls,
            stageWidth,
        },
    );

    await waitForListRowFixtureImages(page, fixtureId);
    const stage = page.locator(`#${fixtureId} > .list-panel-frame-stage`).first();
    await expect(stage.locator(".list-panel")).toBeVisible();
    await page.waitForTimeout(250);
    await page.evaluate(() => {
        document.querySelectorAll("nextjs-portal").forEach((element) => {
            element.remove();
        });
    });
    const screenshot = await stage.screenshot({
        animations: "disabled",
        omitBackground: false,
        scale: "css",
    });
    await page.evaluate((id) => {
        document.getElementById(id)?.remove();
    }, fixtureId);
    await removeSotPixelDevOverlaySuppression(page, fixtureId);

    return {
        dataUrl: `data:image/png;base64,${screenshot.toString("base64")}`,
        screenshot,
    };
}

async function compareListRowPixels(
    page: Page,
    expected: string,
    actual: string,
): Promise<ListRowPixelDiff> {
    return page.evaluate(
        async ({ actual: actualSrc, expected: expectedSrc }) => {
            const loadImage = (src: string) =>
                new Promise<HTMLImageElement>((resolve, reject) => {
                    const image = new Image();
                    image.onload = () => resolve(image);
                    image.onerror = () =>
                        reject(new Error(`Failed to decode screenshot ${src}`));
                    image.src = src;
                });
            const [expectedImage, actualImage] = await Promise.all([
                loadImage(expectedSrc),
                loadImage(actualSrc),
            ]);

            if (
                expectedImage.naturalWidth !== actualImage.naturalWidth ||
                expectedImage.naturalHeight !== actualImage.naturalHeight
            ) {
                return {
                    bounds: null,
                    differingPixels: -1,
                    dimensionsMatch: false,
                    expectedHeight: expectedImage.naturalHeight,
                    expectedWidth: expectedImage.naturalWidth,
                    maxChannelDelta: -1,
                    productHeight: actualImage.naturalHeight,
                    productWidth: actualImage.naturalWidth,
                };
            }

            const canvas = document.createElement("canvas");
            canvas.width = expectedImage.naturalWidth;
            canvas.height = expectedImage.naturalHeight;
            const context = canvas.getContext("2d", {
                willReadFrequently: true,
            });
            if (!context) {
                throw new Error("Canvas 2D context unavailable");
            }

            context.drawImage(expectedImage, 0, 0);
            const expectedData = context.getImageData(
                0,
                0,
                canvas.width,
                canvas.height,
            ).data;
            context.clearRect(0, 0, canvas.width, canvas.height);
            context.drawImage(actualImage, 0, 0);
            const actualData = context.getImageData(
                0,
                0,
                canvas.width,
                canvas.height,
            ).data;

            let differingPixels = 0;
            let maxChannelDelta = 0;
            let minX = Number.POSITIVE_INFINITY;
            let minY = Number.POSITIVE_INFINITY;
            let maxX = -1;
            let maxY = -1;
            for (let index = 0; index < expectedData.length; index += 4) {
                const pixelDelta = Math.max(
                    Math.abs(expectedData[index] - actualData[index]),
                    Math.abs(expectedData[index + 1] - actualData[index + 1]),
                    Math.abs(expectedData[index + 2] - actualData[index + 2]),
                    Math.abs(expectedData[index + 3] - actualData[index + 3]),
                );
                if (pixelDelta > 0) {
                    const pixelIndex = index / 4;
                    const x = pixelIndex % canvas.width;
                    const y = Math.floor(pixelIndex / canvas.width);
                    differingPixels += 1;
                    maxChannelDelta = Math.max(maxChannelDelta, pixelDelta);
                    minX = Math.min(minX, x);
                    minY = Math.min(minY, y);
                    maxX = Math.max(maxX, x);
                    maxY = Math.max(maxY, y);
                }
            }

            return {
                bounds:
                    differingPixels > 0
                        ? { maxX, maxY, minX, minY }
                        : null,
                differingPixels,
                dimensionsMatch: true,
                expectedHeight: expectedImage.naturalHeight,
                expectedWidth: expectedImage.naturalWidth,
                maxChannelDelta,
                productHeight: actualImage.naturalHeight,
                productWidth: actualImage.naturalWidth,
            };
        },
        { actual, expected },
    );
}

async function expectListRowPixelMatch(
    page: Page,
    testInfo: TestInfo,
    sotPage: Page,
    state: ListRowSotState,
    rowHtml: string,
    sourceAssetDataUrls: Record<string, string>,
) {
    const [sotCapture, productCapture] = await Promise.all([
        captureListRowFixture(sotPage, rowHtml, sourceAssetDataUrls),
        captureListRowFixture(page, rowHtml, sourceAssetDataUrls),
    ]);
    const diff = await compareListRowPixels(
        page,
        sotCapture.dataUrl,
        productCapture.dataUrl,
    );

    if (
        !diff.dimensionsMatch ||
        diff.differingPixels > 0 ||
        diff.maxChannelDelta > 0
    ) {
        const name = `list-row-${state}`
            .replace(/[^a-z0-9]+/gi, "-")
            .replace(/^-|-$/g, "")
            .toLowerCase();
        await testInfo.attach(`${name}-sot.png`, {
            body: sotCapture.screenshot,
            contentType: "image/png",
        });
        await testInfo.attach(`${name}-product.png`, {
            body: productCapture.screenshot,
            contentType: "image/png",
        });
        await testInfo.attach(`${name}-diff.json`, {
            body: Buffer.from(JSON.stringify(diff, null, 2)),
            contentType: "application/json",
        });
        await testInfo.attach(`${name}-metrics.json`, {
            body: Buffer.from(
                JSON.stringify(
                    {
                        product: productCapture.metrics,
                        sot: sotCapture.metrics,
                    },
                    null,
                    2,
                ),
            ),
            contentType: "application/json",
        });
    }

    const diffLabel = `list-row ${state} ${JSON.stringify({
        diff,
        product: productCapture.metrics,
        sot: sotCapture.metrics,
    })}`;
    expect(diff.dimensionsMatch, diffLabel).toBe(true);
    expect(diff.productHeight, diffLabel).toBe(diff.expectedHeight);
    expect(diff.productWidth, diffLabel).toBe(diff.expectedWidth);
    expect(diff.differingPixels, diffLabel).toBe(0);
    expect(diff.maxChannelDelta, diffLabel).toBe(0);
}

async function expectListSkeletonPixelMatch(
    page: Page,
    testInfo: TestInfo,
    sotPage: Page,
    skeletonHtml: string,
) {
    const sotCapture = await captureListSkeletonFixture(sotPage, skeletonHtml);
    const productCapture = await captureListSkeletonFixture(page, skeletonHtml);
    const diff = await compareListRowPixels(
        page,
        sotCapture.dataUrl,
        productCapture.dataUrl,
    );

    if (
        !diff.dimensionsMatch ||
        diff.differingPixels > 0 ||
        diff.maxChannelDelta > 0
    ) {
        await testInfo.attach("list-skeleton-sot.png", {
            body: sotCapture.screenshot,
            contentType: "image/png",
        });
        await testInfo.attach("list-skeleton-product.png", {
            body: productCapture.screenshot,
            contentType: "image/png",
        });
        await testInfo.attach("list-skeleton-diff.json", {
            body: Buffer.from(JSON.stringify(diff, null, 2)),
            contentType: "application/json",
        });
    }

    const diffLabel = `list-skeleton ${JSON.stringify(diff)}`;
    expect(diff.dimensionsMatch, diffLabel).toBe(true);
    expect(diff.productHeight, diffLabel).toBe(diff.expectedHeight);
    expect(diff.productWidth, diffLabel).toBe(diff.expectedWidth);
    expect(diff.differingPixels, diffLabel).toBe(0);
    expect(diff.maxChannelDelta, diffLabel).toBe(0);
}

async function expectTagFilterTriggerPixelMatch(
    page: Page,
    testInfo: TestInfo,
    sotPage: Page,
    state: TagFilterTriggerSotState,
    triggerHtml: string,
) {
    const [sotCapture, productCapture] = await Promise.all([
        captureTagFilterTriggerFixture(sotPage, triggerHtml),
        captureTagFilterTriggerFixture(page, triggerHtml),
    ]);
    const diff = await compareListRowPixels(
        page,
        sotCapture.dataUrl,
        productCapture.dataUrl,
    );

    if (
        !diff.dimensionsMatch ||
        diff.differingPixels > 0 ||
        diff.maxChannelDelta > 0
    ) {
        const name = `tag-filter-trigger-${state}`;
        await testInfo.attach(`${name}-sot.png`, {
            body: sotCapture.screenshot,
            contentType: "image/png",
        });
        await testInfo.attach(`${name}-product.png`, {
            body: productCapture.screenshot,
            contentType: "image/png",
        });
        await testInfo.attach(`${name}-diff.json`, {
            body: Buffer.from(JSON.stringify(diff, null, 2)),
            contentType: "application/json",
        });
    }

    const diffLabel = `tag-filter-trigger ${state} ${JSON.stringify(diff)}`;
    expect(diff.dimensionsMatch, diffLabel).toBe(true);
    expect(diff.productHeight, diffLabel).toBe(diff.expectedHeight);
    expect(diff.productWidth, diffLabel).toBe(diff.expectedWidth);
    expect(diff.differingPixels, diffLabel).toBe(0);
    expect(diff.maxChannelDelta, diffLabel).toBe(0);
}

async function expectOpenTagFilterPixelMatch(
    page: Page,
    testInfo: TestInfo,
    sotPage: Page,
    tagFilterHtml: string,
) {
    const sotCapture = await captureOpenTagFilterFixture(sotPage, tagFilterHtml);
    const productCapture = await captureOpenTagFilterFixture(page, tagFilterHtml);
    const diff = await compareListRowPixels(
        page,
        sotCapture.dataUrl,
        productCapture.dataUrl,
    );

    if (
        !diff.dimensionsMatch ||
        diff.differingPixels > 0 ||
        diff.maxChannelDelta > 0
    ) {
        await testInfo.attach("tag-filter-open-sot.png", {
            body: sotCapture.screenshot,
            contentType: "image/png",
        });
        await testInfo.attach("tag-filter-open-product.png", {
            body: productCapture.screenshot,
            contentType: "image/png",
        });
        await testInfo.attach("tag-filter-open-diff.json", {
            body: Buffer.from(JSON.stringify(diff, null, 2)),
            contentType: "application/json",
        });
    }

    const diffLabel = `tag-filter-open ${JSON.stringify(diff)}`;
    expect(diff.dimensionsMatch, diffLabel).toBe(true);
    expect(diff.productHeight, diffLabel).toBe(diff.expectedHeight);
    expect(diff.productWidth, diffLabel).toBe(diff.expectedWidth);
    expect(diff.differingPixels, diffLabel).toBe(0);
    expect(diff.maxChannelDelta, diffLabel).toBe(0);
}

async function expectListStateBlockPixelMatch(
    page: Page,
    testInfo: TestInfo,
    sotPage: Page,
    state: ListStateBlockSotState,
    blockHtml: string,
) {
    const [sotCapture, productCapture] = await Promise.all([
        captureListStateBlockFixture(sotPage, blockHtml),
        captureListStateBlockFixture(page, blockHtml),
    ]);
    const diff = await compareListRowPixels(
        page,
        sotCapture.dataUrl,
        productCapture.dataUrl,
    );

    if (
        !diff.dimensionsMatch ||
        diff.differingPixels > 0 ||
        diff.maxChannelDelta > 0
    ) {
        const name = `list-state-block-${state}`;
        await testInfo.attach(`${name}-sot.png`, {
            body: sotCapture.screenshot,
            contentType: "image/png",
        });
        await testInfo.attach(`${name}-product.png`, {
            body: productCapture.screenshot,
            contentType: "image/png",
        });
        await testInfo.attach(`${name}-diff.json`, {
            body: Buffer.from(JSON.stringify(diff, null, 2)),
            contentType: "application/json",
        });
    }

    const diffLabel = `list-state-block ${state} ${JSON.stringify(diff)}`;
    expect(diff.dimensionsMatch, diffLabel).toBe(true);
    expect(diff.productHeight, diffLabel).toBe(diff.expectedHeight);
    expect(diff.productWidth, diffLabel).toBe(diff.expectedWidth);
    expect(diff.differingPixels, diffLabel).toBe(0);
    expect(diff.maxChannelDelta, diffLabel).toBe(0);
}

async function expectRuntimeListStateBlockPixelMatch(
    page: Page,
    testInfo: TestInfo,
    sotPage: Page,
    state: ListStateBlockSotState,
    expectedBlockHtml: string,
    actualBlockHtml: string,
) {
    const [sotCapture, productCapture] = await Promise.all([
        captureListStateBlockFixture(sotPage, expectedBlockHtml),
        captureListStateBlockFixture(page, actualBlockHtml),
    ]);
    const diff = await compareListRowPixels(
        page,
        sotCapture.dataUrl,
        productCapture.dataUrl,
    );

    if (
        !diff.dimensionsMatch ||
        diff.differingPixels > 0 ||
        diff.maxChannelDelta > 0
    ) {
        const name = `runtime-list-state-block-${state}`;
        await testInfo.attach(`${name}-sot.png`, {
            body: sotCapture.screenshot,
            contentType: "image/png",
        });
        await testInfo.attach(`${name}-product.png`, {
            body: productCapture.screenshot,
            contentType: "image/png",
        });
        await testInfo.attach(`${name}-diff.json`, {
            body: Buffer.from(JSON.stringify(diff, null, 2)),
            contentType: "application/json",
        });
    }

    const diffLabel = `runtime-list-state-block ${state} ${JSON.stringify(diff)}`;
    expect(diff.dimensionsMatch, diffLabel).toBe(true);
    expect(diff.productHeight, diffLabel).toBe(diff.expectedHeight);
    expect(diff.productWidth, diffLabel).toBe(diff.expectedWidth);
    expect(diff.differingPixels, diffLabel).toBe(0);
    expect(diff.maxChannelDelta, diffLabel).toBe(0);
}

async function readComputedStyle(
    locator: Locator,
    props: readonly ListStyleProp[],
) {
    return locator.first().evaluate(
        (element, propNames) => {
            const style = window.getComputedStyle(element);
            const colorProps = new Set([
                "background-color",
                "border-top-color",
                "color",
                "outline-color",
            ]);
            const normalizeColor = (value: string) => {
                const canvas = document.createElement("canvas");
                const context = canvas.getContext("2d");
                if (!context) return value;
                context.fillStyle = "#000";
                context.fillStyle = value;
                return context.fillStyle;
            };
            const entries = Object.fromEntries(
                propNames.map((prop) => {
                    const value = style.getPropertyValue(prop);
                    return [
                        prop,
                        colorProps.has(prop) ? normalizeColor(value) : value,
                    ];
                }),
            );
            if (entries["border-top-width"] === "0px") {
                entries["border-top-style"] = "none";
            }
            return entries;
        },
        props,
    );
}

async function expectComputedStyleMatch(
    sotLocator: Locator,
    productLocator: Locator,
    props: readonly ListStyleProp[],
) {
    const [sot, product] = await Promise.all([
        readComputedStyle(sotLocator, props),
        readComputedStyle(productLocator, props),
    ]);

    expect(product).toEqual(sot);
}

async function switchRecordingListToTags(page: Page) {
    const panel = recordingListPanel(page);
    const tagsModeTab = panel.getByRole("tab", {
        name: "标签",
        exact: true,
    });

    await expect(panel).toHaveAttribute("data-sot-state", "ready");
    await expect(tagsModeTab).toBeVisible();

    for (let attempt = 0; attempt < 3; attempt += 1) {
        await tagsModeTab.click();
        if (
            await tagsModeTab
                .getAttribute("aria-selected", { timeout: 1_000 })
                .then((selected) => selected === "true")
                .catch(() => false)
        ) {
            return;
        }
        await page.waitForTimeout(250);
    }

    await expect(panel).toHaveAttribute("data-sot-list-mode", "tags");
    await expect(
        panel.locator('[data-list-filter-row="timeline"]'),
    ).toBeHidden();
    await expect(panel.locator(".tag-filter")).toBeVisible();
    await expect(panel.locator("[data-tag-filter-trigger]")).toHaveAttribute(
        "aria-expanded",
        "false",
    );
}

async function selectTagFilter(page: Page, label: string) {
    const panel = recordingListPanel(page);
    const trigger = panel.locator("[data-tag-filter-trigger]");
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    const list = panel.locator("[data-tag-filter-list]");
    await expect(list).toBeVisible();
    const option = list
        .locator('[data-sot-control="recording-list-tag-filter"]')
        .filter({ hasText: label });
    await option.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(list).toBeHidden();
    await expect(trigger.locator("[data-tag-filter-label]")).toHaveText(label);
}

async function selectTimelineFilter(
    page: Page,
    panel: Locator,
    filter: string,
    visibleCount: number,
) {
    const trigger = page.locator(
        `[data-sot-control="recording-list-timeline-filter"][data-sot-filter="${filter}"]`,
    );

    for (let attempt = 0; attempt < 3; attempt += 1) {
        await trigger.click();
        if (
            await panel
                .locator(
                    '[data-sot-control="dashboard-recording-row"][data-sot-recording-id^="e2e-list-state-"]',
                )
                .count()
                .then((count) => count === visibleCount)
                .catch(() => false)
        ) {
            return;
        }
        await page.waitForTimeout(250);
    }

    await expect(
        seededRecordingRows(panel),
    ).toHaveCount(visibleCount);
}

test("recording list paginates without leaking tweak controls across dark, light, and mobile states", async ({
    page,
}) => {
    await mockConnectedDataSources(page);
    await ensureSignedIn(page);
    await resetDisplay(page, { itemsPerPage: 10, theme: "dark" });

    const userId = await getPlaywrightUserId();
    await seedListRecordings(userId, 23);

    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    const panel = recordingListPanel(page);
    const pagination = page.locator(
        '[data-sot-panel="recording-list-pagination"]',
    );
    await expect(panel).toHaveAttribute("data-sot-state", "ready");
    await expect(pagination).toHaveAttribute(
        "data-sot-state",
        "paginated-first",
    );
    await expect(panel).toContainText("已加载 10 / 23 条 · 第 1 页");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expectNoTweaksLeak(page);

    await expect(sotControl(page, "recording-list-prev-page")).toBeDisabled();
    await expect(sotControl(page, "recording-list-next-page")).toBeEnabled();
    await expect(sotControl(page, "recording-list-first-page")).toHaveCount(0);
    await expect(sotControl(page, "recording-list-last-page")).toHaveCount(0);
    await expect(sotControl(page, "recording-list-load-more")).toHaveCount(0);
    await expect(pagination.locator(".lsb-page-nav > .btn")).toHaveCount(2);
    await expect(pagination.locator("[data-page-prev]")).toHaveCount(1);
    await expect(pagination.locator("[data-page-next]")).toHaveCount(1);
    await expect(pagination.locator(".lsb-page-num.mono")).toHaveText("1 / 3");
    await expect(
        seededRecordingRows(panel),
    ).toHaveCount(10);
    await expect(recordingRow(page, "e2e-list-state-01")).toBeVisible();
    await expect(recordingRow(page, "e2e-list-state-11")).toHaveCount(0);

    await sotControl(page, "recording-list-next-page").click();
    await expect(pagination).toHaveAttribute("data-sot-state", "paginated");
    await expect(panel).toContainText(
        "已加载 10 / 23 条 · 滚动加载下一批",
    );
    await expect(
        seededRecordingRows(panel),
    ).toHaveCount(10);
    await expect(sotControl(page, "recording-list-prev-page")).toBeEnabled();
    await expect(sotControl(page, "recording-list-next-page")).toBeEnabled();
    await expect(sotControl(page, "recording-list-load-more")).toBeVisible();
    await expect(pagination.locator(".lsb-page-num.mono")).toHaveText("2 / 3");
    await expect(recordingRow(page, "e2e-list-state-11")).toBeVisible();
    await expect(recordingRow(page, "e2e-list-state-20")).toBeVisible();

    await sotControl(page, "recording-list-next-page").click();
    await expect(pagination).toHaveAttribute(
        "data-sot-state",
        "paginated-last",
    );
    await expect(panel).toContainText("已显示全部 23 / 23 条 · 末页");
    await expect(
        seededRecordingRows(panel),
    ).toHaveCount(3);
    await expect(sotControl(page, "recording-list-next-page")).toBeDisabled();
    await expect(sotControl(page, "recording-list-load-more")).toHaveCount(0);
    await expect(pagination.locator(".lsb-page-num.mono")).toHaveText("3 / 3");
    await expect(recordingRow(page, "e2e-list-state-23")).toBeVisible();

    await sotControl(page, "recording-list-prev-page").click();
    await expect(pagination).toHaveAttribute("data-sot-state", "paginated");
    await sotControl(page, "recording-list-prev-page").click();
    await expect(pagination).toHaveAttribute(
        "data-sot-state",
        "paginated-first",
    );
    await expect(panel).toContainText("已加载 10 / 23 条 · 第 1 页");
    await expect(sotControl(page, "recording-list-prev-page")).toBeDisabled();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator("#drawer-trigger")).toBeVisible();
    await expect(panel).toHaveAttribute("data-sot-state", "ready");
    await expect(pagination).toHaveAttribute(
        "data-sot-state",
        "paginated-first",
    );
    await expectNoTweaksLeak(page);

    await resetDisplay(page, { itemsPerPage: 10, theme: "light" });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(panel).toHaveAttribute("data-sot-state", "ready");
    await expect(pagination).toHaveAttribute(
        "data-sot-state",
        "paginated-first",
    );
    await expectNoTweaksLeak(page);

    await cleanupListSeeds(userId);
});

test("recording list loading state restores the SOT skeleton list", async ({
    page,
}) => {
    await mockConnectedDataSources(page);
    await ensureSignedIn(page);
    await resetDisplay(page);

    const userId = await getPlaywrightUserId();
    await seedListRecordings(userId, 4);

    let releaseDisplaySettings: (() => void) | null = null;
    const displaySettingsGate = new Promise<void>((resolve) => {
        releaseDisplaySettings = resolve;
    });

    await page.route("**/api/settings/display", async (route) => {
        if (route.request().method() === "GET") {
            await displaySettingsGate;
        }
        await route.continue();
    });

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    const panel = recordingListPanel(page);
    await expect(panel).toHaveAttribute("data-sot-state", "loading");
    const skeleton = panel.locator('[data-sot-panel="recording-list-loading"]');
    await expect(skeleton).toBeVisible();
    await expect(skeleton.locator(".day.skel-day")).toHaveCount(2);
    await expect(skeleton.locator(".row.skel-row")).toHaveCount(5);
    await expect(skeleton.locator(".sk.sk-title")).toHaveCount(5);
    await expect(panel.locator(".list-scroll > .list-state-block")).toHaveCount(0);

    releaseDisplaySettings?.();
    await expect(panel).toHaveAttribute("data-sot-state", "ready");
    await expect(skeleton).toHaveCount(0);

    await cleanupListSeeds(userId);
});

test("recording list rows expose every SOT status badge variant", async ({
    page,
}) => {
    await mockConnectedDataSources(page);
    await ensureSignedIn(page);
    await resetDisplay(page);

    const userId = await getPlaywrightUserId();
    try {
        await seedRowStatusRecordings(userId);
        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        const panel = recordingListPanel(page);
        await expect(panel).toHaveAttribute("data-sot-state", "ready");

        for (const [id, className, dotClassName, label] of [
            ["row-updated", "b ok", "dot", "已更新"],
            ["row-transcribing", "b warn", "dot", "正在转写"],
            ["row-failed", "b err", "dot", "更新失败"],
            ["row-local-only", "b info", "dot", "仅本地"],
            ["row-pending", "b neu", "dot _is-1", "待处理"],
        ] as const) {
            const badge = recordingRow(
                page,
                `${LIST_RECORDING_PREFIX}${id}`,
            ).locator(".meta2 .b");
            await expect(badge).toHaveClass(className);
            await expect(badge.locator(".dot")).toHaveClass(dotClassName);
            await expect(badge).toContainText(label);
        }
    } finally {
        await cleanupListSeeds(userId);
    }
});

test("recording list item primitives match SOT component library styles", async ({
    page,
}) => {
    const sotPage = await page.context().newPage();
    await mockConnectedDataSources(page);
    await ensureSignedIn(page);
    await resetDisplay(page);

    const userId = await getPlaywrightUserId();
    try {
        await seedRowStatusRecordings(userId);
        await openSotComponentLibrary(sotPage);
        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        const panel = recordingListPanel(page);
        await expect(panel).toHaveAttribute("data-sot-state", "ready");
        await expect(page.locator("html")).toHaveAttribute(
            "data-theme",
            "dark",
        );

        const sotListItem = sotPage.locator("#listitem");
        const sotBadge = sotPage.locator("#badge");
        const productUpdatedRow = recordingRow(
            page,
            `${LIST_RECORDING_PREFIX}row-updated`,
        );
        const productTranscribingRow = recordingRow(
            page,
            `${LIST_RECORDING_PREFIX}row-transcribing`,
        );
        const productFailedRow = recordingRow(
            page,
            `${LIST_RECORDING_PREFIX}row-failed`,
        );
        const productLocalOnlyRow = recordingRow(
            page,
            `${LIST_RECORDING_PREFIX}row-local-only`,
        );
        await expect(productUpdatedRow).toBeVisible();
        await expect(productUpdatedRow).toHaveClass(/active/);
        const sotDefaultRow = sotListItem
            .locator(".cl-card")
            .nth(0)
            .locator(".row");
        await expectComputedStyleMatch(
            sotDefaultRow,
            productTranscribingRow,
            LIST_ROW_STYLE_PROPS,
        );
        await expectComputedStyleMatch(
            sotListItem.locator(".cl-card").nth(1).locator(".row.active"),
            productUpdatedRow,
            LIST_ROW_STYLE_PROPS,
        );
        await sotDefaultRow.hover();
        await sotPage.waitForTimeout(250);
        const sotHoverStyle = await readComputedStyle(
            sotDefaultRow,
            LIST_ROW_STYLE_PROPS,
        );
        await productFailedRow.hover();
        await page.waitForTimeout(250);
        const productHoverStyle = await readComputedStyle(
            productFailedRow,
            LIST_ROW_STYLE_PROPS,
        );
        expect(productHoverStyle).toEqual(sotHoverStyle);
        await productLocalOnlyRow.focus();
        await expectComputedStyleMatch(
            sotListItem.locator(".row.is-focus-demo"),
            productLocalOnlyRow,
            LIST_ROW_STYLE_PROPS,
        );

        for (const [id, selector] of [
            ["row-updated", ".b.ok"],
            ["row-transcribing", ".b.warn"],
            ["row-failed", ".b.err"],
            ["row-local-only", ".b.info"],
            ["row-pending", ".b.neu"],
        ] as const) {
            await expectComputedStyleMatch(
                sotBadge.locator(selector),
                recordingRow(page, `${LIST_RECORDING_PREFIX}${id}`).locator(
                    selector,
                ),
                LIST_BADGE_STYLE_PROPS,
            );
        }

        await expectComputedStyleMatch(
            sotBadge.locator(".utag.c-blue"),
            productUpdatedRow.locator(".utag.c-blue"),
            LIST_TAG_STYLE_PROPS,
        );
    } finally {
        await sotPage.close();
        await cleanupListSeeds(userId);
    }
});

test("recording list row states match SOT web index pixels", async ({
    page,
}, testInfo) => {
    const sotPage = await page.context().newPage();
    await ensureSignedIn(page);
    await resetDisplay(page, { theme: "dark" });

    try {
        await openSotWorkstation(sotPage);
        const rowHtmlByState = await readSotListRowHtml(sotPage);
        const sourceAssetDataUrls = await readListRowSourceAssetDataUrls();

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await expect(page.locator("html")).toHaveAttribute(
            "data-theme",
            "dark",
        );

        for (const state of LIST_ROW_SOT_STATES) {
            await expectListRowPixelMatch(
                page,
                testInfo,
                sotPage,
                state,
                rowHtmlByState[state],
                sourceAssetDataUrls,
            );
        }
    } finally {
        await sotPage.close();
    }
});

test("recording list loading skeleton matches SOT web index pixels", async ({
    page,
}, testInfo) => {
    const sotPage = await page.context().newPage();
    await ensureSignedIn(page);
    await resetDisplay(page, { theme: "dark" });

    try {
        await openSotWorkstation(sotPage);
        const skeletonHtml = await readSotListSkeletonHtml(sotPage);

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await expect(page.locator("html")).toHaveAttribute(
            "data-theme",
            "dark",
        );

        await expectListSkeletonPixelMatch(
            page,
            testInfo,
            sotPage,
            skeletonHtml,
        );
    } finally {
        await sotPage.close();
    }
});

test("recording list tag filter triggers match SOT component-library pixels", async ({
    page,
}, testInfo) => {
    const sotPage = await page.context().newPage();
    await ensureSignedIn(page);
    await resetDisplay(page, { theme: "dark" });

    try {
        await openSotComponentLibrary(sotPage);
        const triggerHtmlByState = await readSotTagFilterTriggerHtml(sotPage);

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await expect(page.locator("html")).toHaveAttribute(
            "data-theme",
            "dark",
        );

        for (const state of TAG_FILTER_TRIGGER_SOT_STATES) {
            await expectTagFilterTriggerPixelMatch(
                page,
                testInfo,
                sotPage,
                state,
                triggerHtmlByState[state],
            );
        }
    } finally {
        await sotPage.close();
    }
});

test("recording list open tag filter matches SOT web index pixels", async ({
    page,
}, testInfo) => {
    const sotPage = await page.context().newPage();
    await ensureSignedIn(page);
    await resetDisplay(page, { theme: "dark" });

    try {
        await openSotWorkstation(sotPage);
        const tagFilterHtml = await readSotOpenTagFilterHtml(sotPage);

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await expect(page.locator("html")).toHaveAttribute(
            "data-theme",
            "dark",
        );

        await expectOpenTagFilterPixelMatch(
            page,
            testInfo,
            sotPage,
            tagFilterHtml,
        );
    } finally {
        await sotPage.close();
    }
});

test("recording list state blocks match SOT web index pixels", async ({
    page,
}, testInfo) => {
    const sotPage = await page.context().newPage();
    await ensureSignedIn(page);
    await resetDisplay(page, { theme: "dark" });

    try {
        await openSotWorkstation(sotPage);
        const blockHtmlByState = await readSotListStateBlockHtml(sotPage);

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await expect(page.locator("html")).toHaveAttribute(
            "data-theme",
            "dark",
        );

        for (const state of LIST_STATE_BLOCK_SOT_STATES) {
            await expectListStateBlockPixelMatch(
                page,
                testInfo,
                sotPage,
                state,
                blockHtmlByState[state],
            );
        }
    } finally {
        await sotPage.close();
    }
});

test("recording list runtime pagination matches SOT web index pixels", async ({
    page,
}, testInfo) => {
    const sotPage = await page.context().newPage();
    await mockConnectedDataSources(page);
    await ensureSignedIn(page);
    await resetDisplay(page, { itemsPerPage: 50, theme: "dark" });

    const userId = await getPlaywrightUserId();
    try {
        await seedListRecordings(userId, 247);
        await openSotWorkstation(sotPage);
        const sotBlocks = await readSotListStateBlockHtml(sotPage);
        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await expect(page.locator("html")).toHaveAttribute(
            "data-theme",
            "dark",
        );

        const pagination = page.locator(
            '[data-sot-panel="recording-list-pagination"]',
        );
        await expect(pagination).toHaveAttribute(
            "data-list-state-block",
            "paginated-first",
        );
        await expectRuntimeListStateBlockPixelMatch(
            page,
            testInfo,
            sotPage,
            "paginated-first",
            sotBlocks["paginated-first"],
            await pagination.evaluate((element) => element.outerHTML),
        );

        await sotControl(page, "recording-list-next-page").click();
        await expect(pagination).toHaveAttribute(
            "data-list-state-block",
            "paginated",
        );
        await expectRuntimeListStateBlockPixelMatch(
            page,
            testInfo,
            sotPage,
            "paginated",
            sotBlocks.paginated,
            await pagination.evaluate((element) => element.outerHTML),
        );

        await sotControl(page, "recording-list-next-page").click();
        await sotControl(page, "recording-list-next-page").click();
        await sotControl(page, "recording-list-next-page").click();
        await expect(pagination).toHaveAttribute(
            "data-list-state-block",
            "paginated-last",
        );
        await expectRuntimeListStateBlockPixelMatch(
            page,
            testInfo,
            sotPage,
            "paginated-last",
            sotBlocks["paginated-last"],
            await pagination.evaluate((element) => element.outerHTML),
        );
    } finally {
        await cleanupListSeeds(userId);
        await sotPage.close();
    }
});

test("recording list responsive frames match SOT web index pixels", async ({
    page,
}, testInfo) => {
    const sotPage = await page.context().newPage();
    await mockConnectedDataSources(page);
    await ensureSignedIn(page);
    await resetDisplay(page, { theme: "dark" });

    try {
        await openSotWorkstation(sotPage);
        const [panelHtml, sourceAssetDataUrls] = await Promise.all([
            readSotListPanelHtml(sotPage),
            readListRowSourceAssetDataUrls(),
        ]);
        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

        for (const frame of [
            {
                name: "desktop",
                viewport: { width: 1366, height: 900 },
                stageWidth: 420,
            },
            {
                name: "mobile",
                viewport: { width: 390, height: 844 },
                stageWidth: 390,
            },
        ] as const) {
            await Promise.all([
                page.setViewportSize(frame.viewport),
                sotPage.setViewportSize(frame.viewport),
            ]);
            const [sotCapture, productCapture] = await Promise.all([
                captureListPanelFrameFixture(
                    sotPage,
                    panelHtml,
                    sourceAssetDataUrls,
                    frame.stageWidth,
                ),
                captureListPanelFrameFixture(
                    page,
                    panelHtml,
                    sourceAssetDataUrls,
                    frame.stageWidth,
                ),
            ]);
            const diff = await compareListRowPixels(
                page,
                sotCapture.dataUrl,
                productCapture.dataUrl,
            );

            if (
                !diff.dimensionsMatch ||
                diff.differingPixels > 0 ||
                diff.maxChannelDelta > 0
            ) {
                await testInfo.attach(`list-frame-${frame.name}-sot.png`, {
                    body: sotCapture.screenshot,
                    contentType: "image/png",
                });
                await testInfo.attach(`list-frame-${frame.name}-product.png`, {
                    body: productCapture.screenshot,
                    contentType: "image/png",
                });
                await testInfo.attach(`list-frame-${frame.name}-diff.json`, {
                    body: Buffer.from(JSON.stringify(diff, null, 2)),
                    contentType: "application/json",
                });
            }

            const diffLabel = `list-frame ${frame.name} ${JSON.stringify(diff)}`;
            expect(diff.dimensionsMatch, diffLabel).toBe(true);
            expect(diff.productHeight, diffLabel).toBe(diff.expectedHeight);
            expect(diff.productWidth, diffLabel).toBe(diff.expectedWidth);
            expect(diff.differingPixels, diffLabel).toBe(0);
            expect(diff.maxChannelDelta, diffLabel).toBe(0);
        }
    } finally {
        await sotPage.close();
    }
});

test("recording list recovers from stale inner timeline filters after source changes", async ({
    page,
}) => {
    await mockConnectedDataSources(page);
    await ensureSignedIn(page);
    await resetDisplay(page);

    const userId = await getPlaywrightUserId();
    await seedTimelineFilterRecordings(userId);

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    const panel = recordingListPanel(page);
    const todayRecording = recordingRow(page, "e2e-list-state-today-ticnote");
    const earlierRecording = recordingRow(page, "e2e-list-state-earlier-plaud");
    await expect(panel).toHaveAttribute("data-sot-state", "ready");
    await expect(todayRecording).toBeVisible();
    await expect(earlierRecording).toBeVisible();

    await selectTimelineFilter(page, panel, "today", 1);
    await expect(todayRecording).toBeVisible();
    await expect(earlierRecording).toHaveCount(0);

    const plaudRow = sourceProvider(page, "plaud");
    await expect(plaudRow).toHaveAttribute("data-sot-status", "connected");
    await plaudRow.click();
    await expect(panel).toHaveAttribute("data-sot-state", "timeline-empty");
    await expect(listStateBlock(panel, "timeline-empty")).toBeVisible();

    await expect(sotControl(page, "recording-list-clear-timeline")).toBeVisible();
    await sotControl(page, "recording-list-clear-timeline").click();
    await expect(panel).toHaveAttribute("data-sot-state", "ready");
    await expect(earlierRecording).toBeVisible();
    await expect(todayRecording).toHaveCount(0);

    await cleanupListSeeds(userId);
});

test("recording list exposes empty setup and no-match recovery states", async ({
    page,
}) => {
    await mockConnectedDataSources(page);
    await ensureSignedIn(page);
    await resetDisplay(page);

    const userId = await getPlaywrightUserId();
    await cleanupAllUserRecordings(userId);

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    const panel = recordingListPanel(page);
    await expect(panel).toHaveAttribute("data-sot-state", "empty");
    await expect(
        page.locator('[data-sot-panel="recording-list-pagination"]'),
    ).toHaveCount(0);
    await expect(listStateBlock(panel, "empty")).toBeVisible();
    await expect(
        sotControl(page, "recording-list-open-data-sources"),
    ).toBeVisible();
    await sotControl(page, "recording-list-open-data-sources").click();
    await expect(page.locator('[data-sot-surface="settings-shell"]')).toBeVisible();
    await expect(page.locator('[data-sot-surface="settings-shell"]')).toHaveAttribute(
        "data-sot-section",
        "data-sources",
    );
    await sotControl(page, "settings-close").click();

    await seedListRecordings(userId);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(panel).toHaveAttribute("data-sot-state", "ready");

    await switchRecordingListToTags(page);
    await expect(panel).toHaveAttribute("data-sot-state", "tag-empty");
    await expect(listStateBlock(panel, "tag-empty")).toBeVisible();
    await expect(sotControl(page, "recording-list-clear-tag")).toBeVisible();
    await panel.getByRole("tab", { name: "时间", exact: true }).click();
    await expect(panel).toHaveAttribute("data-sot-state", "ready");

    const plaudRow = sourceProvider(page, "plaud");
    await expect(plaudRow).toHaveAttribute(
        "data-sot-status",
        "connected-empty",
    );
    await plaudRow.click();
    await expect(plaudRow).toHaveAttribute("aria-pressed", "true");
    await expect(plaudRow).toHaveAttribute("data-active", "true");
    await expect(plaudRow).toHaveAttribute(
        "data-sot-state",
        "connected-active",
    );
    await expect(panel).toHaveAttribute("data-sot-state", "no-match");
    await expect(listStateBlock(panel, "no-match")).toBeVisible();

    await expect(sotControl(page, "recording-list-clear-filters")).toBeVisible();
    await sotControl(page, "recording-list-clear-filters").click();
    await expect(panel).toHaveAttribute("data-sot-state", "ready");
    await expect(plaudRow).toHaveAttribute("aria-pressed", "false");
    await expect(plaudRow).toHaveAttribute("data-active", "false");
    await expect(plaudRow).toHaveAttribute(
        "data-sot-state",
        "connected-idle",
    );

    await cleanupListSeeds(userId);
});

test("recording list tags mode keeps multi-tag recordings in every matching group", async ({
    page,
}) => {
    await mockConnectedDataSources(page);
    await ensureSignedIn(page);
    await resetDisplay(page);

    const userId = await getPlaywrightUserId();
    await seedMultiTagRecordings(userId);

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await switchRecordingListToTags(page);

    const panel = recordingListPanel(page);
    const tagTrigger = panel.locator("[data-tag-filter-trigger]");
    await expect(panel.locator(".tag-filter .chip-f")).toHaveCount(0);
    await expect(tagTrigger.locator("[data-tag-filter-label]")).toHaveText(
        "全部",
    );
    await expect(tagTrigger.locator("[data-tag-filter-count]")).toHaveText("1");
    await tagTrigger.click();
    const tagList = panel.locator("[data-tag-filter-list]");
    await expect(tagList).toBeVisible();
    await expect(
        tagList.locator('[data-tag-value="tag:e2e-list-state-tag-alpha"]'),
    ).toHaveAttribute("role", "option");
    await expect(
        tagList.locator('[data-tag-value="tag:e2e-list-state-tag-beta"]'),
    ).toHaveAttribute("aria-selected", "false");
    await page.keyboard.press("Escape");
    await expect(tagList).toBeHidden();

    const alphaGroup = page.locator(
        '[data-sot-group-id="e2e-list-state-tag-alpha"]',
    );
    const betaGroup = page.locator(
        '[data-sot-group-id="e2e-list-state-tag-beta"]',
    );
    await expect(alphaGroup).toContainText("Alpha");
    await expect(betaGroup).toContainText("Beta");
    const alphaRow = alphaGroup.locator(
        '[data-sot-recording-id="e2e-list-state-multi-tag"]',
    );
    const betaRow = betaGroup.locator(
        '[data-sot-recording-id="e2e-list-state-multi-tag"]',
    );
    await expect(
        alphaRow,
    ).toBeVisible();
    await expect(alphaRow).toHaveAttribute(
        "data-rec",
        "e2e-list-state-multi-tag",
    );
    await expect(
        betaRow,
    ).toBeVisible();
    const alphaTag = alphaRow.locator(".right .utag");
    const betaTag = betaRow.locator(".right .utag");
    await expect(alphaTag).toHaveClass("utag c-blue");
    await expect(alphaTag).toHaveAttribute("data-sot-tag-color", "blue");
    await expect(alphaTag).toHaveAttribute("data-sot-tag-icon", "tag");
    await expect(alphaTag).toContainText("Alpha");
    await expect(betaTag).toHaveClass("utag c-violet");
    await expect(betaTag).toHaveAttribute("data-sot-tag-color", "purple");
    await expect(betaTag).toHaveAttribute("data-sot-tag-icon", "star");
    await expect(betaTag).toContainText("Beta");

    await selectTagFilter(page, "Beta");

    await expect(betaGroup).toContainText("Beta");
    await expect(alphaGroup).toHaveCount(0);
    await expect(
        betaGroup.locator('[data-sot-recording-id="e2e-list-state-multi-tag"]'),
    ).toBeVisible();
    await expect(betaTag).toHaveAttribute("data-sot-tag-icon", "star");
    await tagTrigger.click();
    await expect(
        tagList.locator('[data-tag-value="tag:e2e-list-state-tag-beta"]'),
    ).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Escape");

    await cleanupListSeeds(userId);
});

test("recording list renders the full SOT tag color and icon matrix", async ({
    page,
}) => {
    const sotPage = await page.context().newPage();
    await mockConnectedDataSources(page);
    await ensureSignedIn(page);
    await resetDisplay(page, { itemsPerPage: 20, theme: "dark" });

    const userId = await getPlaywrightUserId();
    try {
        await seedTagMatrixRecordings(userId);
        const sotIconSignatures =
            await readSotComponentTagIconSignatures(sotPage);

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await expect(page.locator("html")).toHaveAttribute(
            "data-theme",
            "dark",
        );

        for (const [index, icon] of SOT_TAG_ICON_MATRIX.entries()) {
            const recordingId = `${LIST_RECORDING_PREFIX}tag-matrix-${String(index + 1).padStart(2, "0")}`;
            const color =
                SOT_TAG_COLOR_MATRIX[index % SOT_TAG_COLOR_MATRIX.length];
            const chip = recordingRow(page, recordingId).locator(".right .utag");

            await expect(chip).toHaveClass(color.className);
            await expect(chip).toHaveAttribute("data-sot-tag-color", color.color);
            await expect(chip).toHaveAttribute("data-sot-tag-icon", icon);
            await expect(chip.locator("svg")).toHaveCount(1);
            expect(await readSvgChildSignature(chip)).toEqual(
                sotIconSignatures[icon],
            );
        }
    } finally {
        await cleanupListSeeds(userId);
        await sotPage.close();
    }
});

test("recording list follows display language for empty and pagination copy", async ({
    page,
}) => {
    await mockConnectedDataSources(page);
    await ensureSignedIn(page);
    await resetDisplay(page, { itemsPerPage: 10, uiLanguage: "en" });

    const userId = await getPlaywrightUserId();
    try {
        await seedListRecordings(userId, 23);
        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

        await expect(page.getByText("Timeline", { exact: true })).toBeVisible();
        await expect(sotControl(page, "recording-list-prev-page")).toHaveText(
            "Previous",
        );
        await expect(sotControl(page, "recording-list-next-page")).toHaveText(
            "Next",
        );
        await expect(sotControl(page, "recording-list-first-page")).toHaveCount(
            0,
        );
        await expect(sotControl(page, "recording-list-last-page")).toHaveCount(
            0,
        );
        await expect(
            recordingListPanel(page).locator(
                '[data-sot-part="recording-list-page-status"]',
            ),
        ).toContainText("Loaded 10 / 23 items · Page 1");

        await cleanupAllUserRecordings(userId);
        await page.reload({ waitUntil: "domcontentloaded" });

        await expect(listStateBlock(recordingListPanel(page), "empty")).toContainText(
            "No recordings yet",
        );
        await expect(
            page.getByRole("button", { name: "Open data sources" }),
        ).toBeVisible();
    } finally {
        await resetDisplay(page);
        await cleanupListSeeds(userId);
    }
});
