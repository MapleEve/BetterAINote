import type * as React from "react";

import { cn } from "@/lib/utils";

const cardVariants = {
    default: "",
    elevated:
        "rounded-[var(--radius-md)] border-[var(--card-elevated-border)] bg-[var(--card-elevated-bg)]",
    popover:
        "overflow-visible rounded-[12px] border-[var(--card-popover-border)] bg-[var(--card-popover-bg)] shadow-[var(--card-popover-shadow)] backdrop-blur-none",
} as const;

const cardHeaderVariants = {
    default: "",
    popover:
        "border-b-[1px] border-[var(--card-popover-divider)] px-[12px] pb-[9px] pt-[11px]",
} as const;

function Card({
    className,
    hasNoPadding = false,
    variant = "default",
    ...props
}: React.ComponentProps<"div"> & {
    hasNoPadding?: boolean;
    variant?: keyof typeof cardVariants;
}) {
    return (
        <div
            data-slot="card"
            data-variant={variant}
            className={cn(
                "flex flex-col gap-6 overflow-hidden rounded-xl border border-border bg-card text-card-foreground",
                variant !== "popover" && "shadow-sm backdrop-blur-xl",
                cardVariants[variant],
                !hasNoPadding && "py-6",
                className,
            )}
            {...props}
        />
    );
}

function CardHeader({
    className,
    variant = "default",
    ...props
}: React.ComponentProps<"div"> & {
    variant?: keyof typeof cardHeaderVariants;
}) {
    return (
        <div
            data-slot="card-header"
            className={cn(
                "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
                cardHeaderVariants[variant],
                className,
            )}
            {...props}
        />
    );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="card-title"
            className={cn("leading-none font-semibold", className)}
            {...props}
        />
    );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="card-description"
            className={cn("text-sm text-muted-foreground", className)}
            {...props}
        />
    );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="card-action"
            className={cn(
                "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
                className,
            )}
            {...props}
        />
    );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="card-content"
            className={cn("px-6", className)}
            {...props}
        />
    );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="card-footer"
            className={cn("flex items-center px-6 [.border-t]:pt-6", className)}
            {...props}
        />
    );
}

export {
    Card,
    CardHeader,
    CardFooter,
    CardTitle,
    CardAction,
    CardDescription,
    CardContent,
};
