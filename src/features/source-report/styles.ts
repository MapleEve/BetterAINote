import type { CSSProperties } from "react";
import type { ButtonProps } from "@/components/ui/button";

type SourceReportStyleVariables = CSSProperties & {
    [key in `--source-report-${string}`]?: string;
};

export type SourceReportTone = "err" | "neu" | "ok" | "warn";

export type SourceReportCardSkeletonSize = "count" | "source" | "status";

export type SourceReportSegmentSkeletonSize =
    | "line-long"
    | "line-medium"
    | "line-short"
    | "line-wide"
    | "speaker"
    | "time";

export const SOURCE_REPORT_STYLE_VARIABLES = {
    "--source-report-metric-bg": "var(--card-popover-footer-bg)",
    "--source-report-metric-border": "var(--glass-border-soft)",
    "--source-report-status-ok-fg": "var(--signal-success)",
    "--source-report-status-ok-bg":
        "color-mix(in srgb, var(--source-report-status-ok-fg) 14%, transparent)",
    "--source-report-status-ok-border":
        "color-mix(in srgb, var(--source-report-status-ok-fg) 30%, transparent)",
    "--source-report-status-warn-bg":
        "color-mix(in srgb, var(--signal-warning) 18%, transparent)",
    "--source-report-status-warn-border":
        "color-mix(in srgb, var(--signal-warning) 32%, transparent)",
    "--source-report-status-warn-fg": "var(--signal-warning-strong)",
    "--source-report-status-err-bg":
        "color-mix(in srgb, var(--signal-danger) 14%, transparent)",
    "--source-report-status-err-border":
        "color-mix(in srgb, var(--signal-danger) 30%, transparent)",
    "--source-report-skeleton-bg":
        "linear-gradient(90deg, rgb(255 255 255 / 0.05) 0%, rgb(255 255 255 / 0.12) 50%, rgb(255 255 255 / 0.05) 100%)",
    "--source-report-primary-border": "var(--accent)",
    "--source-report-primary-bg": "var(--accent)",
    "--source-report-primary-hover-bg": "var(--accent-hover)",
    "--source-report-primary-shadow": "var(--shadow-sm)",
} satisfies SourceReportStyleVariables;

export const SOURCE_REPORT_SKELETON_CLASS_NAME =
    "![background-color:transparent] bg-[image:var(--source-report-skeleton-bg)] bg-[length:220%_100%] bg-[position:0_50%]";

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
    "line-wide": `${SOURCE_REPORT_SKELETON_CLASS_NAME} mt-[7px] inline-block h-[13px] w-[88%] align-middle rounded-[4px]`,
    speaker: `${SOURCE_REPORT_SKELETON_CLASS_NAME} ml-[5px] inline-block h-[12px] w-[54px] align-middle rounded-[4px]`,
    time: `${SOURCE_REPORT_SKELETON_CLASS_NAME} inline-block h-[12px] w-[96px] align-middle rounded-[4px]`,
} as const satisfies Record<SourceReportSegmentSkeletonSize, string>;

export const SOURCE_REPORT_PANE_CLASS_NAME = "flex flex-col gap-3.5";

export const SOURCE_REPORT_STATE_CLASS_NAME =
    "sr-state block [font-feature-settings:normal] [text-rendering:auto] [&[hidden]]:hidden";

export const SOURCE_REPORT_STATE_STACK_CLASS_NAME = "flex flex-col gap-3.5";

export const SOURCE_REPORT_METRIC_CARDS_CLASS_NAME =
    "grid grid-cols-[repeat(4,1fr)] gap-[8px] max-[1200px]:grid-cols-[repeat(2,1fr)]";

export const SOURCE_REPORT_METRIC_CARD_CLASS_NAME =
    "sr-card gap-[6px] !overflow-visible rounded-[10px] border border-[var(--source-report-metric-border)] bg-[var(--source-report-metric-bg)] px-[12px] py-[10px] shadow-none backdrop-blur-none";

export const SOURCE_REPORT_CARD_LABEL_CLASS_NAME =
    "sr-card-label ![font:600_10.5px_var(--font-sans)] uppercase tracking-[0.06em] text-[var(--fg-tertiary)]";

export const SOURCE_REPORT_CARD_VALUE_CLASS_NAME =
    "sr-card-value ![font:600_13px_var(--font-sans)] leading-[normal] tracking-normal text-[var(--fg-primary)]";

