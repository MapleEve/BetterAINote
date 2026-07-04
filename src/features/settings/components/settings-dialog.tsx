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
} from "@/components/ui/dialog";
import {
    addBrowserWindowEventListener,
    readBrowserHash,
    readBrowserStorage,
    removeBrowserWindowEventListener,
    startBrowserTimeout,
    stopBrowserTimeout,
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
    returnFocusRef?: React.RefObject<HTMLElement | null>;
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

const SETTINGS_CLOSE_BUTTON_CLASS = "shrink-0 size-[32px]";

const SETTINGS_SHELL_SURFACE_CLASS =
    "box-border flex h-[min(94svh,980px)] max-h-[calc(100svh_-_1rem)] w-[920px] max-w-[calc(100vw_-_40px)] flex-col gap-0 overflow-hidden rounded-[16px] bg-card p-0 sm:max-w-[920px]";

const SETTINGS_HEADER_CLASS =
    "flex flex-none items-center border-b border-border px-5 py-[18px] max-[720px]:flex-wrap max-[720px]:items-start max-[720px]:gap-3";

const SETTINGS_USER_SUMMARY_CLASS =
    "flex min-w-0 flex-1 items-center gap-3 max-[720px]:basis-[calc(100%_-_42px)]";

const SETTINGS_USER_SUMMARY_TEXT_CLASS = "min-w-0";

const SETTINGS_USER_AVATAR_CLASS =
    "grid size-9 flex-none place-items-center rounded-full border border-border bg-muted text-muted-foreground";

const SETTINGS_USER_NAME_CLASS =
    "m-0 font-sans text-sm font-semibold leading-normal tracking-normal text-foreground max-[720px]:truncate";

const SETTINGS_USER_SUBTITLE_CLASS =
    "mt-0.5 mb-0 font-mono text-xs font-medium leading-normal tracking-normal text-muted-foreground max-[720px]:truncate";

const SETTINGS_BODY_CLASS = "grid min-h-0 flex-1 grid-cols-[200px_1fr]";

const SETTINGS_RAIL_CLASS =
    "flex min-h-0 flex-col gap-[2px] overflow-y-auto border-r border-border bg-muted/50 px-[8px] py-[14px] [overscroll-behavior:contain] [writing-mode:horizontal-tb] [&_*]:[writing-mode:horizontal-tb]";

const SETTINGS_NAV_GROUP_CLASS =
    "flex w-full min-w-0 flex-col items-stretch gap-[2px] p-0 [&+&]:mt-[10px]";

const SETTINGS_NAV_GROUP_LABEL_CLASS =
    "block w-full truncate px-[10px] pt-[10px] pb-[4px] font-sans text-[10px] font-semibold leading-[normal] tracking-[0.08em] text-muted-foreground uppercase";

const SETTINGS_NAV_BUTTON_CLASS =
    "w-full min-w-0 justify-start truncate text-left";

const SETTINGS_NAV_CONTROL_SELECTOR = "[data-settings-nav-control]";
const SETTINGS_INNER_SCROLL_SELECTOR = "[data-settings-inner-scroll]";

const STORAGE_KEY = "settings-last-section";

function shouldBypassSettingsKeyboardNav(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) {
        return false;
    }

    if (target.closest(SETTINGS_NAV_CONTROL_SELECTOR)) {
        return false;
    }

    return Boolean(
        target.isContentEditable ||
            target.closest(
                [
                    "input",
                    "textarea",
                    "select",
                    "button",
                    "a[href]",
                    ".ls-result",
                    '[role="button"]',
                    '[role="combobox"]',
                    '[role="listbox"]',
                    '[role="menuitem"]',
                    '[role="option"]',
                ].join(","),
            ),
    );
}

