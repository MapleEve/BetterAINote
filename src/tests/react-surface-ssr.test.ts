import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import DashboardLoading from "@/app/(app)/dashboard/loading";
import RecordingError from "@/app/(app)/recordings/[id]/error";
import RecordingLoading from "@/app/(app)/recordings/[id]/loading";
import RecordingNotFound from "@/app/(app)/recordings/[id]/not-found";
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
import { SettingFieldControl } from "@/features/settings/components/setting-field-control";
import { SettingsContent } from "@/features/settings/components/settings-content";
import { SettingsDialog } from "@/features/settings/components/settings-dialog";
import { SettingsPageContent } from "@/features/settings/components/settings-page-content";
import {
    SettingsCardSkeleton,
    SettingsListSkeleton,
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

function render(
    element: React.ReactElement,
    language: "zh-CN" | "en" = "zh-CN",
) {
    return renderToStaticMarkup(
        React.createElement(
            LanguageProvider,
            { language } as React.ComponentProps<typeof LanguageProvider>,
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
    it("renders App Router fallback chrome through shadcn surfaces", () => {
        const html = render(
            React.createElement(
                "section",
                null,
                React.createElement(DashboardLoading),
                React.createElement(RecordingLoading),
                React.createElement(RecordingNotFound),
                React.createElement(RecordingError, { reset: vi.fn() }),
            ),
        );

        for (const loadingLabel of ["正在加载仪表盘", "正在加载录音详情"]) {
            expect(html).toContain(`aria-label="${loadingLabel}"`);
        }
        expect(html).toContain('aria-label="应用导航"');
        expect(html).toContain('aria-label="当前页面"');
        expect(html).toContain('aria-busy="true"');
        expect(html).toContain("录音不存在");
        expect(html).toContain("加载失败");
        expect(html).toMatch(/<button[^>]*type="button"[^>]*>重试<\/button>/);
        expect(html).toMatch(/<a[^>]*href="\/dashboard"[^>]*>返回工作台<\/a>/);
        expect(html).toContain('data-slot="card"');
        expect(html).toContain('data-slot="skeleton"');
        expect(html).toContain('data-slot="empty"');
        expect(html).toContain('data-slot="button"');
        for (const semanticToken of [
            "bg-background",
            "bg-card",
            "border-border",
            "text-muted-foreground",
        ]) {
            expect(html).toContain(semanticToken);
        }
        expect(html).not.toContain("routeChromeStyles");
        expect(html).not.toContain("bg-[var(--bg-elevated)]");
        expect(html).not.toContain("border-[var(--line-hairline)]");
    });

    it("renders current SOT primitives without card compatibility", () => {
        const html = render(
            React.createElement(
                "main",
                null,
                React.createElement(Panel, null, "Panel"),
                React.createElement(Button, { variant: "default" }, "Sync"),
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
                React.createElement(SettingsListSkeleton, { rows: 2 }),
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
        expect(html).toContain('data-variant="default"');
        expect(html).toMatch(/data-slot="button"[^>]*data-variant="outline"/);
        expect(html).toContain('data-slot="input"');
        expect(html).toContain('data-slot="label"');
        expect(html).toContain('data-slot="textarea"');
        expect(html).toContain('data-slot="switch"');
        expect(html).toContain('data-slot="toggle-group"');
        expect(html).toMatch(
            /data-slot="toggle-group"[^>]*data-variant="segmented"[^>]*data-size="segmentedSm"/,
        );
        expect(html).not.toMatch(
            /data-slot="toggle-group"[^>]*data-variant="outline"/,
        );
        expect(html).toContain('data-tabs="2"');
        expect(html).toContain('data-active="0"');
        expect(html).toContain('data-slot="toggle-group-item"');
        expect(html).toContain('data-state="on"');
        expect(html).not.toContain('data-control="segmented-tabs"');
        expect(html).not.toContain('data-size="sm"');
        expect(html).not.toContain('data-control="segmented-tab"');
        expect(html).not.toContain('data-state="active"');
        expect(html).not.toContain('data-slot="segmented-tabs"');
        expect(html).not.toContain('data-slot="toggle-group-indicator"');
        expect(html).not.toContain('data-control="liquid-tabs"');
        expect(html).not.toContain('data-control="liquid-tab"');
        expect(html).not.toContain('data-part="liquid-tabs-indicator"');
        expect(html).not.toContain('class="liquid-tabs');
        expect(html).not.toContain('class="lt-tab');
        expect(html).toContain('aria-busy="true"');
        expect(html).toContain("<output");
        expect(html).toContain('aria-label="正在加载设置"');
        expect(html).toContain('aria-live="polite"');
        expect(html).not.toContain('role="status"');
        expect(html).toContain("正在加载设置");
        expect(html).toContain('data-slot="spinner"');
        const englishHtml = render(
            React.createElement(SettingsSectionSkeleton),
            "en",
        );
        expect(englishHtml).toContain('aria-busy="true"');
        expect(englishHtml).toContain("<output");
        expect(englishHtml).toContain('aria-label="Loading settings"');
        expect(englishHtml).toContain('aria-live="polite"');
        expect(englishHtml).not.toContain('role="status"');
        expect(englishHtml).toContain("Loading settings");
        expect(englishHtml).toContain('data-slot="spinner"');
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
        const dataSourcesHtml = render(
            React.createElement(SettingsContent, {
                activeSection: "data-sources",
            }),
        );
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

        expect(html).toContain("数据源");
        expect(html).toContain('aria-busy="true"');
        expect(html).toContain("<output");
        expect(html).toContain('aria-label="正在加载设置"');
        expect(html).toContain('aria-live="polite"');
        expect(html).not.toContain('role="status"');
        expect(html).toContain("正在加载设置");

        expect(dataSourcesHtml).toContain('aria-busy="true"');
        expect(dataSourcesHtml).toContain('aria-label="数据源列表"');
        expect(dataSourcesHtml).toMatch(
            /<section(?=[^>]*id="data-source-provider-detail")(?=[^>]*aria-busy="false")/,
        );
        expect(dataSourcesHtml.match(/data-slot="empty"/g)).toHaveLength(2);
        expect(dataSourcesHtml).toContain("正在读取来源");
        expect(dataSourcesHtml).toContain("没有可用数据源");
        expect(dataSourcesHtml).toContain('aria-live="polite"');
        expect(dataSourcesHtml).not.toContain(`${["data", "sot"].join("-")}-`);
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
        expect(html).toContain('data-list="dashboard-sources"');
        expect(html).toContain('data-panel="dashboard-sync"');
        expect(html).toContain('data-control="dashboard-sync"');
    });

    it("renders data source and source-detail supporting surfaces", () => {
        const html = render(
            React.createElement(
                "section",
                null,
                React.createElement(DataSourceFieldControl, {
                    field: {
                        id: "login-material",
                        key: "loginMaterial",
                        label: "登录信息",
                        description: "粘贴当前账号的登录信息。",
                        placeholder: "粘贴登录信息",
                        value: "",
                        target: "secret",
                        kind: "textarea",
                    },
                    fieldId: "field-login-material",
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

        expect(html).toContain("登录信息");
        expect(html).toContain("source-report");
        for (const loadingLabel of [
            "正在加载转写结果",
            "正在加载说话人复核",
            "正在加载转写复核",
        ]) {
            expect(html).toContain(`aria-label="${loadingLabel}"`);
        }
        expect((html.match(/aria-busy="true"/g) ?? []).length).toBe(4);
        expect(
            (html.match(/data-slot="card"/g) ?? []).length,
        ).toBeGreaterThanOrEqual(2);
        expect(
            (html.match(/data-slot="skeleton"/g) ?? []).length,
        ).toBeGreaterThanOrEqual(50);
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

    it("uses standard password inputs for sensitive settings textareas without bespoke DOM markers", () => {
        const html = render(
            React.createElement(
                "section",
                null,
                React.createElement(SettingFieldControl, {
                    field: {
                        id: "settings-login-material",
                        kind: "textarea",
                        label: "登录信息",
                        value: "",
                        sensitive: true,
                        rows: 3,
                    },
                    fieldId: "settings-login-material",
                    onValueChange: vi.fn(),
                    variant: "settings",
                }),
                React.createElement(SettingFieldControl, {
                    disabled: true,
                    field: {
                        id: "settings-visible-note",
                        kind: "textarea",
                        label: "设置备注",
                        description: "用于记录此设备的设置说明。",
                        value: "只读备注",
                        masked: true,
                        readOnly: true,
                        rows: 3,
                    },
                    fieldId: "settings-visible-note",
                    onValueChange: vi.fn(),
                    variant: "settings",
                }),
                React.createElement(DataSourceFieldControl, {
                    field: {
                        id: "source-notes",
                        key: "notes",
                        label: "连接备注",
                        description: "用于记录这条连接的备注。",
                        value: "可选备注",
                        target: "config",
                        kind: "textarea",
                        rows: 3,
                    },
                    fieldId: "field-notes",
                    onValueChange: vi.fn(),
                    variant: "settings",
                }),
                React.createElement(DataSourceFieldControl, {
                    field: {
                        id: "source-web-cookie",
                        key: "webCookie",
                        label: "网页登录信息",
                        description: "粘贴当前登录状态对应的网页登录信息。",
                        placeholder: "粘贴登录信息",
                        value: "",
                        target: "secret",
                        kind: "textarea",
                        rows: 3,
                    },
                    fieldId: "field-web-cookie",
                    onValueChange: vi.fn(),
                    variant: "settings",
                }),
                React.createElement(DataSourceFieldControl, {
                    field: {
                        id: "source-api-token",
                        key: "apiToken",
                        label: "API 令牌",
                        value: "",
                        target: "secret",
                        kind: "textarea",
                        rows: 3,
                    },
                    fieldId: "field-api-token",
                    onValueChange: vi.fn(),
                    variant: "settings",
                }),
                React.createElement(DataSourceFieldControl, {
                    field: {
                        id: "source-device-secret",
                        key: "deviceCredential",
                        label: "设备标识",
                        value: "",
                        target: "secret",
                        kind: "textarea",
                        rows: 3,
                    },
                    fieldId: "field-device-secret",
                    onValueChange: vi.fn(),
                    variant: "settings",
                }),
            ),
        );

        expect(html).toMatch(/<textarea(?=[^>]*id="settings-visible-note")/);
        expect(html).toMatch(/<textarea(?=[^>]*id="field-notes")/);
        expect(html).toContain('data-slot="textarea"');
        expect(html).toContain("只读备注");
        expect(html).toContain("用于记录此设备的设置说明。");
        expect(html).toMatch(
            /<label(?=[^>]*for="settings-visible-note")[^>]*>设置备注<\/label>/,
        );
        const settingsTextarea =
            html.match(
                /<textarea(?=[^>]*id="settings-visible-note")[^>]*>/,
            )?.[0] ?? "";
        expect(settingsTextarea).toContain("tracking-widest");
        expect(settingsTextarea).not.toContain("data-mask");
        expect(settingsTextarea).not.toContain("data-privacy-boundary");
        expect(settingsTextarea).toMatch(/\sdisabled(?:=|(?=\s|>))/i);
        expect(settingsTextarea).toMatch(/\sreadonly(?:=|(?=\s|>))/i);
        for (const [fieldId, label] of [
            ["settings-login-material", "登录信息"],
            ["field-web-cookie", "网页登录信息"],
            ["field-api-token", "API 令牌"],
            ["field-device-secret", "设备标识"],
        ] as const) {
            expect(html).toMatch(
                new RegExp(
                    `<label(?=[^>]*for="${fieldId}")[^>]*>${label}</label>`,
                ),
            );
            expect(html).toMatch(
                new RegExp(
                    `<input(?=[^>]*id="${fieldId}")(?=[^>]*type="password")(?![^>]*data-mask)(?![^>]*data-privacy-boundary)`,
                ),
            );
            expect(html).not.toMatch(
                new RegExp(`<textarea(?=[^>]*id="${fieldId}")`),
            );
        }
    });
});
