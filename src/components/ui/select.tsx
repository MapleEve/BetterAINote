"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

const EMPTY_OPTION_VALUE = "__select_empty_option_value__";

type SelectDataAttributes = {
    [key: `data-${string}`]: string | number | boolean | undefined;
};

export interface SelectOption {
    disabled?: boolean;
    label: React.ReactNode;
    value: string;
}

type SelectRootProps = React.ComponentProps<typeof SelectPrimitive.Root>;

export type SelectProps = Omit<SelectRootProps, "children" | "onValueChange"> &
    React.AriaAttributes &
    SelectDataAttributes & {
        children?: React.ReactNode;
        className?: string;
        contentClassName?: string;
        id?: string;
        onChange?: React.ChangeEventHandler<HTMLSelectElement>;
        onValueChange?: (value: string) => void;
        options?: SelectOption[];
        placeholder?: React.ReactNode;
        viewportClassName?: string;
        wrapperClassName?: string;
    };

function toRadixValue(value: string): string;
function toRadixValue(value: undefined): undefined;
function toRadixValue(value: string | undefined): string | undefined;
function toRadixValue(value: string | undefined) {
    return value === "" ? EMPTY_OPTION_VALUE : value;
}

function fromRadixValue(value: string) {
    return value === EMPTY_OPTION_VALUE ? "" : value;
}

function createSelectChangeEvent(value: string) {
    return {
        currentTarget: { value },
        target: { value },
    } as React.ChangeEvent<HTMLSelectElement>;
}

