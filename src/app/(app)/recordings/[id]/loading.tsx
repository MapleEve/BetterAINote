import { Skeleton } from "@/components/ui/skeleton";

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
                <section data-sot-panel="recording-route-loading-detail">
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
            </main>
        </div>
    );
}
