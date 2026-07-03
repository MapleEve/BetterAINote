"use client";

import { Music2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import routeChromeStyles from "../../route-chrome.module.css";

const recordingRouteFallbackClassNames = {
    shell: "grid h-screen min-h-[720px] grid-cols-[264px_1fr] transition-[grid-template-columns] duration-[320ms] ease-[var(--ease-out)]",
    emptyDetail:
        "flex min-h-0 min-w-0 flex-col gap-4 overflow-hidden rounded-[16px] border border-[var(--line-hairline)] bg-[var(--bg-elevated)] shadow-[var(--shadow-sm)] dark:border-[var(--glass-border)]",
    emptyPanel:
        "flex min-h-[280px] flex-1 flex-col items-center justify-center gap-2 rounded-[16px] border border-[var(--line-hairline)] bg-[var(--bg-elevated)] px-6 py-9 text-center shadow-[var(--shadow-sm)] dark:border-[var(--glass-border-soft)] dark:bg-[var(--card-elevated-bg)] dark:shadow-none",
    emptyIcon:
        "mb-1 inline-grid size-12 place-items-center rounded-full border border-[var(--line-hairline)] bg-[var(--bg-recessed)] text-[var(--fg-tertiary)] [&_svg]:size-[22px] [&_svg]:fill-none [&_svg]:stroke-current [&_svg]:stroke-[1.6] [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round]",
    emptyTitle: "[font:600_14px_var(--font-sans)] text-[var(--fg-primary)]",
    emptyDescription:
        "max-w-[320px] [font:500_12.5px/1.55_var(--font-sans)] text-[var(--fg-tertiary)]",
} as const;

export default function RecordingError({ reset }: { reset: () => void }) {
    return (
        <main
            data-sot-shell="recording-route-error"
            className={recordingRouteFallbackClassNames.shell}
        >
            <aside
                data-sot-panel="route-sidebar"
                className={routeChromeStyles.sidebar}
            >
                <div
                    data-sot-part="route-brand"
                    className={routeChromeStyles.brand}
                >
                    <Image
                        src="/assets/logo-mark-steel.svg"
                        alt=""
                        width={36}
                        height={36}
                    />
                    <div>
                        <div
                            data-sot-part="route-brand-name"
                            className={routeChromeStyles.brandName}
                        >
                            BetterAINote
                        </div>
                        <div
                            data-sot-part="route-brand-subtitle"
                            className={routeChromeStyles.brandSubtitle}
                        >
                            私人工作空间
                        </div>
                    </div>
                </div>
            </aside>
            <section
                data-sot-panel="route-main"
                className={routeChromeStyles.main}
            >
                <header
                    data-sot-panel="route-topbar"
                    className={routeChromeStyles.topbar}
                >
                    <div
                        data-sot-part="route-crumbs"
                        className={routeChromeStyles.crumbs}
                    >
                        <span
                            data-sot-part="route-crumb-current"
                            className={routeChromeStyles.crumbCurrent}
                        >
                            录音详情加载失败
                        </span>
                    </div>
                </header>
                <div
                    data-sot-panel="route-workspace"
                    className={routeChromeStyles.workspace}
                >
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
                                <Music2 aria-hidden="true" focusable="false" />
                            </div>
                            <div
                                data-sot-part="recording-route-empty-title"
                                className={
                                    recordingRouteFallbackClassNames.emptyTitle
                                }
                            >
                                加载失败
                            </div>
                            <div
                                data-sot-part="recording-route-empty-description"
                                className={
                                    recordingRouteFallbackClassNames.emptyDescription
                                }
                            >
                                录音详情暂时无法加载，可以重试或返回工作台。
                            </div>
                            <div
                                className="flex flex-wrap items-center gap-2"
                                data-sot-actions="recording-error"
                            >
                                <Button
                                    variant="default"
                                    size="default"
                                    type="button"
                                    onClick={reset}
                                >
                                    重试
                                </Button>
                                <Button asChild variant="ghost" size="default">
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
