import type * as React from "react";

import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type FieldOrientation = "vertical" | "horizontal" | "responsive";
type FieldVariant = "default";
type FieldGroupVariant = "default";
type FieldContentVariant = "default";
type FieldControlVariant = "default";
type FieldSetVariant = "default" | "pickerFrame" | "section";
type FieldSetSize = "default" | "colorPicker" | "iconPicker";
type FieldLegendVariant =
    | "legend"
    | "label"
    | "picker"
    | "sectionLabel";

const fieldSetVariantClassNames: Record<FieldSetVariant, string> = {
    default: "",
    pickerFrame: "gap-2.5 rounded-md border bg-muted/40 p-3",
    section: "gap-2",
};

const fieldSetSizeClassNames: Record<FieldSetSize, string> = {
    default: "",
    colorPicker: "min-h-[59px]",
    iconPicker: "min-h-[103px]",
};

const fieldLegendVariantClassNames: Record<FieldLegendVariant, string> = {
    legend: "mb-3 text-base font-medium",
    label: "mb-3 text-sm font-medium",
    picker: "m-0 p-0 font-mono text-[11px] leading-none font-semibold uppercase tracking-[0.06em] text-muted-foreground",
    sectionLabel:
        "mb-4 flex items-center gap-1.5 font-mono text-[10.5px] leading-none font-semibold uppercase tracking-[0.08em] text-muted-foreground",
};

const fieldGroupVariantClassNames: Record<FieldGroupVariant, string> = {
    default: "",
};

const fieldContentVariantClassNames: Record<FieldContentVariant, string> = {
    default: "gap-1.5 leading-snug",
};

const fieldControlVariantClassNames: Record<FieldControlVariant, string> = {
    default: "flex flex-none items-center gap-2",
};

function FieldSet({
    className,
    variant = "default",
    size = "default",
    ...props
}: React.ComponentProps<"fieldset"> & {
    variant?: FieldSetVariant;
    size?: FieldSetSize;
}) {
    return (
        <fieldset
            data-slot="field-set"
            data-variant={variant}
            data-size={size}
            className={cn(
                "flex flex-col gap-6 has-[>[data-slot=checkbox-group]]:gap-3 has-[>[data-slot=radio-group]]:gap-3",
                fieldSetVariantClassNames[variant],
                fieldSetSizeClassNames[size],
                className,
            )}
            {...props}
        />
    );
}

function FieldLegend({
    className,
    variant = "legend",
    ...props
}: React.ComponentProps<"legend"> & { variant?: FieldLegendVariant }) {
    return (
        <legend
            data-slot="field-legend"
            data-variant={variant}
            className={cn(fieldLegendVariantClassNames[variant], className)}
            {...props}
        />
    );
}

function FieldGroup({
    className,
    variant = "default",
    ...props
}: React.ComponentProps<"div"> & {
    variant?: FieldGroupVariant;
}) {
    return (
        <div
            data-slot="field-group"
            data-variant={variant}
            className={cn(
                "group/field-group @container/field-group flex w-full flex-col gap-7 data-[slot=checkbox-group]:gap-3 [&>[data-slot=field-group]]:gap-4",
                fieldGroupVariantClassNames[variant],
                className,
            )}
            {...props}
        />
    );
}

function fieldClassName({
    orientation,
    className,
}: {
    orientation: FieldOrientation;
    className?: string;
}) {
    return cn(
        "group/field w-full data-[invalid=true]:text-destructive",
        "flex gap-3",
        orientation === "vertical" &&
            "flex-col [&>*]:w-full [&>.sr-only]:w-auto",
        orientation === "horizontal" &&
            "flex-row items-center [&>[data-slot=field-label]]:flex-auto has-[>[data-slot=field-content]]:items-start",
        orientation === "responsive" &&
            "flex-col @md/field-group:flex-row @md/field-group:items-center [&>*]:w-full @md/field-group:[&>*]:w-auto [&>.sr-only]:w-auto @md/field-group:[&>[data-slot=field-label]]:flex-auto",
        className,
    );
}

function Field({
    className,
    orientation = "vertical",
    variant = "default",
    ...props
}: React.ComponentProps<"div"> & {
    orientation?: FieldOrientation;
    variant?: FieldVariant;
}) {
    return (
        <div
            data-slot="field"
            data-orientation={orientation}
            data-variant={variant}
            className={fieldClassName({ orientation, className })}
            {...props}
        />
    );
}

function FieldContent({
    className,
    variant = "default",
    ...props
}: React.ComponentProps<"div"> & { variant?: FieldContentVariant }) {
    return (
        <div
            data-slot="field-content"
            data-variant={variant}
            className={cn(
                "group/field-content flex flex-1 flex-col",
                fieldContentVariantClassNames[variant],
                className,
            )}
            {...props}
        />
    );
}

function FieldControl({
    className,
    variant = "default",
    ...props
}: React.ComponentProps<"div"> & { variant?: FieldControlVariant }) {
    return (
        <div
            data-slot="field-control"
            data-variant={variant}
            className={cn(fieldControlVariantClassNames[variant], className)}
            {...props}
        />
    );
}

function FieldLabel({
    className,
    ...props
}: React.ComponentProps<typeof Label>) {
    return (
        <Label
            data-slot="field-label"
            className={cn(
                "group/field-label peer/field-label flex w-fit gap-2 leading-snug group-data-[disabled=true]/field:opacity-50",
                className,
            )}
            {...props}
        />
    );
}

function FieldTitle({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="field-label"
            className={cn(
                "flex w-fit items-center gap-2 text-sm leading-snug font-medium group-data-[disabled=true]/field:opacity-50",
                className,
            )}
            {...props}
        />
    );
}

function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
    return (
        <p
            data-slot="field-description"
            className={cn(
                "text-sm leading-normal font-normal text-muted-foreground [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary",
                className,
            )}
            {...props}
        />
    );
}

function FieldSeparator({
    children,
    className,
    ...props
}: React.ComponentProps<"div"> & { children?: React.ReactNode }) {
    return (
        <div
            data-slot="field-separator"
            data-content={!!children}
            className={cn("relative -my-2 h-5 text-sm", className)}
            {...props}
        >
            <Separator className="absolute inset-0 top-1/2" />
            {children ? (
                <span
                    data-slot="field-separator-content"
                    className="relative mx-auto block w-fit bg-background px-2 text-muted-foreground"
                >
                    {children}
                </span>
            ) : null}
        </div>
    );
}

function FieldError({
    className,
    children,
    errors,
    ...props
}: React.ComponentProps<"div"> & {
    errors?: Array<{ message?: string } | undefined>;
}) {
    const content =
        children ??
        errors
            ?.map((error) => error?.message)
            .filter((message): message is string => Boolean(message))
            .join(", ");

    if (!content) {
        return null;
    }

    return (
        <div
            role="alert"
            data-slot="field-error"
            className={cn("text-sm font-normal text-destructive", className)}
            {...props}
        >
            {content}
        </div>
    );
}

export {
    Field,
    FieldLabel,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLegend,
    FieldSeparator,
    FieldSet,
    FieldContent,
    FieldControl,
    FieldTitle,
};
