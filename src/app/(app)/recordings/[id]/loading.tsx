import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const recordingDetailLoadingSkeletonClassNames = {
    recordingDetailLoadingAvatar: "size-8 rounded-full",
    recordingDetailLoadingBar: "h-2 w-20 rounded-[4px]",
    recordingDetailLoadingBar60: "h-2 w-3/5 rounded-[4px]",
    recordingDetailLoadingBar90: "h-2 w-[90%] rounded-[4px]",
} as const;

export default function RecordingLoading() {
    return (
        <div data-sot-shell="recording-route-loading" aria-busy="true">
            <aside data-sot-panel="route-sidebar" />
            <main data-sot-panel="route-main">
                <header data-sot-panel="route-topbar">
                    <div data-sot-part="route-crumbs">
                        <span data-sot-part="route-crumb-current">
                            录音加载中
                        </span>
                    </div>
                </header>
                <Card
                    data-sot-panel="recording-route-loading-detail"
                    variant="routeLoadingSurface"
                    hasNoPadding
                    className="flex min-h-0 flex-col gap-4"
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
            </main>
        </div>
    );
}
