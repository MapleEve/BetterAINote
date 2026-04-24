"use client";

import {
    CheckCircle,
    CloudOff,
    Mic,
    Pencil,
    RefreshCw,
    Settings,
    Trash2,
    X,
} from "lucide-react";
import { startTransition, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/components/language-provider";
import { SettingsDialog } from "@/components/settings-dialog";
import { SyncStatus } from "@/components/sync-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
    confirmInBrowser,
    startBrowserInterval,
    stopBrowserInterval,
} from "@/lib/platform/browser-shell";
import { isActiveTranscriptionJob } from "@/lib/transcription/job-display";
import type { Recording } from "@/types/recording";
import { RecordingList } from "./recording-list";
import { RecordingPlayer } from "./recording-player";
import { TranscriptionPanel } from "./transcription-panel";

interface TranscriptionData {
    text?: string;
    language?: string;
    speakerMap?: Record<string, string>;
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
    const router = useBrowserRouteController();

    const [currentRecording, setCurrentRecording] = useState<Recording | null>(
        recordings[0] ?? null,
    );
    const [, setIsTranscribing] = useState(false);
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState("");
    const [isSavingRename, setIsSavingRename] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [liveTranscriptions, setLiveTranscriptions] = useState(
        () => new Map(transcriptions),
    );
    const [liveTranscriptionJobs, setLiveTranscriptionJobs] = useState(
        () => new Map(transcriptionJobs),
    );

    const currentTranscription = currentRecording
        ? liveTranscriptions.get(currentRecording.id)
        : undefined;
    const currentTranscriptionJob = currentRecording
        ? liveTranscriptionJobs.get(currentRecording.id)
        : undefined;
    const canRenameCurrentRecording = currentRecording
        ? canRecordingRename(currentRecording.sourceProvider)
        : false;
    const currentRenameActionLabel = currentRecording
        ? t(getRecordingRenameActionKey(currentRecording.sourceProvider))
        : t("dashboard.renameRecording");
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
            setIsRenaming(false);
            toast.success(t("dashboard.renameSuccess"));
            refreshBrowserRoute(router);
        } catch {
            toast.error(t("dashboard.renameFailed"));
        } finally {
            setIsSavingRename(false);
        }
    }, [currentRecording, handleRenameCancel, renameValue, router, t]);

    const handleDelete = useCallback(async () => {
        if (!currentRecording) return;

        if (
            !confirmInBrowser(
                t("dashboard.deleteConfirm", {
                    filename: currentRecording.filename,
                }),
            )
        ) {
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
    }, [currentRecording, router, t]);

    return (
        <>
            <div className="bg-transparent">
                <div className="container mx-auto max-w-7xl px-4 py-6">
                    <div className="mb-6 flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold">
                                {t("dashboard.recordings")}
                            </h1>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {recordings.length}{" "}
                                {t("dashboard.recordingCountSuffix")}
                            </p>
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
                            >
                                <Settings className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {recordings.length === 0 ? (
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
                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                            <div className="lg:col-span-1">
                                <RecordingList
                                    recordings={recordings}
                                    currentRecording={currentRecording}
                                    onSelect={setCurrentRecording}
                                />
                            </div>

                            <div className="space-y-6 lg:col-span-2">
                                {currentRecording ? (
                                    <>
                                        <div className="flex flex-col gap-2">
                                            <div className="flex flex-col gap-1">
                                                <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
                                                    {t(
                                                        "dashboard.currentRecordingTitle",
                                                    )}
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    {t(
                                                        "dashboard.currentRecordingDescription",
                                                    )}
                                                </p>
                                            </div>
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
                                                            size="icon"
                                                            variant="ghost"
                                                            onClick={
                                                                handleRenameSave
                                                            }
                                                            disabled={
                                                                isSavingRename
                                                            }
                                                        >
                                                            <CheckCircle className="h-5 w-5 text-green-500" />
                                                        </Button>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            onClick={
                                                                handleRenameCancel
                                                            }
                                                            disabled={
                                                                isSavingRename
                                                            }
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
                                                onEnded={() => {
                                                    const index =
                                                        recordings.findIndex(
                                                            (recording) =>
                                                                recording.id ===
                                                                currentRecording.id,
                                                        );
                                                    if (
                                                        index >= 0 &&
                                                        index <
                                                            recordings.length -
                                                                1
                                                    ) {
                                                        setCurrentRecording(
                                                            recordings[
                                                                index + 1
                                                            ],
                                                        );
                                                    }
                                                }}
                                            />
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            <div className="flex flex-col gap-1">
                                                <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
                                                    {t(
                                                        "dashboard.transcriptWorkspaceTitle",
                                                    )}
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    {t(
                                                        "dashboard.transcriptWorkspaceDescription",
                                                    )}
                                                </p>
                                            </div>
                                            <TranscriptionPanel
                                                recording={currentRecording}
                                                transcription={
                                                    currentTranscription
                                                }
                                                transcriptionJob={
                                                    currentTranscriptionJob
                                                }
                                                onTranscribe={handleTranscribe}
                                                onRetranscribe={
                                                    handleRetranscribe
                                                }
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
