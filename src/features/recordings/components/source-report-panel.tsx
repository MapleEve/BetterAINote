"use client";

import {
    Briefcase,
    Check,
    CircleAlert,
    CloudDownload,
    Copy,
} from "lucide-react";
import Image from "next/image";
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
import { Button } from "@/components/ui/button";
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
import { Spinner } from "@/components/ui/spinner";
import {
    getSourceProviderLabel,
    getSourceRecordDescription,
    getSourceTabLabel,
} from "@/lib/data-sources/presentation";
import type { UiLanguage } from "@/lib/i18n";
import { writeBrowserClipboardText } from "@/lib/platform/clipboard";
import { cn } from "@/lib/utils";
import { runDataSourcesSync } from "@/services/data-sources";

type SourceReportTone = "err" | "neu" | "ok" | "warn";

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
}

export interface SourceReportAvailabilitySnapshot {
    state: "idle" | "loading" | "loaded" | "missing" | "error" | "empty";
    transcriptAvailable: boolean;
    reportAvailable: boolean;
}

function RecordingSourceReportState({
    children,
    className,
    error,
    state,
    subState,
}: {
    children: ReactNode;
    className?: string;
    error?: string | null;
    state: "empty" | "error" | "loaded" | "loading";
    subState?: string;
}) {
    return (
        <div
            className={cn("block min-w-0", className)}
            data-control="source-report-state"
            data-testid="recording-source-report-state"
            data-state={state}
            data-sub-state={subState}
            data-error={error || undefined}
            aria-live={state === "error" ? "assertive" : "polite"}
        >
            {children}
        </div>
    );
}

type RecordingSourceReportMetric =
    | "segment-count"
    | "source"
    | "summary-status"
    | "transcript-status";

type RecordingSourceReportMetricValue = "number" | "skeleton" | "source";

function RecordingSourceReportMetricCard({
    children,
    label,
    metric,
    value,
}: {
    children: ReactNode;
    label: string;
    metric: RecordingSourceReportMetric;
    value?: RecordingSourceReportMetricValue;
}) {
    const loading = value === "skeleton";

    return (
        <Card
            hasNoPadding
            className={cn(
                "min-w-0 gap-1.5 overflow-hidden rounded-lg border-border bg-muted/40 px-3 py-2.5 shadow-none",
                loading ? "h-[3.8125rem]" : "h-[4.09375rem]",
            )}
            data-testid={`source-report-metric-${metric}`}
            data-state={value}
        >
            <CardHeader className="gap-0 p-0">
                <CardDescription className="text-xs font-semibold uppercase">
                    {label}
                </CardDescription>
            </CardHeader>
            <CardContent
                className={cn("min-w-0 p-0", loading && "leading-none")}
            >
                {loading ? (
                    children
                ) : (
                    <CardTitle
                        className={cn(
                            "min-w-0 break-words",
                            value !== "number" && "leading-[normal]!",
                            value === "source" &&
                                "flex items-center gap-1.5 text-sm",
                            value === "number" &&
                                "leading-[normal] font-mono text-base!",
                            value == null && "text-sm",
                        )}
                    >
                        {children}
                    </CardTitle>
                )}
            </CardContent>
        </Card>
    );
}

function RecordingSourceReportCardSkeleton({
    size,
}: {
    size: "count" | "source" | "status";
}) {
    return (
        <Skeleton
            variant="shimmer"
            size="default"
            className={cn(
                "inline-block h-[1.125rem] rounded-[0.375rem] align-middle",
                size === "count" && "w-12",
                size === "source" && "w-[7.5rem]",
                size === "status" && "w-20",
            )}
            aria-hidden="true"
            data-testid="source-report-card-skeleton"
            data-state={size}
        />
    );
}

function RecordingSourceReportSection({
    children,
    description,
    loading = false,
    noticeBefore,
    section,
    title,
}: {
    children: ReactNode;
    description: ReactNode;
    loading?: boolean;
    noticeBefore?: ReactNode;
    section: "metadata" | "summary" | "transcript";
    title: string;
}) {
    return (
        <section
            className="min-w-0 space-y-2 pt-0"
            data-testid={`source-report-section-${section}`}
        >
            <Separator />
            {noticeBefore}
            <header className="flex min-w-0 flex-row items-baseline gap-2.5">
                <h4
                    className={cn(
                        "m-0 shrink-0 text-[0.78125rem]! leading-[normal]! font-semibold",
                        loading ? "text-foreground" : "text-foreground",
                    )}
                    data-testid="source-report-section-title"
                >
                    {title}
                </h4>
                <span
                    className={cn(
                        "min-w-0 break-words text-[0.71875rem] leading-[normal] font-medium",
                        "text-muted-foreground",
                    )}
                >
                    {description}
                </span>
            </header>
            {children}
        </section>
    );
}

