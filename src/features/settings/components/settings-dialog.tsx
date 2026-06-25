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

const SETTINGS_NAV_BUTTON_CLASS =
    "h-auto w-full min-w-0 cursor-pointer justify-start gap-[10px] truncate rounded-[8px] border border-transparent bg-transparent px-[10px] py-[8px] text-left font-sans text-[13px] font-medium leading-[normal] tracking-normal text-[var(--fg-secondary)] shadow-none data-[state=inactive]:[box-shadow:none] hover:bg-[var(--bg-recessed)] hover:text-[var(--fg-primary)] focus-visible:border-transparent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] focus-visible:ring-0 data-[state=active]:border-[var(--line-hairline)] data-[state=active]:bg-[var(--bg-elevated)] data-[state=active]:text-[var(--fg-primary)] data-[state=active]:shadow-xs data-[state=active]:hover:bg-[var(--bg-elevated)] data-[state=active]:hover:text-[var(--fg-primary)] dark:data-[state=active]:border-[var(--glass-border)] dark:data-[state=active]:bg-[rgb(255_255_255_/_0.07)] dark:data-[state=active]:shadow-none dark:data-[state=active]:[box-shadow:none] dark:data-[state=active]:hover:bg-[rgb(255_255_255_/_0.07)] has-[>svg]:px-[10px] [&_span]:min-w-0 [&_span]:truncate [&_svg:not([class*='size-'])]:size-[14px] [&_svg]:flex-none [&_svg]:fill-none [&_svg]:stroke-current [&_svg]:stroke-[1.8] [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round]";

const STORAGE_KEY = "settings-last-section";

