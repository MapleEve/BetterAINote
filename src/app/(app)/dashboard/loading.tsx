import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
    RouteFallbackChrome,
    RouteFallbackDetailLoadingSkeleton,
    routeFallbackSurfaceClassName,
} from "../route-chrome";

const dashboardRouteLoadingListClassName = routeFallbackSurfaceClassName;

const recordingListLoadingSkeletonClassNames = {
    recordingListLoadingDayLabel: "h-[11px] w-[100px]",
    recordingListLoadingMetaPill: "h-[18px] w-16 rounded-full",
    recordingListLoadingMetaTag: "h-[18px] w-16 rounded-[6px]",
    recordingListLoadingMetaTime: "h-[11px] w-20",
    recordingListLoadingTag: "h-[22px] w-20 rounded-[6px]",
    recordingListLoadingTitle: "h-[13px] w-full",
    recordingListLoadingTitle80: "h-[13px] w-4/5",
} as const;

export default function DashboardLoading() {
    return (
        <RouteFallbackChrome
            dataSotShell="dashboard-loading"
            current="加载中"
            aria-busy={true}
        >
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
                            className="h-px flex-1 bg-border"
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
            <RouteFallbackDetailLoadingSkeleton data-sot-panel="dashboard-loading-detail" />
        </RouteFallbackChrome>
    );
}