function RecordingSourceReportMissingNotice({
    children,
    state,
}: {
    children: ReactNode;
    state: "summary-missing" | "transcript-missing";
}) {
    return (
        <Alert
            className={cn(
                "rounded-lg py-2.5",
                state === "summary-missing" ? "mb-4!" : "mt-2",
            )}
            data-testid={`source-report-missing-${state}`}
            data-state={state}
            density="compact"
            layout="inline"
            variant="warningSoft"
        >
            <AlertDescription
                className="text-[0.78125rem] leading-[1.55]"
                density="compact"
            >
                {children}
            </AlertDescription>
        </Alert>
    );
}

function RecordingSourceReportSegmentSkeleton({
    size,
}: {
    size:
        | "line-long"
        | "line-medium"
        | "line-short"
        | "line-wide"
        | "speaker"
        | "time";
}) {
    return (
        <Skeleton
            variant="shimmer"
            size="default"
            className={cn(
                "inline-block h-3 rounded-[0.25rem] align-middle",
                size.startsWith("line-") && "mt-1.5 h-[0.8125rem]",
                size === "line-long" && "w-[92%]",
                size === "line-medium" && "w-[76%]",
                size === "line-short" && "w-[60%]",
                size === "line-wide" && "w-[88%]",
                size === "speaker" && "ml-[0.3125rem] w-[3.375rem]",
                size === "time" && "w-24",
            )}
            aria-hidden="true"
            data-testid="source-report-segment-skeleton"
            data-state={size}
        />
    );
}

function RecordingSourceReportMetaList({
    children,
    subState,
}: {
    children: ReactNode;
    subState: string;
}) {
    return (
        <dl
            className="mt-[1.4375rem]! mb-3 grid min-w-0 grid-cols-1 gap-x-[0.875rem] gap-y-1.5 xl:grid-cols-2"
            data-testid="source-report-meta"
            data-state={subState}
        >
            {children}
        </dl>
    );
}

function RecordingSourceReportMetaRow({
    children,
    index,
    label,
    valueFormat,
}: {
    children: ReactNode;
    index: number;
    label: string;
    valueFormat?: "mono";
}) {
    return (
        <div
            className={cn(
                "grid min-w-0 grid-cols-[5rem_minmax(0,1fr)] gap-1 border-b border-dashed border-border py-1.5 sm:items-baseline sm:gap-2",
                index >= 2 && "h-[1.875rem]",
                index === 0 && "max-[639px]:h-[1.875rem]",
            )}
            data-testid="source-report-meta-row"
        >
            <dt className="m-0 text-xs leading-normal font-semibold text-muted-foreground">
                {label}
            </dt>
            <dd
                className={cn(
                    "col-span-1! m-0 min-w-0 break-words! text-xs leading-normal font-medium text-foreground",
                    valueFormat === "mono" && "font-mono",
                )}
            >
                {children}
            </dd>
        </div>
    );
}

