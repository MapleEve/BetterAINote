"use client";

import { FileText, Languages, RefreshCw, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { SpeakerLabelEditor } from "@/components/dashboard/speaker-label-editor";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    canRecordingPrivateTranscribe,
    getAutoRenameBehaviorHint,
    getLocalRenameUnavailableMessage,
    getLocalTranscriptHint,
    getPrivateTranscriptionUnavailableMessage,
} from "@/lib/data-sources/presentation";
import { reloadBrowserWindow } from "@/lib/platform/browser-shell";
import { getTranscriptionJobDisplayState } from "@/lib/transcription/job-display";
import type { Recording } from "@/types/recording";

interface Transcription {
    text?: string;
    language?: string;
    speakerMap?: Record<string, string> | null;
}

interface TranscriptionPanelProps {
    recording: Recording;
    transcription?: Transcription;
    transcriptionJob?: {
        status?: string | null;
        remoteStatus?: string | null;
        lastError?: string | null;
    } | null;
    onTranscribe: () => void;
    onRetranscribe: () => void;
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

export function TranscriptionPanel({
    recording,
    transcription,
    transcriptionJob,
    onTranscribe,
    onRetranscribe,
}: TranscriptionPanelProps) {
    const { language, t } = useLanguage();
    const [isAutoRenaming, setIsAutoRenaming] = useState(false);
    const [liveSpeakerMap, setLiveSpeakerMap] = useState(
        transcription?.speakerMap ?? null,
    );

    useEffect(() => {
        setLiveSpeakerMap(transcription?.speakerMap ?? null);
    }, [transcription?.speakerMap]);

    const displayText = useMemo(
        () =>
            transcription?.text
                ? applySpeakerMap(transcription.text, liveSpeakerMap)
                : "",
        [liveSpeakerMap, transcription?.text],
    );
    const jobDisplayState = getTranscriptionJobDisplayState(transcriptionJob);
    const isTranscribing = jobDisplayState !== null;
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
    const renameUnavailableReason = getLocalRenameUnavailableMessage(
        recording.sourceProvider,
        language,
    );
    const canRenameRecording = !renameUnavailableReason;
    const autoRenameBehaviorHint = getAutoRenameBehaviorHint(
        recording.sourceProvider,
        language,
    );
    const localTranscriptHint = getLocalTranscriptHint(
        recording.sourceProvider,
        language,
    );

    const handleAutoRename = useCallback(async () => {
        if (!canRenameRecording) {
            toast.error(
                renameUnavailableReason ?? t("transcription.autoRenameFailed"),
            );
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
    }, [canRenameRecording, recording.id, renameUnavailableReason, t]);

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col gap-1">
                    <CardTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        {t("transcription.localTitle")}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                        {t("transcription.localDescription")}
                    </p>
                </div>

                {localTranscriptHint ? (
                    <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200">
                        {localTranscriptHint}
                    </div>
                ) : null}
                {!canPrivateTranscribe && transcriptionUnavailableReason ? (
                    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-300">
                        {transcriptionUnavailableReason}
                    </div>
                ) : null}
                {(renameUnavailableReason || autoRenameBehaviorHint) && (
                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                        {renameUnavailableReason ?? autoRenameBehaviorHint}
                    </div>
                )}
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
                        {transcription?.text && !isTranscribing && (
                            <Button
                                onClick={onRetranscribe}
                                size="sm"
                                variant="outline"
                                disabled={
                                    isAutoRenaming || !canPrivateTranscribe
                                }
                                title={
                                    !canPrivateTranscribe
                                        ? (transcriptionUnavailableReason ??
                                          undefined)
                                        : undefined
                                }
                            >
                                <RefreshCw className="w-4 h-4 mr-2" />
                                {t("transcription.retranscribe")}
                            </Button>
                        )}
                        {!transcription?.text && !isTranscribing && (
                            <Button
                                onClick={onTranscribe}
                                size="sm"
                                disabled={!canPrivateTranscribe}
                                title={
                                    !canPrivateTranscribe
                                        ? (transcriptionUnavailableReason ??
                                          undefined)
                                        : undefined
                                }
                            >
                                <Sparkles className="w-4 h-4 mr-2" />
                                {t("transcription.transcribe")}
                            </Button>
                        )}
                        {transcription?.text && (
                            <Button
                                onClick={handleAutoRename}
                                size="sm"
                                variant="outline"
                                disabled={
                                    isTranscribing ||
                                    isAutoRenaming ||
                                    !canRenameRecording
                                }
                                title={
                                    !canRenameRecording
                                        ? (renameUnavailableReason ?? undefined)
                                        : (autoRenameBehaviorHint ?? undefined)
                                }
                            >
                                <Sparkles className="w-4 h-4 mr-2" />
                                {isAutoRenaming
                                    ? t("transcription.renaming")
                                    : t("transcription.aiRename")}
                            </Button>
                        )}
                        {isTranscribing && (
                            <Button size="sm" disabled>
                                <Sparkles className="w-4 h-4 mr-2 animate-pulse" />
                                {t(
                                    `transcription.${jobDisplayState ?? "processing"}`,
                                )}
                            </Button>
                        )}
                    </div>
                </div>

                {isTranscribing ? (
                    <div className="flex flex-col items-center justify-center py-12">
                        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mb-4" />
                        <p className="text-sm text-muted-foreground">
                            {t(
                                `transcription.${jobDisplayState ?? "processing"}`,
                            )}
                        </p>
                    </div>
                ) : transcription?.text ? (
                    <div className="space-y-4">
                        <div className="rounded-xl border border-white/10 bg-background/25 p-4">
                            <div className="flex flex-col gap-1">
                                <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
                                    {t("transcription.outputTitle")}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    {t("transcription.outputDescription")}
                                </p>
                            </div>
                            <div className="mt-4 bg-muted rounded-lg p-4 max-h-96 overflow-y-auto">
                                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                                    {displayText}
                                </p>
                            </div>
                            <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
                                {transcription.language && (
                                    <div className="flex items-center gap-1">
                                        <Languages className="w-3 h-3" />
                                        <span>
                                            {t("transcription.languagePrefix")}:{" "}
                                            {transcription.language}
                                        </span>
                                    </div>
                                )}
                                <div>
                                    {transcription.text.trim()
                                        ? transcription.text.trim().split(/\s+/)
                                              .length
                                        : 0}{" "}
                                    {t("transcription.words")}
                                </div>
                                <div>
                                    {transcription.text.length}{" "}
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
                                    recordingId={recording.id}
                                    speakerMap={liveSpeakerMap}
                                    onSpeakerMapChanged={setLiveSpeakerMap}
                                />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <FileText className="w-12 h-12 text-muted-foreground mb-4" />
                        <p className="text-sm text-muted-foreground mb-4">
                            {canPrivateTranscribe
                                ? t("transcription.noTranscriptAvailable")
                                : (transcriptionUnavailableReason ??
                                  t("transcription.noTranscriptAvailable"))}
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
                )}
            </CardContent>
        </Card>
    );
}
