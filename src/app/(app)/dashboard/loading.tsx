import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const routeFallbackSurfaceClassName =
    "min-h-0 gap-0 overflow-hidden rounded-2xl border-border bg-card shadow-sm backdrop-blur-none";
const dashboardRouteLoadingShellClassName =
    "flex h-screen min-h-screen bg-background text-foreground transition-all duration-300 ease-out";
const dashboardRouteLoadingSidebarClassName =
    "relative flex w-64 shrink-0 min-w-0 flex-col overflow-hidden rounded-none border-r border-border bg-card px-3 pb-3 pt-4 text-card-foreground shadow-sm max-lg:pointer-events-none max-lg:w-0 max-lg:border-r-0 max-lg:px-0 max-lg:opacity-0";
const dashboardRouteLoadingMainClassName =
    "flex h-screen min-w-0 flex-1 flex-col bg-background";
const dashboardRouteLoadingTopbarClassName =
    "relative flex h-14 flex-none items-center gap-3.5 border-b border-border bg-background/80 px-5 py-3 shadow-none backdrop-blur-xl backdrop-saturate-150 max-lg:box-border max-lg:min-w-0 max-lg:max-w-full";
const dashboardRouteLoadingWorkspaceClassName =
    "flex min-h-0 flex-1 gap-4 px-5 pb-5 pt-4 max-lg:box-border max-lg:min-w-0 max-lg:max-w-full max-lg:flex-col";

const dashboardRouteLoadingListClassName = cn(
    routeFallbackSurfaceClassName,
    "shrink-0 basis-96 max-lg:basis-auto",
);

const recordingListLoadingDayLabelClassName = "h-3 w-24";
const recordingListLoadingMetaPillClassName = "h-5 w-16 rounded-full";
const recordingListLoadingMetaTagClassName = "h-5 w-16 rounded-md";
const recordingListLoadingMetaTimeClassName = "h-3 w-20";
const recordingListLoadingTagClassName = "h-6 w-20 rounded-md";
const recordingListLoadingTitleClassName = "h-3.5 w-full";
const recordingListLoadingTitle80ClassName = "h-3.5 w-4/5";

export default function DashboardLoading() {
    return (
        <section
            aria-live="polite"
            aria-label="正在加载仪表盘"
            aria-busy={true}
            className="contents"
        >
            <div
                aria-busy={true}
                className={dashboardRouteLoadingShellClassName}
            >
                <aside
                    aria-label="应用导航"
                    className={dashboardRouteLoadingSidebarClassName}
                >
                    <Image
                        src="/assets/logo-mark-steel.svg"
                        alt=""
                        width={36}
                        height={36}
                        unoptimized
                        className="size-9 rounded-lg"
                    />
                </aside>
                <main className={dashboardRouteLoadingMainClassName}>
                    <section aria-label="当前页面" className="contents">
                        <header
                            className={dashboardRouteLoadingTopbarClassName}
                        >
                            <span className="truncate text-sm font-semibold text-foreground">
                                加载中
                            </span>
                        </header>
                    </section>
                    <div className={dashboardRouteLoadingWorkspaceClassName}>
                        <Card
                            variant="default"
                            hasNoPadding
                            className={dashboardRouteLoadingListClassName}
                        >
                            <div
                                aria-hidden="true"
                                className="flex flex-col gap-0.5 p-1"
                            >
                                <div className="flex items-center gap-2.5 px-2.5 pb-1.5 pt-3.5">
                                    <Skeleton
                                        variant="default"
                                        size="default"
                                        className={
                                            recordingListLoadingDayLabelClassName
                                        }
                                    />
                                    <span className="h-px flex-1 bg-border" />
                                </div>
                                <div className="flex items-center gap-3.5 px-3 py-3">
                                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                                        <Skeleton
                                            variant="default"
                                            size="default"
                                            className={
                                                recordingListLoadingTitleClassName
                                            }
                                        />
                                        <div className="flex items-center gap-2">
                                            <Skeleton
                                                variant="default"
                                                size="default"
                                                className={
                                                    recordingListLoadingMetaTimeClassName
                                                }
                                            />
                                            <Skeleton
                                                variant="default"
                                                size="default"
                                                className={
                                                    recordingListLoadingMetaTagClassName
                                                }
                                            />
                                        </div>
                                    </div>
                                    <div className="shrink-0">
                                        <Skeleton
                                            variant="default"
                                            size="default"
                                            className={
                                                recordingListLoadingTagClassName
                                            }
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center gap-3.5 px-3 py-3">
                                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                                        <Skeleton
                                            variant="default"
                                            size="default"
                                            className={
                                                recordingListLoadingTitle80ClassName
                                            }
                                        />
                                        <div className="flex items-center gap-2">
                                            <Skeleton
                                                variant="default"
                                                size="default"
                                                className={
                                                    recordingListLoadingMetaTimeClassName
                                                }
                                            />
                                            <Skeleton
                                                variant="default"
                                                size="default"
                                                className={
                                                    recordingListLoadingMetaTagClassName
                                                }
                                            />
                                            <Skeleton
                                                variant="default"
                                                size="default"
                                                className={
                                                    recordingListLoadingMetaPillClassName
                                                }
                                            />
                                        </div>
                                    </div>
                                    <div />
                                </div>
                            </div>
                        </Card>
                        <DashboardDetailLoadingSkeleton />
                    </div>
                </main>
            </div>
        </section>
    );
}

function DashboardDetailLoadingSkeleton() {
    return (
        <Card
            variant="default"
            hasNoPadding
            className={cn(
                routeFallbackSurfaceClassName,
                "flex min-h-0 min-w-0 flex-col gap-4 flex-1",
            )}
        >
            <div
                aria-hidden="true"
                className="flex min-h-0 flex-1 flex-col gap-3.5"
            >
                <div className="mb-3 flex items-center gap-2.5">
                    <Skeleton className="size-8 rounded-full" />
                    <Skeleton className="h-2 w-20 rounded" />
                </div>
                <div className="flex items-center gap-3">
                    <Skeleton className="h-2 w-20 rounded" />
                    <Skeleton className="h-2 w-3/5 rounded" />
                </div>
                <div className="flex items-center border-b border-border px-3.5 py-3">
                    <Skeleton className="h-2 w-20 rounded" />
                </div>
                <div className="min-h-0 flex-1">
                    <Skeleton className="h-2 w-11/12 rounded" />
                </div>
            </div>
        </Card>
    );
}
