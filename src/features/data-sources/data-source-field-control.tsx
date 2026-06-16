import type React from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SettingFieldControl } from "@/features/settings/components/setting-field-control";
import type { DataSourceFormField } from "@/lib/data-sources/presentation";

const SENSITIVE_FIELD_PATTERN =
    /sensitive|secret|token|cookie|password|credential|authorization/i;

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
    variant?: "default" | "settings";
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
    const className = readOnlyMaskedDisplay
        ? [field.className, "mask"].filter(Boolean).join(" ")
        : field.className;
    const renderedField = {
        ...field,
        className,
        sensitive: sensitiveTextField,
    };

    if (variant === "settings") {
        return (
            <SettingFieldControl
                disabled={disabled}
                field={renderedField}
                fieldId={fieldId}
                onValueChange={(_nextField, value) =>
                    onValueChange(field, value)
                }
                variant="settings"
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

    return (
        <div className="field-row ds-field-row" data-field-id={field.id}>
            <div>
                <Label className="field-name" htmlFor={fieldId}>
                    {field.label}
                </Label>
                {field.description ? (
                    <div className="field-desc">{field.description}</div>
                ) : null}
            </div>
            <div className="sm-row-ctrl">
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
                        options={field.options ?? []}
                    />
                ) : field.kind === "textarea" && !renderedField.sensitive ? (
                    <Textarea
                        id={fieldId}
                        rows={field.rows ?? 3}
                        spellCheck={field.spellCheck}
                        className={renderedField.className}
                        value={String(field.value)}
                        onChange={handleTextValueChange}
                        placeholder={field.placeholder}
                        disabled={disabled}
                        readOnly={field.readOnly}
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
                        className={renderedField.className}
                    />
                )}
            </div>
        </div>
    );
}
