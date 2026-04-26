import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium text-foreground outline-none transition-[color,background-color,border-color,box-shadow,opacity] duration-300 ease-[var(--ease-sine)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
    {
        variants: {
            variant: {
                default:
                    "border border-primary/35 bg-primary/86 text-primary-foreground shadow-[0_4px_14px_color-mix(in_srgb,var(--primary)_16%,transparent),inset_0_1px_0_rgb(255_255_255_/_0.16)] backdrop-blur-xl enabled:hover:border-primary/48 enabled:hover:bg-primary/92 enabled:hover:shadow-[0_5px_16px_color-mix(in_srgb,var(--primary)_18%,transparent),inset_0_1px_0_rgb(255_255_255_/_0.18)] enabled:active:bg-primary/82 aria-[pressed=true]:bg-primary/82 data-[state=on]:bg-primary/82",
                destructive:
                    "border border-destructive/35 bg-destructive/88 text-destructive-foreground shadow-[0_4px_14px_color-mix(in_srgb,var(--destructive)_16%,transparent),inset_0_1px_0_rgb(255_255_255_/_0.14)] backdrop-blur-xl enabled:hover:border-destructive/52 enabled:hover:bg-destructive/94 enabled:active:bg-destructive/82 aria-[pressed=true]:bg-destructive/82 data-[state=on]:bg-destructive/82 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
                outline:
                    "glass-control text-foreground enabled:hover:bg-accent/55 enabled:hover:text-accent-foreground enabled:active:bg-accent/70 aria-[pressed=true]:bg-accent/70 aria-[pressed=true]:text-accent-foreground data-[state=on]:bg-accent/70 data-[state=on]:text-accent-foreground",
                secondary:
                    "glass-control text-secondary-foreground enabled:hover:bg-secondary/72 enabled:hover:text-secondary-foreground enabled:active:bg-secondary/82 aria-[pressed=true]:bg-secondary/82 aria-[pressed=true]:text-secondary-foreground data-[state=on]:bg-secondary/82 data-[state=on]:text-secondary-foreground",
                ghost: "border border-transparent text-muted-foreground enabled:hover:bg-accent/45 enabled:hover:text-foreground enabled:active:bg-accent/65 aria-[pressed=true]:bg-accent/65 aria-[pressed=true]:text-foreground data-[state=on]:bg-accent/65 data-[state=on]:text-foreground",
                link: "text-primary underline-offset-4 hover:underline",
            },
            size: {
                default: "h-10 px-4 py-2 has-[>svg]:px-3",
                sm: "h-9 gap-1.5 px-3 has-[>svg]:px-2.5",
                lg: "h-11 px-6 has-[>svg]:px-4",
                icon: "size-9",
                "icon-sm": "size-8",
                "icon-lg": "size-10",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    },
);

function Button({
    className,
    variant,
    size,
    asChild = false,
    ...props
}: React.ComponentProps<"button"> &
    VariantProps<typeof buttonVariants> & {
        asChild?: boolean;
    }) {
    const Comp = asChild ? Slot : "button";

    return (
        <Comp
            data-slot="button"
            className={cn(buttonVariants({ variant, size, className }))}
            {...props}
        />
    );
}

export { Button, buttonVariants };
