import * as React from "react";

import { cn } from "@/lib/utils";

type BadgeVariant =
    | "default"
    | "secondary"
    | "destructive"
    | "outline"
    | "ghost"
    | "link";

const badgeVariantClassNames: Record<BadgeVariant, string> = {
    default: "bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
    secondary:
        "bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
    destructive:
        "bg-destructive text-destructive-foreground [a&]:hover:bg-destructive/90",
    outline:
        "border-border text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
    ghost: "[a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
    link: "text-primary underline-offset-4 [a&]:hover:underline",
};

function SlotRoot({
    children,
    className,
    ...props
}: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) {
    const child = React.Children.only(children);

    if (!React.isValidElement<{ className?: string }>(child)) {
        return null;
    }

    return React.cloneElement(child, {
        ...(props as Partial<typeof child.props>),
        className: cn(child.props.className, className),
    });
}

function badgeVariants({
    variant = "default",
    className,
}: {
    variant?: BadgeVariant | null;
    className?: string;
} = {}) {
    return cn(
        "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&>svg]:pointer-events-none [&>svg]:size-3",
        badgeVariantClassNames[variant ?? "default"],
        className,
    );
}

function Badge({
    className,
    variant = "default",
    asChild = false,
    ...props
}: React.ComponentProps<"span"> & {
    variant?: BadgeVariant;
    asChild?: boolean;
}) {
    const Comp = asChild ? SlotRoot : "span";

    return (
        <Comp
            data-slot="badge"
            data-variant={variant}
            className={badgeVariants({ variant, className })}
            {...props}
        />
    );
}

export { Badge, badgeVariants };
