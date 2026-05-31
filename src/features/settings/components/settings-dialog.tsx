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
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarProvider,
} from "@/components/ui/sidebar";
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
import { cn } from "@/lib/utils";
import type { CanonicalSettingsSection } from "@/types/settings";
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

const STORAGE_KEY = "settings-last-section";

const legacySectionAliases: Record<string, CanonicalSettingsSection> = {
    display: "appearance",
    sync: "misc",
    playback: "misc",
};

function getSettingsUserDisplayName(
    user: SettingsUserSummary | undefined,
    t: (key: string) => string,
) {
    const name = user?.name?.trim();
    if (name) {
        return name;
    }

    const email = user?.email?.trim();
    if (email) {
        return email.split("@")[0] || email;
    }

    return t("settingsDialog.localDeployment");
}

function getSettingsUserSubtitle(
    user: SettingsUserSummary | undefined,
    t: (key: string) => string,
) {
    return user?.email?.trim() || t("settingsDialog.singleUserSelfHosted");
}

function getSettingsUserInitial(displayName: string) {
    return Array.from(displayName.trim())[0]?.toLocaleUpperCase() ?? "B";
}

function shouldBypassSettingsKeyboardNav(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) {
        return false;
    }

    if (target.closest("[data-settings-nav-item]")) {
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
                    '[data-slot="select-content"]',
                    '[data-slot="select-item"]',
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

    const alias = legacySectionAliases[value];
    if (alias) {
        return alias;
    }

    return orderedSettingsNav.some((item) => item.id === value)
        ? (value as CanonicalSettingsSection)
        : null;
}

