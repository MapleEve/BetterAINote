import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium outline-none transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
    {
        variants: {
            variant: {
                default:
                    "bg-primary text-primary-foreground hover:bg-primary/90",
                destructive:
                    "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
                outline:
                    "border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:hover:bg-input/50",
                secondary:
                    "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                ghost: "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
                link: "text-primary underline-offset-4 hover:underline",
                primary:
                    "bg-primary text-primary-foreground hover:bg-primary/90",
                player:
                    "border border-[var(--button-player-border)] bg-[var(--button-player-bg)] font-normal text-[var(--button-player-fg)] [box-shadow:var(--shadow-xs)] hover:bg-[var(--button-player-hover-bg)] hover:text-[var(--button-player-hover-fg)] active:scale-[0.96]",
                "player-primary":
                    "border border-[var(--button-player-primary-border)] [background:var(--button-player-primary-bg)] font-normal text-white [box-shadow:var(--button-player-primary-shadow)] hover:text-white active:scale-[0.96]",
                "player-speed-compact":
                    "justify-center border border-transparent bg-transparent font-mono text-[12.5px] font-semibold leading-normal text-[var(--fg-secondary)] shadow-none hover:bg-[var(--bg-recessed)] hover:text-[var(--fg-primary)] active:translate-y-[0.5px]",
                "compact-ghost":
                    "border border-transparent bg-transparent text-[12px] font-semibold text-[var(--fg-secondary)] shadow-none hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
                copy: "border border-transparent bg-transparent font-semibold text-[var(--fg-secondary)] shadow-none hover:bg-[var(--bg-recessed)] hover:text-[var(--fg-primary)]",
                "copy-success":
                    "border border-[var(--button-copy-success-border)] bg-[var(--button-copy-success-bg)] font-semibold text-[var(--signal-success)] shadow-none hover:bg-[var(--button-copy-success-bg)] hover:text-[var(--signal-success)]",
                "copy-danger":
                    "border border-[var(--button-copy-danger-border)] bg-transparent font-semibold text-[var(--signal-danger)] shadow-none hover:bg-transparent hover:text-[var(--signal-danger)]",
                danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
            },
            size: {
                default: "h-9 px-4 py-2 has-[>svg]:px-3",
                xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
                sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
                lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
                icon: "size-9",
                "icon-xs":
                    "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
                "icon-sm": "size-8",
                "icon-lg": "size-10",
                player:
                    "size-[36px] rounded-[50%] px-[6px] py-px text-[13.3333px]",
                "player-sm":
                    "size-[30px] rounded-[50%] px-[6px] py-px text-[13.3333px]",
                "player-lg":
                    "size-[44px] rounded-[50%] px-[6px] py-px text-[13.3333px]",
                "player-speed":
                    "h-[32px] min-w-[50px] rounded-[9px] px-[12px]",
                compact: "h-[26px] gap-[7px] rounded-[7px] px-[10px]",
                copy: "h-[26px] gap-[6px] rounded-[7px] px-[10px] text-[12px] leading-normal [&_svg:not([class*='size-'])]:size-[14px]",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    },
);

type ButtonProps = React.ComponentProps<"button"> &
    VariantProps<typeof buttonVariants> & {
        asChild?: boolean;
    };

function Button({
    className,
    variant = "default",
    size = "default",
    asChild = false,
    ...props
}: ButtonProps) {
    const Comp = asChild ? Slot : "button";

    return (
        <Comp
            data-slot="button"
            data-variant={variant}
            data-size={size}
            className={cn(buttonVariants({ variant, size, className }))}
            {...props}
        />
    );
}

function IconButton(props: Omit<ButtonProps, "size">) {
    return <Button size="icon" variant="ghost" {...props} />;
}

export { Button, IconButton, buttonVariants };
export type { ButtonProps };
