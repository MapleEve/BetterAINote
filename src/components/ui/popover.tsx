"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import type * as React from "react";

import { cn } from "@/lib/utils";

type PopoverContentVariant = "default";

const POPOVER_CONTENT_CLASS =
    "z-50 origin-(--radix-popover-content-transform-origin) rounded-md border bg-popover text-popover-foreground shadow-md outline-none data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95";
const POPOVER_CONTENT_VARIANT_CLASS: Record<PopoverContentVariant, string> = {
    default: "w-72 p-4",
};

function Popover({
    ...props
}: React.ComponentProps<typeof PopoverPrimitive.Root>) {
    return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({
    ...props
}: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
    return (
        <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
    );
}

function PopoverAnchor({
    ...props
}: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
    return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />;
}

function PopoverPortal({
    ...props
}: React.ComponentProps<typeof PopoverPrimitive.Portal>) {
    return <PopoverPrimitive.Portal data-slot="popover-portal" {...props} />;
}

function PopoverClose({
    ...props
}: React.ComponentProps<typeof PopoverPrimitive.Close>) {
    return <PopoverPrimitive.Close data-slot="popover-close" {...props} />;
}

function PopoverContent({
    className,
    align = "center",
    sideOffset = 4,
    variant = "default",
    ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content> & {
    variant?: PopoverContentVariant;
}) {
    return (
        <PopoverPortal>
            <PopoverPrimitive.Content
                data-slot="popover-content"
                data-variant={variant}
                align={align}
                sideOffset={sideOffset}
                className={cn(
                    POPOVER_CONTENT_CLASS,
                    POPOVER_CONTENT_VARIANT_CLASS[variant],
                    className,
                )}
                {...props}
            />
        </PopoverPortal>
    );
}

function PopoverArrow({
    className,
    ...props
}: React.ComponentProps<typeof PopoverPrimitive.Arrow>) {
    return (
        <PopoverPrimitive.Arrow
            data-slot="popover-arrow"
            className={cn("fill-popover stroke-border", className)}
            {...props}
        />
    );
}

export {
    Popover,
    PopoverAnchor,
    PopoverArrow,
    PopoverClose,
    PopoverContent,
    PopoverPortal,
    PopoverTrigger,
};
