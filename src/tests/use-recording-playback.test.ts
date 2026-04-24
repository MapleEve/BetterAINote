import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Cleanup = (() => void) | undefined;

function areDependenciesEqual(
    previous: unknown[] | undefined,
    next: unknown[] | undefined,
) {
    if (previous === undefined || next === undefined) {
        return false;
    }

    if (previous.length !== next.length) {
        return false;
    }

    return previous.every((value, index) => Object.is(value, next[index]));
}

function createHookHarness() {
    type StateHook<T> = {
        kind: "state";
        setValue: (value: T | ((previous: T) => T)) => void;
        value: T;
    };
    type RefHook<T> = {
        current: {
            current: T;
        };
        kind: "ref";
    };
    type CallbackHook<T extends (...args: never[]) => unknown> = {
        deps: unknown[] | undefined;
        kind: "callback";
        value: T;
    };
    type EffectHook = {
        cleanup?: Cleanup;
        deps: unknown[] | undefined;
        effect: () => Cleanup;
        kind: "effect";
        pending: boolean;
    };
    type SyncExternalStoreHook<T> = {
        cleanup?: Cleanup;
        getSnapshot: () => T;
        kind: "sync-external-store";
        pending: boolean;
        subscribe: (listener: () => void) => () => void;
        value: T;
    };
    type HookEntry =
        | CallbackHook<(...args: never[]) => unknown>
        | EffectHook
        | RefHook<unknown>
        | StateHook<unknown>
        | SyncExternalStoreHook<unknown>;

    let beforeEffects: ((value: unknown) => void) | undefined;
    let component: (() => unknown) | null = null;
    let hookCursor = 0;
    let hooks: HookEntry[] = [];
    let pendingRender = false;
    let result: unknown;

    const queueRender = () => {
        pendingRender = true;
    };

    const flushPendingEffects = () => {
        for (const hook of hooks) {
            if (!hook || !("pending" in hook) || !hook.pending) {
                continue;
            }

            if (typeof hook.cleanup === "function") {
                hook.cleanup();
            }

            if (hook.kind === "effect") {
                hook.cleanup = hook.effect();
            } else {
                const syncHook = hook as SyncExternalStoreHook<unknown>;
                const handleStoreChange = () => {
                    const nextValue = syncHook.getSnapshot();
                    if (!Object.is(syncHook.value, nextValue)) {
                        syncHook.value = nextValue;
                        queueRender();
                    }
                };

                syncHook.cleanup = syncHook.subscribe(handleStoreChange);
                handleStoreChange();
            }

            hook.pending = false;
        }
    };

    const renderCurrent = () => {
        if (!component) {
            throw new Error("No component is mounted");
        }

        do {
            pendingRender = false;
            hookCursor = 0;
            result = component();
            beforeEffects?.(result);
            flushPendingEffects();
        } while (pendingRender);

        return result;
    };

    const cleanupMountedHooks = () => {
        for (const hook of hooks) {
            if (
                hook &&
                "kind" in hook &&
                hook.kind === "effect" &&
                typeof hook.cleanup === "function"
            ) {
                hook.cleanup();
            }

            if (
                hook &&
                "kind" in hook &&
                hook.kind === "sync-external-store" &&
                typeof hook.cleanup === "function"
            ) {
                hook.cleanup();
            }
        }
    };

    return {
        flush() {
            if (!component || !pendingRender) {
                return result;
            }

            return renderCurrent();
        },
        getResult<T>() {
            return result as T;
        },
        reactModule: {
            useCallback<T extends (...args: never[]) => unknown>(
                callback: T,
                deps?: unknown[],
            ) {
                const hookIndex = hookCursor++;
                const currentHook = hooks[hookIndex];

                if (
                    currentHook &&
                    currentHook.kind === "callback" &&
                    areDependenciesEqual(currentHook.deps, deps)
                ) {
                    return currentHook.value as T;
                }

                hooks[hookIndex] = {
                    kind: "callback",
                    deps,
                    value: callback,
                };

                return callback;
            },
            useEffect(effect: () => Cleanup, deps?: unknown[]) {
                const hookIndex = hookCursor++;
                const currentHook = hooks[hookIndex];

                if (currentHook && currentHook.kind === "effect") {
                    currentHook.effect = effect;
                    currentHook.pending = !areDependenciesEqual(
                        currentHook.deps,
                        deps,
                    );
                    currentHook.deps = deps;
                    return;
                }

                hooks[hookIndex] = {
                    kind: "effect",
                    cleanup: undefined,
                    deps,
                    effect,
                    pending: true,
                };
            },
            useRef<T>(initialValue: T) {
                const hookIndex = hookCursor++;
                const currentHook = hooks[hookIndex];

                if (currentHook && currentHook.kind === "ref") {
                    return currentHook.current as { current: T };
                }

                const ref = { current: initialValue };
                hooks[hookIndex] = {
                    kind: "ref",
                    current: ref,
                };
                return ref;
            },
            useState<T>(initialValue: T | (() => T)) {
                const hookIndex = hookCursor++;
                const currentHook = hooks[hookIndex];

                if (currentHook && currentHook.kind === "state") {
                    return [
                        currentHook.value as T,
                        currentHook.setValue as (
                            value: T | ((previous: T) => T),
                        ) => void,
                    ] as const;
                }

                const resolvedInitialValue =
                    typeof initialValue === "function"
                        ? (initialValue as () => T)()
                        : initialValue;

                const stateHook: StateHook<T> = {
                    kind: "state",
                    value: resolvedInitialValue,
                    setValue(nextValue) {
                        const resolvedValue =
                            typeof nextValue === "function"
                                ? (nextValue as (previous: T) => T)(
                                      stateHook.value,
                                  )
                                : nextValue;

                        if (!Object.is(stateHook.value, resolvedValue)) {
                            stateHook.value = resolvedValue;
                            queueRender();
                        }
                    },
                };

                hooks[hookIndex] = stateHook as StateHook<unknown>;

                return [stateHook.value, stateHook.setValue] as const;
            },
            useSyncExternalStore<T>(
                subscribe: (listener: () => void) => () => void,
                getSnapshot: () => T,
            ) {
                const hookIndex = hookCursor++;
                const currentHook = hooks[hookIndex];

                if (currentHook && currentHook.kind === "sync-external-store") {
                    currentHook.subscribe = subscribe;
                    currentHook.getSnapshot = getSnapshot;
                    currentHook.pending =
                        currentHook.pending ||
                        currentHook.subscribe !== subscribe ||
                        currentHook.getSnapshot !== getSnapshot;
                    const nextValue = getSnapshot();
                    if (!Object.is(currentHook.value, nextValue)) {
                        currentHook.value = nextValue;
                    }
                    return currentHook.value as T;
                }

                const syncHook: SyncExternalStoreHook<T> = {
                    kind: "sync-external-store",
                    cleanup: undefined,
                    getSnapshot,
                    pending: true,
                    subscribe,
                    value: getSnapshot(),
                };
                hooks[hookIndex] = syncHook as SyncExternalStoreHook<unknown>;
                return syncHook.value;
            },
        },
        render<T>(
            nextComponent: () => T,
            options?: {
                beforeEffects?: (value: T) => void;
            },
        ) {
            component = nextComponent;
            beforeEffects = options?.beforeEffects as
                | ((value: unknown) => void)
                | undefined;
            return renderCurrent() as T;
        },
        reset() {
            cleanupMountedHooks();
            beforeEffects = undefined;
            component = null;
            hookCursor = 0;
            hooks = [];
            pendingRender = false;
            result = undefined;
        },
    };
}

