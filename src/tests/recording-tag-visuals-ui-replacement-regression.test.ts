import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
    RecordingTagChip,
    RecordingTagIconGlyph,
    recordingTagColorLabel,
    recordingTagIconComponentFor,
    recordingTagSwatchColorClassName,
    recordingTagTextColorClassName,
} from "@/features/recordings/components/recording-tag-visuals";
import type { RecordingTag, RecordingTagIcon } from "@/lib/recording-tags";

const tag = (overrides: Partial<RecordingTag> = {}): RecordingTag => ({
    color: "blue",
    icon: "grid",
    id: "tag-1",
    name: "Review",
    ...overrides,
});

describe("recording tag visual semantics", () => {
    it("keeps the exported color labels and semantic color classes aligned", () => {
        expect(recordingTagColorLabel).toEqual({
            blue: "蓝",
            green: "翠",
            orange: "琥",
            purple: "紫",
            red: "玫",
            slate: "石",
        });
        expect(recordingTagTextColorClassName).toEqual({
            blue: "text-chart-1",
            green: "text-chart-3",
            orange: "text-chart-4",
            purple: "text-chart-5",
            red: "text-destructive",
            slate: "text-muted-foreground",
        });
        expect(recordingTagSwatchColorClassName).toEqual({
            blue: "[background-color:var(--tag-blue)]! data-[state=on]:[background-color:var(--tag-blue)]!",
            green: "[background-color:var(--tag-green)]! data-[state=on]:[background-color:var(--tag-green)]!",
            orange: "[background-color:var(--tag-amber)]! data-[state=on]:[background-color:var(--tag-amber)]!",
            purple: "[background-color:var(--tag-violet)]! data-[state=on]:[background-color:var(--tag-violet)]!",
            red: "[background-color:var(--tag-rose)]! data-[state=on]:[background-color:var(--tag-rose)]!",
            slate: "[background-color:var(--tag-slate)]! data-[state=on]:[background-color:var(--tag-slate)]!",
        });
    });

    it("renders the selected icon with hidden decorative semantics", () => {
        const html = renderToStaticMarkup(
            React.createElement(RecordingTagIconGlyph, { icon: "heart" }),
        );

        expect(html).toContain('class="lucide lucide-heart"');
        expect(html).toContain('aria-hidden="true"');
        expect(html).toContain('focusable="false"');
    });

    it("preserves the tag fallback icon through a single icon mapping", () => {
        const fallbackHtml = renderToStaticMarkup(
            React.createElement(RecordingTagIconGlyph, {
                icon: "unknown" as RecordingTagIcon,
            }),
        );

        expect(fallbackHtml).toContain('class="lucide lucide-tag"');
        expect(recordingTagIconComponentFor).toHaveLength(1);
    });

    it("keeps chip color, readable content, and overflow-safe layout semantics", () => {
        const longName = "Weekly review follow-up";
        const html = renderToStaticMarkup(
            React.createElement(RecordingTagChip, {
                tag: tag({ color: "purple", icon: "star", name: longName }),
            }),
        );

        expect(html).toContain("text-chart-5");
        expect(html).toContain('class="lucide lucide-star"');
        expect(html).toContain(longName);
        expect(html).toContain("overflow-hidden");
        expect(html).toContain("whitespace-nowrap");
        expect(html).toContain("w-fit");
    });
});
