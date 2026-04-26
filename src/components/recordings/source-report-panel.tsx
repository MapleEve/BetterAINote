"use client";

import { CloudDownload, FileText, LoaderCircle } from "lucide-react";
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
    variant?: "card" | "embedded";
}

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

function formatDetailLabel(key: string, language: UiLanguage) {
    const zhLabels: Record<string, string> = {
        provider: "来源",
        status: "状态",
        sections: "可用内容",
        language: "语言",
        createdAt: "创建时间",
        updatedAt: "更新时间",
    };
    const enLabels: Record<string, string> = {
        provider: "Source",
        status: "Status",
        sections: "Available content",
        language: "Language",
        createdAt: "Created",
        updatedAt: "Updated",
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

        if (key === "createdAt" || key === "updatedAt") {
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
    return Object.entries(detail).map(([key, value]) => {
        const displayValue = formatDetailValue(
            key,
            value,
            language,
            sourceProvider,
            t,
        );

        if (displayValue !== null) {
            return (
                <div key={key} className="grid gap-1 sm:grid-cols-3 sm:gap-3">
                    <dt className="text-muted-foreground">
                        {formatDetailLabel(key, language)}
                    </dt>
                    <dd className="sm:col-span-2">{displayValue}</dd>
                </div>
            );
        }

        if (value && typeof value === "object") {
            const nestedEntries: Array<[string, unknown]> = Array.isArray(value)
                ? value.flatMap((item, index) =>
                      item && typeof item === "object"
                          ? Object.entries(item as Record<string, unknown>).map(
                                ([nestedKey, nestedValue]): [
                                    string,
                                    unknown,
                                ] => [
                                    `${index + 1}. ${formatDetailLabel(
                                        nestedKey,
                                        language,
                                    )}`,
                                    nestedValue,
                                ],
                            )
                          : [],
                  )
                : Object.entries(value as Record<string, unknown>).map(
                      ([nestedKey, nestedValue]) => [
                          formatDetailLabel(nestedKey, language),
                          nestedValue,
                      ],
                  );

            return (
                <section key={key} className="space-y-2">
                    <h4 className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                        {formatDetailLabel(key, language)}
                    </h4>
                    <dl className="space-y-2 rounded-lg bg-muted/70 p-3">
                        {nestedEntries.map(([nestedLabel, nestedValue]) => {
                            const nestedDisplayValue = formatDetailValue(
                                key,
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
                        })}
                    </dl>
                </section>
            );
        }

        return null;
    });
}

export function SourceReportPanel({
    autoLoad = false,
    className,
    recordingId,
    sourceProvider,
    variant = "card",
}: SourceReportPanelProps) {
    const { language, t } = useLanguage();
    const [isLoading, setIsLoading] = useState(false);
    const [data, setData] = useState<SourceReportData | null>(null);
    const [error, setError] = useState<string | null>(null);

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
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                    {error}
                </div>
            )}

            {data && (
                <>
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
                            <p className="mt-2 text-sm font-medium">
                                {data.transcriptReady
                                    ? t("sourceReport.ready")
                                    : t("sourceReport.missing")}
                            </p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-background/25 px-4 py-3">
                            <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
                                {t("sourceReport.summaryReady")}
                            </p>
                            <p className="mt-2 text-sm font-medium">
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

                    {data.summaryMarkdown ? (
                        <div className="rounded-xl border border-white/10 bg-background/25 p-4">
                            <p className="text-sm font-medium">
                                {t("sourceReport.officialReport")}
                            </p>
                            <pre className="mt-3 max-h-80 overflow-auto rounded-lg bg-muted p-4 text-sm whitespace-pre-wrap leading-relaxed">
                                {data.summaryMarkdown}
                            </pre>
                        </div>
                    ) : null}

                    {data.transcript?.text ? (
                        <div className="rounded-xl border border-white/10 bg-background/25 p-4">
                            <p className="flex items-center gap-2 text-sm font-medium">
                                <FileText className="h-4 w-4" />
                                {t("sourceReport.officialTranscript")}
                            </p>
                            {data.transcript.segments.length > 0 ? (
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
                                                            <span className="rounded-md border border-white/10 bg-background/60 px-2 py-1 font-mono text-muted-foreground">
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
                            ) : (
                                <div className="mt-3 max-h-80 overflow-auto rounded-lg bg-muted p-4 text-sm whitespace-pre-wrap leading-relaxed">
                                    {formatTranscriptText(
                                        data.transcript.text,
                                        language,
                                    )}
                                </div>
                            )}
                        </div>
                    ) : null}

                    {data.detail ? (
                        <div className="rounded-xl border border-white/10 bg-background/25 p-4">
                            <p className="text-sm font-medium">
                                {t("sourceReport.sourceDetails")}
                            </p>
                            <dl className="mt-3 max-h-80 space-y-3 overflow-auto rounded-lg bg-muted p-4 text-xs leading-relaxed">
                                {renderDetailEntries(
                                    data.detail,
                                    language,
                                    sourceProvider,
                                    t,
                                )}
                            </dl>
                        </div>
                    ) : null}
                </>
            )}

            {!data && !error && !isLoading && (
                <div className="text-sm text-muted-foreground">
                    {getSourceRecordEmptyHint(sourceProvider, language)}
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
