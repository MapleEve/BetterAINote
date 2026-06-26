import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const routeLoadingSurfaceClassName =
    "min-h-0 gap-0 overflow-hidden rounded-[16px] border-[var(--line-hairline)] bg-[var(--bg-elevated)] shadow-[var(--shadow-sm)] backdrop-blur-none dark:border-[var(--glass-border)]";
const dashboardRouteLoadingShellClassName =
    "grid h-screen min-h-[720px] grid-cols-[264px_1fr] transition-[grid-template-columns] duration-[320ms] ease-[var(--ease-out)]";
const dashboardRouteLoadingListClassName = routeLoadingSurfaceClassName;
const dashboardRouteLoadingDetailClassName = cn(
    routeLoadingSurfaceClassName,
    "flex min-h-0 min-w-0 flex-col gap-4",
);

const recordingListLoadingSkeletonClassNames = {
    recordingListLoadingDayLabel: "h-[11px] w-[100px]",
    recordingListLoadingMetaPill: "h-[18px] w-16 rounded-full",
    recordingListLoadingMetaTag: "h-[18px] w-16 rounded-[6px]",
    recordingListLoadingMetaTime: "h-[11px] w-20",
    recordingListLoadingTag: "h-[22px] w-20 rounded-[6px]",
    recordingListLoadingTitle: "h-[13px] w-full",
    recordingListLoadingTitle80: "h-[13px] w-4/5",
} as const;

const recordingDetailLoadingSkeletonClassNames = {
    recordingDetailLoadingAvatar: "size-8 rounded-full",
    recordingDetailLoadingBar: "h-2 w-20 rounded-[4px]",
    recordingDetailLoadingBar60: "h-2 w-3/5 rounded-[4px]",
    recordingDetailLoadingBar90: "h-2 w-[90%] rounded-[4px]",
} as const;

export default function DashboardLoading() {
    return (
        <div
            data-sot-shell="dashboard-loading"
            aria-busy="true"
            className={dashboardRouteLoadingShellClassName}
        >
            <aside data-sot-panel="route-sidebar">
                <div data-sot-part="route-brand">
                    <img src="/assets/logo-mark-steel.svg" alt="" />
                    <div data-sot-part="route-brand-text">
                        <div data-sot-part="route-brand-name">BetterAINote</div>
                        <div data-sot-part="route-brand-subtitle">
                            私人工作空间
                        </div>
                    </div>
                </div>
            </aside>
            <main data-sot-panel="route-main">
                <header data-sot-panel="route-topbar">
                    <div data-sot-part="route-crumbs">
                        <span data-sot-part="route-crumb-current">加载中</span>
                    </div>
                </header>
                <div data-sot-panel="route-workspace">
                    <Card
                        data-sot-panel="dashboard-loading-list"
                        variant="default"
                        hasNoPadding
                        className={dashboardRouteLoadingListClassName}
                    >
                        <div
                            data-sot-panel="recording-list-loading"
                            aria-hidden="true"
                            className="flex flex-col gap-0.5 p-1"
                        >
                            <div
                                data-sot-part="skeleton-day"
                                className="flex items-center gap-2.5 px-2.5 pb-1.5 pt-3.5"
                            >
                                <Skeleton
                                    data-sot-part="skeleton-day-label"
                                    variant="default"
                                    size="default"
                                    className={
                                        recordingListLoadingSkeletonClassNames.recordingListLoadingDayLabel
                                    }
                                />
                                <span
                                    data-sot-part="skeleton-day-line"
                                    className="h-px flex-1 bg-[var(--line-hairline)]"
                                />
                            </div>
                            <div
                                data-sot-part="skeleton-row"
                                className="grid grid-cols-[1fr_auto] items-center gap-3.5 px-3 py-[11px]"
                            >
                                <div
                                    data-sot-part="skeleton-row-body"
                                    className="flex min-w-0 flex-col gap-1.5"
                                >
                                    <Skeleton
                                        data-sot-part="skeleton-title"
                                        variant="default"
                                        size="default"
                                        className={
                                            recordingListLoadingSkeletonClassNames.recordingListLoadingTitle
                                        }
                                    />
                                    <div
                                        data-sot-part="skeleton-meta"
                                        className="flex items-center gap-2"
                                    >
                                        <Skeleton
                                            data-sot-part="skeleton-meta-time"
                                            variant="default"
                                            size="default"
                                            className={
                                                recordingListLoadingSkeletonClassNames.recordingListLoadingMetaTime
                                            }
                                        />
                                        <Skeleton
                                            data-sot-part="skeleton-meta-tag"
                                            variant="default"
                                            size="default"
                                            className={
                                                recordingListLoadingSkeletonClassNames.recordingListLoadingMetaTag
                                            }
                                        />
                                    </div>
                                </div>
                                <div data-sot-part="skeleton-row-tail">
                                    <Skeleton
                                        data-sot-part="skeleton-tag"
                                        variant="default"
                                        size="default"
                                        className={
                                            recordingListLoadingSkeletonClassNames.recordingListLoadingTag
                                        }
                                    />
                                </div>
                            </div>
                            <div
                                data-sot-part="skeleton-row"
                                className="grid grid-cols-[1fr_auto] items-center gap-3.5 px-3 py-[11px]"
                            >
                                <div
                                    data-sot-part="skeleton-row-body"
                                    className="flex min-w-0 flex-col gap-1.5"
                                >
                                    <Skeleton
                                        data-sot-part="skeleton-title"
                                        data-sot-size="80"
                                        variant="default"
                                        size="default"
                                        className={
                                            recordingListLoadingSkeletonClassNames.recordingListLoadingTitle80
                                        }
                                    />
                                    <div
                                        data-sot-part="skeleton-meta"
                                        className="flex items-center gap-2"
                                    >
                                        <Skeleton
                                            data-sot-part="skeleton-meta-time"
                                            variant="default"
                                            size="default"
                                            className={
                                                recordingListLoadingSkeletonClassNames.recordingListLoadingMetaTime
                                            }
                                        />
                                        <Skeleton
                                            data-sot-part="skeleton-meta-tag"
                                            variant="default"
                                            size="default"
                                            className={
                                                recordingListLoadingSkeletonClassNames.recordingListLoadingMetaTag
                                            }
                                        />
                                        <Skeleton
                                            data-sot-part="skeleton-meta-pill"
                                            variant="default"
                                            size="default"
                                            className={
                                                recordingListLoadingSkeletonClassNames.recordingListLoadingMetaPill
                                            }
                                        />
                                    </div>
                                </div>
                                <div data-sot-part="skeleton-row-tail" />
                            </div>
                        </div>
                    </Card>
                    <Card
                        data-sot-panel="dashboard-loading-detail"
                        variant="default"
                        hasNoPadding
                        className={dashboardRouteLoadingDetailClassName}
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
                                className="flex items-center border-b border-[var(--line-hairline)] px-3.5 py-3 dark:border-[var(--glass-border-soft)]"
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
                </div>
            </main>
        </div>
    );
}
