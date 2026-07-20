import { eq } from "drizzle-orm";
import { db } from "@/db";
import { recordings } from "@/db/schema/library";
import { sourceArtifacts } from "@/db/schema/transcripts";
import {
    isSourceProvider,
    sourceProviderSupportsCapability,
} from "@/lib/data-sources/catalog";
import { findOwnedRecording } from "./ownership";

type SourceArtifact = typeof sourceArtifacts.$inferSelect;

type SourceActionAvailability = {
    available: boolean;
    reason: string | null;
};

type SourceOpenAction = SourceActionAvailability & {
    url: string | null;
};

type PublicTranscriptSegment = {
    speaker: string;
    startMs: number | null;
    endMs: number | null;
    text: string;
};

const OPEN_SOURCE_URL_KEYS = new Set([
    "appurl",
    "detailurl",
    "linkurl",
    "meetingurl",
    "minuteurl",
    "openurl",
    "pageurl",
    "permalink",
    "shareurl",
    "sourceurl",
    "weburl",
    "webpageurl",
]);
const UNSAFE_SOURCE_URL_KEY_PATTERN =
    /audio|auth|bearer|cookie|credential|download|file|format|header|media|password|raw|request|response|secret|session|signed|signature|temp|token|voice/i;
const MAX_SOURCE_ACTION_URL_DEPTH = 6;
const MAX_SOURCE_ACTION_URL_LENGTH = 2048;

export class RecordingSourceReportError extends Error {
    constructor(
        message: string,
        public readonly status = 404,
    ) {
        super(message);
        this.name = "RecordingSourceReportError";
    }
}

function toPublicTimestamp(value: unknown) {
    if (value instanceof Date) {
        return value.toISOString();
    }

    if (typeof value === "number" || typeof value === "string") {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }

    return null;
}

function getPublicLanguage(payload: unknown) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return null;
    }

    const language = (payload as Record<string, unknown>).language;
    return typeof language === "string" && language.length <= 64
        ? language
        : null;
}

function normalizeSourceActionKey(key: string) {
    return key.replace(/[\s_-]/g, "").toLowerCase();
}

function hasUnsafeSourceUrlPath(path: string[]) {
    return path.some((key) => UNSAFE_SOURCE_URL_KEY_PATTERN.test(key));
}

function isOpenSourceUrlKey(path: string[]) {
    const key = path.at(-1);
    if (!key || hasUnsafeSourceUrlPath(path)) {
        return false;
    }

    const normalized = normalizeSourceActionKey(key);
    if (OPEN_SOURCE_URL_KEYS.has(normalized)) {
        return true;
    }

    if (normalized !== "url") {
        return false;
    }

    const context = normalizeSourceActionKey(path.slice(0, -1).join("."));
    return /meeting|minute|page|share|source|web/.test(context);
}

function sanitizeOpenSourceUrl(value: string) {
    const rawUrl = value.trim();
    if (!rawUrl || rawUrl.length > MAX_SOURCE_ACTION_URL_LENGTH) {
        return null;
    }

    try {
        const url = new URL(rawUrl);
        if (
            url.protocol !== "https:" ||
            url.username ||
            url.password ||
            url.href.length > MAX_SOURCE_ACTION_URL_LENGTH
        ) {
            return null;
        }

        url.search = "";
        url.hash = "";
        return url.toString();
    } catch {
        return null;
    }
}

function findSafeOpenSourceUrl(
    value: unknown,
    path: string[] = [],
    depth = 0,
): string | null {
    if (depth > MAX_SOURCE_ACTION_URL_DEPTH) {
        return null;
    }

    if (typeof value === "string") {
        return isOpenSourceUrlKey(path) ? sanitizeOpenSourceUrl(value) : null;
    }

    if (!value || typeof value !== "object") {
        return null;
    }

    if (Array.isArray(value)) {
        for (const item of value) {
            const url = findSafeOpenSourceUrl(item, path, depth + 1);
            if (url) {
                return url;
            }
        }
        return null;
    }

    for (const [key, child] of Object.entries(value)) {
        if (UNSAFE_SOURCE_URL_KEY_PATTERN.test(key)) {
            continue;
        }

        const url = findSafeOpenSourceUrl(child, [...path, key], depth + 1);
        if (url) {
            return url;
        }
    }

    return null;
}

function buildSourceActions(params: {
    sourceProvider: string;
    sourceMetadata: unknown;
    detailArtifact: SourceArtifact | null;
}) {
    const openSourceUrl =
        findSafeOpenSourceUrl(params.sourceMetadata) ??
        findSafeOpenSourceUrl(params.detailArtifact?.payload);
    const repullAvailable =
        isSourceProvider(params.sourceProvider) &&
        sourceProviderSupportsCapability(params.sourceProvider, "workerSync");

    return {
        openSource: {
            available: Boolean(openSourceUrl),
            url: openSourceUrl,
            reason: openSourceUrl ? null : "source-open-unavailable",
        } satisfies SourceOpenAction,
        repullSource: {
            available: repullAvailable,
            reason: repullAvailable ? null : "source-repull-unavailable",
        } satisfies SourceActionAvailability,
    };
}

function readStringField(
    source: Record<string, unknown>,
    keys: string[],
): string | null {
    for (const key of keys) {
        const value = source[key];
        if (typeof value === "string" && value.trim()) {
            const trimmed = value.trim();
            if (!/^(undefined|null)$/i.test(trimmed)) {
                return trimmed;
            }
        }
    }

    return null;
}

function readNumberField(
    source: Record<string, unknown>,
    keys: string[],
): number | null {
    for (const key of keys) {
        const value = source[key];
        if (typeof value === "number" && Number.isFinite(value)) {
            return value;
        }
    }

    return null;
}

