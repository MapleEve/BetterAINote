"use client";

import type { ComponentPropsWithoutRef, KeyboardEvent } from "react";

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

type SegmentedTabsKeyboardActivationOptions<T extends string> = {
    dir?: "ltr" | "rtl";
    items: readonly SegmentedTabItem<T>[];
    key: string;
    loop?: boolean;
    orientation?: "horizontal" | "vertical";
    value: T;
};

export function getSegmentedTabsKeyboardActivationValue<T extends string>({
    dir = "ltr",
    items,
    key,
    loop = true,
    orientation,
    value,
}: SegmentedTabsKeyboardActivationOptions<T>): T | null {
    const enabledItems = items.filter((item) => !item.disabled);
    const currentIndex = enabledItems.findIndex((item) => item.value === value);

    if (currentIndex === -1) return null;

    const directionAwareKey =
        dir === "rtl"
            ? key === "ArrowLeft"
                ? "ArrowRight"
                : key === "ArrowRight"
                  ? "ArrowLeft"
                  : key
            : key;
    const isHorizontalArrow =
        directionAwareKey === "ArrowLeft" || directionAwareKey === "ArrowRight";
    const isVerticalArrow =
        directionAwareKey === "ArrowUp" || directionAwareKey === "ArrowDown";

    if (
        (orientation === "horizontal" && isVerticalArrow) ||
        (orientation === "vertical" && isHorizontalArrow)
    ) {
        return null;
    }

    let nextIndex: number | null = null;
    if (directionAwareKey === "Home" || directionAwareKey === "PageUp") {
        nextIndex = 0;
    } else if (
        directionAwareKey === "End" ||
        directionAwareKey === "PageDown"
    ) {
        nextIndex = enabledItems.length - 1;
    } else if (
        directionAwareKey === "ArrowLeft" ||
        directionAwareKey === "ArrowUp"
    ) {
        nextIndex = currentIndex - 1;
    } else if (
        directionAwareKey === "ArrowRight" ||
        directionAwareKey === "ArrowDown"
    ) {
        nextIndex = currentIndex + 1;
    } else {
        return null;
    }

    if (nextIndex < 0 || nextIndex >= enabledItems.length) {
        if (!loop) return null;
        nextIndex = (nextIndex + enabledItems.length) % enabledItems.length;
    }

    return enabledItems[nextIndex]?.value ?? null;
}

export function SegmentedTabs<T extends string>({
    items,
    value,
    onValueChange,
    className,
    getItemProps,
    variant = "segmented",
    size = "segmentedSm",
    "aria-label": ariaLabel,
    dir,
    loop,
    onKeyDownCapture,
    orientation,
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
    const handleKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>) => {
        onKeyDownCapture?.(event);
        if (event.defaultPrevented) return;

        const nextValue = getSegmentedTabsKeyboardActivationValue({
            dir,
            items,
            key: event.key,
            loop,
            orientation,
            value,
        });

        if (!nextValue) return;

        event.preventDefault();
        const nextItemIndex = items.findIndex(
            (item) => item.value === nextValue,
        );
        const nextTab =
            event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')[
                nextItemIndex
            ];

        onValueChange(nextValue);
        nextTab?.focus();
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
            dir={dir}
            loop={loop}
            orientation={orientation}
            onKeyDownCapture={handleKeyDownCapture}
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
