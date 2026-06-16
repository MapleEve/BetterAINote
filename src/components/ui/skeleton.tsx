import type * as React from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
    return <div data-slot="skeleton" className={cn(className)} {...props} />;
}
