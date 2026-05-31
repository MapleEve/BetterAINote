"use client";

import {
    ArrowLeft,
    CalendarDays,
    CheckCircle,
    Clock3,
    CloudOff,
    Copy,
    Database,
    HardDrive,
    Pencil,
    Sparkles,
    X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { SystemBanner } from "@/features/dashboard/components/system-banner";
import { AiRenamePreviewCard } from "@/features/recordings/components/ai-rename-preview-card";
import { RecordingPlayer } from "@/features/recordings/components/recording-player";
import { RecordingTagManager } from "@/features/recordings/components/recording-tag-manager";
import { SourceReportPanel } from "@/features/recordings/components/source-report-panel";
import { SpeakerLabelEditor } from "@/features/recordings/components/speaker-label-editor";
import { TranscriptionSection } from "@/features/recordings/components/transcription-section";
import { useTitleGenerationSettingsStore } from "@/features/settings/title-generation-settings-store";
import { canRecordingSyncTitleUpstream } from "@/lib/data-sources/catalog";
import {
    canRecordingPrivateTranscribe,
    canRecordingRename,
    getPrivateTranscriptionUnavailableMessage,
    getRecordingRenameActionKey,
    getSourceProviderLabel,
    getSourceTabLabel,
} from "@/lib/data-sources/presentation";
import { formatDateTime } from "@/lib/format-date";
import {
    navigateBrowserRoute,
    useBrowserRouteController,
} from "@/lib/platform/browser-router";
import { writeBrowserClipboardText } from "@/lib/platform/clipboard";
import type { RecordingTag } from "@/lib/recording-tags";
import type { Recording } from "@/types/recording";

interface Transcription {
    text?: string;
    detectedLanguage?: string;
    transcriptionType?: string;
    speakerMap?: Record<string, string> | null;
}

interface TranscriptionJob {
    status: string;
    remoteStatus?: string | null;
    lastError?: string | null;
}

interface RecordingWorkstationProps {
    recording: Recording;
    transcription?: Transcription;
    transcriptionJob?: TranscriptionJob;
}

interface SourceReportCopyPayload {
    transcript?: {
        text?: string | null;
        segments?: Array<{
            speaker?: string | null;
            startMs?: number | null;
            endMs?: number | null;
            text?: string | null;
        }>;
    } | null;
    summaryMarkdown?: string | null;
    error?: string;
}

function formatCopyTimestamp(valueMs: number | null | undefined) {
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

function applySpeakerMap(
    text: string,
    speakerMap: Record<string, string> | null | undefined,
) {
    if (!speakerMap || Object.keys(speakerMap).length === 0) {
        return text;
    }

    let result = text;
    const entries = Object.entries(speakerMap).sort(
        ([a], [b]) => b.length - a.length,
    );

    for (const [label, name] of entries) {
        if (!name.trim()) continue;
        const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        result = result.replace(new RegExp(escaped, "gi"), name);
    }

    return result;
}

function buildSourceTranscriptCopyText(payload: SourceReportCopyPayload) {
    const transcript = payload.transcript;
    if (!transcript) {
        return "";
    }

    const segments = transcript.segments ?? [];
    if (segments.length === 0) {
        return transcript.text ?? "";
    }

    return segments
        .map((segment) => {
            const start = formatCopyTimestamp(segment.startMs);
            const end = formatCopyTimestamp(segment.endMs);
            const timeRange =
                start && end ? `${start} - ${end}` : (start ?? end);
            const heading = [timeRange, segment.speaker]
                .filter(Boolean)
                .join(" · ");

            return heading
                ? `${heading}\n${segment.text ?? ""}`.trim()
                : (segment.text ?? "");
        })
        .filter((segment) => segment.trim())
        .join("\n\n");
}

export function RecordingWorkstation({
    recording,
    transcription,
    transcriptionJob,
}: RecordingWorkstationProps) {
    const { language, t } = useLanguage();
    const router = useBrowserRouteController();
    const { settings: titleGenerationSettings } =
        useTitleGenerationSettingsStore();
    const [filename, setFilename] = useState(recording.filename);
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState(recording.filename);
    const [isSavingRename, setIsSavingRename] = useState(false);
    const [isAutoRenaming, setIsAutoRenaming] = useState(false);
    const [isApplyingAutoRename, setIsApplyingAutoRename] = useState(false);
    const [autoRenamePreview, setAutoRenamePreview] = useState<string | null>(
        null,
    );
    const [autoRenameError, setAutoRenameError] = useState<string | null>(null);
    const [activeTranscriptTab, setActiveTranscriptTab] = useState<
        "source" | "local" | "speakers"
    >("source");
    const [copyingAction, setCopyingAction] = useState<
        "local" | "source-transcript" | "source-report" | null
    >(null);
    const [liveSpeakerMap, setLiveSpeakerMap] = useState(
        transcription?.speakerMap ?? null,
    );
    const localTranscriptCopyText = useMemo(
        () => applySpeakerMap(transcription?.text ?? "", liveSpeakerMap),
        [liveSpeakerMap, transcription?.text],
    );
    const [tagCatalog, setTagCatalog] = useState<RecordingTag[]>(
        recording.tags,
    );
    const [recordingTags, setRecordingTags] = useState<RecordingTag[]>(
        recording.tags,
    );
    const [tagManagerOpen, setTagManagerOpen] = useState(false);
    const previousRecordingIdRef = useRef(recording.id);
    const canRenameRecording = canRecordingRename(recording.sourceProvider);
    const renameActionLabel = t(
        getRecordingRenameActionKey(recording.sourceProvider),
    );
    const canPrivateTranscribe = canRecordingPrivateTranscribe({
        sourceProvider: recording.sourceProvider,
        hasAudio: recording.hasAudio,
    });
    const hasLocalTranscriptContent = Boolean(
        transcription?.text || transcriptionJob,
    );
    const titleGenerationProviderConfigured = Boolean(
        titleGenerationSettings.titleGenerationApiKeySet &&
            titleGenerationSettings.titleGenerationModel?.trim(),
    );
    const autoRenameDisabledReason = !titleGenerationProviderConfigured
        ? t("transcription.aiRenameConfigureFirst")
        : !transcription?.text?.trim()
          ? t("transcription.aiRenameNeedsTranscript")
          : !canRenameRecording
            ? renameActionLabel
            : null;
    const canAutoRenameRecording = Boolean(
        canRenameRecording &&
            transcription?.text?.trim() &&
            titleGenerationProviderConfigured &&
            !isSavingRename &&
            !isAutoRenaming &&
            !isApplyingAutoRename,
    );
    const autoRenamePreviewMessage = canRecordingSyncTitleUpstream(
        recording.sourceProvider,
    )
        ? t("transcription.aiRenameWritebackHint")
        : t("transcription.aiRenameLocalOnlyHint");
    const showLocalTranscriptTab =
        !recording.sourceProvider ||
        canPrivateTranscribe ||
        hasLocalTranscriptContent;
    const transcriptionUnavailableReason =
        getPrivateTranscriptionUnavailableMessage(
            recording.sourceProvider,
            recording.hasAudio,
            language,
        );

    useEffect(() => {
        if (previousRecordingIdRef.current !== recording.id) {
            previousRecordingIdRef.current = recording.id;
            setActiveTranscriptTab("source");
            setFilename(recording.filename);
            setRenameValue(recording.filename);
            setAutoRenamePreview(null);
            setAutoRenameError(null);
            setRecordingTags(recording.tags);
            setTagManagerOpen(false);
        }
    }, [recording.filename, recording.id, recording.tags]);

    useEffect(() => {
        setRecordingTags(recording.tags);
        setTagCatalog((previous) => {
            const tagsById = new Map(previous.map((tag) => [tag.id, tag]));
            for (const tag of recording.tags) {
                tagsById.set(tag.id, tag);
            }
            return Array.from(tagsById.values()).sort((a, b) =>
                a.name.localeCompare(b.name),
            );
        });
    }, [recording.tags]);

    useEffect(() => {
        if (!showLocalTranscriptTab && activeTranscriptTab === "local") {
            setActiveTranscriptTab("source");
        }
    }, [activeTranscriptTab, showLocalTranscriptTab]);

    useEffect(() => {
        setLiveSpeakerMap(transcription?.speakerMap ?? null);
    }, [transcription?.speakerMap]);

    useEffect(() => {
        let cancelled = false;

        const loadTags = async () => {
            try {
                const response = await fetch("/api/recording-tags", {
                    cache: "no-store",
                });
                if (!response.ok) {
                    return;
                }
                const data = await response.json();
                if (!cancelled && Array.isArray(data.tags)) {
                    setTagCatalog(data.tags);
                }
            } catch {
                // The current recording still carries assigned tags if the catalog load fails.
            }
        };

        void loadTags();

        return () => {
            cancelled = true;
        };
    }, []);

    const taggedRecording = {
        ...recording,
        tags: recordingTags,
    };

    const applyRecordingTags = useCallback(
        (recordingId: string, tags: RecordingTag[]) => {
            if (recordingId === recording.id) {
                setRecordingTags(tags);
            }
        },
        [recording.id],
    );

    const handleRenameStart = useCallback(() => {
        if (!canRenameRecording) {
            return;
        }
        setRenameValue(filename);
        setIsRenaming(true);
    }, [canRenameRecording, filename]);

    const handleRenameCancel = useCallback(() => {
        setIsRenaming(false);
        setRenameValue(filename);
    }, [filename]);

    const handleRenameSave = useCallback(async () => {
        const newName = renameValue.trim();
        if (!newName || newName === filename) {
            handleRenameCancel();
            return;
        }

        setIsSavingRename(true);
        try {
            const response = await fetch(
                `/api/recordings/${recording.id}/rename`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ filename: newName }),
                },
            );

            if (!response.ok) {
                const error = await response.json();
                toast.error(error.error || t("recording.renameFailed"));
                return;
            }

            setFilename(newName);
            setIsRenaming(false);
            toast.success(t("recording.recordingRenamed"));
        } catch {
            toast.error(t("recording.renameFailed"));
        } finally {
            setIsSavingRename(false);
        }
    }, [filename, handleRenameCancel, recording.id, renameValue, t]);

    const handleAutoRename = useCallback(async () => {
        if (!canAutoRenameRecording) {
            if (autoRenameDisabledReason) {
                toast.error(autoRenameDisabledReason);
            }
            return;
        }

        setAutoRenameError(null);
        setIsAutoRenaming(true);
        try {
            const response = await fetch(
                `/api/recordings/${recording.id}/rename/auto`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ mode: "preview" }),
                },
            );
            const data = await response.json();
            if (!response.ok) {
                const message =
                    data.error || t("transcription.autoRenameFailed");
                setAutoRenameError(message);
                toast.error(message);
                return;
            }

            if (typeof data.filename === "string" && data.filename.trim()) {
                setAutoRenamePreview(data.filename);
                setAutoRenameError(null);
                toast.success(t("transcription.aiRenamePreviewReady"));
            }
        } catch {
            const message = t("transcription.autoRenameFailed");
            setAutoRenameError(message);
            toast.error(message);
        } finally {
            setIsAutoRenaming(false);
        }
    }, [autoRenameDisabledReason, canAutoRenameRecording, recording.id, t]);

    const handleAutoRenamePreviewCancel = useCallback(() => {
        setAutoRenamePreview(null);
        setAutoRenameError(null);
    }, []);

    const handleAutoRenamePreviewApply = useCallback(async () => {
        const nextFilename = autoRenamePreview?.trim();
        if (!nextFilename) {
            return;
        }

        setIsApplyingAutoRename(true);
        try {
            const response = await fetch(
                `/api/recordings/${recording.id}/rename`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ filename: nextFilename }),
                },
            );

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                toast.error(error.error || t("transcription.autoRenameFailed"));
                return;
            }

            setFilename(nextFilename);
            setRenameValue(nextFilename);
            setAutoRenamePreview(null);
            setAutoRenameError(null);
            toast.success(
                t("transcription.autoRenameSuccess", {
                    filename: nextFilename,
                }),
            );
        } catch {
            toast.error(t("transcription.autoRenameFailed"));
        } finally {
            setIsApplyingAutoRename(false);
        }
    }, [autoRenamePreview, recording.id, t]);

    const handleCopyLocalTranscript = useCallback(async () => {
        const copyText = localTranscriptCopyText;
        if (!copyText.trim()) {
            toast.error(t("transcription.noTranscript"));
            return;
        }

        setCopyingAction("local");
        try {
            await writeBrowserClipboardText(copyText);
            toast.success(t("transcription.transcriptCopied"));
        } catch {
            toast.error(t("transcription.copyTranscriptFailed"));
        } finally {
            setCopyingAction(null);
        }
    }, [localTranscriptCopyText, t]);

    const handleCopySourceMaterial = useCallback(
        async (kind: "source-transcript" | "source-report") => {
            if (!recording.sourceProvider) {
                toast.error(t("sourceReport.missingSourceTranscript"));
                return;
            }

            setCopyingAction(kind);
            try {
                const response = await fetch(
                    `/api/recordings/${recording.id}/source-report`,
                    { cache: "no-store" },
                );
                const payload =
                    (await response.json()) as SourceReportCopyPayload;

                if (!response.ok) {
                    toast.error(payload.error ?? t("sourceReport.copyFailed"));
                    return;
                }

                const copyText =
                    kind === "source-transcript"
                        ? buildSourceTranscriptCopyText(payload)
                        : (payload.summaryMarkdown ?? "");

                if (!copyText.trim()) {
                    toast.error(
                        kind === "source-transcript"
                            ? t("sourceReport.missingSourceTranscript")
                            : t("sourceReport.missingSourceReport"),
                    );
                    return;
                }

                await writeBrowserClipboardText(copyText);
                toast.success(
                    kind === "source-transcript"
                        ? t("sourceReport.sourceTranscriptCopied")
                        : t("sourceReport.sourceReportCopied"),
                );
            } catch {
                toast.error(t("sourceReport.copyFailed"));
            } finally {
                setCopyingAction(null);
            }
        },
        [recording.id, recording.sourceProvider, t],
    );

    const durationLabel = `${Math.floor(recording.duration / 60000)}:${(
        (recording.duration % 60000) /
        1000
    )
        .toFixed(0)
        .padStart(2, "0")}`;
    const fileSizeLabel = `${(recording.filesize / (1024 * 1024)).toFixed(2)} MB`;
    const startTimeLabel = formatDateTime(
        recording.startTime,
        "absolute",
        language,
    );
    const sourceLabel = getSourceProviderLabel(
        recording.sourceProvider,
        language,
    );

    return (
        <div
            className="dashboard-workstation flex min-h-svh flex-col overflow-hidden px-3 py-3 sm:px-4 sm:py-4"
            data-testid="recording-detail-workstation"
        >
            <div className="mx-auto flex min-h-0 w-full max-w-[1280px] flex-1 flex-col gap-4">
                <header className="glass-surface relative z-[210] flex min-h-14 items-center gap-3 overflow-visible rounded-2xl px-3 py-2">
                    <Button
                        onClick={() =>
                            navigateBrowserRoute(router, "/dashboard")
                        }
                        variant="outline"
                        size="icon"
                        aria-label={t("recording.backToDashboard")}
                        className="h-10 w-10 shrink-0 rounded-xl"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>

                    <div className="min-w-0 flex-1">
                        {isRenaming ? (
                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                                <Input
                                    value={renameValue}
                                    onChange={(event) =>
                                        setRenameValue(event.target.value)
                                    }
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                            handleRenameSave();
                                        }
                                        if (event.key === "Escape") {
                                            handleRenameCancel();
                                        }
                                    }}
                                    className="h-10 min-w-0 flex-1 rounded-xl py-1 text-base font-semibold sm:text-lg"
                                    autoFocus
                                    disabled={isSavingRename}
                                    data-testid="recording-rename-input"
                                />
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleAutoRename}
                                    disabled={!canAutoRenameRecording}
                                    data-testid="recording-ai-rename"
                                    title={
                                        autoRenameDisabledReason ??
                                        t("transcription.aiRename")
                                    }
                                    className="h-10 shrink-0 rounded-xl border-border/60 bg-background/30 px-3 text-xs shadow-none backdrop-blur-xl hover:bg-background/50"
                                >
                                    <Sparkles
                                        className={
                                            isAutoRenaming
                                                ? "h-4 w-4 animate-pulse"
                                                : "h-4 w-4"
                                        }
                                    />
                                    <span className="hidden sm:inline">
                                        {t("transcription.aiRename")}
                                    </span>
                                </Button>
                                <Button
                                    size="icon"
                                    variant="outline"
                                    onClick={handleRenameSave}
                                    disabled={isSavingRename}
                                    aria-busy={isSavingRename}
                                    aria-label={t("recording.saveRename")}
                                    className="h-10 w-10 shrink-0 rounded-xl border-emerald-500/30 bg-emerald-500/10 text-emerald-700 shadow-none hover:bg-emerald-500/15 dark:text-emerald-200"
                                    data-testid="recording-rename-save"
                                >
                                    <CheckCircle className="h-5 w-5" />
                                </Button>
                                <Button
                                    size="icon"
                                    variant="outline"
                                    onClick={handleRenameCancel}
                                    disabled={isSavingRename}
                                    aria-label={t("recording.cancelRename")}
                                    className="h-10 w-10 shrink-0 rounded-xl border-border/60 bg-background/30 shadow-none backdrop-blur-xl hover:bg-background/50"
                                    data-testid="recording-rename-cancel"
                                >
                                    <X className="h-5 w-5" />
                                </Button>
                            </div>
                        ) : (
                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                                <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">
                                    {filename}
                                </h1>
                                {recording.upstreamDeleted && (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-700 dark:text-amber-200">
                                        <CloudOff className="h-3 w-3" />
                                        {t("recording.localOnly")}
                                    </span>
                                )}
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleAutoRename}
                                    disabled={!canAutoRenameRecording}
                                    aria-busy={isAutoRenaming}
                                    data-testid="recording-ai-rename"
                                    title={
                                        autoRenameDisabledReason ??
                                        t("transcription.aiRename")
                                    }
                                    className="h-10 shrink-0 rounded-xl border-border/60 bg-background/30 px-3 text-xs shadow-none backdrop-blur-xl hover:bg-background/50"
                                >
                                    <Sparkles
                                        className={
                                            isAutoRenaming
                                                ? "h-4 w-4 animate-pulse"
                                                : "h-4 w-4"
                                        }
                                    />
                                    <span className="hidden sm:inline">
                                        {t("transcription.aiRename")}
                                    </span>
                                </Button>
                                {canRenameRecording ? (
                                    <Button
                                        size="icon"
                                        variant="outline"
                                        onClick={handleRenameStart}
                                        aria-label={renameActionLabel}
                                        title={renameActionLabel}
                                        className="shrink-0"
                                        data-testid="recording-rename-start"
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                ) : null}
                            </div>
                        )}
                        <p className="mt-1 truncate text-sm text-muted-foreground">
                            {startTimeLabel}
                        </p>
                    </div>

                    <div className="hidden shrink-0 items-center gap-2 rounded-full border border-border/60 bg-background/30 px-3 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur-xl md:flex">
                        <Database className="h-3.5 w-3.5" />
                        <span>{sourceLabel}</span>
                    </div>
                </header>

                <SystemBanner />

                <div
                    className="glass-surface-subtle flex flex-wrap items-center gap-2 rounded-2xl p-2"
                    data-testid="recording-detail-copy-strip"
                >
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleCopyLocalTranscript}
                        disabled={
                            copyingAction === "local" ||
                            !localTranscriptCopyText.trim()
                        }
                        aria-busy={copyingAction === "local"}
                        data-testid="recording-copy-local-transcript"
                        className="h-9 rounded-xl"
                    >
                        <Copy className="h-4 w-4" />
                        {copyingAction === "local"
                            ? t("common.copying")
                            : t("transcription.copyTranscript")}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                            handleCopySourceMaterial("source-transcript")
                        }
                        disabled={
                            copyingAction === "source-transcript" ||
                            !recording.sourceProvider
                        }
                        aria-busy={copyingAction === "source-transcript"}
                        data-testid="recording-copy-source-transcript"
                        className="h-9 rounded-xl"
                    >
                        <Copy className="h-4 w-4" />
                        {copyingAction === "source-transcript"
                            ? t("common.copying")
                            : t("sourceReport.copySourceTranscript")}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                            handleCopySourceMaterial("source-report")
                        }
                        disabled={
                            copyingAction === "source-report" ||
                            !recording.sourceProvider
                        }
                        aria-busy={copyingAction === "source-report"}
                        data-testid="recording-copy-source-report"
                        className="h-9 rounded-xl"
                    >
                        <Copy className="h-4 w-4" />
                        {copyingAction === "source-report"
                            ? t("common.copying")
                            : t("sourceReport.copySourceReport")}
                    </Button>
                </div>

                {isAutoRenaming && !autoRenamePreview ? (
                    <AiRenamePreviewCard
                        className="mx-0"
                        isApplying={false}
                        isRegenerating={isAutoRenaming}
                        message={
                            language === "zh-CN"
                                ? "正在根据当前转写生成可预览的标题。"
                                : "Generating a preview title from the current transcript."
                        }
                        state="loading"
                        title={t("transcription.aiRename")}
                    />
                ) : autoRenameError ? (
                    <AiRenamePreviewCard
                        className="mx-0"
                        isApplying={false}
                        isRegenerating={isAutoRenaming}
                        message={autoRenameError}
                        onRegenerate={handleAutoRename}
                        regenerateLabel={t("transcription.aiRenameRegenerate")}
                        state="error"
                        title={t("transcription.autoRenameFailed")}
                    />
                ) : autoRenamePreview ? (
                    <AiRenamePreviewCard
                        applyLabel={t("transcription.aiRenameApply")}
                        cancelLabel={t("transcription.aiRenameCancelPreview")}
                        className="mx-0"
                        filename={autoRenamePreview}
                        isApplying={isApplyingAutoRename}
                        isRegenerating={isAutoRenaming}
                        message={autoRenamePreviewMessage}
                        onApply={handleAutoRenamePreviewApply}
                        onCancel={handleAutoRenamePreviewCancel}
                        onRegenerate={handleAutoRename}
                        regenerateLabel={t("transcription.aiRenameRegenerate")}
                        state="review"
                        title={t("transcription.aiRenamePreview")}
                    />
                ) : autoRenameDisabledReason ? (
                    <AiRenamePreviewCard
                        actionLabel={
                            !titleGenerationProviderConfigured
                                ? t("transcription.aiRenameOpenSettings")
                                : undefined
                        }
                        actionHref={
                            !titleGenerationProviderConfigured
                                ? "/settings#title-generation"
                                : undefined
                        }
                        actionTestId="ai-rename-open-settings"
                        className="mx-0"
                        isApplying={false}
                        isRegenerating={false}
                        message={autoRenameDisabledReason}
                        state="unavailable"
                        title={t("transcription.aiRename")}
                    />
                ) : null}

                <main className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(24rem,1.08fr)]">
                    <section className="min-h-0 space-y-4 overflow-y-auto overscroll-contain pr-0 lg:pr-1">
                        <RecordingPlayer
                            recording={taggedRecording}
                            tags={recordingTags}
                            isTagManagerOpen={tagManagerOpen}
                            onToggleTagManager={() =>
                                setTagManagerOpen((open) => !open)
                            }
                            tagManagerPanel={
                                <RecordingTagManager
                                    variant="popover"
                                    recording={taggedRecording}
                                    availableTags={tagCatalog}
                                    onAvailableTagsChange={setTagCatalog}
                                    onRecordingTagsChange={applyRecordingTags}
                                />
                            }
                        />

                        <Card>
                            <CardHeader>
                                <CardTitle>{t("recording.details")}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid gap-3 text-sm sm:grid-cols-2">
                                    <div className="glass-surface-subtle rounded-xl p-3">
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <Clock3 className="h-3.5 w-3.5" />
                                            {t("recording.duration")}
                                        </div>
                                        <div className="mt-2 font-mono font-medium">
                                            {durationLabel}
                                        </div>
                                    </div>
                                    <div className="glass-surface-subtle rounded-xl p-3">
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <HardDrive className="h-3.5 w-3.5" />
                                            {t("recording.fileSize")}
                                        </div>
                                        <div className="mt-2 font-medium">
                                            {fileSizeLabel}
                                        </div>
                                    </div>
                                    <div className="glass-surface-subtle rounded-xl p-3">
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <CalendarDays className="h-3.5 w-3.5" />
                                            {t("recording.date")}
                                        </div>
                                        <div className="mt-2 font-medium">
                                            {startTimeLabel}
                                        </div>
                                    </div>
                                    <div className="glass-surface-subtle rounded-xl p-3">
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <Database className="h-3.5 w-3.5" />
                                            {t("recording.source")}
                                        </div>
                                        <div className="mt-2 font-medium">
                                            {sourceLabel}
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-3 rounded-xl border border-border/55 bg-background/30 px-3 py-2 text-xs text-muted-foreground">
                                    <span className="mr-2 font-medium text-foreground">
                                        {t("recording.device")}
                                    </span>
                                    <span className="font-mono">
                                        {recording.providerDeviceId}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    </section>

                    <section className="min-h-0 overflow-y-auto overscroll-contain">
                        {recording.sourceProvider ? (
                            <div className="flex flex-col gap-4">
                                <div className="glass-surface rounded-2xl p-4">
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="flex flex-col gap-1">
                                            <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
                                                {t("recording.sourceRecord")}
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                {t(
                                                    "recording.sourceRecordDescription",
                                                )}
                                            </p>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
                                                {t("recording.localTranscript")}
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                {t(
                                                    "recording.localWorkflowDescription",
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                    <SegmentedTabs
                                        className="mt-4"
                                        items={[
                                            {
                                                value: "source",
                                                label: getSourceTabLabel(
                                                    recording.sourceProvider,
                                                    language,
                                                ),
                                            },
                                            ...(showLocalTranscriptTab
                                                ? [
                                                      {
                                                          value: "local" as const,
                                                          label: t(
                                                              "recording.localTranscript",
                                                          ),
                                                      },
                                                  ]
                                                : []),
                                            {
                                                value: "speakers",
                                                label: t("speakerReview.title"),
                                            },
                                        ]}
                                        value={activeTranscriptTab}
                                        onValueChange={setActiveTranscriptTab}
                                    />
                                    <p className="mt-3 text-sm text-muted-foreground">
                                        {showLocalTranscriptTab
                                            ? t("recording.transcriptTabsHint")
                                            : (transcriptionUnavailableReason ??
                                              t(
                                                  "recording.transcriptTabsHint",
                                              ))}
                                    </p>
                                </div>
                                {activeTranscriptTab === "source" ? (
                                    <SourceReportPanel
                                        hasAudio={recording.hasAudio}
                                        recordingId={recording.id}
                                        sourceProvider={
                                            recording.sourceProvider
                                        }
                                        autoLoad
                                    />
                                ) : activeTranscriptTab === "local" ? (
                                    <TranscriptionSection
                                        recordingId={recording.id}
                                        canTranscribe={canPrivateTranscribe}
                                        transcribeUnavailableReason={
                                            transcriptionUnavailableReason
                                        }
                                        initialTranscription={
                                            transcription?.text
                                        }
                                        initialLanguage={
                                            transcription?.detectedLanguage
                                        }
                                        initialType={
                                            transcription?.transcriptionType
                                        }
                                        initialSpeakerMap={liveSpeakerMap}
                                        initialJobStatus={
                                            transcriptionJob?.status
                                        }
                                        initialJobRemoteStatus={
                                            transcriptionJob?.remoteStatus
                                        }
                                        initialJobError={
                                            transcriptionJob?.lastError
                                        }
                                        showSpeakerReview={false}
                                    />
                                ) : transcription?.text?.trim() ? (
                                    <div className="glass-surface rounded-2xl p-4">
                                        <SpeakerLabelEditor
                                            recordingId={recording.id}
                                            speakerMap={liveSpeakerMap}
                                            onSpeakerMapChanged={
                                                setLiveSpeakerMap
                                            }
                                        />
                                    </div>
                                ) : (
                                    <div className="glass-surface-subtle rounded-2xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                                        {t(
                                            "transcription.noTranscriptAvailable",
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <TranscriptionSection
                                recordingId={recording.id}
                                canTranscribe={canPrivateTranscribe}
                                transcribeUnavailableReason={
                                    transcriptionUnavailableReason
                                }
                                initialTranscription={transcription?.text}
                                initialLanguage={
                                    transcription?.detectedLanguage
                                }
                                initialType={transcription?.transcriptionType}
                                initialSpeakerMap={liveSpeakerMap}
                                initialJobStatus={transcriptionJob?.status}
                                initialJobRemoteStatus={
                                    transcriptionJob?.remoteStatus
                                }
                                initialJobError={transcriptionJob?.lastError}
                            />
                        )}
                    </section>
                </main>
            </div>
        </div>
    );
}
