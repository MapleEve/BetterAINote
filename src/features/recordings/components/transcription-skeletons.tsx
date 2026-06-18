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
import { Skeleton } from "@/components/ui/skeleton";

function SkeletonLine({
    size = "line-medium",
}: {
    size?: string;
}) {
    return (
        <Skeleton
            data-sot-part="recording-transcription-skeleton-line"
            data-sot-size={size}
        />
    );
}

function SkeletonLineGroup({
    lines = 3,
}: {
    lines?: number;
}) {
    return (
        <div data-sot-list="recording-transcription-skeleton-lines">
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
        <section data-sot-item="recording-transcription-skeleton-turn">
            <div data-sot-list="recording-transcription-skeleton-meta">
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
            data-sot-panel="recording-transcription-skeleton"
            data-sot-section="recording-transcription-output-skeleton"
            hasNoPadding
        >
            <CardHeader data-sot-part="recording-transcription-skeleton-header">
                <div data-sot-part="recording-transcription-skeleton-heading">
                    <CardTitle>
                        <SkeletonLine size="title" />
                    </CardTitle>
                    <CardDescription>
                        <SkeletonLine size="description" />
                    </CardDescription>
                </div>
                <CardAction data-sot-part="recording-transcription-skeleton-action">
                    <SkeletonLine size="action" />
                </CardAction>
            </CardHeader>
            <CardContent data-sot-part="recording-transcription-skeleton-body">
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
            data-sot-panel="recording-transcription-review-skeleton"
        >
            <div data-sot-list="recording-transcription-skeleton-meta">
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
        <section data-sot-item="recording-transcription-speaker-card-skeleton">
            <div data-sot-list="recording-transcription-speaker-card-meta">
                <SkeletonLine size="speaker" />
            </div>
            <div data-sot-list="recording-transcription-speaker-card-meta">
                <SkeletonLine size="status" />
                <SkeletonLine size="time" />
            </div>
            <div data-sot-list="recording-transcription-speaker-card-turns">
                <TranscriptTurnSkeleton />
                <TranscriptTurnSkeleton />
            </div>
            <Field data-sot-part="recording-transcription-speaker-card-field">
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
            data-sot-panel="recording-transcription-speaker-review-skeleton"
            hasNoPadding
        >
            <CardHeader data-sot-part="recording-transcription-skeleton-header">
                <div data-sot-part="recording-transcription-skeleton-heading">
                    <CardTitle>
                        <SkeletonLine size="title" />
                    </CardTitle>
                    <CardDescription>
                        <SkeletonLine size="description" />
                    </CardDescription>
                </div>
                <CardAction data-sot-part="recording-transcription-skeleton-action">
                    <SkeletonLine size="action" />
                </CardAction>
            </CardHeader>
            <CardContent data-sot-part="recording-transcription-skeleton-body">
                <TranscriptReviewSkeleton />
            </CardContent>
            <CardContent data-sot-list="recording-transcription-speaker-cards">
                <SpeakerCardSkeleton />
                <SpeakerCardSkeleton />
            </CardContent>
        </Card>
    );
}
