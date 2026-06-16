"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SwitchProps
    extends Omit<
        React.ButtonHTMLAttributes<HTMLButtonElement>,
        "aria-checked" | "onChange" | "role"
    > {
    checked?: boolean;
    defaultChecked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
}

export function Switch({
    className,
    checked,
    defaultChecked = false,
    disabled,
    onCheckedChange,
    onClick,
    type = "button",
    ...props
}: SwitchProps) {
    const [uncontrolledChecked, setUncontrolledChecked] =
        React.useState(defaultChecked);
    const isControlled = typeof checked === "boolean";
    const isChecked = isControlled ? checked : uncontrolledChecked;

    return (
        <button
            {...props}
            aria-checked={isChecked}
            className={cn("toggle", isChecked && "on", className)}
            disabled={disabled}
            onClick={(event) => {
                onClick?.(event);
                if (event.defaultPrevented || disabled) return;

                const nextChecked = !isChecked;
                if (!isControlled) {
                    setUncontrolledChecked(nextChecked);
                }
                onCheckedChange?.(nextChecked);
            }}
            role="switch"
            type={type}
        >
            <span className="t-knob" />
        </button>
    );
}
