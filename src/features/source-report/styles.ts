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
    "--source-report-metric-bg": "var(--bg-recessed)",
    "--source-report-metric-border": "var(--line-hairline)",
    "--source-report-status-ok-fg": "var(--signal-success)",
    "--source-report-status-ok-bg": "var(--bg-recessed)",
    "--source-report-status-ok-border": "var(--line-hairline)",
    "--source-report-status-warn-bg": "var(--bg-recessed)",
    "--source-report-status-warn-border": "var(--line-hairline)",
    "--source-report-status-warn-fg": "var(--signal-warning-strong)",
    "--source-report-status-err-bg": "var(--bg-recessed)",
    "--source-report-status-err-border": "var(--line-hairline)",
    "--source-report-skeleton-bg": "var(--bg-recessed)",
    "--source-report-primary-border": "var(--accent)",
    "--source-report-primary-bg": "var(--accent)",
    "--source-report-primary-hover-bg": "var(--accent-hover)",
    "--source-report-primary-shadow": "var(--shadow-sm)",
} satisfies SourceReportStyleVariables;

export const SOURCE_REPORT_SKELETON_CLASS_NAME = "bg-muted";

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
    "flex flex-col gap-0 [&[hidden]]:hidden";

export const SOURCE_REPORT_STATE_STACK_CLASS_NAME = "flex flex-col gap-3.5";

export const SOURCE_REPORT_METRIC_CARDS_CLASS_NAME =
    "grid grid-cols-4 gap-[8px] max-[1200px]:grid-cols-2";

export const SOURCE_REPORT_METRIC_CARD_CLASS_NAME =
    "gap-[6px] overflow-visible rounded-[10px] border-border bg-muted/40 px-[12px] py-[10px] shadow-none backdrop-blur-none";

export const SOURCE_REPORT_CARD_LABEL_CLASS_NAME =
    "text-[10.5px] font-semibold leading-[normal] uppercase tracking-[0.06em] text-muted-foreground";

export const SOURCE_REPORT_CARD_VALUE_CLASS_NAME =
    "text-[13px] font-semibold leading-[normal] text-foreground";

export const SOURCE_REPORT_CARD_SOURCE_VALUE_CLASS_NAME =
    "flex items-center gap-1.5";

export const SOURCE_REPORT_CARD_NUMBER_VALUE_CLASS_NAME =
    "font-mono text-[16px] font-semibold leading-[normal] text-foreground";

export const SOURCE_REPORT_CARD_SOURCE_ICON_CLASS_NAME =
    "size-[14px] flex-none rounded-[3px] object-contain";

export const SOURCE_REPORT_CARD_SOURCE_FALLBACK_CLASS_NAME =
    "text-[11px] font-bold text-muted-foreground";

export const SOURCE_REPORT_SECTION_CLASS_NAME =
    "flex flex-col gap-[8px] border-t border-border pt-[8px]";

export const SOURCE_REPORT_SECTION_SEPARATOR_CLASS_NAME = "hidden";

export const SOURCE_REPORT_SECTION_HEADER_CLASS_NAME =
    "flex items-baseline gap-[10px]";

export const SOURCE_REPORT_SECTION_TITLE_CLASS_NAME =
    "m-0 ![font-size:12.5px] ![letter-spacing:0] ![line-height:normal] font-semibold text-foreground";

export const SOURCE_REPORT_DESCRIPTION_CLASS_NAME =
    "text-[11.5px] font-medium leading-[normal] text-muted-foreground";

export const SOURCE_REPORT_MISSING_NOTICE_CLASS_NAME =
    "block rounded-[10px] border border-border bg-muted/40 px-[12px] py-[10px] text-[12.5px]/[1.55] font-medium text-muted-foreground";

export const SOURCE_REPORT_TRANSCRIPT_MISSING_NOTICE_CLASS_NAME = `${SOURCE_REPORT_MISSING_NOTICE_CLASS_NAME} mt-[8px]`;

