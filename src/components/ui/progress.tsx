"use client";

import type * as React from "react";

import { cn } from "@/lib/utils";

type ProgressDataAttributes = {
    [key: `data-${string}`]: string | number | boolean | undefined;
};

type ProgressProps = Omit<React.ComponentProps<"div">, "value"> &
    ProgressDataAttributes & {
        value?: number | null;
        max?: number;
        getValueLabel?: (value: number, max: number) => string;
        indicatorClassName?: string;
        indicatorProps?: React.ComponentProps<"div"> & ProgressDataAttributes;
    };

function Progress({
    className,
    getValueLabel,
    indicatorClassName,
    indicatorProps,
    max,
    value,
    ...props
}: ProgressProps) {
    const {
        className: indicatorPropsClassName,
        style: indicatorPropsStyle,
        ...indicatorRestProps
    } = indicatorProps ?? {};
    const maxValue =
        typeof max === "number" && Number.isFinite(max) && max > 0 ? max : 100;
    const progressValue =
        typeof value === "number" && Number.isFinite(value)
            ? Math.min(maxValue, Math.max(0, value))
            : null;
    const progressPercent =
        progressValue === null ? 0 : (progressValue / maxValue) * 100;
    const valueLabel =
        progressValue === null
            ? undefined
            : getValueLabel?.(progressValue, maxValue);

    return (
        <div
            data-slot="progress"
            role="progressbar"
            aria-valuemax={maxValue}
            aria-valuemin={0}
            aria-valuenow={progressValue ?? undefined}
            aria-valuetext={valueLabel}
            className={cn(
                "relative h-2 w-full overflow-hidden rounded-full bg-primary/20",
                className,
            )}
            {...props}
        >
            <div
                {...indicatorRestProps}
                data-slot="progress-indicator"
                className={cn(
                    "h-full w-full flex-1 bg-primary transition-all",
                    indicatorClassName,
                    indicatorPropsClassName,
                )}
                style={{
                    transform: `translateX(-${100 - progressPercent}%)`,
                    ...indicatorPropsStyle,
                }}
            />
        </div>
    );
}

export { Progress };
