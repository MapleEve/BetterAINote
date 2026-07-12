"use client";

import { Search, Tags, X } from "lucide-react";
import {
    type KeyboardEvent as ReactKeyboardEvent,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useLanguage } from "@/components/language-provider";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
} from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type SearchResultType = "recording" | "transcript" | "speaker" | "tag";
type SearchScope = "all" | SearchResultType;
type SearchResult = {
    entityType: SearchResultType;
    entityId: string;
    recordingId: string | null;
    title: string | null;
    body: string;
    speaker: string | null;
    source: string | null;
    tags?: string[];
    startMs?: number | null;
    endMs?: number | null;
};
type SearchIndexingProgress = {
    active: boolean;
    pendingJobs: number;
    indexingJobs: number;
    completedJobs: number;
    totalJobs: number;
};
type Translator = (
    key: string,
    replacements?: Record<string, string | number>,
) => string;

export type LibrarySearchFilter = {
    type: "speaker" | "tag";
    label: string;
};

type LibrarySearchProps = {
    open: boolean;
    query: string;
    onApplyFilter: (filter: LibrarySearchFilter) => void;
    onOpenChange: (open: boolean) => void;
    onOpenRecording: (recordingId: string) => void;
    onQueryChange: (query: string) => void;
};

const SEARCH_SCOPES: { value: SearchScope; label: string }[] = [
    { value: "all", label: "全部" },
    { value: "recording", label: "录音" },
    { value: "transcript", label: "逐字稿" },
    { value: "speaker", label: "说话人" },
    { value: "tag", label: "标签" },
];
const SEARCH_RESULT_TYPES: SearchResultType[] = [
    "recording",
    "transcript",
    "speaker",
    "tag",
];

const librarySearchClassNames = {
    anchor: "relative inline-flex size-[32px] items-center justify-center p-0",
    trigger: "relative",
    panel: "absolute right-0 top-[calc(100%+8px)] z-50 flex max-h-[540px] w-[460px] max-w-[calc(100vw-32px)] flex-col gap-0 min-[641px]:max-[860px]:fixed min-[641px]:max-[860px]:left-3 min-[641px]:max-[860px]:right-auto min-[641px]:max-[860px]:top-[72px] min-[641px]:max-[860px]:box-border min-[641px]:max-[860px]:max-h-[calc(100dvh-96px)] min-[641px]:max-[860px]:w-[min(460px,calc(100vw-24px))] min-[641px]:max-[860px]:max-w-[calc(100vw-24px)] max-[640px]:fixed max-[640px]:left-3 max-[640px]:right-3 max-[640px]:top-[72px] max-[640px]:box-border max-[640px]:max-h-[calc(100dvh-96px)] max-[640px]:w-[calc(100vw-24px)] max-[640px]:min-w-0 max-[640px]:max-w-none",
    inputRow:
        "h-[49px] min-h-[49px] gap-[8px] rounded-none border-x-0 border-t-0 border-b border-border px-[12px] py-[8px]",
    inputAddon:
        "p-0 text-muted-foreground group-data-[disabled=true]/input-group:opacity-100 has-[>button]:m-0",
    input: "h-8 min-w-0 px-1 py-0 text-sm md:text-sm",
    clear: "size-6",
    scope: "min-h-[39px] w-full flex-wrap gap-[6px] rounded-none border-b border-border bg-muted px-[12px] py-[8px]",
    scopeItem:
        "h-6 rounded-full px-2.5 text-xs disabled:pointer-events-none disabled:opacity-50",
    error: "flex w-full flex-col items-center gap-2 rounded-none px-4 py-4 text-center text-sm text-destructive *:data-[slot=alert-description]:text-destructive [&>svg]:text-current",
    errorTitle:
        "line-clamp-none min-h-0 text-center text-sm font-medium tracking-normal",
    retry: "h-6 px-2 text-xs",
    scroll: "min-h-0 flex-1 overflow-y-auto px-[6px] pt-[6px] pb-[8px]",
    state: "block text-muted-foreground",
    indexing:
        "flex items-center gap-[10px] px-[16px] py-[14px] text-[length:var(--text-body-sm)] text-muted-foreground",
    stateSkeleton:
        "relative inline-flex h-1 w-auto min-w-0 flex-1 overflow-hidden rounded-full bg-primary/10 animate-none after:absolute after:inset-y-0 after:left-0 after:w-[36%] after:rounded-[inherit] after:bg-primary/50 after:animate-[sbn-sweep_1.4s_linear_infinite] after:content-['']",
    stateCopy:
        "px-4 py-5 text-center text-sm text-muted-foreground [&_span]:font-semibold [&_span]:text-foreground",
    results: "flex flex-col",
    resultGroup:
        "flex flex-col gap-[2px] px-[4px] py-[6px] [&+&]:mt-[4px] [&+&]:border-t [&+&]:border-border [&+&]:pt-[8px]",
    groupLabel:
        "px-1.5 py-1 font-mono text-xs font-semibold uppercase tracking-wide text-muted-foreground",
    result: "h-auto w-full flex-col items-start justify-start gap-0.5 px-2.5 py-2 text-left whitespace-normal",
    resultTitle: "text-sm font-semibold text-foreground",
    resultMeta:
        "font-mono text-xs font-medium leading-snug text-muted-foreground",
    highlight: "rounded-[3px] bg-primary/10 px-[2px] text-primary",
    tag: "h-6 w-fit justify-normal gap-1 overflow-visible whitespace-normal px-2 py-0",
} as const;

