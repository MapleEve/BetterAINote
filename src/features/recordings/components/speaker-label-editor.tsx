"use client";

import { Copy, FileText, Play, RefreshCw, Volume2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/components/language-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Field, FieldContent, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
    SpeakerReviewSkeleton,
    TranscriptReviewSkeleton,
} from "@/features/recordings/components/transcription-skeletons";
import { formatDateTime } from "@/lib/format-date";
import { startBrowserTimeout } from "@/lib/platform/browser-shell";
import { writeBrowserClipboardText } from "@/lib/platform/clipboard";

interface SpeakerProfile {
    id: string;
    displayName: string;
    voiceprintRef?: string | null;
    hasVoiceprint?: boolean;
}

interface RecordingSpeaker {
    rawLabel: string;
    matchedProfileId: string | null;
    matchedProfileName: string | null;
    hasVoiceprint: boolean;
    sampleSegments: Array<{
        startMs: number | null;
        endMs: number | null;
        text?: string | null;
    }>;
    sampleCount: number;
    hasPlayableSample: boolean;
    segmentCount: number;
    updatedAt: string;
}

interface TranscriptReview {
    text: string;
    detectedLanguage?: string | null;
    transcriptionType?: string | null;
    provider?: string | null;
    model?: string | null;
    createdAt?: string | null;
    wordCount: number;
    characterCount: number;
    mappedSpeakerCount: number;
}

type TranscriptReviewMode = "speaker" | "raw";

interface SpeakerSaveError {
    rawLabel: string;
    profileId: string | null;
    profileName: string | undefined;
}

function formatSegmentWindow(startMs: number | null, endMs: number | null) {
    if (startMs == null || endMs == null) {
        return null;
    }

    const showSubSecond =
        Math.floor(startMs / 1000) === Math.floor(endMs / 1000) ||
        endMs - startMs < 1_000;

    const formatPoint = (value: number) => {
        const totalSeconds = Math.max(
            0,
            showSubSecond ? value / 1000 : Math.floor(value / 1000),
        );
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds - minutes * 60;

        if (showSubSecond) {
            return `${minutes}:${seconds.toFixed(1).padStart(4, "0")}`;
        }

        return `${minutes}:${Math.floor(seconds).toString().padStart(2, "0")}`;
    };

    return `${formatPoint(startMs)} - ${formatPoint(endMs)}`;
}

function formatReviewTimestamp(
    value: string | null | undefined,
    language: string,
) {
    if (!value) {
        return null;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return value;
    }

    return formatDateTime(
        parsed,
        "absolute",
        language === "zh-CN" ? "zh-CN" : "en",
    );
}

function formatTranscriptionType(
    value: string | null | undefined,
    t: (key: string, replacements?: Record<string, string | number>) => string,
) {
    switch (value) {
        case "server":
            return t("speakerReview.transcriptionSourceServer");
        case "private":
            return t("speakerReview.transcriptionSourcePrivate");
        default:
            return value;
    }
}

function formatProviderName(value: string | null | undefined) {
    if (value === "voice-transcribe") {
        return "voscript";
    }

    return value;
}

function getSpeakerMappingInputId(recordingId: string, rawLabel: string) {
    return `speaker-mapping-${encodeURIComponent(recordingId)}-${encodeURIComponent(rawLabel)}`;
}

interface SpeakerLabelEditorProps {
    recordingId: string;
    speakerMap?: Record<string, string> | null;
    onSpeakerMapChanged?: (map: Record<string, string>) => void;
}

