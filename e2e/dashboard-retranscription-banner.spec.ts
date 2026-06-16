import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import {
    expect,
    type Locator,
    type Page,
    type Route,
    test,
    type TestInfo,
} from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";
import {
    SOT_COMPONENT_LIBRARY_URL,
    SOT_WORKSTATION_URL,
} from "./helpers/sot-fixtures";

const E2E_DATA_DIR = path.resolve(process.cwd(), "tmp/e2e/data");
const E2E_STORAGE_DIR = process.env.PLAYWRIGHT_E2E_STORAGE_DIR
    ? path.resolve(process.cwd(), process.env.PLAYWRIGHT_E2E_STORAGE_DIR)
    : path.resolve(process.cwd(), "tmp/e2e/storage");

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

const CORE_DB = resolveDatabasePath();
const LIBRARY_DB = deriveSiblingDatabasePath(CORE_DB, "library");
const TRANSCRIPTS_DB = deriveSiblingDatabasePath(CORE_DB, "transcripts");
const RETX_RECORDING_ID = "e2e-retx-recording";
const RETX_JOB_ID = "e2e-retx-job";
const RETX_TRANSCRIPT_ID = "e2e-retx-transcript";
const RETX_SOT_TAG_ID = "e2e-retx-sot-product-weekly";
const SOURCE_RACE_PREFIX = "e2e-source-report-race-";

type RetranscriptionSeedStatus =
    | "processing"
    | "failed"
    | "succeeded"
    | null;

async function installToggleableClipboardCapture(page: Page) {
    await page.addInitScript(() => {
        const copiedTexts: string[] = [];
        Object.defineProperty(window, "__betterainoteCopiedTexts", {
            value: copiedTexts,
            configurable: true,
        });
        Object.defineProperty(window, "__betterainoteRejectClipboardWrites", {
            value: true,
            writable: true,
            configurable: true,
        });
        Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value: {
                writeText: async (text: string) => {
                    if (
                        (
                            window as unknown as {
                                __betterainoteRejectClipboardWrites: boolean;
                            }
                        ).__betterainoteRejectClipboardWrites
                    ) {
                        throw new Error("Clipboard write rejected by E2E");
                    }
                    copiedTexts.push(String(text));
                },
            },
        });
        Object.defineProperty(document, "execCommand", {
            value: () => false,
            configurable: true,
        });
    });
}

async function readCopiedTexts(page: Page) {
    return page.evaluate(
        () =>
            (
                window as unknown as {
                    __betterainoteCopiedTexts: string[];
                }
            ).__betterainoteCopiedTexts,
    );
}

async function setClipboardRejectWrites(page: Page, shouldReject: boolean) {
    await page.evaluate((nextValue) => {
        (
            window as unknown as {
                __betterainoteRejectClipboardWrites: boolean;
            }
        ).__betterainoteRejectClipboardWrites = nextValue;
    }, shouldReject);
}

function databaseUrl(filePath: string) {
    return pathToFileURL(filePath).href;
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

async function enablePrivateTranscriptionCapability(userId: string) {
    const now = Date.now();
    const core = createClient({ url: databaseUrl(CORE_DB) });
    try {
        await core.execute({
            sql: `
                INSERT INTO user_settings (
                    id, user_id, private_transcription_base_url,
                    private_transcription_min_speakers,
                    private_transcription_max_speakers,
                    private_transcription_denoise_model,
                    private_transcription_no_repeat_ngram_size,
                    private_transcription_max_inflight_jobs,
                    created_at, updated_at
                ) VALUES (?, ?, ?, 0, 0, 'none', 0, 1, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    private_transcription_base_url = excluded.private_transcription_base_url,
                    updated_at = excluded.updated_at
            `,
            args: [
                "e2e-retx-user-settings",
                userId,
                "https://transcribe.e2e.example",
                now,
                now,
            ],
        });
    } finally {
        await core.close();
    }
}

async function resetPrivateTranscriptionCapability(userId: string) {
    const now = Date.now();
    const core = createClient({ url: databaseUrl(CORE_DB) });
    try {
        await core.execute({
            sql: `
                UPDATE user_settings
                SET private_transcription_base_url = NULL,
                    updated_at = ?
                WHERE user_id = ?
            `,
            args: [now, userId],
        });
    } finally {
        await core.close();
    }
}

async function seedRetranscriptionScenario(
    userId: string,
    options: {
        filename: string;
        hasAudio?: boolean;
        status?: RetranscriptionSeedStatus;
        remoteStatus?: string | null;
        lastError?: string | null;
        oldText?: string | null;
        durationMs?: number;
        sourceProvider?: string;
        startTimeMs?: number;
        tag?: {
            color: "red" | "orange" | "green" | "blue" | "purple";
            icon: string;
            id?: string;
            name: string;
        };
        segments?: Array<{
            text: string;
            rawSpeakerLabel?: string | null;
            startMs?: number | null;
            endMs?: number | null;
            sortSeqMs: number;
        }>;
    },
) {
    const now = Date.now();
    const start = options.startTimeMs ?? now - 3_600_000;
    const duration = options.durationMs ?? 180_000;
    const storagePath =
        options.hasAudio === false ? "" : "e2e/retx-fixture.mp3";
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const transcripts = createClient({ url: databaseUrl(TRANSCRIPTS_DB) });

    try {
        await cleanupRunningRetranscriptionSeed();
        if (storagePath) {
            const fixturePath = path.join(E2E_STORAGE_DIR, storagePath);
            await mkdir(path.dirname(fixturePath), { recursive: true });
            await writeFile(fixturePath, Buffer.from("ID3"));
        }
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
                RETX_RECORDING_ID,
                userId,
                options.sourceProvider ?? "ticnote",
                "e2e-retx-source",
                "1",
                "{}",
                "e2e-device",
                options.filename,
                duration,
                start,
                start + duration,
                1024,
                "e2e",
                "local",
                storagePath,
                now,
                0,
                0,
                now,
                now,
            ],
        });
        if (options.tag) {
            const tagId = options.tag.id ?? RETX_SOT_TAG_ID;
            await library.execute({
                sql: `
                    INSERT OR REPLACE INTO recording_tags (
                        id, user_id, name, color, icon, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                `,
                args: [
                    tagId,
                    userId,
                    options.tag.name,
                    options.tag.color,
                    options.tag.icon,
                    now,
                    now,
                ],
            });
            await library.execute({
                sql: `
                    INSERT OR REPLACE INTO recording_tag_assignments (
                        id, user_id, recording_id, tag_id, created_at
                    ) VALUES (?, ?, ?, ?, ?)
                `,
                args: [
                    `${RETX_RECORDING_ID}:${tagId}`,
                    userId,
                    RETX_RECORDING_ID,
                    tagId,
                    now,
                ],
            });
        }
        if (options.status) {
            await library.execute({
                sql: `
                    INSERT OR REPLACE INTO transcription_jobs (
                        id, user_id, recording_id, status, force, provider, model,
                        provider_job_id, remote_status, attempts, last_error,
                        requested_at, started_at, completed_at, next_poll_at,
                        created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                args: [
                    RETX_JOB_ID,
                    userId,
                    RETX_RECORDING_ID,
                    options.status,
                    1,
                    "voice-transcribe",
                    "e2e",
                    "remote-e2e-retx",
                    options.remoteStatus ??
                        (options.status === "processing"
                            ? "transcribing"
                            : options.status === "succeeded"
                              ? "completed"
                              : null),
                    1,
                    options.lastError ?? null,
                    now - 60_000,
                    now - 45_000,
                    options.status === "processing" ? null : now - 10_000,
                    options.status === "processing"
                        ? now + 3_600_000
                        : null,
                    now - 60_000,
                    now,
                ],
            });
        }
        if (options.oldText !== null) {
            await transcripts.execute({
                sql: `
                    INSERT OR REPLACE INTO transcriptions (
                        id, recording_id, user_id, text, detected_language,
                        transcription_type, provider, model, provider_job_id,
                        speaker_map, provider_payload, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                args: [
                    RETX_TRANSCRIPT_ID,
                    RETX_RECORDING_ID,
                    userId,
                    options.oldText ??
                        "Speaker 1: 这是一段旧版本转写。重新转写运行时不能隐藏它。",
                    "zh",
                    "server",
                    "voice-transcribe",
                    "e2e",
                    "remote-e2e-retx-old",
                    "{}",
                    "{}",
                    now - 120_000,
                ],
            });
            if (options.segments?.length) {
                for (const [index, segment] of options.segments.entries()) {
                    await transcripts.execute({
                        sql: `
                            INSERT OR REPLACE INTO transcript_segments (
                                id, recording_id, user_id, transcription_id,
                                transcript_origin, provider_segment_id,
                                raw_speaker_label, start_ms, end_ms, sort_seq_ms,
                                text, content_hash, created_at, updated_at
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `,
                        args: [
                            `${RETX_TRANSCRIPT_ID}:local:segment-${index}`,
                            RETX_RECORDING_ID,
                            userId,
                            RETX_TRANSCRIPT_ID,
                            "local",
                            `segment-${index}`,
                            segment.rawSpeakerLabel ?? null,
                            segment.startMs ?? null,
                            segment.endMs ?? null,
                            segment.sortSeqMs,
                            segment.text,
                            `${RETX_TRANSCRIPT_ID}:hash:${index}`,
                            now - 120_000,
                            now - 120_000,
                        ],
                    });
                }
            }
        }
    } finally {
        await library.close();
        await transcripts.close();
    }

    return RETX_RECORDING_ID;
}

async function seedRunningRetranscription(userId: string) {
    return seedRetranscriptionScenario(userId, {
        filename: "E2E retranscription running",
        status: "processing",
    });
}

async function markRetranscriptionSucceeded(userId: string) {
    const now = Date.now();
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const transcripts = createClient({ url: databaseUrl(TRANSCRIPTS_DB) });
    try {
        await transcripts.execute({
            sql: `
                UPDATE transcriptions
                SET text = ?,
                    provider_job_id = ?,
                    created_at = ?
                WHERE id = ? AND recording_id = ? AND user_id = ?
            `,
            args: [
                "Speaker 1: 这是一段新版本转写。完成横幅应该可以被收起。",
                "remote-e2e-retx-new",
                now,
                RETX_TRANSCRIPT_ID,
                RETX_RECORDING_ID,
                userId,
            ],
        });
        await library.execute({
            sql: `
                UPDATE transcription_jobs
                SET status = 'succeeded',
                    remote_status = 'completed',
                    last_error = NULL,
                    completed_at = ?,
                    next_poll_at = NULL,
                    updated_at = ?
                WHERE id = ?
            `,
            args: [now, now, RETX_JOB_ID],
        });
    } finally {
        await library.close();
        await transcripts.close();
    }
}

async function cleanupRunningRetranscriptionSeed() {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const transcripts = createClient({ url: databaseUrl(TRANSCRIPTS_DB) });

    try {
        await library.execute({
            sql: "DELETE FROM transcription_jobs WHERE id = ? OR recording_id = ?",
            args: [RETX_JOB_ID, RETX_RECORDING_ID],
        });
        await transcripts.execute({
            sql: "DELETE FROM transcript_segments WHERE transcription_id = ? OR recording_id = ?",
            args: [RETX_TRANSCRIPT_ID, RETX_RECORDING_ID],
        });
        await transcripts.execute({
            sql: "DELETE FROM transcriptions WHERE id = ? OR recording_id = ?",
            args: [RETX_TRANSCRIPT_ID, RETX_RECORDING_ID],
        });
        await library.execute({
            sql: "DELETE FROM recording_tag_assignments WHERE recording_id = ? OR tag_id = ?",
            args: [RETX_RECORDING_ID, RETX_SOT_TAG_ID],
        });
        await library.execute({
            sql: "DELETE FROM recordings WHERE id = ?",
            args: [RETX_RECORDING_ID],
        });
        await library.execute({
            sql: "DELETE FROM recording_tags WHERE id = ?",
            args: [RETX_SOT_TAG_ID],
        });
    } finally {
        await library.close();
        await transcripts.close();
    }
}

async function cleanupSourceReportRaceSeeds(userId: string) {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const transcripts = createClient({ url: databaseUrl(TRANSCRIPTS_DB) });

    try {
        await transcripts.execute({
            sql: "DELETE FROM source_artifacts WHERE user_id = ? AND recording_id LIKE ?",
            args: [userId, `${SOURCE_RACE_PREFIX}%`],
        });
        await transcripts.execute({
            sql: "DELETE FROM transcriptions WHERE user_id = ? AND recording_id LIKE ?",
            args: [userId, `${SOURCE_RACE_PREFIX}%`],
        });
        await library.execute({
            sql: "DELETE FROM transcription_jobs WHERE user_id = ? AND recording_id LIKE ?",
            args: [userId, `${SOURCE_RACE_PREFIX}%`],
        });
        await library.execute({
            sql: "DELETE FROM recordings WHERE user_id = ? AND id LIKE ?",
            args: [userId, `${SOURCE_RACE_PREFIX}%`],
        });
    } finally {
        await library.close();
        await transcripts.close();
    }
}

async function selectDashboardRecordingByTitle(page: Page, title: RegExp) {
    const row = page.getByRole("button", { name: title });
    const titleText = title.source.replace(/^\.\*/, "").replace(/\.\*$/, "");

    for (let attempt = 0; attempt < 3; attempt += 1) {
        await row.click();
        if (
            await selectedRecordingTitle(page, title)
                .isVisible({ timeout: 1_000 })
                .catch(() => false)
        ) {
            return;
        }
        await page.waitForTimeout(250);
    }

    await expect(page.getByRole("heading", { name: title })).toContainText(
        titleText,
    );
}

function selectedRecordingTitle(page: Page, title: string | RegExp) {
    return page.getByRole("heading", { name: title });
}

function dashboardTranscriptTab(page: Page) {
    return page.getByRole("tab", { name: "转写" });
}

function dashboardSourceTab(page: Page) {
    return page.getByRole("tab", { name: "来源详情" });
}

async function leaveSelectedRecordingBeforeRetxReseed(page: Page) {
    await page.goto("about:blank", { waitUntil: "load" });
}

function retranscribeButton(page: Page) {
    return page.locator('[data-sot-control="retranscribe-recording"]').first();
}

function dashboardRetranscriptionBanner(page: Page, state?: string) {
    return page.locator(
        state
            ? `[data-sot-panel="dashboard-retranscription"][data-retx-state="${state}"]`
            : '[data-sot-panel="dashboard-retranscription"]',
    );
}

async function dispatchSystemBanner(
    page: Page,
    detail: {
        id?: string;
        state:
            | "offline"
            | "permission-denied"
            | "db-locked"
            | "update-available"
            | "import-progress"
            | "export-progress"
            | null;
    },
) {
    await page.evaluate((eventDetail) => {
        window.dispatchEvent(
            new CustomEvent("betterainote:system-banner", {
                detail: eventDetail,
            }),
        );
    }, detail);
}

function dashboardSourceReport(page: Page, state?: string) {
    return page.locator(
        state
            ? `[data-sot-panel="dashboard-source-report"][data-sot-state="${state}"]`
            : '[data-sot-panel="dashboard-source-report"]',
    );
}

function localTranscriptCopyButton(page: Page) {
    return page.locator('[data-sot-control="copy-local-transcript"]');
}

function sourceTranscriptCopyButton(page: Page) {
    return page.locator('[data-sot-control="copy-source-transcript"]');
}

function sourceReportCopyButton(page: Page) {
    return page.locator('[data-sot-control="copy-source-report"]');
}

function sourceReportRefreshButton(page: Page) {
    return page.locator('[data-sot-control="refresh-source-report"]');
}

function sourceReportOpenSourceControl(page: Page) {
    return dashboardSourceReport(page).locator(
        '[data-sot-control="open-source-record"]',
    );
}

function sourceReportRepullButton(page: Page) {
    return dashboardSourceReport(page).locator(
        'button[data-sot-control="repull-source"]',
    );
}

async function expectSourcePopupUrl(
    page: Page,
    trigger: Locator,
    expectedUrl: string,
) {
    const sourceHostPattern = "https://source.example.test/**";
    const sourceRouteHandler = async (route: Route) => {
        await route.fulfill({
            body: "<!doctype html><title>source</title>",
            contentType: "text/html",
        });
    };

    await page.context().route(sourceHostPattern, sourceRouteHandler);
    try {
        const sourcePopupPromise = page.waitForEvent("popup");
        await trigger.click();
        const sourcePopup = await sourcePopupPromise;
        await sourcePopup.waitForLoadState("domcontentloaded");
        await expect.poll(() => sourcePopup.url()).toBe(expectedUrl);
        await sourcePopup.close();
    } finally {
        await page.context().unroute(sourceHostPattern, sourceRouteHandler);
    }
}

function dashboardPlayer(page: Page) {
    return page.locator('[data-sot-surface="dashboard-recording-player"]');
}

function dashboardPlayerControl(page: Page, control: string) {
    return dashboardPlayer(page).locator(`[data-sot-control="${control}"]`);
}

async function syncDashboardPlayerMediaState(
    page: Page,
    state: { currentSeconds: number; durationSeconds: number },
) {
    await dashboardPlayer(page)
        .locator("audio")
        .evaluate((node, nextState) => {
            const audio = node as HTMLAudioElement;
            let currentTime = nextState.currentSeconds;
            Object.defineProperty(audio, "duration", {
                configurable: true,
                get: () => nextState.durationSeconds,
            });
            Object.defineProperty(audio, "currentTime", {
                configurable: true,
                get: () => currentTime,
                set: (value) => {
                    currentTime = Number(value);
                },
            });
            audio.dispatchEvent(new Event("loadedmetadata"));
            audio.dispatchEvent(new Event("durationchange"));
            audio.dispatchEvent(new Event("timeupdate"));
        }, state);

    await expect(
        dashboardPlayer(page).locator(
            '[data-sot-part="dashboard-player-current-time"]',
        ),
    ).toHaveText("14:32");
    await expect(
        dashboardPlayer(page).locator(
            '[data-sot-part="dashboard-player-duration"]',
        ),
    ).toHaveText("47:18");
    await expect(
        dashboardPlayerControl(page, "dashboard-player-seek"),
    ).toHaveAttribute("data-pct", "31");
}

type SotSourceReportLoadedSubState =
    | "complete"
    | "transcript-missing"
    | "summary-missing"
    | "both-missing";

