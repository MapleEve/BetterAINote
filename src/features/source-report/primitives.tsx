import { cva, type VariantProps } from "class-variance-authority";
import { Check, Copy } from "lucide-react";
import type * as React from "react";
import type { ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { ButtonProps } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription } from "@/components/ui/card";
import {
    Empty,
    EmptyDescription,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
    type SourceReportCardSkeletonSize,
    type SourceReportMetaSpacing,
    type SourceReportMetaSurface,
    type SourceReportSegmentSkeletonSize,
    type SourceReportSubState,
    type SourceReportSurfaceTone,
    type SourceReportTone,
    sourceReportMetaSpacingForState,
} from "./styles";

export type {
    SourceReportCardSkeletonSize,
    SourceReportMetaSpacing,
    SourceReportMetaSurface,
    SourceReportSegmentSkeletonSize,
    SourceReportSubState,
    SourceReportSurfaceTone,
    SourceReportTone,
};

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

type SourceReportCopyKind = "source-report" | "source-transcript";
type SourceReportEmptySurfaceKind = "alert" | "empty";

const sourceReportCardSkeletonClasses = {
    count: "inline-block h-[18px] w-[48px] align-middle rounded-[6px]",
    source: "inline-block h-[18px] w-[120px] align-middle rounded-[6px]",
    status: "inline-block h-[18px] w-[80px] align-middle rounded-[6px]",
} as const satisfies Record<SourceReportCardSkeletonSize, string>;

const sourceReportSegmentSkeletonClasses = {
    "line-long":
        "mt-[6px] inline-block h-[13px] w-[92%] align-middle rounded-[4px]",
    "line-medium":
        "mt-[6px] inline-block h-[13px] w-[76%] align-middle rounded-[4px]",
    "line-short":
        "mt-[6px] inline-block h-[13px] w-[60%] align-middle rounded-[4px]",
    "line-wide":
        "mt-[6px] inline-block h-[13px] w-[88%] align-middle rounded-[4px]",
    speaker:
        "ml-[5px] inline-block h-[12px] w-[54px] align-middle rounded-[4px]",
    time: "inline-block h-[12px] w-[96px] align-middle rounded-[4px]",
} as const satisfies Record<SourceReportSegmentSkeletonSize, string>;

const sourceReportMetaSpacingClasses = {
    default: "mb-[13px]",
    loose: "mb-[15px]",
    roomy: "mb-[22px]",
} as const satisfies Record<SourceReportMetaSpacing, string>;

const sourceReportPaneBase = "flex flex-col gap-3.5";
const sourceReportDescriptionText =
    "font-sans text-[11.5px] font-medium leading-[normal] text-[var(--fg-tertiary)]";
const sourceReportStateStackBase = "flex flex-col gap-3.5";
const sourceReportStateBase = "block [&[hidden]]:hidden";

const sourceReportCopyIconBase =
    "stroke-current transition-[opacity,transform] duration-200 ease-out";
const sourceReportCopyLabelBase = "inline-flex min-w-0 items-center";

const sourceReportMetricGridBase =
    "grid grid-cols-[repeat(4,1fr)] gap-[8px] max-[1200px]:grid-cols-[repeat(2,1fr)]";
const sourceReportMetricCardBase =
    "gap-[6px] overflow-visible rounded-[10px] border border-[var(--line-hairline)] bg-[var(--bg-recessed)] px-[12px] py-[10px] shadow-none backdrop-blur-none [[data-theme=dark]_&]:border-[var(--glass-border-soft)] [[data-theme=dark]_&]:bg-[var(--glass-tint-subtle)] [.dark_&]:border-[var(--glass-border-soft)] [.dark_&]:bg-[var(--glass-tint-subtle)]";
const sourceReportMetricLabelText =
    "font-sans text-[10.5px] font-semibold leading-[normal] tracking-[0.06em] text-[var(--fg-tertiary)] uppercase";
const sourceReportMetricValueText =
    "font-sans text-[13px] font-semibold leading-[normal] text-foreground";
