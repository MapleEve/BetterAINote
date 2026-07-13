import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = resolve(import.meta.dirname, "..");

function readSource(path: string) {
    return readFileSync(resolve(sourceRoot, path), "utf8");
}

function sliceBetween(source: string, start: string, end: string) {
    const startIndex = source.indexOf(start);
    const endIndex = source.indexOf(end, startIndex);

    expect(startIndex).toBeGreaterThanOrEqual(0);
    expect(endIndex).toBeGreaterThan(startIndex);

    return source.slice(startIndex, endIndex + end.length);
}

describe("dashboard detail empty state", () => {
    it("renders the empty state instead of an unselected workstation shell", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");
        const detailPanel = sliceBetween(
            workstation,
            "<section\n                        className={DASHBOARD_DETAIL_PANEL_CLASS_NAME}",
            "                    </section>",
        );
        const emptyState = sliceBetween(
            workstation,
            "function DashboardDetailEmptyState()",
            "function SourceReportErrorGlyph()",
        );

        expect(detailPanel).toContain('data-panel="dashboard-detail"');
        expect(detailPanel).toContain("{selectedRecording ? (");
        expect(detailPanel).toContain("<CardHeader");
        expect(detailPanel).toContain("<DashboardDetailEmptyState />");
        expect(detailPanel).toContain(
            "selectedRecording ? (\n                            <>",
        );
        expect(detailPanel).toContain(
            "</>\n                        ) : (\n                            <DashboardDetailEmptyState />",
        );
        expect(detailPanel).toContain(
            'data-empty={selectedRecording ? "false" : "true"}',
        );
        expect(emptyState).toContain(
            "className={DASHBOARD_DETAIL_EMPTY_STATE_CLASS_NAME}",
        );
        expect(emptyState).toContain('data-detail-empty=""');
    });
});
