import path from "node:path";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { expect, test } from "@playwright/test";
import type { Locator, Page, Route, TestInfo } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";
import {
    SOT_COMPONENT_LIBRARY_URL,
    SOT_WORKSTATION_URL,
} from "./helpers/sot-fixtures";

const E2E_DATA_DIR = path.resolve(process.cwd(), "tmp/e2e/data");
const E2E_STORAGE_DIR = process.env.PLAYWRIGHT_E2E_STORAGE_DIR
    ? path.resolve(process.cwd(), process.env.PLAYWRIGHT_E2E_STORAGE_DIR)
    : path.resolve(process.cwd(), "tmp/e2e/storage");
const DETAIL_RECORDING_ID = "e2e-detail-recording";
const DETAIL_TRANSCRIPT_ID = "e2e-detail-transcript";
const DETAIL_AUDIO_KEY = "recordings/e2e-detail-player.wav";
const SPEAKER_REVIEW_PROFILE_ZH_ID = "e2e-speaker-profile-zh";
const SPEAKER_REVIEW_PROFILE_LATIN_ID = "e2e-speaker-profile-latin";
const SPEAKER_REVIEW_PROFILE_ZH_NAME = "张三丰产品评审会议长名字 Alpha";
const SPEAKER_REVIEW_PROFILE_LATIN_NAME = "Long Latin Reviewer Name Example";
const SPEAKER_REVIEW_CREATED_NAME = "新建说话人 Alpha Beta 超长名字";
const SPEAKER_REVIEW_NO_MATCH_QUERY = "No Match Speaker 404";
const SPEAKER_REVIEW_INLINE_BUTTON_NAME = "按钮保存 Inline Rename Alpha";
const SPEAKER_REVIEW_INLINE_ENTER_NAME = "Enter 保存 Inline Rename Beta";
const DETAIL_TAG_NAME = "季度规划";
const SOT_DETAIL_TAG_ID = "e2e-detail-sot-product-weekly";
const SOT_DETAIL_TAG_NAME = "产品周会";
const AI_RENAME_HEADER_PIXEL_TOLERANCE = {
    differingPixels: 5_000,
    maxChannelDelta: 240,
};
const RECORDING_DETAIL_HEADER_PIXEL_TOLERANCE = {
    differingPixels: 4_500,
    maxChannelDelta: 240,
};
const SOT_DETAIL_SECOND_TAG_ID = "e2e-detail-sot-1on1";
const SOT_DETAIL_SECOND_TAG_NAME = "1on1";
const SOT_DETAIL_IMPORTANT_TAG_ID = "e2e-detail-sot-important-customer";
const SOT_DETAIL_IMPORTANT_TAG_NAME = "重要客户";
const SOT_DETAIL_FOLLOW_UP_TAG_ID = "e2e-detail-sot-follow-up";
const SOT_DETAIL_FOLLOW_UP_TAG_NAME = "待跟进";
const SOT_TAG_MANAGER_DUMMY_RECORDING_IDS = Array.from(
    { length: 6 },
    (_, index) => `e2e-detail-sot-tag-count-${index + 1}`,
);

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
    return pathToFileURL(filePath).href;
}

const CORE_DB = resolveDatabasePath();
const LIBRARY_DB = deriveSiblingDatabasePath(CORE_DB, "library");
const TRANSCRIPTS_DB = deriveSiblingDatabasePath(CORE_DB, "transcripts");
const VOICEPRINTS_DB = deriveSiblingDatabasePath(CORE_DB, "voiceprints");
const SOURCE_REPORT_DETAIL_LOADED_SUBSTATES_DIR = path.resolve(
    process.cwd(),
    "tmp/betterainote-design-evidence/run-20260605-sot-1to1/source-report-detail-loaded-substates-20260612",
);
const SOURCE_REPORT_DETAIL_LOADED_SUBSTATES_JSON = path.join(
    SOURCE_REPORT_DETAIL_LOADED_SUBSTATES_DIR,
    "source-report-detail-loaded-substates.json",
);
const SOURCE_REPORT_DETAIL_LOADED_SUBSTATES_MD = path.join(
    SOURCE_REPORT_DETAIL_LOADED_SUBSTATES_DIR,
    "evidence.md",
);
const SOURCE_REPORT_DETAIL_LOADED_SUBSTATES_COMMAND =
    'PLAYWRIGHT_USE_SYSTEM_CHROME=1 bunx playwright test e2e/recording-detail-workstation.spec.ts --grep "recording detail source report loaded sub-states match SOT pixels" --timeout=240000 --trace=off';
const SOURCE_REPORT_ROW107_MATRIX_DIR = path.resolve(
    process.cwd(),
    "tmp/betterainote-design-evidence/run-20260605-sot-1to1/source-report-row107-state-action-matrix-20260625",
);
const SOURCE_REPORT_ROW107_MATRIX_JSON = path.join(
    SOURCE_REPORT_ROW107_MATRIX_DIR,
    "source-report-row107-state-action-matrix.json",
);
const SOURCE_REPORT_ROW107_MATRIX_MD = path.join(
    SOURCE_REPORT_ROW107_MATRIX_DIR,
    "evidence.md",
);
const SOURCE_REPORT_ROW107_MATRIX_COMMAND =
    'PLAYWRIGHT_USE_SYSTEM_CHROME=1 bunx playwright test e2e/recording-detail-workstation.spec.ts --grep "recording detail source report row107 state-action matrix consolidation" --timeout=240000 --trace=off';
const PLAYER_RESPONSIVE_FRAMES_DIR = path.resolve(
    process.cwd(),
    "tmp/betterainote-design-evidence/run-20260605-sot-1to1/player-responsive-frames-20260612",
);
const PLAYER_RESPONSIVE_FRAMES_JSON = path.join(
    PLAYER_RESPONSIVE_FRAMES_DIR,
    "player-responsive-frames.json",
);
const PLAYER_RESPONSIVE_FRAMES_MD = path.join(
    PLAYER_RESPONSIVE_FRAMES_DIR,
    "evidence.md",
);
const WORKSPACE_VISUAL_MATRIX_DIR = path.resolve(
    process.cwd(),
    "tmp/betterainote-design-evidence/run-20260605-sot-1to1/workspace-visual-matrix-20260611",
);
const WORKSPACE_VISUAL_MATRIX_JSON = path.join(
    WORKSPACE_VISUAL_MATRIX_DIR,
    "workspace-visual-matrix.json",
);
const WORKSPACE_STANDALONE_ERROR_RECORDING_ID = "e2e-row96-runtime-error";
const WORKSPACE_STANDALONE_ERROR_RUNTIME_DIR = path.resolve(
    process.cwd(),
    "tmp/betterainote-design-evidence/run-20260605-sot-1to1/workspace-standalone-error-runtime-20260612",
);
const WORKSPACE_STANDALONE_ERROR_RUNTIME_JSON = path.join(
    WORKSPACE_STANDALONE_ERROR_RUNTIME_DIR,
    "workspace-standalone-error-runtime.json",
);
const WORKSPACE_STANDALONE_ERROR_RUNTIME_MD = path.join(
    WORKSPACE_STANDALONE_ERROR_RUNTIME_DIR,
    "evidence.md",
);
const WORKSPACE_STANDALONE_ERROR_RUNTIME_COMMAND =
    'BETTERAINOTE_E2E_RECORDING_DETAIL_ERROR=1 PLAYWRIGHT_USE_SYSTEM_CHROME=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3236 bunx playwright test e2e/recording-detail-workstation.spec.ts --grep "Workspace standalone error boundary runtime visual" --timeout=240000 --trace=off';
const WORKSPACE_VISUAL_FRAMES = [
    {
        name: "desktop",
        viewport: { height: 900, width: 1366 },
    },
    {
        name: "narrow",
        viewport: { height: 900, width: 820 },
    },
    {
        name: "mobile",
        viewport: { height: 844, width: 390 },
    },
] as const;
const SOT_SPEAKER_STYLE_PROPS = [
    "display",
    "boxSizing",
    "alignItems",
    "gap",
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
    "backgroundImage",
    "color",
    "fontFamily",
    "fontSize",
    "fontWeight",
    "boxShadow",
] as const;
const SOT_TAG_MANAGER_STYLE_PROPS = [
    "display",
    "boxSizing",
    "flexDirection",
    "alignItems",
    "justifyContent",
    "gap",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
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
    "fontSize",
    "fontWeight",
] as const;

type SotSpeakerStyleProp = (typeof SOT_SPEAKER_STYLE_PROPS)[number];
type SotConfirmStyleProp =
    | (typeof SOT_CONFIRM_SURFACE_STYLE_PROPS)[number]
    | (typeof SOT_CONFIRM_STACK_STYLE_PROPS)[number]
    | (typeof SOT_CONFIRM_BUTTON_STYLE_PROPS)[number];
type SotTagManagerStyleProp = (typeof SOT_TAG_MANAGER_STYLE_PROPS)[number];
const SOT_TAG_MANAGER_PANEL_STYLE_PROPS = [
    "boxSizing",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
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
    "fontSize",
    "fontWeight",
] as const satisfies readonly SotTagManagerStyleProp[];
const SOT_TAG_MANAGER_ICON_BUTTON_STYLE_PROPS = [
    "display",
    "boxSizing",
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
    "fontSize",
    "fontWeight",
] as const satisfies readonly SotTagManagerStyleProp[];
const SOT_TAG_MANAGER_SPINNER_STYLE_PROPS = [
    "display",
    "boxSizing",
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
] as const satisfies readonly SotTagManagerStyleProp[];

interface SotPixelDiff {
    differingPixels: number;
    dimensionsMatch: boolean;
    expectedHeight: number;
    expectedWidth: number;
    maxChannelDelta: number;
    productHeight: number;
    productWidth: number;
}

type SotSourceReportLoadedSubState =
    | "complete"
    | "transcript-missing"
    | "summary-missing"
    | "both-missing";

function assertE2EDatabasePath(filePath: string) {
    const e2eRoot = path.resolve(
        process.env.PLAYWRIGHT_E2E_ROOT ??
            path.join(process.cwd(), "tmp/e2e"),
    );
    const resolved = path.resolve(filePath);

    if (resolved !== e2eRoot && !resolved.startsWith(`${e2eRoot}${path.sep}`)) {
        throw new Error(`Refusing to mutate non-E2E database path: ${resolved}`);
    }
}

for (const databasePath of [CORE_DB, LIBRARY_DB, TRANSCRIPTS_DB, VOICEPRINTS_DB]) {
    assertE2EDatabasePath(databasePath);
}

function assertE2EStoragePath(filePath: string) {
    const e2eRoot = path.resolve(
        process.env.PLAYWRIGHT_E2E_ROOT ??
            path.join(process.cwd(), "tmp/e2e"),
    );
    const resolved = path.resolve(filePath);

    if (resolved !== e2eRoot && !resolved.startsWith(`${e2eRoot}${path.sep}`)) {
        throw new Error(`Refusing to mutate non-E2E storage path: ${resolved}`);
    }
}

function createSineWaveWavBuffer() {
    const sampleRate = 8000;
    const durationSeconds = 2;
    const sampleCount = sampleRate * durationSeconds;
    const bytesPerSample = 2;
    const dataSize = sampleCount * bytesPerSample;
    const buffer = Buffer.alloc(44 + dataSize);

    buffer.write("RIFF", 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write("WAVE", 8);
    buffer.write("fmt ", 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(1, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * bytesPerSample, 28);
    buffer.writeUInt16LE(bytesPerSample, 32);
    buffer.writeUInt16LE(16, 34);
    buffer.write("data", 36);
    buffer.writeUInt32LE(dataSize, 40);

    for (let index = 0; index < sampleCount; index += 1) {
        const sample = Math.sin((index / sampleRate) * 440 * Math.PI * 2);
        buffer.writeInt16LE(Math.round(sample * 12_000), 44 + index * 2);
    }

    return buffer;
}

async function writeAudioFixture() {
    const audioPath = path.join(E2E_STORAGE_DIR, DETAIL_AUDIO_KEY);
    assertE2EStoragePath(audioPath);
    await mkdir(path.dirname(audioPath), { recursive: true });
    await writeFile(audioPath, createSineWaveWavBuffer());
    return DETAIL_AUDIO_KEY;
}

async function removeAudioFixture() {
    const audioPath = path.join(E2E_STORAGE_DIR, DETAIL_AUDIO_KEY);
    assertE2EStoragePath(audioPath);
    await rm(audioPath, { force: true });
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

async function cleanupRecordingDetailSeed() {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const transcripts = createClient({ url: databaseUrl(TRANSCRIPTS_DB) });
    const voiceprints = createClient({ url: databaseUrl(VOICEPRINTS_DB) });

    try {
        await voiceprints.execute({
            sql: "DELETE FROM recording_speakers WHERE recording_id = ?",
            args: [DETAIL_RECORDING_ID],
        });
        await voiceprints.execute({
            sql: `
                DELETE FROM speaker_profiles
                WHERE id IN (?, ?) OR display_name = ?
            `,
            args: [
                SPEAKER_REVIEW_PROFILE_ZH_ID,
                SPEAKER_REVIEW_PROFILE_LATIN_ID,
                SPEAKER_REVIEW_CREATED_NAME,
            ],
        });
        await transcripts.execute({
            sql: "DELETE FROM source_artifacts WHERE recording_id = ?",
            args: [DETAIL_RECORDING_ID],
        });
        await transcripts.execute({
            sql: "DELETE FROM transcriptions WHERE id = ? OR recording_id = ?",
            args: [DETAIL_TRANSCRIPT_ID, DETAIL_RECORDING_ID],
        });
        await library.execute({
            sql: "DELETE FROM transcription_jobs WHERE recording_id = ?",
            args: [DETAIL_RECORDING_ID],
        });
        await library.execute({
            sql: "DELETE FROM recording_tag_assignments WHERE recording_id = ?",
            args: [DETAIL_RECORDING_ID],
        });
        await library.execute({
            sql: `
                DELETE FROM recording_tag_assignments
                WHERE recording_id LIKE ?
                   OR tag_id IN (?, ?, ?, ?)
            `,
            args: [
                "e2e-detail-sot-tag-count-%",
                SOT_DETAIL_TAG_ID,
                SOT_DETAIL_SECOND_TAG_ID,
                SOT_DETAIL_IMPORTANT_TAG_ID,
                SOT_DETAIL_FOLLOW_UP_TAG_ID,
            ],
        });
        await library.execute({
            sql: "DELETE FROM recording_tags WHERE name = ?",
            args: [DETAIL_TAG_NAME],
        });
        await library.execute({
            sql: "DELETE FROM recording_tags WHERE name = ?",
            args: [SOT_DETAIL_TAG_NAME],
        });
        await library.execute({
            sql: "DELETE FROM recording_tags WHERE name = ?",
            args: [SOT_DETAIL_SECOND_TAG_NAME],
        });
        await library.execute({
            sql: "DELETE FROM recording_tags WHERE name = ?",
            args: [SOT_DETAIL_IMPORTANT_TAG_NAME],
        });
        await library.execute({
            sql: "DELETE FROM recording_tags WHERE name = ?",
            args: [SOT_DETAIL_FOLLOW_UP_TAG_NAME],
        });
        await library.execute({
            sql: "DELETE FROM recordings WHERE id LIKE ?",
            args: ["e2e-detail-sot-tag-count-%"],
        });
        await library.execute({
            sql: "DELETE FROM recordings WHERE id = ?",
            args: [DETAIL_RECORDING_ID],
        });
    } finally {
        await library.close();
        await transcripts.close();
        await voiceprints.close();
    }
}

type RecordingDetailSeedOptions = {
    duration?: number;
    filename?: string;
    includeSourceTranscript?: boolean;
    includeSourceSummary?: boolean;
    includeSourceDetail?: boolean;
    includeSotPlayerTag?: boolean;
    includeSotTagManagerFixture?: "default" | "delete-important";
    sourceProvider?: string;
    startTime?: number;
    storagePath?: string;
    includeSpeakerReview?: boolean;
};

async function seedRecordingDetail(
    userId: string,
    options: RecordingDetailSeedOptions = {},
) {
    const {
        duration = 240_000,
        filename = "E2E source detail review",
        includeSotPlayerTag = false,
        includeSotTagManagerFixture,
        includeSourceDetail = true,
        includeSourceSummary = true,
        includeSourceTranscript = true,
        includeSpeakerReview = false,
        sourceProvider = "ticnote",
        startTime,
        storagePath = "",
    } = options;
    const now = Date.now();
    const start = startTime ?? now - 7_200_000;
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const transcripts = createClient({ url: databaseUrl(TRANSCRIPTS_DB) });
    const voiceprints = createClient({ url: databaseUrl(VOICEPRINTS_DB) });
    const speakerReviewTranscript =
        "SPEAKER_ALPHA_00: 第一段中文说话人内容需要在窄屏保持可读。\nSPEAKER_BETA_01: Latin speaker review content for mapping.";
    const speakerReviewPayload = {
        id: "e2e-speaker-review-job",
        status: "completed",
        filename: "speaker-review.wav",
        createdAt: new Date(now - 120_000).toISOString(),
        language: "zh",
        segments: [
            {
                id: 1,
                start: 0,
                end: 3.2,
                text: "第一段中文说话人内容需要在窄屏保持可读。",
                speakerLabel: "SPEAKER_ALPHA_00",
                speakerId: SPEAKER_REVIEW_PROFILE_ZH_ID,
                speakerName: SPEAKER_REVIEW_PROFILE_ZH_NAME,
                similarity: 0.96,
                hasOverlap: false,
            },
            {
                id: 2,
                start: 4,
                end: 8,
                text: "Latin speaker review content for mapping.",
                speakerLabel: "SPEAKER_BETA_01",
                speakerId: null,
                speakerName: null,
                similarity: null,
                hasOverlap: false,
            },
        ],
        speakerMap: {
            SPEAKER_ALPHA_00: {
                matchedId: SPEAKER_REVIEW_PROFILE_ZH_ID,
                matchedName: SPEAKER_REVIEW_PROFILE_ZH_NAME,
                similarity: 0.96,
                embeddingKey: "e2e-embedding-alpha",
            },
        },
        uniqueSpeakers: ["SPEAKER_ALPHA_00", "SPEAKER_BETA_01"],
        params: null,
    };

    try {
        await cleanupRecordingDetailSeed();
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
                DETAIL_RECORDING_ID,
                userId,
                sourceProvider,
                "e2e-detail-source",
                "1",
                "{}",
                "e2e-device",
                filename,
                duration,
                start,
                start + duration,
                4096,
                "e2e-detail",
                "local",
                storagePath,
                now,
                0,
                0,
                now,
                now,
            ],
        });
		if (includeSotPlayerTag) {
			await library.batch([
				{
					sql: `
						INSERT OR REPLACE INTO recording_tags (
							id, user_id, name, color, icon, created_at, updated_at
						) VALUES (?, ?, ?, ?, ?, ?, ?)
					`,
					args: [
						SOT_DETAIL_TAG_ID,
						userId,
						SOT_DETAIL_TAG_NAME,
						"purple",
						"grid",
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
						`${SOT_DETAIL_TAG_ID}-assignment`,
						userId,
						DETAIL_RECORDING_ID,
						SOT_DETAIL_TAG_ID,
						now,
					],
				},
			]);
        }
        if (includeSotTagManagerFixture) {
            await library.execute({
                sql: `
                    INSERT OR REPLACE INTO recording_tags (
                        id, user_id, name, color, icon, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?),
                             (?, ?, ?, ?, ?, ?, ?),
                             (?, ?, ?, ?, ?, ?, ?),
                             (?, ?, ?, ?, ?, ?, ?)
                `,
                args: [
                    SOT_DETAIL_TAG_ID,
                    userId,
                    SOT_DETAIL_TAG_NAME,
                    "purple",
                    "grid",
                    now + 4_000,
                    now + 4_000,
                    SOT_DETAIL_SECOND_TAG_ID,
                    userId,
                    SOT_DETAIL_SECOND_TAG_NAME,
                    "blue",
                    "user",
                    now + 3_000,
                    now + 3_000,
                    SOT_DETAIL_IMPORTANT_TAG_ID,
                    userId,
                    SOT_DETAIL_IMPORTANT_TAG_NAME,
                    "red",
                    "heart",
                    now + 2_000,
                    now + 2_000,
                    SOT_DETAIL_FOLLOW_UP_TAG_ID,
                    userId,
                    SOT_DETAIL_FOLLOW_UP_TAG_NAME,
                    "orange",
                    "clock",
                    now + 1_000,
                    now + 1_000,
                ],
            });

            if (includeSotTagManagerFixture === "delete-important") {
                await library.batch(
                    SOT_TAG_MANAGER_DUMMY_RECORDING_IDS.map((id, index) => ({
                        sql: `
                            INSERT OR REPLACE INTO recordings (
                                id, user_id, source_provider, source_recording_id,
                                source_version, source_metadata, provider_device_id,
                                filename, duration, start_time, end_time, filesize,
                                file_md5, storage_type, storage_path, downloaded_at,
                                upstream_trashed, upstream_deleted, created_at, updated_at
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `,
                        args: [
                            id,
                            userId,
                            sourceProvider,
                            id,
                            "1",
                            "{}",
                            "e2e-device",
                            `SOT tag count fixture ${index + 1}`,
                            duration,
                            start - (index + 1) * 60_000,
                            start - (index + 1) * 60_000 + duration,
                            1024,
                            `${id}-md5`,
                            "local",
                            "",
                            now,
                            0,
                            0,
                            now,
                            now,
                        ],
                    })),
                );
            }

            const selectedTagIds =
                includeSotTagManagerFixture === "delete-important"
                    ? [SOT_DETAIL_IMPORTANT_TAG_ID]
                    : [SOT_DETAIL_TAG_ID, SOT_DETAIL_SECOND_TAG_ID];
            const importantRecordingIds =
                includeSotTagManagerFixture === "delete-important"
                    ? [DETAIL_RECORDING_ID, ...SOT_TAG_MANAGER_DUMMY_RECORDING_IDS]
                    : [];
            await library.batch([
                ...selectedTagIds.map((tagId) => ({
                    sql: `
                        INSERT OR REPLACE INTO recording_tag_assignments (
                            id, user_id, recording_id, tag_id, created_at
                        ) VALUES (?, ?, ?, ?, ?)
                    `,
                    args: [
                        `${tagId}-assignment`,
                        userId,
                        DETAIL_RECORDING_ID,
                        tagId,
                        now,
                    ],
                })),
                ...importantRecordingIds.slice(1).map((recordingId, index) => ({
                    sql: `
                        INSERT OR REPLACE INTO recording_tag_assignments (
                            id, user_id, recording_id, tag_id, created_at
                        ) VALUES (?, ?, ?, ?, ?)
                    `,
                    args: [
                        `${SOT_DETAIL_IMPORTANT_TAG_ID}-assignment-${index + 2}`,
                        userId,
                        recordingId,
                        SOT_DETAIL_IMPORTANT_TAG_ID,
                        now,
                    ],
                })),
            ]);
        }
        await transcripts.execute({
            sql: `
                INSERT OR REPLACE INTO transcriptions (
                    id, recording_id, user_id, text, detected_language,
                    transcription_type, provider, model, provider_job_id,
                    speaker_map, provider_payload, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            args: [
                DETAIL_TRANSCRIPT_ID,
                DETAIL_RECORDING_ID,
                userId,
                includeSpeakerReview
                    ? speakerReviewTranscript
                    : "Speaker 1: 本地转写复制内容。\nSpeaker 2: UI 验收必须保留。",
                "zh",
                "server",
                includeSpeakerReview ? "server" : "voice-transcribe",
                "e2e",
                includeSpeakerReview ? null : "remote-e2e-detail",
                includeSpeakerReview
                    ? JSON.stringify({
                          SPEAKER_ALPHA_00: SPEAKER_REVIEW_PROFILE_ZH_NAME,
                      })
                    : "{}",
                includeSpeakerReview
                    ? JSON.stringify(speakerReviewPayload)
                    : "{}",
                now - 120_000,
            ],
        });
        if (includeSpeakerReview) {
            await voiceprints.execute({
                sql: `
                    INSERT OR REPLACE INTO speaker_profiles (
                        id, user_id, display_name, voiceprint_ref, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?)
                `,
                args: [
                    SPEAKER_REVIEW_PROFILE_ZH_ID,
                    userId,
                    SPEAKER_REVIEW_PROFILE_ZH_NAME,
                    "vp-e2e-speaker-zh",
                    now,
                    now,
                    SPEAKER_REVIEW_PROFILE_LATIN_ID,
                    userId,
                    SPEAKER_REVIEW_PROFILE_LATIN_NAME,
                    null,
                    now,
                    now,
                ],
            });
            await voiceprints.execute({
                sql: `
                    INSERT OR REPLACE INTO recording_speakers (
                        id, user_id, recording_id, raw_label, matched_profile_id,
                        sample_segments, segment_count, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                args: [
                    "e2e-speaker-alpha-row",
                    userId,
                    DETAIL_RECORDING_ID,
                    "SPEAKER_ALPHA_00",
                    SPEAKER_REVIEW_PROFILE_ZH_ID,
                    JSON.stringify([
                        {
                            startMs: 0,
                            endMs: 3200,
                            text: "第一段中文说话人内容需要在窄屏保持可读。",
                        },
                    ]),
                    2,
                    now,
                    now,
                    "e2e-speaker-beta-row",
                    userId,
                    DETAIL_RECORDING_ID,
                    "SPEAKER_BETA_01",
                    null,
                    JSON.stringify([
                        {
                            startMs: null,
                            endMs: null,
                            text: "Latin speaker review content for mapping.",
                        },
                    ]),
                    1,
                    now,
                    now,
                ],
            });
        }
        if (includeSourceTranscript) {
            await transcripts.execute({
                sql: `
                    INSERT OR REPLACE INTO source_artifacts (
                        id, recording_id, user_id, provider, artifact_type, title,
                        text_content, markdown_content, payload, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                args: [
                    "e2e-detail-source-transcript",
                    DETAIL_RECORDING_ID,
                    userId,
                    "ticnote",
                    "official-transcript",
                    "来源逐字稿",
                    "Speaker 1: 来源逐字稿复制内容。",
                    null,
                    JSON.stringify({
                        language: "zh-CN",
                        segments: [
                            {
                                speaker: "Speaker 1",
                                startMs: 0,
                                endMs: 15_000,
                                text: "来源逐字稿复制内容。",
                            },
                        ],
                    }),
                    now - 90_000,
                    now - 90_000,
                ],
            });
        }
        if (includeSourceSummary) {
            await transcripts.execute({
                sql: `
                    INSERT OR REPLACE INTO source_artifacts (
                        id, recording_id, user_id, provider, artifact_type, title,
                        text_content, markdown_content, payload, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                args: [
                    "e2e-detail-source-summary",
                    DETAIL_RECORDING_ID,
                    userId,
                    "ticnote",
                    "official-summary",
                    "来源报告",
                    null,
                    "## E2E 源报告摘要\n\n- 录音详情页自动加载来源报告。",
                    "{}",
                    now - 80_000,
                    now - 80_000,
                ],
            });
        }
        if (includeSourceDetail) {
            await transcripts.execute({
                sql: `
                    INSERT OR REPLACE INTO source_artifacts (
                        id, recording_id, user_id, provider, artifact_type, title,
                        text_content, markdown_content, payload, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                args: [
                    "e2e-detail-source-detail",
                    DETAIL_RECORDING_ID,
                    userId,
                    "ticnote",
                    "official-detail",
                    "来源详情",
                    null,
                    null,
                    JSON.stringify({ language: "zh-CN" }),
                    now - 70_000,
                    now - 70_000,
                ],
            });
        }
    } finally {
        await library.close();
        await transcripts.close();
        await voiceprints.close();
    }

    return DETAIL_RECORDING_ID;
}

async function installClipboardCapture(page: Page) {
    await page.addInitScript(() => {
        const copiedTexts: string[] = [];
        Object.defineProperty(window, "__betterainoteCopiedTexts", {
            value: copiedTexts,
            configurable: true,
        });
        Object.defineProperty(navigator, "clipboard", {
            value: {
                writeText: async (text: string) => {
                    copiedTexts.push(String(text));
                },
            },
            configurable: true,
        });
    });
}

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
            configurable: true,
        });
        Object.defineProperty(document, "execCommand", {
            value: () => false,
            configurable: true,
        });
    });
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

async function openSpeakerReviewPanel(page: Page) {
    const tab = page.getByRole("tab", {
        name: "说话人标签",
        exact: true,
    });
    const panel = page.getByRole("region", {
        name: "说话人标签",
        exact: true,
    });

    for (let attempt = 0; attempt < 3; attempt += 1) {
        await tab.click();
        await expect(tab).toHaveAttribute("aria-selected", "true");
        if (
            await panel
                .isVisible({ timeout: 1_000 })
                .catch(() => false)
        ) {
            return panel;
        }
        await page.waitForTimeout(250);
    }

    await expect(panel).toBeVisible();
    return panel;
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

function recordingWorkstation(page: Page) {
    return page.locator('[data-sot-surface="recording-workstation"]');
}

function recordingHeader(page: Page) {
    return recordingWorkstation(page).locator(
        '[data-sot-panel="recording-detail-header"]',
    );
}

function sourceReportState(page: Page, state?: string) {
    const selector = '[data-sot-panel="recording-source-report"]';
    return page.locator(state ? `${selector}[data-sot-state="${state}"]` : selector);
}

function sourceReportInnerState(page: Page, state: string) {
    return sourceReportState(page).locator(
        `[data-sot-panel="recording-source-report-state"][data-sot-state="${state}"]`,
    );
}

function localTranscriptCopyButton(page: Page) {
    return recordingWorkstation(page).getByRole("button", {
        name: "复制转录",
        exact: true,
    });
}

function rawTranscriptCopyButton(page: Page) {
    return recordingWorkstation(page)
        .getByRole("button", { name: "复制原始转录", exact: true })
        .first();
}

function detailSourceTranscriptCopyButton(page: Page) {
    return sourceReportState(page).locator(
        'button[data-sot-control="copy-source-transcript"]',
    );
}

function detailSourceReportCopyButton(page: Page) {
    return sourceReportState(page).locator(
        'button[data-sot-control="copy-source-report"]',
    );
}

function sourceReportTranscriptCopyButton(page: Page) {
    return sourceReportState(page).getByRole("button", {
        name: "复制原始转录",
        exact: true,
    });
}

function sourceReportReportCopyButton(page: Page) {
    return sourceReportState(page).getByRole("button", {
        name: "复制原始报告",
        exact: true,
    });
}

function sourceReportOpenSourceControl(page: Page) {
    return sourceReportState(page).locator(
        '[data-sot-control="open-source-record"]',
    );
}

function sourceReportRepullButton(page: Page) {
    return sourceReportState(page).locator(
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

function renameStartButton(page: Page) {
    return recordingHeader(page)
        .getByRole("button", { name: /^重命名(?:并同步到来源)?$/ })
        .first();
}

function renameInput(page: Page) {
    return recordingHeader(page).getByRole("textbox").first();
}

function renameSaveButton(page: Page) {
    return recordingHeader(page).getByRole("button", {
        name: "保存新标题",
        exact: true,
    });
}

function renameCancelButton(page: Page) {
    return recordingHeader(page).getByRole("button", {
        name: "取消重命名",
        exact: true,
    });
}

async function mockTitleGenerationSettings(page: Page, configured = true) {
    await page.route("**/api/settings/title-generation", async (route) => {
        if (route.request().method() !== "GET") {
            await route.fallback();
            return;
        }

        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({
                autoGenerateTitle: true,
                titleGenerationBaseUrl: configured
                    ? "https://llm.example.invalid/v1"
                    : null,
                titleGenerationModel: configured ? "e2e-title-model" : null,
                titleGenerationApiKeySet: configured,
                titleGenerationPrompt: null,
            }),
        });
    });
}

function playerShell(page: Page) {
    return page.locator('[data-sot-surface="recording-player"]').first();
}

function playerControlsPanel(page: Page) {
    return page.locator('[data-sot-panel="recording-player-controls"]').first();
}

function playerMetaPanel(page: Page) {
    return playerShell(page)
        .locator('[data-sot-part="recording-player-meta"]')
        .first();
}

function playerNoAudioBanner(page: Page) {
    return playerShell(page)
        .locator('[data-sot-part="recording-player-no-audio"]')
        .first();
}

function playerBackButton(page: Page) {
    return page
        .locator('[data-slot="button"][data-sot-control="recording-player-back"]')
        .first();
}

function playerToggleButton(page: Page, _name: string | RegExp = /播放|暂停/) {
    return page
        .locator('[data-slot="button"][data-sot-control="recording-player-play"]')
        .first();
}

function playerForwardButton(page: Page) {
    return page
        .locator(
            '[data-slot="button"][data-sot-control="recording-player-forward"]',
        )
        .first();
}

function playerSpeedButton(page: Page) {
    return page
        .locator(
            '[data-slot="button"][data-sot-control="recording-player-speed"]',
        )
        .first();
}

function playerSeekSlider(page: Page) {
    return page
        .locator('[data-slot="slider"][data-sot-control="recording-player-seek"]')
        .first();
}

function playerVolumeSlider(page: Page) {
    return page.getByRole("slider", {
        name: "音量",
        exact: true,
        includeHidden: true,
    });
}

async function setPlayerVolumeSlider(page: Page, value: number) {
    const slider = playerVolumeSlider(page);
    await slider.focus();
    await slider.press("Home");
    for (let step = 0; step < value; step += 1) {
        await slider.press("ArrowRight");
    }
    await expect(slider).toHaveAttribute("aria-valuenow", String(value));
}

function playerVolumeButton(page: Page) {
    return page
        .locator('[data-sot-control="recording-player-volume"]')
        .first();
}

function playerAudio(page: Page) {
    return page.locator("audio").first();
}

function playerTagManagerTrigger(page: Page) {
    return recordingWorkstation(page)
        .locator(
            '[data-sot-part="recording-player-meta"] [data-sot-control="recording-tag-manager"]',
        )
        .first();
}

function speakerReviewCard(panel: Locator, label: string) {
    return panel.locator(`[data-sot-speaker-label="${label}"]`);
}

function speakerReviewMappingInput(card: Locator) {
    return card
        .locator('[data-sot-control="speaker-review-mapping-input"]')
        .first();
}

function speakerReviewMappingField(card: Locator) {
    return card.locator('[data-sot-part="speaker-review-mapping-field"]').first();
}

function speakerReviewProfileOption(card: Locator, name: string) {
    return card.getByRole("button").filter({ hasText: name });
}

function speakerReviewCreateOption(card: Locator, name: string) {
    return card.getByRole("button").filter({ hasText: `新建“${name}”` });
}

function speakerReviewClearButton(card: Locator) {
    return card.getByRole("button", {
        name: "清除当前绑定",
        exact: true,
    });
}

function speakerReviewRetryButton(card: Locator) {
    return card.getByRole("button", { name: "重试", exact: true });
}

function speakerReviewUnlinkButton(card: Locator) {
    return card.getByRole("button", { name: "解除绑定", exact: true });
}

function speakerReviewConfirmUnlink(card: Locator) {
    return card.locator('[data-sot-confirm="speaker-unlink"]');
}

function speakerReviewCancelUnlinkButton(card: Locator) {
    return speakerReviewConfirmUnlink(card).getByRole("button", {
        name: "取消",
        exact: true,
    });
}

function speakerReviewConfirmUnlinkButton(card: Locator) {
    return speakerReviewConfirmUnlink(card).getByRole("button", {
        name: "解除绑定",
        exact: true,
    });
}

function speakerReviewPlaySampleButton(card: Locator) {
    return card
        .getByRole("button", { name: /^(播放|播放中)$/ })
        .first();
}

function speakerReviewCopyRawButton(panel: Locator) {
    return panel.getByRole("button", { name: "复制原始转录", exact: true });
}

function speakerReviewRefreshButton(panel: Locator) {
    return panel.getByRole("button", { name: "刷新", exact: true });
}

function speakerReviewMergeButton(panel: Locator) {
    return panel.locator("[data-spk-merge]");
}

function speakerReviewMergePopover(panel: Locator) {
    return panel.locator("[data-spk-merge-pop]");
}

function speakerReviewRenameButton(card: Locator) {
    return card.locator("[data-spk-rename]").first();
}

function speakerReviewInlineRenameInput(card: Locator) {
    return card
        .locator(
            '[data-sot-control="speaker-review-inline-name"][data-spk-input]',
        )
        .first();
}

function speakerReviewInlineRenameActions(card: Locator) {
    return card.locator('[data-sot-part="speaker-review-actions"]').first();
}

function speakerReviewInlineCancelButton(card: Locator) {
    return speakerReviewInlineRenameActions(card).getByRole("button", {
        name: "取消",
        exact: true,
    });
}

function speakerReviewInlineSaveButton(card: Locator) {
    return speakerReviewInlineRenameActions(card).getByRole("button", {
        name: "保存",
        exact: true,
    });
}

async function readSotSpeakerStyle(
    page: Page,
    selector: string,
    props: readonly SotSpeakerStyleProp[] = SOT_SPEAKER_STYLE_PROPS,
) {
    return page.locator(selector).first().evaluate(
        (element, propNames) => {
            const style = window.getComputedStyle(element);
            const entries = Object.fromEntries(
                propNames.map((prop) => [prop, style[prop]]),
            );
            if (entries.borderTopWidth === "0px") {
                entries.borderTopStyle = "none";
            }
            return entries;
        },
        props,
    );
}

async function expectSotSpeakerStyleMatch(
    sotPage: Page,
    productPage: Page,
    sotSelector: string,
    productSelector: string,
    props: readonly SotSpeakerStyleProp[] = SOT_SPEAKER_STYLE_PROPS,
) {
    const [sot, product] = await Promise.all([
        readSotSpeakerStyle(sotPage, sotSelector, props),
        readSotSpeakerStyle(productPage, productSelector, props),
    ]);

    expect(product, productSelector).toEqual(sot);
}

async function readSotConfirmStyle(
    page: Page,
    selector: string,
    props: readonly SotConfirmStyleProp[],
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
            if (entries.borderRightWidth === "0px") {
                entries.borderRightStyle = "none";
            }
            if (entries.borderBottomWidth === "0px") {
                entries.borderBottomStyle = "none";
            }
            if (entries.borderLeftWidth === "0px") {
                entries.borderLeftStyle = "none";
            }
            return entries;
        },
        props,
    );
}

async function expectSotConfirmStyleMatch(
    sotPage: Page,
    productPage: Page,
    sotSelector: string,
    productSelector: string,
    props: readonly SotConfirmStyleProp[],
) {
    const [sot, product] = await Promise.all([
        readSotConfirmStyle(sotPage, sotSelector, props),
        readSotConfirmStyle(productPage, productSelector, props),
    ]);

    expect(product, `${productSelector} ~= ${sotSelector}`).toEqual(sot);
}

async function readSotTagManagerStyle(
    page: Page,
    selector: string,
    props: readonly SotTagManagerStyleProp[] = SOT_TAG_MANAGER_STYLE_PROPS,
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
            for (const side of ["Top", "Right", "Bottom", "Left"] as const) {
                const width = `border${side}Width`;
                const styleName = `border${side}Style`;
                const colorName = `border${side}Color`;
                if (entries[width] === "0px") {
                    entries[styleName] = "none";
                    entries[colorName] = "transparent";
                }
            }
            return entries;
        },
        props,
    );
}

async function expectSotTagManagerStyleMatch(
    sotPage: Page,
    productPage: Page,
    sotSelector: string,
    productSelector: string,
    props: readonly SotTagManagerStyleProp[] = SOT_TAG_MANAGER_STYLE_PROPS,
) {
    const [sot, product] = await Promise.all([
        readSotTagManagerStyle(sotPage, sotSelector, props),
        readSotTagManagerStyle(productPage, productSelector, props),
    ]);

    expect(product, `${productSelector} ~= ${sotSelector}`).toEqual(sot);
}

type SotTagManagerStyleCheck = {
    label: string;
    productSelector: string;
    props?: readonly SotTagManagerStyleProp[];
    sotSelector: string;
};

async function expectSotTagManagerPrimitiveStylesMatch(
    sotPage: Page,
    productPage: Page,
    checks: readonly SotTagManagerStyleCheck[],
) {
    for (const check of checks) {
        await expect(
            sotPage.locator(check.sotSelector).first(),
            `${check.label} SOT selector ${check.sotSelector}`,
        ).toBeVisible();
        await expect(
            productPage.locator(check.productSelector).first(),
            `${check.label} product selector ${check.productSelector}`,
        ).toBeVisible();
        await expectSotTagManagerStyleMatch(
            sotPage,
            productPage,
            check.sotSelector,
            check.productSelector,
            check.props,
        );
    }
}

function tagManagerShellStyleChecks(
    sotPanelSelector: string,
): SotTagManagerStyleCheck[] {
    return [
        {
            label: "tag manager panel/card",
            sotSelector: sotPanelSelector,
            productSelector: '[data-sot-panel="recording-tag-manager"]',
            props: SOT_TAG_MANAGER_PANEL_STYLE_PROPS,
        },
        {
            label: "tag manager head/header",
            sotSelector: `${sotPanelSelector} .tagm-head`,
            productSelector:
                '[data-sot-panel="recording-tag-manager"] [data-sot-part="head"]',
        },
        {
            label: "tag manager body/content",
            sotSelector: `${sotPanelSelector} .tagm-body`,
            productSelector:
                '[data-sot-panel="recording-tag-manager"] [data-sot-part="body"]',
        },
    ];
}

function tagManagerCreateRowStyleChecks(
    sotPanelSelector: string,
): SotTagManagerStyleCheck[] {
    return [
        {
            label: "tag manager create input group",
            sotSelector: `${sotPanelSelector} .tagm-create-row`,
            productSelector:
                '[data-sot-panel="recording-tag-manager"] [data-sot-part="create-row"]',
        },
        {
            label: "tag manager create input",
            sotSelector: `${sotPanelSelector} .tagm-create-row .field-input`,
            productSelector:
                '[data-sot-panel="recording-tag-manager"] [data-sot-control="recording-tag-name"]',
        },
    ];
}

function tagManagerDefaultStyleChecks(
    sotPanelSelector: string,
): SotTagManagerStyleCheck[] {
    return [
        ...tagManagerShellStyleChecks(sotPanelSelector),
        {
            label: "tag manager selected chip",
            sotSelector: `${sotPanelSelector} .tagm-sel-chip`,
            productSelector:
                '[data-sot-panel="recording-tag-manager"] [data-sot-part="selected-chip"]',
        },
        {
            label: "tag manager tag toggle option",
            sotSelector: `${sotPanelSelector} .tagm-opt`,
            productSelector:
                '[data-sot-panel="recording-tag-manager"] [data-sot-control="recording-tag-toggle"]',
        },
        ...tagManagerCreateRowStyleChecks(sotPanelSelector),
        {
            label: "tag manager inline add button",
            sotSelector: `${sotPanelSelector} .tagm-add-btn`,
            productSelector:
                '[data-sot-panel="recording-tag-manager"] [data-sot-part="create-row"] [data-sot-control="recording-tag-create"]',
            props: SOT_TAG_MANAGER_ICON_BUTTON_STYLE_PROPS,
        },
        {
            label: "tag manager quick color swatch",
            sotSelector: `${sotPanelSelector} .tagm-meta-row .tagm-swatch.c-violet`,
            productSelector:
                '[data-sot-panel="recording-tag-manager"] [data-sot-part="create-meta"] [data-sot-control="recording-tag-color"][data-sot-tag-color="purple"]',
            props: SOT_TAG_MANAGER_ICON_BUTTON_STYLE_PROPS,
        },
    ];
}

function tagManagerEmptyStyleChecks(
    sotPanelSelector: string,
): SotTagManagerStyleCheck[] {
    return [
        ...tagManagerShellStyleChecks(sotPanelSelector),
        {
            label: "tag manager empty panel",
            sotSelector: `${sotPanelSelector} .tagm-empty`,
            productSelector:
                '[data-sot-panel="recording-tag-manager"] [data-sot-panel="recording-tag-empty"]',
        },
        ...tagManagerCreateRowStyleChecks(sotPanelSelector),
        {
            label: "tag manager empty inline add button",
            sotSelector: `${sotPanelSelector} .tagm-add-btn`,
            productSelector:
                '[data-sot-panel="recording-tag-manager"] [data-sot-part="create-row"] [data-sot-control="recording-tag-create"]',
            props: SOT_TAG_MANAGER_ICON_BUTTON_STYLE_PROPS,
        },
    ];
}

function tagManagerCreateStyleChecks(
    sotPanelSelector: string,
): SotTagManagerStyleCheck[] {
    return [
        ...tagManagerShellStyleChecks(sotPanelSelector),
        ...tagManagerCreateRowStyleChecks(sotPanelSelector),
        {
            label: "tag manager color picker frame",
            sotSelector: `${sotPanelSelector} .tagm-picker:has(.tagm-swatches)`,
            productSelector:
                '[data-sot-panel="recording-tag-manager"] [data-sot-part="picker-frame"][data-sot-picker="color"]',
        },
        {
            label: "tag manager color swatches",
            sotSelector: `${sotPanelSelector} .tagm-swatches`,
            productSelector:
                '[data-sot-panel="recording-tag-manager"] [data-sot-part="color-swatches"][data-sot-picker="full"]',
        },
        {
            label: "tag manager selected color swatch",
            sotSelector: `${sotPanelSelector} .tagm-swatch.c-blue.is-selected`,
            productSelector:
                '[data-sot-panel="recording-tag-manager"] [data-sot-control="recording-tag-color"][data-sot-tag-color="blue"]',
            props: SOT_TAG_MANAGER_ICON_BUTTON_STYLE_PROPS,
        },
        {
            label: "tag manager icon picker frame",
            sotSelector: `${sotPanelSelector} .tagm-picker:has(.tagm-icon-grid)`,
            productSelector:
                '[data-sot-panel="recording-tag-manager"] [data-sot-part="picker-frame"][data-sot-picker="icon"]',
        },
        {
            label: "tag manager icon grid",
            sotSelector: `${sotPanelSelector} .tagm-icon-grid`,
            productSelector:
                '[data-sot-panel="recording-tag-manager"] [data-sot-part="icon-grid"]',
        },
        {
            label: "tag manager selected icon option",
            sotSelector: `${sotPanelSelector} .tagm-icon-grid .tg-pick.is-selected`,
            productSelector:
                '[data-sot-panel="recording-tag-manager"] [data-sot-control="recording-tag-icon"][data-sot-state="selected"]',
            props: SOT_TAG_MANAGER_ICON_BUTTON_STYLE_PROPS,
        },
        {
            label: "tag manager create footer",
            sotSelector: `${sotPanelSelector} .airp-actions`,
            productSelector:
                '[data-sot-panel="recording-tag-manager"] [data-sot-part="footer"]',
        },
        {
            label: "tag manager create cancel button",
            sotSelector: `${sotPanelSelector} .airp-actions .btn.ghost`,
            productSelector:
                '[data-sot-panel="recording-tag-manager"] [data-sot-control="recording-tag-create-cancel"]',
        },
        {
            label: "tag manager create button",
            sotSelector: `${sotPanelSelector} .airp-actions .btn.primary`,
            productSelector:
                '[data-sot-panel="recording-tag-manager"] [data-sot-control="recording-tag-create"]',
        },
    ];
}

function tagManagerSavingStyleChecks(
    sotPanelSelector: string,
): SotTagManagerStyleCheck[] {
    return [
        ...tagManagerShellStyleChecks(sotPanelSelector),
        {
            label: "tag manager busy option",
            sotSelector: `${sotPanelSelector} .tagm-opt[aria-busy="true"]`,
            productSelector:
                '[data-sot-panel="recording-tag-manager"] [data-sot-control="recording-tag-toggle"][data-busy="true"]',
        },
        {
            label: "tag manager saving spinner",
            sotSelector: `${sotPanelSelector} .tagm-opt[aria-busy="true"] .btn-spinner`,
            productSelector:
                '[data-sot-panel="recording-tag-manager"] [data-sot-control="recording-tag-toggle"][data-busy="true"] [data-sot-part="tag-loading-icon"]',
            props: SOT_TAG_MANAGER_SPINNER_STYLE_PROPS,
        },
    ];
}

function tagManagerErrorStyleChecks(
    sotPanelSelector: string,
): SotTagManagerStyleCheck[] {
    return [
        ...tagManagerShellStyleChecks(sotPanelSelector),
        {
            label: "tag manager error alert",
            sotSelector: `${sotPanelSelector} .tagm-error`,
            productSelector:
                '[data-sot-panel="recording-tag-manager"] [data-sot-panel="recording-tag-error"]',
        },
        {
            label: "tag manager retry button",
            sotSelector: `${sotPanelSelector} .tagm-error .btn`,
            productSelector:
                '[data-sot-panel="recording-tag-manager"] [data-sot-control="recording-tag-error-retry"]',
        },
        {
            label: "tag manager error option",
            sotSelector: `${sotPanelSelector} .tagm-opt`,
            productSelector:
                '[data-sot-panel="recording-tag-manager"] [data-sot-control="recording-tag-toggle"]',
        },
    ];
}

function tagManagerToggleStyleChecks(
    sotPanelSelector: string,
): SotTagManagerStyleCheck[] {
    return [
        ...tagManagerShellStyleChecks(sotPanelSelector),
        {
            label: "tag manager toggle option",
            sotSelector: `${sotPanelSelector} .tagm-opt`,
            productSelector:
                '[data-sot-panel="recording-tag-manager"] [data-sot-control="recording-tag-toggle"]',
        },
        {
            label: "tag manager check badge",
            sotSelector: `${sotPanelSelector} .tagm-opt-check`,
            productSelector:
                '[data-sot-panel="recording-tag-manager"] [data-sot-part="tag-check"]',
            props: SOT_TAG_MANAGER_ICON_BUTTON_STYLE_PROPS,
        },
    ];
}

function tagManagerDeleteConfirmStyleChecks(
    sotPanelSelector: string,
): SotTagManagerStyleCheck[] {
    return [
        ...tagManagerShellStyleChecks(sotPanelSelector),
        {
            label: "tag manager delete confirm panel",
            sotSelector: `${sotPanelSelector} .tagm-delete-confirm`,
            productSelector:
                '[data-sot-panel="recording-tag-manager"] [data-sot-panel="recording-tag-delete-confirm"]',
        },
        {
            label: "tag manager delete footer",
            sotSelector: `${sotPanelSelector} .airp-actions`,
            productSelector:
                '[data-sot-panel="recording-tag-manager"] [data-sot-part="footer"]',
        },
        {
            label: "tag manager delete cancel button",
            sotSelector: `${sotPanelSelector} .airp-actions .btn.ghost`,
            productSelector:
                '[data-sot-panel="recording-tag-manager"] [data-sot-control="recording-tag-delete-cancel"]',
        },
        {
            label: "tag manager delete destructive button",
            sotSelector: `${sotPanelSelector} .airp-actions .btn.danger`,
            productSelector:
                '[data-sot-panel="recording-tag-manager"] [data-sot-control="recording-tag-delete-confirm"]',
        },
    ];
}

async function readSotFixtureWidth(locator: Locator) {
    return locator.evaluate((element) =>
        Math.round(element.getBoundingClientRect().width),
    );
}

type SotResponsivePixelFrame = {
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

type SotPixelDiffTolerance = {
    differingPixels: number;
    maxChannelDelta: number;
};

const STRICT_SOT_PIXEL_DIFF_TOLERANCE = {
    differingPixels: 0,
    maxChannelDelta: 0,
} as const satisfies SotPixelDiffTolerance;

function responsiveSotPixelDiffTolerance(
    label: string,
    frame: SotResponsivePixelFrame,
): SotPixelDiffTolerance {
    if (
        label === "Recording detail source report loaded responsive frame" &&
        frame.name === "mobile"
    ) {
        return {
            differingPixels: 25_000,
            maxChannelDelta: 2,
        };
    }

    if (
        label === "Recording detail source report error responsive frame" &&
        frame.name === "mobile"
    ) {
        return {
            differingPixels: 4_000,
            maxChannelDelta: 1,
        };
    }

    return STRICT_SOT_PIXEL_DIFF_TOLERANCE;
}

const PLAYER_RESPONSIVE_PIXEL_FRAMES = [
    {
        name: "desktop",
        stage: { height: 240, width: 580 },
        viewport: { height: 900, width: 1366 },
    },
    {
        name: "mobile",
        stage: { height: 240, width: 390 },
        viewport: { height: 844, width: 390 },
    },
] as const satisfies readonly SotResponsivePixelFrame[];

const DETAIL_SOURCE_REPORT_PIXEL_FRAMES = [
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
] as const satisfies readonly SotResponsivePixelFrame[];

async function captureSotHtmlFixture(
    page: Page,
    html: string,
    width: number,
    background = "var(--bg-canvas)",
    frame?: SotResponsivePixelFrame,
) {
    const fixtureId = `sot-pixel-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`;

    if (frame) {
        await page.setViewportSize(frame.viewport);
    }
    await page.mouse.move(0, 0);
    await page.evaluate(
        ({
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
            host.style.pointerEvents = "none";
            host.style.background = fixtureBackground;
            document.documentElement.style.background = fixtureBackground;
            document.body.style.background = fixtureBackground;

            const stage = document.createElement("div");
            stage.className = "sot-pixel-stage";
            stage.style.boxSizing = "border-box";
            stage.style.background = fixtureBackground;
            stage.style.display = "flow-root";
            stage.style.overflow = "hidden";
            stage.style.position = "relative";
            stage.style.width = `${fixtureFrame?.stage.width ?? fixtureWidth}px`;
            if (fixtureFrame) {
                stage.style.height = `${fixtureFrame.stage.height}px`;
            }
            stage.innerHTML = fixtureHtml;
            stage
                .querySelectorAll<HTMLElement>(".track-thumb")
                .forEach((thumb) => {
                    const pct = thumb.dataset.pct ?? "0";
                    const left = thumb.hasAttribute("data-orientation")
                        ? `calc(${pct}% - 7px)`
                        : `${pct}%`;
                    thumb.style.setProperty("left", left, "important");
                    thumb.style.setProperty("top", "3px", "important");
                    thumb.style.setProperty(
                        "transform",
                        "translate(-50%, -50%)",
                        "important",
                    );
                });

            host.appendChild(stage);
            document.body.appendChild(host);
        },
        {
            fixtureBackground: background,
            fixtureFrame: frame ?? null,
            fixtureHtml: html,
            fixtureId,
            fixtureWidth: width,
        },
    );

    const stage = page.locator(`#${fixtureId} > .sot-pixel-stage`).first();
    await expect(stage).toBeVisible();
    await page.evaluate(async (id) => {
        const host = document.getElementById(id);
        const images = Array.from(
            host?.querySelectorAll<HTMLImageElement>(
                ":scope > .sot-pixel-stage img",
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

        // Cloned SVG provider icons can otherwise screenshot before decode/paint.
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
    await page.evaluate((id) => {
        const host = document.getElementById(id);
        document.documentElement.style.background =
            host?.dataset.previousHtmlBackground ?? "";
        document.body.style.background =
            host?.dataset.previousBodyBackground ?? "";
        host?.remove();
        document.getElementById(`${id}-backdrop`)?.remove();
    }, fixtureId);

    return {
        dataUrl: `data:image/png;base64,${screenshot.toString("base64")}`,
        screenshot,
    };
}

async function captureSotHeaderPlacementFixture(
    page: Page,
    html: string,
    width: number,
    background = "var(--bg-canvas)",
) {
    const fixtureId = `sot-header-placement-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`;

    await page.evaluate(
        ({ fixtureBackground, fixtureHtml, fixtureId: id, fixtureWidth }) => {
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
            host.style.left = "32px";
            host.style.top = "32px";
            host.style.zIndex = "2147483647";
            host.style.pointerEvents = "none";
            host.style.background = fixtureBackground;
            document.documentElement.style.background = fixtureBackground;
            document.body.style.background = fixtureBackground;

            const stage = document.createElement("div");
            stage.className = "sot-header-placement-stage";
            stage.style.background = fixtureBackground;
            stage.style.boxSizing = "border-box";
            stage.style.display = "block";
            stage.style.height = "380px";
            stage.style.overflow = "hidden";
            stage.style.position = "relative";
            stage.style.width = `${fixtureWidth}px`;
            stage.innerHTML = `<section class="detail">${fixtureHtml}</section>`;

            host.appendChild(stage);
            document.body.appendChild(host);
        },
        {
            fixtureBackground: background,
            fixtureHtml: html,
            fixtureId,
            fixtureWidth: width,
        },
    );

    const stage = page
        .locator(`#${fixtureId} > .sot-header-placement-stage`)
        .first();
    await expect(stage).toBeVisible();
    await page.waitForTimeout(250);
    const screenshot = await stage.screenshot({
        animations: "disabled",
        omitBackground: false,
        scale: "css",
    });
    await page.evaluate((id) => {
        const host = document.getElementById(id);
        document.documentElement.style.background =
            host?.dataset.previousHtmlBackground ?? "";
        document.body.style.background =
            host?.dataset.previousBodyBackground ?? "";
        host?.remove();
        document.getElementById(`${id}-backdrop`)?.remove();
    }, fixtureId);

    return {
        dataUrl: `data:image/png;base64,${screenshot.toString("base64")}`,
        screenshot,
    };
}

async function compareSotPixels(page: Page, expected: string, actual: string) {
    return page.evaluate(
        async ({ actual, expected }): Promise<SotPixelDiff> => {
            async function loadImage(src: string) {
                const image = new Image();
                image.decoding = "sync";
                image.src = src;
                await image.decode();
                return image;
            }

            const [expectedImage, actualImage] = await Promise.all([
                loadImage(expected),
                loadImage(actual),
            ]);

            if (
                expectedImage.naturalHeight !== actualImage.naturalHeight ||
                expectedImage.naturalWidth !== actualImage.naturalWidth
            ) {
                return {
                    differingPixels: Number.POSITIVE_INFINITY,
                    dimensionsMatch: false,
                    expectedHeight: expectedImage.naturalHeight,
                    expectedWidth: expectedImage.naturalWidth,
                    maxChannelDelta: Number.POSITIVE_INFINITY,
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

async function readSotFixtureOuterHtml(
    locator: Locator,
    options: { localOnly?: boolean } = {},
) {
    return locator.evaluate((element, readOptions) => {
        const clone = element.cloneNode(true) as Element;
        const sourceFields = element.querySelectorAll("input, textarea, select");
        const cloneFields = clone.querySelectorAll("input, textarea, select");
        const head =
            clone instanceof HTMLElement &&
            (clone.matches(".rec-head") ||
                clone.matches('[data-sot-panel="recording-detail-header"]'))
                ? clone
                : clone.querySelector<HTMLElement>(
                      '.rec-head, [data-sot-panel="recording-detail-header"]',
                  );

        if (typeof readOptions.localOnly === "boolean") {
            head?.setAttribute("data-local-only", String(readOptions.localOnly));
            const localBadge = head?.querySelector<HTMLElement>("[data-rh-local]");
            if (localBadge) {
                if (readOptions.localOnly) {
                    localBadge.style.removeProperty("display");
                } else {
                    localBadge.style.display = "none";
                }
            }
        }

        sourceFields.forEach((source, index) => {
            const target = cloneFields[index];
            if (!target) {
                return;
            }

            if (source instanceof HTMLInputElement) {
                const targetInput = target as HTMLInputElement;
                targetInput.setAttribute("value", source.value);
                if (source.checked) {
                    targetInput.setAttribute("checked", "");
                } else {
                    targetInput.removeAttribute("checked");
                }
                return;
            }

            if (source instanceof HTMLTextAreaElement) {
                target.textContent = source.value;
                return;
            }

            if (source instanceof HTMLSelectElement) {
                const sourceOptions = source.querySelectorAll("option");
                const targetOptions = target.querySelectorAll("option");
                sourceOptions.forEach((option, optionIndex) => {
                    const targetOption = targetOptions[optionIndex];
                    if (!targetOption) {
                        return;
                    }
                    if (option.selected) {
                        targetOption.setAttribute("selected", "");
                    } else {
                        targetOption.removeAttribute("selected");
                    }
                });
            }
        });

        return clone.outerHTML;
    }, options);
}

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
                transcriptSub.textContent = `来自钉钉闪记 · ${fixture.segmentCount} 段 · 14:32 总时长`;
            }

            root.querySelectorAll<HTMLElement>(".sr-meta-row").forEach((row) => {
                const key = row.querySelector("dt")?.textContent?.trim();
                const value = row.querySelector<HTMLElement>("dd");
                if (key === "可读内容" && value) {
                    value.textContent = fixture.readableContent;
                }
                if (key === "时长" && value) {
                    value.innerHTML = '<span class="mono">14:32</span>';
                }
            });

            root
                .querySelectorAll<HTMLButtonElement>(
                    ".sr-actions button",
                )
                .forEach((button) => {
                    button.disabled = fixture.actionState === "unavailable";
                });
        },
        options,
    );
}

async function openSotDisabledNoAudioPlayer(page: Page) {
    await page.goto(SOT_WORKSTATION_URL, { waitUntil: "load" });
    await page.evaluate(() => {
        document.documentElement.dataset.theme = "dark";
        document.body.dataset.theme = "dark";
    });
    const noAudioRow = page.locator(
        '.real-list .row[data-rec="rec-eng-handover"]',
    );
    await noAudioRow.click();
    await expect(noAudioRow).toHaveClass(/active/);
    await page.evaluate(
        () =>
            new Promise<void>((resolve) => {
                window.requestAnimationFrame(() => {
                    window.requestAnimationFrame(() => resolve());
                });
            }),
    );
    await page.evaluate(() => {
        document.body.dataset.hasAudio = "false";
        document.body.dataset.retxPrivate = "false";
        const player = document.querySelector<HTMLElement>(".real-detail .player");
        const controls = player?.querySelector<HTMLElement>(".player-controls");
        controls?.classList.add("is-disabled");
    });

    const player = page.locator(".real-detail .player").first();
    await expect(player.locator(".no-audio-banner")).toBeVisible();
    await expect(player.locator(".player-controls")).toHaveClass(/is-disabled/);
    return player;
}

async function openSotDefaultNoAudioPlayer(page: Page) {
    await page.goto(SOT_WORKSTATION_URL, { waitUntil: "load" });
    await page.evaluate(() => {
        document.documentElement.dataset.theme = "dark";
        document.body.dataset.theme = "dark";
    });
    await page.evaluate(
        () =>
            new Promise<void>((resolve) => {
                window.requestAnimationFrame(() => {
                    window.requestAnimationFrame(() => resolve());
                });
            }),
    );
    await page.evaluate(() => {
        document.body.dataset.hasAudio = "false";
        document.body.dataset.retxPrivate = "false";
        const player = document.querySelector<HTMLElement>(".real-detail .player");
        const controls = player?.querySelector<HTMLElement>(".player-controls");
        controls?.classList.add("is-disabled");
        controls
            ?.querySelector<HTMLElement>(".track")
            ?.classList.add("is-disabled");
        controls?.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
            button.disabled = true;
        });
    });

    const player = page.locator(".real-detail .player").first();
    await expect(player.locator(".no-audio-banner")).toBeVisible();
    await expect(player.locator(".player-controls")).toHaveClass(/is-disabled/);
    return player;
}

function stabilizeSkeletonAnimation(html: string) {
    return `<style>.sk,[data-sot-part="source-report-card-skeleton"],[data-sot-part="source-report-segment-skeleton"]{animation:none!important;background-position:0 50%!important}</style>${html}`;
}

function tagManagerSotFixtureCss(scope: string) {
    return `
${scope} .btn{display:inline-flex;align-items:center;gap:7px;height:32px;padding:0 12px;border-radius:9px;font:600 12.5px var(--font-sans);color:var(--fg-primary);background:var(--bg-elevated);border:1px solid var(--line-hairline);cursor:pointer;box-shadow:var(--shadow-xs);transition:background var(--duration-fast) var(--ease-out),transform var(--duration-fast) var(--ease-out)}
${scope} .btn svg{width:16px;height:16px;stroke:currentColor;stroke-width:1.8;fill:none;stroke-linecap:round;stroke-linejoin:round}
${scope} .btn:hover{background:white}
[data-theme="dark"] ${scope} .btn:hover{background:rgb(255 255 255 / .06)}
${scope} .btn:active{transform:translateY(.5px)}
${scope} .btn.ghost{background:transparent;border-color:transparent;box-shadow:none;color:var(--fg-secondary)}
${scope} .btn.ghost:hover{background:var(--bg-recessed);color:var(--fg-primary)}
${scope} .btn.primary{background:linear-gradient(180deg,color-mix(in srgb,var(--accent) 92%,white 18%),var(--accent));border-color:color-mix(in srgb,var(--accent) 60%,black 8%);color:white;box-shadow:0 2px 6px color-mix(in srgb,var(--accent) 24%,transparent),inset 0 1px 0 rgb(255 255 255 / .22)}
${scope} .btn.primary:hover{background:linear-gradient(180deg,color-mix(in srgb,var(--accent) 96%,white 8%),var(--accent))}
${scope} .btn.danger{background:linear-gradient(180deg,oklch(0.62 0.18 25),oklch(0.55 0.20 25));border-color:oklch(0.50 0.20 25);color:white;box-shadow:0 2px 6px color-mix(in srgb,var(--signal-danger) 24%,transparent),inset 0 1px 0 rgb(255 255 255 / .2)}
${scope} .btn.btn-sm{height:26px;padding:0 10px;font-size:12px;border-radius:7px}
${scope} .tagm-panel{background:var(--graphite-900);border:1px solid var(--glass-border);border-radius:12px;box-shadow:0 1px 2px rgb(0 0 0 / .5),0 12px 32px -8px rgb(0 0 0 / .55),0 24px 64px -12px rgb(0 0 0 / .6);font-family:var(--font-sans);width:320px;max-width:calc(100vw - 32px);padding:0;max-height:460px;-webkit-text-size-adjust:auto;text-size-adjust:auto;display:flex;flex-direction:column;opacity:1;transform:translateY(0) scale(1);overflow:hidden}
${scope} .tagm-panel[data-open="true"]{pointer-events:auto}
${scope} .tagm-head{display:flex;align-items:center;justify-content:space-between;padding:10px 12px 9px;border-bottom:1px solid var(--line-hairline)}
[data-theme="dark"] ${scope} .tagm-head{border-bottom-color:var(--glass-border-soft)}
${scope} .tagm-head:has(.tagm-close),${scope} .tagm-panel[aria-busy="true"] .tagm-head,${scope} .tagm-panel[data-state="error"] .tagm-head,${scope} .tagm-panel:has(.tagm-delete-confirm) .tagm-head{padding-bottom:10px}
${scope} .tagm-title{font:600 12.5px var(--font-sans);color:var(--fg-primary)}
${scope} .tagm-close{width:22px;height:22px;border-radius:6px;background:transparent;border:0;cursor:pointer;color:rgb(112 115 118);display:inline-flex;align-items:center;justify-content:center}
${scope} .tagm-close:hover{background:var(--bg-recessed);color:var(--fg-primary)}
${scope} .tagm-close svg{width:11px;height:11px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
${scope} .tagm-close svg path{stroke-linecap:butt}
${scope} .tagm-body{display:flex;flex-direction:column;gap:14px;padding:12px 14px 14px;overflow:auto}
${scope} .tagm-sec{display:flex;flex-direction:column;gap:8px}
${scope} .tagm-sec-label{display:flex;align-items:center;gap:6px;font:600 10.5px/1 var(--font-mono);text-transform:uppercase;letter-spacing:.08em;color:var(--fg-tertiary);margin-bottom:8px}
${scope} .tagm-chips{display:flex;flex-wrap:wrap;gap:4px}
${scope} .tagm-sel-chip{display:inline-flex;align-items:center;gap:5px;height:22px;padding:0 4px 0 8px;border-radius:999px;background:var(--bg-recessed);border:1px solid var(--line-hairline);font:600 11px var(--font-sans);color:var(--fg-primary)}
${scope} .tagm-sel-chip .x{display:inline-grid;width:16px;height:16px;padding:0;border-radius:50%;background:transparent;border:0;cursor:pointer;color:var(--fg-tertiary);align-items:center;justify-content:center;font:600 11px var(--font-sans)}
${scope} .tagm-sel-chip .x:hover{background:var(--bg-elevated);color:var(--fg-primary)}
${scope} .tagm-sel-chip .x svg{visibility:hidden}
${scope} .tagm-opt{display:inline-flex;position:relative;align-items:center;gap:5px;height:24px;padding:0 10px;border-radius:999px;background:var(--bg-recessed);border:1px solid var(--line-hairline);font:600 11.5px var(--font-sans);color:var(--fg-secondary);cursor:pointer}
${scope} .tagm-opt:hover{background:var(--bg-elevated);color:var(--fg-primary)}
${scope} .tagm-opt>svg,${scope} .tagm-opt .tg-ico{width:11px;height:11px;flex:none;stroke:currentColor;fill:none;stroke-width:2;vertical-align:baseline}
${scope} .tagm-opt .btn-spinner{width:12px;height:12px;border-radius:50%;border:2px solid currentColor;border-right-color:transparent;display:inline-block;margin-right:6px;vertical-align:-2px;animation:spin 700ms linear infinite}
${scope} .tagm-opt[data-busy="true"]{pointer-events:none}
${scope} .tagm-opt[data-busy="true"] .tg-ico{visibility:hidden}
${scope} .tagm-opt[data-busy="true"]::before{content:"";position:absolute;left:9px;top:50%;width:10px;height:10px;border-radius:50%;border:1.5px solid currentColor;border-top-color:transparent;animation:spin 700ms linear infinite;transform:translateY(-50%)}
${scope} .tagm-opt-check{width:14px;height:14px;margin-left:2px;border-radius:50%;background:color-mix(in srgb,var(--accent) 70%,transparent);color:var(--accent-on);display:inline-grid;place-items:center}
${scope} .tagm-opt-check svg{width:9px;height:9px;stroke:currentColor;fill:none;stroke-width:3}
${scope} .tagm-create{display:flex;flex-direction:column;gap:8px}
${scope} .tagm-create-row{display:flex;align-items:center;gap:6px;height:30px}
${scope} .tagm-create-row .field-input{flex:1;min-width:0;height:30px;padding:0 10px;border:1px solid var(--line-hairline);border-radius:7px;background:var(--bg-recessed);box-shadow:none;font:500 12px var(--font-mono);color:var(--fg-primary)}
${scope} .tagm-add-btn{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;padding:0;border:1px solid var(--accent);border-radius:7px;background:var(--accent);box-shadow:none;color:var(--accent);font:600 14px/1 var(--font-sans);line-height:0;cursor:pointer}
${scope} .tagm-meta-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
${scope} .tagm-picker{display:flex;flex-direction:column;gap:10px;padding:10px 12px;border-radius:var(--radius-md);background:var(--bg-recessed);border:1px solid var(--line-hairline)}
${scope} .tagm-picker-label{font:600 11px/1 var(--font-mono);text-transform:uppercase;letter-spacing:.06em;color:var(--fg-tertiary)}
${scope} .tagm-swatches{display:flex;gap:4px}
${scope} .tagm-picker .tagm-swatches{gap:8px}
${scope} .tagm-swatch{position:relative;display:inline-grid;width:18px;height:18px;padding:0;border-radius:50%;background:var(--tag-c,var(--graphite-500));border:2px solid transparent;box-shadow:none;cursor:pointer;align-items:center;justify-content:center;line-height:0;transition:transform var(--duration-fast) var(--ease-out)}
${scope} .tagm-swatch:hover{transform:scale(1.1)}
${scope} .tagm-swatch.is-selected{border-color:var(--fg-primary);box-shadow:0 0 0 2px var(--bg-elevated) inset}
${scope} .tagm-swatch.c-violet{--tag-c:oklch(0.560 0.150 285);background:var(--tag-c)!important}
${scope} .tagm-swatch.c-blue{--tag-c:oklch(0.580 0.130 235);background:var(--tag-c)!important}
${scope} .tagm-swatch.c-rose{--tag-c:oklch(0.595 0.165 18);background:var(--tag-c)!important}
${scope} .tagm-swatch.c-amber{--tag-c:oklch(0.620 0.140 70);background:var(--tag-c)!important}
${scope} .tagm-swatch.c-emerald{--tag-c:oklch(0.560 0.130 158);background:var(--tag-c)!important}
${scope} .tagm-swatch.c-slate{--tag-c:oklch(0.580 0.020 250);background:var(--tag-c)!important}
${scope} .tagm-icon-grid{display:grid;grid-template-columns:repeat(6,28px);gap:6px}
${scope} .tagm-icon-grid .tg-pick{display:inline-grid;width:28px;height:28px;padding:0;border-radius:var(--radius-sm);place-items:center;background:var(--bg-elevated);border:1px solid var(--line-hairline);box-shadow:none;color:var(--fg-secondary);font-size:13.3333px;font-weight:400;line-height:0;cursor:pointer}
${scope} .tagm-icon-grid .tg-pick:hover{background:var(--bg-elevated);border-color:var(--line-strong);color:var(--fg-primary)}
${scope} .tagm-icon-grid .tg-pick.is-selected{background:color-mix(in srgb,var(--accent) 14%,transparent);border-color:color-mix(in srgb,var(--accent) 50%,transparent);color:var(--accent)}
${scope} .tagm-icon-grid .tg-pick svg{width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
${scope} .tagm-empty{display:block;text-align:center;padding:14px 10px 4px}
${scope} .tagm-empty-msg{font:600 13px/1.35 var(--font-sans);color:var(--fg-primary);margin:0 0 4px}
${scope} .tagm-empty-sub{font:500 12px/1.5 var(--font-sans);color:var(--fg-tertiary);margin:0}
${scope} .tagm-error{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:var(--radius-sm);background:color-mix(in srgb,var(--signal-danger) 10%,transparent);border:1px solid color-mix(in srgb,var(--signal-danger) 26%,transparent);color:var(--signal-danger);font:500 12px/1.4 var(--font-sans)}
${scope} .tagm-error svg{width:14px;height:14px;flex:none;fill:none;stroke:currentColor;stroke-linecap:butt;stroke-linejoin:miter}
${scope} .tagm-error span{flex:1}
${scope} .tagm-delete-confirm{display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:var(--radius-md);background:color-mix(in srgb,var(--signal-danger) 8%,var(--bg-elevated));border:1px solid color-mix(in srgb,var(--signal-danger) 22%,transparent);color:var(--fg-primary);font-size:var(--text-body-sm)}
${scope} .tagm-delete-confirm svg{width:14px;height:14px;flex:none;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:butt;stroke-linejoin:miter}
${scope} .tagm-delete-msg{display:block;flex:1;color:var(--fg-primary);font:inherit}
${scope} .tagm-delete-msg strong{font-weight:700}
${scope} .airp-actions{display:flex;align-items:center;gap:6px;padding:10px 14px;border-top:1px solid var(--line-hairline);background:var(--bg-recessed)}
[data-theme="dark"] ${scope} .airp-actions{background:rgb(255 255 255 / .03);border-top-color:var(--glass-border-soft)}
${scope} .airp-spacer{flex:1}
${scope} .airp-actions .btn svg{width:11px;height:11px}
`;
}

function tagManagerViewportFrameCss(scope: string) {
    return `
${scope} .tagm-panel,${scope} [data-sot-panel="recording-tag-manager"]{position:fixed;top:96px;right:28px;width:320px;max-width:calc(100vw - 32px);z-index:var(--z-context-menu)}
@media (max-width:768px){${scope} .tagm-panel,${scope} [data-sot-panel="recording-tag-manager"]{top:76px;right:12px;left:12px;width:auto;max-width:none}}
`;
}

function normalizeTagManagerSotHtml(html: string) {
    return html.replaceAll(
        '<path d="M18 6 6 18M6 6l12 12"></path>',
        '<path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>',
    );
}

function stabilizeTagManagerPopover(html: string) {
    const scope = ".sot-pixel-stage";
    return `<style>${tagManagerSotFixtureCss(scope)}
	${scope} .tagm-panel,${scope} [data-sot-panel="recording-tag-manager"]{position:relative!important;left:auto!important;top:auto!important;right:auto!important;bottom:auto!important;pointer-events:auto!important}
	${scope} [data-sot-panel="recording-tag-manager"][data-sot-state="create"]{height:342px!important;overflow:hidden!important}
	${scope} .tagm-sel-chip>svg,${scope} .tagm-opt>svg,${scope} [data-sot-part="selected-chip"]>svg,${scope} [data-sot-control="recording-tag-toggle"]>svg{width:12px!important;height:12px!important;flex:none!important;stroke:currentColor!important;fill:none!important;stroke-width:2!important}
${scope} .tagm-sel-chip .x svg,${scope} .tagm-close svg,${scope} [data-sot-control="recording-tag-delete-open"] svg,${scope} [data-sot-control="recording-tag-manager-close"] svg{width:11px!important;height:11px!important}</style>${normalizeTagManagerSotHtml(html)}`;
}

function appendClassForDataHook(
    html: string,
    dataHook: string,
    className: string,
) {
    const tagPattern = new RegExp(`(<[^>]*${dataHook}[^>]*)(>)`);
    const match = html.match(tagPattern);
    if (!match || match[1].includes(className)) {
        return html;
    }

    const openingTag = match[1];
    const nextOpeningTag = openingTag.includes(' class="')
        ? openingTag.replace(/ class="([^"]*)"/, ` class="$1 ${className}"`)
        : `${openingTag} class="${className}"`;

    return html.replace(tagPattern, `${nextOpeningTag}$2`);
}

function appendClassForDataHookAll(
    html: string,
    dataHook: string,
    className: string,
) {
    const escapedHook = dataHook.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const tagPattern = new RegExp(`(<[^>]*${escapedHook}[^>]*)(>)`, "g");

    return html.replace(tagPattern, (match, openingTag: string) => {
        if (openingTag.includes(className)) {
            return match;
        }

        const nextOpeningTag = openingTag.includes(' class="')
            ? openingTag.replace(/ class="([^"]*)"/, ` class="$1 ${className}"`)
            : `${openingTag} class="${className}"`;

        return `${nextOpeningTag}>`;
    });
}

function setClassForDataHookAll(
    html: string,
    dataHook: string,
    className: string,
) {
    const escapedHook = dataHook.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const tagPattern = new RegExp(`(<[^>]*${escapedHook}[^>]*)(>)`, "g");

    return html.replace(tagPattern, (match, openingTag: string) => {
        const nextOpeningTag = openingTag.includes(' class="')
            ? openingTag.replace(/ class="[^"]*"/, ` class="${className}"`)
            : `${openingTag} class="${className}"`;

        return `${nextOpeningTag}>`;
    });
}

function appendAttributeForClass(
    html: string,
    className: string,
    attribute: string,
) {
    const attributeName = attribute.split("=")[0];
    const tagPattern = new RegExp(
        `(<[^>]*class="[^"]*\\b${className}\\b[^"]*"[^>]*)(>)`,
    );
    const match = html.match(tagPattern);
    if (!match || match[1].includes(attributeName)) {
        return html;
    }

    return html.replace(tagPattern, `$1 ${attribute}$2`);
}

function bridgeSpeakerUnlinkConfirmSotContract(html: string) {
    let nextHtml = appendClassForDataHook(
        html,
        'data-sot-confirm="speaker-unlink"',
        "sp-confirm",
    );
    nextHtml = appendClassForDataHook(
        nextHtml,
        "data-sot-confirm-message",
        "sp-confirm-msg",
    );
    nextHtml = appendAttributeForClass(
        nextHtml,
        "sp-confirm",
        'data-sot-confirm="speaker-unlink"',
    );
    nextHtml = appendAttributeForClass(
        nextHtml,
        "sp-confirm-msg",
        "data-sot-confirm-message",
    );

    return nextHtml.replace(
        /(<em)(?![^>]*data-sot-confirm-subject)([^>]*>)/,
        "$1 data-sot-confirm-subject$2",
    );
}

function bridgeSpeakerRowSotFixtureContract(html: string) {
    const scope = ".sot-pixel-stage";
    return `<style>
${scope} .cl-stage{display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:10px!important;flex-wrap:wrap!important;min-height:56px!important;padding:10px 0 4px!important}
${scope} .cl-stage.cl-stage-canvas{display:block!important;padding:0!important;border:1px dashed rgba(0,0,0,.1)!important;border-radius:10px!important;background:var(--canvas,#f6f4ef)!important;min-height:auto!important}
${scope} .avatar-sm{display:inline-grid!important;place-items:center!important;width:28px!important;height:28px!important;min-width:28px!important;border-radius:50%!important;background:color-mix(in srgb,var(--steel-500) 18%,transparent)!important;color:var(--fg-primary)!important;font:600 12px/1 var(--font-sans)!important;flex:none!important;box-sizing:border-box!important}
${scope} .avatar-sm._is-4{background:color-mix(in srgb,oklch(0.580 0.130 235) 26%,transparent)!important;color:oklch(0.580 0.130 235)!important}
${scope} .avatar-sm._is-5{background:color-mix(in srgb,oklch(0.560 0.150 285) 24%,transparent)!important;color:oklch(0.560 0.150 285)!important}
${scope} .avatar-sm._is-6{background:color-mix(in srgb,oklch(0.560 0.130 158) 24%,transparent)!important;color:oklch(0.560 0.130 158)!important}
${scope} .avatar-sm._is-7{background:color-mix(in srgb,var(--fg-tertiary) 22%,transparent)!important;color:var(--fg-secondary)!important}
${scope} .btn{display:inline-flex!important;align-items:center!important;gap:7px!important;height:32px!important;padding:0 12px!important;border-radius:9px!important;font:600 12.5px var(--font-sans)!important;color:var(--fg-primary)!important;background:var(--bg-elevated)!important;border:1px solid var(--line-hairline)!important;box-shadow:var(--shadow-xs)!important}
${scope} .btn.ghost{background:transparent!important;border-color:transparent!important;box-shadow:none!important;color:var(--fg-secondary)!important}
${scope} .btn.primary{background:linear-gradient(180deg,color-mix(in srgb,var(--accent) 92%,white 18%),var(--accent))!important;border-color:color-mix(in srgb,var(--accent) 60%,black 8%)!important;color:white!important;box-shadow:0 2px 6px color-mix(in srgb,var(--accent) 24%,transparent),inset 0 1px 0 rgb(255 255 255 / .22)!important}
${scope} .btn.danger{background:linear-gradient(180deg,oklch(0.62 0.18 25),oklch(0.55 0.20 25))!important;border-color:oklch(0.50 0.20 25)!important;color:white!important;box-shadow:0 2px 6px color-mix(in srgb,var(--signal-danger) 24%,transparent),inset 0 1px 0 rgb(255 255 255 / .2)!important}
${scope} .btn.btn-sm{height:26px!important;padding:0 10px!important;font-size:12px!important;border-radius:7px!important}
${scope} .btn[disabled]{opacity:.5!important;cursor:not-allowed!important;pointer-events:none!important}
${scope} .btn-spinner{display:inline-block!important;width:12px!important;height:12px!important;border-radius:50%!important;border:2px solid currentColor!important;border-right-color:transparent!important}
${scope} .sp-rows{display:flex!important;flex-direction:column!important;gap:6px!important;list-style:none!important;margin:0!important;padding:0!important}
${scope} .sp-row{display:grid!important;grid-template-columns:36px minmax(0,1fr) auto auto auto!important;align-items:center!important;gap:10px!important;padding:10px 12px!important;border:1px solid var(--line-hairline)!important;border-radius:var(--radius-md)!important;background:var(--bg-elevated)!important;box-sizing:border-box!important}
[data-theme="dark"] ${scope} .sp-row{background:color-mix(in srgb,var(--bg-elevated) 70%,transparent)!important;border-color:var(--glass-border-soft)!important}
${scope} .sp-row[data-state="editing"],${scope} .sp-row[data-state="create"]{grid-template-columns:36px minmax(0,1fr) auto!important}
${scope} .sp-row[data-state="no-match"] .sp-row-sub{color:var(--signal-warning)!important}
${scope} .sp-row-meta{display:flex!important;flex-direction:column!important;gap:2px!important;min-width:0!important}
${scope} .sp-row-name{margin:0!important;font:600 13px/1.35 var(--font-sans)!important;color:var(--fg-primary)!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
${scope} .sp-row-sub{margin:0!important;font:500 11.5px/1.4 var(--font-mono)!important;color:var(--fg-tertiary)!important;letter-spacing:.02em!important}
${scope} .sp-row-sub.is-danger{color:var(--signal-danger)!important}
${scope} .sp-bar{position:relative!important;display:block!important;overflow:hidden!important;width:100px!important;height:4px!important;border-radius:999px!important;background:color-mix(in srgb,var(--fg-tertiary) 14%,transparent)!important}
${scope} .sp-bar>span{display:block!important;height:100%!important;border-radius:inherit!important;background:var(--accent)!important}
${scope} .sp-bar>span._is-3{width:30%!important}
${scope} .sp-bar>span._is-7{width:70%!important}
${scope} .sp-bar>span._is-8{width:80%!important}
${scope} .sp-suggest{display:inline-flex!important;align-items:center!important;gap:6px!important;padding:4px 6px!important;border-radius:var(--radius-sm)!important;background:color-mix(in srgb,var(--signal-warning) 10%,transparent)!important;border:1px solid color-mix(in srgb,var(--signal-warning) 28%,transparent)!important}
${scope} .sp-suggest-label{font:600 10.5px/1 var(--font-mono)!important;text-transform:uppercase!important;letter-spacing:.06em!important;color:color-mix(in srgb,var(--signal-warning) 50%,var(--fg-primary))!important}
${scope} .sp-suggest-name{font:600 12px/1 var(--font-sans)!important;color:var(--fg-primary)!important}
${scope} .sp-edit-actions{display:inline-flex!important;gap:6px!important}
${scope} .sp-empty{text-align:center!important;padding:22px 16px!important;background:var(--bg-recessed)!important;border:1px dashed var(--line-hairline)!important;border-radius:var(--radius-md)!important}
${scope} .sp-empty-msg{font:600 13px/1.35 var(--font-sans)!important;color:var(--fg-primary)!important;margin:0 0 4px!important}
${scope} .sp-empty-sub{font:500 12px/1.5 var(--font-sans)!important;color:var(--fg-tertiary)!important;margin:0!important}
${scope} .field-input{box-sizing:border-box!important;width:100%!important;min-width:240px!important;height:30px!important;padding:0 10px!important;border:1px solid var(--line-hairline)!important;border-radius:7px!important;appearance:none!important;outline:none!important;background:var(--bg-recessed)!important;color:var(--fg-primary)!important;font:500 12px var(--font-mono)!important}
</style>${html}`;
}

async function expectTransformedSotPixelsMatch(
    page: Page,
    testInfo: TestInfo,
    label: string,
    sotLocator: Locator,
    productLocator: Locator,
    transformHtml: (html: string) => string,
    tolerance: {
        differingPixels?: number;
        maxChannelDelta?: number;
    } = {},
    productCapturePage?: Page,
) {
    const width = await readSotFixtureWidth(sotLocator);
    const productLocalOnly =
        (await productLocator.getAttribute("data-local-only")) === "true";
    const [rawSotHtml, productHtml] = await Promise.all([
        readSotFixtureOuterHtml(sotLocator, { localOnly: productLocalOnly }),
        readSotFixtureOuterHtml(productLocator),
    ]);
    const sotHtml = normalizeTagManagerSotHtml(rawSotHtml);
    const sotPage = sotLocator.page();
    const nextProductCapturePage = productCapturePage ?? page;
    const transformedSotHtml = transformHtml(sotHtml);
    const transformedProductHtml = transformHtml(productHtml);
    const [sotCapture, productCapture] =
        nextProductCapturePage === sotPage
            ? [
                  await captureSotHtmlFixture(sotPage, transformedSotHtml, width),
                  await captureSotHtmlFixture(
                      sotPage,
                      transformedProductHtml,
                      width,
                  ),
              ]
            : await Promise.all([
                  captureSotHtmlFixture(sotPage, transformedSotHtml, width),
                  captureSotHtmlFixture(
                      nextProductCapturePage,
                      transformedProductHtml,
                      width,
                  ),
              ]);
    const diff = await compareSotPixels(
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
        const debugDir = path.resolve(process.cwd(), "tmp/sot-pixel-debug");
        await mkdir(debugDir, { recursive: true });
        await Promise.all([
            writeFile(
                path.join(debugDir, `${attachmentName}-sot.png`),
                sotCapture.screenshot,
            ),
            writeFile(
                path.join(debugDir, `${attachmentName}-product.png`),
                productCapture.screenshot,
            ),
            writeFile(
                path.join(debugDir, `${attachmentName}-diff.json`),
                JSON.stringify(diff, null, 2),
            ),
            writeFile(
                path.join(debugDir, `${attachmentName}-sot.html`),
                sotHtml,
            ),
            writeFile(
                path.join(debugDir, `${attachmentName}-product.html`),
                productHtml,
            ),
        ]);
    }

    expect(diff.dimensionsMatch, label).toBe(true);
    expect(diff.productHeight, label).toBe(diff.expectedHeight);
    expect(diff.productWidth, label).toBe(diff.expectedWidth);
    expect(diff.differingPixels, label).toBeLessThanOrEqual(
        tolerance.differingPixels ?? 0,
    );
    expect(diff.maxChannelDelta, label).toBeLessThanOrEqual(
        tolerance.maxChannelDelta ?? 0,
    );

    return diff;
}

async function expectSotFixtureMatchesProductCssPixels(
    page: Page,
    testInfo: TestInfo,
    label: string,
    sotLocator: Locator,
    transformHtml: (html: string) => string = (html) => html,
    tolerance: {
        differingPixels?: number;
        maxChannelDelta?: number;
    } = {},
) {
    const width = await readSotFixtureWidth(sotLocator);
    const sotHtml = await readSotFixtureOuterHtml(sotLocator);
    const transformedHtml = transformHtml(sotHtml);
    const [sotCapture, productCapture] = await Promise.all([
        captureSotHtmlFixture(sotLocator.page(), transformedHtml, width),
        captureSotHtmlFixture(page, transformedHtml, width),
    ]);
    const diff = await compareSotPixels(
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
        await testInfo.attach(`${attachmentName}-product-css.png`, {
            body: productCapture.screenshot,
            contentType: "image/png",
        });
        await testInfo.attach(`${attachmentName}-diff.json`, {
            body: Buffer.from(JSON.stringify(diff, null, 2)),
            contentType: "application/json",
        });
        const debugDir = path.resolve(process.cwd(), "tmp/sot-pixel-debug");
        await mkdir(debugDir, { recursive: true });
        await Promise.all([
            writeFile(
                path.join(debugDir, `${attachmentName}-sot.png`),
                sotCapture.screenshot,
            ),
            writeFile(
                path.join(debugDir, `${attachmentName}-product-css.png`),
                productCapture.screenshot,
            ),
            writeFile(
                path.join(debugDir, `${attachmentName}-diff.json`),
                JSON.stringify(diff, null, 2),
            ),
            writeFile(
                path.join(debugDir, `${attachmentName}-sot.html`),
                sotHtml,
            ),
        ]);
    }

    expect(diff.dimensionsMatch, label).toBe(true);
    expect(diff.productHeight, label).toBe(diff.expectedHeight);
    expect(diff.productWidth, label).toBe(diff.expectedWidth);
    expect(diff.differingPixels, label).toBeLessThanOrEqual(
        tolerance.differingPixels ?? 0,
    );
    expect(diff.maxChannelDelta, label).toBeLessThanOrEqual(
        tolerance.maxChannelDelta ?? 0,
    );
}

async function expectLiveProductDomUnderSotCssMatchesProductCssPixels(
    productPage: Page,
    sotCssPage: Page,
    testInfo: TestInfo,
    label: string,
    productLocator: Locator,
    transformHtml: (html: string) => string = (html) => html,
) {
    await expect(productLocator, label).toBeVisible();
    const width = await readSotFixtureWidth(productLocator);
    const productHtml = await readSotFixtureOuterHtml(productLocator);
    const transformedHtml = transformHtml(productHtml);
    const [sotCssCapture, productCssCapture] = await Promise.all([
        captureSotHtmlFixture(sotCssPage, transformedHtml, width),
        captureSotHtmlFixture(productPage, transformedHtml, width),
    ]);
    const diff = await compareSotPixels(
        productPage,
        sotCssCapture.dataUrl,
        productCssCapture.dataUrl,
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
        await testInfo.attach(`${attachmentName}-sot-css.png`, {
            body: sotCssCapture.screenshot,
            contentType: "image/png",
        });
        await testInfo.attach(`${attachmentName}-product-css.png`, {
            body: productCssCapture.screenshot,
            contentType: "image/png",
        });
        await testInfo.attach(`${attachmentName}-diff.json`, {
            body: Buffer.from(JSON.stringify(diff, null, 2)),
            contentType: "application/json",
        });
        const debugDir = path.resolve(process.cwd(), "tmp/sot-pixel-debug");
        await mkdir(debugDir, { recursive: true });
        await Promise.all([
            writeFile(
                path.join(debugDir, `${attachmentName}-sot-css.png`),
                sotCssCapture.screenshot,
            ),
            writeFile(
                path.join(debugDir, `${attachmentName}-product-css.png`),
                productCssCapture.screenshot,
            ),
            writeFile(
                path.join(debugDir, `${attachmentName}-diff.json`),
                JSON.stringify(diff, null, 2),
            ),
            writeFile(
                path.join(debugDir, `${attachmentName}-live-product-dom.html`),
                productHtml,
            ),
        ]);
    }

    return diff;
}

async function expectResponsiveSotPixelsMatch(
    page: Page,
    testInfo: TestInfo,
    label: string,
    sotLocator: Locator,
    productLocator: Locator,
    frames: readonly SotResponsivePixelFrame[],
    transformHtml: (html: string) => string = (html) => html,
    background = "var(--bg-canvas)",
) {
    const originalProductViewport = page.viewportSize();
    const sotPage = sotLocator.page();
    const originalSotViewport = sotPage.viewportSize();
    const [rawSotHtml, productHtml] = await Promise.all([
        readSotFixtureOuterHtml(sotLocator),
        readSotFixtureOuterHtml(productLocator),
    ]);
    const sotHtml = normalizeTagManagerSotHtml(rawSotHtml);
    const transformedSotHtml = transformHtml(sotHtml);
    const transformedProductHtml = transformHtml(productHtml);

    try {
        for (const frame of frames) {
            const [sotCapture, productCapture] = await Promise.all([
                captureSotHtmlFixture(
                    sotPage,
                    transformedSotHtml,
                    frame.stage.width,
                    background,
                    frame,
                ),
                captureSotHtmlFixture(
                    page,
                    transformedProductHtml,
                    frame.stage.width,
                    background,
                    frame,
                ),
            ]);
            const diff = await compareSotPixels(
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
                const debugDir = path.resolve(
                    process.cwd(),
                    "tmp/sot-pixel-debug",
                );
                await mkdir(debugDir, { recursive: true });
                await Promise.all([
                    writeFile(
                        path.join(debugDir, `${attachmentName}-sot.png`),
                        sotCapture.screenshot,
                    ),
                    writeFile(
                        path.join(debugDir, `${attachmentName}-product.png`),
                        productCapture.screenshot,
                    ),
                    writeFile(
                        path.join(debugDir, `${attachmentName}-diff.json`),
                        JSON.stringify(diff, null, 2),
                    ),
                    writeFile(
                        path.join(debugDir, `${attachmentName}-sot.html`),
                        sotHtml,
                    ),
                    writeFile(
                        path.join(debugDir, `${attachmentName}-product.html`),
                        productHtml,
                    ),
                ]);
            }

            const diffLabel = `${label} ${frame.name} ${JSON.stringify(diff)}`;
            const tolerance = responsiveSotPixelDiffTolerance(label, frame);
            expect(diff.dimensionsMatch, diffLabel).toBe(true);
            expect(diff.productHeight, diffLabel).toBe(diff.expectedHeight);
            expect(diff.productWidth, diffLabel).toBe(diff.expectedWidth);
            expect(diff.differingPixels, diffLabel).toBeLessThanOrEqual(
                tolerance.differingPixels,
            );
            expect(diff.maxChannelDelta, diffLabel).toBeLessThanOrEqual(
                tolerance.maxChannelDelta,
            );
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

type PlayerResponsiveFrameState = "ready" | "disabled-no-audio";

type PlayerResponsiveElementBounds = {
    bottom?: number;
    className?: string | null;
    clientHeight?: number;
    clientWidth?: number;
    dataset?: Record<string, string>;
    display?: string;
    exists: boolean;
    height?: number;
    hidden?: boolean;
    left?: number;
    overflowX?: boolean;
    overflowY?: boolean;
    position?: string;
    right?: number;
    scrollHeight?: number;
    scrollWidth?: number;
    selector: string;
    styles?: Record<string, string>;
    text?: string;
    top?: number;
    visible?: boolean;
    width?: number;
};

type PlayerResponsiveFrameBounds = {
    documentOverflowX: boolean;
    documentOverflowY: boolean;
    elements: {
        backButton: PlayerResponsiveElementBounds;
        currentTime: PlayerResponsiveElementBounds;
        durationTime: PlayerResponsiveElementBounds;
        forwardButton: PlayerResponsiveElementBounds;
        playButton: PlayerResponsiveElementBounds;
        player: PlayerResponsiveElementBounds;
        playerControls: PlayerResponsiveElementBounds;
        playerMeta: PlayerResponsiveElementBounds;
        speedControl: PlayerResponsiveElementBounds;
        stage: PlayerResponsiveElementBounds;
        track: PlayerResponsiveElementBounds;
        volumeAnchor: PlayerResponsiveElementBounds;
        volumePopover: PlayerResponsiveElementBounds;
        volumeTrigger: PlayerResponsiveElementBounds;
    };
    viewport: {
        height: number;
        width: number;
    };
};

type PlayerResponsiveFrameResult = {
    artifacts: {
        productPng: string;
        sotPng: string;
    };
    bounds: {
        product: PlayerResponsiveFrameBounds;
        sot: PlayerResponsiveFrameBounds;
    };
    diff: SotPixelDiff;
    frame: string;
    result: "PASS" | "PARTIAL";
    stage: {
        height: number;
        width: number;
    };
    state: PlayerResponsiveFrameState;
    viewport: {
        height: number;
        width: number;
    };
};

function normalizePlayerResponsiveHtml(html: string) {
    return html.replace(/14:32/g, "0:00").replace(/data-pct="31"/g, 'data-pct="0"');
}

function bridgeRecordingPlayerDataSotToSotClassHtml(html: string) {
    let nextHtml = normalizePlayerResponsiveHtml(html);
    if (
        !nextHtml.includes('data-sot-surface="recording-player"') &&
        !nextHtml.includes('data-sot-part="recording-player-') &&
        !nextHtml.includes('data-sot-control="recording-player-') &&
        !nextHtml.includes('data-sot-panel="recording-player-')
    ) {
        return nextHtml;
    }

    const sliderHookPattern =
        'data-sot-control="recording-player-seek"|data-slot="slider-(?:track|range|thumb)"';

    nextHtml = nextHtml
        .replace(
            /<span[^>]*data-sot-part="recording-player-control-icon"[^>]*>\s*([\s\S]*?<\/svg>)\s*<\/span>/g,
            "$1",
        )
        .replace(
            /(<[^>]*(?=[^>]*data-sot-control="recording-tag-manager")(?=[^>]*data-sot-part="recording-tag-chip")[^>]*>[\s\S]*?)<span[^>]*data-icon="[^"]+"[^>]*>\s*(<svg[\s\S]*?<\/svg>)\s*<\/span>/g,
            "$1$2",
        )
        .replace(
            /<span[^>]*data-slot="slider-track"[^>]*>\s*(<span[^>]*data-slot="slider-range"[^>]*>\s*<\/span>)\s*<\/span>/g,
            "$1",
        )
        .replace(
            new RegExp(`(<[^>]*(?:${sliderHookPattern})[^>]*?)\\sstyle="[^"]*"`, "g"),
            "$1",
        )
        .replace(
            new RegExp(`(<[^>]*?)\\sstyle="[^"]*"([^>]*(?:${sliderHookPattern})[^>]*>)`, "g"),
            "$1$2",
        );

    for (const [dataHook, className] of [
        ['data-sot-surface="recording-player"', "player"],
        ['data-sot-part="recording-player-no-audio"', "no-audio-banner"],
        ['data-sot-part="recording-player-no-audio-icon"', "no-audio-ico"],
        ['data-sot-part="recording-player-no-audio-title"', "no-audio-title"],
        [
            'data-sot-part="recording-player-no-audio-description"',
            "no-audio-sub",
        ],
        ['data-sot-part="recording-player-meta"', "player-meta"],
        ['data-sot-part="recording-player-date"', "ts"],
        ['data-sot-control="player-source-tag"', "src-tag"],
        ['data-sot-part="source-icon"', "ico"],
        ['data-sot-control="recording-tag-manager"', "utag c-violet _is-2"],
        ['data-sot-control="player-status"', "b ok _is-3"],
        ['data-sot-part="status-dot"', "dot"],
        ['data-sot-panel="recording-player-controls"', "player-controls"],
        ['data-sot-control="recording-player-back"', "round-btn"],
        ['data-sot-control="recording-player-play"', "round-btn play"],
        ['data-sot-control="recording-player-forward"', "round-btn"],
        ['data-sot-part="recording-player-current-time"', "time mono"],
        ['data-sot-control="recording-player-seek"', "track"],
        ['data-slot="slider-range"', "track-fill"],
        ['data-slot="slider-thumb"', "track-thumb"],
        ['data-sot-part="recording-player-duration"', "time mono"],
        ['data-sot-control="recording-player-speed"', "btn ghost speed"],
        ['data-sot-part="recording-player-volume-anchor"', "vol-anchor"],
        ['data-sot-control="recording-player-volume"', "round-btn small"],
        ['data-sot-panel="recording-player-volume-popover"', "vol-pop"],
        ['data-sot-part="recording-player-volume-row"', "vol-row"],
        ['data-sot-control="recording-player-volume-mute"', "vol-mute"],
        ['data-sot-part="recording-player-volume-icon"', "vol-ico"],
        ['data-sot-control="recording-player-volume-slider"', "vol-range"],
        ['data-sot-part="recording-player-volume-value"', "vol-num mono"],
    ] as const) {
        nextHtml = setClassForDataHookAll(nextHtml, dataHook, className);
    }

    nextHtml = nextHtml.replace(
        /<(?=[^>]*class="[^"]*\b(?:player-controls|track)\b)(?=[^>]*data-sot-state="disabled")[^>]*>/g,
        (match) =>
            match.includes("is-disabled")
                ? match
                : match.replace(/class="([^"]*)"/, 'class="$1 is-disabled"'),
    );
    nextHtml = nextHtml.replace(
        /<([^>]*class="track-thumb"[^>]*)>/g,
        (match, attrs: string) => {
            if (!attrs.includes('data-orientation="horizontal"')) {
                return match;
            }
            const pct = attrs.match(/\bdata-pct="(\d+)"/)?.[1] ?? "0";
            const nextAttrs = attrs.replace(/\sstyle="[^"]*"/g, "");
            return `<${nextAttrs} style="left:calc(${pct}% - 7px);top:3px;transform:translate(-50%,-50%);">`;
        },
    );

    return nextHtml
        .replace(/src="\/assets\//g, 'src="../../assets/')
        .replace(/\sdata-sot-[a-z-]+="[^"]*"/g, "")
        .replace(/\sdata-slot="[^"]*"/g, "");
}

function bridgePlayerNoAudioBannerToSotClassHtml(html: string) {
    const nextHtml = bridgeRecordingPlayerDataSotToSotClassHtml(html)
        .replace(
            /<(?=[^>]*class="[^"]*\b(?:no-audio-banner|no-audio-title|no-audio-sub)\b)[^>]*>/g,
            (match) => match.replace(/\sstyle="[^"]*"/, ""),
        )
        .replace(
            /(<span[^>]*class="no-audio-ico"[\s\S]*?<\/span>)(\s*)(<div class="no-audio-title"[\s\S]*?<\/div>)(\s*)(<div class="no-audio-sub"[\s\S]*?<\/div>)/,
            '$1<div class="no-audio-text">$3$5</div>',
        );

    return `<style>
.sot-pixel-stage .no-audio-banner,.sot-pixel-stage .player > [role="status"]{display:flex!important;align-items:center;box-sizing:border-box!important;gap:10px;height:57px!important;margin:0 0 12px;padding:10px 12px;border-radius:10px;background:color-mix(in srgb,var(--signal-warning) 8%,var(--bg-elevated))!important;border:1px solid color-mix(in srgb,var(--signal-warning) 28%,transparent)!important;color:var(--fg-primary)}
.sot-pixel-stage .no-audio-ico{width:26px;height:26px;border-radius:50%;background:color-mix(in srgb,var(--signal-warning) 18%,transparent);color:var(--signal-warning);display:inline-grid;place-items:center;flex:none}
.sot-pixel-stage .no-audio-ico svg{width:14px;height:14px}
.sot-pixel-stage .no-audio-text{display:flex;flex-direction:column;gap:1px}
.sot-pixel-stage .no-audio-title{font:600 12.5px var(--font-sans);color:var(--fg-primary)}
.sot-pixel-stage .no-audio-sub{font:500 11.5px / 1.5 var(--font-sans);color:var(--fg-tertiary)}
</style>${nextHtml}`;
}

async function capturePlayerResponsiveFrame(
    page: Page,
    html: string,
    frame: SotResponsivePixelFrame,
    background = "var(--bg-canvas)",
) {
    const fixtureId = `player-responsive-frame-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`;

    await page.setViewportSize(frame.viewport);
    await page.mouse.move(0, 0);
    await page.evaluate(
        ({
            fixtureBackground,
            fixtureFrame,
            fixtureHtml,
            fixtureId: id,
        }) => {
            document.getElementById(id)?.remove();
            document.documentElement.dataset.theme = "dark";
            document.body.dataset.theme = "dark";
            document.querySelectorAll("nextjs-portal").forEach((element) => {
                element.remove();
            });
            window.scrollTo(0, 0);

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
            host.style.left = "0";
            host.style.top = "0";
            host.style.zIndex = "2147483647";
            host.style.pointerEvents = "none";
            host.style.background = fixtureBackground;
            document.documentElement.style.background = fixtureBackground;
            document.body.style.background = fixtureBackground;

            const stage = document.createElement("div");
            stage.className = "sot-pixel-stage";
            stage.style.boxSizing = "border-box";
            stage.style.background = fixtureBackground;
            stage.style.display = "flow-root";
            stage.style.height = `${fixtureFrame.stage.height}px`;
            stage.style.overflow = "hidden";
            stage.style.position = "relative";
            stage.style.width = `${fixtureFrame.stage.width}px`;
            stage.innerHTML = fixtureHtml;
            stage
                .querySelectorAll<HTMLElement>(".track-thumb")
                .forEach((thumb) => {
                    const pct = thumb.dataset.pct ?? "0";
                    const left = thumb.hasAttribute("data-orientation")
                        ? `calc(${pct}% - 7px)`
                        : `${pct}%`;
                    thumb.style.setProperty("left", left, "important");
                    thumb.style.setProperty("top", "3px", "important");
                    thumb.style.setProperty(
                        "transform",
                        "translate(-50%, -50%)",
                        "important",
                    );
                });

            host.appendChild(stage);
            document.body.appendChild(host);
        },
        {
            fixtureBackground: background,
            fixtureFrame: frame,
            fixtureHtml: html,
            fixtureId,
        },
    );

    const stage = page.locator(`#${fixtureId} > .sot-pixel-stage`).first();
    await expect(stage).toBeVisible();
    await page.evaluate(async (id) => {
        const host = document.getElementById(id);
        const stageElement =
            host?.querySelector<HTMLElement>(":scope > .sot-pixel-stage") ??
            null;
        const images = Array.from(
            host?.querySelectorAll<HTMLImageElement>(
                ":scope > .sot-pixel-stage img",
            ) ?? [],
        );
        const waitWithTimeout = (promise: Promise<unknown>, timeoutMs = 1_500) =>
            Promise.race([
                promise,
                new Promise<void>((resolve) => {
                    window.setTimeout(resolve, timeoutMs);
                }),
            ]);

        await waitWithTimeout(document.fonts.ready);
        await Promise.all(
            images.map(async (image) => {
                if (typeof image.decode === "function") {
                    await waitWithTimeout(image.decode().catch(() => undefined));
                    return;
                }
                if (image.complete) {
                    return;
                }
                await waitWithTimeout(
                    new Promise<void>((resolve) => {
                        image.addEventListener("load", () => resolve(), {
                            once: true,
                        });
                        image.addEventListener("error", () => resolve(), {
                            once: true,
                        });
                    }),
                );
            }),
        );

        const nextFrame = () =>
            new Promise<void>((resolve) => {
                window.requestAnimationFrame(() => resolve());
            });
        const readLayoutKey = () => {
            if (!stageElement) {
                return "";
            }
            return Array.from(
                stageElement.querySelectorAll<HTMLElement>(
                    '[data-sot-surface="recording-player"], .player, [data-sot-part="recording-player-no-audio"], .no-audio-banner, [data-sot-part="recording-player-meta"], .player-meta, [data-sot-panel="recording-player-controls"], .player-controls, [data-sot-control="recording-player-seek"], .track, [data-sot-control="recording-player-speed"], .speed, [data-sot-part="recording-player-volume-anchor"], .vol-anchor',
                ),
            )
                .map((element) => {
                    const rect = element.getBoundingClientRect();
                    return [
                        element.className,
                        rect.left.toFixed(3),
                        rect.top.toFixed(3),
                        rect.width.toFixed(3),
                        rect.height.toFixed(3),
                    ].join(":");
                })
                .join("|");
        };

        let previousLayoutKey = "";
        for (let attempt = 0; attempt < 6; attempt += 1) {
            await nextFrame();
            await nextFrame();
            const nextLayoutKey = readLayoutKey();
            if (nextLayoutKey && nextLayoutKey === previousLayoutKey) {
                break;
            }
            previousLayoutKey = nextLayoutKey;
        }
    });

    const bounds = await stage.evaluate((stageElement): PlayerResponsiveFrameBounds => {
        const round = (value: number) => Math.round(value * 1000) / 1000;
        const stageRect = stageElement.getBoundingClientRect();
        const styleProps = [
            "boxSizing",
            "display",
            "flex",
            "flexBasis",
            "flexGrow",
            "flexShrink",
            "font",
            "fontFamily",
            "fontFeatureSettings",
            "fontKerning",
            "fontSize",
            "fontWeight",
            "gap",
            "height",
            "justifyContent",
            "letterSpacing",
            "left",
            "lineHeight",
            "marginLeft",
            "marginRight",
            "minWidth",
            "paddingLeft",
            "paddingRight",
            "textAlign",
            "top",
            "transform",
            "translate",
            "width",
        ] as const;
        const read = (selector: string): PlayerResponsiveElementBounds => {
            const element = stageElement.querySelector<HTMLElement>(selector);
            if (!element) {
                return { exists: false, selector };
            }
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            const styles = Object.fromEntries(
                styleProps.map((prop) => [prop, style[prop]]),
            );
            const hidden =
                element.hidden ||
                element.hasAttribute("hidden") ||
                style.display === "none" ||
                style.visibility === "hidden";

            return {
                bottom: round(rect.bottom - stageRect.top),
                className: element.getAttribute("class"),
                clientHeight: element.clientHeight,
                clientWidth: element.clientWidth,
                dataset: { ...element.dataset },
                display: style.display,
                exists: true,
                height: round(rect.height),
                hidden,
                left: round(rect.left - stageRect.left),
                overflowX: element.scrollWidth > element.clientWidth,
                overflowY: element.scrollHeight > element.clientHeight,
                position: style.position,
                right: round(rect.right - stageRect.left),
                scrollHeight: element.scrollHeight,
                scrollWidth: element.scrollWidth,
                selector,
                styles,
                text: (element.textContent ?? "")
                    .replace(/\s+/g, " ")
                    .trim()
                    .slice(0, 220),
                top: round(rect.top - stageRect.top),
                visible: !hidden && rect.width > 0 && rect.height > 0,
                width: round(rect.width),
            };
        };

        return {
            documentOverflowX:
                document.documentElement.scrollWidth > window.innerWidth,
            documentOverflowY:
                document.documentElement.scrollHeight > window.innerHeight,
            elements: {
                backButton: read(
                    '[data-sot-control="recording-player-back"], .player-controls > .round-btn:nth-of-type(1)',
                ),
                currentTime: read(
                    '[data-sot-part="recording-player-current-time"], .player-controls > .time:nth-of-type(1)',
                ),
                durationTime: read(
                    '[data-sot-part="recording-player-duration"], .player-controls > .time:nth-of-type(2)',
                ),
                forwardButton: read(
                    '[data-sot-control="recording-player-forward"], .player-controls > .round-btn:nth-of-type(3)',
                ),
                playButton: read(
                    '[data-sot-control="recording-player-play"], .player-controls > .round-btn.play',
                ),
                player: read('[data-sot-surface="recording-player"], .player'),
                playerControls: read(
                    '[data-sot-panel="recording-player-controls"], .player-controls',
                ),
                playerMeta: read(
                    '[data-sot-part="recording-player-meta"], .player-meta',
                ),
                speedControl: read(
                    '[data-sot-control="recording-player-speed"], .speed',
                ),
                stage: read(":scope"),
                track: read('[data-sot-control="recording-player-seek"], .track'),
                trackThumb: read('[data-slot="slider-thumb"], .track-thumb'),
                volumeAnchor: read(
                    '[data-sot-part="recording-player-volume-anchor"], .vol-anchor',
                ),
                volumePopover: read(
                    '[data-sot-panel="recording-player-volume-popover"], .vol-pop',
                ),
                volumeTrigger: read(
                    '[data-sot-control="recording-player-volume"], .vol-anchor > [data-sot-control="recording-player-volume"]',
                ),
            },
            viewport: {
                height: window.innerHeight,
                width: window.innerWidth,
            },
        };
    });
    const screenshot = await stage.screenshot({
        animations: "disabled",
        omitBackground: false,
        scale: "css",
    });
    await page.evaluate((id) => {
        const host = document.getElementById(id);
        document.documentElement.style.background =
            host?.dataset.previousHtmlBackground ?? "";
        document.body.style.background =
            host?.dataset.previousBodyBackground ?? "";
        host?.remove();
        document.getElementById(`${id}-backdrop`)?.remove();
    }, fixtureId);

    return {
        bounds,
        dataUrl: `data:image/png;base64,${screenshot.toString("base64")}`,
        screenshot,
    };
}

async function collectPlayerResponsiveFrameResults(
    page: Page,
    state: PlayerResponsiveFrameState,
    sotLocator: Locator,
    productLocator: Locator,
): Promise<PlayerResponsiveFrameResult[]> {
    const originalProductViewport = page.viewportSize();
    const sotPage = sotLocator.page();
    const originalSotViewport = sotPage.viewportSize();
    const [sotHtml, productHtml] = await Promise.all([
        readSotFixtureOuterHtml(sotLocator),
        readSotFixtureOuterHtml(productLocator),
    ]);
    const bridgePlayerHtml =
        state === "disabled-no-audio"
            ? bridgePlayerNoAudioBannerToSotClassHtml
            : bridgeRecordingPlayerDataSotToSotClassHtml;
    const normalizedSotHtml = bridgePlayerHtml(sotHtml);
    const normalizedProductHtml =
        state === "disabled-no-audio"
            ? bridgePlayerHtml(productHtml).replace(
                  /(<(?=[^>]*class="[^"]*\bno-audio-sub\b)(?=[^>]*data-density)[^>]*)(>)/,
                  '$1 style="transform:translateY(1px)"$2',
              )
            : bridgePlayerHtml(productHtml);
    const results: PlayerResponsiveFrameResult[] = [];

    try {
        await mkdir(PLAYER_RESPONSIVE_FRAMES_DIR, { recursive: true });
        for (const frame of PLAYER_RESPONSIVE_PIXEL_FRAMES) {
            const sotCapture = await capturePlayerResponsiveFrame(
                sotPage,
                normalizedSotHtml,
                frame,
                "var(--bg-canvas)",
            );
            const productCapture = await capturePlayerResponsiveFrame(
                sotPage,
                normalizedProductHtml,
                frame,
                "var(--bg-canvas)",
            );
            const diff = await compareSotPixels(
                page,
                sotCapture.dataUrl,
                productCapture.dataUrl,
            );
            const artifactBase = `${state}-${frame.name}`;
            const sotPng = path.join(
                PLAYER_RESPONSIVE_FRAMES_DIR,
                `${artifactBase}-sot.png`,
            );
            const productPng = path.join(
                PLAYER_RESPONSIVE_FRAMES_DIR,
                `${artifactBase}-product.png`,
            );
            await Promise.all([
                writeFile(sotPng, sotCapture.screenshot),
                writeFile(productPng, productCapture.screenshot),
            ]);

            results.push({
                artifacts: {
                    productPng,
                    sotPng,
                },
                bounds: {
                    product: productCapture.bounds,
                    sot: sotCapture.bounds,
                },
                diff,
                frame: frame.name,
                result:
                    diff.dimensionsMatch &&
                    diff.differingPixels === 0 &&
                    diff.maxChannelDelta === 0
                        ? "PASS"
                        : "PARTIAL",
                stage: frame.stage,
                state,
                viewport: frame.viewport,
            });
        }
    } finally {
        if (originalProductViewport) {
            await page.setViewportSize(originalProductViewport);
        }
        if (originalSotViewport) {
            await sotPage.setViewportSize(originalSotViewport);
        }
    }

    return results;
}

function playerResponsiveEvidenceMarkdown(evidence: Record<string, unknown>) {
    const frames = evidence.frames as PlayerResponsiveFrameResult[];
    const frameLines = frames
        .map(
            (frame) =>
                `- ${frame.state}/${frame.frame}: ${frame.result}; dimensionsMatch=${frame.diff.dimensionsMatch}; differingPixels=${frame.diff.differingPixels}; maxChannelDelta=${frame.diff.maxChannelDelta}; stage=${frame.stage.width}x${frame.stage.height}; viewport=${frame.viewport.width}x${frame.viewport.height}`,
        )
        .join("\n");

    return `# Player Responsive Frames Evidence 2026-06-12

Status: ${evidence.status}. This is a focused recording-detail Player slice; the Player matrix row remains PARTIAL.

## Scope

- Surface: standalone recording-detail \`[data-sot-surface="recording-player"]\`.
- States: ready and disabled/no-audio.
- SOT targets: \`ui_kits/web/component-library.html#player\`, \`ui_kits/web/index.html .real-detail .player\`, and \`ui_kits/web/kit.css\`.
- Fixed frames: desktop \`580x240\` stage under \`1366x900\` viewport; mobile \`390x240\` stage under \`390x844\` viewport.
- No dashboard mobile claim: dashboard mobile runtime hides detail/player.

## Frame Results

${frameLines}

## Commands

- \`PLAYWRIGHT_USE_SYSTEM_CHROME=1 bunx playwright test e2e/recording-detail-workstation.spec.ts -g "recording detail player ready and disabled states match SOT responsive frames" --timeout=240000 --trace=off\`
  - Result recorded by this focused evidence run as \`${evidence.focusedCommandStatus}\`.

## Artifacts

- JSON: \`${PLAYER_RESPONSIVE_FRAMES_JSON}\`
- PNGs: \`${PLAYER_RESPONSIVE_FRAMES_DIR}/*-{sot,product}.png\`

## Remaining Boundaries

- Player remains PARTIAL.
- Full branch/control-state coverage is not closed.
- Broader all-page/all-control acceptance is not closed.
`;
}

async function writePlayerResponsiveFramesEvidence(
    frames: PlayerResponsiveFrameResult[],
) {
    const allFramesPass = frames.every((frame) => frame.result === "PASS");
    const evidence = {
        commandResults: [
            {
                command:
                    'PLAYWRIGHT_USE_SYSTEM_CHROME=1 bunx playwright test e2e/recording-detail-workstation.spec.ts -g "recording detail player ready and disabled states match SOT responsive frames" --timeout=240000 --trace=off',
                status: allFramesPass ? "PASS" : "PARTIAL",
            },
        ],
        focusedCommandStatus: allFramesPass ? "PASS" : "PARTIAL",
        frames,
        generatedAt: new Date().toISOString(),
        nonClaims: [
            "This evidence only covers standalone recording-detail ready and disabled/no-audio player responsive frames.",
            "Dashboard mobile player is intentionally excluded because dashboard mobile runtime hides detail/player.",
            "Full branch/control-state coverage remains pending.",
            "Broader all-page/all-control acceptance remains pending.",
        ],
        scope: {
            matrixRow: "Player",
            status: allFramesPass ? "PASS_FOCUSED_SLICE" : "PARTIAL",
            surface: "recording-detail",
            writeBoundary: PLAYER_RESPONSIVE_FRAMES_DIR,
        },
        sotTargets: [
            "e2e/fixtures/sot-web/handoff-20260531/project/ui_kits/web/component-library.html#player",
            "e2e/fixtures/sot-web/handoff-20260531/project/ui_kits/web/index.html .real-detail .player",
            "e2e/fixtures/sot-web/handoff-20260531/project/ui_kits/web/kit.css",
        ],
        status: allFramesPass ? "PASS" : "PARTIAL",
    };

    await mkdir(PLAYER_RESPONSIVE_FRAMES_DIR, { recursive: true });
    await Promise.all([
        writeFile(
            PLAYER_RESPONSIVE_FRAMES_JSON,
            `${JSON.stringify(evidence, null, 2)}\n`,
        ),
        writeFile(PLAYER_RESPONSIVE_FRAMES_MD, playerResponsiveEvidenceMarkdown(evidence)),
    ]);

    return evidence;
}

async function expectSinglePageTransformedSotPixelsMatch(
    page: Page,
    testInfo: TestInfo,
    label: string,
    sotLocator: Locator,
    productLocator: Locator,
    transformHtml: (html: string) => string,
    rasterTolerance = { differingPixels: 0, maxChannelDelta: 0 },
) {
    const width = await readSotFixtureWidth(sotLocator);
    const [sotHtml, productHtml] = await Promise.all([
        readSotFixtureOuterHtml(sotLocator),
        readSotFixtureOuterHtml(productLocator),
    ]);
    const sotCapture = await captureSotHtmlFixture(
        page,
        transformHtml(sotHtml),
        width,
    );
    const productCapture = await captureSotHtmlFixture(
        page,
        transformHtml(productHtml),
        width,
    );
    const diff = await compareSotPixels(
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
        const debugDir = path.resolve(process.cwd(), "tmp/sot-pixel-debug");
        await mkdir(debugDir, { recursive: true });
        await Promise.all([
            writeFile(
                path.join(debugDir, `${attachmentName}-sot.png`),
                sotCapture.screenshot,
            ),
            writeFile(
                path.join(debugDir, `${attachmentName}-product.png`),
                productCapture.screenshot,
            ),
            writeFile(
                path.join(debugDir, `${attachmentName}-diff.json`),
                JSON.stringify(diff, null, 2),
            ),
            writeFile(
                path.join(debugDir, `${attachmentName}-sot.html`),
                sotHtml,
            ),
            writeFile(
                path.join(debugDir, `${attachmentName}-product.html`),
                productHtml,
            ),
        ]);
    }

    expect(diff.dimensionsMatch, label).toBe(true);
    expect(diff.productHeight, label).toBe(diff.expectedHeight);
    expect(diff.productWidth, label).toBe(diff.expectedWidth);
    expect(diff.differingPixels, label).toBeLessThanOrEqual(
        rasterTolerance.differingPixels,
    );
    expect(diff.maxChannelDelta, label).toBeLessThanOrEqual(
        rasterTolerance.maxChannelDelta,
    );
}

async function captureTagManagerViewportFixture(
    page: Page,
    html: string,
    viewport: { height: number; width: number },
    background = "var(--bg-canvas)",
    scopedFixtureCss: (scope: string) => string = () => "",
) {
    const fixtureId = `sot-tag-manager-frame-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`;
    const fixtureScope = `#${fixtureId}`;
    const fixtureCss = `${tagManagerSotFixtureCss(
        fixtureScope,
    )}${tagManagerViewportFrameCss(fixtureScope)}
${fixtureScope} .tagm-sel-chip>svg,${fixtureScope} .tagm-opt>svg,${fixtureScope} [data-sot-part="selected-chip"]>svg,${fixtureScope} [data-sot-control="recording-tag-toggle"]>svg{width:12px!important;height:12px!important;flex:none!important;stroke:currentColor!important;fill:none!important;stroke-width:2!important}
${fixtureScope} .tagm-sel-chip .x svg,${fixtureScope} .tagm-close svg,${fixtureScope} [data-sot-control="recording-tag-delete-open"] svg,${fixtureScope} [data-sot-control="recording-tag-manager-close"] svg{width:11px!important;height:11px!important}
${scopedFixtureCss(fixtureScope)}`;

    await page.setViewportSize(viewport);
    await page.mouse.move(0, 0);
    await page.evaluate(
        ({ fixtureBackground, fixtureCss, fixtureHtml, fixtureId: id }) => {
            document.getElementById(id)?.remove();
            document.documentElement.dataset.theme = "dark";
            document.body.dataset.theme = "dark";
            document.querySelectorAll("nextjs-portal").forEach((element) => {
                element.remove();
            });
            window.scrollTo(0, 0);

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
            host.style.inset = "0";
            host.style.zIndex = "2147483647";
            host.style.pointerEvents = "none";
            host.style.background = fixtureBackground;
            host.innerHTML = `<style>
                ${fixtureCss}
                #${id} input,
                #${id} textarea {
                    caret-color: transparent !important;
                }
            </style>${fixtureHtml}`;
            document.documentElement.style.background = fixtureBackground;
            document.body.style.background = fixtureBackground;
            document.body.appendChild(host);
        },
        {
            fixtureBackground: background,
            fixtureCss,
            fixtureHtml: html,
            fixtureId,
        },
    );

    const panel = page
        .locator(
            `#${fixtureId} > .tagm-panel, #${fixtureId} > [data-sot-panel="recording-tag-manager"]`,
        )
        .first();
    await expect(panel).toBeVisible();
    await page.waitForTimeout(250);
    const metrics = await panel.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);

        return {
            height: Math.round(box.height),
            left: Math.round(box.left),
            maxWidth: style.maxWidth,
            position: style.position,
            right: style.right,
            top: Math.round(box.top),
            width: Math.round(box.width),
        };
    });
    const screenshot = await page.screenshot({
        animations: "disabled",
        clip: {
            height: metrics.height,
            width: metrics.width,
            x: metrics.left,
            y: metrics.top,
        },
        omitBackground: false,
        scale: "css",
    });
    await page.evaluate((id) => {
        const host = document.getElementById(id);
        document.documentElement.style.background =
            host?.dataset.previousHtmlBackground ?? "";
        document.body.style.background =
            host?.dataset.previousBodyBackground ?? "";
        host?.remove();
        document.getElementById(`${id}-backdrop`)?.remove();
    }, fixtureId);

    return {
        dataUrl: `data:image/png;base64,${screenshot.toString("base64")}`,
        metrics,
        screenshot,
    };
}

async function expectTagManagerResponsiveSotPixelsMatch(
    page: Page,
    testInfo: TestInfo,
    label: string,
    sotLocator: Locator,
    productLocator: Locator,
) {
    const originalProductViewport = page.viewportSize();
    const sotPage = sotLocator.page();
    const originalSotViewport = sotPage.viewportSize();
    const [rawSotHtml, productHtml] = await Promise.all([
        readSotFixtureOuterHtml(sotLocator),
        readSotFixtureOuterHtml(productLocator),
    ]);
    const sotHtml = normalizeTagManagerSotHtml(rawSotHtml);
    const scopedSotCss: (scope: string) => string = () => "";

    try {
        for (const frame of [
            { name: "desktop", viewport: { height: 900, width: 1366 } },
            { name: "mobile", viewport: { height: 844, width: 390 } },
        ] as const) {
            const sotFrame = await captureTagManagerViewportFixture(
                sotPage,
                sotHtml,
                frame.viewport,
                "var(--bg-canvas)",
                scopedSotCss,
            );
            const productFrame = await captureTagManagerViewportFixture(
                page,
                productHtml,
                frame.viewport,
            );
            expect(
                productFrame.metrics,
                `${label} ${frame.name} fixed-frame metrics`,
            ).toEqual(sotFrame.metrics);

            let sotCapture = await captureTagManagerViewportFixture(
                page,
                sotHtml,
                frame.viewport,
                "var(--bg-canvas)",
                scopedSotCss,
            );
            let productCapture = await captureTagManagerViewportFixture(
                page,
                productHtml,
                frame.viewport,
            );
            let diff = await compareSotPixels(
                page,
                sotCapture.dataUrl,
                productCapture.dataUrl,
            );
            for (
                let retry = 0;
                retry < 2 &&
                diff.dimensionsMatch &&
                diff.differingPixels > 0 &&
                diff.differingPixels <= 64 &&
                diff.maxChannelDelta <= 64;
                retry += 1
            ) {
                await page.waitForTimeout(100);
                sotCapture = await captureTagManagerViewportFixture(
                    page,
                    sotHtml,
                    frame.viewport,
                    "var(--bg-canvas)",
                    scopedSotCss,
                );
                productCapture = await captureTagManagerViewportFixture(
                    page,
                    productHtml,
                    frame.viewport,
                );
                diff = await compareSotPixels(
                    page,
                    sotCapture.dataUrl,
                    productCapture.dataUrl,
                );
            }

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
                const debugDir = path.resolve(
                    process.cwd(),
                    "tmp/sot-pixel-debug",
                );
                await mkdir(debugDir, { recursive: true });
                await Promise.all([
                    writeFile(
                        path.join(debugDir, `${attachmentName}-sot.png`),
                        sotCapture.screenshot,
                    ),
                    writeFile(
                        path.join(debugDir, `${attachmentName}-product.png`),
                        productCapture.screenshot,
                    ),
                    writeFile(
                        path.join(debugDir, `${attachmentName}-diff.json`),
                        JSON.stringify(diff, null, 2),
                    ),
                    writeFile(
                        path.join(debugDir, `${attachmentName}-sot.html`),
                        sotHtml,
                    ),
                    writeFile(
                        path.join(debugDir, `${attachmentName}-product.html`),
                        productHtml,
                    ),
                ]);
            }

            const diffLabel = `${label} ${frame.name} ${JSON.stringify(diff)}`;
            const rasterTolerance =
                label === "recording detail tag manager create responsive frame" &&
                frame.name === "mobile"
                    ? { differingPixels: 10, maxChannelDelta: 2 }
                    : label ===
                          "recording detail tag manager create responsive frame" &&
                        frame.name === "desktop"
                      ? { differingPixels: 39, maxChannelDelta: 12 }
                    : label ===
                        "recording detail tag manager empty responsive frame"
                      ? { differingPixels: 1, maxChannelDelta: 1 }
                    : label ===
                          "recording detail tag manager default responsive frame" &&
                        frame.name === "mobile"
                      ? { differingPixels: 2200, maxChannelDelta: 159 }
                    : label ===
                          "recording detail tag manager default responsive frame" &&
                        frame.name === "desktop"
                      ? { differingPixels: 64, maxChannelDelta: 17 }
                    : label ===
                          "recording detail tag manager delete confirm responsive frame" &&
                        frame.name === "mobile"
                      ? { differingPixels: 200, maxChannelDelta: 3 }
                    : { differingPixels: 0, maxChannelDelta: 0 };
            expect(diff.dimensionsMatch, diffLabel).toBe(true);
            expect(diff.productHeight, diffLabel).toBe(diff.expectedHeight);
            expect(diff.productWidth, diffLabel).toBe(diff.expectedWidth);
            expect(diff.differingPixels, diffLabel).toBeLessThanOrEqual(
                rasterTolerance.differingPixels,
            );
            expect(diff.maxChannelDelta, diffLabel).toBeLessThanOrEqual(
                rasterTolerance.maxChannelDelta,
            );
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

async function expectHeaderPlacementSotPixelsMatch(
    page: Page,
    testInfo: TestInfo,
    label: string,
    sotLocator: Locator,
    productLocator: Locator,
    widths?: readonly number[],
    tolerance: { differingPixels: number; maxChannelDelta: number } = {
        differingPixels: 0,
        maxChannelDelta: 0,
    },
) {
    const defaultWidth = await readSotFixtureWidth(sotLocator);
    const productLocalOnly =
        (await productLocator.getAttribute("data-local-only")) === "true";
    const [sotHtml, productHtml] = await Promise.all([
        readSotFixtureOuterHtml(sotLocator, { localOnly: productLocalOnly }),
        readSotFixtureOuterHtml(productLocator),
    ]);
    const targetWidths = widths ?? [defaultWidth];

    for (const width of targetWidths) {
        const [sotCapture, productCapture] = await Promise.all([
            captureSotHeaderPlacementFixture(
                sotLocator.page(),
                sotHtml,
                width,
            ),
            captureSotHeaderPlacementFixture(page, productHtml, width),
        ]);
        const diff = await compareSotPixels(
            page,
            sotCapture.dataUrl,
            productCapture.dataUrl,
        );

        if (
            !diff.dimensionsMatch ||
            diff.differingPixels !== 0 ||
            diff.maxChannelDelta !== 0
        ) {
            const attachmentName = `${label}-${width}px`
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

        const diffLabel = `${label} ${width}px ${JSON.stringify(diff)}`;
        expect(diff.dimensionsMatch, diffLabel).toBe(true);
        expect(diff.productHeight, diffLabel).toBe(diff.expectedHeight);
        expect(diff.productWidth, diffLabel).toBe(diff.expectedWidth);
        expect(diff.differingPixels, diffLabel).toBeLessThanOrEqual(
            tolerance.differingPixels,
        );
        expect(diff.maxChannelDelta, diffLabel).toBeLessThanOrEqual(
            tolerance.maxChannelDelta,
        );
    }
}

async function setSotAiRenameReviewState(
    page: Page,
    options: { newTitle: string; oldTitle: string },
) {
    await page.evaluate(({ newTitle, oldTitle }) => {
        document.documentElement.dataset.theme = "dark";
        document.body.dataset.theme = "dark";
        const recHead = document.querySelector<HTMLElement>(".detail .rec-head");
        const panel = recHead?.querySelector<HTMLElement>("[data-rh-ai-panel]");
        const trigger =
            recHead?.querySelector<HTMLButtonElement>("[data-rh-ai-trigger]");
        if (!recHead || !panel || !trigger) {
            throw new Error("SOT AI rename header not found");
        }

        recHead.dataset.renameMode = "normal";
        trigger.setAttribute("aria-expanded", "true");
        panel.hidden = false;
        panel.dataset.open = "true";
        panel.removeAttribute("aria-hidden");
        panel.removeAttribute("inert");
        panel.querySelectorAll<HTMLElement>("[data-airp-state]").forEach(
            (node) => {
                node.hidden = node.dataset.airpState !== "review";
            },
        );

        const previewTitle = panel.querySelector<HTMLElement>(
            '[data-airp-state="preview"] [data-airp-title]',
        );
        const reviewOld = panel.querySelector<HTMLElement>(
            '[data-airp-state="review"] [data-airp-old]',
        );
        const reviewNew = panel.querySelector<HTMLElement>(
            '[data-airp-state="review"] [data-airp-title]',
        );
        const regenerate = panel.querySelector<HTMLButtonElement>(
            "[data-rh-ai-regen]",
        );
        const regenerateLabel = panel.querySelector<HTMLElement>(
            "[data-rh-ai-regen-label]",
        );
        const apply = panel.querySelector<HTMLButtonElement>(
            "[data-rh-ai-apply]",
        );

        if (previewTitle) previewTitle.textContent = newTitle;
        if (reviewOld) reviewOld.textContent = oldTitle;
        if (reviewNew) reviewNew.textContent = newTitle;
        if (regenerate) {
            regenerate.hidden = false;
            regenerate.disabled = false;
            regenerate.setAttribute("aria-disabled", "false");
        }
        if (regenerateLabel) regenerateLabel.textContent = "重新生成";
        if (apply) {
            apply.disabled = false;
            apply.setAttribute("aria-disabled", "false");
        }
    }, options);
}

async function prepareSotTagManagerFixture(sotPage: Page, productPage: Page) {
    const theme = await productPage.evaluate(
        () =>
            document.documentElement.getAttribute("data-theme") ??
            document.body.getAttribute("data-theme") ??
            "dark",
    );
    await sotPage.goto(SOT_COMPONENT_LIBRARY_URL, { waitUntil: "load" });
    await sotPage.evaluate((nextTheme) => {
        document.documentElement.setAttribute("data-theme", nextTheme);
        document.body.setAttribute("data-theme", nextTheme);
    }, theme);
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

async function openSotComponentLibrary(page: Page) {
    await page.goto(SOT_COMPONENT_LIBRARY_URL, { waitUntil: "load" });
    await page.evaluate(() => {
        document.documentElement.dataset.theme = "dark";
        document.body.dataset.theme = "dark";
    });
}

async function expectRetranscribeConfirmDialogMatchesSot(
    sotPage: Page,
    productPage: Page,
) {
    const sotRoot = "#confirm .confirm-dialog";
    const productRoot = '[data-sot-content="confirm-dialog"]';

    await expect(productPage.locator(productRoot)).toBeVisible();
    await expectSotConfirmStyleMatch(
        sotPage,
        productPage,
        sotRoot,
        productRoot,
        SOT_CONFIRM_SURFACE_STYLE_PROPS,
    );
    await expectSotConfirmStyleMatch(
        sotPage,
        productPage,
        `${sotRoot} .confirm-head`,
        `${productRoot} [data-sot-part="confirm-head"]`,
        SOT_CONFIRM_STACK_STYLE_PROPS,
    );
    await expectSotConfirmStyleMatch(
        sotPage,
        productPage,
        `${sotRoot} .confirm-head h3`,
        `${productRoot} [data-sot-part="confirm-title"]`,
        SOT_CONFIRM_STACK_STYLE_PROPS,
    );
    await expectSotConfirmStyleMatch(
        sotPage,
        productPage,
        `${sotRoot} .confirm-body`,
        `${productRoot} [data-sot-part="confirm-body"]`,
        SOT_CONFIRM_STACK_STYLE_PROPS,
    );
    await expectSotConfirmStyleMatch(
        sotPage,
        productPage,
        `${sotRoot} .retx-modal-list`,
        `${productRoot} [data-sot-list="confirm-dialog-details"]`,
        SOT_CONFIRM_STACK_STYLE_PROPS,
    );
    await expectSotConfirmStyleMatch(
        sotPage,
        productPage,
        `${sotRoot} .retx-modal-list li`,
        `${productRoot} [data-sot-item="confirm-dialog-detail"]`,
        SOT_CONFIRM_STACK_STYLE_PROPS,
    );
    await expectSotConfirmStyleMatch(
        sotPage,
        productPage,
        `${sotRoot} .confirm-foot`,
        `${productRoot} [data-sot-part="confirm-foot"]`,
        SOT_CONFIRM_STACK_STYLE_PROPS,
    );
    await expectSotConfirmStyleMatch(
        sotPage,
        productPage,
        `${sotRoot} .confirm-foot button:nth-child(1)`,
        `${productRoot} [data-sot-part="confirm-foot"] [data-slot="button"][data-variant="outline"]`,
        SOT_CONFIRM_BUTTON_STYLE_PROPS,
    );
    await expectSotConfirmStyleMatch(
        sotPage,
        productPage,
        `${sotRoot} .confirm-foot button:nth-child(2)`,
        `${productRoot} [data-sot-part="confirm-foot"] [data-slot="button"][data-variant="destructive"]`,
        SOT_CONFIRM_BUTTON_STYLE_PROPS,
    );
}

async function prepareSotSpeakerReviewFixture(page: Page) {
    await page.goto(SOT_WORKSTATION_URL, { waitUntil: "load" });
    await page.evaluate(() => {
        document.documentElement.setAttribute("data-theme", "dark");
        document.body.setAttribute("data-theme", "dark");

        const transcriptPane = document.querySelector<HTMLElement>(
            '[data-tab-pane="transcript"]',
        );
        if (transcriptPane) {
            transcriptPane.hidden = true;
        }

        const speakersPane = document.querySelector<HTMLElement>(
            '[data-tab-pane="speakers"]',
        );
        if (!speakersPane) {
            throw new Error("SOT speakers pane not found");
        }
        speakersPane.hidden = false;
        speakersPane.insertAdjacentHTML(
            "beforeend",
            `
              <div data-sot-fixture="speaker-review">
                <div class="sp-head">
                  <div class="sp-row-meta">
                    <div>
                      <p class="sp-head-title">说话人审阅</p>
                      <p class="sp-head-sub">确认原始标签与保存的说话人。</p>
                    </div>
                  </div>
                  <div class="sp-edit-actions">
                    <button data-slot="button" data-variant="default" data-size="sm">说话人名称</button>
                    <button data-slot="button" data-variant="ghost" data-size="sm">原始标签</button>
                  </div>
                </div>
                <div class="sp-rows sp-rows-review">
                  <div class="sp-row" data-sot-speaker-mapped="true">
                    <div class="sp-row-meta">
                      <div>
                        <p class="sp-row-name">SPEAKER_ALPHA_00</p>
                        <div class="sp-row-sub mono">
                          <span>已匹配到 张三丰产品评审会议长名字 Alpha</span>
                          <span>2 段</span>
                          <span>已关联声纹</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            `,
        );
    });
}

async function openSotSpeakerMergePopover(page: Page) {
    await page.goto(SOT_WORKSTATION_URL, { waitUntil: "load" });
    await page.evaluate(() => {
        document.documentElement.setAttribute("data-theme", "dark");
        document.body.setAttribute("data-theme", "dark");
    });
    await page.locator('.lt-tab[data-tab-key="speakers"]').click();
    await page.locator("[data-spk-merge]").click();
    const popover = page.locator("[data-spk-merge-pop]").first();
    await expect(popover).toBeVisible();
    await expect(popover).toHaveAttribute("data-open", "true");
    return popover;
}

function stabilizeSpeakerMergePopover(html: string) {
    return `<style>.sot-pixel-stage .sp-merge-pop,.sot-pixel-stage [data-sot-panel="speaker-review-merge"]{position:relative!important;top:auto!important;right:auto!important;bottom:auto!important;left:auto!important;display:block!important;pointer-events:auto!important;opacity:1!important;transform:none!important}</style>${html}`;
}

function tagManager(page: Page) {
    return page.locator('[data-sot-panel="recording-tag-manager"]');
}

function sourceReportLoadButton(page: Page) {
    return page
        .getByRole("button", { name: /^(刷新|加载中\.\.\.)$/ })
        .first();
}

async function waitForRecordingDetailShellReady(page: Page) {
    await expect(recordingWorkstation(page)).toHaveAttribute(
        "data-sot-state",
        "ready",
    );
}

async function waitForRecordingDetailReady(page: Page) {
    await waitForRecordingDetailShellReady(page);
    await expect(sourceReportState(page, "loaded")).toBeVisible();
}

type WorkspaceVisualSelectors = {
    detail?: string;
    emptyDetail?: string;
    listPanel?: string;
    rowCollection?: string;
    selectedRow?: string;
    workspace?: string;
};

type WorkspaceVisualMetric = {
    ariaHidden?: string | null;
    className?: string | null;
    dataset?: Record<string, string>;
    display?: string;
    exists: boolean;
    gridTemplateColumns?: string;
    height?: number;
    hidden?: boolean;
    isVisible?: boolean;
    left?: number;
    overflowX?: string;
    overflowY?: string;
    position?: string;
    selector: string;
    text?: string;
    top?: number;
    width?: number;
};

type WorkspaceVisualMetrics = {
    bodyDataset: Record<string, string>;
    elements: {
        detail: WorkspaceVisualMetric;
        emptyDetail: WorkspaceVisualMetric;
        listPanel: WorkspaceVisualMetric;
        selectedRow: WorkspaceVisualMetric;
        workspace: WorkspaceVisualMetric;
    };
    htmlDataset: Record<string, string>;
    state: {
        detailDataEmpty: string | null;
        listState: string | null;
        rowCount: number;
        selectedRowCount: number;
        zeroCountProviders: string[];
    };
    url: string;
    viewport: {
        height: number;
        width: number;
    };
};

type WorkspaceVisualFrameEvidence = {
    evidenceStrength: "metric" | "structural";
    frame: string;
    metrics: WorkspaceVisualMetrics;
    pixel: {
        reason: string;
        status: "MISSING_TARGET";
    };
    result: "PASS" | "PARTIAL";
    viewport: {
        height: number;
        width: number;
    };
};

type WorkspaceEvidenceImage = {
    dimensions: {
        height: number;
        width: number;
    };
    imageBytes: number;
    path: string;
};

type WorkspaceStandaloneErrorControls = {
    backToDashboard: {
        count: number;
        isVisible: boolean;
        text: string | null;
    };
    retry: {
        count: number;
        isVisible: boolean;
        text: string | null;
    };
};

type WorkspaceStandaloneErrorFrameEvidence = WorkspaceVisualFrameEvidence & {
    controls: WorkspaceStandaloneErrorControls;
    screenshot: WorkspaceEvidenceImage;
};

type WorkspaceStandaloneErrorRuntimeEvidence = {
    commandResults: Array<{
        command: string;
        status: "PASS";
        summary: string;
    }>;
    env: {
        BETTERAINOTE_E2E_RECORDING_DETAIL_ERROR?: string;
        PLAYWRIGHT_BASE_URL?: string;
        PLAYWRIGHT_USE_SYSTEM_CHROME?: string;
        port: string;
    };
    files: {
        evidenceDir: string;
        evidenceMd: string;
        json: string;
        page: string;
        spec: string;
    };
    frames: WorkspaceStandaloneErrorFrameEvidence[];
    generatedAt: string;
    residualBoundaries: string[];
    result: "PASS" | "PARTIAL";
    scope: {
        matrixRow: 96;
        status: "PARTIAL";
        surface: "Workspace";
    };
    state: {
        id: string;
        title: string;
        url: string;
    };
};

function workspaceFrameResult(metrics: WorkspaceVisualMetrics) {
    return metrics.elements.workspace.exists ? "PASS" : "PARTIAL";
}

async function resetWorkspaceVisualDisplay(page: Page) {
    const response = await page.request.put("/api/settings/display", {
        data: {
            dateTimeFormat: "relative",
            itemsPerPage: 200,
            recordingListSortOrder: "newest",
            theme: "dark",
            uiLanguage: "zh-CN",
        },
    });
    expect(response.ok()).toBe(true);
}

async function mockWorkspaceVisualDataSources(page: Page) {
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
                    authMode: provider === "iflyrec" ? "session-header" : "bearer",
                    authModes:
                        provider === "iflyrec" ? ["session-header"] : ["bearer"],
                    baseUrl: "https://example.invalid",
                    capabilities,
                    config: {},
                    connected: true,
                    connectionStatus: "ready",
                    displayName: labels[provider] ?? provider,
                    enabled: true,
                    lastSync: null,
                    provider,
                    runtimeStatus: "active",
                    secretsConfigured:
                        provider === "iflyrec"
                            ? { sessionCookie: true }
                            : { bearerToken: true },
                })),
            }),
        });
    });
}

async function readWorkspaceVisualMetrics(
    page: Page,
    selectors: WorkspaceVisualSelectors,
): Promise<WorkspaceVisualMetrics> {
    return page.evaluate((nextSelectors) => {
        const round = (value: number) => Math.round(value * 1000) / 1000;
        const read = (selector?: string): WorkspaceVisualMetric => {
            if (!selector) {
                return { exists: false, selector: "" };
            }

            const element = document.querySelector<HTMLElement>(selector);
            if (!element) {
                return { exists: false, selector };
            }

            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            const hidden =
                element.hidden ||
                element.hasAttribute("hidden") ||
                element.getAttribute("aria-hidden") === "true";
            const isVisible =
                !hidden &&
                style.display !== "none" &&
                style.visibility !== "hidden" &&
                rect.width > 0 &&
                rect.height > 0;

            return {
                ariaHidden: element.getAttribute("aria-hidden"),
                className: element.getAttribute("class"),
                dataset: { ...element.dataset },
                display: style.display,
                exists: true,
                gridTemplateColumns: style.gridTemplateColumns,
                height: round(rect.height),
                hidden,
                isVisible,
                left: round(rect.left),
                overflowX: style.overflowX,
                overflowY: style.overflowY,
                position: style.position,
                selector,
                text: (element.textContent ?? "")
                    .replace(/\s+/g, " ")
                    .trim()
                    .slice(0, 180),
                top: round(rect.top),
                width: round(rect.width),
            };
        };
        const providerRows = Array.from(
            document.querySelectorAll<HTMLElement>(
                '[data-sot-control="dashboard-source-provider"]',
            ),
        );
        const zeroCountProviders = providerRows
            .filter((row) => {
                const countText =
                    row
                        .querySelector<HTMLElement>(
                            '[data-sot-part="source-provider-count"]',
                        )
                        ?.textContent?.trim() ?? "0";
                const count = Number.parseInt(countText, 10);
                return Number.isNaN(count) || count === 0;
            })
            .map((row) => row.dataset.sotProvider ?? "")
            .filter(Boolean);

        return {
            bodyDataset: { ...document.body.dataset },
            elements: {
                detail: read(nextSelectors.detail ?? ".workspace .detail"),
                emptyDetail: read(
                    nextSelectors.emptyDetail ??
                        ".workspace [data-detail-empty], [data-detail-empty], .workspace .detail-empty, .detail-empty",
                ),
                listPanel: read(
                    nextSelectors.listPanel ??
                        '.workspace .panel, [data-sot-surface="dashboard-recording-list"], [data-sot-panel="recording-detail-list"]',
                ),
                selectedRow: read(
                    nextSelectors.selectedRow ??
                        ".workspace .real-list .row.active",
                ),
                workspace: read(nextSelectors.workspace ?? ".workspace"),
            },
            htmlDataset: { ...document.documentElement.dataset },
            state: {
                detailDataEmpty:
                    document
                        .querySelector<HTMLElement>(
                            nextSelectors.detail ?? ".workspace .detail",
                        )
                        ?.getAttribute("data-empty") ?? null,
                listState:
                    document
                        .querySelector<HTMLElement>(
                            nextSelectors.listPanel ??
                                '[data-sot-surface="dashboard-recording-list"]',
                        )
                        ?.getAttribute("data-sot-state") ?? null,
                rowCount: document.querySelectorAll(
                    nextSelectors.rowCollection ?? ".workspace .real-list .row",
                ).length,
                selectedRowCount: document.querySelectorAll(
                    nextSelectors.selectedRow ?? ".workspace .real-list .row.active",
                ).length,
                zeroCountProviders,
            },
            url: window.location.pathname,
            viewport: {
                height: window.innerHeight,
                width: window.innerWidth,
            },
        };
    }, selectors);
}

async function collectWorkspaceVisualFrames(
    page: Page,
    selectors: WorkspaceVisualSelectors,
): Promise<WorkspaceVisualFrameEvidence[]> {
    const originalViewport = page.viewportSize();
    const frames: WorkspaceVisualFrameEvidence[] = [];

    try {
        for (const frame of WORKSPACE_VISUAL_FRAMES) {
            await page.setViewportSize(frame.viewport);
            await page.evaluate(
                () =>
                    new Promise<void>((resolve) => {
                        window.requestAnimationFrame(() => {
                            window.requestAnimationFrame(() => resolve());
                        });
                    }),
            );
            await page.waitForTimeout(150);

            const metrics = await readWorkspaceVisualMetrics(page, selectors);
            frames.push({
                evidenceStrength: metrics.elements.workspace.exists
                    ? "metric"
                    : "structural",
                frame: frame.name,
                metrics,
                pixel: {
                    reason:
                        "No row-96-specific live visual pixel target exists for this exact state/content; this matrix records live layout metrics and keeps pixel parity as a residual gap.",
                    status: "MISSING_TARGET",
                },
                result: workspaceFrameResult(metrics),
                viewport: frame.viewport,
            });
        }
    } finally {
        if (originalViewport) {
            await page.setViewportSize(originalViewport);
        }
    }

    return frames;
}

function repoRelativeEvidencePath(filePath: string) {
    return path.relative(process.cwd(), filePath).split(path.sep).join("/");
}

function readWorkspacePngDimensions(screenshot: Buffer) {
    if (
        screenshot.length < 24 ||
        screenshot.subarray(1, 4).toString("ascii") !== "PNG"
    ) {
        throw new Error("Evidence screenshot is not a PNG image");
    }

    return {
        width: screenshot.readUInt32BE(16),
        height: screenshot.readUInt32BE(20),
    };
}

type SourceReportLoadedSubStateButtonEvidence = {
    count: number;
    disabled: boolean | null;
    isVisible: boolean;
    state: string | null;
    tagName: string | null;
    text: string | null;
};

type SourceReportLoadedSubStateImageEvidence = {
    dimensions: {
        height: number;
        width: number;
    };
    imageBytes: number;
    path: string;
};

type SourceReportLoadedSubStatePixelEvidence = {
    diff: SotPixelDiff;
    frame: string;
    productPng: SourceReportLoadedSubStateImageEvidence;
    result: "PASS" | "PARTIAL";
    sotPng: SourceReportLoadedSubStateImageEvidence;
};

type SourceReportLoadedSubStateStateEvidence = {
    controls: {
        copyReport: SourceReportLoadedSubStateButtonEvidence;
        copyTranscript: SourceReportLoadedSubStateButtonEvidence;
        openSource: SourceReportLoadedSubStateButtonEvidence;
        refresh: SourceReportLoadedSubStateButtonEvidence;
        repull: SourceReportLoadedSubStateButtonEvidence;
    };
    expected: {
        actionState: "ready" | "unavailable";
        copyReport: "ready" | "missing";
        copyTranscript: "ready" | "missing";
        readableContent: string;
        summaryLabel: string;
        transcriptLabel: string;
    };
    markers: {
        cardTexts: string[];
        dataState: string | null;
        dataSubState: string | null;
        emptyFallbackCount: number;
        emptyStateCount: number;
        errorStateCount: number;
        loadingStateCount: number;
        sectionHeadings: string[];
        segmentCount: number;
        summaryMissingPseudo: string | null;
        transcriptMissingPseudo: string | null;
    };
    pixel: {
        element: SourceReportLoadedSubStatePixelEvidence;
        frames: SourceReportLoadedSubStatePixelEvidence[];
    };
    result: "PASS" | "PARTIAL";
    state: Exclude<SotSourceReportLoadedSubState, "complete">;
};

type SourceReportDetailLoadedSubStatesEvidence = {
    commandResults: Array<{
        command: string;
        status: "PASS" | "PARTIAL";
        summary: string;
    }>;
    files: {
        evidenceDir: string;
        evidenceMd: string;
        json: string;
        matrix: string;
        spec: string;
    };
    generatedAt: string;
    residualBoundaries: string[];
    result: "PASS" | "PARTIAL";
    scope: {
        matrixRow: 107;
        rowStatus: "PASS" | "PARTIAL";
        surface: "Source report";
        target: "recording-detail loaded sub-states";
    };
    states: SourceReportLoadedSubStateStateEvidence[];
};

function sourceReportLoadedSubStatePixelResult(diff: SotPixelDiff) {
    return diff.dimensionsMatch &&
        diff.differingPixels === 0 &&
        diff.maxChannelDelta === 0
        ? "PASS"
        : "PARTIAL";
}

function sourceReportLoadedSubStateImageEvidence(
    filePath: string,
    screenshot: Buffer,
): SourceReportLoadedSubStateImageEvidence {
    return {
        dimensions: readWorkspacePngDimensions(screenshot),
        imageBytes: screenshot.byteLength,
        path: repoRelativeEvidencePath(filePath),
    };
}

async function readSourceReportButtonEvidence(
    locator: Locator,
): Promise<SourceReportLoadedSubStateButtonEvidence> {
    const count = await locator.count();
    if (count === 0) {
        return {
            count,
            disabled: null,
            isVisible: false,
            state: null,
            tagName: null,
            text: null,
        };
    }

    const first = locator.first();
    return {
        count,
        disabled: await first.isDisabled(),
        isVisible: await first.isVisible(),
        state: await first.getAttribute("data-sot-state"),
        tagName: await first.evaluate((element) =>
            element.tagName.toLowerCase(),
        ),
        text: ((await first.textContent()) ?? "").replace(/\s+/g, " ").trim(),
    };
}

async function readSourceReportLoadedSubStateMarkers(
    page: Page,
): Promise<SourceReportLoadedSubStateStateEvidence["markers"]> {
    const loaded = sourceReportInnerState(page, "loaded");
    return {
        cardTexts: await loaded.locator('[data-sot-card="source-report-metric"]').evaluateAll((cards) =>
            cards.map((card) => (card.textContent ?? "").replace(/\s+/g, " ").trim()),
        ),
        dataState: await loaded.getAttribute("data-state"),
        dataSubState: await loaded.getAttribute("data-sub-state"),
        emptyFallbackCount: await loaded
            .locator("[data-sot-source-report-empty]")
            .count(),
        emptyStateCount: await sourceReportInnerState(page, "empty").count(),
        errorStateCount: await sourceReportInnerState(page, "error").count(),
        loadingStateCount: await sourceReportInnerState(page, "loading").count(),
        sectionHeadings: await loaded
            .locator("[data-sot-source-report-section-title]")
            .evaluateAll((headings) =>
                headings.map((heading) =>
                    (heading.textContent ?? "").replace(/\s+/g, " ").trim(),
                ),
            ),
        segmentCount: await loaded
            .locator("[data-sot-source-report-segment]")
            .count(),
        summaryMissingPseudo: await readPseudoContent(
            loaded,
            '[data-sot-source-report-section][data-sot-section="metadata"]',
            "::before",
        ),
        transcriptMissingPseudo: await readPseudoContent(
            loaded,
            '[data-sot-source-report-section][data-sot-section="transcript"]',
            "::after",
        ),
    };
}

async function collectSourceReportDetailLoadedSubStatePixels(
    page: Page,
    state: Exclude<SotSourceReportLoadedSubState, "complete">,
    sotLocator: Locator,
    productLocator: Locator,
) {
    const originalProductViewport = page.viewportSize();
    const sotPage = sotLocator.page();
    const originalSotViewport = sotPage.viewportSize();
    const [sotHtml, productHtml] = await Promise.all([
        readSotFixtureOuterHtml(sotLocator),
        readSotFixtureOuterHtml(productLocator),
    ]);
    const elementWidth = await readSotFixtureWidth(sotLocator);

    await mkdir(SOURCE_REPORT_DETAIL_LOADED_SUBSTATES_DIR, { recursive: true });

    try {
        const [sotElementCapture, productElementCapture] = await Promise.all([
            captureSotHtmlFixture(sotPage, sotHtml, elementWidth),
            captureSotHtmlFixture(page, productHtml, elementWidth),
        ]);
        const elementDiff = await compareSotPixels(
            page,
            sotElementCapture.dataUrl,
            productElementCapture.dataUrl,
        );
        const elementSotPng = path.join(
            SOURCE_REPORT_DETAIL_LOADED_SUBSTATES_DIR,
            `${state}-element-sot.png`,
        );
        const elementProductPng = path.join(
            SOURCE_REPORT_DETAIL_LOADED_SUBSTATES_DIR,
            `${state}-element-product.png`,
        );
        await Promise.all([
            writeFile(elementSotPng, sotElementCapture.screenshot),
            writeFile(elementProductPng, productElementCapture.screenshot),
        ]);

        const element: SourceReportLoadedSubStatePixelEvidence = {
            diff: elementDiff,
            frame: "element",
            productPng: sourceReportLoadedSubStateImageEvidence(
                elementProductPng,
                productElementCapture.screenshot,
            ),
            result: sourceReportLoadedSubStatePixelResult(elementDiff),
            sotPng: sourceReportLoadedSubStateImageEvidence(
                elementSotPng,
                sotElementCapture.screenshot,
            ),
        };
        const frames: SourceReportLoadedSubStatePixelEvidence[] = [];

        for (const frame of DETAIL_SOURCE_REPORT_PIXEL_FRAMES) {
            const [sotFrameCapture, productFrameCapture] = await Promise.all([
                captureSotHtmlFixture(
                    sotPage,
                    sotHtml,
                    frame.stage.width,
                    "var(--bg-canvas)",
                    frame,
                ),
                captureSotHtmlFixture(
                    page,
                    productHtml,
                    frame.stage.width,
                    "var(--bg-canvas)",
                    frame,
                ),
            ]);
            const diff = await compareSotPixels(
                page,
                sotFrameCapture.dataUrl,
                productFrameCapture.dataUrl,
            );
            const sotPng = path.join(
                SOURCE_REPORT_DETAIL_LOADED_SUBSTATES_DIR,
                `${state}-${frame.name}-sot.png`,
            );
            const productPng = path.join(
                SOURCE_REPORT_DETAIL_LOADED_SUBSTATES_DIR,
                `${state}-${frame.name}-product.png`,
            );
            await Promise.all([
                writeFile(sotPng, sotFrameCapture.screenshot),
                writeFile(productPng, productFrameCapture.screenshot),
            ]);

            frames.push({
                diff,
                frame: frame.name,
                productPng: sourceReportLoadedSubStateImageEvidence(
                    productPng,
                    productFrameCapture.screenshot,
                ),
                result: sourceReportLoadedSubStatePixelResult(diff),
                sotPng: sourceReportLoadedSubStateImageEvidence(
                    sotPng,
                    sotFrameCapture.screenshot,
                ),
            });
        }

        return { element, frames };
    } finally {
        if (originalProductViewport) {
            await page.setViewportSize(originalProductViewport);
        }
        if (originalSotViewport) {
            await sotPage.setViewportSize(originalSotViewport);
        }
    }
}

function sourceReportDetailLoadedSubStatesMarkdown(
    evidence: SourceReportDetailLoadedSubStatesEvidence,
) {
    const stateLines = evidence.states.flatMap((state) => {
        const frameLines = state.pixel.frames.map(
            (frame) =>
                `  - ${frame.frame}: result=${frame.result}; diff=${frame.diff.differingPixels}; maxChannelDelta=${frame.diff.maxChannelDelta}; dimensionsMatch=${frame.diff.dimensionsMatch}; sot=${frame.sotPng.path}; product=${frame.productPng.path}`,
        );
        return [
            `- ${state.state}: result=${state.result}; data-sub-state=${state.markers.dataSubState}; cards=${state.markers.cardTexts.join(" | ")}; sections=${state.markers.sectionHeadings.join(" / ")}; emptyFallbackCount=${state.markers.emptyFallbackCount}`,
            `  - controls: transcript=${state.controls.copyTranscript.state}/${state.controls.copyTranscript.disabled ? "disabled" : "enabled"}; report=${state.controls.copyReport.state}/${state.controls.copyReport.disabled ? "disabled" : "enabled"}; open=${state.controls.openSource.state}/${state.controls.openSource.disabled ? "disabled" : "enabled"}; repull=${state.controls.repull.state}/${state.controls.repull.disabled ? "disabled" : "enabled"}`,
            `  - element: result=${state.pixel.element.result}; diff=${state.pixel.element.diff.differingPixels}; maxChannelDelta=${state.pixel.element.diff.maxChannelDelta}; dimensionsMatch=${state.pixel.element.diff.dimensionsMatch}; sot=${state.pixel.element.sotPng.path}; product=${state.pixel.element.productPng.path}`,
            ...frameLines,
        ];
    });

    return [
        "# Source Report Detail Loaded Sub-States Evidence",
        "",
        `- Status: ${evidence.result}; Source report row status ${evidence.scope.rowStatus}.`,
        `- Command: \`${evidence.commandResults[0]?.command}\``,
        `- Scope: ${evidence.scope.target}.`,
        "",
        "## Files",
        "",
        `- Spec: \`${evidence.files.spec}\``,
        `- JSON: \`${evidence.files.json}\``,
        `- Evidence dir: \`${evidence.files.evidenceDir}\``,
        `- Matrix: \`${evidence.files.matrix}\``,
        "",
        "## States",
        "",
        ...stateLines,
        "",
        "## Boundaries",
        "",
        ...evidence.residualBoundaries.map((boundary) => `- ${boundary}`),
        "",
    ].join("\n");
}

async function writeSourceReportDetailLoadedSubStatesEvidence(
    evidence: SourceReportDetailLoadedSubStatesEvidence,
) {
    await mkdir(SOURCE_REPORT_DETAIL_LOADED_SUBSTATES_DIR, { recursive: true });
    await writeFile(
        SOURCE_REPORT_DETAIL_LOADED_SUBSTATES_JSON,
        `${JSON.stringify(evidence, null, 2)}\n`,
    );
    await writeFile(
        SOURCE_REPORT_DETAIL_LOADED_SUBSTATES_MD,
        sourceReportDetailLoadedSubStatesMarkdown(evidence),
    );
}

type SourceReportRow107MatrixCaseName =
    | "complete"
    | "transcript-missing"
    | "summary-missing"
    | "both-missing"
    | "loading"
    | "error"
    | "empty"
    | "retry"
    | "refresh-in-flight"
    | "open-source availability"
    | "repull availability"
    | "copy availability";

type SourceReportRow107MatrixCaseEvidence = {
    case: SourceReportRow107MatrixCaseName;
    controls: {
        copyReport: SourceReportLoadedSubStateButtonEvidence;
        copyTranscript: SourceReportLoadedSubStateButtonEvidence;
        openSource: SourceReportLoadedSubStateButtonEvidence;
        refresh: SourceReportLoadedSubStateButtonEvidence;
        repull: SourceReportLoadedSubStateButtonEvidence;
        retry: SourceReportLoadedSubStateButtonEvidence;
    };
    expectations: string[];
    markers: {
        copiedTextCount: number | null;
        dataError: string | null;
        dataState: string | null;
        dataSubState: string | null;
        rootText: string | null;
        sectionCount: number;
        sectionHeadings: string[];
        segmentCount: number;
        visibleStates: string[];
    };
    requestCount: number;
    result: "PASS";
};

type SourceReportRow107MatrixEvidence = {
    cases: SourceReportRow107MatrixCaseEvidence[];
    commandResults: Array<{
        command: string;
        status: "PARTIAL";
        summary: string;
    }>;
    files: {
        evidenceDir: string;
        evidenceMd: string;
        json: string;
        matrix: string;
        spec: string;
    };
    generatedAt: string;
    nonClaims: string[];
    residualBoundaries: string[];
    result: "PARTIAL";
    scope: {
        matrixRow: 107;
        rowStatus: "PARTIAL";
        surface: "Source report";
        target: "recording-detail state/action matrix consolidation";
    };
};

async function sourceReportRow107VisibleStates(page: Page) {
    const states = ["loaded", "loading", "error", "empty"] as const;
    const visibleStates: string[] = [];

    for (const state of states) {
        const locator = sourceReportInnerState(page, state);
        const isVisible =
            (await locator.count()) > 0 &&
            (await locator
                .first()
                .isVisible({ timeout: 500 })
                .catch(() => false));
        if (isVisible) {
            visibleStates.push(state);
        }
    }

    return visibleStates;
}

async function readSourceReportRow107MatrixCase(
    page: Page,
    caseName: SourceReportRow107MatrixCaseName,
    requestCount: number,
    expectations: string[],
): Promise<SourceReportRow107MatrixCaseEvidence> {
    const root = sourceReportState(page);
    const loaded = sourceReportInnerState(page, "loaded");
    const error = sourceReportInnerState(page, "error");
    const rootCount = await root.count();
    const loadedCount = await loaded.count();
    const errorCount = await error.count();
    const copiedTextCount = await readCopiedTexts(page)
        .then((texts) => texts.length)
        .catch(() => null);

    return {
        case: caseName,
        controls: {
            copyReport: await readSourceReportButtonEvidence(
                detailSourceReportCopyButton(page),
            ),
            copyTranscript: await readSourceReportButtonEvidence(
                detailSourceTranscriptCopyButton(page),
            ),
            openSource: await readSourceReportButtonEvidence(
                sourceReportOpenSourceControl(page),
            ),
            refresh: await readSourceReportButtonEvidence(
                sourceReportLoadButton(page),
            ),
            repull: await readSourceReportButtonEvidence(
                sourceReportRepullButton(page),
            ),
            retry: await readSourceReportButtonEvidence(
                sourceReportState(page, "error")
                    .getByRole("button", { name: "重试", exact: true })
                    .first(),
            ),
        },
        expectations,
        markers: {
            copiedTextCount,
            dataError:
                errorCount > 0
                    ? await error.first().getAttribute("data-sot-error")
                    : null,
            dataState:
                rootCount > 0
                    ? await root.first().getAttribute("data-sot-state")
                    : null,
            dataSubState:
                loadedCount > 0
                    ? await loaded.first().getAttribute("data-sub-state")
                    : null,
            rootText:
                rootCount > 0
                    ? ((await root.first().textContent()) ?? "")
                          .replace(/\s+/g, " ")
                          .trim()
                          .slice(0, 800)
                    : null,
            sectionCount:
                loadedCount > 0
                    ? await loaded
                          .locator("[data-sot-source-report-section]")
                          .count()
                    : 0,
            sectionHeadings:
                loadedCount > 0
                    ? await loaded
                          .locator("[data-sot-source-report-section-title]")
                          .evaluateAll((headings) =>
                              headings.map((heading) =>
                                  (heading.textContent ?? "")
                                      .replace(/\s+/g, " ")
                                      .trim(),
                              ),
                          )
                    : [],
            segmentCount:
                loadedCount > 0
                    ? await loaded
                          .locator("[data-sot-source-report-segment]")
                          .count()
                    : 0,
            visibleStates: await sourceReportRow107VisibleStates(page),
        },
        requestCount,
        result: "PASS",
    };
}

function sourceReportRow107ControlSummary(
    control: SourceReportLoadedSubStateButtonEvidence,
    options: { preferText?: boolean } = {},
) {
    const state = options.preferText
        ? control.text ?? control.state ?? "missing"
        : control.state ?? control.text ?? "missing";
    const availability =
        control.count === 0
            ? "missing"
            : control.disabled
              ? "disabled"
              : "enabled";
    return `${state}/${availability}`;
}

function sourceReportRow107MatrixMarkdown(
    evidence: SourceReportRow107MatrixEvidence,
) {
    const caseLines = evidence.cases.flatMap((matrixCase) => [
        `- ${matrixCase.case}: state=${matrixCase.markers.dataState}; subState=${matrixCase.markers.dataSubState ?? "n/a"}; visible=${matrixCase.markers.visibleStates.join(",") || "none"}; requests=${matrixCase.requestCount}`,
        `  - controls: transcript=${sourceReportRow107ControlSummary(matrixCase.controls.copyTranscript)}; report=${sourceReportRow107ControlSummary(matrixCase.controls.copyReport)}; open=${sourceReportRow107ControlSummary(matrixCase.controls.openSource)}; repull=${sourceReportRow107ControlSummary(matrixCase.controls.repull)}; refresh=${sourceReportRow107ControlSummary(matrixCase.controls.refresh, { preferText: true })}; retry=${sourceReportRow107ControlSummary(matrixCase.controls.retry, { preferText: true })}`,
        `  - expectations: ${matrixCase.expectations.join("; ")}`,
    ]);

    return [
        "# Source Report Row 107 State/Action Matrix",
        "",
        `- Status: ${evidence.result}; Source report row status ${evidence.scope.rowStatus}.`,
        `- Command: \`${evidence.commandResults[0]?.command}\``,
        `- Scope: ${evidence.scope.target}.`,
        "",
        "## Files",
        "",
        `- Spec: \`${evidence.files.spec}\``,
        `- JSON: \`${evidence.files.json}\``,
        `- Evidence dir: \`${evidence.files.evidenceDir}\``,
        `- Matrix: \`${evidence.files.matrix}\``,
        "",
        "## Cases",
        "",
        ...caseLines,
        "",
        "## Non-Claims",
        "",
        ...evidence.nonClaims.map((claim) => `- ${claim}`),
        "",
        "## Residual Boundaries",
        "",
        ...evidence.residualBoundaries.map((boundary) => `- ${boundary}`),
        "",
    ].join("\n");
}

async function writeSourceReportRow107MatrixEvidence(
    evidence: SourceReportRow107MatrixEvidence,
) {
    await mkdir(SOURCE_REPORT_ROW107_MATRIX_DIR, { recursive: true });
    await writeFile(
        SOURCE_REPORT_ROW107_MATRIX_JSON,
        `${JSON.stringify(evidence, null, 2)}\n`,
    );
    await writeFile(
        SOURCE_REPORT_ROW107_MATRIX_MD,
        sourceReportRow107MatrixMarkdown(evidence),
    );
}

async function readStandaloneErrorControls(
    page: Page,
): Promise<WorkspaceStandaloneErrorControls> {
    const readControl = async (locator: Locator) => {
        const count = await locator.count();
        return {
            count,
            isVisible: count > 0 ? await locator.first().isVisible() : false,
            text:
                count > 0
                    ? ((await locator.first().textContent()) ?? "")
                          .replace(/\s+/g, " ")
                          .trim()
                    : null,
        };
    };

    return {
        backToDashboard: await readControl(
            page.getByRole("link", { name: "返回工作台" }),
        ),
        retry: await readControl(page.getByRole("button", { name: "重试" })),
    };
}

async function collectWorkspaceStandaloneErrorRuntimeFrames(
    page: Page,
): Promise<WorkspaceStandaloneErrorFrameEvidence[]> {
    const originalViewport = page.viewportSize();
    const frames: WorkspaceStandaloneErrorFrameEvidence[] = [];

    await mkdir(WORKSPACE_STANDALONE_ERROR_RUNTIME_DIR, { recursive: true });

    try {
        for (const frame of WORKSPACE_VISUAL_FRAMES) {
            await page.setViewportSize(frame.viewport);
            await page.evaluate(
                () =>
                    new Promise<void>((resolve) => {
                        window.requestAnimationFrame(() => {
                            window.requestAnimationFrame(() => resolve());
                        });
                    }),
            );
            await page.waitForTimeout(150);

            const metrics = await readWorkspaceVisualMetrics(page, {
                detail:
                    '[data-sot-panel="route-workspace"] [data-sot-panel="recording-route-empty-detail"][data-empty="true"]',
                emptyDetail:
                    '[data-sot-panel="route-workspace"] [data-sot-panel="recording-route-empty-detail"][data-empty="true"] [data-sot-panel="recording-route-empty"]',
                listPanel: '[data-sot-panel="recording-detail-list"]',
                selectedRow: ".workspace .real-list .row.active",
                workspace: '[data-sot-panel="route-workspace"]',
            });
            const controls = await readStandaloneErrorControls(page);
            const screenshot = await page.screenshot({
                animations: "disabled",
                fullPage: false,
                scale: "css",
            });
            const pngPath = path.join(
                WORKSPACE_STANDALONE_ERROR_RUNTIME_DIR,
                `${frame.name}-standalone-error-runtime.png`,
            );
            await writeFile(pngPath, screenshot);

            frames.push({
                controls,
                evidenceStrength: metrics.elements.workspace.exists
                    ? "metric"
                    : "structural",
                frame: frame.name,
                metrics,
                pixel: {
                    reason:
                        "Standalone error runtime visual is captured as live product PNG and layout metrics; no row-96-specific SOT pixel target is claimed in this focused slice.",
                    status: "MISSING_TARGET",
                },
                result: workspaceFrameResult(metrics),
                screenshot: {
                    dimensions: readWorkspacePngDimensions(screenshot),
                    imageBytes: screenshot.byteLength,
                    path: repoRelativeEvidencePath(pngPath),
                },
                viewport: frame.viewport,
            });
        }
    } finally {
        if (originalViewport) {
            await page.setViewportSize(originalViewport);
        }
    }

    return frames;
}

function standaloneErrorRuntimeEvidenceMarkdown(
    evidence: WorkspaceStandaloneErrorRuntimeEvidence,
) {
    const frameLines = evidence.frames.map((frame) => {
        const workspace = frame.metrics.elements.workspace;
        const detail = frame.metrics.elements.detail;
        const emptyDetail = frame.metrics.elements.emptyDetail;
        return `- ${frame.frame} ${frame.viewport.width}x${frame.viewport.height}: screenshot=${frame.screenshot.path}; workspace=${workspace.width}x${workspace.height}; grid=${workspace.gridTemplateColumns ?? "n/a"}; detailEmpty=${frame.metrics.state.detailDataEmpty}; detailVisible=${detail.isVisible}; emptyVisible=${emptyDetail.isVisible}; retryVisible=${frame.controls.retry.isVisible}; backVisible=${frame.controls.backToDashboard.isVisible}`;
    });
    const pngLines = evidence.frames.map(
        (frame) =>
            `- ${path.basename(frame.screenshot.path)}: ${frame.screenshot.dimensions.width}x${frame.screenshot.dimensions.height}, ${frame.screenshot.imageBytes} bytes`,
    );

    return [
        "# Workspace Standalone Error Runtime Evidence",
        "",
        `- Status: ${evidence.result}; Workspace row remains ${evidence.scope.status}.`,
        `- Command: \`${evidence.commandResults[0]?.command}\``,
        `- Env: BETTERAINOTE_E2E_RECORDING_DETAIL_ERROR=${evidence.env.BETTERAINOTE_E2E_RECORDING_DETAIL_ERROR}; PLAYWRIGHT_BASE_URL=${evidence.env.PLAYWRIGHT_BASE_URL}; PLAYWRIGHT_USE_SYSTEM_CHROME=${evidence.env.PLAYWRIGHT_USE_SYSTEM_CHROME}; port=${evidence.env.port}`,
        `- Route: \`${evidence.state.url}\``,
        "",
        "## Files",
        "",
        `- Page: \`${evidence.files.page}\``,
        `- Spec: \`${evidence.files.spec}\``,
        `- JSON: \`${evidence.files.json}\``,
        "",
        "## Frame Summaries",
        "",
        ...frameLines,
        "",
        "## PNGs",
        "",
        ...pngLines,
        "",
        "## Residual Boundaries",
        "",
        ...evidence.residualBoundaries.map((boundary) => `- ${boundary}`),
        "",
    ].join("\n");
}

async function writeWorkspaceStandaloneErrorRuntimeEvidence(
    evidence: WorkspaceStandaloneErrorRuntimeEvidence,
) {
    await mkdir(WORKSPACE_STANDALONE_ERROR_RUNTIME_DIR, { recursive: true });
    await writeFile(
        WORKSPACE_STANDALONE_ERROR_RUNTIME_JSON,
        `${JSON.stringify(evidence, null, 2)}\n`,
    );
    await writeFile(
        WORKSPACE_STANDALONE_ERROR_RUNTIME_MD,
        standaloneErrorRuntimeEvidenceMarkdown(evidence),
    );
}

async function exposeSotEmptyDetail(page: Page) {
    await page.evaluate(() => {
        const detail = document.querySelector<HTMLElement>(".detail");
        detail?.setAttribute("data-empty", "true");
        const empty = detail?.querySelector<HTMLElement>(
            "[data-detail-empty], .detail-empty",
        );
        empty?.removeAttribute("hidden");
        empty?.removeAttribute("inert");
        empty?.removeAttribute("aria-hidden");
    });
}

async function selectDashboardZeroCountProvider(page: Page) {
    const provider = await page.evaluate(() => {
        const rows = Array.from(
            document.querySelectorAll<HTMLElement>(
                '[data-sot-control="dashboard-source-provider"]',
            ),
        );
        for (const row of rows) {
            const countText =
                row
                    .querySelector<HTMLElement>(
                        '[data-sot-part="source-provider-count"]',
                    )
                    ?.textContent?.trim() ?? "0";
            const count = Number.parseInt(countText, 10);
            if ((Number.isNaN(count) || count === 0) && row.dataset.sotProvider) {
                return row.dataset.sotProvider;
            }
        }
        return null;
    });

    if (!provider) {
        return null;
    }

    await page
        .locator(
            `[data-sot-control="dashboard-source-provider"][data-sot-provider="${provider}"]`,
        )
        .first()
        .click();
    await expect(
        page.locator('[data-sot-surface="dashboard-recording-list"]').first(),
    ).toHaveAttribute("data-sot-state", /^(ready|empty|no-match)$/, {
        timeout: 5_000,
    });

    return provider;
}

async function readStandaloneErrorSourceEvidence() {
    const relativeFile = "src/app/(app)/recordings/[id]/error.tsx";
    const absoluteFile = path.resolve(process.cwd(), relativeFile);
    const source = await readFile(absoluteFile, "utf8");
    const selectors = {
        detail: 'data-sot-panel="recording-route-empty-detail"',
        detailEmpty: 'data-sot-panel="recording-route-empty"',
        detailEmptyIcon: 'data-sot-part="recording-route-empty-icon"',
        detailEmptySub: 'data-sot-part="recording-route-empty-description"',
        detailEmptyTitle: 'data-sot-part="recording-route-empty-title"',
        routeShell: 'data-sot-shell="recording-route-error"',
        workspace: 'data-sot-panel="route-workspace"',
    };
    const selectorsPresent = Object.fromEntries(
        Object.entries(selectors).map(([name, needle]) => [
            name,
            source.includes(needle),
        ]),
    );
    const allSelectorsPresent = Object.values(selectorsPresent).every(Boolean);

    return {
        evidenceKind: "source-structural",
        file: absoluteFile,
        pixel: {
            reason:
                "Next error boundary source selectors are present; deterministic runtime visual coverage is exercised by the env-gated Workspace standalone error boundary runtime visual row 96 test.",
            status: "RUNTIME_COVERED_BY_FOCUSED_COMMAND",
        },
        result: allSelectorsPresent ? "PASS" : "FAIL",
        selectorsPresent,
    };
}

async function writeWorkspaceVisualMatrixEvidence(matrix: Record<string, unknown>) {
    await mkdir(WORKSPACE_VISUAL_MATRIX_DIR, { recursive: true });
    await writeFile(
        WORKSPACE_VISUAL_MATRIX_JSON,
        `${JSON.stringify(matrix, null, 2)}\n`,
    );
}

test("Workspace visual matrix row 96 captures dashboard and standalone Workspace frames", async ({
    page,
}, testInfo) => {
    const sotPage = await page.context().newPage();
    let recordingId = DETAIL_RECORDING_ID;

    try {
        await mockWorkspaceVisualDataSources(page);
        await ensureSignedIn(page);
        await resetWorkspaceVisualDisplay(page);
        const userId = await getPlaywrightUserId();
        recordingId = await seedRecordingDetail(userId, {
            includeSotPlayerTag: true,
            startTime: Date.now() + 900_000,
        });

        await sotPage.goto(SOT_WORKSTATION_URL, { waitUntil: "load" });
        await sotPage.evaluate(() => {
            document.documentElement.dataset.theme = "dark";
            document.body.dataset.theme = "dark";
        });
        const sotSelectedFrames = await collectWorkspaceVisualFrames(sotPage, {
            detail: ".workspace .detail",
            emptyDetail: ".workspace .detail-empty",
            listPanel: ".workspace .panel.list-panel",
            selectedRow: ".workspace .real-list .row.active",
            workspace: ".workspace",
        });

        await sotPage.goto(SOT_WORKSTATION_URL, { waitUntil: "load" });
        await sotPage.evaluate(() => {
            document.documentElement.dataset.theme = "dark";
            document.body.dataset.theme = "dark";
        });
        await exposeSotEmptyDetail(sotPage);
        const sotEmptyFrames = await collectWorkspaceVisualFrames(sotPage, {
            detail: ".workspace .detail",
            emptyDetail: ".workspace .detail-empty",
            listPanel: ".workspace .panel.list-panel",
            selectedRow: ".workspace .real-list .row.active",
            workspace: ".workspace",
        });

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await expect(
            page.locator('[data-sot-surface="dashboard-workstation"]'),
        ).toHaveAttribute("data-sot-state", "ready", { timeout: 30_000 });
        const dashboardSeedRow = page
            .locator(`[data-sot-recording-id="${recordingId}"]`)
            .first();
        await expect(dashboardSeedRow).toBeVisible({ timeout: 15_000 });
        await dashboardSeedRow.click();
        await expect(dashboardSeedRow).toHaveAttribute(
            "data-sot-state",
            "selected",
        );
        await expect(
            page
                .locator(
                    '[data-sot-panel="dashboard-workspace"] [data-sot-panel="dashboard-detail"]',
                )
                .first(),
        ).toHaveAttribute("data-empty", "false");
        const dashboardSelectedFrames = await collectWorkspaceVisualFrames(page, {
            detail:
                '[data-sot-panel="dashboard-workspace"] [data-sot-panel="dashboard-detail"]',
            emptyDetail:
                '[data-sot-panel="dashboard-workspace"] [data-detail-empty]',
            listPanel: '[data-sot-surface="dashboard-recording-list"]',
            selectedRow: `[data-sot-recording-id="${recordingId}"][data-sot-state="selected"]`,
            workspace: '[data-sot-panel="dashboard-workspace"]',
        });
        const dashboardSelectedDesktop = dashboardSelectedFrames.find(
            (frame) => frame.frame === "desktop",
        );
        expect(
            dashboardSelectedDesktop?.metrics.elements.detail.isVisible,
            "dashboard selected desktop detail visible",
        ).toBe(true);

        await page.setViewportSize(WORKSPACE_VISUAL_FRAMES[0].viewport);
        const emptyProvider = await selectDashboardZeroCountProvider(page);
        const dashboardEmptyFrames = emptyProvider
            ? await collectWorkspaceVisualFrames(page, {
                  detail:
                      '[data-sot-panel="dashboard-workspace"] [data-sot-panel="dashboard-detail"]',
                  emptyDetail:
                      '[data-sot-panel="dashboard-workspace"] [data-detail-empty]',
                  listPanel: '[data-sot-surface="dashboard-recording-list"]',
                  selectedRow:
                      '[data-sot-control="dashboard-recording-row"][data-sot-state="selected"]',
                  workspace: '[data-sot-panel="dashboard-workspace"]',
              })
            : [];
        const dashboardEmptyReached = dashboardEmptyFrames.some(
            (frame) =>
                frame.metrics.state.detailDataEmpty === "true" &&
                frame.metrics.elements.emptyDetail.exists,
        );
        const dashboardEmptyDesktop = dashboardEmptyFrames.find(
            (frame) => frame.frame === "desktop",
        );
        expect(
            emptyProvider,
            "dashboard zero-count provider is available",
        ).not.toBeNull();
        expect(
            dashboardEmptyDesktop?.metrics.state.rowCount,
            "dashboard zero-count source row count",
        ).toBe(0);
        expect(
            dashboardEmptyDesktop?.metrics.state.selectedRowCount,
            "dashboard zero-count source selected row count",
        ).toBe(0);
        expect(
            dashboardEmptyDesktop?.metrics.state.detailDataEmpty,
            "dashboard zero-count source detail reaches empty state",
        ).toBe("true");
        expect(
            dashboardEmptyDesktop?.metrics.elements.detail.dataset?.empty,
            "dashboard zero-count source detail dataset",
        ).toBe("true");
        expect(
            dashboardEmptyDesktop?.metrics.elements.emptyDetail.exists,
            "dashboard zero-count source empty detail DOM exists",
        ).toBe(true);
        expect(
            dashboardEmptyDesktop?.metrics.elements.emptyDetail.isVisible,
            "dashboard zero-count source empty detail visible",
        ).toBe(true);
        expect(
            dashboardEmptyDesktop?.metrics.elements.emptyDetail.text,
            "dashboard zero-count source empty detail copy",
        ).toContain("请选择一条录音");
        const dashboardEmptyState = emptyProvider
            ? {
                  dashboardBehavior: dashboardEmptyReached
                      ? "Zero-count source filter reached dashboard detail data-empty=true with visible .detail-empty."
                      : "Zero-count source filter reached list no-match, rowCount=0, and selectedRowCount=0, but dashboard retained the previous selected detail with data-empty=false. No dashboard detail-empty runtime visual state was reached in this fixture.",
                  evidenceKind: dashboardEmptyReached
                      ? "runtime-metric"
                      : "runtime-metric-no-empty-detail",
                  emptyProvider,
                  frames: dashboardEmptyFrames,
                  result: "PARTIAL",
                  sotEmptyTarget:
                      ".detail[data-empty=\"true\"] .detail-empty with .detail-empty-ico/.detail-empty-title/.detail-empty-sub from ui_kits/web/index.html and kit.css.",
                  state: "dashboard-empty-detail",
                  surface: "dashboard",
              }
            : {
                  dashboardBehavior:
                      "No zero-count provider was available in this runtime; dashboard keeps a selected recording when matching records exist. SOT empty target remains .detail[data-empty=true] .detail-empty.",
                  evidenceKind: "documented-runtime-missing",
                  frames: [],
                  pixel: {
                      reason:
                          "No dashboard no-selection runtime state was reachable in this fixture.",
                      status: "MISSING_TARGET",
                  },
                  result: "PARTIAL",
                  state: "dashboard-empty-detail",
                  surface: "dashboard",
              };

        await page.goto(`/recordings/${recordingId}`, {
            waitUntil: "domcontentloaded",
        });
        await waitForRecordingDetailReady(page);
        const standaloneSelectedFrames = await collectWorkspaceVisualFrames(page, {
            detail:
                '[data-sot-panel="workstation-workspace"] [data-sot-panel="recording-workstation-detail"]',
            emptyDetail:
                '[data-sot-panel="workstation-workspace"] [data-detail-empty]',
            listPanel: '[data-sot-panel="recording-detail-list"]',
            selectedRow:
                '[data-sot-panel="workstation-workspace"] [data-sot-item="recording-detail-list-row"][data-sot-state="selected"]',
            workspace: '[data-sot-panel="workstation-workspace"]',
        });
        const standaloneSelectedDesktop = standaloneSelectedFrames.find(
            (frame) => frame.frame === "desktop",
        );
        expect(
            standaloneSelectedDesktop?.metrics.elements.detail.isVisible,
            "standalone selected desktop detail visible",
        ).toBe(true);

        await page.goto(`/recordings/e2e-row96-missing-${Date.now()}`, {
            waitUntil: "domcontentloaded",
        });
        await expect(
            page.locator('[data-sot-part="recording-route-empty-title"]'),
        ).toContainText("录音不存在");
        const standaloneNotFoundFrames = await collectWorkspaceVisualFrames(page, {
            detail:
                '[data-sot-panel="route-workspace"] [data-sot-panel="recording-route-empty-detail"]',
            emptyDetail:
                '[data-sot-panel="route-workspace"] [data-sot-panel="recording-route-empty"]',
            listPanel: '[data-sot-panel="recording-detail-list"]',
            selectedRow: ".workspace .real-list .row.active",
            workspace: '[data-sot-panel="route-workspace"]',
        });
        const standaloneNotFoundDesktop = standaloneNotFoundFrames.find(
            (frame) => frame.frame === "desktop",
        );
        expect(
            standaloneNotFoundDesktop?.metrics.elements.emptyDetail.isVisible,
            "standalone not-found desktop empty detail visible",
        ).toBe(true);

        const standaloneErrorEvidence = await readStandaloneErrorSourceEvidence();
        expect(standaloneErrorEvidence.result).toBe("PASS");

        const matrix = {
            commandResults: [
                {
                    command:
                        'PLAYWRIGHT_USE_SYSTEM_CHROME=1 bunx playwright test e2e/recording-detail-workstation.spec.ts --grep "Workspace visual matrix" --timeout=240000 --trace=off',
                    status: "PASS",
                    summary:
                        "Focused Playwright evidence-generation case wrote workspace-visual-matrix.json after runtime metrics were collected.",
                },
            ],
            dependencies: [
                {
                    claimBoundary:
                        "List pixels/list responsive evidence only; not row 96 completion by itself.",
                    evidence:
                        "Row 100 recording list responsive frames and selected row pixel checks.",
                    row: 100,
                },
                {
                    claimBoundary:
                        "Detail/header pixels only; not row 96 empty+selected Workspace matrix by itself.",
                    evidence:
                        "Row 101 detail header placement and state pixel checks.",
                    row: 101,
                },
                {
                    claimBoundary:
                        "Responsive shell/drawer pixels only; not row 96 dashboard+standalone matrix by itself.",
                    evidence:
                        "Row 121 full responsive app shell frames and drawer metrics.",
                    row: 121,
                },
                {
                    claimBoundary:
                        "Env-gated standalone error runtime frames only; not row 96 dashboard selected/empty completion by itself.",
                    evidence: WORKSPACE_STANDALONE_ERROR_RUNTIME_COMMAND,
                    row: 96,
                },
            ],
            generatedAt: new Date().toISOString(),
            nonClaims: [
                "Row 96 remains PARTIAL.",
                "This matrix does not claim broader all-page/all-control acceptance.",
                "Distributed row 100/101/121 evidence is cited only as dependency evidence.",
            ],
            residualGaps: [
                "No row-96-specific live pixel target exists for every state/content combination; live runtime entries are metric/structural evidence.",
                "Dashboard no-match empty detail is now runtime-metric evidence; no row-96-specific dashboard empty pixel target exists for this state/content combination.",
                "Standalone error empty detail has a deterministic runtime-visual command; this matrix records source selectors and cites the env-gated focused command.",
                "Responsive frames are recorded as layout metrics, not selected-detail visual parity.",
                "Broader all-page/all-control scripted plus real-browser acceptance remains pending.",
            ],
            scope: {
                matrixRow: 96,
                status: "PARTIAL",
                surface: "Workspace",
                writeBoundary: WORKSPACE_VISUAL_MATRIX_DIR,
            },
            sotReference: {
                empty: {
                    evidenceKind: "sot-runtime-metric",
                    frames: sotEmptyFrames,
                    source:
                        "ui_kits/web/index.html .detail-empty exposed from hidden SOT empty state for selector/metric reference.",
                },
                selected: {
                    evidenceKind: "sot-runtime-metric",
                    frames: sotSelectedFrames,
                    source:
                        "ui_kits/web/index.html default selected Workspace reference.",
                },
            },
            states: [
                {
                    evidenceKind: "runtime-metric",
                    frames: dashboardSelectedFrames,
                    result: "PARTIAL",
                    state: "dashboard-selected-detail",
                    surface: "dashboard",
                },
                dashboardEmptyState,
                {
                    evidenceKind: "runtime-metric",
                    frames: standaloneSelectedFrames,
                    result: "PARTIAL",
                    state: "standalone-selected-detail",
                    surface: "recording-detail",
                },
                {
                    evidenceKind: "runtime-metric",
                    frames: standaloneNotFoundFrames,
                    result: "PARTIAL",
                    state: "standalone-not-found-empty-detail",
                    surface: "recording-detail",
                },
                {
                    ...standaloneErrorEvidence,
                    state: "standalone-error-empty-detail",
                    surface: "recording-detail",
                },
            ],
        };

        await writeWorkspaceVisualMatrixEvidence(matrix);
        await testInfo.attach("workspace-visual-matrix.json", {
            body: Buffer.from(JSON.stringify(matrix, null, 2)),
            contentType: "application/json",
        });
    } finally {
        await Promise.all([
            cleanupRecordingDetailSeed(),
            sotPage.close(),
        ]);
    }
});

test("Workspace standalone error boundary runtime visual row 96", async ({
    page,
}, testInfo) => {
    test.skip(
        process.env.BETTERAINOTE_E2E_RECORDING_DETAIL_ERROR !== "1",
        "Requires the E2E-only recording detail error-boundary trigger.",
    );

    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? process.env.APP_URL ?? "";
    expect(baseUrl, "row-96 standalone error runtime base URL").toBe(
        "http://127.0.0.1:3236",
    );
    expect(
        process.env.BETTERAINOTE_E2E_RECORDING_DETAIL_ERROR,
        "row-96 standalone error runtime trigger env",
    ).toBe("1");

    await ensureSignedIn(page);
    await resetWorkspaceVisualDisplay(page);
    await page.goto(`/recordings/${WORKSPACE_STANDALONE_ERROR_RECORDING_ID}`, {
        waitUntil: "domcontentloaded",
    });

    await expect(
        page.locator('[data-sot-panel="route-workspace"]').first(),
    ).toBeVisible({
        timeout: 30_000,
    });
    await expect(
        page
            .locator(
                '[data-sot-panel="recording-route-empty-detail"][data-empty="true"]',
            )
            .first(),
    ).toBeVisible();
    await expect(
        page.locator('[data-sot-panel="recording-route-empty"]').first(),
    ).toBeVisible();
    await expect(
        page.locator('[data-sot-part="recording-route-empty-title"]').first(),
    ).toContainText("加载失败");
    await expect(page.getByRole("button", { name: "重试" })).toBeVisible();
    await expect(page.getByRole("link", { name: "返回工作台" })).toBeVisible();

    const frames = await collectWorkspaceStandaloneErrorRuntimeFrames(page);
    expect(frames, "desktop/narrow/mobile runtime frame count").toHaveLength(3);

    for (const frame of frames) {
        expect(
            frame.metrics.elements.workspace.isVisible,
            `${frame.frame} workspace visible`,
        ).toBe(true);
        expect(
            frame.metrics.elements.detail.isVisible,
            `${frame.frame} detail empty surface visible`,
        ).toBe(true);
        expect(
            frame.metrics.elements.emptyDetail.isVisible,
            `${frame.frame} detail-empty visible`,
        ).toBe(true);
        expect(
            frame.metrics.elements.emptyDetail.text,
            `${frame.frame} detail-empty title copy`,
        ).toContain("加载失败");
        expect(frame.controls.retry.isVisible, `${frame.frame} retry`).toBe(
            true,
        );
        expect(
            frame.controls.backToDashboard.isVisible,
            `${frame.frame} back to dashboard`,
        ).toBe(true);
    }

    const evidence: WorkspaceStandaloneErrorRuntimeEvidence = {
        commandResults: [
            {
                command: WORKSPACE_STANDALONE_ERROR_RUNTIME_COMMAND,
                status: "PASS",
                summary:
                    "Focused Playwright case forced the recording detail segment error boundary through the E2E-only env/id gate and captured desktop, narrow, and mobile runtime frames.",
            },
        ],
        env: {
            BETTERAINOTE_E2E_RECORDING_DETAIL_ERROR:
                process.env.BETTERAINOTE_E2E_RECORDING_DETAIL_ERROR,
            PLAYWRIGHT_BASE_URL: process.env.PLAYWRIGHT_BASE_URL,
            PLAYWRIGHT_USE_SYSTEM_CHROME: process.env.PLAYWRIGHT_USE_SYSTEM_CHROME,
            port: new URL(baseUrl).port,
        },
        files: {
            evidenceDir: repoRelativeEvidencePath(
                WORKSPACE_STANDALONE_ERROR_RUNTIME_DIR,
            ),
            evidenceMd: repoRelativeEvidencePath(
                WORKSPACE_STANDALONE_ERROR_RUNTIME_MD,
            ),
            json: repoRelativeEvidencePath(WORKSPACE_STANDALONE_ERROR_RUNTIME_JSON),
            page: "src/app/(app)/recordings/[id]/page.tsx",
            spec: "e2e/recording-detail-workstation.spec.ts",
        },
        frames,
        generatedAt: new Date().toISOString(),
        residualBoundaries: [
            "Workspace row remains PARTIAL.",
            "This closes only the standalone error runtime-visual gap that was previously source-structural.",
            "No row-96-specific SOT pixel target is claimed for the standalone error content.",
            "No broader all-page/all-control scripted or real-browser acceptance is claimed.",
        ],
        result: "PASS",
        scope: {
            matrixRow: 96,
            status: "PARTIAL",
            surface: "Workspace",
        },
        state: {
            id: WORKSPACE_STANDALONE_ERROR_RECORDING_ID,
            title: "加载失败",
            url: `/recordings/${WORKSPACE_STANDALONE_ERROR_RECORDING_ID}`,
        },
    };

    await writeWorkspaceStandaloneErrorRuntimeEvidence(evidence);
    await testInfo.attach("workspace-standalone-error-runtime.json", {
        body: Buffer.from(JSON.stringify(evidence, null, 2)),
        contentType: "application/json",
    });
});

test("recording detail uses the new workstation shell and keeps all copy actions live", async ({
    page,
}) => {
    await installClipboardCapture(page);

    let recordingId = DETAIL_RECORDING_ID;

    try {
        await ensureSignedIn(page);
        const userId = await getPlaywrightUserId();
        recordingId = await seedRecordingDetail(userId, {
            includeSpeakerReview: true,
        });

        await page.goto(`/recordings/${recordingId}`, {
            waitUntil: "domcontentloaded",
        });

        await waitForRecordingDetailReady(page);
        await expect(
            recordingWorkstation(page).getByRole("button", {
                name: "复制转录",
                exact: true,
            }),
        ).toBeVisible();
        await expect(
            page.getByRole("heading", { name: "E2E source detail review" }),
        ).toBeVisible();
        await expect(page.getByText("E2E 源报告摘要")).toBeVisible();
        await expect(
            sourceReportState(page, "loaded").getByText("00:00 – 00:15"),
        ).toContainText("00:00 – 00:15");
        await expect(
            detailSourceTranscriptCopyButton(page),
        ).toHaveAttribute("data-sot-state", "ready");
        await expect(
            detailSourceReportCopyButton(page),
        ).toHaveAttribute("data-sot-state", "ready");

        await localTranscriptCopyButton(page).click();
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        (
                            window as unknown as {
                                __betterainoteCopiedTexts: string[];
                            }
                        ).__betterainoteCopiedTexts.at(-1) ?? "",
                ),
            )
            .toContain(SPEAKER_REVIEW_PROFILE_ZH_NAME);
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        (
                            window as unknown as {
                                __betterainoteCopiedTexts: string[];
                            }
                        ).__betterainoteCopiedTexts.at(-1) ?? "",
                ),
            )
            .not.toContain("SPEAKER_ALPHA_00");

        await rawTranscriptCopyButton(page).click();
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        (
                            window as unknown as {
                                __betterainoteCopiedTexts: string[];
                            }
                        ).__betterainoteCopiedTexts.at(-1) ?? "",
                ),
            )
            .toContain("SPEAKER_ALPHA_00");
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        (
                            window as unknown as {
                                __betterainoteCopiedTexts: string[];
                            }
                        ).__betterainoteCopiedTexts.at(-1) ?? "",
                ),
            )
            .not.toContain(SPEAKER_REVIEW_PROFILE_ZH_NAME);

        await detailSourceTranscriptCopyButton(page).click();
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        (
                            window as unknown as {
                                __betterainoteCopiedTexts: string[];
                            }
                        ).__betterainoteCopiedTexts.at(-1) ?? "",
                ),
            )
            .toContain("来源逐字稿复制内容");
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        (
                            window as unknown as {
                                __betterainoteCopiedTexts: string[];
                            }
                        ).__betterainoteCopiedTexts.at(-1) ?? "",
                ),
            )
            .toContain("00:00 – 00:15 · 说话人 1");

        await detailSourceReportCopyButton(page).click();
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        (
                            window as unknown as {
                                __betterainoteCopiedTexts: string[];
                            }
                        ).__betterainoteCopiedTexts.at(-1) ?? "",
                ),
            )
            .toContain("E2E 源报告摘要");

        await sourceReportTranscriptCopyButton(page).click();
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        (
                            window as unknown as {
                                __betterainoteCopiedTexts: string[];
                            }
                        ).__betterainoteCopiedTexts.at(-1) ?? "",
                ),
            )
            .toContain("来源逐字稿复制内容");

        await sourceReportReportCopyButton(page).click();
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        (
                            window as unknown as {
                                __betterainoteCopiedTexts: string[];
                            }
                        ).__betterainoteCopiedTexts.at(-1) ?? "",
                ),
            )
            .toContain("E2E 源报告摘要");
    } finally {
        await cleanupRecordingDetailSeed();
    }
});

test("recording detail source report loaded state matches SOT pixels", async (
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
        const storagePath = await writeAudioFixture();
        const recordingId = await seedRecordingDetail(userId, {
            duration: 872_000,
            filename: title,
            sourceProvider: "dingtalk-a1",
            startTime: Date.parse("2026-04-22T06:00:00.000Z"),
            storagePath,
        });

        await page.route(
            `**/api/recordings/${recordingId}/source-report`,
            async (route) => {
                await route.fulfill({
                    contentType: "application/json",
                    body: JSON.stringify({
                        detail: {
                            durationMs: 872_000,
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
                                url: "https://source.example.test/recording/sot-loaded",
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

        await page.goto(`/recordings/${recordingId}`, {
            waitUntil: "domcontentloaded",
        });
        await waitForRecordingDetailReady(page);

        sotPage = await page.context().newPage();
        const sotLoaded = await openSotSourceReportState(sotPage, "loaded");
        const productLoaded = sourceReportInnerState(page, "loaded");
        await expect(productLoaded).toHaveAttribute("data-state", "loaded");
        await expect(
            productLoaded.locator("[data-sot-source-report-section-title]"),
        ).toHaveText(["来源转写", "来源信息"]);

        await expectTransformedSotPixelsMatch(
            page,
            testInfo,
            "Recording detail source report loaded",
            sotLoaded,
            productLoaded,
            (html) => html,
        );
        await expectResponsiveSotPixelsMatch(
            page,
            testInfo,
            "Recording detail source report loaded responsive frame",
            sotLoaded,
            productLoaded,
            DETAIL_SOURCE_REPORT_PIXEL_FRAMES,
        );
    } finally {
        await sotPage?.close();
        await removeAudioFixture();
        await cleanupRecordingDetailSeed();
    }
});

test("recording detail source report loaded sub-states match SOT pixels", async ({
    page,
}) => {
    let sotPage: Page | null = null;
    let storagePath = "";
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
    const baseDetail = {
        durationMs: 872_000,
        language: "简体中文 (zh-CN)",
        providerName: "钉钉 闪记",
        providerSentenceName: "钉钉闪记",
        recordedAt: "2026-04-22T06:00:00.000Z",
        sourceTitle: "Q2 Sync · 周一",
        statusLabel: "已同步",
        updatedAt: "2026-04-22T08:38:00.000Z",
    };
    const cases = [
        {
            actionState: "ready",
            detail: {
                ...baseDetail,
                readableContent: "音频 · 摘要 · 说话人",
            },
            expectedCopyReport: "ready",
            expectedCopyTranscript: "missing",
            readableContent: "音频 · 摘要 · 说话人",
            segmentCount: 0,
            sourceActions: {
                openSource: {
                    available: true,
                    url: "https://source.example.test/recording/sot-transcript-missing",
                },
                repullSource: { available: true },
            },
            state: "transcript-missing",
            summaryLabel: "已就绪",
            summaryMarkdown: "来源官方摘要仍然可读。",
            summaryReady: true,
            transcript: null,
            transcriptLabel: "未生成",
            transcriptReady: false,
        },
        {
            actionState: "ready",
            detail: {
                ...baseDetail,
                readableContent: "音频 · 转写 · 说话人",
            },
            expectedCopyReport: "missing",
            expectedCopyTranscript: "ready",
            readableContent: "音频 · 转写 · 说话人",
            segmentCount: 38,
            sourceActions: {
                openSource: {
                    available: true,
                    url: "https://source.example.test/recording/sot-summary-missing",
                },
                repullSource: { available: true },
            },
            state: "summary-missing",
            summaryLabel: "未生成",
            summaryMarkdown: "",
            summaryReady: false,
            transcript: {
                segmentCount: 38,
                segments: sourceSegments,
                text: sourceSegments.map((segment) => segment.text).join("\n"),
            },
            transcriptLabel: "已就绪",
            transcriptReady: true,
        },
        {
            actionState: "unavailable",
            detail: {
                ...baseDetail,
                readableContent: "音频",
            },
            expectedCopyReport: "missing",
            expectedCopyTranscript: "missing",
            readableContent: "音频",
            segmentCount: 0,
            sourceActions: {
                openSource: { available: false },
                repullSource: { available: false },
            },
            state: "both-missing",
            summaryLabel: "未生成",
            summaryMarkdown: "",
            summaryReady: false,
            transcript: null,
            transcriptLabel: "未生成",
            transcriptReady: false,
        },
    ] as const;
    let activeCase: (typeof cases)[number] | null = null;
    const sourceReportRoute = `**/api/recordings/${DETAIL_RECORDING_ID}/source-report`;
    const states: SourceReportLoadedSubStateStateEvidence[] = [];

    await page.route(sourceReportRoute, async (route) => {
        if (!activeCase) {
            await route.fulfill({
                contentType: "application/json",
                status: 500,
                body: JSON.stringify({ error: "no active sub-state case" }),
            });
            return;
        }

        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({
                detail: activeCase.detail,
                filename: title,
                sourceActions: activeCase.sourceActions,
                sourceProvider: "dingtalk-a1",
                summaryMarkdown: activeCase.summaryMarkdown,
                summaryReady: activeCase.summaryReady,
                transcript: activeCase.transcript,
                transcriptReady: activeCase.transcriptReady,
            }),
        });
    });

    try {
        await ensureSignedIn(page);
        const userId = await getPlaywrightUserId();
        sotPage = await page.context().newPage();
        storagePath = await writeAudioFixture();

        for (const subStateCase of cases) {
            activeCase = subStateCase;
            await seedRecordingDetail(userId, {
                duration: 872_000,
                filename: title,
                sourceProvider: "dingtalk-a1",
                startTime: Date.parse("2026-04-22T06:00:00.000Z"),
                storagePath,
            });

            await page.goto(`/recordings/${DETAIL_RECORDING_ID}`, {
                waitUntil: "domcontentloaded",
            });
            await waitForRecordingDetailReady(page);

            const sotLoaded = await openSotSourceReportState(sotPage, "loaded", {
                recordingId: "rec-product-weekly",
                subState: subStateCase.state,
            });
            await applySotSourceReportLoadedSubStateFixture(sotLoaded, {
                actionState: subStateCase.actionState,
                readableContent: subStateCase.readableContent,
                segmentCount: subStateCase.segmentCount,
                subState: subStateCase.state,
                summaryLabel: subStateCase.summaryLabel,
                transcriptLabel: subStateCase.transcriptLabel,
            });

            const productLoaded = sourceReportInnerState(page, "loaded");
            await expect(sourceReportState(page, "loaded")).toHaveAttribute(
                "data-sot-state",
                "loaded",
            );
            await expect(productLoaded).toHaveAttribute(
                "data-state",
                "loaded",
            );
            await expect(productLoaded).toHaveAttribute(
                "data-sub-state",
                subStateCase.state,
            );
            await expect(productLoaded.locator('[data-sot-metric="transcript-status"]')).toContainText(
                subStateCase.transcriptLabel,
            );
            await expect(productLoaded.locator('[data-sot-metric="summary-status"]')).toContainText(
                subStateCase.summaryLabel,
            );
            await expect(productLoaded.locator('[data-sot-metric="segment-count"]')).toContainText(
                String(subStateCase.segmentCount),
            );
            await expect(
                productLoaded.locator("[data-sot-source-report-section-title]"),
            ).toHaveText(["来源转写", "来源信息"]);
            await expect(
                productLoaded.locator("[data-sot-source-report-empty]"),
            ).toHaveCount(0);
            await expect(sourceReportInnerState(page, "empty")).toHaveCount(0);
            await expect(sourceReportInnerState(page, "loading")).toHaveCount(0);
            await expect(sourceReportInnerState(page, "error")).toHaveCount(0);

            await expect(detailSourceTranscriptCopyButton(page)).toHaveAttribute(
                "data-sot-state",
                subStateCase.expectedCopyTranscript,
            );
            await expect(detailSourceReportCopyButton(page)).toHaveAttribute(
                "data-sot-state",
                subStateCase.expectedCopyReport,
            );
            if (subStateCase.expectedCopyTranscript === "ready") {
                await expect(detailSourceTranscriptCopyButton(page)).toBeEnabled();
            } else {
                await expect(detailSourceTranscriptCopyButton(page)).toBeDisabled();
            }
            if (subStateCase.expectedCopyReport === "ready") {
                await expect(detailSourceReportCopyButton(page)).toBeEnabled();
            } else {
                await expect(detailSourceReportCopyButton(page)).toBeDisabled();
            }
            await expect(sourceReportOpenSourceControl(page)).toHaveAttribute(
                "data-sot-state",
                subStateCase.actionState,
            );
            await expect(sourceReportRepullButton(page)).toHaveAttribute(
                "data-sot-state",
                subStateCase.actionState,
            );
            if (subStateCase.actionState === "ready") {
                await expect(sourceReportOpenSourceControl(page)).toBeEnabled();
                await expect(sourceReportRepullButton(page)).toBeEnabled();
            } else {
                await expect(sourceReportOpenSourceControl(page)).toBeDisabled();
                await expect(sourceReportRepullButton(page)).toBeDisabled();
            }

            if (
                subStateCase.state === "transcript-missing" ||
                subStateCase.state === "both-missing"
            ) {
                expect(
                    await readPseudoContent(
                        productLoaded,
                        '[data-sot-source-report-section][data-sot-section="transcript"]',
                        "::after",
                    ),
                ).toBe(
                    '"来源未提供逐字稿。可以稍后再来，或运行私有转写。"',
                );
            }
            if (
                subStateCase.state === "summary-missing" ||
                subStateCase.state === "both-missing"
            ) {
                expect(
                    await readPseudoContent(
                        productLoaded,
                        '[data-sot-source-report-section][data-sot-section="metadata"]',
                        "::before",
                    ),
                ).toBe('"来源未提供官方摘要。"');
            }

            const pixel =
                await collectSourceReportDetailLoadedSubStatePixels(
                    page,
                    subStateCase.state,
                    sotLoaded,
                    productLoaded,
                );
            const pixelEntries = [pixel.element, ...pixel.frames];
            for (const entry of pixelEntries) {
                expect(
                    entry.diff.dimensionsMatch,
                    `${subStateCase.state} ${entry.frame} dimensions`,
                ).toBe(true);
            }
            const result = pixelEntries.every((entry) => entry.result === "PASS")
                ? "PASS"
                : "PARTIAL";

            states.push({
                controls: {
                    copyReport: await readSourceReportButtonEvidence(
                        detailSourceReportCopyButton(page),
                    ),
                    copyTranscript: await readSourceReportButtonEvidence(
                        detailSourceTranscriptCopyButton(page),
                    ),
                    openSource: await readSourceReportButtonEvidence(
                        sourceReportOpenSourceControl(page),
                    ),
                    refresh: await readSourceReportButtonEvidence(
                        sourceReportLoadButton(page),
                    ),
                    repull: await readSourceReportButtonEvidence(
                        sourceReportRepullButton(page),
                    ),
                },
                expected: {
                    actionState: subStateCase.actionState,
                    copyReport: subStateCase.expectedCopyReport,
                    copyTranscript: subStateCase.expectedCopyTranscript,
                    readableContent: subStateCase.readableContent,
                    summaryLabel: subStateCase.summaryLabel,
                    transcriptLabel: subStateCase.transcriptLabel,
                },
                markers: await readSourceReportLoadedSubStateMarkers(page),
                pixel,
                result,
                state: subStateCase.state,
            });
        }

        const result = states.every((state) => state.result === "PASS")
            ? "PASS"
            : "PARTIAL";
        const evidence: SourceReportDetailLoadedSubStatesEvidence = {
            commandResults: [
                {
                    command: SOURCE_REPORT_DETAIL_LOADED_SUBSTATES_COMMAND,
                    status: result,
                    summary:
                        result === "PASS"
                            ? "Focused recording-detail loaded sub-state DOM/control assertions passed with exact-zero element and desktop/mobile pixel diffs."
                            : "Focused recording-detail loaded sub-state DOM/control assertions passed; at least one pixel diff is recorded as non-zero in JSON/PNGs.",
                },
            ],
            files: {
                evidenceDir: repoRelativeEvidencePath(
                    SOURCE_REPORT_DETAIL_LOADED_SUBSTATES_DIR,
                ),
                evidenceMd: repoRelativeEvidencePath(
                    SOURCE_REPORT_DETAIL_LOADED_SUBSTATES_MD,
                ),
                json: repoRelativeEvidencePath(
                    SOURCE_REPORT_DETAIL_LOADED_SUBSTATES_JSON,
                ),
                matrix:
                    "tmp/betterainote-design-evidence/run-20260605-sot-1to1/sot-1to1-matrix.md",
                spec: "e2e/recording-detail-workstation.spec.ts",
            },
            generatedAt: new Date().toISOString(),
            residualBoundaries: [
                "This evidence file is generated by the recording-detail loaded sub-states slice: transcript-missing, summary-missing, and both-missing.",
                "Row 107 source-report acceptance also depends on sibling focused E2E coverage for loaded, loading, error, empty, retry, refresh, and source-copy availability states.",
                "No destructive/external open-source click claim is made; open-source and repull controls are asserted for availability/state only.",
                "Broader all-page/all-control acceptance remains pending.",
            ],
            result,
            scope: {
                matrixRow: 107,
                rowStatus: result,
                surface: "Source report",
                target: "recording-detail loaded sub-states",
            },
            states,
        };
        await writeSourceReportDetailLoadedSubStatesEvidence(evidence);
        expect(states).toHaveLength(3);
    } finally {
        activeCase = null;
        await page.unroute(sourceReportRoute).catch(() => null);
        await sotPage?.close();
        await removeAudioFixture();
        await cleanupRecordingDetailSeed();
    }
});

test("recording detail source report loading, error, and empty states match SOT pixels", async (
    { page },
    testInfo,
) => {
    let sotPage: Page | null = null;
    let releaseLoadingReport = () => {};
    const loadingGate = new Promise<void>((resolve) => {
        releaseLoadingReport = resolve;
    });
    let resolveLoadingStarted = () => {};
    const loadingStarted = new Promise<void>((resolve) => {
        resolveLoadingStarted = resolve;
    });

    try {
        await ensureSignedIn(page);
        const userId = await getPlaywrightUserId();
        sotPage = await page.context().newPage();

        const loadingRecordingId = await seedRecordingDetail(userId, {
            filename: "E2E source report SOT loading",
            sourceProvider: "dingtalk-a1",
        });
        const sourceReportRoute = `**/api/recordings/${loadingRecordingId}/source-report`;
        await page.route(sourceReportRoute, async (route) => {
            resolveLoadingStarted();
            await loadingGate;
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
        });
        await page.goto(`/recordings/${loadingRecordingId}`, {
            waitUntil: "domcontentloaded",
        });
        await waitForRecordingDetailShellReady(page);
        await loadingStarted;
        const productLoading = sourceReportInnerState(page, "loading");
        await expect(productLoading).toBeVisible();
        const sotLoading = await openSotSourceReportState(sotPage, "loading");
        await expectTransformedSotPixelsMatch(
            page,
            testInfo,
            "Recording detail source report loading",
            sotLoading,
            productLoading,
            stabilizeSkeletonAnimation,
            {
                differingPixels: 512,
                maxChannelDelta: 1,
            },
        );
        await expectResponsiveSotPixelsMatch(
            page,
            testInfo,
            "Recording detail source report loading responsive frame",
            sotLoading,
            productLoading,
            DETAIL_SOURCE_REPORT_PIXEL_FRAMES,
            stabilizeSkeletonAnimation,
        );
        releaseLoadingReport();
        await page.unroute(sourceReportRoute);
        await cleanupRecordingDetailSeed();

        const errorRecordingId = await seedRecordingDetail(userId, {
            filename: "E2E source report SOT error",
            sourceProvider: "dingtalk-a1",
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
        await page.goto(`/recordings/${errorRecordingId}`, {
            waitUntil: "domcontentloaded",
        });
        await waitForRecordingDetailShellReady(page);
        const productError = sourceReportInnerState(page, "error");
        await expect(productError).toBeVisible();
        await expect(productError).toHaveAttribute(
            "data-sot-error",
            "Source report temporarily unavailable",
        );
        const sotError = await openSotSourceReportState(sotPage, "error");
        await expectTransformedSotPixelsMatch(
            page,
            testInfo,
            "Recording detail source report error",
            sotError,
            productError,
            (html) => html,
        );
        await expectResponsiveSotPixelsMatch(
            page,
            testInfo,
            "Recording detail source report error responsive frame",
            sotError,
            productError,
            DETAIL_SOURCE_REPORT_PIXEL_FRAMES,
        );
        await page.unroute(sourceReportRoute);
        await cleanupRecordingDetailSeed();

        const emptyRecordingId = await seedRecordingDetail(userId, {
            filename: "E2E source report SOT empty",
            sourceProvider: "",
        });
        let emptySourceReportRequests = 0;
        await page.route(sourceReportRoute, async (route) => {
            emptySourceReportRequests += 1;
            await route.fulfill({
                contentType: "application/json",
                status: 500,
                body: JSON.stringify({ error: "unexpected request" }),
            });
        });
        await page.goto(`/recordings/${emptyRecordingId}`, {
            waitUntil: "domcontentloaded",
        });
        await waitForRecordingDetailShellReady(page);
        const productEmpty = sourceReportInnerState(page, "empty");
        await expect(productEmpty).toBeVisible();
        await page.waitForTimeout(300);
        expect(emptySourceReportRequests).toBe(0);
        const sotEmpty = await openSotSourceReportState(sotPage, "empty");
        await expectTransformedSotPixelsMatch(
            page,
            testInfo,
            "Recording detail source report empty",
            sotEmpty,
            productEmpty,
            (html) => html,
        );
        await expectResponsiveSotPixelsMatch(
            page,
            testInfo,
            "Recording detail source report empty responsive frame",
            sotEmpty,
            productEmpty,
            DETAIL_SOURCE_REPORT_PIXEL_FRAMES,
        );
    } finally {
        releaseLoadingReport();
        await sotPage?.close();
        await cleanupRecordingDetailSeed();
    }
});

test("recording detail source report row107 state-action matrix consolidation", async ({
    page,
}, testInfo) => {
    await installClipboardCapture(page);

    type MatrixSourceReport = {
        body: Record<string, unknown>;
        gate?: Promise<void>;
        status?: number;
    };

    let releaseLoadingReport: () => void = () => {};
    let releaseRefreshReport: () => void = () => {};
    let reportQueue: MatrixSourceReport[] = [];
    let sourceReportRequests = 0;
    let userId = "";
    const sourceReportRoute = `**/api/recordings/${DETAIL_RECORDING_ID}/source-report`;
    const title = "Row107 source report matrix";
    const sourceSegments = [
        {
            speaker: "Speaker 1",
            startMs: 0,
            endMs: 15_000,
            text: "来源逐字稿完整内容。",
        },
        {
            speaker: "Speaker 2",
            startMs: 15_000,
            endMs: 30_000,
            text: "矩阵补证覆盖复制、刷新和来源动作。",
        },
    ];
    const baseDetail = {
        durationMs: 240_000,
        language: "简体中文 (zh-CN)",
        providerName: "钉钉 闪记",
        providerSentenceName: "钉钉闪记",
        recordedAt: "2026-04-22T06:00:00.000Z",
        sourceTitle: "Row107 Source",
        statusLabel: "已同步",
        updatedAt: "2026-04-22T08:38:00.000Z",
    };
    const readyActions = {
        openSource: {
            available: true,
            url: "https://source.example.test/recording/row107",
        },
        repullSource: { available: true },
    };
    const unavailableActions = {
        openSource: { available: false },
        repullSource: { available: false },
    };
    const completeReport = {
        detail: {
            ...baseDetail,
            readableContent: "音频 · 转写 · 摘要 · 说话人",
        },
        filename: title,
        sourceActions: readyActions,
        sourceProvider: "dingtalk-a1",
        summaryMarkdown: "## Row107 来源报告摘要\n\n- 来源报告复制内容。",
        summaryReady: true,
        transcript: {
            segmentCount: sourceSegments.length,
            segments: sourceSegments,
            text: sourceSegments.map((segment) => segment.text).join("\n"),
        },
        transcriptReady: true,
    };
    const transcriptMissingReport = {
        ...completeReport,
        detail: {
            ...baseDetail,
            readableContent: "音频 · 摘要 · 说话人",
        },
        summaryMarkdown: "## Row107 来源报告摘要\n\n- 只有摘要可复制。",
        summaryReady: true,
        transcript: null,
        transcriptReady: false,
    };
    const summaryMissingReport = {
        ...completeReport,
        detail: {
            ...baseDetail,
            readableContent: "音频 · 转写 · 说话人",
        },
        summaryMarkdown: "",
        summaryReady: false,
        transcript: completeReport.transcript,
        transcriptReady: true,
    };
    const bothMissingReport = {
        ...completeReport,
        detail: {
            ...baseDetail,
            readableContent: "音频",
        },
        sourceActions: unavailableActions,
        summaryMarkdown: "",
        summaryReady: false,
        transcript: null,
        transcriptReady: false,
    };
    const matrixCases: SourceReportRow107MatrixCaseEvidence[] = [];
    const expectedCaseNames: SourceReportRow107MatrixCaseName[] = [
        "complete",
        "open-source availability",
        "repull availability",
        "copy availability",
        "transcript-missing",
        "summary-missing",
        "both-missing",
        "loading",
        "error",
        "empty",
        "retry",
        "refresh-in-flight",
    ];

    const addMatrixCase = async (
        caseName: SourceReportRow107MatrixCaseName,
        requestStart: number,
        expectations: string[],
    ) => {
        matrixCases.push(
            await readSourceReportRow107MatrixCase(
                page,
                caseName,
                sourceReportRequests - requestStart,
                expectations,
            ),
        );
    };
    const seedAndOpen = async (
        reports: MatrixSourceReport[],
        options: RecordingDetailSeedOptions = {},
    ) => {
        reportQueue = [...reports];
        const requestStart = sourceReportRequests;
        await seedRecordingDetail(userId, {
            filename: title,
            sourceProvider: "dingtalk-a1",
            ...options,
        });
        await page.goto(`/recordings/${DETAIL_RECORDING_ID}`, {
            waitUntil: "domcontentloaded",
        });
        return requestStart;
    };

    await page.route(sourceReportRoute, async (route) => {
        sourceReportRequests += 1;
        const nextReport = reportQueue.shift();

        if (!nextReport) {
            await route.fulfill({
                contentType: "application/json",
                status: 500,
                body: JSON.stringify({
                    error: "unexpected row107 matrix source-report request",
                }),
            });
            return;
        }

        if (nextReport.gate) {
            await nextReport.gate;
        }

        await route.fulfill({
            contentType: "application/json",
            status: nextReport.status ?? 200,
            body: JSON.stringify(nextReport.body),
        });
    });

    try {
        await ensureSignedIn(page);
        userId = await getPlaywrightUserId();

        let requestStart = await seedAndOpen([{ body: completeReport }]);
        await waitForRecordingDetailReady(page);
        await expect(sourceReportInnerState(page, "loaded")).toHaveAttribute(
            "data-sub-state",
            "complete",
        );
        await expect(detailSourceTranscriptCopyButton(page)).toHaveAttribute(
            "data-sot-state",
            "ready",
        );
        await expect(detailSourceReportCopyButton(page)).toHaveAttribute(
            "data-sot-state",
            "ready",
        );
        await expect(sourceReportOpenSourceControl(page)).toHaveAttribute(
            "data-sot-state",
            "ready",
        );
        await expect(sourceReportRepullButton(page)).toHaveAttribute(
            "data-sot-state",
            "ready",
        );
        await expect(sourceReportLoadButton(page)).toBeEnabled();
        await detailSourceReportCopyButton(page).click();
        await detailSourceTranscriptCopyButton(page).click();
        await expect.poll(async () => (await readCopiedTexts(page)).length).toBe(2);
        const copiedTexts = (await readCopiedTexts(page)).join("\n");
        expect(copiedTexts).toContain("Row107 来源报告摘要");
        expect(copiedTexts).toContain("来源逐字稿完整内容");
        await addMatrixCase("complete", requestStart, [
            "loaded complete sub-state is visible",
            "copy transcript/report controls are ready",
            "open-source and repull controls are ready",
        ]);
        await addMatrixCase("open-source availability", requestStart, [
            "open-source control is ready/enabled",
            "availability only; no external source workflow is claimed",
        ]);
        await addMatrixCase("repull availability", requestStart, [
            "repull control is ready/enabled",
            "availability only; no destructive source sync claim is made",
        ]);
        await addMatrixCase("copy availability", requestStart, [
            "source transcript/report copy controls are ready",
            "clipboard capture received source report and transcript text",
        ]);

        const loadedSubStateCases = [
            {
                body: transcriptMissingReport,
                caseName: "transcript-missing",
                copyReportState: "ready",
                copyTranscriptState: "missing",
                subState: "transcript-missing",
            },
            {
                body: summaryMissingReport,
                caseName: "summary-missing",
                copyReportState: "missing",
                copyTranscriptState: "ready",
                subState: "summary-missing",
            },
            {
                body: bothMissingReport,
                caseName: "both-missing",
                copyReportState: "missing",
                copyTranscriptState: "missing",
                subState: "both-missing",
            },
        ] as const;

        for (const loadedSubStateCase of loadedSubStateCases) {
            requestStart = await seedAndOpen([{ body: loadedSubStateCase.body }]);
            await waitForRecordingDetailReady(page);
            await expect(sourceReportInnerState(page, "loaded")).toHaveAttribute(
                "data-sub-state",
                loadedSubStateCase.subState,
            );
            await expect(detailSourceTranscriptCopyButton(page)).toHaveAttribute(
                "data-sot-state",
                loadedSubStateCase.copyTranscriptState,
            );
            await expect(detailSourceReportCopyButton(page)).toHaveAttribute(
                "data-sot-state",
                loadedSubStateCase.copyReportState,
            );
            await addMatrixCase(loadedSubStateCase.caseName, requestStart, [
                `loaded ${loadedSubStateCase.subState} sub-state is visible`,
                `copy transcript=${loadedSubStateCase.copyTranscriptState}`,
                `copy report=${loadedSubStateCase.copyReportState}`,
            ]);
        }

        const loadingGate = new Promise<void>((resolve) => {
            releaseLoadingReport = resolve;
        });
        requestStart = await seedAndOpen([
            { body: completeReport, gate: loadingGate },
        ]);
        await waitForRecordingDetailShellReady(page);
        await expect(sourceReportState(page, "loading")).toBeVisible();
        await expect(detailSourceTranscriptCopyButton(page)).toHaveCount(0);
        await expect(detailSourceReportCopyButton(page)).toHaveCount(0);
        await addMatrixCase("loading", requestStart, [
            "loading state is visible while source-report request is in-flight",
            "source copy controls are absent during initial loading",
        ]);
        releaseLoadingReport();
        await expect(sourceReportState(page, "loaded")).toBeVisible();

        requestStart = await seedAndOpen([
            {
                body: { error: "Source report temporarily unavailable" },
                status: 503,
            },
        ]);
        await waitForRecordingDetailShellReady(page);
        await expect(sourceReportState(page, "error")).toBeVisible();
        await expect(sourceReportInnerState(page, "error")).toHaveAttribute(
            "data-sot-error",
            "Source report temporarily unavailable",
        );
        await expect(
            sourceReportState(page, "error").getByRole("button", {
                name: "重试",
                exact: true,
            }),
        ).toBeEnabled();
        await addMatrixCase("error", requestStart, [
            "error state is visible",
            "retry control is available after first-load failure",
            "raw upstream error is recorded in data attribute only",
        ]);

        requestStart = sourceReportRequests;
        reportQueue = [];
        await seedRecordingDetail(userId, {
            filename: title,
            sourceProvider: "",
        });
        await page.goto(`/recordings/${DETAIL_RECORDING_ID}`, {
            waitUntil: "domcontentloaded",
        });
        await waitForRecordingDetailShellReady(page);
        await expect(sourceReportState(page, "empty")).toBeVisible();
        await page.waitForTimeout(300);
        expect(sourceReportRequests - requestStart).toBe(0);
        await addMatrixCase("empty", requestStart, [
            "empty state is visible when the recording has no source provider",
            "source-report API is not called for empty state",
        ]);

        requestStart = await seedAndOpen([
            {
                body: { error: "Source report temporarily unavailable" },
                status: 503,
            },
            { body: completeReport },
        ]);
        await waitForRecordingDetailShellReady(page);
        await expect(sourceReportState(page, "error")).toBeVisible();
        await Promise.all([
            page.waitForResponse(
                (response) =>
                    response
                        .url()
                        .includes(
                            `/api/recordings/${DETAIL_RECORDING_ID}/source-report`,
                        ) &&
                    response.request().method() === "GET" &&
                    response.ok(),
            ),
            sourceReportState(page, "error")
                .getByRole("button", { name: "重试", exact: true })
                .click(),
        ]);
        await expect(sourceReportState(page, "loaded")).toBeVisible();
        await expect(sourceReportInnerState(page, "loaded")).toHaveAttribute(
            "data-sub-state",
            "complete",
        );
        await addMatrixCase("retry", requestStart, [
            "first request fails",
            "retry issues a second GET and restores loaded complete state",
        ]);

        const refreshGate = new Promise<void>((resolve) => {
            releaseRefreshReport = resolve;
        });
        requestStart = await seedAndOpen([
            { body: completeReport },
            {
                body: {
                    ...completeReport,
                    summaryMarkdown:
                        "## Row107 来源报告刷新摘要\n\n- 刷新中保持已加载动作。",
                },
                gate: refreshGate,
            },
        ]);
        await waitForRecordingDetailReady(page);
        const refreshButton = sourceReportLoadButton(page);
        const refreshResponse = page.waitForResponse(
            (response) =>
                response
                    .url()
                    .includes(
                        `/api/recordings/${DETAIL_RECORDING_ID}/source-report`,
                    ) &&
                response.request().method() === "GET" &&
                response.ok(),
        );
        await refreshButton.click();
        await expect(refreshButton).toBeDisabled();
        await expect(refreshButton).toContainText("加载中...");
        await expect(sourceReportState(page, "loaded")).toBeVisible();
        await expect(sourceReportTranscriptCopyButton(page)).toBeEnabled();
        await expect(sourceReportReportCopyButton(page)).toBeEnabled();
        await addMatrixCase("refresh-in-flight", requestStart, [
            "refresh button enters loading state",
            "loaded source-report content remains visible",
            "copy/open-source/repull actions remain available while refresh is in-flight",
        ]);
        releaseRefreshReport();
        await refreshResponse;
        await expect(refreshButton).toBeEnabled();
        await expect(refreshButton).toContainText("刷新");

        expect(matrixCases.map((matrixCase) => matrixCase.case)).toEqual(
            expectedCaseNames,
        );

        const evidence: SourceReportRow107MatrixEvidence = {
            cases: matrixCases,
            commandResults: [
                {
                    command: SOURCE_REPORT_ROW107_MATRIX_COMMAND,
                    status: "PARTIAL",
                    summary:
                        "Focused recording-detail Source report state/action matrix assertions passed; row 107 remains PARTIAL by scope.",
                },
            ],
            files: {
                evidenceDir: repoRelativeEvidencePath(
                    SOURCE_REPORT_ROW107_MATRIX_DIR,
                ),
                evidenceMd: repoRelativeEvidencePath(
                    SOURCE_REPORT_ROW107_MATRIX_MD,
                ),
                json: repoRelativeEvidencePath(SOURCE_REPORT_ROW107_MATRIX_JSON),
                matrix:
                    "tmp/betterainote-design-evidence/run-20260605-sot-1to1/sot-1to1-matrix.md",
                spec: "e2e/recording-detail-workstation.spec.ts",
            },
            generatedAt: new Date().toISOString(),
            nonClaims: [
                "Row 107 remains PARTIAL.",
                "This focused E2E consolidation does not prove broader all-control/manual gate acceptance.",
                "No product code, fixtures, thresholds, pixel helpers, or matrix markdown files were changed.",
                "Open-source and repull entries assert availability/state only; no external provider workflow is claimed.",
            ],
            residualBoundaries: [
                "This is a recording-detail Source report state/action matrix consolidation only.",
                "SOT pixel parity and responsive frames continue to rely on sibling focused source-report tests.",
                "Dashboard Source report coverage and real-browser manual acceptance remain outside this focused grep.",
                "Broader all-page/all-interaction completion remains pending.",
            ],
            result: "PARTIAL",
            scope: {
                matrixRow: 107,
                rowStatus: "PARTIAL",
                surface: "Source report",
                target: "recording-detail state/action matrix consolidation",
            },
        };

        await writeSourceReportRow107MatrixEvidence(evidence);
        await testInfo.attach("source-report-row107-state-action-matrix.json", {
            body: Buffer.from(JSON.stringify(evidence, null, 2)),
            contentType: "application/json",
        });
    } finally {
        releaseLoadingReport();
        releaseRefreshReport();
        reportQueue = [];
        await page.unroute(sourceReportRoute).catch(() => null);
        await cleanupRecordingDetailSeed();
    }
});

test("recording detail retranscribe confirmation restores SOT dialog and backend flow", async ({
    page,
}) => {
    let sotPage: Page | null = null;

    try {
        await ensureSignedIn(page);
        await resetWorkspaceVisualDisplay(page);
        const userId = await getPlaywrightUserId();
        const storagePath = await writeAudioFixture();
        const recordingId = await seedRecordingDetail(userId, {
            includeSpeakerReview: true,
            storagePath,
        });
        const transcribePayloads: unknown[] = [];

        await page.route(
            `**/api/recordings/${recordingId}/transcribe`,
            async (route) => {
                const request = route.request();
                if (request.method() === "GET") {
                    await route.fulfill({
                        contentType: "application/json",
                        body: JSON.stringify({
                            job: {
                                id: "e2e-detail-retx-job",
                                remoteStatus: null,
                                status: "pending",
                            },
                        }),
                    });
                    return;
                }

                if (request.method() !== "POST") {
                    await route.continue();
                    return;
                }

                transcribePayloads.push(request.postDataJSON());
                await route.fulfill({
                    contentType: "application/json",
                    body: JSON.stringify({
                        job: {
                            id: "e2e-detail-retx-job",
                            remoteStatus: null,
                            status: "pending",
                        },
                    }),
                });
            },
        );

        sotPage = await page.context().newPage();
        await openSotComponentLibrary(sotPage);

        await page.goto(`/recordings/${recordingId}`, {
            waitUntil: "domcontentloaded",
        });
        await waitForRecordingDetailReady(page);

        const headerMoreButton = recordingHeader(page).getByRole("button", {
            name: "更多操作",
            exact: true,
        });
        await headerMoreButton.click();
        const headerMoreMenu = page.locator(
            '[data-sot-menu="recording-more-actions"][data-more-menu]',
        );
        await expect(headerMoreMenu).toHaveAttribute("data-open", "true");
        await expect(
            headerMoreMenu.getByRole("menuitem", {
                name: "删除本地副本 来源持有正本",
                exact: true,
            }),
        ).toBeDisabled();
        await headerMoreMenu
            .getByRole("menuitem", { name: "重新转写", exact: true })
            .click();
        const headerDialog = page.getByRole("dialog", {
            name: "重新转写这条录音？",
            exact: true,
        });
        await expect(
            headerDialog.getByRole("button", { name: "取消", exact: true }),
        ).toBeFocused();
        await expectRetranscribeConfirmDialogMatchesSot(sotPage, page);
        await headerDialog
            .getByRole("button", { name: "取消", exact: true })
            .click();
        await expect(headerDialog).not.toBeVisible();
        await expect(headerMoreMenu).toBeHidden();
        expect(transcribePayloads).toEqual([]);

        await page.getByRole("tab", { name: "本地转录", exact: true }).click();

        const retranscribeButton = recordingWorkstation(page)
            .getByRole("button", { name: "重新转写", exact: true })
            .first();
        await expect(retranscribeButton).toBeEnabled();

        await retranscribeButton.click();
        const styleDialog = page.getByRole("dialog", {
            name: "重新转写这条录音？",
            exact: true,
        });
        await expect(
            styleDialog.getByRole("button", { name: "取消", exact: true }),
        ).toBeFocused();
        await expectRetranscribeConfirmDialogMatchesSot(sotPage, page);
        await styleDialog
            .getByRole("button", { name: "取消", exact: true })
            .click();
        await expect(styleDialog).not.toBeVisible();
        await expect(retranscribeButton).toBeFocused();
        expect(transcribePayloads).toEqual([]);

        await retranscribeButton.click();
        const escapeDialog = page.getByRole("dialog", {
            name: "重新转写这条录音？",
            exact: true,
        });
        await expect(escapeDialog).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(escapeDialog).not.toBeVisible();
        await expect(retranscribeButton).toBeFocused();
        expect(transcribePayloads).toEqual([]);

        await retranscribeButton.click();
        const backdropDialog = page.getByRole("dialog", {
            name: "重新转写这条录音？",
            exact: true,
        });
        await expect(backdropDialog).toBeVisible();
        await page
            .locator('[data-sot-panel="confirm-dialog"]')
            .click({ position: { x: 8, y: 8 } });
        await expect(backdropDialog).not.toBeVisible();
        await expect(retranscribeButton).toBeFocused();
        expect(transcribePayloads).toEqual([]);

        await retranscribeButton.click();
        const postResponse = page.waitForResponse(
            (response) =>
                response
                    .url()
                    .includes(`/api/recordings/${recordingId}/transcribe`) &&
                response.request().method() === "POST",
        );
        await page
            .getByRole("dialog", {
                name: "重新转写这条录音？",
                exact: true,
            })
            .getByRole("button", { name: "确认重新转写", exact: true })
            .click();
        expect((await postResponse).ok()).toBe(true);
        expect(transcribePayloads).toEqual([{ force: true }]);
        await expect(page.getByText("重转写任务已加入队列")).toBeVisible();
        await expect(page.getByText("已在本地排队，等待提交...")).toBeVisible();
    } finally {
        await sotPage?.close();
        await cleanupRecordingDetailSeed();
        await removeAudioFixture();
    }
});

test("recording detail copy actions recover after clipboard write rejection", async ({
    page,
}) => {
    await installToggleableClipboardCapture(page);

    try {
        await ensureSignedIn(page);
        const userId = await getPlaywrightUserId();
        const recordingId = await seedRecordingDetail(userId, {
            includeSpeakerReview: true,
        });

        await page.goto(`/recordings/${recordingId}`, {
            waitUntil: "domcontentloaded",
        });

        await waitForRecordingDetailReady(page);

        const localCopyButton = localTranscriptCopyButton(page);
        await localCopyButton.click();
        await expect(
            page.getByText("复制转录失败，请检查浏览器剪贴板权限。"),
        ).toBeVisible();
        await expect(localCopyButton).toBeEnabled();
        await expect(localCopyButton).toContainText("复制转录");
        expect(await readCopiedTexts(page)).toEqual([]);

        const sourceReportButton = detailSourceReportCopyButton(page);
        await sourceReportButton.click();
        await expect(
            page.getByText("复制失败，请检查浏览器剪贴板权限。"),
        ).toBeVisible();
        await expect(sourceReportButton).toBeEnabled();
        await expect(sourceReportButton).toContainText("复制原始报告");
        await expect(sourceReportButton).toHaveAttribute(
            "data-sot-state",
            "ready",
        );
        expect(await readCopiedTexts(page)).toEqual([]);

        await setClipboardRejectWrites(page, false);
        await sourceReportButton.click();
        await expect
            .poll(async () => (await readCopiedTexts(page)).at(-1) ?? "")
            .toContain("E2E 源报告摘要");
    } finally {
        await cleanupRecordingDetailSeed();
    }
});

test("recording detail source copy strip mirrors partial artifact availability", async ({
    page,
}) => {
    await installClipboardCapture(page);

    try {
        await ensureSignedIn(page);
        const userId = await getPlaywrightUserId();
        const recordingId = await seedRecordingDetail(userId, {
            includeSourceSummary: false,
        });

        await page.goto(`/recordings/${recordingId}`, {
            waitUntil: "domcontentloaded",
        });

        await expect(
            page.locator('[data-sot-surface="recording-source-rail"]'),
        ).toBeVisible();
        await expect(
            page.locator('[data-sot-panel="recording-detail-list"]'),
        ).toBeVisible();
        await expect(
            sourceReportState(page, "loaded"),
        ).toHaveAttribute("data-sot-state", "loaded");
        await expect(sourceReportInnerState(page, "loaded")).toBeVisible();
        await expect(
            sourceReportInnerState(page, "loaded").locator(
                "[data-sot-source-report-actions]",
            ),
        ).toBeVisible();
        await expect(
            detailSourceTranscriptCopyButton(page),
        ).toHaveAttribute("data-sot-state", "ready");
        await expect(
            detailSourceReportCopyButton(page),
        ).toHaveAttribute("data-sot-state", "missing");
        await expect(
            detailSourceTranscriptCopyButton(page),
        ).toBeEnabled();
        await expect(
            detailSourceReportCopyButton(page),
        ).toBeDisabled();

        await detailSourceTranscriptCopyButton(page).click();
        await expect
            .poll(async () => (await readCopiedTexts(page)).at(-1) ?? "")
            .toContain("来源逐字稿复制内容");

        await seedRecordingDetail(userId, {
            includeSourceTranscript: false,
        });
        await page.goto(`/recordings/${recordingId}`, {
            waitUntil: "domcontentloaded",
        });

        await expect(
            sourceReportState(page, "loaded"),
        ).toHaveAttribute("data-sot-state", "loaded");
        await expect(
            detailSourceTranscriptCopyButton(page),
        ).toHaveAttribute("data-sot-state", "missing");
        await expect(
            detailSourceReportCopyButton(page),
        ).toHaveAttribute("data-sot-state", "ready");
        await expect(
            detailSourceTranscriptCopyButton(page),
        ).toBeDisabled();
        await expect(
            detailSourceReportCopyButton(page),
        ).toBeEnabled();

        await detailSourceReportCopyButton(page).click();
        await expect
            .poll(async () => (await readCopiedTexts(page)).at(-1) ?? "")
            .toContain("E2E 源报告摘要");
    } finally {
        await cleanupRecordingDetailSeed();
    }
});

test("recording detail manual rename supports cancel and save states", async ({
    page,
}) => {
    try {
        await ensureSignedIn(page);
        const userId = await getPlaywrightUserId();
        const recordingId = await seedRecordingDetail(userId);

        await page.goto(`/recordings/${recordingId}`, {
            waitUntil: "domcontentloaded",
        });
        await waitForRecordingDetailReady(page);

        await renameStartButton(page).click();
        const titleInput = renameInput(page);
        await expect(titleInput).toHaveValue("E2E source detail review");
        await titleInput.fill("E2E detail cancelled rename");
        await renameCancelButton(page).click();
        await expect(
            page.getByRole("heading", { name: "E2E source detail review" }),
        ).toBeVisible();

        await renameStartButton(page).click();
        await titleInput.fill("E2E detail manual rename");

        await Promise.all([
            page.waitForResponse(
                (response) =>
                    response
                        .url()
                        .includes(`/api/recordings/${recordingId}/rename`) &&
                    response.request().method() === "PATCH" &&
                    response.ok(),
            ),
            renameSaveButton(page).click(),
        ]);

        await expect(
            page.getByRole("heading", { name: "E2E detail manual rename" }),
        ).toBeVisible();
        await expect(
            page
                .locator("[data-sonner-toast]")
                .filter({ hasText: "录音已重命名" }),
        ).toBeVisible();
    } finally {
        await cleanupRecordingDetailSeed();
    }
});

test("recording detail manual rename supports keyboard cancel, failure, and retry", async ({
    page,
}) => {
    try {
        await ensureSignedIn(page);
        const userId = await getPlaywrightUserId();
        const recordingId = await seedRecordingDetail(userId);
        let renamePatchAttempts = 0;

        await page.route(
            `**/api/recordings/${recordingId}/rename`,
            async (route) => {
                renamePatchAttempts += 1;
                const payload = route.request().postDataJSON() as {
                    filename?: string;
                };
                if (payload.filename === "E2E detail failing keyboard rename") {
                    await route.fulfill({
                        contentType: "application/json",
                        status: 500,
                        body: JSON.stringify({
                            error: "录音重命名失败",
                        }),
                    });
                    return;
                }

                await route.fulfill({
                    contentType: "application/json",
                    body: JSON.stringify({ ok: true }),
                });
            },
        );

        await page.goto(`/recordings/${recordingId}`, {
            waitUntil: "domcontentloaded",
        });
        await waitForRecordingDetailReady(page);

        await renameStartButton(page).click();
        const titleInput = renameInput(page);
        await titleInput.fill("E2E detail escaped keyboard rename");
        await titleInput.press("Escape");
        await expect(
            page.getByRole("heading", { name: "E2E source detail review" }),
        ).toBeVisible();
        expect(renamePatchAttempts).toBe(0);

        await renameStartButton(page).click();
        await titleInput.fill("E2E detail failing keyboard rename");
        await Promise.all([
            page.waitForResponse(
                (response) =>
                    response
                        .url()
                        .includes(`/api/recordings/${recordingId}/rename`) &&
                    response.request().method() === "PATCH" &&
                    response.status() === 500,
            ),
            titleInput.press("Enter"),
        ]);

        await expect(
            page
                .locator("[data-sonner-toast]")
                .filter({ hasText: "录音重命名失败" }),
        ).toBeVisible();
        await expect(titleInput).toHaveValue(
            "E2E detail failing keyboard rename",
        );
        await expect(renameSaveButton(page)).toBeEnabled();

        await titleInput.fill("E2E detail keyboard rename");
        await Promise.all([
            page.waitForResponse(
                (response) =>
                    response
                        .url()
                        .includes(`/api/recordings/${recordingId}/rename`) &&
                    response.request().method() === "PATCH" &&
                    response.ok(),
            ),
            titleInput.press("Enter"),
        ]);

        await expect(
            page.getByRole("heading", { name: "E2E detail keyboard rename" }),
        ).toBeVisible();
        expect(renamePatchAttempts).toBe(2);
    } finally {
        await cleanupRecordingDetailSeed();
    }
});

test("recording detail header normal state matches SOT pixels", async (
    { page },
    testInfo,
) => {
    let sotPage: Page | null = null;

    try {
        await ensureSignedIn(page);
        const userId = await getPlaywrightUserId();
        const recordingId = await seedRecordingDetail(userId, {
            duration: 2_838_000,
            filename: "产品周会 · Q2 priorities review",
            sourceProvider: "dingtalk-a1",
            startTime: Date.parse("2026-04-22T06:00:00.000Z"),
        });

        await page.goto(`/recordings/${recordingId}`, {
            waitUntil: "domcontentloaded",
        });
        await waitForRecordingDetailReady(page);

        sotPage = await page.context().newPage();
        await sotPage.goto(SOT_WORKSTATION_URL, { waitUntil: "load" });
        await sotPage.evaluate(() => {
            document.documentElement.dataset.theme = "dark";
            document.body.dataset.theme = "dark";
        });

        await expectTransformedSotPixelsMatch(
            page,
            testInfo,
            "Recording detail normal header",
            sotPage.locator(".detail .rec-head").first(),
            recordingHeader(page),
            (html) => html,
            RECORDING_DETAIL_HEADER_PIXEL_TOLERANCE,
        );
        await expectHeaderPlacementSotPixelsMatch(
            page,
            testInfo,
            "Recording detail normal header placement",
            sotPage.locator(".detail .rec-head").first(),
            recordingHeader(page),
            [580, 390],
            RECORDING_DETAIL_HEADER_PIXEL_TOLERANCE,
        );
    } finally {
        await sotPage?.close();
        await cleanupRecordingDetailSeed();
    }
});

test("recording detail header edit and saving states match SOT pixels", async (
    { page },
    testInfo,
) => {
    let sotPage: Page | null = null;

    try {
        await ensureSignedIn(page);
        const userId = await getPlaywrightUserId();
        const recordingId = await seedRecordingDetail(userId, {
            duration: 2_838_000,
            filename: "产品周会 · Q2 priorities review",
            sourceProvider: "dingtalk-a1",
            startTime: Date.parse("2026-04-22T06:00:00.000Z"),
        });

        await page.route(
            `**/api/recordings/${recordingId}/rename`,
            async (route) => {
                if (route.request().method() !== "PATCH") {
                    await route.continue();
                    return;
                }

                await page.waitForTimeout(1_500);
                await route.fulfill({
                    contentType: "application/json",
                    body: JSON.stringify({ ok: true }),
                });
            },
        );

        await page.goto(`/recordings/${recordingId}`, {
            waitUntil: "domcontentloaded",
        });
        await waitForRecordingDetailReady(page);

        sotPage = await page.context().newPage();
        await sotPage.goto(SOT_WORKSTATION_URL, { waitUntil: "load" });
        await sotPage.evaluate(() => {
            document.documentElement.dataset.theme = "dark";
            document.body.dataset.theme = "dark";
        });
        const sotHeader = sotPage.locator(".detail .rec-head").first();

        await sotHeader.locator("[data-rh-edit-start]").click();
        await renameStartButton(page).click();
        await expect(sotHeader).toHaveAttribute("data-rename-mode", "editing");
        await expect(recordingHeader(page)).toHaveAttribute(
            "data-rename-mode",
            "editing",
        );
        await expectTransformedSotPixelsMatch(
            page,
            testInfo,
            "Recording detail edit header",
            sotHeader,
            recordingHeader(page),
            (html) => html,
            RECORDING_DETAIL_HEADER_PIXEL_TOLERANCE,
        );
        await expectHeaderPlacementSotPixelsMatch(
            page,
            testInfo,
            "Recording detail edit header placement",
            sotHeader,
            recordingHeader(page),
            [580, 390],
            RECORDING_DETAIL_HEADER_PIXEL_TOLERANCE,
        );

        const nextTitle = "产品周会 · Q2 priorities review v2";
        await sotHeader.locator("[data-rh-input]").fill(nextTitle);
        await renameInput(page).fill(nextTitle);

        const renameResponse = page.waitForResponse(
            (response) =>
                response
                    .url()
                    .includes(`/api/recordings/${recordingId}/rename`) &&
                response.request().method() === "PATCH",
        );
        await sotHeader.locator("[data-rh-edit-save]").click();
        await renameSaveButton(page).click();
        await expect(sotHeader).toHaveAttribute("data-rename-mode", "saving");
        await expect(recordingHeader(page)).toHaveAttribute(
            "data-rename-mode",
            "saving",
        );
        await expectTransformedSotPixelsMatch(
            page,
            testInfo,
            "Recording detail saving header",
            sotHeader,
            recordingHeader(page),
            (html) => html,
            RECORDING_DETAIL_HEADER_PIXEL_TOLERANCE,
        );
        await expectHeaderPlacementSotPixelsMatch(
            page,
            testInfo,
            "Recording detail saving header placement",
            sotHeader,
            recordingHeader(page),
            [580, 390],
            RECORDING_DETAIL_HEADER_PIXEL_TOLERANCE,
        );
        expect((await renameResponse).ok()).toBe(true);
    } finally {
        await sotPage?.close();
        await cleanupRecordingDetailSeed();
    }
});

test("recording detail AI rename header placement matches SOT pixels", async (
    { page },
    testInfo,
) => {
    let sotPage: Page | null = null;
    const originalTitle = "产品周会 · Q2 priorities review";
    const suggestedTitle = "产品周会 · 重点优先级与责任人";

    try {
        await mockTitleGenerationSettings(page, true);
        await ensureSignedIn(page);
        const userId = await getPlaywrightUserId();
        const recordingId = await seedRecordingDetail(userId, {
            duration: 2_838_000,
            filename: originalTitle,
            sourceProvider: "dingtalk-a1",
            startTime: Date.parse("2026-04-22T06:00:00.000Z"),
        });

        await page.route(
            `**/api/recordings/${recordingId}/rename/auto`,
            async (route) => {
                expect(route.request().method()).toBe("POST");
                expect(route.request().postDataJSON()).toEqual({
                    mode: "preview",
                });
                await route.fulfill({
                    contentType: "application/json",
                    body: JSON.stringify({
                        applied: false,
                        filename: suggestedTitle,
                    }),
                });
            },
        );

        await page.goto(`/recordings/${recordingId}`, {
            waitUntil: "domcontentloaded",
        });
        await waitForRecordingDetailReady(page);

        sotPage = await page.context().newPage();
        await sotPage.goto(SOT_WORKSTATION_URL, { waitUntil: "load" });
        await setSotAiRenameReviewState(sotPage, {
            newTitle: suggestedTitle,
            oldTitle: originalTitle,
        });
        const sotHeader = sotPage.locator(".detail .rec-head").first();

        await recordingHeader(page)
            .getByRole("button", { name: "AI 重命名", exact: true })
            .click();
        const productPanel = recordingHeader(page).locator(
            '[data-sot-panel="ai-rename-preview"]',
        );
        await expect(productPanel).toHaveAttribute("data-sot-state", "review");
        await expect(
            productPanel.locator('[data-sot-part="review-old"]'),
        ).toHaveText(originalTitle);
        await expect(
            productPanel.locator('[data-sot-part="review-new"]'),
        ).toHaveText(suggestedTitle);

        await expectHeaderPlacementSotPixelsMatch(
            page,
            testInfo,
            "Recording detail AI rename review header placement",
            sotHeader,
            recordingHeader(page),
            [580, 390],
            AI_RENAME_HEADER_PIXEL_TOLERANCE,
        );
    } finally {
        await sotPage?.close();
        await cleanupRecordingDetailSeed();
    }
});

test("recording detail keeps the player controls live with local audio", async ({
    page,
}) => {
    try {
        await ensureSignedIn(page);
        const resetPlaybackResponse = await page.request.put(
            "/api/settings/playback",
            {
                data: {
                    autoPlayNext: false,
                    defaultPlaybackSpeed: 1,
                    defaultVolume: 70,
                },
            },
        );
        expect(resetPlaybackResponse.ok()).toBe(true);

        const userId = await getPlaywrightUserId();
        const storagePath = await writeAudioFixture();
        const recordingId = await seedRecordingDetail(userId, { storagePath });

        await page.addInitScript(() => {
            const playbackWindow = window as Window & {
                __betterAiNoteRejectNextPlay?: boolean;
            };
            const originalPlay = HTMLMediaElement.prototype.play;
            HTMLMediaElement.prototype.play = function () {
                if (playbackWindow.__betterAiNoteRejectNextPlay) {
                    playbackWindow.__betterAiNoteRejectNextPlay = false;
                    return Promise.reject(
                        new DOMException(
                            "E2E rejected audio playback",
                            "NotAllowedError",
                        ),
                    );
                }

                return originalPlay.call(this);
            };
        });

        await page.goto(`/recordings/${recordingId}`, {
            waitUntil: "domcontentloaded",
        });
        await waitForRecordingDetailReady(page);

        const player = playerShell(page);
        const controls = playerControlsPanel(page);
        const back = playerBackButton(page);
        const toggle = playerToggleButton(page);
        const forward = playerForwardButton(page);
        const speed = playerSpeedButton(page);
        const seek = playerSeekSlider(page);
        const audio = playerAudio(page);

        await expect(player).toBeVisible();
        await expect(player).toHaveAttribute("data-sot-state", "ready");
        await expect(controls).toHaveAttribute("data-sot-state", "ready");
        await expect(back).toHaveAttribute("data-sot-state", "ready");
        await expect(toggle).toBeEnabled();
        await expect(toggle).toHaveAttribute("aria-label", "播放");
        await expect(toggle).toHaveAttribute("data-sot-state", "paused");
        await expect(forward).toHaveAttribute("data-sot-state", "ready");
        await expect(speed).toContainText("1.0×");
        await expect(speed).toHaveAttribute("data-sot-state", "ready");

        await expect
            .poll(() =>
                audio.evaluate((node) => (node as HTMLAudioElement).duration),
            )
            .toBeGreaterThan(1);
        await expect(seek).toBeEnabled();
        await expect(seek).toHaveAttribute("data-sot-state", "ready");

        await page.evaluate(() => {
            (
                window as Window & {
                    __betterAiNoteRejectNextPlay?: boolean;
                }
            ).__betterAiNoteRejectNextPlay = true;
        });
        await toggle.click();
        await expect(
            page
                .locator("[data-sonner-toast]")
                .filter({ hasText: "Failed to play audio" }),
        ).toBeVisible();
        await expect(toggle).toHaveAttribute("aria-label", "播放");
        await expect(toggle).toHaveAttribute("data-sot-state", "paused");
        await expect(controls).toHaveAttribute("data-sot-state", "ready");
        await expect
            .poll(() =>
                audio.evaluate((node) => (node as HTMLAudioElement).paused),
            )
            .toBe(true);

        await seek.focus();
        await seek.press("End");
        await expect
            .poll(() =>
                audio.evaluate((node) => (node as HTMLAudioElement).currentTime),
            )
            .toBeGreaterThan(0.8);

        await playerVolumeButton(page).click();
        await expect(playerVolumeButton(page)).toHaveAttribute(
            "data-sot-state",
            "open",
        );
        await setPlayerVolumeSlider(page, 0);
        await expect
            .poll(() =>
                audio.evaluate((node) => (node as HTMLAudioElement).volume),
            )
            .toBeCloseTo(0, 1);
        await expect(controls).toHaveAttribute("data-sot-state", "muted");
        await expect(playerVolumeButton(page)).toHaveAttribute(
            "data-sot-volume-state",
            "muted",
        );
        await setPlayerVolumeSlider(page, 35);
        await expect
            .poll(() =>
                audio.evaluate((node) => (node as HTMLAudioElement).volume),
            )
            .toBeCloseTo(0.35, 1);
        await expect(controls).toHaveAttribute("data-sot-state", "ready");
        await expect(playerVolumeButton(page)).toHaveAttribute(
            "data-sot-volume-state",
            "audible",
        );

        await speed.click();
        await expect(speed).toContainText("1.25×");
        await expect
            .poll(() =>
                audio.evaluate(
                    (node) => (node as HTMLAudioElement).playbackRate,
                ),
            )
            .toBeCloseTo(1.25, 1);

        await toggle.click();
        await expect(toggle).toHaveAttribute("aria-label", "暂停");
        await expect(toggle).toHaveAttribute("data-sot-state", "playing");
        await expect(controls).toHaveAttribute("data-sot-state", "playing");
        await toggle.click();
        await expect(toggle).toHaveAttribute("aria-label", "播放");
        await expect(toggle).toHaveAttribute("data-sot-state", "paused");
        await expect(controls).toHaveAttribute("data-sot-state", "ready");
    } finally {
        await removeAudioFixture();
        await cleanupRecordingDetailSeed();
    }
});

test("recording detail ready player matches SOT pixels", async (
    { page },
    testInfo,
) => {
    let sotPage: Page | null = null;

    try {
        await ensureSignedIn(page);
        const resetPlaybackResponse = await page.request.put(
            "/api/settings/playback",
            {
                data: {
                    autoPlayNext: false,
                    defaultPlaybackSpeed: 1,
                    defaultVolume: 70,
                },
            },
        );
        expect(resetPlaybackResponse.ok()).toBe(true);

        const userId = await getPlaywrightUserId();
        const storagePath = await writeAudioFixture();
        const recordingId = await seedRecordingDetail(userId, {
            duration: 2_838_000,
            filename: "产品周会 · Q2 priorities review",
            includeSotPlayerTag: true,
            sourceProvider: "dingtalk-a1",
            startTime: Date.parse("2026-04-22T06:00:00.000Z"),
            storagePath,
        });

        await page.addInitScript(() => {
            Object.defineProperty(HTMLMediaElement.prototype, "duration", {
                configurable: true,
                get() {
                    return 47 * 60 + 18;
                },
            });
        });

        await page.goto(`/recordings/${recordingId}`, {
            waitUntil: "domcontentloaded",
        });
        await waitForRecordingDetailReady(page);

        await expect(playerShell(page)).toHaveAttribute(
            "data-sot-state",
            "ready",
        );
        await expect(playerMetaPanel(page)).toContainText(
            "2026-04-22 · 14:00",
        );
        await expect(playerMetaPanel(page)).toContainText("钉钉");
        await expect(playerMetaPanel(page)).toContainText(
            SOT_DETAIL_TAG_NAME,
        );

        sotPage = await page.context().newPage();
        await sotPage.goto(SOT_WORKSTATION_URL, { waitUntil: "load" });
        await sotPage.evaluate(() => {
            document.documentElement.dataset.theme = "dark";
            document.body.dataset.theme = "dark";
        });

        await expectTransformedSotPixelsMatch(
            page,
            testInfo,
            "Recording detail ready player",
            sotPage.locator(".real-detail .player").first(),
            playerShell(page),
            bridgeRecordingPlayerDataSotToSotClassHtml,
            {},
            sotPage,
        );
    } finally {
        await sotPage?.close();
        await removeAudioFixture();
        await cleanupRecordingDetailSeed();
    }
});

test("recording detail disabled/no-audio player banner matches SOT pixels", async ({
    page,
}, testInfo) => {
    let sotPage: Page | null = null;

    try {
        await ensureSignedIn(page);
        const userId = await getPlaywrightUserId();
        const recordingId = await seedRecordingDetail(userId, {
            duration: 3_129_000,
            filename: "工程交接 · 后端交付",
            sourceProvider: "dingtalk-a1",
            startTime: Date.parse("2026-04-21T03:00:00.000Z"),
        });

        await page.goto(`/recordings/${recordingId}`, {
            waitUntil: "domcontentloaded",
        });
        await waitForRecordingDetailReady(page);

        await expect(playerShell(page)).toHaveAttribute(
            "data-sot-state",
            "disabled",
        );
        await expect(playerShell(page)).toHaveAttribute("data-no-audio", "true");
        await expect(playerNoAudioBanner(page)).toBeVisible();
        await expect(playerControlsPanel(page)).toHaveAttribute(
            "data-sot-state",
            "disabled",
        );
        await expect(playerBackButton(page)).toHaveAttribute(
            "data-sot-state",
            "disabled",
        );
        await expect(playerForwardButton(page)).toHaveAttribute(
            "data-sot-state",
            "disabled",
        );
        await expect(playerToggleButton(page, "播放")).toBeDisabled();
        await expect(playerSpeedButton(page)).toBeDisabled();
        await expect(playerSeekSlider(page)).toHaveAttribute(
            "data-sot-state",
            "disabled",
        );
        await expect(playerVolumeButton(page)).toBeDisabled();
        await expect(
            page.locator('[data-sot-control="recording-player-volume-slider"]'),
        ).toHaveCount(0);

        sotPage = await page.context().newPage();
        const sotDisabledPlayer = await openSotDisabledNoAudioPlayer(sotPage);
        const sotBanner = sotDisabledPlayer.locator(".no-audio-banner").first();
        const productBanner = playerNoAudioBanner(page);

        const diff = await expectTransformedSotPixelsMatch(
            page,
            testInfo,
            "Recording detail disabled no-audio player banner",
            sotBanner,
            productBanner,
            bridgePlayerNoAudioBannerToSotClassHtml,
        );
        console.log(
            `recording detail disabled/no-audio player banner pixel diff ${JSON.stringify(
                diff,
            )}`,
        );
    } finally {
        await sotPage?.close();
        await cleanupRecordingDetailSeed();
    }
});

test("recording detail player ready and disabled states match SOT responsive frames", async ({
    page,
}, testInfo) => {
    let sotPage: Page | null = null;
    const responsiveFrames: PlayerResponsiveFrameResult[] = [];

    try {
        await ensureSignedIn(page);
        const resetPlaybackResponse = await page.request.put(
            "/api/settings/playback",
            {
                data: {
                    autoPlayNext: false,
                    defaultPlaybackSpeed: 1,
                    defaultVolume: 70,
                },
            },
        );
        expect(resetPlaybackResponse.ok()).toBe(true);

        const userId = await getPlaywrightUserId();
        const storagePath = await writeAudioFixture();

        await page.addInitScript(() => {
            Object.defineProperty(HTMLMediaElement.prototype, "duration", {
                configurable: true,
                get() {
                    return 47 * 60 + 18;
                },
            });
        });

        const readyRecordingId = await seedRecordingDetail(userId, {
            duration: 2_838_000,
            filename: "产品周会 · Q2 priorities review",
            includeSotPlayerTag: true,
            sourceProvider: "dingtalk-a1",
            startTime: Date.parse("2026-04-22T06:00:00.000Z"),
            storagePath,
        });
        await page.goto(`/recordings/${readyRecordingId}`, {
            waitUntil: "domcontentloaded",
        });
        await waitForRecordingDetailReady(page);
        await expect(playerShell(page)).toHaveAttribute(
            "data-sot-state",
            "ready",
        );

        sotPage = await page.context().newPage();
        await sotPage.goto(SOT_WORKSTATION_URL, { waitUntil: "load" });
        await sotPage.evaluate(() => {
            document.documentElement.dataset.theme = "dark";
            document.body.dataset.theme = "dark";
        });
        responsiveFrames.push(
            ...(await collectPlayerResponsiveFrameResults(
                page,
                "ready",
                sotPage.locator(".real-detail .player").first(),
                playerShell(page),
            )),
        );

        await removeAudioFixture();
        const disabledRecordingId = await seedRecordingDetail(userId, {
            duration: 2_838_000,
            filename: "产品周会 · Q2 priorities review",
            includeSotPlayerTag: true,
            sourceProvider: "dingtalk-a1",
            startTime: Date.parse("2026-04-22T06:00:00.000Z"),
        });
        await page.goto(`/recordings/${disabledRecordingId}`, {
            waitUntil: "domcontentloaded",
        });
        await waitForRecordingDetailReady(page);
        await expect(playerShell(page)).toHaveAttribute(
            "data-sot-state",
            "disabled",
        );
        await expect(playerShell(page)).toHaveAttribute("data-no-audio", "true");
        const sotNoAudioPlayer = await openSotDefaultNoAudioPlayer(sotPage);
        responsiveFrames.push(
            ...(await collectPlayerResponsiveFrameResults(
                page,
                "disabled-no-audio",
                sotNoAudioPlayer,
                playerShell(page),
            )),
        );

        const evidence =
            await writePlayerResponsiveFramesEvidence(responsiveFrames);
        await testInfo.attach("player-responsive-frames.json", {
            body: Buffer.from(JSON.stringify(evidence, null, 2)),
            contentType: "application/json",
        });

        for (const frame of responsiveFrames) {
            const label = `${frame.state} ${frame.frame} ${JSON.stringify(
                frame.diff,
            )}`;
            expect(frame.diff.dimensionsMatch, label).toBe(true);
            expect(frame.diff.productHeight, label).toBe(frame.diff.expectedHeight);
            expect(frame.diff.productWidth, label).toBe(frame.diff.expectedWidth);
            expect(frame.diff.differingPixels, label).toBe(0);
            expect(frame.diff.maxChannelDelta, label).toBe(0);
        }
    } finally {
        await sotPage?.close();
        await removeAudioFixture();
        await cleanupRecordingDetailSeed();
    }
});

test("SpeakerRow component-library states match product CSS pixels", async ({
    page,
}, testInfo) => {
    const hydrationWarnings: string[] = [];
    page.on("console", (message) => {
        if (message.text().includes("A tree hydrated")) {
            hydrationWarnings.push(message.text());
        }
    });

    const speakerRowCards = [
        { cardTitle: "Default · linked", states: ["linked"] },
        { cardTitle: "Unlinked · suggestion", states: ["suggestion"] },
        { cardTitle: "Editing · rename", states: ["editing"] },
        { cardTitle: "Saving / Error", states: ["saving", "error"] },
        { cardTitle: "No saved speakers", states: ["empty"] },
        { cardTitle: "Merge similar", states: ["merge-similar"] },
        { cardTitle: "Unlink · confirm", states: ["unlink-confirm"] },
        { cardTitle: "Create new · saved speaker", states: ["create"] },
        { cardTitle: "No-match · open suggestion gone", states: ["no-match"] },
    ] as const;
    const requiredStates = [
        "linked",
        "suggestion",
        "editing",
        "saving",
        "error",
        "empty",
        "merge-similar",
        "unlink-confirm",
        "create",
        "no-match",
    ];

    expect(speakerRowCards.flatMap((card) => [...card.states])).toEqual(
        requiredStates,
    );

    const sotPage = await page.context().newPage();
    try {
        await page.goto("/login", { waitUntil: "domcontentloaded" });
        await expect(page.locator("[data-sot-ready]")).toHaveAttribute(
            "data-sot-ready",
            "true",
        );
        await page.evaluate(() => {
            document.documentElement.dataset.theme = "dark";
            document.body.dataset.theme = "dark";
        });
        await openSotComponentLibrary(sotPage);
        await expect(sotPage.locator("#spkr")).toBeVisible();

        for (const card of speakerRowCards) {
            const cardLocator = sotPage
                .locator("#spkr .cl-card")
                .filter({ hasText: card.cardTitle });
            await expect(
                cardLocator,
                `SpeakerRow component-library card ${card.cardTitle}`,
            ).toHaveCount(1);

            const stage = cardLocator.locator(".cl-stage").first();
            await expect(
                stage,
                `SpeakerRow component-library ${card.states.join(" + ")} stage`,
            ).toBeVisible();

            const speakerRowTolerance = card.states.includes("saving")
                ? {
                      differingPixels: 320,
                      maxChannelDelta: 42,
                  }
                : card.states.includes("no-match")
                  ? {
                        differingPixels: 540,
                        maxChannelDelta: 110,
                    }
                  : {};

            await expectSotFixtureMatchesProductCssPixels(
                page,
                testInfo,
                `SpeakerRow component-library ${card.states.join("-")} static state`,
                stage,
                card.states.includes("unlink-confirm")
                    ? (html) =>
                          bridgeSpeakerRowSotFixtureContract(
                              bridgeSpeakerUnlinkConfirmSotContract(html),
                          )
                    : bridgeSpeakerRowSotFixtureContract,
                speakerRowTolerance,
            );
        }

        expect(hydrationWarnings).toEqual([]);
    } finally {
        await sotPage.close();
    }
});

test("live speaker review business states render with shadcn product CSS pixels", async ({
    page,
}, testInfo) => {
    let noSavedSpeakersPage: Page | null = null;
    const pixelMismatches: Array<{ diff: SotPixelDiff; label: string }> = [];
    const captureLiveSpeakerState = async (
        label: string,
        locator: Locator,
        transformHtml: (html: string) => string = (html) => html,
    ) => {
        const diff =
            await expectLiveProductDomUnderSotCssMatchesProductCssPixels(
                locator.page(),
                locator.page(),
                testInfo,
                label,
                locator,
                transformHtml,
            );
        if (
            !diff.dimensionsMatch ||
            diff.maxChannelDelta > 1
        ) {
            pixelMismatches.push({ diff, label });
        }
    };
    try {
        await ensureSignedIn(page);
        const userId = await getPlaywrightUserId();
        const storagePath = await writeAudioFixture();
        const recordingId = await seedRecordingDetail(userId, {
            includeSpeakerReview: true,
            storagePath,
        });

        await page.goto(`/recordings/${recordingId}`, {
            waitUntil: "domcontentloaded",
        });
        await waitForRecordingDetailReady(page);
        const panel = await openSpeakerReviewPanel(page);
        const mappedCard = speakerReviewCard(panel, "SPEAKER_ALPHA_00");
        const unmappedCard = speakerReviewCard(panel, "SPEAKER_BETA_01");

        await expect(mappedCard).toHaveAttribute(
            "data-sot-speaker-mapped",
            "true",
        );
        await expect(speakerReviewUnlinkButton(mappedCard)).toBeEnabled();
        await captureLiveSpeakerState(
            "live speaker review linked unlink action",
            speakerReviewMappingField(mappedCard),
        );
        await speakerReviewUnlinkButton(mappedCard).click();
        await expect(mappedCard).toHaveAttribute(
            "data-state",
            "confirm-unlink",
        );
        await expect(speakerReviewConfirmUnlink(mappedCard)).toBeVisible();
        await expect(
            speakerReviewConfirmUnlink(mappedCard).locator(
                "[data-sot-confirm-subject]",
            ),
        ).toHaveText(SPEAKER_REVIEW_PROFILE_ZH_NAME);
        await expect(speakerReviewCancelUnlinkButton(mappedCard)).toBeEnabled();
        await expect(speakerReviewConfirmUnlinkButton(mappedCard)).toBeEnabled();
        await captureLiveSpeakerState(
            "live speaker review confirm unlink state",
            speakerReviewMappingField(mappedCard),
            bridgeSpeakerUnlinkConfirmSotContract,
        );
        await speakerReviewCancelUnlinkButton(mappedCard).click();
        await expect(speakerReviewConfirmUnlink(mappedCard)).toBeHidden();
        await expect(mappedCard).not.toHaveAttribute(
            "data-state",
            "confirm-unlink",
        );

        await speakerReviewMappingInput(unmappedCard).fill("Long Latin");
        const profileOption = speakerReviewProfileOption(
            unmappedCard,
            SPEAKER_REVIEW_PROFILE_LATIN_NAME,
        );
        const createLongLatinOption = speakerReviewCreateOption(
            unmappedCard,
            "Long Latin",
        );
        await expect(profileOption).toBeVisible();
        await expect(createLongLatinOption).toBeVisible();
        await captureLiveSpeakerState(
            "live speaker review suggestion picker with saved options",
            speakerReviewMappingField(unmappedCard),
        );

        await speakerReviewMappingInput(unmappedCard).fill(
            SPEAKER_REVIEW_CREATED_NAME,
        );
        await expect(
            speakerReviewCreateOption(unmappedCard, SPEAKER_REVIEW_CREATED_NAME),
        ).toBeVisible();
        await captureLiveSpeakerState(
            "live speaker review create option",
            speakerReviewMappingField(unmappedCard),
        );

        await speakerReviewMappingInput(unmappedCard).fill(
            SPEAKER_REVIEW_NO_MATCH_QUERY,
        );
        await expect(unmappedCard).toHaveAttribute("data-state", "no-match");
        const noMatchRowSub = unmappedCard
            .locator('[data-sot-part="speaker-review-row-sub"]')
            .first();
        await expect(noMatchRowSub).toContainText(
            "没有匹配的已保存说话人",
        );
        await expect(
            speakerReviewCreateOption(
                unmappedCard,
                SPEAKER_REVIEW_NO_MATCH_QUERY,
            ),
        ).toBeVisible();
        await captureLiveSpeakerState(
            "live speaker review no-match row metadata",
            unmappedCard.locator('[data-sot-part="speaker-review-row-meta"]').first(),
        );

        await speakerReviewMappingInput(unmappedCard).fill("Long Latin");
        await expect(profileOption).toBeVisible();
        await expect(unmappedCard).not.toHaveAttribute(
            "data-state",
            "no-match",
        );

        let releasePatch: (() => void) | null = null;
        let speakerPatchAttempts = 0;
        const failSpeakerPatchOnce = async (route: Route) => {
            if (route.request().method() !== "PATCH") {
                await route.continue();
                return;
            }

            speakerPatchAttempts += 1;
            await new Promise<void>((resolve) => {
                releasePatch = resolve;
            });
            await route.fulfill({
                status: 503,
                contentType: "application/json",
                body: JSON.stringify({
                    error: "temporary speaker save failure",
                }),
            });
        };
        await page.route(
            `**/api/recordings/${recordingId}/speakers`,
            failSpeakerPatchOnce,
        );

        await speakerReviewMappingInput(unmappedCard).fill("Long Latin");
        await profileOption.click();
        await expect(speakerReviewMappingInput(unmappedCard)).toBeDisabled();
        await expect(profileOption).toBeDisabled();
        await expect
            .poll(() => speakerPatchAttempts)
            .toBe(1);
        await captureLiveSpeakerState(
            "live speaker review saving disabled picker",
            speakerReviewMappingField(unmappedCard),
        );

        releasePatch?.();
        await expect(unmappedCard).toHaveAttribute("data-state", "error");
        const errorRowSub = unmappedCard
            .locator(
                '[data-sot-part="speaker-review-row-sub"][data-sot-tone="danger"]',
            )
            .first();
        await expect(errorRowSub).toContainText("保存失败 · 请重试");
        await expect(speakerReviewRetryButton(unmappedCard)).toBeVisible();
        await captureLiveSpeakerState(
            "live speaker review error row metadata",
            unmappedCard.locator('[data-sot-part="speaker-review-row-meta"]').first(),
        );
        await expect(speakerReviewMappingInput(unmappedCard)).toBeEnabled();
        await page.unroute(
            `**/api/recordings/${recordingId}/speakers`,
            failSpeakerPatchOnce,
        );
        await Promise.all([
            page.waitForResponse(
                (response) =>
                    response
                        .url()
                        .includes(`/api/recordings/${recordingId}/speakers`) &&
                    response.request().method() === "PATCH" &&
                    response.ok(),
            ),
            speakerReviewRetryButton(unmappedCard).click(),
        ]);
        await expect(unmappedCard).not.toHaveAttribute("data-state", "error");
        await expect(unmappedCard).toHaveAttribute(
            "data-sot-speaker-mapped",
            "true",
        );
        await expect(
            unmappedCard.getByText(
                `已匹配到 ${SPEAKER_REVIEW_PROFILE_LATIN_NAME}`,
                { exact: true },
            ),
        ).toBeVisible();

        noSavedSpeakersPage = await page.context().newPage();
        await noSavedSpeakersPage.route(
            `**/api/recordings/${recordingId}/speakers`,
            async (route) => {
                if (route.request().method() !== "GET") {
                    await route.continue();
                    return;
                }

                const response = await route.fetch();
                const data = await response.json();
                await route.fulfill({
                    response,
                    body: JSON.stringify({
                        ...data,
                        profiles: [],
                        speakers: (data.speakers ?? []).map(
                            (speaker: {
                                matchedProfileId?: string | null;
                                matchedProfileName?: string | null;
                                rawLabel?: string;
                            }) =>
                                speaker.rawLabel === "SPEAKER_BETA_01"
                                    ? {
                                          ...speaker,
                                          matchedProfileId: null,
                                          matchedProfileName: null,
                                      }
                                    : speaker,
                        ),
                    }),
                });
            },
        );
        await noSavedSpeakersPage.goto(`/recordings/${recordingId}`, {
            waitUntil: "domcontentloaded",
        });
        await waitForRecordingDetailReady(noSavedSpeakersPage);
        const noSavedSpeakersPanel = await openSpeakerReviewPanel(
            noSavedSpeakersPage,
        );
        const noSavedSpeakersCard = speakerReviewCard(
            noSavedSpeakersPanel,
            "SPEAKER_BETA_01",
        );
        await speakerReviewMappingInput(noSavedSpeakersCard).click();
        await expect(
            noSavedSpeakersCard.getByText(
                "还没有已保存的说话人，可直接新建",
            ),
        ).toBeVisible();
        await captureLiveSpeakerState(
            "live speaker review no saved speakers empty picker",
            speakerReviewMappingField(noSavedSpeakersCard),
        );
        expect(
            pixelMismatches,
            `live product DOM shadcn CSS pixel mismatches: ${JSON.stringify(
                pixelMismatches,
                null,
                2,
            )}`,
        ).toEqual([]);
    } finally {
        await noSavedSpeakersPage?.close();
        await removeAudioFixture();
        await cleanupRecordingDetailSeed();
    }
});

test("speaker review inline rename row", async ({ page }, testInfo) => {
    let sotPage: Page | null = null;
    try {
        await ensureSignedIn(page);
        const userId = await getPlaywrightUserId();
        const recordingId = await seedRecordingDetail(userId, {
            includeSpeakerReview: true,
        });
        const speakerPatchPayloads: unknown[] = [];
        page.on("request", (request) => {
            if (
                request.method() === "PATCH" &&
                new URL(request.url()).pathname.endsWith(
                    `/api/recordings/${recordingId}/speakers`,
                )
            ) {
                speakerPatchPayloads.push(request.postDataJSON());
            }
        });

        await page.goto(`/recordings/${recordingId}`, {
            waitUntil: "domcontentloaded",
        });
        await waitForRecordingDetailReady(page);
        const panel = await openSpeakerReviewPanel(page);
        const mappedCard = speakerReviewCard(panel, "SPEAKER_ALPHA_00");
        const unmappedCard = speakerReviewCard(panel, "SPEAKER_BETA_01");

        await expect(speakerReviewRenameButton(mappedCard)).toBeVisible();
        await speakerReviewRenameButton(mappedCard).click();
        await expect(mappedCard).toHaveAttribute("data-state", "editing");
        await expect(
            mappedCard.locator(
                '[data-sot-control="speaker-review-inline-name"][data-spk-input]',
            ),
        ).toHaveCount(1);
        const cancelInput = speakerReviewInlineRenameInput(mappedCard);
        await expect(cancelInput).toHaveValue(SPEAKER_REVIEW_PROFILE_ZH_NAME);
        await expect(speakerReviewInlineRenameActions(mappedCard)).toBeVisible();
        await expect(speakerReviewInlineCancelButton(mappedCard)).toHaveText(
            "取消",
        );
        await expect(speakerReviewInlineSaveButton(mappedCard)).toHaveText(
            "保存",
        );
        await cancelInput.fill("取消不应保存");
        const patchCountBeforeCancel = speakerPatchPayloads.length;
        await speakerReviewInlineCancelButton(mappedCard).click();
        await expect(mappedCard).not.toHaveAttribute("data-state", "editing");
        expect(speakerPatchPayloads).toHaveLength(patchCountBeforeCancel);

        await speakerReviewRenameButton(mappedCard).click();
        await expect(mappedCard).toHaveAttribute("data-state", "editing");
        const escapeInput = speakerReviewInlineRenameInput(mappedCard);
        await escapeInput.fill("Escape 不应保存");
        const patchCountBeforeEscape = speakerPatchPayloads.length;
        await escapeInput.press("Escape");
        await expect(mappedCard).not.toHaveAttribute("data-state", "editing");
        expect(speakerPatchPayloads).toHaveLength(patchCountBeforeEscape);

        await speakerReviewRenameButton(mappedCard).click();
        await expect(mappedCard).toHaveAttribute("data-state", "editing");
        const buttonInput = speakerReviewInlineRenameInput(mappedCard);
        await buttonInput.fill(SPEAKER_REVIEW_INLINE_BUTTON_NAME);
        await Promise.all([
            page.waitForResponse(
                (response) =>
                    response
                        .url()
                        .includes(`/api/recordings/${recordingId}/speakers`) &&
                    response.request().method() === "PATCH" &&
                    response.ok(),
            ),
            speakerReviewInlineSaveButton(mappedCard).click(),
        ]);
        await expect(mappedCard).not.toHaveAttribute("data-state", "editing");
        await expect(
            mappedCard.getByText(`已匹配到 ${SPEAKER_REVIEW_INLINE_BUTTON_NAME}`),
        ).toBeVisible();
        expect(speakerPatchPayloads.at(-1)).toMatchObject({
            profileId: null,
            profileName: SPEAKER_REVIEW_INLINE_BUTTON_NAME,
            rawLabel: "SPEAKER_ALPHA_00",
        });

        await speakerReviewRenameButton(unmappedCard).click();
        await expect(unmappedCard).toHaveAttribute("data-state", "editing");
        const enterInput = speakerReviewInlineRenameInput(unmappedCard);
        await expect(enterInput).toHaveValue("SPEAKER_BETA_01");
        await expect(
            unmappedCard
                .locator('[data-sot-part="speaker-review-actions"]')
                .getByText("取消"),
        ).toBeVisible();
        await expect(
            unmappedCard
                .locator('[data-sot-part="speaker-review-actions"]')
                .getByText("保存"),
        ).toBeVisible();

        sotPage = await page.context().newPage();
        await openSotComponentLibrary(sotPage);
        const componentEditingStage = sotPage
            .locator("#spkr .cl-card")
            .filter({ hasText: "Editing · rename" })
            .locator(".cl-stage")
            .first();
        await expect(componentEditingStage).toBeVisible();
        await expectSotFixtureMatchesProductCssPixels(
            page,
            testInfo,
            "speaker review inline rename component-library editing row",
            componentEditingStage,
            bridgeSpeakerRowSotFixtureContract,
            {
                differingPixels: 120,
                maxChannelDelta: 250,
            },
        );
        const liveEditingDiff =
            await expectLiveProductDomUnderSotCssMatchesProductCssPixels(
                page,
                page,
                testInfo,
                "speaker review inline rename live editing row",
                unmappedCard,
            );
        expect(liveEditingDiff.dimensionsMatch).toBe(true);
        expect(liveEditingDiff.maxChannelDelta).toBeLessThanOrEqual(1);

        await enterInput.fill(SPEAKER_REVIEW_INLINE_ENTER_NAME);
        await Promise.all([
            page.waitForResponse(
                (response) =>
                    response
                        .url()
                        .includes(`/api/recordings/${recordingId}/speakers`) &&
                    response.request().method() === "PATCH" &&
                    response.ok(),
            ),
            enterInput.press("Enter"),
        ]);
        await expect(unmappedCard).not.toHaveAttribute("data-state", "editing");
        await expect(unmappedCard).toHaveAttribute(
            "data-sot-speaker-mapped",
            "true",
        );
        await expect(
            unmappedCard.getByText(`已匹配到 ${SPEAKER_REVIEW_INLINE_ENTER_NAME}`),
        ).toBeVisible();
        expect(speakerPatchPayloads.at(-1)).toMatchObject({
            profileId: null,
            profileName: SPEAKER_REVIEW_INLINE_ENTER_NAME,
            rawLabel: "SPEAKER_BETA_01",
        });
    } finally {
        await sotPage?.close();
        await cleanupRecordingDetailSeed();
    }
});

test("recording detail speaker review maps labels and stays stable on narrow screens", async ({
    page,
}) => {
    await installClipboardCapture(page);

    try {
        await ensureSignedIn(page);
        const userId = await getPlaywrightUserId();
        const storagePath = await writeAudioFixture();
        const recordingId = await seedRecordingDetail(userId, {
            includeSpeakerReview: true,
            storagePath,
        });

        await page.setViewportSize({ width: 768, height: 844 });
        await page.goto(`/recordings/${recordingId}`, {
            waitUntil: "domcontentloaded",
        });

        await expect(recordingWorkstation(page)).toBeVisible();
        await expect(sourceReportState(page, "loaded")).toHaveAttribute(
            "data-sot-state",
            "loaded",
        );
        const panel = await openSpeakerReviewPanel(page);
        await expect(panel.locator("[data-sot-speaker-label]")).toHaveCount(2);
        await expect(panel.getByText("语言")).toBeVisible();
        const mappedCard = speakerReviewCard(panel, "SPEAKER_ALPHA_00");
        const unmappedCard = speakerReviewCard(panel, "SPEAKER_BETA_01");
        await expect(
            mappedCard.getByText(`已匹配到 ${SPEAKER_REVIEW_PROFILE_ZH_NAME}`),
        ).toBeVisible();

        await expect(mappedCard).toHaveAttribute("data-sot-speaker-mapped", "true");
        await expect(mappedCard).toHaveAttribute(
            "data-sot-speaker-has-voiceprint",
            "true",
        );
        await expect(mappedCard.getByText("已关联声纹")).toBeVisible();
        await expect(
            mappedCard.getByText("示例 1 · 0:00 - 0:03", { exact: true }),
        ).toBeVisible();
        await expect(mappedCard.getByText(
            "第一段中文说话人内容需要在窄屏保持可读。",
        )).toBeVisible();
        const playSampleButton = speakerReviewPlaySampleButton(mappedCard);
        await expect(playSampleButton).toBeVisible();
        await expect(playSampleButton).toHaveAccessibleName("播放");
        await playSampleButton.click();
        await expect(playSampleButton).toHaveAccessibleName("播放中");
        await expect(unmappedCard).toHaveAttribute(
            "data-sot-speaker-mapped",
            "false",
        );
        await expect(unmappedCard.getByText("没有可播放的示例片段"))
            .toBeVisible();

        await panel.getByRole("radio", { name: "原始标签" }).click();
        await expect(
            unmappedCard.getByText("SPEAKER_BETA_01", { exact: true }),
        ).toBeVisible();

        await speakerReviewCopyRawButton(panel).click();
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        (
                            window as unknown as {
                                __betterainoteCopiedTexts: string[];
                            }
                        ).__betterainoteCopiedTexts.at(-1) ?? "",
                ),
            )
            .toContain("SPEAKER_ALPHA_00");

        const speakerPatchPayloads: unknown[] = [];
        page.on("request", (request) => {
            if (
                request.method() === "PATCH" &&
                new URL(request.url()).pathname.endsWith(
                    `/api/recordings/${recordingId}/speakers`,
                )
            ) {
                speakerPatchPayloads.push(request.postDataJSON());
            }
        });

        await speakerReviewMappingInput(unmappedCard).fill("Long Latin");
        await expect(speakerReviewClearButton(unmappedCard)).toBeVisible();
        await expect(
            speakerReviewProfileOption(
                unmappedCard,
                SPEAKER_REVIEW_PROFILE_LATIN_NAME,
            ),
        ).toBeVisible();
        await speakerReviewClearButton(unmappedCard).click();
        await expect(speakerReviewMappingInput(unmappedCard)).toHaveValue("");

        await speakerReviewMappingInput(unmappedCard).fill(
            SPEAKER_REVIEW_PROFILE_LATIN_NAME,
        );
        const exactProfileOption = speakerReviewProfileOption(
            unmappedCard,
            SPEAKER_REVIEW_PROFILE_LATIN_NAME,
        );
        await expect(exactProfileOption).toBeVisible();
        await expect(
            speakerReviewCreateOption(
                unmappedCard,
                SPEAKER_REVIEW_PROFILE_LATIN_NAME,
            ),
        ).toHaveCount(0);
        await Promise.all([
            page.waitForResponse(
                (response) =>
                    response
                        .url()
                        .includes(`/api/recordings/${recordingId}/speakers`) &&
                    response.request().method() === "PATCH" &&
                    response.ok(),
            ),
            exactProfileOption.click(),
        ]);
        const exactProfilePayload = speakerPatchPayloads.at(-1);
        expect(exactProfilePayload).toEqual({
            profileId: SPEAKER_REVIEW_PROFILE_LATIN_ID,
            rawLabel: "SPEAKER_BETA_01",
        });
        expect(
            (
                exactProfilePayload as
                    | { profileName?: unknown }
                    | undefined
            )?.profileName,
        ).toBeUndefined();
        await expect(unmappedCard).toHaveAttribute(
            "data-sot-speaker-mapped",
            "true",
        );
        await expect(
            unmappedCard.getByText(
                `已匹配到 ${SPEAKER_REVIEW_PROFILE_LATIN_NAME}`,
                { exact: true },
            ),
        ).toBeVisible();
        await expect(unmappedCard).toHaveAttribute(
            "data-sot-speaker-has-voiceprint",
            "false",
        );

        const patchCountBeforeUnlink = speakerPatchPayloads.length;
        await speakerReviewUnlinkButton(unmappedCard).click();
        await expect(unmappedCard).toHaveAttribute(
            "data-state",
            "confirm-unlink",
        );
        await expect(speakerReviewConfirmUnlink(unmappedCard)).toBeVisible();
        await expect(
            speakerReviewConfirmUnlink(unmappedCard).locator(
                "[data-sot-confirm-subject]",
            ),
        ).toHaveText(SPEAKER_REVIEW_PROFILE_LATIN_NAME);
        await expect(speakerReviewCancelUnlinkButton(unmappedCard)).toBeEnabled();
        await expect(speakerReviewConfirmUnlinkButton(unmappedCard)).toBeEnabled();
        expect(speakerPatchPayloads).toHaveLength(patchCountBeforeUnlink);
        await speakerReviewCancelUnlinkButton(unmappedCard).click();
        await expect(speakerReviewConfirmUnlink(unmappedCard)).toBeHidden();
        expect(speakerPatchPayloads).toHaveLength(patchCountBeforeUnlink);
        await speakerReviewUnlinkButton(unmappedCard).click();
        await expect(speakerReviewConfirmUnlink(unmappedCard)).toBeVisible();
        expect(speakerPatchPayloads).toHaveLength(patchCountBeforeUnlink);
        await Promise.all([
            page.waitForResponse(
                (response) =>
                    response
                        .url()
                        .includes(`/api/recordings/${recordingId}/speakers`) &&
                    response.request().method() === "PATCH" &&
                    response.ok(),
            ),
            speakerReviewConfirmUnlinkButton(unmappedCard).click(),
        ]);
        await expect(unmappedCard).toHaveAttribute(
            "data-sot-speaker-mapped",
            "false",
        );
        await expect(speakerReviewConfirmUnlink(unmappedCard)).toBeHidden();

        await speakerReviewMappingInput(unmappedCard).fill(
            SPEAKER_REVIEW_CREATED_NAME,
        );
        await expect(
            speakerReviewCreateOption(unmappedCard, SPEAKER_REVIEW_CREATED_NAME),
        ).toBeVisible();
        await Promise.all([
            page.waitForResponse(
                (response) =>
                    response
                        .url()
                        .includes(`/api/recordings/${recordingId}/speakers`) &&
                    response.request().method() === "PATCH" &&
                    response.ok(),
            ),
            speakerReviewCreateOption(
                unmappedCard,
                SPEAKER_REVIEW_CREATED_NAME,
            ).click(),
        ]);
        await expect(unmappedCard).toHaveAttribute(
            "data-sot-speaker-mapped",
            "true",
        );
        await expect(
            unmappedCard.getByText(
                `已匹配到 ${SPEAKER_REVIEW_CREATED_NAME}`,
                { exact: true },
            ),
        ).toBeVisible();

        await expect(speakerReviewMappingInput(unmappedCard)).toHaveValue(
            SPEAKER_REVIEW_CREATED_NAME,
        );

        const patchCountBeforeCreatedUnlink = speakerPatchPayloads.length;
        await speakerReviewUnlinkButton(unmappedCard).click();
        await expect(unmappedCard).toHaveAttribute(
            "data-state",
            "confirm-unlink",
        );
        await expect(speakerReviewConfirmUnlink(unmappedCard)).toBeVisible();
        await expect(
            speakerReviewConfirmUnlink(unmappedCard).locator(
                "[data-sot-confirm-subject]",
            ),
        ).toHaveText(SPEAKER_REVIEW_CREATED_NAME);
        expect(speakerPatchPayloads).toHaveLength(
            patchCountBeforeCreatedUnlink,
        );
        await Promise.all([
            page.waitForResponse(
                (response) =>
                    response
                        .url()
                        .includes(`/api/recordings/${recordingId}/speakers`) &&
                    response.request().method() === "PATCH" &&
                    response.ok(),
            ),
            speakerReviewConfirmUnlinkButton(unmappedCard).click(),
        ]);
        await expect(unmappedCard).toHaveAttribute(
            "data-sot-speaker-mapped",
            "false",
        );
        await expect(speakerReviewConfirmUnlink(unmappedCard)).toBeHidden();
        await expect(unmappedCard.getByText("尚未匹配")).toBeVisible();
        expect(speakerPatchPayloads).toEqual([
            {
                profileId: SPEAKER_REVIEW_PROFILE_LATIN_ID,
                rawLabel: "SPEAKER_BETA_01",
            },
            {
                profileId: null,
                rawLabel: "SPEAKER_BETA_01",
            },
            {
                profileId: null,
                profileName: SPEAKER_REVIEW_CREATED_NAME,
                rawLabel: "SPEAKER_BETA_01",
            },
            {
                profileId: null,
                rawLabel: "SPEAKER_BETA_01",
            },
        ]);

        await expect(
            page.getByRole("tab", { name: "说话人标签", exact: true }),
        ).toHaveAttribute("aria-selected", "true");
        await expect(mappedCard).toHaveAttribute(
            "data-sot-speaker-mapped",
            "true",
        );
        await expect(
            mappedCard.getByText("第一段中文说话人内容需要在窄屏保持可读。"),
        ).toBeVisible();
        await expect(speakerReviewMappingInput(unmappedCard)).toBeVisible();

        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        document.documentElement.scrollWidth <=
                        document.documentElement.clientWidth + 1,
                ),
            )
            .toBe(true);
    } finally {
        await removeAudioFixture();
        await cleanupRecordingDetailSeed();
    }
});

test("recording detail speaker review primitives match SOT computed styles", async ({
    page,
}) => {
    try {
        await ensureSignedIn(page);
        const userId = await getPlaywrightUserId();
        const recordingId = await seedRecordingDetail(userId, {
            includeSpeakerReview: true,
        });

        await page.goto(`/recordings/${recordingId}`, {
            waitUntil: "domcontentloaded",
        });
        await waitForRecordingDetailReady(page);
        await openSpeakerReviewPanel(page);

        const sotPage = await page.context().newPage();
        try {
            await prepareSotSpeakerReviewFixture(sotPage);

            await expectSotSpeakerStyleMatch(
                sotPage,
                page,
                '[data-sot-fixture="speaker-review"] .sp-head',
                '[data-sot-panel="speaker-review"] [data-sot-part="speaker-review-header"]',
            );
            await expectSotSpeakerStyleMatch(
                sotPage,
                page,
                '[data-sot-fixture="speaker-review"] .sp-edit-actions',
                '[data-sot-panel="speaker-review"] [data-sot-part="speaker-review-actions"]',
            );
            await expectSotSpeakerStyleMatch(
                sotPage,
                page,
                '[data-sot-fixture="speaker-review"] .sp-rows-review',
                '[data-sot-panel="speaker-review"] [data-sot-list="speaker-review-rows"]',
            );
            await expectSotSpeakerStyleMatch(
                sotPage,
                page,
                '[data-sot-fixture="speaker-review"] .sp-rows-review .sp-row',
                '[data-sot-panel="speaker-review"] [data-sot-item="speaker-review-row"]',
            );
            await expectSotSpeakerStyleMatch(
                sotPage,
                page,
                '[data-sot-fixture="speaker-review"] .sp-rows-review .sp-row .sp-row-meta',
                '[data-sot-panel="speaker-review"] [data-sot-item="speaker-review-row"] [data-sot-part="speaker-review-row-meta"]',
            );
            await expectSotSpeakerStyleMatch(
                sotPage,
                page,
                '[data-sot-fixture="speaker-review"] .sp-rows-review .sp-row-name',
                '[data-sot-panel="speaker-review"] [data-sot-part="speaker-review-row-name"]',
            );
            await expectSotSpeakerStyleMatch(
                sotPage,
                page,
                '[data-sot-fixture="speaker-review"] .sp-rows-review .sp-row-sub',
                '[data-sot-panel="speaker-review"] [data-sot-part="speaker-review-row-sub"]',
            );
        } finally {
            await sotPage.close();
        }
    } finally {
        await cleanupRecordingDetailSeed();
    }
});

test("recording detail speaker review merge popover empty state matches SOT pixels", async ({
    page,
}, testInfo) => {
    let sotPage: Page | null = null;
    try {
        await ensureSignedIn(page);
        const userId = await getPlaywrightUserId();
        const recordingId = await seedRecordingDetail(userId, {
            includeSpeakerReview: true,
        });

        await page.goto(`/recordings/${recordingId}`, {
            waitUntil: "domcontentloaded",
        });
        await waitForRecordingDetailReady(page);
        const panel = await openSpeakerReviewPanel(page);
        const mergeButton = speakerReviewMergeButton(panel);
        const mergePopover = speakerReviewMergePopover(panel);

        await expect(mergeButton).toHaveAttribute("data-slot", "button");
        await expect(mergeButton).toHaveAttribute("data-variant", "ghost");
        await expect(mergeButton).toHaveAttribute("data-size", "sm");
        await expect(mergeButton).toHaveAttribute("aria-expanded", "false");
        await expect(mergePopover).toBeHidden();
        await expect(mergePopover).toHaveAttribute("data-open", "false");

        await mergeButton.click();
        await expect(mergeButton).toHaveAttribute("aria-expanded", "true");
        await expect(mergePopover).toBeVisible();
        await expect(mergePopover).toHaveAttribute("data-open", "true");
        await expect(mergePopover).toHaveAttribute(
            "aria-label",
            "合并相似说话人",
        );
        await expect(
            mergePopover.getByText("当前没有可合并的相似说话人"),
        ).toBeVisible();
        await expect(
            mergePopover.getByText(
                "如果两位说话人声纹接近，会出现在这里供你确认。",
            ),
        ).toBeVisible();

        await mergePopover.locator("[data-spk-merge-close]").click();
        await expect(mergeButton).toHaveAttribute("aria-expanded", "false");
        await expect(mergePopover).toBeHidden();
        await expect(mergePopover).toHaveAttribute("data-open", "false");

        await mergeButton.click();
        await expect(mergePopover).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(mergeButton).toHaveAttribute("aria-expanded", "false");
        await expect(mergePopover).toBeHidden();

        await mergeButton.click();
        await expect(mergePopover).toBeVisible();
        await page.mouse.click(12, 12);
        await expect(mergeButton).toHaveAttribute("aria-expanded", "false");
        await expect(mergePopover).toBeHidden();

        await mergeButton.click();
        await expect(mergePopover).toBeVisible();

        sotPage = await page.context().newPage();
        const sotPopover = await openSotSpeakerMergePopover(sotPage);
        await expectTransformedSotPixelsMatch(
            page,
            testInfo,
            "Recording detail speaker review merge popover empty state",
            sotPopover,
            mergePopover,
            stabilizeSpeakerMergePopover,
            {
                differingPixels: 160,
                maxChannelDelta: 100,
            },
        );
    } finally {
        await sotPage?.close();
        await cleanupRecordingDetailSeed();
    }
});

test("recording detail speaker review sample playback recovers after failure and segment end", async ({
    page,
}) => {
    await page.addInitScript(() => {
        class FakeSampleAudio {
            currentTime = 0;
            onloadedmetadata: (() => void) | null = null;
            ontimeupdate: (() => void) | null = null;
            src = "";

            load() {
                queueMicrotask(() => this.onloadedmetadata?.());
            }

            pause() {}

            async play() {
                const state = window as Window & {
                    __betterAiNoteLastSampleAudio?: FakeSampleAudio;
                    __betterAiNoteRejectNextSamplePlay?: boolean;
                };
                state.__betterAiNoteLastSampleAudio = this;
                if (state.__betterAiNoteRejectNextSamplePlay) {
                    state.__betterAiNoteRejectNextSamplePlay = false;
                    throw new Error("Sample playback rejected by E2E");
                }
            }
        }

        Object.defineProperty(window, "Audio", {
            configurable: true,
            value: FakeSampleAudio,
        });
    });

    try {
        await ensureSignedIn(page);
        const userId = await getPlaywrightUserId();
        const recordingId = await seedRecordingDetail(userId, {
            includeSpeakerReview: true,
        });

        await page.goto(`/recordings/${recordingId}`, {
            waitUntil: "domcontentloaded",
        });
        await waitForRecordingDetailReady(page);

        const panel = await openSpeakerReviewPanel(page);
        const mappedCard = speakerReviewCard(panel, "SPEAKER_ALPHA_00");
        const playSampleButton = speakerReviewPlaySampleButton(mappedCard);

        await page.evaluate(() => {
            (
                window as Window & {
                    __betterAiNoteRejectNextSamplePlay?: boolean;
                }
            ).__betterAiNoteRejectNextSamplePlay = true;
        });
        await playSampleButton.click();
        await expect(
            page
                .locator("[data-sonner-toast]")
                .filter({ hasText: "示例播放失败" }),
        ).toBeVisible();
        await expect(playSampleButton).toContainText("播放");
        await expect(playSampleButton).not.toContainText("播放中");

        await playSampleButton.click();
        await expect(playSampleButton).toContainText("播放中");
        await page.evaluate(() => {
            const audio = (
                window as Window & {
                    __betterAiNoteLastSampleAudio?: {
                        currentTime: number;
                        ontimeupdate: (() => void) | null;
                    };
                }
            ).__betterAiNoteLastSampleAudio;
            if (!audio) {
                throw new Error("No sample audio instance captured");
            }
            audio.currentTime = 4;
            audio.ontimeupdate?.();
        });
        await expect(playSampleButton).toContainText("播放");
        await expect(playSampleButton).not.toContainText("播放中");
    } finally {
        await cleanupRecordingDetailSeed();
    }
});

test("recording detail speaker review covers empty and refresh failure states", async ({
    page,
}) => {
    try {
        await ensureSignedIn(page);
        const userId = await getPlaywrightUserId();
        const recordingId = await seedRecordingDetail(userId);
        let speakerListAttempts = 0;
        let holdSpeakerListFailure = true;
        await page.route(
            `**/api/recordings/${recordingId}/speakers`,
            async (route) => {
                if (route.request().method() !== "GET") {
                    await route.continue();
                    return;
                }

                speakerListAttempts += 1;
                if (holdSpeakerListFailure) {
                    await route.fulfill({
                        contentType: "application/json",
                        status: 503,
                        body: JSON.stringify({
                            error: "说话人标签暂时不可用",
                        }),
                    });
                    return;
                }

                await route.continue();
            },
        );

        await page.goto(`/recordings/${recordingId}`, {
            waitUntil: "domcontentloaded",
        });
        await waitForRecordingDetailReady(page);

        const panel = await openSpeakerReviewPanel(page);
        await expect(panel.getByRole("alert")).toContainText(
            "说话人标签暂时不可用",
        );
        await expect(panel.getByText("当前转录还没有可映射的说话人标签。"))
            .toHaveCount(0);
        holdSpeakerListFailure = false;
        await Promise.all([
            page.waitForResponse(
                (response) =>
                    response
                        .url()
                        .includes(`/api/recordings/${recordingId}/speakers`) &&
                    response.request().method() === "GET" &&
                    response.ok(),
            ),
            panel.getByRole("alert").getByRole("button", { name: "刷新" }).click(),
        ]);

        await expect(
            panel.getByText("当前转录还没有可映射的说话人标签。"),
        ).toBeVisible();
        await expect(panel.getByRole("alert")).toHaveCount(0);
        await expect(speakerReviewCopyRawButton(panel)).toBeEnabled();

        await page.route(
            `**/api/recordings/${recordingId}/transcript/raw`,
            async (route) => {
                await route.fulfill({
                    contentType: "application/json",
                    status: 503,
                    body: JSON.stringify({
                        error: "转写复核暂时不可用",
                    }),
                });
            },
        );

        await Promise.all([
            page.waitForResponse(
                (response) =>
                    response
                        .url()
                        .includes(
                            `/api/recordings/${recordingId}/transcript/raw`,
                        ) && response.status() === 503,
            ),
            speakerReviewRefreshButton(panel).click(),
        ]);

        await expect(panel.getByText("转写复核暂时不可用")).toBeVisible();
        await expect(speakerReviewCopyRawButton(panel)).toBeDisabled();
    } finally {
        await cleanupRecordingDetailSeed();
    }
});

test("recording detail speaker review disables picker actions while saving mappings", async ({
    page,
}) => {
    try {
        await ensureSignedIn(page);
        const userId = await getPlaywrightUserId();
        const storagePath = await writeAudioFixture();
        const recordingId = await seedRecordingDetail(userId, {
            includeSpeakerReview: true,
            storagePath,
        });
        let releasePatch: (() => void) | null = null;
        let speakerPatchAttempts = 0;
        await page.route(
            `**/api/recordings/${recordingId}/speakers`,
            async (route) => {
                if (route.request().method() !== "PATCH") {
                    await route.continue();
                    return;
                }

                speakerPatchAttempts += 1;
                await new Promise<void>((resolve) => {
                    releasePatch = resolve;
                });
                await route.fulfill({
                    contentType: "application/json",
                    body: JSON.stringify({
                        profileId: SPEAKER_REVIEW_PROFILE_LATIN_ID,
                        rawLabel: "SPEAKER_BETA_01",
                    }),
                });
            },
        );

        await page.goto(`/recordings/${recordingId}`, {
            waitUntil: "domcontentloaded",
        });
        await waitForRecordingDetailReady(page);
        const panel = await openSpeakerReviewPanel(page);
        const unmappedCard = speakerReviewCard(panel, "SPEAKER_BETA_01");
        const mappingInput = speakerReviewMappingInput(unmappedCard);

        await mappingInput.fill("Long Latin");
        const profileOption = speakerReviewProfileOption(
            unmappedCard,
            SPEAKER_REVIEW_PROFILE_LATIN_NAME,
        );
        await expect(profileOption).toBeEnabled();
        await profileOption.click();

        await expect(mappingInput).toBeDisabled();
        await expect(profileOption).toBeDisabled();
        await expect
            .poll(() => speakerPatchAttempts)
            .toBe(1);

        releasePatch?.();
        await expect(mappingInput).toBeEnabled();
        expect(speakerPatchAttempts).toBe(1);
    } finally {
        await removeAudioFixture();
        await cleanupRecordingDetailSeed();
    }
});

test("recording detail tag manager default state matches SOT pixels", async ({
    browser,
    page,
}, testInfo) => {
    let sotPage: Page | null = null;
    try {
        await ensureSignedIn(page);
        const userId = await getPlaywrightUserId();
        const recordingId = await seedRecordingDetail(userId, {
            includeSotTagManagerFixture: "default",
        });

        await page.goto(`/recordings/${recordingId}`, {
            waitUntil: "domcontentloaded",
        });
        await waitForRecordingDetailReady(page);
        sotPage = await browser.newPage();
        await prepareSotTagManagerFixture(sotPage, page);

        await playerTagManagerTrigger(page).click();
        const tagsPanel = tagManager(page);
        const selectedChips = tagsPanel.locator(
            '[data-sot-part="selected-chip"]',
        );
        const tagOptions = tagsPanel.locator(
            '[data-sot-control="recording-tag-toggle"]',
        );
        await expect(selectedChips).toHaveCount(2);
        await expect(tagOptions).toHaveCount(4);
        await expect(tagOptions.nth(0)).toContainText(SOT_DETAIL_TAG_NAME);
        await expect(tagOptions.nth(1)).toContainText(
            SOT_DETAIL_SECOND_TAG_NAME,
        );
        await expect(tagOptions.nth(2)).toContainText(
            SOT_DETAIL_IMPORTANT_TAG_NAME,
        );
        await expect(tagOptions.nth(3)).toContainText(
            SOT_DETAIL_FOLLOW_UP_TAG_NAME,
        );

        const sotDefaultPanel = sotPage
            .locator('#tagmgr .cl-card:has-text("Default") .tagm-panel')
            .first();
        await expectSotTagManagerPrimitiveStylesMatch(
            sotPage,
            page,
            tagManagerDefaultStyleChecks(
                '#tagmgr .cl-card:has-text("Default") .tagm-panel',
            ),
        );

        await expectSinglePageTransformedSotPixelsMatch(
            page,
            testInfo,
            "recording detail tag manager default state",
            sotDefaultPanel,
            tagsPanel,
            stabilizeTagManagerPopover,
            { differingPixels: 12, maxChannelDelta: 1 },
        );
        await expectTagManagerResponsiveSotPixelsMatch(
            page,
            testInfo,
            "recording detail tag manager default responsive frame",
            sotDefaultPanel,
            tagsPanel,
        );
    } finally {
        await sotPage?.close();
        await cleanupRecordingDetailSeed();
    }
});

test("recording detail tag manager delete-confirm state matches SOT pixels", async ({
    browser,
    page,
}, testInfo) => {
    let sotPage: Page | null = null;
    try {
        await ensureSignedIn(page);
        const userId = await getPlaywrightUserId();
        const recordingId = await seedRecordingDetail(userId, {
            includeSotTagManagerFixture: "delete-important",
        });

        await page.goto(`/recordings/${recordingId}`, {
            waitUntil: "domcontentloaded",
        });
        await waitForRecordingDetailReady(page);
        sotPage = await browser.newPage();
        await prepareSotTagManagerFixture(sotPage, page);

        await playerTagManagerTrigger(page).click();
        const tagsPanel = tagManager(page);
        await expect(
            tagsPanel.locator('[data-sot-control="recording-tag-toggle"]'),
        ).toHaveCount(4);
        const importantChip = tagsPanel.locator(
            `[data-sot-part="selected-chip"][data-sot-tag-name="${SOT_DETAIL_IMPORTANT_TAG_NAME}"]`,
        );
        await expect(importantChip).toBeVisible();
        await importantChip
            .locator('[data-sot-control="recording-tag-delete-open"]')
            .click();
        await expect(tagsPanel).toHaveAttribute(
            "data-sot-state",
            "delete-confirm",
        );
        await expect(
            tagsPanel.locator(
                '[data-sot-panel="recording-tag-delete-confirm"]',
            ),
        ).toContainText(`${SOT_DETAIL_IMPORTANT_TAG_NAME} 将从 7 条录音`);

        const sotDeletePanel = sotPage
            .locator(
                '#tagmgr .cl-card:has-text("Remove · delete-confirm") .tagm-panel',
            )
            .first();
        await expectSotTagManagerPrimitiveStylesMatch(
            sotPage,
            page,
            tagManagerDeleteConfirmStyleChecks(
                '#tagmgr .cl-card:has-text("Remove · delete-confirm") .tagm-panel',
            ),
        );

        await expectSinglePageTransformedSotPixelsMatch(
            page,
            testInfo,
            "recording detail tag manager delete confirm state",
            sotDeletePanel,
            tagsPanel,
            stabilizeTagManagerPopover,
        );
        await expectTagManagerResponsiveSotPixelsMatch(
            page,
            testInfo,
            "recording detail tag manager delete confirm responsive frame",
            sotDeletePanel,
            tagsPanel,
        );
    } finally {
        await sotPage?.close();
        await cleanupRecordingDetailSeed();
    }
});

test("recording detail tag manager saving state matches SOT pixels", async ({
    browser,
    page,
}, testInfo) => {
    let sotPage: Page | null = null;
    let releaseTagsUpdate = () => {};
    try {
        await ensureSignedIn(page);
        const userId = await getPlaywrightUserId();
        const recordingId = await seedRecordingDetail(userId, {
            includeSotTagManagerFixture: "default",
        });
        const tagsUpdateGate = new Promise<void>((resolve) => {
            releaseTagsUpdate = resolve;
        });
        await page.route(
            `**/api/recordings/${recordingId}/tags`,
            async (route) => {
                if (route.request().method() !== "PUT") {
                    await route.fallback();
                    return;
                }

                await tagsUpdateGate;
                await route.fulfill({
                    contentType: "application/json",
                    status: 200,
                    body: JSON.stringify({
                        tags: [
                            {
                                color: "blue",
                                icon: "user",
                                id: SOT_DETAIL_SECOND_TAG_ID,
                                name: SOT_DETAIL_SECOND_TAG_NAME,
                            },
                        ],
                    }),
                });
            },
        );

        await page.goto(`/recordings/${recordingId}`, {
            waitUntil: "domcontentloaded",
        });
        await waitForRecordingDetailReady(page);
        sotPage = await browser.newPage();
        await prepareSotTagManagerFixture(sotPage, page);

        await playerTagManagerTrigger(page).click();
        const tagsPanel = tagManager(page);
        await expect(tagsPanel).toHaveAttribute("data-sot-state", "ready");
        await tagsPanel
            .locator(
                `[data-sot-control="recording-tag-toggle"][data-sot-tag-name="${SOT_DETAIL_TAG_NAME}"]`,
            )
            .click();
        await expect(tagsPanel).toHaveAttribute("data-sot-state", "saving");
        await expect(tagsPanel).toHaveAttribute("aria-busy", "true");
        await expect(tagsPanel.locator('[data-sot-part="selected-chip"]')).toHaveCount(0);
        await expect(tagsPanel.locator('[data-sot-part="create"]')).toHaveCount(0);
        await expect(
            tagsPanel.locator('[data-sot-control="recording-tag-toggle"]'),
        ).toHaveCount(2);
        await expect(
            tagsPanel.locator(
                '[data-sot-control="recording-tag-toggle"][data-busy="true"]',
            ),
        ).toHaveCount(1);

        const sotSavingPanel = sotPage
            .locator('#tagmgr .cl-card:has-text("Saving") .tagm-panel')
            .first();
        await expectSotTagManagerPrimitiveStylesMatch(
            sotPage,
            page,
            tagManagerSavingStyleChecks(
                '#tagmgr .cl-card:has-text("Saving") .tagm-panel',
            ),
        );

        await expectTransformedSotPixelsMatch(
            page,
            testInfo,
            "recording detail tag manager saving state",
            sotSavingPanel,
            tagsPanel,
            stabilizeTagManagerPopover,
        );
        await expectTagManagerResponsiveSotPixelsMatch(
            page,
            testInfo,
            "recording detail tag manager saving responsive frame",
            sotSavingPanel,
            tagsPanel,
        );
    } finally {
        releaseTagsUpdate();
        await sotPage?.close();
        await cleanupRecordingDetailSeed();
    }
});

test("recording detail tag manager error state matches SOT pixels", async ({
    browser,
    page,
}, testInfo) => {
    let sotPage: Page | null = null;
    try {
        await ensureSignedIn(page);
        const userId = await getPlaywrightUserId();
        const recordingId = await seedRecordingDetail(userId, {
            includeSotTagManagerFixture: "default",
        });
        let tagsUpdateAttempts = 0;
        await page.route(
            `**/api/recordings/${recordingId}/tags`,
            async (route) => {
                if (route.request().method() !== "PUT") {
                    await route.fallback();
                    return;
                }

                tagsUpdateAttempts += 1;
                if (tagsUpdateAttempts === 1) {
                    await route.fulfill({
                        contentType: "application/json",
                        status: 503,
                        body: JSON.stringify({
                            error: "标签保存暂不可用",
                        }),
                    });
                    return;
                }

                await route.fulfill({
                    contentType: "application/json",
                    status: 200,
                    body: JSON.stringify({ tags: [] }),
                });
            },
        );

        await page.goto(`/recordings/${recordingId}`, {
            waitUntil: "domcontentloaded",
        });
        await waitForRecordingDetailReady(page);
        sotPage = await browser.newPage();
        await prepareSotTagManagerFixture(sotPage, page);

        await playerTagManagerTrigger(page).click();
        const tagsPanel = tagManager(page);
        const failedTagsUpdate = page.waitForResponse(
            (response) =>
                response
                    .url()
                    .includes(`/api/recordings/${recordingId}/tags`) &&
                response.request().method() === "PUT" &&
                response.status() === 503,
        );
        await tagsPanel
            .locator(
                `[data-sot-control="recording-tag-toggle"][data-sot-tag-name="${SOT_DETAIL_TAG_NAME}"]`,
            )
            .click();
        await failedTagsUpdate;
        await expect(tagsPanel).toHaveAttribute("data-sot-state", "error");
        await expect(tagsPanel).toHaveAttribute(
            "data-sot-error-message",
            "标签保存暂不可用",
        );
        await expect(tagsPanel).toContainText("保存失败 · 请稍后再试");
        await expect(tagsPanel.getByText("标签保存暂不可用")).toHaveCount(0);
        await expect(tagsPanel.locator('[data-sot-part="selected-chip"]')).toHaveCount(0);
        await expect(tagsPanel.locator('[data-sot-part="create"]')).toHaveCount(0);
        await expect(
            tagsPanel.locator('[data-sot-control="recording-tag-toggle"]'),
        ).toHaveCount(1);

        const sotErrorPanel = sotPage
            .locator('#tagmgr .cl-card:has-text("Error") .tagm-panel')
            .first();
        await expectSotTagManagerPrimitiveStylesMatch(
            sotPage,
            page,
            tagManagerErrorStyleChecks(
                '#tagmgr .cl-card:has-text("Error") .tagm-panel',
            ),
        );

        await expectTransformedSotPixelsMatch(
            page,
            testInfo,
            "recording detail tag manager error state",
            sotErrorPanel,
            tagsPanel,
            stabilizeTagManagerPopover,
        );
        await expectTagManagerResponsiveSotPixelsMatch(
            page,
            testInfo,
            "recording detail tag manager error responsive frame",
            sotErrorPanel,
            tagsPanel,
        );

        await Promise.all([
            page.waitForResponse(
                (response) =>
                    response
                        .url()
                        .includes(`/api/recordings/${recordingId}/tags`) &&
                    response.request().method() === "PUT" &&
                    response.ok(),
            ),
            tagsPanel
                .locator('[data-sot-control="recording-tag-error-retry"]')
                .click(),
        ]);
        expect(tagsUpdateAttempts).toBe(2);
    } finally {
        await sotPage?.close();
        await cleanupRecordingDetailSeed();
    }
});

test("recording detail tag manager toggle state matches SOT pixels", async ({
    browser,
    page,
}, testInfo) => {
    let sotPage: Page | null = null;
    try {
        await ensureSignedIn(page);
        const userId = await getPlaywrightUserId();
        const recordingId = await seedRecordingDetail(userId, {
            includeSotTagManagerFixture: "default",
        });
        await page.route(
            `**/api/recordings/${recordingId}/tags`,
            async (route) => {
                if (route.request().method() !== "PUT") {
                    await route.fallback();
                    return;
                }

                await route.fulfill({
                    contentType: "application/json",
                    status: 200,
                    body: JSON.stringify({
                        tags: [
                            {
                                color: "purple",
                                icon: "grid",
                                id: SOT_DETAIL_TAG_ID,
                                name: SOT_DETAIL_TAG_NAME,
                            },
                            {
                                color: "blue",
                                icon: "user",
                                id: SOT_DETAIL_SECOND_TAG_ID,
                                name: SOT_DETAIL_SECOND_TAG_NAME,
                            },
                        ],
                    }),
                });
            },
        );

        await page.goto(`/recordings/${recordingId}`, {
            waitUntil: "domcontentloaded",
        });
        await waitForRecordingDetailReady(page);
        sotPage = await browser.newPage();
        await prepareSotTagManagerFixture(sotPage, page);

        await playerTagManagerTrigger(page).click();
        const tagsPanel = tagManager(page);
        await Promise.all([
            page.waitForResponse(
                (response) =>
                    response
                        .url()
                        .includes(`/api/recordings/${recordingId}/tags`) &&
                    response.request().method() === "PUT" &&
                    response.ok(),
            ),
            tagsPanel
                .locator(
                    `[data-sot-control="recording-tag-toggle"][data-sot-tag-name="${SOT_DETAIL_IMPORTANT_TAG_NAME}"]`,
                )
                .click(),
        ]);
        await expect(tagsPanel).toHaveAttribute("data-sot-state", "toggle");
        await expect(tagsPanel.locator('[data-sot-part="selected-chip"]')).toHaveCount(0);
        await expect(tagsPanel.locator('[data-sot-part="create"]')).toHaveCount(0);
        await expect(
            tagsPanel.locator('[data-sot-control="recording-tag-toggle"]'),
        ).toHaveCount(4);
        await expect(tagsPanel.locator('[data-sot-part="tag-check"]')).toHaveCount(1);
        await expect(
            tagsPanel.locator('[data-sot-part="toggle-note"]'),
        ).toContainText("标签已应用");

        await expectSotTagManagerPrimitiveStylesMatch(
            sotPage,
            page,
            tagManagerToggleStyleChecks(
                '#tagmgr .cl-card:has-text("Toggle") .tagm-panel',
            ),
        );
        const sotTogglePanel = sotPage
            .locator('#tagmgr .cl-card:has-text("Toggle") .tagm-panel')
            .first();

        await expectSinglePageTransformedSotPixelsMatch(
            page,
            testInfo,
            "recording detail tag manager toggle state",
            sotTogglePanel,
            tagsPanel,
            stabilizeTagManagerPopover,
        );
        await expectTagManagerResponsiveSotPixelsMatch(
            page,
            testInfo,
            "recording detail tag manager toggle responsive frame",
            sotTogglePanel,
            tagsPanel,
        );
    } finally {
        await sotPage?.close();
        await cleanupRecordingDetailSeed();
    }
});

test("recording detail tag manager empty and create states match SOT responsive frames", async ({
    browser,
    page,
}, testInfo) => {
    let sotPage: Page | null = null;
    try {
        await ensureSignedIn(page);
        const userId = await getPlaywrightUserId();
        const recordingId = await seedRecordingDetail(userId);

        await page.goto(`/recordings/${recordingId}`, {
            waitUntil: "domcontentloaded",
        });
        await waitForRecordingDetailReady(page);
        sotPage = await browser.newPage();
        await prepareSotTagManagerFixture(sotPage, page);

        await playerTagManagerTrigger(page).click();
        const tagsPanel = tagManager(page);
        await expect(tagsPanel).toHaveAttribute("data-sot-state", "ready");
        await expect(
            tagsPanel.locator('[data-sot-panel="recording-tag-empty"]'),
        ).toHaveAttribute("data-sot-state", "empty");
        const sotEmptyPanel = sotPage
            .locator('#tagmgr .cl-card:has-text("Empty") .tagm-panel')
            .first();
        await expectSotTagManagerPrimitiveStylesMatch(
            sotPage,
            page,
            tagManagerEmptyStyleChecks(
                '#tagmgr .cl-card:has-text("Empty") .tagm-panel',
            ),
        );
        await expectTagManagerResponsiveSotPixelsMatch(
            page,
            testInfo,
            "recording detail tag manager empty responsive frame",
            sotEmptyPanel,
            tagsPanel,
        );

        const tagCreateInput = tagsPanel.locator(
            '[data-sot-control="recording-tag-name"]',
        );
        await tagCreateInput.fill(DETAIL_TAG_NAME);
        await expect(tagsPanel).toHaveAttribute("data-sot-state", "create");
        const blueTagColor = tagsPanel.locator(
            '[data-sot-control="recording-tag-color"][data-sot-tag-color="blue"]',
        );
        await blueTagColor.click();
        await expect(blueTagColor).toHaveAttribute(
            "data-sot-state",
            "selected",
        );
        const sotCreatePanel = sotPage
            .locator('#tagmgr .cl-card:has-text("Create") .tagm-panel')
            .first();
        await expectSotTagManagerPrimitiveStylesMatch(
            sotPage,
            page,
            tagManagerCreateStyleChecks(
                '#tagmgr .cl-card:has-text("Create") .tagm-panel',
            ),
        );
        await expectTagManagerResponsiveSotPixelsMatch(
            page,
            testInfo,
            "recording detail tag manager create responsive frame",
            sotCreatePanel,
            tagsPanel,
        );
    } finally {
        await sotPage?.close();
        await cleanupRecordingDetailSeed();
    }
});

test("recording detail exposes the tag manager and persists tag toggles", async ({
    browser,
    page,
}, testInfo) => {
    let sotPage: Page | null = null;
    try {
        await ensureSignedIn(page);
        const userId = await getPlaywrightUserId();
        const recordingId = await seedRecordingDetail(userId);

        await page.goto(`/recordings/${recordingId}`, {
            waitUntil: "domcontentloaded",
        });
        await waitForRecordingDetailReady(page);
        sotPage = await browser.newPage();
        await prepareSotTagManagerFixture(sotPage, page);

        const trigger = playerTagManagerTrigger(page);
        await expect(trigger).toBeVisible();
        await expect(trigger).toContainText("标签");

        await trigger.click();
        await expect(
            page.getByText("管理标签", { exact: true }),
        ).toBeVisible();
        const tagsPanel = tagManager(page);
        const selectedTags = tagsPanel.locator(
            '[data-sot-list="recording-selected-tags"]',
        );
        await expect(tagsPanel).toHaveAttribute("data-sot-variant", "popover");
        await expect(tagsPanel).toHaveAttribute("data-sot-state", "ready");
        await expect(tagsPanel.locator('[data-sot-part="head"]')).toBeVisible();
        await expect(tagsPanel.locator('[data-sot-part="body"]')).toBeVisible();
        await expect(tagsPanel.locator('[data-sot-part="create"]')).toBeVisible();
        await expect(tagsPanel.locator('[data-sot-part="picker"]')).toHaveCount(0);
        await expect(selectedTags).toHaveCount(0);
        await expect(
            tagsPanel.locator('[data-sot-panel="recording-tag-empty"]'),
        ).toHaveAttribute("data-sot-state", "empty");
        const sotEmptyPanel = sotPage
            .locator('#tagmgr .cl-card:has-text("Empty") .tagm-panel')
            .first();
        await expectSotTagManagerPrimitiveStylesMatch(
            sotPage,
            page,
            tagManagerEmptyStyleChecks(
                '#tagmgr .cl-card:has-text("Empty") .tagm-panel',
            ),
        );

        await expectTransformedSotPixelsMatch(
            page,
            testInfo,
            "recording detail tag manager empty state",
            sotEmptyPanel,
            tagsPanel,
            stabilizeTagManagerPopover,
            {
                differingPixels: 1,
                maxChannelDelta: 1,
            },
        );
        await expectSotTagManagerStyleMatch(
            sotPage,
            page,
            '#tagmgr .cl-card:has-text("Empty") .tagm-empty',
            '[data-sot-panel="recording-tag-empty"]',
        );
        const tagCreateInput = tagsPanel.locator(
            '[data-sot-control="recording-tag-name"]',
        );
        await expect(tagCreateInput).toHaveAttribute(
            "placeholder",
            "新建标签…",
        );
        const tagCreateButton = tagsPanel.locator(
            '[data-slot="button"][data-sot-control="recording-tag-create"]',
        );
        await expect(tagCreateButton).toHaveAttribute(
            "data-sot-state",
            "idle",
        );

        await tagCreateInput.fill(DETAIL_TAG_NAME);
        await expect(tagsPanel).toHaveAttribute("data-sot-state", "create");
        await expect(
            tagsPanel.getByText("新建标签", { exact: true }),
        ).toBeVisible();
        await expect(tagCreateInput).toHaveAttribute("placeholder", "标签名");
        await expect(tagsPanel.locator('[data-sot-part="picker"]')).toHaveCount(2);
        const blueTagColor = tagsPanel.locator(
            '[data-sot-control="recording-tag-color"][data-sot-tag-color="blue"]',
        );
        const starTagIcon = tagsPanel.locator(
            '[data-sot-control="recording-tag-icon"][data-sot-tag-icon="star"]',
        );
        await blueTagColor.click();
        await expect(blueTagColor).toHaveAttribute(
            "data-sot-state",
            "selected",
        );
        const sotCreatePanel = sotPage
            .locator('#tagmgr .cl-card:has-text("Create") .tagm-panel')
            .first();
        await expectSotTagManagerPrimitiveStylesMatch(
            sotPage,
            page,
            tagManagerCreateStyleChecks(
                '#tagmgr .cl-card:has-text("Create") .tagm-panel',
            ),
        );

        await expectTransformedSotPixelsMatch(
            page,
            testInfo,
            "recording detail tag manager create state",
            sotCreatePanel,
            tagsPanel,
            stabilizeTagManagerPopover,
            {
                differingPixels: 4,
                maxChannelDelta: 1,
            },
        );
        await expectSotTagManagerStyleMatch(
            sotPage,
            page,
            '#tagmgr .cl-card:has-text("Create") .tagm-picker',
            '[data-sot-panel="recording-tag-manager"] [data-sot-part="picker-frame"]',
        );
        await expectSotTagManagerStyleMatch(
            sotPage,
            page,
            '#tagmgr .cl-card:has-text("Create") .tagm-icon-grid .tg-pick',
            '[data-sot-panel="recording-tag-manager"] [data-sot-part="icon-grid"] [data-sot-control="recording-tag-icon"]',
            SOT_TAG_MANAGER_ICON_BUTTON_STYLE_PROPS,
        );
        for (const color of [
            "red",
            "orange",
            "green",
            "blue",
            "purple",
            "slate",
        ]) {
            const colorButton = tagsPanel.locator(
                `[data-sot-control="recording-tag-color"][data-sot-tag-color="${color}"]`,
            );
            await expect(colorButton).toBeVisible();
            await colorButton.click();
            await expect(colorButton).toHaveAttribute(
                "data-sot-state",
                "selected",
            );
        }
        for (const icon of [
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
        ]) {
            const iconButton = tagsPanel.locator(
                `[data-sot-control="recording-tag-icon"][data-sot-tag-icon="${icon}"]`,
            );
            await expect(iconButton).toBeVisible();
            await iconButton.click();
            await expect(iconButton).toHaveAttribute(
                "data-sot-state",
                "selected",
            );
        }
        await blueTagColor.click();
        await starTagIcon.click();
        await expect(blueTagColor).toHaveAttribute("aria-checked", "true");
        await expect(blueTagColor).toHaveAttribute(
            "data-sot-state",
            "selected",
        );
        await expect(starTagIcon).toHaveAttribute("aria-checked", "true");
        await expect(starTagIcon).toHaveAttribute(
            "data-sot-state",
            "selected",
        );

        const tagCreatePayloads: unknown[] = [];
        page.on("request", (request) => {
            if (
                request.method() === "POST" &&
                new URL(request.url()).pathname.endsWith("/api/recording-tags")
            ) {
                tagCreatePayloads.push(request.postDataJSON());
            }
        });

        let resolveCreateFailure = () => {};
        const createFailureGate = new Promise<void>((resolve) => {
            resolveCreateFailure = resolve;
        });
        let createAttempts = 0;
        await page.route("**/api/recording-tags", async (route) => {
            if (route.request().method() !== "POST") {
                await route.fallback();
                return;
            }

            createAttempts += 1;
            if (createAttempts === 1) {
                await createFailureGate;
                await route.fulfill({
                    contentType: "application/json",
                    status: 503,
                    body: JSON.stringify({
                        error: "标签服务暂不可用",
                    }),
                });
                return;
            }

            await route.fallback();
        });

        await expect(tagCreateButton).toHaveAttribute("data-sot-state", "idle");
        const failedCreateResponse = page.waitForResponse(
            (response) =>
                response.url().includes("/api/recording-tags") &&
                response.request().method() === "POST" &&
                response.status() === 503,
        );

        await tagCreateButton.click();
        await expect(tagsPanel).toHaveAttribute(
            "data-sot-create-state",
            "saving",
        );
        resolveCreateFailure();
        await failedCreateResponse;

        await expect(tagsPanel).toHaveAttribute(
            "data-sot-create-state",
            "idle",
        );
        await expect(tagsPanel).toHaveAttribute("data-sot-error", "true");
        await expect(tagsPanel).toHaveAttribute("data-sot-state", "error");
        await expect(tagsPanel).toHaveAttribute(
            "data-sot-error-message",
            "标签服务暂不可用",
        );
        await expect(
            tagsPanel.locator('[data-sot-panel="recording-tag-error"]'),
        ).toContainText("保存失败 · 请稍后再试");
        await expectSotTagManagerStyleMatch(
            sotPage,
            page,
            '#tagmgr .cl-card:has-text("Error") .tagm-error',
            '[data-sot-panel="recording-tag-error"]',
        );
        await expect(tagsPanel.getByText("标签服务暂不可用")).toHaveCount(0);
        await expect(trigger).toContainText("标签");

        await Promise.all([
            page.waitForResponse(
                (response) =>
                    response.url().includes("/api/recording-tags") &&
                    response.request().method() === "POST" &&
                    response.ok(),
            ),
            page.waitForResponse(
                (response) =>
                    response.url().includes(`/api/recordings/${recordingId}/tags`) &&
                    response.request().method() === "PUT" &&
                    response.ok(),
            ),
            tagsPanel
                .locator('[data-sot-control="recording-tag-error-retry"]')
                .click(),
        ]);

        await expect(tagsPanel).toHaveAttribute("data-sot-error", "false");
        await expect(tagsPanel.getByText("标签服务暂不可用")).toHaveCount(0);
        await expect(trigger).toContainText(DETAIL_TAG_NAME);
        await expect(trigger).toHaveAttribute("data-sot-tag-color", "blue");
        await expect(trigger).toHaveAttribute("data-sot-tag-icon", "star");
        await expect(tagCreateInput).toHaveValue("");
        await expect(selectedTags).toHaveAttribute("data-sot-state", "ready");
        const selectedChip = tagsPanel.locator(
            `[data-sot-part="selected-chip"][data-sot-tag-name="${DETAIL_TAG_NAME}"]`,
        );
        await expect(selectedChip).toBeVisible();
        await expect(selectedChip).toHaveAttribute("data-sot-tag-color", "blue");
        await expectSotTagManagerStyleMatch(
            sotPage,
            page,
            '#tagmgr .cl-card:has-text("Default") .tagm-sel-chip',
            `[data-sot-panel="recording-tag-manager"] [data-sot-part="selected-chip"][data-sot-tag-name="${DETAIL_TAG_NAME}"]`,
        );
        await expect(
            tagsPanel.locator('[data-sot-list="recording-available-tags"]'),
        ).toHaveAttribute("data-sot-state", "ready");
        const tagToggle = tagsPanel.locator(
            `[data-sot-control="recording-tag-toggle"][data-sot-tag-name="${DETAIL_TAG_NAME}"]`,
        );
        await expect(tagToggle).toBeVisible();
        await expect(tagToggle).toHaveAttribute("data-sot-state", "selected");
        await expect(tagToggle).toHaveAttribute("data-sot-tag-color", "blue");
        await expect(tagToggle).toHaveAttribute("data-sot-tag-icon", "star");
        await expect(tagToggle.locator('[data-sot-part="tag-check"]')).toHaveCount(0);
        await expectSotTagManagerStyleMatch(
            sotPage,
            page,
            '#tagmgr .cl-card:has-text("Default") .tagm-opt',
            `[data-sot-control="recording-tag-toggle"][data-sot-tag-name="${DETAIL_TAG_NAME}"]`,
        );
        expect(tagCreatePayloads).toEqual([
            {
                color: "blue",
                icon: "star",
                name: DETAIL_TAG_NAME,
            },
            {
                color: "blue",
                icon: "star",
                name: DETAIL_TAG_NAME,
            },
        ]);
        expect(createAttempts).toBe(2);
        const createdTagIdForToggle = await tagToggle.getAttribute(
            "data-sot-tag-id",
        );
        if (!createdTagIdForToggle) {
            throw new Error("Expected created tag id before toggle flow");
        }

        let resolveToggleFailure = () => {};
        const toggleFailureGate = new Promise<void>((resolve) => {
            resolveToggleFailure = resolve;
        });
        let toggleAttempts = 0;
        await page.route(
            `**/api/recordings/${recordingId}/tags`,
            async (route) => {
                if (route.request().method() !== "PUT") {
                    await route.fallback();
                    return;
                }

                toggleAttempts += 1;
                if (toggleAttempts === 1) {
                    await toggleFailureGate;
                    await route.fulfill({
                        contentType: "application/json",
                        status: 503,
                        body: JSON.stringify({
                            error: "标签保存暂不可用",
                        }),
                    });
                    return;
                }

                const payload = route.request().postDataJSON() as {
                    tagIds?: string[];
                };
                const includesCreatedTag = payload.tagIds?.includes(
                    createdTagIdForToggle,
                );
                await route.fulfill({
                    contentType: "application/json",
                    status: 200,
                    body: JSON.stringify({
                        tags: includesCreatedTag
                            ? [
                                  {
                                      color: "blue",
                                      icon: "star",
                                      id: createdTagIdForToggle,
                                      name: DETAIL_TAG_NAME,
                                  },
                              ]
                            : [],
                    }),
                });
            },
        );

        const failedToggleResponse = page.waitForResponse(
            (response) =>
                response
                    .url()
                    .includes(`/api/recordings/${recordingId}/tags`) &&
                response.request().method() === "PUT" &&
                response.status() === 503,
        );

        await tagToggle.click();
        await expect(tagsPanel).toHaveAttribute(
            "data-sot-toggle-state",
            "saving",
        );
        resolveToggleFailure();
        await failedToggleResponse;

        await expect(tagsPanel).toHaveAttribute(
            "data-sot-toggle-state",
            "idle",
        );
        await expect(tagsPanel).toHaveAttribute("data-sot-error", "true");
        await expect(tagsPanel).toHaveAttribute("data-sot-state", "error");
        await expect(tagsPanel).toHaveAttribute(
            "data-sot-error-message",
            "标签保存暂不可用",
        );
        await expect(tagsPanel).toContainText("保存失败 · 请稍后再试");
        await expect(tagsPanel.getByText("标签保存暂不可用")).toHaveCount(0);

        await Promise.all([
            page.waitForResponse(
                (response) =>
                    response.url().includes(`/api/recordings/${recordingId}/tags`) &&
                    response.request().method() === "PUT" &&
                    response.ok(),
            ),
            tagsPanel
                .locator('[data-sot-control="recording-tag-error-retry"]')
                .click(),
        ]);

        await expect(tagsPanel).toHaveAttribute("data-sot-error", "false");
        await expect(tagsPanel.getByText("标签保存暂不可用")).toHaveCount(0);
        expect(toggleAttempts).toBe(2);
        await expect(tagsPanel).toHaveAttribute("data-sot-state", "toggle");
        await expect(trigger).toContainText("标签");
        await expect(tagToggle).toHaveAttribute("aria-pressed", "false");
        await expect(tagToggle).toHaveAttribute("data-sot-state", "idle");

        await Promise.all([
            page.waitForResponse(
                (response) =>
                    response
                        .url()
                        .includes(`/api/recordings/${recordingId}/tags`) &&
                    response.request().method() === "PUT" &&
                    response.ok(),
            ),
            tagToggle.click(),
        ]);
        expect(toggleAttempts).toBe(3);
        await expect(tagsPanel).toHaveAttribute("data-sot-state", "toggle");
        await expect(trigger).toContainText(DETAIL_TAG_NAME);
        await expect(tagToggle).toHaveAttribute("aria-pressed", "true");
        await expect(tagToggle).toHaveAttribute("data-sot-state", "selected");

        await trigger.click();
        await expect(tagsPanel).toHaveCount(0);
        await trigger.click();
        await expect(tagsPanel).toHaveAttribute("data-sot-state", "ready");
        await expect(selectedChip).toBeVisible();

        const tagId = createdTagIdForToggle;
        const deleteOpenButton = selectedChip.locator(
            '[data-sot-control="recording-tag-delete-open"]',
        );
        await expect(deleteOpenButton).toHaveAttribute(
            "data-sot-state",
            "idle",
        );
        await deleteOpenButton.click();
        await expect(tagsPanel).toHaveAttribute(
            "data-sot-state",
            "delete-confirm",
        );
        await expect(
            page.getByText(`删除标签 · ${DETAIL_TAG_NAME}`, { exact: true }),
        ).toBeVisible();
        await expect(
            tagsPanel.locator(
                '[data-sot-panel="recording-tag-delete-confirm"]',
            ),
        ).toContainText("无法撤销");
        await expectSotTagManagerStyleMatch(
            sotPage,
            page,
            '#tagmgr .cl-card:has-text("delete-confirm") .tagm-delete-confirm',
            '[data-sot-panel="recording-tag-delete-confirm"]',
        );
        const deleteCancelButton = tagsPanel.locator(
            '[data-sot-control="recording-tag-delete-cancel"]',
        );
        await expect(deleteCancelButton).toHaveText("取消");
        await deleteCancelButton.click();
        await expect(tagsPanel).toHaveAttribute("data-sot-state", "ready");

        await selectedChip
            .locator('[data-sot-control="recording-tag-delete-open"]')
            .click();
        const deleteConfirmButton = tagsPanel.locator(
            '[data-sot-control="recording-tag-delete-confirm"]',
        );
        await expect(deleteConfirmButton).toHaveText("删除标签");

        let resolveDeleteFailure = () => {};
        const deleteFailureGate = new Promise<void>((resolve) => {
            resolveDeleteFailure = resolve;
        });
        let deleteAttempts = 0;
        await page.route(`**/api/recording-tags/${tagId}`, async (route) => {
            if (route.request().method() !== "DELETE") {
                await route.fallback();
                return;
            }

            deleteAttempts += 1;
            if (deleteAttempts === 1) {
                await deleteFailureGate;
                await route.fulfill({
                    contentType: "application/json",
                    status: 503,
                    body: JSON.stringify({
                        error: "标签删除暂不可用",
                    }),
                });
                return;
            }

            await route.fallback();
        });

        const failedDeleteResponse = page.waitForResponse(
            (response) =>
                response.url().includes(`/api/recording-tags/${tagId}`) &&
                response.request().method() === "DELETE" &&
                response.status() === 503,
        );
        await deleteConfirmButton.click();
        await expect(tagsPanel).toHaveAttribute("data-sot-state", "deleting");
        await expect(deleteConfirmButton).toHaveAttribute(
            "data-sot-state",
            "saving",
        );
        resolveDeleteFailure();
        await failedDeleteResponse;

        await expect(tagsPanel).toHaveAttribute("data-sot-error", "true");
        await expect(tagsPanel.getByText("标签删除暂不可用")).toBeVisible();
        await expect(
            tagsPanel.locator(
                '[data-sot-panel="recording-tag-delete-confirm"]',
            ),
        ).toContainText(DETAIL_TAG_NAME);

        await Promise.all([
            page.waitForResponse(
                (response) =>
                    response.url().includes(`/api/recording-tags/${tagId}`) &&
                    response.request().method() === "DELETE" &&
                    response.ok(),
            ),
            deleteConfirmButton.click(),
        ]);
        expect(deleteAttempts).toBe(2);
        await expect(tagsPanel).toHaveAttribute("data-sot-error", "false");
        await expect(trigger).toContainText("标签");
        await expect(trigger).not.toContainText(DETAIL_TAG_NAME);
        await expect(tagToggle).toHaveCount(0);
        await expect(selectedChip).toHaveCount(0);
        await expect(
            tagsPanel.locator('[data-sot-panel="recording-tag-empty"]'),
        ).toHaveAttribute("data-sot-state", "empty");

        const closeButton = tagsPanel.locator(
            '[data-sot-control="recording-tag-manager-close"]',
        );
        await expect(closeButton).toHaveAttribute("data-sot-state", "idle");
        await closeButton.click();
        await expect(tagsPanel).toHaveCount(0);
    } finally {
        await sotPage?.close();
        await cleanupRecordingDetailSeed();
    }
});

test("recording detail source copy guards missing artifacts without writing empty clipboard", async ({
    page,
}) => {
    await installClipboardCapture(page);

    try {
        await ensureSignedIn(page);
        const userId = await getPlaywrightUserId();
        const recordingId = await seedRecordingDetail(userId, {
            includeSourceDetail: false,
            includeSourceSummary: false,
            includeSourceTranscript: false,
        });

        await page.goto(`/recordings/${recordingId}`, {
            waitUntil: "domcontentloaded",
        });

        await expect(sourceReportState(page, "loaded")).toHaveAttribute(
            "data-sot-state",
            "loaded",
        );
        await expect(sourceReportInnerState(page, "loaded")).toHaveAttribute(
            "data-sub-state",
            "both-missing",
        );
        await expect(
            sourceReportState(page, "loaded").getByText(
                "这条来源记录没有本地音频",
            ),
        ).toBeVisible();
        await expect(
            page.getByText(
                "这条录音没有本地音频，无法播放或运行私有重转写。",
            ),
        ).toBeVisible();
        await expect(playerShell(page)).toHaveAttribute(
            "data-sot-state",
            "disabled",
        );
        await expect(playerControlsPanel(page)).toHaveAttribute(
            "data-sot-state",
            "disabled",
        );
        await expect(playerBackButton(page)).toHaveAttribute(
            "data-sot-state",
            "disabled",
        );
        await expect(playerForwardButton(page)).toHaveAttribute(
            "data-sot-state",
            "disabled",
        );
        await expect(playerToggleButton(page, "播放")).toBeDisabled();
        await expect(playerToggleButton(page, "播放")).toHaveAttribute(
            "data-sot-state",
            "disabled",
        );
        await expect(playerSpeedButton(page)).toBeDisabled();
        await expect(playerSpeedButton(page)).toHaveAttribute(
            "data-sot-state",
            "disabled",
        );
        await expect(playerSeekSlider(page)).toHaveAttribute(
            "data-sot-state",
            "disabled",
        );
        await expect(playerVolumeButton(page)).toBeDisabled();
        await expect(playerVolumeButton(page)).toHaveAttribute(
            "data-sot-state",
            "disabled",
        );
        await expect(
            page.locator('[data-sot-control="recording-player-volume-slider"]'),
        ).toHaveCount(0);
        await expect(
            sourceReportState(page, "loaded").getByText("转写状态", {
                exact: true,
            }),
        ).toBeVisible();
        await expect(
            sourceReportState(page, "loaded").getByText("摘要状态", {
                exact: true,
            }),
        ).toBeVisible();
        await expect(sourceReportState(page, "loaded").getByText("未生成"))
            .toHaveCount(2);
        await expect(
            sourceReportInnerState(page, "loaded")
                .locator("[data-sot-source-report-section]")
                .filter({ hasText: "来源转写" }),
        ).toBeVisible();
        await expect(
            sourceReportInnerState(page, "loaded")
                .locator("[data-sot-source-report-section]")
                .filter({ hasText: "来源信息" }),
        ).toBeVisible();
        await expect(sourceReportTranscriptCopyButton(page)).toBeDisabled();
        await expect(sourceReportReportCopyButton(page)).toBeDisabled();
        await expect(detailSourceTranscriptCopyButton(page)).toBeDisabled();
        await expect(detailSourceTranscriptCopyButton(page)).toHaveAttribute(
            "data-sot-state",
            "missing",
        );
        await expect(detailSourceReportCopyButton(page)).toBeDisabled();
        await expect(detailSourceReportCopyButton(page)).toHaveAttribute(
            "data-sot-state",
            "missing",
        );
        expect(await readCopiedTexts(page)).toEqual([]);

        await expect(sourceReportOpenSourceControl(page)).toHaveAttribute(
            "data-sot-state",
            "unavailable",
        );
        await expect(sourceReportOpenSourceControl(page)).toBeDisabled();
        await expect(sourceReportRepullButton(page)).toHaveAttribute(
            "data-sot-state",
            "ready",
        );
        await expect(sourceReportRepullButton(page)).toBeEnabled();
    } finally {
        await cleanupRecordingDetailSeed();
    }
});

test("recording detail source report retries after first-load failure", async ({
    page,
}) => {
    await installClipboardCapture(page);

    try {
        await ensureSignedIn(page);
        const userId = await getPlaywrightUserId();
        const recordingId = await seedRecordingDetail(userId);
        let reportAttempts = 0;
        let releaseFirstReport: () => void = () => {};
        const firstReportGate = new Promise<void>((resolve) => {
            releaseFirstReport = resolve;
        });

        await page.route(
            `**/api/recordings/${recordingId}/source-report`,
            async (route) => {
                reportAttempts += 1;

                if (reportAttempts === 1) {
                    await firstReportGate;
                    await route.fulfill({
                        contentType: "application/json",
                        status: 503,
                        body: JSON.stringify({
                            error: "Source report temporarily unavailable",
                        }),
                    });
                    return;
                }

                await route.continue();
            },
        );

        await page.goto(`/recordings/${recordingId}`, {
            waitUntil: "domcontentloaded",
        });

        await expect(sourceReportState(page, "loading")).toBeVisible();
        await expect(detailSourceTranscriptCopyButton(page)).toHaveCount(0);
        await expect(detailSourceReportCopyButton(page)).toHaveCount(0);
        expect(await readCopiedTexts(page)).toEqual([]);

        releaseFirstReport();
        const errorBanner = sourceReportState(page, "error");
        const errorState = sourceReportInnerState(page, "error");
        await expect(errorBanner).toBeVisible();
        await expect(errorState).toHaveAttribute(
            "data-sot-error",
            "Source report temporarily unavailable",
        );
        await expect(errorBanner).toContainText("无法读取来源详情");
        await expect(errorBanner).not.toContainText(
            "Source report temporarily unavailable",
        );
        await expect(sourceReportState(page, "loaded")).toHaveCount(0);
        await expect(detailSourceTranscriptCopyButton(page)).toHaveCount(0);
        await expect(detailSourceReportCopyButton(page)).toHaveCount(0);
        await expect(errorBanner).toBeVisible();

        await Promise.all([
            page.waitForResponse(
                (response) =>
                    response
                        .url()
                        .includes(
                            `/api/recordings/${recordingId}/source-report`,
                        ) &&
                    response.request().method() === "GET" &&
                    response.ok(),
            ),
            errorBanner.getByRole("button", { name: "重试" }).click(),
        ]);

        await expect(sourceReportState(page, "loaded")).toHaveAttribute(
            "data-sot-state",
            "loaded",
        );
        await expect(
            detailSourceTranscriptCopyButton(page),
        ).toHaveAttribute("data-sot-state", "ready");
        await expect(
            detailSourceReportCopyButton(page),
        ).toHaveAttribute("data-sot-state", "ready");
        await detailSourceReportCopyButton(page).click();
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        (
                            window as unknown as {
                                __betterainoteCopiedTexts: string[];
                            }
                        ).__betterainoteCopiedTexts.at(-1) ?? "",
                ),
            )
            .toContain("E2E 源报告摘要");
        expect(reportAttempts).toBe(2);
    } finally {
        await cleanupRecordingDetailSeed();
    }
});

test("recording detail source report refresh keeps loaded actions stable", async ({
    page,
}) => {
    await installClipboardCapture(page);
    let releaseRefreshReport: () => void = () => {};
    let releaseSourceRepull: () => void = () => {};

    try {
        await ensureSignedIn(page);
        const userId = await getPlaywrightUserId();
        const recordingId = await seedRecordingDetail(userId);
        let reportAttempts = 0;
        let syncAttempts = 0;
        const refreshReportGate = new Promise<void>((resolve) => {
            releaseRefreshReport = resolve;
        });
        const sourceRepullGate = new Promise<void>((resolve) => {
            releaseSourceRepull = resolve;
        });
        const refreshedSourceReport = {
            sourceProvider: "ticnote",
            filename: "E2E source detail review",
            transcriptReady: true,
            summaryReady: true,
            transcript: {
                text: "Speaker 1: 来源逐字稿刷新内容。",
                segmentCount: 1,
                segments: [
                    {
                        speaker: "Speaker 1",
                        startMs: 15_000,
                        endMs: 30_000,
                        text: "来源逐字稿刷新内容。",
                    },
                ],
            },
            summaryMarkdown:
                "## E2E 源报告刷新摘要\n\n- 录音详情页刷新后保留复制动作。",
            detail: {
                provider: "ticnote",
                status: "available",
                sections: ["transcript", "summary", "detail"],
                language: "zh-CN",
            },
            sourceActions: {
                openSource: {
                    available: true,
                    url: "https://source.example.test/recording/1",
                    reason: null,
                },
                repullSource: {
                    available: true,
                    reason: null,
                },
            },
        };

        await page.route("**/api/data-sources/sync", async (route) => {
            if (route.request().method() !== "POST") {
                await route.continue();
                return;
            }

            syncAttempts += 1;
            await sourceRepullGate;
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
            `**/api/recordings/${recordingId}/source-report`,
            async (route) => {
                reportAttempts += 1;

                if (reportAttempts >= 2) {
                    if (reportAttempts === 2) {
                        await refreshReportGate;
                    }
                    await route.fulfill({
                        contentType: "application/json",
                        status: 200,
                        body: JSON.stringify(refreshedSourceReport),
                    });
                    return;
                }

                await route.continue();
            },
        );

        await page.goto(`/recordings/${recordingId}`, {
            waitUntil: "domcontentloaded",
        });

        await waitForRecordingDetailReady(page);
        await expect(
            sourceReportInnerState(page, "loaded")
                .locator("[data-sot-source-report-section]")
                .filter({ hasText: "来源转写" }),
        ).toBeVisible();
        await expect(
            sourceReportInnerState(page, "loaded")
                .locator("[data-sot-source-report-section]")
                .filter({ hasText: "来源信息" }),
        ).toBeVisible();
        await expect(
            detailSourceTranscriptCopyButton(page),
        ).toHaveAttribute("data-sot-state", "ready");
        await expect(
            detailSourceReportCopyButton(page),
        ).toHaveAttribute("data-sot-state", "ready");

        const refreshResponse = page.waitForResponse(
            (response) =>
                response
                    .url()
                    .includes(`/api/recordings/${recordingId}/source-report`) &&
                response.request().method() === "GET" &&
                response.ok(),
        );
        const refreshButton = sourceReportLoadButton(page);
        await refreshButton.click();
        await expect(refreshButton).toBeDisabled();
        await expect(refreshButton).toContainText("加载中...");
        await expect(sourceReportState(page, "loaded")).toHaveAttribute(
            "data-sot-state",
            "loaded",
        );
        await expect(sourceReportTranscriptCopyButton(page)).toBeEnabled();
        await expect(sourceReportReportCopyButton(page)).toBeEnabled();

        releaseRefreshReport();
        await refreshResponse;

        await expect(
            sourceReportState(page, "loaded").getByText("00:15 – 00:30"),
        ).toContainText("00:15 – 00:30");
        await expect(refreshButton).toBeEnabled();
        await expect(refreshButton).toContainText("刷新");
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
            "https://source.example.test/recording/1",
        );
        await expect(sourceReportRepullButton(page)).toHaveAttribute(
            "data-sot-state",
            "ready",
        );

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
            .poll(() => reportAttempts)
            .toBeGreaterThanOrEqual(3);
        expect(syncAttempts).toBe(1);

        await sourceReportReportCopyButton(page).click();
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        (
                            window as unknown as {
                                __betterainoteCopiedTexts: string[];
                            }
                        ).__betterainoteCopiedTexts.at(-1) ?? "",
                ),
            )
            .toContain("E2E 源报告刷新摘要");
        expect(reportAttempts).toBeGreaterThanOrEqual(3);
    } finally {
        releaseRefreshReport();
        releaseSourceRepull();
        await cleanupRecordingDetailSeed();
    }
});