const sourceReportMetricNumberText =
    "font-mono text-[16px] font-semibold leading-[normal] text-foreground";
const sourceReportSourceValueLayout = "flex items-center gap-[6px]";
const sourceReportSourceIconMedia =
    "size-[14px] flex-none rounded-[3px] object-contain";
const sourceReportSourceFallbackText =
    "text-[11px] font-bold text-muted-foreground";

const sourceReportSectionBase =
    "flex flex-col gap-[8px] border-t border-[var(--line-hairline)] pt-[8px] [[data-theme=dark]_&]:border-[var(--glass-border-soft)] [.dark_&]:border-[var(--glass-border-soft)]";
const sourceReportSectionHeaderLayout = "flex items-baseline gap-[10px]";
const sourceReportSectionSeparatorLayout = "hidden";
const sourceReportSectionTitleText =
    "m-0 font-sans ![font-size:12.5px] font-semibold ![line-height:normal] ![letter-spacing:var(--ls-h4)] !text-foreground";
const sourceReportMissingNoticeBase =
    "block rounded-[10px] border-[var(--alert-warning-soft-strong-border)] bg-[var(--alert-warning-soft-strong-bg)] px-[12px] py-[10px] text-[12.5px] font-medium leading-[1.55] text-[var(--fg-secondary)] shadow-none";
const sourceReportMissingNoticeDescriptionText =
    "col-start-auto block gap-0 text-[12.5px] font-medium leading-[1.55] text-[var(--fg-secondary)]";

const sourceReportMetaListBase =
    "mt-[15px] grid grid-cols-2 gap-x-[14px] gap-y-[6px] max-[1200px]:grid-cols-1";
const sourceReportMetaRowBase =
    "grid grid-cols-[80px_1fr] items-baseline gap-[8px] border-b border-dashed border-[var(--line-hairline)] py-[6px] [[data-theme=dark]_&]:border-[var(--glass-border-soft)] [.dark_&]:border-[var(--glass-border-soft)]";
const sourceReportMetaLabelText =
    "m-0 font-sans text-[11px] font-semibold leading-[normal] text-[var(--fg-tertiary)]";
const sourceReportMetaValueText =
    "m-0 break-words font-sans text-[12px] font-medium leading-[normal] text-foreground";

const sourceReportSegmentsListBase =
    "m-0 flex list-none flex-col gap-[2px] p-0";
const sourceReportSegmentBase =
    "grid grid-cols-[96px_56px_1fr] items-start gap-[10px] rounded-[6px] bg-transparent px-[10px] py-[8px]";
const sourceReportSegmentSkeletonBase =
    "block rounded-[6px] bg-transparent px-[10px] py-[8px]";
const sourceReportSegmentTimeText =
    "font-mono text-[11.5px] font-medium leading-[normal] text-[var(--fg-tertiary)]";
const sourceReportSegmentSpeakerText =
    "font-sans text-[12px] font-semibold leading-[normal] text-[var(--fg-secondary)]";
const sourceReportSegmentBodyText =
    "m-0 font-sans ![font-size:12.5px] font-medium ![line-height:1.55] !tracking-normal !text-foreground [text-wrap:pretty]";
const sourceReportSummaryStack = "flex flex-col gap-1.5";
const sourceReportSummaryLineText =
    "m-0 whitespace-pre-wrap font-sans ![font-size:12.5px] font-medium ![line-height:1.55] !tracking-normal !text-foreground [text-wrap:pretty]";

const sourceReportErrorAlertBase =
    "flex w-full flex-col items-center gap-[4px] rounded-[10px] px-[18px] py-[28px]";
const sourceReportEmptyTitleText =
    "m-0 block min-h-0 overflow-visible font-sans text-[13px] font-semibold leading-[1.35] tracking-normal text-foreground";
const sourceReportEmptyDescriptionText =
    "block max-w-[360px] font-sans text-[12px] font-medium leading-[1.5] tracking-normal text-muted-foreground ![color:var(--fg-tertiary)]";

const sourceReportStatusDotBase =
    "inline-block size-[5px] rounded-[50%] bg-current";

