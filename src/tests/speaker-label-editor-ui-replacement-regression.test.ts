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
        useCallback<T extends (...args: never[]) => unknown>(callback: T) {
            cursor += 1;
            return callback;
        },
        useEffect(effect: () => undefined | (() => void)) {
            const index = cursor++;
            if (!(index in slots)) {
                slots[index] = effect();
            }
        },
        useMemo<T>(factory: () => T) {
            cursor += 1;
            return factory();
        },
        useRef<T>(initialValue: T) {
            const index = cursor++;
            if (!(index in slots)) {
                slots[index] = { current: initialValue };
            }
            return slots[index] as { current: T };
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
        useCallback: reactHarness.useCallback,
        useEffect: reactHarness.useEffect,
        useMemo: reactHarness.useMemo,
        useRef: reactHarness.useRef,
        useState: reactHarness.useState,
    };
});

vi.mock("@/components/language-provider", () => ({
    useLanguage: () => ({
        language: "en",
        t: (key: string, replacements?: Record<string, string | number>) =>
            `${key}${replacements?.name ? `:${replacements.name}` : ""}`,
    }),
}));

vi.mock("@/lib/platform/browser-shell", () => ({
    startBrowserTimeout: (callback: () => void) => callback(),
}));

vi.mock("@/lib/platform/clipboard", () => ({
    writeBrowserClipboardText: vi.fn(),
}));

vi.mock("sonner", () => ({
    toast: { error: vi.fn(), success: vi.fn() },
}));

import { SpeakerLabelEditor } from "@/features/recordings/components/speaker-label-editor";

type Props = Record<string, unknown>;

const speaker = {
    rawLabel: "SPEAKER_00",
    matchedProfileId: null as string | null,
    matchedProfileName: null as string | null,
    hasVoiceprint: false,
    sampleSegments: [],
    sampleCount: 0,
    hasPlayableSample: false,
    segmentCount: 2,
    updatedAt: "2026-07-13T08:00:00.000Z",
};

function response(data: unknown, ok = true) {
    return { json: async () => data, ok } as Response;
}

function textContent(node: unknown): string {
    if (typeof node === "string" || typeof node === "number") {
        return String(node);
    }
    if (Array.isArray(node)) {
        return node.map(textContent).join("");
    }
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

    const children = element.props?.children;
    const candidates = Array.isArray(children) ? children : [children];
    for (const child of candidates) {
        const match = findElement(child, predicate);
        if (match) return match;
    }
    return undefined;
}

