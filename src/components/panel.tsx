import type * as React from "react";

import { cn } from "@/lib/utils";

export function Panel({
    className,
    variant = "default",
    ...props
}: React.ComponentProps<"section"> & { variant?: "default" | "glass" }) {
    return (
        <section
            data-slot="card"
            data-variant={variant}
            className={cn(
                "flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm",
                variant === "glass" && "backdrop-blur-xl",
                className,
            )}
            {...props}
        />
    );
}
