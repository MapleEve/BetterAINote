import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

type CapturedButtonProps = {
    "aria-label"?: string;
    disabled?: boolean;
    onClick?: () => void;
    children?: ReactNode;
};

type PopoverContentProps = {
    "aria-describedby"?: string;
    "aria-labelledby"?: string;
    children?: ReactNode;
    className?: string;
};

const previewProps = {
    title: "AI 重命名",
    subtitle: "确认新的录音标题",
    filename: "团队周会 - 2026-07-12",
    originalFilename: "录音 2026-07-12",
    applyLabel: "应用",
    cancelLabel: "取消",
    closeLabel: "关闭",
    regenerateLabel: "重新生成",
    isApplying: false,
    isRegenerating: false,
};

async function loadCard(withButtonCapture = false) {
    vi.resetModules();
    const React = await import("react");

    vi.doMock("@/components/ui/popover", () => ({
        Popover: ({ children }: { children?: ReactNode }) => children,
        PopoverAnchor: ({ children }: { children?: ReactNode }) => children,
        PopoverContent: ({
            "aria-describedby": ariaDescribedBy,
            "aria-labelledby": ariaLabelledBy,
            children,
            className,
        }: PopoverContentProps) =>
            React.createElement(
                "div",
                {
                    "aria-describedby": ariaDescribedBy,
                    "aria-labelledby": ariaLabelledBy,
                    className,
                },
                children,
            ),
    }));

    if (withButtonCapture) {
        vi.doMock("@/components/ui/button", () => ({
            Button: (props: CapturedButtonProps) => {
                capturedButtons.push(props);
                return props.children ?? null;
            },
        }));
    } else {
        vi.doUnmock("@/components/ui/button");
    }

    const { renderToStaticMarkup } = await import("react-dom/server");
    const { AiRenamePreviewCard } = await import(
        "@/features/recordings/components/ai-rename-preview-card"
    );

    return { AiRenamePreviewCard, React, renderToStaticMarkup };
}

let capturedButtons: CapturedButtonProps[] = [];

describe("AI rename preview card UI regressions", () => {
    it("keeps the preview and review content semantically readable", async () => {
        const { AiRenamePreviewCard, React, renderToStaticMarkup } =
            await loadCard();
        const html = renderToStaticMarkup(
            React.createElement(AiRenamePreviewCard, {
                ...previewProps,
                state: "review",
                message: "检查标题后再应用",
                onApply: vi.fn(),
                onCancel: vi.fn(),
                onRegenerate: vi.fn(),
            }),
        );

        expect(html).toContain("AI 重命名");
        expect(html).toContain("确认新的录音标题");
        expect(html).toContain("原标题");
        expect(html).toContain("录音 2026-07-12");
        expect(html).toContain("新标题");
        expect(html).toContain("团队周会 - 2026-07-12");
        expect(html).toContain("检查标题后再应用");
        expect(html).toMatch(/aria-labelledby="[^"]+"/);
        expect(html).toMatch(/aria-describedby="[^"]+"/);
        expect(html).toMatch(/<button[^>]*aria-label="应用"/);
        expect(html).toMatch(/<button[^>]*aria-label="取消"/);
    });

    it("invokes the supplied apply, cancel, and regenerate callbacks", async () => {
        capturedButtons = [];
        const { AiRenamePreviewCard, React, renderToStaticMarkup } =
            await loadCard(true);
        const onApply = vi.fn();
        const onCancel = vi.fn();
        const onRegenerate = vi.fn();

        renderToStaticMarkup(
            React.createElement(AiRenamePreviewCard, {
                ...previewProps,
                onApply,
                onCancel,
                onRegenerate,
            }),
        );

        const button = (label: string) => {
            const match = capturedButtons.find(
                (props) => props["aria-label"] === label,
            );
            expect(match).toBeDefined();
            return match as CapturedButtonProps;
        };

        button("应用").onClick?.();
        button("取消").onClick?.();
        button("关闭").onClick?.();
        button("重新生成").onClick?.();

        expect(onApply).toHaveBeenCalledOnce();
        expect(onCancel).toHaveBeenCalledTimes(2);
        expect(onRegenerate).toHaveBeenCalledOnce();
    });

    it("preserves loading and error accessibility states", async () => {
        const { AiRenamePreviewCard, React, renderToStaticMarkup } =
            await loadCard();
        const loadingHtml = renderToStaticMarkup(
            React.createElement(AiRenamePreviewCard, {
                ...previewProps,
                state: "loading",
                message: "正在生成标题",
                onApply: vi.fn(),
                onCancel: vi.fn(),
                onRegenerate: vi.fn(),
            }),
        );
        const errorHtml = renderToStaticMarkup(
            React.createElement(AiRenamePreviewCard, {
                ...previewProps,
                state: "error",
                message: "生成失败",
                hint: "请稍后重试",
                onApply: vi.fn(),
                onCancel: vi.fn(),
                onRegenerate: vi.fn(),
            }),
        );

        expect(loadingHtml).toContain("正在生成标题");
        expect(loadingHtml).toMatch(
            /<button[^>]*disabled=""[^>]*aria-label="应用"/,
        );
        expect(errorHtml).toContain('role="alert"');
        expect(errorHtml).toContain("生成失败");
        expect(errorHtml).toContain("请稍后重试");
    });
});
