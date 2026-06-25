import type { CSSProperties } from "react";

type SourceReportStyleVariables = CSSProperties & {
    [key in `--source-report-${string}`]?: string;
};

export const SOURCE_REPORT_STYLE_VARIABLES = {
    "--source-report-metric-bg": "var(--card-popover-footer-bg)",
    "--source-report-metric-border": "var(--card-elevated-border)",
    "--source-report-status-ok-fg": "oklch(0.62 0.13 158)",
    "--source-report-status-ok-bg":
        "color-mix(in srgb, var(--source-report-status-ok-fg) 14%, transparent)",
    "--source-report-status-ok-border":
        "color-mix(in srgb, var(--source-report-status-ok-fg) 30%, transparent)",
    "--source-report-status-warn-bg":
        "color-mix(in srgb, var(--signal-warning) 18%, transparent)",
    "--source-report-status-warn-border":
        "color-mix(in srgb, var(--signal-warning) 32%, transparent)",
    "--source-report-status-warn-fg": "oklch(0.55 0.16 70)",
    "--source-report-status-err-bg":
        "color-mix(in srgb, var(--signal-danger) 14%, transparent)",
    "--source-report-status-err-border":
        "color-mix(in srgb, var(--signal-danger) 30%, transparent)",
    "--source-report-skeleton-bg":
        "linear-gradient(90deg, color-mix(in srgb, var(--fg-primary) 5%, transparent) 0%, color-mix(in srgb, var(--fg-primary) 10%, transparent) 50%, color-mix(in srgb, var(--fg-primary) 5%, transparent) 100%)",
    "--source-report-primary-border":
        "color-mix(in srgb, var(--accent) 60%, black 8%)",
    "--source-report-primary-bg":
        "linear-gradient(180deg, color-mix(in srgb, var(--accent) 92%, white 18%), var(--accent))",
    "--source-report-primary-hover-bg":
        "linear-gradient(180deg, color-mix(in srgb, var(--accent) 96%, white 8%), var(--accent))",
    "--source-report-primary-shadow":
        "0 2px 6px color-mix(in srgb, var(--accent) 24%, transparent), inset 0 1px 0 rgb(255 255 255 / 0.22)",
} satisfies SourceReportStyleVariables;

export const SOURCE_REPORT_SKELETON_CLASS_NAME =
    "![background-color:transparent] [background-image:var(--source-report-skeleton-bg)] dark:[background-image:linear-gradient(90deg,rgb(255_255_255_/_0.05)_0%,rgb(255_255_255_/_0.12)_50%,rgb(255_255_255_/_0.05)_100%)] [background-size:220%_100%]";

export const SOURCE_REPORT_PANE_CLASS_NAME = "flex flex-col gap-3.5";

export const SOURCE_REPORT_STATE_CLASS_NAME =
    "flex flex-col gap-0 [&[hidden]]:hidden";

export const SOURCE_REPORT_STATE_STACK_CLASS_NAME = "flex flex-col gap-3.5";

export const SOURCE_REPORT_METRIC_CARDS_CLASS_NAME =
    "grid grid-cols-4 gap-2 max-[1200px]:grid-cols-2";

export const SOURCE_REPORT_METRIC_CARD_CLASS_NAME =
    "gap-[6px] overflow-visible rounded-[10px] border-[var(--source-report-metric-border)] bg-[var(--source-report-metric-bg)] px-[12px] py-[10px] shadow-none backdrop-blur-none";

export const SOURCE_REPORT_CARD_LABEL_CLASS_NAME =
    "text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-tertiary)]";

export const SOURCE_REPORT_CARD_VALUE_CLASS_NAME =
    "text-[13px] font-semibold text-[var(--fg-primary)]";

export const SOURCE_REPORT_CARD_SOURCE_VALUE_CLASS_NAME =
    "flex items-center gap-1.5";

export const SOURCE_REPORT_CARD_NUMBER_VALUE_CLASS_NAME =
    "font-mono text-[16px] font-semibold text-[var(--fg-primary)]";

export const SOURCE_REPORT_CARD_SOURCE_ICON_CLASS_NAME =
    "size-[14px] flex-none rounded-[3px] object-contain";

export const SOURCE_REPORT_CARD_SOURCE_FALLBACK_CLASS_NAME =
    "text-[11px] font-bold text-[var(--fg-tertiary)]";

export const SOURCE_REPORT_SECTION_CLASS_NAME =
    "flex flex-col gap-2 border-t border-[var(--line-hairline)] pt-2 dark:border-[var(--glass-border-soft)]";

export const SOURCE_REPORT_SECTION_SEPARATOR_CLASS_NAME = "hidden";

export const SOURCE_REPORT_SECTION_HEADER_CLASS_NAME =
    "flex items-baseline gap-2.5";

export const SOURCE_REPORT_SECTION_TITLE_CLASS_NAME =
    "m-0 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--fg-primary)]";

