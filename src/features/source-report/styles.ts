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
