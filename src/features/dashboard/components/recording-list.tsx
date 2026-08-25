"use client";

import { ChevronDown } from "lucide-react";
import type { Ref } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { RecordingListTimelineFilter } from "@/features/dashboard/recording-list-controller";
import { RecordingTagIconGlyph } from "@/features/recordings/components/recording-tag-visuals";
import { formatDateTime } from "@/lib/format-date";
import type { UiLanguage } from "@/lib/i18n";
import type { RecordingTag } from "@/lib/recording-tags";
import { cn } from "@/lib/utils";
import type { DateTimeFormat } from "@/types/common";

export type RecordingListMode = "tags" | "timeline";

export type RecordingListTagOption = {
    count: number;
    label: string;
    value: "all" | "untagged" | `tag:${string}`;
};

export type RecordingListRowModel = {
    durationLabel: string;
    filename: string;
    id: string;
    source: {
        cover: boolean;
        icon: string | null;
        label: string;
        letter: string;
    };
    startTime: string;
    status: {
        label: string;
        tone: "err" | "info" | "neu" | "ok" | "warn";
    };
    tag?: RecordingTag;
};

export type RecordingListGroup = {
    entries: RecordingListRowModel[];
    id: string;
    label: string;
};

const recordingListTagColorClassName: Record<RecordingTag["color"], string> = {
    blue: "[--recording-list-tag-color:var(--tag-blue)]",
    green: "[--recording-list-tag-color:var(--tag-green)]",
    orange: "[--recording-list-tag-color:var(--tag-amber)]",
    purple: "[--recording-list-tag-color:var(--tag-violet)]",
    red: "[--recording-list-tag-color:var(--tag-rose)]",
    slate: "[--recording-list-tag-color:var(--tag-slate)]",
};

const recordingListTagChipClassName =
    "h-[22px] max-w-40 gap-[5px] rounded-[6px] border-[color-mix(in_srgb,var(--recording-list-tag-color)_32%,transparent)] bg-[color-mix(in_srgb,var(--recording-list-tag-color)_12%,var(--background))] py-0 pr-[9px] pl-[7px] text-[11.5px] font-semibold text-[color-mix(in_srgb,var(--recording-list-tag-color)_72%,var(--foreground))] shadow-xs dark:border-[color-mix(in_srgb,var(--recording-list-tag-color)_36%,transparent)] dark:bg-[color-mix(in_srgb,var(--recording-list-tag-color)_18%,transparent)] dark:text-[color-mix(in_srgb,var(--recording-list-tag-color)_30%,var(--foreground))]";

type RecordingListControlsProps = {
    language: UiLanguage;
    listMode: RecordingListMode;
    onListModeChange: (mode: RecordingListMode) => void;
    onTagFilterChange: (value: RecordingListTagOption["value"]) => void;
    onTagFilterOpenChange: (open: boolean) => void;
    onTimelineFilterChange: (value: RecordingListTimelineFilter) => void;
    selectedTagFilter: RecordingListTagOption["value"];
    tagFilterOpen: boolean;
    tagFilterOptions: RecordingListTagOption[];
    tagFilterRef: Ref<HTMLDivElement>;
    timelineCounts: Record<RecordingListTimelineFilter, number>;
    timelineFilter: RecordingListTimelineFilter;
    visibleCount: number;
};

type RecordingListProps = {
    dateTimeFormat: DateTimeFormat;
    groups: RecordingListGroup[];
    language: UiLanguage;
    onRowRef?: (recordingId: string, node: HTMLButtonElement | null) => void;
    onSelect: (recordingId: string) => void;
    selectedId: string | null;
};

type RecordingListPaginationProps = {
    currentPage: number;
    language: UiLanguage;
    loaded: number;
    onNext: () => void;
    onPrevious: () => void;
    total: number;
    totalPages: number;
};

const TIMELINE_FILTERS: RecordingListTimelineFilter[] = [
    "all",
    "today",
    "yesterday",
    "last7",
    "earlier",
];

