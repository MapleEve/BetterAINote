"use client";

import type { Ref } from "react";
import { useLanguage } from "@/components/language-provider";
import { Field, FieldContent } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

const makeSkeletonKeys = (prefix: string, count: number) =>
    Array.from({ length: count }, (_, index) => `${prefix}-${index + 1}`);

const SETTINGS_SKELETON_PANEL_CLASS =
    "min-h-0 overflow-y-auto [overscroll-behavior:contain] px-[26px] py-[22px]";
const SETTINGS_CARD_SKELETON_CLASS = SETTINGS_SKELETON_PANEL_CLASS;
const SETTINGS_SECTION_SKELETON_CLASS = SETTINGS_SKELETON_PANEL_CLASS;
const SETTINGS_LIST_SKELETON_CLASS = SETTINGS_SKELETON_PANEL_CLASS;
const SKELETON_ROW_CONTROL_CLASS =
    "flex min-w-0 flex-wrap items-center justify-end gap-2";
const SKELETON_SYNC_DOT_CLASS =
    "size-2 rounded-full bg-primary ring-4 ring-primary/20";

interface SettingsCardSkeletonProps {
    className?: string;
    fields?: number;
}

export function SettingsCardSkeleton({
    className,
    fields = 2,
}: SettingsCardSkeletonProps) {
    return (
        <div className={cn(SETTINGS_CARD_SKELETON_CLASS, className)}>
            <div>
                <Skeleton />
                <Skeleton />
            </div>

            <div>
                {makeSkeletonKeys("field", fields).map((fieldKey, index) => (
                    <Field key={fieldKey} orientation="horizontal">
                        <FieldContent>
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-48 max-w-full" />
                        </FieldContent>
                        <div className={SKELETON_ROW_CONTROL_CLASS}>
                            {index === 0 ? (
                                <Skeleton className={SKELETON_SYNC_DOT_CLASS} />
                            ) : null}
                            <Skeleton className="h-9 w-60 max-w-full rounded-md" />
                        </div>
                    </Field>
                ))}
            </div>
        </div>
    );
}

type SettingsSectionSkeletonProps = {
    cards?: number;
    className?: string;
    fieldsPerCard?: number;
    scrollRef?: Ref<HTMLDivElement>;
};

export function SettingsSectionSkeleton({
    cards = 2,
    className,
    fieldsPerCard = 2,
    scrollRef,
}: SettingsSectionSkeletonProps) {
    const { t } = useLanguage();
    const loadingLabel = t("settingsDialog.loading");

    return (
        <div
            ref={scrollRef}
            aria-busy="true"
            className={cn(SETTINGS_SECTION_SKELETON_CLASS, className)}
        >
            <output
                aria-label={loadingLabel}
                aria-live="polite"
                className="mb-4 flex items-center gap-2 text-sm text-muted-foreground"
            >
                <Spinner aria-hidden="true" size="sm" />
                <span>{loadingLabel}</span>
            </output>

            <div>
                <Skeleton />
                <Skeleton />
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
        <div className={SETTINGS_LIST_SKELETON_CLASS}>
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