function formatLibrarySearchTimestamp(valueMs: number | null | undefined) {
    if (valueMs == null || !Number.isFinite(valueMs)) {
        return "--";
    }

    const totalSeconds = Math.max(0, Math.floor(valueMs / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
            .toString()
            .padStart(2, "0")}`;
    }
    return `${minutes.toString().padStart(2, "0")}:${seconds
        .toString()
        .padStart(2, "0")}`;
}

function LibrarySearchTagIcon() {
    return <Tags data-icon="inline-start" aria-hidden="true" />;
}

function searchResultAction(result: SearchResult) {
    if (result.entityType === "tag" || result.entityType === "speaker") {
        return "filter";
    }
    return result.recordingId ? "open" : "disabled";
}

function searchResultFilterLabel(result: SearchResult) {
    if (result.entityType === "speaker") {
        return result.speaker || result.title || result.body;
    }
    return result.title || result.tags?.[0] || result.body;
}

function searchResultTitle(result: SearchResult, t: Translator) {
    if (result.entityType === "transcript") {
        return (
            result.body || result.title || t("librarySearch.types.transcript")
        );
    }

    return (
        result.title ||
        result.body ||
        result.speaker ||
        result.tags?.[0] ||
        t("librarySearch.untitledResult")
    );
}

function searchResultMeta(result: SearchResult, t: Translator) {
    if (result.entityType === "transcript") {
        const timestamp = formatLibrarySearchTimestamp(result.startMs);
        return `${result.title || t("librarySearch.types.transcript")} · ${timestamp}`;
    }
    if (result.entityType === "tag") {
        return result.body || result.tags?.[0] || t("librarySearch.types.tag");
    }
    if (result.entityType === "speaker") {
        return (
            result.body || result.speaker || t("librarySearch.types.speaker")
        );
    }
    return result.source || result.body || t("librarySearch.types.recording");
}

function highlightSearchText(value: string, query: string) {
    const needle = query.trim();
    if (!needle) return value;
    const lowerValue = value.toLocaleLowerCase();
    const lowerNeedle = needle.toLocaleLowerCase();
    const index = lowerValue.indexOf(lowerNeedle);
    if (index < 0) return value;

    return (
        <>
            {value.slice(0, index)}
            <mark
                className={librarySearchClassNames.highlight}
                data-sot-part="library-search-highlight"
            >
                {value.slice(index, index + needle.length)}
            </mark>
            {value.slice(index + needle.length)}
        </>
    );
}

export function LibrarySearch({
    open,
    query,
    onApplyFilter,
    onOpenChange,
    onOpenRecording,
    onQueryChange,
}: LibrarySearchProps) {
    const { language, t } = useLanguage();
    const [searchScope, setSearchScope] = useState<SearchScope>("all");
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchError, setSearchError] = useState("");
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [searchIndexing, setSearchIndexing] =
        useState<SearchIndexingProgress | null>(null);
    const [activeSearchIndex, setActiveSearchIndex] = useState(0);
    const [searchRetry, setSearchRetry] = useState(0);
    const searchTriggerRef = useRef<HTMLButtonElement | null>(null);
    const searchOverlayRef = useRef<HTMLDivElement | null>(null);
    const searchInputRef = useRef<HTMLInputElement | null>(null);

    const searchPanelState = searchIndexing?.active
        ? "indexing"
        : searchError
          ? "error"
          : searchLoading
            ? "loading"
            : query.trim()
              ? searchResults.length
                  ? "results"
                  : "no-results"
              : "no-query";
    const groupedSearchResults = useMemo(() => {
        let index = 0;
        return SEARCH_RESULT_TYPES.map((type) => {
            const results = searchResults
                .filter((result) => result.entityType === type)
                .map((result) => ({ index: index++, result }));

            return { type, results };
        }).filter((group) => group.results.length > 0);
    }, [searchResults]);
    const flatSearchResults = groupedSearchResults.flatMap(
        (group) => group.results,
    );

    useEffect(() => {
        if (!open || query.trim().length === 0) {
            setSearchResults([]);
            setSearchError("");
            setSearchIndexing(null);
            return;
        }
        const timer = window.setTimeout(() => {
            setSearchLoading(true);
            setSearchError("");
            setSearchIndexing(null);
            const params = new URLSearchParams({
                q: query,
                limit: "8",
            });
            if (searchRetry > 0) {
                params.set("_retry", String(searchRetry));
            }
            if (searchScope !== "all") {
                params.set("type", searchScope);
            }
            fetch(`/api/search?${params.toString()}`)
                .then((response) => {
                    if (!response.ok) throw new Error("Search failed");
                    return response.json();
                })
                .then(
                    (data: {
                        results?: SearchResult[];
                        indexing?: SearchIndexingProgress;
                    }) => {
                        if (data.indexing?.active) {
                            setSearchIndexing(data.indexing);
                            setSearchResults([]);
                            return;
                        }
                        setSearchIndexing(null);
                        setSearchResults(data.results ?? []);
                    },
                )
                .catch(() => {
                    setSearchResults([]);
                    setSearchIndexing(null);
                    setSearchError("搜索暂时不可用");
                })
                .finally(() => setSearchLoading(false));
        }, 180);
        return () => window.clearTimeout(timer);
    }, [open, query, searchRetry, searchScope]);

    useEffect(() => {
        if (!open) return;
        window.setTimeout(() => {
            searchInputRef.current?.focus({ preventScroll: true });
        }, 0);
    }, [open]);

    useEffect(() => {
        if (!open || flatSearchResults.length === 0) return;
        window.setTimeout(() => {
            document
                .querySelector<HTMLElement>(
                    `[data-sot-control="library-search-result"][data-sot-result-index="${activeSearchIndex}"]`,
                )
                ?.scrollIntoView({ block: "nearest" });
        }, 0);
    }, [activeSearchIndex, flatSearchResults.length, open]);

    useEffect(() => {
        if (!open) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            onOpenChange(false);
            window.setTimeout(() => {
                searchTriggerRef.current?.focus({ preventScroll: true });
            }, 0);
        };

        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target;
            if (!(target instanceof Node)) return;
            if (!searchOverlayRef.current?.contains(target)) {
                onOpenChange(false);
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        document.addEventListener("pointerdown", handlePointerDown);
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.removeEventListener("pointerdown", handlePointerDown);
        };
    }, [onOpenChange, open]);

    function applyLibrarySearchResult(result: SearchResult) {
        const action = searchResultAction(result);
        if (action === "filter") {
            const label = searchResultFilterLabel(result);
            onApplyFilter({
                label,
                type: result.entityType === "speaker" ? "speaker" : "tag",
            });
            onQueryChange("");
            setSearchResults([]);
            onOpenChange(false);
            return;
        }
        if (result.recordingId) {
            onOpenRecording(result.recordingId);
            onQueryChange("");
            setSearchResults([]);
            onOpenChange(false);
        }
    }

    function handleLibrarySearchKeyDown(event: ReactKeyboardEvent) {
        if (event.key === "Escape") {
            event.preventDefault();
            onOpenChange(false);
            window.setTimeout(() => {
                searchTriggerRef.current?.focus({ preventScroll: true });
            }, 0);
            return;
        }
        if (flatSearchResults.length === 0) return;
        if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveSearchIndex((value) =>
                Math.min(value + 1, flatSearchResults.length - 1),
            );
            return;
        }
        if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveSearchIndex((value) => Math.max(value - 1, 0));
            return;
        }
        if (event.key === "Enter") {
            event.preventDefault();
            const activeResult = flatSearchResults[activeSearchIndex]?.result;
            if (activeResult) applyLibrarySearchResult(activeResult);
        }
    }

    return (
        <div
            className={librarySearchClassNames.anchor}
            data-sot-part="library-search-anchor"
            ref={searchOverlayRef}
        >
            <Button
                ref={searchTriggerRef}
                variant="ghost"
                size="icon-sm"
                className={librarySearchClassNames.trigger}
                type="button"
                aria-label={t("librarySearch.openSearch")}
                aria-expanded={open}
                data-sot-control="dashboard-search"
                data-sot-state={open ? "open" : "idle"}
                onClick={() => onOpenChange(!open)}
            >
                <Search data-icon="inline-start" />
            </Button>
            {open ? (
                <Card
                    hasNoPadding
                    variant="default"
                    className={librarySearchClassNames.panel}
                    data-open="true"
                    data-state={searchPanelState}
                    data-sot-panel="library-search"
                    data-sot-state={searchPanelState}
                    data-sot-result-count={String(flatSearchResults.length)}
                    role="dialog"
                    aria-label={t("librarySearch.dialogLabel")}
                    onKeyDown={handleLibrarySearchKeyDown}
                >
                    <InputGroup
                        variant="default"
                        className={librarySearchClassNames.inputRow}
                        data-sot-part="library-search-input-row"
                        data-state={searchPanelState}
                        data-disabled={String(searchPanelState === "indexing")}
                    >
                        <InputGroupAddon
                            align="inline-start"
                            className={librarySearchClassNames.inputAddon}
                        >
                            <Search data-icon="inline-start" />
                        </InputGroupAddon>
                        <InputGroupInput
                            variant="default"
                            className={librarySearchClassNames.input}
                            ref={searchInputRef}
                            value={query}
                            aria-disabled={searchPanelState === "indexing"}
                            aria-label={t("librarySearch.placeholder")}
                            autoComplete="off"
                            onChange={(event) => {
                                onQueryChange(event.target.value);
                                setActiveSearchIndex(0);
                            }}
                            placeholder={t(
                                searchPanelState === "no-query"
                                    ? "librarySearch.placeholder"
                                    : "librarySearch.shortPlaceholder",
                            )}
                            readOnly={searchPanelState === "indexing"}
                            data-sot-control="library-search-input"
                            data-sot-state={searchPanelState}
                        />
                        {query.trim() &&
                        searchPanelState !== "indexing" &&
                        searchPanelState !== "error" ? (
                            <InputGroupButton
                                variant="ghost"
                                size="icon-xs"
                                className={librarySearchClassNames.clear}
                                aria-label={t("librarySearch.clearSearch")}
                                data-sot-control="library-search-clear"
                                data-sot-state="clear"
                                onClick={() => {
                                    onQueryChange("");
                                    setSearchResults([]);
                                    setSearchError("");
                                    setSearchIndexing(null);
                                    window.setTimeout(() => {
                                        searchInputRef.current?.focus({
                                            preventScroll: true,
                                        });
                                    }, 0);
                                }}
                            >
                                <X data-icon="inline-start" />
                            </InputGroupButton>
                        ) : null}
                    </InputGroup>
                    <ToggleGroup
                        type="single"
                        layout="default"
                        variant="outline"
                        size="sm"
                        className={librarySearchClassNames.scope}
                        value={searchScope}
                        spacing={1.6}
                        aria-label={t("librarySearch.scopeLegend")}
                        data-sot-canonical="web-index-runtime"
                        data-sot-part="library-search-scope"
                        data-sot-scope-count={String(SEARCH_SCOPES.length)}
                        onValueChange={(value) => {
                            if (!value) return;
                            setSearchScope(value as SearchScope);
                            setActiveSearchIndex(0);
                            window.setTimeout(() => {
                                searchInputRef.current?.focus({
                                    preventScroll: true,
                                });
                            }, 0);
                        }}
                    >
                        {SEARCH_SCOPES.map((item) => (
                            <ToggleGroupItem
                                key={item.value}
                                value={item.value}
                                aria-pressed={item.value === searchScope}
                                data-sot-control="library-search-scope"
                                data-sot-scope={item.value}
                                data-sot-state={
                                    item.value === searchScope
                                        ? "selected"
                                        : "idle"
                                }
                                data-sot-result-mode={item.value}
                                data-search-scope={item.value}
                                className={librarySearchClassNames.scopeItem}
                                disabled={searchPanelState === "indexing"}
                            >
                                {item.value === "all"
                                    ? t("librarySearch.scopes.all")
                                    : t(`librarySearch.types.${item.value}`)}
                            </ToggleGroupItem>
                        ))}
                    </ToggleGroup>
                    <CardContent
                        className={librarySearchClassNames.scroll}
                        data-sot-region="library-search-scroll"
                    >
                        {searchPanelState === "indexing" ? (
                            <div
                                className={librarySearchClassNames.indexing}
                                data-sot-part="library-search-indexing"
                                data-sot-state="indexing"
                            >
                                <Skeleton
                                    className={
                                        librarySearchClassNames.stateSkeleton
                                    }
                                    data-sot-part="library-search-state-skeleton"
                                />
                                <div
                                    className={
                                        librarySearchClassNames.stateCopy
                                    }
                                    data-sot-part="library-search-state-copy"
                                >
                                    {t("librarySearch.indexing", {
                                        completed:
                                            searchIndexing?.completedJobs ?? 0,
                                        total: searchIndexing?.totalJobs ?? 0,
                                    })}
                                </div>
                            </div>
                        ) : searchLoading ? (
                            <div
                                className={librarySearchClassNames.state}
                                data-sot-part="library-search-loading"
                                data-sot-state="loading"
                            >
                                <div
                                    className={
                                        librarySearchClassNames.stateCopy
                                    }
                                    data-sot-part="library-search-state-copy"
                                >
                                    {t("librarySearch.loading")}
                                </div>
                            </div>
                        ) : searchError ? (
                            <Alert
                                variant="default"
                                density="default"
                                layout="default"
                                className={librarySearchClassNames.error}
                                data-sot-part="library-search-error"
                                data-sot-state="error"
                            >
                                <AlertTitle
                                    density="default"
                                    className={
                                        librarySearchClassNames.errorTitle
                                    }
                                    data-sot-part="library-search-state-title"
                                >
                                    {t("librarySearch.error")}
                                </AlertTitle>
                                <Button
                                    variant="outline"
                                    size="xs"
                                    className={librarySearchClassNames.retry}
                                    type="button"
                                    data-sot-control="library-search-retry"
                                    onClick={() => {
                                        setSearchRetry((value) => value + 1);
                                        window.setTimeout(() => {
                                            searchInputRef.current?.focus({
                                                preventScroll: true,
                                            });
                                        }, 0);
                                    }}
                                >
                                    {t("librarySearch.retry")}
                                </Button>
                            </Alert>
                        ) : flatSearchResults.length > 0 ? (
                            <div
                                className={librarySearchClassNames.results}
                                data-sot-list="library-search-results"
                                data-sot-state="results"
                            >
                                {groupedSearchResults.map((group) => (
                                    <div
                                        className={
                                            librarySearchClassNames.resultGroup
                                        }
                                        key={group.type}
                                        data-sot-group="library-search-results"
                                        data-sot-result-type={group.type}
                                    >
                                        <div
                                            className={
                                                librarySearchClassNames.groupLabel
                                            }
                                            data-sot-part="library-search-group-label"
                                        >
                                            {t(
                                                `librarySearch.types.${group.type}`,
                                            )}
                                        </div>
                                        {group.results.map(
                                            ({ index, result }) => {
                                                const title = searchResultTitle(
                                                    result,
                                                    t,
                                                );
                                                const meta = searchResultMeta(
                                                    result,
                                                    t,
                                                );
                                                const action =
                                                    searchResultAction(result);
                                                return (
                                                    <Button
                                                        variant="ghost"
                                                        size="default"
                                                        className={
                                                            librarySearchClassNames.result
                                                        }
                                                        type="button"
                                                        key={`${result.entityType}:${result.entityId}`}
                                                        data-active={
                                                            index ===
                                                            activeSearchIndex
                                                                ? "true"
                                                                : "false"
                                                        }
                                                        data-sot-result-mode={
                                                            action
                                                        }
                                                        data-result-type={
                                                            result.entityType
                                                        }
                                                        data-sot-control="library-search-result"
                                                        data-sot-result-index={String(
                                                            index,
                                                        )}
                                                        data-sot-result-type={
                                                            result.entityType
                                                        }
                                                        data-sot-state={
                                                            index ===
                                                            activeSearchIndex
                                                                ? "active"
                                                                : "idle"
                                                        }
                                                        onClick={() =>
                                                            applyLibrarySearchResult(
                                                                result,
                                                            )
                                                        }
                                                    >
                                                        {result.entityType ===
                                                        "tag" ? (
                                                            <Badge
                                                                variant="secondary"
                                                                className={
                                                                    librarySearchClassNames.tag
                                                                }
                                                                data-sot-part="library-search-tag-chip"
                                                            >
                                                                <LibrarySearchTagIcon />
                                                                {highlightSearchText(
                                                                    title,
                                                                    query,
                                                                )}
                                                            </Badge>
                                                        ) : (
                                                            <span
                                                                className={
                                                                    librarySearchClassNames.resultTitle
                                                                }
                                                                data-sot-part="library-search-result-title"
                                                            >
                                                                {highlightSearchText(
                                                                    title,
                                                                    query,
                                                                )}
                                                            </span>
                                                        )}
                                                        <span
                                                            className={
                                                                librarySearchClassNames.resultMeta
                                                            }
                                                            data-sot-part="library-search-result-meta"
                                                        >
                                                            {meta}
                                                        </span>
                                                    </Button>
                                                );
                                            },
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div
                                className={librarySearchClassNames.state}
                                data-sot-part="library-search-empty"
                                data-sot-state={
                                    query.trim() ? "no-results" : "no-query"
                                }
                            >
                                {query.trim() ? (
                                    <div
                                        className={
                                            librarySearchClassNames.stateCopy
                                        }
                                        data-sot-part="library-search-state-copy"
                                    >
                                        {language === "en" ? (
                                            <>
                                                {'No content found for "'}
                                                <span>{query.trim()}</span>
                                                {'"'}
                                            </>
                                        ) : (
                                            <>
                                                {"没有找到与「"}
                                                <span>{query.trim()}</span>
                                                {"」相关的内容"}
                                            </>
                                        )}
                                    </div>
                                ) : (
                                    <div
                                        className={
                                            librarySearchClassNames.stateCopy
                                        }
                                        data-sot-part="library-search-state-copy"
                                    >
                                        {t("librarySearch.noQuery")}
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            ) : null}
        </div>
    );
}
