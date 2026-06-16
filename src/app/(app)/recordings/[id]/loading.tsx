export default function RecordingLoading() {
    return (
        <div className="app" aria-busy="true">
            <aside className="sidebar glass glass-strong" />
            <main className="main">
                <header className="topbar">
                    <div className="crumbs">
                        <span className="crumb-current">录音加载中</span>
                    </div>
                </header>
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
            </main>
        </div>
    );
}