function RecordingSourceReportSummaryBody({
    children,
}: {
    children: ReactNode;
}) {
    return (
        <div
            className="flex min-w-0 flex-col gap-1.5"
            data-testid="source-report-summary"
        >
            {children}
        </div>
    );
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

function formatSourceReportDate(value: string | null | undefined) {
    if (!value) return "--";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatSourceReportDuration(valueMs: number | null | undefined) {
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

function RecordingSourceReportCompactStatusBadge({
    children,
    sync = false,
    tone,
}: {
    children: ReactNode;
    sync?: boolean;
    tone: SourceReportTone;
}) {
    const variant =
        tone === "err"
            ? "destructive"
            : tone === "ok"
              ? "default"
              : tone === "warn"
                ? "outline"
                : "secondary";

    return (
        <Badge
            variant={variant}
            className={cn(
                "max-w-full gap-1 text-xs",
                sync && "border-border bg-secondary text-secondary-foreground",
            )}
            data-testid="source-report-status"
            data-state={tone}
        >
            <span
                className="size-[0.3125rem]! shrink-0 rounded-full bg-current"
                aria-hidden="true"
            />
            <span className="min-w-0 break-words whitespace-normal">
                {children}
            </span>
        </Badge>
    );
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

export function SourceReportPanel({
    autoLoad = false,
    className,
    hasAudio = true,
    onAvailabilityChange,
    recordingId,
    sourceProvider,
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
        setData(null);
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
                setData(null);
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
            setData(null);
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
    const sourceSummaryVisible = Boolean(sourceSummaryText);
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
    const sourceReportDurationLabel = formatSourceReportDuration(
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
            className="relative top-px mt-[1.625rem]! flex flex-wrap items-center gap-2"
            data-testid="source-report-actions"
        >
            <Button
                variant="ghost"
                size="xs"
                className="text-xs"
                type="button"
                disabled={!openSourceUrl}
                title={
                    openSourceUrl
                        ? undefined
                        : t("sourceReport.openSourceUnavailable")
                }
                data-testid="source-report-open-source"
                data-state={openSourceControlState}
                onClick={handleOpenSourceRecord}
            >
                {getOpenSourceLabel(sourceProviderForReport, language)}
            </Button>
            <Button
                variant="ghost"
                size="xs"
                className="text-xs"
                type="button"
                disabled={repullDisabled}
                aria-busy={repullState === "loading"}
                title={
                    repullAvailable
                        ? undefined
                        : t("sourceReport.repullUnavailable")
                }
                data-testid="source-report-repull"
                data-state={repullControlState}
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
            data-testid="source-report-header"
        >
            <div
                className="flex min-w-0 flex-col gap-1"
                data-testid="source-report-heading"
            >
                <CardTitle
                    className="inline-flex min-w-0 items-center gap-1.5"
                    data-testid="source-report-title"
                >
                    <CloudDownload
                        data-icon="inline-start"
                        aria-hidden="true"
                    />
                    {getSourceTabLabel(sourceProvider, language)}
                </CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                    {getSourceRecordDescription(sourceProvider, language)}
                </CardDescription>
            </div>
            <CardAction
                className="static col-auto row-auto flex max-w-full flex-wrap items-center justify-end gap-2 self-auto justify-self-auto sm:ml-auto"
                data-testid="source-report-header-actions"
            >
                {data ? (
                    <>
                        <Button
                            type="button"
                            variant={
                                copyFeedback?.action === "source-transcript"
                                    ? copyFeedback.state === "ok"
                                        ? "secondary"
                                        : "destructive"
                                    : "ghost"
                            }
                            size="xs"
                            data-control="copy-source-transcript"
                            data-testid="source-report-copy-source-transcript"
                            data-state={sourceTranscriptCopyState}
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
                            {copyFeedback?.action === "source-transcript" &&
                            copyFeedback.state === "ok" ? (
                                <Check aria-hidden="true" />
                            ) : (
                                <Copy aria-hidden="true" />
                            )}
                            {copyFeedback?.action === "source-transcript"
                                ? copyFeedback.state === "ok"
                                    ? t("common.copied")
                                    : t("common.copyFailedShort")
                                : t("sourceReport.copySourceTranscript")}
                        </Button>
                        <Button
                            type="button"
                            variant={
                                copyFeedback?.action === "source-report"
                                    ? copyFeedback.state === "ok"
                                        ? "secondary"
                                        : "destructive"
                                    : "ghost"
                            }
                            size="xs"
                            data-control="copy-source-report"
                            data-testid="source-report-copy-source-report"
                            data-state={sourceReportCopyState}
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
                            {copyFeedback?.action === "source-report" &&
                            copyFeedback.state === "ok" ? (
                                <Check aria-hidden="true" />
                            ) : (
                                <Copy aria-hidden="true" />
                            )}
                            {copyFeedback?.action === "source-report"
                                ? copyFeedback.state === "ok"
                                    ? t("common.copied")
                                    : t("common.copyFailedShort")
                                : t("sourceReport.copySourceReport")}
                        </Button>
                    </>
                ) : null}
                <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    data-control="source-report-refresh"
                    onClick={loadReport}
                    disabled={isLoading}
                    data-testid="source-report-refresh"
                    data-state={sourceReportState}
                >
                    {isLoading ? (
                        <>
                            <Spinner
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
        <div
            className="flex min-w-0 flex-col gap-4"
            data-control="source-report-content"
        >
            {error && (
                <RecordingSourceReportState state="error" error={error}>
                    <Alert
                        variant="statusError"
                        density="spacious"
                        layout="centered"
                        className="gap-1 border-dashed"
                        data-testid="source-report-empty-surface"
                        data-state="danger"
                    >
                        <EmptyMedia
                            variant="dangerIcon"
                            className="mb-1"
                            data-testid="source-report-empty-icon"
                            data-state="danger"
                            aria-hidden="true"
                        >
                            <CircleAlert
                                className="size-4 scale-90"
                                aria-hidden="true"
                            />
                        </EmptyMedia>
                        <AlertTitle
                            className="min-h-0 text-sm font-semibold"
                            data-testid="source-report-empty-title"
                        >
                            无法读取来源详情
                        </AlertTitle>
                        <AlertDescription
                            density="comfortable"
                            className="max-w-sm break-words text-xs font-medium"
                            data-testid="source-report-empty-description"
                        >
                            {sourceProviderSentenceName}
                            返回了一个错误，可能是网络抖动或来源临时不可用。
                        </AlertDescription>
                        <div
                            className="mt-2 flex flex-wrap items-center justify-center gap-1.5"
                            data-testid="source-report-empty-actions"
                        >
                            <Button
                                variant="default"
                                size="xs"
                                className="text-xs"
                                type="button"
                                data-control="source-report-retry"
                                onClick={loadReport}
                                disabled={isLoading}
                                data-testid="source-report-refresh"
                                data-state="error"
                            >
                                重试
                            </Button>
                            <Button
                                variant="ghost"
                                size="xs"
                                className="text-xs"
                                type="button"
                                data-testid="source-report-activity-log"
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
                </RecordingSourceReportState>
            )}

            {isLoading && !data && !error ? (
                <RecordingSourceReportState state="loading">
                    <div className="min-w-0">
                        <div
                            className="grid min-w-0 grid-cols-2 gap-2 xl:grid-cols-[9.125rem_repeat(3,minmax(0,1fr))]"
                            data-testid="source-report-metrics"
                        >
                            <RecordingSourceReportMetricCard
                                label="来源"
                                metric="source"
                                value="skeleton"
                            >
                                <RecordingSourceReportCardSkeleton size="source" />
                            </RecordingSourceReportMetricCard>
                            <RecordingSourceReportMetricCard
                                label="转写状态"
                                metric="transcript-status"
                                value="skeleton"
                            >
                                <RecordingSourceReportCardSkeleton size="status" />
                            </RecordingSourceReportMetricCard>
                            <RecordingSourceReportMetricCard
                                label="摘要状态"
                                metric="summary-status"
                                value="skeleton"
                            >
                                <RecordingSourceReportCardSkeleton size="status" />
                            </RecordingSourceReportMetricCard>
                            <RecordingSourceReportMetricCard
                                label="分段数"
                                metric="segment-count"
                                value="skeleton"
                            >
                                <RecordingSourceReportCardSkeleton size="count" />
                            </RecordingSourceReportMetricCard>
                        </div>
                        <RecordingSourceReportSection
                            loading
                            section="transcript"
                            title="来源转写"
                            description={
                                <>正在从{sourceProviderSentenceName}读取…</>
                            }
                        >
                            <div className="flex min-w-0 flex-col gap-2 rounded-md border border-border bg-muted/30 p-3">
                                <RecordingSourceReportSegmentSkeleton size="time" />
                                <RecordingSourceReportSegmentSkeleton size="speaker" />
                                <RecordingSourceReportSegmentSkeleton size="line-long" />
                                <RecordingSourceReportSegmentSkeleton size="line-medium" />
                            </div>
                            <div className="flex min-w-0 flex-col gap-2 rounded-md border border-border bg-muted/30 p-3">
                                <RecordingSourceReportSegmentSkeleton size="time" />
                                <RecordingSourceReportSegmentSkeleton size="speaker" />
                                <RecordingSourceReportSegmentSkeleton size="line-wide" />
                                <RecordingSourceReportSegmentSkeleton size="line-short" />
                            </div>
                        </RecordingSourceReportSection>
                    </div>
                </RecordingSourceReportState>
            ) : null}

            {data && (
                <RecordingSourceReportState
                    state="loaded"
                    subState={sourceReportSubState}
                    className={
                        sourceReportSubState === "both-missing"
                            ? "pb-[0.09375rem]"
                            : "pb-[0.03125rem]"
                    }
                >
                    {!hasAudio ? (
                        <RecordingSourceReportCompactStatusBadge tone="warn">
                            <span>{t("sourceReport.sourceOnlyNoAudio")}</span>
                        </RecordingSourceReportCompactStatusBadge>
                    ) : null}

                    <div
                        className="grid min-w-0 grid-cols-2 gap-2 xl:grid-cols-4"
                        data-testid="source-report-metrics"
                    >
                        <RecordingSourceReportMetricCard
                            label="来源"
                            metric="source"
                            value="source"
                        >
                            <span className="flex min-w-0 items-center gap-2 text-sm">
                                {sourceProviderIcon ? (
                                    <Image
                                        alt=""
                                        className="size-5 rounded object-cover"
                                        height={20}
                                        src={sourceProviderIcon}
                                        width={20}
                                    />
                                ) : (
                                    <span
                                        aria-hidden="true"
                                        className="flex size-5 items-center justify-center rounded bg-muted text-xs font-semibold"
                                    >
                                        {sourceProviderLetter}
                                    </span>
                                )}
                                <span className="min-w-0 break-words">
                                    {sourceProviderLabel}
                                </span>
                            </span>
                        </RecordingSourceReportMetricCard>
                        <RecordingSourceReportMetricCard
                            label="转写状态"
                            metric="transcript-status"
                        >
                            <RecordingSourceReportCompactStatusBadge
                                tone={sourceReportReadinessTone(
                                    sourceTranscriptStatusLabel,
                                )}
                            >
                                {sourceTranscriptStatusLabel}
                            </RecordingSourceReportCompactStatusBadge>
                        </RecordingSourceReportMetricCard>
                        <RecordingSourceReportMetricCard
                            label="摘要状态"
                            metric="summary-status"
                        >
                            <RecordingSourceReportCompactStatusBadge
                                tone={sourceReportReadinessTone(
                                    sourceSummaryStatusLabel,
                                )}
                            >
                                {sourceSummaryStatusLabel}
                            </RecordingSourceReportCompactStatusBadge>
                        </RecordingSourceReportMetricCard>
                        <RecordingSourceReportMetricCard
                            label="分段数"
                            metric="segment-count"
                            value="number"
                        >
                            {sourceReportSegmentCount}
                        </RecordingSourceReportMetricCard>
                    </div>

                    <RecordingSourceReportSection
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
                        {!transcriptAvailable ? (
                            <RecordingSourceReportMissingNotice state="transcript-missing">
                                来源未提供逐字稿。可以稍后再来，或运行私有转写。
                            </RecordingSourceReportMissingNotice>
                        ) : null}
                        <ol
                            className="min-w-0 divide-y divide-border rounded-md border border-border"
                            data-testid="source-report-segments"
                            hidden={!transcriptAvailable}
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
                                            className="grid min-w-0 grid-cols-[6rem_3.5rem_minmax(0,1fr)] items-start gap-2.5 rounded-md px-2.5 py-2"
                                            data-testid="source-report-segment"
                                        >
                                            <span className="min-w-0 break-words font-mono text-[0.71875rem] leading-[normal] font-medium text-muted-foreground">
                                                {timeRange || "--"}
                                            </span>
                                            <span className="min-w-0 break-words text-xs font-semibold text-muted-foreground">
                                                {formatTranscriptSpeaker(
                                                    segment.speaker,
                                                    language,
                                                ) || `说话人 ${index + 1}`}
                                            </span>
                                            <p className="m-0 min-w-0 break-words text-pretty text-[0.78125rem]! leading-[1.55]! font-medium text-foreground!">
                                                {segment.text}
                                            </p>
                                        </li>
                                    );
                                },
                            )}
                        </ol>
                    </RecordingSourceReportSection>

                    <RecordingSourceReportSection
                        section="metadata"
                        title="来源信息"
                        description={
                            <>由{sourceProviderLabel}返回的公开元数据</>
                        }
                        noticeBefore={
                            !reportAvailable ? (
                                <RecordingSourceReportMissingNotice state="summary-missing">
                                    来源未提供官方摘要。
                                </RecordingSourceReportMissingNotice>
                            ) : null
                        }
                    >
                        <RecordingSourceReportMetaList
                            subState={sourceReportSubState}
                        >
                            <RecordingSourceReportMetaRow
                                index={0}
                                label="来源"
                            >
                                {sourceProviderLabel}
                            </RecordingSourceReportMetaRow>
                            <RecordingSourceReportMetaRow
                                index={1}
                                label="状态"
                            >
                                <RecordingSourceReportCompactStatusBadge
                                    sync
                                    tone={sourceReportSyncTone(
                                        sourceReportStatusLabel,
                                    )}
                                >
                                    {sourceReportStatusLabel}
                                </RecordingSourceReportCompactStatusBadge>
                            </RecordingSourceReportMetaRow>
                            <RecordingSourceReportMetaRow
                                index={2}
                                label="录制于"
                                valueFormat="mono"
                            >
                                {formatSourceReportDate(sourceReportRecordedAt)}
                            </RecordingSourceReportMetaRow>
                            <RecordingSourceReportMetaRow
                                index={3}
                                label="最近更新"
                                valueFormat="mono"
                            >
                                {formatSourceReportDate(sourceReportUpdatedAt)}
                            </RecordingSourceReportMetaRow>
                            <RecordingSourceReportMetaRow
                                index={4}
                                label="可读内容"
                            >
                                {sourceReportReadable}
                            </RecordingSourceReportMetaRow>
                            <RecordingSourceReportMetaRow
                                index={5}
                                label="来源标题"
                            >
                                {sourceReportTitle}
                            </RecordingSourceReportMetaRow>
                            <RecordingSourceReportMetaRow
                                index={6}
                                label="语种"
                            >
                                {sourceReportLanguage}
                            </RecordingSourceReportMetaRow>
                            <RecordingSourceReportMetaRow
                                index={7}
                                label="时长"
                                valueFormat="mono"
                            >
                                {sourceReportDurationLabel}
                            </RecordingSourceReportMetaRow>
                        </RecordingSourceReportMetaList>
                        {sourceActionControls}
                    </RecordingSourceReportSection>
                </RecordingSourceReportState>
            )}

            {!data && !error && !isLoading && (
                <RecordingSourceReportState state="empty">
                    <Empty
                        variant="subtle"
                        className="gap-1"
                        data-testid="source-report-empty-surface"
                        data-state="neutral"
                    >
                        <EmptyHeader className="gap-1">
                            <EmptyMedia
                                variant="subtleIcon"
                                className="mb-1"
                                data-testid="source-report-empty-icon"
                                data-state="neutral"
                                aria-hidden="true"
                            >
                                <Briefcase
                                    className="size-4"
                                    strokeWidth={1.8}
                                    aria-hidden="true"
                                />
                            </EmptyMedia>
                            <EmptyTitle
                                variant="compact"
                                className="mb-0 text-sm font-semibold"
                                data-testid="source-report-empty-title"
                            >
                                这条录音没有关联来源
                            </EmptyTitle>
                            <EmptyDescription
                                variant="compact"
                                className="text-xs font-medium"
                                data-testid="source-report-empty-description"
                            >
                                本地导入或离线录制的录音不会有来源详情。
                            </EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                </RecordingSourceReportState>
            )}
        </div>
    );

    return (
        <Card
            hasNoPadding
            className={cn("min-h-0 gap-4 p-4 shadow-none", className)}
            data-control="recording-source-report"
            data-testid="recording-source-report"
            data-state={sourceReportState}
            aria-busy={sourceReportState === "loading"}
        >
            {header}
            {sourceSummaryVisible ? (
                <RecordingSourceReportSection
                    section="summary"
                    title="来源原始报告"
                    description={<>由{sourceProviderLabel}返回的只读摘要</>}
                >
                    <RecordingSourceReportSummaryBody>
                        {sourceSummaryText.split("\n").map((line, index) => (
                            <p
                                className="m-0 min-w-0 whitespace-pre-wrap break-words text-[0.78125rem] leading-[1.55] font-medium text-foreground"
                                key={`${index}:${line}`}
                            >
                                {line}
                            </p>
                        ))}
                    </RecordingSourceReportSummaryBody>
                </RecordingSourceReportSection>
            ) : null}
            {content}
        </Card>
    );
}