async function openSotSourceReportState(
    page: Page,
    state: "loaded" | "loading" | "error" | "empty",
    options: {
        recordingId?: string;
        subState?: SotSourceReportLoadedSubState;
    } = {},
) {
    await page.goto(SOT_WORKSTATION_URL, { waitUntil: "load" });
    await page.evaluate(() => {
        document.documentElement.dataset.theme = "dark";
        document.body.dataset.theme = "dark";
    });
    if (options.recordingId) {
        await page.locator(`.row[data-rec="${options.recordingId}"]`).click();
    }
    await page.locator('.lt-tab[data-tab-key="source-report"]').click();
    await page.evaluate((nextState) => {
        const pane = document.querySelector<HTMLElement>(
            '.t-pane[data-tab-pane="source-report"]',
        );
        pane?.removeAttribute("hidden");
        pane?.querySelectorAll<HTMLElement>(".sr-state").forEach((element) => {
            if (element.dataset.state === nextState) {
                element.removeAttribute("hidden");
            } else {
                element.hidden = true;
            }
        });
    }, state);
    const stateLocator = page
        .locator(
            `.t-pane[data-tab-pane="source-report"] .sr-state[data-state="${state}"]`,
        )
        .first();
    await expect(stateLocator).toBeVisible();
    if (state === "loaded" && options.subState) {
        await stateLocator.evaluate((element, subState) => {
            (element as HTMLElement).dataset.subState = subState;
        }, options.subState);
    }
    return stateLocator;
}

function stabilizeSkeletonAnimation(html: string) {
    return `<style>.sk{animation:none!important;background-position:0 50%!important}</style>${html}`;
}

async function readPseudoContent(
    locator: Locator,
    selector: string,
    pseudoElement: "::before" | "::after",
) {
    return locator
        .locator(selector)
        .first()
        .evaluate(
            (element, pseudo) => getComputedStyle(element, pseudo).content,
            pseudoElement,
        );
}

async function applySotSourceReportLoadedSubStateFixture(
    locator: Locator,
    options: {
        actionState: "ready" | "unavailable";
        readableContent: string;
        segmentCount: number;
        subState: SotSourceReportLoadedSubState;
        summaryLabel: string;
        transcriptLabel: string;
    },
) {
    await locator.evaluate(
        (element, fixture) => {
            const root = element as HTMLElement;
            root.dataset.subState = fixture.subState;

            const pillClass = (label: string) =>
                label === "已就绪" ? "sr-pill ok" : "sr-pill warn";
            const pillHtml = (label: string) =>
                `<span class="${pillClass(label)}"><span class="dot"></span>${label}</span>`;
            const cardValues = root.querySelectorAll<HTMLElement>(".sr-card-value");
            const transcriptCard = cardValues.item(1);
            const summaryCard = cardValues.item(2);
            const segmentCountCard = cardValues.item(3);
            if (transcriptCard) {
                transcriptCard.innerHTML = pillHtml(fixture.transcriptLabel);
            }
            if (summaryCard) {
                summaryCard.innerHTML = pillHtml(fixture.summaryLabel);
            }
            if (segmentCountCard) {
                segmentCountCard.textContent = String(fixture.segmentCount);
            }

            const transcriptSub = root.querySelector<HTMLElement>(
                ".sr-section:nth-of-type(1) .sr-section-sub",
            );
            if (transcriptSub) {
                transcriptSub.textContent = `来自钉钉闪记 · ${fixture.segmentCount} 段 · 47:18 总时长`;
            }

            root.querySelectorAll<HTMLElement>(".sr-meta-row").forEach((row) => {
                const key = row.querySelector("dt")?.textContent?.trim();
                const value = row.querySelector<HTMLElement>("dd");
                if (key === "可读内容" && value) {
                    value.textContent = fixture.readableContent;
                }
                if (key === "时长" && value) {
                    value.innerHTML = '<span class="mono">47:18</span>';
                }
            });

            root.querySelectorAll<HTMLButtonElement>(
                ".sr-actions button",
            ).forEach((button) => {
                button.disabled = fixture.actionState === "unavailable";
            });
        },
        options,
    );
}

const SOT_PLAYER_ACTIVE_CURRENT_SECONDS = 14 * 60 + 32;
const SOT_PLAYER_ACTIVE_DURATION_SECONDS = 47 * 60 + 18;
const SOT_PLAYER_ACTIVE_START_MS = new Date(
    "2026-04-22T14:00:00+08:00",
).getTime();

const SOT_STYLE_PROPS = [
    "display",
    "boxSizing",
    "height",
    "minWidth",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "borderTopWidth",
    "borderTopStyle",
    "borderTopColor",
    "borderRadius",
    "backgroundColor",
    "color",
    "fontFamily",
    "fontSize",
    "fontWeight",
    "boxShadow",
] as const;

const SOT_RETX_STYLE_PROPS = [
    ...SOT_STYLE_PROPS,
    "borderBottomWidth",
    "borderBottomStyle",
    "borderBottomColor",
] as const;

const SOT_CONFIRM_SURFACE_STYLE_PROPS = [
    "display",
    "boxSizing",
    "width",
    "maxWidth",
    "marginTop",
    "marginBottom",
    "borderTopWidth",
    "borderTopStyle",
    "borderTopColor",
    "borderRightWidth",
    "borderRightStyle",
    "borderRightColor",
    "borderBottomWidth",
    "borderBottomStyle",
    "borderBottomColor",
    "borderLeftWidth",
    "borderLeftStyle",
    "borderLeftColor",
    "borderRadius",
    "backgroundColor",
    "color",
    "fontFamily",
    "boxShadow",
    "overflow",
] as const;

const SOT_CONFIRM_STACK_STYLE_PROPS = [
    "display",
    "boxSizing",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "marginTop",
    "marginRight",
    "marginBottom",
    "marginLeft",
    "borderTopWidth",
    "borderTopStyle",
    "borderTopColor",
    "backgroundColor",
    "color",
    "fontFamily",
    "fontSize",
    "fontWeight",
    "lineHeight",
    "letterSpacing",
    "justifyContent",
    "gap",
    "flexDirection",
    "listStyleType",
    "alignItems",
] as const;

const SOT_CONFIRM_BUTTON_STYLE_PROPS = [
    ...SOT_STYLE_PROPS,
    "backgroundImage",
    "borderRightWidth",
    "borderRightStyle",
    "borderRightColor",
    "borderBottomWidth",
    "borderBottomStyle",
    "borderBottomColor",
    "borderLeftWidth",
    "borderLeftStyle",
    "borderLeftColor",
] as const;

type SotStyleProp =
    | (typeof SOT_STYLE_PROPS)[number]
    | (typeof SOT_RETX_STYLE_PROPS)[number]
    | (typeof SOT_CONFIRM_SURFACE_STYLE_PROPS)[number]
    | (typeof SOT_CONFIRM_STACK_STYLE_PROPS)[number]
    | (typeof SOT_CONFIRM_BUTTON_STYLE_PROPS)[number];

const SOT_SURFACE_STYLE_PROPS = SOT_STYLE_PROPS.filter(
    (prop) => prop !== "height" && prop !== "minWidth",
);
const SOT_RETX_SURFACE_STYLE_PROPS = SOT_RETX_STYLE_PROPS.filter(
    (prop) => prop !== "height" && prop !== "minWidth",
);

async function readSotStyle(
    page: Page,
    selector: string,
    props: readonly SotStyleProp[] = SOT_STYLE_PROPS,
) {
    return page.locator(selector).first().evaluate(
        (element, propNames) => {
            const style = window.getComputedStyle(element);
            const entries = Object.fromEntries(
                propNames.map((prop) => [
                    prop,
                    (style as unknown as Record<string, string>)[prop] ??
                        style.getPropertyValue(prop),
                ]),
            );
            if (entries.borderTopWidth === "0px") {
                entries.borderTopStyle = "none";
            }
            if (entries.borderBottomWidth === "0px") {
                entries.borderBottomStyle = "none";
            }
            if (entries.borderRightWidth === "0px") {
                entries.borderRightStyle = "none";
            }
            if (entries.borderLeftWidth === "0px") {
                entries.borderLeftStyle = "none";
            }
            return entries;
        },
        props,
    );
}

async function expectSotStyleMatch(
    sotPage: Page,
    productPage: Page,
    selector: string,
    props: readonly SotStyleProp[] = SOT_STYLE_PROPS,
) {
    const [sot, product] = await Promise.all([
        readSotStyle(sotPage, selector, props),
        readSotStyle(productPage, selector, props),
    ]);

    expect(product, selector).toEqual(sot);
}

async function expectSotStylePairMatch(
    sotPage: Page,
    productPage: Page,
    sotSelector: string,
    productSelector: string,
    props: readonly SotStyleProp[] = SOT_STYLE_PROPS,
) {
    const [sot, product] = await Promise.all([
        readSotStyle(sotPage, sotSelector, props),
        readSotStyle(productPage, productSelector, props),
    ]);

    expect(product, `${productSelector} ~= ${sotSelector}`).toEqual(sot);
}

async function readSotBox(page: Page, selector: string) {
    return page.locator(selector).first().evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return {
            height: Math.round(rect.height),
            width: Math.round(rect.width),
        };
    });
}

interface RetxPixelDiff {
    differingPixels: number;
    dimensionsMatch: boolean;
    expectedHeight: number;
    expectedWidth: number;
    maxChannelDelta: number;
    productHeight: number;
    productWidth: number;
}

type RetxFixtureAction =
    | { kind: "none" }
    | { kind: "hover"; productSelector?: string; selector: string }
    | { kind: "focus"; productSelector?: string; selector: string }
    | { kind: "disable"; productSelector?: string; selector: string };

type RetxPixelFrame = {
    name: string;
    stage: {
        height: number;
        width: number;
    };
    viewport: {
        height: number;
        width: number;
    };
};

const RETX_PIXEL_FRAMES = [
    {
        name: "desktop",
        stage: { height: 160, width: 580 },
        viewport: { height: 900, width: 1366 },
    },
    {
        name: "mobile",
        stage: { height: 220, width: 390 },
        viewport: { height: 844, width: 390 },
    },
] as const satisfies readonly RetxPixelFrame[];

const SOURCE_REPORT_PIXEL_FRAMES = [
    {
        name: "desktop",
        stage: { height: 820, width: 580 },
        viewport: { height: 900, width: 1366 },
    },
    {
        name: "mobile",
        stage: { height: 844, width: 390 },
        viewport: { height: 844, width: 390 },
    },
] as const satisfies readonly RetxPixelFrame[];

const TRANSCRIPT_TABS_PIXEL_FRAMES = [
    {
        name: "desktop",
        stage: { height: 54, width: 340 },
        viewport: { height: 900, width: 1366 },
    },
    {
        name: "mobile",
        stage: { height: 54, width: 320 },
        viewport: { height: 844, width: 390 },
    },
] as const satisfies readonly RetxPixelFrame[];

const COPY_BUTTON_PIXEL_FRAMES = [
    {
        name: "desktop",
        stage: { height: 44, width: 140 },
        viewport: { height: 900, width: 1366 },
    },
    {
        name: "mobile",
        stage: { height: 44, width: 140 },
        viewport: { height: 844, width: 390 },
    },
] as const satisfies readonly RetxPixelFrame[];

const LOCAL_TRANSCRIPT_PIXEL_FRAMES = [
    {
        name: "desktop",
        stage: { height: 640, width: 580 },
        viewport: { height: 900, width: 1366 },
    },
    {
        name: "mobile",
        stage: { height: 844, width: 390 },
        viewport: { height: 844, width: 390 },
    },
] as const satisfies readonly RetxPixelFrame[];

function copyButtonHtmlState(
    html: string,
    state: "idle" | "ok" | "err",
    label: string,
) {
    let next = html
        .replace(/\sdata-copy-state="[^"]*"/g, "")
        .replace(/\saria-live="[^"]*"/g, "")
        .replace(
            /(<span class="copy-label">)(.*?)(<\/span>)/s,
            `$1${label}$3`,
        );

    if (state !== "idle") {
        next = next.replace(
            "<button ",
            `<button data-copy-state="${state}" aria-live="polite" `,
        );
    }

    return next;
}

async function readRetxFixtureWidth(locator: Locator) {
    return locator.evaluate((element) =>
        Math.round(element.getBoundingClientRect().width),
    );
}

async function captureRetxHtmlFixture(
    page: Page,
    html: string,
    width: number,
    background = "var(--bg-canvas)",
    action: RetxFixtureAction = { kind: "none" },
    frame?: RetxPixelFrame,
) {
    const fixtureId = `retx-pixel-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`;

    if (frame) {
        await page.setViewportSize(frame.viewport);
        await page.mouse.move(0, 0);
    }

    await page.evaluate(
        ({
            fixtureActionKind,
            fixtureBackground,
            fixtureFrame,
            fixtureHtml,
            fixtureId: id,
            fixtureWidth,
        }) => {
            document.getElementById(id)?.remove();
            document.documentElement.dataset.theme = "dark";
            document.body.dataset.theme = "dark";
            document.querySelectorAll("nextjs-portal").forEach((element) => {
                element.remove();
            });

            const backdrop = document.createElement("div");
            backdrop.id = `${id}-backdrop`;
            backdrop.style.position = "fixed";
            backdrop.style.inset = "0";
            backdrop.style.zIndex = "2147483646";
            backdrop.style.pointerEvents = "none";
            backdrop.style.background = fixtureBackground;
            document.body.appendChild(backdrop);

            const host = document.createElement("div");
            host.id = id;
            host.dataset.previousBodyBackground = document.body.style.background;
            host.dataset.previousHtmlBackground =
                document.documentElement.style.background;
            host.style.position = "fixed";
            host.style.left = fixtureFrame ? "0" : "32px";
            host.style.top = fixtureFrame ? "0" : "32px";
            host.style.zIndex = "2147483647";
            host.style.pointerEvents =
                fixtureActionKind === "none" ? "none" : "auto";
            host.style.background = fixtureBackground;
            document.documentElement.style.background = fixtureBackground;
            document.body.style.background = fixtureBackground;

            const stage = document.createElement("div");
            stage.className = "retx-pixel-stage";
            stage.style.boxSizing = "border-box";
            stage.style.background = fixtureBackground;
            stage.style.display = "flow-root";
            stage.style.overflow = "hidden";
            stage.style.position = "relative";
            stage.style.pointerEvents = "auto";
            stage.style.width = `${fixtureFrame?.stage.width ?? fixtureWidth}px`;
            if (fixtureFrame) {
                stage.style.height = `${fixtureFrame.stage.height}px`;
            }
            stage.innerHTML = fixtureHtml;

            host.appendChild(stage);
            document.body.appendChild(host);
        },
        {
            fixtureActionKind: action.kind,
            fixtureBackground: background,
            fixtureFrame: frame ?? null,
            fixtureHtml: html,
            fixtureId,
            fixtureWidth: width,
        },
    );

    const stage = page.locator(`#${fixtureId} > .retx-pixel-stage`).first();
    try {
        await expect(stage).toBeVisible();
        await page.mouse.move(1, 1);
        if (action.kind !== "none") {
            const target = stage.locator(action.selector).first();
            await expect(target).toBeVisible();
            if (action.kind === "hover") {
                await target.hover();
                await expect
                    .poll(() =>
                        target.evaluate((element) => element.matches(":hover")),
                    )
                    .toBe(true);
            }
            if (action.kind === "focus") {
                await page.keyboard.press("Tab");
                await target.focus();
                await expect
                    .poll(() =>
                        target.evaluate(
                            (element) =>
                                document.activeElement === element &&
                                element.matches(":focus-visible"),
                        ),
                    )
                    .toBe(true);
            }
            if (action.kind === "disable") {
                await target.evaluate((element) => {
                    if (!(element instanceof HTMLButtonElement)) {
                        throw new Error("SOT disabled action target must be a button");
                    }
                    element.disabled = true;
                });
                await expect(target).toBeDisabled();
            }
        }
        await page.evaluate(async (id) => {
            const host = document.getElementById(id);
            const images = Array.from(
                host?.querySelectorAll<HTMLImageElement>(
                    ":scope > .retx-pixel-stage img",
                ) ?? [],
            );
            if (images.length === 0) {
                return;
            }

            const imageTimeoutMs = 1_500;
            const withTimeout = (promise: Promise<void>) =>
                Promise.race([
                    promise,
                    new Promise<void>((resolve) => {
                        window.setTimeout(resolve, imageTimeoutMs);
                    }),
                ]);
            const waitForLoadOrError = (image: HTMLImageElement) => {
                if (image.complete) {
                    return Promise.resolve();
                }

                return new Promise<void>((resolve) => {
                    const cleanup = () => {
                        image.removeEventListener("load", finish);
                        image.removeEventListener("error", finish);
                    };
                    const finish = () => {
                        cleanup();
                        resolve();
                    };

                    image.addEventListener("load", finish, { once: true });
                    image.addEventListener("error", finish, { once: true });
                });
            };

            await Promise.all(
                images.map(async (image) => {
                    if (typeof image.decode === "function") {
                        await withTimeout(
                            image.decode().catch(() => waitForLoadOrError(image)),
                        );
                        return;
                    }

                    await withTimeout(waitForLoadOrError(image));
                }),
            );
            await new Promise<void>((resolve) => {
                window.requestAnimationFrame(() => resolve());
            });
        }, fixtureId);
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
        await page.evaluate((id) => {
            const host = document.getElementById(id);
            document.documentElement.style.background =
                host?.dataset.previousHtmlBackground ?? "";
            document.body.style.background =
                host?.dataset.previousBodyBackground ?? "";
            host?.remove();
            document.getElementById(`${id}-backdrop`)?.remove();
        }, fixtureId);
    }
}

async function captureRetxLocatorFixture(
    page: Page,
    locator: Locator,
    width: number,
) {
    const html = await locator.evaluate((element) => element.outerHTML);
    return captureRetxHtmlFixture(page, html, width);
}

async function captureRetxGroupFixture(
    page: Page,
    locator: Locator,
    width: number,
    background: string,
) {
    const html = await locator.evaluateAll((elements) =>
        elements.map((element) => element.outerHTML).join(""),
    );
    return captureRetxHtmlFixture(page, html, width, background);
}

async function readRetxBackground(locator: Locator) {
    return locator.evaluate((element) => getComputedStyle(element).backgroundColor);
}

