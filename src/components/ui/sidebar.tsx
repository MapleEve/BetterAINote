"use client";

import { PanelLeftIcon } from "lucide-react";
import * as React from "react";

import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const SIDEBAR_WIDTH = "16rem";
const SIDEBAR_WIDTH_ICON = "3rem";

type SidebarContextValue = {
    state: "expanded" | "collapsed";
    open: boolean;
    setOpen: (open: boolean | ((open: boolean) => boolean)) => void;
    toggleSidebar: () => void;
};

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

function useSidebar() {
    const context = React.useContext(SidebarContext);

    if (!context) {
        throw new Error("useSidebar must be used within a SidebarProvider.");
    }

    return context;
}

function SlotRoot({
    children,
    className,
    ...props
}: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) {
    const child = React.Children.only(children);

    if (!React.isValidElement<{ className?: string }>(child)) {
        return null;
    }

    return React.cloneElement(child, {
        ...(props as Partial<typeof child.props>),
        className: cn(child.props.className, className),
    });
}

function SidebarProvider({
    defaultOpen = true,
    open: openProp,
    onOpenChange,
    className,
    style,
    children,
    ...props
}: React.ComponentProps<"div"> & {
    defaultOpen?: boolean;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}) {
    const [_open, _setOpen] = React.useState(defaultOpen);
    const open = openProp ?? _open;

    const setOpen = React.useCallback(
        (value: boolean | ((open: boolean) => boolean)) => {
            const nextOpen = typeof value === "function" ? value(open) : value;

            if (onOpenChange) {
                onOpenChange(nextOpen);
                return;
            }

            _setOpen(nextOpen);
        },
        [onOpenChange, open],
    );

    const toggleSidebar = React.useCallback(() => {
        setOpen((currentOpen) => !currentOpen);
    }, [setOpen]);

    const state: SidebarContextValue["state"] = open ? "expanded" : "collapsed";

    const value = React.useMemo(
        () => ({ state, open, setOpen, toggleSidebar }),
        [open, setOpen, state, toggleSidebar],
    );

    return (
        <SidebarContext.Provider value={value}>
            <div
                data-slot="sidebar-wrapper"
                style={
                    {
                        "--sidebar-width": SIDEBAR_WIDTH,
                        "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
                        ...style,
                    } as React.CSSProperties
                }
                className={cn(
                    "group/sidebar-wrapper flex min-h-svh w-full bg-background text-foreground",
                    className,
                )}
                {...props}
            >
                {children}
            </div>
        </SidebarContext.Provider>
    );
}

function Sidebar({
    side = "left",
    variant = "sidebar",
    collapsible = "offcanvas",
    className,
    children,
    ...props
}: React.ComponentProps<"div"> & {
    side?: "left" | "right";
    variant?: "sidebar" | "floating" | "inset";
    collapsible?: "offcanvas" | "icon" | "none";
}) {
    const { state } = useSidebar();
    const collapsed = state === "collapsed" && collapsible !== "none";

    return (
        <aside
            data-slot="sidebar"
            data-sidebar="sidebar"
            data-state={state}
            data-collapsible={collapsed ? collapsible : ""}
            data-variant={variant}
            data-side={side}
            className={cn(
                "flex h-full min-h-0 flex-col border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-linear",
                side === "left" ? "border-r" : "border-l",
                collapsed && collapsible === "icon"
                    ? "w-[var(--sidebar-width-icon)]"
                    : "w-[var(--sidebar-width)]",
                collapsed && collapsible === "offcanvas" && "hidden md:flex",
                variant === "floating" &&
                    "m-2 rounded-lg border shadow-sm backdrop-blur-xl",
                variant === "inset" && "rounded-lg border shadow-sm",
                className,
            )}
            {...props}
        >
            {children}
        </aside>
    );
}

function SidebarInset({ className, ...props }: React.ComponentProps<"main">) {
    return (
        <main
            data-slot="sidebar-inset"
            className={cn(
                "relative flex min-w-0 flex-1 flex-col bg-background",
                className,
            )}
            {...props}
        />
    );
}

