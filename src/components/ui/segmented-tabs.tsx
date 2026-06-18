"use client";

import type { ComponentPropsWithoutRef } from "react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export type SegmentedTabItem<T extends string = string> = {
    value: T;
    label: string;
    disabled?: boolean;
    tabKey?: string;
};

type SegmentedTabsRootProps = Omit<
    ComponentPropsWithoutRef<typeof ToggleGroup>,
    "children" | "defaultValue" | "onValueChange" | "size" | "type" | "value"
>;

export function SegmentedTabs<T extends string>({
    items,
    value,
    onValueChange,
    className,
    size = "sm",
    "aria-label": ariaLabel,
    ...props
}: SegmentedTabsRootProps & {
    items: SegmentedTabItem<T>[];
    value: T;
    onValueChange: (value: T) => void;
    size?: "default" | "sm";
}) {
    const activeIndex = Math.max(
        0,
        items.findIndex((item) => item.value === value),
    );
    const handleValueChange = (nextValue: string) => {
        if (!nextValue) return;
        onValueChange(nextValue as T);
    };

    return (
        <ToggleGroup
            {...props}
            className={className}
            type="single"
            value={value}
            onValueChange={handleValueChange}
            size={size === "sm" ? "sm" : "default"}
            role="tablist"
            aria-label={ariaLabel}
            data-sot-control="liquid-tabs"
            data-sot-size={size}
            data-tabs={items.length}
            data-active={activeIndex}
        >
            {items.map((item) => (
                <ToggleGroupItem
                    key={item.value}
                    value={item.value}
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
                >
                    {item.label}
                </ToggleGroupItem>
            ))}
        </ToggleGroup>
    );
}
