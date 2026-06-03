import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Footer } from "@/components/footer";
import { Logo } from "@/components/icons/logo";
import { LanguageProvider } from "@/components/language-provider";
import { Panel } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { Sidebar } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { LibrarySearch } from "@/features/dashboard/components/library-search";
import { RecordingList } from "@/features/dashboard/components/recording-list";
import { SourceProviderRows } from "@/features/dashboard/components/source-provider-rows";
import { SyncStatus } from "@/features/dashboard/components/sync-status";
import { TranscriptionPanel } from "@/features/dashboard/components/transcription-panel";
import { Workstation } from "@/features/dashboard/workstation";
import { DataSourceFieldControl } from "@/features/data-sources/data-source-field-control";
import { RecordingPlayer } from "@/features/recordings/components/recording-player";
import { RecordingTagManager } from "@/features/recordings/components/recording-tag-manager";
import {
    RecordingTagChip,
    RecordingTagIconGlyph,
} from "@/features/recordings/components/recording-tag-visuals";
import { SourceReportPanel } from "@/features/recordings/components/source-report-panel";
import { SpeakerLabelEditor } from "@/features/recordings/components/speaker-label-editor";
import { TranscriptionSection } from "@/features/recordings/components/transcription-section";
import {
    SpeakerReviewSkeleton,
    TranscriptReviewSkeleton,
} from "@/features/recordings/components/transcription-skeletons";
import { RecordingWorkstation } from "@/features/recordings/workstation";
import { SettingsContent } from "@/features/settings/components/settings-content";
import { SettingsDialog } from "@/features/settings/components/settings-dialog";
import { SettingsPageContent } from "@/features/settings/components/settings-page-content";
import {
    SettingsCardSkeleton,
    SettingsSectionSkeleton,
} from "@/features/settings/components/settings-skeletons";
import type { RecordingTag } from "@/lib/recording-tags";
import type { Recording } from "@/types/recording";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSource(relativePath: string) {
    return readFileSync(path.join(ROOT, relativePath), "utf8");
}

vi.mock("next/navigation", () => ({
    useRouter: () => ({
        back: vi.fn(),
        push: vi.fn(),
        refresh: vi.fn(),
        replace: vi.fn(),
    }),
}));

const tag: RecordingTag = {
    id: "tag-1",
    name: "Review",
    color: "blue",
    icon: "briefcase",
};

const recording: Recording = {
    id: "rec-1",
    filename: "Weekly sync",
    duration: 125_000,
    startTime: "2026-05-01T10:00:00.000Z",
    filesize: 1_024_000,
    providerDeviceId: "device-1",
    upstreamDeleted: false,
    sourceProvider: "ticnote",
    sourceRecordingId: "remote-1",
    audioUrl: "/api/recordings/rec-1/audio",
    hasAudio: true,
    tags: [tag],
};

const transcript = {
    text: "SPEAKER_01: hello\nSPEAKER_02: shipped",
    language: "en",
    speakerMap: { SPEAKER_01: "Maple", SPEAKER_02: "Team" },
    segments: [
        {
            id: 1,
            start: 0,
            end: 5,
            text: "hello",
            speakerLabel: "SPEAKER_01",
            speakerName: null,
            displaySpeaker: null,
        },
        {
            id: 2,
            start: 5,
            end: 12,
            text: "shipped",
            speakerLabel: "SPEAKER_02",
            speakerName: null,
            displaySpeaker: null,
        },
    ],
};

function render(element: React.ReactElement) {
    return renderToStaticMarkup(
        React.createElement(
            LanguageProvider,
            null,
            React.createElement(ConfirmDialogProvider, null, element),
        ),
    );
}

