"use client";

import { Loader2, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    onOpenRecording: (recordingId: string) => void;
}

const SEARCH_SCOPES: Array<{
    value: "all" | SearchEntityType;
    labelZh: string;
    labelEn: string;
}> = [
    { value: "all", labelZh: "全部", labelEn: "All" },
    { value: "recording", labelZh: "录音", labelEn: "Recordings" },
    { value: "transcript", labelZh: "逐字稿", labelEn: "Transcripts" },
    { value: "speaker", labelZh: "说话人", labelEn: "Speakers" },
    { value: "tag", labelZh: "标签", labelEn: "Tags" },
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

function getTypeLabel(type: SearchEntityType, isZh: boolean) {
    switch (type) {
        case "recording":
            return isZh ? "录音" : "Recording";
        case "transcript":
            return isZh ? "逐字稿" : "Transcript";
        case "speaker":
            return isZh ? "说话人" : "Speaker";
        case "tag":
            return isZh ? "标签" : "Tag";
    }
}

export function LibrarySearch({ onOpenRecording }: LibrarySearchProps) {
    const { language } = useLanguage();
    const isZh = language === "zh-CN";
    const inputRef = useRef<HTMLInputElement>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [scope, setScope] = useState<"all" | SearchEntityType>("all");
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const trimmedQuery = query.trim();
    const placeholder = isZh
        ? "搜索录音、逐字稿、说话人、标签"
        : "Search recordings, transcripts, speakers, tags";

    useEffect(() => {
        if (isOpen) {
            inputRef.current?.focus();
        }
    }, [isOpen]);

    const resultCountLabel = useMemo(() => {
        if (!trimmedQuery) {
            return isZh ? "输入关键词开始搜索" : "Type to search";
        }

        if (loading) {
            return isZh ? "搜索中" : "Searching";
        }

        return isZh
            ? `${results.length} 个结果`
            : `${results.length} result${results.length === 1 ? "" : "s"}`;
    }, [isZh, loading, results.length, trimmedQuery]);

    useEffect(() => {
        if (!trimmedQuery) {
            setResults([]);
            setError(null);
            setLoading(false);
            return;
        }

        setResults([]);
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
                cache: "no-store",
                signal: controller.signal,
            })
                .then(async (response) => {
                    const data = await response.json();
                    if (!response.ok) {
                        throw new Error(data.error || "Search failed");
                    }
                    setResults(Array.isArray(data.results) ? data.results : []);
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

    return (
        <search
            aria-label={isZh ? "资料搜索" : "Library search"}
            className="relative shrink-0"
            data-testid="library-search"
        >
            <Button
                type="button"
                variant="outline"
                size="icon"
                aria-expanded={isOpen}
                aria-label={isZh ? "打开搜索" : "Open search"}
                className="h-9 w-9"
                data-testid="library-search-trigger"
                onClick={() => setIsOpen((previous) => !previous)}
            >
                <Search className="h-4 w-4" />
            </Button>

            {isOpen ? (
                <section className="absolute top-11 right-0 z-50 w-[min(calc(100vw-2rem),42rem)] rounded-lg border border-border/70 bg-card/95 p-3 shadow-lg backdrop-blur">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                        <div className="relative min-w-0 flex-1">
                            <Search className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                ref={inputRef}
                                value={query}
                                onChange={(event) =>
                                    setQuery(event.target.value)
                                }
                                placeholder={placeholder}
                                className="h-10 pr-10 pl-9"
                                aria-label={placeholder}
                            />
                            {query ? (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="-translate-y-1/2 absolute top-1/2 right-1 h-8 w-8"
                                    aria-label={
                                        isZh ? "清空搜索" : "Clear search"
                                    }
                                    onClick={() => setQuery("")}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            ) : null}
                        </div>

                        <div className="flex shrink-0 flex-wrap gap-1 rounded-md border border-border/70 bg-background/40 p-1">
                            {SEARCH_SCOPES.map((item) => (
                                <Button
                                    key={item.value}
                                    type="button"
                                    variant={
                                        scope === item.value
                                            ? "secondary"
                                            : "ghost"
                                    }
                                    size="sm"
                                    className="h-8 px-3 text-xs"
                                    onClick={() => setScope(item.value)}
                                >
                                    {isZh ? item.labelZh : item.labelEn}
                                </Button>
                            ))}
                        </div>
                    </div>

                    {trimmedQuery ? (
                        <div className="mt-3 rounded-md border border-border/60 bg-background/45">
                            <div className="flex items-center justify-between border-b px-3 py-2 text-xs text-muted-foreground">
                                <span>{resultCountLabel}</span>
                                {loading ? (
                                    <span className="inline-flex items-center gap-1">
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        {isZh ? "搜索中" : "Searching"}
                                    </span>
                                ) : null}
                            </div>
                            {error ? (
                                <p className="px-3 py-3 text-sm text-destructive">
                                    {isZh
                                        ? "搜索失败，请稍后重试。"
                                        : "Search failed. Try again later."}
                                </p>
                            ) : results.length > 0 ? (
                                <div className="max-h-72 overflow-y-auto">
                                    {results.map((result) => {
                                        const start = formatTime(
                                            result.startMs,
                                        );
                                        const end = formatTime(result.endMs);
                                        const timeRange =
                                            start && end
                                                ? `${start} - ${end}`
                                                : null;
                                        const targetRecordingId =
                                            result.recordingId ??
                                            (result.entityType === "recording"
                                                ? result.entityId
                                                : null);

                                        return (
                                            <button
                                                key={`${result.entityType}-${result.entityId}-${result.startMs ?? 0}`}
                                                type="button"
                                                className={cn(
                                                    "block w-full border-b px-3 py-2 text-left transition-colors last:border-b-0",
                                                    targetRecordingId
                                                        ? "hover:bg-accent/45"
                                                        : "cursor-default",
                                                )}
                                                onClick={() => {
                                                    if (targetRecordingId) {
                                                        onOpenRecording(
                                                            targetRecordingId,
                                                        );
                                                    }
                                                }}
                                            >
                                                <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                                                    <span className="rounded border border-border/70 px-1.5 py-0.5">
                                                        {getTypeLabel(
                                                            result.entityType,
                                                            isZh,
                                                        )}
                                                    </span>
                                                    {timeRange ? (
                                                        <span>{timeRange}</span>
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
                                                </div>
                                                <p className="truncate text-sm font-medium">
                                                    {result.title ||
                                                        (isZh
                                                            ? "未命名结果"
                                                            : "Untitled result")}
                                                </p>
                                                <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                                                    {result.body}
                                                </p>
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : !loading ? (
                                <p className="px-3 py-3 text-sm text-muted-foreground">
                                    {isZh
                                        ? "没有匹配结果。"
                                        : "No matching results."}
                                </p>
                            ) : null}
                        </div>
                    ) : null}
                </section>
            ) : null}
        </search>
    );
}
