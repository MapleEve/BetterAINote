import { readFileSync } from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

const AI_RENAME_PREVIEW_CARD_SOURCE = readFileSync(
    path.join(
        process.cwd(),
        "src/features/recordings/components/ai-rename-preview-card.tsx",
    ),
    "utf8",
);

function renderStateSemantics({
    state,
    message,
    unavailable = false,
}: {
    state: "loading" | "error" | "unavailable";
    message: string;
    unavailable?: boolean;
}) {
    return renderToStaticMarkup(
        React.createElement(
            "section",
            {
                "data-control": "ai-rename-preview",
                "data-state": state,
            },
            state === "loading"
                ? React.createElement(
                      React.Fragment,
                      null,
                      React.createElement(Spinner, { "aria-hidden": true }),
                      React.createElement("p", null, message),
                  )
                : React.createElement(
                      Alert,
                      {
                          variant:
                              state === "error" ? "destructive" : "default",
                      },
                      React.createElement(AlertTitle, null, "AI 重命名"),
                      React.createElement(AlertDescription, null, message),
                  ),
            React.createElement(
                Button,
                {
                    type: "button",
                    disabled: state === "loading" || unavailable,
                    "aria-label": "应用",
                },
                "应用",
            ),
            React.createElement(
                Button,
                {
                    type: "button",
                    disabled: unavailable,
                    "aria-label": unavailable ? "重新生成" : "重试",
                },
                unavailable ? "重新生成" : "重试",
            ),
        ),
    );
}

describe("AI rename preview card UI regressions", () => {
    it("keeps loading, error, and unavailable primitive semantics in SSR", () => {
        const loadingHtml = renderStateSemantics({
            state: "loading",
            message: "正在生成标题",
        });
        const errorHtml = renderStateSemantics({
            state: "error",
            message: "生成失败",
        });
        const unavailableHtml = renderStateSemantics({
            state: "unavailable",
            message: "AI 重命名服务尚未配置或暂时不可用。",
            unavailable: true,
        });

        expect(loadingHtml).toContain("正在生成标题");
        expect(loadingHtml).toContain('data-state="loading"');
        expect(loadingHtml).toMatch(
            /<button(?=[^>]*aria-label="应用")(?=[^>]*disabled="")[^>]*>/,
        );
        expect(errorHtml).toContain('role="alert"');
        expect(errorHtml).toContain('data-state="error"');
        expect(errorHtml).toContain("生成失败");
        expect(errorHtml).toMatch(/<button[^>]*aria-label="重试"/);
        expect(unavailableHtml).toContain('role="alert"');
        expect(unavailableHtml).toContain('data-state="unavailable"');
        expect(unavailableHtml).toContain(
            "AI 重命名服务尚未配置或暂时不可用。",
        );
        expect(unavailableHtml).toMatch(
            /<button(?=[^>]*aria-label="应用")(?=[^>]*disabled="")[^>]*>/,
        );
        expect(unavailableHtml).toMatch(
            /<button(?=[^>]*aria-label="重新生成")(?=[^>]*disabled="")[^>]*>/,
        );
    });

    it("keeps review, callbacks, and SOT primitives as source contracts", () => {
        expect(AI_RENAME_PREVIEW_CARD_SOURCE).toContain(
            'data-control="ai-rename-preview"',
        );
        expect(AI_RENAME_PREVIEW_CARD_SOURCE).toContain("data-state={state}");
        expect(AI_RENAME_PREVIEW_CARD_SOURCE).toContain('state === "review"');
        expect(AI_RENAME_PREVIEW_CARD_SOURCE).toContain("原标题");
        expect(AI_RENAME_PREVIEW_CARD_SOURCE).toContain("新标题");
        expect(AI_RENAME_PREVIEW_CARD_SOURCE).toContain(
            "aria-labelledby={titleId}",
        );
        expect(AI_RENAME_PREVIEW_CARD_SOURCE).toContain(
            "aria-describedby={subtitle ? descriptionId : undefined}",
        );
        expect(AI_RENAME_PREVIEW_CARD_SOURCE).toContain("<Spinner");
        expect(AI_RENAME_PREVIEW_CARD_SOURCE).toContain("<Alert");
        expect(AI_RENAME_PREVIEW_CARD_SOURCE).toContain("<AlertTitle");
        expect(AI_RENAME_PREVIEW_CARD_SOURCE).toContain("<AlertDescription");
        expect(AI_RENAME_PREVIEW_CARD_SOURCE).toContain(
            'state === "unavailable"',
        );
        expect(AI_RENAME_PREVIEW_CARD_SOURCE).toContain(
            'state === "error" ? "destructive" : "default"',
        );
        expect(AI_RENAME_PREVIEW_CARD_SOURCE).toContain("onClick={onApply}");
        expect(AI_RENAME_PREVIEW_CARD_SOURCE).toContain("onClick={onCancel}");
        expect(AI_RENAME_PREVIEW_CARD_SOURCE).toContain(
            "onClick={onRegenerate}",
        );
        expect(AI_RENAME_PREVIEW_CARD_SOURCE).toMatch(
            /onEscapeKeyDown=\{\(event\) => \{[\s\S]*?event\.preventDefault\(\);[\s\S]*?onCancel\(\);[\s\S]*?\}\}/,
        );

        for (const primitive of [
            "rounded-xl",
            "border-border",
            "bg-card",
            "bg-muted",
            "text-foreground",
            "text-muted-foreground",
            "text-primary",
            "[box-shadow:var(--card-popover-shadow)]",
            'variant="outline"',
        ]) {
            expect(AI_RENAME_PREVIEW_CARD_SOURCE).toContain(primitive);
        }
        expect(AI_RENAME_PREVIEW_CARD_SOURCE).not.toMatch(/\sstyle=/);
    });
});
