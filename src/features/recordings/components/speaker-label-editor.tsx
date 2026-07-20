"use client";

import {
    Check,
    Copy,
    FileText,
    Play,
    RefreshCw,
    Volume2,
    X,
} from "lucide-react";
import type { ComponentProps } from "react";
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
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldContent, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
} from "@/components/ui/input-group";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
    SpeakerReviewSkeleton,
    TranscriptReviewSkeleton,
} from "@/features/recordings/components/transcription-skeletons";
import { formatDateTime } from "@/lib/format-date";
import { startBrowserTimeout } from "@/lib/platform/browser-shell";
import { writeBrowserClipboardText } from "@/lib/platform/clipboard";
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

interface SpeakerSaveError {
    rawLabel: string;
    profileId: string | null;
    profileName: string | undefined;
}

const SPEAKER_REVIEW_CARD_CLASS_NAMES = {
    transcript: "gap-0",
    row: "grid items-center gap-2.5 overflow-visible rounded-md border-(--card-elevated-border) bg-(--card-elevated-bg) px-3 py-2.5",
    mergePopover:
        "w-80 min-w-72 gap-0 overflow-hidden rounded-[12px] border-(--card-popover-border) bg-(--card-popover-bg) p-0 shadow-(--card-popover-shadow) backdrop-blur-none",
    confirm:
        "flex-row items-center gap-2.5 overflow-visible border-destructive/30 bg-destructive/5 p-3 text-sm",
} as const;

const SPEAKER_REVIEW_CARD_HEADER_CLASS_NAMES = {
    transcript:
        "flex items-center justify-between gap-2.5 px-4 pt-3 pb-2 max-[860px]:flex-col max-[860px]:items-stretch",
    mergePopover:
        "flex flex-row items-center justify-between gap-2.5 border-b border-(--card-popover-divider) px-3 py-2.5 [.border-b]:pb-2.5",
} as const;

const SPEAKER_REVIEW_CARD_TITLE_CLASS_NAMES = {
    title: "leading-none font-semibold",
    mergeTitle: "relative top-px text-xs font-semibold leading-normal",
} as const;

const SPEAKER_REVIEW_CARD_CONTENT_CLASS_NAMES = {
    transcript: "px-4 pb-4",
    mergePopover: "p-0",
} as const;

const SPEAKER_REVIEW_CARD_DESCRIPTION_CLASS_NAME =
    "text-sm text-muted-foreground";

const SPEAKER_REVIEW_CARD_ACTION_CLASS_NAME =
    "flex min-w-0 flex-wrap items-center justify-end gap-1.5 max-[860px]:justify-start";
const SPEAKER_REVIEW_MERGE_CARD_ACTION_CLASS_NAME =
    "self-auto justify-self-auto leading-none";

const SPEAKER_REVIEW_ACTION_BUTTON_CLASS_NAME = "min-w-0";
const SPEAKER_REVIEW_PRIMARY_BUTTON_CLASS_NAME = "min-w-0";
const SPEAKER_REVIEW_GHOST_BUTTON_CLASS_NAME = "min-w-0";
const SPEAKER_REVIEW_DANGER_BUTTON_CLASS_NAME = "min-w-0";
const SPEAKER_REVIEW_SUGGESTION_BUTTON_CLASS_NAME =
    "grid h-auto min-h-8 w-full grid-cols-[minmax(0,1fr)_auto] justify-stretch gap-2 whitespace-normal px-2 py-1.5 text-left has-[>svg]:px-2 data-[speaker-review-state=create]:grid-cols-1";
const SPEAKER_REVIEW_ICON_BUTTON_CLASS_NAME =
    "shrink-0 rounded-[8px] border border-transparent text-(--fg-secondary)";
const SPEAKER_REVIEW_MODE_ITEM_CLASS_NAME = "px-2.5";
const SPEAKER_REVIEW_ERROR_ALERT_CLASS_NAME =
    "grid w-full gap-2 px-3 py-2.5 text-sm leading-normal";
const SPEAKER_REVIEW_ERROR_TITLE_CLASS_NAME =
    "min-h-0 font-medium leading-normal tracking-normal";
const SPEAKER_REVIEW_ERROR_DESCRIPTION_CLASS_NAME =
    "flex items-center gap-2 text-xs leading-normal text-current";
const SPEAKER_REVIEW_INLINE_EMPTY_CLASS_NAME = "px-6 py-4 md:p-4";
const SPEAKER_REVIEW_MERGE_EMPTY_CLASS_NAME =
    "px-4 py-[22px] text-pretty md:px-4 md:py-[22px]";
const SPEAKER_REVIEW_HEADER_COPY_CLASS_NAME =
    "flex min-w-0 items-center gap-2.5";
const SPEAKER_REVIEW_META_LIST_CLASS_NAME =
    "my-4 grid grid-cols-2 gap-x-3.5 gap-y-1.5 max-[640px]:grid-cols-1";
const SPEAKER_REVIEW_TRANSCRIPT_SECTION_CLASS_NAME =
    "flex flex-col gap-2 border-t pt-2";
