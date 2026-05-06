"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function SkeletonLineGroup({
    className,
    lines = 3,
}: {
    className?: string;
    lines?: number;
}) {
    return (
        <div className={cn("space-y-2", className)}>
            {Array.from({ length: lines }, (_, index) => `line-${index}`).map(
                (lineId, index) => (
                    <Skeleton
                        key={lineId}
                        className={cn(
                            "h-3",
                            index === 0 && "w-2/3",
                            index === lines - 1 && "w-4/5",
                        )}
                    />
                ),
            )}
        </div>
    );
}

function TranscriptTurnSkeleton({ className }: { className?: string }) {
    return (
        <div className={cn("rounded-2xl bg-muted/35 p-4", className)}>
            <div className="mb-3 flex items-center gap-2">
                <Skeleton className="h-3 w-20 rounded-full" />
                <Skeleton className="h-3 w-24 rounded-full" />
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
        <div
            className={cn(
                "rounded-2xl border border-white/10 bg-background/25 p-4",
                className,
            )}
        >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-52 max-w-full" />
                </div>
                <Skeleton className="h-9 w-24 rounded-full" />
            </div>
            <Skeleton className="mt-4 h-12 rounded-xl" />
            <div className="mt-4 space-y-3">
                <TranscriptTurnSkeleton />
                <TranscriptTurnSkeleton />
                <TranscriptTurnSkeleton className="hidden sm:block" />
            </div>
            <div className="mt-4 flex gap-3 border-t pt-3">
                <Skeleton className="h-3 w-16 rounded-full" />
                <Skeleton className="h-3 w-16 rounded-full" />
                <Skeleton className="h-3 w-16 rounded-full" />
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
        <div className={cn("space-y-3", className)}>
            <div className="flex flex-wrap gap-3">
                <Skeleton className="h-3 w-24 rounded-full" />
                <Skeleton className="h-3 w-20 rounded-full" />
                <Skeleton className="h-3 w-32 rounded-full" />
                <Skeleton className="h-3 w-16 rounded-full" />
            </div>
            <div className="max-h-72 rounded-2xl bg-background/45 p-4">
                <SkeletonLineGroup lines={6} />
            </div>
        </div>
    );
}

function SpeakerCardSkeleton() {
    return (
        <div className="space-y-4 rounded-2xl border border-border/55 bg-background/35 p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-36" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <div className="grid gap-2 md:grid-cols-3">
                <TranscriptTurnSkeleton />
                <TranscriptTurnSkeleton />
                <TranscriptTurnSkeleton className="hidden md:block" />
            </div>
            <div className="grid gap-3 border-t pt-4 md:grid-cols-[180px_1fr] md:items-center">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 rounded-xl" />
            </div>
        </div>
    );
}

export function SpeakerReviewSkeleton({ className }: { className?: string }) {
    return (
        <div className={cn("space-y-4 border-t pt-4", className)}>
            <div className="space-y-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="flex items-center gap-3">
                        <Skeleton className="h-9 w-9 rounded-2xl" />
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-28" />
                            <Skeleton className="h-3 w-56 max-w-full" />
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Skeleton className="h-9 w-24 rounded-full" />
                        <Skeleton className="h-9 w-20 rounded-full" />
                        <Skeleton className="h-9 w-16 rounded-full" />
                    </div>
                </div>
                <TranscriptReviewSkeleton />
            </div>
            <div className="space-y-4">
                <SpeakerCardSkeleton />
                <SpeakerCardSkeleton />
            </div>
        </div>
    );
}
