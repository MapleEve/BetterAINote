import type * as React from "react";
import { cn } from "@/lib/utils";

export function Textarea({
    className,
    ...props
}: React.ComponentProps<"textarea">) {
    return <textarea className={cn("field-input", className)} {...props} />;
}
