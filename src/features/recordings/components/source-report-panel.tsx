"use client";

import { CloudDownload } from "lucide-react";
import {
    type ReactNode,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";
import { toast } from "sonner";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import {
    getSourceProviderLabel,
    getSourceRecordDescription,
    getSourceTabLabel,
} from "@/lib/data-sources/presentation";
import type { UiLanguage } from "@/lib/i18n";
import { writeBrowserClipboardText } from "@/lib/platform/clipboard";
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

function sourceReportReadinessPillClass(label: string) {
    const normalized = label.toLowerCase();
    if (label === "已就绪" || normalized === "ready") return "sr-pill ok";
    if (label === "失败" || normalized.includes("failed")) {
        return "sr-pill err";
    }
    if (
        label === "生成中" ||
        label === "未生成" ||
        normalized.includes("loading") ||
        normalized.includes("missing")
    ) {
        return "sr-pill warn";
    }
    return "sr-pill";
}

function sourceReportSyncPillClass(label: string) {
    const normalized = label.toLowerCase();
    if (label.includes("失败") || normalized.includes("fail")) {
        return "sr-pill err";
    }
    if (
        label.includes("待") ||
        label.includes("仅") ||
        label.includes("生成中") ||
        normalized.includes("pending")
    ) {
        return "sr-pill warn";
    }
    if (
        label.includes("已") ||
        label.includes("同步") ||
        normalized.includes("available") ||
        normalized.includes("synced")
    ) {
        return "sr-pill ok";
    }
    return "sr-pill";
}

function formatSourceReportStatusLabel(
    value: string | null,
    language: UiLanguage,
) {
    if (!value) return isZh(language) ? "已同步" : "synced";
    if (value === "available") return isZh(language) ? "已同步" : "synced";
    return value;
}

function SotCopyIcon() {
    return (
        <span className="copy-ico" aria-hidden="true">
            <svg
                className="copy-ico-default"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                focusable="false"
            >
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            <svg
                className="copy-ico-ok"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                focusable="false"
            >
                <path d="M20 6 9 17l-5-5" />
            </svg>
        </span>
    );
}

function SotSourceReportErrorIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5" />
            <circle cx="12" cy="16" r=".8" fill="currentColor" />
        </svg>
    );
}

function SotSourceReportEmptyIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <rect x="3" y="6" width="18" height="14" rx="2" />
            <path d="M8 6V4h8v2" />
        </svg>
    );
}