function isSettingsActivationKey(event: Pick<KeyboardEvent, "code" | "key">) {
    return (
        event.key === "Enter" ||
        event.key === " " ||
        event.key === "Space" ||
        event.key === "Spacebar" ||
        event.code === "Space"
    );
}

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
    const [keyboardSelectedIndex, setKeyboardSelectedIndex] =
        React.useState<number>(0);
    const [hasResolvedInitialSection, setHasResolvedInitialSection] =
        React.useState(false);
    const [busySections, setBusySections] = React.useState<
        Record<string, true>
    >({});
    const navBoundaryRef = React.useRef<HTMLElement | null>(null);
    const settingsShellRef = React.useRef<HTMLDivElement | null>(null);
    const firstNavButtonRef = React.useRef<HTMLButtonElement | null>(null);
    const scrollBodyRef = React.useRef<HTMLDivElement | null>(null);
    const returnFocusRef = React.useRef<HTMLElement | null>(null);
    const previousOpenRef = React.useRef(false);
    const keyboardSelectedIndexRef = React.useRef<number>(0);

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
    const applyKeyboardSelectedIndex = React.useCallback((index: number) => {
        const nextIndex = Math.max(
            0,
            Math.min(index, orderedSettingsNav.length - 1),
        );
        keyboardSelectedIndexRef.current = nextIndex;
        setKeyboardSelectedIndex(nextIndex);
        return nextIndex;
    }, []);
    const applyActiveSettingsSection = React.useCallback(
        (section: CanonicalSettingsSection) => {
            setActiveSection(section);
            applyKeyboardSelectedIndex(getSettingsSectionIndex(section));
        },
        [applyKeyboardSelectedIndex],
    );
    const focusSettingsNavItem = React.useCallback(
        (section: CanonicalSettingsSection) => {
            startBrowserTimeout(() => {
                navBoundaryRef.current
                    ?.querySelector<HTMLButtonElement>(
                        `[data-settings-nav-control][data-sot-section="${section}"]`,
                    )
                    ?.focus({ preventScroll: true });
            }, 0);
        },
        [],
    );
    const activateKeyboardSelectedSection = React.useCallback(() => {
        const selectedItem =
            orderedSettingsNav[keyboardSelectedIndexRef.current];
        if (selectedItem) {
            applyActiveSettingsSection(selectedItem.id);
            focusSettingsNavItem(selectedItem.id);
        }
    }, [applyActiveSettingsSection, focusSettingsNavItem]);
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
    const restoreReturnFocus = React.useCallback(
        (forceFocus = false) => {
            const target =
                props.returnFocusRef?.current ?? returnFocusRef.current;
            const restoreDelays = [0, 50, 250, 750, 1250, 2000];
            const focusTarget = () => {
                if (target && document.contains(target)) {
                    const activeElement = document.activeElement;
                    const activeHTMLElement =
                        activeElement instanceof HTMLElement
                            ? activeElement
                            : null;
                    const isFocusInsideSettingsShell = Boolean(
                        activeHTMLElement &&
                            settingsShellRef.current?.contains(
                                activeHTMLElement,
                            ),
                    );
                    const shouldRestoreFocus =
                        forceFocus ||
                        activeElement === target ||
                        activeElement === document.body ||
                        activeElement === document.documentElement ||
                        !activeHTMLElement ||
                        isFocusInsideSettingsShell;

                    if (shouldRestoreFocus) {
                        target.focus({ preventScroll: true });
                    }
                }
            };

            restoreDelays.forEach((delay) => {
                startBrowserTimeout(focusTarget, delay);
            });
            returnFocusRef.current = null;
        },
        [props.returnFocusRef],
    );
    const handleCloseSettings = React.useCallback(() => {
        if (isSettingsBusy) {
            return;
        }

        restoreReturnFocus(true);
        props.onOpenChange(false);
    }, [isSettingsBusy, props.onOpenChange, restoreReturnFocus]);

    const handleCloseKeyDown = React.useCallback(
        (event: React.KeyboardEvent<HTMLButtonElement>) => {
            if (!isSettingsActivationKey(event)) {
                return;
            }

            event.preventDefault();
            handleCloseSettings();
        },
        [handleCloseSettings],
    );
    const handleNavKeyDown = React.useCallback(
        (event: React.KeyboardEvent<HTMLButtonElement>) => {
            if (event.key === "ArrowDown") {
                event.preventDefault();
                event.stopPropagation();
                applyKeyboardSelectedIndex(
                    keyboardSelectedIndexRef.current + 1,
                );
                return;
            }

            if (event.key === "ArrowUp") {
                event.preventDefault();
                event.stopPropagation();
                applyKeyboardSelectedIndex(
                    keyboardSelectedIndexRef.current - 1,
                );
                return;
            }

            if (!isSettingsActivationKey(event)) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();
            if (!isSettingsBusy) {
                activateKeyboardSelectedSection();
            }
        },
        [
            activateKeyboardSelectedSection,
            applyKeyboardSelectedIndex,
            isSettingsBusy,
        ],
    );
    const handleNavKeyUp = React.useCallback(
        (event: React.KeyboardEvent<HTMLButtonElement>) => {
            if (!isSettingsActivationKey(event)) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();
        },
        [],
    );
    const handleCloseAutoFocus = React.useCallback(
        (event: Event) => {
            event.preventDefault();
            restoreReturnFocus();
        },
        [restoreReturnFocus],
    );
    const handleEscapeKeyDown = React.useCallback(
        (event: KeyboardEvent) => {
            event.preventDefault();
            event.stopPropagation();
            if (isSettingsBusy) {
                return;
            }

            handleCloseSettings();
            restoreReturnFocus(true);
        },
        [handleCloseSettings, isSettingsBusy, restoreReturnFocus],
    );

    React.useEffect(() => {
        if (!props.open) {
            setHasResolvedInitialSection(false);
            return;
        }

        applyActiveSettingsSection(resolveInitialSettingsSection());
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

    React.useEffect(() => {
        const wasOpen = previousOpenRef.current;
        previousOpenRef.current = props.open;

        if (props.open && !wasOpen) {
            const activeElement = document.activeElement;
            returnFocusRef.current =
                props.returnFocusRef?.current ??
                (activeElement instanceof HTMLElement ? activeElement : null);
            return;
        }

        if (!props.open && wasOpen) {
            restoreReturnFocus();
        }
    }, [props.open, props.returnFocusRef, restoreReturnFocus]);

    React.useEffect(() => {
        if (!props.open) {
            setBusySections({});
        }
    }, [props.open]);

    React.useEffect(() => {
        if (!props.open) return;

        const { body, documentElement } = document;
        const previousHtmlOverflow = documentElement.style.overflow;
        const previousHtmlOverscroll = documentElement.style.overscrollBehavior;
        const previousBodyOverflow = body.style.overflow;
        const previousBodyOverscroll = body.style.overscrollBehavior;

        documentElement.style.overflow = "hidden";
        documentElement.style.overscrollBehavior = "none";
        body.style.overflow = "hidden";
        body.style.overscrollBehavior = "none";

        return () => {
            documentElement.style.overflow = previousHtmlOverflow;
            documentElement.style.overscrollBehavior = previousHtmlOverscroll;
            body.style.overflow = previousBodyOverflow;
            body.style.overscrollBehavior = previousBodyOverscroll;
        };
    }, [props.open]);

    React.useEffect(() => {
        if (!props.open) return;

        const timer = startBrowserTimeout(() => {
            firstNavButtonRef.current?.focus();
        }, 100);

        return () => stopBrowserTimeout(timer);
    }, [props.open]);

    React.useEffect(() => {
        if (!props.open) return;

        scrollBodyRef.current?.setAttribute("data-sot-section", activeSection);
        scrollBodyRef.current?.scrollTo({ top: 0, left: 0 });
        scrollBodyRef.current
            ?.querySelectorAll<HTMLElement>(SETTINGS_INNER_SCROLL_SELECTOR)
            .forEach((node) => {
                node.scrollTop = 0;
                node.scrollLeft = 0;
            });
    }, [activeSection, props.open]);

    const handleKeyDown = React.useCallback(
        (event: KeyboardEvent) => {
            if (!props.open) return;

            if (shouldBypassSettingsKeyboardNav(event.target)) {
                return;
            }

            if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                if (isSettingsBusy) {
                    return;
                }

                restoreReturnFocus(true);
                props.onOpenChange(false);
                return;
            }

            if (isSettingsBusy) {
                switch (event.key) {
                    case "ArrowDown":
                        event.preventDefault();
                        event.stopPropagation();
                        applyKeyboardSelectedIndex(
                            keyboardSelectedIndexRef.current + 1,
                        );
                        break;
                    case "ArrowUp":
                        event.preventDefault();
                        event.stopPropagation();
                        applyKeyboardSelectedIndex(
                            keyboardSelectedIndexRef.current - 1,
                        );
                        break;
                    default:
                        if (!isSettingsActivationKey(event)) {
                            break;
                        }
                        event.preventDefault();
                        event.stopPropagation();
                        break;
                }
                return;
            }

            switch (event.key) {
                case "ArrowDown":
                    event.preventDefault();
                    applyKeyboardSelectedIndex(
                        keyboardSelectedIndexRef.current + 1,
                    );
                    break;
                case "ArrowUp":
                    event.preventDefault();
                    applyKeyboardSelectedIndex(
                        keyboardSelectedIndexRef.current - 1,
                    );
                    break;
                default: {
                    if (!isSettingsActivationKey(event)) {
                        break;
                    }
                    event.preventDefault();
                    activateKeyboardSelectedSection();
                    break;
                }
            }
        },
        [
            activateKeyboardSelectedSection,
            applyKeyboardSelectedIndex,
            isSettingsBusy,
            props,
            restoreReturnFocus,
        ],
    );

    React.useEffect(() => {
        if (!props.open) return;
        addBrowserWindowEventListener("keydown", handleKeyDown);
        return () => removeBrowserWindowEventListener("keydown", handleKeyDown);
    }, [handleKeyDown, props.open]);

    return (
        <Dialog open={props.open} onOpenChange={handleDialogOpenChange}>
            <DialogContent
                ref={settingsShellRef}
                data-sot-busy={isSettingsBusy ? "true" : "false"}
                data-sot-section={activeSection}
                data-sot-state={isSettingsBusy ? "busy" : "idle"}
                data-sot-surface="settings-shell"
                aria-label={t("settingsDialog.title")}
                aria-busy={isSettingsBusy}
                overlayProps={{
                    "data-sot-overlay": "settings-shell",
                }}
                className={SETTINGS_SHELL_SURFACE_CLASS}
                onCloseAutoFocus={handleCloseAutoFocus}
                onEscapeKeyDown={handleEscapeKeyDown}
                onInteractOutside={(event) => {
                    const target = event.target;
                    if (
                        target instanceof HTMLElement &&
                        target.closest('[data-sot-panel="confirm-dialog"]')
                    ) {
                        event.preventDefault();
                        return;
                    }

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
                    <header
                        className={SETTINGS_HEADER_CLASS}
                        data-sot-panel="settings-header"
                    >
                        <div
                            className={SETTINGS_USER_SUMMARY_CLASS}
                            data-sot-part="settings-user-summary"
                        >
                            <span
                                aria-hidden="true"
                                className={SETTINGS_USER_AVATAR_CLASS}
                                data-sot-part="settings-user-avatar"
                            >
                                <Monitor />
                            </span>
                            <div className={SETTINGS_USER_SUMMARY_TEXT_CLASS}>
                                <h2
                                    className={SETTINGS_USER_NAME_CLASS}
                                    data-sot-part="settings-user-name"
                                >
                                    {settingsUserName}
                                </h2>
                                <p
                                    className={SETTINGS_USER_SUBTITLE_CLASS}
                                    data-sot-part="settings-user-subtitle"
                                >
                                    {settingsUserSubtitle}
                                </p>
                            </div>
                        </div>

                        <DialogClose asChild>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={t("settingsDialog.close")}
                                className={SETTINGS_CLOSE_BUTTON_CLASS}
                                data-sot-control="settings-close"
                                data-sot-state={
                                    isSettingsBusy ? "busy" : "idle"
                                }
                                data-state={isSettingsBusy ? "busy" : "idle"}
                                onClick={handleCloseSettings}
                                onKeyDown={handleCloseKeyDown}
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

                    <div
                        className={SETTINGS_BODY_CLASS}
                        data-sot-panel="settings-body"
                    >
                        {/* biome-ignore lint/a11y/useSemanticElements: SOT settings rail is aside[role=navigation]. */}
                        <aside
                            ref={navBoundaryRef}
                            role="navigation"
                            className={SETTINGS_RAIL_CLASS}
                            data-sot-panel="settings-rail"
                            aria-label={t("settingsDialog.title")}
                        >
                            {settingsNavGroups.map((group) => (
                                <div
                                    key={group.labelKey}
                                    className={SETTINGS_NAV_GROUP_CLASS}
                                    data-sot-list="settings-nav-group"
                                >
                                    <div
                                        className={
                                            SETTINGS_NAV_GROUP_LABEL_CLASS
                                        }
                                        data-sot-part="settings-nav-group-label"
                                    >
                                        {t(group.labelKey)}
                                    </div>
                                    {group.items.map((item) => {
                                        const itemIndex =
                                            orderedSettingsNav.findIndex(
                                                (entry) => entry.id === item.id,
                                            );
                                        const isActive =
                                            activeSection === item.id;

                                        return (
                                            <Button
                                                key={item.id}
                                                ref={
                                                    itemIndex === 0
                                                        ? firstNavButtonRef
                                                        : undefined
                                                }
                                                variant={
                                                    isActive
                                                        ? "secondary"
                                                        : "ghost"
                                                }
                                                size="sm"
                                                className={
                                                    SETTINGS_NAV_BUTTON_CLASS
                                                }
                                                data-sot-control="settings-nav"
                                                data-settings-nav-control=""
                                                data-sot-nav={
                                                    itemIndex === 0
                                                        ? "first"
                                                        : undefined
                                                }
                                                data-sot-section={item.id}
                                                data-state={
                                                    isActive
                                                        ? "active"
                                                        : "inactive"
                                                }
                                                data-sot-state={
                                                    isActive
                                                        ? "selected"
                                                        : "idle"
                                                }
                                                data-keyboard-selected={
                                                    keyboardSelectedIndex ===
                                                    itemIndex
                                                }
                                                onClick={() => {
                                                    if (!isSettingsBusy) {
                                                        applyActiveSettingsSection(
                                                            item.id,
                                                        );
                                                    }
                                                }}
                                                disabled={isSettingsBusy}
                                                aria-label={`${t(item.labelKey)} ${t("settingsDialog.title")}`}
                                                aria-current={
                                                    isActive
                                                        ? "page"
                                                        : undefined
                                                }
                                                onKeyDown={handleNavKeyDown}
                                                onKeyUp={handleNavKeyUp}
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
                                </div>
                            ))}
                        </aside>

                        <SettingsContent
                            key={activeSection}
                            activeSection={activeSection}
                            scrollRef={scrollBodyRef}
                        />
                    </div>
                </SettingsBusyProvider>
            </DialogContent>
        </Dialog>
    );
}
