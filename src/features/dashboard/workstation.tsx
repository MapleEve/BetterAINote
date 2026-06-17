"use client";

import {
    AlertCircle,
    Bell,
    Check,
    CheckCircle,
    ChevronDown,
    CloudDownload,
    Copy,
    EllipsisVertical,
    FileText,
    Mic,
    PanelLeft,
    Pencil,
    Plus,
    RefreshCw,
    Search,
    Sparkles,
    Tags,
    X,
} from "lucide-react";
import {
    type CSSProperties,
    type KeyboardEvent as ReactKeyboardEvent,
    type ReactNode,
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
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
} from "@/components/ui/input-group";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SystemBanner } from "@/features/dashboard/components/system-banner";
import { AiRenamePreviewCard as AiRenamePreview } from "@/features/recordings/components/ai-rename-preview-card";
import { RecordingTagManager } from "@/features/recordings/components/recording-tag-manager";
import { RecordingTagIconGlyph } from "@/features/recordings/components/recording-tag-visuals";
import {
    formatSotPlayerDate,
    formatSotPlayerTime,
    SotPlayerBackIcon,
    SotPlayerForwardIcon,
    SotPlayerNoAudioIcon,
    SotPlayerPauseIcon,
    SotPlayerPlayIcon,
    SotPlayerSourceTag,
    SotPlayerStatusBadge,
    type SotPlayerStatusTone,
    SotPlayerTagChip,
    SotPlayerVolumeIcon,
    sotPlayerVolumeLevel,
} from "@/features/recordings/components/sot-player-primitives";
import { SettingsDialog } from "@/features/settings/components/settings-dialog";
import { useDisplaySettingsStore } from "@/features/settings/display-settings-store";
import { usePlaybackSettingsStore } from "@/features/settings/playback-settings-store";
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
] as const;
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

const FAVORITES: { value: Favorite; label: string; icon: typeof Mic }[] = [
    { value: "all", label: "全部录音", icon: Mic },
    { value: "transcribed", label: "转写记录", icon: FileText },
    { value: "tags", label: "标签", icon: Tags },
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

function formatSourceSummaryDisplayText(markdown: string) {
    return markdown
        .split(/\r?\n/)
        .map((line) =>
            line
                .trim()
                .replace(/^#{1,6}\s+/, "")
                .replace(/^[-*]\s+/, ""),
        )
        .filter(Boolean)
        .join("\n");
}

function sourceSummaryHasDisplayHeading(markdown: string) {
    return /^#{1,6}\s+\S/m.test(markdown);
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

type SourceReportTone = "err" | "neu" | "ok" | "warn";

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

function SotSourceReportStatusBadge({
    children,
    tone,
}: {
    children: ReactNode;
    tone: SourceReportTone;
}) {
    return (
        <Badge
            variant="outline"
            data-sot-badge="source-report-status"
            data-sot-tone={tone}
        >
            {children}
        </Badge>
    );
}

function SotSourceReportMetricCards({ children }: { children: ReactNode }) {
    return <div data-sot-list="source-report-cards">{children}</div>;
}

function SotSourceReportMetricCard({
    children,
    label,
    metric,
    value,
}: {
    children: ReactNode;
    label: string;
    metric: "segment-count" | "source" | "summary-status" | "transcript-status";
    value?: "number" | "skeleton" | "source";
}) {
    return (
        <Card
            hasNoPadding
            data-sot-card="source-report-metric"
            data-sot-metric={metric}
        >
            <div data-sot-part="source-report-card-label">{label}</div>
            {value === "skeleton" ? (
                children
            ) : (
                <div
                    data-sot-part="source-report-card-value"
                    data-sot-value={value}
                >
                    {children}
                </div>
            )}
        </Card>
    );
}

function SotSourceReportCardSkeleton({
    size,
}: {
    size: "count" | "source" | "status";
}) {
    return (
        <Skeleton
            aria-hidden="true"
            data-sot-part="source-report-card-skeleton"
            data-sot-size={size}
        />
    );
}

function SotSourceReportSegmentSkeleton({
    size,
}: {
    size:
        | "line-long"
        | "line-medium"
        | "line-short"
        | "line-wide"
        | "speaker"
        | "time";
}) {
    return (
        <Skeleton
            aria-hidden="true"
            data-sot-part="source-report-segment-skeleton"
            data-sot-size={size}
        />
    );
}

function SotSourceReportState({
    children,
    error,
    state,
    subState,
}: {
    children: ReactNode;
    error?: string;
    state: "empty" | "error" | "loaded" | "loading";
    subState?: string;
}) {
    return (
        <div
            data-sot-source-report-state
            data-sot-panel="dashboard-source-report-state"
            data-sot-state={state}
            data-state={state}
            data-sub-state={subState}
            data-sot-error={error}
        >
            {children}
        </div>
    );
}

function SotSourceReportSection({
    children,
    description,
    section,
    title,
}: {
    children: ReactNode;
    description: ReactNode;
    section: "metadata" | "summary" | "transcript";
    title: string;
}) {
    return (
        <section data-sot-source-report-section data-sot-section={section}>
            <Separator data-sot-source-report-section-separator />
            <header data-sot-source-report-section-header>
                <h4 data-sot-source-report-section-title>{title}</h4>
                <span data-sot-source-report-section-description>
                    {description}
                </span>
            </header>
            {children}
        </section>
    );
}

function SotSourceReportMetaRow({
    children,
    label,
}: {
    children: ReactNode;
    label: string;
}) {
    return (
        <div data-sot-source-report-meta-row>
            <dt>{label}</dt>
            <dd>{children}</dd>
        </div>
    );
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
        // biome-ignore lint/a11y/noSvgWithoutTitle: SOT retx icon SVG is hidden by the parent icon wrapper.
        <svg
            data-sot-part="dashboard-retranscription-icon-warn"
            viewBox="0 0 24 24"
        >
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
            <circle cx="12" cy="12" r="10" />
        </svg>
    );
}

function RetxOkIcon() {
    return (
        // biome-ignore lint/a11y/noSvgWithoutTitle: SOT retx icon SVG is hidden by the parent icon wrapper.
        <svg
            data-sot-part="dashboard-retranscription-icon-ok"
            viewBox="0 0 24 24"
        >
            <path d="M20 6 9 17l-5-5" />
        </svg>
    );
}

function RetxCloseIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
            aria-hidden="true"
            focusable="false"
        >
            <path d="M18 6 6 18M6 6l12 12" />
        </svg>
    );
}

function SotCopyIcon({ state }: { state?: "err" | "ok" }) {
    const Icon = state === "ok" ? Check : Copy;

    return (
        <Icon
            data-icon="inline-start"
            data-sot-part="dashboard-copy-icon"
            aria-hidden="true"
        />
    );
}

function SotTranscriptEmptyIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            aria-hidden="true"
            focusable="false"
        >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
    );
}

function SotDetailEmptyIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
        </svg>
    );
}

function DashboardDetailEmptyState() {
    return (
        <div data-detail-empty="" data-sot-panel="dashboard-detail-empty">
            <div data-sot-part="dashboard-detail-empty-icon" aria-hidden="true">
                <SotDetailEmptyIcon />
            </div>
            <div data-sot-part="dashboard-detail-empty-title">
                请选择一条录音
            </div>
            <div data-sot-part="dashboard-detail-empty-description">
                在左侧列表中挑一条录音，转写与说话人信息会显示在这里。
            </div>
        </div>
    );
}

function SotSourceReportErrorIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5" />
            <circle cx="12" cy="16" r=".8" fill="currentColor" />
        </svg>
    );
}

function SotSourceReportEmptyIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <rect x="3" y="6" width="18" height="14" rx="2" />
            <path d="M8 6V4h8v2" />
        </svg>
    );
}

