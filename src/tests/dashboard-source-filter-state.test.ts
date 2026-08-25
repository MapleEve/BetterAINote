import { describe, expect, it } from "vitest";
import {
    parseDashboardSourceFilter,
    resolveConnectedSourceStatus,
    toggleDashboardSourceFilter,
} from "@/features/dashboard/source-filter-state";

describe("dashboard source filter runtime state", () => {
    it("restores only known source filters", () => {
        expect(parseDashboardSourceFilter("iflyrec")).toBe("iflyrec");
        expect(parseDashboardSourceFilter("plaud")).toBe("plaud");
        expect(parseDashboardSourceFilter("unknown-provider")).toBe("all");
        expect(parseDashboardSourceFilter(null)).toBe("all");
    });

    it("toggles the requested source and clears the current source", () => {
        expect(toggleDashboardSourceFilter("all", "iflyrec")).toBe("iflyrec");
        expect(toggleDashboardSourceFilter("plaud", "iflyrec")).toBe("iflyrec");
        expect(toggleDashboardSourceFilter("iflyrec", "iflyrec")).toBe("all");
    });

    it("distinguishes connected-empty from narrowed no-results", () => {
        expect(
            resolveConnectedSourceStatus({
                active: false,
                currentResultCount: 0,
                hasNarrowingFilter: false,
                providerCount: 0,
                settled: true,
            }),
        ).toBe("connected-empty");
        expect(
            resolveConnectedSourceStatus({
                active: true,
                currentResultCount: 1,
                hasNarrowingFilter: false,
                providerCount: 1,
                settled: true,
            }),
        ).toBe("connected");
        expect(
            resolveConnectedSourceStatus({
                active: true,
                currentResultCount: 0,
                hasNarrowingFilter: true,
                providerCount: 0,
                settled: true,
            }),
        ).toBe("no-results");
        expect(
            resolveConnectedSourceStatus({
                active: true,
                currentResultCount: 0,
                hasNarrowingFilter: true,
                providerCount: 0,
                settled: false,
            }),
        ).toBe("connected-empty");
    });
});