async function compareRetxPixels(
    page: Page,
    expected: string,
    actual: string,
): Promise<RetxPixelDiff> {
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
            for (let index = 0; index < expectedData.length; index += 4) {
                const pixelDelta = Math.max(
                    Math.abs(expectedData[index] - actualData[index]),
                    Math.abs(expectedData[index + 1] - actualData[index + 1]),
                    Math.abs(expectedData[index + 2] - actualData[index + 2]),
                    Math.abs(expectedData[index + 3] - actualData[index + 3]),
                );
                if (pixelDelta > 0) {
                    differingPixels += 1;
                    maxChannelDelta = Math.max(maxChannelDelta, pixelDelta);
                }
            }

            return {
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

async function expectRetxPixelsMatch(
    page: Page,
    testInfo: TestInfo,
    label: string,
    sotLocator: Locator,
    productLocator: Locator,
) {
    const width = await readRetxFixtureWidth(sotLocator);
    const [sotCapture, productCapture] = await Promise.all([
        captureRetxLocatorFixture(sotLocator.page(), sotLocator, width),
        captureRetxLocatorFixture(page, productLocator, width),
    ]);
    const diff = await compareRetxPixels(
        page,
        sotCapture.dataUrl,
        productCapture.dataUrl,
    );

    if (
        !diff.dimensionsMatch ||
        diff.differingPixels !== 0 ||
        diff.maxChannelDelta !== 0
    ) {
        const attachmentName = label
            .replace(/[^a-z0-9]+/gi, "-")
            .replace(/^-|-$/g, "")
            .toLowerCase();
        await testInfo.attach(`${attachmentName}-sot.png`, {
            body: sotCapture.screenshot,
            contentType: "image/png",
        });
        await testInfo.attach(`${attachmentName}-product.png`, {
            body: productCapture.screenshot,
            contentType: "image/png",
        });
        await testInfo.attach(`${attachmentName}-diff.json`, {
            body: Buffer.from(JSON.stringify(diff, null, 2)),
            contentType: "application/json",
        });
    }

    const diffLabel = `${label} ${JSON.stringify(diff)}`;
    expect(diff.dimensionsMatch, diffLabel).toBe(true);
    expect(diff.productHeight, diffLabel).toBe(diff.expectedHeight);
    expect(diff.productWidth, diffLabel).toBe(diff.expectedWidth);
    expect(diff.differingPixels, diffLabel).toBe(0);
    expect(diff.maxChannelDelta, diffLabel).toBe(0);
}

async function expectRetxResponsivePixelsMatch(
    page: Page,
    testInfo: TestInfo,
    label: string,
    sotLocator: Locator,
    productLocator: Locator,
    background = "var(--bg-canvas)",
    frames: readonly RetxPixelFrame[] = RETX_PIXEL_FRAMES,
    transformHtml: (html: string) => string = (html) => html,
) {
    const originalProductViewport = page.viewportSize();
    const sotPage = sotLocator.page();
    const originalSotViewport = sotPage.viewportSize();
    const [sotHtml, productHtml] = await Promise.all([
        sotLocator.evaluate((element) => element.outerHTML),
        productLocator.evaluate((element) => element.outerHTML),
    ]);
    const transformedSotHtml = transformHtml(sotHtml);
    const transformedProductHtml = transformHtml(productHtml);

    try {
        for (const frame of frames) {
            const [sotCapture, productCapture] = await Promise.all([
                captureRetxHtmlFixture(
                    sotPage,
                    transformedSotHtml,
                    frame.stage.width,
                    background,
                    { kind: "none" },
                    frame,
                ),
                captureRetxHtmlFixture(
                    page,
                    transformedProductHtml,
                    frame.stage.width,
                    background,
                    { kind: "none" },
                    frame,
                ),
            ]);
            const diff = await compareRetxPixels(
                page,
                sotCapture.dataUrl,
                productCapture.dataUrl,
            );

            if (
                !diff.dimensionsMatch ||
                diff.differingPixels !== 0 ||
                diff.maxChannelDelta !== 0
            ) {
                const attachmentName = `${label}-${frame.name}`
                    .replace(/[^a-z0-9]+/gi, "-")
                    .replace(/^-|-$/g, "")
                    .toLowerCase();
                await testInfo.attach(`${attachmentName}-sot.png`, {
                    body: sotCapture.screenshot,
                    contentType: "image/png",
                });
                await testInfo.attach(`${attachmentName}-product.png`, {
                    body: productCapture.screenshot,
                    contentType: "image/png",
                });
                await testInfo.attach(`${attachmentName}-diff.json`, {
                    body: Buffer.from(JSON.stringify(diff, null, 2)),
                    contentType: "application/json",
                });
            }

            const diffLabel = `${label} ${frame.name} ${JSON.stringify(diff)}`;
            expect(diff.dimensionsMatch, diffLabel).toBe(true);
            expect(diff.productHeight, diffLabel).toBe(diff.expectedHeight);
            expect(diff.productWidth, diffLabel).toBe(diff.expectedWidth);
            expect(diff.differingPixels, diffLabel).toBe(0);
            expect(diff.maxChannelDelta, diffLabel).toBe(0);
        }
    } finally {
        if (originalProductViewport) {
            await page.setViewportSize(originalProductViewport);
        }
        if (originalSotViewport) {
            await sotPage.setViewportSize(originalSotViewport);
        }
    }
}

async function expectRetxResponsiveHtmlPixelsMatch(
    page: Page,
    testInfo: TestInfo,
    label: string,
    sotPage: Page,
    productPage: Page,
    sotHtml: string,
    productHtml: string,
    background = "var(--bg-canvas)",
    frames: readonly RetxPixelFrame[] = RETX_PIXEL_FRAMES,
) {
    const originalProductViewport = productPage.viewportSize();
    const originalSotViewport = sotPage.viewportSize();

    try {
        for (const frame of frames) {
            const [sotCapture, productCapture] = await Promise.all([
                captureRetxHtmlFixture(
                    sotPage,
                    sotHtml,
                    frame.stage.width,
                    background,
                    { kind: "none" },
                    frame,
                ),
                captureRetxHtmlFixture(
                    productPage,
                    productHtml,
                    frame.stage.width,
                    background,
                    { kind: "none" },
                    frame,
                ),
            ]);
            const diff = await compareRetxPixels(
                page,
                sotCapture.dataUrl,
                productCapture.dataUrl,
            );

            if (
                !diff.dimensionsMatch ||
                diff.differingPixels !== 0 ||
                diff.maxChannelDelta !== 0
            ) {
                const attachmentName = `${label}-${frame.name}`
                    .replace(/[^a-z0-9]+/gi, "-")
                    .replace(/^-|-$/g, "")
                    .toLowerCase();
                await testInfo.attach(`${attachmentName}-sot.png`, {
                    body: sotCapture.screenshot,
                    contentType: "image/png",
                });
                await testInfo.attach(`${attachmentName}-product.png`, {
                    body: productCapture.screenshot,
                    contentType: "image/png",
                });
                await testInfo.attach(`${attachmentName}-diff.json`, {
                    body: Buffer.from(JSON.stringify(diff, null, 2)),
                    contentType: "application/json",
                });
            }

            const diffLabel = `${label} ${frame.name} ${JSON.stringify(diff)}`;
            expect(diff.dimensionsMatch, diffLabel).toBe(true);
            expect(diff.productHeight, diffLabel).toBe(diff.expectedHeight);
            expect(diff.productWidth, diffLabel).toBe(diff.expectedWidth);
            expect(diff.differingPixels, diffLabel).toBe(0);
            expect(diff.maxChannelDelta, diffLabel).toBe(0);
        }
    } finally {
        if (originalProductViewport) {
            await productPage.setViewportSize(originalProductViewport);
        }
        if (originalSotViewport) {
            await sotPage.setViewportSize(originalSotViewport);
        }
    }
}

async function expectRetxPixelsMatchWithAction(
    page: Page,
    testInfo: TestInfo,
    label: string,
    sotLocator: Locator,
    productLocator: Locator,
    action: RetxFixtureAction,
) {
    const width = await readRetxFixtureWidth(sotLocator);
    const [sotHtml, productHtml] = await Promise.all([
        sotLocator.evaluate((element) => element.outerHTML),
        productLocator.evaluate((element) => element.outerHTML),
    ]);
    const productAction =
        action.kind === "none" || !("productSelector" in action)
            ? action
            : { ...action, selector: action.productSelector ?? action.selector };
    const sotCapture = await captureRetxHtmlFixture(
        sotLocator.page(),
        sotHtml,
        width,
        "var(--bg-canvas)",
        action,
    );
    const productCapture = await captureRetxHtmlFixture(
        page,
        productHtml,
        width,
        "var(--bg-canvas)",
        productAction,
    );
    const diff = await compareRetxPixels(
        page,
        sotCapture.dataUrl,
        productCapture.dataUrl,
    );

    if (
        !diff.dimensionsMatch ||
        diff.differingPixels !== 0 ||
        diff.maxChannelDelta !== 0
    ) {
        const attachmentName = label
            .replace(/[^a-z0-9]+/gi, "-")
            .replace(/^-|-$/g, "")
            .toLowerCase();
        await testInfo.attach(`${attachmentName}-sot.png`, {
            body: sotCapture.screenshot,
            contentType: "image/png",
        });
        await testInfo.attach(`${attachmentName}-product.png`, {
            body: productCapture.screenshot,
            contentType: "image/png",
        });
        await testInfo.attach(`${attachmentName}-diff.json`, {
            body: Buffer.from(JSON.stringify(diff, null, 2)),
            contentType: "application/json",
        });
    }

    const diffLabel = `${label} ${JSON.stringify(diff)}`;
    expect(diff.dimensionsMatch, diffLabel).toBe(true);
    expect(diff.productHeight, diffLabel).toBe(diff.expectedHeight);
    expect(diff.productWidth, diffLabel).toBe(diff.expectedWidth);
    expect(diff.differingPixels, diffLabel).toBe(0);
    expect(diff.maxChannelDelta, diffLabel).toBe(0);
}

async function expectTransformedPixelsMatch(
    page: Page,
    testInfo: TestInfo,
    label: string,
    sotLocator: Locator,
    productLocator: Locator,
    transformHtml: (html: string) => string,
) {
    const width = await readRetxFixtureWidth(sotLocator);
    const [sotHtml, productHtml] = await Promise.all([
        sotLocator.evaluate((element) => element.outerHTML),
        productLocator.evaluate((element) => element.outerHTML),
    ]);
    const [sotCapture, productCapture] = await Promise.all([
        captureRetxHtmlFixture(
            sotLocator.page(),
            transformHtml(sotHtml),
            width,
        ),
        captureRetxHtmlFixture(page, transformHtml(productHtml), width),
    ]);
    const diff = await compareRetxPixels(
        page,
        sotCapture.dataUrl,
        productCapture.dataUrl,
    );

    if (
        !diff.dimensionsMatch ||
        diff.differingPixels !== 0 ||
        diff.maxChannelDelta !== 0
    ) {
        const attachmentName = label
            .replace(/[^a-z0-9]+/gi, "-")
            .replace(/^-|-$/g, "")
            .toLowerCase();
        await testInfo.attach(`${attachmentName}-sot.png`, {
            body: sotCapture.screenshot,
            contentType: "image/png",
        });
        await testInfo.attach(`${attachmentName}-product.png`, {
            body: productCapture.screenshot,
            contentType: "image/png",
        });
        await testInfo.attach(`${attachmentName}-diff.json`, {
            body: Buffer.from(JSON.stringify(diff, null, 2)),
            contentType: "application/json",
        });
    }

    expect(diff.dimensionsMatch, label).toBe(true);
    expect(diff.productHeight, label).toBe(diff.expectedHeight);
    expect(diff.productWidth, label).toBe(diff.expectedWidth);
    expect(diff.differingPixels, label).toBe(0);
    expect(diff.maxChannelDelta, label).toBe(0);
}

async function expectRetxGroupPixelsMatch(
    page: Page,
    testInfo: TestInfo,
    label: string,
    sotContainer: Locator,
    sotChildren: Locator,
    productChildren: Locator,
) {
    const width = await readRetxFixtureWidth(sotContainer);
    const background = await readRetxBackground(sotContainer);
    const [sotCapture, productCapture] = await Promise.all([
        captureRetxGroupFixture(
            sotContainer.page(),
            sotChildren,
            width,
            background,
        ),
        captureRetxGroupFixture(page, productChildren, width, background),
    ]);
    const diff = await compareRetxPixels(
        page,
        sotCapture.dataUrl,
        productCapture.dataUrl,
    );

    if (
        !diff.dimensionsMatch ||
        diff.differingPixels !== 0 ||
        diff.maxChannelDelta !== 0
    ) {
        const attachmentName = label
            .replace(/[^a-z0-9]+/gi, "-")
            .replace(/^-|-$/g, "")
            .toLowerCase();
        await testInfo.attach(`${attachmentName}-sot.png`, {
            body: sotCapture.screenshot,
            contentType: "image/png",
        });
        await testInfo.attach(`${attachmentName}-product.png`, {
            body: productCapture.screenshot,
            contentType: "image/png",
        });
        await testInfo.attach(`${attachmentName}-diff.json`, {
            body: Buffer.from(JSON.stringify(diff, null, 2)),
            contentType: "application/json",
        });
    }

    expect(diff.dimensionsMatch, label).toBe(true);
    expect(diff.productHeight, label).toBe(diff.expectedHeight);
    expect(diff.productWidth, label).toBe(diff.expectedWidth);
    expect(diff.differingPixels, label).toBe(0);
    expect(diff.maxChannelDelta, label).toBe(0);
}

async function expectRetxResponsiveGroupPixelsMatch(
    page: Page,
    testInfo: TestInfo,
    label: string,
    sotContainer: Locator,
    sotChildren: Locator,
    productChildren: Locator,
    frames: readonly RetxPixelFrame[] = RETX_PIXEL_FRAMES,
) {
    const originalProductViewport = page.viewportSize();
    const sotPage = sotContainer.page();
    const originalSotViewport = sotPage.viewportSize();
    const background = await readRetxBackground(sotContainer);
    const [sotHtml, productHtml] = await Promise.all([
        sotChildren.evaluateAll((elements) =>
            elements.map((element) => element.outerHTML).join(""),
        ),
        productChildren.evaluateAll((elements) =>
            elements.map((element) => element.outerHTML).join(""),
        ),
    ]);

    try {
        for (const frame of frames) {
            const [sotCapture, productCapture] = await Promise.all([
                captureRetxHtmlFixture(
                    sotPage,
                    sotHtml,
                    frame.stage.width,
                    background,
                    { kind: "none" },
                    frame,
                ),
                captureRetxHtmlFixture(
                    page,
                    productHtml,
                    frame.stage.width,
                    background,
                    { kind: "none" },
                    frame,
                ),
            ]);
            const diff = await compareRetxPixels(
                page,
                sotCapture.dataUrl,
                productCapture.dataUrl,
            );

            if (
                !diff.dimensionsMatch ||
                diff.differingPixels !== 0 ||
                diff.maxChannelDelta !== 0
            ) {
                const attachmentName = `${label}-${frame.name}`
                    .replace(/[^a-z0-9]+/gi, "-")
                    .replace(/^-|-$/g, "")
                    .toLowerCase();
                await testInfo.attach(`${attachmentName}-sot.png`, {
                    body: sotCapture.screenshot,
                    contentType: "image/png",
                });
                await testInfo.attach(`${attachmentName}-product.png`, {
                    body: productCapture.screenshot,
                    contentType: "image/png",
                });
                await testInfo.attach(`${attachmentName}-diff.json`, {
                    body: Buffer.from(JSON.stringify(diff, null, 2)),
                    contentType: "application/json",
                });
            }

            const diffLabel = `${label} ${frame.name} ${JSON.stringify(diff)}`;
            expect(diff.dimensionsMatch, diffLabel).toBe(true);
            expect(diff.productHeight, diffLabel).toBe(diff.expectedHeight);
            expect(diff.productWidth, diffLabel).toBe(diff.expectedWidth);
            expect(diff.differingPixels, diffLabel).toBe(0);
            expect(diff.maxChannelDelta, diffLabel).toBe(0);
        }
    } finally {
        if (originalProductViewport) {
            await page.setViewportSize(originalProductViewport);
        }
        if (originalSotViewport) {
            await sotPage.setViewportSize(originalSotViewport);
        }
    }
}

async function confirmRetranscription(page: Page) {
    await page
        .locator('[data-sot-panel="confirm-dialog"]')
        .filter({ hasText: "重新转写" })
        .getByRole("button", { name: "确认重新转写" })
        .click();
}

async function readConfirmDialogSignature(page: Page, selector: string) {
    return page.locator(selector).first().evaluate((root) => {
        function nodeSignature(element: Element): unknown {
            return {
                tag: element.tagName.toLowerCase(),
                className: element.getAttribute("class") ?? "",
                role: element.getAttribute("role"),
                ariaModal: element.getAttribute("aria-modal"),
                text: Array.from(element.childNodes)
                    .filter((node) => node.nodeType === Node.TEXT_NODE)
                    .map((node) => node.textContent?.trim() ?? "")
                    .filter(Boolean)
                    .join(" "),
                children: Array.from(element.children).map(nodeSignature),
            };
        }

        return nodeSignature(root);
    });
}

async function expectConfirmDialogMatchesSot(sotPage: Page, productPage: Page) {
    const sotRoot = "#confirm .confirm-dialog";
    const productRoot = '[data-sot-panel="confirm-dialog"] .confirm-dialog';

    await expect(productPage.locator(productRoot)).toBeVisible();
    await expect(
        await readConfirmDialogSignature(productPage, productRoot),
    ).toEqual(await readConfirmDialogSignature(sotPage, sotRoot));
    await expectSotStylePairMatch(
        sotPage,
        productPage,
        sotRoot,
        productRoot,
        SOT_CONFIRM_SURFACE_STYLE_PROPS,
    );
    await expectSotStylePairMatch(
        sotPage,
        productPage,
        `${sotRoot} .confirm-head`,
        `${productRoot} .confirm-head`,
        SOT_CONFIRM_STACK_STYLE_PROPS,
    );
    await expectSotStylePairMatch(
        sotPage,
        productPage,
        `${sotRoot} .confirm-head h3`,
        `${productRoot} .confirm-head h3`,
        SOT_CONFIRM_STACK_STYLE_PROPS,
    );
    await expectSotStylePairMatch(
        sotPage,
        productPage,
        `${sotRoot} .confirm-body`,
        `${productRoot} .confirm-body`,
        SOT_CONFIRM_STACK_STYLE_PROPS,
    );
    await expectSotStylePairMatch(
        sotPage,
        productPage,
        `${sotRoot} .retx-modal-list`,
        `${productRoot} .retx-modal-list`,
        SOT_CONFIRM_STACK_STYLE_PROPS,
    );
    await expectSotStylePairMatch(
        sotPage,
        productPage,
        `${sotRoot} .retx-modal-list li`,
        `${productRoot} .retx-modal-list li`,
        SOT_CONFIRM_STACK_STYLE_PROPS,
    );
    await expectSotStylePairMatch(
        sotPage,
        productPage,
        `${sotRoot} .confirm-foot`,
        `${productRoot} .confirm-foot`,
        SOT_CONFIRM_STACK_STYLE_PROPS,
    );
    await expectSotStylePairMatch(
        sotPage,
        productPage,
        `${sotRoot} .confirm-foot button:nth-child(1)`,
        `${productRoot} [data-slot="dialog-footer"] [data-slot="button"][data-variant="outline"]`,
        SOT_CONFIRM_BUTTON_STYLE_PROPS,
    );
    await expectSotStylePairMatch(
        sotPage,
        productPage,
        `${sotRoot} .confirm-foot button:nth-child(2)`,
        `${productRoot} [data-slot="dialog-footer"] [data-slot="button"][data-variant="destructive"]`,
        SOT_CONFIRM_BUTTON_STYLE_PROPS,
    );
}

async function clickSourceTabUntilStarted(page: Page, started: Promise<void>) {
    const sourceTab = dashboardSourceTab(page);

    for (let attempt = 0; attempt < 3; attempt += 1) {
        await sourceTab.click();
        if (
            await Promise.race([
                started.then(() => true),
                page.waitForTimeout(1_000).then(() => false),
            ])
        ) {
            return;
        }
    }

    await started;
}

async function seedSourceReportRaceRecordings(userId: string) {
    const now = Date.now();
    const start = now - 2_400_000;
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const transcripts = createClient({ url: databaseUrl(TRANSCRIPTS_DB) });
    const recordings = [
        {
            id: `${SOURCE_RACE_PREFIX}alpha`,
            title: "E2E stale source Alpha",
            startTime: start,
        },
        {
            id: `${SOURCE_RACE_PREFIX}beta`,
            title: "E2E stale source Beta",
            startTime: start + 60_000,
        },
    ];

    try {
        await cleanupSourceReportRaceSeeds(userId);
        for (const recording of recordings) {
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
                    "ticnote",
                    `${recording.id}-source`,
                    "1",
                    "{}",
                    `${recording.id}-device`,
                    recording.title,
                    180_000,
                    recording.startTime,
                    recording.startTime + 180_000,
                    1024,
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
            await transcripts.execute({
                sql: `
                    INSERT OR REPLACE INTO transcriptions (
                        id, recording_id, user_id, text, detected_language,
                        transcription_type, provider, model, provider_job_id,
                        speaker_map, provider_payload, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                args: [
                    `${recording.id}-transcript`,
                    recording.id,
                    userId,
                    `Speaker 1: ${recording.title} local transcript.`,
                    "zh",
                    "server",
                    "voice-transcribe",
                    "e2e",
                    `${recording.id}-remote`,
                    "{}",
                    "{}",
                    now - 60_000,
                ],
            });
        }
    } finally {
        await library.close();
        await transcripts.close();
    }

    return recordings;
}

function makeSourceRaceReport(title: string) {
    return {
        sourceProvider: "ticnote",
        filename: title,
        transcriptReady: true,
        summaryReady: true,
        transcript: {
            text: `Speaker 1: ${title} source transcript.`,
            segmentCount: 1,
            segments: [
                {
                    speaker: "Speaker 1",
                    startMs: 0,
                    endMs: 1200,
                    text: `${title} source transcript.`,
                },
            ],
        },
        summaryMarkdown: `## ${title} source report`,
        detail: {
            provider: "ticnote",
            title,
        },
    };
}

test("dashboard keeps the old transcript visible while retranscription is running", async ({
    page,
}) => {
    let recordingId = RETX_RECORDING_ID;

    try {
        await ensureSignedIn(page);
        const userId = await getPlaywrightUserId();
        recordingId = await seedRunningRetranscription(userId);

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

        await page
            .getByRole("button", { name: /E2E retranscription running/ })
            .click();
        await expect(
            selectedRecordingTitle(page, /E2E retranscription running/),
        ).toBeVisible();
        await expect(dashboardTranscriptTab(page)).toHaveAttribute(
            "aria-selected",
            "true",
        );
        await expect(page.getByText("旧版本转写")).toBeVisible();
        await expect(
            dashboardRetranscriptionBanner(page, "running"),
        ).toContainText("正在重新转写");

        const stateResponse = await page.request.get(
            `/api/recordings/${recordingId}/transcribe`,
        );
        expect(stateResponse.ok()).toBe(true);
    } finally {
        await cleanupRunningRetranscriptionSeed();
    }
});

test("dashboard queues initial private transcription from the empty transcript state", async ({
    page,
}) => {
    let userId: string | null = null;
    try {
        await ensureSignedIn(page);
        userId = await getPlaywrightUserId();
        await enablePrivateTranscriptionCapability(userId);
        await seedRetranscriptionScenario(userId, {
            filename: "E2E initial transcription queued",
            oldText: null,
            status: null,
        });

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await page
            .getByRole("button", { name: /E2E initial transcription queued/ })
            .click();

        await expect(dashboardTranscriptTab(page)).toHaveAttribute(
            "aria-selected",
            "true",
        );
        await expect(page.getByText("还没有逐字稿")).toBeVisible();

        const postRequest = page.waitForRequest(
            (request) =>
                request
                    .url()
                    .includes(`/api/recordings/${RETX_RECORDING_ID}/transcribe`) &&
                request.method() === "POST",
        );
        const postResponse = page.waitForResponse(
            (response) =>
                response
                    .url()
                    .includes(`/api/recordings/${RETX_RECORDING_ID}/transcribe`) &&
                response.request().method() === "POST",
        );
        await retranscribeButton(page).click();
        await confirmRetranscription(page);

        const request = await postRequest;
        expect(request.postDataJSON()).toEqual({ force: true });
        const response = await postResponse;
        expect(response.status()).toBe(202);
        expect(response.ok()).toBe(true);

        await expect(
            dashboardRetranscriptionBanner(page, "queued"),
        ).toContainText("转写任务已加入队列");
        const queuedToast = page
            .locator("#toast-stack .toast")
            .filter({ hasText: "转写任务已加入队列" });
        await expect(queuedToast).toBeVisible();
        await expect(queuedToast).toHaveAttribute("class", "toast");
    } finally {
        await cleanupRunningRetranscriptionSeed();
        if (userId) {
            await resetPrivateTranscriptionCapability(userId);
        }
    }
});

test("dashboard retries retranscription through the visible confirmation flow", async ({
    page,
}) => {
    let userId: string | null = null;
    try {
        await ensureSignedIn(page);
        userId = await getPlaywrightUserId();
        await enablePrivateTranscriptionCapability(userId);
        await seedRetranscriptionScenario(userId, {
            filename: "E2E retranscription failed",
            status: "failed",
            lastError: "E2E transcription failed safely",
        });

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await page
            .getByRole("button", { name: /E2E retranscription failed/ })
            .click();
        await expect(
            selectedRecordingTitle(page, /E2E retranscription failed/),
        ).toBeVisible();
        const failedBanner = dashboardRetranscriptionBanner(page, "failed");
        await expect(failedBanner).toContainText("本次重新转写失败");
        await expect(failedBanner).toContainText(
            "VoScript worker 暂时不可达 · 原稿未被覆盖。",
        );
        await expect(failedBanner).not.toContainText(
            "E2E transcription failed safely",
        );

        let retryPosts = 0;
        await page.route(
            `**/api/recordings/${RETX_RECORDING_ID}/transcribe`,
            async (route) => {
                if (route.request().method() === "POST") {
                    retryPosts += 1;
                }
                await route.continue();
            },
        );

        await retranscribeButton(page).click();
        const confirmDialog = page
            .locator('[data-sot-panel="confirm-dialog"]')
            .filter({ hasText: "重新转写" });
        await expect(confirmDialog).toBeVisible();
        await expect(confirmDialog.locator(".retx-modal-list li")).toHaveText([
            "逐字稿将重新生成 · 估计 1 ~ 3 分钟",
            "说话人映射会保留，但本次结果可能合并不同的片段",
            "本次操作不会影响来源系统中的正本",
        ]);
        await expect(confirmDialog.getByRole("button", { name: "取消" })).toBeFocused();
        await confirmDialog.getByRole("button", { name: "取消" }).click();
        await expect(confirmDialog).not.toBeVisible();
        await expect(retranscribeButton(page)).toBeFocused();
        expect(retryPosts).toBe(0);

        await retranscribeButton(page).click();
        const escapeDialog = page
            .locator('[data-sot-panel="confirm-dialog"]')
            .filter({ hasText: "重新转写" });
        await expect(escapeDialog).toBeVisible();
        await expect(escapeDialog.getByRole("button", { name: "取消" })).toBeFocused();
        await page.keyboard.press("Escape");
        await expect(escapeDialog).not.toBeVisible();
        await expect(retranscribeButton(page)).toBeFocused();
        expect(retryPosts).toBe(0);

        await retranscribeButton(page).click();
        const backdropDialog = page
            .locator('[data-sot-panel="confirm-dialog"]')
            .filter({ hasText: "重新转写" });
        await expect(backdropDialog).toBeVisible();
        await backdropDialog.click({ position: { x: 8, y: 8 } });
        await expect(backdropDialog).not.toBeVisible();
        await expect(retranscribeButton(page)).toBeFocused();
        expect(retryPosts).toBe(0);

        const retryResponse = page.waitForResponse(
            (response) =>
                response
                    .url()
                    .includes(`/api/recordings/${RETX_RECORDING_ID}/transcribe`) &&
                response.request().method() === "POST",
        );
        await retranscribeButton(page).click();
        await expect(
            page
                .locator('[data-sot-panel="confirm-dialog"]')
                .filter({ hasText: "重新转写" }),
        ).toBeVisible();
        await confirmRetranscription(page);
        expect((await retryResponse).ok()).toBe(true);
        expect(retryPosts).toBe(1);
        await expect(
            dashboardRetranscriptionBanner(page, "queued"),
        ).toContainText("转写任务已加入队列");
    } finally {
        await cleanupRunningRetranscriptionSeed();
        if (userId) {
            await resetPrivateTranscriptionCapability(userId);
        }
    }
});

test("dashboard shows and dismisses completed retranscription state", async ({
    page,
}) => {
    let userId: string | null = null;
    try {
        await ensureSignedIn(page);
        userId = await getPlaywrightUserId();
        await enablePrivateTranscriptionCapability(userId);
        await seedRetranscriptionScenario(userId, {
            filename: "E2E retranscription completed",
            status: "succeeded",
        });

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await page
            .getByRole("button", { name: /E2E retranscription completed/ })
            .click();
        await expect(
            selectedRecordingTitle(page, /E2E retranscription completed/),
        ).toBeVisible();

        const completedBanner = dashboardRetranscriptionBanner(
            page,
            "completed",
        );
        await expect(completedBanner).toContainText("重新转写完成");
        await expect(completedBanner).toContainText(
            "逐字稿、说话人映射与摘要已刷新",
        );
        await expect(retranscribeButton(page)).toHaveAttribute(
            "data-retx-state",
            "completed",
        );

        await completedBanner
            .locator('[data-sot-control="dismiss-retranscription-complete"]')
            .click();
        await expect(
            dashboardRetranscriptionBanner(page, "completed"),
        ).not.toBeVisible();
        await expect(retranscribeButton(page)).toHaveAttribute(
            "data-retx-state",
            "idle",
        );
    } finally {
        await cleanupRunningRetranscriptionSeed();
        if (userId) {
            await resetPrivateTranscriptionCapability(userId);
        }
    }
});

test("dashboard exposes unavailable retranscription state for sources without local audio", async ({
    page,
}) => {
    let userId: string | null = null;
    try {
        await ensureSignedIn(page);
        userId = await getPlaywrightUserId();
        await enablePrivateTranscriptionCapability(userId);
        await seedRetranscriptionScenario(userId, {
            filename: "E2E retranscription no local audio",
            hasAudio: false,
        });

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await page
            .getByRole("button", {
                name: /E2E retranscription no local audio/,
            })
            .click();
        await expect(
            selectedRecordingTitle(page, /E2E retranscription no local audio/),
        ).toBeVisible();

        await expect(
            dashboardRetranscriptionBanner(page, "unavailable"),
        ).toBeHidden();
        await expect(page.locator(".retx-disabled-hint")).toHaveText(
            "当前来源不支持私有重转写",
        );
        await expect(page.locator(".retx-disabled-hint")).toBeVisible();
        await expect(retranscribeButton(page)).toHaveAttribute(
            "data-retx-state",
            "unavailable",
        );
        await expect(retranscribeButton(page)).toHaveAttribute(
            "aria-disabled",
            "true",
        );
        await expect(retranscribeButton(page)).toHaveAttribute(
            "title",
            "当前来源不支持私有重转写",
        );
        await expect(retranscribeButton(page)).toBeDisabled();
        await expect(
            page.locator('[data-sot-panel="confirm-dialog"]'),
        ).not.toBeVisible();
    } finally {
        await cleanupRunningRetranscriptionSeed();
        if (userId) {
            await resetPrivateTranscriptionCapability(userId);
        }
    }
});

test("dashboard retranscription primitives match SOT component library styles", async ({
    page,
}, testInfo) => {
    let userId: string | null = null;
    let sotPage: Page | null = null;

    async function openSeededRecording(filename: string) {
        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await page.getByRole("button", { name: new RegExp(filename) }).click();
        await expect(selectedRecordingTitle(page, new RegExp(filename))).toBeVisible();
        await dashboardTranscriptTab(page).click();
    }

    async function expectRetxBannerStyles(state: string) {
        const sotRoot = `#retx .retx-banner[data-retx-state="${state}"]`;
        const productRoot = `[data-sot-panel="dashboard-retranscription"][data-retx-state="${state}"]`;

        if (!sotPage) {
            throw new Error("SOT page missing");
        }

        await expect(page.locator(productRoot)).toBeVisible();
        await expectSotStylePairMatch(
            sotPage,
            page,
            sotRoot,
            productRoot,
            SOT_RETX_SURFACE_STYLE_PROPS,
        );
        await expectSotStylePairMatch(
            sotPage,
            page,
            `${sotRoot} .retx-banner-ico`,
            `${productRoot} .retx-banner-ico`,
            SOT_RETX_STYLE_PROPS,
        );
        await expectSotStylePairMatch(
            sotPage,
            page,
            `${sotRoot} .retx-banner-title`,
            `${productRoot} .retx-banner-title`,
        );
        await expectSotStylePairMatch(
            sotPage,
            page,
            `${sotRoot} .retx-banner-sub`,
            `${productRoot} .retx-banner-sub`,
        );
        await expectRetxPixelsMatch(
            page,
            testInfo,
            `Retx ${state}`,
            sotPage.locator(sotRoot).first(),
            page.locator(productRoot).first(),
        );
        await expectRetxResponsivePixelsMatch(
            page,
            testInfo,
            `Retx ${state} responsive frame`,
            sotPage.locator(sotRoot).first(),
            page.locator(productRoot).first(),
        );
    }

    try {
        await ensureSignedIn(page);
        userId = await getPlaywrightUserId();
        await enablePrivateTranscriptionCapability(userId);
        const resetDisplayResponse = await page.request.put(
            "/api/settings/display",
            {
                data: {
                    dateTimeFormat: "relative",
                    itemsPerPage: 50,
                    recordingListSortOrder: "newest",
                    theme: "dark",
                    uiLanguage: "zh-CN",
                },
            },
        );
        expect(resetDisplayResponse.ok()).toBe(true);

        sotPage = await page.context().newPage();
        await sotPage.goto(SOT_COMPONENT_LIBRARY_URL, { waitUntil: "load" });
        await sotPage.evaluate(() => {
            document.documentElement.dataset.theme = "dark";
            document.body.dataset.theme = "dark";
        });

        await seedRetranscriptionScenario(userId, {
            filename: "E2E retx style queued",
            status: null,
            oldText: null,
        });
        await openSeededRecording("E2E retx style queued");
        const postResponse = page.waitForResponse(
            (response) =>
                response
                    .url()
                    .includes(`/api/recordings/${RETX_RECORDING_ID}/transcribe`) &&
                response.request().method() === "POST",
        );
        await retranscribeButton(page).click();
        const confirmDialog = page
            .locator('[data-sot-panel="confirm-dialog"]')
            .filter({ hasText: "重新转写" });
        await expect(confirmDialog).toBeVisible();
        await expectConfirmDialogMatchesSot(sotPage, page);
        await confirmRetranscription(page);
        expect((await postResponse).ok()).toBe(true);
        await expectRetxBannerStyles("queued");

        await cleanupRunningRetranscriptionSeed();
        await seedRetranscriptionScenario(userId, {
            filename: "E2E retx style running",
            status: "processing",
        });
        await openSeededRecording("E2E retx style running");
        await expectRetxBannerStyles("running");

        await cleanupRunningRetranscriptionSeed();
        await seedRetranscriptionScenario(userId, {
            filename: "E2E retx style failed",
            status: "failed",
            lastError: "VoScript worker 暂时不可达 · 原稿未被覆盖。",
        });
        await openSeededRecording("E2E retx style failed");
        await expectRetxBannerStyles("failed");

        await cleanupRunningRetranscriptionSeed();
        await seedRetranscriptionScenario(userId, {
            filename: "E2E retx style completed",
            status: "succeeded",
        });
        await openSeededRecording("E2E retx style completed");
        await expectRetxBannerStyles("completed");
        const completedSotStage = sotPage
            .locator("#retx .cl-grid > .cl-card:nth-child(4) .cl-stage")
            .first();
        await expectRetxGroupPixelsMatch(
            page,
            testInfo,
            "Retx completed with refresh marker",
            completedSotStage,
            completedSotStage.locator(".retx-banner, .retx-refresh-marker"),
            page.locator(
                '[data-sot-panel="dashboard-retranscription"][data-retx-state="completed"], .retx-refresh-marker',
            ),
        );
        await expectRetxResponsiveGroupPixelsMatch(
            page,
            testInfo,
            "Retx completed with refresh marker responsive frame",
            completedSotStage,
            completedSotStage.locator(".retx-banner, .retx-refresh-marker"),
            page.locator(
                '[data-sot-panel="dashboard-retranscription"][data-retx-state="completed"], .retx-refresh-marker',
            ),
        );

        await cleanupRunningRetranscriptionSeed();
        await seedRetranscriptionScenario(userId, {
            filename: "E2E retx style unavailable",
            hasAudio: false,
        });
        await openSeededRecording("E2E retx style unavailable");
        await expect(
            dashboardRetranscriptionBanner(page, "unavailable"),
        ).toBeHidden();
        await sotPage.goto(SOT_WORKSTATION_URL, { waitUntil: "load" });
        await sotPage.evaluate(() => {
            document.documentElement.dataset.theme = "dark";
            document.body.dataset.theme = "dark";
            document.body.dataset.retxPrivate = "false";
            const hint = document.getElementById("retx-disabled-hint");
            if (hint) {
                hint.hidden = false;
            }
        });
        await expectSotStylePairMatch(
            sotPage,
            page,
            "#retx-disabled-hint",
            ".retx-disabled-hint",
        );
        await expectRetxPixelsMatch(
            page,
            testInfo,
            "Retx unavailable",
            sotPage.locator("#retx-disabled-hint").first(),
            page.locator(".retx-disabled-hint").first(),
        );
        await expectRetxResponsivePixelsMatch(
            page,
            testInfo,
            "Retx unavailable responsive frame",
            sotPage.locator("#retx-disabled-hint").first(),
            page.locator(".retx-disabled-hint").first(),
        );
    } finally {
        await sotPage?.close();
        await cleanupRunningRetranscriptionSeed();
        if (userId) {
            await resetPrivateTranscriptionCapability(userId);
        }
    }
});

test("dashboard keeps retranscription visible while system banners are stacked", async ({
    page,
}) => {
    let userId: string | null = null;
    try {
        await page.setViewportSize({ width: 1440, height: 980 });
        await ensureSignedIn(page);
        userId = await getPlaywrightUserId();
        await enablePrivateTranscriptionCapability(userId);
        await seedRetranscriptionScenario(userId, {
            filename: "E2E retx system stack",
            status: "processing",
        });

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await page
            .getByRole("button", { name: /E2E retx system stack/ })
            .click();
        await expect(
            selectedRecordingTitle(page, /E2E retx system stack/),
        ).toBeVisible();
        await dashboardTranscriptTab(page).click();

        await dispatchSystemBanner(page, {
            id: "retx-stack-offline",
            state: "offline",
        });
        await dispatchSystemBanner(page, {
            id: "retx-stack-update",
            state: "update-available",
        });

        const systemBanners = page.locator(".sys-banner");
        await expect(systemBanners).toHaveCount(2);
        await expect(systemBanners.nth(0)).toHaveAttribute(
            "data-kind",
            "offline",
        );
        await expect(systemBanners.nth(1)).toHaveAttribute(
            "data-kind",
            "update-available",
        );

        const retxBanner = dashboardRetranscriptionBanner(page, "running");
        await expect(retxBanner).toBeVisible();
        await expect(retxBanner).toContainText("正在重新转写");
        await expect(retxBanner).toContainText(
            "已完成 12% · 当前结果仍可阅读，完成后自动刷新。",
        );

        const layout = await page.evaluate(() => {
            const systemRects = Array.from(
                document.querySelectorAll<HTMLElement>(".sys-banner"),
            ).map((element) => element.getBoundingClientRect());
            const retxRect = document
                .querySelector<HTMLElement>(
                    '[data-sot-panel="dashboard-retranscription"][data-retx-state="running"]',
                )
                ?.getBoundingClientRect();
            return {
                systemBottom: Math.max(
                    ...systemRects.map((rect) => rect.bottom),
                ),
                systemTop: Math.min(...systemRects.map((rect) => rect.top)),
                retxTop: retxRect?.top ?? 0,
            };
        });
        expect(layout.systemTop).toBeGreaterThan(0);
        expect(layout.systemBottom).toBeLessThan(layout.retxTop);
    } finally {
        await dispatchSystemBanner(page, { state: null });
        await cleanupRunningRetranscriptionSeed();
        if (userId) {
            await resetPrivateTranscriptionCapability(userId);
        }
    }
});

test("dashboard player exposes SOT seek speed volume and no-audio states", async ({
    page,
}) => {
    let userId: string | null = null;
    try {
        await ensureSignedIn(page);
        userId = await getPlaywrightUserId();
        const playbackResponse = await page.request.put(
            "/api/settings/playback",
            {
                data: {
                    autoPlayNext: false,
                    defaultPlaybackSpeed: 1,
                    defaultVolume: 70,
                },
            },
        );
        expect(playbackResponse.ok()).toBe(true);

        await seedRetranscriptionScenario(userId, {
            filename: "E2E dashboard player controls",
            hasAudio: true,
            status: null,
        });

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await page
            .getByRole("button", { name: /E2E dashboard player controls/ })
            .click();
        await expect(
            selectedRecordingTitle(page, /E2E dashboard player controls/),
        ).toBeVisible();

        await expect(dashboardPlayer(page)).toHaveAttribute(
            "data-sot-state",
            "ready",
        );
        await expect(
            dashboardPlayerControl(page, "dashboard-player-play"),
        ).toBeEnabled();
        await expect(
            dashboardPlayerControl(page, "dashboard-player-seek"),
        ).toHaveAttribute("data-pct", /\d+/);
        const seekControl = dashboardPlayerControl(
            page,
            "dashboard-player-seek",
        );
        await expect(seekControl).toHaveAttribute("data-slot", "slider");
        await expect(seekControl.getByRole("slider")).toHaveAttribute(
            "aria-valuenow",
            /\d+/,
        );
        await expect(seekControl.locator('[data-slot="slider-track"]')).toHaveCount(
            1,
        );
        await expect(seekControl.locator('[data-slot="slider-range"]')).toHaveCount(
            1,
        );
        await expect(seekControl.locator('[data-slot="slider-thumb"]')).toHaveCount(
            1,
        );

        const speedButton = dashboardPlayerControl(
            page,
            "dashboard-player-speed",
        );
        await expect(speedButton).toHaveText("1.0×");
        await speedButton.click();
        await expect(speedButton).toHaveText("1.25×");

        const volumeButton = dashboardPlayerControl(
            page,
            "dashboard-player-volume",
        );
        await expect(volumeButton).toHaveClass(/round-btn/);
        await expect(volumeButton).toHaveClass(/small/);
        await expect(volumeButton).toHaveAttribute("data-sot-state", "closed");
        await volumeButton.click();
        await expect(volumeButton).toHaveAttribute("data-sot-state", "open");
        const volumeSlider = dashboardPlayer(page).getByRole("slider", {
            name: "音量",
        });
        await expect(volumeSlider).toHaveValue("70");
        await expect(dashboardPlayer(page).locator(".vol-num")).toHaveText("70");
        await volumeSlider.fill("0");
        await expect(volumeButton).toHaveAttribute(
            "data-sot-volume-state",
            "muted",
        );

        await seedRetranscriptionScenario(userId, {
            filename: "E2E dashboard player no audio",
            hasAudio: false,
            status: null,
        });
        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await page
            .getByRole("button", { name: /E2E dashboard player no audio/ })
            .click();
        await expect(
            selectedRecordingTitle(page, /E2E dashboard player no audio/),
        ).toBeVisible();
        await expect(dashboardPlayer(page)).toHaveAttribute(
            "data-sot-state",
            "disabled",
        );
        await expect(dashboardPlayer(page).getByText("来源仅同步转写与报告")).toBeVisible();
        await expect(
            dashboardPlayerControl(page, "dashboard-player-play"),
        ).toBeDisabled();
        await expect(
            dashboardPlayerControl(page, "dashboard-player-speed"),
        ).toBeDisabled();
        await expect(
            dashboardPlayerControl(page, "dashboard-player-volume"),
        ).toBeDisabled();
    } finally {
        await cleanupRunningRetranscriptionSeed();
        if (userId) {
            await resetPrivateTranscriptionCapability(userId);
        }
    }
});

test("dashboard player ready state matches SOT active player pixels", async ({
    page,
}, testInfo) => {
    let userId: string | null = null;
    let sotPage: Page | null = null;
    try {
        await ensureSignedIn(page);
        userId = await getPlaywrightUserId();
        const [displayResponse, playbackResponse] = await Promise.all([
            page.request.put("/api/settings/display", {
                data: {
                    dateTimeFormat: "relative",
                    itemsPerPage: 50,
                    recordingListSortOrder: "newest",
                    theme: "dark",
                    uiLanguage: "zh-CN",
                },
            }),
            page.request.put("/api/settings/playback", {
                data: {
                    autoPlayNext: false,
                    defaultPlaybackSpeed: 1,
                    defaultVolume: 70,
                },
            }),
        ]);
        expect(displayResponse.ok()).toBe(true);
        expect(playbackResponse.ok()).toBe(true);

        await seedRetranscriptionScenario(userId, {
            durationMs: SOT_PLAYER_ACTIVE_DURATION_SECONDS * 1000,
            filename: "产品周会 · Q2 priorities review",
            hasAudio: true,
            sourceProvider: "dingtalk-a1",
            startTimeMs: SOT_PLAYER_ACTIVE_START_MS,
            status: null,
            tag: {
                color: "purple",
                icon: "grid",
                id: RETX_SOT_TAG_ID,
                name: "产品周会",
            },
        });

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await page
            .getByRole("button", { name: /产品周会 · Q2 priorities review/ })
            .click();
        await expect(
            selectedRecordingTitle(page, /产品周会 · Q2 priorities review/),
        ).toBeVisible();
        await expect(page.locator("html")).toHaveAttribute(
            "data-theme",
            "dark",
        );
        await syncDashboardPlayerMediaState(page, {
            currentSeconds: SOT_PLAYER_ACTIVE_CURRENT_SECONDS,
            durationSeconds: SOT_PLAYER_ACTIVE_DURATION_SECONDS,
        });
        await expect(dashboardPlayer(page).locator(".src-tag")).toHaveText(
            "钉钉",
        );
        await expect(dashboardPlayer(page).locator(".utag")).toHaveText(
            "产品周会",
        );
        await expect(dashboardPlayer(page).locator(".b.ok")).toHaveText(
            "已更新",
        );

        sotPage = await page.context().newPage();
        await sotPage.goto(SOT_WORKSTATION_URL, { waitUntil: "load" });
        await sotPage.evaluate(() => {
            document.documentElement.dataset.theme = "dark";
            document.body.dataset.theme = "dark";
        });

        await expectRetxPixelsMatch(
            page,
            testInfo,
            "Dashboard player ready",
            sotPage.locator(".real-detail .player").first(),
            dashboardPlayer(page),
        );

        await dashboardPlayerControl(page, "dashboard-player-volume").click();
        await expect(dashboardPlayer(page).locator(".vol-pop")).toBeVisible();
        await sotPage.locator(".real-detail .player .round-btn.small").click();
        await expect(sotPage.locator(".real-detail .vol-pop")).toBeVisible();
        await expectTransformedPixelsMatch(
            page,
            testInfo,
            "Dashboard player volume popover",
            sotPage.locator(".real-detail .vol-pop").first(),
            dashboardPlayer(page).locator(".vol-pop").first(),
            (html) =>
                html
                    .replace(/\s+hidden(="")?/g, "")
                    .replace(
                        'class="vol-pop"',
                        'class="vol-pop" style="position: static; opacity: 1; transform: translateY(0) scale(1);"',
                    ),
        );
    } finally {
        await sotPage?.close();
        await cleanupRunningRetranscriptionSeed();
        if (userId) {
            await resetPrivateTranscriptionCapability(userId);
        }
    }
});

test("dashboard player no-audio banner matches SOT pixels", async ({
    page,
}, testInfo) => {
    let userId: string | null = null;
    let sotPage: Page | null = null;
    try {
        await ensureSignedIn(page);
        userId = await getPlaywrightUserId();
        const displayResponse = await page.request.put("/api/settings/display", {
            data: {
                dateTimeFormat: "relative",
                itemsPerPage: 50,
                recordingListSortOrder: "newest",
                theme: "dark",
                uiLanguage: "zh-CN",
            },
        });
        expect(displayResponse.ok()).toBe(true);

        await seedRetranscriptionScenario(userId, {
            durationMs: SOT_PLAYER_ACTIVE_DURATION_SECONDS * 1000,
            filename: "工程交接 · 后端交付",
            hasAudio: false,
            oldText: null,
            sourceProvider: "dingtalk-a1",
            startTimeMs: new Date("2026-04-21T11:00:00+08:00").getTime(),
            status: null,
        });

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await page
            .getByRole("button", { name: /工程交接 · 后端交付/ })
            .click();
        await expect(
            selectedRecordingTitle(page, /工程交接 · 后端交付/),
        ).toBeVisible();
        const productBanner = dashboardPlayer(page)
            .locator(".no-audio-banner")
            .first();
        await expect(productBanner).toBeVisible();

        sotPage = await page.context().newPage();
        await sotPage.goto(SOT_WORKSTATION_URL, { waitUntil: "load" });
        await sotPage.evaluate(() => {
            document.documentElement.dataset.theme = "dark";
            document.body.dataset.theme = "dark";
            document.body.dataset.hasAudio = "false";
        });
        const sotBanner = sotPage.locator(".real-detail .no-audio-banner").first();
        await expect(sotBanner).toBeVisible();

        await expectTransformedPixelsMatch(
            page,
            testInfo,
            "Dashboard player no-audio banner",
            sotBanner,
            productBanner,
            (html) =>
                html.replace(
                    'class="no-audio-banner"',
                    'class="no-audio-banner" style="display: flex;"',
                ),
        );
    } finally {
        await sotPage?.close();
        await cleanupRunningRetranscriptionSeed();
        if (userId) {
            await resetPrivateTranscriptionCapability(userId);
        }
    }
});

test("dashboard selected workstation primitives match SOT computed styles", async ({
    page,
}, testInfo) => {
    let userId: string | null = null;
    let sotPage: Page | null = null;

    try {
        await ensureSignedIn(page);
        userId = await getPlaywrightUserId();
        const resetDisplayResponse = await page.request.put(
            "/api/settings/display",
            {
                data: {
                    dateTimeFormat: "relative",
                    itemsPerPage: 50,
                    recordingListSortOrder: "newest",
                    theme: "dark",
                    uiLanguage: "zh-CN",
                },
            },
        );
        expect(resetDisplayResponse.ok()).toBe(true);

        await seedRetranscriptionScenario(userId, {
            filename: "产品周会 · Q2 priorities review",
            hasAudio: true,
            oldText:
                "Speaker 1: 这周我们先看 Q2 的三个核心优先级。\nSpeaker 2: dry-run 模式让用户能预览生成结果。",
            status: null,
        });

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await page
            .getByRole("button", { name: /产品周会 · Q2 priorities review/ })
            .click();
        await expect(
            selectedRecordingTitle(page, /产品周会 · Q2 priorities review/),
        ).toBeVisible();
        await expect(dashboardPlayer(page)).toHaveAttribute(
            "data-sot-state",
            "ready",
        );

        sotPage = await page.context().newPage();
        await sotPage.goto(SOT_WORKSTATION_URL, { waitUntil: "load" });
        await sotPage.evaluate(() => {
            document.documentElement.dataset.theme = "dark";
            document.body.dataset.theme = "dark";
        });
        await expect(page.locator("html")).toHaveAttribute(
            "data-theme",
            "dark",
        );
        await expect(sotPage.locator(".topbar-actions > *")).toHaveCount(3);
        await expect(page.locator(".topbar-actions > *")).toHaveCount(3);
        await expect(
            page.locator(
                '.topbar-actions > .avatar[data-sot-control="dashboard-settings"]',
            ),
        ).toHaveCount(1);
        await expect(
            page.locator(
                '.topbar-actions > button.icon-btn[data-sot-control="dashboard-settings"]',
            ),
        ).toHaveCount(0);
        expect(await readSotBox(page, ".topbar-actions")).toEqual(
            await readSotBox(sotPage, ".topbar-actions"),
        );

        for (const selector of [
            ".app",
            ".sidebar",
            ".workspace",
            ".detail",
            ".rec-head",
            ".player",
            ".transcript",
            ".liquid-tabs",
        ]) {
            await expectSotStyleMatch(
                sotPage,
                page,
                selector,
                SOT_SURFACE_STYLE_PROPS,
            );
        }

        for (const selector of [
            ".player-controls",
            ".round-btn.play",
            ".track",
            '[data-sot-control="dashboard-player-speed"]',
            ".lt-ind",
            ".turn p",
        ]) {
            await expectSotStyleMatch(sotPage, page, selector);
        }

        const sotTabs = sotPage.locator(".transcript-head .liquid-tabs").first();
        const productTabs = page.locator(".transcript-head .liquid-tabs").first();
        await expectRetxResponsivePixelsMatch(
            page,
            testInfo,
            "Dashboard transcript tabs active transcript",
            sotTabs,
            productTabs,
            "var(--bg-canvas)",
            TRANSCRIPT_TABS_PIXEL_FRAMES,
        );

        await Promise.all([
            sotPage.locator('.lt-tab[data-tab-key="speakers"]').click(),
            page.locator('.lt-tab[data-tab-key="speakers"]').click(),
        ]);
        await expect(productTabs).toHaveAttribute("data-active", "1");
        await expectRetxResponsivePixelsMatch(
            page,
            testInfo,
            "Dashboard transcript tabs active speakers",
            sotTabs,
            productTabs,
            "var(--bg-canvas)",
            TRANSCRIPT_TABS_PIXEL_FRAMES,
        );

        await Promise.all([
            sotPage.locator('.lt-tab[data-tab-key="source-report"]').click(),
            page.locator('.lt-tab[data-tab-key="source-report"]').click(),
        ]);
        await expect(productTabs).toHaveAttribute("data-active", "2");
        await expectRetxResponsivePixelsMatch(
            page,
            testInfo,
            "Dashboard transcript tabs active source report",
            sotTabs,
            productTabs,
            "var(--bg-canvas)",
            TRANSCRIPT_TABS_PIXEL_FRAMES,
        );
    } finally {
        await sotPage?.close();
        await cleanupRunningRetranscriptionSeed();
        if (userId) {
            await resetPrivateTranscriptionCapability(userId);
        }
    }
});

test("dashboard transcript tab focus and disabled demos match SOT pixels", async ({
    page,
}, testInfo) => {
    let sotPage: Page | null = null;

    try {
        await ensureSignedIn(page);
        const displayResponse = await page.request.put("/api/settings/display", {
            data: {
                dateTimeFormat: "relative",
                itemsPerPage: 50,
                recordingListSortOrder: "newest",
                theme: "dark",
                uiLanguage: "zh-CN",
            },
        });
        expect(displayResponse.ok()).toBe(true);
        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

        sotPage = await page.context().newPage();
        await sotPage.goto(SOT_COMPONENT_LIBRARY_URL, { waitUntil: "load" });
        await sotPage.evaluate(() => {
            document.documentElement.dataset.theme = "dark";
            document.body.dataset.theme = "dark";
        });
        await expect(page.locator("html")).toHaveAttribute(
            "data-theme",
            "dark",
        );

        for (const state of [
            {
                label: "focus",
                locator:
                    "#seg .cl-card:nth-child(3) .liquid-tabs",
            },
            {
                label: "disabled",
                locator:
                    "#seg .cl-card:nth-child(4) .liquid-tabs",
            },
        ] as const) {
            const html = await sotPage
                .locator(state.locator)
                .first()
                .evaluate((element) => element.outerHTML);
            await expectRetxResponsiveHtmlPixelsMatch(
                page,
                testInfo,
                `Dashboard transcript tab ${state.label} demo`,
                sotPage,
                page,
                html,
                html,
                "var(--bg-canvas)",
                TRANSCRIPT_TABS_PIXEL_FRAMES,
            );
        }
    } finally {
        await sotPage?.close();
    }
});

test("dashboard local transcript renders backend segment timestamps", async ({
    page,
}, testInfo) => {
    let sotPage: Page | null = null;
    let releaseDetail: (() => void) | null = null;
    const detailGate = new Promise<void>((resolve) => {
        releaseDetail = resolve;
    });

    try {
        await ensureSignedIn(page);
        const userId = await getPlaywrightUserId();
        const displayResponse = await page.request.put("/api/settings/display", {
            data: {
                dateTimeFormat: "relative",
                itemsPerPage: 50,
                recordingListSortOrder: "newest",
                theme: "dark",
                uiLanguage: "zh-CN",
            },
        });
        expect(displayResponse.ok()).toBe(true);

        const sotSegments = [
            {
                text: "这周我们先看 Q2 的三个核心优先级。第一是把 AI 重命名做稳定，覆盖钉钉、TicNote 和 Plaud 三个来源。第二是说话人审阅的体验要降到三步以内。",
                rawSpeakerLabel: "志远 · CEO",
                startMs: 12_000,
                endMs: 108_000,
                sortSeqMs: 12_000,
            },
            {
                text: "关于 AI 重命名我们和后端确认了，标题写回会先在 TicNote 上线，钉钉这边的 API 还在等审核。我提议先做一个 dry-run 模式，让用户能预览生成结果。",
                rawSpeakerLabel: "文丽 · PM",
                startMs: 110_000,
                endMs: 154_000,
                sortSeqMs: 110_000,
            },
            {
                text: "VoScript 的私有部署文档我已经更新了，下周可以发出来。我们还需要决定 worker 在 Docker 里默认启用还是手动启用，目前我倾向手动 — 自托管用户控制感更强。",
                rawSpeakerLabel: "兆和 · Engineering",
                startMs: 156_000,
                endMs: 200_000,
                sortSeqMs: 156_000,
            },
            {
                text: "同意手动。我们的定位是 self-hosting first，默认行为应该向控制权倾斜。文丽帮忙把 dry-run 的 spec 写一下，下周一过 review。",
                rawSpeakerLabel: "志远 · CEO",
                startMs: 202_000,
                endMs: 245_000,
                sortSeqMs: 202_000,
            },
        ];

        await seedRetranscriptionScenario(userId, {
            filename: "产品周会 · Q2 priorities review",
            status: null,
            oldText: sotSegments
                .map(
                    (segment) =>
                        `${segment.rawSpeakerLabel}: ${segment.text}`,
                )
                .join("\n"),
            segments: sotSegments,
        });

        await page.route(
            `**/api/recordings/${RETX_RECORDING_ID}`,
            async (route) => {
                await detailGate;
                try {
                    const response = await route.fetch();
                    await route.fulfill({ response });
                } catch {
                    await route.abort("failed").catch(() => {});
                }
            },
        );

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await page
            .getByRole("button", { name: /产品周会 · Q2 priorities review/ })
            .click();
        await expect(
            selectedRecordingTitle(page, /产品周会 · Q2 priorities review/),
        ).toBeVisible();
        await dashboardTranscriptTab(page).click();

        sotPage = await page.context().newPage();
        await sotPage.goto(SOT_WORKSTATION_URL, { waitUntil: "load" });
        await sotPage.evaluate(() => {
            document.documentElement.dataset.theme = "dark";
            document.body.dataset.theme = "dark";
        });

        const transcriptPane = page.locator('[data-tab-pane="transcript"]');
        await expect(transcriptPane.locator(".turn.skel-turn")).toHaveCount(3);
        const [sotSkeletonHtml, productSkeletonTurnsHtml] = await Promise.all([
            sotPage
                .locator(".skel-detail .transcript-body")
                .first()
                .evaluate((element) => element.outerHTML),
            transcriptPane.locator(".turn.skel-turn").evaluateAll((elements) =>
                elements.map((element) => element.outerHTML).join(""),
            ),
        ]);
        await expectRetxResponsiveHtmlPixelsMatch(
            page,
            testInfo,
            "Dashboard local transcript loading skeleton",
            sotPage,
            page,
            sotSkeletonHtml,
            `<div class="transcript-body">${productSkeletonTurnsHtml}</div>`,
            "var(--bg-canvas)",
            LOCAL_TRANSCRIPT_PIXEL_FRAMES,
        );

        releaseDetail?.();
        const turns = transcriptPane.locator(".turn");
        await expect(turns).toHaveCount(4);
        await expect(turns.nth(0).locator(".speaker-name")).toHaveText(
            "志远 · CEO",
        );
        await expect(turns.nth(0).locator(".avatar-sm")).toHaveText("志");
        await expect(turns.nth(0).locator(".ts.mono")).toHaveText(
            "00:12 – 01:48",
        );
        await expect(turns.nth(0).locator("p")).toHaveText(
            sotSegments[0].text,
        );
        await expect(turns.nth(1).locator(".speaker-name")).toHaveText(
            "文丽 · PM",
        );
        await expect(turns.nth(1).locator(".avatar-sm")).toHaveText("文");
        await expect(turns.nth(1).locator(".ts.mono")).toHaveText(
            "01:50 – 02:34",
        );
        await expect(turns.nth(1).locator("p")).toHaveText(
            sotSegments[1].text,
        );
        await expect(
            transcriptPane.locator(".turn .ts.mono").filter({ hasText: "--" }),
        ).toHaveCount(0);
        await expectRetxResponsivePixelsMatch(
            page,
            testInfo,
            "Dashboard local transcript ready turns",
            sotPage.locator('.t-pane[data-tab-pane="transcript"]').first(),
            transcriptPane,
            "var(--bg-canvas)",
            LOCAL_TRANSCRIPT_PIXEL_FRAMES,
        );

        await cleanupRunningRetranscriptionSeed();
        await seedRetranscriptionScenario(userId, {
            filename: "E2E transcript empty state",
            oldText: null,
            status: null,
        });
        await sotPage.goto(SOT_COMPONENT_LIBRARY_URL, { waitUntil: "load" });
        await sotPage.evaluate(() => {
            document.documentElement.dataset.theme = "dark";
            document.body.dataset.theme = "dark";
        });
        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await page
            .getByRole("button", { name: /E2E transcript empty state/ })
            .click();
        const emptyState = page
            .locator('[data-tab-pane="transcript"] .empty-state')
            .first();
        await expect(emptyState).toBeVisible();
        await expectRetxResponsivePixelsMatch(
            page,
            testInfo,
            "Dashboard local transcript empty",
            sotPage.locator("#turn .cl-card:nth-child(2) .empty-state").first(),
            emptyState,
            "var(--bg-canvas)",
            LOCAL_TRANSCRIPT_PIXEL_FRAMES,
        );
    } finally {
        releaseDetail?.();
        await page.unrouteAll({ behavior: "ignoreErrors" });
        await sotPage?.close();
        await cleanupRunningRetranscriptionSeed();
    }
});

test("dashboard local transcript copy states match SOT pixels", async ({
    page,
}, testInfo) => {
    await installToggleableClipboardCapture(page);
    let sotPage: Page | null = null;

    try {
        await ensureSignedIn(page);
        const userId = await getPlaywrightUserId();
        const displayResponse = await page.request.put("/api/settings/display", {
            data: {
                dateTimeFormat: "relative",
                itemsPerPage: 50,
                recordingListSortOrder: "newest",
                theme: "dark",
                uiLanguage: "zh-CN",
            },
        });
        expect(displayResponse.ok()).toBe(true);
        await seedRetranscriptionScenario(userId, {
            filename: "E2E local transcript copy pixels",
            status: null,
            oldText: "Speaker 1: 本地逐字稿复制像素态。",
        });

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await page
            .getByRole("button", { name: /E2E local transcript copy pixels/ })
            .click();
        await expect(page.getByText("本地逐字稿复制像素态")).toBeVisible();

        sotPage = await page.context().newPage();
        await sotPage.goto(SOT_WORKSTATION_URL, { waitUntil: "load" });
        await sotPage.evaluate(() => {
            document.documentElement.dataset.theme = "dark";
            document.body.dataset.theme = "dark";
        });
        await expect(page.locator("html")).toHaveAttribute(
            "data-theme",
            "dark",
        );
        const sotIdleHtml = await sotPage
            .locator('.copy-btn[data-copy="transcript"]')
            .first()
            .evaluate((element) => element.outerHTML);
        const localCopy = localTranscriptCopyButton(page);
        await expect(localCopy).toBeVisible();
        await expect(localCopy).toBeEnabled();

        await expectRetxResponsiveHtmlPixelsMatch(
            page,
            testInfo,
            "Dashboard local transcript copy idle",
            sotPage,
            page,
            copyButtonHtmlState(sotIdleHtml, "idle", "复制转录"),
            await localCopy.evaluate((element) => element.outerHTML),
            "var(--bg-canvas)",
            COPY_BUTTON_PIXEL_FRAMES,
        );

        await setClipboardRejectWrites(page, false);
        await localCopy.click();
        await expect(localCopy).toHaveAttribute("data-copy-state", "ok");
        await expect(localCopy.locator(".copy-label")).toHaveText("已复制");
        await expectRetxResponsiveHtmlPixelsMatch(
            page,
            testInfo,
            "Dashboard local transcript copy success",
            sotPage,
            page,
            copyButtonHtmlState(sotIdleHtml, "ok", "已复制"),
            await localCopy.evaluate((element) => element.outerHTML),
            "var(--bg-canvas)",
            COPY_BUTTON_PIXEL_FRAMES,
        );

        await setClipboardRejectWrites(page, true);
        await localCopy.click();
        await expect(localCopy).toHaveAttribute("data-copy-state", "err");
        await expect(localCopy.locator(".copy-label")).toHaveText("复制失败");
        await expectRetxResponsiveHtmlPixelsMatch(
            page,
            testInfo,
            "Dashboard local transcript copy error",
            sotPage,
            page,
            copyButtonHtmlState(sotIdleHtml, "err", "复制失败"),
            await localCopy.evaluate((element) => element.outerHTML),
            "var(--bg-canvas)",
            COPY_BUTTON_PIXEL_FRAMES,
        );
    } finally {
        await sotPage?.close();
        await cleanupRunningRetranscriptionSeed();
    }
});

test("dashboard transcription panel copies text and switches speaker/source tabs", async ({
    page,
}) => {
    let copiedText = "";
    await page.exposeFunction(
        "__captureBetterAiNoteClipboardText",
        (text: string) => {
            copiedText = text;
        },
    );
    await page.addInitScript(() => {
        Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value: {
                writeText: async (text: string) => {
                    await (
                        window as Window & {
                            __captureBetterAiNoteClipboardText: (
                                text: string,
                            ) => Promise<void>;
                        }
                    ).__captureBetterAiNoteClipboardText(text);
                },
            },
        });
    });

    try {
        await ensureSignedIn(page);
        const userId = await getPlaywrightUserId();
        await seedRetranscriptionScenario(userId, {
            filename: "E2E transcript tabs and copy",
            status: null,
            oldText: "Speaker 1: 复制这段转录。\nSpeaker 2: 切换标签也要稳定。",
        });
        await page.route(
            `**/api/recordings/${RETX_RECORDING_ID}/source-report`,
            async (route) => {
                await route.fulfill({
                    contentType: "application/json",
                    body: JSON.stringify({
                        sourceProvider: "ticnote",
                        filename: "E2E transcript tabs and copy",
                        transcriptReady: true,
                        summaryReady: true,
                        transcript: {
                            text: "Speaker 1: 来源原始转录。",
                            segmentCount: 1,
                            segments: [
                                {
                                    speaker: "Speaker 1",
                                    startMs: 0,
                                    endMs: 1200,
                                    text: "来源原始转录。",
                                },
                            ],
                        },
                        summaryMarkdown: "来源原始报告。",
                        detail: {
                            provider: "ticnote",
                            title: "E2E transcript tabs and copy",
                        },
                    }),
                });
            },
        );

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await page
            .getByRole("button", { name: /E2E transcript tabs and copy/ })
            .click();

        const transcriptPane = page.locator('[data-tab-pane="transcript"]');
        const speakersPane = page.locator('[data-tab-pane="speakers"]');
        const sourceReportPane = page.locator('[data-tab-pane="source-report"]');
        await expect(
            page.locator(
                '.transcript-body > [data-sot-panel="dashboard-retranscription"]',
            ),
        ).toHaveCount(1);
        await expect(
            page.locator('[data-sot-panel="dashboard-retranscription"]'),
        ).toHaveCount(1);
        await expect(transcriptPane).toBeVisible();
        await expect(speakersPane).toBeHidden();
        await expect(sourceReportPane).toBeHidden();
        await expect(page.locator(".copy-btn[data-copy]")).toHaveCount(3);
        await expect(page.getByText("复制这段转录")).toBeVisible();
        await expect(localTranscriptCopyButton(page)).toBeVisible();
        await expect(localTranscriptCopyButton(page)).toBeEnabled();
        await expect(localTranscriptCopyButton(page)).toHaveAttribute(
            "data-copy",
            "transcript",
        );
        await expect(localTranscriptCopyButton(page)).toHaveAttribute(
            "data-tab-scope",
            "transcript",
        );
        await expect(
            localTranscriptCopyButton(page).locator(".copy-ico svg"),
        ).toHaveCount(2);
        await expect(sourceTranscriptCopyButton(page)).toBeHidden();
        await expect(sourceReportCopyButton(page)).toBeHidden();

        await localTranscriptCopyButton(page).click();
        await expect(localTranscriptCopyButton(page)).toHaveAttribute(
            "data-copy-state",
            "ok",
        );
        await expect(localTranscriptCopyButton(page).locator(".copy-label")).toHaveText(
            "已复制",
        );
        await expect
            .poll(() => copiedText)
            .toContain("切换标签也要稳定");

        await page.getByRole("tab", { name: "说话人" }).click();
        await expect(transcriptPane).toBeHidden();
        await expect(speakersPane).toBeVisible();
        await expect(sourceReportPane).toBeHidden();
        await expect(page.getByText(/\d+ 段说话人/)).toBeVisible();
        await expect(localTranscriptCopyButton(page)).toBeHidden();
        await expect(sourceTranscriptCopyButton(page)).toBeHidden();
        await expect(sourceReportCopyButton(page)).toBeHidden();
        await expect(retranscribeButton(page)).toBeHidden();

        await dashboardSourceTab(page).click();
        await expect(transcriptPane).toBeHidden();
        await expect(speakersPane).toBeHidden();
        await expect(sourceReportPane).toBeVisible();
        await expect(
            dashboardSourceReport(page, "loaded").locator(".sr-section h4"),
        ).toHaveText(["来源转写", "来源信息"]);
        await expect(dashboardSourceReport(page, "loaded")).toContainText(
            "来源原始转录",
        );
        await expect(dashboardSourceReport(page, "loaded")).not.toContainText(
            "来源摘要/报告",
        );
        await expect(localTranscriptCopyButton(page)).toBeHidden();
        await expect(sourceTranscriptCopyButton(page)).toBeVisible();
        await expect(sourceTranscriptCopyButton(page)).toBeEnabled();
        await expect(sourceTranscriptCopyButton(page)).toHaveAttribute(
            "data-copy",
            "source-transcript",
        );
        await expect(sourceTranscriptCopyButton(page)).toHaveAttribute(
            "data-tab-scope",
            "source-report",
        );
        await expect(sourceReportCopyButton(page)).toBeVisible();
        await expect(sourceReportCopyButton(page)).toBeEnabled();
        await expect(sourceReportCopyButton(page)).toHaveAttribute(
            "data-copy",
            "source-report",
        );
        await expect(sourceReportCopyButton(page)).toHaveAttribute(
            "data-tab-scope",
            "source-report",
        );
        await expect(retranscribeButton(page)).toBeHidden();

        await sourceTranscriptCopyButton(page).click();
        await expect(sourceTranscriptCopyButton(page)).toHaveAttribute(
            "data-copy-state",
            "ok",
        );
        await expect.poll(() => copiedText).toContain("来源原始转录");
        await expect.poll(() => copiedText).toContain("0:00 - 0:01 · Speaker 1");

        await sourceReportCopyButton(page).click();
        await expect(sourceReportCopyButton(page)).toHaveAttribute(
            "data-copy-state",
            "ok",
        );
        await expect.poll(() => copiedText).toContain("来源原始报告");
    } finally {
        await cleanupRunningRetranscriptionSeed();
    }
});

test("dashboard source report loaded state matches SOT pixels", async (
    { page },
    testInfo,
) => {
    let sotPage: Page | null = null;
    const title = "产品周会 · Q2 priorities review";
    const sourceSegments = [
        {
            speaker: "志远",
            startMs: 12_000,
            endMs: 108_000,
            text: "这周我们先看 Q2 的三个核心优先级。第一是把 AI 重命名做稳定，覆盖钉钉、TicNote 和 Plaud 三个来源。",
        },
        {
            speaker: "文丽",
            startMs: 110_000,
            endMs: 154_000,
            text: "关于 AI 重命名我们和后端确认了，标题写回会先在 TicNote 上线，钉钉这边的 API 还在等审核。",
        },
        {
            speaker: "兆和",
            startMs: 156_000,
            endMs: 200_000,
            text: "VoScript 的私有部署文档我已经更新了，下周可以发出来。worker 在 Docker 里我倾向默认手动启用。",
        },
        {
            speaker: "志远",
            startMs: 202_000,
            endMs: 245_000,
            text: "同意手动。我们的定位是 self-hosting first，默认行为应该向控制权倾斜。文丽帮忙把 dry-run 的 spec 写一下。",
        },
        {
            speaker: "文丽",
            startMs: 248_000,
            endMs: 312_000,
            text: "第二个话题，说话人审阅。当前流程要点开三个抽屉，目标是把合并、改名、确认压到一个面板里。",
        },
    ];

    try {
        await ensureSignedIn(page);
        const userId = await getPlaywrightUserId();
        await seedRetranscriptionScenario(userId, {
            durationMs: 872_000,
            filename: title,
            oldText: "Speaker 1: 本地转写用于打开详情。",
            sourceProvider: "dingtalk-a1",
            startTimeMs: Date.parse("2026-04-22T06:00:00.000Z"),
            status: null,
        });
        await page.route(
            `**/api/recordings/${RETX_RECORDING_ID}/source-report`,
            async (route) => {
                await route.fulfill({
                    contentType: "application/json",
                    body: JSON.stringify({
                        detail: {
                            language: "简体中文 (zh-CN)",
                            providerName: "钉钉 闪记",
                            providerSentenceName: "钉钉闪记",
                            readableContent: "音频 · 转写 · 摘要 · 说话人",
                            recordedAt: "2026-04-22T06:00:00.000Z",
                            sourceTitle: "Q2 Sync · 周一",
                            updatedAt: "2026-04-22T08:38:00.000Z",
                        },
                        filename: title,
                        sourceActions: {
                            openSource: {
                                available: true,
                                url: "https://example.invalid/dingtalk-source",
                            },
                            repullSource: { available: true },
                        },
                        sourceProvider: "dingtalk-a1",
                        summaryMarkdown: "来源原始报告。",
                        summaryReady: true,
                        transcript: {
                            segmentCount: 38,
                            segments: sourceSegments,
                            text: sourceSegments
                                .map((segment) => segment.text)
                                .join("\n"),
                        },
                        transcriptReady: true,
                    }),
                });
            },
        );

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await page.getByRole("button", { name: new RegExp(title) }).click();

        sotPage = await page.context().newPage();
        await sotPage.goto(SOT_WORKSTATION_URL, { waitUntil: "load" });
        await sotPage.evaluate(() => {
            document.documentElement.dataset.theme = "dark";
            document.body.dataset.theme = "dark";
        });
        await sotPage.locator('.lt-tab[data-tab-key="source-report"]').click();
        const sotLoaded = sotPage
            .locator(
                '.t-pane[data-tab-pane="source-report"] .sr-state[data-state="loaded"]',
            )
            .first();
        await expect(sotLoaded).toBeVisible();

        await dashboardSourceTab(page).click();
        const productLoaded = dashboardSourceReport(page, "loaded")
            .locator('.sr-state[data-state="loaded"]')
            .first();
        await expect(productLoaded).toBeVisible();
        await expect(productLoaded.locator(".sr-section h4")).toHaveText([
            "来源转写",
            "来源信息",
        ]);

        await expectRetxPixelsMatch(
            page,
            testInfo,
            "Dashboard source report loaded",
            sotLoaded,
            productLoaded,
        );
        await expectRetxResponsivePixelsMatch(
            page,
            testInfo,
            "Dashboard source report loaded responsive frame",
            sotLoaded,
            productLoaded,
            "var(--bg-canvas)",
            SOURCE_REPORT_PIXEL_FRAMES,
        );
        const productActionButtons = productLoaded.locator(
            '.sr-actions [data-slot="button"]',
        );
        await expect(productActionButtons).toHaveCount(2);
        const openSourceAction = productActionButtons.nth(0);
        const repullSourceAction = productActionButtons.nth(1);
        await expect(openSourceAction).toHaveAttribute(
            "data-sot-control",
            "open-source-record",
        );
        await expect(openSourceAction).toHaveAttribute("data-variant", "ghost");
        await expect(openSourceAction).toHaveAttribute("data-size", "sm");
        await expect(openSourceAction).toBeEnabled();
        await expect(openSourceAction).toContainText("在钉钉中打开");
        await expect(repullSourceAction).toHaveAttribute(
            "data-sot-control",
            "repull-source",
        );
        await expect(repullSourceAction).toHaveAttribute("data-variant", "ghost");
        await expect(repullSourceAction).toHaveAttribute("data-size", "sm");
        await expect(repullSourceAction).toBeEnabled();
        await expect(repullSourceAction).toContainText("重新拉取来源");

        const sotSourceActions = sotLoaded.locator(".sr-actions").first();
        const productSourceActions = productLoaded.locator(".sr-actions").first();
        const sourceActionStates: Array<{
            action: RetxFixtureAction;
            label: string;
        }> = [
            {
                action: {
                    kind: "hover",
                    productSelector:
                        '[data-sot-control="open-source-record"]',
                    selector: "button:nth-child(1)",
                },
                label: "Dashboard source open action hover",
            },
            {
                action: {
                    kind: "hover",
                    productSelector: '[data-sot-control="repull-source"]',
                    selector: "button:nth-child(2)",
                },
                label: "Dashboard source repull action hover",
            },
            {
                action: {
                    kind: "focus",
                    productSelector:
                        '[data-sot-control="open-source-record"]',
                    selector: "button:nth-child(1)",
                },
                label: "Dashboard source open action focus",
            },
            {
                action: {
                    kind: "focus",
                    productSelector: '[data-sot-control="repull-source"]',
                    selector: "button:nth-child(2)",
                },
                label: "Dashboard source repull action focus",
            },
            {
                action: {
                    kind: "disable",
                    productSelector:
                        '[data-sot-control="open-source-record"]',
                    selector: "button:nth-child(1)",
                },
                label: "Dashboard source open action disabled",
            },
            {
                action: {
                    kind: "disable",
                    productSelector: '[data-sot-control="repull-source"]',
                    selector: "button:nth-child(2)",
                },
                label: "Dashboard source repull action disabled",
            },
        ];

        for (const { action, label } of sourceActionStates) {
            await expectRetxPixelsMatchWithAction(
                page,
                testInfo,
                label,
                sotSourceActions,
                productSourceActions,
                action,
            );
        }
    } finally {
        await sotPage?.close();
        await cleanupRunningRetranscriptionSeed();
    }
});

test("dashboard source report summary-missing loaded sub-state matches SOT pixels", async (
    { page },
    testInfo,
) => {
    let sotPage: Page | null = null;
    const title = "市场研究讨论 0410";
    const sourceSegments = [
        {
            speaker: "文丽",
            startMs: 12_000,
            endMs: 62_000,
            text: "四款竞品访谈反馈：能私有化是明确决策点。",
        },
    ];

    try {
        await ensureSignedIn(page);
        const userId = await getPlaywrightUserId();
        await seedRetranscriptionScenario(userId, {
            filename: title,
            durationMs: 28 * 60_000 + 55_000,
            oldText: "Speaker 1: summary missing state opens source details.",
            sourceProvider: "iflyrec",
            startTimeMs: new Date("2026-04-10T06:30:00.000Z").getTime(),
            status: null,
        });
        await page.route(
            `**/api/recordings/${RETX_RECORDING_ID}/source-report`,
            async (route) => {
                await route.fulfill({
                    contentType: "application/json",
                    body: JSON.stringify({
                        detail: {
                            language: "简体中文 (zh-CN)",
                            providerName: "讯飞听见",
                            providerSentenceName: "讯飞听见",
                            readableContent: "音频 · 转写",
                            recordedAt: "2026-04-10T06:30:00.000Z",
                            sourceTitle: title,
                            statusLabel: "待处理",
                            updatedAt: "2026-04-10T07:20:00.000Z",
                        },
                        filename: title,
                        sourceActions: {
                            openSource: {
                                available: true,
                                url: "https://example.invalid/iflyrec-source",
                            },
                            repullSource: { available: true },
                        },
                        sourceProvider: "iflyrec",
                        summaryMarkdown: "",
                        summaryReady: "未生成",
                        transcript: {
                            segmentCount: 12,
                            segments: sourceSegments,
                            text: sourceSegments
                                .map((segment) => segment.text)
                                .join("\n"),
                        },
                        transcriptReady: "已就绪",
                    }),
                });
            },
        );

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await page.getByRole("button", { name: new RegExp(title) }).click();

        sotPage = await page.context().newPage();
        const sotLoaded = await openSotSourceReportState(sotPage, "loaded", {
            recordingId: "rec-market-0410",
            subState: "summary-missing",
        });

        await dashboardSourceTab(page).click();
        const productLoaded = dashboardSourceReport(page, "loaded")
            .locator('.sr-state[data-state="loaded"]')
            .first();
        await expect(productLoaded).toBeVisible();
        await expect(productLoaded).toHaveAttribute(
            "data-sub-state",
            "summary-missing",
        );
        await expect(productLoaded.locator(".sr-card").nth(2)).toContainText(
            "未生成",
        );
        await expect(productLoaded.locator(".sr-empty")).toHaveCount(0);
        await expect(sourceReportCopyButton(page)).toBeEnabled();
        expect(
            await readPseudoContent(
                productLoaded,
                ".sr-section:nth-of-type(2)",
                "::before",
            ),
        ).toBe('"来源未提供官方摘要。"');

        await expectRetxPixelsMatch(
            page,
            testInfo,
            "Dashboard source report summary missing",
            sotLoaded,
            productLoaded,
        );
        await expectRetxResponsivePixelsMatch(
            page,
            testInfo,
            "Dashboard source report summary missing responsive frame",
            sotLoaded,
            productLoaded,
            "var(--bg-canvas)",
            SOURCE_REPORT_PIXEL_FRAMES,
        );
    } finally {
        await sotPage?.close();
        await cleanupRunningRetranscriptionSeed();
    }
});

test("dashboard source report transcript and both-missing sub-states use SOT loaded shell", async (
    { page },
    testInfo,
) => {
    let sotPage: Page | null = null;
    await ensureSignedIn(page);
    const userId = await getPlaywrightUserId();
    const sourceReportRoute = `**/api/recordings/${RETX_RECORDING_ID}/source-report`;
    const title = "产品周会 · Q2 priorities review";

    try {
        sotPage = await page.context().newPage();
        await seedRetranscriptionScenario(userId, {
            filename: title,
            durationMs: 47 * 60_000 + 18_000,
            oldText: "Speaker 1: transcript missing state opens source details.",
            sourceProvider: "dingtalk-a1",
            startTimeMs: Date.parse("2026-04-22T06:00:00.000Z"),
            status: null,
        });
        await page.route(sourceReportRoute, async (route) => {
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify({
                    detail: {
                        language: "简体中文 (zh-CN)",
                        providerName: "钉钉 闪记",
                        providerSentenceName: "钉钉闪记",
                        readableContent: "音频 · 转写 · 摘要 · 说话人",
                        recordedAt: "2026-04-22T06:00:00.000Z",
                        sourceTitle: "Q2 Sync · 周一",
                        statusLabel: "已同步",
                        updatedAt: "2026-04-22T08:38:00.000Z",
                    },
                    filename: title,
                    sourceActions: {
                        openSource: {
                            available: true,
                            url: "https://example.invalid/dingtalk-source",
                        },
                        repullSource: { available: true },
                    },
                    sourceProvider: "dingtalk-a1",
                    summaryMarkdown: "来源官方摘要仍然可读。",
                    summaryReady: true,
                    transcript: null,
                    transcriptReady: false,
                }),
            });
        });

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await page
            .getByRole("button", {
                name: new RegExp(title),
            })
            .click();
        await dashboardSourceTab(page).click();
        const sotTranscriptMissing = await openSotSourceReportState(
            sotPage,
            "loaded",
            {
                recordingId: "rec-product-weekly",
                subState: "transcript-missing",
            },
        );
        await applySotSourceReportLoadedSubStateFixture(sotTranscriptMissing, {
            actionState: "ready",
            readableContent: "音频 · 转写 · 摘要 · 说话人",
            segmentCount: 0,
            subState: "transcript-missing",
            summaryLabel: "已就绪",
            transcriptLabel: "未生成",
        });
        const transcriptMissing = dashboardSourceReport(page, "loaded")
            .locator('.sr-state[data-state="loaded"]')
            .first();
        await expect(transcriptMissing).toBeVisible();
        await expect(transcriptMissing).toHaveAttribute(
            "data-sub-state",
            "transcript-missing",
        );
        await expect(transcriptMissing.locator(".sr-empty")).toHaveCount(0);
        await expect(transcriptMissing.locator(".sr-segments")).toHaveCount(1);
        await expect(transcriptMissing.locator(".sr-card").nth(1)).toContainText(
            "未生成",
        );
        await expect(transcriptMissing.locator(".sr-card").nth(2)).toContainText(
            "已就绪",
        );
        await expect(sourceTranscriptCopyButton(page)).toBeDisabled();
        await expect(sourceReportCopyButton(page)).toBeEnabled();
        expect(
            await readPseudoContent(
                transcriptMissing,
                ".sr-section:nth-of-type(1)",
                "::after",
            ),
        ).toBe(
            '"来源未提供逐字稿。可以稍后再来，或运行私有转写。"',
        );
        await expectRetxPixelsMatch(
            page,
            testInfo,
            "Dashboard source report transcript missing",
            sotTranscriptMissing,
            transcriptMissing,
        );
        await expectRetxResponsivePixelsMatch(
            page,
            testInfo,
            "Dashboard source report transcript missing responsive frame",
            sotTranscriptMissing,
            transcriptMissing,
            "var(--bg-canvas)",
            SOURCE_REPORT_PIXEL_FRAMES,
        );
        await page.unroute(sourceReportRoute);
        await cleanupRunningRetranscriptionSeed();

        await seedRetranscriptionScenario(userId, {
            filename: title,
            durationMs: 47 * 60_000 + 18_000,
            oldText: "Speaker 1: both missing state opens source details.",
            sourceProvider: "dingtalk-a1",
            startTimeMs: Date.parse("2026-04-22T06:00:00.000Z"),
            status: null,
        });
        await page.route(sourceReportRoute, async (route) => {
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify({
                    detail: {
                        language: "简体中文 (zh-CN)",
                        providerName: "钉钉 闪记",
                        providerSentenceName: "钉钉闪记",
                        readableContent: "音频",
                        recordedAt: "2026-04-22T06:00:00.000Z",
                        sourceTitle: "Q2 Sync · 周一",
                        statusLabel: "已同步",
                        updatedAt: "2026-04-22T08:38:00.000Z",
                    },
                    filename: title,
                    sourceActions: {
                        openSource: { available: false },
                        repullSource: { available: false },
                    },
                    sourceProvider: "dingtalk-a1",
                    summaryMarkdown: "",
                    summaryReady: false,
                    transcript: null,
                    transcriptReady: false,
                }),
            });
        });

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await page.getByRole("button", { name: new RegExp(title) }).click();
        await dashboardSourceTab(page).click();
        const sotBothMissing = await openSotSourceReportState(
            sotPage,
            "loaded",
            {
                recordingId: "rec-product-weekly",
                subState: "both-missing",
            },
        );
        await applySotSourceReportLoadedSubStateFixture(sotBothMissing, {
            actionState: "unavailable",
            readableContent: "音频",
            segmentCount: 0,
            subState: "both-missing",
            summaryLabel: "未生成",
            transcriptLabel: "未生成",
        });
        const bothMissing = dashboardSourceReport(page, "loaded")
            .locator('.sr-state[data-state="loaded"]')
            .first();
        await expect(bothMissing).toBeVisible();
        await expect(bothMissing).toHaveAttribute(
            "data-sub-state",
            "both-missing",
        );
        await expect(bothMissing.locator(".sr-empty")).toHaveCount(0);
        await expect(bothMissing.locator(".sr-card").nth(1)).toContainText(
            "未生成",
        );
        await expect(bothMissing.locator(".sr-card").nth(2)).toContainText(
            "未生成",
        );
        await expect(sourceTranscriptCopyButton(page)).toBeDisabled();
        await expect(sourceReportCopyButton(page)).toBeEnabled();
        await expect(sourceReportOpenSourceControl(page)).toHaveAttribute(
            "data-sot-state",
            "unavailable",
        );
        await expect(sourceReportRepullButton(page)).toHaveAttribute(
            "data-sot-state",
            "unavailable",
        );
        expect(
            await readPseudoContent(
                bothMissing,
                ".sr-section:nth-of-type(1)",
                "::after",
            ),
        ).toBe(
            '"来源未提供逐字稿。可以稍后再来，或运行私有转写。"',
        );
        expect(
            await readPseudoContent(
                bothMissing,
                ".sr-section:nth-of-type(2)",
                "::before",
            ),
        ).toBe('"来源未提供官方摘要。"');
        await expectRetxPixelsMatch(
            page,
            testInfo,
            "Dashboard source report both missing",
            sotBothMissing,
            bothMissing,
        );
        await expectRetxResponsivePixelsMatch(
            page,
            testInfo,
            "Dashboard source report both missing responsive frame",
            sotBothMissing,
            bothMissing,
            "var(--bg-canvas)",
            SOURCE_REPORT_PIXEL_FRAMES,
        );
    } finally {
        await page.unroute(sourceReportRoute).catch(() => null);
        await sotPage?.close();
        await cleanupRunningRetranscriptionSeed();
    }
});

