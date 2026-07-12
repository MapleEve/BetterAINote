import Image from "next/image";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const routeFallbackShellClassName =
    "flex h-screen min-h-screen bg-background text-foreground transition-all duration-300 ease-out";
const routeFallbackSidebarClassName =
    "relative flex w-64 shrink-0 min-w-0 flex-col overflow-hidden rounded-none border-r border-border bg-card px-3 pb-3 pt-4 text-card-foreground shadow-sm max-lg:pointer-events-none max-lg:w-0 max-lg:border-r-0 max-lg:px-0 max-lg:opacity-0";
const routeFallbackBrandClassName = "flex items-center gap-2.5 px-2 pb-4 pt-1";
const routeFallbackBrandImageClassName = "size-9 rounded-lg";
const routeFallbackBrandTextClassName = "min-w-0";
const routeFallbackBrandNameClassName =
    "truncate text-sm font-semibold text-foreground";
const routeFallbackBrandSubtitleClassName =
    "mt-0.5 truncate text-xs font-medium text-muted-foreground";
const routeFallbackMainClassName =
    "flex h-screen min-w-0 flex-1 flex-col bg-background";
const routeFallbackTopbarClassName =
    "relative flex h-14 flex-none items-center gap-3.5 border-b border-border bg-background/80 px-5 py-3 shadow-none backdrop-blur-xl backdrop-saturate-150 max-lg:box-border max-lg:min-w-0 max-lg:max-w-full";
const routeFallbackCrumbsClassName =
    "flex min-w-0 items-center gap-2 text-sm font-medium text-muted-foreground";
const routeFallbackCrumbCurrentClassName =
    "truncate font-semibold text-foreground";
const routeFallbackWorkspaceClassName =
    "flex min-h-0 flex-1 gap-4 px-5 pb-5 pt-4 max-lg:box-border max-lg:min-w-0 max-lg:max-w-full max-lg:flex-col";
const routeFallbackWorkspaceSingleClassName =
    "flex min-h-0 flex-1 flex-col px-5 pb-5 pt-4 max-lg:box-border max-lg:min-w-0 max-lg:max-w-full";

const routeFallbackSurfaceClassName =
    "min-h-0 gap-0 overflow-hidden rounded-2xl border-border bg-card shadow-sm backdrop-blur-none";

const recordingDetailLoadingSkeletonClassNames = {
    recordingDetailLoadingAvatar: "size-8 rounded-full",
    recordingDetailLoadingBar: "h-2 w-20 rounded",
    recordingDetailLoadingBar60: "h-2 w-3/5 rounded",
    recordingDetailLoadingBar90: "h-2 w-11/12 rounded",
} as const;

const routeFallbackEmptyDetailClassName = cn(
    routeFallbackSurfaceClassName,
    "flex min-w-0 flex-col gap-4",
);
const routeFallbackEmptyPanelClassName =
    "min-h-72 flex-1 border-0 bg-transparent px-6 py-9 shadow-none md:px-6 md:py-9";
const routeFallbackEmptyIconClassName =
    "mb-1 size-12 rounded-full border border-border bg-muted text-muted-foreground";
const routeFallbackEmptyTitleClassName =
    "text-sm font-semibold tracking-normal text-foreground";
const routeFallbackEmptyDescriptionClassName =
    "max-w-xs text-sm text-muted-foreground";

type RouteFallbackChromeProps = {
    "aria-busy"?: boolean;
    children: ReactNode;
    className?: string;
    current: string;
    dataSotShell: string;
    workspaceClassName?: string;
    workspaceVariant?: "split" | "single";
};

function RouteFallbackChrome({
    "aria-busy": ariaBusy,
    children,
    className,
    current,
    dataSotShell,
    workspaceClassName,
    workspaceVariant = "split",
}: RouteFallbackChromeProps) {
    return (
        <div
            data-sot-shell={dataSotShell}
            aria-busy={ariaBusy}
            className={cn(routeFallbackShellClassName, className)}
        >
            <aside
                data-sot-panel="route-sidebar"
                className={routeFallbackSidebarClassName}
            >
                <div
                    data-sot-part="route-brand"
                    className={routeFallbackBrandClassName}
                >
                    <Image
                        src="/assets/logo-mark-steel.svg"
                        alt=""
                        width={36}
                        height={36}
                        className={routeFallbackBrandImageClassName}
                    />
                    <div
                        data-sot-part="route-brand-text"
                        className={routeFallbackBrandTextClassName}
                    >
                        <div
                            data-sot-part="route-brand-name"
                            className={routeFallbackBrandNameClassName}
                        >
                            BetterAINote
                        </div>
                        <div
                            data-sot-part="route-brand-subtitle"
                            className={routeFallbackBrandSubtitleClassName}
                        >
                            私人工作空间
                        </div>
                    </div>
                </div>
            </aside>
            <main
                data-sot-panel="route-main"
                className={routeFallbackMainClassName}
            >
                <header
                    data-sot-panel="route-topbar"
                    className={routeFallbackTopbarClassName}
                >
                    <div
                        data-sot-part="route-crumbs"
                        className={routeFallbackCrumbsClassName}
                    >
                        <span
                            data-sot-part="route-crumb-current"
                            className={routeFallbackCrumbCurrentClassName}
                        >
                            {current}
                        </span>
                    </div>
                </header>
                <div
                    data-sot-panel="route-workspace"
                    className={cn(
                        workspaceVariant === "single"
                            ? routeFallbackWorkspaceSingleClassName
                            : routeFallbackWorkspaceClassName,
                        workspaceClassName,
                    )}
                >
                    {children}
                </div>
            </main>
        </div>
    );
}

