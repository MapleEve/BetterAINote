import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { serializeRecordingDetailTranscriptionJob } from "@/server/modules/recordings/serialize";

const ROOT = path.join(process.cwd(), "src");

function readSource(relativePath: string) {
    return readFileSync(path.join(ROOT, relativePath), "utf8");
}

function extractCardSlice(source: string, marker: string) {
    const markerIndex = source.indexOf(marker);
    expect(markerIndex).toBeGreaterThanOrEqual(0);
    const start = source.lastIndexOf("<Card", markerIndex);
    const end = source.indexOf("</Card>", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    return source.slice(start, end + "</Card>".length);
}

function extractBoundedSlice(
    source: string,
    startMarker: string,
    endMarker: string,
) {
    const start = source.indexOf(startMarker);
    expect(start).toBeGreaterThanOrEqual(0);
    const end = source.indexOf(endMarker, start);
    expect(end).toBeGreaterThan(start);
    return source.slice(start, end);
}

const OLD_UI_CONTRACT_RE =
    /uikit-|glass-surface|glass-control|bg-muted|text-muted-foreground|<LibrarySearch[\s/>]|<SourceFilterStackStrip[\s/>]|\.\/components\/library-search|\.\/components\/source-filter-stack-strip/;

const DASHBOARD_WORKSTATION_LEGACY_CONTROL_RE =
    /className=["']btn(?:\s+(?:ghost|primary|glass))?\b|track-fill|track-thumb|sk _is|_is-/;

describe("recording detail copy and title action UI regressions", () => {
    it("redacts failed transcription job errors before they reach recording detail UI", () => {
        expect(
            serializeRecordingDetailTranscriptionJob({
                recordingId: "rec-1",
                status: "failed",
                remoteStatus: "failed",
                lastError:
                    "upstream 500 token=secret-token cookie=session recording id rec-raw",
                updatedAt: new Date("2026-05-31T00:00:00.000Z"),
            }),
        ).toEqual({
            status: "failed",
            remoteStatus: "failed",
            lastError: "Transcription failed. Check server logs for details.",
        });
    });

    it("keeps browser clipboard writes behind the platform helper with a non-secure fallback", () => {
        const clipboard = readSource("lib/platform/clipboard.ts");

        expect(clipboard).toContain("navigator.clipboard?.writeText");
        expect(clipboard).toContain('document.execCommand("copy")');
        expect(clipboard).toContain("Clipboard text is empty");
    });

    it("keeps transcript copy actions disabled when no display text is available", () => {
        const detailTranscript = readSource(
            "features/recordings/components/transcription-section.tsx",
        );
        const dashboardTranscript = readSource(
            "features/dashboard/workstation.tsx",
        );

        expect(detailTranscript).toContain("handleCopyTranscript");
        expect(detailTranscript).toContain(
            "writeBrowserClipboardText(displayText)",
        );
        expect(detailTranscript).toContain("isCopyingTranscript");
        expect(detailTranscript).toContain("!displayText.trim()");
        expect(detailTranscript).toContain("transcription.copyTranscript");
        expect(detailTranscript).toContain(
            "transcription.copyTranscriptFailed",
        );
        expect(detailTranscript).toContain(
            'data-sot-panel="recording-transcription"',
        );
        expect(detailTranscript).toContain(
            'data-sot-control="copy-local-transcript"',
        );
        expect(detailTranscript).toContain(
            'data-sot-control="retranscribe-local"',
        );
        expect(detailTranscript).toContain(
            'data-sot-control="start-local-transcription"',
        );
        expect(detailTranscript).toContain('data-icon="inline-start"');
        for (const legacyClass of [
            'className="transcript t-pane"',
            'className="transcript-head"',
            'className="transcript-body"',
            'className="sr-section"',
            'className="sr-section-head"',
            'className="sr-section-sub"',
            'className="empty-hint"',
            'className="eh-t"',
            'className="eh-h"',
            'className="turn"',
            'className="speaker"',
            'className="ts"',
        ]) {
            expect(detailTranscript).not.toContain(legacyClass);
        }

        expect(dashboardTranscript).toContain(
            'data-sot-panel="dashboard-retranscription"',
        );
        expect(dashboardTranscript).toContain(
            "data-retx-state={dashboardRetxState}",
        );
        expect(dashboardTranscript).toContain('aria-label="详情标签"');
        expect(dashboardTranscript).toContain(
            'hidden={detailTab !== "transcript"}',
        );
        expect(dashboardTranscript).toContain(
            '{ value: "transcript", label: "转写" }',
        );
        expect(dashboardTranscript).toContain('tabKey: "source-report"');
    });

    it("keeps source report copy states explicit without dumping raw detail payloads", () => {
        const sourceReport = readSource(
            "features/recordings/components/source-report-panel.tsx",
        );
        const sourceReportButtonControls = [
            'data-sot-control="copy-source-transcript"',
            'data-sot-control="copy-source-report"',
            'data-sot-control="open-source-record"',
            'data-sot-control="repull-source"',
        ];
        const sourceReportCopyControls = [
            'data-sot-control="copy-source-transcript"',
            'data-sot-control="copy-source-report"',
        ];

        expect(sourceReport).toContain("handleCopySourceTranscript");
        expect(sourceReport).toContain("handleCopySourceReport");
        expect(sourceReport).toContain("sourceReport.copySourceTranscript");
        expect(sourceReport).toContain("sourceReport.copySourceReport");
        expect(sourceReport).toContain("sourceReport.missingSourceTranscript");
        expect(sourceReport).toContain("sourceReport.missingSourceReport");
        expect(sourceReport).toContain("buildSourceTranscriptCopyText");
        expect(sourceReport).toContain("SourceReportAvailabilitySnapshot");
        expect(sourceReport).toContain("onAvailabilityChange");
        expect(sourceReport).toContain("transcriptAvailable");
        expect(sourceReport).toContain("reportAvailable");
        expect(sourceReport).toContain(
            'data-sot-panel="recording-source-report"',
        );
        expect(sourceReport).toContain(
            'data-sot-panel="recording-source-report-state"',
        );
        expect(sourceReport).toContain('sotState="loading"');
        expect(sourceReport).toContain('state="loaded"');
        expect(sourceReport).toContain("subState={sourceReportSubState}");
        expect(sourceReport).toContain("data-sot-source-report-section-title");
        expect(sourceReport).toContain('title="来源转写"');
        expect(sourceReport).toContain('title="来源信息"');
        expect(sourceReport).toContain(
            'data-sot-control="copy-source-transcript"',
        );
        expect(sourceReport).toContain('data-sot-control="copy-source-report"');
        expect(sourceReport).toContain(
            'aria-busy={copyingKey === "source-transcript"}',
        );
        expect(sourceReport).toContain(
            'aria-busy={copyingKey === "source-report"}',
        );
        expect(sourceReport).toContain("activeReportRequestRef");
        expect(sourceReport).toContain("AbortController");
        expect(sourceReport).toContain("reportRequestIdRef");
        expect(sourceReport).toContain("sourceReportDetailText");
        expect(sourceReport).toContain("sourceReportDisplaySegments");
        expect(sourceReport).toContain(
            'import { Button } from "@/components/ui/button";',
        );
        expect(sourceReport).toContain(
            'import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";',
        );
        expect(sourceReport).toContain(
            'import { Skeleton } from "@/components/ui/skeleton";',
        );
        expect(sourceReport).toContain(
            'data-sot-part="source-report-segment-skeleton"',
        );
        expect(sourceReport).toContain("data-sot-source-report-state");
        expect(sourceReport).toContain("data-sot-source-report-empty");
        expect(sourceReport).toContain("data-sot-source-report-section");
        expect(sourceReport).toContain("data-sot-source-report-segment");
        expect(sourceReport).toContain("data-sot-source-report-meta");
        expect(sourceReport).not.toContain('className="sr-state"');
        expect(sourceReport).not.toContain('className="sr-empty"');
        expect(sourceReport).not.toContain('className="sr-section"');
        expect(sourceReport).not.toContain('className="sr-seg"');
        expect(sourceReport).not.toContain('className="sr-meta"');
        for (const control of sourceReportButtonControls) {
            const controlIndex = sourceReport.indexOf(control);
            expect(controlIndex).toBeGreaterThanOrEqual(0);
            const controlSource = sourceReport.slice(
                Math.max(0, controlIndex - 700),
                controlIndex + 320,
            );
            expect(controlSource).toContain("<Button");
            expect(controlSource).toContain('variant="ghost"');
            expect(controlSource).toContain('size="sm"');
            expect(controlSource).toContain("data-sot-control=");
            expect(controlSource).not.toContain("copy-btn");
        }
        for (const control of sourceReportCopyControls) {
            const controlIndex = sourceReport.indexOf(control);
            expect(controlIndex).toBeGreaterThanOrEqual(0);
            const controlSource = sourceReport.slice(
                Math.max(0, controlIndex - 320),
                controlIndex + 320,
            );
            expect(controlSource).toContain("data-copy=");
            expect(controlSource).toContain("data-copy-state=");
        }
        expect(sourceReport).not.toContain('className="btn ghost btn-sm"');
        expect(sourceReport).not.toContain(
            'className="btn ghost btn-sm copy-btn"',
        );
        expect(sourceReport).not.toContain('className="copy-btn"');
        expect(sourceReport).toContain('data-icon="inline-start"');
        expect(sourceReport).not.toMatch(
            /\bCSSProperties\b|SOURCE_REPORT_LOADING_SKELETON_STYLES|style=\{|sk _is|_is-/,
        );
        expect(sourceReport).not.toContain("JSON.stringify(data.detail");
    });

    it("keeps standalone recording detail on the SOT shell with panel-scoped copy actions", () => {
        const detailWorkstation = readSource(
            "features/recordings/workstation.tsx",
        );
        const globals = readSource("app/globals.css");
        const badge = readSource("components/ui/badge.tsx");
        const card = readSource("components/ui/card.tsx");
        const input = readSource("components/ui/input.tsx");
        const listPanelIndex = detailWorkstation.indexOf(
            'data-sot-panel="recording-detail-list"',
        );
        const listPanelStart = detailWorkstation.lastIndexOf(
            "<Card",
            listPanelIndex,
        );
        const listPanelEnd = detailWorkstation.indexOf(
            "</Card>",
            listPanelStart,
        );
        const listPanel = detailWorkstation.slice(
            listPanelStart,
            listPanelEnd + "</Card>".length,
        );
        const headerPanelIndex = detailWorkstation.indexOf(
            'data-sot-panel="recording-detail-header"',
        );
        const headerStart = detailWorkstation.lastIndexOf(
            "<CardHeader",
            headerPanelIndex,
        );
        const headerEnd = detailWorkstation.indexOf(
            "</CardHeader>",
            headerStart,
        );
        const detailHeader = detailWorkstation.slice(
            headerStart,
            headerEnd + "</CardHeader>".length,
        );
        const legacyHeaderClassNamePattern =
            /className=(?:"[^"]*\b(?:rec-head|rec-h2|rec-h2-local|rec-h2-input|rec-h2-status|rh-norm|rh-edit|ai-rename-anchor|more-anchor)\b[^"]*"|\{[^}]*\b(?:rec-head|rec-h2|rec-h2-local|rec-h2-input|rec-h2-status|rh-norm|rh-edit|ai-rename-anchor|more-anchor)\b[^}]*\})/;

        expect(detailWorkstation).toContain(
            'data-sot-surface="recording-workstation"',
        );
        expect(detailWorkstation).toContain(
            'data-sot-state={hydrated ? "ready" : "loading"}',
        );
        expect(detailWorkstation).toContain(
            'className="sidebar glass glass-strong"',
        );
        expect(detailWorkstation).toContain('className="topbar"');
        expect(detailWorkstation).toContain('className="workspace"');
        expect(detailWorkstation).toContain(
            'import { Badge } from "@/components/ui/badge";',
        );
        expect(detailWorkstation).toContain(
            'import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";',
        );
        expect(detailWorkstation).toContain(
            'import { Input } from "@/components/ui/input";',
        );
        expect(badge).toContain('data-slot="badge"');
        expect(card).toContain('data-slot="card-header"');
        expect(card).toContain('data-slot="card-title"');
        expect(input).toContain('data-slot="input"');
        expect(listPanelIndex).toBeGreaterThanOrEqual(0);
        expect(listPanelStart).toBeGreaterThanOrEqual(0);
        expect(listPanelEnd).toBeGreaterThan(listPanelStart);
        expect(listPanel).toContain("<Card");
        expect(listPanel).toContain("hasNoPadding");
        expect(listPanel).toContain("<CardHeader");
        expect(listPanel).toContain("<CardTitle");
        expect(listPanel).toContain("<CardContent");
        expect(listPanel).toContain('data-sot-panel="recording-detail-list"');
        expect(listPanel).toContain(
            'data-sot-part="recording-detail-list-header"',
        );
        expect(listPanel).toContain(
            'data-sot-part="recording-detail-list-title"',
        );
        expect(listPanel).toContain(
            'data-sot-part="recording-detail-list-content"',
        );
        expect(listPanel).toContain(
            'data-sot-list="recording-detail-list-rows"',
        );
        expect(listPanel).toContain(
            'data-sot-item="recording-detail-list-row"',
        );
        expect(listPanel).toContain('data-sot-state="selected"');
        expect(listPanel).toContain(
            'data-sot-part="recording-detail-list-row-body"',
        );
        expect(listPanel).toContain(
            'data-sot-part="recording-detail-list-row-title"',
        );
        expect(listPanel).toContain(
            'data-sot-part="recording-detail-list-row-meta"',
        );
        expect(listPanel).toContain(
            'data-sot-part="recording-detail-list-row-duration"',
        );
        expect(listPanel).toContain("<SotPlayerSourceTag");
        expect(listPanel).toContain("<SotPlayerStatusBadge");
        for (const legacyClass of [
            'className="panel"',
            'className="list-header"',
            'className="lh-titlebar"',
            'className="lh-title"',
            'className="real-list"',
            'className="row active"',
            'className="body"',
            'className="title"',
            'className="meta"',
            'className="dur mono"',
        ]) {
            expect(listPanel).not.toContain(legacyClass);
        }
        for (const selector of [
            '[data-sot-panel="recording-detail-list"][data-slot="card"]',
            '[data-sot-part="recording-detail-list-header"][data-slot="card-header"]',
            '[data-sot-part="recording-detail-list-title"][data-slot="card-title"]',
            '[data-sot-part="recording-detail-list-content"][data-slot="card-content"]',
        ]) {
            expect(globals).toContain(selector);
        }
        expect(headerPanelIndex).toBeGreaterThanOrEqual(0);
        expect(headerStart).toBeGreaterThanOrEqual(0);
        expect(headerEnd).toBeGreaterThan(headerStart);
        expect(detailHeader).toContain("<CardHeader");
        expect(detailHeader).toContain("<CardTitle");
        expect(detailHeader).toContain("<Badge");
        expect(detailHeader).toContain(
            'data-sot-panel="recording-detail-header"',
        );
        expect(detailHeader).toContain('data-sot-part="detail-header-title"');
        expect(detailHeader).toContain(
            'data-sot-part="detail-header-title-input"',
        );
        expect(detailHeader).toContain(
            'data-sot-part="detail-header-title-status"',
        );
        expect(detailHeader).toContain('data-sot-part="detail-header-action"');
        expect(detailHeader).toContain("data-rh-title");
        expect(detailHeader).toContain("data-rh-input");
        expect(detailHeader).toContain("data-rh-status");
        expect(detailHeader).toContain("data-rh-edit-start");
        expect(detailHeader).toContain("data-rh-edit-save");
        expect(detailHeader).toContain("data-rh-edit-cancel");
        expect(detailHeader).toContain("data-rh-ai-anchor");
        expect(detailHeader).toContain("data-rh-ai-trigger");
        expect(detailHeader).toContain('data-sot-control="ai-rename"');
        expect(detailHeader).not.toMatch(legacyHeaderClassNamePattern);
        const metadataPanelIndex = detailWorkstation.indexOf(
            'data-sot-panel="recording-detail-metadata"',
        );
        const metadataStart = detailWorkstation.lastIndexOf(
            "<Card",
            metadataPanelIndex,
        );
        const metadataEnd = detailWorkstation.indexOf("</Card>", metadataStart);
        const metadataPanel = detailWorkstation.slice(
            metadataStart,
            metadataEnd + "</Card>".length,
        );
        const sourceRecordPanelIndex = detailWorkstation.indexOf(
            'data-sot-panel="recording-source-record"',
        );
        const sourceRecordStart = detailWorkstation.lastIndexOf(
            "<Card",
            sourceRecordPanelIndex,
        );
        const sourceRecordEnd = detailWorkstation.indexOf(
            "</Card>",
            sourceRecordStart,
        );
        const sourceRecordPanel = detailWorkstation.slice(
            sourceRecordStart,
            sourceRecordEnd + "</Card>".length,
        );

        expect(metadataPanelIndex).toBeGreaterThanOrEqual(0);
        expect(metadataStart).toBeGreaterThanOrEqual(0);
        expect(metadataEnd).toBeGreaterThan(metadataStart);
        expect(metadataPanel).toContain("<Card");
        expect(metadataPanel).toContain("<CardHeader");
        expect(metadataPanel).toContain("<CardTitle");
        expect(metadataPanel).toContain("<CardContent");
        expect(metadataPanel).toContain(
            'data-sot-panel="recording-detail-metadata"',
        );
        expect(metadataPanel).toContain(
            'data-sot-part="recording-detail-metadata-header"',
        );
        expect(metadataPanel).toContain(
            'data-sot-part="recording-detail-metadata-title"',
        );
        expect(metadataPanel).toContain(
            'data-sot-part="recording-detail-metadata-body"',
        );
        expect(sourceRecordPanelIndex).toBeGreaterThanOrEqual(0);
        expect(sourceRecordStart).toBeGreaterThanOrEqual(0);
        expect(sourceRecordEnd).toBeGreaterThan(sourceRecordStart);
        expect(sourceRecordPanel).toContain("<Card");
        expect(sourceRecordPanel).toContain("<CardHeader");
        expect(sourceRecordPanel).toContain("<CardTitle");
        expect(sourceRecordPanel).toContain("<CardContent");
        expect(sourceRecordPanel).toContain(
            'data-sot-panel="recording-source-record"',
        );
        for (const part of [
            "recording-source-record-header",
            "recording-source-record-title",
            "recording-source-record-actions",
            "recording-source-record-body",
            "recording-source-record-tabs",
            "recording-source-record-hint",
        ]) {
            expect(sourceRecordPanel).toContain(`data-sot-part="${part}"`);
        }
        for (const legacyClass of [
            'className="panel"',
            'className="transcript"',
            'className="transcript-head"',
            'className="rec-h2"',
            'className="transcript-body"',
        ]) {
            expect(metadataPanel).not.toContain(legacyClass);
            expect(sourceRecordPanel).not.toContain(legacyClass);
        }
        expect(detailWorkstation).toContain("handleCopyLocalTranscript");
        expect(detailWorkstation).toContain("handleCopyRawTranscript");
        expect(detailWorkstation).toContain("/transcript/raw");
        expect(detailWorkstation).toContain("RawTranscriptCopyPayload");
        expect(detailWorkstation).toContain("localTranscriptCopyText");
        expect(detailWorkstation).toContain("setSourceReportAvailability");
        expect(detailWorkstation).toContain("applySpeakerMap");
        expect(detailWorkstation).toContain("<SourceReportPanel");
        expect(detailWorkstation).toContain("onAvailabilityChange");
        expect(detailWorkstation).toContain("autoLoad");
        expect(detailWorkstation).toContain(
            'data-sot-part="recording-source-record-actions"',
        );
        expect(detailWorkstation).not.toContain('className="t-actions"');
        expect(detailWorkstation).toMatch(
            /aria-busy=\{\s*copyingAction ===\s*"local"\s*\}/,
        );
        expect(detailWorkstation).toMatch(
            /aria-busy=\{\s*copyingAction ===\s*"raw-transcript"\s*\}/,
        );
        expect(detailWorkstation).not.toContain("handleCopySourceMaterial");
        expect(detailWorkstation).not.toContain(
            "buildSourceTranscriptCopyText",
        );
        expect(detailWorkstation).not.toContain("sourceTranscriptCopyDisabled");
        expect(detailWorkstation).not.toContain("sourceReportCopyDisabled");
        expect(detailWorkstation).not.toContain(
            'aria-busy={copyingAction === "source-transcript"}',
        );
        expect(detailWorkstation).not.toContain(
            'aria-busy={copyingAction === "source-report"}',
        );
        expect(detailWorkstation).not.toContain("container mx-auto max-w-4xl");
        expect(detailWorkstation).not.toContain("recording-detail-actions");
        expect(detailWorkstation).not.toContain(">←<");
        expect(detailWorkstation).toContain("data-rename-mode=");
        expect(detailWorkstation).toContain(
            'localDeleteAvailable ? "true" : "false"',
        );
        expect(detailWorkstation).toContain("data-more-anchor");
        expect(detailWorkstation).toContain("data-more-trigger");
        expect(detailWorkstation).toContain(
            'from "@/components/ui/dropdown-menu"',
        );
        expect(detailWorkstation).toContain("<DropdownMenu");
        expect(detailWorkstation).toContain("open={moreOpen}");
        expect(detailWorkstation).toContain("<DropdownMenuTrigger asChild>");
        expect(detailWorkstation).toContain("<DropdownMenuContent");
        expect(detailWorkstation).toContain("data-more-menu");
        expect(detailWorkstation).toContain(
            'data-sot-menu="recording-more-actions"',
        );
        expect(detailWorkstation).toContain('data-sot-menu-item="rename"');
        expect(detailWorkstation).toContain('data-sot-menu-item="ai-rename"');
        expect(detailWorkstation).toContain(
            'data-sot-menu-item="retranscribe"',
        );
        expect(detailWorkstation).toContain(
            'data-sot-menu-item="delete-local"',
        );
        expect(detailWorkstation).toContain('data-sot-tone="danger"');
        expect(detailWorkstation).toContain("<DropdownMenuSeparator");
        expect(detailWorkstation).toContain('data-sot-menu-separator="delete"');
        expect(detailWorkstation).toContain("data-sot-menu-hint");
        expect(detailWorkstation).not.toContain('className="more-menu"');
        expect(detailWorkstation).not.toContain('className="more-menu-item"');
        expect(detailWorkstation).not.toContain('className="more-menu-sep"');
        expect(detailWorkstation).not.toContain('className="more-menu-hint"');
        expect(detailWorkstation).toContain("handleMoreRetranscribe");
        expect(detailWorkstation).toContain("handleDeleteLocalRecording");
        expect(detailWorkstation).toContain("SotPlayerSourceTag");
        expect(detailWorkstation).toContain("SotPlayerStatusBadge");
        expect(detailWorkstation).toContain("<SotPlayerSourceTag");
        expect(detailWorkstation).toContain("<SotPlayerStatusBadge");
        expect(detailWorkstation).not.toContain('className="src-tag"');
        expect(detailWorkstation).not.toContain('className="b ok"');
        expect(detailWorkstation).not.toMatch(OLD_UI_CONTRACT_RE);

        const sourceLabelMarker = "{sourceLabel}";
        const sourceBlockMarker = '{t("recording.source")}';
        const sourceBlockMarkerIndex =
            detailWorkstation.indexOf(sourceBlockMarker);
        const sourceLabelMarkerIndex = detailWorkstation.indexOf(
            sourceLabelMarker,
            sourceBlockMarkerIndex,
        );
        expect(sourceBlockMarkerIndex).toBeGreaterThan(-1);
        expect(sourceLabelMarkerIndex).toBeGreaterThan(sourceBlockMarkerIndex);
        expect(detailWorkstation).toContain("getSourceProviderLabel(");
        expect(detailWorkstation).toContain(sourceLabelMarker);

        const deviceLabelMarker = '{t("recording.device")}';
        const deviceValueMarker = "{recording.providerDeviceId}";
        expect(detailWorkstation).toContain(deviceLabelMarker);
        expect(detailWorkstation).toContain(deviceValueMarker);
    });

    it("keeps dashboard transcription panel on SOT retx and detail tabs", () => {
        const dashboardTranscript = readSource(
            "features/dashboard/workstation.tsx",
        );
        const badge = readSource("components/ui/badge.tsx");
        const card = readSource("components/ui/card.tsx");
        const input = readSource("components/ui/input.tsx");
        const dashboardTranscriptShell = extractCardSlice(
            dashboardTranscript,
            'data-sot-panel="dashboard-transcript-shell"',
        );
        const dashboardTranscriptLoadingTurn = extractBoundedSlice(
            dashboardTranscript,
            "key={`transcript-skeleton:",
            ") : turns.length ? (",
        );
        const dashboardTranscriptReadyTurn = extractBoundedSlice(
            dashboardTranscript,
            "turns.map((turn, index) => {",
            ") : (",
        );
        const headerPanelIndex = dashboardTranscript.indexOf(
            'data-sot-panel="dashboard-detail-header"',
        );
        const headerStart = dashboardTranscript.lastIndexOf(
            "<CardHeader",
            headerPanelIndex,
        );
        const headerEnd = dashboardTranscript.indexOf(
            "</CardHeader>",
            headerStart,
        );
        const dashboardDetailHeader = dashboardTranscript.slice(
            headerStart,
            headerEnd + "</CardHeader>".length,
        );
        const legacyHeaderClassNamePattern =
            /className=(?:"[^"]*\b(?:rec-head|rec-h2|rec-h2-local|rec-h2-input|rec-h2-status|rh-norm|rh-edit|ai-rename-anchor|more-anchor)\b[^"]*"|\{[^}]*\b(?:rec-head|rec-h2|rec-h2-local|rec-h2-input|rec-h2-status|rh-norm|rh-edit|ai-rename-anchor|more-anchor)\b[^}]*\})/;

        expect(headerPanelIndex).toBeGreaterThanOrEqual(0);
        expect(headerStart).toBeGreaterThanOrEqual(0);
        expect(headerEnd).toBeGreaterThan(headerStart);
        expect(dashboardTranscript).toContain(
            'import { Badge } from "@/components/ui/badge";',
        );
        expect(dashboardTranscript).toContain(
            'import { Input } from "@/components/ui/input";',
        );
        expect(badge).toContain('data-slot="badge"');
        expect(card).toContain('data-slot="card-header"');
        expect(input).toContain('data-slot="input"');
        expect(dashboardDetailHeader).toContain(
            'data-sot-panel="dashboard-detail-header"',
        );
        expect(dashboardDetailHeader).toContain("<CardHeader");
        expect(dashboardDetailHeader).toContain("<CardTitle");
        expect(dashboardDetailHeader).toContain("<Badge");
        expect(dashboardDetailHeader).toContain("data-rename-mode");
        expect(dashboardDetailHeader).toContain(
            'data-sot-part="detail-header-title-input"',
        );
        expect(dashboardDetailHeader).toContain(
            'data-sot-part="detail-header-action"',
        );
        expect(dashboardDetailHeader).toContain("data-rh-edit-start");
        expect(dashboardDetailHeader).toContain("data-rh-edit-save");
        expect(dashboardDetailHeader).toContain("data-rh-edit-cancel");
        expect(dashboardDetailHeader).toContain("data-rh-ai-anchor");
        expect(dashboardDetailHeader).toContain("data-rh-ai-trigger");
        expect(dashboardDetailHeader).not.toMatch(legacyHeaderClassNamePattern);
        expect(dashboardTranscript).toContain(
            'data-sot-panel="dashboard-retranscription"',
        );
        expect(dashboardTranscript).toContain(
            "data-retx-state={dashboardRetxState}",
        );
        expect(dashboardTranscriptShell).toContain("<Card");
        expect(dashboardTranscriptShell).toContain("hasNoPadding");
        expect(dashboardTranscriptShell).toContain(
            'data-sot-panel="dashboard-transcript-shell"',
        );
        expect(dashboardTranscriptShell).toContain("<CardHeader");
        expect(dashboardTranscriptShell).toContain("<CardContent");
        expect(dashboardTranscriptShell).toContain(
            'data-sot-part="dashboard-transcript-header"',
        );
        expect(dashboardTranscriptShell).toContain(
            'data-sot-part="dashboard-transcript-actions"',
        );
        expect(dashboardTranscriptShell).toContain(
            'data-sot-part="dashboard-transcript-body"',
        );
        for (const legacyClass of [
            'className="transcript"',
            'className="transcript-head"',
            'className="transcript-body"',
        ]) {
            expect(dashboardTranscriptShell).not.toContain(legacyClass);
        }
        expect(dashboardTranscript).toContain("void retranscribe()");
        expect(dashboardTranscript).toContain('"transcript"');
        expect(dashboardTranscript).toContain('"source"');
        expect(dashboardTranscript).toContain('"speakers"');
        expect(dashboardTranscript).toContain('aria-label="详情标签"');
        expect(dashboardTranscript).toContain(
            '{ value: "transcript", label: "转写" }',
        );
        expect(dashboardTranscript).toContain('tabKey: "source-report"');
        expect(dashboardTranscript).toContain("function SotCopyIcon({ state }");
        expect(dashboardTranscript).toContain(
            'data-sot-part="dashboard-copy-icon"',
        );
        expect(dashboardTranscript).not.toContain('className="copy-ico"');
        expect(dashboardTranscript).not.toContain("copy-ico-default");
        expect(dashboardTranscript).not.toContain("copy-ico-ok");
        expect(dashboardTranscript).toContain('data-copy="transcript"');
        expect(dashboardTranscript).toContain('data-copy="source-transcript"');
        expect(dashboardTranscript).toContain('data-copy="source-report"');
        expect(dashboardTranscript).toContain(
            'data-sot-control="copy-source-transcript"',
        );
        expect(dashboardTranscript).toContain(
            'data-sot-control="copy-source-report"',
        );
        expect(dashboardTranscript).toContain(
            'data-sot-control="open-source-record"',
        );
        expect(dashboardTranscript).toContain(
            'data-sot-control="repull-source"',
        );
        expect(dashboardTranscript).toContain('data-tab-pane="transcript"');
        expect(dashboardTranscript).toContain('data-tab-pane="speakers"');
        expect(dashboardTranscript).toContain('data-tab-pane="source-report"');
        expect(dashboardTranscript).toContain('className="turn skel-turn"');
        expect(dashboardTranscriptLoadingTurn).toContain(
            'data-sot-part="dashboard-transcript-speaker-row"',
        );
        expect(dashboardTranscriptLoadingTurn).toContain(
            'data-sot-state="loading"',
        );
        expect(dashboardTranscriptReadyTurn).toContain(
            'data-sot-part="dashboard-transcript-speaker-row"',
        );
        expect(dashboardTranscriptReadyTurn).toContain(
            'data-sot-state="ready"',
        );
        expect(dashboardTranscriptReadyTurn).toContain(
            'data-sot-part="dashboard-transcript-speaker-name"',
        );
        expect(dashboardTranscriptReadyTurn).toContain(
            'data-sot-part="dashboard-transcript-speaker-time"',
        );
        for (const localTurnSlice of [
            dashboardTranscriptLoadingTurn,
            dashboardTranscriptReadyTurn,
        ]) {
            expect(localTurnSlice).not.toContain('className="speaker"');
            expect(localTurnSlice).not.toContain('className="speaker-name"');
        }
        expect(dashboardTranscript).toContain('className="empty-state"');
        expect(dashboardTranscript).toContain('className="empty-ico"');
        expect(dashboardTranscript).toContain('className="empty-msg"');
        expect(dashboardTranscript).toContain('className="empty-sub"');
        expect(dashboardTranscript).toContain('className="ts mono"');
        expect(dashboardTranscript).not.toContain('className="empty-hint"');
        expect(dashboardTranscript).not.toContain('className="eh-t"');
        expect(dashboardTranscript).not.toContain('className="eh-h"');
        expect(dashboardTranscript).toContain('data-tab-scope="source-report"');
        expect(dashboardTranscript).toContain(
            'hidden={detailTab !== "source"}',
        );
        expect(dashboardTranscript).toContain(
            'hidden={detailTab !== "transcript"}',
        );
        expect(dashboardTranscript).not.toContain("<Copy />");
        expect(dashboardTranscript).not.toMatch(
            /\bbg-(background|card|muted)\b/,
        );
        expect(dashboardTranscript).not.toMatch(
            DASHBOARD_WORKSTATION_LEGACY_CONTROL_RE,
        );
    });

    it("keeps standalone recording route fallback states in the new shell", () => {
        const loading = readSource("app/(app)/recordings/[id]/loading.tsx");
        const notFound = readSource("app/(app)/recordings/[id]/not-found.tsx");
        const error = readSource("app/(app)/recordings/[id]/error.tsx");

        for (const source of [loading, notFound, error]) {
            expect(source).not.toMatch(OLD_UI_CONTRACT_RE);
        }
        for (const source of [notFound, error]) {
            expect(source).toContain("BetterAINote");
            expect(source).toContain('href="/dashboard"');
            expect(source).toContain("返回工作台");
            expect(source).toContain(
                'import { Button } from "@/components/ui/button";',
            );
            expect(source).not.toContain('className="btn primary"');
            expect(source).not.toContain('className="btn ghost"');
        }

        expect(notFound).toContain('<Button asChild variant="primary">');
        expect(error).not.toMatch(/\bbg-(background|card|muted)\b/);
        expect(error).toContain("<Button");
        expect(error).toContain('variant="primary"');
        expect(error).toContain('<Button asChild variant="ghost">');
        expect(error).toContain("onClick={reset}");
        expect(error).toContain("重试");
        expect(loading).toContain('aria-busy="true"');
        expect(loading).toContain(
            'import { Skeleton } from "@/components/ui/skeleton";',
        );
        expect(loading).toContain("<Skeleton");
        expect(loading).toContain('data-sot-panel="recording-detail-loading"');
        expect(loading).not.toContain('className="skel-detail"');
        expect(loading).not.toContain('className="sk sk-bar"');
    });

    it("keeps speaker review raw transcript copy available from the review toolbar", () => {
        const speakerReview = readSource(
            "features/recordings/components/speaker-label-editor.tsx",
        );

        expect(speakerReview).toContain("handleCopyRawTranscript");
        expect(speakerReview).toContain("speakerReview.copyRawTranscript");
        expect(speakerReview).toContain("speakerReview.rawTranscriptCopied");
        expect(speakerReview).toContain(
            "speakerReview.copyRawTranscriptFailed",
        );
        expect(speakerReview).toContain("!canCopyRawTranscript");
    });

    it("keeps standalone detail tabs and dashboard title actions wired to existing flows", () => {
        const detailWorkstation = readSource(
            "features/recordings/workstation.tsx",
        );
        const dashboardWorkstation = readSource(
            "features/dashboard/workstation.tsx",
        );

        expect(detailWorkstation).toContain("SegmentedTabs");
        expect(detailWorkstation).toContain('"source" | "local" | "speakers"');
        expect(detailWorkstation).toContain("showSpeakerReview={false}");
        expect(detailWorkstation).toContain("<SpeakerLabelEditor");
        expect(detailWorkstation).toContain("/rename/auto");
        expect(detailWorkstation).not.toMatch(/\bbg-(background|card|muted)\b/);
        expect(detailWorkstation).not.toMatch(OLD_UI_CONTRACT_RE);
        expect(detailWorkstation).toContain("handleAutoRename");
        expect(detailWorkstation).toContain("handleAutoRenamePreviewApply");
        expect(detailWorkstation).toContain("handleAutoRenamePreviewCancel");
        expect(detailWorkstation).toContain("handleRenameStart");
        expect(detailWorkstation).toContain("handleRenameSave");
        expect(detailWorkstation).toContain("handleRenameCancel");
        expect(detailWorkstation).toMatch(
            /disabled=\{\s*isAutoRenaming \|\| isApplyingAutoRename\s*\}/,
        );
        expect(detailWorkstation).toMatch(
            /data-sot-state=\{\s*autoRenameDisabledReason/,
        );
        expect(detailWorkstation).toContain("autoRenameUnavailableOpen");
        expect(detailWorkstation).toContain('state="unavailable"');
        expect(detailWorkstation).toContain("aria-busy={isAutoRenaming}");
        expect(detailWorkstation).toContain("aria-busy={isSavingRename}");
        expect(detailWorkstation).toContain('aria-label="保存新标题"');
        expect(detailWorkstation).toContain('title="保存（Enter）"');
        expect(detailWorkstation).toContain(
            'aria-label={t("recording.cancelRename")}',
        );
        expect(detailWorkstation).toContain('aria-label="重命名"');
        expect(detailWorkstation).toContain('title="重命名"');

        expect(dashboardWorkstation).toContain("previewAutoRename");
        expect(dashboardWorkstation).toContain("applyAiRename");
        expect(dashboardWorkstation).toContain("/rename/auto");
        expect(dashboardWorkstation).toContain("aria-busy={");
        expect(dashboardWorkstation).toContain('aria-label="更多操作"');
        expect(dashboardWorkstation).toContain(
            'from "@/components/ui/dropdown-menu"',
        );
        expect(dashboardWorkstation).toContain("<DropdownMenu");
        expect(dashboardWorkstation).toContain("open={moreOpen}");
        expect(dashboardWorkstation).toContain("onOpenChange={(open) =>");
        expect(dashboardWorkstation).toContain("<DropdownMenuTrigger asChild>");
        expect(dashboardWorkstation).toContain("<DropdownMenuContent");
        expect(dashboardWorkstation).toContain(
            'data-sot-menu="recording-more-actions"',
        );
        expect(dashboardWorkstation).toContain('data-sot-menu-item="rename"');
        expect(dashboardWorkstation).toContain(
            'data-sot-menu-item="ai-rename"',
        );
        expect(dashboardWorkstation).toContain(
            'data-sot-menu-item="retranscribe"',
        );
        expect(dashboardWorkstation).toContain(
            'data-sot-menu-item="delete-local"',
        );
        expect(dashboardWorkstation).toContain('data-sot-tone="danger"');
        expect(dashboardWorkstation).toContain("<DropdownMenuSeparator");
        expect(dashboardWorkstation).toContain(
            'data-sot-menu-separator="delete"',
        );
        expect(dashboardWorkstation).toContain("data-sot-menu-hint");
        expect(dashboardWorkstation).not.toContain('className="more-menu"');
        expect(dashboardWorkstation).not.toContain(
            'className="more-menu-item"',
        );
        expect(dashboardWorkstation).not.toContain('className="more-menu-sep"');
        expect(dashboardWorkstation).not.toContain(
            'className="more-menu-hint"',
        );
        expect(dashboardWorkstation).toContain("AI 重命名");
        expect(dashboardWorkstation).toContain("重新转写");
        expect(dashboardWorkstation).toContain("来源持有正本");
        expect(dashboardWorkstation).not.toContain('className="more-action"');
        expect(dashboardWorkstation).not.toContain("more-action-l");
        expect(dashboardWorkstation).not.toContain("more-action-meta");
        expect(dashboardWorkstation).toContain("void deleteRecording()");
        expect(dashboardWorkstation).toContain("删除本地副本");
        expect(dashboardWorkstation).not.toContain("仅删除本地副本");
        expect(dashboardWorkstation).toContain(
            "!selectedRecording.sourceProvider ||",
        );
        expect(dashboardWorkstation).toContain(
            "selectedRecording.upstreamDeleted",
        );
    });

    it("keeps dashboard retranscription states inline without hiding the existing transcript", () => {
        const dashboardTranscript = readSource(
            "features/dashboard/workstation.tsx",
        );

        expect(dashboardTranscript).toContain(
            'data-sot-panel="dashboard-retranscription"',
        );
        expect(dashboardTranscript).toContain(
            "data-retx-state={dashboardRetxState}",
        );
        expect(dashboardTranscript).toContain(
            'dashboardRetxState === "failed"',
        );
        expect(dashboardTranscript).toContain(
            'dashboardRetxState === "running"',
        );
        expect(dashboardTranscript).toContain("void retranscribe()");
        expect(dashboardTranscript).toContain("转写任务已加入队列");
        expect(dashboardTranscript).toContain(
            "新任务会保持当前转写可见，完成后替换结果。",
        );
        expect(dashboardTranscript).not.toMatch(
            /\bbg-(background|card|muted)\b/,
        );
        expect(dashboardTranscript).not.toMatch(
            DASHBOARD_WORKSTATION_LEGACY_CONTROL_RE,
        );
    });

    it("keeps recording tag creation controls on shadcn buttons", () => {
        const tagManager = readSource(
            "features/recordings/components/recording-tag-manager.tsx",
        );

        expect(tagManager).toContain('data-sot-control="recording-tag-create"');
        expect(tagManager).toContain("<Button");
        expect(tagManager).toContain('variant="primary"');
        expect(tagManager).toContain('size="icon-sm"');
        expect(tagManager).toContain('aria-label="添加"');
        expect(tagManager).not.toContain("tagm-add-btn");
    });
});
