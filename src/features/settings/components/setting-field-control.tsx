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

export const SETTINGS_FIELD_ROW_CLASS =
    "border-b border-border py-3 last:border-b-0 @md/field-group:gap-4";

export const SETTINGS_FIELD_CONTENT_CLASS = "min-w-0 gap-1";

export const SETTINGS_FIELD_CONTROL_CLASS =
    "flex min-w-0 flex-wrap items-center justify-end gap-2 @md/field-group:justify-end";

export const SOURCE_PROVIDER_DETAIL_FIELD_CLASS =
    "border-b border-border py-3 last:border-b-0";

export const SOURCE_PROVIDER_DETAIL_CREDENTIAL_FIELD_CLASS =
    "border-b border-border py-3 last:border-b-0";

export const SOURCE_PROVIDER_DETAIL_FIELD_LABEL_CLASS = "";

export const SOURCE_PROVIDER_DETAIL_CREDENTIAL_FIELD_LABEL_CLASS = "";

export const SOURCE_PROVIDER_DETAIL_FIELD_DESCRIPTION_CLASS = "";

export const SOURCE_PROVIDER_DETAIL_CREDENTIAL_FIELD_DESCRIPTION_CLASS = "";

export const SOURCE_PROVIDER_DETAIL_FIELD_CONTENT_CLASS = "min-w-0";

export const SOURCE_PROVIDER_DETAIL_CREDENTIAL_FIELD_CONTENT_CLASS = "min-w-0";

export const SOURCE_PROVIDER_DETAIL_FIELD_CONTROL_CLASS = "justify-end";

export const SOURCE_PROVIDER_DETAIL_INPUT_CLASS =
    "w-full max-w-[15rem] bg-background font-mono shadow-none";

export const SOURCE_PROVIDER_DETAIL_SWITCH_CLASS = "";

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
    sensitiveTextareaPasswordFallback?: boolean;
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
    const isSourceProviderCredentialField =
        isSourceProviderDetailVariant && field.kind !== "switch";
    const fieldOrientation = isSettingsVariant ? "responsive" : "horizontal";
    const fieldClassName = isSourceProviderDetailVariant
        ? isSourceProviderCredentialField
            ? SOURCE_PROVIDER_DETAIL_CREDENTIAL_FIELD_CLASS
            : SOURCE_PROVIDER_DETAIL_FIELD_CLASS
        : isSettingsVariant
          ? SETTINGS_FIELD_ROW_CLASS
          : "gap-[18px] py-2";
    const fieldContentClassName = isSourceProviderDetailVariant
        ? isSourceProviderCredentialField
            ? SOURCE_PROVIDER_DETAIL_CREDENTIAL_FIELD_CONTENT_CLASS
            : SOURCE_PROVIDER_DETAIL_FIELD_CONTENT_CLASS
        : isSettingsVariant
          ? SETTINGS_FIELD_CONTENT_CLASS
          : undefined;
    const fieldControlClassName = isSourceProviderDetailVariant
        ? SOURCE_PROVIDER_DETAIL_FIELD_CONTROL_CLASS
        : isSettingsVariant
          ? SETTINGS_FIELD_CONTROL_CLASS
          : undefined;
    const sourceProviderControlClassName = isSourceProviderDetailVariant
        ? SOURCE_PROVIDER_DETAIL_INPUT_CLASS
        : undefined;
    const sourceProviderSwitchClassName = isSourceProviderDetailVariant
        ? SOURCE_PROVIDER_DETAIL_SWITCH_CLASS
        : undefined;
    const fieldLabelClassName = isSourceProviderDetailVariant
        ? isSourceProviderCredentialField
            ? SOURCE_PROVIDER_DETAIL_CREDENTIAL_FIELD_LABEL_CLASS
            : SOURCE_PROVIDER_DETAIL_FIELD_LABEL_CLASS
        : undefined;
    const fieldDescriptionClassName = isSourceProviderDetailVariant
        ? isSourceProviderCredentialField
            ? SOURCE_PROVIDER_DETAIL_CREDENTIAL_FIELD_DESCRIPTION_CLASS
            : SOURCE_PROVIDER_DETAIL_FIELD_DESCRIPTION_CLASS
        : undefined;
    const inputClassName = cn(
        isSettingsVariant && "min-w-60 max-w-full",
        sourceProviderControlClassName,
        field.masked && "tracking-widest",
        field.className,
    );

    const renderedField = (
        <Field
            data-field-id={field.id}
            data-disabled={disabled ? "true" : undefined}
            orientation={fieldOrientation}
            className={fieldClassName}
        >
            <FieldContent className={fieldContentClassName}>
                <FieldLabel className={fieldLabelClassName} htmlFor={fieldId}>
                    {field.label}
                </FieldLabel>
                {field.description ? (
                    <FieldDescription className={fieldDescriptionClassName}>
                        {field.description}
                    </FieldDescription>
                ) : null}
            </FieldContent>
            <FieldControl className={fieldControlClassName}>
                {field.kind === "switch" ? (
                    <Switch
                        id={fieldId}
                        className={sourceProviderSwitchClassName}
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
                                      const clipboardText =
                                          event.clipboardData.getData("text");

                                      if (!clipboardText) {
                                          return;
                                      }

                                      event.preventDefault();
                                      onValueChange(field, clipboardText);
                                  }
                                : undefined
                        }
                        placeholder={field.placeholder}
                        disabled={disabled}
                        readOnly={field.readOnly}
                        spellCheck={field.spellCheck}
                        className={inputClassName}
                        data-sot-mask={field.masked ? "true" : undefined}
                        data-sot-privacy-boundary={
                            field.sensitiveTextareaPasswordFallback
                                ? "sensitive-textarea-password-input"
                                : undefined
                        }
                    />
                )}
            </FieldControl>
        </Field>
    );

    if (isSourceProviderDetailVariant) {
        return renderedField;
    }

    return (
        <FieldGroup className="gap-0" data-field-id={field.id}>
            {renderedField}
        </FieldGroup>
    );
}
