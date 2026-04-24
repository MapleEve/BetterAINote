"use client";

import { FileText, Play, RefreshCw, UserRound, Volume2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { startBrowserTimeout } from "@/lib/platform/browser-shell";
import { cn } from "@/lib/utils";

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

    return parsed.toLocaleString(language);
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
    const [speakers, setSpeakers] = useState<RecordingSpeaker[]>([]);
    const [profiles, setProfiles] = useState<SpeakerProfile[]>([]);
    const [searchQueries, setSearchQueries] = useState<Record<string, string>>(
        {},
    );
    const [openPickerFor, setOpenPickerFor] = useState<string | null>(null);
    const [playingKey, setPlayingKey] = useState<string | null>(null);
    const [reviewMode, setReviewMode] =
        useState<TranscriptReviewMode>("speaker");
    const [isReviewLoading, setIsReviewLoading] = useState(true);
    const [reviewError, setReviewError] = useState<string | null>(null);
    const [rawTranscript, setRawTranscript] = useState<TranscriptReview | null>(
        null,
    );
    const [speakerTranscript, setSpeakerTranscript] =
        useState<TranscriptReview | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
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

    useEffect(() => {
        speakerMapRef.current = speakerMap ?? {};
    }, [speakerMap]);

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
        try {
            const response = await fetch(
                `/api/recordings/${recordingId}/speakers`,
                {
                    cache: "no-store",
                },
            );
            const data = await response.json();
            if (!response.ok) {
                toast.error(
                    data.error || t("speakerReview.failedToLoadSpeakers"),
                );
                return;
            }

            setSpeakers(data.speakers ?? []);
            setProfiles(data.profiles ?? []);
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
            setSpeakers([]);
            setProfiles([]);
            setSearchQueries({});
            toast.error(t("speakerReview.failedToLoadSpeakers"));
        } finally {
            setIsLoading(false);
        }
    }, [recordingId, t]);

    const refreshTranscriptReview = useCallback(async () => {
        setIsReviewLoading(true);
        setReviewError(null);
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
            setIsSaving(rawLabel);
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
                const data = await response.json();
                if (!response.ok) {
                    toast.error(
                        data.error || t("speakerReview.failedToUpdateSpeaker"),
                    );
                    return;
                }

                const resolvedName =
                    profileName ||
                    (data.profileId ? profileNameById[data.profileId] : null) ||
                    null;
                applyLocalMap(rawLabel, resolvedName);
                await Promise.all([
                    refreshSpeakers(),
                    refreshTranscriptReview(),
                ]);
                setOpenPickerFor((current) =>
                    current === rawLabel ? null : current,
                );
                toast.success(t("speakerReview.speakerUpdated"));
            } catch {
                toast.error(t("speakerReview.failedToUpdateSpeaker"));
            } finally {
                setIsSaving(null);
            }
        },
        [
            applyLocalMap,
            profileNameById,
            recordingId,
            refreshSpeakers,
            refreshTranscriptReview,
            t,
        ],
    );

    if (isLoading) {
        return (
            <div className="rounded-lg border px-4 py-3 text-sm text-muted-foreground">
                {t("speakerReview.loadingSpeakerLabels")}
            </div>
        );
    }

    if (speakers.length === 0) {
        return null;
    }

    return (
        <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center gap-2">
                <UserRound className="h-4 w-4 text-muted-foreground" />
                <div>
                    <p className="text-sm font-medium">
                        {t("speakerReview.title")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {t("speakerReview.description")}
                    </p>
                </div>
            </div>

            <div className="space-y-3 rounded-lg border bg-muted/10 p-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <div>
                            <p className="text-sm font-medium">
                                {t("speakerReview.transcriptReviewTitle")}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {t("speakerReview.transcriptReviewDescription")}
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            type="button"
                            size="sm"
                            variant={
                                reviewMode === "speaker" ? "default" : "outline"
                            }
                            onClick={() => setReviewMode("speaker")}
                        >
                            {t("speakerReview.speakerNamesMode")}
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant={
                                reviewMode === "raw" ? "default" : "outline"
                            }
                            onClick={() => setReviewMode("raw")}
                        >
                            {t("speakerReview.rawLabelsMode")}
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => void refreshTranscriptReview()}
                            disabled={isReviewLoading}
                        >
                            <RefreshCw
                                className={`mr-2 h-3.5 w-3.5 ${isReviewLoading ? "animate-spin" : ""}`}
                            />
                            {t("speakerReview.refresh")}
                        </Button>
                    </div>
                </div>

                {isReviewLoading ? (
                    <div className="rounded-lg border bg-background px-4 py-3 text-sm text-muted-foreground">
                        {t("speakerReview.loadingTranscriptReview")}
                    </div>
                ) : reviewError ? (
                    <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
                        {reviewError}
                    </div>
                ) : activeReview ? (
                    <>
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
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
                        <div className="max-h-72 overflow-y-auto rounded-lg border bg-background p-3">
                            <p className="whitespace-pre-wrap text-sm leading-relaxed">
                                {activeReview.text}
                            </p>
                        </div>
                    </>
                ) : null}
            </div>

            <div className="space-y-4">
                {speakers.map((speaker) => (
                    <div
                        key={speaker.rawLabel}
                        className="space-y-4 rounded-xl border bg-muted/20 p-4"
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
                                                .toLocaleLowerCase(language),
                                        ),
                            );
                            const normalizedQuery = searchQuery.trim();
                            const hasExactMatch = profiles.some(
                                (profile) =>
                                    profile.displayName.toLocaleLowerCase(
                                        language,
                                    ) ===
                                    normalizedQuery.toLocaleLowerCase(language),
                            );

                            return (
                                <>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="space-y-1">
                                            <p className="text-sm font-medium">
                                                {speaker.rawLabel}
                                            </p>
                                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                                <span>
                                                    {speaker.matchedProfileId
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
                                                {speaker.segmentCount > 0 ? (
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
                                        </div>
                                        {speaker.hasPlayableSample ? null : (
                                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                                <Volume2 className="h-3.5 w-3.5" />
                                                {t(
                                                    "speakerReview.noTimedSamples",
                                                )}
                                            </span>
                                        )}
                                    </div>

                                    <div className="space-y-2 rounded-lg border bg-background/60 p-3">
                                        <div className="space-y-1">
                                            <p className="text-xs font-medium">
                                                {t(
                                                    "speakerReview.samplesTitle",
                                                )}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {t(
                                                    "speakerReview.samplesDescription",
                                                )}
                                            </p>
                                        </div>
                                        {speaker.sampleCount > 0 ? (
                                            <div className="grid gap-2 md:grid-cols-3">
                                                {speaker.sampleSegments.map(
                                                    (segment, index) => (
                                                        <div
                                                            key={`${speaker.rawLabel}-preview-${segment.startMs ?? index}`}
                                                            className="space-y-3 rounded-lg border bg-background/80 p-3"
                                                        >
                                                            <div className="flex items-start justify-between gap-3">
                                                                <p className="text-xs font-medium text-muted-foreground">
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
                                                                    variant="outline"
                                                                    className="shrink-0"
                                                                    onClick={() =>
                                                                        handlePlaySample(
                                                                            speaker.rawLabel,
                                                                            index,
                                                                        )
                                                                    }
                                                                >
                                                                    <Play className="h-3.5 w-3.5" />
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
                                                            <p className="text-xs leading-relaxed text-muted-foreground">
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
                                            <div className="text-xs text-muted-foreground">
                                                {t(
                                                    "speakerReview.noTimedSamples",
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-2 rounded-lg border bg-background/60 p-3">
                                        <div className="space-y-1">
                                            <Label>
                                                {t(
                                                    "speakerReview.mappingTitle",
                                                )}
                                            </Label>
                                            <p className="text-xs text-muted-foreground">
                                                {t(
                                                    "speakerReview.mappingDescription",
                                                )}
                                            </p>
                                        </div>
                                        <div className="relative">
                                            <Input
                                                value={searchQuery}
                                                onFocus={() =>
                                                    setOpenPickerFor(
                                                        speaker.rawLabel,
                                                    )
                                                }
                                                onBlur={() => {
                                                    startBrowserTimeout(() => {
                                                        setOpenPickerFor(
                                                            (current) =>
                                                                current ===
                                                                speaker.rawLabel
                                                                    ? null
                                                                    : current,
                                                        );
                                                    }, 120);
                                                }}
                                                onChange={(event) => {
                                                    const value =
                                                        event.target.value;
                                                    setSearchQueries(
                                                        (prev) => ({
                                                            ...prev,
                                                            [speaker.rawLabel]:
                                                                value,
                                                        }),
                                                    );
                                                    setOpenPickerFor(
                                                        speaker.rawLabel,
                                                    );
                                                }}
                                                placeholder={t(
                                                    "speakerReview.searchOrCreateSpeakerPlaceholder",
                                                )}
                                                className={
                                                    searchQuery.trim()
                                                        ? "pr-10"
                                                        : undefined
                                                }
                                            />
                                            {searchQuery.trim() ? (
                                                <Button
                                                    type="button"
                                                    size="icon"
                                                    variant="ghost"
                                                    className="absolute right-1 top-1 size-8"
                                                    aria-label={t(
                                                        "speakerReview.clearSelectedSpeaker",
                                                    )}
                                                    disabled={
                                                        isSaving ===
                                                        speaker.rawLabel
                                                    }
                                                    onMouseDown={(event) =>
                                                        event.preventDefault()
                                                    }
                                                    onClick={() => {
                                                        setSearchQueries(
                                                            (prev) => ({
                                                                ...prev,
                                                                [speaker.rawLabel]:
                                                                    "",
                                                            }),
                                                        );
                                                        setOpenPickerFor(
                                                            speaker.rawLabel,
                                                        );
                                                    }}
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                </Button>
                                            ) : null}
                                        </div>
                                        {speaker.matchedProfileId ? (
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={
                                                        isSaving ===
                                                        speaker.rawLabel
                                                    }
                                                    onClick={() =>
                                                        void handleAssignProfile(
                                                            speaker.rawLabel,
                                                            null,
                                                        )
                                                    }
                                                >
                                                    {t("speakerReview.unlink")}
                                                </Button>
                                                <p className="text-xs text-muted-foreground">
                                                    {t(
                                                        "speakerReview.currentAssignment",
                                                        {
                                                            name:
                                                                speaker.matchedProfileName ??
                                                                t(
                                                                    "speakerReview.savedSpeaker",
                                                                ),
                                                        },
                                                    )}
                                                </p>
                                            </div>
                                        ) : null}

                                        {isPickerOpen ? (
                                            profiles.length === 0 &&
                                            !normalizedQuery ? (
                                                <div className="rounded-lg border bg-background px-3 py-2 text-sm text-muted-foreground">
                                                    {t(
                                                        "speakerReview.noSavedSpeakers",
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="max-h-52 overflow-y-auto rounded-lg border bg-background">
                                                    {filteredProfiles.map(
                                                        (profile) => (
                                                            <button
                                                                key={profile.id}
                                                                type="button"
                                                                className={cn(
                                                                    "flex w-full items-center justify-between border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted/60",
                                                                    speaker.matchedProfileId ===
                                                                        profile.id &&
                                                                        "bg-muted",
                                                                )}
                                                                onMouseDown={(
                                                                    event,
                                                                ) =>
                                                                    event.preventDefault()
                                                                }
                                                                onClick={() => {
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
                                                                <span className="text-xs text-muted-foreground">
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
                                                                </span>
                                                            </button>
                                                        ),
                                                    )}
                                                    {normalizedQuery &&
                                                    !hasExactMatch ? (
                                                        <button
                                                            type="button"
                                                            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted/60"
                                                            onMouseDown={(
                                                                event,
                                                            ) =>
                                                                event.preventDefault()
                                                            }
                                                            onClick={() => {
                                                                setSearchQueries(
                                                                    (prev) => ({
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
                                                        </button>
                                                    ) : null}
                                                    {filteredProfiles.length ===
                                                        0 &&
                                                    !normalizedQuery ? (
                                                        <div className="px-3 py-2 text-sm text-muted-foreground">
                                                            {t(
                                                                "speakerReview.noSavedSpeakers",
                                                            )}
                                                        </div>
                                                    ) : null}
                                                    {filteredProfiles.length ===
                                                        0 &&
                                                    normalizedQuery &&
                                                    hasExactMatch ? (
                                                        <div className="px-3 py-2 text-sm text-muted-foreground">
                                                            {t(
                                                                "speakerReview.noMatchingSpeakers",
                                                            )}
                                                        </div>
                                                    ) : null}
                                                </div>
                                            )
                                        ) : null}
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                ))}
            </div>
        </div>
    );
}