test("dashboard source report loading, error, and empty states match SOT pixels", async (
    { page },
    testInfo,
) => {
    let sotPage: Page | null = null;
    let loadingReportStarted = false;
    let releaseLoadingReport = () => {};
    let resolveLoadingStarted = () => {};
    let resolveLoadingSettled = () => {};
    const loadingStarted = new Promise<void>((resolve) => {
        resolveLoadingStarted = resolve;
    });
    const loadingSettled = new Promise<void>((resolve) => {
        resolveLoadingSettled = resolve;
    });
    const loadingGate = new Promise<void>((resolve) => {
        releaseLoadingReport = resolve;
    });
    const sourceReportRoute = `**/api/recordings/${RETX_RECORDING_ID}/source-report`;

    try {
        await ensureSignedIn(page);
        const userId = await getPlaywrightUserId();
        sotPage = await page.context().newPage();

        await seedRetranscriptionScenario(userId, {
            filename: "E2E source report SOT loading",
            oldText: "Speaker 1: loading state opens source details.",
            sourceProvider: "dingtalk-a1",
            status: null,
        });
        await page.route(sourceReportRoute, async (route) => {
            loadingReportStarted = true;
            resolveLoadingStarted();
            await loadingGate;
            try {
                await route
                    .fulfill({
                        contentType: "application/json",
                        body: JSON.stringify({
                            filename: "E2E source report SOT loading",
                            sourceProvider: "dingtalk-a1",
                            summaryMarkdown: "",
                            summaryReady: false,
                            transcript: null,
                            transcriptReady: false,
                        }),
                    })
                    .catch(() => null);
            } finally {
                resolveLoadingSettled();
            }
        });
        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await page
            .getByRole("button", { name: /E2E source report SOT loading/ })
            .click();
        await dashboardSourceTab(page).click();
        await loadingStarted;
        const productLoading = dashboardSourceReport(page, "loading")
            .locator('.sr-state[data-state="loading"]')
            .first();
        await expect(productLoading).toBeVisible();
        const sotLoading = await openSotSourceReportState(sotPage, "loading");
        await expectTransformedPixelsMatch(
            page,
            testInfo,
            "Dashboard source report loading",
            sotLoading,
            productLoading,
            stabilizeSkeletonAnimation,
        );
        await expectRetxResponsivePixelsMatch(
            page,
            testInfo,
            "Dashboard source report loading responsive frame",
            sotLoading,
            productLoading,
            "var(--bg-canvas)",
            SOURCE_REPORT_PIXEL_FRAMES,
            stabilizeSkeletonAnimation,
        );
        releaseLoadingReport();
        await loadingSettled;
        await page.unroute(sourceReportRoute);
        await leaveSelectedRecordingBeforeRetxReseed(page);
        await cleanupRunningRetranscriptionSeed();

        await seedRetranscriptionScenario(userId, {
            filename: "E2E source report SOT error",
            oldText: "Speaker 1: error state opens source details.",
            sourceProvider: "dingtalk-a1",
            status: null,
        });
        await page.route(sourceReportRoute, async (route) => {
            await route.fulfill({
                contentType: "application/json",
                status: 503,
                body: JSON.stringify({
                    error: "Source report temporarily unavailable",
                }),
            });
        });
        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await page
            .getByRole("button", { name: /E2E source report SOT error/ })
            .click();
        await dashboardSourceTab(page).click();
        const productError = dashboardSourceReport(page, "error")
            .locator('.sr-state[data-state="error"]')
            .first();
        await expect(productError).toBeVisible();
        await expect(productError).toHaveAttribute(
            "data-sot-error",
            "Source report temporarily unavailable",
        );
        const sourceLogButton = productError.getByRole("button", {
            name: "查看同步日志",
        });
        await sourceLogButton.click();
        await expect(
            page.locator('[data-sot-panel="dashboard-activity"]'),
        ).toBeVisible();
        const sotError = await openSotSourceReportState(sotPage, "error");
        await expectRetxPixelsMatch(
            page,
            testInfo,
            "Dashboard source report error",
            sotError,
            productError,
        );
        await expectRetxResponsivePixelsMatch(
            page,
            testInfo,
            "Dashboard source report error responsive frame",
            sotError,
            productError,
            "var(--bg-canvas)",
            SOURCE_REPORT_PIXEL_FRAMES,
        );
        await page.unroute(sourceReportRoute);
        await leaveSelectedRecordingBeforeRetxReseed(page);
        await cleanupRunningRetranscriptionSeed();

        let emptySourceReportRequests = 0;
        await seedRetranscriptionScenario(userId, {
            filename: "E2E source report SOT empty",
            oldText: "Speaker 1: empty state opens source details.",
            sourceProvider: "",
            status: null,
        });
        await page.route(sourceReportRoute, async (route) => {
            emptySourceReportRequests += 1;
            await route.fulfill({
                contentType: "application/json",
                status: 500,
                body: JSON.stringify({ error: "unexpected request" }),
            });
        });
        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await page
            .getByRole("button", { name: /E2E source report SOT empty/ })
            .click();
        await dashboardSourceTab(page).click();
        const productEmpty = dashboardSourceReport(page, "empty")
            .locator('.sr-state[data-state="empty"]')
            .first();
        await expect(productEmpty).toBeVisible();
        await page.waitForTimeout(300);
        expect(emptySourceReportRequests).toBe(0);
        const sotEmpty = await openSotSourceReportState(sotPage, "empty");
        await expectRetxPixelsMatch(
            page,
            testInfo,
            "Dashboard source report empty",
            sotEmpty,
            productEmpty,
        );
        await expectRetxResponsivePixelsMatch(
            page,
            testInfo,
            "Dashboard source report empty responsive frame",
            sotEmpty,
            productEmpty,
            "var(--bg-canvas)",
            SOURCE_REPORT_PIXEL_FRAMES,
        );
    } finally {
        releaseLoadingReport();
        if (loadingReportStarted) {
            await loadingSettled.catch(() => null);
        }
        await page.unroute(sourceReportRoute).catch(() => null);
        await sotPage?.close();
        await leaveSelectedRecordingBeforeRetxReseed(page).catch(() => null);
        await cleanupRunningRetranscriptionSeed();
    }
});

