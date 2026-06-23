import type * as React from "react";
import { cn } from "@/lib/utils";

const skeletonVariants = {
    default: "animate-pulse rounded-md bg-accent",
} as const;

const skeletonSizes = {
    default: "",
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
