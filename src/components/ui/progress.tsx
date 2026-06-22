"use client";

import type * as React from "react";
import { Progress as ProgressPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

type ProgressDataAttributes = {
    [key: `data-${string}`]: string | number | boolean | undefined;
};

type ProgressVariant = "default" | "systemBanner";

type ProgressProps = React.ComponentProps<typeof ProgressPrimitive.Root> &
    ProgressDataAttributes & {
        indicatorClassName?: string;
        variant?: ProgressVariant;
    };

const progressRootClassNames: Record<ProgressVariant, string> = {
    default: "relative h-2 w-full overflow-hidden rounded-full bg-primary/20",
    systemBanner:
        "relative h-1.5 min-w-[120px] flex-1 overflow-hidden rounded-full bg-[var(--system-banner-progress-track)] data-[sot-state=indeterminate]:bg-[var(--system-banner-progress-indeterminate-track)]",
};

const progressIndicatorClassNames: Record<ProgressVariant, string> = {
    default: "h-full w-full flex-1 bg-primary transition-all",
    systemBanner:
        "h-full w-full flex-1 rounded-[inherit] bg-[var(--signal-info)] transition-transform duration-[var(--duration-base)] ease-[var(--ease-out)]",
};

function Progress({
    className,
    indicatorClassName,
    value,
    variant = "default",
    "data-sot-part": dataSotPart,
    "data-sot-state": dataSotState,
    ...props
}: ProgressProps) {
    const isIndeterminate = dataSotState === "indeterminate";
    const progressValue =
        typeof value === "number" && !Number.isNaN(value)
            ? Math.min(100, Math.max(0, value))
            : 0;

    return (
        <ProgressPrimitive.Root
            data-slot="progress"
            data-variant={variant}
            data-sot-part={
                dataSotPart ??
                (variant === "systemBanner"
                    ? "system-banner-progress"
                    : undefined)
            }
            data-sot-state={dataSotState}
            className={cn(progressRootClassNames[variant], className)}
            value={value}
            {...props}
        >
            <ProgressPrimitive.Indicator
                data-slot="progress-indicator"
                data-sot-part={
                    variant === "systemBanner"
                        ? "system-banner-progress-bar"
                        : undefined
                }
                className={cn(
                    progressIndicatorClassNames[variant],
                    isIndeterminate
                        ? "w-[32%] animate-[sbn-sweep_1.4s_linear_infinite] bg-[image:var(--system-banner-progress-indeterminate-bg)]"
                        : null,
                    indicatorClassName,
                )}
                style={
                    isIndeterminate
                        ? undefined
                        : {
                              transform: `translateX(-${100 - progressValue}%)`,
                          }
                }
            />
        </ProgressPrimitive.Root>
    );
}

export { Progress };