function sourceReportMetaClasses({
    spacing = "default",
    subState,
    surface,
}: {
    spacing?: SourceReportMetaSpacing;
    subState?: SourceReportSubState;
    surface?: SourceReportMetaSurface;
}) {
    return cn(
        sourceReportMetaListBase,
        sourceReportMetaSpacingClasses[
            surface
                ? sourceReportMetaSpacingForState({ surface, subState })
                : spacing
        ],
    );
}

export function SourceReportPane({
    children,
    className,
    hidden,
    state,
    surface = "recording",
    variant = "card",
    ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
    children: ReactNode;
    state?: string;
    surface?: "dashboard" | "recording";
    variant?: "card" | "embedded";
}) {
    if (surface === "dashboard") {
        return (
            <div
                className={cn(sourceReportPaneBase, className)}
                data-sot-source-report-pane
                data-sot-panel="dashboard-source-report"
                data-sot-tab-pane="source-report"
                data-sot-state={state}
                data-tab-pane="source-report"
                hidden={hidden}
                {...props}
            >
                {children}
            </div>
        );
    }

    return (
        <Card
            hasNoPadding
            className={cn(
                sourceReportPaneBase,
                "min-h-0 overflow-hidden px-5 pt-4 pb-6",
                className,
            )}
            data-sot-source-report-pane
            data-sot-panel="recording-source-report"
            data-sot-state={state}
            data-sot-variant={variant}
            hidden={hidden}
            {...props}
        >
            {children}
        </Card>
    );
}

export function SourceReportDescription({ children }: { children: ReactNode }) {
    return (
        <CardDescription
            className={sourceReportDescriptionText}
            data-sot-source-report-description
        >
            {children}
        </CardDescription>
    );
}

export function SourceReportStateStack({ children }: { children: ReactNode }) {
    return (
        <CardContent
            className={cn("px-0", sourceReportStateStackBase)}
            data-sot-source-report-state-stack
        >
            {children}
        </CardContent>
    );
}

export function SourceReportStatusDot({
    part = "source-report-status-dot",
}: {
    part?: SourceReportStatusDotPart;
}) {
    return (
        <span
            className={sourceReportStatusDotBase}
            data-sot-part={part}
            aria-hidden="true"
        />
    );
}

export function DashboardSourceReportStatusDot() {
    return <SourceReportStatusDot part="dashboard-source-report-status-dot" />;
}

const SOURCE_REPORT_STATUS_VARIANT = {
    err: "destructive",
    neu: "secondary",
    ok: "default",
    warn: "outline",
} as const satisfies Record<
    SourceReportTone,
    React.ComponentProps<typeof Badge>["variant"]
>;

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
            variant={SOURCE_REPORT_STATUS_VARIANT[tone]}
            className={cn(
                "h-[22px] justify-normal gap-[5px] overflow-visible px-[8px] py-0",
                className,
            )}
            data-sot-badge="source-report-status"
            data-sot-tone={tone}
        >
            {children}
        </Badge>
    );
}

export function SourceReportCopyIcon({
    part = "source-report-copy-icon",
    state,
}: {
    part?: string;
    state?: "err" | "ok";
}) {
    const Icon = state === "ok" ? Check : Copy;

    return (
        <Icon
            className={sourceReportCopyIconBase}
            data-icon="inline-start"
            data-sot-part={part}
            aria-hidden="true"
        />
    );
}

export function SourceReportCopyLabel({
    children,
    part = "source-report-copy-label",
}: {
    children: ReactNode;
    part?: string;
}) {
    return (
        <span className={sourceReportCopyLabelBase} data-sot-part={part}>
            {children}
        </span>
    );
}

type SourceReportCopyFeedbackState = "err" | "idle" | "ok";

const sourceReportCopyButtonVariant = {
    err: "destructive",
    idle: "ghost",
    ok: "secondary",
} as const satisfies Record<
    SourceReportCopyFeedbackState,
    ButtonProps["variant"]
>;

function sourceReportCopyButtonVariantForState(
    feedbackState: SourceReportCopyFeedbackState,
): ButtonProps["variant"] {
    return sourceReportCopyButtonVariant[feedbackState];
}