function normalizeTranscriptSegments(
    payload: unknown,
): PublicTranscriptSegment[] {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return [];
    }

    const rawSegments = (payload as Record<string, unknown>).segments;
    if (!Array.isArray(rawSegments)) {
        return [];
    }

    return rawSegments.flatMap((segment, index) => {
        if (!segment || typeof segment !== "object" || Array.isArray(segment)) {
            return [];
        }

        const source = segment as Record<string, unknown>;
        const text = readStringField(source, ["text", "content"]);
        if (!text) {
            return [];
        }

        return {
            speaker:
                readStringField(source, [
                    "speaker",
                    "speakerLabel",
                    "displaySpeaker",
                    "speakerName",
                    "name",
                ]) ?? `Speaker ${index + 1}`,
            startMs: readNumberField(source, ["startMs", "start_time"]),
            endMs: readNumberField(source, ["endMs", "end_time"]),
            text,
        };
    });
}

function buildTranscriptTextFromSegments(segments: PublicTranscriptSegment[]) {
    const turns: PublicTranscriptSegment[] = [];

    for (const segment of segments) {
        const previous = turns.at(-1);
        if (previous && previous.speaker === segment.speaker) {
            previous.text = `${previous.text} ${segment.text}`;
            previous.endMs = segment.endMs ?? previous.endMs;
            continue;
        }

        turns.push({ ...segment });
    }

    return turns
        .map((segment) => `${segment.speaker}: ${segment.text}`)
        .join("\n\n");
}

function sanitizeTranscriptText(text: string | null | undefined) {
    return (text ?? "")
        .split(/\n/)
        .map((line) =>
            line.replace(/^\s*(undefined|null)\s*:\s*/i, "").trimEnd(),
        )
        .join("\n")
        .trim();
}

function normalizeSourceSummaryMarkdown(text: string | null | undefined) {
    const value = text?.trim() ?? "";
    if (!value) {
        return null;
    }

    try {
        const parsed = JSON.parse(value) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            const source = parsed as Record<string, unknown>;
            const aiContent = source.ai_content;
            if (typeof aiContent === "string" && aiContent.trim()) {
                return aiContent.trim();
            }

            const content = source.content;
            if (typeof content === "string" && content.trim()) {
                return content.trim();
            }

            if (
                content &&
                typeof content === "object" &&
                !Array.isArray(content)
            ) {
                const markdown = (content as Record<string, unknown>).markdown;
                if (typeof markdown === "string" && markdown.trim()) {
                    return markdown.trim();
                }
            }
        }
    } catch {
        return value;
    }

    return value;
}

function buildPublicDetail(
    artifact: SourceArtifact | null,
    fallbackProvider: string,
    sections: string[],
) {
    if (!artifact) {
        return null;
    }

    const createdAt = toPublicTimestamp(artifact.createdAt);
    const updatedAt = toPublicTimestamp(artifact.updatedAt);
    const language = getPublicLanguage(artifact.payload);

    return {
        provider: artifact.provider || fallbackProvider,
        status: "available",
        sections,
        ...(language ? { language } : {}),
        ...(createdAt ? { createdAt } : {}),
        ...(updatedAt ? { updatedAt } : {}),
    };
}

export async function getRecordingSourceReport(
    userId: string,
    recordingId: string,
) {
    const recording = await findOwnedRecording(userId, recordingId, {
        id: recordings.id,
        sourceProvider: recordings.sourceProvider,
        sourceRecordingId: recordings.sourceRecordingId,
        sourceMetadata: recordings.sourceMetadata,
        filename: recordings.filename,
    });

    if (!recording) {
        throw new RecordingSourceReportError("Recording not found", 404);
    }

    const artifacts = await db
        .select()
        .from(sourceArtifacts)
        .where(eq(sourceArtifacts.recordingId, recording.id));

    const transcriptArtifact =
        artifacts.find(
            (artifact) => artifact.artifactType === "official-transcript",
        ) ?? null;
    const summaryArtifact =
        artifacts.find(
            (artifact) => artifact.artifactType === "official-summary",
        ) ?? null;
    const detailArtifact =
        artifacts.find(
            (artifact) => artifact.artifactType === "official-detail",
        ) ?? null;
    const transcriptSegments = normalizeTranscriptSegments(
        transcriptArtifact?.payload,
    );
    const transcriptText = transcriptSegments.length
        ? buildTranscriptTextFromSegments(transcriptSegments)
        : sanitizeTranscriptText(transcriptArtifact?.textContent);
    const transcriptReady = Boolean(
        transcriptText.trim() || transcriptSegments.length > 0,
    );
    const summaryMarkdown = normalizeSourceSummaryMarkdown(
        summaryArtifact?.markdownContent,
    );
    const summaryReady = Boolean(summaryMarkdown);
    const availableSections = [
        ...(transcriptReady ? ["transcript"] : []),
        ...(summaryReady ? ["summary"] : []),
        ...(detailArtifact ? ["detail"] : []),
    ];

    return {
        sourceProvider: recording.sourceProvider,
        filename: recording.filename,
        source: {
            provider: recording.sourceProvider,
            name: recording.filename,
        },
        availableSections,
        transcriptReady,
        summaryReady,
        transcript: transcriptArtifact
            ? {
                  text: transcriptText,
                  segmentCount: transcriptSegments.length,
                  segments: transcriptSegments,
              }
            : null,
        summaryMarkdown,
        detail: buildPublicDetail(
            detailArtifact,
            recording.sourceProvider,
            availableSections,
        ),
        sourceActions: buildSourceActions({
            sourceProvider: recording.sourceProvider,
            sourceMetadata: recording.sourceMetadata,
            detailArtifact,
        }),
    };
}
