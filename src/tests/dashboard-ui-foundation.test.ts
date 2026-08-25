import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import DashboardLoading from "@/app/(app)/dashboard/loading";
import { LanguageProvider } from "@/components/language-provider";
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";
import {
    type DashboardFilterState,
    reduceDashboardFilterState,
} from "@/features/dashboard/filter-state";
import { Workstation } from "@/features/dashboard/workstation";
import type { RecordingTag } from "@/lib/recording-tags";
import type { Recording } from "@/types/recording";

vi.mock("@/lib/platform/browser-router", () => ({
    useBrowserRouteController: () => ({
        refresh: vi.fn(),
    }),
}));

vi.mock("@/features/settings/display-settings-store", () => ({
    useDisplaySettingsStore: () => ({
        hasLoaded: true,
        settings: {
            uiLanguage: "zh-CN",
            dateTimeFormat: "relative",
            recordingListSortOrder: "newest",
            itemsPerPage: 50,
            displayDensity: "comfy",
            theme: "dark",
        },
    }),
}));

const tag: RecordingTag = {
    id: "tag-1",
    name: "Review",
    color: "blue",
    icon: "grid",
};

const recording: Recording = {
    id: "recording-1",
    filename: "Runtime weekly sync",
    duration: 125_000,
    startTime: "2026-07-31T10:00:00.000Z",
    filesize: 1_024_000,
    providerDeviceId: "device-1",
    upstreamDeleted: false,
    sourceProvider: "ticnote",
    sourceRecordingId: "remote-1",
    audioUrl: "/api/recordings/recording-1/audio",
    hasAudio: true,
    tags: [tag],
};

const transcript = {
    text: "SPEAKER_01: Runtime transcript\nSPEAKER_02: Ready for review",
    language: "en",
    speakerMap: {
        SPEAKER_01: "Maple",
        SPEAKER_02: "Team",
    },
    segments: [
        {
            id: 1,
            start: 0,
            end: 5,
            text: "Runtime transcript",
            speakerLabel: "SPEAKER_01",
            speakerName: "Maple",
            displaySpeaker: "Maple",
        },
    ],
};

function openingTagWith(markup: string, marker: string) {
    const markerIndex = markup.indexOf(marker);
    expect(markerIndex).toBeGreaterThanOrEqual(0);
    const openingTagStart = markup.lastIndexOf("<", markerIndex);
    const openingTagEnd = markup.indexOf(">", markerIndex);
    expect(openingTagStart).toBeGreaterThanOrEqual(0);
    expect(openingTagEnd).toBeGreaterThan(markerIndex);
    return markup.slice(openingTagStart, openingTagEnd + 1);
}

function renderDashboard(
    recordings: Recording[] = [],
    transcriptions = new Map(),
    transcriptionJobs = new Map(),
) {
    return renderToStaticMarkup(
        React.createElement(
            LanguageProvider,
            null,
            React.createElement(
                ConfirmDialogProvider,
                null,
                React.createElement(Workstation, {
                    recordings,
                    transcriptions,
                    transcriptionJobs,
                    pagination: {
                        page: 1,
                        pageSize: 50,
                        total: recordings.length,
                    },
                    user: {
                        name: "Runtime Test",
                        email: "runtime@example.test",
                    },
                }),
            ),
        ),
    );
}