const copy = {
    en: {
        all: "All",
        earlier: "Earlier",
        last7: "Last 7 days",
        listMode: "List mode",
        next: "Next",
        previous: "Previous",
        tags: "Tags",
        tagsTitle: "Tags",
        timeline: "Time",
        timelineTitle: "Timeline",
        today: "Today",
        visible: (count: number) => `${count} visible`,
        yesterday: "Yesterday",
    },
    "zh-CN": {
        all: "全部",
        earlier: "更早",
        last7: "近 7 天",
        listMode: "列表模式",
        next: "下一页",
        previous: "上一页",
        tags: "标签",
        tagsTitle: "标签",
        timeline: "时间",
        timelineTitle: "时间线",
        today: "今天",
        visible: (count: number) => `${count} 条`,
        yesterday: "昨天",
    },
} as const;

function listCopy(language: UiLanguage) {
    return language === "zh-CN" ? copy["zh-CN"] : copy.en;
}

export function RecordingListControls({
    language,
    listMode,
    onListModeChange,
    onTagFilterChange,
    onTagFilterOpenChange,
    onTimelineFilterChange,
    selectedTagFilter,
    tagFilterOpen,
    tagFilterOptions,
    tagFilterRef,
    timelineCounts,
    timelineFilter,
    visibleCount,
}: RecordingListControlsProps) {
    const text = listCopy(language);
    const selectedTag =
        tagFilterOptions.find((option) => option.value === selectedTagFilter) ??
        tagFilterOptions[0];

    return (
        <>
            <div
                className="mt-2 flex min-w-0 items-center gap-2.5"
                data-panel="dashboard-recording-list-mode"
            >
                <div
                    className="inline-flex min-w-0 items-center gap-1.5 font-sans text-xs font-semibold text-muted-foreground"
                    data-part="dashboard-recording-list-mode-label"
                >
                    <span data-part="dashboard-recording-list-mode-title">
                        {listMode === "timeline"
                            ? text.timelineTitle
                            : text.tagsTitle}
                    </span>
                    <span
                        className="font-mono text-[11px] font-medium text-muted-foreground"
                        data-part="dashboard-recording-list-mode-count"
                    >
                        {text.visible(visibleCount)}
                    </span>
                </div>
                <SegmentedTabs
                    aria-label={text.listMode}
                    className="ml-auto"
                    data-control="segmented-tabs"
                    data-part="dashboard-recording-list-mode-segmented"
                    data-size="sm"
                    getItemProps={(_item, state) => ({
                        "data-control": "segmented-tab",
                        "data-state": state.disabled
                            ? "disabled"
                            : state.active
                              ? "active"
                              : "idle",
                    })}
                    items={[
                        { label: text.timeline, value: "timeline" },
                        { label: text.tags, value: "tags" },
                    ]}
                    onValueChange={onListModeChange}
                    size="segmentedSm"
                    value={listMode}
                    variant="segmented"
                />
            </div>

            <ToggleGroup
                aria-label={text.timelineTitle}
                className="mt-2.5 flex-wrap [&[hidden]]:hidden"
                data-list-filter-row="timeline"
                data-panel="dashboard-recording-time-filter"
                hidden={listMode !== "timeline"}
                inert={listMode !== "timeline" ? true : undefined}
                onValueChange={(value) => {
                    if (value) {
                        onTimelineFilterChange(
                            value as RecordingListTimelineFilter,
                        );
                    }
                }}
                size="sm"
                spacing={1}
                type="single"
                value={timelineFilter}
                variant="outline"
            >
                {TIMELINE_FILTERS.map((filter) => {
                    const active = timelineFilter === filter;
                    const count = timelineCounts[filter];
                    if (filter !== "all" && count === 0) return null;
                    return (
                        <ToggleGroupItem
                            aria-pressed={active}
                            className="data-[state=on]:border-primary/30 data-[state=on]:bg-primary/10 data-[state=on]:text-primary data-[state=selected]:border-primary/30 data-[state=selected]:bg-primary/10 data-[state=selected]:text-primary"
                            data-control="dashboard-recording-time-filter"
                            data-filter={filter}
                            data-state={active ? "selected" : "idle"}
                            data-tf={filter}
                            key={filter}
                            value={filter}
                        >
                            {text[filter]}
                            <span
                                className={cn(
                                    "rounded bg-muted px-1 font-mono text-[10px] font-medium text-muted-foreground/70",
                                    active && "bg-primary/10 text-primary",
                                )}
                                data-part="dashboard-recording-time-filter-count"
                            >
                                {count}
                            </span>
                        </ToggleGroupItem>
                    );
                })}
            </ToggleGroup>

            <div
                className="relative mt-2.5 [&[hidden]]:hidden"
                data-list-filter-row="tags"
                data-panel="recording-list-tag-filter"
                hidden={listMode !== "tags"}
                inert={listMode !== "tags" ? true : undefined}
                ref={tagFilterRef}
            >
                <Button
                    aria-expanded={tagFilterOpen}
                    aria-haspopup="listbox"
                    className="w-full justify-start text-foreground"
                    data-control="recording-list-tag-filter-trigger"
                    data-tag-filter-trigger=""
                    onClick={() => onTagFilterOpenChange(!tagFilterOpen)}
                    size="sm"
                    type="button"
                    variant="outline"
                >
                    <span
                        className="min-w-0 flex-1 truncate"
                        data-part="recording-list-tag-filter-label"
                        data-tag-filter-label=""
                    >
                        {selectedTag?.label ?? text.all}
                    </span>
                    <span
                        className="font-mono text-[11px] font-medium text-muted-foreground"
                        data-part="recording-list-tag-filter-count"
                        data-tag-filter-count=""
                    >
                        {selectedTag?.count ?? 0}
                    </span>
                    <ChevronDown
                        aria-hidden="true"
                        className="shrink-0 text-muted-foreground"
                        data-icon="inline-end"
                    />
                </Button>
                <div
                    className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-[260px] overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md"
                    data-list="recording-list-tag-filter-list"
                    data-tag-filter-list=""
                    hidden={!tagFilterOpen}
                    role="listbox"
                >
                    {tagFilterOptions.map((option) => {
                        const active = option.value === selectedTagFilter;
                        return (
                            <Button
                                aria-selected={active}
                                className="w-full justify-start border border-transparent bg-transparent text-muted-foreground shadow-none hover:bg-accent hover:text-accent-foreground data-[state=selected]:bg-secondary data-[state=selected]:text-secondary-foreground"
                                data-control="recording-list-tag-filter"
                                data-filter={option.value}
                                data-state={active ? "selected" : "idle"}
                                data-tag-value={option.value}
                                key={option.value}
                                onClick={() => {
                                    onTagFilterChange(option.value);
                                    onTagFilterOpenChange(false);
                                }}
                                role="option"
                                size="sm"
                                type="button"
                                variant="ghost"
                            >
                                <span className="min-w-0 flex-1 truncate">
                                    {option.label}
                                </span>
                                <span className="font-mono text-[11px] font-medium text-muted-foreground">
                                    {option.count}
                                </span>
                            </Button>
                        );
                    })}
                </div>
            </div>
        </>
    );
}

