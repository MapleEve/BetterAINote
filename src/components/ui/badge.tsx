import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
    "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3",
    {
        variants: {
            variant: {
                default:
                    "bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
                secondary:
                    "bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
                destructive:
                    "bg-destructive text-destructive-foreground [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
                outline:
                    "border-border text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
                ghost: "[a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
                pill: "h-[var(--badge-pill-height)] justify-normal gap-[5px] rounded-[999px] border-[var(--line-hairline)] bg-[var(--bg-recessed)] py-0 pl-[8px] pr-[4px] text-[11px] font-semibold text-[var(--fg-primary)] [&>svg]:size-[11px] [&>svg]:stroke-2",
                checkDot:
                    "ml-0.5 inline-grid size-[14px] place-items-center rounded-[50%] border-0 bg-[var(--badge-check-bg)] p-0 text-[11.5px] font-semibold leading-none text-[var(--accent-on)] [&>svg]:size-[9px] [&>svg]:stroke-[3] [&>svg]:[stroke-linecap:butt] [&>svg]:[stroke-linejoin:miter]",
                sourceProviderStatus:
                    "h-[18px] gap-[4px] rounded-[999px] border border-solid px-[7px] py-0 text-[10.5px] font-semibold leading-[normal] data-[sot-tone=ok]:border-[var(--source-provider-status-success-border)] data-[sot-tone=ok]:bg-[var(--source-provider-status-success-bg)] data-[sot-tone=ok]:text-[var(--signal-success)] data-[sot-tone=info]:border-[var(--source-provider-status-info-border)] data-[sot-tone=info]:bg-[var(--source-provider-status-info-bg)] data-[sot-tone=info]:text-[var(--signal-info)] data-[sot-tone=syncing]:border-[var(--source-provider-status-info-border)] data-[sot-tone=syncing]:bg-[var(--source-provider-status-info-bg)] data-[sot-tone=syncing]:text-[var(--signal-info)] data-[sot-tone=warn]:border-[var(--source-provider-status-warning-border)] data-[sot-tone=warn]:bg-[var(--source-provider-status-warning-bg)] data-[sot-tone=warn]:text-[var(--signal-warning-strong)] data-[sot-tone=err]:border-[var(--source-provider-status-danger-border)] data-[sot-tone=err]:bg-[var(--source-provider-status-danger-bg)] data-[sot-tone=err]:text-[var(--signal-danger)] data-[sot-tone=neu]:border-[var(--line-hairline)] data-[sot-tone=neu]:bg-[var(--bg-recessed)] data-[sot-tone=neu]:text-[var(--fg-secondary)] group-data-[sot-dimmed=true]/source-provider:border-[var(--line-hairline)] group-data-[sot-dimmed=true]/source-provider:bg-[var(--bg-recessed)] group-data-[sot-dimmed=true]/source-provider:text-[var(--fg-tertiary)]",
                sourceProviderDetailStatus:
                    "h-6 gap-1.5 rounded-[999px] border border-solid px-2.5 py-0 text-[11px] font-semibold leading-[normal] data-[sot-tone=ok]:border-[var(--source-provider-status-success-border)] data-[sot-tone=ok]:bg-[var(--source-provider-status-success-bg)] data-[sot-tone=ok]:text-[var(--signal-success)] data-[sot-tone=info]:border-[var(--source-provider-status-info-border)] data-[sot-tone=info]:bg-[var(--source-provider-status-info-bg)] data-[sot-tone=info]:text-[var(--signal-info)] data-[sot-tone=syncing]:border-[var(--source-provider-status-info-border)] data-[sot-tone=syncing]:bg-[var(--source-provider-status-info-bg)] data-[sot-tone=syncing]:text-[var(--signal-info)] data-[sot-tone=warn]:border-[var(--source-provider-status-warning-border)] data-[sot-tone=warn]:bg-[var(--source-provider-status-warning-bg)] data-[sot-tone=warn]:text-[var(--signal-warning-strong)] data-[sot-tone=err]:border-[var(--source-provider-status-danger-border)] data-[sot-tone=err]:bg-[var(--source-provider-status-danger-bg)] data-[sot-tone=err]:text-[var(--signal-danger)] data-[sot-tone=neu]:border-[var(--line-hairline)] data-[sot-tone=neu]:bg-[var(--bg-recessed)] data-[sot-tone=neu]:text-[var(--fg-secondary)]",
                sourceReportStatus:
                    "h-[22px] min-w-[65px] justify-normal gap-[5px] overflow-visible rounded-full border px-[8px] py-0 text-[11px] font-semibold shadow-none data-[sot-tone=err]:border-[var(--source-report-status-err-border)] data-[sot-tone=err]:bg-[var(--source-report-status-err-bg)] data-[sot-tone=err]:text-[var(--signal-danger)] data-[sot-tone=neu]:border-[var(--line-hairline)] data-[sot-tone=neu]:bg-[var(--bg-recessed)] data-[sot-tone=neu]:text-[var(--fg-secondary)] data-[sot-tone=ok]:border-[var(--source-report-status-ok-border)] data-[sot-tone=ok]:bg-[var(--source-report-status-ok-bg)] data-[sot-tone=ok]:text-[var(--source-report-status-ok-fg)] data-[sot-tone=warn]:border-[var(--source-report-status-warn-border)] data-[sot-tone=warn]:bg-[var(--source-report-status-warn-bg)] data-[sot-tone=warn]:text-[var(--source-report-status-warn-fg)]",
                link: "text-primary underline-offset-4 [a&]:hover:underline",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    },
);

function Badge({
    className,
    variant = "default",
    asChild = false,
    ...props
}: React.ComponentProps<"span"> &
    VariantProps<typeof badgeVariants> & {
        asChild?: boolean;
    }) {
    const Comp = asChild ? Slot : "span";

    return (
        <Comp
            data-slot="badge"
            data-variant={variant}
            className={cn(badgeVariants({ variant }), className)}
            {...props}
        />
    );
}

export { Badge, badgeVariants };
