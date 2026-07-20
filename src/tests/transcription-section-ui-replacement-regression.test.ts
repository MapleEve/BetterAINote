import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

type CapturedButtonProps = {
    "aria-busy"?: boolean;
    children?: ReactNode;
    disabled?: boolean;
    onClick?: () => void;
    title?: string;
};

const confirmMock = vi.hoisted(() => vi.fn(async () => false));
const clipboardMock = vi.hoisted(() => vi.fn(async () => undefined));
const toastMock = vi.hoisted(() => ({
    error: vi.fn(),
    success: vi.fn(),
}));

let capturedButtons: CapturedButtonProps[] = [];

async function loadTranscriptionSection() {
    vi.resetModules();
    const React = await import("react");

    vi.doMock("@/components/language-provider", () => ({
        useLanguage: () => ({
            language: "en-US",
            t: (key: string) =>
                ({
                    "transcription.localTitle": "Local transcript",
                    "transcription.localDescription":
                        "Review the local transcript.",
                    "transcription.outputTitle": "Transcript output",
                    "transcription.outputDescription":
                        "The transcript is ready to review.",
                    "transcription.copyTranscript": "Copy transcript",
                    "transcription.retranscribe": "Retranscribe",
                    "transcription.retranscribeConfirm":
                        "Retranscribe this recording",
                    "transcription.languagePrefix": "Language",
                    "transcription.sourcePrefix": "Source",
                    "transcription.words": "words",
                    "transcription.characters": "characters",
                    "transcription.noTranscript": "No transcript yet",
                    "transcription.noTranscriptDescription":
                        "Start a local transcription to see the transcript.",
                    "transcription.transcribe": "Transcribe locally",
                    "transcription.failedToLoad": "Transcription failed",
                    "transcription.transcriptCopied": "Transcript copied",
                    "transcription.copyTranscriptFailed": "Copy failed",
                    "transcription.retranscribeConfirmTitle":
                        "Retranscribe recording",
                    "transcription.retranscribeConfirmDescription":
                        "This replaces the current transcript.",
                    "transcription.retranscribeConfirmDetailTranscript":
                        "The transcript will be replaced.",
                    "transcription.retranscribeConfirmDetailSpeakers":
                        "Speaker labels will be reset.",
                    "transcription.retranscribeConfirmDetailSource":
                        "The source remains unchanged.",
                    "transcription.retranscribeConfirmLabel": "Retranscribe",
                    "common.cancel": "Cancel",
                    "common.copying": "Copying",
                    "speakerReview.title": "Speaker review",
                    "speakerReview.description":
                        "Review and label the speakers.",
                })[key] ?? key,
        }),
    }));
    vi.doMock("@/components/ui/button", () => ({
        Button: (props: CapturedButtonProps) => {
            capturedButtons.push(props);
            return React.createElement(
                "button",
                {
                    "aria-busy": props["aria-busy"],
                    disabled: props.disabled || undefined,
                    title: props.title,
                },
                props.children,
            );
        },
    }));
    vi.doMock("@/components/ui/confirm-dialog", () => ({
        useConfirmDialog: () => confirmMock,
    }));
    vi.doMock("@/features/recordings/components/speaker-label-editor", () => ({
        SpeakerLabelEditor: () =>
            React.createElement(
                "div",
                { "aria-label": "Speaker labels", role: "group" },
                "Speaker labels",
            ),
    }));
    vi.doMock("@/lib/platform/clipboard", () => ({
        writeBrowserClipboardText: clipboardMock,
    }));
    vi.doMock("sonner", () => ({ toast: toastMock }));

    const { renderToStaticMarkup } = await import("react-dom/server");
    const { TranscriptionSection } = await import(
        "@/features/recordings/components/transcription-section"
    );

    return { React, TranscriptionSection, renderToStaticMarkup };
}

afterEach(() => {
    capturedButtons = [];
    confirmMock.mockClear();
    clipboardMock.mockClear();
    toastMock.error.mockClear();
    toastMock.success.mockClear();
    vi.doUnmock("@/components/language-provider");
    vi.doUnmock("@/components/ui/button");
    vi.doUnmock("@/components/ui/confirm-dialog");
    vi.doUnmock("@/features/recordings/components/speaker-label-editor");
    vi.doUnmock("@/lib/platform/clipboard");
    vi.doUnmock("sonner");
    vi.resetModules();
});

describe("transcription section semantic UI regression", () => {
    it("renders transcript output, metadata, and speaker review semantically", async () => {
        const { React, TranscriptionSection, renderToStaticMarkup } =
            await loadTranscriptionSection();

        const html = renderToStaticMarkup(
            React.createElement(TranscriptionSection, {
                recordingId: "recording-1",
                initialLanguage: "en",
                initialSpeakerMap: { "Speaker 1": "Alice" },
                initialTranscription: "Speaker 1 shared the weekly update.",
                initialType: "private",
            }),
        );

        expect(html).toMatch(
            /<div[^>]*role="region"[^>]*aria-labelledby="recording-transcription-title"/,
        );
        expect(html).toContain("Local transcript");
        expect(html).toContain("Alice shared the weekly update.");
        expect(html).toContain("Language: en");
        expect(html).toContain("Source: private");
        expect(html).toContain("6 words");
        expect(html).toContain("Speaker review");
        expect(html).toContain('role="group"');
        expect(html).toContain('aria-label="Speaker labels"');
        expect(html).toMatch(/<button[^>]*>.*Copy transcript.*<\/button>/);
        expect(html).toMatch(/<button[^>]*>.*Retranscribe.*<\/button>/);
    });

    it("keeps the empty branch readable and disables unavailable transcription", async () => {
        const { React, TranscriptionSection, renderToStaticMarkup } =
            await loadTranscriptionSection();

        const html = renderToStaticMarkup(
            React.createElement(TranscriptionSection, {
                canTranscribe: false,
                recordingId: "recording-2",
                showSpeakerReview: false,
                transcribeUnavailableReason: "Audio is unavailable locally.",
            }),
        );

        expect(html).toContain("No transcript yet");
        expect(html).toContain(
            "Start a local transcription to see the transcript.",
        );
        expect(html).toContain("Audio is unavailable locally.");
        expect(html).toMatch(
            /<button[^>]*disabled=""[^>]*title="Audio is unavailable locally."[^>]*>.*Transcribe locally.*<\/button>/,
        );
        expect(html).not.toContain("Speaker review");
    });

    it("preserves copy and retranscribe action contracts", async () => {
        const { React, TranscriptionSection, renderToStaticMarkup } =
            await loadTranscriptionSection();

        renderToStaticMarkup(
            React.createElement(TranscriptionSection, {
                recordingId: "recording-3",
                initialTranscription: "A short transcript.",
                showSpeakerReview: false,
            }),
        );

        expect(capturedButtons).toHaveLength(2);
        const copyButton = capturedButtons.find(
            (button) =>
                button.children && String(button.children).includes("Copy"),
        );
        const retranscribeButton = capturedButtons.find(
            (button) =>
                button.children &&
                String(button.children).includes("Retranscribe"),
        );

        expect(copyButton?.onClick).toBeDefined();
        expect(retranscribeButton?.onClick).toBeDefined();

        await copyButton?.onClick?.();
        await retranscribeButton?.onClick?.();

        expect(clipboardMock).toHaveBeenCalledWith("A short transcript.");
        expect(confirmMock).toHaveBeenCalledWith(
            expect.objectContaining({
                confirmLabel: "Retranscribe",
                title: "Retranscribe recording",
            }),
        );
    });
});
