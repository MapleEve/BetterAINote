import type { ReactNode } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
    type SourceReportCardSkeletonSize,
    type SourceReportSegmentSkeletonSize,
    type SourceReportTone,
    sourceReportClassNames,
} from "./styles";

type SourceReportStateName = "empty" | "error" | "loaded" | "loading";
type SourceReportStatePanel =
    | "dashboard-source-report-state"
    | "recording-source-report-state";

type SourceReportSectionName = "metadata" | "summary" | "transcript";
type SourceReportMetricName =
    | "segment-count"
    | "source"
    | "summary-status"
    | "transcript-status";

type SourceReportStatusDotPart =
    | "dashboard-source-report-status-dot"
    | "source-report-status-dot";

function sourceReportStatusBadgeVariant(_tone: SourceReportTone): "outline" {
    return "outline";
}

export function SourceReportStatusDot({
    part = "source-report-status-dot",
}: {
    part?: SourceReportStatusDotPart;
}) {
    return (
        <span
            className={sourceReportClassNames.statusDot}
            data-sot-part={part}
            aria-hidden="true"
        />
    );
}

export function DashboardSourceReportStatusDot() {
    return <SourceReportStatusDot part="dashboard-source-report-status-dot" />;
}

export function SourceReportStatusBadge({
    children,
    className,
    tone,
}: {
    children: ReactNode;
    className?: string;
    tone: SourceReportTone;
}) {
    return (
        <Badge
            variant={sourceReportStatusBadgeVariant(tone)}
            className={cn(sourceReportClassNames.statusBadge, className)}
            data-sot-badge="source-report-status"
            data-sot-tone={tone}
        >
            {children}
        </Badge>
    );
}

export function SourceReportMetricCards({ children }: { children: ReactNode }) {
    return (
        <div
            className={sourceReportClassNames.metricCards}
            data-sot-list="source-report-cards"
        >
            {children}
        </div>
    );
}

export function SourceReportMetricCard({
    children,
    label,
    metric,
    value,
}: {
    children: ReactNode;
    label: string;
    metric: SourceReportMetricName;
    value?: "number" | "skeleton" | "source";
}) {
    return (
        <Card
            hasNoPadding
            className={sourceReportClassNames.metricCard}
            data-sot-card="source-report-metric"
            data-sot-metric={metric}
        >
            <div
                className={sourceReportClassNames.cardLabel}
                data-sot-part="source-report-card-label"
            >
                {label}
            </div>
            {value === "skeleton" ? (
                children
            ) : (
                <div
                    className={cn(
                        sourceReportClassNames.cardValue,
                        value === "source" &&
                            sourceReportClassNames.cardSourceValue,
                        value === "number" &&
                            sourceReportClassNames.cardNumberValue,
                    )}
                    data-sot-part="source-report-card-value"
                    data-sot-value={value}
                >
                    {children}
                </div>
            )}
        </Card>
    );
}

export function SourceReportCardSkeleton({
    size,
}: {
    size: SourceReportCardSkeletonSize;
}) {
    return (
        <Skeleton
            variant="default"
            size="default"
            className={sourceReportClassNames.cardSkeleton[size]}
            aria-hidden="true"
            data-sot-part="source-report-card-skeleton"
            data-sot-size={size}
        />
    );
}

export function SourceReportSegmentSkeleton({
    size,
}: {
    size: SourceReportSegmentSkeletonSize;
}) {
    return (
        <Skeleton
            variant="default"
            size="default"
            className={sourceReportClassNames.segmentSkeleton[size]}
            aria-hidden="true"
            data-sot-part="source-report-segment-skeleton"
            data-sot-size={size}
        />
    );
}

export function SourceReportState({
    children,
    error,
    panel = "recording-source-report-state",
    sotState,
    state,
    subState,
}: {
    children: ReactNode;
    error?: string;
    panel?: SourceReportStatePanel;
    sotState?: string;
    state: SourceReportStateName;
    subState?: string;
}) {
    return (
        <div
            data-sot-source-report-state
            data-sot-panel={panel}
            data-sot-state={sotState ?? state}
            data-state={state}
            data-sub-state={subState}
            data-sot-error={error}
            className={sourceReportClassNames.state}
        >
            {children}
        </div>
    );
}

export function DashboardSourceReportState(
    props: Omit<Parameters<typeof SourceReportState>[0], "panel">,
) {
    return (
        <SourceReportState panel="dashboard-source-report-state" {...props} />
    );
}

export function SourceReportSection({
    children,
    className,
    description,
    noticeAfter,
    noticeBefore,
    section,
    title,
}: {
    children: ReactNode;
    className?: string;
    description: ReactNode;
    noticeAfter?: ReactNode;
    noticeBefore?: ReactNode;
    section: SourceReportSectionName;
    title: string;
}) {
    return (
        <section
            className={cn(sourceReportClassNames.section, className)}
            data-sot-source-report-section
            data-sot-section={section}
        >
            <Separator
                className={sourceReportClassNames.sectionSeparator}
                data-sot-source-report-section-separator
            />
            {noticeBefore}
            <header
                className={sourceReportClassNames.sectionHeader}
                data-sot-source-report-section-header
            >
                <h4
                    className={sourceReportClassNames.sectionTitle}
                    data-sot-source-report-section-title
                >
                    {title}
                </h4>
                <span
                    className={sourceReportClassNames.description}
                    data-sot-source-report-section-description
                >
                    {description}
                </span>
            </header>
            {noticeAfter}
            {children}
        </section>
    );
}

export function SourceReportMissingNotice({
    children,
    state,
}: {
    children: ReactNode;
    state: "summary-missing" | "transcript-missing";
}) {
    return (
        <Alert
            className={sourceReportClassNames.missingNotice}
            data-sot-source-report-missing-notice
            data-sot-missing={state}
            density="compact"
        >
            <AlertDescription
                className={sourceReportClassNames.missingNoticeDescription}
            >
                {children}
            </AlertDescription>
        </Alert>
    );
}

export function SourceReportMetaRow({
    children,
    label,
    valueFormat,
}: {
    children: ReactNode;
    label: string;
    valueFormat?: "mono";
}) {
    return (
        <div
            className={sourceReportClassNames.metaRow}
            data-sot-source-report-meta-row
        >
            <dt className={sourceReportClassNames.metaLabel}>{label}</dt>
            <dd className={sourceReportClassNames.metaValue}>
                {valueFormat ? (
                    <span
                        className={sourceReportClassNames.metaMonoValue}
                        data-sot-source-report-meta-value
                        data-sot-format={valueFormat}
                    >
                        {children}
                    </span>
                ) : (
                    children
                )}
            </dd>
        </div>
    );
}
