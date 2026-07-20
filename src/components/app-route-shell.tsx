"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Menu, PanelLeft, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ComponentType, type ReactNode, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NavigationItem = {
    href: string;
    label: string;
};

const navigationItems: NavigationItem[] = [
    { href: "/dashboard", label: "录音库" },
    { href: "/onboarding", label: "开始配置" },
    { href: "/settings", label: "设置" },
];

function isActivePath(pathname: string, href: string) {
    return href === "/dashboard"
        ? pathname === href
        : pathname === href || pathname.startsWith(`${href}/`);
}

function RouteNavigation({
    collapsed = false,
    onNavigate,
}: {
    collapsed?: boolean;
    onNavigate?: () => void;
}) {
    const pathname = usePathname();

    return (
        <nav aria-label="主导航" className="flex min-w-0 flex-1 flex-col gap-1">
            <p
                className={cn(
                    "px-2 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
                    collapsed && "sr-only",
                )}
            >
                工作空间
            </p>
            {navigationItems.map((item) => {
                const active = isActivePath(pathname, item.href);

                return (
                    <Button
                        aria-current={active ? "page" : undefined}
                        asChild
                        className={cn(
                            "w-full justify-start overflow-hidden text-left",
                            collapsed && "justify-center px-0",
                        )}
                        data-control="app-route-navigation"
                        data-state={active ? "active" : "idle"}
                        key={item.href}
                        size="sm"
                        title={collapsed ? item.label : undefined}
                        variant={active ? "secondary" : "ghost"}
                    >
                        <Link href={item.href} onClick={onNavigate}>
                            <span
                                className={cn(
                                    "truncate",
                                    collapsed && "sr-only",
                                )}
                            >
                                {item.label}
                            </span>
                            {collapsed ? (
                                <span aria-hidden="true">{item.label[0]}</span>
                            ) : null}
                        </Link>
                    </Button>
                );
            })}
        </nav>
    );
}

function RouteBrand({ collapsed = false }: { collapsed?: boolean }) {
    return (
        <Link
            aria-label="BetterAINote 录音库"
            className={cn(
                "flex min-w-0 items-center gap-2 px-2 py-1 font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                collapsed && "justify-center px-0",
            )}
            href="/dashboard"
        >
            <span
                aria-hidden="true"
                className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground"
            >
                B
            </span>
            <span className={cn("truncate text-sm", collapsed && "sr-only")}>
                BetterAINote
            </span>
        </Link>
    );
}

function MobileNavigation({
    ThemeAction,
    open,
    onOpenChange,
}: {
    ThemeAction: ComponentType;
    onOpenChange: (open: boolean) => void;
    open: boolean;
}) {
    return (
        <Dialog.Root onOpenChange={onOpenChange} open={open}>
            <Dialog.Trigger asChild>
                <Button
                    aria-label="打开主导航"
                    data-control="app-mobile-navigation-trigger"
                    data-state={open ? "open" : "closed"}
                    size="icon"
                    title="打开主导航"
                    variant="ghost"
                >
                    <Menu aria-hidden="true" />
                </Button>
            </Dialog.Trigger>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/20 data-[state=closed]:animate-out data-[state=open]:animate-in" />
                <Dialog.Content
                    aria-describedby={undefined}
                    className="fixed inset-y-0 left-0 z-50 flex w-[min(18rem,calc(100vw-2.5rem))] flex-col border-r border-border bg-background p-3 shadow-xl outline-none data-[state=closed]:animate-out data-[state=open]:animate-in"
                    data-control="app-mobile-navigation-sheet"
                    data-state={open ? "open" : "closed"}
                >
                    <Dialog.Title className="sr-only">主导航</Dialog.Title>
                    <div className="flex items-center justify-between gap-3 pb-3">
                        <RouteBrand />
                        <Dialog.Close asChild>
                            <Button
                                aria-label="关闭主导航"
                                size="icon"
                                title="关闭主导航"
                                variant="ghost"
                            >
                                <X aria-hidden="true" />
                            </Button>
                        </Dialog.Close>
                    </div>
                    <RouteNavigation onNavigate={() => onOpenChange(false)} />
                    <div className="mt-auto border-t border-border pt-3">
                        <ThemeAction />
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}

function isFeatureOwnedRoute(pathname: string) {
    return pathname === "/dashboard" || pathname.startsWith("/recordings/");
}

export function AppRouteShell({
    children,
    ThemeAction,
}: {
    children: ReactNode;
    ThemeAction: ComponentType;
}) {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);
    const [hydrated, setHydrated] = useState(false);
    const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

    useEffect(() => {
        const persisted = window.localStorage.getItem(
            "app-shell-sidebar-collapsed",
        );

        setCollapsed(persisted === "true");
        setHydrated(true);
    }, []);

    const toggleSidebar = () => {
        setCollapsed((current) => {
            const next = !current;

            window.localStorage.setItem(
                "app-shell-sidebar-collapsed",
                String(next),
            );
            return next;
        });
    };

    if (isFeatureOwnedRoute(pathname)) {
        return children;
    }

    return (
        <div
            className={cn(
                "min-h-svh bg-background text-foreground lg:grid",
                collapsed
                    ? "lg:grid-cols-[4rem_minmax(0,1fr)]"
                    : "lg:grid-cols-[16rem_minmax(0,1fr)]",
            )}
            data-control="app-route-shell"
            data-hydrated={hydrated ? "true" : "false"}
            data-state={collapsed ? "collapsed" : "expanded"}
        >
            <aside
                className={cn(
                    "hidden min-h-svh flex-col border-r border-border bg-card px-3 pb-3 pt-4 text-card-foreground lg:flex",
                    collapsed && "items-center px-2",
                )}
            >
                <RouteBrand collapsed={collapsed} />
                <RouteNavigation collapsed={collapsed} />
            </aside>
            <div className="min-w-0">
                <header className="flex min-h-14 items-center gap-2 border-b border-border bg-background px-3 py-2 lg:px-4">
                    <div className="lg:hidden">
                        <MobileNavigation
                            ThemeAction={ThemeAction}
                            onOpenChange={setMobileNavigationOpen}
                            open={mobileNavigationOpen}
                        />
                    </div>
                    <Button
                        aria-label={collapsed ? "展开侧边栏" : "折叠侧边栏"}
                        className="hidden lg:inline-flex"
                        data-control="app-sidebar-collapse"
                        data-state={collapsed ? "collapsed" : "expanded"}
                        onClick={toggleSidebar}
                        size="icon"
                        title={collapsed ? "展开侧边栏" : "折叠侧边栏"}
                        variant="ghost"
                    >
                        <PanelLeft aria-hidden="true" />
                    </Button>
                    <p
                        className="min-w-0 flex-1 truncate text-sm font-semibold"
                        data-control="app-route-title"
                    >
                        {navigationItems.find((item) =>
                            isActivePath(pathname, item.href),
                        )?.label ?? "BetterAINote"}
                    </p>
                    <ThemeAction />
                </header>
                <main className="min-w-0" id="app-route-content">
                    {children}
                </main>
            </div>
        </div>
    );
}
