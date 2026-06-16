"use client";

import { Field, FieldContent, FieldTitle } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";

function mergeSkeletonClassName(baseClassName: string, className?: string) {
    const extraClassName = className
        ?.split(/\s+/)
        .filter(
            (item) =>
                item === "transcript" ||
                item === "t-pane" ||
                item === "turn" ||
                item === "speaker" ||
                item === "sr-section" ||
                item === "sr-segments" ||
                item === "sp-row" ||
                item === "sp-rows",
        )
        .join(" ");

    return [baseClassName, extraClassName].filter(Boolean).join(" ");
}

function SkeletonLineGroup({
    className,
    lines = 3,
}: {
    className?: string;
    lines?: number;
}) {
    return (
        <div className={mergeSkeletonClassName("sr-segments", className)}>
            {Array.from({ length: lines }, (_, index) => `line-${index}`).map(
                (lineId) => (
                    <Skeleton key={lineId} />
                ),
            )}
        </div>
    );
}

function TranscriptTurnSkeleton({ className }: { className?: string }) {
    return (
        <div className={mergeSkeletonClassName("turn", className)}>
            <div className="speaker">
                <Skeleton />
                <Skeleton />
            </div>
            <SkeletonLineGroup lines={2} />
        </div>
    );
}

export function TranscriptOutputSkeleton({
    className,
}: {
    className?: string;
}) {
    return (
        <div className={mergeSkeletonClassName("transcript t-pane", className)}>
            <div className="transcript-head">
                <div>
                    <Skeleton />
                    <Skeleton />
                </div>
                <Skeleton />
            </div>
            <div className="transcript-body">
                <TranscriptTurnSkeleton />
                <TranscriptTurnSkeleton />
                <TranscriptTurnSkeleton />
            </div>
        </div>
    );
}

export function TranscriptReviewSkeleton({
    className,
}: {
    className?: string;
}) {
    return (
        <div className={mergeSkeletonClassName("sr-section", className)}>
            <div className="speaker">
                <Skeleton />
                <Skeleton />
                <Skeleton />
            </div>
            <div className="transcript-body">
                <SkeletonLineGroup lines={6} />
            </div>
        </div>
    );
}

function SpeakerCardSkeleton() {
    return (
        <div className="sp-row">
            <div className="sp-row-meta">
                <Skeleton />
            </div>
            <div className="sp-row-meta">
                <Skeleton />
                <Skeleton />
            </div>
            <div className="sr-segments">
                <TranscriptTurnSkeleton />
                <TranscriptTurnSkeleton />
            </div>
            <Field>
                <FieldContent>
                    <FieldTitle>
                        <Skeleton className="w-24" />
                    </FieldTitle>
                    <Skeleton className="w-32" />
                </FieldContent>
            </Field>
        </div>
    );
}

export function SpeakerReviewSkeleton({ className }: { className?: string }) {
    return (
        <div className={mergeSkeletonClassName("sr-section", className)}>
            <div className="speaker">
                <Skeleton />
                <div>
                    <Skeleton />
                    <Skeleton />
                </div>
                <Skeleton />
            </div>
            <div className="sr-segments">
                <TranscriptReviewSkeleton />
            </div>
            <div className="sp-rows">
                <SpeakerCardSkeleton />
                <SpeakerCardSkeleton />
            </div>
        </div>
    );
}
