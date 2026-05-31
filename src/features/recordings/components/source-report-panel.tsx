"use client";

import { CloudDownload, Copy, FileText, LoaderCircle } from "lucide-react";
import type { ReactElement } from "react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    getSourceProviderLabel,
    getSourceRecordDescription,
    getSourceRecordEmptyHint,
    getSourceTabLabel,
} from "@/lib/data-sources/presentation";
import type { UiLanguage } from "@/lib/i18n";
import { writeBrowserClipboardText } from "@/lib/platform/clipboard";
import { cn } from "@/lib/utils";

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
    variant?: "card" | "embedded";
}

const SENSITIVE_SOURCE_DETAIL_FIELD_PATTERN =
    /auth|bearer|cookie|credential|header|key|password|payload|raw|request|response|secret|session|token/i;
const SAFE_SOURCE_DETAIL_KEYS = new Set([
    "provider",
    "status",
    "sections",
    "createdAt",
    "updatedAt",
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
    "sourceType",
    "speakerCount",
    "wordCount",
    "segmentCount",
    "summaryReady",
    "transcriptReady",
]);

function isZh(language: UiLanguage) {
    return language === "zh-CN";
}

function formatPublicDate(value: string, language: UiLanguage) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return new Intl.DateTimeFormat(language, {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date);
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

    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatTranscriptTimeRange(
    startMs: number | null,
    endMs: number | null,
) {
    const startLabel = formatTranscriptTimestamp(startMs);
    const endLabel = formatTranscriptTimestamp(endMs);

    if (startLabel && endLabel) {
        return `${startLabel} - ${endLabel}`;
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

function formatDetailLabel(key: string, language: UiLanguage) {
    const zhLabels: Record<string, string> = {
        provider: "来源",
        status: "状态",
        sections: "可用内容",
        language: "语言",
        createdAt: "创建时间",
        updatedAt: "更新时间",
        startedAt: "开始时间",
        endedAt: "结束时间",
    };
    const enLabels: Record<string, string> = {
        provider: "Source",
        status: "Status",
        sections: "Available content",
        language: "Language",
        createdAt: "Created",
        updatedAt: "Updated",
        startedAt: "Started",
        endedAt: "Ended",
    };
    const labels = isZh(language) ? zhLabels : enLabels;
    const knownLabel = labels[key];
    if (knownLabel) {
        return knownLabel;
    }

    return key
        .replace(/[_-]+/g, " ")
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^./, (first) => first.toUpperCase());
}

function isSafeSourceDetailField(key: string) {
    return (
        SAFE_SOURCE_DETAIL_KEYS.has(key) &&
        !SENSITIVE_SOURCE_DETAIL_FIELD_PATTERN.test(key)
    );
}

function formatDetailValue(
    key: string,
    value: unknown,
    language: UiLanguage,
    sourceProvider: string,
    t: (key: string) => string,
): string | null {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value === "string") {
        if (key === "provider") {
            return getSourceProviderLabel(value || sourceProvider, language);
        }

        if (key === "status") {
            return value === "available" ? t("sourceReport.ready") : value;
        }

        if (
            key === "createdAt" ||
            key === "updatedAt" ||
            key === "startedAt" ||
            key === "endedAt"
        ) {
            return formatPublicDate(value, language);
        }

        return value;
    }

    if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }

    if (Array.isArray(value)) {
        if (key === "sections") {
            const sectionLabels: Record<string, string> = {
                transcript: t("sourceReport.officialTranscript"),
                summary: t("sourceReport.officialReport"),
                detail: t("sourceReport.sourceDetails"),
            };
            return value
                .map((item) =>
                    typeof item === "string"
                        ? (sectionLabels[item] ?? item)
                        : null,
                )
                .filter((item): item is string => Boolean(item))
                .join("、");
        }

        const primitiveValues = value
            .map((item) =>
                formatDetailValue(key, item, language, sourceProvider, t),
            )
            .filter((item): item is string => Boolean(item));

        return primitiveValues.length === value.length
            ? primitiveValues.join(", ")
            : null;
    }

    return null;
}

