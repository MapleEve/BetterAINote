"use client";

import {
    Field,
    FieldContent,
    FieldControl,
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
    disabled?: boolean;
    field: SettingFieldDefinition;
    fieldId: string;
    onValueChange: (
        field: SettingFieldDefinition,
        value: string | boolean,
    ) => void;
    variant?: "default" | "settings" | "sourceProviderDetail";
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
    const isSourceProviderDetailVariant = variant === "sourceProviderDetail";
    const fieldOrientation =
        isSettingsVariant || isSourceProviderDetailVariant
            ? "responsive"
            : "horizontal";
    const fieldVariant = isSourceProviderDetailVariant
        ? "sourceProviderDetail"
        : "settingsRow";
    const fieldClassName =
        !isSourceProviderDetailVariant && !isSettingsVariant
            ? "gap-[18px] py-2"
            : undefined;
    const fieldContentVariant = isSourceProviderDetailVariant
        ? "sourceProviderDetail"
        : "settingsContent";
    const fieldControlVariant = isSourceProviderDetailVariant
        ? "sourceProviderDetail"
        : isSettingsVariant
          ? "settingsControl"
          : "default";
    const controlVariant = isSourceProviderDetailVariant
        ? "sourceProviderDetail"
        : "default";
    const controlSize = isSourceProviderDetailVariant
        ? "sourceProviderDetail"
        : "default";
    const inputClassName = cn(
        isSettingsVariant && "min-w-60 max-w-full",
        field.masked && "tracking-[0.15em]",
        field.className,
    );

    return (
        <FieldGroup className="gap-0" data-field-id={field.id}>
            <Field
                data-field-id={field.id}
                data-disabled={disabled ? "true" : undefined}
                orientation={fieldOrientation}
                variant={fieldVariant}
                className={fieldClassName}
            >
                <FieldContent variant={fieldContentVariant}>
                    <FieldLabel htmlFor={fieldId}>{field.label}</FieldLabel>
                    {field.description ? (
                        <FieldDescription>{field.description}</FieldDescription>
                    ) : null}
                </FieldContent>
                <FieldControl variant={fieldControlVariant}>
                    {field.kind === "switch" ? (
                        <Switch
                            id={fieldId}
                            variant={controlVariant}
                            size={controlSize}
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
                            variant={controlVariant}
                            controlSize={controlSize}
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
                </FieldControl>
            </Field>
        </FieldGroup>
    );
}
