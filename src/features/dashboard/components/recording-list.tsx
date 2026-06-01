"use client";

import {
    CalendarX2,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    Clock,
    CloudOff,
    FolderOpen,
    HardDrive,
    Loader2,
    SearchX,
    Tags,
} from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
} from "@/components/ui/select";
import { RecordingTagChip } from "@/features/recordings/components/recording-tag-visuals";
import { useDisplaySettingsStore } from "@/features/settings/display-settings-store";
import {
    getSourceProviderLabel,
    getUpstreamDeletedLabel,
} from "@/lib/data-sources/presentation";
import { formatDateTime } from "@/lib/format-date";
import type { RecordingTag } from "@/lib/recording-tags";
import {
    isActiveTranscriptionJob,
    type TranscriptionJobLike,
} from "@/lib/transcription/job-display";
import { cn } from "@/lib/utils";
import type { Recording } from "@/types/recording";

type TimelineFilter = "all" | "today" | "yesterday" | "last7" | "earlier";
export type RecordingListMode = "timeline" | "tags";
type TagFilter = "all" | "untagged" | `tag:${string}`;
type Translate = (
    key: string,
    replacements?: Record<string, string | number>,
) => string;

interface RecordingListProps {
    recordings: Recording[];
    totalCount: number;
    libraryTotalCount?: number;
    currentRecording: Recording | null;
    transcriptionJobs?: Map<string, TranscriptionJobLike>;
    contextLabel?: string;
    filterStack?: ReactNode;
    isLoading?: boolean;
    mode?: RecordingListMode;
    onModeChange?: (mode: RecordingListMode) => void;
    onClearFilters?: () => void;
    onOpenDataSourcesSettings?: () => void;
    onSelect: (recording: Recording) => void;
}