export const SOURCE_REPORT_CARD_SOURCE_VALUE_CLASS_NAME =
    "sr-card-source flex items-center gap-[6px]";

export const SOURCE_REPORT_CARD_NUMBER_VALUE_CLASS_NAME =
    "sr-card-num ![font:600_16px_var(--font-mono)] text-[var(--fg-primary)]";

export const SOURCE_REPORT_CARD_SOURCE_ICON_CLASS_NAME =
    "size-[14px] flex-none rounded-[3px] object-contain";

export const SOURCE_REPORT_CARD_SOURCE_FALLBACK_CLASS_NAME =
    "text-[11px] font-bold text-[var(--fg-tertiary)]";

export const SOURCE_REPORT_SECTION_CLASS_NAME =
    "sr-section flex flex-col gap-[8px] border-t border-[var(--glass-border-soft)] pt-[8px]";

export const SOURCE_REPORT_TRANSCRIPT_MISSING_SECTION_CLASS_NAME =
    "after:mt-[8px] after:block after:rounded-[10px] after:border after:border-[var(--system-banner-offline-border)] after:bg-[var(--system-banner-offline-bg)] after:px-[12px] after:py-[10px] after:![font:500_12.5px/1.55_var(--font-sans)] after:text-[var(--fg-secondary)] after:content-[attr(data-sot-missing-copy)]";

export const SOURCE_REPORT_SUMMARY_MISSING_SECTION_CLASS_NAME =
    "before:mb-[8px] before:block before:rounded-[10px] before:border before:border-[var(--system-banner-offline-border)] before:bg-[var(--system-banner-offline-bg)] before:px-[12px] before:py-[10px] before:![font:500_12.5px/1.55_var(--font-sans)] before:text-[var(--fg-secondary)] before:content-[attr(data-sot-missing-copy)]";

export const SOURCE_REPORT_SECTION_SEPARATOR_CLASS_NAME = "hidden";

export const SOURCE_REPORT_SECTION_HEADER_CLASS_NAME =
    "flex items-baseline gap-[10px]";

export const SOURCE_REPORT_SECTION_TITLE_CLASS_NAME =
    "m-0 ![font:600_12.5px_var(--font-sans)] ![line-height:normal] text-[var(--fg-primary)]";

export const SOURCE_REPORT_DESCRIPTION_CLASS_NAME =
    "sr-section-sub ![font:500_11.5px_var(--font-sans)] text-[var(--fg-tertiary)]";

export const SOURCE_REPORT_MISSING_NOTICE_CLASS_NAME =
    "block rounded-[10px] border border-[var(--system-banner-offline-border)] bg-[var(--system-banner-offline-bg)] px-[12px] py-[10px] ![font:500_12.5px/1.55_var(--font-sans)] text-[var(--fg-secondary)]";

export const SOURCE_REPORT_TRANSCRIPT_MISSING_NOTICE_CLASS_NAME = `${SOURCE_REPORT_MISSING_NOTICE_CLASS_NAME} mt-[8px]`;

export const SOURCE_REPORT_SUMMARY_MISSING_NOTICE_CLASS_NAME = `${SOURCE_REPORT_MISSING_NOTICE_CLASS_NAME} mb-[8px]`;

export const SOURCE_REPORT_SUMMARY_BODY_CLASS_NAME = "flex flex-col gap-1.5";

export const SOURCE_REPORT_SEGMENTS_CLASS_NAME =
    "sr-segments m-0 flex list-none flex-col gap-[2px] p-0";

export const SOURCE_REPORT_SEGMENT_CLASS_NAME =
    "sr-seg grid grid-cols-[96px_56px_1fr] items-start gap-[10px] rounded-[6px] bg-transparent px-[10px] py-[8px]";

export const SOURCE_REPORT_SEGMENT_SKELETON_CONTAINER_CLASS_NAME =
    "sr-seg skel block rounded-[6px] bg-transparent px-[10px] py-[8px]";

export const SOURCE_REPORT_SEGMENT_TIME_CLASS_NAME =
    "sr-seg-ts ![font:500_11.5px_var(--font-mono)] text-[var(--fg-tertiary)]";

export const SOURCE_REPORT_SEGMENT_SPEAKER_CLASS_NAME =
    "sr-seg-speaker ![font:600_12px_var(--font-sans)] text-[var(--fg-secondary)]";

