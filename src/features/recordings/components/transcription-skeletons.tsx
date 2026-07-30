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

function SkeletonLineGroup({ lines = 3 }: { lines?: number }) {
    return (
        <div className="grid gap-2">
            {Array.from({ length: lines }, (_, index) => `line-${index}`).map(
                (lineId) => (
                    <Skeleton
                        aria-hidden="true"
                        className="h-3 w-full"
                        key={lineId}
                    />
                ),
            )}
        </div>
    );
}

function TranscriptTurnSkeleton() {
    return (
        <section className="grid gap-2 border-b border-dashed py-4 last:border-b-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
                <Skeleton aria-hidden="true" className="h-3 w-24" />
                <Skeleton aria-hidden="true" className="h-3 w-16" />
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
            <CardHeader className="items-start gap-3 py-4 max-[860px]:grid-cols-1">
                <div className="flex min-w-0 flex-col gap-1.5">
                    <CardTitle>
                        <Skeleton aria-hidden="true" className="h-4 w-32" />
                    </CardTitle>
                    <CardDescription>
                        <Skeleton
                            aria-hidden="true"
                            className="h-3 w-full max-w-56"
                        />
                    </CardDescription>
                </div>
                <CardAction className="max-[860px]:col-start-1 max-[860px]:row-start-3 max-[860px]:justify-self-start max-[860px]:justify-start">
                    <Skeleton aria-hidden="true" className="h-7 w-20" />
                </CardAction>
            </CardHeader>
            <CardContent className="grid gap-3 pb-4">
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
            className="grid gap-3 border-t pt-3 pb-1"
        >
            <div className="flex min-w-0 flex-wrap items-center gap-2">
                <Skeleton aria-hidden="true" className="h-3 w-24" />
                <Skeleton aria-hidden="true" className="h-3 w-16" />
                <Skeleton aria-hidden="true" className="h-3 w-20" />
            </div>
            <SkeletonLineGroup lines={6} />
        </section>
    );
}

function SpeakerCardSkeleton() {
    return (
        <section className="grid gap-3 py-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
                <Skeleton aria-hidden="true" className="h-3 w-24" />
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
                <Skeleton aria-hidden="true" className="h-3 w-20" />
                <Skeleton aria-hidden="true" className="h-3 w-16" />
            </div>
            <div className="grid gap-2">
                <TranscriptTurnSkeleton />
                <TranscriptTurnSkeleton />
            </div>
            <Field className="gap-2">
                <FieldContent>
                    <FieldTitle>
                        <Skeleton aria-hidden="true" className="h-3 w-24" />
                    </FieldTitle>
                    <Skeleton aria-hidden="true" className="h-3 w-32" />
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
            <CardHeader className="items-start gap-3 py-4 max-[860px]:grid-cols-1">
                <div className="flex min-w-0 flex-col gap-1.5">
                    <CardTitle>
                        <Skeleton aria-hidden="true" className="h-4 w-32" />
                    </CardTitle>
                    <CardDescription>
                        <Skeleton
                            aria-hidden="true"
                            className="h-3 w-full max-w-56"
                        />
                    </CardDescription>
                </div>
                <CardAction className="max-[860px]:col-start-1 max-[860px]:row-start-3 max-[860px]:justify-self-start max-[860px]:justify-start">
                    <Skeleton aria-hidden="true" className="h-7 w-20" />
                </CardAction>
            </CardHeader>
            <CardContent className="grid gap-3">
                <TranscriptReviewSkeleton />
            </CardContent>
            <CardContent className="grid gap-3 pb-4">
                <SpeakerCardSkeleton />
                <SpeakerCardSkeleton />
            </CardContent>
        </Card>
    );
}
