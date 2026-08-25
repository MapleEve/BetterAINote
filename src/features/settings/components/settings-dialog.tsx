"use client";

import {
    Cpu,
    Database,
    FileText,
    type LucideIcon,
    Monitor,
    SlidersHorizontal,
    Sparkles,
    X,
} from "lucide-react";
import * as React from "react";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import {
    addBrowserWindowEventListener,
    readBrowserHash,
    readBrowserStorage,
    removeBrowserWindowEventListener,
    writeBrowserHash,
    writeBrowserStorage,
} from "@/lib/platform/browser-shell";
import type { CanonicalSettingsSection } from "@/types/settings";
import {
    type SettingsBusyContextValue,
    SettingsBusyProvider,
} from "./settings-busy-context";
import { SettingsContent } from "./settings-content";

interface SettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    trigger?: React.ReactElement;
    user?: SettingsUserSummary;
}

interface SettingsUserSummary {
    email?: string | null;
    name?: string | null;
}

interface SettingsNavItem {
    labelKey: string;
    id: CanonicalSettingsSection;
    icon: LucideIcon;
}

interface SettingsNavGroup {
    labelKey: string;
    items: SettingsNavItem[];
}

const settingsNav: SettingsNavItem[] = [
    {
        labelKey: "settingsDialog.sections.transcription",
        id: "transcription",
        icon: FileText,
    },
    {
        labelKey: "settingsDialog.sections.titleGeneration",
        id: "title-generation",
        icon: Sparkles,
    },
    {
        labelKey: "settingsDialog.sections.voscript",
        id: "voscript",
        icon: Cpu,
    },
    {
        labelKey: "settingsDialog.sections.dataSources",
        id: "data-sources",
        icon: Database,
    },
    {
        labelKey: "settingsDialog.sections.appearance",
        id: "appearance",
        icon: Monitor,
    },
    {
        labelKey: "settingsDialog.sections.misc",
        id: "misc",
        icon: SlidersHorizontal,
    },
];

function getSettingsNavItem(id: CanonicalSettingsSection): SettingsNavItem {
    const item = settingsNav.find((entry) => entry.id === id);
    if (!item) {
        throw new Error(`Unknown settings section: ${id}`);
    }

    return item;
}

const settingsNavGroups: SettingsNavGroup[] = [
    {
        labelKey: "settingsDialog.groups.transcriptionServices",
        items: [
            getSettingsNavItem("transcription"),
            getSettingsNavItem("title-generation"),
            getSettingsNavItem("voscript"),
        ],
    },
    {
        labelKey: "settingsDialog.groups.dataConnections",
        items: [getSettingsNavItem("data-sources")],
    },
    {
        labelKey: "settingsDialog.groups.appInterface",
        items: [getSettingsNavItem("appearance"), getSettingsNavItem("misc")],
    },
];

const orderedSettingsNav = settingsNavGroups.flatMap((group) => group.items);

const STORAGE_KEY = "settings-last-section";
const COMPACT_SETTINGS_MEDIA_QUERY = "(max-width: 899px)";
const SETTINGS_SECTION_SELECT_ID = "settings-section-select";

export function normalizeSettingsSection(
    value: string | null | undefined,
): CanonicalSettingsSection | null {
    if (!value) {
        return null;
    }

    return orderedSettingsNav.some((item) => item.id === value)
        ? (value as CanonicalSettingsSection)
        : null;
}

function getSettingsSectionIndex(section: CanonicalSettingsSection): number {
    return Math.max(
        orderedSettingsNav.findIndex((item) => item.id === section),
        0,
    );
}

function normalizeRovingIndex(index: number): number {
    const count = orderedSettingsNav.length;
    return ((index % count) + count) % count;
}

function focusVisibleSettingsNavigation(
    navButtons: Array<HTMLButtonElement | null>,
    section: CanonicalSettingsSection,
) {
    if (
        typeof window !== "undefined" &&
        window.matchMedia(COMPACT_SETTINGS_MEDIA_QUERY).matches
    ) {
        document.getElementById(SETTINGS_SECTION_SELECT_ID)?.focus({
            preventScroll: true,
        });
        return;
    }

    navButtons[getSettingsSectionIndex(section)]?.focus({
        preventScroll: true,
    });
}

