"use client";

import {
    Check,
    CircleAlert,
    Copy,
    Globe2,
    MessageSquareText,
    RefreshCw,
    X,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import {
    type SegmentedTabItem,
    SegmentedTabs,
} from "@/components/ui/segmented-tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { translate, type UiLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { Recording } from "@/types/recording";

export type TranscriptionPanelTab = "transcript" | "speakers" | "source";

export type TranscriptionPanelTurn = {
    id?: string | number;
    text: string;
    speakerName?: string | null;
    startMs?: number | null;
    endMs?: number | null;
};

export type TranscriptionPanelSpeaker = Pick<
    TranscriptionPanelTurn,
    "id" | "speakerName" | "text"
> & {
    rawLabel: string;
    share?: number;
};

export type TranscriptionPanelLocalCopyState =
    | "ready"
    | "missing"
    | "loading"
    | "error";

export type TranscriptionPanelLocalCopyFeedback = "ok" | "err" | null;

export type TranscriptionPanelRetranscriptionState =
    | "idle"
    | "queued"
    | "running"
    | "failed"
    | "completed"
    | "unavailable";

type TranscriptionPanelAction = () => void | Promise<void>;

export type TranscriptionPanelRetranscription = {
    state: TranscriptionPanelRetranscriptionState;
    title: ReactNode;
    description: ReactNode;
    disabled?: boolean;
    disabledReason?: string;
    refreshedLabel?: ReactNode;
    onRequest: TranscriptionPanelAction;
    onRetry: TranscriptionPanelAction;
    onDismiss: () => void;
};

export type TranscriptionPanelSpeakerMergeRequest = {
    source: TranscriptionPanelSpeaker;
    target: TranscriptionPanelSpeaker;
};

export type TranscriptionPanelSpeakerMerge = {
    state: "idle" | "pending" | "error" | "success";
    error?: string | null;
    onMerge: (
        request: TranscriptionPanelSpeakerMergeRequest,
    ) => void | Promise<void>;
    onRetry: () => void | Promise<void>;
};

export type TranscriptionPanelProps = {
    recording: Pick<Recording, "audioUrl" | "id"> | null;
    activeTab: TranscriptionPanelTab;
    onActiveTabChange: (tab: TranscriptionPanelTab) => void;
    disabledTabs?: readonly TranscriptionPanelTab[];
    turns: readonly TranscriptionPanelTurn[];
    isTranscriptLoading: boolean;
    transcriptError?: string | null;
    onRetryTranscript: TranscriptionPanelAction;
    transcriptLanguage?: string | null;
    localCopyState: TranscriptionPanelLocalCopyState;
    isCopyingLocal?: boolean;
    localCopyFeedback: TranscriptionPanelLocalCopyFeedback;
    onCopyLocal: TranscriptionPanelAction;
    retranscription: TranscriptionPanelRetranscription;
    speakers: readonly TranscriptionPanelSpeaker[];
    speakerMerge: TranscriptionPanelSpeakerMerge;
    sourceActions: ReactNode;
    sourcePane: ReactNode;
    className?: string;
};

const SPEAKER_SHARE_FALLBACKS = [24, 36, 48, 60, 72, 84, 96, 100] as const;

function getSpeakerShare(index: number) {
    return SPEAKER_SHARE_FALLBACKS[
        Math.min(index, SPEAKER_SHARE_FALLBACKS.length - 1)
    ];
}

function formatTimestamp(valueMs: number | null | undefined) {
    if (valueMs == null || !Number.isFinite(valueMs)) {
        return null;
    }

    const totalSeconds = Math.max(0, Math.floor(valueMs / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const timestamp =
        hours > 0
            ? `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
                  .toString()
                  .padStart(2, "0")}`
            : `${minutes}:${seconds.toString().padStart(2, "0")}`;
    const parts = timestamp.split(":");

    return parts.length === 2
        ? `${parts[0].padStart(2, "0")}:${parts[1]}`
        : timestamp;
}

function formatTurnTimestamp(
    startMs: number | null | undefined,
    endMs: number | null | undefined,
) {
    const start = formatTimestamp(startMs);
    const end = formatTimestamp(endMs);
    if (start && end && start !== end) {
        return `${start} - ${end}`;
    }
    return start ?? end;
}

function formatAvatarLabel(speakerName: string, index: number) {
    const trimmed = speakerName.trim();
    const genericMatch = trimmed.match(/^(?:Speaker|说话人)\s*(\d+)$/i);
    if (genericMatch?.[1]) {
        return genericMatch[1];
    }

    return Array.from(trimmed)[0] ?? `${index + 1}`;
}

function transcriptLanguageLabel(
    detectedLanguage: string | null | undefined,
    language: UiLanguage,
) {
    const normalized = detectedLanguage?.trim().toLowerCase();
    if (!normalized) {
        return translate(language, "transcriptionPanel.autoDetect");
    }
    if (normalized === "zh" || normalized.startsWith("zh-")) {
        return translate(language, "transcriptionPanel.chineseAuto");
    }
    if (normalized === "en" || normalized.startsWith("en-")) {
        return translate(language, "transcriptionPanel.englishAuto");
    }
    return translate(language, "transcriptionPanel.detectedAuto", {
        language: detectedLanguage ?? "",
    });
}

export function TranscriptionPanel({
    recording,
    activeTab,
    onActiveTabChange,
    disabledTabs = [],
    turns,
    isTranscriptLoading,
    transcriptError,
    onRetryTranscript,
    transcriptLanguage,
    localCopyState,
    isCopyingLocal = false,
    localCopyFeedback,
    onCopyLocal,
    retranscription,
    speakers,
    speakerMerge,
    sourceActions,
    sourcePane,
    className,
}: TranscriptionPanelProps) {
    const { language, t } = useLanguage();
    const [selectedSpeakerLabels, setSelectedSpeakerLabels] = useState<
        string[]
    >([]);
    const localCopyDisabled = isCopyingLocal || localCopyState !== "ready";
    const retranscriptionDisabled =
        Boolean(retranscription.disabled) || !recording || !recording.audioUrl;
    const transcriptState = isTranscriptLoading
        ? "loading"
        : transcriptError && turns.length === 0
          ? "error"
          : turns.length
            ? "ready"
            : "empty";
    const selectedSpeakers = useMemo(
        () =>
            selectedSpeakerLabels.flatMap((rawLabel) => {
                const speaker = speakers.find(
                    (candidate) => candidate.rawLabel === rawLabel,
                );
                return speaker ? [speaker] : [];
            }),
        [selectedSpeakerLabels, speakers],
    );
    const availableSpeakerLabels = useMemo(
        () => new Set(speakers.map((speaker) => speaker.rawLabel)),
        [speakers],
    );
    const canMergeSpeakers =
        selectedSpeakers.length === 2 && speakerMerge.state !== "pending";
    const tabs: SegmentedTabItem<TranscriptionPanelTab>[] = [
        {
            value: "transcript",
            label: t("transcriptionPanel.tabs.transcript"),
            disabled: disabledTabs.includes("transcript"),
        },
        {
            value: "speakers",
            label: t("transcriptionPanel.tabs.speakers"),
            disabled: disabledTabs.includes("speakers"),
        },
        {
            value: "source",
            label: t("transcriptionPanel.tabs.source"),
            tabKey: "source-report",
            disabled: disabledTabs.includes("source"),
        },
    ];

    useEffect(() => {
        setSelectedSpeakerLabels((current) => {
            const available = current.filter((rawLabel) =>
                availableSpeakerLabels.has(rawLabel),
            );
            return available.length === current.length ? current : available;
        });
    }, [availableSpeakerLabels]);

    useEffect(() => {
        if (speakerMerge.state === "success") {
            setSelectedSpeakerLabels([]);
        }
    }, [speakerMerge.state]);

    function toggleSpeaker(rawLabel: string) {
        if (speakerMerge.state === "pending") {
            return;
        }

        setSelectedSpeakerLabels((current) => {
            if (current.includes(rawLabel)) {
                return current.filter((candidate) => candidate !== rawLabel);
            }
            if (current.length >= 2) {
                return [current[1], rawLabel];
            }
            return [...current, rawLabel];
        });
    }

    function mergeSelectedSpeakers() {
        const [target, source] = selectedSpeakers;
        if (!target || !source) {
            return;
        }
        void speakerMerge.onMerge({ source, target });
    }

    return (
        <Card
            hasNoPadding
            role="region"
            aria-label={t("transcriptionPanel.regionLabel")}
            className={cn("min-h-0 flex-1 gap-0", className)}
            data-panel="dashboard-transcript-shell"
        >
            <CardHeader
                className="flex flex-row flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-3"
                data-part="dashboard-transcript-header"
            >
                <SegmentedTabs
                    aria-label={t("transcriptionPanel.tabsLabel")}
                    variant="segmented"
                    size="segmentedSm"
                    className="shrink-0"
                    data-control="segmented-tabs"
                    items={tabs}
                    value={activeTab}
                    onValueChange={onActiveTabChange}
                    getItemProps={(item, state) => ({
                        id: `dashboard-transcription-tab-${item.value}`,
                        "aria-controls": `dashboard-transcription-pane-${item.value}`,
                        "data-control": "segmented-tab",
                        "data-state": state.disabled
                            ? "disabled"
                            : state.active
                              ? "active"
                              : "idle",
                    })}
                />
                <div
                    className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-2"
                    data-part="dashboard-transcript-actions"
                >
                    {activeTab === "transcript" && transcriptLanguage ? (
                        <Badge
                            variant="outline"
                            className="gap-1.5"
                            data-part="dashboard-transcript-language"
                        >
                            <Globe2 aria-hidden="true" />
                            {transcriptLanguageLabel(
                                transcriptLanguage,
                                language,
                            )}
                        </Badge>
                    ) : null}
                    <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        data-copy="transcript"
                        data-copy-state={localCopyFeedback ?? undefined}
                        data-control="copy-local-transcript"
                        data-state={localCopyState}
                        data-tab-scope="transcript"
                        aria-busy={isCopyingLocal}
                        aria-label={t("transcription.copyTranscript")}
                        aria-live={localCopyFeedback ? "polite" : undefined}
                        disabled={localCopyDisabled}
                        hidden={activeTab !== "transcript"}
                        onClick={() => void onCopyLocal()}
                    >
                        {localCopyFeedback === "ok" ? (
                            <Check aria-hidden="true" />
                        ) : localCopyFeedback === "err" ? (
                            <X aria-hidden="true" />
                        ) : (
                            <Copy aria-hidden="true" />
                        )}
                        <span>
                            {localCopyFeedback
                                ? localCopyFeedback === "ok"
                                    ? t("common.copied")
                                    : t("common.copyFailedShort")
                                : t("transcription.copyTranscript")}
                        </span>
                    </Button>
                    {sourceActions}
                    <Badge
                        variant="outline"
                        className="max-w-full whitespace-normal [&[hidden]]:hidden"
                        hidden={
                            activeTab !== "transcript" ||
                            retranscription.state !== "unavailable"
                        }
                        data-part="dashboard-retranscription-disabled-hint"
                    >
                        {retranscription.disabledReason ??
                            t("recordingDetail.retx.unavailable")}
                    </Badge>
                    <Button
                        id="retx-btn"
                        variant="outline"
                        size="sm"
                        type="button"
                        data-control="retranscribe-recording"
                        data-state={retranscription.state}
                        data-retx-state={retranscription.state}
                        aria-disabled={retranscriptionDisabled}
                        disabled={retranscriptionDisabled}
                        hidden={activeTab !== "transcript"}
                        title={
                            retranscription.state === "unavailable"
                                ? (retranscription.disabledReason ??
                                  t("recordingDetail.retx.unavailable"))
                                : undefined
                        }
                        onClick={() => void retranscription.onRequest()}
                    >
                        <RefreshCw aria-hidden="true" />
                        {t("recordingDetail.retx.idleTitle")}
                    </Button>
                </div>
            </CardHeader>
            <CardContent
                className="min-h-0 flex-1 overflow-y-auto p-0"
                data-part="dashboard-transcript-body"
            >
                <Alert
                    variant={
                        retranscription.state === "failed"
                            ? "statusError"
                            : "default"
                    }
                    density="comfortable"
                    layout="inline"
                    role={
                        retranscription.state === "failed" ? "alert" : "status"
                    }
                    aria-live={
                        retranscription.state === "failed"
                            ? "assertive"
                            : "polite"
                    }
                    className="rounded-none border-x-0 border-t-0 [&[hidden]]:hidden"
                    data-panel="dashboard-retranscription"
                    data-state={retranscription.state}
                    data-retx-state={retranscription.state}
                    hidden={
                        retranscription.state === "idle" ||
                        retranscription.state === "unavailable"
                    }
                >
                    {retranscription.state === "queued" ||
                    retranscription.state === "running" ? (
                        <Spinner size="xs" aria-hidden="true" />
                    ) : retranscription.state === "failed" ? (
                        <CircleAlert aria-hidden="true" />
                    ) : retranscription.state === "completed" ? (
                        <Check aria-hidden="true" />
                    ) : (
                        <RefreshCw aria-hidden="true" />
                    )}
                    <div className="min-w-0 flex-1">
                        <AlertTitle className="line-clamp-none overflow-visible">
                            {retranscription.title}
                        </AlertTitle>
                        <AlertDescription density="comfortable">
                            {retranscription.description}
                        </AlertDescription>
                    </div>
                    {retranscription.state === "failed" ? (
                        <div className="ml-auto flex flex-none items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                type="button"
                                data-retx-retry=""
                                data-control="retry-retranscription"
                                onClick={() => void retranscription.onRetry()}
                            >
                                {t("transcriptionPanel.retryTranscription")}
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                type="button"
                                aria-label={t("transcriptionPanel.collapse")}
                                data-retx-dismiss=""
                                data-control="dismiss-retranscription-failed"
                                onClick={retranscription.onDismiss}
                            >
                                <X aria-hidden="true" />
                            </Button>
                        </div>
                    ) : retranscription.state === "completed" && recording ? (
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            className="ml-auto flex-none"
                            type="button"
                            aria-label={t("transcriptionPanel.collapse")}
                            data-retx-dismiss=""
                            data-control="dismiss-retranscription-complete"
                            onClick={retranscription.onDismiss}
                        >
                            <X aria-hidden="true" />
                        </Button>
                    ) : null}
                </Alert>
                <Badge
                    variant="secondary"
                    role="status"
                    aria-live="polite"
                    className="mx-5 mt-4 [&[hidden]]:hidden"
                    hidden={retranscription.state !== "completed"}
                    data-part="dashboard-retranscription-refresh-marker"
                >
                    {retranscription.refreshedLabel ??
                        t("transcriptionPanel.refreshedJustNow")}
                </Badge>
                <section
                    id="dashboard-transcription-pane-transcript"
                    role="tabpanel"
                    aria-labelledby="dashboard-transcription-tab-transcript"
                    aria-busy={isTranscriptLoading}
                    className="px-5 py-4 [&[hidden]]:hidden"
                    data-panel="dashboard-transcript-pane"
                    data-tab-pane="transcript"
                    data-state={transcriptState}
                    hidden={activeTab !== "transcript"}
                >
                    {transcriptError ? (
                        <Alert
                            variant="statusError"
                            role="alert"
                            className="mb-4"
                            data-panel="dashboard-transcript-error"
                        >
                            <CircleAlert aria-hidden="true" />
                            <div className="min-w-0 flex-1">
                                <AlertTitle>
                                    {t(
                                        "transcriptionPanel.transcriptErrorTitle",
                                    )}
                                </AlertTitle>
                                <AlertDescription>
                                    {transcriptError}
                                </AlertDescription>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                type="button"
                                onClick={() => void onRetryTranscript()}
                            >
                                {t("transcriptionPanel.retry")}
                            </Button>
                        </Alert>
                    ) : null}
                    {isTranscriptLoading ? (
                        <output
                            aria-label={t(
                                "transcriptionPanel.transcriptLoading",
                            )}
                            className="block divide-y divide-dashed"
                        >
                            <div className="py-3" data-state="loading">
                                <div className="mb-2 flex items-center gap-2">
                                    <Skeleton
                                        aria-hidden="true"
                                        className="size-6 flex-none rounded-full"
                                    />
                                    <Skeleton
                                        aria-hidden="true"
                                        className="h-3 w-28 flex-none"
                                    />
                                    <Skeleton
                                        aria-hidden="true"
                                        className="h-3 w-20 flex-none"
                                    />
                                </div>
                                <Skeleton
                                    aria-hidden="true"
                                    className="mt-1 h-3.5 w-full"
                                />
                                <Skeleton
                                    aria-hidden="true"
                                    className="mt-1.5 h-3.5 w-4/5"
                                />
                                <Skeleton
                                    aria-hidden="true"
                                    className="mt-1.5 h-3.5 w-3/5"
                                />
                            </div>
                            <div className="py-3" data-state="loading">
                                <div className="mb-2 flex items-center gap-2">
                                    <Skeleton
                                        aria-hidden="true"
                                        className="size-6 flex-none rounded-full"
                                    />
                                    <Skeleton
                                        aria-hidden="true"
                                        className="h-3 w-32 flex-none"
                                    />
                                    <Skeleton
                                        aria-hidden="true"
                                        className="h-3 w-20 flex-none"
                                    />
                                </div>
                                <Skeleton
                                    aria-hidden="true"
                                    className="mt-1 h-3.5 w-11/12"
                                />
                                <Skeleton
                                    aria-hidden="true"
                                    className="mt-1.5 h-3.5 w-3/4"
                                />
                            </div>
                            <div className="py-3" data-state="loading">
                                <div className="mb-2 flex items-center gap-2">
                                    <Skeleton
                                        aria-hidden="true"
                                        className="size-6 flex-none rounded-full"
                                    />
                                    <Skeleton
                                        aria-hidden="true"
                                        className="h-3 w-30 flex-none"
                                    />
                                    <Skeleton
                                        aria-hidden="true"
                                        className="h-3 w-20 flex-none"
                                    />
                                </div>
                                <Skeleton
                                    aria-hidden="true"
                                    className="mt-1 h-3.5 w-full"
                                />
                                <Skeleton
                                    aria-hidden="true"
                                    className="mt-1.5 h-3.5 w-4/5"
                                />
                                <Skeleton
                                    aria-hidden="true"
                                    className="mt-1.5 h-3.5 w-2/3"
                                />
                            </div>
                        </output>
                    ) : turns.length ? (
                        <ol className="m-0 list-none divide-y divide-dashed p-0">
                            {turns.map((turn, index) => {
                                const speakerName =
                                    turn.speakerName ||
                                    t("transcriptionPanel.fallbackSpeaker", {
                                        index: index + 1,
                                    });
                                const timeLabel = formatTurnTimestamp(
                                    turn.startMs,
                                    turn.endMs,
                                );

                                return (
                                    <li
                                        className="py-3"
                                        data-item="dashboard-transcript-turn"
                                        data-state="ready"
                                        key={
                                            turn.id ??
                                            `${recording?.id ?? "recording"}:${index}`
                                        }
                                    >
                                        <header
                                            className="mb-2 flex min-w-0 items-center gap-2"
                                            data-part="dashboard-transcript-speaker-row"
                                        >
                                            <Badge
                                                variant="secondary"
                                                className="size-7 flex-none justify-center rounded-full p-0 text-xs tabular-nums"
                                                aria-label={t(
                                                    "transcriptionPanel.speakerAria",
                                                    { name: speakerName },
                                                )}
                                                data-part="dashboard-transcript-avatar"
                                            >
                                                {formatAvatarLabel(
                                                    speakerName,
                                                    index,
                                                )}
                                            </Badge>
                                            <span
                                                className="min-w-0 truncate text-sm font-medium text-foreground"
                                                data-part="dashboard-transcript-speaker-name"
                                            >
                                                {speakerName}
                                            </span>
                                            <time
                                                className="ml-1 flex-none font-mono text-xs tabular-nums text-muted-foreground"
                                                data-part="dashboard-transcript-speaker-time"
                                                data-format="mono"
                                            >
                                                {timeLabel ?? "--"}
                                            </time>
                                        </header>
                                        <p className="m-0 text-sm/relaxed text-foreground">
                                            {turn.text}
                                        </p>
                                    </li>
                                );
                            })}
                        </ol>
                    ) : transcriptError ? null : (
                        <Empty
                            variant="compact"
                            data-panel="dashboard-transcript-empty"
                            data-state="empty"
                        >
                            <EmptyHeader>
                                <EmptyMedia
                                    variant="icon"
                                    aria-hidden="true"
                                    data-part="dashboard-transcript-empty-icon"
                                >
                                    <MessageSquareText />
                                </EmptyMedia>
                                <EmptyTitle
                                    variant="compact"
                                    data-part="dashboard-transcript-empty-message"
                                >
                                    {t(
                                        "transcriptionPanel.transcriptEmptyTitle",
                                    )}
                                </EmptyTitle>
                                <EmptyDescription
                                    variant="compact"
                                    data-part="dashboard-transcript-empty-sub"
                                >
                                    {t(
                                        "transcriptionPanel.transcriptEmptyDescription",
                                    )}
                                </EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    )}
                </section>
                <section
                    id="dashboard-transcription-pane-source"
                    role="tabpanel"
                    aria-labelledby="dashboard-transcription-tab-source"
                    className="[&[hidden]]:hidden"
                    data-tab-pane="source"
                    hidden={activeTab !== "source"}
                >
                    {sourcePane}
                </section>
                <section
                    id="dashboard-transcription-pane-speakers"
                    role="tabpanel"
                    aria-labelledby="dashboard-transcription-tab-speakers"
                    className="[&[hidden]]:hidden"
                    data-panel="dashboard-speakers-pane"
                    data-tab-pane="speakers"
                    data-state={speakers.length ? "ready" : "empty"}
                    hidden={activeTab !== "speakers"}
                >
                    <header
                        className="flex flex-wrap items-center gap-2.5 px-4 pt-3 pb-2"
                        data-part="dashboard-speakers-head"
                    >
                        <p className="m-0 flex-1 text-sm font-medium text-muted-foreground">
                            {t("transcriptionPanel.speakerCount", {
                                count: speakers.length,
                            })}
                        </p>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="shrink-0"
                            type="button"
                            data-control="dashboard-speakers-merge"
                            aria-busy={speakerMerge.state === "pending"}
                            disabled={!canMergeSpeakers}
                            onClick={mergeSelectedSpeakers}
                        >
                            {speakerMerge.state === "pending" ? (
                                <Spinner size="xs" aria-hidden="true" />
                            ) : null}
                            {t("transcriptionPanel.mergeSelected")}
                        </Button>
                    </header>
                    {speakerMerge.state !== "idle" ? (
                        <Alert
                            variant={
                                speakerMerge.state === "error"
                                    ? "statusError"
                                    : "default"
                            }
                            role={
                                speakerMerge.state === "error"
                                    ? "alert"
                                    : "status"
                            }
                            aria-live={
                                speakerMerge.state === "error"
                                    ? "assertive"
                                    : "polite"
                            }
                            className="mx-4 mb-2"
                            data-panel="dashboard-speaker-merge-status"
                            data-state={speakerMerge.state}
                        >
                            {speakerMerge.state === "pending" ? (
                                <Spinner size="xs" aria-hidden="true" />
                            ) : speakerMerge.state === "error" ? (
                                <CircleAlert aria-hidden="true" />
                            ) : (
                                <Check aria-hidden="true" />
                            )}
                            <div className="min-w-0 flex-1">
                                <AlertTitle>
                                    {speakerMerge.state === "pending"
                                        ? t("transcriptionPanel.mergePending")
                                        : speakerMerge.state === "error"
                                          ? t("transcriptionPanel.mergeFailed")
                                          : t(
                                                "transcriptionPanel.mergeSuccess",
                                            )}
                                </AlertTitle>
                                {speakerMerge.state === "error" &&
                                speakerMerge.error ? (
                                    <AlertDescription>
                                        {speakerMerge.error}
                                    </AlertDescription>
                                ) : null}
                            </div>
                            {speakerMerge.state === "error" ? (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    type="button"
                                    data-control="retry-speaker-merge"
                                    onClick={() => void speakerMerge.onRetry()}
                                >
                                    {t("transcriptionPanel.retry")}
                                </Button>
                            ) : null}
                        </Alert>
                    ) : null}
                    {speakers.length ? (
                        <ul
                            className="m-0 flex list-none flex-col gap-1 px-2 pb-3.5"
                            data-list="dashboard-speaker-rows"
                        >
                            {speakers.map((speaker, index) => {
                                const shareValue =
                                    speaker.share ?? getSpeakerShare(index);
                                const speakerName =
                                    speaker.speakerName ||
                                    t("transcriptionPanel.fallbackSpeaker", {
                                        index: index + 1,
                                    });
                                const selected = selectedSpeakerLabels.includes(
                                    speaker.rawLabel,
                                );

                                return (
                                    <li
                                        className="grid grid-cols-[auto_auto_minmax(0,1fr)_minmax(72px,120px)] items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-accent"
                                        data-item="dashboard-speaker-row"
                                        data-state={
                                            selected ? "selected" : "ready"
                                        }
                                        key={
                                            speaker.id ??
                                            `${recording?.id ?? "recording"}:speaker:${index}`
                                        }
                                    >
                                        <input
                                            type="checkbox"
                                            className="size-4 accent-primary"
                                            checked={selected}
                                            disabled={
                                                speakerMerge.state === "pending"
                                            }
                                            aria-label={t(
                                                "transcriptionPanel.selectSpeaker",
                                                { name: speakerName },
                                            )}
                                            onChange={() =>
                                                toggleSpeaker(speaker.rawLabel)
                                            }
                                        />
                                        <Badge
                                            variant="secondary"
                                            className="size-7 flex-none justify-center p-0 tabular-nums"
                                            aria-label={t(
                                                "transcriptionPanel.speakerAria",
                                                {
                                                    name: index + 1,
                                                },
                                            )}
                                            data-part="dashboard-speaker-avatar"
                                        >
                                            {index + 1}
                                        </Badge>
                                        <div
                                            className="flex min-w-0 flex-col gap-0.5"
                                            data-part="dashboard-speaker-row-meta"
                                        >
                                            <span
                                                className="truncate text-sm font-medium text-foreground"
                                                data-part="dashboard-speaker-name"
                                            >
                                                {speakerName}
                                            </span>
                                            <Badge
                                                variant="outline"
                                                className="w-fit justify-center font-mono tabular-nums"
                                                data-part="dashboard-speaker-sub"
                                            >
                                                {t(
                                                    "transcriptionPanel.characterCount",
                                                    {
                                                        count: speaker.text
                                                            .length,
                                                    },
                                                )}
                                            </Badge>
                                        </div>
                                        <Progress
                                            value={shareValue}
                                            max={100}
                                            className="h-1 bg-muted"
                                            indicatorClassName="bg-primary"
                                            data-part="dashboard-speaker-bar"
                                            getValueLabel={(value) =>
                                                `${value}%`
                                            }
                                        />
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <Empty
                            variant="compact"
                            className="border-0 py-4 md:py-4"
                            data-state="empty"
                        >
                            <EmptyHeader className="max-w-none">
                                <EmptyMedia
                                    variant="icon"
                                    className="size-8"
                                    aria-hidden="true"
                                >
                                    <MessageSquareText />
                                </EmptyMedia>
                                <EmptyTitle variant="compact">
                                    {t("transcriptionPanel.speakerEmptyTitle")}
                                </EmptyTitle>
                                <EmptyDescription variant="compact">
                                    {t(
                                        "transcriptionPanel.speakerEmptyDescription",
                                    )}
                                </EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    )}
                </section>
            </CardContent>
        </Card>
    );
}
