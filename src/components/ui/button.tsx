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
                actionPrimary:
                    "border border-[var(--button-primary-border)] bg-[image:var(--button-primary-bg)] text-[var(--button-primary-fg)] shadow-[var(--button-primary-shadow)] hover:bg-[image:var(--button-primary-hover-bg)]",
                actionDestructive:
                    "border border-[var(--button-destructive-border)] bg-[image:var(--button-destructive-bg)] text-[var(--button-destructive-fg)] shadow-[var(--button-destructive-shadow)] hover:bg-[image:var(--button-destructive-hover-bg)] focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
                outline:
                    "border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:hover:bg-input/50",
                secondary:
                    "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                ghost: "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
                accent:
                    "border border-transparent bg-[var(--accent)] text-white shadow-none hover:bg-[var(--accent)] focus-visible:border-primary focus-visible:ring-0",
                quietOutline:
                    "border border-[var(--line-hairline)] bg-transparent text-[var(--fg-secondary)] shadow-none hover:bg-transparent hover:text-[var(--fg-secondary)]",
                accentLink:
                    "text-[var(--accent)] underline underline-offset-auto hover:text-[var(--accent)] hover:underline",
                ghostNeutral:
                    "border border-transparent bg-transparent justify-normal [justify-content:normal] text-[var(--fg-secondary)] shadow-none hover:bg-[var(--bg-recessed)] hover:text-[var(--fg-primary)]",
                accentIcon:
                    "border border-[var(--accent)] bg-[var(--accent)] text-[var(--accent)] shadow-none hover:bg-[var(--accent-hover)] hover:text-[var(--accent)] disabled:opacity-100",
                ghostIcon:
                    "rounded-[8px] border border-transparent bg-transparent p-0 text-[var(--fg-secondary)] shadow-none hover:bg-[var(--bg-recessed)] hover:text-[var(--fg-primary)] [&_svg]:size-[16px] [&_svg]:-translate-x-[0.5px] [&_svg]:-translate-y-px [&_svg]:stroke-[1.8]",
                ghostIconCompact:
                    "border border-transparent bg-transparent p-0 text-[var(--fg-tertiary)] shadow-none hover:bg-[var(--bg-recessed)] hover:text-[var(--fg-primary)] [&_svg]:size-[11px] [&_svg]:stroke-2",
                chipRemove:
                    "border border-transparent bg-transparent p-0 text-[var(--fg-tertiary)] shadow-none hover:bg-[var(--bg-recessed)] hover:text-[var(--fg-primary)] [&_svg]:invisible [&_svg]:size-[11px] [&_svg]:stroke-2",
                pill: "relative inline-flex rounded-[999px] border border-[var(--line-hairline)] bg-[var(--bg-recessed)] text-[var(--fg-secondary)] shadow-none hover:bg-[var(--bg-elevated)] hover:text-[var(--fg-primary)] disabled:opacity-100 [&_svg]:size-[11px] [&_svg]:stroke-2",
                link: "text-primary underline-offset-4 hover:underline",
            },
            size: {
                default: "h-9 px-4 py-2 has-[>svg]:px-3",
                xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
                "control-sm":
                    "h-[var(--button-compact-height)] justify-normal [justify-content:normal] gap-[7px] rounded-[7px] px-[10px] text-[12px] leading-[normal] font-semibold has-[>svg]:px-[10px] [&_svg:not([class*='size-'])]:size-[11px]",
                "control-xs":
                    "h-[26px] gap-[6px] rounded-[8px] px-[10px] text-[11px] font-semibold leading-[normal] has-[>svg]:px-[10px]",
                "form-submit":
                    "h-[38px] rounded-[8px] px-[12px] py-0 text-[12px] font-semibold leading-[normal] has-[>svg]:px-[12px]",
                "inline-link":
                    "h-auto min-h-0 rounded-none p-0 align-baseline text-[12px] font-normal leading-[normal]",
                sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
                "pill-sm":
                    "h-[var(--button-pill-height)] justify-normal gap-[5px] px-[10px] py-0 font-sans text-[11.5px] font-semibold leading-[normal] has-[>svg]:px-[10px]",
                lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
                icon: "size-9",
                "icon-2xs": "size-[var(--icon-compact-size)] rounded-[6px]",
                "icon-chip": "size-[var(--icon-chip-size)] rounded-full",
                "icon-xs":
                    "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
                "icon-sm": "size-[32px]",
                "icon-lg": "size-10",
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
