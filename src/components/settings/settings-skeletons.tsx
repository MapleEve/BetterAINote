"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const makeSkeletonKeys = (prefix: string, count: number) =>
    Array.from({ length: count }, (_, index) => `${prefix}-${index + 1}`);

interface SettingsCardSkeletonProps {
    className?: string;
    fields?: number;
}

export function SettingsCardSkeleton({
    className,
    fields = 2,
}: SettingsCardSkeletonProps) {
    return (
        <div
            className={cn(
                "glass-surface content-fade-in flex flex-col gap-5 rounded-[1.1rem] p-6",
                className,
            )}
        >
            <div className="flex flex-col gap-2">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-4 w-2/3" />
            </div>

            <div className="flex flex-col gap-4">
                {makeSkeletonKeys("field", fields).map((fieldKey, index) => (
                    <div
                        key={fieldKey}
                        className="rounded-2xl border border-white/8 bg-white/5 p-4"
                    >
                        <div className="mb-3 flex items-center justify-between gap-4">
                            <Skeleton className="h-4 w-32" />
                            {index === 0 ? (
                                <Skeleton className="h-6 w-11 rounded-full" />
                            ) : null}
                        </div>
                        <Skeleton className="h-10 w-full rounded-xl" />
                    </div>
                ))}
            </div>
        </div>
    );
}

interface SettingsSectionSkeletonProps {
    cards?: number;
    className?: string;
    fieldsPerCard?: number;
}

export function SettingsSectionSkeleton({
    cards = 2,
    className,
    fieldsPerCard = 2,
}: SettingsSectionSkeletonProps) {
    return (
        <div className={cn("flex flex-col gap-6", className)}>
            <div className="flex flex-col gap-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-72" />
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
                {makeSkeletonKeys("settings-card", cards).map((cardKey) => (
                    <SettingsCardSkeleton
                        key={cardKey}
                        fields={fieldsPerCard}
                    />
                ))}
            </div>
        </div>
    );
}

interface SettingsListSkeletonProps {
    rows?: number;
}

export function SettingsListSkeleton({ rows = 3 }: SettingsListSkeletonProps) {
    return (
        <div className="space-y-3">
            {makeSkeletonKeys("settings-row", rows).map((rowKey) => (
                <div key={rowKey} className="rounded-lg border bg-muted/20 p-3">
                    <div className="mb-3 flex flex-wrap gap-3">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-3 w-28" />
                    </div>
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
                        <Skeleton className="h-10 rounded-xl" />
                        <Skeleton className="h-9 w-16 rounded-full" />
                        <Skeleton className="h-9 w-16 rounded-full" />
                    </div>
                </div>
            ))}
        </div>
    );
}
