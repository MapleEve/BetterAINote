"use client";

import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react";
import type * as React from "react";

import { cn } from "@/lib/utils";

const dropdownMenuContentVariants = {
    default: "",
    glass: "w-[296px] max-w-[calc(100vw-24px)] rounded-[var(--radius-md)] border-border bg-popover p-1.5 font-sans text-popover-foreground shadow-md",
} as const;

const dropdownMenuItemDensities = {
    default: "",
    compact:
        "min-h-8 w-full gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-1.5 font-sans text-[13px] font-medium leading-none text-[var(--fg-primary)] transition-[background,color] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-[var(--bg-recessed)] hover:text-[var(--fg-primary)] focus:bg-[var(--bg-recessed)] focus:text-[var(--fg-primary)] focus-visible:bg-[var(--bg-recessed)] focus-visible:text-[var(--fg-primary)] focus-visible:shadow-[inset_0_0_0_2px_var(--accent)] data-[highlighted]:bg-[var(--bg-recessed)] data-[highlighted]:text-[var(--fg-primary)] active:bg-[var(--bg-recessed)] data-[disabled]:cursor-not-allowed data-[disabled]:bg-transparent data-[disabled]:text-[var(--fg-disabled)] data-[disabled]:opacity-100 data-[disabled]:[&_[data-slot=dropdown-menu-shortcut]]:text-[var(--fg-disabled)] data-[disabled]:[&_svg]:text-[var(--fg-disabled)] data-[variant=destructive]:text-[var(--signal-danger)] data-[variant=destructive]:hover:bg-[var(--alert-destructive-soft-bg)] data-[variant=destructive]:hover:text-[var(--signal-danger)] data-[variant=destructive]:focus:bg-[var(--alert-destructive-soft-bg)] data-[variant=destructive]:focus:text-[var(--signal-danger)] data-[variant=destructive]:data-[highlighted]:bg-[var(--alert-destructive-soft-bg)] data-[variant=destructive]:data-[highlighted]:text-[var(--signal-danger)] data-[variant=destructive]:[&_svg]:text-[var(--signal-danger)] [&_svg]:size-4 [&_svg]:fill-none [&_svg]:stroke-[1.8] [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round] [&_svg:not([class*='text-'])]:text-[var(--fg-tertiary)] hover:[&_svg]:text-[var(--fg-secondary)] data-[highlighted]:[&_svg]:text-[var(--fg-secondary)]",
} as const;

const dropdownMenuLabelDensities = {
    default: "",
    compact:
        "px-2.5 pb-1 pt-2 font-mono text-[10.5px] font-semibold uppercase leading-none tracking-[0.08em] text-[var(--fg-tertiary)]",
} as const;

const dropdownMenuSeparatorDensities = {
    default: "",
    compact: "mx-0.5 my-1 bg-[var(--line-hairline)]",
} as const;

const dropdownMenuShortcutVariants = {
    default: "",
    hint: "font-mono text-[11px] font-medium leading-none tracking-[0.02em] text-[var(--fg-tertiary)]",
} as const;

type DropdownMenuContentVariant = keyof typeof dropdownMenuContentVariants;
type DropdownMenuItemDensity = keyof typeof dropdownMenuItemDensities;
type DropdownMenuLabelDensity = keyof typeof dropdownMenuLabelDensities;
type DropdownMenuSeparatorDensity = keyof typeof dropdownMenuSeparatorDensities;
type DropdownMenuShortcutVariant = keyof typeof dropdownMenuShortcutVariants;

