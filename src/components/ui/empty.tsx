import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const emptyVariants = cva(
    "min-w-0 rounded-lg border-dashed text-center text-balance",
    {
        variants: {
            variant: {
                default:
                    "flex flex-1 flex-col items-center justify-center gap-6 p-6 md:p-12",
                compact:
                    "flex flex-none flex-col items-center justify-center gap-0 rounded-none px-4 pb-5 pt-5 md:px-4 md:pb-5 md:pt-5",
                popover:
                    "rounded-none px-2.5 pb-1 pt-3.5 md:px-2.5 md:pb-1 md:pt-3.5",
                subtle: "flex flex-none flex-col items-center justify-center gap-1 rounded-lg border bg-muted/40 px-5 py-7 shadow-none",
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

const emptyHeaderVariants = cva("", {
    variants: {
        variant: {
            default: "flex max-w-sm flex-col items-center gap-2 text-center",
            popover: "flex max-w-none flex-col items-center gap-0 text-center",
        },
    },
    defaultVariants: {
        variant: "default",
    },
});

function EmptyHeader({
    className,
    variant = "default",
    ...props
}: React.ComponentProps<"div"> & VariantProps<typeof emptyHeaderVariants>) {
    return (
        <div
            data-slot="empty-header"
            data-variant={variant}
            className={cn(emptyHeaderVariants({ variant, className }))}
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
                icon: "flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground [&_svg]:size-6",
                dangerIcon:
                    "mb-1.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-destructive/30 bg-destructive/10 text-destructive",
                subtleIcon:
                    "mb-1.5 flex size-8 shrink-0 items-center justify-center rounded-full border bg-muted text-muted-foreground",
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
            popover:
                "m-0 mb-1 text-[13px] leading-[1.35] font-semibold tracking-normal text-foreground",
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
            popover:
                "m-0 text-xs leading-6 font-medium text-muted-foreground [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary",
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
}: React.ComponentProps<"div"> &
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
