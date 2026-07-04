"use client";

import {
    AlertCircle,
    Bell,
    Check,
    CheckCircle,
    ChevronDown,
    CircleAlert,
    CloudDownload,
    Copy,
    EllipsisVertical,
    FileText,
    Globe2,
    Menu,
    MessageSquareText,
    Mic,
    Music,
    PanelLeft,
    Pencil,
    Plus,
    RefreshCw,
    Search,
    Sparkle,
    Tags,
    Trash2,
    X,
} from "lucide-react";
import Image from "next/image";
import {
    Fragment,
    type KeyboardEvent as ReactKeyboardEvent,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { toast } from "sonner";
import { useLanguage } from "@/components/language-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
} from "@/components/ui/input-group";
import {
    type SegmentedTabItem,
    SegmentedTabs,
} from "@/components/ui/segmented-tabs";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DashboardRecordingPlayerControls } from "@/features/dashboard/components/dashboard-recording-player-controls";
import { SystemBanner } from "@/features/dashboard/components/system-banner";
import { AiRenamePreviewCard as AiRenamePreview } from "@/features/recordings/components/ai-rename-preview-card";
import { RecordingTagManager } from "@/features/recordings/components/recording-tag-manager";
import {
    formatSotPlayerDate,
    SotPlayerNoAudioAlert,
    SotPlayerSourceTag,
    SotPlayerStatusBadge,
    type SotPlayerStatusTone,
    SotPlayerTagChip,
} from "@/features/recordings/components/sot-player-primitives";
import { SettingsDialog } from "@/features/settings/components/settings-dialog";
import { useDisplaySettingsStore } from "@/features/settings/display-settings-store";
import { usePlaybackSettingsStore } from "@/features/settings/playback-settings-store";
import {
    SourceReportCardSkeleton as SotSourceReportCardSkeleton,
    SourceReportMetaRow as SotSourceReportMetaRow,
    SourceReportMetricCard as SotSourceReportMetricCard,
    SourceReportMetricCards as SotSourceReportMetricCards,
    SourceReportMissingNotice as SotSourceReportMissingNotice,
    SourceReportSection as SotSourceReportSection,
    SourceReportSegmentSkeleton as SotSourceReportSegmentSkeleton,
    DashboardSourceReportState as SotSourceReportState,
    SourceReportStatusBadge as SotSourceReportStatusBadge,
    DashboardSourceReportStatusDot as SotSourceReportStatusDot,
} from "@/features/source-report/primitives";
import {
    type SourceReportTone,
    sourceReportClassNames,
    sourceReportCopyButtonSize,
} from "@/features/source-report/styles";
import { useAutoSync } from "@/hooks/use-auto-sync";
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
import { writeBrowserClipboardText } from "@/lib/platform/clipboard";
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

type TranscriptionJobData = {
    status: string;
    remoteStatus?: string | null;
    lastError?: string | null;
};

type SearchResultType = "recording" | "transcript" | "speaker" | "tag";
type SearchResult = {
    entityType: SearchResultType;
    entityId: string;
    recordingId: string | null;
    title: string | null;
    body: string;
    speaker: string | null;
    source: string | null;
    tags?: string[];
    startMs?: number | null;
    endMs?: number | null;
};
type SearchIndexingProgress = {
    active: boolean;
    pendingJobs: number;
    indexingJobs: number;
    completedJobs: number;
    totalJobs: number;
};

type WorkstationProps = {
    recordings: Recording[];
    transcriptions: Map<string, TranscriptionData>;
    transcriptionJobs: Map<string, TranscriptionJobData>;
    user?: {
        email?: string | null;
        name?: string | null;
    };
};

type Favorite = "all" | "transcribed" | "tags";
type DetailTab = "transcript" | "speakers" | "source";
type ListMode = "timeline" | "tags";
type TagFilterValue = "all" | "untagged" | `tag:${string}`;
type TimelineFilter = "all" | "today" | "yesterday" | "earlier";
type RecordingListState =
    | "loading"
    | "ready"
    | "empty"
    | "no-match"
    | "timeline-empty"
    | "tag-empty";
