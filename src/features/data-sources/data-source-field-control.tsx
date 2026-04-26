import { SettingFieldControl } from "@/components/settings/setting-field-control";
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

    return (
        <SettingFieldControl
            disabled={disabled}
            field={{ ...field, sensitive: sensitiveTextField }}
            fieldId={fieldId}
            onValueChange={(_nextField, value) => onValueChange(field, value)}
            selectContentClassName={selectContentClassName}
            variant={variant}
        />
    );
}
