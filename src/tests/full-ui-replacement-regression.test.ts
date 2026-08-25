import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DashboardLoading from "@/app/(app)/dashboard/loading";
import RecordingError from "@/app/(app)/recordings/[id]/error";
import RecordingLoading from "@/app/(app)/recordings/[id]/loading";
import RecordingNotFound from "@/app/(app)/recordings/[id]/not-found";
import { LanguageProvider } from "@/components/language-provider";
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyTitle,
} from "@/components/ui/empty";
import {
    getSegmentedTabsKeyboardActivationValue,
    SegmentedTabs,
} from "@/components/ui/segmented-tabs";
import { LoginForm } from "@/features/auth/components/login-form";
import { SystemBanner } from "@/features/dashboard/components/system-banner";
import {
    TranscriptionPanel,
    type TranscriptionPanelRetranscriptionState,
} from "@/features/dashboard/components/transcription-panel";
import {
    dashboardFilterStateUrl,
    reduceDashboardFilterState,
    restoreDashboardFilterState,
    serializeDashboardFilterState,
} from "@/features/dashboard/filter-state";
import { Workstation } from "@/features/dashboard/workstation";
import { OnboardingForm } from "@/features/onboarding/components/onboarding-form";
import { AiRenamePreviewCard } from "@/features/recordings/components/ai-rename-preview-card";
import { RecordingTagManager } from "@/features/recordings/components/recording-tag-manager";
import { RecordingWorkstation } from "@/features/recordings/workstation";
import { SettingsContent } from "@/features/settings/components/settings-content";
import { normalizeSettingsSection } from "@/features/settings/components/settings-dialog";
import type { RecordingTag } from "@/lib/recording-tags";
import type { Recording } from "@/types/recording";

const runtime = vi.hoisted(() => ({
    authAnonymous: vi.fn(),
    authMagicLink: vi.fn(),
    buttonProps: [] as Array<Record<string, unknown>>,
    navigate: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({
        back: vi.fn(),
        push: vi.fn(),
        refresh: vi.fn(),
        replace: vi.fn(),
    }),
}));

vi.mock("@/lib/auth-client", () => ({
    signIn: {
        anonymous: runtime.authAnonymous,
        magicLink: runtime.authMagicLink,
    },
}));

vi.mock("@/lib/platform/browser-router", () => ({
    navigateAndRefreshBrowserRoute: runtime.navigate,
    useBrowserRouteController: () => ({
        push: vi.fn(),
        refresh: vi.fn(),
    }),
}));

vi.mock("@/components/ui/button", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("@/components/ui/button")>();
    const ReactModule = await import("react");

    return {
        ...actual,
        Button: (props: React.ComponentProps<typeof actual.Button>) => {
            runtime.buttonProps.push(props as Record<string, unknown>);
            return ReactModule.createElement(actual.Button, props);
        },
    };
});

vi.mock("@/components/ui/popover", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("@/components/ui/popover")>();

    return {
        ...actual,
        PopoverContent: (
            props: React.ComponentProps<typeof actual.PopoverContent> & {
                "data-control"?: string;
            },
        ) => {
            if (props["data-control"] !== "ai-rename-preview") {
                return React.createElement(actual.PopoverContent, props);
            }

            const {
                align: _align,
                alignOffset: _alignOffset,
                avoidCollisions: _avoidCollisions,
                onEscapeKeyDown: _onEscapeKeyDown,
                onOpenAutoFocus: _onOpenAutoFocus,
                side: _side,
                sideOffset: _sideOffset,
                ...domProps
            } = props;

            return React.createElement("div", domProps);
        },
    };
});

vi.mock("@/features/data-sources/use-onboarding-data-source", () => ({
    useOnboardingDataSource: () => ({
        connectedProvider: null,
        connectedProviders: [],
        connectedSourceLabel: null,
        connectSource: vi.fn().mockResolvedValue(true),
        currentDraft: {
            authMode: "token",
            baseUrl: "https://example.invalid",
        },
        currentProviderCatalog: { authModes: ["token"] },
        isSaving: false,
        provider: "plaud",
        providerFields: [],
        providerOptions: [
            { label: "Plaud", provider: "plaud" },
            { label: "TicNote", provider: "ticnote" },
        ],
        selectProvider: vi.fn(),
        setAuthMode: vi.fn(),
        setBaseUrl: vi.fn(),
        sourceLabel: "Plaud",
        updateField: vi.fn(),
        usesCustomServerSelector: true,
    }),
}));

