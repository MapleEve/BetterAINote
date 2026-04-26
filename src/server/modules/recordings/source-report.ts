import { eq } from "drizzle-orm";
import { db } from "@/db";
import { recordings } from "@/db/schema/library";
import { sourceArtifacts } from "@/db/schema/transcripts";
import { findOwnedRecording } from "./ownership";

type SourceArtifact = typeof sourceArtifacts.$inferSelect;

type PublicTranscriptSegment = {
    speaker: string;
    startMs: number | null;
    endMs: number | null;
    text: string;
};

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
    const summaryReady = Boolean(summaryArtifact?.markdownContent?.trim());
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
        summaryMarkdown: summaryArtifact?.markdownContent ?? null,
        detail: buildPublicDetail(
            detailArtifact,
            recording.sourceProvider,
            availableSections,
        ),
    };
}
