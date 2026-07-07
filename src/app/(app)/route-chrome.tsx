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

const routeFallbackChromeClassNames = {
    shell: "grid h-screen min-h-[720px] grid-cols-[264px_1fr] bg-background text-foreground transition-[grid-template-columns] duration-300 ease-out max-[860px]:grid-cols-[0px_1fr]",
    sidebar:
        "relative flex min-w-0 flex-col overflow-hidden rounded-none border-r border-border bg-card px-3 pb-3 pt-4 text-card-foreground shadow-sm max-[860px]:pointer-events-none max-[860px]:opacity-0",
    brand: "flex items-center gap-2.5 px-2 pb-4 pt-1",
    brandImage: "size-9 rounded-lg",
    brandText: "min-w-0",
    brandName: "truncate text-sm font-semibold text-foreground",
    brandSubtitle:
        "mt-0.5 truncate text-[11px] font-medium text-muted-foreground",
    main: "flex h-screen min-w-0 flex-col bg-background",
    topbar: "relative flex h-14 flex-none items-center gap-3.5 border-b border-border bg-background/80 px-5 py-3 shadow-none backdrop-blur-[20px] backdrop-saturate-[140%] supports-[backdrop-filter]:bg-background/60 max-[860px]:min-w-0 max-[860px]:max-w-full max-[860px]:box-border",
    crumbs: "flex min-w-0 items-center gap-2 text-sm font-medium text-muted-foreground",
    crumbCurrent: "truncate font-semibold text-foreground",
    workspace:
        "grid min-h-0 flex-1 grid-cols-[380px_1fr] gap-4 px-5 pb-5 pt-4 max-[860px]:min-w-0 max-[860px]:max-w-full max-[860px]:box-border max-[860px]:grid-cols-[minmax(0,1fr)]",
    workspaceSingle:
        "flex min-h-0 flex-1 flex-col px-5 pb-5 pt-4 max-[860px]:min-w-0 max-[860px]:max-w-full max-[860px]:box-border",
} as const;

const routeFallbackSurfaceClassName =
    "min-h-0 gap-0 overflow-hidden rounded-2xl border-border bg-card shadow-sm backdrop-blur-none";

const recordingDetailLoadingSkeletonClassNames = {
    recordingDetailLoadingAvatar: "size-8 rounded-full",
    recordingDetailLoadingBar: "h-2 w-20 rounded-[4px]",
    recordingDetailLoadingBar60: "h-2 w-3/5 rounded-[4px]",
    recordingDetailLoadingBar90: "h-2 w-[90%] rounded-[4px]",
} as const;

const routeFallbackEmptyClassNames = {
    detail: cn(routeFallbackSurfaceClassName, "flex min-w-0 flex-col gap-4"),
    panel: "min-h-[280px] flex-1 border-0 bg-transparent px-6 py-9 shadow-none md:px-6 md:py-9",
    icon: "mb-1 size-12 rounded-full border border-border bg-muted text-muted-foreground",
    title: "text-sm font-semibold tracking-normal text-foreground",
    description: "max-w-xs text-sm text-muted-foreground",
} as const;

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
            className={cn(routeFallbackChromeClassNames.shell, className)}
        >
            <aside
                data-sot-panel="route-sidebar"
                className={routeFallbackChromeClassNames.sidebar}
            >
                <div
                    data-sot-part="route-brand"
                    className={routeFallbackChromeClassNames.brand}
                >
                    <Image
                        src="/assets/logo-mark-steel.svg"
                        alt=""
                        width={36}
                        height={36}
                        className={routeFallbackChromeClassNames.brandImage}
                    />
                    <div
                        data-sot-part="route-brand-text"
                        className={routeFallbackChromeClassNames.brandText}
                    >
                        <div
                            data-sot-part="route-brand-name"
                            className={routeFallbackChromeClassNames.brandName}
                        >
                            BetterAINote
                        </div>
                        <div
                            data-sot-part="route-brand-subtitle"
                            className={
                                routeFallbackChromeClassNames.brandSubtitle
                            }
                        >
                            私人工作空间
                        </div>
                    </div>
                </div>
            </aside>
            <main
                data-sot-panel="route-main"
                className={routeFallbackChromeClassNames.main}
            >
                <header
                    data-sot-panel="route-topbar"
                    className={routeFallbackChromeClassNames.topbar}
                >
                    <div
                        data-sot-part="route-crumbs"
                        className={routeFallbackChromeClassNames.crumbs}
                    >
                        <span
                            data-sot-part="route-crumb-current"
                            className={
                                routeFallbackChromeClassNames.crumbCurrent
                            }
                        >
                            {current}
                        </span>
                    </div>
                </header>
                <div
                    data-sot-panel="route-workspace"
                    className={cn(
                        workspaceVariant === "single"
                            ? routeFallbackChromeClassNames.workspaceSingle
                            : routeFallbackChromeClassNames.workspace,
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
            className={routeFallbackEmptyClassNames.detail}
        >
            <Empty
                data-sot-panel="recording-route-empty"
                variant="default"
                className={routeFallbackEmptyClassNames.panel}
            >
                <EmptyHeader>
                    <EmptyMedia
                        data-sot-part="recording-route-empty-icon"
                        aria-hidden="true"
                        variant="icon"
                        className={routeFallbackEmptyClassNames.icon}
                    >
                        {icon}
                    </EmptyMedia>
                    <EmptyTitle
                        data-sot-part="recording-route-empty-title"
                        className={routeFallbackEmptyClassNames.title}
                    >
                        {title}
                    </EmptyTitle>
                    <EmptyDescription
                        data-sot-part="recording-route-empty-description"
                        className={routeFallbackEmptyClassNames.description}
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
    routeFallbackChromeClassNames,
    routeFallbackSurfaceClassName,
};
