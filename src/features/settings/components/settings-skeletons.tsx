"use client";

import type { Ref } from "react";
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
            className={cn("settings-main", className)}
            data-sot-panel="settings-card-skeleton"
            data-sot-state="loading"
        >
            <div className="empty-hint">
                <Skeleton className="eh-t" />
                <Skeleton className="eh-h" />
            </div>

            <div>
                {makeSkeletonKeys("field", fields).map((fieldKey, index) => (
                    <div
                        key={fieldKey}
                        className="sm-row"
                        data-sot-part="settings-skeleton-row"
                    >
                        <span className="sm-row-label">
                            <Skeleton className="sm-l-t" />
                            <Skeleton className="sm-l-h" />
                        </span>
                        <span className="sm-row-ctrl">
                            {index === 0 ? (
                                <Skeleton className="sync-dot" />
                            ) : null}
                            <Skeleton className="sm-input" />
                        </span>
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
    scrollRef?: Ref<HTMLDivElement>;
    section?: string;
    surface?: string;
}

export function SettingsSectionSkeleton({
    cards = 2,
    className,
    fieldsPerCard = 2,
    scrollRef,
    section,
    surface,
}: SettingsSectionSkeletonProps) {
    return (
        <div
            ref={scrollRef}
            aria-busy="true"
            className={cn("settings-main", className)}
            data-sot-panel="settings-section-skeleton"
            data-sot-section={section}
            data-sot-state="loading"
            data-sot-surface={surface}
        >
            <div className="empty-hint">
                <Skeleton className="eh-t" />
                <Skeleton className="eh-h" />
            </div>

            <div>
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
        <div
            className="settings-main"
            data-sot-panel="settings-list-skeleton"
            data-sot-state="loading"
        >
            {makeSkeletonKeys("settings-row", rows).map((rowKey) => (
                <div key={rowKey} className="sm-row">
                    <span className="sm-row-label">
                        <Skeleton className="sm-l-t" />
                        <Skeleton className="sm-l-h" />
                    </span>
                    <span className="sm-row-ctrl">
                        <Skeleton className="sm-input" />
                        <Skeleton className="btn" />
                        <Skeleton className="btn" />
                    </span>
                </div>
            ))}
        </div>
    );
}
