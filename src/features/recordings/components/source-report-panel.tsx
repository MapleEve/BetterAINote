"use client";

import { Check, CloudDownload, Copy, LoaderCircle } from "lucide-react";
import {
    type ReactNode,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";
import { toast } from "sonner";
import { useLanguage } from "@/components/language-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
    SOURCE_REPORT_ACTION_ROW_CLASS_NAME,
    SOURCE_REPORT_CARD_LABEL_CLASS_NAME,
    SOURCE_REPORT_CARD_NUMBER_VALUE_CLASS_NAME,
    SOURCE_REPORT_CARD_SOURCE_FALLBACK_CLASS_NAME,
    SOURCE_REPORT_CARD_SOURCE_ICON_CLASS_NAME,
    SOURCE_REPORT_CARD_SOURCE_VALUE_CLASS_NAME,
    SOURCE_REPORT_CARD_VALUE_CLASS_NAME,
    SOURCE_REPORT_COPY_ICON_CLASS_NAME,
    SOURCE_REPORT_COPY_LABEL_CLASS_NAME,
    SOURCE_REPORT_DESCRIPTION_CLASS_NAME,
    SOURCE_REPORT_EMPTY_ACTION_ROW_CLASS_NAME,
    SOURCE_REPORT_EMPTY_DESCRIPTION_CLASS_NAME,
    SOURCE_REPORT_EMPTY_HEADER_CLASS_NAME,
    SOURCE_REPORT_EMPTY_TITLE_CLASS_NAME,
    SOURCE_REPORT_META_CLASS_NAME,
    SOURCE_REPORT_META_LABEL_CLASS_NAME,
    SOURCE_REPORT_META_MONO_VALUE_CLASS_NAME,
    SOURCE_REPORT_META_ROW_CLASS_NAME,
    SOURCE_REPORT_META_VALUE_CLASS_NAME,
    SOURCE_REPORT_METRIC_CARDS_CLASS_NAME,
    SOURCE_REPORT_SECTION_CLASS_NAME,
    SOURCE_REPORT_SECTION_HEADER_CLASS_NAME,
    SOURCE_REPORT_SECTION_SEPARATOR_CLASS_NAME,
    SOURCE_REPORT_SECTION_TITLE_CLASS_NAME,
    SOURCE_REPORT_SEGMENT_CLASS_NAME,
    SOURCE_REPORT_SEGMENT_SKELETON_CONTAINER_CLASS_NAME,
    SOURCE_REPORT_SEGMENT_SPEAKER_CLASS_NAME,
    SOURCE_REPORT_SEGMENT_TEXT_CLASS_NAME,
    SOURCE_REPORT_SEGMENT_TIME_CLASS_NAME,
    SOURCE_REPORT_SEGMENTS_CLASS_NAME,
    SOURCE_REPORT_SKELETON_CLASS_NAME,
    SOURCE_REPORT_STYLE_VARIABLES,
    SOURCE_REPORT_STATE_CLASS_NAME,
    SOURCE_REPORT_STATE_STACK_CLASS_NAME,
    SOURCE_REPORT_SUMMARY_BODY_CLASS_NAME,
    SOURCE_REPORT_SUMMARY_TEXT_CLASS_NAME,
} from "@/features/source-report/styles";
import {
    getSourceProviderLabel,
    getSourceRecordDescription,
    getSourceTabLabel,
} from "@/lib/data-sources/presentation";
import type { UiLanguage } from "@/lib/i18n";
import { writeBrowserClipboardText } from "@/lib/platform/clipboard";
import { cn } from "@/lib/utils";
import { runDataSourcesSync } from "@/services/data-sources";

type SourceActionAvailability = {
    available?: boolean;
    reason?: string | null;
};

type SourceOpenAction = SourceActionAvailability & {
    url?: string | null;
};

const SOURCE_REPORT_PROVIDER_VISUALS: Record<
    string,
    { cover: boolean; icon: string | null; letter: string }
> = {
    "dingtalk-a1": {
        cover: false,
        icon: "/assets/sources/dingtalk.svg",
        letter: "钉",
    },
    "feishu-minutes": {
        cover: true,
        icon: "/assets/sources/feishu.jpeg",
        letter: "飞",
    },
    iflyrec: {
        cover: false,
        icon: null,
        letter: "讯",
    },
    plaud: {
        cover: true,
        icon: "/assets/sources/plaud.png",
        letter: "P",
    },
    ticnote: {
        cover: false,
        icon: "/assets/sources/ticnote.png",
        letter: "T",
    },
};

interface SourceReportData {
    sourceProvider: string;
    filename: string;
    transcriptReady: boolean;
    summaryReady: boolean;
    transcript: {
        text: string;
        segmentCount: number;
        segments: SourceTranscriptSegment[];
    } | null;
    summaryMarkdown: string | null;
    detail: Record<string, unknown> | null;
    sourceActions?: {
        openSource?: SourceOpenAction | null;
        repullSource?: SourceActionAvailability | null;
    } | null;
}

interface SourceTranscriptSegment {
    speaker: string;
    startMs: number | null;
    endMs: number | null;
    text: string;
}

interface SourceReportPanelProps {
    recordingId: string;
    sourceProvider: string;
    autoLoad?: boolean;
    className?: string;
    hasAudio?: boolean;
    onAvailabilityChange?: (
        availability: SourceReportAvailabilitySnapshot,
    ) => void;
    variant?: "card" | "embedded";
}

export interface SourceReportAvailabilitySnapshot {
    state: "idle" | "loading" | "loaded" | "missing" | "error" | "empty";
    transcriptAvailable: boolean;
    reportAvailable: boolean;
}

const SENSITIVE_SOURCE_DETAIL_FIELD_PATTERN =
    /auth|bearer|cookie|credential|header|key|password|payload|raw|request|response|secret|session|token/i;
const SAFE_SOURCE_DETAIL_KEYS = new Set([
    "provider",
    "providerName",
    "providerSentenceName",
    "status",
    "statusLabel",
    "syncStatusLabel",
    "sourceStatusLabel",
    "sections",
    "createdAt",
    "recordedAt",
    "updatedAt",
    "syncedAt",
    "modifiedAt",
    "startedAt",
    "endedAt",
    "durationMs",
    "duration",
    "language",
    "title",
    "name",
    "source",
    "sourceTitle",
    "sourceName",
    "sourceSentenceName",
    "sourceProviderName",
    "sourceType",
    "readableContent",
    "assets",
    "availableContent",
    "locale",
    "lang",
    "speakerCount",
    "wordCount",
    "segmentCount",
    "summaryReady",
    "transcriptReady",
]);

function isZh(language: UiLanguage) {
    return language === "zh-CN";
}

function sourceFallbackLetter(provider: string, label: string) {
    const candidate = Array.from(label.trim())[0] ?? Array.from(provider)[0];
    return candidate?.toUpperCase() ?? "S";
}

function getOpenSourceLabel(provider: string, language: UiLanguage) {
    const label = getSourceProviderLabel(provider, language) ?? provider;
    return isZh(language) ? `在${label}中打开` : `Open in ${label}`;
}

