"use client";

import {
    AlertCircle,
    Copy,
    FileText,
    Languages,
    RefreshCw,
    Sparkles,
    X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/components/language-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty";
import { FieldDescription } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { SpeakerLabelEditor } from "@/features/recordings/components/speaker-label-editor";
import {
    startBrowserInterval,
    stopBrowserInterval,
} from "@/lib/platform/browser-shell";
import { writeBrowserClipboardText } from "@/lib/platform/clipboard";
import {
    getTranscriptionJobDisplayState,
    isActiveTranscriptionJob,
} from "@/lib/transcription/job-display";

interface TranscriptionSectionProps {
    recordingId: string;
    canTranscribe?: boolean;
    transcribeUnavailableReason?: string | null;
    initialTranscription?: string;
    initialLanguage?: string;
    initialType?: string;
    initialSpeakerMap?: Record<string, string> | null;
    initialJobStatus?: string;
    initialJobRemoteStatus?: string | null;
    initialJobError?: string | null;
    showSpeakerReview?: boolean;
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
    initialTranscription,
    initialLanguage,
    initialType,
    initialSpeakerMap,
    initialJobStatus,
    initialJobRemoteStatus,
    initialJobError,
    showSpeakerReview = true,
}: TranscriptionSectionProps) {
    const { language: uiLanguage, t } = useLanguage();
    const confirm = useConfirmDialog();
    const [transcription, setTranscription] = useState(
        initialTranscription ?? "",
    );
    const [language, setLanguage] = useState(initialLanguage);
    const [transcriptionType, setTranscriptionType] = useState(initialType);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [jobStatus, setJobStatus] = useState(initialJobStatus ?? null);
    const [jobRemoteStatus, setJobRemoteStatus] = useState(
        initialJobRemoteStatus ?? null,
    );
    const [jobError, setJobError] = useState(initialJobError ?? null);
    const [liveSpeakerMap, setLiveSpeakerMap] = useState(
        initialSpeakerMap ?? null,
    );
    const [isCopyingTranscript, setIsCopyingTranscript] = useState(false);

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

    const handleConfirmRetranscribe = useCallback(async () => {
        if (!canTranscribe) return;
        const confirmed = await confirm({
            title: t("transcription.retranscribeConfirmTitle"),
            description: t("transcription.retranscribeConfirmDescription"),
            surface: "recording-retranscribe",
            details: [
                t("transcription.retranscribeConfirmDetailTranscript"),
                t("transcription.retranscribeConfirmDetailSpeakers"),
                t("transcription.retranscribeConfirmDetailSource"),
            ],
            confirmLabel: t("transcription.retranscribeConfirmLabel"),
            cancelLabel: t("common.cancel"),
        });
        if (!confirmed) return;
        void handleTranscribe(true);
    }, [canTranscribe, confirm, handleTranscribe, t]);
    const handleRetryTranscription = useCallback(() => {
        void handleTranscribe(Boolean(transcription.trim()));
    }, [handleTranscribe, transcription]);

    const wordCount = useMemo(() => {
        const trimmed = transcription.trim();
        return trimmed ? trimmed.split(/\s+/).length : 0;
    }, [transcription]);
    const displayText = useMemo(
        () => applySpeakerMap(transcription, liveSpeakerMap),
        [liveSpeakerMap, transcription],
    );
    const handleCopyTranscript = useCallback(async () => {
        if (!displayText.trim()) {
            toast.error(t("transcription.noTranscript"));
            return;
        }

        setIsCopyingTranscript(true);
        try {
            await writeBrowserClipboardText(displayText);
            toast.success(t("transcription.transcriptCopied"));
        } catch {
            toast.error(t("transcription.copyTranscriptFailed"));
        } finally {
            setIsCopyingTranscript(false);
        }
    }, [displayText, t]);
    const jobDisplayState = getTranscriptionJobDisplayState({
        status: jobStatus,
        remoteStatus: jobRemoteStatus,
    });
    const transcriptionState = isTranscribing
        ? "loading"
        : jobError
          ? "failed"
          : transcription.trim()
            ? "ready"
            : "empty";

    return (
        <Card
            hasNoPadding
            role="region"
            aria-labelledby="recording-transcription-title"
            aria-busy={isTranscribing || undefined}
            className="min-h-0 flex-1 gap-0"
            data-control="recording-transcription"
            data-state={transcriptionState}
        >
            <CardHeader className="flex flex-row items-center gap-3 py-4">
                <div className="flex min-w-0 items-center gap-3">
                    <FileText
                        className="size-4 flex-none text-muted-foreground"
                        aria-hidden="true"
                    />
                    <div className="flex min-w-0 flex-col gap-1">
                        <CardTitle className="min-w-0">
                            <h2
                                id="recording-transcription-title"
                                className="truncate text-base"
                            >
                                {t("transcription.localTitle")}
                            </h2>
                        </CardTitle>
                        <CardDescription>
                            {t("transcription.localDescription")}
                        </CardDescription>
                        {!canTranscribe && (
                            <FieldDescription>
                                {transcribeUnavailableReason ??
                                    (uiLanguage === "zh-CN"
                                        ? "这个数据源没有可下载到本地的音频文件，当前只能查看来源逐字稿或报告。"
                                        : "This source does not provide downloadable local audio. You can only review the source transcript or report for now.")}
                            </FieldDescription>
                        )}
                    </div>
                </div>
            </CardHeader>
            <Separator />
            <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-4">
                {isTranscribing ? (
                    <Alert density="comfortable" data-state="loading">
                        <Spinner aria-hidden="true" />
                        <AlertTitle className="line-clamp-none overflow-visible">
                            {jobDisplayState
                                ? t(`transcription.${jobDisplayState}`)
                                : t("transcription.processing")}
                        </AlertTitle>
                    </Alert>
                ) : null}

                {!!jobError &&
                    !isActiveTranscriptionJob({
                        status: jobStatus,
                        remoteStatus: jobRemoteStatus,
                    }) && (
                        <Alert
                            variant="statusError"
                            density="comfortable"
                            data-state="failed"
                        >
                            <AlertCircle aria-hidden="true" />
                            <AlertTitle className="line-clamp-none overflow-visible">
                                {jobError}
                            </AlertTitle>
                            <AlertDescription className="mt-2 flex flex-row flex-wrap items-center gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    data-control="recording-transcript-retry"
                                    onClick={handleRetryTranscription}
                                    disabled={!canTranscribe || isTranscribing}
                                    aria-busy={isTranscribing}
                                    title={
                                        !canTranscribe
                                            ? (transcribeUnavailableReason ??
                                              undefined)
                                            : undefined
                                    }
                                >
                                    <RefreshCw
                                        aria-hidden="true"
                                        data-icon="inline-start"
                                    />
                                    {t("common.retry")}
                                </Button>
                                <Button
                                    type="button"
                                    size="icon-sm"
                                    variant="ghost"
                                    data-control="recording-transcript-dismiss-error"
                                    aria-label={
                                        uiLanguage === "zh-CN"
                                            ? "收起转写错误"
                                            : "Dismiss transcription error"
                                    }
                                    onClick={() => setJobError(null)}
                                >
                                    <X aria-hidden="true" />
                                </Button>
                            </AlertDescription>
                        </Alert>
                    )}

                {transcription ? (
                    <>
                        <section className="grid gap-4" data-state="ready">
                            <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <h3 className="text-sm font-semibold text-foreground">
                                        {t("transcription.outputTitle")}
                                    </h3>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        {t("transcription.outputDescription")}
                                    </p>
                                </div>
                                <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
                                    <Button
                                        onClick={handleCopyTranscript}
                                        size="sm"
                                        variant="outline"
                                        data-control="recording-transcript-copy"
                                        disabled={
                                            isCopyingTranscript ||
                                            !displayText.trim()
                                        }
                                        aria-busy={isCopyingTranscript}
                                    >
                                        <Copy
                                            aria-hidden="true"
                                            data-icon="inline-start"
                                        />
                                        {isCopyingTranscript
                                            ? t("common.copying")
                                            : t("transcription.copyTranscript")}
                                    </Button>
                                    <Button
                                        onClick={handleConfirmRetranscribe}
                                        size="sm"
                                        variant="destructive"
                                        data-control="recording-transcript-retranscribe"
                                        disabled={
                                            !canTranscribe || isTranscribing
                                        }
                                        aria-busy={isTranscribing}
                                        title={
                                            !canTranscribe
                                                ? (transcribeUnavailableReason ??
                                                  undefined)
                                                : t(
                                                      "transcription.retranscribeConfirm",
                                                  )
                                        }
                                    >
                                        <RefreshCw
                                            aria-hidden="true"
                                            data-icon="inline-start"
                                        />
                                        {t("transcription.retranscribe")}
                                    </Button>
                                </div>
                            </header>
                            <div className="py-2">
                                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
                                    {displayText}
                                </p>
                            </div>
                            <Separator />
                            <div className="flex flex-wrap items-center gap-2 pt-2">
                                {language ? (
                                    <Badge variant="outline">
                                        <Languages aria-hidden="true" />
                                        <span>
                                            {t("transcription.languagePrefix")}:{" "}
                                            {language}
                                        </span>
                                    </Badge>
                                ) : null}
                                {transcriptionType ? (
                                    <Badge variant="outline">
                                        {t("transcription.sourcePrefix")}:{" "}
                                        {transcriptionType}
                                    </Badge>
                                ) : null}
                                <Badge variant="secondary">
                                    {wordCount} {t("transcription.words")}
                                </Badge>
                                <Badge variant="secondary">
                                    {transcription.length}{" "}
                                    {t("transcription.characters")}
                                </Badge>
                            </div>
                        </section>
                        {showSpeakerReview ? (
                            <>
                                <Separator className="my-2" />
                                <section className="grid gap-4">
                                    <header>
                                        <div>
                                            <h3 className="text-sm font-semibold text-foreground">
                                                {t("speakerReview.title")}
                                            </h3>
                                            <p className="mt-1 text-sm text-muted-foreground">
                                                {t("speakerReview.description")}
                                            </p>
                                        </div>
                                    </header>
                                    <SpeakerLabelEditor
                                        recordingId={recordingId}
                                        speakerMap={liveSpeakerMap}
                                        onSpeakerMapChanged={setLiveSpeakerMap}
                                    />
                                </section>
                            </>
                        ) : null}
                    </>
                ) : (
                    <Empty data-state="empty">
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <FileText aria-hidden="true" />
                            </EmptyMedia>
                            <EmptyTitle>
                                {t("transcription.noTranscript")}
                            </EmptyTitle>
                            <EmptyDescription>
                                {t("transcription.noTranscriptDescription")}
                            </EmptyDescription>
                        </EmptyHeader>
                        <EmptyContent>
                            <Button
                                onClick={() => handleTranscribe(false)}
                                size="sm"
                                variant="default"
                                data-control="recording-transcript-transcribe"
                                disabled={!canTranscribe || isTranscribing}
                                title={
                                    !canTranscribe
                                        ? (transcribeUnavailableReason ??
                                          undefined)
                                        : undefined
                                }
                            >
                                <Sparkles
                                    aria-hidden="true"
                                    data-icon="inline-start"
                                />
                                {t("transcription.transcribe")}
                            </Button>
                        </EmptyContent>
                    </Empty>
                )}
            </CardContent>
        </Card>
    );
}