vi.mock("sonner", () => ({
    toast: {
        error: vi.fn(),
        success: vi.fn(),
    },
}));

const ROOT = path.join(process.cwd(), "src");
const RUNTIME_TAG: RecordingTag = {
    color: "blue",
    icon: "grid",
    id: "tag-runtime",
    name: "Review",
};
const RUNTIME_RECORDING: Recording = {
    id: "recording-runtime",
    filename: "Runtime review",
    duration: 125_000,
    startTime: "2026-07-31T10:00:00.000Z",
    filesize: 1_024_000,
    providerDeviceId: "device-runtime",
    upstreamDeleted: false,
    sourceProvider: "ticnote",
    sourceRecordingId: "source-runtime",
    audioUrl: "/api/recordings/recording-runtime/audio",
    hasAudio: true,
    tags: [RUNTIME_TAG],
};
const RUNTIME_TRANSCRIPT = {
    text: "SPEAKER_01: Runtime transcript",
    language: "en",
    speakerMap: { SPEAKER_01: "Maple" },
    segments: [
        {
            id: 1,
            start: 0,
            end: 5,
            text: "Runtime transcript",
            speakerLabel: "SPEAKER_01",
            speakerName: null,
            displaySpeaker: null,
        },
    ],
};

beforeEach(() => {
    runtime.authAnonymous.mockReset();
    runtime.authMagicLink.mockReset();
    runtime.buttonProps.length = 0;
    runtime.navigate.mockReset();
});

function renderRuntime(element: React.ReactElement) {
    return renderToStaticMarkup(
        React.createElement(
            LanguageProvider,
            { language: "en" } as React.ComponentProps<typeof LanguageProvider>,
            React.createElement(ConfirmDialogProvider, null, element),
        ),
    );
}

function renderDashboardRuntime(recordings: Recording[] = [RUNTIME_RECORDING]) {
    const transcriptions = new Map(
        recordings.map((recording) => [recording.id, RUNTIME_TRANSCRIPT]),
    );
    const transcriptionJobs = new Map(
        recordings.map((recording) => [
            recording.id,
            { status: "succeeded", remoteStatus: null },
        ]),
    );

    return renderRuntime(
        React.createElement(Workstation, {
            recordings,
            transcriptions,
            transcriptionJobs,
        }),
    );
}

function renderRecordingRuntime() {
    return renderRuntime(
        React.createElement(RecordingWorkstation, {
            recording: RUNTIME_RECORDING,
            transcription: RUNTIME_TRANSCRIPT,
            transcriptionJob: {
                status: "succeeded",
                remoteStatus: null,
                lastError: null,
            },
        }),
    );
}

function renderTagManagerRuntime(loadError?: string) {
    return renderToStaticMarkup(
        React.createElement(RecordingTagManager, {
            availableTags: [RUNTIME_TAG],
            loadError,
            onAvailableTagsChange: vi.fn(),
            onRecordingTagsChange: vi.fn(),
            recording: RUNTIME_RECORDING,
        }),
    );
}

function renderOfflineSystemBanner() {
    const windowDescriptor = Object.getOwnPropertyDescriptor(
        globalThis,
        "window",
    );
    const navigatorDescriptor = Object.getOwnPropertyDescriptor(
        globalThis,
        "navigator",
    );

    Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: {
            addEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
            location: { reload: vi.fn() },
            removeEventListener: vi.fn(),
        },
    });
    Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: { onLine: false },
    });

    try {
        return renderRuntime(React.createElement(SystemBanner));
    } finally {
        if (windowDescriptor) {
            Object.defineProperty(globalThis, "window", windowDescriptor);
        } else {
            Reflect.deleteProperty(globalThis, "window");
        }
        if (navigatorDescriptor) {
            Object.defineProperty(globalThis, "navigator", navigatorDescriptor);
        } else {
            Reflect.deleteProperty(globalThis, "navigator");
        }
    }
}

