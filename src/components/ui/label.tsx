import type * as React from "react";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }: React.ComponentProps<"label">) {
    // biome-ignore lint/a11y/noLabelWithoutControl: callers provide htmlFor or wrap the matching control.
    return <label className={cn("field-name", className)} {...props} />;
}