function shouldBypassSettingsKeyboardNav(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) {
        return false;
    }

    if (target.closest('[data-sot-control="settings-nav"]')) {
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
    const scrollBodyRef = React.useRef<HTMLDivElement | null>(null);
    const returnFocusRef = React.useRef<HTMLElement | null>(null);
    const previousOpenRef = React.useRef(false);

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
            setKeyboardSelectedIndex(getSettingsSectionIndex(section));
        },
        [],
    );
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
                    const shouldRestoreFocus =
                        forceFocus ||
                        activeElement === target ||
                        activeElement === document.body ||
                        activeElement === document.documentElement ||
                        !(activeElement instanceof HTMLElement) ||
                        Boolean(
                            activeElement.closest(
                                '[data-sot-surface="settings-shell"]',
                            ),
                        );

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
            if (event.key !== "Enter" && event.key !== " ") {
                return;
            }

            event.preventDefault();
            handleCloseSettings();
        },
        [handleCloseSettings],
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
            const firstButton = navBoundaryRef.current?.querySelector(
                '[data-sot-nav="first"]',
            ) as HTMLButtonElement | null;
            firstButton?.focus();
        }, 100);

        return () => stopBrowserTimeout(timer);
    }, [props.open]);

    React.useEffect(() => {
        if (!props.open) return;

        scrollBodyRef.current?.setAttribute("data-sot-section", activeSection);
        scrollBodyRef.current?.scrollTo({ top: 0, left: 0 });
        scrollBodyRef.current
            ?.querySelectorAll<HTMLElement>("[data-sot-inner-scroll]")
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
                if (
                    event.key === "ArrowDown" ||
                    event.key === "ArrowUp" ||
                    event.key === "Enter" ||
                    event.key === " "
                ) {
                    event.preventDefault();
                    event.stopPropagation();
                }
                return;
            }

            switch (event.key) {
                case "ArrowDown":
                    event.preventDefault();
                    setKeyboardSelectedIndex((previous) =>
                        Math.min(previous + 1, orderedSettingsNav.length - 1),
                    );
                    break;
                case "ArrowUp":
                    event.preventDefault();
                    setKeyboardSelectedIndex((previous) =>
                        Math.max(previous - 1, 0),
                    );
                    break;
                case "Enter":
                case " ":
                    event.preventDefault();
                    if (orderedSettingsNav[keyboardSelectedIndex]) {
                        setActiveSection(
                            orderedSettingsNav[keyboardSelectedIndex].id,
                        );
                    }
                    break;
            }
        },
        [isSettingsBusy, keyboardSelectedIndex, props, restoreReturnFocus],
    );

    React.useEffect(() => {
        if (!props.open) return;
        addBrowserWindowEventListener("keydown", handleKeyDown);
        return () => removeBrowserWindowEventListener("keydown", handleKeyDown);
    }, [handleKeyDown, props.open]);

    React.useEffect(() => {
        const index = orderedSettingsNav.findIndex(
            (item) => item.id === activeSection,
        );
        if (index !== -1) {
            setKeyboardSelectedIndex(index);
        }
    }, [activeSection]);

    return (
        <Dialog open={props.open} onOpenChange={handleDialogOpenChange}>
            <DialogContent
                data-sot-busy={isSettingsBusy ? "true" : "false"}
                data-sot-section={activeSection}
                data-sot-state={isSettingsBusy ? "busy" : "idle"}
                data-sot-surface="settings-shell"
                aria-label={t("settingsDialog.title")}
                aria-busy={isSettingsBusy}
                overlayProps={{ "data-sot-overlay": "settings-shell" }}
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
                style={
                    {
                        "--tw-enter-scale": "1",
                        "--tw-exit-scale": "1",
                    } as React.CSSProperties
                }
            >
                <DialogTitle className="sr-only">
                    {t("settingsDialog.title")}
                </DialogTitle>
                <DialogDescription className="sr-only">
                    {settingsUserSubtitle}
                </DialogDescription>
                <SettingsBusyProvider value={busyContextValue}>
                    <header data-sot-panel="settings-header">
                        <div data-sot-part="settings-user-summary">
                            <span
                                aria-hidden="true"
                                data-sot-part="settings-user-avatar"
                            >
                                <Monitor />
                            </span>
                            <div>
                                <h2 data-sot-part="settings-user-name">
                                    {settingsUserName}
                                </h2>
                                <p data-sot-part="settings-user-subtitle">
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
                                <X aria-hidden="true" />
                            </Button>
                        </DialogClose>
                    </header>

                    <div data-sot-panel="settings-body">
                        {/* biome-ignore lint/a11y/useSemanticElements: SOT settings rail is aside[role=navigation]. */}
                        <aside
                            ref={navBoundaryRef}
                            role="navigation"
                            data-sot-panel="settings-rail"
                            aria-label={t("settingsDialog.title")}
                        >
                            {settingsNavGroups.map((group) => (
                                <div
                                    key={group.labelKey}
                                    data-sot-list="settings-nav-group"
                                >
                                    <div data-sot-part="settings-nav-group-label">
                                        {t(group.labelKey)}
                                    </div>
                                    {group.items.map((item) => {
                                        const itemIndex =
                                            orderedSettingsNav.findIndex(
                                                (entry) => entry.id === item.id,
                                            );

                                        return (
                                            <Button
                                                key={item.id}
                                                variant="ghost"
                                                className={
                                                    SETTINGS_NAV_BUTTON_CLASS
                                                }
                                                data-sot-control="settings-nav"
                                                data-sot-nav={
                                                    itemIndex === 0
                                                        ? "first"
                                                        : undefined
                                                }
                                                data-sot-section={item.id}
                                                data-state={
                                                    activeSection === item.id
                                                        ? "active"
                                                        : "inactive"
                                                }
                                                data-sot-state={
                                                    activeSection === item.id
                                                        ? "selected"
                                                        : "idle"
                                                }
                                                data-keyboard-selected={
                                                    keyboardSelectedIndex ===
                                                    itemIndex
                                                }
                                                onClick={() =>
                                                    !isSettingsBusy &&
                                                    setActiveSection(item.id)
                                                }
                                                disabled={isSettingsBusy}
                                                aria-label={`${t(item.labelKey)} ${t("settingsDialog.title")}`}
                                                aria-current={
                                                    activeSection === item.id
                                                        ? "page"
                                                        : undefined
                                                }
                                                type="button"
                                            >
                                                <item.icon
                                                    data-icon="inline-start"
                                                    aria-hidden="true"
                                                />
                                                <span>{t(item.labelKey)}</span>
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
