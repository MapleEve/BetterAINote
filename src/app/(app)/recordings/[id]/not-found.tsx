import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function RecordingNotFound() {
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
                        <span className="crumb-current">
                            录音不存在或已删除
                        </span>
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
                            <div className="detail-empty-title">录音不存在</div>
                            <div className="detail-empty-sub">
                                这条录音不存在或已经被删除，返回工作台后可以继续查看其他录音。
                            </div>
                            <Button asChild variant="primary">
                                <Link href="/dashboard">返回工作台</Link>
                            </Button>
                        </div>
                    </section>
                </div>
            </section>
        </main>
    );
}
