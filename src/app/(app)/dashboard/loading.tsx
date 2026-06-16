export default function DashboardLoading() {
    return (
        <div className="app" aria-busy="true">
            <aside className="sidebar glass glass-strong">
                <div className="brand">
                    <img src="/assets/logo-mark-steel.svg" alt="" />
                    <div className="brand-text">
                        <div className="brand-name">BetterAINote</div>
                        <div className="brand-sub">私人工作空间</div>
                    </div>
                </div>
            </aside>
            <main className="main">
                <header className="topbar">
                    <div className="crumbs">
                        <span className="crumb-current">加载中</span>
                    </div>
                </header>
                <div className="workspace">
                    <section className="panel">
                        <div className="skel-list" aria-hidden="true">
                            <div className="day skel-day">
                                <span className="sk sk-day-l" />
                                <span className="line" />
                            </div>
                            <div className="row skel-row">
                                <div className="body">
                                    <div className="sk sk-title" />
                                    <div className="meta">
                                        <span className="sk sk-meta-t" />
                                        <span className="sk sk-meta-tag" />
                                    </div>
                                </div>
                                <div className="right">
                                    <span className="sk sk-utag" />
                                </div>
                            </div>
                            <div className="row skel-row">
                                <div className="body">
                                    <div className="sk sk-title sk-w-80" />
                                    <div className="meta">
                                        <span className="sk sk-meta-t" />
                                        <span className="sk sk-meta-tag" />
                                        <span className="sk sk-meta-pill" />
                                    </div>
                                </div>
                                <div className="right" />
                            </div>
                        </div>
                    </section>
                    <section className="detail panel">
                        <div className="skel-detail" aria-hidden="true">
                            <div className="player-meta">
                                <span className="sk sk-av" />
                                <span className="sk sk-bar" />
                            </div>
                            <div className="player-controls">
                                <span className="sk sk-bar" />
                                <span className="sk sk-bar sk-w-60" />
                            </div>
                            <div className="transcript-head">
                                <span className="sk sk-bar" />
                            </div>
                            <div className="transcript">
                                <span className="sk sk-w-90" />
                            </div>
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
}
