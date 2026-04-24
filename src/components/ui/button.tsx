import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium text-foreground outline-none transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-200 ease-out disabled:pointer-events-none disabled:opacity-50 enabled:hover:-translate-y-px enabled:active:translate-y-0 enabled:active:scale-[0.985] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
    {
        variants: {
            variant: {
                default:
                    "border border-primary/55 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--primary)_96%,white_16%),color-mix(in_srgb,var(--primary)_88%,black_8%))] text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.24),inset_0_-1px_0_rgba(0,0,0,0.2),0_14px_30px_rgb(0_0_0_/_0.24)] enabled:hover:border-primary/70 enabled:hover:brightness-[1.04] enabled:hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.26),inset_0_-1px_0_rgba(0,0,0,0.2),0_18px_34px_rgb(0_0_0_/_0.28)] enabled:active:brightness-[0.98] enabled:active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.14),0_8px_18px_rgb(0_0_0_/_0.2)] aria-[pressed=true]:brightness-[0.98] aria-[pressed=true]:shadow-[inset_0_2px_4px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.14),0_8px_18px_rgb(0_0_0_/_0.2)] data-[state=on]:brightness-[0.98] data-[state=on]:shadow-[inset_0_2px_4px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.14),0_8px_18px_rgb(0_0_0_/_0.2)]",
                destructive:
                    "border border-destructive/55 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--destructive)_96%,white_12%),color-mix(in_srgb,var(--destructive)_88%,black_10%))] text-destructive-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-1px_0_rgba(0,0,0,0.2),0_14px_30px_rgb(0_0_0_/_0.22)] enabled:hover:border-destructive/70 enabled:hover:brightness-[1.04] enabled:hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-1px_0_rgba(0,0,0,0.2),0_18px_34px_rgb(0_0_0_/_0.26)] enabled:active:brightness-[0.98] enabled:active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.12),0_8px_18px_rgb(0_0_0_/_0.18)] aria-[pressed=true]:brightness-[0.98] aria-[pressed=true]:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.12),0_8px_18px_rgb(0_0_0_/_0.18)] data-[state=on]:brightness-[0.98] data-[state=on]:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.12),0_8px_18px_rgb(0_0_0_/_0.18)] focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
                outline:
                    "glass-control text-foreground enabled:hover:bg-accent/70 enabled:hover:text-accent-foreground enabled:hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-1px_0_rgba(0,0,0,0.2),0_14px_30px_rgb(0_0_0_/_0.2)] enabled:active:bg-accent/82 enabled:active:text-accent-foreground enabled:active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.08),0_8px_18px_rgb(0_0_0_/_0.16)] aria-[pressed=true]:bg-accent/82 aria-[pressed=true]:text-accent-foreground aria-[pressed=true]:shadow-[inset_0_2px_4px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.08),0_8px_18px_rgb(0_0_0_/_0.16)] data-[state=on]:bg-accent/82 data-[state=on]:text-accent-foreground data-[state=on]:shadow-[inset_0_2px_4px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.08),0_8px_18px_rgb(0_0_0_/_0.16)]",
                secondary:
                    "glass-control text-secondary-foreground enabled:hover:bg-secondary/78 enabled:hover:text-secondary-foreground enabled:hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.16),inset_0_-1px_0_rgba(0,0,0,0.18),0_14px_28px_rgb(0_0_0_/_0.18)] enabled:active:bg-secondary/88 enabled:active:text-secondary-foreground enabled:active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.08),0_8px_18px_rgb(0_0_0_/_0.15)] aria-[pressed=true]:bg-secondary/88 aria-[pressed=true]:text-secondary-foreground aria-[pressed=true]:shadow-[inset_0_2px_4px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.08),0_8px_18px_rgb(0_0_0_/_0.15)] data-[state=on]:bg-secondary/88 data-[state=on]:text-secondary-foreground data-[state=on]:shadow-[inset_0_2px_4px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.08),0_8px_18px_rgb(0_0_0_/_0.15)]",
                ghost: "glass-nav-item border border-transparent text-muted-foreground enabled:hover:bg-accent/60 enabled:hover:text-foreground enabled:hover:shadow-[0_12px_22px_rgb(0_0_0_/_0.12)] enabled:active:bg-accent/78 enabled:active:text-foreground enabled:active:shadow-[inset_0_1px_2px_rgba(0,0,0,0.2),0_6px_14px_rgb(0_0_0_/_0.1)] aria-[pressed=true]:bg-accent/78 aria-[pressed=true]:text-foreground aria-[pressed=true]:shadow-[inset_0_1px_2px_rgba(0,0,0,0.2),0_6px_14px_rgb(0_0_0_/_0.1)] data-[state=on]:bg-accent/78 data-[state=on]:text-foreground data-[state=on]:shadow-[inset_0_1px_2px_rgba(0,0,0,0.2),0_6px_14px_rgb(0_0_0_/_0.1)]",
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
