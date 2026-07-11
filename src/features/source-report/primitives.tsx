import { Check, Copy } from "lucide-react";
import type * as React from "react";
import type { ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { ButtonProps } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

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

type SourceReportStateName = "empty" | "error" | "loaded" | "loading";
type SourceReportStateTestId =
    | "dashboard-source-report-state"
    | "recording-source-report-state";
type SourceReportSectionName = "metadata" | "summary" | "transcript";
type SourceReportMetricName =
    | "segment-count"
    | "source"
    | "summary-status"
    | "transcript-status";
type SourceReportCopyKind = "source-report" | "source-transcript";
type SourceReportEmptySurfaceKind = "alert" | "empty";
type SourceReportCopyFeedbackState = "err" | "idle" | "ok";
type SourceReportActionIntent = "ghost" | "outline" | "primary";
type SourceReportActionRowAlign = "center" | "start";
type SourceReportActionRowPurpose = "default" | "empty";

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
    const testId =
        surface === "dashboard"
            ? "dashboard-source-report"
            : "recording-source-report";
    const commonClassName = cn(
        "flex min-w-0 flex-col gap-4",
        variant === "embedded" &&
            "rounded-none border-0 bg-transparent p-0 shadow-none",
        className,
    );

    if (surface === "dashboard") {
        return (
            <div
                className={commonClassName}
                data-testid={testId}
                data-state={state}
                aria-busy={state === "loading"}
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
                "min-h-0 overflow-hidden rounded-lg p-4 shadow-none",
                commonClassName,
            )}
            data-testid={testId}
            data-state={state}
            aria-busy={state === "loading"}
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
            className="break-words font-medium text-muted-foreground"
            data-testid="source-report-description"
        >
            {children}
        </CardDescription>
    );
}

export function SourceReportStateStack({ children }: { children: ReactNode }) {
    return (
        <CardContent
            className="flex min-w-0 flex-col gap-4 px-0"
            data-testid="source-report-state-stack"
        >
            {children}
        </CardContent>
    );
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
    const variant =
        tone === "err"
            ? "destructive"
            : tone === "ok"
              ? "default"
              : tone === "warn"
                ? "outline"
                : "secondary";

    return (
        <Badge
            variant={variant}
            className={cn("max-w-full", className)}
            data-testid="source-report-status"
            data-state={tone}
        >
            <span
                className="size-1.5 shrink-0 rounded-full bg-current"
                aria-hidden="true"
            />
            <span className="min-w-0 break-words whitespace-normal">
                {children}
            </span>
        </Badge>
    );
}

export function SourceReportCopyIcon({ state }: { state?: "err" | "ok" }) {
    const Icon = state === "ok" ? Check : Copy;

    return (
        <Icon
            className="stroke-current transition-opacity duration-200 ease-out"
            data-icon="inline-start"
            data-testid="source-report-copy-icon"
            aria-hidden="true"
        />
    );
}

export function SourceReportCopyLabel({ children }: { children: ReactNode }) {
    return (
        <span
            className="inline-flex min-w-0 items-center"
            data-testid="source-report-copy-label"
        >
            {children}
        </span>
    );
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
    const state: SourceReportCopyFeedbackState = feedbackState ?? "idle";
    const variant =
        state === "err"
            ? "destructive"
            : state === "ok"
              ? "secondary"
              : "ghost";

    return (
        <Button
            variant={variant}
            size="xs"
            data-testid={`source-report-copy-${copy}`}
            data-state={feedbackState ?? copyState}
            data-tab-scope={tabScope}
            {...props}
        >
            {children}
        </Button>
    );
}

export function SourceReportActionButton({
    children,
    intent = "ghost",
    state,
    testId,
    ...props
}: Omit<ButtonProps, "className" | "size" | "variant"> & {
    children: ReactNode;
    intent?: SourceReportActionIntent;
    state?: string;
    testId?: string;
}) {
    const variant = intent === "primary" ? "default" : intent;

    return (
        <Button
            variant={variant}
            size="xs"
            className={intent === "primary" ? "min-w-12" : undefined}
            data-testid={testId}
            data-state={state}
            {...props}
        >
            {children}
        </Button>
    );
}

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
            className={cn(
                "flex flex-wrap items-center",
                purpose === "empty" ? "mt-2 gap-1.5" : "mt-1 gap-2",
                (align === "center" || purpose === "empty") && "justify-center",
            )}
            data-testid={
                purpose === "empty"
                    ? "source-report-empty-actions"
                    : "source-report-actions"
            }
        >
            {children}
        </div>
    );
}

