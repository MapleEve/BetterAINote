import Link from "next/link";
import { Button } from "@/components/ui/button";

const recordingRouteFallbackClassNames = {
    shell: "grid h-screen min-h-[720px] grid-cols-[264px_1fr] transition-[grid-template-columns] duration-[320ms] ease-[var(--ease-out)]",
    emptyDetail:
        "flex min-h-0 min-w-0 flex-col gap-4 overflow-hidden rounded-[16px] border border-[var(--line-hairline)] bg-[var(--bg-elevated)] shadow-[var(--shadow-sm)] dark:border-[var(--glass-border)]",
    emptyPanel:
        "flex min-h-[280px] flex-1 flex-col items-center justify-center gap-2 rounded-[16px] border border-[var(--line-hairline)] bg-[var(--bg-elevated)] px-6 py-9 text-center shadow-[var(--shadow-sm)] dark:border-[var(--glass-border-soft)] dark:bg-[rgb(255_255_255_/_0.025)] dark:shadow-none",
    emptyIcon:
        "mb-1 inline-grid size-12 place-items-center rounded-full border border-[var(--line-hairline)] bg-[var(--bg-recessed)] text-[var(--fg-tertiary)] [&_svg]:size-[22px] [&_svg]:fill-none [&_svg]:stroke-current [&_svg]:stroke-[1.6] [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round]",
    emptyTitle: "[font:600_14px_var(--font-sans)] text-[var(--fg-primary)]",
    emptyDescription:
        "max-w-[320px] [font:500_12.5px/1.55_var(--font-sans)] text-[var(--fg-tertiary)]",
} as const;

export default function RecordingNotFound() {
    return (
        <main
            data-sot-shell="recording-route-empty"
            className={recordingRouteFallbackClassNames.shell}
        >
            <aside data-sot-panel="route-sidebar">
                <div data-sot-part="route-brand">
                    <img src="/assets/logo-mark-steel.svg" alt="" />
                    <div>
                        <div data-sot-part="route-brand-name">BetterAINote</div>
                        <div data-sot-part="route-brand-subtitle">
                            私人工作空间
                        </div>
                    </div>
                </div>
            </aside>
            <section data-sot-panel="route-main">
                <header data-sot-panel="route-topbar">
                    <div data-sot-part="route-crumbs">
                        <span data-sot-part="route-crumb-current">
                            录音不存在或已删除
                        </span>
                    </div>
                </header>
                <div data-sot-panel="route-workspace">
                    <section
                        data-sot-panel="recording-route-empty-detail"
                        data-empty="true"
                        className={recordingRouteFallbackClassNames.emptyDetail}
                    >
                        <div
                            data-sot-panel="recording-route-empty"
                            className={
                                recordingRouteFallbackClassNames.emptyPanel
                            }
                        >
                            <div
                                data-sot-part="recording-route-empty-icon"
                                aria-hidden="true"
                                className={
                                    recordingRouteFallbackClassNames.emptyIcon
                                }
                            >
                                {/* biome-ignore lint/a11y/noSvgWithoutTitle: SOT decorative empty-state icon is hidden from assistive tech. */}
                                <svg viewBox="0 0 24 24">
                                    <path d="M9 18V5l12-2v13" />
                                    <circle cx="6" cy="18" r="3" />
                                    <circle cx="18" cy="16" r="3" />
                                </svg>
                            </div>
                            <div
                                data-sot-part="recording-route-empty-title"
                                className={
                                    recordingRouteFallbackClassNames.emptyTitle
                                }
                            >
                                录音不存在
                            </div>
                            <div
                                data-sot-part="recording-route-empty-description"
                                className={
                                    recordingRouteFallbackClassNames.emptyDescription
                                }
                            >
                                这条录音不存在或已经被删除，返回工作台后可以继续查看其他录音。
                            </div>
                            <Button
                                asChild
                                variant="default"
                                size="default"
                            >
                                <Link href="/dashboard">返回工作台</Link>
                            </Button>
                        </div>
                    </section>
                </div>
            </section>
        </main>
    );
}
