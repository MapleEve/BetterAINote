import type * as React from "react";

import { cn } from "@/lib/utils";

const cardVariants = {
    default: "",
} as const;

const cardHeaderVariants = {
    default:
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
} as const;

const cardTitleVariants = {
    default: "leading-none font-semibold",
} as const;

const cardContentVariants = {
    default: "px-6",
} as const;

const cardFooterVariants = {
    default: "px-6 [.border-t]:pt-6",
} as const;

const cardDescriptionVariants = {
    default: "text-sm text-muted-foreground",
} as const;

const cardActionVariants = {
    default: "",
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
                "shadow-sm backdrop-blur-xl",
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
            data-variant={variant}
            className={cn(cardHeaderVariants[variant], className)}
            {...props}
        />
    );
}

function CardTitle({
    className,
    variant = "default",
    ...props
}: React.ComponentProps<"div"> & {
    variant?: keyof typeof cardTitleVariants;
}) {
    return (
        <div
            data-slot="card-title"
            data-variant={variant}
            className={cn(cardTitleVariants[variant], className)}
            {...props}
        />
    );
}

function CardDescription({
    className,
    variant = "default",
    ...props
}: React.ComponentProps<"div"> & {
    variant?: keyof typeof cardDescriptionVariants;
}) {
    return (
        <div
            data-slot="card-description"
            data-variant={variant}
            className={cn(cardDescriptionVariants[variant], className)}
            {...props}
        />
    );
}

function CardAction({
    className,
    variant = "default",
    ...props
}: React.ComponentProps<"div"> & {
    variant?: keyof typeof cardActionVariants;
}) {
    return (
        <div
            data-slot="card-action"
            data-variant={variant}
            className={cn(
                "col-start-2 row-span-2 row-start-1 flex items-center self-start justify-self-end leading-none",
                cardActionVariants[variant],
                className,
            )}
            {...props}
        />
    );
}

function CardContent({
    className,
    variant = "default",
    ...props
}: React.ComponentProps<"div"> & {
    variant?: keyof typeof cardContentVariants;
}) {
    return (
        <div
            data-slot="card-content"
            data-variant={variant}
            className={cn(cardContentVariants[variant], className)}
            {...props}
        />
    );
}

function CardFooter({
    className,
    variant = "default",
    ...props
}: React.ComponentProps<"div"> & {
    variant?: keyof typeof cardFooterVariants;
}) {
    return (
        <div
            data-slot="card-footer"
            data-variant={variant}
            className={cn(
                "flex items-center",
                cardFooterVariants[variant],
                className,
            )}
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