export function SourceReportMetricCards({ children }: { children: ReactNode }) {
    return (
        <div
            className="grid min-w-0 grid-cols-2 gap-2 xl:grid-cols-4"
            data-testid="source-report-metrics"
        >
            {children}
        </div>
    );
}

export function SourceReportMetricCard({
    children,
    className,
    label,
    metric,
    value,
    ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
    children: ReactNode;
    label: string;
    metric: SourceReportMetricName;
    value?: "number" | "skeleton" | "source";
}) {
    return (
        <Card
            hasNoPadding
            className={cn(
                "min-w-0 gap-1.5 overflow-hidden rounded-lg bg-muted/40 p-3 shadow-none backdrop-blur-none",
                className,
            )}
            data-testid={`source-report-metric-${metric}`}
            data-state={value}
            {...props}
        >
            <CardHeader className="p-0">
                <CardDescription className="text-xs font-semibold text-muted-foreground">
                    {label}
                </CardDescription>
            </CardHeader>
            <CardContent className="min-w-0 p-0">
                {value === "skeleton" ? (
                    children
                ) : (
                    <CardTitle
                        className={cn(
                            "min-w-0 break-words text-sm",
                            value === "source" && "flex items-center gap-1.5",
                            value === "number" && "font-mono text-base",
                        )}
                    >
                        {children}
                    </CardTitle>
                )}
            </CardContent>
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
                // biome-ignore lint/performance/noImgElement: provider assets are static public files.
                <img
                    className="size-3.5 shrink-0 rounded-sm object-contain"
                    src={icon}
                    width={14}
                    height={14}
                    alt=""
                />
            ) : (
                <span
                    className="shrink-0 text-xs font-bold text-muted-foreground"
                    aria-hidden="true"
                >
                    {fallback}
                </span>
            )}
            <span className="min-w-0 break-words">{label}</span>
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
            className={cn(
                "inline-block h-4 align-middle",
                size === "count" && "w-12",
                size === "source" && "w-28",
                size === "status" && "w-20",
            )}
            aria-hidden="true"
            data-testid="source-report-card-skeleton"
            data-state={size}
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
            className={cn(
                "inline-block h-3 align-middle",
                size.startsWith("line-") && "mt-1.5",
                size === "line-long" && "w-11/12",
                size === "line-medium" && "w-3/4",
                size === "line-short" && "w-3/5",
                size === "line-wide" && "w-5/6",
                size === "speaker" && "ml-1 w-14",
                size === "time" && "w-24",
            )}
            aria-hidden="true"
            data-testid="source-report-segment-skeleton"
            data-state={size}
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
            className="block min-w-0 rounded-md px-2.5 py-2"
            data-testid="source-report-segment-skeleton-block"
            data-state="loading"
        >
            {children}
        </div>
    );
}

export function SourceReportState({
    children,
    state,
    subState,
    testId = "recording-source-report-state",
}: {
    children: ReactNode;
    state: SourceReportStateName;
    subState?: string;
    testId?: SourceReportStateTestId;
}) {
    return (
        <div
            className="block min-w-0 space-y-4"
            data-testid={testId}
            data-state={state}
            data-substate={subState}
            aria-live={state === "error" ? "assertive" : "polite"}
        >
            {children}
        </div>
    );
}

