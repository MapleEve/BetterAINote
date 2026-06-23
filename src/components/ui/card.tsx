import type * as React from "react";

import { cn } from "@/lib/utils";

const cardVariants = {
    default: "",
    onboardingSurface:
        "min-h-[375px] gap-0 w-[min(420px,100%)] overflow-visible rounded-[14px] border border-[var(--line-hairline)] bg-[var(--bg-elevated)] p-[18px] shadow-xs backdrop-blur-none",
    onboardingSpeakerDraft:
        "grid grid-cols-[36px_1fr_auto_auto] items-center gap-3 border-primary/50 bg-primary/10 p-3.5",
    elevated:
        "rounded-[var(--radius-md)] border-[var(--card-elevated-border)] bg-[var(--card-elevated-bg)]",
    popover:
        "overflow-hidden rounded-[12px] border-[var(--card-popover-border)] bg-[var(--card-popover-bg)] shadow-[var(--card-popover-shadow)] backdrop-blur-none",
    recordingTagManagerPanel:
        "max-h-[460px] w-[320px] max-w-[calc(100vw-2rem)] gap-0 overflow-hidden rounded-[12px] border-[var(--card-popover-border)] bg-[var(--card-popover-bg)] shadow-[var(--card-popover-shadow)] backdrop-blur-none max-md:max-w-none",
    routeLoadingSurface:
        "min-h-0 gap-0 overflow-hidden rounded-[16px] border-[var(--line-hairline)] bg-[var(--bg-elevated)] shadow-[var(--shadow-sm)] backdrop-blur-none dark:border-[var(--glass-border)]",
    dashboardRecordingPlayer:
        "min-h-[114px] gap-0 overflow-visible rounded-[16px] border-[var(--glass-border-soft)] bg-[rgb(255_255_255_/_0.025)] px-[18px] py-[16px] shadow-none backdrop-blur-none",
    sourceReportMetric:
        "gap-[6px] overflow-visible rounded-[10px] border-[var(--source-report-metric-border)] bg-[var(--source-report-metric-bg)] px-[12px] py-[10px] shadow-none backdrop-blur-none",
    speakerReviewTranscript: "gap-0",
    speakerReviewRow:
        "grid items-center gap-[10px] overflow-visible rounded-[var(--radius-md)] border-[var(--card-elevated-border)] bg-[var(--card-elevated-bg)] p-[10px_12px]",
    speakerReviewMergePopover:
        "absolute right-0 top-[calc(100%+0.5rem)] z-[var(--z-popover-inline)] w-[320px] min-w-[280px] gap-0 overflow-hidden rounded-[12px] border-[var(--card-popover-border)] bg-[var(--card-popover-bg)] p-0 shadow-[var(--card-popover-shadow)] backdrop-blur-none",
    speakerReviewConfirm:
        "flex-row items-center gap-[10px] overflow-visible rounded-[var(--radius-md)] border border-[var(--alert-destructive-soft-border)] bg-[var(--alert-destructive-soft-bg)] p-[10px_12px] text-[length:var(--text-body-sm)] text-[var(--fg-primary)] shadow-none backdrop-blur-none [&_[data-sot-confirm-message]]:min-w-0 [&_[data-sot-confirm-message]]:flex-1 [&_[data-sot-confirm-subject]]:not-italic [&_[data-sot-confirm-subject]]:[font-weight:var(--weight-semibold)] [&_[data-sot-confirm-subject]]:text-[var(--fg-primary)]",
    aiRenamePreview: "w-[min(360px,calc(100vw-32px))] gap-0",
} as const;

const cardHeaderVariants = {
    default:
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
    onboardingHeader: "grid auto-rows-min gap-0 p-0",
    onboardingStepHeader: "grid auto-rows-min gap-0 p-0",
    onboardingProviderMeta: "grid auto-rows-min gap-0 p-0",
    detailHeader:
        "relative flex flex-row items-center gap-2.5 px-1 pt-1 pb-0 data-[sot-state=saving]:py-0",
    popover:
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start border-b-[1px] border-[var(--card-popover-divider)] px-[12px] pb-[9px] pt-[11px] has-data-[slot=card-action]:grid-cols-[1fr_auto]",
    popoverCompact:
        "flex flex-row items-center justify-between border-b-[1px] border-[var(--card-popover-divider)] px-[12px] pt-[10px] pb-[10px] [&>[data-slot=card-action]]:self-center",
    recordingTagManagerHeader:
        "flex flex-row items-center justify-between border-b-[1px] border-[var(--card-popover-divider)] px-[12px] pt-[10px] pb-[10px] [&>[data-slot=card-action]]:self-center",
    speakerReviewTranscript:
        "flex items-center justify-between gap-[10px] px-[16px] pt-[12px] pb-[8px] max-[860px]:flex-col max-[860px]:items-stretch [&_[data-sot-part=speaker-review-header-copy]]:flex [&_[data-sot-part=speaker-review-header-copy]]:min-w-0 [&_[data-sot-part=speaker-review-header-copy]]:items-center [&_[data-sot-part=speaker-review-header-copy]]:gap-2.5",
    speakerReviewMergePopover:
        "flex flex-row items-center justify-between gap-[10px] border-b-[1px] border-[var(--card-popover-divider)] px-[12px] pb-[9px] pt-[11px]",
    aiRenamePreview:
        "grid-cols-[1fr_auto] items-start gap-x-2 gap-y-1 border-b border-border px-4 py-3 [&_[data-slot=card-head-copy]]:min-w-0",
} as const;

