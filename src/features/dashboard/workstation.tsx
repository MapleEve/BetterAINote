"use client";

import {
    CheckCircle,
    CloudOff,
    FileText,
    Menu,
    Mic,
    MoreHorizontal,
    PanelLeftClose,
    PanelLeftOpen,
    Pencil,
    RefreshCw,
    Settings,
    Sparkles,
    Tags,
    Trash2,
    X,
} from "lucide-react";
import {
    startTransition,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { toast } from "sonner";
import { Logo } from "@/components/icons/logo";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { SyncStatus } from "@/features/dashboard/components/sync-status";
import { useDataSourcesSettings } from "@/features/data-sources/use-data-sources-settings";
import { AiRenamePreviewCard } from "@/features/recordings/components/ai-rename-preview-card";
import { RecordingPlayer } from "@/features/recordings/components/recording-player";
import { RecordingTagManager } from "@/features/recordings/components/recording-tag-manager";
import {
    normalizeSettingsSection,
    SettingsDialog,
} from "@/features/settings/components/settings-dialog";
import { useTitleGenerationSettingsStore } from "@/features/settings/title-generation-settings-store";
import { useAutoSync } from "@/hooks/use-auto-sync";
import {
    DATA_SOURCE_PROVIDERS,
    isSourceProvider,
    type SourceProvider,
} from "@/lib/data-sources/catalog";
import {
    canRecordingPrivateTranscribe,
    canRecordingRename,
    getPrivateTranscriptionUnavailableMessage,
    getRecordingRenameActionKey,
    getSourceProviderLabel,
} from "@/lib/data-sources/presentation";
import {
    refreshBrowserRoute,
    useBrowserRouteController,
} from "@/lib/platform/browser-router";
import {
    addBrowserWindowEventListener,
    readBrowserHash,
    removeBrowserWindowEventListener,
    startBrowserInterval,
    stopBrowserInterval,
    writeBrowserHash,
    writeBrowserStorage,
} from "@/lib/platform/browser-shell";
import type { RecordingTag } from "@/lib/recording-tags";
import { isActiveTranscriptionJob } from "@/lib/transcription/job-display";
import { cn } from "@/lib/utils";
import type { Recording } from "@/types/recording";
import { ActivityOverlay } from "./components/activity-overlay";
import { LibrarySearch } from "./components/library-search";
import {
    RecordingList,
    type RecordingListMode,
} from "./components/recording-list";
import { SourceFilterStackStrip } from "./components/source-filter-stack-strip";
import {
    type SourceProviderRowModel,
    type SourceProviderRowStatus,
    SourceProviderRows,
} from "./components/source-provider-rows";
import { SystemBanner } from "./components/system-banner";
import { TranscriptionPanel } from "./components/transcription-panel";
import {
    areDashboardTranscriptionJobsEqual,
    getDashboardTranscriptionPollingKey,
    resolveDashboardTranscriptionPoll,
} from "./transcription-polling";

interface TranscriptionData {
    hasTranscript?: boolean;
    text?: string;
    language?: string;
    speakerMap?: Record<string, string>;
    segments?: TranscriptSegmentData[] | null;
}

interface TranscriptSegmentData {
    id: number;
    start: number | null;
    end: number | null;
    text: string;
    speakerLabel: string;
    speakerId?: string | null;
    speakerName?: string | null;
    similarity?: number | null;
    hasOverlap?: boolean | null;
    displaySpeaker?: string | null;
}

interface TranscriptionJobData {
    status: string;
    remoteStatus?: string | null;
    lastError?: string | null;
}

interface TranscriptionPollTranscriptData {
    text?: string | null;
    detectedLanguage?: string | null;
    speakerMap?: Record<string, string> | null;
    segments?: TranscriptSegmentData[] | null;
}

interface TranscriptionPollResponseData {
    transcript?: TranscriptionPollTranscriptData | null;
    job?: TranscriptionJobData | null;
}

interface WorkstationProps {
    recordings: Recording[];
    transcriptions: Map<string, TranscriptionData>;
    transcriptionJobs: Map<string, TranscriptionJobData>;
}

type DashboardFavorite = "all" | "transcribed" | "tags";
type TopbarOverlay = "search" | "activity";
const SETTINGS_DATA_SOURCE_PROVIDER_STORAGE_KEY =
    "settings-data-source-provider";

const DASHBOARD_SOURCE_ORDER = [
    "dingtalk-a1",
    "ticnote",
    "plaud",
    "feishu-minutes",
    "iflyrec",
] satisfies SourceProvider[];

const DASHBOARD_SOURCES = DASHBOARD_SOURCE_ORDER.filter((provider) =>
    DATA_SOURCE_PROVIDERS.includes(provider),
);

function recordingHasTranscript(transcription: TranscriptionData | undefined) {
    return Boolean(transcription?.text?.trim() || transcription?.hasTranscript);
}

function recordingMatchesDashboardFavorite(
    recording: Recording,
    favorite: DashboardFavorite,
    transcriptions: Map<string, TranscriptionData>,
) {
    if (favorite === "transcribed") {
        return recordingHasTranscript(transcriptions.get(recording.id));
    }

    return true;
}

function getDashboardSourceStatus(params: {
    configured: boolean;
    enabled: boolean;
    hasCurrentFilterMatch: boolean;
    isLoading: boolean;
    isPlanned: boolean;
    hasCount: boolean;
    hasSyncError: boolean;
    isSyncing: boolean;
    isExpired: boolean;
}): SourceProviderRowStatus {
    if (params.isLoading) {
        return "loading";
    }

    if (params.isPlanned) {
        return "planned";
    }

    if (!params.configured) {
        return "needs-setup";
    }

    if (!params.enabled) {
        return "paused";
    }

    if (params.isExpired) {
        return "expired";
    }

    if (params.isSyncing) {
        return "syncing";
    }

    if (params.hasSyncError) {
        return "sync-error";
    }

    if (params.hasCount && !params.hasCurrentFilterMatch) {
        return "no-results";
    }

    return params.hasCount ? "connected" : "connected-empty";
}

export function Workstation({
    recordings,
    transcriptions,
    transcriptionJobs,
}: WorkstationProps) {
    const { language, t } = useLanguage();
    const confirm = useConfirmDialog();
    const router = useBrowserRouteController();
    const moreActionsRef = useRef<HTMLDivElement | null>(null);
    const { isLoading: areDataSourcesLoading, sources: dataSourceStates } =
        useDataSourcesSettings(language);
    const { settings: titleGenerationSettings } =
        useTitleGenerationSettingsStore();

    const [currentRecording, setCurrentRecording] = useState<Recording | null>(
        recordings[0] ?? null,
    );
    const [liveRecordings, setLiveRecordings] = useState(recordings);
    const [activeFavorite, setActiveFavorite] =
        useState<DashboardFavorite>("all");
    const [activeSourceProvider, setActiveSourceProvider] =
        useState<SourceProvider | null>(null);
    const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [isSourceDrawerOpen, setSourceDrawerOpen] = useState(false);
    const [recordingListMode, setRecordingListMode] =
        useState<RecordingListMode>("timeline");
    const [tagCatalog, setTagCatalog] = useState<RecordingTag[]>(() =>
        Array.from(
            new Map(
                recordings
                    .flatMap((recording) => recording.tags)
                    .map((tag) => [tag.id, tag]),
            ).values(),
        ),
    );
    const [, setIsTranscribing] = useState(false);
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState("");
    const [isSavingRename, setIsSavingRename] = useState(false);
    const [isAutoRenaming, setIsAutoRenaming] = useState(false);
    const [isApplyingAutoRename, setIsApplyingAutoRename] = useState(false);
    const [autoRenamePreview, setAutoRenamePreview] = useState<string | null>(
        null,
    );
    const [autoRenameError, setAutoRenameError] = useState<string | null>(null);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [activeTopbarOverlay, setActiveTopbarOverlay] =
        useState<TopbarOverlay | null>(null);
    const [isMoreActionsOpen, setMoreActionsOpen] = useState(false);
    const [tagManagerOpen, setTagManagerOpen] = useState(false);
    const [liveTranscriptions, setLiveTranscriptions] = useState(
        () => new Map(transcriptions),
    );
    const [liveTranscriptionJobs, setLiveTranscriptionJobs] = useState(
        () => new Map(transcriptionJobs),
    );
    const [loadingTranscriptIds, setLoadingTranscriptIds] = useState(
        () => new Set<string>(),
    );

    const openSettingsFromHash = useCallback(() => {
        if (normalizeSettingsSection(readBrowserHash())) {
            setSettingsOpen(true);
        }
    }, []);

    useEffect(() => {
        openSettingsFromHash();
        addBrowserWindowEventListener("hashchange", openSettingsFromHash);

        return () =>
            removeBrowserWindowEventListener(
                "hashchange",
                openSettingsFromHash,
            );
    }, [openSettingsFromHash]);

    const currentTranscription = currentRecording
        ? liveTranscriptions.get(currentRecording.id)
        : undefined;
    const currentTranscriptionJob = currentRecording
        ? liveTranscriptionJobs.get(currentRecording.id)
        : undefined;
    const currentRecordingId = currentRecording?.id ?? null;
    const currentTranscriptionPollingKey = getDashboardTranscriptionPollingKey(
        currentRecordingId,
        currentTranscriptionJob,
    );
    const currentHasTranscript = Boolean(
        currentTranscription?.text?.trim() ||
            currentTranscription?.hasTranscript,
    );
    const isCurrentTranscriptLoading = Boolean(
        currentRecording && loadingTranscriptIds.has(currentRecording.id),
    );
    const canRenameCurrentRecording = currentRecording
        ? canRecordingRename(currentRecording.sourceProvider)
        : false;
    const currentRenameActionLabel = currentRecording
        ? t(getRecordingRenameActionKey(currentRecording.sourceProvider))
        : t("dashboard.renameRecording");
    const titleGenerationProviderConfigured = Boolean(
        titleGenerationSettings.titleGenerationApiKeySet &&
            titleGenerationSettings.titleGenerationModel?.trim(),
    );
    const autoRenameDisabledReason = !titleGenerationProviderConfigured
        ? t("transcription.aiRenameConfigureFirst")
        : !currentHasTranscript
          ? t("transcription.aiRenameNeedsTranscript")
          : !canRenameCurrentRecording
            ? currentRenameActionLabel
            : null;
    const canAutoRenameCurrentRecording = Boolean(
        currentRecording &&
            canRenameCurrentRecording &&
            currentHasTranscript &&
            titleGenerationProviderConfigured &&
            !isSavingRename &&
            !isAutoRenaming &&
            !isApplyingAutoRename,
    );
    const currentCanPrivateTranscribe = currentRecording
        ? canRecordingPrivateTranscribe({
              sourceProvider: currentRecording.sourceProvider,
              hasAudio: currentRecording.hasAudio,
          })
        : false;
    const currentTranscribeUnavailableReason = currentRecording
        ? getPrivateTranscriptionUnavailableMessage(
              currentRecording.sourceProvider,
              currentRecording.hasAudio,
              language,
          )
        : null;

    useEffect(() => {
        setLiveTranscriptions(new Map(transcriptions));
    }, [transcriptions]);

    useEffect(() => {
        setLiveTranscriptionJobs(new Map(transcriptionJobs));
    }, [transcriptionJobs]);

    useEffect(() => {
        setAutoRenamePreview(null);
        setIsRenaming(false);
        setRenameValue(currentRecording?.filename ?? "");
        setMoreActionsOpen(false);
        if (!currentRecording?.id) {
            setIsApplyingAutoRename(false);
            setIsAutoRenaming(false);
        }
    }, [currentRecording?.filename, currentRecording?.id]);

    useEffect(() => {
        if (!isMoreActionsOpen) {
            return;
        }

        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target;
            if (!(target instanceof Node)) {
                return;
            }
            if (!moreActionsRef.current?.contains(target)) {
                setMoreActionsOpen(false);
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                setMoreActionsOpen(false);
            }
        };

        document.addEventListener("pointerdown", handlePointerDown);
        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("pointerdown", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isMoreActionsOpen]);

    useEffect(() => {
        if (isRenaming) {
            setTagManagerOpen(false);
        }
    }, [isRenaming]);

    useEffect(() => {
        if (settingsOpen) {
            setActiveTopbarOverlay(null);
            setSourceDrawerOpen(false);
        }
    }, [settingsOpen]);

    useEffect(() => {
        if (!isSourceDrawerOpen) {
            return;
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                setSourceDrawerOpen(false);
            }
        };

        addBrowserWindowEventListener("keydown", handleKeyDown);
        return () => removeBrowserWindowEventListener("keydown", handleKeyDown);
    }, [isSourceDrawerOpen]);

    useEffect(() => {
        const recordingId = currentRecording?.id;
        if (!recordingId) {
            return;
        }

        const transcription = liveTranscriptions.get(recordingId);
        if (!transcription?.hasTranscript || transcription.text?.trim()) {
            return;
        }

        let cancelled = false;
        setLoadingTranscriptIds((previous) => {
            const next = new Set(previous);
            next.add(recordingId);
            return next;
        });

        const loadTranscript = async () => {
            try {
                const response = await fetch(
                    `/api/recordings/${recordingId}/transcript/speakers`,
                    { cache: "no-store" },
                );

                if (cancelled) {
                    return;
                }

                if (response.status === 404) {
                    setLiveTranscriptions((previous) => {
                        const next = new Map(previous);
                        next.set(recordingId, {
                            ...next.get(recordingId),
                            hasTranscript: false,
                        });
                        return next;
                    });
                    return;
                }

                if (!response.ok) {
                    return;
                }

                const data = await response.json();
                if (cancelled || !data?.transcript) {
                    return;
                }

                setLiveTranscriptions((previous) => {
                    const next = new Map(previous);
                    next.set(recordingId, {
                        hasTranscript: true,
                        text:
                            data.transcript.rawText ??
                            data.transcript.displayText ??
                            "",
                        language: data.transcript.detectedLanguage ?? undefined,
                        speakerMap: data.speakerMap ?? undefined,
                        segments: data.transcript.segments ?? null,
                    });
                    return next;
                });
            } catch {
                // The explicit transcript panel actions still surface user-facing errors.
            } finally {
                if (!cancelled) {
                    setLoadingTranscriptIds((previous) => {
                        const next = new Set(previous);
                        next.delete(recordingId);
                        return next;
                    });
                }
            }
        };

        void loadTranscript();

        return () => {
            cancelled = true;
        };
    }, [currentRecording?.id, liveTranscriptions]);

    useEffect(() => {
        setLiveRecordings(recordings);
        setCurrentRecording((previous) => {
            if (!previous) return recordings[0] ?? null;
            return (
                recordings.find((recording) => recording.id === previous.id) ??
                recordings[0] ??
                null
            );
        });
    }, [recordings]);

    useEffect(() => {
        const tagsById = new Map<string, RecordingTag>();
        for (const recording of liveRecordings) {
            for (const tag of recording.tags) {
                tagsById.set(tag.id, tag);
            }
        }
        setTagCatalog((previous) => {
            for (const tag of previous) {
                tagsById.set(tag.id, tag);
            }
            return Array.from(tagsById.values()).sort((a, b) =>
                a.name.localeCompare(b.name),
            );
        });
    }, [liveRecordings]);

    useEffect(() => {
        let cancelled = false;

        const loadTags = async () => {
            try {
                const response = await fetch("/api/recording-tags", {
                    cache: "no-store",
                });
                if (!response.ok) {
                    return;
                }
                const data = await response.json();
                if (!cancelled && Array.isArray(data.tags)) {
                    setTagCatalog(data.tags);
                }
            } catch {
                // Tag catalog is additive; recordings still carry their assigned tags.
            }
        };

        void loadTags();

        return () => {
            cancelled = true;
        };
    }, []);

    const applyRecordingTags = useCallback(
        (recordingId: string, tags: RecordingTag[]) => {
            setLiveRecordings((previous) =>
                previous.map((recording) =>
                    recording.id === recordingId
                        ? { ...recording, tags }
                        : recording,
                ),
            );
            setCurrentRecording((previous) =>
                previous?.id === recordingId ? { ...previous, tags } : previous,
            );
        },
        [],
    );

    useEffect(() => {
        setIsTranscribing(isActiveTranscriptionJob(currentTranscriptionJob));
    }, [currentTranscriptionJob]);

    useEffect(() => {
        if (!currentRecordingId || !currentTranscriptionPollingKey) {
            return;
        }

        let cancelled = false;
        const poll = async () => {
            try {
                const response = await fetch(
                    `/api/recordings/${currentRecordingId}/transcribe`,
                    {
                        cache: "no-store",
                    },
                );
                if (!response.ok) {
                    return;
                }

                const data =
                    (await response.json()) as TranscriptionPollResponseData;
                if (cancelled) {
                    return;
                }

                const result =
                    resolveDashboardTranscriptionPoll<TranscriptionPollTranscriptData>(
                        data,
                    );

                if (result.state === "active") {
                    setLiveTranscriptionJobs((previous) => {
                        const current = previous.get(currentRecordingId);
                        if (
                            areDashboardTranscriptionJobsEqual(
                                current,
                                result.job,
                            )
                        ) {
                            return previous;
                        }

                        const next = new Map(previous);
                        next.set(currentRecordingId, result.job);
                        return next;
                    });
                    return;
                }

                if (result.state === "completed") {
                    setLiveTranscriptions((previous) => {
                        const next = new Map(previous);
                        next.set(currentRecordingId, {
                            text: result.transcript.text || "",
                            language:
                                result.transcript.detectedLanguage || undefined,
                            speakerMap:
                                result.transcript.speakerMap ?? undefined,
                            segments: result.transcript.segments ?? null,
                        });
                        return next;
                    });
                    setLiveTranscriptionJobs((previous) => {
                        if (!previous.has(currentRecordingId)) {
                            return previous;
                        }

                        const next = new Map(previous);
                        next.delete(currentRecordingId);
                        return next;
                    });
                    setIsTranscribing(false);
                    return;
                }

                if (result.state === "failed") {
                    setLiveTranscriptionJobs((previous) => {
                        const current = previous.get(currentRecordingId);
                        if (
                            areDashboardTranscriptionJobsEqual(
                                current,
                                result.job,
                            )
                        ) {
                            return previous;
                        }

                        const next = new Map(previous);
                        next.set(currentRecordingId, result.job);
                        return next;
                    });
                    setIsTranscribing(false);
                }
            } catch {
                // Ignore polling errors and try again on the next interval.
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
    }, [currentRecordingId, currentTranscriptionPollingKey]);

    const {
        autoSyncEnabled,
        isAutoSyncing,
        lastSyncTime,
        nextSyncTime,
        lastSyncResult,
        manualSync,
        workerStatus,
    } = useAutoSync({
        onSuccess: ({ queued, newRecordings }) => {
            if (queued) {
                toast.success(t("dashboard.syncQueued"));
                return;
            }

            const count = newRecordings ?? 0;
            if (count > 0) {
                setCurrentRecording(null);
            }
            startTransition(() => {
                refreshBrowserRoute(router);
            });
            toast.success(
                count > 0
                    ? t("dashboard.syncNewRecordings", {
                          count,
                          suffix: count !== 1 ? "s" : "",
                      })
                    : t("dashboard.syncCompleteNoNew"),
            );
        },
        onError: (error) => {
            toast.error(error);
        },
    });

    const providerCounts = useMemo(() => {
        const counts = new Map<SourceProvider, number>();
        for (const provider of DASHBOARD_SOURCES) {
            counts.set(provider, 0);
        }

        for (const recording of liveRecordings) {
            if (isSourceProvider(recording.sourceProvider)) {
                counts.set(
                    recording.sourceProvider,
                    (counts.get(recording.sourceProvider) ?? 0) + 1,
                );
            }
        }

        return counts;
    }, [liveRecordings]);

    const favoriteScopedProviderCounts = useMemo(() => {
        const counts = new Map<SourceProvider, number>();
        for (const provider of DASHBOARD_SOURCES) {
            counts.set(provider, 0);
        }

        for (const recording of liveRecordings) {
            if (!isSourceProvider(recording.sourceProvider)) {
                continue;
            }

            if (
                !recordingMatchesDashboardFavorite(
                    recording,
                    activeFavorite,
                    liveTranscriptions,
                )
            ) {
                continue;
            }

            counts.set(
                recording.sourceProvider,
                (counts.get(recording.sourceProvider) ?? 0) + 1,
            );
        }

        return counts;
    }, [activeFavorite, liveRecordings, liveTranscriptions]);

    const dataSourceStateByProvider = useMemo(
        () =>
            new Map(
                dataSourceStates.map((source) => [source.provider, source]),
            ),
        [dataSourceStates],
    );

    const hasSyncError = Boolean(
        lastSyncResult?.success === false ||
            workerStatus?.lastError ||
            (workerStatus?.lastSummary?.errorCount ?? 0) > 0,
    );

    const sourceRows = useMemo<SourceProviderRowModel[]>(
        () =>
            DASHBOARD_SOURCES.map((provider) => {
                const count = providerCounts.get(provider) ?? 0;
                const currentFilterCount =
                    favoriteScopedProviderCounts.get(provider) ?? 0;
                const source = dataSourceStateByProvider.get(provider);
                const configured = Boolean(source?.connected);
                const enabled = source?.enabled ?? false;
                const status = getDashboardSourceStatus({
                    configured,
                    enabled,
                    hasCurrentFilterMatch:
                        activeFavorite === "all" || currentFilterCount > 0,
                    hasCount: count > 0,
                    hasSyncError: hasSyncError && configured,
                    isExpired: source?.connectionStatus === "expired",
                    isLoading: areDataSourcesLoading && !source,
                    isPlanned: source?.runtimeStatus === "planned",
                    isSyncing: isAutoSyncing && configured,
                });

                return {
                    provider,
                    label: getSourceProviderLabel(provider, language),
                    count,
                    active: activeSourceProvider === provider,
                    connected: configured,
                    updating: status === "syncing",
                    status,
                };
            }),
        [
            activeSourceProvider,
            activeFavorite,
            areDataSourcesLoading,
            dataSourceStateByProvider,
            favoriteScopedProviderCounts,
            hasSyncError,
            isAutoSyncing,
            language,
            providerCounts,
        ],
    );

    const filteredRecordings = useMemo(() => {
        return liveRecordings.filter((recording) => {
            if (
                activeSourceProvider &&
                recording.sourceProvider !== activeSourceProvider
            ) {
                return false;
            }

            return recordingMatchesDashboardFavorite(
                recording,
                activeFavorite,
                liveTranscriptions,
            );
        });
    }, [
        activeFavorite,
        activeSourceProvider,
        liveRecordings,
        liveTranscriptions,
    ]);

    const activeFavoriteLabel =
        activeFavorite === "transcribed"
            ? language === "zh-CN"
                ? "转写记录"
                : "Transcribed"
            : activeFavorite === "tags"
              ? language === "zh-CN"
                  ? "标签"
                  : "Tags"
              : language === "zh-CN"
                ? "全部录音"
                : "All recordings";
    const activeSourceLabel = activeSourceProvider
        ? getSourceProviderLabel(activeSourceProvider, language)
        : null;
    const listContextLabel = activeSourceLabel
        ? `${activeFavoriteLabel} / ${activeSourceLabel}`
        : activeFavoriteLabel;
    const activeSourceRow =
        activeSourceProvider !== null
            ? (sourceRows.find(
                  (row) => row.provider === activeSourceProvider,
              ) ?? null)
            : null;
    const activeSourceTotalCount = activeSourceRow?.count ?? 0;

    useEffect(() => {
        setCurrentRecording((previous) => {
            if (!previous) return filteredRecordings[0] ?? null;
            return filteredRecordings.some(
                (recording) => recording.id === previous.id,
            )
                ? previous
                : (filteredRecordings[0] ?? null);
        });
    }, [filteredRecordings]);

    const handleFavoriteSelect = useCallback((favorite: DashboardFavorite) => {
        setActiveFavorite(favorite);
        setRecordingListMode(favorite === "tags" ? "tags" : "timeline");
        setSourceDrawerOpen(false);
    }, []);

    const handleRecordingListModeChange = useCallback(
        (nextMode: RecordingListMode) => {
            setRecordingListMode(nextMode);
            setActiveFavorite((previous) => {
                if (nextMode === "tags") return "tags";
                return previous === "tags" ? "all" : previous;
            });
        },
        [],
    );

    const handleSync = useCallback(async () => {
        await manualSync();
    }, [manualSync]);

    const setSearchOverlayOpen = useCallback((open: boolean) => {
        setActiveTopbarOverlay((previous) => {
            if (open) {
                return "search";
            }

            return previous === "search" ? null : previous;
        });
    }, []);

    const setActivityOverlayOpen = useCallback((open: boolean) => {
        setActiveTopbarOverlay((previous) => {
            if (open) {
                return "activity";
            }

            return previous === "activity" ? null : previous;
        });
    }, []);

    const handleOpenSettings = useCallback(() => {
        setActiveTopbarOverlay(null);
        setSettingsOpen(true);
    }, []);

    const handleOpenDataSourcesSettings = useCallback(
        (provider?: SourceProvider) => {
            if (provider) {
                writeBrowserStorage(
                    SETTINGS_DATA_SOURCE_PROVIDER_STORAGE_KEY,
                    provider,
                );
            }
            writeBrowserHash("data-sources");
            handleOpenSettings();
        },
        [handleOpenSettings],
    );

    const handleClearDashboardFilters = useCallback(() => {
        setActiveFavorite("all");
        setActiveSourceProvider(null);
        setRecordingListMode("timeline");
        setSourceDrawerOpen(false);
    }, []);

    const handleWidenSourceFilters = useCallback(() => {
        setActiveFavorite("all");
        setRecordingListMode("timeline");
        setSourceDrawerOpen(false);
    }, []);

    const handleOpenSearchResult = useCallback(
        (recordingId: string) => {
            const recording = liveRecordings.find(
                (item) => item.id === recordingId,
            );
            if (!recording) {
                return;
            }

            setTagManagerOpen(false);
            setCurrentRecording(recording);
        },
        [liveRecordings],
    );

    const handleTranscribe = useCallback(async () => {
        if (!currentRecording) return;
        if (!currentCanPrivateTranscribe) {
            toast.error(
                currentTranscribeUnavailableReason ??
                    t("dashboard.transcribeFailed"),
            );
            return;
        }

        setIsTranscribing(true);
        try {
            const response = await fetch(
                `/api/recordings/${currentRecording.id}/transcribe`,
                { method: "POST" },
            );

            const data = await response.json();
            if (!response.ok) {
                toast.error(data.error || t("dashboard.transcribeFailed"));
                return;
            }

            if (data.queued) {
                toast.success(t("dashboard.transcribeQueued"));
            } else {
                toast.success(t("dashboard.transcriptionAvailable"));
            }
            if (data.job) {
                setLiveTranscriptionJobs((previous) => {
                    const next = new Map(previous);
                    next.set(currentRecording.id, {
                        status: data.job.status ?? "pending",
                        remoteStatus: data.job.remoteStatus ?? null,
                        lastError: data.job.lastError ?? null,
                    });
                    return next;
                });
            }
            if (data.transcript) {
                setLiveTranscriptions((previous) => {
                    const next = new Map(previous);
                    next.set(currentRecording.id, {
                        text: data.transcript.text,
                        language: data.transcript.detectedLanguage ?? undefined,
                        speakerMap: data.transcript.speakerMap ?? undefined,
                        segments: data.transcript.segments ?? null,
                    });
                    return next;
                });
            }
        } catch {
            toast.error(t("transcription.failedToLoad"));
        } finally {
            setIsTranscribing(false);
        }
    }, [
        currentCanPrivateTranscribe,
        currentRecording,
        currentTranscribeUnavailableReason,
        t,
    ]);

    const handleRetranscribe = useCallback(async () => {
        if (!currentRecording) return;
        if (!currentCanPrivateTranscribe) {
            toast.error(
                currentTranscribeUnavailableReason ??
                    t("dashboard.retranscribeFailed"),
            );
            return;
        }

        setIsTranscribing(true);
        try {
            const response = await fetch(
                `/api/recordings/${currentRecording.id}/transcribe`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ force: true }),
                },
            );

            const data = await response.json();
            if (!response.ok) {
                toast.error(data.error || t("dashboard.retranscribeFailed"));
                return;
            }

            if (data.queued) {
                toast.success(t("dashboard.retranscribeQueued"));
            } else {
                toast.success(t("dashboard.transcriptionAvailable"));
            }
            if (data.job) {
                setLiveTranscriptionJobs((previous) => {
                    const next = new Map(previous);
                    next.set(currentRecording.id, {
                        status: data.job.status ?? "pending",
                        remoteStatus: data.job.remoteStatus ?? null,
                        lastError: data.job.lastError ?? null,
                    });
                    return next;
                });
            }
            if (data.transcript) {
                setLiveTranscriptions((previous) => {
                    const next = new Map(previous);
                    next.set(currentRecording.id, {
                        text: data.transcript.text,
                        language: data.transcript.detectedLanguage ?? undefined,
                        speakerMap: data.transcript.speakerMap ?? undefined,
                        segments: data.transcript.segments ?? null,
                    });
                    return next;
                });
            }
        } catch {
            toast.error(t("dashboard.retranscribeFailed"));
        } finally {
            setIsTranscribing(false);
        }
    }, [
        currentCanPrivateTranscribe,
        currentRecording,
        currentTranscribeUnavailableReason,
        t,
    ]);

    const handleRenameStart = useCallback(() => {
        if (!currentRecording) return;
        if (!canRenameCurrentRecording) return;
        setTagManagerOpen(false);
        setRenameValue(currentRecording.filename);
        setIsRenaming(true);
    }, [canRenameCurrentRecording, currentRecording]);

    const handleRenameCancel = useCallback(() => {
        setIsRenaming(false);
        setRenameValue("");
    }, []);

    const handleRenameSave = useCallback(async () => {
        if (!currentRecording) return;

        const newName = renameValue.trim();
        if (!newName || newName === currentRecording.filename) {
            handleRenameCancel();
            return;
        }

        setIsSavingRename(true);
        try {
            const response = await fetch(
                `/api/recordings/${currentRecording.id}/rename`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ filename: newName }),
                },
            );

            const data = await response.json();
            if (!response.ok) {
                toast.error(data.error || t("dashboard.renameFailed"));
                return;
            }

            setCurrentRecording((previous) =>
                previous ? { ...previous, filename: newName } : previous,
            );
            setLiveRecordings((previous) =>
                previous.map((recording) =>
                    recording.id === currentRecording.id
                        ? { ...recording, filename: newName }
                        : recording,
                ),
            );
            setIsRenaming(false);
            toast.success(t("dashboard.renameSuccess"));
            refreshBrowserRoute(router);
        } catch {
            toast.error(t("dashboard.renameFailed"));
        } finally {
            setIsSavingRename(false);
        }
    }, [currentRecording, handleRenameCancel, renameValue, router, t]);

    const handleAutoRename = useCallback(async () => {
        if (!currentRecording) return;
        if (!canAutoRenameCurrentRecording) {
            if (autoRenameDisabledReason) {
                toast.error(autoRenameDisabledReason);
            }
            return;
        }

        setAutoRenameError(null);
        setIsAutoRenaming(true);
        try {
            const response = await fetch(
                `/api/recordings/${currentRecording.id}/rename/auto`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ mode: "preview" }),
                },
            );

            const data = await response.json();
            if (!response.ok) {
                const message =
                    data.error || t("transcription.autoRenameFailed");
                setAutoRenameError(message);
                toast.error(message);
                return;
            }

            if (typeof data.filename === "string" && data.filename.trim()) {
                setAutoRenamePreview(data.filename);
                setAutoRenameError(null);
                toast.success(t("transcription.aiRenamePreviewReady"));
            }
        } catch {
            const message = t("transcription.autoRenameFailed");
            setAutoRenameError(message);
            toast.error(message);
        } finally {
            setIsAutoRenaming(false);
        }
    }, [
        autoRenameDisabledReason,
        canAutoRenameCurrentRecording,
        currentRecording,
        t,
    ]);

    const handleAutoRenamePreviewCancel = useCallback(() => {
        setAutoRenamePreview(null);
        setAutoRenameError(null);
    }, []);

    const handleAutoRenamePreviewApply = useCallback(async () => {
        if (!currentRecording) return;

        const filename = autoRenamePreview?.trim();
        if (!filename) return;

        setIsApplyingAutoRename(true);
        try {
            const response = await fetch(
                `/api/recordings/${currentRecording.id}/rename`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ filename }),
                },
            );

            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                toast.error(data.error || t("transcription.autoRenameFailed"));
                return;
            }

            setCurrentRecording((previous) =>
                previous ? { ...previous, filename } : previous,
            );
            setLiveRecordings((previous) =>
                previous.map((recording) =>
                    recording.id === currentRecording.id
                        ? { ...recording, filename }
                        : recording,
                ),
            );
            setRenameValue(filename);
            setAutoRenamePreview(null);
            setAutoRenameError(null);
            toast.success(
                t("transcription.autoRenameSuccess", {
                    filename,
                }),
            );
            startTransition(() => {
                refreshBrowserRoute(router);
            });
        } catch {
            toast.error(t("transcription.autoRenameFailed"));
        } finally {
            setIsApplyingAutoRename(false);
        }
    }, [autoRenamePreview, currentRecording, router, t]);

    const handleDelete = useCallback(async () => {
        if (!currentRecording) return;
        if (!currentRecording.upstreamDeleted) return;

        const confirmed = await confirm({
            title: t("common.confirmAction"),
            description: t("dashboard.deleteConfirm", {
                filename: currentRecording.filename,
            }),
            confirmLabel: t("common.confirm"),
            cancelLabel: t("common.cancel"),
            variant: "destructive",
        });
        if (!confirmed) {
            return;
        }

        try {
            const response = await fetch(
                `/api/recordings/${currentRecording.id}`,
                { method: "DELETE" },
            );

            const data = await response.json();
            if (!response.ok) {
                toast.error(data.error || t("dashboard.deleteFailed"));
                return;
            }

            toast.success(t("dashboard.deleteSuccess"));
            setCurrentRecording(null);
            refreshBrowserRoute(router);
        } catch {
            toast.error(t("dashboard.deleteFailed"));
        }
    }, [confirm, currentRecording, router, t]);

    return (
        <>
            <div
                className="dashboard-workstation min-h-screen px-3 py-3 sm:px-4 lg:px-5"
                data-sidebar-collapsed={isSidebarCollapsed ? "true" : "false"}
                data-source-drawer={isSourceDrawerOpen ? "open" : "closed"}
                data-testid="dashboard-workstation"
            >
                <button
                    type="button"
                    aria-label={
                        language === "zh-CN" ? "关闭筛选抽屉" : "Close filters"
                    }
                    data-testid="dashboard-source-drawer-scrim"
                    className={cn(
                        "fixed inset-0 z-[70] bg-black/35 opacity-0 backdrop-blur-[2px] transition-opacity duration-200 lg:hidden",
                        isSourceDrawerOpen
                            ? "pointer-events-auto opacity-100"
                            : "pointer-events-none",
                    )}
                    onClick={() => setSourceDrawerOpen(false)}
                />
                <div
                    className="dashboard-workstation-grid mx-auto grid max-w-[1280px] gap-3 lg:h-[calc(100svh-2rem)] lg:min-h-[680px] lg:grid-cols-[16.5rem_minmax(22rem,24rem)_minmax(0,1fr)] lg:grid-rows-[3.5rem_minmax(0,1fr)] lg:overflow-hidden"
                    data-sidebar-collapsed={
                        isSidebarCollapsed ? "true" : "false"
                    }
                >
                    <aside
                        className={cn(
                            "dashboard-source-sidebar glass-surface fixed top-3 bottom-3 left-3 z-[80] flex w-[min(18rem,calc(100vw-2rem))] min-h-0 flex-col rounded-2xl p-3 transition-transform duration-300 ease-[var(--ease-sine)] lg:static lg:row-span-2 lg:w-auto lg:min-h-0 lg:translate-x-0",
                            isSourceDrawerOpen
                                ? "translate-x-0"
                                : "-translate-x-[calc(100%+1rem)]",
                            isSidebarCollapsed && "lg:p-2",
                        )}
                        data-collapsed={isSidebarCollapsed ? "true" : "false"}
                        data-drawer-open={isSourceDrawerOpen ? "true" : "false"}
                        data-testid="dashboard-source-rail"
                    >
                        <div className="mb-4 flex items-center gap-3 px-1 pt-1">
                            <Logo className="size-9 shrink-0 text-primary" />
                            <div
                                className={cn(
                                    "dashboard-sidebar-brand min-w-0",
                                    isSidebarCollapsed && "lg:sr-only",
                                )}
                            >
                                <h1 className="truncate text-base font-semibold tracking-tight">
                                    BetterAINote
                                </h1>
                                <p className="text-xs text-muted-foreground">
                                    {language === "zh-CN"
                                        ? "私人工作空间"
                                        : "Private workspace"}
                                </p>
                            </div>
                        </div>

                        <div className="mb-4 flex flex-col gap-1">
                            <button
                                type="button"
                                onClick={() => handleFavoriteSelect("all")}
                                data-active={
                                    activeFavorite === "all" ? "true" : "false"
                                }
                                className={cn(
                                    "group flex items-center gap-2 rounded-[0.8rem] px-2.5 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-background/45 hover:text-foreground data-[active=true]:bg-background/70 data-[active=true]:text-foreground data-[active=true]:shadow-xs",
                                    isSidebarCollapsed &&
                                        "lg:justify-center lg:px-2",
                                )}
                            >
                                <Mic className="size-4 shrink-0" />
                                <span
                                    className={cn(
                                        "min-w-0 flex-1 truncate",
                                        isSidebarCollapsed && "lg:sr-only",
                                    )}
                                >
                                    {language === "zh-CN"
                                        ? "全部录音"
                                        : "All recordings"}
                                </span>
                                <span
                                    className={cn(
                                        "rounded-md border border-border/70 bg-background/50 px-1.5 text-[0.68rem]",
                                        isSidebarCollapsed && "lg:hidden",
                                    )}
                                >
                                    {liveRecordings.length}
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    handleFavoriteSelect("transcribed")
                                }
                                data-active={
                                    activeFavorite === "transcribed"
                                        ? "true"
                                        : "false"
                                }
                                className={cn(
                                    "group flex items-center gap-2 rounded-[0.8rem] px-2.5 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-background/45 hover:text-foreground data-[active=true]:bg-background/70 data-[active=true]:text-foreground data-[active=true]:shadow-xs",
                                    isSidebarCollapsed &&
                                        "lg:justify-center lg:px-2",
                                )}
                            >
                                <FileText className="size-4 shrink-0" />
                                <span
                                    className={cn(
                                        "min-w-0 flex-1 truncate",
                                        isSidebarCollapsed && "lg:sr-only",
                                    )}
                                >
                                    {language === "zh-CN"
                                        ? "转写记录"
                                        : "Transcribed"}
                                </span>
                                <span
                                    className={cn(
                                        "rounded-md border border-border/70 bg-background/50 px-1.5 text-[0.68rem]",
                                        isSidebarCollapsed && "lg:hidden",
                                    )}
                                >
                                    {
                                        liveRecordings.filter((recording) =>
                                            recordingHasTranscript(
                                                liveTranscriptions.get(
                                                    recording.id,
                                                ),
                                            ),
                                        ).length
                                    }
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleFavoriteSelect("tags")}
                                data-active={
                                    activeFavorite === "tags" ? "true" : "false"
                                }
                                className={cn(
                                    "group flex items-center gap-2 rounded-[0.8rem] px-2.5 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-background/45 hover:text-foreground data-[active=true]:bg-background/70 data-[active=true]:text-foreground data-[active=true]:shadow-xs",
                                    isSidebarCollapsed &&
                                        "lg:justify-center lg:px-2",
                                )}
                            >
                                <Tags className="size-4 shrink-0" />
                                <span
                                    className={cn(
                                        "min-w-0 flex-1 truncate",
                                        isSidebarCollapsed && "lg:sr-only",
                                    )}
                                >
                                    {language === "zh-CN" ? "标签" : "Tags"}
                                </span>
                                <span
                                    className={cn(
                                        "rounded-md border border-border/70 bg-background/50 px-1.5 text-[0.68rem]",
                                        isSidebarCollapsed && "lg:hidden",
                                    )}
                                >
                                    {tagCatalog.length}
                                </span>
                            </button>
                        </div>

                        <SourceProviderRows
                            compact={isSidebarCollapsed && !isSourceDrawerOpen}
                            rows={sourceRows}
                            activeProvider={activeSourceProvider}
                            language={language}
                            onSelectProvider={(provider) => {
                                setActiveSourceProvider((previous) =>
                                    previous === provider ? null : provider,
                                );
                                setSourceDrawerOpen(false);
                            }}
                            onConnectProvider={(provider) => {
                                handleOpenDataSourcesSettings(provider);
                                setSourceDrawerOpen(false);
                            }}
                            onClearProvider={() => {
                                setActiveSourceProvider(null);
                                setSourceDrawerOpen(false);
                            }}
                        />

                        <div className="mt-auto flex flex-col gap-3 pt-4">
                            {!isSidebarCollapsed ? (
                                <SyncStatus
                                    autoSyncEnabled={autoSyncEnabled}
                                    lastSyncTime={lastSyncTime}
                                    nextSyncTime={nextSyncTime}
                                    isAutoSyncing={isAutoSyncing}
                                    lastSyncResult={lastSyncResult}
                                    workerStatus={workerStatus}
                                />
                            ) : null}
                            <Button
                                onClick={handleSync}
                                disabled={isAutoSyncing}
                                variant="outline"
                                size="sm"
                                className="h-9 justify-center rounded-xl"
                            >
                                {isAutoSyncing ? (
                                    <>
                                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                        <span
                                            className={cn(
                                                isSidebarCollapsed &&
                                                    "lg:sr-only",
                                            )}
                                        >
                                            {t("dashboard.syncing")}
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw className="mr-2 h-4 w-4" />
                                        <span
                                            className={cn(
                                                isSidebarCollapsed &&
                                                    "lg:sr-only",
                                            )}
                                        >
                                            {t("dashboard.syncDevice")}
                                        </span>
                                    </>
                                )}
                            </Button>
                        </div>
                    </aside>

                    <header className="glass-surface relative z-[210] flex min-h-14 items-center justify-between gap-3 overflow-visible rounded-2xl px-3 py-2 lg:col-span-2">
                        <div className="flex min-w-0 items-center gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                aria-label={
                                    language === "zh-CN"
                                        ? "打开筛选抽屉"
                                        : "Open filters"
                                }
                                aria-expanded={isSourceDrawerOpen}
                                data-testid="dashboard-source-drawer-trigger"
                                className="relative h-9 w-9 shrink-0 rounded-xl lg:hidden"
                                onClick={() => setSourceDrawerOpen(true)}
                            >
                                <Menu className="h-4 w-4" />
                                {activeSourceProvider ? (
                                    <span
                                        className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-primary"
                                        aria-hidden="true"
                                    />
                                ) : null}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                aria-label={
                                    language === "zh-CN"
                                        ? "折叠或展开侧边栏"
                                        : "Collapse or expand sidebar"
                                }
                                aria-pressed={isSidebarCollapsed}
                                data-testid="dashboard-sidebar-collapse-trigger"
                                className="hidden h-9 w-9 shrink-0 rounded-xl lg:inline-flex"
                                onClick={() =>
                                    setSidebarCollapsed((previous) => !previous)
                                }
                            >
                                {isSidebarCollapsed ? (
                                    <PanelLeftOpen className="h-4 w-4" />
                                ) : (
                                    <PanelLeftClose className="h-4 w-4" />
                                )}
                            </Button>
                            <div className="min-w-0">
                                <p className="truncate text-xs font-medium text-muted-foreground">
                                    {listContextLabel}
                                </p>
                                <p className="truncate text-sm font-semibold">
                                    {currentRecording
                                        ? currentRecording.filename
                                        : t("dashboard.noRecordings")}
                                </p>
                            </div>
                        </div>
                        <SystemBanner className="hidden min-w-[15rem] flex-1 lg:flex" />
                        <div className="flex shrink-0 items-center gap-2">
                            <Button
                                onClick={handleSync}
                                disabled={isAutoSyncing}
                                variant="outline"
                                size="sm"
                                className="hidden h-9 rounded-xl sm:inline-flex"
                            >
                                {isAutoSyncing ? (
                                    <>
                                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                        {t("dashboard.syncing")}
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw className="mr-2 h-4 w-4" />
                                        {t("dashboard.syncDevice")}
                                    </>
                                )}
                            </Button>
                            <LibrarySearch
                                open={activeTopbarOverlay === "search"}
                                onOpenChange={setSearchOverlayOpen}
                                onOpenRecording={handleOpenSearchResult}
                            />
                            <ActivityOverlay
                                open={activeTopbarOverlay === "activity"}
                                onOpenChange={setActivityOverlayOpen}
                                autoSyncEnabled={autoSyncEnabled}
                                isAutoSyncing={isAutoSyncing}
                                lastSyncTime={lastSyncTime}
                                nextSyncTime={nextSyncTime}
                                lastSyncResult={lastSyncResult}
                                workerStatus={workerStatus}
                                recordings={liveRecordings}
                                transcriptionJobs={liveTranscriptionJobs}
                                onSyncNow={handleSync}
                                onOpenRecording={handleOpenSearchResult}
                            />
                            <Button
                                onClick={handleOpenSettings}
                                variant="outline"
                                size="icon"
                                aria-label={t("settingsDialog.title")}
                                className="rounded-xl"
                            >
                                <Settings className="h-4 w-4" />
                            </Button>
                        </div>
                    </header>

                    <section className="min-h-0 lg:col-start-2 lg:row-start-2">
                        <RecordingList
                            recordings={filteredRecordings}
                            totalCount={filteredRecordings.length}
                            libraryTotalCount={liveRecordings.length}
                            currentRecording={currentRecording}
                            contextLabel={listContextLabel}
                            filterStack={
                                <SourceFilterStackStrip
                                    activeFavoriteLabel={activeFavoriteLabel}
                                    filteredCount={filteredRecordings.length}
                                    language={language}
                                    onClearAll={handleClearDashboardFilters}
                                    onClearSource={() =>
                                        setActiveSourceProvider(null)
                                    }
                                    onOpenDataSourcesSettings={
                                        handleOpenDataSourcesSettings
                                    }
                                    onRetrySync={handleSync}
                                    onWidenFilters={handleWidenSourceFilters}
                                    sourceRow={activeSourceRow}
                                    sourceTotalCount={activeSourceTotalCount}
                                    totalCount={liveRecordings.length}
                                />
                            }
                            mode={recordingListMode}
                            isLoading={
                                areDataSourcesLoading &&
                                liveRecordings.length === 0
                            }
                            onModeChange={handleRecordingListModeChange}
                            onClearFilters={handleClearDashboardFilters}
                            onOpenDataSourcesSettings={
                                handleOpenDataSourcesSettings
                            }
                            transcriptionJobs={liveTranscriptionJobs}
                            onSelect={(recording) => {
                                setTagManagerOpen(false);
                                setCurrentRecording(recording);
                            }}
                        />
                    </section>

                    <section className="flex min-h-0 flex-col gap-4 overflow-hidden lg:col-start-3 lg:row-start-2">
                        {currentRecording ? (
                            <>
                                <div className="shrink-0 flex flex-col gap-3">
                                    <div className="flex items-center gap-3">
                                        {isRenaming ? (
                                            <div className="flex flex-1 items-center gap-2">
                                                <Input
                                                    value={renameValue}
                                                    onChange={(event) =>
                                                        setRenameValue(
                                                            event.target.value,
                                                        )
                                                    }
                                                    onKeyDown={(event) => {
                                                        if (
                                                            event.key ===
                                                            "Enter"
                                                        ) {
                                                            handleRenameSave();
                                                        }
                                                        if (
                                                            event.key ===
                                                            "Escape"
                                                        ) {
                                                            handleRenameCancel();
                                                        }
                                                    }}
                                                    className="h-auto py-1 text-lg font-semibold"
                                                    autoFocus
                                                    disabled={isSavingRename}
                                                />
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={handleAutoRename}
                                                    disabled={
                                                        !canAutoRenameCurrentRecording
                                                    }
                                                    title={
                                                        autoRenameDisabledReason ??
                                                        t(
                                                            "transcription.aiRename",
                                                        )
                                                    }
                                                    className="h-10 shrink-0 rounded-full border-border/60 bg-background/30 px-3 text-xs shadow-none backdrop-blur-xl hover:bg-background/50"
                                                >
                                                    <Sparkles
                                                        className={
                                                            isAutoRenaming
                                                                ? "h-4 w-4 animate-pulse"
                                                                : "h-4 w-4"
                                                        }
                                                    />
                                                    <span className="hidden sm:inline">
                                                        {t(
                                                            "transcription.aiRename",
                                                        )}
                                                    </span>
                                                </Button>
                                                <Button
                                                    size="icon"
                                                    variant="outline"
                                                    onClick={handleRenameSave}
                                                    disabled={isSavingRename}
                                                    title={t(
                                                        "recording.saveRename",
                                                    )}
                                                    className="h-10 w-10 shrink-0 rounded-full border-emerald-500/30 bg-emerald-500/10 text-emerald-700 shadow-none hover:bg-emerald-500/15 dark:text-emerald-200"
                                                >
                                                    <CheckCircle className="h-5 w-5" />
                                                </Button>
                                                <Button
                                                    size="icon"
                                                    variant="outline"
                                                    onClick={handleRenameCancel}
                                                    disabled={isSavingRename}
                                                    title={t(
                                                        "recording.cancelRename",
                                                    )}
                                                    className="h-10 w-10 shrink-0 rounded-full border-border/60 bg-background/30 shadow-none backdrop-blur-xl hover:bg-background/50"
                                                >
                                                    <X className="h-5 w-5" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <>
                                                <h2 className="flex-1 truncate text-lg font-semibold">
                                                    {currentRecording.filename}
                                                </h2>
                                                {currentRecording.upstreamDeleted && (
                                                    <span className="inline-flex shrink-0 items-center gap-1 rounded bg-amber-500/20 px-2 py-1 text-xs font-medium text-amber-400">
                                                        <CloudOff className="h-3 w-3" />
                                                        {t(
                                                            "dashboard.localOnly",
                                                        )}
                                                    </span>
                                                )}
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={handleAutoRename}
                                                    disabled={
                                                        !canAutoRenameCurrentRecording
                                                    }
                                                    aria-busy={isAutoRenaming}
                                                    title={
                                                        autoRenameDisabledReason ??
                                                        t(
                                                            "transcription.aiRename",
                                                        )
                                                    }
                                                    className="h-10 shrink-0 rounded-full border-border/60 bg-background/30 px-3 text-xs shadow-none backdrop-blur-xl hover:bg-background/50"
                                                >
                                                    <Sparkles
                                                        className={
                                                            isAutoRenaming
                                                                ? "h-4 w-4 animate-pulse"
                                                                : "h-4 w-4"
                                                        }
                                                    />
                                                    <span className="hidden sm:inline">
                                                        {t(
                                                            "transcription.aiRename",
                                                        )}
                                                    </span>
                                                </Button>
                                                {canRenameCurrentRecording ? (
                                                    <Button
                                                        size="icon"
                                                        variant="outline"
                                                        onClick={
                                                            handleRenameStart
                                                        }
                                                        title={
                                                            currentRenameActionLabel
                                                        }
                                                        className="shrink-0"
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                ) : null}
                                                <div
                                                    ref={moreActionsRef}
                                                    className="relative shrink-0"
                                                    data-testid="dashboard-detail-more-actions"
                                                >
                                                    <Button
                                                        type="button"
                                                        size="icon"
                                                        variant="outline"
                                                        aria-haspopup="menu"
                                                        aria-expanded={
                                                            isMoreActionsOpen
                                                        }
                                                        aria-label={
                                                            language === "zh-CN"
                                                                ? "更多操作"
                                                                : "More actions"
                                                        }
                                                        className="shrink-0"
                                                        onClick={() =>
                                                            setMoreActionsOpen(
                                                                (open) => !open,
                                                            )
                                                        }
                                                    >
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                    {isMoreActionsOpen ? (
                                                        <div
                                                            role="menu"
                                                            aria-label={
                                                                language ===
                                                                "zh-CN"
                                                                    ? "更多操作"
                                                                    : "More actions"
                                                            }
                                                            data-testid="dashboard-detail-more-menu"
                                                            data-local-delete-available={
                                                                currentRecording.upstreamDeleted
                                                                    ? "true"
                                                                    : "false"
                                                            }
                                                            className="absolute top-11 right-0 z-[220] w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border/80 bg-popover text-popover-foreground shadow-2xl"
                                                        >
                                                            <header className="border-border/70 border-b px-3.5 py-2.5">
                                                                <p className="font-semibold text-sm">
                                                                    {language ===
                                                                    "zh-CN"
                                                                        ? "更多操作"
                                                                        : "More actions"}
                                                                </p>
                                                            </header>
                                                            {!currentRecording.upstreamDeleted ? (
                                                                <p className="px-3.5 py-2.5 text-muted-foreground text-xs leading-5">
                                                                    {language ===
                                                                    "zh-CN"
                                                                        ? "当前录音暂无额外本地操作。"
                                                                        : "No additional local actions are available for this recording."}
                                                                </p>
                                                            ) : null}
                                                            <div className="p-1.5">
                                                                <button
                                                                    type="button"
                                                                    role="menuitem"
                                                                    disabled={
                                                                        !currentRecording.upstreamDeleted
                                                                    }
                                                                    aria-disabled={
                                                                        !currentRecording.upstreamDeleted
                                                                    }
                                                                    data-testid="dashboard-delete-local-recording"
                                                                    className="flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50"
                                                                    onClick={() => {
                                                                        setMoreActionsOpen(
                                                                            false,
                                                                        );
                                                                        void handleDelete();
                                                                    }}
                                                                >
                                                                    <Trash2 className="mt-0.5 h-4 w-4 shrink-0" />
                                                                    <span className="min-w-0">
                                                                        <span className="block font-medium">
                                                                            {t(
                                                                                "dashboard.deleteLocalRecording",
                                                                            )}
                                                                        </span>
                                                                        <span className="mt-0.5 block text-muted-foreground text-xs leading-5">
                                                                            {currentRecording.upstreamDeleted
                                                                                ? language ===
                                                                                  "zh-CN"
                                                                                    ? "仅删除本地副本，不会影响来源端。"
                                                                                    : "Deletes the local copy only and leaves the upstream source untouched."
                                                                                : language ===
                                                                                    "zh-CN"
                                                                                  ? "仅来源已删除的本地副本可删除。"
                                                                                  : "Only local copies whose upstream source was deleted can be removed."}
                                                                        </span>
                                                                    </span>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    {isAutoRenaming && !autoRenamePreview ? (
                                        <AiRenamePreviewCard
                                            isApplying={false}
                                            isRegenerating={isAutoRenaming}
                                            message={
                                                language === "zh-CN"
                                                    ? "正在根据当前转写生成可预览的标题。"
                                                    : "Generating a preview title from the current transcript."
                                            }
                                            state="loading"
                                            title={t("transcription.aiRename")}
                                        />
                                    ) : autoRenameError ? (
                                        <AiRenamePreviewCard
                                            isApplying={false}
                                            isRegenerating={isAutoRenaming}
                                            message={autoRenameError}
                                            onRegenerate={handleAutoRename}
                                            regenerateLabel={t(
                                                "transcription.aiRenameRegenerate",
                                            )}
                                            state="error"
                                            title={t(
                                                "transcription.autoRenameFailed",
                                            )}
                                        />
                                    ) : autoRenamePreview ? (
                                        <AiRenamePreviewCard
                                            applyLabel={t(
                                                "transcription.aiRenameApply",
                                            )}
                                            cancelLabel={t(
                                                "transcription.aiRenameCancelPreview",
                                            )}
                                            filename={autoRenamePreview}
                                            isApplying={isApplyingAutoRename}
                                            isRegenerating={isAutoRenaming}
                                            onApply={
                                                handleAutoRenamePreviewApply
                                            }
                                            onCancel={
                                                handleAutoRenamePreviewCancel
                                            }
                                            onRegenerate={handleAutoRename}
                                            regenerateLabel={t(
                                                "transcription.aiRenameRegenerate",
                                            )}
                                            title={t(
                                                "transcription.aiRenamePreview",
                                            )}
                                        />
                                    ) : autoRenameDisabledReason ? (
                                        <AiRenamePreviewCard
                                            isApplying={false}
                                            isRegenerating={false}
                                            message={autoRenameDisabledReason}
                                            state="unavailable"
                                            title={t("transcription.aiRename")}
                                        />
                                    ) : null}
                                    <RecordingPlayer
                                        recording={currentRecording}
                                        tags={currentRecording.tags}
                                        isTagManagerOpen={tagManagerOpen}
                                        onToggleTagManager={() =>
                                            setTagManagerOpen((open) => !open)
                                        }
                                        tagManagerPanel={
                                            <RecordingTagManager
                                                variant="popover"
                                                recording={currentRecording}
                                                availableTags={tagCatalog}
                                                onAvailableTagsChange={
                                                    setTagCatalog
                                                }
                                                onRecordingTagsChange={
                                                    applyRecordingTags
                                                }
                                            />
                                        }
                                        onEnded={() => {
                                            const index =
                                                liveRecordings.findIndex(
                                                    (recording) =>
                                                        recording.id ===
                                                        currentRecording.id,
                                                );
                                            if (
                                                index >= 0 &&
                                                index <
                                                    liveRecordings.length - 1
                                            ) {
                                                setTagManagerOpen(false);
                                                setCurrentRecording(
                                                    liveRecordings[index + 1],
                                                );
                                            }
                                        }}
                                    />
                                </div>

                                <div className="flex min-h-0 flex-1 flex-col">
                                    <TranscriptionPanel
                                        recording={currentRecording}
                                        transcription={currentTranscription}
                                        transcriptionJob={
                                            currentTranscriptionJob
                                        }
                                        isTranscriptLoading={
                                            isCurrentTranscriptLoading
                                        }
                                        onTranscribe={handleTranscribe}
                                        onRetranscribe={handleRetranscribe}
                                        className="min-h-0 flex-1"
                                    />
                                </div>
                            </>
                        ) : (
                            <Card
                                hasNoPadding
                                className="glass-surface flex min-h-[26rem] flex-1 items-center justify-center rounded-2xl"
                            >
                                <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
                                    <Mic className="mb-4 h-12 w-12 text-muted-foreground" />
                                    <h3 className="mb-2 text-base font-semibold">
                                        {liveRecordings.length === 0
                                            ? t("dashboard.noRecordings")
                                            : t("dashboard.selectRecording")}
                                    </h3>
                                    <p className="max-w-md text-sm text-muted-foreground">
                                        {liveRecordings.length === 0
                                            ? t(
                                                  "dashboard.noRecordingsDescription",
                                              )
                                            : listContextLabel}
                                    </p>
                                </CardContent>
                            </Card>
                        )}
                    </section>
                </div>
            </div>

            <SettingsDialog
                open={settingsOpen}
                onOpenChange={setSettingsOpen}
            />
        </>
    );
}
