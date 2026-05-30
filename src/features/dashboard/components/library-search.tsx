"use client";

import { Loader2, Search, X } from "lucide-react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SearchEntityType = "recording" | "transcript" | "speaker" | "tag";

type SearchResult = {
    entityType: SearchEntityType;
    entityId: string;
    recordingId: string | null;
    title: string | null;
    body: string;
    speaker: string | null;
    tags: string[];
    source: string | null;
    startMs: number | null;
    endMs: number | null;
};

interface LibrarySearchProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onOpenRecording: (recordingId: string) => void;
}

const SEARCH_SCOPES: Array<{
    value: "all" | SearchEntityType;
    label: string;
}> = [
    { value: "all", label: "全部" },
    { value: "recording", label: "录音" },
    { value: "transcript", label: "逐字稿" },
    { value: "speaker", label: "说话人" },
    { value: "tag", label: "标签" },
];

function formatTime(ms: number | null) {
    if (ms === null || !Number.isFinite(ms)) {
        return null;
    }

    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function getTypeLabel(type: SearchEntityType) {
    switch (type) {
        case "recording":
            return "录音";
        case "transcript":
            return "逐字稿";
        case "speaker":
            return "说话人";
        case "tag":
            return "标签";
    }
}

function getTargetRecordingId(result: SearchResult) {
    if (result.recordingId) {
        return result.recordingId;
    }

    return result.entityType === "recording" ? result.entityId : null;
}

export function LibrarySearch({
    open,
    onOpenChange,
    onOpenRecording,
}: LibrarySearchProps) {
    const rootRef = useRef<HTMLElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [query, setQuery] = useState("");
    const [scope, setScope] = useState<"all" | SearchEntityType>("all");
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeResultIndex, setActiveResultIndex] = useState(0);

    const trimmedQuery = query.trim();
    const panelState = !trimmedQuery
        ? "no-query"
        : loading
          ? "loading"
          : error
            ? "error"
            : results.length > 0
              ? "results"
              : "no-results";

    const resultCountLabel = useMemo(() => {
        if (!trimmedQuery) {
            return "输入关键词开始搜索";
        }

        if (loading) {
            return "检索中";
        }

        return `${results.length} 个结果`;
    }, [loading, results.length, trimmedQuery]);

    const closeAndReturnFocus = useCallback(
        (options: { returnFocus?: boolean } = {}) => {
            onOpenChange(false);
            if (options.returnFocus === false) {
                return;
            }
            window.setTimeout(() => {
                triggerRef.current?.focus({ preventScroll: true });
            }, 0);
        },
        [onOpenChange],
    );

    useEffect(() => {
        if (!open) {
            return;
        }

        window.setTimeout(() => {
            inputRef.current?.focus({ preventScroll: true });
        }, 0);
    }, [open]);

    useEffect(() => {
        if (!open) {
            return;
        }

        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target;
            if (!(target instanceof Node)) {
                return;
            }
            if (!rootRef.current?.contains(target)) {
                closeAndReturnFocus({ returnFocus: false });
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                closeAndReturnFocus();
            }
        };

        document.addEventListener("pointerdown", handlePointerDown);
        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("pointerdown", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [closeAndReturnFocus, open]);

    useEffect(() => {
        if (!trimmedQuery) {
            setResults([]);
            setActiveResultIndex(0);
            setError(null);
            setLoading(false);
            return;
        }

        setResults([]);
        setActiveResultIndex(0);
        setError(null);
        setLoading(true);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            const params = new URLSearchParams({
                q: trimmedQuery,
                limit: "12",
            });
            if (scope !== "all") {
                params.set("type", scope);
            }

            fetch(`/api/search?${params.toString()}`, {
                method: "GET",
                cache: "no-store",
                signal: controller.signal,
            })
                .then(async (response) => {
                    const data = await response.json().catch(() => ({}));
                    if (!response.ok) {
                        throw new Error(
                            typeof data.error === "string"
                                ? data.error
                                : "Search failed",
                        );
                    }
                    setResults(Array.isArray(data.results) ? data.results : []);
                    setActiveResultIndex(0);
                })
                .catch((searchError) => {
                    if (controller.signal.aborted) {
                        return;
                    }
                    setResults([]);
                    setError(
                        searchError instanceof Error
                            ? searchError.message
                            : "Search failed",
                    );
                })
                .finally(() => {
                    if (!controller.signal.aborted) {
                        setLoading(false);
                    }
                });
        }, 250);

        return () => {
            clearTimeout(timeoutId);
            controller.abort();
        };
    }, [scope, trimmedQuery]);

    const handleResultOpen = useCallback(
        (recordingId: string | null) => {
            if (!recordingId) {
                return;
            }

            onOpenRecording(recordingId);
            closeAndReturnFocus();
        },
        [closeAndReturnFocus, onOpenRecording],
    );

    const handleInputKeyDown = useCallback(
        (event: ReactKeyboardEvent<HTMLInputElement>) => {
            if (results.length === 0) {
                return;
            }

            if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveResultIndex((current) =>
                    Math.min(current + 1, results.length - 1),
                );
                return;
            }

            if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveResultIndex((current) => Math.max(current - 1, 0));
                return;
            }

            if (event.key === "Enter") {
                event.preventDefault();
                handleResultOpen(
                    getTargetRecordingId(results[activeResultIndex]),
                );
            }
        },
        [activeResultIndex, handleResultOpen, results],
    );

    return (
        <search
            ref={rootRef}
            aria-label="资料搜索"
            className="relative shrink-0"
            data-testid="library-search"
        >
            <Button
                ref={triggerRef}
                type="button"
                variant="outline"
                size="icon"
                aria-controls="library-search-panel"
                aria-expanded={open}
                aria-haspopup="dialog"
                aria-label="打开搜索"
                className="h-9 w-9 rounded-xl border-border/70 bg-background/45"
                data-testid="library-search-trigger"
                onClick={() => {
                    if (open) {
                        closeAndReturnFocus();
                        return;
                    }
                    onOpenChange(true);
                }}
            >
                <Search className="h-4 w-4" />
            </Button>

            {open ? (
                <section
                    id="library-search-panel"
                    role="dialog"
                    aria-label="搜索库"
                    data-state={panelState}
                    data-testid="library-search-panel"
                    className="absolute top-11 right-0 z-40 flex max-h-[min(calc(100svh-6rem),34rem)] w-[min(calc(100vw-1.5rem),28.75rem)] flex-col overflow-hidden rounded-xl border border-border/80 bg-popover text-popover-foreground shadow-2xl"
                >
                    <div className="flex items-center gap-2 border-border/70 border-b px-3 py-2.5">
                        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <input
                            ref={inputRef}
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="搜索录音、逐字稿、说话人、标签"
                            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                            aria-label="搜索录音、逐字稿、说话人、标签"
                            aria-activedescendant={
                                results.length > 0
                                    ? `library-search-result-${activeResultIndex}`
                                    : undefined
                            }
                            autoComplete="off"
                            onKeyDown={handleInputKeyDown}
                        />
                        {query ? (
                            <button
                                type="button"
                                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                aria-label="清空搜索"
                                onClick={() => {
                                    setQuery("");
                                    inputRef.current?.focus({
                                        preventScroll: true,
                                    });
                                }}
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        ) : null}
                    </div>

                    <fieldset className="flex flex-wrap gap-1 border-border/70 border-b bg-muted/35 px-3 py-2">
                        <legend className="sr-only">检索范围</legend>
                        {SEARCH_SCOPES.map((item) => (
                            <button
                                key={item.value}
                                type="button"
                                aria-pressed={scope === item.value}
                                data-active={scope === item.value}
                                className="inline-flex h-7 items-center rounded-full border border-border/70 px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-background/80 hover:text-foreground data-[active=true]:border-primary/35 data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
                                onClick={() => {
                                    setScope(item.value);
                                    setActiveResultIndex(0);
                                }}
                            >
                                {item.label}
                            </button>
                        ))}
                    </fieldset>

                    <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
                        {!trimmedQuery ? (
                            <div
                                className="px-4 py-8 text-center text-muted-foreground text-sm"
                                data-testid="library-search-no-query"
                            >
                                输入关键字搜索录音、逐字稿片段、说话人或标签
                            </div>
                        ) : null}

                        {loading ? (
                            <div
                                className="flex items-center justify-center gap-2 px-4 py-8 text-muted-foreground text-sm"
                                data-testid="library-search-loading"
                            >
                                <Loader2 className="h-4 w-4 animate-spin" />
                                检索中
                            </div>
                        ) : null}

                        {error ? (
                            <div
                                className="px-4 py-8 text-center"
                                data-testid="library-search-error"
                            >
                                <p className="text-destructive text-sm">
                                    检索失败，请稍后重试。
                                </p>
                            </div>
                        ) : null}

                        {!loading && !error && results.length > 0 ? (
                            <div data-testid="library-search-results">
                                <div className="flex items-center justify-between px-2 py-1.5 text-muted-foreground text-xs">
                                    <span>{resultCountLabel}</span>
                                    <span>最多显示 12 条</span>
                                </div>
                                <div className="overflow-hidden rounded-lg border border-border/60 bg-background/35">
                                    {results.map((result, index) => {
                                        const start = formatTime(
                                            result.startMs,
                                        );
                                        const end = formatTime(result.endMs);
                                        const timeRange =
                                            start && end
                                                ? `${start} - ${end}`
                                                : null;
                                        const targetRecordingId =
                                            getTargetRecordingId(result);
                                        const isActive =
                                            index === activeResultIndex;

                                        return (
                                            <button
                                                key={`${result.entityType}-${result.entityId}-${result.startMs ?? 0}`}
                                                id={`library-search-result-${index}`}
                                                type="button"
                                                role="option"
                                                aria-selected={isActive}
                                                aria-disabled={
                                                    targetRecordingId
                                                        ? undefined
                                                        : true
                                                }
                                                data-active={
                                                    isActive ? "true" : "false"
                                                }
                                                className={cn(
                                                    "grid w-full grid-cols-[auto_minmax(0,1fr)] gap-2 border-border/60 border-b px-3 py-2.5 text-left transition-colors last:border-b-0",
                                                    targetRecordingId
                                                        ? "hover:bg-accent/45 data-[active=true]:bg-accent/60"
                                                        : "cursor-default opacity-70",
                                                )}
                                                onMouseEnter={() =>
                                                    setActiveResultIndex(index)
                                                }
                                                onClick={() =>
                                                    handleResultOpen(
                                                        targetRecordingId,
                                                    )
                                                }
                                            >
                                                <span className="mt-0.5 inline-flex h-6 shrink-0 items-center rounded-md border border-border/70 bg-muted/40 px-1.5 text-muted-foreground text-xs">
                                                    {getTypeLabel(
                                                        result.entityType,
                                                    )}
                                                </span>
                                                <span className="min-w-0">
                                                    <span className="block truncate font-medium text-sm">
                                                        {result.title ||
                                                            "未命名结果"}
                                                    </span>
                                                    <span className="mt-1 block line-clamp-2 text-muted-foreground text-xs leading-5">
                                                        {result.body}
                                                    </span>
                                                    <span className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-muted-foreground text-[0.68rem]">
                                                        {timeRange ? (
                                                            <span>
                                                                {timeRange}
                                                            </span>
                                                        ) : null}
                                                        {result.speaker ? (
                                                            <span>
                                                                {result.speaker}
                                                            </span>
                                                        ) : null}
                                                        {result.source ? (
                                                            <span>
                                                                {result.source}
                                                            </span>
                                                        ) : null}
                                                    </span>
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : null}

                        {!loading &&
                        !error &&
                        trimmedQuery &&
                        results.length === 0 ? (
                            <div
                                className="px-4 py-8 text-center text-muted-foreground text-sm"
                                data-testid="library-search-no-results"
                            >
                                没有找到与「{trimmedQuery}」相关的内容
                            </div>
                        ) : null}
                    </div>
                </section>
            ) : null}
        </search>
    );
}
