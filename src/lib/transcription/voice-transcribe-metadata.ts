import type {
    VoiceTranscribePayload,
    VoiceTranscribeSegment,
} from "@/lib/transcription/providers/types";

export function deriveSpeakerMapFromVoiceTranscribePayload(
    payload: VoiceTranscribePayload | null | undefined,
) {
    if (!payload) {
        return null;
    }

    const entries = Object.entries(payload.speakerMap ?? {});
    const nextMap: Record<string, string> = {};

    for (const [label, match] of entries) {
        const matchedName = match.matchedName?.trim();
        if (matchedName) {
            nextMap[label] = matchedName;
        }
    }

    if (Object.keys(nextMap).length > 0) {
        return nextMap;
    }

    for (const segment of payload.segments ?? []) {
        const matchedName = segment.speakerName?.trim();
        if (matchedName) {
            nextMap[segment.speakerLabel] = matchedName;
        }
    }

    return Object.keys(nextMap).length > 0 ? nextMap : null;
}

export function mergeSpeakerMaps(
    savedSpeakerMap: Record<string, string> | null | undefined,
    payload: VoiceTranscribePayload | null | undefined,
) {
    if (savedSpeakerMap) {
        return savedSpeakerMap;
    }

    return deriveSpeakerMapFromVoiceTranscribePayload(payload);
}

export function applySpeakerMap(
    text: string,
    speakerMap: Record<string, string> | null | undefined,
) {
    if (!speakerMap || Object.keys(speakerMap).length === 0) {
        return text;
    }

    let displayText = text;
    const entries = Object.entries(speakerMap).sort(
        ([left], [right]) => right.length - left.length,
    );

    for (const [label, name] of entries) {
        if (!name.trim()) continue;
        const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        displayText = displayText.replace(new RegExp(escaped, "gi"), name);
    }

    return displayText;
}

export function buildTranscriptMetrics(
    text: string,
    speakerMap: Record<string, string> | null,
) {
    const trimmed = text.trim();

    return {
        wordCount: trimmed ? trimmed.split(/\s+/).length : 0,
        characterCount: text.length,
        mappedSpeakerCount: Object.values(speakerMap ?? {}).filter((name) =>
            name.trim(),
        ).length,
    };
}

export function buildDisplaySegments(
    payload: VoiceTranscribePayload | null | undefined,
    speakerMap: Record<string, string> | null | undefined,
) {
    if (!payload) {
        return null;
    }

    return payload.segments.map((segment: VoiceTranscribeSegment) => ({
        ...segment,
        displaySpeaker:
            speakerMap?.[segment.speakerLabel] ||
            segment.speakerName?.trim() ||
            segment.speakerLabel,
    }));
}