function getStartOfDay(value: Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function getDaysAgo(value: string) {
    const start = getStartOfDay(new Date(value)).getTime();
    const today = getStartOfDay(new Date()).getTime();
    return Math.floor((today - start) / 86_400_000);
}

function getTimelineBucket(value: string): Exclude<TimelineFilter, "all"> {
    const daysAgo = getDaysAgo(value);

    if (daysAgo <= 0) return "today";
    if (daysAgo === 1) return "yesterday";
    if (daysAgo <= 7) return "last7";
    return "earlier";
}

function getTimelineLabel(bucket: TimelineFilter, t: Translate) {
    switch (bucket) {
        case "today":
            return t("recordingList.timeline.today");
        case "yesterday":
            return t("recordingList.timeline.yesterday");
        case "last7":
            return t("recordingList.timeline.last7");
        case "earlier":
            return t("recordingList.timeline.earlier");
        default:
            return t("recordingList.timeline.all");
    }
}

export function RecordingList({
    recordings,
    totalCount,
    libraryTotalCount = totalCount,
    currentRecording,
    contextLabel,
    filterStack,
    isLoading = false,
    mode: controlledMode,
    onModeChange,
    onClearFilters,
    onOpenDataSourcesSettings,
    transcriptionJobs,
    onSelect,
}: RecordingListProps) {
    const { language, t } = useLanguage();
    const {
        settings: { dateTimeFormat, recordingListSortOrder, itemsPerPage },
    } = useDisplaySettingsStore();
    const [currentPage, setCurrentPage] = useState(1);
    const [internalMode, setInternalMode] =
        useState<RecordingListMode>("timeline");
    const [timelineFilter, setTimelineFilter] = useState<TimelineFilter>("all");
    const [tagFilter, setTagFilter] = useState<TagFilter>("all");
    const mode = controlledMode ?? internalMode;
    const pageSize = Math.max(1, Math.floor(itemsPerPage));

    const updateMode = useCallback(
        (nextMode: RecordingListMode) => {
            if (controlledMode === undefined) {
                setInternalMode(nextMode);
            }
            onModeChange?.(nextMode);
            setTimelineFilter("all");
            setTagFilter("all");
            setCurrentPage(1);
        },
        [controlledMode, onModeChange],
    );

    useEffect(() => {
        if (mode === "timeline" || mode === "tags") {
            setTimelineFilter("all");
            setTagFilter("all");
            setCurrentPage(1);
        }
    }, [mode]);

    useEffect(() => {
        const nextTotalPages = Math.max(
            1,
            Math.ceil(recordings.length / pageSize),
        );
        setCurrentPage((page) => Math.min(page, nextTotalPages));
    }, [pageSize, recordings.length]);

    const timelineOptions = useMemo(() => {
        const counts = recordings.reduce<Record<TimelineFilter, number>>(
            (acc, recording) => {
                acc.all += 1;
                acc[getTimelineBucket(recording.startTime)] += 1;
                return acc;
            },
            { all: 0, today: 0, yesterday: 0, last7: 0, earlier: 0 },
        );

        return (["all", "today", "yesterday", "last7", "earlier"] as const)
            .map((value) => ({
                value,
                label: getTimelineLabel(value, t),
                count: counts[value],
            }))
            .filter((option) => option.value === "all" || option.count > 0);
    }, [recordings, t]);

    const tagOptions = useMemo(() => {
        const tagCounts = new Map<
            string,
            { tag: RecordingTag; count: number }
        >();
        let untaggedCount = 0;

        for (const recording of recordings) {
            if (recording.tags.length === 0) {
                untaggedCount += 1;
                continue;
            }

            for (const tag of recording.tags) {
                const existing = tagCounts.get(tag.id);
                tagCounts.set(tag.id, {
                    tag,
                    count: (existing?.count ?? 0) + 1,
                });
            }
        }

        return [
            {
                value: "all" as const,
                label: t("recordingList.timeline.all"),
                count: recordings.length,
            },
            ...Array.from(tagCounts.values())
                .sort((a, b) => a.tag.name.localeCompare(b.tag.name))
                .map(({ tag, count }) => ({
                    value: `tag:${tag.id}` as const,
                    label: tag.name,
                    count,
                })),
            ...(untaggedCount > 0
                ? [
                      {
                          value: "untagged" as const,
                          label: t("recordingList.untagged"),
                          count: untaggedCount,
                      },
                  ]
                : []),
        ];
    }, [recordings, t]);

    const filteredSortedRecordings = useMemo(() => {
        const sorted = [...recordings];

        switch (recordingListSortOrder) {
            case "newest":
                sorted.sort(
                    (a, b) =>
                        new Date(b.startTime).getTime() -
                        new Date(a.startTime).getTime(),
                );
                break;
            case "oldest":
                sorted.sort(
                    (a, b) =>
                        new Date(a.startTime).getTime() -
                        new Date(b.startTime).getTime(),
                );
                break;
            case "name":
                sorted.sort((a, b) => a.filename.localeCompare(b.filename));
                break;
        }

        if (mode === "tags") {
            if (tagFilter === "all") {
                return sorted;
            }

            if (tagFilter === "untagged") {
                return sorted.filter(
                    (recording) => recording.tags.length === 0,
                );
            }

            const tagId = tagFilter.replace("tag:", "");
            return sorted.filter((recording) =>
                recording.tags.some((tag) => tag.id === tagId),
            );
        }

        if (timelineFilter === "all") {
            return sorted;
        }

        return sorted.filter(
            (recording) =>
                getTimelineBucket(recording.startTime) === timelineFilter,
        );
    }, [mode, recordingListSortOrder, recordings, tagFilter, timelineFilter]);

    useEffect(() => {
        const nextTotalPages = Math.max(
            1,
            Math.ceil(filteredSortedRecordings.length / pageSize),
        );
        setCurrentPage((page) => Math.min(page, nextTotalPages));
    }, [filteredSortedRecordings.length, pageSize]);

    const sortedAndPaginatedRecordings = useMemo(() => {
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        return filteredSortedRecordings.slice(startIndex, endIndex);
    }, [currentPage, filteredSortedRecordings, pageSize]);

    const groupedRecordings = useMemo(() => {
        const groups: Array<{
            id: string;
            label: string;
            recordings: Recording[];
        }> = [];

        const pushGroupRecording = (
            group: { id: string; label: string },
            recording: Recording,
        ) => {
            const existing = groups.find((item) => item.id === group.id);

            if (existing) {
                existing.recordings.push(recording);
                return;
            }

            groups.push({ ...group, recordings: [recording] });
        };

        for (const recording of sortedAndPaginatedRecordings) {
            if (mode === "tags") {
                if (recording.tags.length === 0 || tagFilter === "untagged") {
                    pushGroupRecording(
                        {
                            id: "untagged",
                            label: t("recordingList.untagged"),
                        },
                        recording,
                    );
                    continue;
                }

                if (tagFilter.startsWith("tag:")) {
                    const tagId = tagFilter.replace("tag:", "");
                    const selectedTag = recording.tags.find(
                        (tag) => tag.id === tagId,
                    );

                    if (selectedTag) {
                        pushGroupRecording(
                            { id: selectedTag.id, label: selectedTag.name },
                            recording,
                        );
                    }
                    continue;
                }

                for (const tag of recording.tags) {
                    pushGroupRecording(
                        { id: tag.id, label: tag.name },
                        recording,
                    );
                }
                continue;
            }

            const bucket = getTimelineBucket(recording.startTime);
            pushGroupRecording(
                { id: bucket, label: getTimelineLabel(bucket, t) },
                recording,
            );
        }

        return groups;
    }, [mode, sortedAndPaginatedRecordings, t, tagFilter]);

    const totalPages = Math.max(
        1,
        Math.ceil(filteredSortedRecordings.length / pageSize),
    );
    const hasVisibleRows = groupedRecordings.length > 0;
    const isLibraryEmpty = !isLoading && libraryTotalCount === 0;
    const isDashboardFilterEmpty =
        !isLoading && libraryTotalCount > 0 && recordings.length === 0;
    const isInnerFilterEmpty =
        !isLoading &&
        recordings.length > 0 &&
        filteredSortedRecordings.length === 0;
    const listState = isLoading
        ? "loading"
        : isLibraryEmpty
          ? "empty"
          : isDashboardFilterEmpty
            ? "no-match"
            : isInnerFilterEmpty
              ? mode === "tags"
                  ? "tag-empty"
                  : "timeline-empty"
              : "ready";

    const resetInnerFilters = useCallback(() => {
        setTimelineFilter("all");
        setTagFilter("all");
        setCurrentPage(1);
    }, []);

    const formatDuration = (ms: number) => {
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    };
    const totalLabel = t("recordingList.totalCount", { count: totalCount });
    const selectedTagOption =
        tagOptions.find((option) => option.value === tagFilter) ??
        tagOptions[0];
    const emptyTitle =
        listState === "empty"
            ? t("recordingList.emptyTitle")
            : listState === "no-match"
              ? t("recordingList.noMatchTitle")
              : listState === "timeline-empty"
                ? t("recordingList.timelineEmptyTitle")
                : t("recordingList.tagEmptyTitle");
    const emptyDescription =
        listState === "empty"
            ? t("recordingList.emptyDescription")
            : listState === "no-match"
              ? t("recordingList.noMatchDescription")
              : listState === "timeline-empty"
                ? t("recordingList.timelineEmptyDescription")
                : t("recordingList.tagEmptyDescription");
    const resetInnerFilterLabel =
        listState === "timeline-empty"
            ? t("recordingList.clearTimeline")
            : t("recordingList.clearTag");

    useEffect(() => {
        if (
            mode === "tags" &&
            !tagOptions.some((option) => option.value === tagFilter)
        ) {
            setTagFilter("all");
        }
    }, [mode, tagFilter, tagOptions]);

    return (
        <Card
            hasNoPadding
            className="dashboard-list-panel h-[calc(100svh-13rem)] min-h-[28rem] lg:h-full lg:min-h-0"
            data-current-page={currentPage}
            data-list-state={listState}
            data-list-mode={mode}
            data-total-pages={totalPages}
            data-visible-count={sortedAndPaginatedRecordings.length}
            data-testid="recording-list-panel"
        >
            <CardContent className="flex h-full min-h-0 flex-col p-0">
                <div className="border-b border-border/70 p-3">
                    {contextLabel ? (
                        <div className="mb-2 flex items-center gap-2 text-[0.68rem] font-medium text-muted-foreground">
                            <span>{contextLabel}</span>
                        </div>
                    ) : null}
                    {filterStack ? (
                        <div className="-mx-3 mb-3">{filterStack}</div>
                    ) : null}
                    <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                            <p className="text-xs font-semibold text-muted-foreground">
                                {mode === "timeline"
                                    ? t("recordingList.timelineTitle")
                                    : t("recordingList.tagsTitle")}
                            </p>
                            <span className="rounded-full border border-border/70 bg-background/45 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                {totalLabel}
                            </span>
                        </div>
                        <SegmentedTabs
                            className="min-w-[9rem] text-xs"
                            items={[
                                {
                                    value: "timeline",
                                    label: t("recordingList.timeTab"),
                                },
                                {
                                    value: "tags",
                                    label: t("recordingList.tagsTab"),
                                },
                            ]}
                            value={mode}
                            onValueChange={(value) =>
                                updateMode(value as RecordingListMode)
                            }
                        />
                    </div>
                    {mode === "timeline" ? (
                        <SegmentedTabs
                            items={timelineOptions.map((option) => ({
                                value: option.value,
                                label: `${option.label} ${option.count}`,
                            }))}
                            value={timelineFilter}
                            onValueChange={(value) => {
                                setTimelineFilter(value as TimelineFilter);
                                setCurrentPage(1);
                            }}
                        />
                    ) : (
                        <Select
                            value={tagFilter}
                            onValueChange={(value) => {
                                setTagFilter(value as TagFilter);
                                setCurrentPage(1);
                            }}
                        >
                            <SelectTrigger className="h-11 w-full rounded-2xl border-border/60 bg-background/30 px-3 shadow-none backdrop-blur-xl">
                                <span className="flex min-w-0 flex-1 items-center gap-2">
                                    <span className="min-w-0 truncate text-left text-sm font-medium">
                                        {selectedTagOption?.label ??
                                            t("recordingList.timeline.all")}
                                    </span>
                                    <span className="shrink-0 rounded-xl border border-border/60 bg-background/40 px-2 py-0.5 text-[10px] text-muted-foreground">
                                        {selectedTagOption?.count ?? 0}
                                    </span>
                                </span>
                            </SelectTrigger>
                            <SelectContent
                                align="start"
                                className="max-h-72 rounded-2xl"
                            >
                                {tagOptions.map((option) => (
                                    <SelectItem
                                        key={option.value}
                                        value={option.value}
                                        className="rounded-xl"
                                    >
                                        <span className="flex w-full min-w-0 items-center justify-between gap-3">
                                            <span className="min-w-0 truncate">
                                                {option.label}
                                            </span>
                                            <span className="shrink-0 rounded-xl border border-border/60 px-1.5 text-[10px] text-muted-foreground">
                                                {option.count}
                                            </span>
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>

                <div
                    key={`${mode}-${timelineFilter}-${tagFilter}-${currentPage}`}
                    className="content-fade-in min-h-0 flex-1 overflow-y-auto px-1 py-1"
                >
                    {isLoading ? (
                        <div
                            className="space-y-3 p-3"
                            data-testid="recording-list-loading"
                        >
                            {[0, 1, 2, 3].map((item) => (
                                <div
                                    key={item}
                                    className="rounded-xl border border-border/45 bg-background/30 px-3 py-3"
                                >
                                    <div className="mb-3 h-3 w-24 animate-pulse rounded bg-muted" />
                                    <div className="mb-2 h-4 w-4/5 animate-pulse rounded bg-muted" />
                                    <div className="flex gap-2">
                                        <div className="h-3 w-14 animate-pulse rounded bg-muted" />
                                        <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : null}
                    {!isLoading &&
                        groupedRecordings.map((group) => (
                            <div
                                key={group.id}
                                data-recording-list-group={group.id}
                                data-testid="recording-list-group"
                            >
                                <div className="sticky top-0 z-10 flex items-center gap-2 bg-card/95 px-3 py-2 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase backdrop-blur">
                                    <span>{group.label}</span>
                                    <span className="h-px flex-1 bg-border/70" />
                                </div>
                                <div className="flex flex-col gap-1">
                                    {group.recordings.map((recording) => {
                                        const isSelected =
                                            currentRecording?.id ===
                                            recording.id;
                                        const isTranscribing =
                                            isActiveTranscriptionJob(
                                                transcriptionJobs?.get(
                                                    recording.id,
                                                ),
                                            );

                                        return (
                                            <button
                                                key={recording.id}
                                                type="button"
                                                data-recording-id={recording.id}
                                                data-selected={
                                                    isSelected
                                                        ? "true"
                                                        : "false"
                                                }
                                                data-testid="recording-list-item"
                                                onClick={() =>
                                                    onSelect(recording)
                                                }
                                                className={cn(
                                                    "relative w-full rounded-xl border border-transparent px-3 py-3 text-left transition-[background-color,border-color,opacity] duration-300 ease-[var(--ease-sine)] hover:bg-accent/35",
                                                    isSelected &&
                                                        "border-primary/35 bg-accent/45 shadow-xs",
                                                )}
                                            >
                                                {isTranscribing ? (
                                                    <span className="pointer-events-none absolute top-1/2 left-3 flex size-6 -translate-y-1/2 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
                                                        <span className="absolute inset-0 animate-ping rounded-full bg-primary/20 opacity-70" />
                                                        <Loader2 className="relative size-3.5 animate-spin" />
                                                    </span>
                                                ) : null}
                                                <div
                                                    className={cn(
                                                        "flex items-start justify-between gap-3",
                                                        isTranscribing &&
                                                            "pl-8",
                                                    )}
                                                >
                                                    <div className="min-w-0 flex-1 space-y-1.5">
                                                        <div className="min-w-0">
                                                            <h3 className="truncate text-[0.95rem] leading-6 font-medium">
                                                                {
                                                                    recording.filename
                                                                }
                                                            </h3>
                                                        </div>

                                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm leading-5 text-muted-foreground">
                                                            {recording.sourceProvider ? (
                                                                <div className="flex min-w-0 items-center gap-1">
                                                                    <span className="max-w-24 truncate">
                                                                        {getSourceProviderLabel(
                                                                            recording.sourceProvider,
                                                                            language,
                                                                        )}
                                                                    </span>
                                                                </div>
                                                            ) : null}
                                                            <div className="flex items-center gap-1">
                                                                <Clock className="h-3 w-3" />
                                                                <span>
                                                                    {formatDuration(
                                                                        recording.duration,
                                                                    )}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <HardDrive className="h-3 w-3" />
                                                                <span>
                                                                    {(
                                                                        recording.filesize /
                                                                        (1024 *
                                                                            1024)
                                                                    ).toFixed(
                                                                        1,
                                                                    )}{" "}
                                                                    MB
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <p
                                                            className="text-xs leading-5 text-muted-foreground"
                                                            suppressHydrationWarning
                                                        >
                                                            {formatDateTime(
                                                                recording.startTime,
                                                                dateTimeFormat,
                                                                language,
                                                            )}
                                                        </p>
                                                        {recording.upstreamDeleted && (
                                                            <div
                                                                className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-500"
                                                                title={getUpstreamDeletedLabel(
                                                                    language,
                                                                )}
                                                            >
                                                                <CloudOff className="h-2.5 w-2.5" />
                                                                {t(
                                                                    "dashboard.localOnly",
                                                                )}
                                                            </div>
                                                        )}
                                                        {recording.tags.length >
                                                        0 ? (
                                                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                                                                {recording.tags
                                                                    .slice(0, 2)
                                                                    .map(
                                                                        (
                                                                            tag,
                                                                        ) => (
                                                                            <RecordingTagChip
                                                                                key={
                                                                                    tag.id
                                                                                }
                                                                                tag={
                                                                                    tag
                                                                                }
                                                                            />
                                                                        ),
                                                                    )}
                                                                {recording.tags
                                                                    .length >
                                                                2 ? (
                                                                    <span className="rounded-full border border-border/70 px-2 py-0.5 text-[10px] text-muted-foreground">
                                                                        +
                                                                        {recording
                                                                            .tags
                                                                            .length -
                                                                            2}
                                                                    </span>
                                                                ) : null}
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    {!isLoading && !hasVisibleRows ? (
                        <div
                            className="m-2 flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/80 bg-background/35 px-6 py-10 text-center"
                            data-testid={`recording-list-${listState}`}
                        >
                            <span className="glass-control inline-flex size-11 items-center justify-center rounded-2xl text-muted-foreground">
                                {listState === "empty" ? (
                                    <FolderOpen className="size-5" />
                                ) : listState === "tag-empty" ? (
                                    <Tags className="size-5" />
                                ) : listState === "timeline-empty" ? (
                                    <CalendarX2 className="size-5" />
                                ) : (
                                    <SearchX className="size-5" />
                                )}
                            </span>
                            <div className="space-y-1.5">
                                <p className="text-sm font-semibold">
                                    {emptyTitle}
                                </p>
                                <p className="max-w-72 text-xs leading-5 text-muted-foreground">
                                    {emptyDescription}
                                </p>
                            </div>
                            {listState === "empty" &&
                            onOpenDataSourcesSettings ? (
                                <Button
                                    type="button"
                                    size="sm"
                                    className="h-8 rounded-lg px-3 text-xs"
                                    onClick={onOpenDataSourcesSettings}
                                >
                                    {t("recordingList.openDataSources")}
                                </Button>
                            ) : null}
                            {listState === "no-match" && onClearFilters ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-8 rounded-lg px-3 text-xs"
                                    onClick={onClearFilters}
                                >
                                    {t("recordingList.clearFilters")}
                                </Button>
                            ) : null}
                            {(listState === "timeline-empty" ||
                                listState === "tag-empty") && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-8 rounded-lg px-3 text-xs"
                                    onClick={resetInnerFilters}
                                >
                                    {resetInnerFilterLabel}
                                </Button>
                            )}
                        </div>
                    ) : null}
                </div>

                <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-t p-3">
                    <div className="flex items-center gap-1">
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            data-testid="recording-list-first-page"
                            onClick={() => setCurrentPage(1)}
                            disabled={currentPage === 1}
                            title={t("recordingList.first")}
                            aria-label={t("recordingList.first")}
                            className="rounded-lg text-muted-foreground"
                        >
                            <ChevronsLeft className="size-4" />
                            <span className="sr-only">
                                {t("recordingList.first")}
                            </span>
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            data-testid="recording-list-prev-page"
                            onClick={() =>
                                setCurrentPage((page) => Math.max(1, page - 1))
                            }
                            disabled={currentPage === 1}
                            title={t("recordingList.previous")}
                            aria-label={t("recordingList.previous")}
                            className="rounded-lg text-muted-foreground"
                        >
                            <ChevronLeft className="size-4" />
                            <span className="sr-only">
                                {t("recordingList.previous")}
                            </span>
                        </Button>
                    </div>
                    <div
                        className="min-w-0 text-center text-sm text-muted-foreground"
                        data-testid="recording-list-page-status"
                    >
                        <span className="block truncate">
                            {t("recordingList.pageStatus", {
                                current: currentPage,
                                total: totalPages,
                            })}
                        </span>
                        <span className="block truncate text-xs opacity-70">
                            {t("recordingList.visibleCount", {
                                count: filteredSortedRecordings.length,
                            })}
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            data-testid="recording-list-next-page"
                            onClick={() =>
                                setCurrentPage((page) =>
                                    Math.min(totalPages, page + 1),
                                )
                            }
                            disabled={currentPage === totalPages}
                            title={t("recordingList.next")}
                            aria-label={t("recordingList.next")}
                            className="rounded-lg text-muted-foreground"
                        >
                            <ChevronRight className="size-4" />
                            <span className="sr-only">
                                {t("recordingList.next")}
                            </span>
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            data-testid="recording-list-last-page"
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={currentPage === totalPages}
                            title={t("recordingList.last")}
                            aria-label={t("recordingList.last")}
                            className="rounded-lg text-muted-foreground"
                        >
                            <ChevronsRight className="size-4" />
                            <span className="sr-only">
                                {t("recordingList.last")}
                            </span>
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
