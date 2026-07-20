"use client";

import type { ComponentPropsWithoutRef } from "react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

export type SegmentedTabItem<T extends string = string> = {
    value: T;
    label: string;
    disabled?: boolean;
    tabKey?: string;
};

type DataAttributes = {
    [key: `data-${string}`]: string | number | boolean | undefined;
};

type SegmentedTabsRootProps = Omit<
    ComponentPropsWithoutRef<typeof ToggleGroup>,
    "children" | "defaultValue" | "onValueChange" | "size" | "type" | "value"
> &
    DataAttributes;

type SegmentedTabsItemProps = Omit<
    ComponentPropsWithoutRef<typeof ToggleGroupItem>,
    "children" | "disabled" | "value"
> &
    DataAttributes;

type SegmentedTabsItemContext = {
    active: boolean;
    disabled: boolean;
    index: number;
    size: SegmentedTabsSize;
};

type SegmentedTabsSize = "default" | "sm" | "segmentedSm";

export function SegmentedTabs<T extends string>({
    items,
    value,
    onValueChange,
    className,
    getItemProps,
    variant = "segmented",
    size = "segmentedSm",
    "aria-label": ariaLabel,
    ...props
}: SegmentedTabsRootProps & {
    items: SegmentedTabItem<T>[];
    value: T;
    onValueChange: (value: T) => void;
    getItemProps?: (
        item: SegmentedTabItem<T>,
        context: SegmentedTabsItemContext,
    ) => SegmentedTabsItemProps;
    size?: SegmentedTabsSize;
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
            className={cn("min-w-[220px]", className)}
            spacing={1}
            variant={variant}
            type="single"
            value={value}
            onValueChange={handleValueChange}
            size={size}
            role="tablist"
            aria-label={ariaLabel}
            data-tabs={items.length}
            data-active={activeIndex}
        >
            {items.map((item, index) => {
                const active = item.value === value;
                const disabled = Boolean(item.disabled);
                const itemProps =
                    getItemProps?.(item, {
                        active,
                        disabled,
                        index,
                        size,
                    }) ?? {};
                const { className: itemClassName, ...itemRestProps } =
                    itemProps;

                return (
                    <ToggleGroupItem
                        key={item.value}
                        value={item.value}
                        {...itemRestProps}
                        data-tab-key={item.tabKey ?? item.value}
                        role="tab"
                        className={cn("min-w-[80px]", itemClassName)}
                        disabled={item.disabled}
                        aria-disabled={item.disabled || undefined}
                        aria-selected={active}
                    >
                        {item.label}
                    </ToggleGroupItem>
                );
            })}
        </ToggleGroup>
    );
}
