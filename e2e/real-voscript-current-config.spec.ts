import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { expect, type Page, test } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";
import {
    REAL_VOSCRIPT_E2E_GUARD,
    REAL_VOSCRIPT_TARGET_RECORDING_ID,
    seedRealVoScriptCurrentFixture,
    shouldRunRealVoScriptE2E,
} from "./helpers/real-voscript-current";

const execFileAsync = promisify(execFile);
const E2E_DATA_DIR = path.resolve(process.cwd(), "tmp/e2e/data");
const REAL_VOSCRIPT_TIMEOUT_MS = 20 * 60 * 1000;

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
test.skip(
    !shouldRunRealVoScriptE2E(),
    `${REAL_VOSCRIPT_E2E_GUARD}=1 is required for real VoScript E2E`,
);
test.setTimeout(REAL_VOSCRIPT_TIMEOUT_MS + 120_000);

function resolveDatabasePath() {
    return process.env.DATABASE_PATH
        ? path.resolve(process.cwd(), process.env.DATABASE_PATH)
        : path.join(E2E_DATA_DIR, "betterainote-e2e.db");
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

async function runBunJson<T>(label: string, source: string) {
    try {
        const { stdout } = await execFileAsync("bun", ["-e", source], {
            cwd: process.cwd(),
            env: process.env,
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

async function getTranscriptionState(page: Page) {
    const response = await page.request.get(
        `/api/recordings/${REAL_VOSCRIPT_TARGET_RECORDING_ID}/transcribe`,
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

async function querySearchForGeneratedTranscript(page: Page) {
    const state = await getTranscriptionState(page);
    const query = state.transcript?.text.trim().split(/\s+/).find(Boolean);
    expect(query).toBeTruthy();

    for (let attempt = 0; attempt < 5; attempt += 1) {
        await runSearchWorker();
        const response = await page.request.get("/api/search", {
            params: {
                q: query ?? "",
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
                    result.recordingId === REAL_VOSCRIPT_TARGET_RECORDING_ID,
            )
        ) {
            return true;
        }

        await page.waitForTimeout(1_000);
    }

    return false;
}

test("uses current VoScript config and current content through the app queue", async ({
    page,
}) => {
    await ensureSignedIn(page);

    const userId = await getPlaywrightUserId();
    const fixture = await seedRealVoScriptCurrentFixture({
        targetUserId: userId,
    }).catch(() => null);
    test.skip(
        !fixture,
        "Current VoScript config/content unavailable for real E2E",
    );
    if (!fixture) {
        return;
    }

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
