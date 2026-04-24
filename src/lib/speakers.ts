import { and, eq, notInArray } from "drizzle-orm";
import { db } from "@/db";
import { transcriptions } from "@/db/schema/transcripts";
import { recordingSpeakers, speakerProfiles } from "@/db/schema/voiceprints";
import type { TranscriptionSpeakerSegment } from "@/lib/transcription/providers/types";

const SAMPLE_MAX_COUNT = 3;
const SAMPLE_MAX_MERGE_GAP_MS = 1_500;
const SAMPLE_MAX_DURATION_MS = 12_000;
const SAMPLE_MAX_TEXT_LENGTH = 180;

interface SampleSegment {
    startMs: number | null;
    endMs: number | null;
    text: string | null;
}

export interface SpeakerReviewSample {
    startMs: number | null;
    endMs: number | null;
    text: string | null;
}

export interface SpeakerReviewProfileOption {
    id: string;
    displayName: string;
    voiceprintRef: string | null;
    hasVoiceprint: boolean;
}

export interface SpeakerReviewItem {
    rawLabel: string;
    matchedProfileId: string | null;
    matchedProfileName: string | null;
    hasVoiceprint: boolean;
    sampleSegments: SpeakerReviewSample[];
    sampleCount: number;
    hasPlayableSample: boolean;
    segmentCount: number;
    updatedAt: string;
}

function extractSpeakerLabelsFromTranscript(text: string): string[] {
    const labels: string[] = [];
    const seen = new Set<string>();

    for (const match of text.matchAll(/^([^:\n]{1,80}):\s/gm)) {
        const label = match[1]?.trim();
        if (!label || seen.has(label)) {
            continue;
        }
        seen.add(label);
        labels.push(label);
    }

    return labels;
}

function buildSampleSegments(
    label: string,
    segments: TranscriptionSpeakerSegment[],
) {
    const speakerSegments = segments
        .filter((segment) => segment.speaker === label)
        .sort(
            (left, right) =>
                (left.startMs ?? Number.MAX_SAFE_INTEGER) -
                (right.startMs ?? Number.MAX_SAFE_INTEGER),
        );

    const mergedSamples: SampleSegment[] = [];

    for (const segment of speakerSegments) {
        const text = segment.text?.trim() ?? "";
        const currentStart = segment.startMs ?? null;
        const currentEnd = segment.endMs ?? segment.startMs ?? null;

        const previous = mergedSamples.at(-1);
        const previousEnd = previous?.endMs ?? null;
        const gapMs =
            previousEnd != null && currentStart != null
                ? currentStart - previousEnd
                : Number.POSITIVE_INFINITY;
        const previousDuration =
            previous?.startMs != null && previous?.endMs != null
                ? previous.endMs - previous.startMs
                : 0;
        const currentDuration =
            currentStart != null && currentEnd != null
                ? currentEnd - currentStart
                : 0;
        const mergedDuration = previousDuration + currentDuration;
        const mergedTextLength =
            (previous?.text?.length ?? 0) + (text ? text.length + 1 : 0);

        if (
            previous &&
            gapMs >= 0 &&
            gapMs <= SAMPLE_MAX_MERGE_GAP_MS &&
            mergedDuration <= SAMPLE_MAX_DURATION_MS &&
            mergedTextLength <= SAMPLE_MAX_TEXT_LENGTH
        ) {
            previous.endMs = currentEnd ?? previous.endMs;
            previous.text = [previous.text, text].filter(Boolean).join(" ");
            continue;
        }

        mergedSamples.push({
            startMs: currentStart,
            endMs: currentEnd,
            text: text || null,
        });
    }

    return mergedSamples
        .sort((left, right) => {
            const leftTextLength = left.text?.trim().length ?? 0;
            const rightTextLength = right.text?.trim().length ?? 0;
            if (rightTextLength !== leftTextLength) {
                return rightTextLength - leftTextLength;
            }

            const leftDuration =
                left.startMs != null && left.endMs != null
                    ? Math.max(0, left.endMs - left.startMs)
                    : 0;
            const rightDuration =
                right.startMs != null && right.endMs != null
                    ? Math.max(0, right.endMs - right.startMs)
                    : 0;
            if (rightDuration !== leftDuration) {
                return rightDuration - leftDuration;
            }

            return (
                (left.startMs ?? Number.MAX_SAFE_INTEGER) -
                (right.startMs ?? Number.MAX_SAFE_INTEGER)
            );
        })
        .slice(0, SAMPLE_MAX_COUNT);
}