function Select({
    autoComplete,
    children,
    className,
    contentClassName,
    defaultOpen,
    defaultValue,
    dir,
    disabled,
    form,
    name,
    onChange,
    onOpenChange,
    onValueChange,
    open,
    options,
    placeholder,
    required,
    value,
    viewportClassName,
    wrapperClassName,
    ...triggerProps
}: SelectProps) {
    const isOptionsSelect = Array.isArray(options);
    const fallbackDefaultValue =
        isOptionsSelect && value === undefined && defaultValue === undefined
            ? options.find((option) => !option.disabled)?.value
            : defaultValue;
    const rootValue = isOptionsSelect ? toRadixValue(value) : value;
    const rootDefaultValue = isOptionsSelect
        ? toRadixValue(fallbackDefaultValue)
        : defaultValue;
    const handleValueChange = React.useCallback(
        (nextValue: string) => {
            const externalValue = fromRadixValue(nextValue);
            onValueChange?.(externalValue);
            onChange?.(createSelectChangeEvent(externalValue));
        },
        [onChange, onValueChange],
    );

    const rootProps: SelectRootProps = {
        autoComplete,
        defaultOpen,
        defaultValue: rootDefaultValue,
        dir,
        disabled,
        form,
        name,
        onOpenChange,
        onValueChange: handleValueChange,
        open,
        required,
        value: rootValue,
    };

    if (!isOptionsSelect) {
        return (
            <SelectPrimitive.Root data-slot="select" {...rootProps}>
                {children}
            </SelectPrimitive.Root>
        );
    }

    return (
        <SelectPrimitive.Root data-slot="select" {...rootProps}>
            <SelectTrigger
                {...triggerProps}
                className={cn(wrapperClassName, className)}
            >
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent
                className={contentClassName}
                viewportClassName={viewportClassName}
            >
                <SelectGroup>
                    {options.map((option) => (
                        <SelectItem
                            disabled={option.disabled}
                            key={toRadixValue(option.value)}
                            value={toRadixValue(option.value)}
                        >
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectGroup>
            </SelectContent>
        </SelectPrimitive.Root>
    );
}

function SelectGroup({
    ...props
}: React.ComponentProps<typeof SelectPrimitive.Group>) {
    return <SelectPrimitive.Group data-slot="select-group" {...props} />;
}

function SelectValue({
    ...props
}: React.ComponentProps<typeof SelectPrimitive.Value>) {
    return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

function SelectTrigger({
    className,
    children,
    size = "default",
    ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
    size?: "default" | "sm";
}) {
    return (
        <SelectPrimitive.Trigger
            data-slot="select-trigger"
            data-size={size}
            className={cn(
                "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] data-[placeholder]:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[size=sm]:h-8 [&>span]:truncate [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:[height:1rem] [&_svg]:[width:1rem]",
                className,
            )}
            {...props}
        >
            {children}
            <SelectPrimitive.Icon asChild>
                <ChevronDownIcon className="opacity-50" />
            </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
    );
}

function SelectContent({
    className,
    children,
    position = "popper",
    viewportClassName,
    ...props
}: React.ComponentProps<typeof SelectPrimitive.Content> & {
    viewportClassName?: string;
}) {
    return (
        <SelectPrimitive.Portal>
            <SelectPrimitive.Content
                data-slot="select-content"
                className={cn(
                    "relative z-[calc(var(--z-modal)_+_2)] max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
                    position === "popper" &&
                        "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
                    className,
                )}
                position={position}
                {...props}
            >
                <SelectScrollUpButton />
                <SelectViewport
                    className={cn(
                        position === "popper" &&
                            "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)] scroll-my-1",
                        viewportClassName,
                    )}
                >
                    {children}
                </SelectViewport>
                <SelectScrollDownButton />
            </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
    );
}

function SelectViewport({
    className,
    ...props
}: React.ComponentProps<typeof SelectPrimitive.Viewport>) {
    return (
        <SelectPrimitive.Viewport
            data-slot="select-viewport"
            className={cn("p-1", className)}
            {...props}
        />
    );
}

function SelectLabel({
    className,
    ...props
}: React.ComponentProps<typeof SelectPrimitive.Label>) {
    return (
        <SelectPrimitive.Label
            data-slot="select-label"
            className={cn(
                "px-2 py-1.5 text-xs font-medium text-muted-foreground",
                className,
            )}
            {...props}
        />
    );
}

function SelectItem({
    className,
    children,
    ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
    return (
        <SelectPrimitive.Item
            data-slot="select-item"
            className={cn(
                "relative flex w-full cursor-default select-none items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:[height:1rem] [&_svg]:[width:1rem]",
                className,
            )}
            {...props}
        >
            <span className="absolute right-2 flex size-3.5 items-center justify-center">
                <SelectPrimitive.ItemIndicator>
                    <CheckIcon />
                </SelectPrimitive.ItemIndicator>
            </span>
            <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
        </SelectPrimitive.Item>
    );
}

function SelectSeparator({
    className,
    ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
    return (
        <SelectPrimitive.Separator
            data-slot="select-separator"
            className={cn("-mx-1 my-1 h-px bg-border", className)}
            {...props}
        />
    );
}

function SelectScrollUpButton({
    className,
    ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
    return (
        <SelectPrimitive.ScrollUpButton
            data-slot="select-scroll-up-button"
            className={cn(
                "flex cursor-default items-center justify-center py-1 [&_svg]:[height:1rem] [&_svg]:[width:1rem]",
                className,
            )}
            {...props}
        >
            <ChevronUpIcon />
        </SelectPrimitive.ScrollUpButton>
    );
}

function SelectScrollDownButton({
    className,
    ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
    return (
        <SelectPrimitive.ScrollDownButton
            data-slot="select-scroll-down-button"
            className={cn(
                "flex cursor-default items-center justify-center py-1 [&_svg]:[height:1rem] [&_svg]:[width:1rem]",
                className,
            )}
            {...props}
        >
            <ChevronDownIcon />
        </SelectPrimitive.ScrollDownButton>
    );
}

export {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectScrollDownButton,
    SelectScrollUpButton,
    SelectSeparator,
    SelectTrigger,
    SelectValue,
    SelectViewport,
};
