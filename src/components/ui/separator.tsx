import type * as React from "react";

import { cn } from "@/lib/utils";

function Separator({
    className,
    orientation = "horizontal",
    decorative = true,
    ...props
}: React.ComponentProps<"div"> & {
    orientation?: "horizontal" | "vertical";
    decorative?: boolean;
}) {
    return (
        <div
            data-slot="separator"
            role={decorative ? "none" : "separator"}
            aria-hidden={decorative ? true : undefined}
            data-orientation={orientation}
            className={cn(
                "shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
                className,
            )}
            {...props}
        />
    );
}

export { Separator };
