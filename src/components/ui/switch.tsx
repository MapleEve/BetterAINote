"use client";

import * as SwitchPrimitive from "@radix-ui/react-switch";
import type * as React from "react";

import { cn } from "@/lib/utils";

type SwitchVariant = "default" | "sourceProviderDetail";
type SwitchSize = "sm" | "default" | "sourceProviderDetail";

const switchVariantClassNames: Record<SwitchVariant, string> = {
    default:
        "border-transparent shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input dark:data-[state=unchecked]:bg-input/80",
    sourceProviderDetail:
        "border-0 bg-[var(--graphite-300)] p-0 shadow-none data-[state=checked]:bg-[var(--accent)] dark:data-[state=unchecked]:bg-[var(--source-provider-switch-unchecked-dark)]",
};

const switchSizeClassNames: Record<SwitchSize, string> = {
    default: "h-[1.15rem] w-8",
    sm: "h-3.5 w-6",
    sourceProviderDetail: "h-[20px] w-[36px]",
};

const switchThumbVariantClassNames: Record<SwitchVariant, string> = {
    default:
        "bg-background dark:data-[state=checked]:bg-primary-foreground dark:data-[state=unchecked]:bg-foreground",
    sourceProviderDetail: "bg-white shadow-xs dark:bg-white",
};

const switchThumbSizeClassNames: Record<SwitchSize, string> = {
    default:
        "size-4 data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0",
    sm: "size-3 data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0",
    sourceProviderDetail:
        "size-[16px] data-[state=checked]:translate-x-[18px] data-[state=unchecked]:translate-x-[2px]",
};

function Switch({
    className,
    size = "default",
    variant = "default",
    ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
    size?: SwitchSize;
    variant?: SwitchVariant;
}) {
    return (
        <SwitchPrimitive.Root
            data-slot="switch"
            data-size={size}
            data-variant={variant}
            className={cn(
                "peer group/switch inline-flex shrink-0 items-center rounded-full border outline-none transition-all disabled:cursor-not-allowed disabled:opacity-50",
                switchVariantClassNames[variant],
                switchSizeClassNames[size],
                className,
            )}
            {...props}
        >
            <SwitchPrimitive.Thumb
                data-slot="switch-thumb"
                className={cn(
                    "pointer-events-none block rounded-full ring-0 transition-transform",
                    switchThumbVariantClassNames[variant],
                    switchThumbSizeClassNames[size],
                )}
            />
        </SwitchPrimitive.Root>
    );
}

export { Switch };
