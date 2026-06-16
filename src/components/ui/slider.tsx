"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type SliderSpanProps = React.HTMLAttributes<HTMLSpanElement> & {
    [key: `data-${string}`]: string | number | boolean | undefined;
};

type SliderProps = Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "defaultValue" | "max" | "min" | "onChange" | "step" | "type" | "value"
> & {
    defaultValue?: number[];
    inputClassName?: string;
    max?: number;
    min?: number;
    onValueChange?: (value: number[]) => void;
    onValueCommit?: (value: number[]) => void;
    orientation?: "horizontal" | "vertical";
    rangeProps?: SliderSpanProps;
    renderTrack?: boolean;
    rootProps?: SliderSpanProps;
    step?: number;
    thumbProps?: SliderSpanProps;
    value?: number[];
};

const DEFAULT_SLIDER_ROOT_CLASS =
    "relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col";
const DEFAULT_SLIDER_RANGE_CLASS =
    "bg-primary absolute data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full";
const DEFAULT_SLIDER_THUMB_CLASS =
    "pointer-events-none absolute block size-4 shrink-0 rounded-full border border-primary bg-white shadow-sm transition-[color,box-shadow]";
const SOT_SLIDER_RANGE_CLASS = "track-fill";
const SOT_SLIDER_THUMB_CLASS = "track-thumb";

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
    inputClassName,
    max = 100,
    min = 0,
    onValueChange,
    onValueCommit,
    orientation = "horizontal",
    rangeProps,
    renderTrack = true,
    rootProps,
    step = 1,
    thumbProps,
    value,
    ...props
}: SliderProps) {
    const { onBlur, onKeyUp, onPointerUp, ...inputProps } = props;
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

    const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
        onBlur?.(event);
        if (!event.defaultPrevented) {
            commitValue(Number(event.currentTarget.value));
        }
    };

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
        onKeyUp?.(event);
        if (event.defaultPrevented) {
            return;
        }
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

    const handlePointerUp = (event: React.PointerEvent<HTMLInputElement>) => {
        onPointerUp?.(event);
        if (!event.defaultPrevented) {
            commitValue(Number(event.currentTarget.value));
        }
    };
    const usesSotPlayerTrack = className?.split(/\s+/).includes("track");

    return (
        <span
            aria-disabled={disabled ? "true" : undefined}
            data-disabled={disabled ? "" : undefined}
            data-orientation={orientation}
            {...rootProps}
            className={cn(
                className ?? DEFAULT_SLIDER_ROOT_CLASS,
                rootProps?.className,
            )}
        >
            {renderTrack ? (
                <span
                    {...rangeProps}
                    data-orientation={orientation}
                    className={cn(
                        rangeProps?.className ??
                            (usesSotPlayerTrack
                                ? SOT_SLIDER_RANGE_CLASS
                                : DEFAULT_SLIDER_RANGE_CLASS),
                    )}
                    style={
                        orientation === "vertical"
                            ? {
                                  height: `${rangePercent}%`,
                                  ...rangeProps?.style,
                              }
                            : {
                                  width: `${rangePercent}%`,
                                  ...rangeProps?.style,
                              }
                    }
                />
            ) : null}
            {renderTrack ? (
                <span
                    {...thumbProps}
                    aria-hidden="true"
                    data-orientation={orientation}
                    className={cn(
                        thumbProps?.className ??
                            (usesSotPlayerTrack
                                ? SOT_SLIDER_THUMB_CLASS
                                : DEFAULT_SLIDER_THUMB_CLASS),
                    )}
                    style={
                        orientation === "vertical"
                            ? {
                                  bottom: `${rangePercent}%`,
                                  transform: "translateY(50%)",
                                  ...thumbProps?.style,
                              }
                            : {
                                  left: `${rangePercent}%`,
                                  transform: usesSotPlayerTrack
                                      ? "translate(-50%, -50%)"
                                      : "translateX(-50%)",
                                  ...thumbProps?.style,
                              }
                    }
                />
            ) : null}
            <input
                {...inputProps}
                aria-orientation={orientation}
                className={inputClassName}
                disabled={disabled}
                max={max}
                min={min}
                onBlur={handleBlur}
                onChange={handleChange}
                onKeyUp={handleKeyUp}
                onPointerUp={handlePointerUp}
                step={step}
                suppressHydrationWarning
                type="range"
                value={currentValue}
            />
        </span>
    );
}

export { Slider };