type SearchScope = "all" | SearchResultType;
type LibrarySearchFilter = {
    type: "speaker" | "tag";
    label: string;
};
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
type SourceReportSegment = {
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
        segments?: SourceReportSegment[];
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

function getSotSegmentedTabProps<T extends string>(
    _item: SegmentedTabItem<T>,
    state: { active: boolean; disabled: boolean },
) {
    return {
        "data-sot-control": "segmented-tab",
        "data-sot-state": state.disabled
            ? "disabled"
            : state.active
              ? "active"
              : "idle",
    };
}

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
const SOURCE_DRAWER_FOCUSABLE_SELECTOR =
    'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
const DASHBOARD_WORKSTATION_SHELL_CLASS_NAME =
    "grid h-screen min-h-[720px] grid-cols-[264px_1fr] transition-[grid-template-columns] duration-[320ms] ease-[var(--ease-out)] data-[sidebar-collapsed=true]:grid-cols-[56px_1fr] max-[860px]:h-auto max-[860px]:min-h-[100svh] max-[860px]:grid-cols-[minmax(0,1fr)] max-[860px]:overflow-x-clip";

const DASHBOARD_MAIN_CLASS_NAME =
    "flex h-screen min-w-0 flex-col max-[860px]:min-w-0 max-[860px]:max-w-full max-[860px]:box-border";
const DASHBOARD_WORKSPACE_CLASS_NAME =
    "grid flex-1 min-h-0 grid-cols-[380px_1fr] gap-4 px-5 pt-4 pb-5 max-[860px]:min-w-0 max-[860px]:max-w-full max-[860px]:box-border max-[860px]:grid-cols-[380px_0px] max-[860px]:[&>[data-sot-panel=dashboard-detail]]:hidden";
const DASHBOARD_RECORDING_LIST_CARD_CLASS_NAME =
    "min-h-0 gap-0 rounded-2xl max-[860px]:min-w-0 max-[860px]:max-w-full max-[860px]:box-border";
const DASHBOARD_DETAIL_PANEL_CLASS_NAME = "flex min-h-0 min-w-0 flex-col gap-4";
const DASHBOARD_RECORDING_LIST_CONTENT_CLASS_NAME = "flex min-h-0 flex-col p-0";
const DASHBOARD_DETAIL_EMPTY_STATE_CLASS_NAME = "min-h-[280px] p-9 md:p-9";

const dashboardDrawerClassNames = {
    scrim: "pointer-events-none fixed inset-0 z-[var(--z-drawer-scrim)] hidden max-[860px]:block max-[860px]:group-data-[drawer-state=open]/dashboard-workstation:pointer-events-auto",
    menuIcon:
        "pointer-events-none absolute top-1/2 left-1/2 size-4 -translate-x-1/2 -translate-y-1/2",
    activeDot:
        "absolute top-1.5 right-1.5 hidden size-1.5 rounded-full bg-[var(--accent)]",
} as const;

const dashboardTopbarClassNames = {
    topbar: "relative z-[var(--z-topbar)] flex h-14 flex-none flex-row items-center gap-3.5 border-b border-border bg-background/80 px-5 py-3 shadow-none backdrop-blur-[20px] backdrop-saturate-[140%] supports-[backdrop-filter]:bg-background/60 max-[860px]:min-w-0 max-[860px]:max-w-full max-[860px]:box-border",
    crumbs: "flex items-center gap-2 font-sans text-[13px] font-medium text-[var(--fg-tertiary)]",
    crumb: "text-[var(--fg-tertiary)]",
    separator: "text-[var(--fg-tertiary)] opacity-60 max-[860px]:hidden",
    current: "font-semibold text-[var(--fg-primary)] max-[860px]:hidden",
} as const;

const dashboardSidebarCollapseClassNames = {
    sidebar:
        "relative flex flex-col rounded-none border border-[var(--glass-border)] border-r-[var(--line-hairline)] bg-[var(--glass-tint-strong)] px-3 pt-4 pb-3 shadow-[var(--glass-shadow-cast),var(--shadow-inset)] backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturate)] group-data-[sidebar-collapsed=true]/dashboard-workstation:px-[6px] group-data-[sidebar-collapsed=true]/dashboard-workstation:pt-4 group-data-[sidebar-collapsed=true]/dashboard-workstation:pb-3 max-[860px]:hidden max-[860px]:group-data-[drawer-state=open]/dashboard-workstation:fixed max-[860px]:group-data-[drawer-state=open]/dashboard-workstation:top-0 max-[860px]:group-data-[drawer-state=open]/dashboard-workstation:bottom-0 max-[860px]:group-data-[drawer-state=open]/dashboard-workstation:left-0 max-[860px]:group-data-[drawer-state=open]/dashboard-workstation:z-[var(--z-drawer)] max-[860px]:group-data-[drawer-state=open]/dashboard-workstation:flex max-[860px]:group-data-[drawer-state=open]/dashboard-workstation:max-w-[min(320px,calc(100vw-32px))]",
    hidden: "group-data-[sidebar-collapsed=true]/dashboard-workstation:hidden",
    brand: "group-data-[sidebar-collapsed=true]/dashboard-workstation:justify-center group-data-[sidebar-collapsed=true]/dashboard-workstation:px-0 group-data-[sidebar-collapsed=true]/dashboard-workstation:pt-1 group-data-[sidebar-collapsed=true]/dashboard-workstation:pb-4",
    favorite:
        "group-data-[sidebar-collapsed=true]/dashboard-workstation:justify-center group-data-[sidebar-collapsed=true]/dashboard-workstation:gap-0 group-data-[sidebar-collapsed=true]/dashboard-workstation:px-0 group-data-[sidebar-collapsed=true]/dashboard-workstation:py-2",
} as const;

const dashboardSyncClassNames = {
    panel: "group/dashboard-sync flex items-center gap-[10px] rounded-xl border border-[var(--glass-border)] bg-[var(--glass-tint-subtle)] px-[10px] py-2 group-data-[sidebar-collapsed=true]/dashboard-workstation:justify-center group-data-[sidebar-collapsed=true]/dashboard-workstation:p-2",
    indicator:
        "size-2 rounded-full bg-[var(--signal-success)] shadow-[0_0_0_3px_var(--button-copy-success-bg)] group-data-[sot-state=error]/dashboard-sync:bg-[var(--signal-danger)] group-data-[sot-state=error]/dashboard-sync:shadow-[0_0_0_3px_var(--alert-destructive-soft-bg)] group-data-[sot-state=queued]/dashboard-sync:animate-[bpulse_1.4s_ease-in-out_infinite] group-data-[sot-state=queued]/dashboard-sync:bg-[var(--signal-info)] group-data-[sot-state=queued]/dashboard-sync:shadow-[0_0_0_3px_var(--accent-soft)] group-data-[sot-state=running]/dashboard-sync:animate-[bpulse_1.4s_ease-in-out_infinite] group-data-[sot-state=running]/dashboard-sync:bg-[var(--signal-info)] group-data-[sot-state=running]/dashboard-sync:shadow-[0_0_0_3px_var(--accent-soft)]",
    text: "min-w-0 flex-1",
    title: "font-sans text-xs font-semibold text-[var(--fg-primary)]",
    subtitle:
        "mt-px font-mono text-[11px] font-medium text-[var(--fg-tertiary)]",
} as const;

const dashboardBrandClassNames = {
    wrapper: "flex items-center gap-[10px] px-2 pt-1 pb-4",
    image: "size-9 rounded-[9px]",
    name: "[font:600_15px_var(--font-sans)] tracking-[-0.012em] text-[var(--fg-primary)]",
    subtitle:
        "mt-px [font:500_11px_var(--font-sans)] text-[var(--fg-tertiary)]",
} as const;

const dashboardNavClassNames = {
    root: "flex flex-1 flex-col gap-0.5 overflow-y-auto pb-3",
    sectionLabel:
        "px-2.5 pt-3.5 pb-1.5 font-sans text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--fg-tertiary)]",
    favoriteCount:
        "min-w-[22px] rounded-[5px] border border-transparent bg-[var(--bg-recessed)] px-1.5 py-px text-center font-mono text-[11px] font-medium leading-[1.45] text-[var(--fg-tertiary)] data-[sot-state=selected]:border-[var(--line-hairline)] data-[sot-state=selected]:bg-[var(--bg-elevated)] data-[sot-state=selected]:text-[var(--fg-primary)]",
} as const;

type DashboardTranscriptSkeletonSize =
    | "avatar"
    | "line-60"
    | "line-70"
    | "line-78"
    | "line-82"
    | "line-88"
    | "line-92"
    | "line-94"
    | "line-96"
    | "speaker-120"
    | "speaker-130"
    | "speaker-140"
    | "time";

const dashboardTranscriptSkeletonClassNames = {
    avatar: "size-6 flex-none rounded-full",
    "line-60": "mt-1.5 h-3.5 w-3/5",
    "line-70": "mt-1.5 h-3.5 w-[70%]",
    "line-78": "mt-1.5 h-3.5 w-[78%]",
    "line-82": "mt-1.5 h-3.5 w-[82%]",
    "line-88": "mt-1.5 h-3.5 w-[88%]",
    "line-92": "mt-1 h-3.5 w-[92%]",
    "line-94": "mt-1 h-3.5 w-[94%]",
    "line-96": "mt-1 h-3.5 w-[96%]",
    "speaker-120": "h-[13px] w-[120px] flex-none",
    "speaker-130": "h-[13px] w-[130px] flex-none",
    "speaker-140": "h-[13px] w-[140px] flex-none",
    time: "h-[11px] w-20 flex-none",
} as const satisfies Record<DashboardTranscriptSkeletonSize, string>;

const dashboardTranscriptClassNames = {
    turn: "border-b border-dashed border-[var(--line-hairline)] py-[10px] pb-4 last:border-b-0",
    speakerRow: "mb-1.5 flex items-center gap-2.5",
    avatar: "inline-grid size-7 flex-none place-items-center rounded-full bg-[var(--accent-soft)] text-center [font:600_12px/1_var(--font-sans)] tracking-normal text-[var(--steel-700)] data-[sot-tone=info]:bg-[var(--accent-soft)] data-[sot-tone=info]:text-[var(--signal-info)] data-[sot-tone=steel]:bg-[var(--accent-soft)] data-[sot-tone=steel]:text-[var(--steel-700)] data-[sot-tone=success]:bg-[var(--button-copy-success-bg)] data-[sot-tone=success]:text-[var(--signal-success)]",
    speakerName: "[font:600_12.5px_var(--font-sans)] text-[var(--fg-primary)]",
    speakerTime:
        "ml-1 font-mono text-[11px] font-medium text-[var(--fg-tertiary)]",
    paragraph:
        "m-0 ![font:400_14.5px/1.65_var(--font-sans)] ![color:var(--fg-primary)] [text-wrap:pretty]",
    empty: "block min-w-0 flex-none rounded-none border-0 bg-transparent px-[18px] py-[26px] text-center shadow-none",
    emptyHeader: "block max-w-none",
    emptyIcon:
        "mx-auto mb-2 inline-grid size-11 place-items-center rounded-full border border-[var(--line-hairline)] bg-[var(--bg-recessed)] text-[var(--fg-tertiary)] [&_svg]:size-[22px] [&_svg]:fill-none [&_svg]:stroke-current [&_svg]:stroke-[1.6] [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round]",
    emptyMessage:
        "mb-1 mt-0 font-sans text-[13px] font-semibold leading-[1.35] text-[var(--fg-primary)]",
    emptySub:
        "m-0 font-sans text-xs font-medium leading-[1.55] text-[var(--fg-tertiary)]",
} as const;

const dashboardSpeakerPaneClassNames = {
    head: "flex items-center gap-2.5 px-4 pt-3 pb-2",
    headTitle:
        "flex-1 font-sans text-[12.5px] font-semibold text-[var(--fg-secondary)]",
    rows: "m-0 flex list-none flex-col gap-0.5 px-2 pb-3.5",
    row: "grid grid-cols-[28px_1fr_120px_auto] items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-[var(--bg-recessed)]",
    rowMeta: "flex min-w-0 flex-col gap-0.5",
    name: "truncate font-sans text-[13px] font-semibold text-[var(--fg-primary)]",
    sub: "font-mono text-[11.5px] font-medium text-[var(--fg-tertiary)]",
    avatar: "inline-grid size-7 flex-none place-items-center rounded-full bg-[var(--accent-soft)] text-center [font:600_12px/1_var(--font-sans)] tracking-normal text-[var(--steel-700)]",
    bar: "block h-1 w-full overflow-hidden rounded-full bg-[var(--bg-recessed)]",
    barFill: "block h-full rounded-full bg-[var(--accent)]",
} as const;

const DASHBOARD_SPEAKER_SHARE_CLASS_NAMES = [
    "w-[24%]",
    "w-[36%]",
    "w-[48%]",
    "w-[60%]",
    "w-[72%]",
    "w-[84%]",
    "w-[96%]",
    "w-full",
] as const;

function getDashboardSpeakerShareClassName(index: number) {
    return DASHBOARD_SPEAKER_SHARE_CLASS_NAMES[
        Math.min(index, DASHBOARD_SPEAKER_SHARE_CLASS_NAMES.length - 1)
    ];
}

const TRANSCRIPT_LOADING_SKELETON_ROWS = [
    {
        firstLine: "line-96",
        key: "opening",
        secondLine: "line-88",
        speaker: "speaker-120",
        thirdLine: "line-60",
    },
    {
        firstLine: "line-92",
        key: "middle",
        secondLine: "line-78",
        speaker: "speaker-140",
        thirdLine: null,
    },
    {
        firstLine: "line-94",
        key: "closing",
        secondLine: "line-82",
        speaker: "speaker-130",
        thirdLine: "line-70",
    },
] as const satisfies ReadonlyArray<{
    firstLine: DashboardTranscriptSkeletonSize;
    key: string;
    secondLine: DashboardTranscriptSkeletonSize;
    speaker: DashboardTranscriptSkeletonSize;
    thirdLine: DashboardTranscriptSkeletonSize | null;
}>;

function DashboardTranscriptSkeleton({
    size,
}: {
    size: DashboardTranscriptSkeletonSize;
}) {
    return (
        <Skeleton
            aria-hidden="true"
            variant="default"
            size="default"
            className={dashboardTranscriptSkeletonClassNames[size]}
            data-sot-part="dashboard-transcript-skeleton"
            data-sot-size={size}
        />
    );
}

const TRANSCRIPT_AVATAR_TONES = ["steel", "info", "success"] as const;

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

const SEARCH_SCOPES: { value: SearchScope; label: string }[] = [
    { value: "all", label: "全部" },
    { value: "recording", label: "录音" },
    { value: "transcript", label: "逐字稿" },
    { value: "speaker", label: "说话人" },
    { value: "tag", label: "标签" },
];
const SEARCH_RESULT_TYPES: SearchResultType[] = [
    "recording",
    "transcript",
    "speaker",
    "tag",
];

const FAVORITES: { value: Favorite; icon: typeof Mic }[] = [
    { value: "all", icon: Mic },
    { value: "transcribed", icon: FileText },
    { value: "tags", icon: Tags },
];
const TIMELINE_FILTERS: {
    value: TimelineFilter;
    labelKey: string;
}[] = [
    { value: "all", labelKey: "recordingList.timeline.all" },
    { value: "today", labelKey: "recordingList.timeline.today" },
    { value: "yesterday", labelKey: "recordingList.timeline.yesterday" },
    { value: "earlier", labelKey: "recordingList.timeline.earlier" },
];

const dashboardTabPaneHiddenClassName = "[&[hidden]]:hidden";

const DASHBOARD_ICON_CLASS_NAME =
    "size-4 flex-none fill-none stroke-current stroke-[1.8]";
const DASHBOARD_TINY_ICON_CLASS_NAME =
    "size-3 flex-none fill-none stroke-current stroke-[1.8]";
const DASHBOARD_MICRO_ICON_CLASS_NAME =
    "size-[11px] flex-none fill-none stroke-current stroke-2";
const DASHBOARD_RECORDING_LIST_STATE_ICON_CLASS_NAME =
    "size-[15px] fill-none stroke-current stroke-[1.8]";
const DASHBOARD_ACTIVITY_ITEM_ICON_CLASS_NAME =
    "size-3 fill-none stroke-current stroke-2";
const DASHBOARD_RETRANSCRIPTION_ICON_CLASS_NAME =
    "size-[13px] fill-none stroke-current stroke-2";
const DASHBOARD_RETRANSCRIPTION_CLOSE_ICON_CLASS_NAME =
    "size-4 fill-none stroke-current stroke-[1.8]";

const DASHBOARD_SIDEBAR_FOOTER_CLASS_NAME = "border-t border-border pt-2.5";

const dashboardRecordingTimeFilterStyles = {
    root: "mt-2.5 flex-wrap [&[hidden]]:hidden",
    item: "data-[state=on]:border-primary/30 data-[state=on]:bg-primary/10 data-[state=on]:text-primary data-[sot-state=selected]:border-primary/30 data-[sot-state=selected]:bg-primary/10 data-[sot-state=selected]:text-primary",
    count: "rounded-[4px] bg-muted px-1 font-mono text-[10px] font-medium text-muted-foreground/70",
    countSelected: "bg-primary/10 text-primary",
} as const;

const dashboardRecordingTagFilterStyles = {
    root: "relative mt-2.5",
    trigger: "w-full justify-start text-foreground",
    label: "min-w-0 flex-1 truncate",
    count: "font-mono text-[11px] font-medium text-muted-foreground",
    caret: "shrink-0 text-muted-foreground",
    list: "absolute left-0 right-0 top-[calc(100%+6px)] z-[var(--z-popover-inline)] max-h-[260px] overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg",
    option: "w-full justify-start border border-transparent bg-transparent text-muted-foreground shadow-none hover:bg-accent hover:text-accent-foreground data-[sot-state=selected]:bg-secondary data-[sot-state=selected]:text-secondary-foreground data-[sot-state=selected]:hover:bg-secondary/80",
    optionLabel: "min-w-0 flex-1 truncate",
    optionCount: "font-mono text-[11px] font-medium text-muted-foreground",
} as const;

const DASHBOARD_RECORDING_LIST_HEADER_CLASS_NAME =
    "border-b border-border px-3 pt-3 pb-2.5";

const dashboardRecordingListTitlebarStyles = {
    root: "flex items-center gap-2.5",
    title: "m-0 font-sans text-[13px] font-semibold text-foreground",
    count: "ml-auto font-mono text-[11.5px] font-medium text-muted-foreground",
} as const;

const dashboardScrollbarClassName =
    "[scrollbar-width:thin] [scrollbar-color:var(--muted-foreground)_transparent] [&::-webkit-scrollbar]:size-[10px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-2 [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-muted-foreground/35 [&::-webkit-scrollbar-thumb]:bg-clip-padding [&::-webkit-scrollbar-thumb:hover]:bg-muted-foreground/55 [&::-webkit-scrollbar-thumb:hover]:bg-clip-padding";

const dashboardRecordingListScrollClassName = cn(
    "flex-1 overflow-y-auto p-1",
    dashboardScrollbarClassName,
);

const dashboardRecordingListModeStyles = {
    root: "mt-2 flex items-center gap-2.5",
    label: "inline-flex items-center gap-1.5 font-sans text-[12px] font-semibold text-muted-foreground",
    count: "font-mono text-[11px] font-medium text-muted-foreground",
    segmented: "ml-auto",
} as const;

const dashboardRecordingListStateStyles = {
    root: "m-2 flex flex-col items-center gap-1.5 rounded-[10px] border border-dashed border-border bg-muted px-[18px] py-[26px] text-center",
    icon: "mb-0.5 inline-flex size-[34px] items-center justify-center rounded-full border border-border bg-card text-muted-foreground",
    title: "font-sans text-[13px] font-semibold text-foreground",
    description:
        "max-w-[300px] font-sans text-[12px] font-medium leading-[1.5] text-muted-foreground",
} as const;

const dashboardRecordingListLoadingSkeletonClassNames = {
    root: "flex flex-col gap-0.5 p-1",
    day: "flex items-center gap-2.5 px-2.5 pt-3.5 pb-1.5",
    dayLabel: "h-[11px] w-[100px]",
    dayLabel40: "h-[11px] w-10",
    dayLine: "h-px flex-1 bg-border",
    row: "grid grid-cols-[1fr_auto] items-center gap-3.5 px-3 py-[11px]",
    rowBody: "flex min-w-0 flex-col gap-1.5",
    meta: "flex items-center gap-2",
    title: "h-[13px] w-full",
    title90: "h-[13px] w-[90%]",
    title85: "h-[13px] w-[85%]",
    title80: "h-[13px] w-4/5",
    title70: "h-[13px] w-[70%]",
    metaTime: "h-[11px] w-20",
    metaTag: "h-[18px] w-16 rounded-[6px]",
    metaPill: "h-[18px] w-16 rounded-full",
    metaPill70: "h-[18px] w-12 rounded-full",
    tag: "h-[22px] w-20 rounded-[6px]",
} as const;

const dashboardRecordingListPaginationStyles = {
    root: "m-2 flex flex-col items-stretch gap-1.5 border-0 bg-transparent p-[14px] text-center",
    divider: "relative mt-1.5 mb-[14px] h-px bg-border",
    status: "absolute left-1/2 -top-2 -translate-x-1/2 -translate-y-1/2 bg-card px-2.5 font-mono text-[10.5px] font-medium text-muted-foreground",
    nav: "mt-1 flex items-center justify-center gap-2.5",
    number: "min-w-14 text-center font-mono text-[11.5px] font-medium text-muted-foreground",
} as const;

const dashboardSearchActivityClassNames = {
    dashboardTopbarActions: "ml-auto flex items-center gap-2",
    librarySearchAnchor:
        "relative inline-flex size-[32px] items-center justify-center p-0",
    dashboardActivityAnchor:
        "relative inline-flex size-[32px] items-center justify-center p-0",
    dashboardSearchTrigger:
        "relative size-[32px] rounded-md border border-transparent bg-transparent p-0 text-muted-foreground shadow-none hover:bg-accent hover:text-accent-foreground data-[sot-state=open]:border-border data-[sot-state=open]:bg-accent data-[sot-state=open]:text-accent-foreground",
    librarySearchPanel:
        "pointer-events-none absolute right-0 top-[calc(100%+8px)] z-[var(--z-dropdown)] flex max-h-[540px] w-[460px] max-w-[calc(100vw-32px)] flex-col gap-0 overflow-hidden rounded-[12px] border-border bg-popover font-sans text-popover-foreground opacity-0 shadow-lg backdrop-blur-none transition-[opacity,transform] duration-[180ms] ease-[var(--ease-out)] [transform:translateY(-4px)_scale(0.99)] data-[open=true]:pointer-events-auto data-[open=true]:opacity-100 data-[open=true]:[transform:translateY(0)_scale(1)] min-[641px]:max-[860px]:fixed min-[641px]:max-[860px]:left-3 min-[641px]:max-[860px]:right-auto min-[641px]:max-[860px]:top-[72px] min-[641px]:max-[860px]:box-border min-[641px]:max-[860px]:max-h-[calc(100dvh-96px)] min-[641px]:max-[860px]:w-[min(460px,calc(100vw-24px))] min-[641px]:max-[860px]:max-w-[calc(100vw-24px)] max-[640px]:fixed max-[640px]:left-3 max-[640px]:right-3 max-[640px]:top-[72px] max-[640px]:box-border max-[640px]:max-h-[calc(100dvh-96px)] max-[640px]:w-[calc(100vw-24px)] max-[640px]:min-w-0 max-[640px]:max-w-none",
    librarySearchInputRow:
        "h-[49px] min-h-[49px] gap-[8px] rounded-none border-x-0 border-t-0 border-b border-border bg-transparent px-[12px] py-[8px] shadow-none focus-within:border-border focus-within:ring-0",
    librarySearchInputAddon:
        "p-0 text-muted-foreground group-data-[disabled=true]/input-group:opacity-100 has-[>button]:m-0",
    librarySearchInput:
        "h-[32px] min-w-0 px-[4px] py-0 [font:500_13.5px/1.35_var(--font-sans)] text-foreground placeholder:text-muted-foreground md:text-[13.5px]",
    librarySearchClear:
        "size-6 rounded-[calc(var(--radius-md)-5px)] border border-transparent bg-transparent p-0 text-muted-foreground shadow-none hover:bg-transparent hover:text-foreground has-[>svg]:p-0",
    librarySearchScope:
        "min-h-[39px] w-full flex-wrap gap-[6px] rounded-none border-b border-border bg-muted px-[12px] py-[8px]",
    librarySearchScopeItem:
        "h-[22px] gap-[4px] rounded-full border border-transparent bg-transparent px-[10px] [font:500_11.5px/1_var(--font-sans)] text-muted-foreground shadow-none hover:bg-card hover:text-foreground data-[state=on]:border-primary/30 data-[state=on]:bg-primary/10 data-[state=on]:text-primary disabled:pointer-events-none disabled:opacity-[.45]",
    librarySearchError:
        "flex w-full flex-col items-center gap-2 rounded-none border-0 bg-transparent px-4 py-4 text-center text-sm text-destructive shadow-none *:data-[slot=alert-description]:text-destructive [&>svg]:text-current",
    librarySearchErrorTitle:
        "line-clamp-none min-h-0 text-center text-sm font-medium tracking-normal",
    librarySearchRetry:
        "h-6 gap-1 rounded-md border border-input bg-background px-2 text-xs text-foreground shadow-xs hover:bg-accent hover:text-accent-foreground has-[>svg]:px-1.5",
    librarySearchScroll:
        "min-h-0 flex-1 overflow-y-auto px-[6px] pt-[6px] pb-[8px]",
    librarySearchState: "block text-muted-foreground",
    librarySearchIndexing:
        "flex items-center gap-[10px] px-[16px] py-[14px] text-[length:var(--text-body-sm)] text-muted-foreground",
    librarySearchStateSkeleton:
        "relative inline-flex h-1 w-auto min-w-0 flex-1 overflow-hidden rounded-full bg-primary/10 animate-none after:absolute after:inset-y-0 after:left-0 after:w-[36%] after:rounded-[inherit] after:bg-primary/50 after:animate-[sbn-sweep_1.4s_linear_infinite] after:content-['']",
    librarySearchStateCopy:
        "px-[16px] py-[22px] text-center [font:500_12.5px/1.55_var(--font-sans)] text-muted-foreground [&_span]:font-semibold [&_span]:text-foreground",
    librarySearchResults: "flex flex-col",
    librarySearchResultGroup:
        "flex flex-col gap-[2px] px-[4px] py-[6px] [&+&]:mt-[4px] [&+&]:border-t [&+&]:border-border [&+&]:pt-[8px]",
    librarySearchGroupLabel:
        "px-[6px] py-[4px] [font:600_10.5px/1_var(--font-mono)] uppercase tracking-[0.08em] text-muted-foreground",
    librarySearchResult:
        "h-auto w-full flex-col items-start justify-start gap-[2px] rounded-[var(--radius-sm)] border-0 bg-transparent px-[10px] py-[8px] text-left text-foreground whitespace-normal shadow-none hover:bg-muted focus-visible:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
    librarySearchResultTitle:
        "[font:600_13px/1.4_var(--font-sans)] text-foreground",
    librarySearchResultMeta:
        "font-mono text-[11.5px] font-medium leading-[1.4] tracking-[0.02em] text-muted-foreground",
    librarySearchHighlight: "rounded-[3px] bg-primary/10 px-[2px] text-primary",
    librarySearchTag:
        "h-[22px] w-fit justify-normal gap-[5px] overflow-visible rounded-[6px] border border-primary/20 bg-primary/10 py-0 pr-[9px] pl-[7px] [font:600_11.5px_var(--font-sans)] text-primary whitespace-normal shadow-xs [a&]:hover:bg-primary/10",
    dashboardActivityTrigger:
        "relative size-[32px] rounded-md border border-transparent bg-transparent p-0 text-muted-foreground shadow-none hover:bg-accent hover:text-accent-foreground data-[sot-state=open]:border-border data-[sot-state=open]:bg-accent data-[sot-state=open]:text-accent-foreground data-[unread=0]:[&_[data-sot-part=dashboard-activity-badge]]:hidden [&_[data-sot-part=dashboard-activity-badge]]:pointer-events-none [&_[data-sot-part=dashboard-activity-badge]]:absolute [&_[data-sot-part=dashboard-activity-badge]]:right-0.5 [&_[data-sot-part=dashboard-activity-badge]]:top-0.5 [&_[data-sot-part=dashboard-activity-badge]]:inline-flex [&_[data-sot-part=dashboard-activity-badge]]:h-4 [&_[data-sot-part=dashboard-activity-badge]]:min-w-4 [&_[data-sot-part=dashboard-activity-badge]]:items-center [&_[data-sot-part=dashboard-activity-badge]]:justify-center [&_[data-sot-part=dashboard-activity-badge]]:rounded-full [&_[data-sot-part=dashboard-activity-badge]]:bg-destructive [&_[data-sot-part=dashboard-activity-badge]]:px-1 [&_[data-sot-part=dashboard-activity-badge]]:font-sans [&_[data-sot-part=dashboard-activity-badge]]:text-[9.5px] [&_[data-sot-part=dashboard-activity-badge]]:font-bold [&_[data-sot-part=dashboard-activity-badge]]:text-destructive-foreground [&_[data-sot-part=dashboard-activity-badge]]:ring-2 [&_[data-sot-part=dashboard-activity-badge]]:ring-card",
    dashboardActivityPanel:
        "pointer-events-none absolute right-0 top-[calc(100%+8px)] z-[var(--z-dropdown)] flex max-h-[520px] w-[380px] max-w-[calc(100vw-32px)] flex-col gap-0 overflow-hidden rounded-[12px] border-border bg-popover text-popover-foreground opacity-0 shadow-lg backdrop-blur-none transition-[opacity,transform] duration-[180ms] ease-[var(--ease-out)] [transform:translateY(-4px)_scale(0.99)] data-[open=true]:pointer-events-auto data-[open=true]:opacity-100 data-[open=true]:[transform:translateY(0)_scale(1)] min-[641px]:max-[860px]:fixed min-[641px]:max-[860px]:left-3 min-[641px]:max-[860px]:right-auto min-[641px]:max-[860px]:top-[72px] min-[641px]:max-[860px]:box-border min-[641px]:max-[860px]:max-h-[calc(100dvh-96px)] min-[641px]:max-[860px]:w-[min(380px,calc(100vw-24px))] min-[641px]:max-[860px]:max-w-[calc(100vw-24px)] max-[640px]:fixed max-[640px]:left-3 max-[640px]:right-3 max-[640px]:top-[72px] max-[640px]:box-border max-[640px]:max-h-[calc(100dvh-96px)] max-[640px]:w-[calc(100vw-24px)] max-[640px]:min-w-0 max-[640px]:max-w-none",
    dashboardActivityHeader: "flex items-center gap-2.5 px-3.5 py-3",
    dashboardActivityHeading: "flex flex-1 flex-col gap-0.5",
    dashboardActivityTitle: "[font:600_13px_var(--font-sans)] text-foreground",
    dashboardActivityCount:
        "justify-normal border-0 bg-transparent p-0 font-mono text-[11px] font-medium text-muted-foreground [a&]:hover:bg-transparent",
    dashboardActivityClose:
        "size-[26px] rounded-[7px] border border-transparent bg-transparent p-0 text-muted-foreground shadow-none hover:bg-accent hover:text-accent-foreground",
    dashboardActivityContent: "flex min-h-0 flex-1 flex-col p-0",
    dashboardActivityStatus:
        "flex items-center gap-2.5 bg-muted px-3.5 py-2.5 data-[state=error]:[&_[data-sot-part=dashboard-activity-status-indicator]]:bg-destructive data-[state=running]:[&_[data-sot-part=dashboard-activity-status-indicator]]:animate-[bpulse_1.4s_ease-in-out_infinite] data-[state=running]:[&_[data-sot-part=dashboard-activity-status-indicator]]:bg-primary data-[state=syncing]:[&_[data-sot-part=dashboard-activity-status-indicator]]:animate-[bpulse_1.4s_ease-in-out_infinite] data-[state=syncing]:[&_[data-sot-part=dashboard-activity-status-indicator]]:bg-primary",
    dashboardActivityStatusIndicator:
        "size-2 flex-none rounded-full bg-primary",
    dashboardActivityStatusCopy: "flex min-w-0 flex-1 flex-col gap-0.5",
    dashboardActivityStatusLine:
        "[font:600_12px_var(--font-sans)] text-foreground",
    dashboardActivityStatusSub:
        "[font:500_11px_var(--font-mono)] text-muted-foreground",
    dashboardActivitySync:
        "h-[26px] gap-[7px] rounded-[7px] border border-transparent bg-transparent px-[10px] text-[12px] font-semibold leading-normal text-muted-foreground shadow-none hover:bg-accent hover:text-accent-foreground data-[action-state=error]:text-destructive disabled:cursor-not-allowed has-[>svg]:px-[10px]",
    dashboardActivityItems:
        "m-0 max-h-[340px] flex-1 list-none overflow-y-auto p-1 empty:hidden",
    dashboardActivityItem:
        "grid grid-cols-[26px_1fr_auto] items-start gap-2.5 rounded-lg p-2.5 [&+&]:rounded-none [&+&]:border-t [&+&]:border-border data-[kind=error]:[&_[data-sot-part=dashboard-activity-item-icon]]:border-destructive/30 data-[kind=error]:[&_[data-sot-part=dashboard-activity-item-icon]]:bg-destructive/10 data-[kind=error]:[&_[data-sot-part=dashboard-activity-item-icon]]:text-destructive data-[kind=info]:[&_[data-sot-part=dashboard-activity-item-icon]]:border-primary/30 data-[kind=info]:[&_[data-sot-part=dashboard-activity-item-icon]]:bg-primary/10 data-[kind=info]:[&_[data-sot-part=dashboard-activity-item-icon]]:text-primary data-[kind=partial-failed]:[&_[data-sot-part=dashboard-activity-item-icon]]:border-border data-[kind=partial-failed]:[&_[data-sot-part=dashboard-activity-item-icon]]:bg-secondary data-[kind=partial-failed]:[&_[data-sot-part=dashboard-activity-item-icon]]:text-secondary-foreground data-[kind=queued]:[&_[data-sot-part=dashboard-activity-item-icon]]:bg-muted data-[kind=queued]:[&_[data-sot-part=dashboard-activity-item-icon]]:text-muted-foreground data-[kind=success]:[&_[data-sot-part=dashboard-activity-item-icon]]:border-primary/30 data-[kind=success]:[&_[data-sot-part=dashboard-activity-item-icon]]:bg-primary/10 data-[kind=success]:[&_[data-sot-part=dashboard-activity-item-icon]]:text-primary data-[kind=warn]:[&_[data-sot-part=dashboard-activity-item-icon]]:border-border data-[kind=warn]:[&_[data-sot-part=dashboard-activity-item-icon]]:bg-secondary data-[kind=warn]:[&_[data-sot-part=dashboard-activity-item-icon]]:text-secondary-foreground",
    dashboardActivityItemIcon:
        "inline-flex size-[26px] flex-none items-center justify-center rounded-[7px] border border-border bg-muted text-muted-foreground",
    dashboardActivityItemCopy: "flex min-w-0 flex-col gap-[3px]",
    dashboardActivityItemTitle:
        "[font:600_12.5px/1.35_var(--font-sans)] [margin:0] text-foreground",
    dashboardActivityItemBody:
        "[font:500_12px/1.5_var(--font-sans)] [margin:2px_0_0] text-muted-foreground",
    dashboardActivityItemMeta:
        "mt-1 [font:500_11px/1.4_var(--font-mono)] tracking-[0.02em] text-muted-foreground",
    dashboardActivityItemActions: "mt-1.5 flex items-center gap-1.5",
    dashboardActivityAction:
        "h-[26px] gap-[7px] rounded-[7px] border border-transparent bg-transparent px-[10px] text-[12px] font-semibold leading-normal text-muted-foreground shadow-none hover:bg-accent hover:text-accent-foreground data-[action-state=error]:text-destructive disabled:cursor-not-allowed has-[>svg]:px-[10px]",
    dashboardActivityDismiss:
        "size-[22px] rounded-[6px] border border-transparent bg-transparent p-px text-muted-foreground shadow-none hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring has-[>svg]:p-0",
    dashboardActivityEmpty: "p-7 md:p-7 [&[hidden]]:hidden",
} as const;

const dashboardButtonClassNames = {
    nav: "relative h-auto w-full justify-start gap-2.5 rounded-[9px] border border-transparent bg-transparent px-2.5 py-[7px] text-left text-[13px] font-medium text-muted-foreground shadow-none hover:bg-accent hover:text-foreground focus-visible:text-foreground disabled:cursor-not-allowed disabled:opacity-50 data-[sot-state=selected]:border-border data-[sot-state=selected]:bg-card data-[sot-state=selected]:text-foreground data-[sot-state=selected]:shadow-xs has-[>svg]:px-2.5",
    sync: "size-[32px] bg-transparent text-muted-foreground shadow-none hover:bg-accent hover:text-foreground",
    copy: "h-[26px] gap-[6px] rounded-[7px] border border-transparent bg-transparent px-[10px] text-[12px] font-semibold leading-normal text-muted-foreground shadow-none hover:bg-accent hover:text-accent-foreground data-[copy-state=ok]:border-primary/30 data-[copy-state=ok]:bg-primary/10 data-[copy-state=ok]:text-primary data-[copy-state=ok]:hover:bg-primary/10 data-[copy-state=ok]:hover:text-primary data-[copy-state=err]:border-destructive/30 data-[copy-state=err]:text-destructive data-[copy-state=err]:hover:bg-transparent data-[copy-state=err]:hover:text-destructive has-[>svg]:px-[10px] [&[hidden]]:hidden",
    compactAction:
        "h-[26px] gap-[7px] rounded-[7px] border border-transparent bg-transparent px-[10px] text-[12px] font-semibold text-muted-foreground shadow-none hover:bg-accent hover:text-accent-foreground has-[>svg]:px-[10px]",
    speakersMerge:
        "h-[26px] gap-[7px] rounded-[7px] border border-transparent bg-transparent px-[10px] text-[12px] font-semibold text-muted-foreground shadow-none hover:bg-accent hover:text-accent-foreground has-[>svg]:px-[10px]",
    drawerTrigger:
        "relative hidden h-auto w-auto rounded-md bg-transparent px-[6px] py-px text-foreground shadow-none hover:bg-accent hover:text-foreground max-[860px]:inline-flex group-data-[source-filter-active=true]/dashboard-workstation:[&_[data-sot-part=dashboard-drawer-active-dot]]:inline-block",
    sidebarCollapse:
        "size-[22px] rounded-full border border-border bg-card text-muted-foreground shadow-sm hover:bg-accent hover:text-foreground max-[860px]:hidden",
    settingsAvatar:
        "size-[30px] rounded-full border-0 bg-primary text-xs font-semibold text-primary-foreground shadow-xs hover:scale-[1.04] hover:bg-primary/90 hover:text-primary-foreground",
    listStatePrimary:
        "h-8 gap-1.5 rounded-md bg-primary px-3 text-primary-foreground shadow-xs hover:bg-primary/90 has-[>svg]:px-2.5",
    listStateAction:
        "h-8 gap-1.5 rounded-md bg-transparent px-3 text-muted-foreground shadow-none hover:bg-accent hover:text-accent-foreground has-[>svg]:px-2.5",
    listPagination:
        "h-8 gap-1.5 rounded-md bg-transparent px-3 text-muted-foreground shadow-none hover:bg-accent hover:text-accent-foreground has-[>svg]:px-2.5",
    headerIconButton:
        "size-[32px] border border-transparent bg-transparent p-0 text-muted-foreground shadow-none hover:bg-accent hover:text-accent-foreground",
    headerActionButton:
        "h-8 min-w-[103px] gap-[7px] rounded-[9px] border border-border bg-card px-3 font-sans text-[12.5px] font-semibold leading-normal text-foreground shadow-xs hover:bg-accent hover:text-accent-foreground has-[>svg]:px-3",
} as const;

const dashboardRetranscriptionThemeClassName = "text-foreground";

const dashboardRetranscriptionClassNames = {
    disabledHint:
        "block rounded-[4px] border border-border bg-muted px-[6px] py-[2px] [font:500_11px_var(--font-sans)] text-muted-foreground [&[hidden]]:hidden",
    banner: "group/retx flex items-center gap-[10px] border-b border-border bg-muted px-[14px] py-[10px] data-[retx-state=completed]:border-primary/30 data-[retx-state=completed]:bg-primary/10 data-[retx-state=failed]:border-destructive/30 data-[retx-state=failed]:bg-destructive/10 data-[retx-state=idle]:hidden data-[retx-state=queued]:border-primary/30 data-[retx-state=queued]:bg-primary/10 data-[retx-state=running]:border-primary/30 data-[retx-state=running]:bg-primary/10 [&[hidden]]:hidden",
    icon: "inline-flex size-[28px] flex-none items-center justify-center rounded-[50%] border border-border bg-card text-muted-foreground group-data-[retx-state=completed]/retx:border-primary/30 group-data-[retx-state=completed]/retx:text-primary group-data-[retx-state=failed]/retx:border-destructive/30 group-data-[retx-state=failed]/retx:text-destructive group-data-[retx-state=queued]/retx:border-primary/30 group-data-[retx-state=queued]/retx:text-primary group-data-[retx-state=running]/retx:border-primary/30 group-data-[retx-state=running]/retx:text-primary",
    spinner:
        "h-[12px] w-[12px] rounded-[50%] border-[1.6px] border-primary border-t-transparent border-r-primary animate-[spin_700ms_linear_infinite]",
    body: "flex min-w-0 flex-1 flex-col gap-[2px]",
    title: "[font:600_12.5px_var(--font-sans)] text-foreground",
    sub: "[font:500_11.5px_var(--font-sans)] text-muted-foreground",
    actions: "flex flex-none items-center gap-[6px]",
    closeButton: "p-0",
    refreshMarker:
        "inline-flex items-center gap-[4px] rounded-full bg-primary/10 px-[6px] py-px font-mono ![font-size:10.5px] font-medium ![line-height:normal] text-primary [margin:0] [&[hidden]]:hidden",
} as const;

const dashboardSourceErrorClassName =
    "px-[10px] py-1.5 font-sans text-[11.5px] font-medium text-destructive";

const dashboardSourceClassNames = {
    root: "group/source-provider relative h-auto w-full justify-start gap-2.5 rounded-[9px] border border-transparent bg-transparent px-2.5 py-[7px] text-left text-[13px] font-medium text-muted-foreground shadow-none hover:bg-accent hover:text-foreground focus-visible:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 data-[sot-state=selected]:border-border data-[sot-state=selected]:bg-card data-[sot-state=selected]:text-foreground data-[sot-state=selected]:shadow-xs data-[sot-state=connected-active]:border-border data-[sot-state=connected-active]:bg-card data-[sot-state=connected-active]:text-foreground data-[sot-state=connected-active]:shadow-xs data-[sot-state=connected-idle]:text-muted-foreground data-[sot-state=syncing]:text-muted-foreground data-[sot-state=expired]:text-muted-foreground data-[sot-state=sync-error]:text-foreground data-[sot-state=no-results]:text-muted-foreground data-[sot-state=needs-setup]:text-muted-foreground data-[sot-state=disabled]:text-muted-foreground data-[sot-state=disabled]:opacity-[0.55] has-[>svg]:px-2.5 [&_[data-sot-part=source-provider-mark]]:inline-flex [&_[data-sot-part=source-provider-mark]]:size-[18px] [&_[data-sot-part=source-provider-mark]]:flex-none [&_[data-sot-part=source-provider-mark]]:items-center [&_[data-sot-part=source-provider-mark]]:justify-center [&_[data-sot-part=source-provider-mark]]:overflow-hidden [&_[data-sot-part=source-provider-mark]]:rounded-[4px] [&_[data-sot-part=source-provider-mark]]:border [&_[data-sot-part=source-provider-mark]]:border-border [&_[data-sot-part=source-provider-mark]]:bg-background data-[sot-state=no-results]:[&_[data-sot-part=source-provider-mark]]:opacity-[0.65] data-[sot-state=needs-setup]:[&_[data-sot-part=source-provider-mark]]:opacity-60 data-[sot-state=needs-setup]:[&_[data-sot-part=source-provider-mark]]:grayscale data-[sot-state=disabled]:[&_[data-sot-part=source-provider-mark]]:grayscale-[0.7] [&_[data-sot-part=source-provider-mark][data-sot-variant=letter]]:[font:700_9px_var(--font-sans)] [&_[data-sot-part=source-provider-mark][data-sot-variant=letter]]:text-muted-foreground [&_[data-sot-part=source-provider-mark][data-sot-variant=letter]]:bg-muted [&_[data-sot-part=source-provider-mark]_img]:block [&_[data-sot-part=source-provider-mark]_img]:size-[18px] [&_[data-sot-part=source-provider-mark]_img]:max-w-none [&_[data-sot-part=source-provider-mark]_img]:object-contain [&_[data-sot-part=source-provider-mark]_img]:align-baseline [&_[data-sot-part=source-provider-mark][data-sot-provider-cover=true]_img]:object-cover",
    clear: "h-[22px] w-fit gap-1 rounded-full border border-transparent bg-transparent px-[9px] text-[11px] font-semibold leading-normal text-muted-foreground shadow-none hover:bg-accent hover:text-accent-foreground has-[>svg]:px-[9px]",
    action: "ml-[6px] h-[22px] flex-none cursor-pointer gap-1 rounded-full border border-border bg-card px-[9px] font-sans text-[11px] font-semibold leading-none text-muted-foreground whitespace-nowrap shadow-none hover:bg-accent hover:text-accent-foreground focus-visible:border-transparent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 data-[sot-action=retry]:hidden data-[sot-action=retry]:border-destructive/30 data-[sot-action=retry]:bg-destructive/10 data-[sot-action=retry]:text-destructive data-[sot-action=retry]:hover:bg-destructive/10 data-[sot-action=connect]:border-primary/30 data-[sot-action=connect]:bg-primary/10 data-[sot-action=connect]:text-primary group-hover/source-provider:data-[sot-action=retry]:inline-flex group-focus-within/source-provider:data-[sot-action=retry]:inline-flex group-data-[sidebar-collapsed=true]/dashboard-workstation:hidden has-[>svg]:px-[9px]",
    status: "ml-0.5 size-1.5 min-w-1.5 self-center rounded-full border-0 bg-transparent p-0 data-[sot-effect=ring]:ring-2 data-[sot-effect=ring]:ring-secondary data-[sot-tone=disabled]:bg-muted-foreground/40 data-[sot-tone=err]:bg-destructive data-[sot-tone=err]:ring-2 data-[sot-tone=err]:ring-destructive/15 data-[sot-tone=ok]:bg-primary data-[sot-tone=syncing]:animate-[bpulse_1.2s_ease-in-out_infinite] data-[sot-tone=syncing]:bg-primary data-[sot-tone=syncing]:ring-2 data-[sot-tone=syncing]:ring-primary/15 data-[sot-tone=warn]:bg-secondary-foreground",
    count: "min-w-[22px] rounded-[5px] border border-transparent bg-muted px-[6px] py-px text-center font-mono text-[11px] font-medium leading-[1.45] text-muted-foreground data-[sot-tone=active]:border-border data-[sot-tone=active]:bg-card data-[sot-tone=active]:text-foreground data-[sot-tone=empty]:border-border data-[sot-tone=empty]:bg-transparent data-[sot-tone=empty]:text-muted-foreground data-[sot-tone=empty]:line-through data-[sot-tone=err]:border-destructive/30 data-[sot-tone=err]:bg-destructive/10 data-[sot-tone=err]:text-destructive",
} as const;

const sourceFilterClassNames = {
    clear: "size-4 rounded-full border border-transparent bg-transparent p-0 text-muted-foreground shadow-none hover:bg-accent hover:text-accent-foreground",
    librarySearchFilterClear:
        "size-4 rounded-full border border-transparent bg-transparent p-0 text-muted-foreground shadow-none hover:bg-accent hover:text-accent-foreground",
    action: "ml-[6px] h-[22px] flex-none cursor-pointer gap-1 rounded-full border border-border bg-card px-[9px] font-sans text-[11px] font-semibold leading-none text-muted-foreground whitespace-nowrap shadow-none hover:bg-accent hover:text-accent-foreground focus-visible:border-transparent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 data-[sot-action=open-settings]:border-primary/30 data-[sot-action=open-settings]:bg-primary/10 data-[sot-action=open-settings]:text-primary data-[sot-action=retry]:border-destructive/30 data-[sot-action=retry]:bg-destructive/10 data-[sot-action=retry]:text-destructive data-[sot-action=retry]:hover:bg-destructive/10 data-[sot-action=widen]:border-primary/30 data-[sot-action=widen]:bg-primary/10 data-[sot-action=widen]:text-primary has-[>svg]:px-[9px]",
    clearAll:
        "h-6 rounded-md bg-transparent px-2 text-sm text-primary underline-offset-4 shadow-none hover:bg-transparent hover:text-primary hover:underline has-[>svg]:px-2",
} as const;

const sourceFilterStackClassNames = {
    root: "flex min-w-0 flex-row flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-border bg-muted px-3 py-2 font-sans text-[11.5px] font-medium text-muted-foreground",
    from: "inline-flex min-w-0 max-w-full flex-[0_1_auto] items-baseline overflow-hidden text-ellipsis whitespace-nowrap leading-[22px] [&_b]:whitespace-nowrap [&_b]:font-bold [&_b]:text-foreground",
    separator:
        "inline-flex h-[22px] w-2.5 flex-none select-none items-center justify-center text-[13px] leading-none text-muted-foreground/60",
    chip: "inline-flex h-[22px] flex-none items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card py-0 pl-1.5 pr-1 font-sans text-[11.5px] font-semibold leading-none text-foreground",
    label: "whitespace-nowrap",
    info: "inline-flex min-w-0 flex-[0_1_auto] items-center overflow-hidden text-ellipsis whitespace-nowrap leading-[22px] text-muted-foreground [&_b]:mx-0.5 [&_b]:font-bold [&_b]:text-foreground",
    libraryRoot:
        "mt-1.5 flex items-center gap-1.5 font-sans text-[11.5px] font-medium text-muted-foreground",
    libraryLabel: "truncate",
} as const;

function dashboardSourceButtonClassName(collapsed: boolean) {
    return cn(
        dashboardSourceClassNames.root,
        collapsed && "justify-center gap-0 px-0 py-2",
    );
}

function dashboardRecordingTimeFilterCountClassName(active: boolean) {
    return cn(
        dashboardRecordingTimeFilterStyles.count,
        active && dashboardRecordingTimeFilterStyles.countSelected,
    );
}

const dashboardRecordingRowStyles = {
    rows: "flex flex-col gap-0.5 p-1",
    group: "flex flex-col gap-0.5 px-1 py-1.5",
    groupSeparator: "mx-1 my-1",
    groupHeading: "flex items-baseline gap-2.5 px-2.5 pb-1.5 pt-3.5",
    groupLabel:
        "font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground",
    groupCount: "font-mono text-[11px] font-medium text-muted-foreground/70",
    groupDivider: "ml-1 min-w-0 flex-1",
    row: "grid h-auto w-full grid-cols-[minmax(0,1fr)_auto] items-center justify-normal gap-[14px] whitespace-normal rounded-[10px] border !border-transparent bg-transparent px-[12px] py-[11px] text-left text-[13.3333px] font-normal leading-normal !shadow-none hover:!bg-muted hover:text-foreground focus:!border-ring focus:!outline-none focus:![outline-width:0px] focus:!ring-[3px] focus:!ring-ring/50 focus-visible:!border-ring focus-visible:!outline-none focus-visible:![outline-width:0px] focus-visible:!ring-[3px] focus-visible:!ring-ring/50 data-[sot-state=selected]:!border-primary/30 data-[sot-state=selected]:bg-primary/10 [&.is-hover-demo]:!bg-muted [&.is-hover-demo]:text-foreground [&.is-focus-demo]:!border-ring [&.is-focus-demo]:!outline-none [&.is-focus-demo]:![outline-width:0px] [&.is-focus-demo]:!ring-[3px] [&.is-focus-demo]:!ring-ring/50",
    body: "flex min-w-0 flex-col gap-[5px]",
    title: "truncate font-sans text-[13.5px] font-semibold tracking-[-0.005em] text-foreground",
    meta: "flex flex-wrap items-center gap-2",
    sourceMark:
        "inline-flex size-[14px] flex-none items-center justify-center overflow-hidden rounded-[3px] opacity-[0.55] dark:opacity-60",
    sourceMarkImage:
        "block size-[14px] max-w-none object-contain align-baseline grayscale contrast-[0.85] dark:brightness-[1.4]",
    sourceMarkImageCover: "object-cover",
    sourceMarkLetter:
        "border border-border bg-muted [font:700_9px_var(--font-sans)] text-muted-foreground",
    duration:
        "font-mono text-[11.5px] font-medium tracking-[0.02em] text-muted-foreground",
    secondary:
        "flex items-center gap-2 font-mono text-[11px] font-medium text-muted-foreground",
    timestamp: "tracking-[0.015em]",
    timestampAbsolute:
        "hidden group-data-[time-style=abs]/dashboard-workstation:inline",
    timestampRelative:
        "inline group-data-[time-style=abs]/dashboard-workstation:hidden",
    actions:
        "flex w-max min-w-max flex-none items-center justify-end justify-self-end gap-2",
} as const;

function tagFilterValue(tagId: string): TagFilterValue {
    return `tag:${tagId}`;
}

function tagIdFromFilter(value: TagFilterValue) {
    return value.startsWith("tag:") ? value.slice(4) : null;
}

function providerLabel(provider: string, language: UiLanguage) {
    return (
        getSourceProviderLabel(provider, language) ??
        SOURCE_ORDER.find((source) => source.key === provider)?.label ??
        provider
    );
}

function transcriptLanguageLabel(
    detectedLanguage: string | null | undefined,
    language: UiLanguage,
) {
    const normalized = detectedLanguage?.trim().toLowerCase();
    if (!normalized) {
        return language === "zh-CN" ? "自动识别" : "Auto detect";
    }
    if (normalized === "zh" || normalized.startsWith("zh-")) {
        return language === "zh-CN" ? "中文 · 自动识别" : "Chinese · Auto";
    }
    if (normalized === "en" || normalized.startsWith("en-")) {
        return language === "zh-CN" ? "英文 · 自动识别" : "English · Auto";
    }
    return language === "zh-CN"
        ? `${detectedLanguage} · 自动识别`
        : `${detectedLanguage} · Auto`;
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

function getDayBucket(value: string) {
    const bucket = getTimelineFilter(value);
    if (bucket === "today") return "今天";
    if (bucket === "yesterday") return "昨天";
    return "更早";
}

function getTimelineFilter(value: string): TimelineFilter {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "earlier";
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dayDiff = Math.floor(
        (today.getTime() - start.getTime()) / 86_400_000,
    );
    if (dayDiff === 0) return "today";
    if (dayDiff === 1) return "yesterday";
    return "earlier";
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

function formatTranscriptTurnTimestamp(
    startMs: number | null | undefined,
    endMs: number | null | undefined,
) {
    const start = formatSourceReportTimestamp(startMs);
    const end = formatSourceReportTimestamp(endMs);
    if (start && end && start !== end) {
        return `${start} – ${end}`;
    }
    return start ?? end;
}

function formatTranscriptAvatarLabel(speakerName: string, index: number) {
    const trimmed = speakerName.trim();
    const genericMatch = trimmed.match(/^(?:Speaker|说话人)\s*(\d+)$/i);
    if (genericMatch?.[1]) {
        return genericMatch[1];
    }

    return Array.from(trimmed)[0] ?? `${index + 1}`;
}

function formatLibrarySearchTimestamp(valueMs: number | null | undefined) {
    const timestamp = formatSourceTimestamp(valueMs);
    if (!timestamp) return "--";
    const parts = timestamp.split(":");
    if (parts.length === 2) {
        return `${parts[0].padStart(2, "0")}:${parts[1]}`;
    }
    return timestamp;
}

function LibrarySearchTagIcon() {
    return (
        <Tags
            className={DASHBOARD_MICRO_ICON_CLASS_NAME}
            data-icon="inline-start"
            aria-hidden="true"
        />
    );
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

const SOT_DASHBOARD_DETAIL_HEADER_CLASS_NAME =
    "relative flex flex-row items-center gap-2.5 px-1 pt-1 pb-0 data-[sot-state=saving]:py-0";

const SOT_DASHBOARD_DETAIL_HEADER_TITLE_CLASS_NAME =
    "m-0 min-w-0 flex-1 truncate font-display text-[22px] font-semibold leading-normal tracking-[-0.014em] text-foreground";

const SOT_DASHBOARD_DETAIL_HEADER_TITLE_INPUT_CLASS_NAME =
    "h-8 min-w-0 flex-1 px-3 py-1 text-base md:text-sm";

const SOT_DASHBOARD_DETAIL_HEADER_BADGE_CLASS_NAME = "ml-1 shrink-0";
const SOT_DASHBOARD_DETAIL_HEADER_ACTION_ANCHOR_CLASS_NAME =
    "relative inline-flex items-center gap-1.5";
const SOT_DASHBOARD_MORE_MENU_CONTENT_CLASS_NAME =
    "!border-border !bg-popover !p-[6px] !text-popover-foreground !shadow-md";
const SOT_DASHBOARD_MORE_MENU_ITEM_CLASS_NAME =
    "!min-h-[32px] !cursor-pointer !gap-[10px] !px-[10px] !py-[6px] !text-left data-[disabled]:!cursor-not-allowed data-[disabled]:!bg-muted data-[disabled]:!text-muted-foreground";
const SOT_DASHBOARD_MORE_MENU_SEPARATOR_CLASS_NAME = "!mx-[2px] !my-[4px]";
const SOT_DASHBOARD_MORE_MENU_HINT_CLASS_NAME = "mr-[0.5px]";

const SOT_DASHBOARD_TRANSCRIPT_LANGUAGE_BADGE_CLASS_NAME = "gap-1.5";
const SOT_DASHBOARD_TRANSCRIPT_HEADER_CLASS_NAME =
    "flex flex-row flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-3.5 py-3";
const SOT_DASHBOARD_TRANSCRIPT_SEGMENTED_TABS_CLASS_NAME = "shrink-0";
const SOT_DASHBOARD_TRANSCRIPT_ACTIONS_CLASS_NAME =
    "ml-auto inline-flex max-w-full flex-[0_1_auto] flex-wrap items-center gap-2";
const SOT_DASHBOARD_TRANSCRIPT_BODY_BASE_CLASS_NAME =
    "min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-5";

const SOT_DASHBOARD_TRANSCRIPT_SHELL_CARD_CLASS_NAME =
    "flex min-h-0 flex-1 flex-col gap-0 rounded-[16px] border border-border bg-card shadow-sm backdrop-blur-none";

const SOT_DASHBOARD_RECORDING_PLAYER_CARD_CLASS_NAME =
    "block min-h-[114px] gap-0 overflow-visible rounded-[16px] border border-border bg-card px-[18px] py-[16px] shadow-none backdrop-blur-none";

const SOT_DASHBOARD_RECORDING_PLAYER_META_CLASS_NAME =
    "mb-[12px] flex flex-row flex-wrap items-center gap-[10px] p-0";

const SOT_DASHBOARD_RECORDING_PLAYER_DATE_CLASS_NAME =
    "translate-y-px font-mono text-[11.5px] font-medium tracking-[0.02em] text-muted-foreground";

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
    tone: SotPlayerStatusTone;
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
            tone: "err" satisfies SotPlayerStatusTone,
        };
    }
    if (isActiveTranscriptionJob(job)) {
        return {
            label: t("recordingList.status.transcribing"),
            tone: "warn" satisfies SotPlayerStatusTone,
        };
    }
    if (hasTranscriptContent(transcription) || transcription?.hasTranscript) {
        return {
            label: t("recordingList.status.updated"),
            tone: "ok" satisfies SotPlayerStatusTone,
        };
    }
    if (recording.upstreamDeleted) {
        return {
            label: t("recordingList.status.localOnly"),
            tone: "info" satisfies SotPlayerStatusTone,
        };
    }
    return {
        label: t("recordingList.status.pending"),
        tone: "neu" satisfies SotPlayerStatusTone,
    };
}

const SOT_DASHBOARD_RECORDING_STATUS_BADGE_CLASS =
    "h-[20px] justify-normal gap-[5px] overflow-visible rounded-[999px] border px-[8px] py-0 [font:600_11px_var(--font-sans)] tracking-[0.005em] shadow-none data-[sot-tone=ok]:border-primary/30 data-[sot-tone=ok]:bg-primary/10 data-[sot-tone=ok]:text-primary data-[sot-tone=warn]:border-border data-[sot-tone=warn]:bg-secondary data-[sot-tone=warn]:text-secondary-foreground data-[sot-tone=err]:border-destructive/30 data-[sot-tone=err]:bg-destructive/10 data-[sot-tone=err]:text-destructive data-[sot-tone=info]:border-primary/30 data-[sot-tone=info]:bg-primary/10 data-[sot-tone=info]:text-primary data-[sot-tone=neu]:border-border data-[sot-tone=neu]:bg-muted data-[sot-tone=neu]:text-muted-foreground [&_[data-sot-part=dashboard-recording-status-dot]]:size-[5px] [&_[data-sot-part=dashboard-recording-status-dot]]:rounded-full [&_[data-sot-part=dashboard-recording-status-dot]]:bg-current data-[sot-tone=neu]:[&_[data-sot-part=dashboard-recording-status-dot]]:bg-muted-foreground data-[sot-tone=warn]:[&_[data-sot-part=dashboard-recording-status-dot]]:animate-[bpulse_1.4s_ease-in-out_infinite]";

function SotDashboardRecordingStatusBadge({
    className,
    label,
    tone,
}: {
    className?: string;
    label: string;
    tone: SotPlayerStatusTone;
}) {
    return (
        <Badge
            variant="ghost"
            className={cn(
                SOT_DASHBOARD_RECORDING_STATUS_BADGE_CLASS,
                className,
            )}
            data-sot-part="dashboard-recording-status"
            data-sot-tone={tone}
        >
            <span data-sot-part="dashboard-recording-status-dot" />
            {label}
        </Badge>
    );
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

function getFavoriteLabel(value: Favorite, t: Translator) {
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

function syncSystemBannerState(error: string | null | undefined) {
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

function searchResultAction(result: SearchResult) {
    if (result.entityType === "tag" || result.entityType === "speaker") {
        return "filter";
    }
    return result.recordingId ? "open" : "disabled";
}

function searchResultFilterLabel(result: SearchResult) {
    if (result.entityType === "speaker") {
        return result.speaker || result.title || result.body;
    }
    return result.title || result.tags?.[0] || result.body;
}

function RetxWarnIcon() {
    return (
        <CircleAlert
            className={DASHBOARD_RETRANSCRIPTION_ICON_CLASS_NAME}
            data-sot-part="dashboard-retranscription-icon-warn"
            aria-hidden="true"
        />
    );
}

function RetxOkIcon() {
    return (
        <Check
            className={DASHBOARD_RETRANSCRIPTION_ICON_CLASS_NAME}
            data-sot-part="dashboard-retranscription-icon-ok"
            aria-hidden="true"
        />
    );
}

function RetxCloseIcon() {
    return (
        <X
            className={DASHBOARD_RETRANSCRIPTION_CLOSE_ICON_CLASS_NAME}
            aria-hidden="true"
            focusable="false"
        />
    );
}

function SotCopyIcon({ state }: { state?: "err" | "ok" }) {
    const Icon = state === "ok" ? Check : Copy;

    return (
        <Icon
            className={sourceReportClassNames.copyIcon}
            data-icon="inline-start"
            data-sot-part="dashboard-copy-icon"
            aria-hidden="true"
        />
    );
}

function SotTranscriptEmptyIcon() {
    return <MessageSquareText aria-hidden="true" focusable="false" />;
}

function SotDetailEmptyIcon() {
    return <Music aria-hidden="true" focusable="false" />;
}

function DashboardDetailEmptyState() {
    return (
        <Empty
            className={DASHBOARD_DETAIL_EMPTY_STATE_CLASS_NAME}
            data-detail-empty=""
            data-sot-panel="dashboard-detail-empty"
        >
            <EmptyHeader>
                <EmptyMedia
                    data-sot-part="dashboard-detail-empty-icon"
                    variant="icon"
                    aria-hidden="true"
                >
                    <SotDetailEmptyIcon />
                </EmptyMedia>
                <EmptyTitle data-sot-part="dashboard-detail-empty-title">
                    请选择一条录音
                </EmptyTitle>
                <EmptyDescription data-sot-part="dashboard-detail-empty-description">
                    在左侧列表中挑一条录音，转写与说话人信息会显示在这里。
                </EmptyDescription>
            </EmptyHeader>
        </Empty>
    );
}

function SotSourceReportErrorIcon() {
    return (
        <svg
            aria-hidden="true"
            fill="none"
            focusable="false"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
            viewBox="0 0 24 24"
        >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
    );
}

function SotSourceReportEmptyIcon() {
    return <FileText aria-hidden="true" focusable="false" />;
}

function SotRecordingListSkeleton() {
    return (
        <div
            className={dashboardRecordingListLoadingSkeletonClassNames.root}
            data-sot-panel="recording-list-loading"
        >
            <div
                className={dashboardRecordingListLoadingSkeletonClassNames.day}
                data-sot-part="skeleton-day"
            >
                <Skeleton
                    className={
                        dashboardRecordingListLoadingSkeletonClassNames.dayLabel
                    }
                    data-sot-part="skeleton-day-label"
                />
                <span
                    className={
                        dashboardRecordingListLoadingSkeletonClassNames.dayLine
                    }
                    data-sot-part="skeleton-day-line"
                />
            </div>
            <div
                className={dashboardRecordingListLoadingSkeletonClassNames.row}
                data-sot-part="skeleton-row"
            >
                <div
                    className={
                        dashboardRecordingListLoadingSkeletonClassNames.rowBody
                    }
                    data-sot-part="skeleton-row-body"
                >
                    <Skeleton
                        className={
                            dashboardRecordingListLoadingSkeletonClassNames.title
                        }
                        data-sot-part="skeleton-title"
                    />
                    <div
                        className={
                            dashboardRecordingListLoadingSkeletonClassNames.meta
                        }
                        data-sot-part="skeleton-meta"
                    >
                        <Skeleton
                            className={
                                dashboardRecordingListLoadingSkeletonClassNames.metaTime
                            }
                            data-sot-part="skeleton-meta-time"
                        />
                        <Skeleton
                            className={
                                dashboardRecordingListLoadingSkeletonClassNames.metaTag
                            }
                            data-sot-part="skeleton-meta-tag"
                        />
                        <Skeleton
                            className={
                                dashboardRecordingListLoadingSkeletonClassNames.metaPill
                            }
                            data-sot-part="skeleton-meta-pill"
                        />
                    </div>
                </div>
                <div data-sot-part="skeleton-row-tail">
                    <Skeleton
                        className={
                            dashboardRecordingListLoadingSkeletonClassNames.tag
                        }
                        data-sot-part="skeleton-tag"
                    />
                </div>
            </div>
            <div
                className={dashboardRecordingListLoadingSkeletonClassNames.row}
                data-sot-part="skeleton-row"
            >
                <div
                    className={
                        dashboardRecordingListLoadingSkeletonClassNames.rowBody
                    }
                    data-sot-part="skeleton-row-body"
                >
                    <Skeleton
                        className={
                            dashboardRecordingListLoadingSkeletonClassNames.title90
                        }
                        data-sot-part="skeleton-title"
                        data-sot-size="90"
                    />
                    <div
                        className={
                            dashboardRecordingListLoadingSkeletonClassNames.meta
                        }
                        data-sot-part="skeleton-meta"
                    >
                        <Skeleton
                            className={
                                dashboardRecordingListLoadingSkeletonClassNames.metaTime
                            }
                            data-sot-part="skeleton-meta-time"
                        />
                        <Skeleton
                            className={
                                dashboardRecordingListLoadingSkeletonClassNames.metaTag
                            }
                            data-sot-part="skeleton-meta-tag"
                        />
                        <Skeleton
                            className={
                                dashboardRecordingListLoadingSkeletonClassNames.metaPill70
                            }
                            data-sot-part="skeleton-meta-pill"
                            data-sot-size="70"
                        />
                    </div>
                </div>
                <div data-sot-part="skeleton-row-tail">
                    <Skeleton
                        className={
                            dashboardRecordingListLoadingSkeletonClassNames.tag
                        }
                        data-sot-part="skeleton-tag"
                    />
                </div>
            </div>
            <div
                className={dashboardRecordingListLoadingSkeletonClassNames.day}
                data-sot-part="skeleton-day"
            >
                <Skeleton
                    className={
                        dashboardRecordingListLoadingSkeletonClassNames.dayLabel40
                    }
                    data-sot-part="skeleton-day-label"
                    data-sot-size="40"
                />
                <span
                    className={
                        dashboardRecordingListLoadingSkeletonClassNames.dayLine
                    }
                    data-sot-part="skeleton-day-line"
                />
            </div>
            <div
                className={dashboardRecordingListLoadingSkeletonClassNames.row}
                data-sot-part="skeleton-row"
            >
                <div
                    className={
                        dashboardRecordingListLoadingSkeletonClassNames.rowBody
                    }
                    data-sot-part="skeleton-row-body"
                >
                    <Skeleton
                        className={
                            dashboardRecordingListLoadingSkeletonClassNames.title80
                        }
                        data-sot-part="skeleton-title"
                        data-sot-size="80"
                    />
                    <div
                        className={
                            dashboardRecordingListLoadingSkeletonClassNames.meta
                        }
                        data-sot-part="skeleton-meta"
                    >
                        <Skeleton
                            className={
                                dashboardRecordingListLoadingSkeletonClassNames.metaTime
                            }
                            data-sot-part="skeleton-meta-time"
                        />
                        <Skeleton
                            className={
                                dashboardRecordingListLoadingSkeletonClassNames.metaTag
                            }
                            data-sot-part="skeleton-meta-tag"
                        />
                        <Skeleton
                            className={
                                dashboardRecordingListLoadingSkeletonClassNames.metaPill
                            }
                            data-sot-part="skeleton-meta-pill"
                        />
                    </div>
                </div>
                <div data-sot-part="skeleton-row-tail" />
            </div>
            <div
                className={dashboardRecordingListLoadingSkeletonClassNames.row}
                data-sot-part="skeleton-row"
            >
                <div
                    className={
                        dashboardRecordingListLoadingSkeletonClassNames.rowBody
                    }
                    data-sot-part="skeleton-row-body"
                >
                    <Skeleton
                        className={
                            dashboardRecordingListLoadingSkeletonClassNames.title70
                        }
                        data-sot-part="skeleton-title"
                        data-sot-size="70"
                    />
                    <div
                        className={
                            dashboardRecordingListLoadingSkeletonClassNames.meta
                        }
                        data-sot-part="skeleton-meta"
                    >
                        <Skeleton
                            className={
                                dashboardRecordingListLoadingSkeletonClassNames.metaTime
                            }
                            data-sot-part="skeleton-meta-time"
                        />
                        <Skeleton
                            className={
                                dashboardRecordingListLoadingSkeletonClassNames.metaTag
                            }
                            data-sot-part="skeleton-meta-tag"
                        />
                    </div>
                </div>
                <div data-sot-part="skeleton-row-tail">
                    <Skeleton
                        className={
                            dashboardRecordingListLoadingSkeletonClassNames.tag
                        }
                        data-sot-part="skeleton-tag"
                    />
                </div>
            </div>
            <div
                className={dashboardRecordingListLoadingSkeletonClassNames.row}
                data-sot-part="skeleton-row"
            >
                <div
                    className={
                        dashboardRecordingListLoadingSkeletonClassNames.rowBody
                    }
                    data-sot-part="skeleton-row-body"
                >
                    <Skeleton
                        className={
                            dashboardRecordingListLoadingSkeletonClassNames.title85
                        }
                        data-sot-part="skeleton-title"
                        data-sot-size="85"
                    />
                    <div
                        className={
                            dashboardRecordingListLoadingSkeletonClassNames.meta
                        }
                        data-sot-part="skeleton-meta"
                    >
                        <Skeleton
                            className={
                                dashboardRecordingListLoadingSkeletonClassNames.metaTime
                            }
                            data-sot-part="skeleton-meta-time"
                        />
                        <Skeleton
                            className={
                                dashboardRecordingListLoadingSkeletonClassNames.metaTag
                            }
                            data-sot-part="skeleton-meta-tag"
                        />
                        <Skeleton
                            className={
                                dashboardRecordingListLoadingSkeletonClassNames.metaPill
                            }
                            data-sot-part="skeleton-meta-pill"
                        />
                    </div>
                </div>
                <div data-sot-part="skeleton-row-tail" />
            </div>
        </div>
    );
}

function searchResultTitle(result: SearchResult, t: Translator) {
    if (result.entityType === "transcript") {
        return (
            result.body || result.title || t("librarySearch.types.transcript")
        );
    }

    return (
        result.title ||
        result.body ||
        result.speaker ||
        result.tags?.[0] ||
        t("librarySearch.untitledResult")
    );
}

function searchResultMeta(result: SearchResult, t: Translator) {
    if (result.entityType === "transcript") {
        const timestamp = formatLibrarySearchTimestamp(result.startMs);
        return `${result.title || t("librarySearch.types.transcript")} · ${timestamp}`;
    }
    if (result.entityType === "tag") {
        return result.body || result.tags?.[0] || t("librarySearch.types.tag");
    }
    if (result.entityType === "speaker") {
        return (
            result.body || result.speaker || t("librarySearch.types.speaker")
        );
    }
    return result.source || result.body || t("librarySearch.types.recording");
}

function highlightSearchText(value: string, query: string) {
    const needle = query.trim();
    if (!needle) return value;
    const lowerValue = value.toLocaleLowerCase();
    const lowerNeedle = needle.toLocaleLowerCase();
    const index = lowerValue.indexOf(lowerNeedle);
    if (index < 0) return value;

    return (
        <>
            {value.slice(0, index)}
            <mark
                className={
                    dashboardSearchActivityClassNames.librarySearchHighlight
                }
                data-sot-part="library-search-highlight"
            >
                {value.slice(index, index + needle.length)}
            </mark>
            {value.slice(index + needle.length)}
        </>
    );
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
    user,
}: WorkstationProps) {
    const confirm = useConfirmDialog();
    const { language, t } = useLanguage();
    const router = useBrowserRouteController();
    const { hasLoaded: displaySettingsLoaded, settings: displaySettings } =
        useDisplaySettingsStore();
    const { hasLoaded: playbackSettingsLoaded, settings: playbackSettings } =
        usePlaybackSettingsStore();
    const [hydrated, setHydrated] = useState(false);
    const [liveRecordings, setLiveRecordings] = useState(recordings);
    const [liveTranscriptions, setLiveTranscriptions] =
        useState(transcriptions);
    const loadingTranscriptIdsRef = useRef<Set<string>>(new Set());
    const [loadingTranscriptIds, setLoadingTranscriptIds] = useState<
        Set<string>
    >(() => new Set());
    const [liveJobs, setLiveJobs] = useState(transcriptionJobs);
    const [favorite, setFavorite] = useState<Favorite>("all");
    const [source, setSource] = useState("all");
    const [selectedId, setSelectedId] = useState(recordings[0]?.id ?? "");
    const [collapsed, setCollapsed] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [listMode, setListMode] = useState<ListMode>("timeline");
    const [timelineFilter, setTimelineFilter] = useState<TimelineFilter>("all");
    const [selectedTagFilter, setSelectedTagFilter] =
        useState<TagFilterValue>("all");
    const [tagFilterOpen, setTagFilterOpen] = useState(false);
    const [listPage, setListPage] = useState(1);
    const [detailTab, setDetailTab] = useState<DetailTab>("transcript");
    const [query, setQuery] = useState("");
    const [searchScope, setSearchScope] = useState<SearchScope>("all");
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchError, setSearchError] = useState("");
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [searchIndexing, setSearchIndexing] =
        useState<SearchIndexingProgress | null>(null);
    const [activeSearchIndex, setActiveSearchIndex] = useState(0);
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
    const [searchRetry, setSearchRetry] = useState(0);
    const sourceDrawerRef = useRef<HTMLElement | null>(null);
    const drawerTriggerRef = useRef<HTMLButtonElement | null>(null);
    const searchTriggerRef = useRef<HTMLButtonElement | null>(null);
    const activityTriggerRef = useRef<HTMLButtonElement | null>(null);
    const settingsTriggerRef = useRef<HTMLButtonElement | null>(null);
    const moreTriggerRef = useRef<HTMLButtonElement | null>(null);
    const searchOverlayRef = useRef<HTMLDivElement | null>(null);
    const activityOverlayRef = useRef<HTMLDivElement | null>(null);
    const tagFilterRef = useRef<HTMLDivElement | null>(null);
    const searchInputRef = useRef<HTMLInputElement | null>(null);
    const restoreActivityFocusRef = useRef(false);
    const activityFocusRestoreTimerRefs = useRef<number[]>([]);
    const copyFeedbackTimerRef = useRef<number | null>(null);
    const sourceReportRequestRef = useRef<{
        controller: AbortController;
        id: number;
        recordingId: string;
    } | null>(null);
    const sourceReportRequestIdRef = useRef(0);
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

    useEffect(() => {
        setHydrated(true);
    }, []);

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
        workerStatus?.lastError ?? lastSyncResult?.error,
    );

    useEffect(() => {
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
        setSelectedId(recordings[0]?.id ?? "");
    }, [recordings]);

    useEffect(() => {
        setLiveTranscriptions(transcriptions);
    }, [transcriptions]);

    useEffect(() => {
        setLiveJobs(transcriptionJobs);
    }, [transcriptionJobs]);

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
        return liveRecordings.filter((recording) => {
            if (source !== "all" && recording.sourceProvider !== source) {
                return false;
            }
            if (librarySearchFilter?.type === "tag") {
                const tagMatch = recording.tags.some(
                    (tag) =>
                        tag.id === librarySearchFilter.label ||
                        tag.name === librarySearchFilter.label,
                );
                if (!tagMatch) return false;
            }
            if (librarySearchFilter?.type === "speaker") {
                const speakerNames = Object.values(
                    liveTranscriptions.get(recording.id)?.speakerMap ?? {},
                );
                const speakerMatch = speakerNames.some(
                    (name) => name === librarySearchFilter.label,
                );
                if (!speakerMatch) return false;
            }
            if (
                favorite === "transcribed" &&
                !hasTranscript(recording, liveTranscriptions)
            ) {
                return false;
            }
            if (favorite === "tags" && recording.tags.length === 0) {
                return false;
            }
            if (!normalizedQuery) return true;
            return [
                recording.filename,
                recording.sourceProvider,
                ...recording.tags.map((tag) => tag.name),
                liveTranscriptions.get(recording.id)?.text ?? "",
            ]
                .join(" ")
                .toLocaleLowerCase()
                .includes(normalizedQuery);
        });
    }, [
        favorite,
        librarySearchFilter,
        liveRecordings,
        liveTranscriptions,
        query,
        source,
    ]);
    const itemsPerPage = Math.max(1, displaySettings.itemsPerPage || 50);
    const timelineCounts = useMemo(() => {
        const counts: Record<TimelineFilter, number> = {
            all: filteredRecordings.length,
            today: 0,
            yesterday: 0,
            earlier: 0,
        };
        for (const recording of filteredRecordings) {
            const bucket = getTimelineFilter(recording.startTime);
            counts[bucket] += 1;
        }
        return counts;
    }, [filteredRecordings]);
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
        const options: Array<{
            value: TagFilterValue;
            label: string;
            count: number;
        }> = [
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
    }, [filteredRecordings, language, t]);
    const selectedTagOption =
        tagFilterOptions.find((option) => option.value === selectedTagFilter) ??
        tagFilterOptions[0];
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
            if (timelineFilter !== "all" && bucket !== timelineFilter) {
                continue;
            }
            entries.push({
                groupId: bucket,
                groupLabel: getDayBucket(recording.startTime),
                recording,
            });
        }
        return entries;
    }, [filteredRecordings, listMode, selectedTagFilter, t, timelineFilter]);
    const listHasExternalFilter =
        source !== "all" ||
        query.trim().length > 0 ||
        librarySearchFilter !== null;
    const listState: RecordingListState = !displaySettingsLoaded
        ? "loading"
        : liveRecordings.length === 0
          ? "empty"
          : filteredRecordings.length === 0
            ? listMode === "tags" && !listHasExternalFilter
                ? "tag-empty"
                : "no-match"
            : listEntries.length > 0
              ? "ready"
              : listMode === "tags"
                ? "tag-empty"
                : timelineFilter !== "all"
                  ? "timeline-empty"
                  : "no-match";
    const listTotalPages = Math.max(
        1,
        Math.ceil(listEntries.length / itemsPerPage),
    );
    const currentListPage = Math.min(listPage, listTotalPages);
    const pagedListEntries =
        listState === "ready"
            ? listEntries.slice(
                  (currentListPage - 1) * itemsPerPage,
                  currentListPage * itemsPerPage,
              )
            : [];
    const listPaginationState =
        currentListPage === 1
            ? "paginated-first"
            : currentListPage === listTotalPages
              ? "paginated-last"
              : "paginated";
    const listLoadedCount =
        listPaginationState === "paginated-last"
            ? listEntries.length
            : pagedListEntries.length;
    const listPageStatusKey =
        listPaginationState === "paginated-last"
            ? "recordingList.pageStatusLast"
            : listPaginationState === "paginated"
              ? "recordingList.pageStatusMiddle"
              : "recordingList.pageStatusFirst";
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

    const listResetKey = useMemo(
        () =>
            [
                filteredRecordings
                    .map((recording) => recording.id)
                    .join("\u0000"),
                itemsPerPage,
                listMode,
                selectedTagFilter,
                timelineFilter,
            ].join("\u0001"),
        [
            filteredRecordings,
            itemsPerPage,
            listMode,
            selectedTagFilter,
            timelineFilter,
        ],
    );

    useEffect(() => {
        if (!listResetKey) return;
        setListPage((page) => (page === 1 ? page : 1));
    }, [listResetKey]);

    useEffect(() => {
        setListPage((page) => Math.min(Math.max(page, 1), listTotalPages));
    }, [listTotalPages]);

    useEffect(() => {
        if (
            tagFilterOptions.some(
                (option) => option.value === selectedTagFilter,
            )
        ) {
            return;
        }
        setSelectedTagFilter("all");
    }, [selectedTagFilter, tagFilterOptions]);
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
    const sourceRows = useMemo(
        () =>
            SOURCE_ORDER.map((item) => {
                const dataSource = dataSourceByProvider.get(item.key);
                const count = sourceCounts.get(item.key) ?? 0;
                const active = source === item.key;
                const connected = Boolean(dataSource?.connected);
                const enabled = dataSource?.enabled ?? false;
                const planned = dataSource?.runtimeStatus === "planned";
                const status: SourceStatus =
                    dataSourcesLoading && !dataSource
                        ? "loading"
                        : planned
                          ? "planned"
                          : !connected
                            ? "needs-setup"
                            : !enabled
                              ? "paused"
                              : dataSource?.connectionStatus === "expired"
                                ? "expired"
                                : isAutoSyncing
                                  ? "syncing"
                                  : hasSyncError
                                    ? "sync-error"
                                    : active &&
                                        count > 0 &&
                                        filteredRecordings.length === 0
                                      ? "no-results"
                                      : count > 0
                                        ? "connected"
                                        : "connected-empty";

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
            isAutoSyncing,
            language,
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

    const selectedRecording =
        listEligibleRecordings.find(
            (recording) => recording.id === selectedId,
        ) ??
        listEligibleRecordings[0] ??
        null;
    const selectedRecordingId = selectedRecording?.id ?? null;
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
    const turns = transcriptTurns(selectedTranscription);
    const localTranscriptText = selectedTranscription?.text ?? "";
    const isTranscriptLoading = selectedRecordingId
        ? loadingTranscriptIds.has(selectedRecordingId)
        : false;
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
    const sourceReportError =
        sourceReport.recordingId === selectedRecordingId
            ? sourceReport.error
            : "";
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
        : localTranscriptText.trim()
          ? "ready"
          : "missing";
    const localTranscriptCopyDisabled =
        copyingAction === "local-transcript" ||
        localTranscriptCopyState !== "ready";
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
    const sourceReportDisplaySegments: SourceReportSegment[] =
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

        if (isAutoSyncing || workerStatus?.isRunning) {
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
    const searchPanelState = searchIndexing?.active
        ? "indexing"
        : searchError
          ? "error"
          : searchLoading
            ? "loading"
            : query.trim()
              ? searchResults.length
                  ? "results"
                  : "no-results"
              : "no-query";
    const groupedSearchResults = useMemo(() => {
        let index = 0;
        return SEARCH_RESULT_TYPES.map((type) => {
            const results = searchResults
                .filter((result) => result.entityType === type)
                .map((result) => ({ index: index++, result }));

            return { type, results };
        }).filter((group) => group.results.length > 0);
    }, [searchResults]);
    const flatSearchResults = groupedSearchResults.flatMap(
        (group) => group.results,
    );
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

    useEffect(() => {
        const recordingId = selectedRecordingId;
        if (
            !recordingId ||
            !selectedTranscription?.hasTranscript ||
            hasTranscriptContent(selectedTranscription) ||
            loadingTranscriptIdsRef.current.has(recordingId)
        ) {
            return;
        }

        loadingTranscriptIdsRef.current.add(recordingId);
        markTranscriptLoading(recordingId);
        let active = true;

        fetch(`/api/recordings/${recordingId}`, {
            headers: { Accept: "application/json" },
        })
            .then((response) => (response.ok ? response.json() : null))
            .then(
                (
                    data: {
                        transcription?: {
                            text?: string | null;
                            detectedLanguage?: string | null;
                            speakerMap?: Record<string, string> | null;
                            segments?: TranscriptSegmentData[] | null;
                        } | null;
                    } | null,
                ) => {
                    if (!active) return;
                    const transcription = data?.transcription;
                    if (!hasTranscriptContent(transcription ?? null)) {
                        return;
                    }

                    setLiveTranscriptions((previous) => {
                        const current = previous.get(recordingId);
                        const next = new Map(previous);
                        next.set(recordingId, {
                            ...current,
                            hasTranscript: true,
                            text: transcription?.text ?? undefined,
                            language:
                                transcription?.detectedLanguage ?? undefined,
                            speakerMap:
                                transcription?.speakerMap ??
                                current?.speakerMap,
                            segments:
                                transcription?.segments ?? current?.segments,
                        });
                        return next;
                    });
                },
            )
            .finally(() => {
                if (!active) return;
                loadingTranscriptIdsRef.current.delete(recordingId);
                clearTranscriptLoading(recordingId);
            });

        return () => {
            active = false;
        };
    }, [
        clearTranscriptLoading,
        markTranscriptLoading,
        selectedRecordingId,
        selectedTranscription,
    ]);

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
        if (!drawerOpen && !searchOpen && !activityOpen) return;

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
            if (searchOpen) {
                setSearchOpen(false);
                window.setTimeout(() => {
                    searchTriggerRef.current?.focus({ preventScroll: true });
                }, 0);
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
                searchOpen &&
                searchOverlayRef.current &&
                !searchOverlayRef.current.contains(target)
            ) {
                setSearchOpen(false);
            }
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
    }, [activityOpen, closeActivityOverlay, drawerOpen, searchOpen]);

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

    useEffect(() => {
        if (!searchOpen || query.trim().length === 0) {
            setSearchResults([]);
            setSearchError("");
            setSearchIndexing(null);
            return;
        }
        const timer = window.setTimeout(() => {
            setSearchLoading(true);
            setSearchError("");
            setSearchIndexing(null);
            const params = new URLSearchParams({
                q: query,
                limit: "8",
            });
            if (searchRetry > 0) {
                params.set("_retry", String(searchRetry));
            }
            if (searchScope !== "all") {
                params.set("type", searchScope);
            }
            fetch(`/api/search?${params.toString()}`)
                .then((response) => {
                    if (!response.ok) throw new Error("Search failed");
                    return response.json();
                })
                .then(
                    (data: {
                        results?: SearchResult[];
                        indexing?: SearchIndexingProgress;
                    }) => {
                        if (data.indexing?.active) {
                            setSearchIndexing(data.indexing);
                            setSearchResults([]);
                            return;
                        }
                        setSearchIndexing(null);
                        setSearchResults(data.results ?? []);
                    },
                )
                .catch(() => {
                    setSearchResults([]);
                    setSearchIndexing(null);
                    setSearchError("搜索暂时不可用");
                })
                .finally(() => setSearchLoading(false));
        }, 180);
        return () => window.clearTimeout(timer);
    }, [query, searchOpen, searchRetry, searchScope]);

    useEffect(() => {
        if (!searchOpen) return;
        window.setTimeout(() => {
            searchInputRef.current?.focus({ preventScroll: true });
        }, 0);
    }, [searchOpen]);

    useEffect(() => {
        if (!searchOpen || flatSearchResults.length === 0) return;
        window.setTimeout(() => {
            document
                .querySelector<HTMLElement>(
                    `[data-sot-control="library-search-result"][data-sot-result-index="${activeSearchIndex}"]`,
                )
                ?.scrollIntoView({ block: "nearest" });
        }, 0);
    }, [activeSearchIndex, flatSearchResults.length, searchOpen]);

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

    function applyListMode(
        mode: ListMode,
        options: { fromFavorite?: boolean } = {},
    ) {
        if (listMode !== mode) {
            setListMode(mode);
            setTimelineFilter("all");
            setSelectedTagFilter("all");
        }
        setTagFilterOpen(false);
        if (!options.fromFavorite) {
            setFavorite(mode === "tags" ? "tags" : "all");
        }
    }

    function selectRecording(recordingId: string) {
        if (recordingId === selectedRecordingId) {
            setSelectedId(recordingId);
            return;
        }
        setSelectedId(recordingId);
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

    async function runManualSync() {
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
    }

    function applyLibrarySearchResult(result: SearchResult) {
        const action = searchResultAction(result);
        if (action === "filter") {
            const label = searchResultFilterLabel(result);
            setLibrarySearchFilter({
                label,
                type: result.entityType === "speaker" ? "speaker" : "tag",
            });
            setFavorite("all");
            applyListMode("timeline", { fromFavorite: true });
            setQuery("");
            setSearchResults([]);
            setSearchOpen(false);
            return;
        }
        if (result.recordingId) {
            selectRecording(result.recordingId);
            setQuery("");
            setSearchResults([]);
            setSearchOpen(false);
        }
    }

    function handleLibrarySearchKeyDown(event: ReactKeyboardEvent) {
        if (event.key === "Escape") {
            event.preventDefault();
            setSearchOpen(false);
            window.setTimeout(() => {
                searchTriggerRef.current?.focus({ preventScroll: true });
            }, 0);
            return;
        }
        if (flatSearchResults.length === 0) return;
        if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveSearchIndex((value) =>
                Math.min(value + 1, flatSearchResults.length - 1),
            );
            return;
        }
        if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveSearchIndex((value) => Math.max(value - 1, 0));
            return;
        }
        if (event.key === "Enter") {
            event.preventDefault();
            const activeResult = flatSearchResults[activeSearchIndex]?.result;
            if (activeResult) applyLibrarySearchResult(activeResult);
        }
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
            data-sot-shell="dashboard-workstation"
            data-hydrated={hydrated ? "true" : "false"}
            data-playback-auto-next={
                playbackSettings.autoPlayNext ? "true" : "false"
            }
            data-playback-settings-loaded={
                playbackSettingsLoaded ? "true" : "false"
            }
            data-drawer-state={drawerOpen ? "open" : "closed"}
            data-sidebar-collapsed={
                dashboardSidebarCollapsed ? "true" : "false"
            }
            data-sot-surface="dashboard-workstation"
            data-sot-state={hydrated ? "ready" : "loading"}
            data-source-filter-active={source === "all" ? "false" : "true"}
            data-source-filter-provider={source === "all" ? undefined : source}
            data-source-filter-state={sourceFilterStackState}
            data-source-status={selectedSourceRow?.status ?? undefined}
            data-time-style="rel"
        >
            <aside
                className={dashboardSidebarCollapseClassNames.sidebar}
                data-sot-panel="dashboard-sidebar"
                ref={sourceDrawerRef}
            >
                <div
                    className={cn(
                        dashboardBrandClassNames.wrapper,
                        dashboardSidebarCollapseClassNames.brand,
                    )}
                    data-sot-part="dashboard-brand"
                >
                    <Image
                        className={dashboardBrandClassNames.image}
                        src="/assets/logo-mark-steel.svg"
                        alt=""
                        width={36}
                        height={36}
                    />
                    <div
                        className={dashboardSidebarCollapseClassNames.hidden}
                        data-sot-part="dashboard-brand-text"
                    >
                        <div
                            className={dashboardBrandClassNames.name}
                            data-sot-part="dashboard-brand-name"
                        >
                            BetterAINote
                        </div>
                        <div
                            className={dashboardBrandClassNames.subtitle}
                            data-sot-part="dashboard-brand-subtitle"
                        >
                            私人工作空间
                        </div>
                    </div>
                </div>

                <nav
                    className={dashboardNavClassNames.root}
                    data-sot-list="dashboard-nav"
                    aria-label="录音筛选"
                >
                    <div
                        className={cn(
                            dashboardNavClassNames.sectionLabel,
                            dashboardSidebarCollapseClassNames.hidden,
                        )}
                        data-sot-part="dashboard-nav-section-label"
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
                                data-sot-control="dashboard-favorite"
                                data-sot-filter={item.value}
                                data-sot-state={
                                    favorite === item.value
                                        ? "selected"
                                        : "idle"
                                }
                                data-count-badge={String(count)}
                                key={item.value}
                                onClick={() => {
                                    setFavorite(item.value);
                                    applyListMode(
                                        item.value === "tags"
                                            ? "tags"
                                            : "timeline",
                                        { fromFavorite: true },
                                    );
                                }}
                            >
                                <Icon
                                    className={DASHBOARD_ICON_CLASS_NAME}
                                    data-icon="inline-start"
                                />
                                <span
                                    className={cn(
                                        "min-w-0 flex-1 truncate",
                                        dashboardSidebarCollapseClassNames.hidden,
                                    )}
                                    data-sot-part="dashboard-favorite-label"
                                >
                                    {getFavoriteLabel(item.value, t)}
                                </span>
                                <span
                                    className={cn(
                                        dashboardNavClassNames.favoriteCount,
                                        dashboardSidebarCollapseClassNames.hidden,
                                    )}
                                    data-sot-part="dashboard-favorite-count"
                                    data-sot-state={
                                        favorite === item.value
                                            ? "selected"
                                            : "idle"
                                    }
                                >
                                    {count}
                                </span>
                            </Button>
                        );
                    })}

                    <div
                        className={cn(
                            dashboardNavClassNames.sectionLabel,
                            dashboardSidebarCollapseClassNames.hidden,
                        )}
                        data-sot-part="dashboard-nav-section-label"
                    >
                        {t("sourceProviderRows.heading")}
                    </div>
                    <div
                        data-compact={collapsed ? "true" : "false"}
                        data-sot-list="dashboard-sources"
                        data-sot-state={
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
                                data-sot-control="dashboard-source-clear"
                                onClick={() => setSource("all")}
                            >
                                {t("sourceProviderRows.clear")}
                            </Button>
                        ) : null}
                        {dataSourcesError ? (
                            <div
                                className={dashboardSourceErrorClassName}
                                data-sot-part="source-provider-error"
                                data-sot-state="error"
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
                                    aria-pressed={item.active}
                                    aria-label={`${item.label} · ${item.statusLabel}`}
                                    disabled={disabledSourceRow}
                                    data-active={item.active ? "true" : "false"}
                                    data-count-badge={String(visibleCount)}
                                    data-sot-action-state={
                                        disabledSourceRow
                                            ? "disabled"
                                            : (actionKind ?? "count")
                                    }
                                    data-sot-control="dashboard-source-provider"
                                    data-sot-provider={item.key}
                                    data-sot-state={sourceRowState}
                                    data-sot-status={item.status}
                                    data-state={sourceRowState}
                                    key={item.key}
                                    onClick={() => {
                                        if (disabledSourceRow) return;
                                        if (settingsTarget) {
                                            window.localStorage.setItem(
                                                SETTINGS_DATA_SOURCE_PROVIDER_STORAGE_KEY,
                                                item.key,
                                            );
                                            openSettings("data-sources");
                                            return;
                                        }
                                        setSource(
                                            item.active ? "all" : item.key,
                                        );
                                        setDrawerOpen(false);
                                    }}
                                >
                                    {item.icon ? (
                                        <span
                                            data-sot-part="source-provider-mark"
                                            data-sot-provider-cover={
                                                item.cover ? "true" : "false"
                                            }
                                            data-sot-variant="image"
                                        >
                                            <Image
                                                src={item.icon}
                                                alt=""
                                                width={18}
                                                height={18}
                                            />
                                        </span>
                                    ) : (
                                        <span
                                            data-sot-part="source-provider-mark"
                                            data-sot-provider-cover="false"
                                            data-sot-variant="letter"
                                        >
                                            讯
                                        </span>
                                    )}
                                    <span
                                        className={cn(
                                            "min-w-0 flex-1 truncate",
                                            sourceRowCollapsed && "hidden",
                                        )}
                                        data-sot-part="source-provider-label"
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
                                        data-sot-effect={
                                            sourceRowState === "expired"
                                                ? "ring"
                                                : undefined
                                        }
                                        data-sot-part="source-provider-status"
                                        data-sot-state={sourceRowState}
                                        data-sot-tone={sourceStatusTone}
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
                                                data-sot-action={actionKind}
                                                data-sot-part="source-provider-action"
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
                                                    <RefreshCw
                                                        className={
                                                            DASHBOARD_MICRO_ICON_CLASS_NAME
                                                        }
                                                        data-icon="inline-start"
                                                    />
                                                ) : (
                                                    <Plus
                                                        className={
                                                            DASHBOARD_MICRO_ICON_CLASS_NAME
                                                        }
                                                        data-icon="inline-start"
                                                    />
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
                                            data-sot-part="source-provider-count"
                                            data-sot-state={sourceRowState}
                                            data-sot-tone={sourceCountTone}
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
                    data-sot-part="dashboard-sidebar-footer"
                >
                    <div
                        className={dashboardSyncClassNames.panel}
                        data-sot-panel="dashboard-sync"
                        data-sot-state={syncButtonState}
                        data-sync-state={syncButtonState}
                    >
                        <span
                            className={dashboardSyncClassNames.indicator}
                            data-sot-part="dashboard-sync-indicator"
                        />
                        <div
                            className={cn(
                                dashboardSyncClassNames.text,
                                dashboardSidebarCollapseClassNames.hidden,
                            )}
                            data-sot-part="dashboard-sync-text"
                        >
                            <div
                                className={dashboardSyncClassNames.title}
                                data-sot-part="dashboard-sync-title"
                            >
                                {syncStateLabel(syncButtonState, t)} ·
                                BetterAINote
                            </div>
                            <div
                                className={dashboardSyncClassNames.subtitle}
                                data-sot-part="dashboard-sync-subtitle"
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
                            disabled={syncButtonBusy}
                            data-sot-control="dashboard-sync"
                            data-sot-state={syncButtonState}
                            onClick={() => void runManualSync()}
                        >
                            <RefreshCw data-icon="inline-start" />
                        </Button>
                    </div>
                </div>
            </aside>

            <div
                className={dashboardDrawerClassNames.scrim}
                data-sot-panel="dashboard-drawer-scrim"
                id="drawer-scrim"
                aria-hidden="true"
            />

            <main
                className={DASHBOARD_MAIN_CLASS_NAME}
                data-sot-panel="dashboard-main"
            >
                <header
                    className={dashboardTopbarClassNames.topbar}
                    data-sot-panel="dashboard-topbar"
                >
                    <Button
                        variant="ghost"
                        size="default"
                        className={dashboardButtonClassNames.drawerTrigger}
                        data-sot-control="dashboard-drawer-trigger"
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
                        <Menu
                            className={dashboardDrawerClassNames.menuIcon}
                            data-icon="inline-start"
                        />
                        <span
                            className={dashboardDrawerClassNames.activeDot}
                            data-sot-part="dashboard-drawer-active-dot"
                            aria-hidden="true"
                        />
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        className={dashboardButtonClassNames.sidebarCollapse}
                        type="button"
                        aria-label="折叠 / 展开侧边栏"
                        data-sot-control="sidebar-collapse"
                        data-sot-state={collapsed ? "collapsed" : "expanded"}
                        onClick={() => setCollapsed((value) => !value)}
                    >
                        <PanelLeft
                            className={cn(
                                "transition-transform duration-300",
                                collapsed && "rotate-180",
                            )}
                            data-icon="inline-start"
                        />
                    </Button>
                    <div
                        className={dashboardTopbarClassNames.crumbs}
                        data-sot-part="dashboard-crumbs"
                    >
                        <span
                            className={dashboardTopbarClassNames.crumb}
                            data-sot-part="dashboard-crumb"
                        >
                            {favorite === "all"
                                ? "全部录音"
                                : favorite === "transcribed"
                                  ? "转写记录"
                                  : "标签"}
                        </span>
                        <span
                            className={dashboardTopbarClassNames.separator}
                            data-sot-part="dashboard-crumb-separator"
                        >
                            /
                        </span>
                        <span
                            className={dashboardTopbarClassNames.current}
                            data-sot-part="dashboard-crumb-current"
                        >
                            {selectedRecording?.filename ?? "未选择录音"}
                        </span>
                    </div>
                    <div
                        className={
                            dashboardSearchActivityClassNames.dashboardTopbarActions
                        }
                        data-sot-part="dashboard-topbar-actions"
                    >
                        <div
                            className={
                                dashboardSearchActivityClassNames.librarySearchAnchor
                            }
                            data-sot-part="library-search-anchor"
                            ref={searchOverlayRef}
                        >
                            <Button
                                ref={searchTriggerRef}
                                variant="ghost"
                                size="icon-sm"
                                className={
                                    dashboardSearchActivityClassNames.dashboardSearchTrigger
                                }
                                type="button"
                                aria-label={t("librarySearch.openSearch")}
                                aria-expanded={searchOpen}
                                data-sot-control="dashboard-search"
                                data-sot-state={searchOpen ? "open" : "idle"}
                                onClick={() => {
                                    setActivityOpen(false);
                                    setMoreOpen(false);
                                    setTagOpen(false);
                                    setAiOpen(false);
                                    setSearchOpen((open) => !open);
                                }}
                            >
                                <Search
                                    className={DASHBOARD_ICON_CLASS_NAME}
                                    data-icon="inline-start"
                                />
                            </Button>
                            {searchOpen ? (
                                <Card
                                    hasNoPadding
                                    variant="default"
                                    className={
                                        dashboardSearchActivityClassNames.librarySearchPanel
                                    }
                                    data-open="true"
                                    data-state={searchPanelState}
                                    data-sot-panel="library-search"
                                    data-sot-state={searchPanelState}
                                    data-sot-result-count={String(
                                        flatSearchResults.length,
                                    )}
                                    role="dialog"
                                    aria-label={t("librarySearch.dialogLabel")}
                                    onKeyDown={handleLibrarySearchKeyDown}
                                >
                                    <InputGroup
                                        variant="default"
                                        className={
                                            dashboardSearchActivityClassNames.librarySearchInputRow
                                        }
                                        data-sot-part="library-search-input-row"
                                        data-state={searchPanelState}
                                        data-disabled={String(
                                            searchPanelState === "indexing",
                                        )}
                                    >
                                        <InputGroupAddon
                                            align="inline-start"
                                            className={
                                                dashboardSearchActivityClassNames.librarySearchInputAddon
                                            }
                                        >
                                            <Search
                                                className={
                                                    DASHBOARD_RECORDING_LIST_STATE_ICON_CLASS_NAME
                                                }
                                                data-icon="inline-start"
                                            />
                                        </InputGroupAddon>
                                        <InputGroupInput
                                            variant="default"
                                            className={
                                                dashboardSearchActivityClassNames.librarySearchInput
                                            }
                                            ref={searchInputRef}
                                            value={query}
                                            aria-disabled={
                                                searchPanelState === "indexing"
                                            }
                                            aria-label={t(
                                                "librarySearch.placeholder",
                                            )}
                                            autoComplete="off"
                                            onChange={(event) => {
                                                setQuery(event.target.value);
                                                setActiveSearchIndex(0);
                                            }}
                                            placeholder={t(
                                                searchPanelState === "no-query"
                                                    ? "librarySearch.placeholder"
                                                    : "librarySearch.shortPlaceholder",
                                            )}
                                            readOnly={
                                                searchPanelState === "indexing"
                                            }
                                            data-sot-control="library-search-input"
                                            data-sot-state={searchPanelState}
                                        />
                                        {query.trim() &&
                                        searchPanelState !== "indexing" &&
                                        searchPanelState !== "error" ? (
                                            <InputGroupButton
                                                variant="ghost"
                                                size="icon-xs"
                                                className={
                                                    dashboardSearchActivityClassNames.librarySearchClear
                                                }
                                                aria-label={t(
                                                    "librarySearch.clearSearch",
                                                )}
                                                data-sot-control="library-search-clear"
                                                data-sot-state="clear"
                                                onClick={() => {
                                                    setQuery("");
                                                    setSearchResults([]);
                                                    setSearchError("");
                                                    setSearchIndexing(null);
                                                    window.setTimeout(() => {
                                                        searchInputRef.current?.focus(
                                                            {
                                                                preventScroll: true,
                                                            },
                                                        );
                                                    }, 0);
                                                }}
                                            >
                                                <X
                                                    className={
                                                        DASHBOARD_TINY_ICON_CLASS_NAME
                                                    }
                                                    data-icon="inline-start"
                                                />
                                            </InputGroupButton>
                                        ) : null}
                                    </InputGroup>
                                    <ToggleGroup
                                        type="single"
                                        layout="default"
                                        variant="outline"
                                        size="sm"
                                        className={
                                            dashboardSearchActivityClassNames.librarySearchScope
                                        }
                                        value={searchScope}
                                        spacing={1.6}
                                        aria-label={t(
                                            "librarySearch.scopeLegend",
                                        )}
                                        data-sot-canonical="web-index-runtime"
                                        data-sot-part="library-search-scope"
                                        data-sot-scope-count={String(
                                            SEARCH_SCOPES.length,
                                        )}
                                        onValueChange={(value) => {
                                            if (!value) return;
                                            setSearchScope(
                                                value as SearchScope,
                                            );
                                            setActiveSearchIndex(0);
                                            window.setTimeout(() => {
                                                searchInputRef.current?.focus({
                                                    preventScroll: true,
                                                });
                                            }, 0);
                                        }}
                                    >
                                        {SEARCH_SCOPES.map((item) => (
                                            <ToggleGroupItem
                                                key={item.value}
                                                value={item.value}
                                                aria-pressed={
                                                    item.value === searchScope
                                                }
                                                data-sot-control="library-search-scope"
                                                data-sot-scope={item.value}
                                                data-sot-state={
                                                    item.value === searchScope
                                                        ? "selected"
                                                        : "idle"
                                                }
                                                data-sot-result-mode={
                                                    item.value
                                                }
                                                data-search-scope={item.value}
                                                className={
                                                    dashboardSearchActivityClassNames.librarySearchScopeItem
                                                }
                                                disabled={
                                                    searchPanelState ===
                                                    "indexing"
                                                }
                                            >
                                                {item.value === "all"
                                                    ? t(
                                                          "librarySearch.scopes.all",
                                                      )
                                                    : t(
                                                          `librarySearch.types.${item.value}`,
                                                      )}
                                            </ToggleGroupItem>
                                        ))}
                                    </ToggleGroup>
                                    <CardContent
                                        className={
                                            dashboardSearchActivityClassNames.librarySearchScroll
                                        }
                                        data-sot-region="library-search-scroll"
                                    >
                                        {searchPanelState === "indexing" ? (
                                            <div
                                                className={
                                                    dashboardSearchActivityClassNames.librarySearchIndexing
                                                }
                                                data-sot-part="library-search-indexing"
                                                data-sot-state="indexing"
                                            >
                                                <Skeleton
                                                    className={
                                                        dashboardSearchActivityClassNames.librarySearchStateSkeleton
                                                    }
                                                    data-sot-part="library-search-state-skeleton"
                                                />
                                                <div
                                                    className={
                                                        dashboardSearchActivityClassNames.librarySearchStateCopy
                                                    }
                                                    data-sot-part="library-search-state-copy"
                                                >
                                                    {t(
                                                        "librarySearch.indexing",
                                                        {
                                                            completed:
                                                                searchIndexing?.completedJobs ??
                                                                0,
                                                            total:
                                                                searchIndexing?.totalJobs ??
                                                                0,
                                                        },
                                                    )}
                                                </div>
                                            </div>
                                        ) : searchLoading ? (
                                            <div
                                                className={
                                                    dashboardSearchActivityClassNames.librarySearchState
                                                }
                                                data-sot-part="library-search-loading"
                                                data-sot-state="loading"
                                            >
                                                <div
                                                    className={
                                                        dashboardSearchActivityClassNames.librarySearchStateCopy
                                                    }
                                                    data-sot-part="library-search-state-copy"
                                                >
                                                    {t("librarySearch.loading")}
                                                </div>
                                            </div>
                                        ) : searchError ? (
                                            <Alert
                                                variant="default"
                                                density="default"
                                                layout="default"
                                                className={
                                                    dashboardSearchActivityClassNames.librarySearchError
                                                }
                                                data-sot-part="library-search-error"
                                                data-sot-state="error"
                                            >
                                                <AlertTitle
                                                    density="default"
                                                    className={
                                                        dashboardSearchActivityClassNames.librarySearchErrorTitle
                                                    }
                                                    data-sot-part="library-search-state-title"
                                                >
                                                    {t("librarySearch.error")}
                                                </AlertTitle>
                                                <Button
                                                    variant="outline"
                                                    size="xs"
                                                    className={
                                                        dashboardSearchActivityClassNames.librarySearchRetry
                                                    }
                                                    type="button"
                                                    data-sot-control="library-search-retry"
                                                    onClick={() => {
                                                        setSearchRetry(
                                                            (value) =>
                                                                value + 1,
                                                        );
                                                        window.setTimeout(
                                                            () => {
                                                                searchInputRef.current?.focus(
                                                                    {
                                                                        preventScroll: true,
                                                                    },
                                                                );
                                                            },
                                                            0,
                                                        );
                                                    }}
                                                >
                                                    {t("librarySearch.retry")}
                                                </Button>
                                            </Alert>
                                        ) : flatSearchResults.length > 0 ? (
                                            <div
                                                className={
                                                    dashboardSearchActivityClassNames.librarySearchResults
                                                }
                                                data-sot-list="library-search-results"
                                                data-sot-state="results"
                                            >
                                                {groupedSearchResults.map(
                                                    (group) => (
                                                        <div
                                                            className={
                                                                dashboardSearchActivityClassNames.librarySearchResultGroup
                                                            }
                                                            key={group.type}
                                                            data-sot-group="library-search-results"
                                                            data-sot-result-type={
                                                                group.type
                                                            }
                                                        >
                                                            <div
                                                                className={
                                                                    dashboardSearchActivityClassNames.librarySearchGroupLabel
                                                                }
                                                                data-sot-part="library-search-group-label"
                                                            >
                                                                {t(
                                                                    `librarySearch.types.${group.type}`,
                                                                )}
                                                            </div>
                                                            {group.results.map(
                                                                ({
                                                                    index,
                                                                    result,
                                                                }) => {
                                                                    const title =
                                                                        searchResultTitle(
                                                                            result,
                                                                            t,
                                                                        );
                                                                    const meta =
                                                                        searchResultMeta(
                                                                            result,
                                                                            t,
                                                                        );
                                                                    const action =
                                                                        searchResultAction(
                                                                            result,
                                                                        );
                                                                    return (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="default"
                                                                            className={
                                                                                dashboardSearchActivityClassNames.librarySearchResult
                                                                            }
                                                                            type="button"
                                                                            key={`${result.entityType}:${result.entityId}`}
                                                                            data-active={
                                                                                index ===
                                                                                activeSearchIndex
                                                                                    ? "true"
                                                                                    : "false"
                                                                            }
                                                                            data-sot-result-mode={
                                                                                action
                                                                            }
                                                                            data-result-type={
                                                                                result.entityType
                                                                            }
                                                                            data-sot-control="library-search-result"
                                                                            data-sot-result-index={String(
                                                                                index,
                                                                            )}
                                                                            data-sot-result-type={
                                                                                result.entityType
                                                                            }
                                                                            data-sot-state={
                                                                                index ===
                                                                                activeSearchIndex
                                                                                    ? "active"
                                                                                    : "idle"
                                                                            }
                                                                            onClick={() =>
                                                                                applyLibrarySearchResult(
                                                                                    result,
                                                                                )
                                                                            }
                                                                        >
                                                                            {result.entityType ===
                                                                            "tag" ? (
                                                                                <Badge
                                                                                    variant="secondary"
                                                                                    className={
                                                                                        dashboardSearchActivityClassNames.librarySearchTag
                                                                                    }
                                                                                    data-sot-part="library-search-tag-chip"
                                                                                >
                                                                                    <LibrarySearchTagIcon />
                                                                                    {highlightSearchText(
                                                                                        title,
                                                                                        query,
                                                                                    )}
                                                                                </Badge>
                                                                            ) : (
                                                                                <span
                                                                                    className={
                                                                                        dashboardSearchActivityClassNames.librarySearchResultTitle
                                                                                    }
                                                                                    data-sot-part="library-search-result-title"
                                                                                >
                                                                                    {highlightSearchText(
                                                                                        title,
                                                                                        query,
                                                                                    )}
                                                                                </span>
                                                                            )}
                                                                            <span
                                                                                className={
                                                                                    dashboardSearchActivityClassNames.librarySearchResultMeta
                                                                                }
                                                                                data-sot-part="library-search-result-meta"
                                                                            >
                                                                                {
                                                                                    meta
                                                                                }
                                                                            </span>
                                                                        </Button>
                                                                    );
                                                                },
                                                            )}
                                                        </div>
                                                    ),
                                                )}
                                            </div>
                                        ) : (
                                            <div
                                                className={
                                                    dashboardSearchActivityClassNames.librarySearchState
                                                }
                                                data-sot-part="library-search-empty"
                                                data-sot-state={
                                                    query.trim()
                                                        ? "no-results"
                                                        : "no-query"
                                                }
                                            >
                                                {query.trim() ? (
                                                    <div
                                                        className={
                                                            dashboardSearchActivityClassNames.librarySearchStateCopy
                                                        }
                                                        data-sot-part="library-search-state-copy"
                                                    >
                                                        {language === "en" ? (
                                                            <>
                                                                {
                                                                    'No content found for "'
                                                                }
                                                                <span>
                                                                    {query.trim()}
                                                                </span>
                                                                {'"'}
                                                            </>
                                                        ) : (
                                                            <>
                                                                {"没有找到与「"}
                                                                <span>
                                                                    {query.trim()}
                                                                </span>
                                                                {"」相关的内容"}
                                                            </>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div
                                                        className={
                                                            dashboardSearchActivityClassNames.librarySearchStateCopy
                                                        }
                                                        data-sot-part="library-search-state-copy"
                                                    >
                                                        {t(
                                                            "librarySearch.noQuery",
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            ) : null}
                        </div>
                        <div
                            className={
                                dashboardSearchActivityClassNames.dashboardActivityAnchor
                            }
                            data-sot-part="dashboard-activity-anchor"
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
                                data-sot-control="dashboard-activity"
                                data-sot-state={activityOpen ? "open" : "idle"}
                                data-sot-pending-count={String(
                                    activityBadgeCount,
                                )}
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
                                <Bell
                                    className={DASHBOARD_ICON_CLASS_NAME}
                                    data-icon="inline-start"
                                />
                                <span data-sot-part="dashboard-activity-badge">
                                    {activityBadgeCount > 99
                                        ? "99+"
                                        : activityBadgeCount}
                                </span>
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
                                    data-sot-panel="dashboard-activity"
                                    data-sot-state={activityPanelState}
                                    data-sot-item-count={String(
                                        visibleActivityItems.length,
                                    )}
                                    role="dialog"
                                    aria-label={t("activityOverlay.title")}
                                >
                                    <CardHeader
                                        className={
                                            dashboardSearchActivityClassNames.dashboardActivityHeader
                                        }
                                        data-sot-part="dashboard-activity-header"
                                    >
                                        <div
                                            className={
                                                dashboardSearchActivityClassNames.dashboardActivityHeading
                                            }
                                            data-sot-part="dashboard-activity-heading"
                                        >
                                            <CardTitle
                                                className={
                                                    dashboardSearchActivityClassNames.dashboardActivityTitle
                                                }
                                                data-sot-part="dashboard-activity-title"
                                            >
                                                {t("activityOverlay.title")}
                                            </CardTitle>
                                            <Badge
                                                variant="ghost"
                                                className={
                                                    dashboardSearchActivityClassNames.dashboardActivityCount
                                                }
                                                data-sot-part="dashboard-activity-count"
                                            >
                                                {t(
                                                    "activityOverlay.pendingCount",
                                                    {
                                                        count: activityBadgeCount,
                                                    },
                                                )}
                                            </Badge>
                                        </div>
                                        <CardAction data-sot-part="dashboard-activity-header-action">
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
                                                data-sot-control="dashboard-activity-close"
                                                onClick={() =>
                                                    closeActivityOverlay({
                                                        restoreFocus: true,
                                                    })
                                                }
                                            >
                                                <X
                                                    className={
                                                        DASHBOARD_TINY_ICON_CLASS_NAME
                                                    }
                                                    data-icon="inline-start"
                                                />
                                            </Button>
                                        </CardAction>
                                    </CardHeader>
                                    <Separator data-sot-part="dashboard-activity-header-separator" />
                                    <CardContent
                                        className={
                                            dashboardSearchActivityClassNames.dashboardActivityContent
                                        }
                                        data-sot-part="dashboard-activity-content"
                                    >
                                        <div
                                            className={
                                                dashboardSearchActivityClassNames.dashboardActivityStatus
                                            }
                                            data-state={syncButtonState}
                                            data-sot-part="dashboard-activity-status"
                                            data-sot-state={syncButtonState}
                                        >
                                            <span
                                                className={
                                                    dashboardSearchActivityClassNames.dashboardActivityStatusIndicator
                                                }
                                                data-sot-part="dashboard-activity-status-indicator"
                                                aria-hidden="true"
                                            />
                                            <div
                                                className={
                                                    dashboardSearchActivityClassNames.dashboardActivityStatusCopy
                                                }
                                                data-sot-part="dashboard-activity-status-copy"
                                            >
                                                <div
                                                    className={
                                                        dashboardSearchActivityClassNames.dashboardActivityStatusLine
                                                    }
                                                    data-sot-part="dashboard-activity-status-line"
                                                >
                                                    {syncStatusLabel}
                                                </div>
                                                <div
                                                    className={
                                                        dashboardSearchActivityClassNames.dashboardActivityStatusSub
                                                    }
                                                    data-sot-format="mono"
                                                    data-sot-part="dashboard-activity-status-sub"
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
                                                data-sot-control="dashboard-activity-sync"
                                                data-sot-state={
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
                                        <Separator data-sot-part="dashboard-activity-status-separator" />
                                        {visibleActivityItems.length > 0 ? (
                                            <ul
                                                className={
                                                    dashboardSearchActivityClassNames.dashboardActivityItems
                                                }
                                                data-sot-list="dashboard-activity-items"
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
                                                            data-sot-action={
                                                                item.action ??
                                                                "none"
                                                            }
                                                            data-sot-activity-id={
                                                                item.id
                                                            }
                                                            data-sot-item="dashboard-activity-item"
                                                            data-sot-state={
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
                                                                data-sot-part="dashboard-activity-item-icon"
                                                            >
                                                                {item.tone ===
                                                                "success" ? (
                                                                    <CheckCircle
                                                                        className={
                                                                            DASHBOARD_ACTIVITY_ITEM_ICON_CLASS_NAME
                                                                        }
                                                                    />
                                                                ) : item.tone ===
                                                                  "info" ? (
                                                                    <Bell
                                                                        className={
                                                                            DASHBOARD_ACTIVITY_ITEM_ICON_CLASS_NAME
                                                                        }
                                                                    />
                                                                ) : (
                                                                    <AlertCircle
                                                                        className={
                                                                            DASHBOARD_ACTIVITY_ITEM_ICON_CLASS_NAME
                                                                        }
                                                                    />
                                                                )}
                                                            </span>
                                                            <div
                                                                className={
                                                                    dashboardSearchActivityClassNames.dashboardActivityItemCopy
                                                                }
                                                                data-sot-part="dashboard-activity-item-copy"
                                                            >
                                                                <div
                                                                    className={
                                                                        dashboardSearchActivityClassNames.dashboardActivityItemTitle
                                                                    }
                                                                    data-sot-part="dashboard-activity-item-title"
                                                                >
                                                                    {item.title}
                                                                </div>
                                                                <div
                                                                    className={
                                                                        dashboardSearchActivityClassNames.dashboardActivityItemBody
                                                                    }
                                                                    data-sot-part="dashboard-activity-item-body"
                                                                >
                                                                    {item.body}
                                                                </div>
                                                                <div
                                                                    className={
                                                                        dashboardSearchActivityClassNames.dashboardActivityItemMeta
                                                                    }
                                                                    data-sot-part="dashboard-activity-item-meta"
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
                                                                data-sot-part="dashboard-activity-item-actions"
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
                                                                        data-sot-control="dashboard-activity-action"
                                                                        data-sot-state={
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
                                                                    data-sot-control="dashboard-activity-dismiss"
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
                                                                    <X
                                                                        className={
                                                                            DASHBOARD_MICRO_ICON_CLASS_NAME
                                                                        }
                                                                        data-icon="inline-start"
                                                                    />
                                                                </Button>
                                                            </div>
                                                        </li>
                                                    ),
                                                )}
                                            </ul>
                                        ) : (
                                            <Empty
                                                data-sot-part="dashboard-activity-empty"
                                                className={
                                                    dashboardSearchActivityClassNames.dashboardActivityEmpty
                                                }
                                            >
                                                <EmptyHeader>
                                                    <EmptyMedia
                                                        data-sot-part="dashboard-activity-empty-icon"
                                                        variant="icon"
                                                        aria-hidden="true"
                                                    >
                                                        <CheckCircle />
                                                    </EmptyMedia>
                                                    <EmptyTitle data-sot-part="dashboard-activity-empty-title">
                                                        {t(
                                                            "activityOverlay.emptyTitle",
                                                        )}
                                                    </EmptyTitle>
                                                    <EmptyDescription data-sot-part="dashboard-activity-empty-body">
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
                        <Button
                            asChild
                            variant="ghost"
                            size="icon"
                            className={dashboardButtonClassNames.settingsAvatar}
                        >
                            <button
                                ref={settingsTriggerRef}
                                type="button"
                                aria-label="打开设置"
                                aria-expanded={settingsOpen}
                                aria-haspopup="dialog"
                                data-sot-control="dashboard-settings"
                                data-sot-part="dashboard-user-avatar"
                                data-sot-state={settingsOpen ? "open" : "idle"}
                                onClick={() => openSettings("data-sources")}
                            >
                                {Array.from(getUserDisplayName(user))[0]}
                            </button>
                        </Button>
                    </div>
                </header>

                <SystemBanner />

                <div
                    className={DASHBOARD_WORKSPACE_CLASS_NAME}
                    data-sot-panel="dashboard-workspace"
                >
                    <Card
                        hasNoPadding
                        className={DASHBOARD_RECORDING_LIST_CARD_CLASS_NAME}
                        data-current-page={String(currentListPage)}
                        data-list-state={listState}
                        data-sot-list-mode={listMode}
                        data-sot-state={listState}
                        data-sot-surface="dashboard-recording-list"
                        data-total-pages={String(listTotalPages)}
                        data-visible-count={String(pagedListEntries.length)}
                    >
                        <CardContent
                            className={
                                DASHBOARD_RECORDING_LIST_CONTENT_CLASS_NAME
                            }
                            data-sot-part="dashboard-recording-list-content"
                        >
                            <div
                                className={
                                    DASHBOARD_RECORDING_LIST_HEADER_CLASS_NAME
                                }
                                data-sot-part="dashboard-recording-list-header"
                            >
                                <div
                                    className={
                                        dashboardRecordingListTitlebarStyles.root
                                    }
                                    data-sot-part="dashboard-recording-list-titlebar"
                                >
                                    <h2
                                        className={
                                            dashboardRecordingListTitlebarStyles.title
                                        }
                                        data-sot-part="dashboard-recording-list-title"
                                    >
                                        {getFavoriteLabel(favorite, t)}
                                    </h2>
                                    <span
                                        className={
                                            dashboardRecordingListTitlebarStyles.count
                                        }
                                        data-sot-part="dashboard-recording-list-count"
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
                                        data-sot-panel="dashboard-source-filter-stack"
                                        data-sot-provider={source}
                                        data-sot-state={sourceFilterStackState}
                                        data-sot-status={
                                            selectedSourceRow?.status ?? ""
                                        }
                                        data-state={sourceFilterStackState}
                                    >
                                        <span
                                            className={
                                                sourceFilterStackClassNames.from
                                            }
                                            data-sot-part="source-filter-from"
                                        >
                                            {t("sourceFilterStack.filter")} ·{" "}
                                            <b>
                                                {t(
                                                    "dashboardFavorites.allRecordings",
                                                )}
                                            </b>
                                        </span>
                                        <span
                                            className={
                                                sourceFilterStackClassNames.separator
                                            }
                                            data-sot-part="source-filter-separator"
                                        >
                                            ›
                                        </span>
                                        <span
                                            className={
                                                sourceFilterStackClassNames.chip
                                            }
                                            data-sot-part="source-filter-chip"
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
                                                size="icon"
                                                type="button"
                                                className={
                                                    sourceFilterClassNames.clear
                                                }
                                                aria-label={t(
                                                    "sourceFilterStack.clearSourceFilter",
                                                )}
                                                data-sot-control="source-filter-clear"
                                                onClick={() => setSource("all")}
                                            >
                                                <X data-icon="inline-start" />
                                            </Button>
                                        </span>
                                        <span
                                            className={
                                                sourceFilterStackClassNames.info
                                            }
                                            data-sot-part="source-filter-info"
                                        >
                                            {sourceFilterStackMessage ||
                                                `${t("sourceFilterStack.showing")} `}
                                            {sourceFilterStackMessage ? null : (
                                                <>
                                                    <b>
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
                                                data-sot-control="source-filter-retry-sync"
                                                data-sot-action="retry"
                                                data-sot-part="source-filter-action"
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
                                                data-sot-control="source-filter-widen"
                                                data-sot-action="widen"
                                                data-sot-part="source-filter-action"
                                                onClick={() => {
                                                    setFavorite("all");
                                                    applyListMode("timeline", {
                                                        fromFavorite: true,
                                                    });
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
                                                data-sot-control="source-filter-open-settings"
                                                data-sot-action="open-settings"
                                                data-sot-part="source-filter-action"
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
                                            data-sot-control="source-filter-clear-all"
                                            onClick={() => setSource("all")}
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
                                        data-sot-panel="dashboard-library-search-filter"
                                        data-sot-filter={
                                            librarySearchFilter.type
                                        }
                                        data-sot-state="active"
                                    >
                                        <span
                                            className={
                                                sourceFilterStackClassNames.libraryLabel
                                            }
                                            data-sot-part="library-search-filter-label"
                                        >
                                            {librarySearchFilter.type === "tag"
                                                ? t(
                                                      "dashboardFavorites.tagFilter",
                                                  )
                                                : t(
                                                      "dashboardFavorites.speakerFilter",
                                                  )}
                                        </span>
                                        <span
                                            className={
                                                sourceFilterStackClassNames.chip
                                            }
                                            data-sot-part="library-search-filter-chip"
                                        >
                                            {librarySearchFilter.label}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                type="button"
                                                className={
                                                    sourceFilterClassNames.librarySearchFilterClear
                                                }
                                                aria-label={t(
                                                    "dashboardChrome.clear",
                                                )}
                                                data-sot-control="library-search-filter-clear"
                                                onClick={() =>
                                                    setLibrarySearchFilter(null)
                                                }
                                            >
                                                <X data-icon="inline-start" />
                                            </Button>
                                        </span>
                                    </output>
                                ) : null}
                                <div
                                    className={
                                        dashboardRecordingListModeStyles.root
                                    }
                                    data-sot-panel="dashboard-recording-list-mode"
                                >
                                    <div
                                        className={
                                            dashboardRecordingListModeStyles.label
                                        }
                                        data-sot-part="dashboard-recording-list-mode-label"
                                    >
                                        <span data-sot-part="dashboard-recording-list-mode-title">
                                            {listMode === "timeline"
                                                ? t(
                                                      "recordingList.timelineTitle",
                                                  )
                                                : t("recordingList.tagsTitle")}
                                        </span>
                                        <span
                                            className={
                                                dashboardRecordingListModeStyles.count
                                            }
                                            data-sot-part="dashboard-recording-list-mode-count"
                                        >
                                            {t("recordingList.visibleCount", {
                                                count: listEntries.length,
                                            })}
                                        </span>
                                    </div>
                                    <SegmentedTabs
                                        aria-label="列表模式"
                                        variant="segmented"
                                        size="segmentedSm"
                                        data-sot-control="segmented-tabs"
                                        data-sot-part="dashboard-recording-list-mode-segmented"
                                        data-sot-size="sm"
                                        className={
                                            dashboardRecordingListModeStyles.segmented
                                        }
                                        getItemProps={getSotSegmentedTabProps}
                                        items={[
                                            {
                                                value: "timeline",
                                                label: t(
                                                    "recordingList.timeTab",
                                                ),
                                            },
                                            {
                                                value: "tags",
                                                label: t(
                                                    "recordingList.tagsTab",
                                                ),
                                            },
                                        ]}
                                        value={listMode}
                                        onValueChange={applyListMode}
                                    />
                                </div>
                                <ToggleGroup
                                    type="single"
                                    value={timelineFilter}
                                    spacing={1}
                                    variant="outline"
                                    size="sm"
                                    className={
                                        dashboardRecordingTimeFilterStyles.root
                                    }
                                    aria-label={t(
                                        "recordingList.timelineTitle",
                                    )}
                                    data-list-filter-row="timeline"
                                    data-sot-panel="dashboard-recording-time-filter"
                                    hidden={listMode !== "timeline"}
                                    inert={
                                        listMode !== "timeline"
                                            ? true
                                            : undefined
                                    }
                                    onValueChange={(value) => {
                                        if (!value) return;
                                        setTimelineFilter(
                                            value as TimelineFilter,
                                        );
                                    }}
                                >
                                    {TIMELINE_FILTERS.map((item) => {
                                        const active =
                                            timelineFilter === item.value;
                                        return (
                                            <ToggleGroupItem
                                                aria-pressed={active}
                                                data-tf={item.value}
                                                data-sot-control="dashboard-recording-time-filter"
                                                data-sot-filter={item.value}
                                                data-sot-state={
                                                    active ? "selected" : "idle"
                                                }
                                                className={
                                                    dashboardRecordingTimeFilterStyles.item
                                                }
                                                key={item.value}
                                                value={item.value}
                                            >
                                                {t(item.labelKey)}
                                                <span
                                                    className={dashboardRecordingTimeFilterCountClassName(
                                                        active,
                                                    )}
                                                    data-sot-part="dashboard-recording-time-filter-count"
                                                >
                                                    {timelineCounts[item.value]}
                                                </span>
                                            </ToggleGroupItem>
                                        );
                                    })}
                                </ToggleGroup>
                                <div
                                    className={
                                        dashboardRecordingTagFilterStyles.root
                                    }
                                    data-list-filter-row="tags"
                                    data-sot-panel="recording-list-tag-filter"
                                    hidden={listMode !== "tags"}
                                    inert={
                                        listMode !== "tags" ? true : undefined
                                    }
                                    ref={tagFilterRef}
                                >
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className={
                                            dashboardRecordingTagFilterStyles.trigger
                                        }
                                        type="button"
                                        aria-haspopup="listbox"
                                        aria-expanded={tagFilterOpen}
                                        data-tag-filter-trigger=""
                                        data-sot-control="recording-list-tag-filter-trigger"
                                        onClick={() =>
                                            setTagFilterOpen((open) => !open)
                                        }
                                    >
                                        <span
                                            className={
                                                dashboardRecordingTagFilterStyles.label
                                            }
                                            data-tag-filter-label=""
                                            data-sot-part="recording-list-tag-filter-label"
                                        >
                                            {selectedTagOption.label}
                                        </span>
                                        <span
                                            className={
                                                dashboardRecordingTagFilterStyles.count
                                            }
                                            data-tag-filter-count=""
                                            data-sot-part="recording-list-tag-filter-count"
                                        >
                                            {selectedTagOption.count}
                                        </span>
                                        <ChevronDown
                                            className={
                                                dashboardRecordingTagFilterStyles.caret
                                            }
                                            data-icon="inline-end"
                                            data-sot-part="recording-list-tag-filter-caret"
                                            aria-hidden="true"
                                        />
                                    </Button>
                                    <div
                                        className={
                                            dashboardRecordingTagFilterStyles.list
                                        }
                                        role="listbox"
                                        data-tag-filter-list=""
                                        data-sot-list="recording-list-tag-filter-list"
                                        hidden={!tagFilterOpen}
                                    >
                                        {tagFilterOptions.map((option) => {
                                            const active =
                                                option.value ===
                                                selectedTagFilter;
                                            return (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className={
                                                        dashboardRecordingTagFilterStyles.option
                                                    }
                                                    type="button"
                                                    role="option"
                                                    data-tag-value={
                                                        option.value
                                                    }
                                                    aria-selected={active}
                                                    data-sot-control="recording-list-tag-filter"
                                                    data-sot-filter={
                                                        option.value
                                                    }
                                                    data-sot-state={
                                                        active
                                                            ? "selected"
                                                            : "idle"
                                                    }
                                                    key={option.value}
                                                    onClick={() => {
                                                        setSelectedTagFilter(
                                                            option.value,
                                                        );
                                                        setTagFilterOpen(false);
                                                    }}
                                                >
                                                    <span
                                                        className={
                                                            dashboardRecordingTagFilterStyles.optionLabel
                                                        }
                                                        data-sot-part="recording-list-tag-filter-option-label"
                                                    >
                                                        {option.label}
                                                    </span>
                                                    <span
                                                        className={
                                                            dashboardRecordingTagFilterStyles.optionCount
                                                        }
                                                        data-sot-part="recording-list-tag-filter-option-count"
                                                    >
                                                        {option.count}
                                                    </span>
                                                </Button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                            <div
                                className={
                                    dashboardRecordingListScrollClassName
                                }
                                data-sot-list="dashboard-recording-list-scroll"
                            >
                                {listState === "loading" ? (
                                    <SotRecordingListSkeleton />
                                ) : listState === "ready" ? (
                                    <div
                                        className={
                                            dashboardRecordingRowStyles.rows
                                        }
                                        data-sot-list="dashboard-recording-rows"
                                    >
                                        {groupedListEntries.map(
                                            (group, groupIndex) => (
                                                <Fragment key={group.id}>
                                                    {groupIndex > 0 ? (
                                                        <Separator
                                                            className={
                                                                dashboardRecordingRowStyles.groupSeparator
                                                            }
                                                            data-sot-part="dashboard-recording-list-group-separator"
                                                        />
                                                    ) : null}
                                                    <div
                                                        className={
                                                            dashboardRecordingRowStyles.group
                                                        }
                                                        data-sot-group-id={
                                                            group.id
                                                        }
                                                        data-sot-group="recording-list"
                                                        data-sot-part="dashboard-recording-list-group"
                                                        data-sot-mode={listMode}
                                                    >
                                                        <div
                                                            className={
                                                                dashboardRecordingRowStyles.groupHeading
                                                            }
                                                            data-sot-part="dashboard-recording-list-group-heading"
                                                        >
                                                            <span
                                                                className={
                                                                    dashboardRecordingRowStyles.groupLabel
                                                                }
                                                                data-sot-part="dashboard-recording-list-group-label"
                                                            >
                                                                {group.label}
                                                            </span>
                                                            <span
                                                                className={
                                                                    dashboardRecordingRowStyles.groupCount
                                                                }
                                                                data-sot-part="dashboard-recording-list-group-count"
                                                            >
                                                                {
                                                                    group
                                                                        .entries
                                                                        .length
                                                                }
                                                            </span>
                                                            <Separator
                                                                className={
                                                                    dashboardRecordingRowStyles.groupDivider
                                                                }
                                                                data-sot-part="dashboard-recording-list-group-divider"
                                                            />
                                                        </div>
                                                        {group.entries.map(
                                                            (entry) => {
                                                                const {
                                                                    recording,
                                                                } = entry;
                                                                const active =
                                                                    recording.id ===
                                                                    selectedRecording?.id;
                                                                const sourceMeta =
                                                                    sourceDefinition(
                                                                        recording.sourceProvider,
                                                                    );
                                                                const job =
                                                                    liveJobs.get(
                                                                        recording.id,
                                                                    );
                                                                const transcription =
                                                                    liveTranscriptions.get(
                                                                        recording.id,
                                                                    );
                                                                const rowStatus =
                                                                    getRecordingListStatus(
                                                                        recording,
                                                                        transcription,
                                                                        job,
                                                                        t,
                                                                    );
                                                                const primaryTag =
                                                                    entry.displayTag ??
                                                                    recording
                                                                        .tags[0];
                                                                return (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="default"
                                                                        className={
                                                                            dashboardRecordingRowStyles.row
                                                                        }
                                                                        aria-current={
                                                                            active
                                                                                ? "true"
                                                                                : undefined
                                                                        }
                                                                        key={
                                                                            recording.id
                                                                        }
                                                                        type="button"
                                                                        data-recording-id={
                                                                            recording.id
                                                                        }
                                                                        data-rec={
                                                                            recording.id
                                                                        }
                                                                        data-sot-control="dashboard-recording-row"
                                                                        data-sot-recording-id={
                                                                            recording.id
                                                                        }
                                                                        data-sot-state={
                                                                            active
                                                                                ? "selected"
                                                                                : "idle"
                                                                        }
                                                                        onClick={() =>
                                                                            selectRecording(
                                                                                recording.id,
                                                                            )
                                                                        }
                                                                    >
                                                                        <div
                                                                            className={
                                                                                dashboardRecordingRowStyles.body
                                                                            }
                                                                            data-sot-part="dashboard-recording-row-body"
                                                                        >
                                                                            <div
                                                                                className={
                                                                                    dashboardRecordingRowStyles.title
                                                                                }
                                                                                data-sot-part="dashboard-recording-row-title"
                                                                            >
                                                                                {
                                                                                    recording.filename
                                                                                }
                                                                            </div>
                                                                            <div
                                                                                className={
                                                                                    dashboardRecordingRowStyles.meta
                                                                                }
                                                                                data-sot-part="dashboard-recording-row-meta"
                                                                            >
                                                                                {sourceMeta?.icon ? (
                                                                                    <span
                                                                                        className={
                                                                                            dashboardRecordingRowStyles.sourceMark
                                                                                        }
                                                                                        data-sot-part="dashboard-recording-source-mark"
                                                                                        data-sot-provider-cover={
                                                                                            sourceMeta.cover
                                                                                                ? "true"
                                                                                                : "false"
                                                                                        }
                                                                                        data-sot-variant="image"
                                                                                        title={providerLabel(
                                                                                            recording.sourceProvider,
                                                                                            language,
                                                                                        )}
                                                                                    >
                                                                                        <Image
                                                                                            className={cn(
                                                                                                dashboardRecordingRowStyles.sourceMarkImage,
                                                                                                sourceMeta.cover
                                                                                                    ? dashboardRecordingRowStyles.sourceMarkImageCover
                                                                                                    : undefined,
                                                                                            )}
                                                                                            src={
                                                                                                sourceMeta.icon
                                                                                            }
                                                                                            alt=""
                                                                                            width={
                                                                                                14
                                                                                            }
                                                                                            height={
                                                                                                14
                                                                                            }
                                                                                        />
                                                                                    </span>
                                                                                ) : (
                                                                                    <span
                                                                                        className={cn(
                                                                                            dashboardRecordingRowStyles.sourceMark,
                                                                                            dashboardRecordingRowStyles.sourceMarkLetter,
                                                                                        )}
                                                                                        data-sot-part="dashboard-recording-source-mark"
                                                                                        data-sot-provider-cover="false"
                                                                                        data-sot-variant="letter"
                                                                                        title={providerLabel(
                                                                                            recording.sourceProvider,
                                                                                            language,
                                                                                        )}
                                                                                    >
                                                                                        讯
                                                                                    </span>
                                                                                )}
                                                                                <span
                                                                                    className={
                                                                                        dashboardRecordingRowStyles.duration
                                                                                    }
                                                                                    data-sot-part="dashboard-recording-duration"
                                                                                >
                                                                                    {formatDuration(
                                                                                        recording.duration,
                                                                                    )}
                                                                                </span>
                                                                            </div>
                                                                            <div
                                                                                className={
                                                                                    dashboardRecordingRowStyles.secondary
                                                                                }
                                                                                data-sot-part="dashboard-recording-row-secondary"
                                                                            >
                                                                                <span
                                                                                    className={
                                                                                        dashboardRecordingRowStyles.timestamp
                                                                                    }
                                                                                    data-sot-part="dashboard-recording-timestamp"
                                                                                >
                                                                                    <span
                                                                                        className={
                                                                                            dashboardRecordingRowStyles.timestampAbsolute
                                                                                        }
                                                                                        data-sot-part="dashboard-recording-timestamp-absolute"
                                                                                    >
                                                                                        {formatAbsoluteDate(
                                                                                            recording.startTime,
                                                                                        )}
                                                                                    </span>
                                                                                    <span
                                                                                        className={
                                                                                            dashboardRecordingRowStyles.timestampRelative
                                                                                        }
                                                                                        data-sot-part="dashboard-recording-timestamp-relative"
                                                                                    >
                                                                                        {formatRelativeDate(
                                                                                            recording.startTime,
                                                                                        )}
                                                                                    </span>
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                        <div
                                                                            className={
                                                                                dashboardRecordingRowStyles.actions
                                                                            }
                                                                            data-sot-part="dashboard-recording-row-actions"
                                                                        >
                                                                            <SotDashboardRecordingStatusBadge
                                                                                label={
                                                                                    rowStatus.label
                                                                                }
                                                                                tone={
                                                                                    rowStatus.tone
                                                                                }
                                                                            />
                                                                            {primaryTag ? (
                                                                                <SotPlayerTagChip
                                                                                    tag={
                                                                                        primaryTag
                                                                                    }
                                                                                />
                                                                            ) : null}
                                                                        </div>
                                                                    </Button>
                                                                );
                                                            },
                                                        )}
                                                    </div>
                                                </Fragment>
                                            ),
                                        )}
                                    </div>
                                ) : (
                                    <div
                                        className={
                                            dashboardRecordingListStateStyles.root
                                        }
                                        data-list-state-block={listState}
                                        data-sot-part="recording-list-state"
                                        data-sot-state={listState}
                                    >
                                        <span
                                            className={
                                                dashboardRecordingListStateStyles.icon
                                            }
                                            data-sot-part="recording-list-state-icon"
                                        >
                                            <FileText />
                                        </span>
                                        <div
                                            className={
                                                dashboardRecordingListStateStyles.title
                                            }
                                            data-sot-part="recording-list-state-title"
                                        >
                                            {listState === "empty"
                                                ? t("recordingList.emptyTitle")
                                                : listState === "timeline-empty"
                                                  ? t(
                                                        "recordingList.timelineEmptyTitle",
                                                    )
                                                  : listState === "tag-empty"
                                                    ? t(
                                                          "recordingList.tagEmptyTitle",
                                                      )
                                                    : t(
                                                          "recordingList.noMatchTitle",
                                                      )}
                                        </div>
                                        <div
                                            className={
                                                dashboardRecordingListStateStyles.description
                                            }
                                            data-sot-part="recording-list-state-description"
                                        >
                                            {listState === "empty"
                                                ? t(
                                                      "recordingList.emptyDescription",
                                                  )
                                                : listState === "timeline-empty"
                                                  ? t(
                                                        "recordingList.timelineEmptyDescription",
                                                    )
                                                  : listState === "tag-empty"
                                                    ? t(
                                                          "recordingList.tagEmptyDescription",
                                                      )
                                                    : t(
                                                          "recordingList.noMatchDescription",
                                                      )}
                                        </div>
                                        {listState === "empty" ? (
                                            <Button
                                                variant="default"
                                                size="sm"
                                                className={
                                                    dashboardButtonClassNames.listStatePrimary
                                                }
                                                type="button"
                                                data-sot-control="recording-list-open-data-sources"
                                                onClick={() =>
                                                    openSettings("data-sources")
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
                                                className={
                                                    dashboardButtonClassNames.listStateAction
                                                }
                                                type="button"
                                                data-sot-control="recording-list-clear-filters"
                                                onClick={() => {
                                                    setFavorite("all");
                                                    setSource("all");
                                                    setQuery("");
                                                    setLibrarySearchFilter(
                                                        null,
                                                    );
                                                    setTimelineFilter("all");
                                                    setSelectedTagFilter("all");
                                                }}
                                            >
                                                {t(
                                                    "recordingList.clearFilters",
                                                )}
                                            </Button>
                                        ) : null}
                                        {listState === "timeline-empty" ? (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className={
                                                    dashboardButtonClassNames.listStateAction
                                                }
                                                type="button"
                                                data-sot-control="recording-list-clear-timeline"
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
                                                className={
                                                    dashboardButtonClassNames.listStateAction
                                                }
                                                type="button"
                                                data-sot-control="recording-list-clear-tag"
                                                onClick={() =>
                                                    setSelectedTagFilter("all")
                                                }
                                            >
                                                {t("recordingList.clearTag")}
                                            </Button>
                                        ) : null}
                                    </div>
                                )}
                                {listState === "ready" && listTotalPages > 1 ? (
                                    <div
                                        className={
                                            dashboardRecordingListPaginationStyles.root
                                        }
                                        data-list-state-block={
                                            listPaginationState
                                        }
                                        data-sot-panel="recording-list-pagination"
                                        data-sot-state={listPaginationState}
                                    >
                                        <div
                                            className={
                                                dashboardRecordingListPaginationStyles.divider
                                            }
                                            data-sot-part="recording-list-page-divider"
                                        >
                                            <span
                                                className={
                                                    dashboardRecordingListPaginationStyles.status
                                                }
                                                data-sot-part="recording-list-page-status"
                                            >
                                                {t(listPageStatusKey, {
                                                    current: currentListPage,
                                                    loaded: listLoadedCount,
                                                    total: listEntries.length,
                                                })}
                                            </span>
                                        </div>
                                        <div
                                            className={
                                                dashboardRecordingListPaginationStyles.nav
                                            }
                                            data-sot-part="recording-list-page-nav"
                                        >
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className={
                                                    dashboardButtonClassNames.listPagination
                                                }
                                                type="button"
                                                data-page-prev=""
                                                disabled={currentListPage <= 1}
                                                aria-disabled={
                                                    currentListPage <= 1
                                                        ? "true"
                                                        : undefined
                                                }
                                                data-sot-control="recording-list-prev-page"
                                                onClick={() =>
                                                    setListPage((page) =>
                                                        Math.max(1, page - 1),
                                                    )
                                                }
                                            >
                                                {t("recordingList.previous")}
                                            </Button>
                                            <span
                                                className={
                                                    dashboardRecordingListPaginationStyles.number
                                                }
                                                data-sot-part="recording-list-page-number"
                                            >
                                                {currentListPage} /{" "}
                                                {listTotalPages}
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className={
                                                    dashboardButtonClassNames.listPagination
                                                }
                                                type="button"
                                                data-page-next=""
                                                disabled={
                                                    currentListPage >=
                                                    listTotalPages
                                                }
                                                aria-disabled={
                                                    currentListPage >=
                                                    listTotalPages
                                                        ? "true"
                                                        : undefined
                                                }
                                                data-sot-control="recording-list-next-page"
                                                onClick={() =>
                                                    setListPage((page) =>
                                                        Math.min(
                                                            listTotalPages,
                                                            page + 1,
                                                        ),
                                                    )
                                                }
                                            >
                                                {t("recordingList.next")}
                                            </Button>
                                        </div>
                                        {listPaginationState === "paginated" ? (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className={
                                                    dashboardButtonClassNames.listPagination
                                                }
                                                type="button"
                                                data-sot-control="recording-list-load-more"
                                                onClick={() =>
                                                    setListPage((page) =>
                                                        Math.min(
                                                            listTotalPages,
                                                            page + 1,
                                                        ),
                                                    )
                                                }
                                            >
                                                {t("recordingList.loadMore")}
                                            </Button>
                                        ) : null}
                                    </div>
                                ) : null}
                            </div>
                        </CardContent>
                    </Card>

                    <section
                        className={DASHBOARD_DETAIL_PANEL_CLASS_NAME}
                        data-sot-panel="dashboard-detail"
                        data-empty={selectedRecording ? "false" : "true"}
                    >
                        <CardHeader
                            className={SOT_DASHBOARD_DETAIL_HEADER_CLASS_NAME}
                            data-sot-panel="dashboard-detail-header"
                            data-sot-mode={dashboardDetailHeaderMode}
                            data-sot-state={dashboardDetailHeaderState}
                            data-rename-mode={dashboardDetailHeaderState}
                            data-local-only={
                                localDeleteAvailable ? "true" : "false"
                            }
                        >
                            {dashboardDetailHeaderState === "normal" ? (
                                <CardTitle
                                    className={
                                        SOT_DASHBOARD_DETAIL_HEADER_TITLE_CLASS_NAME
                                    }
                                    data-sot-part="detail-header-title"
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
                                    className={
                                        SOT_DASHBOARD_DETAIL_HEADER_BADGE_CLASS_NAME
                                    }
                                    data-sot-part="detail-header-local-badge"
                                    data-rh-local
                                    aria-label="仅存在本地副本"
                                >
                                    本地副本
                                </Badge>
                            ) : null}
                            {dashboardDetailHeaderState === "editing" ? (
                                <Input
                                    type="text"
                                    className={
                                        SOT_DASHBOARD_DETAIL_HEADER_TITLE_INPUT_CLASS_NAME
                                    }
                                    data-rh-input
                                    data-sot-part="detail-header-title-input"
                                    data-sot-state="editing"
                                    value={draftTitle}
                                    aria-label="录音标题"
                                    maxLength={120}
                                    onChange={(event) =>
                                        setDraftTitle(event.target.value)
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
                                    className={
                                        SOT_DASHBOARD_DETAIL_HEADER_BADGE_CLASS_NAME
                                    }
                                    data-sot-part="detail-header-title-status"
                                    data-sot-state="saving"
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
                                    data-sot-control="rename-recording-title"
                                    data-sot-part="detail-header-action"
                                    data-sot-mode="normal"
                                    disabled={!selectedRecording}
                                    onClick={() => setEditingTitle(true)}
                                >
                                    <Pencil data-icon="inline-start" />
                                </Button>
                            ) : null}
                            {dashboardDetailHeaderState === "normal" ? (
                                <div
                                    className={
                                        SOT_DASHBOARD_DETAIL_HEADER_ACTION_ANCHOR_CLASS_NAME
                                    }
                                    data-rh-ai-anchor
                                    data-sot-part="detail-header-action-anchor"
                                    data-sot-mode="normal"
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
                                        data-sot-control="ai-rename"
                                        data-sot-part="detail-header-action"
                                        data-sot-mode="normal"
                                        data-sot-state={
                                            aiUnavailableReason
                                                ? "unavailable"
                                                : aiOpen
                                                  ? aiState
                                                  : "idle"
                                        }
                                        title={aiUnavailableReason || undefined}
                                        onClick={() => void previewAutoRename()}
                                    >
                                        <Sparkle data-icon="inline-start" />
                                        AI 重命名
                                    </Button>
                                    {aiOpen && selectedRecording ? (
                                        <AiRenamePreview
                                            className="![right:1px]"
                                            applyLabel="应用"
                                            bodyLabel="建议标题"
                                            cancelLabel="取消"
                                            closeLabel="关闭预览"
                                            filename={aiPreviewTitle}
                                            hint={
                                                aiState === "unavailable"
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
                                                    : aiState === "review"
                                                      ? "确认无误后点击「应用」，将替换录音标题且不可一键撤销。"
                                                      : aiError
                                            }
                                            onApply={applyAiRename}
                                            onCancel={() => {
                                                setAiOpen(false);
                                                setAiApplying(false);
                                            }}
                                            onRegenerate={previewAutoRename}
                                            originalFilename={
                                                selectedRecording.filename
                                            }
                                            regenerateLabel={
                                                aiState === "error"
                                                    ? "重试"
                                                    : aiState === "loading"
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
                            {dashboardDetailHeaderState === "editing" ? (
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
                                        data-sot-control="save-recording-title"
                                        data-sot-part="detail-header-action"
                                        data-sot-mode="editing"
                                        disabled={renaming}
                                        onClick={() => void renameRecording()}
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
                                        data-sot-control="cancel-recording-title"
                                        data-sot-part="detail-header-action"
                                        data-sot-mode="editing"
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
                                    className={
                                        SOT_DASHBOARD_DETAIL_HEADER_ACTION_ANCHOR_CLASS_NAME
                                    }
                                    data-sot-part="detail-header-action-anchor"
                                    data-sot-mode="normal"
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
                                                data-sot-control="recording-more-actions"
                                                data-sot-part="detail-header-action"
                                                data-sot-mode="normal"
                                                ref={moreTriggerRef}
                                            >
                                                <EllipsisVertical data-icon="inline-start" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent
                                            align="end"
                                            sideOffset={6}
                                            variant="glass"
                                            className={
                                                SOT_DASHBOARD_MORE_MENU_CONTENT_CLASS_NAME
                                            }
                                            data-sot-menu="recording-more-actions"
                                            data-open="true"
                                            data-sot-local-delete-available={
                                                localDeleteAvailable
                                                    ? "true"
                                                    : "false"
                                            }
                                            data-sot-state={moreActionsState}
                                            aria-label="更多操作"
                                        >
                                            <DropdownMenuGroup>
                                                <DropdownMenuItem
                                                    density="compact"
                                                    className={
                                                        SOT_DASHBOARD_MORE_MENU_ITEM_CLASS_NAME
                                                    }
                                                    data-sot-menu-item="rename"
                                                    disabled={
                                                        !selectedRecording
                                                    }
                                                    onSelect={() => {
                                                        setMoreOpen(false);
                                                        setAiOpen(false);
                                                        setTagOpen(false);
                                                        setEditingTitle(true);
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
                                                    className={
                                                        SOT_DASHBOARD_MORE_MENU_ITEM_CLASS_NAME
                                                    }
                                                    data-sot-menu-item="ai-rename"
                                                    disabled={
                                                        !selectedRecording
                                                    }
                                                    onSelect={() => {
                                                        setMoreOpen(false);
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
                                                        className={
                                                            SOT_DASHBOARD_MORE_MENU_ITEM_CLASS_NAME
                                                        }
                                                        data-sot-menu-item="retranscribe"
                                                        disabled={
                                                            !selectedRecording
                                                        }
                                                        onSelect={() => {
                                                            setMoreOpen(false);
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
                                                        className={
                                                            SOT_DASHBOARD_MORE_MENU_SEPARATOR_CLASS_NAME
                                                        }
                                                        data-sot-menu-separator="delete"
                                                    />
                                                ) : null}
                                                <DropdownMenuItem
                                                    density="compact"
                                                    className={
                                                        SOT_DASHBOARD_MORE_MENU_ITEM_CLASS_NAME
                                                    }
                                                    variant="destructive"
                                                    data-sot-menu-item="delete-local"
                                                    data-sot-tone="danger"
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
                                                                    : SOT_DASHBOARD_MORE_MENU_HINT_CLASS_NAME
                                                            }
                                                            data-sot-menu-hint=""
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
                            className={
                                SOT_DASHBOARD_RECORDING_PLAYER_CARD_CLASS_NAME
                            }
                            data-no-audio={
                                playbackDisabled ? "true" : undefined
                            }
                            data-playing={isPlaying ? "true" : undefined}
                            data-sot-state={
                                playbackDisabled ? "disabled" : "ready"
                            }
                            data-sot-surface="dashboard-recording-player"
                        >
                            <SotPlayerNoAudioAlert
                                part="dashboard-recording-player-no-audio"
                                iconPart="dashboard-recording-player-no-audio-icon"
                                textPart="dashboard-recording-player-no-audio-text"
                                titlePart="dashboard-recording-player-no-audio-title"
                                descriptionPart="dashboard-recording-player-no-audio-description"
                                playbackDisabled={playbackDisabled}
                            />
                            <CardHeader
                                className={
                                    SOT_DASHBOARD_RECORDING_PLAYER_META_CLASS_NAME
                                }
                                data-sot-part="dashboard-recording-player-meta"
                            >
                                <span
                                    className={
                                        SOT_DASHBOARD_RECORDING_PLAYER_DATE_CLASS_NAME
                                    }
                                    data-sot-part="dashboard-recording-player-date"
                                    suppressHydrationWarning
                                >
                                    {selectedRecording
                                        ? formatSotPlayerDate(
                                              selectedRecording.startTime,
                                          )
                                        : "未选择录音"}
                                </span>
                                {selectedRecording ? (
                                    <SotPlayerSourceTag
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
                                    <SotPlayerTagChip
                                        count={selectedRecording.tags.length}
                                        onClick={() => {
                                            setSearchOpen(false);
                                            setActivityOpen(false);
                                            setMoreOpen(false);
                                            setAiOpen(false);
                                            setTagOpen((open) => !open);
                                        }}
                                        state={tagOpen ? "open" : "idle"}
                                        tag={selectedPlayerTag}
                                        trigger
                                    />
                                ) : null}
                                {tagOpen && selectedRecording ? (
                                    <RecordingTagManager
                                        variant="popover"
                                        recording={selectedRecording}
                                        availableTags={availableTags}
                                        loadError={tagLoadError || null}
                                        onAvailableTagsChange={setAvailableTags}
                                        onRecordingTagsChange={
                                            applyDashboardRecordingTags
                                        }
                                        onClose={() => setTagOpen(false)}
                                    />
                                ) : null}
                                {selectedPlayerStatus ? (
                                    <SotPlayerStatusBadge
                                        label={selectedPlayerStatus.label}
                                        tone={selectedPlayerStatus.tone}
                                        className="ml-auto"
                                    />
                                ) : null}
                            </CardHeader>
                            <DashboardRecordingPlayerControls
                                currentTime={currentTime}
                                duration={playerDurationValue}
                                isPlaying={isPlaying}
                                onCyclePlaybackSpeed={cyclePlaybackSpeed}
                                onSeekBySeconds={seekDashboardPlayerBySeconds}
                                onSeekToPercent={seekDashboardPlayerToPercent}
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

                        <Card
                            hasNoPadding
                            className={
                                SOT_DASHBOARD_TRANSCRIPT_SHELL_CARD_CLASS_NAME
                            }
                            data-sot-panel="dashboard-transcript-shell"
                        >
                            <CardHeader
                                className={
                                    SOT_DASHBOARD_TRANSCRIPT_HEADER_CLASS_NAME
                                }
                                data-sot-part="dashboard-transcript-header"
                            >
                                <SegmentedTabs
                                    aria-label="详情标签"
                                    variant="segmented"
                                    size="segmentedSm"
                                    className={
                                        SOT_DASHBOARD_TRANSCRIPT_SEGMENTED_TABS_CLASS_NAME
                                    }
                                    data-sot-control="segmented-tabs"
                                    data-sot-size="sm"
                                    getItemProps={getSotSegmentedTabProps}
                                    items={[
                                        { value: "transcript", label: "转写" },
                                        { value: "speakers", label: "说话人" },
                                        {
                                            value: "source",
                                            label: "来源详情",
                                            tabKey: "source-report",
                                        },
                                    ]}
                                    value={detailTab}
                                    onValueChange={(value) => {
                                        setDetailTab(value);
                                        setAiOpen(false);
                                        setTagOpen(false);
                                        setMoreOpen(false);
                                        setSearchOpen(false);
                                        setActivityOpen(false);
                                    }}
                                />
                                <div
                                    className={
                                        SOT_DASHBOARD_TRANSCRIPT_ACTIONS_CLASS_NAME
                                    }
                                    data-sot-part="dashboard-transcript-actions"
                                >
                                    {detailTab === "transcript" &&
                                    selectedTranscription?.language ? (
                                        <Badge
                                            variant="outline"
                                            className={
                                                SOT_DASHBOARD_TRANSCRIPT_LANGUAGE_BADGE_CLASS_NAME
                                            }
                                            data-sot-part="dashboard-transcript-language"
                                        >
                                            <Globe2 data-icon="inline-start" />
                                            {transcriptLanguageLabel(
                                                selectedTranscription.language,
                                                language,
                                            )}
                                        </Badge>
                                    ) : null}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className={
                                            dashboardButtonClassNames.copy
                                        }
                                        type="button"
                                        data-copy="transcript"
                                        data-copy-state={
                                            copyFeedback?.action ===
                                            "local-transcript"
                                                ? copyFeedback.state
                                                : undefined
                                        }
                                        data-sot-control="copy-local-transcript"
                                        data-sot-state={
                                            localTranscriptCopyState
                                        }
                                        data-tab-scope="transcript"
                                        aria-busy={
                                            copyingAction === "local-transcript"
                                        }
                                        aria-disabled={
                                            localTranscriptCopyDisabled
                                                ? "true"
                                                : "false"
                                        }
                                        aria-label={t(
                                            "transcription.copyTranscript",
                                        )}
                                        aria-live={
                                            copyFeedback?.action ===
                                            "local-transcript"
                                                ? "polite"
                                                : undefined
                                        }
                                        disabled={localTranscriptCopyDisabled}
                                        hidden={detailTab !== "transcript"}
                                        onClick={() =>
                                            void handleCopyLocalTranscript()
                                        }
                                    >
                                        <SotCopyIcon
                                            state={
                                                copyFeedback?.action ===
                                                "local-transcript"
                                                    ? copyFeedback.state
                                                    : undefined
                                            }
                                        />
                                        <span
                                            className={
                                                sourceReportClassNames.copyLabel
                                            }
                                            data-sot-part="dashboard-copy-label"
                                        >
                                            {copyFeedback?.action ===
                                            "local-transcript"
                                                ? copyFeedback.state === "ok"
                                                    ? t("common.copied")
                                                    : t(
                                                          "common.copyFailedShort",
                                                      )
                                                : t(
                                                      "transcription.copyTranscript",
                                                  )}
                                        </span>
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size={sourceReportCopyButtonSize}
                                        className={
                                            sourceReportClassNames.copyButton
                                        }
                                        type="button"
                                        data-copy="source-transcript"
                                        data-copy-state={
                                            copyFeedback?.action ===
                                            "source-transcript"
                                                ? copyFeedback.state
                                                : undefined
                                        }
                                        data-sot-control="copy-source-transcript"
                                        data-sot-state={
                                            sourceTranscriptCopyState
                                        }
                                        data-tab-scope="source-report"
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
                                        disabled={sourceTranscriptCopyDisabled}
                                        hidden={detailTab !== "source"}
                                        onClick={() =>
                                            void handleCopySourceMaterial(
                                                "source-transcript",
                                            )
                                        }
                                    >
                                        <SotCopyIcon
                                            state={
                                                copyFeedback?.action ===
                                                "source-transcript"
                                                    ? copyFeedback.state
                                                    : undefined
                                            }
                                        />
                                        <span
                                            className={
                                                sourceReportClassNames.copyLabel
                                            }
                                            data-sot-part="dashboard-copy-label"
                                        >
                                            {copyFeedback?.action ===
                                            "source-transcript"
                                                ? copyFeedback.state === "ok"
                                                    ? t("common.copied")
                                                    : t(
                                                          "common.copyFailedShort",
                                                      )
                                                : t(
                                                      "sourceReport.copySourceTranscript",
                                                  )}
                                        </span>
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size={sourceReportCopyButtonSize}
                                        className={
                                            sourceReportClassNames.copyButton
                                        }
                                        type="button"
                                        data-copy="source-report"
                                        data-copy-state={
                                            copyFeedback?.action ===
                                            "source-report"
                                                ? copyFeedback.state
                                                : undefined
                                        }
                                        data-sot-control="copy-source-report"
                                        data-sot-state={sourceReportCopyState}
                                        data-tab-scope="source-report"
                                        aria-busy={
                                            copyingAction === "source-report"
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
                                        disabled={sourceReportCopyDisabled}
                                        hidden={detailTab !== "source"}
                                        onClick={() =>
                                            void handleCopySourceMaterial(
                                                "source-report",
                                            )
                                        }
                                    >
                                        <SotCopyIcon
                                            state={
                                                copyFeedback?.action ===
                                                "source-report"
                                                    ? copyFeedback.state
                                                    : undefined
                                            }
                                        />
                                        <span
                                            className={
                                                sourceReportClassNames.copyLabel
                                            }
                                            data-sot-part="dashboard-copy-label"
                                        >
                                            {copyFeedback?.action ===
                                            "source-report"
                                                ? copyFeedback.state === "ok"
                                                    ? t("common.copied")
                                                    : t(
                                                          "common.copyFailedShort",
                                                      )
                                                : t(
                                                      "sourceReport.copySourceReport",
                                                  )}
                                        </span>
                                    </Button>
                                    {detailTab === "source" ? (
                                        <Button
                                            variant="outline"
                                            size="xs"
                                            className={
                                                sourceReportClassNames.actionButton
                                            }
                                            type="button"
                                            data-sot-control="refresh-source-report"
                                            data-sot-state={sourceReportState}
                                            disabled={
                                                sourceReportState === "loading"
                                            }
                                            onClick={() =>
                                                void loadSourceReport()
                                            }
                                        >
                                            <CloudDownload data-icon="inline-start" />
                                            {sourceReportState === "loading"
                                                ? t(
                                                      "sourceReport.loadingDetail",
                                                  )
                                                : t("sourceReport.refresh")}
                                        </Button>
                                    ) : null}
                                    <span
                                        data-sot-part="dashboard-retranscription-disabled-hint"
                                        className={
                                            dashboardRetranscriptionClassNames.disabledHint
                                        }
                                        hidden={
                                            detailTab !== "transcript" ||
                                            dashboardRetxState !== "unavailable"
                                        }
                                    >
                                        当前来源不支持私有重转写
                                    </span>
                                    <Button
                                        id="retx-btn"
                                        variant="ghost"
                                        size="sm"
                                        className={
                                            dashboardButtonClassNames.compactAction
                                        }
                                        type="button"
                                        data-sot-control="retranscribe-recording"
                                        data-sot-state={dashboardRetxState}
                                        data-retx-state={dashboardRetxState}
                                        aria-disabled={
                                            !selectedRecording ||
                                            !selectedRecording.audioUrl
                                        }
                                        disabled={
                                            !selectedRecording ||
                                            !selectedRecording.audioUrl
                                        }
                                        hidden={detailTab !== "transcript"}
                                        title={
                                            dashboardRetxState === "unavailable"
                                                ? "当前来源不支持私有重转写"
                                                : undefined
                                        }
                                        onClick={() => void retranscribe()}
                                    >
                                        重新转写
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent
                                className={cn(
                                    SOT_DASHBOARD_TRANSCRIPT_BODY_BASE_CLASS_NAME,
                                    dashboardScrollbarClassName,
                                    dashboardRetranscriptionThemeClassName,
                                )}
                                data-sot-part="dashboard-transcript-body"
                            >
                                <div
                                    data-sot-panel="dashboard-retranscription"
                                    className={
                                        dashboardRetranscriptionClassNames.banner
                                    }
                                    data-sot-state={dashboardRetxState}
                                    data-retx-state={dashboardRetxState}
                                    hidden={
                                        dashboardRetxState === "idle" ||
                                        dashboardRetxState === "unavailable"
                                    }
                                >
                                    <span
                                        data-sot-part="dashboard-retranscription-icon"
                                        className={
                                            dashboardRetranscriptionClassNames.icon
                                        }
                                        aria-hidden="true"
                                    >
                                        {dashboardRetxState === "queued" ||
                                        dashboardRetxState === "running" ? (
                                            <Spinner
                                                className={
                                                    dashboardRetranscriptionClassNames.spinner
                                                }
                                                data-sot-part="dashboard-retranscription-spinner"
                                                size="xs"
                                            />
                                        ) : dashboardRetxState === "failed" ? (
                                            <RetxWarnIcon />
                                        ) : dashboardRetxState ===
                                          "completed" ? (
                                            <RetxOkIcon />
                                        ) : dashboardRetxState ===
                                          "unavailable" ? (
                                            <RetxWarnIcon />
                                        ) : (
                                            <RefreshCw />
                                        )}
                                    </span>
                                    <div
                                        data-sot-part="dashboard-retranscription-body"
                                        className={
                                            dashboardRetranscriptionClassNames.body
                                        }
                                    >
                                        <div
                                            data-sot-part="dashboard-retranscription-title"
                                            className={
                                                dashboardRetranscriptionClassNames.title
                                            }
                                        >
                                            {dashboardRetxTitle}
                                        </div>
                                        <div
                                            data-sot-part="dashboard-retranscription-sub"
                                            className={
                                                dashboardRetranscriptionClassNames.sub
                                            }
                                        >
                                            {dashboardRetxSub}
                                        </div>
                                    </div>
                                    {dashboardRetxState === "failed" ? (
                                        <div
                                            data-sot-part="dashboard-retranscription-actions"
                                            className={
                                                dashboardRetranscriptionClassNames.actions
                                            }
                                        >
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className={
                                                    dashboardButtonClassNames.compactAction
                                                }
                                                type="button"
                                                data-retx-retry=""
                                                data-sot-control="retry-retranscription"
                                                onClick={() =>
                                                    void retranscribe()
                                                }
                                            >
                                                重试转写
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className={cn(
                                                    dashboardButtonClassNames.compactAction,
                                                    dashboardRetranscriptionClassNames.closeButton,
                                                )}
                                                type="button"
                                                aria-label="收起"
                                                data-retx-dismiss=""
                                                data-sot-control="dismiss-retranscription-failed"
                                                onClick={() =>
                                                    setRetxState("idle")
                                                }
                                            >
                                                <RetxCloseIcon />
                                            </Button>
                                        </div>
                                    ) : dashboardRetxState === "completed" &&
                                      selectedRecording ? (
                                        <div
                                            data-sot-part="dashboard-retranscription-actions"
                                            className={
                                                dashboardRetranscriptionClassNames.actions
                                            }
                                        >
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className={cn(
                                                    dashboardButtonClassNames.compactAction,
                                                    dashboardRetranscriptionClassNames.closeButton,
                                                )}
                                                type="button"
                                                aria-label="收起"
                                                data-retx-dismiss=""
                                                data-sot-control="dismiss-retranscription-complete"
                                                onClick={() => {
                                                    const recordingId =
                                                        selectedRecording.id;
                                                    setDismissedCompletedRetxIds(
                                                        (items) =>
                                                            new Set(items).add(
                                                                recordingId,
                                                            ),
                                                    );
                                                }}
                                            >
                                                <RetxCloseIcon />
                                            </Button>
                                        </div>
                                    ) : null}
                                </div>
                                <p
                                    data-sot-part="dashboard-retranscription-refresh-marker"
                                    className={
                                        dashboardRetranscriptionClassNames.refreshMarker
                                    }
                                    hidden={dashboardRetxState !== "completed"}
                                >
                                    刚刷新 · 1 秒前
                                </p>
                                <div
                                    className={dashboardTabPaneHiddenClassName}
                                    data-sot-panel="dashboard-transcript-pane"
                                    data-sot-tab-pane="transcript"
                                    data-tab-pane="transcript"
                                    hidden={detailTab !== "transcript"}
                                >
                                    {isTranscriptLoading ? (
                                        TRANSCRIPT_LOADING_SKELETON_ROWS.map(
                                            (item) => (
                                                <div
                                                    className={
                                                        dashboardTranscriptClassNames.turn
                                                    }
                                                    data-sot-item="dashboard-transcript-turn"
                                                    data-sot-state="loading"
                                                    key={`transcript-skeleton:${item.key}`}
                                                >
                                                    <div
                                                        className={
                                                            dashboardTranscriptClassNames.speakerRow
                                                        }
                                                        data-sot-part="dashboard-transcript-speaker-row"
                                                        data-sot-state="loading"
                                                    >
                                                        <DashboardTranscriptSkeleton size="avatar" />
                                                        <DashboardTranscriptSkeleton
                                                            size={item.speaker}
                                                        />
                                                        <DashboardTranscriptSkeleton size="time" />
                                                    </div>
                                                    <DashboardTranscriptSkeleton
                                                        size={item.firstLine}
                                                    />
                                                    <DashboardTranscriptSkeleton
                                                        size={item.secondLine}
                                                    />
                                                    {item.thirdLine ? (
                                                        <DashboardTranscriptSkeleton
                                                            size={
                                                                item.thirdLine
                                                            }
                                                        />
                                                    ) : null}
                                                </div>
                                            ),
                                        )
                                    ) : turns.length ? (
                                        turns.map((turn, index) => {
                                            const speakerName =
                                                turn.speakerName ||
                                                `说话人 ${index + 1}`;
                                            const timeLabel =
                                                formatTranscriptTurnTimestamp(
                                                    turn.startMs,
                                                    turn.endMs,
                                                );
                                            const avatarLabel =
                                                formatTranscriptAvatarLabel(
                                                    speakerName,
                                                    index,
                                                );

                                            return (
                                                <div
                                                    className={
                                                        dashboardTranscriptClassNames.turn
                                                    }
                                                    data-sot-item="dashboard-transcript-turn"
                                                    data-sot-state="ready"
                                                    key={`${selectedRecording?.id}:${index}`}
                                                >
                                                    <div
                                                        className={
                                                            dashboardTranscriptClassNames.speakerRow
                                                        }
                                                        data-sot-part="dashboard-transcript-speaker-row"
                                                        data-sot-state="ready"
                                                    >
                                                        <span
                                                            className={
                                                                dashboardTranscriptClassNames.avatar
                                                            }
                                                            data-sot-part="dashboard-transcript-avatar"
                                                            data-sot-tone={
                                                                TRANSCRIPT_AVATAR_TONES[
                                                                    index %
                                                                        TRANSCRIPT_AVATAR_TONES.length
                                                                ]
                                                            }
                                                        >
                                                            {avatarLabel}
                                                        </span>
                                                        <span
                                                            className={
                                                                dashboardTranscriptClassNames.speakerName
                                                            }
                                                            data-sot-part="dashboard-transcript-speaker-name"
                                                        >
                                                            {speakerName}
                                                        </span>
                                                        <span
                                                            className={
                                                                dashboardTranscriptClassNames.speakerTime
                                                            }
                                                            data-sot-format="mono"
                                                            data-sot-part="dashboard-transcript-speaker-time"
                                                        >
                                                            {timeLabel ?? "--"}
                                                        </span>
                                                    </div>
                                                    <p
                                                        className={
                                                            dashboardTranscriptClassNames.paragraph
                                                        }
                                                    >
                                                        {turn.text}
                                                    </p>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <Empty
                                            data-sot-panel="dashboard-transcript-empty"
                                            className={
                                                dashboardTranscriptClassNames.empty
                                            }
                                        >
                                            <EmptyHeader
                                                className={
                                                    dashboardTranscriptClassNames.emptyHeader
                                                }
                                            >
                                                <EmptyMedia
                                                    aria-hidden="true"
                                                    className={
                                                        dashboardTranscriptClassNames.emptyIcon
                                                    }
                                                    data-sot-part="dashboard-transcript-empty-icon"
                                                    variant="icon"
                                                >
                                                    <SotTranscriptEmptyIcon />
                                                </EmptyMedia>
                                                <EmptyTitle
                                                    className={
                                                        dashboardTranscriptClassNames.emptyMessage
                                                    }
                                                    data-sot-part="dashboard-transcript-empty-message"
                                                >
                                                    还没有逐字稿
                                                </EmptyTitle>
                                                <EmptyDescription
                                                    className={
                                                        dashboardTranscriptClassNames.emptySub
                                                    }
                                                    data-sot-part="dashboard-transcript-empty-sub"
                                                >
                                                    来源已就绪，转写任务还在排队中。
                                                </EmptyDescription>
                                            </EmptyHeader>
                                        </Empty>
                                    )}
                                </div>
                                <div
                                    className={cn(
                                        sourceReportClassNames.pane,
                                        dashboardTabPaneHiddenClassName,
                                    )}
                                    data-sot-source-report-pane
                                    data-sot-panel="dashboard-source-report"
                                    data-sot-tab-pane="source-report"
                                    data-sot-state={sourceReportVisualState}
                                    data-tab-pane="source-report"
                                    hidden={detailTab !== "source"}
                                >
                                    {sourceReportState === "loading" ? (
                                        <SotSourceReportState state="loading">
                                            <SotSourceReportMetricCards>
                                                <SotSourceReportMetricCard
                                                    label="来源"
                                                    metric="source"
                                                    value="skeleton"
                                                >
                                                    <SotSourceReportCardSkeleton size="source" />
                                                </SotSourceReportMetricCard>
                                                <SotSourceReportMetricCard
                                                    label="转写状态"
                                                    metric="transcript-status"
                                                    value="skeleton"
                                                >
                                                    <SotSourceReportCardSkeleton size="status" />
                                                </SotSourceReportMetricCard>
                                                <SotSourceReportMetricCard
                                                    label="摘要状态"
                                                    metric="summary-status"
                                                    value="skeleton"
                                                >
                                                    <SotSourceReportCardSkeleton size="status" />
                                                </SotSourceReportMetricCard>
                                                <SotSourceReportMetricCard
                                                    label="分段数"
                                                    metric="segment-count"
                                                    value="skeleton"
                                                >
                                                    <SotSourceReportCardSkeleton size="count" />
                                                </SotSourceReportMetricCard>
                                            </SotSourceReportMetricCards>
                                            <SotSourceReportSection
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
                                                <div
                                                    className={
                                                        sourceReportClassNames.segmentSkeletonContainer
                                                    }
                                                    data-sot-source-report-segment
                                                    data-sot-state="skeleton"
                                                >
                                                    <SotSourceReportSegmentSkeleton size="time" />
                                                    <SotSourceReportSegmentSkeleton size="speaker" />
                                                    <SotSourceReportSegmentSkeleton size="line-long" />
                                                    <SotSourceReportSegmentSkeleton size="line-medium" />
                                                </div>
                                                <div
                                                    className={
                                                        sourceReportClassNames.segmentSkeletonContainer
                                                    }
                                                    data-sot-source-report-segment
                                                    data-sot-state="skeleton"
                                                >
                                                    <SotSourceReportSegmentSkeleton size="time" />
                                                    <SotSourceReportSegmentSkeleton size="speaker" />
                                                    <SotSourceReportSegmentSkeleton size="line-wide" />
                                                    <SotSourceReportSegmentSkeleton size="line-short" />
                                                </div>
                                            </SotSourceReportSection>
                                        </SotSourceReportState>
                                    ) : sourceReportState === "error" ? (
                                        <SotSourceReportState
                                            state="error"
                                            error={
                                                sourceReportError || undefined
                                            }
                                        >
                                            <Alert
                                                variant="statusError"
                                                className={cn(
                                                    sourceReportClassNames.errorAlert,
                                                    sourceReportClassNames.emptySurface,
                                                )}
                                                data-sot-source-report-empty
                                                data-sot-tone="err"
                                            >
                                                <div
                                                    className={cn(
                                                        sourceReportClassNames.emptyIcon,
                                                        sourceReportClassNames.emptyErrorIcon,
                                                    )}
                                                    data-sot-source-report-empty-icon
                                                    aria-hidden="true"
                                                >
                                                    <SotSourceReportErrorIcon />
                                                </div>
                                                <AlertTitle
                                                    className={
                                                        sourceReportClassNames.emptyTitle
                                                    }
                                                    data-sot-source-report-empty-title
                                                >
                                                    无法读取来源详情
                                                </AlertTitle>
                                                <AlertDescription
                                                    className={
                                                        sourceReportClassNames.emptyDescription
                                                    }
                                                    data-sot-source-report-empty-description
                                                >
                                                    {
                                                        sourceReportProviderSentenceName
                                                    }
                                                    返回了一个错误，可能是网络抖动或来源临时不可用。
                                                </AlertDescription>
                                                <div
                                                    className={
                                                        sourceReportClassNames.emptyActionRow
                                                    }
                                                    data-sot-source-report-empty-actions
                                                >
                                                    <Button
                                                        variant="default"
                                                        size="xs"
                                                        className={
                                                            sourceReportClassNames.primaryActionButton
                                                        }
                                                        type="button"
                                                        data-sot-control="refresh-source-report"
                                                        data-sot-state="error"
                                                        onClick={() =>
                                                            void loadSourceReport()
                                                        }
                                                    >
                                                        重试
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="xs"
                                                        className={
                                                            sourceReportClassNames.ghostActionButton
                                                        }
                                                        type="button"
                                                        data-sot-control="source-report-activity-log"
                                                        data-sot-state="error"
                                                        onClick={() => {
                                                            setSearchOpen(
                                                                false,
                                                            );
                                                            setMoreOpen(false);
                                                            setTagOpen(false);
                                                            setAiOpen(false);
                                                            setActivityOpen(
                                                                true,
                                                            );
                                                        }}
                                                    >
                                                        查看同步日志
                                                    </Button>
                                                </div>
                                            </Alert>
                                        </SotSourceReportState>
                                    ) : sourceReportData ? (
                                        <SotSourceReportState
                                            state="loaded"
                                            subState={sourceReportSubState}
                                        >
                                            {!selectedRecording?.hasAudio ? (
                                                <SotSourceReportStatusBadge tone="warn">
                                                    <SotSourceReportStatusDot />
                                                    {t(
                                                        "sourceReport.sourceOnlyNoAudio",
                                                    )}
                                                </SotSourceReportStatusBadge>
                                            ) : null}
                                            <SotSourceReportMetricCards>
                                                <SotSourceReportMetricCard
                                                    label={t(
                                                        "recording.source",
                                                    )}
                                                    metric="source"
                                                    value="source"
                                                >
                                                    {sourceReportProviderDefinition?.icon ? (
                                                        // biome-ignore lint/performance/noImgElement: SOT source cards render provider asset nodes directly.
                                                        <img
                                                            className={
                                                                sourceReportClassNames.cardSourceIcon
                                                            }
                                                            src={
                                                                sourceReportProviderDefinition.icon
                                                            }
                                                            alt=""
                                                        />
                                                    ) : (
                                                        <span
                                                            className={
                                                                sourceReportClassNames.cardSourceFallback
                                                            }
                                                            data-sot-part="source-report-card-source-fallback"
                                                        >
                                                            {sourceReportProviderName.charAt(
                                                                0,
                                                            )}
                                                        </span>
                                                    )}
                                                    <span>
                                                        {
                                                            sourceReportProviderName
                                                        }
                                                    </span>
                                                </SotSourceReportMetricCard>
                                                <SotSourceReportMetricCard
                                                    label="转写状态"
                                                    metric="transcript-status"
                                                >
                                                    <SotSourceReportStatusBadge
                                                        tone={sourceReportReadinessTone(
                                                            sourceTranscriptStatusLabel,
                                                        )}
                                                    >
                                                        <SotSourceReportStatusDot />
                                                        {
                                                            sourceTranscriptStatusLabel
                                                        }
                                                    </SotSourceReportStatusBadge>
                                                </SotSourceReportMetricCard>
                                                <SotSourceReportMetricCard
                                                    label="摘要状态"
                                                    metric="summary-status"
                                                >
                                                    <SotSourceReportStatusBadge
                                                        tone={sourceReportReadinessTone(
                                                            sourceSummaryStatusLabel,
                                                        )}
                                                    >
                                                        <SotSourceReportStatusDot />
                                                        {
                                                            sourceSummaryStatusLabel
                                                        }
                                                    </SotSourceReportStatusBadge>
                                                </SotSourceReportMetricCard>
                                                <SotSourceReportMetricCard
                                                    label="分段数"
                                                    metric="segment-count"
                                                    value="number"
                                                >
                                                    {sourceReportSegmentCount}
                                                </SotSourceReportMetricCard>
                                            </SotSourceReportMetricCards>

                                            <SotSourceReportSection
                                                section="transcript"
                                                title="来源转写"
                                                noticeAfter={
                                                    sourceTranscriptAvailable ? null : (
                                                        <SotSourceReportMissingNotice state="transcript-missing">
                                                            来源未提供逐字稿。可以稍后再来，或运行私有转写。
                                                        </SotSourceReportMissingNotice>
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
                                                <ol
                                                    className={
                                                        sourceReportClassNames.segments
                                                    }
                                                    data-sot-source-report-segments
                                                    hidden={
                                                        !sourceTranscriptAvailable
                                                    }
                                                >
                                                    {sourceReportDisplaySegments.map(
                                                        (segment, index) => (
                                                            <li
                                                                className={
                                                                    sourceReportClassNames.segment
                                                                }
                                                                data-sot-source-report-segment
                                                                key={[
                                                                    selectedRecordingId,
                                                                    "source",
                                                                    segment.startMs,
                                                                    segment.endMs,
                                                                    segment.speaker,
                                                                    segment.text,
                                                                    index,
                                                                ].join(":")}
                                                            >
                                                                <span
                                                                    className={
                                                                        sourceReportClassNames.segmentTime
                                                                    }
                                                                    data-sot-source-report-segment-time
                                                                    data-sot-format="mono"
                                                                >
                                                                    {[
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
                                                                        "--"}
                                                                </span>
                                                                <span
                                                                    className={
                                                                        sourceReportClassNames.segmentSpeaker
                                                                    }
                                                                    data-sot-source-report-segment-speaker
                                                                >
                                                                    {segment.speaker ||
                                                                        `说话人 ${index + 1}`}
                                                                </span>
                                                                <p
                                                                    className={
                                                                        sourceReportClassNames.segmentText
                                                                    }
                                                                    data-sot-source-report-segment-text
                                                                >
                                                                    {
                                                                        segment.text
                                                                    }
                                                                </p>
                                                            </li>
                                                        ),
                                                    )}
                                                </ol>
                                            </SotSourceReportSection>

                                            {sourceSummaryLines.length > 0 ? (
                                                <SotSourceReportSection
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
                                                    <div
                                                        className={
                                                            sourceReportClassNames.summaryBody
                                                        }
                                                        data-sot-source-report-summary-body
                                                    >
                                                        {sourceSummaryLines.map(
                                                            (line, index) => (
                                                                <p
                                                                    key={`${index}:${line}`}
                                                                    className={
                                                                        sourceReportClassNames.summaryText
                                                                    }
                                                                    data-sot-source-report-segment-text
                                                                >
                                                                    {line}
                                                                </p>
                                                            ),
                                                        )}
                                                    </div>
                                                </SotSourceReportSection>
                                            ) : null}

                                            <SotSourceReportSection
                                                section="metadata"
                                                title="来源信息"
                                                noticeBefore={
                                                    sourceSummaryAvailable ? null : (
                                                        <SotSourceReportMissingNotice state="summary-missing">
                                                            来源未提供官方摘要。
                                                        </SotSourceReportMissingNotice>
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
                                                <dl
                                                    className={
                                                        sourceReportClassNames.meta
                                                    }
                                                    data-sot-source-report-meta
                                                >
                                                    <SotSourceReportMetaRow label="来源">
                                                        {
                                                            sourceReportProviderName
                                                        }
                                                    </SotSourceReportMetaRow>
                                                    <SotSourceReportMetaRow label="状态">
                                                        <SotSourceReportStatusBadge
                                                            tone={sourceReportSyncTone(
                                                                sourceReportSyncStatusLabel,
                                                            )}
                                                        >
                                                            <SotSourceReportStatusDot />
                                                            {
                                                                sourceReportSyncStatusLabel
                                                            }
                                                        </SotSourceReportStatusBadge>
                                                    </SotSourceReportMetaRow>
                                                    <SotSourceReportMetaRow
                                                        label="录制于"
                                                        valueFormat="mono"
                                                    >
                                                        {formatSourceReportDate(
                                                            sourceReportRecordedAt,
                                                        )}
                                                    </SotSourceReportMetaRow>
                                                    <SotSourceReportMetaRow
                                                        label="最近更新"
                                                        valueFormat="mono"
                                                    >
                                                        {formatSourceReportDate(
                                                            sourceReportUpdatedAt,
                                                        )}
                                                    </SotSourceReportMetaRow>
                                                    <SotSourceReportMetaRow label="可读内容">
                                                        {sourceReportReadable}
                                                    </SotSourceReportMetaRow>
                                                    <SotSourceReportMetaRow label="来源标题">
                                                        {sourceReportTitle}
                                                    </SotSourceReportMetaRow>
                                                    <SotSourceReportMetaRow label="语种">
                                                        {sourceReportLanguage}
                                                    </SotSourceReportMetaRow>
                                                    <SotSourceReportMetaRow
                                                        label="时长"
                                                        valueFormat="mono"
                                                    >
                                                        {selectedRecording
                                                            ? formatDuration(
                                                                  selectedRecording.duration,
                                                              )
                                                            : "--"}
                                                    </SotSourceReportMetaRow>
                                                </dl>
                                                <div
                                                    className={
                                                        sourceReportClassNames.actionRow
                                                    }
                                                    data-sot-source-report-actions
                                                >
                                                    <Button
                                                        variant="ghost"
                                                        size="xs"
                                                        className={
                                                            sourceReportClassNames.ghostActionButton
                                                        }
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
                                                        data-sot-control="open-source-record"
                                                        data-sot-state={
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
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="xs"
                                                        className={
                                                            sourceReportClassNames.ghostActionButton
                                                        }
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
                                                        data-sot-control="repull-source"
                                                        data-sot-state={
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
                                                    </Button>
                                                </div>
                                            </SotSourceReportSection>
                                        </SotSourceReportState>
                                    ) : (
                                        <SotSourceReportState state="empty">
                                            <Card
                                                hasNoPadding
                                                className={
                                                    sourceReportClassNames.emptySurface
                                                }
                                                data-sot-source-report-empty
                                                data-sot-tone="neutral"
                                            >
                                                <div
                                                    className={
                                                        sourceReportClassNames.emptyIcon
                                                    }
                                                    data-sot-source-report-empty-icon
                                                    aria-hidden="true"
                                                >
                                                    <SotSourceReportEmptyIcon />
                                                </div>
                                                <div
                                                    className={
                                                        sourceReportClassNames.emptyTitle
                                                    }
                                                    data-sot-source-report-empty-title
                                                >
                                                    这条录音没有关联来源
                                                </div>
                                                <div
                                                    className={
                                                        sourceReportClassNames.emptyDescription
                                                    }
                                                    data-sot-source-report-empty-description
                                                >
                                                    本地导入或离线录制的录音不会有来源详情。
                                                </div>
                                            </Card>
                                        </SotSourceReportState>
                                    )}
                                </div>
                                <div
                                    className={dashboardTabPaneHiddenClassName}
                                    data-sot-panel="dashboard-speakers-pane"
                                    data-sot-tab-pane="speakers"
                                    data-tab-pane="speakers"
                                    hidden={detailTab !== "speakers"}
                                >
                                    <div
                                        className={
                                            dashboardSpeakerPaneClassNames.head
                                        }
                                        data-sot-part="dashboard-speakers-head"
                                    >
                                        <div
                                            className={
                                                dashboardSpeakerPaneClassNames.headTitle
                                            }
                                            data-sot-part="dashboard-speakers-head-title"
                                        >
                                            {turns.length || 0} 段说话人
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className={
                                                dashboardButtonClassNames.speakersMerge
                                            }
                                            type="button"
                                            data-sot-control="dashboard-speakers-merge"
                                        >
                                            合并相似…
                                        </Button>
                                    </div>
                                    <ul
                                        className={
                                            dashboardSpeakerPaneClassNames.rows
                                        }
                                        data-sot-list="dashboard-speaker-rows"
                                    >
                                        {(turns.length
                                            ? turns
                                            : [
                                                  {
                                                      text: "转写完成后可查看说话人信息",
                                                      speakerName: null,
                                                  },
                                              ]
                                        ).map((turn, index) => {
                                            return (
                                                <li
                                                    className={
                                                        dashboardSpeakerPaneClassNames.row
                                                    }
                                                    data-sot-item="dashboard-speaker-row"
                                                    key={`${selectedRecording?.id}:speaker:${index}`}
                                                >
                                                    <span
                                                        className={
                                                            dashboardSpeakerPaneClassNames.avatar
                                                        }
                                                        data-sot-part="dashboard-speaker-avatar"
                                                    >
                                                        {index + 1}
                                                    </span>
                                                    <div
                                                        className={
                                                            dashboardSpeakerPaneClassNames.rowMeta
                                                        }
                                                        data-sot-part="dashboard-speaker-row-meta"
                                                    >
                                                        <div
                                                            className={
                                                                dashboardSpeakerPaneClassNames.name
                                                            }
                                                            data-sot-part="dashboard-speaker-name"
                                                        >
                                                            {turn.speakerName ||
                                                                `说话人 ${index + 1}`}
                                                        </div>
                                                        <div
                                                            className={
                                                                dashboardSpeakerPaneClassNames.sub
                                                            }
                                                            data-sot-part="dashboard-speaker-sub"
                                                        >
                                                            {turn.text.length}{" "}
                                                            字
                                                        </div>
                                                    </div>
                                                    <span
                                                        className={
                                                            dashboardSpeakerPaneClassNames.bar
                                                        }
                                                        data-sot-part="dashboard-speaker-bar"
                                                    >
                                                        <span
                                                            className={cn(
                                                                dashboardSpeakerPaneClassNames.barFill,
                                                                getDashboardSpeakerShareClassName(
                                                                    index,
                                                                ),
                                                            )}
                                                            data-sot-part="dashboard-speaker-bar-fill"
                                                        />
                                                    </span>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            </CardContent>
                        </Card>
                        {!selectedRecording ? (
                            <DashboardDetailEmptyState />
                        ) : null}
                    </section>
                </div>
            </main>

            <SettingsDialog
                open={settingsOpen}
                returnFocusRef={settingsTriggerRef}
                user={user}
                onOpenChange={setSettingsOpen}
            />
        </div>
    );
}
