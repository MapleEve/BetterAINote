"use client";

import { useTheme } from "next-themes";
import type * as React from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { cn } from "@/lib/utils";

export function Toaster({ ...props }: ToasterProps) {
    const { theme = "system" } = useTheme();
    const { style, className, ...restProps } = props;

    return (
        <Sonner
            className={cn("toaster group z-[var(--z-toast)]", className)}
            style={
                {
                    ...style,
                    "--normal-bg": "var(--popover)",
                    "--normal-text": "var(--popover-foreground)",
                    "--normal-border": "var(--border)",
                    "--border-radius": "var(--radius)",
                } as React.CSSProperties
            }
            theme={theme as ToasterProps["theme"]}
            {...restProps}
        />
    );
}
