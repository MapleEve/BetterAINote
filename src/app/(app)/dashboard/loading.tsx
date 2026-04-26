import { CardSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
    return (
        <div className="bg-transparent">
            <div className="container mx-auto px-4 py-8">
                <div className="mb-8 flex items-start justify-between gap-4">
                    <div className="space-y-3">
                        <Skeleton className="h-10 w-28" />
                        <Skeleton className="h-5 w-24" />
                    </div>
                    <div className="flex gap-3">
                        <Skeleton className="h-10 w-28 rounded-full" />
                        <Skeleton className="size-10 rounded-full" />
                    </div>
                </div>
                <div className="grid min-h-[calc(100svh-15rem)] grid-cols-1 gap-6 lg:grid-cols-[minmax(280px,0.9fr)_minmax(0,2fr)]">
                    <CardSkeleton
                        className="h-[calc(100svh-13rem)]"
                        lines={8}
                    />
                    <div className="flex flex-col gap-6">
                        <CardSkeleton className="h-44" lines={2} />
                        <CardSkeleton
                            className="min-h-[26rem] flex-1"
                            lines={10}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