type RouteFallbackEmptyStateProps = {
    actions: ReactNode;
    description: string;
    icon: ReactNode;
    title: string;
};

function RouteFallbackEmptyState({
    actions,
    description,
    icon,
    title,
}: RouteFallbackEmptyStateProps) {
    return (
        <Card
            data-sot-panel="recording-route-empty-detail"
            data-empty="true"
            variant="default"
            hasNoPadding
            className={routeFallbackEmptyDetailClassName}
        >
            <Empty
                data-sot-panel="recording-route-empty"
                variant="default"
                className={routeFallbackEmptyPanelClassName}
            >
                <EmptyHeader>
                    <EmptyMedia
                        data-sot-part="recording-route-empty-icon"
                        aria-hidden="true"
                        variant="icon"
                        className={routeFallbackEmptyIconClassName}
                    >
                        {icon}
                    </EmptyMedia>
                    <EmptyTitle
                        data-sot-part="recording-route-empty-title"
                        className={routeFallbackEmptyTitleClassName}
                    >
                        {title}
                    </EmptyTitle>
                    <EmptyDescription
                        data-sot-part="recording-route-empty-description"
                        className={routeFallbackEmptyDescriptionClassName}
                    >
                        {description}
                    </EmptyDescription>
                </EmptyHeader>
                <EmptyContent data-sot-actions="recording-error">
                    {actions}
                </EmptyContent>
            </Empty>
        </Card>
    );
}

type RouteFallbackDetailLoadingSkeletonProps = {
    "data-sot-panel": string;
};

function RouteFallbackDetailLoadingSkeleton({
    "data-sot-panel": dataSotPanel,
}: RouteFallbackDetailLoadingSkeletonProps) {
    return (
        <Card
            data-sot-panel={dataSotPanel}
            variant="default"
            hasNoPadding
            className={cn(
                routeFallbackSurfaceClassName,
                "flex min-h-0 min-w-0 flex-col gap-4",
                "flex-1",
            )}
        >
            <div
                data-sot-panel="recording-detail-loading"
                aria-hidden="true"
                className="flex min-h-0 flex-1 flex-col gap-3.5"
            >
                <div
                    data-sot-part="detail-player-meta"
                    className="mb-3 flex items-center gap-2.5"
                >
                    <Skeleton
                        data-sot-part="detail-avatar"
                        variant="default"
                        size="default"
                        className={
                            recordingDetailLoadingSkeletonClassNames.recordingDetailLoadingAvatar
                        }
                    />
                    <Skeleton
                        data-sot-part="detail-bar"
                        variant="default"
                        size="default"
                        className={
                            recordingDetailLoadingSkeletonClassNames.recordingDetailLoadingBar
                        }
                    />
                </div>
                <div
                    data-sot-part="detail-player-controls"
                    className="flex items-center gap-3"
                >
                    <Skeleton
                        data-sot-part="detail-bar"
                        variant="default"
                        size="default"
                        className={
                            recordingDetailLoadingSkeletonClassNames.recordingDetailLoadingBar
                        }
                    />
                    <Skeleton
                        data-sot-part="detail-bar"
                        data-sot-size="60"
                        variant="default"
                        size="default"
                        className={
                            recordingDetailLoadingSkeletonClassNames.recordingDetailLoadingBar60
                        }
                    />
                </div>
                <div
                    data-sot-part="detail-transcript-head"
                    className="flex items-center border-b border-border px-3.5 py-3"
                >
                    <Skeleton
                        data-sot-part="detail-bar"
                        variant="default"
                        size="default"
                        className={
                            recordingDetailLoadingSkeletonClassNames.recordingDetailLoadingBar
                        }
                    />
                </div>
                <div
                    data-sot-part="detail-transcript"
                    className="min-h-0 flex-1"
                >
                    <Skeleton
                        data-sot-part="detail-bar"
                        data-sot-size="90"
                        variant="default"
                        size="default"
                        className={
                            recordingDetailLoadingSkeletonClassNames.recordingDetailLoadingBar90
                        }
                    />
                </div>
            </div>
        </Card>
    );
}

export {
    RouteFallbackChrome,
    RouteFallbackDetailLoadingSkeleton,
    RouteFallbackEmptyState,
    routeFallbackSurfaceClassName,
};
