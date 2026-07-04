import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
    RouteFallbackChrome,
    routeFallbackSurfaceClassName,
} from "../route-chrome";

const dashboardRouteLoadingListClassName = routeFallbackSurfaceClassName;
const dashboardRouteLoadingDetailClassName = cn(
    routeFallbackSurfaceClassName,
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
        </RouteFallbackChrome>
    );
}