export function RecordingListSkeleton() {
    return (
        <div
            aria-busy="true"
            aria-live="polite"
            className="flex flex-col gap-0.5 p-1"
            data-panel="recording-list-loading"
        >
            {["a", "b", "c", "d", "e"].map((key, index) => (
                <div key={key}>
                    {index === 0 || index === 2 ? (
                        <div className="flex items-center gap-2.5 px-2.5 pt-3.5 pb-1.5">
                            <Skeleton className="h-[11px] w-24" />
                            <Separator className="min-w-0 flex-1" />
                        </div>
                    ) : null}
                    <div className="grid grid-cols-[1fr_auto] items-center gap-3.5 px-3 py-[11px]">
                        <div className="flex min-w-0 flex-col gap-1.5">
                            <Skeleton
                                className={cn(
                                    "h-[13px]",
                                    index % 2 === 0 ? "w-4/5" : "w-full",
                                )}
                            />
                            <div className="flex items-center gap-2">
                                <Skeleton className="h-[11px] w-20" />
                                <Skeleton className="h-[18px] w-16 rounded-full" />
                            </div>
                        </div>
                        <Skeleton className="h-[22px] w-16 rounded-full" />
                    </div>
                </div>
            ))}
        </div>
    );
}

export function RecordingList({
    dateTimeFormat,
    groups,
    language,
    onRowRef,
    onSelect,
    selectedId,
}: RecordingListProps) {
    return (
        <div
            className="flex flex-col gap-0.5 p-1"
            data-list="dashboard-recording-rows"
        >
            {groups.map((group, groupIndex) => (
                <div key={group.id}>
                    {groupIndex > 0 ? (
                        <Separator
                            className="mx-1 my-1"
                            data-part="dashboard-recording-list-group-separator"
                        />
                    ) : null}
                    <section
                        aria-labelledby={`recording-list-group-${group.id}`}
                        className="flex flex-col gap-0.5 px-1 py-1.5"
                        data-group="recording-list"
                        data-group-id={group.id}
                    >
                        <div className="flex items-baseline gap-2.5 px-2.5 pt-3.5 pb-1.5">
                            <h3
                                className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
                                id={`recording-list-group-${group.id}`}
                            >
                                {group.label}
                            </h3>
                            <span className="font-mono text-[11px] font-medium text-muted-foreground/70">
                                {group.entries.length}
                            </span>
                            <Separator className="ml-1 min-w-0 flex-1" />
                        </div>
                        {group.entries.map((recording) => {
                            const active = recording.id === selectedId;
                            return (
                                <Button
                                    aria-current={active ? "true" : undefined}
                                    className="grid h-auto w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center justify-normal gap-3 whitespace-normal rounded-md border border-transparent px-3 py-[11px] text-left font-normal hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=selected]:border-[color-mix(in_srgb,var(--accent)_38%,transparent)] data-[state=selected]:bg-[var(--accent-soft)] max-[480px]:grid-cols-[minmax(0,1fr)]"
                                    data-control="dashboard-recording-row"
                                    data-recording-id={recording.id}
                                    data-state={active ? "selected" : "idle"}
                                    key={recording.id}
                                    onClick={() => onSelect(recording.id)}
                                    ref={(node) =>
                                        onRowRef?.(recording.id, node)
                                    }
                                    type="button"
                                    variant="ghost"
                                >
                                    <span className="flex min-w-0 flex-col gap-1">
                                        <span className="truncate font-sans text-[13.5px] font-semibold tracking-[-0.005em] text-foreground">
                                            {recording.filename}
                                        </span>
                                        <span className="flex min-w-0 flex-wrap items-center gap-2 text-muted-foreground">
                                            <span
                                                className="inline-flex size-3.5 flex-none items-center justify-center overflow-hidden rounded-sm opacity-75"
                                                data-part="dashboard-recording-source-mark"
                                                title={recording.source.label}
                                            >
                                                {recording.source.icon ? (
                                                    // biome-ignore lint/performance/noImgElement: provider marks are fixed local assets.
                                                    <img
                                                        alt=""
                                                        className={cn(
                                                            "block size-3.5 object-contain",
                                                            recording.source
                                                                .cover &&
                                                                "object-cover",
                                                        )}
                                                        height={14}
                                                        src={
                                                            recording.source
                                                                .icon
                                                        }
                                                        width={14}
                                                    />
                                                ) : (
                                                    <span className="text-xs font-bold">
                                                        {
                                                            recording.source
                                                                .letter
                                                        }
                                                    </span>
                                                )}
                                            </span>
                                            <span className="font-mono text-[11.5px] font-medium">
                                                {recording.durationLabel}
                                            </span>
                                            <span className="font-mono text-[11px] font-medium">
                                                {formatDateTime(
                                                    recording.startTime,
                                                    dateTimeFormat,
                                                    language,
                                                )}
                                            </span>
                                        </span>
                                    </span>
                                    <span className="flex min-w-0 flex-wrap items-center justify-end gap-2 max-[480px]:justify-start">
                                        <Badge
                                            className={cn(
                                                "h-5 gap-1 rounded-full px-2 py-0 text-[11px] font-semibold",
                                                recording.status.tone ===
                                                    "err" &&
                                                    "border-destructive/30 bg-destructive/10 text-destructive",
                                                recording.status.tone ===
                                                    "info" &&
                                                    "border-chart-2/25 bg-chart-2/15 text-chart-2",
                                                recording.status.tone ===
                                                    "neu" &&
                                                    "border-border bg-muted text-muted-foreground",
                                                recording.status.tone ===
                                                    "ok" &&
                                                    "border-chart-3/35 bg-chart-3/10 text-chart-3",
                                                recording.status.tone ===
                                                    "warn" &&
                                                    "border-chart-4/30 bg-chart-4/15 text-[var(--signal-warning-strong)]",
                                            )}
                                            data-part="dashboard-recording-status"
                                            data-tone={recording.status.tone}
                                            variant="outline"
                                        >
                                            <span
                                                aria-hidden="true"
                                                className="size-1.5 rounded-full bg-current"
                                            />
                                            {recording.status.label}
                                        </Badge>
                                        {recording.tag ? (
                                            <Badge
                                                className={cn(
                                                    recordingListTagChipClassName,
                                                    recordingListTagColorClassName[
                                                        recording.tag.color
                                                    ],
                                                )}
                                                data-part="recording-tag-chip"
                                                data-recording-tag-chip=""
                                                data-tag-color={
                                                    recording.tag.color
                                                }
                                                data-tag-icon={
                                                    recording.tag.icon
                                                }
                                                variant="outline"
                                            >
                                                <RecordingTagIconGlyph
                                                    className="size-[11px]"
                                                    data-tag-icon-glyph=""
                                                    icon={recording.tag.icon}
                                                />
                                                <span className="truncate">
                                                    {recording.tag.name}
                                                </span>
                                            </Badge>
                                        ) : null}
                                    </span>
                                </Button>
                            );
                        })}
                    </section>
                </div>
            ))}
        </div>
    );
}

