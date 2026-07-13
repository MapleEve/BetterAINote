import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import DashboardLoading from "@/app/(app)/dashboard/loading";
import RecordingLoading from "@/app/(app)/recordings/[id]/loading";

function expectLoadingRegion(html: string, label: string) {
    expect(html).toContain("<section");
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain(`aria-label="${label}"`);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("contents");
    expect(html).toContain("animate-pulse");
    expect(html).toContain("bg-accent");
    expect(html).toContain("bg-card");
    expect(html).toContain("<aside");
    expect(html).toContain("<main");
    expect(html).toContain("<header");
    expect(html).toContain("加载中");
}

describe("route loading surfaces", () => {
    it("renders the dashboard loading region with responsive list geometry", () => {
        const html = renderToStaticMarkup(
            React.createElement(DashboardLoading),
        );

        expectLoadingRegion(html, "正在加载仪表盘");
        expect(html).toContain("basis-96");
        expect(html).toContain("max-lg:basis-auto");
        expect(html).toContain('aria-hidden="true"');
        expect(
            (html.match(/animate-pulse/g) ?? []).length,
        ).toBeGreaterThanOrEqual(10);
    });

    it("renders the recording loading region with single-column responsive geometry", () => {
        const html = renderToStaticMarkup(
            React.createElement(RecordingLoading),
        );

        expectLoadingRegion(html, "正在加载录音详情");
        expect(html).toContain("flex-1 flex-col");
        expect(html).toContain("max-lg:min-w-0");
        expect(html).toContain('aria-hidden="true"');
        expect(html).toContain("rounded-2xl");
        expect(
            (html.match(/animate-pulse/g) ?? []).length,
        ).toBeGreaterThanOrEqual(4);
    });
});
