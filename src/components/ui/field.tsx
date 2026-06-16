import type * as React from "react";

import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type FieldOrientation = "vertical" | "horizontal" | "responsive";

function FieldSet({ className, ...props }: React.ComponentProps<"fieldset">) {
    return (
        <fieldset
            data-slot="field-set"
            className={cn(
                "flex flex-col gap-6 has-[>[data-slot=checkbox-group]]:gap-3 has-[>[data-slot=radio-group]]:gap-3",
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
}: React.ComponentProps<"legend"> & { variant?: "legend" | "label" }) {
    return (
        <legend
            data-slot="field-legend"
            data-variant={variant}
            className={cn(
                "mb-3 font-medium data-[variant=label]:text-sm data-[variant=legend]:text-base",
                className,
            )}
            {...props}
        />
    );
}

function FieldGroup({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="field-group"
            className={cn(
                "group/field-group @container/field-group flex w-full flex-col gap-7 data-[slot=checkbox-group]:gap-3 [&>[data-slot=field-group]]:gap-4",
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
        "group/field flex w-full gap-3 data-[invalid=true]:text-destructive",
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
    ...props
}: React.ComponentProps<"div"> & { orientation?: FieldOrientation }) {
    return (
        <div
            data-slot="field"
            data-orientation={orientation}
            className={fieldClassName({ orientation, className })}
            {...props}
        />
    );
}

function FieldContent({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="field-content"
            className={cn(
                "group/field-content flex flex-1 flex-col gap-1.5 leading-snug",
                className,
            )}
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
    FieldTitle,
};
