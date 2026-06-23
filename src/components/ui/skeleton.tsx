import type * as React from "react";
import { cn } from "@/lib/utils";

const skeletonVariants = {
    default: "animate-pulse rounded-md bg-accent",
    dashboardTranscript: "animate-pulse rounded-md bg-accent",
    recordingTranscription: "animate-pulse rounded-md bg-accent",
    sourceReportCard: "animate-pulse inline-block align-middle rounded-[6px] bg-accent",
    sourceReportSegment:
        "animate-pulse inline-block align-middle rounded-[4px] bg-accent",
} as const;

const skeletonSizes = {
    default: "",
    recordingListLoadingDayLabel: "h-[11px] w-[100px]",
    recordingListLoadingMetaPill: "h-[18px] w-16 rounded-full",
    recordingListLoadingMetaTag: "h-[18px] w-16 rounded-[6px]",
    recordingListLoadingMetaTime: "h-[11px] w-20",
    recordingListLoadingTag: "h-[22px] w-20 rounded-[6px]",
    recordingListLoadingTitle: "h-[13px] w-full",
    recordingListLoadingTitle80: "h-[13px] w-4/5",
    recordingDetailLoadingAvatar: "size-8 rounded-full",
    recordingDetailLoadingBar: "h-2 w-20 rounded-[4px]",
    recordingDetailLoadingBar60: "h-2 w-3/5 rounded-[4px]",
    recordingDetailLoadingBar90: "h-2 w-[90%] rounded-[4px]",
    dashboardTranscriptAvatar: "size-6 flex-none rounded-full",
    dashboardTranscriptLine60: "mt-1.5 h-3.5 w-3/5",
    dashboardTranscriptLine70: "mt-1.5 h-3.5 w-[70%]",
    dashboardTranscriptLine78: "mt-1.5 h-3.5 w-[78%]",
    dashboardTranscriptLine82: "mt-1.5 h-3.5 w-[82%]",
    dashboardTranscriptLine88: "mt-1.5 h-3.5 w-[88%]",
    dashboardTranscriptLine92: "mt-1 h-3.5 w-[92%]",
    dashboardTranscriptLine94: "mt-1 h-3.5 w-[94%]",
    dashboardTranscriptLine96: "mt-1 h-3.5 w-[96%]",
    dashboardTranscriptSpeaker120: "h-[13px] w-[120px] flex-none",
    dashboardTranscriptSpeaker130: "h-[13px] w-[130px] flex-none",
    dashboardTranscriptSpeaker140: "h-[13px] w-[140px] flex-none",
    dashboardTranscriptTime: "h-[11px] w-20 flex-none",
    recordingTranscriptionAction: "h-[26px] w-[72px]",
    recordingTranscriptionDescription: "h-[13px] w-full max-w-[220px]",
    recordingTranscriptionFieldControl: "h-[13px] w-[132px]",
    recordingTranscriptionFieldLabel: "h-[13px] w-24",
    recordingTranscriptionLineLong: "h-[13px] w-[92%]",
    recordingTranscriptionLineMedium: "h-[13px] w-3/4",
    recordingTranscriptionLineShort: "h-[13px] w-3/5",
    recordingTranscriptionSpeaker: "h-[13px] w-24",
    recordingTranscriptionStatus: "h-[13px] w-[76px]",
    recordingTranscriptionTime: "h-[13px] w-16",
    recordingTranscriptionTitle: "h-4 w-32",
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

export type SkeletonVariant = keyof typeof skeletonVariants;
export type SkeletonSize = keyof typeof skeletonSizes;

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
