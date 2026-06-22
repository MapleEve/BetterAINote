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
                detailHeaderLocal:
                    "ml-1 shrink-0 border-border text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
                detailHeaderStatus:
                    "ml-1 shrink-0 [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
                pill: "h-[var(--badge-pill-height)] justify-normal gap-[5px] rounded-[999px] border-[var(--line-hairline)] bg-[var(--bg-recessed)] py-0 pl-[8px] pr-[4px] text-[11px] font-semibold text-[var(--fg-primary)] [&>svg]:size-[11px] [&>svg]:stroke-2",
                checkDot:
                    "ml-0.5 inline-grid size-[14px] place-items-center rounded-[50%] border-0 bg-[var(--badge-check-bg)] p-0 text-[11.5px] font-semibold leading-none text-[var(--accent-on)] [&>svg]:size-[9px] [&>svg]:stroke-[3] [&>svg]:[stroke-linecap:butt] [&>svg]:[stroke-linejoin:miter]",
                librarySearchTag:
                    "w-fit justify-normal gap-1.5 border-primary/25 bg-primary/10 text-primary [a&]:hover:bg-primary/10 [&>svg]:size-3",
                recordingTagChip:
                    "h-[22px] w-fit justify-normal gap-[5px] rounded-[6px] border-[var(--dashboard-recording-tag-chip-border)] bg-[var(--dashboard-recording-tag-chip-bg)] py-0 pl-[7px] pr-[9px] [--tag-c:var(--graphite-500)] [font:600_11.5px_var(--font-sans)] text-[var(--dashboard-recording-tag-chip-fg)] shadow-[var(--shadow-xs)] transition-none data-[sot-tag-color=blue]:[--tag-c:var(--tag-blue)] data-[sot-tag-color=green]:[--tag-c:var(--tag-green)] data-[sot-tag-color=orange]:[--tag-c:var(--tag-amber)] data-[sot-tag-color=purple]:[--tag-c:var(--tag-violet)] data-[sot-tag-color=red]:[--tag-c:var(--tag-rose)] data-[sot-tag-color=slate]:[--tag-c:var(--tag-slate)] [&>svg]:size-[11px] [&>svg]:fill-none [&>svg]:stroke-2",
                dashboardActivityCount:
                    "justify-normal border-0 bg-transparent p-0 font-mono text-[11px] font-medium text-[var(--fg-tertiary)] [a&]:hover:bg-transparent",
                sourceProviderStatus:
                    "h-[18px] gap-[4px] rounded-[999px] border border-solid px-[7px] py-0 text-[10.5px] font-semibold leading-[normal] data-[sot-tone=ok]:border-[var(--source-provider-status-success-border)] data-[sot-tone=ok]:bg-[var(--source-provider-status-success-bg)] data-[sot-tone=ok]:text-[var(--signal-success)] data-[sot-tone=info]:border-[var(--source-provider-status-info-border)] data-[sot-tone=info]:bg-[var(--source-provider-status-info-bg)] data-[sot-tone=info]:text-[var(--signal-info)] data-[sot-tone=syncing]:border-[var(--source-provider-status-info-border)] data-[sot-tone=syncing]:bg-[var(--source-provider-status-info-bg)] data-[sot-tone=syncing]:text-[var(--signal-info)] data-[sot-tone=warn]:border-[var(--source-provider-status-warning-border)] data-[sot-tone=warn]:bg-[var(--source-provider-status-warning-bg)] data-[sot-tone=warn]:text-[var(--signal-warning-strong)] data-[sot-tone=err]:border-[var(--source-provider-status-danger-border)] data-[sot-tone=err]:bg-[var(--source-provider-status-danger-bg)] data-[sot-tone=err]:text-[var(--signal-danger)] data-[sot-tone=neu]:border-[var(--line-hairline)] data-[sot-tone=neu]:bg-[var(--bg-recessed)] data-[sot-tone=neu]:text-[var(--fg-secondary)] group-data-[sot-dimmed=true]/source-provider:border-[var(--line-hairline)] group-data-[sot-dimmed=true]/source-provider:bg-[var(--bg-recessed)] group-data-[sot-dimmed=true]/source-provider:text-[var(--fg-tertiary)]",
                sourceProviderDetailStatus:
                    "h-6 gap-1.5 rounded-[999px] border border-solid px-2.5 py-0 text-[11px] font-semibold leading-[normal] data-[sot-tone=ok]:border-[var(--source-provider-status-success-border)] data-[sot-tone=ok]:bg-[var(--source-provider-status-success-bg)] data-[sot-tone=ok]:text-[var(--signal-success)] data-[sot-tone=info]:border-[var(--source-provider-status-info-border)] data-[sot-tone=info]:bg-[var(--source-provider-status-info-bg)] data-[sot-tone=info]:text-[var(--signal-info)] data-[sot-tone=syncing]:border-[var(--source-provider-status-info-border)] data-[sot-tone=syncing]:bg-[var(--source-provider-status-info-bg)] data-[sot-tone=syncing]:text-[var(--signal-info)] data-[sot-tone=warn]:border-[var(--source-provider-status-warning-border)] data-[sot-tone=warn]:bg-[var(--source-provider-status-warning-bg)] data-[sot-tone=warn]:text-[var(--signal-warning-strong)] data-[sot-tone=err]:border-[var(--source-provider-status-danger-border)] data-[sot-tone=err]:bg-[var(--source-provider-status-danger-bg)] data-[sot-tone=err]:text-[var(--signal-danger)] data-[sot-tone=neu]:border-[var(--line-hairline)] data-[sot-tone=neu]:bg-[var(--bg-recessed)] data-[sot-tone=neu]:text-[var(--fg-secondary)]",
                playerSource:
                    "h-[22px] justify-normal gap-[6px] rounded-[6px] border-[var(--line-hairline)] bg-[var(--bg-elevated)] py-0 pl-[3px] pr-[8px] [font:600_11.5px_var(--font-sans)] text-[var(--fg-secondary)] shadow-[var(--shadow-xs)] dark:border-[var(--glass-border)] dark:bg-[rgb(255_255_255_/_0.04)] dark:text-[var(--fg-primary)]",
                playerStatus:
                    "h-[20px] min-w-[65.171875px] justify-normal gap-[5px] overflow-visible rounded-full border px-[8px] py-0 [font:600_11px_var(--font-sans)] tracking-[0.005em] shadow-none",
                playerTagChip:
                    "h-[22px] w-fit justify-normal gap-[5px] rounded-[6px] border-[var(--line-hairline)] bg-[var(--bg-elevated)] py-0 pl-[7px] pr-[9px] [font:600_11.5px_var(--font-sans)] text-[var(--fg-primary)] shadow-[var(--shadow-xs)] data-[sot-state=open]:border-[var(--line-strong)] data-[sot-state=open]:bg-[var(--bg-recessed)] data-[sot-tag-color=blue]:[--tag-c:var(--tag-blue)] data-[sot-tag-color=green]:[--tag-c:var(--tag-green)] data-[sot-tag-color=orange]:[--tag-c:var(--tag-amber)] data-[sot-tag-color=purple]:[--tag-c:var(--tag-violet)] data-[sot-tag-color=red]:[--tag-c:var(--tag-rose)] data-[sot-tag-color=slate]:[--tag-c:var(--tag-slate)] [--tag-c:var(--graphite-500)] [&>svg]:size-[11px] [&>svg]:stroke-2",
                playerTagOverflow:
                    "h-[22px] justify-normal gap-[4px] rounded-[6px] border-dashed border-[var(--line-hairline)] bg-[var(--bg-recessed)] px-[8px] py-0 text-[11px] font-semibold text-[var(--fg-tertiary)] shadow-none [a&]:hover:border-[var(--line-strong)] [a&]:hover:bg-transparent [a&]:hover:text-[var(--fg-primary)]",
                sourceReportStatus:
                    "h-[22px] min-w-[65px] justify-normal gap-[5px] overflow-visible rounded-full border px-[8px] py-0 text-[11px] font-semibold shadow-none data-[sot-tone=err]:border-[var(--source-report-status-err-border)] data-[sot-tone=err]:bg-[var(--source-report-status-err-bg)] data-[sot-tone=err]:text-[var(--signal-danger)] data-[sot-tone=neu]:border-[var(--line-hairline)] data-[sot-tone=neu]:bg-[var(--bg-recessed)] data-[sot-tone=neu]:text-[var(--fg-secondary)] data-[sot-tone=ok]:border-[var(--source-report-status-ok-border)] data-[sot-tone=ok]:bg-[var(--source-report-status-ok-bg)] data-[sot-tone=ok]:text-[var(--source-report-status-ok-fg)] data-[sot-tone=warn]:border-[var(--source-report-status-warn-border)] data-[sot-tone=warn]:bg-[var(--source-report-status-warn-bg)] data-[sot-tone=warn]:text-[var(--source-report-status-warn-fg)]",
                speakerReviewVoiceprint:
                    "h-[22px] justify-normal gap-[5px] overflow-visible rounded-full border px-[8px] py-0 text-[11px] font-semibold shadow-none data-[sot-tone=missing]:border-[var(--source-provider-status-warning-border)] data-[sot-tone=missing]:bg-[var(--source-provider-status-warning-bg)] data-[sot-tone=missing]:text-[var(--signal-warning-strong)] data-[sot-tone=ready]:border-[var(--source-provider-status-success-border)] data-[sot-tone=ready]:bg-[var(--source-provider-status-success-bg)] data-[sot-tone=ready]:text-[var(--signal-success)] data-[sot-tone=selected]:border-primary/30 data-[sot-tone=selected]:bg-primary/10 data-[sot-tone=selected]:text-primary [&>svg]:size-[11px] [&>svg]:stroke-2",
                aiRenamePreviewOldTag:
                    "min-w-[56px] justify-start border-border text-foreground uppercase tracking-[0.04em] [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
                aiRenamePreviewNewTag:
                    "min-w-[56px] justify-start bg-secondary text-secondary-foreground uppercase tracking-[0.04em] [a&]:hover:bg-secondary/90",
                transcriptionMeta:
                    "h-[22px] justify-normal gap-[5px] rounded-full border px-[8px] py-0 text-[11px] font-semibold leading-normal data-[sot-tone=attribute]:border-border data-[sot-tone=attribute]:bg-background data-[sot-tone=attribute]:text-[var(--fg-primary)] data-[sot-tone=measure]:border-transparent data-[sot-tone=measure]:bg-secondary data-[sot-tone=measure]:text-secondary-foreground [&>svg]:size-3",
                dashboardTranscriptLanguage:
                    "gap-1.5 border-border text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
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