const SPEAKER_REVIEW_CONFIRM_MESSAGE_CLASS_NAME = "min-w-0 flex-1";
const SPEAKER_REVIEW_CONFIRM_SUBJECT_CLASS_NAME = "font-semibold not-italic";
const SPEAKER_REVIEW_ERROR_ACTION_CLASS_NAME = "min-w-0 w-fit";
const SPEAKER_REVIEW_MERGE_EMPTY_TITLE_CLASS_NAME = "mb-0.5 leading-[normal]";
const SPEAKER_REVIEW_MERGE_EMPTY_DESCRIPTION_CLASS_NAME = "leading-[normal]";
const SPEAKER_REVIEW_MAPPING_CLEAR_BUTTON_CLASS_NAME = "shrink-0";
const SPEAKER_REVIEW_META_ITEM_CLASS_NAME =
    "min-w-0 truncate text-xs font-medium leading-normal text-muted-foreground";
const SPEAKER_REVIEW_SECTION_DESCRIPTION_CLASS_NAME =
    "m-0 text-xs font-medium leading-normal text-muted-foreground max-[860px]:whitespace-normal max-[860px]:break-words";
const SPEAKER_REVIEW_SEGMENT_TITLE_CLASS_NAME =
    "m-0 text-xs font-semibold leading-normal text-muted-foreground";
const SPEAKER_REVIEW_SEGMENT_TEXT_CLASS_NAME =
    "m-0 text-sm font-medium leading-relaxed text-pretty text-foreground max-[860px]:whitespace-normal max-[860px]:break-words";
const SPEAKER_REVIEW_ROW_NAME_CLASS_NAME =
    "m-0 text-[13px]! font-semibold leading-[1.35]! text-(--fg-primary)!";
const SPEAKER_REVIEW_SECTION_TITLE_CLASS_NAME =
    "m-0 text-sm font-semibold leading-snug text-foreground";
const SPEAKER_REVIEW_ROW_SUB_CLASS_NAME =
    "m-0 font-mono text-[11.5px] font-medium leading-[1.4] tracking-[0.02em] text-(--fg-tertiary) data-[speaker-review-tone=danger]:text-destructive max-[860px]:whitespace-normal max-[860px]:break-words";

type ClassNameProp = {
    className?: string;
};

type SpeakerReviewVoiceprintTone = "missing" | "ready" | "selected";

type SpeakerReviewVoiceprintBadgeVariant = NonNullable<
    ComponentProps<typeof Badge>["variant"]
>;

const SPEAKER_REVIEW_VOICEPRINT_BADGE_VARIANTS = {
    missing: "secondary",
    ready: "outline",
    selected: "default",
} satisfies Record<
    SpeakerReviewVoiceprintTone,
    SpeakerReviewVoiceprintBadgeVariant
>;

function SpeakerReviewCard({
    className,
    surface,
    ...props
}: Omit<ComponentProps<typeof Card>, "className" | "variant"> &
    ClassNameProp & {
        surface: keyof typeof SPEAKER_REVIEW_CARD_CLASS_NAMES;
    }) {
    return (
        <Card
            className={cn(SPEAKER_REVIEW_CARD_CLASS_NAMES[surface], className)}
            {...props}
        />
    );
}

function SpeakerReviewCardHeader({
    className,
    surface,
    ...props
}: Omit<ComponentProps<typeof CardHeader>, "className" | "variant"> &
    ClassNameProp & {
        surface: keyof typeof SPEAKER_REVIEW_CARD_HEADER_CLASS_NAMES;
    }) {
    return (
        <CardHeader
            className={cn(
                SPEAKER_REVIEW_CARD_HEADER_CLASS_NAMES[surface],
                className,
            )}
            {...props}
        />
    );
}

function SpeakerReviewCardTitle({
    className,
    surface,
    ...props
}: Omit<ComponentProps<typeof CardTitle>, "className" | "variant"> &
    ClassNameProp & {
        surface: keyof typeof SPEAKER_REVIEW_CARD_TITLE_CLASS_NAMES;
    }) {
    return (
        <CardTitle
            className={cn(
                SPEAKER_REVIEW_CARD_TITLE_CLASS_NAMES[surface],
                className,
            )}
            {...props}
        />
    );
}

function SpeakerReviewCardDescription({
    className,
    ...props
}: Omit<ComponentProps<typeof CardDescription>, "className" | "variant"> &
    ClassNameProp) {
    return (
        <CardDescription
            className={cn(
                SPEAKER_REVIEW_CARD_DESCRIPTION_CLASS_NAME,
                className,
            )}
            {...props}
        />
    );
}

function SpeakerReviewCardAction({
    className,
    ...props
}: Omit<ComponentProps<typeof CardAction>, "className" | "variant"> &
    ClassNameProp) {
    return (
        <CardAction
            className={cn(SPEAKER_REVIEW_CARD_ACTION_CLASS_NAME, className)}
            {...props}
        />
    );
}

function SpeakerReviewCardContent({
    className,
    surface,
    ...props
}: Omit<ComponentProps<typeof CardContent>, "className" | "variant"> &
    ClassNameProp & {
        surface: keyof typeof SPEAKER_REVIEW_CARD_CONTENT_CLASS_NAMES;
    }) {
    return (
        <CardContent
            className={cn(
                SPEAKER_REVIEW_CARD_CONTENT_CLASS_NAMES[surface],
                className,
            )}
            {...props}
        />
    );
}

