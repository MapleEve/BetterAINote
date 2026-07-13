import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { DataSourceFieldControl } from "@/features/data-sources/data-source-field-control";
import type { DataSourceFormField } from "@/lib/data-sources/presentation";

function field(
    overrides: Partial<DataSourceFormField> = {},
): DataSourceFormField {
    return {
        id: "source-field",
        target: "config",
        key: "sourceField",
        kind: "text",
        label: "Source field",
        description: "A source field description.",
        value: "current value",
        ...overrides,
    };
}

function elementOfType(
    element: React.ReactNode,
    type: React.ElementType,
): React.ReactElement<Record<string, unknown>> | undefined {
    if (!React.isValidElement<Record<string, unknown>>(element)) {
        return undefined;
    }

    if (element.type === type) {
        return element;
    }

    const children = React.Children.toArray(
        element.props.children as React.ReactNode,
    );
    for (const child of children) {
        const match = elementOfType(child, type);
        if (match) {
            return match;
        }
    }

    return undefined;
}

function renderControl(
    nextField: DataSourceFormField,
    props: Partial<React.ComponentProps<typeof DataSourceFieldControl>> = {},
) {
    return DataSourceFieldControl({
        field: nextField,
        fieldId: "source-field-control",
        onValueChange: vi.fn(),
        ...props,
    });
}

describe("DataSourceFieldControl semantic regression", () => {
    it("links labels and descriptions while preserving visible field semantics", () => {
        const html = renderToStaticMarkup(
            renderControl(
                field({
                    id: "masked-source-field",
                    readOnly: true,
                    value: "••••••",
                }),
            ),
        );

        expect(html).toMatch(
            /<label[^>]*for="source-field-control"[^>]*>Source field<\/label>/,
        );
        expect(html).toContain('id="source-field-control-description"');
        expect(html).toContain(
            'aria-describedby="source-field-control-description"',
        );
        expect(html).toContain('value="••••••"');
        expect(html).toContain("tracking-[0.15em]");
        expect(html).toMatch(
            /<input[^>]*id="source-field-control"[^>]*readonly[^>]*>/i,
        );
    });

    it("uses semantic password inputs for sensitive textareas", () => {
        const html = renderToStaticMarkup(
            renderControl(
                field({
                    id: "source-secret",
                    target: "secret",
                    key: "loginPayload",
                    kind: "textarea",
                    label: "Login payload",
                    value: "secret value",
                }),
            ),
        );

        expect(html).toMatch(
            /<input[^>]*type="password"[^>]*id="source-field-control"/,
        );
        expect(html).not.toContain("<textarea");
        expect(html).toContain('value="secret value"');
        expect(html).toContain(
            'aria-describedby="source-field-control-description"',
        );
    });

    it.each([
        ["text", Input],
        ["textarea", Textarea],
        ["select", Select],
        ["switch", Switch],
    ] as const)("preserves the %s control callback contract", (kind, type) => {
        const onValueChange = vi.fn();
        const nextField = field({
            kind,
            value: kind === "switch" ? true : "current value",
            options:
                kind === "select"
                    ? [{ label: "Current", value: "current value" }]
                    : undefined,
        });
        const tree = DataSourceFieldControl({
            field: nextField,
            fieldId: "source-field-control",
            onValueChange,
        });
        const control = elementOfType(tree, type);

        expect(control).toBeDefined();

        if (kind === "switch") {
            const onCheckedChange = control?.props.onCheckedChange as
                | ((checked: boolean) => void)
                | undefined;
            onCheckedChange?.(false);
        } else if (kind === "select") {
            const onSelectValueChange = control?.props.onValueChange as
                | ((value: string) => void)
                | undefined;
            onSelectValueChange?.("next value");
        } else {
            const onChange = control?.props.onChange as
                | ((event: { currentTarget: { value: string } }) => void)
                | undefined;
            onChange?.({
                currentTarget: { value: "next value" },
            });
        }

        expect(onValueChange).toHaveBeenCalledWith(
            nextField,
            kind === "switch" ? false : "next value",
        );
    });

    it("keeps disabled state and description linkage across onboarding controls", () => {
        const html = renderToStaticMarkup(
            renderControl(field({ kind: "switch", value: true }), {
                disabled: true,
                variant: "onboarding",
            }),
        );

        expect(html).toContain('data-disabled="true"');
        expect(html).toMatch(/<button[^>]*role="switch"[^>]*disabled/);
        expect(html).toContain(
            'aria-describedby="source-field-control-description"',
        );
    });
});
