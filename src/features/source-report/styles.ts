import type { ButtonProps } from "@/components/ui/button";

export type SourceReportTone = "err" | "neu" | "ok" | "warn";

export type SourceReportCardSkeletonSize = "count" | "source" | "status";

export type SourceReportSegmentSkeletonSize =
    | "line-long"
    | "line-medium"
    | "line-short"
    | "line-wide"
    | "speaker"
    | "time";

const skeletonBaseClassName =
    "bg-[color-mix(in_srgb,var(--fg-primary)_10%,transparent)]";

const cardSkeletonClassNames = {
    count: `${skeletonBaseClassName} inline-block h-[18px] w-[48px] align-middle rounded-[6px]`,
    source: `${skeletonBaseClassName} inline-block h-[18px] w-[120px] align-middle rounded-[6px]`,
    status: `${skeletonBaseClassName} inline-block h-[18px] w-[80px] align-middle rounded-[6px]`,
} as const satisfies Record<SourceReportCardSkeletonSize, string>;

const segmentSkeletonClassNames = {
    "line-long": `${skeletonBaseClassName} mt-1.5 inline-block h-[13px] w-[92%] align-middle rounded-[4px]`,
    "line-medium": `${skeletonBaseClassName} mt-1.5 inline-block h-[13px] w-[76%] align-middle rounded-[4px]`,
    "line-short": `${skeletonBaseClassName} mt-1.5 inline-block h-[13px] w-[60%] align-middle rounded-[4px]`,
    "line-wide": `${skeletonBaseClassName} mt-1.5 inline-block h-[13px] w-[88%] align-middle rounded-[4px]`,
    speaker: `${skeletonBaseClassName} ml-1 inline-block h-[12px] w-[54px] align-middle rounded-[4px]`,
    time: `${skeletonBaseClassName} inline-block h-[12px] w-[96px] align-middle rounded-[4px]`,
} as const satisfies Record<SourceReportSegmentSkeletonSize, string>;

export const sourceReportCopyButtonVariant =
    "ghost" satisfies ButtonProps["variant"];

export const sourceReportCopyButtonSize = "xs" satisfies ButtonProps["size"];

