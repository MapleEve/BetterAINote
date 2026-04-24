"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const SidebarContext = React.createContext<{
    open?: boolean;
}>({});

function SidebarProvider({
    children,
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <SidebarContext.Provider value={{ open: true }}>
            <div
                className={cn(
                    "flex h-full min-h-0 w-full overflow-hidden",
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
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn(
                "glass-surface flex h-full min-h-0 w-64 flex-col rounded-none border-r border-white/8 bg-transparent",
                className,
            )}
            {...props}
        />
    );
}

function SidebarContent({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn(
                "flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain p-4",
                className,
            )}
            {...props}
        />
    );
}

function SidebarGroup({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={cn("space-y-1", className)} {...props} />;
}

function SidebarGroupContent({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={cn("space-y-1", className)} {...props} />;
}

function SidebarMenu({
    className,
    ...props
}: React.HTMLAttributes<HTMLUListElement>) {
    return <ul className={cn("space-y-1", className)} {...props} />;
}

function SidebarMenuItem({
    className,
    ...props
}: React.HTMLAttributes<HTMLLIElement>) {
    return <li className={cn("", className)} {...props} />;
}

function SidebarMenuButton({
    className,
    isActive,
    asChild = false,
    children,
    ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    isActive?: boolean;
    asChild?: boolean;
}) {
    const Comp = asChild ? React.Fragment : "button";
    const buttonProps = asChild ? {} : props;

    return (
        <Comp
            className={cn(
                "glass-nav-item flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                    ? "text-accent-foreground"
                    : "hover:text-accent-foreground",
                className,
            )}
            data-active={isActive ? "true" : "false"}
            {...buttonProps}
        >
            {children}
        </Comp>
    );
}

export {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
    SidebarProvider,
};
