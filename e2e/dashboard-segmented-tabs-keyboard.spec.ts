import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { expect, test } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

const E2E_DATA_DIR = path.resolve(process.cwd(), "tmp/e2e/data");
const PLAYWRIGHT_USER_EMAIL = "playwright-admin@example.com";
const TAB_RECORDING_ID = "e2e-segmented-tabs-keyboard";
const TAB_RECORDING_TITLE = "E2E segmented tabs keyboard";
const TAB_TRANSCRIPTION_ID = "e2e-segmented-tabs-keyboard-transcription";
const TAB_SPEAKER_PROFILE_ID = "e2e-segmented-tabs-keyboard-speaker";
const TAB_SPEAKER_LABEL = "E2E Speaker";
const TAB_TRANSCRIPT_TEXT = "Keyboard activation proves real transcript detail.";

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

function databaseUrl(filePath: string) {
    assertE2EDatabasePath(filePath);
    return pathToFileURL(filePath).href;
}

async function executeWithBusyRetry<T>(
    operation: () => Promise<T>,
    attempts = 8,
): Promise<T> {
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

function contentHash(value: string) {
    return createHash("sha256").update(value).digest("hex");
}

const CORE_DB = resolveDatabasePath();
const LIBRARY_DB = deriveSiblingDatabasePath(CORE_DB, "library");
const TRANSCRIPTS_DB = deriveSiblingDatabasePath(CORE_DB, "transcripts");
const VOICEPRINTS_DB = deriveSiblingDatabasePath(CORE_DB, "voiceprints");

async function getPlaywrightUserId() {
    const client = createClient({ url: databaseUrl(CORE_DB) });
    try {
        const result = await executeWithBusyRetry(() =>
            client.execute({
                sql: "SELECT id FROM `users` WHERE email = ? LIMIT 1",
                args: [PLAYWRIGHT_USER_EMAIL],
            }),
        );
        const id = result.rows[0]?.id;
        if (typeof id !== "string") {
            throw new Error("Playwright user not found");
        }
        return id;
    } finally {
        await client.close();
    }
}

async function cleanupSeededRecording() {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const transcripts = createClient({ url: databaseUrl(TRANSCRIPTS_DB) });
    const voiceprints = createClient({ url: databaseUrl(VOICEPRINTS_DB) });

    try {
        await executeWithBusyRetry(() =>
            voiceprints.execute({
                sql: "DELETE FROM recording_speakers WHERE recording_id = ?",
                args: [TAB_RECORDING_ID],
            }),
        );
        await executeWithBusyRetry(() =>
            voiceprints.execute({
                sql: "DELETE FROM speaker_profiles WHERE id = ?",
                args: [TAB_SPEAKER_PROFILE_ID],
            }),
        );
        await executeWithBusyRetry(() =>
            transcripts.execute({
                sql: "DELETE FROM transcript_segments WHERE recording_id = ?",
                args: [TAB_RECORDING_ID],
            }),
        );
        await executeWithBusyRetry(() =>
            transcripts.execute({
                sql: "DELETE FROM transcriptions WHERE recording_id = ?",
                args: [TAB_RECORDING_ID],
            }),
        );
        await executeWithBusyRetry(() =>
            library.execute({
                sql: "DELETE FROM transcription_jobs WHERE recording_id = ?",
                args: [TAB_RECORDING_ID],
            }),
        );
        await executeWithBusyRetry(() =>
            library.execute({
                sql: "DELETE FROM recordings WHERE id = ?",
                args: [TAB_RECORDING_ID],
            }),
        );
    } finally {
        await library.close();
        await transcripts.close();
        await voiceprints.close();
    }
}

async function seedDashboardRecording(userId: string) {
    await cleanupSeededRecording();
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const transcripts = createClient({ url: databaseUrl(TRANSCRIPTS_DB) });
    const voiceprints = createClient({ url: databaseUrl(VOICEPRINTS_DB) });
    const now = Date.now();

    try {
        await executeWithBusyRetry(() =>
            library.execute({
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
                    TAB_RECORDING_ID,
                    userId,
                    "ticnote",
                    `${TAB_RECORDING_ID}-source`,
                    "1",
                    "{}",
                    `${TAB_RECORDING_ID}-device`,
                    TAB_RECORDING_TITLE,
                    120_000,
                    now - 120_000,
                    now,
                    2048,
                    TAB_RECORDING_ID,
                    "local",
                    "",
                    now,
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
                    TAB_TRANSCRIPTION_ID,
                    TAB_RECORDING_ID,
                    userId,
                    `${TAB_SPEAKER_LABEL}: ${TAB_TRANSCRIPT_TEXT}`,
                    "en",
                    "server",
                    "server",
                    "e2e",
                    null,
                    JSON.stringify({ [TAB_SPEAKER_LABEL]: TAB_SPEAKER_LABEL }),
                    "{}",
                    now,
                ],
            }),
        );
        await executeWithBusyRetry(() =>
            transcripts.execute({
                sql: `
                    INSERT INTO transcript_segments (
                        id, recording_id, user_id, transcription_id,
                        source_artifact_id, transcript_origin, provider_segment_id,
                        speaker_profile_id, raw_speaker_label, start_ms, end_ms,
                        sort_seq_ms, text, content_hash, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                args: [
                    `${TAB_RECORDING_ID}-segment-1`,
                    TAB_RECORDING_ID,
                    userId,
                    TAB_TRANSCRIPTION_ID,
                    null,
                    "local",
                    "segment-1",
                    TAB_SPEAKER_PROFILE_ID,
                    TAB_SPEAKER_LABEL,
                    0,
                    8_000,
                    0,
                    TAB_TRANSCRIPT_TEXT,
                    contentHash(TAB_TRANSCRIPT_TEXT),
                    now,
                    now,
                ],
            }),
        );
        await executeWithBusyRetry(() =>
            voiceprints.execute({
                sql: `
                    INSERT INTO speaker_profiles (
                        id, user_id, display_name, voiceprint_ref, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?)
                `,
                args: [
                    TAB_SPEAKER_PROFILE_ID,
                    userId,
                    TAB_SPEAKER_LABEL,
                    null,
                    now,
                    now,
                ],
            }),
        );
        await executeWithBusyRetry(() =>
            voiceprints.execute({
                sql: `
                    INSERT INTO recording_speakers (
                        id, user_id, recording_id, raw_label, matched_profile_id,
                        sample_segments, segment_count, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                args: [
                    `${TAB_RECORDING_ID}-speaker-1`,
                    userId,
                    TAB_RECORDING_ID,
                    TAB_SPEAKER_LABEL,
                    TAB_SPEAKER_PROFILE_ID,
                    JSON.stringify([
                        {
                            startMs: 0,
                            endMs: 8_000,
                            text: TAB_TRANSCRIPT_TEXT,
                        },
                    ]),
                    1,
                    now,
                    now,
                ],
            }),
        );
    } finally {
        await library.close();
        await transcripts.close();
        await voiceprints.close();
    }
}

test("dashboard detail tabs activate speaker pane on keyboard navigation", async ({
    page,
}) => {
    await ensureSignedIn(page);
    const userId = await getPlaywrightUserId();

    try {
        await seedDashboardRecording(userId);

        const recordingResponse = await page.request.get(
            `/api/recordings/${TAB_RECORDING_ID}`,
        );
        await expect(recordingResponse).toBeOK();
        await expect(recordingResponse.json()).resolves.toMatchObject({
            recording: { id: TAB_RECORDING_ID },
            transcription: {
                segments: [
                    expect.objectContaining({
                        speakerLabel: TAB_SPEAKER_LABEL,
                        text: TAB_TRANSCRIPT_TEXT,
                    }),
                ],
            },
        });

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

        const recording = page.getByRole("button", {
            name: new RegExp(TAB_RECORDING_TITLE),
        });
        const tabList = page.getByRole("tablist", { name: "详情标签" });
        const transcriptTab = tabList.getByRole("tab", {
            name: "转写",
            exact: true,
        });
        const speakersTab = tabList.getByRole("tab", {
            name: "说话人",
            exact: true,
        });
        const sourceTab = tabList.getByRole("tab", {
            name: "来源详情",
            exact: true,
        });

        await expect(recording).toBeVisible();
        await recording.click();
        await expect(recording).toHaveAttribute("aria-current", "true");
        await expect(tabList).toBeVisible();
        await expect(transcriptTab).toHaveAttribute("aria-selected", "true");
        await expect(
            page.getByText(TAB_TRANSCRIPT_TEXT, { exact: true }),
        ).toBeVisible();

        await transcriptTab.focus();
        await expect(transcriptTab).toBeFocused();
        await transcriptTab.press("ArrowRight");
        await expect(speakersTab).toBeFocused();
        await expect(speakersTab).toHaveAttribute("aria-selected", "true");
        await expect(transcriptTab).toHaveAttribute("aria-selected", "false");
        await expect(
            page
                .getByRole("listitem")
                .filter({ hasText: TAB_SPEAKER_LABEL }),
        ).toBeVisible();
        await expect(
            page.getByText(TAB_TRANSCRIPT_TEXT, { exact: true }),
        ).toBeHidden();

        await speakersTab.press("ArrowLeft");
        await expect(transcriptTab).toBeFocused();
        await expect(transcriptTab).toHaveAttribute("aria-selected", "true");
        await expect(
            page.getByText(TAB_TRANSCRIPT_TEXT, { exact: true }),
        ).toBeVisible();

        await transcriptTab.press("End");
        await expect(sourceTab).toBeFocused();
        await expect(sourceTab).toHaveAttribute("aria-selected", "true");

        await sourceTab.press("Home");
        await expect(transcriptTab).toBeFocused();
        await expect(transcriptTab).toHaveAttribute("aria-selected", "true");
    } finally {
        await cleanupSeededRecording();
    }
});