export const sourceReportClassNames = {
    actionButton:
        "h-[26px] gap-[7px] rounded-[7px] px-[10px] font-sans text-[12px] font-semibold leading-[normal] text-foreground has-[>svg]:px-[10px]",
    actionRow: "mt-[4px] flex flex-wrap items-center gap-[8px]",
    cardLabel:
        "font-sans text-[10.5px] font-semibold leading-[normal] tracking-[0.06em] text-[var(--fg-tertiary)] uppercase",
    cardNumberValue:
        "font-mono text-[16px] font-semibold leading-[normal] text-foreground",
    cardSkeleton: cardSkeletonClassNames,
    cardSourceFallback: "text-[11px] font-bold text-muted-foreground",
    cardSourceIcon: "size-[14px] flex-none rounded-[3px] object-contain",
    cardSourceValue: "flex items-center gap-[6px]",
    cardValue:
        "font-sans text-[13px] font-semibold leading-[normal] text-foreground",
    copyButton:
        "h-[26px] gap-[6px] rounded-[7px] border border-transparent px-[10px] font-sans text-[12px] font-semibold leading-[normal] shadow-none has-[>svg]:px-[10px] data-[copy-state=err]:border-[var(--alert-destructive-soft-border)] data-[copy-state=err]:text-[var(--signal-danger)] data-[copy-state=err]:hover:bg-transparent data-[copy-state=err]:hover:text-[var(--signal-danger)] data-[copy-state=ok]:border-[color-mix(in_srgb,var(--signal-success)_36%,transparent)] data-[copy-state=ok]:bg-[color-mix(in_srgb,var(--signal-success)_10%,transparent)] data-[copy-state=ok]:text-[var(--signal-success)] data-[copy-state=ok]:hover:bg-[color-mix(in_srgb,var(--signal-success)_10%,transparent)] data-[copy-state=ok]:hover:text-[var(--signal-success)] [&[hidden]]:hidden",
    copyIcon:
        "stroke-current transition-[opacity,transform] duration-200 ease-out",
    copyLabel: "inline-flex min-w-0 items-center",
    description:
        "font-sans text-[11.5px] font-medium leading-[normal] text-[var(--fg-tertiary)]",
    emptyActionRow:
        "mt-[8px] flex flex-wrap items-center justify-center gap-[6px]",
    emptyDescription:
        "block max-w-[360px] font-sans text-[12px] font-medium leading-[1.5] tracking-normal text-muted-foreground",
    emptyErrorIcon:
        "border-[var(--alert-destructive-icon-soft-border)] bg-[var(--alert-destructive-icon-soft-bg)] text-[var(--signal-danger)]",
    emptyIcon:
        "mb-[4px] inline-grid size-[40px] place-items-center rounded-full border border-[var(--line-hairline)] bg-[var(--bg-elevated)] text-[var(--fg-tertiary)] [&_svg]:fill-none [&_svg]:stroke-current [&_svg]:stroke-[1.8] [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round] [&_svg:not([class*='size-'])]:size-[16px]",
    emptySurface:
        "flex flex-col items-center gap-[4px] rounded-[10px] border border-dashed border-[var(--line-hairline)] bg-[var(--bg-recessed)] px-[18px] py-[28px] text-center shadow-none backdrop-blur-none data-[sot-tone=err]:border-[var(--alert-destructive-soft-border)] data-[sot-tone=err]:bg-[var(--alert-destructive-subtle-bg)] data-[sot-tone=err]:text-[var(--fg-primary)]",
    emptyTitle:
        "m-0 block min-h-0 overflow-visible font-sans text-[13px] font-semibold leading-[1.35] tracking-normal text-foreground",
    errorAlert:
        "flex w-full flex-col items-center gap-[4px] rounded-[10px] px-[18px] py-[28px]",
    ghostActionButton:
        "h-[26px] gap-[7px] rounded-[7px] border border-transparent bg-transparent px-[10px] font-sans text-[12px] font-semibold leading-[normal] text-[var(--fg-secondary)] shadow-none has-[>svg]:px-[10px] hover:bg-[var(--bg-recessed)] hover:text-[var(--fg-primary)]",
    meta: "mt-[13px] mb-[13px] grid grid-cols-2 gap-x-3.5 gap-y-1.5 max-[1200px]:grid-cols-1 [[data-sot-panel=recording-source-report-state][data-sub-state=transcript-missing]_&]:mb-[21px] [[data-sot-panel=recording-source-report-state][data-sub-state=summary-missing]_&]:mb-[21px] [[data-sot-panel=recording-source-report-state][data-sub-state=both-missing]_&]:mb-[22px] [[data-sot-panel=dashboard-source-report-state][data-sub-state=complete]_&]:mb-[21px] [[data-sot-panel=dashboard-source-report-state][data-sub-state=summary-missing]_&]:mb-[21px] [[data-sot-panel=dashboard-source-report-state][data-sub-state=transcript-missing]_&]:mb-[22px] [[data-sot-panel=dashboard-source-report-state][data-sub-state=both-missing]_&]:mb-[22px]",
    metaLabel:
        "m-0 font-sans text-[11px] font-semibold leading-[normal] text-[var(--fg-tertiary)]",
    metaMonoValue: "font-mono",
    metaRow:
        "grid grid-cols-[80px_1fr] items-baseline gap-2 border-b border-dashed border-[var(--line-hairline)] py-1.5 [[data-theme=dark]_&]:border-[var(--glass-border-soft)] [.dark_&]:border-[var(--glass-border-soft)]",
    metaValue:
        "m-0 break-words font-sans text-[12px] font-medium leading-[normal] text-foreground",
    metricCard:
        "gap-[6px] overflow-visible rounded-[10px] border border-[var(--line-hairline)] bg-[var(--bg-recessed)] px-[12px] py-[10px] shadow-none backdrop-blur-none [[data-theme=dark]_&]:border-[var(--glass-border-soft)] [[data-theme=dark]_&]:bg-[color-mix(in_srgb,var(--fg-primary)_3%,transparent)] [.dark_&]:border-[var(--glass-border-soft)] [.dark_&]:bg-[color-mix(in_srgb,var(--fg-primary)_3%,transparent)]",
    metricCards:
        "grid grid-cols-[repeat(4,1fr)] gap-[8px] max-[1200px]:grid-cols-[repeat(2,1fr)]",
    missingNotice:
        "block rounded-[10px] border-[var(--alert-warning-soft-strong-border)] bg-[var(--alert-warning-soft-strong-bg)] px-[12px] py-[10px] text-[12.5px] font-medium leading-[1.55] text-[var(--fg-secondary)] shadow-none data-[sot-missing=summary-missing]:mb-2 data-[sot-missing=transcript-missing]:mt-2",
    missingNoticeDescription:
        "col-start-auto block gap-0 text-[12.5px] font-medium leading-[1.55] text-[var(--fg-secondary)]",
    pane: "flex flex-col gap-3.5",
    primaryActionButton:
        "h-[26px] min-w-[46px] gap-[7px] rounded-[7px] px-[10px] font-sans text-[12px] font-semibold leading-[normal] has-[>svg]:px-[10px]",
    section:
        "flex flex-col gap-[8px] border-t border-[var(--line-hairline)] pt-[8px] [[data-theme=dark]_&]:border-[var(--glass-border-soft)] [.dark_&]:border-[var(--glass-border-soft)]",
    sectionHeader: "flex items-baseline gap-[10px]",
    sectionSeparator: "hidden",
    sectionTitle:
        "m-0 font-sans ![font-size:12.5px] font-semibold ![line-height:normal] !tracking-normal !text-foreground",
    segment:
        "grid grid-cols-[96px_56px_1fr] items-start gap-[10px] rounded-[6px] bg-transparent px-[10px] py-[8px]",
    segmentSkeleton: segmentSkeletonClassNames,
    segmentSkeletonContainer:
        "block rounded-[6px] bg-transparent px-[10px] py-[8px]",
    segmentSpeaker:
        "font-sans text-[12px] font-semibold leading-[normal] text-[var(--fg-secondary)]",
    segmentText:
        "m-0 font-sans ![font-size:12.5px] font-medium ![line-height:1.55] !tracking-normal !text-foreground [text-wrap:pretty]",
    segmentTime:
        "font-mono text-[11.5px] font-medium leading-[normal] text-[var(--fg-tertiary)]",
    segments: "m-0 flex list-none flex-col gap-[2px] p-0",
    state: "block [font-feature-settings:normal] [text-rendering:auto] [&[hidden]]:hidden",
    stateStack: "flex flex-col gap-3.5",
    statusBadge:
        "h-[22px] justify-normal gap-[5px] overflow-visible px-[8px] py-0 font-sans text-[11px] font-semibold leading-[normal] shadow-none transition-none data-[sot-tone=err]:border-[color-mix(in_srgb,var(--signal-danger)_30%,transparent)] data-[sot-tone=err]:bg-[color-mix(in_srgb,var(--signal-danger)_14%,transparent)] data-[sot-tone=err]:text-[var(--signal-danger)] data-[sot-tone=neu]:border-[var(--line-hairline)] data-[sot-tone=neu]:bg-[var(--bg-recessed)] data-[sot-tone=neu]:text-[var(--fg-secondary)] data-[sot-tone=ok]:border-[color-mix(in_srgb,var(--signal-success)_30%,transparent)] data-[sot-tone=ok]:bg-[color-mix(in_srgb,var(--signal-success)_14%,transparent)] data-[sot-tone=ok]:text-[var(--signal-success)] data-[sot-tone=warn]:border-[color-mix(in_srgb,var(--signal-warning)_32%,transparent)] data-[sot-tone=warn]:bg-[color-mix(in_srgb,var(--signal-warning)_18%,transparent)] data-[sot-tone=warn]:text-[var(--signal-warning-deep)]",
    statusDot: "inline-block size-[5px] rounded-full bg-current",
    summaryBody: "flex flex-col gap-1.5",
    summaryMissingSection: "",
    summaryText:
        "m-0 whitespace-pre-wrap font-sans ![font-size:12.5px] font-medium ![line-height:1.55] !tracking-normal !text-foreground [text-wrap:pretty]",
    transcriptMissingSection: "",
} as const;