export function buildSpeakerReviewSnapshot(input: {
    speakers: Array<{
        rawLabel: string;
        matchedProfileId: string | null;
        sampleSegments: Array<{
            startMs: number | null;
            endMs: number | null;
            text?: string | null;
        }> | null;
        segmentCount: number;
        updatedAt: Date;
    }>;
    profiles: Array<{
        id: string;
        displayName: string;
        voiceprintRef: string | null;
    }>;
}) {
    const profileById = new Map(
        input.profiles.map((profile) => [profile.id, profile]),
    );

    const profiles: SpeakerReviewProfileOption[] = input.profiles
        .map((profile) => ({
            id: profile.id,
            displayName: profile.displayName,
            voiceprintRef: profile.voiceprintRef,
            hasVoiceprint: Boolean(profile.voiceprintRef),
        }))
        .sort((left, right) =>
            left.displayName.localeCompare(right.displayName),
        );

    const speakers: SpeakerReviewItem[] = input.speakers
        .map((speaker) => {
            const matchedProfile = speaker.matchedProfileId
                ? (profileById.get(speaker.matchedProfileId) ?? null)
                : null;
            const sampleSegments =
                speaker.sampleSegments?.map((segment) => ({
                    startMs: segment.startMs,
                    endMs: segment.endMs,
                    text: segment.text ?? null,
                })) ?? [];

            return {
                rawLabel: speaker.rawLabel,
                matchedProfileId: speaker.matchedProfileId,
                matchedProfileName: matchedProfile?.displayName ?? null,
                hasVoiceprint: Boolean(matchedProfile?.voiceprintRef),
                sampleSegments,
                sampleCount: sampleSegments.length,
                hasPlayableSample: sampleSegments.some(
                    (segment) =>
                        segment.startMs != null && segment.endMs != null,
                ),
                segmentCount: speaker.segmentCount,
                updatedAt: speaker.updatedAt.toISOString(),
            };
        })
        .sort(
            (left, right) =>
                right.segmentCount - left.segmentCount ||
                left.rawLabel.localeCompare(right.rawLabel),
        );

    return {
        reviewBasis: "private-transcript" as const,
        speakers,
        profiles,
    };
}

export async function syncRecordingSpeakers(input: {
    userId: string;
    recordingId: string;
    transcriptText: string;
    speakerSegments?: TranscriptionSpeakerSegment[];
}) {
    const textLabels = extractSpeakerLabelsFromTranscript(input.transcriptText);
    const segmentLabels = [
        ...new Set(
            (input.speakerSegments ?? []).map((segment) => segment.speaker),
        ),
    ];
    const labels = [...new Set([...textLabels, ...segmentLabels])];

    const existing = await db
        .select()
        .from(recordingSpeakers)
        .where(eq(recordingSpeakers.recordingId, input.recordingId));

    const existingByLabel = new Map(
        existing.map((speaker) => [speaker.rawLabel, speaker]),
    );

    await Promise.all(
        labels.map((label) =>
            db
                .insert(recordingSpeakers)
                .values({
                    userId: input.userId,
                    recordingId: input.recordingId,
                    rawLabel: label,
                    matchedProfileId:
                        existingByLabel.get(label)?.matchedProfileId ?? null,
                    sampleSegments: buildSampleSegments(
                        label,
                        input.speakerSegments ?? [],
                    ),
                    segmentCount: (input.speakerSegments ?? []).filter(
                        (segment) => segment.speaker === label,
                    ).length,
                    updatedAt: new Date(),
                })
                .onConflictDoUpdate({
                    target: [
                        recordingSpeakers.recordingId,
                        recordingSpeakers.rawLabel,
                    ],
                    set: {
                        matchedProfileId:
                            existingByLabel.get(label)?.matchedProfileId ??
                            null,
                        sampleSegments: buildSampleSegments(
                            label,
                            input.speakerSegments ?? [],
                        ),
                        segmentCount: (input.speakerSegments ?? []).filter(
                            (segment) => segment.speaker === label,
                        ).length,
                        updatedAt: new Date(),
                    },
                }),
        ),
    );

    if (labels.length > 0) {
        await db
            .delete(recordingSpeakers)
            .where(
                and(
                    eq(recordingSpeakers.recordingId, input.recordingId),
                    notInArray(recordingSpeakers.rawLabel, labels),
                ),
            );
    }
}

export async function applySpeakerProfileToRecording(input: {
    recordingId: string;
    rawLabel: string;
    profileId: string | null;
}) {
    await db
        .update(recordingSpeakers)
        .set({
            matchedProfileId: input.profileId,
            updatedAt: new Date(),
        })
        .where(
            and(
                eq(recordingSpeakers.recordingId, input.recordingId),
                eq(recordingSpeakers.rawLabel, input.rawLabel),
            ),
        );

    const [transcription] = await db
        .select({
            id: transcriptions.id,
            speakerMap: transcriptions.speakerMap,
        })
        .from(transcriptions)
        .where(eq(transcriptions.recordingId, input.recordingId))
        .limit(1);

    if (!transcription) {
        return;
    }

    const nextSpeakerMap = {
        ...(transcription.speakerMap ?? {}),
    };

    if (!input.profileId) {
        delete nextSpeakerMap[input.rawLabel];
    } else {
        const [profile] = await db
            .select({
                displayName: speakerProfiles.displayName,
            })
            .from(speakerProfiles)
            .where(eq(speakerProfiles.id, input.profileId))
            .limit(1);

        if (profile) {
            nextSpeakerMap[input.rawLabel] = profile.displayName;
        }
    }

    await db
        .update(transcriptions)
        .set({
            speakerMap: nextSpeakerMap,
        })
        .where(eq(transcriptions.id, transcription.id));
}

export async function createSpeakerProfile(
    userId: string,
    displayName: string,
    voiceprintRef?: string | null,
) {
    const normalizedName = displayName.trim();
    const [profile] = await db
        .insert(speakerProfiles)
        .values({
            userId,
            displayName: normalizedName,
            voiceprintRef: voiceprintRef?.trim() || null,
        })
        .onConflictDoUpdate({
            target: [speakerProfiles.userId, speakerProfiles.displayName],
            set: {
                voiceprintRef: voiceprintRef?.trim() || null,
                updatedAt: new Date(),
            },
        })
        .returning();

    return profile;
}
