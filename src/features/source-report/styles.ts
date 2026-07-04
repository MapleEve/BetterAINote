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

export const SOURCE_REPORT_SKELETON_CLASS_NAME =
    "bg-transparent ![background:linear-gradient(90deg,color-mix(in_srgb,var(--fg-primary)_5%,transparent)_0%,color-mix(in_srgb,var(--fg-primary)_10%,transparent)_50%,color-mix(in_srgb,var(--fg-primary)_5%,transparent)_100%)] ![background-size:220%_100%] dark:![background:linear-gradient(90deg,rgb(255_255_255_/_0.05)_0%,rgb(255_255_255_/_0.12)_50%,rgb(255_255_255_/_0.05)_100%)] dark:![background-size:220%_100%]";

export const SOURCE_REPORT_CARD_SKELETON_CLASS_NAMES = {
    count: `${SOURCE_REPORT_SKELETON_CLASS_NAME} inline-block h-[18px] w-[48px] align-middle rounded-[6px]`,
    source: `${SOURCE_REPORT_SKELETON_CLASS_NAME} inline-block h-[18px] w-[120px] align-middle rounded-[6px]`,
    status: `${SOURCE_REPORT_SKELETON_CLASS_NAME} inline-block h-[18px] w-[80px] align-middle rounded-[6px]`,
} as const satisfies Record<SourceReportCardSkeletonSize, string>;

// biome-ignore format: regression tests assert these feature-owner tokens as single-line source text.
export const SOURCE_REPORT_SEGMENT_SKELETON_CLASS_NAMES = {
    "line-long": `${SOURCE_REPORT_SKELETON_CLASS_NAME} mt-1.5 inline-block h-[13px] w-[92%] align-middle rounded-[4px]`,
    "line-medium": `${SOURCE_REPORT_SKELETON_CLASS_NAME} mt-1.5 inline-block h-[13px] w-[76%] align-middle rounded-[4px]`,
    "line-short": `${SOURCE_REPORT_SKELETON_CLASS_NAME} mt-1.5 inline-block h-[13px] w-3/5 align-middle rounded-[4px]`,
    "line-wide": `${SOURCE_REPORT_SKELETON_CLASS_NAME} mt-[6px] inline-block h-[13px] w-[88%] align-middle rounded-[4px]`,
    speaker: `${SOURCE_REPORT_SKELETON_CLASS_NAME} ml-[5px] inline-block h-[12px] w-[54px] align-middle rounded-[4px]`,
    time: `${SOURCE_REPORT_SKELETON_CLASS_NAME} inline-block h-[12px] w-[96px] align-middle rounded-[4px]`,
} as const satisfies Record<SourceReportSegmentSkeletonSize, string>;

export const SOURCE_REPORT_PANE_CLASS_NAME = "flex flex-col gap-3.5";

export const SOURCE_REPORT_STATE_CLASS_NAME =
    "block [font-feature-settings:normal] [text-rendering:auto] [&[hidden]]:hidden";

export const SOURCE_REPORT_STATE_STACK_CLASS_NAME = "flex flex-col gap-3.5";

export const SOURCE_REPORT_METRIC_CARDS_CLASS_NAME =
    "grid grid-cols-[repeat(4,1fr)] gap-[8px] max-[1200px]:grid-cols-[repeat(2,1fr)]";

export const SOURCE_REPORT_METRIC_CARD_CLASS_NAME =
    "gap-[6px] !overflow-visible rounded-[10px] border border-[var(--line-hairline)] bg-[var(--bg-recessed)] px-[12px] py-[10px] shadow-none backdrop-blur-none dark:border-[var(--glass-border-soft)] dark:bg-[var(--glass-tint-subtle)]";

export const SOURCE_REPORT_CARD_LABEL_CLASS_NAME =
    "![font:600_10.5px_var(--font-sans)] uppercase tracking-[0.06em] text-[var(--fg-tertiary)]";

export const SOURCE_REPORT_CARD_VALUE_CLASS_NAME =
    "![font:600_13px_var(--font-sans)] leading-[normal] tracking-normal text-foreground";