function renderDetailEntries(
    detail: Record<string, unknown>,
    language: UiLanguage,
    sourceProvider: string,
    t: (key: string) => string,
) {
    return Object.entries(detail)
        .filter(([key]) => isSafeSourceDetailField(key))
        .map(([key, value]) => {
            const displayValue = formatDetailValue(
                key,
                value,
                language,
                sourceProvider,
                t,
            );

            if (displayValue !== null) {
                return (
                    <div
                        key={key}
                        className="grid gap-1 sm:grid-cols-3 sm:gap-3"
                    >
                        <dt className="text-muted-foreground">
                            {formatDetailLabel(key, language)}
                        </dt>
                        <dd className="sm:col-span-2">{displayValue}</dd>
                    </div>
                );
            }

            if (value && typeof value === "object") {
                const nestedEntries: Array<[string, string, unknown]> =
                    Array.isArray(value)
                        ? value.flatMap((item, index) =>
                              item && typeof item === "object"
                                  ? Object.entries(
                                        item as Record<string, unknown>,
                                    )
                                        .filter(([nestedKey]) =>
                                            isSafeSourceDetailField(nestedKey),
                                        )
                                        .map(
                                            ([nestedKey, nestedValue]): [
                                                string,
                                                string,
                                                unknown,
                                            ] => [
                                                nestedKey,
                                                `${index + 1}. ${formatDetailLabel(
                                                    nestedKey,
                                                    language,
                                                )}`,
                                                nestedValue,
                                            ],
                                        )
                                  : [],
                          )
                        : Object.entries(value as Record<string, unknown>)
                              .filter(([nestedKey]) =>
                                  isSafeSourceDetailField(nestedKey),
                              )
                              .map(([nestedKey, nestedValue]) => [
                                  nestedKey,
                                  formatDetailLabel(nestedKey, language),
                                  nestedValue,
                              ]);
                const renderedNestedEntries = nestedEntries
                    .map(([nestedKey, nestedLabel, nestedValue]) => {
                        const nestedDisplayValue = formatDetailValue(
                            nestedKey,
                            nestedValue,
                            language,
                            sourceProvider,
                            t,
                        );

                        if (nestedDisplayValue === null) {
                            return null;
                        }

                        return (
                            <div
                                key={`${key}-${nestedLabel}`}
                                className="grid gap-1 sm:grid-cols-3 sm:gap-3"
                            >
                                <dt className="text-muted-foreground">
                                    {nestedLabel}
                                </dt>
                                <dd className="sm:col-span-2">
                                    {nestedDisplayValue}
                                </dd>
                            </div>
                        );
                    })
                    .filter((entry): entry is ReactElement => entry !== null);

                if (renderedNestedEntries.length === 0) {
                    return null;
                }

                return (
                    <section key={key} className="space-y-2">
                        <h4 className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                            {formatDetailLabel(key, language)}
                        </h4>
                        <dl className="space-y-2 rounded-lg bg-muted/70 p-3">
                            {renderedNestedEntries}
                        </dl>
                    </section>
                );
            }

            return null;
        })
        .filter((entry): entry is ReactElement => entry !== null);
}

