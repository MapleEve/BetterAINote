import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
    RecordingList,
    RecordingListControls,
    RecordingListPagination,
} from "@/features/dashboard/components/recording-list";
import {
    adaptRecordingListFacets,
    buildRecordingListQueryParams,
    getRecordingTimelineFilter,
    reconcileRecordingSelection,
    sortRecordings,
} from "@/features/dashboard/recording-list-controller";
import {
    isRecordingListUrlCurrent,
    readRecordingListUrlState,
    recordingListUrl,
} from "@/features/dashboard/recording-list-url-state";
import type { Recording } from "@/types/recording";

function recording(id: string, filename: string, startTime: string): Recording {
    return {
        audioUrl: null,
        duration: 60_000,
        filename,
        filesize: 1_024,
        hasAudio: false,
        id,
        providerDeviceId: "fixture-device",
        sourceProvider: "ticnote",
        sourceRecordingId: `source-${id}`,
        startTime,
        tags: [],
        upstreamDeleted: false,
    };
}

describe("dashboard recording list controller", () => {
    it("normalizes the locked global facet contract without inventing source facets", () => {
        expect(
            adaptRecordingListFacets({
                timeline: {
                    all: 24,
                    earlier: 6,
                    last7: 6,
                    today: 8,
                    yesterday: 4,
                },
                tags: {
                    all: 24,
                    untagged: 17,
                    items: [
                        {
                            color: "blue",
                            count: 5,
                            icon: "grid",
                            id: "alpha",
                            name: "Alpha",
                        },
                    ],
                },
            }),
        ).toEqual({
            timeline: {
                all: 24,
                earlier: 6,
                last7: 6,
                today: 8,
                yesterday: 4,
            },
            tags: {
                all: 24,
                items: [
                    {
                        color: "blue",
                        count: 5,
                        icon: "grid",
                        id: "alpha",
                        name: "Alpha",
                    },
                ],
                untagged: 17,
            },
        });
        expect(adaptRecordingListFacets(undefined)).toBeNull();
    });

    it("serializes only the active list dimension and every real query input", () => {
        const timeline = buildRecordingListQueryParams({
            favorite: "transcribed",
            includeTranscript: true,
            libraryFilter: { label: "Speaker A", type: "speaker" },
            listMode: "timeline",
            page: 3,
            pageSize: 10,
            query: "  review  ",
            selectedTagFilter: "tag:ignored",
            sort: "oldest",
            source: "ticnote",
            timeline: "last7",
        });
        expect(Object.fromEntries(timeline)).toEqual({
            favorite: "transcribed",
            includeTranscript: "1",
            page: "3",
            pageSize: "10",
            query: "review",
            sort: "oldest",
            source: "ticnote",
            speaker: "Speaker A",
            timeline: "last7",
        });

        const tags = buildRecordingListQueryParams({
            favorite: "all",
            libraryFilter: null,
            listMode: "tags",
            page: 1,
            pageSize: 20,
            query: "",
            selectedTagFilter: "untagged",
            sort: "name",
            source: "all",
            timeline: "today",
        });
        expect(tags.get("untagged")).toBe("1");
        expect(tags.has("timeline")).toBe(false);
    });

    it("keeps calendar buckets, stable sorting, and selection deterministic", () => {
        const now = new Date(2026, 7, 14, 12);
        expect(getRecordingTimelineFilter("2026-08-14T01:00:00", now)).toBe(
            "today",
        );
        expect(getRecordingTimelineFilter("2026-08-13T23:00:00", now)).toBe(
            "yesterday",
        );
        expect(getRecordingTimelineFilter("2026-08-08T23:00:00", now)).toBe(
            "last7",
        );
        expect(getRecordingTimelineFilter("2026-08-06T23:00:00", now)).toBe(
            "earlier",
        );

        const tied = [
            recording("b", "10 review", "2026-08-14T08:00:00.000Z"),
            recording("a", "2 review", "2026-08-14T08:00:00.000Z"),
        ];
        expect(
            sortRecordings(tied, "newest", "en").map((item) => item.id),
        ).toEqual(["a", "b"]);
        expect(
            sortRecordings(tied, "name", "en").map((item) => item.id),
        ).toEqual(["b", "a"]);
        expect(
            sortRecordings(tied, "oldest", "en").map((item) => item.id),
        ).toEqual(["a", "b"]);
        expect(
            reconcileRecordingSelection({
                currentId: "b",
                recordingIds: ["a", "b"],
                requestedId: "a",
            }),
        ).toBe("a");
        expect(
            reconcileRecordingSelection({
                currentId: null,
                recordingIds: [],
                requestedId: null,
            }),
        ).toBeNull();
    });
});