function SourceReportStatusBadge({
    children,
    className,
}: {
    children: ReactNode;
    className: string;
}) {
    return (
        <span className={className}>
            {children}
        </span>
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
        <div className="sr-meta-row">
            <dt>{label}</dt>
            <dd>{children}</dd>
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
        sourceSummaryText && sourceSummaryHasDisplayHeading(sourceReportCopyText);
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
        <div className="sr-actions" data-sot-panel="source-actions">
            <button
                className="btn ghost btn-sm"
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
            </button>
            <button
                className="btn ghost btn-sm"
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
            </button>
        </div>
    ) : null;

    const header = (
        <div className="sr-section-head">
            <div>
                <h3 className="rec-h2">
                    <CloudDownload />
                    {getSourceTabLabel(sourceProvider, language)}
                </h3>
                <p className="sr-section-sub">
                    {getSourceRecordDescription(sourceProvider, language)}
                </p>
            </div>
            <div className="t-actions">
                {data ? (
                    <>
                        <button
                            className="btn ghost btn-sm copy-btn"
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
                            <SotCopyIcon />
                            <span className="copy-label">
                                {copyFeedback?.action === "source-transcript"
                                    ? copyFeedback.state === "ok"
                                        ? t("common.copied")
                                        : t("common.copyFailedShort")
                                    : t("sourceReport.copySourceTranscript")}
                            </span>
                        </button>
                        <button
                            className="btn ghost btn-sm copy-btn"
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
                            <SotCopyIcon />
                            <span className="copy-label">
                                {copyFeedback?.action === "source-report"
                                    ? copyFeedback.state === "ok"
                                        ? t("common.copied")
                                        : t("common.copyFailedShort")
                                    : t("sourceReport.copySourceReport")}
                            </span>
                        </button>
                    </>
                ) : null}
                <Button
                    type="button"
                    size="sm"
                    onClick={loadReport}
                    disabled={isLoading}
                    data-sot-control="refresh-source-report"
                    data-sot-state={sourceReportState}
                >
                    {isLoading ? (
                        <>
                            <span className="btn-spinner" aria-hidden="true" />
                            {t("sourceReport.loadingDetail")}
                        </>
                    ) : (
                        <>
                            <CloudDownload />
                            {data
                                ? t("sourceReport.refresh")
                                : t("sourceReport.loadDetail")}
                        </>
                    )}
                </Button>
            </div>
        </div>
    );

    const content = (
        <div className="sr-state">
            {error && (
                <div
                    className="sr-state"
                    data-sot-panel="recording-source-report-state"
                    data-sot-state="error"
                    data-state="error"
                    data-sot-error={error}
                >
                    <div className="sr-empty err">
                        <div className="sr-empty-ico" aria-hidden="true">
                            <SotSourceReportErrorIcon />
                        </div>
                        <div className="sr-empty-title">无法读取来源详情</div>
                        <div className="sr-empty-sub">
                            {sourceProviderSentenceName}
                            返回了一个错误，可能是网络抖动或来源临时不可用。
                        </div>
                        <div className="sr-empty-actions">
                            <Button
                                type="button"
                                size="sm"
                                variant="primary"
                                onClick={loadReport}
                                disabled={isLoading}
                                data-sot-control="refresh-source-report"
                                data-sot-state="error"
                            >
                                重试
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                    window.location.assign(
                                        "/dashboard#activity",
                                    );
                                }}
                            >
                                查看同步日志
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {isLoading && !data && !error ? (
                <div
                    className="sr-state"
                    data-sot-panel="recording-source-report-state"
                    data-sot-state="loading"
                    data-state="loading"
                >
                    <div className="sr-cards">
                        <div className="sr-card">
                            <div className="sr-card-label">来源</div>
                            <div className="sk _is-10" />
                        </div>
                        <div className="sr-card">
                            <div className="sr-card-label">转写状态</div>
                            <div className="sk _is-11" />
                        </div>
                        <div className="sr-card">
                            <div className="sr-card-label">摘要状态</div>
                            <div className="sk _is-11" />
                        </div>
                        <div className="sr-card">
                            <div className="sr-card-label">分段数</div>
                            <div className="sk _is-12" />
                        </div>
                    </div>
                    <section className="sr-section">
                        <header className="sr-section-head">
                            <h4>来源转写</h4>
                            <span className="sr-section-sub">
                                正在从{sourceProviderSentenceName}读取…
                            </span>
                        </header>
                        <div className="sr-seg skel">
                            <span className="sk _is-13" />{" "}
                            <span className="sk _is-14" />
                            <div className="sk _is-15" />
                            <div className="sk _is-16" />
                        </div>
                        <div className="sr-seg skel">
                            <span className="sk _is-13" />{" "}
                            <span className="sk _is-14" />
                            <div className="sk _is-17" />
                            <div className="sk _is-18" />
                        </div>
                    </section>
                </div>
            ) : null}

            {data && (
                <div
                    className="sr-state"
                    data-sot-panel="recording-source-report-state"
                    data-sot-state={sourceReportState}
                    data-state="loaded"
                    data-sub-state={sourceReportSubState}
                >
                    {!hasAudio ? (
                        <span className="sr-pill warn">
                            <span className="dot" />
                            <span>{t("sourceReport.sourceOnlyNoAudio")}</span>
                        </span>
                    ) : null}

                    <div className="sr-cards">
                        <div className="sr-card">
                            <div className="sr-card-label">来源</div>
                            <div className="sr-card-value sr-card-source">
                                {sourceProviderIcon ? (
                                    // biome-ignore lint/performance/noImgElement: SOT source cards render provider asset nodes directly.
                                    <img src={sourceProviderIcon} alt="" />
                                ) : (
                                    <span className="_is-47">
                                        {sourceProviderLetter}
                                    </span>
                                )}
                                <span>{sourceProviderLabel}</span>
                            </div>
                        </div>
                        <div className="sr-card">
                            <div className="sr-card-label">转写状态</div>
                            <div className="sr-card-value">
                                <SourceReportStatusBadge
                                    className={sourceReportReadinessPillClass(
                                        sourceTranscriptStatusLabel,
                                    )}
                                >
                                    <span className="dot" />
                                    {sourceTranscriptStatusLabel}
                                </SourceReportStatusBadge>
                            </div>
                        </div>
                        <div className="sr-card">
                            <div className="sr-card-label">摘要状态</div>
                            <div className="sr-card-value">
                                <SourceReportStatusBadge
                                    className={sourceReportReadinessPillClass(
                                        sourceSummaryStatusLabel,
                                    )}
                                >
                                    <span className="dot" />
                                    {sourceSummaryStatusLabel}
                                </SourceReportStatusBadge>
                            </div>
                        </div>
                        <div className="sr-card">
                            <div className="sr-card-label">分段数</div>
                            <div className="sr-card-value sr-card-num mono">
                                {sourceReportSegmentCount}
                            </div>
                        </div>
                    </div>

                    <section className="sr-section">
                        <header className="sr-section-head">
                            <h4>来源转写</h4>
                            <span className="sr-section-sub">
                                来自{sourceProviderSentenceName} ·{" "}
                                {sourceReportSegmentCount} 段 ·{" "}
                                {sourceReportDurationLabel} 总时长
                            </span>
                        </header>
                        <ol className="sr-segments">
                            {sourceReportDisplaySegments.map(
                                (segment, index) => {
                                    const timeRange = formatTranscriptTimeRange(
                                        segment.startMs,
                                        segment.endMs,
                                    );

                                    return (
                                        <li
                                            key={`${segment.startMs ?? "na"}-${segment.endMs ?? "na"}-${index}`}
                                            className="sr-seg"
                                        >
                                            <span className="sr-seg-ts mono">
                                                {timeRange || "--"}
                                            </span>
                                            <span className="sr-seg-speaker">
                                                {formatTranscriptSpeaker(
                                                    segment.speaker,
                                                    language,
                                                ) || `说话人 ${index + 1}`}
                                            </span>
                                            <p className="sr-seg-text">
                                                {segment.text}
                                            </p>
                                        </li>
                                    );
                                },
                            )}
                        </ol>
                    </section>

                    {sourceSummaryVisible ? (
                        <section className="sr-section sr-summary-section">
                            <header className="sr-section-head">
                                <h4>来源原始报告</h4>
                                <span className="sr-section-sub">
                                    由{sourceProviderLabel}返回的只读摘要
                                </span>
                            </header>
                            <div className="sr-summary-body">
                                {sourceSummaryText
                                    .split("\n")
                                    .map((line, index) => (
                                        <p
                                            className="sr-seg-text"
                                            key={`${index}:${line}`}
                                        >
                                            {line}
                                        </p>
                                    ))}
                            </div>
                        </section>
                    ) : null}

                    <section className="sr-section">
                        <header className="sr-section-head">
                            <h4>来源信息</h4>
                            <span className="sr-section-sub">
                                由{sourceProviderLabel}返回的公开元数据
                            </span>
                        </header>
                        <dl className="sr-meta">
                            <SourceReportMetaRow label="来源">
                                {sourceProviderLabel}
                            </SourceReportMetaRow>
                            <SourceReportMetaRow label="状态">
                                <SourceReportStatusBadge
                                    className={sourceReportSyncPillClass(
                                        sourceReportStatusLabel,
                                    )}
                                >
                                    <span className="dot" />
                                    {sourceReportStatusLabel}
                                </SourceReportStatusBadge>
                            </SourceReportMetaRow>
                            <SourceReportMetaRow label="录制于">
                                <span className="mono">
                                    {formatSotSourceReportDate(
                                        sourceReportRecordedAt,
                                    )}
                                </span>
                            </SourceReportMetaRow>
                            <SourceReportMetaRow label="最近更新">
                                <span className="mono">
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
                                <span className="mono">
                                    {sourceReportDurationLabel}
                                </span>
                            </SourceReportMetaRow>
                        </dl>
                        {sourceActionControls}
                    </section>
                </div>
            )}

            {!data && !error && !isLoading && (
                <div
                    className="sr-state"
                    data-sot-panel="recording-source-report-state"
                    data-sot-state="empty"
                    data-state="empty"
                >
                    <div className="sr-empty">
                        <div className="sr-empty-ico" aria-hidden="true">
                            <SotSourceReportEmptyIcon />
                        </div>
                        <div className="sr-empty-title">
                            这条录音没有关联来源
                        </div>
                        <div className="sr-empty-sub">
                            本地导入或离线录制的录音不会有来源详情。
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    if (variant === "embedded") {
        return (
            <div
                className={className ? `sr-pane ${className}` : "sr-pane"}
                data-sot-panel="recording-source-report"
                data-sot-state={sourceReportState}
            >
                {header}
                {content}
            </div>
        );
    }

    return (
        <div
            className={
                className ? `panel sr-pane ${className}` : "panel sr-pane"
            }
            data-sot-panel="recording-source-report"
            data-sot-state={sourceReportState}
        >
            {header}
            {content}
        </div>
    );
}
