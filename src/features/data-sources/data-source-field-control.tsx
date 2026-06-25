import type React from "react";

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
import { SettingFieldControl } from "@/features/settings/components/setting-field-control";
import type { DataSourceFormField } from "@/lib/data-sources/presentation";
import { cn } from "@/lib/utils";

const SENSITIVE_FIELD_PATTERN =
    /sensitive|secret|token|cookie|password|credential|authorization/i;

const ONBOARDING_SOURCE_FIELD_GROUP_CLASS_NAME = "gap-0";
const ONBOARDING_SOURCE_FIELD_CLASS_NAME =
    "flex flex-col gap-3 border-b border-border py-3 last:border-b-0 @md/field-group:flex-row @md/field-group:items-center @md/field-group:gap-4 [&>*]:w-full @md/field-group:[&>*]:w-auto [&>.sr-only]:w-auto @md/field-group:[&>[data-slot=field-label]]:flex-auto";
const ONBOARDING_SOURCE_FIELD_CONTENT_CLASS_NAME = "min-w-0 gap-1";
const ONBOARDING_SOURCE_FIELD_CONTROL_CLASS_NAME =
    "flex min-w-0 flex-none items-center gap-2 @md/field-group:justify-end";

function isSensitiveTextField(field: DataSourceFormField) {
    return (
        field.target === "secret" ||
        SENSITIVE_FIELD_PATTERN.test(field.key) ||
        SENSITIVE_FIELD_PATTERN.test(field.id) ||
        SENSITIVE_FIELD_PATTERN.test(field.label)
    );
}

interface DataSourceFieldControlProps {
    disabled?: boolean;
    field: DataSourceFormField;
    fieldId: string;
    onValueChange: (
        field: DataSourceFormField,
        value: string | boolean,
    ) => void;
    variant?: "default" | "onboarding" | "settings" | "sourceProviderDetail";
}

export function DataSourceFieldControl({
    disabled = false,
    field,
    fieldId,
    onValueChange,
    variant = "default",
}: DataSourceFieldControlProps) {
    const readOnlyMaskedDisplay =
        field.readOnly &&
        typeof field.value === "string" &&
        field.value.includes("•");
    const sensitiveTextField = !field.readOnly && isSensitiveTextField(field);
    const renderedField = {
        ...field,
        masked: readOnlyMaskedDisplay,
        sensitive: sensitiveTextField,
    };
    const controlInputClassName = cn(
        renderedField.masked && "tracking-[0.15em]",
        renderedField.className,
    );
    const isOnboardingVariant = variant === "onboarding";

    if (variant === "settings" || variant === "sourceProviderDetail") {
        return (
            <SettingFieldControl
                disabled={disabled}
                field={renderedField}
                fieldId={fieldId}
                onValueChange={(_nextField, value) =>
                    onValueChange(field, value)
                }
                variant={variant}
            />
        );
    }

    const handleTextValueChange = (
        event:
            | React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
            | React.FormEvent<HTMLInputElement>,
    ) => {
        onValueChange(field, event.currentTarget.value);
    };

    const control = (
        <Field
            data-disabled={disabled ? "true" : undefined}
            data-field-id={field.id}
            orientation={isOnboardingVariant ? "responsive" : "horizontal"}
            className={
                isOnboardingVariant
                    ? ONBOARDING_SOURCE_FIELD_CLASS_NAME
                    : undefined
            }
        >
            <FieldContent
                className={
                    isOnboardingVariant
                        ? ONBOARDING_SOURCE_FIELD_CONTENT_CLASS_NAME
                        : undefined
                }
            >
                <FieldLabel htmlFor={fieldId}>{field.label}</FieldLabel>
                {field.description ? (
                    <FieldDescription>{field.description}</FieldDescription>
                ) : null}
            </FieldContent>
            <FieldControl
                className={
                    isOnboardingVariant
                        ? ONBOARDING_SOURCE_FIELD_CONTROL_CLASS_NAME
                        : undefined
                }
            >
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
                        onValueChange={(value) => onValueChange(field, value)}
                        disabled={disabled}
                        className={controlInputClassName}
                        options={field.options ?? []}
                    />
                ) : field.kind === "textarea" && !renderedField.sensitive ? (
                    <Textarea
                        id={fieldId}
                        rows={field.rows ?? 3}
                        spellCheck={field.spellCheck}
                        className={controlInputClassName}
                        value={String(field.value)}
                        onChange={handleTextValueChange}
                        placeholder={field.placeholder}
                        disabled={disabled}
                        readOnly={field.readOnly}
                        data-sot-mask={
                            renderedField.masked ? "true" : undefined
                        }
                    />
                ) : (
                    <Input
                        id={fieldId}
                        type={renderedField.sensitive ? "password" : "text"}
                        value={String(field.value)}
                        onChange={handleTextValueChange}
                        onInput={handleTextValueChange}
                        onPaste={
                            renderedField.sensitive
                                ? (event) => {
                                      const rawText =
                                          event.clipboardData.getData("text");

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
                        className={controlInputClassName}
                        data-sot-mask={
                            renderedField.masked ? "true" : undefined
                        }
                    />
                )}
            </FieldControl>
        </Field>
    );

    if (isOnboardingVariant) {
        return (
            <FieldGroup className={ONBOARDING_SOURCE_FIELD_GROUP_CLASS_NAME}>
                {control}
            </FieldGroup>
        );
    }

    return control;
}