export const SOURCE_REPORT_SUMMARY_MISSING_NOTICE_CLASS_NAME = `${SOURCE_REPORT_MISSING_NOTICE_CLASS_NAME} mb-[8px]`;

export const SOURCE_REPORT_SUMMARY_BODY_CLASS_NAME = "flex flex-col gap-1.5";

export const SOURCE_REPORT_SEGMENTS_CLASS_NAME =
    "m-0 flex list-none flex-col gap-0.5 p-0";

export const SOURCE_REPORT_SEGMENT_CLASS_NAME =
    "grid grid-cols-[96px_56px_1fr] items-start gap-2.5 rounded-[6px] bg-transparent px-2.5 py-2 hover:bg-muted/60";

export const SOURCE_REPORT_SEGMENT_SKELETON_CONTAINER_CLASS_NAME =
    "block px-2.5 py-2";

export const SOURCE_REPORT_SEGMENT_TIME_CLASS_NAME =
    "font-mono text-[11.5px] font-medium text-muted-foreground";

export const SOURCE_REPORT_SEGMENT_SPEAKER_CLASS_NAME =
    "text-[12px] font-semibold text-muted-foreground";

export const SOURCE_REPORT_SEGMENT_TEXT_CLASS_NAME =
    "m-0 text-[12.5px]/[1.55] font-medium text-foreground [text-wrap:pretty]";

export const SOURCE_REPORT_SUMMARY_TEXT_CLASS_NAME =
    "m-0 whitespace-pre-wrap text-[12.5px]/[1.55] font-medium text-foreground [text-wrap:pretty]";

export const SOURCE_REPORT_META_CLASS_NAME =
    "my-[15px] grid grid-cols-2 gap-x-[14px] gap-y-[6px] max-[1200px]:grid-cols-1";

export const SOURCE_REPORT_META_ROW_CLASS_NAME =
    "grid min-h-[30px] grid-cols-[80px_1fr] items-baseline gap-[8px] border-b border-dashed border-border py-[6px]";

export const SOURCE_REPORT_META_LABEL_CLASS_NAME =
    "m-0 text-[11px] font-semibold leading-[normal] text-muted-foreground";

export const SOURCE_REPORT_META_VALUE_CLASS_NAME =
    "m-0 break-words text-[12px] font-medium leading-[normal] text-foreground";

export const SOURCE_REPORT_META_MONO_VALUE_CLASS_NAME = "font-mono";

export const SOURCE_REPORT_ACTION_ROW_CLASS_NAME =
    "mt-[4px] flex flex-wrap items-center gap-[8px]";

export const SOURCE_REPORT_ACTION_BUTTON_CLASS_NAME = "text-foreground";

export const SOURCE_REPORT_PRIMARY_ACTION_BUTTON_CLASS_NAME =
    "h-[26px] gap-[7px] rounded-[7px] px-[10px] text-[12px] font-semibold leading-[normal] text-primary-foreground shadow-sm has-[>svg]:px-[10px] hover:text-primary-foreground";

export const SOURCE_REPORT_GHOST_ACTION_BUTTON_CLASS_NAME =
    "h-[26px] gap-[7px] rounded-[7px] border border-transparent bg-transparent px-[10px] text-[12px] font-semibold leading-[normal] text-muted-foreground shadow-none has-[>svg]:px-[10px] hover:bg-accent hover:text-accent-foreground";

export const SOURCE_REPORT_COPY_BUTTON_VARIANT =
    "ghost" satisfies ButtonProps["variant"];

export const SOURCE_REPORT_COPY_BUTTON_SIZE =
    "sm" satisfies ButtonProps["size"];

export const SOURCE_REPORT_COPY_BUTTON_CLASS_NAME =
    "h-[26px] gap-[6px] rounded-[7px] px-[10px] text-[12px] font-semibold leading-normal text-muted-foreground has-[>svg]:px-[10px] hover:bg-accent hover:text-accent-foreground [&[hidden]]:hidden [&_svg:not([class*='size-'])]:size-[14px] data-[copy-state=ok]:border-chart-3/30 data-[copy-state=ok]:bg-chart-3/10 data-[copy-state=ok]:text-chart-3 data-[copy-state=ok]:hover:bg-chart-3/10 data-[copy-state=ok]:hover:text-chart-3 data-[copy-state=err]:border-destructive/30 data-[copy-state=err]:text-destructive data-[copy-state=err]:hover:bg-transparent data-[copy-state=err]:hover:text-destructive";

