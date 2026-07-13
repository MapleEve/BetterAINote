import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const reactHarness = vi.hoisted(() => {
    let cursor = 0;
    let slots: unknown[] = [];

    return {
        beginRender() {
            cursor = 0;
        },
        reset() {
            cursor = 0;
            slots = [];
        },
        useMemo<T>(factory: () => T) {
            cursor += 1;
            return factory();
        },
        useState<T>(initialValue: T | (() => T)) {
            const index = cursor++;
            if (!(index in slots)) {
                slots[index] =
                    typeof initialValue === "function"
                        ? (initialValue as () => T)()
                        : initialValue;
            }
            return [
                slots[index] as T,
                (nextValue: T | ((previous: T) => T)) => {
                    const previous = slots[index] as T;
                    slots[index] =
                        typeof nextValue === "function"
                            ? (nextValue as (value: T) => T)(previous)
                            : nextValue;
                },
            ] as const;
        },
    };
});

vi.mock("react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("react")>();
    return {
        ...actual,
        useMemo: reactHarness.useMemo,
        useState: reactHarness.useState,
    };
});

vi.mock("@/components/language-provider", () => ({
    useLanguage: () => ({ language: "zh-CN" }),
}));

vi.mock("sonner", () => ({
    toast: { error: vi.fn() },
}));

import { PopoverContent } from "@/components/ui/popover";
import { RecordingTagManager } from "@/features/recordings/components/recording-tag-manager";
import type { RecordingTag } from "@/lib/recording-tags";

type Props = Record<string, unknown>;

const tag: RecordingTag = {
    color: "blue",
    icon: "grid",
    id: "tag-1",
    name: "Review",
};

const recording = (tags: RecordingTag[] = []) =>
    ({ id: "recording-1", tags }) as Parameters<
        typeof RecordingTagManager
    >[0]["recording"];

function response(data: unknown, ok = true) {
    return { json: async () => data, ok } as Response;
}

function textContent(node: unknown): string {
    if (typeof node === "string" || typeof node === "number") {
        return String(node);
    }
    if (Array.isArray(node)) return node.map(textContent).join("");
    if (!node || typeof node !== "object") return "";
    return textContent((node as ReactElement<Props>).props?.children);
}

function findElement(
    node: unknown,
    predicate: (props: Props, text: string) => boolean,
): ReactElement<Props> | undefined {
    if (Array.isArray(node)) {
        for (const child of node) {
            const match = findElement(child, predicate);
            if (match) return match;
        }
        return undefined;
    }
    if (!node || typeof node !== "object") return undefined;

    const element = node as ReactElement<Props>;
    const text = textContent(element.props?.children);
    if (element.props && predicate(element.props, text)) return element;

    return findElement(element.props?.children, predicate);
}

function renderManager(
    props: Partial<Parameters<typeof RecordingTagManager>[0]> = {},
) {
    reactHarness.beginRender();
    return RecordingTagManager({
        availableTags: [tag],
        onAvailableTagsChange: vi.fn(),
        onRecordingTagsChange: vi.fn(),
        recording: recording(),
        ...props,
    });
}

function findButton(tree: unknown, label: string) {
    const button = findElement(
        tree,
        (props, text) =>
            typeof props.onClick === "function" &&
            (props["aria-label"] === label || text.includes(label)),
    );
    expect(button).toBeDefined();
    return button as ReactElement<Props>;
}

async function settle() {
    for (let index = 0; index < 8; index += 1) {
        await Promise.resolve();
    }
}

