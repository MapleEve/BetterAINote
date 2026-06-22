"use client";

import {
    ArrowLeft,
    Check,
    Copy,
    EllipsisVertical,
    FileText,
    Pencil,
    Sparkles,
    X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/components/language-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty";
import {
    Field,
    FieldContent,
    FieldDescription,
    FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
    type SegmentedTabItem,
    SegmentedTabs,
} from "@/components/ui/segmented-tabs";
import { SystemBanner } from "@/features/dashboard/components/system-banner";
import { AiRenamePreviewCard as AiRenamePreview } from "@/features/recordings/components/ai-rename-preview-card";
import { RecordingPlayer } from "@/features/recordings/components/recording-player";
import { RecordingTagManager } from "@/features/recordings/components/recording-tag-manager";
import {
    SotPlayerSourceTag,
    SotPlayerStatusBadge,
} from "@/features/recordings/components/sot-player-primitives";
import {
    type SourceReportAvailabilitySnapshot,
    SourceReportPanel,
} from "@/features/recordings/components/source-report-panel";
import { SpeakerLabelEditor } from "@/features/recordings/components/speaker-label-editor";
import { TranscriptionSection } from "@/features/recordings/components/transcription-section";
import { useTitleGenerationSettingsStore } from "@/features/settings/title-generation-settings-store";
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

interface RawTranscriptCopyPayload {
    transcript?: {
        text?: string | null;
    } | null;
    error?: string;
}

function getSotSegmentedTabProps<T extends string>(
    _item: SegmentedTabItem<T>,
    state: { active: boolean; disabled: boolean },
) {
    return {
        "data-sot-control": "segmented-tab",
        "data-sot-state": state.disabled
            ? "disabled"
            : state.active
              ? "active"
              : "idle",
    };
}

function createSourceReportAvailability(
    sourceProvider: string | null | undefined,
): SourceReportAvailabilitySnapshot {
    return {
        state: sourceProvider ? "loading" : "missing",
        transcriptAvailable: false,
        reportAvailable: false,
    };
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

async function readResponseError(response: Response, fallback: string) {
    try {
        const data = (await response.json()) as { error?: unknown };
        return typeof data.error === "string" && data.error.trim()
            ? data.error
            : fallback;
    } catch {
        return fallback;
    }
}

export function RecordingWorkstation({
    recording,
    transcription,
    transcriptionJob,
}: RecordingWorkstationProps) {
    const { language, t } = useLanguage();
    const confirm = useConfirmDialog();
    const router = useBrowserRouteController();
    const { settings: titleGenerationSettings } =
        useTitleGenerationSettingsStore();
    const [hydrated, setHydrated] = useState(false);
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
    const [autoRenameUnavailableOpen, setAutoRenameUnavailableOpen] =
        useState(false);
    const [activeTranscriptTab, setActiveTranscriptTab] = useState<
        "source" | "local" | "speakers"
    >("source");
    const [copyingAction, setCopyingAction] = useState<
        "local" | "raw-transcript" | null
    >(null);
    const [, setSourceReportAvailability] =
        useState<SourceReportAvailabilitySnapshot>(() =>
            createSourceReportAvailability(recording.sourceProvider),
        );
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
    const [moreOpen, setMoreOpen] = useState(false);
    const moreAnchorRef = useRef<HTMLDivElement>(null);
    const moreTriggerRef = useRef<HTMLButtonElement>(null);
    const autoRenameRequestIdRef = useRef(0);
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
    const localDeleteAvailable = Boolean(
        !recording.sourceProvider || recording.upstreamDeleted,
    );
    const moreActionsState = !recording.sourceProvider
        ? "local-only"
        : recording.upstreamDeleted
          ? "upstream-deleted"
          : "upstream";
    const moreActionsShowRetranscribe =
        moreActionsState === "local-only" || moreActionsState === "upstream";
    const moreActionsShowSeparator =
        moreActionsState === "local-only" ||
        moreActionsState === "upstream-deleted";
    const moreActionsShowPrimaryIcons = moreActionsState === "local-only";
    const moreActionsShowDeleteIcon =
        moreActionsState === "local-only" ||
        moreActionsState === "upstream-deleted";

    useEffect(() => {
        setHydrated(true);
    }, []);

    useEffect(() => {
        if (previousRecordingIdRef.current !== recording.id) {
            previousRecordingIdRef.current = recording.id;
            setActiveTranscriptTab("source");
            setFilename(recording.filename);
            setRenameValue(recording.filename);
            setAutoRenamePreview(null);
            setAutoRenameError(null);
            setAutoRenameUnavailableOpen(false);
            setRecordingTags(recording.tags);
            setTagManagerOpen(false);
            setMoreOpen(false);
            setSourceReportAvailability(
                createSourceReportAvailability(recording.sourceProvider),
            );
        }
    }, [
        recording.filename,
        recording.id,
        recording.sourceProvider,
        recording.tags,
    ]);

    useEffect(() => {
        if (!autoRenameDisabledReason) {
            setAutoRenameUnavailableOpen(false);
        }
    }, [autoRenameDisabledReason]);

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
        setSourceReportAvailability(
            createSourceReportAvailability(recording.sourceProvider),
        );
    }, [recording.sourceProvider]);

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
                setAutoRenameError(null);
                setAutoRenamePreview(null);
                setAutoRenameUnavailableOpen(true);
            }
            return;
        }

        setAutoRenameError(null);
        setAutoRenameUnavailableOpen(false);
        setIsAutoRenaming(true);
        const requestId = autoRenameRequestIdRef.current + 1;
        autoRenameRequestIdRef.current = requestId;
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
            if (autoRenameRequestIdRef.current !== requestId) {
                return;
            }
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
            if (autoRenameRequestIdRef.current !== requestId) {
                return;
            }
            setAutoRenameError(message);
            toast.error(message);
        } finally {
            if (autoRenameRequestIdRef.current === requestId) {
                setIsAutoRenaming(false);
            }
        }
    }, [autoRenameDisabledReason, canAutoRenameRecording, recording.id, t]);

    const handleAutoRenamePreviewCancel = useCallback(() => {
        autoRenameRequestIdRef.current += 1;
        setIsAutoRenaming(false);
        setIsApplyingAutoRename(false);
        setAutoRenamePreview(null);
        setAutoRenameError(null);
        setAutoRenameUnavailableOpen(false);
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

    const handleMoreRename = useCallback(() => {
        setMoreOpen(false);
        handleRenameStart();
    }, [handleRenameStart]);

    const handleMoreAutoRename = useCallback(() => {
        setMoreOpen(false);
        void handleAutoRename();
    }, [handleAutoRename]);

    const handleMoreRetranscribe = useCallback(async () => {
        setMoreOpen(false);
        moreTriggerRef.current?.focus({ preventScroll: true });
        if (!canPrivateTranscribe) {
            toast.error(
                transcriptionUnavailableReason ??
                    t("transcription.failedToLoad"),
            );
            return;
        }

        const confirmed = await confirm({
            title: t("transcription.retranscribeConfirmTitle"),
            description: t("transcription.retranscribeConfirmDescription"),
            details: [
                t("transcription.retranscribeConfirmDetailTranscript"),
                t("transcription.retranscribeConfirmDetailSpeakers"),
                t("transcription.retranscribeConfirmDetailSource"),
            ],
            confirmLabel: t("transcription.retranscribeConfirmLabel"),
            cancelLabel: t("common.cancel"),
        });
        if (!confirmed) {
            return;
        }

        try {
            const response = await fetch(
                `/api/recordings/${recording.id}/transcribe`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ force: true }),
                },
            );
            if (!response.ok) {
                toast.error(
                    await readResponseError(
                        response,
                        t("transcription.failedToLoad"),
                    ),
                );
                return;
            }
            toast.success(t("transcription.requeuedSuccess"));
        } catch {
            toast.error(t("transcription.failedToLoad"));
        }
    }, [
        canPrivateTranscribe,
        confirm,
        recording.id,
        t,
        transcriptionUnavailableReason,
    ]);

    const handleDeleteLocalRecording = useCallback(async () => {
        if (!localDeleteAvailable) {
            return;
        }

        setMoreOpen(false);
        moreTriggerRef.current?.focus({ preventScroll: true });
        const confirmed = await confirm({
            title: "删除本地副本？",
            description: recording.upstreamDeleted
                ? "这条录音在来源系统中已被删除，本地仅留存缓存副本。"
                : "这条录音只保存在本地。",
            warning: "删除后转写、标签与 AI 标题都会一并清除，且无法恢复。",
            confirmLabel: "永久删除",
            cancelLabel: t("common.cancel"),
        });
        if (!confirmed) {
            return;
        }

        try {
            const response = await fetch(`/api/recordings/${recording.id}`, {
                method: "DELETE",
            });
            if (!response.ok) {
                toast.error(
                    await readResponseError(
                        response,
                        t("recording.deleteFailed"),
                    ),
                );
                return;
            }
            toast.success(t("recording.deleteSuccess"));
            navigateBrowserRoute(router, "/dashboard");
        } catch {
            toast.error(t("recording.deleteFailed"));
        }
    }, [
        confirm,
        localDeleteAvailable,
        recording.id,
        recording.upstreamDeleted,
        router,
        t,
    ]);

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

    const handleCopyRawTranscript = useCallback(async () => {
        if (!transcription?.text?.trim()) {
            toast.error(t("transcription.noTranscript"));
            return;
        }

        setCopyingAction("raw-transcript");
        try {
            const response = await fetch(
                `/api/recordings/${recording.id}/transcript/raw`,
                { cache: "no-store" },
            );
            const payload = (await response
                .json()
                .catch(() => ({}))) as RawTranscriptCopyPayload;
            const copyText = payload.transcript?.text ?? "";

            if (!response.ok || !copyText.trim()) {
                toast.error(
                    payload.error ??
                        t("speakerReview.failedToLoadTranscriptReview"),
                );
                return;
            }

            await writeBrowserClipboardText(copyText);
            toast.success(t("speakerReview.rawTranscriptCopied"));
        } catch {
            toast.error(t("speakerReview.copyRawTranscriptFailed"));
        } finally {
            setCopyingAction(null);
        }
    }, [recording.id, t, transcription?.text]);

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
    const autoRenameSubtitle = "仅本次预览，不会写回来源";
    const autoRenameUnavailableMessage = !titleGenerationProviderConfigured
        ? "AI 重命名服务尚未配置或暂时不可用。"
        : autoRenameDisabledReason;
    const autoRenameUnavailableHint = !titleGenerationProviderConfigured
        ? "前往设置 → AI 重命名服务以启用。"
        : null;
    const autoRenamePanel =
        isAutoRenaming && !autoRenamePreview ? (
            <AiRenamePreview
                applyLabel="应用"
                bodyLabel={t("transcription.aiRenameSuggestedTitle")}
                cancelLabel="取消"
                closeLabel={t("transcription.aiRenameClosePreview")}
                isApplying={false}
                isRegenerating={isAutoRenaming}
                message="正在根据转写生成标题…"
                onApply={handleAutoRenamePreviewApply}
                onCancel={handleAutoRenamePreviewCancel}
                onRegenerate={handleAutoRename}
                regenerateLabel="生成中…"
                state="loading"
                subtitle={autoRenameSubtitle}
                title={t("transcription.aiRenamePreview")}
            />
        ) : autoRenameError ? (
            <AiRenamePreview
                applyLabel="应用"
                bodyLabel={t("transcription.aiRenameSuggestedTitle")}
                cancelLabel="取消"
                closeLabel={t("transcription.aiRenameClosePreview")}
                isApplying={false}
                isRegenerating={isAutoRenaming}
                message="这次没拿到结果，可能是转写太短或模型暂时不可用。"
                onApply={handleAutoRenamePreviewApply}
                onCancel={handleAutoRenamePreviewCancel}
                onRegenerate={handleAutoRename}
                regenerateLabel="重试"
                state="error"
                subtitle={autoRenameSubtitle}
                title={t("transcription.aiRenamePreview")}
            />
        ) : autoRenamePreview ? (
            <AiRenamePreview
                applyLabel="应用"
                bodyLabel={t("transcription.aiRenameSuggestedTitle")}
                cancelLabel="取消"
                closeLabel={t("transcription.aiRenameClosePreview")}
                filename={autoRenamePreview}
                isApplying={isApplyingAutoRename}
                isRegenerating={isAutoRenaming}
                message="确认无误后点击「应用」，将替换录音标题且不可一键撤销。"
                onApply={handleAutoRenamePreviewApply}
                onCancel={handleAutoRenamePreviewCancel}
                onRegenerate={handleAutoRename}
                originalFilename={filename}
                regenerateLabel={t("transcription.aiRenameRegenerate")}
                state="review"
                subtitle={autoRenameSubtitle}
                title={t("transcription.aiRenamePreview")}
            />
        ) : autoRenameUnavailableOpen && autoRenameDisabledReason ? (
            <AiRenamePreview
                bodyLabel={t("transcription.aiRenameSuggestedTitle")}
                closeLabel={t("transcription.aiRenameClosePreview")}
                hint={autoRenameUnavailableHint}
                isApplying={false}
                isRegenerating={false}
                message={autoRenameUnavailableMessage}
                onCancel={handleAutoRenamePreviewCancel}
                onApply={handleAutoRenamePreviewApply}
                onRegenerate={handleAutoRename}
                applyLabel="应用"
                cancelLabel="取消"
                regenerateLabel="重新生成"
                state="unavailable"
                subtitle={autoRenameSubtitle}
                title={t("transcription.aiRenamePreview")}
            />
        ) : null;

    const recordingDetailHeaderState = isSavingRename
        ? "saving"
        : isRenaming
          ? "editing"
          : "normal";

    return (
        <div
            data-sot-shell="recording-workstation"
            data-hydrated={hydrated ? "true" : "false"}
            data-sot-surface="recording-workstation"
            data-sot-state={hydrated ? "ready" : "loading"}
        >
            <aside
                data-sot-panel="workstation-sidebar"
                data-sot-surface="recording-source-rail"
            >
                <div data-sot-part="workstation-brand">
                    <img src="/assets/logo-mark-steel.svg" alt="" />
                    <div data-sot-part="workstation-brand-text">
                        <div data-sot-part="workstation-brand-name">
                            BetterAINote
                        </div>
                        <div data-sot-part="workstation-brand-subtitle">
                            私人工作空间
                        </div>
                    </div>
                </div>
                <nav
                    data-sot-list="recording-detail-nav"
                    aria-label="录音详情导航"
                >
                    <div data-sot-part="recording-detail-nav-label">录音</div>
                    <Button
                        variant="ghost"
                        data-sot-control="recording-detail-back"
                        data-sot-state="selected"
                        type="button"
                        onClick={() =>
                            navigateBrowserRoute(router, "/dashboard")
                        }
                    >
                        <ArrowLeft data-icon="inline-start" />
                        <span>{t("recording.backToDashboard")}</span>
                    </Button>
                </nav>
            </aside>
            <main data-sot-panel="workstation-main">
                <header data-sot-panel="workstation-topbar">
                    <div data-sot-part="workstation-crumbs">
                        <span data-sot-part="workstation-crumb">录音</span>
                        <span data-sot-part="workstation-crumb-separator">
                            /
                        </span>
                        <span data-sot-part="workstation-crumb-current">
                            {filename}
                        </span>
                    </div>
                </header>
                <div data-sot-panel="workstation-workspace">
                    <Card
                        hasNoPadding
                        className="min-h-0 gap-0"
                        data-sot-panel="recording-detail-list"
                        aria-label="当前录音"
                        role="region"
                    >
                        <CardHeader
                            className="gap-0 border-b px-3 py-3"
                            data-sot-part="recording-detail-list-header"
                        >
                            <CardTitle
                                className="text-sm"
                                data-sot-part="recording-detail-list-title"
                            >
                                当前录音
                            </CardTitle>
                        </CardHeader>
                        <CardContent
                            className="flex min-h-0 flex-col px-0"
                            data-sot-part="recording-detail-list-content"
                        >
                            <div data-sot-list="recording-detail-list-rows">
                                <div
                                    data-sot-item="recording-detail-list-row"
                                    data-sot-state="selected"
                                >
                                    <div data-sot-part="recording-detail-list-row-body">
                                        <div data-sot-part="recording-detail-list-row-title">
                                            {filename}
                                        </div>
                                        <div data-sot-part="recording-detail-list-row-meta">
                                            <span data-sot-part="recording-detail-list-row-duration">
                                                {durationLabel}
                                            </span>
                                            <SotPlayerSourceTag
                                                label={sourceLabel}
                                                provider={
                                                    recording.sourceProvider
                                                }
                                            />
                                            <SotPlayerStatusBadge label="已打开" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <section data-sot-panel="recording-workstation-detail">
                        <CardHeader
                            variant="detailHeader"
                            data-sot-panel="recording-detail-header"
                            data-sot-mode={recordingDetailHeaderState}
                            data-sot-state={recordingDetailHeaderState}
                            data-rename-mode={recordingDetailHeaderState}
                            data-local-only={
                                localDeleteAvailable ? "true" : "false"
                            }
                        >
                            {recordingDetailHeaderState === "normal" ? (
                                <CardTitle
                                    variant="detailHeaderTitle"
                                    data-sot-part="detail-header-title"
                                    data-rh-title
                                    role="heading"
                                    aria-level={2}
                                >
                                    {filename}
                                </CardTitle>
                            ) : null}
                            {recordingDetailHeaderState === "normal" &&
                            localDeleteAvailable ? (
                                <Badge
                                    variant="detailHeaderLocal"
                                    data-sot-part="detail-header-local-badge"
                                    data-rh-local
                                    aria-label={t("recording.localOnly")}
                                >
                                    {t("recording.localOnly")}
                                </Badge>
                            ) : null}
                            {recordingDetailHeaderState === "editing" ? (
                                <Input
                                    variant="detailHeaderTitle"
                                    controlSize="detailHeaderTitle"
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
                                    data-rh-input
                                    data-sot-part="detail-header-title-input"
                                    data-sot-state="editing"
                                    aria-label="录音标题"
                                    maxLength={120}
                                    autoFocus={isRenaming}
                                />
                            ) : null}
                            {recordingDetailHeaderState === "saving" ? (
                                <Badge
                                    variant="detailHeaderStatus"
                                    data-sot-part="detail-header-title-status"
                                    data-sot-state="saving"
                                    data-rh-status
                                    aria-busy={isSavingRename}
                                    aria-live="polite"
                                >
                                    正在保存…
                                </Badge>
                            ) : null}

                            {recordingDetailHeaderState === "normal" &&
                            canRenameRecording ? (
                                <Button
                                    variant="detailHeaderIconAction"
                                    size="detailHeaderIconAction"
                                    onClick={handleRenameStart}
                                    aria-label="重命名"
                                    title="重命名"
                                    data-rh-edit-start
                                    data-sot-control="rename-recording-title"
                                    data-sot-part="detail-header-action"
                                    data-sot-mode="normal"
                                >
                                    <Pencil data-icon="inline-start" />
                                </Button>
                            ) : null}

                            {recordingDetailHeaderState === "normal" ? (
                                <div
                                    className="relative inline-flex items-center gap-1.5"
                                    data-rh-ai-anchor
                                    data-sot-part="detail-header-action-anchor"
                                    data-sot-mode="normal"
                                >
                                    <Button
                                        variant="detailHeaderAction"
                                        size="detailHeaderAction"
                                        onClick={handleAutoRename}
                                        disabled={
                                            isAutoRenaming ||
                                            isApplyingAutoRename
                                        }
                                        aria-haspopup="dialog"
                                        aria-expanded={Boolean(autoRenamePanel)}
                                        aria-busy={isAutoRenaming}
                                        title={
                                            autoRenameDisabledReason ??
                                            t("transcription.aiRename")
                                        }
                                        data-rh-ai-trigger
                                        data-sot-control="ai-rename"
                                        data-sot-part="detail-header-action"
                                        data-sot-mode="normal"
                                        data-sot-state={
                                            autoRenameDisabledReason
                                                ? "unavailable"
                                                : autoRenamePanel
                                                  ? "open"
                                                  : "idle"
                                        }
                                    >
                                        <Sparkles data-icon="inline-start" />
                                        {t("transcription.aiRename")}
                                    </Button>
                                    {autoRenamePanel}
                                </div>
                            ) : null}

                            {recordingDetailHeaderState === "editing" ? (
                                <>
                                    <Button
                                        variant="detailHeaderIconAction"
                                        size="detailHeaderIconAction"
                                        onClick={handleRenameSave}
                                        aria-label="保存新标题"
                                        title="保存（Enter）"
                                        data-rh-edit-save
                                        data-sot-control="save-recording-title"
                                        data-sot-part="detail-header-action"
                                        data-sot-mode="editing"
                                    >
                                        <Check data-icon="inline-start" />
                                    </Button>
                                    <Button
                                        variant="detailHeaderIconAction"
                                        size="detailHeaderIconAction"
                                        onClick={handleRenameCancel}
                                        aria-label={t("recording.cancelRename")}
                                        title="取消（Esc）"
                                        data-rh-edit-cancel
                                        data-sot-control="cancel-recording-title"
                                        data-sot-part="detail-header-action"
                                        data-sot-mode="editing"
                                    >
                                        <X data-icon="inline-start" />
                                    </Button>
                                </>
                            ) : null}
                            {recordingDetailHeaderState === "normal" ? (
                                <div
                                    className="relative inline-flex items-center gap-1.5"
                                    data-more-anchor
                                    data-sot-part="detail-header-action-anchor"
                                    data-sot-mode="normal"
                                    ref={moreAnchorRef}
                                >
                                    <DropdownMenu
                                        modal={false}
                                        open={moreOpen}
                                        onOpenChange={setMoreOpen}
                                    >
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                variant="detailHeaderIconAction"
                                                size="detailHeaderIconAction"
                                                type="button"
                                                aria-label={t(
                                                    "dashboardChrome.moreActions",
                                                )}
                                                aria-haspopup="menu"
                                                aria-expanded={moreOpen}
                                                data-sot-control="recording-more-actions"
                                                data-sot-part="detail-header-action"
                                                data-sot-mode="normal"
                                                data-more-trigger
                                                ref={moreTriggerRef}
                                            >
                                                <EllipsisVertical data-icon="inline-start" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent
                                            align="end"
                                            sideOffset={6}
                                            id="recording-detail-more-menu"
                                            aria-label={t(
                                                "dashboardChrome.moreActions",
                                            )}
                                            data-more-menu
                                            data-open={
                                                moreOpen ? "true" : "false"
                                            }
                                            data-sot-menu="recording-more-actions"
                                            data-sot-local-delete-available={
                                                localDeleteAvailable
                                                    ? "true"
                                                    : "false"
                                            }
                                            data-sot-state={moreActionsState}
                                        >
                                            <DropdownMenuGroup>
                                                <DropdownMenuItem
                                                    data-sot-menu-item="rename"
                                                    onSelect={handleMoreRename}
                                                >
                                                    {moreActionsShowPrimaryIcons ? (
                                                        <svg
                                                            viewBox="0 0 24 24"
                                                            aria-hidden="true"
                                                            focusable="false"
                                                        >
                                                            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                                                        </svg>
                                                    ) : null}
                                                    重命名
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    data-sot-menu-item="ai-rename"
                                                    onSelect={
                                                        handleMoreAutoRename
                                                    }
                                                >
                                                    {moreActionsShowPrimaryIcons ? (
                                                        <svg
                                                            viewBox="0 0 24 24"
                                                            aria-hidden="true"
                                                            focusable="false"
                                                        >
                                                            <path d="m12 3-1.6 4.6L6 9l4.4 1.4L12 15l1.6-4.6L18 9l-4.4-1.4z" />
                                                        </svg>
                                                    ) : null}
                                                    {t(
                                                        "transcription.aiRename",
                                                    )}
                                                </DropdownMenuItem>
                                                {moreActionsShowRetranscribe ? (
                                                    <DropdownMenuItem
                                                        data-sot-menu-item="retranscribe"
                                                        onSelect={() =>
                                                            void handleMoreRetranscribe()
                                                        }
                                                    >
                                                        {moreActionsShowPrimaryIcons ? (
                                                            <svg
                                                                viewBox="0 0 24 24"
                                                                aria-hidden="true"
                                                                focusable="false"
                                                            >
                                                                <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                                                                <path d="M3 3v5h5" />
                                                            </svg>
                                                        ) : null}
                                                        {t(
                                                            "transcription.retranscribe",
                                                        )}
                                                    </DropdownMenuItem>
                                                ) : null}
                                                {moreActionsShowSeparator ? (
                                                    <DropdownMenuSeparator data-sot-menu-separator="delete" />
                                                ) : null}
                                                <DropdownMenuItem
                                                    data-sot-menu-item="delete-local"
                                                    data-sot-tone="danger"
                                                    disabled={
                                                        !localDeleteAvailable
                                                    }
                                                    aria-disabled={
                                                        !localDeleteAvailable
                                                    }
                                                    onSelect={() =>
                                                        void handleDeleteLocalRecording()
                                                    }
                                                >
                                                    {moreActionsShowDeleteIcon ? (
                                                        <svg
                                                            viewBox="0 0 24 24"
                                                            aria-hidden="true"
                                                            focusable="false"
                                                        >
                                                            {moreActionsState ===
                                                            "upstream-deleted" ? (
                                                                <path d="M3 6h18" />
                                                            ) : (
                                                                <>
                                                                    <path d="M3 6h18" />
                                                                    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                                    <path d="M19 6 18 20a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                                                </>
                                                            )}
                                                        </svg>
                                                    ) : null}
                                                    删除本地副本
                                                    {recording.sourceProvider ? (
                                                        <span data-sot-menu-hint="">
                                                            {recording.upstreamDeleted
                                                                ? "上游已删除"
                                                                : "来源持有正本"}
                                                        </span>
                                                    ) : null}
                                                </DropdownMenuItem>
                                            </DropdownMenuGroup>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            ) : null}
                        </CardHeader>

                        <SystemBanner />

                        <div data-sot-panel="recording-workstation-real-detail">
                            <section data-sot-panel="recording-workstation-detail-body">
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
                                            onAvailableTagsChange={
                                                setTagCatalog
                                            }
                                            onRecordingTagsChange={
                                                applyRecordingTags
                                            }
                                            onClose={() =>
                                                setTagManagerOpen(false)
                                            }
                                        />
                                    }
                                />

                                <Card
                                    hasNoPadding
                                    className="min-h-0 gap-0"
                                    data-sot-panel="recording-detail-metadata"
                                >
                                    <CardHeader
                                        className="flex items-center gap-3 border-b px-4 py-3"
                                        data-sot-part="recording-detail-metadata-header"
                                    >
                                        <CardTitle
                                            className="min-w-0 flex-1 truncate text-xl"
                                            data-sot-part="recording-detail-metadata-title"
                                            role="heading"
                                            aria-level={2}
                                        >
                                            {t("recording.details")}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent
                                        className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-5 pt-4 pb-6"
                                        data-sot-part="recording-detail-metadata-body"
                                    >
                                        <Field>
                                            <FieldContent>
                                                <FieldTitle>
                                                    {t("recording.duration")}
                                                </FieldTitle>
                                                <FieldDescription>
                                                    {durationLabel}
                                                </FieldDescription>
                                            </FieldContent>
                                        </Field>
                                        <Field>
                                            <FieldContent>
                                                <FieldTitle>
                                                    {t("recording.fileSize")}
                                                </FieldTitle>
                                                <FieldDescription>
                                                    {fileSizeLabel}
                                                </FieldDescription>
                                            </FieldContent>
                                        </Field>
                                        <Field>
                                            <FieldContent>
                                                <FieldTitle>
                                                    {t("recording.date")}
                                                </FieldTitle>
                                                <FieldDescription>
                                                    {startTimeLabel}
                                                </FieldDescription>
                                            </FieldContent>
                                        </Field>
                                        <Field>
                                            <FieldContent>
                                                <FieldTitle>
                                                    {t("recording.source")}
                                                </FieldTitle>
                                                <FieldDescription>
                                                    {sourceLabel}
                                                </FieldDescription>
                                            </FieldContent>
                                        </Field>
                                        <Field>
                                            <FieldContent>
                                                <FieldTitle>
                                                    {t("recording.device")}
                                                </FieldTitle>
                                                <FieldDescription>
                                                    {recording.providerDeviceId}
                                                </FieldDescription>
                                            </FieldContent>
                                        </Field>
                                    </CardContent>
                                </Card>
                            </section>

                            <section
                                data-sot-part="recording-source-record-shell"
                                aria-label={t("recording.sourceRecord")}
                            >
                                <Card
                                    hasNoPadding
                                    className="min-h-0 gap-0"
                                    data-sot-panel="recording-source-record"
                                >
                                    <CardHeader
                                        className="flex items-center gap-3 border-b px-4 py-3"
                                        data-sot-part="recording-source-record-header"
                                    >
                                        <CardTitle
                                            className="min-w-0 flex-1 truncate text-xl"
                                            data-sot-part="recording-source-record-title"
                                            role="heading"
                                            aria-level={2}
                                        >
                                            {t("recording.sourceRecord")}
                                        </CardTitle>
                                        <div data-sot-part="recording-source-record-actions">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={
                                                    handleCopyLocalTranscript
                                                }
                                                disabled={
                                                    copyingAction === "local" ||
                                                    !localTranscriptCopyText.trim()
                                                }
                                                aria-busy={
                                                    copyingAction === "local"
                                                }
                                            >
                                                <Copy data-icon="inline-start" />
                                                {copyingAction === "local"
                                                    ? t("common.copying")
                                                    : t(
                                                          "transcription.copyTranscript",
                                                      )}
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={
                                                    handleCopyRawTranscript
                                                }
                                                disabled={
                                                    copyingAction ===
                                                        "raw-transcript" ||
                                                    !transcription?.text?.trim()
                                                }
                                                aria-busy={
                                                    copyingAction ===
                                                    "raw-transcript"
                                                }
                                            >
                                                <Copy data-icon="inline-start" />
                                                {copyingAction ===
                                                "raw-transcript"
                                                    ? t("common.copying")
                                                    : t(
                                                          "speakerReview.copyRawTranscript",
                                                      )}
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent
                                        className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-5 pt-4 pb-6"
                                        data-sot-part="recording-source-record-body"
                                    >
                                        <Field>
                                            <FieldContent>
                                                <FieldTitle>
                                                    {t(
                                                        "recording.sourceRecord",
                                                    )}
                                                </FieldTitle>
                                                <FieldDescription>
                                                    {t(
                                                        "recording.sourceRecordDescription",
                                                    )}
                                                </FieldDescription>
                                            </FieldContent>
                                        </Field>
                                        <Field>
                                            <FieldContent>
                                                <FieldTitle>
                                                    {t(
                                                        "recording.localTranscript",
                                                    )}
                                                </FieldTitle>
                                                <FieldDescription>
                                                    {t(
                                                        "recording.localWorkflowDescription",
                                                    )}
                                                </FieldDescription>
                                            </FieldContent>
                                        </Field>
                                        <div data-sot-part="recording-source-record-tabs">
                                            <SegmentedTabs
                                                data-sot-control="segmented-tabs"
                                                data-sot-size="sm"
                                                getItemProps={
                                                    getSotSegmentedTabProps
                                                }
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
                                                        label: t(
                                                            "speakerReview.title",
                                                        ),
                                                    },
                                                ]}
                                                value={activeTranscriptTab}
                                                onValueChange={
                                                    setActiveTranscriptTab
                                                }
                                            />
                                        </div>
                                        <FieldDescription data-sot-part="recording-source-record-hint">
                                            {showLocalTranscriptTab
                                                ? t(
                                                      "recording.transcriptTabsHint",
                                                  )
                                                : (transcriptionUnavailableReason ??
                                                  t(
                                                      "recording.transcriptTabsHint",
                                                  ))}
                                        </FieldDescription>
                                    </CardContent>
                                </Card>
                                <div data-sot-part="recording-source-record-pane">
                                    {activeTranscriptTab === "source" ? (
                                        <SourceReportPanel
                                            hasAudio={recording.hasAudio}
                                            recordingId={recording.id}
                                            sourceProvider={
                                                recording.sourceProvider
                                            }
                                            autoLoad
                                            onAvailabilityChange={
                                                setSourceReportAvailability
                                            }
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
                                        <div data-sot-part="recording-source-record-speakers-pane">
                                            <SpeakerLabelEditor
                                                recordingId={recording.id}
                                                speakerMap={liveSpeakerMap}
                                                onSpeakerMapChanged={
                                                    setLiveSpeakerMap
                                                }
                                            />
                                        </div>
                                    ) : (
                                        <Empty
                                            className="min-h-[280px] flex-1"
                                            data-sot-panel="recording-source-record-empty"
                                        >
                                            <EmptyHeader>
                                                <EmptyMedia
                                                    aria-hidden="true"
                                                    data-sot-part="recording-source-record-empty-icon"
                                                    variant="icon"
                                                >
                                                    <FileText />
                                                </EmptyMedia>
                                                <EmptyTitle data-sot-part="recording-source-record-empty-title">
                                                    {t(
                                                        "transcription.noTranscriptAvailable",
                                                    )}
                                                </EmptyTitle>
                                                <EmptyDescription data-sot-part="recording-source-record-empty-description">
                                                    {t(
                                                        "recording.localWorkflowDescription",
                                                    )}
                                                </EmptyDescription>
                                            </EmptyHeader>
                                            <EmptyContent data-sot-part="recording-source-record-empty-content">
                                                {t(
                                                    "recording.transcriptTabsHint",
                                                )}
                                            </EmptyContent>
                                        </Empty>
                                    )}
                                </div>
                            </section>
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
}