export function SourceReportPanel({
    autoLoad = false,
    className,
    hasAudio = true,
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

    const loadReport = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(
                `/api/recordings/${recordingId}/source-report`,
                { cache: "no-store" },
            );
            const payload = await response.json();
            if (!response.ok) {
                setError(payload.error ?? t("sourceReport.failedFetch"));
                return;
            }

            setData(payload);
        } catch {
            const nextError = t("sourceReport.failedFetch");
            setError(nextError);
            toast.error(nextError);
        } finally {
            setIsLoading(false);
        }
    }, [recordingId, t]);

    useEffect(() => {
        if (!recordingId || !sourceProvider) {
            return;
        }

        setData(null);
        setError(null);
        setIsLoading(false);
    }, [recordingId, sourceProvider]);

    useEffect(() => {
        if (!autoLoad) {
            return;
        }

        void loadReport();
    }, [autoLoad, loadReport]);

    const handleCopySourceTranscript = useCallback(async () => {
        const copyText = buildSourceTranscriptCopyText(
            data?.transcript ?? null,
            language,
        );
        if (!copyText.trim()) {
            toast.error(t("sourceReport.missingSourceTranscript"));
            return;
        }

        setCopyingKey("source-transcript");
        try {
            await writeBrowserClipboardText(copyText);
            toast.success(t("sourceReport.sourceTranscriptCopied"));
        } catch {
            toast.error(t("sourceReport.copyFailed"));
        } finally {
            setCopyingKey(null);
        }
    }, [data?.transcript, language, t]);

    const handleCopySourceReport = useCallback(async () => {
        const copyText = data?.summaryMarkdown ?? "";
        if (!copyText.trim()) {
            toast.error(t("sourceReport.missingSourceReport"));
            return;
        }

        setCopyingKey("source-report");
        try {
            await writeBrowserClipboardText(copyText);
            toast.success(t("sourceReport.sourceReportCopied"));
        } catch {
            toast.error(t("sourceReport.copyFailed"));
        } finally {
            setCopyingKey(null);
        }
    }, [data?.summaryMarkdown, t]);

    const detailEntries = data?.detail
        ? renderDetailEntries(data.detail, language, sourceProvider, t)
        : [];

    const header = (
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
                <CardTitle className="flex items-center gap-2">
                    <CloudDownload className="h-5 w-5" />
                    {getSourceTabLabel(sourceProvider, language)}
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                    {getSourceRecordDescription(sourceProvider, language)}
                </p>
            </div>
            <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={loadReport}
                disabled={isLoading}
                data-testid="source-report-header-load"
            >
                {isLoading ? (
                    <>
                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                        {t("sourceReport.loadingDetail")}
                    </>
                ) : (
                    <>
                        <CloudDownload className="mr-2 h-4 w-4" />
                        {data
                            ? t("sourceReport.refresh")
                            : t("sourceReport.loadDetail")}
                    </>
                )}
            </Button>
        </div>
    );

    const content = (
        <div className="space-y-4">
            {error && (
                <div
                    className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between"
                    data-source-report-state="error"
                    data-testid="source-report-error"
                >
                    <span>{error}</span>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={loadReport}
                        disabled={isLoading}
                        className="shrink-0"
                        data-testid="source-report-retry"
                    >
                        {t("sourceReport.refresh")}
                    </Button>
                </div>
            )}

            {isLoading && !data && !error ? (
                <div className="space-y-4" data-source-report-state="loading">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        {[0, 1, 2, 3].map((item) => (
                            <div
                                key={item}
                                className="rounded-xl border border-white/10 bg-background/25 px-4 py-3"
                            >
                                <div className="skeleton-shimmer h-3 w-20 rounded" />
                                <div className="skeleton-shimmer mt-3 h-5 w-28 rounded-md" />
                            </div>
                        ))}
                    </div>
                    <div className="rounded-xl border border-white/10 bg-background/25 p-4">
                        <div className="skeleton-shimmer h-4 w-32 rounded" />
                        <div className="mt-4 space-y-3 rounded-lg bg-muted p-4">
                            <div className="skeleton-shimmer h-3 w-11/12 rounded" />
                            <div className="skeleton-shimmer h-3 w-4/5 rounded" />
                            <div className="skeleton-shimmer h-3 w-2/3 rounded" />
                        </div>
                    </div>
                </div>
            ) : null}

            {data && (
                <div
                    className="space-y-4"
                    data-source-report-state={
                        data.transcriptReady || data.summaryReady
                            ? "loaded"
                            : "missing"
                    }
                    data-testid="source-report-loaded"
                >
                    {!hasAudio ? (
                        <div
                            className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-100"
                            data-testid="source-report-no-audio-warning"
                        >
                            {t("sourceReport.sourceOnlyNoAudio")}
                        </div>
                    ) : null}

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-xl border border-white/10 bg-background/25 px-4 py-3">
                            <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
                                {t("recording.source")}
                            </p>
                            <p className="mt-2 text-sm font-medium">
                                {getSourceProviderLabel(
                                    sourceProvider,
                                    language,
                                )}
                            </p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-background/25 px-4 py-3">
                            <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
                                {t("sourceReport.transcriptReady")}
                            </p>
                            <p
                                className={cn(
                                    "mt-2 inline-flex w-fit items-center rounded-full border px-2 py-1 text-xs font-semibold",
                                    data.transcriptReady
                                        ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
                                        : "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-200",
                                )}
                                data-testid="source-report-transcript-status"
                            >
                                {data.transcriptReady
                                    ? t("sourceReport.ready")
                                    : t("sourceReport.missing")}
                            </p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-background/25 px-4 py-3">
                            <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
                                {t("sourceReport.summaryReady")}
                            </p>
                            <p
                                className={cn(
                                    "mt-2 inline-flex w-fit items-center rounded-full border px-2 py-1 text-xs font-semibold",
                                    data.summaryReady
                                        ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
                                        : "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-200",
                                )}
                                data-testid="source-report-summary-status"
                            >
                                {data.summaryReady
                                    ? t("sourceReport.ready")
                                    : t("sourceReport.missing")}
                            </p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-background/25 px-4 py-3">
                            <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
                                {t("sourceReport.segments")}
                            </p>
                            <p className="mt-2 text-sm font-medium">
                                {data.transcript?.segmentCount ?? 0}
                            </p>
                        </div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-background/25 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <p className="text-sm font-medium">
                                {t("sourceReport.officialReport")}
                            </p>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={handleCopySourceReport}
                                disabled={
                                    copyingKey === "source-report" ||
                                    !data.summaryMarkdown?.trim()
                                }
                                data-testid="source-report-copy-report"
                                aria-busy={copyingKey === "source-report"}
                                className="shrink-0"
                            >
                                <Copy className="h-4 w-4" />
                                {copyingKey === "source-report"
                                    ? t("common.copying")
                                    : t("sourceReport.copySourceReport")}
                            </Button>
                        </div>
                        {data.summaryMarkdown ? (
                            <div className="mt-3 max-h-80 overflow-auto rounded-lg bg-muted p-4 text-sm whitespace-pre-wrap leading-relaxed">
                                {data.summaryMarkdown}
                            </div>
                        ) : (
                            <div
                                className="mt-3 rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground"
                                data-testid="source-report-missing-report"
                            >
                                {t("sourceReport.missingSourceReport")}
                            </div>
                        )}
                    </div>

                    <div className="rounded-xl border border-white/10 bg-background/25 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <p className="flex items-center gap-2 text-sm font-medium">
                                <FileText className="h-4 w-4" />
                                {t("sourceReport.officialTranscript")}
                            </p>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={handleCopySourceTranscript}
                                disabled={
                                    copyingKey === "source-transcript" ||
                                    !buildSourceTranscriptCopyText(
                                        data.transcript,
                                        language,
                                    ).trim()
                                }
                                data-testid="source-report-copy-transcript"
                                aria-busy={copyingKey === "source-transcript"}
                                className="shrink-0"
                            >
                                <Copy className="h-4 w-4" />
                                {copyingKey === "source-transcript"
                                    ? t("common.copying")
                                    : t("sourceReport.copySourceTranscript")}
                            </Button>
                        </div>
                        {data.transcript?.text &&
                        data.transcript.segments.length > 0 ? (
                            <div className="mt-3 max-h-80 space-y-3 overflow-auto rounded-lg bg-muted p-3 text-sm">
                                {data.transcript.segments.map(
                                    (segment, index) => {
                                        const timeRange =
                                            formatTranscriptTimeRange(
                                                segment.startMs,
                                                segment.endMs,
                                            );

                                        return (
                                            <article
                                                key={`${segment.startMs ?? "na"}-${index}`}
                                                className="rounded-lg bg-background/45 px-3 py-2"
                                            >
                                                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                                                    {timeRange ? (
                                                        <span
                                                            className="rounded-md border border-white/10 bg-background/60 px-2 py-1 font-mono text-muted-foreground"
                                                            data-testid="source-report-segment-timestamp"
                                                        >
                                                            {timeRange}
                                                        </span>
                                                    ) : null}
                                                    <span className="font-medium text-muted-foreground">
                                                        {formatTranscriptSpeaker(
                                                            segment.speaker,
                                                            language,
                                                        )}
                                                    </span>
                                                </div>
                                                <p className="whitespace-pre-wrap leading-relaxed">
                                                    {segment.text}
                                                </p>
                                            </article>
                                        );
                                    },
                                )}
                            </div>
                        ) : data.transcript?.text ? (
                            <div className="mt-3 max-h-80 overflow-auto rounded-lg bg-muted p-4 text-sm whitespace-pre-wrap leading-relaxed">
                                {formatTranscriptText(
                                    data.transcript.text,
                                    language,
                                )}
                            </div>
                        ) : (
                            <div
                                className="mt-3 rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground"
                                data-testid="source-report-missing-transcript"
                            >
                                {t("sourceReport.missingSourceTranscript")}
                            </div>
                        )}
                    </div>

                    {data.detail && detailEntries.length > 0 ? (
                        <div className="rounded-xl border border-white/10 bg-background/25 p-4">
                            <p className="text-sm font-medium">
                                {t("sourceReport.sourceDetails")}
                            </p>
                            <dl className="mt-3 max-h-80 space-y-3 overflow-auto rounded-lg bg-muted p-4 text-xs leading-relaxed">
                                {detailEntries}
                            </dl>
                        </div>
                    ) : null}
                </div>
            )}

            {!data && !error && !isLoading && (
                <div
                    className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground"
                    data-source-report-state="empty"
                >
                    <CloudDownload className="mx-auto mb-3 h-9 w-9 text-muted-foreground/70" />
                    <p>{getSourceRecordEmptyHint(sourceProvider, language)}</p>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={loadReport}
                        className="mt-4"
                        data-testid="source-report-empty-load"
                    >
                        {t("sourceReport.loadDetail")}
                    </Button>
                </div>
            )}
        </div>
    );

    if (variant === "embedded") {
        return (
            <div
                className={cn(
                    "rounded-xl border border-white/10 bg-background/25 p-4",
                    className,
                )}
            >
                {header}
                <div className="mt-4">{content}</div>
            </div>
        );
    }

    return (
        <Card className={className}>
            <CardHeader>{header}</CardHeader>
            <CardContent>{content}</CardContent>
        </Card>
    );
}
