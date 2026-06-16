"use client";

import * as SliderPrimitive from "@radix-ui/react-slider";
import * as React from "react";

import { cn } from "@/lib/utils";

type SliderDataAttributes = {
    [key: `data-${string}`]: string | number | boolean | undefined;
};

type SliderRootProps = React.ComponentProps<typeof SliderPrimitive.Root> &
    SliderDataAttributes;
type SliderRangeProps = React.ComponentProps<typeof SliderPrimitive.Range> &
    SliderDataAttributes;
type SliderThumbProps = React.ComponentProps<typeof SliderPrimitive.Thumb> &
    SliderDataAttributes;

type SliderProps = SliderRootProps & {
    inputClassName?: string;
    rangeProps?: SliderRangeProps;
    renderTrack?: boolean;
    rootProps?: SliderRootProps;
    thumbProps?: SliderThumbProps;
};

const SLIDER_ROOT_CLASS =
    "relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col";
const SLIDER_TRACK_CLASS =
    "relative grow overflow-hidden rounded-full bg-muted data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5";
const SLIDER_RANGE_CLASS =
    "absolute bg-primary data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full";
const SLIDER_THUMB_CLASS =
    "block size-4 shrink-0 rounded-full border border-primary bg-white shadow-sm ring-ring/50 transition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50";

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
    const {
        "aria-hidden": _legacyInputAriaHidden,
        style: _legacyInputStyle,
        tabIndex: _legacyInputTabIndex,
        ...sliderRootProps
    } = props;
    const {
        className: rootClassName,
        style: rootStyle,
        ...rootPrimitiveProps
    } = rootProps ?? {};
    const { className: rangeClassName, ...rangePrimitiveProps } =
        rangeProps ?? {};
    const { className: thumbClassName, ...thumbPrimitiveProps } =
        thumbProps ?? {};
    const sliderValues = React.useMemo(
        () =>
            Array.isArray(value)
                ? value
                : Array.isArray(defaultValue)
                  ? defaultValue
                  : [min],
        [defaultValue, min, value],
    );
    const thumbId = React.useId();
    const thumbKeys = React.useMemo(() => {
        let nextKey = 0;

        return Array.from({ length: sliderValues.length }, () => {
            const key = `${thumbId}-${nextKey}`;
            nextKey += 1;

            return key;
        });
    }, [sliderValues.length, thumbId]);
    const thumbAriaLabel =
        thumbPrimitiveProps["aria-label"] ??
        rootPrimitiveProps["aria-label"] ??
        sliderRootProps["aria-label"];

    return (
        <SliderPrimitive.Root
            {...sliderRootProps}
            {...rootPrimitiveProps}
            data-slot="slider"
            defaultValue={value === undefined ? sliderValues : defaultValue}
            disabled={disabled}
            max={max}
            min={min}
            onValueChange={onValueChange}
            onValueCommit={onValueCommit}
            orientation={orientation}
            step={step}
            style={rootStyle}
            value={value}
            className={cn(
                SLIDER_ROOT_CLASS,
                className,
                inputClassName,
                rootClassName,
            )}
        >
            <SliderPrimitive.Track
                data-slot="slider-track"
                className={cn(SLIDER_TRACK_CLASS, !renderTrack && "opacity-0")}
            >
                <SliderPrimitive.Range
                    {...rangePrimitiveProps}
                    data-slot="slider-range"
                    className={cn(
                        SLIDER_RANGE_CLASS,
                        !renderTrack && "opacity-0",
                        rangeClassName,
                    )}
                />
            </SliderPrimitive.Track>
            {thumbKeys.map((thumbKey) => (
                <SliderPrimitive.Thumb
                    {...thumbPrimitiveProps}
                    aria-label={thumbAriaLabel}
                    data-slot="slider-thumb"
                    key={thumbKey}
                    className={cn(SLIDER_THUMB_CLASS, thumbClassName)}
                />
            ))}
        </SliderPrimitive.Root>
    );
}

export { Slider };
