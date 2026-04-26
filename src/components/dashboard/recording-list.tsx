"use client";

import { Clock, CloudOff, HardDrive, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { Card, CardContent } from "@/components/ui/card";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
} from "@/components/ui/select";
import { useDisplaySettingsStore } from "@/features/settings/display-settings-store";
import { getUpstreamDeletedLabel } from "@/lib/data-sources/presentation";
import { formatDateTime } from "@/lib/format-date";
import type { RecordingTag } from "@/lib/recording-tags";
import {
    isActiveTranscriptionJob,
    type TranscriptionJobLike,
} from "@/lib/transcription/job-display";
import { cn } from "@/lib/utils";
import type { Recording } from "@/types/recording";
import { RecordingTagChip } from "./recording-tag-visuals";

type TimelineFilter = "all" | "today" | "yesterday" | "last7" | "earlier";
type RecordingListMode = "timeline" | "tags";
type TagFilter = "all" | "untagged" | `tag:${string}`;

interface RecordingListProps {
    recordings: Recording[];
    totalCount: number;
    currentRecording: Recording | null;
    transcriptionJobs?: Map<string, TranscriptionJobLike>;
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

function getTimelineLabel(bucket: TimelineFilter, language: "zh-CN" | "en") {
    const isZh = language === "zh-CN";

    switch (bucket) {
        case "today":
            return isZh ? "今天" : "Today";
        case "yesterday":
            return isZh ? "昨天" : "Yesterday";
        case "last7":
            return isZh ? "近 7 天" : "Last 7 days";
        case "earlier":
            return isZh ? "更早" : "Earlier";
        default:
            return isZh ? "全部" : "All";
    }
}

export function RecordingList({
    recordings,
    totalCount,
    currentRecording,
    transcriptionJobs,
    onSelect,
}: RecordingListProps) {
    const { language, t } = useLanguage();
    const {
        settings: { dateTimeFormat, recordingListSortOrder, itemsPerPage },
    } = useDisplaySettingsStore();
    const [currentPage, setCurrentPage] = useState(1);
    const [mode, setMode] = useState<RecordingListMode>("timeline");
    const [timelineFilter, setTimelineFilter] = useState<TimelineFilter>("all");
    const [tagFilter, setTagFilter] = useState<TagFilter>("all");
    const pageSize = Math.min(itemsPerPage, 8);

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
                label: getTimelineLabel(value, language),
                count: counts[value],
            }))
            .filter((option) => option.value === "all" || option.count > 0);
    }, [language, recordings]);

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
                label: language === "zh-CN" ? "全部" : "All",
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
                          label: language === "zh-CN" ? "未标记" : "Untagged",
                          count: untaggedCount,
                      },
                  ]
                : []),
        ];
    }, [language, recordings]);

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

        for (const recording of sortedAndPaginatedRecordings) {
            const tag = recording.tags[0];
            const group =
                mode === "tags"
                    ? {
                          id: tag?.id ?? "untagged",
                          label:
                              tag?.name ??
                              (language === "zh-CN" ? "未标记" : "Untagged"),
                      }
                    : {
                          id: getTimelineBucket(recording.startTime),
                          label: getTimelineLabel(
                              getTimelineBucket(recording.startTime),
                              language,
                          ),
                      };
            const existing = groups.find((item) => item.id === group.id);

            if (existing) {
                existing.recordings.push(recording);
            } else {
                groups.push({ ...group, recordings: [recording] });
            }
        }

        return groups;
    }, [language, mode, sortedAndPaginatedRecordings]);

    const totalPages = Math.max(
        1,
        Math.ceil(filteredSortedRecordings.length / pageSize),
    );

    const formatDuration = (ms: number) => {
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    };
    const totalLabel =
        language === "zh-CN" ? `${totalCount} 条` : `${totalCount} items`;
    const selectedTagOption =
        tagOptions.find((option) => option.value === tagFilter) ??
        tagOptions[0];

    useEffect(() => {
        if (
            mode === "tags" &&
            !tagOptions.some((option) => option.value === tagFilter)
        ) {
            setTagFilter("all");
        }
    }, [mode, tagFilter, tagOptions]);

    return (
        <Card hasNoPadding className="h-[calc(100svh-13rem)] min-h-0 lg:h-full">
            <CardContent className="flex h-full min-h-0 flex-col p-0">
                <div className="border-b p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                            <p className="text-xs font-medium text-muted-foreground">
                                {mode === "timeline"
                                    ? language === "zh-CN"
                                        ? "时间线"
                                        : "Timeline"
                                    : language === "zh-CN"
                                      ? "标签"
                                      : "Tags"}
                            </p>
                            <span className="rounded-full border border-border/70 bg-background/45 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                {totalLabel}
                            </span>
                        </div>
                        <SegmentedTabs
                            items={[
                                {
                                    value: "timeline",
                                    label:
                                        language === "zh-CN" ? "时间" : "Time",
                                },
                                {
                                    value: "tags",
                                    label:
                                        language === "zh-CN" ? "标签" : "Tags",
                                },
                            ]}
                            value={mode}
                            onValueChange={(value) => {
                                setMode(value as RecordingListMode);
                                setCurrentPage(1);
                            }}
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
                                            (language === "zh-CN"
                                                ? "全部"
                                                : "All")}
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
                    className="content-fade-in min-h-0 flex-1 overflow-y-auto"
                >
                    {groupedRecordings.map((group) => (
                        <div key={group.id}>
                            <div className="sticky top-0 z-10 border-b bg-card/95 px-4 py-2 text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase backdrop-blur">
                                {group.label}
                            </div>
                            <div className="divide-y">
                                {group.recordings.map((recording) => {
                                    const isSelected =
                                        currentRecording?.id === recording.id;
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
                                            onClick={() => onSelect(recording)}
                                            className={cn(
                                                "relative w-full border-l-2 border-l-transparent px-4 py-4 text-left transition-[background-color,border-color,opacity] duration-300 ease-[var(--ease-sine)] hover:bg-accent/35",
                                                isSelected &&
                                                    "border-l-primary bg-accent/42",
                                            )}
                                        >
                                            {isTranscribing ? (
                                                <span className="pointer-events-none absolute left-3 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary shadow-[0_0_18px_rgb(245_158_11_/_0.22)]">
                                                    <span className="absolute inset-0 animate-ping rounded-full bg-primary/20 opacity-70" />
                                                    <Loader2 className="relative size-3.5 animate-spin" />
                                                </span>
                                            ) : null}
                                            <div
                                                className={cn(
                                                    "flex items-start justify-between gap-3",
                                                    isTranscribing && "pl-8",
                                                )}
                                            >
                                                <div className="min-w-0 flex-1 space-y-1.5">
                                                    <div className="min-w-0">
                                                        <h3 className="truncate text-[0.95rem] leading-6 font-medium">
                                                            {recording.filename}
                                                        </h3>
                                                    </div>

                                                    <div className="flex items-center gap-4 text-sm leading-5 text-muted-foreground">
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
                                                                .map((tag) => (
                                                                    <RecordingTagChip
                                                                        key={
                                                                            tag.id
                                                                        }
                                                                        tag={
                                                                            tag
                                                                        }
                                                                    />
                                                                ))}
                                                            {recording.tags
                                                                .length > 2 ? (
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
                    {groupedRecordings.length === 0 ? (
                        <div className="p-6 text-sm text-muted-foreground">
                            {language === "zh-CN"
                                ? mode === "timeline"
                                    ? "当前时间线没有录音。"
                                    : "当前标签没有录音。"
                                : mode === "timeline"
                                  ? "No recordings in this timeline."
                                  : "No recordings for this tag."}
                        </div>
                    ) : null}
                </div>

                <div className="flex items-center justify-between border-t p-4">
                    <button
                        type="button"
                        onClick={() =>
                            setCurrentPage((page) => Math.max(1, page - 1))
                        }
                        disabled={currentPage === 1}
                        className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
                    >
                        {language === "zh-CN" ? "上一页" : "Previous"}
                    </button>
                    <div className="text-center text-sm text-muted-foreground">
                        <span>
                            {language === "zh-CN"
                                ? `${currentPage} / ${totalPages} 页`
                                : `Page ${currentPage} of ${totalPages}`}
                        </span>
                        <span className="ml-2 text-xs opacity-70">
                            {filteredSortedRecordings.length}
                            {language === "zh-CN" ? " 条" : " items"}
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={() =>
                            setCurrentPage((page) =>
                                Math.min(totalPages, page + 1),
                            )
                        }
                        disabled={currentPage === totalPages}
                        className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
                    >
                        {language === "zh-CN" ? "下一页" : "Next"}
                    </button>
                </div>
            </CardContent>
        </Card>
    );
}