test("dashboard transcription copy actions recover after clipboard write rejection", async ({
    page,
}) => {
    await installToggleableClipboardCapture(page);

    try {
        await ensureSignedIn(page);
        const userId = await getPlaywrightUserId();
        await seedRetranscriptionScenario(userId, {
            filename: "E2E dashboard clipboard rejection",
            status: null,
            oldText: "Speaker 1: 仪表盘复制失败后必须可以恢复。",
        });
        await page.route(
            `**/api/recordings/${RETX_RECORDING_ID}/source-report`,
            async (route) => {
                await route.fulfill({
                    contentType: "application/json",
                    body: JSON.stringify({
                        sourceProvider: "ticnote",
                        filename: "E2E dashboard clipboard rejection",
                        transcriptReady: true,
                        summaryReady: true,
                        transcript: {
                            text: "Speaker 1: 来源恢复转录。",
                            segmentCount: 1,
                            segments: [
                                {
                                    speaker: "Speaker 1",
                                    startMs: 0,
                                    endMs: 1200,
                                    text: "来源恢复转录。",
                                },
                            ],
                        },
                        summaryMarkdown: "来源恢复报告。",
                        detail: {
                            provider: "ticnote",
                            title: "E2E dashboard clipboard rejection",
                        },
                    }),
                });
            },
        );

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await page
            .getByRole("button", {
                name: /E2E dashboard clipboard rejection/,
            })
            .click();

        await expect(page.getByText("复制失败后必须可以恢复")).toBeVisible();

        const localCopyButton = localTranscriptCopyButton(page);
        await localCopyButton.click();
        await expect(localCopyButton).toHaveAttribute("data-copy-state", "err");
        await expect(localCopyButton.locator(".copy-label")).toHaveText(
            "复制失败",
        );
        await expect(
            page.getByText("复制转录失败，请检查浏览器剪贴板权限。"),
        ).toBeVisible();
        await expect(localCopyButton).toBeEnabled();
        await expect(localCopyButton).toContainText("复制转录", {
            timeout: 2500,
        });
        expect(await readCopiedTexts(page)).toEqual([]);

        await dashboardSourceTab(page).click();
        await expect(dashboardSourceReport(page, "loaded")).toContainText(
            "摘要状态",
        );
        await expect(dashboardSourceReport(page, "loaded")).toContainText(
            "来源信息",
        );

        const sourceTranscriptButton = sourceTranscriptCopyButton(page);
        await sourceTranscriptButton.click();
        await expect(sourceTranscriptButton).toHaveAttribute(
            "data-copy-state",
            "err",
        );
        await expect(sourceTranscriptButton.locator(".copy-label")).toHaveText(
            "复制失败",
        );
        await expect(
            page.getByText("复制失败，请检查浏览器剪贴板权限。"),
        ).toBeVisible();
        await expect(sourceTranscriptButton).toBeEnabled();
        await expect(sourceTranscriptButton).toContainText("复制原始转录", {
            timeout: 2500,
        });
        expect(await readCopiedTexts(page)).toEqual([]);

        await setClipboardRejectWrites(page, false);
        await sourceReportCopyButton(page).click();
        await expect(sourceReportCopyButton(page)).toHaveAttribute(
            "data-copy-state",
            "ok",
        );
        await expect
            .poll(async () => (await readCopiedTexts(page)).at(-1) ?? "")
            .toContain("来源恢复报告");
    } finally {
        await cleanupRunningRetranscriptionSeed();
    }
});

