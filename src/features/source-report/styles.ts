export type SourceReportTone = "err" | "neu" | "ok" | "warn";

export type SourceReportCardSkeletonSize = "count" | "source" | "status";

export type SourceReportSegmentSkeletonSize =
    | "line-long"
    | "line-medium"
    | "line-short"
    | "line-wide"
    | "speaker"
    | "time";

export type SourceReportMetaSurface = "dashboard" | "recording";
export type SourceReportMetaSpacing = "default" | "loose" | "roomy";
export type SourceReportSubState =
    | "both-missing"
    | "complete"
    | "summary-missing"
    | "transcript-missing";
export type SourceReportSurfaceTone = "danger" | "neutral";

export function sourceReportMetaSpacingForState({
    subState,
    surface,
}: {
    subState?: SourceReportSubState;
    surface: SourceReportMetaSurface;
}): SourceReportMetaSpacing {
    if (surface === "dashboard") {
        if (subState === "complete" || subState === "summary-missing") {
            return "loose";
        }
        if (subState === "transcript-missing" || subState === "both-missing") {
            return "roomy";
        }
        return "default";
    }

    if (subState === "transcript-missing" || subState === "summary-missing") {
        return "loose";
    }
    if (subState === "both-missing") {
        return "roomy";
    }
    return "default";
}
