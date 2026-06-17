"use client";

import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils";

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
            className={cn("liquid-tabs", size === "sm" && "sm", className)}
            role="tablist"
            aria-label={ariaLabel}
            data-idx={activeIndex}
            data-tabs={items.length}
            data-active={activeIndex}
        >
            <span className="lt-ind" aria-hidden="true" />
            {items.map((item) => (
                <button
                    className={cn("lt-tab", item.value === value && "active")}
                    type="button"
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
