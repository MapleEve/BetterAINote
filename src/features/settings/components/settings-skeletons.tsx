"use client";

import type { Ref } from "react";
import { Field, FieldContent } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";

const makeSkeletonKeys = (prefix: string, count: number) =>
    Array.from({ length: count }, (_, index) => `${prefix}-${index + 1}`);

const SKELETON_ROW_CONTROL_CLASS =
    "flex min-w-0 flex-wrap items-center justify-end gap-2";

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
            className={className}
            data-sot-panel="settings-card-skeleton"
            data-sot-state="loading"
        >
            <div data-sot-panel="settings-empty-hint">
                <Skeleton data-sot-part="settings-empty-title" />
                <Skeleton data-sot-part="settings-empty-description" />
            </div>

            <div>
                {makeSkeletonKeys("field", fields).map((fieldKey, index) => (
                    <Field
                        key={fieldKey}
                        data-sot-part="settings-skeleton-row"
                        orientation="horizontal"
                    >
                        <FieldContent>
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-48 max-w-full" />
                        </FieldContent>
                        <div className={SKELETON_ROW_CONTROL_CLASS}>
                            {index === 0 ? (
                                <Skeleton data-sot-part="settings-skeleton-sync-dot" />
                            ) : null}
                            <Skeleton className="h-9 w-60 max-w-full rounded-md" />
                        </div>
                    </Field>
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
            className={className}
            data-sot-panel="settings-section-skeleton"
            data-sot-section={section}
            data-sot-state="loading"
            data-sot-surface={surface}
        >
            <div data-sot-panel="settings-empty-hint">
                <Skeleton data-sot-part="settings-empty-title" />
                <Skeleton data-sot-part="settings-empty-description" />
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
        <div data-sot-panel="settings-list-skeleton" data-sot-state="loading">
            {makeSkeletonKeys("settings-row", rows).map((rowKey) => (
                <Field key={rowKey} orientation="horizontal">
                    <FieldContent>
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-48 max-w-full" />
                    </FieldContent>
                    <div className={SKELETON_ROW_CONTROL_CLASS}>
                        <Skeleton className="h-9 w-60 max-w-full rounded-md" />
                        <Skeleton className="h-8 w-16 rounded-md" />
                        <Skeleton className="h-8 w-16 rounded-md" />
                    </div>
                </Field>
            ))}
        </div>
    );
}
