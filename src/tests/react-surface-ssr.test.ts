import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/components/language-provider";
import { Panel } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Workstation } from "@/features/dashboard/workstation";
import { DataSourceFieldControl } from "@/features/data-sources/data-source-field-control";
import { RecordingTagIconGlyph } from "@/features/recordings/components/recording-tag-visuals";
import { SourceReportPanel } from "@/features/recordings/components/source-report-panel";
import {
    SpeakerReviewSkeleton,
    TranscriptOutputSkeleton,
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
    icon: "grid",
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

function extractClassTokens(html: string) {
    return Array.from(html.matchAll(/\sclass="([^"]*)"/g)).flatMap((match) =>
        match[1].split(/\s+/).filter(Boolean),
    );
}

describe("React surface SSR coverage", () => {
    it("renders current SOT primitives without card compatibility", () => {
        const html = render(
            React.createElement(
                "main",
                null,
                React.createElement(Panel, null, "Panel"),
                React.createElement(Button, { variant: "primary" }, "Sync"),
                React.createElement(Button, { variant: "outline" }, "Preview"),
                React.createElement(Input, { defaultValue: "input" }),
                React.createElement(Label, null, "Label"),
                React.createElement(Textarea, { defaultValue: "note" }),
                React.createElement(Switch, { checked: true }),
                React.createElement(Skeleton, { className: "field-row" }),
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

        expect(html).toContain('data-slot="card"');
        expect(html).toContain('data-variant="default"');
        expect(html).not.toContain('class="panel');
        expect(html).toContain('data-slot="button"');
        expect(html).toContain('data-variant="primary"');
        expect(html).toContain('data-variant="outline"');
        expect(html).toContain('data-slot="input"');
        expect(html).toContain('data-slot="label"');
        expect(html).toContain('data-slot="textarea"');
        expect(html).toContain('data-slot="switch"');
        expect(html).toContain('data-sot-control="liquid-tabs"');
        expect(html).toContain('data-slot="segmented-tabs"');
        expect(html).toContain('data-sot-part="liquid-tabs-indicator"');
        expect(html).toContain('data-sot-control="liquid-tab"');
        expect(html).not.toContain('class="liquid-tabs');
        expect(html).not.toContain('class="lt-tab');
        expect(html).not.toContain("card-content");
        expect(html).not.toContain("uikit-");
    });

    it("renders Button as a default button and an asChild link", () => {
        const buttonHtml = render(
            React.createElement(
                Button,
                {
                    variant: "ghost",
                    size: "sm",
                    type: "button",
                },
                "去设置",
            ),
        );

        expect(buttonHtml.match(/<button/g)).toHaveLength(1);
        expect(buttonHtml).toContain('data-slot="button"');
        expect(buttonHtml).toContain('data-variant="ghost"');
        expect(buttonHtml).toContain('data-size="sm"');
        expect(buttonHtml).not.toContain("<a");

        const linkHtml = render(
            React.createElement(
                Button,
                {
                    asChild: true,
                    variant: "link",
                },
                React.createElement("a", { href: "/settings" }, "去设置"),
            ),
        );

        expect(linkHtml).toContain("<a ");
        expect(linkHtml).toContain('href="/settings"');
        expect(linkHtml).toContain('data-slot="button"');
        expect(linkHtml).toContain('data-variant="link"');
        expect(linkHtml).not.toContain("<button");
    });

    it("renders settings sections and dialogs on the current fixed shell", () => {
        const html = render(
            React.createElement(
                "section",
                null,
                React.createElement(SettingsDialog, {
                    open: true,
                    onOpenChange: vi.fn(),
                }),
                React.createElement(SettingsPageContent),
                React.createElement(SettingsContent, {
                    activeSection: "data-sources",
                }),
                React.createElement(SettingsContent, {
                    activeSection: "misc",
                }),
            ),
        );

        expect(html).toContain('data-sot-panel="settings-scroll-body"');
        expect(html).toContain("数据源");
        expect(html).toContain('data-sot-surface="settings-data-sources"');
        expect(html).toContain('data-sot-panel="source-provider-detail"');
        expect(html).toContain('data-sot-panel="settings-section-skeleton"');
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

        expect(html).toContain("dashboard-workstation");
        expect(html).toContain("Weekly sync");
        expect(html).toContain("TicNote");
        expect(html).toContain('data-sot-list="dashboard-sources"');
        expect(html).toContain('data-sot-panel="dashboard-sync"');
        expect(html).toContain('data-sot-control="dashboard-sync"');
    });

    it("renders data source and source-detail supporting surfaces", () => {
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
                    icon: "grid",
                }),
                React.createElement(SourceReportPanel, {
                    recordingId: recording.id,
                    sourceProvider: "ticnote",
                    autoLoad: false,
                }),
                React.createElement(TranscriptOutputSkeleton),
                React.createElement(SpeakerReviewSkeleton),
                React.createElement(TranscriptReviewSkeleton),
            ),
        );
        const classTokens = extractClassTokens(html);

        expect(html).toContain("Authorization");
        expect(html).toContain("source-report");
        expect(html).toContain(
            'data-sot-panel="recording-transcription-skeleton"',
        );
        expect(html).toContain(
            'data-sot-panel="recording-transcription-speaker-review-skeleton"',
        );
        expect(html).toContain(
            'data-sot-panel="recording-transcription-review-skeleton"',
        );
        expect(html).toContain(
            'data-sot-part="recording-transcription-skeleton-line"',
        );
        for (const legacyClass of [
            "empty-hint",
            "eh-h",
            "eh-t",
            "speaker",
            "sp-row",
            "sp-row-meta",
            "sp-rows",
            "sr-section",
            "sr-section-head",
            "sr-section-sub",
            "sr-segments",
            "transcript",
            "transcript-body",
            "transcript-head",
            "t-pane",
            "turn",
            "ts",
        ]) {
            expect(classTokens).not.toContain(legacyClass);
        }
    });
});
