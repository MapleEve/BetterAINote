import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LanguageProvider } from "@/components/language-provider";
import { SourceReportPanel } from "@/features/recordings/components/source-report-panel";

describe("SourceReportPanel", () => {
    it("renders the accessible shadcn source report shell before data is loaded", () => {
        const html = renderToStaticMarkup(
            React.createElement(
                LanguageProvider,
                null,
                React.createElement(SourceReportPanel, {
                    autoLoad: false,
                    recordingId: "source-report-render-contract",
                    sourceProvider: "ticnote",
                }),
            ),
        );

        expect(html).toContain('data-control="recording-source-report"');
        expect(html).toContain('data-testid="recording-source-report"');
        expect(html).toContain('data-state="empty"');
        expect(html).toContain('data-slot="card"');
        expect(html).toContain('data-slot="button"');
        expect(html).toContain('data-control="source-report-refresh"');
        expect(html).toContain('data-testid="source-report-empty-surface"');
    });
});
