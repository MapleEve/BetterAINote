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
                    <section data-sot-panel="dashboard-loading-list">
                        <div
                            data-sot-panel="recording-list-loading"
                            aria-hidden="true"
                        >
                            <div data-sot-part="skeleton-day">
                                <Skeleton data-sot-part="skeleton-day-label" />
                                <span data-sot-part="skeleton-day-line" />
                            </div>
                            <div data-sot-part="skeleton-row">
                                <div data-sot-part="skeleton-row-body">
                                    <Skeleton data-sot-part="skeleton-title" />
                                    <div data-sot-part="skeleton-meta">
                                        <Skeleton data-sot-part="skeleton-meta-time" />
                                        <Skeleton data-sot-part="skeleton-meta-tag" />
                                    </div>
                                </div>
                                <div data-sot-part="skeleton-row-tail">
                                    <Skeleton data-sot-part="skeleton-tag" />
                                </div>
                            </div>
                            <div data-sot-part="skeleton-row">
                                <div data-sot-part="skeleton-row-body">
                                    <Skeleton
                                        data-sot-part="skeleton-title"
                                        data-sot-size="80"
                                    />
                                    <div data-sot-part="skeleton-meta">
                                        <Skeleton data-sot-part="skeleton-meta-time" />
                                        <Skeleton data-sot-part="skeleton-meta-tag" />
                                        <Skeleton data-sot-part="skeleton-meta-pill" />
                                    </div>
                                </div>
                                <div data-sot-part="skeleton-row-tail" />
                            </div>
                        </div>
                    </section>
                    <section data-sot-panel="dashboard-loading-detail">
                        <div
                            data-sot-panel="recording-detail-loading"
                            aria-hidden="true"
                        >
                            <div data-sot-part="detail-player-meta">
                                <Skeleton data-sot-part="detail-avatar" />
                                <Skeleton data-sot-part="detail-bar" />
                            </div>
                            <div data-sot-part="detail-player-controls">
                                <Skeleton data-sot-part="detail-bar" />
                                <Skeleton
                                    data-sot-part="detail-bar"
                                    data-sot-size="60"
                                />
                            </div>
                            <div data-sot-part="detail-transcript-head">
                                <Skeleton data-sot-part="detail-bar" />
                            </div>
                            <div data-sot-part="detail-transcript">
                                <Skeleton
                                    data-sot-part="detail-bar"
                                    data-sot-size="90"
                                />
                            </div>
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
}
