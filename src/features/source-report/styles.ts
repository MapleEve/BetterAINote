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

const skeletonBaseClassName = "bg-accent";

const cardSkeletonClassNames = {
    count: `${skeletonBaseClassName} inline-block h-[18px] w-[48px] align-middle rounded-md`,
    source: `${skeletonBaseClassName} inline-block h-[18px] w-[120px] align-middle rounded-md`,
    status: `${skeletonBaseClassName} inline-block h-[18px] w-[80px] align-middle rounded-md`,
} as const satisfies Record<SourceReportCardSkeletonSize, string>;

const segmentSkeletonClassNames = {
    "line-long": `${skeletonBaseClassName} mt-1.5 inline-block h-[13px] w-[92%] align-middle rounded-sm`,
    "line-medium": `${skeletonBaseClassName} mt-1.5 inline-block h-[13px] w-[76%] align-middle rounded-sm`,
    "line-short": `${skeletonBaseClassName} mt-1.5 inline-block h-[13px] w-3/5 align-middle rounded-sm`,
    "line-wide": `${skeletonBaseClassName} mt-1.5 inline-block h-[13px] w-[88%] align-middle rounded-sm`,
    speaker: `${skeletonBaseClassName} ml-1 inline-block h-3 w-14 align-middle rounded-sm`,
    time: `${skeletonBaseClassName} inline-block h-3 w-24 align-middle rounded-sm`,
} as const satisfies Record<SourceReportSegmentSkeletonSize, string>;

export const sourceReportCopyButtonVariant =
    "ghost" satisfies ButtonProps["variant"];

export const sourceReportCopyButtonSize = "xs" satisfies ButtonProps["size"];

