"use client";

import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const toggleGroupItemVariants = cva(
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground [&>svg]:pointer-events-none [&>svg]:size-4",
    {
        variants: {
            variant: {
                default: "",
                outline: "border border-input bg-background shadow-xs",
            },
            size: {
                default: "h-9 px-3",
                sm: "h-8 px-2",
                lg: "h-10 px-4",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    },
);

type ToggleGroupContextValue = VariantProps<typeof toggleGroupItemVariants> & {
    spacing: number;
};

const ToggleGroupContext = React.createContext<ToggleGroupContextValue>({
    variant: "default",
    size: "default",
    spacing: 0,
});

type ToggleGroupProps = React.ComponentProps<typeof ToggleGroupPrimitive.Root> &
    VariantProps<typeof toggleGroupItemVariants> & {
        spacing?: number;
    };

function ToggleGroup({
    className,
    variant = "default",
    size = "default",
    spacing = 0,
    children,
    style,
    ...props
}: ToggleGroupProps) {
    const contextValue = React.useMemo(
        () => ({ variant, size, spacing }),
        [variant, size, spacing],
    );

    return (
        <ToggleGroupPrimitive.Root
            data-slot="toggle-group"
            data-variant={variant}
            data-size={size}
            data-spacing={spacing}
            style={{ gap: `${spacing * 0.25}rem`, ...style }}
            className={cn(
                "group/toggle-group flex w-fit items-center rounded-md",
                className,
            )}
            {...props}
        >
            <ToggleGroupContext.Provider value={contextValue}>
                {children}
            </ToggleGroupContext.Provider>
        </ToggleGroupPrimitive.Root>
    );
}

type ToggleGroupItemProps = React.ComponentProps<
    typeof ToggleGroupPrimitive.Item
> &
    VariantProps<typeof toggleGroupItemVariants>;

function ToggleGroupItem({
    className,
    variant,
    size,
    ...props
}: ToggleGroupItemProps) {
    const context = React.useContext(ToggleGroupContext);
    const itemVariant = variant ?? context.variant;
    const itemSize = size ?? context.size;

    return (
        <ToggleGroupPrimitive.Item
            data-slot="toggle-group-item"
            data-variant={itemVariant}
            data-size={itemSize}
            data-spacing={context.spacing}
            className={cn(
                toggleGroupItemVariants({
                    variant: itemVariant,
                    size: itemSize,
                }),
                context.spacing === 0 &&
                    "rounded-none first:rounded-l-md last:rounded-r-md data-[variant=outline]:border-l-0 first:data-[variant=outline]:border-l",
                className,
            )}
            {...props}
        />
    );
}

export { ToggleGroup, ToggleGroupItem, toggleGroupItemVariants };
