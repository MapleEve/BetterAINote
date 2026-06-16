import type * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type InputGroupAddonAlign =
    | "inline-start"
    | "inline-end"
    | "block-start"
    | "block-end";

type InputGroupButtonSize = "xs" | "sm" | "icon-xs" | "icon-sm";

function InputGroup({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="input-group"
            className={cn(
                "group/input-group relative flex h-9 min-w-0 items-center rounded-md border border-input bg-background shadow-xs outline-none transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30 has-[>textarea]:h-auto",
                className,
            )}
            {...props}
        />
    );
}

function inputGroupAddonClassName({
    align,
    className,
}: {
    align: InputGroupAddonAlign;
    className?: string;
}) {
    return cn(
        "flex h-auto cursor-text items-center justify-center gap-2 py-1.5 text-sm font-medium text-muted-foreground select-none group-data-[disabled=true]/input-group:opacity-50 [&>kbd]:rounded-[calc(var(--radius-md)-5px)] [&>svg:not([class*='size-'])]:size-4",
        align === "inline-start" &&
            "order-first pl-3 has-[>button]:ml-[-0.45rem] has-[>kbd]:ml-[-0.35rem]",
        align === "inline-end" &&
            "order-last pr-3 has-[>button]:mr-[-0.45rem] has-[>kbd]:mr-[-0.35rem]",
        align === "block-start" &&
            "order-first w-full justify-start px-3 pt-3 [.border-b]:pb-3",
        align === "block-end" &&
            "order-last w-full justify-start px-3 pb-3 [.border-t]:pt-3",
        className,
    );
}

function InputGroupAddon({
    className,
    align = "inline-start",
    ...props
}: React.ComponentProps<"div"> & { align?: InputGroupAddonAlign }) {
    return (
        <div
            data-slot="input-group-addon"
            data-align={align}
            className={inputGroupAddonClassName({ align, className })}
            {...props}
        />
    );
}

function inputGroupButtonClassName({
    size,
    className,
}: {
    size: InputGroupButtonSize;
    className?: string;
}) {
    return cn(
        "flex items-center gap-2 text-sm shadow-none",
        size === "xs" &&
            "h-6 gap-1 rounded-[calc(var(--radius-md)-5px)] px-2 has-[>svg]:px-2 [&>svg:not([class*='size-'])]:size-3.5",
        size === "sm" && "h-8 gap-1.5 rounded-md px-2.5 has-[>svg]:px-2.5",
        size === "icon-xs" &&
            "size-6 rounded-[calc(var(--radius-md)-5px)] p-0 has-[>svg]:p-0",
        size === "icon-sm" && "size-8 p-0 has-[>svg]:p-0",
        className,
    );
}

function InputGroupButton({
    className,
    type = "button",
    variant = "ghost",
    size = "xs",
    ...props
}: Omit<React.ComponentProps<typeof Button>, "size"> & {
    size?: InputGroupButtonSize;
}) {
    return (
        <Button
            type={type}
            data-size={size}
            variant={variant}
            className={inputGroupButtonClassName({ size, className })}
            {...props}
        />
    );
}

function InputGroupText({ className, ...props }: React.ComponentProps<"span">) {
    return (
        <span
            className={cn(
                "flex items-center gap-2 text-sm text-muted-foreground [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
                className,
            )}
            {...props}
        />
    );
}

function InputGroupInput({
    className,
    ...props
}: React.ComponentProps<"input">) {
    return (
        <Input
            data-slot="input-group-control"
            className={cn(
                "flex-1 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0",
                className,
            )}
            {...props}
        />
    );
}

function InputGroupTextarea({
    className,
    ...props
}: React.ComponentProps<"textarea">) {
    return (
        <Textarea
            data-slot="input-group-control"
            className={cn(
                "flex-1 resize-none rounded-none border-0 bg-transparent py-3 shadow-none focus-visible:ring-0",
                className,
            )}
            {...props}
        />
    );
}

export {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupText,
    InputGroupInput,
    InputGroupTextarea,
};