export const SOURCE_REPORT_DESCRIPTION_CLASS_NAME =
    "text-[11.5px] font-medium text-[var(--fg-tertiary)]";

export const SOURCE_REPORT_SUMMARY_BODY_CLASS_NAME = "flex flex-col gap-1.5";

export const SOURCE_REPORT_SEGMENTS_CLASS_NAME =
    "m-0 flex list-none flex-col gap-0.5 p-0";

export const SOURCE_REPORT_SEGMENT_CLASS_NAME =
    "grid grid-cols-[96px_56px_1fr] items-start gap-2.5 rounded-[6px] bg-transparent px-2.5 py-2 hover:bg-[var(--bg-recessed)] dark:hover:bg-[rgb(255_255_255_/_0.03)]";

export const SOURCE_REPORT_SEGMENT_SKELETON_CONTAINER_CLASS_NAME =
    "block px-2.5 py-2";

export const SOURCE_REPORT_SEGMENT_TIME_CLASS_NAME =
    "font-mono text-[11.5px] font-medium text-[var(--fg-tertiary)]";

export const SOURCE_REPORT_SEGMENT_SPEAKER_CLASS_NAME =
    "text-[12px] font-semibold text-[var(--fg-secondary)]";

export const SOURCE_REPORT_SEGMENT_TEXT_CLASS_NAME =
    "m-0 text-[12.5px]/[1.55] font-medium text-[var(--fg-primary)] [text-wrap:pretty]";

export const SOURCE_REPORT_SUMMARY_TEXT_CLASS_NAME =
    "m-0 whitespace-pre-wrap text-[12.5px]/[1.55] font-medium text-[var(--fg-primary)] [text-wrap:pretty]";

export const SOURCE_REPORT_META_CLASS_NAME =
    "my-4 grid grid-cols-2 gap-x-3.5 gap-y-1.5 max-[1200px]:grid-cols-1";

export const SOURCE_REPORT_META_ROW_CLASS_NAME =
    "grid min-h-[30px] grid-cols-[80px_1fr] items-baseline gap-2 border-b border-dashed border-[var(--line-hairline)] py-1.5 dark:border-[var(--glass-border-soft)]";

export const SOURCE_REPORT_META_LABEL_CLASS_NAME =
    "m-0 text-[11px] font-semibold text-[var(--fg-tertiary)]";

export const SOURCE_REPORT_META_VALUE_CLASS_NAME =
    "m-0 break-words text-[12px] font-medium text-[var(--fg-primary)]";

export const SOURCE_REPORT_META_MONO_VALUE_CLASS_NAME = "font-mono";

export const SOURCE_REPORT_ACTION_ROW_CLASS_NAME =
    "mt-1 flex flex-wrap items-center gap-2";

export const SOURCE_REPORT_EMPTY_ACTION_ROW_CLASS_NAME =
    "mt-2 flex flex-wrap items-center gap-1.5";

export const SOURCE_REPORT_EMPTY_SURFACE_CLASS_NAME =
    "flex flex-col items-center gap-1 rounded-[10px] border border-dashed border-[var(--line-hairline)] bg-[var(--bg-recessed)] px-[18px] py-7 text-center shadow-none backdrop-blur-none dark:border-[var(--glass-border-soft)] data-[sot-tone=err]:border-[color-mix(in_srgb,var(--signal-danger)_26%,transparent)] data-[sot-tone=err]:bg-[color-mix(in_srgb,var(--signal-danger)_6%,transparent)]";

export const SOURCE_REPORT_EMPTY_HEADER_CLASS_NAME = "gap-1";

export const SOURCE_REPORT_EMPTY_ICON_CLASS_NAME =
    "mb-1 inline-grid size-10 place-items-center rounded-full border border-[var(--line-hairline)] bg-[var(--bg-recessed)] text-[var(--fg-tertiary)] [&_svg]:fill-none [&_svg]:stroke-current [&_svg]:stroke-[1.8] [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round] [&_svg:not([class*='size-'])]:size-4";

export const SOURCE_REPORT_EMPTY_ERROR_ICON_CLASS_NAME =
    "border-[color-mix(in_srgb,var(--signal-danger)_28%,transparent)] bg-[color-mix(in_srgb,var(--signal-danger)_14%,transparent)] text-[var(--signal-danger)]";

export const SOURCE_REPORT_EMPTY_TITLE_CLASS_NAME =
    "m-0 block min-h-0 overflow-visible text-[13px]/[1.35] font-semibold tracking-normal text-[var(--fg-primary)]";

export const SOURCE_REPORT_EMPTY_DESCRIPTION_CLASS_NAME =
    "block max-w-[360px] text-[12px]/[1.5] font-medium tracking-normal text-[var(--fg-tertiary)]";

export const SOURCE_REPORT_COPY_LABEL_CLASS_NAME =
    "inline-flex min-w-0 items-center";

export const SOURCE_REPORT_COPY_ICON_CLASS_NAME =
    "stroke-current transition-[opacity,transform] duration-200 ease-out";
