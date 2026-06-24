"use client";

import {
    AlertCircle,
    Copy,
    FileText,
    Languages,
    RefreshCw,
    Sparkles,
} from "lucide-react";
import {
    type ComponentProps,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";
import { toast } from "sonner";
import { useLanguage } from "@/components/language-provider";
import { Alert, AlertTitle } from "@/components/ui/alert";
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
import { cn } from "@/lib/utils";

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

const RECORDING_TRANSCRIPTION_META_BADGE_CLASS_NAME =
    "h-[22px] justify-normal gap-[5px] rounded-full border px-[8px] py-0 text-[11px] font-semibold leading-normal data-[sot-tone=attribute]:border-border data-[sot-tone=attribute]:bg-background data-[sot-tone=attribute]:text-[var(--fg-primary)] data-[sot-tone=measure]:border-transparent data-[sot-tone=measure]:bg-secondary data-[sot-tone=measure]:text-secondary-foreground [&>svg]:size-3";

function RecordingTranscriptionMetaBadge({
    className,
    ...props
}: Omit<ComponentProps<typeof Badge>, "variant">) {
    return (
        <Badge
            variant="outline"
            className={cn(
                RECORDING_TRANSCRIPTION_META_BADGE_CLASS_NAME,
                className,
            )}
            {...props}
        />
    );
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

    return (
        <Card
            hasNoPadding
            role="region"
            aria-labelledby="recording-transcription-title"
            className="min-h-0 flex-1 gap-0"
            data-sot-panel="recording-transcription"
        >
            <CardHeader
                className="flex flex-row items-center gap-3 border-b px-3.5 py-3"
                data-sot-part="recording-transcription-header"
            >
                <div data-sot-part="recording-transcription-heading">
                    <FileText
                        aria-hidden="true"
                        data-sot-part="recording-transcription-icon"
                    />
                    <div data-sot-part="recording-transcription-header-copy">
                        <CardTitle
                            className="min-w-0"
                            data-sot-part="recording-transcription-title"
                        >
                            <h2
                                id="recording-transcription-title"
                                className="m-0 truncate text-xl"
                            >
                                {t("transcription.localTitle")}
                            </h2>
                        </CardTitle>
                        <CardDescription
                            className="text-xs leading-normal font-medium"
                            data-sot-part="recording-transcription-description"
                        >
                            {t("transcription.localDescription")}
                        </CardDescription>
                        {!canTranscribe && (
                            <FieldDescription
                                className="text-xs leading-normal font-medium"
                                data-sot-part="recording-transcription-unavailable"
                            >
                                {transcribeUnavailableReason ??
                                    (uiLanguage === "zh-CN"
                                        ? "这个数据源没有可下载到本地的音频文件，当前只能查看来源逐字稿或报告。"
                                        : "This source does not provide downloadable local audio. You can only review the source transcript or report for now.")}
                            </FieldDescription>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent
                className="min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-6"
                data-sot-part="recording-transcription-body"
            >
                {isTranscribing ? (
                    <Alert
                        className="mb-3"
                        data-sot-banner="transcription-job"
                        data-sot-state="processing"
                        data-sot-tone="info"
                    >
                        <RefreshCw
                            className="animate-spin"
                            data-sot-banner-icon
                            data-sot-banner-spinner
                            aria-hidden="true"
                        />
                        <div data-sot-banner-body>
                            <AlertTitle
                                className="line-clamp-none overflow-visible"
                                data-sot-banner-title
                            >
                                {jobDisplayState
                                    ? t(`transcription.${jobDisplayState}`)
                                    : t("transcription.processing")}
                            </AlertTitle>
                        </div>
                    </Alert>
                ) : null}

                {!!jobError &&
                    !isActiveTranscriptionJob({
                        status: jobStatus,
                        remoteStatus: jobRemoteStatus,
                    }) && (
                        <Alert
                            variant="statusError"
                            className="mb-3"
                            data-sot-banner="transcription-job"
                            data-sot-state="error"
                            data-sot-tone="err"
                        >
                            <AlertCircle
                                data-sot-banner-icon
                                aria-hidden="true"
                            />
                            <div data-sot-banner-body>
                                <AlertTitle
                                    className="line-clamp-none overflow-visible"
                                    data-sot-banner-title
                                >
                                    {jobError}
                                </AlertTitle>
                            </div>
                        </Alert>
                    )}

                {transcription ? (
                    <>
                        <section data-sot-section="recording-transcription-output">
                            <header data-sot-part="recording-transcription-section-head">
                                <div>
                                    <h3 data-sot-part="recording-transcription-section-title">
                                        {t("transcription.outputTitle")}
                                    </h3>
                                    <p data-sot-part="recording-transcription-section-description">
                                        {t("transcription.outputDescription")}
                                    </p>
                                </div>
                                <div data-sot-part="recording-transcription-actions">
                                    <Button
                                        onClick={handleCopyTranscript}
                                        size="transcriptionAction"
                                        variant="transcriptionAction"
                                        data-sot-control="copy-local-transcript"
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
                                        size="transcriptionAction"
                                        variant="transcriptionDangerAction"
                                        data-sot-control="retranscribe-local"
                                        disabled={
                                            !canTranscribe || isTranscribing
                                        }
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
                            <div data-sot-part="recording-transcription-turn">
                                <p data-sot-part="recording-transcription-text">
                                    {displayText}
                                </p>
                            </div>
                            <div data-sot-list="recording-transcription-meta">
                                {language ? (
                                    <RecordingTranscriptionMetaBadge
                                        data-sot-meta="language"
                                        data-sot-tone="attribute"
                                    >
                                        <Languages
                                            aria-hidden="true"
                                            data-sot-part="recording-transcription-meta-icon"
                                        />
                                        <span>
                                            {t("transcription.languagePrefix")}:{" "}
                                            {language}
                                        </span>
                                    </RecordingTranscriptionMetaBadge>
                                ) : null}
                                {transcriptionType ? (
                                    <RecordingTranscriptionMetaBadge
                                        data-sot-meta="source"
                                        data-sot-tone="attribute"
                                    >
                                        {t("transcription.sourcePrefix")}:{" "}
                                        {transcriptionType}
                                    </RecordingTranscriptionMetaBadge>
                                ) : null}
                                <RecordingTranscriptionMetaBadge
                                    data-sot-meta="words"
                                    data-sot-tone="measure"
                                >
                                    {wordCount} {t("transcription.words")}
                                </RecordingTranscriptionMetaBadge>
                                <RecordingTranscriptionMetaBadge
                                    data-sot-meta="characters"
                                    data-sot-tone="measure"
                                >
                                    {transcription.length}{" "}
                                    {t("transcription.characters")}
                                </RecordingTranscriptionMetaBadge>
                            </div>
                        </section>
                        {showSpeakerReview ? (
                            <section data-sot-section="recording-transcription-speaker-review">
                                <header data-sot-part="recording-transcription-section-head">
                                    <div>
                                        <h3 data-sot-part="recording-transcription-section-title">
                                            {t("speakerReview.title")}
                                        </h3>
                                        <p data-sot-part="recording-transcription-section-description">
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
                        ) : null}
                    </>
                ) : (
                    <Empty
                        className="mt-4"
                        data-sot-part="recording-transcription-empty"
                        data-sot-state="empty"
                    >
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <FileText
                                    aria-hidden="true"
                                    data-sot-part="recording-transcription-empty-icon"
                                />
                            </EmptyMedia>
                            <EmptyTitle data-sot-part="recording-transcription-empty-title">
                                {t("transcription.noTranscript")}
                            </EmptyTitle>
                            <EmptyDescription data-sot-part="recording-transcription-empty-description">
                                {t("transcription.noTranscriptDescription")}
                            </EmptyDescription>
                        </EmptyHeader>
                        <EmptyContent>
                            <Button
                                onClick={() => handleTranscribe(false)}
                                size="transcriptionAction"
                                variant="transcriptionPrimaryAction"
                                data-sot-control="start-local-transcription"
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
