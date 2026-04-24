import type { DataSourceFormField } from "./presentation-definition-types";

export function buildTextField(
    params: Omit<DataSourceFormField, "target" | "kind"> & {
        target?: DataSourceFormField["target"];
    },
): DataSourceFormField {
    return {
        target: params.target ?? "config",
        kind: "text",
        ...params,
    };
}

export function buildTextareaField(
    params: Omit<DataSourceFormField, "target" | "kind"> & {
        target?: DataSourceFormField["target"];
    },
): DataSourceFormField {
    return {
        target: params.target ?? "config",
        kind: "textarea",
        ...params,
    };
}

export function buildSelectField(
    params: Omit<DataSourceFormField, "target" | "kind"> & {
        target?: DataSourceFormField["target"];
    },
): DataSourceFormField {
    return {
        target: params.target ?? "config",
        kind: "select",
        ...params,
    };
}
