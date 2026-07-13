import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const languageState = vi.hoisted(() => ({ language: "zh-CN" }));

const reactHarness = vi.hoisted(() => {
    type Slot = {
        deps?: unknown[];
        kind: "effect" | "memo" | "ref" | "state";
        value: unknown;
    };

    let cursor = 0;
    let pending = false;
    let slots: Slot[] = [];

    const hasEqualDeps = (previous?: unknown[], next?: unknown[]) =>
        previous?.length === next?.length &&
        previous?.every((value, index) => Object.is(value, next?.[index]));

    return {
        beginRender() {
            cursor = 0;
            pending = false;
        },
        consumePendingRender() {
            return pending;
        },
        flushEffects() {
            for (const slot of slots) {
                if (
                    slot.kind === "effect" &&
                    typeof slot.value === "function"
                ) {
                    slot.value();
                    slot.value = undefined;
                }
            }
        },
        reset() {
            cursor = 0;
            pending = false;
            slots = [];
        },
        useEffect(effect: () => void, deps?: unknown[]) {
            const index = cursor++;
            const current = slots[index];
            if (!current || !hasEqualDeps(current.deps, deps)) {
                slots[index] = { deps, kind: "effect", value: effect };
            }
        },
        useMemo<T>(factory: () => T, deps?: unknown[]) {
            const index = cursor++;
            const current = slots[index];
            if (
                current &&
                current.kind === "memo" &&
                hasEqualDeps(current.deps, deps)
            ) {
                return current.value as T;
            }
            const value = factory();
            slots[index] = { deps, kind: "memo", value };
            return value;
        },
        useRef<T>(initialValue: T) {
            const index = cursor++;
            const current = slots[index];
            if (current?.kind === "ref") {
                return current.value as { current: T };
            }
            const value = { current: initialValue };
            slots[index] = { kind: "ref", value };
            return value;
        },
        useState<T>(initialValue: T | (() => T)) {
            const index = cursor++;
            const current = slots[index];
            if (current?.kind === "state") {
                return [
                    current.value as T,
                    (nextValue: T | ((previous: T) => T)) => {
                        const previous = slots[index]?.value as T;
                        slots[index].value =
                            typeof nextValue === "function"
                                ? (nextValue as (value: T) => T)(previous)
                                : nextValue;
                        pending = true;
                    },
                ] as const;
            }
            const value =
                typeof initialValue === "function"
                    ? (initialValue as () => T)()
                    : initialValue;
            slots[index] = { kind: "state", value };
            return [
                value,
                (nextValue: T | ((previous: T) => T)) => {
                    const previous = slots[index]?.value as T;
                    slots[index].value =
                        typeof nextValue === "function"
                            ? (nextValue as (value: T) => T)(previous)
                            : nextValue;
                    pending = true;
                },
            ] as const;
        },
    };
});

vi.mock("react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("react")>();
    return {
        ...actual,
        useEffect: reactHarness.useEffect,
        useMemo: reactHarness.useMemo,
        useRef: reactHarness.useRef,
        useState: reactHarness.useState,
    };
});

vi.mock("@/components/language-provider", () => ({
    useLanguage: () => ({
        language: languageState.language,
        t: (key: string) =>
            ({
                "librarySearch.dialogLabel": "Search library",
                "librarySearch.openSearch": "Open search",
                "librarySearch.placeholder": "Search recordings",
                "librarySearch.clearSearch": "Clear search",
                "librarySearch.scopeLegend": "Search scope",
                "librarySearch.error": "Search failed. Try again later.",
                "librarySearch.indexing": "Rebuilding search index",
                "librarySearch.retry": "Retry",
            })[key] ?? key,
    }),
}));

import { LibrarySearch } from "@/features/dashboard/components/library-search";

type Props = Record<string, unknown>;

function findElement(
    node: unknown,
    predicate: (props: Props) => boolean,
): ReactElement<Props> | undefined {
    if (!node || typeof node !== "object") return undefined;
    if (Array.isArray(node)) {
        for (const child of node) {
            const match = findElement(child, predicate);
            if (match) return match;
        }
        return undefined;
    }
    const element = node as ReactElement<Props>;
    if (element.props && predicate(element.props)) return element;
    const children = element.props?.children;
    const candidates = Array.isArray(children) ? children : [children];
    for (const child of candidates) {
        const match = findElement(child, predicate);
        if (match) return match;
    }
    return undefined;
}

function renderLibrarySearch(props: Parameters<typeof LibrarySearch>[0]) {
    let tree: ReactElement;
    const render = () => {
        reactHarness.beginRender();
        tree = LibrarySearch(props);
        reactHarness.flushEffects();
        return tree;
    };

    render();
    return {
        get tree() {
            return tree;
        },
        rerender: render,
    };
}

