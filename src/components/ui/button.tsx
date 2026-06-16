import type * as React from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "default" | "primary" | "danger" | "ghost" | "glass";
type ButtonSize = "default" | "sm" | "icon";

export interface ButtonProps extends React.ComponentProps<"button"> {
    variant?: ButtonVariant;
    size?: ButtonSize;
}

export function Button({
    className,
    variant = "default",
    size = "default",
    children,
    ...props
}: ButtonProps) {
    const buttonClassName = cn(
        size === "icon" ? "icon-btn" : "btn",
        variant === "primary" && "primary",
        variant === "danger" && "danger",
        variant === "ghost" && "ghost",
        variant === "glass" && "glass",
        size === "sm" && "btn-sm",
        className,
    );

    return (
        <button className={buttonClassName} {...props}>
            {children}
        </button>
    );
}

export function IconButton(props: Omit<ButtonProps, "size">) {
    return <Button size="icon" variant="ghost" {...props} />;
}