export function SpeakerLabelEditor({
    recordingId,
    speakerMap,
    onSpeakerMapChanged,
}: SpeakerLabelEditorProps) {
    const { language, t } = useLanguage();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState<string | null>(null);
    const [speakerLoadError, setSpeakerLoadError] = useState<string | null>(
        null,
    );
    const [speakers, setSpeakers] = useState<RecordingSpeaker[]>([]);
    const [profiles, setProfiles] = useState<SpeakerProfile[]>([]);
    const [searchQueries, setSearchQueries] = useState<Record<string, string>>(
        {},
    );
    const [openPickerFor, setOpenPickerFor] = useState<string | null>(null);
    const [confirmUnlinkFor, setConfirmUnlinkFor] = useState<string | null>(
        null,
    );
    const [speakerSaveErrors, setSpeakerSaveErrors] = useState<
        Record<string, SpeakerSaveError>
    >({});
    const [editingSpeakerFor, setEditingSpeakerFor] = useState<string | null>(
        null,
    );
    const [speakerNameDrafts, setSpeakerNameDrafts] = useState<
        Record<string, string>
    >({});
    const [playingKey, setPlayingKey] = useState<string | null>(null);
    const [reviewMode, setReviewMode] =
        useState<TranscriptReviewMode>("speaker");
    const [isMergePopoverOpen, setIsMergePopoverOpen] = useState(false);
    const [isReviewLoading, setIsReviewLoading] = useState(true);
    const [reviewError, setReviewError] = useState<string | null>(null);
    const [rawTranscript, setRawTranscript] = useState<TranscriptReview | null>(
        null,
    );
    const [speakerTranscript, setSpeakerTranscript] =
        useState<TranscriptReview | null>(null);
    const [isCopyingRawTranscript, setIsCopyingRawTranscript] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const mergeAnchorRef = useRef<HTMLDivElement | null>(null);
    const mergeButtonRef = useRef<HTMLButtonElement | null>(null);
    const speakerMapRef = useRef<Record<string, string>>(speakerMap ?? {});

    const profileNameById = useMemo(
        () =>
            Object.fromEntries(
                profiles.map((profile) => [profile.id, profile.displayName]),
            ),
        [profiles],
    );
    const activeReview =
        reviewMode === "speaker" ? speakerTranscript : rawTranscript;

    const canCopyRawTranscript = Boolean(rawTranscript?.text.trim());
    const mergePopoverId = `speaker-review-merge-popover-${recordingId}`;

    useEffect(() => {
        speakerMapRef.current = speakerMap ?? {};
    }, [speakerMap]);

    const clearSpeakerSaveError = useCallback((rawLabel: string) => {
        setSpeakerSaveErrors((prev) => {
            if (!prev[rawLabel]) {
                return prev;
            }

            const next = { ...prev };
            delete next[rawLabel];
            return next;
        });
    }, []);

    const closeInlineRename = useCallback((rawLabel: string) => {
        setEditingSpeakerFor((current) =>
            current === rawLabel ? null : current,
        );
        setSpeakerNameDrafts((prev) => {
            if (!(rawLabel in prev)) {
                return prev;
            }

            const next = { ...prev };
            delete next[rawLabel];
            return next;
        });
    }, []);

    const openInlineRename = useCallback(
        (speaker: RecordingSpeaker) => {
            const initialName = speaker.matchedProfileName ?? speaker.rawLabel;
            setOpenPickerFor(null);
            setConfirmUnlinkFor(null);
            clearSpeakerSaveError(speaker.rawLabel);
            setSpeakerNameDrafts((prev) => ({
                ...prev,
                [speaker.rawLabel]: initialName,
            }));
            setEditingSpeakerFor(speaker.rawLabel);
        },
        [clearSpeakerSaveError],
    );

    const stopPlayback = useCallback(() => {
        const audio = audioRef.current;
        if (audio) {
            audio.pause();
            audio.currentTime = 0;
            audio.ontimeupdate = null;
            audio.onloadedmetadata = null;
        }
        setPlayingKey(null);
    }, []);

    const refreshSpeakers = useCallback(async () => {
        setIsLoading(true);
        setSpeakerLoadError(null);
        setSpeakerSaveErrors({});
        try {
            const response = await fetch(
                `/api/recordings/${recordingId}/speakers`,
                {
                    cache: "no-store",
                },
            );
            const data = await response.json();
            if (!response.ok) {
                const message =
                    data.error || t("speakerReview.failedToLoadSpeakers");
                setSpeakers([]);
                setProfiles([]);
                setSearchQueries({});
                setSpeakerLoadError(message);
                toast.error(message);
                return;
            }

            setSpeakerLoadError(null);
            setSpeakers(data.speakers ?? []);
            setProfiles(data.profiles ?? []);
            setConfirmUnlinkFor(null);
            const nextSpeakers = data.speakers ?? [];
            setSearchQueries(
                Object.fromEntries(
                    nextSpeakers.map((speaker: RecordingSpeaker) => [
                        speaker.rawLabel,
                        speaker.matchedProfileName ?? "",
                    ]),
                ),
            );
        } catch {
            const message = t("speakerReview.failedToLoadSpeakers");
            setSpeakers([]);
            setProfiles([]);
            setSearchQueries({});
            setSpeakerLoadError(message);
            toast.error(message);
        } finally {
            setIsLoading(false);
        }
    }, [recordingId, t]);

    const refreshTranscriptReview = useCallback(async () => {
        setIsReviewLoading(true);
        setReviewError(null);
        setSpeakerSaveErrors({});
        setConfirmUnlinkFor(null);
        setRawTranscript(null);
        setSpeakerTranscript(null);

        try {
            const [rawResponse, speakerResponse] = await Promise.all([
                fetch(`/api/recordings/${recordingId}/transcript/raw`, {
                    cache: "no-store",
                }),
                fetch(`/api/recordings/${recordingId}/transcript/speakers`, {
                    cache: "no-store",
                }),
            ]);
            const [rawData, speakerData] = await Promise.all([
                rawResponse.json(),
                speakerResponse.json(),
            ]);

            if (!rawResponse.ok || !speakerResponse.ok) {
                setReviewError(
                    rawData.error ||
                        speakerData.error ||
                        t("speakerReview.failedToLoadTranscriptReview"),
                );
                return;
            }

            setRawTranscript({
                text: rawData.transcript?.text ?? "",
                detectedLanguage: rawData.transcript?.detectedLanguage ?? null,
                transcriptionType:
                    rawData.transcript?.transcriptionType ?? null,
                provider: rawData.transcript?.provider ?? null,
                model: rawData.transcript?.model ?? null,
                createdAt: rawData.transcript?.createdAt ?? null,
                wordCount: rawData.transcript?.wordCount ?? 0,
                characterCount: rawData.transcript?.characterCount ?? 0,
                mappedSpeakerCount: rawData.transcript?.mappedSpeakerCount ?? 0,
            });
            setSpeakerTranscript({
                text: speakerData.transcript?.displayText ?? "",
                detectedLanguage:
                    speakerData.transcript?.detectedLanguage ?? null,
                transcriptionType:
                    speakerData.transcript?.transcriptionType ?? null,
                provider: speakerData.transcript?.provider ?? null,
                model: speakerData.transcript?.model ?? null,
                createdAt: speakerData.transcript?.createdAt ?? null,
                wordCount: speakerData.transcript?.wordCount ?? 0,
                characterCount: speakerData.transcript?.characterCount ?? 0,
                mappedSpeakerCount:
                    speakerData.transcript?.mappedSpeakerCount ?? 0,
            });
        } catch {
            setReviewError(t("speakerReview.failedToLoadTranscriptReview"));
        } finally {
            setIsReviewLoading(false);
        }
    }, [recordingId, t]);

    useEffect(() => {
        void Promise.all([refreshSpeakers(), refreshTranscriptReview()]);
        return () => stopPlayback();
    }, [refreshSpeakers, refreshTranscriptReview, stopPlayback]);

    useEffect(() => {
        if (!isMergePopoverOpen) {
            return;
        }

        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target;
            if (
                target instanceof Node &&
                mergeAnchorRef.current?.contains(target)
            ) {
                return;
            }
            setIsMergePopoverOpen(false);
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setIsMergePopoverOpen(false);
                mergeButtonRef.current?.focus();
            }
        };

        document.addEventListener("pointerdown", handlePointerDown);
        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("pointerdown", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isMergePopoverOpen]);

    const handlePlaySample = useCallback(
        (rawLabel: string, index: number) => {
            const speaker = speakers.find((item) => item.rawLabel === rawLabel);
            const segment = speaker?.sampleSegments?.[index];
            if (segment?.startMs == null || segment.endMs == null) {
                toast.error(t("speakerReview.noPlayableSample"));
                return;
            }
            const startMs = segment.startMs;
            const endMs = segment.endMs;

            let audio = audioRef.current;
            if (!audio) {
                audio = new Audio(`/api/recordings/${recordingId}/audio`);
                audioRef.current = audio;
            }

            stopPlayback();
            setPlayingKey(`${rawLabel}:${index}`);

            audio.src = `/api/recordings/${recordingId}/audio`;
            audio.load();
            audio.onloadedmetadata = () => {
                audio.currentTime = startMs / 1000;
                void audio.play().catch(() => {
                    toast.error(t("speakerReview.failedToPlaySample"));
                    stopPlayback();
                });
            };
            audio.ontimeupdate = () => {
                if (audio.currentTime >= endMs / 1000) {
                    stopPlayback();
                }
            };
        },
        [recordingId, speakers, stopPlayback, t],
    );

    const applyLocalMap = useCallback(
        (rawLabel: string, displayName: string | null) => {
            if (!onSpeakerMapChanged) {
                return;
            }

            const nextMap = {
                ...speakerMapRef.current,
            };

            if (displayName) {
                nextMap[rawLabel] = displayName;
            } else {
                delete nextMap[rawLabel];
            }

            speakerMapRef.current = nextMap;
            onSpeakerMapChanged(nextMap);
        },
        [onSpeakerMapChanged],
    );

    const handleAssignProfile = useCallback(
        async (
            rawLabel: string,
            profileId: string | null,
            profileName?: string,
        ) => {
            const failedPayload: SpeakerSaveError = {
                rawLabel,
                profileId,
                profileName,
            };
            const markSaveError = () => {
                setSpeakerSaveErrors((prev) => ({
                    ...prev,
                    [rawLabel]: failedPayload,
                }));
                setOpenPickerFor((current) =>
                    current === rawLabel ? null : current,
                );
                setConfirmUnlinkFor((current) =>
                    current === rawLabel ? null : current,
                );
            };

            setIsSaving(rawLabel);
            clearSpeakerSaveError(rawLabel);
            try {
                const response = await fetch(
                    `/api/recordings/${recordingId}/speakers`,
                    {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            rawLabel,
                            profileId,
                            profileName,
                        }),
                    },
                );
                let data: { error?: string; profileId?: string | null } = {};
                try {
                    data = await response.json();
                } catch {
                    data = {};
                }

                if (!response.ok) {
                    markSaveError();
                    toast.error(
                        data.error || t("speakerReview.failedToUpdateSpeaker"),
                    );
                    return;
                }

                clearSpeakerSaveError(rawLabel);
                const resolvedName =
                    profileName ||
                    (data.profileId ? profileNameById[data.profileId] : null) ||
                    null;
                applyLocalMap(rawLabel, resolvedName);
                await Promise.all([
                    refreshSpeakers(),
                    refreshTranscriptReview(),
                ]);
                setConfirmUnlinkFor((current) =>
                    current === rawLabel ? null : current,
                );
                setOpenPickerFor((current) =>
                    current === rawLabel ? null : current,
                );
                setEditingSpeakerFor((current) =>
                    current === rawLabel ? null : current,
                );
                toast.success(t("speakerReview.speakerUpdated"));
            } catch {
                markSaveError();
                toast.error(t("speakerReview.failedToUpdateSpeaker"));
            } finally {
                setIsSaving(null);
            }
        },
        [
            applyLocalMap,
            clearSpeakerSaveError,
            profileNameById,
            recordingId,
            refreshSpeakers,
            refreshTranscriptReview,
            t,
        ],
    );

    const handleSaveInlineRename = useCallback(
        async (speaker: RecordingSpeaker) => {
            const draft =
                speakerNameDrafts[speaker.rawLabel]?.trim() ??
                speaker.matchedProfileName ??
                speaker.rawLabel;
            const nextName = draft || speaker.rawLabel;
            const exactProfile = profiles.find(
                (profile) =>
                    profile.displayName.toLocaleLowerCase(language) ===
                    nextName.toLocaleLowerCase(language),
            );
            const nextProfileId =
                exactProfile?.id ??
                (nextName === speaker.matchedProfileName
                    ? speaker.matchedProfileId
                    : null);

            await handleAssignProfile(
                speaker.rawLabel,
                nextProfileId,
                nextName,
            );
            closeInlineRename(speaker.rawLabel);
        },
        [
            closeInlineRename,
            handleAssignProfile,
            language,
            profiles,
            speakerNameDrafts,
        ],
    );

    const handleCopyRawTranscript = useCallback(async () => {
        const copyText = rawTranscript?.text ?? "";
        if (!copyText.trim()) {
            toast.error(t("speakerReview.failedToLoadTranscriptReview"));
            return;
        }

        setIsCopyingRawTranscript(true);
        try {
            await writeBrowserClipboardText(copyText);
            toast.success(t("speakerReview.rawTranscriptCopied"));
        } catch {
            toast.error(t("speakerReview.copyRawTranscriptFailed"));
        } finally {
            setIsCopyingRawTranscript(false);
        }
    }, [rawTranscript?.text, t]);

    const panelLabel = t("speakerReview.title");
    const getSpeakerRowState = useCallback(
        (speaker: RecordingSpeaker) => {
            if (speakerSaveErrors[speaker.rawLabel]) {
                return "error";
            }

            if (isSaving === speaker.rawLabel) {
                return "saving";
            }

            if (editingSpeakerFor === speaker.rawLabel) {
                return "editing";
            }

            if (confirmUnlinkFor === speaker.rawLabel) {
                return "confirm-unlink";
            }

            const normalizedQuery = (
                searchQueries[speaker.rawLabel] ?? ""
            ).trim();
            const normalizedQueryForMatch =
                normalizedQuery.toLocaleLowerCase(language);
            const hasLiveNoMatch =
                openPickerFor === speaker.rawLabel &&
                !speaker.matchedProfileId &&
                normalizedQuery.length > 0 &&
                profiles.length > 0 &&
                !profiles.some((profile) =>
                    profile.displayName
                        .toLocaleLowerCase(language)
                        .includes(normalizedQueryForMatch),
                );

            return hasLiveNoMatch ? "no-match" : undefined;
        },
        [
            confirmUnlinkFor,
            editingSpeakerFor,
            isSaving,
            language,
            openPickerFor,
            profiles,
            searchQueries,
            speakerSaveErrors,
        ],
    );

    if (isLoading) {
        return (
            <section
                aria-label={panelLabel}
                data-sot-panel="speaker-review"
                data-sot-state="loading"
            >
                <SpeakerReviewSkeleton />
            </section>
        );
    }

    return (
        <section
            className="t-pane"
            aria-label={panelLabel}
            data-tab-pane="speakers"
            data-sot-panel="speaker-review"
            data-sot-state={
                isReviewLoading
                    ? "refreshing"
                    : reviewError
                      ? "error"
                      : activeReview
                        ? speakers.length === 0
                            ? "empty"
                            : "ready"
                        : "empty"
            }
        >
            <Card hasNoPadding data-sot-part="speaker-review-transcript-card">
                <CardHeader data-sot-part="speaker-review-header">
                    <div data-sot-part="speaker-review-header-copy">
                        <FileText aria-hidden="true" />
                        <div>
                            <CardTitle data-sot-part="speaker-review-title">
                                {t("speakerReview.transcriptReviewTitle")}
                            </CardTitle>
                            <CardDescription data-sot-part="speaker-review-description">
                                {t("speakerReview.transcriptReviewDescription")}
                            </CardDescription>
                        </div>
                    </div>
                    <CardAction data-sot-part="speaker-review-actions">
                        <ToggleGroup
                            type="single"
                            value={reviewMode}
                            size="sm"
                            spacing={1}
                            aria-label={t("speakerReview.title")}
                            data-sot-control="speaker-review-mode"
                            onValueChange={(value) => {
                                if (value === "speaker" || value === "raw") {
                                    setReviewMode(value);
                                }
                            }}
                        >
                            <ToggleGroupItem
                                value="speaker"
                                data-sot-control="speaker-review-mode-option"
                            >
                                {t("speakerReview.speakerNamesMode")}
                            </ToggleGroupItem>
                            <ToggleGroupItem
                                value="raw"
                                data-sot-control="speaker-review-mode-option"
                            >
                                {t("speakerReview.rawLabelsMode")}
                            </ToggleGroupItem>
                        </ToggleGroup>
                        <Button
                            type="button"
                            size="sm"
                            onClick={handleCopyRawTranscript}
                            disabled={
                                isCopyingRawTranscript ||
                                isReviewLoading ||
                                !canCopyRawTranscript
                            }
                            aria-busy={isCopyingRawTranscript}
                            data-sot-control="speaker-review-copy-raw"
                        >
                            <Copy data-icon="inline-start" />
                            {isCopyingRawTranscript
                                ? t("common.copying")
                                : t("speakerReview.copyRawTranscript")}
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => void refreshTranscriptReview()}
                            disabled={isReviewLoading}
                            data-sot-control="speaker-review-refresh"
                        >
                            <RefreshCw data-icon="inline-start" />
                            {t("speakerReview.refresh")}
                        </Button>
                        <div
                            data-sot-part="speaker-review-merge-anchor"
                            ref={mergeAnchorRef}
                        >
                            <Button
                                ref={mergeButtonRef}
                                type="button"
                                size="sm"
                                variant="ghost"
                                data-spk-merge
                                data-sot-control="speaker-review-merge"
                                aria-controls={mergePopoverId}
                                aria-expanded={isMergePopoverOpen}
                                onClick={() =>
                                    setIsMergePopoverOpen((current) => !current)
                                }
                            >
                                合并相似…
                            </Button>
                            <Card
                                hasNoPadding
                                id={mergePopoverId}
                                data-sot-panel="speaker-review-merge"
                                data-spk-merge-pop
                                data-open={String(isMergePopoverOpen)}
                                hidden={!isMergePopoverOpen}
                                role="dialog"
                                aria-label="合并相似说话人"
                            >
                                <CardHeader data-sot-part="speaker-review-merge-header">
                                    <CardTitle data-sot-part="speaker-review-merge-title">
                                        合并相似说话人
                                    </CardTitle>
                                    <CardAction>
                                        <Button
                                            variant="ghost"
                                            size="icon-sm"
                                            data-spk-merge-close
                                            type="button"
                                            aria-label="关闭"
                                            onClick={() =>
                                                setIsMergePopoverOpen(false)
                                            }
                                        >
                                            <X
                                                data-icon="inline-start"
                                                aria-hidden="true"
                                                focusable="false"
                                            />
                                        </Button>
                                    </CardAction>
                                </CardHeader>
                                <CardContent data-sot-part="speaker-review-merge-empty">
                                    <div
                                        data-sot-part="speaker-review-merge-empty-icon"
                                        aria-hidden="true"
                                    >
                                        <svg
                                            viewBox="0 0 24 24"
                                            aria-hidden="true"
                                            focusable="false"
                                        >
                                            <path d="M20 6 9 17l-5-5" />
                                        </svg>
                                    </div>
                                    <p data-sot-part="speaker-review-merge-empty-title">
                                        当前没有可合并的相似说话人
                                    </p>
                                    <p data-sot-part="speaker-review-merge-empty-description">
                                        如果两位说话人声纹接近，会出现在这里供你确认。
                                    </p>
                                </CardContent>
                            </Card>
                        </div>
                    </CardAction>
                </CardHeader>

                {isReviewLoading ? (
                    <TranscriptReviewSkeleton />
                ) : reviewError ? (
                    <Alert
                        variant="destructive"
                        data-sot-part="speaker-review-state"
                        data-sot-state="error"
                    >
                        <AlertTitle>{reviewError}</AlertTitle>
                    </Alert>
                ) : activeReview ? (
                    <CardContent data-sot-part="speaker-review-transcript-content">
                        <div
                            data-sot-list="speaker-review-meta"
                        >
                            {activeReview.detectedLanguage ? (
                                <span>
                                    {t("speakerReview.languageLabel")}:{" "}
                                    {activeReview.detectedLanguage}
                                </span>
                            ) : null}
                            {activeReview.transcriptionType ? (
                                <span>
                                    {t("speakerReview.sourceLabel")}:{" "}
                                    {formatTranscriptionType(
                                        activeReview.transcriptionType,
                                        t,
                                    )}
                                </span>
                            ) : null}
                            {activeReview.provider ? (
                                <span>
                                    {t("speakerReview.providerLabel")}:{" "}
                                    {formatProviderName(activeReview.provider)}
                                </span>
                            ) : null}
                            {activeReview.model ? (
                                <span>
                                    {t("speakerReview.modelLabel")}:{" "}
                                    {activeReview.model}
                                </span>
                            ) : null}
                            {formatReviewTimestamp(
                                activeReview.createdAt,
                                language,
                            ) ? (
                                <span>
                                    {t("speakerReview.capturedAt", {
                                        time:
                                            formatReviewTimestamp(
                                                activeReview.createdAt,
                                                language,
                                            ) ?? "",
                                    })}
                                </span>
                            ) : null}
                            <span>
                                {t("speakerReview.wordCount", {
                                    count: activeReview.wordCount,
                                })}
                            </span>
                            <span>
                                {t("speakerReview.characterCount", {
                                    count: activeReview.characterCount,
                                })}
                            </span>
                            <span>
                                {t("speakerReview.mappedNamesCount", {
                                    count: activeReview.mappedSpeakerCount,
                                })}
                            </span>
                        </div>
                        <div data-sot-part="speaker-review-transcript-section">
                            <p data-sot-part="speaker-review-segment-text">
                                {activeReview.text}
                            </p>
                        </div>
                    </CardContent>
                ) : null}
            </Card>

            {speakerLoadError ? (
                <Alert
                    variant="destructive"
                    data-sot-part="speaker-review-state"
                    data-sot-state="speaker-load-error"
                >
                    <AlertTitle>{speakerLoadError}</AlertTitle>
                    <AlertDescription>
                        <Button
                            type="button"
                            size="sm"
                            onClick={() => void refreshSpeakers()}
                            disabled={isLoading}
                            data-sot-control="speaker-review-refresh-speakers"
                        >
                            <RefreshCw data-icon="inline-start" />
                            {t("speakerReview.refresh")}
                        </Button>
                    </AlertDescription>
                </Alert>
            ) : speakers.length === 0 ? (
                <Card hasNoPadding data-sot-part="speaker-review-empty">
                    {t("speakerReview.noDetectedSpeakers")}
                </Card>
            ) : (
                <div
                    role="list"
                    data-sot-list="speaker-review-rows"
                    data-sot-variant="review"
                >
                    {speakers.map((speaker) => (
                        <Card
                            key={speaker.rawLabel}
                            role="listitem"
                            hasNoPadding
                            data-sot-item="speaker-review-row"
                            data-sot-speaker-has-playable-sample={String(
                                speaker.hasPlayableSample,
                            )}
                            data-sot-speaker-has-voiceprint={String(
                                speaker.hasVoiceprint,
                            )}
                            data-sot-speaker-label={speaker.rawLabel}
                            data-sot-speaker-mapped={String(
                                Boolean(speaker.matchedProfileId),
                            )}
                            data-state={getSpeakerRowState(speaker)}
                        >
                            {(() => {
                                const searchQuery =
                                    searchQueries[speaker.rawLabel] ?? "";
                                const isPickerOpen =
                                    openPickerFor === speaker.rawLabel;
                                const filteredProfiles = profiles.filter(
                                    (profile) =>
                                        profile.displayName
                                            .toLocaleLowerCase(language)
                                            .includes(
                                                searchQuery
                                                    .trim()
                                                    .toLocaleLowerCase(
                                                        language,
                                                    ),
                                            ),
                                );
                                const normalizedQuery = searchQuery.trim();
                                const matchedName =
                                    speaker.matchedProfileName ??
                                    t("speakerReview.savedSpeaker");
                                const inlineRenameDraft =
                                    speakerNameDrafts[speaker.rawLabel] ??
                                    speaker.matchedProfileName ??
                                    speaker.rawLabel;
                                const hasExactMatch = profiles.some(
                                    (profile) =>
                                        profile.displayName.toLocaleLowerCase(
                                            language,
                                        ) ===
                                        normalizedQuery.toLocaleLowerCase(
                                            language,
                                        ),
                                );
                                const isSpeakerSaving =
                                    isSaving === speaker.rawLabel;
                                const isInlineEditing =
                                    editingSpeakerFor === speaker.rawLabel;
                                const saveError =
                                    speakerSaveErrors[speaker.rawLabel];
                                const isConfirmingUnlink =
                                    confirmUnlinkFor === speaker.rawLabel;
                                const hasLiveNoMatch =
                                    isPickerOpen &&
                                    !speaker.matchedProfileId &&
                                    normalizedQuery.length > 0 &&
                                    profiles.length > 0 &&
                                    filteredProfiles.length === 0;
                                const mappingInputId = getSpeakerMappingInputId(
                                    recordingId,
                                    speaker.rawLabel,
                                );

                                if (isInlineEditing) {
                                    return (
                                        <>
                                            <div data-sot-part="speaker-review-row-meta">
                                                <Input
                                                    value={inlineRenameDraft}
                                                    data-spk-input
                                                    data-sot-control="speaker-review-inline-name"
                                                    autoComplete="off"
                                                    autoFocus
                                                    aria-label={`${speaker.rawLabel} 重命名`}
                                                    disabled={isSpeakerSaving}
                                                    onChange={(event) => {
                                                        const value =
                                                            event.target.value;
                                                        setSpeakerNameDrafts(
                                                            (prev) => ({
                                                                ...prev,
                                                                [speaker.rawLabel]:
                                                                    value,
                                                            }),
                                                        );
                                                    }}
                                                    onKeyDown={(event) => {
                                                        if (
                                                            event.key ===
                                                            "Escape"
                                                        ) {
                                                            event.preventDefault();
                                                            closeInlineRename(
                                                                speaker.rawLabel,
                                                            );
                                                            return;
                                                        }

                                                        if (
                                                            event.key ===
                                                            "Enter"
                                                        ) {
                                                            event.preventDefault();
                                                            if (
                                                                !inlineRenameDraft.trim() ||
                                                                isSpeakerSaving
                                                            ) {
                                                                return;
                                                            }

                                                            void handleSaveInlineRename(
                                                                speaker,
                                                            );
                                                        }
                                                    }}
                                                />
                                            </div>
                                            <div data-sot-part="speaker-review-actions">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="ghost"
                                                    data-spk-cancel
                                                    data-sot-control="speaker-review-inline-cancel"
                                                    disabled={isSpeakerSaving}
                                                    onClick={() =>
                                                        closeInlineRename(
                                                            speaker.rawLabel,
                                                        )
                                                    }
                                                >
                                                    {t("common.cancel")}
                                                </Button>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="primary"
                                                    data-spk-save
                                                    data-sot-control="speaker-review-inline-save"
                                                    disabled={
                                                        isSpeakerSaving ||
                                                        !inlineRenameDraft.trim()
                                                    }
                                                    aria-busy={isSpeakerSaving}
                                                    onClick={() =>
                                                        void handleSaveInlineRename(
                                                            speaker,
                                                        )
                                                    }
                                                >
                                                    {isSpeakerSaving
                                                        ? t("common.saving")
                                                        : t("common.save")}
                                                </Button>
                                            </div>
                                        </>
                                    );
                                }

                                return (
                                    <>
                                        <div data-sot-part="speaker-review-row-meta">
                                            <div>
                                                <p data-sot-part="speaker-review-row-name">
                                                    {speaker.rawLabel}
                                                </p>
                                                {saveError ? (
                                                    <div
                                                        data-sot-part="speaker-review-row-sub"
                                                        data-sot-tone="danger"
                                                    >
                                                        {t(
                                                            "speakerReview.saveFailedRetry",
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div data-sot-part="speaker-review-row-sub">
                                                        <span>
                                                            {hasLiveNoMatch
                                                                ? t(
                                                                      "speakerReview.noMatchingSpeakers",
                                                                  )
                                                                : speaker.matchedProfileId
                                                                  ? t(
                                                                        "speakerReview.mappedTo",
                                                                        {
                                                                            name:
                                                                                speaker.matchedProfileName ??
                                                                                t(
                                                                                    "speakerReview.savedSpeaker",
                                                                                ),
                                                                        },
                                                                    )
                                                                  : t(
                                                                        "speakerReview.notMappedYet",
                                                                    )}
                                                        </span>
                                                        {speaker.segmentCount >
                                                        0 ? (
                                                            <span>
                                                                {t(
                                                                    "speakerReview.detectedTurns",
                                                                    {
                                                                        count: speaker.segmentCount,
                                                                    },
                                                                )}
                                                            </span>
                                                        ) : null}
                                                        {speaker.matchedProfileId ? (
                                                            <span>
                                                                {speaker.hasVoiceprint
                                                                    ? t(
                                                                          "speakerReview.voiceprintReady",
                                                                      )
                                                                    : t(
                                                                          "speakerReview.voiceprintMissing",
                                                                      )}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                )}
                                            </div>
                                            {saveError ? (
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="ghost"
                                                    data-sot-control="speaker-review-save-retry"
                                                    disabled={isSpeakerSaving}
                                                    onClick={() =>
                                                        void handleAssignProfile(
                                                            saveError.rawLabel,
                                                            saveError.profileId,
                                                            saveError.profileName,
                                                        )
                                                    }
                                                >
                                                    {t("common.retry")}
                                                </Button>
                                            ) : (
                                                <div data-sot-part="speaker-review-actions">
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="ghost"
                                                        data-spk-rename
                                                        data-sot-control="speaker-review-rename"
                                                        disabled={
                                                            isSpeakerSaving ||
                                                            isConfirmingUnlink
                                                        }
                                                        onClick={() =>
                                                            openInlineRename(
                                                                speaker,
                                                            )
                                                        }
                                                    >
                                                        重命名
                                                    </Button>
                                                    {speaker.hasPlayableSample ? null : (
                                                        <Badge
                                                            variant="outline"
                                                            data-sot-part="speaker-review-voiceprint-pill"
                                                            data-sot-tone="warning"
                                                        >
                                                            <Volume2 data-icon="inline-start" />
                                                            {t(
                                                                "speakerReview.noTimedSamples",
                                                            )}
                                                        </Badge>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div
                                            data-sot-part="speaker-review-samples"
                                        >
                                            <div data-sot-part="speaker-review-section-head">
                                                <p data-sot-part="speaker-review-section-title">
                                                    {t(
                                                        "speakerReview.samplesTitle",
                                                    )}
                                                </p>
                                                <p data-sot-part="speaker-review-section-description">
                                                    {t(
                                                        "speakerReview.samplesDescription",
                                                    )}
                                                </p>
                                            </div>
                                            {speaker.sampleCount > 0 ? (
                                                <div data-sot-list="speaker-review-sample-segments">
                                                    {speaker.sampleSegments.map(
                                                        (segment, index) => (
                                                            <div
                                                                key={`${speaker.rawLabel}-preview-${segment.startMs ?? index}`}
                                                                data-sot-item="speaker-review-sample-segment"
                                                            >
                                                                <div data-sot-part="speaker-review-segment-meta">
                                                                    <p data-sot-part="speaker-review-segment-title">
                                                                        {t(
                                                                            "speakerReview.sample",
                                                                            {
                                                                                index:
                                                                                    index +
                                                                                    1,
                                                                            },
                                                                        )}
                                                                        {formatSegmentWindow(
                                                                            segment.startMs,
                                                                            segment.endMs,
                                                                        )
                                                                            ? ` · ${formatSegmentWindow(
                                                                                  segment.startMs,
                                                                                  segment.endMs,
                                                                              )}`
                                                                            : ""}
                                                                    </p>
                                                                    <Button
                                                                        type="button"
                                                                        size="sm"
                                                                        data-sot-control="speaker-review-play-sample"
                                                                        onClick={() =>
                                                                            handlePlaySample(
                                                                                speaker.rawLabel,
                                                                                index,
                                                                            )
                                                                        }
                                                                    >
                                                                        <Play data-icon="inline-start" />
                                                                        {playingKey ===
                                                                        `${speaker.rawLabel}:${index}`
                                                                            ? t(
                                                                                  "speakerReview.playing",
                                                                              )
                                                                            : t(
                                                                                  "speakerReview.playSample",
                                                                              )}
                                                                    </Button>
                                                                </div>
                                                                <p data-sot-part="speaker-review-segment-text">
                                                                    {segment.text?.trim() ||
                                                                        t(
                                                                            "speakerReview.noSampleSnippet",
                                                                        )}
                                                                </p>
                                                            </div>
                                                        ),
                                                    )}
                                                </div>
                                            ) : (
                                                <Card
                                                    hasNoPadding
                                                    data-sot-part="speaker-review-empty"
                                                    data-sot-state="no-samples"
                                                >
                                                    {t(
                                                        "speakerReview.noTimedSamples",
                                                    )}
                                                </Card>
                                            )}
                                        </div>

                                        <Field
                                            data-sot-part="speaker-review-mapping-field"
                                            data-disabled={
                                                isSpeakerSaving
                                                    ? true
                                                    : undefined
                                            }
                                        >
                                            <FieldLabel
                                                htmlFor={mappingInputId}
                                            >
                                                {t(
                                                    "speakerReview.mappingTitle",
                                                )}
                                            </FieldLabel>
                                            <FieldContent>
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        id={mappingInputId}
                                                        value={searchQuery}
                                                        data-sot-control="speaker-review-mapping-input"
                                                        onFocus={() => {
                                                            if (
                                                                isSpeakerSaving ||
                                                                isConfirmingUnlink
                                                            ) {
                                                                return;
                                                            }

                                                            setConfirmUnlinkFor(
                                                                null,
                                                            );
                                                            clearSpeakerSaveError(
                                                                speaker.rawLabel,
                                                            );
                                                            setOpenPickerFor(
                                                                speaker.rawLabel,
                                                            );
                                                        }}
                                                        onBlur={() => {
                                                            startBrowserTimeout(
                                                                () => {
                                                                    setOpenPickerFor(
                                                                        (
                                                                            current,
                                                                        ) =>
                                                                            current ===
                                                                            speaker.rawLabel
                                                                                ? null
                                                                                : current,
                                                                    );
                                                                },
                                                                120,
                                                            );
                                                        }}
                                                        onChange={(event) => {
                                                            if (
                                                                isSpeakerSaving
                                                            ) {
                                                                return;
                                                            }

                                                            const value =
                                                                event.target
                                                                    .value;
                                                            setSearchQueries(
                                                                (prev) => ({
                                                                    ...prev,
                                                                    [speaker.rawLabel]:
                                                                        value,
                                                                }),
                                                            );
                                                            setConfirmUnlinkFor(
                                                                null,
                                                            );
                                                            clearSpeakerSaveError(
                                                                speaker.rawLabel,
                                                            );
                                                            setOpenPickerFor(
                                                                speaker.rawLabel,
                                                            );
                                                        }}
                                                        placeholder={t(
                                                            "speakerReview.searchOrCreateSpeakerPlaceholder",
                                                        )}
                                                        disabled={
                                                            isSpeakerSaving
                                                        }
                                                    />
                                                    {searchQuery.trim() ? (
                                                        <Button
                                                            type="button"
                                                            size="icon"
                                                            variant="ghost"
                                                            aria-label={t(
                                                                "speakerReview.clearSelectedSpeaker",
                                                            )}
                                                            disabled={
                                                                isSpeakerSaving
                                                            }
                                                            data-sot-control="speaker-review-mapping-clear"
                                                            onMouseDown={(
                                                                event,
                                                            ) =>
                                                                event.preventDefault()
                                                            }
                                                            onClick={() => {
                                                                if (
                                                                    isSpeakerSaving
                                                                ) {
                                                                    return;
                                                                }

                                                                setSearchQueries(
                                                                    (prev) => ({
                                                                        ...prev,
                                                                        [speaker.rawLabel]:
                                                                            "",
                                                                    }),
                                                                );
                                                                setConfirmUnlinkFor(
                                                                    null,
                                                                );
                                                                clearSpeakerSaveError(
                                                                    speaker.rawLabel,
                                                                );
                                                                setOpenPickerFor(
                                                                    speaker.rawLabel,
                                                                );
                                                            }}
                                                        >
                                                            <X data-icon="inline-start" />
                                                        </Button>
                                                    ) : null}
                                                </div>
                                            </FieldContent>
                                            {speaker.matchedProfileId ? (
                                                isConfirmingUnlink ? (
                                                    <Card
                                                        hasNoPadding
                                                        data-sot-confirm="speaker-unlink"
                                                        data-sot-confirm-state={
                                                            isSpeakerSaving
                                                                ? "saving"
                                                                : "idle"
                                                        }
                                                        aria-busy={
                                                            isSpeakerSaving
                                                        }
                                                    >
                                                        <p
                                                            data-sot-confirm-message
                                                        >
                                                            {t(
                                                                "speakerReview.confirmUnlinkMessagePrefix",
                                                            )}
                                                            <em
                                                                data-sot-confirm-subject
                                                            >
                                                                {matchedName}
                                                            </em>
                                                            {t(
                                                                "speakerReview.confirmUnlinkMessageSuffix",
                                                            )}
                                                        </p>
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="ghost"
                                                            data-sot-confirm-action="cancel"
                                                            disabled={
                                                                isSpeakerSaving
                                                            }
                                                            onClick={() =>
                                                                setConfirmUnlinkFor(
                                                                    null,
                                                                )
                                                            }
                                                        >
                                                            {t("common.cancel")}
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="danger"
                                                            data-sot-confirm-action="confirm"
                                                            disabled={
                                                                isSpeakerSaving
                                                            }
                                                            onClick={() =>
                                                                void handleAssignProfile(
                                                                    speaker.rawLabel,
                                                                    null,
                                                                )
                                                            }
                                                        >
                                                            {t(
                                                                "speakerReview.unlink",
                                                            )}
                                                        </Button>
                                                    </Card>
                                                ) : (
                                                    <div data-sot-part="speaker-review-actions">
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            data-sot-control="speaker-review-unlink"
                                                            disabled={
                                                                isSpeakerSaving
                                                            }
                                                            onClick={() => {
                                                                if (
                                                                    isSpeakerSaving
                                                                ) {
                                                                    return;
                                                                }
                                                                setOpenPickerFor(
                                                                    null,
                                                                );
                                                                clearSpeakerSaveError(
                                                                    speaker.rawLabel,
                                                                );
                                                                setConfirmUnlinkFor(
                                                                    speaker.rawLabel,
                                                                );
                                                            }}
                                                        >
                                                            {t(
                                                                "speakerReview.unlink",
                                                            )}
                                                        </Button>
                                                        <p data-sot-part="speaker-review-row-sub">
                                                            {t(
                                                                "speakerReview.currentAssignment",
                                                                {
                                                                    name: matchedName,
                                                                },
                                                            )}
                                                        </p>
                                                    </div>
                                                )
                                            ) : null}

                                            {isPickerOpen ? (
                                                profiles.length === 0 &&
                                                !normalizedQuery ? (
                                                    <Card
                                                        hasNoPadding
                                                        data-sot-part="speaker-review-empty"
                                                        data-sot-state="no-saved-speakers"
                                                    >
                                                        {t(
                                                            "speakerReview.noSavedSpeakers",
                                                        )}
                                                    </Card>
                                                ) : (
                                                    <div data-sot-list="speaker-review-suggestions">
                                                        {filteredProfiles.map(
                                                            (profile) => (
                                                                <Button
                                                                    key={
                                                                        profile.id
                                                                    }
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    data-sot-control="speaker-review-suggestion"
                                                                    disabled={
                                                                        isSpeakerSaving ||
                                                                        speaker.matchedProfileId ===
                                                                            profile.id
                                                                    }
                                                                    onMouseDown={(
                                                                        event,
                                                                    ) =>
                                                                        event.preventDefault()
                                                                    }
                                                                    onClick={() => {
                                                                        if (
                                                                            isSpeakerSaving ||
                                                                            speaker.matchedProfileId ===
                                                                                profile.id
                                                                        ) {
                                                                            return;
                                                                        }

                                                                        setSearchQueries(
                                                                            (
                                                                                prev,
                                                                            ) => ({
                                                                                ...prev,
                                                                                [speaker.rawLabel]:
                                                                                    profile.displayName,
                                                                            }),
                                                                        );
                                                                        void handleAssignProfile(
                                                                            speaker.rawLabel,
                                                                            profile.id,
                                                                        );
                                                                    }}
                                                                >
                                                                    <span>
                                                                        {
                                                                            profile.displayName
                                                                        }
                                                                    </span>
                                                                    <Badge
                                                                        variant="outline"
                                                                        data-sot-part="speaker-review-voiceprint-pill"
                                                                    >
                                                                        {speaker.matchedProfileId ===
                                                                        profile.id
                                                                            ? t(
                                                                                  "speakerReview.selected",
                                                                              )
                                                                            : profile.hasVoiceprint
                                                                              ? t(
                                                                                    "speakerReview.voiceprintReady",
                                                                                )
                                                                              : t(
                                                                                    "speakerReview.voiceprintMissing",
                                                                                )}
                                                                    </Badge>
                                                                </Button>
                                                            ),
                                                        )}
                                                        {normalizedQuery &&
                                                        !hasExactMatch ? (
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                data-sot-control="speaker-review-suggestion"
                                                                data-sot-state="create"
                                                                disabled={
                                                                    isSpeakerSaving
                                                                }
                                                                onMouseDown={(
                                                                    event,
                                                                ) =>
                                                                    event.preventDefault()
                                                                }
                                                                onClick={() => {
                                                                    if (
                                                                        isSpeakerSaving
                                                                    ) {
                                                                        return;
                                                                    }

                                                                    setSearchQueries(
                                                                        (
                                                                            prev,
                                                                        ) => ({
                                                                            ...prev,
                                                                            [speaker.rawLabel]:
                                                                                normalizedQuery,
                                                                        }),
                                                                    );
                                                                    void handleAssignProfile(
                                                                        speaker.rawLabel,
                                                                        null,
                                                                        normalizedQuery,
                                                                    );
                                                                }}
                                                            >
                                                                <span>
                                                                    {t(
                                                                        "speakerReview.createSpeakerOption",
                                                                        {
                                                                            name: normalizedQuery,
                                                                        },
                                                                    )}
                                                                </span>
                                                            </Button>
                                                        ) : null}
                                                        {filteredProfiles.length ===
                                                            0 &&
                                                        !normalizedQuery ? (
                                                            <Card
                                                                hasNoPadding
                                                                data-sot-part="speaker-review-empty"
                                                                data-sot-state="no-saved-speakers"
                                                            >
                                                                {t(
                                                                    "speakerReview.noSavedSpeakers",
                                                                )}
                                                            </Card>
                                                        ) : null}
                                                        {filteredProfiles.length ===
                                                            0 &&
                                                        normalizedQuery &&
                                                        hasLiveNoMatch ? (
                                                            <Card
                                                                hasNoPadding
                                                                data-sot-part="speaker-review-empty"
                                                                data-sot-state="no-matching-speakers"
                                                            >
                                                                {t(
                                                                    "speakerReview.noMatchingSpeakers",
                                                                )}
                                                            </Card>
                                                        ) : null}
                                                    </div>
                                                )
                                            ) : null}
                                        </Field>
                                    </>
                                );
                            })()}
                        </Card>
                    ))}
                </div>
            )}
        </section>
    );
}
