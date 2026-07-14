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

const SETTINGS_CLOSE_BUTTON_CLASS = "size-[30px] shrink-0";

const SETTINGS_SHELL_SURFACE_CLASS =
    "box-border flex h-[min(94svh,980px)] max-h-[calc(100svh_-_1rem)] w-[920px] max-w-[calc(100vw_-_40px)] flex-col gap-0 overflow-hidden border-border bg-card p-0 sm:max-w-[min(920px,calc(100vw_-_40px))]";

const SETTINGS_HEADER_CLASS =
    "flex flex-none items-center gap-3 border-b border-border px-5 py-[18px] max-[720px]:flex-wrap max-[720px]:items-start max-[720px]:gap-3";

const SETTINGS_USER_SUMMARY_CLASS =
    "flex min-w-0 flex-1 items-center gap-3 max-[720px]:basis-[calc(100%_-_42px)]";

const SETTINGS_USER_SUMMARY_TEXT_CLASS = "min-w-0";

const SETTINGS_USER_AVATAR_CLASS =
    "grid size-9 flex-none place-items-center rounded-full border border-border bg-muted text-muted-foreground";

const SETTINGS_USER_NAME_CLASS =
    "m-0 font-sans text-sm font-semibold leading-normal tracking-normal text-foreground max-[720px]:truncate";

const SETTINGS_USER_SUBTITLE_CLASS =
    "mt-0.5 mb-0 font-mono text-xs font-medium leading-normal tracking-normal text-muted-foreground max-[720px]:truncate";

const SETTINGS_BODY_CLASS =
    "grid min-h-0 flex-1 grid-cols-[200px_minmax(0,1fr)]";

const SETTINGS_RAIL_CLASS =
    "flex min-h-0 flex-col gap-[2px] overflow-x-hidden overflow-y-auto border-r border-border bg-muted/50 px-[8px] py-[14px] [overscroll-behavior:contain] [writing-mode:horizontal-tb]";

const SETTINGS_NAV_GROUP_CLASS =
    "flex w-full min-w-0 flex-col items-stretch gap-[2px] border-0 p-0 [&+&]:mt-[10px]";

const SETTINGS_NAV_GROUP_LABEL_CLASS =
    "block w-full truncate px-[10px] pt-[10px] pb-[4px] font-sans text-[10px] font-semibold leading-[normal] tracking-[0.08em] text-muted-foreground uppercase";

const SETTINGS_NAV_BUTTON_CLASS =
    "w-full min-w-0 justify-start gap-2.5 truncate text-left";

const STORAGE_KEY = "settings-last-section";

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
            navButtonRefs.current[
                getSettingsSectionIndex(initialSection)
            ]?.focus({ preventScroll: true });
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
            navButtonRefs.current[getSettingsSectionIndex(activeSection)];
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
                className={SETTINGS_SHELL_SURFACE_CLASS}
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
                    <header className={SETTINGS_HEADER_CLASS}>
                        <div className={SETTINGS_USER_SUMMARY_CLASS}>
                            <span
                                aria-hidden="true"
                                className={SETTINGS_USER_AVATAR_CLASS}
                            >
                                <Monitor />
                            </span>
                            <div className={SETTINGS_USER_SUMMARY_TEXT_CLASS}>
                                <div className={SETTINGS_USER_NAME_CLASS}>
                                    {settingsUserName}
                                </div>
                                <div className={SETTINGS_USER_SUBTITLE_CLASS}>
                                    {settingsUserSubtitle}
                                </div>
                            </div>
                        </div>

                        <DialogClose asChild>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={t("settingsDialog.close")}
                                className={SETTINGS_CLOSE_BUTTON_CLASS}
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

                    <div className={SETTINGS_BODY_CLASS}>
                        <nav
                            className={SETTINGS_RAIL_CLASS}
                            aria-label={t("settingsDialog.title")}
                        >
                            {settingsNavGroups.map((group) => {
                                return (
                                    <fieldset
                                        key={group.labelKey}
                                        className={SETTINGS_NAV_GROUP_CLASS}
                                    >
                                        <legend
                                            className={
                                                SETTINGS_NAV_GROUP_LABEL_CLASS
                                            }
                                        >
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
                                                    className={
                                                        SETTINGS_NAV_BUTTON_CLASS
                                                    }
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
