import Image from "next/image";
import type { ComponentProps, ReactElement, ReactNode } from "react";
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
    "data-panel"?: string;
    "data-shell"?: string;
    children: ReactNode;
    className?: string;
    current: string;
    workspaceClassName?: string;
    workspaceVariant?: "split" | "single";
};

function RouteFallbackChrome({
    "aria-busy": ariaBusy,
    "data-panel": workspacePanel,
    "data-shell": dataShell,
    children,
    className,
    current,
    workspaceClassName,
    workspaceVariant = "split",
}: RouteFallbackChromeProps) {
    return (
        <div
            aria-busy={ariaBusy}
            className={cn(routeFallbackShellClassName, className)}
            data-shell={dataShell}
        >
            <aside className={routeFallbackSidebarClassName}>
                <div className={routeFallbackBrandClassName}>
                    <Image
                        src="/assets/logo-mark-steel.svg"
                        alt=""
                        width={36}
                        height={36}
                        className={routeFallbackBrandImageClassName}
                    />
                    <div className={routeFallbackBrandTextClassName}>
                        <div className={routeFallbackBrandNameClassName}>
                            BetterAINote
                        </div>
                        <div className={routeFallbackBrandSubtitleClassName}>
                            私人工作空间
                        </div>
                    </div>
                </div>
            </aside>
            <main className={routeFallbackMainClassName}>
                <header className={routeFallbackTopbarClassName}>
                    <div className={routeFallbackCrumbsClassName}>
                        <span className={routeFallbackCrumbCurrentClassName}>
                            {current}
                        </span>
                    </div>
                </header>
                <div
                    className={cn(
                        workspaceVariant === "single"
                            ? routeFallbackWorkspaceSingleClassName
                            : routeFallbackWorkspaceClassName,
                        workspaceClassName,
                    )}
                    data-panel={workspacePanel}
                >
                    {children}
                </div>
            </main>
        </div>
    );
}

type RouteFallbackEmptyStateProps = Omit<
    ComponentProps<typeof Card>,
    "children" | "title"
> & {
    actions: ReactNode;
    contentPanel?: ReactElement<ComponentProps<typeof Empty>>;
    description: ReactNode;
    icon: ReactNode;
    title: ReactNode;
};

function RouteFallbackEmptyState({
    actions,
    contentPanel,
    description,
    icon,
    title,
    ...cardProps
}: RouteFallbackEmptyStateProps) {
    return (
        <Card
            {...cardProps}
            variant="default"
            hasNoPadding
            className={cn(
                routeFallbackEmptyDetailClassName,
                cardProps.className,
            )}
        >
            <Empty
                variant="default"
                {...contentPanel?.props}
                className={cn(
                    routeFallbackEmptyPanelClassName,
                    contentPanel?.props.className,
                )}
            >
                <EmptyHeader>
                    <EmptyMedia
                        aria-hidden="true"
                        variant="icon"
                        className={routeFallbackEmptyIconClassName}
                    >
                        {icon}
                    </EmptyMedia>
                    <EmptyTitle className={routeFallbackEmptyTitleClassName}>
                        {title}
                    </EmptyTitle>
                    <EmptyDescription
                        className={routeFallbackEmptyDescriptionClassName}
                    >
                        {description}
                    </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>{actions}</EmptyContent>
            </Empty>
        </Card>
    );
}

type RouteFallbackDetailLoadingSkeletonProps = {
    className?: string;
} & Record<`data-${string}`, string | boolean | undefined>;

function RouteFallbackDetailLoadingSkeleton({
    className,
}: RouteFallbackDetailLoadingSkeletonProps) {
    return (
        <Card
            variant="default"
            hasNoPadding
            className={cn(
                routeFallbackSurfaceClassName,
                "flex min-h-0 min-w-0 flex-col gap-4",
                "flex-1",
                className,
            )}
        >
            <div
                aria-hidden="true"
                className="flex min-h-0 flex-1 flex-col gap-3.5"
            >
                <div className="mb-3 flex items-center gap-2.5">
                    <Skeleton
                        variant="default"
                        size="default"
                        className={
                            recordingDetailLoadingSkeletonClassNames.recordingDetailLoadingAvatar
                        }
                    />
                    <Skeleton
                        variant="default"
                        size="default"
                        className={
                            recordingDetailLoadingSkeletonClassNames.recordingDetailLoadingBar
                        }
                    />
                </div>
                <div className="flex items-center gap-3">
                    <Skeleton
                        variant="default"
                        size="default"
                        className={
                            recordingDetailLoadingSkeletonClassNames.recordingDetailLoadingBar
                        }
                    />
                    <Skeleton
                        variant="default"
                        size="default"
                        className={
                            recordingDetailLoadingSkeletonClassNames.recordingDetailLoadingBar60
                        }
                    />
                </div>
                <div className="flex items-center border-b border-border px-3.5 py-3">
                    <Skeleton
                        variant="default"
                        size="default"
                        className={
                            recordingDetailLoadingSkeletonClassNames.recordingDetailLoadingBar
                        }
                    />
                </div>
                <div className="min-h-0 flex-1">
                    <Skeleton
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