const cardTitleVariants = {
    default: "leading-none font-semibold",
    onboardingHeading:
        "mb-1 font-sans text-[13px] font-semibold text-[var(--fg-primary)]",
    onboardingStepTitle: "leading-none font-semibold",
    onboardingProviderName: "leading-none font-semibold",
    detailHeaderTitle: "leading-none font-semibold min-w-0 flex-1 truncate",
    popoverCompact:
        "text-[12.5px] font-semibold leading-[17px] text-[var(--fg-primary)]",
    recordingTagManagerTitle:
        "text-[12.5px] font-semibold leading-[17px] text-[var(--fg-primary)]",
    speakerReviewTitle: "leading-none font-semibold",
    speakerReviewMergeTitle:
        "text-[12px] font-semibold leading-normal text-[var(--fg-primary)]",
    aiRenamePreview:
        "break-words text-xs font-semibold leading-none text-foreground",
} as const;

const cardContentVariants = {
    default: "px-6",
    onboardingStepBody: "gap-0 p-0",
    aiRenamePreview:
        "flex min-h-20 flex-col px-4 py-4 [&_[data-slot=card-state]]:flex [&_[data-slot=card-state]]:flex-col [&_[data-slot=card-state]]:gap-2 [&_[data-slot=card-state-label]]:text-[10.5px] [&_[data-slot=card-state-label]]:font-semibold [&_[data-slot=card-state-label]]:uppercase [&_[data-slot=card-state-label]]:tracking-[0.08em] [&_[data-slot=card-state-label]]:text-muted-foreground [&_[data-slot=card-message]]:m-0 [&_[data-slot=card-message]]:break-words [&_[data-slot=card-message]]:text-sm [&_[data-slot=card-message]]:leading-6 [&_[data-slot=card-message]]:text-muted-foreground [&_[data-slot=card-hint]]:m-0 [&_[data-slot=card-hint]]:break-words [&_[data-slot=card-hint]]:text-sm [&_[data-slot=card-hint]]:leading-6 [&_[data-slot=card-hint]]:text-muted-foreground [&_[data-slot=card-review-row]]:my-1.5 [&_[data-slot=card-review-row]]:flex [&_[data-slot=card-review-row]]:flex-col [&_[data-slot=card-review-row]]:gap-1.5 [&_[data-slot=card-review-line]]:flex [&_[data-slot=card-review-line]]:min-w-0 [&_[data-slot=card-review-line]]:items-baseline [&_[data-slot=card-review-line]]:gap-2 [&_[data-slot=card-review-line]]:rounded-lg [&_[data-slot=card-review-line]]:border [&_[data-slot=card-review-line]]:border-border [&_[data-slot=card-review-line]]:bg-muted/50 [&_[data-slot=card-review-line]]:px-2.5 [&_[data-slot=card-review-line]]:py-2 [&_[data-slot=card-review-value]]:min-w-0 [&_[data-slot=card-review-value]]:break-words [&_[data-slot=card-review-value]]:text-sm [&_[data-slot=card-review-value]]:font-semibold [&_[data-slot=card-review-value]]:leading-relaxed [&_[data-review-tone=old]]:line-through [&_[data-review-tone=old]]:text-muted-foreground [&_[data-review-tone=new]]:text-foreground [&_[data-slot=card-preview-title]]:min-w-0 [&_[data-slot=card-preview-title]]:rounded-lg [&_[data-slot=card-preview-title]]:border [&_[data-slot=card-preview-title]]:border-border [&_[data-slot=card-preview-title]]:bg-muted/50 [&_[data-slot=card-preview-title]]:px-2.5 [&_[data-slot=card-preview-title]]:py-2 [&_[data-slot=card-preview-title]]:text-sm [&_[data-slot=card-preview-title]]:font-semibold [&_[data-slot=card-preview-title]]:leading-relaxed [&_[data-slot=card-preview-title]]:text-foreground",
    popoverCompact: "px-[14px] pb-[14px] pt-[12px]",
    popoverCreate: "px-[14px] pb-[14px] pt-[12px]",
    popoverDefault: "min-h-[234px] px-[14px] pb-[14px] pt-[12px]",
    popoverDelete: "px-[14px] pb-[14px] pt-[12px]",
    popoverEmpty: "px-[14px] pb-[14px] pt-[12px]",
    popoverSaving: "min-h-[52px] px-[14px] pb-[14px] pt-[12px]",
    popoverTight: "px-[14px] pb-[14px] pt-[12px]",
    recordingTagManagerCompact:
        "flex flex-col gap-[14px] overflow-auto px-[14px] pb-[14px] pt-[12px]",
    recordingTagManagerCreate:
        "flex flex-col gap-[14px] overflow-auto px-[14px] pb-[14px] pt-[12px]",
    recordingTagManagerDefault:
        "flex min-h-[234px] flex-col gap-[14px] overflow-auto px-[14px] pb-[14px] pt-[12px]",
    recordingTagManagerDelete:
        "flex flex-col gap-[14px] overflow-auto px-[14px] pb-[14px] pt-[12px]",
    recordingTagManagerEmpty:
        "flex flex-col gap-[14px] overflow-auto px-[14px] pb-[14px] pt-[12px]",
    recordingTagManagerSaving:
        "flex min-h-[52px] flex-col gap-[14px] overflow-auto px-[14px] pb-[14px] pt-[12px]",
    recordingTagManagerTight:
        "flex flex-col gap-[14px] overflow-auto px-[14px] pb-[14px] pt-[12px]",
    speakerReviewTranscript:
        "px-4 pb-4 [&_[data-sot-list=speaker-review-meta]]:my-4 [&_[data-sot-list=speaker-review-meta]]:grid [&_[data-sot-list=speaker-review-meta]]:grid-cols-2 [&_[data-sot-list=speaker-review-meta]]:gap-x-3.5 [&_[data-sot-list=speaker-review-meta]]:gap-y-1.5 max-[640px]:[&_[data-sot-list=speaker-review-meta]]:grid-cols-1 [&_[data-sot-part=speaker-review-transcript-section]]:flex [&_[data-sot-part=speaker-review-transcript-section]]:flex-col [&_[data-sot-part=speaker-review-transcript-section]]:gap-2 [&_[data-sot-part=speaker-review-transcript-section]]:border-t [&_[data-sot-part=speaker-review-transcript-section]]:pt-2",
    speakerReviewMergePopover: "p-0",
} as const;

