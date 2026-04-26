"use client";

import { CheckCircle, CloudOff, Pencil, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { RecordingPlayer } from "@/components/dashboard/recording-player";
import { useLanguage } from "@/components/language-provider";
import { SourceReportPanel } from "@/components/recordings/source-report-panel";
import { TranscriptionSection } from "@/components/recordings/transcription-section";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
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
    const [filename, setFilename] = useState(recording.filename);
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState(recording.filename);
    const [isSavingRename, setIsSavingRename] = useState(false);
    const [isAutoRenaming, setIsAutoRenaming] = useState(false);
    const [activeTranscriptTab, setActiveTranscriptTab] = useState<
        "source" | "local"
    >("source");
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
            !isAutoRenaming,
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

    useEffect(() => {
        if (previousRecordingIdRef.current !== recording.id) {
            previousRecordingIdRef.current = recording.id;
            setActiveTranscriptTab("source");
        }
    }, [recording.id]);

    useEffect(() => {
        if (!showLocalTranscriptTab && activeTranscriptTab === "local") {
            setActiveTranscriptTab("source");
        }
    }, [activeTranscriptTab, showLocalTranscriptTab]);

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

        const confirmed = await confirm({
            title: t("common.confirmAction"),
            description: t("transcription.aiRenameConfirm"),
            confirmLabel: t("common.confirm"),
            cancelLabel: t("common.cancel"),
        });
        if (!confirmed) {
            return;
        }

        setIsAutoRenaming(true);
        try {
            const response = await fetch(
                `/api/recordings/${recording.id}/rename/auto`,
                { method: "POST" },
            );
            const data = await response.json();
            if (!response.ok) {
                toast.error(data.error || t("transcription.autoRenameFailed"));
                return;
            }

            const nextFilename =
                typeof data.filename === "string" ? data.filename : filename;
            setFilename(nextFilename);
            setRenameValue(nextFilename);
            toast.success(
                t("transcription.autoRenameSuccess", {
                    filename: nextFilename,
                }),
            );
        } catch {
            toast.error(t("transcription.autoRenameFailed"));
        } finally {
            setIsAutoRenaming(false);
        }
    }, [
        autoRenameDisabledReason,
        canAutoRenameRecording,
        confirm,
        filename,
        recording.id,
        t,
    ]);

    return (
        <div className="bg-transparent">
            <div className="container mx-auto max-w-4xl px-4 py-6">
                <div className="mb-6 flex items-center gap-4">
                    <Button
                        onClick={() =>
                            navigateBrowserRoute(router, "/dashboard")
                        }
                        variant="outline"
                        size="icon"
                        aria-label={t("recording.backToDashboard")}
                    >
                        ←
                    </Button>

                    <div className="min-w-0 flex-1">
                        {isRenaming ? (
                            <div className="flex items-center gap-2">
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
                                    className="h-auto py-1 text-xl font-bold"
                                    autoFocus
                                    disabled={isSavingRename}
                                />
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleAutoRename}
                                    disabled={!canAutoRenameRecording}
                                    title={
                                        autoRenameDisabledReason ??
                                        t("transcription.aiRename")
                                    }
                                    className="h-10 shrink-0 rounded-full border-border/60 bg-background/30 px-3 text-xs shadow-none backdrop-blur-xl hover:bg-background/50"
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
                                    aria-label={t("recording.saveRename")}
                                    className="h-10 w-10 shrink-0 rounded-full border-emerald-500/30 bg-emerald-500/10 text-emerald-700 shadow-none hover:bg-emerald-500/15 dark:text-emerald-200"
                                >
                                    <CheckCircle className="h-5 w-5" />
                                </Button>
                                <Button
                                    size="icon"
                                    variant="outline"
                                    onClick={handleRenameCancel}
                                    disabled={isSavingRename}
                                    aria-label={t("recording.cancelRename")}
                                    className="h-10 w-10 shrink-0 rounded-full border-border/60 bg-background/30 shadow-none backdrop-blur-xl hover:bg-background/50"
                                >
                                    <X className="h-5 w-5" />
                                </Button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <h1 className="truncate text-3xl font-bold">
                                    {filename}
                                </h1>
                                {recording.upstreamDeleted && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-1 text-xs font-medium text-amber-500">
                                        <CloudOff className="h-3 w-3" />
                                        {t("recording.localOnly")}
                                    </span>
                                )}
                                {canRenameRecording ? (
                                    <Button
                                        size="icon"
                                        variant="outline"
                                        onClick={handleRenameStart}
                                        aria-label={renameActionLabel}
                                        title={renameActionLabel}
                                        className="shrink-0"
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                ) : null}
                            </div>
                        )}
                        <p className="mt-1 text-sm text-muted-foreground">
                            {formatDateTime(
                                recording.startTime,
                                "absolute",
                                language,
                            )}
                        </p>
                    </div>
                </div>

                <div className="space-y-6">
                    <RecordingPlayer recording={recording} />

                    {recording.sourceProvider ? (
                        <div className="flex flex-col gap-4">
                            <div className="rounded-2xl border border-white/10 bg-background/20 p-4">
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
                                <div className="mt-4 flex flex-wrap items-center gap-2">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant={
                                            activeTranscriptTab === "source"
                                                ? "default"
                                                : "outline"
                                        }
                                        onClick={() =>
                                            setActiveTranscriptTab("source")
                                        }
                                    >
                                        {getSourceTabLabel(
                                            recording.sourceProvider,
                                            language,
                                        )}
                                    </Button>
                                    {showLocalTranscriptTab ? (
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant={
                                                activeTranscriptTab === "local"
                                                    ? "default"
                                                    : "outline"
                                            }
                                            onClick={() =>
                                                setActiveTranscriptTab("local")
                                            }
                                        >
                                            {t("recording.localTranscript")}
                                        </Button>
                                    ) : null}
                                </div>
                                <p className="mt-3 text-sm text-muted-foreground">
                                    {showLocalTranscriptTab
                                        ? t("recording.transcriptTabsHint")
                                        : (transcriptionUnavailableReason ??
                                          t("recording.transcriptTabsHint"))}
                                </p>
                            </div>
                            {activeTranscriptTab === "source" ? (
                                <SourceReportPanel
                                    recordingId={recording.id}
                                    sourceProvider={recording.sourceProvider}
                                />
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
                                    initialType={
                                        transcription?.transcriptionType
                                    }
                                    initialSpeakerMap={
                                        transcription?.speakerMap
                                    }
                                    initialJobStatus={transcriptionJob?.status}
                                    initialJobRemoteStatus={
                                        transcriptionJob?.remoteStatus
                                    }
                                    initialJobError={
                                        transcriptionJob?.lastError
                                    }
                                />
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
                            initialLanguage={transcription?.detectedLanguage}
                            initialType={transcription?.transcriptionType}
                            initialSpeakerMap={transcription?.speakerMap}
                            initialJobStatus={transcriptionJob?.status}
                            initialJobRemoteStatus={
                                transcriptionJob?.remoteStatus
                            }
                            initialJobError={transcriptionJob?.lastError}
                        />
                    )}

                    <Card>
                        <CardHeader>
                            <CardTitle>{t("recording.details")}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-5">
                                <div>
                                    <div className="mb-1 text-xs text-muted-foreground">
                                        {t("recording.duration")}
                                    </div>
                                    <div className="font-medium">
                                        {Math.floor(recording.duration / 60000)}
                                        :
                                        {((recording.duration % 60000) / 1000)
                                            .toFixed(0)
                                            .padStart(2, "0")}
                                    </div>
                                </div>
                                <div>
                                    <div className="mb-1 text-xs text-muted-foreground">
                                        {t("recording.fileSize")}
                                    </div>
                                    <div className="font-medium">
                                        {(
                                            recording.filesize /
                                            (1024 * 1024)
                                        ).toFixed(2)}{" "}
                                        MB
                                    </div>
                                </div>
                                <div>
                                    <div className="mb-1 text-xs text-muted-foreground">
                                        {t("recording.device")}
                                    </div>
                                    <div className="truncate font-mono text-xs">
                                        {recording.providerDeviceId}
                                    </div>
                                </div>
                                <div>
                                    <div className="mb-1 text-xs text-muted-foreground">
                                        {t("recording.date")}
                                    </div>
                                    <div className="font-medium">
                                        {formatDateTime(
                                            recording.startTime,
                                            "absolute",
                                            language,
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <div className="mb-1 text-xs text-muted-foreground">
                                        {t("recording.source")}
                                    </div>
                                    <div className="font-medium">
                                        {getSourceProviderLabel(
                                            recording.sourceProvider,
                                            language,
                                        )}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
