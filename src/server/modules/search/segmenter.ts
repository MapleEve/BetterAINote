import { createHash } from "node:crypto";
import type { sourceArtifactSegments, transcriptSegments } from "@/db/schema";
import type {
    SourceProvider,
    SourceTranscriptSegment,
} from "@/lib/data-sources/types";

type TranscriptOrigin = "local" | "source";

type TranscriptSegmentRow = typeof transcriptSegments.$inferInsert;
type SourceArtifactSegmentRow = typeof sourceArtifactSegments.$inferInsert;

type TranscriptSegmentSource = {
    userId: string;
    recordingId: string;
    transcriptionId?: string | null;
    sourceArtifactId?: string | null;
    transcriptOrigin: TranscriptOrigin;
    text: string;
    providerPayload?: unknown;
};

type SourceArtifactSegmentSource = {
    sourceArtifactId: string;
    recordingId: string;
    userId: string;
    provider?: SourceProvider | string | null;
    artifactType: string;
    textContent?: string | null;
    markdownContent?: string | null;
    payload?: Record<string, unknown> | null;
};

export type SearchTextChunk = {
    index: number;
    text: string;
};

function stableSegmentId(prefix: string, segmentId: string | number) {
    return `${prefix}:${String(segmentId)}`;
}

export function hashSearchContent(value: string) {
    return createHash("sha256").update(value).digest("hex");
}

function secondsToMs(value: unknown): number | null {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return null;
    }

    return Math.max(0, Math.round(value * 1000));
}

function trimText(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

function getProviderSegments(
    providerPayload: TranscriptSegmentSource["providerPayload"],
) {
    if (!providerPayload || typeof providerPayload !== "object") {
        return [];
    }

    const segments = (providerPayload as { segments?: unknown }).segments;
    if (!Array.isArray(segments)) {
        return [];
    }

    return segments.filter(
        (segment): segment is Record<string, unknown> =>
            Boolean(segment) && typeof segment === "object",
    );
}

function resolveSpeakerLabel(segment: {
    speakerLabel?: unknown;
    speakerName?: unknown;
    speaker?: unknown;
}) {
    return (
        trimText(segment.speakerLabel) ||
        trimText(segment.speakerName) ||
        trimText(segment.speaker) ||
        null
    );
}

function buildTranscriptRow(params: {
    base: Omit<TranscriptSegmentSource, "providerPayload" | "text">;
    segmentId: string | number;
    providerSegmentId?: string | null;
    rawSpeakerLabel?: string | null;
    startMs?: number | null;
    endMs?: number | null;
    sortSeqMs: number;
    text: string;
}): TranscriptSegmentRow {
    const contentHash = hashSearchContent(params.text);
    const entityBase =
        params.base.transcriptionId ??
        params.base.sourceArtifactId ??
        params.base.recordingId;

    return {
        id: stableSegmentId(
            `${entityBase}:${params.base.transcriptOrigin}`,
            params.segmentId,
        ),
        userId: params.base.userId,
        recordingId: params.base.recordingId,
        transcriptionId: params.base.transcriptionId ?? null,
        sourceArtifactId: params.base.sourceArtifactId ?? null,
        transcriptOrigin: params.base.transcriptOrigin,
        providerSegmentId: params.providerSegmentId ?? null,
        speakerProfileId: null,
        rawSpeakerLabel: params.rawSpeakerLabel ?? null,
        startMs: params.startMs ?? null,
        endMs: params.endMs ?? null,
        sortSeqMs: params.sortSeqMs,
        text: params.text,
        contentHash,
    };
}

function parseLineSpeaker(line: string) {
    const match = line.match(
        /^([A-Za-z0-9_\-\u4e00-\u9fa5 ]{1,48})[:：]\s*(.+)$/,
    );
    if (!match) {
        return { speaker: null, text: line.trim() };
    }

    return {
        speaker: match[1].trim(),
        text: match[2].trim(),
    };
}

export function buildTranscriptSegmentRows(
    params: TranscriptSegmentSource,
): TranscriptSegmentRow[] {
    const providerSegments = getProviderSegments(params.providerPayload);
    if (providerSegments.length > 0) {
        return providerSegments
            .map((segment, index) => {
                const text = trimText(segment.text);
                if (!text) {
                    return null;
                }

                const startMs = secondsToMs(segment.start);
                const endMs = secondsToMs(segment.end);
                const segmentId =
                    typeof segment.id === "string" ||
                    typeof segment.id === "number"
                        ? segment.id
                        : `segment-${index}`;

                return buildTranscriptRow({
                    base: params,
                    segmentId,
                    providerSegmentId: String(segmentId),
                    rawSpeakerLabel: resolveSpeakerLabel(segment),
                    startMs,
                    endMs,
                    sortSeqMs: startMs ?? index * 1000,
                    text,
                });
            })
            .filter((row): row is TranscriptSegmentRow => Boolean(row));
    }

    return params.text
        .split(/\r?\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line, index) => {
            const parsed = parseLineSpeaker(line);
            return buildTranscriptRow({
                base: params,
                segmentId: `line-${index}`,
                providerSegmentId: `line-${index}`,
                rawSpeakerLabel: parsed.speaker,
                sortSeqMs: index * 1000,
                text: parsed.text,
            });
        });
}

