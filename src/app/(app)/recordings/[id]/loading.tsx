import { ArrowLeft, Database } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const METADATA_SKELETONS = ["duration", "size", "created-at", "source"];
const TRANSCRIPT_SKELETONS = [
    "line-1",
    "line-2",
    "line-3",
    "line-4",
    "line-5",
    "line-6",
];

export default function RecordingDetailLoading() {
    return (
        <div className="dashboard-workstation flex min-h-svh flex-col overflow-hidden px-3 py-3 sm:px-4 sm:py-4">
            <div className="mx-auto flex min-h-0 w-full max-w-[1280px] flex-1 flex-col gap-4">
                <header className="glass-surface relative z-[210] flex min-h-14 items-center gap-3 overflow-visible rounded-2xl px-3 py-2">
                    <span className="glass-control flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground">
                        <ArrowLeft className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1 space-y-2">
                        <Skeleton className="h-5 w-64 max-w-full" />
                        <Skeleton className="h-3 w-36" />
                    </div>
                    <span className="hidden shrink-0 items-center gap-2 rounded-full border border-border/60 bg-background/30 px-3 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur-xl md:flex">
                        <Database className="h-3.5 w-3.5" />
                        <Skeleton className="h-3 w-20" />
                    </span>
                </header>

                <div className="glass-surface-subtle flex flex-wrap items-center gap-2 rounded-2xl p-2">
                    <Skeleton className="h-9 w-24 rounded-xl" />
                    <Skeleton className="h-9 w-28 rounded-xl" />
                    <Skeleton className="h-9 w-28 rounded-xl" />
                </div>

                <main className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(24rem,1.08fr)]">
                    <section className="min-h-0 space-y-4 overflow-hidden pr-0 lg:pr-1">
                        <div className="glass-surface rounded-[1.1rem] p-5">
                            <Skeleton className="h-7 w-40" />
                            <Skeleton className="mt-4 h-28 rounded-2xl" />
                        </div>
                        <div className="glass-surface rounded-[1.1rem] p-6">
                            <Skeleton className="h-5 w-24" />
                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                {METADATA_SKELETONS.map((item) => (
                                    <Skeleton
                                        key={item}
                                        className="h-20 rounded-xl"
                                    />
                                ))}
                            </div>
                        </div>
                    </section>
                    <section className="glass-surface min-h-[28rem] rounded-2xl p-4">
                        <Skeleton className="h-10 rounded-xl" />
                        <div className="mt-5 space-y-3">
                            {TRANSCRIPT_SKELETONS.map((item) => (
                                <Skeleton
                                    key={item}
                                    className="h-16 rounded-xl"
                                />
                            ))}
                        </div>
                    </section>
                </main>
            </div>
        </div>
    );
}
