import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils";

const inputVariants = cva(
    "w-full min-w-0 border shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
    {
        variants: {
            variant: {
                default:
                    "rounded-md border-input bg-transparent text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:ring-destructive/40",
            },
            controlSize: {
                default: "h-9 px-3 py-1 text-base md:text-sm",
            },
        },
        defaultVariants: {
            variant: "default",
            controlSize: "default",
        },
    },
);

type InputProps = React.ComponentProps<"input"> &
    VariantProps<typeof inputVariants>;

export function Input({
    className,
    controlSize = "default",
    type,
    variant = "default",
    ...props
}: InputProps) {
    return (
        <input
            type={type}
            data-slot="input"
            data-variant={variant}
            data-size={controlSize}
            className={cn(inputVariants({ variant, controlSize, className }))}
            {...props}
        />
    );
}

export { inputVariants };
export type { InputProps };
