import { Skeleton } from "@/components/ui/skeleton";

const SIDE_NAV_SKELETONS = ["source", "library", "activity", "settings"];
const RECORDING_LIST_SKELETONS = [
    "recording-1",
    "recording-2",
    "recording-3",
    "recording-4",
    "recording-5",
    "recording-6",
    "recording-7",
    "recording-8",
];
const DETAIL_FEED_SKELETONS = [
    "transcript-1",
    "transcript-2",
    "transcript-3",
    "transcript-4",
    "transcript-5",
];

export default function DashboardLoading() {
    return (
        <div className="dashboard-workstation flex min-h-svh flex-col overflow-hidden px-3 py-3 sm:px-4 sm:py-4">
            <div
                className="dashboard-workstation-grid grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[16.5rem_minmax(22rem,24rem)_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)]"
                data-testid="dashboard-loading-shell"
            >
                <aside className="glass-surface hidden min-h-0 flex-col rounded-2xl p-3 lg:row-span-2 lg:flex">
                    <div className="flex h-12 items-center gap-3">
                        <Skeleton className="size-9 rounded-xl" />
                        <div className="min-w-0 flex-1 space-y-2">
                            <Skeleton className="h-3 w-28" />
                            <Skeleton className="h-2.5 w-20" />
                        </div>
                    </div>
                    <div className="mt-6 space-y-2">
                        {SIDE_NAV_SKELETONS.map((item) => (
                            <Skeleton key={item} className="h-9 rounded-xl" />
                        ))}
                    </div>
                    <div className="mt-auto space-y-2">
                        <Skeleton className="h-9 rounded-xl" />
                        <Skeleton className="h-8 rounded-xl" />
                    </div>
                </aside>

                <header className="glass-surface relative z-[210] flex min-h-14 items-center justify-between gap-3 overflow-visible rounded-2xl px-3 py-2 lg:col-span-2">
                    <div className="flex min-w-0 items-center gap-3">
                        <Skeleton className="size-9 rounded-xl lg:hidden" />
                        <div className="min-w-0 space-y-2">
                            <Skeleton className="h-3 w-36" />
                            <Skeleton className="h-2.5 w-24" />
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <Skeleton className="size-9 rounded-xl" />
                        <Skeleton className="size-9 rounded-xl" />
                        <Skeleton className="h-9 w-24 rounded-xl" />
                    </div>
                </header>

                <section className="dashboard-list-panel h-[calc(100svh-13rem)] min-h-[28rem] lg:h-full lg:min-h-0">
                    <div className="border-border/70 border-b p-3">
                        <Skeleton className="h-10 rounded-xl" />
                        <div className="mt-3 grid grid-cols-2 gap-2">
                            <Skeleton className="h-9 rounded-xl" />
                            <Skeleton className="h-9 rounded-xl" />
                        </div>
                    </div>
                    <div className="space-y-2 p-3">
                        {RECORDING_LIST_SKELETONS.map((item) => (
                            <Skeleton key={item} className="h-20 rounded-xl" />
                        ))}
                    </div>
                </section>

                <section className="glass-surface flex min-h-[26rem] flex-1 flex-col rounded-2xl">
                    <div className="border-border/70 border-b p-4">
                        <Skeleton className="h-5 w-2/5" />
                        <Skeleton className="mt-3 h-3 w-1/3" />
                    </div>
                    <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(20rem,1fr)]">
                        <div className="space-y-4">
                            <Skeleton className="h-36 rounded-2xl" />
                            <Skeleton className="h-28 rounded-2xl" />
                        </div>
                        <div className="space-y-3">
                            <Skeleton className="h-11 rounded-xl" />
                            {DETAIL_FEED_SKELETONS.map((item) => (
                                <Skeleton
                                    key={item}
                                    className="h-16 rounded-xl"
                                />
                            ))}
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