export const SOURCE_REPORT_SEGMENT_TEXT_CLASS_NAME =
    "sr-seg-text m-0 ![font:500_12.5px/1.55_var(--font-sans)] ![color:var(--fg-primary)] [text-wrap:pretty]";

export const SOURCE_REPORT_SUMMARY_TEXT_CLASS_NAME =
    "m-0 whitespace-pre-wrap ![font:500_12.5px/1.55_var(--font-sans)] ![color:var(--fg-primary)] [text-wrap:pretty]";

export const SOURCE_REPORT_META_CLASS_NAME =
    "sr-meta my-[15px] grid grid-cols-2 gap-x-[14px] gap-y-[6px] max-[1200px]:grid-cols-1";

export const SOURCE_REPORT_META_ROW_CLASS_NAME =
    "sr-meta-row grid min-h-[30px] grid-cols-[80px_1fr] items-baseline gap-[8px] border-b border-dashed border-[var(--glass-border-soft)] py-[6px]";

export const SOURCE_REPORT_META_LABEL_CLASS_NAME =
    "m-0 ![font:600_11px_var(--font-sans)] text-[var(--fg-tertiary)]";

export const SOURCE_REPORT_META_VALUE_CLASS_NAME =
    "m-0 break-words ![font:500_12px_var(--font-sans)] text-[var(--fg-primary)]";

export const SOURCE_REPORT_META_MONO_VALUE_CLASS_NAME = "font-mono";

export const SOURCE_REPORT_ACTION_ROW_CLASS_NAME =
    "mt-[4px] flex flex-wrap items-center gap-[8px]";

export const SOURCE_REPORT_ACTION_BUTTON_CLASS_NAME =
    "text-[var(--fg-primary)]";

export const SOURCE_REPORT_PRIMARY_ACTION_BUTTON_CLASS_NAME =
    "h-[26px] min-w-[46px] gap-[7px] rounded-[7px] border border-[var(--button-primary-border)] bg-[image:var(--button-primary-bg)] ![background-color:transparent] px-[10px] ![font:600_12px_var(--font-sans)] text-[var(--button-primary-fg)] shadow-[var(--button-primary-shadow)] has-[>svg]:px-[10px] hover:bg-[image:var(--button-primary-hover-bg)] hover:text-[var(--button-primary-fg)]";

export const SOURCE_REPORT_GHOST_ACTION_BUTTON_CLASS_NAME =
    "h-[26px] gap-[7px] rounded-[7px] border border-transparent bg-transparent px-[10px] ![font:600_12px_var(--font-sans)] text-[var(--fg-secondary)] shadow-none has-[>svg]:px-[10px] hover:bg-[var(--bg-recessed)] hover:text-[var(--fg-primary)]";

export const SOURCE_REPORT_COPY_BUTTON_VARIANT =
    "ghost" satisfies ButtonProps["variant"];

export const SOURCE_REPORT_COPY_BUTTON_SIZE =
    "sm" satisfies ButtonProps["size"];

export const SOURCE_REPORT_COPY_BUTTON_CLASS_NAME =
    "h-[26px] gap-[6px] rounded-[7px] px-[10px] ![font:600_12px_var(--font-sans)] text-[var(--fg-secondary)] has-[>svg]:px-[10px] hover:bg-[var(--bg-recessed)] hover:text-[var(--fg-primary)] [&[hidden]]:hidden [&_svg:not([class*='size-'])]:size-[14px] data-[copy-state=ok]:border-[var(--button-copy-success-border)] data-[copy-state=ok]:bg-[var(--button-copy-success-bg)] data-[copy-state=ok]:text-[var(--signal-success)] data-[copy-state=ok]:hover:bg-[var(--button-copy-success-bg)] data-[copy-state=ok]:hover:text-[var(--signal-success)] data-[copy-state=err]:border-[var(--button-copy-danger-border)] data-[copy-state=err]:text-[var(--signal-danger)] data-[copy-state=err]:hover:bg-transparent data-[copy-state=err]:hover:text-[var(--signal-danger)]";

export const SOURCE_REPORT_EMPTY_ACTION_ROW_CLASS_NAME =
    "sr-empty-actions mt-[8px] flex flex-wrap items-center gap-[6px]";