function SpeakerReviewVoiceprintBadge({
    "data-speaker-review-tone": tone,
    ...props
}: Omit<
    ComponentProps<typeof Badge>,
    "className" | "data-speaker-review-tone" | "variant"
> & {
    "data-speaker-review-tone": SpeakerReviewVoiceprintTone;
}) {
    return (
        <Badge
            variant={SPEAKER_REVIEW_VOICEPRINT_BADGE_VARIANTS[tone]}
            data-speaker-review-tone={tone}
            {...props}
        />
    );
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
    const searchQueryRevisionRef = useRef(0);
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
        const queryRevisionAtStart = searchQueryRevisionRef.current;
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
                if (searchQueryRevisionRef.current === queryRevisionAtStart) {
                    setSearchQueries({});
                }
                setSpeakerLoadError(message);
                toast.error(message);
                return;
            }

            setSpeakerLoadError(null);
            setSpeakers(data.speakers ?? []);
            setProfiles(data.profiles ?? []);
            const nextSpeakers = data.speakers ?? [];
            if (searchQueryRevisionRef.current === queryRevisionAtStart) {
                setSearchQueries(
                    Object.fromEntries(
                        nextSpeakers.map((speaker: RecordingSpeaker) => [
                            speaker.rawLabel,
                            speaker.matchedProfileName ?? "",
                        ]),
                    ),
                );
            }
        } catch {
            const message = t("speakerReview.failedToLoadSpeakers");
            setSpeakers([]);
            setProfiles([]);
            if (searchQueryRevisionRef.current === queryRevisionAtStart) {
                setSearchQueries({});
            }
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
                aria-busy="true"
                data-speaker-review-panel="speaker-review"
                data-speaker-review-state="loading"
            >
                <SpeakerReviewSkeleton />
            </section>
        );
    }

    return (
        <section
            aria-label={panelLabel}
            aria-busy={isReviewLoading}
            data-tab-pane="speakers"
            data-speaker-review-panel="speaker-review"
            data-speaker-review-state={
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
            <SpeakerReviewCard
                hasNoPadding
                surface="transcript"
                data-speaker-review-part="speaker-review-transcript-card"
            >
                <SpeakerReviewCardHeader
                    surface="transcript"
                    data-speaker-review-part="speaker-review-header"
                >
                    <div
                        className={SPEAKER_REVIEW_HEADER_COPY_CLASS_NAME}
                        data-speaker-review-part="speaker-review-header-copy"
                    >
                        <FileText
                            className="size-6 shrink-0"
                            strokeWidth={2}
                            aria-hidden="true"
                            focusable="false"
                        />
                        <div className="min-w-0">
                            <SpeakerReviewCardTitle
                                surface="title"
                                data-speaker-review-part="speaker-review-title"
                            >
                                {t("speakerReview.transcriptReviewTitle")}
                            </SpeakerReviewCardTitle>
                            <SpeakerReviewCardDescription data-speaker-review-part="speaker-review-description">
                                {t("speakerReview.transcriptReviewDescription")}
                            </SpeakerReviewCardDescription>
                        </div>
                    </div>
                    <SpeakerReviewCardAction data-speaker-review-part="speaker-review-actions">
                        <ToggleGroup
                            type="single"
                            value={reviewMode}
                            variant="default"
                            size="sm"
                            className="flex-nowrap"
                            spacing={1}
                            aria-label={t("speakerReview.title")}
                            data-speaker-review-control="speaker-review-mode"
                            onValueChange={(value) => {
                                if (value === "speaker" || value === "raw") {
                                    setReviewMode(value);
                                }
                            }}
                        >
                            <ToggleGroupItem
                                value="speaker"
                                className={SPEAKER_REVIEW_MODE_ITEM_CLASS_NAME}
                                data-speaker-review-control="speaker-review-mode-option"
                            >
                                {t("speakerReview.speakerNamesMode")}
                            </ToggleGroupItem>
                            <ToggleGroupItem
                                value="raw"
                                className={SPEAKER_REVIEW_MODE_ITEM_CLASS_NAME}
                                data-speaker-review-control="speaker-review-mode-option"
                            >
                                {t("speakerReview.rawLabelsMode")}
                            </ToggleGroupItem>
                        </ToggleGroup>
                        <Button
                            type="button"
                            variant="default"
                            size="sm"
                            className={SPEAKER_REVIEW_PRIMARY_BUTTON_CLASS_NAME}
                            onClick={handleCopyRawTranscript}
                            disabled={
                                isCopyingRawTranscript ||
                                isReviewLoading ||
                                !canCopyRawTranscript
                            }
                            aria-busy={isCopyingRawTranscript}
                            data-speaker-review-control="speaker-review-copy-raw"
                        >
                            <Copy
                                className="size-6 shrink-0"
                                strokeWidth={2}
                                data-icon="inline-start"
                                aria-hidden="true"
                                focusable="false"
                            />
                            {isCopyingRawTranscript
                                ? t("common.copying")
                                : t("speakerReview.copyRawTranscript")}
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className={SPEAKER_REVIEW_GHOST_BUTTON_CLASS_NAME}
                            onClick={() => void refreshTranscriptReview()}
                            disabled={isReviewLoading}
                            data-speaker-review-control="speaker-review-refresh"
                        >
                            <RefreshCw
                                className="size-6 shrink-0"
                                strokeWidth={2}
                                data-icon="inline-start"
                                aria-hidden="true"
                                focusable="false"
                            />
                            {t("speakerReview.refresh")}
                        </Button>
                        <Popover
                            open={isMergePopoverOpen}
                            onOpenChange={setIsMergePopoverOpen}
                            modal={false}
                        >
                            <PopoverTrigger asChild>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className={
                                        SPEAKER_REVIEW_GHOST_BUTTON_CLASS_NAME
                                    }
                                    data-spk-merge
                                    data-speaker-review-control="speaker-review-merge"
                                    aria-controls={mergePopoverId}
                                    aria-expanded={isMergePopoverOpen}
                                >
                                    合并相似…
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent
                                align="end"
                                side="bottom"
                                sideOffset={8}
                                avoidCollisions={false}
                                onOpenAutoFocus={(event) =>
                                    event.preventDefault()
                                }
                                className={
                                    SPEAKER_REVIEW_CARD_CLASS_NAMES.mergePopover
                                }
                                id={mergePopoverId}
                                data-speaker-review-panel="speaker-review-merge"
                                data-spk-merge-pop
                                data-open={String(isMergePopoverOpen)}
                                aria-label="合并相似说话人"
                            >
                                <SpeakerReviewCardHeader
                                    surface="mergePopover"
                                    data-speaker-review-part="speaker-review-merge-header"
                                >
                                    <SpeakerReviewCardTitle
                                        surface="mergeTitle"
                                        data-speaker-review-part="speaker-review-merge-title"
                                    >
                                        合并相似说话人
                                    </SpeakerReviewCardTitle>
                                    <CardAction
                                        className={
                                            SPEAKER_REVIEW_MERGE_CARD_ACTION_CLASS_NAME
                                        }
                                    >
                                        <Button
                                            variant="ghost"
                                            size="icon-sm"
                                            className={
                                                SPEAKER_REVIEW_ICON_BUTTON_CLASS_NAME
                                            }
                                            data-spk-merge-close
                                            type="button"
                                            aria-label="关闭"
                                            onClick={() =>
                                                setIsMergePopoverOpen(false)
                                            }
                                        >
                                            <X
                                                className="size-4 shrink-0"
                                                strokeWidth={1.8}
                                                data-icon="inline-start"
                                                aria-hidden="true"
                                                focusable="false"
                                            />
                                        </Button>
                                    </CardAction>
                                </SpeakerReviewCardHeader>
                                <SpeakerReviewCardContent surface="mergePopover">
                                    <Empty
                                        variant="compact"
                                        className={
                                            SPEAKER_REVIEW_MERGE_EMPTY_CLASS_NAME
                                        }
                                        data-speaker-review-part="speaker-review-merge-empty"
                                    >
                                        <EmptyHeader variant="popover">
                                            <EmptyMedia
                                                variant="subtleIcon"
                                                data-speaker-review-part="speaker-review-merge-empty-icon"
                                            >
                                                <Check
                                                    className="size-3.5 shrink-0"
                                                    strokeWidth={1.8}
                                                    aria-hidden="true"
                                                    focusable="false"
                                                />
                                            </EmptyMedia>
                                            <EmptyTitle
                                                variant="compact"
                                                className={
                                                    SPEAKER_REVIEW_MERGE_EMPTY_TITLE_CLASS_NAME
                                                }
                                                data-speaker-review-part="speaker-review-merge-empty-title"
                                            >
                                                当前没有可合并的相似说话人
                                            </EmptyTitle>
                                            <EmptyDescription
                                                variant="compact"
                                                className={
                                                    SPEAKER_REVIEW_MERGE_EMPTY_DESCRIPTION_CLASS_NAME
                                                }
                                                data-speaker-review-part="speaker-review-merge-empty-description"
                                            >
                                                如果两位说话人声纹接近，会出现在这里供你确认。
                                            </EmptyDescription>
                                        </EmptyHeader>
                                    </Empty>
                                </SpeakerReviewCardContent>
                            </PopoverContent>
                        </Popover>
                    </SpeakerReviewCardAction>
                </SpeakerReviewCardHeader>

                {isReviewLoading ? (
                    <TranscriptReviewSkeleton />
                ) : reviewError ? (
                    <Alert
                        variant="statusError"
                        className={SPEAKER_REVIEW_ERROR_ALERT_CLASS_NAME}
                        data-speaker-review-part="speaker-review-state"
                        data-speaker-review-state="error"
                    >
                        <AlertTitle
                            className={SPEAKER_REVIEW_ERROR_TITLE_CLASS_NAME}
                        >
                            {reviewError}
                        </AlertTitle>
                    </Alert>
                ) : activeReview ? (
                    <SpeakerReviewCardContent
                        surface="transcript"
                        data-speaker-review-part="speaker-review-transcript-content"
                    >
                        <div
                            className={SPEAKER_REVIEW_META_LIST_CLASS_NAME}
                            data-speaker-review-list="speaker-review-meta"
                        >
                            {activeReview.detectedLanguage ? (
                                <span
                                    className={
                                        SPEAKER_REVIEW_META_ITEM_CLASS_NAME
                                    }
                                >
                                    {t("speakerReview.languageLabel")}:{" "}
                                    {activeReview.detectedLanguage}
                                </span>
                            ) : null}
                            {activeReview.transcriptionType ? (
                                <span
                                    className={
                                        SPEAKER_REVIEW_META_ITEM_CLASS_NAME
                                    }
                                >
                                    {t("speakerReview.sourceLabel")}:{" "}
                                    {formatTranscriptionType(
                                        activeReview.transcriptionType,
                                        t,
                                    )}
                                </span>
                            ) : null}
                            {activeReview.provider ? (
                                <span
                                    className={
                                        SPEAKER_REVIEW_META_ITEM_CLASS_NAME
                                    }
                                >
                                    {t("speakerReview.providerLabel")}:{" "}
                                    {formatProviderName(activeReview.provider)}
                                </span>
                            ) : null}
                            {activeReview.model ? (
                                <span
                                    className={
                                        SPEAKER_REVIEW_META_ITEM_CLASS_NAME
                                    }
                                >
                                    {t("speakerReview.modelLabel")}:{" "}
                                    {activeReview.model}
                                </span>
                            ) : null}
                            {formatReviewTimestamp(
                                activeReview.createdAt,
                                language,
                            ) ? (
                                <span
                                    className={
                                        SPEAKER_REVIEW_META_ITEM_CLASS_NAME
                                    }
                                >
                                    {t("speakerReview.capturedAt", {
                                        time:
                                            formatReviewTimestamp(
                                                activeReview.createdAt,
                                                language,
                                            ) ?? "",
                                    })}
                                </span>
                            ) : null}
                            <span
                                className={SPEAKER_REVIEW_META_ITEM_CLASS_NAME}
                            >
                                {t("speakerReview.wordCount", {
                                    count: activeReview.wordCount,
                                })}
                            </span>
                            <span
                                className={SPEAKER_REVIEW_META_ITEM_CLASS_NAME}
                            >
                                {t("speakerReview.characterCount", {
                                    count: activeReview.characterCount,
                                })}
                            </span>
                            <span
                                className={SPEAKER_REVIEW_META_ITEM_CLASS_NAME}
                            >
                                {t("speakerReview.mappedNamesCount", {
                                    count: activeReview.mappedSpeakerCount,
                                })}
                            </span>
                        </div>
                        <div
                            className={
                                SPEAKER_REVIEW_TRANSCRIPT_SECTION_CLASS_NAME
                            }
                            data-speaker-review-part="speaker-review-transcript-section"
                        >
                            <p
                                className={
                                    SPEAKER_REVIEW_SEGMENT_TEXT_CLASS_NAME
                                }
                                data-speaker-review-part="speaker-review-segment-text"
                            >
                                {activeReview.text}
                            </p>
                        </div>
                    </SpeakerReviewCardContent>
                ) : null}
            </SpeakerReviewCard>

            {speakerLoadError ? (
                <Alert
                    variant="statusError"
                    className={SPEAKER_REVIEW_ERROR_ALERT_CLASS_NAME}
                    data-speaker-review-part="speaker-review-state"
                    data-speaker-review-state="speaker-load-error"
                >
                    <AlertTitle
                        className={SPEAKER_REVIEW_ERROR_TITLE_CLASS_NAME}
                    >
                        {speakerLoadError}
                    </AlertTitle>
                    <AlertDescription
                        className={SPEAKER_REVIEW_ERROR_DESCRIPTION_CLASS_NAME}
                    >
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className={SPEAKER_REVIEW_ERROR_ACTION_CLASS_NAME}
                            onClick={() => void refreshSpeakers()}
                            disabled={isLoading}
                            data-speaker-review-control="speaker-review-refresh-speakers"
                        >
                            <RefreshCw
                                className="size-6 shrink-0"
                                strokeWidth={2}
                                data-icon="inline-start"
                                aria-hidden="true"
                                focusable="false"
                            />
                            {t("speakerReview.refresh")}
                        </Button>
                    </AlertDescription>
                </Alert>
            ) : speakers.length === 0 ? (
                <Empty
                    variant="default"
                    data-speaker-review-part="speaker-review-empty"
                    data-speaker-review-state="no-detected-speakers"
                >
                    <EmptyHeader variant="default">
                        <EmptyTitle variant="default">
                            {t("speakerReview.noDetectedSpeakers")}
                        </EmptyTitle>
                    </EmptyHeader>
                </Empty>
            ) : (
                <div
                    className="flex flex-col gap-[6px]"
                    data-speaker-review-list="speaker-review-rows"
                    data-speaker-review-variant="review"
                >
                    {speakers.map((speaker) => (
                        <SpeakerReviewCard
                            key={speaker.rawLabel}
                            hasNoPadding
                            surface="row"
                            data-speaker-review-item="speaker-review-row"
                            data-speaker-has-playable-sample={String(
                                speaker.hasPlayableSample,
                            )}
                            data-speaker-has-voiceprint={String(
                                speaker.hasVoiceprint,
                            )}
                            data-speaker-label={speaker.rawLabel}
                            data-speaker-mapped={String(
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
                                const canCreateSpeaker =
                                    normalizedQuery.length > 0 &&
                                    !hasExactMatch;
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
                                const inlineRenameInputId = `${mappingInputId}-inline-name`;

                                if (isInlineEditing) {
                                    return (
                                        <>
                                            <Field
                                                className="min-w-0"
                                                data-speaker-review-part="speaker-review-row-meta"
                                                data-disabled={
                                                    isSpeakerSaving
                                                        ? true
                                                        : undefined
                                                }
                                            >
                                                <FieldLabel
                                                    className="sr-only"
                                                    htmlFor={
                                                        inlineRenameInputId
                                                    }
                                                >
                                                    {`${speaker.rawLabel} 重命名`}
                                                </FieldLabel>
                                                <FieldContent>
                                                    <Input
                                                        id={inlineRenameInputId}
                                                        className="h-8 min-w-60"
                                                        value={
                                                            inlineRenameDraft
                                                        }
                                                        data-spk-input
                                                        data-speaker-review-control="speaker-review-inline-name"
                                                        autoComplete="off"
                                                        autoFocus
                                                        aria-label={`${speaker.rawLabel} 重命名`}
                                                        aria-busy={
                                                            isSpeakerSaving
                                                        }
                                                        disabled={
                                                            isSpeakerSaving
                                                        }
                                                        onChange={(event) => {
                                                            const value =
                                                                event.target
                                                                    .value;
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
                                                </FieldContent>
                                            </Field>
                                            <div
                                                className="inline-flex min-w-0 flex-wrap items-center justify-end gap-1.5 max-[860px]:justify-start"
                                                data-speaker-review-part="speaker-review-actions"
                                            >
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className={
                                                        SPEAKER_REVIEW_GHOST_BUTTON_CLASS_NAME
                                                    }
                                                    data-spk-cancel
                                                    data-speaker-review-control="speaker-review-inline-cancel"
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
                                                    variant="default"
                                                    size="sm"
                                                    className={
                                                        SPEAKER_REVIEW_PRIMARY_BUTTON_CLASS_NAME
                                                    }
                                                    data-spk-save
                                                    data-speaker-review-control="speaker-review-inline-save"
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
                                        <div
                                            className="flex min-w-0 flex-col gap-[2px]"
                                            data-speaker-review-part="speaker-review-row-meta"
                                        >
                                            <div>
                                                <p
                                                    className={
                                                        SPEAKER_REVIEW_ROW_NAME_CLASS_NAME
                                                    }
                                                    data-speaker-review-part="speaker-review-row-name"
                                                >
                                                    {speaker.rawLabel}
                                                </p>
                                                {saveError ? (
                                                    <div
                                                        className={
                                                            SPEAKER_REVIEW_ROW_SUB_CLASS_NAME
                                                        }
                                                        data-speaker-review-part="speaker-review-row-sub"
                                                        data-speaker-review-tone="danger"
                                                    >
                                                        {t(
                                                            "speakerReview.saveFailedRetry",
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div
                                                        className={
                                                            SPEAKER_REVIEW_ROW_SUB_CLASS_NAME
                                                        }
                                                        data-speaker-review-part="speaker-review-row-sub"
                                                    >
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
                                                    variant="ghost"
                                                    size="sm"
                                                    className={
                                                        SPEAKER_REVIEW_GHOST_BUTTON_CLASS_NAME
                                                    }
                                                    data-speaker-review-control="speaker-review-save-retry"
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
                                                <div
                                                    className="inline-flex min-w-0 flex-wrap items-center justify-end gap-1.5 max-[860px]:justify-start"
                                                    data-speaker-review-part="speaker-review-actions"
                                                >
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className={
                                                            SPEAKER_REVIEW_GHOST_BUTTON_CLASS_NAME
                                                        }
                                                        data-spk-rename
                                                        data-speaker-review-control="speaker-review-rename"
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
                                                        <SpeakerReviewVoiceprintBadge
                                                            data-speaker-review-part="speaker-review-voiceprint-pill"
                                                            data-speaker-review-tone="missing"
                                                        >
                                                            <Volume2
                                                                className="size-3 shrink-0"
                                                                strokeWidth={2}
                                                                data-icon="inline-start"
                                                                aria-hidden="true"
                                                                focusable="false"
                                                            />
                                                            {t(
                                                                "speakerReview.noTimedSamples",
                                                            )}
                                                        </SpeakerReviewVoiceprintBadge>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div
                                            className="flex flex-col gap-2 border-t pt-2"
                                            data-speaker-review-part="speaker-review-samples"
                                        >
                                            <div
                                                className="flex items-baseline gap-2.5"
                                                data-speaker-review-part="speaker-review-section-head"
                                            >
                                                <p
                                                    className={
                                                        SPEAKER_REVIEW_SECTION_TITLE_CLASS_NAME
                                                    }
                                                    data-speaker-review-part="speaker-review-section-title"
                                                >
                                                    {t(
                                                        "speakerReview.samplesTitle",
                                                    )}
                                                </p>
                                                <p
                                                    className={
                                                        SPEAKER_REVIEW_SECTION_DESCRIPTION_CLASS_NAME
                                                    }
                                                    data-speaker-review-part="speaker-review-section-description"
                                                >
                                                    {t(
                                                        "speakerReview.samplesDescription",
                                                    )}
                                                </p>
                                            </div>
                                            {speaker.sampleCount > 0 ? (
                                                <div
                                                    className="flex flex-col gap-0.5"
                                                    data-speaker-review-list="speaker-review-sample-segments"
                                                >
                                                    {speaker.sampleSegments.map(
                                                        (segment, index) => (
                                                            <div
                                                                key={`${speaker.rawLabel}-preview-${segment.startMs ?? index}`}
                                                                className="grid grid-cols-[96px_56px_minmax(0,1fr)] items-start gap-2.5 rounded-md p-2.5 max-[860px]:grid-cols-1"
                                                                data-speaker-review-item="speaker-review-sample-segment"
                                                            >
                                                                <div
                                                                    className="flex min-w-0 flex-col gap-0.5"
                                                                    data-speaker-review-part="speaker-review-segment-meta"
                                                                >
                                                                    <p
                                                                        className={
                                                                            SPEAKER_REVIEW_SEGMENT_TITLE_CLASS_NAME
                                                                        }
                                                                        data-speaker-review-part="speaker-review-segment-title"
                                                                    >
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
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className={
                                                                            SPEAKER_REVIEW_ACTION_BUTTON_CLASS_NAME
                                                                        }
                                                                        data-speaker-review-control="speaker-review-play-sample"
                                                                        onClick={() =>
                                                                            handlePlaySample(
                                                                                speaker.rawLabel,
                                                                                index,
                                                                            )
                                                                        }
                                                                    >
                                                                        <Play
                                                                            className="size-6 shrink-0"
                                                                            strokeWidth={
                                                                                2
                                                                            }
                                                                            data-icon="inline-start"
                                                                            aria-hidden="true"
                                                                            focusable="false"
                                                                        />
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
                                                                <p
                                                                    className={
                                                                        SPEAKER_REVIEW_SEGMENT_TEXT_CLASS_NAME
                                                                    }
                                                                    data-speaker-review-part="speaker-review-segment-text"
                                                                >
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
                                                <Empty
                                                    variant="default"
                                                    className={
                                                        SPEAKER_REVIEW_INLINE_EMPTY_CLASS_NAME
                                                    }
                                                    data-speaker-review-part="speaker-review-empty"
                                                    data-speaker-review-state="no-samples"
                                                >
                                                    <EmptyHeader variant="default">
                                                        <EmptyTitle variant="default">
                                                            {t(
                                                                "speakerReview.noTimedSamples",
                                                            )}
                                                        </EmptyTitle>
                                                    </EmptyHeader>
                                                </Empty>
                                            )}
                                        </div>

                                        <Field
                                            className="gap-2"
                                            data-speaker-review-part="speaker-review-mapping-field"
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
                                                <InputGroup
                                                    className="h-9 min-w-0"
                                                    data-disabled={
                                                        isSpeakerSaving
                                                            ? true
                                                            : undefined
                                                    }
                                                >
                                                    <InputGroupInput
                                                        id={mappingInputId}
                                                        value={searchQuery}
                                                        data-speaker-review-control="speaker-review-mapping-input"
                                                        aria-busy={
                                                            isSpeakerSaving
                                                        }
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
                                                            searchQueryRevisionRef.current += 1;
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
                                                        <InputGroupAddon align="inline-end">
                                                            <InputGroupButton
                                                                type="button"
                                                                size="icon-xs"
                                                                variant="ghost"
                                                                className={
                                                                    SPEAKER_REVIEW_MAPPING_CLEAR_BUTTON_CLASS_NAME
                                                                }
                                                                aria-label={t(
                                                                    "speakerReview.clearSelectedSpeaker",
                                                                )}
                                                                disabled={
                                                                    isSpeakerSaving
                                                                }
                                                                data-speaker-review-control="speaker-review-mapping-clear"
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

                                                                    searchQueryRevisionRef.current += 1;
                                                                    setSearchQueries(
                                                                        (
                                                                            prev,
                                                                        ) => ({
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
                                                                <X
                                                                    className="size-6 shrink-0"
                                                                    strokeWidth={
                                                                        2
                                                                    }
                                                                    data-icon="inline-start"
                                                                    aria-hidden="true"
                                                                    focusable="false"
                                                                />
                                                            </InputGroupButton>
                                                        </InputGroupAddon>
                                                    ) : null}
                                                </InputGroup>
                                            </FieldContent>
                                            {speaker.matchedProfileId ? (
                                                isConfirmingUnlink ? (
                                                    <SpeakerReviewCard
                                                        hasNoPadding
                                                        surface="confirm"
                                                        data-speaker-review-confirm="speaker-unlink"
                                                        data-speaker-review-confirm-state={
                                                            isSpeakerSaving
                                                                ? "saving"
                                                                : "idle"
                                                        }
                                                        aria-busy={
                                                            isSpeakerSaving
                                                        }
                                                    >
                                                        <p
                                                            className={
                                                                SPEAKER_REVIEW_CONFIRM_MESSAGE_CLASS_NAME
                                                            }
                                                            data-speaker-review-confirm-message
                                                        >
                                                            {t(
                                                                "speakerReview.confirmUnlinkMessagePrefix",
                                                            )}
                                                            <em
                                                                className={
                                                                    SPEAKER_REVIEW_CONFIRM_SUBJECT_CLASS_NAME
                                                                }
                                                                data-speaker-review-confirm-subject
                                                            >
                                                                {matchedName}
                                                            </em>
                                                            {t(
                                                                "speakerReview.confirmUnlinkMessageSuffix",
                                                            )}
                                                        </p>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            className={
                                                                SPEAKER_REVIEW_GHOST_BUTTON_CLASS_NAME
                                                            }
                                                            data-speaker-review-confirm-action="cancel"
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
                                                            variant="destructive"
                                                            size="sm"
                                                            className={
                                                                SPEAKER_REVIEW_DANGER_BUTTON_CLASS_NAME
                                                            }
                                                            data-speaker-review-confirm-action="confirm"
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
                                                    </SpeakerReviewCard>
                                                ) : (
                                                    <div
                                                        className="inline-flex min-w-0 flex-wrap items-center gap-1.5"
                                                        data-speaker-review-part="speaker-review-actions"
                                                    >
                                                        <Button
                                                            type="button"
                                                            variant="destructive"
                                                            size="sm"
                                                            className={
                                                                SPEAKER_REVIEW_DANGER_BUTTON_CLASS_NAME
                                                            }
                                                            data-speaker-review-control="speaker-review-unlink"
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
                                                        <p
                                                            className={
                                                                SPEAKER_REVIEW_ROW_SUB_CLASS_NAME
                                                            }
                                                            data-speaker-review-part="speaker-review-row-sub"
                                                        >
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
                                                    <Empty
                                                        variant="default"
                                                        className={
                                                            SPEAKER_REVIEW_INLINE_EMPTY_CLASS_NAME
                                                        }
                                                        data-speaker-review-part="speaker-review-empty"
                                                        data-speaker-review-state="no-saved-speakers"
                                                    >
                                                        <EmptyHeader variant="default">
                                                            <EmptyTitle variant="default">
                                                                {t(
                                                                    "speakerReview.noSavedSpeakers",
                                                                )}
                                                            </EmptyTitle>
                                                        </EmptyHeader>
                                                    </Empty>
                                                ) : (
                                                    <div
                                                        className="flex flex-col gap-1.5"
                                                        data-speaker-review-list="speaker-review-suggestions"
                                                    >
                                                        {filteredProfiles.map(
                                                            (profile) => (
                                                                <Button
                                                                    key={
                                                                        profile.id
                                                                    }
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="default"
                                                                    className={
                                                                        SPEAKER_REVIEW_SUGGESTION_BUTTON_CLASS_NAME
                                                                    }
                                                                    data-speaker-review-control="speaker-review-suggestion"
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

                                                                        searchQueryRevisionRef.current += 1;
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
                                                                    <span className="truncate text-left">
                                                                        {
                                                                            profile.displayName
                                                                        }
                                                                    </span>
                                                                    <SpeakerReviewVoiceprintBadge
                                                                        data-speaker-review-part="speaker-review-voiceprint-pill"
                                                                        data-speaker-review-tone={
                                                                            speaker.matchedProfileId ===
                                                                            profile.id
                                                                                ? "selected"
                                                                                : profile.hasVoiceprint
                                                                                  ? "ready"
                                                                                  : "missing"
                                                                        }
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
                                                                    </SpeakerReviewVoiceprintBadge>
                                                                </Button>
                                                            ),
                                                        )}
                                                        {canCreateSpeaker ? (
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="default"
                                                                className={
                                                                    SPEAKER_REVIEW_SUGGESTION_BUTTON_CLASS_NAME
                                                                }
                                                                data-speaker-review-control="speaker-review-suggestion"
                                                                data-speaker-review-state="create"
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

                                                                    searchQueryRevisionRef.current += 1;
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
                                                                <span className="truncate text-left">
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
                                                        normalizedQuery ? (
                                                            <Empty
                                                                variant="default"
                                                                className={
                                                                    SPEAKER_REVIEW_INLINE_EMPTY_CLASS_NAME
                                                                }
                                                                data-speaker-review-part="speaker-review-empty"
                                                                data-speaker-review-state="no-matching-speakers"
                                                            >
                                                                <EmptyHeader variant="default">
                                                                    <EmptyTitle variant="default">
                                                                        {t(
                                                                            "speakerReview.searchResults",
                                                                        )}
                                                                        : 0
                                                                    </EmptyTitle>
                                                                </EmptyHeader>
                                                            </Empty>
                                                        ) : null}
                                                        {filteredProfiles.length ===
                                                            0 &&
                                                        !normalizedQuery ? (
                                                            <Empty
                                                                variant="default"
                                                                className={
                                                                    SPEAKER_REVIEW_INLINE_EMPTY_CLASS_NAME
                                                                }
                                                                data-speaker-review-part="speaker-review-empty"
                                                                data-speaker-review-state="no-saved-speakers"
                                                            >
                                                                <EmptyHeader variant="default">
                                                                    <EmptyTitle variant="default">
                                                                        {t(
                                                                            "speakerReview.noSavedSpeakers",
                                                                        )}
                                                                    </EmptyTitle>
                                                                </EmptyHeader>
                                                            </Empty>
                                                        ) : null}
                                                    </div>
                                                )
                                            ) : null}
                                        </Field>
                                    </>
                                );
                            })()}
                        </SpeakerReviewCard>
                    ))}
                </div>
            )}
        </section>
    );
}
