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
}

interface SettingFieldControlProps {
    disabled?: boolean;
    field: SettingFieldDefinition;
    fieldId: string;
    onValueChange: (
        field: SettingFieldDefinition,
        value: string | boolean,
    ) => void;
    variant?: "default" | "settings";
}

export function SettingFieldControl({
    disabled = false,
    field,
    fieldId,
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
    const rowClassName = isSettingsVariant ? "sm-row" : "field-row";
    const labelWrapClassName = isSettingsVariant ? "sm-row-label" : undefined;
    const labelClassName = isSettingsVariant ? "sm-l-t" : "field-name";
    const descriptionClassName = isSettingsVariant ? "sm-l-h" : "field-desc";
    const controlWrapClassName = "sm-row-ctrl";
    const inputClassName = [
        isSettingsVariant ? "sm-input" : undefined,
        field.className,
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <FieldGroup className={rowClassName} data-field-id={field.id}>
            <Field
                data-disabled={disabled ? "true" : undefined}
                style={{ display: "contents" }}
            >
                <FieldContent className={labelWrapClassName} style={{ gap: 0 }}>
                    <FieldLabel className={labelClassName} htmlFor={fieldId}>
                        {field.label}
                    </FieldLabel>
                    {field.description ? (
                        <FieldDescription className={descriptionClassName}>
                            {field.description}
                        </FieldDescription>
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
                        />
                    )}
                </div>
            </Field>
        </FieldGroup>
    );
}
