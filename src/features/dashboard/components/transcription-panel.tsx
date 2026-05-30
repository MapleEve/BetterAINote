"use client";

import {
    AlertCircle,
    CheckCircle2,
    Clock,
    Copy,
    FileText,
    Languages,
    Loader2,
    RefreshCw,
    Sparkles,
    X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { SourceReportPanel } from "@/features/recordings/components/source-report-panel";
import { SpeakerLabelEditor } from "@/features/recordings/components/speaker-label-editor";
import {
    canRecordingPrivateTranscribe,
    getLocalTranscriptHint,
    getPrivateTranscriptionUnavailableMessage,
} from "@/lib/data-sources/presentation";
import { writeBrowserClipboardText } from "@/lib/platform/clipboard";
import { getTranscriptionJobDisplayState } from "@/lib/transcription/job-display";
import { cn } from "@/lib/utils";
import type { Recording } from "@/types/recording";

interface Transcription {
    text?: string;
    language?: string;
    speakerMap?: Record<string, string> | null;
    segments?: TranscriptSegment[] | null;
}

interface TranscriptSegment {
    id: number;
    start: number | null;
    end: number | null;
    text: string;
    speakerLabel: string;
    speakerName?: string | null;
    displaySpeaker?: string | null;
}

interface MergedTranscriptTurn {
    speaker: string;
    start: number | null;
    end: number | null;
    text: string;
}

interface TranscriptionPanelProps {
    recording: Recording;
    transcription?: Transcription;
    transcriptionJob?: {
        status?: string | null;
        remoteStatus?: string | null;
        lastError?: string | null;
    } | null;
    isTranscriptLoading?: boolean;
    onTranscribe: () => void;
    onRetranscribe: () => void;
    className?: string;
}

type WorkspaceTab = "transcript" | "source" | "speakers";
type RetranscriptionBannerState =
    | "idle"
    | "queued"
    | "running"
    | "failed"
    | "completed"
    | "unavailable";

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

function formatTimestamp(value: number | null) {
    if (value == null || !Number.isFinite(value)) {
        return null;
    }

    const totalSeconds = Math.max(0, Math.floor(value));
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

function formatTimeRange(start: number | null, end: number | null) {
    const startLabel = formatTimestamp(start);
    const endLabel = formatTimestamp(end);

    if (startLabel && endLabel) {
        return `${startLabel} - ${endLabel}`;
    }

    return startLabel ?? endLabel ?? null;
}

function resolveSegmentSpeaker(
    segment: TranscriptSegment,
    speakerMap: Record<string, string> | null | undefined,
) {
    return (
        speakerMap?.[segment.speakerLabel] ||
        segment.speakerName?.trim() ||
        segment.displaySpeaker?.trim() ||
        segment.speakerLabel
    );
}

function buildMergedTranscriptTurns(
    segments: TranscriptSegment[] | null | undefined,
    speakerMap: Record<string, string> | null | undefined,
): MergedTranscriptTurn[] {
    if (!segments?.length) {
        return [];
    }

    const turns: MergedTranscriptTurn[] = [];

    for (const segment of segments) {
        const text = segment.text.trim();
        if (!text) continue;

        const speaker = resolveSegmentSpeaker(segment, speakerMap);
        const previous = turns.at(-1);

        if (previous && previous.speaker === speaker) {
            previous.text = `${previous.text} ${text}`;
            previous.end = segment.end ?? previous.end;
            continue;
        }

        turns.push({
            speaker,
            start: segment.start,
            end: segment.end,
            text,
        });
    }

    return turns;
}

function TranscriptionProgressState({
    description,
    label,
}: {
    description: string;
    label: string;
}) {
    return (
        <div className="flex min-h-[260px] items-center justify-center rounded-xl border border-white/10 bg-background/25 px-6 py-10">
            <div className="flex max-w-sm flex-col items-center text-center">
                <div className="relative mb-5 flex size-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary shadow-[0_0_24px_rgb(245_158_11_/_0.18)]">
                    <span className="absolute inset-0 animate-ping rounded-2xl bg-primary/20 opacity-70" />
                    <Loader2 className="relative size-6 animate-spin" />
                </div>
                <p className="text-sm font-semibold text-foreground">{label}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {description}
                </p>
            </div>
        </div>
    );
}

function getRetranscriptionBannerCopy(
    state: Exclude<RetranscriptionBannerState, "idle">,
    language: "zh-CN" | "en",
    error?: string | null,
) {
    const isZh = language === "zh-CN";

    switch (state) {
        case "queued":
            return {
                title: isZh ? "转写任务已加入队列" : "Transcription queued",
                body: isZh
                    ? "正在等待本地工作器领取，期间可继续浏览旧版本。"
                    : "Waiting for the local worker. You can keep reading the previous version.",
            };
        case "running":
            return {
                title: isZh ? "正在重新转写" : "Retranscribing",
                body: isZh
                    ? "后端正在生成新版本，完成后会替换当前本地转写。"
                    : "The backend is preparing a new version and will replace the local transcript when done.",
            };
        case "failed":
            return {
                title: isZh ? "转写失败" : "Transcription failed",
                body:
                    error ??
                    (isZh
                        ? "原转写未受影响，可稍后重试。"
                        : "The previous transcript was not changed. You can retry later."),
            };
        case "completed":
            return {
                title: isZh ? "转写已更新" : "Transcript updated",
                body: isZh
                    ? "新版本已替换旧内容，可在下方查看。"
                    : "The new version replaced the previous transcript and is available below.",
            };
        case "unavailable":
            return {
                title: isZh
                    ? "当前来源不支持私有重转写"
                    : "Private retranscription unavailable",
                body: isZh
                    ? "这条录音没有可用音频或来源不支持私有转写。"
                    : "This recording has no usable audio or the source does not support private transcription.",
            };
    }
}

function RetranscriptionBanner({
    error,
    language,
    onDismiss,
    onRetry,
    state,
}: {
    error?: string | null;
    language: "zh-CN" | "en";
    onDismiss: () => void;
    onRetry: () => void;
    state: Exclude<RetranscriptionBannerState, "idle">;
}) {
    const copy = getRetranscriptionBannerCopy(state, language, error);
    const isBusy = state === "queued" || state === "running";
    const isFailed = state === "failed";
    const canDismiss = state === "failed" || state === "completed";

    return (
        <div
            data-retx-state={state}
            data-testid="dashboard-retranscription-banner"
            className={cn(
                "mb-3 flex items-start gap-3 rounded-xl border px-3 py-3 text-sm",
                isBusy &&
                    "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-200",
                isFailed &&
                    "border-destructive/25 bg-destructive/10 text-destructive",
                state === "completed" &&
                    "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
                state === "unavailable" &&
                    "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-200",
            )}
        >
            <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-lg border border-current/25 bg-background/45">
                {isBusy ? (
                    <Loader2 className="size-3.5 animate-spin" />
                ) : state === "completed" ? (
                    <CheckCircle2 className="size-3.5" />
                ) : state === "failed" ? (
                    <AlertCircle className="size-3.5" />
                ) : (
                    <Clock className="size-3.5" />
                )}
            </span>
            <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">{copy.title}</p>
                <p className="mt-0.5 text-muted-foreground text-xs leading-5">
                    {copy.body}
                </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
                {isFailed ? (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        data-retx-retry=""
                        className="h-7 rounded-lg px-2 text-xs"
                        onClick={onRetry}
                    >
                        {language === "zh-CN" ? "重试转写" : "Retry"}
                    </Button>
                ) : null}
                {canDismiss ? (
                    <button
                        type="button"
                        aria-label={language === "zh-CN" ? "收起" : "Dismiss"}
                        data-retx-dismiss=""
                        className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-background/50 hover:text-foreground focus-visible:ring-ring/40 focus-visible:ring-[3px] focus-visible:outline-none"
                        onClick={onDismiss}
                    >
                        <X className="size-3.5" />
                    </button>
                ) : null}
            </div>
        </div>
    );
}

export function TranscriptionPanel({
    className,
    recording,
    transcription,
    transcriptionJob,
    isTranscriptLoading = false,
    onTranscribe,
    onRetranscribe,
}: TranscriptionPanelProps) {
    const { language, t } = useLanguage();
    const confirm = useConfirmDialog();
    const [activeTab, setActiveTab] = useState<WorkspaceTab>("transcript");
    const [liveSpeakerMap, setLiveSpeakerMap] = useState(
        transcription?.speakerMap ?? null,
    );
    const [isCopyingTranscript, setIsCopyingTranscript] = useState(false);
    const [dismissedRetxKey, setDismissedRetxKey] = useState<string | null>(
        null,
    );
    const [completedRetxAt, setCompletedRetxAt] = useState<number | null>(null);
    const previousJobDisplayStateRef =
        useRef<ReturnType<typeof getTranscriptionJobDisplayState>>(null);
    const retxResetKey = recording.id;

    useEffect(() => {
        setLiveSpeakerMap(transcription?.speakerMap ?? null);
    }, [transcription?.speakerMap]);

    useEffect(() => {
        if (!recording.sourceProvider && activeTab === "source") {
            setActiveTab("transcript");
        }
    }, [activeTab, recording.sourceProvider]);

    useEffect(() => {
        if (!retxResetKey) return;
        setDismissedRetxKey(null);
        setCompletedRetxAt(null);
        previousJobDisplayStateRef.current = null;
    }, [retxResetKey]);

    const displayText = useMemo(
        () =>
            transcription?.text
                ? applySpeakerMap(transcription.text, liveSpeakerMap)
                : "",
        [liveSpeakerMap, transcription?.text],
    );
    const mergedTranscriptTurns = useMemo(
        () =>
            buildMergedTranscriptTurns(transcription?.segments, liveSpeakerMap),
        [liveSpeakerMap, transcription?.segments],
    );
    const jobDisplayState = getTranscriptionJobDisplayState(transcriptionJob);
    const isTranscribing = jobDisplayState !== null;
    const transcribingLabel = useMemo(
        () =>
            jobDisplayState
                ? t(`transcription.${jobDisplayState}`)
                : t("transcription.processing"),
        [jobDisplayState, t],
    );
    const transcribingDescription =
        language === "zh-CN"
            ? "私有转录正在处理中，完成后会自动显示本地转录结果。"
            : "Private transcription is running. The local transcript will appear here when it finishes.";
    const loadingTranscriptDescription =
        language === "zh-CN"
            ? "正在读取本地转录内容。"
            : "Loading the local transcript.";
    const canPrivateTranscribe = canRecordingPrivateTranscribe({
        sourceProvider: recording.sourceProvider,
        hasAudio: recording.hasAudio,
    });
    const transcriptionUnavailableReason =
        getPrivateTranscriptionUnavailableMessage(
            recording.sourceProvider,
            recording.hasAudio,
            language,
        );
    const localTranscriptHint = getLocalTranscriptHint(
        recording.sourceProvider,
        language,
    );
    const retxState = useMemo<RetranscriptionBannerState>(() => {
        if (jobDisplayState) {
            return jobDisplayState === "queuedLocal" ||
                jobDisplayState === "queuedRemote"
                ? "queued"
                : "running";
        }

        if (transcriptionJob?.status === "failed") {
            return "failed";
        }

        if (completedRetxAt && transcription?.text?.trim()) {
            return "completed";
        }

        if (!canPrivateTranscribe && transcription?.text?.trim()) {
            return "unavailable";
        }

        return "idle";
    }, [
        canPrivateTranscribe,
        completedRetxAt,
        jobDisplayState,
        transcription?.text,
        transcriptionJob?.status,
    ]);
    const visibleRetxState =
        retxState === "idle" ||
        dismissedRetxKey ===
            `${recording.id}:${retxState}:${completedRetxAt ?? ""}`
            ? "idle"
            : retxState;
    const canReadExistingTranscript = Boolean(transcription?.text?.trim());

    useEffect(() => {
        const hadActiveJob = previousJobDisplayStateRef.current !== null;
        if (hadActiveJob && !jobDisplayState && transcription?.text?.trim()) {
            setCompletedRetxAt(Date.now());
            setDismissedRetxKey(null);
        }

        previousJobDisplayStateRef.current = jobDisplayState;
    }, [jobDisplayState, transcription?.text]);

    const handleCopyTranscript = useCallback(async () => {
        if (!displayText.trim()) {
            toast.error(t("transcription.noTranscriptAvailable"));
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

    const handleConfirmRetranscribe = useCallback(async () => {
        if (!canPrivateTranscribe) return;
        const confirmed = await confirm({
            title: t("common.confirmAction"),
            description: t("transcription.retranscribeConfirm"),
            confirmLabel: t("common.confirm"),
            cancelLabel: t("common.cancel"),
            variant: "destructive",
        });
        if (!confirmed) return;
        onRetranscribe();
    }, [canPrivateTranscribe, confirm, onRetranscribe, t]);

    const handleDismissRetxBanner = useCallback(() => {
        if (visibleRetxState === "idle") {
            return;
        }
        setDismissedRetxKey(
            `${recording.id}:${visibleRetxState}:${completedRetxAt ?? ""}`,
        );
    }, [completedRetxAt, recording.id, visibleRetxState]);

    const tabs: Array<{ id: WorkspaceTab; label: string }> = [
        { id: "transcript", label: t("transcription.outputTitle") },
        ...(recording.sourceProvider
            ? [{ id: "source" as const, label: t("sourceReport.tabLabel") }]
            : []),
        { id: "speakers", label: t("speakerReview.title") },
    ];

    return (
        <Card className={cn("h-full min-h-0 gap-4", className)}>
            <CardHeader className="shrink-0 gap-3">
                <SegmentedTabs
                    items={tabs.map((tab) => ({
                        value: tab.id,
                        label: tab.label,
                    }))}
                    value={activeTab}
                    onValueChange={setActiveTab}
                />
            </CardHeader>

            <CardContent className="min-h-0 flex-1 overflow-hidden">
                <div
                    key={activeTab}
                    className="content-fade-in h-full overflow-y-auto pr-1"
                >
                    {activeTab === "transcript" ? (
                        <div
                            data-transcription-panel-state={visibleRetxState}
                            data-testid="dashboard-transcription-panel"
                        >
                            {visibleRetxState !== "idle" ? (
                                <RetranscriptionBanner
                                    error={transcriptionJob?.lastError}
                                    language={language}
                                    onDismiss={handleDismissRetxBanner}
                                    onRetry={onRetranscribe}
                                    state={visibleRetxState}
                                />
                            ) : null}

                            {isTranscribing && !canReadExistingTranscript ? (
                                <TranscriptionProgressState
                                    description={transcribingDescription}
                                    label={transcribingLabel}
                                />
                            ) : isTranscriptLoading ? (
                                <TranscriptionProgressState
                                    description={loadingTranscriptDescription}
                                    label={t("common.loading")}
                                />
                            ) : transcription?.text ? (
                                <div className="rounded-xl border border-white/10 bg-background/25 p-4">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="flex flex-col gap-1">
                                            <p className="text-sm font-medium">
                                                {t("transcription.outputTitle")}
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                {t(
                                                    "transcription.outputDescription",
                                                )}
                                            </p>
                                        </div>
                                        <div className="flex shrink-0 flex-wrap gap-2">
                                            <Button
                                                onClick={handleCopyTranscript}
                                                size="sm"
                                                variant="outline"
                                                disabled={
                                                    isCopyingTranscript ||
                                                    !displayText.trim()
                                                }
                                                aria-busy={isCopyingTranscript}
                                            >
                                                <Copy className="h-4 w-4" />
                                                {isCopyingTranscript
                                                    ? t("common.copying")
                                                    : t(
                                                          "transcription.copyTranscript",
                                                      )}
                                            </Button>
                                            <Button
                                                onClick={
                                                    handleConfirmRetranscribe
                                                }
                                                size="sm"
                                                variant="destructive"
                                                disabled={
                                                    !canPrivateTranscribe ||
                                                    isTranscribing
                                                }
                                                data-retx-state={retxState}
                                                aria-busy={isTranscribing}
                                                title={
                                                    !canPrivateTranscribe
                                                        ? (transcriptionUnavailableReason ??
                                                          undefined)
                                                        : t(
                                                              "transcription.retranscribeConfirm",
                                                          )
                                                }
                                            >
                                                <RefreshCw className="h-4 w-4" />
                                                {retxState === "queued"
                                                    ? language === "zh-CN"
                                                        ? "排队中…"
                                                        : "Queued…"
                                                    : retxState === "running"
                                                      ? language === "zh-CN"
                                                          ? "转写中…"
                                                          : "Running…"
                                                      : t(
                                                            "transcription.retranscribe",
                                                        )}
                                            </Button>
                                        </div>
                                    </div>
                                    {localTranscriptHint ? (
                                        <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200">
                                            {localTranscriptHint}
                                        </div>
                                    ) : null}
                                    {mergedTranscriptTurns.length > 0 ? (
                                        <div className="mt-4 space-y-3">
                                            {mergedTranscriptTurns.map(
                                                (turn, index) => (
                                                    <div
                                                        key={`${turn.speaker}-${turn.start ?? index}-${index}`}
                                                        className="rounded-lg bg-muted/80 p-4"
                                                    >
                                                        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                                            <span className="font-mono">
                                                                {formatTimeRange(
                                                                    turn.start,
                                                                    turn.end,
                                                                ) ??
                                                                    (language ===
                                                                    "zh-CN"
                                                                        ? "时间未标记"
                                                                        : "No timestamp")}
                                                            </span>
                                                            <span>·</span>
                                                            <span className="font-medium text-foreground">
                                                                {turn.speaker}
                                                            </span>
                                                        </div>
                                                        <p className="whitespace-pre-wrap text-sm leading-relaxed">
                                                            {turn.text}
                                                        </p>
                                                    </div>
                                                ),
                                            )}
                                        </div>
                                    ) : (
                                        <div className="mt-4 rounded-lg bg-muted p-4">
                                            <p className="text-sm whitespace-pre-wrap leading-relaxed">
                                                {displayText}
                                            </p>
                                        </div>
                                    )}
                                    <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
                                        {transcription.language && (
                                            <div className="flex items-center gap-1">
                                                <Languages className="w-3 h-3" />
                                                <span>
                                                    {t(
                                                        "transcription.languagePrefix",
                                                    )}
                                                    : {transcription.language}
                                                </span>
                                            </div>
                                        )}
                                        <div>
                                            {transcription.text.trim()
                                                ? transcription.text
                                                      .trim()
                                                      .split(/\s+/).length
                                                : 0}{" "}
                                            {t("transcription.words")}
                                        </div>
                                        <div>
                                            {transcription.text.length}{" "}
                                            {t("transcription.characters")}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <FileText className="w-12 h-12 text-muted-foreground mb-4" />
                                    <p className="text-sm text-muted-foreground mb-4">
                                        {canPrivateTranscribe
                                            ? t(
                                                  "transcription.noTranscriptAvailable",
                                              )
                                            : (transcriptionUnavailableReason ??
                                              t(
                                                  "transcription.noTranscriptAvailable",
                                              ))}
                                    </p>
                                    <Button
                                        onClick={onTranscribe}
                                        size="sm"
                                        disabled={!canPrivateTranscribe}
                                    >
                                        <Sparkles className="w-4 h-4 mr-2" />
                                        {t(
                                            "transcription.generateTranscription",
                                        )}
                                    </Button>
                                </div>
                            )}
                        </div>
                    ) : null}

                    {activeTab === "source" ? (
                        recording.sourceProvider ? (
                            <SourceReportPanel
                                autoLoad
                                recordingId={recording.id}
                                sourceProvider={recording.sourceProvider}
                                variant="embedded"
                            />
                        ) : (
                            <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                                {t("sourceReport.emptyHint")}
                            </div>
                        )
                    ) : null}

                    {activeTab === "speakers" ? (
                        transcription?.text ? (
                            <SpeakerLabelEditor
                                recordingId={recording.id}
                                speakerMap={liveSpeakerMap}
                                onSpeakerMapChanged={setLiveSpeakerMap}
                            />
                        ) : (
                            <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                                {t("transcription.noTranscriptAvailable")}
                            </div>
                        )
                    ) : null}
                </div>
            </CardContent>
        </Card>
    );
}