export const sourceReportClassNames = {
    actionButton:
        "h-[26px] gap-[7px] rounded-[7px] px-[10px] font-sans text-[12px] font-semibold leading-normal text-foreground has-[>svg]:px-[10px]",
    actionRow: "mt-[4px] flex flex-wrap items-center gap-[8px]",
    cardLabel:
        "font-sans text-[10.5px] font-semibold leading-normal tracking-[0.06em] text-muted-foreground uppercase",
    cardNumberValue:
        "font-mono text-[16px] font-semibold leading-normal text-foreground",
    cardSkeleton: cardSkeletonClassNames,
    cardSourceFallback: "text-[11px] font-bold text-muted-foreground",
    cardSourceIcon: "size-[14px] flex-none rounded-[3px] object-contain",
    cardSourceValue: "flex items-center gap-[6px]",
    cardValue:
        "font-sans text-[13px] font-semibold leading-normal text-foreground",
    copyButton:
        "h-[26px] gap-[6px] rounded-[7px] border border-transparent px-[10px] font-sans text-[12px] font-semibold leading-normal shadow-none has-[>svg]:px-[10px] data-[copy-state=err]:border-destructive/30 data-[copy-state=err]:text-destructive data-[copy-state=err]:hover:bg-transparent data-[copy-state=err]:hover:text-destructive data-[copy-state=ok]:border-primary/30 data-[copy-state=ok]:bg-primary/10 data-[copy-state=ok]:text-primary data-[copy-state=ok]:hover:bg-primary/10 data-[copy-state=ok]:hover:text-primary [&[hidden]]:hidden",
    copyIcon:
        "stroke-current transition-[opacity,transform] duration-200 ease-out",
    copyLabel: "inline-flex min-w-0 items-center",
    description:
        "font-sans text-[11.5px] font-medium leading-normal text-muted-foreground",
    emptyActionRow:
        "mt-[8px] flex flex-wrap items-center justify-center gap-[6px]",
    emptyDescription:
        "block max-w-[360px] font-sans text-[12px] font-medium leading-[1.5] tracking-normal text-muted-foreground",
    emptyErrorIcon: "border-destructive/30 bg-destructive/10 text-destructive",
    emptyIcon:
        "mb-[4px] inline-grid size-[40px] place-items-center rounded-full border border-border bg-card text-muted-foreground [&_svg]:fill-none [&_svg]:stroke-current [&_svg]:stroke-[1.8] [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round] [&_svg:not([class*='size-'])]:size-[16px]",
    emptySurface:
        "flex flex-col items-center gap-[4px] rounded-[10px] border border-dashed border-border bg-muted px-[18px] py-[28px] text-center shadow-none backdrop-blur-none data-[sot-tone=err]:border-destructive/30 data-[sot-tone=err]:bg-destructive/10 data-[sot-tone=err]:text-foreground",
    emptyTitle:
        "m-0 block min-h-0 overflow-visible font-sans text-[13px] font-semibold leading-[1.35] tracking-normal text-foreground",
    errorAlert:
        "flex w-full flex-col items-center gap-[4px] rounded-[10px] px-[18px] py-[28px]",
    ghostActionButton:
        "h-[26px] gap-[7px] rounded-[7px] border border-transparent bg-transparent px-[10px] font-sans text-[12px] font-semibold leading-normal text-muted-foreground shadow-none has-[>svg]:px-[10px] hover:bg-muted hover:text-foreground",
    meta: "mt-[13px] mb-[13px] grid grid-cols-2 gap-x-3.5 gap-y-1.5 max-[1200px]:grid-cols-1 [[data-sot-panel=recording-source-report]_[data-sub-state=transcript-missing]_&]:mb-[14px] [[data-sot-panel=dashboard-source-report]_[data-sub-state=complete]_&]:mb-[12px]",
    metaLabel:
        "m-0 font-sans text-[11px] font-semibold leading-normal text-muted-foreground",
    metaMonoValue: "font-mono",
    metaRow:
        "grid grid-cols-[80px_1fr] items-baseline gap-2 border-b border-dashed border-border py-1.5",
    metaValue:
        "m-0 break-words font-sans text-[12px] font-medium leading-normal text-foreground",
    metricCard:
        "gap-[6px] overflow-visible rounded-[10px] border-border bg-muted px-[12px] py-[10px] shadow-none backdrop-blur-none",
    metricCards:
        "grid grid-cols-[repeat(4,1fr)] gap-[8px] max-[1200px]:grid-cols-[repeat(2,1fr)]",
    missingNotice:
        "block rounded-[10px] border-border bg-muted px-[12px] py-[10px] text-[12.5px] font-medium leading-[1.55] text-muted-foreground shadow-none data-[sot-missing=summary-missing]:mb-2 data-[sot-missing=transcript-missing]:mt-2",
    missingNoticeDescription:
        "col-start-auto block gap-0 text-[12.5px] font-medium leading-[1.55] text-muted-foreground",
    pane: "flex flex-col gap-3.5",
    primaryActionButton:
        "h-[26px] min-w-[46px] gap-[7px] rounded-[7px] px-[10px] font-sans text-[12px] font-semibold leading-normal has-[>svg]:px-[10px]",
    section: "flex flex-col gap-[8px] border-t border-border pt-[8px]",
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
        "font-sans text-[12px] font-semibold leading-normal text-muted-foreground",
    segmentText:
        "m-0 font-sans ![font-size:12.5px] font-medium ![line-height:1.55] !tracking-normal !text-foreground [text-wrap:pretty]",
    segmentTime:
        "font-mono text-[11.5px] font-medium leading-normal text-muted-foreground",
    segments: "m-0 flex list-none flex-col gap-[2px] p-0",
    state: "block [font-feature-settings:normal] [text-rendering:auto] [&[hidden]]:hidden",
    stateStack: "flex flex-col gap-3.5",
    statusBadge:
        "h-[22px] justify-normal gap-[5px] overflow-visible px-[8px] py-0 font-sans text-[11px] font-semibold leading-normal shadow-none transition-none data-[sot-tone=err]:border-destructive/30 data-[sot-tone=err]:bg-destructive/10 data-[sot-tone=err]:text-destructive data-[sot-tone=neu]:border-border data-[sot-tone=neu]:bg-muted data-[sot-tone=neu]:text-muted-foreground data-[sot-tone=ok]:border-primary/30 data-[sot-tone=ok]:bg-primary/10 data-[sot-tone=ok]:text-primary data-[sot-tone=warn]:border-secondary data-[sot-tone=warn]:bg-secondary data-[sot-tone=warn]:text-secondary-foreground",
    statusDot: "inline-block size-[5px] rounded-full bg-current",
    summaryBody: "flex flex-col gap-1.5",
    summaryMissingSection: "",
    summaryText:
        "m-0 whitespace-pre-wrap font-sans ![font-size:12.5px] font-medium ![line-height:1.55] !tracking-normal !text-foreground [text-wrap:pretty]",
    transcriptMissingSection: "",
} as const;
