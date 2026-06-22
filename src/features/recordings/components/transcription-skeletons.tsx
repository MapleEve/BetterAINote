"use client";

import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Field, FieldContent, FieldTitle } from "@/components/ui/field";
import { Skeleton, type SkeletonSize } from "@/components/ui/skeleton";

type TranscriptionPlaceholderSize =
    | "action"
    | "description"
    | "field-control"
    | "field-label"
    | "line-long"
    | "line-medium"
    | "line-short"
    | "speaker"
    | "status"
    | "time"
    | "title";

const transcriptionPlaceholderSizes = {
    action: "recordingTranscriptionAction",
    description: "recordingTranscriptionDescription",
    "field-control": "recordingTranscriptionFieldControl",
    "field-label": "recordingTranscriptionFieldLabel",
    "line-long": "recordingTranscriptionLineLong",
    "line-medium": "recordingTranscriptionLineMedium",
    "line-short": "recordingTranscriptionLineShort",
    speaker: "recordingTranscriptionSpeaker",
    status: "recordingTranscriptionStatus",
    time: "recordingTranscriptionTime",
    title: "recordingTranscriptionTitle",
} satisfies Record<TranscriptionPlaceholderSize, SkeletonSize>;

function SkeletonLine({
    size = "line-medium",
}: {
    size?: TranscriptionPlaceholderSize;
}) {
    return (
        <Skeleton
            data-sot-part="recording-transcription-skeleton-line"
            data-sot-size={size}
            size={transcriptionPlaceholderSizes[size]}
            variant="recordingTranscription"
        />
    );
}

function SkeletonLineGroup({ lines = 3 }: { lines?: number }) {
    return (
        <div
            className="flex flex-col gap-[7px]"
            data-sot-list="recording-transcription-skeleton-lines"
        >
            {Array.from({ length: lines }, (_, index) => `line-${index}`).map(
                (lineId, index) => (
                    <SkeletonLine
                        key={lineId}
                        size={
                            index % 3 === 0
                                ? "line-long"
                                : index % 3 === 1
                                  ? "line-medium"
                                  : "line-short"
                        }
                    />
                ),
            )}
        </div>
    );
}

function TranscriptTurnSkeleton() {
    return (
        <section
            className="flex flex-col gap-[7px] border-b border-dashed py-2.5 pb-4 last:border-b-0"
            data-sot-item="recording-transcription-skeleton-turn"
        >
            <div
                className="flex min-w-0 flex-wrap items-center gap-2"
                data-sot-list="recording-transcription-skeleton-meta"
            >
                <SkeletonLine size="speaker" />
                <SkeletonLine size="time" />
            </div>
            <SkeletonLineGroup lines={2} />
        </section>
    );
}

export function TranscriptOutputSkeleton() {
    return (
        <Card
            className="min-h-0 flex-1 gap-0"
            data-sot-panel="recording-transcription-skeleton"
            data-sot-section="recording-transcription-output-skeleton"
            hasNoPadding
        >
            <CardHeader
                className="grid-cols-[minmax(0,1fr)_auto] items-start gap-3 max-[860px]:grid-cols-1"
                data-sot-part="recording-transcription-skeleton-header"
            >
                <div
                    className="flex min-w-0 flex-col gap-1.5"
                    data-sot-part="recording-transcription-skeleton-heading"
                >
                    <CardTitle>
                        <SkeletonLine size="title" />
                    </CardTitle>
                    <CardDescription>
                        <SkeletonLine size="description" />
                    </CardDescription>
                </div>
                <CardAction
                    className="flex min-w-0 items-center justify-end max-[860px]:justify-start"
                    data-sot-part="recording-transcription-skeleton-action"
                >
                    <SkeletonLine size="action" />
                </CardAction>
            </CardHeader>
            <CardContent
                className="flex flex-col gap-2.5"
                data-sot-part="recording-transcription-skeleton-body"
            >
                <TranscriptTurnSkeleton />
                <TranscriptTurnSkeleton />
                <TranscriptTurnSkeleton />
            </CardContent>
        </Card>
    );
}

export function TranscriptReviewSkeleton() {
    return (
        <section
            className="flex flex-col gap-2.5 border-t pt-3 pb-1"
            data-sot-panel="recording-transcription-review-skeleton"
        >
            <div
                className="flex min-w-0 flex-wrap items-center gap-2"
                data-sot-list="recording-transcription-skeleton-meta"
            >
                <SkeletonLine size="speaker" />
                <SkeletonLine size="time" />
                <SkeletonLine size="status" />
            </div>
            <SkeletonLineGroup lines={6} />
        </section>
    );
}

function SpeakerCardSkeleton() {
    return (
        <section
            className="flex flex-col gap-[11px] p-3.5"
            data-sot-item="recording-transcription-speaker-card-skeleton"
        >
            <div
                className="flex min-w-0 flex-wrap items-center gap-2"
                data-sot-list="recording-transcription-speaker-card-meta"
            >
                <SkeletonLine size="speaker" />
            </div>
            <div
                className="flex min-w-0 flex-wrap items-center gap-2"
                data-sot-list="recording-transcription-speaker-card-meta"
            >
                <SkeletonLine size="status" />
                <SkeletonLine size="time" />
            </div>
            <div
                className="flex flex-col gap-[7px]"
                data-sot-list="recording-transcription-speaker-card-turns"
            >
                <TranscriptTurnSkeleton />
                <TranscriptTurnSkeleton />
            </div>
            <Field
                className="gap-2"
                data-sot-part="recording-transcription-speaker-card-field"
            >
                <FieldContent>
                    <FieldTitle>
                        <SkeletonLine size="field-label" />
                    </FieldTitle>
                    <SkeletonLine size="field-control" />
                </FieldContent>
            </Field>
        </section>
    );
}

export function SpeakerReviewSkeleton() {
    return (
        <Card
            className="min-h-0 flex-1 gap-0"
            data-sot-panel="recording-transcription-speaker-review-skeleton"
            hasNoPadding
        >
            <CardHeader
                className="grid-cols-[minmax(0,1fr)_auto] items-start gap-3 max-[860px]:grid-cols-1"
                data-sot-part="recording-transcription-skeleton-header"
            >
                <div
                    className="flex min-w-0 flex-col gap-1.5"
                    data-sot-part="recording-transcription-skeleton-heading"
                >
                    <CardTitle>
                        <SkeletonLine size="title" />
                    </CardTitle>
                    <CardDescription>
                        <SkeletonLine size="description" />
                    </CardDescription>
                </div>
                <CardAction
                    className="flex min-w-0 items-center justify-end max-[860px]:justify-start"
                    data-sot-part="recording-transcription-skeleton-action"
                >
                    <SkeletonLine size="action" />
                </CardAction>
            </CardHeader>
            <CardContent
                className="flex flex-col gap-2.5"
                data-sot-part="recording-transcription-skeleton-body"
            >
                <TranscriptReviewSkeleton />
            </CardContent>
            <CardContent
                className="flex flex-col gap-2.5"
                data-sot-list="recording-transcription-speaker-cards"
            >
                <SpeakerCardSkeleton />
                <SpeakerCardSkeleton />
            </CardContent>
        </Card>
    );
}