export function SourceReportCopyButton({
    children,
    copy,
    copyState,
    feedbackState,
    tabScope = "source-report",
    ...props
}: Omit<ButtonProps, "className" | "size" | "variant"> & {
    children: ReactNode;
    copy: SourceReportCopyKind;
    copyState: string;
    feedbackState?: "err" | "ok";
    tabScope?: string;
}) {
    return (
        <Button
            variant={sourceReportCopyButtonVariantForState(
                feedbackState ?? "idle",
            )}
            size="xs"
            data-copy={copy}
            data-copy-state={feedbackState}
            data-sot-control={
                copy === "source-report"
                    ? "copy-source-report"
                    : "copy-source-transcript"
            }
            data-sot-state={copyState}
            data-tab-scope={tabScope}
            {...props}
        >
            {children}
        </Button>
    );
}

type SourceReportActionIntent = "ghost" | "outline" | "primary";

const sourceReportActionButtonVariant = {
    ghost: "ghost",
    outline: "outline",
    primary: "default",
} as const satisfies Record<SourceReportActionIntent, ButtonProps["variant"]>;

function sourceReportButtonVariantForIntent(
    intent: SourceReportActionIntent,
): ButtonProps["variant"] {
    return sourceReportActionButtonVariant[intent];
}

export function SourceReportActionButton({
    children,
    control,
    intent = "ghost",
    state,
    ...props
}: Omit<ButtonProps, "className" | "size" | "variant"> & {
    children: ReactNode;
    control?: string;
    intent?: SourceReportActionIntent;
    state?: string;
}) {
    return (
        <Button
            variant={sourceReportButtonVariantForIntent(intent)}
            size="xs"
            className={cn(intent === "primary" && "min-w-[46px]")}
            data-sot-control={control}
            data-sot-state={state}
            {...props}
        >
            {children}
        </Button>
    );
}

const sourceReportActionRowStyles = cva("flex flex-wrap items-center", {
    variants: {
        purpose: {
            default: "mt-[4px] gap-[8px]",
            empty: "mt-[8px] justify-center gap-[6px]",
        },
        align: {
            center: "justify-center",
            start: "",
        },
    },
    defaultVariants: {
        align: "start",
        purpose: "default",
    },
});

type SourceReportActionRowAlign = NonNullable<
    VariantProps<typeof sourceReportActionRowStyles>["align"]
>;
type SourceReportActionRowPurpose = NonNullable<
    VariantProps<typeof sourceReportActionRowStyles>["purpose"]
>;

export function SourceReportActionRow({
    align = "start",
    children,
    purpose = "default",
}: {
    align?: SourceReportActionRowAlign;
    children: ReactNode;
    purpose?: SourceReportActionRowPurpose;
}) {
    return (
        <div
            className={sourceReportActionRowStyles({ align, purpose })}
            data-sot-source-report-actions={
                purpose === "default" ? "" : undefined
            }
            data-sot-source-report-empty-actions={
                purpose === "empty" ? "" : undefined
            }
        >
            {children}
        </div>
    );
}

