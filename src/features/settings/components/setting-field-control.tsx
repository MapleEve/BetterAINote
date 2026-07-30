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

    if (variant === "sourceProviderDetail") {
        return (
            <Field
                data-field-id={field.id}
                data-disabled={disabled ? "true" : undefined}
                orientation="horizontal"
                className="border-b border-border py-3 last:border-b-0"
            >
                <FieldContent className="min-w-0">
                    <FieldLabel htmlFor={fieldId}>{field.label}</FieldLabel>
                    {field.description ? (
                        <FieldDescription>{field.description}</FieldDescription>
                    ) : null}
                </FieldContent>
                <FieldControl className="justify-end">
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
                            className={cn(
                                "w-full max-w-[15rem]",
                                field.masked && "tracking-widest",
                            )}
                            options={field.options ?? []}
                        />
                    ) : field.kind === "textarea" && !field.sensitive ? (
                        <Textarea
                            id={fieldId}
                            rows={field.rows ?? 3}
                            spellCheck={field.spellCheck}
                            className={cn(
                                "w-full max-w-[15rem]",
                                field.masked && "tracking-widest",
                            )}
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
                                          const clipboardText =
                                              event.clipboardData.getData(
                                                  "text",
                                              );

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
                            className={cn(
                                "w-full max-w-[15rem]",
                                field.masked && "tracking-widest",
                            )}
                        />
                    )}
                </FieldControl>
            </Field>
        );
    }

    if (variant === "settings") {
        return (
            <FieldGroup className="gap-0" data-field-id={field.id}>
                <Field
                    data-field-id={field.id}
                    data-disabled={disabled ? "true" : undefined}
                    orientation="responsive"
                    className="border-b border-border py-3 last:border-b-0 @md/field-group:gap-4"
                >
                    <FieldContent className="min-w-0 gap-1">
                        <FieldLabel htmlFor={fieldId}>{field.label}</FieldLabel>
                        {field.description ? (
                            <FieldDescription>
                                {field.description}
                            </FieldDescription>
                        ) : null}
                    </FieldContent>
                    <FieldControl className="flex min-w-0 flex-wrap items-center justify-end gap-2 @md/field-group:justify-end">
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
                                className={cn(
                                    "min-w-60 max-w-full",
                                    field.masked && "tracking-widest",
                                )}
                                options={field.options ?? []}
                            />
                        ) : field.kind === "textarea" && !field.sensitive ? (
                            <Textarea
                                id={fieldId}
                                rows={field.rows ?? 3}
                                spellCheck={field.spellCheck}
                                className={cn(
                                    "min-w-60 max-w-full",
                                    field.masked && "tracking-widest",
                                )}
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
                                              const clipboardText =
                                                  event.clipboardData.getData(
                                                      "text",
                                                  );

                                              if (!clipboardText) {
                                                  return;
                                              }

                                              event.preventDefault();
                                              onValueChange(
                                                  field,
                                                  clipboardText,
                                              );
                                          }
                                        : undefined
                                }
                                placeholder={field.placeholder}
                                disabled={disabled}
                                readOnly={field.readOnly}
                                spellCheck={field.spellCheck}
                                className={cn(
                                    "min-w-60 max-w-full",
                                    field.masked && "tracking-widest",
                                )}
                            />
                        )}
                    </FieldControl>
                </Field>
            </FieldGroup>
        );
    }

    return (
        <FieldGroup className="gap-0" data-field-id={field.id}>
            <Field
                data-field-id={field.id}
                data-disabled={disabled ? "true" : undefined}
                orientation="horizontal"
                className="gap-[18px] py-2"
            >
                <FieldContent>
                    <FieldLabel htmlFor={fieldId}>{field.label}</FieldLabel>
                    {field.description ? (
                        <FieldDescription>{field.description}</FieldDescription>
                    ) : null}
                </FieldContent>
                <FieldControl>
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
                            className={cn(field.masked && "tracking-widest")}
                            options={field.options ?? []}
                        />
                    ) : field.kind === "textarea" && !field.sensitive ? (
                        <Textarea
                            id={fieldId}
                            rows={field.rows ?? 3}
                            spellCheck={field.spellCheck}
                            className={cn(field.masked && "tracking-widest")}
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
                                          const clipboardText =
                                              event.clipboardData.getData(
                                                  "text",
                                              );

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
                            className={cn(field.masked && "tracking-widest")}
                        />
                    )}
                </FieldControl>
            </Field>
        </FieldGroup>
    );
}