test("dashboard source copy strip mirrors source report loading and failure", async ({
    page,
}) => {
    let copiedText = "";
    let sourceReportAttempts = 0;
    let sourceRepullAttempts = 0;
    let failSourceRepull = false;
    let holdInitialReports = true;
    let failAutoLoadReports = true;
    let releaseFirstReport: () => void = () => {};
    let releaseSourceRepull: () => void = () => {};
    let resolveFirstStarted: () => void = () => {};
    let sourceRepullGate: Promise<void> = Promise.resolve();
    const resetSourceRepullGate = () => {
        sourceRepullGate = new Promise<void>((resolve) => {
            releaseSourceRepull = resolve;
        });
    };
    const firstReportStarted = new Promise<void>((resolve) => {
        resolveFirstStarted = resolve;
    });
    const firstReportGate = new Promise<void>((resolve) => {
        releaseFirstReport = resolve;
    });
    resetSourceRepullGate();

    await page.exposeFunction(
        "__captureBetterAiNoteClipboardText",
        (text: string) => {
            copiedText = text;
        },
    );
    await page.addInitScript(() => {
        Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value: {
                writeText: async (text: string) => {
                    await (
                        window as Window & {
                            __captureBetterAiNoteClipboardText: (
                                text: string,
                            ) => Promise<void>;
                        }
                    ).__captureBetterAiNoteClipboardText(text);
                },
            },
        });
    });

    try {
        await ensureSignedIn(page);
        const userId = await getPlaywrightUserId();
        await seedRetranscriptionScenario(userId, {
            filename: "E2E dashboard source report failure",
            status: null,
            oldText: "Speaker 1: 仪表盘来源复制状态需要跟随加载结果。",
        });

        await page.route("**/api/data-sources/sync", async (route) => {
            if (route.request().method() !== "POST") {
                await route.continue();
                return;
            }

            sourceRepullAttempts += 1;
            await sourceRepullGate;
            if (failSourceRepull) {
                await route.fulfill({
                    contentType: "application/json",
                    status: 503,
                    body: JSON.stringify({ error: "Source sync failed" }),
                });
                return;
            }

            await route.fulfill({
                contentType: "application/json",
                status: 200,
                body: JSON.stringify({
                    success: true,
                    queued: false,
                    newRecordings: 0,
                    updatedRecordings: 1,
                    removedRecordings: 0,
                    errorCount: 0,
                }),
            });
        });

        await page.route(
            `**/api/recordings/${RETX_RECORDING_ID}/source-report`,
            async (route) => {
                sourceReportAttempts += 1;

                if (holdInitialReports) {
                    resolveFirstStarted();
                    await firstReportGate;
                    await route
                        .fulfill({
                            contentType: "application/json",
                            status: 503,
                            body: JSON.stringify({
                                error: "Source report temporarily unavailable",
                            }),
                        })
                        .catch(() => null);
                    return;
                }

                if (failAutoLoadReports) {
                    await route.fulfill({
                        contentType: "application/json",
                        status: 503,
                        body: JSON.stringify({
                            error: "Source report temporarily unavailable",
                        }),
                    });
                    return;
                }

                await route.fulfill({
                    contentType: "application/json",
                    body: JSON.stringify({
                        sourceProvider: "ticnote",
                        filename: "E2E dashboard source report failure",
                        transcriptReady: true,
                        summaryReady: true,
                        transcript: {
                            text: "Speaker 1: 来源状态恢复后的转录。",
                            segmentCount: 1,
                            segments: [
                                {
                                    speaker: "Speaker 1",
                                    startMs: 0,
                                    endMs: 1200,
                                    text: "来源状态恢复后的转录。",
                                },
                            ],
                        },
                        summaryMarkdown: "来源状态恢复后的报告。",
                        detail: {
                            provider: "ticnote",
                            title: "E2E dashboard source report failure",
                        },
                        sourceActions: {
                            openSource: {
                                available: true,
                                url: "https://source.example.test/dashboard/1",
                                reason: null,
                            },
                            repullSource: {
                                available: true,
                                reason: null,
                            },
                        },
                    }),
                });
            },
        );

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await page
            .getByRole("button", {
                name: /E2E dashboard source report failure/,
            })
            .click();

        await dashboardSourceTab(page).click();
        await firstReportStarted;
        await expect(dashboardSourceReport(page, "loading")).toBeVisible();

        await expect(sourceTranscriptCopyButton(page)).toBeDisabled();
        await expect(sourceReportCopyButton(page)).toBeDisabled();
        expect(copiedText).toBe("");

        holdInitialReports = false;
        releaseFirstReport();
        await expect(
            dashboardSourceReport(page, "error").locator(
                '.sr-state[data-state="error"]',
            ),
        ).toHaveAttribute(
            "data-sot-error",
            "Source report temporarily unavailable",
        );
        await expect(dashboardSourceReport(page, "error")).toContainText(
            "无法读取来源详情",
        );
        await expect(sourceTranscriptCopyButton(page)).toBeDisabled();
        await expect(sourceReportCopyButton(page)).toBeDisabled();

        failAutoLoadReports = false;
        await sourceReportRefreshButton(page).click();
        await expect(dashboardSourceReport(page, "loaded")).toContainText(
            "来源状态恢复后的转录",
        );
        await expect(
            dashboardSourceReport(page, "loaded").locator(".sr-section h4"),
        ).toHaveText(["来源转写", "来源信息"]);
        await expect(sourceTranscriptCopyButton(page)).toBeEnabled();
        await expect(sourceReportCopyButton(page)).toBeEnabled();
        await expect(sourceReportOpenSourceControl(page)).toHaveAttribute(
            "data-sot-state",
            "ready",
        );
        expect(
            await sourceReportOpenSourceControl(page).evaluate((element) =>
                element.tagName.toLowerCase(),
            ),
        ).toBe("button");
        await expectSourcePopupUrl(
            page,
            sourceReportOpenSourceControl(page),
            "https://source.example.test/dashboard/1",
        );
        await expect(sourceReportRepullButton(page)).toHaveAttribute(
            "data-sot-state",
            "ready",
        );

        const attemptsBeforeRepull = sourceReportAttempts;
        const repullResponse = page.waitForResponse(
            (response) =>
                response.url().includes("/api/data-sources/sync") &&
                response.request().method() === "POST" &&
                response.ok(),
        );
        await sourceReportRepullButton(page).click();
        await expect(sourceReportRepullButton(page)).toHaveAttribute(
            "data-sot-state",
            "loading",
        );
        releaseSourceRepull();
        await repullResponse;
        await expect(sourceReportRepullButton(page)).toHaveAttribute(
            "data-sot-state",
            "ready",
        );
        await expect
            .poll(() => sourceReportAttempts)
            .toBeGreaterThan(attemptsBeforeRepull);
        expect(sourceRepullAttempts).toBe(1);

        failSourceRepull = true;
        resetSourceRepullGate();
        const failedRepullResponse = page.waitForResponse(
            (response) =>
                response.url().includes("/api/data-sources/sync") &&
                response.request().method() === "POST" &&
                response.status() === 503,
        );
        await sourceReportRepullButton(page).click();
        await expect(sourceReportRepullButton(page)).toHaveAttribute(
            "data-sot-state",
            "loading",
        );
        releaseSourceRepull();
        await failedRepullResponse;
        await expect(sourceReportRepullButton(page)).toHaveAttribute(
            "data-sot-state",
            "error",
        );
        await expect(sourceReportRepullButton(page)).toBeEnabled();
        expect(sourceRepullAttempts).toBe(2);

        await sourceReportCopyButton(page).click();
        await expect.poll(() => copiedText).toContain("来源状态恢复后的报告");
        expect(sourceReportAttempts).toBeGreaterThanOrEqual(2);
    } finally {
        holdInitialReports = false;
        releaseFirstReport();
        releaseSourceRepull();
        await cleanupRunningRetranscriptionSeed();
    }
});