export const SOURCE_REPORT_ERROR_ALERT_CLASS_NAME =
    "flex w-full flex-col items-center !gap-[4px] rounded-[10px] !px-[18px] !py-[28px] text-center [&>svg]:text-current";

export const SOURCE_REPORT_EMPTY_SURFACE_CLASS_NAME =
    "sr-empty flex flex-col items-center !gap-[4px] rounded-[10px] border border-dashed border-[var(--line-hairline)] bg-[var(--bg-recessed)] !px-[18px] !py-[28px] text-center shadow-none backdrop-blur-none data-[sot-tone=err]:border-[color-mix(in_srgb,var(--signal-danger)_26%,transparent)] data-[sot-tone=err]:bg-[color-mix(in_srgb,var(--signal-danger)_6%,transparent)]";

export const SOURCE_REPORT_EMPTY_ICON_CLASS_NAME =
    "sr-empty-ico !mb-[4px] inline-grid !size-[40px] place-items-center rounded-full border border-[var(--line-hairline)] bg-[var(--bg-recessed)] text-[var(--fg-tertiary)] [&_svg]:fill-none [&_svg]:stroke-current [&_svg]:stroke-[1.8] [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round] [&_svg:not([class*='size-'])]:!size-[16px]";

export const SOURCE_REPORT_EMPTY_ERROR_ICON_CLASS_NAME =
    "border-[color-mix(in_srgb,var(--signal-danger)_28%,transparent)] bg-[color-mix(in_srgb,var(--signal-danger)_14%,transparent)] text-[var(--signal-danger)]";

export const SOURCE_REPORT_EMPTY_TITLE_CLASS_NAME =
    "sr-empty-title m-0 block min-h-0 overflow-visible ![font:600_13px/1.35_var(--font-sans)] tracking-normal text-[var(--fg-primary)]";

export const SOURCE_REPORT_EMPTY_DESCRIPTION_CLASS_NAME =
    "sr-empty-sub block max-w-[360px] ![font:500_12px/1.5_var(--font-sans)] tracking-normal !text-[var(--fg-tertiary)]";

export const SOURCE_REPORT_COPY_LABEL_CLASS_NAME =
    "inline-flex min-w-0 items-center";

export const SOURCE_REPORT_COPY_ICON_CLASS_NAME =
    "stroke-current transition-[opacity,transform] duration-200 ease-out";

export const SOURCE_REPORT_STATUS_BADGE_CLASS_NAME =
    "sr-pill inline-flex h-[22px] min-w-[65px] justify-normal items-center gap-[9px] overflow-visible rounded-full border px-[8px] py-0 ![font:600_11px_var(--font-sans)] leading-[normal] shadow-none data-[sot-tone=err]:border-[var(--source-report-status-err-border)] data-[sot-tone=err]:bg-[var(--source-report-status-err-bg)] data-[sot-tone=err]:text-[var(--signal-danger)] data-[sot-tone=neu]:border-[var(--line-hairline)] data-[sot-tone=neu]:bg-[var(--bg-recessed)] data-[sot-tone=neu]:text-[var(--fg-secondary)] data-[sot-tone=ok]:border-[var(--source-report-status-ok-border)] data-[sot-tone=ok]:bg-[var(--source-report-status-ok-bg)] data-[sot-tone=ok]:text-[var(--source-report-status-ok-fg)] data-[sot-tone=warn]:border-[var(--source-report-status-warn-border)] data-[sot-tone=warn]:bg-[var(--source-report-status-warn-bg)] data-[sot-tone=warn]:text-[var(--source-report-status-warn-fg)] [&_[data-sot-part=dashboard-source-report-status-dot]]:mr-0 [&_[data-sot-part=dashboard-source-report-status-dot]]:inline-block [&_[data-sot-part=dashboard-source-report-status-dot]]:size-[5px] [&_[data-sot-part=dashboard-source-report-status-dot]]:rounded-full [&_[data-sot-part=dashboard-source-report-status-dot]]:bg-current [&_[data-sot-part=source-report-status-dot]]:mr-0 [&_[data-sot-part=source-report-status-dot]]:inline-block [&_[data-sot-part=source-report-status-dot]]:size-[5px] [&_[data-sot-part=source-report-status-dot]]:rounded-full [&_[data-sot-part=source-report-status-dot]]:bg-current";

export const SOURCE_REPORT_STATUS_BADGE_WRAPPER_CLASS_NAME = "contents";
