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
    selectContentClassName?: string;
    variant?: "default" | "settings";
}

export function DataSourceFieldControl({
    disabled = false,
    field,
    fieldId,
    onValueChange,
    selectContentClassName,
    variant = "default",
}: DataSourceFieldControlProps) {
    const sensitiveTextField = isSensitiveTextField(field);

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
                >
                    <SelectTrigger id={fieldId} disabled={disabled}>
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
            ) : field.kind === "textarea" && !sensitiveTextField ? (
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
                    type={sensitiveTextField ? "password" : undefined}
                    value={String(field.value)}
                    onChange={(event) =>
                        onValueChange(field, event.target.value)
                    }
                    onPaste={
                        sensitiveTextField
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
