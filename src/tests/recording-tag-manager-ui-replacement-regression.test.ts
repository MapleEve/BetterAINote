import { readFileSync } from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RecordingTagManager } from "@/features/recordings/components/recording-tag-manager";
import type { RecordingTag } from "@/lib/recording-tags";

const tag: RecordingTag = {
    color: "blue",
    icon: "grid",
    id: "tag-1",
    name: "Review",
};

const recording = (tags: RecordingTag[] = []) =>
    ({ id: "recording-1", tags }) as Parameters<
        typeof RecordingTagManager
    >[0]["recording"];

const tagManagerSource = () =>
    readFileSync(
        path.join(
            process.cwd(),
            "src/features/recordings/components/recording-tag-manager.tsx",
        ),
        "utf8",
    );

function renderTagManager({
    availableTags = [tag],
    tags = [],
}: {
    availableTags?: RecordingTag[];
    tags?: RecordingTag[];
} = {}) {
    return renderToStaticMarkup(
        React.createElement(RecordingTagManager, {
            availableTags,
            onAvailableTagsChange: () => undefined,
            onRecordingTagsChange: () => undefined,
            recording: recording(tags),
        }),
    );
}

describe("recording tag manager UI regression", () => {
    it("renders populated manager state directly without an ambient confirmation provider", () => {
        const html = renderTagManager({ tags: [tag] });

        expect(html).toContain('data-control="recording-tag-manager"');
        expect(html).toContain('data-state="ready"');
        expect(html).toContain("管理标签");
        expect(html).toContain("这条录音的标签");
        expect(html).toContain("Review");
    });

    it("renders the empty state with the current create controls", () => {
        const html = renderTagManager({ availableTags: [] });

        expect(html).toContain("尚未创建标签");
        expect(html).toContain('for="recording-tag-create-name"');
        expect(html).toContain("新建标签");
        expect(html).toContain('id="recording-tag-create-name"');
        expect(html).toContain('placeholder="例如：待跟进"');
        expect(html).toContain("颜色");
        expect(html).toContain("图标");
    });

    it("keeps catalog edit, delete, and create controls accessible", () => {
        const html = renderTagManager();

        expect(html).toContain("标签目录");
        expect(html).toContain('aria-label="编辑 Review"');
        expect(html).toContain('aria-label="删除 Review"');
        expect(html).toMatch(/<button[^>]*type="button"[^>]*>.*新建<\/button>/);
    });

    it("uses a local controlled Dialog confirmation instead of an ambient confirmation hook", () => {
        const source = tagManagerSource();

        expect(source).toContain('from "@/components/ui/dialog";');
        expect(source).toContain(
            "const [deleteTarget, setDeleteTarget] = useState<RecordingTag | null>(null);",
        );
        expect(source).toContain("<Dialog");
        expect(source).toContain("open={Boolean(deleteTarget)}");
        expect(source).toContain("onOpenChange={(open) => {");
        expect(source).toContain("<DialogContent>");
        expect(source).toContain("<DialogTitle>删除标签</DialogTitle>");
        expect(source).toContain("onClick={confirmDelete}");
        expect(source).not.toContain("useConfirmDialog");
    });

    it("retains delete retry state and confines DELETE requests to deleteTag", () => {
        const source = tagManagerSource();
        const deleteTagStart = source.indexOf("const deleteTag = async");
        const confirmDeleteStart = source.indexOf(
            "const confirmDelete = () =>",
        );
        const deleteTagSource = source.slice(
            deleteTagStart,
            confirmDeleteStart,
        );

        expect(source).toContain(
            "const [retryAction, setRetryAction] = useState<RetryAction | null>(null);",
        );
        expect(source).toContain('setRetryAction({ tag, type: "delete" });');
        expect(source).toContain("void deleteTag(retryAction.tag);");
        expect(source).toContain('<Alert role="alert" variant="destructive">');
        expect(source).toContain("重试");
        expect(deleteTagStart).toBeGreaterThan(-1);
        expect(confirmDeleteStart).toBeGreaterThan(deleteTagStart);
        expect(deleteTagSource).toContain('method: "DELETE"');
        expect(source.match(/method:\s*"DELETE"/g)).toHaveLength(1);
    });
});