async function waitForLibrarySearchRender(
    view: ReturnType<typeof renderLibrarySearch>,
    predicate: (tree: ReactElement) => boolean,
) {
    await vi.waitFor(
        () => {
            if (reactHarness.consumePendingRender()) {
                view.rerender();
            }
            expect(predicate(view.tree)).toBe(true);
        },
        { interval: 1, timeout: 1_000 },
    );
}

describe("library search runtime interaction regression", () => {
    beforeEach(() => {
        reactHarness.reset();
        languageState.language = "zh-CN";
        vi.stubGlobal("Node", class TestNode {});
        vi.stubGlobal("document", {
            addEventListener: vi.fn(),
            getElementById: vi.fn(() => null),
            removeEventListener: vi.fn(),
        });
        vi.stubGlobal("window", {
            setTimeout: (callback: () => void) => {
                callback();
                return 0;
            },
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("opens from the trigger and forwards controlled query changes", () => {
        const onOpenChange = vi.fn();
        const onQueryChange = vi.fn();
        const view = renderLibrarySearch({
            onApplyFilter: vi.fn(),
            onOpenChange,
            onOpenRecording: vi.fn(),
            onQueryChange,
            open: false,
            query: "",
        });

        const trigger = findElement(
            view.tree,
            (props) => props["aria-label"] === "Open search",
        );
        expect(trigger).toBeDefined();
        (trigger?.props.onClick as () => void)();
        expect(onOpenChange).toHaveBeenCalledWith(true);

        const openView = renderLibrarySearch({
            onApplyFilter: vi.fn(),
            onOpenChange,
            onOpenRecording: vi.fn(),
            onQueryChange,
            open: true,
            query: "Alpha",
        });
        const input = findElement(
            openView.tree,
            (props) => props.role === "combobox",
        );
        expect(input?.props["aria-expanded"]).toBe(true);
        (
            input?.props.onChange as (event: {
                target: { value: string };
            }) => void
        )({ target: { value: "Beta" } });
        expect(onQueryChange).toHaveBeenCalledWith("Beta");
    });

    it("renders the no-query panel with the compact SOT surface and scope geometry", () => {
        const view = renderLibrarySearch({
            onApplyFilter: vi.fn(),
            onOpenChange: vi.fn(),
            onOpenRecording: vi.fn(),
            onQueryChange: vi.fn(),
            open: true,
            query: "",
        });

        const panel = findElement(
            view.tree,
            (props) => props.role === "dialog",
        );
        const inputRow = findElement(
            view.tree,
            (props) =>
                typeof props.className === "string" &&
                props.className.includes("h-auto"),
        );
        const scope = findElement(
            view.tree,
            (props) =>
                typeof props.className === "string" &&
                props.className.includes("gap-[6px]"),
        );
        const noQueryState = findElement(
            view.tree,
            (props) => props["aria-live"] === "polite",
        );

        expect(panel?.props.className).toContain("bg-[var(--bg-elevated)]");
        expect(panel?.props.className).toContain("rounded-[12px]");
        expect(panel?.props.className).toContain(
            "[box-shadow:var(--card-popover-shadow)]",
        );
        expect(inputRow?.props.className).toContain("h-auto");
        expect(inputRow?.props.className).toContain("bg-transparent");
        expect(inputRow?.props.className).toContain("py-[8px]");
        expect(
            findElement(view.tree, (props) => props.role === "combobox")?.props
                .className,
        ).toContain("font-medium");
        expect(scope?.props.className).toContain("gap-[6px]");
        expect(scope?.props.className).toContain("py-[8px]");
        expect(noQueryState?.props.children).toBeDefined();
        expect(
            findElement(
                noQueryState,
                (props) =>
                    typeof props.className === "string" &&
                    props.className.includes("py-[22px]"),
            ),
        ).toBeDefined();
    });

    it("keeps semantic result groups while matching the compact SOT result geometry", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(() =>
                Promise.resolve(
                    new Response(
                        JSON.stringify({
                            results: [
                                {
                                    body: "2 recordings",
                                    entityId: "tag-1",
                                    entityType: "tag",
                                    recordingId: null,
                                    source: null,
                                    speaker: null,
                                    title: "Alpha tag",
                                },
                            ],
                        }),
                        { headers: { "Content-Type": "application/json" } },
                    ),
                ),
            ),
        );
        const view = renderLibrarySearch({
            onApplyFilter: vi.fn(),
            onOpenChange: vi.fn(),
            onOpenRecording: vi.fn(),
            onQueryChange: vi.fn(),
            open: true,
            query: "Alpha",
        });
        await waitForLibrarySearchRender(view, (tree) =>
            Boolean(findElement(tree, (props) => props.role === "listbox")),
        );

        const listbox = findElement(
            view.tree,
            (props) => props.role === "listbox",
        );
        const group = findElement(
            listbox,
            (props) =>
                typeof props.className === "string" &&
                props.className.includes("min-w-0 border-0"),
        );
        const legend = findElement(
            group,
            (props) =>
                typeof props.className === "string" &&
                props.className.includes("float-left"),
        );
        const option = findElement(group, (props) => props.role === "option");
        const tag = findElement(
            option,
            (props) =>
                typeof props.className === "string" &&
                props.className.includes("[--tag-c:oklch"),
        );

        expect(group?.props["aria-labelledby"]).toBe(
            "library-search-group-tag",
        );
        expect(legend?.props.id).toBe(group?.props["aria-labelledby"]);
        expect(legend?.props.className).toContain("text-[10.5px]");
        expect(legend?.props.className).toContain("leading-[10.5px]");
        expect(option?.props.className).toContain("rounded-[8px]");
        expect(option?.props.className).toContain("gap-[2px]");
        expect(tag?.props.className).toContain("h-[22px]");
        expect(tag?.props.className).toContain("leading-[normal]");
        expect(tag?.props.className).not.toContain("[&_svg]:stroke-2");
        const tagIcon = findElement(
            tag,
            (props) => props.className === "!size-[11px]",
        );
        expect(tagIcon?.props.size).toBe(11);
        expect(tagIcon?.props.strokeWidth).toBe(2);
    });

    it("requests the selected scope and applies the active result through real handlers", async () => {
        const onApplyFilter = vi.fn();
        const onOpenChange = vi.fn();
        const onOpenRecording = vi.fn();
        const onQueryChange = vi.fn();
        const fetchMock = vi.fn<typeof fetch>((input) => {
            const url = new URL(String(input), "https://example.test");
            const entityType =
                url.searchParams.get("type") === "transcript"
                    ? "transcript"
                    : "tag";
            return Promise.resolve(
                new Response(
                    JSON.stringify({
                        results: [
                            {
                                body: "Alpha result",
                                entityId: "result-1",
                                entityType,
                                recordingId:
                                    entityType === "transcript"
                                        ? "rec-1"
                                        : null,
                                source: "ticnote",
                                speaker: null,
                                startMs:
                                    entityType === "transcript" ? 1_000 : null,
                                title:
                                    entityType === "transcript"
                                        ? "Transcript title"
                                        : "Alpha title",
                            },
                        ],
                    }),
                    { headers: { "Content-Type": "application/json" } },
                ),
            );
        });
        vi.stubGlobal("fetch", fetchMock);

        const view = renderLibrarySearch({
            onApplyFilter,
            onOpenChange,
            onOpenRecording,
            onQueryChange,
            open: true,
            query: "Alpha",
        });
        await waitForLibrarySearchRender(view, (tree) =>
            Boolean(findElement(tree, (props) => props.role === "option")),
        );

        const scope = findElement(
            view.tree,
            (props) => props["aria-label"] === "Search scope",
        );
        (scope?.props.onValueChange as (value: string) => void)("transcript");
        expect(reactHarness.consumePendingRender()).toBe(true);
        view.rerender();
        await waitForLibrarySearchRender(view, (tree) =>
            Boolean(
                findElement(
                    tree,
                    (props) => props.children === "Transcript title · 00:01",
                ),
            ),
        );
        expect(fetchMock).toHaveBeenLastCalledWith(
            "/api/search?q=Alpha&limit=8&type=transcript",
        );

        const dialog = findElement(
            view.tree,
            (props) => props.role === "dialog",
        );
        const preventDefault = vi.fn();
        (
            dialog?.props.onKeyDown as (event: {
                key: string;
                preventDefault: () => void;
            }) => void
        )({ key: "Enter", preventDefault });
        expect(preventDefault).toHaveBeenCalledOnce();
        expect(onOpenRecording).toHaveBeenCalledWith("rec-1");
        expect(onQueryChange).toHaveBeenCalledWith("");
        expect(onOpenChange).toHaveBeenCalledWith(false);
        expect(onApplyFilter).not.toHaveBeenCalled();
    });

    it("keeps the SOT-sized error block, clear control, retry request, and focus path live", async () => {
        const onQueryChange = vi.fn();
        const fetchMock = vi
            .fn<typeof fetch>()
            .mockRejectedValueOnce(new Error("Search unavailable"))
            .mockResolvedValueOnce(
                new Response(JSON.stringify({ results: [] }), {
                    headers: { "Content-Type": "application/json" },
                }),
            );
        vi.stubGlobal("fetch", fetchMock);

        const view = renderLibrarySearch({
            onApplyFilter: vi.fn(),
            onOpenChange: vi.fn(),
            onOpenRecording: vi.fn(),
            onQueryChange,
            open: true,
            query: "Alpha",
        });
        await waitForLibrarySearchRender(view, (tree) =>
            Boolean(
                findElement(
                    tree,
                    (props) =>
                        props.children === "Search failed. Try again later.",
                ),
            ),
        );

        const error = findElement(
            view.tree,
            (props) =>
                typeof props.className === "string" &&
                props.className.includes("py-[18px]"),
        );
        const errorTitle = findElement(
            error,
            (props) =>
                typeof props.className === "string" &&
                props.className.includes("line-clamp-none"),
        );
        const clear = findElement(
            view.tree,
            (props) => props["aria-label"] === "Clear search",
        );
        const retry = findElement(error, (props) => props.children === "Retry");

        expect(error?.props.layout).toBe("centered");
        expect(error?.props.className).toContain("gap-[8px]");
        expect(error?.props.className).toContain("px-[16px]");
        expect(errorTitle?.props.children).toBe(
            "Search failed. Try again later.",
        );
        expect(clear).toBeDefined();
        expect(retry?.props.variant).toBe("ghost");
        expect(retry?.props.className).toContain("h-[26px]");

        (retry?.props.onClick as () => void)();
        expect(reactHarness.consumePendingRender()).toBe(true);
        view.rerender();
        await vi.waitFor(() => {
            expect(fetchMock).toHaveBeenLastCalledWith(
                "/api/search?q=Alpha&limit=8&_retry=1",
            );
        });

        (clear?.props.onClick as () => void)();
        expect(onQueryChange).toHaveBeenCalledWith("");
    });

    it("keeps the indexing progress geometry and disabled search controls aligned with the SOT", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(() =>
                Promise.resolve(
                    new Response(
                        JSON.stringify({
                            indexing: {
                                active: true,
                                completedJobs: 2,
                                indexingJobs: 2,
                                pendingJobs: 3,
                                totalJobs: 5,
                            },
                            results: [],
                        }),
                        { headers: { "Content-Type": "application/json" } },
                    ),
                ),
            ),
        );
        const view = renderLibrarySearch({
            onApplyFilter: vi.fn(),
            onOpenChange: vi.fn(),
            onOpenRecording: vi.fn(),
            onQueryChange: vi.fn(),
            open: true,
            query: "Alpha",
        });
        await waitForLibrarySearchRender(
            view,
            (tree) =>
                findElement(tree, (props) => props.role === "combobox")?.props[
                    "aria-disabled"
                ] === true,
        );

        const input = findElement(
            view.tree,
            (props) => props.role === "combobox",
        );
        const indexingState = findElement(
            view.tree,
            (props) => props["aria-live"] === "polite",
        );
        const progress = findElement(
            indexingState,
            (props) =>
                typeof props.className === "string" &&
                props.className.includes("w-[36%]"),
        );
        const track = findElement(
            indexingState,
            (props) =>
                typeof props.className === "string" &&
                props.className.includes("h-1 w-full"),
        );
        const progressbar = findElement(
            indexingState,
            (props) => props.role === "progressbar",
        );
        const copy = findElement(
            indexingState,
            (props) =>
                typeof props.className === "string" &&
                props.className.includes("px-[16px] py-[22px]"),
        );

        expect(input?.props["aria-disabled"]).toBe(true);
        expect(input?.props.readOnly).toBe(true);
        expect(indexingState?.props.className).toContain("gap-[10px]");
        expect(indexingState?.props.className).toContain("px-[16px] py-[14px]");
        expect(progressbar?.props.className).toContain("min-w-0 flex-1");
        expect(progressbar?.props["aria-valuetext"]).toBe(
            "Rebuilding search index",
        );
        expect(track?.props.className).toContain(
            "bg-[color-mix(in_srgb,var(--signal-info)_16%,transparent)]",
        );
        expect(progress?.props.className).toContain(
            "bg-[linear-gradient(90deg,transparent,var(--signal-info)_50%,transparent)]",
        );
        expect(progress?.props.className).toContain(
            "animate-[sbn-sweep_1.4s_linear_infinite]",
        );
        expect(copy?.props.className).toContain("px-[16px] py-[22px]");
    });
});
