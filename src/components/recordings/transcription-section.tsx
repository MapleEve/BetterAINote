"use client";

import { FileText, Languages, RefreshCw, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { SpeakerLabelEditor } from "@/components/dashboard/speaker-label-editor";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    reloadBrowserWindow,
    startBrowserInterval,
    stopBrowserInterval,
} from "@/lib/platform/browser-shell";
import {
    getTranscriptionJobDisplayState,
    isActiveTranscriptionJob,
} from "@/lib/transcription/job-display";

interface TranscriptionSectionProps {
    recordingId: string;
    canTranscribe?: boolean;
    transcribeUnavailableReason?: string | null;
    canRename?: boolean;
    renameUnavailableReason?: string | null;
    renameBehaviorHint?: string | null;
    initialTranscription?: string;
    initialLanguage?: string;
    initialType?: string;
    initialSpeakerMap?: Record<string, string> | null;
    initialJobStatus?: string;
    initialJobRemoteStatus?: string | null;
    initialJobError?: string | null;
}

function applySpeakerMap(
    text: string,
    speakerMap: Record<string, string> | null | undefined,
): string {
    if (!speakerMap || Object.keys(speakerMap).length === 0) return text;

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

export function TranscriptionSection({
    recordingId,
    canTranscribe = true,
    transcribeUnavailableReason,
    canRename = true,
    renameUnavailableReason,
    renameBehaviorHint,
    initialTranscription,
    initialLanguage,
    initialType,
    initialSpeakerMap,
    initialJobStatus,
    initialJobRemoteStatus,
    initialJobError,
}: TranscriptionSectionProps) {
    const { language: uiLanguage, t } = useLanguage();
    const [transcription, setTranscription] = useState(
        initialTranscription ?? "",
    );
    const [language, setLanguage] = useState(initialLanguage);
    const [transcriptionType, setTranscriptionType] = useState(initialType);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [isAutoRenaming, setIsAutoRenaming] = useState(false);
    const [jobStatus, setJobStatus] = useState(initialJobStatus ?? null);
    const [jobRemoteStatus, setJobRemoteStatus] = useState(
        initialJobRemoteStatus ?? null,
    );
    const [jobError, setJobError] = useState(initialJobError ?? null);
    const [liveSpeakerMap, setLiveSpeakerMap] = useState(
        initialSpeakerMap ?? null,
    );

    useEffect(() => {
        setTranscription(initialTranscription ?? "");
        setLanguage(initialLanguage);
        setTranscriptionType(initialType);
        setLiveSpeakerMap(initialSpeakerMap ?? null);
        setJobStatus(initialJobStatus ?? null);
        setJobRemoteStatus(initialJobRemoteStatus ?? null);
        setJobError(initialJobError ?? null);
    }, [
        initialJobError,
        initialJobRemoteStatus,
        initialJobStatus,
        initialLanguage,
        initialSpeakerMap,
        initialTranscription,
        initialType,
    ]);

    useEffect(() => {
        setIsTranscribing(
            isActiveTranscriptionJob({
                status: jobStatus,
                remoteStatus: jobRemoteStatus,
            }),
        );
    }, [jobRemoteStatus, jobStatus]);

    useEffect(() => {
        if (
            !isActiveTranscriptionJob({
                status: jobStatus,
                remoteStatus: jobRemoteStatus,
            })
        ) {
            return;
        }

        let cancelled = false;
        const poll = async () => {
            try {
                const response = await fetch(
                    `/api/recordings/${recordingId}/transcribe`,
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

                if (data?.transcript) {
                    setTranscription(data.transcript.text || "");
                    setLanguage(data.transcript.detectedLanguage || undefined);
                    setTranscriptionType(
                        data.transcript.transcriptionType || "private",
                    );
                    setLiveSpeakerMap(data.transcript.speakerMap ?? null);
                    setJobStatus(data.job?.status ?? "succeeded");
                    setJobError(null);
                    return;
                }

                if (data?.job) {
                    setJobStatus(data.job.status ?? null);
                    setJobRemoteStatus(data.job.remoteStatus ?? null);
                    setJobError(data.job.lastError ?? null);
                }
            } catch {
                // Ignore polling errors and retry on the next interval.
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
    }, [jobRemoteStatus, jobStatus, recordingId]);

    const handleTranscribe = useCallback(
        async (force = false) => {
            if (!canTranscribe) {
                toast.error(
                    transcribeUnavailableReason ??
                        t("transcription.failedToLoad"),
                );
                return;
            }

            setIsTranscribing(true);
            try {
                const response = await fetch(
                    `/api/recordings/${recordingId}/transcribe`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(force ? { force: true } : {}),
                    },
                );

                const data = await response.json();
                if (!response.ok) {
                    toast.error(data.error || t("dashboard.transcribeFailed"));
                    return;
                }

                setJobStatus(data.job?.status ?? "pending");
                setJobRemoteStatus(data.job?.remoteStatus ?? null);
                setJobError(null);
                toast.success(
                    force
                        ? t("transcription.requeuedSuccess")
                        : t("transcription.queuedSuccess"),
                );
            } catch {
                toast.error(t("transcription.failedToLoad"));
            } finally {
                setIsTranscribing(false);
            }
        },
        [canTranscribe, recordingId, t, transcribeUnavailableReason],
    );

    const handleAutoRename = useCallback(async () => {
        if (!canRename) {
            toast.error(
                renameUnavailableReason ?? t("transcription.autoRenameFailed"),
            );
            return;
        }

        setIsAutoRenaming(true);
        try {
            const response = await fetch(
                `/api/recordings/${recordingId}/rename/auto`,
                { method: "POST" },
            );
            const data = await response.json();
            if (!response.ok) {
                toast.error(data.error || t("transcription.autoRenameFailed"));
                return;
            }

            toast.success(
                t("transcription.autoRenameSuccess", {
                    filename: data.filename,
                }),
            );
            reloadBrowserWindow();
        } catch {
            toast.error(t("transcription.autoRenameFailed"));
        } finally {
            setIsAutoRenaming(false);
        }
    }, [canRename, recordingId, renameUnavailableReason, t]);

    const wordCount = useMemo(() => {
        const trimmed = transcription.trim();
        return trimmed ? trimmed.split(/\s+/).length : 0;
    }, [transcription]);
    const displayText = useMemo(
        () => applySpeakerMap(transcription, liveSpeakerMap),
        [liveSpeakerMap, transcription],
    );
    const jobDisplayState = getTranscriptionJobDisplayState({
        status: jobStatus,
        remoteStatus: jobRemoteStatus,
    });

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col gap-3">
                    <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            {t("transcription.localTitle")}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                            {t("transcription.localDescription")}
                        </p>
                        {!canTranscribe && (
                            <p className="text-sm text-muted-foreground">
                                {transcribeUnavailableReason ??
                                    (uiLanguage === "zh-CN"
                                        ? "这个数据源没有可下载到本地的音频文件，当前只能查看来源逐字稿或报告。"
                                        : "This source does not provide downloadable local audio. You can only review the source transcript or report for now.")}
                            </p>
                        )}
                        {(renameUnavailableReason || renameBehaviorHint) && (
                            <p className="text-sm text-muted-foreground">
                                {renameUnavailableReason ?? renameBehaviorHint}
                            </p>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="rounded-xl border border-white/10 bg-background/25 p-4">
                    <div className="flex flex-col gap-1">
                        <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
                            {t("transcription.actionsTitle")}
                        </p>
                        <p className="text-sm text-muted-foreground">
                            {t("transcription.actionsDescription")}
                        </p>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                        {transcription ? (
                            <Button
                                onClick={() => handleTranscribe(true)}
                                size="sm"
                                variant="outline"
                                disabled={
                                    !canTranscribe ||
                                    isTranscribing ||
                                    isAutoRenaming
                                }
                                title={
                                    !canTranscribe
                                        ? (transcribeUnavailableReason ??
                                          undefined)
                                        : undefined
                                }
                            >
                                <RefreshCw className="mr-2 h-4 w-4" />
                                {t("transcription.retranscribe")}
                            </Button>
                        ) : (
                            <Button
                                onClick={() => handleTranscribe(false)}
                                size="sm"
                                disabled={!canTranscribe || isTranscribing}
                                title={
                                    !canTranscribe
                                        ? (transcribeUnavailableReason ??
                                          undefined)
                                        : undefined
                                }
                            >
                                <Sparkles className="mr-2 h-4 w-4" />
                                {t("transcription.transcribe")}
                            </Button>
                        )}
                        <Button
                            onClick={handleAutoRename}
                            size="sm"
                            variant="outline"
                            disabled={
                                !transcription ||
                                !canRename ||
                                isTranscribing ||
                                isAutoRenaming
                            }
                            title={
                                !canRename
                                    ? (renameUnavailableReason ?? undefined)
                                    : (renameBehaviorHint ?? undefined)
                            }
                        >
                            <Sparkles className="mr-2 h-4 w-4" />
                            {isAutoRenaming
                                ? t("transcription.renaming")
                                : t("transcription.aiRename")}
                        </Button>
                    </div>
                </div>

                {isTranscribing ? (
                    <div className="flex items-center gap-3 rounded-lg border px-4 py-3 text-sm text-muted-foreground">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        <span>
                            {jobDisplayState
                                ? t(`transcription.${jobDisplayState}`)
                                : t("transcription.processing")}
                        </span>
                    </div>
                ) : null}

                {!!jobError &&
                    !isActiveTranscriptionJob({
                        status: jobStatus,
                        remoteStatus: jobRemoteStatus,
                    }) && (
                        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                            {jobError}
                        </div>
                    )}

                {transcription ? (
                    <>
                        <div className="rounded-xl border border-white/10 bg-background/25 p-4">
                            <div className="flex flex-col gap-1">
                                <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
                                    {t("transcription.outputTitle")}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    {t("transcription.outputDescription")}
                                </p>
                            </div>
                            <div className="mt-4 max-h-[28rem] overflow-y-auto rounded-lg bg-muted p-4">
                                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                                    {displayText}
                                </p>
                            </div>
                            <div className="mt-4 flex flex-wrap items-center gap-4 border-t pt-3 text-xs text-muted-foreground">
                                {language ? (
                                    <div className="flex items-center gap-1">
                                        <Languages className="h-3 w-3" />
                                        <span>
                                            {t("transcription.languagePrefix")}:{" "}
                                            {language}
                                        </span>
                                    </div>
                                ) : null}
                                {transcriptionType ? (
                                    <div>
                                        {t("transcription.sourcePrefix")}:{" "}
                                        {transcriptionType}
                                    </div>
                                ) : null}
                                <div>
                                    {wordCount} {t("transcription.words")}
                                </div>
                                <div>
                                    {transcription.length}{" "}
                                    {t("transcription.characters")}
                                </div>
                            </div>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-background/25 p-4">
                            <div className="flex flex-col gap-1">
                                <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
                                    {t("speakerReview.title")}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    {t("speakerReview.description")}
                                </p>
                            </div>
                            <div className="mt-4">
                                <SpeakerLabelEditor
                                    recordingId={recordingId}
                                    speakerMap={liveSpeakerMap}
                                    onSpeakerMapChanged={setLiveSpeakerMap}
                                />
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
                        <p className="mb-2 text-sm text-muted-foreground">
                            {t("transcription.noTranscript")}
                        </p>
                        <p className="max-w-md text-xs text-muted-foreground">
                            {t("transcription.noTranscriptDescription")}
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