function sourceSegmentsFromPayload(
    payload: Record<string, unknown> | null | undefined,
): SourceTranscriptSegment[] {
    const rawSegments = payload?.segments;
    if (!Array.isArray(rawSegments)) {
        return [];
    }

    return rawSegments.flatMap((segment) => {
        if (!segment || typeof segment !== "object") {
            return [];
        }

        const candidate = segment as Record<string, unknown>;
        const text = trimText(candidate.text);
        if (!text) {
            return [];
        }

        return [
            {
                speaker: trimText(candidate.speaker),
                startMs:
                    typeof candidate.startMs === "number" &&
                    Number.isFinite(candidate.startMs)
                        ? Math.max(0, Math.round(candidate.startMs))
                        : 0,
                endMs:
                    typeof candidate.endMs === "number" &&
                    Number.isFinite(candidate.endMs)
                        ? Math.max(0, Math.round(candidate.endMs))
                        : 0,
                text,
            },
        ];
    });
}

function splitArtifactText(value: string | null | undefined) {
    return (value ?? "")
        .split(/\n{2,}|\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
}

export function buildSourceArtifactSegmentRows(
    params: SourceArtifactSegmentSource,
): SourceArtifactSegmentRow[] {
    const sourceSegments = sourceSegmentsFromPayload(params.payload);
    if (sourceSegments.length > 0) {
        return sourceSegments.map((segment, index) => ({
            id: `${params.sourceArtifactId}:segment-${index}`,
            sourceArtifactId: params.sourceArtifactId,
            recordingId: params.recordingId,
            userId: params.userId,
            segmentType:
                params.artifactType === "official-transcript"
                    ? "transcript"
                    : "body",
            heading: segment.speaker?.trim() || null,
            sortOrder: index,
            text: segment.text.trim(),
            contentHash: hashSearchContent(segment.text.trim()),
        }));
    }

    const text =
        params.markdownContent?.trim() || params.textContent?.trim() || "";

    return splitArtifactText(text).map((segmentText, index) => ({
        id: `${params.sourceArtifactId}:segment-${index}`,
        sourceArtifactId: params.sourceArtifactId,
        recordingId: params.recordingId,
        userId: params.userId,
        segmentType:
            params.artifactType === "official-transcript"
                ? "transcript"
                : "body",
        heading: null,
        sortOrder: index,
        text: segmentText,
        contentHash: hashSearchContent(segmentText),
    }));
}

export function buildTranscriptSegmentRowsFromSourceArtifact(
    params: SourceArtifactSegmentSource,
): TranscriptSegmentRow[] {
    const sourceSegments = sourceSegmentsFromPayload(params.payload);
    if (sourceSegments.length > 0) {
        return sourceSegments.map((segment, index) =>
            buildTranscriptRow({
                base: {
                    userId: params.userId,
                    recordingId: params.recordingId,
                    sourceArtifactId: params.sourceArtifactId,
                    transcriptOrigin: "source",
                },
                segmentId: `segment-${index}`,
                providerSegmentId: `segment-${index}`,
                rawSpeakerLabel: segment.speaker || null,
                startMs: segment.startMs,
                endMs: segment.endMs,
                sortSeqMs: segment.startMs,
                text: segment.text.trim(),
            }),
        );
    }

    const text =
        params.textContent?.trim() || params.markdownContent?.trim() || "";

    return splitArtifactText(text).map((line, index) => {
        const parsed = parseLineSpeaker(line);
        return buildTranscriptRow({
            base: {
                userId: params.userId,
                recordingId: params.recordingId,
                sourceArtifactId: params.sourceArtifactId,
                transcriptOrigin: "source",
            },
            segmentId: `line-${index}`,
            providerSegmentId: `line-${index}`,
            rawSpeakerLabel: parsed.speaker,
            sortSeqMs: index * 1000,
            text: parsed.text,
        });
    });
}

function splitOversizedUnit(unit: string, maxChars: number) {
    const chunks: string[] = [];
    for (let index = 0; index < unit.length; index += maxChars) {
        const chunk = unit.slice(index, index + maxChars).trim();
        if (chunk) {
            chunks.push(chunk);
        }
    }
    return chunks;
}

export function chunkSearchText(
    text: string,
    maxChars = 1200,
): SearchTextChunk[] {
    const limit = Math.max(24, Math.floor(maxChars));
    const units = text
        .replace(/\r\n/g, "\n")
        .split(/\n{2,}|(?<=[。！？.!?])\s+/)
        .map((unit) => unit.trim())
        .filter(Boolean)
        .flatMap((unit) =>
            unit.length > limit ? splitOversizedUnit(unit, limit) : [unit],
        );

    const chunks: SearchTextChunk[] = [];
    let current = "";

    for (const unit of units) {
        if (!current) {
            current = unit;
            continue;
        }

        const candidate = `${current}\n${unit}`;
        if (candidate.length <= limit) {
            current = candidate;
            continue;
        }

        chunks.push({ index: chunks.length, text: current });
        current = unit;
    }

    if (current) {
        chunks.push({ index: chunks.length, text: current });
    }

    return chunks;
}
