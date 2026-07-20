"use client";

import { Columns2, Search, X } from "lucide-react";
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
const LIBRARY_SEARCH_DIALOG_ID = "library-search-dialog";
const LIBRARY_SEARCH_RESULTS_ID = "library-search-results";

function librarySearchResultId(index: number) {
    return `library-search-result-${index}`;
}

const librarySearchClassNames = {
    anchor: "relative inline-flex size-[32px] items-center justify-center p-0",
    trigger: "relative",
    panel: "absolute right-0 top-[calc(100%+8px)] z-50 flex max-h-[540px] w-[460px] max-w-[calc(100vw-32px)] flex-col gap-0 rounded-[12px] border-border bg-[var(--bg-elevated)] [box-shadow:var(--card-popover-shadow)] backdrop-blur-none min-[641px]:max-[860px]:fixed min-[641px]:max-[860px]:left-3 min-[641px]:max-[860px]:right-auto min-[641px]:max-[860px]:top-[72px] min-[641px]:max-[860px]:box-border min-[641px]:max-[860px]:max-h-[calc(100dvh-96px)] min-[641px]:max-[860px]:w-[min(460px,calc(100vw-24px))] min-[641px]:max-[860px]:max-w-[calc(100vw-24px)] max-[640px]:fixed max-[640px]:left-3 max-[640px]:right-3 max-[640px]:top-[72px] max-[640px]:box-border max-[640px]:max-h-[calc(100dvh-96px)] max-[640px]:w-[calc(100vw-24px)] max-[640px]:min-w-0 max-[640px]:max-w-none",
    inputRow:
        "h-auto min-h-0 gap-[8px] rounded-none border-x-0 border-t-0 border-b border-border bg-transparent px-[12px] py-[8px] shadow-none",
    inputAddon:
        "p-0 text-muted-foreground group-data-[disabled=true]/input-group:opacity-100 has-[>button]:m-0",
    input: "h-8 min-w-0 px-1 py-0 text-[13.5px] leading-[1.35] font-medium md:text-[13.5px]",
    clear: "size-6",
    scope: "w-full flex-wrap gap-[6px] rounded-none border-b border-border bg-muted px-[12px] py-[8px]",
    scopeItem:
        "h-[22px] rounded-full border-transparent bg-transparent px-[10px] text-[11.5px] font-medium leading-none text-muted-foreground shadow-none hover:bg-card hover:text-foreground data-[state=on]:border-[color-mix(in_srgb,var(--accent)_36%,transparent)] data-[state=on]:bg-[var(--accent-soft)] data-[state=on]:text-[var(--accent)] disabled:pointer-events-none disabled:opacity-50",
    error: "w-full gap-[8px] rounded-none border-0 bg-transparent px-[16px] py-[18px] text-center text-[12.5px] leading-[1.55] font-medium text-destructive",
    errorTitle:
        "line-clamp-none min-h-0 text-center text-[12.5px] leading-[1.55] font-medium tracking-normal text-destructive",
    retry: "h-[26px] rounded-[7px] px-[10px] text-[12px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground",
    scroll: "min-h-0 flex-1 overflow-y-auto px-[6px] pt-[6px] pb-[8px]",
    state: "block text-muted-foreground",
    indexing:
        "flex items-center gap-[10px] px-[16px] py-[14px] text-[length:var(--text-body-sm)] text-muted-foreground",
    indexingProgress:
        "inline-flex min-w-0 flex-1 items-center gap-[8px] font-mono text-[11px] font-medium leading-none text-muted-foreground",
    indexingTrack:
        "relative h-1 w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--signal-info)_16%,transparent)]",
    indexingBar:
        "absolute inset-y-0 left-0 w-[36%] rounded-[inherit] bg-[linear-gradient(90deg,transparent,var(--signal-info)_50%,transparent)] animate-[sbn-sweep_1.4s_linear_infinite]",
    stateCopy:
        "px-[16px] py-[22px] text-center text-[12.5px] leading-[1.55] font-medium text-muted-foreground",
    stateCopyStrong: "font-semibold text-foreground",
    results: "flex flex-col",
    resultGroup:
        "m-0 min-w-0 border-0 p-0 flex flex-col gap-[2px] px-[4px] py-[6px] [&+&]:mt-[4px] [&+&]:border-t [&+&]:border-border [&+&]:pt-[8px]",
    groupLabel:
        "float-left block w-full px-[6px] py-[4px] font-mono text-[10.5px] font-semibold leading-[10.5px] uppercase tracking-[0.84px] text-muted-foreground",
    result: "h-auto w-full flex-col items-start justify-start gap-[2px] rounded-[8px] px-[10px] py-[8px] text-left text-[13px] font-normal leading-[normal] whitespace-normal",
    resultTitle: "text-[13px] font-semibold leading-[18.2px] text-foreground",
    resultMeta:
        "font-mono text-[11.5px] font-medium leading-[16.1px] tracking-[0.23px] text-muted-foreground",
    highlight:
        "rounded-[3px] bg-[color-mix(in_srgb,var(--accent)_22%,transparent)] px-[2px] text-[var(--accent)]",
    tag: "h-[22px] w-fit justify-normal gap-[5px] overflow-visible rounded-[6px] border-[color-mix(in_srgb,var(--tag-c)_24%,transparent)] bg-[color-mix(in_srgb,var(--tag-c)_12%,var(--bg-elevated))] py-0 pr-[9px] pl-[7px] text-[11.5px] font-semibold leading-[normal] whitespace-normal text-[color-mix(in_srgb,var(--tag-c)_72%,var(--fg-primary))] [--tag-c:oklch(0.560_0.150_285)] [box-shadow:var(--shadow-xs)]",
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
            <mark className={librarySearchClassNames.highlight}>
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
                .getElementById(librarySearchResultId(activeSearchIndex))
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
        <div className={librarySearchClassNames.anchor} ref={searchOverlayRef}>
            <Button
                ref={searchTriggerRef}
                variant="ghost"
                size="icon-sm"
                className={librarySearchClassNames.trigger}
                type="button"
                aria-label={t("librarySearch.openSearch")}
                aria-expanded={open}
                aria-haspopup="dialog"
                aria-controls={open ? LIBRARY_SEARCH_DIALOG_ID : undefined}
                data-control="dashboard-search"
                data-state={open ? "open" : "closed"}
                onClick={() => onOpenChange(!open)}
            >
                <Search aria-hidden="true" />
            </Button>
            {open ? (
                <Card
                    hasNoPadding
                    variant="default"
                    className={librarySearchClassNames.panel}
                    data-panel="library-search"
                    data-state={searchPanelState}
                    id={LIBRARY_SEARCH_DIALOG_ID}
                    role="dialog"
                    aria-label={t("librarySearch.dialogLabel")}
                    onKeyDown={handleLibrarySearchKeyDown}
                >
                    <InputGroup
                        variant="default"
                        className={librarySearchClassNames.inputRow}
                    >
                        <InputGroupAddon
                            align="inline-start"
                            className={librarySearchClassNames.inputAddon}
                        >
                            <Search
                                aria-hidden="true"
                                className="!size-[15px]"
                                size={15}
                                strokeWidth={1.8}
                            />
                        </InputGroupAddon>
                        <InputGroupInput
                            variant="default"
                            className={librarySearchClassNames.input}
                            data-control="library-search-input"
                            data-state={searchPanelState}
                            ref={searchInputRef}
                            value={query}
                            role="combobox"
                            aria-autocomplete="list"
                            aria-controls={LIBRARY_SEARCH_RESULTS_ID}
                            aria-expanded={true}
                            aria-activedescendant={
                                flatSearchResults.length > 0
                                    ? librarySearchResultId(activeSearchIndex)
                                    : undefined
                            }
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
                        />
                        {query.trim() && searchPanelState !== "indexing" ? (
                            <InputGroupButton
                                variant="ghost"
                                size="icon-xs"
                                className={librarySearchClassNames.clear}
                                aria-label={t("librarySearch.clearSearch")}
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
                                <X aria-hidden="true" />
                            </InputGroupButton>
                        ) : null}
                    </InputGroup>
                    <ToggleGroup
                        type="single"
                        layout="default"
                        variant="outline"
                        size="sm"
                        className={librarySearchClassNames.scope}
                        data-control="library-search-scope"
                        value={searchScope}
                        spacing={1.6}
                        aria-label={t("librarySearch.scopeLegend")}
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
                                data-scope={item.value}
                                aria-pressed={item.value === searchScope}
                                className={librarySearchClassNames.scopeItem}
                                disabled={searchPanelState === "indexing"}
                            >
                                {item.value === "all"
                                    ? t("librarySearch.scopes.all")
                                    : t(`librarySearch.types.${item.value}`)}
                            </ToggleGroupItem>
                        ))}
                    </ToggleGroup>
                    <CardContent className={librarySearchClassNames.scroll}>
                        {searchPanelState === "indexing" ? (
                            <div
                                className={librarySearchClassNames.indexing}
                                data-part="library-search-indexing"
                                data-state="indexing"
                                aria-live="polite"
                            >
                                <div
                                    className={
                                        librarySearchClassNames.indexingProgress
                                    }
                                    role="progressbar"
                                    aria-valuetext={t(
                                        "librarySearch.indexing",
                                        {
                                            completed:
                                                searchIndexing?.completedJobs ??
                                                0,
                                            total:
                                                searchIndexing?.totalJobs ?? 0,
                                        },
                                    )}
                                >
                                    <div
                                        className={
                                            librarySearchClassNames.indexingTrack
                                        }
                                    >
                                        <div
                                            className={
                                                librarySearchClassNames.indexingBar
                                            }
                                        />
                                    </div>
                                </div>
                                <div
                                    className={
                                        librarySearchClassNames.stateCopy
                                    }
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
                                aria-live="polite"
                            >
                                <div
                                    className={
                                        librarySearchClassNames.stateCopy
                                    }
                                >
                                    {t("librarySearch.loading")}
                                </div>
                            </div>
                        ) : searchError ? (
                            <Alert
                                variant="default"
                                density="default"
                                layout="centered"
                                className={librarySearchClassNames.error}
                            >
                                <AlertTitle
                                    density="default"
                                    className={
                                        librarySearchClassNames.errorTitle
                                    }
                                >
                                    {t("librarySearch.error")}
                                </AlertTitle>
                                <Button
                                    variant="ghost"
                                    size="xs"
                                    className={librarySearchClassNames.retry}
                                    type="button"
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
                                id={LIBRARY_SEARCH_RESULTS_ID}
                                role="listbox"
                                aria-label={t("librarySearch.dialogLabel")}
                            >
                                {groupedSearchResults.map((group) => (
                                    <fieldset
                                        className={
                                            librarySearchClassNames.resultGroup
                                        }
                                        key={group.type}
                                        aria-labelledby={`library-search-group-${group.type}`}
                                    >
                                        <legend
                                            className={
                                                librarySearchClassNames.groupLabel
                                            }
                                            id={`library-search-group-${group.type}`}
                                        >
                                            {t(
                                                `librarySearch.types.${group.type}`,
                                            )}
                                        </legend>
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
                                                        id={librarySearchResultId(
                                                            index,
                                                        )}
                                                        data-control="library-search-result"
                                                        data-result-type={
                                                            result.entityType
                                                        }
                                                        data-result-index={
                                                            index
                                                        }
                                                        role="option"
                                                        aria-selected={
                                                            index ===
                                                            activeSearchIndex
                                                        }
                                                        aria-disabled={
                                                            action ===
                                                            "disabled"
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
                                                            >
                                                                <Columns2
                                                                    className="!size-[11px]"
                                                                    aria-hidden="true"
                                                                    size={11}
                                                                    strokeWidth={
                                                                        2
                                                                    }
                                                                />
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
                                                        >
                                                            {meta}
                                                        </span>
                                                    </Button>
                                                );
                                            },
                                        )}
                                    </fieldset>
                                ))}
                            </div>
                        ) : (
                            <div
                                className={librarySearchClassNames.state}
                                aria-live="polite"
                            >
                                {query.trim() ? (
                                    <div
                                        className={
                                            librarySearchClassNames.stateCopy
                                        }
                                    >
                                        {language === "en" ? (
                                            <>
                                                {'No content found for "'}
                                                <span
                                                    className={
                                                        librarySearchClassNames.stateCopyStrong
                                                    }
                                                >
                                                    {query.trim()}
                                                </span>
                                                {'"'}
                                            </>
                                        ) : (
                                            <>
                                                {"没有找到与「"}
                                                <span
                                                    className={
                                                        librarySearchClassNames.stateCopyStrong
                                                    }
                                                >
                                                    {query.trim()}
                                                </span>
                                                {"」相关的内容"}
                                            </>
                                        )}
                                    </div>
                                ) : (
                                    <div
                                        className={
                                            librarySearchClassNames.stateCopy
                                        }
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