function SotRecordingListSkeleton() {
    return (
        <div data-sot-panel="recording-list-loading">
            <div data-sot-part="skeleton-day">
                <Skeleton data-sot-part="skeleton-day-label" />
                <span data-sot-part="skeleton-day-line" />
            </div>
            <div data-sot-part="skeleton-row">
                <div data-sot-part="skeleton-row-body">
                    <Skeleton data-sot-part="skeleton-title" />
                    <div data-sot-part="skeleton-meta">
                        <Skeleton data-sot-part="skeleton-meta-time" />
                        <Skeleton data-sot-part="skeleton-meta-tag" />
                        <Skeleton data-sot-part="skeleton-meta-pill" />
                    </div>
                </div>
                <div data-sot-part="skeleton-row-tail">
                    <Skeleton data-sot-part="skeleton-tag" />
                </div>
            </div>
            <div data-sot-part="skeleton-row">
                <div data-sot-part="skeleton-row-body">
                    <Skeleton
                        data-sot-part="skeleton-title"
                        data-sot-size="90"
                    />
                    <div data-sot-part="skeleton-meta">
                        <Skeleton data-sot-part="skeleton-meta-time" />
                        <Skeleton data-sot-part="skeleton-meta-tag" />
                        <Skeleton
                            data-sot-part="skeleton-meta-pill"
                            data-sot-size="70"
                        />
                    </div>
                </div>
                <div data-sot-part="skeleton-row-tail">
                    <Skeleton data-sot-part="skeleton-tag" />
                </div>
            </div>
            <div data-sot-part="skeleton-day">
                <Skeleton
                    data-sot-part="skeleton-day-label"
                    data-sot-size="40"
                />
                <span data-sot-part="skeleton-day-line" />
            </div>
            <div data-sot-part="skeleton-row">
                <div data-sot-part="skeleton-row-body">
                    <Skeleton
                        data-sot-part="skeleton-title"
                        data-sot-size="80"
                    />
                    <div data-sot-part="skeleton-meta">
                        <Skeleton data-sot-part="skeleton-meta-time" />
                        <Skeleton data-sot-part="skeleton-meta-tag" />
                        <Skeleton data-sot-part="skeleton-meta-pill" />
                    </div>
                </div>
                <div data-sot-part="skeleton-row-tail" />
            </div>
            <div data-sot-part="skeleton-row">
                <div data-sot-part="skeleton-row-body">
                    <Skeleton
                        data-sot-part="skeleton-title"
                        data-sot-size="70"
                    />
                    <div data-sot-part="skeleton-meta">
                        <Skeleton data-sot-part="skeleton-meta-time" />
                        <Skeleton data-sot-part="skeleton-meta-tag" />
                    </div>
                </div>
                <div data-sot-part="skeleton-row-tail">
                    <Skeleton data-sot-part="skeleton-tag" />
                </div>
            </div>
            <div data-sot-part="skeleton-row">
                <div data-sot-part="skeleton-row-body">
                    <Skeleton
                        data-sot-part="skeleton-title"
                        data-sot-size="85"
                    />
                    <div data-sot-part="skeleton-meta">
                        <Skeleton data-sot-part="skeleton-meta-time" />
                        <Skeleton data-sot-part="skeleton-meta-tag" />
                        <Skeleton data-sot-part="skeleton-meta-pill" />
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
            <mark data-sot-part="library-search-highlight">
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

    const closeActivityOverlay = useCallback(
        (options: { restoreFocus?: boolean } = {}) => {
            if (options.restoreFocus) {
                restoreActivityFocusRef.current = true;
                activityTriggerRef.current?.focus({ preventScroll: true });
                window.setTimeout(() => {
                    activityTriggerRef.current?.focus({ preventScroll: true });
                }, 0);
                window.setTimeout(() => {
                    activityTriggerRef.current?.focus({ preventScroll: true });
                    restoreActivityFocusRef.current = false;
                }, 50);
            }
            setActivityOpen(false);
        },
        [],
    );

    useEffect(() => {
        setHydrated(true);
    }, []);

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
    const volumeMuted = volume === 0;
    const volumePopoverOpen = volumeOpen && !playbackDisabled;
    const playerControlsState = playbackDisabled
        ? "disabled"
        : volumeMuted
          ? "muted"
          : isPlaying
            ? "playing"
            : "ready";
    const playerControlState = playbackDisabled ? "disabled" : "ready";
    const playerProgressPct = Math.max(0, Math.min(100, Math.round(progress)));
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
    const sourceSummaryRenderedText =
        formatSourceSummaryDisplayText(sourceSummaryText);
    const sourceSummaryVisible =
        sourceSummaryRenderedText &&
        sourceSummaryHasDisplayHeading(sourceSummaryText);
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
            await Promise.all([refreshStatus(), loadDataSources()]);
            refreshBrowserRoute(router);
            await loadSourceReport();
            setSourceRepullState("success");
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
        restoreActivityFocusRef.current = false;
        const frame = window.requestAnimationFrame(() => {
            activityTriggerRef.current?.focus({ preventScroll: true });
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

    useEffect(() => {
        document.body.dataset.drawer = drawerOpen ? "open" : "closed";
        document.body.dataset.sourceFilter = source === "all" ? "" : source;
        document.body.dataset.sourceStatus =
            source === "all"
                ? ""
                : (sourceRows.find((row) => row.key === source)?.status ?? "");
        document.body.dataset.timeStyle = "rel";
        return () => {
            delete document.body.dataset.drawer;
            delete document.body.dataset.sourceFilter;
            delete document.body.dataset.sourceStatus;
            delete document.body.dataset.timeStyle;
        };
    }, [drawerOpen, source, sourceRows]);

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

    return (
        <div
            data-sot-shell="dashboard-workstation"
            data-hydrated={hydrated ? "true" : "false"}
            data-playback-auto-next={
                playbackSettings.autoPlayNext ? "true" : "false"
            }
            data-playback-settings-loaded={
                playbackSettingsLoaded ? "true" : "false"
            }
            data-sidebar-collapsed={collapsed ? "true" : "false"}
            data-sot-surface="dashboard-workstation"
            data-sot-state={hydrated ? "ready" : "loading"}
        >
            <aside data-sot-panel="dashboard-sidebar" ref={sourceDrawerRef}>
                <div data-sot-part="dashboard-brand">
                    <img src="/assets/logo-mark-steel.svg" alt="" />
                    <div data-sot-part="dashboard-brand-text">
                        <div data-sot-part="dashboard-brand-name">
                            BetterAINote
                        </div>
                        <div data-sot-part="dashboard-brand-subtitle">
                            私人工作空间
                        </div>
                    </div>
                </div>

                <nav data-sot-list="dashboard-nav" aria-label="录音筛选">
                    <div data-sot-part="dashboard-nav-section-label">收藏</div>
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
                                size="sm"
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
                                <Icon />
                                <span>{getFavoriteLabel(item.value, t)}</span>
                                <span data-sot-part="dashboard-favorite-count">
                                    {count}
                                </span>
                            </Button>
                        );
                    })}

                    <div data-sot-part="dashboard-nav-section-label">
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
                                onClick={() => setSource("all")}
                            >
                                {t("sourceProviderRows.clear")}
                            </Button>
                        ) : null}
                        {dataSourcesError ? (
                            <div
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
                                            <img src={item.icon} alt="" />
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
                                    <span>{item.label}</span>
                                    <span
                                        aria-hidden="true"
                                        data-sot-part="source-provider-status"
                                    />
                                    {actionKind ? (
                                        // biome-ignore lint/a11y/useSemanticElements: SOT defines source row action as span[role=button] inside the provider row.
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
                                                if (actionKind === "retry") {
                                                    void runManualSync();
                                                    return;
                                                }
                                                window.localStorage.setItem(
                                                    SETTINGS_DATA_SOURCE_PROVIDER_STORAGE_KEY,
                                                    item.key,
                                                );
                                                openSettings("data-sources");
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
                                                if (actionKind === "retry") {
                                                    void runManualSync();
                                                    return;
                                                }
                                                window.localStorage.setItem(
                                                    SETTINGS_DATA_SOURCE_PROVIDER_STORAGE_KEY,
                                                    item.key,
                                                );
                                                openSettings("data-sources");
                                            }}
                                        >
                                            {actionKind === "retry" ||
                                            actionKind === "reauth" ? (
                                                <RefreshCw />
                                            ) : (
                                                <Plus />
                                            )}
                                            {actionLabel}
                                        </span>
                                    ) : (
                                        <span
                                            data-count={`src:${item.key}`}
                                            data-sot-part="source-provider-count"
                                        >
                                            {visibleCount}
                                        </span>
                                    )}
                                </Button>
                            );
                        })}
                    </div>
                </nav>

                <div data-sot-part="dashboard-sidebar-footer">
                    <div
                        data-sot-panel="dashboard-sync"
                        data-sot-state={syncButtonState}
                        data-sync-state={syncButtonState}
                    >
                        <span data-sot-part="dashboard-sync-indicator" />
                        <div data-sot-part="dashboard-sync-text">
                            <div data-sot-part="dashboard-sync-title">
                                {syncStateLabel(syncButtonState, t)} ·
                                BetterAINote
                            </div>
                            <div data-sot-part="dashboard-sync-subtitle">
                                {syncSummary}
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon-sm"
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
                data-sot-panel="dashboard-drawer-scrim"
                id="drawer-scrim"
                aria-hidden="true"
            />

            <main data-sot-panel="dashboard-main">
                <header data-sot-panel="dashboard-topbar">
                    <button
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
                        {/* biome-ignore lint/a11y/noSvgWithoutTitle: SOT drawer trigger SVG is decorative inside the labelled button. */}
                        <svg viewBox="0 0 24 24">
                            <line x1="3" y1="6" x2="21" y2="6" />
                            <line x1="3" y1="12" x2="15" y2="12" />
                            <line x1="3" y1="18" x2="21" y2="18" />
                        </svg>{" "}
                        <span
                            data-sot-part="dashboard-drawer-active-dot"
                            aria-hidden="true"
                        />
                    </button>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        type="button"
                        aria-label="折叠 / 展开侧边栏"
                        data-sot-control="sidebar-collapse"
                        data-sot-state={collapsed ? "collapsed" : "expanded"}
                        onClick={() => setCollapsed((value) => !value)}
                    >
                        <PanelLeft data-icon="inline-start" />
                    </Button>
                    <div data-sot-part="dashboard-crumbs">
                        <span data-sot-part="dashboard-crumb">
                            {favorite === "all"
                                ? "全部录音"
                                : favorite === "transcribed"
                                  ? "转写记录"
                                  : "标签"}
                        </span>
                        <span data-sot-part="dashboard-crumb-separator">/</span>
                        <span data-sot-part="dashboard-crumb-current">
                            {selectedRecording?.filename ?? "未选择录音"}
                        </span>
                    </div>
                    <div data-sot-part="dashboard-topbar-actions">
                        <div
                            data-sot-part="library-search-anchor"
                            ref={searchOverlayRef}
                        >
                            <Button
                                ref={searchTriggerRef}
                                variant="ghost"
                                size="icon-sm"
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
                                <Search data-icon="inline-start" />
                            </Button>
                            {searchOpen ? (
                                <Card
                                    hasNoPadding
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
                                        data-sot-part="library-search-input-row"
                                        data-state={searchPanelState}
                                        data-disabled={String(
                                            searchPanelState === "indexing",
                                        )}
                                    >
                                        <InputGroupAddon align="inline-start">
                                            <Search data-icon="inline-start" />
                                        </InputGroupAddon>
                                        <InputGroupInput
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
                                                size="icon-xs"
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
                                                <X />
                                            </InputGroupButton>
                                        ) : null}
                                    </InputGroup>
                                    <ToggleGroup
                                        type="single"
                                        value={searchScope}
                                        spacing={1.5}
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
                                    <CardContent data-sot-region="library-search-scroll">
                                        {searchPanelState === "indexing" ? (
                                            <div
                                                data-sot-part="library-search-indexing"
                                                data-sot-state="indexing"
                                            >
                                                <Skeleton data-sot-part="library-search-state-skeleton" />
                                                <div data-sot-part="library-search-state-copy">
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
                                                data-sot-part="library-search-loading"
                                                data-sot-state="loading"
                                            >
                                                <div data-sot-part="library-search-state-copy">
                                                    {t("librarySearch.loading")}
                                                </div>
                                            </div>
                                        ) : searchError ? (
                                            <Alert
                                                data-sot-part="library-search-error"
                                                data-sot-state="error"
                                            >
                                                <AlertTitle data-sot-part="library-search-state-title">
                                                    {t("librarySearch.error")}
                                                </AlertTitle>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
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
                                                data-sot-list="library-search-results"
                                                data-sot-state="results"
                                            >
                                                {groupedSearchResults.map(
                                                    (group) => (
                                                        <div
                                                            key={group.type}
                                                            data-sot-group="library-search-results"
                                                            data-sot-result-type={
                                                                group.type
                                                            }
                                                        >
                                                            <div data-sot-part="library-search-group-label">
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
                                                                            size="sm"
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
                                                                                    data-sot-part="library-search-tag-chip"
                                                                                >
                                                                                    <Tags data-icon="inline-start" />
                                                                                    {highlightSearchText(
                                                                                        title,
                                                                                        query,
                                                                                    )}
                                                                                </Badge>
                                                                            ) : (
                                                                                <span data-sot-part="library-search-result-title">
                                                                                    {highlightSearchText(
                                                                                        title,
                                                                                        query,
                                                                                    )}
                                                                                </span>
                                                                            )}
                                                                            <span data-sot-part="library-search-result-meta">
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
                                                data-sot-part="library-search-empty"
                                                data-sot-state={
                                                    query.trim()
                                                        ? "no-results"
                                                        : "no-query"
                                                }
                                            >
                                                {query.trim() ? (
                                                    <div data-sot-part="library-search-state-copy">
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
                                                    <div data-sot-part="library-search-state-copy">
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
                            data-sot-part="dashboard-activity-anchor"
                            ref={activityOverlayRef}
                        >
                            <Button
                                ref={activityTriggerRef}
                                variant="ghost"
                                size="icon-sm"
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
                                    setSearchOpen(false);
                                    setMoreOpen(false);
                                    setTagOpen(false);
                                    setAiOpen(false);
                                    setActivityOpen((open) => !open);
                                }}
                            >
                                <Bell data-icon="inline-start" />
                                <span data-sot-part="dashboard-activity-badge">
                                    {activityBadgeCount > 99
                                        ? "99+"
                                        : activityBadgeCount}
                                </span>
                            </Button>
                            {activityOpen ? (
                                <Card
                                    hasNoPadding
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
                                    <CardHeader data-sot-part="dashboard-activity-header">
                                        <div data-sot-part="dashboard-activity-heading">
                                            <CardTitle data-sot-part="dashboard-activity-title">
                                                {t("activityOverlay.title")}
                                            </CardTitle>
                                            <Badge
                                                variant="outline"
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
                                                size="icon-sm"
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
                                                <X data-icon="inline-start" />
                                            </Button>
                                        </CardAction>
                                    </CardHeader>
                                    <Separator data-sot-part="dashboard-activity-header-separator" />
                                    <CardContent data-sot-part="dashboard-activity-content">
                                        <div
                                            data-state={syncButtonState}
                                            data-sot-part="dashboard-activity-status"
                                            data-sot-state={syncButtonState}
                                        >
                                            <span
                                                data-sot-part="dashboard-activity-status-indicator"
                                                aria-hidden="true"
                                            />
                                            <div data-sot-part="dashboard-activity-status-copy">
                                                <div data-sot-part="dashboard-activity-status-line">
                                                    {syncStatusLabel}
                                                </div>
                                                <div
                                                    className="mono"
                                                    data-sot-part="dashboard-activity-status-sub"
                                                >
                                                    {syncSummary}
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
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
                                            <ul data-sot-list="dashboard-activity-items">
                                                {visibleActivityItems.map(
                                                    (item) => (
                                                        <li
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
                                                            <span data-sot-part="dashboard-activity-item-icon">
                                                                {item.tone ===
                                                                "success" ? (
                                                                    <CheckCircle />
                                                                ) : item.tone ===
                                                                  "info" ? (
                                                                    <Bell />
                                                                ) : (
                                                                    <AlertCircle />
                                                                )}
                                                            </span>
                                                            <div data-sot-part="dashboard-activity-item-copy">
                                                                <div data-sot-part="dashboard-activity-item-title">
                                                                    {item.title}
                                                                </div>
                                                                <div data-sot-part="dashboard-activity-item-body">
                                                                    {item.body}
                                                                </div>
                                                                <div data-sot-part="dashboard-activity-item-meta">
                                                                    {t(
                                                                        "activityOverlay.justNow",
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div data-sot-part="dashboard-activity-item-actions">
                                                                {item.action ? (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
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
                                                                    <X />
                                                                </Button>
                                                            </div>
                                                        </li>
                                                    ),
                                                )}
                                            </ul>
                                        ) : (
                                            <div data-sot-part="dashboard-activity-empty">
                                                <div
                                                    data-sot-part="dashboard-activity-empty-icon"
                                                    aria-hidden="true"
                                                >
                                                    <CheckCircle />
                                                </div>
                                                <p data-sot-part="dashboard-activity-empty-title">
                                                    {t(
                                                        "activityOverlay.emptyTitle",
                                                    )}
                                                </p>
                                                <p data-sot-part="dashboard-activity-empty-body">
                                                    {t(
                                                        "activityOverlay.emptyBody",
                                                    )}
                                                </p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            ) : null}
                        </div>
                        <button
                            ref={settingsTriggerRef}
                            className="avatar"
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
                    </div>
                </header>

                <SystemBanner />

                <div data-sot-panel="dashboard-workspace">
                    <Card
                        hasNoPadding
                        data-current-page={String(currentListPage)}
                        data-list-state={listState}
                        data-sot-list-mode={listMode}
                        data-sot-state={listState}
                        data-sot-surface="dashboard-recording-list"
                        data-total-pages={String(listTotalPages)}
                        data-visible-count={String(pagedListEntries.length)}
                    >
                        <CardContent data-sot-part="dashboard-recording-list-content">
                            <div data-sot-part="dashboard-recording-list-header">
                                <div data-sot-part="dashboard-recording-list-titlebar">
                                    <h2 data-sot-part="dashboard-recording-list-title">
                                        {getFavoriteLabel(favorite, t)}
                                    </h2>
                                    <span data-sot-part="dashboard-recording-list-count">
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
                                        data-sot-panel="dashboard-source-filter-stack"
                                        data-sot-provider={source}
                                        data-sot-state={sourceFilterStackState}
                                        data-sot-status={
                                            selectedSourceRow?.status ?? ""
                                        }
                                        data-state={sourceFilterStackState}
                                    >
                                        <span data-sot-part="source-filter-from">
                                            {t("sourceFilterStack.filter")} ·{" "}
                                            <b>
                                                {t(
                                                    "dashboardFavorites.allRecordings",
                                                )}
                                            </b>
                                        </span>
                                        <span data-sot-part="source-filter-separator">
                                            ›
                                        </span>
                                        <span data-sot-part="source-filter-chip">
                                            <span data-stack-label>
                                                {providerLabel(
                                                    source,
                                                    language,
                                                )}
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                type="button"
                                                aria-label={t(
                                                    "sourceFilterStack.clearSourceFilter",
                                                )}
                                                data-sot-control="source-filter-clear"
                                                onClick={() => setSource("all")}
                                            >
                                                <X data-icon="inline-start" />
                                            </Button>
                                        </span>
                                        <span data-sot-part="source-filter-info">
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
                                                variant="ghost"
                                                size="sm"
                                                type="button"
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
                                                variant="ghost"
                                                size="sm"
                                                type="button"
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
                                                variant="ghost"
                                                size="sm"
                                                type="button"
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
                                            variant="ghost"
                                            size="sm"
                                            type="button"
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
                                        data-sot-panel="dashboard-library-search-filter"
                                        data-sot-filter={
                                            librarySearchFilter.type
                                        }
                                        data-sot-state="active"
                                    >
                                        <span data-sot-part="library-search-filter-label">
                                            {librarySearchFilter.type === "tag"
                                                ? t(
                                                      "dashboardFavorites.tagFilter",
                                                  )
                                                : t(
                                                      "dashboardFavorites.speakerFilter",
                                                  )}
                                        </span>
                                        <span data-sot-part="library-search-filter-chip">
                                            {librarySearchFilter.label}
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                type="button"
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
                                <div data-sot-panel="dashboard-recording-list-mode">
                                    <div data-sot-part="dashboard-recording-list-mode-label">
                                        <span data-sot-part="dashboard-recording-list-mode-title">
                                            {listMode === "timeline"
                                                ? t(
                                                      "recordingList.timelineTitle",
                                                  )
                                                : t("recordingList.tagsTitle")}
                                        </span>
                                        <span data-sot-part="dashboard-recording-list-mode-count">
                                            {t("recordingList.visibleCount", {
                                                count: listEntries.length,
                                            })}
                                        </span>
                                    </div>
                                    <SegmentedTabs
                                        aria-label="列表模式"
                                        data-sot-part="dashboard-recording-list-mode-segmented"
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
                                                key={item.value}
                                                value={item.value}
                                            >
                                                {t(item.labelKey)}
                                                <span data-sot-part="dashboard-recording-time-filter-count">
                                                    {timelineCounts[item.value]}
                                                </span>
                                            </ToggleGroupItem>
                                        );
                                    })}
                                </ToggleGroup>
                                <div
                                    data-list-filter-row="tags"
                                    data-sot-panel="recording-list-tag-filter"
                                    hidden={listMode !== "tags"}
                                    inert={
                                        listMode !== "tags" ? true : undefined
                                    }
                                    ref={tagFilterRef}
                                >
                                    <Button
                                        variant="ghost"
                                        size="sm"
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
                                            data-tag-filter-label=""
                                            data-sot-part="recording-list-tag-filter-label"
                                        >
                                            {selectedTagOption.label}
                                        </span>
                                        <span
                                            data-tag-filter-count=""
                                            data-sot-part="recording-list-tag-filter-count"
                                        >
                                            {selectedTagOption.count}
                                        </span>
                                        <ChevronDown
                                            data-icon="inline-end"
                                            data-sot-part="recording-list-tag-filter-caret"
                                            aria-hidden="true"
                                        />
                                    </Button>
                                    <div
                                        role="listbox"
                                        data-tag-filter-list=""
                                        data-sot-list="recording-list-tag-filter-list"
                                        hidden={!tagFilterOpen}
                                    >
                                        {tagFilterOptions.map((option) => (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                type="button"
                                                role="option"
                                                data-tag-value={option.value}
                                                aria-selected={
                                                    option.value ===
                                                    selectedTagFilter
                                                }
                                                data-sot-control="recording-list-tag-filter"
                                                data-sot-filter={option.value}
                                                data-sot-state={
                                                    option.value ===
                                                    selectedTagFilter
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
                                                <span data-sot-part="recording-list-tag-filter-option-label">
                                                    {option.label}
                                                </span>
                                                <span data-sot-part="recording-list-tag-filter-option-count">
                                                    {option.count}
                                                </span>
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div data-sot-list="dashboard-recording-list-scroll">
                                {listState === "loading" ? (
                                    <SotRecordingListSkeleton />
                                ) : listState === "ready" ? (
                                    <div data-sot-list="dashboard-recording-rows">
                                        {groupedListEntries.map((group) => (
                                            <div
                                                data-sot-group-id={group.id}
                                                data-sot-group="recording-list"
                                                data-sot-part="dashboard-recording-list-group"
                                                data-sot-mode={listMode}
                                                key={group.id}
                                            >
                                                <div data-sot-part="dashboard-recording-list-group-heading">
                                                    <span data-sot-part="dashboard-recording-list-group-label">
                                                        {group.label}
                                                    </span>
                                                    <span data-sot-part="dashboard-recording-list-group-count">
                                                        {group.entries.length}
                                                    </span>
                                                    <span data-sot-part="dashboard-recording-list-group-divider" />
                                                </div>
                                                {group.entries.map((entry) => {
                                                    const { recording } = entry;
                                                    const active =
                                                        recording.id ===
                                                        selectedRecording?.id;
                                                    const sourceMeta =
                                                        SOURCE_ORDER.find(
                                                            (item) =>
                                                                item.key ===
                                                                recording.sourceProvider,
                                                        );
                                                    const job = liveJobs.get(
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
                                                        recording.tags[0];
                                                    return (
                                                        <button
                                                            aria-current={
                                                                active
                                                                    ? "true"
                                                                    : undefined
                                                            }
                                                            key={recording.id}
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
                                                            <div data-sot-part="dashboard-recording-row-body">
                                                                <div data-sot-part="dashboard-recording-row-title">
                                                                    {
                                                                        recording.filename
                                                                    }
                                                                </div>
                                                                <div data-sot-part="dashboard-recording-row-meta">
                                                                    {sourceMeta?.icon ? (
                                                                        <span
                                                                            data-sot-part="dashboard-recording-source-mark"
                                                                            data-sot-provider-cover={
                                                                                sourceMeta.cover
                                                                                    ? "true"
                                                                                    : "false"
                                                                            }
                                                                            data-sot-variant="image"
                                                                            title={
                                                                                sourceMeta.label
                                                                            }
                                                                        >
                                                                            <img
                                                                                src={
                                                                                    sourceMeta.icon
                                                                                }
                                                                                alt=""
                                                                            />
                                                                        </span>
                                                                    ) : (
                                                                        <span
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
                                                                    <span data-sot-part="dashboard-recording-duration">
                                                                        {formatDuration(
                                                                            recording.duration,
                                                                        )}
                                                                    </span>
                                                                </div>
                                                                <div data-sot-part="dashboard-recording-row-secondary">
                                                                    <span data-sot-part="dashboard-recording-timestamp">
                                                                        <span data-sot-part="dashboard-recording-timestamp-absolute">
                                                                            {formatAbsoluteDate(
                                                                                recording.startTime,
                                                                            )}
                                                                        </span>
                                                                        <span data-sot-part="dashboard-recording-timestamp-relative">
                                                                            {formatRelativeDate(
                                                                                recording.startTime,
                                                                            )}
                                                                        </span>
                                                                    </span>
                                                                    <span
                                                                        data-sot-part="dashboard-recording-status"
                                                                        data-sot-tone={
                                                                            rowStatus.tone
                                                                        }
                                                                    >
                                                                        <span data-sot-part="dashboard-recording-status-dot" />
                                                                        {
                                                                            rowStatus.label
                                                                        }
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            {primaryTag ? (
                                                                <div data-sot-part="dashboard-recording-row-actions">
                                                                    <Badge
                                                                        variant="outline"
                                                                        data-recording-tag-chip=""
                                                                        data-sot-tag-color={
                                                                            primaryTag.color
                                                                        }
                                                                        data-sot-tag-icon={
                                                                            primaryTag.icon
                                                                        }
                                                                    >
                                                                        <RecordingTagIconGlyph
                                                                            icon={
                                                                                primaryTag.icon
                                                                            }
                                                                        />
                                                                        {
                                                                            primaryTag.name
                                                                        }
                                                                    </Badge>
                                                                </div>
                                                            ) : null}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div
                                        data-list-state-block={listState}
                                        data-sot-part="recording-list-state"
                                        data-sot-state={listState}
                                    >
                                        <span data-sot-part="recording-list-state-icon">
                                            <FileText />
                                        </span>
                                        <div data-sot-part="recording-list-state-title">
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
                                        <div data-sot-part="recording-list-state-description">
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
                                                variant="primary"
                                                size="sm"
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
                                        data-list-state-block={
                                            listPaginationState
                                        }
                                        data-sot-panel="recording-list-pagination"
                                        data-sot-state={listPaginationState}
                                    >
                                        <div data-sot-part="recording-list-page-divider">
                                            <span data-sot-part="recording-list-page-status">
                                                {t(listPageStatusKey, {
                                                    current: currentListPage,
                                                    loaded: listLoadedCount,
                                                    total: listEntries.length,
                                                })}
                                            </span>
                                        </div>
                                        <div data-sot-part="recording-list-page-nav">
                                            <Button
                                                variant="ghost"
                                                size="sm"
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
                                            <span data-sot-part="recording-list-page-number">
                                                {currentListPage} /{" "}
                                                {listTotalPages}
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="sm"
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
                        data-sot-panel="dashboard-detail"
                        data-empty={selectedRecording ? "false" : "true"}
                    >
                        <CardHeader
                            data-sot-panel="dashboard-detail-header"
                            data-sot-mode={editingTitle ? "editing" : "normal"}
                            data-sot-state={
                                renaming
                                    ? "saving"
                                    : editingTitle
                                      ? "editing"
                                      : "normal"
                            }
                            data-rename-mode={
                                renaming
                                    ? "saving"
                                    : editingTitle
                                      ? "editing"
                                      : "normal"
                            }
                            data-local-only={
                                localDeleteAvailable ? "true" : "false"
                            }
                        >
                            <CardTitle
                                data-sot-part="detail-header-title"
                                data-rh-title
                                role="heading"
                                aria-level={2}
                            >
                                {selectedRecording?.filename ?? "未选择录音"}
                            </CardTitle>
                            <Badge
                                variant="outline"
                                data-sot-part="detail-header-local-badge"
                                data-rh-local
                                aria-label="仅存在本地副本"
                            >
                                本地副本
                            </Badge>
                            {editingTitle ? (
                                <>
                                    <Input
                                        type="text"
                                        data-rh-input
                                        data-sot-part="detail-header-title-input"
                                        data-sot-state={
                                            renaming ? "saving" : "editing"
                                        }
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
                                    <Badge
                                        variant="ghost"
                                        data-sot-part="detail-header-title-status"
                                        data-sot-state={
                                            renaming ? "saving" : "editing"
                                        }
                                        data-rh-status
                                    >
                                        {renaming ? "正在保存…" : "编辑中"}
                                    </Badge>
                                </>
                            ) : null}
                            <Button
                                variant="ghost"
                                size="icon-sm"
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
                            <div
                                data-rh-ai-anchor
                                data-sot-part="detail-header-action-anchor"
                                data-sot-mode="normal"
                            >
                                <Button
                                    variant="glass"
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
                                    <Sparkles data-icon="inline-start" />
                                    AI 重命名
                                </Button>
                                {aiOpen && selectedRecording ? (
                                    <AiRenamePreview
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
                                        isRegenerating={aiState === "loading"}
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
                            {editingTitle ? (
                                <>
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
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
                            <div
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
                                                data-sot-menu-item="rename"
                                                disabled={!selectedRecording}
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
                                                    <svg
                                                        viewBox="0 0 24 24"
                                                        aria-hidden="true"
                                                        focusable="false"
                                                    >
                                                        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                                                    </svg>
                                                ) : null}
                                                重命名
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                data-sot-menu-item="ai-rename"
                                                disabled={!selectedRecording}
                                                onSelect={() => {
                                                    setMoreOpen(false);
                                                    void previewAutoRename();
                                                }}
                                            >
                                                {moreActionsShowPrimaryIcons ? (
                                                    <svg
                                                        viewBox="0 0 24 24"
                                                        aria-hidden="true"
                                                        focusable="false"
                                                    >
                                                        <path d="m12 3-1.6 4.6L6 9l4.4 1.4L12 15l1.6-4.6L18 9l-4.4-1.4z" />
                                                    </svg>
                                                ) : null}
                                                AI 重命名
                                            </DropdownMenuItem>
                                            {moreActionsShowRetranscribe ? (
                                                <DropdownMenuItem
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
                                                        <svg
                                                            viewBox="0 0 24 24"
                                                            aria-hidden="true"
                                                            focusable="false"
                                                        >
                                                            <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                                                            <path d="M3 3v5h5" />
                                                        </svg>
                                                    ) : null}
                                                    重新转写
                                                </DropdownMenuItem>
                                            ) : null}
                                            {moreActionsShowSeparator ? (
                                                <DropdownMenuSeparator data-sot-menu-separator="delete" />
                                            ) : null}
                                            <DropdownMenuItem
                                                data-sot-menu-item="delete-local"
                                                data-sot-tone="danger"
                                                disabled={!localDeleteAvailable}
                                                aria-disabled={
                                                    !localDeleteAvailable
                                                }
                                                onSelect={() =>
                                                    void deleteRecording()
                                                }
                                            >
                                                {moreActionsShowDeleteIcon ? (
                                                    <svg
                                                        viewBox="0 0 24 24"
                                                        aria-hidden="true"
                                                        focusable="false"
                                                    >
                                                        {moreActionsState ===
                                                        "upstream-deleted" ? (
                                                            <path d="M3 6h18" />
                                                        ) : (
                                                            <>
                                                                <path d="M3 6h18" />
                                                                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                                <path d="M19 6 18 20a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                                            </>
                                                        )}
                                                    </svg>
                                                ) : null}
                                                删除本地副本
                                                {selectedRecording?.sourceProvider ? (
                                                    <span data-sot-menu-hint="">
                                                        {selectedRecording.upstreamDeleted
                                                            ? "上游已删除"
                                                            : "来源持有正本"}
                                                    </span>
                                                ) : null}
                                            </DropdownMenuItem>
                                        </DropdownMenuGroup>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </CardHeader>

                        <Card
                            hasNoPadding
                            data-no-audio={
                                playbackDisabled ? "true" : undefined
                            }
                            data-playing={isPlaying ? "true" : undefined}
                            data-sot-state={
                                playbackDisabled ? "disabled" : "ready"
                            }
                            data-sot-surface="dashboard-recording-player"
                        >
                            <Alert
                                data-sot-part="dashboard-recording-player-no-audio"
                                data-sot-state={
                                    playbackDisabled ? "visible" : "hidden"
                                }
                                hidden={!playbackDisabled}
                                role="status"
                            >
                                <span
                                    data-icon="inline-start"
                                    data-sot-part="dashboard-recording-player-no-audio-icon"
                                >
                                    <SotPlayerNoAudioIcon />
                                </span>
                                <AlertTitle data-sot-part="dashboard-recording-player-no-audio-title">
                                    来源仅同步转写与报告
                                </AlertTitle>
                                <AlertDescription data-sot-part="dashboard-recording-player-no-audio-description">
                                    这条录音没有本地音频，无法播放或运行私有重转写。
                                </AlertDescription>
                            </Alert>
                            <CardHeader data-sot-part="dashboard-recording-player-meta">
                                <span
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
                                    />
                                ) : null}
                            </CardHeader>
                            <CardContent
                                aria-disabled={
                                    playbackDisabled ? "true" : undefined
                                }
                                data-sot-panel="dashboard-recording-player-controls"
                                data-sot-state={playerControlsState}
                            >
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="rounded-full"
                                    type="button"
                                    aria-label="后退 5 秒"
                                    data-sot-control="dashboard-player-back"
                                    data-sot-state={playerControlState}
                                    disabled={playbackDisabled}
                                    onClick={() =>
                                        seekDashboardPlayerBySeconds(-5)
                                    }
                                >
                                    <span
                                        data-icon="inline-start"
                                        data-sot-part="dashboard-player-control-icon"
                                    >
                                        <SotPlayerBackIcon />
                                    </span>
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon-lg"
                                    className="rounded-full"
                                    type="button"
                                    aria-label={isPlaying ? "暂停" : "播放"}
                                    data-playing={isPlaying ? "true" : "false"}
                                    data-sot-control="dashboard-player-play"
                                    data-sot-state={
                                        playbackDisabled
                                            ? "disabled"
                                            : isPlaying
                                              ? "playing"
                                              : "paused"
                                    }
                                    disabled={playbackDisabled}
                                    onClick={togglePlayPause}
                                >
                                    <span
                                        data-icon="inline-start"
                                        data-sot-part="dashboard-player-control-icon"
                                    >
                                        {isPlaying ? (
                                            <SotPlayerPauseIcon />
                                        ) : (
                                            <SotPlayerPlayIcon />
                                        )}
                                    </span>
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="rounded-full"
                                    type="button"
                                    aria-label="前进 5 秒"
                                    data-sot-control="dashboard-player-forward"
                                    data-sot-state={playerControlState}
                                    disabled={playbackDisabled}
                                    onClick={() =>
                                        seekDashboardPlayerBySeconds(5)
                                    }
                                >
                                    <span
                                        data-icon="inline-start"
                                        data-sot-part="dashboard-player-control-icon"
                                    >
                                        <SotPlayerForwardIcon />
                                    </span>
                                </Button>
                                <span data-sot-part="dashboard-player-current-time">
                                    {formatSotPlayerTime(currentTime)}
                                </span>
                                <span
                                    data-sot-part="dashboard-player-seek-shell"
                                    style={
                                        {
                                            "--dashboard-player-progress": `${playerProgressPct}%`,
                                        } as CSSProperties
                                    }
                                >
                                    <Slider
                                        aria-disabled={
                                            playbackDisabled
                                                ? "true"
                                                : undefined
                                        }
                                        aria-label="播放进度"
                                        data-sot-control="dashboard-player-seek"
                                        data-sot-state={playerControlState}
                                        data-pct={playerProgressPct}
                                        disabled={playbackDisabled}
                                        max={100}
                                        min={0}
                                        step={1}
                                        value={[progress]}
                                        onValueChange={(values) =>
                                            seekDashboardPlayerToPercent(
                                                values[0] ?? 0,
                                            )
                                        }
                                    />
                                    <span data-sot-part="dashboard-player-seek-thumb" />
                                </span>
                                <span data-sot-part="dashboard-player-duration">
                                    {formatSotPlayerTime(playerDurationValue)}
                                </span>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="min-w-12 font-mono tabular-nums"
                                    disabled={playbackDisabled}
                                    aria-label="切换播放倍速"
                                    data-sot-control="dashboard-player-speed"
                                    data-sot-state={playerControlState}
                                    onClick={cyclePlaybackSpeed}
                                >
                                    {playbackSpeedLabel}
                                </Button>
                                <div data-sot-part="dashboard-player-volume-anchor">
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        className="rounded-full"
                                        type="button"
                                        aria-label={`音量 ${volume}`}
                                        aria-expanded={volumePopoverOpen}
                                        title={`音量 ${volume}`}
                                        data-level={sotPlayerVolumeLevel(
                                            volume,
                                        )}
                                        data-sot-control="dashboard-player-volume"
                                        data-sot-state={
                                            playbackDisabled
                                                ? "disabled"
                                                : volumePopoverOpen
                                                  ? "open"
                                                  : "closed"
                                        }
                                        data-sot-volume-state={
                                            volumeMuted ? "muted" : "audible"
                                        }
                                        disabled={playbackDisabled}
                                        onClick={() =>
                                            setVolumeOpen((open) => !open)
                                        }
                                    >
                                        <span
                                            data-icon="inline-start"
                                            data-sot-part="dashboard-player-control-icon"
                                        >
                                            <SotPlayerVolumeIcon
                                                volume={volume}
                                            />
                                        </span>
                                    </Button>
                                    <Card
                                        hasNoPadding
                                        data-open={
                                            volumePopoverOpen ? "true" : "false"
                                        }
                                        data-sot-panel="dashboard-player-volume-popover"
                                        data-sot-state={
                                            volumePopoverOpen
                                                ? "open"
                                                : "closed"
                                        }
                                        hidden={!volumePopoverOpen}
                                        aria-hidden={
                                            volumePopoverOpen
                                                ? undefined
                                                : "true"
                                        }
                                        role="dialog"
                                        aria-label="音量"
                                    >
                                        <div data-sot-part="dashboard-player-volume-row">
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                type="button"
                                                aria-label="静音切换"
                                                data-sot-control="dashboard-player-volume-mute"
                                                data-sot-state={
                                                    volumeMuted
                                                        ? "muted"
                                                        : "audible"
                                                }
                                                disabled={playbackDisabled}
                                                onClick={() =>
                                                    setVolume(
                                                        volumeMuted ? 70 : 0,
                                                    )
                                                }
                                            >
                                                <span
                                                    data-icon="inline-start"
                                                    data-sot-part="dashboard-player-volume-icon"
                                                >
                                                    <SotPlayerVolumeIcon
                                                        volume={volume}
                                                    />
                                                </span>
                                            </Button>
                                            <Slider
                                                min={0}
                                                max={100}
                                                step={1}
                                                value={[volume]}
                                                disabled={playbackDisabled}
                                                data-sot-control="dashboard-player-volume-slider"
                                                data-sot-state={
                                                    playerControlState
                                                }
                                                aria-label="音量"
                                                onValueChange={(nextValue) =>
                                                    setVolume(
                                                        nextValue[0] ?? volume,
                                                    )
                                                }
                                            />
                                            <span data-sot-part="dashboard-player-volume-value">
                                                {volume}
                                            </span>
                                        </div>
                                    </Card>
                                </div>
                            </CardContent>
                            {audioSrc ? (
                                <audio ref={audioRef} src={audioSrc}>
                                    <track kind="captions" />
                                </audio>
                            ) : null}
                        </Card>

                        <Card
                            hasNoPadding
                            data-sot-panel="dashboard-transcript-shell"
                        >
                            <CardHeader data-sot-part="dashboard-transcript-header">
                                <SegmentedTabs
                                    aria-label="详情标签"
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
                                <div data-sot-part="dashboard-transcript-actions">
                                    <Button
                                        variant="ghost"
                                        size="sm"
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
                                        <span data-sot-part="dashboard-copy-label">
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
                                        size="sm"
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
                                        <span data-sot-part="dashboard-copy-label">
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
                                        size="sm"
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
                                        <span data-sot-part="dashboard-copy-label">
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
                                            variant="ghost"
                                            size="sm"
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
                                            <CloudDownload />
                                            {sourceReportState === "loading"
                                                ? t(
                                                      "sourceReport.loadingDetail",
                                                  )
                                                : t("sourceReport.refresh")}
                                        </Button>
                                    ) : null}
                                    <span
                                        data-sot-part="dashboard-retranscription-disabled-hint"
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
                            <CardContent data-sot-part="dashboard-transcript-body">
                                <div
                                    data-sot-panel="dashboard-retranscription"
                                    data-sot-state={dashboardRetxState}
                                    data-retx-state={dashboardRetxState}
                                    hidden={
                                        dashboardRetxState === "idle" ||
                                        dashboardRetxState === "unavailable"
                                    }
                                >
                                    <span
                                        data-sot-part="dashboard-retranscription-icon"
                                        aria-hidden="true"
                                    >
                                        {dashboardRetxState === "queued" ||
                                        dashboardRetxState === "running" ? (
                                            <span data-sot-part="dashboard-retranscription-spinner" />
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
                                    <div data-sot-part="dashboard-retranscription-body">
                                        <div data-sot-part="dashboard-retranscription-title">
                                            {dashboardRetxTitle}
                                        </div>
                                        <div data-sot-part="dashboard-retranscription-sub">
                                            {dashboardRetxSub}
                                        </div>
                                    </div>
                                    {dashboardRetxState === "failed" ? (
                                        <div data-sot-part="dashboard-retranscription-actions">
                                            <Button
                                                variant="ghost"
                                                size="sm"
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
                                        <div data-sot-part="dashboard-retranscription-actions">
                                            <Button
                                                variant="ghost"
                                                size="sm"
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
                                    hidden={dashboardRetxState !== "completed"}
                                >
                                    刚刷新 · 1 秒前
                                </p>
                                <div
                                    data-sot-panel="dashboard-transcript-pane"
                                    data-sot-tab-pane="transcript"
                                    data-tab-pane="transcript"
                                    hidden={detailTab !== "transcript"}
                                >
                                    {isTranscriptLoading ? (
                                        TRANSCRIPT_LOADING_SKELETON_ROWS.map(
                                            (item) => (
                                                <div
                                                    data-sot-item="dashboard-transcript-turn"
                                                    data-sot-state="loading"
                                                    key={`transcript-skeleton:${item.key}`}
                                                >
                                                    <div
                                                        data-sot-part="dashboard-transcript-speaker-row"
                                                        data-sot-state="loading"
                                                    >
                                                        <Skeleton
                                                            aria-hidden="true"
                                                            data-sot-part="dashboard-transcript-skeleton"
                                                            data-sot-size="avatar"
                                                        />
                                                        <Skeleton
                                                            aria-hidden="true"
                                                            data-sot-part="dashboard-transcript-skeleton"
                                                            data-sot-size={
                                                                item.speaker
                                                            }
                                                        />
                                                        <Skeleton
                                                            aria-hidden="true"
                                                            data-sot-part="dashboard-transcript-skeleton"
                                                            data-sot-size="time"
                                                        />
                                                    </div>
                                                    <Skeleton
                                                        aria-hidden="true"
                                                        data-sot-part="dashboard-transcript-skeleton"
                                                        data-sot-size={
                                                            item.firstLine
                                                        }
                                                    />
                                                    <Skeleton
                                                        aria-hidden="true"
                                                        data-sot-part="dashboard-transcript-skeleton"
                                                        data-sot-size={
                                                            item.secondLine
                                                        }
                                                    />
                                                    {item.thirdLine ? (
                                                        <Skeleton
                                                            aria-hidden="true"
                                                            data-sot-part="dashboard-transcript-skeleton"
                                                            data-sot-size={
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
                                                    data-sot-item="dashboard-transcript-turn"
                                                    data-sot-state="ready"
                                                    key={`${selectedRecording?.id}:${index}`}
                                                >
                                                    <div
                                                        data-sot-part="dashboard-transcript-speaker-row"
                                                        data-sot-state="ready"
                                                    >
                                                        <span
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
                                                        <span data-sot-part="dashboard-transcript-speaker-name">
                                                            {speakerName}
                                                        </span>
                                                        <span
                                                            data-sot-format="mono"
                                                            data-sot-part="dashboard-transcript-speaker-time"
                                                        >
                                                            {timeLabel ?? "--"}
                                                        </span>
                                                    </div>
                                                    <p>{turn.text}</p>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div data-sot-panel="dashboard-transcript-empty">
                                            <div
                                                aria-hidden="true"
                                                data-sot-part="dashboard-transcript-empty-icon"
                                            >
                                                <SotTranscriptEmptyIcon />
                                            </div>
                                            <p data-sot-part="dashboard-transcript-empty-message">
                                                还没有逐字稿
                                            </p>
                                            <p data-sot-part="dashboard-transcript-empty-sub">
                                                来源已就绪，转写任务还在排队中。
                                            </p>
                                        </div>
                                    )}
                                </div>
                                <div
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
                                                    data-sot-source-report-segment
                                                    data-sot-state="skeleton"
                                                >
                                                    <SotSourceReportSegmentSkeleton size="time" />
                                                    <SotSourceReportSegmentSkeleton size="speaker" />
                                                    <SotSourceReportSegmentSkeleton size="line-long" />
                                                    <SotSourceReportSegmentSkeleton size="line-medium" />
                                                </div>
                                                <div
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
                                                data-sot-source-report-empty
                                                data-sot-tone="err"
                                            >
                                                <div
                                                    data-sot-source-report-empty-icon
                                                    aria-hidden="true"
                                                >
                                                    <SotSourceReportErrorIcon />
                                                </div>
                                                <AlertTitle
                                                    data-sot-source-report-empty-title
                                                >
                                                    无法读取来源详情
                                                </AlertTitle>
                                                <AlertDescription
                                                    data-sot-source-report-empty-description
                                                >
                                                    {
                                                        sourceReportProviderSentenceName
                                                    }
                                                    返回了一个错误，可能是网络抖动或来源临时不可用。
                                                </AlertDescription>
                                                <div
                                                    data-sot-source-report-empty-actions
                                                >
                                                    <Button
                                                        variant="primary"
                                                        size="sm"
                                                        type="button"
                                                        onClick={() =>
                                                            void loadSourceReport()
                                                        }
                                                    >
                                                        重试
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        type="button"
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
                                                <Badge
                                                    variant="outline"
                                                    data-sot-badge="source-report-status"
                                                    data-sot-tone="warn"
                                                >
                                                    <span className="dot" />
                                                    {t(
                                                        "sourceReport.sourceOnlyNoAudio",
                                                    )}
                                                </Badge>
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
                                                            src={
                                                                sourceReportProviderDefinition.icon
                                                            }
                                                            alt=""
                                                        />
                                                    ) : (
                                                        <span data-sot-part="source-report-card-source-fallback">
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
                                                        <span className="dot" />
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
                                                        <span className="dot" />
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
                                                    data-sot-source-report-segments
                                                >
                                                    {sourceReportDisplaySegments.map(
                                                        (segment, index) => (
                                                            <li
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
                                                                    className="mono"
                                                                    data-sot-source-report-segment-time
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
                                                                    data-sot-source-report-segment-speaker
                                                                >
                                                                    {segment.speaker ||
                                                                        `说话人 ${index + 1}`}
                                                                </span>
                                                                <p
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

                                            {sourceSummaryVisible ? (
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
                                                        data-sot-source-report-summary-body
                                                    >
                                                        {sourceSummaryRenderedText
                                                            .split("\n")
                                                            .map(
                                                                (
                                                                    line,
                                                                    index,
                                                                ) => (
                                                                    <p
                                                                        key={`${index}:${line}`}
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
                                                <dl data-sot-source-report-meta>
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
                                                            <span className="dot" />
                                                            {
                                                                sourceReportSyncStatusLabel
                                                            }
                                                        </SotSourceReportStatusBadge>
                                                    </SotSourceReportMetaRow>
                                                    <SotSourceReportMetaRow label="录制于">
                                                        <span className="mono">
                                                            {formatSourceReportDate(
                                                                sourceReportRecordedAt,
                                                            )}
                                                        </span>
                                                    </SotSourceReportMetaRow>
                                                    <SotSourceReportMetaRow label="最近更新">
                                                        <span className="mono">
                                                            {formatSourceReportDate(
                                                                sourceReportUpdatedAt,
                                                            )}
                                                        </span>
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
                                                    <SotSourceReportMetaRow label="时长">
                                                        <span className="mono">
                                                            {selectedRecording
                                                                ? formatDuration(
                                                                      selectedRecording.duration,
                                                                  )
                                                                : "--"}
                                                        </span>
                                                    </SotSourceReportMetaRow>
                                                </dl>
                                                <div
                                                    data-sot-source-report-actions
                                                    data-sot-panel="source-actions"
                                                >
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
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
                                                        size="sm"
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
                                                data-sot-source-report-empty
                                                data-sot-tone="neutral"
                                            >
                                                <div
                                                    data-sot-source-report-empty-icon
                                                    aria-hidden="true"
                                                >
                                                    <SotSourceReportEmptyIcon />
                                                </div>
                                                <div
                                                    data-sot-source-report-empty-title
                                                >
                                                    这条录音没有关联来源
                                                </div>
                                                <div
                                                    data-sot-source-report-empty-description
                                                >
                                                    本地导入或离线录制的录音不会有来源详情。
                                                </div>
                                            </Card>
                                        </SotSourceReportState>
                                    )}
                                </div>
                                <div
                                    data-sot-panel="dashboard-speakers-pane"
                                    data-sot-tab-pane="speakers"
                                    data-tab-pane="speakers"
                                    hidden={detailTab !== "speakers"}
                                >
                                    <div data-sot-part="dashboard-speakers-head">
                                        <div data-sot-part="dashboard-speakers-head-title">
                                            {turns.length || 0} 段说话人
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            type="button"
                                            data-sot-control="dashboard-speakers-merge"
                                        >
                                            合并相似…
                                        </Button>
                                    </div>
                                    <ul data-sot-list="dashboard-speaker-rows">
                                        {(turns.length
                                            ? turns
                                            : [
                                                  {
                                                      text: "转写完成后可查看说话人信息",
                                                      speakerName: null,
                                                  },
                                              ]
                                        ).map((turn, index) => {
                                            const speakerBarPct = Math.min(
                                                100,
                                                24 + index * 12,
                                            );

                                            return (
                                                <li
                                                    data-sot-item="dashboard-speaker-row"
                                                    key={`${selectedRecording?.id}:speaker:${index}`}
                                                >
                                                    <span data-sot-part="dashboard-speaker-avatar">
                                                        {index + 1}
                                                    </span>
                                                    <div data-sot-part="dashboard-speaker-row-meta">
                                                        <div data-sot-part="dashboard-speaker-name">
                                                            {turn.speakerName ||
                                                                `说话人 ${index + 1}`}
                                                        </div>
                                                        <div data-sot-part="dashboard-speaker-sub">
                                                            {turn.text.length}{" "}
                                                            字
                                                        </div>
                                                    </div>
                                                    <span
                                                        data-sot-part="dashboard-speaker-bar"
                                                        style={
                                                            {
                                                                "--dashboard-speaker-share": `${speakerBarPct}%`,
                                                            } as CSSProperties
                                                        }
                                                    >
                                                        <span data-sot-part="dashboard-speaker-bar-fill" />
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
