"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type ToggleGroupType = "single" | "multiple";
type ToggleGroupVariant = "default" | "outline";
type ToggleGroupSize = "default" | "sm" | "lg";

type ToggleGroupContextValue = {
    type: ToggleGroupType;
    value: string[];
    setValue: (itemValue: string) => void;
    disabled?: boolean;
    variant: ToggleGroupVariant;
    size: ToggleGroupSize;
    spacing: number;
};

const ToggleGroupContext = React.createContext<ToggleGroupContextValue | null>(
    null,
);

function normalizeValue(value: string | string[] | undefined) {
    if (Array.isArray(value)) {
        return value;
    }

    return value ? [value] : [];
}

function ToggleGroup({
    className,
    type = "single",
    value: valueProp,
    defaultValue,
    onValueChange,
    disabled,
    variant = "default",
    size = "default",
    spacing = 0,
    children,
    ...props
}: Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> & {
    type?: ToggleGroupType;
    value?: string | string[];
    defaultValue?: string | string[];
    onValueChange?: (value: string | string[]) => void;
    disabled?: boolean;
    variant?: ToggleGroupVariant;
    size?: ToggleGroupSize;
    spacing?: number;
}) {
    const [uncontrolledValue, setUncontrolledValue] = React.useState(
        normalizeValue(defaultValue),
    );
    const value =
        valueProp === undefined ? uncontrolledValue : normalizeValue(valueProp);

    const setValue = React.useCallback(
        (itemValue: string) => {
            const nextValue =
                type === "single"
                    ? value.includes(itemValue)
                        ? []
                        : [itemValue]
                    : value.includes(itemValue)
                      ? value.filter(
                            (currentValue) => currentValue !== itemValue,
                        )
                      : [...value, itemValue];

            if (valueProp === undefined) {
                setUncontrolledValue(nextValue);
            }

            onValueChange?.(
                type === "single" ? (nextValue[0] ?? "") : nextValue,
            );
        },
        [onValueChange, type, value, valueProp],
    );

    const contextValue = React.useMemo(
        () => ({ type, value, setValue, disabled, variant, size, spacing }),
        [disabled, setValue, size, spacing, type, value, variant],
    );

    return (
        <ToggleGroupContext.Provider value={contextValue}>
            <div
                data-slot="toggle-group"
                data-variant={variant}
                data-size={size}
                data-spacing={spacing}
                style={{ gap: `${spacing * 0.25}rem` }}
                className={cn(
                    "group/toggle-group flex w-fit items-center rounded-md",
                    className,
                )}
                {...props}
            >
                {children}
            </div>
        </ToggleGroupContext.Provider>
    );
}

function toggleGroupItemClassName({
    variant,
    size,
    spacing,
    className,
}: {
    variant: ToggleGroupVariant;
    size: ToggleGroupSize;
    spacing?: number;
    className?: string;
}) {
    return cn(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground [&>svg]:pointer-events-none [&>svg]:size-4",
        variant === "outline" && "border border-input bg-background shadow-xs",
        size === "sm" && "h-8 px-2",
        size === "default" && "h-9 px-3",
        size === "lg" && "h-10 px-4",
        spacing === 0 &&
            "rounded-none first:rounded-l-md last:rounded-r-md data-[variant=outline]:border-l-0 first:data-[variant=outline]:border-l",
        className,
    );
}

function ToggleGroupItem({
    className,
    value,
    disabled,
    onClick,
    ...props
}: Omit<React.ComponentProps<"button">, "value"> & { value: string }) {
    const context = React.useContext(ToggleGroupContext);

    if (!context) {
        throw new Error("ToggleGroupItem must be used within a ToggleGroup.");
    }

    const selected = context.value.includes(value);
    const isDisabled = disabled || context.disabled;

    return (
        <button
            type="button"
            data-slot="toggle-group-item"
            data-variant={context.variant}
            data-size={context.size}
            data-state={selected ? "on" : "off"}
            aria-pressed={selected}
            disabled={isDisabled}
            className={toggleGroupItemClassName({
                variant: context.variant,
                size: context.size,
                spacing: context.spacing,
                className,
            })}
            onClick={(event) => {
                onClick?.(event);
                if (!event.defaultPrevented) {
                    context.setValue(value);
                }
            }}
            {...props}
        />
    );
}

export { ToggleGroup, ToggleGroupItem };