function renderTranscriptionPanelRuntime(
    state: TranscriptionPanelRetranscriptionState,
    {
        activeTab = "transcript",
        feedback = null,
        isTranscriptLoading = false,
    }: {
        activeTab?: "source" | "speakers" | "transcript";
        feedback?: "ok" | "err" | null;
        isTranscriptLoading?: boolean;
    } = {},
) {
    return renderRuntime(
        React.createElement(TranscriptionPanel, {
            recording: RUNTIME_RECORDING,
            activeTab,
            onActiveTabChange: vi.fn(),
            turns: [
                {
                    id: "turn-runtime",
                    speakerName: "Maple",
                    startMs: 0,
                    endMs: 5_000,
                    text: "Runtime transcript",
                },
            ],
            isTranscriptLoading,
            onRetryTranscript: vi.fn(),
            transcriptLanguage: "en",
            localCopyState: "ready",
            localCopyFeedback: feedback,
            onCopyLocal: vi.fn(),
            retranscription: {
                state,
                title: `Retranscription ${state}`,
                description: `Runtime ${state} state`,
                disabled: state === "unavailable",
                disabledReason:
                    state === "unavailable"
                        ? "Retranscription unavailable"
                        : undefined,
                refreshedLabel: "Transcript refreshed",
                onRequest: vi.fn(),
                onRetry: vi.fn(),
                onDismiss: vi.fn(),
            },
            speakers: [],
            speakerMerge: {
                state: "idle",
                onMerge: vi.fn(),
                onRetry: vi.fn(),
            },
            sourceActions: null,
            sourcePane: React.createElement("p", null, "Runtime source report"),
        }),
    );
}

function renderAiRenameRuntime(
    state: "loading" | "preview" | "review" | "error" | "unavailable",
) {
    return renderRuntime(
        React.createElement(AiRenamePreviewCard, {
            title: "AI title preview",
            subtitle: "Review the suggested title",
            state,
            originalFilename: "weekly-sync.m4a",
            filename: "2026-07-30 Weekly Sync.m4a",
            message:
                state === "loading"
                    ? "Generating a title from this recording"
                    : "Review the suggested title before applying it.",
            hint: state === "error" ? "Try again or close this preview." : null,
            isApplying: false,
            isRegenerating: state === "loading",
            applyLabel: "Apply title",
            cancelLabel: "Cancel",
            closeLabel: "Close",
            regenerateLabel: "Retry",
            onApply: vi.fn(),
            onCancel: vi.fn(),
            onRegenerate: vi.fn(),
        }),
    );
}

function readProductFile(relativePath: string) {
    return readFileSync(path.join(ROOT, relativePath), "utf8");
}

function expectProductFilesToExclude(
    relativePaths: readonly string[],
    forbidden: readonly (string | RegExp)[],
) {
    for (const relativePath of relativePaths) {
        const contents = readProductFile(relativePath);
        for (const item of forbidden) {
            if (typeof item === "string") {
                expect(contents).not.toContain(item);
            } else {
                expect(contents).not.toMatch(item);
            }
        }
    }
}

function collectProductFiles(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) return collectProductFiles(entryPath);
        return /\.(css|ts|tsx)$/.test(entry.name) ? [entryPath] : [];
    });
}

function textFromChildren(value: unknown): string {
    if (typeof value === "string" || typeof value === "number") {
        return String(value);
    }
    if (Array.isArray(value)) return value.map(textFromChildren).join("");
    if (React.isValidElement<{ children?: unknown }>(value)) {
        return textFromChildren(value.props.children);
    }
    return "";
}

function capturedButton(label: string) {
    const props = runtime.buttonProps.find(
        (candidate) => textFromChildren(candidate.children) === label,
    );
    if (!props) {
        throw new Error(`Unable to find rendered button: ${label}`);
    }
    return props;
}

function expectNoTestOnlyContract(html: string) {
    expect(html).not.toContain(["data", "sot"].join("-"));
}

