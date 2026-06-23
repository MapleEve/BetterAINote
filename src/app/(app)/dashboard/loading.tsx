import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
    return (
        <div data-sot-shell="dashboard-loading" aria-busy="true">
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
                        variant="routeLoadingSurface"
                        hasNoPadding
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
                                    size="recordingListLoadingDayLabel"
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
                                        size="recordingListLoadingTitle"
                                    />
                                    <div
                                        data-sot-part="skeleton-meta"
                                        className="flex items-center gap-2"
                                    >
                                        <Skeleton
                                            data-sot-part="skeleton-meta-time"
                                            size="recordingListLoadingMetaTime"
                                        />
                                        <Skeleton
                                            data-sot-part="skeleton-meta-tag"
                                            size="recordingListLoadingMetaTag"
                                        />
                                    </div>
                                </div>
                                <div data-sot-part="skeleton-row-tail">
                                    <Skeleton
                                        data-sot-part="skeleton-tag"
                                        size="recordingListLoadingTag"
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
                                        size="recordingListLoadingTitle80"
                                    />
                                    <div
                                        data-sot-part="skeleton-meta"
                                        className="flex items-center gap-2"
                                    >
                                        <Skeleton
                                            data-sot-part="skeleton-meta-time"
                                            size="recordingListLoadingMetaTime"
                                        />
                                        <Skeleton
                                            data-sot-part="skeleton-meta-tag"
                                            size="recordingListLoadingMetaTag"
                                        />
                                        <Skeleton
                                            data-sot-part="skeleton-meta-pill"
                                            size="recordingListLoadingMetaPill"
                                        />
                                    </div>
                                </div>
                                <div data-sot-part="skeleton-row-tail" />
                            </div>
                        </div>
                    </Card>
                    <Card
                        data-sot-panel="dashboard-loading-detail"
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
                                    size="recordingDetailLoadingAvatar"
                                />
                                <Skeleton
                                    data-sot-part="detail-bar"
                                    size="recordingDetailLoadingBar"
                                />
                            </div>
                            <div
                                data-sot-part="detail-player-controls"
                                className="flex items-center gap-3"
                            >
                                <Skeleton
                                    data-sot-part="detail-bar"
                                    size="recordingDetailLoadingBar"
                                />
                                <Skeleton
                                    data-sot-part="detail-bar"
                                    data-sot-size="60"
                                    size="recordingDetailLoadingBar60"
                                />
                            </div>
                            <div
                                data-sot-part="detail-transcript-head"
                                className="flex items-center border-b border-[var(--line-hairline)] px-3.5 py-3 dark:border-[var(--glass-border-soft)]"
                            >
                                <Skeleton
                                    data-sot-part="detail-bar"
                                    size="recordingDetailLoadingBar"
                                />
                            </div>
                            <div
                                data-sot-part="detail-transcript"
                                className="min-h-0 flex-1"
                            >
                                <Skeleton
                                    data-sot-part="detail-bar"
                                    data-sot-size="90"
                                    size="recordingDetailLoadingBar90"
                                />
                            </div>
                        </div>
                    </Card>
                </div>
            </main>
        </div>
    );
}
