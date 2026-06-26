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
    "!grid grid-cols-[1fr_auto] !items-center gap-[18px] border-b border-[var(--line-hairline)] py-[14px] -mb-[2px] last:border-b-0 dark:border-[var(--glass-border-soft)]";

export const SOURCE_PROVIDER_DETAIL_CREDENTIAL_FIELD_CLASS =
    "!grid grid-cols-[minmax(0,1fr)_auto] !items-center gap-[18px] border-b border-[var(--line-hairline)] pt-[8px] pb-[13px] mb-[2px] last:border-b-0 dark:border-[var(--glass-border-soft)]";

export const SOURCE_PROVIDER_DETAIL_FIELD_LABEL_CLASS =
    "font-sans !text-[13px] font-semibold !leading-[normal] tracking-normal !text-[var(--fg-primary)]";

export const SOURCE_PROVIDER_DETAIL_CREDENTIAL_FIELD_LABEL_CLASS =
    "!block !w-full !gap-0 font-mono !text-[11.5px] font-semibold !leading-[normal] tracking-[0.02em] !text-[var(--fg-primary)]";

export const SOURCE_PROVIDER_DETAIL_FIELD_DESCRIPTION_CLASS =
    "mt-[2px] font-sans !text-[12px] font-normal !leading-[1.5] !text-[var(--fg-tertiary)]";

export const SOURCE_PROVIDER_DETAIL_CREDENTIAL_FIELD_DESCRIPTION_CLASS =
    "!mt-[3px] !block w-full font-sans !text-[12px] font-normal !leading-[1.5] !text-[var(--fg-tertiary)]";

export const SOURCE_PROVIDER_DETAIL_FIELD_CONTENT_CLASS =
    "min-w-0 gap-0 [&_[data-slot=field-label]]:font-sans [&_[data-slot=field-label]]:text-[13px] [&_[data-slot=field-label]]:font-semibold [&_[data-slot=field-label]]:leading-[normal] [&_[data-slot=field-label]]:tracking-normal [&_[data-slot=field-label]]:text-[var(--fg-primary)] [&_[data-slot=field-description]]:mt-[2px] [&_[data-slot=field-description]]:font-sans [&_[data-slot=field-description]]:text-[12px] [&_[data-slot=field-description]]:font-normal [&_[data-slot=field-description]]:leading-[1.5] [&_[data-slot=field-description]]:text-[var(--fg-tertiary)]";

export const SOURCE_PROVIDER_DETAIL_CREDENTIAL_FIELD_CONTENT_CLASS =
    "min-w-0 gap-0 [&_[data-slot=field-label]]:mb-0 [&_[data-slot=field-label]]:font-mono [&_[data-slot=field-label]]:text-[11.5px] [&_[data-slot=field-label]]:font-semibold [&_[data-slot=field-label]]:leading-[normal] [&_[data-slot=field-label]]:tracking-[0.02em] [&_[data-slot=field-label]]:text-[var(--fg-primary)] [&_[data-slot=field-description]]:mt-[3px] [&_[data-slot=field-description]]:font-sans [&_[data-slot=field-description]]:text-[12px] [&_[data-slot=field-description]]:font-normal [&_[data-slot=field-description]]:leading-[1.5] [&_[data-slot=field-description]]:text-[var(--fg-tertiary)]";

export const SOURCE_PROVIDER_DETAIL_FIELD_CONTROL_CLASS =
    "flex flex-none items-center justify-end gap-[10px]";

export const SOURCE_PROVIDER_DETAIL_INPUT_CLASS =
    "h-[30px] w-[240px] min-w-[240px] max-w-[240px] rounded-[7px] border-[var(--line-hairline)] bg-[var(--bg-recessed)] px-[10px] py-0 font-mono text-[12px] font-medium leading-[normal] text-[var(--fg-primary)] shadow-none focus-visible:border-[var(--line-hairline)] focus-visible:ring-0 aria-invalid:border-destructive aria-invalid:ring-0 dark:bg-[var(--bg-recessed)] md:text-[12px]";

export const SOURCE_PROVIDER_DETAIL_SWITCH_CLASS =
    "relative !h-[20px] !w-[36px] border-0 bg-[var(--graphite-300)] p-0 shadow-none data-[state=checked]:!bg-[var(--accent)] dark:data-[state=unchecked]:!bg-[rgb(255_255_255_/_0.14)] [&_[data-slot=switch-thumb]]:absolute [&_[data-slot=switch-thumb]]:left-[2px] [&_[data-slot=switch-thumb]]:top-[2px] [&_[data-slot=switch-thumb]]:!size-[16px] [&_[data-slot=switch-thumb]]:bg-white [&_[data-slot=switch-thumb]]:shadow-[0_1px_1px_rgba(0,0,0,.3)] dark:[&_[data-slot=switch-thumb]]:bg-white [&_[data-slot=switch-thumb][data-state=checked]]:!translate-x-[16px] [&_[data-slot=switch-thumb][data-state=unchecked]]:!translate-x-0";

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
        field.masked && "!tracking-[0.15em]",
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