describe("recording tag manager runtime and semantic regression", () => {
    beforeEach(() => {
        reactHarness.reset();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("keeps the empty state and accessible create controls available", () => {
        const tree = renderManager({
            availableTags: [],
            recording: recording(),
        });

        expect(textContent(tree)).toContain("还没有任何标签");
        expect(textContent(tree)).toContain("在下方为这条录音创建第一个标签。");
        expect(
            findElement(tree, (props) => props.placeholder === "新建标签…"),
        ).toBeDefined();
    });

    it("uses the shared PopoverContent with the manager positioning and panel classes", () => {
        const tree = renderManager();
        const popoverContent = findElement(
            tree,
            (props) =>
                props["aria-label"] === "管理标签" && props.align === "end",
        );

        expect(popoverContent).toBeDefined();
        expect(popoverContent?.type).toBe(PopoverContent);
        expect(popoverContent?.props.side).toBe("bottom");
        expect(popoverContent?.props.sideOffset).toBe(8);
        expect(popoverContent?.props.avoidCollisions).toBe(false);
        expect(popoverContent?.props.className).toContain("tagm-panel");
    });

    it("creates a chosen color and icon tag, exposes loading semantics, and supports cancellation", async () => {
        let resolveCreate: ((value: Response) => void) | undefined;
        const onAvailableTagsChange = vi.fn();
        const onRecordingTagsChange = vi.fn();
        const fetchMock = vi.fn((url: string, init?: RequestInit) => {
            if (url === "/api/recording-tags") {
                return new Promise<Response>((resolve) => {
                    resolveCreate = resolve;
                });
            }
            if (url === "/api/recordings/recording-1/tags") {
                return Promise.resolve(response({ tags: [tag] }));
            }
            throw new Error(`Unexpected request: ${url}`);
        });
        vi.stubGlobal("fetch", fetchMock);

        let tree = renderManager({
            onAvailableTagsChange,
            onRecordingTagsChange,
        });
        const quickInput = findElement(
            tree,
            (props) => props.placeholder === "新建标签…",
        );
        (
            quickInput?.props.onChange as (event: {
                target: { value: string };
            }) => void
        )({ target: { value: "Follow up" } });
        tree = renderManager({ onAvailableTagsChange, onRecordingTagsChange });

        const colorPicker = findElement(
            tree,
            (props) =>
                props["aria-label"] === "颜色" &&
                typeof props.onValueChange === "function",
        );
        (colorPicker?.props.onValueChange as (value: string) => void)("red");
        const iconPicker = findElement(
            tree,
            (props) =>
                props["aria-label"] === "图标" &&
                typeof props.onValueChange === "function",
        );
        (iconPicker?.props.onValueChange as (value: string) => void)("star");
        tree = renderManager({ onAvailableTagsChange, onRecordingTagsChange });

        (findButton(tree, "创建").props.onClick as () => void)();
        tree = renderManager({ onAvailableTagsChange, onRecordingTagsChange });
        const busyInput = findElement(
            tree,
            (props) => props.placeholder === "标签名",
        );
        expect(busyInput?.props.disabled).toBe(true);
        expect(findButton(tree, "创建").props["aria-busy"]).toBe("true");
        const busyColorPicker = findElement(
            tree,
            (props) =>
                props["aria-label"] === "颜色" &&
                typeof props.onValueChange === "function",
        );
        const busyIconPicker = findElement(
            tree,
            (props) =>
                props["aria-label"] === "图标" &&
                typeof props.onValueChange === "function",
        );
        expect(busyColorPicker?.props.disabled).toBe(true);
        expect(busyColorPicker?.props["aria-disabled"]).toBe(true);
        expect(busyIconPicker?.props.disabled).toBe(true);
        expect(busyIconPicker?.props["aria-disabled"]).toBe(true);

        (busyColorPicker?.props.onValueChange as (value: string) => void)(
            "blue",
        );
        (busyIconPicker?.props.onValueChange as (value: string) => void)(
            "heart",
        );
        tree = renderManager({ onAvailableTagsChange, onRecordingTagsChange });

        expect(
            findElement(
                tree,
                (props) =>
                    props["aria-label"] === "颜色" &&
                    typeof props.onValueChange === "function",
            )?.props.value,
        ).toBe("red");
        expect(
            findElement(
                tree,
                (props) =>
                    props["aria-label"] === "图标" &&
                    typeof props.onValueChange === "function",
            )?.props.value,
        ).toBe("star");

        const createdTag = {
            ...tag,
            color: "red" as const,
            icon: "star" as const,
            id: "tag-2",
            name: "Follow up",
        };
        resolveCreate?.(response({ tag: createdTag }));
        await settle();

        expect(
            JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string),
        ).toEqual({
            color: "red",
            icon: "star",
            name: "Follow up",
        });
        expect(onAvailableTagsChange).toHaveBeenLastCalledWith([
            createdTag,
            tag,
        ]);
        expect(onRecordingTagsChange).toHaveBeenLastCalledWith("recording-1", [
            tag,
        ]);

        tree = renderManager({ onAvailableTagsChange, onRecordingTagsChange });
        const nextInput = findElement(
            tree,
            (props) => props.placeholder === "新建标签…",
        );
        (
            nextInput?.props.onChange as (event: {
                target: { value: string };
            }) => void
        )({ target: { value: "Discard me" } });
        tree = renderManager({ onAvailableTagsChange, onRecordingTagsChange });
        (findButton(tree, "取消").props.onClick as () => void)();
        tree = renderManager({ onAvailableTagsChange, onRecordingTagsChange });
        expect(
            findElement(tree, (props) => props.placeholder === "新建标签…")
                ?.props.value,
        ).toBe("");
    });

    it("retries failed create and delete requests with their captured payloads and targets", async () => {
        const onAvailableTagsChange = vi.fn();
        const onRecordingTagsChange = vi.fn();
        const createdTag = {
            ...tag,
            color: "red" as const,
            icon: "star" as const,
            id: "tag-2",
            name: "Original",
        };
        let createAttempts = 0;
        let deleteAttempts = 0;
        const fetchMock = vi.fn((url: string, init?: RequestInit) => {
            if (url === "/api/recording-tags") {
                createAttempts += 1;
                return Promise.resolve(
                    createAttempts === 1
                        ? response({ error: "Create failed" }, false)
                        : response({ tag: createdTag }),
                );
            }
            if (url === "/api/recordings/recording-1/tags") {
                return Promise.resolve(response({ tags: [createdTag] }));
            }
            if (url === "/api/recording-tags/tag-1") {
                deleteAttempts += 1;
                return Promise.resolve(
                    deleteAttempts === 1
                        ? response({ error: "Delete failed" }, false)
                        : response({}),
                );
            }
            throw new Error(
                `Unexpected request: ${url} ${String(init?.method)}`,
            );
        });
        vi.stubGlobal("fetch", fetchMock);

        let tree = renderManager({
            onAvailableTagsChange,
            onRecordingTagsChange,
        });
        const quickInput = findElement(
            tree,
            (props) => props.placeholder === "新建标签…",
        );
        (
            quickInput?.props.onChange as (event: {
                target: { value: string };
            }) => void
        )({ target: { value: "Original" } });
        tree = renderManager({ onAvailableTagsChange, onRecordingTagsChange });
        const colorPicker = findElement(
            tree,
            (props) =>
                props["aria-label"] === "颜色" &&
                typeof props.onValueChange === "function",
        );
        const iconPicker = findElement(
            tree,
            (props) =>
                props["aria-label"] === "图标" &&
                typeof props.onValueChange === "function",
        );
        (colorPicker?.props.onValueChange as (value: string) => void)("red");
        (iconPicker?.props.onValueChange as (value: string) => void)("star");
        tree = renderManager({ onAvailableTagsChange, onRecordingTagsChange });
        (findButton(tree, "创建").props.onClick as () => void)();
        await settle();

        tree = renderManager({ onAvailableTagsChange, onRecordingTagsChange });
        expect(textContent(tree)).toContain("Create failed");
        const retryNameInput = findElement(
            tree,
            (props) => props.placeholder === "标签名",
        );
        (
            retryNameInput?.props.onChange as (event: {
                target: { value: string };
            }) => void
        )({ target: { value: "Changed" } });
        const retryColorPicker = findElement(
            tree,
            (props) =>
                props["aria-label"] === "颜色" &&
                typeof props.onValueChange === "function",
        );
        const retryIconPicker = findElement(
            tree,
            (props) =>
                props["aria-label"] === "图标" &&
                typeof props.onValueChange === "function",
        );
        (retryColorPicker?.props.onValueChange as (value: string) => void)(
            "blue",
        );
        (retryIconPicker?.props.onValueChange as (value: string) => void)(
            "heart",
        );
        tree = renderManager({ onAvailableTagsChange, onRecordingTagsChange });
        (findButton(tree, "重试").props.onClick as () => void)();
        await settle();

        const createRequestBodies = fetchMock.mock.calls
            .filter(([url]) => url === "/api/recording-tags")
            .map(([, init]) =>
                JSON.parse((init as RequestInit).body as string),
            );
        expect(createRequestBodies).toEqual([
            { color: "red", icon: "star", name: "Original" },
            { color: "red", icon: "star", name: "Original" },
        ]);

        reactHarness.reset();
        tree = renderManager({
            onAvailableTagsChange,
            onRecordingTagsChange,
            recording: recording([tag]),
        });
        (findButton(tree, "移除").props.onClick as () => void)();
        tree = renderManager({
            onAvailableTagsChange,
            onRecordingTagsChange,
            recording: recording([tag]),
        });
        (findButton(tree, "删除标签").props.onClick as () => void)();
        await settle();

        tree = renderManager({
            onAvailableTagsChange,
            onRecordingTagsChange,
            recording: recording([tag]),
        });
        expect(textContent(tree)).toContain("Delete failed");
        (findButton(tree, "重试").props.onClick as () => void)();
        await settle();

        const deleteRequests = fetchMock.mock.calls.filter(
            ([url]) => url === "/api/recording-tags/tag-1",
        );
        expect(deleteRequests).toEqual([
            ["/api/recording-tags/tag-1", { method: "DELETE" }],
            ["/api/recording-tags/tag-1", { method: "DELETE" }],
        ]);
    });

    it("retries a failed toggle with its original tagIds payload before deleting a selected tag", async () => {
        const onAvailableTagsChange = vi.fn();
        const onRecordingTagsChange = vi.fn();
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(response({ error: "Save failed" }, false))
            .mockResolvedValueOnce(response({ tags: [] }))
            .mockResolvedValueOnce(response({}));
        vi.stubGlobal("fetch", fetchMock);

        let tree = renderManager({
            onAvailableTagsChange,
            onRecordingTagsChange,
            recording: recording([tag]),
        });
        const toggle = findElement(
            tree,
            (props) => props["aria-pressed"] === true,
        );
        (toggle?.props.onClick as () => void)();
        await settle();
        tree = renderManager({
            onAvailableTagsChange,
            onRecordingTagsChange,
            recording: recording(),
        });
        expect(textContent(tree)).toContain("Save failed");
        (findButton(tree, "重试").props.onClick as () => void)();
        await settle();

        const toggleRequestBodies = fetchMock.mock.calls.map(([, init]) =>
            JSON.parse((init as RequestInit).body as string),
        );
        expect(toggleRequestBodies).toEqual([{ tagIds: [] }, { tagIds: [] }]);
        expect(onRecordingTagsChange).toHaveBeenLastCalledWith(
            "recording-1",
            [],
        );

        reactHarness.reset();
        tree = renderManager({
            onAvailableTagsChange,
            onRecordingTagsChange,
            recording: recording([tag]),
        });
        (findButton(tree, "移除").props.onClick as () => void)();
        tree = renderManager({
            onAvailableTagsChange,
            onRecordingTagsChange,
            recording: recording([tag]),
        });
        expect(textContent(tree)).toContain("删除标签 · Review");
        (findButton(tree, "取消").props.onClick as () => void)();
        tree = renderManager({
            onAvailableTagsChange,
            onRecordingTagsChange,
            recording: recording([tag]),
        });
        expect(findButton(tree, "移除").props.disabled).toBe(false);

        (findButton(tree, "移除").props.onClick as () => void)();
        tree = renderManager({
            onAvailableTagsChange,
            onRecordingTagsChange,
            recording: recording([tag]),
        });
        (findButton(tree, "删除标签").props.onClick as () => void)();
        await settle();

        expect(fetchMock.mock.calls[2]?.[0]).toBe("/api/recording-tags/tag-1");
        expect(fetchMock.mock.calls[2]?.[1]).toEqual({ method: "DELETE" });
        expect(onAvailableTagsChange).toHaveBeenLastCalledWith([]);
        expect(onRecordingTagsChange).toHaveBeenLastCalledWith(
            "recording-1",
            [],
        );
    });
});
