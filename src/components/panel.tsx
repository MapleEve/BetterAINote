import * as React from "react";
import { cn } from "@/lib/utils";

interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: "default" | "inset" | "glass";
}

const Panel = React.forwardRef<HTMLDivElement, PanelProps>(
    ({ className, variant = "default", ...props }, ref) => {
        const variantClass =
            variant === "inset"
                ? "glass-surface-subtle"
                : variant === "glass"
                  ? "glass-surface glass-lift"
                  : "glass-surface";

        return (
            <div
                ref={ref}
                className={cn(variantClass, "rounded-[1.1rem] p-6", className)}
                {...props}
            />
        );
    },
);
Panel.displayName = "Panel";

export { Panel };
