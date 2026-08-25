import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LanguageProvider } from "@/components/language-provider";
import {
    getSegmentedTabsKeyboardActivationValue,
    SegmentedTabs,
} from "@/components/ui/segmented-tabs";
import {
    TranscriptionPanel,
    type TranscriptionPanelTab,
} from "@/features/dashboard/components/transcription-panel";

const items = [
    { value: "transcript", label: "Transcript" },
    { value: "speakers", label: "Speakers" },
    { value: "source", label: "Source" },
] as const;

function openingTagWith(markup: string, marker: string) {
    const markerIndex = markup.indexOf(marker);
    expect(markerIndex).toBeGreaterThanOrEqual(0);
    const openingTagStart = markup.lastIndexOf("<", markerIndex);
    const openingTagEnd = markup.indexOf(">", markerIndex);
    expect(openingTagStart).toBeGreaterThanOrEqual(0);
    expect(openingTagEnd).toBeGreaterThan(markerIndex);
    return markup.slice(openingTagStart, openingTagEnd + 1);
}

function renderDetailTabs(
    activeTab: TranscriptionPanelTab,
    disabledTabs: readonly TranscriptionPanelTab[] = [],
) {
    const noop = () => {};
    return renderToStaticMarkup(
        React.createElement(
            LanguageProvider,
            null,
            React.createElement(TranscriptionPanel, {
                recording: { id: "recording-1", audioUrl: "/audio/demo.mp3" },
                activeTab,
                onActiveTabChange: noop,
                disabledTabs,
                turns: [
                    {
                        id: "turn-1",
                        text: "Runtime transcript",
                        speakerName: "Speaker 1",
                    },
                ],
                isTranscriptLoading: false,
                onRetryTranscript: noop,
                transcriptLanguage: "zh",
                localCopyState: "ready",
                localCopyFeedback: null,
                onCopyLocal: noop,
                retranscription: {
                    state: "idle",
                    title: "Retranscribe",
                    description: "Keep the current transcript visible.",
                    onRequest: noop,
                    onRetry: noop,
                    onDismiss: noop,
                },
                speakers: [
                    {
                        id: "speaker-1",
                        rawLabel: "Speaker 1",
                        speakerName: "Speaker 1",
                        text: "Runtime transcript",
                    },
                ],
                speakerMerge: {
                    state: "idle",
                    onMerge: noop,
                    onRetry: noop,
                },
                sourceActions: React.createElement(
                    "button",
                    { type: "button" },
                    "Source action",
                ),
                sourcePane: React.createElement("div", null, "Source details"),
            }),
        ),
    );
}

describe("getSegmentedTabsKeyboardActivationValue", () => {
    it("activates the tab reached by horizontal arrow navigation", () => {
        expect(
            getSegmentedTabsKeyboardActivationValue({
                items,
                key: "ArrowRight",
                orientation: "horizontal",
                value: "transcript",
            }),
        ).toBe("speakers");
        expect(
            getSegmentedTabsKeyboardActivationValue({
                items,
                key: "ArrowLeft",
                orientation: "horizontal",
                value: "speakers",
            }),
        ).toBe("transcript");
    });

    it("skips disabled tabs while preserving wrapping, home, and end behavior", () => {
        const itemsWithDisabledTab = [
            items[0],
            { value: "speakers", label: "Speakers", disabled: true },
            items[2],
        ] as const;

        expect(
            getSegmentedTabsKeyboardActivationValue({
                items: itemsWithDisabledTab,
                key: "ArrowRight",
                value: "transcript",
            }),
        ).toBe("source");
        expect(
            getSegmentedTabsKeyboardActivationValue({
                items,
                key: "ArrowRight",
                loop: true,
                value: "source",
            }),
        ).toBe("transcript");
        expect(
            getSegmentedTabsKeyboardActivationValue({
                items,
                key: "ArrowRight",
                loop: false,
                value: "source",
            }),
        ).toBeNull();
        expect(
            getSegmentedTabsKeyboardActivationValue({
                items,
                key: "Home",
                value: "source",
            }),
        ).toBe("transcript");
        expect(
            getSegmentedTabsKeyboardActivationValue({
                items,
                key: "End",
                value: "transcript",
            }),
        ).toBe("source");
    });

    it("preserves orientation and right-to-left navigation semantics", () => {
        expect(
            getSegmentedTabsKeyboardActivationValue({
                items,
                key: "ArrowDown",
                orientation: "horizontal",
                value: "transcript",
            }),
        ).toBeNull();
        expect(
            getSegmentedTabsKeyboardActivationValue({
                items,
                key: "ArrowDown",
                orientation: "vertical",
                value: "transcript",
            }),
        ).toBe("speakers");
        expect(
            getSegmentedTabsKeyboardActivationValue({
                dir: "rtl",
                items,
                key: "ArrowLeft",
                orientation: "horizontal",
                value: "transcript",
            }),
        ).toBe("speakers");
    });
});

describe("dashboard SegmentedTabs consumer", () => {
    it("renders controlled detail tabs with matching accessible panels", () => {
        const transcriptMarkup = renderDetailTabs("transcript", ["source"]);
        const transcriptTablist = openingTagWith(
            transcriptMarkup,
            'aria-label="详情标签"',
        );
        const transcriptTab = openingTagWith(
            transcriptMarkup,
            'data-tab-key="transcript"',
        );
        const speakersTab = openingTagWith(
            transcriptMarkup,
            'data-tab-key="speakers"',
        );
        const sourceTab = openingTagWith(
            transcriptMarkup,
            'data-tab-key="source-report"',
        );
        const transcriptPane = openingTagWith(
            transcriptMarkup,
            'id="dashboard-transcription-pane-transcript"',
        );
        const speakersPane = openingTagWith(
            transcriptMarkup,
            'id="dashboard-transcription-pane-speakers"',
        );

        expect(transcriptTablist).toContain('role="tablist"');
        expect(transcriptTab).toContain('role="tab"');
        expect(transcriptTab).toContain('aria-selected="true"');
        expect(transcriptTab).toContain(
            'aria-controls="dashboard-transcription-pane-transcript"',
        );
        expect(speakersTab).toContain('aria-selected="false"');
        expect(sourceTab).toContain('aria-disabled="true"');
        expect(sourceTab).toContain("disabled");
        expect(transcriptPane).not.toContain(' hidden=""');
        expect(transcriptPane).toContain(
            'aria-labelledby="dashboard-transcription-tab-transcript"',
        );
        expect(speakersPane).toContain(' hidden=""');

        const speakersMarkup = renderDetailTabs("speakers");
        const selectedSpeakersTab = openingTagWith(
            speakersMarkup,
            'data-tab-key="speakers"',
        );
        const selectedSpeakersPane = openingTagWith(
            speakersMarkup,
            'id="dashboard-transcription-pane-speakers"',
        );

        expect(selectedSpeakersTab).toContain('aria-selected="true"');
        expect(selectedSpeakersPane).not.toContain(' hidden=""');
    });

    it("renders the primitive controlled value without invoking change during SSR", () => {
        let changes = 0;
        const markup = renderToStaticMarkup(
            React.createElement(SegmentedTabs, {
                "aria-label": "Runtime tabs",
                items: [...items],
                value: "speakers",
                onValueChange: () => {
                    changes += 1;
                },
            }),
        );
        const selectedTab = openingTagWith(markup, 'data-tab-key="speakers"');

        expect(selectedTab).toContain('aria-selected="true"');
        expect(changes).toBe(0);
    });
});