describe("dashboard recording list URL and semantic surfaces", () => {
    it("round-trips page/detail state while preserving unrelated filters", () => {
        expect(readRecordingListUrlState("?page=2&recording=rec-a")).toEqual({
            detailOpen: true,
            page: 2,
            recordingId: "rec-a",
        });
        const next = recordingListUrl({
            currentUrl: "/dashboard?source=ticnote#library",
            detailOpen: true,
            page: 4,
            recordingId: "rec-a",
        });
        expect(next).toBe(
            "/dashboard?source=ticnote&page=4&recording=rec-a#library",
        );
        expect(isRecordingListUrlCurrent(next, next)).toBe(true);
        expect(
            recordingListUrl({
                currentUrl: next,
                detailOpen: false,
                page: 1,
                recordingId: null,
            }),
        ).toBe("/dashboard?source=ticnote#library");
    });

    it("renders native controls, rich rows, selected semantics, and pagination boundaries", () => {
        const controls = renderToStaticMarkup(
            React.createElement(RecordingListControls, {
                language: "en",
                listMode: "timeline",
                onListModeChange: () => {},
                onTagFilterChange: () => {},
                onTagFilterOpenChange: () => {},
                onTimelineFilterChange: () => {},
                selectedTagFilter: "all",
                tagFilterOpen: false,
                tagFilterOptions: [{ count: 24, label: "All", value: "all" }],
                tagFilterRef: () => {},
                timelineCounts: {
                    all: 24,
                    earlier: 6,
                    last7: 6,
                    today: 8,
                    yesterday: 4,
                },
                timelineFilter: "last7",
                visibleCount: 10,
            }),
        );
        expect(controls).toContain("Last 7 days");
        expect(controls).toContain('data-filter="last7"');
        expect(controls).toContain('aria-pressed="true"');
        expect(controls).not.toContain("data-sot-control");

        const list = renderToStaticMarkup(
            React.createElement(RecordingList, {
                dateTimeFormat: "absolute",
                groups: [
                    {
                        entries: [
                            {
                                durationLabel: "01:00",
                                filename: "Fixture review",
                                id: "rec-a",
                                source: {
                                    cover: false,
                                    icon: null,
                                    label: "TicNote",
                                    letter: "T",
                                },
                                startTime: "2026-08-14T08:00:00.000Z",
                                status: { label: "Updated", tone: "ok" },
                            },
                        ],
                        id: "today",
                        label: "Today",
                    },
                ],
                language: "en",
                onSelect: () => {},
                selectedId: "rec-a",
            }),
        );
        expect(list).toContain('data-recording-id="rec-a"');
        expect(list).toContain('aria-current="true"');
        expect(list).toContain('data-state="selected"');
        expect(list).toContain("Updated");

        const pagination = renderToStaticMarkup(
            React.createElement(RecordingListPagination, {
                currentPage: 1,
                language: "en",
                loaded: 10,
                onNext: () => {},
                onPrevious: () => {},
                total: 24,
                totalPages: 3,
            }),
        );
        expect(pagination).toContain("Previous");
        expect(pagination).toContain("disabled");
        expect(pagination).toContain("1 / 3");
        expect(pagination).not.toContain("Load more");
    });
});