function renderEditor(onSpeakerMapChanged = vi.fn()) {
    reactHarness.beginRender();
    const tree = SpeakerLabelEditor({
        onSpeakerMapChanged,
        recordingId: "recording-1",
        speakerMap: {},
    });
    return { onSpeakerMapChanged, tree };
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

function configureApi(
    patchResponse: () => Response | Promise<Response> = () =>
        response({ profileId: "profile-1" }),
    recordingSpeaker = speaker,
) {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
        if (init?.method === "PATCH") return Promise.resolve(patchResponse());
        if (url.endsWith("/transcript/raw")) {
            return Promise.resolve(
                response({
                    transcript: {
                        characterCount: 12,
                        mappedSpeakerCount: 0,
                        text: "Raw transcript",
                        wordCount: 2,
                    },
                }),
            );
        }
        if (url.endsWith("/transcript/speakers")) {
            return Promise.resolve(
                response({
                    transcript: {
                        characterCount: 12,
                        mappedSpeakerCount: 0,
                        text: "Speaker transcript",
                        wordCount: 2,
                    },
                }),
            );
        }
        return Promise.resolve(
            response({
                profiles: [
                    {
                        displayName: "Jordan",
                        hasVoiceprint: true,
                        id: "profile-1",
                    },
                ],
                speakers: [recordingSpeaker],
            }),
        );
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
}

describe("speaker label editor semantic runtime regression", () => {
    beforeEach(() => {
        reactHarness.reset();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("maps an existing profile and creates a new profile through accessible controls", async () => {
        const fetchMock = configureApi();
        const { onSpeakerMapChanged } = renderEditor();
        await settle();

        let tree = renderEditor(onSpeakerMapChanged).tree;
        const mappingInput = findElement(
            tree,
            (props) =>
                props.placeholder ===
                "speakerReview.searchOrCreateSpeakerPlaceholder",
        );
        expect(mappingInput).toBeDefined();
        (mappingInput?.props.onFocus as () => void)();
        tree = renderEditor(onSpeakerMapChanged).tree;
        (
            mappingInput?.props.onChange as (event: {
                target: { value: string };
            }) => void
        )({
            target: { value: "Jordan" },
        });
        tree = renderEditor(onSpeakerMapChanged).tree;
        expect(
            findElement(
                tree,
                (props) =>
                    props.placeholder ===
                    "speakerReview.searchOrCreateSpeakerPlaceholder",
            )?.props.value,
        ).toBe("Jordan");
        (findButton(tree, "Jordan").props.onClick as () => void)();
        await settle();

        const firstPatchCalls = fetchMock.mock.calls.filter(
            ([, init]) => (init as RequestInit | undefined)?.method === "PATCH",
        );
        expect(firstPatchCalls).toHaveLength(1);
        expect(
            JSON.parse((firstPatchCalls[0]?.[1] as RequestInit).body as string),
        ).toEqual({
            profileId: "profile-1",
            rawLabel: "SPEAKER_00",
        });
        expect(onSpeakerMapChanged).toHaveBeenLastCalledWith({
            SPEAKER_00: "Jordan",
        });

        tree = renderEditor(onSpeakerMapChanged).tree;
        const refreshedInput = findElement(
            tree,
            (props) =>
                props.placeholder ===
                "speakerReview.searchOrCreateSpeakerPlaceholder",
        );
        (refreshedInput?.props.onFocus as () => void)();
        (
            refreshedInput?.props.onChange as (event: {
                target: { value: string };
            }) => void
        )({
            target: { value: "Avery" },
        });
        tree = renderEditor(onSpeakerMapChanged).tree;
        (
            findButton(tree, "speakerReview.createSpeakerOption:Avery").props
                .onClick as () => void
        )();
        await settle();

        const patchCalls = fetchMock.mock.calls.filter(
            ([, init]) => (init as RequestInit | undefined)?.method === "PATCH",
        );
        expect(patchCalls).toHaveLength(2);
        expect(
            JSON.parse((patchCalls[1]?.[1] as RequestInit).body as string),
        ).toEqual({
            profileId: null,
            profileName: "Avery",
            rawLabel: "SPEAKER_00",
        });
        expect(onSpeakerMapChanged).toHaveBeenLastCalledWith({
            SPEAKER_00: "Avery",
        });
    });

    it("requires confirmation before unlinking a mapped speaker", async () => {
        const fetchMock = configureApi(undefined, {
            ...speaker,
            matchedProfileId: "profile-1",
            matchedProfileName: "Jordan",
        });
        renderEditor();
        await settle();

        let tree = renderEditor().tree;
        const unlink = findButton(tree, "speakerReview.unlink");
        (unlink.props.onClick as () => void)();
        tree = renderEditor().tree;

        const confirm = findButton(tree, "speakerReview.unlink");
        (confirm.props.onClick as () => void)();
        await settle();

        const patchCalls = fetchMock.mock.calls.filter(
            ([, init]) => (init as RequestInit | undefined)?.method === "PATCH",
        );
        expect(patchCalls).toHaveLength(1);
        expect(
            JSON.parse((patchCalls[0]?.[1] as RequestInit).body as string),
        ).toEqual({
            profileId: null,
            rawLabel: "SPEAKER_00",
        });
    });

    it("keeps mapping input disabled while saving and exposes retry after a failed save", async () => {
        let resolvePatch: ((value: Response) => void) | undefined;
        configureApi(
            () =>
                new Promise<Response>((resolve) => {
                    resolvePatch = resolve;
                }),
        );
        renderEditor();
        await settle();

        let tree = renderEditor().tree;
        const mappingInput = findElement(
            tree,
            (props) =>
                props.placeholder ===
                "speakerReview.searchOrCreateSpeakerPlaceholder",
        );
        (mappingInput?.props.onFocus as () => void)();
        (
            mappingInput?.props.onChange as (event: {
                target: { value: string };
            }) => void
        )({
            target: { value: "Jordan" },
        });
        tree = renderEditor().tree;
        (findButton(tree, "Jordan").props.onClick as () => void)();
        tree = renderEditor().tree;

        const busyInput = findElement(
            tree,
            (props) =>
                props.placeholder ===
                "speakerReview.searchOrCreateSpeakerPlaceholder",
        );
        expect(busyInput?.props.disabled).toBe(true);
        expect(busyInput?.props["aria-busy"]).toBe(true);

        resolvePatch?.(response({ error: "Save failed" }, false));
        await settle();
        tree = renderEditor().tree;
        expect(findButton(tree, "common.retry").props.disabled).toBe(false);
    });
});