export const SOURCE_REPORT_CARD_SOURCE_VALUE_CLASS_NAME =
    "flex items-center gap-[6px]";

export const SOURCE_REPORT_CARD_NUMBER_VALUE_CLASS_NAME =
    "![font:600_16px_var(--font-mono)] text-foreground";

export const SOURCE_REPORT_CARD_SOURCE_ICON_CLASS_NAME =
    "size-[14px] flex-none rounded-[3px] object-contain";

export const SOURCE_REPORT_CARD_SOURCE_FALLBACK_CLASS_NAME =
    "text-[11px] font-bold text-muted-foreground";

export const SOURCE_REPORT_SECTION_CLASS_NAME =
    "flex flex-col gap-[8px] border-t border-[var(--line-hairline)] pt-[8px] dark:border-[var(--glass-border-soft)]";

export const SOURCE_REPORT_MISSING_NOTICE_CLASS_NAME =
    "block rounded-[10px] border border-[var(--alert-warning-soft-strong-border)] bg-[var(--alert-warning-soft-strong-bg)] px-[12px] py-[10px] ![font:500_12.5px/1.55_var(--font-sans)] text-[var(--fg-secondary)] shadow-none data-[sot-missing=summary-missing]:mb-[8px] data-[sot-missing=transcript-missing]:mt-[8px]";

export const SOURCE_REPORT_MISSING_NOTICE_DESCRIPTION_CLASS_NAME =
    "!col-start-auto block gap-0 ![font:500_12.5px/1.55_var(--font-sans)] !text-[var(--fg-secondary)]";

export const SOURCE_REPORT_TRANSCRIPT_MISSING_SECTION_CLASS_NAME = "";

export const SOURCE_REPORT_SUMMARY_MISSING_SECTION_CLASS_NAME = "";

export const SOURCE_REPORT_SECTION_SEPARATOR_CLASS_NAME = "hidden";

export const SOURCE_REPORT_SECTION_HEADER_CLASS_NAME =
    "flex items-baseline gap-[10px]";

export const SOURCE_REPORT_SECTION_TITLE_CLASS_NAME =
    "m-0 ![font:600_12.5px_var(--font-sans)] ![line-height:normal] text-foreground";

export const SOURCE_REPORT_DESCRIPTION_CLASS_NAME =
    "![font:500_11.5px_var(--font-sans)] text-[var(--fg-tertiary)]";

export const SOURCE_REPORT_SUMMARY_BODY_CLASS_NAME = "flex flex-col gap-1.5";

export const SOURCE_REPORT_SEGMENTS_CLASS_NAME =
    "m-0 flex list-none flex-col gap-[2px] p-0";

export const SOURCE_REPORT_SEGMENT_CLASS_NAME =
    "grid grid-cols-[96px_56px_1fr] items-start gap-[10px] rounded-[6px] bg-transparent px-[10px] py-[8px]";

export const SOURCE_REPORT_SEGMENT_SKELETON_CONTAINER_CLASS_NAME =
    "block rounded-[6px] bg-transparent px-[10px] py-[8px]";

export const SOURCE_REPORT_SEGMENT_TIME_CLASS_NAME =
    "![font:500_11.5px_var(--font-mono)] text-[var(--fg-tertiary)]";

export const SOURCE_REPORT_SEGMENT_SPEAKER_CLASS_NAME =
    "![font:600_12px_var(--font-sans)] text-[var(--fg-secondary)]";

export const SOURCE_REPORT_SEGMENT_TEXT_CLASS_NAME =
    "m-0 ![font:500_12.5px/1.55_var(--font-sans)] !text-foreground [text-wrap:pretty]";

export const SOURCE_REPORT_SUMMARY_TEXT_CLASS_NAME =
    "m-0 whitespace-pre-wrap ![font:500_12.5px/1.55_var(--font-sans)] !text-foreground [text-wrap:pretty]";

