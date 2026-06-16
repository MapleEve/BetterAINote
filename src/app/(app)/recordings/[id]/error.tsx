"use client";

import Link from "next/link";

export default function RecordingError({ reset }: { reset: () => void }) {
    return (
        <main className="app">
            <aside className="sidebar glass glass-strong">
                <div className="brand">
                    <img src="/assets/logo-mark-steel.svg" alt="" />
                    <div>
                        <div className="brand-name">BetterAINote</div>
                        <div className="brand-sub">私人工作空间</div>
                    </div>
                </div>
            </aside>
            <section className="main">
                <header className="topbar">
                    <div className="crumbs">
                        <span className="crumb-current">录音详情加载失败</span>
                    </div>
                </header>
                <div className="workspace">
                    <section className="detail" data-empty="true">
                        <div className="detail-empty">
                            <div
                                className="detail-empty-ico"
                                aria-hidden="true"
                            >
                                {/* biome-ignore lint/a11y/noSvgWithoutTitle: SOT decorative empty-state icon is hidden from assistive tech. */}
                                <svg viewBox="0 0 24 24">
                                    <path d="M9 18V5l12-2v13" />
                                    <circle cx="6" cy="18" r="3" />
                                    <circle cx="18" cy="16" r="3" />
                                </svg>
                            </div>
                            <div className="detail-empty-title">加载失败</div>
                            <div className="detail-empty-sub">
                                录音详情暂时无法加载，可以重试或返回工作台。
                            </div>
                            <div className="sm-actions">
                                <button
                                    className="btn primary"
                                    type="button"
                                    onClick={reset}
                                >
                                    重试
                                </button>
                                <Link className="btn ghost" href="/dashboard">
                                    返回工作台
                                </Link>
                            </div>
                        </div>
                    </section>
                </div>
            </section>
        </main>
    );
}
