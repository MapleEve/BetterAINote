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

const LEGACY_SKELETON_CLASS_NAMES = new Set([
    "empty-hint",
    "eh-h",
    "eh-t",
    "speaker",
    "sp-row",
    "sp-row-meta",
    "sp-rows",
    "sr-section",
    "sr-section-head",
    "sr-section-sub",
    "sr-segments",
    "transcript",
    "transcript-body",
    "transcript-head",
    "t-pane",
    "turn",
    "ts",
]);

function sanitizeSkeletonClassName(className?: string) {
    const filteredClassName = className
        ?.split(/\s+/)
        .filter(Boolean)
        .filter((item) => !LEGACY_SKELETON_CLASS_NAMES.has(item))
        .join(" ");

    return filteredClassName || undefined;
}

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
    className,
    lines = 3,
}: {
    className?: string;
    lines?: number;
}) {
    return (
        <div
            className={sanitizeSkeletonClassName(className)}
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

function TranscriptTurnSkeleton({ className }: { className?: string }) {
    return (
        <section
            className={sanitizeSkeletonClassName(className)}
            data-sot-item="recording-transcription-skeleton-turn"
        >
            <div data-sot-list="recording-transcription-skeleton-meta">
                <SkeletonLine size="speaker" />
                <SkeletonLine size="time" />
            </div>
            <SkeletonLineGroup lines={2} />
        </section>
    );
}

export function TranscriptOutputSkeleton({
    className,
}: {
    className?: string;
}) {
    return (
        <Card
            className={sanitizeSkeletonClassName(className)}
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

export function TranscriptReviewSkeleton({
    className,
}: {
    className?: string;
}) {
    return (
        <section
            className={sanitizeSkeletonClassName(className)}
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

export function SpeakerReviewSkeleton({ className }: { className?: string }) {
    return (
        <Card
            className={sanitizeSkeletonClassName(className)}
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
