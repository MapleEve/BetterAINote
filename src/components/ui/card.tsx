import type * as React from "react";

import { cn } from "@/lib/utils";

const cardVariants = {
    default: "",
    elevated:
        "rounded-[var(--radius-md)] border-[var(--card-elevated-border)] bg-[var(--card-elevated-bg)]",
    popover:
        "overflow-hidden rounded-[12px] border-[var(--card-popover-border)] bg-[var(--card-popover-bg)] shadow-[var(--card-popover-shadow)] backdrop-blur-none",
    sourceReportMetric:
        "gap-[6px] overflow-visible rounded-[10px] border-[var(--source-report-metric-border)] bg-[var(--source-report-metric-bg)] px-[12px] py-[10px] shadow-none backdrop-blur-none",
} as const;

const cardHeaderVariants = {
    default:
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
    detailHeader:
        "relative flex flex-row items-center gap-2.5 px-1 pt-1 pb-0 data-[sot-state=saving]:py-0",
    popover:
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start border-b-[1px] border-[var(--card-popover-divider)] px-[12px] pb-[9px] pt-[11px] has-data-[slot=card-action]:grid-cols-[1fr_auto]",
    popoverCompact:
        "flex flex-row items-center justify-between border-b-[1px] border-[var(--card-popover-divider)] px-[12px] pt-[10px] pb-[10px] [&>[data-slot=card-action]]:self-center",
} as const;

const cardTitleVariants = {
    default: "leading-none font-semibold",
    detailHeaderTitle: "leading-none font-semibold min-w-0 flex-1 truncate",
    popoverCompact:
        "text-[12.5px] font-semibold leading-[17px] text-[var(--fg-primary)]",
} as const;

const cardContentVariants = {
    default: "px-6",
    popoverCompact: "px-[14px] pb-[14px] pt-[12px]",
    popoverCreate: "px-[14px] pb-[14px] pt-[12px]",
    popoverDefault: "min-h-[234px] px-[14px] pb-[14px] pt-[12px]",
    popoverDelete: "px-[14px] pb-[14px] pt-[12px]",
    popoverEmpty: "px-[14px] pb-[14px] pt-[12px]",
    popoverSaving: "min-h-[52px] px-[14px] pb-[14px] pt-[12px]",
    popoverTight: "px-[14px] pb-[14px] pt-[12px]",
} as const;

const cardFooterVariants = {
    default: "px-6 [.border-t]:pt-6",
    popoverCompact:
        "min-h-[49px] gap-[6px] border-t border-[var(--card-popover-divider)] bg-[var(--card-popover-footer-bg)] px-[14px] py-[10px]",
} as const;

const cardDescriptionVariants = {
    default: "text-sm text-muted-foreground",
    popoverNote:
        "max-h-[31px] overflow-hidden px-[14px] pt-[15px] pb-0 text-[11px] leading-[1.45] font-normal text-[var(--card-popover-note-fg)]",
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
            data-variant={variant}
            className={cn(
                cardHeaderVariants[variant],
                className,
            )}
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

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="card-action"
            className={cn(
                "col-start-2 row-span-2 row-start-1 flex items-center self-start justify-self-end leading-none",
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
