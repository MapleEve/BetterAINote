import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const spinnerVariants = cva(
    "inline-block shrink-0 animate-spin rounded-[50%] border-current border-r-transparent text-current motion-reduce:animate-none",
    {
        variants: {
            size: {
                default: "size-4 border-2",
                sm: "size-3 border-2",
                xs: "size-3 border-2",
                "2xs": "size-[10px] border-[1.5px]",
            },
            placement: {
                default: "",
                inlineStart: "mr-[6px] align-[-2px]",
                centeredBlock: "mx-auto mb-1",
            },
        },
        defaultVariants: {
            size: "default",
            placement: "default",
        },
    },
);

function Spinner({
    className,
    size = "default",
    placement = "default",
    ...props
}: React.ComponentProps<"span"> & VariantProps<typeof spinnerVariants>) {
    return (
        <span
            data-slot="spinner"
            data-placement={placement}
            className={cn(spinnerVariants({ size, placement, className }))}
            {...props}
        />
    );
}

export { Spinner, spinnerVariants };