export function SourceReportMetricCards({ children }: { children: ReactNode }) {
    return (
        <div
            className={sourceReportMetricGridBase}
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
            className={sourceReportMetricCardBase}
            data-sot-card="source-report-metric"
            data-sot-metric={metric}
        >
            <div
                className={sourceReportMetricLabelText}
                data-sot-part="source-report-card-label"
            >
                {label}
            </div>
            {value === "skeleton" ? (
                children
            ) : (
                <div
                    className={cn(
                        sourceReportMetricValueText,
                        value === "source" && sourceReportSourceValueLayout,
                        value === "number" && sourceReportMetricNumberText,
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

export function SourceReportSourceIdentity({
    fallback,
    icon,
    label,
}: {
    fallback: string;
    icon?: string | null;
    label: string;
}) {
    return (
        <>
            {icon ? (
                // biome-ignore lint/performance/noImgElement: source cards render provider asset nodes directly.
                <img
                    className={sourceReportSourceIconMedia}
                    src={icon}
                    alt=""
                />
            ) : (
                <span
                    className={sourceReportSourceFallbackText}
                    data-sot-part="source-report-card-source-fallback"
                >
                    {fallback}
                </span>
            )}
            <span>{label}</span>
        </>
    );
}

export function SourceReportCardSkeleton({
    size,
}: {
    size: SourceReportCardSkeletonSize;
}) {
    return (
        <Skeleton
            variant="shimmer"
            size="default"
            className={sourceReportCardSkeletonClasses[size]}
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
            variant="shimmer"
            size="default"
            className={sourceReportSegmentSkeletonClasses[size]}
            aria-hidden="true"
            data-sot-part="source-report-segment-skeleton"
            data-sot-size={size}
        />
    );
}

export function SourceReportSegmentSkeletonBlock({
    children,
}: {
    children: ReactNode;
}) {
    return (
        <div
            className={sourceReportSegmentSkeletonBase}
            data-sot-source-report-segment
            data-sot-state="skeleton"
        >
            {children}
        </div>
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
            className={sourceReportStateBase}
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
            className={cn(sourceReportSectionBase, className)}
            data-sot-source-report-section
            data-sot-section={section}
        >
            <Separator
                className={sourceReportSectionSeparatorLayout}
                data-sot-source-report-section-separator
            />
            {noticeBefore}
            <header
                className={sourceReportSectionHeaderLayout}
                data-sot-source-report-section-header
            >
                <h4
                    className={sourceReportSectionTitleText}
                    data-sot-source-report-section-title
                >
                    {title}
                </h4>
                <span
                    className={sourceReportDescriptionText}
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
            className={cn(
                sourceReportMissingNoticeBase,
                state === "summary-missing" ? "mb-2" : "mt-2",
            )}
            data-sot-source-report-missing-notice
            data-sot-missing={state}
            density="compact"
            layout="inline"
        >
            <AlertDescription
                className={sourceReportMissingNoticeDescriptionText}
            >
                {children}
            </AlertDescription>
        </Alert>
    );
}

export function SourceReportMetaList({
    children,
    spacing = "default",
    subState,
    surface,
}: {
    children: ReactNode;
    spacing?: SourceReportMetaSpacing;
    subState?: SourceReportSubState;
    surface?: SourceReportMetaSurface;
}) {
    return (
        <dl
            className={sourceReportMetaClasses({ spacing, subState, surface })}
            data-sot-source-report-meta
        >
            {children}
        </dl>
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
            className={sourceReportMetaRowBase}
            data-sot-source-report-meta-row
        >
            <dt className={sourceReportMetaLabelText}>{label}</dt>
            <dd className={sourceReportMetaValueText}>
                {valueFormat ? (
                    <span
                        className={"font-mono"}
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

export function SourceReportSegments({
    children,
    hidden,
}: {
    children: ReactNode;
    hidden?: boolean;
}) {
    return (
        <ol
            className={sourceReportSegmentsListBase}
            data-sot-source-report-segments
            hidden={hidden}
        >
            {children}
        </ol>
    );
}

export function SourceReportSegment({
    children,
    speaker,
    time,
}: {
    children: ReactNode;
    speaker: ReactNode;
    time: ReactNode;
}) {
    return (
        <li className={sourceReportSegmentBase} data-sot-source-report-segment>
            <span
                className={sourceReportSegmentTimeText}
                data-sot-source-report-segment-time
                data-sot-format="mono"
            >
                {time}
            </span>
            <span
                className={sourceReportSegmentSpeakerText}
                data-sot-source-report-segment-speaker
            >
                {speaker}
            </span>
            <p
                className={sourceReportSegmentBodyText}
                data-sot-source-report-segment-text
            >
                {children}
            </p>
        </li>
    );
}

export function SourceReportSummaryBody({ children }: { children: ReactNode }) {
    return (
        <div
            className={sourceReportSummaryStack}
            data-sot-source-report-summary-body
        >
            {children}
        </div>
    );
}

export function SourceReportSummaryLine({ children }: { children: ReactNode }) {
    return (
        <p
            className={sourceReportSummaryLineText}
            data-sot-source-report-segment-text
        >
            {children}
        </p>
    );
}

const sourceReportEmptySurfaceStyles = cva(
    "flex flex-col items-center gap-[4px] rounded-[10px] border border-dashed border-[var(--line-hairline)] bg-[var(--bg-recessed)] px-[18px] py-[28px] text-center shadow-none backdrop-blur-none",
    {
        variants: {
            tone: {
                danger: "border-[var(--alert-destructive-soft-border)] bg-[var(--alert-destructive-subtle-bg)] text-[var(--fg-primary)]",
                neutral: "",
            } satisfies Record<SourceReportSurfaceTone, string>,
        },
        defaultVariants: {
            tone: "neutral",
        },
    },
);

export function SourceReportEmptySurface({
    children,
    kind = "empty",
    tone = "neutral",
}: {
    children: ReactNode;
    kind?: SourceReportEmptySurfaceKind;
    tone?: SourceReportSurfaceTone;
}) {
    if (kind === "alert") {
        return (
            <Alert
                variant="statusError"
                className={cn(
                    sourceReportErrorAlertBase,
                    sourceReportEmptySurfaceStyles({ tone }),
                )}
                data-sot-source-report-empty
                data-sot-tone={tone === "danger" ? "err" : "neutral"}
            >
                {children}
            </Alert>
        );
    }

    return (
        <Empty
            variant={null}
            className={sourceReportEmptySurfaceStyles({ tone })}
            data-sot-source-report-empty
            data-sot-tone={tone === "danger" ? "err" : "neutral"}
        >
            {children}
        </Empty>
    );
}

const sourceReportEmptyIconStyles = cva(
    "mb-[4px] inline-grid size-[40px] place-items-center rounded-full border border-[var(--line-hairline)] bg-[var(--bg-recessed)] text-[var(--fg-tertiary)] [&_svg]:fill-none [&_svg]:stroke-current [&_svg]:stroke-[1.8] [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round] [&_svg:not([class*='size-'])]:size-[16px]",
    {
        variants: {
            tone: {
                danger: "border-[var(--alert-destructive-icon-soft-border)] bg-[var(--alert-destructive-icon-soft-bg)] text-[var(--signal-danger)]",
                neutral: "",
            } satisfies Record<SourceReportSurfaceTone, string>,
        },
        defaultVariants: {
            tone: "neutral",
        },
    },
);

export function SourceReportEmptyIcon({
    children,
    tone = "neutral",
}: {
    children: ReactNode;
    tone?: SourceReportSurfaceTone;
}) {
    return (
        <EmptyMedia
            variant="icon"
            className={sourceReportEmptyIconStyles({ tone })}
            data-sot-source-report-empty-icon
            aria-hidden="true"
        >
            {children}
        </EmptyMedia>
    );
}

export function SourceReportEmptyTitle({
    children,
    kind = "empty",
}: {
    children: ReactNode;
    kind?: SourceReportEmptySurfaceKind;
}) {
    if (kind === "alert") {
        return (
            <AlertTitle
                className={sourceReportEmptyTitleText}
                data-sot-source-report-empty-title
            >
                {children}
            </AlertTitle>
        );
    }

    return (
        <EmptyTitle
            className={sourceReportEmptyTitleText}
            data-sot-source-report-empty-title
        >
            {children}
        </EmptyTitle>
    );
}

export function SourceReportEmptyDescription({
    children,
    kind = "empty",
}: {
    children: ReactNode;
    kind?: SourceReportEmptySurfaceKind;
}) {
    if (kind === "alert") {
        return (
            <AlertDescription
                className={sourceReportEmptyDescriptionText}
                data-sot-source-report-empty-description
            >
                {children}
            </AlertDescription>
        );
    }

    return (
        <EmptyDescription
            className={sourceReportEmptyDescriptionText}
            data-sot-source-report-empty-description
        >
            {children}
        </EmptyDescription>
    );
}
