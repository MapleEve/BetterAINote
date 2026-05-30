"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type SliderProps = Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "defaultValue" | "max" | "min" | "onChange" | "step" | "type" | "value"
> & {
    defaultValue?: number[];
    max?: number;
    min?: number;
    onValueChange?: (value: number[]) => void;
    onValueCommit?: (value: number[]) => void;
    orientation?: "horizontal" | "vertical";
    step?: number;
    value?: number[];
};

function normalizeSliderValue(
    value: number | null | undefined,
    min: number,
    max: number,
) {
    if (!Number.isFinite(value)) {
        return min;
    }

    return Math.min(max, Math.max(min, value ?? min));
}

function Slider({
    className,
    defaultValue,
    disabled,
    max = 100,
    min = 0,
    onValueChange,
    onValueCommit,
    orientation = "horizontal",
    step = 1,
    value,
    ...props
}: SliderProps) {
    const defaultScalar = normalizeSliderValue(defaultValue?.[0], min, max);
    const [uncontrolledValue, setUncontrolledValue] =
        React.useState(defaultScalar);
    const isControlled = Array.isArray(value);
    const currentValue = normalizeSliderValue(
        isControlled ? value?.[0] : uncontrolledValue,
        min,
        max,
    );
    const rangePercent =
        max > min
            ? Math.min(
                  100,
                  Math.max(0, ((currentValue - min) / (max - min)) * 100),
              )
            : 0;

    const commitValue = React.useCallback(
        (nextValue: number) => {
            onValueCommit?.([normalizeSliderValue(nextValue, min, max)]);
        },
        [max, min, onValueCommit],
    );

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const nextValue = normalizeSliderValue(
            Number(event.currentTarget.value),
            min,
            max,
        );

        if (!isControlled) {
            setUncontrolledValue(nextValue);
        }
        onValueChange?.([nextValue]);
    };

    const handleKeyUp = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (
            event.key === "ArrowLeft" ||
            event.key === "ArrowRight" ||
            event.key === "ArrowUp" ||
            event.key === "ArrowDown" ||
            event.key === "Home" ||
            event.key === "End"
        ) {
            commitValue(Number(event.currentTarget.value));
        }
    };

    return (
        <span
            aria-disabled={disabled ? "true" : undefined}
            data-disabled={disabled ? "" : undefined}
            data-orientation={orientation}
            data-slot="slider"
            className={cn(
                "relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
                className,
            )}
        >
            <span
                data-orientation={orientation}
                data-slot="slider-track"
                className="bg-muted relative grow overflow-hidden rounded-full data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5"
            >
                <span
                    data-orientation={orientation}
                    data-slot="slider-range"
                    className="bg-primary absolute data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full"
                    style={
                        orientation === "vertical"
                            ? { height: `${rangePercent}%` }
                            : { width: `${rangePercent}%` }
                    }
                />
            </span>
            <span
                aria-hidden="true"
                data-orientation={orientation}
                data-slot="slider-thumb"
                className="pointer-events-none absolute block size-4 shrink-0 rounded-full border border-primary bg-white shadow-sm transition-[color,box-shadow]"
                style={
                    orientation === "vertical"
                        ? {
                              bottom: `${rangePercent}%`,
                              transform: "translateY(50%)",
                          }
                        : {
                              left: `${rangePercent}%`,
                              transform: "translateX(-50%)",
                          }
                }
            />
            <input
                {...props}
                aria-orientation={orientation}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                disabled={disabled}
                max={max}
                min={min}
                onBlur={(event) =>
                    commitValue(Number(event.currentTarget.value))
                }
                onChange={handleChange}
                onKeyUp={handleKeyUp}
                onPointerUp={(event) =>
                    commitValue(Number(event.currentTarget.value))
                }
                step={step}
                type="range"
                value={currentValue}
            />
        </span>
    );
}

export { Slider };