export const SOURCE_REPORT_EMPTY_ACTION_ROW_CLASS_NAME =
    "mt-2 flex flex-wrap items-center gap-1.5";

export const SOURCE_REPORT_ERROR_ALERT_CLASS_NAME =
    "flex w-full flex-col items-center gap-2 rounded-lg px-4 py-8 text-center text-sm [&>svg]:text-current";

export const SOURCE_REPORT_EMPTY_SURFACE_CLASS_NAME =
    "flex flex-col items-center gap-1 rounded-[10px] border border-dashed border-border bg-muted/40 px-[18px] py-7 text-center shadow-none backdrop-blur-none data-[sot-tone=err]:border-destructive/30 data-[sot-tone=err]:bg-destructive/10";

export const SOURCE_REPORT_EMPTY_HEADER_CLASS_NAME = "gap-1";

export const SOURCE_REPORT_EMPTY_ICON_CLASS_NAME =
    "mb-1 inline-grid size-10 place-items-center rounded-full border border-border bg-muted text-muted-foreground [&_svg]:fill-none [&_svg]:stroke-current [&_svg]:stroke-[1.8] [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round] [&_svg:not([class*='size-'])]:size-4";

export const SOURCE_REPORT_EMPTY_ERROR_ICON_CLASS_NAME =
    "border-destructive/30 bg-destructive/10 text-destructive";

export const SOURCE_REPORT_EMPTY_TITLE_CLASS_NAME =
    "m-0 block min-h-0 overflow-visible text-[13px]/[1.35] font-semibold tracking-normal text-foreground";

export const SOURCE_REPORT_EMPTY_DESCRIPTION_CLASS_NAME =
    "block max-w-[360px] text-[12px]/[1.5] font-medium tracking-normal text-muted-foreground";

export const SOURCE_REPORT_COPY_LABEL_CLASS_NAME =
    "inline-flex min-w-0 items-center";

export const SOURCE_REPORT_COPY_ICON_CLASS_NAME =
    "stroke-current transition-[opacity,transform] duration-200 ease-out";

export const SOURCE_REPORT_STATUS_BADGE_CLASS_NAME =
    "h-[22px] min-w-[65px] justify-normal gap-[9px] overflow-visible rounded-full border px-[8px] py-0 text-[11px] font-semibold leading-[normal] shadow-none data-[sot-tone=err]:border-destructive/30 data-[sot-tone=err]:bg-destructive/10 data-[sot-tone=err]:text-destructive data-[sot-tone=neu]:border-border data-[sot-tone=neu]:bg-muted data-[sot-tone=neu]:text-muted-foreground data-[sot-tone=ok]:border-chart-3/30 data-[sot-tone=ok]:bg-chart-3/10 data-[sot-tone=ok]:text-chart-3 data-[sot-tone=warn]:border-chart-4/30 data-[sot-tone=warn]:bg-chart-4/10 data-[sot-tone=warn]:text-chart-4 [&_[data-sot-part=dashboard-source-report-status-dot]]:mr-0 [&_[data-sot-part=dashboard-source-report-status-dot]]:inline-block [&_[data-sot-part=dashboard-source-report-status-dot]]:size-[5px] [&_[data-sot-part=dashboard-source-report-status-dot]]:rounded-full [&_[data-sot-part=dashboard-source-report-status-dot]]:bg-current [&_[data-sot-part=source-report-status-dot]]:mr-0 [&_[data-sot-part=source-report-status-dot]]:inline-block [&_[data-sot-part=source-report-status-dot]]:size-[5px] [&_[data-sot-part=source-report-status-dot]]:rounded-full [&_[data-sot-part=source-report-status-dot]]:bg-current";
