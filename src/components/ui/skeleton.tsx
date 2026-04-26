import type * as React from "react";

import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="skeleton"
            className={cn("skeleton-shimmer rounded-xl", className)}
            {...props}
        />
    );
}

function CardSkeleton({
    className,
    lines = 3,
    ...props
}: React.ComponentProps<"div"> & { lines?: number }) {
    return (
        <div
            className={cn(
                "glass-surface flex flex-col gap-4 rounded-[1.1rem] p-6",
                className,
            )}
            {...props}
        >
            <Skeleton className="h-5 w-1/3" />
            {Array.from({ length: lines }, (_, index) => `line-${index}`).map(
                (lineId, index) => (
                    <Skeleton
                        key={lineId}
                        className={cn("h-4", index === lines - 1 && "w-2/3")}
                    />
                ),
            )}
        </div>
    );
}

export { CardSkeleton, Skeleton };