function SidebarTrigger({
    className,
    onClick,
    ...props
}: React.ComponentProps<"button">) {
    const { toggleSidebar } = useSidebar();

    return (
        <button
            type="button"
            data-slot="sidebar-trigger"
            data-sidebar="trigger"
            className={cn(
                "inline-flex size-8 items-center justify-center rounded-md text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40 disabled:pointer-events-none disabled:opacity-50",
                className,
            )}
            onClick={(event) => {
                onClick?.(event);
                if (!event.defaultPrevented) {
                    toggleSidebar();
                }
            }}
            {...props}
        >
            <PanelLeftIcon />
            <span className="sr-only">Toggle Sidebar</span>
        </button>
    );
}

function SidebarRail({ className, ...props }: React.ComponentProps<"button">) {
    const { toggleSidebar } = useSidebar();

    return (
        <button
            type="button"
            data-slot="sidebar-rail"
            data-sidebar="rail"
            aria-label="Toggle Sidebar"
            tabIndex={-1}
            className={cn(
                "absolute inset-y-0 hidden w-4 -translate-x-1/2 transition-colors hover:bg-sidebar-accent sm:flex",
                className,
            )}
            onClick={toggleSidebar}
            {...props}
        />
    );
}

function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="sidebar-header"
            data-sidebar="header"
            className={cn("flex flex-col gap-2 p-2", className)}
            {...props}
        />
    );
}

function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="sidebar-footer"
            data-sidebar="footer"
            className={cn("flex flex-col gap-2 p-2", className)}
            {...props}
        />
    );
}

function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="sidebar-content"
            data-sidebar="content"
            className={cn(
                "flex min-h-0 flex-1 flex-col gap-2 overflow-auto p-2",
                className,
            )}
            {...props}
        />
    );
}

function SidebarGroup({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="sidebar-group"
            data-sidebar="group"
            className={cn(
                "relative flex w-full min-w-0 flex-col gap-1",
                className,
            )}
            {...props}
        />
    );
}

function SidebarGroupLabel({
    className,
    asChild = false,
    ...props
}: React.ComponentProps<"div"> & { asChild?: boolean }) {
    const Comp = asChild ? SlotRoot : "div";

    return (
        <Comp
            data-slot="sidebar-group-label"
            data-sidebar="group-label"
            className={cn(
                "flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70 outline-none transition-[opacity,margin] duration-200 ease-linear focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]/sidebar-wrapper:opacity-0 [&>svg]:size-4 [&>svg]:shrink-0",
                className,
            )}
            {...props}
        />
    );
}

function SidebarGroupAction({
    className,
    asChild = false,
    ...props
}: React.ComponentProps<"button"> & { asChild?: boolean }) {
    const Comp = asChild ? SlotRoot : "button";

    return (
        <Comp
            type={asChild ? undefined : "button"}
            data-slot="sidebar-group-action"
            data-sidebar="group-action"
            className={cn(
                "absolute top-1.5 right-1.5 inline-flex size-7 items-center justify-center rounded-md text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring [&>svg]:size-4",
                className,
            )}
            {...props}
        />
    );
}

function SidebarGroupContent({
    className,
    ...props
}: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="sidebar-group-content"
            data-sidebar="group-content"
            className={cn("w-full text-sm", className)}
            {...props}
        />
    );
}

function SidebarInput({
    className,
    ...props
}: React.ComponentProps<typeof Input>) {
    return (
        <Input
            data-slot="sidebar-input"
            data-sidebar="input"
            className={cn(
                "h-8 w-full border-sidebar-border bg-background shadow-none",
                className,
            )}
            {...props}
        />
    );
}

function SidebarSeparator({
    className,
    ...props
}: React.ComponentProps<typeof Separator>) {
    return (
        <Separator
            data-slot="sidebar-separator"
            data-sidebar="separator"
            className={cn("mx-2 w-auto bg-sidebar-border", className)}
            {...props}
        />
    );
}

function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
    return (
        <ul
            data-slot="sidebar-menu"
            data-sidebar="menu"
            className={cn("flex w-full min-w-0 flex-col gap-1", className)}
            {...props}
        />
    );
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) {
    return (
        <li
            data-slot="sidebar-menu-item"
            data-sidebar="menu-item"
            className={cn("group/menu-item relative", className)}
            {...props}
        />
    );
}

function sidebarMenuButtonClassName({
    variant = "default",
    size = "default",
    className,
}: {
    variant?: "default" | "outline";
    size?: "default" | "sm" | "lg";
    className?: string;
}) {
    return cn(
        "peer/menu-button flex w-full min-w-0 items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
        variant === "outline" &&
            "border border-sidebar-border bg-background shadow-sm hover:border-sidebar-accent",
        size === "sm" && "h-7 text-xs",
        size === "default" && "h-8",
        size === "lg" && "h-12",
        className,
    );
}

