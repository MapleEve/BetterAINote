import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { expect, type Page } from "@playwright/test";

const E2E_ROOT = path.resolve(
    process.env.PLAYWRIGHT_E2E_ROOT ?? path.join(process.cwd(), "tmp/e2e"),
);
const E2E_DATA_DIR = process.env.PLAYWRIGHT_E2E_DATA_DIR
    ? path.resolve(process.env.PLAYWRIGHT_E2E_DATA_DIR)
    : path.join(E2E_ROOT, "data");
const CORE_DB = process.env.DATABASE_PATH
    ? path.resolve(process.env.DATABASE_PATH)
    : path.join(E2E_DATA_DIR, "betterainote-e2e.db");
const LIBRARY_DB = path.join(
    path.dirname(CORE_DB),
    `${path.basename(CORE_DB, path.extname(CORE_DB))}-library${path.extname(CORE_DB) || ".db"}`,
);

export const DASHBOARD_TAG_TRIGGER_RECORDING_PREFIX =
    "e2e-dashboard-tag-trigger-recording-";
export const DASHBOARD_TAG_TRIGGER_TAGS = [
    { color: "purple", icon: "grid", name: "产品周会" },
    { color: "blue", icon: "user", name: "客户访谈" },
    { color: "red", icon: "flag", name: "设计评审" },
    { color: "orange", icon: "clock", name: "技术复盘" },
    { color: "green", icon: "star", name: "销售同步" },
    { color: "slate", icon: "book", name: "个人备忘" },
] as const;

type SeededTag = {
    color: string;
    icon: string;
    id: string;
    name: string;
};

export type DashboardTagTriggerDatabaseState = {
    assignmentCount: number;
    productAssignments: number;
    recordingCount: number;
    tagCount: number;
    tagNames: string[];
    untaggedCount: number;
};

function databaseUrl(filePath: string) {
    return pathToFileURL(filePath).href;
}

