"use client";

import {
    FileText,
    Languages,
    Loader2,
    RefreshCw,
    Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SpeakerLabelEditor } from "@/components/dashboard/speaker-label-editor";
import { useLanguage } from "@/components/language-provider";
import { SourceReportPanel } from "@/components/recordings/source-report-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import {
    canRecordingPrivateTranscribe,
    getLocalTranscriptHint,
    getPrivateTranscriptionUnavailableMessage,
} from "@/lib/data-sources/presentation";
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

    useEffect(() => {
        setLiveSpeakerMap(transcription?.speakerMap ?? null);
    }, [transcription?.speakerMap]);

    useEffect(() => {
        if (!recording.sourceProvider && activeTab === "source") {
            setActiveTab("transcript");
        }
    }, [activeTab, recording.sourceProvider]);

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
                        isTranscribing ? (
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
                                    <Button
                                        onClick={handleConfirmRetranscribe}
                                        size="sm"
                                        variant="destructive"
                                        disabled={!canPrivateTranscribe}
                                        title={
                                            !canPrivateTranscribe
                                                ? (transcriptionUnavailableReason ??
                                                  undefined)
                                                : t(
                                                      "transcription.retranscribeConfirm",
                                                  )
                                        }
                                        className="shrink-0"
                                    >
                                        <RefreshCw className="h-4 w-4" />
                                        {t("transcription.retranscribe")}
                                    </Button>
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
                                    {t("transcription.generateTranscription")}
                                </Button>
                            </div>
                        )
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