export function DashboardSourceReportState(
    props: Omit<Parameters<typeof SourceReportState>[0], "testId">,
) {
    return (
        <SourceReportState testId="dashboard-source-report-state" {...props} />
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
            className={cn("min-w-0 space-y-2 pt-2", className)}
            data-testid={`source-report-section-${section}`}
        >
            <Separator />
            {noticeBefore}
            <header className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-2.5">
                <h4
                    className="m-0 shrink-0 text-sm font-semibold text-foreground"
                    data-testid="source-report-section-title"
                >
                    {title}
                </h4>
                <span className="min-w-0 break-words text-xs font-medium text-muted-foreground">
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
            className={state === "summary-missing" ? "mb-2" : "mt-2"}
            data-testid={`source-report-missing-${state}`}
            data-state={state}
            density="compact"
            layout="inline"
            variant="warningSoft"
        >
            <AlertDescription density="compact">{children}</AlertDescription>
        </Alert>
    );
}

export function SourceReportMetaList({
    children,
    spacing = "default",
    subState,
}: {
    children: ReactNode;
    spacing?: SourceReportMetaSpacing;
    subState?: SourceReportSubState;
    surface?: SourceReportMetaSurface;
}) {
    return (
        <dl
            className={cn(
                "mt-4 grid min-w-0 grid-cols-1 gap-x-4 gap-y-1 xl:grid-cols-2",
                spacing === "default" && "mb-3",
                spacing === "loose" && "mb-4",
                spacing === "roomy" && "mb-6",
            )}
            data-testid="source-report-meta"
            data-state={subState}
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
            className="grid min-w-0 grid-cols-1 gap-1 border-b border-dashed border-border py-2 sm:grid-cols-3 sm:items-baseline sm:gap-2"
            data-testid="source-report-meta-row"
        >
            <dt className="m-0 font-semibold text-muted-foreground">{label}</dt>
            <dd
                className={cn(
                    "m-0 min-w-0 break-all font-medium text-foreground sm:col-span-2",
                    valueFormat === "mono" && "font-mono",
                )}
            >
                {children}
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
            className="m-0 flex min-w-0 list-none flex-col gap-0.5 p-0"
            data-testid="source-report-segments"
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
        <li
            className="grid min-w-0 grid-cols-1 gap-1 rounded-md px-2.5 py-2 hover:bg-muted/50 sm:grid-cols-12 sm:gap-2.5"
            data-testid="source-report-segment"
        >
            <span className="min-w-0 break-words font-mono font-medium text-muted-foreground sm:col-span-3">
                {time}
            </span>
            <span className="min-w-0 break-words font-semibold text-muted-foreground sm:col-span-2">
                {speaker}
            </span>
            <p className="m-0 min-w-0 break-words font-medium text-foreground sm:col-span-7">
                {children}
            </p>
        </li>
    );
}

export function SourceReportSummaryBody({ children }: { children: ReactNode }) {
    return (
        <div
            className="flex min-w-0 flex-col gap-1.5"
            data-testid="source-report-summary"
        >
            {children}
        </div>
    );
}

export function SourceReportSummaryLine({ children }: { children: ReactNode }) {
    return (
        <p className="m-0 min-w-0 whitespace-pre-wrap break-words font-medium text-foreground">
            {children}
        </p>
    );
}

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
                variant={tone === "danger" ? "statusError" : "default"}
                density="spacious"
                layout="centered"
                data-testid="source-report-empty-surface"
                data-state={tone}
            >
                {children}
            </Alert>
        );
    }

    return (
        <Empty
            variant="subtle"
            data-testid="source-report-empty-surface"
            data-state={tone}
        >
            <EmptyHeader>{children}</EmptyHeader>
        </Empty>
    );
}

export function SourceReportEmptyIcon({
    children,
    tone = "neutral",
}: {
    children: ReactNode;
    tone?: SourceReportSurfaceTone;
}) {
    return (
        <EmptyMedia
            variant={tone === "danger" ? "dangerIcon" : "subtleIcon"}
            data-testid="source-report-empty-icon"
            data-state={tone}
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
            <AlertTitle data-testid="source-report-empty-title">
                {children}
            </AlertTitle>
        );
    }

    return (
        <EmptyTitle variant="compact" data-testid="source-report-empty-title">
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
                density="comfortable"
                className="max-w-sm break-words"
                data-testid="source-report-empty-description"
            >
                {children}
            </AlertDescription>
        );
    }

    return (
        <EmptyDescription
            variant="compact"
            data-testid="source-report-empty-description"
        >
            {children}
        </EmptyDescription>
    );
}
