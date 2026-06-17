"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

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
                        <div
                            data-detail-empty=""
                            data-sot-panel="recording-route-empty"
                        >
                            <div
                                data-sot-part="recording-route-empty-icon"
                                aria-hidden="true"
                            >
                                {/* biome-ignore lint/a11y/noSvgWithoutTitle: SOT decorative empty-state icon is hidden from assistive tech. */}
                                <svg viewBox="0 0 24 24">
                                    <path d="M9 18V5l12-2v13" />
                                    <circle cx="6" cy="18" r="3" />
                                    <circle cx="18" cy="16" r="3" />
                                </svg>
                            </div>
                            <div data-sot-part="recording-route-empty-title">
                                加载失败
                            </div>
                            <div data-sot-part="recording-route-empty-description">
                                录音详情暂时无法加载，可以重试或返回工作台。
                            </div>
                            <div
                                className="flex flex-wrap items-center gap-2"
                                data-sot-actions="recording-error"
                            >
                                <Button
                                    variant="primary"
                                    type="button"
                                    onClick={reset}
                                >
                                    重试
                                </Button>
                                <Button asChild variant="ghost">
                                    <Link href="/dashboard">返回工作台</Link>
                                </Button>
                            </div>
                        </div>
                    </section>
                </div>
            </section>
        </main>
    );
}