describe("dashboard runtime foundation", () => {
    it("renders the dashboard shell with its accessible navigation and workspace", () => {
        const markup = renderDashboard();
        const workstation = openingTagWith(
            markup,
            'data-surface="dashboard-workstation"',
        );

        expect(workstation).toContain('data-state="loading"');
        expect(workstation).toContain('data-source-filter-active="false"');
        expect(markup).toContain('data-panel="dashboard-sidebar"');
        expect(markup).toContain('data-list="dashboard-nav"');
        expect(markup).toContain('aria-label="录音筛选"');
        expect(markup).toContain('data-panel="dashboard-main"');
        expect(markup).toContain('data-panel="dashboard-workspace"');
        expect(markup).toContain('aria-label="打开设置"');
    });

    it("renders BetterAINote identity and the selected all-recordings filter", () => {
        const markup = renderDashboard();
        const allRecordingsFilter = openingTagWith(
            markup,
            'data-favorite="all"',
        );

        expect(markup).toContain('data-part="dashboard-brand"');
        expect(markup).toContain('src="/assets/logo-mark-steel.svg"');
        expect(markup).toContain("BetterAINote");
        expect(markup).toContain("私人工作空间");
        expect(allRecordingsFilter).toContain('aria-pressed="true"');
        expect(allRecordingsFilter).toContain('data-state="selected"');
    });

    it("renders the dashboard loading route as a busy live region", () => {
        const markup = renderToStaticMarkup(
            React.createElement(DashboardLoading),
        );
        const loadingRegion = openingTagWith(
            markup,
            'aria-label="正在加载仪表盘"',
        );

        expect(loadingRegion).toContain("<section");
        expect(loadingRegion).toContain('aria-busy="true"');
        expect(loadingRegion).toContain('aria-live="polite"');
        expect(markup).toContain("<aside");
        expect(markup).toContain("<main");
        expect(markup).toContain("<header");
        expect(markup).toContain('aria-hidden="true"');
        expect(
            (markup.match(/data-slot="skeleton"/g) ?? []).length,
        ).toBeGreaterThan(8);
    });

    it("renders actionable recording-list and detail empty states", () => {
        const markup = renderDashboard();
        const listEmptyState = openingTagWith(
            markup,
            'data-list-state-block="empty"',
        );
        const detailPanel = openingTagWith(
            markup,
            'data-panel="dashboard-detail"',
        );
        const dataSourcesAction = openingTagWith(
            markup,
            'data-control="recording-list-open-data-sources"',
        );

        expect(listEmptyState).toContain('data-state="empty"');
        expect(markup).toContain('data-part="recording-list-state-title"');
        expect(markup).toContain(
            'data-part="recording-list-state-description"',
        );
        expect(dataSourcesAction).toContain('type="button"');
        expect(detailPanel).toContain('data-empty="true"');
        expect(markup).toContain('data-panel="dashboard-detail-empty"');
    });

    it("renders a selected recording with its detail heading and audio controls", () => {
        const markup = renderDashboard([recording]);
        const recordingRow = openingTagWith(
            markup,
            'data-recording-id="recording-1"',
        );
        const detailHeading = openingTagWith(
            markup,
            'data-part="detail-header-title"',
        );
        const player = openingTagWith(
            markup,
            'data-surface="dashboard-recording-player"',
        );

        expect(recordingRow).toContain('aria-current="true"');
        expect(recordingRow).toContain('data-state="selected"');
        expect(markup).toContain("Runtime weekly sync");
        expect(detailHeading).toContain('role="heading"');
        expect(detailHeading).toContain('aria-level="2"');
        expect(player).toContain('data-state="ready"');
        expect(player).not.toContain('data-no-audio="true"');
        expect(markup).toContain('src="/api/recordings/recording-1/audio"');
        expect(markup).toContain('aria-label="播放"');
        expect(markup).toContain('data-control="dashboard-player-seek"');
        expect(markup).toContain('data-control="dashboard-player-speed"');
    });

    it("renders transcript content, speaker mapping, tabs, and copy behavior", () => {
        const transcriptions = new Map([[recording.id, transcript]]);
        const transcriptionJobs = new Map([
            [
                recording.id,
                {
                    status: "succeeded",
                    remoteStatus: null,
                    lastError: null,
                },
            ],
        ]);
        const markup = renderDashboard(
            [recording],
            transcriptions,
            transcriptionJobs,
        );
        const transcriptRegion = openingTagWith(
            markup,
            'data-panel="dashboard-transcript-shell"',
        );
        const transcriptTab = openingTagWith(
            markup,
            'data-tab-key="transcript"',
        );
        const copyButton = openingTagWith(
            markup,
            'data-control="copy-local-transcript"',
        );

        expect(transcriptRegion).toContain('role="region"');
        expect(transcriptRegion).toContain('aria-label="转写与说话人"');
        expect(transcriptTab).toContain('aria-selected="true"');
        expect(markup).toContain("Runtime transcript");
        expect(markup).toContain("Maple");
        expect(copyButton).toContain('type="button"');
        expect(copyButton).toContain('data-state="ready"');
        expect(copyButton).toContain('data-tab-scope="transcript"');
    });

    it("reduces mutually exclusive dashboard filters through runtime state", () => {
        const initialState: DashboardFilterState = {
            favorite: "tags",
            listMode: "tags",
            selectedTagFilter: "tag:runtime",
        };
        const afterFavoriteReset = reduceDashboardFilterState(initialState, {
            type: "favorite",
            value: "all",
        });
        const afterTimelineSelection = reduceDashboardFilterState(
            afterFavoriteReset,
            {
                type: "list-mode",
                value: "timeline",
            },
        );

        expect(afterFavoriteReset).toEqual({
            favorite: "all",
            listMode: "tags",
            selectedTagFilter: "all",
        });
        expect(afterTimelineSelection).toEqual({
            favorite: "all",
            listMode: "timeline",
            selectedTagFilter: "all",
        });
    });

    it("renders list-mode and tag-filter controls with selected DOM state", () => {
        const markup = renderDashboard();
        const listModeTabs = openingTagWith(markup, 'aria-label="列表模式"');
        const timelineTab = openingTagWith(markup, 'data-tab-key="timeline"');
        const tagsTab = openingTagWith(markup, 'data-tab-key="tags"');
        const tagListbox = openingTagWith(markup, 'data-tag-filter-list=""');
        const allTagsOption = openingTagWith(markup, 'data-tag-value="all"');

        expect(listModeTabs).toContain('role="tablist"');
        expect(timelineTab).toContain('aria-selected="true"');
        expect(tagsTab).toContain('aria-selected="false"');
        expect(tagListbox).toContain('role="listbox"');
        expect(allTagsOption).toContain('role="option"');
        expect(allTagsOption).toContain('aria-selected="true"');
        expect(allTagsOption).toContain('data-state="selected"');
    });

    it("renders idle manual-sync controls with accessible status linkage", () => {
        const markup = renderDashboard();
        const syncPanel = openingTagWith(markup, 'data-panel="dashboard-sync"');
        const syncButton = openingTagWith(
            markup,
            'data-control="dashboard-sync"',
        );
        const activityButton = openingTagWith(
            markup,
            'data-control="dashboard-activity"',
        );

        expect(syncPanel).toContain('data-state="idle"');
        expect(syncPanel).toContain('data-sync-state="idle"');
        expect(markup).toContain('id="dashboard-sync-title"');
        expect(markup).toContain('id="dashboard-sync-subtitle"');
        expect(syncButton).toContain('aria-label="同步"');
        expect(syncButton).toContain(
            'aria-describedby="dashboard-sync-title dashboard-sync-subtitle"',
        );
        expect(syncButton).toContain('aria-busy="false"');
        expect(syncButton).not.toContain(' disabled=""');
        expect(activityButton).toContain('type="button"');
        expect(activityButton).toContain('aria-expanded="false"');
        expect(activityButton).toContain('data-state="idle"');
    });
});
