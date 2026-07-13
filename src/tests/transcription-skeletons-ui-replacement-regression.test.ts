import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
    SpeakerReviewSkeleton,
    TranscriptOutputSkeleton,
    TranscriptReviewSkeleton,
} from "@/features/recordings/components/transcription-skeletons";

describe("transcription skeleton loading semantics", () => {
    it("keeps output loading semantics and responsive geometry", () => {
        const html = renderToStaticMarkup(
            React.createElement(TranscriptOutputSkeleton),
        );

        expect(html).toContain('aria-busy="true"');
        expect(html).toContain('aria-live="polite"');
        expect(html).toContain('aria-label="正在加载转写结果"');
        expect(html).toContain("max-[860px]:grid-cols-1");
        expect(html).toContain("min-h-0 flex-1 gap-0");
        expect(html).toContain('aria-hidden="true"');
        expect(
            (html.match(/animate-pulse/g) ?? []).length,
        ).toBeGreaterThanOrEqual(15);
    });

    it("marks review and speaker loading surfaces as busy", () => {
        const html = renderToStaticMarkup(
            React.createElement(
                "div",
                null,
                React.createElement(TranscriptReviewSkeleton),
                React.createElement(SpeakerReviewSkeleton),
            ),
        );

        expect(html).toContain('aria-label="正在加载转写复核"');
        expect(html).toContain('aria-label="正在加载说话人复核"');
        expect((html.match(/aria-busy="true"/g) ?? []).length).toBe(3);
        expect(
            (html.match(/aria-hidden="true"/g) ?? []).length,
        ).toBeGreaterThanOrEqual(30);
        expect(html).toContain("max-[860px]:justify-start");
        expect(html).toContain("border-t pt-3 pb-1");
    });
});
