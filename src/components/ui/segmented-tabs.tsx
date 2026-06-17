"use client";

import type { ComponentPropsWithoutRef } from "react";

export type SegmentedTabItem<T extends string = string> = {
    value: T;
    label: string;
    disabled?: boolean;
    tabKey?: string;
};

export function SegmentedTabs<T extends string>({
    items,
    value,
    onValueChange,
    className,
    size = "sm",
    "aria-label": ariaLabel,
    ...props
}: Omit<ComponentPropsWithoutRef<"div">, "onChange"> & {
    items: SegmentedTabItem<T>[];
    value: T;
    onValueChange: (value: T) => void;
    size?: "default" | "sm";
}) {
    const activeIndex = Math.max(
        0,
        items.findIndex((item) => item.value === value),
    );

    return (
        <div
            {...props}
            className={className}
            role="tablist"
            aria-label={ariaLabel}
            data-sot-control="liquid-tabs"
            data-slot="segmented-tabs"
            data-sot-size={size}
            data-idx={activeIndex}
            data-tabs={items.length}
            data-active={activeIndex}
        >
            <span data-sot-part="liquid-tabs-indicator" aria-hidden="true" />
            {items.map((item) => (
                <button
                    type="button"
                    data-sot-control="liquid-tab"
                    data-sot-state={
                        item.disabled
                            ? "disabled"
                            : item.value === value
                              ? "active"
                              : "idle"
                    }
                    data-tab-key={item.tabKey ?? item.value}
                    role="tab"
                    disabled={item.disabled}
                    aria-disabled={item.disabled || undefined}
                    aria-selected={item.value === value}
                    key={item.value}
                    onClick={() => {
                        if (!item.disabled) {
                            onValueChange(item.value);
                        }
                    }}
                >
                    {item.label}
                </button>
            ))}
        </div>
    );
}