describe("full UI replacement regression coverage", () => {
    it("keeps dashboard and recording workstation brand globals migrated to owner-local classes", () => {
        const dashboard = renderDashboardRuntime();
        const recording = renderRecordingRuntime();

        expect(dashboard).toContain('data-part="dashboard-brand"');
        expect(dashboard).toContain('data-part="dashboard-brand-name"');
        expect(dashboard).toContain("BetterAINote");
        expect(recording).toContain('data-part="workstation-brand"');
        expect(recording).toContain('data-part="workstation-brand-name"');
        expect(recording).toContain("BetterAINote");
        expectProductFilesToExclude(
            ["app/globals.css"],
            [
                '[data-part="dashboard-brand"]',
                '[data-part="workstation-brand"]',
            ],
        );
    });

    it("keeps semantic global primitives and a Radix settings shell without global SOT visual overrides", () => {
        const settings = renderRuntime(
            React.createElement(SettingsContent, {
                activeSection: "data-sources",
            }),
        );
        const empty = renderToStaticMarkup(
            React.createElement(
                Empty,
                null,
                React.createElement(
                    EmptyHeader,
                    null,
                    React.createElement(EmptyTitle, null, "Nothing here"),
                    React.createElement(
                        EmptyDescription,
                        null,
                        "Choose another source.",
                    ),
                ),
            ),
        );

        expect(settings).toContain('aria-label="Data source list"');
        expect(settings).toContain('aria-live="polite"');
        expect(settings).toContain('id="data-source-provider-detail"');
        expect(empty).toContain('data-slot="empty"');
        expect(empty).toContain("Nothing here");
        expect(normalizeSettingsSection("appearance")).toBe("appearance");
        expect(normalizeSettingsSection("not-a-section")).toBeNull();
    });

    it("keeps standalone recording route fallback actions on route Button variants", () => {
        const reset = vi.fn();
        const loading = renderToStaticMarkup(
            React.createElement(RecordingLoading),
        );
        const missing = renderToStaticMarkup(
            React.createElement(RecordingNotFound),
        );
        const failed = renderToStaticMarkup(
            React.createElement(RecordingError, { reset }),
        );

        expect(loading).toContain('aria-label="正在加载录音详情"');
        expect(loading).toContain('aria-busy="true"');
        expect(missing).toContain('data-shell="recording-route-empty"');
        expect(missing).toContain('href="/dashboard"');
        expect(failed).toContain('data-shell="recording-route-error"');
        expect(failed).toContain("重试");
        const retry = capturedButton("重试");
        expect(retry.onClick).toBe(reset);
        (retry.onClick as () => void)();
        expect(reset).toHaveBeenCalledOnce();
    });

    it("keeps recording route loading skeleton sizing route-local and off the Skeleton primitive", () => {
        const dashboard = renderToStaticMarkup(
            React.createElement(DashboardLoading),
        );
        const recording = renderToStaticMarkup(
            React.createElement(RecordingLoading),
        );

        for (const html of [dashboard, recording]) {
            expect(html).toContain('aria-busy="true"');
            expect(html).toContain('data-slot="skeleton"');
            expectNoTestOnlyContract(html);
        }
        expect(dashboard).toContain('aria-label="正在加载仪表盘"');
        expect(recording).toContain('aria-label="正在加载录音详情"');
    });

    it("classifies non-token modern CSS colors without fallback-only leakage", () => {
        const globals = readProductFile("app/globals.css");
        const unsafeFallbacks =
            globals.match(
                /var\(\s*--[\w-]+\s*,\s*(?:#[\da-f]{3,8}|(?:rgb|hsl|oklch|color-mix)\()/gi,
            ) ?? [];

        expect(unsafeFallbacks).toEqual([]);
    });

    it("keeps component-library showcase chrome out of runtime globals", () => {
        expectProductFilesToExclude(
            ["app/globals.css"],
            [
                /\.cl-/,
                /cl-pop-host/,
                /\bstack-strip\b/,
                /\bstack-banner\.cl-show\b/,
                /\bcl-stage-[\w-]+\b/,
                /@keyframes\s+cl-shimmer\b/,
            ],
        );
    });

    it("keeps recording tag manager legacy selectors out of product CSS", () => {
        const ready = renderTagManagerRuntime();
        const failed = renderTagManagerRuntime("Unable to load tags");

        expect(ready).toContain('data-control="recording-tag-manager"');
        expect(ready).toContain('data-control="recording-tag-toggle"');
        expect(ready).toContain('data-control="recording-tag-create"');
        expect(ready).toContain('aria-pressed="true"');
        expect(failed).toContain("Unable to load tags");
        expectProductFilesToExclude(
            [
                "app/globals.css",
                "features/recordings/components/recording-tag-visuals.tsx",
            ],
            [/^\s*\.(?:tagm-|tag-chip-)/m, /\bc-(?:rose|amber|blue)\b/],
        );
    });

    it("keeps dashboard transcript, source report, retx, and activity legacy selectors out of product CSS", () => {
        const dashboard = renderDashboardRuntime();
        const transcript = renderTranscriptionPanelRuntime("failed", {
            activeTab: "source",
        });

        expect(dashboard).toContain('data-control="dashboard-activity"');
        expect(dashboard).toContain('data-panel="dashboard-transcript-shell"');
        expect(transcript).toContain("Runtime source report");
        expect(transcript).toContain('data-retx-state="failed"');
        expect(transcript).toContain('role="alert"');
        expectProductFilesToExclude(
            ["app/globals.css"],
            [/\.tr-seg\b/, /\.source-report\b/, /\.retx-/, /\.activity-/],
        );
    });

    it("keeps dashboard recording-list replacement hooks out of legacy JSX className selectors", () => {
        const populated = renderDashboardRuntime();
        const empty = renderDashboardRuntime([]);

        expect(populated).toContain(
            'data-list="dashboard-recording-list-scroll"',
        );
        expect(populated).toContain("Runtime review");
        expect(populated).toContain("Runtime transcript");
        expect(empty).toContain('data-panel="dashboard-detail-empty"');
        expect(empty).toContain('data-slot="empty"');
        expectNoTestOnlyContract(populated);
        expectNoTestOnlyContract(empty);
    });

    it("keeps dashboard sidebar footer and list residuals owner-local", () => {
        const dashboard = renderDashboardRuntime();

        expect(dashboard).toContain('data-panel="dashboard-sidebar"');
        expect(dashboard).toContain('data-list="dashboard-nav"');
        expect(dashboard).toContain('data-list="dashboard-sources"');
        expect(dashboard).toContain('data-control="dashboard-settings"');
        expectProductFilesToExclude(
            ["app/globals.css"],
            ['[data-panel="dashboard-sidebar"]'],
        );
    });

    it("keeps dashboard global state on the runtime root without body bridges", () => {
        const restored = restoreDashboardFilterState({
            search: "?favorite=tags&mode=tags&tagId=tag-runtime",
            storedValue: null,
        });
        const reconciled = reduceDashboardFilterState(restored, {
            type: "reconcile-tags",
            available: ["all", "untagged"],
        });

        expect(restored).toEqual({
            favorite: "tags",
            listMode: "tags",
            selectedTagFilter: "tag:tag-runtime",
        });
        expect(reconciled.selectedTagFilter).toBe("all");
        expect(serializeDashboardFilterState(reconciled)).toBe(
            '{"favorite":"tags","listMode":"tags","selectedTagFilter":"all"}',
        );
        expectProductFilesToExclude(
            ["features/dashboard/workstation.tsx"],
            [/\bdocument\.body\.(?:classList|dataset)/],
        );
    });

    it("keeps library search product CSS feature-owned and out of globals", () => {
        const dashboard = renderDashboardRuntime();

        expect(dashboard).toMatch(
            /<button(?=[^>]*data-control="dashboard-search")(?=[^>]*aria-haspopup="dialog")(?=[^>]*aria-expanded="false")[^>]*>/,
        );
        expect(dashboard).toContain('data-control="dashboard-search"');
        expectNoTestOnlyContract(dashboard);
    });

    it("keeps dashboard topbar owner-local while source-provider atoms are primitive-owned", () => {
        const dashboard = renderDashboardRuntime();

        expect(dashboard).toContain('data-panel="dashboard-topbar"');
        expect(dashboard).toContain('data-control="dashboard-source-provider"');
        expect(dashboard).toContain('data-list="dashboard-sources"');
        expectProductFilesToExclude(
            ["app/globals.css"],
            [
                '[data-panel="dashboard-topbar"]',
                '[data-control="dashboard-source-provider"]',
            ],
        );
    });

    it("does not keep the retired liquid tabs CSS framework", () => {
        const items = [
            { label: "Transcript", value: "transcript" },
            { label: "Source", value: "source" },
            { disabled: true, label: "Speakers", value: "speakers" },
        ];
        const html = renderToStaticMarkup(
            React.createElement(SegmentedTabs, {
                "aria-label": "Recording views",
                items,
                onValueChange: vi.fn(),
                value: "transcript",
            }),
        );

        expect(html).toContain('role="tablist"');
        expect(html).toContain('aria-label="Recording views"');
        expect(html).toContain('aria-selected="true"');
        expect(html).toContain('aria-disabled="true"');
        expect(
            getSegmentedTabsKeyboardActivationValue({
                items,
                key: "ArrowRight",
                value: "transcript",
            }),
        ).toBe("source");
        expectProductFilesToExclude(
            ["app/globals.css"],
            ["liquid-segmented-tabs", "liquid-tab-indicator"],
        );
    });

    it("keeps system banner shared primitives free of feature business tokens", () => {
        const html = renderOfflineSystemBanner();

        expect(html).toContain('role="status"');
        expect(html).toContain("Offline");
        expect(html).toContain("Retry");
        expect(html).toContain('data-slot="alert"');
        expectProductFilesToExclude(
            ["components/ui/alert.tsx", "components/ui/button.tsx"],
            ["dashboard-system-banner", "recording-sync-banner"],
        );
    });

    it("composes system banners with shadcn Alert, Button, and Progress primitives", () => {
        const html = renderOfflineSystemBanner();

        expect(html).toContain('data-slot="alert"');
        expect(html).toContain('data-slot="alert-description"');
        expect(html).toContain('data-slot="button"');
        expect(html).toContain('aria-live="polite"');
        expectNoTestOnlyContract(html);
    });

    it("keeps more actions menu styling owned by DropdownMenu primitives", () => {
        const dashboard = renderDashboardRuntime();
        const recording = renderRecordingRuntime();

        expect(dashboard).toContain('data-control="recording-more-actions"');
        expect(recording).toContain('data-control="recording-more-actions"');
        expect(recording).toContain('aria-haspopup="menu"');
        expectProductFilesToExclude(
            ["app/globals.css"],
            [/\.more-actions-/, /\.recording-menu-/],
        );
    });

    it("keeps shared scrollbars owner-local on dashboard scroll surfaces", () => {
        const dashboard = renderDashboardRuntime();

        expect(dashboard).toContain(
            'data-list="dashboard-recording-list-scroll"',
        );
        expectProductFilesToExclude(
            ["app/globals.css"],
            [/::-webkit-scrollbar/, /scrollbar-(?:color|width)\s*:/],
        );
    });

    it("keeps tab pane hidden handling owned by dashboard panes", () => {
        const transcript = renderTranscriptionPanelRuntime("idle");
        const source = renderTranscriptionPanelRuntime("idle", {
            activeTab: "source",
        });
        const speakers = renderTranscriptionPanelRuntime("idle", {
            activeTab: "speakers",
        });

        expect(transcript).toMatch(
            /<section(?=[^>]*id="dashboard-transcription-pane-transcript")[^>]*>/,
        );
        expect(transcript).toMatch(
            /<section(?=[^>]*id="dashboard-transcription-pane-source")(?=[^>]*hidden="")[^>]*>/,
        );
        expect(source).toContain("Runtime source report");
        expect(source).toMatch(
            /<section(?=[^>]*id="dashboard-transcription-pane-transcript")(?=[^>]*hidden="")[^>]*>/,
        );
        expect(speakers).toMatch(
            /<section(?=[^>]*id="dashboard-transcription-pane-speakers")[^>]*>/,
        );
    });

    it("keeps dashboard time filter presentation and hidden state owner-local", () => {
        const dashboard = renderDashboardRuntime();
        const state = restoreDashboardFilterState({
            search: "?mode=tags&untagged=1",
            storedValue: null,
        });

        expect(dashboard).toContain(
            'data-control="dashboard-recording-time-filter"',
        );
        expect(dashboard).toContain(
            'data-part="dashboard-recording-time-filter-count"',
        );
        expect(state.listMode).toBe("tags");
        expect(state.selectedTagFilter).toBe("untagged");
        expect(
            dashboardFilterStateUrl("/dashboard?mode=tags", {
                favorite: "all",
                listMode: "timeline",
                selectedTagFilter: "tag:tag-runtime",
            }),
        ).toBe("/dashboard?tagId=tag-runtime");
    });

    it("keeps copy icon product CSS scoped to legacy SOT hooks", () => {
        const ready = renderTranscriptionPanelRuntime("idle");
        const copied = renderTranscriptionPanelRuntime("idle", {
            feedback: "ok",
        });
        const failed = renderTranscriptionPanelRuntime("idle", {
            feedback: "err",
        });

        expect(ready).toContain('data-control="copy-local-transcript"');
        expect(copied).toContain('data-copy-state="ok"');
        expect(copied).toContain("Copied");
        expect(failed).toContain('data-copy-state="err"');
        expect(failed).toContain("Copy failed");
        expectProductFilesToExclude(
            ["app/globals.css"],
            ['[data-slot="button"][data-copy]', ".copy-icon"],
        );
    });

    it("keeps dashboard transcript actions off lang-pill CSS selectors", () => {
        const html = renderTranscriptionPanelRuntime("idle");

        expect(html).toContain('data-part="dashboard-transcript-actions"');
        expect(html).toContain('data-part="dashboard-transcript-language"');
        expect(html).toContain('data-control="copy-local-transcript"');
        expect(html).toContain('data-control="retranscribe-recording"');
        expectProductFilesToExclude(
            [
                "app/globals.css",
                "features/dashboard/components/transcription-panel.tsx",
            ],
            [".lang-pill", 'className="lang-pill"'],
        );
    });

    it("keeps detail empty product CSS on legacy SOT selectors", () => {
        const html = renderDashboardRuntime([]);

        expect(html).toContain('data-panel="dashboard-detail-empty"');
        expect(html).toContain('data-part="dashboard-detail-empty-title"');
        expect(html).toContain(
            'data-part="dashboard-detail-empty-description"',
        );
        expectNoTestOnlyContract(html);
        expectProductFilesToExclude(
            ["app/globals.css"],
            [
                "[data-detail-empty]",
                '[data-panel="dashboard-detail"][data-empty="true"]',
            ],
        );
    });

    it("uses shadcn Empty for dashboard empty states without product repaint CSS", () => {
        const dashboard = renderDashboardRuntime([]);
        const primitive = renderToStaticMarkup(
            React.createElement(
                Empty,
                null,
                React.createElement(
                    EmptyHeader,
                    null,
                    React.createElement(EmptyTitle, null, "No recordings"),
                    React.createElement(
                        EmptyDescription,
                        null,
                        "Choose a source or clear filters.",
                    ),
                ),
            ),
        );

        expect(dashboard).toContain('data-slot="empty"');
        expect(primitive).toContain('data-slot="empty-header"');
        expect(primitive).toContain('data-slot="empty-title"');
        expect(primitive).toContain('data-slot="empty-description"');
        expectNoTestOnlyContract(primitive);
    });

    it("keeps AI rename preview legacy selectors out of product CSS", () => {
        const loading = renderAiRenameRuntime("loading");
        const error = renderAiRenameRuntime("error");

        expect(loading).toContain('data-control="ai-rename-preview"');
        expect(loading).toContain('data-state="loading"');
        expect(loading).toContain('data-slot="spinner"');
        expect(error).toContain('data-state="error"');
        expect(error).toContain('data-slot="alert"');
        expect(error).toContain("Try again or close this preview.");
        expectProductFilesToExclude(
            ["app/globals.css"],
            [/\.ai-rename-panel/, /\.airp-/],
        );
    });

    it("keeps AI rename legacy tokens out of product source", () => {
        const review = renderAiRenameRuntime("review");
        const productFiles = ["app", "components", "features", "lib"].flatMap(
            (directory) => collectProductFiles(path.join(ROOT, directory)),
        );
        const forbidden =
            /\.ai-rename-panel|\.airp-|data-airp-|\bAI_RENAME_[A-Z0-9_]+_CLASS\b|--ai-rename-[\w-]+/;
        const findings = productFiles.filter((filePath) =>
            forbidden.test(readFileSync(filePath, "utf8")),
        );

        expect(review).toContain('data-state="review"');
        expect(review).toContain("weekly-sync.m4a");
        expect(review).toContain("2026-07-30 Weekly Sync.m4a");
        expect(review).toContain("Apply title");
        expect(findings).toEqual([]);
    });

    it("keeps inline OKLCH tag swatches removed from the SOT catalog", () => {
        const html = renderTagManagerRuntime();

        expect(html).toContain('data-control="recording-tag-manager"');
        expect(html).toContain("Review");
        expect(html).not.toMatch(/style="[^"]*(?:oklch|color-mix)\(/);
        expectProductFilesToExclude(
            [
                "features/recordings/components/recording-tag-manager.tsx",
                "features/recordings/components/recording-tag-visuals.tsx",
            ],
            [/style=\{\{[^}]*oklch/, /oklch\([^)]*\)/],
        );
    });

    it("keeps auth on the SOT card structure", async () => {
        runtime.authAnonymous.mockResolvedValue({ data: {}, error: null });
        const html = renderToStaticMarkup(React.createElement(LoginForm));

        expect(html).toContain('data-slot="card"');
        expect(html).toContain('data-slot="input"');
        expect(html).toContain('<form aria-busy="false">');
        expect(html).toContain("发送登录链接");
        expect(html).toContain("仅本地使用");
        const local = capturedButton("仅本地使用");
        await (local.onClick as () => Promise<void>)();
        expect(runtime.authAnonymous).toHaveBeenCalledOnce();
        expect(runtime.navigate).toHaveBeenCalledWith(
            expect.any(Object),
            "/dashboard",
        );
        expectNoTestOnlyContract(html);
    });

    it("keeps onboarding on shadcn semantics", () => {
        const html = renderToStaticMarkup(React.createElement(OnboardingForm));

        expect(html).toContain("<main");
        expect(html).toContain('aria-labelledby="onboarding-title"');
        expect(html).toContain('aria-busy="true"');
        expect(html).toContain('aria-label="上手步骤"');
        expect(html).toContain('aria-current="step"');
        expect(html).toContain("<fieldset");
        expect(html).toContain('aria-label="来源选项"');
        expect(html).toContain("Plaud");
        expect(html).toContain("TicNote");
        expectNoTestOnlyContract(html);
        expectProductFilesToExclude(
            ["features/onboarding/components/onboarding-form.tsx"],
            ["DEFAULT_SOURCE_SWATCH_CLASS_NAMES", "OnboardingFieldRow"],
        );
    });

    it("keeps dashboard source, search, activity, list, and settings SOT entries", () => {
        const dashboard = renderDashboardRuntime();
        const empty = renderDashboardRuntime([]);

        expect(dashboard).toContain('data-surface="dashboard-workstation"');
        expect(dashboard).toContain('data-list="dashboard-sources"');
        expect(dashboard).toContain('data-control="dashboard-source-provider"');
        expect(dashboard).toContain('data-control="dashboard-search"');
        expect(dashboard).toContain('data-control="dashboard-activity"');
        expect(dashboard).toContain('data-control="dashboard-settings"');
        expect(dashboard).toContain(
            'data-list="dashboard-recording-list-scroll"',
        );
        expect(dashboard).toContain("Runtime review");
        expect(empty).toContain('data-panel="dashboard-detail-empty"');
        expectNoTestOnlyContract(dashboard);
        expectNoTestOnlyContract(empty);
    });

    it("keeps dashboard detail actions, AI rename, and retx states inline in SOT", () => {
        const dashboard = renderDashboardRuntime();
        const loading = renderTranscriptionPanelRuntime("running", {
            isTranscriptLoading: true,
        });
        const unavailable = renderTranscriptionPanelRuntime("unavailable");
        const running = renderTranscriptionPanelRuntime("running");
        const failed = renderTranscriptionPanelRuntime("failed");
        const completed = renderTranscriptionPanelRuntime("completed");
        const aiRename = renderAiRenameRuntime("loading");

        expect(dashboard).toContain('data-panel="dashboard-detail-header"');
        expect(dashboard).toContain('data-control="rename-recording-title"');
        expect(dashboard).toContain('data-control="ai-rename"');
        expect(dashboard).toContain('data-control="recording-more-actions"');
        expect(loading).toContain('aria-label="Loading transcript"');
        expect(loading).toContain('data-slot="skeleton"');
        expect(unavailable).toContain('data-retx-state="unavailable"');
        expect(unavailable).toContain('disabled=""');
        expect(running).toContain('data-retx-state="running"');
        expect(running).toContain('role="status"');
        expect(failed).toContain('data-retx-state="failed"');
        expect(failed).toContain('role="alert"');
        expect(completed).toContain('data-retx-state="completed"');
        expect(completed).toContain("Transcript refreshed");
        expect(aiRename).toContain('data-control="ai-rename-preview"');
        expect(aiRename).toContain('data-slot="spinner"');
    });

    it("keeps settings and recording detail surfaces on SOT state contracts", () => {
        const dataSources = renderRuntime(
            React.createElement(SettingsContent, {
                activeSection: "data-sources",
            }),
        );
        const appearance = renderRuntime(
            React.createElement(SettingsContent, {
                activeSection: "appearance",
            }),
        );
        const recording = renderRecordingRuntime();
        const login = renderToStaticMarkup(React.createElement(LoginForm));
        const tags = renderTagManagerRuntime();

        expect(dataSources).toContain('aria-label="Data source list"');
        expect(dataSources).toContain('aria-busy="true"');
        expect(dataSources).toContain('aria-live="polite"');
        expect(appearance).toContain('aria-busy="true"');
        expect(recording).toContain('data-shell="recording-workstation"');
        expect(recording).toContain('data-panel="workstation-sidebar"');
        expect(recording).toContain('data-panel="workstation-main"');
        expect(recording).toContain('data-control="recording-detail-back"');
        expect(recording).toContain("Runtime review");
        expect(recording).toContain('data-part="recording-source-record-tabs"');
        expect(login).toContain('data-slot="card"');
        expect(tags).toContain('data-control="recording-tag-manager"');
        for (const html of [dataSources, appearance, recording, login, tags]) {
            expectNoTestOnlyContract(html);
        }
    });
});
