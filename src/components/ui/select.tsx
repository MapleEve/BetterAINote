"use client";

import type * as React from "react";
import { cn } from "@/lib/utils";

export interface SelectOption {
    disabled?: boolean;
    label: string;
    value: string;
}

export interface SelectProps
    extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "children"> {
    onValueChange?: (value: string) => void;
    options: SelectOption[];
    wrapperClassName?: string;
}

export function Select({
    className,
    disabled,
    onChange,
    onValueChange,
    options,
    wrapperClassName,
    ...props
}: SelectProps) {
    return (
        <select
            {...props}
            className={cn("select", wrapperClassName, className)}
            disabled={disabled}
            onChange={(event) => {
                onChange?.(event);
                onValueChange?.(event.currentTarget.value);
            }}
        >
            {options.map((item) => (
                <option
                    disabled={item.disabled}
                    key={item.value}
                    value={item.value}
                >
                    {item.label}
                </option>
            ))}
        </select>
    );
}