function resolveInitialSettingsSection(): CanonicalSettingsSection {
    const hashSection = normalizeSettingsSection(readBrowserHash());
    if (hashSection) {
        return hashSection;
    }

    const storageSection = normalizeSettingsSection(
        readBrowserStorage(STORAGE_KEY),
    );
    return storageSection ?? orderedSettingsNav[0].id;
}

export function SettingsDialog(props: SettingsDialogProps) {
    const { t } = useLanguage();
    const [activeSection, setActiveSection] =
        React.useState<CanonicalSettingsSection>(orderedSettingsNav[0].id);
    const [rovingIndex, setRovingIndex] = React.useState(0);
    const [hasResolvedInitialSection, setHasResolvedInitialSection] =
        React.useState(false);
    const [busySections, setBusySections] = React.useState<
        Record<string, true>
    >({});
    const navButtonRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
    const scrollBodyRef = React.useRef<HTMLDivElement | null>(null);
    const shouldFocusNavOnOpenRef = React.useRef(false);

    const settingsUserName = t("settingsDialog.localDeployment");
    const settingsUserSubtitle = t("settingsDialog.singleUserSelfHosted");
    const isSettingsBusy = Object.keys(busySections).length > 0;

    const setSettingsSectionBusy = React.useCallback(
        (section: string, busy: boolean) => {
            setBusySections((current) => {
                const isCurrentlyBusy = Boolean(current[section]);
                if (isCurrentlyBusy === busy) {
                    return current;
                }

                if (busy) {
                    return {
                        ...current,
                        [section]: true,
                    };
                }

                const { [section]: _removed, ...rest } = current;
                return rest;
            });
        },
        [],
    );

    const applyActiveSettingsSection = React.useCallback(
        (section: CanonicalSettingsSection) => {
            setActiveSection(section);
            setRovingIndex(getSettingsSectionIndex(section));
        },
        [],
    );

    const focusSettingsNavIndex = React.useCallback((index: number) => {
        const nextIndex = normalizeRovingIndex(index);
        setRovingIndex(nextIndex);
        navButtonRefs.current[nextIndex]?.focus({ preventScroll: true });
    }, []);

    const busyContextValue = React.useMemo<SettingsBusyContextValue>(
        () => ({
            isSettingsBusy,
            setSettingsSectionBusy,
        }),
        [isSettingsBusy, setSettingsSectionBusy],
    );

    const handleDialogOpenChange = React.useCallback(
        (open: boolean) => {
            if (!open && isSettingsBusy) {
                return;
            }

            props.onOpenChange(open);
        },
        [isSettingsBusy, props.onOpenChange],
    );

    const handleOpenAutoFocus = React.useCallback(
        (event: Event) => {
            event.preventDefault();
            const initialSection = resolveInitialSettingsSection();
            shouldFocusNavOnOpenRef.current = true;
            applyActiveSettingsSection(initialSection);
            setHasResolvedInitialSection(true);
            focusVisibleSettingsNavigation(
                navButtonRefs.current,
                initialSection,
            );
        },
        [applyActiveSettingsSection],
    );

    const handleNavKeyDown = React.useCallback(
        (event: React.KeyboardEvent<HTMLButtonElement>, itemIndex: number) => {
            let nextIndex: number | null = null;

            switch (event.key) {
                case "ArrowDown":
                case "ArrowRight":
                    nextIndex = itemIndex + 1;
                    break;
                case "ArrowUp":
                case "ArrowLeft":
                    nextIndex = itemIndex - 1;
                    break;
                case "Home":
                    nextIndex = 0;
                    break;
                case "End":
                    nextIndex = orderedSettingsNav.length - 1;
                    break;
                default:
                    return;
            }

            event.preventDefault();
            focusSettingsNavIndex(nextIndex);
        },
        [focusSettingsNavIndex],
    );

    React.useEffect(() => {
        if (!props.open) {
            setHasResolvedInitialSection(false);
            setBusySections({});
            return;
        }

        const initialSection = resolveInitialSettingsSection();
        shouldFocusNavOnOpenRef.current = true;
        applyActiveSettingsSection(initialSection);
        setHasResolvedInitialSection(true);
    }, [applyActiveSettingsSection, props.open]);

    React.useEffect(() => {
        if (!props.open) return;

        const handleHashChange = () => {
            const validSection = normalizeSettingsSection(readBrowserHash());
            if (!validSection) return;
            applyActiveSettingsSection(validSection);
        };

        addBrowserWindowEventListener("hashchange", handleHashChange);

        return () => {
            removeBrowserWindowEventListener("hashchange", handleHashChange);
        };
    }, [applyActiveSettingsSection, props.open]);

    React.useEffect(() => {
        if (!props.open || !hasResolvedInitialSection) return;

        writeBrowserHash(activeSection);
        writeBrowserStorage(STORAGE_KEY, activeSection);
    }, [activeSection, hasResolvedInitialSection, props.open]);

    React.useLayoutEffect(() => {
        if (
            !props.open ||
            !hasResolvedInitialSection ||
            !shouldFocusNavOnOpenRef.current
        ) {
            return;
        }

        if (isSettingsBusy) {
            return;
        }

        const target =
            typeof window !== "undefined" &&
            window.matchMedia(COMPACT_SETTINGS_MEDIA_QUERY).matches
                ? document.getElementById(SETTINGS_SECTION_SELECT_ID)
                : navButtonRefs.current[getSettingsSectionIndex(activeSection)];
        if (!target) return;
        target.focus({ preventScroll: true });
        if (document.activeElement === target) {
            shouldFocusNavOnOpenRef.current = false;
        }
    }, [activeSection, hasResolvedInitialSection, isSettingsBusy, props.open]);

    React.useLayoutEffect(() => {
        if (props.open && isSettingsBusy) {
            shouldFocusNavOnOpenRef.current = true;
        }
    }, [isSettingsBusy, props.open]);

    const resetSettingsScroll = React.useCallback(
        (section: CanonicalSettingsSection) => {
            if (section !== activeSection) return;

            const scrollBody = scrollBodyRef.current;
            if (!scrollBody) return;
            scrollBody.scrollTo({ top: 0, left: 0 });
        },
        [activeSection],
    );

    React.useLayoutEffect(() => {
        if (!props.open || !hasResolvedInitialSection) return;

        resetSettingsScroll(activeSection);
    }, [
        activeSection,
        hasResolvedInitialSection,
        props.open,
        resetSettingsScroll,
    ]);

    return (
        <Dialog open={props.open} onOpenChange={handleDialogOpenChange}>
            {props.trigger ? (
                <DialogTrigger asChild>{props.trigger}</DialogTrigger>
            ) : null}
            <DialogContent
                aria-label={t("settingsDialog.title")}
                aria-busy={isSettingsBusy}
                className="box-border flex h-[min(94svh,980px)] max-h-[calc(100svh_-_1rem)] w-[920px] max-w-[calc(100vw_-_40px)] flex-col gap-0 overflow-hidden border-border bg-card p-0 sm:max-w-[min(920px,calc(100vw_-_40px))] max-[899px]:w-[calc(100vw_-_32px)] max-[899px]:max-w-[calc(100vw_-_32px)] max-[639px]:top-0 max-[639px]:left-0 max-[639px]:h-[100svh] max-[639px]:max-h-[100svh] max-[639px]:w-full max-[639px]:max-w-none max-[639px]:translate-x-0 max-[639px]:translate-y-0 max-[639px]:rounded-none max-[639px]:border-0"
                onOpenAutoFocus={handleOpenAutoFocus}
                onEscapeKeyDown={(event) => {
                    if (isSettingsBusy) {
                        event.preventDefault();
                    }
                }}
                onInteractOutside={(event) => {
                    if (isSettingsBusy) {
                        event.preventDefault();
                    }
                }}
                showCloseButton={false}
            >
                <DialogTitle className="sr-only">
                    {t("settingsDialog.title")}
                </DialogTitle>
                <DialogDescription className="sr-only">
                    {settingsUserSubtitle}
                </DialogDescription>
                <SettingsBusyProvider value={busyContextValue}>
                    <header className="flex flex-none items-center gap-3 border-b border-border px-5 py-[18px] max-[639px]:px-4 max-[639px]:py-3">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                            <span
                                aria-hidden="true"
                                className="grid size-9 flex-none place-items-center rounded-full border border-border bg-muted text-muted-foreground"
                            >
                                <Monitor />
                            </span>
                            <div className="min-w-0">
                                <div className="m-0 truncate font-sans text-sm leading-normal font-semibold tracking-normal text-foreground">
                                    {settingsUserName}
                                </div>
                                <div className="mt-0.5 mb-0 truncate font-mono text-xs leading-normal font-medium tracking-normal text-muted-foreground">
                                    {settingsUserSubtitle}
                                </div>
                            </div>
                        </div>

                        <DialogClose asChild>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={t("settingsDialog.close")}
                                className="size-[30px] shrink-0"
                                disabled={isSettingsBusy}
                                type="button"
                            >
                                <X
                                    data-icon="inline-start"
                                    aria-hidden="true"
                                />
                            </Button>
                        </DialogClose>
                    </header>

                    <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] min-[900px]:grid-cols-[200px_minmax(0,1fr)] min-[900px]:grid-rows-1">
                        <div className="border-b border-border bg-muted/30 px-4 py-3 min-[900px]:hidden">
                            <Select
                                id={SETTINGS_SECTION_SELECT_ID}
                                aria-label={t("settingsDialog.title")}
                                disabled={isSettingsBusy}
                                options={orderedSettingsNav.map((item) => ({
                                    label: t(item.labelKey),
                                    value: item.id,
                                }))}
                                value={activeSection}
                                onValueChange={(value) => {
                                    const section =
                                        normalizeSettingsSection(value);
                                    if (section && !isSettingsBusy) {
                                        applyActiveSettingsSection(section);
                                    }
                                }}
                            />
                        </div>
                        <nav
                            className="hidden min-h-0 flex-col gap-[2px] overflow-x-hidden overflow-y-auto border-r border-border bg-muted/50 px-2 py-3.5 [overscroll-behavior:contain] [writing-mode:horizontal-tb] min-[900px]:flex"
                            aria-label={t("settingsDialog.title")}
                        >
                            {settingsNavGroups.map((group) => {
                                return (
                                    <fieldset
                                        key={group.labelKey}
                                        className="flex w-full min-w-0 flex-col items-stretch gap-[2px] border-0 p-0 [&+&]:mt-2.5"
                                    >
                                        <legend className="block w-full truncate px-2.5 pt-2.5 pb-1 font-sans text-[10px] leading-normal font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                                            {t(group.labelKey)}
                                        </legend>
                                        {group.items.map((item) => {
                                            const itemIndex =
                                                orderedSettingsNav.findIndex(
                                                    (entry) =>
                                                        entry.id === item.id,
                                                );
                                            const isActive =
                                                activeSection === item.id;

                                            return (
                                                <Button
                                                    key={item.id}
                                                    ref={(node) => {
                                                        navButtonRefs.current[
                                                            itemIndex
                                                        ] = node;
                                                    }}
                                                    variant={
                                                        isActive
                                                            ? "outline"
                                                            : "ghost"
                                                    }
                                                    size="sm"
                                                    className="w-full min-w-0 justify-start gap-2.5 truncate text-left"
                                                    onClick={() => {
                                                        if (!isSettingsBusy) {
                                                            applyActiveSettingsSection(
                                                                item.id,
                                                            );
                                                        }
                                                    }}
                                                    onFocus={() => {
                                                        setRovingIndex(
                                                            itemIndex,
                                                        );
                                                    }}
                                                    onKeyDown={(event) => {
                                                        handleNavKeyDown(
                                                            event,
                                                            itemIndex,
                                                        );
                                                    }}
                                                    disabled={isSettingsBusy}
                                                    aria-current={
                                                        isActive
                                                            ? "page"
                                                            : undefined
                                                    }
                                                    tabIndex={
                                                        rovingIndex ===
                                                        itemIndex
                                                            ? 0
                                                            : -1
                                                    }
                                                    type="button"
                                                >
                                                    <item.icon
                                                        data-icon="inline-start"
                                                        aria-hidden="true"
                                                    />
                                                    <span className="min-w-0 truncate">
                                                        {t(item.labelKey)}
                                                    </span>
                                                </Button>
                                            );
                                        })}
                                    </fieldset>
                                );
                            })}
                        </nav>

                        <SettingsContent
                            activeSection={activeSection}
                            scrollRef={scrollBodyRef}
                        />
                    </div>
                </SettingsBusyProvider>
            </DialogContent>
        </Dialog>
    );
}
