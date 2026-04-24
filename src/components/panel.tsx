import * as React from "react";
import { cn } from "@/lib/utils";

interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: "default" | "inset" | "glass";
}

const Panel = React.forwardRef<HTMLDivElement, PanelProps>(
    ({ className, variant = "default", ...props }, ref) => {
        const variantClass =
            variant === "inset"
                ? "panel-inset"
                : variant === "glass"
                  ? "glass-panel"
                  : "panel";

        return (
            <div
                ref={ref}
                className={cn(variantClass, "rounded-lg p-6", className)}
                {...props}
            />
        );
    },
);
Panel.displayName = "Panel";

export { Panel };
