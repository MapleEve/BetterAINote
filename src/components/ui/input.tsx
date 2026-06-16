import type * as React from "react";
import { cn } from "@/lib/utils";

export function Input({
    className,
    type,
    ...props
}: React.ComponentProps<"input">) {
    return (
        <input
            type={type}
            className={cn("field-input", className)}
            {...props}
        />
    );
}
