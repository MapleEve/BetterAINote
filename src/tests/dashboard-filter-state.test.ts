import { describe, expect, it } from "vitest";
import {
    DASHBOARD_FILTER_STATE_STORAGE_KEY,
    DEFAULT_DASHBOARD_FILTER_STATE,
    dashboardFilterStateUrl,
    reduceDashboardFilterState,
    restoreDashboardFilterState,
    serializeDashboardFilterState,
} from "@/features/dashboard/filter-state";
import { buildRecordingListQueryParams } from "@/features/dashboard/recording-list-controller";

describe("dashboard recording filter state", () => {
    it("keeps list mode independent from explicit Favorites", () => {
        const tagMode = reduceDashboardFilterState(
            DEFAULT_DASHBOARD_FILTER_STATE,
            { type: "list-mode", value: "tags" },
        );

        expect(tagMode).toEqual({
            favorite: "all",
            listMode: "tags",
            selectedTagFilter: "all",
        });

        expect(
            reduceDashboardFilterState(tagMode, {
                type: "favorite",
                value: "tags",
            }),
        ).toEqual({
            favorite: "tags",
            listMode: "tags",
            selectedTagFilter: "all",
        });
    });

    it("clears only the explicit tag when All recordings is selected", () => {
        expect(
            reduceDashboardFilterState(
                {
                    favorite: "tags",
                    listMode: "tags",
                    selectedTagFilter: "tag:product-weekly",
                },
                { type: "favorite", value: "all" },
            ),
        ).toEqual({
            favorite: "all",
            listMode: "tags",
            selectedTagFilter: "all",
        });
    });

    it("preserves an explicit tag across unrelated mode changes", () => {
        const state = {
            favorite: "transcribed" as const,
            listMode: "tags" as const,
            selectedTagFilter: "tag:customer" as const,
        };

        expect(
            reduceDashboardFilterState(state, {
                type: "list-mode",
                value: "timeline",
            }),
        ).toEqual({ ...state, listMode: "timeline" });
    });

    it("reconciles a deleted tag without changing favorite or mode", () => {
        expect(
            reduceDashboardFilterState(
                {
                    favorite: "tags",
                    listMode: "tags",
                    selectedTagFilter: "tag:deleted",
                },
                {
                    available: ["all", "untagged", "tag:remaining"],
                    type: "reconcile-tags",
                },
            ),
        ).toEqual({
            favorite: "tags",
            listMode: "tags",
            selectedTagFilter: "all",
        });
    });

    it("preserves the built-in untagged filter when its current result count is zero", () => {
        const restored = restoreDashboardFilterState({
            search: "?favorite=tags&mode=tags&untagged=1",
            storedValue: null,
        });
        const settled = reduceDashboardFilterState(restored, {
            available: ["all"],
            type: "reconcile-tags",
        });
        expect(settled).toEqual({
            favorite: "tags",
            listMode: "tags",
            selectedTagFilter: "untagged",
        });

        const queryParams = buildRecordingListQueryParams({
            favorite: settled.favorite,
            libraryFilter: null,
            listMode: settled.listMode,
            page: 1,
            pageSize: 10,
            query: "",
            selectedTagFilter: settled.selectedTagFilter,
            sort: "newest",
            source: "all",
            timeline: "all",
        });
        expect(Object.fromEntries(queryParams)).toMatchObject({
            favorite: "tags",
            untagged: "1",
        });
    });

    it("restores validated storage and applies valid URL overrides", () => {
        const stored = serializeDashboardFilterState({
            favorite: "tags",
            listMode: "timeline",
            selectedTagFilter: "tag:stored",
        });

        expect(
            restoreDashboardFilterState({
                search: "?mode=tags&favorite=all&tagId=url-tag",
                storedValue: stored,
            }),
        ).toEqual({
            favorite: "all",
            listMode: "tags",
            selectedTagFilter: "tag:url-tag",
        });
        expect(
            restoreDashboardFilterState({
                search: "?mode=unknown&favorite=invalid&tagId=",
                storedValue: stored,
            }),
        ).toEqual({
            favorite: "tags",
            listMode: "timeline",
            selectedTagFilter: "tag:stored",
        });
        expect(
            restoreDashboardFilterState({
                storedValue: "not-json",
            }),
        ).toEqual(DEFAULT_DASHBOARD_FILTER_STATE);
        expect(DASHBOARD_FILTER_STATE_STORAGE_KEY).toBe(
            "dashboard-recording-filter-state",
        );
        expect(
            restoreDashboardFilterState({
                search: "?favorite=tags&mode=tags&untagged=1",
                storedValue: null,
            }),
        ).toEqual({
            favorite: "tags",
            listMode: "tags",
            selectedTagFilter: "untagged",
        });
    });

    it("syncs only filter-owned URL parameters and preserves the rest", () => {
        expect(
            dashboardFilterStateUrl(
                "https://example.test/dashboard?keep=1&favorite=tags#source",
                {
                    favorite: "all",
                    listMode: "tags",
                    selectedTagFilter: "tag:product-weekly",
                },
            ),
        ).toBe("/dashboard?keep=1&mode=tags&tagId=product-weekly#source");
    });
});