type HookHarness = ReturnType<typeof createHookHarness>;

const hookHarness = vi.hoisted<HookHarness>(() => createHookHarness());
const toastError = vi.hoisted(() => vi.fn());

vi.mock("react", () => hookHarness.reactModule);
vi.mock("sonner", () => ({
    toast: {
        error: toastError,
    },
}));
vi.mock("@/lib/platform/browser-shell", () => ({
    isEditableBrowserEventTarget: () => false,
    subscribeToBrowserWindowEvent: () => () => {},
    syncBrowserAudioElementSource: (audio: { src?: string }, src: string) => {
        audio.src = src;
    },
}));

import {
    __resetPlaybackSettingsStoreForTests,
    ensurePlaybackSettingsLoaded,
    savePlaybackSettings,
} from "@/features/settings/playback-settings-store";
import { useRecordingPlayback } from "@/hooks/use-recording-playback";

type AudioEventHandler = () => void;

function createAudioElementStub() {
    const listeners = new Map<string, Set<AudioEventHandler>>();

    return {
        currentTime: 0,
        duration: 180,
        pause: vi.fn(),
        playbackRate: 1,
        play: vi.fn().mockResolvedValue(undefined),
        src: "",
        volume: 0.75,
        load: vi.fn(),
        addEventListener(event: string, listener: AudioEventHandler) {
            const handlers =
                listeners.get(event) ?? new Set<AudioEventHandler>();
            handlers.add(listener);
            listeners.set(event, handlers);
        },
        dispatch(event: string) {
            const handlers = listeners.get(event);
            if (!handlers) {
                return;
            }

            for (const handler of handlers) {
                handler();
            }
        },
        removeEventListener(event: string, listener: AudioEventHandler) {
            listeners.get(event)?.delete(listener);
        },
    };
}

describe("useRecordingPlayback", () => {
    beforeEach(() => {
        hookHarness.reset();
        __resetPlaybackSettingsStoreForTests();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        hookHarness.reset();
        __resetPlaybackSettingsStoreForTests();
    });

    it("updates mounted playback state when shared settings change", async () => {
        const fetchMock = vi
            .fn<typeof fetch>()
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        defaultPlaybackSpeed: 1.0,
                        defaultVolume: 75,
                        autoPlayNext: false,
                    }),
                    {
                        status: 200,
                        headers: { "Content-Type": "application/json" },
                    },
                ),
            )
            .mockResolvedValueOnce(new Response(null, { status: 200 }));
        const audio = createAudioElementStub();
        const onEnded = vi.fn();

        vi.stubGlobal("fetch", fetchMock);

        hookHarness.render(
            () =>
                useRecordingPlayback({
                    audioUrl: "https://example.com/audio.mp3",
                    onEnded,
                }),
            {
                beforeEffects(playback) {
                    playback.audioRef.current =
                        audio as unknown as HTMLAudioElement;
                },
            },
        );

        await ensurePlaybackSettingsLoaded();
        hookHarness.flush();

        let playback =
            hookHarness.getResult<ReturnType<typeof useRecordingPlayback>>();

        expect(playback.volume).toBe(75);
        expect(playback.playbackSpeedLabel).toBe("1x");

        audio.dispatch("ended");
        expect(onEnded).not.toHaveBeenCalled();

        await savePlaybackSettings({
            defaultPlaybackSpeed: 1.5,
            defaultVolume: 35,
            autoPlayNext: true,
        });
        hookHarness.flush();

        playback =
            hookHarness.getResult<ReturnType<typeof useRecordingPlayback>>();

        expect(playback.volume).toBe(35);
        expect(playback.playbackSpeedLabel).toBe("1.5x");
        expect(audio.volume).toBeCloseTo(0.35);
        expect(audio.playbackRate).toBe(1.5);

        audio.dispatch("ended");
        expect(onEnded).toHaveBeenCalledTimes(1);
    });
});
