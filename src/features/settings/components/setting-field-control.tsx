"use client";

import {
    Field,
    FieldContent,
    FieldDescription,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface SettingFieldOption {
    value: string;
    label: string;
}

export interface SettingFieldDefinition {
    id: string;
    kind: "text" | "textarea" | "select" | "switch";
    label: string;
    value: string | boolean;
    description?: string;
    placeholder?: string;
    rows?: number;
    spellCheck?: boolean;
    className?: string;
    options?: SettingFieldOption[];
    inputType?: "text" | "password" | "number";
    sensitive?: boolean;
    readOnly?: boolean;
    masked?: boolean;
}

interface SettingFieldControlProps {
    controlClassName?: string;
    disabled?: boolean;
    field: SettingFieldDefinition;
    fieldClassName?: string;
    fieldContentClassName?: string;
    fieldId: string;
    inputClassName?: string;
    onValueChange: (
        field: SettingFieldDefinition,
        value: string | boolean,
    ) => void;
    variant?: "default" | "settings";
}

export function SettingFieldControl({
    controlClassName,
    disabled = false,
    field,
    fieldClassName: fieldClassNameProp,
    fieldContentClassName,
    fieldId,
    inputClassName: inputClassNameProp,
    onValueChange,
    variant = "default",
}: SettingFieldControlProps) {
    const handleTextValueChange = (
        event:
            | React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
            | React.FormEvent<HTMLInputElement>,
    ) => {
        onValueChange(field, event.currentTarget.value);
    };

    const isSettingsVariant = variant === "settings";
    const fieldOrientation = isSettingsVariant ? "responsive" : "horizontal";
    const fieldClassName = cn(
        "border-b border-border py-3 last:border-b-0",
        isSettingsVariant ? "gap-3 @md/field-group:gap-4" : "gap-[18px] py-2",
        fieldClassNameProp,
    );
    const controlWrapClassName = cn(
        "flex flex-none items-center gap-2",
        isSettingsVariant && "min-w-0 @md/field-group:justify-end",
        controlClassName,
    );
    const inputClassName = cn(
        isSettingsVariant && "min-w-60 max-w-full",
        inputClassNameProp,
        field.masked && "tracking-[0.15em]",
        field.className,
    );

    return (
        <FieldGroup className="gap-0" data-field-id={field.id}>
            <Field
                data-disabled={disabled ? "true" : undefined}
                orientation={fieldOrientation}
                className={fieldClassName}
            >
                <FieldContent
                    className={cn("min-w-0 gap-1", fieldContentClassName)}
                >
                    <FieldLabel htmlFor={fieldId}>{field.label}</FieldLabel>
                    {field.description ? (
                        <FieldDescription>{field.description}</FieldDescription>
                    ) : null}
                </FieldContent>
                <div className={controlWrapClassName}>
                    {field.kind === "switch" ? (
                        <Switch
                            id={fieldId}
                            checked={Boolean(field.value)}
                            onCheckedChange={(checked) =>
                                onValueChange(field, checked)
                            }
                            disabled={disabled}
                        />
                    ) : field.kind === "select" ? (
                        <Select
                            id={fieldId}
                            aria-label={field.label}
                            value={String(field.value)}
                            onValueChange={(value) =>
                                onValueChange(field, value)
                            }
                            disabled={disabled}
                            className={inputClassName}
                            options={field.options ?? []}
                        />
                    ) : field.kind === "textarea" && !field.sensitive ? (
                        <Textarea
                            id={fieldId}
                            rows={field.rows ?? 3}
                            spellCheck={field.spellCheck}
                            className={inputClassName}
                            value={String(field.value)}
                            onChange={handleTextValueChange}
                            placeholder={field.placeholder}
                            disabled={disabled}
                            readOnly={field.readOnly}
                            data-sot-mask={field.masked ? "true" : undefined}
                        />
                    ) : (
                        <Input
                            id={fieldId}
                            type={
                                field.sensitive
                                    ? "password"
                                    : (field.inputType ?? "text")
                            }
                            value={String(field.value)}
                            onChange={handleTextValueChange}
                            onInput={handleTextValueChange}
                            onPaste={
                                field.sensitive
                                    ? (event) => {
                                          const rawText =
                                              event.clipboardData.getData(
                                                  "text",
                                              );

                                          if (!rawText) {
                                              return;
                                          }

                                          event.preventDefault();
                                          onValueChange(field, rawText);
                                      }
                                    : undefined
                            }
                            placeholder={field.placeholder}
                            disabled={disabled}
                            readOnly={field.readOnly}
                            spellCheck={field.spellCheck}
                            className={inputClassName}
                            data-sot-mask={field.masked ? "true" : undefined}
                        />
                    )}
                </div>
            </Field>
        </FieldGroup>
    );
}