export const SOURCE_REPORT_META_CLASS_NAME =
    "my-[15px] grid grid-cols-2 gap-x-[14px] gap-y-[6px] max-[1200px]:grid-cols-1";

export const SOURCE_REPORT_META_ROW_CLASS_NAME =
    "grid min-h-[30px] grid-cols-[80px_1fr] items-baseline gap-[8px] border-b border-dashed border-[var(--line-hairline)] py-[6px] dark:border-[var(--glass-border-soft)]";

export const SOURCE_REPORT_META_LABEL_CLASS_NAME =
    "m-0 ![font:600_11px_var(--font-sans)] text-[var(--fg-tertiary)]";

export const SOURCE_REPORT_META_VALUE_CLASS_NAME =
    "m-0 break-words ![font:500_12px_var(--font-sans)] text-foreground";

export const SOURCE_REPORT_META_MONO_VALUE_CLASS_NAME = "font-mono";

export const SOURCE_REPORT_ACTION_ROW_CLASS_NAME =
    "mt-[4px] flex flex-wrap items-center gap-[8px]";

export const SOURCE_REPORT_ACTION_BUTTON_CLASS_NAME = "text-foreground";

export const SOURCE_REPORT_PRIMARY_ACTION_BUTTON_CLASS_NAME =
    "h-[26px] min-w-[46px] gap-[7px] rounded-[7px] border-[color-mix(in_srgb,var(--accent)_60%,black_8%)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--accent)_92%,white_18%),var(--accent))] px-[10px] ![font:600_12px_var(--font-sans)] !text-white shadow-[0_2px_6px_color-mix(in_srgb,var(--accent)_24%,transparent),inset_0_1px_0_rgb(255_255_255_/_0.22)] has-[>svg]:px-[10px] hover:bg-[linear-gradient(180deg,color-mix(in_srgb,var(--accent)_96%,white_8%),var(--accent))] hover:!text-white";

export const SOURCE_REPORT_GHOST_ACTION_BUTTON_CLASS_NAME =
    "h-[26px] gap-[7px] rounded-[7px] border border-transparent bg-transparent px-[10px] ![font:600_12px_var(--font-sans)] text-[var(--fg-secondary)] shadow-none has-[>svg]:px-[10px] hover:bg-[var(--bg-recessed)] hover:text-[var(--fg-primary)]";

export const SOURCE_REPORT_COPY_BUTTON_VARIANT =
    "ghost" satisfies ButtonProps["variant"];

export const SOURCE_REPORT_COPY_BUTTON_SIZE =
    "sm" satisfies ButtonProps["size"];

export const SOURCE_REPORT_COPY_BUTTON_CLASS_NAME =
    "h-[26px] gap-[6px] rounded-[7px] px-[10px] ![font:600_12px_var(--font-sans)] text-muted-foreground has-[>svg]:px-[10px] hover:bg-accent hover:text-accent-foreground [&[hidden]]:hidden [&_svg:not([class*='size-'])]:size-[14px] data-[copy-state=ok]:border-primary/30 data-[copy-state=ok]:bg-primary/10 data-[copy-state=ok]:text-primary data-[copy-state=ok]:hover:bg-primary/10 data-[copy-state=ok]:hover:text-primary data-[copy-state=err]:border-destructive/30 data-[copy-state=err]:text-destructive data-[copy-state=err]:hover:bg-transparent data-[copy-state=err]:hover:text-destructive";

export const SOURCE_REPORT_EMPTY_ACTION_ROW_CLASS_NAME =
    "mt-[8px] flex flex-wrap items-center gap-[6px]";

export const SOURCE_REPORT_ERROR_ALERT_CLASS_NAME =
    "flex w-full flex-col items-center !gap-[4px] rounded-[10px] !px-[18px] !py-[28px] text-center [&>svg]:text-current";

