"use client";

import {
    AlertCircle,
    Bell,
    Check,
    CheckCircle,
    CircleAlert,
    CloudDownload,
    EllipsisVertical,
    FileText,
    Menu,
    Mic,
    Music,
    PanelLeft,
    Pencil,
    Plus,
    RefreshCw,
    Sparkle,
    Tags,
    Trash2,
    X,
} from "lucide-react";
import Image from "next/image";
import {
    type KeyboardEvent as ReactKeyboardEvent,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { toast } from "sonner";
import { useLanguage } from "@/components/language-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardAction,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { DashboardRecordingPlayerControls } from "@/features/dashboard/components/dashboard-recording-player-controls";
import {
    LibrarySearch,
    type LibrarySearchFilter,
} from "@/features/dashboard/components/library-search";
import {
    RecordingList,
    RecordingListControls,
    type RecordingListGroup,
    RecordingListPagination,
    RecordingListSkeleton,
    type RecordingListTagOption,
} from "@/features/dashboard/components/recording-list";
import { SystemBanner } from "@/features/dashboard/components/system-banner";
import {
    TranscriptionPanel,
    type TranscriptionPanelSpeaker,
    type TranscriptionPanelSpeakerMergeRequest,
} from "@/features/dashboard/components/transcription-panel";
import {
    DASHBOARD_FILTER_STATE_STORAGE_KEY,
    type DashboardFavoriteFilter,
    type DashboardFilterAction,
    type DashboardListMode,
    type DashboardTagFilter,
    DEFAULT_DASHBOARD_FILTER_STATE,
    dashboardFilterStateUrl,
    reduceDashboardFilterState,
    restoreDashboardFilterState,
    serializeDashboardFilterState,
} from "@/features/dashboard/filter-state";
import {
    adaptRecordingListFacets,
    buildRecordingListQueryParams,
    getRecordingTimelineFilter,
    type RecordingListFacets,
    type RecordingListTimelineFilter,
    reconcileRecordingSelection,
} from "@/features/dashboard/recording-list-controller";
import {
    isRecordingListUrlCurrent,
    readRecordingListUrlState,
    recordingListUrl,
} from "@/features/dashboard/recording-list-url-state";
import {
    DASHBOARD_SOURCE_FILTER_STORAGE_KEY,
    type DashboardSourceFilter,
    parseDashboardSourceFilter,
    resolveConnectedSourceStatus,
    toggleDashboardSourceFilter,
} from "@/features/dashboard/source-filter-state";
import {
    areDashboardTranscriptionJobsEqual,
    getDashboardTranscriptionPollingKey,
    resolveDashboardTranscriptionPoll,
} from "@/features/dashboard/transcription-polling";
import { AiRenamePreviewCard as AiRenamePreview } from "@/features/recordings/components/ai-rename-preview-card";
import {
    formatPlayerDate,
    PlayerNoAudioAlert,
    PlayerSourceTag,
    PlayerStatusBadge,
    type PlayerStatusTone,
    PlayerTagChip,
} from "@/features/recordings/components/player-primitives";
import { RecordingTagManager } from "@/features/recordings/components/recording-tag-manager";
import { SettingsDialog } from "@/features/settings/components/settings-dialog";
import { useDisplaySettingsStore } from "@/features/settings/display-settings-store";
import { usePlaybackSettingsStore } from "@/features/settings/playback-settings-store";
import {
    DashboardSourceReportState,
    SourceReportActionButton,
    SourceReportActionRow,
    SourceReportCardSkeleton,
    SourceReportCopyButton,
    SourceReportCopyIcon,
    SourceReportCopyLabel,
    SourceReportEmptyDescription,
    SourceReportEmptyIcon,
    SourceReportEmptySurface,
    SourceReportEmptyTitle,
    SourceReportMetaList,
    SourceReportMetaRow,
    SourceReportMetricCard,
    SourceReportMetricCards,
    SourceReportMissingNotice,
    SourceReportPane,
    SourceReportSection,
    SourceReportSegment,
    SourceReportSegmentSkeleton,
    SourceReportSegmentSkeletonBlock,
    SourceReportSegments,
    SourceReportSourceIdentity,
    SourceReportStatusBadge,
    SourceReportSummaryBody,
    SourceReportSummaryLine,
    type SourceReportTone,
} from "@/features/source-report/primitives";
import { type SyncWorkerErrorReason, useAutoSync } from "@/hooks/use-auto-sync";
import { useRecordingPlayback } from "@/hooks/use-recording-playback";
import {
    type DataSourceDisplayState,
    getSourceProviderLabel,
} from "@/lib/data-sources/presentation";
import type { UiLanguage } from "@/lib/i18n";
import {
    refreshBrowserRoute,
    useBrowserRouteController,
} from "@/lib/platform/browser-router";
import {
    readBrowserStorage,
    startBrowserInterval,
    stopBrowserInterval,
    writeBrowserStorage,
} from "@/lib/platform/browser-shell";
import { writeBrowserClipboardText } from "@/lib/platform/clipboard";
import { hasBrowserWindow } from "@/lib/platform/runtime";
import type { RecordingTag } from "@/lib/recording-tags";
import {
    getTranscriptionJobDisplayState,
    isActiveTranscriptionJob,
} from "@/lib/transcription/job-display";
import { cn } from "@/lib/utils";
import { getDataSources, runDataSourcesSync } from "@/services/data-sources";
import type { Recording } from "@/types/recording";
import type { CanonicalSettingsSection } from "@/types/settings";

type TranscriptionData = {
    hasTranscript?: boolean;
    text?: string | null;
    language?: string | null;
    speakerMap?: Record<string, string> | null;
    segments?: TranscriptSegmentData[] | null;
};

type TranscriptSegmentData = {
    text?: string | null;
    speakerLabel?: string | null;
    displaySpeaker?: string | null;
    startMs?: number | null;
    endMs?: number | null;
};

type TranscriptTurn = {
    text: string;
    speakerName?: string | null;
    startMs?: number | null;
    endMs?: number | null;
};

type TranscriptionPollTranscriptData = {
    text?: string | null;
    detectedLanguage?: string | null;
    speakerMap?: Record<string, string> | null;
    segments?: TranscriptSegmentData[] | null;
};

type TranscriptionJobData = {
    status: string;
    remoteStatus?: string | null;
    lastError?: string | null;
};

type DashboardSpeakerMergeState =
    | { state: "idle"; error: null }
    | { state: "pending"; error: null }
    | { state: "error"; error: string }
    | { state: "success"; error: null };

type QueriedRecording = Recording & {
    transcript?: {
        rawText?: string | null;
        detectedLanguage?: string | null;
        speakerMap?: Record<string, string> | null;
    } | null;
    transcriptionJob?: TranscriptionJobData | null;
};

type RecordingQueryResponse = {
    facets?: unknown;
    recordings: QueriedRecording[];
    pagination: {
        page: number;
        pageSize: number;
        total: number;
    };
};

type WorkstationProps = {
    recordings: Recording[];
    transcriptions: Map<string, TranscriptionData>;
    transcriptionJobs: Map<string, TranscriptionJobData>;
    pagination?: RecordingQueryResponse["pagination"];
    user?: {
        email?: string | null;
        name?: string | null;
    };
};

function buildPagedRecordingMaps(recordings: QueriedRecording[]) {
    const transcriptions = new Map<string, TranscriptionData>();
    const transcriptionJobs = new Map<string, TranscriptionJobData>();

    for (const recording of recordings) {
        if (recording.transcript) {
            transcriptions.set(recording.id, {
                hasTranscript: Boolean(recording.transcript.rawText?.trim()),
                text: recording.transcript.rawText ?? null,
                language: recording.transcript.detectedLanguage ?? null,
                speakerMap: recording.transcript.speakerMap ?? null,
            });
        }
        if (recording.transcriptionJob) {
            transcriptionJobs.set(recording.id, recording.transcriptionJob);
        }
    }

    return { transcriptions, transcriptionJobs };
}

function mergeTranscriptionData(
    current: TranscriptionData | undefined,
    incoming: TranscriptionData,
) {
    if (!current) {
        return incoming;
    }

    const textChanged =
        incoming.text !== undefined && incoming.text !== current.text;

    return {
        ...current,
        ...incoming,
        text: incoming.text === undefined ? current.text : incoming.text,
        language:
            incoming.language === undefined
                ? current.language
                : incoming.language,
        speakerMap:
            incoming.speakerMap === undefined
                ? current.speakerMap
                : incoming.speakerMap,
        segments:
            incoming.segments === undefined
                ? textChanged
                    ? undefined
                    : current.segments
                : incoming.segments,
    };
}

function areSpeakerMapsEqual(
    left: Record<string, string> | null | undefined,
    right: Record<string, string> | null | undefined,
) {
    if (left === right) {
        return true;
    }

    const leftEntries = Object.entries(left ?? {});
    const rightEntries = Object.entries(right ?? {});
    return (
        leftEntries.length === rightEntries.length &&
        leftEntries.every(([key, value]) => right?.[key] === value)
    );
}

function areTranscriptSegmentsEqual(
    left: TranscriptSegmentData[] | null | undefined,
    right: TranscriptSegmentData[] | null | undefined,
) {
    if (left === right) {
        return true;
    }
    if (!left || !right || left.length !== right.length) {
        return false;
    }

    return left.every((segment, index) => {
        const candidate = right[index];
        return (
            candidate?.text === segment.text &&
            candidate.speakerLabel === segment.speakerLabel &&
            candidate.displaySpeaker === segment.displaySpeaker &&
            candidate.startMs === segment.startMs &&
            candidate.endMs === segment.endMs
        );
    });
}

function areTranscriptionsEqual(
    left: TranscriptionData | undefined,
    right: TranscriptionData | undefined,
) {
    return (
        left === right ||
        (left?.hasTranscript === right?.hasTranscript &&
            left?.text === right?.text &&
            left?.language === right?.language &&
            areSpeakerMapsEqual(left?.speakerMap, right?.speakerMap) &&
            areTranscriptSegmentsEqual(left?.segments, right?.segments))
    );
}

function reconcileTranscriptionMaps(
    current: Map<string, TranscriptionData>,
    incoming: Map<string, TranscriptionData>,
) {
    const next = new Map(
        Array.from(incoming, ([recordingId, transcription]) => [
            recordingId,
            mergeTranscriptionData(current.get(recordingId), transcription),
        ]),
    );

    if (
        current.size === next.size &&
        Array.from(next).every(([recordingId, transcription]) =>
            areTranscriptionsEqual(current.get(recordingId), transcription),
        )
    ) {
        return current;
    }

    return next;
}

type DetailTab = "transcript" | "speakers" | "source";
type TimelineFilter = RecordingListTimelineFilter;
type RecordingListState =
    | "loading"
    | "ready"
    | "error"
    | "empty"
    | "no-match"
    | "timeline-empty"
    | "tag-empty";
type AiRenameState = "loading" | "review" | "error" | "unavailable";
type RetxState =
    | "idle"
    | "queued"
    | "running"
    | "failed"
    | "completed"
    | "unavailable";
type DashboardCopyAction =
    | "local-transcript"
    | "source-transcript"
    | "source-report"
    | null;
type DashboardCopyFeedback = {
    action: Exclude<DashboardCopyAction, null>;
    state: "ok" | "err";
} | null;
type SourceReportViewState = "idle" | "loading" | "loaded" | "error";
type SourceReportCopyState = "ready" | "missing" | "loading" | "error";
type SourceRepullState = "idle" | "loading" | "success" | "error";
type SourceReportSegmentData = {
    speaker?: string | null;
    startMs?: number | null;
    endMs?: number | null;
    text?: string | null;
};
type SourceActionAvailability = {
    available?: boolean;
    reason?: string | null;
};
type SourceOpenAction = SourceActionAvailability & {
    url?: string | null;
};
type SourceReportData = {
    sourceProvider?: string;
    filename?: string;
    transcriptReady?: boolean | string;
    summaryReady?: boolean | string;
    transcript?: {
        text?: string | null;
        segmentCount?: number | null;
        segments?: SourceReportSegmentData[];
    } | null;
    summaryMarkdown?: string | null;
    detail?: Record<string, unknown> | null;
    sourceActions?: {
        openSource?: SourceOpenAction | null;
        repullSource?: SourceActionAvailability | null;
    } | null;
};
type SourceReportSnapshot = {
    recordingId: string | null;
    state: SourceReportViewState;
    data: SourceReportData | null;
    error: string;
};
type SourceStatus =
    | "loading"
    | "connected"
    | "connected-empty"
    | "syncing"
    | "sync-error"
    | "no-results"
    | "needs-setup"
    | "expired"
    | "paused"
    | "planned";
type SyncButtonState = "idle" | "queued" | "running" | "success" | "error";

type ActivityTone = "loading" | "error" | "warn" | "success" | "info";
type ActivityItem = {
    id: string;
    tone: ActivityTone;
    title: string;
    body: string;
    action?: "sync" | "settings" | "recording";
    recordingId?: string;
};
type Translator = (
    key: string,
    replacements?: Record<string, string | number>,
) => string;

const SETTINGS_DATA_SOURCE_PROVIDER_STORAGE_KEY =
    "settings-data-source-provider";
const DASHBOARD_SIDEBAR_COLLAPSED_STORAGE_KEY = "dashboard-sidebar-collapsed";
const SOURCE_DRAWER_FOCUSABLE_SELECTOR =
    'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
const DETAIL_FOCUSABLE_SELECTOR =
    'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[contenteditable="true"],[tabindex]:not([tabindex="-1"])';
const DASHBOARD_WORKSTATION_SHELL_CLASS_NAME =
    "grid h-screen min-h-[720px] grid-cols-[264px_1fr] bg-background transition-[grid-template-columns] duration-[320ms] ease-[var(--ease-out)] data-[sidebar-collapsed=true]:grid-cols-[56px_1fr] max-[860px]:h-auto max-[860px]:min-h-[100svh] max-[860px]:grid-cols-[minmax(0,1fr)] max-[860px]:overflow-x-clip";

const DASHBOARD_MAIN_CLASS_NAME =
    "flex h-screen min-w-0 flex-col max-[860px]:min-w-0 max-[860px]:max-w-full max-[860px]:box-border";
const DASHBOARD_WORKSPACE_CLASS_NAME =
    "grid flex-1 min-h-0 grid-cols-[380px_1fr] gap-4 px-5 pt-4 pb-5 max-[1439px]:grid-cols-[minmax(0,1fr)] min-[1024px]:max-[1439px]:group-data-[detail-state=open]/dashboard-workstation:grid-cols-[320px_minmax(0,1fr)] max-[860px]:min-w-0 max-[860px]:max-w-full max-[860px]:box-border";
const DASHBOARD_RECORDING_LIST_CARD_CLASS_NAME =
    "min-h-0 gap-0 rounded-2xl max-[860px]:min-w-0 max-[860px]:max-w-full max-[860px]:box-border";
const DASHBOARD_DETAIL_PANEL_CLASS_NAME =
    "flex min-h-0 min-w-0 flex-col gap-4 max-[1439px]:hidden min-[1024px]:max-[1439px]:group-data-[detail-state=open]/dashboard-workstation:flex max-[1024px]:fixed max-[1024px]:inset-2 max-[1024px]:z-[330] max-[1024px]:overflow-y-auto max-[1024px]:rounded-lg max-[1024px]:bg-background max-[1024px]:p-4 max-[1024px]:shadow-lg max-[1024px]:group-data-[detail-state=open]/dashboard-workstation:flex";
const DASHBOARD_DETAIL_SCRIM_CLASS_NAME =
    "pointer-events-none fixed inset-0 z-[320] hidden bg-background/60 backdrop-blur-sm max-[1024px]:group-data-[detail-state=open]/dashboard-workstation:pointer-events-auto max-[1024px]:group-data-[detail-state=open]/dashboard-workstation:block";
const DASHBOARD_RECORDING_LIST_CONTENT_CLASS_NAME = "flex min-h-0 flex-col p-0";
const DASHBOARD_DETAIL_EMPTY_STATE_CLASS_NAME = "min-h-[280px] p-9 md:p-9";

const dashboardDrawerClassNames = {
    scrim: "pointer-events-none fixed inset-0 z-[300] hidden max-[860px]:block max-[860px]:group-data-[drawer-state=open]/dashboard-workstation:pointer-events-auto",
    activeDot:
        "absolute top-1.5 right-1.5 hidden size-1.5 rounded-full bg-primary group-data-[source-filter-active=true]/dashboard-workstation:inline-block",
} as const;

const dashboardTopbarClassNames = {
    topbar: "relative z-[60] flex h-14 flex-none flex-row items-center gap-3.5 border-b border-border bg-background/80 px-5 py-3 supports-[backdrop-filter]:bg-background/60 supports-[backdrop-filter]:backdrop-blur-[28px] supports-[backdrop-filter]:backdrop-saturate-[160%] max-[860px]:min-w-0 max-[860px]:max-w-full max-[860px]:box-border",
    crumbs: "flex items-center gap-2 text-sm font-medium text-muted-foreground",
    crumb: "text-muted-foreground",
    separator: "text-muted-foreground/60 max-[860px]:hidden",
    current: "font-semibold text-foreground max-[860px]:hidden",
} as const;

const dashboardSidebarCollapseClassNames = {
    sidebar:
        "relative flex flex-col rounded-none border-r border-sidebar-border bg-sidebar/70 px-3 pt-4 pb-3 text-sidebar-foreground supports-[backdrop-filter]:backdrop-blur-[36px] supports-[backdrop-filter]:backdrop-saturate-[180%] group-data-[sidebar-collapsed=true]/dashboard-workstation:px-1.5 group-data-[sidebar-collapsed=true]/dashboard-workstation:pt-4 group-data-[sidebar-collapsed=true]/dashboard-workstation:pb-3 max-[860px]:hidden max-[860px]:group-data-[drawer-state=open]/dashboard-workstation:fixed max-[860px]:group-data-[drawer-state=open]/dashboard-workstation:top-0 max-[860px]:group-data-[drawer-state=open]/dashboard-workstation:bottom-0 max-[860px]:group-data-[drawer-state=open]/dashboard-workstation:left-0 max-[860px]:group-data-[drawer-state=open]/dashboard-workstation:z-[310] max-[860px]:group-data-[drawer-state=open]/dashboard-workstation:flex max-[860px]:group-data-[drawer-state=open]/dashboard-workstation:max-w-[min(320px,calc(100vw-32px))]",
    hidden: "group-data-[sidebar-collapsed=true]/dashboard-workstation:hidden",
    brand: "group-data-[sidebar-collapsed=true]/dashboard-workstation:justify-center group-data-[sidebar-collapsed=true]/dashboard-workstation:px-0 group-data-[sidebar-collapsed=true]/dashboard-workstation:pt-1 group-data-[sidebar-collapsed=true]/dashboard-workstation:pb-4",
    favorite:
        "group-data-[sidebar-collapsed=true]/dashboard-workstation:justify-center group-data-[sidebar-collapsed=true]/dashboard-workstation:gap-0 group-data-[sidebar-collapsed=true]/dashboard-workstation:px-0 group-data-[sidebar-collapsed=true]/dashboard-workstation:py-2",
} as const;

const dashboardBrandClassNames = {
    wrapper: "flex items-center gap-2 px-2 pt-1 pb-4",
    image: "size-9 rounded-md",
    name: "text-sm font-semibold text-sidebar-foreground",
    subtitle: "mt-px text-xs font-medium text-muted-foreground",
} as const;

const dashboardNavClassNames = {
    root: "flex flex-1 flex-col gap-0.5 overflow-y-auto pb-3",
    sectionLabel:
        "px-2.5 pt-3.5 pb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
    favoriteCount: "min-w-6 justify-center px-1.5 font-mono",
} as const;

const SOURCE_ORDER = [
    {
        key: "dingtalk-a1",
        label: "钉钉",
        icon: "/assets/sources/dingtalk.svg",
        cover: false,
    },
    {
        key: "ticnote",
        label: "TicNote",
        icon: "/assets/sources/ticnote.png",
        cover: false,
    },
    {
        key: "plaud",
        label: "Plaud",
        icon: "/assets/sources/plaud.png",
        cover: true,
    },
    {
        key: "feishu-minutes",
        label: "飞书妙记",
        icon: "/assets/sources/feishu.jpeg",
        cover: true,
    },
    {
        key: "iflyrec",
        label: "讯飞听见",
        icon: null,
        cover: false,
    },
] as const;

const FAVORITES: { value: DashboardFavoriteFilter; icon: typeof Mic }[] = [
    { value: "all", icon: Mic },
    { value: "transcribed", icon: FileText },
    { value: "tags", icon: Tags },
];
const dashboardTabPaneHiddenClassName = "[&[hidden]]:hidden";

const DASHBOARD_SIDEBAR_FOOTER_CLASS_NAME = "border-t border-border pt-2.5";

const DASHBOARD_RECORDING_LIST_HEADER_CLASS_NAME =
    "border-b border-border px-3 pt-3 pb-2.5";

const dashboardRecordingListTitlebarStyles = {
    root: "flex items-center gap-2.5",
    title: "m-0 font-sans text-[13px] font-semibold text-foreground",
    count: "ml-auto font-mono text-[11.5px] font-medium text-muted-foreground",
} as const;

const dashboardRecordingListScrollClassName =
    "flex-1 overflow-y-auto p-1 [scrollbar-width:thin] [scrollbar-color:var(--muted-foreground)_transparent] [&::-webkit-scrollbar]:size-[10px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-2 [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-muted-foreground/35 [&::-webkit-scrollbar-thumb]:bg-clip-padding [&::-webkit-scrollbar-thumb:hover]:bg-muted-foreground/55 [&::-webkit-scrollbar-thumb:hover]:bg-clip-padding";

const dashboardRecordingListStateStyles = {
    root: "m-2",
    content: "mt-2",
} as const;

const dashboardSearchActivityClassNames = {
    dashboardTopbarActions: "ml-auto flex items-center gap-2",
    dashboardActivityAnchor:
        "relative inline-flex size-[32px] items-center justify-center p-0",
    dashboardActivityTrigger: "relative",
    dashboardActivityBadge:
        "pointer-events-none absolute right-0.5 top-0.5 min-w-4 px-1 text-[9.5px]",
    dashboardActivityPanel:
        "absolute right-0 top-[calc(100%+8px)] z-50 flex max-h-[520px] w-[380px] max-w-[calc(100vw-32px)] flex-col gap-0 min-[641px]:max-[860px]:fixed min-[641px]:max-[860px]:left-3 min-[641px]:max-[860px]:right-auto min-[641px]:max-[860px]:top-[72px] min-[641px]:max-[860px]:box-border min-[641px]:max-[860px]:max-h-[calc(100dvh-96px)] min-[641px]:max-[860px]:w-[min(380px,calc(100vw-24px))] min-[641px]:max-[860px]:max-w-[calc(100vw-24px)] max-[640px]:fixed max-[640px]:left-3 max-[640px]:right-3 max-[640px]:top-[72px] max-[640px]:box-border max-[640px]:max-h-[calc(100dvh-96px)] max-[640px]:w-[calc(100vw-24px)] max-[640px]:min-w-0 max-[640px]:max-w-none",
    dashboardActivityHeader: "flex items-center gap-2.5 px-3.5 py-3",
    dashboardActivityHeading: "flex flex-1 flex-col gap-0.5",
    dashboardActivityTitle: "text-sm font-semibold text-foreground",
    dashboardActivityCount:
        "justify-normal p-0 font-mono text-xs font-medium text-muted-foreground",
    dashboardActivityClose: "size-6",
    dashboardActivityContent: "flex min-h-0 flex-1 flex-col p-0",
    dashboardActivityStatus: "flex items-center gap-2.5 bg-muted px-3.5 py-2.5",
    dashboardActivityStatusIndicator:
        "size-2 flex-none rounded-full bg-primary data-[state=error]:bg-destructive data-[state=running]:animate-[bpulse_1.4s_ease-in-out_infinite] data-[state=syncing]:animate-[bpulse_1.4s_ease-in-out_infinite]",
    dashboardActivityStatusCopy: "flex min-w-0 flex-1 flex-col gap-0.5",
    dashboardActivityStatusLine: "text-xs font-semibold text-foreground",
    dashboardActivityStatusSub:
        "font-mono text-xs font-medium text-muted-foreground",
    dashboardActivitySync:
        "h-7 px-2.5 data-[action-state=error]:text-destructive disabled:cursor-not-allowed",
    dashboardActivityItems:
        "m-0 max-h-[340px] flex-1 list-none overflow-y-auto p-1 empty:hidden",
    dashboardActivityItem:
        "grid grid-cols-[26px_1fr_auto] items-start gap-2.5 rounded-lg p-2.5 [&+&]:rounded-none [&+&]:border-t [&+&]:border-border",
    dashboardActivityItemIcon:
        "inline-flex size-[26px] flex-none items-center justify-center rounded-[7px] border border-border bg-muted text-muted-foreground data-[kind=error]:border-destructive/30 data-[kind=error]:bg-destructive/10 data-[kind=error]:text-destructive data-[kind=info]:border-primary/30 data-[kind=info]:bg-primary/10 data-[kind=info]:text-primary data-[kind=partial-failed]:border-border data-[kind=partial-failed]:bg-secondary data-[kind=partial-failed]:text-secondary-foreground data-[kind=queued]:bg-muted data-[kind=queued]:text-muted-foreground data-[kind=success]:border-primary/30 data-[kind=success]:bg-primary/10 data-[kind=success]:text-primary data-[kind=warn]:border-border data-[kind=warn]:bg-secondary data-[kind=warn]:text-secondary-foreground",
    dashboardActivityItemCopy: "flex min-w-0 flex-col gap-[3px]",
    dashboardActivityItemTitle:
        "m-0 text-sm font-semibold leading-snug text-foreground",
    dashboardActivityItemBody:
        "mt-0.5 mb-0 text-xs font-medium leading-normal text-muted-foreground",
    dashboardActivityItemMeta:
        "mt-1 font-mono text-xs font-medium leading-snug text-muted-foreground",
    dashboardActivityItemActions: "mt-1.5 flex items-center gap-1.5",
    dashboardActivityAction:
        "h-7 px-2.5 data-[action-state=error]:text-destructive disabled:cursor-not-allowed",
    dashboardActivityDismiss: "size-6 p-0",
    dashboardActivityEmpty: "p-7 md:p-7 [&[hidden]]:hidden",
} as const;

const dashboardButtonClassNames = {
    nav: "w-full justify-start gap-2.5 px-2.5 text-muted-foreground data-[state=selected]:bg-sidebar-accent data-[state=selected]:text-sidebar-accent-foreground",
    sync: "text-muted-foreground",
    drawerTrigger:
        "relative hidden h-[2px] w-[22.5px] px-[11.25px] py-px after:absolute after:-inset-[21px] after:content-[''] max-[860px]:inline-flex",
    sidebarCollapse:
        "absolute top-[18px] -left-[11px] z-[5] size-[22px] rounded-full border-border bg-sidebar p-0 text-muted-foreground hover:bg-accent hover:text-accent-foreground max-[860px]:hidden",
    settingsAvatar: "rounded-full text-xs font-semibold",
    listPagination: "text-muted-foreground",
    headerIconButton: "text-muted-foreground",
    headerActionButton: "min-w-[103px]",
} as const;

const dashboardSourceErrorClassName =
    "px-[10px] py-1.5 font-sans text-[11.5px] font-medium text-destructive";

const dashboardSourceClassNames = {
    root: "group/source-provider relative h-auto w-full justify-start gap-2.5 px-2.5 py-2 text-left text-sm text-muted-foreground data-[state=selected]:text-foreground data-[state=connected-active]:text-foreground data-[state=sync-error]:text-foreground data-[state=disabled]:opacity-50",
    mark: "inline-flex size-[18px] flex-none items-center justify-center overflow-hidden rounded-sm data-[state=no-results]:opacity-60 data-[state=needs-setup]:opacity-60 data-[state=needs-setup]:grayscale data-[state=disabled]:grayscale",
    markImage: "block size-[18px] max-w-none object-contain align-baseline",
    markImageCover: "object-cover",
    markLetter: "text-xs font-bold text-muted-foreground",
    clear: "h-6 w-fit gap-1 rounded-full px-2 text-xs",
    action: "ml-1.5 h-6 flex-none cursor-pointer rounded-full px-2 text-xs whitespace-nowrap data-[action=retry]:hidden data-[action=retry]:text-destructive data-[action=connect]:text-primary group-hover/source-provider:data-[action=retry]:inline-flex group-focus-within/source-provider:data-[action=retry]:inline-flex group-data-[sidebar-collapsed=true]/dashboard-workstation:hidden",
    status: "ml-0.5 size-1.5 min-w-1.5 self-center rounded-full border-0 p-0 data-[effect=ring]:ring-2 data-[effect=ring]:ring-secondary data-[tone=disabled]:bg-muted-foreground/40 data-[tone=err]:bg-destructive data-[tone=err]:ring-2 data-[tone=err]:ring-destructive/15 data-[tone=ok]:bg-primary data-[tone=syncing]:animate-[bpulse_1.2s_ease-in-out_infinite] data-[tone=syncing]:bg-primary data-[tone=syncing]:ring-2 data-[tone=syncing]:ring-primary/15 data-[tone=warn]:bg-secondary-foreground",
    count: "min-w-[22px] px-1.5 text-center font-mono text-xs data-[tone=active]:text-foreground data-[tone=empty]:line-through data-[tone=err]:text-destructive",
} as const;

const sourceFilterClassNames = {
    clear: "size-4 p-0 text-muted-foreground",
    librarySearchFilterClear: "size-4 p-0 text-muted-foreground",
    action: "ml-1.5 h-6 flex-none cursor-pointer rounded-full px-2 text-xs whitespace-nowrap data-[action=open-settings]:text-primary data-[action=retry]:text-destructive data-[action=widen]:text-primary",
    clearAll: "h-6 px-2 text-sm",
} as const;

const sourceFilterStackClassNames = {
    root: "flex min-w-0 flex-row flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground",
    from: "inline-flex min-w-0 max-w-full flex-[0_1_auto] items-baseline truncate leading-6",
    strong: "whitespace-nowrap font-semibold text-foreground",
    separator:
        "inline-flex h-6 w-2.5 flex-none select-none items-center justify-center text-sm leading-none text-muted-foreground/60",
    chip: "h-6 max-w-full gap-1.5 pl-2 pr-1",
    label: "truncate",
    info: "inline-flex min-w-0 flex-[0_1_auto] items-center truncate leading-6 text-muted-foreground",
    infoStrong: "mx-0.5 font-semibold text-foreground",
    libraryRoot:
        "mt-1.5 flex items-center gap-1.5 font-sans text-xs font-medium text-muted-foreground",
    libraryLabel: "truncate",
} as const;

function dashboardSourceButtonClassName(collapsed: boolean) {
    return cn(
        dashboardSourceClassNames.root,
        collapsed && "justify-center gap-0 px-0 py-2",
    );
}

function tagFilterValue(tagId: string): DashboardTagFilter {
    return `tag:${tagId}`;
}

function tagIdFromFilter(value: DashboardTagFilter) {
    return value.startsWith("tag:") ? value.slice(4) : null;
}

function providerLabel(provider: string, language: UiLanguage) {
    return (
        getSourceProviderLabel(provider, language) ??
        SOURCE_ORDER.find((source) => source.key === provider)?.label ??
        provider
    );
}

function sourceOpenLabel(
    provider: string | null | undefined,
    language: UiLanguage,
) {
    if (!provider) {
        return language === "zh-CN" ? "在来源中打开" : "Open in source";
    }

    const label = providerLabel(provider, language);
    return language === "zh-CN" ? `在${label}中打开` : `Open in ${label}`;
}

function sourceDefinition(provider: string | null | undefined) {
    return SOURCE_ORDER.find((source) => source.key === provider) ?? null;
}

function sourceReportDetailText(
    detail: Record<string, unknown> | null | undefined,
    keys: string[],
) {
    for (const key of keys) {
        const value = detail?.[key];
        if (typeof value === "string" && value.trim()) {
            return value.trim();
        }
        if (typeof value === "number" && Number.isFinite(value)) {
            return String(value);
        }
    }
    return null;
}

function sourceReportSummaryLines(markdown: string) {
    return markdown
        .split(/\r?\n/)
        .map((line) =>
            line
                .trim()
                .replace(/^#{1,6}\s+/, "")
                .replace(/^[-*]\s+/, ""),
        )
        .filter(Boolean);
}

function formatDuration(value: number) {
    const seconds =
        value > 10_000 ? Math.floor(value / 1000) : Math.floor(value);
    if (!Number.isFinite(seconds) || seconds <= 0) return "00:00";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function formatSourceReportDate(value: string | null | undefined) {
    if (!value) return "--";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatAbsoluteDate(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
}

function formatRelativeDate(value: string) {
    const date = new Date(value);
    const diff = Date.now() - date.getTime();
    if (Number.isNaN(date.getTime()) || diff < 0) return "刚刚";
    const hours = Math.floor(diff / 3_600_000);
    if (hours < 1) return "1 小时内";
    if (hours < 24) return `${hours} 小时前`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} 天前`;
    return formatAbsoluteDate(value);
}

function getDayBucket(value: string, language: UiLanguage) {
    const bucket = getTimelineFilter(value);
    if (bucket === "today") return language === "zh-CN" ? "今天" : "Today";
    if (bucket === "yesterday") {
        return language === "zh-CN" ? "昨天" : "Yesterday";
    }
    if (bucket === "last7") {
        return language === "zh-CN" ? "近 7 天" : "Last 7 days";
    }
    return language === "zh-CN" ? "更早" : "Earlier";
}

function getTimelineFilter(value: string): TimelineFilter {
    return getRecordingTimelineFilter(value);
}

function transcriptTurns(
    transcription: TranscriptionData | null | undefined,
): TranscriptTurn[] {
    const segmentTurns =
        transcription?.segments?.flatMap((segment) => {
            const text = segment.text?.trim();
            if (!text) {
                return [];
            }

            return [
                {
                    text,
                    speakerName:
                        segment.displaySpeaker?.trim() ||
                        segment.speakerLabel?.trim() ||
                        null,
                    startMs: segment.startMs,
                    endMs: segment.endMs,
                },
            ];
        }) ?? [];
    if (segmentTurns.length > 0) {
        return segmentTurns;
    }

    const trimmed = transcription?.text?.trim();
    if (!trimmed) return [];
    const paragraphs = trimmed
        .split(/\n{2,}/)
        .map((part) => part.trim())
        .filter(Boolean);
    const turns = paragraphs.length > 0 ? paragraphs : [trimmed];
    return turns.map((text) => ({ text }));
}

function transcriptSpeakers(
    transcription: TranscriptionData | null | undefined,
): TranscriptionPanelSpeaker[] {
    const segments =
        transcription?.segments?.filter((segment) => segment.text?.trim()) ??
        [];
    if (segments.length === 0) {
        return [];
    }

    const speakers = new Map<
        string,
        {
            rawLabel: string;
            speakerName: string;
            text: string[];
            segmentCount: number;
        }
    >();

    for (const segment of segments) {
        const rawLabel =
            segment.speakerLabel?.trim() ||
            segment.displaySpeaker?.trim() ||
            "";
        if (!rawLabel) {
            continue;
        }
        const speakerName =
            segment.displaySpeaker?.trim() ||
            segment.speakerLabel?.trim() ||
            rawLabel;
        const current = speakers.get(speakerName);
        if (current) {
            current.text.push(segment.text?.trim() ?? "");
            current.segmentCount += 1;
        } else {
            speakers.set(speakerName, {
                rawLabel,
                speakerName,
                text: [segment.text?.trim() ?? ""],
                segmentCount: 1,
            });
        }
    }

    const totalSegments = Math.max(
        1,
        Array.from(speakers.values()).reduce(
            (total, speaker) => total + speaker.segmentCount,
            0,
        ),
    );

    return Array.from(speakers.values(), (speaker) => ({
        id: speaker.rawLabel,
        rawLabel: speaker.rawLabel,
        speakerName: speaker.speakerName,
        text: speaker.text.join("\n"),
        share: Math.round((speaker.segmentCount / totalSegments) * 100),
    }));
}

function formatSourceTimestamp(valueMs: number | null | undefined) {
    if (valueMs == null || !Number.isFinite(valueMs)) {
        return null;
    }

    const totalSeconds = Math.max(0, Math.floor(valueMs / 1000));
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

function formatSourceReportTimestamp(valueMs: number | null | undefined) {
    const timestamp = formatSourceTimestamp(valueMs);
    if (!timestamp) return null;
    const parts = timestamp.split(":");
    if (parts.length === 2) {
        return `${parts[0].padStart(2, "0")}:${parts[1]}`;
    }
    return timestamp;
}

function buildSourceTranscriptCopyText(report: SourceReportData | null) {
    const transcript = report?.transcript;
    if (!transcript) {
        return "";
    }

    const segments = transcript.segments ?? [];
    if (segments.length === 0) {
        return transcript.text ?? "";
    }

    return segments
        .map((segment) => {
            const start = formatSourceTimestamp(segment.startMs);
            const end = formatSourceTimestamp(segment.endMs);
            const timeRange =
                start && end ? `${start} - ${end}` : (start ?? end);
            const heading = [timeRange, segment.speaker]
                .filter(Boolean)
                .join(" · ");
            const body = segment.text ?? "";
            return heading ? `${heading}\n${body}`.trim() : body;
        })
        .filter((segment) => segment.trim())
        .join("\n\n");
}

function getSourceReportSubState(
    transcriptAvailable: boolean,
    reportAvailable: boolean,
) {
    if (transcriptAvailable && reportAvailable) return "complete";
    if (!transcriptAvailable && !reportAvailable) return "both-missing";
    if (!transcriptAvailable) return "transcript-missing";
    return "summary-missing";
}

function sourceReportReadinessLabel(
    readiness: boolean | string | null | undefined,
    hasReadableContent: boolean,
) {
    if (typeof readiness === "string" && readiness.trim()) {
        return readiness.trim();
    }
    return readiness === true || hasReadableContent ? "已就绪" : "未生成";
}

function sourceReportReadinessTone(label: string): SourceReportTone {
    if (label === "已就绪") return "ok";
    if (label === "失败") return "err";
    if (label === "生成中" || label === "未生成") return "warn";
    return "neu";
}

function sourceReportSyncTone(label: string): SourceReportTone {
    if (label.includes("失败")) return "err";
    if (
        label.includes("待") ||
        label.includes("仅") ||
        label.includes("生成中")
    ) {
        return "warn";
    }
    if (label.includes("已") || label.includes("同步")) return "ok";
    return "neu";
}

function getSourceCopyState(
    sourceState: SourceReportViewState,
    available: boolean,
): SourceReportCopyState {
    if (sourceState === "error") return "error";
    if (sourceState === "loaded") {
        return available ? "ready" : "missing";
    }
    return "loading";
}

function getUserDisplayName(user: WorkstationProps["user"]) {
    return user?.name?.trim() || user?.email?.split("@")[0] || "BetterAINote";
}

function hasTranscript(
    recording: Recording,
    transcriptions: Map<string, TranscriptionData>,
) {
    const transcription = transcriptions.get(recording.id);
    return Boolean(
        transcription?.hasTranscript || hasTranscriptContent(transcription),
    );
}

function hasTranscriptContent(
    transcription: TranscriptionData | null | undefined,
) {
    return Boolean(
        transcription?.text?.trim() ||
            transcription?.segments?.some((segment) =>
                Boolean(segment.text?.trim()),
            ),
    );
}

type RecordingListStatus = {
    label: string;
    tone: PlayerStatusTone;
};

function getRecordingListStatus(
    recording: Recording,
    transcription: TranscriptionData | null | undefined,
    job: TranscriptionJobData | null | undefined,
    t: Translator,
): RecordingListStatus {
    if (job?.status === "failed") {
        return {
            label: t("recordingList.status.failed"),
            tone: "err" satisfies PlayerStatusTone,
        };
    }
    if (isActiveTranscriptionJob(job)) {
        return {
            label: t("recordingList.status.transcribing"),
            tone: "warn" satisfies PlayerStatusTone,
        };
    }
    if (hasTranscriptContent(transcription) || transcription?.hasTranscript) {
        return {
            label: t("recordingList.status.updated"),
            tone: "ok" satisfies PlayerStatusTone,
        };
    }
    if (recording.upstreamDeleted) {
        return {
            label: t("recordingList.status.localOnly"),
            tone: "info" satisfies PlayerStatusTone,
        };
    }
    return {
        label: t("recordingList.status.pending"),
        tone: "neu" satisfies PlayerStatusTone,
    };
}

function getRetxStateFromActiveJob(
    job: TranscriptionJobData | null | undefined,
): Extract<RetxState, "queued" | "running"> | null {
    const displayState = getTranscriptionJobDisplayState(job);
    if (!displayState) {
        return null;
    }

    return displayState === "queuedLocal" || displayState === "queuedRemote"
        ? "queued"
        : "running";
}

function getSourceRowState(status: SourceStatus, active: boolean) {
    if (status === "syncing" || status === "loading") {
        return "syncing";
    }
    if (status === "sync-error") {
        return "sync-error";
    }
    if (status === "expired") {
        return "expired";
    }
    if (status === "no-results") {
        return "no-results";
    }
    if (status === "planned" || status === "paused") {
        return "disabled";
    }
    if (status === "needs-setup") {
        return "needs-setup";
    }
    return active ? "connected-active" : "connected-idle";
}

function sourceRowDisabled(status: SourceStatus) {
    return status === "planned" || status === "paused";
}

function sourceActionKind(status: SourceStatus) {
    if (status === "sync-error") return "retry";
    if (status === "needs-setup") return "connect";
    if (status === "expired") return "reauth";
    return null;
}

type SourceRowState = ReturnType<typeof getSourceRowState>;

function sourceProviderStatusTone(sourceRowState: SourceRowState) {
    switch (sourceRowState) {
        case "connected-active":
        case "connected-idle":
            return "ok";
        case "syncing":
            return "syncing";
        case "sync-error":
            return "err";
        case "expired":
        case "no-results":
            return "warn";
        case "disabled":
            return "disabled";
        case "needs-setup":
            return "neu";
    }
}

function sourceProviderCountTone(sourceRowState: SourceRowState) {
    switch (sourceRowState) {
        case "connected-active":
            return "active";
        case "sync-error":
            return "err";
        case "no-results":
            return "empty";
        default:
            return "neutral";
    }
}

function getFavoriteLabel(value: DashboardFavoriteFilter, t: Translator) {
    switch (value) {
        case "all":
            return t("dashboardFavorites.allRecordings");
        case "transcribed":
            return t("dashboardFavorites.transcribed");
        case "tags":
            return t("dashboardFavorites.tags");
    }
}

function getSourceStatusLabel(status: SourceStatus, t: Translator) {
    switch (status) {
        case "loading":
            return t("sourceProviderRows.status.loading");
        case "connected":
            return t("sourceProviderRows.status.connected");
        case "connected-empty":
            return t("sourceProviderRows.status.connectedEmpty");
        case "syncing":
            return t("sourceProviderRows.status.syncing");
        case "sync-error":
            return t("sourceProviderRows.status.syncError");
        case "no-results":
            return t("sourceProviderRows.status.noResults");
        case "expired":
            return t("sourceProviderRows.status.expired");
        case "paused":
            return t("sourceProviderRows.status.paused");
        case "planned":
            return t("sourceProviderRows.status.planned");
        case "needs-setup":
            return t("sourceProviderRows.status.needsSetup");
    }
}

function sourceNeedsSettings(status: SourceStatus) {
    return status === "needs-setup" || status === "expired";
}

function syncStateLabel(state: SyncButtonState, t: Translator) {
    switch (state) {
        case "queued":
            return t("activityOverlay.actions.queued");
        case "running":
            return t("activityOverlay.actions.updatingShort");
        case "success":
            return t("activityOverlay.actions.done");
        case "error":
            return t("activityOverlay.actions.retry");
        case "idle":
            return t("activityOverlay.actions.update");
    }
}

function syncSystemBannerState(
    reason: SyncWorkerErrorReason | null | undefined,
    error: string | null | undefined,
) {
    if (reason === "database-locked") return "db-locked" as const;
    if (reason === "permission-denied") return "permission-denied" as const;
    if (reason === "runtime-unavailable") {
        return "runtime-unavailable" as const;
    }
    if (!error) return null;
    const normalized = error.toLowerCase();
    if (
        normalized.includes("sqlite_busy") ||
        normalized.includes("database is locked") ||
        normalized.includes("database locked") ||
        normalized.includes("db locked") ||
        normalized.includes("数据库") ||
        normalized.includes("占用")
    ) {
        return "db-locked" as const;
    }
    if (
        normalized.includes("eacces") ||
        normalized.includes("eperm") ||
        normalized.includes("permission denied") ||
        normalized.includes("permission") ||
        normalized.includes("denied") ||
        normalized.includes("权限") ||
        normalized.includes("未授权") ||
        normalized.includes("完全磁盘访问")
    ) {
        return "permission-denied" as const;
    }
    return null;
}

function activityItemKind(item: ActivityItem) {
    if (item.id === "worker-unavailable") return "worker-down";
    if (item.id === "source-sync-error") return "sync-error";
    if (item.id === "source-sync-queued") return "queued";
    if (item.id === "source-sync-running") return "queued";
    if (item.id === "source-sync-summary" && item.tone === "warn") {
        return "partial-failed";
    }
    if (item.id.startsWith("transcription-active-")) return "transcription";
    if (item.id.startsWith("transcription-failed-")) return "sync-error";
    if (item.action === "settings") return "setup";
    return item.tone;
}

function DashboardDetailEmptyIcon() {
    return <Music aria-hidden="true" focusable="false" />;
}

function DashboardDetailEmptyState() {
    return (
        <Empty
            className={DASHBOARD_DETAIL_EMPTY_STATE_CLASS_NAME}
            data-detail-empty=""
            data-panel="dashboard-detail-empty"
        >
            <EmptyHeader>
                <EmptyMedia
                    data-part="dashboard-detail-empty-icon"
                    variant="icon"
                    aria-hidden="true"
                >
                    <DashboardDetailEmptyIcon />
                </EmptyMedia>
                <EmptyTitle data-part="dashboard-detail-empty-title">
                    请选择一条录音
                </EmptyTitle>
                <EmptyDescription data-part="dashboard-detail-empty-description">
                    在左侧列表中挑一条录音，转写与说话人信息会显示在这里。
                </EmptyDescription>
            </EmptyHeader>
        </Empty>
    );
}

function SourceReportErrorGlyph() {
    return <CircleAlert aria-hidden="true" focusable="false" />;
}

function SourceReportEmptyGlyph() {
    return <FileText aria-hidden="true" focusable="false" />;
}

async function readResponseError(response: Response, fallback: string) {
    try {
        const data = (await response.json()) as { error?: unknown };
        return typeof data.error === "string" && data.error.trim()
            ? data.error
            : fallback;
    } catch {
        return fallback;
    }
}

export function Workstation({
    recordings,
    transcriptions,
    transcriptionJobs,
    pagination,
    user,
}: WorkstationProps) {
    const confirm = useConfirmDialog();
    const { language, t } = useLanguage();
    const router = useBrowserRouteController();
    const { hasLoaded: displaySettingsLoaded, settings: displaySettings } =
        useDisplaySettingsStore();
    const { hasLoaded: playbackSettingsLoaded, settings: playbackSettings } =
        usePlaybackSettingsStore();
    const itemsPerPage = Math.max(1, displaySettings.itemsPerPage || 50);
    const [hydrated, setHydrated] = useState(false);
    const [liveRecordings, setLiveRecordings] = useState(recordings);
    const [liveTranscriptions, setLiveTranscriptions] = useState(
        () => new Map(transcriptions),
    );
    const loadingTranscriptIdsRef = useRef<Set<string>>(new Set());
    const [loadingTranscriptIds, setLoadingTranscriptIds] = useState<
        Set<string>
    >(() => new Set());
    const [transcriptLoadErrors, setTranscriptLoadErrors] = useState<
        Map<string, string>
    >(() => new Map());
    const [liveJobs, setLiveJobs] = useState(transcriptionJobs);
    const [dashboardFilterState, setDashboardFilterState] = useState(
        DEFAULT_DASHBOARD_FILTER_STATE,
    );
    const { favorite, listMode, selectedTagFilter } = dashboardFilterState;
    const [source, setSource] = useState<DashboardSourceFilter>("all");
    const [selectedId, setSelectedId] = useState(recordings[0]?.id ?? "");
    const [detailOpen, setDetailOpen] = useState(false);
    const [detailMobileViewport, setDetailMobileViewport] = useState(false);
    const [collapsed, setCollapsed] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [timelineFilter, setTimelineFilter] = useState<TimelineFilter>("all");
    const [tagFilterOpen, setTagFilterOpen] = useState(false);
    const [listPage, setListPage] = useState(1);
    const [recordingPage, setRecordingPage] = useState({
        page: pagination?.page ?? 1,
        pageSize: itemsPerPage,
        total: pagination?.total ?? recordings.length,
    });
    const [recordingListLoading, setRecordingListLoading] = useState(false);
    const [recordingListError, setRecordingListError] = useState(false);
    const [recordingListRequestVersion, setRecordingListRequestVersion] =
        useState(0);
    const [recordingFacets, setRecordingFacets] =
        useState<RecordingListFacets | null>(null);
    const [detailTab, setDetailTab] = useState<DetailTab>("transcript");
    const [query, setQuery] = useState("");
    const [librarySearchFilter, setLibrarySearchFilter] =
        useState<LibrarySearchFilter | null>(null);
    const [volumeOpen, setVolumeOpen] = useState(false);
    const [editingTitle, setEditingTitle] = useState(false);
    const [draftTitle, setDraftTitle] = useState(recordings[0]?.filename ?? "");
    const [renaming, setRenaming] = useState(false);
    const [moreOpen, setMoreOpen] = useState(false);
    const [tagOpen, setTagOpen] = useState(false);
    const [availableTags, setAvailableTags] = useState<RecordingTag[]>([]);
    const [tagLoadError, setTagLoadError] = useState("");
    const [aiOpen, setAiOpen] = useState(false);
    const [aiState, setAiState] = useState<AiRenameState>("loading");
    const [aiPreviewTitle, setAiPreviewTitle] = useState("");
    const [aiError, setAiError] = useState("");
    const [aiApplying, setAiApplying] = useState(false);
    const [titleGenerationConfigured, setTitleGenerationConfigured] = useState<
        boolean | null
    >(null);
    const [retxState, setRetxState] = useState<RetxState>("idle");
    const [speakerMergeState, setSpeakerMergeState] =
        useState<DashboardSpeakerMergeState>({
            state: "idle",
            error: null,
        });
    const lastSpeakerMergeRequestRef =
        useRef<TranscriptionPanelSpeakerMergeRequest | null>(null);
    const [dismissedCompletedRetxIds, setDismissedCompletedRetxIds] = useState<
        Set<string>
    >(() => new Set());
    const [copyingAction, setCopyingAction] =
        useState<DashboardCopyAction>(null);
    const [copyFeedback, setCopyFeedback] =
        useState<DashboardCopyFeedback>(null);
    const [sourceReport, setSourceReport] = useState<SourceReportSnapshot>({
        recordingId: recordings[0]?.id ?? null,
        state: "idle",
        data: null,
        error: "",
    });
    const [sourceRepullState, setSourceRepullState] =
        useState<SourceRepullState>("idle");
    const [dataSources, setDataSources] = useState<DataSourceDisplayState[]>(
        [],
    );
    const [dataSourcesLoading, setDataSourcesLoading] = useState(true);
    const [dataSourcesError, setDataSourcesError] = useState("");
    const [activityOpen, setActivityOpen] = useState(false);
    const [dismissedActivityIds, setDismissedActivityIds] = useState<
        Set<string>
    >(() => new Set());
    const [activitySyncActionState, setActivitySyncActionState] = useState<
        "idle" | "busy" | "done" | "error"
    >("idle");
    const sourceDrawerRef = useRef<HTMLElement | null>(null);
    const drawerTriggerRef = useRef<HTMLButtonElement | null>(null);
    const activityTriggerRef = useRef<HTMLButtonElement | null>(null);
    const settingsTriggerRef = useRef<HTMLButtonElement | null>(null);
    const moreTriggerRef = useRef<HTMLButtonElement | null>(null);
    const activityOverlayRef = useRef<HTMLDivElement | null>(null);
    const tagFilterRef = useRef<HTMLDivElement | null>(null);
    const detailPanelRef = useRef<HTMLElement | null>(null);
    const detailCloseRef = useRef<HTMLButtonElement | null>(null);
    const detailBackRef = useRef<HTMLButtonElement | null>(null);
    const detailWasMobileRef = useRef(false);
    const recordingRowRefs = useRef(new Map<string, HTMLButtonElement>());
    const restoreActivityFocusRef = useRef(false);
    const activityFocusRestoreTimerRefs = useRef<number[]>([]);
    const copyFeedbackTimerRef = useRef<number | null>(null);
    const sourceReportRequestRef = useRef<{
        controller: AbortController;
        id: number;
        recordingId: string;
    } | null>(null);
    const sourceReportRequestIdRef = useRef(0);
    const previousRecordingQueryResetKeyRef = useRef<string | null>(null);
    const requestedRecordingIdRef = useRef<string | null>(null);
    const selectedRecordingIdRef = useRef<string | null>(
        recordings[0]?.id ?? null,
    );

    const loadDataSources = useCallback(async () => {
        setDataSourcesLoading(true);
        setDataSourcesError("");
        try {
            const data = await getDataSources();
            setDataSources(data.sources);
        } catch {
            setDataSources([]);
            setDataSourcesError("数据源状态加载失败");
        } finally {
            setDataSourcesLoading(false);
        }
    }, []);

    const clearActivityFocusRestoreTimers = useCallback(() => {
        for (const timer of activityFocusRestoreTimerRefs.current) {
            window.clearTimeout(timer);
        }
        activityFocusRestoreTimerRefs.current = [];
    }, []);

    const restoreActivityTriggerFocus = useCallback(() => {
        clearActivityFocusRestoreTimers();
        restoreActivityFocusRef.current = true;

        const focusTrigger = () => {
            if (!restoreActivityFocusRef.current) return;
            const activeElement = document.activeElement;
            const activeHTMLElement =
                activeElement instanceof HTMLElement ? activeElement : null;
            const shouldRestoreFocus =
                !activeHTMLElement ||
                activeElement === document.body ||
                activeElement === document.documentElement ||
                activeElement === activityTriggerRef.current ||
                activeElement === settingsTriggerRef.current;

            if (shouldRestoreFocus) {
                activityTriggerRef.current?.focus({ preventScroll: true });
            }
        };

        focusTrigger();
        const restoreDelays = [0, 50, 250, 750, 1250, 2000, 2100];
        activityFocusRestoreTimerRefs.current = restoreDelays.map(
            (delay, index) =>
                window.setTimeout(() => {
                    focusTrigger();
                    if (index === restoreDelays.length - 1) {
                        restoreActivityFocusRef.current = false;
                        activityFocusRestoreTimerRefs.current = [];
                    }
                }, delay),
        );
    }, [clearActivityFocusRestoreTimers]);

    const closeActivityOverlay = useCallback(
        (options: { restoreFocus?: boolean } = {}) => {
            if (options.restoreFocus) {
                restoreActivityTriggerFocus();
            } else {
                clearActivityFocusRestoreTimers();
                restoreActivityFocusRef.current = false;
            }
            setActivityOpen(false);
        },
        [clearActivityFocusRestoreTimers, restoreActivityTriggerFocus],
    );

    const selectSource = useCallback((nextSource: DashboardSourceFilter) => {
        setSource(nextSource);
        writeBrowserStorage(DASHBOARD_SOURCE_FILTER_STORAGE_KEY, nextSource);
    }, []);

    const updateDashboardFilterState = useCallback(
        (action: DashboardFilterAction) => {
            setDashboardFilterState((current) =>
                reduceDashboardFilterState(current, action),
            );
        },
        [],
    );

    const selectFavorite = useCallback(
        (nextFavorite: DashboardFavoriteFilter) => {
            updateDashboardFilterState({
                type: "favorite",
                value: nextFavorite,
            });
        },
        [updateDashboardFilterState],
    );

    const selectTagFilter = useCallback(
        (nextTagFilter: DashboardTagFilter) => {
            updateDashboardFilterState({
                type: "tag-filter",
                value: nextTagFilter,
            });
        },
        [updateDashboardFilterState],
    );

    useEffect(() => {
        const urlState = readRecordingListUrlState(window.location.search);
        requestedRecordingIdRef.current = urlState.recordingId;
        setListPage(urlState.page);
        setDetailOpen(urlState.detailOpen);
        if (urlState.recordingId) {
            setSelectedId(urlState.recordingId);
        }
        setHydrated(true);
        setCollapsed(
            readBrowserStorage(DASHBOARD_SIDEBAR_COLLAPSED_STORAGE_KEY) ===
                "true",
        );
        setSource(
            parseDashboardSourceFilter(
                readBrowserStorage(DASHBOARD_SOURCE_FILTER_STORAGE_KEY),
            ),
        );
        setDashboardFilterState(
            restoreDashboardFilterState({
                search: window.location.search,
                storedValue: readBrowserStorage(
                    DASHBOARD_FILTER_STATE_STORAGE_KEY,
                ),
            }),
        );
    }, []);

    useEffect(() => {
        if (!hydrated) return;

        const handlePopState = () => {
            const urlState = readRecordingListUrlState(window.location.search);
            requestedRecordingIdRef.current = urlState.recordingId;
            setListPage(urlState.page);
            setDetailOpen(urlState.detailOpen);
            setSelectedId((currentId) => urlState.recordingId ?? currentId);
        };

        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    }, [hydrated]);

    useEffect(() => {
        if (!hydrated || !hasBrowserWindow()) {
            return;
        }

        writeBrowserStorage(
            DASHBOARD_FILTER_STATE_STORAGE_KEY,
            serializeDashboardFilterState(dashboardFilterState),
        );
        const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        const nextUrl = dashboardFilterStateUrl(
            window.location.href,
            dashboardFilterState,
        );
        if (nextUrl !== currentUrl) {
            window.history.replaceState(null, "", nextUrl);
        }
    }, [dashboardFilterState, hydrated]);

    useEffect(
        () => () => {
            clearActivityFocusRestoreTimers();
        },
        [clearActivityFocusRestoreTimers],
    );

    const {
        autoSyncEnabled,
        isAutoSyncing,
        lastSyncTime,
        nextSyncTime,
        lastSyncResult,
        manualSync,
        workerStatus,
        refreshStatus,
    } = useAutoSync({
        onSuccess: ({ queued, newRecordings }) => {
            if (queued) {
                toast.success("同步请求已排队");
                return;
            }
            toast.success(
                newRecordings && newRecordings > 0
                    ? `同步完成，新增 ${newRecordings} 条录音`
                    : "同步完成，没有新录音",
            );
        },
        onError: (error) => {
            toast.error(error || "同步失败");
        },
    });
    const syncSystemBannerKind = syncSystemBannerState(
        workerStatus?.lastErrorReason ?? lastSyncResult?.reason,
        workerStatus?.lastError ?? lastSyncResult?.error,
    );

    useEffect(() => {
        if (!hasBrowserWindow()) {
            return;
        }

        window.dispatchEvent(
            new CustomEvent("betterainote:system-banner", {
                detail: {
                    id: "source-sync-system",
                    state: syncSystemBannerKind,
                },
            }),
        );
    }, [syncSystemBannerKind]);

    useEffect(() => {
        void loadDataSources();
    }, [loadDataSources]);

    useEffect(() => {
        setLiveRecordings(recordings);
        const requestedId = requestedRecordingIdRef.current;
        const recordingIds = recordings.map((recording) => recording.id);
        setSelectedId(
            (currentId) =>
                reconcileRecordingSelection({
                    currentId,
                    recordingIds,
                    requestedId,
                }) ?? "",
        );
    }, [recordings]);

    useEffect(() => {
        setLiveTranscriptions((current) =>
            reconcileTranscriptionMaps(current, transcriptions),
        );
    }, [transcriptions]);

    useEffect(() => {
        setLiveJobs(transcriptionJobs);
    }, [transcriptionJobs]);

    const recordingQueryResetKey = useMemo(
        () =>
            [
                favorite,
                source,
                query.trim(),
                librarySearchFilter?.type ?? "",
                librarySearchFilter?.label ?? "",
                listMode,
                selectedTagFilter,
                timelineFilter,
                itemsPerPage,
                displaySettings.recordingListSortOrder,
            ].join("\u0001"),
        [
            favorite,
            itemsPerPage,
            librarySearchFilter,
            listMode,
            query,
            selectedTagFilter,
            source,
            timelineFilter,
            displaySettings.recordingListSortOrder,
        ],
    );

    useEffect(() => {
        if (!hydrated || !displaySettingsLoaded) return;
        if (previousRecordingQueryResetKeyRef.current === null) {
            previousRecordingQueryResetKeyRef.current = recordingQueryResetKey;
            return;
        }
        if (
            previousRecordingQueryResetKeyRef.current === recordingQueryResetKey
        ) {
            return;
        }
        previousRecordingQueryResetKeyRef.current = recordingQueryResetKey;
        setListPage(1);
    }, [displaySettingsLoaded, hydrated, recordingQueryResetKey]);

    useEffect(() => {
        if (!hydrated || !displaySettingsLoaded) return;

        const controller = new AbortController();
        const params = buildRecordingListQueryParams({
            favorite,
            libraryFilter: librarySearchFilter,
            listMode,
            page: listPage,
            pageSize: itemsPerPage,
            query,
            selectedTagFilter,
            sort: displaySettings.recordingListSortOrder,
            source,
            timeline: timelineFilter,
        });

        setRecordingListLoading(true);
        setRecordingListError(false);
        void (async () => {
            try {
                const response = await fetch(
                    `/api/recordings/query?${params.toString()}`,
                    {
                        signal: controller.signal,
                        cache:
                            recordingListRequestVersion > 0
                                ? "no-store"
                                : "default",
                    },
                );
                if (!response.ok) {
                    throw new Error("Failed to load recordings");
                }
                const payload =
                    (await response.json()) as RecordingQueryResponse;
                if (controller.signal.aborted) return;
                const {
                    transcriptions: nextTranscriptions,
                    transcriptionJobs: nextJobs,
                } = buildPagedRecordingMaps(payload.recordings);
                setLiveRecordings(payload.recordings);
                setLiveTranscriptions((current) =>
                    reconcileTranscriptionMaps(current, nextTranscriptions),
                );
                setLiveJobs(nextJobs);
                setRecordingPage(payload.pagination);
                setRecordingFacets(adaptRecordingListFacets(payload.facets));
                setListPage(payload.pagination.page);
                const requestedId = requestedRecordingIdRef.current;
                const recordingIds = payload.recordings.map(
                    (recording) => recording.id,
                );
                if (requestedId && recordingIds.includes(requestedId)) {
                    requestedRecordingIdRef.current = null;
                }
                setSelectedId(
                    (currentId) =>
                        reconcileRecordingSelection({
                            currentId,
                            recordingIds,
                            requestedId,
                        }) ?? "",
                );
            } catch {
                if (controller.signal.aborted) return;
                setRecordingListError(true);
            } finally {
                if (!controller.signal.aborted) {
                    setRecordingListLoading(false);
                }
            }
        })();

        return () => controller.abort();
    }, [
        displaySettingsLoaded,
        favorite,
        hydrated,
        itemsPerPage,
        librarySearchFilter,
        listMode,
        listPage,
        query,
        selectedTagFilter,
        source,
        timelineFilter,
        recordingListRequestVersion,
        displaySettings.recordingListSortOrder,
    ]);

    const sourceCounts = useMemo(() => {
        const counts = new Map<string, number>();
        for (const recording of liveRecordings) {
            counts.set(
                recording.sourceProvider,
                (counts.get(recording.sourceProvider) ?? 0) + 1,
            );
        }
        return counts;
    }, [liveRecordings]);

    const filteredRecordings = useMemo(() => {
        const normalizedQuery = query.trim().toLocaleLowerCase();
        const filtered = liveRecordings.filter((recording) => {
            if (source !== "all" && recording.sourceProvider !== source) {
                return false;
            }
            return (
                !normalizedQuery ||
                [
                    recording.filename,
                    recording.sourceProvider,
                    ...recording.tags.map((tag) => tag.name),
                    liveTranscriptions.get(recording.id)?.text ?? "",
                ]
                    .join(" ")
                    .toLocaleLowerCase()
                    .includes(normalizedQuery)
            );
        });
        return filtered;
    }, [liveRecordings, liveTranscriptions, query, source]);
    const timelineCounts = useMemo(() => {
        const counts: Record<TimelineFilter, number> = {
            all: filteredRecordings.length,
            today: 0,
            yesterday: 0,
            last7: 0,
            earlier: 0,
        };
        for (const recording of filteredRecordings) {
            const bucket = getTimelineFilter(recording.startTime);
            counts[bucket] += 1;
        }
        return recordingFacets?.timeline ?? counts;
    }, [filteredRecordings, recordingFacets]);
    const tagFilterOptions = useMemo(() => {
        const tags = new Map<
            string,
            { id: string; name: string; count: number }
        >();
        let untagged = 0;
        for (const recording of filteredRecordings) {
            if (recording.tags.length === 0) {
                untagged += 1;
                continue;
            }
            for (const tag of recording.tags) {
                const existing = tags.get(tag.id);
                if (existing) {
                    existing.count += 1;
                } else {
                    tags.set(tag.id, {
                        id: tag.id,
                        name: tag.name,
                        count: 1,
                    });
                }
            }
        }
        if (recordingFacets) {
            const options: RecordingListTagOption[] = [
                {
                    value: "all",
                    label: t("recordingList.timeline.all"),
                    count: recordingFacets.tags.all,
                },
                ...recordingFacets.tags.items.map((tag) => ({
                    value: tagFilterValue(tag.id),
                    label: tag.name,
                    count: tag.count,
                })),
            ];
            if (recordingFacets.tags.untagged > 0) {
                options.push({
                    value: "untagged",
                    label: t("recordingList.untagged"),
                    count: recordingFacets.tags.untagged,
                });
            }
            return options;
        }
        const options: RecordingListTagOption[] = [
            {
                value: "all",
                label: t("recordingList.timeline.all"),
                count: filteredRecordings.length,
            },
        ];
        Array.from(tags.values())
            .sort((a, b) =>
                a.name.localeCompare(
                    b.name,
                    language === "zh-CN" ? "zh-CN" : "en",
                ),
            )
            .forEach((tag) => {
                options.push({
                    value: tagFilterValue(tag.id),
                    label: tag.name,
                    count: tag.count,
                });
            });
        if (untagged > 0) {
            options.push({
                value: "untagged",
                label: t("recordingList.untagged"),
                count: untagged,
            });
        }
        return options;
    }, [filteredRecordings, language, recordingFacets, t]);
    const listEntries = useMemo(() => {
        const entries: {
            groupId: string;
            groupLabel: string;
            recording: Recording;
            displayTag?: RecordingTag;
        }[] = [];

        if (listMode === "tags") {
            for (const recording of filteredRecordings) {
                if (selectedTagFilter === "untagged") {
                    if (recording.tags.length === 0) {
                        entries.push({
                            groupId: "untagged",
                            groupLabel: t("recordingList.untagged"),
                            recording,
                        });
                    }
                    continue;
                }

                const selectedTagId = tagIdFromFilter(selectedTagFilter);
                const matchingTags = selectedTagId
                    ? recording.tags.filter((tag) => tag.id === selectedTagId)
                    : recording.tags;

                if (matchingTags.length === 0) {
                    if (selectedTagFilter === "all") {
                        entries.push({
                            groupId: "untagged",
                            groupLabel: t("recordingList.untagged"),
                            recording,
                        });
                    }
                    continue;
                }

                for (const tag of matchingTags) {
                    entries.push({
                        displayTag: tag,
                        groupId: tag.id,
                        groupLabel: tag.name,
                        recording,
                    });
                }
            }
            return entries;
        }

        for (const recording of filteredRecordings) {
            const bucket = getTimelineFilter(recording.startTime);
            entries.push({
                groupId: bucket,
                groupLabel: getDayBucket(recording.startTime, language),
                recording,
            });
        }
        return entries;
    }, [filteredRecordings, language, listMode, selectedTagFilter, t]);
    const listHasExternalFilter =
        source !== "all" ||
        query.trim().length > 0 ||
        librarySearchFilter !== null ||
        favorite === "transcribed";
    const listHasSelectedTagFilter =
        listMode === "tags" && selectedTagFilter !== "all";
    const listHasTimelineFilter =
        listMode === "timeline" && timelineFilter !== "all";
    const listHasTagFavorite = favorite === "tags";
    const listState: RecordingListState =
        !displaySettingsLoaded || recordingListLoading
            ? "loading"
            : recordingListError
              ? "error"
              : listEntries.length > 0
                ? "ready"
                : listHasExternalFilter
                  ? "no-match"
                  : listHasSelectedTagFilter
                    ? "tag-empty"
                    : listHasTimelineFilter
                      ? "timeline-empty"
                      : listHasTagFavorite
                        ? "tag-empty"
                        : liveRecordings.length === 0
                          ? "empty"
                          : "no-match";
    const listTotalPages = Math.max(
        1,
        Math.ceil(recordingPage.total / recordingPage.pageSize),
    );
    const currentListPage = listPage;
    const pagedListEntries = listState === "ready" ? listEntries : [];
    const listLoadedCount = Math.min(
        recordingPage.total,
        Math.max(0, (currentListPage - 1) * recordingPage.pageSize) +
            liveRecordings.length,
    );
    const groupedListEntries = useMemo(() => {
        const groups: {
            id: string;
            label: string;
            entries: typeof pagedListEntries;
        }[] = [];
        for (const entry of pagedListEntries) {
            const existing = groups.find((group) => group.id === entry.groupId);
            if (existing) {
                existing.entries.push(entry);
            } else {
                groups.push({
                    entries: [entry],
                    id: entry.groupId,
                    label: entry.groupLabel,
                });
            }
        }
        return groups;
    }, [pagedListEntries]);
    const recordingListGroups = useMemo<RecordingListGroup[]>(
        () =>
            groupedListEntries.map((group) => ({
                id: group.id,
                label: group.label,
                entries: group.entries.map((entry) => {
                    const sourceMeta = sourceDefinition(
                        entry.recording.sourceProvider,
                    );
                    return {
                        durationLabel: formatDuration(entry.recording.duration),
                        filename: entry.recording.filename,
                        id: entry.recording.id,
                        source: {
                            cover: sourceMeta?.cover ?? false,
                            icon: sourceMeta?.icon ?? null,
                            label: providerLabel(
                                entry.recording.sourceProvider,
                                language,
                            ),
                            letter:
                                providerLabel(
                                    entry.recording.sourceProvider,
                                    language,
                                )[0] ?? "·",
                        },
                        startTime: entry.recording.startTime,
                        status: getRecordingListStatus(
                            entry.recording,
                            liveTranscriptions.get(entry.recording.id),
                            liveJobs.get(entry.recording.id),
                            t,
                        ),
                        tag: entry.displayTag ?? entry.recording.tags[0],
                    };
                }),
            })),
        [groupedListEntries, language, liveJobs, liveTranscriptions, t],
    );

    const listEligibleRecordings = useMemo(() => {
        const seen = new Set<string>();
        const recordings: Recording[] = [];
        for (const entry of listEntries) {
            if (seen.has(entry.recording.id)) continue;
            seen.add(entry.recording.id);
            recordings.push(entry.recording);
        }
        return recordings;
    }, [listEntries]);

    useEffect(() => {
        if (
            tagFilterOptions.some(
                (option) => option.value === selectedTagFilter,
            )
        ) {
            return;
        }
        updateDashboardFilterState({
            available: tagFilterOptions.map((option) => option.value),
            type: "reconcile-tags",
        });
    }, [selectedTagFilter, tagFilterOptions, updateDashboardFilterState]);
    const dataSourceByProvider = useMemo(
        () =>
            new Map(
                dataSources.map((dataSource) => [
                    dataSource.provider,
                    dataSource,
                ]),
            ),
        [dataSources],
    );
    const hasSyncError = Boolean(
        lastSyncResult?.success === false ||
            workerStatus?.lastError ||
            (workerStatus?.lastSummary?.errorCount ?? 0) > 0,
    );
    const hasSourceNarrowingFilter =
        favorite !== "all" ||
        query.trim().length > 0 ||
        librarySearchFilter !== null ||
        (listMode === "tags" && selectedTagFilter !== "all") ||
        (listMode === "timeline" && timelineFilter !== "all");
    const sourceRows = useMemo(
        () =>
            SOURCE_ORDER.map((item) => {
                const dataSource = dataSourceByProvider.get(item.key);
                const count = sourceCounts.get(item.key) ?? 0;
                const active = source === item.key;
                const connected = Boolean(dataSource?.connected);
                const enabled = dataSource?.enabled ?? false;
                const hasSavedCredentials = Boolean(
                    dataSource &&
                        Object.values(dataSource.secretsConfigured).some(
                            Boolean,
                        ),
                );
                const planned = dataSource?.runtimeStatus === "planned";
                const status: SourceStatus =
                    dataSourcesLoading && !dataSource
                        ? "loading"
                        : planned
                          ? "planned"
                          : !enabled && hasSavedCredentials
                            ? "paused"
                            : !connected
                              ? "needs-setup"
                              : dataSource?.connectionStatus === "expired"
                                ? "expired"
                                : isAutoSyncing
                                  ? "syncing"
                                  : hasSyncError
                                    ? "sync-error"
                                    : resolveConnectedSourceStatus({
                                          active,
                                          currentResultCount:
                                              filteredRecordings.length,
                                          hasNarrowingFilter:
                                              hasSourceNarrowingFilter,
                                          providerCount: count,
                                          settled:
                                              !recordingListLoading &&
                                              !recordingListError,
                                      });

                return {
                    ...item,
                    active,
                    connected,
                    count,
                    label: providerLabel(item.key, language),
                    status,
                    statusLabel: getSourceStatusLabel(status, t),
                };
            }),
        [
            dataSourceByProvider,
            dataSourcesLoading,
            filteredRecordings.length,
            hasSyncError,
            hasSourceNarrowingFilter,
            isAutoSyncing,
            language,
            recordingListError,
            recordingListLoading,
            source,
            sourceCounts,
            t,
        ],
    );
    const selectedSourceRow = useMemo(
        () => sourceRows.find((row) => row.key === source) ?? null,
        [source, sourceRows],
    );
    const sourceFilterStackState =
        source === "all"
            ? "idle"
            : selectedSourceRow?.status === "sync-error"
              ? "sync-error"
              : selectedSourceRow?.status === "no-results"
                ? "no-results"
                : sourceNeedsSettings(selectedSourceRow?.status ?? "connected")
                  ? (selectedSourceRow?.status ?? "needs-setup")
                  : "active";
    const sourceFilterStackMessage = selectedSourceRow
        ? selectedSourceRow.status === "sync-error"
            ? t("sourceFilterStack.syncErrorMessage", {
                  provider: selectedSourceRow.label,
              })
            : selectedSourceRow.status === "no-results"
              ? t("sourceFilterStack.noResultsMessage", {
                    count: selectedSourceRow.count,
                    provider: selectedSourceRow.label,
                })
              : selectedSourceRow.status === "paused"
                ? t("sourceFilterStack.pausedMessage", {
                      provider: selectedSourceRow.label,
                  })
                : selectedSourceRow.status === "expired"
                  ? t("sourceFilterStack.expiredMessage", {
                        provider: selectedSourceRow.label,
                    })
                  : selectedSourceRow.status === "planned"
                    ? t("sourceFilterStack.plannedMessage", {
                          provider: selectedSourceRow.label,
                      })
                    : selectedSourceRow.status === "needs-setup"
                      ? t("sourceFilterStack.needsSetupMessage", {
                            provider: selectedSourceRow.label,
                        })
                      : ""
        : "";
    const syncButtonState: SyncButtonState = isAutoSyncing
        ? workerStatus?.manualTriggerRequestedAt && !workerStatus.isRunning
            ? "queued"
            : "running"
        : hasSyncError
          ? "error"
          : lastSyncResult?.success
            ? "success"
            : "idle";
    const syncButtonBusy =
        syncButtonState === "queued" || syncButtonState === "running";
    const partialSyncErrorCount = workerStatus?.lastSummary?.errorCount ?? 0;
    const syncStatusLabel =
        syncButtonState === "error" && partialSyncErrorCount > 0
            ? t("activityOverlay.status.partialUpdateFailedTitle")
            : syncStateLabel(syncButtonState, t);
    const syncSummary =
        syncButtonState === "error"
            ? partialSyncErrorCount > 0
                ? t("activityOverlay.status.partialUpdateFailed", {
                      count: partialSyncErrorCount,
                  })
                : workerStatus?.lastError ||
                  lastSyncResult?.error ||
                  t("activityOverlay.status.updateRequestFailed")
            : syncButtonState === "success"
              ? t("activityOverlay.items.sourceUpdateCompleteTitle")
              : lastSyncTime
                ? t("activityOverlay.status.lastUpdatedAt", {
                      time: formatRelativeDate(lastSyncTime.toISOString()),
                  })
                : autoSyncEnabled
                  ? nextSyncTime
                      ? t("activityOverlay.status.nextUpdateAt", {
                            time: formatRelativeDate(
                                nextSyncTime.toISOString(),
                            ),
                        })
                      : t("activityOverlay.status.waitingForAutoUpdate")
                  : t("activityOverlay.status.autoUpdatePaused");

    const requestedRecordingId = detailOpen
        ? requestedRecordingIdRef.current
        : null;
    const requestedRecordingMissing = Boolean(
        requestedRecordingId &&
            (!displaySettingsLoaded ||
                recordingListLoading ||
                recordingListError ||
                !listEligibleRecordings.some(
                    (recording) => recording.id === requestedRecordingId,
                )),
    );
    const selectedRecording = requestedRecordingMissing
        ? null
        : (listEligibleRecordings.find(
              (recording) => recording.id === selectedId,
          ) ??
          listEligibleRecordings[0] ??
          null);
    const selectedRecordingId = selectedRecording?.id ?? null;
    useEffect(() => {
        if (!hydrated || !hasBrowserWindow()) return;
        const nextUrl = recordingListUrl({
            currentUrl: window.location.href,
            detailOpen,
            page: currentListPage,
            recordingId: detailOpen
                ? (requestedRecordingId ?? selectedRecordingId)
                : null,
        });
        if (!isRecordingListUrlCurrent(window.location.href, nextUrl)) {
            window.history.replaceState(null, "", nextUrl);
        }
    }, [
        currentListPage,
        detailOpen,
        hydrated,
        requestedRecordingId,
        selectedRecordingId,
    ]);
    const selectedTranscription = selectedRecording
        ? liveTranscriptions.get(selectedRecording.id)
        : undefined;
    const selectedJob = selectedRecording
        ? liveJobs.get(selectedRecording.id)
        : undefined;
    const selectedRecordingHasAudio = Boolean(selectedRecording?.audioUrl);
    const selectedRecordingHasSource = Boolean(
        selectedRecording?.sourceProvider,
    );
    const {
        audioRef,
        audioSrc,
        currentTime,
        cyclePlaybackSpeed,
        duration: playbackDuration,
        isPlaying,
        playbackSpeedLabel,
        progress,
        seekToSliderValue,
        setVolume,
        togglePlayPause,
        volume,
    } = useRecordingPlayback({
        audioUrl: selectedRecording?.audioUrl,
        onEnded: handleAudioEnded,
    });
    const playbackDisabled =
        !selectedRecording || !selectedRecording.hasAudio || !audioSrc;
    const volumePopoverOpen = volumeOpen && !playbackDisabled;
    const playerDurationValue =
        playbackDuration > 0
            ? playbackDuration
            : (selectedRecording?.duration ?? 0);
    const selectedPlayerTag = selectedRecording?.tags[0] ?? null;
    const selectedPlayerStatus = selectedRecording
        ? getRecordingListStatus(
              selectedRecording,
              selectedTranscription,
              selectedJob,
              t,
          )
        : null;

    useEffect(() => {
        if (playbackDisabled) {
            setVolumeOpen(false);
        }
    }, [playbackDisabled]);

    const completedRetxDismissed = selectedRecording
        ? dismissedCompletedRetxIds.has(selectedRecording.id)
        : false;
    const dashboardRetxState: RetxState =
        retxState !== "idle"
            ? retxState
            : !selectedRecording || !selectedRecordingHasAudio
              ? "unavailable"
              : selectedJob
                ? isActiveTranscriptionJob(selectedJob)
                    ? (getRetxStateFromActiveJob(selectedJob) ?? "running")
                    : selectedJob.status === "failed"
                      ? "failed"
                      : selectedJob.status === "succeeded"
                        ? completedRetxDismissed
                            ? "idle"
                            : "completed"
                        : "idle"
                : "idle";
    const dashboardRetxTitle =
        dashboardRetxState === "completed"
            ? "重新转写完成"
            : dashboardRetxState === "failed"
              ? "本次重新转写失败"
              : dashboardRetxState === "running"
                ? "正在重新转写"
                : dashboardRetxState === "queued"
                  ? "转写任务已加入队列"
                  : "重新转写";
    const dashboardRetxSub =
        dashboardRetxState === "completed"
            ? "逐字稿、说话人映射与摘要已刷新。"
            : dashboardRetxState === "failed"
              ? "VoScript worker 暂时不可达 · 原稿未被覆盖。"
              : dashboardRetxState === "running"
                ? "已完成 12% · 当前结果仍可阅读，完成后自动刷新。"
                : dashboardRetxState === "queued"
                  ? "正在等待工作器领取，期间可继续浏览。"
                  : "新任务会保持当前转写可见，完成后替换结果。";
    const turns = useMemo(
        () => transcriptTurns(selectedTranscription),
        [selectedTranscription],
    );
    const speakers = useMemo(
        () => transcriptSpeakers(selectedTranscription),
        [selectedTranscription],
    );
    const localTranscriptText =
        selectedTranscription?.text?.trim() ||
        turns.map((turn) => turn.text).join("\n\n");
    const isTranscriptLoading = selectedRecordingId
        ? loadingTranscriptIds.has(selectedRecordingId)
        : false;
    const transcriptLoadError = selectedRecordingId
        ? (transcriptLoadErrors.get(selectedRecordingId) ?? null)
        : null;
    const transcriptionPollingKey = getDashboardTranscriptionPollingKey(
        selectedRecordingId,
        selectedJob,
    );
    const sourceReportState =
        sourceReport.recordingId === selectedRecordingId
            ? sourceReport.state
            : "idle";
    const sourceReportVisualState =
        sourceReportState === "idle" ? "empty" : sourceReportState;
    const sourceReportData =
        sourceReport.recordingId === selectedRecordingId
            ? sourceReport.data
            : null;
    const sourceTranscriptCopyText =
        buildSourceTranscriptCopyText(sourceReportData);
    const sourceTranscriptAvailable = Boolean(sourceTranscriptCopyText.trim());
    const sourceSummaryText = sourceReportData?.summaryMarkdown?.trim() ?? "";
    const sourceSummaryLines = sourceReportSummaryLines(sourceSummaryText);
    const sourceSummaryAvailable =
        Boolean(sourceSummaryText) || sourceReportData?.summaryReady === true;
    const sourceTranscriptStatusLabel = sourceReportReadinessLabel(
        sourceReportData?.transcriptReady,
        sourceTranscriptAvailable,
    );
    const sourceSummaryStatusLabel = sourceReportReadinessLabel(
        sourceReportData?.summaryReady,
        sourceSummaryAvailable,
    );
    const sourceReportSubState = getSourceReportSubState(
        sourceTranscriptAvailable,
        sourceSummaryAvailable,
    );
    const sourceTranscriptCopyState = getSourceCopyState(
        sourceReportState,
        sourceTranscriptAvailable,
    );
    const localTranscriptCopyState: SourceReportCopyState = isTranscriptLoading
        ? "loading"
        : transcriptLoadError && !localTranscriptText.trim()
          ? "error"
          : localTranscriptText.trim()
            ? "ready"
            : "missing";
    const sourceTranscriptCopyDisabled =
        copyingAction === "source-transcript" ||
        sourceTranscriptCopyState !== "ready";
    const showCopyFeedback = useCallback(
        (action: Exclude<DashboardCopyAction, null>, state: "ok" | "err") => {
            if (copyFeedbackTimerRef.current) {
                window.clearTimeout(copyFeedbackTimerRef.current);
            }
            setCopyFeedback({ action, state });
            copyFeedbackTimerRef.current = window.setTimeout(() => {
                setCopyFeedback((current) =>
                    current?.action === action ? null : current,
                );
                copyFeedbackTimerRef.current = null;
            }, 1500);
        },
        [],
    );
    const sourceOpenAction = sourceReportData?.sourceActions?.openSource;
    const sourceOpenUrl =
        sourceOpenAction?.available && sourceOpenAction.url
            ? sourceOpenAction.url
            : null;
    const sourceOpenControlState = sourceReportData
        ? sourceOpenUrl
            ? "ready"
            : "unavailable"
        : sourceReportState === "loading"
          ? "loading"
          : "unavailable";
    const sourceRepullAction = sourceReportData?.sourceActions?.repullSource;
    const sourceRepullAvailable = Boolean(sourceRepullAction?.available);
    const sourceRepullControlState =
        sourceRepullState === "loading"
            ? "loading"
            : sourceRepullState === "error"
              ? "error"
              : sourceRepullAvailable
                ? "ready"
                : sourceReportData
                  ? "unavailable"
                  : sourceReportState === "loading"
                    ? "loading"
                    : "unavailable";
    const sourceRepullDisabled =
        sourceRepullState === "loading" ||
        syncButtonBusy ||
        !sourceRepullAvailable;
    const sourceReportProvider =
        sourceReportData?.sourceProvider ?? selectedRecording?.sourceProvider;
    const sourceReportProviderDefinition =
        sourceDefinition(sourceReportProvider);
    const sourceReportMetadata = sourceReportData?.detail ?? null;
    const sourceReportProviderName =
        sourceReportDetailText(sourceReportMetadata, [
            "providerName",
            "sourceName",
            "sourceProviderName",
        ]) ??
        (sourceReportProvider
            ? providerLabel(sourceReportProvider, language)
            : "--");
    const sourceReportProviderSentenceName =
        sourceReportDetailText(sourceReportMetadata, [
            "providerSentenceName",
            "sourceSentenceName",
        ]) ?? sourceReportProviderName.replace(/\s+/g, "");
    const sourceReportTitle =
        sourceReportDetailText(sourceReportMetadata, [
            "sourceTitle",
            "title",
        ]) ??
        sourceReportData?.filename ??
        selectedRecording?.filename ??
        "--";
    const sourceReportRecordedAt =
        sourceReportDetailText(sourceReportMetadata, [
            "recordedAt",
            "startTime",
            "createdAt",
        ]) ?? selectedRecording?.startTime;
    const sourceReportUpdatedAt =
        sourceReportDetailText(sourceReportMetadata, [
            "updatedAt",
            "syncedAt",
            "modifiedAt",
        ]) ?? sourceReportRecordedAt;
    const sourceReportLanguage =
        sourceReportDetailText(sourceReportMetadata, [
            "language",
            "locale",
            "lang",
        ]) ?? "简体中文 (zh-CN)";
    const sourceReportReadable =
        sourceReportDetailText(sourceReportMetadata, [
            "readableContent",
            "assets",
            "availableContent",
        ]) ?? "音频 · 转写 · 摘要 · 说话人";
    const sourceReportSyncStatusLabel =
        sourceReportDetailText(sourceReportMetadata, [
            "statusLabel",
            "syncStatusLabel",
            "sourceStatusLabel",
        ]) ?? "已同步";
    const sourceReportRawSegments =
        sourceReportData?.transcript?.segments ?? [];
    const sourceReportTranscriptText =
        sourceReportData?.transcript?.text?.trim() ?? "";
    const sourceReportDisplaySegments: SourceReportSegmentData[] =
        sourceReportRawSegments.length > 0
            ? sourceReportRawSegments
            : sourceReportTranscriptText
              ? [
                    {
                        speaker: sourceReportProviderName,
                        startMs: null,
                        endMs: null,
                        text: sourceReportTranscriptText,
                    },
                ]
              : [];
    const sourceReportSegmentCount =
        sourceReportData?.transcript?.segmentCount ??
        sourceReportDisplaySegments.length;
    const sourceReportCopyText = sourceReportData
        ? [
              `来源：${sourceReportProviderName}`,
              `转写状态：${sourceTranscriptStatusLabel}`,
              `摘要状态：${sourceSummaryStatusLabel}`,
              `分段数：${sourceReportSegmentCount}`,
              "",
              "来源信息",
              `来源：${sourceReportProviderName}`,
              `状态：${sourceReportSyncStatusLabel}`,
              `录制于：${formatSourceReportDate(sourceReportRecordedAt)}`,
              `最近更新：${formatSourceReportDate(sourceReportUpdatedAt)}`,
              `可读内容：${sourceReportReadable}`,
              `来源标题：${sourceReportTitle}`,
              `语种：${sourceReportLanguage}`,
              `时长：${selectedRecording ? formatDuration(selectedRecording.duration) : "--"}`,
              sourceSummaryText ? "" : null,
              sourceSummaryText || null,
          ]
              .filter((line): line is string => line !== null)
              .join("\n")
              .trim()
        : "";
    const sourceReportCopyState = getSourceCopyState(
        sourceReportState,
        Boolean(sourceReportCopyText.trim()),
    );
    const sourceReportCopyDisabled =
        copyingAction === "source-report" || sourceReportCopyState !== "ready";
    const localDeleteAvailable = Boolean(
        selectedRecording &&
            (!selectedRecording.sourceProvider ||
                selectedRecording.upstreamDeleted),
    );
    const moreActionsState = !selectedRecording
        ? "empty"
        : !selectedRecording.sourceProvider
          ? "local-only"
          : selectedRecording.upstreamDeleted
            ? "upstream-deleted"
            : "upstream";
    const moreActionsShowRetranscribe =
        moreActionsState === "local-only" || moreActionsState === "upstream";
    const moreActionsShowSeparator =
        moreActionsState === "local-only" ||
        moreActionsState === "upstream-deleted";
    const moreActionsShowPrimaryIcons = moreActionsState === "local-only";
    const moreActionsShowDeleteIcon =
        moreActionsState === "local-only" ||
        moreActionsState === "upstream-deleted";
    const hasSelectedTranscript = Boolean(selectedTranscription?.hasTranscript);
    const aiUnavailableIsService = Boolean(
        selectedRecording &&
            titleGenerationConfigured === false &&
            hasSelectedTranscript,
    );
    const aiUnavailableReason = selectedRecording
        ? titleGenerationConfigured === true && !hasSelectedTranscript
            ? "需要先生成本地转录"
            : aiUnavailableIsService
              ? "AI 重命名服务尚未配置或暂时不可用。"
              : ""
        : "请选择录音";
    const aiUnavailableHint = aiUnavailableIsService
        ? "前往设置 → AI 重命名服务以启用。"
        : null;
    const applyDashboardRecordingTags = useCallback(
        (recordingId: string, tags: RecordingTag[]) => {
            setLiveRecordings((items) =>
                items.map((item) =>
                    item.id === recordingId ? { ...item, tags } : item,
                ),
            );
        },
        [],
    );
    const recordingNameById = useMemo(
        () =>
            new Map(
                liveRecordings.map((recording) => [
                    recording.id,
                    recording.filename,
                ]),
            ),
        [liveRecordings],
    );
    const activityItems = useMemo<ActivityItem[]>(() => {
        const items: ActivityItem[] = [];

        if (workerStatus?.isRunning || isAutoSyncing) {
            items.push({
                id: "source-sync-running",
                tone: "loading",
                title: t("activityOverlay.items.sourceUpdatingTitle"),
                body: t("activityOverlay.items.sourceUpdatingBody"),
                action: "sync",
            });
        } else if (workerStatus?.manualTriggerRequestedAt) {
            items.push({
                id: "source-sync-queued",
                tone: "loading",
                title: t("activityOverlay.items.updateQueuedTitle"),
                body: t("activityOverlay.items.updateQueuedBody"),
            });
        }

        if (lastSyncResult?.success === false) {
            items.push({
                id: "source-sync-error",
                tone: "error",
                title: t("activityOverlay.items.sourceUpdateFailedTitle"),
                body:
                    lastSyncResult.error ??
                    t("activityOverlay.items.sourceUpdateFailedBody"),
                action: "sync",
            });
        } else if (workerStatus && !workerStatus.healthy) {
            items.push({
                id: "worker-unavailable",
                tone: "error",
                title: t("activityOverlay.status.autoUpdateUnavailable"),
                body:
                    workerStatus.lastError ??
                    t("activityOverlay.status.workerNotResponding"),
                action: "settings",
            });
        }

        if (
            lastSyncResult?.success &&
            (lastSyncResult.newRecordings ?? 0) > 0
        ) {
            items.push({
                id: "source-sync-success",
                tone: "success",
                title: t("activityOverlay.items.sourceUpdateCompleteTitle"),
                body: t("activityOverlay.items.importedRecordings", {
                    count: lastSyncResult.newRecordings ?? 0,
                }),
            });
        } else if (workerStatus?.lastSummary) {
            const summary = workerStatus.lastSummary;
            items.push({
                id: "source-sync-summary",
                tone: summary.errorCount > 0 ? "warn" : "success",
                title: t(
                    summary.errorCount > 0
                        ? "activityOverlay.items.sourceUpdatePartialTitle"
                        : "activityOverlay.items.lastUpdateCompleteTitle",
                ),
                body: t(
                    summary.errorCount > 0
                        ? "activityOverlay.items.syncPartialSummary"
                        : "activityOverlay.items.syncSummary",
                    {
                        errors: summary.errorCount,
                        new: summary.newRecordings,
                        removed: summary.removedRecordings,
                        updated: summary.updatedRecordings,
                    },
                ),
                action: summary.errorCount > 0 ? "sync" : undefined,
            });
        }

        for (const [recordingId, job] of liveJobs) {
            const name =
                recordingNameById.get(recordingId) ??
                t("activityOverlay.items.untitledRecording");
            if (isActiveTranscriptionJob(job)) {
                items.push({
                    id: `transcription-active-${recordingId}`,
                    tone: "loading",
                    title: name,
                    body: t("activityOverlay.items.transcriptionActive", {
                        status:
                            t(
                                `activityOverlay.remoteStatus.${job.remoteStatus ?? job.status}`,
                            ) ||
                            job.remoteStatus ||
                            job.status,
                    }),
                    action: "recording",
                    recordingId,
                });
                continue;
            }
            if (job.status === "failed") {
                items.push({
                    id: `transcription-failed-${recordingId}`,
                    tone: "warn",
                    title: t("activityOverlay.items.transcriptionFailedTitle", {
                        name,
                    }),
                    body:
                        job.lastError ??
                        t("activityOverlay.items.transcriptionFailedBody"),
                    action: "recording",
                    recordingId,
                });
            }
        }

        return items;
    }, [
        isAutoSyncing,
        lastSyncResult,
        liveJobs,
        recordingNameById,
        t,
        workerStatus,
    ]);
    const visibleActivityItems = activityItems.filter(
        (item) => !dismissedActivityIds.has(item.id),
    );
    const activityBadgeCount = visibleActivityItems.filter(
        (item) => item.tone === "error" || item.tone === "warn" || item.action,
    ).length;
    const activityPanelState = visibleActivityItems.some(
        (item) => item.tone === "loading",
    )
        ? "loading"
        : visibleActivityItems.some(
                (item) => item.tone === "error" || item.tone === "warn",
            )
          ? "error"
          : visibleActivityItems.length > 0
            ? "default"
            : "empty";

    const loadSourceReport = useCallback(async () => {
        if (!selectedRecordingId || !selectedRecordingHasSource) {
            setSourceReport({
                recordingId: selectedRecordingId,
                state: "idle",
                data: null,
                error: "",
            });
            return;
        }

        sourceReportRequestRef.current?.controller.abort();
        const requestId = sourceReportRequestIdRef.current + 1;
        sourceReportRequestIdRef.current = requestId;
        const controller = new AbortController();
        sourceReportRequestRef.current = {
            controller,
            id: requestId,
            recordingId: selectedRecordingId,
        };

        setSourceReport({
            recordingId: selectedRecordingId,
            state: "loading",
            data: null,
            error: "",
        });

        try {
            const response = await fetch(
                `/api/recordings/${selectedRecordingId}/source-report`,
                { cache: "no-store", signal: controller.signal },
            );
            const payload = (await response.json().catch(() => ({}))) as
                | (SourceReportData & { error?: string })
                | { error?: string };

            if (
                controller.signal.aborted ||
                sourceReportRequestRef.current?.id !== requestId ||
                selectedRecordingIdRef.current !== selectedRecordingId
            ) {
                return;
            }

            if (!response.ok) {
                setSourceReport({
                    recordingId: selectedRecordingId,
                    state: "error",
                    data: null,
                    error: payload.error ?? "加载来源记录失败",
                });
                return;
            }

            const report = payload as SourceReportData;
            setSourceReport({
                recordingId: selectedRecordingId,
                state: "loaded",
                data: report,
                error: "",
            });
        } catch (error) {
            if (
                controller.signal.aborted ||
                sourceReportRequestRef.current?.id !== requestId ||
                selectedRecordingIdRef.current !== selectedRecordingId
            ) {
                return;
            }

            if (error instanceof DOMException && error.name === "AbortError") {
                return;
            }

            setSourceReport({
                recordingId: selectedRecordingId,
                state: "error",
                data: null,
                error: "加载来源记录失败",
            });
        } finally {
            if (sourceReportRequestRef.current?.id === requestId) {
                sourceReportRequestRef.current = null;
            }
        }
    }, [selectedRecordingHasSource, selectedRecordingId]);

    const handleCopyLocalTranscript = useCallback(async () => {
        if (!localTranscriptText.trim()) {
            toast.error(t("transcription.noTranscript"));
            return;
        }

        setCopyingAction("local-transcript");
        try {
            await writeBrowserClipboardText(localTranscriptText);
            showCopyFeedback("local-transcript", "ok");
            toast.success(t("transcription.transcriptCopied"));
        } catch {
            showCopyFeedback("local-transcript", "err");
            toast.error(t("transcription.copyTranscriptFailed"));
        } finally {
            setCopyingAction(null);
        }
    }, [localTranscriptText, showCopyFeedback, t]);

    const handleCopySourceMaterial = useCallback(
        async (kind: "source-transcript" | "source-report") => {
            const copyText =
                kind === "source-transcript"
                    ? sourceTranscriptCopyText
                    : sourceReportCopyText;

            if (!copyText.trim()) {
                toast.error(
                    kind === "source-transcript"
                        ? t("sourceReport.missingSourceTranscript")
                        : t("sourceReport.missingSourceReport"),
                );
                return;
            }

            setCopyingAction(kind);
            try {
                await writeBrowserClipboardText(copyText);
                showCopyFeedback(kind, "ok");
                toast.success(
                    kind === "source-transcript"
                        ? t("sourceReport.sourceTranscriptCopied")
                        : t("sourceReport.sourceReportCopied"),
                );
            } catch {
                showCopyFeedback(kind, "err");
                toast.error(t("sourceReport.copyFailed"));
            } finally {
                setCopyingAction(null);
            }
        },
        [showCopyFeedback, sourceReportCopyText, sourceTranscriptCopyText, t],
    );

    const handleOpenSourceRecord = useCallback(() => {
        if (!sourceOpenUrl) {
            toast.error(t("sourceReport.openSourceUnavailable"));
            return;
        }

        window.open(sourceOpenUrl, "_blank", "noopener,noreferrer");
    }, [sourceOpenUrl, t]);

    const handleRepullSource = useCallback(async () => {
        if (!selectedRecordingId || sourceRepullDisabled) {
            if (!sourceRepullAvailable) {
                toast.error(t("sourceReport.repullUnavailable"));
            }
            return;
        }

        setSourceRepullState("loading");
        try {
            await runDataSourcesSync();
            setSourceRepullState("success");
            await Promise.all([refreshStatus(), loadDataSources()]);
            refreshBrowserRoute(router);
            await loadSourceReport();
            toast.success(t("sourceReport.repullComplete"));
        } catch {
            setSourceRepullState("error");
            toast.error(t("sourceReport.repullFailed"));
        }
    }, [
        loadDataSources,
        loadSourceReport,
        refreshStatus,
        router,
        selectedRecordingId,
        sourceRepullAvailable,
        sourceRepullDisabled,
        t,
    ]);

    const markTranscriptLoading = useCallback((recordingId: string) => {
        setLoadingTranscriptIds((previous) => {
            if (previous.has(recordingId)) {
                return previous;
            }
            const next = new Set(previous);
            next.add(recordingId);
            return next;
        });
    }, []);

    const clearTranscriptLoading = useCallback((recordingId: string) => {
        setLoadingTranscriptIds((previous) => {
            if (!previous.has(recordingId)) {
                return previous;
            }
            const next = new Set(previous);
            next.delete(recordingId);
            return next;
        });
    }, []);

    const loadRecordingTranscription = useCallback(
        async (recordingId: string) => {
            if (loadingTranscriptIdsRef.current.has(recordingId)) {
                return null;
            }

            loadingTranscriptIdsRef.current.add(recordingId);
            markTranscriptLoading(recordingId);
            setTranscriptLoadErrors((previous) => {
                if (!previous.has(recordingId)) {
                    return previous;
                }
                const next = new Map(previous);
                next.delete(recordingId);
                return next;
            });

            try {
                const response = await fetch(`/api/recordings/${recordingId}`, {
                    cache: "no-store",
                    headers: { Accept: "application/json" },
                });
                if (!response.ok) {
                    throw new Error(
                        await readResponseError(
                            response,
                            "无法读取逐字稿，请稍后重试。",
                        ),
                    );
                }

                const data = (await response.json()) as {
                    transcription?: TranscriptionPollTranscriptData | null;
                };
                const transcription = data.transcription;
                if (!transcription) {
                    setLiveTranscriptions((previous) => {
                        const current = previous.get(recordingId);
                        if (hasTranscriptContent(current)) {
                            return previous;
                        }
                        const next = new Map(previous);
                        next.set(recordingId, {
                            ...current,
                            hasTranscript: false,
                            text: null,
                            segments: null,
                        });
                        return next;
                    });
                    return null;
                }

                setLiveTranscriptions((previous) => {
                    const current = previous.get(recordingId);
                    const merged = mergeTranscriptionData(current, {
                        hasTranscript:
                            hasTranscriptContent({
                                text: transcription.text,
                                segments: transcription.segments,
                            }) || Boolean(current?.hasTranscript),
                        text: transcription.text ?? null,
                        language: transcription.detectedLanguage ?? null,
                        speakerMap: transcription.speakerMap ?? null,
                        segments: transcription.segments ?? null,
                    });
                    if (areTranscriptionsEqual(current, merged)) {
                        return previous;
                    }
                    const next = new Map(previous);
                    next.set(recordingId, merged);
                    return next;
                });
                return transcription;
            } catch (error) {
                const message =
                    error instanceof Error && error.message.trim()
                        ? error.message
                        : "无法读取逐字稿，请稍后重试。";
                setTranscriptLoadErrors((previous) => {
                    const next = new Map(previous);
                    next.set(recordingId, message);
                    return next;
                });
                return null;
            } finally {
                loadingTranscriptIdsRef.current.delete(recordingId);
                clearTranscriptLoading(recordingId);
            }
        },
        [clearTranscriptLoading, markTranscriptLoading],
    );

    useEffect(() => {
        const recordingId = selectedRecordingId;
        if (
            !recordingId ||
            !selectedTranscription?.hasTranscript ||
            selectedTranscription.segments !== undefined
        ) {
            return;
        }

        void loadRecordingTranscription(recordingId);
    }, [
        loadRecordingTranscription,
        selectedRecordingId,
        selectedTranscription,
    ]);

    useEffect(() => {
        const recordingId = selectedRecordingId;
        if (!recordingId || !transcriptionPollingKey) {
            return;
        }

        let cancelled = false;
        const poll = async () => {
            try {
                const response = await fetch(
                    `/api/recordings/${recordingId}/transcribe`,
                    { cache: "no-store" },
                );
                if (!response.ok || cancelled) {
                    return;
                }

                const result =
                    resolveDashboardTranscriptionPoll<TranscriptionPollTranscriptData>(
                        await response.json(),
                    );
                if (cancelled) {
                    return;
                }

                if (result.state === "active") {
                    setLiveJobs((previous) => {
                        const current = previous.get(recordingId);
                        if (
                            areDashboardTranscriptionJobsEqual(
                                current,
                                result.job,
                            )
                        ) {
                            return previous;
                        }
                        const next = new Map(previous);
                        next.set(recordingId, result.job);
                        return next;
                    });
                    setRetxState(
                        getRetxStateFromActiveJob(result.job) ?? "running",
                    );
                    return;
                }

                if (result.state === "completed") {
                    setLiveTranscriptions((previous) => {
                        const current = previous.get(recordingId);
                        const merged = mergeTranscriptionData(current, {
                            hasTranscript: true,
                            text: result.transcript.text ?? null,
                            language:
                                result.transcript.detectedLanguage ?? null,
                            speakerMap: result.transcript.speakerMap ?? null,
                            segments: result.transcript.segments ?? null,
                        });
                        if (areTranscriptionsEqual(current, merged)) {
                            return previous;
                        }
                        const next = new Map(previous);
                        next.set(recordingId, merged);
                        return next;
                    });
                    if (result.job) {
                        const completedJob = result.job;
                        setLiveJobs((previous) => {
                            if (
                                areDashboardTranscriptionJobsEqual(
                                    previous.get(recordingId),
                                    completedJob,
                                )
                            ) {
                                return previous;
                            }
                            const next = new Map(previous);
                            next.set(recordingId, completedJob);
                            return next;
                        });
                    }
                    setRetxState("completed");
                    return;
                }

                if (result.state === "failed") {
                    setLiveJobs((previous) => {
                        const current = previous.get(recordingId);
                        if (
                            areDashboardTranscriptionJobsEqual(
                                current,
                                result.job,
                            )
                        ) {
                            return previous;
                        }
                        const next = new Map(previous);
                        next.set(recordingId, result.job);
                        return next;
                    });
                    setRetxState("failed");
                }
            } catch {
                // Polling is retried by the next interval.
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
    }, [selectedRecordingId, transcriptionPollingKey]);

    const mergeDashboardSpeakers = useCallback(
        async (request: TranscriptionPanelSpeakerMergeRequest) => {
            if (!selectedRecordingId) {
                return;
            }

            lastSpeakerMergeRequestRef.current = request;
            setSpeakerMergeState({ state: "pending", error: null });

            try {
                const reviewResponse = await fetch(
                    `/api/recordings/${selectedRecordingId}/speakers`,
                    { cache: "no-store" },
                );
                if (!reviewResponse.ok) {
                    throw new Error(
                        await readResponseError(
                            reviewResponse,
                            "无法读取说话人信息。",
                        ),
                    );
                }
                const review = (await reviewResponse.json()) as {
                    speakers?: Array<{
                        rawLabel?: string;
                        matchedProfileId?: string | null;
                    }>;
                };
                const targetReview = review.speakers?.find(
                    (speaker) => speaker.rawLabel === request.target.rawLabel,
                );

                let profileId = targetReview?.matchedProfileId ?? null;
                if (!profileId) {
                    const targetResponse = await fetch(
                        `/api/recordings/${selectedRecordingId}/speakers`,
                        {
                            method: "PATCH",
                            headers: {
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                                rawLabel: request.target.rawLabel,
                                profileName:
                                    request.target.speakerName ||
                                    request.target.rawLabel,
                            }),
                        },
                    );
                    if (!targetResponse.ok) {
                        throw new Error(
                            await readResponseError(
                                targetResponse,
                                "无法创建目标说话人。",
                            ),
                        );
                    }
                    const targetResult = (await targetResponse.json()) as {
                        profileId?: string | null;
                    };
                    profileId = targetResult.profileId ?? null;
                }

                if (!profileId) {
                    throw new Error("目标说话人没有可用的资料。");
                }

                const sourceResponse = await fetch(
                    `/api/recordings/${selectedRecordingId}/speakers`,
                    {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            rawLabel: request.source.rawLabel,
                            profileId,
                        }),
                    },
                );
                if (!sourceResponse.ok) {
                    throw new Error(
                        await readResponseError(
                            sourceResponse,
                            "无法合并所选说话人。",
                        ),
                    );
                }

                const readbackResponse = await fetch(
                    `/api/recordings/${selectedRecordingId}/speakers`,
                    { cache: "no-store" },
                );
                if (!readbackResponse.ok) {
                    throw new Error("说话人已写入，但读取确认失败。");
                }
                const readback = (await readbackResponse.json()) as {
                    speakers?: Array<{
                        rawLabel?: string;
                        matchedProfileId?: string | null;
                    }>;
                };
                const mergedLabels = new Set([
                    request.target.rawLabel,
                    request.source.rawLabel,
                ]);
                const mergedRows =
                    readback.speakers?.filter((speaker) =>
                        mergedLabels.has(speaker.rawLabel ?? ""),
                    ) ?? [];
                if (
                    mergedRows.length !== 2 ||
                    mergedRows.some(
                        (speaker) => speaker.matchedProfileId !== profileId,
                    )
                ) {
                    throw new Error("说话人合并读取确认不一致。");
                }

                const transcriptResponse = await fetch(
                    `/api/recordings/${selectedRecordingId}/transcript/speakers`,
                    { cache: "no-store" },
                );
                if (!transcriptResponse.ok) {
                    throw new Error("说话人已合并，但逐字稿刷新失败。");
                }
                const speakerTranscript = (await transcriptResponse.json()) as {
                    transcript?: {
                        displayText?: string | null;
                        detectedLanguage?: string | null;
                        segments?: TranscriptSegmentData[] | null;
                    } | null;
                    speakerMap?: Record<string, string> | null;
                };
                if (!speakerTranscript.transcript) {
                    throw new Error("说话人已合并，但逐字稿读取为空。");
                }
                setLiveTranscriptions((previous) => {
                    const current = previous.get(selectedRecordingId);
                    const merged = mergeTranscriptionData(current, {
                        hasTranscript: true,
                        text:
                            speakerTranscript.transcript?.displayText ??
                            current?.text ??
                            null,
                        language:
                            speakerTranscript.transcript?.detectedLanguage ??
                            current?.language ??
                            null,
                        speakerMap: speakerTranscript.speakerMap ?? null,
                        segments:
                            speakerTranscript.transcript?.segments ?? null,
                    });
                    if (areTranscriptionsEqual(current, merged)) {
                        return previous;
                    }
                    const next = new Map(previous);
                    next.set(selectedRecordingId, merged);
                    return next;
                });
                setSpeakerMergeState({ state: "success", error: null });
                toast.success("说话人已合并");
            } catch (error) {
                const message =
                    error instanceof Error && error.message.trim()
                        ? error.message
                        : "合并说话人失败，请稍后重试。";
                setSpeakerMergeState({ state: "error", error: message });
                toast.error(message);
            }
        },
        [selectedRecordingId],
    );

    const retryDashboardSpeakerMerge = useCallback(() => {
        const request = lastSpeakerMergeRequestRef.current;
        if (request) {
            void mergeDashboardSpeakers(request);
        }
    }, [mergeDashboardSpeakers]);

    useEffect(() => {
        if (!selectedRecording) {
            selectedRecordingIdRef.current = null;
            sourceReportRequestRef.current?.controller.abort();
            sourceReportRequestRef.current = null;
            sourceReportRequestIdRef.current += 1;
            setSourceReport({
                recordingId: null,
                state: "idle",
                data: null,
                error: "",
            });
            return;
        }
        if (selectedRecordingIdRef.current === selectedRecording.id) {
            return;
        }
        selectedRecordingIdRef.current = selectedRecording.id;
        setSelectedId(selectedRecording.id);
        setDraftTitle(selectedRecording.filename);
        setRetxState("idle");
        setSpeakerMergeState({ state: "idle", error: null });
        lastSpeakerMergeRequestRef.current = null;
        sourceReportRequestRef.current?.controller.abort();
        sourceReportRequestRef.current = null;
        sourceReportRequestIdRef.current += 1;
        setSourceReport({
            recordingId: selectedRecording.id,
            state: "idle",
            data: null,
            error: "",
        });
        setCopyingAction(null);
        setCopyFeedback(null);
        if (copyFeedbackTimerRef.current) {
            window.clearTimeout(copyFeedbackTimerRef.current);
            copyFeedbackTimerRef.current = null;
        }
        setAiState("loading");
        setAiPreviewTitle("");
        setAiError("");
        setAiApplying(false);
    }, [selectedRecording]);

    useEffect(() => {
        return () => {
            if (copyFeedbackTimerRef.current) {
                window.clearTimeout(copyFeedbackTimerRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (
            detailTab !== "source" ||
            !selectedRecordingId ||
            !selectedRecordingHasSource ||
            (sourceReport.recordingId === selectedRecordingId &&
                sourceReport.state !== "idle")
        ) {
            return;
        }

        void loadSourceReport();
    }, [
        detailTab,
        loadSourceReport,
        selectedRecordingId,
        selectedRecordingHasSource,
        sourceReport.recordingId,
        sourceReport.state,
    ]);

    useEffect(() => {
        if (settingsOpen) {
            setSearchOpen(false);
            closeActivityOverlay();
            setDrawerOpen(false);
            setMoreOpen(false);
            setTagOpen(false);
            setTagFilterOpen(false);
        }
    }, [closeActivityOverlay, settingsOpen]);

    useEffect(() => {
        if (activityOpen || !restoreActivityFocusRef.current) return;
        const frame = window.requestAnimationFrame(() => {
            const activeElement = document.activeElement;
            if (
                activeElement === document.body ||
                activeElement === document.documentElement ||
                activeElement === activityTriggerRef.current ||
                activeElement === settingsTriggerRef.current
            ) {
                activityTriggerRef.current?.focus({ preventScroll: true });
            }
        });
        return () => window.cancelAnimationFrame(frame);
    }, [activityOpen]);

    useEffect(() => {
        if (!drawerOpen && !activityOpen) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (drawerOpen && event.key === "Tab") {
                const drawer = sourceDrawerRef.current;
                const focusable = Array.from(
                    drawer?.querySelectorAll<HTMLElement>(
                        SOURCE_DRAWER_FOCUSABLE_SELECTOR,
                    ) ?? [],
                ).filter(
                    (element) =>
                        !element.hasAttribute("disabled") &&
                        element.offsetParent !== null,
                );
                const first = focusable[0] ?? drawer;
                const last = focusable.at(-1) ?? drawer;
                const active = document.activeElement;

                if (!drawer || !first || !last) return;
                if (!drawer.contains(active)) {
                    event.preventDefault();
                    first.focus({ preventScroll: true });
                    return;
                }
                if (event.shiftKey && active === first) {
                    event.preventDefault();
                    last.focus({ preventScroll: true });
                    return;
                }
                if (!event.shiftKey && active === last) {
                    event.preventDefault();
                    first.focus({ preventScroll: true });
                    return;
                }
            }

            if (event.key !== "Escape") return;
            event.preventDefault();
            if (activityOpen) {
                closeActivityOverlay({ restoreFocus: true });
            }
            if (drawerOpen) {
                setDrawerOpen(false);
                window.setTimeout(() => {
                    drawerTriggerRef.current?.focus({ preventScroll: true });
                }, 180);
            }
        };

        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target;
            if (!(target instanceof Node)) return;
            if (
                activityOpen &&
                activityOverlayRef.current &&
                !activityOverlayRef.current.contains(target)
            ) {
                closeActivityOverlay();
            }
            if (
                drawerOpen &&
                sourceDrawerRef.current &&
                !sourceDrawerRef.current.contains(target) &&
                !drawerTriggerRef.current?.contains(target)
            ) {
                setDrawerOpen(false);
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        document.addEventListener("pointerdown", handlePointerDown);
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.removeEventListener("pointerdown", handlePointerDown);
        };
    }, [activityOpen, closeActivityOverlay, drawerOpen]);

    useEffect(() => {
        if (!drawerOpen) return;
        window.setTimeout(() => {
            const drawer = sourceDrawerRef.current;
            const firstFocusable = drawer?.querySelector<HTMLElement>(
                SOURCE_DRAWER_FOCUSABLE_SELECTOR,
            );
            (firstFocusable ?? drawer)?.focus({ preventScroll: true });
        }, 0);
    }, [drawerOpen]);

    useEffect(() => {
        if (!tagFilterOpen) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            setTagFilterOpen(false);
        };

        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target;
            if (!(target instanceof Node)) return;
            if (!tagFilterRef.current?.contains(target)) {
                setTagFilterOpen(false);
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        document.addEventListener("pointerdown", handlePointerDown);
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.removeEventListener("pointerdown", handlePointerDown);
        };
    }, [tagFilterOpen]);

    useEffect(() => {
        const media = window.matchMedia("(max-width: 1023px)");
        const updateDetailViewport = () =>
            setDetailMobileViewport(media.matches);

        updateDetailViewport();
        media.addEventListener("change", updateDetailViewport);
        return () => media.removeEventListener("change", updateDetailViewport);
    }, []);

    useEffect(() => {
        if (!detailOpen || !detailMobileViewport) return;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const focusFrame = window.requestAnimationFrame(() => {
            (detailBackRef.current ?? detailPanelRef.current)?.focus({
                preventScroll: true,
            });
        });

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                detailBackRef.current?.click();
                return;
            }
            if (event.key !== "Tab") return;

            const panel = detailPanelRef.current;
            const focusable = Array.from(
                panel?.querySelectorAll<HTMLElement>(
                    DETAIL_FOCUSABLE_SELECTOR,
                ) ?? [],
            ).filter(
                (element) =>
                    !element.hasAttribute("disabled") &&
                    element.offsetParent !== null,
            );
            const first = focusable[0] ?? panel;
            const last = focusable.at(-1) ?? panel;
            if (!panel || !first || !last) return;

            if (!panel.contains(document.activeElement)) {
                event.preventDefault();
                first.focus({ preventScroll: true });
            } else if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus({ preventScroll: true });
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus({ preventScroll: true });
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => {
            window.cancelAnimationFrame(focusFrame);
            document.body.style.overflow = previousOverflow;
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [detailMobileViewport, detailOpen]);

    useEffect(() => {
        if (detailOpen && !detailMobileViewport && detailWasMobileRef.current) {
            const focusFrame = window.requestAnimationFrame(() => {
                detailCloseRef.current?.focus({ preventScroll: true });
            });
            detailWasMobileRef.current = detailMobileViewport;
            return () => window.cancelAnimationFrame(focusFrame);
        }
        detailWasMobileRef.current = detailMobileViewport;
    }, [detailMobileViewport, detailOpen]);

    useEffect(() => {
        let active = true;
        fetch("/api/settings/title-generation")
            .then((response) => (response.ok ? response.json() : null))
            .then(
                (
                    data: {
                        titleGenerationBaseUrl?: string | null;
                        titleGenerationModel?: string | null;
                        titleGenerationApiKeySet?: boolean;
                    } | null,
                ) => {
                    if (!active) return;
                    setTitleGenerationConfigured(
                        Boolean(
                            data?.titleGenerationBaseUrl &&
                                data?.titleGenerationModel &&
                                data?.titleGenerationApiKeySet,
                        ),
                    );
                },
            )
            .catch(() => {
                if (active) setTitleGenerationConfigured(false);
            });
        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        if (!selectedRecordingId || titleGenerationConfigured === null) return;
        if (aiUnavailableReason) {
            if (aiOpen) {
                setAiState("unavailable");
                setAiError(aiUnavailableReason);
            }
            return;
        }
        if (aiState === "unavailable") {
            setAiOpen(false);
            setAiState("loading");
            setAiError("");
        }
    }, [
        aiOpen,
        aiState,
        aiUnavailableReason,
        selectedRecordingId,
        titleGenerationConfigured,
    ]);

    useEffect(() => {
        if (!tagOpen) return;
        let active = true;
        fetch("/api/recording-tags")
            .then((response) => (response.ok ? response.json() : null))
            .then((data: { tags?: RecordingTag[] } | null) => {
                if (!active) return;
                setAvailableTags(data?.tags ?? []);
                setTagLoadError("");
            })
            .catch(() => {
                if (active) setTagLoadError("标签加载失败");
            });
        return () => {
            active = false;
        };
    }, [tagOpen]);

    function openSettings(section: CanonicalSettingsSection) {
        setSearchOpen(false);
        setActivityOpen(false);
        setDrawerOpen(false);
        setMoreOpen(false);
        setTagOpen(false);
        setTagFilterOpen(false);
        setAiOpen(false);
        setAiApplying(false);
        window.history.replaceState(null, "", `/dashboard#${section}`);
        setSettingsOpen(true);
    }

    function applyListMode(mode: DashboardListMode) {
        if (listMode !== mode) {
            updateDashboardFilterState({ type: "list-mode", value: mode });
        }
        setTagFilterOpen(false);
    }

    function writeRecordingListHistory(
        next: { detailOpen: boolean; page: number; recordingId: string | null },
        mode: "push" | "replace",
    ) {
        const nextUrl = recordingListUrl({
            currentUrl: window.location.href,
            ...next,
        });
        if (isRecordingListUrlCurrent(window.location.href, nextUrl)) return;
        window.history[mode === "push" ? "pushState" : "replaceState"](
            null,
            "",
            nextUrl,
        );
    }

    function closeRecordingDetail({ restoreFocus = true } = {}) {
        const closingId = selectedRecordingId;
        requestedRecordingIdRef.current = null;
        setDetailOpen(false);
        writeRecordingListHistory(
            { detailOpen: false, page: currentListPage, recordingId: null },
            "push",
        );
        if (restoreFocus && closingId) {
            window.requestAnimationFrame(() => {
                recordingRowRefs.current
                    .get(closingId)
                    ?.focus({ preventScroll: true });
            });
        }
    }

    function selectListPage(nextPage: number) {
        const bounded = Math.min(Math.max(1, nextPage), listTotalPages);
        setListPage(bounded);
        requestedRecordingIdRef.current = null;
        setDetailOpen(false);
        writeRecordingListHistory(
            { detailOpen: false, page: bounded, recordingId: null },
            "push",
        );
    }

    function selectRecording(recordingId: string) {
        requestedRecordingIdRef.current = null;
        setSelectedId(recordingId);
        setDetailOpen(true);
        writeRecordingListHistory(
            { detailOpen: true, page: currentListPage, recordingId },
            "push",
        );
        if (recordingId === selectedRecordingId) return;
        setEditingTitle(false);
        setMoreOpen(false);
        setTagOpen(false);
        setTagFilterOpen(false);
        setAiOpen(false);
        setRetxState("idle");
        setAiState("loading");
        setAiPreviewTitle("");
        setAiError("");
        setAiApplying(false);
        setSourceRepullState("idle");
    }

    const runManualSync = useCallback(async () => {
        if (syncButtonBusy) return;
        setActivitySyncActionState("busy");
        const syncSucceeded = await manualSync();

        if (syncSucceeded) {
            await Promise.all([refreshStatus(), loadDataSources()]);
            refreshBrowserRoute(router);
            setActivitySyncActionState("done");
            return;
        }

        setActivitySyncActionState("error");
    }, [loadDataSources, manualSync, refreshStatus, router, syncButtonBusy]);

    useEffect(() => {
        if (!hasBrowserWindow()) {
            return;
        }

        const handleSystemBannerAction = (event: Event) => {
            const detail = (
                event as CustomEvent<{ action?: string; id?: string }>
            ).detail;
            if (detail?.id !== "source-sync-system") return;
            if (
                detail.action === "retry" ||
                detail.action === "reconnect" ||
                detail.action === "retry-sync"
            ) {
                void runManualSync();
            }
        };

        window.addEventListener(
            "betterainote:system-banner-action",
            handleSystemBannerAction,
        );
        return () =>
            window.removeEventListener(
                "betterainote:system-banner-action",
                handleSystemBannerAction,
            );
    }, [runManualSync]);

    function handleLibrarySearchOpenChange(open: boolean) {
        if (open) {
            setActivityOpen(false);
            setMoreOpen(false);
            setTagOpen(false);
            setAiOpen(false);
        }
        setSearchOpen(open);
    }

    function applyLibrarySearchFilter(filter: LibrarySearchFilter) {
        setLibrarySearchFilter(filter);
        selectFavorite("all");
        applyListMode("timeline");
    }

    async function runActivityAction(item: ActivityItem) {
        if (item.action === "sync") {
            await runManualSync();
            return;
        }
        if (item.action === "settings") {
            openSettings("data-sources");
            return;
        }
        if (item.recordingId) {
            selectRecording(item.recordingId);
            setActivityOpen(false);
        }
    }

    function handleActivityItemKeyDown(
        event: ReactKeyboardEvent,
        item: ActivityItem,
    ) {
        if (!item.recordingId) return;
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        void runActivityAction(item);
    }

    async function renameRecording() {
        if (!selectedRecording) return;
        const filename = draftTitle.trim();
        if (!filename || filename === selectedRecording.filename) {
            setEditingTitle(false);
            setDraftTitle(selectedRecording.filename);
            return;
        }
        setRenaming(true);
        const response = await fetch(
            `/api/recordings/${selectedRecording.id}/rename`,
            {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ filename }),
            },
        );
        setRenaming(false);
        if (!response.ok) {
            toast.error(await readResponseError(response, "重命名失败"));
            return;
        }
        setLiveRecordings((items) =>
            items.map((item) =>
                item.id === selectedRecording.id ? { ...item, filename } : item,
            ),
        );
        setDraftTitle(filename);
        setEditingTitle(false);
        toast.success("已重命名");
    }

    async function previewAutoRename() {
        if (!selectedRecording) return;
        if (aiUnavailableReason) {
            setAiOpen(true);
            setAiState("unavailable");
            setAiError(aiUnavailableReason);
            setAiApplying(false);
            return;
        }
        setAiOpen(true);
        setAiState("loading");
        setAiPreviewTitle("");
        setAiError("");
        setAiApplying(false);
        const response = await fetch(
            `/api/recordings/${selectedRecording.id}/rename/auto`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mode: "preview" }),
            },
        );
        if (!response.ok) {
            const error = await readResponseError(
                response,
                "这次没拿到结果，可能是转写太短或模型暂时不可用。",
            );
            toast.error(error);
            if (response.status === 400) {
                setAiError("AI 重命名服务尚未配置或暂时不可用。");
                setAiState("unavailable");
            } else {
                setAiError("这次没拿到结果，可能是转写太短或模型暂时不可用。");
                setAiState("error");
            }
            return;
        }
        const data = (await response.json()) as { filename?: string };
        setAiPreviewTitle(data.filename ?? "");
        setAiState("review");
    }

    async function applyAiRename() {
        if (!selectedRecording || !aiPreviewTitle.trim()) return;
        const filename = aiPreviewTitle.trim();
        setAiApplying(true);
        try {
            const response = await fetch(
                `/api/recordings/${selectedRecording.id}/rename`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ filename }),
                },
            );
            if (!response.ok) {
                const error = await readResponseError(
                    response,
                    "AI 标题写回失败",
                );
                setAiError(error);
                toast.error(error);
                setAiState("review");
                return;
            }
            setLiveRecordings((items) =>
                items.map((item) =>
                    item.id === selectedRecording.id
                        ? { ...item, filename }
                        : item,
                ),
            );
            setDraftTitle(filename);
            setAiOpen(false);
            setAiState("loading");
            setAiPreviewTitle("");
            setAiError("");
            toast.success("AI 重命名已应用");
        } finally {
            setAiApplying(false);
        }
    }

    async function deleteRecording() {
        if (!selectedRecording || !localDeleteAvailable) return;
        moreTriggerRef.current?.focus({ preventScroll: true });
        setMoreOpen(false);
        setTagOpen(false);
        setAiOpen(false);
        const ok = await confirm({
            title: "删除本地副本？",
            description: "这条录音在来源系统中已被删除，本地仅留存缓存副本。",
            warning: "删除后转写、标签与 AI 标题都会一并清除，且无法恢复。",
            confirmLabel: "永久删除",
            cancelLabel: "取消",
        });
        if (!ok) return;
        const response = await fetch(
            `/api/recordings/${selectedRecording.id}`,
            {
                method: "DELETE",
            },
        );
        if (!response.ok) {
            toast.error(await readResponseError(response, "删除失败"));
            return;
        }
        const deletedId = selectedRecording.id;
        setLiveRecordings((items) =>
            items.filter((item) => item.id !== deletedId),
        );
        setLiveTranscriptions((items) => {
            const next = new Map(items);
            next.delete(deletedId);
            return next;
        });
        setLiveJobs((items) => {
            const next = new Map(items);
            next.delete(deletedId);
            return next;
        });
        setSelectedId("");
        setMoreOpen(false);
        toast.success("录音已删除");
    }

    async function retranscribe() {
        if (!selectedRecording) return;
        if (!selectedRecording.audioUrl) {
            setRetxState("unavailable");
            toast.error("当前录音没有可用的本地音频，无法重新转写。");
            return;
        }
        const ok = await confirm({
            title: "重新转写这条录音？",
            description: "当前的逐字稿、说话人标记与 AI 标题会被新结果覆盖。",
            details: [
                "逐字稿将重新生成 · 估计 1 ~ 3 分钟",
                "说话人映射会保留，但本次结果可能合并不同的片段",
                "本次操作不会影响来源系统中的正本",
            ],
            confirmLabel: "确认重新转写",
            cancelLabel: "取消",
        });
        if (!ok) return;
        setDismissedCompletedRetxIds((items) => {
            if (!items.has(selectedRecording.id)) return items;
            const next = new Set(items);
            next.delete(selectedRecording.id);
            return next;
        });
        setRetxState("queued");
        const response = await fetch(
            `/api/recordings/${selectedRecording.id}/transcribe`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ force: true }),
            },
        );
        if (!response.ok) {
            setRetxState("failed");
            toast.error(await readResponseError(response, "转写任务提交失败"));
            return;
        }
        const data = (await response.json().catch(() => ({}))) as {
            job?: TranscriptionJobData;
        };
        if (data.job) {
            setLiveJobs((jobs) => {
                const next = new Map(jobs);
                next.set(
                    selectedRecording.id,
                    data.job as TranscriptionJobData,
                );
                return next;
            });
        }
        setRetxState(getRetxStateFromActiveJob(data.job) ?? "running");
        toast.info("转写任务已加入队列");
    }

    function handleAudioEnded() {
        if (!playbackSettings.autoPlayNext || !selectedRecording) return;
        const currentIndex = filteredRecordings.findIndex(
            (recording) => recording.id === selectedRecording.id,
        );
        const nextRecording =
            currentIndex >= 0
                ? filteredRecordings[currentIndex + 1]
                : undefined;
        if (!nextRecording) return;
        selectRecording(nextRecording.id);
    }

    const seekDashboardPlayerBySeconds = (seconds: number) => {
        const audio = audioRef.current;
        if (
            !audio ||
            playbackDisabled ||
            !playbackDuration ||
            Number.isNaN(playbackDuration)
        ) {
            return;
        }

        const nextTime = Math.min(
            playbackDuration,
            Math.max(0, audio.currentTime + seconds),
        );
        audio.currentTime = nextTime;
        seekToSliderValue([(nextTime / playbackDuration) * 100]);
    };

    const seekDashboardPlayerToPercent = (percent: number) => {
        if (
            playbackDisabled ||
            !playbackDuration ||
            Number.isNaN(playbackDuration)
        ) {
            return;
        }
        seekToSliderValue([Math.min(100, Math.max(0, percent))]);
    };

    const dashboardDetailHeaderState = renaming
        ? "saving"
        : editingTitle
          ? "editing"
          : "normal";
    const dashboardDetailHeaderMode = editingTitle ? "editing" : "normal";
    const dashboardSidebarCollapsed = collapsed && !drawerOpen;

    return (
        <div
            className={cn(
                "group/dashboard-workstation",
                DASHBOARD_WORKSTATION_SHELL_CLASS_NAME,
            )}
            data-shell="dashboard-workstation"
            data-hydrated={hydrated ? "true" : "false"}
            data-playback-auto-next={
                playbackSettings.autoPlayNext ? "true" : "false"
            }
            data-playback-settings-loaded={
                playbackSettingsLoaded ? "true" : "false"
            }
            data-drawer-state={drawerOpen ? "open" : "closed"}
            data-detail-state={detailOpen ? "open" : "closed"}
            data-sidebar-collapsed={
                dashboardSidebarCollapsed ? "true" : "false"
            }
            data-surface="dashboard-workstation"
            data-state={hydrated ? "ready" : "loading"}
            data-source-filter-active={source === "all" ? "false" : "true"}
            data-source-filter-provider={source === "all" ? undefined : source}
            data-source-filter-state={sourceFilterStackState}
            data-source-status={selectedSourceRow?.status ?? undefined}
            data-time-style={
                displaySettings.dateTimeFormat === "absolute" ? "abs" : "rel"
            }
        >
            <aside
                className={dashboardSidebarCollapseClassNames.sidebar}
                data-panel="dashboard-sidebar"
                ref={sourceDrawerRef}
            >
                <div
                    className={cn(
                        dashboardBrandClassNames.wrapper,
                        dashboardSidebarCollapseClassNames.brand,
                    )}
                    data-part="dashboard-brand"
                >
                    <Image
                        className={dashboardBrandClassNames.image}
                        src="/assets/logo-mark-steel.svg"
                        alt=""
                        width={36}
                        height={36}
                        unoptimized
                    />
                    <div
                        className={dashboardSidebarCollapseClassNames.hidden}
                        data-part="dashboard-brand-text"
                    >
                        <div
                            className={dashboardBrandClassNames.name}
                            data-part="dashboard-brand-name"
                        >
                            BetterAINote
                        </div>
                        <div
                            className={dashboardBrandClassNames.subtitle}
                            data-part="dashboard-brand-subtitle"
                        >
                            私人工作空间
                        </div>
                    </div>
                </div>

                <nav
                    className={dashboardNavClassNames.root}
                    data-list="dashboard-nav"
                    aria-label="录音筛选"
                >
                    <div
                        className={cn(
                            dashboardNavClassNames.sectionLabel,
                            dashboardSidebarCollapseClassNames.hidden,
                        )}
                        data-part="dashboard-nav-section-label"
                    >
                        收藏
                    </div>
                    {FAVORITES.map((item) => {
                        const Icon = item.icon;
                        const count =
                            item.value === "all"
                                ? liveRecordings.length
                                : item.value === "transcribed"
                                  ? liveRecordings.filter((recording) =>
                                        hasTranscript(
                                            recording,
                                            liveTranscriptions,
                                        ),
                                    ).length
                                  : new Set(
                                        liveRecordings.flatMap((recording) =>
                                            recording.tags.map((tag) => tag.id),
                                        ),
                                    ).size;
                        return (
                            <Button
                                variant="ghost"
                                size="default"
                                className={cn(
                                    dashboardButtonClassNames.nav,
                                    dashboardSidebarCollapseClassNames.favorite,
                                )}
                                type="button"
                                aria-pressed={favorite === item.value}
                                data-active={
                                    favorite === item.value ? "true" : "false"
                                }
                                data-favorite={item.value}
                                data-control="dashboard-favorite"
                                data-filter={item.value}
                                data-state={
                                    favorite === item.value
                                        ? "selected"
                                        : "idle"
                                }
                                data-count-badge={String(count)}
                                key={item.value}
                                onClick={() => {
                                    selectFavorite(item.value);
                                    if (
                                        item.value === "all" &&
                                        listMode === "timeline"
                                    ) {
                                        selectSource("all");
                                    }
                                }}
                            >
                                <Icon data-icon="inline-start" />
                                <span
                                    className={cn(
                                        "min-w-0 flex-1 truncate",
                                        dashboardSidebarCollapseClassNames.hidden,
                                    )}
                                    data-part="dashboard-favorite-label"
                                >
                                    {getFavoriteLabel(item.value, t)}
                                </span>
                                <Badge
                                    variant={
                                        favorite === item.value
                                            ? "secondary"
                                            : "outline"
                                    }
                                    className={cn(
                                        dashboardNavClassNames.favoriteCount,
                                        dashboardSidebarCollapseClassNames.hidden,
                                    )}
                                    data-part="dashboard-favorite-count"
                                    data-state={
                                        favorite === item.value
                                            ? "selected"
                                            : "idle"
                                    }
                                >
                                    {count}
                                </Badge>
                            </Button>
                        );
                    })}

                    <div
                        className={cn(
                            dashboardNavClassNames.sectionLabel,
                            dashboardSidebarCollapseClassNames.hidden,
                        )}
                        data-part="dashboard-nav-section-label"
                    >
                        {t("sourceProviderRows.heading")}
                    </div>
                    <div
                        data-compact={collapsed ? "true" : "false"}
                        data-list="dashboard-sources"
                        data-state={
                            dataSourcesError
                                ? "error"
                                : dataSourcesLoading
                                  ? "loading"
                                  : "ready"
                        }
                    >
                        {source !== "all" ? (
                            <Button
                                variant="ghost"
                                size="sm"
                                type="button"
                                className={dashboardSourceClassNames.clear}
                                data-control="dashboard-source-clear"
                                onClick={() => selectSource("all")}
                            >
                                {t("sourceProviderRows.clear")}
                            </Button>
                        ) : null}
                        {dataSourcesError ? (
                            <div
                                className={dashboardSourceErrorClassName}
                                data-part="source-provider-error"
                                data-state="error"
                            >
                                {dataSourcesError}
                            </div>
                        ) : null}
                        {sourceRows.map((item) => {
                            const settingsTarget = sourceNeedsSettings(
                                item.status,
                            );
                            const disabledSourceRow = sourceRowDisabled(
                                item.status,
                            );
                            const actionKind = sourceActionKind(item.status);
                            const sourceRowState = getSourceRowState(
                                item.status,
                                item.active,
                            );
                            const sourceRowCollapsed = collapsed && !drawerOpen;
                            const sourceStatusTone =
                                sourceProviderStatusTone(sourceRowState);
                            const sourceCountTone =
                                sourceProviderCountTone(sourceRowState);
                            const actionLabel =
                                actionKind === "retry"
                                    ? t("activityOverlay.actions.retry")
                                    : actionKind === "reauth"
                                      ? t("sourceProviderRows.badge.expired")
                                      : actionKind === "connect"
                                        ? t("sourceProviderRows.badge.connect")
                                        : "";
                            const actionAriaLabel =
                                actionKind === "retry"
                                    ? t("sourceFilterStack.retrySync")
                                    : actionKind === "reauth"
                                      ? t("sourceProviderRows.badge.expired")
                                      : actionKind === "connect"
                                        ? t("sourceProviderRows.badge.connect")
                                        : undefined;
                            const visibleCount =
                                item.status === "no-results" ||
                                disabledSourceRow
                                    ? 0
                                    : item.count;
                            return (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    type="button"
                                    className={dashboardSourceButtonClassName(
                                        sourceRowCollapsed,
                                    )}
                                    aria-disabled={
                                        disabledSourceRow ? "true" : undefined
                                    }
                                    aria-current={
                                        item.active ? "true" : undefined
                                    }
                                    aria-pressed={item.active}
                                    aria-label={`${item.label} · ${item.statusLabel}`}
                                    disabled={disabledSourceRow}
                                    data-active={item.active ? "true" : "false"}
                                    data-count-badge={String(visibleCount)}
                                    data-action-state={
                                        disabledSourceRow
                                            ? "disabled"
                                            : (actionKind ?? "count")
                                    }
                                    data-control="dashboard-source-provider"
                                    data-provider={item.key}
                                    data-workspace-provider={item.key}
                                    data-state={sourceRowState}
                                    data-status={item.status}
                                    key={item.key}
                                    onClick={() => {
                                        if (disabledSourceRow) return;
                                        if (settingsTarget) {
                                            selectSource(item.key);
                                            window.localStorage.setItem(
                                                SETTINGS_DATA_SOURCE_PROVIDER_STORAGE_KEY,
                                                item.key,
                                            );
                                            openSettings("data-sources");
                                            return;
                                        }
                                        selectSource(
                                            toggleDashboardSourceFilter(
                                                source,
                                                item.key,
                                            ),
                                        );
                                        setDrawerOpen(false);
                                    }}
                                >
                                    {item.icon ? (
                                        <span
                                            className={
                                                dashboardSourceClassNames.mark
                                            }
                                            data-part="source-provider-mark"
                                            data-provider-cover={
                                                item.cover ? "true" : "false"
                                            }
                                            data-variant="image"
                                            data-state={sourceRowState}
                                        >
                                            {/* biome-ignore lint/performance/noImgElement: provider marks are fixed local assets. */}
                                            <img
                                                src={item.icon}
                                                alt=""
                                                width={18}
                                                height={18}
                                                className={cn(
                                                    dashboardSourceClassNames.markImage,
                                                    item.cover &&
                                                        dashboardSourceClassNames.markImageCover,
                                                )}
                                            />
                                        </span>
                                    ) : (
                                        <span
                                            className={cn(
                                                dashboardSourceClassNames.mark,
                                                dashboardSourceClassNames.markLetter,
                                            )}
                                            data-part="source-provider-mark"
                                            data-provider-cover="false"
                                            data-variant="letter"
                                            data-state={sourceRowState}
                                        >
                                            讯
                                        </span>
                                    )}
                                    <span
                                        className={cn(
                                            "min-w-0 flex-1 truncate",
                                            sourceRowCollapsed && "hidden",
                                        )}
                                        data-part="source-provider-label"
                                    >
                                        {item.label}
                                    </span>
                                    <Badge
                                        aria-hidden="true"
                                        variant="ghost"
                                        className={cn(
                                            dashboardSourceClassNames.status,
                                            sourceRowCollapsed &&
                                                "absolute bottom-1 right-1",
                                        )}
                                        data-effect={
                                            sourceRowState === "expired"
                                                ? "ring"
                                                : undefined
                                        }
                                        data-part="source-provider-status"
                                        data-state={sourceRowState}
                                        data-tone={sourceStatusTone}
                                    />
                                    {actionKind ? (
                                        <Button
                                            asChild
                                            variant="outline"
                                            size="sm"
                                            className={
                                                dashboardSourceClassNames.action
                                            }
                                        >
                                            {/* biome-ignore lint/a11y/useSemanticElements: Button uses asChild here to avoid nesting a native button inside the provider row button. */}
                                            <span
                                                role="button"
                                                tabIndex={0}
                                                aria-label={actionAriaLabel}
                                                data-action={
                                                    actionKind === "retry"
                                                        ? "retry-sync"
                                                        : actionKind
                                                }
                                                data-part="source-provider-action"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    if (
                                                        actionKind === "retry"
                                                    ) {
                                                        void runManualSync();
                                                        return;
                                                    }
                                                    window.localStorage.setItem(
                                                        SETTINGS_DATA_SOURCE_PROVIDER_STORAGE_KEY,
                                                        item.key,
                                                    );
                                                    openSettings(
                                                        "data-sources",
                                                    );
                                                }}
                                                onKeyDown={(event) => {
                                                    if (
                                                        event.key !== "Enter" &&
                                                        event.key !== " "
                                                    ) {
                                                        return;
                                                    }
                                                    event.preventDefault();
                                                    event.stopPropagation();
                                                    if (
                                                        actionKind === "retry"
                                                    ) {
                                                        void runManualSync();
                                                        return;
                                                    }
                                                    window.localStorage.setItem(
                                                        SETTINGS_DATA_SOURCE_PROVIDER_STORAGE_KEY,
                                                        item.key,
                                                    );
                                                    openSettings(
                                                        "data-sources",
                                                    );
                                                }}
                                            >
                                                {actionKind === "retry" ||
                                                actionKind === "reauth" ? (
                                                    <RefreshCw data-icon="inline-start" />
                                                ) : (
                                                    <Plus data-icon="inline-start" />
                                                )}
                                                {actionLabel}
                                            </span>
                                        </Button>
                                    ) : (
                                        <Badge
                                            variant="ghost"
                                            className={cn(
                                                dashboardSourceClassNames.count,
                                                sourceRowCollapsed && "hidden",
                                            )}
                                            data-count={`src:${item.key}`}
                                            data-part="source-provider-count"
                                            data-state={sourceRowState}
                                            data-tone={sourceCountTone}
                                        >
                                            {visibleCount}
                                        </Badge>
                                    )}
                                </Button>
                            );
                        })}
                    </div>
                </nav>

                <div
                    className={DASHBOARD_SIDEBAR_FOOTER_CLASS_NAME}
                    data-part="dashboard-sidebar-footer"
                >
                    <div
                        className="group/dashboard-sync flex items-center gap-2.5 rounded-lg border border-sidebar-border bg-sidebar-accent px-2.5 py-2 text-sidebar-accent-foreground group-data-[sidebar-collapsed=true]/dashboard-workstation:justify-center group-data-[sidebar-collapsed=true]/dashboard-workstation:p-2"
                        data-panel="dashboard-sync"
                        data-state={syncButtonState}
                        data-sync-state={syncButtonState}
                    >
                        <span
                            className="size-2 rounded-full bg-primary group-data-[state=error]/dashboard-sync:bg-destructive group-data-[state=queued]/dashboard-sync:animate-[bpulse_1.4s_ease-in-out_infinite] group-data-[state=running]/dashboard-sync:animate-[bpulse_1.4s_ease-in-out_infinite]"
                            data-part="dashboard-sync-indicator"
                        />
                        <div
                            className={cn(
                                "min-w-0 flex-1",
                                dashboardSidebarCollapseClassNames.hidden,
                            )}
                            data-part="dashboard-sync-text"
                        >
                            <div
                                className="text-xs font-semibold text-sidebar-foreground"
                                data-part="dashboard-sync-title"
                                id="dashboard-sync-title"
                            >
                                {syncStateLabel(syncButtonState, t)} ·
                                BetterAINote
                            </div>
                            <div
                                className="mt-px font-mono text-xs font-medium text-muted-foreground"
                                data-part="dashboard-sync-subtitle"
                                id="dashboard-sync-subtitle"
                            >
                                {syncSummary}
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            className={cn(
                                dashboardButtonClassNames.sync,
                                dashboardSidebarCollapseClassNames.hidden,
                            )}
                            type="button"
                            aria-label="同步"
                            aria-busy={syncButtonBusy}
                            aria-describedby="dashboard-sync-title dashboard-sync-subtitle"
                            disabled={syncButtonBusy}
                            data-control="dashboard-sync"
                            data-state={syncButtonState}
                            onClick={() => void runManualSync()}
                        >
                            <RefreshCw data-icon="inline-start" />
                        </Button>
                    </div>
                </div>
            </aside>

            <div
                className={dashboardDrawerClassNames.scrim}
                data-panel="dashboard-drawer-scrim"
                id="drawer-scrim"
                aria-hidden="true"
            />

            <main
                className={DASHBOARD_MAIN_CLASS_NAME}
                data-panel="dashboard-main"
            >
                <header
                    className={dashboardTopbarClassNames.topbar}
                    data-panel="dashboard-topbar"
                >
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        className={dashboardButtonClassNames.drawerTrigger}
                        data-control="dashboard-drawer-trigger"
                        id="drawer-trigger"
                        type="button"
                        aria-label="打开筛选抽屉"
                        ref={drawerTriggerRef}
                        onClick={() => {
                            setSearchOpen(false);
                            setActivityOpen(false);
                            setDrawerOpen(true);
                        }}
                    >
                        <Menu data-icon="inline-start" />
                        <span
                            className={dashboardDrawerClassNames.activeDot}
                            data-part="dashboard-drawer-active-dot"
                            aria-hidden="true"
                        />
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        className={dashboardButtonClassNames.sidebarCollapse}
                        type="button"
                        aria-label="折叠 / 展开侧边栏"
                        data-control="sidebar-collapse"
                        data-state={collapsed ? "collapsed" : "expanded"}
                        onClick={() => {
                            const nextCollapsed = !collapsed;
                            setCollapsed(nextCollapsed);
                            writeBrowserStorage(
                                DASHBOARD_SIDEBAR_COLLAPSED_STORAGE_KEY,
                                String(nextCollapsed),
                            );
                        }}
                    >
                        <PanelLeft
                            className={cn(
                                "size-[11px] transition-transform duration-300",
                                collapsed && "rotate-180",
                            )}
                            data-icon="inline-start"
                        />
                    </Button>
                    <div
                        className={dashboardTopbarClassNames.crumbs}
                        data-part="dashboard-crumbs"
                    >
                        <span
                            className={dashboardTopbarClassNames.crumb}
                            data-part="dashboard-crumb"
                        >
                            {favorite === "all"
                                ? "全部录音"
                                : favorite === "transcribed"
                                  ? "转写记录"
                                  : "标签"}
                        </span>
                        <span
                            className={dashboardTopbarClassNames.separator}
                            data-part="dashboard-crumb-separator"
                        >
                            /
                        </span>
                        <span
                            className={dashboardTopbarClassNames.current}
                            data-part="dashboard-crumb-current"
                        >
                            {selectedRecording?.filename ?? "未选择录音"}
                        </span>
                    </div>
                    <div
                        className={
                            dashboardSearchActivityClassNames.dashboardTopbarActions
                        }
                        data-part="dashboard-topbar-actions"
                    >
                        <LibrarySearch
                            open={searchOpen}
                            query={query}
                            onApplyFilter={applyLibrarySearchFilter}
                            onOpenChange={handleLibrarySearchOpenChange}
                            onOpenRecording={selectRecording}
                            onQueryChange={setQuery}
                        />
                        <div
                            className={
                                dashboardSearchActivityClassNames.dashboardActivityAnchor
                            }
                            data-part="dashboard-activity-anchor"
                            ref={activityOverlayRef}
                        >
                            <Button
                                ref={activityTriggerRef}
                                variant="ghost"
                                size="icon-sm"
                                className={
                                    dashboardSearchActivityClassNames.dashboardActivityTrigger
                                }
                                type="button"
                                aria-label={t("activityOverlay.open")}
                                aria-expanded={activityOpen}
                                data-unread={String(activityBadgeCount)}
                                data-control="dashboard-activity"
                                data-state={activityOpen ? "open" : "idle"}
                                data-pending-count={String(activityBadgeCount)}
                                onClick={() => {
                                    clearActivityFocusRestoreTimers();
                                    restoreActivityFocusRef.current = false;
                                    setSearchOpen(false);
                                    setMoreOpen(false);
                                    setTagOpen(false);
                                    setAiOpen(false);
                                    setActivityOpen((open) => !open);
                                }}
                            >
                                <Bell data-icon="inline-start" />
                                <Badge
                                    variant="destructive"
                                    className={cn(
                                        dashboardSearchActivityClassNames.dashboardActivityBadge,
                                        activityBadgeCount === 0 && "hidden",
                                    )}
                                    data-part="dashboard-activity-badge"
                                >
                                    {activityBadgeCount > 99
                                        ? "99+"
                                        : activityBadgeCount}
                                </Badge>
                            </Button>
                            {activityOpen ? (
                                <Card
                                    hasNoPadding
                                    variant="default"
                                    className={
                                        dashboardSearchActivityClassNames.dashboardActivityPanel
                                    }
                                    data-open="true"
                                    data-state={activityPanelState}
                                    data-panel="dashboard-activity"
                                    data-item-count={String(
                                        visibleActivityItems.length,
                                    )}
                                    role="dialog"
                                    aria-label={t("activityOverlay.title")}
                                >
                                    <CardHeader
                                        className={
                                            dashboardSearchActivityClassNames.dashboardActivityHeader
                                        }
                                        data-part="dashboard-activity-header"
                                    >
                                        <div
                                            className={
                                                dashboardSearchActivityClassNames.dashboardActivityHeading
                                            }
                                            data-part="dashboard-activity-heading"
                                        >
                                            <CardTitle
                                                className={
                                                    dashboardSearchActivityClassNames.dashboardActivityTitle
                                                }
                                                data-part="dashboard-activity-title"
                                            >
                                                {t("activityOverlay.title")}
                                            </CardTitle>
                                            <Badge
                                                variant="ghost"
                                                className={
                                                    dashboardSearchActivityClassNames.dashboardActivityCount
                                                }
                                                data-part="dashboard-activity-count"
                                            >
                                                {t(
                                                    "activityOverlay.pendingCount",
                                                    {
                                                        count: activityBadgeCount,
                                                    },
                                                )}
                                            </Badge>
                                        </div>
                                        <CardAction data-part="dashboard-activity-header-action">
                                            <Button
                                                variant="ghost"
                                                size="icon-xs"
                                                className={
                                                    dashboardSearchActivityClassNames.dashboardActivityClose
                                                }
                                                type="button"
                                                aria-label={t(
                                                    "activityOverlay.close",
                                                )}
                                                data-control="dashboard-activity-close"
                                                onClick={() =>
                                                    closeActivityOverlay({
                                                        restoreFocus: true,
                                                    })
                                                }
                                            >
                                                <X data-icon="inline-start" />
                                            </Button>
                                        </CardAction>
                                    </CardHeader>
                                    <Separator data-part="dashboard-activity-header-separator" />
                                    <CardContent
                                        className={
                                            dashboardSearchActivityClassNames.dashboardActivityContent
                                        }
                                        data-part="dashboard-activity-content"
                                    >
                                        <div
                                            className={
                                                dashboardSearchActivityClassNames.dashboardActivityStatus
                                            }
                                            data-state={syncButtonState}
                                            data-part="dashboard-activity-status"
                                        >
                                            <span
                                                className={
                                                    dashboardSearchActivityClassNames.dashboardActivityStatusIndicator
                                                }
                                                data-part="dashboard-activity-status-indicator"
                                                data-state={syncButtonState}
                                                aria-hidden="true"
                                            />
                                            <div
                                                className={
                                                    dashboardSearchActivityClassNames.dashboardActivityStatusCopy
                                                }
                                                data-part="dashboard-activity-status-copy"
                                            >
                                                <div
                                                    className={
                                                        dashboardSearchActivityClassNames.dashboardActivityStatusLine
                                                    }
                                                    data-part="dashboard-activity-status-line"
                                                >
                                                    {syncStatusLabel}
                                                </div>
                                                <div
                                                    className={
                                                        dashboardSearchActivityClassNames.dashboardActivityStatusSub
                                                    }
                                                    data-format="mono"
                                                    data-part="dashboard-activity-status-sub"
                                                >
                                                    {syncSummary}
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className={
                                                    dashboardSearchActivityClassNames.dashboardActivitySync
                                                }
                                                type="button"
                                                aria-busy={syncButtonBusy}
                                                disabled={syncButtonBusy}
                                                data-action-state={
                                                    activitySyncActionState
                                                }
                                                data-control="dashboard-activity-sync"
                                                data-state={
                                                    activitySyncActionState
                                                }
                                                onClick={() =>
                                                    void runManualSync()
                                                }
                                            >
                                                {activitySyncActionState ===
                                                "busy"
                                                    ? t(
                                                          "activityOverlay.actions.updatingShort",
                                                      )
                                                    : activitySyncActionState ===
                                                        "done"
                                                      ? t(
                                                            "activityOverlay.actions.queued",
                                                        )
                                                      : t(
                                                            "activityOverlay.actions.update",
                                                        )}
                                            </Button>
                                        </div>
                                        <Separator data-part="dashboard-activity-status-separator" />
                                        {visibleActivityItems.length > 0 ? (
                                            <ul
                                                className={
                                                    dashboardSearchActivityClassNames.dashboardActivityItems
                                                }
                                                data-list="dashboard-activity-items"
                                            >
                                                {visibleActivityItems.map(
                                                    (item) => (
                                                        <li
                                                            className={
                                                                dashboardSearchActivityClassNames.dashboardActivityItem
                                                            }
                                                            data-kind={activityItemKind(
                                                                item,
                                                            )}
                                                            role={
                                                                item.recordingId
                                                                    ? "button"
                                                                    : undefined
                                                            }
                                                            tabIndex={
                                                                item.recordingId
                                                                    ? 0
                                                                    : undefined
                                                            }
                                                            aria-label={t(
                                                                "activityOverlay.itemAria",
                                                                {
                                                                    action: item.action
                                                                        ? item.action ===
                                                                          "settings"
                                                                            ? t(
                                                                                  "activityOverlay.actions.openDataSources",
                                                                              )
                                                                            : item.action ===
                                                                                "recording"
                                                                              ? t(
                                                                                    "activityOverlay.actions.view",
                                                                                )
                                                                              : t(
                                                                                    "activityOverlay.actions.retry",
                                                                                )
                                                                        : t(
                                                                              "activityOverlay.allHandled",
                                                                          ),
                                                                    title: item.title,
                                                                },
                                                            )}
                                                            data-action-state={
                                                                item.action ===
                                                                "sync"
                                                                    ? activitySyncActionState
                                                                    : "idle"
                                                            }
                                                            data-activity-action={
                                                                item.action ??
                                                                "none"
                                                            }
                                                            data-activity-id={
                                                                item.id
                                                            }
                                                            data-clickable={
                                                                item.recordingId
                                                                    ? "true"
                                                                    : "false"
                                                            }
                                                            data-action={
                                                                item.action ??
                                                                "none"
                                                            }
                                                            data-item="dashboard-activity-item"
                                                            data-state={
                                                                item.tone
                                                            }
                                                            data-tone={
                                                                item.tone
                                                            }
                                                            key={item.id}
                                                            onClick={(
                                                                event,
                                                            ) => {
                                                                if (
                                                                    !item.recordingId ||
                                                                    (event.target instanceof
                                                                        HTMLElement &&
                                                                        event.target.closest(
                                                                            "button",
                                                                        ))
                                                                ) {
                                                                    return;
                                                                }
                                                                void runActivityAction(
                                                                    item,
                                                                );
                                                            }}
                                                            onKeyDown={(
                                                                event,
                                                            ) =>
                                                                handleActivityItemKeyDown(
                                                                    event,
                                                                    item,
                                                                )
                                                            }
                                                        >
                                                            <span
                                                                className={
                                                                    dashboardSearchActivityClassNames.dashboardActivityItemIcon
                                                                }
                                                                data-kind={activityItemKind(
                                                                    item,
                                                                )}
                                                                data-part="dashboard-activity-item-icon"
                                                            >
                                                                {item.tone ===
                                                                "success" ? (
                                                                    <CheckCircle aria-hidden="true" />
                                                                ) : item.tone ===
                                                                  "info" ? (
                                                                    <Bell aria-hidden="true" />
                                                                ) : (
                                                                    <AlertCircle aria-hidden="true" />
                                                                )}
                                                            </span>
                                                            <div
                                                                className={
                                                                    dashboardSearchActivityClassNames.dashboardActivityItemCopy
                                                                }
                                                                data-part="dashboard-activity-item-copy"
                                                            >
                                                                <div
                                                                    className={
                                                                        dashboardSearchActivityClassNames.dashboardActivityItemTitle
                                                                    }
                                                                    data-part="dashboard-activity-item-title"
                                                                >
                                                                    {item.title}
                                                                </div>
                                                                <div
                                                                    className={
                                                                        dashboardSearchActivityClassNames.dashboardActivityItemBody
                                                                    }
                                                                    data-part="dashboard-activity-item-body"
                                                                >
                                                                    {item.body}
                                                                </div>
                                                                <div
                                                                    className={
                                                                        dashboardSearchActivityClassNames.dashboardActivityItemMeta
                                                                    }
                                                                    data-part="dashboard-activity-item-meta"
                                                                >
                                                                    {t(
                                                                        "activityOverlay.justNow",
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div
                                                                className={
                                                                    dashboardSearchActivityClassNames.dashboardActivityItemActions
                                                                }
                                                                data-part="dashboard-activity-item-actions"
                                                            >
                                                                {item.action ? (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className={
                                                                            dashboardSearchActivityClassNames.dashboardActivityAction
                                                                        }
                                                                        type="button"
                                                                        data-action-state={
                                                                            item.action ===
                                                                            "sync"
                                                                                ? activitySyncActionState
                                                                                : "idle"
                                                                        }
                                                                        data-control="dashboard-activity-action"
                                                                        data-state={
                                                                            item.action ===
                                                                            "sync"
                                                                                ? activitySyncActionState
                                                                                : "idle"
                                                                        }
                                                                        onClick={() =>
                                                                            void runActivityAction(
                                                                                item,
                                                                            )
                                                                        }
                                                                    >
                                                                        {item.action ===
                                                                        "settings"
                                                                            ? t(
                                                                                  "activityOverlay.actions.openDataSources",
                                                                              )
                                                                            : item.action ===
                                                                                "recording"
                                                                              ? t(
                                                                                    "activityOverlay.actions.view",
                                                                                )
                                                                              : t(
                                                                                    "activityOverlay.actions.retry",
                                                                                )}
                                                                    </Button>
                                                                ) : null}
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon-xs"
                                                                    className={
                                                                        dashboardSearchActivityClassNames.dashboardActivityDismiss
                                                                    }
                                                                    type="button"
                                                                    aria-label={t(
                                                                        "activityOverlay.dismissItem",
                                                                        {
                                                                            title: item.title,
                                                                        },
                                                                    )}
                                                                    data-control="dashboard-activity-dismiss"
                                                                    onClick={() =>
                                                                        setDismissedActivityIds(
                                                                            (
                                                                                current,
                                                                            ) => {
                                                                                const next =
                                                                                    new Set(
                                                                                        current,
                                                                                    );
                                                                                next.add(
                                                                                    item.id,
                                                                                );
                                                                                return next;
                                                                            },
                                                                        )
                                                                    }
                                                                >
                                                                    <X data-icon="inline-start" />
                                                                </Button>
                                                            </div>
                                                        </li>
                                                    ),
                                                )}
                                            </ul>
                                        ) : (
                                            <Empty
                                                data-part="dashboard-activity-empty"
                                                className={
                                                    dashboardSearchActivityClassNames.dashboardActivityEmpty
                                                }
                                            >
                                                <EmptyHeader>
                                                    <EmptyMedia
                                                        data-part="dashboard-activity-empty-icon"
                                                        variant="icon"
                                                        aria-hidden="true"
                                                    >
                                                        <CheckCircle />
                                                    </EmptyMedia>
                                                    <EmptyTitle data-part="dashboard-activity-empty-title">
                                                        {t(
                                                            "activityOverlay.emptyTitle",
                                                        )}
                                                    </EmptyTitle>
                                                    <EmptyDescription data-part="dashboard-activity-empty-body">
                                                        {t(
                                                            "activityOverlay.emptyBody",
                                                        )}
                                                    </EmptyDescription>
                                                </EmptyHeader>
                                            </Empty>
                                        )}
                                    </CardContent>
                                </Card>
                            ) : null}
                        </div>
                        <SettingsDialog
                            open={settingsOpen}
                            user={user}
                            onOpenChange={setSettingsOpen}
                            trigger={
                                <Button
                                    ref={settingsTriggerRef}
                                    type="button"
                                    variant="default"
                                    size="icon"
                                    className={
                                        dashboardButtonClassNames.settingsAvatar
                                    }
                                    aria-label="打开设置"
                                    data-control="dashboard-settings"
                                    data-part="dashboard-user-avatar"
                                    data-state={settingsOpen ? "open" : "idle"}
                                    onClick={() => openSettings("data-sources")}
                                >
                                    {Array.from(getUserDisplayName(user))[0]}
                                </Button>
                            }
                        />
                    </div>
                </header>

                <SystemBanner />

                <div
                    className={DASHBOARD_WORKSPACE_CLASS_NAME}
                    data-panel="dashboard-workspace"
                >
                    <Card
                        hasNoPadding
                        className={DASHBOARD_RECORDING_LIST_CARD_CLASS_NAME}
                        data-current-page={String(currentListPage)}
                        data-list-state={listState}
                        data-list-mode={listMode}
                        data-state={listState}
                        data-surface="dashboard-recording-list"
                        data-total-pages={String(listTotalPages)}
                        data-visible-count={String(filteredRecordings.length)}
                    >
                        <CardContent
                            className={
                                DASHBOARD_RECORDING_LIST_CONTENT_CLASS_NAME
                            }
                            data-part="dashboard-recording-list-content"
                        >
                            <div
                                className={
                                    DASHBOARD_RECORDING_LIST_HEADER_CLASS_NAME
                                }
                                data-part="dashboard-recording-list-header"
                            >
                                <div
                                    className={
                                        dashboardRecordingListTitlebarStyles.root
                                    }
                                    data-part="dashboard-recording-list-titlebar"
                                >
                                    <h2
                                        className={
                                            dashboardRecordingListTitlebarStyles.title
                                        }
                                        data-part="dashboard-recording-list-title"
                                    >
                                        {getFavoriteLabel(favorite, t)}
                                    </h2>
                                    <span
                                        className={
                                            dashboardRecordingListTitlebarStyles.count
                                        }
                                        data-part="dashboard-recording-list-count"
                                    >
                                        {t("recordingList.totalCount", {
                                            count: listEntries.length,
                                        })}
                                        {source !== "all"
                                            ? ` · ${providerLabel(source, language)}`
                                            : ""}
                                    </span>
                                </div>
                                {source !== "all" ? (
                                    <output
                                        aria-live="polite"
                                        className={
                                            sourceFilterStackClassNames.root
                                        }
                                        data-panel="dashboard-source-filter-stack"
                                        data-provider={source}
                                        data-state={sourceFilterStackState}
                                        data-status={
                                            selectedSourceRow?.status ?? ""
                                        }
                                    >
                                        <span
                                            className={
                                                sourceFilterStackClassNames.from
                                            }
                                            data-part="source-filter-from"
                                        >
                                            {t("sourceFilterStack.filter")} ·{" "}
                                            <b
                                                className={
                                                    sourceFilterStackClassNames.strong
                                                }
                                            >
                                                {t(
                                                    "dashboardFavorites.allRecordings",
                                                )}
                                            </b>
                                        </span>
                                        <span
                                            className={
                                                sourceFilterStackClassNames.separator
                                            }
                                            data-part="source-filter-separator"
                                        >
                                            ›
                                        </span>
                                        <Badge
                                            variant="secondary"
                                            className={
                                                sourceFilterStackClassNames.chip
                                            }
                                            data-part="source-filter-chip"
                                        >
                                            <span
                                                className={
                                                    sourceFilterStackClassNames.label
                                                }
                                                data-stack-label
                                            >
                                                {providerLabel(
                                                    source,
                                                    language,
                                                )}
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="icon-xs"
                                                type="button"
                                                className={
                                                    sourceFilterClassNames.clear
                                                }
                                                aria-label={t(
                                                    "sourceFilterStack.clearSourceFilter",
                                                )}
                                                data-control="source-filter-clear"
                                                onClick={() =>
                                                    selectSource("all")
                                                }
                                            >
                                                <X data-icon="inline-start" />
                                            </Button>
                                        </Badge>
                                        <span
                                            className={
                                                sourceFilterStackClassNames.info
                                            }
                                            data-part="source-filter-info"
                                        >
                                            {sourceFilterStackMessage ||
                                                `${t("sourceFilterStack.showing")} `}
                                            {sourceFilterStackMessage ? null : (
                                                <>
                                                    <b
                                                        className={
                                                            sourceFilterStackClassNames.infoStrong
                                                        }
                                                    >
                                                        {
                                                            filteredRecordings.length
                                                        }
                                                    </b>{" "}
                                                    / {liveRecordings.length}
                                                </>
                                            )}
                                        </span>
                                        {sourceFilterStackState ===
                                        "sync-error" ? (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                type="button"
                                                className={
                                                    sourceFilterClassNames.action
                                                }
                                                data-control="source-filter-retry-sync"
                                                data-action="retry"
                                                data-part="source-filter-action"
                                                onClick={() =>
                                                    void runManualSync()
                                                }
                                            >
                                                <RefreshCw data-icon="inline-start" />
                                                {t(
                                                    "sourceFilterStack.retrySync",
                                                )}
                                            </Button>
                                        ) : null}
                                        {sourceFilterStackState ===
                                        "no-results" ? (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                type="button"
                                                className={
                                                    sourceFilterClassNames.action
                                                }
                                                data-control="source-filter-widen"
                                                data-action="widen"
                                                data-part="source-filter-action"
                                                onClick={() => {
                                                    selectFavorite("all");
                                                    applyListMode("timeline");
                                                    setQuery("");
                                                }}
                                            >
                                                {t(
                                                    "sourceFilterStack.widenFilter",
                                                )}
                                            </Button>
                                        ) : null}
                                        {selectedSourceRow &&
                                        sourceNeedsSettings(
                                            selectedSourceRow.status,
                                        ) ? (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                type="button"
                                                className={
                                                    sourceFilterClassNames.action
                                                }
                                                data-control="source-filter-open-settings"
                                                data-action="open-settings"
                                                data-part="source-filter-action"
                                                onClick={() => {
                                                    window.localStorage.setItem(
                                                        SETTINGS_DATA_SOURCE_PROVIDER_STORAGE_KEY,
                                                        selectedSourceRow.key,
                                                    );
                                                    openSettings(
                                                        "data-sources",
                                                    );
                                                }}
                                            >
                                                {t(
                                                    "sourceFilterStack.openSettings",
                                                )}
                                            </Button>
                                        ) : null}
                                        <Button
                                            variant="link"
                                            size="sm"
                                            type="button"
                                            className={
                                                sourceFilterClassNames.clearAll
                                            }
                                            data-control="source-filter-clear-all"
                                            onClick={() => selectSource("all")}
                                        >
                                            {t("sourceFilterStack.clearAll")}
                                        </Button>
                                    </output>
                                ) : null}
                                {librarySearchFilter ? (
                                    <output
                                        aria-live="polite"
                                        className={
                                            sourceFilterStackClassNames.libraryRoot
                                        }
                                        data-panel="dashboard-library-search-filter"
                                        data-filter={librarySearchFilter.type}
                                        data-state="active"
                                    >
                                        <span
                                            className={
                                                sourceFilterStackClassNames.libraryLabel
                                            }
                                            data-part="library-search-filter-label"
                                        >
                                            {librarySearchFilter.type === "tag"
                                                ? t(
                                                      "dashboardFavorites.tagFilter",
                                                  )
                                                : t(
                                                      "dashboardFavorites.speakerFilter",
                                                  )}
                                        </span>
                                        <Badge
                                            variant="secondary"
                                            className={
                                                sourceFilterStackClassNames.chip
                                            }
                                            data-part="library-search-filter-chip"
                                        >
                                            <span
                                                className={
                                                    sourceFilterStackClassNames.label
                                                }
                                                data-stack-label
                                            >
                                                {librarySearchFilter.label}
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="icon-xs"
                                                type="button"
                                                className={
                                                    sourceFilterClassNames.librarySearchFilterClear
                                                }
                                                aria-label={t(
                                                    "dashboardChrome.clear",
                                                )}
                                                data-control="library-search-filter-clear"
                                                onClick={() =>
                                                    setLibrarySearchFilter(null)
                                                }
                                            >
                                                <X data-icon="inline-start" />
                                            </Button>
                                        </Badge>
                                    </output>
                                ) : null}
                                <RecordingListControls
                                    language={language}
                                    listMode={listMode}
                                    onListModeChange={applyListMode}
                                    onTagFilterChange={selectTagFilter}
                                    onTagFilterOpenChange={setTagFilterOpen}
                                    onTimelineFilterChange={setTimelineFilter}
                                    selectedTagFilter={selectedTagFilter}
                                    tagFilterOpen={tagFilterOpen}
                                    tagFilterOptions={tagFilterOptions}
                                    tagFilterRef={tagFilterRef}
                                    timelineCounts={timelineCounts}
                                    timelineFilter={timelineFilter}
                                    visibleCount={filteredRecordings.length}
                                />
                            </div>
                            <div
                                className={
                                    dashboardRecordingListScrollClassName
                                }
                                data-list="dashboard-recording-list-scroll"
                            >
                                {listState === "loading" ? (
                                    <RecordingListSkeleton />
                                ) : listState === "ready" ? (
                                    <RecordingList
                                        dateTimeFormat={
                                            displaySettings.dateTimeFormat
                                        }
                                        groups={recordingListGroups}
                                        language={language}
                                        onRowRef={(recordingId, node) => {
                                            if (node) {
                                                recordingRowRefs.current.set(
                                                    recordingId,
                                                    node,
                                                );
                                            } else {
                                                recordingRowRefs.current.delete(
                                                    recordingId,
                                                );
                                            }
                                        }}
                                        onSelect={selectRecording}
                                        selectedId={selectedRecordingId}
                                    />
                                ) : (
                                    <Empty
                                        variant="compact"
                                        className={
                                            dashboardRecordingListStateStyles.root
                                        }
                                        data-list-state-block={listState}
                                        data-part="recording-list-state"
                                        data-state={listState}
                                    >
                                        <EmptyHeader>
                                            <EmptyMedia
                                                variant="subtleIcon"
                                                data-part="recording-list-state-icon"
                                            >
                                                <FileText />
                                            </EmptyMedia>
                                            <EmptyTitle
                                                variant="compact"
                                                data-part="recording-list-state-title"
                                            >
                                                {listState === "empty"
                                                    ? t(
                                                          "recordingList.emptyTitle",
                                                      )
                                                    : listState === "error"
                                                      ? t(
                                                            "recordingList.errorTitle",
                                                        )
                                                      : listState ===
                                                          "timeline-empty"
                                                        ? t(
                                                              "recordingList.timelineEmptyTitle",
                                                          )
                                                        : listState ===
                                                            "tag-empty"
                                                          ? t(
                                                                "recordingList.tagEmptyTitle",
                                                            )
                                                          : t(
                                                                "recordingList.noMatchTitle",
                                                            )}
                                            </EmptyTitle>
                                            <EmptyDescription
                                                variant="compact"
                                                data-part="recording-list-state-description"
                                            >
                                                {listState === "empty"
                                                    ? t(
                                                          "recordingList.emptyDescription",
                                                      )
                                                    : listState === "error"
                                                      ? t(
                                                            "recordingList.errorDescription",
                                                        )
                                                      : listState ===
                                                          "timeline-empty"
                                                        ? t(
                                                              "recordingList.timelineEmptyDescription",
                                                          )
                                                        : listState ===
                                                            "tag-empty"
                                                          ? t(
                                                                "recordingList.tagEmptyDescription",
                                                            )
                                                          : t(
                                                                "recordingList.noMatchDescription",
                                                            )}
                                            </EmptyDescription>
                                        </EmptyHeader>
                                        <EmptyContent
                                            className={
                                                dashboardRecordingListStateStyles.content
                                            }
                                        >
                                            {listState === "empty" ? (
                                                <Button
                                                    variant="default"
                                                    size="sm"
                                                    type="button"
                                                    data-control="recording-list-open-data-sources"
                                                    onClick={() =>
                                                        openSettings(
                                                            "data-sources",
                                                        )
                                                    }
                                                >
                                                    {t(
                                                        "recordingList.openDataSources",
                                                    )}
                                                </Button>
                                            ) : null}
                                            {listState === "no-match" ? (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    type="button"
                                                    data-control="recording-list-clear-filters"
                                                    onClick={() => {
                                                        selectFavorite("all");
                                                        selectSource("all");
                                                        setQuery("");
                                                        setLibrarySearchFilter(
                                                            null,
                                                        );
                                                        setTimelineFilter(
                                                            "all",
                                                        );
                                                        selectTagFilter("all");
                                                    }}
                                                >
                                                    {t(
                                                        "recordingList.clearFilters",
                                                    )}
                                                </Button>
                                            ) : null}
                                            {listState === "error" ? (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    type="button"
                                                    data-control="recording-list-retry"
                                                    onClick={() =>
                                                        setRecordingListRequestVersion(
                                                            (version) =>
                                                                version + 1,
                                                        )
                                                    }
                                                >
                                                    {t("recordingList.retry")}
                                                </Button>
                                            ) : null}
                                            {listState === "timeline-empty" ? (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    type="button"
                                                    data-control="recording-list-clear-timeline"
                                                    onClick={() =>
                                                        setTimelineFilter("all")
                                                    }
                                                >
                                                    {t(
                                                        "recordingList.clearTimeline",
                                                    )}
                                                </Button>
                                            ) : null}
                                            {listState === "tag-empty" ? (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    type="button"
                                                    data-control="recording-list-clear-tag"
                                                    onClick={() => {
                                                        selectFavorite("all");
                                                        selectTagFilter("all");
                                                    }}
                                                >
                                                    {t(
                                                        "recordingList.clearTag",
                                                    )}
                                                </Button>
                                            ) : null}
                                        </EmptyContent>
                                    </Empty>
                                )}
                                {listState === "ready" && listTotalPages > 1 ? (
                                    <RecordingListPagination
                                        currentPage={currentListPage}
                                        language={language}
                                        loaded={listLoadedCount}
                                        onNext={() =>
                                            selectListPage(currentListPage + 1)
                                        }
                                        onPrevious={() =>
                                            selectListPage(currentListPage - 1)
                                        }
                                        total={recordingPage.total}
                                        totalPages={listTotalPages}
                                    />
                                ) : null}
                            </div>
                        </CardContent>
                    </Card>

                    <button
                        aria-label={
                            language === "zh-CN"
                                ? "关闭录音详情"
                                : "Close recording details"
                        }
                        className={DASHBOARD_DETAIL_SCRIM_CLASS_NAME}
                        data-control="dashboard-detail-scrim"
                        onClick={() => closeRecordingDetail()}
                        tabIndex={-1}
                        type="button"
                    />
                    <section
                        className={DASHBOARD_DETAIL_PANEL_CLASS_NAME}
                        data-panel="dashboard-detail"
                        data-empty={selectedRecording ? "false" : "true"}
                        ref={detailPanelRef}
                        tabIndex={-1}
                    >
                        {selectedRecording ? (
                            <>
                                <CardHeader
                                    className="relative flex flex-row items-center gap-2.5 px-1 pt-1 pb-0 data-[rename-mode=saving]:py-0"
                                    data-panel="dashboard-detail-header"
                                    data-mode={dashboardDetailHeaderMode}
                                    data-state={dashboardDetailHeaderState}
                                    data-rename-mode={
                                        dashboardDetailHeaderState
                                    }
                                    data-local-only={
                                        localDeleteAvailable ? "true" : "false"
                                    }
                                >
                                    <Button
                                        aria-label={
                                            language === "zh-CN"
                                                ? "关闭录音详情"
                                                : "Close recording details"
                                        }
                                        className="hidden min-[1024px]:max-[1439px]:inline-flex"
                                        data-control="dashboard-detail-close"
                                        onClick={() => closeRecordingDetail()}
                                        ref={detailCloseRef}
                                        size="icon-sm"
                                        type="button"
                                        variant="ghost"
                                    >
                                        <X aria-hidden="true" />
                                    </Button>
                                    <Button
                                        aria-label={
                                            language === "zh-CN"
                                                ? "返回录音列表"
                                                : "Back to recordings"
                                        }
                                        className="hidden max-[1024px]:inline-flex"
                                        data-control="dashboard-detail-back"
                                        onClick={() => closeRecordingDetail()}
                                        ref={detailBackRef}
                                        size="icon-sm"
                                        type="button"
                                        variant="ghost"
                                    >
                                        <X aria-hidden="true" />
                                    </Button>
                                    {dashboardDetailHeaderState === "normal" ? (
                                        <CardTitle
                                            className="m-0 min-w-0 flex-1 truncate font-display text-[22px] font-semibold leading-normal tracking-[-0.014em] text-foreground"
                                            data-part="detail-header-title"
                                            data-rh-title
                                            role="heading"
                                            aria-level={2}
                                        >
                                            {selectedRecording?.filename ??
                                                "未选择录音"}
                                        </CardTitle>
                                    ) : null}
                                    {dashboardDetailHeaderState === "normal" &&
                                    localDeleteAvailable ? (
                                        <Badge
                                            variant="outline"
                                            className="ml-1 shrink-0"
                                            data-part="detail-header-local-badge"
                                            data-rh-local
                                            aria-label="仅存在本地副本"
                                        >
                                            本地副本
                                        </Badge>
                                    ) : null}
                                    {dashboardDetailHeaderState ===
                                    "editing" ? (
                                        <Input
                                            type="text"
                                            className="h-8 min-w-0 flex-1 px-3 py-1 text-base md:text-sm"
                                            data-rh-input
                                            data-part="detail-header-title-input"
                                            data-state="editing"
                                            value={draftTitle}
                                            aria-label="录音标题"
                                            maxLength={120}
                                            onChange={(event) =>
                                                setDraftTitle(
                                                    event.target.value,
                                                )
                                            }
                                            onKeyDown={(event) => {
                                                if (event.key === "Enter") {
                                                    void renameRecording();
                                                }
                                                if (event.key === "Escape") {
                                                    setEditingTitle(false);
                                                    setDraftTitle(
                                                        selectedRecording?.filename ??
                                                            "",
                                                    );
                                                }
                                            }}
                                        />
                                    ) : null}
                                    {dashboardDetailHeaderState === "saving" ? (
                                        <Badge
                                            variant="ghost"
                                            className="ml-1 shrink-0"
                                            data-part="detail-header-title-status"
                                            data-state="saving"
                                            data-rh-status
                                            aria-busy={renaming}
                                            aria-live="polite"
                                        >
                                            正在保存…
                                        </Badge>
                                    ) : null}
                                    {dashboardDetailHeaderState === "normal" ? (
                                        <Button
                                            variant="ghost"
                                            size="icon-sm"
                                            className={
                                                dashboardButtonClassNames.headerIconButton
                                            }
                                            type="button"
                                            aria-label="重命名"
                                            title="重命名"
                                            data-rh-edit-start
                                            data-control="rename-recording-title"
                                            data-part="detail-header-action"
                                            data-mode="normal"
                                            disabled={!selectedRecording}
                                            onClick={() =>
                                                setEditingTitle(true)
                                            }
                                        >
                                            <Pencil data-icon="inline-start" />
                                        </Button>
                                    ) : null}
                                    {dashboardDetailHeaderState === "normal" ? (
                                        <div
                                            className="relative inline-flex items-center gap-1.5"
                                            data-rh-ai-anchor
                                            data-part="detail-header-action-anchor"
                                            data-mode="normal"
                                        >
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className={
                                                    dashboardButtonClassNames.headerActionButton
                                                }
                                                type="button"
                                                aria-haspopup="dialog"
                                                aria-expanded={aiOpen}
                                                data-rh-ai-trigger
                                                data-control="ai-rename"
                                                data-part="detail-header-action"
                                                data-mode="normal"
                                                data-state={
                                                    aiUnavailableReason
                                                        ? "unavailable"
                                                        : aiOpen
                                                          ? aiState
                                                          : "idle"
                                                }
                                                title={
                                                    aiUnavailableReason ||
                                                    undefined
                                                }
                                                onClick={() =>
                                                    void previewAutoRename()
                                                }
                                            >
                                                <Sparkle data-icon="inline-start" />
                                                AI 重命名
                                            </Button>
                                            {aiOpen && selectedRecording ? (
                                                <AiRenamePreview
                                                    className="right-px"
                                                    applyLabel="应用"
                                                    bodyLabel="建议标题"
                                                    cancelLabel="取消"
                                                    closeLabel="关闭预览"
                                                    filename={aiPreviewTitle}
                                                    hint={
                                                        aiState ===
                                                        "unavailable"
                                                            ? aiUnavailableHint
                                                            : null
                                                    }
                                                    isApplying={aiApplying}
                                                    isRegenerating={
                                                        aiState === "loading"
                                                    }
                                                    message={
                                                        aiState === "loading"
                                                            ? "正在根据转写生成标题…"
                                                            : aiState ===
                                                                "review"
                                                              ? "确认无误后点击「应用」，将替换录音标题且不可一键撤销。"
                                                              : aiError
                                                    }
                                                    onApply={applyAiRename}
                                                    onCancel={() => {
                                                        setAiOpen(false);
                                                        setAiApplying(false);
                                                    }}
                                                    onRegenerate={
                                                        previewAutoRename
                                                    }
                                                    originalFilename={
                                                        selectedRecording.filename
                                                    }
                                                    regenerateLabel={
                                                        aiState === "error"
                                                            ? "重试"
                                                            : aiState ===
                                                                "loading"
                                                              ? "生成中…"
                                                              : "重新生成"
                                                    }
                                                    state={aiState}
                                                    subtitle="仅本次预览，不会写回来源"
                                                    title="AI 标题预览"
                                                />
                                            ) : null}
                                        </div>
                                    ) : null}
                                    {dashboardDetailHeaderState ===
                                    "editing" ? (
                                        <>
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                className={
                                                    dashboardButtonClassNames.headerIconButton
                                                }
                                                type="button"
                                                aria-label="保存新标题"
                                                title="保存"
                                                data-rh-edit-save
                                                data-control="save-recording-title"
                                                data-part="detail-header-action"
                                                data-mode="editing"
                                                disabled={renaming}
                                                onClick={() =>
                                                    void renameRecording()
                                                }
                                            >
                                                <Check data-icon="inline-start" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                className={
                                                    dashboardButtonClassNames.headerIconButton
                                                }
                                                type="button"
                                                aria-label="取消重命名"
                                                title="取消"
                                                data-rh-edit-cancel
                                                data-control="cancel-recording-title"
                                                data-part="detail-header-action"
                                                data-mode="editing"
                                                onClick={() => {
                                                    setEditingTitle(false);
                                                    setDraftTitle(
                                                        selectedRecording?.filename ??
                                                            "",
                                                    );
                                                }}
                                            >
                                                <X data-icon="inline-start" />
                                            </Button>
                                        </>
                                    ) : null}
                                    {dashboardDetailHeaderState === "normal" ? (
                                        <div
                                            className="relative inline-flex items-center gap-1.5"
                                            data-part="detail-header-action-anchor"
                                            data-mode="normal"
                                        >
                                            <DropdownMenu
                                                modal={false}
                                                open={moreOpen}
                                                onOpenChange={(open) => {
                                                    setMoreOpen(open);
                                                    if (!open) return;
                                                    setSearchOpen(false);
                                                    setActivityOpen(false);
                                                    setTagOpen(false);
                                                    setAiOpen(false);
                                                }}
                                            >
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon-sm"
                                                        className={
                                                            dashboardButtonClassNames.headerIconButton
                                                        }
                                                        type="button"
                                                        aria-label="更多操作"
                                                        aria-haspopup="menu"
                                                        aria-expanded={moreOpen}
                                                        data-control="recording-more-actions"
                                                        data-part="detail-header-action"
                                                        data-mode="normal"
                                                        ref={moreTriggerRef}
                                                    >
                                                        <EllipsisVertical data-icon="inline-start" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent
                                                    align="end"
                                                    sideOffset={6}
                                                    variant="glass"
                                                    data-menu="recording-more-actions"
                                                    data-open="true"
                                                    data-local-delete-available={
                                                        localDeleteAvailable
                                                            ? "true"
                                                            : "false"
                                                    }
                                                    data-state={
                                                        moreActionsState
                                                    }
                                                    aria-label="更多操作"
                                                >
                                                    <DropdownMenuGroup>
                                                        <DropdownMenuItem
                                                            density="compact"
                                                            data-menu-item="rename"
                                                            disabled={
                                                                !selectedRecording
                                                            }
                                                            onSelect={() => {
                                                                setMoreOpen(
                                                                    false,
                                                                );
                                                                setAiOpen(
                                                                    false,
                                                                );
                                                                setTagOpen(
                                                                    false,
                                                                );
                                                                setEditingTitle(
                                                                    true,
                                                                );
                                                                setDraftTitle(
                                                                    selectedRecording?.filename ??
                                                                        "",
                                                                );
                                                            }}
                                                        >
                                                            {moreActionsShowPrimaryIcons ? (
                                                                <Pencil
                                                                    data-icon="inline-start"
                                                                    aria-hidden="true"
                                                                    focusable="false"
                                                                />
                                                            ) : null}
                                                            重命名
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            density="compact"
                                                            data-menu-item="ai-rename"
                                                            disabled={
                                                                !selectedRecording
                                                            }
                                                            onSelect={() => {
                                                                setMoreOpen(
                                                                    false,
                                                                );
                                                                void previewAutoRename();
                                                            }}
                                                        >
                                                            {moreActionsShowPrimaryIcons ? (
                                                                <Sparkle
                                                                    data-icon="inline-start"
                                                                    aria-hidden="true"
                                                                    focusable="false"
                                                                />
                                                            ) : null}
                                                            AI 重命名
                                                        </DropdownMenuItem>
                                                        {moreActionsShowRetranscribe ? (
                                                            <DropdownMenuItem
                                                                density="compact"
                                                                data-menu-item="retranscribe"
                                                                disabled={
                                                                    !selectedRecording
                                                                }
                                                                onSelect={() => {
                                                                    setMoreOpen(
                                                                        false,
                                                                    );
                                                                    void retranscribe();
                                                                }}
                                                            >
                                                                {moreActionsShowPrimaryIcons ? (
                                                                    <RefreshCw
                                                                        data-icon="inline-start"
                                                                        aria-hidden="true"
                                                                        focusable="false"
                                                                    />
                                                                ) : null}
                                                                重新转写
                                                            </DropdownMenuItem>
                                                        ) : null}
                                                        {moreActionsShowSeparator ? (
                                                            <DropdownMenuSeparator
                                                                density="compact"
                                                                data-menu-separator="delete"
                                                            />
                                                        ) : null}
                                                        <DropdownMenuItem
                                                            density="compact"
                                                            variant="destructive"
                                                            data-menu-item="delete-local"
                                                            data-tone="danger"
                                                            disabled={
                                                                !localDeleteAvailable
                                                            }
                                                            aria-disabled={
                                                                !localDeleteAvailable
                                                            }
                                                            onSelect={() =>
                                                                void deleteRecording()
                                                            }
                                                        >
                                                            {moreActionsShowDeleteIcon ? (
                                                                <Trash2
                                                                    data-icon="inline-start"
                                                                    aria-hidden="true"
                                                                    focusable="false"
                                                                />
                                                            ) : null}
                                                            删除本地副本
                                                            {selectedRecording?.sourceProvider ? (
                                                                <DropdownMenuShortcut
                                                                    variant="hint"
                                                                    className={
                                                                        localDeleteAvailable
                                                                            ? undefined
                                                                            : "mr-[0.5px]"
                                                                    }
                                                                    data-menu-hint=""
                                                                >
                                                                    {selectedRecording.upstreamDeleted
                                                                        ? "上游已删除"
                                                                        : "来源持有正本"}
                                                                </DropdownMenuShortcut>
                                                            ) : null}
                                                        </DropdownMenuItem>
                                                    </DropdownMenuGroup>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    ) : null}
                                </CardHeader>

                                <Card
                                    hasNoPadding
                                    className="block min-h-[114px] gap-0 overflow-visible rounded-2xl px-[18px] py-4 shadow-none"
                                    data-no-audio={
                                        playbackDisabled ? "true" : undefined
                                    }
                                    data-playing={
                                        isPlaying ? "true" : undefined
                                    }
                                    data-state={
                                        playbackDisabled ? "disabled" : "ready"
                                    }
                                    data-surface="dashboard-recording-player"
                                >
                                    <PlayerNoAudioAlert
                                        part="dashboard-recording-player-no-audio"
                                        iconPart="dashboard-recording-player-no-audio-icon"
                                        textPart="dashboard-recording-player-no-audio-text"
                                        titlePart="dashboard-recording-player-no-audio-title"
                                        descriptionPart="dashboard-recording-player-no-audio-description"
                                        playbackDisabled={playbackDisabled}
                                    />
                                    <CardHeader
                                        className="mb-3 flex flex-row flex-wrap items-center gap-2.5 p-0"
                                        data-part="dashboard-recording-player-meta"
                                    >
                                        <span
                                            className="translate-y-px font-mono text-[11.5px] font-medium tracking-[0.02em] text-muted-foreground"
                                            data-part="dashboard-recording-player-date"
                                            suppressHydrationWarning
                                        >
                                            {selectedRecording
                                                ? formatPlayerDate(
                                                      selectedRecording.startTime,
                                                  )
                                                : "未选择录音"}
                                        </span>
                                        {selectedRecording ? (
                                            <PlayerSourceTag
                                                label={providerLabel(
                                                    selectedRecording.sourceProvider,
                                                    language,
                                                )}
                                                provider={
                                                    selectedRecording.sourceProvider
                                                }
                                            />
                                        ) : null}
                                        {selectedRecording ? (
                                            <PlayerTagChip
                                                count={
                                                    selectedRecording.tags
                                                        .length
                                                }
                                                onClick={() => {
                                                    setSearchOpen(false);
                                                    setActivityOpen(false);
                                                    setMoreOpen(false);
                                                    setAiOpen(false);
                                                    setTagOpen((open) => !open);
                                                }}
                                                state={
                                                    tagOpen ? "open" : "idle"
                                                }
                                                tag={selectedPlayerTag}
                                                trigger
                                            />
                                        ) : null}
                                        {tagOpen && selectedRecording ? (
                                            <RecordingTagManager
                                                recording={selectedRecording}
                                                availableTags={availableTags}
                                                loadError={tagLoadError || null}
                                                onAvailableTagsChange={
                                                    setAvailableTags
                                                }
                                                onRecordingTagsChange={
                                                    applyDashboardRecordingTags
                                                }
                                                onClose={() =>
                                                    setTagOpen(false)
                                                }
                                            />
                                        ) : null}
                                        {selectedPlayerStatus ? (
                                            <PlayerStatusBadge
                                                label={
                                                    selectedPlayerStatus.label
                                                }
                                                tone={selectedPlayerStatus.tone}
                                                className="ml-auto"
                                            />
                                        ) : null}
                                    </CardHeader>
                                    <DashboardRecordingPlayerControls
                                        currentTime={currentTime}
                                        duration={playerDurationValue}
                                        isPlaying={isPlaying}
                                        onCyclePlaybackSpeed={
                                            cyclePlaybackSpeed
                                        }
                                        onSeekBySeconds={
                                            seekDashboardPlayerBySeconds
                                        }
                                        onSeekToPercent={
                                            seekDashboardPlayerToPercent
                                        }
                                        onTogglePlayPause={togglePlayPause}
                                        onVolumeChange={setVolume}
                                        onVolumeOpenChange={setVolumeOpen}
                                        playbackDisabled={playbackDisabled}
                                        playbackSpeedLabel={playbackSpeedLabel}
                                        progress={progress}
                                        volume={volume}
                                        volumePopoverOpen={volumePopoverOpen}
                                    />
                                    {audioSrc ? (
                                        <audio ref={audioRef} src={audioSrc}>
                                            <track kind="captions" />
                                        </audio>
                                    ) : null}
                                </Card>

                                <TranscriptionPanel
                                    key={selectedRecording?.id ?? "none"}
                                    recording={selectedRecording}
                                    activeTab={detailTab}
                                    onActiveTabChange={(value) => {
                                        setDetailTab(value);
                                        setAiOpen(false);
                                        setTagOpen(false);
                                        setMoreOpen(false);
                                        setSearchOpen(false);
                                        setActivityOpen(false);
                                    }}
                                    turns={turns}
                                    isTranscriptLoading={isTranscriptLoading}
                                    transcriptError={transcriptLoadError}
                                    onRetryTranscript={async () => {
                                        if (selectedRecordingId) {
                                            await loadRecordingTranscription(
                                                selectedRecordingId,
                                            );
                                        }
                                    }}
                                    transcriptLanguage={
                                        selectedTranscription?.language
                                    }
                                    localCopyState={localTranscriptCopyState}
                                    isCopyingLocal={
                                        copyingAction === "local-transcript"
                                    }
                                    localCopyFeedback={
                                        copyFeedback?.action ===
                                        "local-transcript"
                                            ? copyFeedback.state
                                            : null
                                    }
                                    onCopyLocal={handleCopyLocalTranscript}
                                    retranscription={{
                                        state: dashboardRetxState,
                                        title: dashboardRetxTitle,
                                        description: dashboardRetxSub,
                                        disabled:
                                            !selectedRecording ||
                                            !selectedRecording.audioUrl,
                                        disabledReason:
                                            "当前来源不支持私有重转写",
                                        onRequest: retranscribe,
                                        onRetry: retranscribe,
                                        onDismiss: () => {
                                            if (
                                                dashboardRetxState ===
                                                    "completed" &&
                                                selectedRecording
                                            ) {
                                                setDismissedCompletedRetxIds(
                                                    (items) =>
                                                        new Set(items).add(
                                                            selectedRecording.id,
                                                        ),
                                                );
                                            }
                                            setRetxState("idle");
                                        },
                                    }}
                                    speakers={speakers}
                                    speakerMerge={{
                                        state: speakerMergeState.state,
                                        error: speakerMergeState.error,
                                        onMerge: mergeDashboardSpeakers,
                                        onRetry: retryDashboardSpeakerMerge,
                                    }}
                                    sourceActions={
                                        <>
                                            <SourceReportCopyButton
                                                type="button"
                                                copy="source-transcript"
                                                copyState={
                                                    sourceTranscriptCopyState
                                                }
                                                feedbackState={
                                                    copyFeedback?.action ===
                                                    "source-transcript"
                                                        ? copyFeedback.state
                                                        : undefined
                                                }
                                                aria-busy={
                                                    copyingAction ===
                                                    "source-transcript"
                                                }
                                                aria-disabled={
                                                    sourceTranscriptCopyDisabled
                                                        ? "true"
                                                        : "false"
                                                }
                                                aria-label={t(
                                                    "sourceReport.copySourceTranscript",
                                                )}
                                                aria-live={
                                                    copyFeedback?.action ===
                                                    "source-transcript"
                                                        ? "polite"
                                                        : undefined
                                                }
                                                disabled={
                                                    sourceTranscriptCopyDisabled
                                                }
                                                hidden={detailTab !== "source"}
                                                onClick={() =>
                                                    void handleCopySourceMaterial(
                                                        "source-transcript",
                                                    )
                                                }
                                            >
                                                <SourceReportCopyIcon
                                                    state={
                                                        copyFeedback?.action ===
                                                        "source-transcript"
                                                            ? copyFeedback.state
                                                            : undefined
                                                    }
                                                />
                                                <SourceReportCopyLabel>
                                                    {copyFeedback?.action ===
                                                    "source-transcript"
                                                        ? copyFeedback.state ===
                                                          "ok"
                                                            ? t("common.copied")
                                                            : t(
                                                                  "common.copyFailedShort",
                                                              )
                                                        : t(
                                                              "sourceReport.copySourceTranscript",
                                                          )}
                                                </SourceReportCopyLabel>
                                            </SourceReportCopyButton>
                                            <SourceReportCopyButton
                                                type="button"
                                                copy="source-report"
                                                copyState={
                                                    sourceReportCopyState
                                                }
                                                feedbackState={
                                                    copyFeedback?.action ===
                                                    "source-report"
                                                        ? copyFeedback.state
                                                        : undefined
                                                }
                                                aria-busy={
                                                    copyingAction ===
                                                    "source-report"
                                                }
                                                aria-disabled={
                                                    sourceReportCopyDisabled
                                                        ? "true"
                                                        : "false"
                                                }
                                                aria-label={t(
                                                    "sourceReport.copySourceReport",
                                                )}
                                                aria-live={
                                                    copyFeedback?.action ===
                                                    "source-report"
                                                        ? "polite"
                                                        : undefined
                                                }
                                                disabled={
                                                    sourceReportCopyDisabled
                                                }
                                                hidden={detailTab !== "source"}
                                                onClick={() =>
                                                    void handleCopySourceMaterial(
                                                        "source-report",
                                                    )
                                                }
                                            >
                                                <SourceReportCopyIcon
                                                    state={
                                                        copyFeedback?.action ===
                                                        "source-report"
                                                            ? copyFeedback.state
                                                            : undefined
                                                    }
                                                />
                                                <SourceReportCopyLabel>
                                                    {copyFeedback?.action ===
                                                    "source-report"
                                                        ? copyFeedback.state ===
                                                          "ok"
                                                            ? t("common.copied")
                                                            : t(
                                                                  "common.copyFailedShort",
                                                              )
                                                        : t(
                                                              "sourceReport.copySourceReport",
                                                          )}
                                                </SourceReportCopyLabel>
                                            </SourceReportCopyButton>
                                            {detailTab === "source" ? (
                                                <SourceReportActionButton
                                                    intent="outline"
                                                    type="button"
                                                    testId="source-report-refresh"
                                                    state={sourceReportState}
                                                    disabled={
                                                        sourceReportState ===
                                                        "loading"
                                                    }
                                                    onClick={() =>
                                                        void loadSourceReport()
                                                    }
                                                >
                                                    <CloudDownload data-icon="inline-start" />
                                                    {sourceReportState ===
                                                    "loading"
                                                        ? t(
                                                              "sourceReport.loadingDetail",
                                                          )
                                                        : t(
                                                              "sourceReport.refresh",
                                                          )}
                                                </SourceReportActionButton>
                                            ) : null}
                                        </>
                                    }
                                    sourcePane={
                                        <SourceReportPane
                                            surface="dashboard"
                                            className={
                                                dashboardTabPaneHiddenClassName
                                            }
                                            state={sourceReportVisualState}
                                            hidden={detailTab !== "source"}
                                        >
                                            {sourceReportState === "loading" ? (
                                                <DashboardSourceReportState state="loading">
                                                    <SourceReportMetricCards>
                                                        <SourceReportMetricCard
                                                            label="来源"
                                                            metric="source"
                                                            value="skeleton"
                                                        >
                                                            <SourceReportCardSkeleton size="source" />
                                                        </SourceReportMetricCard>
                                                        <SourceReportMetricCard
                                                            label="转写状态"
                                                            metric="transcript-status"
                                                            value="skeleton"
                                                        >
                                                            <SourceReportCardSkeleton size="status" />
                                                        </SourceReportMetricCard>
                                                        <SourceReportMetricCard
                                                            label="摘要状态"
                                                            metric="summary-status"
                                                            value="skeleton"
                                                        >
                                                            <SourceReportCardSkeleton size="status" />
                                                        </SourceReportMetricCard>
                                                        <SourceReportMetricCard
                                                            label="分段数"
                                                            metric="segment-count"
                                                            value="skeleton"
                                                        >
                                                            <SourceReportCardSkeleton size="count" />
                                                        </SourceReportMetricCard>
                                                    </SourceReportMetricCards>
                                                    <SourceReportSection
                                                        section="transcript"
                                                        title="来源转写"
                                                        description={
                                                            <>
                                                                正在从
                                                                {
                                                                    sourceReportProviderSentenceName
                                                                }
                                                                读取…
                                                            </>
                                                        }
                                                    >
                                                        <SourceReportSegmentSkeletonBlock>
                                                            <SourceReportSegmentSkeleton size="time" />
                                                            <SourceReportSegmentSkeleton size="speaker" />
                                                            <SourceReportSegmentSkeleton size="line-long" />
                                                            <SourceReportSegmentSkeleton size="line-medium" />
                                                        </SourceReportSegmentSkeletonBlock>
                                                        <SourceReportSegmentSkeletonBlock>
                                                            <SourceReportSegmentSkeleton size="time" />
                                                            <SourceReportSegmentSkeleton size="speaker" />
                                                            <SourceReportSegmentSkeleton size="line-wide" />
                                                            <SourceReportSegmentSkeleton size="line-short" />
                                                        </SourceReportSegmentSkeletonBlock>
                                                    </SourceReportSection>
                                                </DashboardSourceReportState>
                                            ) : sourceReportState ===
                                              "error" ? (
                                                <DashboardSourceReportState state="error">
                                                    <SourceReportEmptySurface
                                                        kind="alert"
                                                        tone="danger"
                                                    >
                                                        <SourceReportEmptyIcon tone="danger">
                                                            <SourceReportErrorGlyph />
                                                        </SourceReportEmptyIcon>
                                                        <SourceReportEmptyTitle kind="alert">
                                                            无法读取来源详情
                                                        </SourceReportEmptyTitle>
                                                        <SourceReportEmptyDescription kind="alert">
                                                            {
                                                                sourceReportProviderSentenceName
                                                            }
                                                            返回了一个错误，可能是网络抖动或来源临时不可用。
                                                        </SourceReportEmptyDescription>
                                                        <SourceReportActionRow
                                                            purpose="empty"
                                                            align="center"
                                                        >
                                                            <SourceReportActionButton
                                                                intent="primary"
                                                                type="button"
                                                                testId="source-report-refresh"
                                                                state="error"
                                                                onClick={() =>
                                                                    void loadSourceReport()
                                                                }
                                                            >
                                                                重试
                                                            </SourceReportActionButton>
                                                            <SourceReportActionButton
                                                                intent="ghost"
                                                                type="button"
                                                                testId="source-report-activity-log"
                                                                state="error"
                                                                onClick={() => {
                                                                    setSearchOpen(
                                                                        false,
                                                                    );
                                                                    setMoreOpen(
                                                                        false,
                                                                    );
                                                                    setTagOpen(
                                                                        false,
                                                                    );
                                                                    setAiOpen(
                                                                        false,
                                                                    );
                                                                    setActivityOpen(
                                                                        true,
                                                                    );
                                                                }}
                                                            >
                                                                查看同步日志
                                                            </SourceReportActionButton>
                                                        </SourceReportActionRow>
                                                    </SourceReportEmptySurface>
                                                </DashboardSourceReportState>
                                            ) : sourceReportData ? (
                                                <DashboardSourceReportState
                                                    state="loaded"
                                                    subState={
                                                        sourceReportSubState
                                                    }
                                                >
                                                    {!selectedRecording?.hasAudio ? (
                                                        <SourceReportStatusBadge tone="warn">
                                                            {t(
                                                                "sourceReport.sourceOnlyNoAudio",
                                                            )}
                                                        </SourceReportStatusBadge>
                                                    ) : null}
                                                    <SourceReportMetricCards>
                                                        <SourceReportMetricCard
                                                            label={t(
                                                                "recording.source",
                                                            )}
                                                            metric="source"
                                                            value="source"
                                                        >
                                                            <SourceReportSourceIdentity
                                                                fallback={sourceReportProviderName.charAt(
                                                                    0,
                                                                )}
                                                                icon={
                                                                    sourceReportProviderDefinition?.icon
                                                                }
                                                                label={
                                                                    sourceReportProviderName
                                                                }
                                                            />
                                                        </SourceReportMetricCard>
                                                        <SourceReportMetricCard
                                                            label="转写状态"
                                                            metric="transcript-status"
                                                        >
                                                            <SourceReportStatusBadge
                                                                tone={sourceReportReadinessTone(
                                                                    sourceTranscriptStatusLabel,
                                                                )}
                                                            >
                                                                {
                                                                    sourceTranscriptStatusLabel
                                                                }
                                                            </SourceReportStatusBadge>
                                                        </SourceReportMetricCard>
                                                        <SourceReportMetricCard
                                                            label="摘要状态"
                                                            metric="summary-status"
                                                        >
                                                            <SourceReportStatusBadge
                                                                tone={sourceReportReadinessTone(
                                                                    sourceSummaryStatusLabel,
                                                                )}
                                                            >
                                                                {
                                                                    sourceSummaryStatusLabel
                                                                }
                                                            </SourceReportStatusBadge>
                                                        </SourceReportMetricCard>
                                                        <SourceReportMetricCard
                                                            label="分段数"
                                                            metric="segment-count"
                                                            value="number"
                                                        >
                                                            {
                                                                sourceReportSegmentCount
                                                            }
                                                        </SourceReportMetricCard>
                                                    </SourceReportMetricCards>

                                                    <SourceReportSection
                                                        section="transcript"
                                                        title="来源转写"
                                                        noticeAfter={
                                                            sourceTranscriptAvailable ? null : (
                                                                <SourceReportMissingNotice state="transcript-missing">
                                                                    来源未提供逐字稿。可以稍后再来，或运行私有转写。
                                                                </SourceReportMissingNotice>
                                                            )
                                                        }
                                                        description={
                                                            <>
                                                                来自
                                                                {
                                                                    sourceReportProviderSentenceName
                                                                }
                                                                {" · "}
                                                                {
                                                                    sourceReportSegmentCount
                                                                }
                                                                {" 段 · "}
                                                                {selectedRecording
                                                                    ? formatDuration(
                                                                          selectedRecording.duration,
                                                                      )
                                                                    : "--"}
                                                                {" 总时长"}
                                                            </>
                                                        }
                                                    >
                                                        <SourceReportSegments
                                                            hidden={
                                                                !sourceTranscriptAvailable
                                                            }
                                                        >
                                                            {sourceReportDisplaySegments.map(
                                                                (
                                                                    segment,
                                                                    index,
                                                                ) => (
                                                                    <SourceReportSegment
                                                                        key={[
                                                                            selectedRecordingId,
                                                                            "source",
                                                                            segment.startMs,
                                                                            segment.endMs,
                                                                            segment.speaker,
                                                                            segment.text,
                                                                            index,
                                                                        ].join(
                                                                            ":",
                                                                        )}
                                                                        time={
                                                                            [
                                                                                formatSourceReportTimestamp(
                                                                                    segment.startMs,
                                                                                ),
                                                                                formatSourceReportTimestamp(
                                                                                    segment.endMs,
                                                                                ),
                                                                            ]
                                                                                .filter(
                                                                                    Boolean,
                                                                                )
                                                                                .join(
                                                                                    " – ",
                                                                                ) ||
                                                                            "--"
                                                                        }
                                                                        speaker={
                                                                            segment.speaker ||
                                                                            `说话人 ${index + 1}`
                                                                        }
                                                                    >
                                                                        {
                                                                            segment.text
                                                                        }
                                                                    </SourceReportSegment>
                                                                ),
                                                            )}
                                                        </SourceReportSegments>
                                                    </SourceReportSection>

                                                    {sourceSummaryLines.length >
                                                    0 ? (
                                                        <SourceReportSection
                                                            section="summary"
                                                            title="来源原始报告"
                                                            description={
                                                                <>
                                                                    由
                                                                    {
                                                                        sourceReportProviderName
                                                                    }
                                                                    返回的只读摘要
                                                                </>
                                                            }
                                                        >
                                                            <SourceReportSummaryBody>
                                                                {sourceSummaryLines.map(
                                                                    (
                                                                        line,
                                                                        index,
                                                                    ) => (
                                                                        <SourceReportSummaryLine
                                                                            key={`${index}:${line}`}
                                                                        >
                                                                            {
                                                                                line
                                                                            }
                                                                        </SourceReportSummaryLine>
                                                                    ),
                                                                )}
                                                            </SourceReportSummaryBody>
                                                        </SourceReportSection>
                                                    ) : null}

                                                    <SourceReportSection
                                                        section="metadata"
                                                        title="来源信息"
                                                        noticeBefore={
                                                            sourceSummaryAvailable ? null : (
                                                                <SourceReportMissingNotice state="summary-missing">
                                                                    来源未提供官方摘要。
                                                                </SourceReportMissingNotice>
                                                            )
                                                        }
                                                        description={
                                                            <>
                                                                由
                                                                {
                                                                    sourceReportProviderName
                                                                }
                                                                返回的公开元数据
                                                            </>
                                                        }
                                                    >
                                                        <SourceReportMetaList
                                                            surface="dashboard"
                                                            subState={
                                                                sourceReportSubState
                                                            }
                                                        >
                                                            <SourceReportMetaRow label="来源">
                                                                {
                                                                    sourceReportProviderName
                                                                }
                                                            </SourceReportMetaRow>
                                                            <SourceReportMetaRow label="状态">
                                                                <SourceReportStatusBadge
                                                                    tone={sourceReportSyncTone(
                                                                        sourceReportSyncStatusLabel,
                                                                    )}
                                                                >
                                                                    {
                                                                        sourceReportSyncStatusLabel
                                                                    }
                                                                </SourceReportStatusBadge>
                                                            </SourceReportMetaRow>
                                                            <SourceReportMetaRow
                                                                label="录制于"
                                                                valueFormat="mono"
                                                            >
                                                                {formatSourceReportDate(
                                                                    sourceReportRecordedAt,
                                                                )}
                                                            </SourceReportMetaRow>
                                                            <SourceReportMetaRow
                                                                label="最近更新"
                                                                valueFormat="mono"
                                                            >
                                                                {formatSourceReportDate(
                                                                    sourceReportUpdatedAt,
                                                                )}
                                                            </SourceReportMetaRow>
                                                            <SourceReportMetaRow label="可读内容">
                                                                {
                                                                    sourceReportReadable
                                                                }
                                                            </SourceReportMetaRow>
                                                            <SourceReportMetaRow label="来源标题">
                                                                {
                                                                    sourceReportTitle
                                                                }
                                                            </SourceReportMetaRow>
                                                            <SourceReportMetaRow label="语种">
                                                                {
                                                                    sourceReportLanguage
                                                                }
                                                            </SourceReportMetaRow>
                                                            <SourceReportMetaRow
                                                                label="时长"
                                                                valueFormat="mono"
                                                            >
                                                                {selectedRecording
                                                                    ? formatDuration(
                                                                          selectedRecording.duration,
                                                                      )
                                                                    : "--"}
                                                            </SourceReportMetaRow>
                                                        </SourceReportMetaList>
                                                        <SourceReportActionRow>
                                                            <SourceReportActionButton
                                                                intent="ghost"
                                                                type="button"
                                                                disabled={
                                                                    !sourceOpenUrl
                                                                }
                                                                title={
                                                                    sourceOpenUrl
                                                                        ? undefined
                                                                        : t(
                                                                              "sourceReport.openSourceUnavailable",
                                                                          )
                                                                }
                                                                testId="source-report-open-source"
                                                                state={
                                                                    sourceOpenControlState
                                                                }
                                                                onClick={
                                                                    handleOpenSourceRecord
                                                                }
                                                            >
                                                                {sourceOpenLabel(
                                                                    sourceReportData.sourceProvider ??
                                                                        selectedRecording?.sourceProvider,
                                                                    language,
                                                                )}
                                                            </SourceReportActionButton>
                                                            <SourceReportActionButton
                                                                intent="ghost"
                                                                type="button"
                                                                disabled={
                                                                    sourceRepullDisabled
                                                                }
                                                                aria-busy={
                                                                    sourceRepullState ===
                                                                    "loading"
                                                                }
                                                                title={
                                                                    sourceRepullAvailable
                                                                        ? undefined
                                                                        : t(
                                                                              "sourceReport.repullUnavailable",
                                                                          )
                                                                }
                                                                testId="source-report-repull"
                                                                state={
                                                                    sourceRepullControlState
                                                                }
                                                                onClick={() =>
                                                                    void handleRepullSource()
                                                                }
                                                            >
                                                                {sourceRepullState ===
                                                                "loading"
                                                                    ? t(
                                                                          "sourceReport.repullingSource",
                                                                      )
                                                                    : t(
                                                                          "sourceReport.repullSource",
                                                                      )}
                                                            </SourceReportActionButton>
                                                        </SourceReportActionRow>
                                                    </SourceReportSection>
                                                </DashboardSourceReportState>
                                            ) : (
                                                <DashboardSourceReportState state="empty">
                                                    <SourceReportEmptySurface>
                                                        <SourceReportEmptyIcon>
                                                            <SourceReportEmptyGlyph />
                                                        </SourceReportEmptyIcon>
                                                        <SourceReportEmptyTitle>
                                                            这条录音没有关联来源
                                                        </SourceReportEmptyTitle>
                                                        <SourceReportEmptyDescription>
                                                            本地导入或离线录制的录音不会有来源详情。
                                                        </SourceReportEmptyDescription>
                                                    </SourceReportEmptySurface>
                                                </DashboardSourceReportState>
                                            )}
                                        </SourceReportPane>
                                    }
                                    className="rounded-2xl"
                                />
                            </>
                        ) : (
                            <DashboardDetailEmptyState />
                        )}
                    </section>
                </div>
            </main>
        </div>
    );
}
