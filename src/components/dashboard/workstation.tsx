"use client";

import {
    CheckCircle,
    CloudOff,
    Mic,
    Pencil,
    RefreshCw,
    Settings,
    Sparkles,
    Trash2,
    X,
} from "lucide-react";
import { startTransition, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/icons/logo";
import { useLanguage } from "@/components/language-provider";
import {
    normalizeSettingsSection,
    SettingsDialog,
} from "@/components/settings-dialog";
import { SyncStatus } from "@/components/sync-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { useTitleGenerationSettingsStore } from "@/features/settings/title-generation-settings-store";
import { useAutoSync } from "@/hooks/use-auto-sync";
import {
    canRecordingPrivateTranscribe,
    canRecordingRename,
    getPrivateTranscriptionUnavailableMessage,
    getRecordingRenameActionKey,
} from "@/lib/data-sources/presentation";
import {
    refreshBrowserRoute,
    useBrowserRouteController,
} from "@/lib/platform/browser-router";
import {
    addBrowserWindowEventListener,
    readBrowserHash,
    removeBrowserWindowEventListener,
    startBrowserInterval,
    stopBrowserInterval,
} from "@/lib/platform/browser-shell";
import type { RecordingTag } from "@/lib/recording-tags";
import { isActiveTranscriptionJob } from "@/lib/transcription/job-display";
import type { Recording } from "@/types/recording";
import { RecordingList } from "./recording-list";
import { RecordingPlayer } from "./recording-player";
import { RecordingTagManager } from "./recording-tag-manager";
import { TranscriptionPanel } from "./transcription-panel";

interface TranscriptionData {
    hasTranscript?: boolean;
    text?: string;
    language?: string;
    speakerMap?: Record<string, string>;
    segments?: TranscriptSegmentData[] | null;
}

interface TranscriptSegmentData {
    id: number;
    start: number | null;
    end: number | null;
    text: string;
    speakerLabel: string;
    speakerId?: string | null;
    speakerName?: string | null;
    similarity?: number | null;
    hasOverlap?: boolean | null;
    displaySpeaker?: string | null;
}

interface TranscriptionJobData {
    status: string;
    remoteStatus?: string | null;
    lastError?: string | null;
}

interface WorkstationProps {
    recordings: Recording[];
    transcriptions: Map<string, TranscriptionData>;
    transcriptionJobs: Map<string, TranscriptionJobData>;
}

export function Workstation({
    recordings,
    transcriptions,
    transcriptionJobs,
}: WorkstationProps) {
    const { language, t } = useLanguage();
    const confirm = useConfirmDialog();
    const router = useBrowserRouteController();
    const { settings: titleGenerationSettings } =
        useTitleGenerationSettingsStore();

    const [currentRecording, setCurrentRecording] = useState<Recording | null>(
        recordings[0] ?? null,
    );
    const [liveRecordings, setLiveRecordings] = useState(recordings);
    const [tagCatalog, setTagCatalog] = useState<RecordingTag[]>(() =>
        Array.from(
            new Map(
                recordings
                    .flatMap((recording) => recording.tags)
                    .map((tag) => [tag.id, tag]),
            ).values(),
        ),
    );
    const [, setIsTranscribing] = useState(false);
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState("");
    const [isSavingRename, setIsSavingRename] = useState(false);
    const [isAutoRenaming, setIsAutoRenaming] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [tagManagerOpen, setTagManagerOpen] = useState(false);
    const [liveTranscriptions, setLiveTranscriptions] = useState(
        () => new Map(transcriptions),
    );
    const [liveTranscriptionJobs, setLiveTranscriptionJobs] = useState(
        () => new Map(transcriptionJobs),
    );
    const [loadingTranscriptIds, setLoadingTranscriptIds] = useState(
        () => new Set<string>(),
    );

    const openSettingsFromHash = useCallback(() => {
        if (normalizeSettingsSection(readBrowserHash())) {
            setSettingsOpen(true);
        }
    }, []);

    useEffect(() => {
        openSettingsFromHash();
        addBrowserWindowEventListener("hashchange", openSettingsFromHash);

        return () =>
            removeBrowserWindowEventListener(
                "hashchange",
                openSettingsFromHash,
            );
    }, [openSettingsFromHash]);

    const currentTranscription = currentRecording
        ? liveTranscriptions.get(currentRecording.id)
        : undefined;
    const currentTranscriptionJob = currentRecording
        ? liveTranscriptionJobs.get(currentRecording.id)
        : undefined;
    const currentHasTranscript = Boolean(
        currentTranscription?.text?.trim() ||
            currentTranscription?.hasTranscript,
    );
    const isCurrentTranscriptLoading = Boolean(
        currentRecording && loadingTranscriptIds.has(currentRecording.id),
    );
    const canRenameCurrentRecording = currentRecording
        ? canRecordingRename(currentRecording.sourceProvider)
        : false;
    const currentRenameActionLabel = currentRecording
        ? t(getRecordingRenameActionKey(currentRecording.sourceProvider))
        : t("dashboard.renameRecording");
    const titleGenerationProviderConfigured = Boolean(
        titleGenerationSettings.titleGenerationApiKeySet &&
            titleGenerationSettings.titleGenerationModel?.trim(),
    );
    const autoRenameDisabledReason = !titleGenerationProviderConfigured
        ? t("transcription.aiRenameConfigureFirst")
        : !currentHasTranscript
          ? t("transcription.aiRenameNeedsTranscript")
          : !canRenameCurrentRecording
            ? currentRenameActionLabel
            : null;
    const canAutoRenameCurrentRecording = Boolean(
        currentRecording &&
            canRenameCurrentRecording &&
            currentHasTranscript &&
            titleGenerationProviderConfigured &&
            !isSavingRename &&
            !isAutoRenaming,
    );
    const currentCanPrivateTranscribe = currentRecording
        ? canRecordingPrivateTranscribe({
              sourceProvider: currentRecording.sourceProvider,
              hasAudio: currentRecording.hasAudio,
          })
        : false;
    const currentTranscribeUnavailableReason = currentRecording
        ? getPrivateTranscriptionUnavailableMessage(
              currentRecording.sourceProvider,
              currentRecording.hasAudio,
              language,
          )
        : null;

    useEffect(() => {
        setLiveTranscriptions(new Map(transcriptions));
    }, [transcriptions]);

    useEffect(() => {
        setLiveTranscriptionJobs(new Map(transcriptionJobs));
    }, [transcriptionJobs]);

    useEffect(() => {
        if (isRenaming) {
            setTagManagerOpen(false);
        }
    }, [isRenaming]);

    useEffect(() => {
        const recordingId = currentRecording?.id;
        if (!recordingId) {
            return;
        }

        const transcription = liveTranscriptions.get(recordingId);
        if (!transcription?.hasTranscript || transcription.text?.trim()) {
            return;
        }

        let cancelled = false;
        setLoadingTranscriptIds((previous) => {
            const next = new Set(previous);
            next.add(recordingId);
            return next;
        });

        const loadTranscript = async () => {
            try {
                const response = await fetch(
                    `/api/recordings/${recordingId}/transcript/speakers`,
                    { cache: "no-store" },
                );

                if (cancelled) {
                    return;
                }

                if (response.status === 404) {
                    setLiveTranscriptions((previous) => {
                        const next = new Map(previous);
                        next.set(recordingId, {
                            ...next.get(recordingId),
                            hasTranscript: false,
                        });
                        return next;
                    });
                    return;
                }

                if (!response.ok) {
                    return;
                }

                const data = await response.json();
                if (cancelled || !data?.transcript) {
                    return;
                }

                setLiveTranscriptions((previous) => {
                    const next = new Map(previous);
                    next.set(recordingId, {
                        hasTranscript: true,
                        text:
                            data.transcript.rawText ??
                            data.transcript.displayText ??
                            "",
                        language: data.transcript.detectedLanguage ?? undefined,
                        speakerMap: data.speakerMap ?? undefined,
                        segments: data.transcript.segments ?? null,
                    });
                    return next;
                });
            } catch {
                // The explicit transcript panel actions still surface user-facing errors.
            } finally {
                if (!cancelled) {
                    setLoadingTranscriptIds((previous) => {
                        const next = new Set(previous);
                        next.delete(recordingId);
                        return next;
                    });
                }
            }
        };

        void loadTranscript();

        return () => {
            cancelled = true;
        };
    }, [currentRecording?.id, liveTranscriptions]);

    useEffect(() => {
        setLiveRecordings(recordings);
        setCurrentRecording((previous) => {
            if (!previous) return recordings[0] ?? null;
            return (
                recordings.find((recording) => recording.id === previous.id) ??
                recordings[0] ??
                null
            );
        });
    }, [recordings]);

    useEffect(() => {
        const tagsById = new Map<string, RecordingTag>();
        for (const recording of liveRecordings) {
            for (const tag of recording.tags) {
                tagsById.set(tag.id, tag);
            }
        }
        setTagCatalog((previous) => {
            for (const tag of previous) {
                tagsById.set(tag.id, tag);
            }
            return Array.from(tagsById.values()).sort((a, b) =>
                a.name.localeCompare(b.name),
            );
        });
    }, [liveRecordings]);

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
                // Tag catalog is additive; recordings still carry their assigned tags.
            }
        };

        void loadTags();

        return () => {
            cancelled = true;
        };
    }, []);

    const applyRecordingTags = useCallback(
        (recordingId: string, tags: RecordingTag[]) => {
            setLiveRecordings((previous) =>
                previous.map((recording) =>
                    recording.id === recordingId
                        ? { ...recording, tags }
                        : recording,
                ),
            );
            setCurrentRecording((previous) =>
                previous?.id === recordingId ? { ...previous, tags } : previous,
            );
        },
        [],
    );

    useEffect(() => {
        setIsTranscribing(isActiveTranscriptionJob(currentTranscriptionJob));
    }, [currentTranscriptionJob]);

    useEffect(() => {
        if (!currentRecording) {
            return;
        }

        if (!isActiveTranscriptionJob(currentTranscriptionJob)) {
            return;
        }

        let cancelled = false;
        const poll = async () => {
            try {
                const response = await fetch(
                    `/api/recordings/${currentRecording.id}/transcribe`,
                    {
                        cache: "no-store",
                    },
                );
                if (!response.ok) {
                    return;
                }

                const data = await response.json();
                if (cancelled) {
                    return;
                }

                if (data?.transcript || data?.job?.status === "failed") {
                    if (data?.transcript) {
                        setLiveTranscriptions((previous) => {
                            const next = new Map(previous);
                            next.set(currentRecording.id, {
                                text: data.transcript.text || "",
                                language:
                                    data.transcript.detectedLanguage ||
                                    undefined,
                                speakerMap:
                                    data.transcript.speakerMap ?? undefined,
                                segments: data.transcript.segments ?? null,
                            });
                            return next;
                        });
                    }

                    setLiveTranscriptionJobs((previous) => {
                        const next = new Map(previous);
                        if (data?.job) {
                            next.set(currentRecording.id, {
                                status: data.job.status,
                                remoteStatus: data.job.remoteStatus ?? null,
                                lastError: data.job.lastError ?? null,
                            });
                        } else if (data?.transcript) {
                            next.delete(currentRecording.id);
                        }
                        return next;
                    });
                    setIsTranscribing(false);
                }
            } catch {
                // Ignore polling errors and try again on the next interval.
            }
        };

        void poll();
        const intervalId = startBrowserInterval(() => {
            void poll();
        }, 3000);

        return () => {
            cancelled = true;
            stopBrowserInterval(intervalId);
        };
    }, [currentRecording, currentTranscriptionJob]);

    const {
        autoSyncEnabled,
        isAutoSyncing,
        lastSyncTime,
        nextSyncTime,
        lastSyncResult,
        manualSync,
        workerStatus,
    } = useAutoSync({
        onSuccess: ({ queued, newRecordings }) => {
            if (queued) {
                toast.success(t("dashboard.syncQueued"));
                return;
            }

            const count = newRecordings ?? 0;
            if (count > 0) {
                setCurrentRecording(null);
            }
            startTransition(() => {
                refreshBrowserRoute(router);
            });
            toast.success(
                count > 0
                    ? t("dashboard.syncNewRecordings", {
                          count,
                          suffix: count !== 1 ? "s" : "",
                      })
                    : t("dashboard.syncCompleteNoNew"),
            );
        },
        onError: (error) => {
            toast.error(error);
        },
    });

    const handleSync = useCallback(async () => {
        await manualSync();
    }, [manualSync]);

    const handleTranscribe = useCallback(async () => {
        if (!currentRecording) return;
        if (!currentCanPrivateTranscribe) {
            toast.error(
                currentTranscribeUnavailableReason ??
                    t("dashboard.transcribeFailed"),
            );
            return;
        }

        setIsTranscribing(true);
        try {
            const response = await fetch(
                `/api/recordings/${currentRecording.id}/transcribe`,
                { method: "POST" },
            );

            const data = await response.json();
            if (!response.ok) {
                toast.error(data.error || t("dashboard.transcribeFailed"));
                return;
            }

            if (data.queued) {
                toast.success(t("dashboard.transcribeQueued"));
            } else {
                toast.success(t("dashboard.transcriptionAvailable"));
            }
            if (data.job) {
                setLiveTranscriptionJobs((previous) => {
                    const next = new Map(previous);
                    next.set(currentRecording.id, {
                        status: data.job.status ?? "pending",
                        remoteStatus: data.job.remoteStatus ?? null,
                        lastError: data.job.lastError ?? null,
                    });
                    return next;
                });
            }
            if (data.transcript) {
                setLiveTranscriptions((previous) => {
                    const next = new Map(previous);
                    next.set(currentRecording.id, {
                        text: data.transcript.text,
                        language: data.transcript.detectedLanguage ?? undefined,
                        speakerMap: data.transcript.speakerMap ?? undefined,
                        segments: data.transcript.segments ?? null,
                    });
                    return next;
                });
            }
        } catch {
            toast.error(t("transcription.failedToLoad"));
        } finally {
            setIsTranscribing(false);
        }
    }, [
        currentCanPrivateTranscribe,
        currentRecording,
        currentTranscribeUnavailableReason,
        t,
    ]);

    const handleRetranscribe = useCallback(async () => {
        if (!currentRecording) return;
        if (!currentCanPrivateTranscribe) {
            toast.error(
                currentTranscribeUnavailableReason ??
                    t("dashboard.retranscribeFailed"),
            );
            return;
        }

        setIsTranscribing(true);
        try {
            const response = await fetch(
                `/api/recordings/${currentRecording.id}/transcribe`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ force: true }),
                },
            );

            const data = await response.json();
            if (!response.ok) {
                toast.error(data.error || t("dashboard.retranscribeFailed"));
                return;
            }

            if (data.queued) {
                toast.success(t("dashboard.retranscribeQueued"));
            } else {
                toast.success(t("dashboard.transcriptionAvailable"));
            }
            if (data.job) {
                setLiveTranscriptionJobs((previous) => {
                    const next = new Map(previous);
                    next.set(currentRecording.id, {
                        status: data.job.status ?? "pending",
                        remoteStatus: data.job.remoteStatus ?? null,
                        lastError: data.job.lastError ?? null,
                    });
                    return next;
                });
            }
            if (data.transcript) {
                setLiveTranscriptions((previous) => {
                    const next = new Map(previous);
                    next.set(currentRecording.id, {
                        text: data.transcript.text,
                        language: data.transcript.detectedLanguage ?? undefined,
                        speakerMap: data.transcript.speakerMap ?? undefined,
                        segments: data.transcript.segments ?? null,
                    });
                    return next;
                });
            }
        } catch {
            toast.error(t("dashboard.retranscribeFailed"));
        } finally {
            setIsTranscribing(false);
        }
    }, [
        currentCanPrivateTranscribe,
        currentRecording,
        currentTranscribeUnavailableReason,
        t,
    ]);

    const handleRenameStart = useCallback(() => {
        if (!currentRecording) return;
        if (!canRenameCurrentRecording) return;
        setTagManagerOpen(false);
        setRenameValue(currentRecording.filename);
        setIsRenaming(true);
    }, [canRenameCurrentRecording, currentRecording]);

    const handleRenameCancel = useCallback(() => {
        setIsRenaming(false);
        setRenameValue("");
    }, []);

    const handleRenameSave = useCallback(async () => {
        if (!currentRecording) return;

        const newName = renameValue.trim();
        if (!newName || newName === currentRecording.filename) {
            handleRenameCancel();
            return;
        }

        setIsSavingRename(true);
        try {
            const response = await fetch(
                `/api/recordings/${currentRecording.id}/rename`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ filename: newName }),
                },
            );

            const data = await response.json();
            if (!response.ok) {
                toast.error(data.error || t("dashboard.renameFailed"));
                return;
            }

            setCurrentRecording((previous) =>
                previous ? { ...previous, filename: newName } : previous,
            );
            setLiveRecordings((previous) =>
                previous.map((recording) =>
                    recording.id === currentRecording.id
                        ? { ...recording, filename: newName }
                        : recording,
                ),
            );
            setIsRenaming(false);
            toast.success(t("dashboard.renameSuccess"));
            refreshBrowserRoute(router);
        } catch {
            toast.error(t("dashboard.renameFailed"));
        } finally {
            setIsSavingRename(false);
        }
    }, [currentRecording, handleRenameCancel, renameValue, router, t]);

    const handleAutoRename = useCallback(async () => {
        if (!currentRecording) return;
        if (!canAutoRenameCurrentRecording) {
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
                `/api/recordings/${currentRecording.id}/rename/auto`,
                { method: "POST" },
            );

            const data = await response.json();
            if (!response.ok) {
                toast.error(data.error || t("transcription.autoRenameFailed"));
                return;
            }

            const filename =
                typeof data.filename === "string"
                    ? data.filename
                    : currentRecording.filename;

            setCurrentRecording((previous) =>
                previous ? { ...previous, filename } : previous,
            );
            setLiveRecordings((previous) =>
                previous.map((recording) =>
                    recording.id === currentRecording.id
                        ? { ...recording, filename }
                        : recording,
                ),
            );
            setRenameValue(filename);
            toast.success(
                t("transcription.autoRenameSuccess", {
                    filename,
                }),
            );
            startTransition(() => {
                refreshBrowserRoute(router);
            });
        } catch {
            toast.error(t("transcription.autoRenameFailed"));
        } finally {
            setIsAutoRenaming(false);
        }
    }, [
        autoRenameDisabledReason,
        canAutoRenameCurrentRecording,
        confirm,
        currentRecording,
        router,
        t,
    ]);

    const handleDelete = useCallback(async () => {
        if (!currentRecording) return;

        const confirmed = await confirm({
            title: t("common.confirmAction"),
            description: t("dashboard.deleteConfirm", {
                filename: currentRecording.filename,
            }),
            confirmLabel: t("common.confirm"),
            cancelLabel: t("common.cancel"),
            variant: "destructive",
        });
        if (!confirmed) {
            return;
        }

        try {
            const response = await fetch(
                `/api/recordings/${currentRecording.id}`,
                { method: "DELETE" },
            );

            const data = await response.json();
            if (!response.ok) {
                toast.error(data.error || t("dashboard.deleteFailed"));
                return;
            }

            toast.success(t("dashboard.deleteSuccess"));
            setCurrentRecording(null);
            refreshBrowserRoute(router);
        } catch {
            toast.error(t("dashboard.deleteFailed"));
        }
    }, [confirm, currentRecording, router, t]);

    return (
        <>
            <div className="bg-transparent">
                <div className="container mx-auto max-w-7xl px-4 py-6">
                    <div className="mb-5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Logo className="size-10 shrink-0 text-primary" />
                            <h1 className="text-2xl font-semibold tracking-tight">
                                BetterAINote
                            </h1>
                        </div>
                        <div className="flex items-center gap-3">
                            <SyncStatus
                                autoSyncEnabled={autoSyncEnabled}
                                lastSyncTime={lastSyncTime}
                                nextSyncTime={nextSyncTime}
                                isAutoSyncing={isAutoSyncing}
                                lastSyncResult={lastSyncResult}
                                workerStatus={workerStatus}
                                className="hidden md:flex"
                            />
                            <Button
                                onClick={handleSync}
                                disabled={isAutoSyncing}
                                variant="outline"
                                size="sm"
                                className="h-9"
                            >
                                {isAutoSyncing ? (
                                    <>
                                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                        {t("dashboard.syncing")}
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw className="mr-2 h-4 w-4" />
                                        {t("dashboard.syncDevice")}
                                    </>
                                )}
                            </Button>
                            <Button
                                onClick={() => setSettingsOpen(true)}
                                variant="outline"
                                size="icon"
                                aria-label={t("settingsDialog.title")}
                            >
                                <Settings className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {liveRecordings.length === 0 ? (
                        <Card>
                            <CardContent className="flex flex-col items-center justify-center py-16">
                                <Mic className="mb-4 h-16 w-16 text-muted-foreground" />
                                <h3 className="mb-2 text-lg font-semibold">
                                    {t("dashboard.noRecordings")}
                                </h3>
                                <p className="mb-6 max-w-md text-center text-sm text-muted-foreground">
                                    {t("dashboard.noRecordingsDescription")}
                                </p>
                                <Button
                                    onClick={handleSync}
                                    disabled={isAutoSyncing}
                                >
                                    {isAutoSyncing ? (
                                        <>
                                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                            {t("dashboard.syncing")}
                                        </>
                                    ) : (
                                        <>
                                            <RefreshCw className="mr-2 h-4 w-4" />
                                            {t("dashboard.syncDevice")}
                                        </>
                                    )}
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 gap-6 lg:h-[calc(100svh-9rem)] lg:min-h-[680px] lg:grid-cols-3 lg:overflow-hidden">
                            <div className="min-h-0 lg:col-span-1">
                                <RecordingList
                                    recordings={liveRecordings}
                                    totalCount={liveRecordings.length}
                                    currentRecording={currentRecording}
                                    transcriptionJobs={liveTranscriptionJobs}
                                    onSelect={(recording) => {
                                        setTagManagerOpen(false);
                                        setCurrentRecording(recording);
                                    }}
                                />
                            </div>

                            <div className="flex min-h-0 flex-col gap-4 lg:col-span-2">
                                {currentRecording ? (
                                    <>
                                        <div className="shrink-0 flex flex-col gap-3">
                                            <div className="flex items-center gap-3">
                                                {isRenaming ? (
                                                    <div className="flex flex-1 items-center gap-2">
                                                        <Input
                                                            value={renameValue}
                                                            onChange={(event) =>
                                                                setRenameValue(
                                                                    event.target
                                                                        .value,
                                                                )
                                                            }
                                                            onKeyDown={(
                                                                event,
                                                            ) => {
                                                                if (
                                                                    event.key ===
                                                                    "Enter"
                                                                ) {
                                                                    handleRenameSave();
                                                                }
                                                                if (
                                                                    event.key ===
                                                                    "Escape"
                                                                ) {
                                                                    handleRenameCancel();
                                                                }
                                                            }}
                                                            className="h-auto py-1 text-lg font-semibold"
                                                            autoFocus
                                                            disabled={
                                                                isSavingRename
                                                            }
                                                        />
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={
                                                                handleAutoRename
                                                            }
                                                            disabled={
                                                                !canAutoRenameCurrentRecording
                                                            }
                                                            title={
                                                                autoRenameDisabledReason ??
                                                                t(
                                                                    "transcription.aiRename",
                                                                )
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
                                                                {t(
                                                                    "transcription.aiRename",
                                                                )}
                                                            </span>
                                                        </Button>
                                                        <Button
                                                            size="icon"
                                                            variant="outline"
                                                            onClick={
                                                                handleRenameSave
                                                            }
                                                            disabled={
                                                                isSavingRename
                                                            }
                                                            title={t(
                                                                "recording.saveRename",
                                                            )}
                                                            className="h-10 w-10 shrink-0 rounded-full border-emerald-500/30 bg-emerald-500/10 text-emerald-700 shadow-none hover:bg-emerald-500/15 dark:text-emerald-200"
                                                        >
                                                            <CheckCircle className="h-5 w-5" />
                                                        </Button>
                                                        <Button
                                                            size="icon"
                                                            variant="outline"
                                                            onClick={
                                                                handleRenameCancel
                                                            }
                                                            disabled={
                                                                isSavingRename
                                                            }
                                                            title={t(
                                                                "recording.cancelRename",
                                                            )}
                                                            className="h-10 w-10 shrink-0 rounded-full border-border/60 bg-background/30 shadow-none backdrop-blur-xl hover:bg-background/50"
                                                        >
                                                            <X className="h-5 w-5" />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <h2 className="flex-1 truncate text-lg font-semibold">
                                                            {
                                                                currentRecording.filename
                                                            }
                                                        </h2>
                                                        {currentRecording.upstreamDeleted && (
                                                            <span className="inline-flex shrink-0 items-center gap-1 rounded bg-amber-500/20 px-2 py-1 text-xs font-medium text-amber-400">
                                                                <CloudOff className="h-3 w-3" />
                                                                {t(
                                                                    "dashboard.localOnly",
                                                                )}
                                                            </span>
                                                        )}
                                                        {canRenameCurrentRecording ? (
                                                            <Button
                                                                size="icon"
                                                                variant="outline"
                                                                onClick={
                                                                    handleRenameStart
                                                                }
                                                                title={
                                                                    currentRenameActionLabel
                                                                }
                                                                className="shrink-0"
                                                            >
                                                                <Pencil className="h-4 w-4" />
                                                            </Button>
                                                        ) : null}
                                                        {currentRecording.upstreamDeleted && (
                                                            <Button
                                                                size="icon"
                                                                variant="outline"
                                                                onClick={
                                                                    handleDelete
                                                                }
                                                                title={t(
                                                                    "dashboard.deleteLocalRecording",
                                                                )}
                                                                className="shrink-0 text-destructive hover:text-destructive"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                            <RecordingPlayer
                                                recording={currentRecording}
                                                tags={currentRecording.tags}
                                                isTagManagerOpen={
                                                    tagManagerOpen
                                                }
                                                onToggleTagManager={() =>
                                                    setTagManagerOpen(
                                                        (open) => !open,
                                                    )
                                                }
                                                tagManagerPanel={
                                                    <RecordingTagManager
                                                        variant="popover"
                                                        recording={
                                                            currentRecording
                                                        }
                                                        availableTags={
                                                            tagCatalog
                                                        }
                                                        onAvailableTagsChange={
                                                            setTagCatalog
                                                        }
                                                        onRecordingTagsChange={
                                                            applyRecordingTags
                                                        }
                                                    />
                                                }
                                                onEnded={() => {
                                                    const index =
                                                        liveRecordings.findIndex(
                                                            (recording) =>
                                                                recording.id ===
                                                                currentRecording.id,
                                                        );
                                                    if (
                                                        index >= 0 &&
                                                        index <
                                                            liveRecordings.length -
                                                                1
                                                    ) {
                                                        setTagManagerOpen(
                                                            false,
                                                        );
                                                        setCurrentRecording(
                                                            liveRecordings[
                                                                index + 1
                                                            ],
                                                        );
                                                    }
                                                }}
                                            />
                                        </div>

                                        <div className="flex min-h-0 flex-1 flex-col">
                                            <TranscriptionPanel
                                                recording={currentRecording}
                                                transcription={
                                                    currentTranscription
                                                }
                                                transcriptionJob={
                                                    currentTranscriptionJob
                                                }
                                                isTranscriptLoading={
                                                    isCurrentTranscriptLoading
                                                }
                                                onTranscribe={handleTranscribe}
                                                onRetranscribe={
                                                    handleRetranscribe
                                                }
                                                className="min-h-0 flex-1"
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <Card>
                                        <CardContent className="py-16 text-center">
                                            <p className="text-muted-foreground">
                                                {t("dashboard.selectRecording")}
                                            </p>
                                        </CardContent>
                                    </Card>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <SettingsDialog
                open={settingsOpen}
                onOpenChange={setSettingsOpen}
            />
        </>
    );
}