describe("React surface SSR coverage", () => {
    it("renders the shared Sidebar primitive with neutral border classes", () => {
        const sidebarSource = readSource("components/ui/sidebar.tsx");

        expect(sidebarSource).not.toContain("border-white/8");
        expect(sidebarSource).toContain("border-border/65");

        const html = render(
            React.createElement(Sidebar, { className: "sidebar-override" }),
        );

        expect(html).toContain("glass-surface");
        expect(html).toContain("border-r");
        expect(html).toContain("border-border/65");
        expect(html).toContain("sidebar-override");
        expect(html).not.toContain("border-white/8");
    });

    it("renders shared shell and primitive UI components", () => {
        const html = render(
            React.createElement(
                "main",
                null,
                React.createElement(Footer),
                React.createElement(Logo),
                React.createElement(Panel, { variant: "glass" }, "Panel"),
                React.createElement(
                    Card,
                    null,
                    React.createElement(
                        CardHeader,
                        null,
                        React.createElement(CardTitle, null, "Card"),
                    ),
                    React.createElement(CardContent, null, "Body"),
                ),
                React.createElement(Button, { variant: "outline" }, "Save"),
                React.createElement(Button, null, "Sync"),
                React.createElement(Input, { defaultValue: "input" }),
                React.createElement(Label, null, "Label"),
                React.createElement(Textarea, { defaultValue: "note" }),
                React.createElement(Switch, { checked: true }),
                React.createElement(Skeleton, { className: "h-4 w-4" }),
                React.createElement(SegmentedTabs, {
                    items: [
                        { value: "one", label: "One" },
                        { value: "two", label: "Two" },
                    ],
                    value: "one",
                    onValueChange: vi.fn(),
                }),
                React.createElement(SettingsCardSkeleton, { fields: 2 }),
                React.createElement(SettingsSectionSkeleton, {
                    cards: 2,
                    fieldsPerCard: 2,
                }),
            ),
        );

        expect(html).toContain("BetterAINote");
        expect(html).toContain("Sync");
        expect(html).toContain("Card");
    });

    it("renders settings sections and dialogs", () => {
        const sections = [
            "appearance",
            "data-sources",
            "misc",
            "title-generation",
            "transcription",
            "voscript",
        ] as const;

        const html = render(
            React.createElement(
                "section",
                null,
                React.createElement(SettingsDialog, {
                    open: true,
                    onOpenChange: vi.fn(),
                }),
                React.createElement(SettingsPageContent),
                sections.map((section) =>
                    React.createElement(SettingsContent, {
                        key: section,
                        activeSection: section,
                    }),
                ),
            ),
        );

        expect(html).toContain("数据源");
        expect(html).toContain("设置");
    });

    it("renders dashboard and recording workstations with transcript data", () => {
        const transcriptions = new Map([[recording.id, transcript]]);
        const jobs = new Map([
            [recording.id, { status: "succeeded", remoteStatus: null }],
        ]);
        const html = render(
            React.createElement(
                "section",
                null,
                React.createElement(Workstation, {
                    recordings: [recording],
                    transcriptions,
                    transcriptionJobs: jobs,
                }),
                React.createElement(RecordingWorkstation, {
                    recording,
                    transcription: transcript,
                    transcriptionJob: {
                        status: "succeeded",
                        remoteStatus: null,
                        lastError: null,
                    },
                }),
            ),
        );

        expect(html).toContain("Weekly sync");
        expect(html).toContain("TicNote");
    });

    it("renders dashboard and recording panels in their primary states", () => {
        const html = render(
            React.createElement(
                "section",
                null,
                React.createElement(RecordingList, {
                    recordings: [recording],
                    totalCount: 1,
                    currentRecording: recording,
                    transcriptionJobs: new Map(),
                    onSelect: vi.fn(),
                }),
                React.createElement(LibrarySearch, {
                    open: false,
                    onApplyLibraryFilter: vi.fn(),
                    onOpenChange: vi.fn(),
                    onOpenRecording: vi.fn(),
                }),
                React.createElement(SourceProviderRows, {
                    rows: [
                        {
                            provider: "ticnote",
                            label: "TicNote",
                            count: 1,
                            active: true,
                            connected: true,
                            updating: false,
                            status: "connected",
                        },
                    ],
                    activeProvider: "ticnote",
                    language: "en",
                    onSelectProvider: vi.fn(),
                    onConnectProvider: vi.fn(),
                    onClearProvider: vi.fn(),
                }),
                React.createElement(TranscriptionPanel, {
                    recording,
                    transcription: transcript,
                    transcriptionJob: null,
                    onTranscribe: vi.fn(),
                    onRetranscribe: vi.fn(),
                }),
                React.createElement(RecordingPlayer, {
                    recording,
                    tags: [tag],
                    onToggleTagManager: vi.fn(),
                    tagManagerPanel: React.createElement("div", null, "Tags"),
                }),
                React.createElement(RecordingTagManager, {
                    recording,
                    availableTags: [tag],
                    onAvailableTagsChange: vi.fn(),
                    onRecordingTagsChange: vi.fn(),
                }),
                React.createElement(TranscriptionSection, {
                    recordingId: recording.id,
                    initialTranscription: transcript.text,
                    initialLanguage: "en",
                    initialSpeakerMap: transcript.speakerMap,
                    canTranscribe: true,
                }),
                React.createElement(SourceReportPanel, {
                    recordingId: recording.id,
                    sourceProvider: "ticnote",
                    autoLoad: false,
                }),
                React.createElement(SpeakerLabelEditor, {
                    recordingId: recording.id,
                }),
                React.createElement(SpeakerReviewSkeleton),
                React.createElement(TranscriptReviewSkeleton),
            ),
        );

        expect(html).toContain("Weekly sync");
        expect(html).toContain("TicNote");
    });

    it("renders data-source field controls and recording tag visuals", () => {
        const html = render(
            React.createElement(
                "section",
                null,
                React.createElement(DataSourceFieldControl, {
                    field: {
                        id: "authorization",
                        key: "Authorization",
                        label: "Authorization",
                        description: "Paste Authorization",
                        placeholder: "Bearer ...",
                        value: "",
                        target: "secret",
                        kind: "textarea",
                    },
                    fieldId: "field-authorization",
                    onValueChange: vi.fn(),
                }),
                React.createElement(RecordingTagIconGlyph, {
                    icon: "briefcase",
                }),
                React.createElement(RecordingTagChip, { tag }),
            ),
        );

        expect(html).toContain("Authorization");
        expect(html).toContain("Review");
    });

    it("renders sync status variants", () => {
        const html = render(
            React.createElement(
                "section",
                null,
                React.createElement(SyncStatus, {
                    autoSyncEnabled: true,
                    isAutoSyncing: false,
                    lastSyncTime: new Date("2026-05-01T10:00:00.000Z"),
                    nextSyncTime: new Date("2026-05-01T10:05:00.000Z"),
                    lastSyncResult: {
                        success: true,
                        queued: false,
                        newRecordings: 2,
                    },
                    workerStatus: {
                        healthy: true,
                        isRunning: false,
                        lastHeartbeatAt: new Date("2026-05-01T10:00:00.000Z"),
                        lastStartedAt: new Date("2026-05-01T09:59:00.000Z"),
                        lastFinishedAt: new Date("2026-05-01T10:00:00.000Z"),
                        nextRunAt: new Date("2026-05-01T10:05:00.000Z"),
                        manualTriggerRequestedAt: null,
                        lastError: null,
                        lastSummary: {
                            newRecordings: 2,
                            updatedRecordings: 1,
                            removedRecordings: 0,
                            errorCount: 0,
                        },
                    },
                }),
            ),
        );

        expect(html).toContain("2");
    });
});
