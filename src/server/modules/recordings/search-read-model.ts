export type SearchEntityType = "recording" | "transcript" | "speaker" | "tag";

export type SearchDocumentDraft = {
    userId: string;
    entityType: SearchEntityType;
    entityId: string;
    recordingId?: string | null;
    title?: string | null;
    body: string;
    speaker?: string | null;
    tags?: string[] | null;
    source?: string | null;
    transcriptOrigin?: string | null;
    sourceProvider?: string | null;
    startMs?: number | null;
    endMs?: number | null;
    sortSeqMs?: number | null;
};

type RecordingSearchSource = {
    id: string;
    userId: string;
    filename: string;
    sourceProvider?: string | null;
    sourceRecordingId?: string | null;
    startTime: Date;
};

type TranscriptSegmentSearchSource = {
    id: string;
    userId: string;
    recordingId: string;
    transcriptOrigin: string;
    rawSpeakerLabel?: string | null;
    text: string;
    startMs?: number | null;
    endMs?: number | null;
    sortSeqMs: number;
};

type SpeakerSearchSource = {
    id: string;
    userId: string;
    displayName?: string | null;
};

type TagSearchSource = {
    id: string;
    userId: string;
    name: string;
};

type RecordingContext = {
    tags?: string[] | null;
    speakers?: string[] | null;
};

type TranscriptContext = {
    recording?: {
        filename?: string | null;
        sourceProvider?: string | null;
    } | null;
    tags?: string[] | null;
};

function compactLines(values: Array<string | null | undefined>) {
    return values
        .map((value) => value?.trim() ?? "")
        .filter(Boolean)
        .join("\n");
}

export function buildRecordingSearchDocument(
    recording: RecordingSearchSource,
    context: RecordingContext = {},
): SearchDocumentDraft {
    return {
        userId: recording.userId,
        entityType: "recording",
        entityId: recording.id,
        recordingId: recording.id,
        title: recording.filename,
        body: compactLines([recording.filename]),
        tags: context.tags ?? null,
        source: recording.sourceProvider ?? null,
        sourceProvider: recording.sourceProvider ?? null,
        sortSeqMs: recording.startTime.getTime(),
    };
}

export function buildTranscriptSearchDocument(
    segment: TranscriptSegmentSearchSource,
    context: TranscriptContext = {},
): SearchDocumentDraft {
    return {
        userId: segment.userId,
        entityType: "transcript",
        entityId: segment.id,
        recordingId: segment.recordingId,
        title: context.recording?.filename ?? null,
        body: segment.text,
        speaker: segment.rawSpeakerLabel ?? null,
        tags: context.tags ?? null,
        source: context.recording?.sourceProvider ?? null,
        sourceProvider: context.recording?.sourceProvider ?? null,
        transcriptOrigin: segment.transcriptOrigin,
        startMs: segment.startMs ?? null,
        endMs: segment.endMs ?? null,
        sortSeqMs: segment.sortSeqMs,
    };
}

export function buildSpeakerSearchDocument(
    speaker: SpeakerSearchSource,
): SearchDocumentDraft {
    const displayName = speaker.displayName?.trim() || null;

    return {
        userId: speaker.userId,
        entityType: "speaker",
        entityId: speaker.id,
        title: displayName,
        body: displayName ?? "",
        speaker: displayName,
    };
}

export function buildTagSearchDocument(
    tag: TagSearchSource,
): SearchDocumentDraft {
    return {
        userId: tag.userId,
        entityType: "tag",
        entityId: tag.id,
        title: tag.name,
        body: tag.name,
        tags: [tag.name],
    };
}