function SidebarMenuButton({
    asChild = false,
    isActive = false,
    variant = "default",
    size = "default",
    className,
    ...props
}: React.ComponentProps<"button"> & {
    asChild?: boolean;
    isActive?: boolean;
    variant?: "default" | "outline";
    size?: "default" | "sm" | "lg";
}) {
    const Comp = asChild ? SlotRoot : "button";

    return (
        <Comp
            type={asChild ? undefined : "button"}
            data-slot="sidebar-menu-button"
            data-sidebar="menu-button"
            data-size={size}
            data-active={isActive}
            className={sidebarMenuButtonClassName({ variant, size, className })}
            {...props}
        />
    );
}

function SidebarMenuAction({
    className,
    asChild = false,
    showOnHover = false,
    ...props
}: React.ComponentProps<"button"> & {
    asChild?: boolean;
    showOnHover?: boolean;
}) {
    const Comp = asChild ? SlotRoot : "button";

    return (
        <Comp
            type={asChild ? undefined : "button"}
            data-slot="sidebar-menu-action"
            data-sidebar="menu-action"
            className={cn(
                "absolute top-1.5 right-1 inline-flex size-5 items-center justify-center rounded-md text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring [&>svg]:size-4",
                showOnHover &&
                    "opacity-0 group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100",
                className,
            )}
            {...props}
        />
    );
}

function SidebarMenuBadge({
    className,
    ...props
}: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="sidebar-menu-badge"
            data-sidebar="menu-badge"
            className={cn(
                "pointer-events-none absolute right-1 flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-xs font-medium tabular-nums text-sidebar-foreground select-none",
                className,
            )}
            {...props}
        />
    );
}

function SidebarMenuSkeleton({
    className,
    showIcon = false,
    ...props
}: React.ComponentProps<"div"> & { showIcon?: boolean }) {
    return (
        <div
            data-slot="sidebar-menu-skeleton"
            data-sidebar="menu-skeleton"
            className={cn(
                "flex h-8 items-center gap-2 rounded-md px-2",
                className,
            )}
            {...props}
        >
            {showIcon ? (
                <Skeleton
                    className="size-4 rounded-md"
                    data-sidebar="menu-skeleton-icon"
                />
            ) : null}
            <Skeleton
                className="h-4 max-w-[70%] flex-1"
                data-sidebar="menu-skeleton-text"
            />
        </div>
    );
}

function SidebarMenuSub({ className, ...props }: React.ComponentProps<"ul">) {
    return (
        <ul
            data-slot="sidebar-menu-sub"
            data-sidebar="menu-sub"
            className={cn(
                "mx-3.5 flex min-w-0 flex-col gap-1 border-l border-sidebar-border px-2.5 py-0.5",
                className,
            )}
            {...props}
        />
    );
}

function SidebarMenuSubItem({
    className,
    ...props
}: React.ComponentProps<"li">) {
    return (
        <li
            data-slot="sidebar-menu-sub-item"
            data-sidebar="menu-sub-item"
            className={cn("group/menu-sub-item relative", className)}
            {...props}
        />
    );
}

function SidebarMenuSubButton({
    asChild = false,
    size = "md",
    isActive = false,
    className,
    ...props
}: React.ComponentProps<"a"> & {
    asChild?: boolean;
    size?: "sm" | "md";
    isActive?: boolean;
}) {
    const Comp = asChild ? SlotRoot : "a";

    return (
        <Comp
            data-slot="sidebar-menu-sub-button"
            data-sidebar="menu-sub-button"
            data-size={size}
            data-active={isActive}
            className={cn(
                "flex h-7 min-w-0 items-center gap-2 overflow-hidden rounded-md px-2 text-sidebar-foreground outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
                size === "sm" && "text-xs",
                size === "md" && "text-sm",
                className,
            )}
            {...props}
        />
    );
}

export {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupAction,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarInput,
    SidebarInset,
    SidebarMenu,
    SidebarMenuAction,
    SidebarMenuBadge,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSkeleton,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
    SidebarProvider,
    SidebarRail,
    SidebarSeparator,
    SidebarTrigger,
    useSidebar,
};
