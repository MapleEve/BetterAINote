import type * as React from "react";
import { cn } from "@/lib/utils";

const skeletonVariants = {
    default: "animate-pulse rounded-md bg-accent",
    sourceReportCard: "animate-pulse inline-block align-middle rounded-[6px] bg-accent",
    sourceReportSegment:
        "animate-pulse inline-block align-middle rounded-[4px] bg-accent",
} as const;

const skeletonSizes = {
    default: "",
    sourceReportCardCount: "!h-[18px] w-12",
    sourceReportCardSource: "!h-[18px] w-[120px]",
    sourceReportCardStatus: "!h-[18px] w-20",
    sourceReportSegmentLineLong: "mt-1.5 !h-[13px] w-[92%]",
    sourceReportSegmentLineMedium: "mt-1.5 !h-[13px] w-[76%]",
    sourceReportSegmentLineShort: "mt-1.5 !h-[13px] w-3/5",
    sourceReportSegmentLineWide: "mt-1.5 !h-[13px] w-[88%]",
    sourceReportSegmentSpeaker: "h-[12px] w-[54px]",
    sourceReportSegmentTime: "h-[12px] w-[96px]",
} as const;

type SkeletonVariant = keyof typeof skeletonVariants;
type SkeletonSize = keyof typeof skeletonSizes;

export function Skeleton({
    className,
    size = "default",
    variant = "default",
    ...props
}: React.ComponentProps<"div"> & {
    size?: SkeletonSize;
    variant?: SkeletonVariant;
}) {
    return (
        <div
            data-slot="skeleton"
            data-size={size}
            data-variant={variant}
            className={cn(
                skeletonVariants[variant],
                skeletonSizes[size],
                className,
            )}
            {...props}
        />
    );
}