export function SettingsDialog(props: SettingsDialogProps) {
    const { t } = useLanguage();
    const [activeSection, setActiveSection] =
        React.useState<CanonicalSettingsSection>(orderedSettingsNav[0].id);
    const [keyboardSelectedIndex, setKeyboardSelectedIndex] =
        React.useState<number>(0);
    const navBoundaryRef = React.useRef<HTMLElement | null>(null);
    const scrollBodyRef = React.useRef<HTMLDivElement | null>(null);
    const returnFocusRef = React.useRef<HTMLElement | null>(null);
    const previousOpenRef = React.useRef(false);

    const activeNavItem = orderedSettingsNav.find(
        (item) => item.id === activeSection,
    );
    const isDataSourcesSection = activeSection === "data-sources";
    const settingsUserName = getSettingsUserDisplayName(props.user, t);
    const settingsUserSubtitle = getSettingsUserSubtitle(props.user, t);
    const settingsUserInitial = getSettingsUserInitial(settingsUserName);
    const handleCloseSettings = React.useCallback(() => {
        props.onOpenChange(false);
    }, [props.onOpenChange]);
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
                        Boolean(activeElement.closest("[data-settings-shell]"));

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
            handleCloseSettings();
            restoreReturnFocus(true);
        },
        [handleCloseSettings, restoreReturnFocus],
    );

    React.useEffect(() => {
        if (!props.open) return;

        const hash = readBrowserHash();
        const validSection = normalizeSettingsSection(hash);

        if (validSection) {
            setActiveSection(validSection);
            setKeyboardSelectedIndex(
                orderedSettingsNav.findIndex(
                    (item) => item.id === validSection,
                ),
            );
            return;
        }

        const lastSection = readBrowserStorage(STORAGE_KEY);
        const validLastSection = normalizeSettingsSection(lastSection);

        if (validLastSection) {
            setActiveSection(validLastSection);
            setKeyboardSelectedIndex(
                orderedSettingsNav.findIndex(
                    (item) => item.id === validLastSection,
                ),
            );
            return;
        }

        setActiveSection(orderedSettingsNav[0].id);
        setKeyboardSelectedIndex(0);
    }, [props.open]);

    React.useEffect(() => {
        if (!props.open) return;

        writeBrowserHash(activeSection);
        writeBrowserStorage(STORAGE_KEY, activeSection);
    }, [activeSection, props.open]);

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
        if (!props.open) return;

        const timer = startBrowserTimeout(() => {
            const firstButton = navBoundaryRef.current?.querySelector(
                '[data-settings-nav="first"]',
            ) as HTMLButtonElement | null;
            firstButton?.focus();
        }, 100);

        return () => stopBrowserTimeout(timer);
    }, [props.open]);

    React.useEffect(() => {
        if (!props.open) return;

        scrollBodyRef.current?.setAttribute(
            "data-settings-active-section",
            activeSection,
        );
        scrollBodyRef.current?.scrollTo({ top: 0, left: 0 });
        scrollBodyRef.current
            ?.querySelectorAll<HTMLElement>("[data-settings-inner-scroll]")
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
                restoreReturnFocus(true);
                props.onOpenChange(false);
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
        [keyboardSelectedIndex, props, restoreReturnFocus],
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
        <Dialog open={props.open} onOpenChange={props.onOpenChange}>
            <DialogContent
                data-settings-shell=""
                data-settings-active-section={activeSection}
                onCloseAutoFocus={handleCloseAutoFocus}
                onEscapeKeyDown={handleEscapeKeyDown}
                showCloseButton={false}
                className="[--settings-dialog-height:calc(100svh-1rem)] h-(--settings-dialog-height) min-h-(--settings-dialog-height) max-h-(--settings-dialog-height) w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] overflow-hidden p-0 sm:[--settings-dialog-height:min(94svh,980px)] sm:w-[min(96vw,920px)] sm:max-w-none"
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
                    {t("settingsDialog.description")}
                </DialogDescription>

                <SidebarProvider className="min-h-0 flex-1 items-stretch">
                    <Sidebar className="hidden md:flex border-r border-border/65 shadow-none before:hidden after:hidden backdrop-blur-none">
                        <SidebarContent className="gap-0 p-0">
                            <div
                                className="flex h-16 shrink-0 items-center gap-3 border-b border-border/65 px-4"
                                data-testid="settings-user-summary"
                            >
                                <span
                                    className="glass-control flex size-10 shrink-0 items-center justify-center rounded-full font-semibold text-primary text-sm"
                                    aria-hidden="true"
                                    data-testid="settings-user-avatar"
                                >
                                    {settingsUserInitial}
                                </span>
                                <div className="min-w-0">
                                    <h2 className="truncate text-sm font-semibold">
                                        {settingsUserName}
                                    </h2>
                                    <p className="truncate text-muted-foreground text-xs">
                                        {settingsUserSubtitle}
                                    </p>
                                </div>
                            </div>
                            <SidebarGroup className="p-4">
                                <SidebarGroupContent>
                                    <nav
                                        ref={navBoundaryRef}
                                        aria-label={t("settingsDialog.title")}
                                        className="flex flex-col gap-4"
                                    >
                                        {settingsNavGroups.map((group) => (
                                            <div
                                                key={group.labelKey}
                                                className="flex flex-col gap-1"
                                            >
                                                <h3 className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
                                                    {t(group.labelKey)}
                                                </h3>
                                                <SidebarMenu>
                                                    {group.items.map((item) => {
                                                        const itemIndex =
                                                            orderedSettingsNav.findIndex(
                                                                (entry) =>
                                                                    entry.id ===
                                                                    item.id,
                                                            );

                                                        return (
                                                            <SidebarMenuItem
                                                                key={item.id}
                                                            >
                                                                <SidebarMenuButton
                                                                    data-settings-nav-item={
                                                                        item.id
                                                                    }
                                                                    data-settings-nav={
                                                                        itemIndex ===
                                                                        0
                                                                            ? "first"
                                                                            : undefined
                                                                    }
                                                                    isActive={
                                                                        activeSection ===
                                                                        item.id
                                                                    }
                                                                    data-keyboard-selected={
                                                                        keyboardSelectedIndex ===
                                                                        itemIndex
                                                                    }
                                                                    onClick={() =>
                                                                        setActiveSection(
                                                                            item.id,
                                                                        )
                                                                    }
                                                                    aria-label={`${t(item.labelKey)} ${t("settingsDialog.title")}`}
                                                                    aria-current={
                                                                        activeSection ===
                                                                        item.id
                                                                            ? "page"
                                                                            : undefined
                                                                    }
                                                                    className="transition-all duration-200"
                                                                >
                                                                    <item.icon
                                                                        data-icon="inline-start"
                                                                        aria-hidden="true"
                                                                    />
                                                                    <span>
                                                                        {t(
                                                                            item.labelKey,
                                                                        )}
                                                                    </span>
                                                                </SidebarMenuButton>
                                                            </SidebarMenuItem>
                                                        );
                                                    })}
                                                </SidebarMenu>
                                            </div>
                                        ))}
                                    </nav>
                                </SidebarGroupContent>
                            </SidebarGroup>
                        </SidebarContent>
                    </Sidebar>

                    <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent">
                        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border/65 py-0 pl-4 pr-3">
                            <div className="flex flex-1 items-center gap-2">
                                <Breadcrumb>
                                    <BreadcrumbList>
                                        <BreadcrumbItem className="hidden md:block">
                                            <BreadcrumbPage>
                                                {t("settingsDialog.title")}
                                            </BreadcrumbPage>
                                        </BreadcrumbItem>
                                        <BreadcrumbSeparator className="hidden md:block" />
                                        <BreadcrumbItem>
                                            <BreadcrumbPage>
                                                {activeNavItem
                                                    ? t(activeNavItem.labelKey)
                                                    : t("settingsDialog.title")}
                                            </BreadcrumbPage>
                                        </BreadcrumbItem>
                                    </BreadcrumbList>
                                </Breadcrumb>
                            </div>

                            <div className="md:hidden">
                                <Select
                                    value={activeSection}
                                    onValueChange={(value) =>
                                        setActiveSection(
                                            value as CanonicalSettingsSection,
                                        )
                                    }
                                >
                                    <SelectTrigger
                                        className="w-[180px]"
                                        aria-label={t("settingsDialog.title")}
                                    >
                                        <SelectValue>
                                            {activeNavItem
                                                ? t(activeNavItem.labelKey)
                                                : t("settingsDialog.title")}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {orderedSettingsNav.map((item) => (
                                            <SelectItem
                                                key={item.id}
                                                value={item.id}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <item.icon className="h-4 w-4" />
                                                    <span>
                                                        {t(item.labelKey)}
                                                    </span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <DialogClose
                                className="glass-control inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground shadow-none transition-[background-color,color,border-color,opacity] duration-200 hover:bg-accent/45 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                                aria-label={t("settingsDialog.close")}
                                data-testid="settings-close"
                                onClick={handleCloseSettings}
                                onKeyDown={handleCloseKeyDown}
                                type="button"
                            >
                                <X className="h-4 w-4" />
                                <span className="sr-only">
                                    {t("settingsDialog.close")}
                                </span>
                            </DialogClose>
                        </header>

                        <div
                            ref={scrollBodyRef}
                            data-settings-scroll-body=""
                            data-settings-active-section={activeSection}
                            className={cn(
                                "flex min-h-0 flex-1 flex-col overscroll-contain",
                                isDataSourcesSection
                                    ? "overflow-y-auto p-4 lg:overflow-hidden lg:p-0"
                                    : "gap-4 overflow-y-auto p-4 pt-6",
                            )}
                        >
                            <div
                                key={activeSection}
                                className={cn(
                                    "animate-in fade-in-0 min-h-0 duration-200",
                                    isDataSourcesSection &&
                                        "flex flex-1 flex-col",
                                )}
                            >
                                <SettingsContent
                                    activeSection={activeSection}
                                />
                            </div>
                        </div>
                    </main>
                </SidebarProvider>
            </DialogContent>
        </Dialog>
    );
}
