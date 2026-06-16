import type * as React from "react";

import { cn } from "@/lib/utils";

type AlertVariant = "default" | "destructive";

const alertVariantClassNames: Record<AlertVariant, string> = {
    default: "bg-card text-card-foreground",
    destructive:
        "bg-card text-destructive *:data-[slot=alert-description]:text-destructive/90 [&>svg]:text-current",
};

function Alert({
    className,
    variant = "default",
    ...props
}: React.ComponentProps<"div"> & { variant?: AlertVariant }) {
    return (
        <div
            data-slot="alert"
            role="alert"
            className={cn(
                "relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-lg border border-border px-4 py-3 text-sm has-[>svg]:grid-cols-[1rem_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
                alertVariantClassNames[variant],
                className,
            )}
            {...props}
        />
    );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="alert-title"
            className={cn(
                "col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight",
                className,
            )}
            {...props}
        />
    );
}

function AlertDescription({
    className,
    ...props
}: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="alert-description"
            className={cn(
                "col-start-2 grid justify-items-start gap-1 text-sm text-muted-foreground [&_p]:leading-relaxed",
                className,
            )}
            {...props}
        />
    );
}

export { Alert, AlertTitle, AlertDescription };
