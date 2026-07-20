import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const recordingLoadingShellClassName =
    "flex h-screen min-h-screen bg-background text-foreground transition-all duration-300 ease-out";
const recordingLoadingSidebarClassName =
    "relative flex w-64 shrink-0 min-w-0 flex-col overflow-hidden rounded-none border-r border-border bg-card px-3 pb-3 pt-4 text-card-foreground shadow-sm max-lg:pointer-events-none max-lg:w-0 max-lg:border-r-0 max-lg:px-0 max-lg:opacity-0";
const recordingLoadingMainClassName =
    "flex h-screen min-w-0 flex-1 flex-col bg-background";
const recordingLoadingTopbarClassName =
    "relative flex h-14 flex-none items-center gap-3.5 border-b border-border bg-background/80 px-5 py-3 shadow-none backdrop-blur-xl backdrop-saturate-150 max-lg:box-border max-lg:min-w-0 max-lg:max-w-full";
const recordingLoadingWorkspaceClassName =
    "flex min-h-0 flex-1 flex-col px-5 pb-5 pt-4 max-lg:box-border max-lg:min-w-0 max-lg:max-w-full";
const recordingLoadingSurfaceClassName =
    "min-h-0 gap-0 overflow-hidden rounded-2xl border-border bg-card shadow-sm backdrop-blur-none";

export default function RecordingLoading() {
    return (
        <section
            aria-live="polite"
            aria-label="正在加载录音详情"
            aria-busy={true}
            className="contents"
        >
            <div aria-busy={true} className={recordingLoadingShellClassName}>
                <aside
                    aria-label="应用导航"
                    className={recordingLoadingSidebarClassName}
                >
                    <Image
                        src="/assets/logo-mark-steel.svg"
                        alt=""
                        width={36}
                        height={36}
                        className="size-9 rounded-lg"
                    />
                </aside>
                <main className={recordingLoadingMainClassName}>
                    <section aria-label="当前页面" className="contents">
                        <header className={recordingLoadingTopbarClassName}>
                            <span className="truncate text-sm font-semibold text-foreground">
                                录音加载中
                            </span>
                        </header>
                    </section>
                    <div className={recordingLoadingWorkspaceClassName}>
                        <Card
                            variant="default"
                            hasNoPadding
                            className={`${recordingLoadingSurfaceClassName} flex min-h-0 min-w-0 flex-1 flex-col gap-4`}
                        >
                            <div
                                aria-hidden="true"
                                className="flex min-h-0 flex-1 flex-col gap-3.5"
                            >
                                <div className="mb-3 flex items-center gap-2.5">
                                    <Skeleton className="size-8 rounded-full" />
                                    <Skeleton className="h-2 w-20 rounded" />
                                </div>
                                <div className="flex items-center gap-3">
                                    <Skeleton className="h-2 w-20 rounded" />
                                    <Skeleton className="h-2 w-3/5 rounded" />
                                </div>
                                <div className="flex items-center border-b border-border px-3.5 py-3">
                                    <Skeleton className="h-2 w-20 rounded" />
                                </div>
                                <div className="min-h-0 flex-1">
                                    <Skeleton className="h-2 w-11/12 rounded" />
                                </div>
                            </div>
                        </Card>
                    </div>
                </main>
            </div>
        </section>
    );
}