export function RecordingListPagination({
    currentPage,
    language,
    loaded,
    onNext,
    onPrevious,
    total,
    totalPages,
}: RecordingListPaginationProps) {
    const first = currentPage <= 1;
    const last = currentPage >= totalPages;
    const text = listCopy(language);
    return (
        <nav
            aria-label="Recording list pages"
            className="m-2 flex flex-col items-stretch gap-1.5 border-0 bg-transparent p-3.5 text-center"
            data-panel="recording-list-pagination"
            data-state={
                first
                    ? "paginated-first"
                    : last
                      ? "paginated-last"
                      : "paginated"
            }
        >
            <div className="relative mt-1.5 mb-3.5 h-px bg-border">
                <span className="absolute left-1/2 -top-2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap bg-card px-2.5 font-mono text-[10.5px] font-medium text-muted-foreground">
                    {loaded} / {total}
                </span>
            </div>
            <div className="mt-1 flex items-center justify-center gap-2.5">
                <Button
                    aria-disabled={first || undefined}
                    data-control="recording-list-prev-page"
                    disabled={first}
                    onClick={onPrevious}
                    size="sm"
                    type="button"
                    variant="ghost"
                >
                    {text.previous}
                </Button>
                <span className="min-w-14 font-mono text-[11.5px] font-medium text-muted-foreground">
                    {currentPage} / {totalPages}
                </span>
                <Button
                    aria-disabled={last || undefined}
                    data-control="recording-list-next-page"
                    disabled={last}
                    onClick={onNext}
                    size="sm"
                    type="button"
                    variant="ghost"
                >
                    {text.next}
                </Button>
            </div>
        </nav>
    );
}
