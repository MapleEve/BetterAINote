"use client";

import { Progress as ProgressPrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

type ProgressDataAttributes = {
    [key: `data-${string}`]: string | number | boolean | undefined;
};

type ProgressProps = React.ComponentProps<typeof ProgressPrimitive.Root> &
    ProgressDataAttributes & {
        indicatorClassName?: string;
        indicatorProps?: React.ComponentProps<
            typeof ProgressPrimitive.Indicator
        > &
            ProgressDataAttributes;
    };

function Progress({
    className,
    indicatorClassName,
    indicatorProps,
    value,
    ...props
}: ProgressProps) {
    const {
        className: indicatorPropsClassName,
        style: indicatorPropsStyle,
        ...indicatorRestProps
    } = indicatorProps ?? {};
    const progressValue =
        typeof value === "number" && !Number.isNaN(value)
            ? Math.min(100, Math.max(0, value))
            : 0;

    return (
        <ProgressPrimitive.Root
            data-slot="progress"
            className={cn(
                "relative h-2 w-full overflow-hidden rounded-full bg-primary/20",
                className,
            )}
            value={value}
            {...props}
        >
            <ProgressPrimitive.Indicator
                {...indicatorRestProps}
                data-slot="progress-indicator"
                className={cn(
                    "h-full w-full flex-1 bg-primary transition-all",
                    indicatorClassName,
                    indicatorPropsClassName,
                )}
                style={{
                    transform: `translateX(-${100 - progressValue}%)`,
                    ...indicatorPropsStyle,
                }}
            />
        </ProgressPrimitive.Root>
    );
}

export { Progress };
