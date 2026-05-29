"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
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
}

interface SettingFieldControlProps {
    disabled?: boolean;
    field: SettingFieldDefinition;
    fieldId: string;
    onValueChange: (
        field: SettingFieldDefinition,
        value: string | boolean,
    ) => void;
    selectContentClassName?: string;
    variant?: "default" | "settings";
}

export function SettingFieldControl({
    disabled = false,
    field,
    fieldId,
    onValueChange,
    selectContentClassName,
    variant = "default",
}: SettingFieldControlProps) {
    if (field.kind === "switch") {
        return (
            <div
                className={
                    variant === "settings"
                        ? "flex items-center justify-between rounded-2xl border bg-muted/35 px-4 py-3"
                        : "flex items-center justify-between gap-4 rounded-xl border bg-muted/20 px-4 py-3"
                }
            >
                <div className="flex flex-col gap-1">
                    <Label htmlFor={fieldId} className="text-base">
                        {field.label}
                    </Label>
                    {field.description ? (
                        <p className="text-sm text-muted-foreground">
                            {field.description}
                        </p>
                    ) : null}
                </div>
                <Switch
                    id={fieldId}
                    checked={Boolean(field.value)}
                    onCheckedChange={(checked) => onValueChange(field, checked)}
                    disabled={disabled}
                />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            <Label htmlFor={fieldId}>{field.label}</Label>
            {field.description ? (
                <p className="text-xs text-muted-foreground">
                    {field.description}
                </p>
            ) : null}
            {field.kind === "select" ? (
                <Select
                    value={String(field.value)}
                    onValueChange={(value) => onValueChange(field, value)}
                    disabled={disabled}
                >
                    <SelectTrigger id={fieldId}>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className={selectContentClassName}>
                        <SelectGroup>
                            {(field.options ?? []).map((option) => (
                                <SelectItem
                                    key={option.value}
                                    value={option.value}
                                >
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectGroup>
                    </SelectContent>
                </Select>
            ) : field.kind === "textarea" && !field.sensitive ? (
                <Textarea
                    id={fieldId}
                    rows={field.rows ?? 3}
                    spellCheck={field.spellCheck}
                    className={field.className}
                    value={String(field.value)}
                    onChange={(event) =>
                        onValueChange(field, event.target.value)
                    }
                    placeholder={field.placeholder}
                    disabled={disabled}
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
                    onChange={(event) =>
                        onValueChange(field, event.target.value)
                    }
                    onPaste={
                        field.sensitive
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
                    spellCheck={field.spellCheck}
                    className={field.className}
                />
            )}
        </div>
    );
}