function assertIsolatedDatabase(filePath: string) {
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(`${E2E_ROOT}${path.sep}`)) {
        throw new Error(`Refusing non-isolated E2E database: ${resolved}`);
    }
    if (!existsSync(path.join(E2E_ROOT, ".betterainote-e2e-root"))) {
        throw new Error(`Missing isolated E2E marker under ${E2E_ROOT}`);
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

export async function getDashboardTagTriggerUserId() {
    assertIsolatedDatabase(CORE_DB);
    const core = createClient({ url: databaseUrl(CORE_DB) });
    try {
        const result = await executeWithBusyRetry(() =>
            core.execute({
                sql: "SELECT id FROM users WHERE email = ? LIMIT 1",
                args: ["playwright-admin@example.com"],
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

export async function cleanupDashboardTagTriggerSeed(userId: string) {
    assertIsolatedDatabase(LIBRARY_DB);
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    try {
        await executeWithBusyRetry(() =>
            library.execute({
                sql: "DELETE FROM recording_tag_assignments WHERE user_id = ?",
                args: [userId],
            }),
        );
        await executeWithBusyRetry(() =>
            library.execute({
                sql: "DELETE FROM recording_tags WHERE user_id = ?",
                args: [userId],
            }),
        );
        await executeWithBusyRetry(() =>
            library.execute({
                sql: "DELETE FROM recordings WHERE user_id = ?",
                args: [userId],
            }),
        );
    } finally {
        await library.close();
    }
}

async function seedSixRecordings(userId: string) {
    assertIsolatedDatabase(LIBRARY_DB);
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const now = Date.now();
    try {
        await executeWithBusyRetry(() =>
            library.batch(
                Array.from({ length: 6 }, (_, index) => {
                    const suffix = String(index + 1).padStart(2, "0");
                    const recordingId = `${DASHBOARD_TAG_TRIGGER_RECORDING_PREFIX}${suffix}`;
                    const startTime = now - index * 60_000;
                    return {
                        sql: `
                            INSERT INTO recordings (
                                id, user_id, source_provider, source_recording_id,
                                source_version, source_metadata, provider_device_id,
                                filename, duration, start_time, end_time, filesize,
                                file_md5, storage_type, storage_path, downloaded_at,
                                upstream_trashed, upstream_deleted, created_at, updated_at
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `,
                        args: [
                            recordingId,
                            userId,
                            "ticnote",
                            `${recordingId}-source`,
                            "1",
                            "{}",
                            "e2e-dashboard-tag-trigger-device",
                            `Dashboard tag trigger ${suffix}`,
                            120_000,
                            startTime,
                            startTime + 120_000,
                            2048 + index,
                            `${recordingId}-md5`,
                            "local",
                            "",
                            now,
                            0,
                            0,
                            now,
                            now,
                        ],
                    };
                }),
            ),
        );
    } finally {
        await library.close();
    }
}

async function createSixTagsThroughApi(page: Page) {
    const tags: SeededTag[] = [];
    for (const seed of DASHBOARD_TAG_TRIGGER_TAGS) {
        const response = await page.request.post("/api/recording-tags", {
            data: seed,
        });
        expect(response.status(), `POST tag ${seed.name}`).toBe(200);
        const body = (await response.json()) as { tag?: SeededTag };
        expect(body.tag).toEqual(
            expect.objectContaining({
                color: seed.color,
                icon: seed.icon,
                name: seed.name,
            }),
        );
        expect(body.tag?.id).toEqual(expect.any(String));
        tags.push(body.tag as SeededTag);
    }
    return tags;
}

async function assignTagsThroughApi(page: Page, tags: SeededTag[]) {
    const tagByName = new Map(tags.map((tag) => [tag.name, tag]));
    const productTag = tagByName.get("产品周会");
    const secondaryTag = tagByName.get("客户访谈");
    if (!productTag || !secondaryTag) {
        throw new Error("Deterministic dashboard tag seed is incomplete");
    }

    const assignments = [
        { index: "01", tagIds: [productTag.id] },
        { index: "02", tagIds: [productTag.id] },
        { index: "03", tagIds: [secondaryTag.id] },
    ];
    for (const assignment of assignments) {
        const recordingId = `${DASHBOARD_TAG_TRIGGER_RECORDING_PREFIX}${assignment.index}`;
        const response = await page.request.put(
            `/api/recordings/${recordingId}/tags`,
            { data: { tagIds: assignment.tagIds } },
        );
        expect(response.status(), `PUT tags for ${recordingId}`).toBe(200);
    }
}

export async function readDashboardTagTriggerApiTags(page: Page) {
    const response = await page.request.get("/api/recording-tags");
    expect(response.status()).toBe(200);
    const body = (await response.json()) as { tags?: SeededTag[] };
    return body.tags ?? [];
}

export async function readDashboardTagTriggerDatabaseState(
    userId: string,
): Promise<DashboardTagTriggerDatabaseState> {
    assertIsolatedDatabase(LIBRARY_DB);
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    try {
        const [
            recordings,
            tags,
            assignments,
            productAssignments,
            untagged,
        ] = await Promise.all([
            executeWithBusyRetry(() =>
                library.execute({
                    sql: "SELECT COUNT(*) AS count FROM recordings WHERE user_id = ?",
                    args: [userId],
                }),
            ),
            executeWithBusyRetry(() =>
                library.execute({
                    sql: "SELECT name FROM recording_tags WHERE user_id = ? ORDER BY name",
                    args: [userId],
                }),
            ),
            executeWithBusyRetry(() =>
                library.execute({
                    sql: "SELECT COUNT(*) AS count FROM recording_tag_assignments WHERE user_id = ?",
                    args: [userId],
                }),
            ),
            executeWithBusyRetry(() =>
                library.execute({
                    sql: `
                        SELECT COUNT(*) AS count
                        FROM recording_tag_assignments assignments
                        JOIN recording_tags tags ON tags.id = assignments.tag_id
                        WHERE assignments.user_id = ? AND tags.name = ?
                    `,
                    args: [userId, "产品周会"],
                }),
            ),
            executeWithBusyRetry(() =>
                library.execute({
                    sql: `
                        SELECT COUNT(*) AS count
                        FROM recordings recordings
                        WHERE recordings.user_id = ?
                          AND NOT EXISTS (
                              SELECT 1
                              FROM recording_tag_assignments assignments
                              WHERE assignments.user_id = recordings.user_id
                                AND assignments.recording_id = recordings.id
                          )
                    `,
                    args: [userId],
                }),
            ),
        ]);

        return {
            assignmentCount: Number(assignments.rows[0]?.count ?? 0),
            productAssignments: Number(
                productAssignments.rows[0]?.count ?? 0,
            ),
            recordingCount: Number(recordings.rows[0]?.count ?? 0),
            tagCount: tags.rows.length,
            tagNames: tags.rows
                .map((row) => row.name)
                .filter((name): name is string => typeof name === "string"),
            untaggedCount: Number(untagged.rows[0]?.count ?? 0),
        };
    } finally {
        await library.close();
    }
}

export function expectedDashboardTagTriggerDatabaseState(): DashboardTagTriggerDatabaseState {
    return {
        assignmentCount: 3,
        productAssignments: 2,
        recordingCount: 6,
        tagCount: 6,
        tagNames: DASHBOARD_TAG_TRIGGER_TAGS.map((tag) => tag.name).sort(),
        untaggedCount: 3,
    };
}

export async function seedDashboardTagTriggerData(page: Page) {
    const userId = await getDashboardTagTriggerUserId();
    await cleanupDashboardTagTriggerSeed(userId);
    await seedSixRecordings(userId);
    const tags = await createSixTagsThroughApi(page);
    await assignTagsThroughApi(page, tags);

    expect(
        (await readDashboardTagTriggerApiTags(page))
            .map((tag) => tag.name)
            .sort(),
    ).toEqual(DASHBOARD_TAG_TRIGGER_TAGS.map((tag) => tag.name).sort());
    expect(await readDashboardTagTriggerDatabaseState(userId)).toEqual(
        expectedDashboardTagTriggerDatabaseState(),
    );

    return { tags, userId };
}