function formatSotSourceReportDate(value: string | null | undefined) {
    if (!value) return "--";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatSotSourceReportDuration(valueMs: number | null | undefined) {
    if (valueMs == null || !Number.isFinite(valueMs) || valueMs <= 0) {
        return "--";
    }

    const totalSeconds = Math.floor(valueMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatTranscriptText(text: string, language: UiLanguage) {
    if (!isZh(language)) {
        return text;
    }

    return text.replace(/^Speaker\s+(\d+):/gim, "说话人 $1:");
}

function formatTranscriptSpeaker(speaker: string, language: UiLanguage) {
    if (!isZh(language)) {
        return speaker;
    }

    return speaker.replace(/^Speaker\s+(\d+)$/i, "说话人 $1");
}

function formatTranscriptTimestamp(valueMs: number | null) {
    if (valueMs == null || !Number.isFinite(valueMs)) {
        return null;
    }

    const totalSeconds = Math.max(0, Math.floor(valueMs / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
            .toString()
            .padStart(2, "0")}`;
    }

    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function formatTranscriptTimeRange(
    startMs: number | null,
    endMs: number | null,
) {
    const startLabel = formatTranscriptTimestamp(startMs);
    const endLabel = formatTranscriptTimestamp(endMs);

    if (startLabel && endLabel) {
        return `${startLabel} – ${endLabel}`;
    }

    return startLabel ?? endLabel;
}

function buildSourceTranscriptCopyText(
    transcript: SourceReportData["transcript"],
    language: UiLanguage,
) {
    if (!transcript) {
        return "";
    }

    if (transcript.segments.length > 0) {
        return transcript.segments
            .map((segment) => {
                const timeRange = formatTranscriptTimeRange(
                    segment.startMs,
                    segment.endMs,
                );
                const speaker = formatTranscriptSpeaker(
                    segment.speaker,
                    language,
                );
                const heading = [timeRange, speaker]
                    .filter(Boolean)
                    .join(" · ");
                return heading ? `${heading}\n${segment.text}` : segment.text;
            })
            .join("\n\n");
    }

    return formatTranscriptText(transcript.text, language);
}

function isSafeSourceDetailField(key: string) {
    return (
        SAFE_SOURCE_DETAIL_KEYS.has(key) &&
        !SENSITIVE_SOURCE_DETAIL_FIELD_PATTERN.test(key)
    );
}

function sourceReportDetailText(
    detail: Record<string, unknown> | null | undefined,
    keys: string[],
) {
    for (const key of keys) {
        if (!isSafeSourceDetailField(key)) continue;
        const value = detail?.[key];
        if (typeof value === "string" && value.trim()) {
            return value.trim();
        }
        if (typeof value === "number" && Number.isFinite(value)) {
            return String(value);
        }
        if (typeof value === "boolean") {
            return value ? "true" : "false";
        }
        if (Array.isArray(value)) {
            const parts = value
                .map((item) =>
                    typeof item === "string" || typeof item === "number"
                        ? String(item)
                        : null,
                )
                .filter((item): item is string => Boolean(item?.trim()));
            if (parts.length > 0) return parts.join(" · ");
        }
    }
    return null;
}

function sourceReportDetailNumber(
    detail: Record<string, unknown> | null | undefined,
    keys: string[],
) {
    for (const key of keys) {
        if (!isSafeSourceDetailField(key)) continue;
        const value = detail?.[key];
        if (typeof value === "number" && Number.isFinite(value)) {
            return value;
        }
        if (typeof value === "string") {
            const parsed = Number(value);
            if (Number.isFinite(parsed)) return parsed;
        }
    }
    return null;
}

function getSourceReportSubState(
    transcriptAvailable: boolean,
    reportAvailable: boolean,
) {
    if (transcriptAvailable && reportAvailable) return "complete";
    if (!transcriptAvailable && !reportAvailable) return "both-missing";
    if (!transcriptAvailable) return "transcript-missing";
    return "summary-missing";
}

function sourceSummaryDisplayText(markdown: string) {
    return markdown
        .split(/\r?\n/)
        .map((line) =>
            line
                .trim()
                .replace(/^#{1,6}\s+/, "")
                .replace(/^[-*]\s+/, ""),
        )
        .filter(Boolean)
        .join("\n");
}

function sourceSummaryHasDisplayHeading(markdown: string) {
    return /^#{1,6}\s+\S/m.test(markdown);
}

function sourceReportReadinessLabel(
    readiness: boolean | string | null | undefined,
    hasReadableContent: boolean,
    language: UiLanguage,
) {
    if (typeof readiness === "string" && readiness.trim()) {
        return readiness.trim();
    }
    if (readiness === true || hasReadableContent) {
        return isZh(language) ? "已就绪" : "ready";
    }
    return isZh(language) ? "未生成" : "missing";
}

type SourceReportTone = "err" | "neu" | "ok" | "warn";

type SourceReportCardSkeletonSize = "count" | "source" | "status";
type SourceReportSegmentSkeletonSize =
    | "line-long"
    | "line-medium"
    | "line-short"
    | "line-wide"
    | "speaker"
    | "time";

const sourceReportCardSkeletonClassNames = {
    count: cn(
        SOURCE_REPORT_SKELETON_CLASS_NAME,
        "inline-block h-[18px] w-[48px] align-middle rounded-[6px]",
    ),
    source: cn(
        SOURCE_REPORT_SKELETON_CLASS_NAME,
        "inline-block h-[18px] w-[120px] align-middle rounded-[6px]",
    ),
    status: cn(
        SOURCE_REPORT_SKELETON_CLASS_NAME,
        "inline-block h-[18px] w-[80px] align-middle rounded-[6px]",
    ),
} as const satisfies Record<SourceReportCardSkeletonSize, string>;

// biome-ignore format: regression tests assert these local contract tokens as single-line source text.
const sourceReportSegmentSkeletonClassNames = {
    "line-long": cn(
        SOURCE_REPORT_SKELETON_CLASS_NAME,
        "mt-1.5 inline-block h-[13px] w-[92%] align-middle rounded-[4px]",
    ),
    "line-medium": cn(
        SOURCE_REPORT_SKELETON_CLASS_NAME,
        "mt-1.5 inline-block h-[13px] w-[76%] align-middle rounded-[4px]",
    ),
    "line-short": cn(
        SOURCE_REPORT_SKELETON_CLASS_NAME,
        "mt-1.5 inline-block h-[13px] w-3/5 align-middle rounded-[4px]",
    ),
    "line-wide": cn(
        SOURCE_REPORT_SKELETON_CLASS_NAME,
        "mt-[7px] inline-block h-[13px] w-[88%] align-middle rounded-[4px]",
    ),
    speaker: cn(
        SOURCE_REPORT_SKELETON_CLASS_NAME,
        "ml-[5px] inline-block h-[12px] w-[54px] align-middle rounded-[4px]",
    ),
    time: cn(
        SOURCE_REPORT_SKELETON_CLASS_NAME,
        "inline-block h-[12px] w-[96px] align-middle rounded-[4px]",
    ),
} as const satisfies Record<SourceReportSegmentSkeletonSize, string>;

function sourceReportReadinessTone(label: string): SourceReportTone {
    const normalized = label.toLowerCase();
    if (label === "已就绪" || normalized === "ready") return "ok";
    if (label === "失败" || normalized.includes("failed")) {
        return "err";
    }
    if (
        label === "生成中" ||
        label === "未生成" ||
        normalized.includes("loading") ||
        normalized.includes("missing")
    ) {
        return "warn";
    }
    return "neu";
}

function sourceReportSyncTone(label: string): SourceReportTone {
    const normalized = label.toLowerCase();
    if (label.includes("失败") || normalized.includes("fail")) {
        return "err";
    }
    if (
        label.includes("待") ||
        label.includes("仅") ||
        label.includes("生成中") ||
        normalized.includes("pending")
    ) {
        return "warn";
    }
    if (
        label.includes("已") ||
        label.includes("同步") ||
        normalized.includes("available") ||
        normalized.includes("synced")
    ) {
        return "ok";
    }
    return "neu";
}

function formatSourceReportStatusLabel(
    value: string | null,
    language: UiLanguage,
) {
    if (!value) return isZh(language) ? "已同步" : "synced";
    if (value === "available") return isZh(language) ? "已同步" : "synced";
    return value;
}

function SotCopyIcon({ state }: { state?: "err" | "ok" }) {
    const Icon = state === "ok" ? Check : Copy;

    return (
        <Icon
            className={SOURCE_REPORT_COPY_ICON_CLASS_NAME}
            data-icon="inline-start"
            data-sot-part="source-report-copy-icon"
            aria-hidden="true"
        />
    );
}

const SOURCE_REPORT_ACTION_BUTTON_CLASS_NAME = "text-[var(--fg-primary)]";
const SOURCE_REPORT_PRIMARY_ACTION_BUTTON_CLASS_NAME =
    "h-[26px] gap-[7px] rounded-[7px] border border-[var(--source-report-primary-border)] [background:var(--source-report-primary-bg)] px-[10px] text-[12px] font-semibold leading-[normal] text-white shadow-[var(--source-report-primary-shadow)] has-[>svg]:px-[10px] hover:[background:var(--source-report-primary-hover-bg)] hover:text-white";
const SOURCE_REPORT_GHOST_ACTION_BUTTON_CLASS_NAME =
    "h-[26px] gap-[7px] rounded-[7px] border border-transparent bg-transparent px-[10px] text-[12px] font-semibold leading-[normal] text-[var(--fg-secondary)] shadow-none has-[>svg]:px-[10px] hover:bg-[var(--bg-recessed)] hover:text-[var(--fg-primary)] dark:hover:bg-[var(--bg-recessed)]";
const SOURCE_REPORT_COPY_BUTTON_VARIANT =
    "ghost" satisfies ButtonProps["variant"];
const SOURCE_REPORT_COPY_BUTTON_SIZE =
    "sm" satisfies ButtonProps["size"];
const SOURCE_REPORT_COPY_BUTTON_CLASS_NAME =
    "h-[26px] gap-[6px] rounded-[7px] px-[10px] text-[12px] font-semibold leading-normal text-[var(--fg-secondary)] has-[>svg]:px-[10px] hover:bg-[var(--bg-recessed)] hover:text-[var(--fg-primary)] [&_svg:not([class*='size-'])]:size-[14px] data-[copy-state=ok]:border-[var(--button-copy-success-border)] data-[copy-state=ok]:bg-[var(--button-copy-success-bg)] data-[copy-state=ok]:text-[var(--signal-success)] data-[copy-state=ok]:hover:bg-[var(--button-copy-success-bg)] data-[copy-state=ok]:hover:text-[var(--signal-success)] data-[copy-state=err]:border-[var(--button-copy-danger-border)] data-[copy-state=err]:text-[var(--signal-danger)] data-[copy-state=err]:hover:bg-transparent data-[copy-state=err]:hover:text-[var(--signal-danger)]";
const SOURCE_REPORT_ERROR_ALERT_CLASS_NAME =
    "flex w-full flex-col items-center gap-2 rounded-lg px-4 py-8 text-center text-sm [&>svg]:text-current";
const SOURCE_REPORT_ERROR_ICON_CLASS_NAME =
    "mb-0 size-10 rounded-full border border-border bg-background text-muted-foreground [&_svg:not([class*='size-'])]:size-5";

function SourceReportStatusDot() {
    return <span data-sot-part="source-report-status-dot" aria-hidden="true" />;
}

function SourceReportAlertGlyph() {
    return (
        <svg
            className="size-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
        >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5" />
            <circle cx="12" cy="16" r=".8" fill="currentColor" />
        </svg>
    );
}

function SourceReportEmptyGlyph() {
    return (
        <svg
            className="size-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
        >
            <rect x="3" y="6" width="18" height="14" rx="2" />
            <path d="M8 6V4h8v2" />
        </svg>
    );
}

const SOURCE_REPORT_STATUS_BADGE_STYLE =
    "h-[22px] min-w-[65px] justify-normal gap-[9px] overflow-visible rounded-full border px-[8px] py-0 text-[11px] font-semibold leading-[normal] shadow-none data-[sot-tone=err]:border-[var(--source-report-status-err-border)] data-[sot-tone=err]:bg-[var(--source-report-status-err-bg)] data-[sot-tone=err]:text-[var(--signal-danger)] data-[sot-tone=neu]:border-[var(--line-hairline)] data-[sot-tone=neu]:bg-[var(--bg-recessed)] data-[sot-tone=neu]:text-[var(--fg-secondary)] data-[sot-tone=ok]:border-[var(--source-report-status-ok-border)] data-[sot-tone=ok]:bg-[var(--source-report-status-ok-bg)] data-[sot-tone=ok]:text-[var(--source-report-status-ok-fg)] data-[sot-tone=warn]:border-[var(--source-report-status-warn-border)] data-[sot-tone=warn]:bg-[var(--source-report-status-warn-bg)] data-[sot-tone=warn]:text-[var(--source-report-status-warn-fg)] [&_[data-sot-part=dashboard-source-report-status-dot]]:mr-0 [&_[data-sot-part=dashboard-source-report-status-dot]]:inline-block [&_[data-sot-part=dashboard-source-report-status-dot]]:size-[5px] [&_[data-sot-part=dashboard-source-report-status-dot]]:rounded-full [&_[data-sot-part=dashboard-source-report-status-dot]]:bg-current [&_[data-sot-part=source-report-status-dot]]:mr-0 [&_[data-sot-part=source-report-status-dot]]:inline-block [&_[data-sot-part=source-report-status-dot]]:size-[5px] [&_[data-sot-part=source-report-status-dot]]:rounded-full [&_[data-sot-part=source-report-status-dot]]:bg-current";

function SourceReportStatusBadge({
    children,
    tone,
}: {
    children: ReactNode;
    tone: SourceReportTone;
}) {
    return (
        <Badge
            variant="ghost"
            className={SOURCE_REPORT_STATUS_BADGE_STYLE}
            data-sot-badge="source-report-status"
            data-sot-tone={tone}
        >
            {children}
        </Badge>
    );
}

function SourceReportSegmentSkeleton({
    size,
}: {
    size: SourceReportSegmentSkeletonSize;
}) {
    return (
        <Skeleton
            variant="default"
            size="default"
            className={sourceReportSegmentSkeletonClassNames[size]}
            aria-hidden="true"
            data-sot-part="source-report-segment-skeleton"
            data-sot-size={size}
        />
    );
}

function SourceReportState({
    children,
    error,
    sotState,
    state,
    subState,
}: {
    children: ReactNode;
    error?: string;
    sotState: SourceReportAvailabilitySnapshot["state"];
    state: "empty" | "error" | "loaded" | "loading";
    subState?: string;
}) {
    return (
        <div
            data-sot-source-report-state
            data-sot-panel="recording-source-report-state"
            data-sot-state={sotState}
            data-state={state}
            data-sub-state={subState}
            data-sot-error={error}
            className={SOURCE_REPORT_STATE_CLASS_NAME}
            style={SOURCE_REPORT_STYLE_VARIABLES}
        >
            {children}
        </div>
    );
}

function SourceReportSection({
    children,
    description,
    section,
    title,
}: {
    children: ReactNode;
    description: ReactNode;
    section: "metadata" | "summary" | "transcript";
    title: string;
}) {
    return (
        <section
            className={SOURCE_REPORT_SECTION_CLASS_NAME}
            data-sot-source-report-section
            data-sot-section={section}
        >
            <Separator
                className={SOURCE_REPORT_SECTION_SEPARATOR_CLASS_NAME}
                data-sot-source-report-section-separator
            />
            <header
                className={SOURCE_REPORT_SECTION_HEADER_CLASS_NAME}
                data-sot-source-report-section-header
            >
                <h4
                    className={SOURCE_REPORT_SECTION_TITLE_CLASS_NAME}
                    data-sot-source-report-section-title
                >
                    {title}
                </h4>
                <span
                    className={SOURCE_REPORT_DESCRIPTION_CLASS_NAME}
                    data-sot-source-report-section-description
                >
                    {description}
                </span>
            </header>
            {children}
        </section>
    );
}

function SourceReportMetricCards({ children }: { children: ReactNode }) {
    return (
        <div
            className={SOURCE_REPORT_METRIC_CARDS_CLASS_NAME}
            data-sot-list="source-report-cards"
        >
            {children}
        </div>
    );
}

const SOURCE_REPORT_METRIC_CARD_CLASS_NAME =
    "gap-[6px] overflow-visible rounded-[10px] border-[var(--source-report-metric-border)] bg-[var(--source-report-metric-bg)] px-[12px] py-[10px] shadow-none backdrop-blur-none";

function SourceReportMetricCard({
    children,
    label,
    metric,
    value,
}: {
    children: ReactNode;
    label: string;
    metric: "segment-count" | "source" | "summary-status" | "transcript-status";
    value?: "number" | "skeleton" | "source";
}) {
    return (
        <Card
            hasNoPadding
            className={SOURCE_REPORT_METRIC_CARD_CLASS_NAME}
            data-sot-card="source-report-metric"
            data-sot-metric={metric}
        >
            <div
                className={SOURCE_REPORT_CARD_LABEL_CLASS_NAME}
                data-sot-part="source-report-card-label"
            >
                {label}
            </div>
            {value === "skeleton" ? (
                children
            ) : (
                <div
                    className={cn(
                        SOURCE_REPORT_CARD_VALUE_CLASS_NAME,
                        value === "source" &&
                            SOURCE_REPORT_CARD_SOURCE_VALUE_CLASS_NAME,
                        value === "number" &&
                            SOURCE_REPORT_CARD_NUMBER_VALUE_CLASS_NAME,
                    )}
                    data-sot-part="source-report-card-value"
                    data-sot-value={value}
                >
                    {children}
                </div>
            )}
        </Card>
    );
}

function SourceReportCardSkeleton({
    size,
}: {
    size: SourceReportCardSkeletonSize;
}) {
    return (
        <Skeleton
            variant="default"
            size="default"
            className={sourceReportCardSkeletonClassNames[size]}
            aria-hidden="true"
            data-sot-part="source-report-card-skeleton"
            data-sot-size={size}
        />
    );
}

function SourceReportMetaRow({
    children,
    label,
}: {
    children: ReactNode;
    label: string;
}) {
    return (
        <div
            className={SOURCE_REPORT_META_ROW_CLASS_NAME}
            data-sot-source-report-meta-row
        >
            <dt className={SOURCE_REPORT_META_LABEL_CLASS_NAME}>{label}</dt>
            <dd className={SOURCE_REPORT_META_VALUE_CLASS_NAME}>{children}</dd>
        </div>
    );
}

export function SourceReportPanel({
    autoLoad = false,
    className,
    hasAudio = true,
    onAvailabilityChange,
    recordingId,
    sourceProvider,
    variant = "card",
}: SourceReportPanelProps) {
    const { language, t } = useLanguage();
    const [isLoading, setIsLoading] = useState(false);
    const [data, setData] = useState<SourceReportData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [copyingKey, setCopyingKey] = useState<
        "source-transcript" | "source-report" | null
    >(null);
    const [copyFeedback, setCopyFeedback] = useState<{
        action: "source-transcript" | "source-report";
        state: "ok" | "err";
    } | null>(null);
    const [repullState, setRepullState] = useState<
        "idle" | "loading" | "success" | "error"
    >("idle");
    const activeReportRequestRef = useRef<{
        controller: AbortController;
        id: number;
    } | null>(null);
    const reportRequestIdRef = useRef(0);
    const copyFeedbackTimerRef = useRef<number | null>(null);

    const loadReport = useCallback(async () => {
        if (!recordingId || !sourceProvider) {
            setIsLoading(false);
            setError(null);
            return;
        }

        activeReportRequestRef.current?.controller.abort();
        const requestId = reportRequestIdRef.current + 1;
        reportRequestIdRef.current = requestId;
        const controller = new AbortController();
        activeReportRequestRef.current = { controller, id: requestId };

        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(
                `/api/recordings/${recordingId}/source-report`,
                { cache: "no-store", signal: controller.signal },
            );
            const payload = await response.json();
            if (
                controller.signal.aborted ||
                activeReportRequestRef.current?.id !== requestId
            ) {
                return;
            }

            if (!response.ok) {
                setError(payload.error ?? t("sourceReport.failedFetch"));
                return;
            }

            setData(payload);
        } catch (fetchError) {
            if (
                controller.signal.aborted ||
                activeReportRequestRef.current?.id !== requestId
            ) {
                return;
            }

            if (
                fetchError instanceof DOMException &&
                fetchError.name === "AbortError"
            ) {
                return;
            }

            const nextError = t("sourceReport.failedFetch");
            setError(nextError);
            toast.error(nextError);
        } finally {
            if (activeReportRequestRef.current?.id === requestId) {
                activeReportRequestRef.current = null;
                setIsLoading(false);
            }
        }
    }, [recordingId, sourceProvider, t]);

    useEffect(() => {
        activeReportRequestRef.current?.controller.abort();
        activeReportRequestRef.current = null;
        reportRequestIdRef.current += 1;

        if (!recordingId || !sourceProvider) {
            return;
        }

        setData(null);
        setError(null);
        setIsLoading(false);
        setRepullState("idle");
    }, [recordingId, sourceProvider]);

    useEffect(() => {
        return () => {
            activeReportRequestRef.current?.controller.abort();
            activeReportRequestRef.current = null;
            if (copyFeedbackTimerRef.current) {
                window.clearTimeout(copyFeedbackTimerRef.current);
                copyFeedbackTimerRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (!autoLoad) {
            return;
        }

        void loadReport();
    }, [autoLoad, loadReport]);

    const sourceTranscriptCopyText = buildSourceTranscriptCopyText(
        data?.transcript ?? null,
        language,
    );
    const sourceReportCopyText = data?.summaryMarkdown ?? "";
    const sourceSummaryText = sourceSummaryDisplayText(sourceReportCopyText);
    const sourceSummaryVisible =
        sourceSummaryText &&
        sourceSummaryHasDisplayHeading(sourceReportCopyText);
    const transcriptAvailable = Boolean(sourceTranscriptCopyText.trim());
    const reportAvailable = Boolean(sourceReportCopyText.trim());
    const sourceReportState: SourceReportAvailabilitySnapshot["state"] = data
        ? "loaded"
        : isLoading
          ? "loading"
          : error
            ? "error"
            : "empty";
    const sourceReportSubState = getSourceReportSubState(
        transcriptAvailable,
        reportAvailable,
    );
    const sourceTranscriptCopyState =
        copyingKey === "source-transcript"
            ? "copying"
            : transcriptAvailable
              ? "ready"
              : "missing";
    const sourceReportCopyState =
        copyingKey === "source-report"
            ? "copying"
            : reportAvailable
              ? "ready"
              : "missing";
    const sourceTranscriptCopyDisabled =
        copyingKey === "source-transcript" || !transcriptAvailable;
    const sourceReportCopyDisabled =
        copyingKey === "source-report" || !reportAvailable;
    const openSourceAction = data?.sourceActions?.openSource;
    const openSourceUrl =
        openSourceAction?.available && openSourceAction.url
            ? openSourceAction.url
            : null;
    const openSourceControlState = data
        ? openSourceUrl
            ? "ready"
            : "unavailable"
        : sourceReportState === "loading"
          ? "loading"
          : "unavailable";
    const repullSourceAction = data?.sourceActions?.repullSource;
    const repullAvailable = Boolean(repullSourceAction?.available);
    const repullControlState =
        repullState === "loading"
            ? "loading"
            : repullState === "error"
              ? "error"
              : repullAvailable
                ? "ready"
                : data
                  ? "unavailable"
                  : sourceReportState === "loading"
                    ? "loading"
                    : "unavailable";
    const repullDisabled = repullState === "loading" || !repullAvailable;
    const sourceProviderForReport = data?.sourceProvider ?? sourceProvider;
    const sourceReportDetail = data?.detail ?? null;
    const sourceProviderLabel =
        sourceReportDetailText(sourceReportDetail, [
            "providerName",
            "sourceName",
            "sourceProviderName",
        ]) ??
        getSourceProviderLabel(sourceProviderForReport, language) ??
        sourceProviderForReport;
    const sourceProviderSentenceName =
        sourceReportDetailText(sourceReportDetail, [
            "providerSentenceName",
            "sourceSentenceName",
        ]) ?? sourceProviderLabel.replace(/\s+/g, "");
    const sourceProviderVisual =
        SOURCE_REPORT_PROVIDER_VISUALS[sourceProviderForReport];
    const sourceProviderIcon = sourceProviderVisual?.icon ?? null;
    const sourceProviderLetter =
        sourceProviderVisual?.letter ??
        sourceFallbackLetter(sourceProviderForReport, sourceProviderLabel);
    const sourceTranscriptStatusLabel = sourceReportReadinessLabel(
        data?.transcriptReady,
        transcriptAvailable,
        language,
    );
    const sourceSummaryStatusLabel = sourceReportReadinessLabel(
        data?.summaryReady,
        reportAvailable,
        language,
    );
    const sourceReportStatusLabel = formatSourceReportStatusLabel(
        sourceReportDetailText(sourceReportDetail, [
            "statusLabel",
            "syncStatusLabel",
            "sourceStatusLabel",
            "status",
        ]),
        language,
    );
    const sourceReportTitle =
        sourceReportDetailText(sourceReportDetail, ["sourceTitle", "title"]) ??
        data?.filename ??
        "--";
    const sourceReportRecordedAt =
        sourceReportDetailText(sourceReportDetail, [
            "recordedAt",
            "startTime",
            "createdAt",
        ]) ?? null;
    const sourceReportUpdatedAt =
        sourceReportDetailText(sourceReportDetail, [
            "updatedAt",
            "syncedAt",
            "modifiedAt",
        ]) ?? sourceReportRecordedAt;
    const sourceReportLanguage =
        sourceReportDetailText(sourceReportDetail, [
            "language",
            "locale",
            "lang",
        ]) ?? (isZh(language) ? "简体中文 (zh-CN)" : "zh-CN");
    const sourceReportReadable =
        sourceReportDetailText(sourceReportDetail, [
            "readableContent",
            "assets",
            "availableContent",
            "sections",
        ]) ??
        (isZh(language)
            ? "音频 · 转写 · 摘要 · 说话人"
            : "audio · transcript · summary · speakers");
    const sourceReportRawSegments = data?.transcript?.segments ?? [];
    const sourceReportTranscriptText = data?.transcript?.text?.trim() ?? "";
    const sourceReportDisplaySegments: SourceTranscriptSegment[] =
        sourceReportRawSegments.length > 0
            ? sourceReportRawSegments
            : sourceReportTranscriptText
              ? [
                    {
                        speaker: sourceProviderLabel,
                        startMs: null,
                        endMs: null,
                        text: formatTranscriptText(
                            sourceReportTranscriptText,
                            language,
                        ),
                    },
                ]
              : [];
    const sourceReportSegmentCount =
        data?.transcript?.segmentCount ?? sourceReportDisplaySegments.length;
    const sourceReportDurationMs =
        sourceReportDetailNumber(sourceReportDetail, ["durationMs"]) ??
        (() => {
            const duration = sourceReportDetailNumber(sourceReportDetail, [
                "duration",
            ]);
            if (duration == null) return null;
            return duration > 10_000 ? duration : duration * 1000;
        })() ??
        Math.max(
            0,
            ...sourceReportDisplaySegments.map((segment) => segment.endMs ?? 0),
        );
    const sourceReportDurationLabel = formatSotSourceReportDuration(
        sourceReportDurationMs,
    );

    useEffect(() => {
        onAvailabilityChange?.({
            state: sourceReportState,
            transcriptAvailable,
            reportAvailable,
        });
    }, [
        onAvailabilityChange,
        reportAvailable,
        sourceReportState,
        transcriptAvailable,
    ]);

    const showCopyFeedback = useCallback(
        (
            action: "source-transcript" | "source-report",
            state: "ok" | "err",
        ) => {
            if (copyFeedbackTimerRef.current) {
                window.clearTimeout(copyFeedbackTimerRef.current);
            }
            setCopyFeedback({ action, state });
            copyFeedbackTimerRef.current = window.setTimeout(() => {
                setCopyFeedback((current) =>
                    current?.action === action ? null : current,
                );
                copyFeedbackTimerRef.current = null;
            }, 1500);
        },
        [],
    );

    const handleCopySourceTranscript = useCallback(async () => {
        if (!sourceTranscriptCopyText.trim()) {
            toast.error(t("sourceReport.missingSourceTranscript"));
            return;
        }

        setCopyingKey("source-transcript");
        try {
            await writeBrowserClipboardText(sourceTranscriptCopyText);
            showCopyFeedback("source-transcript", "ok");
            toast.success(t("sourceReport.sourceTranscriptCopied"));
        } catch {
            showCopyFeedback("source-transcript", "err");
            toast.error(t("sourceReport.copyFailed"));
        } finally {
            setCopyingKey(null);
        }
    }, [showCopyFeedback, sourceTranscriptCopyText, t]);

    const handleCopySourceReport = useCallback(async () => {
        if (!sourceReportCopyText.trim()) {
            toast.error(t("sourceReport.missingSourceReport"));
            return;
        }

        setCopyingKey("source-report");
        try {
            await writeBrowserClipboardText(sourceReportCopyText);
            showCopyFeedback("source-report", "ok");
            toast.success(t("sourceReport.sourceReportCopied"));
        } catch {
            showCopyFeedback("source-report", "err");
            toast.error(t("sourceReport.copyFailed"));
        } finally {
            setCopyingKey(null);
        }
    }, [showCopyFeedback, sourceReportCopyText, t]);

    const handleOpenSourceRecord = useCallback(() => {
        if (!openSourceUrl) {
            toast.error(t("sourceReport.openSourceUnavailable"));
            return;
        }

        window.open(openSourceUrl, "_blank", "noopener,noreferrer");
    }, [openSourceUrl, t]);

    const handleRepullSource = useCallback(async () => {
        if (repullDisabled) {
            if (!repullAvailable) {
                toast.error(t("sourceReport.repullUnavailable"));
            }
            return;
        }

        setRepullState("loading");
        try {
            await runDataSourcesSync();
            await loadReport();
            setRepullState("success");
            toast.success(t("sourceReport.repullComplete"));
        } catch {
            setRepullState("error");
            toast.error(t("sourceReport.repullFailed"));
        }
    }, [loadReport, repullAvailable, repullDisabled, t]);

    const sourceActionControls = data ? (
        <div
            className={SOURCE_REPORT_ACTION_ROW_CLASS_NAME}
            data-sot-source-report-actions
        >
            <Button
                variant="ghost"
                size="xs"
                className={SOURCE_REPORT_GHOST_ACTION_BUTTON_CLASS_NAME}
                type="button"
                disabled={!openSourceUrl}
                title={
                    openSourceUrl
                        ? undefined
                        : t("sourceReport.openSourceUnavailable")
                }
                data-sot-control="open-source-record"
                data-sot-state={openSourceControlState}
                onClick={handleOpenSourceRecord}
            >
                {getOpenSourceLabel(sourceProviderForReport, language)}
            </Button>
            <Button
                variant="ghost"
                size="xs"
                className={SOURCE_REPORT_GHOST_ACTION_BUTTON_CLASS_NAME}
                type="button"
                disabled={repullDisabled}
                aria-busy={repullState === "loading"}
                title={
                    repullAvailable
                        ? undefined
                        : t("sourceReport.repullUnavailable")
                }
                data-sot-control="repull-source"
                data-sot-state={repullControlState}
                onClick={() => void handleRepullSource()}
            >
                {repullState === "loading"
                    ? t("sourceReport.repullingSource")
                    : t("sourceReport.repullSource")}
            </Button>
        </div>
    ) : null;

    const header = (
        <CardHeader
            className="flex flex-col gap-3 px-0 sm:flex-row sm:items-start sm:justify-between"
            data-sot-source-report-header
        >
            <div
                className="flex min-w-0 flex-col gap-1"
                data-sot-source-report-heading
            >
                <CardTitle
                    className="inline-flex min-w-0 items-center gap-1.5"
                    data-sot-source-report-title
                >
                    <CloudDownload
                        data-icon="inline-start"
                        aria-hidden="true"
                    />
                    {getSourceTabLabel(sourceProvider, language)}
                </CardTitle>
                <CardDescription
                    className={SOURCE_REPORT_DESCRIPTION_CLASS_NAME}
                    data-sot-source-report-description
                >
                    {getSourceRecordDescription(sourceProvider, language)}
                </CardDescription>
            </div>
            <CardAction
                className="static col-auto row-auto flex max-w-full flex-wrap items-center justify-end gap-2 self-auto justify-self-auto sm:ml-auto"
                data-sot-source-report-header-actions
            >
                {data ? (
                    <>
                        <Button
                            variant={SOURCE_REPORT_COPY_BUTTON_VARIANT}
                            size={SOURCE_REPORT_COPY_BUTTON_SIZE}
                            className={SOURCE_REPORT_COPY_BUTTON_CLASS_NAME}
                            type="button"
                            data-copy="source-transcript"
                            data-copy-state={
                                copyFeedback?.action === "source-transcript"
                                    ? copyFeedback.state
                                    : undefined
                            }
                            data-sot-control="copy-source-transcript"
                            data-sot-state={sourceTranscriptCopyState}
                            data-tab-scope="source-report"
                            aria-busy={copyingKey === "source-transcript"}
                            aria-disabled={
                                sourceTranscriptCopyDisabled ? "true" : "false"
                            }
                            aria-label={t("sourceReport.copySourceTranscript")}
                            aria-live={
                                copyFeedback?.action === "source-transcript"
                                    ? "polite"
                                    : undefined
                            }
                            disabled={sourceTranscriptCopyDisabled}
                            onClick={() => void handleCopySourceTranscript()}
                        >
                            <SotCopyIcon
                                state={
                                    copyFeedback?.action === "source-transcript"
                                        ? copyFeedback.state
                                        : undefined
                                }
                            />
                            <span
                                className={SOURCE_REPORT_COPY_LABEL_CLASS_NAME}
                                data-sot-part="source-report-copy-label"
                            >
                                {copyFeedback?.action === "source-transcript"
                                    ? copyFeedback.state === "ok"
                                        ? t("common.copied")
                                        : t("common.copyFailedShort")
                                    : t("sourceReport.copySourceTranscript")}
                            </span>
                        </Button>
                        <Button
                            variant={SOURCE_REPORT_COPY_BUTTON_VARIANT}
                            size={SOURCE_REPORT_COPY_BUTTON_SIZE}
                            className={SOURCE_REPORT_COPY_BUTTON_CLASS_NAME}
                            type="button"
                            data-copy="source-report"
                            data-copy-state={
                                copyFeedback?.action === "source-report"
                                    ? copyFeedback.state
                                    : undefined
                            }
                            data-sot-control="copy-source-report"
                            data-sot-state={sourceReportCopyState}
                            data-tab-scope="source-report"
                            aria-busy={copyingKey === "source-report"}
                            aria-disabled={
                                sourceReportCopyDisabled ? "true" : "false"
                            }
                            aria-label={t("sourceReport.copySourceReport")}
                            aria-live={
                                copyFeedback?.action === "source-report"
                                    ? "polite"
                                    : undefined
                            }
                            disabled={sourceReportCopyDisabled}
                            onClick={() => void handleCopySourceReport()}
                        >
                            <SotCopyIcon
                                state={
                                    copyFeedback?.action === "source-report"
                                        ? copyFeedback.state
                                        : undefined
                                }
                            />
                            <span
                                className={SOURCE_REPORT_COPY_LABEL_CLASS_NAME}
                                data-sot-part="source-report-copy-label"
                            >
                                {copyFeedback?.action === "source-report"
                                    ? copyFeedback.state === "ok"
                                        ? t("common.copied")
                                        : t("common.copyFailedShort")
                                    : t("sourceReport.copySourceReport")}
                            </span>
                        </Button>
                    </>
                ) : null}
                <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    className={SOURCE_REPORT_ACTION_BUTTON_CLASS_NAME}
                    onClick={loadReport}
                    disabled={isLoading}
                    data-sot-control="refresh-source-report"
                    data-sot-state={sourceReportState}
                >
                    {isLoading ? (
                        <>
                            <LoaderCircle
                                data-icon="inline-start"
                                aria-hidden="true"
                            />
                            {t("sourceReport.loadingDetail")}
                        </>
                    ) : (
                        <>
                            <CloudDownload
                                data-icon="inline-start"
                                aria-hidden="true"
                            />
                            {data
                                ? t("sourceReport.refresh")
                                : t("sourceReport.loadDetail")}
                        </>
                    )}
                </Button>
            </CardAction>
        </CardHeader>
    );

    const content = (
        <CardContent
            className={cn("px-0", SOURCE_REPORT_STATE_STACK_CLASS_NAME)}
            data-sot-source-report-state-stack
        >
            {error && (
                <SourceReportState sotState="error" state="error" error={error}>
                    <Alert
                        variant="statusError"
                        className={SOURCE_REPORT_ERROR_ALERT_CLASS_NAME}
                        data-sot-source-report-empty
                        data-sot-tone="err"
                    >
                        <EmptyMedia
                            className={SOURCE_REPORT_ERROR_ICON_CLASS_NAME}
                            data-sot-source-report-empty-icon
                            aria-hidden="true"
                        >
                            <SourceReportAlertGlyph />
                        </EmptyMedia>
                        <AlertTitle
                            className={cn(
                                "text-center",
                                SOURCE_REPORT_EMPTY_TITLE_CLASS_NAME,
                            )}
                            data-sot-source-report-empty-title
                        >
                            无法读取来源详情
                        </AlertTitle>
                        <AlertDescription
                            className={cn(
                                "max-w-xs justify-items-center text-center",
                                SOURCE_REPORT_EMPTY_DESCRIPTION_CLASS_NAME,
                            )}
                            data-sot-source-report-empty-description
                        >
                            {sourceProviderSentenceName}
                            返回了一个错误，可能是网络抖动或来源临时不可用。
                        </AlertDescription>
                        <div
                            data-sot-source-report-empty-actions
                            className={cn(
                                "justify-center",
                                SOURCE_REPORT_EMPTY_ACTION_ROW_CLASS_NAME,
                            )}
                        >
                            <Button
                                type="button"
                                size="xs"
                                variant="default"
                                className={
                                    SOURCE_REPORT_PRIMARY_ACTION_BUTTON_CLASS_NAME
                                }
                                onClick={loadReport}
                                disabled={isLoading}
                                data-sot-control="refresh-source-report"
                                data-sot-state="error"
                            >
                                重试
                            </Button>
                            <Button
                                type="button"
                                size="xs"
                                variant="ghost"
                                className={
                                    SOURCE_REPORT_GHOST_ACTION_BUTTON_CLASS_NAME
                                }
                                onClick={() => {
                                    window.location.assign(
                                        "/dashboard#activity",
                                    );
                                }}
                            >
                                查看同步日志
                            </Button>
                        </div>
                    </Alert>
                </SourceReportState>
            )}

            {isLoading && !data && !error ? (
                <SourceReportState sotState="loading" state="loading">
                    <SourceReportMetricCards>
                        <SourceReportMetricCard
                            label="来源"
                            metric="source"
                            value="skeleton"
                        >
                            <SourceReportCardSkeleton size="source" />
                        </SourceReportMetricCard>
                        <SourceReportMetricCard
                            label="转写状态"
                            metric="transcript-status"
                            value="skeleton"
                        >
                            <SourceReportCardSkeleton size="status" />
                        </SourceReportMetricCard>
                        <SourceReportMetricCard
                            label="摘要状态"
                            metric="summary-status"
                            value="skeleton"
                        >
                            <SourceReportCardSkeleton size="status" />
                        </SourceReportMetricCard>
                        <SourceReportMetricCard
                            label="分段数"
                            metric="segment-count"
                            value="skeleton"
                        >
                            <SourceReportCardSkeleton size="count" />
                        </SourceReportMetricCard>
                    </SourceReportMetricCards>
                    <SourceReportSection
                        section="transcript"
                        title="来源转写"
                        description={
                            <>正在从{sourceProviderSentenceName}读取…</>
                        }
                    >
                        <div
                            className={
                                SOURCE_REPORT_SEGMENT_SKELETON_CONTAINER_CLASS_NAME
                            }
                            data-sot-source-report-segment
                            data-sot-state="skeleton"
                        >
                            <SourceReportSegmentSkeleton size="time" />
                            <SourceReportSegmentSkeleton size="speaker" />
                            <SourceReportSegmentSkeleton size="line-long" />
                            <SourceReportSegmentSkeleton size="line-medium" />
                        </div>
                        <div
                            className={
                                SOURCE_REPORT_SEGMENT_SKELETON_CONTAINER_CLASS_NAME
                            }
                            data-sot-source-report-segment
                            data-sot-state="skeleton"
                        >
                            <SourceReportSegmentSkeleton size="time" />
                            <SourceReportSegmentSkeleton size="speaker" />
                            <SourceReportSegmentSkeleton size="line-wide" />
                            <SourceReportSegmentSkeleton size="line-short" />
                        </div>
                    </SourceReportSection>
                </SourceReportState>
            ) : null}

            {data && (
                <SourceReportState
                    sotState={sourceReportState}
                    state="loaded"
                    subState={sourceReportSubState}
                >
                    {!hasAudio ? (
                        <SourceReportStatusBadge tone="warn">
                            <SourceReportStatusDot />
                            <span>{t("sourceReport.sourceOnlyNoAudio")}</span>
                        </SourceReportStatusBadge>
                    ) : null}

                    <SourceReportMetricCards>
                        <SourceReportMetricCard
                            label="来源"
                            metric="source"
                            value="source"
                        >
                            {sourceProviderIcon ? (
                                // biome-ignore lint/performance/noImgElement: SOT source cards render provider asset nodes directly.
                                <img
                                    className={
                                        SOURCE_REPORT_CARD_SOURCE_ICON_CLASS_NAME
                                    }
                                    src={sourceProviderIcon}
                                    alt=""
                                />
                            ) : (
                                <span
                                    className={
                                        SOURCE_REPORT_CARD_SOURCE_FALLBACK_CLASS_NAME
                                    }
                                    data-sot-part="source-report-card-source-fallback"
                                >
                                    {sourceProviderLetter}
                                </span>
                            )}
                            <span>{sourceProviderLabel}</span>
                        </SourceReportMetricCard>
                        <SourceReportMetricCard
                            label="转写状态"
                            metric="transcript-status"
                        >
                            <SourceReportStatusBadge
                                tone={sourceReportReadinessTone(
                                    sourceTranscriptStatusLabel,
                                )}
                            >
                                <SourceReportStatusDot />
                                {sourceTranscriptStatusLabel}
                            </SourceReportStatusBadge>
                        </SourceReportMetricCard>
                        <SourceReportMetricCard
                            label="摘要状态"
                            metric="summary-status"
                        >
                            <SourceReportStatusBadge
                                tone={sourceReportReadinessTone(
                                    sourceSummaryStatusLabel,
                                )}
                            >
                                <SourceReportStatusDot />
                                {sourceSummaryStatusLabel}
                            </SourceReportStatusBadge>
                        </SourceReportMetricCard>
                        <SourceReportMetricCard
                            label="分段数"
                            metric="segment-count"
                            value="number"
                        >
                            {sourceReportSegmentCount}
                        </SourceReportMetricCard>
                    </SourceReportMetricCards>

                    <SourceReportSection
                        section="transcript"
                        title="来源转写"
                        description={
                            <>
                                来自{sourceProviderSentenceName} ·{" "}
                                {sourceReportSegmentCount} 段 ·{" "}
                                {sourceReportDurationLabel} 总时长
                            </>
                        }
                    >
                        <ol
                            className={SOURCE_REPORT_SEGMENTS_CLASS_NAME}
                            data-sot-source-report-segments
                        >
                            {sourceReportDisplaySegments.map(
                                (segment, index) => {
                                    const timeRange = formatTranscriptTimeRange(
                                        segment.startMs,
                                        segment.endMs,
                                    );

                                    return (
                                        <li
                                            key={`${segment.startMs ?? "na"}-${segment.endMs ?? "na"}-${index}`}
                                            className={
                                                SOURCE_REPORT_SEGMENT_CLASS_NAME
                                            }
                                            data-sot-source-report-segment
                                        >
                                            <span
                                                className={
                                                    SOURCE_REPORT_SEGMENT_TIME_CLASS_NAME
                                                }
                                                data-sot-source-report-segment-time
                                                data-sot-format="mono"
                                            >
                                                {timeRange || "--"}
                                            </span>
                                            <span
                                                className={
                                                    SOURCE_REPORT_SEGMENT_SPEAKER_CLASS_NAME
                                                }
                                                data-sot-source-report-segment-speaker
                                            >
                                                {formatTranscriptSpeaker(
                                                    segment.speaker,
                                                    language,
                                                ) || `说话人 ${index + 1}`}
                                            </span>
                                            <p
                                                className={
                                                    SOURCE_REPORT_SEGMENT_TEXT_CLASS_NAME
                                                }
                                                data-sot-source-report-segment-text
                                            >
                                                {segment.text}
                                            </p>
                                        </li>
                                    );
                                },
                            )}
                        </ol>
                    </SourceReportSection>

                    {sourceSummaryVisible ? (
                        <SourceReportSection
                            section="summary"
                            title="来源原始报告"
                            description={
                                <>由{sourceProviderLabel}返回的只读摘要</>
                            }
                        >
                            <div
                                className={SOURCE_REPORT_SUMMARY_BODY_CLASS_NAME}
                                data-sot-source-report-summary-body
                            >
                                {sourceSummaryText
                                    .split("\n")
                                    .map((line, index) => (
                                        <p
                                            key={`${index}:${line}`}
                                            className={
                                                SOURCE_REPORT_SUMMARY_TEXT_CLASS_NAME
                                            }
                                            data-sot-source-report-segment-text
                                        >
                                            {line}
                                        </p>
                                    ))}
                            </div>
                        </SourceReportSection>
                    ) : null}

                    <SourceReportSection
                        section="metadata"
                        title="来源信息"
                        description={
                            <>由{sourceProviderLabel}返回的公开元数据</>
                        }
                    >
                        <dl
                            className={SOURCE_REPORT_META_CLASS_NAME}
                            data-sot-source-report-meta
                        >
                            <SourceReportMetaRow label="来源">
                                {sourceProviderLabel}
                            </SourceReportMetaRow>
                            <SourceReportMetaRow label="状态">
                                <SourceReportStatusBadge
                                    tone={sourceReportSyncTone(
                                        sourceReportStatusLabel,
                                    )}
                                >
                                    <SourceReportStatusDot />
                                    {sourceReportStatusLabel}
                                </SourceReportStatusBadge>
                            </SourceReportMetaRow>
                            <SourceReportMetaRow label="录制于">
                                <span
                                    className={
                                        SOURCE_REPORT_META_MONO_VALUE_CLASS_NAME
                                    }
                                    data-sot-source-report-meta-value
                                    data-sot-format="mono"
                                >
                                    {formatSotSourceReportDate(
                                        sourceReportRecordedAt,
                                    )}
                                </span>
                            </SourceReportMetaRow>
                            <SourceReportMetaRow label="最近更新">
                                <span
                                    className={
                                        SOURCE_REPORT_META_MONO_VALUE_CLASS_NAME
                                    }
                                    data-sot-source-report-meta-value
                                    data-sot-format="mono"
                                >
                                    {formatSotSourceReportDate(
                                        sourceReportUpdatedAt,
                                    )}
                                </span>
                            </SourceReportMetaRow>
                            <SourceReportMetaRow label="可读内容">
                                {sourceReportReadable}
                            </SourceReportMetaRow>
                            <SourceReportMetaRow label="来源标题">
                                {sourceReportTitle}
                            </SourceReportMetaRow>
                            <SourceReportMetaRow label="语种">
                                {sourceReportLanguage}
                            </SourceReportMetaRow>
                            <SourceReportMetaRow label="时长">
                                <span
                                    className={
                                        SOURCE_REPORT_META_MONO_VALUE_CLASS_NAME
                                    }
                                    data-sot-source-report-meta-value
                                    data-sot-format="mono"
                                >
                                    {sourceReportDurationLabel}
                                </span>
                            </SourceReportMetaRow>
                        </dl>
                        {sourceActionControls}
                    </SourceReportSection>
                </SourceReportState>
            )}

            {!data && !error && !isLoading && (
                <SourceReportState sotState="empty" state="empty">
                    <Empty
                        className="px-4 py-8"
                        data-sot-source-report-empty
                        data-sot-tone="neutral"
                    >
                        <EmptyHeader
                            className={SOURCE_REPORT_EMPTY_HEADER_CLASS_NAME}
                            data-sot-source-report-empty-header
                        >
                            <EmptyMedia
                                variant="icon"
                                data-sot-source-report-empty-icon
                            >
                                <SourceReportEmptyGlyph />
                            </EmptyMedia>
                            <EmptyTitle
                                className={SOURCE_REPORT_EMPTY_TITLE_CLASS_NAME}
                                data-sot-source-report-empty-title
                            >
                                这条录音没有关联来源
                            </EmptyTitle>
                            <EmptyDescription
                                className={
                                    SOURCE_REPORT_EMPTY_DESCRIPTION_CLASS_NAME
                                }
                                data-sot-source-report-empty-description
                            >
                                本地导入或离线录制的录音不会有来源详情。
                            </EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                </SourceReportState>
            )}
        </CardContent>
    );

    if (variant === "embedded") {
        return (
            <Card
                hasNoPadding
                className={cn(
                    "min-h-0 gap-3.5 overflow-hidden px-5 pt-4 pb-6",
                    className,
                )}
                data-sot-source-report-pane
                data-sot-panel="recording-source-report"
                data-sot-state={sourceReportState}
                data-sot-variant="embedded"
                style={SOURCE_REPORT_STYLE_VARIABLES}
            >
                {header}
                {content}
            </Card>
        );
    }

    return (
        <Card
            hasNoPadding
            className={cn(
                "min-h-0 gap-3.5 overflow-hidden px-5 pt-4 pb-6",
                className,
            )}
            data-sot-source-report-pane
            data-sot-panel="recording-source-report"
            data-sot-state={sourceReportState}
            data-sot-variant="card"
            style={SOURCE_REPORT_STYLE_VARIABLES}
        >
            {header}
            {content}
        </Card>
    );
}
