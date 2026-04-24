"use client";

import { CloudDownload, FileText, LoaderCircle } from "lucide-react";
import { useCallback, useState } from "react";
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

interface SourceReportData {
    sourceProvider: string;
    filename: string;
    transcriptReady: boolean;
    summaryReady: boolean;
    transcript: {
        text: string;
        segmentCount: number;
    } | null;
    summaryMarkdown: string | null;
    detail: Record<string, unknown> | null;
}

interface SourceReportPanelProps {
    recordingId: string;
    sourceProvider: string;
}

function formatDetailLabel(key: string) {
    return key
        .replace(/[_-]+/g, " ")
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^./, (first) => first.toUpperCase());
}

function formatDetailValue(value: unknown): string | null {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value === "string") {
        return value;
    }

    if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }

    if (Array.isArray(value)) {
        const primitiveValues = value
            .map(formatDetailValue)
            .filter((item): item is string => Boolean(item));

        return primitiveValues.length === value.length
            ? primitiveValues.join(", ")
            : null;
    }

    return null;
}

function renderDetailEntries(detail: Record<string, unknown>) {
    return Object.entries(detail).map(([key, value]) => {
        const displayValue = formatDetailValue(value);

        if (displayValue !== null) {
            return (
                <div key={key} className="grid gap-1 sm:grid-cols-3 sm:gap-3">
                    <dt className="text-muted-foreground">
                        {formatDetailLabel(key)}
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
                                    )}`,
                                    nestedValue,
                                ],
                            )
                          : [],
                  )
                : Object.entries(value as Record<string, unknown>).map(
                      ([nestedKey, nestedValue]) => [
                          formatDetailLabel(nestedKey),
                          nestedValue,
                      ],
                  );

            return (
                <section key={key} className="space-y-2">
                    <h4 className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                        {formatDetailLabel(key)}
                    </h4>
                    <dl className="space-y-2 rounded-lg bg-muted/70 p-3">
                        {nestedEntries.map(([nestedLabel, nestedValue]) => {
                            const nestedDisplayValue =
                                formatDetailValue(nestedValue);

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
    recordingId,
    sourceProvider,
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

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <CloudDownload className="h-5 w-5" />
                            {getSourceTabLabel(sourceProvider, language)}
                        </CardTitle>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {getSourceRecordDescription(
                                sourceProvider,
                                language,
                            )}
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
            </CardHeader>
            <CardContent className="space-y-4">
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
                                <div className="mt-3 max-h-80 overflow-auto rounded-lg bg-muted p-4 text-sm whitespace-pre-wrap leading-relaxed">
                                    {data.transcript.text}
                                </div>
                            </div>
                        ) : null}

                        {data.detail ? (
                            <div className="rounded-xl border border-white/10 bg-background/25 p-4">
                                <p className="text-sm font-medium">
                                    {t("sourceReport.sourceDetails")}
                                </p>
                                <dl className="mt-3 max-h-80 space-y-3 overflow-auto rounded-lg bg-muted p-4 text-xs leading-relaxed">
                                    {renderDetailEntries(data.detail)}
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
            </CardContent>
        </Card>
    );
}