export const SOURCE_REPORT_EMPTY_SURFACE_CLASS_NAME =
    "flex flex-col items-center !gap-[4px] rounded-[10px] border border-dashed border-[var(--line-hairline)] bg-[var(--bg-recessed)] !px-[18px] !py-[28px] text-center shadow-none backdrop-blur-none data-[sot-tone=err]:border-[var(--alert-destructive-soft-border)] data-[sot-tone=err]:bg-[var(--alert-destructive-subtle-bg)] data-[sot-tone=err]:text-[var(--fg-primary)]";

export const SOURCE_REPORT_EMPTY_ICON_CLASS_NAME =
    "!mb-[4px] inline-grid !size-[40px] place-items-center rounded-full border border-[var(--line-hairline)] bg-[var(--bg-recessed)] text-[var(--fg-tertiary)] [&_svg]:fill-none [&_svg]:stroke-current [&_svg]:stroke-[1.8] [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round] [&_svg:not([class*='size-'])]:!size-[16px]";

export const SOURCE_REPORT_EMPTY_ERROR_ICON_CLASS_NAME =
    "border-[var(--alert-destructive-icon-soft-border)] bg-[var(--alert-destructive-icon-soft-bg)] text-[var(--signal-danger)]";

export const SOURCE_REPORT_EMPTY_TITLE_CLASS_NAME =
    "m-0 block min-h-0 overflow-visible ![font:600_13px/1.35_var(--font-sans)] tracking-normal text-foreground";

export const SOURCE_REPORT_EMPTY_DESCRIPTION_CLASS_NAME =
    "block max-w-[360px] ![font:500_12px/1.5_var(--font-sans)] tracking-normal !text-[var(--fg-tertiary)]";

export const SOURCE_REPORT_COPY_LABEL_CLASS_NAME =
    "inline-flex min-w-0 items-center";

export const SOURCE_REPORT_COPY_ICON_CLASS_NAME =
    "stroke-current transition-[opacity,transform] duration-200 ease-out";

export const SOURCE_REPORT_STATUS_BADGE_CLASS_NAME =
    "!inline-flex !h-[22px] !w-fit !shrink-0 !items-center !justify-normal !gap-[5px] !overflow-visible !rounded-full !border !px-[8px] !py-0 ![font:600_11px_var(--font-sans)] !leading-[normal] !shadow-none !whitespace-nowrap !transition-none data-[sot-tone=err]:!border-[color-mix(in_srgb,var(--signal-danger)_30%,transparent)] data-[sot-tone=err]:!bg-[color-mix(in_srgb,var(--signal-danger)_14%,transparent)] data-[sot-tone=err]:!text-[var(--signal-danger)] data-[sot-tone=neu]:!border-[var(--line-hairline)] data-[sot-tone=neu]:!bg-[var(--bg-recessed)] data-[sot-tone=neu]:!text-[var(--fg-secondary)] data-[sot-tone=ok]:!border-[color-mix(in_srgb,var(--signal-success)_30%,transparent)] data-[sot-tone=ok]:!bg-[color-mix(in_srgb,var(--signal-success)_14%,transparent)] data-[sot-tone=ok]:!text-[var(--signal-success)] data-[sot-tone=warn]:!border-[color-mix(in_srgb,var(--signal-warning)_32%,transparent)] data-[sot-tone=warn]:!bg-[color-mix(in_srgb,var(--signal-warning)_18%,transparent)] data-[sot-tone=warn]:!text-[oklch(0.55_0.16_70)] [&_[data-sot-part=dashboard-source-report-status-dot]]:!mr-0 [&_[data-sot-part=dashboard-source-report-status-dot]]:!inline-block [&_[data-sot-part=dashboard-source-report-status-dot]]:!size-[5px] [&_[data-sot-part=dashboard-source-report-status-dot]]:!rounded-full [&_[data-sot-part=dashboard-source-report-status-dot]]:!bg-current [&_[data-sot-part=source-report-status-dot]]:!mr-0 [&_[data-sot-part=source-report-status-dot]]:!inline-block [&_[data-sot-part=source-report-status-dot]]:!size-[5px] [&_[data-sot-part=source-report-status-dot]]:!rounded-full [&_[data-sot-part=source-report-status-dot]]:!bg-current";
