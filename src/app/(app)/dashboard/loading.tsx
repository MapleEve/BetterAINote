import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
    RouteFallbackChrome,
    RouteFallbackDetailLoadingSkeleton,
    routeFallbackSurfaceClassName,
} from "../route-chrome";

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
                            className={recordingListLoadingDayLabelClassName}
                        />
                        <span
                            data-sot-part="skeleton-day-line"
                            className="h-px flex-1 bg-border"
                        />
                    </div>
                    <div
                        data-sot-part="skeleton-row"
                        className="flex items-center gap-3.5 px-3 py-3"
                    >
                        <div
                            data-sot-part="skeleton-row-body"
                            className="flex min-w-0 flex-1 flex-col gap-1.5"
                        >
                            <Skeleton
                                data-sot-part="skeleton-title"
                                variant="default"
                                size="default"
                                className={recordingListLoadingTitleClassName}
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
                                        recordingListLoadingMetaTimeClassName
                                    }
                                />
                                <Skeleton
                                    data-sot-part="skeleton-meta-tag"
                                    variant="default"
                                    size="default"
                                    className={
                                        recordingListLoadingMetaTagClassName
                                    }
                                />
                            </div>
                        </div>
                        <div
                            data-sot-part="skeleton-row-tail"
                            className="shrink-0"
                        >
                            <Skeleton
                                data-sot-part="skeleton-tag"
                                variant="default"
                                size="default"
                                className={recordingListLoadingTagClassName}
                            />
                        </div>
                    </div>
                    <div
                        data-sot-part="skeleton-row"
                        className="flex items-center gap-3.5 px-3 py-3"
                    >
                        <div
                            data-sot-part="skeleton-row-body"
                            className="flex min-w-0 flex-1 flex-col gap-1.5"
                        >
                            <Skeleton
                                data-sot-part="skeleton-title"
                                data-sot-size="80"
                                variant="default"
                                size="default"
                                className={recordingListLoadingTitle80ClassName}
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
                                        recordingListLoadingMetaTimeClassName
                                    }
                                />
                                <Skeleton
                                    data-sot-part="skeleton-meta-tag"
                                    variant="default"
                                    size="default"
                                    className={
                                        recordingListLoadingMetaTagClassName
                                    }
                                />
                                <Skeleton
                                    data-sot-part="skeleton-meta-pill"
                                    variant="default"
                                    size="default"
                                    className={
                                        recordingListLoadingMetaPillClassName
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
