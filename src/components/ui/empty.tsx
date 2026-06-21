import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const emptyVariants = cva(
    "flex min-w-0 flex-1 flex-col items-center justify-center gap-6 rounded-lg border-dashed p-6 text-center text-balance md:p-12",
    {
        variants: {
            variant: {
                default: "",
                compact:
                    "flex-none gap-0 rounded-none px-[16px] pb-[20.5px] pt-[22px] md:px-[16px] md:pb-[20.5px] md:pt-[22px]",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    },
);

function Empty({
    className,
    variant = "default",
    ...props
}: React.ComponentProps<"div"> & VariantProps<typeof emptyVariants>) {
    return (
        <div
            data-slot="empty"
            className={cn(emptyVariants({ variant, className }))}
            {...props}
        />
    );
}

function EmptyHeader({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="empty-header"
            className={cn(
                "flex max-w-sm flex-col items-center gap-2 text-center",
                className,
            )}
            {...props}
        />
    );
}

const emptyMediaVariants = cva(
    "mb-2 flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0",
    {
        variants: {
            variant: {
                default: "bg-transparent",
                icon: "flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground [&_svg:not([class*='size-'])]:size-6",
                subtleIcon:
                    "mb-[6px] flex size-[32px] shrink-0 items-center justify-center rounded-full border border-[var(--line-hairline)] bg-[var(--bg-recessed)] text-muted-foreground [&_svg:not([class*='size-'])]:size-[14px]",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    },
);

const emptyTitleVariants = cva("", {
    variants: {
        variant: {
            default: "text-lg font-medium tracking-tight",
            compact:
                "mb-[1px] text-[12px] leading-normal font-semibold tracking-normal",
        },
    },
    defaultVariants: {
        variant: "default",
    },
});

const emptyDescriptionVariants = cva("", {
    variants: {
        variant: {
            default:
                "m-0 text-sm/relaxed text-muted-foreground [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary",
            compact:
                "m-0 text-[11.5px] leading-normal font-medium text-muted-foreground [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary",
        },
    },
    defaultVariants: {
        variant: "default",
    },
});

function EmptyMedia({
    className,
    variant = "default",
    ...props
}: React.ComponentProps<"div"> & VariantProps<typeof emptyMediaVariants>) {
    return (
        <div
            data-slot="empty-icon"
            data-variant={variant}
            className={cn(emptyMediaVariants({ variant, className }))}
            {...props}
        />
    );
}

function EmptyTitle({
    className,
    variant = "default",
    ...props
}: React.ComponentProps<"div"> & VariantProps<typeof emptyTitleVariants>) {
    return (
        <div
            data-slot="empty-title"
            className={cn(emptyTitleVariants({ variant, className }))}
            {...props}
        />
    );
}

function EmptyDescription({
    className,
    variant = "default",
    ...props
}: React.ComponentProps<"p"> &
    VariantProps<typeof emptyDescriptionVariants>) {
    return (
        <div
            data-slot="empty-description"
            className={cn(emptyDescriptionVariants({ variant, className }))}
            {...props}
        />
    );
}

function EmptyContent({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="empty-content"
            className={cn(
                "flex w-full max-w-sm min-w-0 flex-col items-center gap-4 text-sm text-balance",
                className,
            )}
            {...props}
        />
    );
}

export {
    Empty,
    EmptyHeader,
    EmptyTitle,
    EmptyDescription,
    EmptyContent,
    EmptyMedia,
};