const cardFooterVariants = {
    default: "px-6 [.border-t]:pt-6",
    aiRenamePreview: "gap-1.5 px-4 py-3",
    popoverCompact:
        "min-h-[49px] gap-[6px] border-t border-[var(--card-popover-divider)] bg-[var(--card-popover-footer-bg)] px-[14px] py-[10px]",
    recordingTagManagerFooter:
        "min-h-[49px] gap-[6px] border-t border-[var(--card-popover-divider)] bg-[var(--card-popover-footer-bg)] px-[14px] py-[10px]",
} as const;

const cardDescriptionVariants = {
    default: "text-sm text-muted-foreground",
    onboardingSub:
        "mb-[14px] font-sans text-[12px] leading-[1.5] text-[var(--fg-tertiary)]",
    onboardingStepDescription: "text-sm text-muted-foreground",
    onboardingProviderHint: "text-sm text-muted-foreground",
    aiRenamePreview:
        "break-words text-xs font-medium leading-snug text-muted-foreground",
    speakerReviewDescription: "text-sm text-muted-foreground",
    popoverNote:
        "max-h-[31px] overflow-hidden px-[14px] pt-[15px] pb-0 text-[11px] leading-[1.45] font-normal text-[var(--card-popover-note-fg)]",
    recordingTagToggleNote:
        "max-h-[31px] overflow-hidden px-[14px] pt-[15px] pb-0 text-[11px] leading-[1.45] font-normal text-[var(--card-popover-note-fg)]",
} as const;

const cardActionVariants = {
    default: "",
    speakerReviewActions:
        "flex min-w-0 flex-wrap items-center justify-end gap-[6px] max-[860px]:justify-start",
    aiRenamePreview: "shrink-0",
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
    const hasSemanticNoPadding = [
        "onboardingSurface",
        "onboardingSpeakerDraft",
    ].includes(variant);

    return (
        <div
            data-slot="card"
            data-variant={variant}
            className={cn(
                "flex flex-col gap-6 overflow-hidden rounded-xl border border-border bg-card text-card-foreground",
                !["popover", "recordingTagManagerPanel"].includes(variant) &&
                    "shadow-sm backdrop-blur-xl",
                cardVariants[variant],
                !hasNoPadding && !hasSemanticNoPadding && "py-6",
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