function DropdownMenu({
    ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
    return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

function DropdownMenuPortal({
    ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Portal>) {
    return (
        <DropdownMenuPrimitive.Portal
            data-slot="dropdown-menu-portal"
            {...props}
        />
    );
}

function DropdownMenuTrigger({
    ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
    return (
        <DropdownMenuPrimitive.Trigger
            data-slot="dropdown-menu-trigger"
            {...props}
        />
    );
}

function DropdownMenuContent({
    className,
    sideOffset = 4,
    variant = "default",
    ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content> & {
    variant?: DropdownMenuContentVariant;
}) {
    return (
        <DropdownMenuPrimitive.Portal>
            <DropdownMenuPrimitive.Content
                data-slot="dropdown-menu-content"
                sideOffset={sideOffset}
                className={cn(
                    "max-h-(--radix-dropdown-menu-content-available-height) min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
                    dropdownMenuContentVariants[variant],
                    className,
                )}
                {...props}
            />
        </DropdownMenuPrimitive.Portal>
    );
}

function DropdownMenuGroup({
    ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Group>) {
    return (
        <DropdownMenuPrimitive.Group
            data-slot="dropdown-menu-group"
            {...props}
        />
    );
}

function DropdownMenuItem({
    className,
    density = "default",
    inset,
    variant = "default",
    ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
    density?: DropdownMenuItemDensity;
    inset?: boolean;
    variant?: "default" | "destructive";
}) {
    return (
        <DropdownMenuPrimitive.Item
            data-slot="dropdown-menu-item"
            data-inset={inset}
            data-variant={variant}
            className={cn(
                "relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground data-[variant=destructive]:*:[svg]:text-destructive!",
                dropdownMenuItemDensities[density],
                className,
            )}
            {...props}
        />
    );
}

function DropdownMenuCheckboxItem({
    className,
    children,
    checked,
    ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
    return (
        <DropdownMenuPrimitive.CheckboxItem
            data-slot="dropdown-menu-checkbox-item"
            className={cn(
                "relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
                className,
            )}
            checked={checked}
            {...props}
        >
            <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
                <DropdownMenuPrimitive.ItemIndicator>
                    <CheckIcon className="size-4" />
                </DropdownMenuPrimitive.ItemIndicator>
            </span>
            {children}
        </DropdownMenuPrimitive.CheckboxItem>
    );
}

function DropdownMenuRadioGroup({
    ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>) {
    return (
        <DropdownMenuPrimitive.RadioGroup
            data-slot="dropdown-menu-radio-group"
            {...props}
        />
    );
}

function DropdownMenuRadioItem({
    className,
    children,
    ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
    return (
        <DropdownMenuPrimitive.RadioItem
            data-slot="dropdown-menu-radio-item"
            className={cn(
                "relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
                className,
            )}
            {...props}
        >
            <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
                <DropdownMenuPrimitive.ItemIndicator>
                    <CircleIcon className="size-2 fill-current" />
                </DropdownMenuPrimitive.ItemIndicator>
            </span>
            {children}
        </DropdownMenuPrimitive.RadioItem>
    );
}

function DropdownMenuLabel({
    className,
    density = "default",
    inset,
    ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label> & {
    density?: DropdownMenuLabelDensity;
    inset?: boolean;
}) {
    return (
        <DropdownMenuPrimitive.Label
            data-slot="dropdown-menu-label"
            data-inset={inset}
            className={cn(
                "px-2 py-1.5 text-sm font-medium data-[inset]:pl-8",
                dropdownMenuLabelDensities[density],
                className,
            )}
            {...props}
        />
    );
}

function DropdownMenuSeparator({
    className,
    ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator> & {
    density?: DropdownMenuSeparatorDensity;
}) {
    const { density = "default", ...separatorProps } = props;

    return (
        <DropdownMenuPrimitive.Separator
            data-slot="dropdown-menu-separator"
            className={cn(
                "-mx-1 my-1 h-px bg-border",
                dropdownMenuSeparatorDensities[density],
                className,
            )}
            {...separatorProps}
        />
    );
}

function DropdownMenuShortcut({
    className,
    variant = "default",
    ...props
}: React.ComponentProps<"span"> & {
    variant?: DropdownMenuShortcutVariant;
}) {
    return (
        <span
            data-slot="dropdown-menu-shortcut"
            className={cn(
                "ml-auto text-xs tracking-widest text-muted-foreground",
                dropdownMenuShortcutVariants[variant],
                className,
            )}
            {...props}
        />
    );
}

function DropdownMenuSub({
    ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Sub>) {
    return (
        <DropdownMenuPrimitive.Sub data-slot="dropdown-menu-sub" {...props} />
    );
}

function DropdownMenuSubTrigger({
    className,
    inset,
    children,
    ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & {
    inset?: boolean;
}) {
    return (
        <DropdownMenuPrimitive.SubTrigger
            data-slot="dropdown-menu-sub-trigger"
            data-inset={inset}
            className={cn(
                "flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[inset]:pl-8 data-[state=open]:bg-accent data-[state=open]:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground",
                className,
            )}
            {...props}
        >
            {children}
            <ChevronRightIcon className="ml-auto size-4" />
        </DropdownMenuPrimitive.SubTrigger>
    );
}

function DropdownMenuSubContent({
    className,
    ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubContent>) {
    return (
        <DropdownMenuPrimitive.SubContent
            data-slot="dropdown-menu-sub-content"
            className={cn(
                "min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
                className,
            )}
            {...props}
        />
    );
}

export {
    DropdownMenu,
    DropdownMenuPortal,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuLabel,
    DropdownMenuItem,
    DropdownMenuCheckboxItem,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuSub,
    DropdownMenuSubTrigger,
    DropdownMenuSubContent,
};
