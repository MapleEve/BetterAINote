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

function SkeletonLine({
    size = "line-medium",
}: {
    size?: TranscriptionPlaceholderSize;
}) {
    let className: string;

    switch (size) {
        case "action":
            className = "h-[26px] w-[72px]";
            break;
        case "description":
            className = "h-[13px] w-full max-w-[220px]";
            break;
        case "field-control":
            className = "h-[13px] w-[132px]";
            break;
        case "field-label":
            className = "h-[13px] w-24";
            break;
        case "line-long":
            className = "h-[13px] w-[92%]";
            break;
        case "line-medium":
            className = "h-[13px] w-3/4";
            break;
        case "line-short":
            className = "h-[13px] w-3/5";
            break;
        case "speaker":
            className = "h-[13px] w-24";
            break;
        case "status":
            className = "h-[13px] w-[76px]";
            break;
        case "time":
            className = "h-[13px] w-16";
            break;
        case "title":
            className = "h-4 w-32";
            break;
    }

    return (
        <Skeleton
            aria-hidden="true"
            className={className}
            size="default"
            variant="default"
        />
    );
}

function SkeletonLineGroup({ lines = 3 }: { lines?: number }) {
    return (
        <div className="flex flex-col gap-[7px]">
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
        <section className="flex flex-col gap-[7px] border-b border-dashed py-2.5 pb-4 last:border-b-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
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
            aria-busy={true}
            aria-label="正在加载转写结果"
            aria-live="polite"
            className="min-h-0 flex-1 gap-0"
            hasNoPadding
        >
            <CardHeader className="grid-cols-[minmax(0,1fr)_auto] items-start gap-3 max-[860px]:grid-cols-1">
                <div className="flex min-w-0 flex-col gap-1.5">
                    <CardTitle>
                        <SkeletonLine size="title" />
                    </CardTitle>
                    <CardDescription>
                        <SkeletonLine size="description" />
                    </CardDescription>
                </div>
                <CardAction className="flex min-w-0 items-center justify-end max-[860px]:justify-start">
                    <SkeletonLine size="action" />
                </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-2.5">
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
            aria-busy={true}
            aria-label="正在加载转写复核"
            aria-live="polite"
            className="flex flex-col gap-2.5 border-t pt-3 pb-1"
        >
            <div className="flex min-w-0 flex-wrap items-center gap-2">
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
        <section className="flex flex-col gap-[11px] p-3.5">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
                <SkeletonLine size="speaker" />
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
                <SkeletonLine size="status" />
                <SkeletonLine size="time" />
            </div>
            <div className="flex flex-col gap-[7px]">
                <TranscriptTurnSkeleton />
                <TranscriptTurnSkeleton />
            </div>
            <Field className="gap-2">
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
            aria-busy={true}
            aria-label="正在加载说话人复核"
            aria-live="polite"
            className="min-h-0 flex-1 gap-0"
            hasNoPadding
        >
            <CardHeader className="grid-cols-[minmax(0,1fr)_auto] items-start gap-3 max-[860px]:grid-cols-1">
                <div className="flex min-w-0 flex-col gap-1.5">
                    <CardTitle>
                        <SkeletonLine size="title" />
                    </CardTitle>
                    <CardDescription>
                        <SkeletonLine size="description" />
                    </CardDescription>
                </div>
                <CardAction className="flex min-w-0 items-center justify-end max-[860px]:justify-start">
                    <SkeletonLine size="action" />
                </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-2.5">
                <TranscriptReviewSkeleton />
            </CardContent>
            <CardContent className="flex flex-col gap-2.5">
                <SpeakerCardSkeleton />
                <SpeakerCardSkeleton />
            </CardContent>
        </Card>
    );
}
