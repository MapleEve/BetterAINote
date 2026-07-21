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
    it("renders current tags as semantic pressed controls", () => {
        const html = renderTagManager({ tags: [tag] });

        expect(html).toContain('data-control="recording-tag-manager"');
        expect(html).toContain('data-state="ready"');
        expect(html).toContain('aria-pressed="true"');
        expect(html).toContain("Review");
    });

    it("provides one dialog trigger for tag creation instead of an inline draft field", () => {
        const html = renderTagManager({ availableTags: [] });

        expect(html).toContain("尚未创建标签");
        expect(html).toContain('data-control="recording-tag-create"');
        expect(html).toContain('aria-haspopup="dialog"');
        expect(html).toContain("新建标签");
        expect(html).not.toContain('id="recording-tag-create-name"');
    });

    it("keeps edit and delete catalog actions accessible by name", () => {
        const html = renderTagManager();

        expect(html).toContain('aria-label="编辑 Review"');
        expect(html).toContain('aria-label="删除 Review"');
    });
});