test("dashboard source report ignores stale auto-load responses after recording changes", async ({
    page,
}) => {
    let userId: string | null = null;
    let releaseAlphaReport = () => {};
    let resolveAlphaStarted = () => {};
    let resolveAlphaSettled = () => {};
    const alphaStarted = new Promise<void>((resolve) => {
        resolveAlphaStarted = resolve;
    });
    const alphaSettled = new Promise<void>((resolve) => {
        resolveAlphaSettled = resolve;
    });
    const alphaCanRespond = new Promise<void>((resolve) => {
        releaseAlphaReport = resolve;
    });

    try {
        await ensureSignedIn(page);
        userId = await getPlaywrightUserId();
        const [alphaRecording, betaRecording] =
            await seedSourceReportRaceRecordings(userId);

        await page.route(
            `**/api/recordings/${alphaRecording.id}/source-report`,
            async (route) => {
                resolveAlphaStarted();
                await alphaCanRespond;
                await route
                    .fulfill({
                        contentType: "application/json",
                        body: JSON.stringify(
                            makeSourceRaceReport(alphaRecording.title),
                        ),
                    })
                    .catch(() => null);
                resolveAlphaSettled();
            },
        );
        await page.route(
            `**/api/recordings/${betaRecording.id}/source-report`,
            async (route) => {
                await route.fulfill({
                    contentType: "application/json",
                    body: JSON.stringify(makeSourceRaceReport(betaRecording.title)),
                });
            },
        );

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await selectDashboardRecordingByTitle(
            page,
            new RegExp(alphaRecording.title),
        );
        await clickSourceTabUntilStarted(page, alphaStarted);

        await selectDashboardRecordingByTitle(
            page,
            new RegExp(betaRecording.title),
        );
        await expect(dashboardSourceReport(page, "loaded")).toContainText(
            `${betaRecording.title} source transcript.`,
        );

        releaseAlphaReport();
        await alphaSettled;
        await expect(dashboardSourceReport(page, "loaded")).toContainText(
            `${betaRecording.title} source transcript.`,
        );
        await expect(dashboardSourceReport(page, "loaded")).not.toContainText(
            `${alphaRecording.title} source transcript.`,
        );
    } finally {
        releaseAlphaReport();
        if (userId) {
            await cleanupSourceReportRaceSeeds(userId);
        }
    }
});
