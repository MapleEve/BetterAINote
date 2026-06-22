import type * as React from "react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type InputGroupAddonAlign =
    | "inline-start"
    | "inline-end"
    | "block-start"
    | "block-end";

type InputGroupVariant =
    | "default"
    | "compact"
    | "librarySearchInputRow"
    | "recordingTagCreateRow"
    | "recordingTagNameInput";
type InputGroupButtonSize =
    | "xs"
    | "sm"
    | "icon-xs"
    | "icon-sm"
    | "icon-compact"
    | "librarySearchClear"
    | "speakerReviewMappingClear";
type InputGroupButtonVariant =
    | NonNullable<ButtonProps["variant"]>
    | "librarySearchClear"
    | "speakerReviewMappingClear";

const inputGroupVariantClassNames: Record<InputGroupVariant, string> = {
    default: "h-9 rounded-md border border-input bg-background shadow-xs",
    compact: "h-[30px] gap-[6px] border-0 bg-transparent shadow-none",
    librarySearchInputRow:
        "h-auto min-h-12 gap-2 rounded-none border-x-0 border-t-0 border-b border-border bg-transparent px-3 py-2 shadow-none focus-within:ring-0",
    recordingTagCreateRow:
        "h-[30px] gap-[6px] border-0 bg-transparent shadow-none",
    recordingTagNameInput:
        "h-[30px] gap-[6px] border-0 bg-transparent shadow-none",
};

const inputGroupInputVariantClassNames: Record<InputGroupVariant, string> = {
    default: "",
    compact:
        "h-[30px] rounded-[7px] border border-[var(--input-compact-border)] bg-[var(--input-compact-bg)] px-[10px] py-0 font-mono text-[12px] font-medium text-[var(--fg-primary)] placeholder:text-[var(--fg-tertiary)] md:text-[12px] dark:bg-[var(--input-compact-bg)]",
    librarySearchInputRow:
        "h-8 px-1 text-sm font-medium md:text-sm",
    recordingTagCreateRow:
        "h-[30px] rounded-[7px] border border-[var(--input-compact-border)] bg-[var(--input-compact-bg)] px-[10px] py-0 font-mono text-[12px] font-medium text-[var(--fg-primary)] placeholder:text-[var(--fg-tertiary)] md:text-[12px] dark:bg-[var(--input-compact-bg)]",
    recordingTagNameInput:
        "h-[30px] rounded-[7px] border border-[var(--input-compact-border)] bg-[var(--input-compact-bg)] px-[10px] py-0 font-mono text-[12px] font-medium text-[var(--fg-primary)] placeholder:text-[var(--fg-tertiary)] md:text-[12px] dark:bg-[var(--input-compact-bg)]",
};

const inputGroupButtonVariantClassNames: Partial<
    Record<InputGroupButtonVariant, string>
> = {
    speakerReviewMappingClear:
        "text-[var(--fg-secondary)] hover:bg-[var(--bg-recessed)] hover:text-[var(--fg-primary)]",
};

function resolveInputGroupButtonVariant(
    variant: InputGroupButtonVariant,
): ButtonProps["variant"] {
    if (variant === "librarySearchClear") return "librarySearchClear";
    return variant === "speakerReviewMappingClear"
        ? "speakerReviewGhostAction"
        : variant;
}

function InputGroup({
    className,
    variant = "default",
    ...props
}: React.ComponentProps<"div"> & { variant?: InputGroupVariant }) {
    return (
        <div
            data-slot="input-group"
            data-variant={variant}
            className={cn(
                "group/input-group relative flex min-w-0 items-center outline-none transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30 has-[>textarea]:h-auto",
                inputGroupVariantClassNames[variant],
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
            "order-first pl-3 has-[>button]:ml-[-0.45rem] has-[>kbd]:ml-[-0.35rem] group-data-[variant=compact]/input-group:pl-0 group-data-[variant=compact]/input-group:has-[>button]:ml-0 group-data-[variant=compact]/input-group:has-[>kbd]:ml-0 group-data-[variant=recordingTagCreateRow]/input-group:pl-0 group-data-[variant=recordingTagCreateRow]/input-group:has-[>button]:ml-0 group-data-[variant=recordingTagCreateRow]/input-group:has-[>kbd]:ml-0",
        align === "inline-end" &&
            "order-last pr-3 has-[>button]:mr-[-0.45rem] has-[>kbd]:mr-[-0.35rem] group-data-[variant=compact]/input-group:pr-0 group-data-[variant=compact]/input-group:has-[>button]:mr-0 group-data-[variant=compact]/input-group:has-[>kbd]:mr-0 group-data-[variant=recordingTagCreateRow]/input-group:pr-0 group-data-[variant=recordingTagCreateRow]/input-group:has-[>button]:mr-0 group-data-[variant=recordingTagCreateRow]/input-group:has-[>kbd]:mr-0",
        "group-data-[variant=librarySearchInputRow]/input-group:p-0 group-data-[variant=librarySearchInputRow]/input-group:has-[>button]:m-0",
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
    variant,
    className,
}: {
    size: InputGroupButtonSize;
    variant: InputGroupButtonVariant;
    className?: string;
}) {
    return cn(
        "flex items-center gap-2 text-sm shadow-none",
        inputGroupButtonVariantClassNames[variant],
        size === "xs" &&
            "h-6 gap-1 rounded-[calc(var(--radius-md)-5px)] px-2 has-[>svg]:px-2 [&>svg:not([class*='size-'])]:size-3.5",
        size === "sm" && "h-8 gap-1.5 rounded-md px-2.5 has-[>svg]:px-2.5",
        size === "icon-xs" &&
            "size-6 rounded-[calc(var(--radius-md)-5px)] p-0 has-[>svg]:p-0",
        size === "icon-sm" && "size-8 p-0 has-[>svg]:p-0",
        size === "icon-compact" &&
            "size-[30px] rounded-[6px] p-0 text-[14px] leading-[0] font-semibold has-[>svg]:p-0 [&>svg:not([class*='size-'])]:size-[14px]",
        size === "librarySearchClear" &&
            "size-6 rounded-[calc(var(--radius-md)-5px)] p-0 has-[>svg]:p-0 [&>svg:not([class*='size-'])]:size-3",
        size === "speakerReviewMappingClear" &&
            "size-6 rounded-[calc(var(--radius-md)-5px)] p-0 has-[>svg]:p-0 [&>svg:not([class*='size-'])]:size-3",
        className,
    );
}

function InputGroupButton({
    className,
    type = "button",
    variant = "ghost",
    size = "xs",
    ...props
}: Omit<ButtonProps, "size" | "variant"> & {
    size?: InputGroupButtonSize;
    variant?: InputGroupButtonVariant;
}) {
    return (
        <Button
            type={type}
            data-size={size}
            data-input-group-variant={variant}
            variant={resolveInputGroupButtonVariant(variant)}
            className={inputGroupButtonClassName({
                size,
                variant,
                className,
            })}
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
    variant = "default",
    ...props
}: React.ComponentProps<"input"> & { variant?: InputGroupVariant }) {
    return (
        <Input
            data-slot="input-group-control"
            data-variant={variant}
            className={cn(
                "flex-1 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0",
                inputGroupInputVariantClassNames[variant],
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
