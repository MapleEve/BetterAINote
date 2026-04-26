"use client";

import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

interface SegmentedTabItem<T extends string> {
    value: T;
    label: string;
    disabled?: boolean;
}

interface SegmentedTabsProps<T extends string> {
    items: SegmentedTabItem<T>[];
    value: T;
    onValueChange: (value: T) => void;
    className?: string;
}

function omitShapeOverrides(className?: string) {
    return className
        ?.split(/\s+/)
        .filter((classToken) => {
            if (!classToken) return false;

            const utilityName = classToken.split(":").at(-1);
            return utilityName ? !utilityName.startsWith("rounded") : true;
        })
        .join(" ");
}

export function SegmentedTabs<T extends string>({
    className,
    items,
    onValueChange,
    value,
}: SegmentedTabsProps<T>) {
    const activeIndex = Math.max(
        0,
        items.findIndex((item) => item.value === value),
    );

    return (
        <div
            className={cn("liquid-tabs", omitShapeOverrides(className))}
            style={
                {
                    "--active-index": activeIndex,
                    "--tab-count": Math.max(1, items.length),
                } as CSSProperties
            }
        >
            <span className="liquid-tabs__indicator" aria-hidden="true" />
            {items.map((item) => (
                <button
                    key={item.value}
                    type="button"
                    disabled={item.disabled}
                    onClick={() => onValueChange(item.value)}
                    className={cn(
                        "liquid-tabs__item",
                        value === item.value && "liquid-tabs__item--active",
                    )}
                >
                    {item.label}
                </button>
            ))}
        </div>
    );
}
